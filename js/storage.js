/**
 * ConsorcioPro V8 - Modulo de Persistencia
 * Salva, lista e restaura simulacoes nomeadas no localStorage.
 */

const Storage = (() => {
  'use strict';

  const STORAGE_KEY = 'consorciopro_simulations';
  const PROPOSAL_VERSION_SNAPSHOT_STORAGE_KEY = 'consorciopro_proposal_version_snapshots';
  const MAX_SIMULATIONS = 50;
  const MAX_PROPOSAL_VERSION_SNAPSHOTS = 120;
  const CURRENT_SCHEMA = 3;
  const PRIVATE_SNAPSHOT_FIELDS = new Set([
    'consultor', 'consultorEmail', 'consultorTelefone',
    'consultorEmpresa', 'empresaConsultor', 'consultorCodigo', 'codigoConsultor',
    'consultant', 'consultantEmail', 'consultantPhone',
    'consultantCompany', 'companyConsultant', 'consultantCode', 'codeConsultant',
    'advisor', 'advisorEmail', 'advisorPhone', 'advisorCompany', 'advisorCode',
    'cliente', 'nomeCliente', 'clienteCpf', 'clienteEmail', 'clienteTelefone',
    'cpf', 'email', 'phone', 'telefone', 'reviewer', 'notes',
    'ownerEmail', 'actorEmail', 'observacoes', 'proposalReviewer', 'proposalReviewNotes'
  ].map(_normalizeSnapshotFieldKey));

  function _normalizeSnapshotFieldKey(value) {
    return String(value == null ? '' : value)
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9]/g, '')
      .toLowerCase();
  }

  function _isPrivateSnapshotField(key) {
    return PRIVATE_SNAPSHOT_FIELDS.has(_normalizeSnapshotFieldKey(key));
  }

  function _getLocalStorage() {
    try {
      return (typeof localStorage !== 'undefined') ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function _loadAll() {
    try {
      const storage = _getLocalStorage();
      if (!storage) return [];
      const raw = storage.getItem(STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('Storage: erro ao carregar simulacoes', e);
      return [];
    }
  }

  function _saveAll(list) {
    try {
      const storage = _getLocalStorage();
      if (!storage) return false;
      storage.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(list) ? list : []));
      return true;
    } catch (e) {
      console.error('Storage: erro ao salvar simulacoes', e);
      return false;
    }
  }

  function _loadProposalVersionSnapshots() {
    try {
      const storage = _getLocalStorage();
      if (!storage) return [];
      const raw = storage.getItem(PROPOSAL_VERSION_SNAPSHOT_STORAGE_KEY);
      const parsed = raw ? JSON.parse(raw) : [];
      const sanitized = (Array.isArray(parsed) ? parsed : [])
        .map(_sanitizeProposalVersionSnapshotEntry);
      const serialized = JSON.stringify(sanitized);
      if (raw && serialized !== raw) {
        storage.setItem(PROPOSAL_VERSION_SNAPSHOT_STORAGE_KEY, serialized);
      }
      return sanitized;
    } catch (e) {
      console.warn('Storage: erro ao carregar snapshots de versoes', e);
      return [];
    }
  }

  function _saveProposalVersionSnapshots(list) {
    try {
      const storage = _getLocalStorage();
      if (!storage) return false;
      const sanitized = (Array.isArray(list) ? list : [])
        .map(_sanitizeProposalVersionSnapshotEntry);
      storage.setItem(
        PROPOSAL_VERSION_SNAPSHOT_STORAGE_KEY,
        JSON.stringify(sanitized)
      );
      return true;
    } catch (e) {
      console.error('Storage: erro ao salvar snapshots de versoes', e);
      return false;
    }
  }

  function _currentActorEmail() {
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      const user = root.BFAuth && root.BFAuth.getCurrentUser ? root.BFAuth.getCurrentUser() : null;
      return user && user.email ? user.email : '';
    } catch (e) {
      return '';
    }
  }

  function _publishBackendSnapshot(type, payload, meta) {
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      const api = root.BFBackendApi;
      if (!api || typeof api.recordSnapshot !== 'function') return;
      api.recordSnapshot(type, payload || {}, meta || {}).catch(() => {});
    } catch (e) {
      // Snapshot server-side e progressivo; localStorage continua sendo a fonte segura do prototipo estatico.
    }
  }

  function _publishDirectSimulation(entry) {
    if (!entry || !entry.id) return;
    try {
      const root = typeof window !== 'undefined' ? window : globalThis;
      const api = root.BFBackendApi;
      if (!api || typeof api.saveSimulation !== 'function') return;
      const decisionContext = entry.decisionContext || {};
      api.saveSimulation({
        id: entry.id,
        ownerEmail: entry.clienteEmail || entry.consultorEmail || '',
        actorEmail: _currentActorEmail() || entry.consultorEmail || '',
        title: entry.nome || entry.id,
        status: entry.status || 'saved',
        stage: 'simulacao',
        priority: decisionContext.priority || decisionContext.prioridade || 'media',
        source: 'simulator-storage',
        relatedId: decisionContext.journeyId || decisionContext.decisionJourneyId || entry.proposalId || '',
        amount: entry.totalCarta || (entry.resumo && entry.resumo.creditoTotal) || 0,
        payload: entry,
        createdAt: entry.criadoEm || '',
        updatedAt: entry.atualizadoEm || ''
      }).catch(() => {});
    } catch (e) {
      // Escrita direta e progressiva; o snapshot e o localStorage continuam preservados.
    }
  }

  function _publishSimulationSnapshot(entry) {
    if (!entry || !entry.id) return;
    _publishBackendSnapshot('simulation', entry, {
      id: `SNP-SIM-${entry.id}`,
      source: 'simulator-storage',
      ownerEmail: entry.clienteEmail || entry.consultorEmail || '',
      actorEmail: _currentActorEmail() || entry.consultorEmail || '',
      entityId: entry.id,
      title: entry.nome || entry.id,
      status: entry.status || 'saved',
      storageKey: STORAGE_KEY,
      createdAt: entry.criadoEm || '',
      updatedAt: entry.atualizadoEm || ''
    });
  }

  function _summary(entry, includeDetails) {
    const resumo = entry.resumo || (entry.resultado && entry.resultado.resumo ? entry.resultado.resumo : null);
    const base = {
      id: entry.id,
      schemaVersion: entry.schemaVersion || 1,
      nome: entry.nome,
      criadoEm: entry.criadoEm,
      atualizadoEm: entry.atualizadoEm,
      origem: entry.origem || 'simulador-consorcio',
      currentStep: entry.currentStep || 1,
      proposalId: entry.proposalId || '',
      ownerEmail: entry.ownerEmail || '',
      actorEmail: entry.actorEmail || '',
      privacy: entry.privacy || null,
      consultor: entry.consultor || '',
      consultorEmail: entry.consultorEmail || '',
      consultorTelefone: entry.consultorTelefone || '',
      cliente: entry.cliente || '',
      clienteCpf: entry.clienteCpf || '',
      clienteEmail: entry.clienteEmail || '',
      clienteTelefone: entry.clienteTelefone || '',
      clienteObjetivo: entry.clienteObjetivo || '',
      totalCarta: entry.totalCarta || 0,
      totalGrupos: entry.totalGrupos || 0,
      totalCotas: entry.totalCotas || 0,
      segmentos: entry.segmentos || [],
      decisionContext: entry.decisionContext || null,
      proposalAcceptance: entry.proposalAcceptance || null,
      status: entry.status || 'Prospecção',
      resumo
    };

    if (!includeDetails) return base;
    return {
      ...base,
      formSnapshot: entry.formSnapshot || null,
      filtros: entry.filtros || null,
      params: entry.params || null,
      carrinho: entry.carrinho || [],
      resultado: entry.resultado || null,
      comparison: entry.comparison || null,
      proposalSnapshotRef: entry.proposalSnapshotRef || null,
      proposalAcceptance: entry.proposalAcceptance || null,
      decisionContext: entry.decisionContext || null
    };
  }

  function _buildEntry(nome, data, listLength = 0) {
    const now = new Date().toISOString();
    const id = data.id || 'SIM-' + Date.now().toString(36).toUpperCase();
    return {
      id,
      schemaVersion: CURRENT_SCHEMA,
      nome: nome || `Simulação ${listLength + 1}`,
      criadoEm: data.criadoEm || now,
      atualizadoEm: now,
      origem: data.origem || 'simulador-consorcio',
      currentStep: data.currentStep || data.step || 1,
      proposalId: data.proposalId || (data.proposalAcceptance && data.proposalAcceptance.proposalId) || '',
      ownerEmail: data.ownerEmail || data.clienteEmail || '',
      actorEmail: data.actorEmail || _currentActorEmail() || data.consultorEmail || '',
      privacy: data.privacy || null,
      consultor: data.consultor || '',
      consultorEmail: data.consultorEmail || '',
      consultorTelefone: data.consultorTelefone || '',
      cliente: data.cliente || '',
      clienteCpf: data.clienteCpf || '',
      clienteEmail: data.clienteEmail || '',
      clienteTelefone: data.clienteTelefone || '',
      clienteObjetivo: data.clienteObjetivo || '',
      totalCarta: data.totalCarta || 0,
      totalGrupos: data.totalGrupos || 0,
      totalCotas: data.totalCotas || 0,
      segmentos: data.segmentos || [],
      status: data.status || 'Prospecção',
      formSnapshot: data.formSnapshot || null,
      filtros: data.filtros || null,
      params: data.params || null,
      carrinho: data.carrinho || [],
      resultado: data.resultado || null,
      comparison: data.comparison || null,
      resumo: data.resumo || (data.resultado && data.resultado.resumo ? data.resultado.resumo : null),
      proposalSnapshotRef: data.proposalSnapshotRef || null,
      proposalAcceptance: data.proposalAcceptance || null,
      decisionContext: data.decisionContext || null
    };
  }

  function _withoutPrivateFields(value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.keys(source).reduce((result, key) => {
      if (!_isPrivateSnapshotField(key)) result[key] = source[key];
      return result;
    }, {});
  }

  function _redactPrivateSnapshotValue(value) {
    if (Array.isArray(value)) return value.map(_redactPrivateSnapshotValue);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).reduce((result, key) => {
      if (_isPrivateSnapshotField(key)) return result;
      result[key] = _redactPrivateSnapshotValue(value[key]);
      return result;
    }, {});
  }

  function _sanitizeProposalAcceptance(acceptance) {
    if (!acceptance || typeof acceptance !== 'object') return null;
    const id = /^REV-[A-Za-z0-9._:-]+$/i.test(String(acceptance.id || ''))
      ? String(acceptance.id)
      : '';
    const sourceHash = /^fp-[A-Za-z0-9]+$/i.test(String(acceptance.sourceHash || ''))
      ? String(acceptance.sourceHash)
      : '';
    return {
      id,
      proposalId: acceptance.proposalId || '',
      status: acceptance.status || 'draft',
      sourceHash,
      version: Math.max(0, parseInt(acceptance.version, 10) || 0),
      createdAt: acceptance.createdAt || null,
      updatedAt: acceptance.updatedAt || null,
      reviewedAt: acceptance.reviewedAt || null,
      validUntil: acceptance.validUntil || null,
      checklist: acceptance.checklist ? { ...acceptance.checklist } : null
    };
  }

  function _sanitizeProposalVersionSnapshotData(data) {
    const source = data && typeof data === 'object' ? data : {};
    const redacted = _redactPrivateSnapshotValue(source);
    return {
      ...redacted,
      origem: 'proposal-version-snapshot',
      privacy: {
        localPIIStored: false,
        notice: 'Dados identificadores nao sao persistidos no armazenamento local.'
      },
      consultor: '',
      consultorEmail: '',
      consultorTelefone: '',
      cliente: 'Dados protegidos',
      clienteCpf: '',
      clienteEmail: '',
      clienteTelefone: '',
      params: _withoutPrivateFields(redacted.params),
      formSnapshot: _withoutPrivateFields(redacted.formSnapshot),
      proposalAcceptance: _sanitizeProposalAcceptance(source.proposalAcceptance)
    };
  }

  function _sanitizeProposalVersionSnapshotEntry(entry) {
    return {
      ..._sanitizeProposalVersionSnapshotData(entry),
      ownerEmail: '',
      actorEmail: ''
    };
  }

  function saveSimulation(nome, data) {
    if (nome && typeof nome === 'object' && data === undefined) {
      data = nome;
      nome = data.nome || data.name || '';
    }
    data = data || {};

    const list = _loadAll();
    const entry = _buildEntry(nome, data, list.length);
    const id = entry.id;

    const existingIndex = list.findIndex(s => s.id === id);
    if (existingIndex >= 0) list.splice(existingIndex, 1);
    list.unshift(entry);

    if (list.length > MAX_SIMULATIONS) {
      list.splice(MAX_SIMULATIONS);
    }

    if (!_saveAll(list)) return null;
    _publishSimulationSnapshot(entry);
    _publishDirectSimulation(entry);
    return entry;
  }

  function saveProposalVersionSnapshot(nome, data) {
    if (nome && typeof nome === 'object' && data === undefined) {
      data = nome;
      nome = data.nome || data.name || '';
    }
    const sanitized = _sanitizeProposalVersionSnapshotData(data);
    const list = _loadProposalVersionSnapshots();
    const entry = {
      ..._buildEntry(nome, sanitized, list.length),
      ownerEmail: '',
      actorEmail: ''
    };
    const existingIndex = list.findIndex(item => item.id === entry.id);
    if (existingIndex >= 0) list.splice(existingIndex, 1);
    list.unshift(entry);
    if (list.length > MAX_PROPOSAL_VERSION_SNAPSHOTS) {
      list.splice(MAX_PROPOSAL_VERSION_SNAPSHOTS);
    }
    if (!_saveProposalVersionSnapshots(list)) return null;
    _publishSimulationSnapshot(entry);
    _publishDirectSimulation(entry);
    return entry;
  }

  function loadSimulations(options = {}) {
    return _loadAll().map(entry => _summary(entry, !!options.includeDetails));
  }

  function listSimulations(options) {
    return loadSimulations(options);
  }

  function loadSimulation(id) {
    const entry = _loadAll().find(s => s.id === id)
      || _loadProposalVersionSnapshots().find(s => s.id === id);
    return entry ? _summary(entry, true) : null;
  }

  function deleteProposalVersionSnapshot(id) {
    const list = _loadProposalVersionSnapshots().filter(item => item.id !== id);
    return _saveProposalVersionSnapshots(list);
  }

  function deleteSimulation(id) {
    const list = _loadAll().filter(s => s.id !== id);
    return _saveAll(list);
  }

  function clearAll() {
    const simulationsCleared = _saveAll([]);
    const snapshotsCleared = _saveProposalVersionSnapshots([]);
    return simulationsCleared && snapshotsCleared;
  }

  function getPortfolioStats() {
    const all = _loadAll();
    if (all.length === 0) return { total: 0, cartaTotal: 0, ticketMedio: 0, segmentos: {}, cotasTotal: 0 };

    let cartaTotal = 0;
    let cotasTotal = 0;
    const segmentos = {};

    all.forEach(s => {
      cartaTotal += s.totalCarta || 0;
      cotasTotal += s.totalCotas || 0;
      (s.segmentos || []).forEach(seg => {
        segmentos[seg] = (segmentos[seg] || 0) + 1;
      });
    });

    return {
      total: all.length,
      cartaTotal,
      cotasTotal,
      ticketMedio: cartaTotal / all.length,
      segmentos
    };
  }

  return {
    saveSimulation,
    saveProposalVersionSnapshot,
    listSimulations,
    loadSimulations,
    loadSimulation,
    deleteSimulation,
    deleteProposalVersionSnapshot,
    clearAll,
    getPortfolioStats
  };
})();
