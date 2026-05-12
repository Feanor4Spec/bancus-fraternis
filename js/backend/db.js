const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_VERSION = 'bancus-fraternis.local-db.v1';
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', '.runtime', 'bancus-fraternis.sqlite');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const PASSWORD_ALGORITHM = 'scrypt-sha256';
const MAX_EVENT_PAYLOAD_CHARS = 50000;

const ROLE_LABELS = {
  admin: 'Administrador',
  consultor: 'Consultor',
  cliente: 'Cliente'
};

const STATUS_LABELS = {
  active: 'Ativo',
  inactive: 'Inativo'
};

const SEED_USERS = [
  {
    id: 'USR-SEED-1',
    name: 'Administrador Bancus Fraternis',
    email: 'admin@bankfratern.local',
    role: 'admin',
    status: 'active',
    department: 'Operacao',
    phone: '(11) 4000-0001',
    password: 'Admin@123'
  },
  {
    id: 'USR-SEED-2',
    name: 'Consultor Fratern',
    email: 'consultor@bankfratern.local',
    role: 'consultor',
    status: 'active',
    department: 'Comercial',
    phone: '(11) 4000-0002',
    password: 'Consultor@123'
  },
  {
    id: 'USR-SEED-3',
    name: 'Cliente Demonstracao',
    email: 'cliente@bankfratern.local',
    role: 'cliente',
    status: 'active',
    department: 'Cliente',
    phone: '(11) 4000-0003',
    password: 'Cliente@123'
  }
];

const SENSITIVE_EVENT_KEYS = [
  'password',
  'senha',
  'token',
  'secret',
  'hash',
  'salt',
  'cpf',
  'documento',
  'telefone',
  'phone',
  'whatsapp',
  'email'
];

function nowIso() {
  return new Date().toISOString();
}

function makeId(prefix) {
  return `${prefix}-${Date.now().toString(36)}-${crypto.randomBytes(4).toString('hex')}`.toUpperCase();
}

function normalizeEmail(email) {
  return String(email || '').trim().toLowerCase();
}

function normalizeRole(role) {
  return ROLE_LABELS[role] ? role : 'cliente';
}

function normalizeStatus(status) {
  return STATUS_LABELS[status] ? status : 'active';
}

function normalizeText(value, fallback = '') {
  return String(value === undefined || value === null ? fallback : value).trim();
}

function hashPassword(password, salt = crypto.randomBytes(16).toString('hex')) {
  const hash = crypto.scryptSync(String(password || ''), salt, 64).toString('hex');
  return { hash, salt, algorithm: PASSWORD_ALGORITHM };
}

function verifyPassword(password, salt, expectedHash) {
  if (!salt || !expectedHash) return false;
  const actual = crypto.scryptSync(String(password || ''), salt, 64);
  const expected = Buffer.from(String(expectedHash), 'hex');
  return actual.length === expected.length && crypto.timingSafeEqual(actual, expected);
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function safeJson(value) {
  try {
    const json = JSON.stringify(value === undefined ? {} : value);
    return json.length > MAX_EVENT_PAYLOAD_CHARS ? json.slice(0, MAX_EVENT_PAYLOAD_CHARS) : json;
  } catch (error) {
    return JSON.stringify({ error: 'payload-not-serializable' });
  }
}

function isSensitiveKey(key) {
  const normalized = String(key || '').toLowerCase();
  return SENSITIVE_EVENT_KEYS.some((item) => normalized.includes(item));
}

function sanitizeEventPayload(value, depth = 0) {
  if (value === null || value === undefined) return value;
  if (depth > 5) return '[truncated]';
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => sanitizeEventPayload(item, depth + 1));
  if (typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      if (isSensitiveKey(key)) return acc;
      acc[key] = sanitizeEventPayload(entry, depth + 1);
      return acc;
    }, {});
  }
  if (typeof value === 'string') return value.length > 800 ? `${value.slice(0, 800)}...` : value;
  return value;
}

function publicUser(row) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    email: row.email,
    role: row.role,
    roleLabel: ROLE_LABELS[row.role] || row.role,
    status: row.status,
    statusLabel: STATUS_LABELS[row.status] || row.status,
    department: row.department || '',
    phone: row.phone || '',
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || '',
    lastLoginAt: row.last_login_at || ''
  };
}

