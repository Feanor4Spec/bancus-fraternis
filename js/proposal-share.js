'use strict';

const crypto = require('node:crypto');
const ProposalSnapshot = require('./proposal-snapshot');

const SCHEMA = 'bancus.proposal-secure-share.v1';
const DEFAULT_VALIDITY_DAYS = 30;
const MAX_VALIDITY_DAYS = 365;
const TOKEN_BYTES = 32;

const SHARE_STATUS = Object.freeze({
  ACTIVE: 'ativa',
  EXPIRED: 'expirada',
  REVOKED: 'revogada'
});

const REPOSITORY_METHODS = Object.freeze([
  'insertSnapshot',
  'getSnapshot',
  'publishSnapshot',
  'getShare',
  'findShareByTokenHash',
  'terminateShare'
]);

class ProposalShareError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ProposalShareError';
    this.code = code;
    this.status = status;
  }
}

function nowDate(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  const date = value instanceof Date ? new Date(value.getTime()) : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new ProposalShareError('invalid-clock', 'Relogio invalido para o compartilhamento.');
  }
  return date;
}

function cleanText(value, max = 160) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function makeId(prefix) {
  return `${prefix}-${crypto.randomBytes(16).toString('hex')}`;
}

function makeOpaqueToken() {
  return crypto.randomBytes(TOKEN_BYTES).toString('base64url');
}

function tokenHash(token) {
  return crypto.createHash('sha256').update(String(token || '')).digest('hex');
}

function assertOpaqueToken(token) {
  const value = cleanText(token, 256);
  if (!/^[A-Za-z0-9_-]{32,128}$/.test(value)) {
    throw new ProposalShareError('invalid-token', 'Token de compartilhamento invalido.', 404);
  }
  return value;
}

function assertRepository(repository) {
  const missing = REPOSITORY_METHODS.filter((method) => !repository || typeof repository[method] !== 'function');
  if (missing.length) {
    throw new ProposalShareError(
      'invalid-repository',
      `Repositorio de compartilhamento incompleto: ${missing.join(', ')}.`,
      500
    );
  }
  return repository;
}

function normalizeValidityDays(value) {
  if (value === undefined || value === null || value === '') return DEFAULT_VALIDITY_DAYS;
  const days = Number(value);
  if (!Number.isInteger(days) || days < 1 || days > MAX_VALIDITY_DAYS) {
    throw new ProposalShareError(
      'invalid-validity',
      `validityDays precisa ser um inteiro entre 1 e ${MAX_VALIDITY_DAYS}.`,
      422
    );
  }
  return days;
}

function publicShareRecord(share) {
  if (!share) return null;
  return Object.freeze({
    schema: SCHEMA,
    id: share.id,
    snapshotId: share.snapshotId,
    status: share.status,
    createdAt: share.createdAt,
    expiresAt: share.expiresAt,
    revokedAt: share.revokedAt || '',
    expiredAt: share.expiredAt || ''
  });
}

function ownershipError() {
  return new ProposalShareError('not-found', 'Snapshot ou compartilhamento nao encontrado.', 404);
}

function isThenable(value) {
  return Boolean(value && typeof value.then === 'function');
}

function mapMaybe(value, mapper) {
  return isThenable(value) ? Promise.resolve(value).then(mapper) : mapper(value);
}

