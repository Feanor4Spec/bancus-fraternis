const crypto = require('node:crypto');
const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');

const SCHEMA_VERSION = 'bancus-fraternis.local-db.v1';
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', '.runtime', 'bancus-fraternis.sqlite');
const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const PASSWORD_ALGORITHM = 'scrypt-sha256';
const MAX_EVENT_PAYLOAD_CHARS = 50000;
const IMPORT_TEMP_PASSWORD = 'Temp@123';

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

function safeRelativePath(filePath) {
  const relative = path.relative(process.cwd(), filePath);
  return relative && !relative.startsWith('..') && !path.isAbsolute(relative) ? relative : path.basename(filePath);
}

function fileInfo(filePath) {
  try {
    const stat = fs.statSync(filePath);
    return {
      exists: true,
      path: safeRelativePath(filePath),
      sizeBytes: stat.size,
      updatedAt: stat.mtime.toISOString()
    };
  } catch (error) {
    return {
      exists: false,
      path: safeRelativePath(filePath),
      sizeBytes: 0,
      updatedAt: ''
    };
  }
}

function quoteIdentifier(identifier) {
  return `"${String(identifier || '').replace(/"/g, '""')}"`;
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

function publicSnapshot(row) {
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
    entityId: row.entity_id || '',
    title: row.title || '',
    status: row.status || '',
    storageKey: row.storage_key || '',
    payload,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function publicJourneyEntity(row) {
  if (!row) return null;
  let payload = {};
  try {
    payload = JSON.parse(row.payload_json || '{}');
  } catch (error) {
    payload = {};
  }
  return {
    id: row.id,
    kind: row.kind,
    sourceSnapshotId: row.source_snapshot_id || '',
    snapshotType: row.snapshot_type || '',
    ownerEmail: row.owner_email || '',
    actorEmail: row.actor_email || '',
    title: row.title || '',
    status: row.status || '',
    stage: row.stage || '',
    priority: row.priority || '',
    source: row.source || '',
    relatedId: row.related_id || '',
    amount: Number(row.amount || 0),
    payload,
    createdAt: row.created_at || '',
    updatedAt: row.updated_at || ''
  };
}

function publicMaterializedJourneyRow(row, kind) {
  const entity = publicJourneyEntity({
    ...row,
    kind: row.kind || kind
  });
  return entity ? { ...entity, materializedTable: `journey_${kind}s` } : null;
}

function countBy(items, key) {
  return (items || []).reduce((acc, item) => {
    const value = String(item && item[key] ? item[key] : 'desconhecido');
    acc[value] = Number(acc[value] || 0) + 1;
    return acc;
  }, {});
}

function firstText(...values) {
  for (const value of values) {
    const text = normalizeText(value);
    if (text) return text;
  }
  return '';
}

function firstNumber(...values) {
  for (const value of values) {
    const parsed = Number(value);
    if (Number.isFinite(parsed) && parsed > 0) return parsed;
  }
  return 0;
}

function snapshotPayload(input) {
  return input && input.payload && typeof input.payload === 'object' ? input.payload : {};
}

function buildJourneyEntity(snapshot = {}) {
  const type = normalizeText(snapshot.type);
  const payload = snapshotPayload(snapshot);
  const common = {
    sourceSnapshotId: normalizeText(snapshot.id),
    snapshotType: type,
    ownerEmail: normalizeEmail(snapshot.ownerEmail),
    actorEmail: normalizeEmail(snapshot.actorEmail),
    source: firstText(snapshot.source, payload.source, 'snapshot'),
    createdAt: firstText(payload.createdAt, payload.criadoEm, snapshot.createdAt, nowIso()),
    updatedAt: firstText(payload.updatedAt, payload.atualizadoEm, snapshot.updatedAt, snapshot.createdAt, nowIso())
  };

  if (type === 'simulation') {
    return {
      ...common,
      kind: 'simulation',
      id: firstText(payload.id, payload.simulationId, snapshot.entityId, snapshot.id),
      title: firstText(payload.nome, payload.name, payload.title, snapshot.title, 'Simulacao salva'),
      status: firstText(payload.status, payload.statusProposta, snapshot.status, 'saved'),
      stage: firstText(payload.stage, payload.etapa, 'simulacao'),
      priority: firstText(payload.priority, payload.prioridade, payload.decisionContext && payload.decisionContext.priority, 'media'),
      relatedId: firstText(payload.journeyId, payload.decisionJourneyId, payload.decisionContext && payload.decisionContext.journeyId, payload.proposalId),
      amount: firstNumber(payload.valorCarta, payload.valorCredito, payload.valorCartaRef, payload.creditValue, payload.amount),
      payload
    };
  }

  if (['proposal-version', 'proposal-acceptance', 'proposal-builder'].includes(type)) {
    return {
      ...common,
      kind: 'proposal',
      id: firstText(payload.proposalId, payload.id, snapshot.entityId, snapshot.id),
      title: firstText(payload.title, payload.proposalTitle, snapshot.title, 'Proposta'),
      status: firstText(payload.status, snapshot.status, type === 'proposal-builder' ? 'draft' : 'versioned'),
      stage: firstText(payload.stage, type === 'proposal-builder' ? 'lousa' : 'proposta'),
      priority: firstText(payload.priority, payload.status === 'expired' ? 'alta' : '', 'media'),
      relatedId: firstText(payload.simulationId, payload.handoffId, payload.journeyId, payload.sourceSimulationId),
      amount: firstNumber(payload.amount, payload.valorCarta, payload.valorCredito, payload.totalCredit, payload.proposalValue),
      payload
    };
  }

  if (type === 'handoff') {
    const commercialStage = payload.commercialStage && typeof payload.commercialStage === 'object'
      ? payload.commercialStage
      : {};
    return {
      ...common,
      kind: 'lead',
      id: firstText(payload.id, payload.handoffId, snapshot.entityId, snapshot.id),
      title: firstText(payload.title, payload.objectiveLabel, payload.clientName, snapshot.title, 'Lead consultivo'),
      status: firstText(payload.status, snapshot.status, 'novo'),
      stage: firstText(commercialStage.key, payload.stage, payload.commercialStageKey, 'contato'),
      priority: firstText(payload.priority, payload.prioridade, 'media'),
      relatedId: firstText(payload.sourceProposalId, payload.proposalId, payload.journeyId, payload.sourceJourneyId),
      amount: firstNumber(payload.amount, payload.valorCarta, payload.valorCredito, payload.ticket),
      payload
    };
  }

  return null;
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

    CREATE TABLE IF NOT EXISTS snapshots (
      id TEXT PRIMARY KEY,
      type TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT 'api',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      entity_id TEXT DEFAULT '',
      title TEXT DEFAULT '',
      status TEXT DEFAULT '',
      storage_key TEXT DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_entities (
      id TEXT NOT NULL,
      kind TEXT NOT NULL,
      source_snapshot_id TEXT DEFAULT '',
      snapshot_type TEXT DEFAULT '',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      title TEXT DEFAULT '',
      status TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      priority TEXT DEFAULT '',
      source TEXT DEFAULT '',
      related_id TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      PRIMARY KEY (kind, id)
    );

    CREATE TABLE IF NOT EXISTS journey_leads (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'lead',
      source_snapshot_id TEXT DEFAULT '',
      snapshot_type TEXT DEFAULT '',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      title TEXT DEFAULT '',
      status TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      priority TEXT DEFAULT '',
      source TEXT DEFAULT '',
      related_id TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_simulations (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'simulation',
      source_snapshot_id TEXT DEFAULT '',
      snapshot_type TEXT DEFAULT '',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      title TEXT DEFAULT '',
      status TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      priority TEXT DEFAULT '',
      source TEXT DEFAULT '',
      related_id TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS journey_proposals (
      id TEXT PRIMARY KEY,
      kind TEXT NOT NULL DEFAULT 'proposal',
      source_snapshot_id TEXT DEFAULT '',
      snapshot_type TEXT DEFAULT '',
      owner_email TEXT DEFAULT '',
      actor_email TEXT DEFAULT '',
      title TEXT DEFAULT '',
      status TEXT DEFAULT '',
      stage TEXT DEFAULT '',
      priority TEXT DEFAULT '',
      source TEXT DEFAULT '',
      related_id TEXT DEFAULT '',
      amount REAL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
    CREATE INDEX IF NOT EXISTS idx_sessions_token_hash ON sessions(token_hash);
    CREATE INDEX IF NOT EXISTS idx_sessions_user ON sessions(user_id);
    CREATE INDEX IF NOT EXISTS idx_events_created_at ON events(created_at);
    CREATE INDEX IF NOT EXISTS idx_events_type ON events(type);
    CREATE INDEX IF NOT EXISTS idx_events_owner_email ON events(owner_email);
    CREATE INDEX IF NOT EXISTS idx_snapshots_type ON snapshots(type);
    CREATE INDEX IF NOT EXISTS idx_snapshots_owner_email ON snapshots(owner_email);
    CREATE INDEX IF NOT EXISTS idx_snapshots_updated_at ON snapshots(updated_at);
    CREATE INDEX IF NOT EXISTS idx_journey_entities_kind ON journey_entities(kind);
    CREATE INDEX IF NOT EXISTS idx_journey_entities_owner_email ON journey_entities(owner_email);
    CREATE INDEX IF NOT EXISTS idx_journey_entities_updated_at ON journey_entities(updated_at);
    CREATE INDEX IF NOT EXISTS idx_journey_entities_snapshot ON journey_entities(source_snapshot_id);
    CREATE INDEX IF NOT EXISTS idx_journey_leads_owner_email ON journey_leads(owner_email);
    CREATE INDEX IF NOT EXISTS idx_journey_leads_updated_at ON journey_leads(updated_at);
    CREATE INDEX IF NOT EXISTS idx_journey_simulations_owner_email ON journey_simulations(owner_email);
    CREATE INDEX IF NOT EXISTS idx_journey_simulations_updated_at ON journey_simulations(updated_at);
    CREATE INDEX IF NOT EXISTS idx_journey_proposals_owner_email ON journey_proposals(owner_email);
    CREATE INDEX IF NOT EXISTS idx_journey_proposals_updated_at ON journey_proposals(updated_at);
  `);
}

class BancusDatabase {
  constructor(db, dbPath) {
    this.db = db;
    this.dbPath = dbPath;
    this.schemaVersion = SCHEMA_VERSION;
    this.seedUsers();
    this.rebuildJourneyEntities();
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

  hasEvent(id) {
    if (!id) return false;
    return Boolean(this.db.prepare('SELECT id FROM events WHERE id = ? LIMIT 1').get(String(id || '')));
  }

  hasSnapshot(id) {
    if (!id) return false;
    return Boolean(this.db.prepare('SELECT id FROM snapshots WHERE id = ? LIMIT 1').get(String(id || '')));
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

  upsertSnapshot(input = {}) {
    const timestamp = nowIso();
    const snapshot = {
      id: normalizeText(input.id) || makeId('SNP'),
      type: normalizeText(input.type, 'snapshot'),
      source: normalizeText(input.source, 'api'),
      ownerEmail: normalizeEmail(input.ownerEmail),
      actorEmail: normalizeEmail(input.actorEmail),
      entityId: normalizeText(input.entityId),
      title: normalizeText(input.title),
      status: normalizeText(input.status),
      storageKey: normalizeText(input.storageKey),
      payload: sanitizeEventPayload(input.payload || input.details || {}),
      createdAt: normalizeText(input.createdAt) || timestamp,
      updatedAt: normalizeText(input.updatedAt) || timestamp
    };
    const exists = this.hasSnapshot(snapshot.id);
    this.db.prepare(`
      INSERT INTO snapshots (
        id, type, source, owner_email, actor_email, entity_id, title, status, storage_key, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        type = excluded.type,
        source = excluded.source,
        owner_email = excluded.owner_email,
        actor_email = excluded.actor_email,
        entity_id = excluded.entity_id,
        title = excluded.title,
        status = excluded.status,
        storage_key = excluded.storage_key,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(
      snapshot.id,
      snapshot.type,
      snapshot.source,
      snapshot.ownerEmail,
      snapshot.actorEmail,
      snapshot.entityId,
      snapshot.title,
      snapshot.status,
      snapshot.storageKey,
      safeJson(snapshot.payload),
      snapshot.createdAt,
      snapshot.updatedAt
    );
    const publicRecord = publicSnapshot({
      id: snapshot.id,
      type: snapshot.type,
      source: snapshot.source,
      owner_email: snapshot.ownerEmail,
      actor_email: snapshot.actorEmail,
      entity_id: snapshot.entityId,
      title: snapshot.title,
      status: snapshot.status,
      storage_key: snapshot.storageKey,
      payload_json: safeJson(snapshot.payload),
      created_at: snapshot.createdAt,
      updated_at: snapshot.updatedAt
    });
    return {
      created: !exists,
      snapshot: publicRecord,
      entity: this.upsertJourneyEntityFromSnapshot(publicRecord)
    };
  }

  upsertJourneyEntityFromSnapshot(snapshot = {}) {
    const entity = buildJourneyEntity(snapshot);
    if (!entity || !entity.id || !entity.kind) return null;
    this.db.prepare(`
      INSERT INTO journey_entities (
        id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
        title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, id) DO UPDATE SET
        source_snapshot_id = excluded.source_snapshot_id,
        snapshot_type = excluded.snapshot_type,
        owner_email = excluded.owner_email,
        actor_email = excluded.actor_email,
        title = excluded.title,
        status = excluded.status,
        stage = excluded.stage,
        priority = excluded.priority,
        source = excluded.source,
        related_id = excluded.related_id,
        amount = excluded.amount,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(
      entity.id,
      entity.kind,
      entity.sourceSnapshotId,
      entity.snapshotType,
      entity.ownerEmail,
      entity.actorEmail,
      entity.title,
      entity.status,
      entity.stage,
      entity.priority,
      entity.source,
      entity.relatedId,
      entity.amount,
      safeJson(entity.payload),
      entity.createdAt,
      entity.updatedAt
    );
    const publicRecord = publicJourneyEntity({
      id: entity.id,
      kind: entity.kind,
      source_snapshot_id: entity.sourceSnapshotId,
      snapshot_type: entity.snapshotType,
      owner_email: entity.ownerEmail,
      actor_email: entity.actorEmail,
      title: entity.title,
      status: entity.status,
      stage: entity.stage,
      priority: entity.priority,
      source: entity.source,
      related_id: entity.relatedId,
      amount: entity.amount,
      payload_json: safeJson(entity.payload),
      created_at: entity.createdAt,
      updated_at: entity.updatedAt
    });
    this.upsertMaterializedJourneyRow(publicRecord);
    return publicRecord;
  }

  materializedTableFor(kind) {
    if (kind === 'lead') return 'journey_leads';
    if (kind === 'simulation') return 'journey_simulations';
    if (kind === 'proposal') return 'journey_proposals';
    return '';
  }

  materializedResponseKey(kind) {
    if (kind === 'lead') return 'lead';
    if (kind === 'simulation') return 'simulation';
    if (kind === 'proposal') return 'proposal';
    return 'record';
  }

  materializedDefaultsFor(kind) {
    if (kind === 'lead') {
      return {
        prefix: 'LED',
        title: 'Lead consultivo',
        status: 'novo',
        stage: 'contato'
      };
    }
    if (kind === 'simulation') {
      return {
        prefix: 'SIM',
        title: 'Simulacao',
        status: 'saved',
        stage: 'simulacao'
      };
    }
    if (kind === 'proposal') {
      return {
        prefix: 'PRP',
        title: 'Proposta',
        status: 'draft',
        stage: 'proposta'
      };
    }
    return {
      prefix: 'JRN',
      title: 'Registro de jornada',
      status: 'active',
      stage: 'jornada'
    };
  }

  findMaterializedJourneyRow(kind, id, options = {}) {
    const table = this.materializedTableFor(kind);
    const normalizedId = normalizeText(id);
    if (!table || !normalizedId) return null;
    const ownerEmail = normalizeEmail(options.ownerEmail);
    const filters = ['id = ?'];
    const params = [normalizedId];
    if (ownerEmail) {
      filters.push('owner_email = ?');
      params.push(ownerEmail);
    }
    const row = this.db.prepare(`SELECT * FROM ${quoteIdentifier(table)} WHERE ${filters.join(' AND ')} LIMIT 1`).get(...params);
    return row ? publicMaterializedJourneyRow(row, kind) : null;
  }

  upsertDirectJourneyRow(kind, input = {}) {
    const normalizedKind = normalizeText(kind);
    const table = this.materializedTableFor(normalizedKind);
    if (!table) {
      return { ok: false, status: 400, message: 'Tipo de jornada invalido.' };
    }

    const defaults = this.materializedDefaultsFor(normalizedKind);
    const timestamp = nowIso();
    const id = normalizeText(input.id) || makeId(defaults.prefix);
    const existing = this.findMaterializedJourneyRow(normalizedKind, id);
    const explicitPayload = input.payload !== undefined
      ? input.payload
      : (input.details !== undefined ? input.details : input.data);
    const basePayload = existing && existing.payload && typeof existing.payload === 'object' && !Array.isArray(existing.payload)
      ? existing.payload
      : {};
    const payloadSource = explicitPayload !== undefined
      ? explicitPayload
      : { ...basePayload, ...input };
    const payload = sanitizeEventPayload(payloadSource);
    const payloadObject = payload && typeof payload === 'object' && !Array.isArray(payload) ? payload : {};
    const entity = {
      id,
      kind: normalizedKind,
      sourceSnapshotId: firstText(input.sourceSnapshotId, input.source_snapshot_id, payloadObject.sourceSnapshotId, existing && existing.sourceSnapshotId),
      snapshotType: firstText(input.snapshotType, input.snapshot_type, input.type, payloadObject.snapshotType, existing && existing.snapshotType, `direct-${normalizedKind}`),
      ownerEmail: normalizeEmail(input.ownerEmail || input.owner_email || (existing && existing.ownerEmail)),
      actorEmail: normalizeEmail(input.actorEmail || input.actor_email || (existing && existing.actorEmail)),
      title: firstText(input.title, input.name, input.nome, payloadObject.title, payloadObject.name, payloadObject.nome, existing && existing.title, defaults.title),
      status: firstText(input.status, payloadObject.status, existing && existing.status, defaults.status),
      stage: firstText(input.stage, input.etapa, payloadObject.stage, payloadObject.etapa, existing && existing.stage, defaults.stage),
      priority: firstText(input.priority, input.prioridade, payloadObject.priority, payloadObject.prioridade, existing && existing.priority, 'media'),
      source: firstText(input.source, payloadObject.source, existing && existing.source, 'direct-api'),
      relatedId: firstText(
        input.relatedId,
        input.related_id,
        input.entityId,
        payloadObject.relatedId,
        payloadObject.related_id,
        payloadObject.simulationId,
        payloadObject.proposalId,
        payloadObject.handoffId,
        payloadObject.journeyId,
        existing && existing.relatedId
      ),
      amount: firstNumber(
        input.amount,
        input.valorCarta,
        input.valorCredito,
        payloadObject.amount,
        payloadObject.valorCarta,
        payloadObject.valorCredito,
        payloadObject.totalCredit,
        payloadObject.proposalValue,
        existing && existing.amount
      ),
      payload,
      createdAt: firstText(input.createdAt, input.created_at, payloadObject.createdAt, existing && existing.createdAt, timestamp),
      updatedAt: firstText(input.updatedAt, input.updated_at, payloadObject.updatedAt, timestamp)
    };

    this.db.prepare(`
      INSERT INTO journey_entities (
        id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
        title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(kind, id) DO UPDATE SET
        source_snapshot_id = excluded.source_snapshot_id,
        snapshot_type = excluded.snapshot_type,
        owner_email = excluded.owner_email,
        actor_email = excluded.actor_email,
        title = excluded.title,
        status = excluded.status,
        stage = excluded.stage,
        priority = excluded.priority,
        source = excluded.source,
        related_id = excluded.related_id,
        amount = excluded.amount,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(
      entity.id,
      entity.kind,
      entity.sourceSnapshotId,
      entity.snapshotType,
      entity.ownerEmail,
      entity.actorEmail,
      entity.title,
      entity.status,
      entity.stage,
      entity.priority,
      entity.source,
      entity.relatedId,
      entity.amount,
      safeJson(entity.payload),
      entity.createdAt,
      entity.updatedAt
    );

    const publicRecord = publicJourneyEntity({
      id: entity.id,
      kind: entity.kind,
      source_snapshot_id: entity.sourceSnapshotId,
      snapshot_type: entity.snapshotType,
      owner_email: entity.ownerEmail,
      actor_email: entity.actorEmail,
      title: entity.title,
      status: entity.status,
      stage: entity.stage,
      priority: entity.priority,
      source: entity.source,
      related_id: entity.relatedId,
      amount: entity.amount,
      payload_json: safeJson(entity.payload),
      created_at: entity.createdAt,
      updated_at: entity.updatedAt
    });
    this.upsertMaterializedJourneyRow(publicRecord);
    const record = this.findMaterializedJourneyRow(normalizedKind, entity.id) || {
      ...publicRecord,
      materializedTable: table
    };
    const responseKey = this.materializedResponseKey(normalizedKind);
    return {
      ok: true,
      created: !existing,
      kind: normalizedKind,
      record,
      [responseKey]: record
    };
  }

  upsertMaterializedJourneyRow(entity = {}) {
    const table = this.materializedTableFor(entity.kind);
    if (!table || !entity.id) return null;
    this.db.prepare(`
      INSERT INTO ${quoteIdentifier(table)} (
        id, kind, source_snapshot_id, snapshot_type, owner_email, actor_email,
        title, status, stage, priority, source, related_id, amount, payload_json, created_at, updated_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        source_snapshot_id = excluded.source_snapshot_id,
        snapshot_type = excluded.snapshot_type,
        owner_email = excluded.owner_email,
        actor_email = excluded.actor_email,
        title = excluded.title,
        status = excluded.status,
        stage = excluded.stage,
        priority = excluded.priority,
        source = excluded.source,
        related_id = excluded.related_id,
        amount = excluded.amount,
        payload_json = excluded.payload_json,
        updated_at = excluded.updated_at
    `).run(
      entity.id,
      entity.kind,
      entity.sourceSnapshotId,
      entity.snapshotType,
      entity.ownerEmail,
      entity.actorEmail,
      entity.title,
      entity.status,
      entity.stage,
      entity.priority,
      entity.source,
      entity.relatedId,
      entity.amount,
      safeJson(entity.payload),
      entity.createdAt,
      entity.updatedAt
    );
    return entity;
  }

  rebuildJourneyEntities() {
    this.db.exec(`
      DELETE FROM journey_leads;
      DELETE FROM journey_simulations;
      DELETE FROM journey_proposals;
    `);
    const rows = this.db.prepare('SELECT * FROM snapshots ORDER BY updated_at DESC').all().map(publicSnapshot);
    const indexed = [];
    rows.forEach((snapshot) => {
      const entity = this.upsertJourneyEntityFromSnapshot(snapshot);
      if (entity) indexed.push(entity);
    });
    return {
      ok: true,
      totalSnapshots: rows.length,
      indexed: indexed.length,
      byKind: countBy(indexed, 'kind')
    };
  }

  listSnapshots(options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const type = normalizeText(options.type);
    const ownerEmail = normalizeEmail(options.ownerEmail);
    const filters = [];
    const params = [];
    if (type) {
      filters.push('type = ?');
      params.push(type);
    }
    if (ownerEmail) {
      filters.push('owner_email = ?');
      params.push(ownerEmail);
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM snapshots${where} ORDER BY updated_at DESC LIMIT ?`).all(...params, limit);
    return rows.map(publicSnapshot);
  }

  listJourneyEntities(options = {}) {
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const kind = normalizeText(options.kind);
    const ownerEmail = normalizeEmail(options.ownerEmail);
    const filters = [];
    const params = [];
    if (kind) {
      filters.push('kind = ?');
      params.push(kind);
    }
    if (ownerEmail) {
      filters.push('owner_email = ?');
      params.push(ownerEmail);
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM journey_entities${where} ORDER BY updated_at DESC LIMIT ?`).all(...params, limit);
    return rows.map(publicJourneyEntity);
  }

  journeyEntitySummary(options = {}) {
    const ownerEmail = normalizeEmail(options.ownerEmail);
    const rows = ownerEmail
      ? this.db.prepare('SELECT kind, COUNT(*) AS total FROM journey_entities WHERE owner_email = ? GROUP BY kind').all(ownerEmail)
      : this.db.prepare('SELECT kind, COUNT(*) AS total FROM journey_entities GROUP BY kind').all();
    return rows.reduce((acc, row) => {
      acc[row.kind] = Number(row.total || 0);
      acc.total += Number(row.total || 0);
      return acc;
    }, { total: 0, lead: 0, simulation: 0, proposal: 0 });
  }

  listMaterializedJourneyRows(kind, options = {}) {
    const table = this.materializedTableFor(kind);
    if (!table) return [];
    const limit = Math.max(1, Math.min(500, Number(options.limit || 100)));
    const ownerEmail = normalizeEmail(options.ownerEmail);
    const filters = [];
    const params = [];
    if (ownerEmail) {
      filters.push('owner_email = ?');
      params.push(ownerEmail);
    }
    const where = filters.length ? ` WHERE ${filters.join(' AND ')}` : '';
    const rows = this.db.prepare(`SELECT * FROM ${quoteIdentifier(table)}${where} ORDER BY updated_at DESC LIMIT ?`).all(...params, limit);
    return rows.map((row) => publicMaterializedJourneyRow(row, kind));
  }

  listLeads(options = {}) {
    return this.listMaterializedJourneyRows('lead', options);
  }

  listSimulations(options = {}) {
    return this.listMaterializedJourneyRows('simulation', options);
  }

  listProposals(options = {}) {
    return this.listMaterializedJourneyRows('proposal', options);
  }

  materializedSummary(options = {}) {
    return {
      lead: this.listLeads(options).length,
      simulation: this.listSimulations(options).length,
      proposal: this.listProposals(options).length
    };
  }

  importLocalSnapshot(input = {}, options = {}) {
    const dryRun = options.dryRun !== false;
    const timestamp = nowIso();
    const users = Array.isArray(input.users) ? input.users.slice(0, 250) : [];
    const events = Array.isArray(input.events) ? input.events.slice(0, 500) : [];
    const snapshots = Array.isArray(input.snapshots) ? input.snapshots.slice(0, 300) : [];
    const userRows = [];
    const eventRows = [];
    const snapshotRows = [];
    const summary = {
      ok: true,
      dryRun,
      source: normalizeText(input.source, 'localStorage'),
      temporaryPassword: IMPORT_TEMP_PASSWORD,
      users: {
        total: users.length,
        importable: 0,
        imported: 0,
        skippedExisting: 0,
        invalid: 0
      },
      events: {
        total: events.length,
        importable: 0,
        imported: 0,
        skippedExisting: 0,
        invalid: 0,
        bySource: {}
      },
      snapshots: {
        total: snapshots.length,
        importable: 0,
        created: 0,
        updated: 0,
        invalid: 0,
        byType: {}
      }
    };

    users.forEach((item) => {
      const validation = validateUserPayload({
        id: item && item.id,
        name: item && item.name,
        email: item && item.email,
        role: item && item.role,
        status: item && item.status,
        department: item && item.department,
        phone: item && item.phone,
        password: IMPORT_TEMP_PASSWORD
      });
      if (!validation.ok) {
        summary.users.invalid += 1;
        return;
      }
      const data = validation.data;
      const id = data.id && /^[A-Za-z0-9_-]{3,80}$/.test(data.id) ? data.id : makeId('USR');
      if (this.getUserById(id) || this.getUserByEmail(data.email)) {
        summary.users.skippedExisting += 1;
        return;
      }
      summary.users.importable += 1;
      userRows.push({ ...data, id });
    });

    events.forEach((item) => {
      const id = normalizeText(item && item.id);
      const type = normalizeText(item && item.type, 'local-storage-event');
      if (!id || !type) {
        summary.events.invalid += 1;
        return;
      }
      if (this.hasEvent(id)) {
        summary.events.skippedExisting += 1;
        return;
      }
      const event = {
        id,
        type,
        source: normalizeText(item && item.source, 'localStorage'),
        ownerEmail: item && item.ownerEmail,
        actorEmail: item && item.actorEmail ? item.actorEmail : options.actorEmail || '',
        sessionId: item && item.sessionId,
        entityType: item && item.entityType ? item.entityType : 'local-storage',
        entityId: item && item.entityId,
        payload: item && (item.payload || item.details) ? (item.payload || item.details) : {},
        createdAt: item && item.createdAt ? item.createdAt : timestamp
      };
      summary.events.importable += 1;
      eventRows.push(event);
    });
    summary.events.bySource = countBy(eventRows, 'source');

    snapshots.forEach((item) => {
      const id = normalizeText(item && item.id);
      const type = normalizeText(item && item.type, 'snapshot');
      if (!id || !type) {
        summary.snapshots.invalid += 1;
        return;
      }
      const snapshot = {
        id,
        type,
        source: normalizeText(item && item.source, 'localStorage'),
        ownerEmail: item && item.ownerEmail,
        actorEmail: item && item.actorEmail ? item.actorEmail : options.actorEmail || '',
        entityId: item && item.entityId,
        title: item && item.title,
        status: item && item.status,
        storageKey: item && item.storageKey,
        payload: item && (item.payload || item.details) ? (item.payload || item.details) : {},
        createdAt: item && item.createdAt ? item.createdAt : timestamp,
        updatedAt: item && item.updatedAt ? item.updatedAt : timestamp
      };
      summary.snapshots.importable += 1;
      snapshotRows.push(snapshot);
    });
    summary.snapshots.byType = countBy(snapshotRows, 'type');

    if (dryRun) return summary;

    this.db.exec('BEGIN');
    try {
      userRows.forEach((data) => {
        const credentials = hashPassword(IMPORT_TEMP_PASSWORD);
        this.db.prepare(`
          INSERT INTO users (
            id, name, email, role, status, department, phone,
            password_hash, password_salt, password_algorithm, password_updated_at,
            created_at, updated_at, last_login_at
          )
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        `).run(
          data.id,
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
        summary.users.imported += 1;
      });
      eventRows.forEach((event) => {
        this.recordEvent(event);
        summary.events.imported += 1;
      });
      snapshotRows.forEach((snapshot) => {
        const result = this.upsertSnapshot(snapshot);
        if (result.created) summary.snapshots.created += 1;
        else summary.snapshots.updated += 1;
      });
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }

    return summary;
  }

  stats() {
    const users = this.db.prepare('SELECT COUNT(*) AS total FROM users').get();
    const events = this.db.prepare('SELECT COUNT(*) AS total FROM events').get();
    const snapshots = this.db.prepare('SELECT COUNT(*) AS total FROM snapshots').get();
    const journeyEntities = this.db.prepare('SELECT COUNT(*) AS total FROM journey_entities').get();
    const journeyLeads = this.db.prepare('SELECT COUNT(*) AS total FROM journey_leads').get();
    const journeySimulations = this.db.prepare('SELECT COUNT(*) AS total FROM journey_simulations').get();
    const journeyProposals = this.db.prepare('SELECT COUNT(*) AS total FROM journey_proposals').get();
    const sessions = this.db.prepare("SELECT COUNT(*) AS total FROM sessions WHERE revoked_at = '' AND expires_at > ?").get(nowIso());
    return {
      schemaVersion: this.schemaVersion,
      users: Number(users.total || 0),
      events: Number(events.total || 0),
      snapshots: Number(snapshots.total || 0),
      journeyEntities: Number(journeyEntities.total || 0),
      journeyLeads: Number(journeyLeads.total || 0),
      journeySimulations: Number(journeySimulations.total || 0),
      journeyProposals: Number(journeyProposals.total || 0),
      activeSessions: Number(sessions.total || 0)
    };
  }

  databaseStatus() {
    const sqliteVersion = this.db.prepare('SELECT sqlite_version() AS version').get();
    const journalMode = this.db.prepare('PRAGMA journal_mode').get();
    const foreignKeys = this.db.prepare('PRAGMA foreign_keys').get();
    const quickCheck = this.db.prepare('PRAGMA quick_check').get();
    const tableRows = this.db.prepare(`
      SELECT name
      FROM sqlite_schema
      WHERE type = 'table'
        AND name NOT LIKE 'sqlite_%'
      ORDER BY name ASC
    `).all();
    const tables = tableRows.map((row) => {
      const count = this.db.prepare(`SELECT COUNT(*) AS total FROM ${quoteIdentifier(row.name)}`).get();
      return { name: row.name, rows: Number(count.total || 0) };
    });

    return {
      ok: true,
      provider: 'sqlite',
      driver: 'node:sqlite DatabaseSync',
      schemaVersion: this.schemaVersion,
      databasePath: safeRelativePath(this.dbPath),
      runtime: {
        node: process.versions.node,
        platform: process.platform
      },
      files: {
        main: fileInfo(this.dbPath),
        wal: fileInfo(`${this.dbPath}-wal`),
        shm: fileInfo(`${this.dbPath}-shm`)
      },
      sqlite: {
        version: sqliteVersion && sqliteVersion.version ? sqliteVersion.version : '',
        journalMode: journalMode && journalMode.journal_mode ? journalMode.journal_mode : '',
        foreignKeys: Boolean(Number(foreignKeys && foreignKeys.foreign_keys)),
        quickCheck: quickCheck && quickCheck.quick_check ? quickCheck.quick_check : ''
      },
      stats: this.stats(),
      tables
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
