(function () {
  'use strict';

  const fmt = () => window.BFFormatters;
  const PROFILE_KEY = 'bf_financial_profile_v1';
  const HISTORY_KEY = 'bf_calculator_history_v1';
  const PRODUCTS_SELECTION_KEY = 'bf_products_selection_v1';
  const JOURNEY_ANALYTICS_KEY = 'bf_journey_analytics_v1';
  const COMPARATOR_FAVORITE_PRESET_KEY = 'bf_comparator_favorite_preset_v1';
  const COMPARATOR_MODELS_KEY = 'bf_comparator_models_v1';
  const COMPARATOR_MODEL_AUDIT_KEY = 'bf_comparator_model_audit_v1';
  const COMPARATOR_MODELS_SCHEMA = 'bank-fratern.comparator-models.v1';
  const COMPARATOR_FORMULA_VERSION = 'comparador.service.v7.12';
  const COMPARATOR_PREMISES_REFERENCE = 'calculadoras-premissas:2026-04-24';
  const MAX_HISTORY = 80;
  const MAX_PRODUCT_SELECTION = 4;
  const MAX_JOURNEY_EVENTS = 160;
  const MAX_COMPARATOR_MODELS = 12;
  const MAX_COMPARATOR_AUDIT = 80;

  function qs(name) {
    return document.querySelector(name);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function readJson(key, fallback) {
    try {
      const value = localStorage.getItem(key);
      return value ? JSON.parse(value) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    try {
      localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function publishBackendEvent(type, payload, meta = {}) {
    const api = window.BFBackendApi;
    if (!api || typeof api.recordEvent !== 'function') return;
    api.recordEvent(type, payload, meta).catch(() => {});
  }

  function scopedStorageKey(key) {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return `${key}:${user && user.email ? user.email : 'anon'}`;
  }

  function formData(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function numberFields(data) {
    const out = { ...data };
    Object.keys(out).forEach((key) => {
      if (out[key] !== '' && !Number.isNaN(Number(out[key]))) out[key] = Number(out[key]);
    });
    return out;
  }

  function journeyAnalyticsStorageKey() {
    return scopedStorageKey(JOURNEY_ANALYTICS_KEY);
  }

  function loadJourneyAnalytics() {
    const events = readJson(journeyAnalyticsStorageKey(), []);
    return Array.isArray(events) ? events : [];
  }

  function saveJourneyAnalytics(events) {
    return writeJson(journeyAnalyticsStorageKey(), (Array.isArray(events) ? events : []).slice(0, MAX_JOURNEY_EVENTS));
  }

  function recordJourneyEvent(type, detail = {}) {
    const event = {
      id: `JNY-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      type: String(type || 'event'),
      page: document.body ? (document.body.dataset.bfPage || 'unknown') : 'unknown',
      href: location.pathname ? location.pathname.split('/').pop() : '',
      detail: detail && typeof detail === 'object' ? detail : {},
      createdAt: new Date().toISOString()
    };
    const next = [event].concat(loadJourneyAnalytics()).slice(0, MAX_JOURNEY_EVENTS);
    saveJourneyAnalytics(next);
    renderJourneyAnalyticsSections(next);
    publishBackendEvent(event.type, event, {
      source: 'journey-analytics',
      ownerEmail: scopedStorageKey(JOURNEY_ANALYTICS_KEY).split(':').slice(1).join(':') || 'anon',
      entityType: 'journey-event',
      entityId: event.id,
      createdAt: event.createdAt
    });
    return event;
  }

  function journeyAnalyticsSummary(events = loadJourneyAnalytics()) {
    const list = Array.isArray(events) ? events : [];
    const countType = (type) => list.filter((event) => event.type === type).length;
    const countPrefix = (prefix) => list.filter((event) => String(event.type || '').startsWith(prefix)).length;
    const productSelections = countType('product_selected') + countType('product_top3_selected');
    const compareOpen = countType('products_compare_open') + countType('comparator_loaded_from_products');
    const comparatorRuns = countType('comparator_calculated');
    const simulatorRuns = countPrefix('simulator_calculated');
    const savedScenarios = countType('comparator_saved');
    const activeProducts = new Set();
    list.forEach((event) => {
      const detail = event.detail || {};
      if (detail.productId) activeProducts.add(detail.productId);
      (detail.selectionIds || detail.productIds || []).forEach((id) => activeProducts.add(id));
    });
    const conversions = savedScenarios + simulatorRuns;
    const conversionBase = Math.max(productSelections, compareOpen, 1);
    return {
      total: list.length,
      productSelections,
      compareOpen,
      comparatorRuns,
      savedScenarios,
      simulatorRuns,
      activeProducts: activeProducts.size,
      conversionRate: Math.round((conversions / conversionBase) * 100),
      lastEvent: list[0] || null,
      events: list
    };
  }

  function analyticsOwnerFromKey(key) {
    const prefix = `${JOURNEY_ANALYTICS_KEY}:`;
    return String(key || '').startsWith(prefix) ? String(key).slice(prefix.length) || 'anon' : 'anon';
  }

  function analyticsOwnerMeta(owner) {
    const email = String(owner || 'anon');
    const users = window.BFAuth && window.BFAuth.listUsers ? window.BFAuth.listUsers() : [];
    const user = users.find((item) => String(item.email || '').toLowerCase() === email.toLowerCase());
    if (user) {
      return {
        ownerEmail: user.email,
        ownerName: user.name,
        ownerRole: user.role,
        ownerRoleLabel: user.roleLabel || user.role
      };
    }
    return {
      ownerEmail: email,
      ownerName: email === 'anon' ? 'Anonimo' : email,
      ownerRole: email === 'anon' ? 'anonimo' : 'desconhecido',
      ownerRoleLabel: email === 'anon' ? 'Anonimo' : 'Desconhecido'
    };
  }

  function loadAllJourneyAnalytics() {
    const prefix = `${JOURNEY_ANALYTICS_KEY}:`;
    const events = [];
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith(prefix)) return;
        const owner = analyticsOwnerFromKey(key);
        const meta = analyticsOwnerMeta(owner);
        const list = readJson(key, []);
        if (!Array.isArray(list)) return;
        list.forEach((event) => {
          if (!event || typeof event !== 'object') return;
          events.push({ ...event, ...meta, storageKey: key });
        });
      });
    } catch (error) {
      return [];
    }
    return events.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  }

  function journeyAnalyticsRoleFunnel(events = loadAllJourneyAnalytics()) {
    const list = Array.isArray(events) ? events : [];
    const summary = journeyAnalyticsSummary(list);
    const roleOrder = ['cliente', 'consultor', 'admin', 'anonimo', 'desconhecido'];
    const roleLabels = {
      cliente: 'Clientes',
      consultor: 'Consultores',
      admin: 'Admins',
      anonimo: 'Anonimos',
      desconhecido: 'Desconhecidos'
    };
    const byRole = roleOrder
      .map((role) => {
        const roleEvents = list.filter((event) => (event.ownerRole || 'desconhecido') === role);
        return {
          role,
          label: roleLabels[role] || role,
          total: roleEvents.length,
          summary: journeyAnalyticsSummary(roleEvents),
          owners: Array.from(new Set(roleEvents.map((event) => event.ownerEmail || 'anon'))).length
        };
      })
      .filter((item) => item.total > 0 || item.role !== 'desconhecido');
    const stages = [
      { key: 'productSelections', label: 'Selecao', value: summary.productSelections },
      { key: 'compareOpen', label: 'Comparador', value: summary.compareOpen },
      { key: 'comparatorRuns', label: 'Matriz', value: summary.comparatorRuns },
      { key: 'savedScenarios', label: 'Salvos', value: summary.savedScenarios },
      { key: 'simulatorRuns', label: 'Simuladores', value: summary.simulatorRuns }
    ];
    return {
      summary,
      byRole,
      stages,
      recent: list.slice(0, 10),
      totalOwners: Array.from(new Set(list.map((event) => event.ownerEmail || 'anon'))).length
    };
  }

  function journeyEventLabel(event) {
    const labels = {
      product_selected: 'Produto selecionado',
      product_removed: 'Produto removido',
      product_top3_selected: 'Top 3 aplicado',
      product_selection_cleared: 'Selecao limpa',
      products_compare_open: 'Comparador aberto',
      comparator_loaded_from_products: 'Comparador recebeu produtos',
      comparator_calculated: 'Matriz calculada',
      comparator_saved: 'Cenario salvo',
      simulator_opened_from_comparator: 'Simulador aberto',
      simulator_calculated_financiamento: 'Financiamento calculado',
      simulator_calculated_cdc: 'CDC calculado',
      simulator_calculated_garantia: 'Garantia calculada',
      simulator_calculated_consignado: 'Consignado calculado',
      simulator_calculated_veiculos: 'Veiculos calculado'
    };
    return labels[event && event.type] || (event && event.type ? event.type.replace(/_/g, ' ') : 'Evento');
  }

  function journeyEventDetail(event) {
    const detail = event && event.detail ? event.detail : {};
    if (detail.productId) return detail.productId;
    if (detail.selectionIds && detail.selectionIds.length) return detail.selectionIds.join(', ');
    if (detail.productIds && detail.productIds.length) return detail.productIds.join(', ');
    if (detail.winner) return detail.winner;
    if (detail.simulator) return detail.simulator;
    return event && event.page ? event.page : 'jornada';
  }

  function renderJourneyAnalyticsSections(events = loadJourneyAnalytics()) {
    const targets = Array.from(document.querySelectorAll('[data-journey-analytics]'));
    if (!targets.length) return;
    const summary = journeyAnalyticsSummary(events);
    const recent = summary.events.slice(0, 5);
    targets.forEach((target) => {
      const context = target.dataset.analyticsContext || 'jornada';
      target.innerHTML = `
        <div class="bf-journey-analytics">
          <div class="bf-journey-analytics__head">
            <div>
              <span class="bf-badge bf-badge--gold">Microconversoes locais</span>
              <h2>Jornada medida no navegador</h2>
              <p>Eventos anonimos e locais mostram se o usuario saiu de produto para comparacao, salvou decisao ou abriu um simulador.</p>
            </div>
            <div class="bf-journey-analytics__score">
              <small>Conversao</small>
              <strong>${summary.conversionRate}%</strong>
              <span>${escapeHtml(context)}</span>
            </div>
          </div>
          <div class="bf-journey-analytics__metrics">
            ${window.BFCards.metric('Selecoes', summary.productSelections, 'is-strong')}
            ${window.BFCards.metric('Comparador', summary.compareOpen)}
            ${window.BFCards.metric('Matrizes', summary.comparatorRuns)}
            ${window.BFCards.metric('Simuladores', summary.simulatorRuns)}
          </div>
          <div class="bf-journey-analytics__recent">
            ${recent.length ? recent.map((event) => `
              <article>
                <strong>${escapeHtml(journeyEventLabel(event))}</strong>
                <span>${escapeHtml(journeyEventDetail(event))}</span>
                <small>${escapeHtml(formatShortDate(event.createdAt))}</small>
              </article>
            `).join('') : '<div class="bf-empty-state">Ainda nao ha eventos locais nesta sessao. Selecione produtos ou abra o comparador para alimentar esta leitura.</div>'}
          </div>
        </div>
      `;
    });
    if (document.body) {
      document.body.dataset.journeyAnalyticsReady = 'true';
      document.body.dataset.journeyAnalyticsEvents = String(summary.total);
    }
  }

  function formatShortDate(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function productObjectiveIds(objective) {
    const map = {
      comprar: ['consorcio', 'financiamento', 'garantia'],
      liquidez: ['cdc', 'garantia', 'consignado'],
      auto: ['veiculos', 'financiamento', 'consorcio']
    };
    return map[objective] || [];
  }

  function presetForProductObjective(objective) {
    const map = {
      comprar: 'comprar_bem',
      liquidez: 'obter_liquidez',
      auto: 'trocar_veiculo'
    };
    return map[objective] || 'manual';
  }

  function productsSelectionStorageKey() {
    return scopedStorageKey(PRODUCTS_SELECTION_KEY);
  }

  function normalizeProductSelection(value, products) {
    const valid = new Set((products || []).map((product) => product.id));
    const source = Array.isArray(value) ? value : [];
    const unique = [];
    source.forEach((id) => {
      const normalized = String(id || '').trim();
      if (valid.has(normalized) && !unique.includes(normalized)) unique.push(normalized);
    });
    return unique.slice(0, MAX_PRODUCT_SELECTION);
  }

  function readProductSelection(products) {
    return normalizeProductSelection(readJson(productsSelectionStorageKey(), []), products);
  }

  function writeProductSelection(ids, products) {
    const selection = normalizeProductSelection(ids, products);
    writeJson(productsSelectionStorageKey(), selection);
    return selection;
  }

  function selectedProductList(products, selectionIds) {
    const selected = new Set(selectionIds || []);
    return (products || []).filter((product) => selected.has(product.id));
  }

  function productNameById(id, products) {
    const product = (products || []).find((item) => item.id === id);
    const fallback = {
      consumo: 'Compra a vista/parcelada',
      veiculos: 'Veiculos'
    };
    return product ? product.nome : (fallback[id] || id);
  }

  function productsCompareHref(selectionIds, form) {
    const selected = (selectionIds || []).filter(Boolean);
    if (selected.length > 0) {
      return `comparador.html?preset=manual&products=${encodeURIComponent(selected.join(','))}`;
    }
    const data = form ? formData(form) : {};
    const preset = presetForProductObjective(data.objetivo || 'todos');
    return preset === 'manual' ? 'comparador.html' : `comparador.html?preset=${encodeURIComponent(preset)}`;
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

  function productJourneyParams(product, form, selectionIds = []) {
    const data = form ? formData(form) : {};
    const selected = (selectionIds || []).filter(Boolean);
    const objective = data.objetivo && data.objetivo !== 'todos' ? data.objetivo : '';
    const urgency = data.urgencia && data.urgencia !== 'todas' ? data.urgencia : '';
    const preset = product && product.comparadorPreset
      ? product.comparadorPreset
      : presetForProductObjective(data.objetivo || 'todos');
    return {
      from: 'products',
      productId: product && product.id,
      preset: preset === 'manual' ? '' : preset,
      products: selected.length ? selected.join(',') : '',
      objective,
      urgency
    };
  }

  function productContextHref(product, kind, form, selectionIds = []) {
    const base = {
      simulator: product && product.simulador,
      calculator: product && product.calculadora,
      comparator: product && product.comparador
        ? `${product.comparador}${product.comparadorPreset ? `?preset=${encodeURIComponent(product.comparadorPreset)}` : ''}`
        : productsCompareHref(selectionIds, form),
      journey: 'trilha-decisao.html'
    }[kind] || 'produtos.html';
    return appendQuery(base, productJourneyParams(product, form, selectionIds));
  }

  function productsCompareContextHref(selectionIds, form, product) {
    const selected = (selectionIds || []).filter(Boolean);
    const params = productJourneyParams(product || null, form, selectionIds);
    if (selected.length) params.preset = 'manual';
    return appendQuery(productsCompareHref(selectionIds, form), params);
  }

  function productWithJourney(product, form, selectionIds = []) {
    return {
      ...product,
      simuladorHref: productContextHref(product, 'simulator', form, selectionIds),
      comparadorHref: productContextHref(product, 'comparator', form, selectionIds),
      calculadoraHref: productContextHref(product, 'calculator', form, selectionIds),
      trilhaHref: productContextHref(product, 'journey', form, selectionIds)
    };
  }

  function productFilterProfile(form) {
    const saved = readJson(PROFILE_KEY, {});
    const data = form ? formData(form) : {};
    return {
      ...data,
      renda: Number(data.renda || saved.rendaMensal || 0),
      entrada: Number(data.entrada || saved.reservaAtual || 0),
      garantia: data.garantia || (saved.patrimonioEstimado ? '1' : ''),
      risco: data.risco || saved.risco || 'moderado',
      urgencia: data.urgencia && data.urgencia !== 'todas' ? data.urgencia : 'media'
    };
  }

  function filterProducts(products, form) {
    const data = form ? formData(form) : {};
    const objective = data.objetivo || 'todos';
    const urgency = data.urgencia || 'todas';
    const ids = productObjectiveIds(objective);
    return (products || []).filter((product) => {
      const matchesObjective = objective === 'todos' || ids.includes(product.id);
      const matchesUrgency = urgency === 'todas' || String(product.urgencia || '').toLowerCase() === urgency;
      return matchesObjective && matchesUrgency;
    });
  }

  function renderProducts(products) {
    const target = qs('[data-products-grid]');
    if (!target) return;
    const form = qs('[data-products-filter]');
    const selectionIds = writeProductSelection(readProductSelection(products), products);
    const filtered = filterProducts(products, form);
    const profile = productFilterProfile(form);
    const ranked = window.BFRecomendacaoService
      ? window.BFRecomendacaoService.recommend(profile, filtered)
      : filtered;
    updateProductsCompareLink(form, selectionIds);
    renderProductsProfile(products, ranked, profile, selectionIds);
    renderProductsDecisionBridge(products, ranked, profile, form, selectionIds);
    renderProductsSelectionPanel(products, ranked, profile, form, selectionIds);
    if (ranked.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum produto encontrado para este filtro. Ajuste objetivo ou urgencia para ampliar a matriz.</div>';
      document.body.dataset.productsCount = '0';
      document.body.dataset.productsSelectedCount = String(selectionIds.length);
      return;
    }
    target.innerHTML = ranked
      .map((product) => window.BFCards.product({
        ...productWithJourney(product, form, selectionIds),
        selectionEnabled: true,
        selecionado: selectionIds.includes(product.id)
      }))
      .join('');
    document.body.dataset.productsCount = String(ranked.length);
    document.body.dataset.productsSelectedCount = String(selectionIds.length);
    bindProductSelectionActions(products);
  }

  function updateProductsCompareLink(form, selectionIds = []) {
    const link = qs('[data-products-compare-link]');
    if (!link) return;
    link.href = productsCompareContextHref(selectionIds, form);
    link.textContent = selectionIds.length > 0
      ? `Comparar selecionados (${selectionIds.length})`
      : 'Abrir comparador 2.0';
  }

  function renderProductsProfile(products, ranked, profile, selectionIds = []) {
    const target = qs('[data-products-profile]');
    if (!target) return;
    const saved = readJson(PROFILE_KEY, {});
    const history = readJson(HISTORY_KEY, []);
    const recommended = ranked[0];
    const recommendedJourney = recommended ? productWithJourney(recommended, qs('[data-products-filter]'), selectionIds) : null;
    const f = fmt();
    const compareHref = recommended && recommended.comparador
      ? productContextHref(recommended, 'comparator', qs('[data-products-filter]'), selectionIds)
      : 'comparador.html';
    const selectedCompareHref = productsCompareContextHref(selectionIds, qs('[data-products-filter]'), recommended);
    target.innerHTML = `
      <div class="bf-products-profile">
        <div>
          <span class="bf-badge bf-badge--ok">Produtos conectados</span>
          <h2>${recommended ? `Trilha sugerida: ${escapeHtml(recommended.nome)}` : 'Trilha de produto'}</h2>
          <p>${recommended ? escapeHtml(recommended.quandoUsar || recommended.objetivo) : 'Use os filtros para montar uma matriz de produtos adequada ao momento do usuario.'}</p>
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="${recommendedJourney && recommendedJourney.simuladorHref ? escapeHtml(recommendedJourney.simuladorHref) : escapeHtml(selectedCompareHref)}">Simular recomendado</a>
            <a class="btn btn--ghost btn--sm" href="${recommendedJourney && recommendedJourney.calculadoraHref ? escapeHtml(recommendedJourney.calculadoraHref) : 'calculadoras.html?from=products'}">Diagnostico financeiro</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(selectionIds.length ? selectedCompareHref : compareHref)}">Comparar alternativas</a>
            <a class="btn btn--ghost btn--sm" href="${recommendedJourney && recommendedJourney.trilhaHref ? escapeHtml(recommendedJourney.trilhaHref) : 'trilha-decisao.html?from=products'}">Montar trilha</a>
          </div>
        </div>
        <div class="bf-products-profile__metrics">
          <div><small>Produtos</small><strong>${(products || []).length}</strong></div>
          <div><small>Score lider</small><strong>${recommended && recommended.scoreRecomendacao ? `${recommended.scoreRecomendacao}/100` : '-'}</strong></div>
          <div><small>Renda perfil</small><strong>${profile.renda ? f.currency(profile.renda) : (saved.rendaMensal ? f.currency(saved.rendaMensal) : '-')}</strong></div>
          <div><small>Selecionados</small><strong>${selectionIds.length}</strong></div>
          <div><small>Historico</small><strong>${Array.isArray(history) ? history.length : 0}</strong></div>
        </div>
      </div>
    `;
  }

  function renderProductsDecisionBridge(products, ranked, profile, form, selectionIds = []) {
    const strip = qs('[data-products-decision-strip]');
    const timelineTarget = qs('[data-products-bridge-timeline]');
    if (!strip && !timelineTarget) return;
    const data = form ? formData(form) : {};
    const recommended = ranked && ranked.length ? ranked[0] : null;
    const recommendedJourney = recommended ? productWithJourney(recommended, form, selectionIds) : null;
    const preset = presetForProductObjective(data.objetivo || 'todos');
    const compareHref = productsCompareContextHref(selectionIds, form, recommended);
    const history = readJson(HISTORY_KEY, []);
    const count = ranked ? ranked.length : 0;
    const urgency = profile && profile.urgencia ? profile.urgencia : 'media';
    const f = fmt();

    if (strip) {
      strip.innerHTML = `
        <div class="bf-v8-decision-strip__head">
          <span class="bf-badge bf-badge--gold">Produtos conectados</span>
          <div>
            <h2>${recommended ? `Proxima decisao: ${escapeHtml(recommended.nome)}` : 'Catalogo sem produto ativo'}</h2>
            <p>${recommended ? escapeHtml(recommended.quandoUsar || recommended.objetivo) : 'Ajuste os filtros para encontrar produtos adequados ao objetivo do usuario.'}</p>
            <div class="bf-inline-actions">
              <a class="btn btn--primary btn--sm" href="${recommendedJourney && recommendedJourney.simuladorHref ? escapeHtml(recommendedJourney.simuladorHref) : escapeHtml(compareHref)}">Simular recomendado</a>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(compareHref)}">Abrir comparador</a>
              <a class="btn btn--ghost btn--sm" href="${recommendedJourney && recommendedJourney.calculadoraHref ? escapeHtml(recommendedJourney.calculadoraHref) : 'calculadoras.html?from=products'}">Diagnostico</a>
              <a class="btn btn--ghost btn--sm" href="${recommendedJourney && recommendedJourney.trilhaHref ? escapeHtml(recommendedJourney.trilhaHref) : 'trilha-decisao.html?from=products'}">Trilha</a>
            </div>
          </div>
        </div>
        <div class="bf-v8-decision-strip__grid">
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Perfil</span>
            <strong>${profile && profile.renda ? f.currency(profile.renda) : 'Renda pendente'}</strong>
            <p>Objetivo, urgencia e risco filtram a prateleira antes da simulacao.</p>
            <small>Urgencia: ${escapeHtml(urgency)}</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--stable">
            <span>Produto</span>
            <strong>${selectionIds.length ? `${selectionIds.length} selecionado${selectionIds.length === 1 ? '' : 's'}` : (recommended ? escapeHtml(recommended.nome) : `${count} opcoes`)}</strong>
            <p>${selectionIds.length ? 'A matriz do comparador vai abrir com a selecao atual.' : (recommended && recommended.scoreRecomendacao ? `Score lider ${recommended.scoreRecomendacao}/100.` : 'Catalogo pronto para ranqueamento.')}</p>
            <small>${count} produto${count === 1 ? '' : 's'} no recorte</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Simulacao</span>
            <strong>${recommended && recommended.simulador ? 'Rota pronta' : 'Comparador'}</strong>
            <p>O produto escolhido leva para simulador especifico ou matriz multi-produto.</p>
            <small>${escapeHtml(preset === 'manual' ? 'preset manual' : preset.replace(/_/g, ' '))}</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--stable">
            <span>Continuidade</span>
            <strong>${Array.isArray(history) ? history.length : 0} eventos</strong>
            <p>Historico, calculadoras e dashboard mantem a decisao rastreavel.</p>
            <small>Jornada local conectada</small>
          </article>
        </div>
      `;
    }

    if (timelineTarget) {
      const items = [
        ['Perfil', 'Diagnostico financeiro', 'Renda, risco e urgencia orientam os filtros.', '#produtos-perfil', 'is-done'],
        ['Filtros', 'Momento do usuario', 'Objetivo e urgencia reduzem a prateleira.', '#produtos-filtros', 'is-active'],
        ['Catalogo', recommended ? recommended.nome : 'Produtos ranqueados', 'Cards levam para simulacao, comparacao ou diagnostico.', '#produtos-catalogo', 'is-active'],
        ['Comparador', selectionIds.length ? 'Selecao assistida' : (preset === 'manual' ? 'Matriz manual' : preset.replace(/_/g, ' ')), selectionIds.length ? 'Os produtos escolhidos seguem para a matriz multi-produto.' : 'O preset segue para o comparador multi-produto.', compareHref, 'is-pending'],
        ['Continuidade', 'Dashboard', 'Resultados salvos retornam para a central do cliente.', 'dashboard-cliente.html#continuidade-cliente', 'is-pending']
      ];
      timelineTarget.innerHTML = items.map((item, index) => `
        <a class="bf-client-timeline__item ${item[4]}" href="${escapeHtml(item[3])}">
          <span>${index + 1}</span>
          <div>
            <small>${escapeHtml(item[0])}</small>
            <strong>${escapeHtml(item[1])}</strong>
            <p>${escapeHtml(item[2])}</p>
          </div>
        </a>
      `).join('');
    }

    document.body.dataset.productsBridgeReady = 'true';
  }

  function renderProductsSelectionPanel(products, ranked, profile, form, selectionIds = []) {
    const target = qs('[data-products-selection-panel]');
    if (!target) return;
    const selected = selectedProductList(products, selectionIds);
    const suggested = (ranked || []).slice(0, 3);
    const compareHref = productsCompareContextHref(selectionIds, form, suggested[0]);
    const selectedHtml = selected.length
      ? selected.map((product) => `
        <button class="bf-product-selection-chip is-selected" type="button" data-product-toggle-selection="${escapeHtml(product.id)}" aria-pressed="true">
          <span>${escapeHtml(product.nome)}</span>
          <small>${escapeHtml(product.categoria)}</small>
        </button>
      `).join('')
      : '<div class="bf-empty-state">Selecione de 2 a 4 produtos no catalogo para montar uma matriz manual no comparador.</div>';
    const suggestedHtml = suggested.length
      ? suggested.map((product, index) => `
        <button class="bf-product-selection-chip" type="button" data-product-toggle-selection="${escapeHtml(product.id)}" aria-pressed="${selectionIds.includes(product.id) ? 'true' : 'false'}">
          <span>${index + 1}. ${escapeHtml(product.nome)}</span>
          <small>${product.scoreRecomendacao ? `Score ${product.scoreRecomendacao}/100` : escapeHtml(product.urgencia || 'produto')}</small>
        </button>
      `).join('')
      : '<div class="bf-empty-state">Nenhuma sugestao disponivel para o filtro atual.</div>';
    target.innerHTML = `
      <div class="bf-products-selection">
        <div class="bf-products-selection__head">
          <div>
            <span class="bf-badge bf-badge--navy">Selecao assistida</span>
            <h2>Monte a matriz antes de comparar</h2>
            <p>Escolha produtos no catalogo, preserve a selecao no navegador e abra o comparador com as colunas certas para o momento do usuario.</p>
          </div>
          <div class="bf-products-selection__counter">
            <small>Selecionados</small>
            <strong>${selectionIds.length}/${MAX_PRODUCT_SELECTION}</strong>
          </div>
        </div>
        <div class="bf-products-selection__body">
          <div>
            <h3>Selecao atual</h3>
            <div class="bf-products-selection__chips">${selectedHtml}</div>
          </div>
          <div>
            <h3>Sugestoes do ranking</h3>
            <div class="bf-products-selection__chips">${suggestedHtml}</div>
          </div>
        </div>
        <div class="bf-products-selection__actions">
          <a class="btn btn--primary btn--sm" href="${escapeHtml(compareHref)}" data-products-selection-compare>${selectionIds.length ? 'Comparar selecao' : 'Abrir comparador'}</a>
          <button class="btn btn--ghost btn--sm" type="button" data-products-select-recommended${suggested.length ? '' : ' disabled'}>Usar top 3</button>
          <button class="btn btn--ghost btn--sm" type="button" data-products-clear-selection${selectionIds.length ? '' : ' disabled'}>Limpar selecao</button>
        </div>
      </div>
    `;
    document.body.dataset.productsSelectionReady = 'true';
  }

  function bindProductSelectionActions(products) {
    if (!qs('[data-products-grid]') || document.body.dataset.productsSelectionBound === 'true') return;
    document.body.dataset.productsSelectionBound = 'true';
    document.body.addEventListener('click', (event) => {
      const toggle = event.target.closest('[data-product-toggle-selection]');
      const useRecommended = event.target.closest('[data-products-select-recommended]');
      const clearSelection = event.target.closest('[data-products-clear-selection]');
      const compareLink = event.target.closest('[data-products-selection-compare], [data-products-compare-link]');
      const simulatorLink = event.target.closest('a[href^="simulador-"]');

      if (toggle) {
        event.preventDefault();
        const id = toggle.dataset.productToggleSelection;
        const current = readProductSelection(products);
        const next = current.includes(id)
          ? current.filter((item) => item !== id)
          : current.length >= MAX_PRODUCT_SELECTION
            ? current
            : current.concat(id);
        writeProductSelection(next, products);
        recordJourneyEvent(current.includes(id) ? 'product_removed' : 'product_selected', {
          productId: id,
          productName: productNameById(id, products),
          selectionIds: next,
          selectedCount: next.length
        });
        renderProducts(products);
      }

      if (useRecommended) {
        event.preventDefault();
        const form = qs('[data-products-filter]');
        const filtered = filterProducts(products, form);
        const profile = productFilterProfile(form);
        const ranked = window.BFRecomendacaoService
          ? window.BFRecomendacaoService.recommend(profile, filtered)
          : filtered;
        const next = writeProductSelection(ranked.slice(0, 3).map((product) => product.id), products);
        recordJourneyEvent('product_top3_selected', {
          selectionIds: next,
          selectedCount: next.length
        });
        renderProducts(products);
      }

      if (clearSelection) {
        event.preventDefault();
        const current = readProductSelection(products);
        writeProductSelection([], products);
        recordJourneyEvent('product_selection_cleared', {
          selectionIds: current,
          selectedCount: 0
        });
        renderProducts(products);
      }

      if (compareLink) {
        recordJourneyEvent('products_compare_open', {
          selectionIds: readProductSelection(products),
          href: compareLink.getAttribute('href') || 'comparador.html'
        });
      }

      if (simulatorLink && simulatorLink.getAttribute('href')) {
        recordJourneyEvent('simulator_opened_from_products', {
          href: simulatorLink.getAttribute('href'),
          simulator: simulatorLink.getAttribute('href').replace('.html', '')
        });
      }
    });
  }

  function bindProductsFilter(products) {
    const form = qs('[data-products-filter]');
    if (!form) return;
    bindProductSelectionActions(products);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      renderProducts(products);
    });
    form.addEventListener('change', () => renderProducts(products));
  }

  function renderGlossary(glossario) {
    const target = qs('[data-glossary-grid]');
    if (!target) return;
    target.innerHTML = glossario.map((item) => `
      <article class="bf-platform-card">
        <span class="bf-badge bf-badge--navy">${item.categoria}</span>
        <h3>${item.termo}</h3>
        <p>${item.definicao}</p>
      </article>
    `).join('');
  }

  function renderDatasets(data) {
    const target = qs('[data-datasets]');
    if (!target) return;
    const rows = [
      ['Produtos', data.produtos.length, 'assets/data/produtos.json'],
      ['Calculadoras', data.calculadoras ? data.calculadoras.length : 0, 'assets/data/calculadoras.json'],
      ['Premissas de calculadoras', data.premissas ? 1 : 0, 'assets/data/calculadoras-premissas.json'],
      ['Golden tests de formulas', data.goldenTests ? data.goldenTests.length : 0, 'assets/data/calculadoras-golden-tests.json'],
      ['Modelos padrao do comparador', data.modelosComparadorPadrao ? data.modelosComparadorPadrao.length : 0, 'assets/data/modelos-comparador-padrao.json'],
      ['Glossario', data.glossario.length, 'assets/data/glossario.json'],
      ['Indices', data.indices.length, 'assets/data/indices.json'],
      ['Instituicoes', data.instituicoes.length, 'assets/data/instituicoes.json'],
      ['Formulas', data.formulas.length, 'assets/data/formulas.json'],
      ['Regras de negocio', 1, 'assets/data/regras-negocio.json']
    ];
    target.innerHTML = rows.map((row) => `
      <article class="bf-platform-card">
        <span class="bf-badge bf-badge--ok">${row[1]} registros</span>
        <h3>${row[0]}</h3>
        <p><code>${row[2]}</code></p>
      </article>
    `).join('');
  }

  function lightSimulatorMeta(type) {
    const map = {
      financiamento: {
        label: 'Financiamento',
        badge: 'Credito estruturado',
        compareHref: 'comparador.html?preset=comprar_bem',
        nextHref: 'dashboard-cliente.html#continuidade-cliente',
        memory: 'Price/SAC, entrada, juros, amortizacao e saldo mensal.'
      },
      cdc: {
        label: 'CDC',
        badge: 'Credito direto',
        compareHref: 'comparador.html?preset=obter_liquidez',
        nextHref: 'dashboard-cliente.html#continuidade-cliente',
        memory: 'Valor solicitado, tarifas, taxa mensal, prazo e custo total.'
      },
      garantia: {
        label: 'Credito com garantia',
        badge: 'Garantia e LTV',
        compareHref: 'comparador.html?preset=obter_liquidez',
        nextHref: 'compliance.html',
        memory: 'Valor do ativo, LTV usado, taxa, prazo e parcela.'
      },
      consignado: {
        label: 'Consignado',
        badge: 'Margem consignavel',
        compareHref: 'comparador.html?preset=obter_liquidez',
        nextHref: 'dashboard-cliente.html#continuidade-cliente',
        memory: 'Renda, margem, taxa, prazo e elegibilidade.'
      },
      veiculos: {
        label: 'Veiculos',
        badge: 'Auto decisao',
        compareHref: 'comparador.html?preset=trocar_veiculo',
        nextHref: 'dashboard-cliente.html#continuidade-cliente',
        memory: 'Financiamento, consorcio, entrada, lance e custo total.'
      }
    };
    return map[type] || {
      label: 'Simulador',
      badge: 'Decisao financeira',
      compareHref: 'comparador.html',
      nextHref: 'dashboard-cliente.html#continuidade-cliente',
      memory: 'Premissas, resultado e proxima acao.'
    };
  }

  function simulatorDecisionTone(result, type) {
    if (type === 'consignado' && result && result.elegivel === false) return 'bf-v8-decision-card--warning';
    if (type === 'garantia' && result && Number(result.ltvUsado || 0) >= Number(result.ltvPct || 100)) return 'bf-v8-decision-card--warning';
    if (result && Number(result.taxaMes || 0) >= 2) return 'bf-v8-decision-card--warning';
    return 'bf-v8-decision-card--stable';
  }

  function simulatorMainLabel(result) {
    if (!result) return 'Aguardando calculo';
    if (result.decision && result.decision.label) return result.decision.label;
    return result.tipo || 'Cenario calculado';
  }

  function simulatorTotal(result) {
    if (!result) return 0;
    if (result.metrics && result.metrics.menorCusto) return result.metrics.menorCusto;
    if (result.best && result.best.totalPago) return result.best.totalPago;
    return result.totalPago || 0;
  }

  function simulatorInstallment(result) {
    if (!result) return 0;
    if (result.metrics && result.metrics.menorParcela) return result.metrics.menorParcela;
    if (result.best && result.best.primeiraParcela) return result.best.primeiraParcela;
    return result.primeiraParcela || 0;
  }

  function simulatorDecisionText(result, type) {
    if (!result) return 'Informe os campos e calcule para gerar a leitura da decisao.';
    if (result.decision && result.decision.reason) return result.decision.reason;
    if (type === 'consignado') {
      return result.elegivel ? 'A parcela estimada fica dentro da margem informada.' : 'A parcela estimada supera a margem informada; reduza valor, taxa ou prazo.';
    }
    if (type === 'garantia') {
      return `LTV usado de ${fmt().percent(result.ltvUsado || 0)} sobre a garantia informada.`;
    }
    return 'Resultado calculado com memoria mensal para comparar custo, parcela e prazo.';
  }

  function saveLightSimulatorScenario(type, result, input) {
    if (!result) return false;
    const meta = lightSimulatorMeta(type);
    const entry = {
      id: `SIM-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      calculatorSlug: `simulador-${type}`,
      calculatorName: `Simulador ${meta.label}`,
      input: input || {},
      metrics: [
        { label: 'Decisao', value: simulatorMainLabel(result) },
        { label: 'Total pago', value: fmt().currency(simulatorTotal(result)) },
        { label: 'Primeira parcela', value: fmt().currency(simulatorInstallment(result)) }
      ],
      recommendation: {
        title: meta.label,
        message: simulatorDecisionText(result, type),
        tone: simulatorDecisionTone(result, type).includes('warning') ? 'warn' : 'success',
        next: 'Reabrir simulador, comparar alternativas ou retomar no dashboard.'
      }
    };
    const history = readJson(HISTORY_KEY, []);
    return writeJson(HISTORY_KEY, [entry].concat(Array.isArray(history) ? history : []).slice(0, MAX_HISTORY));
  }

  function bindLightSimulatorSave(type, result, input) {
    const button = qs('[data-light-simulator-save]');
    const status = qs('[data-light-simulator-save-status]');
    if (!button) return;
    button.onclick = () => {
      const saved = saveLightSimulatorScenario(type, result, input);
      if (status) {
        status.textContent = saved ? 'Cenario salvo no historico local.' : 'Nao foi possivel salvar neste navegador.';
        status.className = `bf-comparator-save-status ${saved ? 'is-success' : 'is-error'}`;
      }
    };
  }

  function updateLightSimulatorBridge(type, result, input) {
    const strip = qs('[data-light-simulator-decision-strip]');
    const timelineTarget = qs('[data-light-simulator-timeline]');
    if (!strip && !timelineTarget) return;
    const meta = lightSimulatorMeta(type);
    const f = fmt();
    const total = simulatorTotal(result);
    const installment = simulatorInstallment(result);
    const decision = simulatorMainLabel(result);
    const compared = result && Array.isArray(result.summaries) ? result.summaries.length : 1;
    const memoryLines = result && Array.isArray(result.memory) ? result.memory.length : (result && Array.isArray(result.rows) ? result.rows.length : 0);
    const tone = simulatorDecisionTone(result, type);

    if (strip) {
      strip.innerHTML = `
        <div class="bf-v8-decision-strip__head">
          <span class="bf-badge bf-badge--gold">${escapeHtml(meta.badge)}</span>
          <div>
            <h2>${escapeHtml(meta.label)}: ${escapeHtml(decision)}</h2>
            <p>${escapeHtml(simulatorDecisionText(result, type))}</p>
            <div class="bf-inline-actions">
              <button class="btn btn--primary btn--sm" type="button" data-light-simulator-save>Salvar cenario</button>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(meta.compareHref)}">Abrir comparador</a>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(meta.nextHref)}">Continuar jornada</a>
            </div>
            <div class="bf-comparator-save-status" data-light-simulator-save-status></div>
          </div>
        </div>
        <div class="bf-v8-decision-strip__grid">
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Entrada</span>
            <strong>${input ? Object.keys(input).length : 0} premissas</strong>
            <p>Campos principais conectam valor, taxa, prazo e capacidade de pagamento.</p>
            <small>${escapeHtml(meta.memory)}</small>
          </article>
          <article class="bf-v8-decision-card ${tone}">
            <span>Resultado</span>
            <strong>${escapeHtml(decision)}</strong>
            <p>Total estimado: ${escapeHtml(f.currency(total))}. Primeira parcela: ${escapeHtml(f.currency(installment))}.</p>
            <small>${result && result.prazo ? f.months(result.prazo) : 'prazo calculado'}</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--info">
            <span>Memoria</span>
            <strong>${memoryLines} registro${memoryLines === 1 ? '' : 's'}</strong>
            <p>Resultado mantem cronograma ou resumo explicavel para auditoria local.</p>
            <small>${compared} alternativa${compared === 1 ? '' : 's'} no cenario</small>
          </article>
          <article class="bf-v8-decision-card bf-v8-decision-card--stable">
            <span>Continuidade</span>
            <strong>Comparar ou salvar</strong>
            <p>Use o comparador para validar alternativas e o dashboard para retomar a decisao.</p>
            <small>Historico local conectado</small>
          </article>
        </div>
      `;
      bindLightSimulatorSave(type, result, input);
    }

    if (timelineTarget) {
      const timeline = [
        ['Entrada', 'Premissas informadas', 'Valor, taxa, prazo e filtros do produto.', '#simulador-entrada', 'is-done'],
        ['Calculo', decision, simulatorDecisionText(result, type), '#decisao-simulador-leve', 'is-active'],
        ['Memoria', `${memoryLines} linhas`, 'Cronograma e leitura explicavel ficam visiveis no resultado.', '#resultado-simulador-leve', 'is-pending'],
        ['Comparacao', 'Matriz multi-produto', 'O mesmo cenario pode ser levado para o Comparador.', meta.compareHref, 'is-pending'],
        ['Continuidade', 'Dashboard', 'Salvar o cenario cria rastro para retomar a jornada.', meta.nextHref, 'is-pending']
      ];
      timelineTarget.innerHTML = timeline.map((item, index) => `
        <a class="bf-client-timeline__item ${item[4]}" href="${escapeHtml(item[3])}">
          <span>${index + 1}</span>
          <div>
            <small>${escapeHtml(item[0])}</small>
            <strong>${escapeHtml(item[1])}</strong>
            <p>${escapeHtml(item[2])}</p>
          </div>
        </a>
      `).join('');
    }

    document.body.dataset.lightSimulatorReady = type;
  }

  function bindFinancing() {
    const form = qs('[data-financing-form]');
    const target = qs('[data-financing-result]');
    if (!form || !target) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = numberFields(formData(form));
      const result = window.BFFinanciamentoService.simulate(input);
      target.innerHTML = renderResultCards(result) + window.BFTables.schedule(result.rows);
      updateLightSimulatorBridge('financiamento', result, input);
      recordJourneyEvent('simulator_calculated_financiamento', {
        simulator: 'financiamento',
        totalPago: result.totalPago,
        primeiraParcela: result.primeiraParcela,
        trusted: event.isTrusted === true
      });
    });
    form.dispatchEvent(new Event('submit'));
  }

  function bindCdc() {
    const form = qs('[data-cdc-form]');
    const target = qs('[data-cdc-result]');
    if (!form || !target) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = numberFields(formData(form));
      const result = window.BFCdcService.simulate(input);
      target.innerHTML = renderResultCards(result) + window.BFTables.schedule(result.rows);
      updateLightSimulatorBridge('cdc', result, input);
      recordJourneyEvent('simulator_calculated_cdc', {
        simulator: 'cdc',
        totalPago: result.totalPago,
        primeiraParcela: result.primeiraParcela,
        trusted: event.isTrusted === true
      });
    });
    form.dispatchEvent(new Event('submit'));
  }

  function bindGuarantee() {
    const form = qs('[data-guarantee-form]');
    const target = qs('[data-guarantee-result]');
    if (!form || !target || !window.BFGarantiaService) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = numberFields(formData(form));
      const result = window.BFGarantiaService.simulate(input);
      target.innerHTML = renderResultCards(result) + `
        <div class="bf-platform-alert bf-platform-alert--success">LTV usado: <strong>${fmt().percent(result.ltvUsado)}</strong></div>
      ` + window.BFTables.schedule(result.rows);
      updateLightSimulatorBridge('garantia', result, input);
      recordJourneyEvent('simulator_calculated_garantia', {
        simulator: 'garantia',
        totalPago: result.totalPago,
        primeiraParcela: result.primeiraParcela,
        trusted: event.isTrusted === true
      });
    });
    form.dispatchEvent(new Event('submit'));
  }

  function bindConsigned() {
    const form = qs('[data-consigned-form]');
    const target = qs('[data-consigned-result]');
    if (!form || !target || !window.BFConsignadoService) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = numberFields(formData(form));
      const result = window.BFConsignadoService.simulate(input);
      const tone = result.elegivel ? 'success' : 'info';
      const status = result.elegivel ? 'parcela dentro da margem' : 'parcela acima da margem informada';
      target.innerHTML = renderResultCards(result) + `
        <div class="bf-platform-alert bf-platform-alert--${tone}">
          Margem disponivel: <strong>${fmt().currency(result.margemDisponivel)}</strong>; ${status}.
        </div>
      ` + window.BFTables.schedule(result.rows);
      updateLightSimulatorBridge('consignado', result, input);
      recordJourneyEvent('simulator_calculated_consignado', {
        simulator: 'consignado',
        totalPago: result.totalPago,
        primeiraParcela: result.primeiraParcela,
        trusted: event.isTrusted === true
      });
    });
    form.dispatchEvent(new Event('submit'));
  }

  function bindVehicle() {
    const form = qs('[data-vehicle-form]');
    const target = qs('[data-vehicle-result]');
    if (!form || !target) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const input = numberFields(formData(form));
      const result = window.BFComparadorService.compareDefault(input);
      target.innerHTML = renderBest(result) + window.BFTables.comparison(result.summaries);
      updateLightSimulatorBridge('veiculos', result, input);
      recordJourneyEvent('simulator_calculated_veiculos', {
        simulator: 'veiculos',
        winner: result.decision ? result.decision.label : '',
        comparedCount: result.summaries ? result.summaries.length : 0,
        trusted: event.isTrusted === true
      });
    });
    form.dispatchEvent(new Event('submit'));
  }

  function comparatorPresetMap() {
    return {
      manual: {
        label: 'Manual',
        description: 'Use este modo para escolher colunas e premissas livremente.',
        productIds: [],
        fields: {}
      },
      comprar_bem: {
        label: 'Comprar bem',
        description: 'Compara posse imediata, planejamento por consorcio e credito com garantia para uma compra relevante.',
        productIds: ['financiamento', 'consorcio', 'garantia'],
        fields: {
          includeFinanciamento: true,
          includeConsorcio: true,
          includeCdc: false,
          includeGarantia: true,
          includeConsignado: false,
          includeConsumo: false,
          urgencia: 'media',
          prioridade: 'menor_custo',
          valorBem: 250000,
          entrada: 50000,
          valorCredito: 200000,
          prazo: 180,
          prazoGarantia: 120
        }
      },
      obter_liquidez: {
        label: 'Obter liquidez',
        description: 'Compara credito direto, garantia e consignado para necessidade de caixa com disponibilidade mais rapida.',
        productIds: ['cdc', 'garantia', 'consignado'],
        fields: {
          includeFinanciamento: false,
          includeConsorcio: false,
          includeCdc: true,
          includeGarantia: true,
          includeConsignado: true,
          includeConsumo: false,
          urgencia: 'alta',
          prioridade: 'rapidez',
          valorCredito: 80000,
          prazoCredito: 72,
          prazoGarantia: 120,
          prazoConsignado: 72
        }
      },
      trocar_veiculo: {
        label: 'Trocar veiculo',
        description: 'Compara financiamento, consorcio e decisao de consumo para uma compra ou troca de automovel.',
        productIds: ['veiculos', 'financiamento', 'consorcio'],
        fields: {
          includeFinanciamento: true,
          includeConsorcio: true,
          includeCdc: false,
          includeGarantia: false,
          includeConsignado: false,
          includeConsumo: true,
          urgencia: 'media',
          prioridade: 'menor_custo',
          valorBem: 95000,
          entrada: 25000,
          valorCredito: 70000,
          taxaMes: 1.55,
          prazo: 72,
          taxaAdm: 16,
          lance: 25,
          precoCheio: 95000,
          descontoVista: 4,
          parcelasConsumo: 24,
          valorParcela: 4300
        }
      },
      consumo_pontual: {
        label: 'Consumo pontual',
        description: 'Compara CDC, pagamento a vista e parcelamento para uma compra menor com impacto de reserva.',
        productIds: ['cdc'],
        fields: {
          includeFinanciamento: false,
          includeConsorcio: false,
          includeCdc: true,
          includeGarantia: false,
          includeConsignado: false,
          includeConsumo: true,
          urgencia: 'alta',
          prioridade: 'liquidez',
          valorBem: 12000,
          entrada: 0,
          valorCredito: 12000,
          prazoCredito: 12,
          taxaCdcMes: 3.2,
          tarifasCdc: 300,
          precoCheio: 12000,
          descontoVista: 8,
          parcelasConsumo: 12,
          valorParcela: 1050
        }
      }
    };
  }

  function normalizeComparatorPreset(value) {
    const map = comparatorPresetMap();
    const raw = String(value || '').trim().toLowerCase().replace(/-/g, '_');
    const aliases = {
      comprar: 'comprar_bem',
      compra: 'comprar_bem',
      comprar_bem: 'comprar_bem',
      liquidez: 'obter_liquidez',
      obter_liquidez: 'obter_liquidez',
      veiculo: 'trocar_veiculo',
      veiculos: 'trocar_veiculo',
      auto: 'trocar_veiculo',
      trocar: 'trocar_veiculo',
      trocar_veiculo: 'trocar_veiculo',
      consumo: 'consumo_pontual',
      consumo_pontual: 'consumo_pontual',
      manual: 'manual'
    };
    const key = aliases[raw] || raw;
    return map[key] ? key : '';
  }

  function comparatorPresetFromUrl() {
    try {
      const params = new URLSearchParams(location.search || '');
      return normalizeComparatorPreset(params.get('preset') || params.get('objetivo') || params.get('produto'));
    } catch (error) {
      return '';
    }
  }

  function comparatorProductsFromUrl() {
    try {
      const params = new URLSearchParams(location.search || '');
      const raw = String(params.get('products') || params.get('produtos') || '').trim();
      if (!raw) return [];
      const valid = new Set(['financiamento', 'consorcio', 'cdc', 'garantia', 'consignado', 'veiculos', 'consumo']);
      const ids = [];
      raw.split(/[,\s|]+/).forEach((item) => {
        const id = String(item || '').trim().toLowerCase();
        if (valid.has(id) && !ids.includes(id)) ids.push(id);
      });
      return ids;
    } catch (error) {
      return [];
    }
  }

  function comparatorFieldsForProduct(id) {
    const map = {
      financiamento: ['includeFinanciamento'],
      consorcio: ['includeConsorcio'],
      cdc: ['includeCdc'],
      garantia: ['includeGarantia'],
      consignado: ['includeConsignado'],
      veiculos: ['includeFinanciamento', 'includeConsorcio', 'includeConsumo'],
      consumo: ['includeConsumo']
    };
    return map[id] || [];
  }

  function applyComparatorProductSelection(form, ids, products) {
    if (!form || !Array.isArray(ids) || ids.length === 0) return [];
    const fields = ['includeFinanciamento', 'includeConsorcio', 'includeCdc', 'includeGarantia', 'includeConsignado', 'includeConsumo'];
    fields.forEach((field) => setComparatorField(form, field, false));
    ids.forEach((id) => comparatorFieldsForProduct(id).forEach((field) => setComparatorField(form, field, true)));
    const select = qs('select[data-comparator-preset]');
    if (select) select.value = 'manual';
    setComparatorField(form, 'presetObjetivo', 'manual');
    document.body.dataset.comparatorFromProducts = ids.join(',');
    recordJourneyEvent('comparator_loaded_from_products', {
      productIds: ids,
      productNames: ids.map((id) => productNameById(id, products))
    });
    renderComparatorPresetSummary(
      form,
      products,
      `Produtos carregados do catalogo: ${ids.map((id) => productNameById(id, products)).join(', ')}.`
    );
    return ids;
  }

  function favoritePresetStorageKey() {
    return scopedStorageKey(COMPARATOR_FAVORITE_PRESET_KEY);
  }

  function comparatorModelsStorageKey() {
    return scopedStorageKey(COMPARATOR_MODELS_KEY);
  }

  function comparatorAuditStorageKey() {
    return COMPARATOR_MODEL_AUDIT_KEY;
  }

  function loadFavoriteComparatorPreset() {
    const favorite = readJson(favoritePresetStorageKey(), null);
    if (!favorite || typeof favorite !== 'object') return null;
    const preset = normalizeComparatorPreset(favorite.preset);
    return preset ? { ...favorite, preset } : null;
  }

  function saveFavoriteComparatorPreset(preset) {
    const normalized = normalizeComparatorPreset(preset);
    if (!normalized || normalized === 'manual') return false;
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return writeJson(favoritePresetStorageKey(), {
      preset: normalized,
      label: comparatorPresetMap()[normalized].label,
      userEmail: user && user.email ? user.email : 'anon',
      updatedAt: new Date().toISOString()
    });
  }

  function normalizeComparatorModels(value) {
    if (!Array.isArray(value)) return [];
    return value
      .filter((model) => model && typeof model === 'object' && model.id && model.fields)
      .map((model) => ({
        ...model,
        name: String(model.name || 'Modelo sem nome').slice(0, 72),
        preset: normalizeComparatorPreset(model.preset) || 'manual',
        fields: model.fields || {},
        productIds: Array.isArray(model.productIds) ? model.productIds : [],
        source: model.source || 'local',
        formulaVersion: model.formulaVersion || COMPARATOR_FORMULA_VERSION,
        premiseReference: model.premiseReference || COMPARATOR_PREMISES_REFERENCE,
        updatedAt: model.updatedAt || model.createdAt || new Date().toISOString(),
        createdAt: model.createdAt || model.updatedAt || new Date().toISOString()
      }))
      .slice(0, MAX_COMPARATOR_MODELS);
  }

  function loadComparatorModels() {
    return normalizeComparatorModels(readJson(comparatorModelsStorageKey(), []));
  }

  function saveComparatorModels(models) {
    return writeJson(comparatorModelsStorageKey(), normalizeComparatorModels(models).slice(0, MAX_COMPARATOR_MODELS));
  }

  function allComparatorModels() {
    const prefix = `${COMPARATOR_MODELS_KEY}:`;
    const models = [];
    try {
      Object.keys(localStorage).forEach((key) => {
        if (!key.startsWith(prefix)) return;
        const scope = key.slice(prefix.length);
        normalizeComparatorModels(readJson(key, [])).forEach((model) => models.push({ ...model, storageScope: scope, storageKey: key }));
      });
    } catch (error) {
      return [];
    }
    return models.sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || ''))).slice(0, 80);
  }

  function findComparatorModel(id) {
    const targetId = String(id || '').trim();
    if (!targetId) return null;
    return loadComparatorModels().find((model) => model.id === targetId) || null;
  }

  function comparatorModelFromUrl() {
    try {
      const params = new URLSearchParams(location.search || '');
      return String(params.get('modelo') || params.get('model') || '').trim();
    } catch (error) {
      return '';
    }
  }

  function selectedComparatorProductIds(fields) {
    const pairs = [
      ['includeFinanciamento', 'financiamento'],
      ['includeConsorcio', 'consorcio'],
      ['includeCdc', 'cdc'],
      ['includeGarantia', 'garantia'],
      ['includeConsignado', 'consignado'],
      ['includeConsumo', 'consumo']
    ];
    return pairs
      .filter(([field]) => fields[field] === true || fields[field] === 1 || fields[field] === '1' || fields[field] === 'on' || fields[field] === 'true')
      .map(([, id]) => id);
  }

  function modelNameFallback(preset) {
    const map = comparatorPresetMap();
    const label = map[preset] ? map[preset].label : 'Manual';
    return `Modelo ${label}`;
  }

  function saveComparatorModel(form) {
    if (!form) return null;
    const select = qs('select[data-comparator-preset]');
    const nameInput = qs('[data-comparator-model-name]');
    const fields = formData(form);
    const preset = normalizeComparatorPreset(select ? select.value : fields.presetObjetivo) || 'manual';
    fields.presetObjetivo = preset;
    const rawName = nameInput ? nameInput.value : '';
    const name = String(rawName || modelNameFallback(preset)).trim().slice(0, 72) || modelNameFallback(preset);
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    const now = new Date().toISOString();
    const models = loadComparatorModels();
    const existingIndex = models.findIndex((model) => model.name.toLowerCase() === name.toLowerCase());
    const previous = existingIndex >= 0 ? models[existingIndex] : null;
    const model = {
      id: previous ? previous.id : `MDL-${Date.now().toString(36).toUpperCase()}`,
      name,
      preset,
      fields,
      productIds: selectedComparatorProductIds(fields),
      userEmail: user && user.email ? user.email : 'anon',
      source: previous ? previous.source || 'local' : 'local',
      formulaVersion: COMPARATOR_FORMULA_VERSION,
      premiseReference: COMPARATOR_PREMISES_REFERENCE,
      createdAt: previous ? previous.createdAt : now,
      updatedAt: now
    };
    const next = previous
      ? models.map((item, index) => (index === existingIndex ? model : item))
      : [model].concat(models);
    const saved = saveComparatorModels(next);
    if (saved) recordComparatorModelAudit(previous ? 'update' : 'create', model, { storageKey: comparatorModelsStorageKey() });
    return saved ? model : null;
  }

  function deleteComparatorModel(id) {
    const current = loadComparatorModels();
    const removed = current.find((model) => model.id === id);
    const next = current.filter((model) => model.id !== id);
    const saved = saveComparatorModels(next);
    if (saved && removed) recordComparatorModelAudit('delete', removed, { storageKey: comparatorModelsStorageKey() });
    return saved;
  }

  function currentComparatorOwner() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return user && user.email ? user.email : 'anon';
  }

  function recordComparatorModelAudit(action, model, extra = {}) {
    const audit = readJson(comparatorAuditStorageKey(), []);
    const current = Array.isArray(audit) ? audit : [];
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    const entry = {
      id: `AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      action,
      entity: 'comparator-model',
      modelId: model && model.id ? model.id : '',
      modelName: model && model.name ? model.name : '',
      preset: model && model.preset ? model.preset : 'manual',
      productIds: model && model.productIds ? model.productIds : [],
      ownerEmail: model && model.userEmail ? model.userEmail : currentComparatorOwner(),
      actorEmail: user && user.email ? user.email : currentComparatorOwner(),
      actorRole: user && user.role ? user.role : 'anon',
      formulaVersion: model && model.formulaVersion ? model.formulaVersion : COMPARATOR_FORMULA_VERSION,
      premiseReference: model && model.premiseReference ? model.premiseReference : COMPARATOR_PREMISES_REFERENCE,
      createdAt: new Date().toISOString(),
      details: extra || {}
    };
    writeJson(comparatorAuditStorageKey(), [entry].concat(current).slice(0, MAX_COMPARATOR_AUDIT));
    publishBackendEvent(`comparator-model:${action}`, entry, {
      source: 'comparator-model-audit',
      ownerEmail: entry.ownerEmail,
      actorEmail: entry.actorEmail,
      entityType: entry.entity,
      entityId: entry.modelId,
      createdAt: entry.createdAt
    });
    return entry;
  }

  function loadComparatorModelAudit() {
    const audit = readJson(comparatorAuditStorageKey(), []);
    return Array.isArray(audit) ? audit.slice(0, MAX_COMPARATOR_AUDIT) : [];
  }

  function exportComparatorModelsPackage() {
    const models = loadComparatorModels();
    const owner = currentComparatorOwner();
    return {
      schema: COMPARATOR_MODELS_SCHEMA,
      exportedAt: new Date().toISOString(),
      ownerEmail: owner,
      source: 'bank-fratern-local',
      formulaVersion: COMPARATOR_FORMULA_VERSION,
      premiseReference: COMPARATOR_PREMISES_REFERENCE,
      models: models.map((model) => ({
        ...model,
        formulaVersion: model.formulaVersion || COMPARATOR_FORMULA_VERSION,
        premiseReference: model.premiseReference || COMPARATOR_PREMISES_REFERENCE
      }))
    };
  }

  function parseComparatorModelsPackage(value) {
    const parsed = typeof value === 'string' ? JSON.parse(value) : value;
    if (Array.isArray(parsed)) {
      return {
        schema: COMPARATOR_MODELS_SCHEMA,
        source: 'array-import',
        formulaVersion: COMPARATOR_FORMULA_VERSION,
        premiseReference: COMPARATOR_PREMISES_REFERENCE,
        models: parsed
      };
    }
    if (!parsed || typeof parsed !== 'object' || !Array.isArray(parsed.models)) {
      throw new Error('Pacote de modelos invalido.');
    }
    return parsed;
  }

  function importComparatorModelsPackage(value) {
    const pack = parseComparatorModelsPackage(value);
    const owner = currentComparatorOwner();
    const now = new Date().toISOString();
    const imported = normalizeComparatorModels(pack.models).map((model) => ({
      ...model,
      id: model.id || `MDL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      userEmail: owner,
      source: `import:${pack.source || pack.schema || 'json'}`,
      formulaVersion: model.formulaVersion || pack.formulaVersion || COMPARATOR_FORMULA_VERSION,
      premiseReference: model.premiseReference || pack.premiseReference || COMPARATOR_PREMISES_REFERENCE,
      updatedAt: now
    }));
    if (imported.length === 0) throw new Error('Nenhum modelo valido encontrado no pacote.');

    const current = loadComparatorModels();
    const merged = current.slice();
    imported.forEach((model) => {
      const index = merged.findIndex((item) => item.id === model.id || item.name.toLowerCase() === model.name.toLowerCase());
      if (index >= 0) merged[index] = { ...merged[index], ...model, createdAt: merged[index].createdAt || model.createdAt };
      else merged.unshift(model);
    });
    const saved = saveComparatorModels(merged);
    if (!saved) throw new Error('Nao foi possivel gravar os modelos importados.');
    imported.forEach((model) => recordComparatorModelAudit('import', model, {
      schema: pack.schema || 'unknown',
      importedCount: imported.length,
      storageKey: comparatorModelsStorageKey()
    }));
    return { count: imported.length, models: imported };
  }

  function cloneStandardComparatorModel(template) {
    if (!template || typeof template !== 'object') throw new Error('Modelo padrao invalido.');
    const owner = currentComparatorOwner();
    const now = new Date().toISOString();
    const preset = normalizeComparatorPreset(template.preset) || 'manual';
    const model = {
      id: `MDL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      name: template.name || modelNameFallback(preset),
      preset,
      fields: { ...(template.fields || {}), presetObjetivo: preset },
      productIds: Array.isArray(template.productIds) ? template.productIds : selectedComparatorProductIds(template.fields || {}),
      source: `standard:${template.id || template.name || 'library'}`,
      standardId: template.id || '',
      userEmail: owner,
      formulaVersion: COMPARATOR_FORMULA_VERSION,
      premiseReference: COMPARATOR_PREMISES_REFERENCE,
      governanceStatus: 'draft',
      createdAt: now,
      updatedAt: now
    };
    const current = loadComparatorModels();
    const saved = saveComparatorModels([model].concat(current));
    if (!saved) throw new Error('Nao foi possivel clonar o modelo padrao.');
    recordComparatorModelAudit('clone-standard', model, {
      standardId: template.id || '',
      standardName: template.name || '',
      storageKey: comparatorModelsStorageKey()
    });
    return model;
  }

  function comparatorModelQuality(model) {
    const fields = model && model.fields ? model.fields : {};
    const risks = [];
    let score = 0;
    if (model && model.name && model.name.length >= 6) score += 12;
    else risks.push('Nome pouco descritivo.');
    if (model && model.preset && model.preset !== 'manual') score += 14;
    else risks.push('Modelo manual sem preset base.');
    if (model && Array.isArray(model.productIds) && model.productIds.length >= 2) score += 18;
    else risks.push('Poucas colunas de produto ativas.');
    if (fields.rendaMensal && fields.gastoMensal && fields.reservaAtual) score += 18;
    else risks.push('Perfil financeiro incompleto.');
    if (model && model.formulaVersion === COMPARATOR_FORMULA_VERSION) score += 18;
    else risks.push('Versao de formula diferente da atual.');
    if (model && model.premiseReference === COMPARATOR_PREMISES_REFERENCE) score += 12;
    else risks.push('Referencia de premissas diferente da atual.');
    if (model && model.source) score += 8;
    else risks.push('Origem do modelo nao registrada.');

    const capped = Math.max(0, Math.min(100, score));
    return {
      score: capped,
      tone: capped >= 80 ? 'success' : capped >= 58 ? 'warn' : 'danger',
      label: capped >= 80 ? 'Pronto para publicar' : capped >= 58 ? 'Revisar antes de publicar' : 'Precisa de ajustes',
      risks
    };
  }

  function updateComparatorModelGovernance(modelId, storageScope, patch) {
    const scope = String(storageScope || currentComparatorOwner()).trim() || 'anon';
    const key = `${COMPARATOR_MODELS_KEY}:${scope}`;
    const current = normalizeComparatorModels(readJson(key, []));
    const index = current.findIndex((model) => model.id === modelId);
    if (index < 0) return { ok: false, message: 'Modelo nao encontrado.' };
    const now = new Date().toISOString();
    const nextModel = {
      ...current[index],
      ...(patch || {}),
      updatedAt: now,
      governanceUpdatedAt: now
    };
    current[index] = nextModel;
    const saved = writeJson(key, current);
    if (!saved) return { ok: false, message: 'Nao foi possivel atualizar a governanca.' };
    recordComparatorModelAudit(`governance:${nextModel.governanceStatus || 'review'}`, nextModel, { storageKey: key, storageScope: scope });
    return { ok: true, message: 'Governanca do modelo atualizada.', model: nextModel };
  }

  function applyComparatorModel(form, model, products, statusMessage = '') {
    const select = qs('select[data-comparator-preset]');
    if (!form || !model || !select) return false;
    const preset = normalizeComparatorPreset(model.preset) || 'manual';
    select.value = preset;
    Object.entries(model.fields || {}).forEach(([name, value]) => setComparatorField(form, name, value));
    document.body.dataset.comparatorActivePreset = preset;
    document.body.dataset.comparatorModel = model.id;
    delete document.body.dataset.comparatorFromProducts;
    renderComparatorPresetSummary(form, products, statusMessage || `Modelo aplicado: ${model.name}.`);
    return true;
  }

  function setComparatorField(form, name, value) {
    const raw = form.elements[name];
    const fields = raw && typeof raw.length === 'number' && raw[0] && raw[0].name === name ? Array.from(raw) : (raw ? [raw] : []);
    if (fields.length === 0) return;
    fields.forEach((field) => {
      if (field.type === 'checkbox') {
        field.checked = value === true || value === 1 || value === '1' || value === 'on' || value === 'true' || value === 'yes';
      } else if (field.type !== 'hidden') {
        field.value = value;
      }
    });
  }

  function renderComparatorPresetSummary(form, products, statusMessage = '') {
    const target = qs('[data-comparator-preset-summary]');
    const select = qs('select[data-comparator-preset]');
    if (!target || !select) return;
    const preset = comparatorPresetMap()[select.value] || comparatorPresetMap().manual;
    const favorite = loadFavoriteComparatorPreset();
    const models = loadComparatorModels();
    const activeModel = findComparatorModel(document.body.dataset.comparatorModel);
    const sourceIds = document.body.dataset.comparatorFromProducts
      ? document.body.dataset.comparatorFromProducts.split(',').map((id) => id.trim()).filter(Boolean)
      : ((preset.productIds || []).length ? preset.productIds : selectedComparatorProductIds(numberFields(formData(form))));
    const productNames = sourceIds
      .map((id) => `<span>${escapeHtml(productNameById(id, products))}</span>`)
      .join('');
    const modelList = models.length === 0
      ? '<div class="bf-comparator-model-empty">Nenhum modelo nomeado salvo ainda.</div>'
      : models.slice(0, 4).map((model) => `
        <article class="bf-comparator-model-item" data-comparator-model-item="${escapeHtml(model.id)}">
          <div>
            <strong>${escapeHtml(model.name)}</strong>
            <small>${escapeHtml((comparatorPresetMap()[model.preset] || comparatorPresetMap().manual).label)} - ${escapeHtml((model.productIds || []).join(', ') || 'manual')}</small>
          </div>
          <div class="bf-comparator-model-actions">
            <a class="btn btn--ghost btn--sm" href="comparador.html?modelo=${encodeURIComponent(model.id)}">Abrir</a>
            <button class="btn btn--ghost btn--sm" type="button" data-comparator-apply-model="${escapeHtml(model.id)}">Aplicar</button>
            <button class="btn btn--ghost btn--sm" type="button" data-comparator-delete-model="${escapeHtml(model.id)}">Excluir</button>
          </div>
        </article>
      `).join('');
    target.innerHTML = `
      <strong>${escapeHtml(preset.label)}</strong>
      <p>${escapeHtml(preset.description)}</p>
      <div class="bf-comparator-preset-chips">${productNames || '<span>Colunas manuais</span>'}</div>
      <div class="bf-comparator-preset-actions">
        <button class="btn btn--ghost btn--sm" type="button" data-comparator-save-favorite>Salvar favorito</button>
        <button class="btn btn--ghost btn--sm" type="button" data-comparator-use-favorite${favorite ? '' : ' disabled'}>${favorite ? `Usar favorito: ${escapeHtml(favorite.label)}` : 'Sem favorito'}</button>
      </div>
      <div class="bf-comparator-model-maker">
        <label>Nome do modelo
          <input type="text" data-comparator-model-name value="${activeModel ? escapeHtml(activeModel.name) : ''}" placeholder="${escapeHtml(modelNameFallback(select.value))}">
        </label>
        <button class="btn btn--primary btn--sm" type="button" data-comparator-save-model>Salvar modelo</button>
      </div>
      <div class="bf-comparator-model-exchange">
        <div class="bf-comparator-model-exchange__actions">
          <button class="btn btn--ghost btn--sm" type="button" data-comparator-export-models>Exportar JSON</button>
          <button class="btn btn--ghost btn--sm" type="button" data-comparator-import-models>Importar JSON</button>
        </div>
        <textarea data-comparator-model-json rows="4" placeholder="Cole aqui um pacote JSON de modelos ou clique em Exportar JSON para gerar o pacote local."></textarea>
      </div>
      <div class="bf-comparator-model-list" data-comparator-model-list>${modelList}</div>
      <div class="bf-comparator-preset-status" data-comparator-preset-status>${escapeHtml(statusMessage || (favorite ? `Favorito salvo: ${favorite.label}` : 'Nenhum preset favorito salvo para este usuario.'))}</div>
    `;
  }

  function applyComparatorPreset(form, products, force = false) {
    const select = qs('select[data-comparator-preset]');
    if (!form || !select) return;
    const preset = comparatorPresetMap()[select.value] || comparatorPresetMap().manual;
    if (select.value !== 'manual' || force) {
      Object.entries(preset.fields || {}).forEach(([name, value]) => setComparatorField(form, name, value));
    }
    delete document.body.dataset.comparatorFromProducts;
    renderComparatorPresetSummary(form, products);
  }

  function bindComparatorPresets(form, products) {
    const select = qs('select[data-comparator-preset]');
    if (!form || !select) return;
    const requestedPreset = comparatorPresetFromUrl();
    const requestedModel = findComparatorModel(comparatorModelFromUrl());
    const requestedProducts = comparatorProductsFromUrl();
    if (requestedPreset && comparatorPresetMap()[requestedPreset]) {
      select.value = requestedPreset;
      applyComparatorPreset(form, products, true);
      document.body.dataset.comparatorActivePreset = requestedPreset;
    }
    if (requestedModel) {
      applyComparatorModel(form, requestedModel, products, `Modelo aberto: ${requestedModel.name}.`);
    }
    if (requestedProducts.length > 0) {
      applyComparatorProductSelection(form, requestedProducts, products);
      document.body.dataset.comparatorActivePreset = 'manual';
    }
    select.addEventListener('change', () => {
      delete document.body.dataset.comparatorModel;
      delete document.body.dataset.comparatorFromProducts;
      applyComparatorPreset(form, products, false);
      document.body.dataset.comparatorActivePreset = select.value;
      form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    });
    bindComparatorPresetActions(form, products);
    renderComparatorPresetSummary(
      form,
      products,
      requestedProducts.length > 0
        ? `Produtos carregados do catalogo: ${requestedProducts.map((id) => productNameById(id, products)).join(', ')}.`
        : (requestedModel ? `Modelo aberto: ${requestedModel.name}.` : '')
    );
  }

  function bindComparatorPresetActions(form, products) {
    const target = qs('[data-comparator-preset-summary]');
    const select = qs('select[data-comparator-preset]');
    if (!target || !select || target.dataset.bound === 'true') return;
    target.dataset.bound = 'true';
    target.addEventListener('click', (event) => {
      const saveButton = event.target.closest('[data-comparator-save-favorite]');
      const useButton = event.target.closest('[data-comparator-use-favorite]');
      const saveModelButton = event.target.closest('[data-comparator-save-model]');
      const applyModelButton = event.target.closest('[data-comparator-apply-model]');
      const deleteModelButton = event.target.closest('[data-comparator-delete-model]');
      const exportModelsButton = event.target.closest('[data-comparator-export-models]');
      const importModelsButton = event.target.closest('[data-comparator-import-models]');
      if (saveButton) {
        const saved = saveFavoriteComparatorPreset(select.value);
        renderComparatorPresetSummary(form, products);
        const nextStatus = qs('[data-comparator-preset-status]');
        if (nextStatus) nextStatus.textContent = saved ? 'Preset favorito salvo para este usuario.' : 'Escolha um preset diferente de Manual para salvar.';
      }
      if (useButton) {
        const favorite = loadFavoriteComparatorPreset();
        if (!favorite) return;
        select.value = favorite.preset;
        applyComparatorPreset(form, products, true);
        document.body.dataset.comparatorActivePreset = favorite.preset;
        const nextStatus = qs('[data-comparator-preset-status]');
        if (nextStatus) nextStatus.textContent = `Favorito aplicado: ${favorite.label}.`;
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      if (saveModelButton) {
        const model = saveComparatorModel(form);
        if (model) document.body.dataset.comparatorModel = model.id;
        renderComparatorPresetSummary(form, products, model ? `Modelo salvo: ${model.name}.` : 'Nao foi possivel salvar o modelo neste navegador.');
      }
      if (applyModelButton) {
        const model = findComparatorModel(applyModelButton.dataset.comparatorApplyModel);
        if (!model) return;
        applyComparatorModel(form, model, products, `Modelo aplicado: ${model.name}.`);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      }
      if (deleteModelButton) {
        const id = deleteModelButton.dataset.comparatorDeleteModel;
        if (!window.confirm('Remover este modelo da lista local?')) return;
        const removed = deleteComparatorModel(id);
        if (document.body.dataset.comparatorModel === id) delete document.body.dataset.comparatorModel;
        renderComparatorPresetSummary(form, products, removed ? 'Modelo removido da lista local.' : 'Nao foi possivel remover o modelo.');
      }
      if (exportModelsButton) {
        const box = qs('[data-comparator-model-json]');
        const pack = exportComparatorModelsPackage();
        if (box) box.value = JSON.stringify(pack, null, 2);
        recordComparatorModelAudit('export', { id: 'export', name: 'Pacote de modelos', preset: select.value, productIds: [], userEmail: currentComparatorOwner() }, { exportedCount: pack.models.length });
        const status = qs('[data-comparator-preset-status]');
        if (status) status.textContent = `Pacote JSON gerado com ${pack.models.length} modelo(s).`;
      }
      if (importModelsButton) {
        const box = qs('[data-comparator-model-json]');
        try {
          const result = importComparatorModelsPackage(box ? box.value : '');
          renderComparatorPresetSummary(form, products, `${result.count} modelo(s) importado(s) para este usuario.`);
        } catch (error) {
          const status = qs('[data-comparator-preset-status]');
          if (status) status.textContent = error.message || 'Nao foi possivel importar o pacote JSON.';
        }
      }
    });
  }

  function prefillComparatorProfile(form) {
    const profile = readJson(PROFILE_KEY, {});
    const pairs = [
      ['rendaMensal', 'rendaMensal'],
      ['gastoMensal', 'gastoMensal'],
      ['dividasMensais', 'dividasMensais'],
      ['reservaAtual', 'reservaAtual']
    ];
    pairs.forEach(([field, key]) => {
      if (!form.elements[field] || !profile[key]) return;
      form.elements[field].value = profile[key];
    });
  }

  function bindComparator(products, standardModels) {
    const form = qs('[data-comparator-form]');
    const target = qs('[data-comparator-result]');
    if (!form || !target) return;
    prefillComparatorProfile(form);
    bindComparatorPresets(form, products || []);
    bindComparatorModelRecommendation(form, products || [], standardModels || []);
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const result = window.BFComparadorService.compareDefault(numberFields(formData(form)));
      recordJourneyEvent('comparator_calculated', {
        productIds: selectedComparatorProductIds(numberFields(formData(form))),
        comparedCount: result.summaries ? result.summaries.length : 0,
        winner: result.decision ? result.decision.label : '',
        trusted: event.isTrusted === true
      });
      renderComparatorProfile(result.profile);
      renderComparatorModelRecommendation(form, standardModels || [], result.profile);
      target.innerHTML = renderComparatorDecision(result) + window.BFTables.comparison(result.summaries);
      updateComparatorBridge(result);
      bindComparatorSave(target, result);
      bindComparatorResultActions(target);
    });
    form.dispatchEvent(new Event('submit'));
  }

  function bindRecommendation(products) {
    const form = qs('[data-recommendation-form]');
    const target = qs('[data-recommendation-result]');
    if (!form || !target) return;
    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const profile = window.BFValidators.profile(formData(form));
      const list = window.BFRecomendacaoService.recommend(profile, products);
      target.innerHTML = list.slice(0, 4).map(window.BFCards.product).join('');
    });
    form.dispatchEvent(new Event('submit'));
  }

  function renderResultCards(result) {
    const f = fmt();
    return `
      <div class="bf-platform-metrics">
        ${window.BFCards.metric('Total pago', f.currency(result.totalPago), 'is-strong')}
        ${window.BFCards.metric('1a parcela', f.currency(result.primeiraParcela))}
        ${window.BFCards.metric('Prazo', f.months(result.prazo))}
      </div>
    `;
  }

  function renderBest(result) {
    const f = fmt();
    if (!result.best) return '';
    return `
      <div class="bf-platform-alert bf-platform-alert--success">
        Melhor custo no cenario: <strong>${result.best.label}</strong>, total estimado de ${f.currency(result.best.totalPago)}.
      </div>
    `;
  }

  function renderComparatorProfile(profile) {
    const target = qs('[data-comparator-profile-summary]');
    if (!target || !profile) return;
    const f = fmt();
    const hasProfile = profile.rendaMensal || profile.gastoMensal || profile.reservaAtual;
    target.innerHTML = `
      <div class="bf-comparator-profile">
        <div>
          <span class="bf-badge bf-badge--ok">Perfil usado na decisao</span>
          <h2>${hasProfile ? 'Perfil financeiro conectado' : 'Perfil demonstrativo'}</h2>
          <p>${hasProfile ? 'Renda, custos, dividas e reserva entram na recomendacao para evitar uma comparacao baseada apenas em menor preco.' : 'Informe renda, custos e reserva para transformar a comparacao em uma recomendacao personalizada.'}</p>
        </div>
        <div class="bf-comparator-profile__metrics">
          <div><small>Renda</small><strong>${profile.rendaMensal ? f.currency(profile.rendaMensal) : '-'}</strong></div>
          <div><small>Capacidade segura</small><strong>${profile.capacidadePagamento ? f.currency(profile.capacidadePagamento) : '-'}</strong></div>
          <div><small>Reserva</small><strong>${profile.reservaAtual ? f.currency(profile.reservaAtual) : '-'}</strong></div>
          <div><small>Urgencia</small><strong>${escapeHtml(profile.urgencia)}</strong></div>
        </div>
      </div>
    `;
  }

  function comparatorRecommendationProfile(form, resultProfile) {
    const data = form ? numberFields(formData(form)) : {};
    return {
      ...readJson(PROFILE_KEY, {}),
      ...data,
      ...(resultProfile || {}),
      presetObjetivo: data.presetObjetivo || (resultProfile && resultProfile.presetObjetivo) || comparatorPresetFromUrl()
    };
  }

  function standardProductLabels(ids) {
    const labels = {
      financiamento: 'Financiamento',
      consorcio: 'Consorcio',
      cdc: 'CDC',
      garantia: 'Credito com garantia',
      consignado: 'Consignado',
      consumo: 'Consumo parcelado',
      veiculos: 'Veiculos'
    };
    return (ids || []).map((id) => labels[id] || id);
  }

  function renderComparatorModelRecommendation(form, standardModels, resultProfile) {
    const target = qs('[data-comparator-model-recommendation]');
    if (!target) return;
    if (!standardModels || !standardModels.length || !window.BFModelosRecomendacaoService) {
      target.innerHTML = '';
      return;
    }

    const profile = comparatorRecommendationProfile(form, resultProfile);
    const recommended = window.BFModelosRecomendacaoService.best(standardModels, profile);
    if (!recommended) {
      target.innerHTML = '';
      return;
    }

    const productChips = standardProductLabels(recommended.productIds)
      .map((label) => `<span>${escapeHtml(label)}</span>`)
      .join('');
    const reasons = (recommended.recommendationReasons || [])
      .map((reason) => `<li>${escapeHtml(reason)}</li>`)
      .join('');
    const preset = comparatorPresetMap()[recommended.preset] || comparatorPresetMap().manual;
    document.body.dataset.comparatorRecommendedStandard = recommended.id;

    target.innerHTML = `
      <div class="bf-model-recommendation bf-model-recommendation--${escapeHtml(recommended.recommendationTone || 'info')}" data-comparator-standard-recommendation="${escapeHtml(recommended.id)}">
        <div>
          <span class="bf-badge bf-badge--ok">Modelo recomendado</span>
          <h2>${escapeHtml(recommended.name)}</h2>
          <p>${escapeHtml(recommended.description || preset.description)}</p>
          <div class="bf-standard-model-chips">${productChips}</div>
          <ul class="bf-standard-model-risks">${reasons}</ul>
          <div class="bf-inline-actions">
            <button class="btn btn--primary btn--sm" type="button" data-comparator-clone-standard-recommendation="${escapeHtml(recommended.id)}">Clonar e aplicar</button>
            <a class="btn btn--ghost btn--sm" href="modelos-biblioteca.html?recomendado=${encodeURIComponent(recommended.id)}">Ver biblioteca</a>
          </div>
          <small class="bf-standard-model-status" data-comparator-recommendation-status></small>
        </div>
        <div class="bf-model-recommendation__score">
          <small>Aderencia</small>
          <strong>${recommended.recommendationScore}/100</strong>
          <span>${escapeHtml(preset.label)}</span>
        </div>
      </div>
    `;
  }

  function bindComparatorModelRecommendation(form, products, standardModels) {
    const target = qs('[data-comparator-model-recommendation]');
    if (!target || target.dataset.bound === 'true') return;
    target.dataset.bound = 'true';
    target.addEventListener('click', (event) => {
      const button = event.target.closest('[data-comparator-clone-standard-recommendation]');
      if (!button || !window.BFComparatorModels || !window.BFComparatorModels.cloneStandard) return;
      const template = (standardModels || []).find((item) => item.id === button.dataset.comparatorCloneStandardRecommendation);
      if (!template) return;
      try {
        const model = window.BFComparatorModels.cloneStandard(template);
        applyComparatorModel(form, model, products || [], `Modelo recomendado aplicado: ${model.name}.`);
        form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
      } catch (error) {
        const status = target.querySelector('[data-comparator-recommendation-status]');
        if (status) status.textContent = error.message || 'Nao foi possivel aplicar o modelo recomendado.';
      }
    });
  }

  function comparatorDecisionCardTone(tone) {
    if (tone === 'warn' || tone === 'warning') return 'bf-v8-decision-card--warning';
    if (tone === 'success' || tone === 'stable') return 'bf-v8-decision-card--stable';
    return 'bf-v8-decision-card--info';
  }

  function comparatorPresetLabel(result) {
    const preset = normalizeComparatorPreset(result && result.input ? result.input.presetObjetivo : '');
    const item = comparatorPresetMap()[preset] || comparatorPresetMap().manual;
    return item.label;
  }

  function renderComparatorDecisionBridge(result) {
    const target = qs('[data-comparator-decision-strip]');
    if (!target || !result) return;
    const f = fmt();
    const decision = result.decision || {};
    const metrics = result.metrics || {};
    const summaries = result.summaries || [];
    const profile = result.profile || {};
    const modelId = document.body.dataset.comparatorModel || '';
    const risk = (result.risks || []).find((item) => item.tone === 'warn') || (result.risks || [])[0] || null;
    const safeCapacity = profile.capacidadePagamento ? f.currency(profile.capacidadePagamento) : 'nao informada';
    const decisionTone = comparatorDecisionCardTone(decision.tone);
    const riskTone = risk && risk.tone === 'warn' ? 'bf-v8-decision-card--warning' : 'bf-v8-decision-card--info';

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Comparador conectado</span>
        <div>
          <h2>${escapeHtml(decision.title || 'Decisao recomendada')}: ${escapeHtml(decision.label || 'em analise')}</h2>
          <p>${escapeHtml(decision.reason || 'A matriz usa perfil financeiro, prioridades, custo total, primeira parcela e riscos para orientar o proximo passo.')}</p>
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="#comparador-entrada">Ajustar matriz</a>
            <a class="btn btn--ghost btn--sm" href="dashboard-cliente.html#continuidade-cliente">Retomar no dashboard</a>
            <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#operacao-handoff">Preparar handoff</a>
          </div>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        <article class="bf-v8-decision-card bf-v8-decision-card--info">
          <span>Entrada</span>
          <strong>${summaries.length} produto${summaries.length === 1 ? '' : 's'}</strong>
          <p>${escapeHtml(comparatorPresetLabel(result))} com renda, custos, dividas e reserva reaproveitados.</p>
          <small>Capacidade segura: ${escapeHtml(safeCapacity)}</small>
        </article>
        <article class="bf-v8-decision-card ${decisionTone}">
          <span>Decisao</span>
          <strong>${escapeHtml(decision.label || '-')}</strong>
          <p>Menor custo: ${escapeHtml(f.currency(metrics.menorCusto || 0))}. Menor parcela: ${escapeHtml(f.currency(metrics.menorParcela || 0))}.</p>
          <small>Economia estimada: ${escapeHtml(f.currency(metrics.economia || 0))}</small>
        </article>
        <article class="bf-v8-decision-card ${riskTone}">
          <span>Risco</span>
          <strong>${escapeHtml(risk ? risk.title : 'Premissas educativas')}</strong>
          <p>${escapeHtml(risk ? risk.text : 'Sem alerta critico no cenario atual. Revise as premissas antes de contratar.')}</p>
          <small>${(result.risks || []).length} alerta${(result.risks || []).length === 1 ? '' : 's'} explicavel${(result.risks || []).length === 1 ? '' : 'is'}</small>
        </article>
        <article class="bf-v8-decision-card bf-v8-decision-card--stable">
          <span>Continuidade</span>
          <strong>${modelId ? 'Modelo salvo' : 'Cenario pronto'}</strong>
          <p>Salve o cenario, abra simuladores detalhados ou envie a leitura para dashboard e atendimento.</p>
          <small>${modelId ? `Modelo ${escapeHtml(modelId)}` : 'Historico local e dashboard conectados'}</small>
        </article>
      </div>
    `;
  }

  function renderComparatorBridgeTimeline(result) {
    const target = qs('[data-comparator-bridge-timeline]');
    if (!target || !result) return;
    const decision = result.decision || {};
    const summaries = result.summaries || [];
    const modelId = document.body.dataset.comparatorModel || document.body.dataset.comparatorRecommendedStandard || '';
    const memoryCount = (result.memory || []).length;
    const timeline = [
      {
        href: '#comparador-perfil',
        state: 'is-done',
        label: 'Perfil',
        title: 'Dados financeiros conectados',
        text: 'Renda, custos, dividas e reserva entram na capacidade segura.'
      },
      {
        href: '#comparador-entrada',
        state: 'is-done',
        label: 'Matriz',
        title: `${summaries.length} alternativas lado a lado`,
        text: 'Produtos ativos, preset e premissas ficam editaveis sem sair da pagina.'
      },
      {
        href: '#decisao-comparador',
        state: 'is-active',
        label: 'Decisao',
        title: decision.label || 'Recomendacao em analise',
        text: decision.reason || 'A recomendacao explica custo, urgencia, parcela e liquidez.'
      },
      {
        href: '#memoria-comparador',
        state: 'is-pending',
        label: 'Memoria',
        title: `${memoryCount} linhas de calculo`,
        text: 'A decisao guarda as premissas que justificam a matriz.'
      },
      {
        href: 'dashboard-cliente.html#continuidade-cliente',
        state: modelId ? 'is-done' : 'is-pending',
        label: 'Continuidade',
        title: modelId ? 'Modelo pronto para retomar' : 'Salvar e acompanhar',
        text: 'O dashboard e o handoff consultivo recebem o contexto do cenario.'
      }
    ];

    target.innerHTML = timeline.map((item, index) => `
      <a class="bf-client-timeline__item ${item.state}" href="${escapeHtml(item.href)}">
        <span>${index + 1}</span>
        <div>
          <small>${escapeHtml(item.label)}</small>
          <strong>${escapeHtml(item.title)}</strong>
          <p>${escapeHtml(item.text)}</p>
        </div>
      </a>
    `).join('');
  }

  function updateComparatorBridge(result) {
    renderComparatorDecisionBridge(result);
    renderComparatorBridgeTimeline(result);
    if (!result) return;
    document.body.dataset.comparatorBridgeReady = 'true';
    document.body.dataset.comparatorDecision = result.decision && result.decision.label ? result.decision.label : '';
    document.body.dataset.comparatorComparedCount = String((result.summaries || []).length);
  }

  function renderComparatorDecision(result) {
    const f = fmt();
    const decision = result.decision || {};
    const metrics = result.metrics || {};
    const tone = decision.tone === 'warn' ? 'is-warn' : 'is-strong';
    return `
      <section class="bf-comparator-decision" data-comparator-decision>
        <div class="bf-comparator-decision__main">
          <span class="bf-badge bf-badge--gold">Decisao recomendada</span>
          <h2>${escapeHtml(decision.title)}: ${escapeHtml(decision.label)}</h2>
          <p>${escapeHtml(decision.reason)}</p>
          <div class="bf-inline-actions">
            <button class="btn btn--primary btn--sm" type="button" data-comparator-save>Salvar cenario</button>
            ${renderComparatorActions(result.nextActions)}
          </div>
          <div class="bf-comparator-save-status" data-comparator-save-status></div>
        </div>
        <div class="bf-platform-metrics bf-comparator-metrics">
          ${window.BFCards.metric('Vencedor', escapeHtml(metrics.vencedor || decision.label || '-'), tone)}
          ${window.BFCards.metric('Menor custo', f.currency(metrics.menorCusto || 0))}
          ${window.BFCards.metric('Menor parcela', f.currency(metrics.menorParcela || 0))}
          ${window.BFCards.metric('Economia estimada', f.currency(metrics.economia || 0))}
        </div>
      </section>
      ${renderComparatorCards(result)}
      ${renderComparatorRisks(result.risks)}
      ${renderComparatorMemory(result.memory)}
      <h2 class="bf-comparator-table-title">Matriz lado a lado</h2>
    `;
  }

  function renderComparatorCards(result) {
    const f = fmt();
    const winner = result.decision ? result.decision.label : '';
    return `
      <div class="bf-comparator-card-grid">
        ${(result.summaries || []).map((item) => `
          <article class="bf-comparator-card ${item.label === winner ? 'is-winner' : ''}" data-comparison-card data-comparison-id="${escapeHtml(item.id || item.label)}">
            <span class="bf-badge ${item.label === winner ? 'bf-badge--ok' : 'bf-badge--navy'}">${item.label === winner ? 'Recomendado' : 'Alternativa'}</span>
            <h3>${escapeHtml(item.label)}</h3>
            <dl>
              <div><dt>Total pago</dt><dd>${f.currency(item.totalPago)}</dd></div>
              <div><dt>Primeira parcela</dt><dd>${f.currency(item.primeiraParcela)}</dd></div>
              <div><dt>Ultima parcela</dt><dd>${f.currency(item.ultimaParcela)}</dd></div>
              <div><dt>Prazo</dt><dd>${f.months(item.prazo)}</dd></div>
            </dl>
            ${item.note ? `<p class="bf-comparator-card__note">${escapeHtml(item.note)}</p>` : ''}
            ${item.href ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">Abrir simulador</a>` : ''}
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderComparatorRisks(risks) {
    return `
      <div class="bf-comparator-risk-grid">
        ${(risks || []).map((risk) => `
          <article class="bf-comparator-risk bf-comparator-risk--${escapeHtml(risk.tone || 'info')}">
            <strong>${escapeHtml(risk.title)}</strong>
            <p>${escapeHtml(risk.text)}</p>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderComparatorMemory(memory) {
    return `
      <article class="bf-comparator-memory" id="memoria-comparador">
        <span class="bf-badge bf-badge--navy">Memoria de calculo</span>
        <ul>${(memory || []).map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
      </article>
    `;
  }

  function renderComparatorActions(actions) {
    return (actions || []).map((action) => `
      <a class="btn btn--ghost btn--sm" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>
    `).join('');
  }

  function bindComparatorSave(target, result) {
    const button = target.querySelector('[data-comparator-save]');
    if (!button) return;
    button.addEventListener('click', () => {
      const saved = saveComparatorScenario(result);
      recordJourneyEvent('comparator_saved', {
        saved,
        winner: result.decision ? result.decision.label : '',
        comparedCount: result.summaries ? result.summaries.length : 0
      });
      const status = target.querySelector('[data-comparator-save-status]');
      if (status) {
        status.textContent = saved ? 'Cenario salvo no historico financeiro local.' : 'Nao foi possivel salvar neste navegador.';
        status.className = `bf-comparator-save-status ${saved ? 'is-success' : 'is-error'}`;
      }
    });
  }

  function bindComparatorResultActions(target) {
    if (!target || target.dataset.analyticsBound === 'true') return;
    target.dataset.analyticsBound = 'true';
    target.addEventListener('click', (event) => {
      const link = event.target.closest('a[href^="simulador-"]');
      if (!link) return;
      recordJourneyEvent('simulator_opened_from_comparator', {
        href: link.getAttribute('href') || '',
        simulator: (link.getAttribute('href') || '').replace('.html', '')
      });
    });
  }

  function saveComparatorScenario(result) {
    const profile = result.profile || {};
    const profilePatch = {
      rendaMensal: profile.rendaMensal || undefined,
      gastoMensal: profile.gastoMensal || undefined,
      dividasMensais: profile.dividasMensais || undefined,
      reservaAtual: profile.reservaAtual || undefined,
      capacidadePagamento: profile.capacidadePagamento || undefined,
      comprometimentoRenda: profile.comprometimentoRenda || undefined,
      updatedAt: new Date().toISOString()
    };
    writeJson(PROFILE_KEY, { ...readJson(PROFILE_KEY, {}), ...profilePatch });

    const history = readJson(HISTORY_KEY, []);
    const entry = {
      id: `CMP-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      calculatorSlug: 'comparador',
      calculatorName: 'Comparador de credito',
      input: result.input,
      metrics: [
        { label: 'Decisao', value: result.decision ? result.decision.label : '-' },
        { label: 'Menor custo', value: fmt().currency(result.metrics ? result.metrics.menorCusto : 0) },
        { label: 'Economia estimada', value: fmt().currency(result.metrics ? result.metrics.economia : 0) }
      ],
      recommendation: {
        title: result.decision ? result.decision.title : 'Comparacao salva',
        message: result.decision ? result.decision.reason : 'Cenario salvo para revisao.',
        tone: result.decision ? result.decision.tone : 'info',
        next: 'Reabrir o comparador ou validar simuladores detalhados.'
      },
      profilePatch
    };
    const next = [entry].concat(Array.isArray(history) ? history : []).slice(0, MAX_HISTORY);
    return writeJson(HISTORY_KEY, next);
  }

  window.BFProductsJourney = {
    compareHref: productsCompareContextHref,
    productHref: productContextHref,
    decorate: productWithJourney,
    params: productJourneyParams,
    selectionKey: productsSelectionStorageKey
  };

  window.BFComparatorModels = {
    list: loadComparatorModels,
    all: allComparatorModels,
    find: findComparatorModel,
    audit: loadComparatorModelAudit,
    exportPackage: exportComparatorModelsPackage,
    importPackage: importComparatorModelsPackage,
    cloneStandard: cloneStandardComparatorModel,
    quality: comparatorModelQuality,
    updateGovernance: updateComparatorModelGovernance,
    storageKey: comparatorModelsStorageKey,
    auditKey: comparatorAuditStorageKey,
    versions: {
      schema: COMPARATOR_MODELS_SCHEMA,
      formulaVersion: COMPARATOR_FORMULA_VERSION,
      premiseReference: COMPARATOR_PREMISES_REFERENCE
    },
    route(id) {
      return `comparador.html?modelo=${encodeURIComponent(id)}`;
    }
  };

  window.BFJourneyAnalytics = {
    key: journeyAnalyticsStorageKey,
    list: loadJourneyAnalytics,
    all: loadAllJourneyAnalytics,
    record: recordJourneyEvent,
    summary: journeyAnalyticsSummary,
    roleFunnel: journeyAnalyticsRoleFunnel,
    render: renderJourneyAnalyticsSections
  };

  function renderDashboards() {
    const statsTarget = qs('[data-dashboard-stats]');
    if (!statsTarget) return;
    const stats = window.Storage && window.Storage.getPortfolioStats ? window.Storage.getPortfolioStats() : { total: 0, cartaTotal: 0, ticketMedio: 0 };
    statsTarget.innerHTML = `
      <div class="bf-platform-metrics">
        ${window.BFCards.metric('Simulacoes salvas', stats.total || 0, 'is-strong')}
        ${window.BFCards.metric('Cartas mapeadas', fmt().currency(stats.cartaTotal || 0))}
        ${window.BFCards.metric('Ticket medio', fmt().currency(stats.ticketMedio || 0))}
      </div>
    `;
  }

  async function init() {
    const page = document.body.dataset.bfPage || '';
    const protectedPage = document.body.hasAttribute('data-auth-required')
      || document.body.hasAttribute('data-auth-roles');
    if (protectedPage) {
      if (!window.BFAuth || !window.BFAuth.ready) return;
      const authorized = await window.BFAuth.ready;
      if (!authorized) return;
    }

    let data = { produtos: [], glossario: [], indices: [], instituicoes: [], formulas: [], regras: {} };
    try {
      data = await window.BFDadosService.all();
    } catch (error) {
      console.warn(error);
    }

    renderProducts(data.produtos);
    bindProductsFilter(data.produtos);
    renderGlossary(data.glossario);
    renderDatasets(data);
    bindFinancing();
    bindCdc();
    bindGuarantee();
    bindConsigned();
    bindVehicle();
    bindComparator(data.produtos, data.modelosComparadorPadrao);
    bindRecommendation(data.produtos);
    renderDashboards();
    renderJourneyAnalyticsSections();

    document.body.dataset.platformReady = page || 'ready';
  }

  document.addEventListener('DOMContentLoaded', init);
})();
