'use strict';

const fs = require('node:fs');
const path = require('node:path');
const { DatabaseSync } = require('node:sqlite');
const ProposalSnapshot = require('../proposal-snapshot');

const PROVIDER = 'sqlite';
const SCHEMA_VERSION = 'bancus.proposal-secure-share.sqlite.v1';
const DEFAULT_DB_PATH = path.join(__dirname, '..', '..', '.runtime', 'bancus-fraternis-proposal-share.sqlite');
const MIGRATION_PATH = path.join(__dirname, 'migrations', '002_proposal_secure_share.sql');

function cleanText(value, max = 160) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function parseJson(value, label) {
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

class SqliteProposalShareRepository {
  constructor(options = {}) {
    this.provider = PROVIDER;
    this.schemaVersion = SCHEMA_VERSION;
    this.dbPath = path.resolve(options.dbPath || process.env.BANCUS_SHARE_DB_PATH || DEFAULT_DB_PATH);
    this.ownsConnection = !options.db;
    if (this.ownsConnection) {
      fs.mkdirSync(path.dirname(this.dbPath), { recursive: true });
      this.db = new DatabaseSync(this.dbPath);
    } else {
      this.db = options.db;
    }
    this.migrate(options.migrationPath || MIGRATION_PATH);
  }

  migrate(migrationPath) {
    const sql = fs.readFileSync(migrationPath, 'utf8');
    this.db.exec(sql);
  }

  close() {
    if (this.ownsConnection && this.db) this.db.close();
  }

  insertSnapshot(input = {}) {
    const snapshot = ProposalSnapshot.hydrate(input.snapshot || {});
    const ownerId = cleanText(input.ownerId, 120);
    if (!ownerId) throw new Error('ownerId e obrigatorio para persistir o snapshot.');

    if (snapshot.version === 1) {
      if (snapshot.parentSnapshotId) throw new Error('Snapshot inicial nao pode possuir parentSnapshotId.');
      if (snapshot.status !== ProposalSnapshot.STATUS.DRAFT) throw new Error('Snapshot inicial precisa estar em rascunho.');
    } else {
      const parentRecord = this.getSnapshot(snapshot.parentSnapshotId);
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

    this.db.prepare(`
      INSERT INTO proposal_snapshots (
        id, proposal_id, version, parent_snapshot_id, status, engine_version, data_base,
        project_json, result_json, review_json, provenance_json, content_hash, owner_id, created_at
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `).run(
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
    );
    return Object.freeze({ snapshot, ownerId });
  }

  getSnapshot(snapshotId) {
    const id = cleanText(snapshotId, 120);
    if (!id) return null;
    const row = this.db.prepare('SELECT * FROM proposal_snapshots WHERE id = ? LIMIT 1').get(id);
    if (!row) return null;
    return Object.freeze({ snapshot: snapshotFromRow(row), ownerId: row.owner_id });
  }

  listSnapshotVersions(proposalId, options = {}) {
    const id = cleanText(proposalId, 120);
    const ownerId = cleanText(options.ownerId, 120);
    if (!id) return [];
    const rows = ownerId
      ? this.db.prepare('SELECT * FROM proposal_snapshots WHERE proposal_id = ? AND owner_id = ? ORDER BY version ASC').all(id, ownerId)
      : this.db.prepare('SELECT * FROM proposal_snapshots WHERE proposal_id = ? ORDER BY version ASC').all(id);
    return rows.map((row) => Object.freeze({ snapshot: snapshotFromRow(row), ownerId: row.owner_id }));
  }

  publishSnapshot(input = {}) {
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

    this.db.exec('BEGIN IMMEDIATE');
    try {
      this.insertSnapshot({ snapshot, ownerId });
      this.db.prepare(`
        INSERT INTO proposal_shares (
          id, snapshot_id, terminal_snapshot_id, token_hash, status, owner_id,
          created_at, expires_at, revoked_at, expired_at
        )
        VALUES (?, ?, NULL, ?, ?, ?, ?, ?, '', '')
      `).run(
        cleanText(share.id, 120),
        snapshot.id,
        share.tokenHash,
        cleanText(share.status, 30),
        ownerId,
        cleanText(share.createdAt, 40),
        cleanText(share.expiresAt, 40)
      );
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return Object.freeze({ snapshot, share: this.getShare(share.id) });
  }

  getShare(shareId) {
    const id = cleanText(shareId, 120);
    if (!id) return null;
    return shareFromRow(this.db.prepare('SELECT * FROM proposal_shares WHERE id = ? LIMIT 1').get(id));
  }

  findShareByTokenHash(hash) {
    const value = cleanText(hash, 64);
    if (!/^[a-f0-9]{64}$/.test(value)) return null;
    return shareFromRow(this.db.prepare('SELECT * FROM proposal_shares WHERE token_hash = ? LIMIT 1').get(value));
  }

  hasOwnerRecords(ownerId) {
    const id = cleanText(ownerId, 120);
    if (!id) return false;
    const row = this.db.prepare(`
      SELECT 1 AS found
      FROM proposal_snapshots
      WHERE owner_id = ?
      UNION ALL
      SELECT 1 AS found
      FROM proposal_shares
      WHERE owner_id = ?
      LIMIT 1
    `).get(id, id);
    return Boolean(row);
  }

  terminateShare(input = {}) {
    const shareId = cleanText(input.shareId, 120);
    const ownerId = cleanText(input.ownerId, 120);
    const status = cleanText(input.status, 30);
    const at = cleanText(input.at, 40);
    const terminalSnapshot = ProposalSnapshot.hydrate(input.terminalSnapshot || {});
    if (!['expirada', 'revogada'].includes(status)) throw new Error('Estado terminal de link invalido.');

    this.db.exec('BEGIN IMMEDIATE');
    try {
      const current = this.getShare(shareId);
      if (!current || current.ownerId !== ownerId) throw new Error('Compartilhamento nao encontrado.');
      if (current.status !== 'ativa') throw new Error('Compartilhamento ja esta em estado terminal.');
      if (terminalSnapshot.parentSnapshotId !== current.snapshotId) {
        throw new Error('Snapshot terminal nao pertence ao snapshot publicado do link.');
      }
      this.insertSnapshot({ snapshot: terminalSnapshot, ownerId });
      const revokedAt = status === 'revogada' ? at : '';
      const expiredAt = status === 'expirada' ? at : '';
      const update = this.db.prepare(`
        UPDATE proposal_shares
        SET status = ?, terminal_snapshot_id = ?, revoked_at = ?, expired_at = ?
        WHERE id = ? AND owner_id = ? AND status = 'ativa'
      `).run(status, terminalSnapshot.id, revokedAt, expiredAt, shareId, ownerId);
      if (Number(update.changes || 0) !== 1) throw new Error('Compartilhamento nao pode ser finalizado.');
      this.db.exec('COMMIT');
    } catch (error) {
      this.db.exec('ROLLBACK');
      throw error;
    }
    return Object.freeze({ snapshot: terminalSnapshot, share: this.getShare(shareId) });
  }

  stats() {
    const snapshots = this.db.prepare('SELECT COUNT(*) AS total FROM proposal_snapshots').get();
    const shares = this.db.prepare('SELECT COUNT(*) AS total FROM proposal_shares').get();
    const activeShares = this.db.prepare("SELECT COUNT(*) AS total FROM proposal_shares WHERE status = 'ativa'").get();
    return Object.freeze({
      schemaVersion: this.schemaVersion,
      provider: this.provider,
      snapshots: Number(snapshots.total || 0),
      shares: Number(shares.total || 0),
      activeShares: Number(activeShares.total || 0)
    });
  }
}

function createProposalShareRepository(options = {}) {
  return new SqliteProposalShareRepository(options);
}

module.exports = {
  PROVIDER,
  SCHEMA_VERSION,
  DEFAULT_DB_PATH,
  MIGRATION_PATH,
  SqliteProposalShareRepository,
  createProposalShareRepository,
  snapshotFromRow,
  shareFromRow
};
