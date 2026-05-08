/**
 * Bancus Fraternis - Phase 1 database progress controller.
 * Keeps boot, database status and shelf journey bars in sync.
 */
(function () {
  const stageOrder = ['connect', 'download', 'parse', 'filters', 'shelf'];
  const stageLabels = {
    connect: 'Conexao local',
    download: 'Download JSON',
    parse: 'Validacao',
    filters: 'Filtros',
    shelf: 'Prateleira'
  };

  const state = {
    percent: 0,
    message: 'Aguardando conexao com a base.',
    detail: 'Base ainda nao inicializada.',
    mode: 'pending',
    count: 0,
    source: 'pending',
    path: 'data_base/Tab_Grupos_Consorcio.compact.json'
  };

  function clamp(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return 0;
    return Math.max(0, Math.min(100, Math.round(n)));
  }

  function formatCount(value) {
    const n = Number(value || 0);
    return Number.isFinite(n) ? n.toLocaleString('pt-BR') : '0';
  }

  function sourceLabel(source) {
    if (source === 'compact-json') return 'Base compacta JSON';
    if (source === 'real-json') return 'Base real JSON';
    if (source === 'fallback') return 'Fallback local';
    if (source === 'loading') return 'Carregando';
    return 'Pendente';
  }

  function text(id, value) {
    const el = document.getElementById(id);
    if (el) el.textContent = value;
  }

  function width(id, value) {
    const el = document.getElementById(id);
    if (el) el.style.width = `${clamp(value)}%`;
  }

  function dataset(id, key, value) {
    const el = document.getElementById(id);
    if (el) el.dataset[key] = value;
  }

  function setStage(stage, status) {
    document.querySelectorAll(`[data-loading-stage="${stage}"], [data-journey-stage="${stage}"]`).forEach((el) => {
      el.dataset.stageState = status;
    });
  }

  function markDoneUntil(stage) {
    const idx = stageOrder.indexOf(stage);
    stageOrder.forEach((key, i) => {
      if (idx < 0) setStage(key, 'pending');
      else setStage(key, i < idx ? 'done' : (i === idx ? 'active' : 'pending'));
    });
  }

  function render() {
    const percent = clamp(state.percent);
    const statusText = `${percent}%`;
    text('loading-message', state.message);
    text('loading-progress-value', statusText);
    text('loading-detail', state.detail);
    text('database-status-percent', statusText);
    text('database-status-title', state.mode === 'success' ? 'Base real conectada' : 'Conexao com base real');
    text('database-status-text', state.detail);
    text('database-status-count', `${formatCount(state.count)} grupos`);
    text('database-status-source', sourceLabel(state.source));
    text('database-status-path', state.path || '-');
    text('database-status-badge', state.mode === 'success' ? 'Online' : (state.mode === 'fallback' ? 'Fallback' : 'Fase 1'));
    width('loading-progress-bar', percent);
    width('database-status-bar', percent);
    dataset('database-status-panel', 'state', state.mode);
    dataset('loading-overlay', 'state', state.mode);
  }

  function update(next) {
    Object.assign(state, next || {});
    state.percent = clamp(state.percent);
    render();
  }

  function start(message, detail) {
    update({
      percent: 8,
      message: message || 'Preparando conexao com a base.',
      detail: detail || 'Abrindo canal local para data_base/Tab_Grupos_Consorcio.compact.json.',
      mode: 'loading',
      source: 'loading'
    });
    markDoneUntil('connect');
  }

  function stage(stageName, percent, message, detail) {
    update({
      percent,
      message: message || stageLabels[stageName] || state.message,
      detail: detail || state.detail,
      mode: 'loading'
    });
    markDoneUntil(stageName);
  }

  function syncFromShelfStatus(status) {
    if (!status) return;
    const stats = status.stats || {};
    update({
      count: status.count || stats.valid || 0,
      source: status.source || state.source,
      path: stats.path || state.path
    });
  }

  function success(count, detail) {
    update({
      percent: 100,
      message: `OK - ${formatCount(count)} grupos carregados.`,
      detail: detail || 'Base real disponivel para filtros, prateleira e simulacao.',
      mode: 'success',
      count,
      source: 'compact-json'
    });
    stageOrder.forEach((key) => setStage(key, 'done'));
  }

  function fallback(count, detail) {
    update({
      percent: 100,
      message: `Fallback ativo - ${formatCount(count)} grupos disponiveis.`,
      detail: detail || 'Base real indisponivel; catalogo local de seguranca em uso.',
      mode: 'fallback',
      count,
      source: 'fallback'
    });
    stageOrder.forEach((key) => setStage(key, 'done'));
  }

  function error(detail) {
    update({
      percent: 100,
      message: 'Base indisponivel no momento.',
      detail: detail || 'O simulador iniciou em modo seguro.',
      mode: 'error'
    });
    stageOrder.forEach((key) => setStage(key, 'pending'));
  }

  function journey(percent, message, mode) {
    const value = clamp(percent);
    text('journey-progress-value', `${value}%`);
    text('journey-progress-text', message || 'Atualizando jornada.');
    width('journey-progress-bar', value);
    dataset('journey-progress-panel', 'state', mode || 'loading');
  }

  function holdOverlay() {
    const params = new URLSearchParams(window.location.search);
    return params.has('showLoading') || params.has('holdLoading');
  }

  function hideOverlay() {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) overlay.style.display = 'none';
  }

  window.BankFraternProgress = {
    update,
    start,
    stage,
    syncFromShelfStatus,
    success,
    fallback,
    error,
    journey,
    setStage,
    holdOverlay,
    hideOverlay
  };
})();
