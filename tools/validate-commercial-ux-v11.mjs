import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';

const root = process.cwd();
const checks = [];
const failures = [];

function check(id, condition, evidence) {
  const ok = Boolean(condition);
  checks.push({ id, ok, evidence });
  if (!ok) failures.push(id);
}

function imageMetadata(buffer) {
  if (buffer.length > 24 && buffer.toString('ascii', 1, 4) === 'PNG') {
    return { format: 'png', width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    const frameMarkers = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    let offset = 2;
    while (offset + 8 < buffer.length) {
      if (buffer[offset] !== 0xff) {
        offset += 1;
        continue;
      }
      const marker = buffer[offset + 1];
      offset += 2;
      if (marker === 0xd8 || marker === 0xd9) continue;
      if (offset + 2 > buffer.length) break;
      const segmentLength = buffer.readUInt16BE(offset);
      if (segmentLength < 2 || offset + segmentLength > buffer.length) break;
      if (frameMarkers.has(marker) && segmentLength >= 7) {
        return {
          format: 'jpeg',
          height: buffer.readUInt16BE(offset + 3),
          width: buffer.readUInt16BE(offset + 5)
        };
      }
      offset += segmentLength;
    }
  }
  return { format: 'unknown', width: 0, height: 0 };
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
  simulatorCss,
  proposalResumeGuardJs,
  proposalIntegrityJs,
  proposalAcceptanceJs
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
  read('css/simulator-evolution.css'),
  read('js/proposal-resume-guard.js'),
  read('js/proposal-integrity.js'),
  read('js/proposal-acceptance.js')
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
check(
  'dashboard.customer-actions',
  ['Nova simulação', 'Minhas propostas', 'Comparar cenários'].every((term) => dashboardSurface.includes(term))
    && ['Ver proposta', 'Próximo passo'].every((term) => dashboardJs.includes(term)),
  'Ações comerciais respondem ao momento da jornada e priorizam a proposta ativa.'
);
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
check('simulator.resume-identity', proposalResumeGuardJs.includes("reason: 'simulation-mismatch'") && appJs.includes('resolveProposalSimulationLink') && appJs.includes('if (!resolution.ok || resolution.simulationId !== sim.id || !identityMatches)'), 'Links divergentes falham antes de restaurar outra proposta.');
check('simulator.historical-version-snapshot', storageJs.includes('saveProposalVersionSnapshot') && appJs.includes('createProposalVersionSimulationId') && appJs.includes('immutable: true'), 'Cada versão preserva um snapshot próprio e sanitizado.');
check('simulator.unique-proposal', appJs.includes('currentProposalId') && appJs.includes('window.crypto?.getRandomValues') && appJs.includes('`${proposal.id}-${suffix}`'), 'Cada jornada recebe uma identidade própria, mesmo com o mesmo valor de crédito.');
check('simulator.resume-payload', ['proposalId', 'comparison', 'proposalSnapshotRef', 'privacy'].every((term) => storageJs.includes(term)) && simulatorStateJs.includes('proposalAcceptance?.proposalId'), 'Simulação preserva identidade, comparação, privacidade e referência da proposta.');
check('simulator.client-readonly', proposalResumeGuardJs.includes("role === 'cliente'") && proposalJs.includes('currentUserIsClient()') && proposalJs.includes('clientModeLocked') && proposalJs.includes('apenas para conferência') && proposalJs.includes('Confira sua proposta.'), 'Retomada do cliente deriva o bloqueio do papel e usa linguagem de consulta.');
check('simulator.client-readonly-state', simulatorCss.includes('body.proposal-client-readonly .proposal-command-bar__state') && simulatorCss.includes('body.proposal-client-mode .proposal-evolution-feedback') && simulatorCss.includes('body.proposal-client-mode .proposal-share-panel'), 'Modo cliente mostra somente situação, proposta e retorno ao painel.');
check('simulator.client-readonly-snapshot', (appJs.match(/!clientReadOnly/g) || []).length >= 3 && appJs.includes('isClientProposalResume(params, proposalTarget ? 10 : 0)') && appJs.includes('setClientMode?.(true, { locked: true })'), 'Conferência usa o resultado salvo sem recalcular, reabrir edição ou exibir alertas de bastidor.');
check('simulator.current-comparison', proposalIntegrityJs.includes('comparisonFingerprint') && appJs.includes('proposalComparisonIsCurrent()') && appJs.includes('restoreComparisonSource(compResult)'), 'Envio exige comparação correspondente aos grupos e condições atuais.');
check('simulator.acceptance-resume', appJs.includes('resumedProposalAcceptance') && proposalAcceptanceJs.includes('parseLocalDate') && proposalAcceptanceJs.includes('valid < today'), 'Retomada preserva revisão e validade sem deslocamento de fuso.');
check('simulator.pdf-send-gates', appJs.includes('function proposalDocumentIssues()')
  && appJs.includes('proposalBuilderReadinessIssues(getProposalBuilderConfig())')
  && appJs.includes('proposalCalculationMatchesCurrentForm()')
  && appJs.includes("['premissas', 'cliente', 'documentacao']")
  && appJs.includes('proposalAcceptanceHasCurrentValidity(acceptance)')
  && proposalJs.includes('publicationDays(prepared.payload.review.validUntil)')
  && appJs.includes('const issues = proposalDocumentIssues();')
  && /async function exportarPDF\(\)[\s\S]*?proposalDocumentIssues\(\)/.test(appJs), 'PDF depende de cálculo, cronograma e estrutura; envio acrescenta comparação, conferência e validade.');

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
    const absolutePath = path.join(root, relativePath);
    const buffer = await fs.readFile(absolutePath);
    const { format, width, height } = imageMetadata(buffer);
    const sha256 = crypto.createHash('sha256').update(buffer).digest('hex');
    return { path: relativePath, bytes: buffer.length, format, width, height, sha256, ok: buffer.length > 0 && width >= 800 && height >= 500 };
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
