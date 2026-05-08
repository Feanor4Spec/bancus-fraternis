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
    querySelectorAll() { return []; },
    createElement() { return { click() {}, set href(value) {}, set download(value) {} }; }
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
    page: 'validator-admin-package-operations',
    href: 'validator-admin-package-operations.html',
    detail,
    createdAt: hoursAgo(hours)
  };
}

function seedJourney(localStorage, owner, events) {
  localStorage.setItem(`bf_journey_analytics_v1:${owner}`, JSON.stringify(events));
}

function containsBlockedData(value) {
  return /password|passwordHash|phone|telefone|cpf/i.test(JSON.stringify(value || {}));
}

async function createContext() {
  const localStorage = new LocalStorageMock();
  const context = {
    console,
    localStorage,
    document: documentMock(),
    location: { pathname: '/pages/dashboard-admin.html', search: '', hash: '', replace() {} },
    URL: {
      createObjectURL() { return 'blob:local'; },
      revokeObjectURL() {}
    },
    Blob: class BlobMock {
      constructor(parts, options) {
        this.parts = parts;
        this.options = options;
      }
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

const adminUsersJs = await readText('assets/js/admin-users.js');
assert(adminUsersJs.includes('data-admin-recovery-imported-items'), 'Dashboard Admin sem lista operacional de itens importados.');
assert(adminUsersJs.includes('data-admin-package-assign'), 'Dashboard Admin sem acao de atribuir item importado.');
assert(adminUsersJs.includes('data-admin-package-handoff'), 'Dashboard Admin sem acao de criar handoff a partir de item importado.');

const context = await createContext();
const { localStorage } = context;
const auth = context.BFAuth;

auth.login('admin@bankfratern.local', 'Admin@123');
auth.createUser({
  name: 'Consultora Pacotes',
  email: 'pacotes@bankfratern.local',
  role: 'consultor',
  status: 'active',
  department: 'Retencao',
  phone: '(11) 4000-0101',
  password: 'Pacotes@123'
});

seedJourney(localStorage, 'cliente.importado@bankfratern.local', [
  event('product_top3_selected', 30, { selectionIds: ['garantia', 'financiamento'], selectedCount: 2 })
]);
seedJourney(localStorage, 'cliente.importado2@bankfratern.local', [
  event('comparator_calculated', 8, { winner: 'Consignado', comparedCount: 5 }),
  event('comparator_loaded_from_products', 9, { productIds: ['consignado', 'cdc'] })
]);

const service = context.BFAdminRecoveryService;
const handoffService = context.BFHandoffConsultivoService;

assert(typeof service.importedItems === 'function', 'BFAdminRecoveryService sem importedItems().');
assert(typeof service.assignImportedItem === 'function', 'BFAdminRecoveryService sem assignImportedItem().');
assert(typeof service.createHandoffFromImportedItem === 'function', 'BFAdminRecoveryService sem createHandoffFromImportedItem().');

const exported = service.exportPackage({ audit: false });
const imported = service.importPackage(exported, {
  label: 'Pacote operacional',
  source: 'unidade-validadora'
});

assert(imported.ok === true, 'Importacao operacional deveria ser aceita.');
assert(service.importedItems().length === exported.items.length, 'Itens importados deveriam ficar operacionais.');

const first = service.importedItems()[0];
assert(first.operationalStatus === 'recebido', 'Item importado deveria iniciar como recebido.');

const assigned = service.assignImportedItem(imported.package.id, first.id, 'pacotes@bankfratern.local');
assert(assigned.ok === true, 'Atribuicao do item importado deveria ser aceita.');
assert(assigned.item.assignedTo === 'pacotes@bankfratern.local', 'Atribuicao nao preservou responsavel.');
assert(assigned.item.operationalStatus === 'atribuido', 'Atribuicao nao marcou item como atribuido.');

const handoff = service.createHandoffFromImportedItem(imported.package.id, first.id, {
  assignedTo: 'pacotes@bankfratern.local'
});
assert(handoff.ok === true, 'Handoff a partir de item importado deveria ser criado.');
assert(handoff.handoff && handoff.handoff.sourceSignalId === first.id, 'Handoff nao preservou sourceSignalId do item.');
assert(handoff.handoff.assignedTo === 'pacotes@bankfratern.local', 'Handoff nao preservou responsavel atribuido.');
assert(handoff.item.operationalStatus === 'handoff-criado', 'Item importado nao foi marcado como handoff-criado.');
assert(handoff.item.handoffId === handoff.handoff.id, 'Item importado nao recebeu handoffId.');

const beforeRepeat = handoffService.list().length;
const repeated = service.createHandoffFromImportedItem(imported.package.id, first.id, {
  assignedTo: 'pacotes@bankfratern.local'
});
assert(repeated.ok === true, 'Reprocessamento do item importado deveria atualizar handoff existente.');
assert(handoffService.list().length === beforeRepeat, 'Reprocessamento nao deveria duplicar handoff do mesmo sinal.');
assert(service.importedItems({ status: 'handoff-criado' }).length === 1, 'Filtro operacional por handoff-criado deveria encontrar o item.');
assert(service.audit().some((item) => item.action === 'import-item-assign'), 'Auditoria nao registrou atribuicao de item.');
assert(service.audit().some((item) => item.action === 'import-item-handoff'), 'Auditoria nao registrou handoff de item importado.');
assert(!containsBlockedData(service.importedPackages()), 'Pacotes operacionais contem dado bloqueado.');

const report = {
  ok: failures.length === 0,
  packageOperations: {
    importedItems: service.importedItems().length,
    assignedTo: assigned.item && assigned.item.assignedTo,
    handoffId: handoff.handoff && handoff.handoff.id,
    handoffs: handoffService.list().length,
    repeatedWithoutDuplicate: handoffService.list().length === beforeRepeat,
    auditActions: service.audit().map((item) => item.action).slice(0, 6)
  },
  uiContract: {
    importedItemsPanel: adminUsersJs.includes('data-admin-recovery-imported-items'),
    assignAction: adminUsersJs.includes('data-admin-package-assign'),
    handoffAction: adminUsersJs.includes('data-admin-package-handoff')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8y-admin-recovery-package-operations-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
