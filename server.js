const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const net = require('net');
const path = require('path');
const databaseContract = require('./js/backend/db');
const proposalInterestContract = require('./js/backend/proposal-interest-service');

const PORT = Number(process.env.PORT) || 8080;
const DEFAULT_HOST = '127.0.0.1';
const ROOT_DIR = __dirname;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
let localDatabase = null;
let SCHEMA_VERSION = 'bancus-fraternis.local-db.v1';
let databaseReady = Promise.resolve(null);
let databaseStartupError = null;
let requestedDatabaseProvider = String(process.env.BANCUS_DB_PROVIDER || 'sqlite').trim().toLowerCase() || 'sqlite';
const requestedAuthMode = String(process.env.BANCUS_AUTH_MODE || '').trim().toLowerCase();
if (requestedAuthMode && !['demo', 'production'].includes(requestedAuthMode)) {
  throw new Error('BANCUS_AUTH_MODE invalido. Use demo ou production.');
}
const AUTH_MODE = requestedAuthMode || (['postgres', 'postgresql', 'pg'].includes(requestedDatabaseProvider) ? 'production' : 'demo');
const AUTH_SESSION_TTL_MINUTES = databaseContract.resolveSessionTtlMinutes(process.env.BANCUS_SESSION_TTL_MINUTES);
const AUTH_LOGIN_WINDOW_MS = 15 * 60 * 1000;
const AUTH_LOGIN_LOCK_MS = 15 * 60 * 1000;
const AUTH_LOGIN_MAX_FAILURES = 5;
const AUTH_LOGIN_IP_MAX_FAILURES = 100;
const rawLoginGuardMaxEntries = String(process.env.BANCUS_AUTH_LOGIN_GUARD_MAX_ENTRIES ?? '').trim();
const requestedLoginGuardMaxEntries = rawLoginGuardMaxEntries ? Number(rawLoginGuardMaxEntries) : Number.NaN;
const AUTH_LOGIN_GUARD_MAX_ENTRIES = Number.isInteger(requestedLoginGuardMaxEntries)
  ? Math.max(32, Math.min(100000, requestedLoginGuardMaxEntries))
  : 10000;
const AUTH_LOGIN_MAX_EMAIL_CHARS = 254;
const AUTH_LOGIN_MAX_PASSWORD_CHARS = 128;
const AUTH_COOKIE_SECURE = process.env.BANCUS_AUTH_COOKIE_SECURE === undefined
  ? AUTH_MODE === 'production'
  : ['1', 'true', 'on', 'yes'].includes(String(process.env.BANCUS_AUTH_COOKIE_SECURE).trim().toLowerCase());
const AUTH_COOKIE_NAME = AUTH_COOKIE_SECURE ? '__Host-bf_session' : 'bf_session';
const AUTH_DEMO_EMAIL_SUFFIX = '@bankfratern.local';
const PROPOSAL_INTEREST_QUEUE_EMAIL = String(
  process.env.BANCUS_PROPOSAL_INTEREST_QUEUE_EMAIL
    || (AUTH_MODE === 'demo' ? 'consultor@bankfratern.local' : '')
).trim().toLowerCase();
const AUTH_TRUST_PROXY = ['1', 'true', 'on', 'yes'].includes(String(process.env.BANCUS_TRUST_PROXY || '').trim().toLowerCase());
const AUTH_TRUSTED_PROXY_IPS = new Set(String(process.env.BANCUS_TRUSTED_PROXY_IPS || '')
  .split(',')
  .map((value) => value.trim().replace(/^::ffff:/i, ''))
  .filter((value) => net.isIP(value)));
const AUTH_GUARD_HMAC_SECRET = String(process.env.BANCUS_AUTH_AUDIT_HMAC_SECRET || '') || crypto.randomBytes(32).toString('hex');
const authLoginGuards = new Map();
if (
  AUTH_MODE === 'production'
  && ['1', 'true', 'on', 'yes'].includes(String(process.env.BANCUS_DB_SEED_USERS || '').trim().toLowerCase())
) {
  throw new Error('BANCUS_DB_SEED_USERS nao pode ser habilitado com BANCUS_AUTH_MODE=production.');
}
let validateProductivePassword = () => ({ ok: false, status: 503, message: 'Politica de senha indisponivel.' });
let proposalShareRepository = null;
let proposalShareService = null;
let proposalShareReady = Promise.resolve(null);
let proposalShareStartupError = null;
let PROPOSAL_SHARE_SCHEMA = 'bancus.proposal-secure-share.v1';

try {
  const databaseModule = databaseContract;
  SCHEMA_VERSION = databaseModule.SCHEMA_VERSION;
  const { createDatabase } = databaseModule;
  validateProductivePassword = databaseModule.validateProductivePassword;
  requestedDatabaseProvider = databaseModule.normalizeDbProvider(requestedDatabaseProvider);
  databaseReady = Promise.resolve(createDatabase({
    authMode: AUTH_MODE,
    seedUsers: AUTH_MODE === 'production' ? false : undefined
  }))
    .then((database) => {
      localDatabase = database;
      databaseStartupError = null;
      return database;
    })
    .catch((error) => {
      databaseStartupError = sanitizeInfrastructureError(error);
      console.warn(`Bancus Fraternis database unavailable (${databaseStartupError.code}): ${databaseStartupError.message}`);
      return null;
    });
} catch (error) {
  databaseStartupError = sanitizeInfrastructureError(error);
  databaseReady = Promise.resolve(null);
  console.warn(`Bancus Fraternis database unavailable (${databaseStartupError.code}): ${databaseStartupError.message}`);
}

try {
  const shareModule = require('./js/proposal-share');
  PROPOSAL_SHARE_SCHEMA = shareModule.SCHEMA;
  proposalShareReady = databaseReady.then(async (database) => {
    if (!database) return null;
    if (database.provider === 'postgresql') {
      const { createPostgresqlProposalShareRepository } = require('./js/backend/proposal-share-postgresql-repository');
      proposalShareRepository = await createPostgresqlProposalShareRepository({ database });
    } else {
      const { createProposalShareRepository } = require('./js/backend/proposal-share-repository');
      proposalShareRepository = createProposalShareRepository();
    }
    proposalShareService = shareModule.createProposalShareService({
      repository: proposalShareRepository
    });
    proposalShareStartupError = null;
    return proposalShareService;
  }).catch((error) => {
    proposalShareStartupError = sanitizeInfrastructureError(error);
    proposalShareRepository = null;
    proposalShareService = null;
    console.warn(`Bancus Fraternis secure proposal share disabled (${proposalShareStartupError.code}): ${proposalShareStartupError.message}`);
    return null;
  });
} catch (error) {
  proposalShareStartupError = sanitizeInfrastructureError(error);
  proposalShareReady = Promise.resolve(null);
  console.warn(`Bancus Fraternis secure proposal share disabled (${proposalShareStartupError.code}): ${proposalShareStartupError.message}`);
}

const PAGE_ALIASES = new Set([
  'index.html',
  'educacao.html',
  'produtos.html',
  'calculadoras.html',
  'calculadoras-governanca.html',
  'calculadora-juros-compostos.html',
  'calculadora-juros-simples.html',
  'calculadora-primeiro-milhao.html',
  'calculadora-aposentadoria.html',
  'calculadora-renda.html',
  'calculadora-reserva-emergencia.html',
  'calculadora-poupanca-selic.html',
  'calculadora-renda-fixa.html',
  'calculadora-compra-vista-parcelado.html',
  'calculadora-pix-parcelado.html',
  'calculadora-alugar-financiar.html',
  'calculadora-cartoes.html',
  'calculadora-realidade-brasileira.html',
  'calculadora-rentabilidade.html',
  'calculadora-acoes.html',
  'calculadora-cdb.html',
  'calculadora-capacidade-credito.html',
  'calculadora-lance-consorcio.html',
  'calculadora-custos-fixos.html',
  'comparador.html',
  'dados-abertos.html',
  'api-docs.html',
  'compliance.html',
  'componentes-v8.html',
  'lousa-navegacao.html',
  'login.html',
  'simulador.html',
  'grupo.html',
  'proposta.html',
  'simulador-consorcio.html',
  'simulador-financiamento.html',
  'simulador-veiculos.html',
  'simulador-cdc.html',
  'simulador-garantia.html',
  'simulador-consignado.html',
  'dashboard-cliente.html',
  'dashboard-admin.html',
  'assembleias.html',
  'carteira.html',
  'handoff-consultivo.html',
  'modelos-biblioteca.html',
  'modelos-governanca.html',
  'configuracoes.html',
  'duvidas.html',
  'sobre-nos.html',
  'trilha-decisao.html',
  'consorcio_user_journey_map_v2.html',
  'index_v4_paginas.html',
  'index_2.html'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

const PUBLIC_STATIC_ROOTS = new Set(['assets', 'css', 'data_base', 'js', 'pages']);
const PRIVATE_STATIC_PATHS = new Set(['js/server.js']);
const PRIVATE_STATIC_PREFIXES = ['js/backend/'];

function isPublicStaticPath(relativePath) {
  const normalized = String(relativePath || '').replace(/\\/g, '/').replace(/^\/+/, '');
  const segments = normalized.split('/').filter(Boolean);
  const unsafeWindowsName = (segment) => {
    const value = String(segment || '');
    const basename = value.split('.')[0].toLowerCase();
    return !value
      || value !== value.trim()
      || value.startsWith('.')
      || /[. ]$/.test(value)
      || value.includes(':')
      || /^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/.test(basename);
  };
  if (!segments.length || segments.some(unsafeWindowsName)) return false;

  const publicRoot = segments[0].toLowerCase();
  if (!PUBLIC_STATIC_ROOTS.has(publicRoot)) return false;
  // Todo JavaScript publico desta aplicacao fica diretamente em /js. Qualquer
  // subdiretorio pertence ao runtime do backend e nunca deve ser servido.
  if (publicRoot === 'js' && segments.length !== 2) return false;

  const normalizedLower = normalized.toLowerCase();
  if (PRIVATE_STATIC_PATHS.has(normalizedLower)) return false;
  if (PRIVATE_STATIC_PREFIXES.some((prefix) => normalizedLower.startsWith(prefix))) return false;

  return Object.prototype.hasOwnProperty.call(MIME_TYPES, path.extname(normalizedLower));
}

function resolveRequestPath(reqUrl) {
  const rawPath = (reqUrl || '/').split('?')[0].split('#')[0];
  let decodedPath;
  try {
    decodedPath = decodeURIComponent(rawPath);
  } catch (error) {
    return null;
  }
  if (decodedPath.includes('\\') || decodedPath.includes('\0')) return null;
  let relativePath = decodedPath === '/' ? '/pages/index.html' : decodedPath;
  const cleanName = relativePath.replace(/^\/+/, '');
  if (PAGE_ALIASES.has(cleanName)) {
    relativePath = `/pages/${cleanName}`;
  }
  const filePath = path.resolve(ROOT_DIR, `.${relativePath}`);
  const pathInsideRoot = path.relative(ROOT_DIR, filePath);

  if (pathInsideRoot.startsWith('..') || path.isAbsolute(pathInsideRoot)) {
    return null;
  }

  if (!isPublicStaticPath(pathInsideRoot)) return null;

  return filePath;
}

function sendJson(res, status, data, extraHeaders = {}) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer',
    ...extraHeaders
  });
  res.end(JSON.stringify(data));
}

function sendPublicShareJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'private, no-store',
    'X-Robots-Tag': 'noindex, nofollow, noarchive',
    'Referrer-Policy': 'no-referrer',
    'X-Content-Type-Options': 'nosniff',
    'X-Frame-Options': 'DENY',
    'Content-Security-Policy': "default-src 'none'; frame-ancestors 'none'"
  });
  res.end(JSON.stringify(data));
}

function notFoundJson(res) {
  sendJson(res, 404, { ok: false, message: 'Endpoint nao encontrado.' });
}

function methodNotAllowed(res) {
  sendJson(res, 405, { ok: false, message: 'Metodo nao permitido.' });
}

function readRequestBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let settled = false;
    const onData = (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      receivedBytes += buffer.length;
      if (receivedBytes > maxBytes) {
        settled = true;
        const payloadError = new Error(`Payload excede o limite de ${maxBytes} bytes.`);
        payloadError.code = 'BANCUS_HTTP_PAYLOAD_TOO_LARGE';
        payloadError.status = 413;
        req.removeListener('data', onData);
        req.resume();
        reject(payloadError);
        return;
      }
      chunks.push(buffer);
    };
    req.on('data', onData);
    req.on('end', () => {
      if (settled) return;
      settled = true;
      resolve(Buffer.concat(chunks).toString('utf8'));
    });
    req.on('error', (error) => {
      if (settled) return;
      settled = true;
      reject(error);
    });
  });
}

async function readJsonBody(req, maxBytes = MAX_JSON_BODY_BYTES) {
  const body = await readRequestBody(req, maxBytes);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    const parseError = new Error('JSON invalido.');
    parseError.status = 400;
    throw parseError;
  }
}

async function readJsonObject(req, maxBytes = MAX_JSON_BODY_BYTES) {
  const body = await readJsonBody(req, maxBytes);
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    const payloadError = new Error('O corpo JSON precisa ser um objeto.');
    payloadError.status = 400;
    throw payloadError;
  }
  return body;
}

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function cookieToken(req) {
  const raw = String(req.headers.cookie || '');
  if (!raw || raw.length > 8192) return '';
  for (const part of raw.split(';')) {
    const separator = part.indexOf('=');
    if (separator < 0) continue;
    const name = part.slice(0, separator).trim();
    if (name !== AUTH_COOKIE_NAME) continue;
    try {
      return decodeURIComponent(part.slice(separator + 1).trim());
    } catch (error) {
      return '';
    }
  }
  return '';
}

function sessionToken(req) {
  return AUTH_MODE === 'production' ? cookieToken(req) : bearerToken(req);
}

function publicSession(session) {
  if (!session) return null;
  return {
    id: session.id,
    role: session.role,
    createdAt: session.createdAt,
    expiresAt: session.expiresAt
  };
}

function authCookie(token) {
  const parts = [
    `${AUTH_COOKIE_NAME}=${encodeURIComponent(String(token || ''))}`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    `Max-Age=${Math.max(1, Math.trunc(AUTH_SESSION_TTL_MINUTES * 60))}`
  ];
  if (AUTH_COOKIE_SECURE) parts.push('Secure');
  return parts.join('; ');
}

function clearAuthCookie() {
  const parts = [
    `${AUTH_COOKIE_NAME}=`,
    'Path=/',
    'HttpOnly',
    'SameSite=Lax',
    'Max-Age=0'
  ];
  if (AUTH_COOKIE_SECURE) parts.push('Secure');
  return parts.join('; ');
}

function normalizeOrigin(value) {
  try {
    return new URL(String(value || '')).origin;
  } catch (error) {
    return '';
  }
}

function expectedRequestOrigin(req) {
  const configured = normalizeOrigin(process.env.BANCUS_PUBLIC_ORIGIN);
  if (configured) return configured;
  const forwardedProto = String(req.headers['x-forwarded-proto'] || '').split(',')[0].trim().toLowerCase();
  const protocol = forwardedProto === 'https' || AUTH_COOKIE_SECURE ? 'https' : 'http';
  return normalizeOrigin(`${protocol}://${String(req.headers.host || '')}`);
}

function requireTrustedOrigin(req, res) {
  if (AUTH_MODE !== 'production' || !['POST', 'PATCH', 'PUT', 'DELETE'].includes(req.method || '')) return true;
  const origin = normalizeOrigin(req.headers.origin);
  if (origin && origin === expectedRequestOrigin(req)) return true;
  sendJson(res, 403, { ok: false, code: 'AUTH_ORIGIN_REJECTED', message: 'Origem da solicitacao nao autorizada.' });
  return false;
}

function clientAddress(req) {
  const remoteAddress = String(req.socket && req.socket.remoteAddress || 'unknown').slice(0, 128);
  const normalizedRemote = remoteAddress.replace(/^::ffff:/i, '');
  if (AUTH_TRUST_PROXY && AUTH_TRUSTED_PROXY_IPS.has(normalizedRemote)) {
    const forwardedChain = String(req.headers['x-forwarded-for'] || '')
      .split(',')
      .map((value) => value.trim().replace(/^::ffff:/i, ''))
      .filter((value) => net.isIP(value));
    for (let index = forwardedChain.length - 1; index >= 0; index -= 1) {
      const candidate = forwardedChain[index];
      if (!AUTH_TRUSTED_PROXY_IPS.has(candidate)) return candidate;
    }
  }
  return normalizedRemote;
}

function loginGuardKey(kind, value) {
  return crypto.createHmac('sha256', AUTH_GUARD_HMAC_SECRET).update(`${kind}:${String(value || '')}`).digest('hex');
}

function loginGuardEntries(req, email) {
  const address = clientAddress(req);
  const account = String(email || '').toLowerCase();
  return [
    { kind: 'account', key: loginGuardKey('account', account), limit: AUTH_LOGIN_MAX_FAILURES },
    { kind: 'pair', key: loginGuardKey('pair', `${address}|${account}`), limit: AUTH_LOGIN_MAX_FAILURES },
    { kind: 'ip', key: loginGuardKey('ip', address), limit: AUTH_LOGIN_IP_MAX_FAILURES }
  ];
}

function readLoginGuard(key, timestamp = Date.now()) {
  const current = authLoginGuards.get(key);
  if (!current) return { failures: 0, windowStartedAt: timestamp, lockedUntil: 0 };
  if (current.lockedUntil > timestamp) return current;
  if (timestamp - current.windowStartedAt >= AUTH_LOGIN_WINDOW_MS) {
    authLoginGuards.delete(key);
    return { failures: 0, windowStartedAt: timestamp, lockedUntil: 0 };
  }
  return current;
}

function pruneLoginGuards(timestamp = Date.now()) {
  for (const [key, current] of authLoginGuards.entries()) {
    if (current.lockedUntil <= timestamp && timestamp - current.windowStartedAt >= AUTH_LOGIN_WINDOW_MS) {
      authLoginGuards.delete(key);
    }
  }
}

function uniqueLoginGuardEntries(entries) {
  const seen = new Set();
  return (entries || []).filter((entry) => {
    if (!entry || !entry.key || seen.has(entry.key)) return false;
    seen.add(entry.key);
    return true;
  });
}

function hasLoginGuardCapacity(entries) {
  const missingEntries = uniqueLoginGuardEntries(entries)
    .filter(({ key }) => !authLoginGuards.has(key))
    .length;
  return authLoginGuards.size + missingEntries <= AUTH_LOGIN_GUARD_MAX_ENTRIES;
}

function isLoginBlocked(entries) {
  const timestamp = Date.now();
  return uniqueLoginGuardEntries(entries)
    .some(({ key }) => readLoginGuard(key, timestamp).lockedUntil > timestamp);
}

function registerLoginFailure(entries) {
  const timestamp = Date.now();
  pruneLoginGuards(timestamp);
  const uniqueEntries = uniqueLoginGuardEntries(entries);
  if (!hasLoginGuardCapacity(uniqueEntries)) return false;
  uniqueEntries.forEach(({ key, limit }) => {
    const current = readLoginGuard(key, timestamp);
    const failures = current.failures + 1;
    authLoginGuards.set(key, {
      failures,
      windowStartedAt: current.windowStartedAt,
      lockedUntil: failures >= limit ? timestamp + AUTH_LOGIN_LOCK_MS : 0
    });
  });
  return true;
}

function clearLoginFailure(entries) {
  uniqueLoginGuardEntries(entries)
    .filter(({ kind }) => kind !== 'ip')
    .forEach(({ key }) => authLoginGuards.delete(key));
}

function authLoginGuardStats(timestamp = Date.now()) {
  pruneLoginGuards(timestamp);
  let lockedEntries = 0;
  authLoginGuards.forEach((entry) => {
    if (entry.lockedUntil > timestamp) lockedEntries += 1;
  });
  return {
    size: authLoginGuards.size,
    maxEntries: AUTH_LOGIN_GUARD_MAX_ENTRIES,
    lockedEntries
  };
}

function rejectLoginRateLimited(res, code = 'AUTH_RATE_LIMITED') {
  sendJson(res, 429, {
    ok: false,
    code,
    message: 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
  }, { 'Retry-After': String(Math.trunc(AUTH_LOGIN_LOCK_MS / 1000)) });
}

