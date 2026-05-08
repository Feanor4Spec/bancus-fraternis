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

  clear() {
    this.store.clear();
  }
}

function elementMock() {
  return {
    dataset: {},
    href: '',
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

function valueOf(elements, selector, prop = 'textContent') {
  const element = elements.get(selector);
  return element ? element[prop] : '';
}

function containsPersonalData(value) {
  return /cpf|telefone|whatsapp|cliente@example|123\.456|99999|789-00/i.test(String(value || ''));
}

const indexHtml = await readText('pages/index.html');
assert(indexHtml.includes('data-home-hero-contextual'), 'index.html sem data-home-hero-contextual.');
assert(indexHtml.includes('data-home-hero-title'), 'index.html sem data-home-hero-title.');
assert(indexHtml.includes('data-home-hero-primary'), 'index.html sem data-home-hero-primary.');
assert(indexHtml.includes('data-home-hero-context-strip'), 'index.html sem data-home-hero-context-strip.');
assert(indexHtml.includes('data-home-hero-panel-score'), 'index.html sem data-home-hero-panel-score.');
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

assert(context.BFHome && typeof context.BFHome.renderContextualHero === 'function', 'BFHome sem renderContextualHero().');
assert(context.BFHome && typeof context.BFHome.buildHeroContext === 'function', 'BFHome sem buildHeroContext().');

const diagnostic = context.BFHome.renderContextualHero();
const diagnosticPrimary = valueOf(elements, '[data-home-hero-primary]', 'href');
assert(diagnostic && diagnostic.hero.stage === 'diagnostic', `Hero sem perfil deveria ficar em diagnostic, obteve ${diagnostic && diagnostic.hero.stage}.`);
assert(diagnosticPrimary.includes('calculadora-custos-fixos.html'), 'Hero diagnostico nao aponta para custos fixos.');
assert(valueOf(elements, '[data-home-hero-title]').includes('diagnostico'), 'Hero diagnostico nao orienta diagnostico inicial.');

vm.runInContext(`
  const history = BFDecisionContext.saveHistoryEntry({
    calculatorSlug: 'capacidade-credito',
    calculatorName: 'Capacidade de credito',
    recommendation: 'Use ate R$ 2.600 como parcela segura.',
    profilePatch: { capacidadePagamento: 2600 },
    readinessScore: 92
  });
  BFDecisionContext.saveProfilePatch({
    cpf: '123.456.789-00',
    telefone: '(11) 99999-9999',
    email: 'cliente@example.com',
    rendaMensal: 12000,
    gastoMensal: 5200,
    reservaAtual: 36000,
    capacidadePagamento: 2600
  }, 'home-hero-validator');
  window.__historyId = history.id;
`, context);

const ready = context.BFHome.renderContextualHero();
const readyPrimary = valueOf(elements, '[data-home-hero-primary]', 'href');
assert(ready && ready.hero.stage === 'ready', `Hero com perfil pronto deveria ficar em ready, obteve ${ready && ready.hero.stage}.`);
assert(readyPrimary.includes('simulador.html?from=calculator'), 'Hero pronto nao aponta para simulador com contexto.');
assert(readyPrimary.includes(`historyId=${encodeURIComponent(context.__historyId)}`), 'Hero pronto nao preserva historyId no deep link.');
assert(valueOf(elements, '[data-home-hero-panel-score]').includes('/100'), 'Hero pronto nao mostra score no painel.');

vm.runInContext(`
  BFTrilhaDecisaoService.save({
    id: 'JOURNEY-HERO-1',
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
      valorObjetivo: 280000,
      valorCredito: 250000,
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

const journey = context.BFHome.renderContextualHero();
const journeyPrimary = valueOf(elements, '[data-home-hero-primary]', 'href');
assert(journey && journey.hero.stage === 'journey', `Hero com trilha ativa deveria ficar em journey, obteve ${journey && journey.hero.stage}.`);
assert(journeyPrimary.includes('comparador.html?preset=comprar_bem'), 'Hero com trilha ativa nao aponta para o deep link da trilha.');
assert(valueOf(elements, '[data-home-hero-badge]').includes('Trilha ativa'), 'Hero com trilha ativa nao exibe badge correto.');

vm.runInContext(`
  Storage.saveSimulation('Simulacao Hero', {
    nome: 'Simulacao Hero',
    totalCarta: 280000,
    totalCotas: 1,
    cliente: 'Cliente Example',
    clienteCpf: '123.456.789-00'
  });
`, context);

const simulation = context.BFHome.renderContextualHero();
const simulationPrimary = valueOf(elements, '[data-home-hero-primary]', 'href');
const simulationSecondary = valueOf(elements, '[data-home-hero-secondary]', 'href');
assert(simulation && simulation.hero.stage === 'simulation', `Hero com simulacao deveria ficar em simulation, obteve ${simulation && simulation.hero.stage}.`);
assert(simulationPrimary.includes('carteira.html'), 'Hero com simulacao nao aponta para carteira.');
assert(simulationSecondary.includes('simulador.html?simulationId='), 'Hero com simulacao nao aponta para revisao da simulacao.');
assert(context.document.body.dataset.homeHeroContextReady === 'true', 'Body dataset nao marcou hero contextual pronto.');
assert(context.document.body.dataset.homeHeroStage === 'simulation', 'Body dataset nao marcou stage final da hero.');

const renderedHero = [
  '[data-home-hero-badge]',
  '[data-home-hero-title]',
  '[data-home-hero-copy]',
  '[data-home-hero-state]',
  '[data-home-hero-next]',
  '[data-home-hero-origin]',
  '[data-home-hero-panel-title]',
  '[data-home-hero-panel-income]',
  '[data-home-hero-panel-capacity]',
  '[data-home-hero-panel-reserve]',
  '[data-home-hero-panel-score]',
  '[data-home-hero-panel-badge]',
  '[data-home-hero-panel-note]'
].map((selector) => valueOf(elements, selector)).join('\n');
assert(!containsPersonalData(renderedHero), 'Hero contextual renderizou dado pessoal bloqueado.');

const report = {
  ok: failures.length === 0,
  contextualHero: {
    diagnosticStage: diagnostic && diagnostic.hero.stage,
    readyStage: ready && ready.hero.stage,
    journeyStage: journey && journey.hero.stage,
    simulationStage: simulation && simulation.hero.stage,
    readyPrimary,
    journeyPrimary,
    simulationPrimary,
    simulationSecondary,
    datasetReady: context.document.body.dataset.homeHeroContextReady === 'true'
  },
  uiContract: {
    hero: indexHtml.includes('data-home-hero-contextual'),
    title: indexHtml.includes('data-home-hero-title'),
    primary: indexHtml.includes('data-home-hero-primary'),
    strip: indexHtml.includes('data-home-hero-context-strip'),
    panelScore: indexHtml.includes('data-home-hero-panel-score'),
    decisionJourney: indexHtml.includes('trilha-decisao.service.js')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8ac-home-contextual-hero-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
