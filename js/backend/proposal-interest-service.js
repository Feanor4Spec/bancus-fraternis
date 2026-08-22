'use strict';

const crypto = require('node:crypto');

const SCHEMA = 'bancus.proposal-interest.v1';
const SOURCE = 'proposal-interest';
const CONTACT_RESPONSE_HOURS = 24;
const DEFAULT_CONTACT_CHANNEL = 'canais_informados';
const PUBLIC_CONTACT_RESPONSIBLE = 'Equipe Bancus Fraternis';
const CONTACT_CHANNEL_LABELS = Object.freeze({
  canais_informados: 'Canais informados',
  email: 'E-mail',
  telefone: 'Telefone',
  whatsapp: 'WhatsApp'
});

function cleanText(value, maxLength = 240) {
  return String(value == null ? '' : value).replace(/\s+/g, ' ').trim().slice(0, maxLength);
}

function cleanEmail(value) {
  const email = cleanText(value, 254).toLowerCase();
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : '';
}

function cleanSystemId(value, prefix) {
  const id = cleanText(value, 160);
  if (!id || !new RegExp(`^${prefix}-[A-Za-z0-9._:-]+$`, 'i').test(id)) return '';
  return id;
}

function finiteNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function isoTimestamp(value) {
  const date = new Date(value);
  return Number.isFinite(date.getTime()) ? date.toISOString() : '';
}

function responseDueAt(requestedAt) {
  const timestamp = Date.parse(requestedAt);
  if (!Number.isFinite(timestamp)) return '';
  return new Date(timestamp + (CONTACT_RESPONSE_HOURS * 3600000)).toISOString();
}

function contactChannel(value) {
  const key = cleanText(value, 40).toLowerCase().replace(/[\s-]+/g, '_');
  return Object.prototype.hasOwnProperty.call(CONTACT_CHANNEL_LABELS, key)
    ? key
    : DEFAULT_CONTACT_CHANNEL;
}

function normalizeIdentity(input = {}) {
  const proposalId = cleanSystemId(input.proposalId, 'PROP');
  const proposalVersionId = cleanSystemId(input.proposalVersionId, 'PV');
  const snapshotId = cleanSystemId(input.snapshotId, 'PSN');
  const simulationId = cleanSystemId(input.simulationId, 'SIM');
  const ownerEmail = cleanEmail(input.ownerEmail);
  const interestKey = cleanSystemId(input.interestKey, 'PIK');
  const versionKey = interestKey || proposalVersionId || snapshotId;
  if (!proposalId || !versionKey || !ownerEmail) {
    const error = new Error('A proposta e a versao precisam estar vinculadas a um responsavel.');
    error.code = 'invalid-proposal-interest';
    error.status = 422;
    throw error;
  }
  return Object.freeze({ proposalId, proposalVersionId, snapshotId, simulationId, ownerEmail, interestKey, versionKey });
}

function interestId(identity) {
  const normalized = normalizeIdentity(identity);
  const digest = crypto
    .createHash('sha256')
    .update(`${normalized.ownerEmail}|${normalized.proposalId}|${normalized.versionKey}`, 'utf8')
    .digest('hex')
    .slice(0, 20)
    .toUpperCase();
  return `LEAD-PI-${digest}`;
}

function clientStatus(status) {
  const value = cleanText(status, 40).toLowerCase();
  if (['qualificado', 'descartado', 'closed'].includes(value)) return 'closed';
  if (['em_atendimento', 'aguardando_cliente', 'in_progress'].includes(value)) return 'in_progress';
  return 'requested';
}

function publicSummary(record) {
  if (!record) return null;
  const payload = record.payload && typeof record.payload === 'object' && !Array.isArray(record.payload)
    ? record.payload
    : {};
  const storedCommitment = payload.contactCommitment && typeof payload.contactCommitment === 'object' && !Array.isArray(payload.contactCommitment)
    ? payload.contactCommitment
    : {};
  const status = clientStatus(record.status || payload.status || storedCommitment.status);
  const requestedAt = isoTimestamp(storedCommitment.requestedAt || payload.interestRequestedAt || record.createdAt);
  const dueAt = isoTimestamp(storedCommitment.responseDueAt) || responseDueAt(requestedAt);
  const channel = contactChannel(storedCommitment.channel);
  return Object.freeze({
    id: cleanSystemId(record.id || payload.id, 'LEAD'),
    status,
    requestedAt,
    contactCommitment: Object.freeze({
      requestedAt,
      responseDueAt: dueAt,
      status,
      channel: CONTACT_CHANNEL_LABELS[channel],
      responsible: PUBLIC_CONTACT_RESPONSIBLE
    })
  });
}

function proposalHref(identity, leadId = '') {
  const params = new URLSearchParams({ from: 'handoff', proposalId: identity.proposalId });
  if (identity.proposalVersionId) params.set('proposalVersionId', identity.proposalVersionId);
  if (identity.simulationId) params.set('simulationId', identity.simulationId);
  if (leadId) {
    params.set('proposalView', 'review');
    params.set('interestId', leadId);
  }
  return `simulador.html?${params.toString()}#proposta`;
}

function priorityForAmount(amount) {
  const value = finiteNumber(amount);
  if (value >= 150000) return 'alta';
  if (value >= 50000) return 'media';
  return 'baixa';
}

