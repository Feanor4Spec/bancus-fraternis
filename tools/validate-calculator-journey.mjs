import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const PROFILE_KEY = 'bf_financial_profile_v1';
const HISTORY_KEY = 'bf_calculator_history_v1';
const AUDIT_KEY = 'bf_decision_context_audit_v1';

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
    location: { pathname: '/pages/calculadora-custos-fixos.html', search: '' },
    document: { body: { dataset: {} } },
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
    'assets/js/services/calculadoras.service.js'
  ];
  for (const script of scripts) {
    vm.runInContext(await readText(script), context, { filename: script });
  }
  return context;
}

const catalog = await readJson('assets/data/calculadoras.json');
const pageJs = await readText('assets/js/calculadoras-page.js');
const platformCss = await readText('assets/css/platform.css');
const docsMap = await readText('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md');
let functionMap = '';
try {
  functionMap = await readText('docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md');
} catch {
  functionMap = '';
}

assert(Array.isArray(catalog) && catalog.length === 19, `Catalogo deveria conter 19 calculadoras; encontrou ${Array.isArray(catalog) ? catalog.length : 'formato invalido'}.`);
assert(pageJs.includes('data-calculator-result-mode'), 'Jornada nao expoe modo do resultado da calculadora.');
assert(pageJs.includes('persist: false'), 'Previa inicial das calculadoras deve chamar simulate com persist:false.');
assert(pageJs.includes('persist: true'), 'Submit das calculadoras deve declarar persist:true.');
assert(!pageJs.includes("form.dispatchEvent(new Event('submit'"), 'Pagina individual ainda dispara submit automaticamente no carregamento.');
assert(pageJs.includes('data-calculator-form-alert'), 'Formulario da calculadora nao expoe alerta de validacao.');
assert(pageJs.includes('data-calculator-coherence-alert'), 'Formulario da calculadora nao expoe alerta de coerencia.');
assert(pageJs.includes('data-calculator-field'), 'Formulario da calculadora nao expoe marcador de campo.');
assert(pageJs.includes('data-calculator-field-error'), 'Formulario da calculadora nao expoe erro por campo.');
assert(pageJs.includes('FIELD_PROFILE_SOURCES'), 'Pagina de calculadora nao mapeia origem dos campos reaproveitados.');
assert(pageJs.includes('data-calculator-field-origin'), 'Formulario da calculadora nao expoe origem default/profile do campo.');
assert(pageJs.includes('data-calculator-field-source'), 'Formulario da calculadora nao expoe selo de origem do perfil.');
assert(pageJs.includes('fieldSource: profileSourceForField'), 'BFCalculatorJourney nao expoe fieldSource para QA.');
assert(pageJs.includes('buildSavedComparison'), 'Pagina de calculadora nao compara previa atual com ultimo salvo.');
assert(pageJs.includes('data-calculator-saved-comparison'), 'Pagina de calculadora nao expoe comparacao com ultimo salvo.');
assert(pageJs.includes('savedComparison: buildSavedComparison'), 'BFCalculatorJourney nao expoe savedComparison para QA.');
assert(pageJs.includes('buildCalculatorImpactPanel'), 'Pagina de calculadora nao calcula painel de impacto da jornada.');
assert(pageJs.includes('renderCalculatorImpactPanel'), 'Pagina de calculadora nao renderiza painel de impacto da jornada.');
assert(pageJs.includes('data-calculator-impact-panel'), 'Pagina de calculadora nao expoe painel de impacto da jornada.');
assert(pageJs.includes('data-calculator-impact-score'), 'Pagina de calculadora nao expoe score no painel de impacto.');
assert(pageJs.includes('data-calculator-impact-risk'), 'Pagina de calculadora nao expoe risco no painel de impacto.');
assert(pageJs.includes('data-calculator-impact-next-step'), 'Pagina de calculadora nao expoe proximo passo no painel de impacto.');
assert(pageJs.includes('data-calculator-impact-source'), 'Pagina de calculadora nao expoe origem preview/saved no painel de impacto.');
assert(pageJs.includes('impactPanel: buildCalculatorImpactPanel'), 'BFCalculatorJourney nao expoe impactPanel para QA.');
assert(pageJs.includes('validateForm(form, meta)'), 'Pagina de calculadora nao valida formulario antes de calcular.');
assert(pageJs.includes('coherenceAlerts(meta.slug, values)'), 'Pagina de calculadora nao calcula alertas de coerencia.');
assert(pageJs.includes('document.body.dataset.calculatorCoherence'), 'Pagina de calculadora nao expoe status de coerencia no body.');
assert(pageJs.includes('buildCalculatorNextAction'), 'Pagina de calculadora nao calcula proxima acao dinamica.');
assert(pageJs.includes('buildCalculatorProfileContinuity'), 'Pagina de calculadora nao calcula continuidade por perfil consolidado.');
assert(pageJs.includes('data-calculator-next-action'), 'Pagina de calculadora nao expoe proxima acao dinamica.');
assert(pageJs.includes('data-calculator-next-action-card'), 'Pagina de calculadora nao expoe card de proxima acao.');
assert(pageJs.includes('data-calculator-profile-continuity'), 'Pagina de calculadora nao expoe continuidade por perfil.');
assert(pageJs.includes('data-calculators-profile-continuity'), 'Hub de calculadoras nao expoe continuidade por perfil.');
assert(pageJs.includes('document.body.dataset.calculatorNextAction'), 'Pagina de calculadora nao expoe proxima acao no body.');
assert(pageJs.includes('document.body.dataset.calculatorProfileContinuity'), 'Pagina de calculadora nao expoe continuidade do perfil no body.');
assert(pageJs.includes('renderPreviewFromForm'), 'Pagina de calculadora nao atualiza previa sem persistencia apos edicao.');
assert(pageJs.includes('profile-preview-not-saved'), 'Continuidade nao diferencia previa sem salvar.');
assert(pageJs.includes('profile-missing-renda'), 'Continuidade nao orienta cliente sem renda.');
assert(pageJs.includes('profile-missing-reserva'), 'Continuidade nao orienta cliente sem reserva.');
assert(pageJs.includes('profile-ready-capacity'), 'Continuidade nao reconhece capacidade pronta.');
assert(pageJs.includes('profile-ready-bid'), 'Continuidade nao reconhece lance sugerido pronto.');
assert(platformCss.includes('.bf-calculator-field[data-calculator-field-state="invalid"]'), 'CSS nao estiliza estado invalido de campo da calculadora.');
assert(platformCss.includes('.bf-calculator-coherence-alert'), 'CSS nao estiliza alerta de coerencia da calculadora.');
assert(platformCss.includes('.bf-calculator-field-source'), 'CSS nao estiliza origem de campo reaproveitado do perfil.');
assert(platformCss.includes('.bf-calculator-saved-comparison'), 'CSS nao estiliza comparacao com ultimo salvo.');
assert(platformCss.includes('.bf-calculator-impact-panel'), 'CSS nao estiliza painel de impacto da calculadora.');
assert(docsMap.includes('19 calculadoras'), 'Mapa completo nao registra o catalogo de 19 calculadoras.');
assert(functionMap.includes('Mapa de funcoes das calculadoras'), 'Mapa funcional das calculadoras nao foi criado.');
assert(functionMap.includes('data-calculator-impact-panel'), 'Mapa funcional das calculadoras nao registra painel de impacto.');

