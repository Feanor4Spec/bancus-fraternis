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

function createElementMock() {
  return {
    dataset: {},
    classList: { add() {}, remove() {}, toggle() {} },
    style: {},
    children: [],
    innerHTML: '',
    textContent: '',
    value: '',
    checked: false,
    setAttribute() {},
    getAttribute() { return ''; },
    appendChild(child) {
      this.children.push(child);
      return child;
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    closest() { return null; }
  };
}

function createDocumentMock() {
  return {
    body: {
      dataset: { bfPage: 'validator-products-flow' },
      classList: { add() {}, remove() {}, toggle() {} }
    },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; },
    createElement: createElementMock
  };
}

function cleanFetchPath(resource) {
  return String(resource || '')
    .split('?')[0]
    .replace(/^file:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

async function createBrowserLikeContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    document: createDocumentMock(),
    location: { pathname: '/pages/validate-product-journey-flow.html', search: '' },
    navigator: { userAgent: 'node-validator' },
    URLSearchParams,
    FormData: class FormDataMock {
      entries() {
        return [];
      }
    },
    fetch: async (resource) => {
      const filePath = path.join(root, cleanFetchPath(resource));
      const body = await fs.readFile(filePath, 'utf8');
      return {
        ok: true,
        status: 200,
        json: async () => JSON.parse(body),
        text: async () => body
      };
    },
    setTimeout,
    clearTimeout
  };
  context.window = context;
  context.globalThis = context;
  context.BFAuth = {
    getCurrentUser: () => ({
      email: 'cliente.produtos@bankfratern.local',
      role: 'cliente'
    })
  };
  vm.createContext(context);

  const scripts = [
    'assets/js/formatters.js',
    'assets/js/components/cards.js',
    'assets/js/components/tables.js',
    'assets/js/formulas/price.formulas.js',
    'assets/js/formulas/sac.formulas.js',
    'assets/js/formulas/consorcio.formulas.js',
    'assets/js/formulas/comparison.formulas.js',
    'assets/js/services/financiamento.service.js',
    'assets/js/services/cdc.service.js',
    'assets/js/services/garantia.service.js',
    'assets/js/services/consignado.service.js',
    'assets/js/services/consorcio.service.js',
    'assets/js/services/comparador.service.js',
    'assets/js/services/recomendacao.service.js',
    'assets/js/services/modelos-recomendacao.service.js',
    'assets/js/bf-platform.js'
  ];

  for (const script of scripts) {
    vm.runInContext(await readText(script), context, { filename: script });
  }

  return context;
}

function toNumberFields(fields) {
  const output = { ...(fields || {}) };
  Object.keys(output).forEach((key) => {
    if (output[key] !== '' && !Number.isNaN(Number(output[key]))) output[key] = Number(output[key]);
  });
  return output;
}

function hasPositiveMoney(value) {
  return Number.isFinite(Number(value)) && Number(value) > 0;
}

function idsOf(items) {
  return (items || []).map((item) => item.id);
}

function requiredSimulatorEvents() {
  return [
    'simulator_calculated_financiamento',
    'simulator_calculated_consorcio',
    'simulator_calculated_cdc',
    'simulator_calculated_garantia',
    'simulator_calculated_consignado',
    'simulator_calculated_veiculos'
  ];
}

const context = await createBrowserLikeContext();
const products = await readJson('assets/data/produtos.json');
const standardModels = await readJson('assets/data/modelos-comparador-padrao.json');
const produtosHtml = await readText('pages/produtos.html');

const expectedProducts = ['consorcio', 'financiamento', 'veiculos', 'cdc', 'garantia', 'consignado'];
const productIds = new Set(idsOf(products));
for (const id of expectedProducts) {
  assert(productIds.has(id), `Catalogo de produtos sem ${id}.`);
}

