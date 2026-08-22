'use strict';

const crypto = require('node:crypto');

const SCHEMA = 'bancus.proposal-snapshot.v1';

const STATUS = Object.freeze({
  DRAFT: 'rascunho',
  VALIDATED: 'validada',
  REVIEWED: 'revisada',
  PUBLISHED: 'publicada',
  EXPIRED: 'expirada',
  REVOKED: 'revogada'
});

const TERMINAL_STATUSES = Object.freeze([STATUS.EXPIRED, STATUS.REVOKED]);

const TRANSITIONS = Object.freeze({
  [STATUS.DRAFT]: Object.freeze([STATUS.VALIDATED]),
  [STATUS.VALIDATED]: Object.freeze([STATUS.REVIEWED]),
  [STATUS.REVIEWED]: Object.freeze([STATUS.PUBLISHED]),
  [STATUS.PUBLISHED]: Object.freeze([STATUS.EXPIRED, STATUS.REVOKED]),
  [STATUS.EXPIRED]: Object.freeze([]),
  [STATUS.REVOKED]: Object.freeze([])
});

const SENSITIVE_PUBLIC_KEYS = new Set([
  'name',
  'nome',
  'cliente',
  'client',
  'clientname',
  'clientid',
  'nomecliente',
  'proposalid',
  'consultor',
  'consultant',
  'reviewer',
  'revisor',
  'cpf',
  'cnpj',
  'rg',
  'titular',
  'responsavel',
  'beneficiario',
  'nomecompleto',
  'razaosocial',
  'nomefantasia',
  'contactperson',
  'matricula',
  'passport',
  'passaporte',
  'document',
  'documento',
  'email',
  'phone',
  'telefone',
  'celular',
  'whatsapp',
  'address',
  'endereco',
  'cep',
  'birthdate',
  'nascimento',
  'password',
  'senha',
  'secret',
  'token',
  'actorid',
  'ownerid',
  'userid',
  'createdby',
  'reviewedby'
]);

class ProposalSnapshotError extends Error {
  constructor(code, message, status = 400) {
    super(message);
    this.name = 'ProposalSnapshotError';
    this.code = code;
    this.status = status;
  }
}

function cleanText(value, max = 160) {
  return String(value === undefined || value === null ? '' : value).trim().slice(0, max);
}

function isoNow(clock) {
  const value = typeof clock === 'function' ? clock() : new Date();
  const date = value instanceof Date ? value : new Date(value);
  if (!Number.isFinite(date.getTime())) {
    throw new ProposalSnapshotError('invalid-clock', 'Relogio invalido para o snapshot.');
  }
  return date.toISOString();
}

function makeSnapshotId() {
  return `PSN-${crypto.randomBytes(16).toString('hex')}`;
}

function cloneJson(value, label) {
  try {
    const serialized = JSON.stringify(value === undefined ? {} : value, (key, entry) => {
      if (typeof entry === 'number' && !Number.isFinite(entry)) {
        throw new Error('numero nao finito');
      }
      if (entry === undefined || typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint') {
        throw new Error('tipo nao serializavel');
      }
      return entry;
    });
    if (serialized === undefined) throw new Error('valor indefinido');
    return JSON.parse(serialized);
  } catch (error) {
    throw new ProposalSnapshotError('invalid-json', `${label} precisa ser serializavel em JSON.`);
  }
}

function stableValue(value) {
  if (Array.isArray(value)) return value.map(stableValue);
  if (value && typeof value === 'object') {
    return Object.keys(value).sort().reduce((acc, key) => {
      acc[key] = stableValue(value[key]);
      return acc;
    }, Object.create(null));
  }
  return value;
}

function stableStringify(value) {
  return JSON.stringify(stableValue(value));
}

function contentHash(value) {
  return crypto.createHash('sha256').update(stableStringify(value)).digest('hex');
}

function deepFreeze(value) {
  if (!value || typeof value !== 'object' || Object.isFrozen(value)) return value;
  Object.freeze(value);
  Object.values(value).forEach(deepFreeze);
  return value;
}

function assertObject(value, label) {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    throw new ProposalSnapshotError('invalid-field', `${label} precisa ser um objeto.`);
  }
}

