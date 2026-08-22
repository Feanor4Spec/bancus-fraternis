/**
 * ============================================
 * Bancus Fraternis - Shared Layout
 * ============================================
 * Injeta header e footer globais nas paginas que
 * usam os placeholders data-shell-header/footer.
 * ============================================
 */
(function () {
  'use strict';

  const inPagesDir = location.pathname.includes('/pages/');
  const inSubDir = inPagesDir || location.pathname.includes('/docs/') || location.pathname.includes('/versions/');
  const rootDir = inSubDir ? '../' : '';
  const pageDir = inPagesDir ? '' : 'pages/';
  const currentPage = location.pathname.split('/').pop() || 'index.html';
  const pageName = currentPage.replace(/\.html$/i, '');
  const settingsDefaults = {
    showJourney: true,
    smoothScroll: true,
    darkMode: false,
    autoScore: true,
    pageSize: 20,
    defaultSegmento: '',
    defaultAdmin: '',
    defaultIndiceReajuste: 5,
    defaultMesContemplacao: 18
  };

  function loadSharedSettings() {
    if (window.Settings && typeof window.Settings.load === 'function') {
      return window.Settings.load();
    }

    try {
      const raw = localStorage.getItem('consorciopro_settings');
      const saved = raw ? JSON.parse(raw) : {};
      return { ...settingsDefaults, ...(saved && typeof saved === 'object' ? saved : {}) };
    } catch (e) {
      return { ...settingsDefaults };
    }
  }

  function normalizeSharedPageSize(value) {
    const size = Number(value);
    return Number.isFinite(size) && size > 0 ? Math.min(50, Math.max(20, Math.round(size))) : settingsDefaults.pageSize;
  }

  function applySharedSettings() {
    if (window.Settings && typeof window.Settings.applyGlobal === 'function') {
      window.Settings.applyGlobal();
      return;
    }

    const config = loadSharedSettings();
    document.documentElement.classList.toggle('bf-settings-no-smooth', config.smoothScroll === false);
    document.body.classList.toggle('bf-settings-no-smooth', config.smoothScroll === false);
    document.body.classList.toggle('bf-settings-dark', config.darkMode === true);
    document.body.classList.toggle('bf-settings-hide-journey', config.showJourney === false);
    document.body.classList.toggle('bf-settings-autoscore-off', config.autoScore === false);
    document.documentElement.style.scrollBehavior = config.smoothScroll === false ? 'auto' : 'smooth';
    document.body.dataset.settingsApplied = 'true';
    const pageSize = normalizeSharedPageSize(config.pageSize);
    document.body.dataset.settingsPageSize = String(pageSize);
    document.body.dataset.settingsAutoScore = config.autoScore === false ? 'off' : 'on';
    document.body.dataset.settingsSegmento = String(config.defaultSegmento || '');

    document.querySelectorAll('[data-settings-summary]').forEach((el) => {
      const parts = [];
      if (config.defaultAdmin) parts.push(`admin ${config.defaultAdmin}`);
      if (config.defaultSegmento) parts.push(`segmento ${config.defaultSegmento}`);
      parts.push(`${pageSize} grupos/pagina`);
      parts.push(config.autoScore === false ? 'score manual' : 'score automatico');
      el.textContent = parts.join(' | ');
    });
  }

  function isActive(href) {
    const current = location.pathname.split('/').pop() || 'index.html';
    const target = href.split('/').pop() || 'index.html';
    return current === target ? ' is-active' : '';
  }

  function ensureStylesheet(href, id) {
    if (document.getElementById(id)) return;
    const normalized = href.replace(rootDir, '');
    const exists = Array.from(document.querySelectorAll('link[rel="stylesheet"]'))
      .some((link) => String(link.getAttribute('href') || '').endsWith(normalized));
    if (exists) return;

    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = href;
    document.head.appendChild(link);
  }

  function inferArchetype() {
    const explicit = document.body.dataset.bfArchetype;
    if (explicit) return explicit;
    if (pageName === 'index' || pageName === 'sobre-nos' || pageName === 'duvidas' || pageName === 'educacao' || pageName === 'compliance' || pageName === 'dados-abertos' || pageName === 'componentes-v8') return 'institutional';
    if (pageName.startsWith('calculadora') || pageName.startsWith('simulador')) return 'calculator';
    if (pageName === 'comparador' || pageName === 'produtos' || pageName === 'trilha-decisao' || pageName === 'modelos-biblioteca') return 'decision';
    if (pageName.includes('dashboard') || pageName === 'carteira' || pageName === 'assembleias') return 'dashboard';
    if (pageName.includes('governanca') || pageName === 'handoff-consultivo' || pageName === 'api-docs' || pageName === 'configuracoes') return 'governance';
    return 'platform';
  }

  function applyV8ShellContract() {
    ensureStylesheet(`${rootDir}assets/css/platform.css`, 'bf-platform-css');
    ensureStylesheet(`${rootDir}assets/css/bf-design-system-v8.css`, 'bf-design-system-v8-css');
    document.body.classList.add('bf-v8-body');
    if (!document.body.classList.contains('home-body') && !document.body.classList.contains('sim-body')) {
      document.body.classList.add('bf-platform-body');
    }
    document.body.dataset.bfArchetype = inferArchetype();
    document.body.dataset.bfVisualVersion = '8';
  }

  function navLink(href, label) {
    return `<a class="nav__link${isActive(href)}" href="${href}">${label}</a>`;
  }

  const navigationByRole = Object.freeze({
    public: [
      ['index.html', 'Início'],
      ['produtos.html', 'Produtos'],
      ['educacao.html', 'Como funciona'],
      ['simulador.html', 'Simular'],
      ['duvidas.html', 'Dúvidas']
    ],
    cliente: [
      ['dashboard-cliente.html', 'Meu painel'],
      ['simulador.html', 'Simular'],
      ['dashboard-cliente.html#atividade-recente', 'Propostas'],
      ['comparador.html', 'Comparar'],
      ['dashboard-cliente.html#continuidade-cliente', 'Atendimento']
    ],
    consultor: [
      ['handoff-consultivo.html', 'Atendimento'],
      ['simulador.html', 'Nova simulação'],
      ['carteira.html', 'Carteira'],
      ['assembleias.html', 'Assembleias'],
      ['modelos-biblioteca.html', 'Modelos']
    ],
    admin: [
      ['dashboard-admin.html', 'Operação'],
      ['handoff-consultivo.html', 'Atendimento'],
      ['carteira.html', 'Carteira'],
      ['simulador.html', 'Simular'],
      ['dashboard-admin.html#admin-usuarios', 'Usuários']
    ]
  });

  function activeUser() {
    return window.BFAuth && typeof window.BFAuth.getCurrentUser === 'function'
      ? window.BFAuth.getCurrentUser()
      : null;
  }

  function roleKey(user = activeUser()) {
    return user && navigationByRole[user.role] ? user.role : 'public';
  }

  function primaryNavigation(user = activeUser()) {
    return navigationByRole[roleKey(user)]
      .map(([route, label]) => navLink(`${pageDir}${route}`, label))
      .join('');
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function accountControls() {
    const auth = window.BFAuth;
    if (!auth) return navLink(`${pageDir}login.html`, 'Login');

    const user = auth.getCurrentUser();
    if (!user) return navLink(`${pageDir}login.html`, 'Entrar');

    const firstName = String(user.name || 'Usuario').trim().split(/\s+/)[0];
    return `
      <span class="bf-account-chip" title="${escapeHtml(user.email)}">
        <strong>${escapeHtml(firstName)}</strong>
      </span>
      <button class="bf-logout-button" type="button" data-auth-logout>Sair</button>
    `;
  }

  function demoChip() {
    if (window.BFAuth && window.BFAuth.authMode() === 'production') return '';
    return '<span class="bf-demo-chip" title="Ambiente de demonstração">Demonstração</span>';
  }

  function footerContent(user = activeUser()) {
    const role = roleKey(user);
    const homeHref = role === 'cliente'
      ? `${pageDir}dashboard-cliente.html`
      : role === 'consultor'
        ? `${pageDir}handoff-consultivo.html`
        : role === 'admin'
          ? `${pageDir}dashboard-admin.html`
          : `${pageDir}index.html`;
    const adminLinks = role === 'admin' ? `
      <div>
        <h5>Administração</h5>
        <a href="${pageDir}modelos-governanca.html">Modelos</a><br>
        <a href="${pageDir}calculadoras-governanca.html">Calculadoras</a><br>
        <a href="${pageDir}api-docs.html">Integrações</a>
      </div>
    ` : '';
    const homeLabel = role === 'consultor'
      ? 'Atendimento'
      : role === 'admin'
        ? 'Operação'
        : role === 'public'
          ? 'Início'
          : 'Meu painel';

    return `
      <div class="footer__grid">
        <div>
          <img src="${rootDir}assets/logos/logo-bank-fratern-dark.svg" alt="Bancus Fraternis" class="footer__logo">
          <p>Planejamento, simulação e acompanhamento de consórcio em uma única jornada.</p>
        </div>
        <div class="footer__links">
          <div>
            <h5>Acesso rápido</h5>
            <a href="${homeHref}">${homeLabel}</a><br>
            <a href="${pageDir}simulador.html">Simular</a><br>
            <a href="${pageDir}produtos.html">Produtos</a><br>
            <a href="${pageDir}duvidas.html">Dúvidas</a><br>
            <a href="${pageDir}compliance.html">Privacidade</a><br>
            <a href="${pageDir}sobre-nos.html">Sobre nós</a>
          </div>
          ${adminLinks}
        </div>
      </div>
      <div class="footer__bottom">© 2026 Bancus Fraternis</div>
    `;
  }

  const HEADER_HTML = `
    <header class="header bf-header">
      <div class="header__inner bf-header__inner">
        <a href="${rootDir}index.html" class="logo bf-brand" aria-label="Bancus Fraternis - inicio">
          <img src="${rootDir}assets/logos/logo-bank-fratern-portal.svg" alt="Bancus Fraternis" class="logo__image bf-brand__logo">
        </a>
        <button class="bf-mobile-nav-toggle" type="button" aria-expanded="false" aria-controls="bf-primary-navigation" data-mobile-nav-toggle>Menu</button>
        <nav class="nav bf-nav" id="bf-primary-navigation" aria-label="Navegação principal" data-mobile-nav>
          <span data-shell-primary-nav>${primaryNavigation()}</span>
          ${demoChip()}
          <span data-auth-controls>${accountControls()}</span>
        </nav>
      </div>
    </header>
  `;

  const FOOTER_HTML = `
    <footer class="footer">
      <div class="container" data-shell-footer-content>
        ${footerContent()}
      </div>
    </footer>
  `;

  applyV8ShellContract();

  const headerSlot = document.querySelector('[data-shell-header]');
  if (headerSlot) headerSlot.outerHTML = HEADER_HTML;

  const footerSlot = document.querySelector('[data-shell-footer]');
  if (footerSlot) footerSlot.outerHTML = FOOTER_HTML;

  if (window.BFAuth && window.BFAuth.ready) {
    window.BFAuth.ready.then(() => {
      const user = activeUser();
      const primaryNav = document.querySelector('[data-shell-primary-nav]');
      const controls = document.querySelector('[data-auth-controls]');
      const footer = document.querySelector('[data-shell-footer-content]');
      if (primaryNav) primaryNav.innerHTML = primaryNavigation(user);
      if (controls) controls.innerHTML = accountControls();
      if (footer) footer.innerHTML = footerContent(user);
    });
  }

  applySharedSettings();

  document.addEventListener('click', async function (e) {
    const mobileNavButton = e.target.closest('[data-mobile-nav-toggle]');
    const mobileNav = document.querySelector('[data-mobile-nav]');
    if (mobileNavButton && mobileNav) {
      const expanded = mobileNavButton.getAttribute('aria-expanded') === 'true';
      mobileNavButton.setAttribute('aria-expanded', expanded ? 'false' : 'true');
      mobileNavButton.textContent = expanded ? 'Menu' : 'Fechar';
      mobileNav.classList.toggle('is-open', !expanded);
      return;
    }

    if (mobileNav && mobileNav.classList.contains('is-open') && e.target.closest('[data-mobile-nav] a')) {
      const button = document.querySelector('[data-mobile-nav-toggle]');
      mobileNav.classList.remove('is-open');
      if (button) {
        button.setAttribute('aria-expanded', 'false');
        button.textContent = 'Menu';
      }
    }

    const logoutButton = e.target.closest('[data-auth-logout]');
    if (logoutButton && window.BFAuth) {
      logoutButton.disabled = true;
      try {
        await Promise.resolve(window.BFAuth.logout());
      } finally {
        location.href = `${pageDir}login.html?auth=logout`;
      }
      return;
    }

    const sw = e.target.closest('.switch');
    if (sw) sw.classList.toggle('is-on');
  });

  document.addEventListener('keydown', function (event) {
    if (event.key !== 'Escape') return;
    const mobileNav = document.querySelector('[data-mobile-nav]');
    const button = document.querySelector('[data-mobile-nav-toggle]');
    if (!mobileNav || !mobileNav.classList.contains('is-open')) return;
    mobileNav.classList.remove('is-open');
    if (button) {
      button.setAttribute('aria-expanded', 'false');
      button.textContent = 'Menu';
      button.focus();
    }
  });

  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.faq-item');
      if (item) item.classList.toggle('is-open');
    });
  });
})();
