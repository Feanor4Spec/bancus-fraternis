import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const dashboardHtml = await readText('pages/dashboard-cliente.html');
const clientJs = await readText('assets/js/client-dashboard.js');

const expectedTimelineLabels = [
  "label: 'Diagnostico'",
  "label: 'Calculadora'",
  "label: 'Trilha'",
  "label: 'Comparador'",
  "label: 'Simulacao'",
  "label: 'Proposta'",
  "label: 'Handoff'"
];

assert(dashboardHtml.includes('data-client-continuity-strip'), 'Dashboard Cliente sem strip de continuidade.');
assert(dashboardHtml.includes('data-client-continuity-cockpit'), 'Dashboard Cliente sem cockpit acionavel de continuidade.');
assert(dashboardHtml.includes('data-client-continuity-timeline'), 'Dashboard Cliente sem timeline de continuidade.');
assert(dashboardHtml.includes('data-client-decision-journey'), 'Dashboard Cliente sem painel de trilha assistida.');
assert(dashboardHtml.includes('data-client-recovery-signals'), 'Dashboard Cliente sem sinais de retomada.');
assert(dashboardHtml.includes('data-client-live-data-panel'), 'Dashboard Cliente sem painel de dados vivos.');
assert(dashboardHtml.includes('trilha-decisao.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Trilha.');
assert(dashboardHtml.includes('simulador.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Simulador.');
assert(dashboardHtml.includes('produtos.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Produtos.');

for (const label of expectedTimelineLabels) {
  assert(clientJs.includes(label), `Timeline do cliente sem etapa esperada: ${label}.`);
}

assert(clientJs.includes('function dashboardHref'), 'Dashboard Cliente sem helper de deep link contextual.');
assert(clientJs.includes('function renderContinuityCockpit'), 'Dashboard Cliente sem renderContinuityCockpit.');
assert(clientJs.includes('function nextClientAction'), 'Dashboard Cliente sem decisao de proxima acao.');
assert(clientJs.includes('function proposalDashboardState'), 'Dashboard Cliente sem estado acionavel da proposta.');
assert(clientJs.includes('function commercialStageFor'), 'Dashboard Cliente sem leitura de etapa comercial.');
assert(clientJs.includes('Storage.loadSimulations'), 'Dashboard Cliente nao le simulacoes salvas pelo modulo Storage.');
assert(clientJs.includes("from: 'dashboard'"), 'Dashboard Cliente nao marca origem dashboard nos deep links.');
assert(clientJs.includes('journeyId'), 'Dashboard Cliente nao preserva journeyId.');
assert(clientJs.includes('hasProposalState'), 'Dashboard Cliente nao detecta proposta/aceite local.');
assert(clientJs.includes('ageLabel'), 'Dashboard Cliente nao mostra aging do handoff.');
assert(clientJs.includes('handoffSource'), 'Dashboard Cliente nao mostra origem do handoff.');
assert(clientJs.includes('data-client-next-action'), 'Dashboard Cliente sem marcador data-client-next-action.');
assert(clientJs.includes('data-client-handoff-status'), 'Dashboard Cliente sem marcador data-client-handoff-status.');
assert(clientJs.includes('data-client-proposal-status'), 'Dashboard Cliente sem marcador data-client-proposal-status.');
assert(clientJs.includes('data-client-simulation-context'), 'Dashboard Cliente sem marcador data-client-simulation-context.');
assert(clientJs.includes('data-client-commercial-stage'), 'Dashboard Cliente sem marcador data-client-commercial-stage.');
assert(clientJs.includes('clientContinuityCockpitReady'), 'Dashboard Cliente nao marca readiness do cockpit.');
assert(clientJs.includes('BFHandoffConsultivoService') && clientJs.includes('commercialStageState'), 'Dashboard Cliente nao reutiliza etapa comercial do handoff.');
assert(clientJs.includes('handoff-consultivo.html#fila-handoff'), 'Dashboard Cliente nao aponta handoff para fila.');
assert(clientJs.includes('comparador.html'), 'Dashboard Cliente nao oferece continuidade para comparador.');
assert(clientJs.includes('simulador.html#proposta'), 'Dashboard Cliente nao oferece continuidade para proposta.');
assert(clientJs.includes('function renderLiveDataPanel'), 'Dashboard Cliente sem renderLiveDataPanel.');
assert(clientJs.includes('data-client-live-source'), 'Dashboard Cliente sem marcador de origem viva.');
assert(clientJs.includes('data-client-live-refresh'), 'Dashboard Cliente sem atualizar dados vivos.');
assert(clientJs.includes('clientLiveDataReady'), 'Dashboard Cliente sem readiness de dados vivos.');
assert(clientJs.includes('backendMaterializedView'), 'Dashboard Cliente sem leitura materializada no painel vivo.');

const summary = {
  ok: failures.length === 0,
  timeline: expectedTimelineLabels.map((label) => label.replace("label: '", '').replace("'", '')),
  contracts: {
    heroContext: dashboardHtml.includes('from=dashboard'),
    dashboardHref: clientJs.includes('function dashboardHref'),
    proposalStage: clientJs.includes("label: 'Proposta'"),
    handoffAging: clientJs.includes('ageLabel'),
    cockpit: dashboardHtml.includes('data-client-continuity-cockpit'),
    nextAction: clientJs.includes('data-client-next-action'),
    commercialStage: clientJs.includes('data-client-commercial-stage'),
    liveData: clientJs.includes('clientLiveDataReady')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/dashboard-continuity-flow-report.json'),
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
