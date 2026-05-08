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
assert(dashboardHtml.includes('data-client-continuity-timeline'), 'Dashboard Cliente sem timeline de continuidade.');
assert(dashboardHtml.includes('data-client-decision-journey'), 'Dashboard Cliente sem painel de trilha assistida.');
assert(dashboardHtml.includes('data-client-recovery-signals'), 'Dashboard Cliente sem sinais de retomada.');
assert(dashboardHtml.includes('trilha-decisao.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Trilha.');
assert(dashboardHtml.includes('simulador.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Simulador.');
assert(dashboardHtml.includes('produtos.html?from=dashboard'), 'Hero do Dashboard Cliente nao preserva from=dashboard para Produtos.');

for (const label of expectedTimelineLabels) {
  assert(clientJs.includes(label), `Timeline do cliente sem etapa esperada: ${label}.`);
}

assert(clientJs.includes('function dashboardHref'), 'Dashboard Cliente sem helper de deep link contextual.');
assert(clientJs.includes("from: 'dashboard'"), 'Dashboard Cliente nao marca origem dashboard nos deep links.');
assert(clientJs.includes('journeyId'), 'Dashboard Cliente nao preserva journeyId.');
assert(clientJs.includes('hasProposalState'), 'Dashboard Cliente nao detecta proposta/aceite local.');
assert(clientJs.includes('ageLabel'), 'Dashboard Cliente nao mostra aging do handoff.');
assert(clientJs.includes('handoffSource'), 'Dashboard Cliente nao mostra origem do handoff.');
assert(clientJs.includes('handoff-consultivo.html#fila-handoff'), 'Dashboard Cliente nao aponta handoff para fila.');
assert(clientJs.includes('comparador.html'), 'Dashboard Cliente nao oferece continuidade para comparador.');
assert(clientJs.includes('simulador.html#proposta'), 'Dashboard Cliente nao oferece continuidade para proposta.');

const summary = {
  ok: failures.length === 0,
  timeline: expectedTimelineLabels.map((label) => label.replace("label: '", '').replace("'", '')),
  contracts: {
    heroContext: dashboardHtml.includes('from=dashboard'),
    dashboardHref: clientJs.includes('function dashboardHref'),
    proposalStage: clientJs.includes("label: 'Proposta'"),
    handoffAging: clientJs.includes('ageLabel')
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
