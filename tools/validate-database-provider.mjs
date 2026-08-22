import fs from 'node:fs';
import crypto from 'node:crypto';
import os from 'node:os';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Worker } from 'node:worker_threads';

const require = createRequire(import.meta.url);
const ROOT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const REPORT_PATH = path.join(ROOT_DIR, 'docs', 'test-reports', 'database-provider-report.json');
const DB_MODULE_PATH = path.join(ROOT_DIR, 'js', 'backend', 'db.js');
const POSTGRES_PROVIDER_PATH = path.join(ROOT_DIR, 'js', 'backend', 'providers', 'postgresql.js');
const SQLITE_PROVIDER_PATH = path.join(ROOT_DIR, 'js', 'backend', 'providers', 'sqlite.js');
const SCHEMA_MANIFEST_PATH = path.join(ROOT_DIR, 'js', 'backend', 'migrations', 'schema-manifest.json');
const POSTGRES_MIGRATION_PATH = path.join(ROOT_DIR, 'js', 'backend', 'migrations', 'postgresql', '001_bancus_fraternis.sql');
const POSTGRES_PROPOSAL_MIGRATION_PATH = path.join(ROOT_DIR, 'js', 'backend', 'migrations', 'postgresql', '002_proposal_secure_share.sql');
const POSTGRES_PROPOSAL_REPOSITORY_PATH = path.join(ROOT_DIR, 'js', 'backend', 'proposal-share-postgresql-repository.js');
const SERVER_PATH = path.join(ROOT_DIR, 'server.js');
const BACKEND_API_PATH = path.join(ROOT_DIR, 'assets', 'js', 'services', 'backend-api.service.js');
const PACKAGE_PATH = path.join(ROOT_DIR, 'package.json');

const SECRET_SENTINEL = 'BF_PROVIDER_GATE_SECRET_7a31c9';
const TEST_DATABASE_URL = `postgresql://provider_gate:${SECRET_SENTINEL}@127.0.0.1:65432/bancus_gate`;
const REMOTE_TEST_DATABASE_URL = `postgresql://provider_gate:${SECRET_SENTINEL}@db.provider-gate.invalid:5432/bancus_gate`;
const HOSTILE_REMOTE_TEST_DATABASE_URL = `${REMOTE_TEST_DATABASE_URL}?sslmode=disable&ssl=false&query_timeout=1&statement_timeout=1`;
const PROPOSAL_TABLE_COLUMNS = Object.freeze({
  proposal_snapshots: [
    'id', 'proposal_id', 'version', 'parent_snapshot_id', 'status', 'engine_version', 'data_base',
    'project_json', 'result_json', 'review_json', 'provenance_json', 'content_hash', 'owner_id', 'created_at'
  ],
  proposal_shares: [
    'id', 'snapshot_id', 'terminal_snapshot_id', 'token_hash', 'status', 'owner_id',
    'created_at', 'expires_at', 'revoked_at', 'expired_at'
  ]
});
const PROPOSAL_TABLE_INDEXES = Object.freeze({
  proposal_snapshots: [
    'idx_proposal_snapshots_proposal_version',
    'idx_proposal_snapshots_owner',
    'idx_proposal_snapshots_parent'
  ],
  proposal_shares: [
    'idx_proposal_shares_token_hash',
    'idx_proposal_shares_owner',
    'idx_proposal_shares_expiry'
  ]
});
const PROPOSAL_TRIGGERS = Object.freeze({
  proposal_snapshots_prevent_update: 'UPDATE',
  proposal_snapshots_prevent_delete: 'DELETE'
});
const checks = [];
const gaps = [];
let temporaryDirectory = '';

const originalEnvironment = {
  BANCUS_DB_PROVIDER: Object.prototype.hasOwnProperty.call(process.env, 'BANCUS_DB_PROVIDER')
    ? process.env.BANCUS_DB_PROVIDER
    : undefined,
  BANCUS_DATABASE_URL: Object.prototype.hasOwnProperty.call(process.env, 'BANCUS_DATABASE_URL')
    ? process.env.BANCUS_DATABASE_URL
    : undefined,
  BANCUS_DB_PATH: Object.prototype.hasOwnProperty.call(process.env, 'BANCUS_DB_PATH')
    ? process.env.BANCUS_DB_PATH
    : undefined,
  BANCUS_SHARE_DB_PATH: Object.prototype.hasOwnProperty.call(process.env, 'BANCUS_SHARE_DB_PATH')
    ? process.env.BANCUS_SHARE_DB_PATH
    : undefined
};

delete process.env.BANCUS_DB_PROVIDER;
delete process.env.BANCUS_DATABASE_URL;

function restoreEnvironment() {
  for (const [name, value] of Object.entries(originalEnvironment)) {
    if (value === undefined) delete process.env[name];
    else process.env[name] = value;
  }
}

async function withEnvironment(overrides, callback) {
  const snapshot = {};
  for (const [name, value] of Object.entries(overrides)) {
    snapshot[name] = Object.prototype.hasOwnProperty.call(process.env, name) ? process.env[name] : undefined;
    if (value === undefined) delete process.env[name];
    else process.env[name] = String(value);
  }
  try {
    return await callback();
  } finally {
    for (const [name, value] of Object.entries(snapshot)) {
      if (value === undefined) delete process.env[name];
      else process.env[name] = value;
    }
  }
}

