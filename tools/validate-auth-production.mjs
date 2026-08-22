import fs from 'node:fs/promises';
import path from 'node:path';
import crypto from 'node:crypto';
import { createRequire } from 'node:module';
import { spawnSync } from 'node:child_process';

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];
const warnings = [];
const runtimeDir = path.join(root, '.runtime');
const dbPath = path.join(runtimeDir, `validator-auth-production-${process.pid}.sqlite`);
const shareDbPath = path.join(runtimeDir, `validator-auth-production-share-${process.pid}.sqlite`);
const startupDbPath = path.join(runtimeDir, `validator-auth-startup-${process.pid}.sqlite`);
const startupShareDbPath = path.join(runtimeDir, `validator-auth-startup-share-${process.pid}.sqlite`);
const legacyDbPath = path.join(runtimeDir, `validator-auth-legacy-${process.pid}.sqlite`);
const reportPath = path.join(root, 'docs', 'test-reports', 'auth-production-report.json');
const temporaryPassword = 'Rota!Segura2026#Azul';
const permanentPassword = 'Nuvem#Forte2027!Verde';
const consultantPassword = 'Ponte!Clara2028#Sul';
const clientPassword = 'Horizonte!Vivo2028#Norte';

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function cleanupFile(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(runtimeDir) + path.sep)) {
    throw new Error(`Caminho de limpeza fora do runtime: ${resolved}`);
  }
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fs.rm(`${resolved}${suffix}`, { force: true });
    } catch (error) {
      warnings.push(`Nao foi possivel remover ${path.basename(resolved)}${suffix}.`);
    }
  }
}

function cookieFrom(response) {
  return String(response.headers.get('set-cookie') || '').split(';')[0];
}

async function requestJson(baseUrl, pathname, options = {}) {
  const headers = { Accept: 'application/json', ...(options.headers || {}) };
  if (options.body !== undefined) headers['Content-Type'] = 'application/json';
  const response = await fetch(`${baseUrl}${pathname}`, {
    method: options.method || 'GET',
    headers,
    body: options.body === undefined ? undefined : JSON.stringify(options.body)
  });
  const text = await response.text();
  let data = {};
  try {
    data = text ? JSON.parse(text) : {};
  } catch (error) {
    data = { parseError: true, raw: text.slice(0, 120) };
  }
  return { response, status: response.status, data, text };
}

await fs.mkdir(runtimeDir, { recursive: true });
await cleanupFile(dbPath);
await cleanupFile(shareDbPath);
await cleanupFile(legacyDbPath);

function startupProbe(environment, source) {
  return spawnSync(process.execPath, ['-e', source], {
    cwd: root,
    env: {
      ...process.env,
      BANCUS_DB_PROVIDER: 'sqlite',
      BANCUS_DB_PATH: startupDbPath,
      BANCUS_SHARE_DB_PATH: startupShareDbPath,
      ...environment
    },
    encoding: 'utf8',
    timeout: 10000
  });
}

const invalidModeProbe = startupProbe(
  { BANCUS_AUTH_MODE: 'invalid-mode', BANCUS_DB_SEED_USERS: '' },
  "require('./server.js')"
);
assert(invalidModeProbe.status !== 0 && `${invalidModeProbe.stderr}${invalidModeProbe.stdout}`.includes('BANCUS_AUTH_MODE invalido'), 'Modo de autenticacao invalido nao falhou fechado.');

const seedProbe = startupProbe(
  { BANCUS_AUTH_MODE: 'production', BANCUS_DB_SEED_USERS: 'true' },
  "require('./server.js')"
);
assert(seedProbe.status !== 0 && `${seedProbe.stderr}${seedProbe.stdout}`.includes('BANCUS_DB_SEED_USERS'), 'Modo produtivo aceitou seeds habilitadas.');

const exposedDemoProbe = startupProbe(
  { BANCUS_AUTH_MODE: 'demo', BANCUS_DB_SEED_USERS: '' },
  "require('./server.js').startServer({host:'0.0.0.0',port:0})"
);
assert(exposedDemoProbe.status !== 0 && `${exposedDemoProbe.stderr}${exposedDemoProbe.stdout}`.includes('modo demo so pode escutar em loopback'), 'Modo demo aceitou exposicao fora de loopback.');

