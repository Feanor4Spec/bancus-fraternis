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
    pageSize: 50,
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
    document.body.dataset.settingsPageSize = String(config.pageSize || 50);
    document.body.dataset.settingsAutoScore = config.autoScore === false ? 'off' : 'on';
    document.body.dataset.settingsSegmento = String(config.defaultSegmento || '');

    document.querySelectorAll('[data-settings-summary]').forEach((el) => {
      const parts = [];
      if (config.defaultAdmin) parts.push(`admin ${config.defaultAdmin}`);
      if (config.defaultSegmento) parts.push(`segmento ${config.defaultSegmento}`);
      parts.push(`${config.pageSize || 50} grupos/pagina`);
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
    const adminLink = user.role === 'admin' ? navLink(`${pageDir}dashboard-admin.html`, 'Admin') : '';

    return `
      ${adminLink}
      <span class="bf-account-chip" title="${escapeHtml(user.email)}">
        <strong>${escapeHtml(firstName)}</strong>
        <small>${escapeHtml(user.roleLabel || auth.roleLabel(user.role))}</small>
      </span>
      <button class="bf-logout-button" type="button" data-auth-logout>Sair</button>
    `;
  }

  function demoChip() {
    return '<span class="bf-demo-chip" title="Ambiente publico de demonstracao: dados e sessoes ficam somente no navegador.">Demo local</span>';
  }

  const HEADER_HTML = `
    <header class="header bf-header">
      <div class="header__inner bf-header__inner">
        <a href="${rootDir}index.html" class="logo bf-brand" aria-label="Bancus Fraternis - inicio">
          <img src="${rootDir}assets/logos/logo-bank-fratern-portal.svg" alt="Bancus Fraternis" class="logo__image bf-brand__logo">
        </a>
        <nav class="nav bf-nav" aria-label="Navegacao principal">
          ${navLink(`${pageDir}index.html`, 'Inicio')}
          ${navLink(`${pageDir}educacao.html`, 'Educacao')}
          ${navLink(`${pageDir}produtos.html`, 'Produtos')}
          ${navLink(`${pageDir}trilha-decisao.html`, 'Trilha')}
          ${navLink(`${pageDir}calculadoras.html`, 'Calculadoras')}
          ${navLink(`${pageDir}comparador.html`, 'Comparador')}
          ${navLink(`${pageDir}dados-abertos.html`, 'Dados')}
          ${navLink(`${pageDir}compliance.html`, 'Compliance')}
          ${navLink(`${pageDir}componentes-v8.html`, 'Design')}
          ${navLink(`${pageDir}dashboard-cliente.html`, 'Dashboard')}
          ${navLink(`${pageDir}simulador.html`, 'Simulacao')}
          ${demoChip()}
          ${accountControls()}
        </nav>
      </div>
    </header>
  `;

  const FOOTER_HTML = `
    <footer class="footer">
      <div class="container">
        <div class="footer__grid">
          <div>
            <img src="${rootDir}assets/logos/logo-bank-fratern-dark.svg" alt="Bancus Fraternis" class="footer__logo">
            <p>Plataforma de engenharia de consorcio, educacao financeira aplicada e construcao de propostas estruturadas com foco em clareza, confianca e eficiencia operacional.</p>
          </div>
          <div class="footer__links">
            <div>
              <h5>Portal</h5>
              <a href="${pageDir}index.html">Inicio</a><br>
              <a href="${pageDir}educacao.html">Educacao financeira</a><br>
              <a href="${pageDir}produtos.html">Produtos</a><br>
              <a href="${pageDir}trilha-decisao.html">Trilha assistida</a><br>
              <a href="${pageDir}calculadoras.html">Calculadoras</a><br>
              <a href="${pageDir}consorcio_user_journey_map_v2.html">Jornada completa</a><br>
              <a href="${pageDir}simulador.html">Simulacao</a>
            </div>
            <div>
              <h5>Plataforma</h5>
              <a href="${pageDir}comparador.html">Comparador</a><br>
              <a href="${pageDir}modelos-biblioteca.html">Biblioteca de modelos</a><br>
              <a href="${pageDir}trilha-decisao.html">Jornada de decisao</a><br>
              <a href="${pageDir}handoff-consultivo.html">Handoff consultivo</a><br>
              <a href="${pageDir}calculadora-custos-fixos.html">Diagnostico financeiro</a><br>
              <a href="${pageDir}calculadoras-governanca.html">Governanca de calculadoras</a><br>
              <a href="${pageDir}modelos-governanca.html">Governanca de modelos</a><br>
              <a href="${pageDir}dados-abertos.html">Dados abertos</a><br>
              <a href="${pageDir}api-docs.html">API Docs</a><br>
              <a href="${pageDir}compliance.html">Compliance</a><br>
              <a href="${pageDir}componentes-v8.html">Componentes v8</a>
            </div>
          </div>
        </div>
        <div class="footer__bottom">© 2026 Bancus Fraternis - Portal de engenharia de consorcio v.8</div>
      </div>
    </footer>
  `;

  applyV8ShellContract();

  const headerSlot = document.querySelector('[data-shell-header]');
  if (headerSlot) headerSlot.outerHTML = HEADER_HTML;

  const footerSlot = document.querySelector('[data-shell-footer]');
  if (footerSlot) footerSlot.outerHTML = FOOTER_HTML;

  applySharedSettings();

  document.addEventListener('click', function (e) {
    const logoutButton = e.target.closest('[data-auth-logout]');
    if (logoutButton && window.BFAuth) {
      window.BFAuth.logout();
      location.href = `${pageDir}login.html`;
      return;
    }

    const sw = e.target.closest('.switch');
    if (sw) sw.classList.toggle('is-on');
  });

  document.querySelectorAll('.faq-q').forEach(function (btn) {
    btn.addEventListener('click', function () {
      const item = btn.closest('.faq-item');
      if (item) item.classList.toggle('is-open');
    });
  });
})();