assert(produtosHtml.includes('from=products'), 'Hero de produtos nao preserva origem nos atalhos.');
assert(produtosHtml.includes('productId=financiamento'), 'Hero de produtos nao preserva productId nos atalhos.');
assert(produtosHtml.includes('data-products-compare-link'), 'Pagina de produtos sem link monitorado para comparador.');
assert(context.BFProductsJourney && typeof context.BFProductsJourney.decorate === 'function', 'BFProductsJourney.decorate indisponivel.');
assert(context.BFProductsJourney && typeof context.BFProductsJourney.compareHref === 'function', 'BFProductsJourney.compareHref indisponivel.');

for (const product of products) {
  assert(product.comparador === 'comparador.html', `Produto ${product.id} sem rota de comparador padrao.`);
  assert(/simulador-[a-z-]+\.html$/.test(product.simulador || ''), `Produto ${product.id} sem rota de simulador.`);
  assert(product.comparadorPreset, `Produto ${product.id} sem preset de comparador.`);
}

const garantiaProduct = products.find((product) => product.id === 'garantia');
const selectedRouteIds = ['garantia', 'financiamento'];
const decoratedGarantia = context.BFProductsJourney.decorate(garantiaProduct, null, selectedRouteIds);
const selectedCompareHref = context.BFProductsJourney.compareHref(selectedRouteIds, null, garantiaProduct);
const productCardHtml = context.BFCards.product({
  ...decoratedGarantia,
  selectionEnabled: true,
  selecionado: true
});

assert(decoratedGarantia.simuladorHref.includes('simulador-garantia.html'), 'Rota contextual de simulador nao preserva destino garantia.');
assert(decoratedGarantia.simuladorHref.includes('from=products'), 'Rota contextual de simulador sem from=products.');
assert(decoratedGarantia.simuladorHref.includes('productId=garantia'), 'Rota contextual de simulador sem productId.');
assert(decoratedGarantia.simuladorHref.includes('preset=obter_liquidez'), 'Rota contextual de simulador sem preset do produto.');
assert(decoratedGarantia.simuladorHref.includes('products=garantia%2Cfinanciamento'), 'Rota contextual de simulador sem selecao de produtos.');
assert(decoratedGarantia.calculadoraHref.includes('from=products'), 'Rota contextual de calculadora sem from=products.');
assert(decoratedGarantia.comparadorHref.includes('from=products'), 'Rota contextual de comparador sem from=products.');
assert(decoratedGarantia.trilhaHref.includes('trilha-decisao.html'), 'Rota contextual de trilha sem destino correto.');
assert(decoratedGarantia.trilhaHref.includes('productId=garantia'), 'Rota contextual de trilha sem productId.');
assert(selectedCompareHref.includes('comparador.html?preset=manual'), 'Comparador de selecao deveria manter preset manual.');
assert(selectedCompareHref.includes('products=garantia%2Cfinanciamento'), 'Comparador de selecao nao preserva ids selecionados.');
assert(selectedCompareHref.includes('from=products'), 'Comparador de selecao sem from=products.');
assert(productCardHtml.includes('from=products') && productCardHtml.includes('Trilha'), 'Card de produto nao renderiza CTAs contextuais completos.');

const recommendationProfile = {
  urgencia: 'media',
  risco: 'moderado',
  entrada: 50000,
  renda: 16000,
  rendaMensal: 16000,
  garantia: true
};
const recommendations = context.BFRecomendacaoService.recommend(recommendationProfile, products);
const selectedProducts = recommendations.slice(0, 3);
const selectedIds = idsOf(selectedProducts);
assert(selectedProducts.length === 3, `Recomendacao deveria selecionar 3 produtos, encontrou ${selectedProducts.length}.`);
assert(selectedProducts.every((product) => product.scoreRecomendacao > 0), 'Top 3 de produtos sem score positivo.');
assert(selectedProducts.every((product) => product.simulador && product.comparador), 'Top 3 de produtos sem continuidade para simulador/comparador.');

context.BFJourneyAnalytics.record('product_top3_selected', {
  selectionIds: selectedIds,
  selectedCount: selectedIds.length
});
context.BFJourneyAnalytics.record('products_compare_open', {
  selectionIds: selectedIds,
  href: `comparador.html?preset=manual&products=${selectedIds.join(',')}`
});
context.BFJourneyAnalytics.record('comparator_loaded_from_products', {
  productIds: selectedIds,
  productNames: selectedProducts.map((product) => product.nome)
});

