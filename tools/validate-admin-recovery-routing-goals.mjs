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
    page: 'validator-admin-routing-goals',
    href: 'validator-admin-routing-goals.html',
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
assert(adminUsersJs.includes('data-admin-package-routing'), 'Dashboard Admin sem painel de roteamento de pacotes.');
assert(adminUsersJs.includes('data-admin-package-route'), 'Dashboard Admin sem acao de roteamento automatico.');
assert(adminUsersJs.includes('data-admin-package-goal-input'), 'Dashboard Admin sem input de meta por consultor.');
assert(adminUsersJs.includes('data-admin-package-save-goal'), 'Dashboard Admin sem acao de salvar meta.');

const context = await createContext();
const { localStorage } = context;
const auth = context.BFAuth;

auth.login('admin@bankfratern.local', 'Admin@123');
auth.createUser({
  name: 'Consultora Norte',
  email: 'norte@bankfratern.local',
  role: 'consultor',
  status: 'active',
  department: 'Carteira Norte',
  phone: '(11) 4000-0201',
  password: 'Norte@123'
});
auth.createUser({
  name: 'Consultor Sul',
  email: 'sul@bankfratern.local',
  role: 'consultor',
  status: 'active',
  department: 'Carteira Sul',
  phone: '(11) 4000-0202',
  password: 'Sul@123'
});

seedJourney(localStorage, 'cliente.rota1@bankfratern.local', [
  event('product_top3_selected', 36, { selectionIds: ['garantia', 'financiamento'], selectedCount: 2 })
]);
seedJourney(localStorage, 'cliente.rota2@bankfratern.local', [
  event('comparator_loaded_from_products', 12, { productIds: ['cdc', 'garantia'] }),
  event('products_compare_open', 13, { selectionIds: ['cdc', 'garantia'] })
]);
seedJourney(localStorage, 'cliente.rota3@bankfratern.local', [
  event('comparator_calculated', 6, { winner: 'Consignado', comparedCount: 5 }),
  event('comparator_loaded_from_products', 7, { productIds: ['consignado', 'cdc'] })
]);
seedJourney(localStorage, 'cliente.rota4@bankfratern.local', [
  event('comparator_saved', 18, { scenarioId: 'CEN-ROTA-4', winner: 'Consorcio' }),
  event('comparator_calculated', 19, { winner: 'Consorcio', comparedCount: 5 })
]);

const service = context.BFAdminRecoveryService;
const handoffService = context.BFHandoffConsultivoService;

assert(typeof service.routeImportedItems === 'function', 'BFAdminRecoveryService sem routeImportedItems().');
assert(typeof service.conversionScoreboard === 'function', 'BFAdminRecoveryService sem conversionScoreboard().');
assert(typeof service.saveConversionGoal === 'function', 'BFAdminRecoveryService sem saveConversionGoal().');
assert(typeof service.conversionGoals === 'function', 'BFAdminRecoveryService sem conversionGoals().');

const exported = service.exportPackage({ audit: false });
const imported = service.importPackage(exported, {
  label: 'Pacote roteamento',
  source: 'unidade-roteamento',
  importedAt: hoursAgo(12)
});

assert(imported.ok === true, 'Pacote de roteamento deveria ser importado.');
assert(service.importedItems().length >= 4, 'Roteamento deveria ter ao menos 4 itens importados.');

const goalNorth = service.saveConversionGoal('norte@bankfratern.local', 1, { label: 'Carteira Norte' });
const goalSouth = service.saveConversionGoal('sul@bankfratern.local', 1, { label: 'Carteira Sul' });
assert(goalNorth.ok === true && goalSouth.ok === true, 'Metas por consultor deveriam ser salvas.');

const routed = service.routeImportedItems({
  users: auth.listUsers(),
  strategy: 'rebalance',
  routeName: 'Carteira validacao'
});

assert(routed.ok === true, 'Roteamento automatico deveria ser aceito.');
assert(routed.routed === service.importedItems().length, 'Roteamento deveria atribuir todos os itens pendentes.');
assert(new Set(routed.items.map((item) => item.assignedTo)).size >= 2, 'Roteamento rebalanceado deveria distribuir em ao menos 2 consultores.');
assert(routed.items.every((item) => item.operationalStatus === 'atribuido'), 'Itens roteados deveriam ficar atribuidos.');
assert(routed.items.every((item) => item.routeName === 'Carteira validacao'), 'Itens roteados deveriam preservar nome da carteira.');

const scoreboardBefore = service.conversionScoreboard({ users: auth.listUsers() });
assert(scoreboardBefore.routed === routed.routed, 'Placar deveria contar itens roteados.');
assert(scoreboardBefore.totalTarget >= 2, 'Placar deveria somar metas salvas.');
assert(scoreboardBefore.consultants.some((item) => item.assignedTo === 'norte@bankfratern.local' && item.targetHandoffs === 1), 'Placar deveria carregar meta da carteira Norte.');
assert(scoreboardBefore.consultants.some((item) => item.assignedTo === 'sul@bankfratern.local' && item.targetHandoffs === 1), 'Placar deveria carregar meta da carteira Sul.');

const first = routed.items[0];
const handoff = service.createHandoffFromImportedItem(first.packageId, first.id, {
  assignedTo: first.assignedTo
});
assert(handoff.ok === true, 'Handoff a partir de item roteado deveria ser criado.');
assert(handoffService.list().length === 1, 'Handoff roteado deveria ser unico.');

const scoreboardAfter = service.conversionScoreboard({ users: auth.listUsers() });
assert(scoreboardAfter.totalHandoffs === 1, 'Placar deveria contar handoff criado.');
assert(scoreboardAfter.progress > 0, 'Progresso de meta deveria subir apos handoff.');
assert(scoreboardAfter.consultants.some((item) => item.handoffs === 1 && item.progress >= 100), 'Consultor com meta 1 deveria atingir 100% apos handoff.');
assert(service.audit().some((item) => item.action === 'import-item-route'), 'Auditoria nao registrou roteamento por item.');
assert(service.audit().some((item) => item.action === 'import-routing-run'), 'Auditoria nao registrou execucao de roteamento.');
assert(service.audit().some((item) => item.action === 'conversion-goal-save'), 'Auditoria nao registrou meta de conversao.');
assert(!containsBlockedData(service.importedPackages()), 'Pacotes roteados contem dado bloqueado.');

const report = {
  ok: failures.length === 0,
  routingGoals: {
    importedItems: service.importedItems().length,
    routed: routed.routed,
    routeName: routed.routeName,
    consultants: scoreboardAfter.consultants.map((item) => ({
      assignedTo: item.assignedTo,
      total: item.total,
      pending: item.pending,
      handoffs: item.handoffs,
      targetHandoffs: item.targetHandoffs,
      progress: item.progress
    })),
    totalTarget: scoreboardAfter.totalTarget,
    totalHandoffs: scoreboardAfter.totalHandoffs,
    progress: scoreboardAfter.progress
  },
  uiContract: {
    routingPanel: adminUsersJs.includes('data-admin-package-routing'),
    routeAction: adminUsersJs.includes('data-admin-package-route'),
    goalInput: adminUsersJs.includes('data-admin-package-goal-input'),
    saveGoal: adminUsersJs.includes('data-admin-package-save-goal')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8aa-admin-recovery-routing-goals-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
