import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

class LocalStorageMock {
  constructor() {
    this.store = new Map();
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
    body: {
      dataset: {},
      getAttribute() {
        return '';
      }
    },
    addEventListener() {},
    querySelector() {
      return null;
    },
    querySelectorAll() {
      return [];
    }
  };
}

const [authSource, sharedLayoutSource, storageSource, loginSource, loginHtml, designValidator, contractsDoc] = await Promise.all([
  readText('js/auth.js'),
  readText('js/shared-layout.js'),
  readText('js/storage.js'),
  readText('assets/js/login.js'),
  readText('pages/login.html'),
  readText('tools/validate-design-system.mjs'),
  readText('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md')
]);

[
  'data-login-form',
  'data-login-email',
  'data-login-password',
  'data-demo-login',
  'data-password-change-form',
  'data-change-current',
  'aria-live="polite"'
].forEach((marker) => assert(loginHtml.includes(marker), `login.html sem ${marker}.`));

[
  'performLogin',
  'initLoginPage',
  'goToTarget',
  'safeRequestedTarget',
  'BFLoginSecurity',
  'loginRedirectReady',
  'loginRedirectTarget',
  'await Promise.resolve(window.BFAuth.login',
  "requested.toLowerCase().startsWith('login.html')"
].forEach((marker) => assert(loginSource.includes(marker), `login.js sem contrato ${marker}.`));

[
  'loginPageUrl',
  'requireRole',
  'configureMode',
  'validateServerSession',
  'bf_auth_session_v1',
  'bf_auth_users_v1',
  'redirect=${encodeURIComponent(current)}',
  'roleHomeUrl',
  "admin: 'dashboard-admin.html'",
  "consultor: 'handoff-consultivo.html'",
  "cliente: 'dashboard-cliente.html'"
].forEach((marker) => assert(authSource.includes(marker), `auth.js sem contrato ${marker}.`));

[
  'renderAuthorizationFeedback',
  "params.get('auth') !== 'forbidden'",
  "notice.setAttribute('role', 'status')",
  "notice.setAttribute('aria-live', 'polite')",
  "params.delete('auth')",
  'window.history.replaceState',
  'Esta área não está disponível para o seu acesso.'
].forEach((marker) => assert(sharedLayoutSource.includes(marker), `shared-layout.js sem feedback de acesso ${marker}.`));

[
  '_isProductionMode',
  '_sanitizeProductionSimulationEntry',
  'localPIIStored: false',
  'entries.map(_sanitizeProductionSimulationEntry)',
  '_publishSimulationSnapshot(entry)',
  '_publishDirectSimulation(entry)'
].forEach((marker) => assert(storageSource.includes(marker), `storage.js sem contrato produtivo ${marker}.`));

const loginContext = {
  window: null,
  document: { readyState: 'loading', addEventListener() {} },
  location: { search: '' },
  URLSearchParams,
  Object,
  String,
  Promise
};
loginContext.window = loginContext;
vm.createContext(loginContext);
vm.runInContext(loginSource, loginContext, { filename: 'assets/js/login.js' });
const redirectSecurity = loginContext.BFLoginSecurity;
assert(redirectSecurity && typeof redirectSecurity.safeRequestedTarget === 'function', 'Contrato de redirect seguro indisponivel.');

for (const unsafe of [
  'javascript:alert(1)',
  'data:text/html,unsafe',
  '//evil.example/path',
  '\\evil.example/path',
  '../server.js',
  'login.html?redirect=dashboard-admin.html',
  'simulador.html\\evil'
]) {
  loginContext.location.search = `?redirect=${encodeURIComponent(unsafe)}`;
  assert(redirectSecurity.safeRequestedTarget() === '', `Redirect inseguro aceito: ${unsafe}.`);
}
loginContext.location.search = `?redirect=${encodeURIComponent('simulador.html?journeyId=J-1#proposta')}`;
assert(
  redirectSecurity.safeRequestedTarget() === 'simulador.html?journeyId=J-1#proposta',
  'Redirect interno valido nao foi preservado.'
);

assert(designValidator.includes('tools/validate-auth-navigation.mjs'), 'validate-design-system nao exige validate-auth-navigation.');
assert(contractsDoc.includes('tools/validate-auth-navigation.mjs'), 'Contratos publicos nao documentam validate-auth-navigation.');
assert(contractsDoc.includes('data-login-form'), 'Contratos publicos nao documentam formulario de login.');

