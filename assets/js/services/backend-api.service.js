(function () {
  'use strict';

  const SESSION_KEY = 'bf_backend_session_v1';
  const PUBLIC_SESSION_KEY = 'bf_auth_public_session_v1';
  const AUTH_CONFIG_KEY = 'bf_auth_mode_v1';
  // Maior que o orcamento maximo documentado de conexao + query do provider.
  // Evita declarar fallback local enquanto uma escrita hospedada ainda pode confirmar.
  const REQUEST_TIMEOUT_MS = 20000;

  function canUseApi() {
    return /^https?:$/i.test(location.protocol || '');
  }

  function storage() {
    try {
      return window.localStorage || null;
    } catch (error) {
      return null;
    }
  }

  function readSession() {
    const config = readAuthConfig();
    const store = config.mode === 'production' ? temporaryStorage() : storage();
    if (!store) return null;
    try {
      const key = config.mode === 'production' ? PUBLIC_SESSION_KEY : SESSION_KEY;
      const session = JSON.parse(store.getItem(key) || 'null');
      if (!session || (config.mode !== 'production' && !session.token)) return null;
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        store.removeItem(key);
        return null;
      }
      return session;
    } catch (error) {
      store.removeItem(config.mode === 'production' ? PUBLIC_SESSION_KEY : SESSION_KEY);
      return null;
    }
  }

  function writeSession(session, user) {
    const config = readAuthConfig();
    const production = config.mode === 'production';
    const store = production ? temporaryStorage() : storage();
    if (!store || !session || (!production && !session.token)) return false;
    const key = production ? PUBLIC_SESSION_KEY : SESSION_KEY;
    store.setItem(key, JSON.stringify(production ? { ...session, user: user || null, mode: 'production' } : session));
    if (production) {
      const persistent = storage();
      if (persistent) persistent.removeItem(SESSION_KEY);
    }
    return true;
  }

  function clearSession() {
    const store = storage();
    if (store) store.removeItem(SESSION_KEY);
    const temporary = temporaryStorage();
    if (temporary) temporary.removeItem(PUBLIC_SESSION_KEY);
  }

  function pageSource() {
    const page = document.body && document.body.dataset ? document.body.dataset.bfPage : '';
    return page ? `browser:${page}` : 'browser';
  }

  async function request(path, options = {}) {
    if (!canUseApi()) return { ok: false, fallback: true, message: 'API local indisponivel neste protocolo.' };

    const controller = window.AbortController ? new AbortController() : null;
    const timeout = controller ? window.setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS) : null;
    const session = readSession();
    const headers = {
      Accept: 'application/json',
      ...(options.headers || {})
    };

    if (options.body !== undefined) headers['Content-Type'] = 'application/json';
    if (session && session.token) headers.Authorization = `Bearer ${session.token}`;

    try {
      const response = await fetch(path, {
        method: options.method || 'GET',
        credentials: 'same-origin',
        headers,
        body: options.body === undefined ? undefined : JSON.stringify(options.body),
        signal: controller ? controller.signal : undefined
      });
      const text = await response.text();
      let data = {};
      try {
        data = text ? JSON.parse(text) : {};
      } catch (error) {
        data = { ok: false, message: 'Resposta da API nao e JSON.' };
      }
      if (!response.ok) {
        if (response.status === 401) {
          clearSession();
          try {
            window.dispatchEvent(new CustomEvent('bf:auth-expired', { detail: { path } }));
          } catch (error) {
            // Ambientes sem CustomEvent continuam com a limpeza de sessao.
          }
        }
        return { ok: false, status: response.status, ...data };
      }
      return data && typeof data === 'object' ? data : { ok: true, data };
    } catch (error) {
      return { ok: false, fallback: true, message: 'API local indisponivel.', error: error && error.name ? error.name : 'request-error' };
    } finally {
      if (timeout) window.clearTimeout(timeout);
    }
  }

  async function health() {
    return request('/api/health');
  }

  async function authConfig() {
    const result = await request('/api/auth/config');
    if (result && result.ok && ['demo', 'production'].includes(result.mode)) writeAuthConfig(result);
    return result;
  }

  async function authLogin(email, password) {
    await authConfig();
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (result.ok && result.session) writeSession(result.session, result.user);
    return result;
  }

  async function authLogout() {
    try {
      return await request('/api/auth/logout', { method: 'POST' });
    } finally {
      clearSession();
    }
  }

  async function authChangePassword(currentPassword, newPassword) {
    const result = await request('/api/auth/change-password', {
      method: 'POST',
      body: { currentPassword, newPassword }
    });
    if (result.ok && result.session) writeSession(result.session, result.user);
    return result;
  }

  async function authLogoutAll() {
    try {
      return await request('/api/auth/logout-all', { method: 'POST' });
    } finally {
      clearSession();
    }
  }

  async function currentUser() {
    const result = await request('/api/auth/me');
    if (result.ok && result.session) writeSession(result.session, result.user);
    return result;
  }

  function databaseStatus() {
    return request('/api/database/status');
  }

  function importLocalSnapshot(snapshot, options = {}) {
    return request('/api/database/import-local', {
      method: 'POST',
      body: {
        ...(snapshot || {}),
        dryRun: options.dryRun !== false
      }
    });
  }

  function listUsers() {
    return request('/api/users');
  }

  function createUser(payload) {
    return request('/api/users', { method: 'POST', body: payload || {} });
  }

  function updateUser(id, payload) {
    return request(`/api/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload || {} });
  }

  function deleteUser(id) {
    return request(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' });
  }

  function resetPassword(id, password) {
    return request(`/api/users/${encodeURIComponent(id)}/password`, { method: 'POST', body: { password } });
  }

  function toggleStatus(id, status) {
    return request(`/api/users/${encodeURIComponent(id)}/status`, { method: 'POST', body: { status } });
  }

  function recordEvent(type, payload, meta = {}) {
    if (!type) return Promise.resolve({ ok: false, message: 'Tipo de evento ausente.' });
    return request('/api/events', {
      method: 'POST',
      body: {
        type,
        source: meta.source || pageSource(),
        ownerEmail: meta.ownerEmail || '',
        actorEmail: meta.actorEmail || '',
        sessionId: meta.sessionId || '',
        entityType: meta.entityType || '',
        entityId: meta.entityId || '',
        payload: payload || {},
        createdAt: meta.createdAt || ''
      }
    });
  }

  function recordSnapshot(type, payload, meta = {}) {
    if (!type) return Promise.resolve({ ok: false, message: 'Tipo de snapshot ausente.' });
    return request('/api/snapshots', {
      method: 'POST',
      body: {
        id: meta.id || '',
        type,
        source: meta.source || pageSource(),
        ownerEmail: meta.ownerEmail || '',
        entityId: meta.entityId || '',
        title: meta.title || '',
        status: meta.status || '',
        storageKey: meta.storageKey || '',
        payload: payload || {},
        createdAt: meta.createdAt || '',
        updatedAt: meta.updatedAt || ''
      }
    });
  }

  function listEvents(limit = 30) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 30)));
    return request(`/api/events?limit=${encodeURIComponent(safeLimit)}`);
  }

  function listSnapshots(limit = 30, type = '') {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 30)));
    const query = new URLSearchParams({ limit: String(safeLimit) });
    if (type) query.set('type', type);
    return request(`/api/snapshots?${query.toString()}`);
  }

  function listJourneyEntities(limit = 50, kind = '') {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    const query = new URLSearchParams({ limit: String(safeLimit) });
    if (kind) query.set('kind', kind);
    return request(`/api/journey-entities?${query.toString()}`);
  }

  function listLeads(limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    return request(`/api/leads?limit=${encodeURIComponent(safeLimit)}`);
  }

  function listSimulations(limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    return request(`/api/simulations?limit=${encodeURIComponent(safeLimit)}`);
  }

  function listProposals(limit = 50) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 50)));
    return request(`/api/proposals?limit=${encodeURIComponent(safeLimit)}`);
  }

  function saveLead(payload) {
    return request('/api/leads', { method: 'POST', body: payload || {} });
  }

  function getLead(id) {
    if (!id) return Promise.resolve({ ok: false, message: 'Lead ausente.' });
    return request(`/api/leads/${encodeURIComponent(id)}`);
  }

  function updateLead(id, payload) {
    if (!id) return Promise.resolve({ ok: false, message: 'Lead ausente.' });
    return request(`/api/leads/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload || {} });
  }

  function saveSimulation(payload) {
    return request('/api/simulations', { method: 'POST', body: payload || {} });
  }

  function getSimulation(id, options = {}) {
    if (!id) return Promise.resolve({ ok: false, message: 'Simulacao ausente.' });
    const query = new URLSearchParams();
    if (options.interestId) query.set('interestId', options.interestId);
    const suffix = query.toString() ? `?${query.toString()}` : '';
    return request(`/api/simulations/${encodeURIComponent(id)}${suffix}`);
  }

  function updateSimulation(id, payload) {
    if (!id) return Promise.resolve({ ok: false, message: 'Simulacao ausente.' });
    return request(`/api/simulations/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload || {} });
  }

  function saveProposal(payload) {
    return request('/api/proposals', { method: 'POST', body: payload || {} });
  }

  function getProposal(id) {
    if (!id) return Promise.resolve({ ok: false, message: 'Proposta ausente.' });
    return request(`/api/proposals/${encodeURIComponent(id)}`);
  }

  function updateProposal(id, payload) {
    if (!id) return Promise.resolve({ ok: false, message: 'Proposta ausente.' });
    return request(`/api/proposals/${encodeURIComponent(id)}`, { method: 'PATCH', body: payload || {} });
  }

  function temporaryStorage() {
    try {
      return window.sessionStorage || storage();
    } catch (error) {
      return storage();
    }
  }

  function readAuthConfig() {
    const store = storage();
    if (!store) return { mode: 'pending', transport: '', demoAccounts: false };
    try {
      const parsed = JSON.parse(store.getItem(AUTH_CONFIG_KEY) || 'null');
      return parsed && ['demo', 'production'].includes(parsed.mode)
        ? parsed
        : { mode: 'pending', transport: '', demoAccounts: false };
    } catch (error) {
      return { mode: 'pending', transport: '', demoAccounts: false };
    }
  }

  function writeAuthConfig(config) {
    const store = storage();
    if (!store || !config || !['demo', 'production'].includes(config.mode)) return false;
    store.setItem(AUTH_CONFIG_KEY, JSON.stringify({
      mode: config.mode,
      transport: config.transport || (config.mode === 'production' ? 'cookie' : 'bearer'),
      demoAccounts: config.demoAccounts === true,
      sessionMinutes: Number(config.sessionMinutes || 0),
      passwordPolicy: config.passwordPolicy || null
    }));
    return true;
  }

  function createProposalSnapshot(payload) {
    return request('/api/proposal-snapshots', { method: 'POST', body: payload || {} });
  }

  function getProposalSnapshot(id) {
    if (!id) return Promise.resolve({ ok: false, message: 'Snapshot ausente.' });
    return request(`/api/proposal-snapshots/${encodeURIComponent(id)}`);
  }

  function transitionProposalSnapshot(id, status, patch = {}) {
    if (!id) return Promise.resolve({ ok: false, message: 'Snapshot ausente.' });
    return request(`/api/proposal-snapshots/${encodeURIComponent(id)}/transitions`, {
      method: 'POST',
      body: { status, ...patch }
    });
  }

  function publishProposalSnapshot(id, validityDays = 30) {
    if (!id) return Promise.resolve({ ok: false, message: 'Snapshot ausente.' });
    return request(`/api/proposal-snapshots/${encodeURIComponent(id)}/publish`, {
      method: 'POST',
      body: { validityDays }
    });
  }

  function revokeProposalShare(id) {
    if (!id) return Promise.resolve({ ok: false, message: 'Compartilhamento ausente.' });
    return request(`/api/proposal-shares/${encodeURIComponent(id)}/revoke`, { method: 'POST' });
  }

  function getPublicProposal(token) {
    if (!token) return Promise.resolve({ ok: false, message: 'Token ausente.' });
    return request('/api/public/proposals/resolve', {
      method: 'POST',
      body: { token }
    });
  }

  function requestPublicProposalInterest(token) {
    if (!token) return Promise.resolve({ ok: false, message: 'Proposta indisponivel.' });
    return request('/api/public/proposals/interest', {
      method: 'POST',
      body: { token }
    });
  }

  function getProposalInterest(identity) {
    return request('/api/proposal-interests/resolve', {
      method: 'POST',
      body: identity || {}
    });
  }

  function requestProposalInterest(identity) {
    return request('/api/proposal-interests', {
      method: 'POST',
      body: identity || {}
    });
  }

  window.BFBackendApi = {
    SESSION_KEY,
    PUBLIC_SESSION_KEY,
    AUTH_CONFIG_KEY,
    available: canUseApi,
    readAuthConfig,
    authConfig,
    readSession,
    clearSession,
    request,
    health,
    authLogin,
    authLogout,
    authChangePassword,
    authLogoutAll,
    currentUser,
    databaseStatus,
    importLocalSnapshot,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    toggleStatus,
    recordEvent,
    recordSnapshot,
    listEvents,
    listSnapshots,
    listJourneyEntities,
    listLeads,
    listSimulations,
    listProposals,
    saveLead,
    getLead,
    updateLead,
    saveSimulation,
    getSimulation,
    updateSimulation,
    saveProposal,
    getProposal,
    updateProposal,
    createProposalSnapshot,
    getProposalSnapshot,
    transitionProposalSnapshot,
    publishProposalSnapshot,
    revokeProposalShare,
    getPublicProposal,
    requestPublicProposalInterest,
    getProposalInterest,
    requestProposalInterest
  };
})();
