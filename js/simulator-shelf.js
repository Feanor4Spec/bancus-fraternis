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

  function pageSizeFromSettings(settings, fallback = 20) {
    try {
      const raw = settings && typeof settings.get === 'function' ? Number(settings.get('pageSize')) : fallback;
      return Number.isFinite(raw) && raw > 0 ? Math.min(50, Math.max(20, Math.round(raw))) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function normalizePageSize(value, fallback = 20) {
    const n = parseInt(value, 10);
    return Number.isFinite(n) && n > 0 ? Math.min(50, Math.max(20, n)) : fallback;
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
    const safePageSize = Math.max(1, parseInt(pageSize, 10) || 20);
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
        ? 'Sem páginas'
        : `Página ${safe.currentPage || 1} de ${safe.totalPages || 1} (${safe.startIdx || 1}-${safe.endIdx || safe.totalGroups} de ${safe.totalGroups})`,
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

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase();
  }

  function addUnique(list, value) {
    if (!value || list.includes(value)) return;
    list.push(value);
  }

  function explainGroupRecommendation(group, options = {}) {
    const filters = options.filters || {};
    const profile = options.profile || {};
    const score = Number(group && group.scoreShelf || 0);
    const letter = String((group && ((group._classificacao && group._classificacao.letra) || group.classificacaoExecutiva)) || '').charAt(0);
    const taxa = Number(group && group.taxaAdmPct || 0);
    const prazo = Number(group && group.prazoMeses || 0);
    const carta = Number(group && group.valorCartaRef || 0);
    const reasons = [];
    const risks = [];
    let profileSignals = 0;
    let profileChecks = 0;

    if (filters.taxaMax && taxa <= Number(filters.taxaMax)) addUnique(reasons, `Taxa dentro do teto de ${filters.taxaMax}%.`);
    else if (taxa > 22) addUnique(risks, `Taxa de ${taxa.toFixed(2)}% merece comparacao de custo.`);

    if (filters.prazoMax && prazo <= Number(filters.prazoMax)) addUnique(reasons, `Prazo dentro do limite de ${filters.prazoMax} meses.`);
    if (filters.cartaMin && carta >= Number(filters.cartaMin)) addUnique(reasons, 'Carta acima do minimo definido.');
    if (filters.cartaMax && carta <= Number(filters.cartaMax)) addUnique(reasons, 'Carta dentro do teto definido.');

    if (filters.fgts && group && group.fgtsPermitido) addUnique(reasons, 'Permite uso de FGTS, sujeito às regras vigentes.');
    if (filters.fgts && group && !group.fgtsPermitido) addUnique(risks, 'Filtro pede FGTS, mas o grupo nao sinaliza permissao.');
    if (group && group.parcelaReduzidaDisponivel) addUnique(reasons, 'Parcela reduzida disponível no início do plano.');

    const valorObjetivo = Number(profile.valorObjetivo || 0);
    if (valorObjetivo > 0) {
      profileChecks += 1;
      const deviation = Math.abs(carta - valorObjetivo) / valorObjetivo;
      if (deviation <= 0.2) {
        profileSignals += 1;
        addUnique(reasons, 'Carta de referencia dentro de 20% do valor objetivo informado.');
      } else {
        addUnique(risks, 'Carta de referencia se distancia do valor objetivo informado.');
      }
    }

    const prazoDesejado = Number(profile.prazoDesejado || 0);
    if (prazoDesejado > 0) {
      profileChecks += 1;
      if (prazo <= prazoDesejado) {
        profileSignals += 1;
        addUnique(reasons, 'Prazo dentro do horizonte informado pelo cliente.');
      } else {
        addUnique(risks, 'Prazo excede o horizonte informado pelo cliente.');
      }
    }

    const parcelaConfortavel = Number(profile.parcelaConfortavel || 0);
    if (parcelaConfortavel > 0 && prazo > 0) {
      profileChecks += 1;
      const parcelaIndicativa = (carta * (1 + ((taxa + Number(group && group.fundoReservaPct || 0)) / 100))) / prazo;
      if (parcelaIndicativa <= parcelaConfortavel * 1.1) {
        profileSignals += 1;
        addUnique(reasons, 'Parcela indicativa cabe na faixa mensal informada, antes dos demais eventos.');
      } else {
        addUnique(risks, 'Parcela indicativa supera a faixa mensal informada.');
      }
    }

    if (group && group._commercialVerification !== 'verified') {
      addUnique(risks, 'Confirme no contrato os limites de lance, fundo, seguro e redução de parcela.');
    }

    const profileRatio = profileChecks > 0 ? profileSignals / profileChecks : null;
    const label = profileRatio == null
      ? 'Confira carta, prazo e taxa'
      : profileRatio >= 0.75
        ? 'Dentro dos valores informados'
        : profileRatio >= 0.4
          ? 'Atende parte dos filtros'
          : 'Fora de alguns limites';
    const tone = profileRatio != null && profileRatio >= 0.75 && risks.length <= 1
      ? 'stable'
      : risks.length ? 'warning' : 'info';
    return {
      tone,
      label,
      reasons: reasons.slice(0, 6),
      risks: risks.slice(0, 4),
      profileSignals,
      profileChecks,
      mainAdvantage: reasons[0] || 'Compare carta, taxa e prazo antes de adicionar.',
      mainRisk: risks[0] || 'Nenhum ponto de atenção adicional com os dados disponíveis.',
      needsConfirmation: group && group._commercialVerification !== 'verified'
        ? 'Condicoes comerciais e contratuais do grupo.'
        : 'Nenhuma pendência comercial sinalizada.',
      sourceDate: group && group.dataBase ? String(group.dataBase) : 'Data-base nao informada'
    };
  }

  function renderRecommendation(group, options = {}) {
    const insight = explainGroupRecommendation(group, options);
    const primary = insight.mainAdvantage || insight.reasons[0] || insight.risks[0] || 'Compare premissas antes da proposta.';
    return `
      <small class="shelf-recommendation shelf-recommendation--${escapeText(insight.tone)}" data-shelf-recommendation="${escapeText(insight.label)}">
        <strong>${escapeText(insight.label)}</strong>
        <span data-shelf-recommendation-reason>${escapeText(primary)}</span>
      </small>
    `;
  }

  function renderRecommendationDetail(group, options = {}) {
    const insight = explainGroupRecommendation(group, options);
    const reasons = insight.reasons.length
      ? insight.reasons.map((item) => `<li data-shelf-recommendation-reason>${escapeText(item)}</li>`).join('')
      : '<li data-shelf-recommendation-reason>Compare a composicao do grupo com outros cenarios.</li>';
    const risks = insight.risks.length
      ? `<ul>${insight.risks.map((item) => `<li data-shelf-risk-note>${escapeText(item)}</li>`).join('')}</ul>`
      : '<p>Nenhum alerta forte identificado pelos filtros atuais.</p>';
    return `
      <div class="shelf-detail-section shelf-detail-section--recommendation" data-shelf-recommendation="${escapeText(insight.label)}">
        <h4>Por que este grupo apareceu</h4>
        <ul>${reasons}</ul>
        <dl class="shelf-explanation-facts">
          <div><dt>Principal vantagem</dt><dd>${escapeText(insight.mainAdvantage)}</dd></div>
          <div><dt>Principal risco</dt><dd>${escapeText(insight.mainRisk)}</dd></div>
          <div><dt>Confirmar</dt><dd>${escapeText(insight.needsConfirmation)}</dd></div>
          <div><dt>Data-base</dt><dd>${escapeText(insight.sourceDate)}</dd></div>
        </dl>
        <strong>Pontos de atencao</strong>
        ${risks}
      </div>
    `;
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
          <td data-shelf-col="grupo"><strong>${escapeText(group.codigoGrupo)}</strong>${renderRecommendation(group, options)}</td>
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
    return '';
  }

  function renderDetail(group, options = {}) {
    if (!group) return '';
    const getLimit = options.getEffectiveLanceEmbutidoMax || (() => 0);
    return `
        <div class="shelf-detail-grid">
          ${renderRecommendationDetail(group, options)}
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
              <tr><td>Taxa de administração</td><td>${(Number(group.taxaAdmPct || 0)).toFixed(2)}%</td></tr>
              <tr><td>Fundo de Reserva</td><td>${escapeText(group.fundoReservaPct)}%</td></tr>
              <tr><td>Índice de correção</td><td>${escapeText(group.indiceCorrecaoNome || 'N/A')}</td></tr>
              <tr><td>Seguro Comercial</td><td>${escapeText(group.seguroPctComercial || 0)}%</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Cotas e Saude do Grupo</h4>
            <table class="detail-mini-table">
              <tr><td>Cotas Ativas em Dia</td><td><strong>${number(group.qtdAtivasEmDia || 0, 0, options)}</strong></td></tr>
              <tr><td>Contempladas no mês</td><td>${escapeText(group.qtdContempladasNoMes)}</td></tr>
              <tr><td>Cotas Excluidas</td><td>${escapeText(group.qtdExcluidas)}</td></tr>
              <tr><td>Cotas Quitadas</td><td>${escapeText(group.qtdQuitadas)}</td></tr>
              <tr><td>Crédito pendente</td><td>${escapeText(group.qtdCreditoPendente)}</td></tr>
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
    explainGroupRecommendation,
    detailTitle,
    renderDetail,
    setDetailAddVisible
  };
})(typeof window !== 'undefined' ? window : globalThis);