function createProposalShareService(options = {}) {
  const repository = assertRepository(options.repository);
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  const tokenFactory = typeof options.tokenFactory === 'function' ? options.tokenFactory : makeOpaqueToken;
  const snapshotIdFactory = typeof options.snapshotIdFactory === 'function'
    ? options.snapshotIdFactory
    : () => makeId('PSN');
  const shareIdFactory = typeof options.shareIdFactory === 'function'
    ? options.shareIdFactory
    : () => makeId('PSH');

  function ownerIdFrom(context) {
    const ownerId = cleanText(context && context.ownerId, 120);
    if (!ownerId) throw new ProposalShareError('missing-owner', 'Contexto de proprietario obrigatorio.', 401);
    return ownerId;
  }

  function ownedSnapshot(snapshotId, context) {
    const ownerId = ownerIdFrom(context);
    const record = repository.getSnapshot(cleanText(snapshotId, 120));
    return mapMaybe(record, (resolvedRecord) => {
      if (!resolvedRecord || resolvedRecord.ownerId !== ownerId) throw ownershipError();
      return { ownerId, record: resolvedRecord };
    });
  }

  function ownedShare(shareId, context) {
    const ownerId = ownerIdFrom(context);
    const record = repository.getShare(cleanText(shareId, 120));
    return mapMaybe(record, (resolvedRecord) => {
      if (!resolvedRecord || resolvedRecord.ownerId !== ownerId) throw ownershipError();
      return { ownerId, record: resolvedRecord };
    });
  }

  function createSnapshot(input = {}, context = {}) {
    const ownerId = ownerIdFrom(context);
    const snapshot = ProposalSnapshot.create(input, {
      clock,
      idFactory: snapshotIdFactory
    });
    return mapMaybe(repository.insertSnapshot({ snapshot, ownerId }), () => snapshot);
  }

  function getSnapshot(snapshotId, context = {}) {
    return mapMaybe(ownedSnapshot(snapshotId, context), ({ record }) => record.snapshot);
  }

  function transitionSnapshot(snapshotId, nextStatus, patch = {}, context = {}) {
    return mapMaybe(ownedSnapshot(snapshotId, context), ({ ownerId, record }) => {
      if (![ProposalSnapshot.STATUS.VALIDATED, ProposalSnapshot.STATUS.REVIEWED].includes(nextStatus)) {
        throw new ProposalShareError(
          'protected-transition',
          'Publicacao, expiracao e revogacao usam operacoes dedicadas.',
          409
        );
      }
      const snapshot = ProposalSnapshot.transition(record.snapshot, nextStatus, patch, {
        clock,
        idFactory: snapshotIdFactory
      });
      return mapMaybe(repository.insertSnapshot({ snapshot, ownerId }), () => snapshot);
    });
  }

  function publish(snapshotId, input = {}, context = {}) {
    return mapMaybe(ownedSnapshot(snapshotId, context), ({ ownerId, record }) => {
      if (record.snapshot.status !== ProposalSnapshot.STATUS.REVIEWED) {
        throw new ProposalShareError(
          'snapshot-not-reviewed',
          'Somente um snapshot revisado pode ser publicado.',
          409
        );
      }

      const validityDays = normalizeValidityDays(input.validityDays);
      const createdAtDate = nowDate(clock);
      const createdAt = createdAtDate.toISOString();
      const expiresAt = new Date(createdAtDate.getTime() + validityDays * 24 * 60 * 60 * 1000).toISOString();
      const token = assertOpaqueToken(tokenFactory());
      const publishedSnapshot = ProposalSnapshot.transition(
        record.snapshot,
        ProposalSnapshot.STATUS.PUBLISHED,
        {
          provenance: {
            publicationPolicy: 'secure-link',
            validityDays,
            publishedAt: createdAt
          }
        },
        { clock, idFactory: snapshotIdFactory }
      );
      const share = {
        schema: SCHEMA,
        id: cleanText(shareIdFactory(), 120),
        ownerId,
        snapshotId: publishedSnapshot.id,
        tokenHash: tokenHash(token),
        status: SHARE_STATUS.ACTIVE,
        createdAt,
        expiresAt,
        revokedAt: '',
        expiredAt: '',
        terminalSnapshotId: ''
      };
      return mapMaybe(repository.publishSnapshot({ snapshot: publishedSnapshot, share, ownerId }), () => Object.freeze({
        share: publicShareRecord(share),
        token,
        path: '/api/public/proposals/resolve',
        readOnly: true,
        robots: 'noindex, nofollow, noarchive'
      }));
    });
  }

  function terminate(record, targetStatus, at) {
    const snapshotRecord = repository.getSnapshot(record.snapshotId);
    return mapMaybe(snapshotRecord, (resolvedSnapshotRecord) => {
      if (!resolvedSnapshotRecord) {
        throw new ProposalShareError('snapshot-not-found', 'Snapshot publicado nao encontrado.', 500);
      }
      const snapshotStatus = targetStatus === SHARE_STATUS.REVOKED
        ? ProposalSnapshot.STATUS.REVOKED
        : ProposalSnapshot.STATUS.EXPIRED;
      const terminalSnapshot = ProposalSnapshot.transition(
        resolvedSnapshotRecord.snapshot,
        snapshotStatus,
        {
          provenance: {
            shareId: record.id,
            terminalAt: at
          }
        },
        { clock: () => new Date(at), idFactory: snapshotIdFactory }
      );
      return repository.terminateShare({
        shareId: record.id,
        status: targetStatus,
        terminalSnapshot,
        ownerId: record.ownerId,
        at
      });
    });
  }

  function resolve(token) {
    const opaqueToken = assertOpaqueToken(token);
    const record = repository.findShareByTokenHash(tokenHash(opaqueToken));
    return mapMaybe(record, (resolvedRecord) => {
      if (!resolvedRecord) {
        throw new ProposalShareError('share-not-found', 'Proposta compartilhada indisponivel.', 404);
      }
      if (resolvedRecord.status === SHARE_STATUS.REVOKED) {
        throw new ProposalShareError('share-revoked', 'Proposta compartilhada indisponivel.', 410);
      }
      if (resolvedRecord.status === SHARE_STATUS.EXPIRED) {
        throw new ProposalShareError('share-expired', 'Proposta compartilhada indisponivel.', 410);
      }

      const currentTime = nowDate(clock);
      const expiresAt = new Date(resolvedRecord.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || currentTime.getTime() >= expiresAt.getTime()) {
        return mapMaybe(
          terminate(resolvedRecord, SHARE_STATUS.EXPIRED, currentTime.toISOString()),
          () => { throw new ProposalShareError('share-expired', 'Proposta compartilhada indisponivel.', 410); }
        );
      }

      return mapMaybe(repository.getSnapshot(resolvedRecord.snapshotId), (snapshotRecord) => {
        if (!snapshotRecord || snapshotRecord.snapshot.status !== ProposalSnapshot.STATUS.PUBLISHED) {
          throw new ProposalShareError('published-snapshot-not-found', 'Proposta compartilhada indisponivel.', 410);
        }

        return Object.freeze({
          schema: SCHEMA,
          readOnly: true,
          robots: 'noindex, nofollow, noarchive',
          expiresAt: resolvedRecord.expiresAt,
          snapshot: ProposalSnapshot.toPublicSnapshot(snapshotRecord.snapshot)
        });
      });
    });
  }

  function revoke(shareId, context = {}) {
    return mapMaybe(ownedShare(shareId, context), ({ record }) => {
      if (record.status === SHARE_STATUS.REVOKED) return publicShareRecord(record);
      if (record.status === SHARE_STATUS.EXPIRED) {
        throw new ProposalShareError('share-expired', 'Um compartilhamento expirado nao pode ser revogado.', 409);
      }
      const currentTime = nowDate(clock);
      const expiresAt = new Date(record.expiresAt);
      if (!Number.isFinite(expiresAt.getTime()) || currentTime.getTime() >= expiresAt.getTime()) {
        return mapMaybe(
          terminate(record, SHARE_STATUS.EXPIRED, currentTime.toISOString()),
          () => { throw new ProposalShareError('share-expired', 'Um compartilhamento expirado nao pode ser revogado.', 409); }
        );
      }
      return mapMaybe(
        terminate(record, SHARE_STATUS.REVOKED, currentTime.toISOString()),
        (terminated) => publicShareRecord(terminated.share || terminated)
      );
    });
  }

  return Object.freeze({
    createSnapshot,
    getSnapshot,
    transitionSnapshot,
    publish,
    resolve,
    revoke
  });
}

module.exports = {
  SCHEMA,
  SHARE_STATUS,
  DEFAULT_VALIDITY_DAYS,
  MAX_VALIDITY_DAYS,
  TOKEN_BYTES,
  REPOSITORY_METHODS,
  ProposalShareError,
  createProposalShareService,
  makeOpaqueToken,
  tokenHash,
  assertOpaqueToken,
  normalizeValidityDays,
  publicShareRecord,
  isThenable,
  mapMaybe
};