['custos-fixos', 'reserva-emergencia', 'capacidade-credito', 'lance-consorcio', 'compra-vista-parcelado'].forEach((slug) => {
  assert(pageJs.includes(`'${slug}'`), `Jornada critica sem orientacao de campo para ${slug}.`);
});

const context = await createContext();
const storage = context.localStorage;
const serviceCatalog = await context.BFCalculadoras.catalog();
assert(serviceCatalog.length === catalog.length, 'Servico BFCalculadoras nao carrega o catalogo completo.');

const emptyProfileStatus = context.BFDecisionContext.readiness({});
assert(emptyProfileStatus.missing.some((item) => item.key === 'renda'), 'Contexto consolidado nao identifica cliente sem renda.');
const noReserveStatus = context.BFDecisionContext.readiness({
  rendaMensal: 10000,
  gastoMensal: 5000,
  capacidadePagamento: 1800
});
assert(noReserveStatus.missing.some((item) => item.key === 'reserva'), 'Contexto consolidado nao identifica cliente sem reserva.');
const readyProfileStatus = context.BFDecisionContext.readiness({
  rendaMensal: 10000,
  gastoMensal: 5000,
  reservaAtual: 40000,
  capacidadePagamento: 1800
});
assert(readyProfileStatus.complete, 'Contexto consolidado nao reconhece perfil com capacidade pronta.');

const previewReport = [];
for (const calc of serviceCatalog) {
  const defaults = context.BFCalculadoras.profileDefaults(calc);
  const result = await context.BFCalculadoras.simulate(calc.slug, defaults, { persist: false });
  assert(result.slug === calc.slug, `${calc.slug} retornou slug incorreto.`);
  assert(!result.historyId, `${calc.slug} gerou historyId na previa sem persistencia.`);
  assert(Array.isArray(result.metrics) && result.metrics.length >= 3, `${calc.slug} retornou menos de 3 metricas.`);
  assert(Array.isArray(result.memory) && result.memory.length >= 2, `${calc.slug} retornou memoria insuficiente.`);
  assert(result.recommendation && result.recommendation.title && result.recommendation.message, `${calc.slug} sem recomendacao explicavel.`);
  assert(result.profilePatch && typeof result.profilePatch === 'object', `${calc.slug} sem profilePatch.`);
  previewReport.push({
    slug: calc.slug,
    nome: calc.nome,
    page: `pages/calculadora-${calc.slug}.html`,
    inputs: (calc.fields || []).length,
    metrics: result.metrics.length,
    memory: result.memory.length,
    rows: Array.isArray(result.rows) ? result.rows.length : 0,
    profilePatchKeys: Object.keys(result.profilePatch || {})
  });
}

