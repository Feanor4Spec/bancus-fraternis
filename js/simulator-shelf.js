/**
 * Simulator shelf service.
 * Keeps filters, pagination and shelf HTML builders outside the main controller.
 */
(function (global) {
  'use strict';

  const FILTER_IDS = [
    'filtroAdministradora',
    'filtroProduto',
    'filtroPrazoMin',
    'filtroPrazoMax',
    'filtroCartaMin',
    'filtroCartaMax',
    'filtroTaxaMax',
    'filtroClassificacao',
    'filtroSaude',
    'filtroMaturidade',
    'filtroBusca'
  ];

  const CHECKBOX_FILTER_IDS = ['filtroFgts', 'filtroParcelaReduzida'];

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function money(value, helpers = {}) {
    if (helpers.formatMoney) return helpers.formatMoney(value);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function number(value, decimals = 2, helpers = {}) {
    if (helpers.formatNumber) return helpers.formatNumber(value, decimals);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function pageSizeFromSettings(settings, fallback = 50) {
    try {
      const raw = settings && typeof settings.get === 'function' ? Number(settings.get('pageSize')) : fallback;
      return Number.isFinite(raw) && raw > 0 ? Math.min(500, Math.max(10, Math.round(raw))) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizePageSize(value, fallback = 50) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(500, Math.max(10, n)) : fallback;
  }

  function loadHiddenColumns(settings) {
    try {
      const saved = settings && typeof settings.get === 'function' ? settings.get('shelfHiddenColumns') : [];
      return new Set(Array.isArray(saved) ? saved : []);
    } catch (error) {
      return new Set();
    }
  }

  function syncControls(root, hiddenColumns, pageSize) {
    const doc = root || global.document;
    if (!doc) return;
    const pageSizeEl = doc.getElementById('shelfPageSize');
    if (pageSizeEl) pageSizeEl.value = String(pageSize);
    doc.querySelectorAll('.shelf-columns-menu input[type="checkbox"]').forEach((input) => {
      input.checked = !hiddenColumns.has(input.value);
    });
    applyColumnVisibility(doc, hiddenColumns);
  }

  function applyColumnVisibility(root, hiddenColumns) {
    const doc = root || global.document;
    if (!doc) return;
    doc.querySelectorAll('[data-shelf-col]').forEach((el) => {
      const col = el.getAttribute('data-shelf-col');
      el.hidden = hiddenColumns.has(col);
    });
  }

  function updateHiddenColumns(hiddenColumns, colName, checked, options = {}) {
    const next = new Set(hiddenColumns || []);
    if (!colName) return next;
    if (checked) next.delete(colName);
    else next.add(colName);
    const settings = options.settings;
    if (settings && typeof settings.set === 'function') {
      settings.set('shelfHiddenColumns', Array.from(next));
    }
    return next;
  }

  function populateAdminFilter(root, catalog, shelfEngine) {
    const doc = root || global.document;
    const sel = doc && doc.getElementById('filtroAdministradora');
    const list = Array.isArray(catalog) ? catalog : [];
    if (!sel) return { changed: false, count: 0 };
    if (sel.options.length > 1 && sel._catalogSize === list.length) {
      return { changed: false, count: sel.options.length - 1 };
    }

    sel.innerHTML = '<option value="">Todas</option>';
    const admins = shelfEngine && typeof shelfEngine.getUniqueAdmins === 'function'
      ? shelfEngine.getUniqueAdmins(list)
      : [];
    admins.forEach((name) => {
      const opt = doc.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel._catalogSize = list.length;
    return { changed: true, count: admins.length };
  }

  function readFilters(root) {
    const doc = root || global.document;
    return {
      administradora: doc.getElementById('filtroAdministradora')?.value || '',
      segmento: doc.getElementById('filtroProduto')?.value || '',
      prazoMin: doc.getElementById('filtroPrazoMin')?.value || '',
      prazoMax: doc.getElementById('filtroPrazoMax')?.value || '',
      cartaMin: doc.getElementById('filtroCartaMin')?.value || '',
      cartaMax: doc.getElementById('filtroCartaMax')?.value || '',
      taxaMax: doc.getElementById('filtroTaxaMax')?.value || '',
      classificacao: doc.getElementById('filtroClassificacao')?.value || '',
      saude: doc.getElementById('filtroSaude')?.value || '',
      maturidade: doc.getElementById('filtroMaturidade')?.value || '',
      fgts: doc.getElementById('filtroFgts')?.checked || false,
      parcelaReduzida: doc.getElementById('filtroParcelaReduzida')?.checked || false,
      busca: doc.getElementById('filtroBusca')?.value || ''
    };
  }

  function clearFilters(root) {
    const doc = root || global.document;
    FILTER_IDS.forEach((id) => {
      const el = doc.getElementById(id);
      if (el) el.value = '';
    });
    CHECKBOX_FILTER_IDS.forEach((id) => {
      const el = doc.getElementById(id);
      if (el) el.checked = false;
    });
  }

  function filterAndSortGroups(catalog, filters, sortBy, options = {}) {
    const shelfEngine = options.shelfEngine || global.ShelfEngine;
    const list = Array.isArray(catalog) ? catalog : [];
    if (!shelfEngine) return [];
    if (options.autoScore !== false && typeof shelfEngine.computeAllScores === 'function') {
      shelfEngine.computeAllScores(list);
    }
    const filtered = typeof shelfEngine.filterGroups === 'function'
      ? shelfEngine.filterGroups(list, filters || {})
      : [...list];
    const sorted = typeof shelfEngine.sortGroups === 'function'
      ? shelfEngine.sortGroups(filtered, sortBy || 'maior_score')
      : filtered;
    return Array.isArray(sorted) ? sorted : [];
  }

  function paginateGroups(groups, page, pageSize, shelfEngine) {
    const list = Array.isArray(groups) ? groups : [];
    if (shelfEngine && typeof shelfEngine.paginateGroups === 'function') {
      return shelfEngine.paginateGroups(list, page, pageSize);
    }
    const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
    const totalPages = Math.max(1, Math.ceil(list.length / safePageSize));
    const currentPage = Math.max(1, Math.min(parseInt(page, 10) || 1, totalPages));
    const start = (currentPage - 1) * safePageSize;
    const end = Math.min(start + safePageSize, list.length);
    return {
      data: list.slice(start, end),
      totalGroups: list.length,
      totalPages,
      currentPage,
      pageSize: safePageSize,
      startIdx: list.length ? start + 1 : 0,
      endIdx: end
    };
  }

  function paginationState(pag) {
    const safe = pag || { totalGroups: 0, totalPages: 1, currentPage: 1, startIdx: 0, endIdx: 0 };
    const hasPages = safe.totalGroups > 0 && safe.totalPages > 1;
    return {
      display: hasPages ? 'flex' : 'none',
      info: safe.totalGroups === 0
        ? 'Sem paginas'
        : `Pagina ${safe.currentPage || 1} de ${safe.totalPages || 1} (${safe.startIdx || 1}-${safe.endIdx || safe.totalGroups} de ${safe.totalGroups})`,
      prevDisabled: !hasPages || safe.currentPage <= 1,
      nextDisabled: !hasPages || safe.currentPage >= safe.totalPages,
      jumpValue: String(safe.currentPage || 1),
      jumpMax: String(safe.totalPages || 1)
    };
  }

  function applyPaginationControls(root, pag) {
    const doc = root || global.document;
    if (!doc) return;
    const state = paginationState(pag);
    const container = doc.getElementById('shelf-pagination');
    const info = doc.getElementById('shelf-page-info');
    const prevBtn = doc.getElementById('shelf-prev-page');
    const nextBtn = doc.getElementById('shelf-next-page');
    const jumpInput = doc.getElementById('shelf-page-jump');
    if (!container) return;
    container.style.display = state.display;
    if (info) info.textContent = state.info;
    if (prevBtn) prevBtn.disabled = state.prevDisabled;
    if (nextBtn) nextBtn.disabled = state.nextDisabled;
    if (jumpInput) {
      jumpInput.value = state.jumpValue;
      jumpInput.max = state.jumpMax;
    }
  }

  function classBadge(group) {
    const cls = group.classificacaoExecutiva || (group._classificacao ? group._classificacao.classe : '');
    const letter = String(cls || '').charAt(0);
    const colorMap = { A: '#059669', B: '#2563eb', C: '#f59e0b', D: '#dc2626' };
    const color = colorMap[letter] || '#94a3b8';
    return `<span class="heur-badge" style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${escapeText(letter || '?')}</span>`;
  }

  function roleBadge(group) {
    if (group && group._papel) {
      return `<span title="${escapeText(group._papel.justificativa || '')}" style="cursor:help;">${escapeText(group._papel.tag || '')}</span>`;
    }
    return '-';
  }

  function saudeBadge(group) {
    const s = group.saudeCarteira || (group._heuristica ? group._heuristica.classificacoes.saude.classe : '');
    const key = String(s || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
    const iconMap = { baixa: 'OK', controlada: 'AZ', atencao: 'AT', critica: 'CR' };
    return `${iconMap[key] || '--'} ${escapeText(s || '-')}`;
  }

  function renderTable(groups, pag, options = {}) {
    const list = Array.isArray(groups) ? groups : [];
    const total = pag ? pag.totalGroups : list.length;
    const countText = `${Number(total || 0).toLocaleString('pt-BR')} grupo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;

    if (list.length === 0) {
      return {
        countText,
        bodyHtml: '<tr><td colspan="13" class="text-center text-muted" style="padding:40px;">Nenhum grupo encontrado com os filtros selecionados.</td></tr>'
      };
    }

    const addedKeys = new Set((options.projectItems || []).map((item) => item.groupKey));
    const baseIdx = pag ? (pag.currentPage - 1) * pag.pageSize : 0;
    const bodyHtml = list.map((group, i) => {
      const globalIdx = baseIdx + i;
      const score = Number(group.scoreShelf || 0);
      const scoreCls = score >= 70 ? 'shelf-score--high' : (score >= 40 ? 'shelf-score--mid' : 'shelf-score--low');
      const added = addedKeys.has(group.groupKey);
      const letter = (group._classificacao && group._classificacao.letra) || String(group.classificacaoExecutiva || '').charAt(0);
      const rowColorMap = { A: 'rgba(5,150,105,0.04)', D: 'rgba(220,38,38,0.04)', C: 'rgba(245,158,11,0.03)' };
      const rowBg = rowColorMap[letter] || '';
      const rowCls = added ? 'shelf-row shelf-row--added' : 'shelf-row';
      const addBtnHtml = added
        ? `<button class="btn btn--sm btn--success" onclick="App.selecionarGrupo(${globalIdx})" title="Re-adicionar">OK</button>`
        : `<button class="btn btn--sm btn--primary" onclick="App.selecionarGrupo(${globalIdx})" title="Adicionar">+</button>`;
      return `
        <tr class="${rowCls}" data-idx="${globalIdx}" ${rowBg ? `style="background:${rowBg}"` : ''}>
          <td data-shelf-col="score"><span class="shelf-score ${scoreCls}">${score}</span></td>
          <td data-shelf-col="classificacao">${classBadge(group)}</td>
          <td data-shelf-col="papel">${roleBadge(group)}</td>
          <td data-shelf-col="admin" class="shelf-admin-cell">${escapeText(group.nomeAdministradora || '-')}</td>
          <td data-shelf-col="grupo"><strong>${escapeText(group.codigoGrupo)}</strong></td>
          <td data-shelf-col="segmento"><span class="shelf-segment-badge">${escapeText(group.iconSegmento)} ${escapeText(group.nomeSegmento)}</span></td>
          <td data-shelf-col="carta">${money(group.valorCartaRef, options)}</td>
          <td data-shelf-col="prazo">${escapeText(group.prazoMeses)}m</td>
          <td data-shelf-col="taxa">${(Number(group.taxaAdmPct || 0)).toFixed(2)}%</td>
          <td data-shelf-col="indice">${escapeText(group.indiceCorrecaoNome || '-')}</td>
          <td data-shelf-col="ativas">${number(group.qtdAtivasEmDia || 0, 0, options)}</td>
          <td data-shelf-col="saude">${saudeBadge(group)}</td>
          <td data-shelf-col="acoes" class="shelf-actions-cell">
            <button class="btn btn--sm btn--ghost" onclick="App.verDetalheGrupo(${globalIdx})" title="Ver detalhes">Ver</button>
            ${addBtnHtml}
          </td>
        </tr>
      `;
    }).join('');

    return { countText, bodyHtml };
  }

  function detailTitle(group) {
    if (!group) return 'Detalhes do Grupo';
    return `${group.iconSegmento || ''} ${group.nomeAdministradora || 'Admin'} - Grupo ${group.codigoGrupo || ''}`.trim();
  }

  function renderHeuristicDetail(group, options = {}) {
    const heuristicEngine = options.heuristicEngine || global.HeuristicEngine;
    if (!heuristicEngine || !group) return '';
    const analise = group._heuristica || heuristicEngine.analisar(group);
    if (!analise || !analise.classificacoes || !analise.metricas) return '';
    const c = analise.classificacoes;
    const m = analise.metricas;
    const fmt = (value) => `${(Number(value || 0) * 100).toFixed(1)}%`;
    const color = escapeText(c.classificacaoFinal.cor || '#94a3b8');
    const papelColor = escapeText((analise.papel && analise.papel.cor) || '#64748b');
    const sinopse = Array.isArray(analise.sinopse) ? analise.sinopse : [];
    return `
          <div class="shelf-detail-section" style="grid-column:1/-1;border:2px solid ${color};border-radius:12px;padding:20px;background:rgba(0,0,0,0.02);">
            <h4>Analise Heuristica V7</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
              <span class="heur-badge" style="background:${color};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;">${escapeText(c.classificacaoFinal.icon || '')} ${escapeText(c.classificacaoFinal.classe || '')}</span>
              <span class="heur-badge" style="background:${papelColor};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;">${escapeText(analise.papel.tag || '')} ${escapeText(analise.papel.papel || '')}</span>
            </div>
            <table class="detail-mini-table" style="margin-top:12px;">
              <tr><td>${escapeText(c.porte.icon || '')} Porte</td><td><strong>${escapeText(c.porte.classe || '')}</strong></td></tr>
              <tr><td>${escapeText(c.maturidade.icon || '')} Maturidade</td><td><strong>${escapeText(c.maturidade.classe || '')}</strong> (${fmt(m.indiceMaturidade)})</td></tr>
              <tr><td>${escapeText(c.saude.icon || '')} Saude</td><td><strong>${escapeText(c.saude.classe || '')}</strong> (inadimpl. ${fmt(m.taxaInadimplencia)})</td></tr>
              <tr><td>${escapeText(c.ticket.icon || '')} Ticket</td><td><strong>${escapeText(c.ticket.classe || '')}</strong></td></tr>
              <tr><td>${escapeText(c.dinamismo.icon || '')} Dinamismo</td><td><strong>${escapeText(c.dinamismo.classe || '')}</strong> (${fmt(m.taxaContemplacao)}/mes)</td></tr>
              <tr><td>${escapeText(c.ociosidade.icon || '')} Ociosidade</td><td><strong>${escapeText(c.ociosidade.classe || '')}</strong></td></tr>
              <tr><td>${escapeText(c.pressaoExclusao.icon || '')} Pressao Exclusao</td><td><strong>${escapeText(c.pressaoExclusao.classe || '')}</strong> (${fmt(m.intensidadeExclusao)})</td></tr>
            </table>
            <div style="margin-top:14px;padding:12px;background:rgba(0,0,0,0.03);border-radius:8px;font-size:13px;line-height:1.7;">
              <strong>Sinopse:</strong><br>
              ${sinopse.map((line) => `- ${escapeText(line)}`).join('<br>')}
            </div>
          </div>`;
  }

  function renderDetail(group, options = {}) {
    if (!group) return '';
    const getLimit = options.getEffectiveLanceEmbutidoMax || (() => 0);
    return `
        <div class="shelf-detail-grid">
          <div class="shelf-detail-section">
            <h4>Administradora</h4>
            <p><strong>${escapeText(group.nomeAdministradora || '-')}</strong></p>
            <p class="text-muted">CNPJ Raiz: ${escapeText(group.cnpjRaiz)}</p>
          </div>
          <div class="shelf-detail-section">
            <h4>Dados do Grupo</h4>
            <table class="detail-mini-table">
              <tr><td>Codigo do Grupo</td><td><strong>${escapeText(group.codigoGrupo)}</strong></td></tr>
              <tr><td>Segmento</td><td>${escapeText(group.iconSegmento)} ${escapeText(group.nomeSegmento)}</td></tr>
              <tr><td>Origem</td><td>${group.origem === 'imoveis' ? 'Imoveis' : 'Moveis'}</td></tr>
              <tr><td>Data Base</td><td>${escapeText(group.dataBase)}</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Valores e Taxas</h4>
            <table class="detail-mini-table">
              <tr><td>Carta de Referencia</td><td><strong>${money(group.valorCartaRef, options)}</strong></td></tr>
              <tr><td>Prazo</td><td><strong>${escapeText(group.prazoMeses)} meses</strong></td></tr>
              <tr><td>Taxa de Administracao</td><td>${(Number(group.taxaAdmPct || 0)).toFixed(2)}%</td></tr>
              <tr><td>Fundo de Reserva</td><td>${escapeText(group.fundoReservaPct)}%</td></tr>
              <tr><td>Indice de Correcao</td><td>${escapeText(group.indiceCorrecaoNome || 'N/A')}</td></tr>
              <tr><td>Seguro Comercial</td><td>${escapeText(group.seguroPctComercial || 0)}%</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Cotas e Saude do Grupo</h4>
            <table class="detail-mini-table">
              <tr><td>Cotas Ativas em Dia</td><td><strong>${number(group.qtdAtivasEmDia || 0, 0, options)}</strong></td></tr>
              <tr><td>Contempladas no Mes</td><td>${escapeText(group.qtdContempladasNoMes)}</td></tr>
              <tr><td>Cotas Excluidas</td><td>${escapeText(group.qtdExcluidas)}</td></tr>
              <tr><td>Cotas Quitadas</td><td>${escapeText(group.qtdQuitadas)}</td></tr>
              <tr><td>Credito Pendente</td><td>${escapeText(group.qtdCreditoPendente)}</td></tr>
              <tr><td>Score Prateleira</td><td><strong>${escapeText(group.scoreShelf)}</strong>/100</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Regras Comerciais</h4>
            <table class="detail-mini-table">
              <tr><td>Lance Embutido Max.</td><td>${escapeText(getLimit(group))}%</td></tr>
              <tr><td>Lance Fixo</td><td>${escapeText(group.lanceFixoPct || 0)}%</td></tr>
              <tr><td>Parcela Reduzida</td><td>${group.parcelaReduzidaDisponivel ? 'Sim' : 'Nao'}</td></tr>
              <tr><td>Reducao Max. Parcela</td><td>${escapeText(group.reducaoMaxParcelaPct || 0)}%</td></tr>
              <tr><td>FGTS Permitido</td><td>${group.fgtsPermitido ? 'Sim' : 'Nao'}</td></tr>
              <tr><td>Status Comercial</td><td>${escapeText(group.statusComercial)}</td></tr>
            </table>
          </div>
          ${renderHeuristicDetail(group, options)}
        </div>
      `;
  }

  function setDetailAddVisible(root, visible) {
    const doc = root || global.document;
    const modal = doc && doc.getElementById('shelf-detail-modal');
    const addBtn = modal?.querySelector('.shelf-detail-card > div:last-child button');
    if (addBtn) addBtn.style.display = visible ? '' : 'none';
  }

  global.BFSimulatorShelf = {
    FILTER_IDS,
    CHECKBOX_FILTER_IDS,
    pageSizeFromSettings,
    normalizePageSize,
    loadHiddenColumns,
    syncControls,
    applyColumnVisibility,
    updateHiddenColumns,
    populateAdminFilter,
    readFilters,
    clearFilters,
    filterAndSortGroups,
    paginateGroups,
    paginationState,
    applyPaginationControls,
    renderTable,
    detailTitle,
    renderDetail,
    setDetailAddVisible
  };
})(typeof window !== 'undefined' ? window : globalThis);
