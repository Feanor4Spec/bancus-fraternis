/**
 * Bancus Fraternis - Governanca local da proposta
 * Registra revisoes e aceite operacional da proposta em localStorage.
 */

const BFProposalAcceptance = (() => {
  'use strict';

  const STORAGE_KEY = 'bank_fratern_proposal_acceptances_v1';
  const SCHEMA = 'bank-fratern.proposal-acceptance.v1';
  const MAX_ITEMS = 80;

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
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('BFProposalAcceptance: erro ao carregar revisoes', e);
      return [];
    }
  }

  function saveAll(items) {
    try {
      const store = storage();
      if (!store) return false;
      store.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
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

  function cleanText(value, max = 240) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function statusFromChecklist(checklist) {
    const values = Object.values(checklist || {});
    if (!values.length || values.every(Boolean)) return 'reviewed';
    return values.some(Boolean) ? 'partial' : 'pending';
  }

  function statusLabel(status) {
    const map = {
      reviewed: 'Revisada localmente',
      partial: 'Revisao parcial',
      pending: 'Em revisao',
      expired: 'Revisao vencida'
    };
    return map[status] || map.pending;
  }

  function isExpired(record) {
    if (!record || !record.validUntil) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const valid = new Date(record.validUntil);
    valid.setHours(0, 0, 0, 0);
    return Number.isFinite(valid.getTime()) && valid < today;
  }

  function decorate(record) {
    if (!record) return null;
    const status = isExpired(record) ? 'expired' : (record.status || 'pending');
    return {
      ...record,
      status,
      statusLabel: statusLabel(status)
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
      reviewer: proposal.consultor || 'Consultor Bancus Fraternis',
      reviewerRole: 'Consultor responsavel',
      validUntil: valid.toISOString().slice(0, 10),
      notes: 'Aguardando validacao das premissas antes do encaminhamento.',
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
    const id = cleanText(proposalId, 80);
    if (!id) return null;
    const found = loadAll()
      .filter(item => item.proposalId === id)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))[0];
    return decorate(found || null);
  }

  function history(proposalId, limit = 5) {
    const id = cleanText(proposalId, 80);
    return loadAll()
      .filter(item => !id || item.proposalId === id)
      .sort((a, b) => String(b.updatedAt || b.createdAt || '').localeCompare(String(a.updatedAt || a.createdAt || '')))
      .slice(0, limit)
      .map(decorate);
  }

  function saveReview({ proposal, reviewer, reviewerRole, validUntil, notes, checklist }) {
    const base = proposal || {};
    const safeChecklist = {
      premissas: !!(checklist && checklist.premissas),
      cliente: !!(checklist && checklist.cliente),
      documentacao: !!(checklist && checklist.documentacao)
    };
    const proposalId = cleanText(base.id || 'PROP-PENDENTE', 80);
    const now = new Date().toISOString();
    const previous = latest(proposalId);
    const version = previous && previous.version ? previous.version + 1 : 1;
    const record = decorate({
      schema: SCHEMA,
      id: `REV-${Date.now().toString(36).toUpperCase()}-${version}`,
      proposalId,
      status: statusFromChecklist(safeChecklist),
      reviewer: cleanText(reviewer || base.consultor || 'Consultor Bancus Fraternis', 120),
      reviewerRole: cleanText(reviewerRole || 'Consultor responsavel', 90),
      validUntil: cleanText(validUntil || '', 20),
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

    const list = loadAll().filter(item => item.id !== record.id);
    list.unshift(record);
    if (list.length > MAX_ITEMS) list.splice(MAX_ITEMS);
    if (!saveAll(list)) return null;
    publishAcceptanceSnapshot(record);
    return record;
  }

  function clear(proposalId) {
    const id = cleanText(proposalId, 80);
    if (!id) return false;
    return saveAll(loadAll().filter(item => item.proposalId !== id));
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
