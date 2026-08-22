BEGIN;

DROP TRIGGER IF EXISTS proposal_snapshots_prevent_delete ON proposal_snapshots;
DROP TRIGGER IF EXISTS proposal_snapshots_prevent_update ON proposal_snapshots;
DROP FUNCTION IF EXISTS bancus_prevent_proposal_snapshot_mutation();
DROP TABLE IF EXISTS proposal_shares;
DROP TABLE IF EXISTS proposal_snapshots;
DELETE FROM bancus_schema_migrations
WHERE migration_name = 'postgresql/002_proposal_secure_share.sql';

COMMIT;
