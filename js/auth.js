/**
 * Bancus Fraternis - Local Auth Service
 * Camada estatica para prototipo: usuarios, sessao e papeis em localStorage.
 * Trocar por API segura antes de uso produtivo com dados pessoais reais.
 */
(function () {
  'use strict';

  const USERS_KEY = 'bf_auth_users_v1';
  const SESSION_KEY = 'bf_auth_session_v1';
  const AUTH_CONFIG_KEY = 'bf_auth_mode_v1';
  const SESSION_TTL_MS = 1000 * 60 * 60 * 8;
  const DEFAULT_PASSWORD = 'Temp@123';
  let productionUsers = [];
  let authInitialization = null;

  const ROLE_LABELS = {
    admin: 'Administrador',
    consultor: 'Consultor',
    cliente: 'Cliente'
  };

  const STATUS_LABELS = {
    active: 'Ativo',
    inactive: 'Inativo'
  };

  const SEED_USERS = [
    {
      name: 'Administrador Bancus Fraternis',
      email: 'admin@bankfratern.local',
      role: 'admin',
      status: 'active',
      department: 'Operacao',
      phone: '(11) 4000-0001',
      password: 'Admin@123'
    },
    {
      name: 'Consultor Fratern',
      email: 'consultor@bankfratern.local',
      role: 'consultor',
      status: 'active',
      department: 'Comercial',
      phone: '(11) 4000-0002',
      password: 'Consultor@123'
    },
    {
      name: 'Cliente Demonstracao',
      email: 'cliente@bankfratern.local',
      role: 'cliente',
      status: 'active',
      department: 'Cliente',
      phone: '(11) 4000-0003',
      password: 'Cliente@123'
    }
  ];

  function nowIso() {
    return new Date().toISOString();
  }

  function getStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
      console.warn('BFAuth: localStorage indisponivel', error);
      return null;
    }
  }

  function normalizeEmail(email) {
    return String(email || '').trim().toLowerCase();
  }

  function normalizeRole(role) {
    return ROLE_LABELS[role] ? role : 'cliente';
  }

  function normalizeStatus(status) {
    return STATUS_LABELS[status] ? status : 'active';
  }

  function makeId(prefix) {
    return `${prefix}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`.toUpperCase();
  }

  function hashPassword(password) {
    const value = `bank-fratern-local-demo:${String(password || '')}`;
    let hash = 2166136261;
    for (let i = 0; i < value.length; i += 1) {
      hash ^= value.charCodeAt(i);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).padStart(8, '0');
  }

  function backendApi() {
    return window.BFBackendApi && typeof window.BFBackendApi === 'object' ? window.BFBackendApi : null;
  }

  function readModeConfig() {
    const declaredMode = document.body && document.body.dataset
      ? document.body.dataset.authMode
      : '';
    if (declaredMode === 'production') {
      return { mode: 'production', transport: 'cookie', demoAccounts: false, declared: true };
    }
    const api = backendApi();
    if (api && typeof api.readAuthConfig === 'function') return api.readAuthConfig();
    const storage = getStorage();
    try {
      const parsed = storage ? JSON.parse(storage.getItem(AUTH_CONFIG_KEY) || 'null') : null;
      if (parsed && ['demo', 'production'].includes(parsed.mode)) return parsed;
    } catch (error) {
      // Configuracao ausente mantem o fallback demonstrativo.
    }
    return { mode: api ? 'pending' : 'demo', demoAccounts: !api };
  }

  function authMode() {
    return readModeConfig().mode || 'demo';
  }

  function isProduction() {
    return authMode() === 'production';
  }

  function setMode(mode) {
    const nextMode = mode === 'production' ? 'production' : 'demo';
    const storage = getStorage();
    if (storage) {
      let existing = {};
      try {
        existing = JSON.parse(storage.getItem(AUTH_CONFIG_KEY) || '{}') || {};
      } catch (error) {
        existing = {};
      }
      storage.setItem(AUTH_CONFIG_KEY, JSON.stringify({
        ...existing,
        mode: nextMode,
        transport: nextMode === 'production' ? 'cookie' : 'bearer',
        demoAccounts: nextMode === 'demo'
      }));
      if (nextMode === 'production') storage.removeItem(USERS_KEY);
    }
    if (nextMode === 'production') productionUsers = [];
    return nextMode;
  }

  async function configureMode() {
    const previous = readModeConfig();
    const api = backendApi();
    if (!api || typeof api.authConfig !== 'function') {
      if (previous.mode === 'production') return { ...previous, fallback: true, unavailable: true };
      setMode('demo');
      ensureUsers();
      return { mode: 'demo', demoAccounts: true, fallback: true };
    }
    const result = await api.authConfig();
    if (result && result.ok && ['demo', 'production'].includes(result.mode)) {
      setMode(result.mode);
      if (result.mode === 'demo') ensureUsers();
      return result;
    }
    if (previous.mode === 'production') return { ...previous, fallback: true, unavailable: true };
    setMode('demo');
    ensureUsers();
    return { mode: 'demo', demoAccounts: true, fallback: true };
  }

  function sessionStorageForMode() {
    if (!isProduction()) return getStorage();
    try {
      return window.sessionStorage || getStorage();
    } catch (error) {
      return getStorage();
    }
  }

  function mirrorBackend(promise) {
    if (!promise || typeof promise.catch !== 'function') return;
    promise.catch((error) => {
      console.warn('BFAuth: espelhamento no backend local indisponivel', error);
    });
  }

  function syncBackendLogin(email, password) {
    const api = backendApi();
    if (!api || typeof api.authLogin !== 'function') return Promise.resolve({ ok: false, fallback: true });
    const promise = api.authLogin(email, password);
    mirrorBackend(promise);
    return promise;
  }

  function syncBackendLogout() {
    const api = backendApi();
    if (!api || typeof api.authLogout !== 'function') return;
    mirrorBackend(api.authLogout());
  }

  function syncBackendCreateUser(user, password) {
    const api = backendApi();
    if (!api || typeof api.createUser !== 'function' || !user) return;
    mirrorBackend(api.createUser({
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.department || '',
      phone: user.phone || '',
      password
    }));
  }

  function syncBackendUpdateUser(user, password) {
    const api = backendApi();
    if (!api || typeof api.updateUser !== 'function' || !user) return;
    mirrorBackend(api.updateUser(user.id, {
      name: user.name,
      email: user.email,
      role: user.role,
      status: user.status,
      department: user.department || '',
      phone: user.phone || '',
      ...(password ? { password } : {})
    }));
  }

  function syncBackendDeleteUser(id) {
    const api = backendApi();
    if (!api || typeof api.deleteUser !== 'function') return;
    mirrorBackend(api.deleteUser(id));
  }

  function syncBackendPassword(id, password) {
    const api = backendApi();
    if (!api || typeof api.resetPassword !== 'function') return;
    mirrorBackend(api.resetPassword(id, password));
  }

  function syncBackendStatus(id, status) {
    const api = backendApi();
    if (!api || typeof api.toggleStatus !== 'function') return;
    mirrorBackend(api.toggleStatus(id, status));
  }

  function publicUser(user) {
    if (!user) return null;
    return {
      id: user.id,
      name: user.name,
      email: user.email,
      role: user.role,
      roleLabel: ROLE_LABELS[user.role] || user.role,
      status: user.status,
      statusLabel: STATUS_LABELS[user.status] || user.status,
      department: user.department || '',
      phone: user.phone || '',
      createdAt: user.createdAt || '',
      updatedAt: user.updatedAt || '',
      lastLoginAt: user.lastLoginAt || '',
      mustChangePassword: user.mustChangePassword === true
    };
  }

  function makeSeedUser(seed, index) {
    const timestamp = nowIso();
    return {
      id: `USR-SEED-${index + 1}`,
      name: seed.name,
      email: normalizeEmail(seed.email),
      role: normalizeRole(seed.role),
      status: normalizeStatus(seed.status),
      department: seed.department || '',
      phone: seed.phone || '',
      passwordHash: hashPassword(seed.password),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: ''
    };
  }

  function readUsersRaw() {
    const storage = getStorage();
    if (!storage) return [];

    try {
      const parsed = JSON.parse(storage.getItem(USERS_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      console.warn('BFAuth: base local de usuarios corrompida, reiniciando seeds', error);
      return [];
    }
  }

  function saveUsers(users) {
    const storage = getStorage();
    if (!storage) return false;
    storage.setItem(USERS_KEY, JSON.stringify(users));
    return true;
  }

  function ensureUsers() {
    if (authMode() !== 'demo') {
      const storage = getStorage();
      if (storage) storage.removeItem(USERS_KEY);
      return [];
    }
    const users = readUsersRaw();
    let changed = false;

    SEED_USERS.forEach((seed, index) => {
      const email = normalizeEmail(seed.email);
      const exists = users.some((user) => normalizeEmail(user.email) === email);
      if (!exists) {
        users.push(makeSeedUser(seed, index));
        changed = true;
      }
    });

    const normalized = users.map((user) => ({
      id: user.id || makeId('USR'),
      name: String(user.name || 'Usuario Bancus Fraternis').trim(),
      email: normalizeEmail(user.email),
      role: normalizeRole(user.role),
      status: normalizeStatus(user.status),
      department: user.department || '',
      phone: user.phone || '',
      passwordHash: user.passwordHash || hashPassword(DEFAULT_PASSWORD),
      createdAt: user.createdAt || nowIso(),
      updatedAt: user.updatedAt || nowIso(),
      lastLoginAt: user.lastLoginAt || ''
    })).filter((user) => user.email);

    if (changed || normalized.length !== users.length) saveUsers(normalized);
    return normalized;
  }

  function listUsers() {
    if (isProduction()) return productionUsers.slice();
    return ensureUsers()
      .map(publicUser)
      .sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
  }

  async function refreshUsers() {
    if (!isProduction()) return listUsers();
    const api = backendApi();
    if (!api || typeof api.listUsers !== 'function') return [];
    const result = await api.listUsers();
    if (result && result.ok && Array.isArray(result.users)) {
      productionUsers = result.users.map(publicUser).filter(Boolean);
    }
    return productionUsers.slice();
  }

  function findUserByEmail(email) {
    const normalized = normalizeEmail(email);
    return ensureUsers().find((user) => user.email === normalized) || null;
  }

  function findUserById(id) {
    return ensureUsers().find((user) => user.id === id) || null;
  }

  function readSession() {
    const storage = sessionStorageForMode();
    if (!storage) return null;
    try {
      const session = JSON.parse(storage.getItem(SESSION_KEY) || 'null');
      if (!session || (!session.userId && !session.user)) return null;
      if (session.expiresAt && Date.now() > Number(session.expiresAt)) {
        logout();
        return null;
      }
      return session;
    } catch (error) {
      logout();
      return null;
    }
  }

  function writeSession(user, backendSession) {
    const storage = sessionStorageForMode();
    if (!storage) return false;
    const startedAt = Date.now();
    storage.setItem(SESSION_KEY, JSON.stringify({
      id: backendSession && backendSession.id ? backendSession.id : makeId('SES'),
      userId: user.id,
      role: user.role,
      ...(isProduction() ? { user: publicUser(user), backend: true } : {}),
      startedAt: backendSession && backendSession.createdAt ? new Date(backendSession.createdAt).getTime() : startedAt,
      expiresAt: backendSession && backendSession.expiresAt ? new Date(backendSession.expiresAt).getTime() : startedAt + SESSION_TTL_MS
    }));
    return true;
  }

  function getCurrentUser() {
    const session = readSession();
    if (!session) return null;
    if (isProduction()) {
      const backendSession = backendApi() && typeof backendApi().readSession === 'function'
        ? backendApi().readSession()
        : null;
      const user = session.user || (backendSession && backendSession.user);
      if (!user || user.status !== 'active') {
        logout();
        return null;
      }
      return publicUser(user);
    }
    const user = findUserById(session.userId);
    if (!user || user.status !== 'active') {
      logout();
      return null;
    }
    return publicUser(user);
  }

  function login(email, password) {
    if (authMode() === 'production') {
      const api = backendApi();
      if (!api || typeof api.authLogin !== 'function') {
        return Promise.resolve({ ok: false, message: 'Nao foi possivel acessar sua conta agora.' });
      }
      return api.authLogin(email, password).then((result) => {
        if (!result || !result.ok || !result.user) {
          return result || { ok: false, message: 'Nao foi possivel entrar.' };
        }
        writeSession(result.user, result.session);
        return { ...result, user: publicUser(result.user) };
      });
    }
    const user = findUserByEmail(email);
    if (!user || user.passwordHash !== hashPassword(password)) {
      return { ok: false, message: 'E-mail ou senha invalidos.' };
    }
    if (user.status !== 'active') {
      return { ok: false, message: 'Usuario inativo. Solicite reativacao ao administrador.' };
    }

    const users = ensureUsers();
    const index = users.findIndex((item) => item.id === user.id);
    if (index >= 0) {
      users[index].lastLoginAt = nowIso();
      users[index].updatedAt = nowIso();
      saveUsers(users);
    }

    writeSession(users[index] || user);
    const backendLogin = syncBackendLogin(email, password);
    return { ok: true, user: publicUser(users[index] || user), backendLogin };
  }

  function logout() {
    const api = backendApi();
    const backendLogout = api && typeof api.authLogout === 'function' ? api.authLogout() : Promise.resolve({ ok: true });
    if (!isProduction()) mirrorBackend(backendLogout);
    const storage = sessionStorageForMode();
    if (storage) storage.removeItem(SESSION_KEY);
    return backendLogout;
  }

  function validateUserPayload(payload, options) {
    const data = payload || {};
    const name = String(data.name || '').trim();
    const email = normalizeEmail(data.email);
    const role = normalizeRole(data.role);
    const status = normalizeStatus(data.status);
    const password = String(data.password || '').trim();

    if (!name) return { ok: false, message: 'Informe o nome do usuario.' };
    if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { ok: false, message: 'Informe um e-mail valido.' };
    if (!options || !options.editing) {
      if (!password || password.length < 6) return { ok: false, message: 'Informe uma senha com pelo menos 6 caracteres.' };
    }

    return {
      ok: true,
      data: {
        name,
        email,
        role,
        status,
        department: String(data.department || '').trim(),
        phone: String(data.phone || '').trim(),
        password
      }
    };
  }

  function createUser(payload) {
    if (isProduction()) {
      const api = backendApi();
      if (!api || typeof api.createUser !== 'function') return Promise.resolve({ ok: false, message: 'Cadastro indisponivel.' });
      return api.createUser(payload || {}).then(async (result) => {
        if (result && result.ok) await refreshUsers();
        return result;
      });
    }
    const validation = validateUserPayload(payload, { editing: false });
    if (!validation.ok) return validation;

    const users = ensureUsers();
    const data = validation.data;
    if (users.some((user) => user.email === data.email)) {
      return { ok: false, message: 'Ja existe um usuario com este e-mail.' };
    }

    const timestamp = nowIso();
    const user = {
      id: makeId('USR'),
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      department: data.department,
      phone: data.phone,
      passwordHash: hashPassword(data.password),
      createdAt: timestamp,
      updatedAt: timestamp,
      lastLoginAt: ''
    };

    users.push(user);
    saveUsers(users);
    syncBackendCreateUser(user, data.password);
    return { ok: true, user: publicUser(user), message: 'Usuario criado com sucesso.' };
  }

  function updateUser(id, payload) {
    if (isProduction()) {
      const api = backendApi();
      if (!api || typeof api.updateUser !== 'function') return Promise.resolve({ ok: false, message: 'Atualizacao indisponivel.' });
      return api.updateUser(id, payload || {}).then(async (result) => {
        if (result && result.ok) await refreshUsers();
        return result;
      });
    }
    const validation = validateUserPayload(payload, { editing: true });
    if (!validation.ok) return validation;

    const users = ensureUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index < 0) return { ok: false, message: 'Usuario nao encontrado.' };

    const data = validation.data;
    const duplicatedEmail = users.some((user) => user.id !== id && user.email === data.email);
    if (duplicatedEmail) return { ok: false, message: 'Ja existe outro usuario com este e-mail.' };

    users[index] = {
      ...users[index],
      name: data.name,
      email: data.email,
      role: data.role,
      status: data.status,
      department: data.department,
      phone: data.phone,
      updatedAt: nowIso()
    };

    if (data.password) users[index].passwordHash = hashPassword(data.password);

    saveUsers(users);
    syncBackendUpdateUser(users[index], data.password);
    return { ok: true, user: publicUser(users[index]), message: 'Usuario atualizado com sucesso.' };
  }

  function deleteUser(id) {
    if (isProduction()) {
      const api = backendApi();
      if (!api || typeof api.deleteUser !== 'function') return Promise.resolve({ ok: false, message: 'Remocao indisponivel.' });
      return api.deleteUser(id).then(async (result) => {
        if (result && result.ok) await refreshUsers();
        return result;
      });
    }
    const current = getCurrentUser();
    if (current && current.id === id) {
      return { ok: false, message: 'Nao e possivel excluir o usuario em sessao.' };
    }

    const users = ensureUsers();
    const next = users.filter((user) => user.id !== id);
    if (next.length === users.length) return { ok: false, message: 'Usuario nao encontrado.' };
    saveUsers(next);
    syncBackendDeleteUser(id);
    return { ok: true, message: 'Usuario removido.' };
  }

  function resetPassword(id, password) {
    if (isProduction()) {
      const api = backendApi();
      if (!api || typeof api.resetPassword !== 'function') return Promise.resolve({ ok: false, message: 'Redefinicao indisponivel.' });
      return api.resetPassword(id, password).then(async (result) => {
        if (result && result.ok) await refreshUsers();
        return result;
      });
    }
    const nextPassword = String(password || DEFAULT_PASSWORD).trim();
    if (nextPassword.length < 6) return { ok: false, message: 'A senha temporaria precisa ter pelo menos 6 caracteres.' };

    const users = ensureUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index < 0) return { ok: false, message: 'Usuario nao encontrado.' };
    users[index].passwordHash = hashPassword(nextPassword);
    users[index].updatedAt = nowIso();
    saveUsers(users);
    syncBackendPassword(id, nextPassword);
    return { ok: true, message: 'Senha temporaria atualizada.' };
  }

  function toggleStatus(id) {
    if (isProduction()) {
      const api = backendApi();
      const user = productionUsers.find((item) => item.id === id);
      const status = user && user.status === 'active' ? 'inactive' : 'active';
      if (!api || typeof api.toggleStatus !== 'function') return Promise.resolve({ ok: false, message: 'Alteracao indisponivel.' });
      return api.toggleStatus(id, status).then(async (result) => {
        if (result && result.ok) await refreshUsers();
        return result;
      });
    }
    const current = getCurrentUser();
    if (current && current.id === id) {
      return { ok: false, message: 'Nao e possivel inativar o usuario em sessao.' };
    }

    const users = ensureUsers();
    const index = users.findIndex((user) => user.id === id);
    if (index < 0) return { ok: false, message: 'Usuario nao encontrado.' };
    users[index].status = users[index].status === 'active' ? 'inactive' : 'active';
    users[index].updatedAt = nowIso();
    saveUsers(users);
    syncBackendStatus(id, users[index].status);
    return { ok: true, user: publicUser(users[index]), message: `Usuario ${STATUS_LABELS[users[index].status].toLowerCase()}.` };
  }

  async function changePassword(currentPassword, newPassword) {
    const api = backendApi();
    if (!api || typeof api.authChangePassword !== 'function') {
      return { ok: false, message: 'Troca de senha indisponivel.' };
    }
    const result = await api.authChangePassword(currentPassword, newPassword);
    if (result && result.ok && result.user) writeSession(result.user, result.session);
    return result;
  }

  function parseRoles(roles) {
    if (!roles) return [];
    const values = Array.isArray(roles) ? roles : String(roles).split(',');
    return values.map((role) => String(role || '').trim()).filter((role) => ROLE_LABELS[role]);
  }

  function hasRole(roles) {
    const required = parseRoles(roles);
    const user = getCurrentUser();
    if (!user) return false;
    return required.length === 0 || required.includes(user.role);
  }

  function loginPageUrl() {
    const inPagesDir = location.pathname.includes('/pages/');
    const loginPath = inPagesDir ? 'login.html' : 'pages/login.html';
    const current = location.pathname.split('/').pop() + location.search + location.hash;
    return `${loginPath}?redirect=${encodeURIComponent(current)}`;
  }

  function requireRole(roles, options) {
    const required = parseRoles(roles);
    const user = getCurrentUser();
    const shouldRedirect = !options || options.redirect !== false;

    if (!user) {
      if (shouldRedirect) location.replace(loginPageUrl());
      return null;
    }

    if (user.mustChangePassword) {
      if (shouldRedirect) location.replace(`${loginPageUrl()}&change=password`);
      return null;
    }

    if (required.length > 0 && !required.includes(user.role)) {
      if (shouldRedirect) location.replace('dashboard-cliente.html?auth=forbidden');
      return null;
    }

    return user;
  }

  function guardCurrentPage() {
    const body = document.body;
    if (!body) return true;
    const required = body.getAttribute('data-auth-required');
    const roles = body.getAttribute('data-auth-roles');
    if (!required && !roles) return true;
    return !!requireRole(roles || '', { redirect: true });
  }

  async function validateServerSession() {
    if (!isProduction()) return { ok: true, user: getCurrentUser() };
    const api = backendApi();
    if (!api || typeof api.currentUser !== 'function') return { ok: false };
    const result = await api.currentUser();
    if (result && result.ok && result.user) {
      writeSession(result.user, result.session);
      const body = document.body;
      const roles = body ? body.getAttribute('data-auth-roles') : '';
      const required = parseRoles(roles || '');
      if (required.length && !required.includes(result.user.role)) {
        location.replace('dashboard-cliente.html?auth=forbidden');
      }
      return result;
    }
    return result || { ok: false };
  }

  function roleLabel(role) {
    return ROLE_LABELS[role] || role || 'Usuario';
  }

  function statusLabel(status) {
    return STATUS_LABELS[status] || status || '';
  }

  window.BFAuth = {
    DEFAULT_PASSWORD,
    ROLE_LABELS: { ...ROLE_LABELS },
    STATUS_LABELS: { ...STATUS_LABELS },
    seedUsers: ensureUsers,
    listUsers,
    refreshUsers,
    configureMode,
    authMode,
    validateServerSession,
    getCurrentUser,
    login,
    logout,
    createUser,
    updateUser,
    deleteUser,
    resetPassword,
    changePassword,
    toggleStatus,
    hasRole,
    requireRole,
    roleLabel,
    statusLabel
  };

  function startPageAuth() {
    if (!authInitialization) {
      authInitialization = Promise.resolve()
        .then(initializePageAuth)
        .catch(() => {
          const body = document.body;
          if (body && (body.getAttribute('data-auth-required') || body.getAttribute('data-auth-roles'))) {
            location.replace(loginPageUrl());
          }
          return false;
        });
    }
    return authInitialization;
  }

  window.BFAuth.ready = new Promise((resolve) => {
    const begin = () => startPageAuth().then(resolve);
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', begin, { once: true });
    else begin();
  });

  if (authMode() === 'demo') ensureUsers();
  window.addEventListener && window.addEventListener('bf:auth-expired', () => {
    const storage = sessionStorageForMode();
    if (storage) storage.removeItem(SESSION_KEY);
    const body = document.body;
    if (body && (body.getAttribute('data-auth-required') || body.getAttribute('data-auth-roles'))) {
      location.replace(`${loginPageUrl()}&auth=expired`);
    }
  });
  async function initializePageAuth() {
    await configureMode();
    const body = document.body;
    const protectedPage = body && (body.getAttribute('data-auth-required') || body.getAttribute('data-auth-roles'));
    if (!protectedPage) return true;
    if (isProduction()) {
      const result = await validateServerSession();
      if (!result || !result.ok || !result.user) {
        location.replace(loginPageUrl());
        return false;
      }
    }
    return guardCurrentPage();
  }

})();
