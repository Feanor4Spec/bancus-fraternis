'use strict';

const ProposalSnapshot = require('../proposal-snapshot');

const PROVIDER = 'postgresql';
const SCHEMA_VERSION = 'bancus.proposal-secure-share.postgresql.v1';
const MIGRATION_NAME = 'postgresql/002_proposal_secure_share.sql';
const REQUIRED_TABLES = Object.freeze(['proposal_snapshots', 'proposal_shares']);
const REQUIRED_COLUMNS = Object.freeze({
  proposal_snapshots: Object.freeze([
    'id', 'proposal_id', 'version', 'parent_snapshot_id', 'status', 'engine_version',
    'data_base', 'project_json', 'result_json', 'review_json', 'provenance_json',
    'content_hash', 'owner_id', 'created_at'
  ]),
  proposal_shares: Object.freeze([
    'id', 'snapshot_id', 'terminal_snapshot_id', 'token_hash', 'status', 'owner_id',
    'created_at', 'expires_at', 'revoked_at', 'expired_at'
  ])
});
const REQUIRED_TRIGGERS = Object.freeze([
  'proposal_snapshots_prevent_update',
  'proposal_snapshots_prevent_delete'
]);

function cleanText(value, max = 160) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function parseJson(value, label) {
  if (value && typeof value === 'object') return value;
  try {
    return JSON.parse(value || '{}');
  } catch (error) {
    throw new Error(`JSON persistido invalido em ${label}.`);
  }
}

function snapshotFromRow(row) {
  if (!row) return null;
  return ProposalSnapshot.hydrate({
    schema: ProposalSnapshot.SCHEMA,
    id: row.id,
    proposalId: row.proposal_id,
    version: Number(row.version),
    parentSnapshotId: row.parent_snapshot_id || '',
    status: row.status,
    engineVersion: row.engine_version,
    dataBase: row.data_base,
    project: parseJson(row.project_json, 'proposal_snapshots.project_json'),
    result: parseJson(row.result_json, 'proposal_snapshots.result_json'),
    review: parseJson(row.review_json, 'proposal_snapshots.review_json'),
    provenance: parseJson(row.provenance_json, 'proposal_snapshots.provenance_json'),
    createdAt: row.created_at,
    contentHash: row.content_hash
  });
}

function shareFromRow(row) {
  if (!row) return null;
  return Object.freeze({
    id: row.id,
    ownerId: row.owner_id,
    snapshotId: row.snapshot_id,
    terminalSnapshotId: row.terminal_snapshot_id || '',
    tokenHash: row.token_hash,
    status: row.status,
    createdAt: row.created_at,
    expiresAt: row.expires_at,
    revokedAt: row.revoked_at || '',
    expiredAt: row.expired_at || ''
  });
}

class PostgresqlProposalShareRepository {
  constructor(options = {}) {
    const database = options.database;
    if (!database || database.provider !== PROVIDER || typeof database.query !== 'function') {
      throw new Error('O repositorio de propostas PostgreSQL exige o provider PostgreSQL ativo.');
    }
    this.provider = PROVIDER;
    this.schemaVersion = SCHEMA_VERSION;
    this.database = database;
    this.ownsConnection = false;
  }

  query(sql, params = []) {
    return this.database.query(sql, params);
  }

  withTransaction(callback) {
    if (typeof this.database.withTransaction === 'function') {
      return this.database.withTransaction(callback);
    }
    return callback();
  }

  async close() {
    // O pool pertence ao provider principal e e encerrado por ele.
  }

