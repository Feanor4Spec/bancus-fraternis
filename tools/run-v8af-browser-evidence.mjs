import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const root = process.cwd();
const require = createRequire(import.meta.url);
const { chromium } = require('playwright');

const baseUrl = 'http://127.0.0.1:8080/pages';
const printsDir = path.join(root, 'docs/test-prints');
const reportsDir = path.join(root, 'docs/test-reports');
const reportPath = path.join(reportsDir, 'v8af-proposal-handoff-browser-report.json');
const screenshots = {
  proposalDesktop: path.join(printsDir, 'v8af-proposta-handoff-desktop.png'),
  proposalMobile: path.join(printsDir, 'v8af-proposta-handoff-mobile.png'),
  handoffDesktop: path.join(printsDir, 'v8af-handoff-proposta-desktop.png'),
  adminActionQueueDesktop: path.join(printsDir, 'v8af-admin-action-queue-desktop.png'),
  adminProductivityDesktop: path.join(printsDir, 'v8af-admin-productivity-desktop.png'),
  adminPortfolioDesktop: path.join(printsDir, 'v8ag-admin-consultant-portfolio-desktop.png'),
  adminCommercialPipelineDesktop: path.join(printsDir, 'v8ah-admin-commercial-pipeline-desktop.png'),
  handoffCommercialDesktop: path.join(printsDir, 'v8ai-handoff-commercial-stage-desktop.png')
};

async function launchBrowser() {
  try {
    return await chromium.launch({ channel: 'msedge', headless: true });
  } catch (edgeError) {
    return chromium.launch({ headless: true });
  }
}

function assert(condition, message, failures) {
  if (!condition) failures.push(message);
}

function reportScreenshots() {
  return Object.fromEntries(Object.entries(screenshots).map(([key, value]) => [
    key,
    path.relative(root, value).replace(/\\/g, '/')
  ]));
}

async function clearTransientUi(page) {
  await page.evaluate(() => {
    document.getElementById('toast-container')?.replaceChildren();
    document.querySelectorAll('.loading-overlay, #loading-overlay, [data-loading-overlay]').forEach((item) => {
      item.style.display = 'none';
      item.setAttribute('aria-hidden', 'true');
    });
  });
}

await fs.mkdir(printsDir, { recursive: true });
await fs.mkdir(reportsDir, { recursive: true });

const browser = await launchBrowser();
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 } });
const failures = [];
const consoleErrors = [];
const pageErrors = [];
const notFound = [];

page.on('console', (message) => {
  if (message.type() === 'error') consoleErrors.push(message.text());
});
page.on('pageerror', (error) => pageErrors.push(error.message));
page.on('response', (response) => {
  if (response.status() === 404) notFound.push(response.url());
});

