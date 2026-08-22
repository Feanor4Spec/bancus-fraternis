'use strict';

const fs = require('node:fs');
const path = require('node:path');
const crypto = require('node:crypto');
const { AsyncLocalStorage } = require('node:async_hooks');

const PROVIDER = 'postgresql';
const DRIVER = 'node-postgres Pool (optional)';
const DEFAULT_MIGRATION_TABLE = 'bancus_schema_migrations';
const PROPOSAL_SHARE_SCHEMA_VERSION = 'bancus.proposal-secure-share.postgresql.v1';
const PROPOSAL_SHARE_TABLES = Object.freeze({
  proposal_snapshots: Object.freeze([
    'id', 'proposal_id', 'version', 'parent_snapshot_id', 'status', 'engine_version',
    'data_base', 'project_json', 'result_json', 'review_json', 'provenance_json',
    'content_hash', 'owner_id', 'created_at'
  ]),
  proposal_shares: Object.freeze([
    'id', 'snapshot_id', 'terminal_snapshot_id', 'token_hash', 'status', 'owner_id',
    'created_at', 'expires_at', 'revoked_at', 'expired_at'
  ])
});
const PROPOSAL_SHARE_INDEXES = Object.freeze({
  proposal_snapshots: Object.freeze([
    'idx_proposal_snapshots_proposal_version',
    'idx_proposal_snapshots_owner',
    'idx_proposal_snapshots_parent'
  ]),
  proposal_shares: Object.freeze([
    'idx_proposal_shares_token_hash',
    'idx_proposal_shares_owner',
    'idx_proposal_shares_expiry'
  ])
});
const PROPOSAL_SNAPSHOT_TRIGGERS = Object.freeze({
  proposal_snapshots_prevent_update: 'UPDATE',
  proposal_snapshots_prevent_delete: 'DELETE'
});
// Chave de advisory lock compartilhada por todas as mutacoes de usuario. O
// lock e transacional e, portanto, funciona entre processos sem exigir uma
// tabela sentinela ou alterar o schema existente.
const USER_ADMIN_LOCK_NAMESPACE = 1111577667;
const USER_ADMIN_LOCK_KEY = 1;
const ERROR_CODES = Object.freeze({
  URL_REQUIRED: 'BANCUS_DATABASE_URL_REQUIRED',
  DRIVER_MISSING: 'BANCUS_POSTGRESQL_DRIVER_MISSING',
  CONNECTION_FAILED: 'BANCUS_POSTGRESQL_CONNECTION_FAILED',
  SSL_REQUIRED: 'BANCUS_POSTGRESQL_SSL_REQUIRED',
  SCHEMA_MISMATCH: 'BANCUS_POSTGRESQL_SCHEMA_MISMATCH',
  MANIFEST_INVALID: 'BANCUS_POSTGRESQL_MIGRATION_MANIFEST_INVALID',
  AUTH_CONFIG_INVALID: 'BANCUS_POSTGRESQL_AUTH_CONFIG_INVALID',
  OWNER_CONFLICT: 'BANCUS_OWNER_CONFLICT',
  USER_EMAIL_CONFLICT: 'BANCUS_USER_EMAIL_CONFLICT',
  USER_HAS_RELATED_RECORDS: 'BANCUS_USER_HAS_RELATED_RECORDS',
  LAST_ACTIVE_ADMIN: 'LAST_ACTIVE_ADMIN'
});
const IDENTITY_OWNERSHIP_TABLES = Object.freeze([
  'events',
  'snapshots',
  'journey_entities',
  'journey_leads',
  'journey_simulations',
  'journey_proposals'
]);

function ownerConflictResponse() {
  return {
    ok: false,
    status: 409,
    code: ERROR_CODES.OWNER_CONFLICT,
    message: 'Registro nao encontrado ou pertence a outro responsavel.'
  };
}

function userEmailConflictResponse() {
  return {
    ok: false,
    status: 409,
    code: ERROR_CODES.USER_EMAIL_CONFLICT,
    message: 'Nao foi possivel atualizar este usuario com o e-mail informado.'
  };
}

function linkedUserDeleteResponse() {
  return {
    ok: false,
    status: 409,
    code: ERROR_CODES.USER_HAS_RELATED_RECORDS,
    message: 'Este usuario possui historico vinculado. Inative o acesso em vez de excluir.'
  };
}

function lastActiveAdminResponse() {
  return {
    ok: false,
    status: 409,
    code: ERROR_CODES.LAST_ACTIVE_ADMIN,
    message: 'Mantenha ao menos um administrador ativo.'
  };
}

function removesActiveAdminAccess(current, nextRole, nextStatus) {
  return Boolean(
    current
    && current.role === 'admin'
    && current.status === 'active'
    && (nextRole !== 'admin' || nextStatus !== 'active')
  );
}

function writeChanged(result) {
  if (result && Number.isFinite(Number(result.rowCount))) return Number(result.rowCount) > 0;
  return Boolean(result && Array.isArray(result.rows) && result.rows.length);
}

function ownerConflictError() {
  const error = new Error(ownerConflictResponse().message);
  error.code = ERROR_CODES.OWNER_CONFLICT;
  error.status = 409;
  return error;
}

function redactConnectionDetails(value, databaseUrl = '') {
  let output = String(value || '');
  const secrets = [];
  if (databaseUrl) secrets.push(String(databaseUrl));
  try {
    const parsed = databaseUrl ? new URL(databaseUrl) : null;
    if (parsed) {
      const safeDecode = (entry) => {
        try {
          return decodeURIComponent(entry);
        } catch (error) {
          return entry;
        }
      };
      if (parsed.password) secrets.push(parsed.password, safeDecode(parsed.password));
      if (parsed.username) {
        secrets.push(parsed.username, safeDecode(parsed.username), `${parsed.username}:${parsed.password}`);
      }
      if (parsed.hostname) secrets.push(parsed.hostname);
    }
  } catch (error) {
    // A validacao da URL ocorre separadamente; a sanitizacao nunca deve falhar.
  }
  Array.from(new Set(secrets.filter(Boolean))).sort((a, b) => b.length - a.length).forEach((secret) => {
    const pattern = String(secret).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    output = output.replace(new RegExp(pattern, 'gi'), '[redacted]');
  });
  return output
    .replace(/postgres(?:ql)?:\/\/[^\s@]+@/gi, 'postgresql://[redacted]@')
    .replace(/\b(password|pwd)\s*=\s*[^\s;]+/gi, '$1=[redacted]');
}

function providerError(code, message, cause, databaseUrl) {
  const error = new Error(redactConnectionDetails(message, databaseUrl));
  error.code = code;
  error.provider = PROVIDER;
  if (cause) {
    const safeCause = new Error(redactConnectionDetails(cause.message || cause, databaseUrl));
    if (cause.code) safeCause.code = String(cause.code);
    error.cause = safeCause;
  }
  return error;
}

function requireDatabaseUrl(options = {}) {
  const databaseUrl = String(options.databaseUrl || process.env.BANCUS_DATABASE_URL || '').trim();
  if (!databaseUrl) {
    throw providerError(
      ERROR_CODES.URL_REQUIRED,
      'BANCUS_DATABASE_URL e obrigatoria quando BANCUS_DB_PROVIDER=postgresql.'
    );
  }
  let parsed;
  try {
    parsed = new URL(databaseUrl);
  } catch (cause) {
    throw providerError(
      ERROR_CODES.URL_REQUIRED,
      'BANCUS_DATABASE_URL deve ser uma URL PostgreSQL valida.',
      cause,
      databaseUrl
    );
  }
  if (!['postgres:', 'postgresql:'].includes(parsed.protocol)) {
    throw providerError(
      ERROR_CODES.URL_REQUIRED,
      'BANCUS_DATABASE_URL deve usar o protocolo postgresql.',
      null,
      databaseUrl
    );
  }
  return databaseUrl;
}

function isLocalPostgresqlUrl(databaseUrl) {
  try {
    const hostname = new URL(databaseUrl).hostname.toLowerCase();
    return ['localhost', '127.0.0.1', '::1'].includes(hostname);
  } catch (error) {
    return false;
  }
}

function normalizeSsl(value, options = {}) {
  const managed = !isLocalPostgresqlUrl(options.databaseUrl || '');
  if (value && typeof value === 'object') {
    if (managed && value.rejectUnauthorized === false) {
      throw providerError(
        ERROR_CODES.SSL_REQUIRED,
        'O provider PostgreSQL gerenciado exige TLS com verificacao de certificado.',
        null,
        options.databaseUrl
      );
    }
    return { ...value, rejectUnauthorized: value.rejectUnauthorized !== false };
  }
  const mode = String(value === undefined ? '' : value).trim().toLowerCase();
  if (!mode) {
    if (!managed) return false;
    throw providerError(
      ERROR_CODES.SSL_REQUIRED,
      'Defina BANCUS_DB_SSL=true para conectar ao PostgreSQL gerenciado com TLS verificado.',
      null,
      options.databaseUrl
    );
  }
  if (['1', 'true', 'on', 'require', 'verify-ca', 'verify-full'].includes(mode)) {
    return { rejectUnauthorized: true };
  }
  if (['0', 'false', 'off', 'disable', 'disabled', 'no-verify', 'insecure', 'allow-self-signed'].includes(mode)) {
    if (!managed) return false;
    throw providerError(
      ERROR_CODES.SSL_REQUIRED,
      'O provider PostgreSQL gerenciado exige TLS com verificacao de certificado.',
      null,
      options.databaseUrl
    );
  }
  throw providerError(
    ERROR_CODES.SSL_REQUIRED,
    'BANCUS_DB_SSL possui um valor invalido; use true com verificacao de certificado.',
    null,
    options.databaseUrl
  );
}

