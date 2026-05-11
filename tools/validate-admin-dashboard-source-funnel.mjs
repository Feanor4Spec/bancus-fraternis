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

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [dashboardHtml, adminUsersJs, platformCss, simulatorHtml] = await Promise.all([
  read('pages/dashboard-admin.html'),
  read('assets/js/admin-users.js'),
  read('assets/css/platform.css'),
  read('pages/simulador.html')
]);

[
  'data-admin-journey-funnel',
  'data-admin-operational-alerts',
  'data-admin-recovery-queue',
  'data-admin-recovery-packages',
  'data-admin-handoff-summary',
  'href="#admin-proximos-passos"',
  'href="#admin-carteira-consultor"',
  'href="#admin-origens"',
  'href="#admin-gargalos"'
].forEach((marker) => assert(dashboardHtml.includes(marker), `dashboard-admin.html sem ${marker}.`));

[
  'buildAdminSourceFunnel',
  'buildAdminBottlenecks',
  'buildAdminNextActions',
  'buildAdminActionQueue',
  'buildAdminConsultantProductivity',
  'buildAdminConsultantPortfolio',
  'renderAdminSourceFunnel',
  'renderAdminBottleneckBoard',
  'renderAdminNextActionBoard',
  'renderAdminActionQueue',
  'renderAdminConsultantProductivity',
  'renderAdminConsultantPortfolio',
  'data-admin-source-funnel',
  'data-admin-bottleneck-board',
  'data-admin-next-actions',
  'data-admin-action-queue',
  'data-admin-action-execution',
  'data-admin-action-reason',
  'data-admin-action-history',
  'data-admin-action-owner-history',
  'data-admin-consultant-productivity',
  'data-admin-consultant-productivity-row',
  'data-admin-consultant-portfolio',
  'data-admin-consultant-portfolio-row',
  'data-admin-consultant-portfolio-lead',
  'data-admin-action-status',
  'adminNextActionsReady',
  'adminNextActionCount',
  'adminActionQueueReady',
  'adminActionQueueCount',
  'adminConsultantProductivityReady',
  'adminConsultantProductivityCount',
  'adminConsultantPortfolioReady',
  'adminConsultantPortfolioCount',
  'id="admin-proximos-passos"',
  'id="admin-fila-acao"',
  'id="admin-carteira-consultor"',
  'id="admin-origens"',
  'id="admin-gargalos"',
  'adminSourceDefinitions',
  'readAdminDecisionJourneys',
  'readAdminCalculatorHistory',
  'latestProposalReviews',
  'readAdminProposalVersions',
  'latestProposalVersions',
  'proposalVersionMap',
  'Responsavel sugerido',
  'Quem faz o que, ate quando',
  'buildAdminActionExecutionSummary',
  'adminActionAuditRecords',
  'Tempo medio',
  'Gargalos recorrentes',
  'Carteira por consultor',
  'Aging medio',
  'Leads abertos',
  'adminActionExecution',
  'adminSourceFunnelReady',
  'adminBottleneckCount'
].forEach((marker) => assert(adminUsersJs.includes(marker), `admin-users.js sem contrato ${marker}.`));

[
  'Calculadoras',
  'Produtos',
  'Trilha assistida',
  'Comparador',
  'Simulador',
  'Proposta',
  'Pacotes'
].forEach((label) => assert(adminUsersJs.includes(label), `Funil admin sem origem ${label}.`));

[
  'Proposta revisada sem handoff',
  'Proposta versionada sem handoff',
  'Proposta vencida',
  'Proposta alterada apos handoff',
  'Trilha sem comparador',
  'Handoff sem responsavel',
  'SLA vencido'
].forEach((label) => assert(adminUsersJs.includes(label), `Gargalo admin ausente: ${label}.`));

[
  '.bf-admin-next-actions',
  '.bf-admin-next-actions__grid',
  '.bf-admin-next-action',
  '.bf-admin-action-queue',
  '.bf-admin-action-queue__list',
  '.bf-admin-action-item',
  '.bf-admin-action-summary',
  '.bf-admin-action-owners',
  '.bf-admin-action-history',
  '.bf-action-execution',
  '.bf-admin-consultant-productivity',
  '.bf-admin-consultant-productivity__grid',
  '.bf-admin-consultant-card',
  '.bf-admin-consultant-portfolio',
  '.bf-admin-consultant-portfolio__grid',
  '.bf-admin-portfolio-card',
  '.bf-admin-portfolio-lead',
  '.bf-admin-source-funnel',
  '.bf-admin-source-grid',
  '.bf-admin-source-card',
  '.bf-admin-bottleneck-board',
  '.bf-admin-bottleneck-grid',
  '.bf-admin-bottleneck-card'
].forEach((selector) => assert(platformCss.includes(selector), `platform.css sem seletor ${selector}.`));

assert(!simulatorHtml.includes('data-v8-stagebar-legacy'), 'simulador.html ainda contem template legado da stagebar superior.');
assert(simulatorHtml.includes('bf-v8-stagebar-shell'), 'simulador.html sem stagebar inferior recolhivel.');
assert(platformCss.includes('.bf-admin-next-actions__grid') && platformCss.includes('.bf-admin-action-queue__list') && platformCss.includes('.bf-admin-action-owners') && platformCss.includes('.bf-admin-consultant-productivity__grid') && platformCss.includes('.bf-admin-consultant-portfolio__grid') && platformCss.includes('.bf-admin-source-grid') && platformCss.includes('.bf-admin-bottleneck-grid'), 'CSS admin sem grids monitorados.');

const report = {
  ok: failures.length === 0,
  contracts: {
    dashboardMarkers: 9,
    sources: 7,
    bottlenecks: 7,
    nextActions: adminUsersJs.includes('buildAdminNextActions') ? 5 : 0,
    actionQueue: adminUsersJs.includes('buildAdminActionQueue') ? 6 : 0,
    actionExecution: adminUsersJs.includes('data-admin-action-execution'),
    consultantProductivity: adminUsersJs.includes('data-admin-consultant-productivity'),
    consultantPortfolio: adminUsersJs.includes('data-admin-consultant-portfolio'),
    simulatorBottomStagebar: simulatorHtml.includes('bf-v8-stagebar-shell')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/admin-dashboard-source-funnel-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