function assertCore(input) {
  const proposalId = cleanText(input && input.proposalId, 120);
  const engineVersion = cleanText(input && input.engineVersion, 80);
  const dataBase = cleanText(input && input.dataBase, 80);
  if (!proposalId) throw new ProposalSnapshotError('missing-proposal-id', 'proposalId e obrigatorio.');
  if (!engineVersion) throw new ProposalSnapshotError('missing-engine-version', 'engineVersion e obrigatorio.');
  if (!dataBase) throw new ProposalSnapshotError('missing-data-base', 'dataBase e obrigatorio.');
  assertObject(input.project, 'project');
  assertObject(input.result, 'result');
  if (input.review !== undefined) assertObject(input.review, 'review');
  if (input.provenance !== undefined) assertObject(input.provenance, 'provenance');
}

function snapshotPayload(input) {
  return {
    schema: SCHEMA,
    id: cleanText(input.id, 120),
    proposalId: cleanText(input.proposalId, 120),
    version: Number(input.version),
    parentSnapshotId: cleanText(input.parentSnapshotId, 120),
    status: cleanText(input.status, 30),
    engineVersion: cleanText(input.engineVersion, 80),
    dataBase: cleanText(input.dataBase, 80),
    project: cloneJson(input.project, 'project'),
    result: cloneJson(input.result, 'result'),
    review: cloneJson(input.review || {}, 'review'),
    provenance: cloneJson(input.provenance || {}, 'provenance'),
    createdAt: cleanText(input.createdAt, 40)
  };
}

function finalizeSnapshot(input) {
  const payload = snapshotPayload(input);
  if (!payload.id) throw new ProposalSnapshotError('missing-snapshot-id', 'id do snapshot e obrigatorio.');
  if (!Number.isInteger(payload.version) || payload.version < 1) {
    throw new ProposalSnapshotError('invalid-version', 'version precisa ser um inteiro positivo.');
  }
  if (!Object.values(STATUS).includes(payload.status)) {
    throw new ProposalSnapshotError('invalid-status', 'Estado de snapshot invalido.');
  }
  if (!payload.createdAt || !Number.isFinite(new Date(payload.createdAt).getTime())) {
    throw new ProposalSnapshotError('invalid-created-at', 'createdAt invalido.');
  }
  assertCore(payload);
  return deepFreeze({
    ...payload,
    contentHash: contentHash(payload)
  });
}

function create(input = {}, dependencies = {}) {
  assertCore(input);
  const createdAt = isoNow(dependencies.clock);
  const idFactory = typeof dependencies.idFactory === 'function' ? dependencies.idFactory : makeSnapshotId;
  return finalizeSnapshot({
    ...input,
    id: cleanText(idFactory(), 120),
    version: 1,
    parentSnapshotId: '',
    status: STATUS.DRAFT,
    createdAt,
    provenance: {
      ...cloneJson(input.provenance || {}, 'provenance'),
      capturedAt: createdAt
    }
  });
}

function hydrate(input = {}) {
  const snapshot = finalizeSnapshot(input);
  if (input.contentHash && cleanText(input.contentHash, 64) !== snapshot.contentHash) {
    throw new ProposalSnapshotError('hash-mismatch', 'O conteudo persistido do snapshot nao confere com seu hash.');
  }
  return snapshot;
}

function transition(current, nextStatus, patch = {}, dependencies = {}) {
  const source = hydrate(current);
  const target = cleanText(nextStatus, 30);
  const allowed = TRANSITIONS[source.status] || [];
  if (!allowed.includes(target)) {
    throw new ProposalSnapshotError(
      'invalid-transition',
      `Transicao invalida: ${source.status} -> ${target}.`,
      409
    );
  }

  const review = patch.review === undefined
    ? source.review
    : cloneJson(patch.review, 'review');
  if (target === STATUS.REVIEWED && Object.keys(review || {}).length === 0) {
    throw new ProposalSnapshotError('missing-review', 'A transicao para revisada exige evidencia de revisao.', 422);
  }

  const createdAt = isoNow(dependencies.clock);
  const idFactory = typeof dependencies.idFactory === 'function' ? dependencies.idFactory : makeSnapshotId;
  return finalizeSnapshot({
    ...source,
    id: cleanText(idFactory(), 120),
    version: source.version + 1,
    parentSnapshotId: source.id,
    status: target,
    review,
    provenance: {
      ...cloneJson(source.provenance || {}, 'provenance'),
      ...cloneJson(patch.provenance || {}, 'provenance'),
      previousSnapshotId: source.id,
      statusChangedAt: createdAt
    },
    createdAt
  });
}

