import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];
const warnings = [];
const dbPath = path.join(root, '.runtime', `validator-migrations-${process.pid}.sqlite`);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fs.rm(`${dbPath}${suffix}`, { force: true });
    } catch {
      warnings.push(`Nao foi possivel remover ${path.basename(dbPath)}${suffix}.`);
    }
  }
}

const {
  createDatabase,
  SCHEMA_VERSION,
  DEFAULT_DB_PROVIDER,
  SUPPORTED_DB_PROVIDERS,
  FUTURE_DB_PROVIDERS,
  SCHEMA_MIGRATIONS_DIR,
  SCHEMA_MANIFEST_PATH
} = require('../js/backend/db.js');

const manifestRelativePath = 'js/backend/migrations/schema-manifest.json';
const migrationRelativePath = 'js/backend/migrations/001_bancus_fraternis_local_db.sql';
const rollbackRelativePath = 'js/backend/migrations/001_bancus_fraternis_local_db.rollback.sql';

assert(await exists(manifestRelativePath), 'Manifest de schema ausente.');
assert(await exists(migrationRelativePath), 'Migration baseline ausente.');
assert(await exists(rollbackRelativePath), 'Rollback da migration baseline ausente.');
assert(String(SCHEMA_MIGRATIONS_DIR).endsWith(path.join('js', 'backend', 'migrations')), 'db.js nao exporta SCHEMA_MIGRATIONS_DIR coerente.');
assert(String(SCHEMA_MANIFEST_PATH).endsWith(path.join('js', 'backend', 'migrations', 'schema-manifest.json')), 'db.js nao exporta SCHEMA_MANIFEST_PATH coerente.');

