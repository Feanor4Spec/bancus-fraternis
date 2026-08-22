'use strict';

const fs = require('node:fs');
const path = require('node:path');

const PROVIDER = 'sqlite';
const DRIVER = 'node:sqlite DatabaseSync';

function createProviderError(code, message, cause) {
  const error = new Error(message);
  error.code = code;
  if (cause) error.cause = cause;
  return error;
}

function resolveDatabaseSync(options = {}) {
  if (typeof options.DatabaseSync === 'function') return options.DatabaseSync;
  try {
    return require('node:sqlite').DatabaseSync;
  } catch (cause) {
    throw createProviderError(
      'BANCUS_SQLITE_DRIVER_UNAVAILABLE',
      'O runtime atual nao disponibiliza o driver node:sqlite necessario para o provider sqlite.',
      cause
    );
  }
}

function createSqliteProvider(options = {}) {
  const dbPath = path.resolve(String(options.dbPath || ''));
  if (!dbPath) {
    throw createProviderError('BANCUS_SQLITE_PATH_REQUIRED', 'O provider sqlite exige um caminho de banco valido.');
  }

  fs.mkdirSync(path.dirname(dbPath), { recursive: true });
  const DatabaseSync = resolveDatabaseSync(options);
  const db = new DatabaseSync(dbPath);

  try {
    if (typeof options.initializeSchema === 'function') options.initializeSchema(db);
  } catch (cause) {
    try {
      db.close();
    } catch (closeError) {
      // A falha original de schema e mais acionavel que a falha secundaria de fechamento.
    }
    throw createProviderError(
      'BANCUS_SQLITE_SCHEMA_INITIALIZATION_FAILED',
      'Nao foi possivel inicializar o schema do provider sqlite.',
      cause
    );
  }

  return Object.freeze({
    provider: PROVIDER,
    driver: DRIVER,
    synchronous: true,
    db,
    dbPath
  });
}

module.exports = {
  PROVIDER,
  DRIVER,
  createSqliteProvider
};
