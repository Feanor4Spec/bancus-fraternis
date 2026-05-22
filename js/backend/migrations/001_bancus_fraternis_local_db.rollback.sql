-- Rollback for 001_bancus_fraternis_local_db.sql.
-- This is intended for empty validator databases or explicit local rebuilds only.

PRAGMA foreign_keys = OFF;

BEGIN TRANSACTION;

DROP TABLE IF EXISTS journey_proposals;
DROP TABLE IF EXISTS journey_simulations;
DROP TABLE IF EXISTS journey_leads;
DROP TABLE IF EXISTS journey_entities;
DROP TABLE IF EXISTS snapshots;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;

COMMIT;

PRAGMA foreign_keys = ON;
