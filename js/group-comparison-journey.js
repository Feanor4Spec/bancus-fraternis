(function (global) {
  'use strict';

  const INTENT_KEY = 'bf_group_compare_intent_v1';
  const INTENT_TTL_MS = 30 * 60 * 1000;
  let quickEntryActive = false;
  let compareReturnPending = false;
  let lastAnnouncement = '';

  function normalizeGroups(groups) {
    return Array.isArray(groups)
      ? groups.filter(Boolean).map((group) => ({
          code: String(group.code || '').trim(),
          admin: String(group.admin || '').trim()
        }))
      : [];
  }

  function deriveState(groups) {
    const selected = normalizeGroups(groups);
    const count = selected.length;
    if (count === 0) {
      return {
        phase: 'empty',
        title: 'Compare antes de decidir',
        copy: 'Adicione dois grupos para comparar crédito, parcela, taxa, prazo e custo.',
        progress: '0 de 2 grupos',
        primary: 'Escolher primeiro grupo',
        canCompare: false,
        canAddMore: false
      };
    }
    if (count === 1) {
      const label = selected[0].code ? `Grupo ${selected[0].code}` : 'O primeiro grupo';
      return {
        phase: 'selecting',
        title: `${label} adicionado`,
        copy: 'Você já pode simular este grupo. Para comparar, adicione mais uma opção.',
        progress: '1 de 2 grupos',
        primary: 'Adicionar para comparar',
        canCompare: false,
        canAddMore: false
      };
    }
    return {
      phase: 'ready',
      title: count === 2 ? '2 grupos prontos para comparar' : `${count} grupos no projeto`,
      copy: count === 2
        ? 'Veja as diferenças usando as mesmas condições.'
        : 'Escolha dois por vez para comparar. Os demais continuam no projeto.',
      progress: count === 2 ? '2 de 2 grupos' : `${count} grupos no projeto`,
        primary: count === 2 ? 'Comparar agora' : 'Escolher dois grupos',
      canCompare: true,
      canAddMore: true
    };
  }

  function selectedGroups(root = global.document) {
    if (!root?.querySelectorAll) return [];
    return Array.from(root.querySelectorAll('#selected-groups-panel .selected-group-row')).map((row) => ({
      code: row.querySelector('.sg-grupo-cod strong')?.textContent || '',
      admin: row.querySelector('.sg-admin-nome')?.textContent || ''
    }));
  }

  function writeIntent(active, targetGroupKey = '') {
    try {
      if (!active) global.sessionStorage?.removeItem(INTENT_KEY);
      else global.sessionStorage?.setItem(INTENT_KEY, JSON.stringify({
        createdAt: new Date().toISOString(),
        targetGroupKey: String(targetGroupKey || '').trim()
      }));
    } catch (error) { /* disponibilidade de sessão é opcional */ }
  }

  function readIntent() {
    try {
      const parsed = JSON.parse(global.sessionStorage?.getItem(INTENT_KEY) || 'null');
      const createdAt = Date.parse(parsed?.createdAt || '');
      if (!Number.isFinite(createdAt) || Date.now() - createdAt > INTENT_TTL_MS || createdAt - Date.now() > 60000) {
        writeIntent(false);
        return null;
      }
      return {
        createdAt: new Date(createdAt).toISOString(),
        targetGroupKey: String(parsed?.targetGroupKey || '').trim()
      };
    } catch (error) {
      return null;
    }
  }

  function consumeUrlIntent() {
    try {
      const url = new URL(global.location.href);
      if (url.searchParams.get('compareGroup') !== '1') return false;
      writeIntent(true, url.searchParams.get('compareGroupKey') || '');
      url.searchParams.delete('compareGroup');
      url.searchParams.delete('compareGroupKey');
      global.history?.replaceState?.(global.history.state, '', `${url.pathname}${url.search}${url.hash}`);
      return true;
    } catch (error) {
      return false;
    }
  }

  function renderChips(container, groups) {
    if (!container) return;
    container.replaceChildren();
    normalizeGroups(groups).slice(0, 3).forEach((group) => {
      const chip = global.document.createElement('span');
      chip.className = 'group-comparison-guide__chip';
      chip.textContent = group.code ? `Grupo ${group.code}` : group.admin || 'Grupo selecionado';
      container.appendChild(chip);
    });
  }

  function sync(options = {}) {
    const guide = global.document?.querySelector?.('[data-group-comparison-guide]');
    if (!guide) return null;
    const groups = selectedGroups();
    const state = deriveState(groups);
    const intentActive = Boolean(readIntent());
    guide.dataset.state = state.phase;
    if (intentActive) guide.dataset.intent = 'compare';
    else delete guide.dataset.intent;
    const title = guide.querySelector('[data-comparison-title]');
    const copy = guide.querySelector('[data-comparison-copy]');
    const progress = guide.querySelector('[data-comparison-progress]');
    const primary = guide.querySelector('[data-comparison-primary]');
    const addMore = guide.querySelector('[data-comparison-add-more]');
    if (title) title.textContent = state.title;
    if (copy) copy.textContent = state.copy;
    if (progress) progress.textContent = state.progress;
    if (primary) primary.textContent = state.primary;
    if (addMore) addMore.hidden = !state.canAddMore;
    renderChips(guide.querySelector('[data-comparison-selected]'), groups);
    const announcement = `${state.title}. ${state.progress}.`;
    const live = guide.querySelector('[data-comparison-live]');
    if (live && options.announce && announcement !== lastAnnouncement) live.textContent = announcement;
    lastAnnouncement = announcement;
    return state;
  }

  function focusShelf() {
    const shelf = global.document?.getElementById?.('shelf-table');
    shelf?.scrollIntoView?.({ behavior: 'smooth', block: 'start' });
    global.setTimeout?.(() => {
      const available = Array.from(global.document?.querySelectorAll?.('#shelf-table-body .shelf-row:not(.shelf-row--added) button[aria-label^="Adicionar grupo"]') || []);
      (available[0] || global.document?.getElementById?.('shelf-table'))?.focus?.({ preventScroll: true });
    }, 260);
  }

  function applyQuickEntry(active) {
    quickEntryActive = active === true;
    if (global.document?.body) {
      if (quickEntryActive) global.document.body.dataset.comparisonMode = 'preview';
      else delete global.document.body.dataset.comparisonMode;
    }
    const note = global.document?.querySelector?.('[data-comparison-quick-note]');
    const back = global.document?.querySelector?.('[data-comparison-back]');
    const nextLabel = global.document?.querySelector?.('[data-comparison-next-label]');
    const eyebrow = global.document?.querySelector?.('#step-9 .section-header__eyebrow');
    const railStep = global.document?.querySelector?.('[data-evolution-current-step]');
    const railLabel = global.document?.querySelector?.('[data-evolution-current-label]');
    if (note) note.hidden = !quickEntryActive;
    if (back) back.textContent = quickEntryActive ? '← Voltar aos grupos' : '← Voltar';
    if (nextLabel) nextLabel.textContent = quickEntryActive ? 'Continuar a simulação →' : 'Revisar proposta final →';
    if (eyebrow) eyebrow.textContent = quickEntryActive ? 'Prévia de comparação' : 'Etapa 9 de 10';
    if (quickEntryActive && railStep) railStep.textContent = 'Prévia de comparação';
    if (quickEntryActive && railLabel) railLabel.textContent = 'Comparar grupos';
  }

  function selectComparisonPair(targetGroupKey = '') {
    const selectA = global.document?.getElementById?.('compGrupoA');
    const selectB = global.document?.getElementById?.('compGrupoB');
    if (!selectA || !selectB || selectA.disabled || selectB.disabled) return false;
    const choices = Array.from(selectA.options || []).filter((option) => option.value !== '');
    if (choices.length < 2) return false;
    const target = choices.find((option) => option.dataset.groupKey === targetGroupKey) || choices[0];
    const partner = choices.find((option) => option.value !== target.value);
    if (!partner) return false;
    selectA.value = target.value;
    selectB.value = partner.value;
    return true;
  }

  function applyQuickScenario() {
    const ownBid = global.document?.getElementById?.('compLanceProprio');
    const embeddedBid = global.document?.getElementById?.('compLanceEmbutido');
    const reducedPayment = global.document?.getElementById?.('compParcelaReduzida');
    if (ownBid) ownBid.value = '0';
    if (embeddedBid) embeddedBid.value = '0';
    if (reducedPayment) reducedPayment.checked = false;
    global.App?.onCompGrupoChange?.();
  }

  function comparisonStatus(message, options = {}) {
    const status = global.document?.querySelector?.('[data-comparison-status]');
    if (status) status.textContent = String(message || '');
    if (!options.focusResult) return;
    const summary = global.document?.getElementById?.('comp-winners-container');
    if (summary && !summary.hidden && summary.style.display !== 'none') summary.focus?.({ preventScroll: true });
  }

  function normalizeCommercialSurface() {
    const bestMatch = global.document?.querySelector?.('#shelfSort option[value="maior_score"]');
    const scoreHeader = global.document?.querySelector?.('#shelf-table th[data-shelf-col="score"]');
    if (bestMatch) bestMatch.textContent = 'Mais adequados';
    if (scoreHeader) scoreHeader.textContent = 'Compatibilidade';
  }

  function openComparison() {
    const state = sync();
    if (!state?.canCompare || !global.App?.goToStep) {
      focusShelf();
      return false;
    }
    compareReturnPending = false;
    const intent = readIntent();
    writeIntent(false);
    global.App.goToStep(9, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
    applyQuickEntry(true);
    global.requestAnimationFrame?.(() => {
      selectComparisonPair(intent?.targetGroupKey || '');
      applyQuickScenario();
      global.App?.executarComparacao?.();
      comparisonStatus('Comparação atualizada.', { focusResult: true });
    });
    return true;
  }

  function backFromComparison() {
    if (!quickEntryActive) return false;
    applyQuickEntry(false);
    global.App?.goToStep?.(4, { skipValidation: true, skipAutoSearch: true });
    global.requestAnimationFrame?.(() => global.document?.querySelector?.('[data-group-comparison-guide]')?.focus?.());
    return true;
  }

  function continueFromComparison() {
    if (!quickEntryActive) return false;
    applyQuickEntry(false);
    global.App?.goToStep?.(1, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true, skipFocus: true });
    global.App?.goToStep?.(5);
    return true;
  }

  function init() {
    const guide = global.document?.querySelector?.('[data-group-comparison-guide]');
    if (!guide) return;
    normalizeCommercialSurface();
    const returnIntent = consumeUrlIntent() || Boolean(readIntent());
    compareReturnPending = returnIntent;
    guide.querySelector('[data-comparison-primary]')?.addEventListener('click', () => {
      const state = sync();
      if (state?.canCompare) openComparison();
      else focusShelf();
    });
    guide.querySelector('[data-comparison-add-more]')?.addEventListener('click', focusShelf);
    global.document.getElementById('btn-comparar')?.addEventListener('click', () => {
      global.setTimeout?.(() => comparisonStatus('Comparação atualizada.', { focusResult: true }), 0);
    });
    ['compGrupoA', 'compGrupoB', 'compPoliticaSaldo', 'compIndiceReajuste', 'compMesContemplacao',
      'compLanceProprio', 'compLanceEmbutido', 'compParcelaReduzida'].forEach((id) => {
      global.document.getElementById(id)?.addEventListener('change', () => {
        comparisonStatus('Condições alteradas. Atualize a comparação.');
      });
    });
    const selectedPanel = global.document.getElementById('selected-groups-panel');
    if (selectedPanel && 'MutationObserver' in global) {
      new global.MutationObserver(() => {
        const state = sync({ announce: true });
        if (compareReturnPending && state?.canCompare) openComparison();
      }).observe(selectedPanel, { childList: true, subtree: true });
    }
    sync();
    if (returnIntent) {
      global.setTimeout?.(() => {
        const state = sync({ announce: true });
        if (compareReturnPending && state?.canCompare) {
          openComparison();
          return;
        }
        guide.scrollIntoView?.({ behavior: 'smooth', block: 'center' });
        guide.querySelector('[data-comparison-primary]')?.focus?.({ preventScroll: true });
      }, 950);
    }
  }

  global.BFGroupComparisonJourney = Object.freeze({
    deriveState,
    selectedGroups,
    sync,
    openComparison,
    backFromComparison,
    continueFromComparison
  });

  if (global.document?.readyState === 'loading') global.document.addEventListener('DOMContentLoaded', init, { once: true });
  else init();
})(typeof window !== 'undefined' ? window : globalThis);
