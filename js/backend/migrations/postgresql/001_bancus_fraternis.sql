BEGIN;

CREATE TABLE IF NOT EXISTS bancus_schema_migrations (
  migration_name TEXT PRIMARY KEY,
  schema_version TEXT NOT NULL,
  applied_at TEXT NOT NULL
);

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
  password_algorithm TEXT NOT NULL DEFAULT 'scrypt-sha256',
  password_updated_at TEXT NOT NULL,
  created_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  last_login_at TEXT DEFAULT ''
);

CREATE TABLE IF NOT EXISTS sessions (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  role TEXT NOT NULL,
  created_at TEXT NOT NULL,
  expires_at TEXT NOT NULL,
  revoked_at TEXT DEFAULT ''
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
  amount DOUBLE PRECISION DEFAULT 0,
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
  amount DOUBLE PRECISION DEFAULT 0,
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
  amount DOUBLE PRECISION DEFAULT 0,
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
  amount DOUBLE PRECISION DEFAULT 0,
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

INSERT INTO bancus_schema_migrations (migration_name, schema_version, applied_at)
VALUES (
  'postgresql/001_bancus_fraternis.sql',
  'bancus-fraternis.local-db.v1',
  CURRENT_TIMESTAMP::TEXT
)
ON CONFLICT (migration_name) DO UPDATE
SET schema_version = EXCLUDED.schema_version;

COMMIT;
