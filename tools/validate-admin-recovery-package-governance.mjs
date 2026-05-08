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
    page: 'validator-admin-package',
    href: 'validator-admin-package.html',
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

const service = context.BFAdminRecoveryService;

assert(typeof service.exportPackage === 'function', 'BFAdminRecoveryService sem exportPackage().');
assert(typeof service.importPackage === 'function', 'BFAdminRecoveryService sem importPackage().');
assert(typeof service.importedPackages === 'function', 'BFAdminRecoveryService sem importedPackages().');
assert(typeof service.audit === 'function', 'BFAdminRecoveryService sem audit().');
assert(typeof service.validatePackage === 'function', 'BFAdminRecoveryService sem validatePackage().');

const exported = service.exportPackage({ filters: { severity: 'alta' } });
assert(exported.schema === 'bank-fratern.admin-recovery-export.v1', 'Schema exportado inesperado.');
assert(exported.items.length === 1, `Export por alta prioridade deveria ter 1 item, obteve ${exported.items.length}.`);
assert(service.audit().some((item) => item.action === 'export'), 'Auditoria nao registrou export.');
assert(!containsBlockedData(exported), 'Export contem dado bloqueado.');

const validation = service.validatePackage(JSON.stringify(exported));
assert(validation.ok === true, 'validatePackage deveria aceitar JSON exportado.');
assert(validation.items.length === exported.items.length, 'validatePackage perdeu itens validos.');

const imported = service.importPackage(JSON.stringify(exported), {
  label: 'Pacote navegador A',
  source: 'browser-a'
});
assert(imported.ok === true && imported.duplicate === false, 'Importacao inicial deveria ser aceita.');
assert(imported.package && imported.package.itemCount === exported.items.length, 'Importacao nao preservou itemCount.');
assert(imported.package.source === 'browser-a', 'Importacao nao preservou source.');
assert(service.importedPackages().length === 1, 'Importacao deveria gravar 1 pacote.');
assert(service.audit().some((item) => item.action === 'import'), 'Auditoria nao registrou import.');
assert(!containsBlockedData(service.importedPackages()), 'Pacote importado contem dado bloqueado.');

const duplicated = service.importPackage(exported, { source: 'browser-a' });
assert(duplicated.ok === true && duplicated.duplicate === true, 'Importacao duplicada deveria ser reconhecida.');
assert(service.importedPackages().length === 1, 'Importacao duplicada nao deveria duplicar pacote.');
assert(service.audit().some((item) => item.action === 'import-duplicate'), 'Auditoria nao registrou duplicidade.');

const invalidSchema = service.importPackage({ schema: 'unknown', items: [] }, { source: 'bad-schema' });
assert(invalidSchema.ok === false, 'Pacote invalido deveria ser recusado.');
assert(service.audit().some((item) => item.action === 'import-rejected'), 'Auditoria nao registrou rejeicao.');

const report = {
  ok: failures.length === 0,
  exportPackage: {
    schema: exported.schema,
    items: exported.items.length,
    filterSeverity: exported.filters.severity
  },
  importPackage: {
    imported: imported.ok,
    duplicate: duplicated.duplicate,
    packages: service.importedPackages().length,
    audit: service.audit().length,
    rejected: invalidSchema.ok === false
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8x-admin-recovery-package-governance-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