function redact(value) {
  return String(value || '')
    .split(TEST_DATABASE_URL).join('[database-url-redacted]')
    .split(HOSTILE_REMOTE_TEST_DATABASE_URL).join('[database-url-redacted]')
    .split(REMOTE_TEST_DATABASE_URL).join('[database-url-redacted]')
    .split(SECRET_SENTINEL).join('[secret-redacted]')
    .replace(/postgres(?:ql)?:\/\/[^\s'"`]+/gi, '[database-url-redacted]')
    .replace(/\b(password|senha|token|secret)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]');
}

function errorText(error) {
  const fragments = [];
  const seen = new Set();
  let current = error;
  while (current && !seen.has(current)) {
    seen.add(current);
    fragments.push(String(current.message || current));
    if (current.stack) fragments.push(String(current.stack));
    current = current.cause;
  }
  return fragments.join('\n');
}

function safeError(error) {
  return {
    name: String(error && error.name || 'Error'),
    code: error && error.code ? String(error.code) : '',
    message: redact(error && error.message ? error.message : error)
  };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sameJson(actual, expected) {
  return JSON.stringify(actual) === JSON.stringify(expected);
}

async function check(id, title, test) {
  const startedAt = Date.now();
  try {
    const evidence = await test();
    checks.push({
      id,
      title,
      status: 'PASS',
      durationMs: Date.now() - startedAt,
      evidence: evidence === undefined ? null : evidence
    });
  } catch (error) {
    checks.push({
      id,
      title,
      status: 'FAIL',
      durationMs: Date.now() - startedAt,
      error: safeError(error)
    });
  }
}

async function expectProviderFailure(factory, expectedCode, label) {
  let thrown = null;
  try {
    await Promise.resolve(factory());
  } catch (error) {
    thrown = error;
  }
  assert(thrown, `${label} deveria falhar explicitamente.`);
  if (expectedCode) {
    assert(
      thrown.code === expectedCode,
      `${label} retornou codigo ${String(thrown.code || '(ausente)')} em vez de ${expectedCode}.`
    );
  }
  const raw = errorText(thrown);
  assert(!raw.includes(SECRET_SENTINEL), `${label} vazou a sentinela de segredo no erro.`);
  assert(!raw.includes(TEST_DATABASE_URL), `${label} vazou a URL de banco no erro.`);
  assert(!raw.includes(REMOTE_TEST_DATABASE_URL), `${label} vazou a URL remota de banco no erro.`);
  return {
    code: String(thrown.code || ''),
    message: redact(thrown.message)
  };
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'));
}

function expectedPostgresqlMigration(manifest) {
  return String(
    manifest
    && manifest.providerMigrations
    && manifest.providerMigrations.postgresql
    || manifest
    && manifest.currentMigration
    || ''
  ).trim();
}

function migrationChecksum(filePath) {
  const canonical = fs.readFileSync(filePath, 'utf8').replace(/\r\n/g, '\n');
  return `sha256:${crypto.createHash('sha256').update(canonical, 'utf8').digest('hex')}`;
}

function normalizeSql(sql) {
  return String(sql || '').replace(/\s+/g, ' ').trim().toLowerCase();
}

function escapeRegExp(value) {
  return String(value || '').replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function cloneRow(row) {
  return row ? JSON.parse(JSON.stringify(row)) : row;
}

function sqliteAdminMutationWorker({ dbPath, operation, targetId, barrier }) {
  const source = `
    const { parentPort, workerData } = require('node:worker_threads');
    const dbModule = require(workerData.dbModulePath);
    let database = null;
    try {
      database = dbModule.createDatabase({
        provider: 'sqlite',
        dbPath: workerData.dbPath,
        authMode: 'production',
        seedUsers: false
      });
      database.db.exec('PRAGMA busy_timeout = 5000');
      const barrier = new Int32Array(workerData.barrier);
      parentPort.postMessage({ type: 'ready' });
      while (Atomics.load(barrier, 0) === 0) Atomics.wait(barrier, 0, 0);
      let result;
      if (workerData.operation === 'delete') result = database.deleteUser(workerData.targetId);
      else if (workerData.operation === 'demotion') result = database.updateUser(workerData.targetId, { role: 'consultor' });
      else if (workerData.operation === 'inactivation') result = database.setUserStatus(workerData.targetId, 'inactive');
      else throw new Error('Operacao concorrente SQLite desconhecida.');
      parentPort.postMessage({ type: 'result', operation: workerData.operation, result });
    } catch (error) {
      parentPort.postMessage({
        type: 'error',
        operation: workerData.operation,
        error: { code: String(error && error.code || ''), message: String(error && error.message || error) }
      });
    } finally {
      if (database) database.close();
    }
  `;
  const worker = new Worker(source, {
    eval: true,
    workerData: { dbModulePath: DB_MODULE_PATH, dbPath, operation, targetId, barrier }
  });
  let readySettled = false;
  let resultSettled = false;
  let resolveReady;
  let rejectReady;
  let resolveResult;
  let rejectResult;
  const ready = new Promise((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const result = new Promise((resolve, reject) => {
    resolveResult = resolve;
    rejectResult = reject;
  });
  // O worker pode falhar durante o setup, antes de o chamador chegar ao
  // Promise de resultado. Mantem a rejeicao observavel sem unhandled rejection.
  result.catch(() => {});
  const fail = (error) => {
    if (!readySettled) {
      readySettled = true;
      rejectReady(error);
    }
    if (!resultSettled) {
      resultSettled = true;
      rejectResult(error);
    }
  };
  worker.on('message', (message) => {
    if (message && message.type === 'ready' && !readySettled) {
      readySettled = true;
      resolveReady();
      return;
    }
    if (message && message.type === 'result' && !resultSettled) {
      resultSettled = true;
      resolveResult({ operation: message.operation, result: message.result });
      return;
    }
    if (message && message.type === 'error') {
      const error = new Error(message.error && message.error.message || `Worker SQLite ${operation} falhou.`);
      error.code = message.error && message.error.code || '';
      fail(error);
    }
  });
  worker.on('error', fail);
  worker.on('exit', (code) => {
    if (code !== 0) fail(new Error(`Worker SQLite ${operation} encerrou com codigo ${code}.`));
  });
  return { ready, result };
}

async function runConcurrentSqliteAdminMutations(dbPath, mutations = [
  { operation: 'demotion', targetId: 'USR-SQLITE-ADMIN-A' },
  { operation: 'inactivation', targetId: 'USR-SQLITE-ADMIN-B' }
]) {
  const barrier = new SharedArrayBuffer(Int32Array.BYTES_PER_ELEMENT);
  const state = new Int32Array(barrier);
  const workers = [];
  // Cada conexao termina a inicializacao idempotente do schema antes da
  // proxima ser aberta. A barreira continua sincronizando apenas as mutacoes,
  // que e a concorrencia sob teste.
  for (const { operation, targetId } of mutations) {
    const worker = sqliteAdminMutationWorker({ dbPath, operation, targetId, barrier });
    workers.push(worker);
    await worker.ready;
  }
  Atomics.store(state, 0, 1);
  Atomics.notify(state, 0, workers.length);
  return Promise.all(workers.map((worker) => worker.result));
}

function journeyRowFromParams(params) {
  return {
    id: params[0],
    kind: params[1],
    source_snapshot_id: params[2],
    snapshot_type: params[3],
    owner_email: params[4],
    actor_email: params[5],
    title: params[6],
    status: params[7],
    stage: params[8],
    priority: params[9],
    source: params[10],
    related_id: params[11],
    amount: params[12],
    payload_json: params[13],
    created_at: params[14],
    updated_at: params[15]
  };
}

class SchemaPool {
  constructor(manifest, options = {}) {
    this.manifest = manifest;
    this.missingTables = Boolean(options.missingTables);
    this.failConnection = Boolean(options.failConnection);
    this.badMigration = Boolean(options.badMigration);
    this.queries = [];
    this.ended = false;
  }

  async query(sql, params = []) {
    const normalized = normalizeSql(sql);
    this.queries.push({ sql: normalized, params: params.slice() });
    if (this.failConnection) {
      const error = new Error(`ECONNREFUSED while opening ${TEST_DATABASE_URL}`);
      error.code = 'ECONNREFUSED';
      throw error;
    }
    if (normalized === 'select 1 as ok') return { rows: [{ ok: 1 }], rowCount: 1 };
    if (normalized.includes('from information_schema.tables')) {
      const tableNames = this.missingTables
        ? []
        : [...this.manifest.tables.map((entry) => entry.name), ...Object.keys(PROPOSAL_TABLE_COLUMNS)];
      return { rows: tableNames.map((table_name) => ({ table_name })), rowCount: tableNames.length };
    }
    if (normalized.includes('from information_schema.columns')) {
      const baseRows = this.manifest.tables.flatMap((entry) => (
        (entry.columns || []).map((column_name) => ({ table_name: entry.name, column_name }))
      ));
      const proposalRows = Object.entries(PROPOSAL_TABLE_COLUMNS).flatMap(([table_name, columns]) => (
        columns.map((column_name) => ({ table_name, column_name }))
      ));
      const rows = this.missingTables ? [] : [...baseRows, ...proposalRows];
      return { rows, rowCount: rows.length };
    }
    if (normalized.includes('from pg_indexes')) {
      const baseRows = this.manifest.tables.flatMap((entry) => (
        (entry.indexes || []).map((index_name) => ({ table_name: entry.name, index_name }))
      ));
      const proposalRows = Object.entries(PROPOSAL_TABLE_INDEXES).flatMap(([table_name, indexes]) => (
        indexes.map((index_name) => ({ table_name, index_name }))
      ));
      const rows = this.missingTables ? [] : [...baseRows, ...proposalRows];
      return { rows, rowCount: rows.length };
    }
    if (normalized.includes('select migration_name, schema_version')) {
      const requestedMigration = String(params[0] || '');
      let schemaVersion = '';
      if (requestedMigration === expectedPostgresqlMigration(this.manifest)) schemaVersion = this.manifest.schemaVersion;
      if (requestedMigration === 'postgresql/002_proposal_secure_share.sql') {
        schemaVersion = 'bancus.proposal-secure-share.postgresql.v1';
      }
      if (this.badMigration || !schemaVersion) return { rows: [], rowCount: 0 };
      return {
        rows: [{
          migration_name: requestedMigration,
          schema_version: schemaVersion
        }],
        rowCount: 1
      };
    }
    if (normalized.includes('from information_schema.triggers')) {
      const rows = this.missingTables
        ? []
        : Object.entries(PROPOSAL_TRIGGERS).map(([trigger_name, event_manipulation]) => ({
          trigger_name,
          event_manipulation,
          action_timing: 'BEFORE'
        }));
      return { rows, rowCount: rows.length };
    }
    return { rows: [], rowCount: 0 };
  }

  async end() {
    this.ended = true;
  }
}

class MemoryPostgresqlPool extends SchemaPool {
  constructor(manifest) {
    super(manifest);
    this.users = new Map();
    this.sessions = new Map();
    this.events = [];
    this.snapshots = new Map();
    this.journeyEntities = new Map();
    this.materialized = {
      journey_leads: new Map(),
      journey_simulations: new Map(),
      journey_proposals: new Map()
    };
  }

  async query(sql, params = []) {
    const normalized = normalizeSql(sql);
    const plain = normalized.replace(/"/g, '');

    if (
      normalized === 'select 1 as ok'
      || normalized.includes('from information_schema.tables')
      || normalized.includes('from information_schema.columns')
      || normalized.includes('from pg_indexes')
      || normalized.includes('select migration_name, schema_version')
      || normalized.includes('from information_schema.triggers')
    ) {
      return super.query(sql, params);
    }

    this.queries.push({ sql: normalized, params: params.slice() });

    if (plain === 'begin' || plain === 'commit' || plain === 'rollback') {
      return { rows: [], rowCount: 0 };
    }

    if (plain.startsWith('select pg_advisory_xact_lock($1, $2)')) {
      return { rows: [{ pg_advisory_xact_lock: null }], rowCount: 1 };
    }

    if (plain.startsWith('select count(*)::integer as active_admins from users')) {
      const activeAdmins = Array.from(this.users.values())
        .filter((user) => user.role === 'admin' && user.status === 'active')
        .length;
      return { rows: [{ active_admins: activeAdmins }], rowCount: 1 };
    }

    if (normalized.includes('bancus_user_has_related_records')) {
      const userId = String(params[0] || '');
      const email = String(params[1] || '').trim().toLowerCase();
      const ownedByEmail = (row) => [row && row.owner_email, row && row.actor_email]
        .some((value) => String(value || '').trim().toLowerCase() === email);
      const hasRelated = Array.from(this.sessions.values()).some((row) => String(row.user_id || '') === userId)
        || this.events.some(ownedByEmail)
        || Array.from(this.snapshots.values()).some(ownedByEmail)
        || Array.from(this.journeyEntities.values()).some(ownedByEmail)
        || Object.values(this.materialized).some((table) => Array.from(table.values()).some(ownedByEmail));
      return { rows: [{ has_related: hasRelated }], rowCount: 1 };
    }

    if (plain.startsWith('select * from users where email = $1')) {
      const email = String(params[0] || '').toLowerCase();
      const row = Array.from(this.users.values()).find((item) => String(item.email).toLowerCase() === email);
      return { rows: row ? [cloneRow(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('select id from users where email = $1 and id <> $2')) {
      const email = String(params[0] || '').toLowerCase();
      const excludedId = String(params[1] || '');
      const row = Array.from(this.users.values()).find((item) => (
        String(item.email).toLowerCase() === email && String(item.id) !== excludedId
      ));
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('select * from users where id = $1')) {
      const row = this.users.get(String(params[0] || ''));
      return { rows: row ? [cloneRow(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('select * from users order by')) {
      const rows = Array.from(this.users.values())
        .sort((a, b) => String(a.name).localeCompare(String(b.name)))
        .map(cloneRow);
      return { rows, rowCount: rows.length };
    }

    if (plain.startsWith('insert into users')) {
      const row = {
        id: params[0],
        name: params[1],
        email: params[2],
        role: params[3],
        status: params[4],
        department: params[5],
        phone: params[6],
        password_hash: params[7],
        password_salt: params[8],
        password_algorithm: params[9],
        password_updated_at: params[10],
        created_at: params[11],
        updated_at: params[12],
        last_login_at: params[13]
      };
      this.users.set(String(row.id), row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('update users set name = $1')) {
      const updatesEmail = plain.includes('email = $2');
      const id = String(params[updatesEmail ? 7 : 6] || '');
      const row = this.users.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      if (updatesEmail) {
        Object.assign(row, {
          name: params[0],
          email: params[1],
          role: params[2],
          status: params[3],
          department: params[4],
          phone: params[5],
          updated_at: params[6]
        });
      } else {
        Object.assign(row, {
          name: params[0],
          role: params[1],
          status: params[2],
          department: params[3],
          phone: params[4],
          updated_at: params[5]
        });
      }
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('update users set password_hash = $1')) {
      const id = String(params[5] || '');
      const row = this.users.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      Object.assign(row, {
        password_hash: params[0],
        password_salt: params[1],
        password_algorithm: params[2],
        password_updated_at: params[3],
        updated_at: params[4]
      });
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('update users set status = $1')) {
      const id = String(params[2] || '');
      const row = this.users.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      row.status = params[0];
      row.updated_at = params[1];
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('update users set last_login_at = $1')) {
      const id = String(params[2] || '');
      const row = this.users.get(id);
      if (!row) return { rows: [], rowCount: 0 };
      row.last_login_at = params[0];
      row.updated_at = params[1];
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('delete from users where id = $1')) {
      const id = String(params[0] || '');
      const user = this.users.get(id);
      if (!user) return { rows: [], rowCount: 0 };
      const email = String(user.email || '').trim().toLowerCase();
      const linked = plain.includes('not exists') && (
        Array.from(this.sessions.values()).some((row) => String(row.user_id || '') === id)
        || this.events.some((row) => [row.owner_email, row.actor_email].some((value) => String(value || '').trim().toLowerCase() === email))
        || Array.from(this.snapshots.values()).some((row) => [row.owner_email, row.actor_email].some((value) => String(value || '').trim().toLowerCase() === email))
        || Array.from(this.journeyEntities.values()).some((row) => [row.owner_email, row.actor_email].some((value) => String(value || '').trim().toLowerCase() === email))
        || Object.values(this.materialized).some((table) => Array.from(table.values()).some((row) => (
          [row.owner_email, row.actor_email].some((value) => String(value || '').trim().toLowerCase() === email)
        )))
      );
      if (linked) return { rows: [], rowCount: 0 };
      this.users.delete(id);
      return { rows: [{ id }], rowCount: 1 };
    }

    if (plain.startsWith('insert into events')) {
      const row = {
        id: params[0],
        type: params[1],
        source: params[2],
        owner_email: params[3],
        actor_email: params[4],
        session_id: params[5],
        entity_type: params[6],
        entity_id: params[7],
        payload_json: params[8],
        created_at: params[9]
      };
      this.events = this.events.filter((item) => item.id !== row.id);
      this.events.push(row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('insert into sessions')) {
      const row = {
        id: params[0],
        user_id: params[1],
        token_hash: params[2],
        role: params[3],
        created_at: params[4],
        expires_at: params[5],
        revoked_at: ''
      };
      this.sessions.set(String(row.id), row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.includes('from sessions join users on users.id = sessions.user_id')) {
      const tokenHash = String(params[0] || '');
      const now = String(params[1] || '');
      const session = Array.from(this.sessions.values()).find((item) => (
        item.token_hash === tokenHash && !item.revoked_at && item.expires_at > now
      ));
      const user = session ? this.users.get(String(session.user_id)) : null;
      if (!session || !user || user.status !== 'active') return { rows: [], rowCount: 0 };
      return {
        rows: [{
          ...cloneRow(user),
          session_id: session.id,
          session_role: session.role,
          session_created_at: session.created_at,
          session_expires_at: session.expires_at
        }],
        rowCount: 1
      };
    }

    if (plain.startsWith('update sessions set revoked_at = $1 where user_id = $2')) {
      let changed = 0;
      for (const session of this.sessions.values()) {
        if (session.user_id === params[1] && !session.revoked_at) {
          session.revoked_at = params[0];
          changed += 1;
        }
      }
      return { rows: [], rowCount: changed };
    }

    if (plain.startsWith('update sessions set revoked_at = $1 where token_hash = $2')) {
      let changed = 0;
      for (const session of this.sessions.values()) {
        if (session.token_hash === params[1] && !session.revoked_at) {
          session.revoked_at = params[0];
          changed += 1;
        }
      }
      return { rows: [], rowCount: changed };
    }

    if (plain.startsWith('select id from snapshots where id = $1')) {
      const row = this.snapshots.get(String(params[0] || ''));
      return { rows: row ? [{ id: row.id }] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('insert into snapshots')) {
      const row = {
        id: params[0],
        type: params[1],
        source: params[2],
        owner_email: params[3],
        actor_email: params[4],
        entity_id: params[5],
        title: params[6],
        status: params[7],
        storage_key: params[8],
        payload_json: params[9],
        created_at: params[10],
        updated_at: params[11]
      };
      const existing = this.snapshots.get(String(row.id));
      if (existing && String(existing.owner_email).trim().toLowerCase() !== String(row.owner_email).trim().toLowerCase()) {
        return { rows: [], rowCount: 0 };
      }
      this.snapshots.set(String(row.id), row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('select * from snapshots')) {
      const ownerFilter = plain.includes('owner_email = $');
      const typeFilter = plain.includes('type = $');
      let cursor = 0;
      const type = typeFilter ? params[cursor++] : '';
      const ownerEmail = ownerFilter ? params[cursor++] : '';
      const limit = Number(params[cursor] || 100);
      const rows = Array.from(this.snapshots.values())
        .filter((row) => !type || row.type === type)
        .filter((row) => !ownerEmail || row.owner_email === ownerEmail)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, limit)
        .map(cloneRow);
      return { rows, rowCount: rows.length };
    }

    if (plain.startsWith('select * from events order by created_at desc')) {
      const limit = Number(params[0] || 100);
      const rows = this.events.slice().sort((a, b) => String(b.created_at).localeCompare(String(a.created_at))).slice(0, limit).map(cloneRow);
      return { rows, rowCount: rows.length };
    }

    const identityTables = {
      events: this.events,
      snapshots: Array.from(this.snapshots.values()),
      journey_entities: Array.from(this.journeyEntities.values()),
      journey_leads: Array.from(this.materialized.journey_leads.values()),
      journey_simulations: Array.from(this.materialized.journey_simulations.values()),
      journey_proposals: Array.from(this.materialized.journey_proposals.values())
    };
    for (const [table, rows] of Object.entries(identityTables)) {
      if (plain.startsWith(`select 1 as conflict from ${table}`)) {
        const target = String(params[1] || '').trim().toLowerCase();
        const conflict = rows.find((row) => [row.owner_email, row.actor_email].some((value) => (
          String(value || '').trim().toLowerCase() === target
        )));
        return { rows: conflict ? [{ conflict: 1 }] : [], rowCount: conflict ? 1 : 0 };
      }
      if (plain.startsWith(`update ${table} set owner_email = case`)) {
        const previous = String(params[0] || '').trim().toLowerCase();
        const next = String(params[1] || '').trim().toLowerCase();
        let changed = 0;
        for (const row of rows) {
          let touched = false;
          if (String(row.owner_email || '').trim().toLowerCase() === previous) {
            row.owner_email = next;
            touched = true;
          }
          if (String(row.actor_email || '').trim().toLowerCase() === previous) {
            row.actor_email = next;
            touched = true;
          }
          if (touched) changed += 1;
        }
        return { rows: [], rowCount: changed };
      }
    }

    if (plain.startsWith('insert into journey_entities')) {
      const row = journeyRowFromParams(params);
      const existing = this.journeyEntities.get(`${row.kind}:${row.id}`);
      if (existing && plain.includes('on conflict(kind, id) do nothing')) {
        return { rows: [], rowCount: 0 };
      }
      if (existing && String(existing.owner_email).trim().toLowerCase() !== String(row.owner_email).trim().toLowerCase()) {
        return { rows: [], rowCount: 0 };
      }
      this.journeyEntities.set(`${row.kind}:${row.id}`, row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('select * from journey_entities')) {
      const kindFilter = plain.includes('kind = $');
      const ownerFilter = plain.includes('owner_email = $');
      let cursor = 0;
      const kind = kindFilter ? params[cursor++] : '';
      const ownerEmail = ownerFilter ? params[cursor++] : '';
      const limit = Number(params[cursor] || 100);
      const rows = Array.from(this.journeyEntities.values())
        .filter((row) => !kind || row.kind === kind)
        .filter((row) => !ownerEmail || row.owner_email === ownerEmail)
        .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
        .slice(0, limit)
        .map(cloneRow);
      return { rows, rowCount: rows.length };
    }

    for (const table of Object.keys(this.materialized)) {
      if (plain.startsWith(`insert into ${table}`)) {
        const row = journeyRowFromParams(params);
        const existing = this.materialized[table].get(String(row.id));
        if (existing && String(existing.owner_email).trim().toLowerCase() !== String(row.owner_email).trim().toLowerCase()) {
          return { rows: [], rowCount: 0 };
        }
        this.materialized[table].set(String(row.id), row);
        return { rows: [], rowCount: 1 };
      }

      if (plain.startsWith(`select * from ${table} where id = $1`)) {
        const row = this.materialized[table].get(String(params[0] || ''));
        const ownerMatches = !plain.includes('owner_email = $2') || (row && row.owner_email === params[1]);
        return { rows: row && ownerMatches ? [cloneRow(row)] : [], rowCount: row && ownerMatches ? 1 : 0 };
      }

      if (plain.startsWith(`select * from ${table} where owner_email = $1 order by updated_at desc`)) {
        const limit = Number(params[1] || 100);
        const rows = Array.from(this.materialized[table].values())
          .filter((row) => row.owner_email === params[0])
          .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
          .slice(0, limit)
          .map(cloneRow);
        return { rows, rowCount: rows.length };
      }

      if (plain.startsWith(`select * from ${table} order by updated_at desc`)) {
        const limit = Number(params[0] || 100);
        const rows = Array.from(this.materialized[table].values())
          .sort((a, b) => String(b.updated_at).localeCompare(String(a.updated_at)))
          .slice(0, limit)
          .map(cloneRow);
        return { rows, rowCount: rows.length };
      }
    }

    throw new Error(`Mock PostgreSQL recebeu SQL nao contratado: ${redact(normalized).slice(0, 180)}`);
  }
}

class ProposalMemoryPostgresqlPool extends MemoryPostgresqlPool {
  constructor(manifest) {
    super(manifest);
    this.proposalSnapshots = new Map();
    this.proposalShares = new Map();
  }

  async query(sql, params = []) {
    const normalized = normalizeSql(sql);
    const plain = normalized.replace(/"/g, '');

    if (plain.includes('from information_schema.tables') && plain.includes('table_name = any')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      return {
        rows: [{ table_name: 'proposal_shares' }, { table_name: 'proposal_snapshots' }],
        rowCount: 2
      };
    }

    if (plain.startsWith('select migration_name from bancus_schema_migrations')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const migration = String(params[0] || '');
      return migration === 'postgresql/002_proposal_secure_share.sql'
        ? { rows: [{ migration_name: migration }], rowCount: 1 }
        : { rows: [], rowCount: 0 };
    }

    if (plain.startsWith('insert into proposal_snapshots')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = {
        id: params[0],
        proposal_id: params[1],
        version: params[2],
        parent_snapshot_id: params[3],
        status: params[4],
        engine_version: params[5],
        data_base: params[6],
        project_json: params[7],
        result_json: params[8],
        review_json: params[9],
        provenance_json: params[10],
        content_hash: params[11],
        owner_id: params[12],
        created_at: params[13]
      };
      if (this.proposalSnapshots.has(String(row.id))) {
        const error = new Error('duplicate key proposal_snapshots');
        error.code = '23505';
        throw error;
      }
      this.proposalSnapshots.set(String(row.id), row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('select * from proposal_snapshots where id = $1')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = this.proposalSnapshots.get(String(params[0] || ''));
      return { rows: row ? [cloneRow(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('select * from proposal_snapshots where proposal_id = $1')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const ownerFilter = plain.includes('owner_id = $2');
      const rows = Array.from(this.proposalSnapshots.values())
        .filter((row) => row.proposal_id === params[0])
        .filter((row) => !ownerFilter || row.owner_id === params[1])
        .sort((a, b) => Number(a.version) - Number(b.version))
        .map(cloneRow);
      return { rows, rowCount: rows.length };
    }

    if (plain.startsWith('insert into proposal_shares')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = {
        id: params[0],
        snapshot_id: params[1],
        terminal_snapshot_id: null,
        token_hash: params[2],
        status: params[3],
        owner_id: params[4],
        created_at: params[5],
        expires_at: params[6],
        revoked_at: '',
        expired_at: ''
      };
      this.proposalShares.set(String(row.id), row);
      return { rows: [], rowCount: 1 };
    }

    if (plain.startsWith('select * from proposal_shares where id = $1')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = this.proposalShares.get(String(params[0] || ''));
      return { rows: row ? [cloneRow(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('select * from proposal_shares where token_hash = $1')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = Array.from(this.proposalShares.values()).find((item) => item.token_hash === params[0]);
      return { rows: row ? [cloneRow(row)] : [], rowCount: row ? 1 : 0 };
    }

    if (plain.startsWith('update proposal_shares set status = $1')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const row = this.proposalShares.get(String(params[4] || ''));
      if (!row || row.owner_id !== params[5] || row.status !== 'ativa') return { rows: [], rowCount: 0 };
      Object.assign(row, {
        status: params[0],
        terminal_snapshot_id: params[1],
        revoked_at: params[2],
        expired_at: params[3]
      });
      return { rows: [{ id: row.id }], rowCount: 1 };
    }

    if (plain.startsWith('select (select count(*) from proposal_snapshots)')) {
      this.queries.push({ sql: normalized, params: params.slice() });
      const active = Array.from(this.proposalShares.values()).filter((item) => item.status === 'ativa').length;
      return {
        rows: [{ snapshots: this.proposalSnapshots.size, shares: this.proposalShares.size, active_shares: active }],
        rowCount: 1
      };
    }

    return super.query(sql, params);
  }
}

class RollbackPostgresqlPool extends MemoryPostgresqlPool {
  constructor(manifest) {
    super(manifest);
    this.transactionBackup = null;
    this.failMaterializedWrite = false;
    this.failSessionRevocation = false;
  }

  snapshotState() {
    const cloneMap = (source) => new Map(Array.from(source.entries()).map(([key, value]) => [key, cloneRow(value)]));
    return {
      users: cloneMap(this.users),
      sessions: cloneMap(this.sessions),
      snapshots: cloneMap(this.snapshots),
      journeyEntities: cloneMap(this.journeyEntities),
      materialized: {
        journey_leads: cloneMap(this.materialized.journey_leads),
        journey_simulations: cloneMap(this.materialized.journey_simulations),
        journey_proposals: cloneMap(this.materialized.journey_proposals)
      }
    };
  }

  restoreState(state) {
    this.users = state.users;
    this.sessions = state.sessions;
    this.snapshots = state.snapshots;
    this.journeyEntities = state.journeyEntities;
    this.materialized = state.materialized;
  }

  async query(sql, params = []) {
    const plain = normalizeSql(sql).replace(/"/g, '');
    if (plain === 'begin') this.transactionBackup = this.snapshotState();
    if (plain === 'rollback' && this.transactionBackup) {
      this.restoreState(this.transactionBackup);
      this.transactionBackup = null;
    }
    if (plain === 'commit') this.transactionBackup = null;
    if (this.failMaterializedWrite && plain.startsWith('insert into journey_simulations')) {
      const error = new Error('Injected materialized write failure');
      error.code = 'PG_GATE_MATERIALIZED_FAILURE';
      throw error;
    }
    if (this.failSessionRevocation && plain.startsWith('update sessions set revoked_at = $1 where user_id = $2')) {
      const error = new Error('Injected session revocation failure');
      error.code = 'PG_GATE_SESSION_REVOCATION_FAILURE';
      throw error;
    }
    return super.query(sql, params);
  }
}

class ConcurrentAdminPostgresqlPool extends MemoryPostgresqlPool {
  constructor(manifest) {
    super(manifest);
    this.connectionSequence = 0;
    this.connectionBarrier = [];
    this.connectionBarrierOpen = false;
    this.adminLockOwner = '';
    this.adminLockQueue = [];
    this.adminLockContentions = 0;
    this.activeAdminCriticalSections = 0;
    this.maxActiveAdminCriticalSections = 0;
  }

  async connect() {
    const state = {
      id: `admin-race-client-${++this.connectionSequence}`,
      lockHeld: false,
      released: false
    };
    const client = {
      query: (sql, params = []) => this.queryFromClient(state, sql, params),
      release: () => {
        state.released = true;
        if (state.lockHeld) this.releaseAdminLock(state);
      }
    };

    // As duas primeiras transacoes so deixam connect juntas. Isso torna a
    // disputa pelo advisory lock observavel e deterministica no gate.
    if (!this.connectionBarrierOpen) {
      await new Promise((resolve) => {
        this.connectionBarrier.push(resolve);
        if (this.connectionBarrier.length === 2) {
          this.connectionBarrierOpen = true;
          const waiting = this.connectionBarrier.splice(0);
          waiting.forEach((release) => release());
        }
      });
    }
    return client;
  }

  async acquireAdminLock(state) {
    if (state.lockHeld) return;
    if (!this.adminLockOwner) {
      this.adminLockOwner = state.id;
      state.lockHeld = true;
      this.activeAdminCriticalSections += 1;
      this.maxActiveAdminCriticalSections = Math.max(
        this.maxActiveAdminCriticalSections,
        this.activeAdminCriticalSections
      );
      return;
    }
    this.adminLockContentions += 1;
    await new Promise((resolve) => this.adminLockQueue.push({ state, resolve }));
  }

  releaseAdminLock(state) {
    if (!state.lockHeld || this.adminLockOwner !== state.id) return;
    state.lockHeld = false;
    this.adminLockOwner = '';
    this.activeAdminCriticalSections -= 1;
    const next = this.adminLockQueue.shift();
    if (!next) return;
    this.adminLockOwner = next.state.id;
    next.state.lockHeld = true;
    this.activeAdminCriticalSections += 1;
    this.maxActiveAdminCriticalSections = Math.max(
      this.maxActiveAdminCriticalSections,
      this.activeAdminCriticalSections
    );
    next.resolve();
  }

  async queryFromClient(state, sql, params = []) {
    const plain = normalizeSql(sql).replace(/"/g, '');
    if (plain.startsWith('select pg_advisory_xact_lock($1, $2)')) {
      await this.acquireAdminLock(state);
      return super.query(sql, params);
    }
    if (plain === 'commit' || plain === 'rollback') {
      try {
        return await super.query(sql, params);
      } finally {
        if (state.lockHeld) this.releaseAdminLock(state);
      }
    }
    return super.query(sql, params);
  }
}

function collectSensitiveKeys(value, pathParts = [], findings = []) {
  if (!value || typeof value !== 'object') return findings;
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectSensitiveKeys(item, pathParts.concat(String(index)), findings));
    return findings;
  }
  const forbidden = /^(password|password_hash|password_salt|senha|token|token_hash|secret|cpf|phone|telefone)$/i;
  for (const [key, child] of Object.entries(value)) {
    const nextPath = pathParts.concat(key);
    if (forbidden.test(key)) findings.push(nextPath.join('.'));
    collectSensitiveKeys(child, nextPath, findings);
  }
  return findings;
}

function makeOversizedSafePayload() {
  return Object.fromEntries(Array.from({ length: 110 }, (_, index) => (
    [`safeField${String(index).padStart(3, '0')}`, `${String(index).padStart(3, '0')}-${'x'.repeat(790)}`]
  )));
}

function makeSafePayloadLargerThan(minimumChars) {
  const payload = {};
  const value = 'x'.repeat(780);
  let index = 0;
  const initialCount = Math.ceil((Number(minimumChars) + 2048) / 800);
  while (index < initialCount) {
    payload[`safeField${String(index).padStart(6, '0')}`] = `${String(index).padStart(6, '0')}-${value}`;
    index += 1;
  }
  let serializedLength = JSON.stringify(payload).length;
  while (serializedLength <= minimumChars) {
    for (let offset = 0; offset < 25; offset += 1) {
      payload[`safeField${String(index).padStart(6, '0')}`] = `${String(index).padStart(6, '0')}-${value}`;
      index += 1;
    }
    serializedLength = JSON.stringify(payload).length;
  }
  return payload;
}

async function expectPayloadTooLarge(operation, label) {
  let failure = null;
  try {
    await Promise.resolve(operation());
  } catch (error) {
    failure = error;
  }
  assert(failure, `${label} deveria rejeitar o payload acima do limite.`);
  assert(failure.code === 'BANCUS_PAYLOAD_TOO_LARGE', `${label} nao retornou BANCUS_PAYLOAD_TOO_LARGE.`);
  assert(Number(failure.status) === 413, `${label} nao retornou status 413.`);
  return { code: failure.code, status: Number(failure.status) };
}

function evaluateBackendApi() {
  const source = fs.readFileSync(BACKEND_API_PATH, 'utf8');
  const captured = [];
  const storageData = new Map();
  const localStorage = {
    getItem: (key) => storageData.has(key) ? storageData.get(key) : null,
    setItem: (key, value) => storageData.set(key, String(value)),
    removeItem: (key) => storageData.delete(key)
  };
  const window = {
    localStorage,
    AbortController: null,
    setTimeout,
    clearTimeout
  };
  const sandbox = {
    window,
    location: { protocol: 'http:' },
    document: { body: { dataset: { bfPage: 'provider-gate' } } },
    URLSearchParams,
    setTimeout,
    clearTimeout,
    fetch: async (requestPath, options = {}) => {
      captured.push({
        method: options.method || 'GET',
        path: String(requestPath),
        body: options.body === undefined ? undefined : JSON.parse(options.body)
      });
      return {
        ok: true,
        status: 200,
        text: async () => '{"ok":true}'
      };
    }
  };
  vm.runInNewContext(source, sandbox, { filename: BACKEND_API_PATH });
  return { api: window.BFBackendApi, captured };
}

const EXPECTED_BACKEND_API_KEYS = [
  'SESSION_KEY',
  'PUBLIC_SESSION_KEY',
  'AUTH_CONFIG_KEY',
  'available',
  'readAuthConfig',
  'authConfig',
  'readSession',
  'clearSession',
  'request',
  'health',
  'authLogin',
  'authLogout',
  'authChangePassword',
  'authLogoutAll',
  'currentUser',
  'databaseStatus',
  'importLocalSnapshot',
  'listUsers',
  'createUser',
  'updateUser',
  'deleteUser',
  'resetPassword',
  'toggleStatus',
  'recordEvent',
  'recordSnapshot',
  'listEvents',
  'listSnapshots',
  'listJourneyEntities',
  'listLeads',
  'listSimulations',
  'listProposals',
  'saveLead',
  'getLead',
  'updateLead',
  'saveSimulation',
  'getSimulation',
  'updateSimulation',
  'saveProposal',
  'getProposal',
  'updateProposal',
  'createProposalSnapshot',
  'getProposalSnapshot',
  'transitionProposalSnapshot',
  'publishProposalSnapshot',
  'revokeProposalShare',
  'requestPublicProposalInterest',
  'getProposalInterest',
  'requestProposalInterest',
  'getPublicProposal'
].sort();

const EXPECTED_API_CALLS = [
  ['GET', '/api/health'],
  ['GET', '/api/auth/config'],
  ['GET', '/api/auth/config'],
  ['POST', '/api/auth/login'],
  ['POST', '/api/auth/logout'],
  ['POST', '/api/auth/change-password'],
  ['POST', '/api/auth/logout-all'],
  ['GET', '/api/auth/me'],
  ['GET', '/api/database/status'],
  ['POST', '/api/database/import-local'],
  ['GET', '/api/users'],
  ['POST', '/api/users'],
  ['PATCH', '/api/users/user-1'],
  ['DELETE', '/api/users/user-1'],
  ['POST', '/api/users/user-1/password'],
  ['POST', '/api/users/user-1/status'],
  ['POST', '/api/events'],
  ['POST', '/api/snapshots'],
  ['GET', '/api/events?limit=7'],
  ['GET', '/api/snapshots?limit=7&type=simulation'],
  ['GET', '/api/journey-entities?limit=7&kind=lead'],
  ['GET', '/api/leads?limit=7'],
  ['GET', '/api/simulations?limit=7'],
  ['GET', '/api/proposals?limit=7'],
  ['POST', '/api/leads'],
  ['GET', '/api/leads/lead-1'],
  ['PATCH', '/api/leads/lead-1'],
  ['POST', '/api/simulations'],
  ['GET', '/api/simulations/simulation-1'],
  ['PATCH', '/api/simulations/simulation-1'],
  ['POST', '/api/proposals'],
  ['GET', '/api/proposals/proposal-1'],
  ['PATCH', '/api/proposals/proposal-1'],
  ['POST', '/api/proposal-snapshots'],
  ['GET', '/api/proposal-snapshots/snapshot-1'],
  ['POST', '/api/proposal-snapshots/snapshot-1/transitions'],
  ['POST', '/api/proposal-snapshots/snapshot-1/publish'],
  ['POST', '/api/proposal-shares/share-1/revoke'],
  ['POST', '/api/public/proposals/interest'],
  ['POST', '/api/proposal-interests/resolve'],
  ['POST', '/api/proposal-interests'],
  ['POST', '/api/public/proposals/resolve']
];

async function exerciseBackendApi(api) {
  await api.health();
  await api.authConfig();
  await api.authLogin('provider-gate@example.com', 'not-a-real-password');
  await api.authLogout();
  await api.authChangePassword('temporary-password', 'NewSecure!Password2026');
  await api.authLogoutAll();
  await api.currentUser();
  await api.databaseStatus();
  await api.importLocalSnapshot({ source: 'provider-gate' });
  await api.listUsers();
  await api.createUser({ name: 'Gate' });
  await api.updateUser('user-1', { name: 'Gate 2' });
  await api.deleteUser('user-1');
  await api.resetPassword('user-1', 'not-a-real-password');
  await api.toggleStatus('user-1', 'inactive');
  await api.recordEvent('provider-gate', { safe: true });
  await api.recordSnapshot('simulation', { safe: true });
  await api.listEvents(7);
  await api.listSnapshots(7, 'simulation');
  await api.listJourneyEntities(7, 'lead');
  await api.listLeads(7);
  await api.listSimulations(7);
  await api.listProposals(7);
  await api.saveLead({ id: 'lead-1' });
  await api.getLead('lead-1');
  await api.updateLead('lead-1', { status: 'qualified' });
  await api.saveSimulation({ id: 'simulation-1' });
  await api.getSimulation('simulation-1');
  await api.updateSimulation('simulation-1', { status: 'saved' });
  await api.saveProposal({ id: 'proposal-1' });
  await api.getProposal('proposal-1');
  await api.updateProposal('proposal-1', { status: 'draft' });
  await api.createProposalSnapshot({ id: 'snapshot-1' });
  await api.getProposalSnapshot('snapshot-1');
  await api.transitionProposalSnapshot('snapshot-1', 'reviewed');
  await api.publishProposalSnapshot('snapshot-1', 30);
  await api.revokeProposalShare('share-1');
  await api.requestPublicProposalInterest('public-token');
  await api.getProposalInterest({ proposalId: 'PROP-GATE', proposalVersionId: 'PV-GATE-1' });
  await api.requestProposalInterest({ proposalId: 'PROP-GATE', proposalVersionId: 'PV-GATE-1' });
  await api.getPublicProposal('public-token');
}

async function runHttpOwnerIsolationScenario() {
  const databasePath = path.join(temporaryDirectory, 'http-owner-scope.sqlite');
  const shareDatabasePath = path.join(temporaryDirectory, 'http-owner-share.sqlite');
  return withEnvironment({
    BANCUS_DB_PROVIDER: 'sqlite',
    BANCUS_DATABASE_URL: undefined,
    BANCUS_DB_PATH: databasePath,
    BANCUS_SHARE_DB_PATH: shareDatabasePath
  }, async () => {
    const serverModuleId = require.resolve(SERVER_PATH);
    delete require.cache[serverModuleId];
    const serverModule = require(SERVER_PATH);
    const httpServer = serverModule.startServer({ port: 0 });

    try {
      if (!httpServer.listening) {
        await new Promise((resolve, reject) => {
          httpServer.once('listening', resolve);
          httpServer.once('error', reject);
        });
      }
      const address = httpServer.address();
      assert(address && typeof address === 'object' && address.port, 'Servidor HTTP de teste nao abriu porta local.');
      const baseUrl = `http://127.0.0.1:${address.port}`;

      async function requestJson(route, options = {}) {
        const headers = { Accept: 'application/json' };
        if (options.token) headers.Authorization = `Bearer ${options.token}`;
        if (options.body !== undefined) headers['Content-Type'] = 'application/json';
        const response = await fetch(`${baseUrl}${route}`, {
          method: options.method || 'GET',
          headers,
          body: options.body === undefined ? undefined : JSON.stringify(options.body)
        });
        const text = await response.text();
        let data = {};
        try {
          data = text ? JSON.parse(text) : {};
        } catch (error) {
          throw new Error(`Resposta HTTP nao JSON em ${route}.`);
        }
        return { status: response.status, data };
      }

      const health = await requestJson('/api/health');
      assert(health.status === 200 && health.data.ok && health.data.provider === 'sqlite', 'Servidor HTTP nao iniciou com SQLite isolado.');
      assert(
        health.data.proposalShare
        && health.data.proposalShare.enabled === true
        && health.data.proposalShare.provider === health.data.provider,
        'Health HTTP diverge entre provider principal e provider de proposta.'
      );

      const loginA = await requestJson('/api/auth/login', {
        method: 'POST',
        body: { email: 'consultor@bankfratern.local', password: 'Consultor@123' }
      });
      const loginB = await requestJson('/api/auth/login', {
        method: 'POST',
        body: { email: 'cliente@bankfratern.local', password: 'Cliente@123' }
      });
      assert(loginA.status === 200 && loginA.data.session && loginA.data.session.token, 'Usuario HTTP A nao autenticou.');
      assert(loginB.status === 200 && loginB.data.session && loginB.data.session.token, 'Usuario HTTP B nao autenticou.');
      const tokenA = loginA.data.session.token;
      const tokenB = loginB.data.session.token;

      const unauthenticatedEvent = await requestJson('/api/events', {
        method: 'POST',
        body: { type: 'forged-event', ownerEmail: 'forged@example.com', actorEmail: 'forged@example.com' }
      });
      assert(unauthenticatedEvent.status === 401, 'POST /api/events aceitou requisicao sem autenticacao.');
      const authenticatedEvent = await requestJson('/api/events', {
        method: 'POST',
        token: tokenA,
        body: {
          type: 'http-authenticity-gate',
          ownerEmail: 'forged-owner@example.com',
          actorEmail: 'forged-actor@example.com',
          sessionId: 'forged-session-id',
          payload: { safe: true }
        }
      });
      assert(authenticatedEvent.status === 201 && authenticatedEvent.data.event, 'POST /api/events autenticado falhou.');
      assert(authenticatedEvent.data.event.ownerEmail === 'consultor@bankfratern.local', 'POST /api/events aceitou ownerEmail forjado.');
      assert(authenticatedEvent.data.event.actorEmail === 'consultor@bankfratern.local', 'POST /api/events aceitou actorEmail forjado.');
      assert(authenticatedEvent.data.event.sessionId === loginA.data.session.id, 'POST /api/events aceitou sessionId forjado.');

      const leadId = 'LEAD-HTTP-OWNER-GATE';
      const leadA = await requestJson('/api/leads', {
        method: 'POST',
        token: tokenA,
        body: {
          id: leadId,
          title: 'Lead original do usuario A',
          status: 'novo',
          payload: { safeLabel: 'owner-a-original' }
        }
      });
      assert([200, 201].includes(leadA.status) && leadA.data.ok, 'Usuario A nao criou lead HTTP.');

      const takeoverLead = await requestJson('/api/leads', {
        method: 'POST',
        token: tokenB,
        body: {
          id: leadId,
          title: 'Tentativa de takeover por B',
          status: 'qualificado',
          payload: { safeLabel: 'owner-b-takeover' }
        }
      });
      assert(takeoverLead.status !== 500, 'Takeover de lead gerou HTTP 500.');
      assert([403, 404, 409].includes(takeoverLead.status), `Takeover de lead deveria retornar 403/404/409, recebeu ${takeoverLead.status}.`);
      assert(takeoverLead.data.ok === false, 'Takeover de lead nao retornou falha semantica.');

      const leadAfter = await requestJson(`/api/leads/${encodeURIComponent(leadId)}`, { token: tokenA });
      const leadInvisibleToB = await requestJson(`/api/leads/${encodeURIComponent(leadId)}`, { token: tokenB });
      assert(leadAfter.status === 200 && leadAfter.data.lead, 'Lead original deixou de existir para A.');
      assert(leadAfter.data.lead.ownerEmail === 'consultor@bankfratern.local', 'Takeover alterou o owner do lead.');
      assert(leadAfter.data.lead.title === 'Lead original do usuario A', 'Takeover alterou o titulo do lead.');
      assert(leadAfter.data.lead.payload && leadAfter.data.lead.payload.safeLabel === 'owner-a-original', 'Takeover alterou o payload do lead.');
      assert(leadInvisibleToB.status === 404, 'Usuario B conseguiu ler o lead de A por id.');

      const snapshotId = 'SNAPSHOT-HTTP-OWNER-GATE';
      const snapshotA = await requestJson('/api/snapshots', {
        method: 'POST',
        token: tokenA,
        body: {
          id: snapshotId,
          type: 'owner-scope-gate',
          title: 'Snapshot original do usuario A',
          status: 'saved',
          payload: { safeLabel: 'snapshot-owner-a' }
        }
      });
      assert([200, 201].includes(snapshotA.status) && snapshotA.data.ok, 'Usuario A nao criou snapshot HTTP.');

      const takeoverSnapshot = await requestJson('/api/snapshots', {
        method: 'POST',
        token: tokenB,
        body: {
          id: snapshotId,
          type: 'owner-scope-gate',
          title: 'Tentativa de takeover de snapshot por B',
          status: 'changed',
          payload: { safeLabel: 'snapshot-owner-b-takeover' }
        }
      });
      assert(takeoverSnapshot.status !== 500, 'Takeover de snapshot gerou HTTP 500.');
      assert([404, 409].includes(takeoverSnapshot.status), `Takeover de snapshot deveria retornar 404/409, recebeu ${takeoverSnapshot.status}.`);
      assert(takeoverSnapshot.data.ok === false, 'Takeover de snapshot nao retornou falha semantica.');

      const snapshotsA = await requestJson('/api/snapshots?limit=50&type=owner-scope-gate', { token: tokenA });
      const snapshotsB = await requestJson('/api/snapshots?limit=50&type=owner-scope-gate', { token: tokenB });
      const persistedA = Array.isArray(snapshotsA.data.snapshots)
        ? snapshotsA.data.snapshots.find((item) => item.id === snapshotId)
        : null;
      const leakedToB = Array.isArray(snapshotsB.data.snapshots)
        ? snapshotsB.data.snapshots.find((item) => item.id === snapshotId)
        : null;
      assert(persistedA && persistedA.ownerEmail === 'consultor@bankfratern.local', 'Snapshot original nao permaneceu com A.');
      assert(persistedA.title === 'Snapshot original do usuario A', 'Takeover alterou o titulo do snapshot.');
      assert(persistedA.payload && persistedA.payload.safeLabel === 'snapshot-owner-a', 'Takeover alterou o payload do snapshot.');
      assert(!leakedToB, 'Snapshot de A apareceu na listagem do usuario B.');

      const loginAdmin = await requestJson('/api/auth/login', {
        method: 'POST',
        body: { email: 'admin@bankfratern.local', password: 'Admin@123' }
      });
      assert(loginAdmin.status === 200 && loginAdmin.data.session && loginAdmin.data.session.token, 'Admin HTTP nao autenticou para reset de senha.');
      const passwordReset = await requestJson('/api/users/USR-SEED-3/password', {
        method: 'POST',
        token: loginAdmin.data.session.token,
        body: { password: 'ClienteGate@456' }
      });
      assert(passwordReset.status === 200 && passwordReset.data.ok, 'Reset de senha HTTP falhou.');
      const oldTokenAfterReset = await requestJson('/api/auth/me', { token: tokenB });
      assert(oldTokenAfterReset.status === 401, 'Token anterior continuou valido apos reset HTTP.');
      const reloginB = await requestJson('/api/auth/login', {
        method: 'POST',
        body: { email: 'cliente@bankfratern.local', password: 'ClienteGate@456' }
      });
      assert(reloginB.status === 200 && reloginB.data.session && reloginB.data.session.token, 'Nova senha nao autenticou apos reset HTTP.');

      return {
        transport: 'real-local-http',
        provider: 'sqlite',
        proposalShareProvider: health.data.proposalShare.provider,
        providerCoherent: true,
        leadTakeoverStatus: takeoverLead.status,
        snapshotTakeoverStatus: takeoverSnapshot.status,
        ownerPreserved: true,
        payloadPreserved: true,
        crossOwnerReads: 0,
        eventsRequireAuthentication: true,
        forgedEventIdentityIgnored: true,
        oldTokenValidAfterPasswordReset: false
      };
    } finally {
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await Promise.resolve(serverModule.closeInfrastructure());
      delete require.cache[serverModuleId];
    }
  });
}

async function runHttpStaticBoundaryScenario() {
  const databasePath = path.join(temporaryDirectory, 'http-static-boundary.sqlite');
  const shareDatabasePath = path.join(temporaryDirectory, 'http-static-boundary-share.sqlite');
  return withEnvironment({
    BANCUS_DB_PROVIDER: 'sqlite',
    BANCUS_DATABASE_URL: undefined,
    BANCUS_DB_PATH: databasePath,
    BANCUS_SHARE_DB_PATH: shareDatabasePath
  }, async () => {
    const serverModuleId = require.resolve(SERVER_PATH);
    delete require.cache[serverModuleId];
    const serverModule = require(SERVER_PATH);
    const httpServer = serverModule.startServer({ port: 0 });

    try {
      if (!httpServer.listening) {
        await new Promise((resolve, reject) => {
          httpServer.once('listening', resolve);
          httpServer.once('error', reject);
        });
      }
      const address = httpServer.address();
      assert(address && typeof address === 'object' && address.port, 'Servidor HTTP do boundary estatico nao abriu porta local.');
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const requestText = async (route) => {
        const response = await fetch(`${baseUrl}${route}`, {
          headers: { Accept: '*/*' },
          redirect: 'manual'
        });
        return {
          status: response.status,
          contentType: String(response.headers.get('content-type') || ''),
          body: await response.text()
        };
      };

      const deniedPaths = [
        '/.runtime/bancus-fraternis.sqlite',
        '/.git/config',
        '/.env',
        '/server.js',
        '/js/backend/db.js',
        '/package.json'
      ];
      const windowsVariantPaths = [
        '/js/backend%2e/db.js',
        '/js/backend./db.js',
        '/js/backend%20/db.js',
        '/js/backend~1/db.js',
        '/js/backend/db.js%3a%3a$DATA',
        '/js/con.js'
      ];
      const deniedStatuses = {};
      for (const route of deniedPaths) {
        const response = await requestText(route);
        deniedStatuses[route] = response.status;
        assert([403, 404].includes(response.status), `${route} deveria ser negado com 403/404, recebeu ${response.status}.`);
        assert(!/BANCUS_DATABASE_URL|createDatabase|"scripts"\s*:|\[core\]/i.test(response.body), `${route} revelou conteudo interno apesar da negacao.`);
      }
      for (const route of windowsVariantPaths) {
        const response = await requestText(route);
        deniedStatuses[route] = response.status;
        assert(response.status === 403, `${route} deveria ser negado com 403, recebeu ${response.status}.`);
        assert(!/BANCUS_DATABASE_URL|createDatabase|"scripts"\s*:|\[core\]/i.test(response.body), `${route} revelou conteudo interno apesar da negacao.`);
      }

      const allowedStatuses = {};
      for (const route of ['/js/app.js', '/js/proposal-public.js']) {
        const publicAsset = await requestText(route);
        allowedStatuses[route] = publicAsset.status;
        assert(publicAsset.status === 200, `${route} deveria permanecer publico, recebeu ${publicAsset.status}.`);
        assert(/javascript/i.test(publicAsset.contentType), `${route} perdeu o Content-Type JavaScript.`);
        assert(publicAsset.body.trim().length > 0, `${route} respondeu sem conteudo.`);
      }

      return {
        transport: 'real-local-http',
        denied: deniedStatuses,
        windowsVariantsDeniedWith403: windowsVariantPaths,
        allowed: allowedStatuses,
        internalContentLeaks: 0
      };
    } finally {
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await Promise.resolve(serverModule.closeInfrastructure());
      delete require.cache[serverModuleId];
    }
  });
}

async function runHttpUtf8PayloadBoundaryScenario() {
  const databasePath = path.join(temporaryDirectory, 'http-utf8-payload-boundary.sqlite');
  const shareDatabasePath = path.join(temporaryDirectory, 'http-utf8-payload-boundary-share.sqlite');
  return withEnvironment({
    BANCUS_DB_PROVIDER: 'sqlite',
    BANCUS_DATABASE_URL: undefined,
    BANCUS_DB_PATH: databasePath,
    BANCUS_SHARE_DB_PATH: shareDatabasePath
  }, async () => {
    const serverModuleId = require.resolve(SERVER_PATH);
    delete require.cache[serverModuleId];
    const serverModule = require(SERVER_PATH);
    const httpServer = serverModule.startServer({ port: 0 });

    try {
      if (!httpServer.listening) {
        await new Promise((resolve, reject) => {
          httpServer.once('listening', resolve);
          httpServer.once('error', reject);
        });
      }
      const address = httpServer.address();
      assert(address && typeof address === 'object' && address.port, 'Servidor HTTP do limite UTF-8 nao abriu porta local.');
      const baseUrl = `http://127.0.0.1:${address.port}`;
      const loginResponse = await fetch(`${baseUrl}/api/auth/login`, {
        method: 'POST',
        headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: 'consultor@bankfratern.local', password: 'Consultor@123' })
      });
      const login = await loginResponse.json();
      assert(loginResponse.status === 200 && login.session && login.session.token, 'Usuario HTTP nao autenticou para o teste de limite UTF-8.');

      const snapshotId = 'SNAPSHOT-HTTP-UTF8-OVER-LIMIT';
      const multibyteText = 'á'.repeat(2_100_000);
      const requestBody = JSON.stringify({
        id: snapshotId,
        type: 'utf8-http-over-limit',
        title: 'Snapshot UTF-8 acima do limite HTTP',
        payload: { multibyteText }
      });
      const requestBytes = Buffer.byteLength(requestBody, 'utf8');
      assert(multibyteText.length === 2_100_000, 'Fixture UTF-8 nao possui aproximadamente 2,1 milhoes de caracteres.');
      assert(requestBytes > 4 * 1024 * 1024, 'Fixture UTF-8 nao ultrapassou 4 MiB em bytes reais.');

      const oversizedResponse = await fetch(`${baseUrl}/api/snapshots`, {
        method: 'POST',
        headers: {
          Accept: 'application/json',
          Authorization: `Bearer ${login.session.token}`,
          'Content-Type': 'application/json; charset=utf-8'
        },
        body: requestBody
      });
      const oversizedText = await oversizedResponse.text();
      let oversizedJson = null;
      try {
        oversizedJson = JSON.parse(oversizedText);
      } catch (error) {
        throw new Error('Resposta 413 do limite UTF-8 nao e JSON parseavel.');
      }
      assert(oversizedResponse.status === 413, `Payload UTF-8 acima de 4 MiB deveria retornar 413, recebeu ${oversizedResponse.status}.`);
      assert(/application\/json/i.test(String(oversizedResponse.headers.get('content-type') || '')), 'Resposta 413 do limite UTF-8 nao usa Content-Type JSON.');
      assert(oversizedJson && oversizedJson.ok === false, 'Resposta 413 do limite UTF-8 nao retornou falha semantica.');
      assert(oversizedJson.code === 'BANCUS_HTTP_PAYLOAD_TOO_LARGE', 'Resposta 413 nao retornou BANCUS_HTTP_PAYLOAD_TOO_LARGE.');

      const listResponse = await fetch(`${baseUrl}/api/snapshots?limit=50&type=utf8-http-over-limit`, {
        headers: { Accept: 'application/json', Authorization: `Bearer ${login.session.token}` }
      });
      const list = await listResponse.json();
      assert(listResponse.status === 200 && Array.isArray(list.snapshots), 'Servidor nao permaneceu utilizavel apos rejeitar o corpo UTF-8.');
      assert(!list.snapshots.some((item) => item.id === snapshotId), 'Payload HTTP rejeitado deixou snapshot gravado.');

      return {
        transport: 'real-local-http',
        utf8Characters: multibyteText.length,
        requestBytes,
        configuredLimitBytes: 4 * 1024 * 1024,
        status: oversizedResponse.status,
        code: oversizedJson.code,
        jsonParseable: true,
        serverUsableAfterRejection: true,
        persistedSnapshots: 0
      };
    } finally {
      if (httpServer.listening) {
        await new Promise((resolve) => httpServer.close(resolve));
      }
      await Promise.resolve(serverModule.closeInfrastructure());
      delete require.cache[serverModuleId];
    }
  });
}

async function runAuditBestEffortScenario() {
  const databasePath = path.join(temporaryDirectory, 'audit-best-effort.sqlite');
  const shareDatabasePath = path.join(temporaryDirectory, 'audit-best-effort-share.sqlite');
  return withEnvironment({
    BANCUS_DB_PROVIDER: 'sqlite',
    BANCUS_DATABASE_URL: undefined,
    BANCUS_DB_PATH: databasePath,
    BANCUS_SHARE_DB_PATH: shareDatabasePath
  }, async () => {
    const serverModuleId = require.resolve(SERVER_PATH);
    delete require.cache[serverModuleId];
    const serverModule = require(SERVER_PATH);
    const warnings = [];
    const originalWarn = console.warn;
    console.warn = (...args) => warnings.push(args.map(String).join(' '));
    try {
      const result = await serverModule.recordApiEvent(
        'audit-best-effort-gate',
        { ownerEmail: 'audit@example.com', entityType: 'proposal', entityId: 'PROP-AUDIT-GATE' },
        { user: { email: 'audit@example.com' }, session: { id: 'SESSION-AUDIT-GATE' } },
        {
          recordEvent: async () => {
            throw new Error(`Injected audit failure ${SECRET_SENTINEL}`);
          }
        }
      );
      assert(result === null, 'recordApiEvent nao retornou null ao falhar a persistencia de auditoria.');
      assert(warnings.length === 1, 'recordApiEvent nao registrou um unico aviso seguro da falha de auditoria.');
      assert(!warnings.join('\n').includes(SECRET_SENTINEL), 'recordApiEvent vazou detalhes da falha de auditoria no console.');
      return {
        injectedDatabase: true,
        result: null,
        propagated: false,
        safeWarning: true
      };
    } finally {
      console.warn = originalWarn;
      await Promise.resolve(serverModule.closeInfrastructure());
      delete require.cache[serverModuleId];
    }
  });
}

const REQUIRED_DATABASE_METHODS = [
  'authenticateToken',
  'close',
  'createUser',
  'databaseStatus',
  'deleteUser',
  'findMaterializedJourneyRow',
  'findPublicUser',
  'importLocalSnapshot',
  'journeyEntitySummary',
  'listEvents',
  'listJourneyEntities',
  'listLeads',
  'listProposals',
  'listSimulations',
  'listSnapshots',
  'listUsers',
  'login',
  'recordEvent',
  'revokeToken',
  'setPassword',
  'setUserStatus',
  'stats',
  'updateUser',
  'upsertDirectJourneyRow',
  'upsertSnapshot'
].sort();

function serverApiSurfaceEvidence() {
  const source = fs.readFileSync(SERVER_PATH, 'utf8');
  const groups = [
    { name: '/api/health', start: "if (pathname === '/api/health'", end: "if (pathname === '/api/public/proposals/interest')", methods: ['GET'] },
    { name: '/api/public/proposals/interest', start: "if (pathname === '/api/public/proposals/interest')", end: "if (pathname === '/api/public/proposals/resolve')", methods: ['POST'] },
    { name: '/api/public/proposals/resolve', start: "if (pathname === '/api/public/proposals/resolve')", end: 'const database = await getDatabase()', methods: ['POST'] },
    { name: '/api/proposal-interests[/resolve]', start: "if (pathname === '/api/proposal-interests/resolve'", end: "if (pathname === '/api/proposal-snapshots')", methods: ['POST'] },
    { name: '/api/proposal-snapshots', start: "if (pathname === '/api/proposal-snapshots')", end: 'const proposalSnapshotMatch', methods: ['POST'] },
    { name: '/api/proposal-snapshots/:id', start: 'const proposalSnapshotMatch', end: 'const proposalTransitionMatch', methods: ['GET'] },
    { name: '/api/proposal-snapshots/:id/transitions', start: 'const proposalTransitionMatch', end: 'const proposalPublishMatch', methods: ['POST'] },
    { name: '/api/proposal-snapshots/:id/publish', start: 'const proposalPublishMatch', end: 'const proposalShareRevokeMatch', methods: ['POST'] },
    { name: '/api/proposal-shares/:id/revoke', start: 'const proposalShareRevokeMatch', end: "if (pathname === '/api/auth/login')", methods: ['POST'] },
    { name: '/api/auth/login', start: "if (pathname === '/api/auth/login')", end: "if (pathname === '/api/auth/logout')", methods: ['POST'] },
    { name: '/api/auth/logout', start: "if (pathname === '/api/auth/logout')", end: "if (pathname === '/api/auth/me')", methods: ['POST'] },
    { name: '/api/auth/me', start: "if (pathname === '/api/auth/me')", end: "if (pathname === '/api/database/status')", methods: ['GET'] },
    { name: '/api/database/status', start: "if (pathname === '/api/database/status')", end: "if (pathname === '/api/database/import-local')", methods: ['GET'] },
    { name: '/api/database/import-local', start: "if (pathname === '/api/database/import-local')", end: "if (pathname === '/api/snapshots')", methods: ['POST'] },
    { name: '/api/snapshots', start: "if (pathname === '/api/snapshots')", end: "if (pathname === '/api/journey-entities')", methods: ['GET', 'POST'] },
    { name: '/api/journey-entities', start: "if (pathname === '/api/journey-entities')", end: 'const materializedRoutes', methods: ['GET'] },
    { name: '/api/{leads,simulations,proposals}', start: 'const materializedRoutes', end: 'const materializedItemMatch', methods: ['GET', 'POST'] },
    { name: '/api/{leads,simulations,proposals}/:id', start: 'const materializedItemMatch', end: "if (pathname === '/api/users')", methods: ['GET', 'PATCH'] },
    { name: '/api/users', start: "if (pathname === '/api/users')", end: 'const userMatch', methods: ['GET', 'POST'] },
    { name: '/api/users/:id[/action]', start: 'const userMatch', end: "if (pathname === '/api/events')", methods: ['PATCH', 'DELETE', 'POST'] },
    { name: '/api/events', start: "if (pathname === '/api/events')", end: 'notFoundJson(res)', methods: ['GET', 'POST'] }
  ];

  for (const group of groups) {
    const startIndex = source.indexOf(group.start);
    const endIndex = source.indexOf(group.end, startIndex + group.start.length);
    assert(startIndex >= 0, `server.js perdeu o contrato ${group.name}.`);
    assert(endIndex > startIndex, `Nao foi possivel delimitar o contrato ${group.name}.`);
    const block = source.slice(startIndex, endIndex);
    for (const method of group.methods) {
      assert(
        block.includes(`req.method === '${method}'`) || block.includes(`req.method !== '${method}'`),
        `server.js perdeu ${method} em ${group.name}.`
      );
    }
  }

  for (const route of ['/api/leads', '/api/simulations', '/api/proposals']) {
    assert(source.includes(`'${route}'`), `server.js perdeu ${route}.`);
  }

  return {
    routeGroups: groups.map((group) => ({ route: group.name, methods: group.methods })),
    semanticSignatures: groups.reduce((total, group) => total + group.methods.length, 0)
  };
}

function providerCredentialFindings() {
  const files = [
    POSTGRES_PROVIDER_PATH,
    SQLITE_PROVIDER_PATH,
    POSTGRES_PROPOSAL_REPOSITORY_PATH,
    POSTGRES_MIGRATION_PATH,
    POSTGRES_PROPOSAL_MIGRATION_PATH,
    SERVER_PATH,
    DB_MODULE_PATH,
    PACKAGE_PATH,
    path.join(ROOT_DIR, '.env.example')
  ]
    .filter((filePath) => fs.existsSync(filePath));
  const findings = [];
  const literalDsn = /postgres(?:ql)?:\/\/[^\s'"`:@]+:[^\s'"`@]+@/gi;
  const literalConnection = /\b(?:databaseUrl|connectionString)\s*[:=]\s*['"`]([^'"`$]{8,})['"`]/gi;
  const loggingSecret = /console\.(?:log|warn|error)\([^\n]*(?:databaseUrl|connectionString|BANCUS_DATABASE_URL)/gi;

  for (const filePath of files) {
    const source = fs.readFileSync(filePath, 'utf8');
    const patterns = [literalDsn, literalConnection, loggingSecret];
    for (const pattern of patterns) {
      pattern.lastIndex = 0;
      let match;
      while ((match = pattern.exec(source))) {
        const line = source.slice(0, match.index).split(/\r?\n/).length;
        findings.push({
          file: path.relative(ROOT_DIR, filePath).replace(/\\/g, '/'),
          line,
          kind: pattern === literalDsn ? 'literal-postgresql-dsn' : pattern === literalConnection ? 'literal-connection-value' : 'secret-logging'
        });
      }
    }
  }
  return { files: files.map((filePath) => path.relative(ROOT_DIR, filePath).replace(/\\/g, '/')), findings };
}

async function run() {
  temporaryDirectory = fs.mkdtempSync(path.join(os.tmpdir(), 'bancus-provider-gate-'));
  const manifest = readJson(SCHEMA_MANIFEST_PATH);
  const dbModule = require(DB_MODULE_PATH);
  const postgresqlProvider = require(POSTGRES_PROVIDER_PATH);
  const sqliteProvider = require(SQLITE_PROVIDER_PATH);

  await check('provider.contract', 'Contrato configuravel de providers', () => {
    assert(dbModule.DEFAULT_DB_PROVIDER === 'sqlite', 'O provider padrao deixou de ser sqlite.');
    assert(dbModule.SUPPORTED_DB_PROVIDERS.includes('sqlite'), 'SQLite nao esta mais entre providers suportados.');
    assert(dbModule.SUPPORTED_DB_PROVIDERS.includes('postgresql'), 'PostgreSQL nao foi registrado como provider suportado.');
    assert(dbModule.normalizeDbProvider('pg') === 'postgresql', 'Alias pg nao normaliza para postgresql.');
    assert(dbModule.normalizeDbProvider('postgres') === 'postgresql', 'Alias postgres nao normaliza para postgresql.');
    assert(dbModule.isSupportedDbProvider('postgresql'), 'postgresql nao e reconhecido como suportado.');
    assert(typeof sqliteProvider.createSqliteProvider === 'function', 'Adapter sqlite nao exporta createSqliteProvider.');
    assert(typeof postgresqlProvider.createPostgresqlProvider === 'function', 'Adapter postgresql nao exporta createPostgresqlProvider.');
    const expectedCodes = [
      'BANCUS_DATABASE_URL_REQUIRED',
      'BANCUS_POSTGRESQL_DRIVER_MISSING',
      'BANCUS_POSTGRESQL_CONNECTION_FAILED',
      'BANCUS_POSTGRESQL_SSL_REQUIRED',
      'BANCUS_POSTGRESQL_SCHEMA_MISMATCH',
      'BANCUS_POSTGRESQL_MIGRATION_MANIFEST_INVALID',
      'BANCUS_OWNER_CONFLICT',
      'BANCUS_USER_EMAIL_CONFLICT',
      'BANCUS_USER_HAS_RELATED_RECORDS',
      'LAST_ACTIVE_ADMIN'
    ];
    const actualCodes = Object.values(postgresqlProvider.ERROR_CODES || {});
    for (const code of expectedCodes) assert(actualCodes.includes(code), `Adapter postgresql nao expoe ${code}.`);
    return {
      defaultProvider: dbModule.DEFAULT_DB_PROVIDER,
      supportedProviders: dbModule.SUPPORTED_DB_PROVIDERS.slice(),
      errorCodes: expectedCodes
    };
  });

  await check('postgresql.migration-contract', 'Migration PostgreSQL corresponde ao manifest versionado', () => {
    assert(fs.existsSync(POSTGRES_MIGRATION_PATH), 'Baseline PostgreSQL declarada nao existe.');
    const schemaContract = postgresqlProvider.validateSchemaManifest(manifest, {
      schemaVersion: dbModule.SCHEMA_VERSION,
      manifestPath: SCHEMA_MANIFEST_PATH,
      databaseUrl: TEST_DATABASE_URL
    });
    const expectedMigration = expectedPostgresqlMigration(manifest);
    assert(expectedMigration === 'postgresql/001_bancus_fraternis.sql', 'Manifest nao seleciona a baseline PostgreSQL especifica.');
    assert(schemaContract.currentMigration === expectedMigration, 'Adapter e manifest divergem sobre a migration PostgreSQL ativa.');
    const sql = fs.readFileSync(POSTGRES_MIGRATION_PATH, 'utf8');
    const checksum = migrationChecksum(POSTGRES_MIGRATION_PATH);
    assert(manifest.migrationChecksums && manifest.migrationChecksums[expectedMigration] === checksum, 'Checksum do manifest diverge da migration PostgreSQL 001.');
    assert(!/\bPRAGMA\b/i.test(sql), 'Migration PostgreSQL contem PRAGMA exclusivo de SQLite.');
    assert(/\bBEGIN\s*;/i.test(sql) && /\bCOMMIT\s*;/i.test(sql), 'Migration PostgreSQL nao esta delimitada por transacao.');
    assert(sql.includes(`'${expectedMigration}'`), 'Migration PostgreSQL registra nome diferente do exigido pelo adapter.');
    assert(sql.includes(`'${manifest.schemaVersion}'`), 'Migration PostgreSQL registra schemaVersion diferente do manifest.');

    let validatedColumns = 0;
    let validatedIndexes = 0;
    for (const table of manifest.tables || []) {
      const tablePattern = new RegExp(
        `CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${escapeRegExp(table.name)}\\s*\\(([\\s\\S]*?)\\)\\s*;`,
        'i'
      );
      const tableMatch = sql.match(tablePattern);
      assert(tableMatch, `Migration PostgreSQL nao cria a tabela ${table.name}.`);
      for (const column of table.columns || []) {
        assert(new RegExp(`\\b${escapeRegExp(column)}\\b`, 'i').test(tableMatch[1]), `Tabela PostgreSQL ${table.name} nao declara coluna ${column}.`);
        validatedColumns += 1;
      }
      for (const index of table.indexes || []) {
        assert(
          new RegExp(`CREATE\\s+(?:UNIQUE\\s+)?INDEX\\s+IF\\s+NOT\\s+EXISTS\\s+${escapeRegExp(index)}\\b`, 'i').test(sql),
          `Migration PostgreSQL nao declara indice ${index}.`
        );
        validatedIndexes += 1;
      }
    }
    return {
      migration: expectedMigration,
      checksum,
      schemaVersion: manifest.schemaVersion,
      tables: (manifest.tables || []).length,
      columns: validatedColumns,
      indexes: validatedIndexes,
      transactional: true
    };
  });

  await check('postgresql.proposal-migration-contract', 'Migration PostgreSQL de proposta e append-only', () => {
    assert(fs.existsSync(POSTGRES_PROPOSAL_MIGRATION_PATH), 'Migration PostgreSQL 002 de proposta nao existe.');
    assert(fs.existsSync(POSTGRES_PROPOSAL_REPOSITORY_PATH), 'Repositorio PostgreSQL de proposta nao existe.');
    const repositoryModule = require(POSTGRES_PROPOSAL_REPOSITORY_PATH);
    assert(repositoryModule.PROVIDER === 'postgresql', 'Repositorio de proposta declara provider incorreto.');
    assert(repositoryModule.MIGRATION_NAME === 'postgresql/002_proposal_secure_share.sql', 'Repositorio e migration 002 divergem.');
    assert(typeof repositoryModule.createPostgresqlProposalShareRepository === 'function', 'Factory PostgreSQL de proposta ausente.');
    const sql = fs.readFileSync(POSTGRES_PROPOSAL_MIGRATION_PATH, 'utf8');
    const checksum = migrationChecksum(POSTGRES_PROPOSAL_MIGRATION_PATH);
    assert(manifest.migrationChecksums && manifest.migrationChecksums[repositoryModule.MIGRATION_NAME] === checksum, 'Checksum do manifest diverge da migration PostgreSQL 002.');
    for (const table of ['proposal_snapshots', 'proposal_shares']) {
      assert(new RegExp(`CREATE\\s+TABLE\\s+IF\\s+NOT\\s+EXISTS\\s+${table}\\b`, 'i').test(sql), `Migration 002 nao cria ${table}.`);
    }
    for (const column of ['owner_id', 'token_hash', 'terminal_snapshot_id', 'content_hash', 'parent_snapshot_id']) {
      assert(new RegExp(`\\b${column}\\b`, 'i').test(sql), `Migration 002 nao declara ${column}.`);
    }
    assert(!/\btoken\s+TEXT\b/i.test(sql), 'Migration 002 persiste token publico em texto puro.');
    assert(/proposal_snapshots_prevent_update/i.test(sql), 'Migration 002 nao bloqueia UPDATE de snapshots.');
    assert(/proposal_snapshots_prevent_delete/i.test(sql), 'Migration 002 nao bloqueia DELETE de snapshots.');
    assert(sql.includes("'postgresql/002_proposal_secure_share.sql'"), 'Migration 002 registra nome divergente.');
    assert(sql.includes("'bancus.proposal-secure-share.postgresql.v1'"), 'Migration 002 registra schemaVersion divergente.');
    assert(/\bBEGIN\s*;/i.test(sql) && /\bCOMMIT\s*;/i.test(sql), 'Migration 002 nao esta delimitada por transacao.');
    const serverSource = fs.readFileSync(SERVER_PATH, 'utf8');
    assert(serverSource.includes("database.provider === 'postgresql'"), 'server.js nao seleciona repositorio de proposta pelo provider principal.');
    assert(serverSource.includes('createPostgresqlProposalShareRepository'), 'server.js nao instancia repositorio PostgreSQL de proposta.');
    assert(serverSource.includes('provider: proposalShareRepository ? proposalShareRepository.provider : requestedDatabaseProvider'), 'Health nao informa provider do repositorio de proposta.');
    return {
      migration: repositoryModule.MIGRATION_NAME,
      checksum,
      tables: repositoryModule.REQUIRED_TABLES,
      appendOnlyTriggers: ['UPDATE', 'DELETE'],
      plaintextTokenColumn: false,
      healthProviderContract: true
    };
  });

  await check('sqlite.default', 'SQLite padrao permanece funcional', async () => {
    const dbPath = path.join(temporaryDirectory, 'default.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ dbPath }));
    try {
      assert(database.provider === 'sqlite', 'createDatabase sem provider nao retornou sqlite.');
      const event = await Promise.resolve(database.recordEvent({
        id: 'EVT-PROVIDER-DEFAULT',
        type: 'provider-gate',
        source: 'provider-gate',
        payload: { safe: true }
      }));
      const events = await Promise.resolve(database.listEvents({ limit: 10 }));
      const status = await Promise.resolve(database.databaseStatus());
      assert(event && event.id === 'EVT-PROVIDER-DEFAULT', 'SQLite padrao nao persistiu evento.');
      assert(events.some((item) => item.id === event.id), 'SQLite padrao nao leu o evento persistido.');
      assert(status && status.ok && status.provider === 'sqlite', 'SQLite padrao nao retornou status tecnico valido.');
      assert(status.sqlite && status.sqlite.quickCheck === 'ok', 'SQLite padrao falhou no PRAGMA quick_check.');
      return { provider: database.provider, quickCheck: status.sqlite.quickCheck, persistedEvent: event.id };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.explicit', 'SQLite explicito permanece funcional', async () => {
    const dbPath = path.join(temporaryDirectory, 'explicit.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      assert(database.provider === 'sqlite', 'createDatabase({provider: sqlite}) nao retornou sqlite.');
      const event = await Promise.resolve(database.recordEvent({
        id: 'EVT-PROVIDER-EXPLICIT',
        type: 'provider-gate-explicit',
        source: 'provider-gate',
        payload: { safe: true }
      }));
      const status = await Promise.resolve(database.databaseStatus());
      assert(event && event.id === 'EVT-PROVIDER-EXPLICIT', 'SQLite explicito nao persistiu evento.');
      assert(status && status.ok && status.provider === 'sqlite', 'SQLite explicito nao retornou status valido.');
      return { provider: database.provider, quickCheck: status.sqlite && status.sqlite.quickCheck, persistedEvent: event.id };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.direct-create-only', 'SQLite preserva a primeira gravacao no contrato createOnly', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-direct-create-only.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      const originalTimestamp = '2026-08-22T15:30:00.000Z';
      const original = await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: 'LEAD-SQLITE-CREATE-ONLY',
        ownerEmail: 'sqlite-create-only@example.com',
        title: 'Registro original',
        amount: 85000,
        payload: {
          interestRequestedAt: originalTimestamp,
          timeline: [{ id: 'TL-SQLITE-CREATE-ONLY', createdAt: originalTimestamp }]
        },
        createdAt: originalTimestamp,
        updatedAt: originalTimestamp
      }, { createOnly: true }));
      const repeated = await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: 'LEAD-SQLITE-CREATE-ONLY',
        ownerEmail: 'sqlite-create-only@example.com',
        title: 'Tentativa de sobrescrita',
        amount: 999999,
        payload: {
          interestRequestedAt: '2026-08-22T15:31:00.000Z',
          timeline: [{ id: 'TL-DUPLICATE' }, { id: 'TL-DUPLICATE-2' }]
        }
      }, { createOnly: true }));
      const takeover = await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: 'LEAD-SQLITE-CREATE-ONLY',
        ownerEmail: 'sqlite-create-only-takeover@example.com',
        payload: { unsafe: true }
      }, { createOnly: true }));
      assert(original.ok && original.created === true, 'SQLite nao marcou a criacao atomica original.');
      assert(repeated.ok && repeated.created === false, 'SQLite nao reconheceu a repeticao createOnly.');
      assert(repeated.lead.title === 'Registro original' && repeated.lead.amount === 85000, 'SQLite sobrescreveu campos do registro original.');
      assert(repeated.lead.payload.interestRequestedAt === originalTimestamp, 'SQLite alterou requestedAt original.');
      assert(repeated.lead.payload.timeline.length === 1, 'SQLite duplicou o evento original.');
      assert(takeover.ok === false && takeover.status === 409, 'SQLite createOnly nao bloqueou takeover de owner.');
      return {
        createdFlags: [original.created, repeated.created],
        requestedAt: repeated.lead.payload.interestRequestedAt,
        timelineEvents: repeated.lead.payload.timeline.length,
        takeover: 'blocked-409'
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.last-active-admin-delete', 'SQLite bloqueia exclusao do ultimo admin sem ocultar historico vinculado', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-last-active-admin-delete.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'sqlite',
      dbPath,
      authMode: 'production',
      seedUsers: false
    }));
    try {
      const password = 'Horizonte!Seguro2031#Norte';
      const created = database.createUser({
        id: 'USR-SQLITE-ONLY-ADMIN',
        name: 'Administrador SQLite Unico',
        email: 'sqlite-only-admin@example.com',
        role: 'admin',
        status: 'active',
        password
      });
      assert(created.ok, 'SQLite nao criou o administrador unitario.');

      const blocked = database.deleteUser(created.user.id);
      assert(blocked.status === 409 && blocked.code === 'LAST_ACTIVE_ADMIN', 'SQLite permitiu excluir o ultimo administrador ativo.');
      assert(database.findPublicUser(created.user.id), 'SQLite removeu o administrador apesar do bloqueio.');

      const login = database.login(created.user.email, password);
      assert(login.ok, 'SQLite nao criou a sessao vinculada da fixture administrativa.');
      const linked = database.deleteUser(created.user.id);
      assert(
        linked.status === 409 && linked.code === 'BANCUS_USER_HAS_RELATED_RECORDS',
        'SQLite deixou LAST_ACTIVE_ADMIN ocultar o contrato de historico vinculado.'
      );
      assert(database.findPublicUser(created.user.id), 'SQLite removeu o administrador com sessao vinculada.');
      return {
        unlinkedDelete: { status: blocked.status, code: blocked.code },
        linkedDelete: { status: linked.status, code: linked.code },
        userPreserved: true,
        transaction: 'SAVEPOINT with write lock before linked-record and admin-count checks'
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.last-active-admin-concurrency', 'SQLite preserva um admin em duas remocoes de acesso concorrentes', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-last-active-admin.sqlite');
    const setupDatabase = await Promise.resolve(dbModule.createDatabase({
      provider: 'sqlite',
      dbPath,
      authMode: 'production',
      seedUsers: false
    }));
    try {
      for (const fixture of [
        { id: 'USR-SQLITE-ADMIN-A', name: 'Administrador SQLite A', email: 'sqlite-admin-a@example.com' },
        { id: 'USR-SQLITE-ADMIN-B', name: 'Administrador SQLite B', email: 'sqlite-admin-b@example.com' }
      ]) {
        const created = await Promise.resolve(setupDatabase.createUser({
          ...fixture,
          role: 'admin',
          status: 'active',
          password: 'Horizonte!Seguro2031#Norte'
        }));
        assert(created.ok, `SQLite nao criou fixture administrativa ${fixture.id}.`);
      }
    } finally {
      await Promise.resolve(setupDatabase.close());
    }

    const attempts = await runConcurrentSqliteAdminMutations(dbPath);
    const inspectionDatabase = await Promise.resolve(dbModule.createDatabase({
      provider: 'sqlite',
      dbPath,
      authMode: 'production',
      seedUsers: false
    }));
    try {
      const succeeded = attempts.filter((attempt) => attempt.result && attempt.result.ok);
      const blocked = attempts.filter((attempt) => attempt.result && attempt.result.code === 'LAST_ACTIVE_ADMIN');
      const activeAdmins = inspectionDatabase.listUsers().filter((user) => user.role === 'admin' && user.status === 'active');

      assert(succeeded.length === 1, `SQLite confirmou ${succeeded.length} remocoes concorrentes; esperado 1.`);
      assert(blocked.length === 1 && blocked[0].result.status === 409, 'SQLite nao bloqueou a segunda remocao com LAST_ACTIVE_ADMIN/409.');
      assert(activeAdmins.length === 1, `SQLite terminou com ${activeAdmins.length} admins ativos.`);
      return {
        concurrentAttempts: attempts.map((attempt) => ({
          operation: attempt.operation,
          status: attempt.result.status,
          code: attempt.result.code || '',
          ok: attempt.result.ok
        })),
        succeeded: succeeded[0].operation,
        blocked: blocked[0].operation,
        activeAdminIds: activeAdmins.map((user) => user.id),
        concurrency: 'two worker threads / independent SQLite connections',
        transaction: 'SAVEPOINT with write lock before count'
      };
    } finally {
      await Promise.resolve(inspectionDatabase.close());
    }
  });

  await check('sqlite.last-active-admin-delete-concurrency', 'SQLite serializa delete contra demissao e inativacao concorrentes', async () => {
    const runScenario = async (suffix, competingMutation) => {
      const dbPath = path.join(temporaryDirectory, `sqlite-last-active-admin-delete-${suffix}.sqlite`);
      const setupDatabase = await Promise.resolve(dbModule.createDatabase({
        provider: 'sqlite',
        dbPath,
        authMode: 'production',
        seedUsers: false
      }));
      try {
        for (const fixture of [
          { id: 'USR-SQLITE-ADMIN-A', name: 'Administrador SQLite A', email: `sqlite-delete-a-${suffix}@example.com` },
          { id: 'USR-SQLITE-ADMIN-B', name: 'Administrador SQLite B', email: `sqlite-delete-b-${suffix}@example.com` }
        ]) {
          const created = setupDatabase.createUser({
            ...fixture,
            role: 'admin',
            status: 'active',
            password: 'Horizonte!Seguro2031#Norte'
          });
          assert(created.ok, `SQLite nao criou fixture concorrente ${fixture.id}.`);
        }
      } finally {
        await Promise.resolve(setupDatabase.close());
      }

      const attempts = await runConcurrentSqliteAdminMutations(dbPath, [
        { operation: 'delete', targetId: 'USR-SQLITE-ADMIN-A' },
        { operation: competingMutation, targetId: 'USR-SQLITE-ADMIN-B' }
      ]);
      const inspectionDatabase = await Promise.resolve(dbModule.createDatabase({
        provider: 'sqlite',
        dbPath,
        authMode: 'production',
        seedUsers: false
      }));
      try {
        const succeeded = attempts.filter((attempt) => attempt.result && attempt.result.ok);
        const blocked = attempts.filter((attempt) => attempt.result && attempt.result.code === 'LAST_ACTIVE_ADMIN');
        const activeAdmins = inspectionDatabase.listUsers().filter((user) => user.role === 'admin' && user.status === 'active');
        assert(succeeded.length === 1, `SQLite ${suffix} confirmou ${succeeded.length} remocoes; esperado 1.`);
        assert(blocked.length === 1 && blocked[0].result.status === 409, `SQLite ${suffix} nao bloqueou a segunda remocao com LAST_ACTIVE_ADMIN/409.`);
        assert(activeAdmins.length === 1, `SQLite ${suffix} terminou com ${activeAdmins.length} admins ativos.`);
        return {
          attempts: attempts.map((attempt) => ({
            operation: attempt.operation,
            status: attempt.result.status,
            code: attempt.result.code || '',
            ok: attempt.result.ok
          })),
          activeAdminIds: activeAdmins.map((user) => user.id)
        };
      } finally {
        await Promise.resolve(inspectionDatabase.close());
      }
    };

    return {
      deleteVsUpdate: await runScenario('update', 'demotion'),
      deleteVsStatus: await runScenario('status', 'inactivation'),
      concurrency: 'worker-thread barrier with independent SQLite connections'
    };
  });

  await check('sqlite.owner-and-identity-guards', 'SQLite bloqueia takeover e migra identidade vinculada', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-owner-guards.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      const ownerA = 'sqlite-owner-a@example.com';
      const ownerB = 'sqlite-owner-b@example.com';
      const leadId = 'LEAD-SQLITE-OWNER-GATE';
      const createdLead = await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: leadId,
        ownerEmail: ownerA,
        title: 'Lead SQLite original A',
        status: 'novo',
        payload: { safeLabel: 'sqlite-owner-a' }
      }));
      assert(createdLead.ok && createdLead.created, 'SQLite nao criou lead do owner A.');
      const takeoverLead = await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: leadId,
        ownerEmail: ownerB,
        title: 'Takeover SQLite B',
        status: 'qualificado',
        payload: { safeLabel: 'sqlite-owner-b-takeover' }
      }));
      assert(takeoverLead && takeoverLead.ok === false && takeoverLead.status === 409, 'SQLite nao recusou takeover de lead com 409.');
      assert(takeoverLead.code === 'BANCUS_OWNER_CONFLICT', 'SQLite nao retornou BANCUS_OWNER_CONFLICT no takeover de lead.');
      assert(!takeoverLead.lead && !takeoverLead.record, 'Conflito SQLite retornou registro de outro owner.');
      const leadAfter = await Promise.resolve(database.findMaterializedJourneyRow('lead', leadId, { ownerEmail: ownerA }));
      const leadForB = await Promise.resolve(database.findMaterializedJourneyRow('lead', leadId, { ownerEmail: ownerB }));
      assert(leadAfter && leadAfter.title === 'Lead SQLite original A', 'Takeover SQLite alterou o lead original.');
      assert(leadAfter.payload && leadAfter.payload.safeLabel === 'sqlite-owner-a', 'Takeover SQLite alterou payload do lead.');
      assert(leadForB === null, 'Owner B passou a enxergar lead SQLite do owner A.');

      const snapshotId = 'SNAPSHOT-SQLITE-OWNER-GATE';
      const createdSnapshot = await Promise.resolve(database.upsertSnapshot({
        id: snapshotId,
        type: 'owner-scope-gate',
        ownerEmail: ownerA,
        title: 'Snapshot SQLite original A',
        payload: { safeLabel: 'snapshot-sqlite-a' }
      }));
      assert(createdSnapshot && createdSnapshot.created, 'SQLite nao criou snapshot do owner A.');
      const takeoverSnapshot = await Promise.resolve(database.upsertSnapshot({
        id: snapshotId,
        type: 'owner-scope-gate',
        ownerEmail: ownerB,
        title: 'Takeover snapshot SQLite B',
        payload: { safeLabel: 'snapshot-sqlite-b' }
      }));
      assert(takeoverSnapshot && takeoverSnapshot.ok === false && takeoverSnapshot.status === 409, 'SQLite nao recusou takeover de snapshot com 409.');
      assert(takeoverSnapshot.code === 'BANCUS_OWNER_CONFLICT', 'SQLite nao retornou BANCUS_OWNER_CONFLICT no snapshot.');
      assert(!takeoverSnapshot.snapshot, 'Conflito de snapshot SQLite retornou registro de outro owner.');
      const snapshotsA = await Promise.resolve(database.listSnapshots({ ownerEmail: ownerA, type: 'owner-scope-gate', limit: 20 }));
      const snapshotsB = await Promise.resolve(database.listSnapshots({ ownerEmail: ownerB, type: 'owner-scope-gate', limit: 20 }));
      const snapshotAfter = snapshotsA.find((item) => item.id === snapshotId);
      assert(snapshotAfter && snapshotAfter.title === 'Snapshot SQLite original A', 'Takeover SQLite alterou snapshot original.');
      assert(!snapshotsB.some((item) => item.id === snapshotId), 'Snapshot SQLite vazou para owner B.');

      const userEmail = 'sqlite-linked-user@example.com';
      const createdUser = await Promise.resolve(database.createUser({
        id: 'USR-SQLITE-LINKED',
        name: 'Usuario SQLite Vinculado',
        email: userEmail,
        role: 'consultor',
        status: 'active',
        department: 'QA',
        phone: '(00) 00000-0000',
        password: 'GatePassword123'
      }));
      assert(createdUser.ok, 'SQLite nao criou usuario para guarda de identidade.');
      await Promise.resolve(database.upsertDirectJourneyRow('lead', {
        id: 'LEAD-SQLITE-LINKED-USER',
        ownerEmail: userEmail,
        actorEmail: userEmail,
        title: 'Lead vinculado ao usuario SQLite',
        payload: { safe: true }
      }));
      await Promise.resolve(database.recordEvent({
        id: 'EVT-SQLITE-LINKED-USER',
        type: 'identity-migration-gate',
        ownerEmail: userEmail,
        actorEmail: userEmail,
        payload: { safe: true }
      }));
      await Promise.resolve(database.upsertSnapshot({
        id: 'SNAPSHOT-SQLITE-LINKED-USER',
        type: 'identity-migration-gate',
        ownerEmail: userEmail,
        actorEmail: userEmail,
        title: 'Snapshot de identidade SQLite',
        payload: { safe: true }
      }));
      const duplicateEmail = 'sqlite-duplicate-target@example.com';
      const duplicateUser = await Promise.resolve(database.createUser({
        id: 'USR-SQLITE-DUPLICATE',
        name: 'Usuario SQLite Duplicado',
        email: duplicateEmail,
        role: 'cliente',
        status: 'active',
        department: 'QA',
        phone: '(00) 00000-0002',
        password: 'GatePassword123'
      }));
      assert(duplicateUser.ok, 'SQLite nao criou usuario de destino duplicado.');
      const migratedEmail = 'sqlite-migrated@example.com';
      const emailMutation = await Promise.resolve(database.updateUser('USR-SQLITE-LINKED', {
        name: 'Usuario SQLite Vinculado',
        email: migratedEmail,
        role: 'consultor',
        status: 'active',
        department: 'QA',
        phone: '(00) 00000-0000'
      }));
      assert(emailMutation.ok && emailMutation.user && emailMutation.user.email === migratedEmail, 'SQLite nao migrou e-mail do usuario.');
      const migratedLead = await Promise.resolve(database.findMaterializedJourneyRow('lead', 'LEAD-SQLITE-LINKED-USER', { ownerEmail: migratedEmail }));
      const inheritedByOldEmail = await Promise.resolve(database.findMaterializedJourneyRow('lead', 'LEAD-SQLITE-LINKED-USER', { ownerEmail: userEmail }));
      assert(migratedLead && migratedLead.ownerEmail === migratedEmail && migratedLead.actorEmail === migratedEmail, 'SQLite nao migrou owner/actor do lead.');
      assert(inheritedByOldEmail === null, 'E-mail antigo herdou lead depois da migracao SQLite.');
      const migratedSnapshots = await Promise.resolve(database.listSnapshots({ ownerEmail: migratedEmail, type: 'identity-migration-gate', limit: 20 }));
      const oldEmailSnapshots = await Promise.resolve(database.listSnapshots({ ownerEmail: userEmail, type: 'identity-migration-gate', limit: 20 }));
      assert(migratedSnapshots.some((item) => item.id === 'SNAPSHOT-SQLITE-LINKED-USER' && item.actorEmail === migratedEmail), 'SQLite nao migrou owner/actor do snapshot.');
      assert(!oldEmailSnapshots.some((item) => item.id === 'SNAPSHOT-SQLITE-LINKED-USER'), 'E-mail antigo herdou snapshot depois da migracao SQLite.');
      const migratedEvent = (await Promise.resolve(database.listEvents({ limit: 100 }))).find((item) => item.id === 'EVT-SQLITE-LINKED-USER');
      assert(migratedEvent && migratedEvent.ownerEmail === migratedEmail && migratedEvent.actorEmail === migratedEmail, 'SQLite nao migrou owner/actor do evento.');
      const duplicateMutation = await Promise.resolve(database.updateUser('USR-SQLITE-LINKED', {
        name: 'Usuario SQLite Vinculado',
        email: duplicateEmail,
        role: 'consultor',
        status: 'active',
        department: 'QA',
        phone: '(00) 00000-0000'
      }));
      assert(duplicateMutation.ok === false && duplicateMutation.status === 409, 'SQLite permitiu colisao de e-mail destino.');
      assert((await Promise.resolve(database.findPublicUser('USR-SQLITE-LINKED'))).email === migratedEmail, 'Colisao SQLite alterou a identidade parcialmente.');
      const linkedDelete = await Promise.resolve(database.deleteUser('USR-SQLITE-LINKED'));
      assert(linkedDelete.ok === false && linkedDelete.status === 409, 'SQLite excluiu usuario com historico vinculado.');
      assert(linkedDelete.code === 'BANCUS_USER_HAS_RELATED_RECORDS', 'SQLite nao retornou codigo de delete vinculado.');
      assert(/inativ/i.test(linkedDelete.message), 'SQLite nao orienta inativacao no conflito de delete.');
      assert(await Promise.resolve(database.findPublicUser('USR-SQLITE-LINKED')), 'SQLite removeu usuario vinculado apesar do conflito.');

      return {
        leadTakeover: 'blocked-409',
        snapshotTakeover: 'blocked-409',
        emailMigration: 'committed-atomically',
        duplicateEmail: 'blocked-409',
        oldEmailInheritedRecords: 0,
        linkedDelete: 'blocked-409',
        ownerAndPayloadPreserved: true
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.user-status-rollback', 'SQLite reverte inativacao se a revogacao de sessoes falhar', async () => {
    const { DatabaseSync: NativeDatabaseSync } = require('node:sqlite');
    const fault = { enabled: false };
    class FaultInjectingDatabaseSync {
      constructor(dbPath) {
        const nativeDatabase = new NativeDatabaseSync(dbPath);
        return new Proxy(nativeDatabase, {
          get(target, property) {
            if (property === 'prepare') {
              return (sql) => {
                const statement = target.prepare(sql);
                if (!/UPDATE\s+sessions\s+SET\s+revoked_at\s*=.*WHERE\s+user_id/i.test(String(sql))) return statement;
                return new Proxy(statement, {
                  get(statementTarget, statementProperty) {
                    if (statementProperty === 'run') {
                      return (...args) => {
                        if (fault.enabled) {
                          const error = new Error('Injected SQLite session revocation failure');
                          error.code = 'SQLITE_GATE_SESSION_REVOCATION_FAILURE';
                          throw error;
                        }
                        return statementTarget.run(...args);
                      };
                    }
                    const value = Reflect.get(statementTarget, statementProperty, statementTarget);
                    return typeof value === 'function' ? value.bind(statementTarget) : value;
                  }
                });
              };
            }
            const value = Reflect.get(target, property, target);
            return typeof value === 'function' ? value.bind(target) : value;
          }
        });
      }
    }

    const dbPath = path.join(temporaryDirectory, 'sqlite-status-rollback.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'sqlite',
      dbPath,
      DatabaseSync: FaultInjectingDatabaseSync
    }));
    try {
      const created = await Promise.resolve(database.createUser({
        id: 'USR-SQLITE-STATUS-ROLLBACK',
        name: 'Usuario SQLite Rollback',
        email: 'sqlite-status-rollback@example.com',
        role: 'consultor',
        status: 'active',
        password: 'GatePassword123'
      }));
      assert(created.ok, 'SQLite nao criou usuario para o teste transacional de status.');
      const login = await Promise.resolve(database.login('sqlite-status-rollback@example.com', 'GatePassword123'));
      assert(login.ok && login.session && login.session.token, 'SQLite nao criou sessao ativa para o teste transacional.');
      fault.enabled = true;
      let failure = null;
      try {
        await Promise.resolve(database.setUserStatus('USR-SQLITE-STATUS-ROLLBACK', 'inactive'));
      } catch (error) {
        failure = error;
      } finally {
        fault.enabled = false;
      }
      assert(failure && failure.code === 'SQLITE_GATE_SESSION_REVOCATION_FAILURE', 'SQLite nao propagou a falha injetada de revogacao.');
      const userAfter = await Promise.resolve(database.findPublicUser('USR-SQLITE-STATUS-ROLLBACK'));
      const contextAfter = await Promise.resolve(database.authenticateToken(login.session.token));
      assert(userAfter && userAfter.status === 'active', 'SQLite nao reverteu o status apos falha na revogacao.');
      assert(contextAfter && contextAfter.user && contextAfter.user.id === userAfter.id, 'SQLite revogou parcialmente a sessao apesar do rollback.');
      return {
        injectedFailure: 'session-revocation',
        userStatusAfterRollback: userAfter.status,
        priorSessionStillValid: true,
        transaction: 'SAVEPOINT/ROLLBACK TO'
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.large-json-envelope', 'SQLite trunca payload grande em JSON parseavel', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-large-json.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      const event = await Promise.resolve(database.recordEvent({
        id: 'EVT-SQLITE-LARGE-JSON',
        type: 'large-json-gate',
        payload: makeOversizedSafePayload()
      }));
      assert(event && event.payload && event.payload.truncated === true, 'SQLite nao retornou envelope truncated para payload grande.');
      assert(event.payload.originalLength > event.payload.maxLength, 'Envelope SQLite nao informa tamanho original maior que o limite.');
      assert(typeof event.payload.reason === 'string' && event.payload.reason, 'Envelope SQLite nao informa motivo da truncagem.');
      const reparsed = JSON.parse(JSON.stringify(event.payload));
      assert(reparsed.truncated === true, 'Envelope SQLite deixou de ser JSON parseavel.');
      const persisted = (await Promise.resolve(database.listEvents({ limit: 20 }))).find((item) => item.id === event.id);
      assert(persisted && persisted.payload && persisted.payload.truncated === true, 'SQLite nao persistiu envelope JSON parseavel.');
      return {
        truncated: true,
        originalLength: event.payload.originalLength,
        maxLength: event.payload.maxLength,
        parseable: true
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.snapshot-payload-boundary', 'SQLite preserva snapshot grande e rejeita somente acima de 4 MiB', async () => {
    assert(dbModule.MAX_EVENT_PAYLOAD_CHARS === 50000, 'Contrato MAX_EVENT_PAYLOAD_CHARS deixou de ser 50.000.');
    assert(
      dbModule.MAX_PERSISTED_PAYLOAD_CHARS === 4 * 1024 * 1024,
      'Contrato MAX_PERSISTED_PAYLOAD_CHARS deixou de ser 4 MiB.'
    );
    const dbPath = path.join(temporaryDirectory, 'sqlite-snapshot-payload-boundary.sqlite');
    const database = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      const payload = makeOversizedSafePayload();
      const expectedPayload = dbModule.sanitizePersistedPayload(payload);
      const expectedJson = JSON.stringify(expectedPayload);
      assert(expectedJson.length > dbModule.MAX_EVENT_PAYLOAD_CHARS, 'Fixture de snapshot nao ultrapassou o limite de eventos.');
      assert(expectedJson.length < dbModule.MAX_PERSISTED_PAYLOAD_CHARS, 'Fixture de snapshot ultrapassou o limite persistido.');
      const created = await Promise.resolve(database.upsertSnapshot({
        id: 'SNAPSHOT-SQLITE-PAYLOAD-80K',
        type: 'simulation',
        ownerEmail: 'payload-sqlite@example.com',
        actorEmail: 'payload-sqlite@example.com',
        title: 'Snapshot multigrupo grande',
        payload
      }));
      assert(created && created.snapshot, 'SQLite nao criou o snapshot grande dentro do limite.');
      assert(JSON.stringify(created.snapshot.payload) === expectedJson, 'SQLite truncou ou alterou o snapshot grande no retorno da escrita.');
      const persisted = (await Promise.resolve(database.listSnapshots({
        ownerEmail: 'payload-sqlite@example.com',
        type: 'simulation',
        limit: 20
      }))).find((item) => item.id === 'SNAPSHOT-SQLITE-PAYLOAD-80K');
      assert(persisted && JSON.stringify(persisted.payload) === expectedJson, 'SQLite nao releu integralmente o snapshot grande persistido.');

      const oversizedPayload = makeSafePayloadLargerThan(dbModule.MAX_PERSISTED_PAYLOAD_CHARS);
      const sanitizedOversizedLength = JSON.stringify(dbModule.sanitizePersistedPayload(oversizedPayload)).length;
      assert(sanitizedOversizedLength > dbModule.MAX_PERSISTED_PAYLOAD_CHARS, 'Fixture SQLite nao excedeu 4 MiB apos sanitizacao.');
      const failure = await expectPayloadTooLarge(() => database.upsertSnapshot({
        id: 'SNAPSHOT-SQLITE-PAYLOAD-OVER-LIMIT',
        type: 'simulation',
        ownerEmail: 'payload-sqlite@example.com',
        payload: oversizedPayload
      }), 'Snapshot SQLite acima de 4 MiB');
      const afterFailure = await Promise.resolve(database.listSnapshots({
        ownerEmail: 'payload-sqlite@example.com',
        type: 'simulation',
        limit: 20
      }));
      assert(!afterFailure.some((item) => item.id === 'SNAPSHOT-SQLITE-PAYLOAD-OVER-LIMIT'), 'SQLite deixou snapshot parcial apos rejeitar payload grande.');
      return {
        eventLimitChars: dbModule.MAX_EVENT_PAYLOAD_CHARS,
        persistedLimitChars: dbModule.MAX_PERSISTED_PAYLOAD_CHARS,
        preservedPayloadChars: expectedJson.length,
        preservedExactly: true,
        rejectedPayloadChars: sanitizedOversizedLength,
        rejection: failure,
        partialRowsAfterRejection: 0
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('sqlite.direct-records-survive-reopen', 'Rebuild SQLite preserva registros diretos apos reabertura', async () => {
    const dbPath = path.join(temporaryDirectory, 'sqlite-direct-reopen.sqlite');
    const first = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      await Promise.resolve(first.upsertDirectJourneyRow('lead', {
        id: 'LEAD-SQLITE-REOPEN', ownerEmail: 'reopen@example.com', payload: { safe: 'lead' }
      }));
      await Promise.resolve(first.upsertDirectJourneyRow('simulation', {
        id: 'SIM-SQLITE-REOPEN', ownerEmail: 'reopen@example.com', payload: { safe: 'simulation' }
      }));
      await Promise.resolve(first.upsertDirectJourneyRow('proposal', {
        id: 'PROP-SQLITE-REOPEN', ownerEmail: 'reopen@example.com', payload: { safe: 'proposal' }
      }));
    } finally {
      await Promise.resolve(first.close());
    }
    const reopened = await Promise.resolve(dbModule.createDatabase({ provider: 'sqlite', dbPath }));
    try {
      const leads = await Promise.resolve(reopened.listLeads({ ownerEmail: 'reopen@example.com', limit: 20 }));
      const simulations = await Promise.resolve(reopened.listSimulations({ ownerEmail: 'reopen@example.com', limit: 20 }));
      const proposals = await Promise.resolve(reopened.listProposals({ ownerEmail: 'reopen@example.com', limit: 20 }));
      assert(leads.some((item) => item.id === 'LEAD-SQLITE-REOPEN'), 'Lead direto sumiu apos reabrir SQLite.');
      assert(simulations.some((item) => item.id === 'SIM-SQLITE-REOPEN'), 'Simulacao direta sumiu apos reabrir SQLite.');
      assert(proposals.some((item) => item.id === 'PROP-SQLITE-REOPEN'), 'Proposta direta sumiu apos reabrir SQLite.');
      const dbSource = fs.readFileSync(DB_MODULE_PATH, 'utf8');
      const rebuildStart = dbSource.indexOf('rebuildJourneyEntities()');
      const rebuildEnd = dbSource.indexOf('listSnapshots(', rebuildStart);
      const rebuildBlock = rebuildStart >= 0 && rebuildEnd > rebuildStart ? dbSource.slice(rebuildStart, rebuildEnd) : '';
      assert(!/DELETE\s+FROM\s+journey_(?:leads|simulations|proposals)/i.test(rebuildBlock), 'Rebuild SQLite ainda apaga tabelas diretas.');
      return {
        reopened: true,
        preserved: ['lead', 'simulation', 'proposal'],
        destructiveRebuildDeletes: 0
      };
    } finally {
      await Promise.resolve(reopened.close());
    }
  });

  await check('provider.unknown', 'Provider desconhecido falha sem fallback', async () => {
    const dbPath = path.join(temporaryDirectory, 'unknown.sqlite');
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({ provider: 'unknown-provider-gate', dbPath }),
      '',
      'Provider desconhecido'
    );
    assert(/unknown-provider-gate/i.test(failure.message), 'Erro de provider desconhecido nao identifica o valor invalido.');
    assert(!fs.existsSync(dbPath), 'Provider desconhecido criou arquivo SQLite por fallback silencioso.');
    return { fallbackCreated: false, error: failure };
  });

  await check('postgresql.url-required', 'PostgreSQL sem URL falha explicitamente', async () => {
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({ provider: 'postgresql', driver: {} }),
      'BANCUS_DATABASE_URL_REQUIRED',
      'PostgreSQL sem BANCUS_DATABASE_URL'
    );
    assert(failure.message.includes('BANCUS_DATABASE_URL'), 'Erro sem URL nao orienta configurar BANCUS_DATABASE_URL.');
    return failure;
  });

  await check('postgresql.driver-missing', 'PostgreSQL sem driver falha explicitamente e sem segredo', async () => {
    return expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        driver: {},
        driverModule: `__bancus_provider_gate_missing_driver_${process.pid}__`
      }),
      'BANCUS_POSTGRESQL_DRIVER_MISSING',
      'PostgreSQL sem driver'
    );
  });

  await check('postgresql.connection-failed', 'PostgreSQL sem conexao falha explicitamente e sem segredo', async () => {
    const pool = new SchemaPool(manifest, { failConnection: true });
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: manifest,
        seedUsers: false,
        rebuildJourneyEntities: false
      }),
      'BANCUS_POSTGRESQL_CONNECTION_FAILED',
      'PostgreSQL sem conexao'
    );
    assert(pool.queries.length === 1, 'Falha de conexao deveria ocorrer no primeiro ping controlado.');
    return { ...failure, networkUsed: false, mockQueries: pool.queries.length };
  });

  await check('postgresql.schema-mismatch', 'PostgreSQL sem schema falha explicitamente e sem segredo', async () => {
    const pool = new SchemaPool(manifest, { missingTables: true });
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: manifest,
        seedUsers: false,
        rebuildJourneyEntities: false
      }),
      'BANCUS_POSTGRESQL_SCHEMA_MISMATCH',
      'PostgreSQL sem schema'
    );
    assert(pool.queries.some((item) => item.sql.includes('information_schema.tables')), 'Adapter nao consultou as tabelas do schema.');
    return { ...failure, networkUsed: false, schemaInspection: true };
  });

  await check('postgresql.migration-mismatch', 'PostgreSQL com migration divergente falha explicitamente', async () => {
    const pool = new SchemaPool(manifest, { badMigration: true });
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: manifest,
        seedUsers: false
      }),
      'BANCUS_POSTGRESQL_SCHEMA_MISMATCH',
      'PostgreSQL com migration divergente'
    );
    assert(pool.queries.some((item) => item.sql.includes('migration_name')), 'Adapter nao consultou a migration aplicada.');
    return { ...failure, networkUsed: false, migrationInspection: true };
  });

  await check('postgresql.manifest-invalid', 'Manifest invalido falha antes de usar o banco', async () => {
    const pool = new SchemaPool(manifest);
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: {},
        seedUsers: false,
        rebuildJourneyEntities: false
      }),
      'BANCUS_POSTGRESQL_MIGRATION_MANIFEST_INVALID',
      'PostgreSQL com manifest invalido'
    );
    assert(pool.queries.length === 0, 'Manifest invalido deveria falhar antes de qualquer query.');
    return { ...failure, queriesBeforeFailure: pool.queries.length };
  });

  await check('postgresql.migration-checksum', 'Checksum adulterado bloqueia boot antes de queries', async () => {
    const pool = new SchemaPool(manifest);
    const tamperedManifest = JSON.parse(JSON.stringify(manifest));
    tamperedManifest.migrationChecksums[expectedPostgresqlMigration(tamperedManifest)] = `sha256:${'0'.repeat(64)}`;
    const failure = await expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: tamperedManifest,
        seedUsers: false
      }),
      'BANCUS_POSTGRESQL_MIGRATION_MANIFEST_INVALID',
      'PostgreSQL com checksum adulterado'
    );
    assert(pool.queries.length === 0, 'Checksum adulterado deveria falhar antes de qualquer query.');
    return { ...failure, tamperedMigration: expectedPostgresqlMigration(tamperedManifest), queriesBeforeFailure: 0 };
  });

  await check('postgresql.ssl-required', 'Pool PostgreSQL remoto recusa SSL ausente ou inseguro', async () => {
    class NeverConstructedPool {
      constructor() {
        throw new Error('Pool nao deveria ser construido sem SSL valido.');
      }
    }
    return expectProviderFailure(
      () => dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: REMOTE_TEST_DATABASE_URL,
        Pool: NeverConstructedPool,
        ssl: false,
        schemaManifest: manifest,
        seedUsers: false
      }),
      'BANCUS_POSTGRESQL_SSL_REQUIRED',
      'PostgreSQL remoto sem SSL'
    );
  });

  await check('postgresql.pool-configuration', 'Pool proprio prioriza opcoes seguras sobre query params da URL', async () => {
    let instance = null;
    let capturedOptions = null;
    const forwardedErrors = [];
    class CapturingPool extends MemoryPostgresqlPool {
      constructor(options) {
        super(manifest);
        instance = this;
        capturedOptions = options;
        this.listeners = new Map();
      }

      on(event, handler) {
        this.listeners.set(event, handler);
        return this;
      }
    }

    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      databaseUrl: HOSTILE_REMOTE_TEST_DATABASE_URL,
      Pool: CapturingPool,
      ssl: true,
      poolMax: 7,
      connectionTimeoutMillis: 4321,
      queryTimeoutMillis: 8765,
      idleTimeoutMillis: 23456,
      schemaManifest: manifest,
      seedUsers: false,
      onPoolError: (error) => forwardedErrors.push(error)
    }));
    try {
      assert(instance && capturedOptions, 'Construtor Pool nao recebeu opcoes.');
      assert(capturedOptions.host === 'db.provider-gate.invalid', 'Pool nao recebeu host explicito extraido da URL.');
      assert(capturedOptions.port === 5432, 'Pool nao recebeu porta explicita extraida da URL.');
      assert(capturedOptions.user === 'provider_gate', 'Pool nao recebeu usuario explicito extraido da URL.');
      assert(capturedOptions.password === SECRET_SENTINEL, 'Pool nao recebeu senha explicita extraida da URL.');
      assert(capturedOptions.database === 'bancus_gate', 'Pool nao recebeu database explicito extraido da URL.');
      if (capturedOptions.connectionString !== undefined) {
        const forwardedUrl = new URL(String(capturedOptions.connectionString));
        for (const key of ['sslmode', 'ssl', 'query_timeout', 'statement_timeout']) {
          assert(!forwardedUrl.searchParams.has(key), `Pool repassou o query param hostil ${key} em connectionString.`);
        }
      }
      assert(capturedOptions.sslmode === undefined, 'Pool promoveu sslmode hostil da URL para opcao explicita.');
      assert(capturedOptions.ssl && capturedOptions.ssl.rejectUnauthorized === true, 'Pool remoto nao recebeu SSL com verificacao de certificado.');
      assert(capturedOptions.max === 7, 'Pool nao recebeu limite max=7.');
      assert(capturedOptions.connectionTimeoutMillis === 4321, 'Pool nao recebeu connectionTimeoutMillis=4321.');
      assert(capturedOptions.idleTimeoutMillis === 23456, 'Pool nao recebeu idleTimeoutMillis=23456.');
      assert(capturedOptions.query_timeout === 8765, 'Pool nao recebeu query_timeout=8765.');
      assert(capturedOptions.statement_timeout === 8765, 'Pool nao recebeu statement_timeout=8765.');
      const PgConnectionParameters = require('pg/lib/connection-parameters');
      const effectivePgOptions = new PgConnectionParameters(capturedOptions);
      assert(
        effectivePgOptions.ssl && effectivePgOptions.ssl.rejectUnauthorized === true,
        'pg real reinterpretou a configuracao e desativou a verificacao TLS.'
      );
      assert(Number(effectivePgOptions.query_timeout) === 8765, 'pg real aceitou query_timeout hostil da URL.');
      assert(Number(effectivePgOptions.statement_timeout) === 8765, 'pg real aceitou statement_timeout hostil da URL.');
      const errorListener = instance.listeners.get('error');
      assert(typeof errorListener === 'function', 'Pool proprio nao registrou listener de error.');

      const consoleOutput = [];
      const originalWarn = console.warn;
      const originalError = console.error;
      console.warn = (...args) => consoleOutput.push(args.map(String).join(' '));
      console.error = (...args) => consoleOutput.push(args.map(String).join(' '));
      try {
        await Promise.resolve(errorListener(new Error(`pool failure at ${HOSTILE_REMOTE_TEST_DATABASE_URL}`)));
      } finally {
        console.warn = originalWarn;
        console.error = originalError;
      }
      assert(forwardedErrors.length === 1, 'Listener de pool nao encaminhou o erro para onPoolError.');
      const listenerText = errorText(forwardedErrors[0]);
      assert(!listenerText.includes(SECRET_SENTINEL), 'Listener de pool encaminhou segredo sem redacao.');
      assert(!listenerText.includes(HOSTILE_REMOTE_TEST_DATABASE_URL), 'Listener de pool encaminhou URL sem redacao.');
      assert(!listenerText.includes('db.provider-gate.invalid'), 'Listener de pool encaminhou hostname sem redacao.');
      assert(!consoleOutput.join('\n').includes(SECRET_SENTINEL), 'Listener de pool registrou segredo no console.');
      assert(!consoleOutput.join('\n').includes(HOSTILE_REMOTE_TEST_DATABASE_URL), 'Listener de pool registrou URL no console.');
      return {
        sslRejectUnauthorized: true,
        max: capturedOptions.max,
        connectionTimeoutMillis: capturedOptions.connectionTimeoutMillis,
        idleTimeoutMillis: capturedOptions.idleTimeoutMillis,
        queryTimeoutMillis: capturedOptions.query_timeout,
        hostileUrlParametersIgnored: ['sslmode', 'ssl', 'query_timeout', 'statement_timeout'],
        connectionUsesExplicitFields: true,
        verifiedWithPgConnectionParameters: true,
        errorListener: true,
        forwardedErrorRedacted: true,
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('postgresql.seed-opt-in', 'PostgreSQL nao cria usuarios seed por padrao', async () => {
    return withEnvironment({ BANCUS_DB_SEED_USERS: undefined }, async () => {
      const defaultPool = new MemoryPostgresqlPool(manifest);
      const defaultDatabase = await Promise.resolve(dbModule.createDatabase({
        provider: 'postgresql',
        databaseUrl: TEST_DATABASE_URL,
        pool: defaultPool,
        schemaManifest: manifest
      }));
      try {
        assert(defaultPool.users.size === 0, 'Provider PostgreSQL criou usuarios seed sem opt-in.');
      } finally {
        await Promise.resolve(defaultDatabase.close());
      }

      const optInPool = new MemoryPostgresqlPool(manifest);
      const optInDatabase = await Promise.resolve(dbModule.createDatabase({
        provider: 'postgresql',
        authMode: 'demo',
        databaseUrl: TEST_DATABASE_URL,
        pool: optInPool,
        schemaManifest: manifest,
        seedUsers: true
      }));
      try {
        assert(optInPool.users.size >= 3, 'Provider PostgreSQL nao criou seeds apos opt-in explicito.');
      } finally {
        await Promise.resolve(optInDatabase.close());
      }
      let productiveSeedRejected = false;
      try {
        await Promise.resolve(dbModule.createDatabase({
          provider: 'postgresql',
          authMode: 'production',
          databaseUrl: TEST_DATABASE_URL,
          pool: new MemoryPostgresqlPool(manifest),
          schemaManifest: manifest,
          seedUsers: true
        }));
      } catch (error) {
        productiveSeedRejected = /production/i.test(String(error && error.message || ''));
      }
      assert(productiveSeedRejected, 'Provider PostgreSQL aceitou seeds em modo produtivo.');
      return { defaultSeedCount: 0, explicitDemoSeedCount: optInPool.users.size, productiveSeedRejected, networkUsed: false };
    });
  });

  await check('postgresql.credential-policy-cutover', 'PostgreSQL exige troca para credencial legada e promove somente apos nova senha', async () => {
    const pool = new MemoryPostgresqlPool(manifest);
    const demoDatabase = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      authMode: 'demo',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false,
      rebuildJourneyEntities: false
    }));
    let productionDatabase;
    try {
      const created = await demoDatabase.createUser({
        id: 'USR-PG-LEGACY-POLICY',
        name: 'Conta Legada PostgreSQL',
        email: 'legacy-pg@example.com',
        role: 'cliente',
        status: 'active',
        password: 'Fraca1'
      });
      assert(created.ok, 'Fixture PostgreSQL demo nao criou credencial legada.');
      assert(
        pool.users.get('USR-PG-LEGACY-POLICY')?.password_algorithm === dbModule.PASSWORD_HASH_ALGORITHM,
        'Fixture PostgreSQL demo nao gravou o marcador legado.'
      );
      productionDatabase = await Promise.resolve(dbModule.createDatabase({
        provider: 'postgresql',
        authMode: 'production',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: manifest,
        seedUsers: false,
        rebuildJourneyEntities: false
      }));
      const listed = (await productionDatabase.listUsers()).find((user) => user.id === 'USR-PG-LEGACY-POLICY');
      assert(listed?.mustChangePassword === true, 'Listagem PostgreSQL ocultou o corte da credencial legada.');
      const login = await productionDatabase.login('legacy-pg@example.com', 'Fraca1');
      assert(login.ok && login.user.mustChangePassword === true, 'Login PostgreSQL nao restringiu credencial legada.');
      const upgraded = await productionDatabase.changePassword(
        'USR-PG-LEGACY-POLICY',
        'Fraca1',
        'Horizonte!Seguro2030#Sul'
      );
      assert(upgraded.ok && upgraded.user.mustChangePassword === false, 'PostgreSQL nao concluiu a troca da credencial legada.');
      assert(
        pool.users.get('USR-PG-LEGACY-POLICY')?.password_algorithm === dbModule.CURRENT_PASSWORD_POLICY_VERSION,
        'PostgreSQL nao gravou a versao corrente depois da troca real.'
      );
      return { legacyRestricted: true, promotedAfterChange: true, networkUsed: false };
    } finally {
      if (productionDatabase) await Promise.resolve(productionDatabase.close());
      await Promise.resolve(demoDatabase.close());
    }
  });

  await check('postgresql.last-active-admin-delete', 'PostgreSQL bloqueia exclusao do ultimo admin sem ocultar historico vinculado', async () => {
    const pool = new MemoryPostgresqlPool(manifest);
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      authMode: 'production',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false,
      rebuildJourneyEntities: false
    }));
    try {
      const password = 'Horizonte!Seguro2031#Norte';
      const created = await database.createUser({
        id: 'USR-PG-ONLY-ADMIN',
        name: 'Administrador PostgreSQL Unico',
        email: 'pg-only-admin@example.com',
        role: 'admin',
        status: 'active',
        password
      });
      assert(created.ok, 'PostgreSQL nao criou o administrador unitario.');

      const blocked = await database.deleteUser(created.user.id);
      assert(blocked.status === 409 && blocked.code === 'LAST_ACTIVE_ADMIN', 'PostgreSQL permitiu excluir o ultimo administrador ativo.');
      assert(await database.findPublicUser(created.user.id), 'PostgreSQL removeu o administrador apesar do bloqueio.');

      const login = await database.login(created.user.email, password);
      assert(login.ok, 'PostgreSQL nao criou a sessao vinculada da fixture administrativa.');
      const linked = await database.deleteUser(created.user.id);
      assert(
        linked.status === 409 && linked.code === 'BANCUS_USER_HAS_RELATED_RECORDS',
        'PostgreSQL deixou LAST_ACTIVE_ADMIN ocultar o contrato de historico vinculado.'
      );
      assert(await database.findPublicUser(created.user.id), 'PostgreSQL removeu o administrador com sessao vinculada.');
      const advisoryLocks = pool.queries.filter((entry) => entry.sql.includes('pg_advisory_xact_lock')).length;
      const rowLocks = pool.queries.filter((entry) => entry.sql.includes('select * from users where id = $1 for update')).length;
      assert(advisoryLocks >= 2 && rowLocks >= 2, 'PostgreSQL deleteUser nao executou advisory lock e row lock nos dois contratos de exclusao.');
      return {
        unlinkedDelete: { status: blocked.status, code: blocked.code },
        linkedDelete: { status: linked.status, code: linked.code },
        advisoryLocks,
        rowLocks,
        userPreserved: true,
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('postgresql.last-active-admin-concurrency', 'PostgreSQL serializa duas remocoes concorrentes e preserva um admin', async () => {
    const pool = new ConcurrentAdminPostgresqlPool(manifest);
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      authMode: 'production',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false,
      rebuildJourneyEntities: false
    }));
    try {
      for (const fixture of [
        { id: 'USR-PG-ADMIN-A', name: 'Administrador PostgreSQL A', email: 'pg-admin-a@example.com' },
        { id: 'USR-PG-ADMIN-B', name: 'Administrador PostgreSQL B', email: 'pg-admin-b@example.com' }
      ]) {
        const created = await database.createUser({
          ...fixture,
          role: 'admin',
          status: 'active',
          password: 'Horizonte!Seguro2031#Norte'
        });
        assert(created.ok, `PostgreSQL nao criou fixture administrativa ${fixture.id}.`);
      }

      const attempts = await Promise.all([
        database.updateUser('USR-PG-ADMIN-A', { role: 'consultor' }).then((result) => ({ operation: 'demotion', result })),
        database.setUserStatus('USR-PG-ADMIN-B', 'inactive').then((result) => ({ operation: 'inactivation', result }))
      ]);
      const succeeded = attempts.filter((attempt) => attempt.result && attempt.result.ok);
      const blocked = attempts.filter((attempt) => attempt.result && attempt.result.code === 'LAST_ACTIVE_ADMIN');
      const activeAdmins = (await database.listUsers()).filter((user) => user.role === 'admin' && user.status === 'active');

      assert(pool.adminLockContentions === 1, `Gate PostgreSQL observou ${pool.adminLockContentions} contencoes; esperado 1.`);
      assert(pool.maxActiveAdminCriticalSections === 1, 'Advisory lock PostgreSQL permitiu duas secoes criticas simultaneas.');
      assert(succeeded.length === 1, `PostgreSQL confirmou ${succeeded.length} remocoes concorrentes; esperado 1.`);
      assert(blocked.length === 1 && blocked[0].result.status === 409, 'PostgreSQL nao bloqueou a segunda remocao com LAST_ACTIVE_ADMIN/409.');
      assert(activeAdmins.length === 1, `PostgreSQL terminou com ${activeAdmins.length} admins ativos.`);
      return {
        concurrentAttempts: attempts.map((attempt) => ({
          operation: attempt.operation,
          status: attempt.result.status,
          code: attempt.result.code || '',
          ok: attempt.result.ok
        })),
        lockContentions: pool.adminLockContentions,
        maxConcurrentCriticalSections: pool.maxActiveAdminCriticalSections,
        succeeded: succeeded[0].operation,
        blocked: blocked[0].operation,
        activeAdminIds: activeAdmins.map((user) => user.id),
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('postgresql.last-active-admin-delete-concurrency', 'PostgreSQL serializa delete contra demissao e inativacao concorrentes', async () => {
    const runScenario = async (suffix, competingMutation) => {
      const pool = new ConcurrentAdminPostgresqlPool(manifest);
      const database = await Promise.resolve(dbModule.createDatabase({
        provider: 'postgresql',
        authMode: 'production',
        databaseUrl: TEST_DATABASE_URL,
        pool,
        schemaManifest: manifest,
        seedUsers: false,
        rebuildJourneyEntities: false
      }));
      try {
        for (const fixture of [
          { id: 'USR-PG-ADMIN-A', name: 'Administrador PostgreSQL A', email: `pg-delete-a-${suffix}@example.com` },
          { id: 'USR-PG-ADMIN-B', name: 'Administrador PostgreSQL B', email: `pg-delete-b-${suffix}@example.com` }
        ]) {
          const created = await database.createUser({
            ...fixture,
            role: 'admin',
            status: 'active',
            password: 'Horizonte!Seguro2031#Norte'
          });
          assert(created.ok, `PostgreSQL nao criou fixture concorrente ${fixture.id}.`);
        }

        const attempts = await Promise.all([
          database.deleteUser('USR-PG-ADMIN-A').then((result) => ({ operation: 'delete', result })),
          (competingMutation === 'demotion'
            ? database.updateUser('USR-PG-ADMIN-B', { role: 'consultor' })
            : database.setUserStatus('USR-PG-ADMIN-B', 'inactive'))
            .then((result) => ({ operation: competingMutation, result }))
        ]);
        const succeeded = attempts.filter((attempt) => attempt.result && attempt.result.ok);
        const blocked = attempts.filter((attempt) => attempt.result && attempt.result.code === 'LAST_ACTIVE_ADMIN');
        const activeAdmins = (await database.listUsers()).filter((user) => user.role === 'admin' && user.status === 'active');
        assert(pool.adminLockContentions === 1, `Gate PostgreSQL ${suffix} observou ${pool.adminLockContentions} contencoes; esperado 1.`);
        assert(pool.maxActiveAdminCriticalSections === 1, `Advisory lock PostgreSQL ${suffix} permitiu secoes criticas simultaneas.`);
        assert(succeeded.length === 1, `PostgreSQL ${suffix} confirmou ${succeeded.length} remocoes; esperado 1.`);
        assert(blocked.length === 1 && blocked[0].result.status === 409, `PostgreSQL ${suffix} nao bloqueou a segunda remocao com LAST_ACTIVE_ADMIN/409.`);
        assert(activeAdmins.length === 1, `PostgreSQL ${suffix} terminou com ${activeAdmins.length} admins ativos.`);
        return {
          attempts: attempts.map((attempt) => ({
            operation: attempt.operation,
            status: attempt.result.status,
            code: attempt.result.code || '',
            ok: attempt.result.ok
          })),
          lockContentions: pool.adminLockContentions,
          maxConcurrentCriticalSections: pool.maxActiveAdminCriticalSections,
          activeAdminIds: activeAdmins.map((user) => user.id)
        };
      } finally {
        await Promise.resolve(database.close());
      }
    };

    return {
      deleteVsUpdate: await runScenario('update', 'demotion'),
      deleteVsStatus: await runScenario('status', 'inactivation'),
      networkUsed: false
    };
  });

  await check('postgresql.proposal-lifecycle', 'Repositorio PostgreSQL preserva ciclo completo da proposta', async () => {
    const pool = new ProposalMemoryPostgresqlPool(manifest);
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false
    }));
    try {
      const repositoryModule = require(POSTGRES_PROPOSAL_REPOSITORY_PATH);
      const ProposalShare = require(path.join(ROOT_DIR, 'js', 'proposal-share.js'));
      const ProposalSnapshot = require(path.join(ROOT_DIR, 'js', 'proposal-snapshot.js'));
      const repository = await repositoryModule.createPostgresqlProposalShareRepository({ database });
      assert(repository.provider === database.provider, 'Provider da proposta diverge do provider principal.');

      let snapshotSequence = 0;
      const service = ProposalShare.createProposalShareService({
        repository,
        clock: () => new Date('2030-01-01T12:00:00.000Z'),
        tokenFactory: () => 'A'.repeat(43),
        snapshotIdFactory: () => `PSN-PG-GATE-${String(++snapshotSequence).padStart(4, '0')}`,
        shareIdFactory: () => 'PSH-PG-GATE-0001'
      });
      const owner = { ownerId: 'USR-PG-PROPOSAL-OWNER' };
      const draft = await service.createSnapshot({
        proposalId: 'PROP-PG-GATE-0001',
        engineVersion: 'consorcio-engine.provider-gate.v1',
        dataBase: '203001',
        project: {
          objective: 'imovel',
          items: [{ groupKey: '203001|PG|GATE|1', administrator: 'Administradora Gate', creditValue: 250000 }]
        },
        result: { totalCredit: 250000, initialInstallment: 1850 },
        review: {},
        provenance: { source: 'database-provider-gate' }
      }, owner);
      const validated = await service.transitionSnapshot(
        draft.id,
        ProposalSnapshot.STATUS.VALIDATED,
        { provenance: { validationRule: 'provider-contract-v1' } },
        owner
      );
      const reviewed = await service.transitionSnapshot(
        validated.id,
        ProposalSnapshot.STATUS.REVIEWED,
        { review: { status: 'approved', reviewedAt: '2030-01-01T12:00:00.000Z' } },
        owner
      );
      const publication = await service.publish(reviewed.id, { validityDays: 30 }, owner);
      const publicView = await service.resolve(publication.token);
      const revoked = await service.revoke(publication.share.id, owner);
      let revokedResolution = null;
      try {
        await service.resolve(publication.token);
      } catch (error) {
        revokedResolution = error;
      }

      assert(draft.status === 'rascunho', 'Ciclo PG nao iniciou em rascunho.');
      assert(validated.status === 'validada', 'Ciclo PG nao transitou para validada.');
      assert(reviewed.status === 'revisada', 'Ciclo PG nao transitou para revisada.');
      assert(publication.share.status === 'ativa', 'Publicacao PG nao criou link ativo.');
      assert(publicView && publicView.readOnly === true && publicView.snapshot.status === 'publicada', 'Resolucao PG nao retornou proposta publicada read-only.');
      assert(revoked && revoked.status === 'revogada' && revoked.revokedAt, 'Revogacao PG nao persistiu estado terminal.');
      assert(revokedResolution && revokedResolution.code === 'share-revoked', 'Token PG revogado continuou resolvendo proposta.');
      const versions = await repository.listSnapshotVersions(draft.proposalId, { ownerId: owner.ownerId });
      const statuses = versions.map((item) => item.snapshot.status);
      assert(sameJson(statuses, ['rascunho', 'validada', 'revisada', 'publicada', 'revogada']), 'Linhagem PG nao preservou as cinco versoes esperadas.');
      const stats = await repository.stats();
      assert(stats.provider === 'postgresql' && stats.snapshots === 5 && stats.shares === 1 && stats.activeShares === 0, 'Stats PG de proposta nao reconciliam o ciclo.');
      assert(!Array.from(pool.proposalShares.values()).some((share) => share.token_hash === publication.token), 'Repositorio PG persistiu token em texto puro.');
      return {
        provider: database.provider,
        proposalShareProvider: repository.provider,
        providerCoherent: database.provider === repository.provider,
        statuses,
        publicResolvedBeforeRevoke: true,
        resolveAfterRevoke: 'share-revoked',
        snapshots: stats.snapshots,
        shares: stats.shares,
        activeShares: stats.activeShares,
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('postgresql.snapshot-rollback', 'Falha materializada reverte snapshot e indices PostgreSQL', async () => {
    const pool = new RollbackPostgresqlPool(manifest);
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false
    }));
    try {
      pool.failMaterializedWrite = true;
      let failure = null;
      try {
        await database.upsertSnapshot({
          id: 'SNAPSHOT-PG-ROLLBACK-GATE',
          type: 'simulation',
          ownerEmail: 'rollback-owner@example.com',
          actorEmail: 'rollback-owner@example.com',
          entityId: 'SIM-PG-ROLLBACK-GATE',
          title: 'Simulacao rollback gate',
          payload: { id: 'SIM-PG-ROLLBACK-GATE', safe: true }
        });
      } catch (error) {
        failure = error;
      }
      assert(failure && failure.code === 'PG_GATE_MATERIALIZED_FAILURE', 'Falha materializada injetada nao propagou.');
      assert(!pool.snapshots.has('SNAPSHOT-PG-ROLLBACK-GATE'), 'Rollback deixou snapshot parcial.');
      assert(!pool.journeyEntities.has('simulation:SIM-PG-ROLLBACK-GATE'), 'Rollback deixou journey_entity parcial.');
      assert(!pool.materialized.journey_simulations.has('SIM-PG-ROLLBACK-GATE'), 'Rollback deixou simulacao materializada parcial.');
      const sql = pool.queries.map((item) => item.sql);
      assert(sql.includes('begin') && sql.includes('rollback') && !sql.includes('commit'), 'Transacao PG nao executou BEGIN/ROLLBACK corretamente.');
      const providerSource = fs.readFileSync(POSTGRES_PROVIDER_PATH, 'utf8');
      assert(
        providerSource.includes('`bancus_nested_${++this.transactionSequence}`')
        && providerSource.includes('SAVEPOINT ${savepoint}'),
        'withTransaction PostgreSQL nao cria SAVEPOINT em nesting.'
      );
      assert(providerSource.includes('ROLLBACK TO SAVEPOINT'), 'withTransaction PostgreSQL nao reverte SAVEPOINT aninhado.');
      return {
        injectedFailure: 'materialized-write',
        snapshotRowsAfterRollback: 0,
        entityRowsAfterRollback: 0,
        materializedRowsAfterRollback: 0,
        begin: true,
        rollback: true,
        nestedSavepoints: true,
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  await check('postgresql.user-status-rollback', 'PostgreSQL reverte inativacao se a revogacao de sessoes falhar', async () => {
    const pool = new RollbackPostgresqlPool(manifest);
    const database = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      databaseUrl: TEST_DATABASE_URL,
      pool,
      schemaManifest: manifest,
      seedUsers: false
    }));
    try {
      const created = await database.createUser({
        id: 'USR-PG-STATUS-ROLLBACK',
        name: 'Usuario PostgreSQL Rollback',
        email: 'pg-status-rollback@example.com',
        role: 'consultor',
        status: 'active',
        password: 'Ponte!Clara2026#Sul'
      });
      assert(created.ok, 'PostgreSQL nao criou usuario para o teste transacional de status.');
      const login = await database.login('pg-status-rollback@example.com', 'Ponte!Clara2026#Sul');
      assert(login.ok && login.session && login.session.token, 'PostgreSQL nao criou sessao ativa para o teste transacional.');
      pool.failSessionRevocation = true;
      let failure = null;
      try {
        await database.setUserStatus('USR-PG-STATUS-ROLLBACK', 'inactive');
      } catch (error) {
        failure = error;
      } finally {
        pool.failSessionRevocation = false;
      }
      assert(failure && failure.code === 'PG_GATE_SESSION_REVOCATION_FAILURE', 'PostgreSQL nao propagou a falha injetada de revogacao.');
      const userAfter = await database.findPublicUser('USR-PG-STATUS-ROLLBACK');
      const contextAfter = await database.authenticateToken(login.session.token);
      assert(userAfter && userAfter.status === 'active', 'PostgreSQL nao reverteu o status apos falha na revogacao.');
      assert(contextAfter && contextAfter.user && contextAfter.user.id === userAfter.id, 'PostgreSQL revogou parcialmente a sessao apesar do rollback.');
      assert(pool.queries.some((item) => item.sql === 'rollback'), 'PostgreSQL nao executou ROLLBACK apos falha na revogacao.');
      return {
        injectedFailure: 'session-revocation',
        userStatusAfterRollback: userAfter.status,
        priorSessionStillValid: true,
        begin: true,
        rollback: true,
        networkUsed: false
      };
    } finally {
      await Promise.resolve(database.close());
    }
  });

  let mockDatabase = null;
  let mockPool = null;

  await check('postgresql.mock.initialize', 'Fixture PostgreSQL segura inicializa sem rede real', async () => {
    mockPool = new MemoryPostgresqlPool(manifest);
    mockDatabase = await Promise.resolve(dbModule.createDatabase({
      provider: 'postgresql',
      databaseUrl: TEST_DATABASE_URL,
      pool: mockPool,
      schemaManifest: manifest,
      seedUsers: false,
      rebuildJourneyEntities: false
    }));
    assert(mockDatabase && mockDatabase.provider === 'postgresql', 'Fixture nao inicializou provider postgresql.');
    assert(mockPool.queries.some((item) => item.sql === 'select 1 as ok'), 'Provider nao executou ping de conexao.');
    assert(mockPool.queries.some((item) => item.sql.includes('information_schema.tables')), 'Provider nao validou as tabelas.');
    assert(mockPool.queries.some((item) => item.sql.includes('migration_name')), 'Provider nao validou a migration ativa.');
    return { provider: mockDatabase.provider, networkUsed: false, initializationQueries: mockPool.queries.length };
  });

  await check('postgresql.api-methods', 'Provider PostgreSQL preserva metodos consumidos por /api', () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const missing = REQUIRED_DATABASE_METHODS.filter((name) => typeof mockDatabase[name] !== 'function');
    assert(!missing.length, `Provider PostgreSQL nao implementa metodos da API: ${missing.join(', ')}.`);
    return { requiredMethods: REQUIRED_DATABASE_METHODS, missing: [] };
  });

  await check('postgresql.mock.direct-create-only', 'PostgreSQL preserva a primeira gravacao no contrato createOnly', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const originalTimestamp = '2026-08-22T15:30:00.000Z';
    const original = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-CREATE-ONLY',
      ownerEmail: 'pg-create-only@example.com',
      actorEmail: 'pg-create-only@example.com',
      title: 'Registro original',
      amount: 85000,
      payload: {
        interestRequestedAt: originalTimestamp,
        timeline: [{ id: 'TL-PG-CREATE-ONLY', createdAt: originalTimestamp }]
      },
      createdAt: originalTimestamp,
      updatedAt: originalTimestamp
    }, { createOnly: true });
    const repeated = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-CREATE-ONLY',
      ownerEmail: 'pg-create-only@example.com',
      actorEmail: 'pg-create-only@example.com',
      title: 'Tentativa de sobrescrita',
      amount: 999999,
      payload: {
        interestRequestedAt: '2026-08-22T15:31:00.000Z',
        timeline: [{ id: 'TL-DUPLICATE' }, { id: 'TL-DUPLICATE-2' }]
      }
    }, { createOnly: true });
    const takeover = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-CREATE-ONLY',
      ownerEmail: 'pg-create-only-takeover@example.com',
      actorEmail: 'pg-create-only-takeover@example.com',
      payload: { unsafe: true }
    }, { createOnly: true });
    assert(original.ok && original.created === true, 'PostgreSQL nao marcou a criacao atomica original.');
    assert(repeated.ok && repeated.created === false, 'PostgreSQL nao reconheceu a repeticao createOnly.');
    assert(repeated.lead.title === 'Registro original' && repeated.lead.amount === 85000, 'PostgreSQL sobrescreveu campos do registro original.');
    assert(repeated.lead.payload.interestRequestedAt === originalTimestamp, 'PostgreSQL alterou requestedAt original.');
    assert(repeated.lead.payload.timeline.length === 1, 'PostgreSQL duplicou o evento original.');
    assert(takeover.ok === false && takeover.status === 409, 'PostgreSQL createOnly nao bloqueou takeover de owner.');
    const createOnlyQueries = mockPool.queries.filter((item) => item.sql.includes('on conflict(kind, id) do nothing'));
    assert(createOnlyQueries.length === 3, 'PostgreSQL nao usou INSERT ... DO NOTHING em todas as tentativas createOnly.');
    return {
      createdFlags: [original.created, repeated.created],
      requestedAt: repeated.lead.payload.interestRequestedAt,
      timelineEvents: repeated.lead.payload.timeline.length,
      createOnlyQueries: createOnlyQueries.length,
      takeover: 'blocked-409',
      networkUsed: false
    };
  });

  await check('postgresql.mock.crud', 'CRUD minimo funciona no provider PostgreSQL injetado', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const created = await mockDatabase.createUser({
      id: 'USR-PG-GATE',
      name: 'Usuario PostgreSQL Gate',
      email: 'provider-gate@example.com',
      role: 'consultor',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0000',
      password: 'Ponte!Clara2026#Sul'
    });
    assert(created.ok && created.user && created.user.id === 'USR-PG-GATE', 'CREATE de usuario falhou no mock PostgreSQL.');
    assert(!Object.prototype.hasOwnProperty.call(created.user, 'password_hash'), 'CREATE retornou password_hash.');
    const read = await mockDatabase.findPublicUser('USR-PG-GATE');
    assert(read && read.email === 'provider-gate@example.com', 'READ de usuario falhou no mock PostgreSQL.');
    const updated = await mockDatabase.updateUser('USR-PG-GATE', {
      name: 'Usuario PostgreSQL Atualizado',
      email: 'provider-gate@example.com',
      role: 'consultor',
      status: 'active',
      department: 'Validacao',
      phone: '(00) 00000-0001'
    });
    assert(updated.ok && updated.user && updated.user.name === 'Usuario PostgreSQL Atualizado', 'UPDATE de usuario falhou no mock PostgreSQL.');
    const inactive = await mockDatabase.setUserStatus('USR-PG-GATE', 'inactive');
    assert(inactive.ok && inactive.user.status === 'inactive', 'PostgreSQL nao inativou usuario com status valido.');
    const invalidStatus = await mockDatabase.setUserStatus('USR-PG-GATE', 'enabled');
    assert(invalidStatus.ok === false && invalidStatus.status === 400, 'PostgreSQL aceitou status desconhecido.');
    assert(mockPool.users.get('USR-PG-GATE')?.status === 'inactive', 'Status desconhecido reativou usuario PostgreSQL.');
    const active = await mockDatabase.setUserStatus('USR-PG-GATE', 'active');
    assert(active.ok && active.user.status === 'active', 'PostgreSQL nao reativou usuario com status valido.');
    const deleted = await mockDatabase.deleteUser('USR-PG-GATE');
    assert(deleted.ok, 'DELETE de usuario falhou no mock PostgreSQL.');
    const afterDelete = await mockDatabase.findPublicUser('USR-PG-GATE');
    assert(afterDelete === null, 'DELETE nao removeu o usuario no mock PostgreSQL.');
    return { create: true, read: true, update: true, delete: true, networkUsed: false };
  });

  await check('postgresql.mock.snapshot-payload-boundary', 'PostgreSQL preserva snapshot grande e rejeita somente acima de 4 MiB', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    assert(dbModule.MAX_EVENT_PAYLOAD_CHARS === 50000, 'Contrato MAX_EVENT_PAYLOAD_CHARS deixou de ser 50.000.');
    assert(
      dbModule.MAX_PERSISTED_PAYLOAD_CHARS === 4 * 1024 * 1024,
      'Contrato MAX_PERSISTED_PAYLOAD_CHARS deixou de ser 4 MiB.'
    );
    const payload = makeOversizedSafePayload();
    const expectedPayload = dbModule.sanitizePersistedPayload(payload);
    const expectedJson = JSON.stringify(expectedPayload);
    assert(expectedJson.length > dbModule.MAX_EVENT_PAYLOAD_CHARS, 'Fixture PG de snapshot nao ultrapassou o limite de eventos.');
    const created = await mockDatabase.upsertSnapshot({
      id: 'SNAPSHOT-PG-PAYLOAD-80K',
      type: 'simulation',
      ownerEmail: 'payload-pg@example.com',
      actorEmail: 'payload-pg@example.com',
      title: 'Snapshot multigrupo grande PG',
      payload
    });
    assert(created && created.snapshot, 'PostgreSQL nao criou o snapshot grande dentro do limite.');
    assert(JSON.stringify(created.snapshot.payload) === expectedJson, 'PostgreSQL truncou ou alterou o snapshot grande na escrita.');
    const persisted = (await mockDatabase.listSnapshots({
      ownerEmail: 'payload-pg@example.com',
      type: 'simulation',
      limit: 20
    })).find((item) => item.id === 'SNAPSHOT-PG-PAYLOAD-80K');
    assert(persisted && JSON.stringify(persisted.payload) === expectedJson, 'PostgreSQL nao releu integralmente o snapshot grande.');

    const oversizedPayload = makeSafePayloadLargerThan(dbModule.MAX_PERSISTED_PAYLOAD_CHARS);
    const sanitizedOversizedLength = JSON.stringify(dbModule.sanitizePersistedPayload(oversizedPayload)).length;
    assert(sanitizedOversizedLength > dbModule.MAX_PERSISTED_PAYLOAD_CHARS, 'Fixture PostgreSQL nao excedeu 4 MiB apos sanitizacao.');
    const failure = await expectPayloadTooLarge(() => mockDatabase.upsertSnapshot({
      id: 'SNAPSHOT-PG-PAYLOAD-OVER-LIMIT',
      type: 'simulation',
      ownerEmail: 'payload-pg@example.com',
      payload: oversizedPayload
    }), 'Snapshot PostgreSQL acima de 4 MiB');
    assert(!mockPool.snapshots.has('SNAPSHOT-PG-PAYLOAD-OVER-LIMIT'), 'PostgreSQL deixou snapshot parcial apos rejeitar payload grande.');
    return {
      eventLimitChars: dbModule.MAX_EVENT_PAYLOAD_CHARS,
      persistedLimitChars: dbModule.MAX_PERSISTED_PAYLOAD_CHARS,
      preservedPayloadChars: expectedJson.length,
      preservedExactly: true,
      rejectedPayloadChars: sanitizedOversizedLength,
      rejection: failure,
      partialRowsAfterRejection: 0,
      networkUsed: false
    };
  });

  await check('postgresql.mock.identity-guards', 'PostgreSQL migra identidade e preserva usuario vinculado', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const userEmail = 'pg-linked-user@example.com';
    const created = await mockDatabase.createUser({
      id: 'USR-PG-LINKED',
      name: 'Usuario PostgreSQL Vinculado',
      email: userEmail,
      role: 'consultor',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0000',
      password: 'Ponte!Clara2026#Sul'
    });
    assert(created.ok, 'Mock PostgreSQL nao criou usuario vinculado.');
    const lead = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-LINKED-USER',
      ownerEmail: userEmail,
      actorEmail: userEmail,
      title: 'Lead vinculado ao usuario PostgreSQL',
      payload: { safe: true }
    });
    assert(lead.ok, 'Mock PostgreSQL nao criou historico vinculado ao usuario.');
    await mockDatabase.upsertDirectJourneyRow('simulation', {
      id: 'SIM-PG-LINKED-USER',
      ownerEmail: userEmail,
      actorEmail: userEmail,
      title: 'Simulacao vinculada',
      payload: { safe: true }
    });
    await mockDatabase.upsertDirectJourneyRow('proposal', {
      id: 'PROP-PG-LINKED-USER',
      ownerEmail: userEmail,
      actorEmail: userEmail,
      title: 'Proposta vinculada',
      payload: { safe: true }
    });
    await mockDatabase.recordEvent({
      id: 'EVT-PG-LINKED-USER',
      type: 'identity-migration-gate',
      ownerEmail: userEmail,
      actorEmail: userEmail,
      payload: { safe: true }
    });
    await mockDatabase.upsertSnapshot({
      id: 'SNAPSHOT-PG-LINKED-USER',
      type: 'identity-migration-gate',
      ownerEmail: userEmail,
      actorEmail: userEmail,
      title: 'Snapshot de identidade PG',
      payload: { safe: true }
    });
    const duplicateEmail = 'pg-duplicate-target@example.com';
    const duplicateUser = await mockDatabase.createUser({
      id: 'USR-PG-DUPLICATE',
      name: 'Usuario PostgreSQL Duplicado',
      email: duplicateEmail,
      role: 'cliente',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0002',
      password: 'Ponte!Clara2026#Sul'
    });
    assert(duplicateUser.ok, 'Mock PostgreSQL nao criou usuario de e-mail duplicado.');
    const migratedEmail = 'pg-migrated@example.com';
    const emailMutation = await mockDatabase.updateUser('USR-PG-LINKED', {
      name: 'Usuario PostgreSQL Vinculado',
      email: migratedEmail,
      role: 'consultor',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0000'
    });
    assert(emailMutation.ok && emailMutation.user && emailMutation.user.email === migratedEmail, 'PostgreSQL nao migrou e-mail do usuario.');
    const domainChecks = [
      ['lead', 'LEAD-PG-LINKED-USER', mockDatabase.listLeads.bind(mockDatabase)],
      ['simulation', 'SIM-PG-LINKED-USER', mockDatabase.listSimulations.bind(mockDatabase)],
      ['proposal', 'PROP-PG-LINKED-USER', mockDatabase.listProposals.bind(mockDatabase)]
    ];
    for (const [kind, id, list] of domainChecks) {
      const migrated = await list({ ownerEmail: migratedEmail, limit: 20 });
      const inherited = await list({ ownerEmail: userEmail, limit: 20 });
      const item = migrated.find((row) => row.id === id);
      assert(item && item.ownerEmail === migratedEmail && item.actorEmail === migratedEmail, `PostgreSQL nao migrou owner/actor de ${kind}.`);
      assert(!inherited.some((row) => row.id === id), `E-mail antigo herdou ${kind} depois da migracao PostgreSQL.`);
    }
    const migratedEntities = await mockDatabase.listJourneyEntities({ ownerEmail: migratedEmail, limit: 50 });
    const oldEntities = await mockDatabase.listJourneyEntities({ ownerEmail: userEmail, limit: 50 });
    assert(migratedEntities.filter((item) => ['LEAD-PG-LINKED-USER', 'SIM-PG-LINKED-USER', 'PROP-PG-LINKED-USER'].includes(item.id)).length === 3, 'PostgreSQL nao migrou journey_entities.');
    assert(!oldEntities.some((item) => ['LEAD-PG-LINKED-USER', 'SIM-PG-LINKED-USER', 'PROP-PG-LINKED-USER'].includes(item.id)), 'E-mail antigo herdou journey_entities.');
    const migratedSnapshots = await mockDatabase.listSnapshots({ ownerEmail: migratedEmail, type: 'identity-migration-gate', limit: 20 });
    const oldSnapshots = await mockDatabase.listSnapshots({ ownerEmail: userEmail, type: 'identity-migration-gate', limit: 20 });
    assert(migratedSnapshots.some((item) => item.id === 'SNAPSHOT-PG-LINKED-USER' && item.actorEmail === migratedEmail), 'PostgreSQL nao migrou snapshot.');
    assert(!oldSnapshots.some((item) => item.id === 'SNAPSHOT-PG-LINKED-USER'), 'E-mail antigo herdou snapshot PostgreSQL.');
    const migratedEvent = (await mockDatabase.listEvents({ limit: 100 })).find((item) => item.id === 'EVT-PG-LINKED-USER');
    assert(migratedEvent && migratedEvent.ownerEmail === migratedEmail && migratedEvent.actorEmail === migratedEmail, 'PostgreSQL nao migrou evento.');
    const duplicateMutation = await mockDatabase.updateUser('USR-PG-LINKED', {
      name: 'Usuario PostgreSQL Vinculado',
      email: duplicateEmail,
      role: 'consultor',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0000'
    });
    assert(duplicateMutation.ok === false && duplicateMutation.status === 409, 'PostgreSQL permitiu colisao de e-mail destino.');
    assert(duplicateMutation.code === 'BANCUS_USER_EMAIL_CONFLICT', 'PostgreSQL nao retornou BANCUS_USER_EMAIL_CONFLICT.');
    assert((await mockDatabase.findPublicUser('USR-PG-LINKED')).email === migratedEmail, 'Colisao PostgreSQL alterou identidade parcialmente.');
    const linkedDelete = await mockDatabase.deleteUser('USR-PG-LINKED');
    assert(linkedDelete.ok === false && linkedDelete.status === 409, 'PostgreSQL excluiu usuario com historico vinculado.');
    assert(linkedDelete.code === 'BANCUS_USER_HAS_RELATED_RECORDS', 'PostgreSQL nao retornou codigo de delete vinculado.');
    assert(/inativ/i.test(linkedDelete.message), 'PostgreSQL nao orienta inativacao no conflito de delete.');
    assert(await mockDatabase.findPublicUser('USR-PG-LINKED'), 'PostgreSQL removeu usuario vinculado apesar do conflito.');
    return {
      emailMigration: 'committed-atomically',
      migratedTables: ['events', 'snapshots', 'journey_entities', 'journey_leads', 'journey_simulations', 'journey_proposals'],
      duplicateEmail: 'blocked-409',
      oldEmailInheritedRecords: 0,
      linkedDelete: 'blocked-409'
    };
  });

  await check('postgresql.mock.password-session-revocation', 'Reset de senha PostgreSQL invalida sessoes anteriores', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const created = await mockDatabase.createUser({
      id: 'USR-PG-PASSWORD-RESET',
      name: 'Usuario Reset PostgreSQL',
      email: 'pg-password-reset@example.com',
      role: 'cliente',
      status: 'active',
      department: 'QA',
      phone: '(00) 00000-0003',
      password: 'Ponte!Clara2026#Sul'
    });
    assert(created.ok, 'Mock PostgreSQL nao criou usuario para reset.');
    const session = await mockDatabase.createSession(created.user);
    const beforeReset = await mockDatabase.authenticateToken(session.token);
    assert(beforeReset && beforeReset.user && beforeReset.user.id === created.user.id, 'Token PostgreSQL nao autenticava antes do reset.');
    const reset = await mockDatabase.setPassword(created.user.id, 'Horizonte!Vivo2027#Norte');
    assert(reset.ok, 'Reset de senha PostgreSQL falhou.');
    const afterReset = await mockDatabase.authenticateToken(session.token);
    assert(afterReset === null, 'Token PostgreSQL anterior continuou valido apos reset.');
    return { tokenValidBeforeReset: true, tokenValidAfterReset: false, revokedAtomically: true };
  });

  await check('postgresql.mock.owner-scope', 'Owner scope impede vazamento entre carteiras', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const ownerA = 'owner-a@example.com';
    const ownerB = 'owner-b@example.com';
    const leadA = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-A',
      ownerEmail: ownerA,
      title: 'Lead A',
      status: 'novo',
      payload: { safeLabel: 'A' }
    });
    const leadB = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-B',
      ownerEmail: ownerB,
      title: 'Lead B',
      status: 'novo',
      payload: { safeLabel: 'B' }
    });
    assert(leadA.ok && leadB.ok, 'Fixture nao criou os dois leads de escopo.');
    const scopedA = await mockDatabase.listLeads({ ownerEmail: ownerA, limit: 20 });
    const scopedB = await mockDatabase.listLeads({ ownerEmail: ownerB, limit: 20 });
    assert(scopedA.length === 1 && scopedA[0].id === 'LEAD-PG-A', 'Owner A recebeu registro incorreto.');
    assert(scopedB.length === 1 && scopedB[0].id === 'LEAD-PG-B', 'Owner B recebeu registro incorreto.');
    assert(!scopedA.some((item) => item.ownerEmail === ownerB), 'Owner A recebeu registro do owner B.');
    assert(!scopedB.some((item) => item.ownerEmail === ownerA), 'Owner B recebeu registro do owner A.');
    const takeoverB = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-B',
      ownerEmail: ownerA,
      title: 'Tentativa de takeover PG por A',
      status: 'qualificado',
      payload: { safeLabel: 'takeover-a' }
    });
    assert(takeoverB && takeoverB.ok === false && takeoverB.status === 409, 'Mock PostgreSQL nao recusou takeover de lead com 409.');
    assert(takeoverB.code === 'BANCUS_OWNER_CONFLICT', 'Mock PostgreSQL nao retornou BANCUS_OWNER_CONFLICT.');
    assert(!takeoverB.lead && !takeoverB.record, 'Conflito PostgreSQL retornou registro de outro owner.');
    const bAfterTakeover = await mockDatabase.findMaterializedJourneyRow('lead', 'LEAD-PG-B', { ownerEmail: ownerB });
    const bLeakedToA = await mockDatabase.findMaterializedJourneyRow('lead', 'LEAD-PG-B', { ownerEmail: ownerA });
    assert(bAfterTakeover && bAfterTakeover.title === 'Lead B', 'Takeover PostgreSQL alterou o lead de B.');
    assert(bAfterTakeover.payload && bAfterTakeover.payload.safeLabel === 'B', 'Takeover PostgreSQL alterou payload de B.');
    assert(bLeakedToA === null, 'Lead PostgreSQL de B passou a aparecer para A.');

    const snapshotId = 'SNAPSHOT-PG-OWNER-GATE';
    const snapshotA = await mockDatabase.upsertSnapshot({
      id: snapshotId,
      type: 'owner-scope-gate',
      ownerEmail: ownerA,
      title: 'Snapshot PG original A',
      payload: { safeLabel: 'snapshot-pg-a' }
    });
    assert(snapshotA && snapshotA.created, 'Mock PostgreSQL nao criou snapshot de A.');
    const takeoverSnapshot = await mockDatabase.upsertSnapshot({
      id: snapshotId,
      type: 'owner-scope-gate',
      ownerEmail: ownerB,
      title: 'Takeover snapshot PG por B',
      payload: { safeLabel: 'snapshot-pg-b' }
    });
    assert(takeoverSnapshot && takeoverSnapshot.ok === false && takeoverSnapshot.status === 409, 'Mock PostgreSQL nao recusou takeover de snapshot.');
    assert(takeoverSnapshot.code === 'BANCUS_OWNER_CONFLICT', 'Snapshot PG nao retornou BANCUS_OWNER_CONFLICT.');
    assert(!takeoverSnapshot.snapshot, 'Conflito de snapshot PG retornou snapshot de outro owner.');
    const pgSnapshotsA = await mockDatabase.listSnapshots({ ownerEmail: ownerA, type: 'owner-scope-gate', limit: 20 });
    const pgSnapshotsB = await mockDatabase.listSnapshots({ ownerEmail: ownerB, type: 'owner-scope-gate', limit: 20 });
    const pgSnapshotAfter = pgSnapshotsA.find((item) => item.id === snapshotId);
    assert(pgSnapshotAfter && pgSnapshotAfter.title === 'Snapshot PG original A', 'Takeover alterou snapshot PostgreSQL original.');
    assert(pgSnapshotAfter.payload && pgSnapshotAfter.payload.safeLabel === 'snapshot-pg-a', 'Takeover alterou payload do snapshot PostgreSQL.');
    assert(!pgSnapshotsB.some((item) => item.id === snapshotId), 'Snapshot PostgreSQL de A vazou para B.');
    const updated = await mockDatabase.upsertDirectJourneyRow('lead', {
      id: 'LEAD-PG-A',
      ownerEmail: ownerA,
      title: 'Lead A atualizado',
      status: 'qualificado',
      payload: { safeLabel: 'A2' }
    });
    assert(updated.ok && !updated.created && updated.lead.status === 'qualificado', 'Atualizacao do lead nao preservou owner scope.');
    return {
      ownerAIds: scopedA.map((item) => item.id),
      ownerBIds: scopedB.map((item) => item.id),
      leadTakeover: 'blocked-409',
      snapshotTakeover: 'blocked-409',
      ownerAndPayloadPreserved: true,
      crossOwnerLeaks: 0
    };
  });

  await check('postgresql.mock.sanitization', 'Payloads PostgreSQL removem dados sensiveis', async () => {
    assert(mockDatabase, 'Fixture PostgreSQL nao esta disponivel.');
    const event = await mockDatabase.recordEvent({
      id: 'EVT-PG-SANITIZE',
      type: 'provider-gate-sanitize',
      source: 'provider-gate',
      ownerEmail: 'owner-a@example.com',
      payload: {
        safeAmount: 100,
        password: SECRET_SENTINEL,
        token: SECRET_SENTINEL,
        cpf: '000.000.000-00',
        phone: '(00) 00000-0000',
        nested: { senha: SECRET_SENTINEL, safe: true }
      }
    });
    const persisted = (await mockDatabase.listEvents({ limit: 20 })).find((item) => item.id === event.id);
    assert(persisted, 'Evento sanitizado nao foi relido do provider.');
    assert(persisted.payload.safeAmount === 100, 'Campo seguro foi removido indevidamente.');
    assert(persisted.payload.nested && persisted.payload.nested.safe === true, 'Campo aninhado seguro nao foi preservado.');
    const findings = collectSensitiveKeys(persisted.payload);
    assert(!findings.length, `Payload persistido reteve chaves sensiveis: ${findings.join(', ')}.`);
    assert(!JSON.stringify(persisted).includes(SECRET_SENTINEL), 'Payload persistido reteve a sentinela secreta.');
    const largeEvent = await mockDatabase.recordEvent({
      id: 'EVT-PG-LARGE-JSON',
      type: 'large-json-gate',
      payload: makeOversizedSafePayload()
    });
    assert(largeEvent.payload && largeEvent.payload.truncated === true, 'PostgreSQL nao retornou envelope truncated para payload grande.');
    assert(largeEvent.payload.originalLength > largeEvent.payload.maxLength, 'Envelope PostgreSQL nao informa limite coerente.');
    assert(JSON.parse(JSON.stringify(largeEvent.payload)).truncated === true, 'Envelope PostgreSQL deixou de ser JSON parseavel.');
    return {
      eventId: persisted.id,
      preservedSafeFields: ['safeAmount', 'nested.safe'],
      sensitiveFindings: [],
      largeJsonEnvelope: {
        truncated: true,
        originalLength: largeEvent.payload.originalLength,
        maxLength: largeEvent.payload.maxLength,
        parseable: true
      }
    };
  });

  await check('api.bfbackendapi-contract', 'BFBackendApi preserva fachada, verbos e caminhos', async () => {
    const { api, captured } = evaluateBackendApi();
    assert(api && typeof api === 'object', 'backend-api.service.js nao publicou window.BFBackendApi.');
    const actualKeys = Object.keys(api).sort();
    assert(sameJson(actualKeys, EXPECTED_BACKEND_API_KEYS), 'A superficie publica de BFBackendApi mudou.');
    await exerciseBackendApi(api);
    const actualCalls = captured.map((item) => [item.method, item.path]);
    assert(sameJson(actualCalls, EXPECTED_API_CALLS), 'Verbos ou caminhos usados por BFBackendApi mudaram.');
    const publicProposalCall = captured.at(-1);
    assert(
      publicProposalCall.path === '/api/public/proposals/resolve'
      && publicProposalCall.method === 'POST'
      && publicProposalCall.body?.token === 'public-token',
      'BFBackendApi nao envia o token publico no corpo POST esperado.'
    );
    assert(!publicProposalCall.path.includes('public-token'), 'BFBackendApi voltou a expor o token publico na URL.');
    return {
      publicKeys: actualKeys.length,
      exercisedCalls: actualCalls.length,
      calls: actualCalls,
      publicProposalTokenTransport: 'POST JSON body'
    };
  });

  await check('api.http-owner-isolation', 'HTTP real bloqueia takeover A/B sem alterar owner ou payload', () => (
    runHttpOwnerIsolationScenario()
  ));

  await check('api.http-static-boundary', 'HTTP publica assets da aplicacao sem expor runtime ou codigo interno', () => (
    runHttpStaticBoundaryScenario()
  ));

  await check('api.http-utf8-payload-boundary', 'HTTP mede bytes UTF-8, responde 413 JSON e nao grava parcialmente', () => (
    runHttpUtf8PayloadBoundaryScenario()
  ));

  await check('api.audit-best-effort', 'Falha de auditoria nao desfaz nem mascara a operacao principal', () => (
    runAuditBestEffortScenario()
  ));

  await check('api.server-contract', 'Rotas /api preservam semantica publica', () => serverApiSurfaceEvidence());

  await check('security.no-provider-credentials', 'Codigo do provider nao contem credenciais nem loga URL', () => {
    const result = providerCredentialFindings();
    assert(!result.findings.length, `Foram encontrados ${result.findings.length} possiveis segredos na camada de provider.`);
    const postgresSource = fs.readFileSync(POSTGRES_PROVIDER_PATH, 'utf8');
    const serverSource = fs.readFileSync(SERVER_PATH, 'utf8');
    assert(postgresSource.includes('process.env.BANCUS_DATABASE_URL'), 'Provider PostgreSQL nao consome BANCUS_DATABASE_URL por ambiente.');
    assert(postgresSource.includes('redactConnectionDetails'), 'Provider PostgreSQL nao expoe sanitizacao de erros.');
    assert(serverSource.includes('sanitizeInfrastructureError'), 'server.js nao sanitiza falhas de infraestrutura.');
    assert(serverSource.includes('[database-url-redacted]'), 'server.js nao possui marcador de redacao de URL.');
    const envExample = fs.readFileSync(path.join(ROOT_DIR, '.env.example'), 'utf8');
    const gitignore = fs.readFileSync(path.join(ROOT_DIR, '.gitignore'), 'utf8');
    assert(/^BANCUS_DATABASE_URL=\s*$/m.test(envExample), '.env.example contem URL PostgreSQL preenchida.');
    assert(/^\.env\.\*\s*$/m.test(gitignore) && /^!\.env\.example\s*$/m.test(gitignore), '.gitignore nao protege variantes .env preservando apenas o exemplo.');
    return { scannedFiles: result.files, credentialFindings: [] };
  });

  if (mockDatabase) {
    try {
      await Promise.resolve(mockDatabase.close());
    } catch (error) {
      gaps.push({ id: 'postgresql.mock.close', message: redact(error.message) });
    }
  }

  gaps.push({
    id: 'postgresql.external-integration',
    status: 'PENDING',
    blocking: false,
    message: 'Gate executado com pools injetados e HTTP local; conexao, migration e CRUD contra uma instancia PostgreSQL externa nao foram executados neste ambiente.'
  });
}

async function finish() {
  try {
    await run();
  } catch (error) {
    checks.push({
      id: 'gate.fatal',
      title: 'Execucao integral do gate',
      status: 'FAIL',
      durationMs: 0,
      error: safeError(error)
    });
  } finally {
    restoreEnvironment();
    if (temporaryDirectory) {
      try {
        fs.rmSync(temporaryDirectory, { recursive: true, force: true });
      } catch (error) {
        gaps.push({ id: 'cleanup.temp-directory', message: redact(error.message) });
      }
    }

    const passed = checks.filter((item) => item.status === 'PASS').length;
    const failed = checks.filter((item) => item.status === 'FAIL').length;
    const report = {
      schema: 'bancus.database-provider-gate.v1',
      phase: '8AO / P3.3B',
      generatedAt: new Date().toISOString(),
      status: failed === 0 ? 'PASS' : 'FAIL',
      runtime: {
        node: process.version,
        platform: process.platform,
        realPostgresqlConnectionUsed: false,
        reportPath: path.relative(ROOT_DIR, REPORT_PATH).replace(/\\/g, '/')
      },
      summary: {
        total: checks.length,
        passed,
        failed,
        gaps: gaps.length
      },
      checks,
      gaps
    };

    fs.mkdirSync(path.dirname(REPORT_PATH), { recursive: true });
    fs.writeFileSync(REPORT_PATH, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

    for (const item of checks) {
      const suffix = item.status === 'FAIL' ? ` - ${item.error.message}` : '';
      console.log(`${item.status} ${item.id}${suffix}`);
    }
    console.log(`Database provider gate: ${report.status} (${passed}/${checks.length})`);
    console.log(`Report: ${REPORT_PATH}`);
    if (failed) process.exitCode = 1;
  }
}

await finish();
