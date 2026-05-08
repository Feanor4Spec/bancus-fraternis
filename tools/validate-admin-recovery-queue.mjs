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

function documentMock() {
  return {
    readyState: 'complete',
    body: {
      getAttribute() { return ''; },
      dataset: {}
    },
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
    page: 'validator-admin',
    href: 'validator-admin.html',
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
    document: documentMock(),
    location: {
      pathname: '/pages/dashboard-admin.html',
      search: '',
      hash: '',
      replace() {}
    }
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
  password: 'Retencao@123'
});
auth.createUser({
  name: 'Consultor Inativo',
  email: 'consultor.inativo@bankfratern.local',
  role: 'consultor',
  status: 'inactive',
  department: 'Comercial',
  password: 'Inativo@123'
});

seedJourney(localStorage, 'cliente.alpha@bankfratern.local', [
  event('product_top3_selected', 36, { selectionIds: ['garantia', 'financiamento', 'veiculos'], selectedCount: 3 })
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

const recovery = context.BFJourneyRecoveryService;
const adminRecovery = context.BFAdminRecoveryService;
const handoff = context.BFHandoffConsultivoService;

assert(typeof adminRecovery.list === 'function', 'BFAdminRecoveryService sem list().');
assert(typeof adminRecovery.summary === 'function', 'BFAdminRecoveryService sem summary().');
assert(typeof adminRecovery.suggestedAssignee === 'function', 'BFAdminRecoveryService sem suggestedAssignee().');

const signals = recovery.list({ includeComplete: true });
const queue = adminRecovery.list({ includeCreated: true });
const summary = adminRecovery.summary(queue, auth.listUsers());
const consultants = adminRecovery.consultantPool(auth.listUsers());

assert(signals.length === 4, `Esperava 4 sinais totais, encontrou ${signals.length}.`);
assert(queue.length === 4, `Fila admin deveria ter 4 itens, encontrou ${queue.length}.`);
assert(summary.open === 4, `Fila admin deveria ter 4 abertos, encontrou ${summary.open}.`);
assert(summary.high >= 1, `Fila admin deveria ter alta prioridade, obteve ${summary.high}.`);
assert(summary.consultants === 2, `Fila deveria ter 2 consultores ativos, obteve ${summary.consultants}.`);
assert(consultants.every((user) => user.status === 'active'), 'Pool de consultores contem usuario inativo.');
assert(queue.every((item) => item.suggestedAssigneeEmail), 'Algum item da fila ficou sem responsavel sugerido.');
assert(queue.every((item) => item.stageLabel && item.severityLabel), 'Fila sem labels de etapa/severidade.');

const top = queue[0];
const created = handoff.createFromSignal(top.signal, {
  assignedTo: top.suggestedAssigneeEmail,
  ownerName: top.ownerEmail
});
assert(created && created.id, 'Nao criou handoff a partir da fila admin.');
assert(created.sourceSignalId === top.id, 'Handoff criado perdeu sourceSignalId.');
assert(created.assignedTo === top.suggestedAssigneeEmail, 'Handoff nao recebeu responsavel sugerido.');

const afterOpenQueue = adminRecovery.list();
const afterFullQueue = adminRecovery.list({ includeCreated: true });
const existingItem = afterFullQueue.find((item) => item.id === top.id);
assert(afterOpenQueue.length === 3, `Fila aberta deveria cair para 3 apos criar handoff, obteve ${afterOpenQueue.length}.`);
assert(existingItem && existingItem.existingHandoffId === created.id, 'Fila completa nao marcou handoff existente.');
assert(existingItem && existingItem.queueStatus === 'handoff-criado', 'Fila completa nao marcou status handoff-criado.');

const report = {
  ok: failures.length === 0,
  recovery: {
    signals: signals.length,
    queue: queue.length,
    openAfterCreate: afterOpenQueue.length,
    totalAfterCreate: afterFullQueue.length,
    summary: {
      total: summary.total,
      open: summary.open,
      high: summary.high,
      consultants: summary.consultants,
      owners: summary.owners,
      readyForHandoff: summary.readyForHandoff
    },
    top: {
      type: top.type,
      stage: top.stageLabel,
      severity: top.severity,
      suggestedAssignee: top.suggestedAssigneeEmail
    }
  },
  handoff: {
    createdId: created && created.id,
    sourceSignalId: created && created.sourceSignalId,
    assignedTo: created && created.assignedTo,
    total: handoff.list().length
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8v-admin-recovery-queue-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
