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
  clientPage,
  clientJs,
  handoffPage,
  handoffJs,
  contracts,
  actionPlan,
  nextPhases,
  changelog
] = await Promise.all([
  read('pages/dashboard-cliente.html'),
  read('assets/js/client-dashboard.js'),
  read('pages/handoff-consultivo.html'),
  read('assets/js/handoff-consultivo.js'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/PROXIMAS_FASES_BANK_FRATERN.md'),
  read('docs/CHANGELOG.md')
]);

[
  'data-client-live-data-panel',
  'data-client-live-source',
  'data-client-live-refresh',
  'clientLiveDataReady',
  'clientLiveDataSource',
  'clientLiveDataRecords',
  'renderLiveDataPanel',
  'loadBackendSnapshots',
  'loadBackendEntities',
  'loadBackendMaterializedTables'
].forEach((marker) => {
  assert(clientPage.includes(marker) || clientJs.includes(marker), `Dashboard Cliente sem contrato de dados vivos: ${marker}.`);
});

[
  'data-handoff-live-data-panel',
  'data-handoff-live-source',
  'data-handoff-live-refresh',
  'handoffLiveDataReady',
  'handoffLiveDataSource',
  'handoffLiveLeadCount',
  'backendLeadState',
  'loadBackendLeads',
  'normalizeBackendLead',
  'mergeLiveHandoffs',
  'syncBackendLead',
  'api.listLeads',
  'api.updateLead'
].forEach((marker) => {
  assert(handoffPage.includes(marker) || handoffJs.includes(marker), `Handoff Consultivo sem contrato de dados vivos: ${marker}.`);
});

[
  'data-client-live-data-panel',
  'data-client-live-source',
  'data-client-live-refresh',
  'data-handoff-live-data-panel',
  'data-handoff-live-source',
  'data-handoff-live-refresh',
  'tools/validate-live-data-ux.mjs'
].forEach((marker) => {
  assert(contracts.includes(marker), `Contratos publicos sem dados vivos: ${marker}.`);
});

[
  'UX com dados vivos',
  'Dashboard Cliente',
  'Handoff Consultivo',
  'tools/validate-live-data-ux.mjs'
].forEach((marker) => {
  assert(actionPlan.includes(marker) || nextPhases.includes(marker) || changelog.includes(marker), `Documentacao de fase sem dados vivos: ${marker}.`);
});

assert(nextPhases.includes('Fase 8AT / P4.1 - UX com Dados Vivos'), 'Proximas fases sem Fase 8AT.');
assert(changelog.includes('v8.102.0') && changelog.includes('UX com dados vivos'), 'Changelog sem entrada v8.102.0.');
assert(actionPlan.includes('Fila consultiva com dados vivos') || actionPlan.includes('UX com dados vivos'), 'Plano de acao sem status da UX com dados vivos.');

const report = {
  ok: failures.length === 0,
  surfaces: {
    dashboardCliente: {
      panel: clientPage.includes('data-client-live-data-panel'),
      refresh: clientJs.includes('data-client-live-refresh'),
      readiness: clientJs.includes('clientLiveDataReady')
    },
    handoffConsultivo: {
      panel: handoffPage.includes('data-handoff-live-data-panel'),
      backendLeads: handoffJs.includes('loadBackendLeads'),
      updateLead: handoffJs.includes('api.updateLead')
    }
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/live-data-ux-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