function shouldSeedUsers(options = {}) {
  const value = options.seedUsers !== undefined ? options.seedUsers : process.env.BANCUS_DB_SEED_USERS;
  if (value === true) return true;
  return ['1', 'true', 'on', 'yes'].includes(String(value === undefined ? '' : value).trim().toLowerCase());
}

function explicitConnectionOptions(databaseUrl) {
  const parsed = new URL(databaseUrl);
  return {
    host: parsed.hostname.replace(/^\[|\]$/g, ''),
    port: parsed.port ? Number(parsed.port) : 5432,
    user: decodeURIComponent(parsed.username || ''),
    password: decodeURIComponent(parsed.password || ''),
    database: decodeURIComponent(parsed.pathname.replace(/^\/+/, ''))
  };
}

function attachPoolErrorListener(pool, options = {}) {
  if (!pool || typeof pool.on !== 'function') return false;
  pool.on('error', (cause) => {
    const safeError = providerError(
      ERROR_CODES.CONNECTION_FAILED,
      'O pool PostgreSQL reportou uma falha de conexao inativa.',
      cause,
      options.databaseUrl
    );
    if (typeof options.onPoolError === 'function') {
      try {
        options.onPoolError(safeError);
      } catch (callbackError) {
        // O listener de seguranca nao propaga erros do observador do host.
      }
    }
  });
  return true;
}

function resolvePool(options, databaseUrl) {
  if (options.pool && typeof options.pool.query === 'function') {
    return { pool: options.pool, owned: false };
  }

  let Pool = options.Pool || (options.driver && options.driver.Pool);
  if (typeof Pool !== 'function') {
    try {
      const driver = require(options.driverModule || 'pg');
      Pool = driver && driver.Pool;
    } catch (cause) {
      throw providerError(
        ERROR_CODES.DRIVER_MISSING,
        'Driver PostgreSQL opcional indisponivel. Injete options.pool/options.Pool ou instale o modulo pg.',
        cause,
        databaseUrl
      );
    }
  }
  if (typeof Pool !== 'function') {
    throw providerError(
      ERROR_CODES.DRIVER_MISSING,
      'O driver PostgreSQL carregado nao expoe um construtor Pool compativel.',
      null,
      databaseUrl
    );
  }

  const rawPoolOptions = options.poolOptions && typeof options.poolOptions === 'object' ? options.poolOptions : {};
  const boundedInteger = (value, fallback, min, max) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : fallback;
  };
  const sslValue = options.ssl !== undefined
    ? options.ssl
    : (rawPoolOptions.ssl !== undefined ? rawPoolOptions.ssl : process.env.BANCUS_DB_SSL);
  const max = boundedInteger(
    options.poolMax ?? rawPoolOptions.max ?? process.env.POOL_MAX ?? process.env.BANCUS_DB_POOL_MAX,
    10,
    1,
    50
  );
  const connectionTimeoutMillis = boundedInteger(
    options.connectionTimeoutMillis
      ?? rawPoolOptions.connectionTimeoutMillis
      ?? process.env.CONNECT_TIMEOUT_MS
      ?? process.env.BANCUS_DB_CONNECT_TIMEOUT_MS,
    5000,
    1000,
    5000
  );
  const queryTimeoutMillis = boundedInteger(
    options.queryTimeoutMillis
      ?? rawPoolOptions.query_timeout
      ?? process.env.QUERY_TIMEOUT_MS
      ?? process.env.BANCUS_DB_QUERY_TIMEOUT_MS,
    10000,
    1000,
    12000
  );
  const idleTimeoutMillis = boundedInteger(
    options.idleTimeoutMillis
      ?? rawPoolOptions.idleTimeoutMillis
      ?? process.env.BANCUS_DB_IDLE_TIMEOUT_MS,
    30000,
    1000,
    300000
  );
  const poolOptions = {
    ...rawPoolOptions,
    ...explicitConnectionOptions(databaseUrl),
    ssl: normalizeSsl(sslValue, { databaseUrl }),
    max,
    connectionTimeoutMillis,
    idleTimeoutMillis,
    query_timeout: queryTimeoutMillis,
    statement_timeout: queryTimeoutMillis
  };
  delete poolOptions.connectionString;
  return { pool: new Pool(poolOptions), owned: true };
}

function loadSchemaManifest(options = {}) {
  if (options.schemaManifest && typeof options.schemaManifest === 'object') {
    return { manifest: options.schemaManifest, manifestPath: options.schemaManifestPath || '' };
  }
  const manifestPath = path.resolve(String(options.schemaManifestPath || ''));
  try {
    return {
      manifest: JSON.parse(fs.readFileSync(manifestPath, 'utf8')),
      manifestPath
    };
  } catch (cause) {
    throw providerError(
      ERROR_CODES.MANIFEST_INVALID,
      'Nao foi possivel carregar o manifest de migrations exigido pelo provider postgresql.',
      cause,
      options.databaseUrl
    );
  }
}

function validateSchemaManifest(manifest, options = {}) {
  const expectedVersion = String(options.schemaVersion || '');
  const providerMigrations = manifest && manifest.providerMigrations && typeof manifest.providerMigrations === 'object'
    ? manifest.providerMigrations
    : {};
  const migration = String(providerMigrations.postgresql || (manifest && manifest.currentMigration) || '').trim();
  const proposalShareMigrations = manifest && manifest.proposalShareMigrations && typeof manifest.proposalShareMigrations === 'object'
    ? manifest.proposalShareMigrations
    : {};
  const proposalShareMigration = String(proposalShareMigrations.postgresql || '').trim();
  const migrationChecksums = manifest && manifest.migrationChecksums && typeof manifest.migrationChecksums === 'object'
    ? manifest.migrationChecksums
    : {};
  const expectedChecksums = Object.fromEntries([migration, proposalShareMigration].map((entry) => (
    [entry, String(migrationChecksums[entry] || '').trim().toLowerCase()]
  )));
  const tableEntries = Array.isArray(manifest && manifest.tables)
    ? manifest.tables.map((entry) => ({
        name: String(entry && entry.name || '').trim(),
        columns: Array.isArray(entry && entry.columns) ? entry.columns.map((column) => String(column || '').trim()).filter(Boolean) : [],
        indexes: Array.isArray(entry && entry.indexes) ? entry.indexes.map((index) => String(index || '').trim()).filter(Boolean) : []
      })).filter((entry) => entry.name)
    : [];
  const tables = tableEntries.map((entry) => entry.name);
  const versionMatches = !expectedVersion || manifest && manifest.schemaVersion === expectedVersion;
  const postgresqlPlanned = manifest && (
    manifest.provider === PROVIDER
    || Boolean(providerMigrations.postgresql)
    || (Array.isArray(manifest.futureProviders) && manifest.futureProviders.includes(PROVIDER))
  );
  if (
    !manifest
    || !versionMatches
    || !migration
    || !proposalShareMigration
    || Object.values(expectedChecksums).some((checksum) => !/^sha256:[a-f0-9]{64}$/.test(checksum))
    || !tables.length
    || tableEntries.some((entry) => !entry.columns.length)
    || !postgresqlPlanned
  ) {
    throw providerError(
      ERROR_CODES.MANIFEST_INVALID,
      'Manifest de migrations incompativel com o schema esperado pelo provider postgresql.',
      null,
      options.databaseUrl
    );
  }
  if (options.manifestPath && migration) {
    const migrationPaths = [migration, proposalShareMigration];
    const missingMigration = migrationPaths.find((entry) => !fs.existsSync(path.resolve(path.dirname(options.manifestPath), entry)));
    if (missingMigration) {
      throw providerError(
        ERROR_CODES.MANIFEST_INVALID,
        `Migration PostgreSQL declarada no manifest nao foi encontrada: ${missingMigration}.`,
        null,
        options.databaseUrl
      );
    }
    for (const migrationName of migrationPaths) {
      const migrationPath = path.resolve(path.dirname(options.manifestPath), migrationName);
      // Canonicaliza apenas EOL para o checksum ser estavel entre checkouts
      // Windows (CRLF) e ambientes de deploy Linux (LF).
      const migrationSource = fs.readFileSync(migrationPath, 'utf8').replace(/\r\n/g, '\n');
      const digest = crypto.createHash('sha256').update(migrationSource, 'utf8').digest('hex');
      if (expectedChecksums[migrationName] !== `sha256:${digest}`) {
        throw providerError(
          ERROR_CODES.MANIFEST_INVALID,
          `Checksum da migration PostgreSQL nao confere: ${migrationName}.`,
          null,
          options.databaseUrl
        );
      }
    }
  }
  const tableColumns = Object.fromEntries(tableEntries.map((entry) => [entry.name, Object.freeze(entry.columns.slice())]));
  Object.entries(PROPOSAL_SHARE_TABLES).forEach(([table, columns]) => {
    tableColumns[table] = columns;
  });
  const tableIndexes = Object.fromEntries(tableEntries.map((entry) => [entry.name, Object.freeze(entry.indexes.slice())]));
  Object.entries(PROPOSAL_SHARE_INDEXES).forEach(([table, indexes]) => {
    tableIndexes[table] = indexes;
  });
  return Object.freeze({
    schemaVersion: manifest.schemaVersion,
    currentMigration: migration,
    proposalShareMigration,
    proposalShareSchemaVersion: PROPOSAL_SHARE_SCHEMA_VERSION,
    migrationChecksums: Object.freeze({ ...expectedChecksums }),
    tables: Object.freeze([...tables, ...Object.keys(PROPOSAL_SHARE_TABLES)]),
    tableColumns: Object.freeze(tableColumns),
    tableIndexes: Object.freeze(tableIndexes),
    proposalSnapshotTriggers: PROPOSAL_SNAPSHOT_TRIGGERS
  });
}

