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
  designValidator,
  publicContractsValidator
] = await Promise.all([
  read('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'),
  read('docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/README.md'),
  read('docs/CODEX_TEST_PROTOCOL.md'),
  read('docs/CHANGELOG.md'),
  read('tools/validate-design-system.mjs'),
  read('tools/validate-public-contracts.mjs')
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
assert(designValidator.includes('tools/validate-backend-production-plan.mjs'), 'validate-design-system nao exige validate-backend-production-plan.');
assert(publicContractsValidator.includes('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'validate-public-contracts nao le plano backend produtivo.');

const report = {
  ok: failures.length === 0,
  plan: 'docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md',
  checkedTables: 8,
  checkedEndpoints: 14,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/backend-production-plan-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