const context = {
  console,
  localStorage: new LocalStorageMock(),
  document: documentMock(),
  location: {
    pathname: '/pages/handoff-consultivo.html',
    search: '?from=lousa',
    hash: '#fila-handoff',
    replaced: '',
    replace(value) {
      this.replaced = String(value || '');
    }
  },
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  Error
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(authSource, context, { filename: 'js/auth.js' });

const auth = context.BFAuth;
assert(auth && typeof auth.login === 'function', 'BFAuth.login indisponivel.');
assert(auth && typeof auth.requireRole === 'function', 'BFAuth.requireRole indisponivel.');

const adminLogin = auth.login('admin@bankfratern.local', 'Admin@123');
assert(adminLogin.ok === true, `Login admin falhou: ${adminLogin.message || 'sem mensagem'}.`);
assert(auth.getCurrentUser().role === 'admin', 'Sessao admin nao foi criada.');
assert(auth.requireRole(['admin', 'consultor'], { redirect: false }).role === 'admin', 'Admin nao passou em rota admin/consultor.');

auth.logout();
context.location.replaced = '';
const anonymous = auth.requireRole(['admin', 'consultor'], { redirect: true });
assert(anonymous === null, 'Usuario anonimo deveria ser bloqueado.');
assert(
  context.location.replaced === 'login.html?redirect=handoff-consultivo.html%3Ffrom%3Dlousa%23fila-handoff',
  `Redirect anonimo inesperado: ${context.location.replaced}.`
);

const forbiddenRedirects = {};
for (const scenario of [
  {
    role: 'cliente',
    email: 'cliente@bankfratern.local',
    password: 'Cliente@123',
    required: ['admin'],
    expected: 'dashboard-cliente.html?auth=forbidden'
  },
  {
    role: 'consultor',
    email: 'consultor@bankfratern.local',
    password: 'Consultor@123',
    required: ['cliente'],
    expected: 'handoff-consultivo.html?auth=forbidden'
  },
  {
    role: 'admin',
    email: 'admin@bankfratern.local',
    password: 'Admin@123',
    required: ['cliente'],
    expected: 'dashboard-admin.html?auth=forbidden'
  }
]) {
  auth.logout();
  const login = auth.login(scenario.email, scenario.password);
  assert(login.ok === true, `Login ${scenario.role} falhou: ${login.message || 'sem mensagem'}.`);
  context.location.replaced = '';
  const forbidden = auth.requireRole(scenario.required, { redirect: true });
  forbiddenRedirects[scenario.role] = context.location.replaced;
  assert(forbidden === null, `${scenario.role} deveria ser bloqueado na rota incompatível.`);
  assert(
    context.location.replaced === scenario.expected,
    `Redirect forbidden ${scenario.role} inesperado: ${context.location.replaced}.`
  );
}

const productionLocalStorage = new LocalStorageMock();
productionLocalStorage.setItem('consorciopro_simulations', JSON.stringify([{
  id: 'SIM-LEGACY-PII',
  proposalId: 'PROP-LEGACY-PII',
  nome: 'Simulação da Cliente Legada',
  cliente: 'Cliente Legada',
  clienteCpf: '52998224725',
  clienteEmail: 'legada@example.com',
  clienteTelefone: '11999999999',
  ownerEmail: 'legada@example.com',
  params: {
    valorCarta: 150000,
    codigoGrupo: 'G-COMERCIAL-42',
    client: { name: 'Nome aninhado', email: 'aninhado@example.com' }
  }
}]));

const backendPublications = [];
const productionStorageContext = {
  console,
  localStorage: productionLocalStorage,
  document: { body: { dataset: { authMode: 'production' } } },
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  Error,
  Promise
};
productionStorageContext.window = productionStorageContext;
productionStorageContext.globalThis = productionStorageContext;
productionStorageContext.BFAuth = {
  authMode: () => 'production',
  getCurrentUser: () => ({ email: 'consultor.autorizado@example.com' })
};
productionStorageContext.BFBackendApi = {
  recordSnapshot(type, payload, meta) {
    backendPublications.push({ channel: 'snapshot', type, payload, meta });
    return Promise.resolve({ ok: true });
  },
  saveSimulation(payload) {
    backendPublications.push({ channel: 'direct', payload });
    return Promise.resolve({ ok: true });
  }
};
vm.createContext(productionStorageContext);
vm.runInContext(storageSource, productionStorageContext, { filename: 'js/storage.js' });
const productionStorage = vm.runInContext('Storage', productionStorageContext);

const migrated = productionStorage.loadSimulation('SIM-LEGACY-PII');
const migratedRaw = productionLocalStorage.getItem('consorciopro_simulations') || '';
assert(migrated?.params?.codigoGrupo === 'G-COMERCIAL-42', 'Migração produtiva removeu dado comercial necessário.');
assert(migrated?.privacy?.localPIIStored === false, 'Migração produtiva não declarou proteção local.');
for (const secret of ['Cliente Legada', '52998224725', 'legada@example.com', '11999999999', 'Nome aninhado', 'aninhado@example.com']) {
  assert(!migratedRaw.includes(secret), `Migração produtiva manteve PII no localStorage: ${secret}.`);
}

const completeEntry = productionStorage.saveSimulation('Simulação de Maria Cliente', {
  id: 'SIM-PRODUCTION-PII',
  proposalId: 'PROP-PRODUCTION-PII',
  cliente: 'Maria Cliente',
  clienteCpf: '39053344705',
  clienteEmail: 'maria@example.com',
  clienteTelefone: '11888887777',
  consultor: 'Carlos Consultor',
  consultorEmail: 'carlos@example.com',
  params: {
    valorCarta: 200000,
    codigoGrupo: 'G-COMERCIAL-77',
    customer: { name: 'Maria aninhada', phone: '11777776666' }
  },
  resultado: { resumo: { creditoTotal: 200000 } }
});
const productionRaw = productionLocalStorage.getItem('consorciopro_simulations') || '';
const locallyRestored = productionStorage.loadSimulation('SIM-PRODUCTION-PII');
for (const secret of [
  'Simulação de Maria Cliente', 'Maria Cliente', '39053344705', 'maria@example.com',
  '11888887777', 'Carlos Consultor', 'carlos@example.com', 'Maria aninhada', '11777776666',
  'consultor.autorizado@example.com'
]) {
  assert(!productionRaw.includes(secret), `Persistência produtiva expôs PII no localStorage: ${secret}.`);
}
assert(locallyRestored?.params?.codigoGrupo === 'G-COMERCIAL-77', 'Persistência produtiva perdeu o contexto comercial.');
assert(locallyRestored?.cliente === 'Dados protegidos', 'Persistência produtiva não protegeu a identidade local.');
assert(completeEntry?.clienteEmail === 'maria@example.com', 'Entrada completa deixou de existir antes da publicação autorizada.');

const directPublication = backendPublications.find((item) => item.channel === 'direct');
const snapshotPublication = backendPublications.find((item) => item.channel === 'snapshot');
assert(
  directPublication?.payload?.payload?.clienteEmail === 'maria@example.com'
    && directPublication?.payload?.ownerEmail === 'maria@example.com',
  'Backend direto não recebeu a entrada completa e seu proprietário.'
);
assert(
  snapshotPublication?.payload?.clienteCpf === '39053344705'
    && snapshotPublication?.meta?.ownerEmail === 'maria@example.com',
  'Snapshot autorizado não recebeu a entrada completa.'
);

const demoLocalStorage = new LocalStorageMock();
const demoStorageContext = {
  console,
  localStorage: demoLocalStorage,
  document: { body: { dataset: { authMode: 'demo' } } },
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  Error
};
demoStorageContext.window = demoStorageContext;
demoStorageContext.globalThis = demoStorageContext;
demoStorageContext.BFAuth = { authMode: () => 'demo', getCurrentUser: () => null };
vm.createContext(demoStorageContext);
vm.runInContext(storageSource, demoStorageContext, { filename: 'js/storage.js' });
const demoStorage = vm.runInContext('Storage', demoStorageContext);
demoStorage.saveSimulation('Simulação Demo Identificada', {
  id: 'SIM-DEMO-PII',
  cliente: 'Cliente Demonstração',
  clienteEmail: 'demo@example.com',
  params: { valorCarta: 90000 }
});
const demoRaw = demoLocalStorage.getItem('consorciopro_simulations') || '';
assert(
  demoRaw.includes('Cliente Demonstração') && demoRaw.includes('demo@example.com'),
  'Modo demo deixou de preservar o comportamento local existente.'
);

const report = {
  ok: failures.length === 0,
  auth: {
    seeds: auth.listUsers().length,
    adminLogin: adminLogin.ok === true,
    anonymousRedirect: 'login.html?redirect=handoff-consultivo.html%3Ffrom%3Dlousa%23fila-handoff',
    forbiddenRedirects
  },
  privacy: {
    productionLocalPIIFree: !productionRaw.includes('maria@example.com'),
    legacyMigrated: !migratedRaw.includes('legada@example.com'),
    completeBackendPublication: directPublication?.payload?.payload?.clienteEmail === 'maria@example.com',
    demoPreserved: demoRaw.includes('demo@example.com')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/auth-navigation-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