const previewHistoryCount = readStorageJson(storage, HISTORY_KEY, []).length;
const previewProfileStored = storage.getItem(PROFILE_KEY);
const previewAuditStored = storage.getItem(AUDIT_KEY);
assert(previewHistoryCount === 0, 'Previas sem persistencia gravaram historico local.');
assert(storage.getItem(PROFILE_KEY) === null, 'Previas sem persistencia gravaram perfil financeiro local.');
assert(storage.getItem(AUDIT_KEY) === null, 'Previas sem persistencia gravaram auditoria de decisao.');

const capacity = await context.BFCalculadoras.simulate('capacidade-credito', {
  rendaMensal: 10000,
  gastoMensal: 5000,
  dividasMensais: 1000,
  reservaAtual: 30000,
  comprometimentoMaximo: 30,
  margemFluxo: 60,
  mesesReservaMinima: 3
}, { persist: true });
assert(capacity.historyId, 'Submit persistente de capacidade-credito nao retornou historyId.');
assert(capacity.profilePatch.capacidadePagamento === 2000, `Capacidade segura esperada 2000; obteve ${capacity.profilePatch.capacidadePagamento}.`);

const historyAfterCapacity = readStorageJson(storage, HISTORY_KEY, []);
const profileAfterCapacity = readStorageJson(storage, PROFILE_KEY, {});
const auditAfterCapacity = readStorageJson(storage, AUDIT_KEY, []);
assert(historyAfterCapacity.length === 1, `Historico deveria conter 1 entrada apos salvar; encontrou ${historyAfterCapacity.length}.`);
assert(historyAfterCapacity[0].calculatorSlug === 'capacidade-credito', 'Historico persistido perdeu calculatorSlug de capacidade-credito.');
assert(profileAfterCapacity.capacidadePagamento === 2000, 'Perfil financeiro nao recebeu capacidadePagamento persistida.');
assert(auditAfterCapacity.some((item) => item.type === 'calculator-simulated'), 'Auditoria nao registrou calculator-simulated no submit persistente.');

const lance = await context.BFCalculadoras.simulate('lance-consorcio', {
  valorCarta: 200000,
  reservaAtual: 40000,
  gastoMensal: 5000,
  capacidadePagamento: capacity.profilePatch.capacidadePagamento,
  lanceDesejadoPct: 10,
  mesesReservaMinima: 3,
  limiteLancePct: 30
}, { persist: true });
assert(lance.historyId, 'Submit persistente de lance-consorcio nao retornou historyId.');
assert(lance.profilePatch.lanceProprioSugerido === 25000, `Lance proprio seguro esperado 25000; obteve ${lance.profilePatch.lanceProprioSugerido}.`);

const finalHistory = readStorageJson(storage, HISTORY_KEY, []);
const finalProfile = readStorageJson(storage, PROFILE_KEY, {});
assert(finalHistory.length === 2, `Historico deveria conter 2 entradas apos salvar duas calculadoras; encontrou ${finalHistory.length}.`);
assert(finalHistory[0].calculatorSlug === 'lance-consorcio', 'Historico nao preservou a ordem mais recente primeiro.');
assert(finalProfile.valorCarta === 200000, 'Perfil financeiro nao recebeu valorCarta do lance-consorcio.');
assert(finalProfile.lanceProprioSugerido === 25000, 'Perfil financeiro nao recebeu lanceProprioSugerido.');

const report = {
  ok: failures.length === 0,
  calculators: serviceCatalog.length,
  previewDoesNotPersist: previewHistoryCount === 0 && previewProfileStored === null && previewAuditStored === null,
  persistentSubmitChecked: ['capacidade-credito', 'lance-consorcio'],
  formValidation: {
    markers: ['data-calculator-form-alert', 'data-calculator-coherence-alert', 'data-calculator-field', 'data-calculator-field-error'],
    sourceMarkers: ['data-calculator-field-origin', 'data-calculator-field-source'],
    savedComparisonMarkers: ['data-calculator-saved-comparison', 'data-calculator-saved-comparison-item'],
    impactMarkers: ['data-calculator-impact-panel', 'data-calculator-impact-score', 'data-calculator-impact-risk', 'data-calculator-impact-next-step', 'data-calculator-impact-source'],
    nextActionMarkers: ['data-calculator-next-action', 'data-calculator-next-action-card'],
    continuityMarkers: ['data-calculator-profile-continuity', 'data-calculators-profile-continuity'],
    continuityStates: ['profile-preview-not-saved', 'profile-missing-renda', 'profile-missing-reserva', 'profile-ready-capacity', 'profile-ready-bid'],
    criticalSlugs: ['custos-fixos', 'reserva-emergencia', 'capacidade-credito', 'lance-consorcio', 'compra-vista-parcelado']
  },
  generatedAt: new Date().toISOString(),
  previewReport,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(path.join(root, 'docs/test-reports/calculator-journey-report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(JSON.stringify({
  ok: failures.length === 0,
  calculators: serviceCatalog.length,
  previewValidated: previewReport.length,
  historyAfterPersistentSubmits: finalHistory.length,
  failures
}, null, 2));

if (failures.length > 0) process.exit(1);
