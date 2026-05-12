import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];
const warnings = [];
const dbPath = path.join(root, '.runtime', `validator-local-db-${process.pid}.sqlite`);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fs.rm(`${dbPath}${suffix}`, { force: true });
    } catch (error) {
      warnings.push(`Nao foi possivel remover ${path.basename(dbPath)}${suffix}.`);
    }
  }
}

await cleanup();

const { createDatabase, SCHEMA_VERSION } = require('../js/backend/db.js');
const localDb = createDatabase({ dbPath });

try {
  const initialStats = localDb.stats();
  assert(initialStats.schemaVersion === SCHEMA_VERSION, 'Schema do banco local nao confere.');
  assert(initialStats.users === 3, `Banco local deveria criar 3 usuarios seed; criou ${initialStats.users}.`);

  const adminLogin = localDb.login('admin@bankfratern.local', 'Admin@123');
  assert(adminLogin.ok, 'Login seed admin falhou no banco local.');
  assert(adminLogin.session && adminLogin.session.token, 'Login seed admin nao retornou token de sessao.');
  assert(adminLogin.user && adminLogin.user.role === 'admin', 'Usuario admin nao preservou papel.');
  assert(!Object.prototype.hasOwnProperty.call(adminLogin.user, 'password_hash'), 'Usuario publico vazou password_hash.');
  assert(!Object.prototype.hasOwnProperty.call(adminLogin.user, 'passwordHash'), 'Usuario publico vazou passwordHash.');

  const badLogin = localDb.login('admin@bankfratern.local', 'senha-incorreta');
  assert(!badLogin.ok && badLogin.status === 401, 'Senha incorreta deveria ser recusada.');

  const context = localDb.authenticateToken(adminLogin.session.token);
  assert(context && context.user && context.user.email === 'admin@bankfratern.local', 'Token de sessao nao autenticou usuario.');

  const created = localDb.createUser({
    id: 'USR-VALIDATOR',
    name: 'Validador Local',
    email: 'validator@example.com',
    role: 'consultor',
    status: 'active',
    department: 'QA',
    phone: '(00) 00000-0000',
    password: 'Validator@123'
  });
  assert(created.ok, `Criacao de usuario no banco local falhou: ${created.message || 'sem mensagem'}.`);
  assert(created.user && created.user.id === 'USR-VALIDATOR', 'Criacao de usuario nao preservou id publico.');
  assert(!Object.prototype.hasOwnProperty.call(created.user, 'password_salt'), 'Usuario criado vazou password_salt.');

  const createdLogin = localDb.login('validator@example.com', 'Validator@123');
  assert(createdLogin.ok, 'Usuario criado nao conseguiu autenticar com senha cadastrada.');

  const event = localDb.recordEvent({
    type: 'validator-event',
    source: 'validator',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    entityType: 'validator',
    entityId: 'event-1',
    payload: {
      amount: 100,
      password: 'nao-gravar',
      token: 'nao-gravar',
      phone: '(11) 90000-0000',
      nested: { senha: 'nao-gravar', safe: true }
    }
  });
  assert(event && event.id, 'Evento nao foi persistido.');
  assert(event.payload.amount === 100, 'Payload seguro do evento nao foi preservado.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'password'), 'Payload do evento vazou password.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'token'), 'Payload do evento vazou token.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'phone'), 'Payload do evento vazou phone.');
  assert(event.payload.nested && event.payload.nested.safe === true, 'Payload aninhado seguro nao foi preservado.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload.nested, 'senha'), 'Payload aninhado vazou senha.');

  const events = localDb.listEvents({ limit: 10 });
  assert(events.length >= 1 && events[0].type === 'validator-event', 'Listagem de eventos nao retornou evento recente.');

  const databaseStatus = localDb.databaseStatus();
  assert(databaseStatus.ok, 'Status tecnico do banco local deveria retornar ok.');
  assert(databaseStatus.provider === 'sqlite', 'Provider ativo deveria ser sqlite.');
  assert(databaseStatus.files && databaseStatus.files.main && databaseStatus.files.main.exists, 'Status do banco nao encontrou arquivo SQLite principal.');
  assert(databaseStatus.sqlite && databaseStatus.sqlite.quickCheck === 'ok', 'PRAGMA quick_check do SQLite nao retornou ok.');
  assert(Array.isArray(databaseStatus.tables) && databaseStatus.tables.length >= 3, 'Status do banco deveria listar tabelas principais.');

  const server = await read('server.js');
  [
    '/api/health',
    '/api/database/status',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/users',
    '/api/events',
    'SCHEMA_VERSION'
  ].forEach((marker) => assert(server.includes(marker), `server.js sem contrato de API local: ${marker}.`));

  const backendApi = await read('assets/js/services/backend-api.service.js');
  [
    'window.BFBackendApi',
    'bf_backend_session_v1',
    'authLogin',
    'databaseStatus',
    'recordEvent',
    'listEvents',
    'createUser',
    'toggleStatus'
  ].forEach((marker) => assert(backendApi.includes(marker), `backend-api.service.js sem contrato ${marker}.`));

  const adminDashboard = await read('pages/dashboard-admin.html');
  const adminUsers = await read('assets/js/admin-users.js');
  [
    'data-admin-backend-events',
    'data-admin-backend-event',
    'data-admin-backend-table',
    'data-admin-backend-database-provider',
    'data-admin-backend-event-refresh',
    'databaseStatus',
    'listEvents(30)'
  ].forEach((marker) => {
    assert(adminDashboard.includes(marker) || adminUsers.includes(marker), `Painel admin de eventos sem contrato ${marker}.`);
  });

  const inspector = await read('tools/inspect-local-sql-environment.mjs');
  ['postgresql', 'mysql', 'mssql', 'local-sql-environment-report.json'].forEach((marker) => {
    assert(inspector.includes(marker), `Inspetor SQL local sem marcador ${marker}.`);
  });

  const report = {
    ok: failures.length === 0,
    schemaVersion: SCHEMA_VERSION,
    seedUsers: initialStats.users,
    events: localDb.listEvents({ limit: 50 }).length,
    provider: databaseStatus.provider,
    tables: databaseStatus.tables.length,
    warnings,
    failures
  };

  await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'docs/test-reports/local-database-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
} finally {
  localDb.close();
  await cleanup();
}

if (failures.length > 0) process.exit(1);