function loginGuardMaxEntriesProbe(value) {
  return startupProbe(
    {
      BANCUS_AUTH_MODE: 'production',
      BANCUS_DB_SEED_USERS: '',
      BANCUS_AUTH_LOGIN_GUARD_MAX_ENTRIES: value
    },
    "process.stdout.write(String(require('./server.js').authLoginGuardStats().maxEntries))"
  );
}

const defaultLoginGuardMaxEntriesProbe = loginGuardMaxEntriesProbe('');
assert(
  defaultLoginGuardMaxEntriesProbe.status === 0 && defaultLoginGuardMaxEntriesProbe.stdout.trim() === '10000',
  'hard cap vazio nao preservou o padrao de 10000 entradas.'
);
const minimumLoginGuardMaxEntriesProbe = loginGuardMaxEntriesProbe('1');
assert(
  minimumLoginGuardMaxEntriesProbe.status === 0 && minimumLoginGuardMaxEntriesProbe.stdout.trim() === '32',
  'hard cap abaixo da faixa nao foi limitado a 32 entradas.'
);
const maximumLoginGuardMaxEntriesProbe = loginGuardMaxEntriesProbe('100001');
assert(
  maximumLoginGuardMaxEntriesProbe.status === 0 && maximumLoginGuardMaxEntriesProbe.stdout.trim() === '100000',
  'hard cap acima da faixa nao foi limitado a 100000 entradas.'
);

const dbModule = require('../js/backend/db.js');
const serverSource = await fs.readFile(path.join(root, 'server.js'), 'utf8');
assert(serverSource.includes('pruneLoginGuards()'), 'Servidor nao poda o rate limit de forma controlada.');
assert(!serverSource.includes('authLoginGuards.clear()'), 'Servidor ainda apaga todos os bloqueios quando o mapa cresce.');
assert(dbModule.resolveSessionTtlMinutes(undefined) === 480, 'TTL padrao divergiu do contrato de 480 minutos.');
assert(dbModule.resolveSessionTtlMinutes('') === 480, 'TTL vazio divergiu do contrato padrao.');
assert(dbModule.resolveSessionTtlMinutes(0) === 15 && dbModule.resolveSessionTtlMinutes(9999) === 1440, 'TTL nao respeitou limites de 15 a 1440 minutos.');
let invalidFactoryModeRejected = false;
try {
  dbModule.createDatabase({ dbPath: legacyDbPath, authMode: 'invalid', seedUsers: false });
} catch (error) {
  invalidFactoryModeRejected = /invalido/i.test(String(error && error.message || ''));
}
assert(invalidFactoryModeRejected, 'Factory de banco aceitou authMode invalido.');
let productiveFactorySeedRejected = false;
try {
  dbModule.createDatabase({ dbPath: legacyDbPath, authMode: 'production', seedUsers: true });
} catch (error) {
  productiveFactorySeedRejected = /production/i.test(String(error && error.message || ''));
}
assert(productiveFactorySeedRejected, 'Factory SQLite aceitou seeds em modo produtivo.');