async function verifyPostgresqlSchema(pool, schemaContract, options = {}) {
  const migrationTable = String(options.migrationTable || DEFAULT_MIGRATION_TABLE);
  let tableRows;
  try {
    const result = await pool.query(`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = current_schema()
      ORDER BY table_name ASC
    `);
    tableRows = Array.isArray(result && result.rows) ? result.rows : [];
  } catch (cause) {
    throw providerError(
      ERROR_CODES.CONNECTION_FAILED,
      'Nao foi possivel consultar o schema do provider postgresql.',
      cause,
      options.databaseUrl
    );
  }

  const existingTables = new Set(tableRows.map((row) => String(row.table_name || row.name || '')));
  const missingTables = schemaContract.tables.filter((table) => !existingTables.has(table));
  if (missingTables.length) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      `Schema PostgreSQL incompleto. Tabelas ausentes: ${missingTables.join(', ')}.`,
      null,
      options.databaseUrl
    );
  }

  let columnRows;
  try {
    const columnResult = await pool.query(`
      SELECT table_name, column_name
      FROM information_schema.columns
      WHERE table_schema = current_schema()
      ORDER BY table_name ASC, ordinal_position ASC
    `);
    columnRows = Array.isArray(columnResult && columnResult.rows) ? columnResult.rows : [];
  } catch (cause) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      'Nao foi possivel validar as colunas do schema PostgreSQL.',
      cause,
      options.databaseUrl
    );
  }
  const existingColumns = new Map();
  columnRows.forEach((row) => {
    const table = String(row.table_name || '');
    const column = String(row.column_name || '');
    if (!existingColumns.has(table)) existingColumns.set(table, new Set());
    if (column) existingColumns.get(table).add(column);
  });
  const missingColumns = [];
  Object.entries(schemaContract.tableColumns).forEach(([table, columns]) => {
    const found = existingColumns.get(table) || new Set();
    columns.forEach((column) => {
      if (!found.has(column)) missingColumns.push(`${table}.${column}`);
    });
  });
  if (missingColumns.length) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      `Schema PostgreSQL incompleto. Colunas ausentes: ${missingColumns.join(', ')}.`,
      null,
      options.databaseUrl
    );
  }

  let indexRows;
  try {
    const indexResult = await pool.query(`
      SELECT tablename AS table_name, indexname AS index_name
      FROM pg_indexes
      WHERE schemaname = current_schema()
      ORDER BY tablename ASC, indexname ASC
    `);
    indexRows = Array.isArray(indexResult && indexResult.rows) ? indexResult.rows : [];
  } catch (cause) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      'Nao foi possivel validar os indices do schema PostgreSQL.',
      cause,
      options.databaseUrl
    );
  }
  const existingIndexes = new Set(indexRows.map((row) => `${String(row.table_name || '')}.${String(row.index_name || '')}`));
  const missingIndexes = [];
  Object.entries(schemaContract.tableIndexes).forEach(([table, indexes]) => {
    indexes.forEach((index) => {
      if (!existingIndexes.has(`${table}.${index}`)) missingIndexes.push(`${table}.${index}`);
    });
  });
  if (missingIndexes.length) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      `Schema PostgreSQL incompleto. Indices ausentes: ${missingIndexes.join(', ')}.`,
      null,
      options.databaseUrl
    );
  }

  const requiredMigrations = [
    { name: schemaContract.currentMigration, version: schemaContract.schemaVersion },
    { name: schemaContract.proposalShareMigration, version: schemaContract.proposalShareSchemaVersion }
  ];
  for (const requiredMigration of requiredMigrations) {
    let migrationRow;
    try {
      const migrationResult = await pool.query(
        `SELECT migration_name, schema_version FROM "${migrationTable.replace(/"/g, '""')}" WHERE migration_name = $1 LIMIT 1`,
        [requiredMigration.name]
      );
      migrationRow = migrationResult && Array.isArray(migrationResult.rows) ? migrationResult.rows[0] : null;
    } catch (cause) {
      throw providerError(
        ERROR_CODES.SCHEMA_MISMATCH,
        `Controle de migrations PostgreSQL ausente ou inacessivel: ${migrationTable}.`,
        cause,
        options.databaseUrl
      );
    }
    if (
      !migrationRow
      || String(migrationRow.migration_name || '') !== requiredMigration.name
      || String(migrationRow.schema_version || '') !== requiredMigration.version
    ) {
      throw providerError(
        ERROR_CODES.SCHEMA_MISMATCH,
        `Migration PostgreSQL obrigatoria nao confirmada: ${requiredMigration.name}.`,
        null,
        options.databaseUrl
      );
    }
  }

  let triggerRows;
  try {
    const triggerResult = await pool.query(`
      SELECT trigger_name, event_manipulation, action_timing
      FROM information_schema.triggers
      WHERE trigger_schema = current_schema()
        AND event_object_table = 'proposal_snapshots'
      ORDER BY trigger_name ASC
    `);
    triggerRows = Array.isArray(triggerResult && triggerResult.rows) ? triggerResult.rows : [];
  } catch (cause) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      'Nao foi possivel validar os triggers de imutabilidade das propostas.',
      cause,
      options.databaseUrl
    );
  }
  const triggerContracts = new Set(triggerRows.map((row) => (
    `${String(row.trigger_name || '')}:${String(row.event_manipulation || '').toUpperCase()}:${String(row.action_timing || '').toUpperCase()}`
  )));
  const missingTriggers = Object.entries(schemaContract.proposalSnapshotTriggers)
    .filter(([name, event]) => !triggerContracts.has(`${name}:${event}:BEFORE`))
    .map(([name]) => name);
  if (missingTriggers.length) {
    throw providerError(
      ERROR_CODES.SCHEMA_MISMATCH,
      `Triggers de imutabilidade ausentes: ${missingTriggers.join(', ')}.`,
      null,
      options.databaseUrl
    );
  }

  return Object.freeze({
    migrationTable,
    currentMigration: schemaContract.currentMigration,
    proposalShareMigration: schemaContract.proposalShareMigration,
    schemaVersion: schemaContract.schemaVersion,
    tables: Object.freeze(Array.from(existingTables).sort())
  });
}

class PostgresqlBancusDatabase {
  constructor(pool, context, metadata = {}) {
    this.db = pool;
    this.pool = pool;
    this.provider = PROVIDER;
    this.driver = DRIVER;
    this.schemaVersion = context.SCHEMA_VERSION;
    this.authMode = metadata.authMode === 'demo' ? 'demo' : 'production';
    this.schema = metadata.schema;
    this.ownsPool = Boolean(metadata.ownsPool);
    this.helpers = context;
    this.transactionStorage = new AsyncLocalStorage();
    this.transactionSequence = 0;
  }

  async query(sql, params = []) {
    const client = this.transactionStorage.getStore() || this.pool;
    return client.query(sql, params);
  }

  async close() {
    if (this.ownsPool && this.pool && typeof this.pool.end === 'function') await this.pool.end();
  }

  async withTransaction(callback) {
    const activeClient = this.transactionStorage.getStore();
    if (activeClient) {
      const savepoint = `bancus_nested_${++this.transactionSequence}`;
      await activeClient.query(`SAVEPOINT ${savepoint}`);
      try {
        const value = await callback();
        await activeClient.query(`RELEASE SAVEPOINT ${savepoint}`);
        return value;
      } catch (error) {
        try {
          await activeClient.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
          await activeClient.query(`RELEASE SAVEPOINT ${savepoint}`);
        } catch (rollbackError) {
          // Mantem a causa original.
        }
        throw error;
      }
    }
    const client = this.pool && typeof this.pool.connect === 'function'
      ? await this.pool.connect()
      : this.pool;
    try {
      await client.query('BEGIN');
      const value = await this.transactionStorage.run(client, callback);
      await client.query('COMMIT');
      return value;
    } catch (error) {
      try {
        await client.query('ROLLBACK');
      } catch (rollbackError) {
        // Mantem a causa original; nenhuma mensagem inclui a URL do banco.
      }
      throw error;
    } finally {
      if (client !== this.pool && typeof client.release === 'function') client.release();
    }
  }

  async lockUserAdministration() {
    await this.query(
      'SELECT pg_advisory_xact_lock($1, $2)',
      [USER_ADMIN_LOCK_NAMESPACE, USER_ADMIN_LOCK_KEY]
    );
  }

