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
}

function documentMock() {
  return {
    readyState: 'complete',
    body: { getAttribute() { return ''; }, dataset: {} },
    addEventListener() {},
    querySelector() { return null; },
    querySelectorAll() { return []; }
  };
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function hoursAgo(hours) {
  return new Date(Date.now() - Number(hours || 0) * 36e5).toISOString();
}

function event(type, hours, detail = {}) {
  return {
    id: `EV-${type}-${hours}`.replace(/[^a-z0-9-]+/gi, '-'),
    type,
    page: 'validator-admin-filter',
    href: 'validator-admin-filter.html',
    detail,
    createdAt: hoursAgo(hours)
  };
}

function seedJourney(localStorage, owner, events) {
  localStorage.setItem(`bf_journey_analytics_v1:${owner}`, JSON.stringify(events));
}

function containsPersonalData(value) {
  return /password|passwordHash|phone|telefone|cpf/i.test(JSON.stringify(value || {}));
}

async function createContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    document: documentMock(),
    location: { pathname: '/pages/dashboard-admin.html', search: '', hash: '', replace() {} }
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);

  for (const script of [
    'js/auth.js',
    'assets/js/services/journey-recovery.service.js',
    'assets/js/services/handoff-consultivo.service.js',
    'assets/js/services/admin-recovery.service.js'
  ]) {
    vm.runInContext(await readText(script), context, { filename: script });
  }
  return context;
}

const context = await createContext();
const { localStorage } = context;
const auth = context.BFAuth;

auth.login('admin@bankfratern.local', 'Admin@123');
auth.createUser({
  name: 'Consultora Retencao',
  email: 'retencao@bankfratern.local',
  role: 'consultor',
  status: 'active',
  department: 'Retencao',
  phone: '(11) 4000-0099',
  password: 'Retencao@123'
});
auth.createUser({
  name: 'Consultor Inativo',
  email: 'consultor.inativo@bankfratern.local',
  role: 'consultor',
  status: 'inactive',
  department: 'Comercial',
  phone: '(11) 4000-0098',
  password: 'Inativo@123'
});

seedJourney(localStorage, 'cliente.alpha@bankfratern.local', [
  event('product_top3_selected', 36, { selectionIds: ['garantia', 'financiamento'], selectedCount: 2 })
]);
seedJourney(localStorage, 'cliente.beta@bankfratern.local', [
  event('comparator_loaded_from_products', 10, { productIds: ['cdc', 'garantia'] }),
  event('products_compare_open', 11, { selectionIds: ['cdc', 'garantia'], href: 'comparador.html' })
]);
seedJourney(localStorage, 'cliente.gamma@bankfratern.local', [
  event('comparator_calculated', 5, { winner: 'Consignado', comparedCount: 5 }),
  event('comparator_loaded_from_products', 6, { productIds: ['consignado', 'cdc'] })
]);
seedJourney(localStorage, 'cliente.delta@bankfratern.local', [
  event('simulator_calculated_financiamento', 2, { simulator: 'financiamento', totalPago: 260000 }),
  event('comparator_saved', 3, { winner: 'Financiamento', comparedCount: 4 })
]);

const adminRecovery = context.BFAdminRecoveryService;
const handoff = context.BFHandoffConsultivoService;

assert(typeof adminRecovery.exportPackage === 'function', 'BFAdminRecoveryService sem exportPackage().');

const all = adminRecovery.list({ includeCreated: true });
assert(all.length === 4, `Fila completa deveria ter 4 itens, obteve ${all.length}.`);

const firstAssignee = all[0] ? all[0].suggestedAssigneeEmail : '';
const byAssignee = adminRecovery.list({ includeCreated: true, filters: { assigneeEmail: firstAssignee } });
assert(firstAssignee && byAssignee.length > 0, 'Filtro por responsavel nao retornou itens.');
assert(byAssignee.every((item) => item.suggestedAssigneeEmail === firstAssignee), 'Filtro por responsavel retornou item de outro consultor.');

const pending = adminRecovery.list({ includeCreated: true, filters: { queueStatus: 'retomada-pendente' } });
const ready = adminRecovery.list({ includeCreated: true, filters: { queueStatus: 'pronto-para-handoff' } });
const high = adminRecovery.list({ includeCreated: true, filters: { severity: 'alta' } });
const decision = adminRecovery.list({ includeCreated: true, filters: { stage: 'decision' } });
const search = adminRecovery.list({ includeCreated: true, filters: { search: 'gamma' } });

assert(pending.length === 3, `Filtro pendente deveria retornar 3, obteve ${pending.length}.`);
assert(ready.length === 1 && ready[0].type === 'simulator-ready', 'Filtro pronto para handoff deveria retornar simulator-ready.');
assert(high.length === 1 && high[0].ownerEmail === 'cliente.alpha@bankfratern.local', 'Filtro alta prioridade inesperado.');
assert(decision.length === 1 && decision[0].type === 'decision-no-continuity', 'Filtro por etapa decision inesperado.');
assert(search.length === 1 && search[0].ownerEmail === 'cliente.gamma@bankfratern.local', 'Filtro por busca gamma inesperado.');

const created = handoff.createFromSignal(all[0].signal, {
  assignedTo: all[0].suggestedAssigneeEmail,
  ownerName: all[0].ownerEmail
});
assert(created && created.assignedTo === all[0].suggestedAssigneeEmail, 'Handoff criado nao preservou assignedTo.');

const openAfterCreate = adminRecovery.list();
const createdOnly = adminRecovery.list({ includeCreated: true, filters: { queueStatus: 'handoff-criado' } });
assert(openAfterCreate.length === 3, `Fila aberta deveria ter 3 apos criacao, obteve ${openAfterCreate.length}.`);
assert(createdOnly.length === 1 && createdOnly[0].existingHandoffId === created.id, 'Filtro handoff-criado nao encontrou lead existente.');

const exported = adminRecovery.exportPackage({ filters: { queueStatus: 'handoff-criado' } });
assert(exported.schema === 'bank-fratern.admin-recovery-export.v1', 'Export schema inesperado.');
assert(exported.items.length === 1, `Export filtrado deveria ter 1 item, obteve ${exported.items.length}.`);
assert(exported.summary.existingHandoffs === 1, 'Export nao consolidou existingHandoffs.');
assert(exported.filters.queueStatus === 'handoff-criado', 'Export nao preservou filtro de status.');
assert(!containsPersonalData(exported), 'Export contem dado pessoal sensivel ou credencial.');

const report = {
  ok: failures.length === 0,
  filters: {
    all: all.length,
    byAssignee: byAssignee.length,
    pending: pending.length,
    ready: ready.length,
    high: high.length,
    decision: decision.length,
    search: search.length,
    openAfterCreate: openAfterCreate.length,
    createdOnly: createdOnly.length
  },
  exportPackage: {
    schema: exported.schema,
    items: exported.items.length,
    existingHandoffs: exported.summary.existingHandoffs,
    queueStatus: exported.filters.queueStatus
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8w-admin-recovery-filters-export-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
