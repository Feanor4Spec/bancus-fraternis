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

const [authSource, loginSource, loginHtml, designValidator, contractsDoc] = await Promise.all([
  readText('js/auth.js'),
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
  "dashboard-cliente.html?auth=forbidden"
].forEach((marker) => assert(authSource.includes(marker), `auth.js sem contrato ${marker}.`));

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

auth.login('cliente@bankfratern.local', 'Cliente@123');
context.location.replaced = '';
const forbidden = auth.requireRole(['admin'], { redirect: true });
assert(forbidden === null, 'Cliente deveria ser bloqueado em rota admin.');
assert(context.location.replaced === 'dashboard-cliente.html?auth=forbidden', `Redirect forbidden inesperado: ${context.location.replaced}.`);

const report = {
  ok: failures.length === 0,
  auth: {
    seeds: auth.listUsers().length,
    adminLogin: adminLogin.ok === true,
    anonymousRedirect: 'login.html?redirect=handoff-consultivo.html%3Ffrom%3Dlousa%23fila-handoff',
    forbiddenRedirect: 'dashboard-cliente.html?auth=forbidden'
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
