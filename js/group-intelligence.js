(function (global) {
  'use strict';

  const diagnostics = {
    schema: 'bancus.group-intelligence-diagnostics.v1',
    errors: [],
    warnings: [],
    resources: [],
    state: 'loading',
    groupKey: ''
  };
  global.__groupIntelligenceDiagnostics = diagnostics;

  const charts = new Map();
  let currentGroup = null;
  let currentHistory = null;
  let drawerReturnFocus = null;
  let drawerInertState = [];
  let confirmationRequired = false;
  let operationalView = null;
  let operationalMode = 'count';
  let syncSectionNavFromPosition = null;

  global.addEventListener('error', (event) => {
    diagnostics.errors.push(String(event.message || 'Erro de execução não identificado.'));
  });
  global.addEventListener('unhandledrejection', (event) => {
    diagnostics.errors.push(String(event.reason?.message || event.reason || 'Promessa rejeitada.'));
  });

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));
  const integer = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 0 });
  const money = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });
  const percent = new Intl.NumberFormat('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  const shortDate = new Intl.DateTimeFormat('pt-BR', { month: 'short', year: '2-digit' });
  const fullDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: 'short', year: 'numeric' });

  function safeNumber(value) {
    if (value === null || value === undefined || value === '') return null;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  function formatInteger(value) {
    const parsed = safeNumber(value);
    return parsed === null ? 'Não disponível' : integer.format(parsed);
  }

  function formatMoney(value) {
    const parsed = safeNumber(value);
    return parsed === null ? 'Não disponível' : money.format(parsed);
  }

  function formatPercent(value) {
    const parsed = safeNumber(value);
    return parsed === null ? 'Não disponível' : `${percent.format(parsed)}%`;
  }

  function formatDate(value) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? 'Data não informada' : fullDate.format(date).replace('.', '');
  }

  function formatMonth(value) {
    const date = new Date(`${value}T12:00:00`);
    return Number.isNaN(date.getTime()) ? '—' : shortDate.format(date).replace('.', '');
  }

  function formatCompetence(value) {
    const raw = String(value == null ? '' : value).trim();
    const match = raw.match(/^(\d{4})[-/]?(\d{2})$/);
    if (!match) return raw || 'Não informada';
    const month = Number(match[2]);
    if (month < 1 || month > 12) return raw;
    const label = new Intl.DateTimeFormat('pt-BR', { month: 'long', year: 'numeric' })
      .format(new Date(Number(match[1]), month - 1, 1));
    return label.charAt(0).toUpperCase() + label.slice(1);
  }

  function requestedGroupKey() {
    const params = new URLSearchParams(global.location.search || '');
    const explicit = String(params.get('groupKey') || '').trim();
    if (!explicit) return '';
    return explicit.length <= 250 ? explicit : '';
  }

  function setState(state, message = '') {
    diagnostics.state = state;
    document.body.dataset.groupState = state;
    const main = $('#main');
    if (main) main.setAttribute('aria-busy', state === 'loading' ? 'true' : 'false');
    const loading = $('[data-group-loading]');
    const error = $('[data-group-error]');
    const empty = $('[data-group-empty]');
    const content = $('[data-group-content]');
    if (loading) loading.hidden = state !== 'loading';
    if (error) error.hidden = state !== 'error';
    if (empty) empty.hidden = state !== 'empty';
    if (content) content.hidden = state !== 'ready';
    if (state === 'error' && message) {
      const target = $('[data-group-error-message]');
      if (target) target.textContent = message;
    }
  }

  function validateGroupIdentity(group) {
    const expected = [group.cnpjRaiz, group.dataBase, group.codigoSegmento, group.codigoGrupo]
      .map((part) => String(part == null || part === '' ? '' : part))
      .join('|');
    return expected === String(group.groupKey || '');
  }

  function resolveGroup(groupKey) {
    const catalog = typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog) ? ShelfCatalog : [];
    return catalog.find((group) => String(group?.groupKey || '') === String(groupKey || '')) || null;
  }

  function setText(selector, value, root = document) {
    $$(selector, root).forEach((element) => { element.textContent = String(value == null ? '' : value); });
  }

  function renderIdentity(group) {
    const competence = formatCompetence(group.dataBase);
    const admin = String(group.nomeAdministradora || 'Administradora não informada');
    const shortAdmin = admin.split(/\s+/).filter(Boolean)[0] || 'Administradora';
    setText('[data-group-code]', group.codigoGrupo || '—');
    setText('[data-group-admin]', admin);
    setText('[data-group-admin-short]', shortAdmin);
    setText('[data-group-segment]', group.nomeSegmento || 'Segmento não informado');
    setText('[data-group-competence]', competence);
    setText('[data-group-key]', group.groupKey || '—');
    setText('[data-snapshot-chip-date]', competence);
    setText('[data-source-key]', group.groupKey || '—');
    setText('[data-source-snapshot]', `Catálogo de grupos, competência ${competence}.`);
    setText('[data-snapshot-title]', competence);
    document.title = `Grupo ${group.codigoGrupo || ''} | Visão 360 Bancus Fraternis`;
  }

  function renderSnapshot(group) {
    const values = {
      active: formatInteger(group.qtdAtivasEmDia),
      contemplated: formatInteger(group.qtdContempladasNoMes),
      pending: formatInteger(group.qtdCreditoPendente),
      credit: formatMoney(group.valorCartaRef),
      term: safeNumber(group.prazoMeses) === null ? 'Não disponível' : `${integer.format(Number(group.prazoMeses))} meses`,
      fee: formatPercent(group.taxaAdmPct),
      excluded: formatInteger(group.qtdExcluidas),
      paid: formatInteger(group.qtdQuitadas),
      index: String(group.indiceCorrecaoNome || 'Não disponível')
    };
    Object.entries(values).forEach(([key, value]) => setText(`[data-snapshot="${key}"]`, value));
    renderOperational(group);
  }

  function countStatus(value) {
    return safeNumber(value) === null ? 'unavailable' : 'observed';
  }

  function statusLabel(status, unavailableLabel = 'Não calculável') {
    if (status === 'derived') return 'Calculado';
    if (status === 'observed') return 'Observado';
    return unavailableLabel;
  }

  function quotaPhrase(value) {
    const parsed = safeNumber(value);
    if (parsed === null) return 'contagem não informada';
    return `${integer.format(parsed)} ${parsed === 1 ? 'cota' : 'cotas'}`;
  }

  function metricPercentage(metric) {
    return safeNumber(metric?.percentage?.value);
  }

  function percentageOrUnavailable(metric) {
    const value = metricPercentage(metric);
    return value === null ? 'Não calculável' : formatPercent(value);
  }

  function unavailabilityCopy(metric) {
    const messages = {
      competence_missing: 'competência não informada',
      numerator_unavailable: 'contagem não informada',
      denominator_unavailable: 'base ativa não informada',
      denominator_zero: 'base ativa igual a zero',
      observed_value_unavailable: 'valor observado não informado'
    };
    return messages[metric?.unavailableReason] || 'dados insuficientes';
  }

  function renderOperationalDefinitions(metrics) {
    const root = $('[data-operational-definitions]');
    if (!root) return;
    root.replaceChildren();
    const order = [
      'monthlyContemplationsRelative',
      'historicalExclusionPressure',
      'pendingCreditRelative',
      'observedMaturity'
    ];
    order.forEach((key) => {
      const metric = metrics?.[key];
      if (!metric) return;
      const item = document.createElement('div');
      const term = document.createElement('dt');
      const label = document.createElement('span');
      const badge = document.createElement('span');
      const detail = document.createElement('dd');
      const definition = document.createElement('p');
      const formula = document.createElement('code');
      const limitation = document.createElement('p');
      label.textContent = metric.label;
      badge.className = 'group360-data-status';
      badge.dataset.status = metric.status;
      badge.textContent = statusLabel(metric.status, 'Não disponível');
      term.append(label, badge);
      definition.textContent = metric.definition;
      formula.textContent = metric.formula;
      limitation.textContent = metric.limitation;
      detail.append(definition, formula, limitation);
      item.append(term, detail);
      root.append(item);
    });
  }

  function operationalRows(mode) {
    const metrics = operationalView?.result?.metrics || {};
    const monthly = metrics.monthlyContemplationsRelative;
    const exclusion = metrics.historicalExclusionPressure;
    const pendingRelative = metrics.pendingCreditRelative;
    const active = safeNumber(monthly?.counts?.denominator?.value);
    const contemplated = safeNumber(monthly?.counts?.numerator?.value);
    const excluded = safeNumber(exclusion?.counts?.numerator?.value);
    const pending = safeNumber(pendingRelative?.counts?.numerator?.value);

    const baseSupport = active === null
      ? 'Base ativa não informada; indicadores relativos não calculáveis.'
      : active === 0
        ? 'Base ativa observada em zero; indicadores relativos não calculáveis.'
        : 'Base observada usada nos indicadores relativos desta competência.';

    const countRows = {
      active: {
        value: formatInteger(active),
        support: baseSupport,
        status: countStatus(active),
        unavailableLabel: 'Não informado'
      },
      contemplated: {
        value: formatInteger(contemplated),
        support: contemplated === 0
          ? 'Nenhuma ocorrência na competência; isso não projeta eventos futuros.'
          : metricPercentage(monthly) === null
            ? `Indicador relativo não calculável: ${unavailabilityCopy(monthly)}.`
            : `${formatPercent(metricPercentage(monthly))} da base. Não representa chance ou garantia de contemplação.`,
        status: countStatus(contemplated),
        unavailableLabel: 'Não informado'
      },
      excluded: {
        value: formatInteger(excluded),
        support: metricPercentage(exclusion) === null
          ? `Indicador relativo não calculável: ${unavailabilityCopy(exclusion)}.`
          : `${formatPercent(metricPercentage(exclusion))} da base atual. Estoque acumulado; não é taxa mensal.`,
        status: countStatus(excluded),
        unavailableLabel: 'Não informado'
      },
      pending: {
        value: formatInteger(pending),
        support: pending === 0
          ? 'Nenhuma ocorrência na competência; não mede disponibilidade de caixa.'
          : metricPercentage(pendingRelative) === null
            ? `Indicador relativo não calculável: ${unavailabilityCopy(pendingRelative)}.`
            : `${formatPercent(metricPercentage(pendingRelative))} da base. Não mede insolvência, caixa ou liquidez.`,
        status: countStatus(pending),
        unavailableLabel: 'Não informado'
      }
    };

    if (mode === 'count') return countRows;
    return {
      active: countRows.active,
      contemplated: {
        value: percentageOrUnavailable(monthly),
        support: metricPercentage(monthly) === null
          ? `${quotaPhrase(contemplated)} na competência; percentual não calculável por ${unavailabilityCopy(monthly)}.`
          : `${quotaPhrase(contemplated)} na competência. Não representa chance ou garantia de contemplação.`,
        status: monthly?.status || 'unavailable'
      },
      excluded: {
        value: percentageOrUnavailable(exclusion),
        support: metricPercentage(exclusion) === null
          ? `${quotaPhrase(excluded)} acumuladas; percentual não calculável por ${unavailabilityCopy(exclusion)}.`
          : `${quotaPhrase(excluded)} acumuladas em relação à base atual. Pode superar 100% e não é taxa mensal.`,
        status: exclusion?.status || 'unavailable'
      },
      pending: {
        value: percentageOrUnavailable(pendingRelative),
        support: metricPercentage(pendingRelative) === null
          ? `${quotaPhrase(pending)} com utilização pendente; percentual não calculável por ${unavailabilityCopy(pendingRelative)}.`
          : `${quotaPhrase(pending)} com utilização pendente. Não mede insolvência, caixa ou liquidez.`,
        status: pendingRelative?.status || 'unavailable'
      }
    };
  }

  function renderOperationalMode(mode = 'count', options = {}) {
    if (!operationalView) return;
    operationalMode = mode === 'relative' ? 'relative' : 'count';
    const rows = operationalRows(operationalMode);
    Object.entries(rows).forEach(([key, row]) => {
      setText(`[data-operational-value="${key}"]`, row.value);
      setText(`[data-operational-support="${key}"]`, row.support);
      $$(`[data-operational-status="${key}"]`).forEach((element) => {
        element.textContent = statusLabel(row.status, row.unavailableLabel);
        element.dataset.status = row.status;
      });
    });
    $$('[data-operational-mode]').forEach((button) => {
      button.setAttribute('aria-pressed', String(button.dataset.operationalMode === operationalMode));
    });
    const base = safeNumber(operationalView.group.qtdAtivasEmDia);
    const competence = formatCompetence(operationalView.group.dataBase);
    const announcement = operationalMode === 'relative'
      ? base !== null && base > 0
        ? `Exibindo indicadores relativos à base de ${quotaPhrase(base)} ativas em dia.`
        : `Exibindo indicadores relativos. Percentuais não calculáveis: ${base === 0 ? 'base ativa igual a zero' : 'base ativa não informada'}.`
      : `Exibindo as contagens observadas na competência ${competence}.`;
    setText('[data-operational-live]', announcement);
    if (options.focus === true) $(`[data-operational-mode="${operationalMode}"]`)?.focus();
  }

  function renderCatalogHealth(group) {
    const delinquency = safeNumber(group?.taxaInadimplencia);
    const level = String(group?.saudeCarteira || '').trim();
    const healthCopy = delinquency === null
      ? 'Inadimplência não informada.'
      : `Inadimplência ${formatPercent(delinquency * 100)}${level ? ` · faixa da carteira: ${level.toLocaleLowerCase('pt-BR')}` : ''}.`;
    setText('[data-operational-health]', healthCopy);
  }

  function renderOperationalUnavailable(group) {
    const message = 'Leitura operacional indisponível nesta sessão.';
    $('[data-operational-section]')?.setAttribute('data-operational-state', 'unavailable');
    ['active', 'contemplated', 'excluded', 'pending'].forEach((key) => {
      setText(`[data-operational-value="${key}"]`, 'Não disponível');
      setText(`[data-operational-support="${key}"]`, 'Não foi possível calcular este indicador.');
      $$(`[data-operational-status="${key}"]`).forEach((element) => {
        element.textContent = 'Indisponível';
        element.dataset.status = 'unavailable';
      });
    });
    $$('[data-operational-mode]').forEach((button) => { button.disabled = true; });
    setText('[data-operational-live]', message);
    setText('[data-operational-maturity-summary]', 'Maturidade indisponível');
    setText('[data-operational-classification]', 'A leitura das cotas não pôde ser preparada nesta sessão.');
    setText('[data-operational-competence]', formatCompetence(group?.dataBase));
    $('[data-operational-definitions]')?.replaceChildren();
    renderCatalogHealth(group);
  }

  function renderOperational(group) {
    const engine = global.BFGroupOperationalMetrics;
    if (!engine?.calculate) {
      diagnostics.warnings.push('Motor de métricas operacionais indisponível.');
      renderOperationalUnavailable(group);
      return;
    }
    const result = engine.calculate(group);
    operationalView = { group, result };
    const maturity = result.metrics.observedMaturity;
    const maturityValue = metricPercentage(maturity);
    setText('[data-operational-maturity-summary]', maturityValue === null
      ? 'Maturidade não informada'
      : `${formatPercent(maturityValue)} de maturidade observada`);
    const classification = String(group.classificacaoExecutiva || '').trim();
    setText('[data-operational-classification]', classification
      ? `Classificação do catálogo: ${classification.replace(/\s+-\s+/g, ' — ')}.`
      : 'Classificação do catálogo não informada.');
    renderCatalogHealth(group);
    setText('[data-operational-competence]', formatCompetence(group.dataBase));
    renderOperationalDefinitions(result.metrics);
    renderOperationalMode(operationalMode);
    diagnostics.resources.push({
      type: 'operational-metrics',
      schema: result.schema,
      version: result.version,
      competence: result.competence,
      status: 'ready'
    });
  }

  function renderMetrics(history) {
    const metrics = history.metrics;
    const rows = history.events || [];
    const minimumRow = rows.reduce((best, row) => (
      !best || Number(row.bidMin) < Number(best.bidMin) ? row : best
    ), null);
    const recentRows = rows.slice(-Math.min(3, rows.length));
    const recentMin = recentRows.length ? Math.min(...recentRows.map((row) => Number(row.bidMin))) : null;
    const recentMax = recentRows.length ? Math.max(...recentRows.map((row) => Number(row.bidMin))) : null;
    setText('[data-metric="assemblies"]', formatInteger(metrics.assemblies));
    setText('[data-metric="total"]', formatInteger(metrics.total));
    setText('[data-metric="bid"]', formatInteger(metrics.bid));
    setText('[data-metric="bidShare"]', `${formatPercent(metrics.bidShare)} das contemplações`);
    setText('[data-metric="range"]', `${formatPercent(metrics.minimumBid)}–${formatPercent(metrics.maximumBid)}`);

    const minimumContext = minimumRow
      ? `O menor lance contemplado informado foi ${formatPercent(minimumRow.bidMin)}, na assembleia ${minimumRow.assembly}.`
      : 'Não há lance mínimo informado na série.';
    const recentContext = recentMin !== null
      ? ` Nos ${recentRows.length} eventos finais, os mínimos ficaram entre ${formatPercent(recentMin)} e ${formatPercent(recentMax)}.`
      : '';
    setText('[data-history-change]', `${minimumContext}${recentContext}`);
    setText('[data-history-peak]', `Maior volume: assembleia ${metrics.peakAssembly}, com ${formatInteger(metrics.peakTotal)} contemplações.`);
    setText('[data-volume-description]', `Nas ${metrics.assemblies} assembleias demonstrativas houve ${metrics.total} contemplações: ${metrics.lottery} por sorteio e ${metrics.bid} por lance. O maior volume ocorreu na assembleia ${metrics.peakAssembly}, com ${metrics.peakTotal} contemplações.`);
    setText('[data-bid-description]', `A faixa da série vai de ${formatPercent(metrics.minimumBid)} a ${formatPercent(metrics.maximumBid)}. ${minimumContext} Isso descreve somente os eventos demonstrativos disponíveis e não define lance futuro.`);
  }

  function createCell(tag, value, scope) {
    const cell = document.createElement(tag);
    if (scope) cell.scope = scope;
    cell.textContent = value;
    return cell;
  }

  function renderTables(history) {
    const volumeBody = $('[data-assembly-table-body]');
    const bidBody = $('[data-bid-table-body]');
    if (volumeBody) volumeBody.replaceChildren();
    if (bidBody) bidBody.replaceChildren();

    history.events.forEach((row) => {
      if (volumeBody) {
        const tr = document.createElement('tr');
        tr.append(
          createCell('th', `AGO ${row.assembly}`, 'row'),
          createCell('td', formatDate(row.date)),
          createCell('td', formatInteger(row.lottery)),
          createCell('td', formatInteger(row.bid)),
          createCell('td', formatInteger(row.lottery + row.bid))
        );
        const actionCell = document.createElement('td');
        const action = document.createElement('button');
        action.type = 'button';
        action.textContent = 'Detalhes';
        action.dataset.assemblyId = String(row.id);
        action.setAttribute('aria-label', `Abrir detalhes da assembleia ${row.assembly}`);
        actionCell.append(action);
        tr.append(actionCell);
        volumeBody.append(tr);
      }
      if (bidBody) {
        const tr = document.createElement('tr');
        tr.append(
          createCell('th', `AGO ${row.assembly}`, 'row'),
          createCell('td', formatDate(row.date)),
          createCell('td', formatPercent(row.bidMin)),
          createCell('td', formatPercent(row.bidMax))
        );
        bidBody.append(tr);
      }
    });
  }

  function chartDefaults() {
    return {
      responsive: true,
      maintainAspectRatio: false,
      animation: global.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? false : { duration: 450 },
      layout: { padding: { top: 16 } },
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { position: 'bottom', labels: { usePointStyle: true, pointStyle: 'circle', boxWidth: 8, boxHeight: 8, color: '#41566f', font: { size: 11, weight: '600' } } },
        tooltip: { displayColors: true, backgroundColor: '#061a2e', padding: 12, titleFont: { weight: '700' }, bodySpacing: 6 }
      },
      scales: {
        x: {
          grid: { display: false },
          title: { display: true, text: 'Data da assembleia', color: '#64748b', font: { size: 10, weight: '600' } },
          ticks: { color: '#64748b', font: { size: 9 }, maxRotation: 0, autoSkip: false }
        },
        y: {
          beginAtZero: true,
          grid: { color: '#e7edf4' },
          border: { display: false },
          title: { display: true, text: 'Contemplações (quantidade)', color: '#64748b', font: { size: 10, weight: '600' } },
          ticks: { color: '#64748b', precision: 0, font: { size: 10 } }
        }
      }
    };
  }

  function axisDate(value) {
    const date = new Date(`${value}T12:00:00`);
    if (Number.isNaN(date.getTime())) return 'Data n/d';
    return new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit', year: '2-digit' }).format(date);
  }

  function setChartFallback(kind, visible) {
    const canvas = kind === 'volume' ? $('#assembly-volume-chart') : $('#assembly-bid-chart');
    const fallback = kind === 'volume' ? $('[data-volume-chart-fallback]') : $('[data-bid-chart-fallback]');
    if (fallback) fallback.hidden = !visible;
    if (canvas?.closest('.group360-chart-canvas')) canvas.closest('.group360-chart-canvas').hidden = visible;
  }

  function bindChartKeyboard(canvas, chart, history, kind) {
    if (!canvas || !chart || !history.events.length) return;
    if (canvas.__groupChartKeydown) canvas.removeEventListener('keydown', canvas.__groupChartKeydown);
    let activeIndex = 0;
    const live = kind === 'volume' ? $('[data-volume-chart-live]') : $('[data-bid-chart-live]');
    const announce = () => {
      const row = history.events[activeIndex];
      const active = chart.data.datasets.map((dataset, datasetIndex) => ({ datasetIndex, index: activeIndex }));
      chart.setActiveElements(active);
      chart.tooltip?.setActiveElements(active, { x: 0, y: 0 });
      chart.update('none');
      if (!live) return;
      live.textContent = kind === 'volume'
        ? `Assembleia ${row.assembly}, ${formatDate(row.date)}: ${row.lottery} por sorteio, ${row.bid} por lance, ${row.lottery + row.bid} no total.`
        : `Assembleia ${row.assembly}, ${formatDate(row.date)}: lance mínimo ${formatPercent(row.bidMin)} e máximo ${formatPercent(row.bidMax)}.`;
    };
    const handler = (event) => {
      if (!['ArrowLeft', 'ArrowRight', 'Home', 'End', 'Escape'].includes(event.key)) return;
      event.preventDefault();
      if (event.key === 'Escape') {
        chart.setActiveElements([]);
        chart.tooltip?.setActiveElements([], { x: 0, y: 0 });
        chart.update('none');
        if (live) live.textContent = 'Navegação do gráfico encerrada.';
        return;
      }
      if (event.key === 'Home') activeIndex = 0;
      else if (event.key === 'End') activeIndex = history.events.length - 1;
      else if (event.key === 'ArrowLeft') activeIndex = Math.max(0, activeIndex - 1);
      else activeIndex = Math.min(history.events.length - 1, activeIndex + 1);
      announce();
    };
    canvas.__groupChartKeydown = handler;
    canvas.addEventListener('keydown', handler);
  }

  function renderCharts(history) {
    if (!global.Chart) {
      diagnostics.warnings.push('Chart.js indisponível; tabelas equivalentes mantidas.');
      setChartFallback('volume', true);
      setChartFallback('bids', true);
      return;
    }
    charts.forEach((chart) => chart.destroy());
    charts.clear();
    const labels = history.events.map((row) => [`AGO ${row.assembly}`, axisDate(row.date)]);
    const volumeCanvas = $('#assembly-volume-chart');
    const bidCanvas = $('#assembly-bid-chart');
    if (volumeCanvas) {
      try {
        setChartFallback('volume', false);
        const options = chartDefaults();
        options.scales.x.stacked = true;
        options.scales.y.stacked = true;
        options.plugins.tooltip.callbacks = { title: (items) => `Assembleia ${history.events[items[0]?.dataIndex || 0]?.assembly || ''}` };
        const totalLabels = {
          id: 'groupVolumeTotals',
          afterDatasetsDraw(chart) {
            const meta = chart.getDatasetMeta(chart.data.datasets.length - 1);
            const context = chart.ctx;
            context.save();
            context.fillStyle = '#0f172a';
            context.font = '700 10px Inter, Segoe UI, sans-serif';
            context.textAlign = 'center';
            history.events.forEach((row, index) => {
              const point = meta.data[index];
              if (point) context.fillText(String(row.lottery + row.bid), point.x, point.y - 7);
            });
            context.restore();
          }
        };
        const chart = new global.Chart(volumeCanvas, {
          type: 'bar',
          data: { labels, datasets: [
            { label: 'Sorteio', data: history.events.map((row) => row.lottery), backgroundColor: '#2a75b8', borderRadius: 5, borderSkipped: false },
            { label: 'Lance', data: history.events.map((row) => row.bid), backgroundColor: '#1f8a63', borderRadius: 5, borderSkipped: false }
          ] },
          options,
          plugins: [totalLabels]
        });
        charts.set('volume', chart);
        bindChartKeyboard(volumeCanvas, chart, history, 'volume');
      } catch (error) {
        diagnostics.warnings.push(`Gráfico de contemplações indisponível: ${error.message}`);
        setChartFallback('volume', true);
      }
    }
    if (bidCanvas) {
      try {
        setChartFallback('bids', false);
        const options = chartDefaults();
        options.scales.y.beginAtZero = false;
        options.scales.y.suggestedMin = 18;
        options.scales.y.title.text = 'Lance contemplado (% do crédito)';
        options.scales.y.ticks.callback = (value) => `${value}%`;
        options.plugins.tooltip.callbacks = {
          title: (items) => `Assembleia ${history.events[items[0]?.dataIndex || 0]?.assembly || ''}`,
          label: (context) => `${context.dataset.label}: ${formatPercent(context.parsed.y)}`
        };
        const chart = new global.Chart(bidCanvas, {
          type: 'line',
          data: { labels, datasets: [
            { label: 'Lance máximo', data: history.events.map((row) => row.bidMax), borderColor: '#b33a4d', backgroundColor: '#b33a4d', borderDash: [6, 4], pointStyle: 'rectRot', pointRadius: 5, pointHoverRadius: 7, tension: .22 },
            { label: 'Lance mínimo', data: history.events.map((row) => row.bidMin), borderColor: '#2a75b8', backgroundColor: '#2a75b8', pointStyle: 'circle', pointRadius: 3, pointHoverRadius: 5, tension: .22 }
          ] },
          options
        });
        charts.set('bids', chart);
        bindChartKeyboard(bidCanvas, chart, history, 'bids');
      } catch (error) {
        diagnostics.warnings.push(`Gráfico de lances indisponível: ${error.message}`);
        setChartFallback('bids', true);
      }
    }
  }

  function renderHistory(history) {
    const ready = $('[data-history-ready]');
    const empty = $('[data-history-empty]');
    const chip = $('[data-history-source-chip]');
    const sourceCard = $('[data-source-history-card]');
    if (!history.available) {
      if (ready) ready.hidden = true;
      if (empty) empty.hidden = false;
      if (chip) chip.hidden = true;
      if (sourceCard) sourceCard.hidden = true;
      $$('.group360-section-nav a[href="#assembleias"], .group360-section-nav a[href="#lances"]').forEach((link) => {
        link.setAttribute('aria-disabled', 'true');
        link.setAttribute('tabindex', '-1');
      });
      diagnostics.warnings.push('Não há histórico associado ao groupKey solicitado.');
      return;
    }
    if (ready) ready.hidden = false;
    if (empty) empty.hidden = true;
    if (chip) chip.hidden = false;
    if (sourceCard) sourceCard.hidden = false;
    $$('.group360-section-nav a[href="#assembleias"], .group360-section-nav a[href="#lances"]').forEach((link) => {
      link.removeAttribute('aria-disabled');
      link.removeAttribute('tabindex');
    });
    const first = history.events[0];
    const last = history.events[history.events.length - 1];
    const periodLabel = history.source?.periodLabel || (
      first && last ? `${formatMonth(first.date)} a ${formatMonth(last.date)}` : 'período não informado'
    );
    const volumeCanvas = $('#assembly-volume-chart');
    const bidCanvas = $('#assembly-bid-chart');
    const assemblyRange = first && last ? `${first.assembly} a ${last.assembly}` : 'disponíveis';
    if (volumeCanvas) volumeCanvas.setAttribute('aria-label', `Gráfico de barras empilhadas com contemplações por sorteio e lance nas assembleias ${assemblyRange}, no período ${periodLabel}.`);
    if (bidCanvas) bidCanvas.setAttribute('aria-label', `Gráfico de linhas com percentuais mínimo e máximo dos lances nas assembleias ${assemblyRange}, no período ${periodLabel}.`);
    setText('[data-history-source-chip] strong', periodLabel);
    setText('[data-source-history]', `${history.metrics.assemblies} eventos em ${periodLabel}. Associação demonstrativa não conciliada; fonte não contratual e não elegível como evidência histórica da proposta.`);
    setText('[data-source-history-id]', history.source?.sourceId || 'Identificador não informado');
    setText('.group360-legend-note', `${history.metrics.assemblies} eventos`);
    renderMetrics(history);
    renderTables(history);
    renderCharts(history);
  }

  function openDrawer(eventRow, trigger) {
    const drawer = $('[data-assembly-drawer]');
    const backdrop = $('[data-drawer-backdrop]');
    if (!drawer || !backdrop || !eventRow) return;
    drawerReturnFocus = trigger instanceof HTMLElement ? trigger : document.activeElement;
    setText('[data-drawer-title]', `Assembleia ${eventRow.assembly}`, drawer);
    setText('[data-drawer-subtitle]', `${formatDate(eventRow.date)} · Série demonstrativa`, drawer);
    const facts = $('[data-drawer-facts]', drawer);
    if (facts) {
      facts.replaceChildren();
      [
        ['Sorteio', formatInteger(eventRow.lottery)],
        ['Lance', formatInteger(eventRow.bid)],
        ['Total', formatInteger(eventRow.lottery + eventRow.bid)],
        ['Lance mínimo', formatPercent(eventRow.bidMin)],
        ['Lance máximo', formatPercent(eventRow.bidMax)],
        ['Amplitude', formatPercent(eventRow.bidMax - eventRow.bidMin)]
      ].forEach(([label, value]) => {
        const item = document.createElement('div');
        item.append(createCell('dt', label), createCell('dd', value));
        facts.append(item);
      });
    }
    const spread = eventRow.bidMax - eventRow.bidMin;
    setText('[data-drawer-note]', spread === 0
      ? `Nesta linha demonstrativa, os percentuais mínimo e máximo coincidem em ${formatPercent(eventRow.bidMin)}.`
      : `Nesta linha demonstrativa, a faixa vai de ${formatPercent(eventRow.bidMin)} a ${formatPercent(eventRow.bidMax)}, uma amplitude de ${formatPercent(spread)}.`, drawer);
    backdrop.hidden = false;
    drawer.hidden = false;
    drawer.setAttribute('aria-hidden', 'false');
    drawerInertState = Array.from(document.body.children)
      .filter((element) => element instanceof HTMLElement && element !== drawer && element !== backdrop && element.tagName !== 'SCRIPT')
      .map((element) => ({
        element,
        inert: element.inert === true,
        ariaHidden: element.getAttribute('aria-hidden')
      }));
    drawerInertState.forEach(({ element }) => {
      element.inert = true;
      element.setAttribute('aria-hidden', 'true');
    });
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => $('[data-drawer-close]', drawer)?.focus());
  }

  function closeDrawer() {
    const drawer = $('[data-assembly-drawer]');
    const backdrop = $('[data-drawer-backdrop]');
    if (!drawer || drawer.hidden) return;
    drawer.hidden = true;
    backdrop.hidden = true;
    drawer.setAttribute('aria-hidden', 'true');
    drawerInertState.forEach(({ element, inert, ariaHidden }) => {
      element.inert = inert;
      if (ariaHidden === null) element.removeAttribute('aria-hidden');
      else element.setAttribute('aria-hidden', ariaHidden);
    });
    drawerInertState = [];
    document.body.style.overflow = '';
    if (drawerReturnFocus instanceof HTMLElement && drawerReturnFocus.isConnected) drawerReturnFocus.focus();
    drawerReturnFocus = null;
  }

  function trapDrawerFocus(event) {
    const drawer = $('[data-assembly-drawer]');
    if (!drawer || drawer.hidden) return;
    if (event.key === 'Escape') {
      event.preventDefault();
      closeDrawer();
      return;
    }
    if (event.key !== 'Tab') return;
    const focusable = $$('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])', drawer)
      .filter((element) => !element.hidden && element.getClientRects().length);
    if (!focusable.length) return;
    const first = focusable[0];
    const last = focusable[focusable.length - 1];
    if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
  }

  function snapshotEvidence(group) {
    const catalogResource = diagnostics.resources.find((entry) => entry.type === 'catalog') || {};
    return global.BFGroupJourney?.buildSnapshotEvidence?.(group, {
      format: catalogResource.sourceSchema || '',
      sourceSha256: catalogResource.sourceSha256 || '',
      generatedAt: catalogResource.sourceGeneratedAt || ''
    }) || [];
  }

  function returnToken() {
    return String(new URLSearchParams(global.location.search || '').get('returnState') || '').trim();
  }

  function resolvedReturnState() {
    const candidate = returnToken();
    const state = candidate ? global.BFGroupJourney?.read?.(candidate) : null;
    return state ? { token: candidate, state } : { token: '', state: null };
  }

  function simulatorReturnHref(extra = {}) {
    const { token, state } = resolvedReturnState();
    const params = new URLSearchParams(state?.source?.search || '');
    params.set('from', 'grupo');
    params.set('restore', '1');
    params.set('groupReturn', token || 'direct');
    if (extra.useGroup) params.set('useGroup', '1');
    if (extra.compareGroup) {
      params.set('compareGroup', '1');
      params.set('compareGroupKey', String(extra.compareGroupKey || currentGroup?.groupKey || ''));
    } else {
      params.delete('compareGroup');
      params.delete('compareGroupKey');
    }
    const hash = /^#[A-Za-z0-9._:-]{1,160}$/.test(String(state?.source?.hash || ''))
      ? state.source.hash
      : '#step-4';
    return `simulador.html?${params.toString()}${hash}`;
  }

  function returnToSimulator(options = {}) {
    global.location.assign(simulatorReturnHref(options));
  }

  function selectGroup(intent = 'project') {
    if (!currentGroup) return;
    const { token } = resolvedReturnState();
    const selection = {
      schema: 'bancus.group-selection.v1',
      createdAt: new Date().toISOString(),
      groupKey: String(currentGroup.groupKey || ''),
      intent,
      evidence: snapshotEvidence(currentGroup),
      confirmationRequired,
      assemblyHistory: currentHistory?.available ? {
        status: 'demonstrative',
        includedInProposal: false,
        sourceId: currentHistory.source?.sourceId || '',
        period: currentHistory.source?.periodLabel || ''
      } : { status: 'unavailable', includedInProposal: false }
    };
    try {
      sessionStorage.setItem(`bf_group_selection_v1:${token || 'direct'}`, JSON.stringify(selection));
    } catch (error) {
      diagnostics.errors.push(`Não foi possível preparar a seleção: ${error.message}`);
      setText('[data-project-note]', 'Não foi possível preparar o retorno. Tente novamente.');
      return;
    }
    returnToSimulator({
      useGroup: true,
      compareGroup: intent === 'compare',
      compareGroupKey: intent === 'compare' ? currentGroup.groupKey : ''
    });
  }

  function useGroup() { selectGroup('project'); }

  function compareGroup() { selectGroup('compare'); }

  function syncSectionNav(hash = global.location.hash) {
    const links = $$('.group360-section-nav a[href^="#"]');
    const wanted = links.find((link) => link.getAttribute('href') === hash)
      || links.find((link) => link.getAttribute('href') === '#historia');
    links.forEach((link) => link.removeAttribute('aria-current'));
    if (wanted) wanted.setAttribute('aria-current', 'location');
  }

  function configureNavigation() {
    const back = $('[data-back-to-shelf]');
    if (back) {
      back.href = simulatorReturnHref();
      back.addEventListener('click', (event) => {
        event.preventDefault();
        returnToSimulator();
      });
    }
    $$('[data-use-group]').forEach((button) => button.addEventListener('click', useGroup));
    $$('[data-compare-group]').forEach((button) => button.addEventListener('click', compareGroup));
    $('[data-group-retry]')?.addEventListener('click', () => global.location.reload());
    $('[data-confirm-parameters]')?.addEventListener('click', (event) => {
      confirmationRequired = true;
      event.currentTarget.textContent = 'Conferência necessária';
      event.currentTarget.disabled = true;
      setText('[data-confirmation-status]', 'Esta pendência acompanhará o grupo até a proposta.');
    });
    $$('[data-operational-mode]').forEach((button) => {
      button.addEventListener('click', () => {
        renderOperationalMode(button.dataset.operationalMode);
        syncSectionNav('#retrato');
      });
    });
    $('.group360-section-nav')?.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="#"]');
      if (!link || link.getAttribute('aria-disabled') === 'true') {
        if (link) event.preventDefault();
        return;
      }
      syncSectionNav(link.getAttribute('href'));
    });
    global.addEventListener('hashchange', () => syncSectionNav());
    syncSectionNav();
    if ('IntersectionObserver' in global) {
      const observedSections = ['historia', 'retrato', 'assembleias', 'lances', 'fluxos', 'fontes']
        .map((id) => document.getElementById(id))
        .filter(Boolean);
      const syncFromPosition = () => {
        const anchor = Math.min(180, Math.max(100, global.innerHeight * .24));
        const positions = observedSections.map((section) => {
          const rect = section.getBoundingClientRect();
          return { section, top: rect.top, bottom: rect.bottom };
        });
        const crossing = positions
          .filter((position) => position.top <= anchor && position.bottom > anchor)
          .sort((a, b) => b.top - a.top)[0];
        const upcoming = positions
          .filter((position) => position.bottom > anchor)
          .sort((a, b) => a.top - b.top)[0];
        const current = crossing || upcoming;
        if (current?.section?.id) syncSectionNav(`#${current.section.id}`);
      };
      syncSectionNavFromPosition = syncFromPosition;
      const observer = new IntersectionObserver(syncFromPosition, { rootMargin: '-100px 0px -60% 0px', threshold: [0, .01, .2] });
      observedSections.forEach((section) => observer.observe(section));
      let navigationFrame = 0;
      global.addEventListener('scroll', () => {
        if (navigationFrame) return;
        navigationFrame = global.requestAnimationFrame(() => {
          navigationFrame = 0;
          syncFromPosition();
        });
      }, { passive: true });
      global.requestAnimationFrame(syncFromPosition);
    }
    $('[data-assembly-table-body]')?.addEventListener('click', (event) => {
      const trigger = event.target.closest('[data-assembly-id]');
      if (!trigger || !currentHistory?.available) return;
      const row = currentHistory.events.find((item) => String(item.id) === trigger.dataset.assemblyId);
      openDrawer(row, trigger);
    });
    $('[data-drawer-close]')?.addEventListener('click', closeDrawer);
    $('[data-drawer-backdrop]')?.addEventListener('click', closeDrawer);
    $('[data-assembly-drawer]')?.addEventListener('keydown', trapDrawerFocus);
  }

  async function loadCatalog() {
    if (typeof loadRealDatabase !== 'function') throw new Error('O catálogo de grupos não está disponível.');
    await loadRealDatabase([
      '../data_base/Tab_Grupos_Consorcio.compact.json',
      '../data_base/Tab_Grupos_Consorcio.json'
    ]);
    const status = typeof getShelfDataStatus === 'function' ? getShelfDataStatus() : null;
    diagnostics.resources.push({
      type: 'catalog',
      source: status?.source || 'unknown',
      count: status?.count || 0,
      path: status?.stats?.path || '',
      sourceSchema: status?.stats?.format || '',
      sourceSha256: status?.stats?.sourceSha256 || '',
      sourceGeneratedAt: status?.stats?.generatedAt || ''
    });
    if (!status?.loaded) throw new Error('O catálogo oficial não pôde ser carregado.');
  }

  async function init() {
    configureNavigation();
    setState('loading');
    const groupKey = requestedGroupKey();
    diagnostics.groupKey = groupKey;
    if (!groupKey || groupKey.split('|').length !== 4) {
      setState('empty');
      return;
    }
    try {
      await loadCatalog();
      const group = resolveGroup(groupKey);
      if (!group) {
        setState('empty');
        return;
      }
      if (!validateGroupIdentity(group)) throw new Error('A identificação solicitada não corresponde aos dados desta competência. Volte à prateleira e escolha o grupo novamente.');
      currentGroup = group;
      currentHistory = global.BFGroupAssemblyData?.forGroup(group.groupKey) || { available: false, events: [], metrics: null };
      renderIdentity(group);
      renderSnapshot(group);
      renderHistory(currentHistory);
      setState('ready');
      global.requestAnimationFrame(() => syncSectionNavFromPosition?.());
      diagnostics.resources.push({ type: 'assembly-history', status: currentHistory.available ? 'demonstrative' : 'unavailable', sourceId: currentHistory.source?.sourceId || '' });
    } catch (error) {
      diagnostics.errors.push(String(error.message || error));
      const message = String(error.message || error || 'Não foi possível carregar esta referência.');
      setState('error', message.length <= 220 ? message : 'Não foi possível carregar esta referência. Volte à prateleira e tente novamente.');
    }
  }

  document.addEventListener('DOMContentLoaded', init, { once: true });
})(window);
