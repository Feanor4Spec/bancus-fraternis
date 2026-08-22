BEGIN;

CREATE TABLE IF NOT EXISTS proposal_snapshots (
  id TEXT PRIMARY KEY,
  proposal_id TEXT NOT NULL,
  version INTEGER NOT NULL CHECK (version > 0),
  parent_snapshot_id TEXT DEFAULT NULL REFERENCES proposal_snapshots(id) ON DELETE RESTRICT,
  status TEXT NOT NULL CHECK (status IN ('rascunho', 'validada', 'revisada', 'publicada', 'expirada', 'revogada')),
  engine_version TEXT NOT NULL,
  data_base TEXT NOT NULL,
  project_json TEXT NOT NULL,
  result_json TEXT NOT NULL,
  review_json TEXT NOT NULL DEFAULT '{}',
  provenance_json TEXT NOT NULL DEFAULT '{}',
  content_hash TEXT NOT NULL,
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS proposal_shares (
  id TEXT PRIMARY KEY,
  snapshot_id TEXT NOT NULL REFERENCES proposal_snapshots(id) ON DELETE RESTRICT,
  terminal_snapshot_id TEXT DEFAULT NULL REFERENCES proposal_snapshots(id) ON DELETE RESTRICT,
  token_hash TEXT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('ativa', 'expirada', 'revogada')),
  owner_id TEXT NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL CHECK (expires_at > created_at),
  revoked_at TEXT DEFAULT '',
  expired_at TEXT DEFAULT ''
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

CREATE OR REPLACE FUNCTION bancus_prevent_proposal_snapshot_mutation()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  RAISE EXCEPTION 'proposal_snapshots_are_immutable';
END;
$$;

DROP TRIGGER IF EXISTS proposal_snapshots_prevent_update ON proposal_snapshots;
CREATE TRIGGER proposal_snapshots_prevent_update
BEFORE UPDATE ON proposal_snapshots
FOR EACH ROW EXECUTE FUNCTION bancus_prevent_proposal_snapshot_mutation();

DROP TRIGGER IF EXISTS proposal_snapshots_prevent_delete ON proposal_snapshots;
CREATE TRIGGER proposal_snapshots_prevent_delete
BEFORE DELETE ON proposal_snapshots
FOR EACH ROW EXECUTE FUNCTION bancus_prevent_proposal_snapshot_mutation();

INSERT INTO bancus_schema_migrations (migration_name, schema_version, applied_at)
VALUES (
  'postgresql/002_proposal_secure_share.sql',
  'bancus.proposal-secure-share.postgresql.v1',
  CURRENT_TIMESTAMP::TEXT
)
ON CONFLICT (migration_name) DO UPDATE
SET schema_version = EXCLUDED.schema_version;

COMMIT;