const bestModel = context.BFModelosRecomendacaoService.best(standardModels, {
  presetObjetivo: 'comprar_bem',
  valorBem: 250000,
  entrada: 50000,
  rendaMensal: 16000,
  gastoMensal: 8200,
  dividasMensais: 900,
  reservaAtual: 38000,
  urgencia: 'media',
  includeGarantia: 1
});
assert(bestModel && bestModel.id === 'std-compra-bem-planejada', `Modelo recomendado inesperado: ${bestModel && bestModel.id}.`);
assert(bestModel.recommendationScore >= 80, `Modelo recomendado com score baixo: ${bestModel && bestModel.recommendationScore}.`);

const fullComparatorInput = {
  valorBem: 250000,
  entrada: 50000,
  taxaMes: 1.15,
  prazo: 180,
  sistema: 'price',
  taxaAdm: 18,
  fundoReserva: 2,
  lance: 20,
  reajusteAnual: 0,
  mobContemplacao: 90,
  rendaMensal: 16000,
  gastoMensal: 8200,
  dividasMensais: 900,
  reservaAtual: 38000,
  urgencia: 'media',
  prioridade: 'menor_custo',
  includeFinanciamento: 1,
  includeConsorcio: 1,
  includeCdc: 1,
  includeGarantia: 1,
  includeConsignado: 1,
  includeConsumo: 1,
  valorCredito: 200000,
  prazoCredito: 72,
  taxaCdcMes: 2.45,
  tarifasCdc: 1200,
  valorGarantia: 450000,
  ltvGarantia: 45,
  taxaGarantiaMes: 0.95,
  prazoGarantia: 120,
  taxaConsignadoMes: 1.35,
  margemPct: 30,
  prazoConsignado: 72,
  precoCheio: 12000,
  descontoVista: 8,
  parcelasConsumo: 12,
  valorParcela: 1050,
  taxaOportunidadeMes: 1
};
const bestModelResult = context.BFComparadorService.compareDefault(toNumberFields(bestModel.fields));
const fullComparatorResult = context.BFComparadorService.compareDefault(fullComparatorInput);
const comparedIds = idsOf(fullComparatorResult.summaries);

assert(bestModelResult.summaries.length >= 3, 'Modelo padrao recomendado nao gerou matriz minima de comparacao.');
assert(bestModelResult.decision && bestModelResult.decision.label, 'Modelo padrao recomendado nao gerou decisao.');
assert(fullComparatorResult.summaries.length >= 6, `Comparador completo deveria comparar ao menos 6 alternativas, obteve ${fullComparatorResult.summaries.length}.`);
for (const id of ['financiamento', 'consorcio', 'cdc', 'garantia', 'consignado']) {
  assert(comparedIds.includes(id), `Comparador completo nao incluiu ${id}.`);
}
assert(fullComparatorResult.nextActions.some((action) => /simulador-/.test(action.href || '')), 'Comparador completo nao gerou acao para simulador.');
assert(fullComparatorResult.risks.length > 0, 'Comparador completo nao gerou leitura de riscos.');

context.BFJourneyAnalytics.record('comparator_calculated', {
  productIds: selectedIds,
  comparedCount: fullComparatorResult.summaries.length,
  winner: fullComparatorResult.decision ? fullComparatorResult.decision.label : ''
});
context.BFJourneyAnalytics.record('comparator_saved', {
  saved: true,
  winner: fullComparatorResult.decision ? fullComparatorResult.decision.label : '',
  comparedCount: fullComparatorResult.summaries.length
});
const firstSimulatorAction = fullComparatorResult.nextActions.find((action) => /simulador-/.test(action.href || ''));
context.BFJourneyAnalytics.record('simulator_opened_from_comparator', {
  href: firstSimulatorAction ? firstSimulatorAction.href : 'simulador-financiamento.html',
  simulator: firstSimulatorAction ? firstSimulatorAction.href.replace('.html', '') : 'simulador-financiamento'
});

