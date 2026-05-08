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

  get length() {
    return this.store.size;
  }

  key(index) {
    return Array.from(this.store.keys())[index] || null;
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

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function hoursAgo(hours) {
  return new Date(Date.now() - (Number(hours || 0) * 36e5)).toISOString();
}

function event(type, hours, detail = {}) {
  return {
    id: `EV-${type}-${hours}`.replace(/[^a-z0-9-]+/gi, '-'),
    type,
    page: 'validator',
    href: 'validator.html',
    detail,
    createdAt: hoursAgo(hours)
  };
}

function seedJourney(localStorage, owner, events) {
  localStorage.setItem(`bf_journey_analytics_v1:${owner}`, JSON.stringify(events));
}

async function createContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    location: { pathname: '/pages/validator.html', search: '' },
    window: null,
    globalThis: null
  };
  context.window = context;
  context.globalThis = context;
  context.BFAuth = {
    getCurrentUser: () => ({
      email: 'consultor@bankfratern.local',
      name: 'Consultor Local',
      role: 'consultor'
    })
  };
  vm.createContext(context);

  for (const script of [
    'assets/js/services/journey-recovery.service.js',
    'assets/js/services/handoff-consultivo.service.js'
  ]) {
    vm.runInContext(await readText(script), context, { filename: script });
  }

  return context;
}

const context = await createContext();
const { localStorage } = context;

seedJourney(localStorage, 'cliente.selecao@bankfratern.local', [
  event('product_top3_selected', 30, { selectionIds: ['garantia', 'financiamento', 'veiculos'], selectedCount: 3 })
]);

seedJourney(localStorage, 'cliente.comparador@bankfratern.local', [
  event('comparator_loaded_from_products', 7, { productIds: ['cdc', 'garantia'] }),
  event('products_compare_open', 8, { selectionIds: ['cdc', 'garantia'], href: 'comparador.html' }),
  event('product_selected', 9, { productId: 'garantia', selectionIds: ['garantia'] })
]);

seedJourney(localStorage, 'cliente.decisao@bankfratern.local', [
  event('comparator_calculated', 3, { winner: 'Consignado', comparedCount: 5 }),
  event('comparator_loaded_from_products', 4, { productIds: ['consignado', 'cdc'] }),
  event('product_selected', 5, { productId: 'consignado', selectionIds: ['consignado'] })
]);

seedJourney(localStorage, 'cliente.salvo@bankfratern.local', [
  event('comparator_saved', 28, { winner: 'Credito com garantia', comparedCount: 4 }),
  event('comparator_calculated', 29, { winner: 'Credito com garantia', comparedCount: 4 }),
  event('comparator_loaded_from_products', 30, { productIds: ['garantia'] })
]);

seedJourney(localStorage, 'cliente.simulador@bankfratern.local', [
  event('simulator_calculated_garantia', 1, { simulator: 'garantia', totalPago: 180000 }),
  event('simulator_opened_from_comparator', 2, { simulator: 'simulador-garantia', href: 'simulador-garantia.html' }),
  event('comparator_saved', 3, { winner: 'Credito com garantia', comparedCount: 4 })
]);

const recovery = context.BFJourneyRecoveryService;
const handoff = context.BFHandoffConsultivoService;

assert(typeof recovery.list === 'function', 'BFJourneyRecoveryService sem list().');
assert(typeof recovery.summary === 'function', 'BFJourneyRecoveryService sem summary().');
assert(typeof handoff.createFromSignal === 'function', 'BFHandoffConsultivoService sem createFromSignal().');
assert(typeof handoff.findBySignal === 'function', 'BFHandoffConsultivoService sem findBySignal().');

const openSignals = recovery.list();
const allSignals = recovery.list({ includeComplete: true });
const summary = recovery.summary(allSignals);
const types = openSignals.map((signal) => signal.type);

assert(openSignals.length === 4, `Esperava 4 sinais abertos, encontrou ${openSignals.length}.`);
assert(allSignals.length === 5, `Esperava 5 sinais totais incluindo simulador pronto, encontrou ${allSignals.length}.`);
for (const type of ['selection-no-comparator', 'comparator-no-matrix', 'decision-no-continuity', 'saved-no-simulator']) {
  assert(types.includes(type), `Sinal aberto ausente: ${type}.`);
}
assert(allSignals.some((signal) => signal.type === 'simulator-ready'), 'Sinal simulator-ready ausente quando includeComplete=true.');
assert(summary.high >= 2, `Resumo deveria ter ao menos 2 sinais altos, obteve ${summary.high}.`);
assert(summary.open === 4, `Resumo deveria ter 4 sinais abertos, obteve ${summary.open}.`);
assert(summary.readyForHandoff >= 4, `Resumo deveria ter sinais prontos para handoff, obteve ${summary.readyForHandoff}.`);

const topSignal = openSignals[0];
assert(topSignal.type === 'saved-no-simulator' || topSignal.type === 'selection-no-comparator', `Sinal prioritario inesperado: ${topSignal.type}.`);
assert(topSignal.ownerEmail, 'Sinal prioritario sem ownerEmail.');
assert(topSignal.ctaHref, 'Sinal prioritario sem CTA.');

const created = handoff.createFromSignal(topSignal, { ownerName: 'Cliente Retomada' });
assert(created && created.id, 'createFromSignal nao criou handoff.');
assert(created.sourceSignalId === topSignal.id, 'Handoff nao preservou sourceSignalId.');
assert(created.ownerEmail === topSignal.ownerEmail, 'Handoff nao preservou ownerEmail do sinal.');
assert(created.priority === topSignal.priority, 'Handoff nao herdou prioridade do sinal.');
assert(created.summary && created.summary.nextActionHref === topSignal.ctaHref, 'Handoff nao levou CTA do sinal para summary.');
assert((created.checklist || []).length >= 4, 'Handoff por sinal sem checklist minimo.');

const refreshed = handoff.createFromSignal(topSignal);
assert(refreshed && refreshed.id === created.id, 'createFromSignal duplicou handoff em vez de atualizar.');
assert(handoff.list().length === 1, `Handoff por sinal deveria manter 1 lead, encontrou ${handoff.list().length}.`);
assert(handoff.findBySignal(topSignal.id, topSignal.ownerEmail), 'findBySignal nao encontrou lead criado.');
assert(handoff.audit().some((item) => item.action === 'signal-create'), 'Auditoria sem signal-create.');
assert(handoff.audit().some((item) => item.action === 'signal-refresh'), 'Auditoria sem signal-refresh.');

const report = {
  ok: failures.length === 0,
  signals: {
    open: openSignals.length,
    total: allSignals.length,
    types,
    summary: {
      total: summary.total,
      open: summary.open,
      readyForHandoff: summary.readyForHandoff,
      high: summary.high,
      medium: summary.medium,
      low: summary.low,
      owners: summary.owners,
      topType: summary.top ? summary.top.type : null
    }
  },
  handoff: {
    createdId: created && created.id,
    sourceSignalId: created && created.sourceSignalId,
    priority: created && created.priority,
    checklist: created && created.checklist ? created.checklist.length : 0,
    total: handoff.list().length,
    audit: handoff.audit().length
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8u-recovery-signals-flow-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
