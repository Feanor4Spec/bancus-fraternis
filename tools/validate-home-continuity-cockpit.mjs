import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(String(key));
  }
}

function elementMock() {
  return {
    innerHTML: '',
    textContent: '',
    value: '',
    style: { setProperty() {} },
    classList: { add() {}, remove() {}, toggle() {} },
    addEventListener() {},
    insertAdjacentElement() {}
  };
}

function documentMock(elements) {
  return {
    body: { dataset: {} },
    addEventListener() {},
    querySelector(selector) {
      if (!elements.has(selector)) elements.set(selector, elementMock());
      return elements.get(selector);
    },
    querySelectorAll() {
      return [];
    },
    getElementById(id) {
      const selector = `#${id}`;
      if (!elements.has(selector)) elements.set(selector, elementMock());
      return elements.get(selector);
    },
    createElement() {
      return elementMock();
    }
  };
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function containsPersonalData(value) {
  return /cpf|telefone|whatsapp|cliente@example|123\.456/i.test(String(value || ''));
}

const indexHtml = await readText('pages/index.html');
assert(indexHtml.includes('data-home-continuity-cockpit'), 'index.html sem data-home-continuity-cockpit.');
assert(indexHtml.includes('data-home-continuity-metrics'), 'index.html sem data-home-continuity-metrics.');
assert(indexHtml.includes('data-home-next-actions'), 'index.html sem data-home-next-actions.');
assert(indexHtml.includes('decision-context.service.js'), 'index.html sem decision-context.service.js.');
assert(indexHtml.includes('trilha-decisao.service.js'), 'index.html sem trilha-decisao.service.js.');

const elements = new Map();
const context = {
  console,
  localStorage: new LocalStorageMock(),
  location: { pathname: '/pages/index.html', search: '' },
  document: documentMock(elements),
  window: null,
  Intl,
  Date,
  Math,
  setTimeout,
  clearTimeout
};
context.window = context;
context.globalThis = context;
context.addEventListener = () => {};
context.BFAuth = { getCurrentUser() { return null; } };
vm.createContext(context);

for (const script of [
  'assets/js/services/decision-context.service.js',
  'assets/js/services/trilha-decisao.service.js',
  'js/storage.js',
  'js/home.js'
]) {
  vm.runInContext(await readText(script), context, { filename: script });
}

vm.runInContext(`
  BFDecisionContext.saveProfilePatch({
    cpf: '123.456.789-00',
    telefone: '(11) 99999-9999',
    email: 'cliente@example.com',
    rendaMensal: 12000,
    gastoMensal: 5200,
    reservaAtual: 36000,
    capacidadePagamento: 2600
  }, 'home-validator');
  BFDecisionContext.saveHistoryEntry({
    calculatorSlug: 'capacidade-credito',
    calculatorName: 'Capacidade de credito',
    recommendation: 'Use ate R$ 2.600 como parcela segura.',
    profilePatch: { capacidadePagamento: 2600 },
    readinessScore: 92
  });
  Storage.saveSimulation('Simulacao Home', {
    nome: 'Simulacao Home',
    totalCarta: 250000,
    totalCotas: 1,
    segmentos: ['Consorcio']
  });
  BFTrilhaDecisaoService.save({
    id: 'JOURNEY-HOME-1',
    schema: 'bank-fratern.decision-journey.v1',
    createdAt: '2026-05-07T12:00:00.000Z',
    owner: 'anon',
    objective: 'comprar_bem',
    objectiveLabel: 'Comprar bem',
    profile: {
      rendaMensal: 12000,
      gastoMensal: 5200,
      dividasMensais: 0,
      reservaAtual: 36000,
      valorObjetivo: 250000,
      valorCredito: 220000,
      entrada: 30000,
      capacidadeAporte: 6800,
      capacidadePagamento: 2600,
      comprometimentoRenda: 43
    },
    recommendedProduct: { id: 'consorcio', nome: 'Consorcio' },
    recommendedModel: { id: 'std-compra-bem-planejada', name: 'Compra de bem com planejamento' },
    nextAction: {
      type: 'comparacao',
      label: 'Comparar alternativas',
      title: 'Abrir comparador com modelo recomendado',
      href: 'comparador.html?preset=comprar_bem'
    },
    recommendation: {
      title: 'Consorcio com compra planejada',
      next: 'Abrir comparador com modelo recomendado'
    }
  });
`, context);

assert(context.BFHome && typeof context.BFHome.renderContinuityCockpit === 'function', 'BFHome sem renderContinuityCockpit().');
assert(context.BFHome && typeof context.BFHome.buildContinuityModel === 'function', 'BFHome sem buildContinuityModel().');

const model = context.BFHome.renderContinuityCockpit();
const metricsHtml = elements.get('[data-home-continuity-metrics]').innerHTML;
const cardsHtml = elements.get('[data-home-continuity-cards]').innerHTML;
const actionsHtml = elements.get('[data-home-next-actions]').innerHTML;
const allHtml = `${metricsHtml}\n${cardsHtml}\n${actionsHtml}`;

assert(model && model.status.score >= 80, `Cockpit deveria reconhecer perfil pronto, obteve ${model && model.status.score}.`);
assert(model.history.length === 1, `Cockpit deveria ler 1 historico, obteve ${model.history.length}.`);
assert(model.simulations.length === 1, `Cockpit deveria ler 1 simulacao, obteve ${model.simulations.length}.`);
assert(model.activeJourney && model.activeJourney.id === 'JOURNEY-HOME-1', 'Cockpit nao leu trilha assistida ativa.');
assert(model.metrics.journey === 1, `Cockpit deveria marcar 1 trilha ativa, obteve ${model.metrics.journey}.`);
assert(metricsHtml.includes('Prontidao') && metricsHtml.includes('/100'), 'Metricas nao exibem prontidao.');
assert(metricsHtml.includes('Trilha') && metricsHtml.includes('Ativa'), 'Metricas nao exibem trilha ativa.');
assert(cardsHtml.includes('Capacidade de credito'), 'Cards nao exibem ultima calculadora.');
assert(cardsHtml.includes('Trilha assistida') && cardsHtml.includes('Comprar bem'), 'Cards nao exibem trilha assistida ativa.');
assert(cardsHtml.includes('Simulacao Home'), 'Cards nao exibem ultima simulacao.');
assert(actionsHtml.includes('comparador.html') || actionsHtml.includes('calculadora-compra-vista-parcelado.html'), 'Acoes nao exibem continuidade recomendada.');
assert(actionsHtml.includes('comparador.html?preset=comprar_bem'), 'Acoes nao priorizam deep link da trilha ativa.');
assert(context.document.body.dataset.homeContinuityReady === 'true', 'Body dataset nao marcou cockpit pronto.');
assert(context.document.body.dataset.homeContinuityJourney === 'active', 'Body dataset nao marcou trilha ativa.');
assert(!containsPersonalData(allHtml), 'Cockpit renderizou dado pessoal bloqueado.');

const report = {
  ok: failures.length === 0,
  homeContinuity: {
    readinessScore: model && model.status.score,
    history: model && model.history.length,
    simulations: model && model.simulations.length,
    journey: model && model.activeJourney && {
      id: model.activeJourney.id,
      objective: model.activeJourney.objective,
      nextHref: model.activeJourney.nextAction && model.activeJourney.nextAction.href
    },
    recommended: model && model.recommendations.map((item) => item.href),
    datasetReady: context.document.body.dataset.homeContinuityReady === 'true',
    datasetJourney: context.document.body.dataset.homeContinuityJourney
  },
  uiContract: {
    cockpit: indexHtml.includes('data-home-continuity-cockpit'),
    metrics: indexHtml.includes('data-home-continuity-metrics'),
    actions: indexHtml.includes('data-home-next-actions'),
    decisionContext: indexHtml.includes('decision-context.service.js'),
    decisionJourney: indexHtml.includes('trilha-decisao.service.js')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8ab-home-continuity-cockpit-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