const simulatorResults = {
  financiamento: context.BFFinanciamentoService.simulate({
    valorBem: 180000,
    entrada: 40000,
    taxaMes: 1.15,
    prazo: 120,
    sistema: 'price'
  }),
  consorcio: context.BFConsorcioService.simulate({
    carta: 180000,
    prazo: 120,
    taxaAdm: 18,
    fundoReserva: 2,
    lance: 15,
    reajusteAnual: 0,
    mobContemplacao: 60
  }),
  cdc: context.BFCdcService.simulate({
    valor: 80000,
    tarifas: 1200,
    taxaMes: 2.35,
    prazo: 60
  }),
  garantia: context.BFGarantiaService.simulate({
    garantia: 350000,
    valor: 140000,
    ltv: 45,
    taxaMes: 0.95,
    prazo: 120
  }),
  consignado: context.BFConsignadoService.simulate({
    valor: 65000,
    renda: 14000,
    margemPct: 30,
    taxaMes: 1.35,
    prazo: 72
  }),
  veiculos: context.BFComparadorService.compareDefault({
    ...fullComparatorInput,
    presetObjetivo: 'trocar_veiculo',
    valorBem: 95000,
    entrada: 25000,
    valorCredito: 70000,
    prazo: 72,
    prazoCredito: 60,
    includeGarantia: 0,
    includeConsignado: 0,
    includeCdc: 0,
    includeConsumo: 1
  })
};

assert(hasPositiveMoney(simulatorResults.financiamento.primeiraParcela), 'Simulador de financiamento sem primeira parcela.');
assert(hasPositiveMoney(simulatorResults.consorcio.primeiraParcela), 'Simulador de consorcio sem primeira parcela.');
assert(hasPositiveMoney(simulatorResults.cdc.primeiraParcela), 'Simulador CDC sem primeira parcela.');
assert(hasPositiveMoney(simulatorResults.garantia.primeiraParcela), 'Simulador garantia sem primeira parcela.');
assert(hasPositiveMoney(simulatorResults.consignado.primeiraParcela), 'Simulador consignado sem primeira parcela.');
assert(simulatorResults.consignado.elegivel === true, 'Simulador consignado deveria estar elegivel no cenario base.');
assert(simulatorResults.veiculos.summaries.length >= 3, 'Simulador de veiculos deveria comparar alternativas.');
assert(simulatorResults.veiculos.decision && simulatorResults.veiculos.decision.label, 'Simulador de veiculos sem decisao.');

context.BFJourneyAnalytics.record('simulator_calculated_financiamento', {
  simulator: 'financiamento',
  totalPago: simulatorResults.financiamento.totalPago,
  primeiraParcela: simulatorResults.financiamento.primeiraParcela
});
context.BFJourneyAnalytics.record('simulator_calculated_consorcio', {
  simulator: 'consorcio',
  totalPago: simulatorResults.consorcio.totalPago,
  primeiraParcela: simulatorResults.consorcio.primeiraParcela
});
context.BFJourneyAnalytics.record('simulator_calculated_cdc', {
  simulator: 'cdc',
  totalPago: simulatorResults.cdc.totalPago,
  primeiraParcela: simulatorResults.cdc.primeiraParcela
});
context.BFJourneyAnalytics.record('simulator_calculated_garantia', {
  simulator: 'garantia',
  totalPago: simulatorResults.garantia.totalPago,
  primeiraParcela: simulatorResults.garantia.primeiraParcela
});
context.BFJourneyAnalytics.record('simulator_calculated_consignado', {
  simulator: 'consignado',
  totalPago: simulatorResults.consignado.totalPago,
  primeiraParcela: simulatorResults.consignado.primeiraParcela
});
context.BFJourneyAnalytics.record('simulator_calculated_veiculos', {
  simulator: 'veiculos',
  winner: simulatorResults.veiculos.decision ? simulatorResults.veiculos.decision.label : '',
  comparedCount: simulatorResults.veiculos.summaries.length
});

