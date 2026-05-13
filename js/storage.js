/**
 * ConsorcioPro V8 - Modulo de Persistencia
 * Salva, lista e restaura simulacoes nomeadas no localStorage.
 */

const Storage = (() => {
  'use strict';

  const STORAGE_KEY = 'consorciopro_simulations';
  const MAX_SIMULATIONS = 50;
  const CURRENT_SCHEMA = 3;

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
      proposalAcceptance: entry.proposalAcceptance || null,
      decisionContext: entry.decisionContext || null
    };
  }

  function saveSimulation(nome, data) {
    if (nome && typeof nome === 'object' && data === undefined) {
      data = nome;
      nome = data.nome || data.name || '';
    }
    data = data || {};

    const list = _loadAll();
    const now = new Date().toISOString();
    const id = data.id || 'SIM-' + Date.now().toString(36).toUpperCase();
    const entry = {
      id,
      schemaVersion: CURRENT_SCHEMA,
      nome: nome || `Simulação ${list.length + 1}`,
      criadoEm: data.criadoEm || now,
      atualizadoEm: now,
      origem: data.origem || 'simulador-consorcio',
      currentStep: data.currentStep || data.step || 1,
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
      resumo: data.resumo || (data.resultado && data.resultado.resumo ? data.resultado.resumo : null),
      proposalAcceptance: data.proposalAcceptance || null,
      decisionContext: data.decisionContext || null
    };

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

  function loadSimulations(options = {}) {
    return _loadAll().map(entry => _summary(entry, !!options.includeDetails));
  }

  function listSimulations(options) {
    return loadSimulations(options);
  }

  function loadSimulation(id) {
    const entry = _loadAll().find(s => s.id === id);
    return entry ? _summary(entry, true) : null;
  }

  function deleteSimulation(id) {
    const list = _loadAll().filter(s => s.id !== id);
    return _saveAll(list);
  }

  function clearAll() {
    return _saveAll([]);
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
    listSimulations,
    loadSimulations,
    loadSimulation,
    deleteSimulation,
    clearAll,
    getPortfolioStats
  };
})();
