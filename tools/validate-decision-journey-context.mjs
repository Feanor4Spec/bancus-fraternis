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

function decodedSearch(href) {
  return decodeURIComponent(String(href || ''));
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function createContext(search = '') {
  const context = {
    console,
    location: {
      pathname: '/pages/trilha-decisao.html',
      search
    },
    localStorage: {
      getItem() { return null; },
      setItem() {},
      removeItem() {}
    },
    document: {
      body: { dataset: {} },
      addEventListener() {},
      querySelector() { return null; }
    },
    URLSearchParams,
    FormData: class FormDataMock {
      entries() {
        return [];
      }
    }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  return context;
}

const pageHtml = await readText('pages/trilha-decisao.html');
const scriptSource = await readText('assets/js/trilha-decisao.js');
const context = createContext('?from=products&productId=garantia&preset=obter_liquidez&products=garantia,financiamento');
vm.runInContext(scriptSource, context, { filename: 'assets/js/trilha-decisao.js' });

assert(pageHtml.includes('calculadora-custos-fixos.html?from=journey'), 'Trilha sem atalho contextual para diagnostico.');
assert(pageHtml.includes('produtos.html?from=journey'), 'Trilha sem atalho contextual para produtos.');
assert(pageHtml.includes('modelos-biblioteca.html?from=journey'), 'Trilha sem atalho contextual para modelos.');
assert(pageHtml.includes('comparador.html?from=journey'), 'Trilha sem atalho contextual para comparador.');
assert(scriptSource.includes('window.BFDecisionJourneyContext'), 'Trilha nao exporta BFDecisionJourneyContext.');
assert(scriptSource.includes('sourceFrom'), 'Trilha nao preserva origem anterior em sourceFrom.');
assert(scriptSource.includes('const hasUrlContext'), 'Trilha nao diferencia entrada direta de entrada contextual.');

const productsContext = context.BFDecisionJourneyContext.read();
const productsDefaults = context.BFDecisionJourneyContext.defaults({
  objetivo: 'comprar_bem',
  urgencia: 'alta'
}, productsContext);
const productsHref = decodedSearch(context.BFDecisionJourneyContext.href('simulador-garantia.html', {
  id: 'TRI-VAL-1',
  objective: 'obter_liquidez',
  recommendedProduct: { id: 'garantia' }
}));

assert(context.BFDecisionJourneyContext.has(productsContext), 'Contexto de Produtos deveria ser reconhecido.');
assert(productsContext.from === 'products', `Origem esperada products, obtida ${productsContext.from}.`);
assert(productsContext.productId === 'garantia', `productId esperado garantia, obtido ${productsContext.productId}.`);
assert(productsContext.products.length === 2, `Selecao deveria preservar 2 produtos, preservou ${productsContext.products.length}.`);
assert(context.BFDecisionJourneyContext.objective(productsContext) === 'obter_liquidez', 'Preset de Produtos nao virou objetivo da trilha.');
assert(productsDefaults.objetivo === 'obter_liquidez', 'Defaults da Trilha nao foram ajustados por preset de Produtos.');
assert(productsDefaults.urgencia === 'media', 'Defaults da Trilha nao ajustaram urgencia para garantia.');
assert(productsHref.includes('simulador-garantia.html'), 'Href contextual de Produtos perdeu destino do simulador.');
assert(productsHref.includes('from=journey'), 'Href contextual de Produtos sem from=journey.');
assert(productsHref.includes('sourceFrom=products'), 'Href contextual de Produtos sem sourceFrom=products.');
assert(productsHref.includes('productId=garantia'), 'Href contextual de Produtos sem productId.');
assert(productsHref.includes('preset=obter_liquidez'), 'Href contextual de Produtos sem preset da trilha.');
assert(productsHref.includes('journeyId=TRI-VAL-1'), 'Href contextual de Produtos sem journeyId.');
assert(productsHref.includes('products=garantia,financiamento'), 'Href contextual de Produtos sem selecao preservada.');

context.location.search = '?from=calculator&calculatorSlug=capacidade-credito&historyId=CALC-1&preset=comprar_bem';
const calculatorContext = context.BFDecisionJourneyContext.read();
const calculatorDefaults = context.BFDecisionJourneyContext.defaults({
  objetivo: 'obter_liquidez',
  urgencia: 'alta'
}, calculatorContext);
const calculatorHref = decodedSearch(context.BFDecisionJourneyContext.href('comparador.html', {
  id: 'TRI-CALC-1',
  objective: 'comprar_bem',
  recommendedProduct: { id: 'financiamento' }
}));

assert(context.BFDecisionJourneyContext.has(calculatorContext), 'Contexto de Calculadora deveria ser reconhecido.');
assert(calculatorContext.from === 'calculator', `Origem esperada calculator, obtida ${calculatorContext.from}.`);
assert(calculatorContext.calculatorSlug === 'capacidade-credito', 'calculatorSlug nao foi preservado.');
assert(calculatorContext.historyId === 'CALC-1', 'historyId nao foi preservado.');
assert(context.BFDecisionJourneyContext.objective(calculatorContext) === 'comprar_bem', 'Preset de Calculadora nao virou objetivo da trilha.');
assert(calculatorDefaults.objetivo === 'comprar_bem', 'Defaults da Trilha nao foram ajustados por Calculadora.');
assert(calculatorDefaults.urgencia === 'media', 'Defaults da Trilha nao ajustaram urgencia para capacidade de credito.');
assert(calculatorHref.includes('comparador.html'), 'Href contextual de Calculadora perdeu destino do comparador.');
assert(calculatorHref.includes('from=journey'), 'Href contextual de Calculadora sem from=journey.');
assert(calculatorHref.includes('sourceFrom=calculator'), 'Href contextual de Calculadora sem sourceFrom=calculator.');
assert(calculatorHref.includes('calculatorSlug=capacidade-credito'), 'Href contextual de Calculadora sem calculatorSlug.');
assert(calculatorHref.includes('historyId=CALC-1'), 'Href contextual de Calculadora sem historyId.');
assert(calculatorHref.includes('preset=comprar_bem'), 'Href contextual de Calculadora sem preset.');

context.location.search = '';
const emptyContext = context.BFDecisionJourneyContext.read();
assert(!context.BFDecisionJourneyContext.has(emptyContext), 'Entrada direta nao deveria ser marcada como contextual.');

const summary = {
  ok: failures.length === 0,
  contexts: {
    products: productsContext,
    calculator: calculatorContext,
    empty: emptyContext
  },
  routes: {
    productsHref,
    calculatorHref
  },
  uiContract: {
    heroLinksContextual: pageHtml.includes('from=journey'),
    apiAvailable: Boolean(context.BFDecisionJourneyContext)
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/decision-journey-context-report.json'),
  JSON.stringify(summary, null, 2)
);

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