function publicEvent(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json || '{}');
  } catch (error) {
    payload = {};
  }
  return {
    id: row.id,
    type: row.type,
    source: row.source,
    ownerEmail: row.owner_email || '',
    actorEmail: row.actor_email || '',
    sessionId: row.session_id || '',
    entityType: row.entity_type || '',
    entityId: row.entity_id || '',
    payload,
    createdAt: row.created_at || ''
  };
}

function validateUserPayload(payload, options = {}) {
  const data = payload || {};
  const name = normalizeText(data.name);
  const email = normalizeEmail(data.email);
  const role = normalizeRole(data.role);
  const status = normalizeStatus(data.status);
  const password = normalizeText(data.password);

  if (!name) return { ok: false, status: 400, message: 'Informe o nome do usuario.' };
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, status: 400, message: 'Informe um e-mail valido.' };
  }
  if (!options.editing && (!password || password.length < 6)) {
    return { ok: false, status: 400, message: 'Informe uma senha com pelo menos 6 caracteres.' };
  }

  return {
    ok: true,
    data: {
      id: normalizeText(data.id),
      name,
      email,
      role,
      status,
      department: normalizeText(data.department),
      phone: normalizeText(data.phone),
      password
    }
  };
}

function initializeSchema(db) {
  db.exec(`
    PRAGMA journal_mode = WAL;
    PRAGMA foreign_keys = ON;

    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      email TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'active',
      department TEXT DEFAULT '',
      phone TEXT DEFAULT '',
      password_hash TEXT NOT NULL,
      password_salt TEXT NOT NULL,
      password_algorithm TEXT NOT NULL DEFAULT '${PASSWORD_ALGORITHM}',
      password_updated_at TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      last_login_at TEXT DEFAULT ''
    );

    CREATE TABLE IF NOT EXISTS sessions (
      id TEXT PRIMARY KEY,
      user_id TEXT NOT NULL,
      token_hash TEXT NOT NULL UNIQUE,
      role TEXT NOT NULL,
      created_at TEXT NOT NULL,
      expires_at TEXT NOT NULL,
      revoked_at TEXT DEFAULT '',
      FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS events (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'api',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      session_id TEXT DEFAULT '',
      entity_type TEXT DEFAULT '',
      entity_id TEXT DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_owner_email ON events(owner_email);
  `);
}

