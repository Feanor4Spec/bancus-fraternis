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
  handoffDesktop: path.join(printsDir, 'v8af-handoff-proposta-desktop.png')
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
    return {
      ready: document.body.dataset.handoffReady,
      cards: cards.length,
      expectedFound: !!card && card.getAttribute('data-handoff-card') === expectedId,
      text: card ? card.innerText : ''
    };
  }, flow.createdId);

  assert(handoffPage.ready === 'true', 'Pagina handoff nao marcou data-handoff-ready=true.', failures);
  assert(handoffPage.cards >= 1, 'Pagina handoff nao renderizou cards.', failures);
  assert(handoffPage.expectedFound, 'Pagina handoff nao exibiu o lead criado pela proposta.', failures);
  await page.locator('[data-handoff-list]').scrollIntoViewIfNeeded();
  await page.screenshot({ path: screenshots.handoffDesktop, fullPage: false });

  const report = {
    ok: failures.length === 0,
    baseUrl,
    flow,
    handoffPage,
    screenshots,
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
    screenshots,
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