let legacyUserId = '';
const legacyDemo = dbModule.createDatabase({ dbPath: legacyDbPath, authMode: 'demo', seedUsers: false });
try {
  const legacyUser = legacyDemo.createUser({
    name: 'Conta Legada',
    email: 'legacy@example.com',
    role: 'cliente',
    status: 'active',
    password: 'Fraca1'
  });
  assert(legacyUser.ok, 'Fixture demo nao criou credencial legada.');
  legacyUserId = legacyUser.user.id;
  const legacyRaw = legacyDemo.getUserByEmail('legacy@example.com');
  assert(legacyRaw.password_algorithm === dbModule.PASSWORD_HASH_ALGORITHM, 'Demo nao gravou marcador legado de credencial.');
} finally {
  legacyDemo.close();
}
const legacyProduction = dbModule.createDatabase({ dbPath: legacyDbPath, authMode: 'production', seedUsers: false });
try {
  const listedLegacy = legacyProduction.listUsers().find((user) => user.email === 'legacy@example.com');
  assert(listedLegacy?.mustChangePassword === true, 'Listagem SQLite ocultou o corte de credencial legada.');
  const legacyLogin = legacyProduction.login('legacy@example.com', 'Fraca1');
  assert(legacyLogin.ok && legacyLogin.user.mustChangePassword === true, 'Cutover produtivo nao restringiu credencial legada fraca.');
  const upgradedLegacy = legacyProduction.changePassword(legacyUserId, 'Fraca1', permanentPassword);
  assert(upgradedLegacy.ok && upgradedLegacy.user.mustChangePassword === false, 'Cutover produtivo nao promoveu a credencial apos troca forte.');
  assert(
    legacyProduction.getUserById(legacyUserId).password_algorithm === dbModule.CURRENT_PASSWORD_POLICY_VERSION,
    'Troca forte nao gravou a versao corrente da politica de credencial.'
  );
  const blockedImport = legacyProduction.importLocalSnapshot({
    users: [{ name: 'Importado', email: 'imported-direct@example.com', role: 'cliente', status: 'active' }]
  }, { dryRun: false });
  assert(blockedImport.ok === false && blockedImport.code === 'PRODUCTIVE_USER_MIGRATION_REQUIRES_PROVISIONING', 'Provider produtivo importou usuario com senha compartilhada.');
} finally {
  legacyProduction.close();
}

const localDatabase = dbModule.createDatabase({
  dbPath,
  authMode: 'production',
  seedUsers: false
});

try {
  assert(localDatabase.listUsers().length === 0, 'Modo produtivo SQLite criou contas demonstrativas.');
  assert(!dbModule.validateProductivePassword('Senha@123', {}).ok, 'Politica aceitou senha curta/previsivel.');
  assert(!dbModule.validateProductivePassword('longpasswordwithoutgroups', {}).ok, 'Politica aceitou senha sem grupos exigidos.');
  assert(dbModule.validateProductivePassword(temporaryPassword, { name: 'Operador Piloto', email: 'owner@example.com' }).ok, 'Politica rejeitou senha produtiva valida.');
  const weakProductiveUser = localDatabase.createUser({ name: 'Fraco', email: 'weak@example.com', role: 'cliente', status: 'active', password: 'Fraca1' });
  assert(weakProductiveUser.ok === false && weakProductiveUser.code === 'PASSWORD_POLICY', 'Provider produtivo criou usuario com senha fraca.');
  const demoIdentity = localDatabase.createUser({ name: 'Demo', email: 'cliente@bankfratern.local', role: 'cliente', status: 'active', password: temporaryPassword });
  assert(demoIdentity.ok === false && demoIdentity.code === 'DEMO_IDENTITY_FORBIDDEN', 'Provider produtivo criou identidade demonstrativa.');

  const created = localDatabase.createUser({
    name: 'Operador Piloto',
    email: 'owner@example.com',
    role: 'admin',
    status: 'active',
    password: temporaryPassword,
    mustChangePassword: true
  });
  assert(created.ok && created.user.mustChangePassword === true, 'Usuario temporario nao exige troca de senha.');
  assert(!JSON.stringify(created).includes('password_hash') && !JSON.stringify(created).includes('password_salt'), 'Resposta de usuario vazou credencial persistida.');

  const firstLogin = localDatabase.login('owner@example.com', temporaryPassword);
  assert(firstLogin.ok && firstLogin.user.mustChangePassword === true, 'Login temporario nao preservou restricao.');
  const firstToken = firstLogin.session.token;
  const changed = localDatabase.changePassword(created.user.id, temporaryPassword, permanentPassword);
  assert(changed.ok && changed.user.mustChangePassword === false, 'Troca obrigatoria nao concluiu.');
  assert(localDatabase.authenticateToken(firstToken) === null, 'Token anterior sobreviveu a troca de senha.');
  assert(localDatabase.authenticateToken(changed.session.token)?.user?.id === created.user.id, 'Nova sessao nao autenticou apos troca.');
  assert(localDatabase.revokeUserSessions(created.user.id) >= 1, 'Logout global nao revogou sessoes.');
  assert(localDatabase.authenticateToken(changed.session.token) === null, 'Token sobreviveu ao logout global.');

  const reset = localDatabase.setPassword(created.user.id, temporaryPassword, { mustChangePassword: true });
  assert(reset.ok, 'Reset administrativo falhou.');

  const consultant = localDatabase.createUser({
    name: 'Marina Costa', email: 'consultant@example.com', role: 'consultor', status: 'active',
    password: consultantPassword, mustChangePassword: false
  });
  const client = localDatabase.createUser({
    name: 'Caio Lima', email: 'client@example.com', role: 'cliente', status: 'active',
    password: clientPassword, mustChangePassword: false
  });
  assert(consultant.ok && client.ok, 'Matriz RBAC nao provisionou consultor e cliente de teste.');
} finally {
  localDatabase.close();
}

