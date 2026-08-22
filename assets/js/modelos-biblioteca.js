(function () {
  'use strict';

  let standards = [];
  let lastClonedId = '';

  const productLabels = {
    financiamento: 'Financiamento',
    consorcio: 'Consorcio',
    cdc: 'CDC',
    garantia: 'Credito com garantia',
    consignado: 'Consignado',
    consumo: 'Consumo parcelado',
    veiculos: 'Veiculos'
  };

  const presetLabels = {
    comprar_bem: 'Comprar bem',
    obter_liquidez: 'Obter liquidez',
    trocar_veiculo: 'Trocar veiculo',
    consumo_pontual: 'Consumo pontual',
    manual: 'Manual'
  };

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

  function formatDate(value) {
    if (!value) return 'Sem data';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function currentModels() {
    return window.BFComparatorModels && window.BFComparatorModels.list
      ? window.BFComparatorModels.list()
      : [];
  }

  function readFinancialProfile() {
    try {
      return JSON.parse(localStorage.getItem('bf_financial_profile_v1') || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function recommendationProfile() {
    const params = new URLSearchParams(location.search || '');
    return {
      ...readFinancialProfile(),
      presetObjetivo: params.get('preset') || params.get('objetivo') || '',
      urgencia: params.get('urgencia') || readFinancialProfile().urgencia || 'media',
      prioridade: params.get('prioridade') || readFinancialProfile().prioridade || 'menor_custo',
      valorBem: params.get('valorBem') || readFinancialProfile().valorBem || 0,
      valorCredito: params.get('valorCredito') || readFinancialProfile().valorCredito || 0
    };
  }

  function urlRecommendedId() {
    try {
      return new URLSearchParams(location.search || '').get('recomendado') || '';
    } catch (error) {
      return '';
    }
  }

  function rankedStandards(list) {
    if (!window.BFModelosRecomendacaoService) return list || [];
    const rank = window.BFModelosRecomendacaoService.rank(standards, recommendationProfile());
    const order = new Map(rank.map((item, index) => [item.id, index]));
    const forced = urlRecommendedId();
    return (list || []).slice().sort((a, b) => {
      if (forced && a.id === forced) return -1;
      if (forced && b.id === forced) return 1;
      return (order.get(a.id) ?? 99) - (order.get(b.id) ?? 99);
    });
  }

  function recommendedStandard() {
    const forced = standards.find((item) => item.id === urlRecommendedId());
    if (forced && window.BFModelosRecomendacaoService) {
      return window.BFModelosRecomendacaoService.score(forced, recommendationProfile());
    }
    return window.BFModelosRecomendacaoService
      ? window.BFModelosRecomendacaoService.best(standards, recommendationProfile())
      : null;
  }

  function clonedFrom(template) {
    return currentModels().filter((model) => model.standardId === template.id || model.source === `standard:${template.id}`);
  }

  function filteredStandards() {
    const searchField = qs('[data-standard-model-search]');
    const journeyField = qs('[data-standard-model-journey]');
    const presetField = qs('[data-standard-model-preset]');
    const search = String(searchField ? searchField.value : '').trim().toLowerCase();
    const journey = journeyField ? journeyField.value : '';
    const preset = presetField ? presetField.value : '';

    const list = standards.filter((item) => {
      const text = [
        item.name,
        item.journey,
        item.audience,
        item.description,
        item.recommendedUse,
        (item.riskNotes || []).join(' ')
      ].join(' ').toLowerCase();
      return (!search || text.includes(search))
        && (!journey || item.journey === journey)
        && (!preset || item.preset === preset);
    });
    return rankedStandards(list);
  }

  function populateJourneyFilter() {
    const target = qs('[data-standard-model-journey]');
    if (!target) return;
    const current = target.value;
    const journeys = Array.from(new Set(standards.map((item) => item.journey).filter(Boolean))).sort();
    target.innerHTML = '<option value="">Todas</option>' + journeys.map((journey) => (
      `<option value="${escapeHtml(journey)}">${escapeHtml(journey)}</option>`
    )).join('');
    target.value = journeys.includes(current) ? current : '';
  }

  function renderSummary() {
    const target = qs('[data-standard-models-summary]');
    if (!target || !window.BFCards) return;
    const clones = currentModels().filter((model) => String(model.source || '').startsWith('standard:'));
    const published = standards.filter((item) => item.governanceStatus === 'published').length;
    const journeys = new Set(standards.map((item) => item.journey).filter(Boolean)).size;
    const lastClone = lastClonedId ? currentModels().find((model) => model.id === lastClonedId) : null;
    const recommended = recommendedStandard();
    const recommendationText = recommended
      ? `Modelo recomendado: ${recommended.name} (${recommended.recommendationScore}/100).`
      : 'Modelos padrao publicados ajudam a iniciar comparacoes com governanca, riscos e produtos ja selecionados.';

    target.innerHTML = `
      <div class="bf-standard-summary">
        <div>
          <span class="bf-badge bf-badge--ok">${recommended ? 'Recomendacao automatica' : 'Pronto para uso'}</span>
          <h2>${lastClone ? `Modelo clonado: ${escapeHtml(lastClone.name)}` : (recommended ? escapeHtml(recommended.name) : 'Biblioteca operacional')}</h2>
          <p>${lastClone ? 'O modelo foi salvo para este usuario e pode ser aberto no comparador com as premissas publicadas.' : escapeHtml(recommendationText)}</p>
          ${recommended && !lastClone ? `<ul class="bf-standard-model-risks">${(recommended.recommendationReasons || []).slice(0, 3).map((reason) => `<li>${escapeHtml(reason)}</li>`).join('')}</ul>` : ''}
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="${lastClone ? window.BFComparatorModels.route(lastClone.id) : 'comparador.html'}">${lastClone ? 'Abrir modelo clonado' : 'Abrir comparador'}</a>
            ${recommended && !lastClone ? `<button class="btn btn--ghost btn--sm" type="button" data-standard-clone="${escapeHtml(recommended.id)}">Clonar recomendado</button>` : ''}
            <a class="btn btn--ghost btn--sm" href="modelos-governanca.html">Governanca</a>
          </div>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Modelos', standards.length, 'is-strong')}
          ${window.BFCards.metric('Publicados', published)}
          ${window.BFCards.metric('Jornadas', journeys)}
          ${window.BFCards.metric('Meus clones', clones.length)}
        </div>
      </div>
    `;
  }

  function renderStandardCard(item) {
    const scored = window.BFModelosRecomendacaoService
      ? window.BFModelosRecomendacaoService.score(item, recommendationProfile())
      : item;
    const best = recommendedStandard();
    const isRecommended = best && best.id === item.id;
    const clones = clonedFrom(item);
    const latestClone = clones[0];
    const chips = (item.productIds || []).map((id) => `<span>${escapeHtml(productLabels[id] || id)}</span>`).join('');
    const riskNotes = (item.riskNotes || []).slice(0, 3).map((note) => `<li>${escapeHtml(note)}</li>`).join('');
    const statusLabel = item.governanceStatus === 'published' ? 'Publicado' : 'Em revisao';

    return `
      <article class="bf-platform-card bf-standard-model-card ${isRecommended ? 'is-recommended' : ''}" data-standard-model="${escapeHtml(item.id)}">
        <div class="bf-standard-model-card__top">
          <span class="bf-badge ${isRecommended ? 'bf-badge--gold' : (item.governanceStatus === 'published' ? 'bf-badge--ok' : 'bf-badge--navy')}">${escapeHtml(isRecommended ? 'Recomendado' : statusLabel)}</span>
          <small>${escapeHtml(presetLabels[item.preset] || item.preset || 'Manual')}</small>
        </div>
        <h3>${escapeHtml(item.name)}</h3>
        <p>${escapeHtml(item.description)}</p>
        <div class="bf-standard-model-meta">
          <strong>${escapeHtml(item.journey)}</strong>
          <small>${escapeHtml(item.audience)}</small>
        </div>
        <div class="bf-standard-model-chips">${chips || '<span>Produtos manuais</span>'}</div>
        <div class="bf-standard-model-use">
          <strong>Quando usar</strong>
          <p>${escapeHtml(item.recommendedUse)}</p>
        </div>
        <ul class="bf-standard-model-risks">${riskNotes}</ul>
        <div class="bf-standard-model-actions">
          <button class="btn btn--primary btn--sm" type="button" data-standard-clone="${escapeHtml(item.id)}">Clonar modelo</button>
          ${latestClone ? `<a class="btn btn--ghost btn--sm" href="${window.BFComparatorModels.route(latestClone.id)}">Abrir clone</a>` : ''}
        </div>
        <small class="bf-standard-model-status">${clones.length ? `${clones.length} clone(s) neste usuario` : 'Ainda nao clonado'} - aderencia ${scored.recommendationScore || 0}/100</small>
      </article>
    `;
  }

  function renderGrid() {
    const target = qs('[data-standard-models-grid]');
    if (!target) return;
    const list = filteredStandards();
    target.innerHTML = list.length
      ? list.map(renderStandardCard).join('')
      : '<div class="bf-empty-state">Nenhum modelo padrao encontrado para os filtros atuais.</div>';
  }

  function renderClones() {
    const target = qs('[data-standard-model-clones]');
    if (!target) return;
    const clones = currentModels()
      .filter((model) => String(model.source || '').startsWith('standard:'))
      .slice(0, 8);

    if (clones.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum modelo padrao foi clonado ainda. Escolha uma jornada acima para criar o primeiro atalho.</div>';
      return;
    }

    target.innerHTML = clones.map((model) => `
      <article class="bf-history-item" data-standard-clone-item="${escapeHtml(model.id)}">
        <span>${escapeHtml(presetLabels[model.preset] || model.preset || 'Modelo')}</span>
        <strong>${escapeHtml(model.name)}</strong>
        <small>${escapeHtml((model.productIds || []).map((id) => productLabels[id] || id).join(', ') || 'Produtos manuais')} - ${escapeHtml(formatDate(model.updatedAt))}</small>
        <a href="${window.BFComparatorModels.route(model.id)}">Abrir no comparador</a>
      </article>
    `).join('');
  }

  function renderAll() {
    renderSummary();
    renderGrid();
    renderClones();
  }

  function bindFilters() {
    ['[data-standard-model-search]', '[data-standard-model-journey]', '[data-standard-model-preset]'].forEach((selector) => {
      const field = qs(selector);
      if (!field) return;
      field.addEventListener('input', renderGrid);
      field.addEventListener('change', renderGrid);
    });
  }

  function bindCloneActions() {
    if (document.body.dataset.standardCloneBound === 'true') return;
    document.body.dataset.standardCloneBound = 'true';
    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-standard-clone]');
      if (!button) return;
      const template = standards.find((item) => item.id === button.dataset.standardClone);
      if (!template || !window.BFComparatorModels || !window.BFComparatorModels.cloneStandard) return;

      try {
        const model = window.BFComparatorModels.cloneStandard(template);
        lastClonedId = model.id;
        renderAll();
        const card = qs(`[data-standard-model="${CSS.escape(template.id)}"]`);
        if (card) card.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
      } catch (error) {
        const summary = qs('[data-standard-models-summary]');
        if (summary) {
          summary.innerHTML = `<div class="bf-platform-alert bf-platform-alert--warning">${escapeHtml(error.message || 'Nao foi possivel clonar o modelo padrao.')}</div>`;
        }
      }
    });
  }

  async function init() {
    if (window.BFAuth && window.BFAuth.ready) await window.BFAuth.ready;
    const user = window.BFAuth.requireRole(['admin', 'consultor', 'cliente'], { redirect: true });
    if (!user) return;

    try {
      standards = await window.BFDadosService.json('modelos-comparador-padrao');
    } catch (error) {
      standards = [];
    }

    populateJourneyFilter();
    bindFilters();
    bindCloneActions();
    renderAll();
    document.body.dataset.standardModelsReady = 'true';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
