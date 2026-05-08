(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return 'Primeiro acesso';
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

  function money(value) {
    return window.BFFormatters ? window.BFFormatters.currency(value) : `R$ ${Number(value || 0).toFixed(2)}`;
  }

  function percent(value) {
    return window.BFFormatters ? window.BFFormatters.percent(value, 1) : `${Number(value || 0).toFixed(1)}%`;
  }

  const presetLabels = {
    comprar_bem: 'Comprar bem',
    obter_liquidez: 'Obter liquidez',
    trocar_veiculo: 'Trocar veiculo',
    consumo_pontual: 'Consumo pontual',
    manual: 'Manual'
  };

  const productLabels = {
    financiamento: 'Financiamento',
    consorcio: 'Consorcio',
    cdc: 'CDC',
    garantia: 'Credito com garantia',
    consignado: 'Consignado',
    consumo: 'Consumo parcelado',
    veiculos: 'Veiculos'
  };

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function currentUserEmail() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return user && user.email ? user.email : 'anon';
  }

  function calculatorPage(slug) {
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

  function dashboardContextParams(snapshot = {}, extra = {}) {
    const journey = snapshot.journey || {};
    return {
      from: 'dashboard',
      journeyId: journey.id || '',
      preset: journey.objective || '',
      ...extra
    };
  }

  function dashboardHref(href, snapshot, extra = {}) {
    return appendQuery(href, dashboardContextParams(snapshot, extra));
  }

  function latestSimulation(snapshot) {
    return (snapshot.simulations || [])[0] || null;
  }

  function hasProposalState(snapshot) {
    return (snapshot.simulations || []).some((item) => (
      item.proposalAcceptance ||
      item.proposta ||
      item.proposal ||
      item.statusProposta
    ));
  }

  function hoursSince(value) {
    if (!value) return 0;
    const parsed = new Date(value).getTime();
    if (!Number.isFinite(parsed)) return 0;
    return Math.max(0, Math.round((Date.now() - parsed) / 36e5));
  }

  function ageLabel(value) {
    const hours = hoursSince(value);
    if (!hours) return 'agora';
    if (hours < 24) return `${hours}h`;
    return `${Math.floor(hours / 24)}d`;
  }

  function loadProfileSnapshot() {
    if (window.BFCalculadoras && window.BFCalculadoras.loadProfile) {
      return window.BFCalculadoras.loadProfile() || {};
    }
    return readJson('bf_financial_profile_v1', {}) || {};
  }

  function loadCalculatorHistory() {
    if (window.BFCalculadoras && window.BFCalculadoras.loadHistory) {
      return window.BFCalculadoras.loadHistory() || [];
    }
    return readJson('bf_calculator_history_v1', []) || [];
  }

  function loadSimulations() {
    return window.Storage && window.Storage.loadSimulations ? window.Storage.loadSimulations() : [];
  }

  function loadComparatorModels() {
    return window.BFComparatorModels && window.BFComparatorModels.list ? window.BFComparatorModels.list() : [];
  }

  function loadJourneySnapshot() {
    const service = window.BFTrilhaDecisaoService;
    const active = service && service.load ? service.load() : null;
    const history = service && service.loadHistory ? service.loadHistory() : [];
    return { active, history: Array.isArray(history) ? history : [] };
  }

  function loadHandoffForJourney(journey) {
    const service = window.BFHandoffConsultivoService;
    if (!service || !journey) return null;
    return service.findByJourney ? service.findByJourney(journey.id, journey.owner) : null;
  }

  function loadRecoverySignals() {
    const service = window.BFJourneyRecoveryService;
    if (!service || !service.forCurrentUser) return [];
    return service.forCurrentUser({ includeComplete: true });
  }

  function dashboardSnapshot() {
    const profile = loadProfileSnapshot();
    const calculatorHistory = loadCalculatorHistory();
    const simulations = loadSimulations();
    const comparatorModels = loadComparatorModels();
    const journey = loadJourneySnapshot();
    const handoff = loadHandoffForJourney(journey.active);
    const readiness = window.BFDecisionContext && typeof window.BFDecisionContext.readiness === 'function'
      ? window.BFDecisionContext.readiness(profile)
      : { score: profile.readinessScore || 0, complete: false, missing: [] };
    const handoffs = window.BFHandoffConsultivoService && window.BFHandoffConsultivoService.list
      ? window.BFHandoffConsultivoService.list().filter((item) => !item.ownerEmail || item.ownerEmail === currentUserEmail())
      : [];

    return {
      profile,
      hasProfile: Object.keys(profile || {}).length > 0,
      readiness,
      calculatorHistory,
      simulations,
      comparatorModels,
      journey: journey.active,
      journeyHistory: journey.history,
      handoff,
      handoffs,
      recoverySignals: loadRecoverySignals()
    };
  }

  function renderContinuityStrip() {
    const target = document.querySelector('[data-client-continuity-strip]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const profile = snapshot.profile || {};
    const totalHistory = snapshot.calculatorHistory.length + snapshot.simulations.length + snapshot.comparatorModels.length;
    const contextualSimulations = snapshot.simulations.filter((item) => item.decisionContext).length;
    const activeHandoff = snapshot.handoff || snapshot.handoffs[0] || null;
    const nextAction = snapshot.journey && snapshot.journey.nextAction ? snapshot.journey.nextAction : null;
    const service = window.BFHandoffConsultivoService;
    const handoffAge = activeHandoff ? ageLabel(activeHandoff.updatedAt || activeHandoff.createdAt) : '';
    const handoffSource = activeHandoff && service && service.sourceLabel ? service.sourceLabel(activeHandoff) : '';
    const recoverySummary = window.BFJourneyRecoveryService && window.BFJourneyRecoveryService.summary
      ? window.BFJourneyRecoveryService.summary(snapshot.recoverySignals)
      : { total: 0, open: 0, high: 0, top: null };
    const topSignal = recoverySummary.open ? recoverySummary.top : null;

    const cards = [
      {
        tone: snapshot.readiness.complete ? 'stable' : snapshot.hasProfile ? 'info' : 'warning',
        eyebrow: 'Diagnostico',
        title: snapshot.hasProfile ? `${snapshot.readiness.score || 0}/100 prontidao` : 'Perfil incompleto',
        body: snapshot.hasProfile
          ? `Renda ${profile.rendaMensal ? money(profile.rendaMensal) : '-'}, reserva ${profile.reservaAtual ? money(profile.reservaAtual) : '-'} e capacidade ${profile.capacidadePagamento ? money(profile.capacidadePagamento) : '-'}.`
          : 'Comece por Custos Fixos ou Reserva para personalizar as recomendacoes.',
        action: snapshot.readiness.complete ? 'Seguir para simulador' : 'Completar diagnostico'
      },
      {
        tone: recoverySummary.open ? (recoverySummary.high ? 'warning' : 'info') : (totalHistory > 0 ? 'info' : 'warning'),
        eyebrow: 'Retomada',
        title: recoverySummary.open ? `${recoverySummary.open} sinal${recoverySummary.open === 1 ? '' : 'is'} aberto${recoverySummary.open === 1 ? '' : 's'}` : `${totalHistory} registro${totalHistory === 1 ? '' : 's'} conectados`,
        body: topSignal
          ? `${topSignal.title}: ${topSignal.reason}`
          : `${snapshot.simulations.length} simulacoes (${contextualSimulations} com contexto), ${snapshot.calculatorHistory.length} calculadoras e ${snapshot.comparatorModels.length} modelos locais.`,
        action: topSignal ? topSignal.ctaLabel : (totalHistory > 0 ? 'Retomar atividade' : 'Criar primeira simulacao')
      },
      {
        tone: snapshot.journey ? 'stable' : 'info',
        eyebrow: 'Trilha',
        title: snapshot.journey ? (snapshot.journey.objectiveLabel || 'Trilha ativa') : 'Trilha pendente',
        body: snapshot.journey
          ? (nextAction ? nextAction.title : 'Jornada salva pronta para revisao.')
          : 'Monte uma sequencia de diagnostico, produto, comparacao e proxima acao.',
        action: snapshot.journey ? 'Revisar trilha' : 'Montar trilha'
      },
      {
        tone: activeHandoff ? 'stable' : snapshot.journey ? 'info' : 'warning',
        eyebrow: 'Handoff',
        title: activeHandoff ? (service.statusLabels[activeHandoff.status] || activeHandoff.status) : 'Sem handoff ativo',
        body: activeHandoff
          ? `${activeHandoff.id} - ${handoffSource || 'origem local'} - prioridade ${activeHandoff.priority || 'media'} - aging ${handoffAge}.`
          : snapshot.journey
            ? 'A trilha ja pode virar handoff local para atendimento.'
            : 'Crie uma trilha antes de encaminhar para atendimento.',
        action: activeHandoff ? 'Acompanhar atendimento' : 'Preparar atendimento'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Central de continuidade</span>
        <div>
          <h2>Seu proximo melhor passo.</h2>
          <p>O dashboard consolida perfil, historico, modelos, trilha e handoff para evitar recomecar a jornada do zero.</p>
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

  function renderContinuityTimeline() {
    const target = document.querySelector('[data-client-continuity-timeline]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const profileComplete = Boolean(snapshot.profile && snapshot.profile.rendaMensal && (snapshot.profile.gastoMensal || snapshot.profile.custosMensais));
    const hasCalculator = snapshot.calculatorHistory.some((item) => item.calculatorSlug !== 'simulador-consorcio');
    const hasJourney = Boolean(snapshot.journey);
    const hasComparator = snapshot.comparatorModels.length > 0 || (snapshot.recoverySignals || []).some((signal) => String(signal.type || '').includes('comparator'));
    const hasSimulation = snapshot.simulations.length > 0 || snapshot.calculatorHistory.some((item) => item.calculatorSlug === 'simulador-consorcio');
    const hasProposal = hasProposalState(snapshot);
    const hasHandoff = Boolean(snapshot.handoff || snapshot.handoffs.length);
    const journeyId = snapshot.journey ? snapshot.journey.id : 'dashboard-cliente';
    const objective = snapshot.journey ? snapshot.journey.objective : 'obter_liquidez';
    const simulation = latestSimulation(snapshot);
    const steps = [
      {
        label: 'Diagnostico',
        title: profileComplete ? 'Diagnostico reutilizavel' : 'Completar dados financeiros',
        text: profileComplete ? 'Renda, custos e reserva ja alimentam a jornada.' : 'Informe renda, custos, dividas e reserva.',
        href: profileComplete ? dashboardHref('calculadoras.html', snapshot) : dashboardHref('calculadora-custos-fixos.html', snapshot, { calculatorSlug: 'custos-fixos' }),
        status: profileComplete ? 'done' : 'active'
      },
      {
        label: 'Calculadora',
        title: hasCalculator ? 'Calculadora conectada' : 'Rodar calculadora de apoio',
        text: hasCalculator ? 'Historico financeiro pronto para alimentar o simulador.' : 'Use capacidade, reserva ou lance antes de simular.',
        href: hasCalculator ? dashboardHref('calculadoras.html#calculadoras-historico', snapshot) : dashboardHref('calculadora-capacidade-credito.html', snapshot, { calculatorSlug: 'capacidade-credito' }),
        status: hasCalculator ? 'done' : (profileComplete ? 'active' : 'pending')
      },
      {
        label: 'Trilha',
        title: hasJourney ? 'Trilha assistida ativa' : 'Montar trilha',
        text: hasJourney ? 'Objetivo, produto, modelo e proxima acao estao consolidados.' : 'Converta o diagnostico em uma sequencia de decisao.',
        href: dashboardHref('trilha-decisao.html', snapshot, { journeyId, preset: objective }),
        status: hasJourney ? 'done' : (hasCalculator ? 'active' : 'pending')
      },
      {
        label: 'Comparador',
        title: hasComparator ? 'Comparacao registrada' : 'Comparar alternativas',
        text: hasComparator ? 'Matriz ou modelo salvo ja pode orientar a escolha.' : 'Compare custo total, parcela, liquidez e risco antes de simular.',
        href: dashboardHref('comparador.html', snapshot, { journeyId, preset: objective }),
        status: hasComparator ? 'done' : (hasJourney ? 'active' : 'pending')
      },
      {
        label: 'Simulacao',
        title: hasSimulation ? 'Simulacao salva' : 'Abrir simulador orientado',
        text: hasSimulation ? 'Cenario pronto para carteira e retomada comercial.' : 'Leve o contexto financeiro para a prateleira de grupos.',
        href: hasSimulation && simulation ? dashboardHref(`simulador.html?simulationId=${encodeURIComponent(simulation.id)}`, snapshot) : dashboardHref('simulador.html', snapshot, { journeyId, preset: objective }),
        status: hasSimulation ? 'done' : (hasComparator || hasJourney ? 'active' : 'pending')
      },
      {
        label: 'Proposta',
        title: hasProposal ? 'Proposta revisada' : 'Revisar proposta',
        text: hasProposal ? 'Aceite local ou revisao comercial ja aparece no historico.' : 'Use a etapa de proposta para fechar checklist e validade.',
        href: hasSimulation && simulation ? dashboardHref(`simulador.html?simulationId=${encodeURIComponent(simulation.id)}#proposta`, snapshot) : dashboardHref('simulador.html#proposta', snapshot, { journeyId, preset: objective }),
        status: hasProposal ? 'done' : (hasSimulation ? 'active' : 'pending')
      },
      {
        label: 'Handoff',
        title: hasHandoff ? 'Atendimento consultivo criado' : 'Preparar atendimento',
        text: hasHandoff ? 'Lead local pronto para acompanhamento operacional.' : 'Gere handoff quando a trilha estiver revisada.',
        href: dashboardHref('handoff-consultivo.html#fila-handoff', snapshot, { journeyId }),
        status: hasHandoff ? 'done' : (hasProposal || hasJourney ? 'active' : 'pending')
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

  function renderClientActivity() {
    const target = document.querySelector('[data-client-activity]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const events = [];
    snapshot.simulations.forEach((item) => {
      const context = item.decisionContext || {};
      const source = context.calculatorSlug ? ` via ${context.calculatorSlug}` : context.source ? ` via ${context.source}` : '';
      events.push({
        type: `Simulador${source}`,
        title: context.readinessScore ? `${item.nome || 'Simulacao de consorcio'} - prontidao ${context.readinessScore}/100` : (item.nome || 'Simulacao de consorcio'),
        date: item.atualizadoEm || item.criadoEm,
        href: dashboardHref(`simulador.html?simulationId=${encodeURIComponent(item.id)}`, snapshot, {
          calculatorSlug: context.calculatorSlug || '',
          historyId: context.historyId || ''
        })
      });
    });
    snapshot.calculatorHistory.forEach((item) => events.push({
      type: item.calculatorName || 'Calculadora',
      title: item.recommendation ? item.recommendation.title : 'Calculo salvo',
      date: item.createdAt,
      href: dashboardHref(calculatorPage(item.calculatorSlug), snapshot, {
        calculatorSlug: item.calculatorSlug || '',
        historyId: item.id || ''
      })
    }));
    snapshot.comparatorModels.forEach((item) => events.push({
      type: 'Modelo comparador',
      title: item.name,
      date: item.updatedAt || item.createdAt,
      href: window.BFComparatorModels && window.BFComparatorModels.route ? window.BFComparatorModels.route(item.id) : 'comparador.html'
    }));
    if (snapshot.journey) {
      events.push({
        type: 'Trilha assistida',
        title: snapshot.journey.recommendation ? snapshot.journey.recommendation.title : snapshot.journey.objectiveLabel,
        date: snapshot.journey.updatedAt || snapshot.journey.createdAt,
        href: dashboardHref('trilha-decisao.html', snapshot)
      });
    }
    snapshot.handoffs.forEach((item) => events.push({
      type: 'Handoff',
      title: `${item.id} - ${item.objectiveLabel || 'Atendimento consultivo'}`,
      date: item.updatedAt || item.createdAt,
      href: dashboardHref('handoff-consultivo.html#fila-handoff', snapshot, { handoffId: item.id || '' })
    }));
    snapshot.recoverySignals.forEach((signal) => events.push({
      type: 'Retomada recomendada',
      title: `${signal.title} - ${signal.age || 'sinal local'}`,
      date: signal.latestEventAt,
      href: signal.ctaHref || 'dashboard-cliente.html'
    }));

    const sorted = events
      .filter((item) => item.title)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .slice(0, 6);

    if (!sorted.length) {
      target.innerHTML = '<div class="bf-empty-state">Nenhuma atividade recente ainda. Crie um diagnostico, uma simulacao ou uma trilha para ativar a continuidade.</div>';
      return;
    }

    target.innerHTML = sorted.map((item) => `
      <article class="bf-client-activity__item">
        <span>${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(formatDate(item.date))}</small>
        <a href="${escapeHtml(item.href)}">Abrir</a>
      </article>
    `).join('');
  }

  function renderRecoverySignals() {
    const target = document.querySelector('[data-client-recovery-signals]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const service = window.BFJourneyRecoveryService;
    const signals = snapshot.recoverySignals || [];
    const summary = service && service.summary ? service.summary(signals) : { total: signals.length, open: signals.length, high: 0 };
    const rows = signals.slice(0, 4).map((signal) => `
      <article class="bf-client-activity__item" data-client-recovery-signal="${escapeHtml(signal.type)}">
        <span>${escapeHtml(signal.severity === 'alta' ? 'Alta prioridade' : signal.severity === 'media' ? 'Media prioridade' : 'Monitorado')}</span>
        <strong>${escapeHtml(signal.title)}</strong>
        <small>${escapeHtml(signal.reason)}${signal.age ? ` - ${signal.age}` : ''}</small>
        <a href="${escapeHtml(signal.ctaHref || 'dashboard-cliente.html')}">${escapeHtml(signal.ctaLabel || 'Abrir')}</a>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Retomadas recomendadas</span>
          <h2>Prioridade a partir da jornada real</h2>
          <p>Produtos, comparador e simuladores alimentam sinais locais para continuar do ponto exato de abandono ou decisao.</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="${escapeHtml(dashboardHref('handoff-consultivo.html#fila-handoff', snapshot))}">Enviar para handoff</a>
      </div>
      <div class="bf-platform-metrics">
        ${window.BFCards ? window.BFCards.metric('Sinais', summary.total || 0, 'is-strong') : ''}
        ${window.BFCards ? window.BFCards.metric('Abertos', summary.open || 0) : ''}
        ${window.BFCards ? window.BFCards.metric('Alta prioridade', summary.high || 0, summary.high ? 'is-warn' : '') : ''}
        ${window.BFCards ? window.BFCards.metric('Prontos p/ handoff', summary.readyForHandoff || 0) : ''}
      </div>
      <div class="bf-client-activity">
        ${rows || '<div class="bf-empty-state">Nenhum sinal de retomada aberto. Produtos, comparador e simuladores continuam monitorados localmente.</div>'}
      </div>
    `;
    document.body.dataset.clientRecoverySignalsReady = 'true';
    document.body.dataset.clientRecoverySignalsCount = String(summary.total || 0);
  }

  function renderContinuityCenter() {
    renderContinuityStrip();
    renderContinuityTimeline();
    renderRecoverySignals();
    renderClientActivity();
  }

  async function renderStandardModels() {
    const target = document.querySelector('[data-client-standard-models]');
    if (!target) return;

    let standards = [];
    try {
      standards = await window.BFDadosService.json('modelos-comparador-padrao');
    } catch (error) {
      standards = [];
    }

    if (!standards.length) {
      target.innerHTML = '<div class="bf-empty-state">Biblioteca de modelos padrao indisponivel neste momento.</div>';
      return;
    }

    const ranked = window.BFModelosRecomendacaoService
      ? window.BFModelosRecomendacaoService.rank(standards, {})
      : standards;

    target.innerHTML = ranked.slice(0, 4).map((model, index) => `
      <article class="bf-history-item" data-client-standard-model="${escapeHtml(model.id)}">
        <span>${escapeHtml(index === 0 ? 'Recomendado para seu perfil' : (presetLabels[model.preset] || model.preset || 'Modelo'))}</span>
        <strong>${escapeHtml(model.name)}</strong>
        <small>${escapeHtml((model.productIds || []).map((id) => productLabels[id] || id).join(', '))}${model.recommendationScore ? ` - aderencia ${model.recommendationScore}/100` : ''}</small>
        <a href="modelos-biblioteca.html?recomendado=${encodeURIComponent(model.id)}">Clonar modelo</a>
      </article>
    `).join('');
  }

  function renderComparatorModels() {
    const target = document.querySelector('[data-client-comparator-models]');
    if (!target) return;
    const models = window.BFComparatorModels && window.BFComparatorModels.list
      ? window.BFComparatorModels.list().slice(0, 8)
      : [];

    if (models.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum modelo de comparacao salvo ainda. Abra o comparador, ajuste a matriz e salve um modelo nomeado.</div>';
      return;
    }

    target.innerHTML = models.map((model) => `
      <article class="bf-history-item" data-client-comparator-model="${escapeHtml(model.id)}">
        <span>${escapeHtml(String(model.source || '').startsWith('standard:') ? 'Modelo da biblioteca' : 'Modelo de comparacao')}</span>
        <strong>${escapeHtml(model.name)}</strong>
        <small>${escapeHtml(presetLabels[model.preset] || (model.preset || 'manual').replace(/_/g, ' '))} - atualizado em ${escapeHtml(formatDate(model.updatedAt))}</small>
        <a href="${window.BFComparatorModels.route(model.id)}">Abrir modelo</a>
      </article>
    `).join('');
  }

  function renderCalculatorProfile() {
    if (!window.BFCalculadoras) return;

    const profileTarget = document.querySelector('[data-client-financial-profile]');
    const historyTarget = document.querySelector('[data-client-calculator-history]');
    const profile = window.BFCalculadoras.loadProfile();
    const history = window.BFCalculadoras.loadHistory().slice(0, 8);
    const readiness = window.BFDecisionContext && typeof window.BFDecisionContext.readiness === 'function'
      ? window.BFDecisionContext.readiness(profile)
      : { score: profile.readinessScore || 0, complete: false };
    const hasProfile = Object.keys(profile).length > 0;

    if (profileTarget) {
      profileTarget.innerHTML = `
        <div class="bf-calculator-profile">
          <div>
            <span class="bf-badge bf-badge--ok">Perfil financeiro consolidado</span>
            <h2>${hasProfile ? 'Dados reutilizaveis entre calculadoras' : 'Crie o primeiro diagnostico'}</h2>
            <p>${hasProfile ? 'Renda, custos, reserva, patrimonio e capacidade de aporte foram consolidados localmente para personalizar novas simulacoes.' : 'Abra Custos Fixos ou Reserva de Emergencia para iniciar o perfil financeiro local.'}</p>
            <div class="bf-inline-actions">
              <a class="btn btn--primary btn--sm" href="calculadora-custos-fixos.html">Diagnosticar custos</a>
              <a class="btn btn--ghost btn--sm" href="calculadora-reserva-emergencia.html">Reserva</a>
              <a class="btn btn--ghost btn--sm" href="simulador.html?from=journey&journeyId=dashboard-cliente">Simular com contexto</a>
            </div>
          </div>
          <div class="bf-calculator-profile__metrics">
            <div><small>Prontidao</small><strong>${readiness.score || 0}/100</strong></div>
            <div><small>Renda</small><strong>${profile.rendaMensal ? money(profile.rendaMensal) : '-'}</strong></div>
            <div><small>Capacidade</small><strong>${profile.capacidadePagamento ? money(profile.capacidadePagamento) : (profile.capacidadeAporte ? money(profile.capacidadeAporte) : '-')}</strong></div>
            <div><small>Reserva</small><strong>${profile.reservaAtual ? money(profile.reservaAtual) : '-'}</strong></div>
            <div><small>Comprometimento</small><strong>${profile.comprometimentoRenda ? percent(profile.comprometimentoRenda) : '-'}</strong></div>
          </div>
        </div>
      `;
    }

    if (!historyTarget) return;
    if (history.length === 0) {
      historyTarget.innerHTML = '<div class="bf-empty-state">Nenhuma simulacao financeira salva ainda. Use o hub de calculadoras para criar historico.</div>';
      return;
    }

    historyTarget.innerHTML = history.map((item) => `
      <article class="bf-history-item">
        <span>${escapeHtml(item.calculatorName)}</span>
        <strong>${escapeHtml(item.recommendation ? item.recommendation.title : 'Simulacao salva')}</strong>
        <small>${escapeHtml(formatDate(item.createdAt))}</small>
        <a href="${calculatorPage(item.calculatorSlug)}">Reabrir calculadora</a>
      </article>
    `).join('');
  }

  function renderDecisionJourney() {
    const target = document.querySelector('[data-client-decision-journey]');
    if (!target) return;

    const service = window.BFTrilhaDecisaoService;
    const journey = service && service.load ? service.load() : null;
    if (!journey) {
      target.innerHTML = `
        <div class="bf-journey-dashboard">
          <div>
            <span class="bf-badge bf-badge--gold">Trilha assistida</span>
            <h2>Crie uma jornada de decisao</h2>
            <p>Conecte diagnostico, produto, modelo recomendado, comparador e proxima acao em uma unica sequencia salva por usuario.</p>
            <div class="bf-inline-actions">
              <a class="btn btn--primary btn--sm" href="trilha-decisao.html?from=dashboard">Montar trilha</a>
              <a class="btn btn--ghost btn--sm" href="produtos.html?from=dashboard">Ver produtos</a>
            </div>
          </div>
          <div class="bf-journey-dashboard__metrics">
            <div class="bf-platform-metric"><small>Status</small><strong>Pendente</strong></div>
            <div class="bf-platform-metric"><small>Proximo passo</small><strong>Diagnostico</strong></div>
          </div>
        </div>
      `;
      return;
    }

    const product = journey.recommendedProduct || {};
    const model = journey.recommendedModel || {};
    const next = journey.nextAction || {};
    const metrics = journey.metrics || {};
    const handoffService = window.BFHandoffConsultivoService;
    const handoff = handoffService && handoffService.findByJourney
      ? handoffService.findByJourney(journey.id, journey.owner)
      : null;
    const snapshot = { journey };
    const nextHref = dashboardHref(next.href || 'trilha-decisao.html', snapshot, {
      productId: product.id || '',
      journeyId: journey.id || ''
    });
    const reviewHref = dashboardHref('trilha-decisao.html', snapshot);
    const comparatorHref = dashboardHref('comparador.html', snapshot, {
      preset: journey.objective || 'obter_liquidez'
    });
    const handoffHref = dashboardHref('handoff-consultivo.html#fila-handoff', snapshot, {
      handoffId: handoff ? handoff.id : ''
    });
    target.innerHTML = `
      <div class="bf-journey-dashboard" data-client-decision-journey-current="${escapeHtml(journey.id)}">
        <div>
          <span class="bf-badge bf-badge--ok">Trilha assistida ativa</span>
          <h2>${escapeHtml(journey.objectiveLabel || 'Jornada de decisao')}</h2>
          <p>${escapeHtml(handoff ? `Handoff local ${handoff.id} em status ${handoffService.statusLabels[handoff.status] || handoff.status}.` : (next.title || 'Proxima acao definida para este usuario.'))}</p>
          <div class="bf-inline-actions">
            <a class="btn btn--primary btn--sm" href="${escapeHtml(nextHref)}">${escapeHtml(next.label || 'Abrir proximo passo')}</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(reviewHref)}">Revisar trilha</a>
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(comparatorHref)}">Comparador</a>
            <button class="btn btn--ghost btn--sm" type="button" data-client-create-handoff>${handoff ? 'Atualizar handoff' : 'Gerar handoff local'}</button>
            ${handoff ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(handoffHref)}">Acompanhar</a>` : ''}
          </div>
        </div>
        <div class="bf-journey-dashboard__metrics">
          <div class="bf-platform-metric is-strong"><small>Produto</small><strong>${escapeHtml(product.nome || '-')}</strong></div>
          <div class="bf-platform-metric"><small>Modelo</small><strong>${escapeHtml(model.name || '-')}</strong></div>
          <div class="bf-platform-metric${metrics.gapReserva > 0 ? ' is-warn' : ''}"><small>Reserva</small><strong>${Number(metrics.reservaMeses || 0).toFixed(1)} meses</strong></div>
          <div class="bf-platform-metric"><small>Capacidade segura</small><strong>${money(metrics.capacidadePagamento || 0)}</strong></div>
        </div>
      </div>
    `;
  }

  document.addEventListener('DOMContentLoaded', function () {
    const user = window.BFAuth.requireRole(['admin', 'consultor', 'cliente'], { redirect: true });
    if (!user) return;

    const target = document.querySelector('[data-client-session]');
    if (!target) return;

    target.innerHTML = `
      <div class="bf-user-profile">
        <div>
          <span class="bf-badge bf-badge--ok">Sessao ativa</span>
          <h2>Ola, ${escapeHtml(user.name)}</h2>
          <p>${escapeHtml(user.email)} - ${escapeHtml(user.roleLabel)} - ultimo acesso: ${escapeHtml(formatDate(user.lastLoginAt))}</p>
        </div>
        <div class="bf-inline-actions">
          ${user.role === 'admin' ? '<a class="btn btn--ghost btn--sm" href="dashboard-admin.html">Administracao</a>' : ''}
          <a class="btn btn--primary btn--sm" href="simulador.html">Nova simulacao</a>
        </div>
      </div>
    `;

    renderCalculatorProfile();
    renderDecisionJourney();
    renderStandardModels();
    renderComparatorModels();
    renderContinuityCenter();

    document.addEventListener('click', (event) => {
      const button = event.target.closest('[data-client-create-handoff]');
      if (!button || !window.BFHandoffConsultivoService || !window.BFTrilhaDecisaoService) return;
      const journey = window.BFTrilhaDecisaoService.load();
      if (!journey) return;
      window.BFHandoffConsultivoService.createFromJourney(journey, { ownerName: user.name });
      renderDecisionJourney();
      renderContinuityCenter();
    });
  });
})();