  async insertSnapshot(input = {}) {
    const snapshot = ProposalSnapshot.hydrate(input.snapshot || {});
    const ownerId = cleanText(input.ownerId, 120);
    if (!ownerId) throw new Error('ownerId e obrigatorio para persistir o snapshot.');

    if (snapshot.version === 1) {
      if (snapshot.parentSnapshotId) throw new Error('Snapshot inicial nao pode possuir parentSnapshotId.');
      if (snapshot.status !== ProposalSnapshot.STATUS.DRAFT) throw new Error('Snapshot inicial precisa estar em rascunho.');
    } else {
      const parentRecord = await this.getSnapshot(snapshot.parentSnapshotId);
      if (!parentRecord) throw new Error('Snapshot pai nao encontrado.');
      if (parentRecord.ownerId !== ownerId) throw new Error('Snapshot pai pertence a outro proprietario.');
      if (parentRecord.snapshot.proposalId !== snapshot.proposalId) throw new Error('Linhagem de proposta inconsistente.');
      if (parentRecord.snapshot.version + 1 !== snapshot.version) throw new Error('Versao de snapshot fora de sequencia.');
      if (!(ProposalSnapshot.TRANSITIONS[parentRecord.snapshot.status] || []).includes(snapshot.status)) {
        throw new Error('Transicao de estado invalida na linhagem persistida.');
      }
      if (parentRecord.snapshot.engineVersion !== snapshot.engineVersion || parentRecord.snapshot.dataBase !== snapshot.dataBase) {
        throw new Error('Motor ou dataBase nao podem mudar durante uma transicao de estado.');
      }
      if (
        ProposalSnapshot.stableStringify(parentRecord.snapshot.project) !== ProposalSnapshot.stableStringify(snapshot.project)
        || ProposalSnapshot.stableStringify(parentRecord.snapshot.result) !== ProposalSnapshot.stableStringify(snapshot.result)
      ) {
        throw new Error('Project e result sao imutaveis dentro da linhagem publicada.');
      }
    }

    await this.query(`
      INSERT INTO proposal_snapshots (
        id, proposal_id, version, parent_snapshot_id, status, engine_version, data_base,
        project_json, result_json, review_json, provenance_json, content_hash, owner_id, created_at
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14)
    `, [
      snapshot.id,
      snapshot.proposalId,
      snapshot.version,
      snapshot.parentSnapshotId || null,
      snapshot.status,
      snapshot.engineVersion,
      snapshot.dataBase,
      JSON.stringify(snapshot.project),
      JSON.stringify(snapshot.result),
      JSON.stringify(snapshot.review),
      JSON.stringify(snapshot.provenance),
      snapshot.contentHash,
      ownerId,
      snapshot.createdAt
    ]);
    return Object.freeze({ snapshot, ownerId });
  }

  async getSnapshot(snapshotId) {
    const id = cleanText(snapshotId, 120);
    if (!id) return null;
    const result = await this.query('SELECT * FROM proposal_snapshots WHERE id = $1 LIMIT 1', [id]);
    const row = result && Array.isArray(result.rows) ? result.rows[0] : null;
    return row ? Object.freeze({ snapshot: snapshotFromRow(row), ownerId: row.owner_id }) : null;
  }

  async listSnapshotVersions(proposalId, options = {}) {
    const id = cleanText(proposalId, 120);
    const ownerId = cleanText(options.ownerId, 120);
    if (!id) return [];
    const result = ownerId
      ? await this.query(
        'SELECT * FROM proposal_snapshots WHERE proposal_id = $1 AND owner_id = $2 ORDER BY version ASC',
        [id, ownerId]
      )
      : await this.query('SELECT * FROM proposal_snapshots WHERE proposal_id = $1 ORDER BY version ASC', [id]);
    return (result.rows || []).map((row) => Object.freeze({ snapshot: snapshotFromRow(row), ownerId: row.owner_id }));
  }

