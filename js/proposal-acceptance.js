/**
 * Bancus Fraternis - Governanca local da proposta
 * Registra apenas metadados operacionais nao sensiveis em localStorage.
 * Nomes e notas continuam disponiveis durante a sessao, somente em memoria.
 */

const BFProposalAcceptance = (() => {
  'use strict';

  const STORAGE_KEY = 'bank_fratern_proposal_acceptances_v1';
  const SCHEMA = 'bank-fratern.proposal-acceptance.v1';
  const MAX_ITEMS = 80;
  const volatileDetails = new Map();

  function cleanText(value, max = 240) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function cleanSystemId(value, prefix, fallback = '') {
    const text = cleanText(value, 100);
    if (!text || !new RegExp(`^${prefix}-[A-Za-z0-9._:-]+$`, 'i').test(text)) return fallback;
    return text;
  }

  function parseLocalDate(value) {
    const text = cleanText(value, 20);
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(text);
    if (!match) return null;

    const year = Number(match[1]);
    const month = Number(match[2]);
    const day = Number(match[3]);
    const date = new Date(year, month - 1, day);
    if (
      !Number.isFinite(date.getTime())
      || date.getFullYear() !== year
      || date.getMonth() !== month - 1
      || date.getDate() !== day
    ) return null;

    date.setHours(0, 0, 0, 0);
    return date;
  }

  function cleanDate(value) {
    const text = cleanText(value, 20);
    return parseLocalDate(text) ? text : '';
  }

  function cleanTimestamp(value) {
    const text = cleanText(value, 40);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text) ? text : '';
  }

  function cleanSourceHash(value) {
    const text = cleanText(value, 100);
    return /^fp-[a-z0-9]+$/i.test(text) ? text : '';
  }

  function safeNumber(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function sanitizeChecklist(checklist) {
    return {
      premissas: !!(checklist && checklist.premissas),
      cliente: !!(checklist && checklist.cliente),
      documentacao: !!(checklist && checklist.documentacao)
    };
  }

  function sanitizeStoredRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const status = ['reviewed', 'partial', 'pending', 'expired'].includes(source.status)
      ? source.status
      : statusFromChecklist(source.checklist);
    return {
      schema: SCHEMA,
      id: cleanSystemId(source.id, 'REV'),
      proposalId: cleanSystemId(source.proposalId || 'PROP-PENDENTE', 'PROP', 'PROP-PENDENTE'),
      status,
      sourceHash: cleanSourceHash(source.sourceHash),
      validUntil: cleanDate(source.validUntil),
      checklist: sanitizeChecklist(source.checklist),
      version: Math.max(0, parseInt(source.version, 10) || 0),
      createdAt: cleanTimestamp(source.createdAt),
      updatedAt: cleanTimestamp(source.updatedAt),
      snapshot: {
        creditoTotal: safeNumber(source.snapshot && source.snapshot.creditoTotal),
        parcelaAtual: safeNumber(source.snapshot && source.snapshot.parcelaAtual),
        lanceTotal: safeNumber(source.snapshot && source.snapshot.lanceTotal)
      }
    };
  }

  function sensitiveDetails(record) {
    const source = record && typeof record === 'object' ? record : {};
    const snapshot = source.snapshot && typeof source.snapshot === 'object' ? source.snapshot : {};
    return {
      reviewer: cleanText(source.reviewer, 120),
      reviewerRole: cleanText(source.reviewerRole, 90),
      notes: cleanText(source.notes, 420),
      cliente: cleanText(snapshot.cliente, 120),
      consultor: cleanText(snapshot.consultor, 120)
    };
  }

  function rememberSensitive(record) {
    if (!record || !record.id) return;
    volatileDetails.set(record.id, sensitiveDetails(record));
  }

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function loadAll() {
    try {
      const store = storage();
      if (!store) return [];
      const raw = store.getItem(STORAGE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      const sanitized = (Array.isArray(parsed) ? parsed : [])
        .map(sanitizeStoredRecord)
        .filter((item) => item.id && item.proposalId);
      const serialized = JSON.stringify(sanitized);
      if (serialized !== raw) store.setItem(STORAGE_KEY, serialized);
      return sanitized;
    } catch (e) {
      const store = storage();
      if (store) store.removeItem(STORAGE_KEY);
      console.warn('BFProposalAcceptance: erro ao carregar revisoes', e);
      return [];
    }
  }

  function saveAll(items) {
    try {
      const store = storage();
      if (!store) return false;
      const sanitized = (Array.isArray(items) ? items : [])
        .map(sanitizeStoredRecord)
        .filter((item) => item.id && item.proposalId);
      store.setItem(STORAGE_KEY, JSON.stringify(sanitized));
      return true;
    } catch (e) {
      console.error('BFProposalAcceptance: erro ao salvar revisao', e);
      return false;
    }
  }

  function currentActorEmail() {
    try {
      const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
      return user && user.email ? user.email : '';
    } catch (e) {
      return '';
    }
  }

  function publishBackendSnapshot(type, payload, meta) {
    try {
      const api = window.BFBackendApi;
      if (!api || typeof api.recordSnapshot !== 'function') return;
      api.recordSnapshot(type, payload || {}, meta || {}).catch(() => {});
    } catch (e) {
      // API local opcional; aceite local continua funcionando em file:// e GitHub Pages.
    }
  }

  function publishDirectProposal(record) {
    if (!record || !record.proposalId) return;
    try {
      const api = window.BFBackendApi;
      if (!api || typeof api.saveProposal !== 'function') return;
      api.saveProposal({
        id: record.proposalId,
        ownerEmail: currentActorEmail() || record.reviewer || '',
        actorEmail: currentActorEmail() || record.reviewer || '',
        title: record.statusLabel || `Proposta ${record.proposalId}`,
        status: record.status || 'pending',
        stage: 'aceite',
        priority: record.status === 'expired' ? 'alta' : 'media',
        source: 'proposal-acceptance',
        relatedId: record.proposalId,
        amount: record.snapshot ? Number(record.snapshot.creditoTotal || 0) : 0,
        payload: record,
        createdAt: record.createdAt || '',
        updatedAt: record.updatedAt || record.createdAt || ''
      }).catch(() => {});
    } catch (e) {
      // Aceite local continua sendo a fonte de compatibilidade em ambientes estaticos.
    }
  }

  function publishAcceptanceSnapshot(record) {
    if (!record || !record.id) return;
    publishBackendSnapshot('proposal-acceptance', record, {
      id: `SNP-REV-${record.id}`,
      source: 'proposal-acceptance',
      ownerEmail: '',
      actorEmail: currentActorEmail() || record.reviewer || '',
      entityId: record.proposalId || record.id,
      title: record.statusLabel || 'Revisao de proposta',
      status: record.status || 'pending',
      storageKey: STORAGE_KEY,
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || ''
    });
  }

  function statusFromChecklist(checklist) {
    const values = Object.values(checklist || {});
    if (!values.length || values.every(Boolean)) return 'reviewed';
    return values.some(Boolean) ? 'partial' : 'pending';
  }

  function statusLabel(status) {
    const map = {
      reviewed: 'Revisada localmente',
      partial: 'Revisão parcial',
      pending: 'Em revisão',
      expired: 'Revisão vencida'
    };
    return map[status] || map.pending;
  }

  function isExpired(record) {
    if (!record || !record.validUntil) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const valid = parseLocalDate(record.validUntil);
    return Boolean(valid && valid < today);
  }

  function decorate(record) {
    if (!record) return null;
    const stored = sanitizeStoredRecord(record);
    const volatile = volatileDetails.get(stored.id) || sensitiveDetails(record);
    const status = isExpired(stored) ? 'expired' : (stored.status || 'pending');
    return {
      ...stored,
      status,
      statusLabel: statusLabel(status),
      reviewer: volatile.reviewer || '',
      reviewerRole: volatile.reviewerRole || 'Consultor responsável',
      notes: volatile.notes || '',
      snapshot: {
        ...stored.snapshot,
        cliente: volatile.cliente || 'Dados protegidos',
        consultor: volatile.consultor || ''
      }
    };
  }

  function createDraft(proposal = {}) {
    const now = new Date();
    const valid = new Date(now);
    valid.setDate(valid.getDate() + 7);
    return decorate({
      schema: SCHEMA,
      id: '',
      proposalId: proposal.id || 'PROP-PENDENTE',
      status: 'pending',
      sourceHash: '',
      reviewer: proposal.consultor || 'Consultor Bancus Fraternis',
      reviewerRole: 'Consultor responsável',
      validUntil: valid.toISOString().slice(0, 10),
      notes: 'Aguardando validação das premissas antes do encaminhamento.',
      checklist: {
        premissas: false,
        cliente: false,
        documentacao: false
      },
      version: 0,
      createdAt: '',
      updatedAt: '',
      snapshot: {
        cliente: proposal.cliente || 'Cliente em analise',
        consultor: proposal.consultor || '',
        creditoTotal: proposal.metrics ? proposal.metrics.creditoTotal : 0,
        parcelaAtual: proposal.metrics ? proposal.metrics.parcelaAtual : 0,
        lanceTotal: proposal.lances ? proposal.lances.lanceTotal : 0
      }
    });
  }

  function latest(proposalId) {
    const id = cleanSystemId(proposalId, 'PROP');
    if (!id) return null;
    const found = loadAll()
      .filter(item => item.proposalId === id)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0];
    return decorate(found || null);
  }

  function history(proposalId, limit = 5) {
    const id = cleanSystemId(proposalId, 'PROP');
    return loadAll()
      .filter(item => !id || item.proposalId === id)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limit)
      .map(decorate);
  }

  function saveReview({ proposal, reviewer, reviewerRole, validUntil, notes, checklist, sourceHash }) {
    const base = proposal || {};
    const safeChecklist = sanitizeChecklist(checklist);
    const proposalId = cleanSystemId(base.id || 'PROP-PENDENTE', 'PROP', 'PROP-PENDENTE');
    const now = new Date().toISOString();
    const previous = latest(proposalId);
    const version = previous && previous.version ? previous.version + 1 : 1;
    const record = decorate({
      schema: SCHEMA,
      id: `REV-${Date.now().toString(36).toUpperCase()}-${version}`,
      proposalId,
      status: statusFromChecklist(safeChecklist),
      sourceHash: cleanSourceHash(sourceHash),
      reviewer: cleanText(reviewer || base.consultor || 'Consultor Bancus Fraternis', 120),
      reviewerRole: cleanText(reviewerRole || 'Consultor responsável', 90),
      validUntil: cleanDate(validUntil),
      notes: cleanText(notes || '', 420),
      checklist: safeChecklist,
      version,
      createdAt: now,
      updatedAt: now,
      snapshot: {
        cliente: cleanText(base.cliente || 'Cliente em analise', 120),
        consultor: cleanText(base.consultor || '', 120),
        creditoTotal: base.metrics ? Number(base.metrics.creditoTotal) || 0 : 0,
        parcelaAtual: base.metrics ? Number(base.metrics.parcelaAtual) || 0 : 0,
        lanceTotal: base.lances ? Number(base.lances.lanceTotal) || 0 : 0
      }
    });

    rememberSensitive(record);
    const storedRecord = sanitizeStoredRecord(record);
    const list = loadAll().filter(item => item.id !== storedRecord.id);
    list.unshift(storedRecord);
    if (list.length > MAX_ITEMS) list.splice(MAX_ITEMS);
    if (!saveAll(list)) return null;
    publishAcceptanceSnapshot(record);
    publishDirectProposal(record);
    return decorate(record);
  }

  function clear(proposalId) {
    const id = cleanSystemId(proposalId, 'PROP');
    if (!id) return false;
    const items = loadAll();
    items.filter(item => item.proposalId === id).forEach(item => volatileDetails.delete(item.id));
    return saveAll(items.filter(item => item.proposalId !== id));
  }

  const api = {
    createDraft,
    latest,
    history,
    saveReview,
    clear,
    statusLabel
  };

  if (typeof window !== 'undefined') {
    window.BFProposalAcceptance = api;
  }

  return api;
})();