process.env.BANCUS_AUTH_MODE = 'production';
process.env.BANCUS_AUTH_COOKIE_SECURE = 'false';
process.env.BANCUS_AUTH_LOGIN_GUARD_MAX_ENTRIES = '32';
process.env.BANCUS_DB_PROVIDER = 'sqlite';
process.env.BANCUS_DB_PATH = dbPath;
process.env.BANCUS_SHARE_DB_PATH = shareDbPath;
delete process.env.BANCUS_DB_SEED_USERS;

const serverModule = require('../server.js');
const httpServer = serverModule.startServer({ port: 0, host: '127.0.0.1' });
if (!httpServer.listening) await new Promise((resolve) => httpServer.once('listening', resolve));
const address = httpServer.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const originHeaders = { Origin: baseUrl };

let loginCookie = '';
let rotatedCookie = '';
try {
  const config = await requestJson(baseUrl, '/api/auth/config');
  assert(config.status === 200 && config.data.mode === 'production', 'Config nao declarou modo produtivo.');
  assert(config.data.transport === 'cookie' && config.data.demoAccounts === false, 'Config produtiva nao isolou demo/bearer.');

  const loginPage = await fetch(`${baseUrl}/pages/login.html`);
  const loginHtml = await loginPage.text();
  assert(!loginHtml.includes('admin@bankfratern.local') && !loginHtml.includes('data-demo-login'), 'HTML produtivo publicou contas de demonstracao.');
  assert(String(loginPage.headers.get('content-security-policy') || '').includes("script-src 'self'"), 'Login sem CSP restritiva.');
  assert(loginPage.headers.get('x-frame-options') === 'DENY', 'Login pode ser enquadrado por outra pagina.');

  const demoLogin = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: originHeaders,
    body: { email: 'admin@bankfratern.local', password: 'Admin@123' }
  });
  assert(demoLogin.status === 401, 'Identidade demonstrativa entrou no modo produtivo.');

  const login = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST',
    headers: originHeaders,
    body: { email: 'owner@example.com', password: temporaryPassword }
  });
  loginCookie = cookieFrom(login.response);
  assert(login.status === 200 && login.data.passwordChangeRequired === true, 'Login temporario HTTP nao exigiu troca.');
  assert(loginCookie.startsWith('bf_session='), 'Login produtivo nao emitiu cookie opaco.');
  assert(String(login.response.headers.get('set-cookie') || '').includes('HttpOnly'), 'Cookie produtivo sem HttpOnly.');
  assert(String(login.response.headers.get('set-cookie') || '').includes('SameSite=Lax'), 'Cookie produtivo sem SameSite.');
  assert(!login.text.includes('token') && !login.text.includes(temporaryPassword), 'Login produtivo retornou token ou senha no JSON.');

  const restricted = await requestJson(baseUrl, '/api/database/status', {
    headers: { Cookie: loginCookie }
  });
  assert(restricted.status === 403 && restricted.data.code === 'PASSWORD_CHANGE_REQUIRED', 'Sessao temporaria acessou endpoint protegido.');

  const foreignOrigin = await requestJson(baseUrl, '/api/auth/change-password', {
    method: 'POST',
    headers: { Cookie: loginCookie, Origin: 'https://evil.example' },
    body: { currentPassword: temporaryPassword, newPassword: permanentPassword }
  });
  assert(foreignOrigin.status === 403 && foreignOrigin.data.code === 'AUTH_ORIGIN_REJECTED', 'Origem estrangeira alterou senha.');

  const change = await requestJson(baseUrl, '/api/auth/change-password', {
    method: 'POST',
    headers: { Cookie: loginCookie, ...originHeaders },
    body: { currentPassword: temporaryPassword, newPassword: permanentPassword }
  });
  rotatedCookie = cookieFrom(change.response);
  assert(change.status === 200 && change.data.passwordChangeRequired === false, 'Troca de senha HTTP falhou.');
  assert(rotatedCookie && rotatedCookie !== loginCookie, 'Troca de senha nao rotacionou a sessao.');
  assert(!change.text.includes('token') && !change.text.includes(permanentPassword), 'Troca de senha vazou token ou senha.');

  const oldSession = await requestJson(baseUrl, '/api/auth/me', { headers: { Cookie: loginCookie } });
  assert(oldSession.status === 401, 'Cookie anterior sobreviveu a rotacao.');
  const adminStatus = await requestJson(baseUrl, '/api/database/status', { headers: { Cookie: rotatedCookie } });
  assert(adminStatus.status === 200 && adminStatus.data.ok === true, 'Admin nao recuperou acesso apos trocar senha.');
  const provisionedUser = await requestJson(baseUrl, '/api/users', {
    method: 'POST',
    headers: { Cookie: rotatedCookie, ...originHeaders },
    body: {
      name: 'Nova Pessoa',
      email: 'new-user@example.com',
      role: 'cliente',
      status: 'active',
      password: 'Provision!Forte2029#Leste'
    }
  });
  assert(
    provisionedUser.status === 201 && provisionedUser.data.user?.mustChangePassword === true,
    'Admin nao provisionou usuario produtivo com troca obrigatoria.'
  );

  const consultantLogin = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST', headers: originHeaders,
    body: { email: 'consultant@example.com', password: consultantPassword }
  });
  const clientLogin = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST', headers: originHeaders,
    body: { email: 'client@example.com', password: clientPassword }
  });
  const consultantCookie = cookieFrom(consultantLogin.response);
  const clientCookie = cookieFrom(clientLogin.response);
  assert(consultantLogin.status === 200 && clientLogin.status === 200, 'Matriz RBAC nao autenticou consultor e cliente.');

  for (const [label, cookie] of [['consultor', consultantCookie], ['cliente', clientCookie]]) {
    const usersDenied = await requestJson(baseUrl, '/api/users', { headers: { Cookie: cookie } });
    assert(usersDenied.status === 403, `${label} acessou administracao de usuarios.`);
  }
  const clientLead = await requestJson(baseUrl, '/api/leads', {
    method: 'POST', headers: { Cookie: clientCookie, ...originHeaders },
    body: { id: 'LEAD-CLIENT-FORBIDDEN', title: 'Lead indevido' }
  });
  assert(clientLead.status === 403, 'Cliente criou lead pela rota direta.');
  const clientHandoffSnapshot = await requestJson(baseUrl, '/api/snapshots', {
    method: 'POST', headers: { Cookie: clientCookie, ...originHeaders },
    body: { id: 'SNAP-CLIENT-HANDOFF', type: 'handoff', payload: { status: 'qualificado', priority: 'alta' } }
  });
  assert(clientHandoffSnapshot.status === 403, 'Cliente recriou lead por snapshot de handoff.');
  const consultantLead = await requestJson(baseUrl, '/api/leads', {
    method: 'POST', headers: { Cookie: consultantCookie, ...originHeaders },
    body: { id: 'LEAD-CONSULTANT-OWN', title: 'Atendimento consultivo', status: 'novo' }
  });
  assert([200, 201].includes(consultantLead.status) && consultantLead.data.ok, 'Consultor nao criou lead proprio.');
  const crossOwnerRead = await requestJson(baseUrl, '/api/leads/LEAD-CONSULTANT-OWN', { headers: { Cookie: clientCookie } });
  const crossOwnerPatch = await requestJson(baseUrl, '/api/leads/LEAD-CONSULTANT-OWN', {
    method: 'PATCH', headers: { Cookie: clientCookie, ...originHeaders }, body: { title: 'Tomada indevida' }
  });
  assert(crossOwnerRead.status === 404 && crossOwnerPatch.status === 404, 'Cliente confirmou ou alterou registro de outro owner.');
  const adminLeads = await requestJson(baseUrl, '/api/leads', { headers: { Cookie: rotatedCookie } });
  assert(adminLeads.status === 200 && adminLeads.data.leads.some((lead) => lead.id === 'LEAD-CONSULTANT-OWN'), 'Admin nao enxergou carteira global.');

  const clientSimulation = await requestJson(baseUrl, '/api/simulations', {
    method: 'POST', headers: { Cookie: clientCookie, ...originHeaders },
    body: { id: 'SIM-CLIENT-OWN', title: 'Cenario do cliente', status: 'won', stage: 'contratado', priority: 'critica' }
  });
  assert(
    clientSimulation.status === 201
      && clientSimulation.data.simulation.status === 'saved'
      && clientSimulation.data.simulation.stage === 'simulation'
      && clientSimulation.data.simulation.priority === 'media',
    'Cliente forjou estado comercial da simulacao.'
  );
  const clientPublish = await requestJson(baseUrl, '/api/proposal-snapshots/UNKNOWN/publish', {
    method: 'POST', headers: { Cookie: clientCookie, ...originHeaders }, body: { validityDays: 30 }
  });
  assert(clientPublish.status === 403, 'Cliente publicou proposta consultiva.');
  for (const reservedType of ['auth:login', 'auth_login', 'user:created', 'proposal-share:published', 'server']) {
    const reservedEvent = await requestJson(baseUrl, '/api/events', {
      method: 'POST', headers: { Cookie: clientCookie, ...originHeaders }, body: { type: reservedType }
    });
    assert(reservedEvent.status === 400 && reservedEvent.data.code === 'EVENT_TYPE_REJECTED', `Evento reservado aceito: ${reservedType}.`);
  }
  const partialSelfUpdate = await requestJson(baseUrl, `/api/users/${encodeURIComponent(login.data.user.id)}`, {
    method: 'PATCH', headers: { Cookie: rotatedCookie, ...originHeaders },
    body: { name: 'Operador Piloto Atualizado' }
  });
  assert(
    partialSelfUpdate.status === 200
      && partialSelfUpdate.data.user.role === 'admin'
      && partialSelfUpdate.data.user.status === 'active',
    'PATCH parcial removeu papel ou status do administrador.'
  );
  const usersAfterPartialUpdate = await requestJson(baseUrl, '/api/users', { headers: { Cookie: rotatedCookie } });
  assert(usersAfterPartialUpdate.status === 200, 'PATCH parcial revogou indevidamente a sessao administrativa.');
  const invalidStatus = await requestJson(baseUrl, `/api/users/${encodeURIComponent(login.data.user.id)}`, {
    method: 'PATCH', headers: { Cookie: rotatedCookie, ...originHeaders }, body: { status: 'enabled' }
  });
  assert(invalidStatus.status === 400, 'Status de usuario desconhecido foi normalizado para ativo.');
  const selfDemotion = await requestJson(baseUrl, `/api/users/${encodeURIComponent(login.data.user.id)}`, {
    method: 'PATCH', headers: { Cookie: rotatedCookie, ...originHeaders },
    body: { name: login.data.user.name, email: login.data.user.email, role: 'cliente', status: 'active' }
  });
  assert(selfDemotion.status === 400, 'Administrador removeu o proprio acesso pela rota generica.');
  const inactivateClient = await requestJson(baseUrl, `/api/users/${encodeURIComponent(clientLogin.data.user.id)}`, {
    method: 'PATCH', headers: { Cookie: rotatedCookie, ...originHeaders }, body: { status: 'inactive' }
  });
  assert(inactivateClient.status === 200 && inactivateClient.data.user.status === 'inactive', 'Admin nao inativou cliente pelo PATCH parcial.');
  const renameInactiveClient = await requestJson(baseUrl, `/api/users/${encodeURIComponent(clientLogin.data.user.id)}`, {
    method: 'PATCH', headers: { Cookie: rotatedCookie, ...originHeaders }, body: { name: 'Caio Lima Atualizado' }
  });
  assert(
    renameInactiveClient.status === 200
      && renameInactiveClient.data.user.status === 'inactive'
      && renameInactiveClient.data.user.role === 'cliente',
    'PATCH parcial reativou ou promoveu usuario inativo.'
  );
  for (const status of ['enabled', null, '']) {
    const invalidStatusAction = await requestJson(baseUrl, `/api/users/${encodeURIComponent(clientLogin.data.user.id)}/status`, {
      method: 'POST', headers: { Cookie: rotatedCookie, ...originHeaders }, body: { status }
    });
    assert(invalidStatusAction.status === 400, `Acao de status aceitou valor invalido: ${String(status)}.`);
  }
  const usersAfterInvalidStatus = await requestJson(baseUrl, '/api/users', { headers: { Cookie: rotatedCookie } });
  const inactiveAfterInvalidStatus = usersAfterInvalidStatus.data.users?.find((user) => user.id === clientLogin.data.user.id);
  assert(inactiveAfterInvalidStatus?.status === 'inactive', 'Status invalido reativou usuario inativo.');

  const importPreview = await requestJson(baseUrl, '/api/database/import-local', {
    method: 'POST',
    headers: { Cookie: rotatedCookie, ...originHeaders },
    body: {
      dryRun: true,
      users: [{ name: 'Importado', email: 'importado@example.com', role: 'cliente', status: 'active' }]
    }
  });
  assert(importPreview.status === 200 && !Object.hasOwn(importPreview.data, 'temporaryPassword'), 'Preview produtivo retornou senha temporaria compartilhada.');
  const importExecution = await requestJson(baseUrl, '/api/database/import-local', {
    method: 'POST',
    headers: { Cookie: rotatedCookie, ...originHeaders },
    body: {
      dryRun: false,
      users: [{ name: 'Importado', email: 'importado@example.com', role: 'cliente', status: 'active' }]
    }
  });
  assert(importExecution.status === 409 && importExecution.data.code === 'PRODUCTIVE_USER_MIGRATION_REQUIRES_PROVISIONING', 'Importacao produtiva criou usuario com senha compartilhada.');

  const logoutAll = await requestJson(baseUrl, '/api/auth/logout-all', {
    method: 'POST',
    headers: { Cookie: rotatedCookie, ...originHeaders }
  });
  assert(logoutAll.status === 200 && logoutAll.data.revoked >= 1, 'Logout global HTTP nao revogou sessoes.');
  const loggedOut = await requestJson(baseUrl, '/api/auth/me', { headers: { Cookie: rotatedCookie } });
  assert(loggedOut.status === 401, 'Cookie permaneceu valido depois do logout global.');

  const rateStatuses = [];
  for (let attempt = 0; attempt < 6; attempt += 1) {
    const response = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: originHeaders,
      body: { email: 'unknown@example.com', password: 'Wrong!Password2026' }
    });
    rateStatuses.push(response.status);
    if (attempt === 5) {
      assert(response.response.headers.get('retry-after') === '900', 'Rate limit nao informou Retry-After.');
    }
  }
  assert(rateStatuses.slice(0, 5).every((status) => status === 401) && rateStatuses[5] === 429, `Rate limit inesperado: ${rateStatuses.join(', ')}.`);
  const unrelatedAccount = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST', headers: originHeaders,
    body: { email: 'another-unknown@example.com', password: 'Wrong!Password2026' }
  });
  assert(unrelatedAccount.status === 401, 'Falhas de uma conta bloquearam globalmente outro usuario no mesmo proxy/IP.');

  let capacityResponse = null;
  for (let attempt = 0; attempt < 64; attempt += 1) {
    const response = await requestJson(baseUrl, '/api/auth/login', {
      method: 'POST',
      headers: originHeaders,
      body: { email: `capacity-${attempt}@example.com`, password: 'Wrong!Password2026' }
    });
    if (response.data.code === 'AUTH_RATE_LIMIT_CAPACITY') {
      capacityResponse = response;
      break;
    }
  }
  assert(capacityResponse?.status === 429, 'Saturacao do guard nao falhou fechada com HTTP 429.');
  assert(capacityResponse?.response.headers.get('retry-after') === '900', 'Saturacao do guard nao informou Retry-After.');
  const saturatedGuardStats = serverModule.authLoginGuardStats();
  assert(
    saturatedGuardStats.maxEntries === 32 && saturatedGuardStats.size <= saturatedGuardStats.maxEntries,
    `Guard excedeu o hard cap: ${JSON.stringify(saturatedGuardStats)}.`
  );
  const rejectedAtCapacity = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST', headers: originHeaders,
    body: { email: 'capacity-never-tracked@example.com', password: 'Wrong!Password2026' }
  });
  const guardStatsAfterRejection = serverModule.authLoginGuardStats();
  assert(
    rejectedAtCapacity.status === 429
      && rejectedAtCapacity.data.code === 'AUTH_RATE_LIMIT_CAPACITY'
      && guardStatsAfterRejection.size === saturatedGuardStats.size,
    'Nova chave alterou o guard depois da saturacao.'
  );
  const lockedTargetAfterSaturation = await requestJson(baseUrl, '/api/auth/login', {
    method: 'POST', headers: originHeaders,
    body: { email: 'unknown@example.com', password: 'Wrong!Password2026' }
  });
  assert(
    lockedTargetAfterSaturation.status === 429
      && lockedTargetAfterSaturation.data.code === 'AUTH_RATE_LIMITED'
      && serverModule.authLoginGuardStats().lockedEntries >= 2,
    'Saturacao removeu o lock de conta/par alvo.'
  );
} finally {
  await new Promise((resolve) => httpServer.close(resolve));
  await serverModule.closeInfrastructure();
}

