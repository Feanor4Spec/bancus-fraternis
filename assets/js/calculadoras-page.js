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

  const FIELD_GUIDANCE = {
    'custos-fixos': {
      rendaLiquida: 'Base mensal apos descontos. Ela sustenta todo o diagnostico.',
      moradia: 'Aluguel, financiamento, condominio e contas recorrentes da moradia.',
      alimentacao: 'Mercado, refeicoes e custos recorrentes de alimentacao.',
      transporte: 'Combustivel, aplicativo, transporte publico, seguro e manutencao.',
      dividas: 'Parcelas ja contratadas, cartoes, emprestimos e financiamentos.',
      outros: 'Custos fixos que nao entraram nas categorias anteriores.'
    },
    'reserva-emergencia': {
      gastoMensal: 'Use o custo mensal essencial, nao o gasto eventual.',
      mesesCobertura: 'Meta conservadora costuma ficar entre 3 e 12 meses.',
      reservaAtual: 'Saldo disponivel para emergencia, com liquidez.'
    },
    'capacidade-credito': {
      rendaMensal: 'Renda mensal recorrente usada para medir comprometimento.',
      gastoMensal: 'Custos essenciais antes de assumir nova parcela.',
      dividasMensais: 'Parcelas ja assumidas que reduzem a margem.',
      reservaAtual: 'Protecao de caixa para nao depender do credito.',
      comprometimentoMaximo: 'Limite da renda que pode ficar em parcelas.',
      margemFluxo: 'Parte da folga mensal que pode virar nova parcela.',
      mesesReservaMinima: 'Reserva minima preservada antes de recomendar credito.'
    },
    'lance-consorcio': {
      valorCarta: 'Credito desejado para compra do bem.',
      reservaAtual: 'Caixa disponivel antes do lance.',
      gastoMensal: 'Custo mensal usado para preservar reserva minima.',
      capacidadePagamento: 'Parcela segura vinda da capacidade de credito ou informada manualmente.',
      lanceDesejadoPct: 'Percentual da carta que voce pretende ofertar.',
      limiteLancePct: 'Teto prudencial para nao concentrar caixa demais no lance.',
      mesesReservaMinima: 'Reserva que deve sobrar mesmo depois do lance.'
    },
    'compra-vista-parcelado': {
      precoCheio: 'Preco sem desconto, antes de comparar alternativas.',
      descontoVista: 'Desconto real para pagamento a vista.',
      parcelas: 'Quantidade de parcelas do plano parcelado.',
      valorParcela: 'Valor mensal da parcela informada pelo vendedor.',
      taxaOportunidadeMes: 'Retorno mensal estimado para o dinheiro que ficaria investido.',
      rendaMensal: 'Renda mensal para medir peso da parcela.',
      gastoMensal: 'Custo mensal usado para avaliar liquidez.',
      reservaAtual: 'Caixa disponivel antes da compra.',
      prioridadeCompra: 'Criterio principal da decisao.'
    }
  };

  const FIELD_RULES = {
    'custos-fixos': {
      rendaLiquida: { minExclusive: 0 },
      moradia: { min: 0 },
      alimentacao: { min: 0 },
      transporte: { min: 0 },
      dividas: { min: 0 },
      outros: { min: 0 }
    },
    'reserva-emergencia': {
      gastoMensal: { minExclusive: 0 },
      mesesCobertura: { minExclusive: 0, max: 60 },
      reservaAtual: { min: 0 }
    },
    'capacidade-credito': {
      rendaMensal: { minExclusive: 0 },
      gastoMensal: { min: 0 },
      dividasMensais: { min: 0 },
      reservaAtual: { min: 0 },
      comprometimentoMaximo: { minExclusive: 0, max: 80, suffix: '%' },
      margemFluxo: { minExclusive: 0, max: 100, suffix: '%' },
      mesesReservaMinima: { minExclusive: 0, max: 60 }
    },
    'lance-consorcio': {
      valorCarta: { minExclusive: 0 },
      reservaAtual: { min: 0 },
      gastoMensal: { minExclusive: 0 },
      capacidadePagamento: { min: 0 },
      lanceDesejadoPct: { min: 0, max: 100, suffix: '%' },
      limiteLancePct: { minExclusive: 0, max: 100, suffix: '%' },
      mesesReservaMinima: { minExclusive: 0, max: 60 }
    },
    'compra-vista-parcelado': {
      precoCheio: { minExclusive: 0 },
      descontoVista: { min: 0, max: 100, suffix: '%' },
      parcelas: { minExclusive: 0, max: 600, integer: true },
      valorParcela: { minExclusive: 0 },
      taxaOportunidadeMes: { min: 0, max: 100, suffix: '%' },
      rendaMensal: { minExclusive: 0 },
      gastoMensal: { min: 0 },
      reservaAtual: { min: 0 }
    }
  };

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

  function slugOf(resultOrSlug) {
    return typeof resultOrSlug === 'string' ? resultOrSlug : resultOrSlug && resultOrSlug.slug;
  }

  function calculatorActionHref(kind, slug, result) {
    if (kind === 'current') return '#calculadora-entrada';
    if (kind === 'hub') return 'calculadoras.html';
    if (kind === 'dashboard') return 'dashboard-cliente.html#continuidade-cliente';
    if (kind === 'simulator') return simulatorHref(result || slug);
    if (kind === 'journey') return calculatorContextHref('journey', result || slug);
    if (kind === 'comparator') return calculatorContextHref('comparator', result || slug);
    return calculatorContextHref('calculator', kind, { from: 'calculator', previousCalculatorSlug: slug || '' });
  }

  function buildCalculatorNextAction(result, recommendation) {
    const slug = slugOf(result) || document.body.dataset.calculatorSlug || 'custos-fixos';
    const warnings = result && Array.isArray(result.coherenceWarnings) ? result.coherenceWarnings : [];
    const hasRisk = warnings.length > 0 || (recommendation && recommendation.tone === 'warn');
    const defaultAction = {
      kind: 'continue-simulator',
      title: 'Levar contexto ao simulador',
      message: 'O resultado pode seguir para simulador, trilha ou comparador com origem preservada.',
      href: calculatorActionHref('simulator', slug, result),
      primaryLabel: 'Levar ao simulador',
      tone: 'bf-v8-decision-card--stable'
    };
    const riskActions = {
      'custos-fixos': {
        kind: 'reduce-costs',
        title: 'Reduzir custos antes de avancar',
        message: 'A prioridade e aliviar o orcamento antes de assumir parcela, investimento ou lance.',
        href: calculatorActionHref('current', slug, result),
        primaryLabel: 'Revisar custos',
        tone: 'bf-v8-decision-card--warning'
      },
      'reserva-emergencia': {
        kind: 'build-reserve',
        title: 'Montar reserva primeiro',
        message: 'Proteja liquidez antes de tomar credito, comprar a vista ou ofertar lance.',
        href: calculatorActionHref('poupanca-selic', slug, result),
        primaryLabel: 'Planejar reserva',
        tone: 'bf-v8-decision-card--warning'
      },
      'capacidade-credito': {
        kind: 'recheck-budget',
        title: 'Revisar folga antes do credito',
        message: 'O cenario pede custos, dividas ou reserva mais claros antes do simulador.',
        href: calculatorActionHref('custos-fixos', slug, result),
        primaryLabel: 'Revisar orcamento',
        tone: 'bf-v8-decision-card--warning'
      },
      'lance-consorcio': {
        kind: 'recalculate-capacity',
        title: 'Recalcular capacidade antes do lance',
        message: 'Ajuste caixa, reserva minima e parcela segura antes de levar o lance ao simulador.',
        href: calculatorActionHref('capacidade-credito', slug, result),
        primaryLabel: 'Calcular capacidade',
        tone: 'bf-v8-decision-card--warning'
      },
      'compra-vista-parcelado': {
        kind: 'preserve-cash',
        title: 'Proteger reserva antes da compra',
        message: 'A decisao precisa equilibrar desconto, parcela e liquidez depois da compra.',
        href: calculatorActionHref('reserva-emergencia', slug, result),
        primaryLabel: 'Checar reserva',
        tone: 'bf-v8-decision-card--warning'
      }
    };
    const successActions = {
      'custos-fixos': {
        kind: 'build-reserve',
        title: 'Transformar sobra em reserva',
        message: 'Com orcamento mapeado, defina reserva minima antes de simular credito.',
        href: calculatorActionHref('reserva-emergencia', slug, result),
        primaryLabel: 'Montar reserva',
        tone: 'bf-v8-decision-card--stable'
      },
      'reserva-emergencia': {
        kind: 'check-credit-capacity',
        title: 'Medir capacidade de credito',
        message: 'Com liquidez mapeada, calcule parcela segura antes de simular.',
        href: calculatorActionHref('capacidade-credito', slug, result),
        primaryLabel: 'Calcular capacidade',
        tone: 'bf-v8-decision-card--stable'
      },
      'capacidade-credito': defaultAction,
      'lance-consorcio': defaultAction,
      'compra-vista-parcelado': {
        kind: 'compare-options',
        title: 'Comparar alternativas',
        message: 'Use o comparador para confrontar custo, liquidez e produto antes da decisao.',
        href: calculatorActionHref('comparator', slug, result),
        primaryLabel: 'Comparar alternativas',
        tone: 'bf-v8-decision-card--stable'
      },
      'renda-fixa': {
        kind: 'compare-options',
        title: 'Comparar produtos',
        message: 'Preserve o contexto e compare alternativas financeiras lado a lado.',
        href: calculatorActionHref('comparator', slug, result),
        primaryLabel: 'Comparar alternativas',
        tone: 'bf-v8-decision-card--stable'
      }
    };
    const selected = hasRisk ? (riskActions[slug] || { ...defaultAction, kind: 'review-scenario', title: 'Revisar cenario', message: 'Ha sinal de risco; ajuste campos ou passe pela trilha assistida antes de simular.', href: calculatorActionHref('journey', slug, result), primaryLabel: 'Montar trilha', tone: 'bf-v8-decision-card--warning' }) : (successActions[slug] || defaultAction);
    const secondary = [
      { label: 'Ajustar campos', href: calculatorActionHref('current', slug, result) },
      { label: 'Montar trilha', href: calculatorActionHref('journey', slug, result) },
      { label: 'Comparar', href: calculatorActionHref('comparator', slug, result) },
      { label: 'Simular', href: calculatorActionHref('simulator', slug, result) },
      { label: 'Dashboard', href: calculatorActionHref('dashboard', slug, result) }
    ].filter((action) => action.href !== selected.href);
    return {
      ...selected,
      warnings,
      secondary: secondary.slice(0, 4)
    };
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
    const nextAction = buildCalculatorNextAction(result, recommendation);
    const nextActionActions = [
      { label: nextAction.primaryLabel, href: nextAction.href, primary: true },
      ...(nextAction.secondary || [])
    ];

    if (strip) {
      strip.innerHTML = `
        <div class="bf-v8-decision-strip__head">
          <span class="bf-badge bf-badge--gold">Calculadora conectada</span>
          <div>
            <h2>${escapeHtml(recommendation.title)}</h2>
            <p>${escapeHtml(recommendation.message)}</p>
            <div class="bf-inline-actions" data-calculator-next-action="${escapeHtml(nextAction.kind)}">
              ${nextActionActions.map((action) => `<a class="btn ${action.primary ? 'btn--primary' : 'btn--ghost'} btn--sm" href="${escapeHtml(action.href)}">${escapeHtml(action.label)}</a>`).join('')}
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
            <span>Prontidao</span>
            <strong>${readinessScore}/100</strong>
            <p>O resultado pode preencher objetivo, valor alvo, reserva e capacidade no simulador.</p>
            <small>${escapeHtml(result && result.historyId ? result.historyId : 'contexto local')}</small>
          </article>
          <article class="bf-v8-decision-card ${nextAction.tone}" data-calculator-next-action-card="${escapeHtml(nextAction.kind)}">
            <span>Proxima acao</span>
            <strong>${escapeHtml(nextAction.primaryLabel)}</strong>
            <p>${escapeHtml(nextAction.message)}</p>
            <small>${escapeHtml((nextAction.warnings || []).length ? `${nextAction.warnings.length} alerta${nextAction.warnings.length === 1 ? '' : 's'}` : nextAction.title)}</small>
          </article>
        </div>
      `;
    }

    renderTimeline(timelineTarget, [
      { label: 'Entrada', title: 'Campos do cenario', text: 'Premissas editaveis para recalcular sem sair da pagina.', href: '#calculadora-entrada', state: 'is-done' },
      { label: 'Resultado', title: primary.value, text: recommendation.message, href: '#resultado-calculadora', state: result ? 'is-active' : 'is-pending' },
      { label: 'Memoria', title: `${memoryCount} linhas`, text: 'Formula e risco permanecem auditaveis.', href: '#resultado-calculadora', state: result ? 'is-done' : 'is-pending' },
      { label: 'Proxima acao', title: nextAction.title, text: nextAction.message, href: nextAction.href, state: result ? 'is-active' : 'is-pending' },
      { label: 'Trilha', title: 'Jornada assistida', text: 'Converta resultado em objetivo, produto e proxima acao.', href: journeyLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Comparador', title: 'Alternativas', text: 'Abra uma matriz com origem e historico preservados.', href: comparatorLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Simulador', title: 'Entrada contextual', text: 'Abra a simulacao sem perder a origem da calculadora.', href: simulatorLink, state: result ? 'is-active' : 'is-pending' },
      { label: 'Continuidade', title: 'Dashboard', text: 'Historico e perfil consolidado ficam disponiveis na central do usuario.', href: 'dashboard-cliente.html#continuidade-cliente', state: 'is-pending' }
    ]);

    document.body.dataset.calculatorBridgeReady = result ? result.slug : 'pending';
    document.body.dataset.calculatorNextAction = nextAction.kind;
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

  function fieldGuidance(slug, field) {
    return FIELD_GUIDANCE[slug] && FIELD_GUIDANCE[slug][field.name]
      ? FIELD_GUIDANCE[slug][field.name]
      : 'Informe um valor realista para manter a leitura da jornada.';
  }

  function fieldRule(slug, field) {
    const base = field.type === 'select'
      ? { required: true }
      : { required: true, min: 0 };
    return {
      ...base,
      ...((FIELD_RULES[slug] && FIELD_RULES[slug][field.name]) || {})
    };
  }

  function renderLimitAttributes(rule) {
    const attrs = [];
    if (Number.isFinite(Number(rule.min))) attrs.push(`min="${escapeHtml(rule.min)}"`);
    if (Number.isFinite(Number(rule.max))) attrs.push(`max="${escapeHtml(rule.max)}"`);
    return attrs.join(' ');
  }

  function limitLabel(value, suffix = '') {
    return `${Number(value).toLocaleString('pt-BR', { maximumFractionDigits: 2 })}${suffix}`;
  }

  function renderField(field, value, slug) {
    const rule = fieldRule(slug, field);
    const helpId = `calc-help-${field.name}`;
    const errorId = `calc-error-${field.name}`;
    const describedBy = `${helpId} ${errorId}`;
    if (field.type === 'select') {
      return `
        <label class="bf-calculator-field" data-calculator-field="${escapeHtml(field.name)}" data-calculator-field-state="valid">
          <span>${escapeHtml(field.label)}</span>
          <select name="${escapeHtml(field.name)}" required aria-describedby="${escapeHtml(describedBy)}" data-calculator-input>
            ${(field.options || []).map((option) => `<option value="${escapeHtml(option)}"${String(option) === String(value) ? ' selected' : ''}>${escapeHtml(option)}</option>`).join('')}
          </select>
          <small id="${escapeHtml(helpId)}" class="bf-calculator-field-help">${escapeHtml(fieldGuidance(slug, field))}</small>
          <small id="${escapeHtml(errorId)}" class="bf-calculator-field-error" data-calculator-field-error></small>
        </label>
      `;
    }
    return `
      <label class="bf-calculator-field" data-calculator-field="${escapeHtml(field.name)}" data-calculator-field-state="valid">
        <span>${escapeHtml(field.label)}</span>
        <input name="${escapeHtml(field.name)}" type="${escapeHtml(field.type || 'number')}" step="${escapeHtml(field.step || '1')}" value="${escapeHtml(value)}" ${renderLimitAttributes(rule)} required aria-describedby="${escapeHtml(describedBy)}" data-calculator-input>
        <small id="${escapeHtml(helpId)}" class="bf-calculator-field-help">${escapeHtml(fieldGuidance(slug, field))}</small>
        <small id="${escapeHtml(errorId)}" class="bf-calculator-field-error" data-calculator-field-error></small>
      </label>
    `;
  }

  function formValues(form) {
    return Object.fromEntries(new FormData(form).entries());
  }

  function numericValue(raw) {
    return Number(String(raw == null ? '' : raw).replace(',', '.'));
  }

  function numberFromValues(values, key) {
    const value = numericValue(values && values[key]);
    return Number.isFinite(value) ? value : 0;
  }

  function coherenceAlerts(slug, values) {
    const alerts = [];
    if (slug === 'custos-fixos') {
      const renda = numberFromValues(values, 'rendaLiquida');
      const totalCustos = ['moradia', 'alimentacao', 'transporte', 'dividas', 'outros']
        .reduce((sum, key) => sum + numberFromValues(values, key), 0);
      const comprometimento = renda > 0 ? totalCustos / renda * 100 : 0;
      if (comprometimento > 100) alerts.push(`Custos fixos superam a renda em ${limitLabel(comprometimento - 100, '%')}. Priorize renegociacao ou reducao antes de assumir nova parcela.`);
      else if (comprometimento >= 80) alerts.push(`Comprometimento de ${limitLabel(comprometimento, '%')} deixa pouca margem para reserva, investimento ou credito.`);
      const dividas = numberFromValues(values, 'dividas');
      if (renda > 0 && dividas / renda * 100 >= 30) alerts.push(`Dividas consomem ${limitLabel(dividas / renda * 100, '%')} da renda; isso reduz capacidade de credito.`);
    }

    if (slug === 'reserva-emergencia') {
      const gasto = numberFromValues(values, 'gastoMensal');
      const meses = numberFromValues(values, 'mesesCobertura');
      const reserva = numberFromValues(values, 'reservaAtual');
      const ideal = gasto * meses;
      if (ideal > 0 && reserva < ideal) alerts.push(`Reserva cobre ${limitLabel(gasto > 0 ? reserva / gasto : 0)} meses dos ${limitLabel(meses)} meses desejados.`);
      if (meses < 3) alerts.push('Meta abaixo de 3 meses pode ser insuficiente para renda instavel ou credito novo.');
    }

    if (slug === 'capacidade-credito') {
      const renda = numberFromValues(values, 'rendaMensal');
      const gastos = numberFromValues(values, 'gastoMensal');
      const dividas = numberFromValues(values, 'dividasMensais');
      const reserva = numberFromValues(values, 'reservaAtual');
      const mesesReserva = numberFromValues(values, 'mesesReservaMinima');
      const rendaLivre = renda - gastos - dividas;
      if (renda > 0 && rendaLivre <= 0) alerts.push('Gastos e dividas ja consomem toda a renda; nova parcela tende a pressionar caixa.');
      else if (renda > 0 && rendaLivre / renda < 0.15) alerts.push(`Folga mensal abaixo de 15% da renda. Simule parcela conservadora ou reduza custos primeiro.`);
      if (renda > 0 && dividas / renda * 100 >= 30) alerts.push(`Dividas atuais ja ocupam ${limitLabel(dividas / renda * 100, '%')} da renda.`);
      if (reserva < gastos * mesesReserva) alerts.push(`Reserva atual nao cobre os ${limitLabel(mesesReserva)} meses minimos definidos para assumir credito.`);
    }

    if (slug === 'lance-consorcio') {
      const carta = numberFromValues(values, 'valorCarta');
      const reserva = numberFromValues(values, 'reservaAtual');
      const gasto = numberFromValues(values, 'gastoMensal');
      const capacidade = numberFromValues(values, 'capacidadePagamento');
      const lancePct = numberFromValues(values, 'lanceDesejadoPct');
      const limitePct = numberFromValues(values, 'limiteLancePct');
      const mesesReserva = numberFromValues(values, 'mesesReservaMinima');
      const lanceDesejado = carta * lancePct / 100;
      const reservaDepois = reserva - lanceDesejado;
      const reservaMinima = gasto * mesesReserva;
      if (reservaDepois < reservaMinima) alerts.push(`Lance desejado deixaria reserva abaixo de ${limitLabel(mesesReserva)} meses de gastos.`);
      if (limitePct > 0 && lancePct > limitePct) alerts.push(`Lance desejado de ${limitLabel(lancePct, '%')} supera o limite recomendado de ${limitLabel(limitePct, '%')}.`);
      if (capacidade <= 0) alerts.push('Capacidade de pagamento zerada limita a sustentacao da parcela apos contemplacao.');
    }

    if (slug === 'compra-vista-parcelado') {
      const preco = numberFromValues(values, 'precoCheio');
      const desconto = numberFromValues(values, 'descontoVista');
      const parcelas = numberFromValues(values, 'parcelas');
      const valorParcela = numberFromValues(values, 'valorParcela');
      const renda = numberFromValues(values, 'rendaMensal');
      const gasto = numberFromValues(values, 'gastoMensal');
      const reserva = numberFromValues(values, 'reservaAtual');
      const precoVista = preco * (1 - desconto / 100);
      const reservaDepoisVista = reserva - precoVista;
      const parcelaPct = renda > 0 ? valorParcela / renda * 100 : 0;
      const totalParcelado = parcelas * valorParcela;
      if (parcelaPct >= 10) alerts.push(`Parcela representa ${limitLabel(parcelaPct, '%')} da renda; teste impacto em capacidade de credito.`);
      if (gasto > 0 && reservaDepoisVista < gasto * 3) alerts.push('Pagamento a vista deixaria reserva abaixo de 3 meses de custos.');
      if (totalParcelado > preco && totalParcelado - preco > preco * 0.15) alerts.push('Total parcelado supera o preco cheio em mais de 15%; revise taxa e desconto.');
    }

    return alerts;
  }

  function validateField(slug, field, rawValue) {
    const rule = fieldRule(slug, field);
    const label = field.label || field.name;
    const text = String(rawValue == null ? '' : rawValue).trim();
    if (rule.required && text === '') {
      return `${label}: preencha este campo para atualizar a previa.`;
    }
    if (field.type === 'select') {
      const options = (field.options || []).map(String);
      if (!options.includes(text)) return `${label}: selecione uma opcao valida.`;
      return '';
    }
    const value = numericValue(text);
    if (!Number.isFinite(value)) return `${label}: use um numero valido.`;
    if (rule.integer && !Number.isInteger(value)) return `${label}: use um numero inteiro.`;
    if (Number.isFinite(Number(rule.minExclusive)) && value <= Number(rule.minExclusive)) {
      return `${label}: use valor maior que ${limitLabel(rule.minExclusive, rule.suffix)}.`;
    }
    if (Number.isFinite(Number(rule.min)) && value < Number(rule.min)) {
      return `${label}: use valor a partir de ${limitLabel(rule.min, rule.suffix)}.`;
    }
    if (Number.isFinite(Number(rule.max)) && value > Number(rule.max)) {
      return `${label}: use valor ate ${limitLabel(rule.max, rule.suffix)}.`;
    }
    return '';
  }

  function fieldContainer(form, name) {
    return Array.from(form.querySelectorAll('[data-calculator-field]')).find((node) => node.dataset.calculatorField === name) || null;
  }

  function applyFieldValidation(form, issues) {
    Array.from(form.querySelectorAll('[data-calculator-field]')).forEach((node) => {
      node.dataset.calculatorFieldState = 'valid';
      const input = node.querySelector('[data-calculator-input]');
      const error = node.querySelector('[data-calculator-field-error]');
      if (input) input.setAttribute('aria-invalid', 'false');
      if (error) error.textContent = '';
    });
    issues.forEach((issue) => {
      const node = fieldContainer(form, issue.name);
      if (!node) return;
      node.dataset.calculatorFieldState = 'invalid';
      const input = node.querySelector('[data-calculator-input]');
      const error = node.querySelector('[data-calculator-field-error]');
      if (input) input.setAttribute('aria-invalid', 'true');
      if (error) error.textContent = issue.message;
    });
  }

  function renderFormAlert(form, validation) {
    const target = form.querySelector('[data-calculator-form-alert]');
    if (!target) return;
    if (validation.ok) {
      target.hidden = true;
      target.innerHTML = '';
      return;
    }
    target.hidden = false;
    target.innerHTML = `
      <strong>Revise ${validation.issues.length} campo${validation.issues.length === 1 ? '' : 's'} antes de salvar.</strong><br>
      ${escapeHtml(validation.issues[0].message)}
    `;
  }

  function renderCoherenceAlert(form, warnings) {
    const target = form.querySelector('[data-calculator-coherence-alert]');
    if (!target) return;
    target.dataset.calculatorCoherenceCount = String(warnings.length);
    if (warnings.length === 0) {
      target.hidden = true;
      target.innerHTML = '';
      return;
    }
    target.hidden = false;
    target.innerHTML = `
      <strong>Atencao a coerencia do cenario</strong>
      <ul>${warnings.slice(0, 3).map((warning) => `<li>${escapeHtml(warning)}</li>`).join('')}</ul>
    `;
  }

  function validateForm(form, meta) {
    const values = formValues(form);
    const issues = (meta.fields || []).map((field) => ({
      name: field.name,
      message: validateField(meta.slug, field, values[field.name])
    })).filter((issue) => issue.message);
    const warnings = issues.length === 0 ? coherenceAlerts(meta.slug, values) : [];
    const validation = { ok: issues.length === 0, issues, warnings, values };
    applyFieldValidation(form, issues);
    renderFormAlert(form, validation);
    renderCoherenceAlert(form, warnings);
    return validation;
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

  function renderResult(result, options = {}) {
    const target = qs('[data-calculator-result]');
    if (!target) return;
    const mode = options.persisted || result.historyId ? 'saved' : 'preview';
    const modeTone = mode === 'saved' ? 'success' : 'info';
    const modeTitle = mode === 'saved' ? 'Cenario salvo' : 'Previa sem salvar';
    const modeMessage = mode === 'saved'
      ? 'Resultado gravado no perfil financeiro e no historico local.'
      : 'Resultado demonstrativo inicial. Ajuste os campos e salve quando fizer sentido.';
    target.innerHTML = `
      <article class="bf-platform-alert bf-platform-alert--${modeTone}" data-calculator-result-mode="${mode}">
        <strong>${escapeHtml(modeTitle)}</strong><br>
        ${escapeHtml(modeMessage)}
      </article>
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
      <article class="bf-platform-alert bf-platform-alert--warn bf-calculator-form-alert" data-calculator-form-alert hidden></article>
      <article class="bf-platform-alert bf-platform-alert--warn bf-calculator-coherence-alert" data-calculator-coherence-alert data-calculator-coherence-count="0" hidden></article>
      ${(meta.fields || []).map((field) => renderField(field, defaults[field.name], slug)).join('')}
      <button class="btn btn--primary" type="submit">Calcular e salvar cenario</button>
    `;
    renderRelated(list, meta);
    renderProfileSummary(qs('[data-calculator-profile-summary]'));
    renderHistory(qs('[data-calculator-history]'));
    renderCalculatorDecisionBridge(null);

    let renderSerial = 0;
    let previewTimer = null;

    async function renderPreviewFromForm() {
      const validation = validateForm(form, meta);
      if (!validation.ok) {
        document.body.dataset.calculatorValidation = 'invalid';
        document.body.dataset.calculatorCoherence = 'blocked';
        document.body.dataset.calculatorReady = `${slug}:invalid`;
        return;
      }
      const current = ++renderSerial;
      const preview = await window.BFCalculadoras.simulate(slug, validation.values, { persist: false });
      if (current !== renderSerial) return;
      preview.coherenceWarnings = validation.warnings;
      renderResult(preview, { preview: true });
      document.body.dataset.calculatorValidation = 'valid';
      document.body.dataset.calculatorCoherence = validation.warnings.length ? 'warn' : 'ok';
      document.body.dataset.calculatorReady = `${slug}:preview`;
    }

    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      const validation = validateForm(form, meta);
      if (!validation.ok) {
        document.body.dataset.calculatorValidation = 'invalid';
        document.body.dataset.calculatorCoherence = 'blocked';
        document.body.dataset.calculatorReady = `${slug}:invalid`;
        return;
      }
      const current = ++renderSerial;
      const result = await window.BFCalculadoras.simulate(slug, validation.values, { persist: true });
      if (current !== renderSerial) return;
      result.coherenceWarnings = validation.warnings;
      renderResult(result, { persisted: true });
      document.body.dataset.calculatorValidation = 'valid';
      document.body.dataset.calculatorCoherence = validation.warnings.length ? 'warn' : 'ok';
      document.body.dataset.calculatorReady = slug;
    });

    form.addEventListener('input', () => {
      window.clearTimeout(previewTimer);
      previewTimer = window.setTimeout(renderPreviewFromForm, 250);
    });
    form.addEventListener('change', renderPreviewFromForm);

    await renderPreviewFromForm();
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
