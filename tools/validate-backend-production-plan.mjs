import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  backendPlan,
  localDbDoc,
  contracts,
  actionPlan,
  map,
  readme,
  protocol,
  changelog,
  nextPhases,
  designValidator,
  publicContractsValidator,
  migrationValidator,
  backendDb,
  server
] = await Promise.all([
  read('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'),
  read('docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/README.md'),
  read('docs/CODEX_TEST_PROTOCOL.md'),
  read('docs/CHANGELOG.md'),
  read('docs/PROXIMAS_FASES_BANK_FRATERN.md'),
  read('tools/validate-design-system.mjs'),
  read('tools/validate-public-contracts.mjs'),
  read('tools/validate-database-migrations.mjs'),
  read('js/backend/db.js'),
  read('server.js')
]);

[
  '# Plano Backend Produtivo - Bancus Fraternis',
  '## Objetivo',
  '## Estado Atual',
  '## Principios De Migracao',
  '## Dominios Produtivos',
  '## Contratos Que Nao Podem Quebrar',
  '## Fronteira De API Produtiva',
  '## Sequencia Recomendada',
  '## Definition Of Done Produtiva',
  '## Riscos E Mitigacoes',
  '## Backlog Tecnico',
  '## Validacao'
].forEach((section) => assert(backendPlan.includes(section), `Plano backend produtivo sem secao ${section}.`));

[
  'localStorage continua sendo fallback publico',
  'SQLite local',
  'backend hospedado',
  'BFAuth',
  'BFBackendApi',
  'GitHub Pages',
  'LGPD',
  'backup',
  'observabilidade',
  'owner_email',
  'BANCUS_DB_PROVIDER'
].forEach((token) => assert(backendPlan.includes(token), `Plano backend produtivo sem contrato ${token}.`));

[
  'users',
  'sessions',
  'events',
  'snapshots',
  'journey_entities',
  'journey_leads',
  'journey_simulations',
  'journey_proposals'
].forEach((table) => {
  assert(backendPlan.includes(table), `Plano backend produtivo sem tabela ${table}.`);
  assert(localDbDoc.includes(table), `Banco local sem tabela ${table}.`);
});

[
  'POST /api/auth/login',
  'GET /api/users',
  'POST /api/events',
  'GET /api/snapshots',
  'GET /api/journey-entities',
  'GET /api/leads',
  'POST /api/leads',
  'PATCH /api/leads/:id',
  'GET /api/simulations',
  'POST /api/simulations',
  'PATCH /api/simulations/:id',
  'GET /api/proposals',
  'POST /api/proposals',
  'PATCH /api/proposals/:id'
].forEach((endpoint) => assert(backendPlan.includes(endpoint), `Plano backend produtivo sem endpoint ${endpoint}.`));

[
  'senha',
  'token',
  'hash',
  'CPF',
  'telefone',
  'WhatsApp',
  'e-mail'
].forEach((sensitive) => assert(backendPlan.includes(sensitive), `Plano backend produtivo sem regra sensivel para ${sensitive}.`));

assert(localDbDoc.includes('PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'Documento de banco local nao aponta plano backend produtivo.');
assert(contracts.includes('PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'Contratos publicos nao apontam plano backend produtivo.');
assert(contracts.includes('tools/validate-backend-production-plan.mjs'), 'Contratos publicos nao documentam validador de backend produtivo.');
assert(actionPlan.includes('Backend/API produtivo futuro') && actionPlan.includes('PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'Plano de acao nao marca backend produtivo como ciclo governado.');
assert(map.includes('PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'Mapa completo nao registra plano backend produtivo.');
assert(readme.includes('PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'README nao referencia plano backend produtivo.');
assert(protocol.includes('validate-backend-production-plan.mjs'), 'Protocolo de testes nao recomenda validate-backend-production-plan.');
assert(changelog.includes('v8.99.0') && changelog.includes('Backend produtivo governado'), 'Changelog sem entrada v8.99.0 de backend produtivo.');
assert(changelog.includes('v8.100.0') && changelog.includes('Provider de banco configuravel'), 'Changelog sem entrada v8.100.0 de provider configuravel.');
assert(changelog.includes('v8.101.0') && changelog.includes('Proximas fases produtivas'), 'Changelog sem entrada v8.101.0 de proximas fases.');
assert(changelog.includes('v8.103.0') && changelog.includes('Schema e migrations versionadas'), 'Changelog sem entrada v8.103.0 de migrations.');
assert(nextPhases.includes('8AN / P3.3A') && nextPhases.includes('Schema e Migrations Versionadas'), 'Proximas fases sem P3.3A de schema/migrations.');
assert(nextPhases.includes('8AO / P3.3B') && nextPhases.includes('BANCUS_DB_PROVIDER=postgresql'), 'Proximas fases sem adapter postgresql piloto.');
assert(nextPhases.includes('8AS / P3.7') && nextPhases.includes('rollback'), 'Proximas fases sem corte controlado com rollback.');
assert(backendPlan.includes('docs/PROXIMAS_FASES_BANK_FRATERN.md'), 'Plano backend nao referencia proximas fases.');
assert(designValidator.includes('tools/validate-backend-production-plan.mjs'), 'validate-design-system nao exige validate-backend-production-plan.');
assert(designValidator.includes('tools/validate-next-phases-plan.mjs'), 'validate-design-system nao exige validate-next-phases-plan.');
assert(designValidator.includes('tools/validate-database-migrations.mjs'), 'validate-design-system nao exige validate-database-migrations.');
assert(publicContractsValidator.includes('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'validate-public-contracts nao le plano backend produtivo.');
assert(publicContractsValidator.includes('docs/PROXIMAS_FASES_BANK_FRATERN.md'), 'validate-public-contracts nao le proximas fases.');
assert(publicContractsValidator.includes('tools/validate-database-migrations.mjs'), 'validate-public-contracts nao exige validate-database-migrations.');
assert(migrationValidator.includes('schema-manifest.json') && migrationValidator.includes('001_bancus_fraternis_local_db.sql'), 'Validador de migrations nao cobre manifest e baseline.');
assert(backendDb.includes('DEFAULT_DB_PROVIDER') && backendDb.includes("'sqlite'"), 'db.js sem provider padrao sqlite.');
assert(backendDb.includes('SUPPORTED_DB_PROVIDERS') && backendDb.includes('normalizeDbProvider'), 'db.js sem camada de provider configuravel.');
assert(backendDb.includes('BANCUS_DB_PROVIDER') && backendDb.includes('assertSupportedDbProvider'), 'db.js sem bloqueio explicito de provider nao implementado.');
assert(backendDb.includes('isSupportedDbProvider') && backendDb.includes('postgresql'), 'db.js deveria permitir validar provider futuro nao implementado.');
assert(backendDb.includes('SCHEMA_MANIFEST_PATH') && backendDb.includes('SCHEMA_MIGRATIONS_DIR'), 'db.js sem caminhos publicos de migrations.');
assert(server.includes('provider: database ? database.provider : requestedDatabaseProvider'), 'server.js sem provider solicitado/ativo no health da API.');

const report = {
  ok: failures.length === 0,
  plan: 'docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md',
  checkedTables: 8,
  checkedEndpoints: 14,
  providerLayer: backendDb.includes('SUPPORTED_DB_PROVIDERS'),
  migrationBaseline: migrationValidator.includes('schema-manifest.json'),
  nextPhases: nextPhases.includes('8AN / P3.3A'),
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/backend-production-plan-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