  async publishSnapshot(input = {}) {
    const snapshot = ProposalSnapshot.hydrate(input.snapshot || {});
    const ownerId = cleanText(input.ownerId, 120);
    const share = input.share || {};
    if (snapshot.status !== ProposalSnapshot.STATUS.PUBLISHED) {
      throw new Error('Somente snapshot publicado pode receber um link.');
    }
    if (!ownerId || ownerId !== cleanText(share.ownerId, 120)) {
      throw new Error('Proprietario do link inconsistente.');
    }
    if (!cleanText(share.id, 120) || cleanText(share.snapshotId, 120) !== snapshot.id || share.status !== 'ativa') {
      throw new Error('Registro inicial de compartilhamento invalido.');
    }
    if (!/^[a-f0-9]{64}$/.test(cleanText(share.tokenHash, 64))) {
      throw new Error('Hash de token invalido.');
    }
    const createdAt = new Date(share.createdAt);
    const expiresAt = new Date(share.expiresAt);
    if (!Number.isFinite(createdAt.getTime()) || !Number.isFinite(expiresAt.getTime()) || expiresAt <= createdAt) {
      throw new Error('Validade do compartilhamento invalida.');
    }

    return this.withTransaction(async () => {
      await this.insertSnapshot({ snapshot, ownerId });
      await this.query(`
        INSERT INTO proposal_shares (
          id, snapshot_id, terminal_snapshot_id, token_hash, status, owner_id,
          created_at, expires_at, revoked_at, expired_at
        ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, '', '')
      `, [
        cleanText(share.id, 120),
        snapshot.id,
        share.tokenHash,
        cleanText(share.status, 30),
        ownerId,
        cleanText(share.createdAt, 40),
        cleanText(share.expiresAt, 40)
      ]);
      return Object.freeze({ snapshot, share: await this.getShare(share.id) });
    });
  }

  async getShare(shareId) {
    const id = cleanText(shareId, 120);
    if (!id) return null;
    const result = await this.query('SELECT * FROM proposal_shares WHERE id = $1 LIMIT 1', [id]);
    return shareFromRow(result && Array.isArray(result.rows) ? result.rows[0] : null);
  }

  async findShareByTokenHash(hash) {
    const value = cleanText(hash, 64);
    if (!/^[a-f0-9]{64}$/.test(value)) return null;
    const result = await this.query('SELECT * FROM proposal_shares WHERE token_hash = $1 LIMIT 1', [value]);
    return shareFromRow(result && Array.isArray(result.rows) ? result.rows[0] : null);
  }

  async hasOwnerRecords(ownerId) {
    const id = cleanText(ownerId, 120);
    if (!id) return false;
    const result = await this.query(`
      SELECT 1 AS found
      FROM proposal_snapshots
      WHERE owner_id = $1
      UNION ALL
      SELECT 1 AS found
      FROM proposal_shares
      WHERE owner_id = $1
      LIMIT 1
    `, [id]);
    return Boolean(result.rows && result.rows[0]);
  }

  async terminateShare(input = {}) {
    const shareId = cleanText(input.shareId, 120);
    const ownerId = cleanText(input.ownerId, 120);
    const status = cleanText(input.status, 30);
    const at = cleanText(input.at, 40);
    const terminalSnapshot = ProposalSnapshot.hydrate(input.terminalSnapshot || {});
    if (!['expirada', 'revogada'].includes(status)) throw new Error('Estado terminal de link invalido.');

    return this.withTransaction(async () => {
      const current = await this.getShare(shareId);
      if (!current || current.ownerId !== ownerId) throw new Error('Compartilhamento nao encontrado.');
      if (current.status !== 'ativa') throw new Error('Compartilhamento ja esta em estado terminal.');
      if (terminalSnapshot.parentSnapshotId !== current.snapshotId) {
        throw new Error('Snapshot terminal nao pertence ao snapshot publicado do link.');
      }
      await this.insertSnapshot({ snapshot: terminalSnapshot, ownerId });
      const revokedAt = status === 'revogada' ? at : '';
      const expiredAt = status === 'expirada' ? at : '';
      const update = await this.query(`
        UPDATE proposal_shares
        SET status = $1, terminal_snapshot_id = $2, revoked_at = $3, expired_at = $4
        WHERE id = $5 AND owner_id = $6 AND status = 'ativa'
        RETURNING id
      `, [status, terminalSnapshot.id, revokedAt, expiredAt, shareId, ownerId]);
      if (Number(update.rowCount || 0) !== 1) throw new Error('Compartilhamento nao pode ser finalizado.');
      return Object.freeze({ snapshot: terminalSnapshot, share: await this.getShare(shareId) });
    });
  }

