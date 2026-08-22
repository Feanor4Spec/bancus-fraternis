import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const failures = [];

function check(id, condition, evidence) {
  const ok = Boolean(condition);
  checks.push({ id, ok, evidence });
  if (!ok) failures.push(id);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function roleEntries(source, role) {
  const match = source.match(new RegExp(`${role}: \\[([\\s\\S]*?)\\n\\s*\\]`));
  return match ? [...match[1].matchAll(/\['([^']+)',\s*'([^']+)'\]/g)].map((item) => ({ href: item[1], label: item[2] })) : [];
}

const [
  layout,
  dashboardHtml,
  dashboardJs,
  handoffHtml,
  handoffJs,
  loginHtml,
  loginJs,
  simulatorHtml,
  proposalJs,
  appJs,
  storageJs,
  simulatorStateJs,
  handoffServiceJs,
  platformJs,
  platformCss,
  simulatorCss
] = await Promise.all([
  read('js/shared-layout.js'),
  read('pages/dashboard-cliente.html'),
  read('assets/js/client-dashboard.js'),
  read('pages/handoff-consultivo.html'),
  read('assets/js/handoff-consultivo.js'),
  read('pages/login.html'),
  read('assets/js/login.js'),
  read('pages/simulador.html'),
  read('js/proposal-experience.js'),
  read('js/app.js'),
  read('js/storage.js'),
  read('js/simulator-state.js'),
  read('assets/js/services/handoff-consultivo.service.js'),
  read('assets/js/bf-platform.js'),
  read('assets/css/platform.css'),
  read('css/simulator-evolution.css')
]);

const roles = ['public', 'cliente', 'consultor', 'admin'];
const navigation = Object.fromEntries(roles.map((role) => [role, roleEntries(layout, role)]));
roles.forEach((role) => {
  check(`navigation.${role}.five`, navigation[role].length === 5, navigation[role]);
});
check('navigation.role-aware', layout.includes('navigationByRole') && layout.includes('primaryNavigation(user)'), 'Navegação recalculada após autenticação.');
check('navigation.wrapper-layout', platformCss.includes('[data-shell-primary-nav]') && platformCss.includes('display: contents'), 'Links preservam o layout flexível.');

const dashboardSurface = dashboardHtml.split('<div hidden aria-hidden="true" data-client-commercial-internals>')[0];
const dashboardBanned = ['Dashboard v8', 'Portal de engenharia', 'Componentes v8', 'API Docs', 'Microconversões locais', 'Jornada medida no navegador'];
check('dashboard.internal-copy-hidden', dashboardBanned.every((term) => !dashboardSurface.includes(term)), dashboardBanned);
check('dashboard.customer-actions', ['Nova simulação', 'Propostas', 'Comparar', 'Atendimento'].every((term) => dashboardSurface.includes(term)), 'Quatro ações comerciais visíveis.');
check('dashboard.legacy-panels-hidden', dashboardHtml.includes('data-client-commercial-internals') && platformCss.includes('[data-client-commercial-internals][hidden]'), 'Contratos antigos preservados fora da apresentação.');
check('dashboard.proposal-route', dashboardJs.includes("simulador.html#proposta") && dashboardJs.includes('proposalVersionId') && !dashboardJs.includes("dashboardHref('simulador.html#step-9'"), 'Atalho identifica versão, simulação e proposta final.');
check('dashboard.proposal-client-view', dashboardJs.includes("proposalView: currentUserRole() === 'cliente'") && dashboardJs.includes('href: proposalHref('), 'Cliente abre a proposta em modo de conferência; equipe preserva a edição.');
check('dashboard.empty-metrics', platformCss.includes('[data-client-continuity-timeline][hidden]') && platformJs.includes('statsTarget.hidden = true'), 'Linha interna e métricas vazias não ocupam a jornada.');

check('handoff.hero-commercial', handoffHtml.includes('Priorize oportunidades e conduza cada próximo passo.'), 'Objetivo comercial explícito.');
check('handoff.filters-human', ['Planejamento financeiro', 'Indicação', 'Criado pela equipe', 'Sem responsável'].every((term) => handoffHtml.includes(term)), 'Filtros usam linguagem da operação.');
check('handoff.internal-panels-hidden', ['data-handoff-live-data-panel hidden', 'data-handoff-operational-strip hidden', 'id="auditoria-handoff" hidden'].every((term) => handoffHtml.includes(term)), 'Painéis de infraestrutura fora da tela comercial.');
check('handoff.dynamic-copy', ['Conversas paradas', 'Avanços nas últimas 24h', 'Andamento comercial', 'Oportunidade'].every((term) => handoffJs.includes(term)), 'Textos dinâmicos seguem o vocabulário comercial.');
check('handoff.zero-state', handoffJs.includes('Sua carteira está pronta para começar.') && handoffJs.includes('Nenhum cliente aguardando retorno.'), 'Estado vazio orienta uma única ação.');
check('handoff.proposal-route', handoffJs.includes('proposalItemHref') && handoffServiceJs.includes('sourceSimulationId') && !handoffServiceJs.includes('#step-9'), 'Atendimento retoma a proposta vinculada na etapa final.');

check('login.direct-actions', ['Acessar a operação', 'Atender clientes', 'Simular e acompanhar propostas'].every((term) => loginHtml.includes(term)), 'Acesso por intenção de uso.');
check('login.consultant-route', loginJs.includes("user.role === 'consultor'") && loginJs.includes("return 'handoff-consultivo.html'"), 'Consultor entra direto no atendimento.');
check('login.backend-race', loginJs.includes('await result.backendLogin'), 'Espelhamento conclui antes da navegação.');

check('simulator.direct-state', simulatorHtml.includes('Nova simulação') && simulatorHtml.includes('Em preenchimento') && simulatorHtml.includes('Situação da proposta'), 'Estados falam em preenchimento e envio.');
check('simulator.pdf-action', simulatorHtml.includes('Imprimir ou salvar em PDF'), 'Entrega em PDF permanece explícita.');
check('simulator.share-language', proposalJs.includes('Pronta para enviar') && proposalJs.includes('Link disponível') && !proposalJs.includes("status = 'Publicada'"), 'Geração de link sem vocabulário de implantação.');
check('simulator.bottom-bar-flow', /\.proposal-bottom-bar\s*\{[\s\S]*?position:\s*static;/.test(simulatorCss), 'Barra final não cobre a proposta.');
check('simulator.proposal-resume', ['getRequestedProposalVersionId', 'findSimulationForProposal', "['#proposta', '#step-10']", 'persistCurrentSimulationForProposal'].every((term) => appJs.includes(term)), 'Retomada valida o vínculo e abre a etapa 10.');
check('simulator.resume-identity', appJs.includes("explicitId !== linked.id") && appJs.includes('A proposta solicitada não corresponde a esta simulação.'), 'Links divergentes falham sem abrir outra proposta.');
check('simulator.unique-proposal', appJs.includes('currentProposalId') && appJs.includes('window.crypto?.getRandomValues') && appJs.includes('`${proposal.id}-${suffix}`'), 'Cada jornada recebe uma identidade própria, mesmo com o mesmo valor de crédito.');
check('simulator.resume-payload', ['proposalId', 'comparison', 'proposalSnapshotRef', 'privacy'].every((term) => storageJs.includes(term)) && simulatorStateJs.includes('proposalAcceptance?.proposalId'), 'Simulação preserva identidade, comparação, privacidade e referência da proposta.');
check('simulator.client-readonly', proposalJs.includes("params.get('proposalView') === 'client'") && proposalJs.includes('clientModeLocked') && proposalJs.includes('apenas para conferência') && proposalJs.includes('Confira sua proposta.'), 'Retomada do cliente usa linguagem de consulta e bloqueia edição ou envio sem alterar o gate comercial.');
check('simulator.client-readonly-state', simulatorCss.includes('body.proposal-client-readonly .proposal-command-bar__state') && simulatorCss.includes('body.proposal-client-mode .proposal-evolution-feedback') && simulatorCss.includes('body.proposal-client-mode .proposal-share-panel'), 'Modo cliente mostra somente situação, proposta e retorno ao painel.');
check('simulator.client-readonly-snapshot', (appJs.match(/!options\.clientReadOnly/g) || []).length >= 3 && appJs.includes('isClientProposalResume(params)') && appJs.includes('setClientMode?.(true, { locked: true })'), 'Conferência usa o resultado salvo sem recalcular, reabrir edição ou exibir alertas de bastidor.');

const screenshotPaths = [
  'docs/test-prints/commercial-ux-v10/09-login-after.png',
  'docs/test-prints/commercial-ux-v10/10-atendimento-after.png',
  'docs/test-prints/commercial-ux-v10/11-simulador-inicio-after.png',
  'docs/test-prints/commercial-ux-v10/12-multigrupos-after.png',
  'docs/test-prints/commercial-ux-v10/13-proposta-final-after.png',
  'docs/test-prints/commercial-ux-v10/14-dashboard-cliente-after.png',
  'docs/test-prints/commercial-ux-v10/15-proposta-retomada-after.png'
];
const screenshotPresence = await Promise.all(screenshotPaths.map(async (relativePath) => {
  try {
    const stat = await fs.stat(path.join(root, relativePath));
    return { path: relativePath, bytes: stat.size, ok: stat.size > 0 };
  } catch (error) {
    return { path: relativePath, bytes: 0, ok: false };
  }
}));
check('evidence.screenshots', screenshotPresence.every((item) => item.ok), screenshotPresence);

const report = {
  ok: failures.length === 0,
  version: 'commercial-ux-v11',
  checks,
  failures,
  evidence: {
    navigation,
    screenshots: screenshotPresence
  }
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/test-reports/commercial-ux-v11-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