function sanitizeInfrastructureError(error) {
  const rawCode = String(error && error.code ? error.code : 'DATABASE_STARTUP_FAILED').toUpperCase();
  const code = /^[A-Z0-9_:-]{3,80}$/.test(rawCode) ? rawCode : 'DATABASE_STARTUP_FAILED';
  const rawMessage = String(error && error.message ? error.message : 'Provider de banco indisponivel.');
  const message = rawMessage
    .replace(/postgres(?:ql)?:\/\/[^\s]+/gi, '[database-url-redacted]')
    .replace(/(password|senha|token|secret)\s*[=:]\s*[^\s,;]+/gi, '$1=[redacted]')
    .slice(0, 240);
  return { code, message };
}

function clientJourneyDefaults(kind, existing = {}) {
  if (kind === 'simulation') {
    return {
      status: existing.status || 'saved',
      stage: existing.stage || 'simulation',
      priority: existing.priority || 'media'
    };
  }
  return {
    status: existing.status || 'draft',
    stage: existing.stage || 'proposal',
    priority: existing.priority || 'media'
  };
}

function sanitizeClientJourneyPayload(kind, body = {}, existing = {}) {
  return { ...body, ...clientJourneyDefaults(kind, existing) };
}

function sanitizeClientSnapshotPayload(body = {}) {
  const type = String(body.type || '').trim().toLowerCase();
  const payload = body.payload && typeof body.payload === 'object' ? { ...body.payload } : {};
  if (type === 'simulation') {
    Object.assign(payload, { status: 'saved', statusProposta: 'saved', stage: 'simulation', etapa: 'simulation', priority: 'media', prioridade: 'media' });
    return { ...body, status: 'saved', payload };
  }
  if (['proposal-version', 'proposal-acceptance', 'proposal-builder'].includes(type)) {
    Object.assign(payload, { status: type === 'proposal-acceptance' ? 'accepted' : 'draft', stage: 'proposal', priority: 'media' });
    return { ...body, status: payload.status, payload };
  }
  return body;
}

async function getDatabase() {
  if (localDatabase) return localDatabase;
  return databaseReady;
}

async function getProposalShareService() {
  if (proposalShareService) return proposalShareService;
  return proposalShareReady;
}

async function authContext(req) {
  const token = sessionToken(req);
  const database = await getDatabase();
  if (!token || !database) return null;
  return database.authenticateToken(token);
}

async function requireAuth(req, res, roles = [], options = {}) {
  const context = await authContext(req);
  if (!context || !context.user) {
    sendJson(res, 401, { ok: false, message: 'Sessao de API ausente ou expirada.' });
    return null;
  }

  const allowed = Array.isArray(roles) ? roles : [roles];
  if (allowed.length && !allowed.includes(context.user.role)) {
    sendJson(res, 403, { ok: false, message: 'Perfil sem permissao para esta operacao.' });
    return null;
  }

  if (context.user.mustChangePassword && options.allowPasswordChangePending !== true) {
    sendJson(res, 403, {
      ok: false,
      code: 'PASSWORD_CHANGE_REQUIRED',
      message: 'Defina sua nova senha para continuar.'
    });
    return null;
  }

  return context;
}

async function recordApiEvent(type, details, context, databaseOverride = null) {
  try {
    const database = databaseOverride || await getDatabase();
    if (!database) return null;
    return await database.recordEvent({
      type,
      source: 'server-api',
      ownerEmail: details && details.ownerEmail ? details.ownerEmail : '',
      actorEmail: context && context.user ? context.user.email : (details && details.actorEmail ? details.actorEmail : ''),
      sessionId: context && context.session ? context.session.id : '',
      entityType: details && details.entityType ? details.entityType : '',
      entityId: details && details.entityId ? details.entityId : '',
      payload: details && details.payload ? details.payload : {}
    });
  } catch (error) {
    console.warn('Bancus Fraternis: um evento de auditoria nao pôde ser persistido; a operacao principal foi preservada.');
    return null;
  }
}

function statusFromResult(result, fallback = 200) {
  return Number(result && result.status) || fallback;
}

function proposalInterestObject(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {};
}

