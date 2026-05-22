import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const PROFILE_KEY = 'bf_financial_profile_v1';
const HISTORY_KEY = 'bf_calculator_history_v1';

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function readJson(relativePath) {
  return JSON.parse(await readText(relativePath));
}

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(String(key)) ? this.store.get(String(key)) : null;
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

function cleanFetchPath(resource) {
  return String(resource || '')
    .split('?')[0]
    .replace(/^file:\/\//, '')
    .replace(/^(\.\.\/)+/, '')
    .replace(/^\.\//, '')
    .replace(/^\/+/, '');
}

function readStorageJson(storage, key, fallback) {
  try {
    const raw = storage.getItem(key);
    return raw ? JSON.parse(raw) : fallback;
  } catch {
    return fallback;
  }
}

async function createContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    location: { pathname: '/pages/calculadora-capacidade-credito.html', search: '' },
    document: {
      body: { dataset: { calculatorSlug: 'capacidade-credito' } },
      querySelector: () => null,
      addEventListener: () => {}
    },
    URLSearchParams,
    fetch: async (resource) => {
      const filePath = path.join(root, cleanFetchPath(resource));
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
    'assets/js/formatters.js',
    'assets/js/formulas/financial.formulas.js',
    'assets/js/services/decision-context.service.js',
    'assets/js/services/calculadoras.service.js',
    'assets/js/calculadoras-page.js'
  ];
  for (const script of scripts) {
    vm.runInContext(await readText(script), context, { filename: script });
  }
  return context;
}

const [
  catalog,
  calculatorsPage,
  platformCss,
  contracts,
  fullMap,
  functionMap,
  plan,
  changelog,
  designValidator,
  publicContractsValidator,
  calculatorJourneyValidator
] = await Promise.all([
  readJson('assets/data/calculadoras.json'),
  readText('assets/js/calculadoras-page.js'),
  readText('assets/css/platform.css'),
  readText('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  readText('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  readText('docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md'),
  readText('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  readText('docs/CHANGELOG.md'),
  readText('tools/validate-design-system.mjs'),
  readText('tools/validate-public-contracts.mjs'),
  readText('tools/validate-calculator-journey.mjs')
]);

const markers = [
  'data-calculator-impact-panel',
  'data-calculator-impact-score',
  'data-calculator-impact-risk',
  'data-calculator-impact-next-step',
  'data-calculator-impact-source'
];

assert(Array.isArray(catalog) && catalog.length === 19, `Catalogo deveria conter 19 calculadoras; encontrou ${Array.isArray(catalog) ? catalog.length : 'formato invalido'}.`);
assert(calculatorsPage.includes('buildCalculatorImpactPanel'), 'calculadoras-page.js sem builder do painel de impacto.');
assert(calculatorsPage.includes('renderCalculatorImpactPanel'), 'calculadoras-page.js sem render do painel de impacto.');
assert(calculatorsPage.includes('impactPanel: buildCalculatorImpactPanel'), 'BFCalculatorJourney nao expoe impactPanel.');
assert(calculatorsPage.includes('buildCalculatorNextAction(result, recommendation, continuity)'), 'Painel de impacto nao reaproveita proxima acao dinamica.');
assert(calculatorsPage.includes('buildSavedComparison(result)'), 'Painel de impacto nao reaproveita comparacao com ultimo salvo.');
markers.forEach((marker) => {
  assert(calculatorsPage.includes(marker), `calculadoras-page.js sem marcador ${marker}.`);
  assert(contracts.includes(marker), `Contratos publicos sem marcador ${marker}.`);
  assert(publicContractsValidator.includes(marker), `validate-public-contracts.mjs nao protege ${marker}.`);
});
assert(platformCss.includes('.bf-calculator-impact-panel'), 'platform.css sem layout do painel de impacto.');
assert(platformCss.includes('.bf-calculator-impact-grid'), 'platform.css sem grid do painel de impacto.');
assert(designValidator.includes('tools/validate-calculator-impact-panel.mjs'), 'validate-design-system nao exige validate-calculator-impact-panel.');
assert(designValidator.includes('.bf-calculator-impact-panel'), 'validate-design-system nao protege CSS do painel de impacto.');
assert(calculatorJourneyValidator.includes('data-calculator-impact-panel'), 'validate-calculator-journey nao protege marcador de impacto.');
assert(contracts.includes('tools/validate-calculator-impact-panel.mjs'), 'Contratos publicos nao documentam validate-calculator-impact-panel.');
assert(fullMap.includes('data-calculator-impact-panel'), 'Mapa completo nao registra painel de impacto das calculadoras.');
assert(functionMap.includes('data-calculator-impact-panel'), 'Mapa funcional das calculadoras nao registra painel de impacto.');
assert(plan.includes('Calculadoras com impacto de jornada'), 'Plano de acao nao registra a fase de impacto das calculadoras.');
assert(changelog.includes('Painel de impacto das calculadoras'), 'Changelog nao registra a entrega do painel de impacto.');

const context = await createContext();
const reportItems = [];
const serviceCatalog = await context.BFCalculadoras.catalog();
assert(serviceCatalog.length === catalog.length, 'Servico BFCalculadoras nao carrega as 19 calculadoras para o painel de impacto.');
assert(context.BFCalculatorJourney && typeof context.BFCalculatorJourney.impactPanel === 'function', 'BFCalculatorJourney.impactPanel indisponivel em runtime.');

for (const calc of serviceCatalog) {
  context.document.body.dataset.calculatorSlug = calc.slug;
  const defaults = context.BFCalculadoras.profileDefaults(calc);
  const result = await context.BFCalculadoras.simulate(calc.slug, defaults, { persist: false });
  const impact = context.BFCalculatorJourney.impactPanel(result, 'preview');
  assert(impact && impact.kind === 'preview-impact', `${calc.slug} nao gerou impacto de preview.`);
  assert(impact.mode === 'preview', `${calc.slug} perdeu origem preview no painel de impacto.`);
  assert(Number.isFinite(impact.score), `${calc.slug} nao retornou score numerico no painel de impacto.`);
  assert(impact.primary && impact.primary.label && impact.primary.value, `${calc.slug} nao retornou metrica primaria no painel de impacto.`);
  assert(impact.nextAction && impact.nextAction.kind && impact.nextAction.primaryLabel, `${calc.slug} nao retornou proxima acao no painel de impacto.`);
  assert(impact.riskKind, `${calc.slug} nao retornou classificacao de risco no painel de impacto.`);
  reportItems.push({
    slug: calc.slug,
    score: impact.score,
    risk: impact.riskKind,
    nextAction: impact.nextAction.kind,
    source: impact.mode
  });
}

const previewHistory = readStorageJson(context.localStorage, HISTORY_KEY, []);
assert(previewHistory.length === 0, 'Geracao do painel de impacto persistiu historico durante previews.');
assert(context.localStorage.getItem(PROFILE_KEY) === null, 'Geracao do painel de impacto persistiu perfil durante previews.');

const risky = await context.BFCalculadoras.simulate('capacidade-credito', {
  rendaMensal: 6000,
  gastoMensal: 5900,
  dividasMensais: 2200,
  reservaAtual: 1000,
  comprometimentoMaximo: 30,
  margemFluxo: 60,
  mesesReservaMinima: 6
}, { persist: false });
risky.coherenceWarnings = ['Reserva e folga insuficientes para assumir novo credito.'];
const riskyImpact = context.BFCalculatorJourney.impactPanel(risky, 'preview');
assert(riskyImpact.riskKind === 'coherence-warning', 'Painel de impacto nao prioriza alerta de coerencia.');
assert(riskyImpact.tone === 'warning', 'Painel de impacto nao marcou tom de alerta em cenario arriscado.');

const saved = await context.BFCalculadoras.simulate('capacidade-credito', {
  rendaMensal: 10000,
  gastoMensal: 5000,
  dividasMensais: 1000,
  reservaAtual: 30000,
  comprometimentoMaximo: 30,
  margemFluxo: 60,
  mesesReservaMinima: 3
}, { persist: true });
const savedImpact = context.BFCalculatorJourney.impactPanel(saved, 'saved');
assert(savedImpact.kind === 'saved-impact', 'Painel de impacto nao diferencia cenario salvo.');
assert(savedImpact.mode === 'saved', 'Painel de impacto salvo perdeu origem saved.');

const report = {
  ok: failures.length === 0,
  calculators: reportItems.length,
  markers,
  riskyImpact: {
    risk: riskyImpact.riskKind,
    tone: riskyImpact.tone,
    nextAction: riskyImpact.nextAction.kind
  },
  savedImpact: {
    source: savedImpact.mode,
    score: savedImpact.score,
    nextAction: savedImpact.nextAction.kind
  },
  items: reportItems,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/calculator-impact-panel-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
