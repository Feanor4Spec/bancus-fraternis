(function () {
  'use strict';

  function qs(selector, root = document) {
    return root.querySelector(selector);
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
    return window.BFFormatters ? window.BFFormatters.currency(value) : `R$ ${Number(value || 0).toFixed(2)}`;
  }

  function percent(value) {
    return window.BFFormatters ? window.BFFormatters.percent(value, 1) : `${Number(value || 0).toFixed(1)}%`;
  }

  function formData(form) {
    const data = {};
    new FormData(form).forEach((value, key) => {
      data[key] = value;
    });
    return data;
  }

  function setField(form, name, value) {
    const field = form.elements[name];
    if (!field || value === undefined || value === null || value === '') return;
    field.value = value;
  }

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem('bf_financial_profile_v1') || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function appendQuery(href, params) {
    const [pathPart, hashPart] = String(href || '').split('#');
    const [base, query = ''] = pathPart.split('?');
    const search = new URLSearchParams(query);
    Object.entries(params || {}).forEach(([key, value]) => {
      const text = Array.isArray(value)
        ? value.map((item) => String(item || '').trim()).filter(Boolean).join(',')
        : String(value == null ? '' : value).trim();
      if (text) search.set(key, text);
    });
    const nextQuery = search.toString();
    return `${base || 'trilha-decisao.html'}${nextQuery ? `?${nextQuery}` : ''}${hashPart ? `#${hashPart}` : ''}`;
  }

  function readSearchParams() {
    try {
      return new URLSearchParams(location.search || '');
    } catch (error) {
      return new URLSearchParams('');
    }
  }

  function compactList(value) {
    return String(value || '')
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
  }

  function normalizeToken(value) {
    return String(value || '').trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  function normalizeObjective(value) {
    const aliases = {
      comprar: 'comprar_bem',
      compra: 'comprar_bem',
      comprar_bem: 'comprar_bem',
      bem: 'comprar_bem',
      liquidez: 'obter_liquidez',
      obter_liquidez: 'obter_liquidez',
      credito: 'obter_liquidez',
      auto: 'trocar_veiculo',
      veiculo: 'trocar_veiculo',
      trocar_veiculo: 'trocar_veiculo',
      consumo: 'consumo_pontual',
      consumo_pontual: 'consumo_pontual'
    };
    return aliases[normalizeToken(value)] || '';
  }

  function journeyUrlContext() {
    const params = readSearchParams();
    return {
      from: params.get('from') || '',
      sourceFrom: params.get('sourceFrom') || '',
      productId: params.get('productId') || '',
      calculatorSlug: params.get('calculatorSlug') || '',
      historyId: params.get('historyId') || '',
      preset: params.get('preset') || '',
      journeyId: params.get('journeyId') || '',
      products: compactList(params.get('products') || '')
    };
  }

  function hasJourneyUrlContext(context = journeyUrlContext()) {
    return Boolean(
      context.from ||
      context.sourceFrom ||
      context.productId ||
      context.calculatorSlug ||
      context.historyId ||
      context.preset ||
      context.journeyId ||
      (context.products && context.products.length)
    );
  }

  function objectiveFromProduct(productId) {
    const map = {
      consorcio: 'comprar_bem',
      financiamento: 'comprar_bem',
      veiculos: 'trocar_veiculo',
      cdc: 'consumo_pontual',
      garantia: 'obter_liquidez',
      consignado: 'obter_liquidez'
    };
    return map[normalizeToken(productId)] || '';
  }

  function objectiveFromCalculator(slug) {
    const map = {
      custos_fixos: 'comprar_bem',
      capacidade_credito: 'comprar_bem',
      lance_consorcio: 'comprar_bem',
      compra_vista_parcelado: 'comprar_bem',
      alugar_financiar: 'comprar_bem',
      reserva_emergencia: 'obter_liquidez',
      pix_parcelado: 'obter_liquidez',
      cartoes: 'consumo_pontual'
    };
    return map[normalizeToken(slug)] || '';
  }

  function objectiveFromContext(context = journeyUrlContext()) {
    return normalizeObjective(context.preset) ||
      objectiveFromProduct(context.productId) ||
      objectiveFromCalculator(context.calculatorSlug) ||
      '';
  }

  function urgencyFromContext(context = journeyUrlContext()) {
    const productUrgency = {
      consorcio: 'baixa',
      financiamento: 'media',
      veiculos: 'media',
      cdc: 'alta',
      garantia: 'media',
      consignado: 'alta'
    };
    const calculatorUrgency = {
      reserva_emergencia: 'alta',
      pix_parcelado: 'alta',
      cartoes: 'alta',
      capacidade_credito: 'media',
      custos_fixos: 'media',
      lance_consorcio: 'baixa'
    };
    return productUrgency[normalizeToken(context.productId)] ||
      calculatorUrgency[normalizeToken(context.calculatorSlug)] ||
      '';
  }

  function applyContextDefaults(defaults, context = journeyUrlContext()) {
    const objective = objectiveFromContext(context);
    const urgency = urgencyFromContext(context);
    return {
      ...(defaults || {}),
      ...(objective ? { objetivo: objective } : {}),
      ...(urgency ? { urgencia: urgency } : {})
    };
  }

  function contextParams(journey, extra = {}) {
    const context = journeyUrlContext();
    const product = journey && journey.recommendedProduct ? journey.recommendedProduct : {};
    return {
      from: 'journey',
      sourceFrom: context.from || context.sourceFrom || '',
      productId: context.productId || product.id || '',
      calculatorSlug: context.calculatorSlug || '',
      historyId: context.historyId || '',
      preset: (journey && journey.objective) || normalizeObjective(context.preset) || objectiveFromContext(context),
      journeyId: (journey && journey.id) || context.journeyId || '',
      products: context.products || [],
      ...extra
    };
  }

  function journeyContextHref(href, journey, extra = {}) {
    return appendQuery(href || 'trilha-decisao.html', contextParams(journey, extra));
  }

  function setBodyContext(context = journeyUrlContext()) {
    if (!document.body) return;
    document.body.dataset.decisionJourneySource = context.from || context.sourceFrom || '';
    document.body.dataset.decisionJourneyProductContext = context.productId || '';
    document.body.dataset.decisionJourneyCalculatorContext = context.calculatorSlug || '';
    document.body.dataset.decisionJourneyHistoryContext = context.historyId || '';
    document.body.dataset.decisionJourneyUrlContext = hasJourneyUrlContext(context) ? 'true' : 'false';
  }

  function prefillForm(form, journey) {
    const context = journeyUrlContext();
    const profile = journey && journey.profile ? journey.profile : readProfile();
    const defaults = {
      objetivo: profile.presetObjetivo || profile.objetivo || 'obter_liquidez',
      urgencia: profile.urgencia || 'alta',
      prioridade: profile.prioridade || 'rapidez',
      risco: profile.risco || 'conservador',
      rendaMensal: profile.rendaMensal || 14000,
      gastoMensal: profile.gastoMensal || 7600,
      dividasMensais: profile.dividasMensais || 900,
      reservaAtual: profile.reservaAtual || 22000,
      valorObjetivo: profile.valorObjetivo || profile.valorBem || 80000,
      entrada: profile.entrada || 0
    };
    setBodyContext(context);
    Object.entries(applyContextDefaults(defaults, context)).forEach(([name, value]) => setField(form, name, value));
  }

  function metric(label, value, tone = '') {
    return `<div class="bf-platform-metric${tone ? ` is-${tone}` : ''}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></div>`;
  }

  function stepMarkup(step, journey) {
    const href = journey ? journeyContextHref(step.href, journey) : step.href;
    return `
      <article class="bf-journey-step bf-journey-step--${escapeHtml(step.status || 'next')}" data-journey-step="${escapeHtml(step.id)}">
        <div class="bf-journey-step__index">${escapeHtml(step.index)}</div>
        <div>
          <span>${escapeHtml((step.status || 'next').replace('attention', 'atencao').replace('active', 'agora').replace('done', 'ok').replace('next', 'proximo'))}</span>
          <h3>${escapeHtml(step.title)}</h3>
          <p>${escapeHtml(step.description)}</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="${escapeHtml(href)}">${escapeHtml(step.label)}</a>
      </article>
    `;
  }

  function productRankMarkup(journey) {
    const ranked = journey.rankedProducts || [];
    if (!ranked.length) return '<div class="bf-empty-state">Catalogo de produtos indisponivel para ranqueamento.</div>';
    return ranked.map((product) => `
      <article class="bf-history-item">
        <span>${escapeHtml(product.categoria || 'Produto')}</span>
        <strong>${escapeHtml(product.nome)} - ${escapeHtml(product.recommendationScore)}/100</strong>
        <small>${escapeHtml((product.recommendationReasons || []).join(' '))}</small>
        <a href="${escapeHtml(journeyContextHref(product.simulador || product.comparador || 'produtos.html', journey, { productId: product.id || '' }))}">Abrir rota</a>
      </article>
    `).join('');
  }

  function renderBridgeStrip(journey, handoff) {
    const target = qs('[data-journey-bridge-strip]');
    if (!target || !journey) return;
    const profile = journey.profile || {};
    const product = journey.recommendedProduct || {};
    const model = journey.recommendedModel || {};
    const metrics = journey.metrics || {};
    const next = journey.nextAction || {};
    const reserveMonths = Number(metrics.reservaMeses || profile.reservaMeses || 0);
    const reserveGap = Number(metrics.gapReserva || profile.gapReserva || 0);
    const cards = [
      {
        tone: profile.rendaMensal && profile.gastoMensal ? (reserveGap > 0 ? 'warning' : 'stable') : 'warning',
        eyebrow: 'Diagnóstico',
        title: profile.rendaMensal && profile.gastoMensal ? 'Perfil financeiro lido' : 'Perfil incompleto',
        body: profile.rendaMensal && profile.gastoMensal
          ? `Reserva de ${reserveMonths.toFixed(1)} meses e capacidade segura de ${money(metrics.capacidadePagamento || profile.capacidadePagamento || 0)}.`
          : 'Informe renda, custos, dividas e reserva antes de recomendar produto.',
        action: reserveGap > 0 ? 'Revisar reserva' : 'Perfil reutilizável'
      },
      {
        tone: product.nome && model.name ? 'stable' : 'info',
        eyebrow: 'Produto e modelo',
        title: product.nome ? product.nome : 'Produto pendente',
        body: model.name ? `Modelo recomendado: ${model.name}.` : 'A biblioteca de modelos sera usada para sugerir uma matriz comparativa.',
        action: product.simulador ? 'Simular produto' : 'Revisar catálogo'
      },
      {
        tone: next.href ? 'info' : 'warning',
        eyebrow: 'Comparador',
        title: next.title || 'Abrir matriz comparativa',
        body: `Preset ${journey.objectiveLabel || journey.objective || 'manual'} com credito alvo de ${money(metrics.valorCredito || profile.valorCredito || 0)}.`,
        action: next.label || 'Abrir comparador'
      },
      {
        tone: handoff ? 'stable' : 'warning',
        eyebrow: 'Handoff',
        title: handoff ? 'Atendimento criado' : 'Atendimento pendente',
        body: handoff
          ? `${handoff.id} em status ${(window.BFHandoffConsultivoService.statusLabels[handoff.status] || handoff.status)}.`
          : 'Gere o handoff local depois de revisar a trilha e a próxima ação.',
        action: handoff ? 'Acompanhar fila' : 'Gerar handoff'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Ponte de decisão</span>
        <div>
          <h2>Uma trilha, cinco destinos conectados.</h2>
          <p>Esta leitura transforma o diagnóstico em produto, comparador, dashboard e handoff operacional sem perder o contexto do usuário.</p>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        ${cards.map((card) => `
          <article class="bf-v8-decision-card bf-v8-decision-card--${card.tone}">
            <span>${escapeHtml(card.eyebrow)}</span>
            <strong>${escapeHtml(card.title)}</strong>
            <p>${escapeHtml(card.body)}</p>
            <small>${escapeHtml(card.action)}</small>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderBridgeTimeline(journey, handoff) {
    const target = qs('[data-journey-bridge-timeline]');
    if (!target || !journey) return;
    const profile = journey.profile || {};
    const product = journey.recommendedProduct || {};
    const model = journey.recommendedModel || {};
    const metrics = journey.metrics || {};
    const profileReady = Boolean(profile.rendaMensal && profile.gastoMensal);
    const productReady = Boolean(product.id);
    const modelReady = Boolean(model.id || model.name);
    const compareReady = Boolean(journey.nextAction && journey.nextAction.href);
    const steps = [
      {
        label: 'Diagnóstico',
        title: profileReady ? 'Perfil consolidado' : 'Completar perfil',
        text: profileReady ? `Comprometimento de ${percent(metrics.comprometimentoRenda || profile.comprometimentoRenda || 0)}.` : 'Renda e custos ainda precisam ser informados.',
        href: journeyContextHref('calculadora-custos-fixos.html', journey, { calculatorSlug: 'custos-fixos' }),
        status: profileReady ? 'done' : 'active'
      },
      {
        label: 'Produto',
        title: productReady ? product.nome : 'Escolher produto',
        text: productReady ? 'Produto ranqueado pelo objetivo e pela urgência.' : 'Revise o catálogo antes de comparar.',
        href: journeyContextHref(product.simulador || 'produtos.html', journey, { productId: product.id || '' }),
        status: productReady ? 'done' : (profileReady ? 'active' : 'pending')
      },
      {
        label: 'Modelo',
        title: modelReady ? model.name : 'Modelo pendente',
        text: modelReady ? 'Modelo padrão recomendado para a matriz.' : 'A biblioteca pode sugerir um preset comparativo.',
        href: journeyContextHref(model.id ? `modelos-biblioteca.html?recomendado=${encodeURIComponent(model.id)}` : 'modelos-biblioteca.html', journey),
        status: modelReady ? 'done' : (productReady ? 'active' : 'pending')
      },
      {
        label: 'Comparador',
        title: compareReady ? 'Matriz pronta' : 'Abrir comparador',
        text: compareReady ? 'A próxima ação já possui rota e contexto.' : 'Compare custo total, parcela, prazo e risco.',
        href: journeyContextHref(`comparador.html?preset=${encodeURIComponent(journey.objective || 'obter_liquidez')}`, journey),
        status: compareReady ? 'done' : (modelReady ? 'active' : 'pending')
      },
      {
        label: 'Handoff',
        title: handoff ? 'Atendimento operacional' : 'Preparar atendimento',
        text: handoff ? `${handoff.id} conectado à trilha.` : 'Gere handoff para consultor acompanhar checklist e status.',
        href: journeyContextHref('handoff-consultivo.html#operacao-handoff', journey),
        status: handoff ? 'done' : (compareReady ? 'active' : 'pending')
      }
    ];

    target.innerHTML = steps.map((step, index) => `
      <a class="bf-client-timeline__item is-${step.status}" href="${escapeHtml(step.href)}">
        <span>${index + 1}</span>
        <div>
          <small>${escapeHtml(step.label)}</small>
          <strong>${escapeHtml(step.title)}</strong>
          <p>${escapeHtml(step.text)}</p>
        </div>
      </a>
    `).join('');
  }

  function renderJourney(journey) {
    const summary = qs('[data-decision-journey-summary]');
    const steps = qs('[data-decision-journey-steps]');
    const actions = qs('[data-decision-journey-actions]');
    const state = qs('[data-decision-journey-state]');
    if (!journey || !summary || !steps || !actions) return;

    const product = journey.recommendedProduct || {};
    const model = journey.recommendedModel || {};
    const metrics = journey.metrics || {};
    const next = journey.nextAction || {};
    const handoffService = window.BFHandoffConsultivoService;
    const handoff = handoffService && handoffService.findByJourney
      ? handoffService.findByJourney(journey.id, journey.owner)
      : null;
    document.body.dataset.decisionJourneyReady = 'true';
    document.body.dataset.decisionJourneyProduct = product.id || '';
    document.body.dataset.decisionJourneyModel = model.id || '';
    document.body.dataset.decisionJourneyObjective = journey.objective || '';
    document.body.dataset.decisionJourneyHandoff = handoff ? handoff.id : '';
    renderBridgeStrip(journey, handoff);
    renderBridgeTimeline(journey, handoff);
    const nextHref = journeyContextHref(next.href || 'comparador.html', journey, { productId: product.id || '' });
    const comparatorHref = journeyContextHref(`comparador.html?preset=${encodeURIComponent(journey.objective || 'obter_liquidez')}`, journey);
    const dashboardHref = journeyContextHref('dashboard-cliente.html#continuidade-cliente', journey);
    const modelHref = journeyContextHref(`modelos-biblioteca.html?recomendado=${encodeURIComponent(model.id || '')}`, journey);
    const productsHref = journeyContextHref('produtos.html', journey, { productId: product.id || '' });
    const handoffHref = journeyContextHref('handoff-consultivo.html#operacao-handoff', journey);

    summary.innerHTML = `
      <div class="bf-journey-summary">
        <div>
          <span class="bf-badge bf-badge--ok">Trilha calculada</span>
          <h2>${escapeHtml(journey.objectiveLabel || 'Decisao financeira assistida')}</h2>
          <p>A trilha conecta diagnostico, produto sugerido, modelo padrao, comparador e proxima acao. O estado fica salvo localmente por usuario autenticado.</p>
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="${escapeHtml(nextHref)}">${escapeHtml(next.label || 'Abrir proximo passo')}</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(comparatorHref)}">Abrir comparador</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(dashboardHref)}">Ver dashboard</a>
            <button class="btn btn--ghost btn--sm" type="button" data-decision-create-handoff>${handoff ? 'Atualizar handoff' : 'Gerar handoff local'}</button>
          </div>
        </div>
        <div class="bf-journey-summary__metrics">
          ${metric('Produto', product.nome || '-')}
          ${metric('Modelo', model.name || '-')}
          ${metric('Reserva', `${Number(metrics.reservaMeses || 0).toFixed(1)} meses`, metrics.gapReserva > 0 ? 'warn' : 'strong')}
          ${metric('Capacidade segura', money(metrics.capacidadePagamento || 0), 'strong')}
          ${metric('Comprometimento', percent(metrics.comprometimentoRenda || 0), metrics.comprometimentoRenda > 65 ? 'warn' : '')}
          ${metric('Credito alvo', money(metrics.valorCredito || 0))}
        </div>
      </div>
    `;

    steps.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Passo a passo</span>
          <h2>Jornada recomendada</h2>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-decision-journey-clear>Limpar trilha</button>
      </div>
      <div class="bf-journey-steps">${(journey.steps || []).map((step) => stepMarkup(step, journey)).join('')}</div>
    `;

    actions.innerHTML = `
      <div class="bf-journey-actions">
        <div>
          <span class="bf-badge bf-badge--navy">Proxima acao</span>
          <h2>${escapeHtml(next.title || 'Abrir comparador')}</h2>
          <p>${escapeHtml(next.description || 'Compare as alternativas antes de tomar decisao.')}</p>
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="${escapeHtml(nextHref)}">${escapeHtml(next.label || 'Abrir')}</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(modelHref)}">Modelo recomendado</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(productsHref)}">Revisar produtos</a>
            ${handoff ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(handoffHref)}">Acompanhar handoff</a>` : ''}
          </div>
        </div>
        <div class="bf-calculator-history">${productRankMarkup(journey)}</div>
      </div>
    `;

    if (state) {
      const persisted = window.BFTrilhaDecisaoService.load();
      const isPersisted = persisted && persisted.id === journey.id;
      state.innerHTML = `
        <div class="bf-platform-alert ${isPersisted ? 'bf-platform-alert--success' : ''}">
          ${isPersisted ? 'Trilha salva' : 'Previa calculada'} em <strong>${escapeHtml(window.BFTrilhaDecisaoService.storageKey())}</strong>. Atualizada em ${escapeHtml(new Date(journey.updatedAt).toLocaleString('pt-BR'))}.${handoff ? ` Handoff local: <strong>${escapeHtml(handoff.id)}</strong>.` : ''}
        </div>
      `;
    }
  }

  async function init() {
    if (window.BFAuth && window.BFAuth.ready) await window.BFAuth.ready;
    const user = window.BFAuth && window.BFAuth.requireRole
      ? window.BFAuth.requireRole(['admin', 'consultor', 'cliente'], { redirect: true })
      : null;
    if (!user) return;

    const form = qs('[data-decision-journey-form]');
    if (!form || !window.BFDadosService || !window.BFTrilhaDecisaoService) return;

    const data = await window.BFDadosService.all();
    const saved = window.BFTrilhaDecisaoService.load();
    prefillForm(form, saved);

    const hasUrlContext = hasJourneyUrlContext();
    const preview = hasUrlContext
      ? window.BFTrilhaDecisaoService.build(formData(form), data)
      : (saved || window.BFTrilhaDecisaoService.build(formData(form), data));
    renderJourney(preview);

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const current = window.BFTrilhaDecisaoService.build(formData(form), data);
      const savedJourney = window.BFTrilhaDecisaoService.save(current);
      renderJourney(savedJourney);
    });

    document.addEventListener('click', (event) => {
      const clear = event.target.closest('[data-decision-journey-clear]');
      const createHandoff = event.target.closest('[data-decision-create-handoff]');
      if (clear) {
        window.BFTrilhaDecisaoService.clear();
        const next = window.BFTrilhaDecisaoService.build(formData(form), data);
        renderJourney(next);
      }
      if (createHandoff && window.BFHandoffConsultivoService) {
        const current = window.BFTrilhaDecisaoService.save(window.BFTrilhaDecisaoService.build(formData(form), data));
        const handoff = window.BFHandoffConsultivoService.createFromJourney(current);
        renderJourney(current);
        const state = qs('[data-decision-journey-state]');
        if (state) {
          state.innerHTML = `<div class="bf-platform-alert bf-platform-alert--success">Handoff consultivo local criado/atualizado: <strong>${escapeHtml(handoff.id)}</strong>. Acompanhe em <a href="${escapeHtml(journeyContextHref('handoff-consultivo.html#operacao-handoff', current))}">Handoff consultivo</a>.</div>`;
        }
      }
    });
  }

  window.BFDecisionJourneyContext = {
    read: journeyUrlContext,
    has: hasJourneyUrlContext,
    objective: objectiveFromContext,
    href: journeyContextHref,
    append: appendQuery,
    defaults: applyContextDefaults
  };

  document.addEventListener('DOMContentLoaded', init);
})();