function normalizePublicKey(key) {
  return String(key || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]/g, '')
    .toLowerCase();
}

function isSensitivePublicKey(key) {
  const normalized = normalizePublicKey(key);
  if (SENSITIVE_PUBLIC_KEYS.has(normalized)) return true;
  return [
    'clientname',
    'clientid',
    'nomecliente',
    'proposalid',
    'reviewer',
    'revisor',
    'email',
    'telefone',
    'phone',
    'whatsapp',
    'celular',
    'cpf',
    'cnpj',
    'titular',
    'responsavel',
    'beneficiario',
    'nomecompleto',
    'razaosocial',
    'nomefantasia',
    'contactperson',
    'matricula',
    'passport',
    'passaporte',
    'documento',
    'password',
    'senha',
    'secret',
    'token',
    'actorid',
    'ownerid',
    'userid',
    'createdby',
    'reviewedby'
  ].some((fragment) => normalized.includes(fragment));
}

function redactSensitiveText(value) {
  return String(value)
    .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[dado removido]')
    .replace(/\b\d{3}[.\s-]?\d{3}[.\s-]?\d{3}[-\s]?\d{2}\b/g, '[dado removido]')
    .replace(/\b\d{2}[.\s-]?\d{3}[.\s-]?\d{3}[\/\s-]?\d{4}[-\s]?\d{2}\b/g, '[dado removido]')
    .replace(/(^|[^A-Z0-9-])((?:\+?55\s*)?(?:\(?\d{2}\)?\s*)?9?\d{4}[-\s]?\d{4})\b/gi, '$1[dado removido]');
}

function sanitizePublicValue(value, depth = 0) {
  if (depth > 30) return '[conteudo truncado]';
  if (Array.isArray(value)) return value.map((item) => sanitizePublicValue(item, depth + 1));
  if (value && typeof value === 'object') {
    return Object.entries(value).reduce((acc, [key, entry]) => {
      if (!isSensitivePublicKey(key)) acc[key] = sanitizePublicValue(entry, depth + 1);
      return acc;
    }, Object.create(null));
  }
  return typeof value === 'string' ? redactSensitiveText(value) : value;
}

function toPublicSnapshot(snapshot) {
  const source = hydrate(snapshot);
  const safeReview = sanitizePublicValue(source.review);
  const safeProvenance = sanitizePublicValue(source.provenance);
  const publicReview = ['status', 'reviewedAt', 'checklist', 'validation', 'approved', 'version']
    .reduce((acc, key) => {
      if (Object.prototype.hasOwnProperty.call(safeReview, key)) acc[key] = safeReview[key];
      return acc;
    }, {});
  const publicProvenance = [
    'source',
    'sourceVersion',
    'sourceHash',
    'dataHash',
    'rulesetVersion',
    'capturedAt',
    'statusChangedAt',
    'publicationPolicy',
    'validityDays',
    'publishedAt'
  ].reduce((acc, key) => {
    if (Object.prototype.hasOwnProperty.call(safeProvenance, key)) acc[key] = safeProvenance[key];
    return acc;
  }, {});
  return deepFreeze({
    schema: source.schema,
    id: source.id,
    version: source.version,
    status: source.status,
    engineVersion: redactSensitiveText(source.engineVersion),
    dataBase: redactSensitiveText(source.dataBase),
    project: sanitizePublicValue(source.project),
    result: sanitizePublicValue(source.result),
    review: publicReview,
    provenance: publicProvenance,
    createdAt: source.createdAt
  });
}

module.exports = {
  SCHEMA,
  STATUS,
  TERMINAL_STATUSES,
  TRANSITIONS,
  ProposalSnapshotError,
  create,
  hydrate,
  transition,
  toPublicSnapshot,
  stableStringify,
  contentHash,
  deepFreeze,
  sanitizePublicValue
};
