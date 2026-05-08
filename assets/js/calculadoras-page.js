(function () {
  'use strict';

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

  function money(value) {
    return window.BFFormatters.currency(value);
  }

  function groupByCategory(items) {
    return items.reduce((acc, item) => {
      const key = item.categoria || 'Calculadoras';
      acc[key] = acc[key] || [];
      acc[key].push(item);
      return acc;
    }, {});
  }

  function pageFor(slug) {
    if (slug === 'simulador-consorcio') return 'simulador.html';
    if (slug === 'comparador') return 'comparador.html';
    return `calculadora-${slug}.html`;
  }

  function appendQuery(href, params) {
    const [pathPart, hashPart] = String(href || '').split('#');
    const [base, query = ''] = pathPart.split('?');
    const search = new URLSearchParams(query);
    Object.entries(params || {}).forEach(([key, value]) => {
      const text = String(value == null ? '' : value).trim();
      if (text) search.set(key, text);
    });
    const nextQuery = search.toString();
    return `${base}${nextQuery ? `?${nextQuery}` : ''}${hashPart ? `#${hashPart}` : ''}`;
  }

  function calculatorPreset(slug) {
    const map = {
      'custos-fixos': 'comprar_bem',
      'capacidade-credito': 'comprar_bem',
      'lance-consorcio': 'comprar_bem',
      'compra-vista-parcelado': 'comprar_bem',
      'alugar-financiar': 'comprar_bem',
      'reserva-emergencia': 'obter_liquidez',
      'pix-parcelado': 'obter_liquidez',
      cartoes: 'consumo_pontual'
    };
    return map[slug] || '';
  }

  function calculatorContextParams(resultOrSlug, extra = {}) {
    const slug = typeof resultOrSlug === 'string' ? resultOrSlug : resultOrSlug && resultOrSlug.slug;
    const historyId = resultOrSlug && resultOrSlug.historyId ? resultOrSlug.historyId : '';
    return {
      from: 'calculator',
      calculatorSlug: slug || '',
      historyId,
      preset: calculatorPreset(slug),
      ...extra
    };
  }

  function calculatorContextHref(kind, resultOrSlug, extra = {}) {
    const slug = typeof resultOrSlug === 'string' ? resultOrSlug : resultOrSlug && resultOrSlug.slug;
    const base = {
      simulator: 'simulador.html',
      comparator: 'comparador.html',
      journey: 'trilha-decisao.html',
      dashboard: 'dashboard-cliente.html#continuidade-cliente',
      calculator: pageFor(slug || 'custos-fixos'),
      hub: 'calculadoras.html'
    }[kind] || 'calculadoras.html';
    return appendQuery(base, calculatorContextParams(resultOrSlug, extra));
  }

  function decisionContext() {
    return window.BFDecisionContext || null;
  }

  function simulatorHref(resultOrSlug) {
    return calculatorContextHref('simulator', resultOrSlug);
  }

  function renderProfileSummary(target) {
    if (!target) return;
    const profile = window.BFCalculadoras.loadProfile();
    const history = window.BFCalculadoras.loadHistory();
    const context = decisionContext();
    const status = context && typeof context.readiness === 'function'
      ? context.readiness(profile)
      : { score: profile.readinessScore || 0, level: 'diagnostico', message: 'Complete renda, custos e reserva para orientar a simulacao.' };
    const hasProfile = Object.keys(profile).length > 0;
    target.innerHTML = `
      <div class="bf-calculator-profile">
        <div>
          <span class="bf-badge bf-badge--ok">Perfil financeiro</span>
          <h2>${hasProfile ? 'Perfil consolidado ativo' : 'Perfil ainda em construcao'}</h2>
          <p>${escapeHtml(status.message || (hasProfile ? 'Campos informados em uma calculadora passam a preencher outras jornadas automaticamente.' : 'Comece por Custos Fixos ou Reserva de Emergencia para criar memoria financeira.'))}</p>
        </div>
        <div class="bf-calculator-profile__metrics">
          <div><small>Prontidao</small><strong>${Number(status.score || 0)}/100</strong></div>
          <div><small>Renda</small><strong>${profile.rendaMensal ? money(profile.rendaMensal) : '-'}</strong></div>
          <div><small>Sobra</small><strong>${profile.capacidadeAporte ? money(profile.capacidadeAporte) : '-'}</strong></div>
          <div><small>Reserva</small><strong>${profile.reservaAtual ? money(profile.reservaAtual) : '-'}</strong></div>
          <div><small>Historico</small><strong>${history.length}</strong></div>
        </div>
      </div>
    `;
  }

  function renderHistory(target) {
    if (!target) return;
    const history = window.BFCalculadoras.loadHistory().slice(0, 8);
    if (history.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhuma simulacao salva ainda. Calcule uma pagina para criar o historico.</div>';
      return;
    }
    target.innerHTML = history.map((item) => `
      <article class="bf-history-item">
        <span>${escapeHtml(item.calculatorName)}</span>
        <strong>${escapeHtml(item.recommendation ? item.recommendation.title : 'Simulacao salva')}</strong>
        <small>${new Date(item.createdAt).toLocaleString('pt-BR')}</small>
        <div class="bf-inline-actions bf-inline-actions--compact">
          <a href="${calculatorContextHref('calculator', { slug: item.calculatorSlug, historyId: item.id })}">Reabrir</a>
          <a href="${calculatorContextHref('journey', { slug: item.calculatorSlug, historyId: item.id })}">Trilha</a>
          <a href="${calculatorContextHref('comparator', { slug: item.calculatorSlug, historyId: item.id })}">Comparar</a>
          <a href="${calculatorContextHref('simulator', { slug: item.calculatorSlug, historyId: item.id })}">Simular</a>
        </div>
      </article>
    `).join('');
  }

  function renderTimeline(target, items) {
    if (!target) return;
    target.innerHTML = items.map((item, index) => `
      <a class="bf-client-timeline__item ${escapeHtml(item.state || 'is-pending')}" href="${escapeHtml(item.href || '#')}">
        <span>${index + 1}</span>
        <div>
          <small>${escapeHtml(item.label)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
      </a>
    `).join('');
  }

  function renderHubDecisionBridge(list) {
    const strip = qs('[data-calculators-decision-strip]');
    const timelineTarget = qs('[data-calculators-bridge-timeline]');
    if (!strip && !timelineTarget) return;
    const profile = window.BFCalculadoras.loadProfile();
    const history = window.BFCalculadoras.loadHistory();
    const count = Array.isArray(list) ? list.length : 0;
    const bySlug = new Map((list || []).map((item) => [item.slug, item]));
    const context = decisionContext();
    const status = context && typeof context.readiness === 'function'
      ? context.readiness(profile)
      : { score: profile.readinessScore || 0, missing: [], complete: Object.keys(profile || {}).length > 0 };
    const recommendedSlugs = context && typeof context.recommendedCalculators === 'function'
      ? context.recommendedCalculators(profile)
      : [Object.keys(profile || {}).length > 0 ? 'reserva-emergencia' : 'custos-fixos'];
    const recommendedSlug = recommendedSlugs[0] || 'custos-fixos';
    const hasProfile = Object.keys(profile || {}).length > 0;
    const recommendedStart = calculatorContextHref('calculator', recommendedSlug, { from: 'calculators' });
    const recommendedLabel = (bySlug.get(recommendedSlug) && bySlug.get(recommendedSlug).nome) || 'Custos Fixos';
    const trail = ['custos-fixos', 'reserva-emergencia', 'compra-vista-parcelado', 'comparador'];
    const trailHtml = trail.map((slug, index) => {
      const item = bySlug.get(slug);
      const title = item ? item.nome : slug;
      const state = recommendedSlugs.includes(slug) ? 'is-active' : history.some((event) => event.calculatorSlug === slug) ? 'is-done' : 'is-pending';
      return `<a class="bf-client-timeline__item ${state}" href="${calculatorContextHref(slug === 'comparador' ? 'comparator' : 'calculator', slug, { from: 'calculators' })}"><span>${index + 1}</span><div><small>Trilha minima</small><strong>${escapeHtml(title)}</strong><p>${index === 0 ? 'Mapeia renda e custos.' : index === 1 ? 'Protege liquidez.' : index === 2 ? 'Testa decisao de compra.' : 'Compara alternativas.'}</p></div></a>`;
    }).join('');

    if (strip) {
      strip.innerHTML = `
        <div class="bf-v8-decision-strip__head">
          <span class="bf-badge bf-badge--gold">Hub financeiro</span>
          <div>
            <h2>${count} calculadoras conectadas ao perfil financeiro</h2>
            <p>O hub agora prepara a simulacao: diagnostico, reserva, decisao de compra e comparador viram contexto compartilhado.</p>
            <div class="bf-inline-actions">
              <a class="btn btn--primary btn--sm" href="${recommendedStart}">Comecar por ${recommendedLabel}</a>
              <a class="btn btn--ghost btn--sm" href="${simulatorHref(recommendedSlug)}">Abrir simulador orientado</a>
              <a class="btn btn--ghost btn--sm" href="${calculatorContextHref('journey', recommendedSlug, { from: 'calculators' })}">Montar trilha</a>
              <a class="btn btn--ghost btn--sm" href="${calculatorContextHref('comparator', recommendedSlug, { from: 'calculators' })}">Comparar credito</a>
              <a class="btn btn--ghost btn--sm" href="dashboard-cliente.html#continuidade-cliente">Ver dashboard</a>
            </div>
          </div>
        </div>
        <div class="bf-v8-decision-strip__grid">
          <article class="bf-v8-decision-card ${hasProfile ? 'bf-v8-decision-card--stable' : 'bf-v8-decision-card--warning'}">
            <span>Prontidao</span>
            <strong>${Number(status.score || 0)}/100</strong>
            <p>${escapeHtml(status.message || 'Complete o diagnostico antes de simular.')}</p>
            <small>${profile.rendaMensal ? money(profile.rendaMensal) : 'sem renda registrada'}</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Ecossistema</span>
            <strong>${count} modulos</strong>
            <p>Credito, investimento, planejamento, comparacao e educacao no mesmo hub.</p>
            <small>JSON local curado</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--stable">
            <span>Historico</span>
            <strong>${history.length} simulacao${history.length === 1 ? '' : 'es'}</strong>
            <p>Cada calculo salvo vira contexto para comparador e dashboard.</p>
            <small>localStorage unificado</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Proxima acao</span>
            <strong>${recommendedLabel}</strong>
            <p>Use a recomendacao para completar renda, custos, reserva ou capacidade antes da simulacao.</p>
            <small>${(status.missing || []).length ? `${status.missing.length} pendencia${status.missing.length === 1 ? '' : 's'}` : 'perfil completo'}</small>
          </article>
        </div>
        <div class="bf-client-timeline bf-platform-section">${trailHtml}</div>
      `;
    }

    renderTimeline(timelineTarget, [
      { label: 'Diagnostico', title: status.complete ? 'Pronto para simular' : 'Completar perfil', text: status.message || 'Renda, custos e reserva reduzem recomendacoes genericas.', href: recommendedStart, state: status.complete ? 'is-done' : 'is-active' },
      { label: 'Historico', title: `${history.length} eventos`, text: 'Simulacoes recentes ficam disponiveis para retomada.', href: '#calculadoras-historico', state: history.length ? 'is-done' : 'is-pending' },
      { label: 'Hub', title: `${count} calculadoras`, text: 'Escolha o modulo pelo tipo de decisao financeira.', href: '#calculadoras-hub-grid', state: 'is-active' },
      { label: 'Trilha', title: 'Jornada assistida', text: 'A proxima etapa usa o diagnostico financeiro como entrada.', href: calculatorContextHref('journey', recommendedSlug, { from: 'calculators' }), state: hasProfile ? 'is-active' : 'is-pending' },
      { label: 'Simulador', title: 'Contexto aplicado', text: 'A entrada pode seguir com renda, reserva, capacidade e lance sugerido.', href: simulatorHref(recommendedSlug), state: status.complete ? 'is-active' : 'is-pending' },
      { label: 'Continuidade', title: 'Dashboard', text: 'O usuario retoma historico, modelos e trilha assistida.', href: 'dashboard-cliente.html#continuidade-cliente', state: 'is-pending' }
    ]);

    document.body.dataset.calculatorsBridgeReady = 'true';
  }

  function renderCalculatorDecisionBridge(result) {
    const strip = qs('[data-calculator-decision-strip]');
    const timelineTarget = qs('[data-calculator-bridge-timeline]');
    if (!strip && !timelineTarget) return;
    const history = window.BFCalculadoras.loadHistory();
    const metrics = result && Array.isArray(result.metrics) ? result.metrics : [];
    const primary = metrics[0] || { label: 'Resultado', value: 'Aguardando calculo' };
    const recommendation = result && result.recommendation ? result.recommendation : {
      title: 'Configure o cenario',
      message: 'Preencha os campos para gerar resultado, memoria e recomendacao.',
      tone: 'info',
      next: 'Calcular e salvar cenario.'
    };
    const tone = recommendation.tone === 'warn' ? 'bf-v8-decision-card--warning' : recommendation.tone === 'success' ? 'bf-v8-decision-card--stable' : 'bf-v8-decision-card--info';
    const memoryCount = result && Array.isArray(result.memory) ? result.memory.length : 0;
    const simulatorLink = result ? simulatorHref(result) : simulatorHref(document.body.dataset.calculatorSlug || '');
    const journeyLink = calculatorContextHref('journey', result || document.body.dataset.calculatorSlug || '');
    const comparatorLink = calculatorContextHref('comparator', result || document.body.dataset.calculatorSlug || '');
    const readinessScore = result && result.readinessScore !== undefined ? result.readinessScore : (window.BFCalculadoras.loadProfile().readinessScore || 0);

    if (strip) {
      strip.innerHTML = `
        <div class="bf-v8-decision-strip__head">
          <span class="bf-badge bf-badge--gold">Calculadora conectada</span>
          <div>
            <h2>${escapeHtml(recommendation.title)}</h2>
            <p>${escapeHtml(recommendation.message)}</p>
            <div class="bf-inline-actions">
              <a class="btn btn--primary btn--sm" href="#calculadora-entrada">Ajustar campos</a>
              <a class="btn btn--ghost btn--sm" href="${simulatorLink}">Levar ao simulador</a>
              <a class="btn btn--ghost btn--sm" href="${journeyLink}">Montar trilha</a>
              <a class="btn btn--ghost btn--sm" href="${comparatorLink}">Comparar</a>
              <a class="btn btn--ghost btn--sm" href="calculadoras.html">Abrir hub</a>
              <a class="btn btn--ghost btn--sm" href="dashboard-cliente.html#continuidade-cliente">Retomar no dashboard</a>
            </div>
          </div>
        </div>
        <div class="bf-v8-decision-strip__grid">
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Entrada</span>
            <strong>${result ? Object.keys(result.input || {}).length : 0} campos</strong>
            <p>Dados informados podem atualizar o perfil financeiro consolidado.</p>
            <small>Formulario local</small>
          </article>
          <article class="bf-v8-decision-card ${tone}">
            <span>Resultado</span>
            <strong>${escapeHtml(primary.value)}</strong>
            <p>${escapeHtml(primary.label)} e demais metricas ficam salvas no historico.</p>
            <small>${metrics.length} metrica${metrics.length === 1 ? '' : 's'}</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Memoria</span>
            <strong>${memoryCount} linha${memoryCount === 1 ? '' : 's'}</strong>
            <p>A explicacao registra formula, premissas e riscos do calculo.</p>
            <small>Recomendacao explicavel</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--stable">
            <span>Simulador</span>
            <strong>${readinessScore}/100</strong>
            <p>O resultado pode preencher objetivo, valor alvo, reserva e capacidade no simulador.</p>
            <small>${escapeHtml(result && result.historyId ? result.historyId : 'contexto local')}</small>
          </article>
        </div>
      `;
    }

    renderTimeline(timelineTarget, [
      { label: 'Entrada', title: 'Campos do cenario', text: 'Premissas editaveis para recalcular sem sair da pagina.', href: '#calculadora-entrada', state: 'is-done' },
      { label: 'Resultado', title: primary.value, text: recommendation.message, href: '#resultado-calculadora', state: result ? 'is-active' : 'is-pending' },
      { label: 'Memoria', title: `${memoryCount} linhas`, text: 'Formula e risco permanecem auditaveis.', href: '#resultado-calculadora', state: result ? 'is-done' : 'is-pending' },
      { label: 'Trilha', title: 'Jornada assistida', text: 'Converta resultado em objetivo, produto e proxima acao.', href: journeyLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Comparador', title: 'Alternativas', text: 'Abra uma matriz com origem e historico preservados.', href: comparatorLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Simulador', title: 'Entrada contextual', text: 'Abra a simulacao sem perder a origem da calculadora.', href: simulatorLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Continuidade', title: 'Dashboard', text: 'Historico e perfil consolidado ficam disponiveis na central do usuario.', href: 'dashboard-cliente.html#continuidade-cliente', state: 'is-pending' }
    ]);

    document.body.dataset.calculatorBridgeReady = result ? result.slug : 'pending';
  }

  function renderHub(list) {
    const grid = qs('[data-calculators-hub]');
    const profile = qs('[data-calculator-profile-summary]');
    const history = qs('[data-calculator-history]');
    if (!grid) return;

    renderProfileSummary(profile);
    renderHistory(history);
    renderHubDecisionBridge(list);

    const grouped = groupByCategory(list);
    grid.innerHTML = Object.keys(grouped).map((category) => `
      <section class="bf-calculator-group">
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">${escapeHtml(category)}</span>
            <h2>${escapeHtml(category)}</h2>
          </div>
        </div>
        <div class="bf-platform-grid">
          ${grouped[category].map((item) => `
            <article class="bf-platform-card bf-calculator-card">
              <span class="bf-badge bf-badge--navy">${escapeHtml(item.badge)}</span>
              <h3>${escapeHtml(item.nome)}</h3>
              <p>${escapeHtml(item.resumo)}</p>
              <div class="bf-inline-actions bf-inline-actions--compact">
                <a class="btn btn--primary btn--sm" href="${calculatorContextHref('calculator', item.slug, { from: 'calculators' })}">Abrir calculadora</a>
                <a class="btn btn--ghost btn--sm" href="${calculatorContextHref('journey', item.slug, { from: 'calculators' })}">Trilha</a>
                <a class="btn btn--ghost btn--sm" href="${calculatorContextHref('comparator', item.slug, { from: 'calculators' })}">Comparar</a>
              </div>
            </article>
          `).join('')}
        </div>
      </section>
    `).join('');
  }

  function renderField(field, value) {
    if (field.type === 'select') {
      return `
        <label>${escapeHtml(field.label)}
          <select name="${escapeHtml(field.name)}">
            ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}"${String(option) === String(value) ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
        </label>
      `;
    }
    return `
      <label>${escapeHtml(field.label)}
        <input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || 'number')}" step="${escapeHtml(field.step || '1')}" value="${escapeHtml(value)}">
      </label>
    `;
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function renderMetric(item) {
    return `
      <article class="bf-platform-metric ${item.tone === 'strong' || item.tone === 'success' ? 'is-strong' : ''} ${item.tone === 'warn' ? 'is-warn' : ''}">
        <small>${escapeHtml(item.label)}</small>
        <strong>${escapeHtml(item.value)}</strong>
      </article>
    `;
  }

  function alertTone(tone) {
    if (tone === 'success') return 'success';
    if (tone === 'warn') return 'warn';
    return 'info';
  }

  function renderRows(rows) {
    if (!rows || rows.length === 0) return '';
    const cols = Object.keys(rows[0]).slice(0, 5);
    return `
      <div class="bf-admin-table-wrap bf-calculator-table-wrap">
        <table class="data-table bf-admin-table">
          <thead><tr>${cols.map((col) => `<th>${escapeHtml(col)}</th>`).join('')}</tr></thead>
          <tbody>
            ${rows.map((row) => `
              <tr>${cols.map((col) => `<td>${typeof row[col] === 'number' ? escapeHtml(Number(row[col]).toLocaleString('pt-BR', { maximumFractionDigits: 2 })) : escapeHtml(row[col])}</td>`).join('')}</tr>
            `).join('')}
          </tbody>
        </table>
      </div>
    `;
  }

  function renderResult(result) {
    const target = qs('[data-calculator-result]');
    if (!target) return;
    target.innerHTML = `
      <div class="bf-platform-metrics bf-calculator-metrics">
        ${result.metrics.map(renderMetric).join('')}
      </div>
      <div class="bf-calculator-explain">
        <article class="bf-platform-alert bf-platform-alert--${alertTone(result.recommendation.tone)}">
          <strong>${escapeHtml(result.recommendation.title)}</strong><br>
          ${escapeHtml(result.recommendation.message)}<br>
          <small>${escapeHtml(result.recommendation.next)}</small>
        </article>
        <article class="bf-platform-card">
          <span class="bf-badge bf-badge--navy">Memoria de calculo</span>
          <ul>${result.memory.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
          <p>${escapeHtml(result.disclaimer)}</p>
        </article>
      </div>
      ${renderRows(result.rows)}
    `;
    renderCalculatorDecisionBridge(result);
    renderProfileSummary(qs('[data-calculator-profile-summary]'));
    renderHistory(qs('[data-calculator-history]'));
  }

  function renderRelated(list, meta) {
    const target = qs('[data-calculator-related]');
    if (!target) return;
    const related = (meta.related || []).map((slug) => list.find((item) => item.slug === slug)).filter(Boolean);
    target.innerHTML = related.map((item) => `
      <a href="${calculatorContextHref('calculator', item.slug, { from: 'calculator', previousCalculatorSlug: meta.slug })}">${escapeHtml(item.nome)} <span>${escapeHtml(item.badge)}</span></a>
    `).join('');
  }

  async function renderDetail(list, slug) {
    const meta = list.find((item) => item.slug === slug);
    if (!meta) {
      document.body.dataset.calculatorReady = 'missing';
      qs('[data-calculator-title]').textContent = 'Calculadora nao encontrada';
      return;
    }

    const defaults = window.BFCalculadoras.profileDefaults(meta);
    document.title = `${meta.nome} - Bancus Fraternis`;
    qs('[data-calculator-badge]').textContent = meta.badge;
    qs('[data-calculator-title]').textContent = meta.nome;
    qs('[data-calculator-description]').textContent = meta.resumo;
    qs('[data-calculator-question]').textContent = meta.pergunta;
    qs('[data-calculator-formula]').textContent = meta.formula;
    qs('[data-calculator-risk]').textContent = meta.risco;

    const form = qs('[data-calculator-form]');
    form.innerHTML = `
      ${(meta.fields || []).map((field) => renderField(field, defaults[field.name])).join('')}
      <button class="btn btn--primary" type="submit">Calcular e salvar cenario</button>
    `;
    renderRelated(list, meta);
    renderProfileSummary(qs('[data-calculator-profile-summary]'));
    renderHistory(qs('[data-calculator-history]'));
    renderCalculatorDecisionBridge(null);

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const result = await window.BFCalculadoras.simulate(slug, formValues(form));
      renderResult(result);
      document.body.dataset.calculatorReady = slug;
    });

    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
  }

  async function init() {
    try {
      const list = await window.BFCalculadoras.catalog();
      if (document.body.dataset.calculatorHub === 'true') {
        renderHub(list);
        document.body.dataset.calculatorReady = 'hub';
        return;
      }
      const slug = document.body.dataset.calculatorSlug;
      if (slug) await renderDetail(list, slug);
    } catch (error) {
      console.error(error);
      const target = qs('[data-calculator-result]') || qs('[data-calculators-hub]');
      if (target) target.innerHTML = `<div class="bf-platform-alert">${escapeHtml(error.message || error)}</div>`;
      document.body.dataset.calculatorReady = 'error';
    }
  }

  window.BFCalculatorJourney = {
    href: calculatorContextHref,
    params: calculatorContextParams,
    simulatorHref,
    preset: calculatorPreset
  };

  document.addEventListener('DOMContentLoaded', init);
})();