  async guardLastActiveAdmin(current, nextRole, nextStatus) {
    if (!removesActiveAdminAccess(current, nextRole, nextStatus)) return null;
    const result = await this.query(`
      SELECT COUNT(*)::integer AS active_admins
      FROM users
      WHERE role = 'admin' AND status = 'active'
    `);
    const total = Number(result.rows[0] && result.rows[0].active_admins || 0);
    return total <= 1 ? lastActiveAdminResponse() : null;
  }

  async userHasRelatedRecords(current) {
    const result = await this.query(`
      SELECT /* bancus_user_has_related_records */ (
        EXISTS (SELECT 1 FROM sessions WHERE user_id = $1)
        OR EXISTS (SELECT 1 FROM events WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
        OR EXISTS (SELECT 1 FROM snapshots WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
        OR EXISTS (SELECT 1 FROM journey_entities WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
        OR EXISTS (SELECT 1 FROM journey_leads WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
        OR EXISTS (SELECT 1 FROM journey_simulations WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
        OR EXISTS (SELECT 1 FROM journey_proposals WHERE LOWER(BTRIM(owner_email)) = $2 OR LOWER(BTRIM(actor_email)) = $2)
      ) AS has_related
    `, [current.id, this.helpers.normalizeEmail(current.email)]);
    return Boolean(result.rows[0] && result.rows[0].has_related);
  }

  async seedUsers() {
    if (this.authMode === 'production') throw new Error('Contas demonstrativas nao podem ser semeadas em modo production.');
    const h = this.helpers;
    for (const seed of h.SEED_USERS) {
      const exists = await this.getUserByEmail(seed.email);
      if (exists) continue;
      const timestamp = h.nowIso();
      const credentials = h.hashPassword(seed.password);
      await this.query(`
        INSERT INTO users (
          id, name, email, role, status, department, phone,
          password_hash, password_salt, password_algorithm, password_updated_at,
          created_at, updated_at, last_login_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        ON CONFLICT(email) DO NOTHING
      `, [
        seed.id, seed.name, seed.email, seed.role, seed.status, seed.department, seed.phone,
        credentials.hash, credentials.salt, h.storedPasswordAlgorithm(this.authMode), timestamp, timestamp, timestamp, ''
      ]);
    }
  }

  async listUsers() {
    const result = await this.query('SELECT * FROM users ORDER BY LOWER(name) ASC, name ASC');
    return result.rows.map((row) => this.helpers.publicUser(row, { requireCurrentPasswordPolicy: this.authMode === 'production' }));
  }

  async hasEvent(id) {
    if (!id) return false;
    const result = await this.query('SELECT id FROM events WHERE id = $1 LIMIT 1', [String(id || '')]);
    return Boolean(result.rows[0]);
  }

  async hasSnapshot(id) {
    if (!id) return false;
    const result = await this.query('SELECT id FROM snapshots WHERE id = $1 LIMIT 1', [String(id || '')]);
    return Boolean(result.rows[0]);
  }

  async getUserById(id) {
    const result = await this.query('SELECT * FROM users WHERE id = $1 LIMIT 1', [String(id || '')]);
    return result.rows[0] || null;
  }

  async getUserByEmail(email) {
    const result = await this.query('SELECT * FROM users WHERE email = $1 LIMIT 1', [this.helpers.normalizeEmail(email)]);
    return result.rows[0] || null;
  }

  async findPublicUser(id) {
    return this.helpers.publicUser(await this.getUserById(id), { requireCurrentPasswordPolicy: this.authMode === 'production' });
  }

