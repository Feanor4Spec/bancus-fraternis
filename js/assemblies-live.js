/**
 * Bancus Fraternis assemblies live layer.
 * Connects assembleias.html to the real commercial catalog and saved simulations.
 */
(function () {
  'use strict';

  const CATALOG_PATH = `${location.pathname.includes('/pages/') ? '../' : ''}data_base/Tab_Grupos_Consorcio.json`;
  const series = (typeof assemblies !== 'undefined' && Array.isArray(assemblies)) ? assemblies : [];
  const integer = new Intl.NumberFormat('pt-BR');
  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });

  function one(selector) {
    return document.querySelector(selector);
  }

  function byId(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const raw = value.trim();
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function currency(value) {
    return money.format(numberValue(value));
  }

  function normalizeCode(value) {
    return String(value == null ? '' : value).replace(/^0+/, '') || '0';
  }

  function getStorageApi() {
    try {
      if (typeof Storage !== 'undefined' && Storage && typeof Storage.loadSimulations === 'function') {
        return Storage;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function getSavedMatches(groupCode) {
    const storage = getStorageApi();
    if (!storage) return [];
    const wanted = normalizeCode(groupCode);
    return storage.loadSimulations().filter(sim => {
      const cart = Array.isArray(sim.carrinho) ? sim.carrinho : [];
      return cart.some(item => normalizeCode(item.codigoGrupo) === wanted);
    });
  }

  function latestRow() {
    return series[series.length - 1] || {};
  }

  function seriesStats() {
    const totals = series.map(row => numberValue(row.qtdSorteio) + numberValue(row.qtdLance));
    const totalContempladas = totals.reduce((acc, value) => acc + value, 0);
    const totalLance = series.reduce((acc, row) => acc + numberValue(row.qtdLance), 0);
    const avgMin = series.length ? series.reduce((acc, row) => acc + numberValue(row.pctMin), 0) / series.length : 0;
    const avgMax = series.length ? series.reduce((acc, row) => acc + numberValue(row.pctMax), 0) / series.length : 0;
    return { totalContempladas, totalLance, avgMin, avgMax };
  }

  function updateHero(group, matches) {
    const latest = latestRow();
    const badge = one('.hero-badge');
    if (badge && group) {
      badge.textContent = `base real conectada - grupo ${group.codigoGrupo} - ${group.nomeSegmento || latest.tipoProduto || 'segmento'}`;
    }

    const copy = one('.hero-premium p');
    if (copy && group) {
      copy.innerHTML = `Uma visão executiva para acompanhar o histórico de assembleias do grupo <strong>${esc(group.codigoGrupo)}</strong> e cruzar o comportamento de lances com o retrato real da base comercial: administradora, carta, prazo, cotas ativas e fila ainda pendente.`;
    }

    const heroMeta = byId('heroMeta');
    if (!heroMeta || !group) return;
    heroMeta.innerHTML = `
      <div class="hero-mini">
        <span>Grupo monitorado</span>
        <strong>${esc(group.codigoGrupo)}</strong>
        <small>${esc(group.nomeAdministradora || 'Administradora')} - ${esc(group.nomeSegmento || latest.tipoProduto || 'Segmento')}</small>
      </div>
      <div class="hero-mini">
        <span>Carta referência</span>
        <strong>${currency(group.valorCartaRef)}</strong>
        <small>Valor de referência do grupo na base real.</small>
      </div>
      <div class="hero-mini">
        <span>Cotas ativas</span>
        <strong>${integer.format(numberValue(group.qtdAtivasEmDia))}</strong>
        <small>${integer.format(numberValue(group.qtdAContemplar || latest.qtdAContemplar))} cotas ainda a contemplar.</small>
      </div>
      <div class="hero-mini">
        <span>Simulações vinculadas</span>
        <strong>${integer.format(matches.length)}</strong>
        <small>Prospecções salvas neste navegador para o mesmo grupo.</small>
      </div>
    `;
  }

  function insertSourcePanel(group, catalogRows, matches) {
    const hero = one('.hero-premium');
    if (!hero) return;
    const old = byId('assemblies-live-source');
    if (old) old.remove();

    const stats = seriesStats();
    const panel = document.createElement('section');
    panel.className = 'bf-live-source bf-live-source--navy';
    panel.id = 'assemblies-live-source';
    panel.innerHTML = `
      <div>
        <span class="bf-badge bf-badge--gold">Monitor de assembleias</span>
        <h2>${group ? 'Histórico de AGOs conectado ao grupo real.' : 'Histórico de AGOs em modo demonstrativo.'}</h2>
        <p>${group
        ? `O grupo ${esc(group.codigoGrupo)} foi localizado na base real de ${integer.format(catalogRows.length)} grupos. A página agora distingue o histórico de lances importado da fotografia comercial atual.`
        : `A página segue com a série histórica demonstrativa e mantém o painel preparado para receber novos grupos reais.`}</p>
        <div class="bf-live-note">${integer.format(series.length)} assembleias históricas - ${integer.format(matches.length)} simulação${matches.length === 1 ? '' : 'ões'} vinculada${matches.length === 1 ? '' : 's'}</div>
      </div>
      <div class="bf-source-grid">
        <div class="bf-mini-stat"><span>Base real</span><strong>${integer.format(catalogRows.length)}</strong><small>grupos disponíveis</small></div>
        <div class="bf-mini-stat"><span>Grupo</span><strong>${esc(group ? group.codigoGrupo : 'n/d')}</strong><small>${esc(group ? group.statusComercial || 'sem status' : 'não localizado')}</small></div>
        <div class="bf-mini-stat"><span>Contempladas</span><strong>${integer.format(stats.totalContempladas)}</strong><small>na série histórica</small></div>
        <div class="bf-mini-stat"><span>Lance médio</span><strong>${stats.avgMin.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%</strong><small>mínimo observado</small></div>
      </div>
    `;
    hero.insertAdjacentElement('afterend', panel);
  }

  function enrichSummary(group) {
    const target = byId('summaryCards');
    if (!target || !group) return;
    const current = target.innerHTML;
    target.innerHTML = `
      <article class="sub-card">
        <span class="k">Retrato real do grupo</span>
        <strong>${esc(group.classificacaoExecutiva || group.saudeCarteira || 'Monitorado')}</strong>
        <small>${esc(group.nomeAdministradora || 'Administradora')} com ${integer.format(numberValue(group.qtdAtivasEmDia))} cotas ativas em dia e ${integer.format(numberValue(group.qtdCreditoPendente))} créditos pendentes.</small>
      </article>
    ` + current;
  }

  function enrichInsights(group, matches) {
    const target = byId('insights');
    if (!target || !group) return;
    const item = document.createElement('article');
    item.className = 'insight-item';
    item.innerHTML = `
      <div class="insight-icon i-win">BF</div>
      <div class="insight-text">
        <strong>Base comercial confirma o grupo monitorado</strong>
        <span>${esc(group.nomeAdministradora || 'Administradora')} aparece na base real com carta de ${currency(group.valorCartaRef)}, prazo de ${integer.format(numberValue(group.prazoMeses))} meses e saúde ${esc(group.saudeCarteira || 'não classificada')}. ${integer.format(matches.length)} simulação${matches.length === 1 ? '' : 'ões'} salva${matches.length === 1 ? '' : 's'} está${matches.length === 1 ? '' : 'ão'} vinculada${matches.length === 1 ? '' : 's'} a este grupo.</span>
      </div>
      <div class="insight-chip">Fonte real</div>
    `;
    target.prepend(item);
  }

  function enrichTable(group) {
    const count = byId('tableCount');
    if (count && group) {
      count.textContent = `${integer.format(series.length)} assembleias - grupo ${group.codigoGrupo} conectado à base real`;
    }
  }

  async function loadCatalog() {
    const response = await fetch(CATALOG_PATH, { cache: 'no-store' });
    if (!response.ok) throw new Error(`HTTP ${response.status}`);
    const rows = await response.json();
    return Array.isArray(rows) ? rows : [];
  }

  async function init() {
    if (!series.length) return;
    try {
      const rows = await loadCatalog();
      const latest = latestRow();
      const group = rows.find(row => normalizeCode(row.codigoGrupo) === normalizeCode(latest.codigoGrupo));
      const matches = group ? getSavedMatches(group.codigoGrupo) : [];
      updateHero(group, matches);
      insertSourcePanel(group, rows, matches);
      enrichSummary(group);
      enrichInsights(group, matches);
      enrichTable(group);
    } catch (error) {
      console.warn('Assembleias: base real indisponível para enriquecimento', error);
      insertSourcePanel(null, [], []);
    }
  }

  document.addEventListener('DOMContentLoaded', init);
})();