const events = context.BFJourneyAnalytics.list();
const eventTypes = new Set(events.map((event) => event.type));
for (const type of requiredSimulatorEvents()) {
  assert(eventTypes.has(type), `Jornada sem evento obrigatorio: ${type}.`);
}

const analytics = context.BFJourneyAnalytics.summary(events);
assert(analytics.productSelections >= 1, 'Resumo da jornada nao contabilizou selecao de produtos.');
assert(analytics.compareOpen >= 2, 'Resumo da jornada nao contabilizou abertura/carregamento do comparador.');
assert(analytics.comparatorRuns === 1, `Resumo deveria ter 1 matriz calculada, obteve ${analytics.comparatorRuns}.`);
assert(analytics.savedScenarios === 1, `Resumo deveria ter 1 cenario salvo, obteve ${analytics.savedScenarios}.`);
assert(analytics.simulatorRuns === 6, `Resumo deveria ter 6 simuladores calculados, obteve ${analytics.simulatorRuns}.`);
assert(analytics.conversionRate > 0, 'Resumo deveria ter taxa de conversao positiva.');

const summary = {
  ok: failures.length === 0,
  products: {
    total: products.length,
    expectedProducts,
    contextualRoutes: {
      simulator: decoratedGarantia.simuladorHref,
      comparator: decoratedGarantia.comparadorHref,
      calculator: decoratedGarantia.calculadoraHref,
      journey: decoratedGarantia.trilhaHref,
      selectedCompare: selectedCompareHref
    },
    recommendedTop3: selectedIds,
    bestModel: bestModel ? {
      id: bestModel.id,
      score: bestModel.recommendationScore,
      productIds: bestModel.productIds
    } : null
  },
  comparator: {
    bestModelComparedCount: bestModelResult.summaries.length,
    fullComparedCount: fullComparatorResult.summaries.length,
    comparedIds,
    decision: fullComparatorResult.decision ? fullComparatorResult.decision.label : null,
    nextActions: fullComparatorResult.nextActions.map((action) => action.href)
  },
  simulators: {
    financiamento: {
      totalPago: simulatorResults.financiamento.totalPago,
      primeiraParcela: simulatorResults.financiamento.primeiraParcela
    },
    consorcio: {
      totalPago: simulatorResults.consorcio.totalPago,
      primeiraParcela: simulatorResults.consorcio.primeiraParcela
    },
    cdc: {
      totalPago: simulatorResults.cdc.totalPago,
      primeiraParcela: simulatorResults.cdc.primeiraParcela
    },
    garantia: {
      totalPago: simulatorResults.garantia.totalPago,
      primeiraParcela: simulatorResults.garantia.primeiraParcela
    },
    consignado: {
      totalPago: simulatorResults.consignado.totalPago,
      primeiraParcela: simulatorResults.consignado.primeiraParcela,
      elegivel: simulatorResults.consignado.elegivel
    },
    veiculos: {
      comparedCount: simulatorResults.veiculos.summaries.length,
      decision: simulatorResults.veiculos.decision ? simulatorResults.veiculos.decision.label : null
    }
  },
  analytics: {
    total: analytics.total,
    productSelections: analytics.productSelections,
    compareOpen: analytics.compareOpen,
    comparatorRuns: analytics.comparatorRuns,
    savedScenarios: analytics.savedScenarios,
    simulatorRuns: analytics.simulatorRuns,
    activeProducts: analytics.activeProducts,
    conversionRate: analytics.conversionRate,
    lastEventType: analytics.lastEvent ? analytics.lastEvent.type : null
  },
  uiContract: {
    heroContextLinks: produtosHtml.includes('from=products') && produtosHtml.includes('productId=financiamento'),
    compareLinkMarker: produtosHtml.includes('data-products-compare-link'),
    productsJourneyApi: Boolean(context.BFProductsJourney)
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8t-product-journey-flow-report.json'),
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