try {
  await page.goto(`${baseUrl}/simulador.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => (
    typeof App !== 'undefined'
    && typeof ProposalSummary !== 'undefined'
    && typeof BFProposalAcceptance !== 'undefined'
    && typeof BFHandoffConsultivoService !== 'undefined'
  ), null, { timeout: 20000 });

  const flow = await page.evaluate(() => {
    localStorage.removeItem('bank_fratern_proposal_acceptances_v1');
    localStorage.removeItem('bf_consultive_handoffs_v1');
    localStorage.removeItem('bf_consultive_handoff_audit_v1');
    localStorage.removeItem('bf_admin_commercial_stage_states_v1');
    localStorage.removeItem('bf_admin_commercial_stage_audit_v1');

    App.carregarExemplo();
    App.calcular();
    App.goToStep(9);
    App.renderProposta();

    const reviewer = document.getElementById('proposalReviewer');
    const role = document.getElementById('proposalReviewerRole');
    const validUntil = document.getElementById('proposalValidUntil');
    const notes = document.getElementById('proposalReviewNotes');
    const checks = [
      document.getElementById('proposalCheckPremissas'),
      document.getElementById('proposalCheckCliente'),
      document.getElementById('proposalCheckDocumentacao')
    ];
    if (!reviewer || !role || !validUntil || !notes || checks.some((item) => !item)) {
      throw new Error('Painel de revisao nao renderizou campos esperados.');
    }

    reviewer.value = 'Analista de Proposta';
    role.value = 'Mesa consultiva';
    validUntil.value = '2026-05-15';
    notes.value = 'Premissas conferidas; criar continuidade consultiva local.';
    checks.forEach((item) => { item.checked = true; });

    App.salvarRevisaoProposta();
    const created = App.criarHandoffProposta();
    const handoffs = JSON.parse(localStorage.getItem('bf_consultive_handoffs_v1') || '[]');
    const audit = JSON.parse(localStorage.getItem('bf_consultive_handoff_audit_v1') || '[]');
    const panel = document.querySelector('[data-proposal-acceptance-panel]');
    const bridge = document.querySelector('[data-proposal-handoff-bridge]');

    return {
      createdId: created && created.id,
      storedHandoffs: handoffs.length,
      sourceProposalId: handoffs[0] && handoffs[0].sourceProposalId,
      sourceProposalStatus: handoffs[0] && handoffs[0].sourceProposalStatus,
      checklistDone: handoffs[0] ? handoffs[0].checklist.filter((item) => item.done).length : 0,
      checklistTotal: handoffs[0] ? handoffs[0].checklist.length : 0,
      auditActions: audit.map((event) => event.action),
      panelReady: panel && panel.dataset.proposalHandoffReady,
      bridgeText: bridge ? bridge.innerText : ''
    };
  });

  assert(flow.createdId && flow.createdId.startsWith('LEAD-'), 'Fluxo visual nao criou LEAD local.', failures);
  assert(flow.storedHandoffs === 1, `Fluxo visual deveria manter 1 handoff, recebeu ${flow.storedHandoffs}.`, failures);
  assert(flow.sourceProposalStatus === 'reviewed', `Handoff visual deveria nascer de proposta reviewed, recebeu ${flow.sourceProposalStatus}.`, failures);
  assert(flow.checklistDone >= 4 && flow.checklistTotal === 5, 'Checklist visual nao herdou revisao completa.', failures);
  assert(flow.auditActions.includes('proposal-create'), 'Auditoria visual nao registrou proposal-create.', failures);
  assert(flow.panelReady === 'true', 'Painel visual nao marcou data-proposal-handoff-ready=true.', failures);

  await clearTransientUi(page);
  await page.locator('[data-proposal-handoff-bridge]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.proposalDesktop, fullPage: false });

  await page.setViewportSize({ width: 390, height: 844 });
  await clearTransientUi(page);
  await page.locator('[data-proposal-handoff-bridge]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.proposalMobile, fullPage: false });

  await page.setViewportSize({ width: 1440, height: 1100 });
  await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof BFAuth !== 'undefined', null, { timeout: 10000 });
  const login = await page.evaluate(() => BFAuth.login('consultor@bankfratern.local', 'Consultor@123'));
  assert(login && login.ok, `Login local consultor falhou: ${login && login.message ? login.message : 'sem mensagem'}`, failures);

  await page.goto(`${baseUrl}/handoff-consultivo.html#fila-handoff`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.handoffReady === 'true', null, { timeout: 15000 });
  const handoffPage = await page.evaluate((expectedId) => {
    const cards = Array.from(document.querySelectorAll('[data-handoff-card]'));
    const card = cards.find((item) => item.getAttribute('data-handoff-card') === expectedId) || cards[0] || null;
    const actionPlan = document.querySelector('[data-handoff-action-plan]');
    return {
      ready: document.body.dataset.handoffReady,
      cards: cards.length,
      actionPlans: document.querySelectorAll('[data-handoff-action-plan]').length,
      expectedFound: !!card && card.getAttribute('data-handoff-card') === expectedId,
      text: card ? card.innerText : '',
      actionPlanText: actionPlan ? actionPlan.innerText : ''
    };
  }, flow.createdId);

  assert(handoffPage.ready === 'true', 'Pagina handoff nao marcou data-handoff-ready=true.', failures);
  assert(handoffPage.cards >= 1, 'Pagina handoff nao renderizou cards.', failures);
  assert(handoffPage.actionPlans >= 1, 'Pagina handoff nao renderizou data-handoff-action-plan.', failures);
  assert(/RESPONSÁVEL|Responsável/i.test(handoffPage.actionPlanText), 'Plano de acao do atendimento nao mostrou responsavel.', failures);
  assert(/PRAZO|Prazo/i.test(handoffPage.actionPlanText), 'Plano de acao do handoff nao mostrou prazo.', failures);
  assert(handoffPage.expectedFound, 'Pagina handoff nao exibiu o lead criado pela proposta.', failures);
  await page.evaluate(() => {
    const reason = document.querySelector('[data-handoff-action-reason]');
    const start = document.querySelector('[data-handoff-action-status="em_execucao"]');
    if (reason) reason.value = 'Contato iniciado pela evidencia automatizada.';
    if (start) start.click();
  });
  await page.waitForFunction(() => {
    const states = JSON.parse(localStorage.getItem('bf_operational_action_states_v1') || '{}');
    return Object.values(states).some((item) => item && item.status === 'em_execucao');
  }, null, { timeout: 10000 });
  const handoffExecution = await page.evaluate(() => {
    const states = JSON.parse(localStorage.getItem('bf_operational_action_states_v1') || '{}');
    const audit = JSON.parse(localStorage.getItem('bf_operational_action_audit_v1') || '[]');
    const panel = document.querySelector('[data-handoff-action-execution]');
    return {
      states: Object.values(states).map((item) => ({ actionKey: item.actionKey, status: item.status, reason: item.reason, owner: item.owner })),
      auditCount: audit.length,
      panelText: panel ? panel.innerText : ''
    };
  });
  assert(handoffExecution.states.some((item) => item.status === 'em_execucao'), 'Execucao do handoff nao persistiu status em_execucao.', failures);
  assert(handoffExecution.auditCount >= 1, 'Execucao do handoff nao gerou auditoria operacional.', failures);
  await page.locator('[data-handoff-list]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.handoffDesktop, fullPage: false });

  await page.goto(`${baseUrl}/login.html`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => typeof BFAuth !== 'undefined', null, { timeout: 10000 });
  const adminLogin = await page.evaluate(() => BFAuth.login('admin@bankfratern.local', 'Admin@123'));
  assert(adminLogin && adminLogin.ok, `Login local admin falhou: ${adminLogin && adminLogin.message ? adminLogin.message : 'sem mensagem'}`, failures);

  await page.goto(`${baseUrl}/dashboard-admin.html#admin-fila-acao`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.adminActionQueueReady === 'true', null, { timeout: 15000 });
  const adminActionQueue = await page.evaluate(() => {
    const queue = document.querySelector('[data-admin-action-queue]');
    return {
      ready: document.body.dataset.adminActionQueueReady,
      count: Number(document.body.dataset.adminActionQueueCount || 0),
      items: document.querySelectorAll('[data-admin-action-item]').length,
      text: queue ? queue.innerText : ''
    };
  });
  assert(adminActionQueue.ready === 'true', 'Dashboard admin nao marcou adminActionQueueReady=true.', failures);
  assert(adminActionQueue.items >= 1, 'Dashboard admin nao renderizou data-admin-action-item.', failures);
  assert(/DONO|Dono/i.test(adminActionQueue.text), 'Fila admin nao mostrou dono.', failures);
  assert(/ALVO|Alvo/i.test(adminActionQueue.text), 'Fila admin nao mostrou alvo.', failures);
  assert(/HOJE|ATE 24H|ATE 48H|ATE 72H|Hoje|Ate 24h|Ate 48h|Ate 72h/i.test(adminActionQueue.text), 'Fila admin nao mostrou prazo.', failures);
  await page.evaluate(() => {
    const reason = document.querySelector('[data-admin-action-reason]');
    const done = document.querySelector('[data-admin-action-status="concluida"]');
    if (reason) reason.value = 'Acao concluida pela evidencia automatizada.';
    if (done) done.click();
  });
  await page.waitForFunction(() => {
    const states = JSON.parse(localStorage.getItem('bf_operational_action_states_v1') || '{}');
    return Object.values(states).some((item) => item && item.status === 'concluida');
  }, null, { timeout: 10000 });
  const adminExecution = await page.evaluate(() => {
    const states = JSON.parse(localStorage.getItem('bf_operational_action_states_v1') || '{}');
    const audit = JSON.parse(localStorage.getItem('bf_operational_action_audit_v1') || '[]');
    const queue = document.querySelector('[data-admin-action-queue]');
    return {
      states: Object.values(states).map((item) => ({ actionKey: item.actionKey, status: item.status, reason: item.reason, owner: item.owner })),
      auditCount: audit.length,
      text: queue ? queue.innerText : ''
    };
  });
  assert(adminExecution.states.some((item) => item.status === 'concluida'), 'Fila admin nao persistiu acao concluida.', failures);
  assert(/CONCLUIDAS|Concluidas|concluida/i.test(adminExecution.text), 'Fila admin nao exibiu resumo de concluidas.', failures);
  assert(adminExecution.auditCount >= handoffExecution.auditCount + 1, 'Fila admin nao adicionou historico operacional.', failures);
  await page.locator('[data-admin-action-queue]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.adminActionQueueDesktop, fullPage: false });

  const adminProductivity = await page.evaluate(() => {
    const panel = document.querySelector('[data-admin-consultant-productivity]');
    return {
      ready: document.body.dataset.adminConsultantProductivityReady,
      count: Number(document.body.dataset.adminConsultantProductivityCount || 0),
      rows: document.querySelectorAll('[data-admin-consultant-productivity-row]').length,
      text: panel ? panel.innerText : ''
    };
  });
  assert(adminProductivity.ready === 'true', 'Dashboard admin nao marcou adminConsultantProductivityReady=true.', failures);
  assert(adminProductivity.rows >= 1, 'Dashboard admin nao renderizou produtividade por consultor.', failures);
  assert(/TEMPO MEDIO|Tempo medio/i.test(adminProductivity.text), 'Produtividade nao exibiu tempo medio.', failures);
  assert(/GARGALOS RECORRENTES|Gargalos recorrentes/i.test(adminProductivity.text), 'Produtividade nao exibiu gargalos recorrentes.', failures);
  await page.locator('[data-admin-consultant-productivity]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.adminProductivityDesktop, fullPage: false });

  const adminPortfolio = await page.evaluate(() => {
    const panel = document.querySelector('[data-admin-consultant-portfolio]');
    return {
      ready: document.body.dataset.adminConsultantPortfolioReady,
      count: Number(document.body.dataset.adminConsultantPortfolioCount || 0),
      rows: document.querySelectorAll('[data-admin-consultant-portfolio-row]').length,
      leads: document.querySelectorAll('[data-admin-consultant-portfolio-lead]').length,
      filters: document.querySelectorAll('[data-admin-portfolio-filter]').length,
      priorityItems: document.querySelectorAll('[data-admin-consultant-portfolio-priority-lead]').length,
      text: panel ? panel.innerText : ''
    };
  });
  assert(adminPortfolio.ready === 'true', 'Dashboard admin nao marcou adminConsultantPortfolioReady=true.', failures);
  assert(adminPortfolio.rows >= 1, 'Dashboard admin nao renderizou carteira por consultor.', failures);
  assert(adminPortfolio.leads >= 1, 'Carteira por consultor nao renderizou leads priorizados.', failures);
  assert(adminPortfolio.filters >= 5, 'Carteira por consultor nao renderizou filtros comerciais.', failures);
  assert(adminPortfolio.priorityItems >= 1, 'Carteira por consultor nao renderizou plano comercial do dia.', failures);
  assert(/CARTEIRA POR CONSULTOR|Carteira por consultor/i.test(adminPortfolio.text), 'Carteira nao exibiu titulo esperado.', failures);
  assert(/AGING MEDIO|Aging medio/i.test(adminPortfolio.text), 'Carteira nao exibiu aging medio.', failures);
  assert(/PROXIMO FOCO|Proximo foco/i.test(adminPortfolio.text), 'Carteira nao exibiu proximo foco.', failures);
  assert(/PLANO COMERCIAL DO DIA|Plano comercial do dia/i.test(adminPortfolio.text), 'Carteira nao exibiu plano comercial do dia.', failures);
  const adminPortfolioExport = await page.evaluate(() => {
    document.querySelector('[data-admin-consultant-portfolio-export]')?.click();
    const payload = window.__lastAdminPortfolioExport || {};
    const text = JSON.stringify(payload);
    const sensitivePattern = new RegExp('[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b|\\(?\\d{2}\\)?\\s?\\d{4,5}-\\d{4}\\b', 'i');
    return {
      schema: payload.schema,
      consultants: payload.consultants ? payload.consultants.length : 0,
      priorityActions: payload.priorityActions ? payload.priorityActions.length : 0,
      leads: payload.summary ? payload.summary.leads : 0,
      containsSensitivePattern: sensitivePattern.test(text)
    };
  });
  assert(adminPortfolioExport.schema === 'bank-fratern.admin-consultant-portfolio.v1', 'Export da carteira por consultor com schema inesperado.', failures);
  assert(adminPortfolioExport.consultants >= 1, 'Export da carteira nao incluiu consultores.', failures);
  assert(adminPortfolioExport.priorityActions >= 1, 'Export da carteira nao incluiu acoes prioritarias.', failures);
  assert(adminPortfolioExport.containsSensitivePattern === false, 'Export da carteira contem email, CPF ou telefone.', failures);
  await page.locator('[data-admin-consultant-portfolio]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.adminPortfolioDesktop, fullPage: false });

  const adminCommercialPipeline = await page.evaluate(() => {
    const panel = document.querySelector('[data-admin-commercial-pipeline]');
    return {
      ready: document.body.dataset.adminCommercialPipelineReady,
      count: Number(document.body.dataset.adminCommercialPipelineCount || 0),
      stages: document.querySelectorAll('[data-admin-commercial-stage]').length,
      leads: document.querySelectorAll('[data-admin-commercial-lead]').length,
      selects: document.querySelectorAll('[data-admin-commercial-stage-select]').length,
      history: document.querySelectorAll('[data-admin-commercial-stage-history]').length,
      insights: document.querySelectorAll('[data-admin-commercial-stage-insights]').length,
      summaries: document.querySelectorAll('[data-admin-commercial-stage-summary]').length,
      text: panel ? panel.innerText : ''
    };
  });
  assert(adminCommercialPipeline.ready === 'true', 'Dashboard admin nao marcou adminCommercialPipelineReady=true.', failures);
  assert(adminCommercialPipeline.stages === 5, 'Funil comercial deveria renderizar 5 etapas.', failures);
  assert(adminCommercialPipeline.leads >= 1, 'Funil comercial nao renderizou lead em etapa.', failures);
  assert(adminCommercialPipeline.selects >= 1, 'Funil comercial nao renderizou seletor para mover etapa.', failures);
  assert(adminCommercialPipeline.history >= 1, 'Funil comercial nao renderizou historico de etapa.', failures);
  assert(adminCommercialPipeline.insights === 1, 'Funil comercial nao renderizou cadencia comercial.', failures);
  assert(adminCommercialPipeline.summaries === 5, 'Cadencia comercial deveria renderizar resumo das 5 etapas.', failures);
  assert(/ETAPAS COMERCIAIS DOS LEADS|Etapas comerciais dos leads/i.test(adminCommercialPipeline.text), 'Funil comercial nao exibiu titulo esperado.', failures);
  assert(/MOVER ETAPA|Mover etapa/i.test(adminCommercialPipeline.text), 'Funil comercial nao exibiu controle de mover etapa.', failures);
  assert(/CADENCIA COMERCIAL|Cadencia comercial/i.test(adminCommercialPipeline.text), 'Funil comercial nao exibiu cadencia comercial.', failures);
  ['Contato', 'Proposta', 'Follow-up', 'Negociacao', 'Fechamento'].forEach((label) => {
    assert(adminCommercialPipeline.text.toLowerCase().includes(label.toLowerCase()), `Funil comercial nao exibiu etapa ${label}.`, failures);
  });
  const adminCommercialStageMove = await page.evaluate(() => {
    const select = document.querySelector('[data-admin-commercial-stage-select]');
    const handoffId = select ? select.getAttribute('data-admin-commercial-stage-select') : '';
    if (select) {
      select.value = 'followup';
      select.dispatchEvent(new Event('change', { bubbles: true }));
    }
    const states = JSON.parse(localStorage.getItem('bf_admin_commercial_stage_states_v1') || '{}');
    const audit = JSON.parse(localStorage.getItem('bf_admin_commercial_stage_audit_v1') || '[]');
    const handoffs = JSON.parse(localStorage.getItem('bf_consultive_handoffs_v1') || '[]');
    const updated = handoffs.find((item) => item.id === handoffId) || {};
    const panel = document.querySelector('[data-admin-commercial-pipeline]');
    return {
      handoffId,
      savedStage: states[handoffId] && states[handoffId].stage,
      savedStatus: states[handoffId] && states[handoffId].status,
      handoffStatus: updated.status,
      auditCount: audit.length,
      latestStage: audit[0] && audit[0].toStage,
      latestStatus: audit[0] && audit[0].status,
      insightsReady: document.body.dataset.adminCommercialStageInsightsReady,
      moved24: Number(document.body.dataset.adminCommercialStageMoved24 || 0),
      stuckCount: Number(document.body.dataset.adminCommercialStageStuckCount || 0),
      movements: document.querySelectorAll('[data-admin-commercial-stage-movement]').length,
      summaries: document.querySelectorAll('[data-admin-commercial-stage-summary]').length,
      text: panel ? panel.innerText : ''
    };
  });
  assert(adminCommercialStageMove.handoffId, 'Funil comercial nao encontrou lead para mover.', failures);
  assert(adminCommercialStageMove.savedStage === 'followup', `Movimento comercial deveria salvar followup, recebeu ${adminCommercialStageMove.savedStage}.`, failures);
  assert(adminCommercialStageMove.savedStatus === 'aguardando_cliente', `Movimento comercial deveria salvar status aguardando_cliente, recebeu ${adminCommercialStageMove.savedStatus}.`, failures);
  assert(adminCommercialStageMove.handoffStatus === 'aguardando_cliente', `Handoff deveria refletir aguardando_cliente, recebeu ${adminCommercialStageMove.handoffStatus}.`, failures);
  assert(adminCommercialStageMove.auditCount >= 1, 'Movimento comercial nao gerou auditoria local.', failures);
  assert(adminCommercialStageMove.latestStage === 'followup', `Auditoria comercial deveria registrar followup, recebeu ${adminCommercialStageMove.latestStage}.`, failures);
  assert(adminCommercialStageMove.latestStatus === 'aguardando_cliente', `Auditoria comercial deveria registrar status aguardando_cliente, recebeu ${adminCommercialStageMove.latestStatus}.`, failures);
  assert(adminCommercialStageMove.insightsReady === 'true', 'Cadencia comercial nao marcou readiness no body.', failures);
  assert(adminCommercialStageMove.moved24 >= 1, 'Cadencia comercial nao contou movimentacao em 24h.', failures);
  assert(adminCommercialStageMove.movements >= 1, 'Cadencia comercial nao listou movimentacao recente.', failures);
  assert(adminCommercialStageMove.summaries === 5, 'Cadencia comercial nao preservou resumo das 5 etapas apos mover lead.', failures);
  assert(/Movido para Follow-up|Follow-up/i.test(adminCommercialStageMove.text), 'Funil comercial nao refletiu a etapa movida para Follow-up.', failures);
  assert(/Movimentacoes recentes|Retomadas sugeridas/i.test(adminCommercialStageMove.text), 'Cadencia comercial nao exibiu blocos de gestao comercial.', failures);
  const adminCommercialPipelineExport = await page.evaluate(() => {
    document.querySelector('[data-admin-commercial-pipeline-export]')?.click();
    const payload = window.__lastAdminCommercialPipelineExport || {};
    const text = JSON.stringify(payload);
    const sensitivePattern = new RegExp('[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}|\\b\\d{3}\\.?\\d{3}\\.?\\d{3}-?\\d{2}\\b|\\(?\\d{2}\\)?\\s?\\d{4,5}-\\d{4}\\b', 'i');
    const stageLeads = (payload.stages || []).flatMap((stage) => stage.leads || []);
    return {
      schema: payload.schema,
      stages: payload.stages ? payload.stages.length : 0,
      leads: payload.summary ? payload.summary.leads : 0,
      stageLeads: stageLeads.length,
      movements: payload.recentMovements ? payload.recentMovements.length : 0,
      stuck: payload.stuckLeads ? payload.stuckLeads.length : 0,
      anonymized: payload.privacy && payload.privacy.anonymized === true,
      leadRefsOk: stageLeads.every((lead) => /^lead-\d{3}$/.test(lead.leadRef || '')),
      containsSensitivePattern: sensitivePattern.test(text)
    };
  });
  assert(adminCommercialPipelineExport.schema === 'bank-fratern.admin-commercial-pipeline.v1', 'Export do funil comercial com schema inesperado.', failures);
  assert(adminCommercialPipelineExport.stages === 5, 'Export do funil comercial deveria preservar 5 etapas.', failures);
  assert(adminCommercialPipelineExport.leads >= 1, 'Export do funil comercial nao incluiu leads no resumo.', failures);
  assert(adminCommercialPipelineExport.stageLeads >= 1, 'Export do funil comercial nao incluiu leads anonimizados por etapa.', failures);
  assert(adminCommercialPipelineExport.movements >= 1, 'Export do funil comercial nao incluiu movimentacoes recentes.', failures);
  assert(adminCommercialPipelineExport.anonymized === true, 'Export do funil comercial nao marcou anonimizacao.', failures);
  assert(adminCommercialPipelineExport.leadRefsOk === true, 'Export do funil comercial nao gerou referencias anonimas de lead.', failures);
  assert(adminCommercialPipelineExport.containsSensitivePattern === false, 'Export do funil comercial contem email, CPF ou telefone.', failures);
  await page.locator('[data-admin-commercial-pipeline]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.adminCommercialPipelineDesktop, fullPage: false });

  await page.goto(`${baseUrl}/handoff-consultivo.html?handoffId=${encodeURIComponent(adminCommercialStageMove.handoffId)}#detalhe-handoff`, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => document.body.dataset.handoffReady === 'true', null, { timeout: 15000 });
  const handoffCommercialStage = await page.evaluate(() => {
    const detail = document.querySelector('[data-handoff-detail]');
    const cockpit = document.querySelector('[data-handoff-consultant-cockpit]');
    const panel = document.querySelector('[data-handoff-commercial-stage-panel]');
    return {
      ready: document.body.dataset.handoffReady,
      consultantReady: document.body.dataset.handoffConsultantCockpitReady,
      stages: document.querySelectorAll('[data-handoff-commercial-stage]').length,
      panels: document.querySelectorAll('[data-handoff-commercial-stage-panel]').length,
      history: document.querySelectorAll('[data-handoff-commercial-stage-history]').length,
      detailText: detail ? detail.innerText : '',
      cockpitText: cockpit ? cockpit.innerText : '',
      panelText: panel ? panel.innerText : ''
    };
  });
  assert(handoffCommercialStage.ready === 'true', 'Handoff comercial nao marcou pagina pronta.', failures);
  assert(handoffCommercialStage.consultantReady === 'true', 'Cockpit do consultor nao marcou readiness apos etapa comercial.', failures);
  assert(handoffCommercialStage.stages >= 1, 'Handoff nao renderizou data-handoff-commercial-stage.', failures);
  assert(handoffCommercialStage.panels >= 1, 'Handoff nao renderizou painel de etapa comercial.', failures);
  assert(handoffCommercialStage.history >= 1, 'Handoff nao renderizou historico da etapa comercial.', failures);
  assert(/Follow-up/i.test(handoffCommercialStage.detailText), 'Handoff nao exibiu a etapa comercial Follow-up no detalhe.', failures);
  assert(/Andamento comercial/i.test(handoffCommercialStage.panelText), 'Painel de etapa comercial nao exibiu o andamento comercial.', failures);
  assert(/Proposta\s*->\s*Follow-up|Follow-up/i.test(handoffCommercialStage.panelText), 'Painel de etapa comercial nao exibiu ultima movimentacao.', failures);
  assert(/Conversas paradas/i.test(handoffCommercialStage.cockpitText), 'Cockpit nao exibiu metrica de conversas paradas.', failures);
  assert(/Avanços nas últimas 24h/i.test(handoffCommercialStage.cockpitText), 'Cockpit nao exibiu metrica de avancos nas ultimas 24h.', failures);
  await page.locator('[data-handoff-commercial-stage-panel]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.handoffCommercialDesktop, fullPage: false });

  const report = {
    ok: failures.length === 0,
    baseUrl,
    flow,
    handoffPage,
    handoffExecution,
    adminActionQueue,
    adminExecution,
    adminProductivity,
    adminPortfolio,
    adminPortfolioExport,
    adminCommercialPipeline,
    adminCommercialStageMove,
    adminCommercialPipelineExport,
    handoffCommercialStage,
    screenshots: reportScreenshots(),
    consoleErrors: consoleErrors.slice(0, 20),
    pageErrors,
    notFound: [...new Set(notFound)].slice(0, 20),
    failures
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  if (failures.length) process.exitCode = 1;
} catch (error) {
  const report = {
    ok: false,
    baseUrl,
    screenshots: reportScreenshots(),
    consoleErrors: consoleErrors.slice(0, 20),
    pageErrors,
    notFound: [...new Set(notFound)].slice(0, 20),
    failures: failures.concat(error.message)
  };
  await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report, null, 2));
  process.exitCode = 1;
} finally {
  await browser.close();
}