const auditDatabase = dbModule.createDatabase({ dbPath, authMode: 'production', seedUsers: false });
try {
  const failedEvents = auditDatabase.listEvents({ limit: 50 }).filter((event) => event.type === 'auth-login-failed');
  assert(failedEvents.length >= 1, 'Falhas de login nao foram auditadas.');
  assert(failedEvents.every((event) => !event.ownerEmail && !event.actorEmail), 'Auditoria de falha persistiu e-mail informado.');
  assert(failedEvents.every((event) => !JSON.stringify(event.payload).includes('@')), 'Payload de auditoria persistiu identidade informada.');
  const publicDigest = crypto.createHash('sha256').update('account:unknown@example.com').digest('hex').slice(0, 24);
  assert(failedEvents.every((event) => event.entityId !== publicDigest), 'Pseudonimo de auditoria usa hash publico reversivel por dicionario.');
} finally {
  auditDatabase.close();
}

const report = {
  ok: failures.length === 0,
  mode: 'production',
  transport: 'httpOnly-cookie',
  passwordPolicy: { minLength: 12, maxLength: 128 },
  gates: {
    seedsDisabled: !failures.some((item) => item.includes('demonstrativ')),
    mandatoryPasswordChange: !failures.some((item) => item.includes('temporari')),
    sessionRotation: !failures.some((item) => item.includes('rotacion')),
    originProtection: !failures.some((item) => item.includes('Origem')),
    rateLimit: !failures.some((item) => item.includes('Rate limit')),
    rateLimitCapacity: !failures.some((item) => /hard cap|Saturacao|Nova chave|lock de conta/.test(item)),
    roleMatrix: !failures.some((item) => /Cliente|Consultor|owner|carteira|administracao/.test(item)),
    legacyCutover: !failures.some((item) => item.includes('Cutover')),
    auditPrivacy: !failures.some((item) => item.includes('Auditoria'))
  },
  warnings,
  failures
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
await cleanupFile(dbPath);
await cleanupFile(shareDbPath);
await cleanupFile(startupDbPath);
await cleanupFile(startupShareDbPath);
await cleanupFile(legacyDbPath);

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
