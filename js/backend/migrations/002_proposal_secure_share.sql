PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

BEGIN TRANSACTION;

CREATE TABLE IF NOT EXISTS proposal_snapshots (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  parent_snapshot_id TEXT DEFAULT NULL,
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'validada', 'revisada', 'publicada', 'expirada', 'revogada')),
  engine_version TEXT NOT NULL,
  data_base TEXT NOT NULL,
  project_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  review_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  FOREIGN KEY (parent_snapshot_id) REFERENCES proposal_snapshots(id) ON DELETE RESTRICT
);

CREATE TABLE IF NOT EXISTS proposal_shares (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL,
  terminal_snapshot_id TEXT DEFAULT NULL,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ativa', 'expirada', 'revogada')),
  owner_id TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK (expires_at > created_at),
  revoked_at TEXT DEFAULT '',
  expired_at TEXT DEFAULT '',
  FOREIGN KEY (snapshot_id) REFERENCES proposal_snapshots(id) ON DELETE RESTRICT,
  FOREIGN KEY (terminal_snapshot_id) REFERENCES proposal_snapshots(id) ON DELETE RESTRICT
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_snapshots_proposal_version
  ON proposal_snapshots(owner_id, proposal_id, version);
CREATE INDEX IF NOT EXISTS idx_proposal_snapshots_owner
  ON proposal_snapshots(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_snapshots_parent
  ON proposal_snapshots(parent_snapshot_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_shares_token_hash
  ON proposal_shares(token_hash);
CREATE INDEX IF NOT EXISTS idx_proposal_shares_owner
  ON proposal_shares(owner_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_proposal_shares_expiry
  ON proposal_shares(status, expires_at);

CREATE TRIGGER IF NOT EXISTS proposal_snapshots_prevent_update
BEFORE UPDATE ON proposal_snapshots
BEGIN
  SELECT RAISE(ABORT, 'proposal_snapshots_are_immutable');
END;

CREATE TRIGGER IF NOT EXISTS proposal_snapshots_prevent_delete
BEFORE DELETE ON proposal_snapshots
BEGIN
  SELECT RAISE(ABORT, 'proposal_snapshots_are_immutable');
END;

COMMIT;
