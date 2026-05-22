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
  nextPhases,
  backendPlan,
  actionPlan,
  map,
  readme,
  protocol,
  contracts,
  changelog,
  designValidator,
  backendValidator,
  publicContractsValidator
] = await Promise.all([
  read('docs/PROXIMAS_FASES_BANK_FRATERN.md'),
  read('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/README.md'),
  read('docs/CODEX_TEST_PROTOCOL.md'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/CHANGELOG.md'),
  read('tools/validate-design-system.mjs'),
  read('tools/validate-backend-production-plan.mjs'),
  read('tools/validate-public-contracts.mjs')
]);

[
  '# Proximas Fases - Bancus Fraternis',
  '## Objetivo',
  '## Estado De Partida',
  '## Ordem Das Proximas Fases',
  '## Fase 8AN / P3.3A - Schema e Migrations Versionadas',
  '## Fase 8AO / P3.3B - Adapter Produtivo Piloto',
  '## Fase 8AP / P3.4 - Autenticacao Produtiva',
  '## Fase 8AQ / P3.5 - Migracao Assistida e Reconciliacao',
  '## Fase 8AR / P3.6 - Observabilidade, Backup e LGPD',
  '## Fase 8AS / P3.7 - Corte Controlado por Ambiente',
  '## Fase 8AT / P4.1 - UX com Dados Vivos',
  '## Validacoes Recomendadas',
  '## Decisao Para O Proximo Ciclo'
].forEach((section) => assert(nextPhases.includes(section), `Documento de proximas fases sem secao ${section}.`));

[
  'localStorage',
  'BFBackendApi',
  'GitHub Pages',
  'BANCUS_DB_PROVIDER=sqlite',
  'BANCUS_DB_PROVIDER=postgresql',
  'BANCUS_DATABASE_URL',
  'SQLite',
  'PostgreSQL',
  'LGPD',
  'backup',
  'rollback',
  'owner_email',
  '/api/*'
].forEach((token) => assert(nextPhases.includes(token), `Proximas fases sem contrato ${token}.`));

[
  'users',
  'sessions',
  'events',
  'snapshots',
  'journey_entities',
  'journey_leads',
  'journey_simulations',
  'journey_proposals'
].forEach((table) => assert(nextPhases.includes(table), `Proximas fases sem tabela ${table}.`));

const orderedMarkers = [
  '8AN / P3.3A',
  '8AO / P3.3B',
  '8AP / P3.4',
  '8AQ / P3.5',
  '8AR / P3.6',
  '8AS / P3.7',
  '8AT / P4.1'
];
let lastIndex = -1;
for (const marker of orderedMarkers) {
  const index = nextPhases.indexOf(marker);
  assert(index > lastIndex, `Fase fora de ordem ou ausente: ${marker}.`);
  lastIndex = index;
}

[
  'tools/validate-next-phases-plan.mjs',
  'tools/validate-backend-production-plan.mjs',
  'tools/validate-local-database.mjs',
  'tools/validate-public-contracts.mjs',
  'tools/validate-live-data-ux.mjs',
  'tools/validate-public-release-safety.mjs',
  'tools/validate-design-system.mjs'
].forEach((validator) => assert(nextPhases.includes(validator), `Proximas fases sem validador ${validator}.`));

[
  backendPlan,
  actionPlan,
  map,
  readme,
  protocol,
  contracts
].forEach((text, index) => {
  const names = ['plano backend', 'plano acao', 'mapa', 'readme', 'protocolo', 'contratos'];
  assert(text.includes('docs/PROXIMAS_FASES_BANK_FRATERN.md'), `${names[index]} nao referencia docs/PROXIMAS_FASES_BANK_FRATERN.md.`);
});

assert(backendPlan.includes('P3.3A') && backendPlan.includes('P3.3B'), 'Plano backend sem divisao P3.3A/P3.3B.');
assert(actionPlan.includes('Schema e migrations versionadas') && actionPlan.includes('Adapter produtivo piloto'), 'Plano de acao sem proximas fases P0.');
assert(actionPlan.includes('UX com dados vivos') && actionPlan.includes('tools/validate-live-data-ux.mjs'), 'Plano de acao sem status de UX com dados vivos.');
assert(protocol.includes('Fase 8AN / P3.3A') && protocol.includes('Fase 8AS / P3.7'), 'Protocolo sem fases futuras aceitas.');
assert(changelog.includes('v8.101.0') && changelog.includes('Proximas fases produtivas'), 'Changelog sem entrada v8.101.0.');
assert(changelog.includes('v8.102.0') && changelog.includes('UX com dados vivos'), 'Changelog sem entrada v8.102.0.');
assert(designValidator.includes('tools/validate-next-phases-plan.mjs'), 'validate-design-system nao exige validate-next-phases-plan.');
assert(backendValidator.includes('docs/PROXIMAS_FASES_BANK_FRATERN.md'), 'validate-backend-production-plan nao le proximas fases.');
assert(publicContractsValidator.includes('docs/PROXIMAS_FASES_BANK_FRATERN.md'), 'validate-public-contracts nao le proximas fases.');

const report = {
  ok: failures.length === 0,
  plan: 'docs/PROXIMAS_FASES_BANK_FRATERN.md',
  phases: orderedMarkers.length,
  firstImplementation: '8AN / P3.3A',
  nextProvider: 'postgresql',
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/next-phases-plan-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
