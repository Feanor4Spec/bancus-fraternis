BEGIN;

DROP TABLE IF EXISTS journey_proposals;
DROP TABLE IF EXISTS journey_simulations;
DROP TABLE IF EXISTS journey_leads;
DROP TABLE IF EXISTS journey_entities;
DROP TABLE IF EXISTS snapshots;
DROP TABLE IF EXISTS events;
DROP TABLE IF EXISTS sessions;
DROP TABLE IF EXISTS users;
DELETE FROM bancus_schema_migrations
WHERE migration_name = 'postgresql/001_bancus_fraternis.sql';
DROP TABLE IF EXISTS bancus_schema_migrations;

COMMIT;