function proposalInterestText(value, maxLength = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function proposalInterestSystemId(value, prefix) {
  const id = proposalInterestText(value, 160);
  return id && new RegExp(`^${prefix}-[A-Za-z0-9._:-]+$`, 'i').test(id) ? id : '';
}

function proposalInterestNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function proposalInterestDetailsFromPayload(payload = {}) {
  const source = proposalInterestObject(payload);
  const metrics = proposalInterestObject(source.metrics);
  const summary = proposalInterestObject(source.summary);
  return {
    ownerName: source.cliente || source.ownerName || '',
    amount: metrics.creditoTotal || summary.valorCredito || source.amount || 0,
    productName: source.produto || summary.productName || '',
    proposalVersion: source.version || source.acceptanceVersion || 0,
    proposalStatus: source.status || 'reviewed',
    validUntil: source.validUntil || '',
    sourceHash: source.sourceHash || '',
    proposalUpdatedAt: source.updatedAt || source.createdAt || ''
  };
}

async function proposalInterestConsultantEmail(database, candidates = []) {
  if (!database) return '';
  const values = Array.from(new Set((Array.isArray(candidates) ? candidates : [candidates])
    .map((value) => proposalInterestText(value, 254).toLowerCase())
    .filter(Boolean)));
  if (typeof database.getUserByEmail === 'function') {
    for (const email of values) {
      const user = await database.getUserByEmail(email);
      if (user && user.role === 'consultor' && user.status === 'active') return proposalInterestText(user.email, 254).toLowerCase();
    }
  }
  return '';
}

async function proposalInterestQueueEmail(database, candidates = []) {
  return proposalInterestConsultantEmail(database, [
    ...(Array.isArray(candidates) ? candidates : [candidates]),
    PROPOSAL_INTEREST_QUEUE_EMAIL
  ]);
}

function requireProposalInterestConsultant(email) {
  if (email) return email;
  const error = new Error('Nenhum consultor esta disponivel para receber este pedido.');
  error.status = 503;
  throw error;
}

function proposalInterestSimulationProposalId(record) {
  const payload = proposalInterestObject(record && record.payload);
  const acceptance = proposalInterestObject(payload.proposalAcceptance);
  return proposalInterestSystemId(
    payload.proposalId || acceptance.proposalId || (record && record.relatedId),
    'PROP'
  );
}

async function proposalInterestCanonicalSimulation(database, options = {}) {
  if (!database || typeof database.listSimulations !== 'function') return null;
  const ownerEmail = proposalInterestText(options.ownerEmail, 254).toLowerCase();
  const proposalId = proposalInterestSystemId(options.proposalId, 'PROP');
  const preferredId = proposalInterestSystemId(options.preferredId, 'SIM');
  if (!ownerEmail || !proposalId) return null;
  const rows = await database.listSimulations({ limit: 500, ownerEmail });
  const linked = (Array.isArray(rows) ? rows : [])
    .filter((row) => proposalInterestSimulationProposalId(row) === proposalId);
  if (preferredId) return linked.find((row) => row && row.id === preferredId) || null;
  return linked[0] || null;
}

function proposalInterestLegacyVersionId(proposal, proposalId) {
  const payload = proposalInterestObject(proposal && proposal.payload);
  const sourceId = proposalInterestText(payload.id || payload.acceptanceId || (proposal && proposal.id), 160);
  const digest = crypto
    .createHash('sha256')
    .update(`${proposalId}|${sourceId}|${proposalInterestText(proposal && proposal.createdAt, 40)}`)
    .digest('hex')
    .slice(0, 16)
    .toUpperCase();
  return `PV-LEGACY-${digest}`;
}

async function proposalInterestFromShare(resolved, database) {
  const snapshot = proposalInterestObject(resolved && resolved.snapshot);
  const project = proposalInterestObject(snapshot.project);
  const client = proposalInterestObject(project.client);
  const result = proposalInterestObject(snapshot.result);
  const proposalData = proposalInterestObject(result.proposalData);
  const metrics = proposalInterestObject(proposalData.metrics);
  const review = proposalInterestObject(snapshot.review);
  const provenance = proposalInterestObject(snapshot.provenance);
  const firstItem = Array.isArray(project.items) ? proposalInterestObject(project.items[0]) : {};
  const owner = database && typeof database.getUserById === 'function'
    ? await database.getUserById(resolved.ownerId)
    : null;
  const ownerEmail = requireProposalInterestConsultant(await proposalInterestQueueEmail(database, [
    owner && owner.role === 'consultor' ? owner.email : ''
  ]));
  const proposalId = proposalInterestSystemId(snapshot.proposalId || proposalData.id, 'PROP');
  const preferredSimulationId = proposalInterestSystemId(
    provenance.simulationId || proposalData.simulationId,
    'SIM'
  );
  const simulation = await proposalInterestCanonicalSimulation(database, {
    ownerEmail: owner && owner.email,
    proposalId,
    preferredId: preferredSimulationId
  });
  if (!simulation) {
    const error = new Error('A simulacao vinculada a esta proposta ainda nao esta disponivel para atendimento.');
    error.status = 409;
    throw error;
  }

  return {
    identity: {
      proposalId,
      proposalVersionId: provenance.proposalVersionId || proposalData.proposalVersionId,
      snapshotId: resolved.snapshotId || snapshot.id,
      simulationId: simulation.id,
      ownerEmail
    },
    details: {
      ownerName: client.name || proposalData.cliente || '',
      consultantEmail: ownerEmail,
      amount: metrics.creditoTotal || proposalData.creditoTotal || 0,
      productName: proposalData.produto || firstItem.segmento || firstItem.categoria || 'Consorcio',
      proposalVersion: review.version || 0,
      proposalStatus: review.status || 'reviewed',
      validUntil: review.validUntil || '',
      sourceHash: provenance.sourceHash || '',
      proposalUpdatedAt: review.reviewedAt || snapshot.createdAt || ''
    }
  };
}

async function proposalInterestVersionContext(database, proposal, proposalId, proposalVersionId, ownerEmail) {
  const proposalPayload = proposalInterestObject(proposal && proposal.payload);
  const directVersionId = proposalInterestSystemId(
    proposalPayload.id || proposalPayload.proposalVersionId,
    'PV'
  );
  if (directVersionId === proposalVersionId) {
    return {
      found: true,
      simulationId: proposalInterestSystemId(proposalPayload.simulationId, 'SIM')
    };
  }
  if (!database || typeof database.listSnapshots !== 'function') return { found: false, simulationId: '' };
  const snapshots = await database.listSnapshots({
    limit: 200,
    type: 'proposal-version',
    ownerEmail
  });
  const version = (Array.isArray(snapshots) ? snapshots : []).find((snapshot) => {
    const payload = proposalInterestObject(snapshot && snapshot.payload);
    return proposalInterestSystemId(payload.id || payload.proposalVersionId, 'PV') === proposalVersionId
      && proposalInterestSystemId(payload.proposalId, 'PROP') === proposalId;
  });
  const versionPayload = proposalInterestObject(version && version.payload);
  return {
    found: Boolean(version),
    simulationId: proposalInterestSystemId(versionPayload.simulationId, 'SIM')
  };
}

function proposalInterestLegacyAcceptance(proposal, proposalId) {
  const payload = proposalInterestObject(proposal && proposal.payload);
  const payloadProposalId = proposalInterestSystemId(payload.proposalId, 'PROP');
  const source = proposalInterestText((proposal && proposal.source) || '', 80).toLowerCase();
  const schema = proposalInterestText(payload.schema || '', 120).toLowerCase();
  const status = proposalInterestText(payload.status || (proposal && proposal.status) || '', 40).toLowerCase();
  return payloadProposalId === proposalId
    && (source === 'proposal-acceptance' || schema === 'bank-fratern.proposal-acceptance.v1')
    && ['reviewed', 'accepted', 'sent'].includes(status);
}

async function proposalInterestFromSession(body, context, database) {
  const proposalId = proposalInterestSystemId(body && body.proposalId, 'PROP');
  if (!proposalId) {
    const error = new Error('Proposta invalida para solicitar contato.');
    error.status = 422;
    throw error;
  }

  const isAdmin = context.user.role === 'admin';
  const scopedOwnerEmail = isAdmin ? '' : context.user.email;
  const proposal = await database.findMaterializedJourneyRow('proposal', proposalId, {
    ownerEmail: scopedOwnerEmail
  });
  if (!proposal) {
    const error = new Error('Proposta indisponivel para este perfil.');
    error.status = 404;
    throw error;
  }
  const payload = proposalInterestObject(proposal && proposal.payload);
  const payloadDetails = proposalInterestDetailsFromPayload(payload);
  const requestedProposalVersionId = proposalInterestSystemId(
    (body && body.proposalVersionId) || payload.id || payload.proposalVersionId,
    'PV'
  );
  if (!requestedProposalVersionId) {
    const error = new Error('Versao da proposta ausente.');
    error.status = 422;
    throw error;
  }
  const requestedSimulationId = proposalInterestSystemId(body && body.simulationId, 'SIM');
  const proposalOwnerEmail = proposalInterestText(proposal.ownerEmail, 254).toLowerCase();
  const versionContext = await proposalInterestVersionContext(
    database,
    proposal,
    proposalId,
    requestedProposalVersionId,
    proposalOwnerEmail
  );
  const legacyAcceptance = !versionContext.found && proposalInterestLegacyAcceptance(proposal, proposalId);
  if (!versionContext.found && !legacyAcceptance) {
    const error = new Error('Versao da proposta indisponivel para este perfil.');
    error.status = 404;
    throw error;
  }
  if (versionContext.found && requestedSimulationId && versionContext.simulationId !== requestedSimulationId) {
    const error = new Error('A simulacao informada nao corresponde a versao da proposta.');
    error.status = 404;
    throw error;
  }
  const proposalVersionId = legacyAcceptance
    ? proposalInterestLegacyVersionId(proposal, proposalId)
    : requestedProposalVersionId;
  const simulation = await proposalInterestCanonicalSimulation(database, {
    ownerEmail: proposalOwnerEmail,
    proposalId,
    preferredId: legacyAcceptance ? '' : versionContext.simulationId
  });
  if (!simulation) {
    const error = new Error('A simulacao vinculada a esta proposta ainda nao esta disponivel para atendimento.');
    error.status = 409;
    throw error;
  }
  const interestKey = legacyAcceptance ? `PIK-LEGACY-${proposalId}` : '';
  const ownerEmail = requireProposalInterestConsultant(await proposalInterestQueueEmail(database, [
    context.user.role === 'consultor' ? context.user.email : '',
    proposal && proposal.actorEmail
  ]));

  return {
    identity: {
      proposalId,
      proposalVersionId,
      snapshotId: '',
      simulationId: simulation.id,
      interestKey,
      ownerEmail
    },
    details: {
      ...payloadDetails,
      consultantEmail: ownerEmail,
      proposalVersion: payload.version || payloadDetails.proposalVersion || 0,
      amount: proposalInterestNumber(payloadDetails.amount)
    }
  };
}

function proposalInterestService(database) {
  return proposalInterestContract.createProposalInterestService({ database });
}

function isProposalInterestLead(record = {}) {
  const source = proposalInterestObject(record);
  const payload = proposalInterestObject(source.payload);
  return /^LEAD-PI-[A-F0-9]+$/i.test(proposalInterestText(source.id, 160))
    && proposalInterestText(source.source || payload.source, 80).toLowerCase() === proposalInterestContract.SOURCE
    && proposalInterestText(payload.interestSchema, 120) === proposalInterestContract.SCHEMA;
}

function attemptsReservedProposalInterestLead(input = {}) {
  const payload = proposalInterestObject(input.payload);
  return /^LEAD-PI-/i.test(proposalInterestText(input.id, 160))
    || proposalInterestText(input.source || payload.source, 80).toLowerCase() === proposalInterestContract.SOURCE
    || proposalInterestText(payload.interestSchema, 120) === proposalInterestContract.SCHEMA;
}

function preserveProposalInterestLeadIdentity(input = {}, existing = {}) {
  if (!isProposalInterestLead(existing)) return input;
  const original = proposalInterestObject(existing.payload);
  const requested = proposalInterestObject(input.payload);
  const originalContactCommitment = proposalInterestObject(original.contactCommitment);
  const requestedCommitmentStatus = proposalInterestText(
    input.status || requested.status || originalContactCommitment.status,
    40
  );
  return {
    ...input,
    id: existing.id,
    ownerEmail: existing.ownerEmail,
    source: existing.source,
    relatedId: existing.relatedId,
    payload: {
      ...original,
      ...requested,
      id: original.id,
      source: original.source,
      sourceType: original.sourceType,
      sourceProposalId: original.sourceProposalId,
      sourceProposalVersionId: original.sourceProposalVersionId,
      sourceSimulationId: original.sourceSimulationId,
      ownerEmail: original.ownerEmail,
      assignedTo: original.assignedTo,
      nextAction: original.nextAction,
      interestSchema: original.interestSchema,
      interestRequestedAt: original.interestRequestedAt,
      contactCommitment: {
        ...originalContactCommitment,
        status: requestedCommitmentStatus || originalContactCommitment.status
      },
      createdAt: original.createdAt
    }
  };
}

function proposalInterestLeadLinksSimulation(lead, simulation) {
  if (!isProposalInterestLead(lead) || !simulation) return false;
  const payload = proposalInterestObject(lead.payload);
  const proposalId = proposalInterestSimulationProposalId(simulation);
  return proposalInterestSystemId(payload.sourceSimulationId, 'SIM') === simulation.id
    && proposalInterestSystemId(payload.sourceProposalId, 'PROP') === proposalId
    && proposalInterestSystemId(lead.relatedId, 'PROP') === proposalId;
}

function proposalInterestLeadAllowsSimulation(lead, simulation, consultantEmail) {
  if (!proposalInterestLeadLinksSimulation(lead, simulation)) return false;
  const payload = proposalInterestObject(lead.payload);
  const email = proposalInterestText(consultantEmail, 254).toLowerCase();
  return proposalInterestText(lead.ownerEmail, 254).toLowerCase() === email
    && proposalInterestText(payload.assignedTo, 254).toLowerCase() === email;
}

function proposalInterestEscapeResumeText(value) {
  return String(value == null ? '' : value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

const PROPOSAL_INTEREST_RESUME_FIELDS = new Set([
  'proposalId',
  'origem',
  'privacy',
  'currentStep',
  'totalCarta',
  'totalGrupos',
  'totalCotas',
  'segmentos',
  'params',
  'carrinho',
  'resultado',
  'resumo',
  'comparison',
  'proposalSnapshotRef',
  'proposalAcceptance'
]);

const PROPOSAL_INTEREST_RESUME_PRIVATE_KEYS = new Set([
  'name', 'nome', 'cliente', 'client', 'clientname', 'clientid', 'nomecliente',
  'consultor', 'consultant', 'reviewer', 'revisor', 'cpf', 'cnpj', 'rg',
  'titular', 'responsavel', 'beneficiario', 'nomecompleto', 'razaosocial',
  'nomefantasia', 'contactperson', 'matricula', 'passport', 'passaporte',
  'document', 'documento', 'email', 'phone', 'telefone', 'celular', 'mobile',
  'whatsapp', 'address', 'endereco', 'cep', 'birthdate', 'nascimento',
  'password', 'senha', 'secret', 'token', 'cookie', 'sessiontoken',
  'actorid', 'ownerid', 'userid', 'createdby', 'reviewedby', 'observacao',
  'observacoes', 'observacaoitem', 'note', 'notes', 'comentario', 'comentarios',
  'mensagem', 'mensagens', 'recado', 'narrativa', 'notice'
]);

const PROPOSAL_INTEREST_RESUME_PRIVATE_FRAGMENTS = Object.freeze([
  'email', 'telefone', 'phone', 'celular', 'mobile', 'whatsapp', 'cpf', 'cnpj',
  'passport', 'passaporte', 'documento', 'password', 'senha', 'secret', 'token',
  'cookie', 'session', 'owner', 'actor', 'userid', 'createdby', 'reviewedby',
  'address', 'endereco', 'birth', 'nascimento', 'matricula', 'contactperson',
  'contato'
]);

function proposalInterestNormalizeResumeKey(value) {
  return String(value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]/gi, '')
    .toLowerCase();
}

function proposalInterestResumePrivateKey(value) {
  const normalized = proposalInterestNormalizeResumeKey(value);
  if (!normalized || PROPOSAL_INTEREST_RESUME_PRIVATE_KEYS.has(normalized)) return true;
  return PROPOSAL_INTEREST_RESUME_PRIVATE_FRAGMENTS.some((fragment) => normalized.includes(fragment));
}

function proposalInterestRedactResumeText(value) {
  return String(value == null ? '' : value)
    .slice(0, 4096)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[dado removido]')
    .replace(/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d{2}\b/g, '[dado removido]')
    .replace(/\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}\b/g, '[dado removido]')
    .replace(/(^|[^A-Z0-9-])((?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})\b/gi, '$1[dado removido]');
}

function proposalInterestSanitizeResumeValue(value, depth = 0) {
  if (depth > 32) return null;
  if (value == null || typeof value === 'boolean') return value;
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (typeof value === 'string') {
    return proposalInterestEscapeResumeText(proposalInterestRedactResumeText(value));
  }
  if (Array.isArray(value)) {
    return value.slice(0, 10000).map((item) => proposalInterestSanitizeResumeValue(item, depth + 1));
  }
  if (typeof value !== 'object') return null;

  const sanitized = Object.create(null);
  Object.entries(value).forEach(([key, item]) => {
    if (key === '__proto__' || key === 'prototype' || key === 'constructor') return;
    if (proposalInterestResumePrivateKey(key)) return;
    sanitized[key] = proposalInterestSanitizeResumeValue(item, depth + 1);
  });
  return sanitized;
}

function proposalInterestSanitizeResumePayload(value) {
  const source = proposalInterestObject(value);
  const sanitized = Object.create(null);
  PROPOSAL_INTEREST_RESUME_FIELDS.forEach((key) => {
    if (!Object.prototype.hasOwnProperty.call(source, key)) return;
    sanitized[key] = proposalInterestSanitizeResumeValue(source[key], 1);
  });
  sanitized.proposalId = proposalInterestSystemId(source.proposalId, 'PROP');
  sanitized.privacy = {
    localPIIStored: false,
    notice: 'Dados identificadores nao sao compartilhados nesta revisao.'
  };
  return sanitized;
}

async function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  if (!pathname.startsWith('/api/')) return false;
  if (!requireTrustedOrigin(req, res)) return true;

  if (pathname === '/api/auth/config' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      mode: AUTH_MODE,
      transport: AUTH_MODE === 'production' ? 'cookie' : 'bearer',
      demoAccounts: AUTH_MODE === 'demo',
      sessionMinutes: AUTH_SESSION_TTL_MINUTES,
      passwordPolicy: {
        minLength: 12,
        maxLength: 128,
        requiredGroups: ['lowercase', 'uppercase', 'number', 'symbol']
      }
    });
    return true;
  }

  if (pathname === '/api/health' && req.method === 'GET') {
    const database = await getDatabase();
    const shareService = await getProposalShareService();
    const databaseOk = Boolean(database);
    const proposalShareOk = Boolean(shareService);
    const readyOk = databaseOk && proposalShareOk;
    sendJson(res, readyOk ? 200 : 503, {
      ok: readyOk,
      authMode: AUTH_MODE,
      database: databaseOk,
      provider: database ? database.provider : requestedDatabaseProvider,
      schema: SCHEMA_VERSION,
      stats: database ? await database.stats() : null,
      startupError: databaseStartupError,
      proposalShare: {
        enabled: proposalShareOk,
        schema: PROPOSAL_SHARE_SCHEMA,
        provider: proposalShareRepository ? proposalShareRepository.provider : requestedDatabaseProvider,
        stats: proposalShareRepository ? await proposalShareRepository.stats() : null,
        startupError: proposalShareStartupError
      }
    });
    return true;
  }

  if (pathname === '/api/public/proposals/interest') {
    if (req.method !== 'POST') {
      sendPublicShareJson(res, 405, { ok: false, readOnly: true, message: 'Metodo nao permitido.' });
      return true;
    }
    const [shareService, database] = await Promise.all([getProposalShareService(), getDatabase()]);
    if (!shareService || !database) {
      sendPublicShareJson(res, 503, { ok: false, readOnly: true, message: 'Atendimento indisponivel.' });
      return true;
    }
    try {
      const body = await readJsonObject(req);
      const resolved = await shareService.resolveContext(body.token);
      const interestInput = await proposalInterestFromShare(resolved, database);
      const requested = await proposalInterestService(database).request(interestInput.identity, interestInput.details);
      if (requested.created) {
        await recordApiEvent('proposal-interest-requested', {
          ownerEmail: interestInput.identity.ownerEmail,
          entityType: 'lead',
          entityId: requested.interest.id,
          payload: { source: 'proposal-interest', status: requested.interest.status }
        }, null, database);
      }
      sendPublicShareJson(res, requested.created ? 201 : 200, {
        ok: true,
        readOnly: true,
        interest: requested.interest
      });
    } catch (error) {
      sendPublicShareJson(res, Number(error.status) || 500, {
        ok: false,
        readOnly: true,
        message: Number(error.status) >= 400 && Number(error.status) < 500
          ? error.message
          : 'Nao foi possivel registrar o pedido de contato.'
      });
    }
    return true;
  }

  if (pathname === '/api/public/proposals/resolve') {
    if (req.method !== 'POST') {
      sendPublicShareJson(res, 405, { ok: false, readOnly: true, message: 'Metodo nao permitido.' });
      return true;
    }
    const [shareService, database] = await Promise.all([getProposalShareService(), getDatabase()]);
    if (!shareService) {
      sendPublicShareJson(res, 503, { ok: false, readOnly: true, message: 'Compartilhamento indisponivel.' });
      return true;
    }
    try {
      const body = await readJsonObject(req);
      const resolved = await shareService.resolveContext(body.token);
      let interest = null;
      if (database) {
        try {
          const interestInput = await proposalInterestFromShare(resolved, database);
          interest = await proposalInterestService(database).resolve(interestInput.identity);
        } catch (interestError) {
          // A proposta continua legivel mesmo quando o acompanhamento comercial nao esta disponivel.
        }
      }
      sendPublicShareJson(res, 200, { ok: true, ...resolved.publicView, interest });
    } catch (error) {
      sendPublicShareJson(res, Number(error.status) || 500, {
        ok: false,
        readOnly: true,
        message: Number(error.status) >= 400 && Number(error.status) < 500
          ? error.message
          : 'Compartilhamento indisponivel.'
      });
    }
    return true;
  }

  const database = await getDatabase();
  if (!database) {
    sendJson(res, 503, {
      ok: false,
      message: 'Provider de banco indisponivel neste runtime.',
      provider: requestedDatabaseProvider,
      error: databaseStartupError
    });
    return true;
  }
  await getProposalShareService();

  if (pathname === '/api/proposal-interests/resolve' || pathname === '/api/proposal-interests') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['cliente']);
    if (!context) return true;
    try {
      const body = await readJsonObject(req);
      const interestInput = await proposalInterestFromSession(body, context, database);
      const service = proposalInterestService(database);
      if (pathname.endsWith('/resolve')) {
        const interest = await service.resolve(interestInput.identity);
        sendJson(res, 200, { ok: true, interest });
        return true;
      }
      const requested = await service.request(interestInput.identity, interestInput.details);
      if (requested.created) {
        await recordApiEvent('proposal-interest-requested', {
          ownerEmail: interestInput.identity.ownerEmail,
          entityType: 'lead',
          entityId: requested.interest.id,
          payload: { source: 'proposal-interest', status: requested.interest.status }
        }, context, database);
      }
      sendJson(res, requested.created ? 201 : 200, { ok: true, interest: requested.interest });
    } catch (error) {
      sendJson(res, Number(error.status) || 500, {
        ok: false,
        message: Number(error.status) >= 400 && Number(error.status) < 500
          ? error.message
          : 'Nao foi possivel registrar o pedido de contato.'
      });
    }
    return true;
  }

  if (pathname === '/api/proposal-snapshots') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res);
    if (!context) return true;
    if (!proposalShareService) {
      sendJson(res, 503, { ok: false, message: 'Compartilhamento seguro indisponivel.' });
      return true;
    }
    const body = await readJsonObject(req);
    const snapshot = await proposalShareService.createSnapshot({
      proposalId: body.proposalId,
      engineVersion: body.engineVersion,
      dataBase: body.dataBase,
      project: body.project,
      result: body.result,
      review: body.review || {},
      provenance: {
        ...(body.provenance && typeof body.provenance === 'object' ? body.provenance : {}),
        source: 'server-api',
        actorId: context.user.id
      }
    }, { ownerId: context.user.id });
    await recordApiEvent('proposal-snapshot-created', {
      ownerEmail: context.user.email,
      entityType: 'proposal-snapshot',
      entityId: snapshot.id,
      payload: {
        version: snapshot.version,
        status: snapshot.status,
        engineVersion: snapshot.engineVersion,
        dataBase: snapshot.dataBase
      }
    }, context);
    sendJson(res, 201, { ok: true, snapshot });
    return true;
  }

  const proposalSnapshotMatch = pathname.match(/^\/api\/proposal-snapshots\/([^/]+)$/);
  if (proposalSnapshotMatch) {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res);
    if (!context) return true;
    if (!proposalShareService) {
      sendJson(res, 503, { ok: false, message: 'Compartilhamento seguro indisponivel.' });
      return true;
    }
    const snapshot = await proposalShareService.getSnapshot(
      decodeURIComponent(proposalSnapshotMatch[1]),
      { ownerId: context.user.id }
    );
    sendJson(res, 200, { ok: true, snapshot });
    return true;
  }

  const proposalTransitionMatch = pathname.match(/^\/api\/proposal-snapshots\/([^/]+)\/transitions$/);
  if (proposalTransitionMatch) {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['admin', 'consultor']);
    if (!context) return true;
    if (!proposalShareService) {
      sendJson(res, 503, { ok: false, message: 'Compartilhamento seguro indisponivel.' });
      return true;
    }
    const body = await readJsonObject(req);
    const snapshot = await proposalShareService.transitionSnapshot(
      decodeURIComponent(proposalTransitionMatch[1]),
      body.status,
      {
        review: body.review,
        provenance: {
          ...(body.provenance && typeof body.provenance === 'object' ? body.provenance : {}),
          actorId: context.user.id
        }
      },
      { ownerId: context.user.id }
    );
    await recordApiEvent('proposal-snapshot-transitioned', {
      ownerEmail: context.user.email,
      entityType: 'proposal-snapshot',
      entityId: snapshot.id,
      payload: {
        version: snapshot.version,
        status: snapshot.status,
        parentSnapshotId: snapshot.parentSnapshotId
      }
    }, context);
    sendJson(res, 201, { ok: true, snapshot });
    return true;
  }

  const proposalPublishMatch = pathname.match(/^\/api\/proposal-snapshots\/([^/]+)\/publish$/);
  if (proposalPublishMatch) {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['admin', 'consultor']);
    if (!context) return true;
    if (!proposalShareService) {
      sendJson(res, 503, { ok: false, message: 'Compartilhamento seguro indisponivel.' });
      return true;
    }
    const body = await readJsonObject(req);
    const publication = await proposalShareService.publish(
      decodeURIComponent(proposalPublishMatch[1]),
      { validityDays: body.validityDays },
      { ownerId: context.user.id }
    );
    await recordApiEvent('proposal-share-published', {
      ownerEmail: context.user.email,
      entityType: 'proposal-share',
      entityId: publication.share.id,
      payload: {
        snapshotId: publication.share.snapshotId,
        status: publication.share.status,
        expiresAt: publication.share.expiresAt
      }
    }, context);
    sendJson(res, 201, { ok: true, ...publication });
    return true;
  }

  const proposalShareRevokeMatch = pathname.match(/^\/api\/proposal-shares\/([^/]+)\/revoke$/);
  if (proposalShareRevokeMatch) {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['admin', 'consultor']);
    if (!context) return true;
    if (!proposalShareService) {
      sendJson(res, 503, { ok: false, message: 'Compartilhamento seguro indisponivel.' });
      return true;
    }
    const share = await proposalShareService.revoke(
      decodeURIComponent(proposalShareRevokeMatch[1]),
      { ownerId: context.user.id }
    );
    await recordApiEvent('proposal-share-revoked', {
      ownerEmail: context.user.email,
      entityType: 'proposal-share',
      entityId: share.id,
      payload: { snapshotId: share.snapshotId, status: share.status, revokedAt: share.revokedAt }
    }, context);
    sendJson(res, 200, { ok: true, share });
    return true;
  }

  if (pathname === '/api/auth/login') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) {
      sendJson(res, 415, { ok: false, code: 'JSON_REQUIRED', message: 'Envie os dados de acesso em JSON.' });
      return true;
    }
    const body = await readJsonObject(req, 4096);
    const email = String(body.email || '').trim().toLowerCase();
    const password = String(body.password === undefined || body.password === null ? '' : body.password);
    const database = await getDatabase();
    if (!database) {
      sendJson(res, 503, { ok: false, message: 'Acesso temporariamente indisponivel.' });
      return true;
    }
    pruneLoginGuards();
    const guardEntries = loginGuardEntries(req, email);
    if (isLoginBlocked(guardEntries)) {
      rejectLoginRateLimited(res);
      return true;
    }
    if (!hasLoginGuardCapacity(guardEntries)) {
      rejectLoginRateLimited(res, 'AUTH_RATE_LIMIT_CAPACITY');
      return true;
    }

    const payloadValid = email.length > 0
      && email.length <= AUTH_LOGIN_MAX_EMAIL_CHARS
      && password.length > 0
      && password.length <= AUTH_LOGIN_MAX_PASSWORD_CHARS;
    const demoIdentityBlocked = AUTH_MODE === 'production' && email.endsWith(AUTH_DEMO_EMAIL_SUFFIX);
    const databaseResult = await database.login(
      payloadValid && !demoIdentityBlocked ? email : '',
      payloadValid ? password : ''
    );
    const result = demoIdentityBlocked
      ? { ok: false, status: 401, message: 'E-mail ou senha invalidos.' }
      : databaseResult;
    if (result.ok) {
      clearLoginFailure(guardEntries);
      await recordApiEvent('auth-login', {
        ownerEmail: result.user.email,
        actorEmail: result.user.email,
        entityType: 'user',
        entityId: result.user.id,
        payload: { role: result.user.role, passwordChangeRequired: result.user.mustChangePassword === true }
      }, { user: result.user, session: result.session });
      const response = {
        ok: true,
        status: 200,
        user: result.user,
        passwordChangeRequired: result.user.mustChangePassword === true,
        session: AUTH_MODE === 'production' ? publicSession(result.session) : result.session
      };
      const headers = AUTH_MODE === 'production' ? { 'Set-Cookie': authCookie(result.session.token) } : {};
      sendJson(res, 200, response, headers);
    } else {
      if (!registerLoginFailure(guardEntries)) {
        rejectLoginRateLimited(res, 'AUTH_RATE_LIMIT_CAPACITY');
        return true;
      }
      await recordApiEvent('auth-login-failed', {
        entityType: 'authentication',
        entityId: loginGuardKey('account', email).slice(0, 24),
        payload: { reason: demoIdentityBlocked ? 'demo-identity-disabled' : 'credentials-rejected' }
      }, null, database);
      sendJson(res, 401, { ok: false, status: 401, message: 'E-mail ou senha invalidos.' });
    }
    return true;
  }

  if (pathname === '/api/auth/logout') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await authContext(req);
    const database = await getDatabase();
    const revoked = database ? await database.revokeToken(sessionToken(req)) : false;
    if (context && context.user) {
      await recordApiEvent('auth-logout', {
        ownerEmail: context.user.email,
        entityType: 'user',
        entityId: context.user.id
      }, context);
    }
    const headers = AUTH_MODE === 'production' ? { 'Set-Cookie': clearAuthCookie() } : {};
    sendJson(res, 200, { ok: true, revoked }, headers);
    return true;
  }

  if (pathname === '/api/auth/me') {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, [], { allowPasswordChangePending: true });
    if (!context) return true;
    sendJson(res, 200, {
      ok: true,
      user: context.user,
      passwordChangeRequired: context.user.mustChangePassword === true,
      session: publicSession(context.session)
    });
    return true;
  }

  if (pathname === '/api/auth/change-password') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    if (!/^application\/json(?:\s*;|\s*$)/i.test(String(req.headers['content-type'] || ''))) {
      sendJson(res, 415, { ok: false, code: 'JSON_REQUIRED', message: 'Envie a troca de senha em JSON.' });
      return true;
    }
    const context = await requireAuth(req, res, [], { allowPasswordChangePending: true });
    if (!context) return true;
    const body = await readJsonObject(req, 4096);
    const currentPassword = String(body.currentPassword === undefined || body.currentPassword === null ? '' : body.currentPassword);
    const nextPassword = String(body.newPassword === undefined || body.newPassword === null ? '' : body.newPassword);
    const policy = validateProductivePassword(nextPassword, context.user);
    if (!policy.ok) {
      sendJson(res, statusFromResult(policy, 400), policy);
      return true;
    }
    const database = await getDatabase();
    const result = await database.changePassword(context.user.id, currentPassword, nextPassword);
    if (result.ok) {
      await recordApiEvent('auth-password-changed', {
        ownerEmail: result.user.email,
        entityType: 'user',
        entityId: result.user.id,
        payload: { sessionsRotated: true }
      }, { user: result.user, session: result.session }, database);
      const response = {
        ok: true,
        status: 200,
        user: result.user,
        passwordChangeRequired: false,
        session: AUTH_MODE === 'production' ? publicSession(result.session) : result.session,
        message: result.message
      };
      const headers = AUTH_MODE === 'production' ? { 'Set-Cookie': authCookie(result.session.token) } : {};
      sendJson(res, 200, response, headers);
    } else {
      sendJson(res, statusFromResult(result, 400), result);
    }
    return true;
  }

  if (pathname === '/api/auth/logout-all') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, [], { allowPasswordChangePending: true });
    if (!context) return true;
    const database = await getDatabase();
    const revoked = await database.revokeUserSessions(context.user.id);
    await recordApiEvent('auth-logout-all', {
      ownerEmail: context.user.email,
      entityType: 'user',
      entityId: context.user.id,
      payload: { revokedSessions: revoked }
    }, context, database);
    const headers = AUTH_MODE === 'production' ? { 'Set-Cookie': clearAuthCookie() } : {};
    sendJson(res, 200, { ok: true, revoked }, headers);
    return true;
  }

  if (pathname === '/api/database/status') {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['admin']);
    if (!context) return true;
    sendJson(res, 200, await localDatabase.databaseStatus());
    return true;
  }

  if (pathname === '/api/database/import-local') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res, ['admin']);
    if (!context) return true;
    const body = await readJsonBody(req);
    if (AUTH_MODE === 'production' && body.dryRun === false && Array.isArray(body.users) && body.users.length > 0) {
      sendJson(res, 409, {
        ok: false,
        code: 'PRODUCTIVE_USER_MIGRATION_REQUIRES_PROVISIONING',
        message: 'Migre os dados da jornada sem usuarios. O provisionamento de acessos produtivos exige credenciais individuais.'
      });
      return true;
    }
    const result = await localDatabase.importLocalSnapshot(body, {
      dryRun: body.dryRun !== false,
      actorEmail: context.user.email
    });
    if (!result.dryRun) {
      await recordApiEvent('local-storage-import', {
        ownerEmail: context.user.email,
        entityType: 'database',
        entityId: 'local-storage-import',
        payload: {
          usersImported: result.users.imported,
          eventsImported: result.events.imported,
          snapshotsCreated: result.snapshots ? result.snapshots.created : 0,
          snapshotsUpdated: result.snapshots ? result.snapshots.updated : 0,
          usersSkippedExisting: result.users.skippedExisting,
          eventsSkippedExisting: result.events.skippedExisting,
          source: result.source
        }
      }, context);
    }
    if (AUTH_MODE === 'production') {
      delete result.temporaryPassword;
      result.users.passwordProvisioning = 'required';
    }
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === '/api/snapshots') {
    if (req.method === 'POST') {
      const context = await requireAuth(req, res);
      if (!context) return true;
      const requestedBody = await readJsonBody(req);
      const requestedSnapshotType = String(requestedBody.type || '').trim().toLowerCase();
      const requestedSnapshotPayload = proposalInterestObject(requestedBody.payload || requestedBody.details);
      const requestedSnapshotTargetId = proposalInterestText(
        requestedBody.entityId
          || requestedSnapshotPayload.id
          || requestedSnapshotPayload.handoffId
          || requestedBody.id,
        160
      );
      const existingSnapshotTargetLead = requestedSnapshotType === 'handoff' && requestedSnapshotTargetId
        ? await database.findMaterializedJourneyRow('lead', requestedSnapshotTargetId)
        : null;
      if (
        requestedSnapshotType === 'handoff'
        && (
          attemptsReservedProposalInterestLead(requestedSnapshotPayload)
          || /^LEAD-PI-/i.test(requestedSnapshotTargetId)
          || isProposalInterestLead(existingSnapshotTargetLead)
        )
      ) {
        sendJson(res, 403, { ok: false, message: 'Pedidos originados por propostas usam o fluxo comercial protegido.' });
        return true;
      }
      if (context.user.role === 'cliente' && requestedSnapshotType === 'handoff') {
        sendJson(res, 403, { ok: false, message: 'Perfil sem permissao para operar o atendimento consultivo.' });
        return true;
      }
      const body = context.user.role === 'cliente'
        ? sanitizeClientSnapshotPayload(requestedBody)
        : requestedBody;
      const ownerEmail = context.user.role === 'admin'
        ? body.ownerEmail
        : context.user.email;
      const result = await localDatabase.upsertSnapshot({
        id: body.id,
        type: body.type,
        source: body.source || 'browser',
        ownerEmail,
        actorEmail: context.user.email,
        entityId: body.entityId,
        title: body.title,
        status: body.status,
        storageKey: body.storageKey,
        payload: body.payload || body.details || {},
        createdAt: body.createdAt,
        updatedAt: body.updatedAt
      });
      if (!result || result.ok === false) {
        sendJson(res, statusFromResult(result, 409), result || { ok: false, message: 'Snapshot nao pode ser salvo.' });
        return true;
      }
      await recordApiEvent(result.created ? 'snapshot-created' : 'snapshot-updated', {
        ownerEmail: result.snapshot.ownerEmail,
        entityType: 'snapshot',
        entityId: result.snapshot.id,
        payload: {
          type: result.snapshot.type,
          source: result.snapshot.source,
          status: result.snapshot.status
        }
      }, context);
      sendJson(res, result.created ? 201 : 200, { ok: true, ...result });
      return true;
    }

    if (req.method === 'GET') {
      const context = await requireAuth(req, res);
      if (!context) return true;
      const limit = Number(parsedUrl.searchParams.get('limit') || 100);
      const type = parsedUrl.searchParams.get('type') || '';
      const isAdmin = context.user.role === 'admin';
      const options = {
        limit,
        type,
        ownerEmail: isAdmin ? '' : context.user.email
      };
      sendJson(res, 200, {
        ok: true,
        scope: isAdmin ? 'all' : 'own',
        snapshots: await localDatabase.listSnapshots(options)
      });
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  if (pathname === '/api/journey-entities') {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res);
    if (!context) return true;
    const limit = Number(parsedUrl.searchParams.get('limit') || 100);
    const kind = parsedUrl.searchParams.get('kind') || '';
    const isAdmin = context.user.role === 'admin';
    const options = {
      limit,
      kind,
      ownerEmail: isAdmin ? '' : context.user.email
    };
    sendJson(res, 200, {
      ok: true,
      scope: isAdmin ? 'all' : 'own',
      summary: await localDatabase.journeyEntitySummary(options),
      entities: await localDatabase.listJourneyEntities(options)
    });
    return true;
  }

  const materializedRoutes = {
    '/api/leads': { kind: 'lead', key: 'leads', singular: 'lead', list: 'listLeads', segment: 'leads' },
    '/api/simulations': { kind: 'simulation', key: 'simulations', singular: 'simulation', list: 'listSimulations', segment: 'simulations' },
    '/api/proposals': { kind: 'proposal', key: 'proposals', singular: 'proposal', list: 'listProposals', segment: 'proposals' }
  };
  if (materializedRoutes[pathname]) {
    const context = await requireAuth(req, res);
    if (!context) return true;
    const route = materializedRoutes[pathname];
    const isAdmin = context.user.role === 'admin';
    if (route.kind === 'lead' && req.method === 'POST' && context.user.role === 'cliente') {
      sendJson(res, 403, { ok: false, message: 'Perfil sem permissao para operar leads.' });
      return true;
    }

    if (req.method === 'GET') {
      const limit = Number(parsedUrl.searchParams.get('limit') || 100);
      const options = {
        limit,
        ownerEmail: isAdmin ? '' : context.user.email
      };
      sendJson(res, 200, {
        ok: true,
        scope: isAdmin ? 'all' : 'own',
        kind: route.kind,
        [route.key]: await localDatabase[route.list](options)
      });
      return true;
    }

    if (req.method === 'POST') {
      const requestedBody = await readJsonBody(req);
      if (route.kind === 'lead' && attemptsReservedProposalInterestLead(requestedBody)) {
        sendJson(res, 403, { ok: false, message: 'Pedidos originados por propostas usam o fluxo comercial protegido.' });
        return true;
      }
      const body = context.user.role === 'cliente' && ['simulation', 'proposal'].includes(route.kind)
        ? sanitizeClientJourneyPayload(route.kind, requestedBody)
        : requestedBody;
      const ownerEmail = isAdmin
        ? (body.ownerEmail || body.owner_email || context.user.email)
        : context.user.email;
      const result = await localDatabase.upsertDirectJourneyRow(route.kind, {
        ...body,
        ownerEmail,
        actorEmail: context.user.email,
        source: body.source || 'direct-api'
      });
      const record = result[route.singular] || result.record;
      if (result.ok && record) {
        await recordApiEvent(`${route.kind}-direct-${result.created ? 'created' : 'updated'}`, {
          ownerEmail: record.ownerEmail,
          entityType: route.kind,
          entityId: record.id,
          payload: {
            status: record.status,
            stage: record.stage,
            priority: record.priority,
            source: record.source
          }
        }, context);
      }
      sendJson(res, statusFromResult(result, result.created ? 201 : 200), result);
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  const materializedItemMatch = pathname.match(/^\/api\/(leads|simulations|proposals)\/([^/]+)$/);
  if (materializedItemMatch) {
    const route = Object.values(materializedRoutes).find((item) => item.segment === materializedItemMatch[1]);
    if (!route) {
      notFoundJson(res);
      return true;
    }
    const context = await requireAuth(req, res);
    if (!context) return true;
    const id = decodeURIComponent(materializedItemMatch[2]);
    const isAdmin = context.user.role === 'admin';
    const existing = await localDatabase.findMaterializedJourneyRow(route.kind, id);
    let assignedProposalInterestAccess = false;
    let proposalInterestReviewRequested = false;
    if (
      existing
      && route.kind === 'simulation'
      && req.method === 'GET'
      && ['consultor', 'admin'].includes(context.user.role)
    ) {
      proposalInterestReviewRequested = parsedUrl.searchParams.has('interestId');
      if (proposalInterestReviewRequested) {
        const interestId = proposalInterestSystemId(parsedUrl.searchParams.get('interestId'), 'LEAD');
        const interest = interestId
          ? await localDatabase.findMaterializedJourneyRow('lead', interestId, isAdmin ? {} : { ownerEmail: context.user.email })
          : null;
        assignedProposalInterestAccess = isAdmin
          ? proposalInterestLeadLinksSimulation(interest, existing)
          : proposalInterestLeadAllowsSimulation(interest, existing, context.user.email);
      }
    }
    if (
      !existing
      || (proposalInterestReviewRequested && !assignedProposalInterestAccess)
      || (!isAdmin && existing.ownerEmail !== context.user.email && !assignedProposalInterestAccess)
    ) {
      sendJson(res, 404, { ok: false, message: 'Registro de jornada nao encontrado.' });
      return true;
    }

    if (req.method === 'GET') {
      const crossOwnerRead = route.kind === 'simulation' && existing.ownerEmail !== context.user.email;
      const protectedResumeRead = crossOwnerRead || assignedProposalInterestAccess;
      const responseRecord = protectedResumeRead
        ? {
            id: proposalInterestSystemId(existing.id, 'SIM'),
            payload: proposalInterestSanitizeResumePayload(existing.payload)
          }
        : existing;
      sendJson(res, 200, {
        ok: true,
        scope: isAdmin ? 'all' : (assignedProposalInterestAccess ? 'assigned-proposal-interest' : 'own'),
        readOnly: protectedResumeRead,
        kind: route.kind,
        [route.singular]: responseRecord
      });
      return true;
    }

    if (req.method === 'PATCH') {
      if (route.kind === 'lead' && context.user.role === 'cliente') {
        sendJson(res, 403, { ok: false, message: 'Perfil sem permissao para operar leads.' });
        return true;
      }
      const requestedBody = await readJsonBody(req);
      if (route.kind === 'lead' && attemptsReservedProposalInterestLead(requestedBody) && !isProposalInterestLead(existing)) {
        sendJson(res, 403, { ok: false, message: 'Pedidos originados por propostas usam o fluxo comercial protegido.' });
        return true;
      }
      const scopedBody = route.kind === 'lead'
        ? preserveProposalInterestLeadIdentity(requestedBody, existing)
        : requestedBody;
      const body = context.user.role === 'cliente' && ['simulation', 'proposal'].includes(route.kind)
        ? sanitizeClientJourneyPayload(route.kind, scopedBody, existing)
        : scopedBody;
      const ownerEmail = isAdmin
        ? (body.ownerEmail || body.owner_email || existing.ownerEmail || context.user.email)
        : context.user.email;
      const result = await localDatabase.upsertDirectJourneyRow(route.kind, {
        ...body,
        id,
        ownerEmail,
        actorEmail: context.user.email,
        source: body.source || existing.source || 'direct-api'
      });
      const record = result[route.singular] || result.record;
      if (result.ok && record) {
        await recordApiEvent(`${route.kind}-direct-updated`, {
          ownerEmail: record.ownerEmail,
          entityType: route.kind,
          entityId: record.id,
          payload: {
            status: record.status,
            stage: record.stage,
            priority: record.priority,
            source: record.source
          }
        }, context);
      }
      sendJson(res, statusFromResult(result), result);
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  if (pathname === '/api/users') {
    const context = await requireAuth(req, res, ['admin']);
    if (!context) return true;

    if (req.method === 'GET') {
      sendJson(res, 200, { ok: true, users: await localDatabase.listUsers() });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      if (AUTH_MODE === 'production') {
        const policy = validateProductivePassword(body.password, body);
        if (!policy.ok) {
          sendJson(res, statusFromResult(policy, 400), policy);
          return true;
        }
        body.mustChangePassword = true;
      }
      const result = await localDatabase.createUser(body);
      if (result.ok) {
        await recordApiEvent('user-created', {
          ownerEmail: result.user.email,
          entityType: 'user',
          entityId: result.user.id,
          payload: { role: result.user.role, status: result.user.status }
        }, context);
      }
      sendJson(res, statusFromResult(result, 201), result);
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  const userMatch = pathname.match(/^\/api\/users\/([^/]+)(?:\/(password|status))?$/);
  if (userMatch) {
    const context = await requireAuth(req, res, ['admin']);
    if (!context) return true;
    const id = decodeURIComponent(userMatch[1]);
    const action = userMatch[2] || '';

    if (!action && req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const currentUserRecord = await localDatabase.findPublicUser(id);
      const nextRole = String(body.role || (currentUserRecord && currentUserRecord.role) || '');
      const nextStatus = String(body.status || (currentUserRecord && currentUserRecord.status) || '');
      const removesAdminAccess = currentUserRecord
        && currentUserRecord.role === 'admin'
        && currentUserRecord.status === 'active'
        && (nextRole !== 'admin' || nextStatus !== 'active');
      if (context.user.id === id && removesAdminAccess) {
        sendJson(res, 400, { ok: false, message: 'Mantenha seu acesso administrador ativo nesta sessao.' });
        return true;
      }
      if (AUTH_MODE === 'production' && body.password) {
        const policy = validateProductivePassword(body.password, { ...currentUserRecord, ...body });
        if (!policy.ok) {
          sendJson(res, statusFromResult(policy, 400), policy);
          return true;
        }
        body.mustChangePassword = true;
      }
      const result = await localDatabase.updateUser(id, body);
      if (result.ok) {
        await recordApiEvent('user-updated', {
          ownerEmail: result.user.email,
          entityType: 'user',
          entityId: result.user.id,
          payload: { role: result.user.role, status: result.user.status }
        }, context);
      }
      sendJson(res, statusFromResult(result), result);
      return true;
    }

    if (!action && req.method === 'DELETE') {
      if (context.user.id === id) {
        sendJson(res, 400, { ok: false, message: 'Nao e possivel excluir o usuario em sessao.' });
        return true;
      }
      if (!proposalShareRepository || typeof proposalShareRepository.hasOwnerRecords !== 'function') {
        sendJson(res, 503, { ok: false, message: 'Nao foi possivel validar os vinculos de proposta deste usuario.' });
        return true;
      }
      if (await proposalShareRepository.hasOwnerRecords(id)) {
        sendJson(res, 409, {
          ok: false,
          code: 'BANCUS_USER_HAS_RELATED_RECORDS',
          message: 'Este usuario possui historico vinculado. Inative o acesso em vez de excluir.'
        });
        return true;
      }
      const publicUser = await localDatabase.findPublicUser(id);
      const result = await localDatabase.deleteUser(id);
      if (result.ok) {
        await recordApiEvent('user-deleted', {
          ownerEmail: publicUser ? publicUser.email : '',
          entityType: 'user',
          entityId: id
        }, context);
      }
      sendJson(res, statusFromResult(result), result);
      return true;
    }

    if (action === 'password' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const publicUser = await localDatabase.findPublicUser(id);
      if (AUTH_MODE === 'production') {
        const policy = validateProductivePassword(body.password, publicUser || {});
        if (!policy.ok) {
          sendJson(res, statusFromResult(policy, 400), policy);
          return true;
        }
      }
      const result = await localDatabase.setPassword(id, body.password, {
        mustChangePassword: AUTH_MODE === 'production'
      });
      if (result.ok) {
        await recordApiEvent('user-password-reset', {
          ownerEmail: publicUser ? publicUser.email : '',
          entityType: 'user',
          entityId: id
        }, context);
      }
      sendJson(res, statusFromResult(result), result);
      return true;
    }

    if (action === 'status' && req.method === 'POST') {
      if (context.user.id === id) {
        sendJson(res, 400, { ok: false, message: 'Nao e possivel inativar o usuario em sessao.' });
        return true;
      }
      const body = await readJsonBody(req);
      const requestedStatus = String(body.status === undefined || body.status === null ? '' : body.status).trim();
      if (!databaseContract.STATUS_LABELS[requestedStatus]) {
        sendJson(res, 400, { ok: false, message: 'Informe um status de usuario valido.' });
        return true;
      }
      const result = await localDatabase.setUserStatus(id, requestedStatus);
      if (result.ok) {
        await recordApiEvent('user-status-changed', {
          ownerEmail: result.user.email,
          entityType: 'user',
          entityId: result.user.id,
          payload: { status: result.user.status }
        }, context);
      }
      sendJson(res, statusFromResult(result), result);
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  if (pathname === '/api/events') {
    if (req.method === 'POST') {
      const context = await requireAuth(req, res);
      if (!context) return true;
      const body = await readJsonBody(req);
      const requestedType = String(body.type || '').trim().toLowerCase();
      const reservedEvent = /^(auth|user|database|server|proposal(?:-share)?)(?:$|[:_-])/.test(requestedType);
      if (!requestedType || requestedType.length > 80 || !/^[a-z0-9][a-z0-9:_-]*$/.test(requestedType) || reservedEvent) {
        sendJson(res, 400, { ok: false, code: 'EVENT_TYPE_REJECTED', message: 'Tipo de evento nao autorizado.' });
        return true;
      }
      const ownerEmail = context.user.role === 'admin'
        ? (body.ownerEmail || context.user.email)
        : context.user.email;
      const event = await localDatabase.recordEvent({
        type: requestedType,
        source: 'browser',
        ownerEmail,
        actorEmail: context.user.email,
        sessionId: context.session.id,
        entityType: body.entityType,
        entityId: body.entityId,
        payload: body.payload || body.details || {}
      });
      sendJson(res, 201, { ok: true, event });
      return true;
    }

    if (req.method === 'GET') {
      const context = await requireAuth(req, res, ['admin']);
      if (!context) return true;
      const limit = Number(parsedUrl.searchParams.get('limit') || 100);
      sendJson(res, 200, { ok: true, events: await localDatabase.listEvents({ limit }) });
      return true;
    }

    methodNotAllowed(res);
    return true;
  }

  notFoundJson(res);
  return true;
}

async function handleRequest(req, res) {
  if (await handleApiRequest(req, res)) return;

  if ((req.url || '').split('?')[0] === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = resolveRequestPath(req.url);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      const message = status === 404 ? 'Arquivo nao encontrado' : `Erro interno: ${error.code}`;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
      return;
    }

    const extname = path.extname(filePath).toLowerCase();
    const relativePath = path.relative(ROOT_DIR, filePath).replace(/\\/g, '/').toLowerCase();
    const publicProposalPage = relativePath === 'pages/proposta.html';
    const loginPage = relativePath === 'pages/login.html';
    let responseContent = content;
    if (loginPage && AUTH_MODE === 'production') {
      responseContent = Buffer.from(
        responseContent.toString('utf8').replace(/\s*<!-- AUTH_DEMO_START -->[\s\S]*?<!-- AUTH_DEMO_END -->\s*/g, '\n'),
        'utf8'
      );
    }
    if (extname === '.html' && AUTH_MODE === 'production') {
      responseContent = Buffer.from(
        responseContent.toString('utf8').replace(/<body(?![^>]*\bdata-auth-mode=)/i, '<body data-auth-mode="production"'),
        'utf8'
      );
    }
    const headers = {
      'Content-Type': MIME_TYPES[extname] || 'application/octet-stream',
      'X-Content-Type-Options': 'nosniff',
      'Referrer-Policy': 'same-origin'
    };
    if (extname === '.html') headers['X-Frame-Options'] = 'DENY';
    if (loginPage) {
      Object.assign(headers, {
        'Cache-Control': 'no-store, max-age=0',
        'Referrer-Policy': 'no-referrer',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' https://fonts.googleapis.com; font-src https://fonts.gstatic.com; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'"
      });
    }
    if (publicProposalPage) {
      Object.assign(headers, {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
      });
    }
    res.writeHead(200, headers);
    res.end(responseContent);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const status = Number(error.status) || 500;
    if ((req.url || '').startsWith('/api/')) {
      const rawCode = String(error && error.code ? error.code : '');
      const publicCode = status === 500
        ? 'BANCUS_INTERNAL_ERROR'
        : (/^[A-Z0-9_:-]{3,80}$/.test(rawCode) ? rawCode : 'BANCUS_REQUEST_REJECTED');
      sendJson(res, status, {
        ok: false,
        code: publicCode,
        message: status === 500 ? 'Erro interno da API local.' : error.message
      });
      return;
    }
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 500 ? 'Erro interno da aplicacao local.' : error.message);
  });
});

function startServer(options = {}) {
  const requestedPort = options.port === 0 ? 0 : Number(options.port);
  const port = Number.isFinite(requestedPort) ? requestedPort : PORT;
  const host = String(options.host || process.env.BANCUS_HOST || DEFAULT_HOST).trim() || DEFAULT_HOST;
  const loopbackHost = ['127.0.0.1', '::1', 'localhost'].includes(host.toLowerCase());
  if (AUTH_MODE === 'demo' && !loopbackHost) {
    throw new Error('O modo demo so pode escutar em loopback. Use BANCUS_AUTH_MODE=production para outro host.');
  }
  if (AUTH_MODE === 'production' && !AUTH_COOKIE_SECURE && !loopbackHost) {
    throw new Error('Cookie de autenticacao sem Secure so e permitido em loopback.');
  }
  if (server.listening) return server;
  server.listen(port, host, () => {
    const address = server.address();
    const activePort = address && typeof address === 'object' ? address.port : port;
    const displayHost = ['127.0.0.1', '::1'].includes(host) ? 'localhost' : host;
    console.log(`Bancus Fraternis server running at http://${displayHost}:${activePort}/pages/index.html`);
    console.log(`Authentication mode: ${AUTH_MODE} (${AUTH_MODE === 'production' ? 'httpOnly cookie' : 'local demo'})`);
    databaseReady.then((database) => {
      if (database) console.log(`Database ready: ${SCHEMA_VERSION} (${database.provider})`);
    });
    proposalShareReady.then(() => {
      if (proposalShareRepository) {
        console.log(`Secure proposal share ready: ${PROPOSAL_SHARE_SCHEMA} (${proposalShareRepository.provider})`);
      }
    });
  });
  return server;
}

async function closeInfrastructure() {
  await proposalShareReady;
  const closeTasks = [];
  if (proposalShareRepository) {
    closeTasks.push(Promise.resolve(proposalShareRepository.close()));
    proposalShareRepository = null;
    proposalShareService = null;
  }
  if (localDatabase) {
    closeTasks.push(Promise.resolve(localDatabase.close()));
    localDatabase = null;
  }
  return Promise.all(closeTasks);
}

if (require.main === module) startServer();

module.exports = {
  server,
  startServer,
  handleRequest,
  handleApiRequest,
  sendPublicShareJson,
  recordApiEvent,
  authLoginGuardStats,
  closeInfrastructure
};
