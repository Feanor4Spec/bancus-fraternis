(function () {
  'use strict';

  function qs(selector) {
    return document.querySelector(selector);
  }

  const SAFE_RETURN_ROUTES = Object.freeze({
    'simulador.html': ['admin', 'consultor', 'cliente'],
    'dashboard-admin.html': ['admin'],
    'dashboard-cliente.html': ['admin', 'consultor', 'cliente'],
    'handoff-consultivo.html': ['admin', 'consultor'],
    'calculadoras-governanca.html': ['admin'],
    'modelos-governanca.html': ['admin', 'consultor'],
    'modelos-biblioteca.html': ['admin', 'consultor', 'cliente'],
    'trilha-decisao.html': ['admin', 'consultor', 'cliente']
  });

  function safeRequestedTarget() {
    const requested = new URLSearchParams(location.search).get('redirect') || '';
    if (!requested || requested.length > 2048 || /[\\\u0000-\u001f\u007f]/.test(requested)) return '';
    if (!/^[A-Za-z0-9][A-Za-z0-9._-]*\.html(?:\?[^#\s]*)?(?:#[^\s]*)?$/.test(requested)) return '';
    if (requested.toLowerCase().startsWith('login.html')) return '';
    const page = requested.split(/[?#]/, 1)[0].toLowerCase();
    if (!Object.hasOwn(SAFE_RETURN_ROUTES, page)) return '';
    return requested;
  }

  function redirectTarget(user) {
    const requested = safeRequestedTarget();
    const page = requested.split(/[?#]/, 1)[0].toLowerCase();
    const allowedRoles = SAFE_RETURN_ROUTES[page] || [];
    if (requested && user && allowedRoles.includes(user.role)) return requested;
    if (user && user.role === 'admin') return 'dashboard-admin.html';
    if (user && user.role === 'consultor') return 'handoff-consultivo.html';
    return 'dashboard-cliente.html';
  }

  function setStatus(message, tone) {
    const statusTarget = qs('[data-login-status]');
    const errorTarget = qs('[data-login-error]');
    const target = tone === 'error' ? errorTarget : statusTarget;
    if (!target) return;
    if (statusTarget && statusTarget !== target) statusTarget.textContent = '';
    if (errorTarget && errorTarget !== target) errorTarget.textContent = '';
    target.className = `bf-auth-message ${tone ? `bf-auth-message--${tone}` : ''}`;
    target.textContent = message || '';
  }

  function setBusy(busy, label) {
    const button = qs('[data-login-submit]');
    if (!button) return;
    button.disabled = Boolean(busy);
    button.setAttribute('aria-busy', busy ? 'true' : 'false');
    button.textContent = label || 'Entrar';
  }

  function markCredentialsInvalid(invalid) {
    ['[data-login-email]', '[data-login-password]'].forEach((selector) => {
      const input = qs(selector);
      if (input) input.setAttribute('aria-invalid', invalid ? 'true' : 'false');
    });
  }

  function showFieldError(input, message) {
    if (input) {
      input.setAttribute('aria-invalid', 'true');
      input.focus();
    }
    setStatus(message, 'error');
    return false;
  }

  function clearFieldState(input) {
    if (input) input.setAttribute('aria-invalid', 'false');
  }

  function validateLoginFields(emailInput, passwordInput) {
    markCredentialsInvalid(false);
    if (!emailInput || !emailInput.value.trim()) return showFieldError(emailInput, 'Informe seu e-mail.');
    if (typeof emailInput.checkValidity === 'function' && !emailInput.checkValidity()) {
      return showFieldError(emailInput, 'Informe um e-mail válido.');
    }
    if (!passwordInput || !passwordInput.value) return showFieldError(passwordInput, 'Informe sua senha.');
    return true;
  }

  function validatePasswordFields(currentInput, nextInput, confirmInput) {
    [currentInput, nextInput, confirmInput].forEach(clearFieldState);
    if (!currentInput || !currentInput.value) return showFieldError(currentInput, 'Informe sua senha temporária.');
    const password = nextInput ? nextInput.value : '';
    const passwordLength = password.length;
    if (
      passwordLength < 12
      || passwordLength > 128
      || password !== password.trim()
      || !/[a-z]/.test(password)
      || !/[A-Z]/.test(password)
      || !/[0-9]/.test(password)
      || !/[^A-Za-z0-9]/.test(password)
    ) {
      return showFieldError(nextInput, 'Use de 12 a 128 caracteres, com letras maiúsculas e minúsculas, número e símbolo.');
    }
    if (!confirmInput || password !== confirmInput.value) {
      return showFieldError(confirmInput, 'As novas senhas precisam ser iguais.');
    }
    return true;
  }

  function clearPasswordFields() {
    ['[data-login-password]', '[data-change-current]', '[data-change-new]', '[data-change-confirm]'].forEach((selector) => {
      const input = qs(selector);
      if (input) {
        input.value = '';
        input.setAttribute('aria-invalid', 'false');
      }
    });
  }

  function fillDemo(email, password) {
    const emailInput = qs('[data-login-email]');
    const passwordInput = qs('[data-login-password]');
    if (emailInput) emailInput.value = email;
    if (passwordInput) passwordInput.value = password;
  }

  function goToTarget(user) {
    const target = redirectTarget(user);
    document.body.dataset.loginRedirectTarget = target;
    document.body.dataset.loginRedirectReady = 'true';
    location.assign(target);
  }

  function showPasswordChange(user, currentPassword) {
    const loginView = qs('[data-login-view]');
    const changeView = qs('[data-password-change-view]');
    const currentInput = qs('[data-change-current]');
    const loginPassword = qs('[data-login-password]');
    if (loginView) loginView.hidden = true;
    if (changeView) changeView.hidden = false;
    if (currentInput && currentPassword) currentInput.value = currentPassword;
    if (loginPassword) loginPassword.value = '';
    const heading = qs('[data-password-change-title]');
    if (heading) heading.textContent = user && user.name ? `Proteja seu acesso, ${String(user.name).split(' ')[0]}` : 'Crie sua nova senha';
    setStatus('Crie uma nova senha para continuar.', 'info');
    if (heading) heading.focus();
  }

  async function performLogin(email, password) {
    if (!window.BFAuth || !window.BFAuth.login) {
      setStatus('Não foi possível acessar sua conta agora. Tente novamente em instantes.', 'error');
      return { ok: false };
    }

    setBusy(true, 'Entrando…');
    markCredentialsInvalid(false);
    setStatus('Verificando seus dados…', 'info');

    let result;
    try {
      result = await Promise.resolve(window.BFAuth.login(email, password));
    } catch (error) {
      result = { ok: false, fallback: true };
    }

    if (!result || !result.ok) {
      const rateLimited = result && result.status === 429;
      const unavailable = result && result.fallback;
      const message = rateLimited
        ? 'Muitas tentativas. Aguarde alguns minutos e tente novamente.'
        : unavailable
          ? 'Não foi possível acessar sua conta agora. Tente novamente em instantes.'
          : 'Não foi possível entrar. Confira seus dados e tente novamente.';
      setBusy(false, 'Entrar');
      markCredentialsInvalid(!rateLimited && !unavailable);
      setStatus(message, 'error');
      const focusTarget = qs(rateLimited ? '[data-login-submit]' : '[data-login-email]');
      if (focusTarget) focusTarget.focus();
      return result || { ok: false };
    }

    if (result.passwordChangeRequired || (result.user && result.user.mustChangePassword)) {
      setBusy(false, 'Entrar');
      showPasswordChange(result.user, password);
      return result;
    }

    if (result.backendLogin && typeof result.backendLogin.then === 'function') {
      try {
        await result.backendLogin;
      } catch (error) {
        // O acesso demonstrativo continua válido mesmo se o espelhamento estiver indisponível.
      }
    }

    setStatus('Acesso confirmado.', 'success');
    goToTarget(result.user);
    return result;
  }

  function renderActiveSession(current) {
    const target = qs('[data-active-session]');
    if (!target || !current) return;
    target.replaceChildren();
    const text = document.createElement('span');
    text.textContent = `${current.name} · ${current.roleLabel}`;
    const link = document.createElement('a');
    link.href = redirectTarget(current);
    link.textContent = 'Continuar';
    target.append(text, link);
  }

  async function configureExperience() {
    let mode;
    try {
      mode = window.BFAuth && typeof window.BFAuth.configureMode === 'function'
        ? await window.BFAuth.configureMode()
        : { mode: document.body.dataset.authMode === 'production' ? 'production' : 'demo' };
    } catch (error) {
      mode = { mode: document.body.dataset.authMode === 'production' ? 'production' : 'demo', unavailable: true };
    }
    const production = mode && mode.mode === 'production';
    document.body.dataset.authMode = production ? 'production' : 'demo';
    const demoPanel = qs('[data-demo-panel]');
    if (demoPanel) demoPanel.hidden = production;
    const shell = qs('.bf-auth-shell');
    if (shell) shell.classList.toggle('bf-auth-shell--single', production);
    const badge = qs('[data-login-badge]');
    if (badge) badge.textContent = production ? 'Área segura' : 'Acesso';
    let current = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    if (!current && production && window.BFAuth && typeof window.BFAuth.validateServerSession === 'function') {
      const result = await window.BFAuth.validateServerSession();
      current = result && result.ok ? result.user : null;
    }
    if (current && current.mustChangePassword) showPasswordChange(current, '');
    else renderActiveSession(current);
    return mode;
  }

  async function initLoginPage() {
    try {
      await configureExperience();
    } catch (error) {
      setStatus('Não foi possível acessar sua conta agora. Tente novamente em instantes.', 'error');
    }
    const form = qs('[data-login-form]');
    const changeForm = qs('[data-password-change-form]');
    const params = new URLSearchParams(location.search);
    if (params.get('auth') === 'expired') setStatus('Sua sessão terminou por segurança. Entre novamente para continuar.', 'info');
    if (params.get('auth') === 'forbidden') setStatus('Este acesso não está disponível para o seu perfil.', 'error');
    if (params.get('auth') === 'logout') setStatus('Você saiu com segurança.', 'success');

    document.querySelectorAll('[data-demo-login]').forEach((button) => {
      button.addEventListener('click', () => {
        fillDemo(button.dataset.email, button.dataset.password);
        performLogin(button.dataset.email, button.dataset.password);
      });
    });

    if (form) {
      form.addEventListener('submit', function (event) {
        event.preventDefault();
        const emailInput = qs('[data-login-email]');
        const passwordInput = qs('[data-login-password]');
        if (!validateLoginFields(emailInput, passwordInput)) return;
        performLogin(emailInput ? emailInput.value : '', passwordInput ? passwordInput.value : '');
      });
    }

    document.querySelectorAll('.bf-auth-form input').forEach((input) => {
      input.addEventListener('input', () => clearFieldState(input));
    });

    if (changeForm) {
      changeForm.addEventListener('submit', async function (event) {
        event.preventDefault();
        const currentInput = qs('[data-change-current]');
        const nextInput = qs('[data-change-new]');
        const confirmInput = qs('[data-change-confirm]');
        const currentPassword = currentInput ? currentInput.value : '';
        const nextPassword = nextInput ? nextInput.value : '';
        if (!validatePasswordFields(currentInput, nextInput, confirmInput)) return;
        const submit = qs('[data-change-submit]');
        if (submit) {
          submit.disabled = true;
          submit.setAttribute('aria-busy', 'true');
          submit.textContent = 'Salvando…';
        }
        let result;
        try {
          result = await window.BFAuth.changePassword(currentPassword, nextPassword);
        } catch (error) {
          result = { ok: false, fallback: true };
        } finally {
          if (submit) {
            submit.disabled = false;
            submit.setAttribute('aria-busy', 'false');
            submit.textContent = 'Salvar e continuar';
          }
        }
        if (!result || !result.ok) {
          const message = result && result.fallback
            ? 'Não foi possível atualizar sua senha agora. Tente novamente em instantes.'
            : (result && result.message ? result.message : 'Não foi possível atualizar sua senha.');
          setStatus(message, 'error');
          return;
        }
        clearPasswordFields();
        setStatus('Senha atualizada.', 'success');
        goToTarget(result.user);
      });
    }

    const changeCancel = qs('[data-change-cancel]');
    if (changeCancel) {
      changeCancel.addEventListener('click', async () => {
        changeCancel.disabled = true;
        try {
          if (window.BFAuth && typeof window.BFAuth.logout === 'function') {
            await Promise.resolve(window.BFAuth.logout());
          }
        } finally {
          clearPasswordFields();
          const loginView = qs('[data-login-view]');
          const changeView = qs('[data-password-change-view]');
          if (loginView) loginView.hidden = false;
          if (changeView) changeView.hidden = true;
          changeCancel.disabled = false;
          setStatus('Entre com a conta que deseja usar.', 'info');
          const emailInput = qs('[data-login-email]');
          if (emailInput) emailInput.focus();
        }
      });
    }
  }

  window.BFLoginSecurity = Object.freeze({
    safeRequestedTarget,
    redirectTarget
  });

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initLoginPage);
  } else {
    initLoginPage();
  }
})();
