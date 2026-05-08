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
    page: 'validator-admin-package-sla-filters',
    href: 'validator-admin-package-sla-filters.html',
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
assert(adminUsersJs.includes('data-admin-package-filters'), 'Dashboard Admin sem filtros dedicados de itens importados.');
assert(adminUsersJs.includes('data-admin-package-filter="sla"'), 'Dashboard Admin sem filtro de SLA de itens importados.');
assert(adminUsersJs.includes('SLA vencido'), 'Dashboard Admin sem indicador de SLA vencido.');

const context = await createContext();
const { localStorage } = context;
const auth = context.BFAuth;

auth.login('admin@bankfratern.local', 'Admin@123');
auth.createUser({
  name: 'Consultora SLA',
  email: 'sla@bankfratern.local',
  role: 'consultor',
  status: 'active',
  department: 'Retencao',
  phone: '(11) 4000-0102',
  password: 'Sla@12345'
});

seedJourney(localStorage, 'cliente.sla-alto@bankfratern.local', [
  event('product_top3_selected', 36, { selectionIds: ['garantia', 'financiamento'], selectedCount: 2 })
]);
seedJourney(localStorage, 'cliente.sla-medio@bankfratern.local', [
  event('comparator_loaded_from_products', 10, { productIds: ['cdc', 'garantia'] }),
  event('products_compare_open', 11, { selectionIds: ['cdc', 'garantia'] })
]);

const service = context.BFAdminRecoveryService;
const handoffService = context.BFHandoffConsultivoService;

assert(typeof service.importedItemsSummary === 'function', 'BFAdminRecoveryService sem importedItemsSummary().');

const exported = service.exportPackage({ audit: false });
assert(exported.items.length >= 2, 'Export base deveria gerar ao menos 2 itens para filtros.');

const oldPackage = {
  ...exported,
  generatedAt: hoursAgo(80)
};
const freshPackage = {
  ...exported,
  generatedAt: hoursAgo(1)
};

const oldImport = service.importPackage(oldPackage, {
  label: 'Pacote SLA antigo',
  source: 'unidade-antiga',
  importedAt: hoursAgo(80)
});
const freshImport = service.importPackage(freshPackage, {
  label: 'Pacote SLA recente',
  source: 'unidade-recente',
  importedAt: hoursAgo(1)
});

assert(oldImport.ok === true && freshImport.ok === true, 'Importacoes antigas e recentes deveriam ser aceitas.');

const allItems = service.importedItems();
const overdue = service.importedItems({ sla: 'vencido' });
const within = service.importedItems({ sla: 'no-prazo' });
const high = service.importedItems({ severity: 'alta' });
const search = service.importedItems({ search: 'sla-alto' });

assert(allItems.length === exported.items.length * 2, 'Itens importados deveriam refletir dois pacotes.');
assert(overdue.length >= exported.items.length, 'Filtro de SLA vencido deveria encontrar pacote antigo.');
assert(within.length >= exported.items.length, 'Filtro de SLA no prazo deveria encontrar pacote recente.');
assert(high.length >= 2, 'Filtro de alta prioridade deveria encontrar itens altos.');
assert(search.length >= 2, 'Busca por cliente deveria encontrar itens nos dois pacotes.');
assert(overdue.every((item) => item.slaOverdue === true), 'Filtro vencido retornou item sem SLA vencido.');
assert(within.every((item) => item.slaOverdue === false && item.operationalStatus !== 'handoff-criado'), 'Filtro no prazo retornou item fora do contrato.');

const target = overdue[0];
const assigned = service.assignImportedItem(target.packageId, target.id, 'sla@bankfratern.local');
assert(assigned.ok === true, 'Atribuicao de item vencido deveria funcionar.');
assert(service.importedItems({ status: 'atribuido' }).length === 1, 'Filtro de atribuido deveria encontrar 1 item.');
const byResponsible = service.importedItems({ assignedTo: 'sla@bankfratern.local' });
assert(byResponsible.some((item) => item.packageId === target.packageId && item.id === target.id), 'Filtro de responsavel deveria incluir item atribuido.');

const handoff = service.createHandoffFromImportedItem(target.packageId, target.id, {
  assignedTo: 'sla@bankfratern.local'
});
assert(handoff.ok === true, 'Handoff de item com SLA deveria ser criado.');
assert(handoffService.list().length === 1, 'Handoff deveria ser unico.');
assert(service.importedItems({ sla: 'concluido' }).length === 1, 'Filtro concluido deveria encontrar item com handoff.');

const summary = service.importedItemsSummary(service.importedItems());
assert(summary.total === allItems.length, 'Resumo deveria preservar total de itens.');
assert(summary.handoffs === 1, 'Resumo deveria contar handoff criado.');
assert(summary.overdue >= overdue.length - 1, 'Resumo deveria contar atrasos pendentes.');
assert(summary.pending === allItems.length - 1, 'Resumo deveria subtrair item com handoff.');
assert(!containsBlockedData(service.importedPackages()), 'Pacotes com SLA contem dado bloqueado.');

const report = {
  ok: failures.length === 0,
  packageSlaFilters: {
    importedItems: allItems.length,
    overdue: service.importedItems({ sla: 'vencido' }).length,
    within,
    high: high.length,
    search: search.length,
    byResponsible: byResponsible.length,
    assigned: service.importedItems({ status: 'atribuido' }).length,
    concluded: service.importedItems({ sla: 'concluido' }).length,
    summary
  },
  uiContract: {
    filters: adminUsersJs.includes('data-admin-package-filters'),
    slaFilter: adminUsersJs.includes('data-admin-package-filter="sla"'),
    overdueMetric: adminUsersJs.includes('SLA vencido')
  },
  failures
};

report.packageSlaFilters.within = within.length;

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8z-admin-recovery-package-sla-filters-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