const [
  manifestText,
  migrationSql,
  rollbackSql,
  dbJs,
  localDatabaseDoc,
  backendPlan,
  nextPhases,
  contracts,
  actionPlan,
  changelog,
  designValidator,
  publicContractsValidator,
  localDatabaseValidator
] = await Promise.all([
  read(manifestRelativePath),
  read(migrationRelativePath),
  read(rollbackRelativePath),
  read('js/backend/db.js'),
  read('docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md'),
  read('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'),
  read('docs/PROXIMAS_FASES_BANK_FRATERN.md'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/CHANGELOG.md'),
  read('tools/validate-design-system.mjs'),
  read('tools/validate-public-contracts.mjs'),
  read('tools/validate-local-database.mjs')
]);

let manifest = {};
try {
  manifest = JSON.parse(manifestText);
} catch (error) {
  assert(false, `Manifest de schema nao e JSON valido: ${error.message}`);
}

assert(manifest.schemaVersion === SCHEMA_VERSION, 'Manifest nao preserva SCHEMA_VERSION atual.');
assert(manifest.provider === DEFAULT_DB_PROVIDER, 'Manifest nao preserva provider padrao.');
assert(Array.isArray(manifest.pilotProviders) && manifest.pilotProviders.includes('postgresql'), 'Manifest nao registra postgresql como provider piloto.');
assert(Array.isArray(SUPPORTED_DB_PROVIDERS) && SUPPORTED_DB_PROVIDERS.includes('sqlite') && SUPPORTED_DB_PROVIDERS.includes('postgresql'), 'db.js deveria suportar sqlite e o piloto postgresql.');
assert(Array.isArray(FUTURE_DB_PROVIDERS) && !FUTURE_DB_PROVIDERS.includes('postgresql'), 'db.js nao deveria manter postgresql como provider futuro depois da implementacao.');
assert(manifest.currentMigration === path.basename(migrationRelativePath), 'Manifest nao aponta para a migration baseline.');
assert(manifest.rollback === path.basename(rollbackRelativePath), 'Manifest nao aponta para rollback baseline.');
assert(manifest.passwordAlgorithm === 'scrypt-sha256', 'Manifest nao documenta algoritmo de senha atual.');

[
  'PRAGMA journal_mode = WAL',
  'PRAGMA foreign_keys = ON',
  'CREATE TABLE IF NOT EXISTS users',
  'CREATE TABLE IF NOT EXISTS sessions',
  'CREATE TABLE IF NOT EXISTS events',
  'CREATE TABLE IF NOT EXISTS snapshots',
  'CREATE TABLE IF NOT EXISTS journey_entities',
  'CREATE TABLE IF NOT EXISTS journey_leads',
  'CREATE TABLE IF NOT EXISTS journey_simulations',
  'CREATE TABLE IF NOT EXISTS journey_proposals'
].forEach((marker) => assert(migrationSql.includes(marker), `Migration baseline sem marcador ${marker}.`));

[
  'BEGIN TRANSACTION',
  'DROP TABLE IF EXISTS journey_proposals',
  'DROP TABLE IF EXISTS journey_simulations',
  'DROP TABLE IF EXISTS journey_leads',
  'DROP TABLE IF EXISTS journey_entities',
  'DROP TABLE IF EXISTS snapshots',
  'DROP TABLE IF EXISTS events',
  'DROP TABLE IF EXISTS sessions',
  'DROP TABLE IF EXISTS users',
  'COMMIT'
].forEach((marker) => assert(rollbackSql.includes(marker), `Rollback baseline sem marcador ${marker}.`));

const tables = Array.isArray(manifest.tables) ? manifest.tables : [];
assert(tables.length === 8, `Manifest deveria declarar 8 tabelas; declarou ${tables.length}.`);

for (const table of tables) {
  assert(table.name && migrationSql.includes(`CREATE TABLE IF NOT EXISTS ${table.name}`), `Migration sem tabela do manifest: ${table.name}.`);
  assert(Array.isArray(table.columns) && table.columns.length > 0, `Manifest sem colunas para ${table.name}.`);
  for (const column of table.columns || []) {
    assert(migrationSql.includes(column), `Migration de ${table.name} nao contem coluna ${column}.`);
  }
  for (const indexName of table.indexes || []) {
    assert(migrationSql.includes(`CREATE INDEX IF NOT EXISTS ${indexName}`), `Migration sem indice ${indexName}.`);
  }
}

for (const field of manifest.sensitiveFields || []) {
  assert(migrationSql.includes(field), `Campo sensivel do manifest nao aparece na migration: ${field}.`);
}

await cleanup();
const localDb = createDatabase({ dbPath });

try {
  const actualTables = localDb.db.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'table'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC
  `).all().map((row) => row.name);
  const actualIndexes = localDb.db.prepare(`
    SELECT name
    FROM sqlite_schema
    WHERE type = 'index'
      AND name NOT LIKE 'sqlite_%'
    ORDER BY name ASC
  `).all().map((row) => row.name);

  for (const table of tables) {
    assert(actualTables.includes(table.name), `Banco real nao criou tabela ${table.name}.`);
    const columns = localDb.db.prepare(`PRAGMA table_info("${table.name}")`).all().map((row) => row.name);
    for (const column of table.columns || []) {
      assert(columns.includes(column), `Banco real sem coluna ${table.name}.${column}.`);
    }
    for (const indexName of table.indexes || []) {
      assert(actualIndexes.includes(indexName), `Banco real sem indice ${indexName}.`);
    }
  }

  const status = localDb.databaseStatus();
  assert(status.ok && status.schemaVersion === manifest.schemaVersion, 'databaseStatus nao reflete versao do manifest.');
  assert(status.provider === 'sqlite', 'databaseStatus nao preserva provider sqlite.');
  assert(status.sqlite && status.sqlite.foreignKeys === true, 'Banco real nao ativou foreign_keys.');
  assert(status.tables.length === tables.length, 'Status tecnico nao lista as 8 tabelas do manifest.');
} finally {
  localDb.close();
  await cleanup();
}

[
  'SCHEMA_MIGRATIONS_DIR',
  'SCHEMA_MANIFEST_PATH'
].forEach((marker) => assert(dbJs.includes(marker), `db.js sem export/constante ${marker}.`));

[
  'js/backend/migrations',
  'schema-manifest.json',
  '001_bancus_fraternis_local_db.sql',
  'tools/validate-database-migrations.mjs'
].forEach((marker) => {
  assert(localDatabaseDoc.includes(marker), `BANCO_DADOS_LOCAL sem referencia ${marker}.`);
  assert(nextPhases.includes(marker), `PROXIMAS_FASES sem referencia ${marker}.`);
});

assert(backendPlan.includes('schema-manifest.json'), 'Plano backend produtivo sem manifest de schema.');
assert(contracts.includes('tools/validate-database-migrations.mjs'), 'Contratos publicos sem validador de migrations.');
assert(actionPlan.includes('Schema e migrations versionadas') && actionPlan.includes('Concluido parcial'), 'Plano de acao sem status da fase de migrations.');
assert(changelog.includes('v8.103.0') && changelog.includes('Schema e migrations versionadas'), 'Changelog sem entrada v8.103.0.');
assert(designValidator.includes('tools/validate-database-migrations.mjs'), 'validate-design-system nao exige validate-database-migrations.');
assert(publicContractsValidator.includes('tools/validate-database-migrations.mjs'), 'validate-public-contracts nao exige validate-database-migrations.');
assert(localDatabaseValidator.includes('SCHEMA_MANIFEST_PATH'), 'validate-local-database nao protege manifest exportado.');

const report = {
  ok: failures.length === 0,
  schemaVersion: manifest.schemaVersion,
  provider: manifest.provider,
  migration: manifest.currentMigration,
  rollback: manifest.rollback,
  tables: tables.map((table) => table.name),
  indexes: tables.reduce((total, table) => total + (table.indexes || []).length, 0),
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/database-migrations-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
