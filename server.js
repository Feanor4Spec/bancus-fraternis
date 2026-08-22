const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const DEFAULT_HOST = '127.0.0.1';
const ROOT_DIR = __dirname;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
let localDatabase = null;
let SCHEMA_VERSION = 'bancus-fraternis.local-db.v1';
let databaseReady = Promise.resolve(null);
let databaseStartupError = null;
let requestedDatabaseProvider = String(process.env.BANCUS_DB_PROVIDER || 'sqlite').trim().toLowerCase() || 'sqlite';
let proposalShareRepository = null;
let proposalShareService = null;
let proposalShareReady = Promise.resolve(null);
let proposalShareStartupError = null;
let PROPOSAL_SHARE_SCHEMA = 'bancus.proposal-secure-share.v1';

try {
  const databaseModule = require('./js/backend/db');
  SCHEMA_VERSION = databaseModule.SCHEMA_VERSION;
  const { createDatabase } = databaseModule;
  requestedDatabaseProvider = databaseModule.normalizeDbProvider(requestedDatabaseProvider);
  databaseReady = Promise.resolve(createDatabase())
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

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
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

function readRequestBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let receivedBytes = 0;
    let settled = false;
    const onData = (chunk) => {
      if (settled) return;
      const buffer = Buffer.isBuffer(chunk) ? chunk : Buffer.from(String(chunk), 'utf8');
      receivedBytes += buffer.length;
      if (receivedBytes > MAX_JSON_BODY_BYTES) {
        settled = true;
        const payloadError = new Error('Payload excede o limite de 4 MiB.');
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

async function readJsonBody(req) {
  const body = await readRequestBody(req);
  if (!body.trim()) return {};
  try {
    return JSON.parse(body);
  } catch (error) {
    const parseError = new Error('JSON invalido.');
    parseError.status = 400;
    throw parseError;
  }
}

async function readJsonObject(req) {
  const body = await readJsonBody(req);
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

async function getDatabase() {
  if (localDatabase) return localDatabase;
  return databaseReady;
}

async function getProposalShareService() {
  if (proposalShareService) return proposalShareService;
  return proposalShareReady;
}

async function authContext(req) {
  const token = bearerToken(req);
  const database = await getDatabase();
  if (!token || !database) return null;
  return database.authenticateToken(token);
}

async function requireAuth(req, res, roles = []) {
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

async function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  if (!pathname.startsWith('/api/')) return false;

  if (pathname === '/api/health' && req.method === 'GET') {
    const database = await getDatabase();
    const shareService = await getProposalShareService();
    const databaseOk = Boolean(database);
    const proposalShareOk = Boolean(shareService);
    const readyOk = databaseOk && proposalShareOk;
    sendJson(res, readyOk ? 200 : 503, {
      ok: readyOk,
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

  if (pathname === '/api/public/proposals/resolve') {
    if (req.method !== 'POST') {
      sendPublicShareJson(res, 405, { ok: false, readOnly: true, message: 'Metodo nao permitido.' });
      return true;
    }
    const shareService = await getProposalShareService();
    if (!shareService) {
      sendPublicShareJson(res, 503, { ok: false, readOnly: true, message: 'Compartilhamento indisponivel.' });
      return true;
    }
    try {
      const body = await readJsonObject(req);
      const proposal = await shareService.resolve(body.token);
      sendPublicShareJson(res, 200, { ok: true, ...proposal });
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
    const context = await requireAuth(req, res);
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
    const context = await requireAuth(req, res);
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
    const context = await requireAuth(req, res);
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
    const body = await readJsonBody(req);
    const result = await localDatabase.login(body.email, body.password);
    if (result.ok) {
      await recordApiEvent('auth-login', {
        ownerEmail: result.user.email,
        actorEmail: result.user.email,
        entityType: 'user',
        entityId: result.user.id,
        payload: { role: result.user.role }
      }, { user: result.user, session: result.session });
    } else {
      await recordApiEvent('auth-login-failed', {
        ownerEmail: body.email,
        actorEmail: body.email,
        entityType: 'user',
        payload: { reason: result.message }
      });
    }
    sendJson(res, statusFromResult(result, result.ok ? 200 : 401), result);
    return true;
  }

  if (pathname === '/api/auth/logout') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = await authContext(req);
    const revoked = await localDatabase.revokeToken(bearerToken(req));
    if (context && context.user) {
      await recordApiEvent('auth-logout', {
        ownerEmail: context.user.email,
        entityType: 'user',
        entityId: context.user.id
      }, context);
    }
    sendJson(res, 200, { ok: true, revoked });
    return true;
  }

  if (pathname === '/api/auth/me') {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = await requireAuth(req, res);
    if (!context) return true;
    sendJson(res, 200, { ok: true, user: context.user, session: context.session });
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
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === '/api/snapshots') {
    if (req.method === 'POST') {
      const context = await requireAuth(req, res);
      if (!context) return true;
      const body = await readJsonBody(req);
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
      const body = await readJsonBody(req);
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
    if (!existing || (!isAdmin && existing.ownerEmail !== context.user.email)) {
      sendJson(res, 404, { ok: false, message: 'Registro de jornada nao encontrado.' });
      return true;
    }

    if (req.method === 'GET') {
      sendJson(res, 200, {
        ok: true,
        scope: isAdmin ? 'all' : 'own',
        kind: route.kind,
        [route.singular]: existing
      });
      return true;
    }

    if (req.method === 'PATCH') {
      const body = await readJsonBody(req);
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
      const result = await localDatabase.setPassword(id, body.password);
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
      const result = await localDatabase.setUserStatus(id, body.status);
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
      const ownerEmail = context.user.role === 'admin'
        ? (body.ownerEmail || context.user.email)
        : context.user.email;
      const event = await localDatabase.recordEvent({
        type: body.type,
        source: body.source || 'browser',
        ownerEmail,
        actorEmail: context.user.email,
        sessionId: context.session.id,
        entityType: body.entityType,
        entityId: body.entityId,
        payload: body.payload || body.details || {},
        createdAt: body.createdAt
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
    const headers = { 'Content-Type': MIME_TYPES[extname] || 'application/octet-stream' };
    if (publicProposalPage) {
      Object.assign(headers, {
        'Cache-Control': 'no-store, max-age=0',
        Pragma: 'no-cache',
        'X-Robots-Tag': 'noindex, nofollow, noarchive, nosnippet',
        'Referrer-Policy': 'no-referrer',
        'X-Content-Type-Options': 'nosniff',
        'X-Frame-Options': 'DENY',
        'Content-Security-Policy': "default-src 'self'; script-src 'self' https://cdn.jsdelivr.net; style-src 'self' 'unsafe-inline'; img-src 'self' data:; connect-src 'self'; font-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'"
      });
    }
    res.writeHead(200, headers);
    res.end(content);
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
  if (server.listening) return server;
  server.listen(port, host, () => {
    const address = server.address();
    const activePort = address && typeof address === 'object' ? address.port : port;
    const displayHost = ['127.0.0.1', '::1'].includes(host) ? 'localhost' : host;
    console.log(`Bancus Fraternis server running at http://${displayHost}:${activePort}/pages/index.html`);
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
  closeInfrastructure
};