  async stats() {
    const result = await this.query(`
      SELECT
        (SELECT COUNT(*) FROM proposal_snapshots) AS snapshots,
        (SELECT COUNT(*) FROM proposal_shares) AS shares,
        (SELECT COUNT(*) FROM proposal_shares WHERE status = 'ativa') AS active_shares
    `);
    const row = result.rows[0] || {};
    return Object.freeze({
      schemaVersion: this.schemaVersion,
      provider: this.provider,
      snapshots: Number(row.snapshots || 0),
      shares: Number(row.shares || 0),
      activeShares: Number(row.active_shares || 0)
    });
  }
}

async function verifyProposalShareSchema(database) {
  const tablesResult = await database.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = current_schema()
      AND table_name = ANY($1::text[])
    ORDER BY table_name ASC
  `, [REQUIRED_TABLES]);
  const found = new Set((tablesResult.rows || []).map((row) => String(row.table_name || '')));
  const missing = REQUIRED_TABLES.filter((table) => !found.has(table));
  if (missing.length) {
    const error = new Error(`Schema de propostas PostgreSQL incompleto. Tabelas ausentes: ${missing.join(', ')}.`);
    error.code = 'BANCUS_POSTGRESQL_PROPOSAL_SCHEMA_MISMATCH';
    throw error;
  }

  const columnsResult = await database.query(`
    SELECT table_name, column_name
    FROM information_schema.columns
    WHERE table_schema = current_schema()
      AND table_name = ANY($1::text[])
    ORDER BY table_name, ordinal_position
  `, [REQUIRED_TABLES]);
  const foundColumns = new Map(REQUIRED_TABLES.map((table) => [table, new Set()]));
  (columnsResult.rows || []).forEach((row) => {
    if (foundColumns.has(row.table_name)) foundColumns.get(row.table_name).add(String(row.column_name || ''));
  });
  const missingColumns = [];
  Object.entries(REQUIRED_COLUMNS).forEach(([table, columns]) => {
    columns.forEach((column) => {
      if (!foundColumns.get(table).has(column)) missingColumns.push(`${table}.${column}`);
    });
  });
  if (missingColumns.length) {
    const error = new Error(`Schema de propostas PostgreSQL incompleto. Colunas ausentes: ${missingColumns.join(', ')}.`);
    error.code = 'BANCUS_POSTGRESQL_PROPOSAL_SCHEMA_MISMATCH';
    throw error;
  }
  const migrationResult = await database.query(`
    SELECT migration_name, schema_version
    FROM bancus_schema_migrations
    WHERE migration_name = $1
    LIMIT 1
  `, [MIGRATION_NAME]);
  const migration = migrationResult.rows && migrationResult.rows[0];
  if (!migration || String(migration.schema_version || '') !== SCHEMA_VERSION) {
    const error = new Error(`Migration PostgreSQL obrigatoria nao confirmada: ${MIGRATION_NAME}.`);
    error.code = 'BANCUS_POSTGRESQL_PROPOSAL_SCHEMA_MISMATCH';
    throw error;
  }

  const triggersResult = await database.query(`
    SELECT trigger_name
    FROM information_schema.triggers
    WHERE event_object_schema = current_schema()
      AND event_object_table = 'proposal_snapshots'
    ORDER BY trigger_name
  `);
  const foundTriggers = new Set((triggersResult.rows || []).map((row) => String(row.trigger_name || '')));
  const missingTriggers = REQUIRED_TRIGGERS.filter((trigger) => !foundTriggers.has(trigger));
  if (missingTriggers.length) {
    const error = new Error(`Schema de propostas PostgreSQL sem protecao de imutabilidade: ${missingTriggers.join(', ')}.`);
    error.code = 'BANCUS_POSTGRESQL_PROPOSAL_SCHEMA_MISMATCH';
    throw error;
  }
}

async function createPostgresqlProposalShareRepository(options = {}) {
  await verifyProposalShareSchema(options.database);
  return new PostgresqlProposalShareRepository(options);
}

module.exports = {
  PROVIDER,
  SCHEMA_VERSION,
  MIGRATION_NAME,
  REQUIRED_TABLES,
  REQUIRED_COLUMNS,
  REQUIRED_TRIGGERS,
  PostgresqlProposalShareRepository,
  createPostgresqlProposalShareRepository,
  verifyProposalShareSchema,
  snapshotFromRow,
  shareFromRow
};