function proposalChecklist(proposalId) {
  return [
    { id: 'revisar-proposta', label: `Revisar proposta ${proposalId}`, done: true, required: true },
    { id: 'confirmar-interesse', label: 'Confirmar o interesse e o melhor canal de contato', done: false, required: true },
    { id: 'validar-condicoes', label: 'Validar valores, prazo, lance e condicoes com o cliente', done: false, required: true },
    { id: 'definir-proximo-passo', label: 'Definir a proxima conversa e os documentos necessarios', done: false, required: true }
  ];
}

function buildLead(identityInput, details = {}, now) {
  const identity = normalizeIdentity(identityInput);
  const id = interestId(identity);
  const requestedAt = new Date(now).toISOString();
  const contactResponseDueAt = responseDueAt(requestedAt);
  const amount = finiteNumber(details.amount);
  const ownerName = cleanText(details.ownerName || 'Cliente da proposta', 160);
  const consultantEmail = cleanEmail(details.consultantEmail) || identity.ownerEmail;
  const channel = contactChannel(details.contactChannel);
  const proposalVersion = Math.max(0, Math.trunc(finiteNumber(details.proposalVersion)));
  const href = proposalHref(identity, id);
  const priority = cleanText(details.priority, 20) || priorityForAmount(amount);
  const validUntil = cleanText(details.validUntil, 20);
  const sourceHash = cleanText(details.sourceHash, 160);
  const productName = cleanText(details.productName || 'Consorcio', 120);

  const payload = {
    schema: 'bank-fratern.consultive-handoff.v1',
    id,
    source: SOURCE,
    sourceType: 'proposal',
    sourceLabel: 'Proposta',
    sourceProposalId: identity.proposalId,
    sourceProposalStatus: cleanText(details.proposalStatus || 'reviewed', 40),
    sourceProposalVersion: proposalVersion,
    sourceProposalVersionId: identity.proposalVersionId,
    sourceProposalVersionHash: sourceHash,
    sourceSimulationId: identity.simulationId,
    sourceProposalUpdatedAt: cleanText(details.proposalUpdatedAt || requestedAt, 40),
    sourceProposalValidUntil: validUntil,
    ownerEmail: identity.ownerEmail,
    ownerName,
    objective: 'proposta_consorcio',
    objectiveLabel: `Interesse na proposta ${identity.proposalId}`,
    priority,
    assignedTo: consultantEmail,
    interestStatus: 'requested',
    interestRequestedAt: requestedAt,
    contactCommitment: {
      requestedAt,
      responseDueAt: contactResponseDueAt,
      status: 'requested',
      channel,
      responsible: consultantEmail
    },
    summary: {
      valorCredito: amount,
      productName,
      modelName: 'Interesse na proposta',
      propostaVersao: proposalVersion,
      propostaValidade: validUntil,
      prioridade: priority
    },
    card: {
      title: 'Cliente quer conversar sobre a proposta',
      message: 'O interesse foi registrado na proposta compartilhada.',
      tone: 'success',
      next: 'Entrar em contato e confirmar as condicoes.'
    },
    nextAction: {
      type: 'proposal',
      title: 'Entrar em contato sobre a proposta',
      label: 'Abrir proposta',
      href
    },
    interestSchema: SCHEMA,
    checklist: proposalChecklist(identity.proposalId),
    notes: [],
    timeline: [{
      id: `TL-${id}`,
      type: 'proposal-interest',
      label: 'Cliente solicitou contato a partir da proposta.',
      actorEmail: '',
      createdAt: requestedAt
    }],
    createdAt: requestedAt,
    updatedAt: requestedAt
  };

  return Object.freeze({
    id,
    ownerEmail: identity.ownerEmail,
    actorEmail: '',
    title: payload.objectiveLabel,
    status: 'novo',
    stage: 'contato',
    priority,
    source: SOURCE,
    relatedId: identity.proposalId,
    amount,
    payload,
    createdAt: requestedAt,
    updatedAt: requestedAt
  });
}

function createProposalInterestService(options = {}) {
  const database = options.database;
  const clock = typeof options.clock === 'function' ? options.clock : () => new Date();
  if (!database || typeof database.findMaterializedJourneyRow !== 'function' || typeof database.upsertDirectJourneyRow !== 'function') {
    throw new TypeError('Database de jornada invalido para interesse em proposta.');
  }

  async function resolve(identityInput) {
    const identity = normalizeIdentity(identityInput);
    const id = interestId(identity);
    const record = await database.findMaterializedJourneyRow('lead', id, { ownerEmail: identity.ownerEmail });
    return publicSummary(record);
  }

  async function request(identityInput, details = {}) {
    const identity = normalizeIdentity(identityInput);
    const lead = buildLead(identity, details, clock());
    const result = await database.upsertDirectJourneyRow('lead', lead, { createOnly: true });
    const record = result && (result.lead || result.record);
    if (!result || result.ok === false || !record) {
      const error = new Error(result && result.message ? result.message : 'Nao foi possivel registrar o interesse.');
      error.code = 'proposal-interest-write-failed';
      error.status = Number(result && result.status) || 500;
      throw error;
    }
    return Object.freeze({ created: result.created !== false, interest: publicSummary(record), record });
  }

  return Object.freeze({ resolve, request });
}

module.exports = {
  SCHEMA,
  SOURCE,
  CONTACT_RESPONSE_HOURS,
  normalizeIdentity,
  interestId,
  publicSummary,
  proposalHref,
  buildLead,
  createProposalInterestService
};