class BancusDatabase {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
    this.schemaVersion = SCHEMA_VERSION;
    this.seedUsers();
  }

  close() {
    this.db.close();
  }

  seedUsers() {
    SEED_USERS.forEach((seed) => {
      const exists = this.db.prepare('SELECT id FROM users WHERE email = ?').get(seed.email);
      if (exists) return;
      const timestamp = nowIso();
      const credentials = hashPassword(seed.password);
      this.db.prepare(`
        INSERT INTO users (
          id, name, email, role, status, department, phone,
          password_hash, password_salt, password_algorithm, password_updated_at,
          created_at, updated_at, last_login_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        seed.id,
        seed.name,
        seed.email,
        seed.role,
        seed.status,
        seed.department,
        seed.phone,
        credentials.hash,
        credentials.salt,
        credentials.algorithm,
        timestamp,
        timestamp,
        timestamp,
        ''
      );
    });
  }

  listUsers() {
    const rows = this.db.prepare('SELECT * FROM users ORDER BY name COLLATE NOCASE ASC').all();
    return rows.map(publicUser);
  }

  getUserById(id) {
    return this.db.prepare('SELECT * FROM users WHERE id = ?').get(String(id || ''));
  }

  getUserByEmail(email) {
    return this.db.prepare('SELECT * FROM users WHERE email = ?').get(normalizeEmail(email));
  }

  findPublicUser(id) {
    return publicUser(this.getUserById(id));
  }

  createUser(payload) {
    const validation = validateUserPayload(payload);
    if (!validation.ok) return validation;

    const data = validation.data;
    if (this.getUserByEmail(data.email)) {
      return { ok: false, status: 409, message: 'Ja existe um usuario com este e-mail.' };
    }

    const timestamp = nowIso();
    const credentials = hashPassword(data.password);
    const id = data.id && /^[A-Za-z0-9_-]{3,80}$/.test(data.id) ? data.id : makeId('USR');

    this.db.prepare(`
      INSERT INTO users (
        id, name, email, role, status, department, phone,
        password_hash, password_salt, password_algorithm, password_updated_at,
        created_at, updated_at, last_login_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      id,
      data.name,
      data.email,
      data.role,
      data.status,
      data.department,
      data.phone,
      credentials.hash,
      credentials.salt,
      credentials.algorithm,
      timestamp,
      timestamp,
      timestamp,
      ''
    );

    return { ok: true, status: 201, user: this.findPublicUser(id), message: 'Usuario criado com sucesso.' };
  }

  updateUser(id, payload) {
    const current = this.getUserById(id);
    if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };

    const validation = validateUserPayload(payload, { editing: true });
    if (!validation.ok) return validation;
    const data = validation.data;
    const duplicated = this.getUserByEmail(data.email);
    if (duplicated && duplicated.id !== current.id) {
      return { ok: false, status: 409, message: 'Ja existe outro usuario com este e-mail.' };
    }

    const timestamp = nowIso();
    this.db.prepare(`
      UPDATE users
      SET name = ?, email = ?, role = ?, status = ?, department = ?, phone = ?, updated_at = ?
      WHERE id = ?
    `).run(data.name, data.email, data.role, data.status, data.department, data.phone, timestamp, current.id);

    if (data.password) this.setPassword(current.id, data.password);
    return { ok: true, status: 200, user: this.findPublicUser(current.id), message: 'Usuario atualizado com sucesso.' };
  }

  deleteUser(id) {
    const current = this.getUserById(id);
    if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
    this.db.prepare('DELETE FROM users WHERE id = ?').run(current.id);
    return { ok: true, status: 200, message: 'Usuario removido.' };
  }

  setPassword(id, password) {
    const nextPassword = normalizeText(password);
    if (nextPassword.length < 6) {
      return { ok: false, status: 400, message: 'A senha temporaria precisa ter pelo menos 6 caracteres.' };
    }
    const current = this.getUserById(id);
    if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
    const timestamp = nowIso();
    const credentials = hashPassword(nextPassword);
    this.db.prepare(`
      UPDATE users
      SET password_hash = ?, password_salt = ?, password_algorithm = ?, password_updated_at = ?, updated_at = ?
      WHERE id = ?
    `).run(credentials.hash, credentials.salt, credentials.algorithm, timestamp, timestamp, current.id);
    return { ok: true, status: 200, message: 'Senha atualizada com seguranca.' };
  }

  setUserStatus(id, status) {
    const current = this.getUserById(id);
    if (!current) return { ok: false, status: 404, message: 'Usuario nao encontrado.' };
    const nextStatus = normalizeStatus(status || (current.status === 'active' ? 'inactive' : 'active'));
    const timestamp = nowIso();
    this.db.prepare('UPDATE users SET status = ?, updated_at = ? WHERE id = ?').run(nextStatus, timestamp, current.id);
    if (nextStatus !== 'active') {
      this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE user_id = ? AND revoked_at = ''").run(timestamp, current.id);
    }
    return {
      ok: true,
      status: 200,
      user: this.findPublicUser(current.id),
      message: `Usuario ${(STATUS_LABELS[nextStatus] || nextStatus).toLowerCase()}.`
    };
  }

  login(email, password) {
    const user = this.getUserByEmail(email);
    if (!user || !verifyPassword(password, user.password_salt, user.password_hash)) {
      return { ok: false, status: 401, message: 'E-mail ou senha invalidos.' };
    }
    if (user.status !== 'active') {
      return { ok: false, status: 403, message: 'Usuario inativo. Solicite reativacao ao administrador.' };
    }

    const timestamp = nowIso();
    this.db.prepare('UPDATE users SET last_login_at = ?, updated_at = ? WHERE id = ?').run(timestamp, timestamp, user.id);
    const updated = this.getUserById(user.id);
    const session = this.createSession(updated);
    return { ok: true, status: 200, user: publicUser(updated), session };
  }

  createSession(user) {
    const token = crypto.randomBytes(32).toString('hex');
    const timestamp = Date.now();
    const createdAt = new Date(timestamp).toISOString();
    const expiresAt = new Date(timestamp + SESSION_TTL_MS).toISOString();
    const id = makeId('SES');
    this.db.prepare(`
      INSERT INTO sessions (id, user_id, token_hash, role, created_at, expires_at, revoked_at)
      VALUES (?, ?, ?, ?, ?, ?, '')
    `).run(id, user.id, tokenHash(token), user.role, createdAt, expiresAt);
    return { id, token, role: user.role, createdAt, expiresAt };
  }

  authenticateToken(token) {
    const hash = tokenHash(token);
    const row = this.db.prepare(`
      SELECT
        sessions.id AS session_id,
        sessions.role AS session_role,
        sessions.created_at AS session_created_at,
        sessions.expires_at AS session_expires_at,
        users.*
      FROM sessions
      JOIN users ON users.id = sessions.user_id
      WHERE sessions.token_hash = ?
        AND sessions.revoked_at = ''
        AND sessions.expires_at > ?
        AND users.status = 'active'
      LIMIT 1
    `).get(hash, nowIso());
    if (!row) return null;
    return {
      session: {
        id: row.session_id,
        role: row.session_role,
        createdAt: row.session_created_at,
        expiresAt: row.session_expires_at
      },
      user: publicUser(row)
    };
  }

  revokeToken(token) {
    if (!token) return false;
    const result = this.db.prepare("UPDATE sessions SET revoked_at = ? WHERE token_hash = ? AND revoked_at = ''")
      .run(nowIso(), tokenHash(token));
    return Number(result.changes || 0) > 0;
  }

  recordEvent(input = {}) {
    const event = {
      id: normalizeText(input.id) || makeId('EVT'),
      type: normalizeText(input.type, 'event'),
      source: normalizeText(input.source, 'api'),
      ownerEmail: normalizeEmail(input.ownerEmail),
      actorEmail: normalizeEmail(input.actorEmail),
      sessionId: normalizeText(input.sessionId),
      entityType: normalizeText(input.entityType),
      entityId: normalizeText(input.entityId),
      payload: sanitizeEventPayload(input.payload || input.details || {}),
      createdAt: normalizeText(input.createdAt) || nowIso()
    };
    this.db.prepare(`
      INSERT INTO events (
        id, type, source, owner_email, actor_email, session_id, entity_type, entity_id, payload_json, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
      event.id,
      event.type,
      event.source,
      event.ownerEmail,
      event.actorEmail,
      event.sessionId,
      event.entityType,
      event.entityId,
      safeJson(event.payload),
      event.createdAt
    );
    return publicEvent({
      id: event.id,
      type: event.type,
      source: event.source,
      owner_email: event.ownerEmail,
      actor_email: event.actorEmail,
      session_id: event.sessionId,
      entity_type: event.entityType,
      entity_id: event.entityId,
      payload_json: safeJson(event.payload),
      created_at: event.createdAt
    });
  }

  listEvents(options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const rows = this.db.prepare('SELECT * FROM events ORDER BY created_at DESC LIMIT ?').all(limit);
    return rows.map(publicEvent);
  }

  stats() {
    const users = this.db.prepare('SELECT COUNT(*) AS total FROM users').get();
    const events = this.db.prepare('SELECT COUNT(*) AS total FROM events').get();
    const sessions = this.db.prepare("SELECT COUNT(*) AS total FROM sessions WHERE revoked_at = '' AND expires_at > ?").get(nowIso());
    return {
      schemaVersion: this.schemaVersion,
      users: Number(users.total || 0),
      events: Number(events.total || 0),
      activeSessions: Number(sessions.total || 0)
    };
  }
}

function resolveDbPath(inputPath) {
  return path.resolve(inputPath || process.env.BANCUS_DB_PATH || DEFAULT_DB_PATH);
}

function createDatabase(options = {}) {
  const dbPath = resolveDbPath(options.dbPath);
  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const db = new DatabaseSync(dbPath);
  initializeSchema(db);
  return new BancusDatabase(db, dbPath);
}

module.exports = {
  SCHEMA_VERSION,
  DEFAULT_DB_PATH,
  ROLE_LABELS,
  STATUS_LABELS,
  createDatabase,
  hashPassword,
  verifyPassword,
  sanitizeEventPayload
};
