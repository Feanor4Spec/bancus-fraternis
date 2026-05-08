(function () {
  'use strict';

  let catalog = [];
  let basePremissas = {};
  let currentPremissas = {};
  let goldenTests = [];

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function fmtNumber(value, digits = 2) {
    return Number(value || 0).toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function calculatorPage(slug) {
    return `calculadora-${slug}.html`;
  }

  function getPath(value, path) {
    if (!path) return value;
    return String(path).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
  }

  function resultTone(ok) {
    return ok ? 'bf-platform-alert--success' : '';
  }

  function metric(label, value, tone) {
    return `<article class="bf-platform-metric ${tone || ''}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`;
  }

  function renderSummary() {
    const target = qs('[data-governance-summary]');
    if (!target) return;

    const fieldCount = catalog.reduce((sum, item) => sum + (item.fields || []).length, 0);
    const categories = new Set(catalog.map((item) => item.categoria)).size;
    const overrides = window.BFCalculadoras.loadPremissasOverride();
    const hasOverride = Object.keys(overrides).length > 0;
    const lastUpdate = overrides.overrideUpdatedAt ? new Date(overrides.overrideUpdatedAt).toLocaleString('pt-BR') : 'Sem override local';

    target.innerHTML = `
      <div class="bf-calculator-profile">
        <div>
          <span class="bf-badge bf-badge--${hasOverride ? 'warn' : 'ok'}">${hasOverride ? 'Override local ativo' : 'Base curada ativa'}</span>
          <h2>Governanca v7.2 pronta para auditoria</h2>
          <p>Catalogo, campos, premissas, formulas e testes ficam versionaveis. Ultima alteracao local: ${escapeHtml(lastUpdate)}.</p>
        </div>
        <div class="bf-calculator-profile__metrics">
          <div><small>Calculadoras</small><strong>${catalog.length}</strong></div>
          <div><small>Campos</small><strong>${fieldCount}</strong></div>
          <div><small>Categorias</small><strong>${categories}</strong></div>
          <div><small>Golden tests</small><strong>${goldenTests.length}</strong></div>
        </div>
      </div>
    `;
  }

  function fillPremissasForm() {
    const form = qs('[data-premissas-form]');
    const status = qs('[data-premissas-status]');
    if (!form) return;

    const indices = currentPremissas.indices || {};
    ['selicAnual', 'cdiAnual', 'ipcaAnual', 'trAnual', 'poupancaMes'].forEach((name) => {
      if (form.elements[name]) form.elements[name].value = indices[name] ?? '';
    });

    const override = window.BFCalculadoras.loadPremissasOverride();
    const hasOverride = Object.keys(override).length > 0;
    if (status) {
      status.innerHTML = hasOverride
        ? `Override local aplicado sobre a base de referencia ${escapeHtml(basePremissas.referencia || '-')}.`
        : `Usando base curada de referencia ${escapeHtml(basePremissas.referencia || '-')}.`;
    }
  }

  function runGoldenTests() {
    const f = window.BFFinancialFormulas;
    return goldenTests.map((test) => {
      const fn = f[test.fn];
      if (typeof fn !== 'function') {
        return { ...test, ok: false, actual: 'funcao ausente', diff: null };
      }
      const actualRaw = fn.apply(null, test.args || []);
      const actual = getPath(actualRaw, test.path);
      const diff = Math.abs(Number(actual) - Number(test.expected));
      const ok = Number.isFinite(diff) && diff <= Number(test.tolerance || 0);
      return { ...test, ok, actual, diff };
    });
  }

  function renderGoldenTests(autoRun) {
    const target = qs('[data-golden-tests-result]');
    if (!target) return;
    if (!autoRun) {
      target.innerHTML = '<div class="bf-empty-state">Clique em executar testes para validar a biblioteca financeira comum.</div>';
      return;
    }

    const results = runGoldenTests();
    const passed = results.filter((item) => item.ok).length;
    const ok = passed === results.length;
    target.innerHTML = `
      <div class="bf-platform-alert ${resultTone(ok)}">
        <strong>${passed}/${results.length} testes aprovados.</strong><br>
        Tolerancias pequenas validam arredondamento de moeda, taxa e amortizacao.
      </div>
      <div class="bf-admin-table-wrap">
        <table class="data-table bf-admin-table bf-governance-test-table">
          <thead><tr><th>Teste</th><th>Esperado</th><th>Obtido</th><th>Status</th></tr></thead>
          <tbody>
            ${results.map((item) => `
              <tr>
                <td><strong>${escapeHtml(item.name)}</strong><small>${escapeHtml(item.fn)}${item.path ? `.${escapeHtml(item.path)}` : ''}</small></td>
                <td>${escapeHtml(fmtNumber(item.expected, 2))}</td>
                <td>${Number.isFinite(Number(item.actual)) ? escapeHtml(fmtNumber(item.actual, 2)) : escapeHtml(item.actual)}</td>
                <td><span class="bf-status-pill bf-status-pill--${item.ok ? 'active' : 'inactive'}">${item.ok ? 'Aprovado' : 'Falhou'}</span></td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function typeLabel(type) {
    const labels = {
      credito: 'Credito',
      investimento: 'Investimento',
      comparacao: 'Comparacao',
      planejamento: 'Planejamento',
      educacao: 'Educacao'
    };
    return labels[type] || type || '-';
  }

  function filteredCatalog() {
    const search = (qs('[data-calculator-search]')?.value || '').trim().toLowerCase();
    const type = qs('[data-calculator-type-filter]')?.value || '';
    const category = qs('[data-calculator-category-filter]')?.value || '';

    return catalog.filter((item) => {
      const haystack = [item.nome, item.tipo, item.categoria, item.formula, item.risco, item.resumo].join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesType = !type || item.tipo === type;
      const matchesCategory = !category || item.categoria === category;
      return matchesSearch && matchesType && matchesCategory;
    });
  }

  function renderCategoryFilter() {
    const target = qs('[data-calculator-category-filter]');
    if (!target) return;
    const categories = Array.from(new Set(catalog.map((item) => item.categoria).filter(Boolean))).sort((a, b) => a.localeCompare(b, 'pt-BR'));
    target.innerHTML = '<option value="">Todas</option>' + categories.map((category) => `<option value="${escapeHtml(category)}">${escapeHtml(category)}</option>`).join('');
  }

  function renderCatalogTable() {
    const target = qs('[data-calculator-governance-table]');
    if (!target) return;
    const list = filteredCatalog();

    if (list.length === 0) {
      target.innerHTML = '<tr><td colspan="6"><div class="bf-empty-state">Nenhuma calculadora encontrada para os filtros atuais.</div></td></tr>';
      return;
    }

    target.innerHTML = list.map((item) => `
      <tr>
        <td><strong>${escapeHtml(item.nome)}</strong><small>${escapeHtml(item.categoria)} - ${escapeHtml(item.slug)}</small></td>
        <td><span class="bf-role-pill">${escapeHtml(typeLabel(item.tipo))}</span></td>
        <td>${(item.fields || []).length}</td>
        <td><code>${escapeHtml(item.formula)}</code></td>
        <td>${escapeHtml(item.risco)}</td>
        <td><a class="btn btn--ghost btn--sm" href="${calculatorPage(item.slug)}">Abrir</a></td>
      </tr>
    `).join('');
  }

  function bindPremissasForm() {
    const form = qs('[data-premissas-form]');
    if (!form) return;
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const values = Object.fromEntries(new FormData(form).entries());
      const indices = {};
      Object.keys(values).forEach((key) => {
        indices[key] = Number(values[key] || 0);
      });
      window.BFCalculadoras.savePremissasOverride({ indices });
      currentPremissas = await window.BFCalculadoras.premissas();
      fillPremissasForm();
      renderSummary();
      renderGoldenTests(true);
    });

    qs('[data-reset-premissas]')?.addEventListener('click', async () => {
      if (!window.confirm('Restaurar as premissas locais para a base curada?')) return;
      window.BFCalculadoras.clearPremissasOverride();
      currentPremissas = await window.BFCalculadoras.premissas();
      fillPremissasForm();
      renderSummary();
      renderGoldenTests(true);
    });
  }

  function bindFilters() {
    ['[data-calculator-search]', '[data-calculator-type-filter]', '[data-calculator-category-filter]'].forEach((selector) => {
      qs(selector)?.addEventListener('input', renderCatalogTable);
      qs(selector)?.addEventListener('change', renderCatalogTable);
    });
    qs('[data-run-golden-tests]')?.addEventListener('click', () => renderGoldenTests(true));
  }

  async function init() {
    const user = window.BFAuth.requireRole(['admin'], { redirect: true });
    if (!user) return;

    [catalog, basePremissas, currentPremissas, goldenTests] = await Promise.all([
      window.BFCalculadoras.catalog(),
      window.BFCalculadoras.basePremissas(),
      window.BFCalculadoras.premissas(),
      window.BFDadosService.json('calculadoras-golden-tests')
    ]);

    renderSummary();
    fillPremissasForm();
    renderGoldenTests(false);
    renderCategoryFilter();
    renderCatalogTable();
    bindPremissasForm();
    bindFilters();
    document.body.dataset.governanceReady = 'true';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
