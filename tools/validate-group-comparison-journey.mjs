import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const baseUrl = String(process.env.BF_GROUP_COMPARE_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const reportPath = path.join(root, 'docs', 'test-reports', 'group-comparison-journey-report.json');
const screenshotDir = path.join(root, 'docs', 'test-prints');
const targetGroupKey = '00000776|202512|1|79';
const checks = [];
const failures = [];
const browserErrors = [];

function check(id, condition, evidence = {}) {
  const ok = Boolean(condition);
  checks.push({ id, ok, evidence });
  if (!ok) failures.push(id);
}

function loadPlaywright() {
  const candidates = [
    path.join(root, 'node_modules', 'playwright'),
    path.join(
      process.env.USERPROFILE || '',
      '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'
    )
  ];
  const errors = [];
  for (const candidate of candidates) {
    try {
      return { module: require(candidate), source: candidate };
    } catch (error) {
      errors.push(`${candidate}: ${error.code || error.message}`);
    }
  }
  throw new Error(`Playwright indisponível. ${errors.join(' | ')}`);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [simulator, groupPage, comparisonSource, comparisonCss, groupController, appSource, publicContracts] = await Promise.all([
  read('pages/simulador.html'),
  read('pages/grupo.html'),
  read('js/group-comparison-journey.js'),
  read('css/group-comparison-journey.css'),
  read('js/group-intelligence.js'),
  read('js/app.js'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md')
]);

const sandbox = {};
sandbox.globalThis = sandbox;
vm.runInNewContext(comparisonSource, sandbox, { filename: 'group-comparison-journey.js' });
const policy = sandbox.BFGroupComparisonJourney;
const empty = policy.deriveState([]);
const selecting = policy.deriveState([{ code: '79', admin: 'ITAÚ' }]);
const ready = policy.deriveState([{ code: '79' }, { code: '57' }]);
const multiple = policy.deriveState([{ code: '79' }, { code: '57' }, { code: '183' }]);

check('source.cta-two-surfaces', (groupPage.match(/data-compare-group/g) || []).length === 2);
check('source.cta-native-buttons', (groupPage.match(/<button[^>]+data-compare-group/g) || []).length === 2);
check('source.intent-query', /compareGroupKey/.test(groupController) && /intent === 'compare'/.test(groupController));
check('source.guide-contract', /data-group-comparison-guide/.test(simulator) && /data-comparison-live[^>]+aria-live="polite"/.test(simulator));
check('source.quick-note', /data-comparison-quick-note/.test(simulator) && /Comparação inicial sem lance/.test(simulator));
check('source.script-order', simulator.indexOf('../js/app.js') < simulator.indexOf('../js/group-comparison-journey.js'));
check('source.targeted-options', /data-group-key=/.test(appSource) && /selectComparisonPair/.test(comparisonSource));
check('source.human-group-labels', /Primeiro grupo/.test(simulator) && /Segundo grupo/.test(simulator)
  && /Somente o valor da carta/.test(simulator) && !/Grupo A \(Principal\)/.test(simulator)
  && /Grupo \$\{g\.codigoGrupo\} ·/.test(appSource));
check('source.explicit-return-precedence', appSource.indexOf("const explicit = params.get('groupReturn')")
  < appSource.indexOf('activeToken?.()'));
check('source.explicit-return-fail-closed', /validToken\?\.\(explicit\) \? explicit : ''/.test(appSource));
check('source.preview-mode', /comparisonMode = 'preview'/.test(comparisonSource) && /data-comparison-mode="preview"/.test(comparisonCss));
check('source.responsive', /@media \(max-width: 760px\)/.test(comparisonCss) && /@media \(max-width: 420px\)/.test(comparisonCss));
check('source.client-commercial-surface', /normalizeCommercialSurface/.test(comparisonSource)
  && /simulator-client-flow \.group-priority-method/.test(comparisonCss));
check('source.no-generated-language', !/(gerado por ia|texto de ia|nova funcionalidade|versão atualizada|prompt executivo)/i.test(`${simulator}\n${groupPage}`));
check('policy.empty', empty.phase === 'empty' && empty.canCompare === false && empty.primary === 'Escolher primeiro grupo');
check('policy.selecting', selecting.phase === 'selecting' && selecting.canCompare === false && /Grupo 79/.test(selecting.title));
check('policy.ready', ready.phase === 'ready' && ready.canCompare === true && ready.progress === '2 de 2 grupos');
check('policy.multiple', multiple.phase === 'ready' && multiple.canAddMore === true && /3 grupos/.test(multiple.title));
check('contracts.documented', /data-group-comparison-guide/.test(publicContracts) && /validate-group-comparison-journey/.test(publicContracts));

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.mkdir(screenshotDir, { recursive: true });

const playwright = loadPlaywright();
let browser;
try {
  const response = await fetch(`${baseUrl}/api/auth/config`);
  check('browser.server-available', response.ok, { status: response.status, baseUrl });
  const authConfig = await response.json();
  check('browser.demo-mode', authConfig?.mode === 'demo', { mode: authConfig?.mode });

  try {
    browser = await playwright.module.chromium.launch({ channel: 'msedge', headless: true });
  } catch (error) {
    browser = await playwright.module.chromium.launch({ headless: true });
  }
  const context = await browser.newContext({ viewport: { width: 1280, height: 720 }, locale: 'pt-BR', reducedMotion: 'reduce' });
  const page = await context.newPage();
  page.on('pageerror', (error) => browserErrors.push(error.message));
  page.on('console', (message) => { if (message.type() === 'error') browserErrors.push(message.text()); });

  const simulatorRedirect = 'simulador.html?from=dashboard';
  await page.goto(`${baseUrl}/pages/login.html?redirect=${encodeURIComponent(simulatorRedirect)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-demo-login]').nth(2).click();
  await page.waitForURL(/simulador\.html/);
  await page.locator('#loading-overlay').waitFor({ state: 'hidden', timeout: 30000 });

  await page.evaluate(() => {
    const groupsStep = document.querySelector('[data-evolution-step="4"]');
    groupsStep?.setAttribute('onclick', 'App.goToStep(4,{skipValidation:true,skipAutoSearch:true})');
    groupsStep?.click();
  });
  await page.waitForFunction(() => document.body.dataset.activeStep === '4');
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.screenshot({ path: path.join(screenshotDir, 'group-comparison-guide-empty-1280x720.png'), fullPage: false });

  const staleToken = await page.evaluate(() => window.BFGroupJourney?.create?.({ source: { step: 3 }, cart: [] }) || '');
  check('browser.stale-token-fixture', /^GRS-/.test(staleToken), { staleToken });

  await page.goto(`${baseUrl}/pages/grupo.html?groupKey=${encodeURIComponent(targetGroupKey)}`, { waitUntil: 'domcontentloaded' });
  await page.locator('[data-group-content]').waitFor({ state: 'visible', timeout: 30000 });
  const compareCta = page.locator('[data-compare-group]').first();
  const ctaBox = await compareCta.boundingBox();
  check('browser.cta-visible-and-sized', Boolean(ctaBox) && ctaBox.height >= 44 && ctaBox.width >= 44, ctaBox || {});
  await compareCta.click();

  await page.waitForURL(/simulador\.html/);
  await page.locator('#loading-overlay').waitFor({ state: 'hidden', timeout: 30000 });
  await page.waitForFunction(() => document.body.dataset.activeStep === '4');
  await page.waitForFunction(() => document.querySelectorAll('#selected-groups-panel .selected-group-row').length === 1);

  const oneGroupState = await page.evaluate(() => ({
    guideState: document.querySelector('[data-group-comparison-guide]')?.dataset.state,
    selectedCount: document.querySelectorAll('#selected-groups-panel .selected-group-row').length,
    url: location.href,
    storedIntent: Boolean(sessionStorage.getItem('bf_group_compare_intent_v1')),
    directSelection: sessionStorage.getItem('bf_group_selection_v1:direct'),
    guideText: document.querySelector('[data-group-comparison-guide]')?.innerText || '',
    priorityMethodVisible: Boolean(document.querySelector('.group-priority-method')?.getClientRects().length),
    sortLabel: document.querySelector('#shelfSort option[value="maior_score"]')?.textContent?.trim() || '',
    scoreHeader: document.querySelector('#shelf-table th[data-shelf-col="score"]')?.textContent?.trim() || ''
  }));
  check('browser.direct-return-prefers-explicit', oneGroupState.selectedCount === 1 && oneGroupState.guideState === 'selecting', oneGroupState);
  check('browser.navigation-cleaned', !/[?&](?:from|restore|groupReturn|useGroup|compareGroup|compareGroupKey)=/.test(oneGroupState.url), { url: oneGroupState.url });
  check('browser.selection-consumed', oneGroupState.directSelection === null);
  check('browser.intent-preserved-until-pair', oneGroupState.storedIntent === true);
  check('browser.client-commercial-surface', oneGroupState.priorityMethodVisible === false
    && oneGroupState.sortLabel === 'Mais adequados'
    && oneGroupState.scoreHeader === 'Compatibilidade', oneGroupState);

  const addButton = page.locator('#shelf-table-body .shelf-row:not(.shelf-row--added) button[aria-label^="Adicionar grupo"]').first();
  await addButton.waitFor({ state: 'visible', timeout: 15000 });
  await addButton.click();
  await page.waitForFunction(() => document.body.dataset.activeStep === '9' && document.body.dataset.comparisonMode === 'preview');
  await page.locator('#comp-cards-container').waitFor({ state: 'visible', timeout: 15000 });
  await page.waitForTimeout(3200);

  const comparisonState = await page.evaluate(() => {
    const a = document.querySelector('#compGrupoA');
    const b = document.querySelector('#compGrupoB');
    return {
      selectedCount: document.querySelectorAll('#selected-groups-panel .selected-group-row').length,
      aValue: a?.value || '',
      bValue: b?.value || '',
      aGroupKey: a?.selectedOptions?.[0]?.dataset.groupKey || '',
      bGroupKey: b?.selectedOptions?.[0]?.dataset.groupKey || '',
      noteVisible: !document.querySelector('[data-comparison-quick-note]')?.hidden,
      railStep: document.querySelector('[data-evolution-current-step]')?.textContent?.trim() || '',
      progressVisibility: getComputedStyle(document.querySelector('.sim-evolution-rail__progress')).visibility,
      ownBid: document.querySelector('#compLanceProprio')?.value,
      embeddedBid: document.querySelector('#compLanceEmbutido')?.value,
      groupTags: Array.from(document.querySelectorAll('.comp-card__group-tag')).map((element) => element.textContent.trim()),
      differenceLabels: Array.from(document.querySelectorAll('.comp-card__delta')).map((element) => element.textContent.trim()),
      winnerLabels: Array.from(document.querySelectorAll('.comp-winner-badge')).map((element) => element.textContent.trim()),
      statusText: document.querySelector('[data-comparison-status]')?.textContent?.trim() || '',
      reducedPaymentFocusable: document.querySelector('#compParcelaReduzida')?.tabIndex === 0
        && getComputedStyle(document.querySelector('#compParcelaReduzida')).display !== 'none',
      intent: sessionStorage.getItem('bf_group_compare_intent_v1')
    };
  });
  check('browser.cardinality', comparisonState.selectedCount === 2, comparisonState);
  check('browser.target-is-group-a', comparisonState.aGroupKey === targetGroupKey, comparisonState);
  check('browser.distinct-pair', comparisonState.aValue !== comparisonState.bValue && comparisonState.bGroupKey !== targetGroupKey, comparisonState);
  check('browser.preview-is-explicit', comparisonState.noteVisible && comparisonState.railStep === 'Prévia de comparação'
    && comparisonState.progressVisibility === 'hidden', comparisonState);
  check('browser.preview-neutral-bid', comparisonState.ownBid === '0' && comparisonState.embeddedBid === '0', comparisonState);
  check('browser.human-comparison-language', comparisonState.groupTags.every((label) => /^Grupo\s+\S+/.test(label))
    && comparisonState.differenceLabels.every((label) => !/^Δ/.test(label))
    && comparisonState.winnerLabels.every((label) => label === 'Destaque'), comparisonState);
  check('browser.comparison-announced', comparisonState.statusText === 'Comparação atualizada.' && comparisonState.reducedPaymentFocusable, comparisonState);
  check('browser.intent-consumed-after-open', comparisonState.intent === null);

  const activeText = await page.locator('#step-9').innerText();
  check('browser.no-render-artifacts', !/(?:undefined|null|NaN|Infinity|\[object Object\])/i.test(activeText));
  check('browser.commercial-language', !/\b(?:IA|AI|inteligência artificial|algoritmo|heurística|score|snapshot|payload|schema|endpoint|fallback|debug|mock|gate|release|prompt executivo|nova funcionalidade|versão atualizada)\b/i
    .test(`${oneGroupState.guideText}\n${activeText}`));
  await page.screenshot({ path: path.join(screenshotDir, 'group-comparison-preview-1280x720.png'), fullPage: true });

  await page.locator('[data-comparison-back]').click();
  await page.waitForFunction(() => document.body.dataset.activeStep === '4' && !document.body.dataset.comparisonMode);
  check('browser.back-to-groups', await page.locator('[data-group-comparison-guide]').getAttribute('data-state') === 'ready');
  await page.setViewportSize({ width: 1280, height: 720 });
  await page.waitForTimeout(180);
  await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'auto' }));
  await page.waitForTimeout(60);
  await page.screenshot({ path: path.join(screenshotDir, 'group-comparison-guide-1280x720.png'), fullPage: false });

  await page.setViewportSize({ width: 360, height: 800 });
  await page.waitForTimeout(250);
  const mobile = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    clientWidth: document.documentElement.clientWidth,
    mobileMediaMatches: matchMedia('(max-width: 760px)').matches,
    guideWidth: document.querySelector('[data-group-comparison-guide]')?.getBoundingClientRect().width || 0,
    unnamedVisibleControls: Array.from(document.querySelectorAll('button:not([hidden]), a[href]:not([hidden]), input:not([type="hidden"]), select'))
      .filter((element) => element.getClientRects().length && !(element.getAttribute('aria-label') || element.textContent?.trim() || element.labels?.[0]?.textContent?.trim())).length,
    duplicateIds: [...document.querySelectorAll('[id]')].map((element) => element.id)
      .filter((id, index, all) => all.indexOf(id) !== index),
    layoutWidths: ['#shelf-table', '#step-4 > .card .table-wrapper', '#selected-groups-panel', '.selected-groups-footer', '.selected-groups-panel-wrapper', '#step-4', '.sim-main', '.sim-layout', 'body', 'html']
      .map((selector) => document.querySelector(selector))
      .filter(Boolean)
      .map((element) => ({
        selector: element.id ? `#${element.id}` : element.className || element.tagName,
        clientWidth: element.clientWidth,
        scrollWidth: element.scrollWidth,
        overflowX: getComputedStyle(element).overflowX,
        parent: element.parentElement?.className || element.parentElement?.id || element.parentElement?.tagName || ''
      })),
    overflowElements: Array.from(document.querySelectorAll('body *'))
      .filter((element) => !element.closest('.table-wrapper'))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { tag: element.tagName, id: element.id, className: String(element.className || ''), left: rect.left, right: rect.right, width: rect.width };
      })
      .filter((item) => item.right > document.documentElement.clientWidth + 1 || item.left < -1)
      .sort((a, b) => b.right - a.right)
      .slice(0, 8)
  }));
  check('browser.mobile-no-overflow', mobile.scrollWidth <= mobile.clientWidth, mobile);
  check('browser.controls-named', mobile.unnamedVisibleControls === 0, mobile);
  check('browser.no-duplicate-ids', mobile.duplicateIds.length === 0, mobile);
  await page.screenshot({ path: path.join(screenshotDir, 'group-comparison-guide-360x800.png'), fullPage: false });

  await page.locator('[data-comparison-primary]').click();
  await page.waitForFunction(() => document.body.dataset.activeStep === '9' && document.body.dataset.comparisonMode === 'preview');
  await page.locator('[data-comparison-next]').click();
  await page.waitForFunction(() => !document.body.dataset.comparisonMode && document.body.dataset.activeStep !== '9');
  const resumedAt = await page.locator('body').getAttribute('data-active-step');
  check('browser.resume-incomplete-journey', ['1', '2', '3', '4', '5'].includes(resumedAt), { resumedAt });

  check('browser.runtime-errors', browserErrors.length === 0, { browserErrors });
  await context.close();
} catch (error) {
  check('browser.execution', false, { error: error.stack || error.message });
} finally {
  await browser?.close();
}

const report = {
  ok: failures.length === 0,
  generatedAt: new Date().toISOString(),
  baseUrl,
  targetGroupKey,
  playwrightSource: playwright.source.startsWith(root)
    ? path.relative(root, playwright.source).replace(/\\/g, '/')
    : playwright.source,
  checks,
  failures,
  browserErrors
};

await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
