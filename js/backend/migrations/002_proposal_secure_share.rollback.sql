PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

DROP TRIGGER IF EXISTS proposal_snapshots_prevent_delete;
DROP TRIGGER IF EXISTS proposal_snapshots_prevent_update;
DROP TABLE IF EXISTS proposal_shares;
DROP TABLE IF EXISTS proposal_snapshots;

COMMIT;

PRAGMA foreign_keys = ON;
