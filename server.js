const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const ROOT_DIR = __dirname;
const MAX_JSON_BODY_BYTES = 4 * 1024 * 1024;
let localDatabase = null;
let SCHEMA_VERSION = 'bancus-fraternis.local-db.v1';

try {
  const databaseModule = require('./js/backend/db');
  SCHEMA_VERSION = databaseModule.SCHEMA_VERSION;
  const { createDatabase } = databaseModule;
  localDatabase = createDatabase();
} catch (error) {
  console.warn(`Bancus Fraternis local database disabled: ${error.message}`);
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

function resolveRequestPath(reqUrl) {
  const rawPath = (reqUrl || '/').split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(rawPath);
  let relativePath = decodedPath === '/' ? '/pages/index.html' : decodedPath;
  const cleanName = relativePath.replace(/^\/+/, '');
  if (PAGE_ALIASES.has(cleanName)) {
    relativePath = `/pages/${cleanName}`;
  }
  const filePath = path.resolve(ROOT_DIR, `.${relativePath}`);

  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return filePath;
}

function sendJson(res, status, data) {
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store'
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
    let body = '';
    req.on('data', (chunk) => {
      body += chunk;
      if (body.length > MAX_JSON_BODY_BYTES) {
        reject(new Error('Payload excede o limite de 4MB.'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
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

function bearerToken(req) {
  const header = String(req.headers.authorization || '');
  return header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
}

function authContext(req) {
  const token = bearerToken(req);
  if (!token || !localDatabase) return null;
  return localDatabase.authenticateToken(token);
}

function requireAuth(req, res, roles = []) {
  const context = authContext(req);
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

function recordApiEvent(type, details, context) {
  if (!localDatabase) return null;
  return localDatabase.recordEvent({
    type,
    source: 'server-api',
    ownerEmail: details && details.ownerEmail ? details.ownerEmail : '',
    actorEmail: context && context.user ? context.user.email : (details && details.actorEmail ? details.actorEmail : ''),
    sessionId: context && context.session ? context.session.id : '',
    entityType: details && details.entityType ? details.entityType : '',
    entityId: details && details.entityId ? details.entityId : '',
    payload: details && details.payload ? details.payload : {}
  });
}

function statusFromResult(result, fallback = 200) {
  return Number(result && result.status) || fallback;
}

async function handleApiRequest(req, res) {
  const parsedUrl = new URL(req.url || '/', `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;
  if (!pathname.startsWith('/api/')) return false;

  if (pathname === '/api/health' && req.method === 'GET') {
    sendJson(res, 200, {
      ok: true,
      database: Boolean(localDatabase),
      schema: SCHEMA_VERSION,
      stats: localDatabase ? localDatabase.stats() : null
    });
    return true;
  }

  if (!localDatabase) {
    sendJson(res, 503, { ok: false, message: 'Banco local indisponivel neste runtime.' });
    return true;
  }

  if (pathname === '/api/auth/login') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const body = await readJsonBody(req);
    const result = localDatabase.login(body.email, body.password);
    if (result.ok) {
      recordApiEvent('auth-login', {
        ownerEmail: result.user.email,
        actorEmail: result.user.email,
        entityType: 'user',
        entityId: result.user.id,
        payload: { role: result.user.role }
      }, { user: result.user, session: result.session });
    } else {
      recordApiEvent('auth-login-failed', {
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
    const context = authContext(req);
    const revoked = localDatabase.revokeToken(bearerToken(req));
    if (context && context.user) {
      recordApiEvent('auth-logout', {
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
    const context = requireAuth(req, res);
    if (!context) return true;
    sendJson(res, 200, { ok: true, user: context.user, session: context.session });
    return true;
  }

  if (pathname === '/api/database/status') {
    if (req.method !== 'GET') {
      methodNotAllowed(res);
      return true;
    }
    const context = requireAuth(req, res, ['admin']);
    if (!context) return true;
    sendJson(res, 200, localDatabase.databaseStatus());
    return true;
  }

  if (pathname === '/api/database/import-local') {
    if (req.method !== 'POST') {
      methodNotAllowed(res);
      return true;
    }
    const context = requireAuth(req, res, ['admin']);
    if (!context) return true;
    const body = await readJsonBody(req);
    const result = localDatabase.importLocalSnapshot(body, {
      dryRun: body.dryRun !== false,
      actorEmail: context.user.email
    });
    if (!result.dryRun) {
      recordApiEvent('local-storage-import', {
        ownerEmail: context.user.email,
        entityType: 'database',
        entityId: 'local-storage-import',
        payload: {
          usersImported: result.users.imported,
          eventsImported: result.events.imported,
          usersSkippedExisting: result.users.skippedExisting,
          eventsSkippedExisting: result.events.skippedExisting,
          source: result.source
        }
      }, context);
    }
    sendJson(res, 200, result);
    return true;
  }

  if (pathname === '/api/users') {
    const context = requireAuth(req, res, ['admin']);
    if (!context) return true;

    if (req.method === 'GET') {
      sendJson(res, 200, { ok: true, users: localDatabase.listUsers() });
      return true;
    }

    if (req.method === 'POST') {
      const body = await readJsonBody(req);
      const result = localDatabase.createUser(body);
      if (result.ok) {
        recordApiEvent('user-created', {
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
    const context = requireAuth(req, res, ['admin']);
    if (!context) return true;
    const id = decodeURIComponent(userMatch[1]);
    const action = userMatch[2] || '';

    if (!action && req.method === 'PATCH') {
      const body = await readJsonBody(req);
      const result = localDatabase.updateUser(id, body);
      if (result.ok) {
        recordApiEvent('user-updated', {
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
      const publicUser = localDatabase.findPublicUser(id);
      const result = localDatabase.deleteUser(id);
      if (result.ok) {
        recordApiEvent('user-deleted', {
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
      const publicUser = localDatabase.findPublicUser(id);
      const result = localDatabase.setPassword(id, body.password);
      if (result.ok) {
        recordApiEvent('user-password-reset', {
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
      const result = localDatabase.setUserStatus(id, body.status);
      if (result.ok) {
        recordApiEvent('user-status-changed', {
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
      const context = authContext(req);
      const body = await readJsonBody(req);
      const event = localDatabase.recordEvent({
        type: body.type,
        source: body.source || 'browser',
        ownerEmail: body.ownerEmail,
        actorEmail: context && context.user ? context.user.email : body.actorEmail,
        sessionId: context && context.session ? context.session.id : body.sessionId,
        entityType: body.entityType,
        entityId: body.entityId,
        payload: body.payload || body.details || {},
        createdAt: body.createdAt
      });
      sendJson(res, 201, { ok: true, event });
      return true;
    }

    if (req.method === 'GET') {
      const context = requireAuth(req, res, ['admin']);
      if (!context) return true;
      const limit = Number(parsedUrl.searchParams.get('limit') || 100);
      sendJson(res, 200, { ok: true, events: localDatabase.listEvents({ limit }) });
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
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname] || 'application/octet-stream' });
    res.end(content);
  });
}

const server = http.createServer((req, res) => {
  handleRequest(req, res).catch((error) => {
    const status = Number(error.status) || 500;
    if ((req.url || '').startsWith('/api/')) {
      sendJson(res, status, { ok: false, message: status === 500 ? 'Erro interno da API local.' : error.message });
      return;
    }
    res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end(status === 500 ? 'Erro interno da aplicacao local.' : error.message);
  });
});

server.listen(PORT, () => {
  console.log(`Bancus Fraternis local server running at http://localhost:${PORT}/pages/index.html`);
  if (localDatabase) console.log(`Local database ready: ${SCHEMA_VERSION}`);
});
