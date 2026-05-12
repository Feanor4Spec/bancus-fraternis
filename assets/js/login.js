(function () {
  'use strict';

  function qs(selector) {
    return document.querySelector(selector);
  }

  function redirectTarget(user) {
    const params = new URLSearchParams(location.search);
    const requested = params.get('redirect') || '';
    if (requested && !requested.includes('://') && !requested.startsWith('//') && !requested.startsWith('login.html')) {
      return requested;
    }
    return user && user.role === 'admin' ? 'dashboard-admin.html' : 'dashboard-cliente.html';
  }

  function setStatus(message, tone) {
    const target = qs('[data-login-status]');
    if (!target) return;
    target.className = `bf-auth-message ${tone ? `bf-auth-message--${tone}` : ''}`;
    target.textContent = message || '';
  }

  function setProgress(percent, label) {
    const bar = qs('[data-login-progress-bar]');
    const text = qs('[data-login-progress-label]');
    if (bar) bar.style.width = `${Math.max(0, Math.min(100, percent))}%`;
    if (text) text.textContent = label || '';
  }

  function fillDemo(email, password) {
    const emailInput = qs('[data-login-email]');
    const passwordInput = qs('[data-login-password]');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
    setStatus('Credenciais de demonstracao carregadas.', 'info');
    setProgress(35, 'Credenciais prontas');
  }

  function goToTarget(user) {
    window.setTimeout(() => {
      location.href = redirectTarget(user);
    }, 220);
  }

  function waitForBackendSession(result) {
    if (!result || !result.backendLogin || typeof result.backendLogin.finally !== 'function') {
      return Promise.resolve(null);
    }
    return result.backendLogin;
  }

  function performLogin(email, password) {
    if (!window.BFAuth || !window.BFAuth.login) {
      setProgress(10, 'Autenticacao indisponivel');
      setStatus('Servico local de autenticacao indisponivel.', 'error');
      return null;
    }

    setStatus('Validando credenciais locais...', 'info');
    setProgress(58, 'Consultando usuarios');

    const result = window.BFAuth.login(email, password);

    if (!result.ok) {
      setProgress(18, 'Acesso nao autorizado');
      setStatus(result.message, 'error');
      return result;
    }

    document.body.dataset.loginRedirectTarget = redirectTarget(result.user);
    setProgress(82, 'Sincronizando API local');
    waitForBackendSession(result).finally(() => {
      setProgress(100, 'Sessao criada');
      setStatus('Login realizado. Redirecionando para a area segura.', 'success');
      document.body.dataset.loginRedirectReady = 'true';
      goToTarget(result.user);
    });
    return result;
  }

  function initLoginPage() {
    const form = qs('[data-login-form]');
    const current = window.BFAuth && window.BFAuth.getCurrentUser();
    const activeSession = qs('[data-active-session]');

    if (current && activeSession) {
      activeSession.innerHTML = `
        <strong>Sessao ativa:</strong> ${current.name} (${current.roleLabel}).
        <a href="${redirectTarget(current)}">Abrir area</a>
      `;
    }

    document.querySelectorAll('[data-demo-login]').forEach((button) => {
      button.addEventListener('click', () => {
        fillDemo(button.dataset.email, button.dataset.password);
        performLogin(button.dataset.email, button.dataset.password);
      });
    });

    if (!form) return;

    form.addEventListener('submit', function (event) {
      event.preventDefault();
      const email = qs('[data-login-email]') ? qs('[data-login-email]').value : '';
      const password = qs('[data-login-password]') ? qs('[data-login-password]').value : '';
      performLogin(email, password);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginPage);
  } else {
    initLoginPage();
  }
})();
