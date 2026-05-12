(function () {
  'use strict';

  const SESSION_KEY = 'bf_backend_session_v1';
  const REQUEST_TIMEOUT_MS = 1800;

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
    const store = storage();
    if (!store) return null;
    try {
      const session = JSON.parse(store.getItem(SESSION_KEY) || 'null');
      if (!session || !session.token) return null;
      if (session.expiresAt && new Date(session.expiresAt).getTime() <= Date.now()) {
        store.removeItem(SESSION_KEY);
        return null;
      }
      return session;
    } catch (error) {
      store.removeItem(SESSION_KEY);
      return null;
    }
  }

  function writeSession(session) {
    const store = storage();
    if (!store || !session || !session.token) return false;
    store.setItem(SESSION_KEY, JSON.stringify(session));
    return true;
  }

  function clearSession() {
    const store = storage();
    if (store) store.removeItem(SESSION_KEY);
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
      if (!response.ok) return { ok: false, status: response.status, ...data };
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

  async function authLogin(email, password) {
    const result = await request('/api/auth/login', {
      method: 'POST',
      body: { email, password }
    });
    if (result.ok && result.session) writeSession(result.session);
    return result;
  }

  async function authLogout() {
    const result = await request('/api/auth/logout', { method: 'POST' });
    clearSession();
    return result;
  }

  function currentUser() {
    return request('/api/auth/me');
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

  function listEvents(limit = 30) {
    const safeLimit = Math.max(1, Math.min(100, Number(limit || 30)));
    return request(`/api/events?limit=${encodeURIComponent(safeLimit)}`);
  }

  window.BFBackendApi = {
    SESSION_KEY,
    available: canUseApi,
    readSession,
    clearSession,
    request,
    health,
    authLogin,
    authLogout,
    currentUser,
    listUsers,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    toggleStatus,
    recordEvent,
    listEvents
  };
})();