  async createUser(payload) {
    const h = this.helpers;
    const validation = h.validateUserPayload(payload);
    if (!validation.ok) return validation;
    const data = validation.data;
    if (this.authMode === 'production') {
      if (data.email.endsWith('@bankfratern.local')) {
        return { ok: false, status: 400, code: 'DEMO_IDENTITY_FORBIDDEN', message: 'Use um e-mail individual para este acesso.' };
      }
      const policy = h.validateProductivePassword(data.password, data);
      if (!policy.ok) return policy;
    }
    if (await this.getUserByEmail(data.email)) {
      return { ok: false, status: 409, message: 'Ja existe um usuario com este e-mail.' };
    }
    const timestamp = h.nowIso();
    const passwordUpdatedAt = data.mustChangePassword ? '' : timestamp;
    const credentials = h.hashPassword(data.password);
    const id = data.id && /^[A-Za-z0-9_-]{3,80}$/.test(data.id) ? data.id : h.makeId('USR');
    await this.query(`
      INSERT INTO users (
        id, name, email, role, status, department, phone,
        password_hash, password_salt, password_algorithm, password_updated_at,
        created_at, updated_at, last_login_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      id, data.name, data.email, data.role, data.status, data.department, data.phone,
      credentials.hash, credentials.salt, h.storedPasswordAlgorithm(this.authMode), passwordUpdatedAt, timestamp, timestamp, ''
    ]);
    return { ok: true, status: 201, user: await this.findPublicUser(id), message: 'Usuario criado com sucesso.' };
  }

  async updateUser(id, payload) {
    const h = this.helpers;
    try {
      return await this.withTransaction(async () => {
        await this.lockUserAdministration();
        const currentResult = await this.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [String(id || '')]);
        const current = currentResult.rows[0];
        if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
        const validation = h.validateUserPayload(payload, { editing: true, current });
        if (!validation.ok) return validation;
        const data = validation.data;
        if (this.authMode === 'production' && data.email.endsWith('@bankfratern.local')) {
          return { ok: false, status: 400, code: 'DEMO_IDENTITY_FORBIDDEN', message: 'Use um e-mail individual para este acesso.' };
        }
        if (data.password) {
          if (this.authMode === 'production') {
            const policy = h.validateProductivePassword(data.password, data);
            if (!policy.ok) return policy;
          } else if (String(data.password).length < 6) {
            return { ok: false, status: 400, message: 'A senha temporaria precisa ter pelo menos 6 caracteres.' };
          }
        }
        const adminGuard = await this.guardLastActiveAdmin(current, data.role, data.status);
        if (adminGuard) return adminGuard;
        const currentEmail = h.normalizeEmail(current.email);
        const nextEmail = h.normalizeEmail(data.email);

        if (nextEmail !== currentEmail) {
          const duplicated = await this.query('SELECT id FROM users WHERE email = $1 AND id <> $2 LIMIT 1 FOR UPDATE', [nextEmail, current.id]);
          if (duplicated.rows[0]) return userEmailConflictResponse();
          for (const table of IDENTITY_OWNERSHIP_TABLES) {
            const collision = await this.query(`
              SELECT 1 AS conflict
              FROM ${h.quoteIdentifier(table)}
              WHERE LOWER(BTRIM(owner_email)) = $1 OR LOWER(BTRIM(actor_email)) = $1
              LIMIT 1 FOR UPDATE
            `, [nextEmail]);
            if (collision.rows[0]) return userEmailConflictResponse();
          }

          for (const table of IDENTITY_OWNERSHIP_TABLES) {
            await this.query(`
              UPDATE ${h.quoteIdentifier(table)}
              SET owner_email = CASE WHEN LOWER(BTRIM(owner_email)) = $1 THEN $2 ELSE owner_email END,
                  actor_email = CASE WHEN LOWER(BTRIM(actor_email)) = $1 THEN $2 ELSE actor_email END
              WHERE LOWER(BTRIM(owner_email)) = $1 OR LOWER(BTRIM(actor_email)) = $1
            `, [currentEmail, nextEmail]);
          }
        }

        const timestamp = h.nowIso();
        await this.query(`
          UPDATE users
          SET name = $1, email = $2, role = $3, status = $4, department = $5, phone = $6, updated_at = $7
          WHERE id = $8
        `, [data.name, nextEmail, data.role, data.status, data.department, data.phone, timestamp, current.id]);
        if (data.password) {
          const passwordResult = await this.setPassword(current.id, data.password, {
            mustChangePassword: data.mustChangePassword
          });
          if (!passwordResult.ok) return passwordResult;
        } else if (nextEmail !== currentEmail || data.role !== current.role || data.status !== current.status) {
          await this.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at = ''", [timestamp, current.id]);
        }
        return { ok: true, status: 200, user: await this.findPublicUser(current.id), message: 'Usuario atualizado com sucesso.' };
      });
    } catch (error) {
      if (error && error.code === '23505') return userEmailConflictResponse();
      throw error;
    }
  }

  async deleteUser(id) {
    return this.withTransaction(async () => {
      await this.lockUserAdministration();
      const currentResult = await this.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [String(id || '')]);
      const current = currentResult.rows[0];
      if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
      if (await this.userHasRelatedRecords(current)) return linkedUserDeleteResponse();
      const adminGuard = await this.guardLastActiveAdmin(current, null, null);
      if (adminGuard) return adminGuard;

      const deleteResult = await this.query(`
        DELETE FROM users
        WHERE id = $1
          AND NOT EXISTS (SELECT 1 FROM sessions WHERE user_id = users.id)
          AND NOT EXISTS (
            SELECT 1 FROM events
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
          AND NOT EXISTS (
            SELECT 1 FROM snapshots
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
          AND NOT EXISTS (
            SELECT 1 FROM journey_entities
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
          AND NOT EXISTS (
            SELECT 1 FROM journey_leads
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
          AND NOT EXISTS (
            SELECT 1 FROM journey_simulations
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
          AND NOT EXISTS (
            SELECT 1 FROM journey_proposals
            WHERE LOWER(BTRIM(owner_email)) = LOWER(BTRIM(users.email))
               OR LOWER(BTRIM(actor_email)) = LOWER(BTRIM(users.email))
          )
        RETURNING id
      `, [current.id]);
      if (!writeChanged(deleteResult)) return linkedUserDeleteResponse();
      return { ok: true, status: 200, message: 'Usuario removido.' };
    });
  }

  async setPassword(id, password, options = {}) {
    const h = this.helpers;
    const nextPassword = String(password === undefined || password === null ? '' : password);
    return this.withTransaction(async () => {
      const currentResult = await this.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [String(id || '')]);
      const current = currentResult.rows[0];
      if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
      if (this.authMode === 'production') {
        const policy = h.validateProductivePassword(nextPassword, current);
        if (!policy.ok) return policy;
      } else if (nextPassword.length < 6) {
        return { ok: false, status: 400, message: 'A senha temporaria precisa ter pelo menos 6 caracteres.' };
      }
      const timestamp = h.nowIso();
      const passwordUpdatedAt = options.mustChangePassword === true ? '' : timestamp;
      const credentials = h.hashPassword(nextPassword);
      await this.query(`
        UPDATE users
        SET password_hash = $1, password_salt = $2, password_algorithm = $3, password_updated_at = $4, updated_at = $5
        WHERE id = $6
      `, [credentials.hash, credentials.salt, h.storedPasswordAlgorithm(this.authMode), passwordUpdatedAt, timestamp, current.id]);
      await this.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at = ''", [timestamp, current.id]);
      return { ok: true, status: 200, message: 'Senha atualizada com seguranca.' };
    });
  }

  async changePassword(id, currentPassword, nextPassword) {
    const h = this.helpers;
    return this.withTransaction(async () => {
      const currentResult = await this.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [String(id || '')]);
      const current = currentResult.rows[0];
      if (!current || !h.verifyLoginPassword(current, currentPassword)) {
        return { ok: false, status: 401, code: 'CURRENT_PASSWORD_INVALID', message: 'A senha atual nao confere.' };
      }
      if (h.verifyPassword(nextPassword, current.password_salt, current.password_hash)) {
        return { ok: false, status: 400, code: 'PASSWORD_REUSE', message: 'A nova senha precisa ser diferente da atual.' };
      }
      const policy = h.validateProductivePassword(nextPassword, current);
      if (!policy.ok) return policy;

      const timestamp = h.nowIso();
      const credentials = h.hashPassword(nextPassword);
      await this.query(`
        UPDATE users
        SET password_hash = $1, password_salt = $2, password_algorithm = $3, password_updated_at = $4, updated_at = $5
        WHERE id = $6
      `, [credentials.hash, credentials.salt, h.storedPasswordAlgorithm(this.authMode), timestamp, timestamp, current.id]);
      await this.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at = ''", [timestamp, current.id]);
      const updated = await this.getUserById(current.id);
      return {
        ok: true,
        status: 200,
        user: h.publicUser(updated, { requireCurrentPasswordPolicy: this.authMode === 'production' }),
        session: await this.createSession(updated),
        message: 'Senha atualizada. Seu acesso esta pronto.'
      };
    });
  }

  async revokeUserSessions(id) {
    const result = await this.query(
      "UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at = ''",
      [this.helpers.nowIso(), String(id || '')]
    );
    return Number(result.rowCount || 0);
  }

  async setUserStatus(id, status) {
    const h = this.helpers;
    return this.withTransaction(async () => {
      await this.lockUserAdministration();
      const currentResult = await this.query('SELECT * FROM users WHERE id = $1 FOR UPDATE', [String(id || '')]);
      const current = currentResult.rows[0];
      if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
      const nextStatus = h.normalizeText(status);
      if (!h.STATUS_LABELS[nextStatus]) return { ok: false, status: 400, message: 'Informe um status de usuario valido.' };
      const adminGuard = await this.guardLastActiveAdmin(current, current.role, nextStatus);
      if (adminGuard) return adminGuard;
      const timestamp = h.nowIso();
      await this.query('UPDATE users SET status = $1, updated_at = $2 WHERE id = $3', [nextStatus, timestamp, current.id]);
      if (nextStatus !== 'active') {
        await this.query("UPDATE sessions SET revoked_at = $1 WHERE user_id = $2 AND revoked_at = ''", [timestamp, current.id]);
      }
      return {
        ok: true,
        status: 200,
        user: await this.findPublicUser(current.id),
        message: `Usuario ${(h.STATUS_LABELS[nextStatus] || nextStatus).toLowerCase()}.`
      };
    });
  }

  async login(email, password) {
    const h = this.helpers;
    const user = await this.getUserByEmail(email);
    if (!h.verifyLoginPassword(user, password) || user.status !== 'active') {
      return { ok: false, status: 401, message: 'E-mail ou senha invalidos.' };
    }
    const timestamp = h.nowIso();
    await this.query('UPDATE users SET last_login_at = $1, updated_at = $2 WHERE id = $3', [timestamp, timestamp, user.id]);
    const updated = await this.getUserById(user.id);
    return { ok: true, status: 200, user: h.publicUser(updated, { requireCurrentPasswordPolicy: this.authMode === 'production' }), session: await this.createSession(updated) };
  }

  async createSession(user) {
    const h = this.helpers;
    const token = h.createSessionToken();
    const timestamp = Date.now();
    const createdAt = new Date(timestamp).toISOString();
    const expiresAt = new Date(timestamp + h.SESSION_TTL_MS).toISOString();
    const id = h.makeId('SES');
    await this.query(`
      INSERT INTO sessions (id, user_id, token_hash, role, created_at, expires_at, revoked_at)
      VALUES ($1, $2, $3, $4, $5, $6, '')
    `, [id, user.id, h.tokenHash(token), user.role, createdAt, expiresAt]);
    return { id, token, role: user.role, createdAt, expiresAt };
  }

  async authenticateToken(token) {
    const h = this.helpers;
    const result = await this.query(`
      SELECT sessions.id AS session_id, sessions.role AS session_role,
        sessions.created_at AS session_created_at, sessions.expires_at AS session_expires_at, users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = $1 AND sessions.revoked_at = ''
        AND sessions.expires_at > $2 AND users.status = 'active'
      LIMIT 1
    `, [h.tokenHash(token), h.nowIso()]);
    const row = result.rows[0];
    if (!row) return null;
    return {
      session: {
        id: row.session_id,
        role: row.session_role,
        createdAt: row.session_created_at,
        expiresAt: row.session_expires_at
      },
      user: h.publicUser(row, { requireCurrentPasswordPolicy: this.authMode === 'production' })
    };
  }

  async revokeToken(token) {
    if (!token) return false;
    const result = await this.query(
      "UPDATE sessions SET revoked_at = $1 WHERE token_hash = $2 AND revoked_at = ''",
      [this.helpers.nowIso(), this.helpers.tokenHash(token)]
    );
    return Number(result.rowCount || 0) > 0;
  }

  async recordEvent(input = {}) {
    const h = this.helpers;
    const event = {
      id: h.normalizeText(input.id) || h.makeId('EVT'),
      type: h.normalizeText(input.type, 'event'),
      source: h.normalizeText(input.source, 'api'),
      ownerEmail: h.normalizeEmail(input.ownerEmail),
      actorEmail: h.normalizeEmail(input.actorEmail),
      sessionId: h.normalizeText(input.sessionId),
      entityType: h.normalizeText(input.entityType),
      entityId: h.normalizeText(input.entityId),
      payload: h.sanitizeEventPayload(input.payload || input.details || {}),
      createdAt: h.normalizeText(input.createdAt) || h.nowIso()
    };
    const payloadJson = h.safeJson(event.payload, {
      maxChars: h.MAX_EVENT_PAYLOAD_CHARS,
      envelopeOnOverflow: true
    });
    await this.query(`
      INSERT INTO events (
        id, type, source, owner_email, actor_email, session_id, entity_type, entity_id, payload_json, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [
      event.id, event.type, event.source, event.ownerEmail, event.actorEmail,
      event.sessionId, event.entityType, event.entityId, payloadJson, event.createdAt
    ]);
    return h.publicEvent({
      id: event.id,
      type: event.type,
      source: event.source,
      owner_email: event.ownerEmail,
      actor_email: event.actorEmail,
      session_id: event.sessionId,
      entity_type: event.entityType,
      entity_id: event.entityId,
      payload_json: payloadJson,
      created_at: event.createdAt
    });
  }

  async listEvents(options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const result = await this.query('SELECT * FROM events ORDER BY created_at DESC LIMIT $1', [limit]);
    return result.rows.map(this.helpers.publicEvent);
  }

  async upsertSnapshot(input = {}) {
    const h = this.helpers;
    const timestamp = h.nowIso();
    const snapshot = {
      id: h.normalizeText(input.id) || h.makeId('SNP'),
      type: h.normalizeText(input.type, 'snapshot'),
      source: h.normalizeText(input.source, 'api'),
      ownerEmail: h.normalizeEmail(input.ownerEmail),
      actorEmail: h.normalizeEmail(input.actorEmail),
      entityId: h.normalizeText(input.entityId),
      title: h.normalizeText(input.title),
      status: h.normalizeText(input.status),
      storageKey: h.normalizeText(input.storageKey),
      payload: h.sanitizePersistedPayload(input.payload || input.details || {}),
      createdAt: h.normalizeText(input.createdAt) || timestamp,
      updatedAt: h.normalizeText(input.updatedAt) || timestamp
    };
    const payloadJson = h.safeJson(snapshot.payload);
    const publicRecord = h.publicSnapshot({
      id: snapshot.id,
      type: snapshot.type,
      source: snapshot.source,
      owner_email: snapshot.ownerEmail,
      actor_email: snapshot.actorEmail,
      entity_id: snapshot.entityId,
      title: snapshot.title,
      status: snapshot.status,
      storage_key: snapshot.storageKey,
      payload_json: payloadJson,
      created_at: snapshot.createdAt,
      updated_at: snapshot.updatedAt
    });
    try {
      return await this.withTransaction(async () => {
        const exists = await this.hasSnapshot(snapshot.id);
        const writeResult = await this.query(`
          INSERT INTO snapshots (
            id, type, source, owner_email, actor_email, entity_id, title, status,
            storage_key, payload_json, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
          ON CONFLICT(id) DO UPDATE SET
            type = excluded.type,
            source = excluded.source,
            actor_email = excluded.actor_email,
            entity_id = excluded.entity_id,
            title = excluded.title,
            status = excluded.status,
            storage_key = excluded.storage_key,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
          WHERE LOWER(BTRIM(snapshots.owner_email)) = LOWER(BTRIM(excluded.owner_email))
          RETURNING id
        `, [
          snapshot.id, snapshot.type, snapshot.source, snapshot.ownerEmail, snapshot.actorEmail,
          snapshot.entityId, snapshot.title, snapshot.status, snapshot.storageKey, payloadJson,
          snapshot.createdAt, snapshot.updatedAt
        ]);
        if (!writeChanged(writeResult)) return ownerConflictResponse();
        return {
          created: !exists,
          snapshot: publicRecord,
          entity: await this.upsertJourneyEntityFromSnapshot(publicRecord)
        };
      });
    } catch (error) {
      if (error && error.code === ERROR_CODES.OWNER_CONFLICT) return ownerConflictResponse();
      throw error;
    }
  }

  async upsertJourneyEntityFromSnapshot(snapshot = {}) {
    const h = this.helpers;
    const entity = h.buildJourneyEntity(snapshot);
    if (!entity || !entity.id || !entity.kind) return null;
    const payloadJson = h.safeJson(entity.payload);
    const writeResult = await this.query(`
      INSERT INTO journey_entities (
        id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
        title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT(kind, id) DO UPDATE SET
        source_snapshot_id = excluded.source_snapshot_id,
        snapshot_type = excluded.snapshot_type,
        actor_email = excluded.actor_email,
        title = excluded.title,
        status = excluded.status,
        stage = excluded.stage,
        priority = excluded.priority,
        source = excluded.source,
        related_id = excluded.related_id,
        amount = excluded.amount,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
      WHERE LOWER(BTRIM(journey_entities.owner_email)) = LOWER(BTRIM(excluded.owner_email))
      RETURNING id
    `, [
      entity.id, entity.kind, entity.sourceSnapshotId, entity.snapshotType, entity.ownerEmail,
      entity.actorEmail, entity.title, entity.status, entity.stage, entity.priority, entity.source,
      entity.relatedId, entity.amount, payloadJson, entity.createdAt, entity.updatedAt
    ]);
    if (!writeChanged(writeResult)) throw ownerConflictError();
    const publicRecord = h.publicJourneyEntity({
      id: entity.id,
      kind: entity.kind,
      source_snapshot_id: entity.sourceSnapshotId,
      snapshot_type: entity.snapshotType,
      owner_email: entity.ownerEmail,
      actor_email: entity.actorEmail,
      title: entity.title,
      status: entity.status,
      stage: entity.stage,
      priority: entity.priority,
      source: entity.source,
      related_id: entity.relatedId,
      amount: entity.amount,
      payload_json: payloadJson,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt
    });
    const materializedRecord = await this.upsertMaterializedJourneyRow(publicRecord);
    if (!materializedRecord) throw ownerConflictError();
    return publicRecord;
  }

  materializedTableFor(kind) {
    if (kind === 'lead') return 'journey_leads';
    if (kind === 'simulation') return 'journey_simulations';
    if (kind === 'proposal') return 'journey_proposals';
    return '';
  }

  materializedResponseKey(kind) {
    if (kind === 'lead') return 'lead';
    if (kind === 'simulation') return 'simulation';
    if (kind === 'proposal') return 'proposal';
    return 'record';
  }

  materializedDefaultsFor(kind) {
    if (kind === 'lead') return { prefix: 'LED', title: 'Lead consultivo', status: 'novo', stage: 'contato' };
    if (kind === 'simulation') return { prefix: 'SIM', title: 'Simulacao', status: 'saved', stage: 'simulacao' };
    if (kind === 'proposal') return { prefix: 'PRP', title: 'Proposta', status: 'draft', stage: 'proposta' };
    return { prefix: 'JRN', title: 'Registro de jornada', status: 'active', stage: 'jornada' };
  }

  async findMaterializedJourneyRow(kind, id, options = {}) {
    const h = this.helpers;
    const table = this.materializedTableFor(kind);
    const normalizedId = h.normalizeText(id);
    if (!table || !normalizedId) return null;
    const ownerEmail = h.normalizeEmail(options.ownerEmail);
    const params = [normalizedId];
    let where = 'id = $1';
    if (ownerEmail) {
      params.push(ownerEmail);
      where += ' AND owner_email = $2';
    }
    const result = await this.query(`SELECT * FROM ${h.quoteIdentifier(table)} WHERE ${where} LIMIT 1`, params);
    return result.rows[0] ? h.publicMaterializedJourneyRow(result.rows[0], kind) : null;
  }

  async upsertDirectJourneyRow(kind, input = {}, options = {}) {
    const h = this.helpers;
    const normalizedKind = h.normalizeText(kind);
    const table = this.materializedTableFor(normalizedKind);
    if (!table) return { ok: false, status: 400, message: 'Tipo de jornada invalido.' };
    const defaults = this.materializedDefaultsFor(normalizedKind);
    const timestamp = h.nowIso();
    const id = h.normalizeText(input.id) || h.makeId(defaults.prefix);
    const createOnly = options && options.createOnly === true;
    const existing = createOnly ? null : await this.findMaterializedJourneyRow(normalizedKind, id);
    const requestedOwnerEmail = h.normalizeEmail(input.ownerEmail || input.owner_email);
    if (existing && h.normalizeEmail(existing.ownerEmail) !== requestedOwnerEmail) {
      return ownerConflictResponse();
    }
    const explicitPayload = input.payload !== undefined
      ? input.payload
      : (input.details !== undefined ? input.details : input.data);
    const basePayload = existing && existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload)
      ? existing.payload
      : {};
    const payloadSource = explicitPayload !== undefined ? explicitPayload : { ...basePayload, ...input };
    const payload = h.sanitizePersistedPayload(payloadSource);
    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const entity = {
      id,
      kind: normalizedKind,
      sourceSnapshotId: h.firstText(input.sourceSnapshotId, input.source_snapshot_id, payloadObject.sourceSnapshotId, existing && existing.sourceSnapshotId),
      snapshotType: h.firstText(input.snapshotType, input.snapshot_type, input.type, payloadObject.snapshotType, existing && existing.snapshotType, `direct-${normalizedKind}`),
      ownerEmail: requestedOwnerEmail,
      actorEmail: h.normalizeEmail(input.actorEmail || input.actor_email || (existing && existing.actorEmail)),
      title: h.firstText(input.title, input.name, input.nome, payloadObject.title, payloadObject.name, payloadObject.nome, existing && existing.title, defaults.title),
      status: h.firstText(input.status, payloadObject.status, existing && existing.status, defaults.status),
      stage: h.firstText(input.stage, input.etapa, payloadObject.stage, payloadObject.etapa, existing && existing.stage, defaults.stage),
      priority: h.firstText(input.priority, input.prioridade, payloadObject.priority, payloadObject.prioridade, existing && existing.priority, 'media'),
      source: h.firstText(input.source, payloadObject.source, existing && existing.source, 'direct-api'),
      relatedId: h.firstText(
        input.relatedId, input.related_id, input.entityId, payloadObject.relatedId, payloadObject.related_id,
        payloadObject.simulationId, payloadObject.proposalId, payloadObject.handoffId, payloadObject.journeyId,
        existing && existing.relatedId
      ),
      amount: h.firstNumber(
        input.amount, input.valorCarta, input.valorCredito, payloadObject.amount, payloadObject.valorCarta,
        payloadObject.valorCredito, payloadObject.totalCredit, payloadObject.proposalValue, existing && existing.amount
      ),
      payload,
      createdAt: h.firstText(input.createdAt, input.created_at, payloadObject.createdAt, existing && existing.createdAt, timestamp),
      updatedAt: h.firstText(input.updatedAt, input.updated_at, payloadObject.updatedAt, timestamp)
    };
    const payloadJson = h.safeJson(entity.payload);
    const publicRecord = h.publicJourneyEntity({
      id: entity.id,
      kind: entity.kind,
      source_snapshot_id: entity.sourceSnapshotId,
      snapshot_type: entity.snapshotType,
      owner_email: entity.ownerEmail,
      actor_email: entity.actorEmail,
      title: entity.title,
      status: entity.status,
      stage: entity.stage,
      priority: entity.priority,
      source: entity.source,
      related_id: entity.relatedId,
      amount: entity.amount,
      payload_json: payloadJson,
      created_at: entity.createdAt,
      updated_at: entity.updatedAt
    });
    try {
      return await this.withTransaction(async () => {
        const createSql = `
          INSERT INTO journey_entities (
            id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
            title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT(kind, id) DO NOTHING
          RETURNING id
        `;
        const upsertSql = `
          INSERT INTO journey_entities (
            id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
            title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
          ON CONFLICT(kind, id) DO UPDATE SET
            source_snapshot_id = excluded.source_snapshot_id,
            snapshot_type = excluded.snapshot_type,
            actor_email = excluded.actor_email,
            title = excluded.title,
            status = excluded.status,
            stage = excluded.stage,
            priority = excluded.priority,
            source = excluded.source,
            related_id = excluded.related_id,
            amount = excluded.amount,
            payload_json = excluded.payload_json,
            updated_at = excluded.updated_at
          WHERE LOWER(BTRIM(journey_entities.owner_email)) = LOWER(BTRIM(excluded.owner_email))
          RETURNING id
        `;
        const entityWriteResult = await this.query(createOnly ? createSql : upsertSql, [
          entity.id, entity.kind, entity.sourceSnapshotId, entity.snapshotType, entity.ownerEmail,
          entity.actorEmail, entity.title, entity.status, entity.stage, entity.priority, entity.source,
          entity.relatedId, entity.amount, payloadJson, entity.createdAt, entity.updatedAt
        ]);
        if (!writeChanged(entityWriteResult)) {
          if (createOnly) {
            const record = await this.findMaterializedJourneyRow(normalizedKind, entity.id);
            if (record && h.normalizeEmail(record.ownerEmail) === requestedOwnerEmail) {
              const responseKey = this.materializedResponseKey(normalizedKind);
              return {
                ok: true,
                created: false,
                kind: normalizedKind,
                record,
                [responseKey]: record
              };
            }
          }
          throw ownerConflictError();
        }

        const materializedRecord = await this.upsertMaterializedJourneyRow(publicRecord);
        if (!materializedRecord) throw ownerConflictError();
        const record = await this.findMaterializedJourneyRow(normalizedKind, entity.id) || {
          ...publicRecord,
          materializedTable: table
        };
        const responseKey = this.materializedResponseKey(normalizedKind);
        return { ok: true, created: createOnly ? true : !existing, kind: normalizedKind, record, [responseKey]: record };
      });
    } catch (error) {
      if (error && error.code === ERROR_CODES.OWNER_CONFLICT) return ownerConflictResponse();
      throw error;
    }
  }

  async upsertMaterializedJourneyRow(entity = {}) {
    const h = this.helpers;
    const table = this.materializedTableFor(entity.kind);
    if (!table || !entity.id) return null;
    const writeResult = await this.query(`
      INSERT INTO ${h.quoteIdentifier(table)} (
        id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
        title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16)
      ON CONFLICT(id) DO UPDATE SET
        source_snapshot_id = excluded.source_snapshot_id,
        snapshot_type = excluded.snapshot_type,
        actor_email = excluded.actor_email,
        title = excluded.title,
        status = excluded.status,
        stage = excluded.stage,
        priority = excluded.priority,
        source = excluded.source,
        related_id = excluded.related_id,
        amount = excluded.amount,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
      WHERE LOWER(BTRIM(${h.quoteIdentifier(table)}.owner_email)) = LOWER(BTRIM(excluded.owner_email))
      RETURNING id
    `, [
      entity.id, entity.kind, entity.sourceSnapshotId, entity.snapshotType, entity.ownerEmail,
      entity.actorEmail, entity.title, entity.status, entity.stage, entity.priority, entity.source,
      entity.relatedId, entity.amount, h.safeJson(entity.payload), entity.createdAt, entity.updatedAt
    ]);
    if (!writeChanged(writeResult)) return null;
    return entity;
  }

  async rebuildJourneyEntities() {
    // Rebuild aditivo: registros diretos sao preservados e todos os snapshots
    // sao percorridos, sem o limite publico de listagem.
    const result = await this.query('SELECT * FROM snapshots ORDER BY updated_at DESC');
    const rows = result.rows.map(this.helpers.publicSnapshot);
    const indexed = [];
    for (const snapshot of rows) {
      const entity = await this.upsertJourneyEntityFromSnapshot(snapshot);
      if (entity) indexed.push(entity);
    }
    return {
      ok: true,
      totalSnapshots: rows.length,
      indexed: indexed.length,
      byKind: this.helpers.countBy(indexed, 'kind')
    };
  }

  async listSnapshots(options = {}) {
    const h = this.helpers;
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const params = [];
    const filters = [];
    const type = h.normalizeText(options.type);
    const ownerEmail = h.normalizeEmail(options.ownerEmail);
    if (type) {
      params.push(type);
      filters.push(`type = $${params.length}`);
    }
    if (ownerEmail) {
      params.push(ownerEmail);
      filters.push(`owner_email = $${params.length}`);
    }
    params.push(limit);
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const result = await this.query(`SELECT * FROM snapshots${where} ORDER BY updated_at DESC LIMIT $${params.length}`, params);
    return result.rows.map(h.publicSnapshot);
  }

  async listJourneyEntities(options = {}) {
    const h = this.helpers;
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const params = [];
    const filters = [];
    const kind = h.normalizeText(options.kind);
    const ownerEmail = h.normalizeEmail(options.ownerEmail);
    if (kind) {
      params.push(kind);
      filters.push(`kind = $${params.length}`);
    }
    if (ownerEmail) {
      params.push(ownerEmail);
      filters.push(`owner_email = $${params.length}`);
    }
    params.push(limit);
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const result = await this.query(`SELECT * FROM journey_entities${where} ORDER BY updated_at DESC LIMIT $${params.length}`, params);
    return result.rows.map(h.publicJourneyEntity);
  }

  async journeyEntitySummary(options = {}) {
    const ownerEmail = this.helpers.normalizeEmail(options.ownerEmail);
    const result = ownerEmail
      ? await this.query('SELECT kind, COUNT(*) AS total FROM journey_entities WHERE owner_email = $1 GROUP BY kind', [ownerEmail])
      : await this.query('SELECT kind, COUNT(*) AS total FROM journey_entities GROUP BY kind');
    return result.rows.reduce((acc, row) => {
      acc[row.kind] = Number(row.total || 0);
      acc.total += Number(row.total || 0);
      return acc;
    }, { total: 0, lead: 0, simulation: 0, proposal: 0 });
  }

  async listMaterializedJourneyRows(kind, options = {}) {
    const h = this.helpers;
    const table = this.materializedTableFor(kind);
    if (!table) return [];
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const ownerEmail = h.normalizeEmail(options.ownerEmail);
    const params = [];
    let where = '';
    if (ownerEmail) {
      params.push(ownerEmail);
      where = ' WHERE owner_email = $1';
    }
    params.push(limit);
    const result = await this.query(
      `SELECT * FROM ${h.quoteIdentifier(table)}${where} ORDER BY updated_at DESC LIMIT $${params.length}`,
      params
    );
    return result.rows.map((row) => h.publicMaterializedJourneyRow(row, kind));
  }

  async listLeads(options = {}) {
    return this.listMaterializedJourneyRows('lead', options);
  }

  async listSimulations(options = {}) {
    return this.listMaterializedJourneyRows('simulation', options);
  }

  async listProposals(options = {}) {
    return this.listMaterializedJourneyRows('proposal', options);
  }

  async materializedSummary(options = {}) {
    const [lead, simulation, proposal] = await Promise.all([
      this.listLeads(options),
      this.listSimulations(options),
      this.listProposals(options)
    ]);
    return { lead: lead.length, simulation: simulation.length, proposal: proposal.length };
  }

  async importLocalSnapshot(input = {}, options = {}) {
    const h = this.helpers;
    const dryRun = options.dryRun !== false;
    const timestamp = h.nowIso();
    const users = Array.isArray(input.users) ? input.users.slice(0, 250) : [];
    const events = Array.isArray(input.events) ? input.events.slice(0, 500) : [];
    const snapshots = Array.isArray(input.snapshots) ? input.snapshots.slice(0, 300) : [];
    const userRows = [];
    const eventRows = [];
    const snapshotRows = [];
    const summary = {
      ok: true,
      dryRun,
      source: h.normalizeText(input.source, 'localStorage'),
      passwordProvisioning: 'required',
      users: { total: users.length, importable: 0, imported: 0, skippedExisting: 0, invalid: 0 },
      events: { total: events.length, importable: 0, imported: 0, skippedExisting: 0, invalid: 0, bySource: {} },
      snapshots: { total: snapshots.length, importable: 0, created: 0, updated: 0, invalid: 0, byType: {} }
    };
    if (this.authMode === 'production' && !dryRun && users.length > 0) {
      return {
        ...summary,
        ok: false,
        status: 409,
        code: 'PRODUCTIVE_USER_MIGRATION_REQUIRES_PROVISIONING',
        message: 'O provisionamento de acessos produtivos exige credenciais individuais.'
      };
    }

    for (const item of users) {
      const validation = h.validateUserPayload({
        id: item && item.id,
        name: item && item.name,
        email: item && item.email,
        role: item && item.role,
        status: item && item.status,
        department: item && item.department,
        phone: item && item.phone,
        password: h.IMPORT_TEMP_PASSWORD
      });
      if (!validation.ok) {
        summary.users.invalid += 1;
        continue;
      }
      const data = validation.data;
      const id = data.id && /^[A-Za-z0-9_-]{3,80}$/.test(data.id) ? data.id : h.makeId('USR');
      if (await this.getUserById(id) || await this.getUserByEmail(data.email)) {
        summary.users.skippedExisting += 1;
        continue;
      }
      summary.users.importable += 1;
      userRows.push({ ...data, id });
    }

    for (const item of events) {
      const id = h.normalizeText(item && item.id);
      const type = h.normalizeText(item && item.type, 'local-storage-event');
      if (!id || !type) {
        summary.events.invalid += 1;
        continue;
      }
      if (await this.hasEvent(id)) {
        summary.events.skippedExisting += 1;
        continue;
      }
      const event = {
        id,
        type,
        source: h.normalizeText(item && item.source, 'localStorage'),
        ownerEmail: item && item.ownerEmail,
        actorEmail: item && item.actorEmail ? item.actorEmail : options.actorEmail || '',
        sessionId: item && item.sessionId,
        entityType: item && item.entityType ? item.entityType : 'local-storage',
        entityId: item && item.entityId,
        payload: item && (item.payload || item.details) ? (item.payload || item.details) : {},
        createdAt: item && item.createdAt ? item.createdAt : timestamp
      };
      summary.events.importable += 1;
      eventRows.push(event);
    }
    summary.events.bySource = h.countBy(eventRows, 'source');

    snapshots.forEach((item) => {
      const id = h.normalizeText(item && item.id);
      const type = h.normalizeText(item && item.type, 'snapshot');
      if (!id || !type) {
        summary.snapshots.invalid += 1;
        return;
      }
      summary.snapshots.importable += 1;
      snapshotRows.push({
        id,
        type,
        source: h.normalizeText(item && item.source, 'localStorage'),
        ownerEmail: item && item.ownerEmail,
        actorEmail: item && item.actorEmail ? item.actorEmail : options.actorEmail || '',
        entityId: item && item.entityId,
        title: item && item.title,
        status: item && item.status,
        storageKey: item && item.storageKey,
        payload: item && (item.payload || item.details) ? (item.payload || item.details) : {},
        createdAt: item && item.createdAt ? item.createdAt : timestamp,
        updatedAt: item && item.updatedAt ? item.updatedAt : timestamp
      });
    });
    summary.snapshots.byType = h.countBy(snapshotRows, 'type');
    if (dryRun) return summary;

    await this.withTransaction(async () => {
      for (const data of userRows) {
        const credentials = h.hashPassword(h.IMPORT_TEMP_PASSWORD);
        await this.query(`
          INSERT INTO users (
            id, name, email, role, status, department, phone,
            password_hash, password_salt, password_algorithm, password_updated_at,
            created_at, updated_at, last_login_at
          ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
        `, [
          data.id, data.name, data.email, data.role, data.status, data.department, data.phone,
          credentials.hash, credentials.salt, h.storedPasswordAlgorithm(this.authMode), '', timestamp, timestamp, ''
        ]);
        summary.users.imported += 1;
      }
      for (const event of eventRows) {
        await this.recordEvent(event);
        summary.events.imported += 1;
      }
      for (const snapshot of snapshotRows) {
        const result = await this.upsertSnapshot(snapshot);
        if (result.created) summary.snapshots.created += 1;
        else summary.snapshots.updated += 1;
      }
    });
    return summary;
  }

  async stats() {
    const result = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM events) AS events,
        (SELECT COUNT(*) FROM snapshots) AS snapshots,
        (SELECT COUNT(*) FROM journey_entities) AS journey_entities,
        (SELECT COUNT(*) FROM journey_leads) AS journey_leads,
        (SELECT COUNT(*) FROM journey_simulations) AS journey_simulations,
        (SELECT COUNT(*) FROM journey_proposals) AS journey_proposals,
        (SELECT COUNT(*) FROM sessions WHERE revoked_at = '' AND expires_at > $1) AS active_sessions
    `, [this.helpers.nowIso()]);
    const row = result.rows[0] || {};
    return {
      schemaVersion: this.schemaVersion,
      users: Number(row.users || 0),
      events: Number(row.events || 0),
      snapshots: Number(row.snapshots || 0),
      journeyEntities: Number(row.journey_entities || 0),
      journeyLeads: Number(row.journey_leads || 0),
      journeySimulations: Number(row.journey_simulations || 0),
      journeyProposals: Number(row.journey_proposals || 0),
      activeSessions: Number(row.active_sessions || 0)
    };
  }

  async databaseStatus() {
    const startedAt = Date.now();
    const metadataResult = await this.query(`
      SELECT version() AS version, current_database() AS database_name, current_schema() AS schema_name
    `);
    const metadata = metadataResult.rows[0] || {};
    const tables = [];
    for (const table of this.schema.tables) {
      const result = await this.query(`SELECT COUNT(*) AS total FROM ${this.helpers.quoteIdentifier(table)}`);
      tables.push({ name: table, rows: Number(result.rows[0] && result.rows[0].total || 0) });
    }
    return {
      ok: true,
      provider: this.provider,
      driver: this.driver,
      schemaVersion: this.schemaVersion,
      databasePath: 'managed:postgresql',
      runtime: { node: process.versions.node, platform: process.platform },
      files: {
        main: { exists: false, path: 'managed:postgresql', sizeBytes: 0, updatedAt: '' },
        wal: { exists: false, path: '', sizeBytes: 0, updatedAt: '' },
        shm: { exists: false, path: '', sizeBytes: 0, updatedAt: '' }
      },
      postgresql: {
        version: String(metadata.version || ''),
        database: String(metadata.database_name || ''),
        schema: String(metadata.schema_name || ''),
        migrationTable: this.schema.migrationTable,
        currentMigration: this.schema.currentMigration,
        proposalShareMigration: this.schema.proposalShareMigration,
        latencyMs: Date.now() - startedAt
      },
      stats: await this.stats(),
      tables
    };
  }
}

async function createPostgresqlProvider(options = {}, context = {}) {
  const databaseUrl = requireDatabaseUrl(options);
  const rawAuthMode = String(options.authMode === undefined ? 'production' : options.authMode).trim().toLowerCase();
  if (!['demo', 'production'].includes(rawAuthMode)) {
    throw providerError(ERROR_CODES.AUTH_CONFIG_INVALID, 'Auth mode invalido para PostgreSQL.', null, databaseUrl);
  }
  if (rawAuthMode === 'production' && shouldSeedUsers(options)) {
    throw providerError(ERROR_CODES.AUTH_CONFIG_INVALID, 'Contas demonstrativas nao podem ser semeadas em modo production.', null, databaseUrl);
  }
  const resolved = resolvePool(options, databaseUrl);
  attachPoolErrorListener(resolved.pool, {
    databaseUrl,
    onPoolError: options.onPoolError
  });
  let schemaContract;
  try {
    const loaded = loadSchemaManifest({
      ...options,
      databaseUrl,
      schemaManifestPath: options.schemaManifestPath
    });
    schemaContract = validateSchemaManifest(loaded.manifest, {
      schemaVersion: context.SCHEMA_VERSION,
      manifestPath: loaded.manifestPath,
      databaseUrl
    });
    await resolved.pool.query('SELECT 1 AS ok');
    const verifiedSchema = await verifyPostgresqlSchema(resolved.pool, schemaContract, {
      databaseUrl,
      migrationTable: options.migrationTable
    });
    const database = new PostgresqlBancusDatabase(resolved.pool, context, {
      ownsPool: resolved.owned,
      schema: verifiedSchema,
      authMode: rawAuthMode
    });
    if (shouldSeedUsers(options)) await database.seedUsers();
    return database;
  } catch (cause) {
    if (resolved.owned && resolved.pool && typeof resolved.pool.end === 'function') {
      try {
        await resolved.pool.end();
      } catch (closeError) {
        // O erro original permanece a fonte de diagnostico.
      }
    }
    if (cause && Object.values(ERROR_CODES).includes(cause.code)) throw cause;
    throw providerError(
      ERROR_CODES.CONNECTION_FAILED,
      'Nao foi possivel conectar e inicializar o provider postgresql.',
      cause,
      databaseUrl
    );
  }
}

module.exports = {
  PROVIDER,
  DRIVER,
  DEFAULT_MIGRATION_TABLE,
  ERROR_CODES,
  PostgresqlBancusDatabase,
  createPostgresqlProvider,
  requireDatabaseUrl,
  loadSchemaManifest,
  validateSchemaManifest,
  verifyPostgresqlSchema,
  redactConnectionDetails,
  normalizeSsl,
  shouldSeedUsers,
  attachPoolErrorListener,
  explicitConnectionOptions
};
