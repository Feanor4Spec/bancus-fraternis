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

function readStorageJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function cleanFetchPath(resource) {
  return String(resource || '')
    .split('?')[0]
    .replace(/^file:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

async function createBrowserLikeContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    location: { pathname: '/index.html', search: '' },
    document: {
      body: { dataset: {} },
      addEventListener() {},
      querySelector() { return null; }
    },
    URLSearchParams,
    fetch: async (resource) => {
      const clean = cleanFetchPath(resource);
      const filePath = path.join(root, clean);
      const body = await fs.readFile(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body
      };
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);

  const scripts = [
    'assets/js/formulas/financial.formulas.js',
    'assets/js/services/decision-context.service.js',
    'assets/js/services/calculadoras.service.js',
    'assets/js/calculadoras-page.js',
    'js/storage.js'
  ];
  for (const script of scripts) {
    vm.runInContext(await readText(script), context, { filename: script });
  }
  vm.runInContext('window.__StorageRef = Storage;', context);
  return context;
}

function hasPersonalData(value) {
  const text = JSON.stringify(value || {});
  return /cpf|telefone|whatsapp|email|nomeCliente|consultor/i.test(text);
}

const context = await createBrowserLikeContext();
const catalog = await context.BFCalculadoras.catalog();
const decision = context.BFDecisionContext;
const storage = context.__StorageRef;
const calculatorsPageHtml = await readText('pages/calculadoras.html');

const publicMethods = [
  'loadProfile',
  'saveProfilePatch',
  'readiness',
  'recommendedCalculators',
  'buildSimulationPrefill',
  'recordEvent'
];

for (const method of publicMethods) {
  assert(typeof decision[method] === 'function', `BFDecisionContext sem metodo publico: ${method}.`);
}

assert(context.BFCalculatorJourney && typeof context.BFCalculatorJourney.href === 'function', 'BFCalculatorJourney.href indisponivel.');
assert(context.BFCalculatorJourney && typeof context.BFCalculatorJourney.simulatorHref === 'function', 'BFCalculatorJourney.simulatorHref indisponivel.');
assert(calculatorsPageHtml.includes('from=calculators'), 'Hub de calculadoras nao preserva from=calculators nos atalhos.');
assert(calculatorsPageHtml.includes('calculatorSlug=custos-fixos'), 'Hub de calculadoras nao preserva calculatorSlug nos atalhos.');

assert(Array.isArray(catalog) && catalog.length === 19, `Catalogo deveria ter 19 calculadoras, encontrou ${catalog.length}.`);
assert(catalog.some((item) => item.slug === 'capacidade-credito'), 'Catalogo sem capacidade-credito.');
assert(catalog.some((item) => item.slug === 'lance-consorcio'), 'Catalogo sem lance-consorcio.');

const emptyReadiness = decision.readiness({});
assert(emptyReadiness.score === 0, `Prontidao sem perfil deveria ser 0, obteve ${emptyReadiness.score}.`);
assert(decision.recommendedCalculators({})[0] === 'custos-fixos', 'Perfil vazio deveria recomendar custos-fixos primeiro.');

decision.saveProfilePatch({
  cpf: '123.456.789-00',
  telefone: '(11) 99999-9999',
  email: 'cliente@example.com',
  nomeCliente: 'Cliente Teste',
  rendaMensal: 10000
}, 'safety-test');
const safetyProfile = decision.loadProfile();
assert(safetyProfile.rendaMensal === 10000, 'Patch seguro nao gravou rendaMensal.');
assert(!hasPersonalData(safetyProfile), 'Contexto financeiro gravou dado pessoal indevido.');

const capacity = await context.BFCalculadoras.simulate('capacidade-credito', {
  rendaMensal: 10000,
  gastoMensal: 5000,
  dividasMensais: 1000,
  reservaAtual: 30000,
  comprometimentoMaximo: 30,
  margemFluxo: 60,
  mesesReservaMinima: 3
});
assert(capacity.historyId, 'capacidade-credito nao retornou historyId.');
assert(capacity.profilePatch.capacidadePagamento === 2000, `Parcela segura esperada 2000, obteve ${capacity.profilePatch.capacidadePagamento}.`);

const lance = await context.BFCalculadoras.simulate('lance-consorcio', {
  valorCarta: 200000,
  reservaAtual: 40000,
  gastoMensal: 5000,
  capacidadePagamento: capacity.profilePatch.capacidadePagamento,
  lanceDesejadoPct: 10,
  mesesReservaMinima: 3,
  limiteLancePct: 30
});
assert(lance.historyId, 'lance-consorcio nao retornou historyId.');
assert(lance.profilePatch.lanceProprioSugerido === 25000, `Lance seguro esperado 25000, obteve ${lance.profilePatch.lanceProprioSugerido}.`);

const calculatorRoutes = {
  simulator: context.BFCalculatorJourney.href('simulator', capacity),
  journey: context.BFCalculatorJourney.href('journey', capacity),
  comparator: context.BFCalculatorJourney.href('comparator', capacity),
  calculator: context.BFCalculatorJourney.href('calculator', capacity)
};
assert(calculatorRoutes.simulator.includes('simulador.html'), 'Rota contextual de simulador da calculadora perdeu destino.');
assert(calculatorRoutes.simulator.includes('from=calculator'), 'Rota contextual de simulador sem from=calculator.');
assert(calculatorRoutes.simulator.includes('calculatorSlug=capacidade-credito'), 'Rota contextual de simulador sem calculatorSlug.');
assert(calculatorRoutes.simulator.includes(`historyId=${encodeURIComponent(capacity.historyId)}`), 'Rota contextual de simulador sem historyId.');
assert(calculatorRoutes.simulator.includes('preset=comprar_bem'), 'Rota contextual de simulador sem preset esperado.');
assert(calculatorRoutes.journey.includes('trilha-decisao.html') && calculatorRoutes.journey.includes('historyId='), 'Rota contextual de trilha sem destino ou historico.');
assert(calculatorRoutes.comparator.includes('comparador.html') && calculatorRoutes.comparator.includes('calculatorSlug=capacidade-credito'), 'Rota contextual de comparador incompleta.');
assert(calculatorRoutes.calculator.includes('calculadora-capacidade-credito.html'), 'Rota contextual de reabertura da calculadora incorreta.');

context.location.search = `?from=calculator&calculatorSlug=capacidade-credito&historyId=${encodeURIComponent(capacity.historyId)}`;
const prefill = decision.buildSimulationPrefill();
assert(prefill.source === 'calculator', `Deep link deveria ter source calculator, obteve ${prefill.source}.`);
assert(prefill.calculatorSlug === 'capacidade-credito', `Deep link deveria carregar capacidade-credito, obteve ${prefill.calculatorSlug}.`);
assert(prefill.historyId === capacity.historyId, 'Deep link nao preservou historyId.');
assert(prefill.prefill.capacidadePagamento === 2000, `Prefill deveria levar capacidade 2000, obteve ${prefill.prefill.capacidadePagamento}.`);
assert(!hasPersonalData(prefill.profileSnapshot), 'Snapshot de perfil contem dado pessoal.');

const simulationPayload = {
  nome: 'Fluxo funcional v8S',
  origem: 'simulador-consorcio',
  currentStep: 5,
  totalCarta: prefill.prefill.valorAlvo || 200000,
  totalGrupos: 1,
  totalCotas: 1,
  segmentos: ['Consorcio'],
  params: {
    valorCarta: prefill.prefill.valorAlvo || 200000,
    tipoBem: 'Consorcio',
    prazoTotal: 120
  },
  resumo: {
    parcelaMedia: prefill.prefill.capacidadePagamento || 2000,
    parcelaBase: prefill.prefill.capacidadePagamento || 2000
  },
  decisionContext: {
    source: prefill.source,
    calculatorSlug: prefill.calculatorSlug,
    historyId: prefill.historyId,
    journeyId: prefill.journeyId,
    readinessScore: prefill.readinessScore,
    profileSnapshot: prefill.profileSnapshot
  }
};

const savedSimulation = storage.saveSimulation('Fluxo funcional v8S', simulationPayload);
assert(savedSimulation && savedSimulation.id, 'Storage nao salvou simulacao com decisionContext.');
const storedSimulation = storage.loadSimulation(savedSimulation.id);
assert(storedSimulation && storedSimulation.decisionContext, 'Storage nao retornou decisionContext na simulacao salva.');
assert(storedSimulation.decisionContext.calculatorSlug === 'capacidade-credito', 'decisionContext salvo perdeu calculatorSlug.');

const simulatorHistory = decision.recordSimulation(savedSimulation);
assert(simulatorHistory && simulatorHistory.calculatorSlug === 'simulador-consorcio', 'recordSimulation nao retornou evento simulador-consorcio.');

const finalHistory = decision.loadHistory();
const simulatorEvent = finalHistory.find((item) => item.calculatorSlug === 'simulador-consorcio');
assert(Boolean(simulatorEvent), 'Historico financeiro nao recebeu simulador-consorcio.');
assert(simulatorEvent.decisionContext && simulatorEvent.decisionContext.calculatorSlug === 'capacidade-credito', 'Evento simulador-consorcio perdeu origem da calculadora.');

const finalProfile = decision.loadProfile();
assert(finalProfile.valorCredito === simulationPayload.params.valorCarta, 'Perfil nao recebeu valorCredito da simulacao.');
assert(Number(finalProfile.parcelaProjetada) === simulationPayload.resumo.parcelaMedia, 'Perfil nao recebeu parcelaProjetada.');
assert(!hasPersonalData(finalProfile), 'Perfil final contem dado pessoal indevido.');

const audit = readStorageJson(context.localStorage, 'bf_decision_context_audit_v1', []);
assert(audit.some((item) => item.type === 'simulation-saved'), 'Auditoria nao registrou simulation-saved.');
assert(audit.some((item) => item.type === 'calculator-simulated'), 'Auditoria nao registrou calculator-simulated.');

const summary = {
  ok: failures.length === 0,
  calculators: catalog.length,
  flow: {
    emptyReadinessScore: emptyReadiness.score,
    capacityHistoryId: capacity.historyId,
    capacityPayment: capacity.profilePatch.capacidadePagamento,
    bidHistoryId: lance.historyId,
    safeBid: lance.profilePatch.lanceProprioSugerido,
    calculatorRoutes,
    prefillSource: prefill.source,
    prefillCalculatorSlug: prefill.calculatorSlug,
    readinessScore: prefill.readinessScore,
    simulationId: savedSimulation && savedSimulation.id,
    simulatorHistoryId: simulatorHistory && simulatorHistory.id,
    finalHistoryCount: finalHistory.length,
    auditCount: audit.length
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8s-decision-flow-report.json'),
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
