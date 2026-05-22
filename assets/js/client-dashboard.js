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

  const handoffStatusLabels = {
    novo: 'Novo',
    em_atendimento: 'Em atendimento',
    aguardando_cliente: 'Aguardando cliente',
    qualificado: 'Qualificado',
    descartado: 'Descartado'
  };

  const proposalStatusLabels = {
    reviewed: 'Revisada localmente',
    partial: 'Revisao parcial',
    pending: 'Em revisao',
    expired: 'Revisao vencida'
  };

  let backendSnapshotState = {
    loading: false,
    loaded: false,
    snapshots: [],
    byType: {},
    scope: '',
    error: null
  };

  let backendEntityState = {
    loading: false,
    loaded: false,
    entities: [],
    summary: {},
    scope: '',
    error: null
  };

  let backendMaterializedState = {
    loading: false,
    loaded: false,
    leads: [],
    simulations: [],
    proposals: [],
    error: null
  };

  function backendApi() {
    return window.BFBackendApi && typeof window.BFBackendApi === 'object' ? window.BFBackendApi : null;
  }

  function readJson(key, fallback) {
    try {
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function listJson(key) {
    const parsed = readJson(key, []);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  }

  function sortByRecent(items) {
    return (items || []).slice().sort((a, b) => (
      String(b.updatedAt || b.createdAt || b.criadoEm || b.atualizadoEm || '')
        .localeCompare(String(a.updatedAt || a.createdAt || a.criadoEm || a.atualizadoEm || ''))
    ));
  }

  function snapshotPayload(item) {
    return item && item.payload && typeof item.payload === 'object' ? item.payload : {};
  }

  function snapshotTimestamp(item, payload) {
    return payload.updatedAt || payload.atualizadoEm || payload.createdAt || payload.criadoEm || item.updatedAt || item.createdAt || '';
  }

  function normalizeServerSnapshot(item) {
    const payload = snapshotPayload(item);
    const timestamp = snapshotTimestamp(item, payload);
    return {
      ...payload,
      id: payload.id || payload.proposalId || payload.handoffId || item.entityId || item.id,
      title: payload.title || payload.nome || payload.name || item.title || '',
      nome: payload.nome || payload.name || item.title || '',
      createdAt: payload.createdAt || payload.criadoEm || item.createdAt || '',
      updatedAt: timestamp,
      criadoEm: payload.criadoEm || payload.createdAt || item.createdAt || '',
      atualizadoEm: payload.atualizadoEm || payload.updatedAt || item.updatedAt || timestamp,
      _backendSnapshotId: item.id || '',
      _backendSnapshotType: item.type || '',
      _backendSnapshotSource: item.source || 'sqlite'
    };
  }

  function backendRecords(type) {
    return (backendSnapshotState.byType[type] || []).map(normalizeServerSnapshot);
  }

  function mergeRecords(primary, fallback, identity) {
    const records = [];
    const seen = new Set();
    [...(primary || []), ...(fallback || [])].forEach((item) => {
      if (!item) return;
      const key = String(
        (identity ? identity(item) : '') ||
        item.id ||
        item.proposalId ||
        item.handoffId ||
        item.entityId ||
        item._backendSnapshotId ||
        JSON.stringify(item).slice(0, 80)
      );
      if (seen.has(key)) return;
      seen.add(key);
      records.push(item);
    });
    return sortByRecent(records);
  }

  function backendSnapshotView() {
    const journeys = backendRecords('decision-journey');
    return {
      profile: backendRecords('financial-profile')[0] || null,
      simulations: backendRecords('simulation'),
      comparatorModels: backendRecords('comparator-models'),
      journey: journeys[0] || null,
      proposalAcceptances: backendRecords('proposal-acceptance'),
      proposalVersions: backendRecords('proposal-version'),
      handoffs: backendRecords('handoff'),
      loaded: backendSnapshotState.loaded,
      count: backendSnapshotState.snapshots.length,
      scope: backendSnapshotState.scope || '',
      error: backendSnapshotState.error || null
    };
  }

  function backendEntityView() {
    return {
      loaded: backendEntityState.loaded,
      count: backendEntityState.entities.length,
      summary: backendEntityState.summary || {},
      scope: backendEntityState.scope || '',
      error: backendEntityState.error || null,
      source: backendEntityState.loaded ? 'sqlite' : 'localStorage'
    };
  }

  function backendMaterializedView() {
    const leadCount = backendMaterializedState.leads.length;
    const simulationCount = backendMaterializedState.simulations.length;
    const proposalCount = backendMaterializedState.proposals.length;
    return {
      loaded: backendMaterializedState.loaded,
      count: leadCount + simulationCount + proposalCount,
      leadCount,
      simulationCount,
      proposalCount,
      error: backendMaterializedState.error || null,
      source: backendMaterializedState.loaded ? 'sqlite' : 'localStorage'
    };
  }

  function compactText(value, fallback = '-') {
    const text = String(value == null ? '' : value).trim();
    return text || fallback;
  }

  function uiTone(value) {
    if (value === 'alta') return 'warning';
    if (value === 'media') return 'info';
    if (value === 'baixa') return 'stable';
    return value || 'info';
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
    const storageApi = typeof Storage !== 'undefined' && Storage && Storage.loadSimulations ? Storage : null;
    const simulations = storageApi ? storageApi.loadSimulations() : [];
    return sortByRecent(Array.isArray(simulations) ? simulations : []);
  }

  function loadComparatorModels() {
    const models = window.BFComparatorModels && window.BFComparatorModels.list ? window.BFComparatorModels.list() : [];
    return sortByRecent(Array.isArray(models) ? models : []);
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
    const found = service.findByJourney ? service.findByJourney(journey.id, journey.owner) : null;
    return found && service.enrich ? service.enrich(found) : found;
  }

  function loadRecoverySignals() {
    const service = window.BFJourneyRecoveryService;
    if (!service || !service.forCurrentUser) return [];
    return service.forCurrentUser({ includeComplete: true });
  }

  function loadProposalAcceptances() {
    return sortByRecent(listJson('bank_fratern_proposal_acceptances_v1'));
  }

  function loadProposalVersions() {
    return sortByRecent(listJson('bank_fratern_proposal_versions_v1'));
  }

  function decorateHandoffs(items) {
    const service = window.BFHandoffConsultivoService;
    const sorted = sortByRecent(items || []);
    return service && service.enrichList ? service.enrichList(sorted) : sorted;
  }

  function dashboardSnapshot() {
    const backend = backendSnapshotView();
    const backendEntities = backendEntityView();
    const backendMaterialized = backendMaterializedView();
    const profile = backend.profile || loadProfileSnapshot();
    const calculatorHistory = loadCalculatorHistory();
    const simulations = mergeRecords(backend.simulations, loadSimulations(), (item) => item.id);
    const comparatorModels = mergeRecords(backend.comparatorModels, loadComparatorModels(), (item) => item.id || item.modelId);
    const localJourney = loadJourneySnapshot();
    const activeJourney = backend.journey || localJourney.active;
    const journeyHistory = mergeRecords(backend.journey ? [backend.journey] : [], localJourney.history, (item) => item.id);
    const journeyHandoff = loadHandoffForJourney(activeJourney);
    const readiness = window.BFDecisionContext && typeof window.BFDecisionContext.readiness === 'function'
      ? window.BFDecisionContext.readiness(profile)
      : { score: profile.readinessScore || 0, complete: false, missing: [] };
    const rawHandoffs = window.BFHandoffConsultivoService && window.BFHandoffConsultivoService.list
      ? window.BFHandoffConsultivoService.list().filter((item) => !item.ownerEmail || item.ownerEmail === currentUserEmail())
      : [];
    const handoffs = decorateHandoffs(mergeRecords(backend.handoffs, rawHandoffs, (item) => item.id || item.handoffId));
    const handoff = journeyHandoff || handoffs[0] || null;

    return {
      profile,
      hasProfile: Object.keys(profile || {}).length > 0,
      readiness,
      calculatorHistory,
      simulations,
      comparatorModels,
      journey: activeJourney,
      journeyHistory,
      handoff,
      handoffs,
      proposalAcceptances: mergeRecords(backend.proposalAcceptances, loadProposalAcceptances(), (item) => item.id || item.proposalId),
      proposalVersions: mergeRecords(
        backend.proposalVersions,
        loadProposalVersions(),
        (item) => item.versionId || `${item.proposalId || item.id || ''}:${item.version || item.versionLabel || item.createdAt || item.updatedAt || ''}`
      ),
      recoverySignals: loadRecoverySignals(),
      backendSnapshots: {
        loaded: backend.loaded,
        count: backend.count,
        scope: backend.scope,
        error: backend.error,
        source: backend.loaded ? 'sqlite' : 'localStorage'
      },
      backendEntities,
      backendMaterialized
    };
  }

  function activeHandoff(snapshot) {
    const direct = snapshot && snapshot.handoff ? snapshot.handoff : null;
    if (direct) return direct;
    const handoffs = snapshot && Array.isArray(snapshot.handoffs) ? snapshot.handoffs : [];
    return handoffs.find((item) => !['qualificado', 'descartado'].includes(item.status)) || handoffs[0] || null;
  }

  function commercialStageFor(handoff) {
    const service = window.BFHandoffConsultivoService;
    if (!handoff) return null;
    if (handoff.commercialStage) return handoff.commercialStage;
    if (service && service.commercialStageState) return service.commercialStageState(handoff);
    return null;
  }

  function latestByProposalId(records, proposalId) {
    const id = compactText(proposalId, '');
    const source = id ? records.filter((item) => item.proposalId === id) : records;
    return sortByRecent(source)[0] || null;
  }

  function proposalDashboardState(snapshot, handoff) {
    const service = window.BFHandoffConsultivoService;
    const proposalId = handoff && handoff.sourceProposalId ? handoff.sourceProposalId : '';
    const handoffProposal = handoff && service && service.proposalState ? service.proposalState(handoff) : null;
    const acceptance = latestByProposalId(snapshot.proposalAcceptances || [], proposalId);
    const version = latestByProposalId(snapshot.proposalVersions || [], proposalId);
    const hasProposal = Boolean((handoffProposal && handoffProposal.active) || acceptance || version || hasProposalState(snapshot));

    if (handoffProposal && handoffProposal.active) {
      return {
        active: true,
        tone: handoffProposal.tone || 'info',
        label: handoffProposal.label || 'Proposta vinculada',
        detail: handoffProposal.reason || 'Proposta conectada ao atendimento consultivo.',
        status: handoffProposal.status || '',
        version: handoffProposal.version || (version && version.version) || '',
        validUntil: handoffProposal.validUntil || (acceptance && acceptance.validUntil) || '',
        href: dashboardHref('simulador.html#step-9', snapshot, { proposalId })
      };
    }

    if (acceptance) {
      return {
        active: true,
        tone: acceptance.status === 'expired' ? 'warning' : acceptance.status === 'reviewed' ? 'stable' : 'info',
        label: proposalStatusLabels[acceptance.status] || acceptance.statusLabel || 'Proposta em revisao',
        detail: acceptance.notes || 'Revisao local encontrada para continuidade da proposta.',
        status: acceptance.status || '',
        version: acceptance.version || '',
        validUntil: acceptance.validUntil || '',
        href: dashboardHref('simulador.html#step-9', snapshot, { proposalId: acceptance.proposalId || proposalId })
      };
    }

    if (version) {
      return {
        active: true,
        tone: 'stable',
        label: `Versao ${version.version || '-'} salva`,
        detail: 'Snapshot versionado da proposta pronto para revisao ou handoff.',
        status: 'versioned',
        version: version.version || '',
        validUntil: version.validUntil || '',
        href: dashboardHref('simulador.html#step-9', snapshot, { proposalId: version.proposalId || proposalId })
      };
    }

    return {
      active: hasProposal,
      tone: hasProposal ? 'info' : 'warning',
      label: hasProposal ? 'Proposta detectada' : 'Sem proposta revisada',
      detail: hasProposal
        ? 'Existe sinal de proposta no historico local; revise a etapa 9 para travar a versao.'
        : 'Simule e revise a proposta antes de encaminhar para atendimento.',
      status: '',
      version: '',
      validUntil: '',
      href: dashboardHref('simulador.html#step-9', snapshot)
    };
  }

  function simulationDashboardState(snapshot) {
    const simulation = latestSimulation(snapshot);
    if (!simulation) {
      return {
        active: false,
        label: 'Sem simulacao salva',
        detail: 'Abra o simulador com o contexto do dashboard para criar o primeiro cenario.',
        href: dashboardHref('simulador.html', snapshot),
        age: '-'
      };
    }
    const context = simulation.decisionContext || {};
    return {
      active: true,
      label: simulation.nome || simulation.name || 'Simulacao salva',
      detail: context.readinessScore
        ? `Prontidao ${context.readinessScore}/100 e origem ${context.source || 'dashboard'}.`
        : 'Cenario salvo pronto para proposta, carteira ou comparacao.',
      href: dashboardHref(`simulador.html?simulationId=${encodeURIComponent(simulation.id || '')}`, snapshot, {
        calculatorSlug: context.calculatorSlug || '',
        historyId: context.historyId || ''
      }),
      age: ageLabel(simulation.atualizadoEm || simulation.criadoEm || simulation.updatedAt || simulation.createdAt)
    };
  }

  function nextClientAction(snapshot) {
    const handoff = activeHandoff(snapshot);
    const service = window.BFHandoffConsultivoService;
    const topSignal = snapshot.recoverySignals && snapshot.recoverySignals.length ? snapshot.recoverySignals[0] : null;
    if (handoff && service && service.actionPlan) {
      const plan = service.actionPlan(handoff);
      return {
        kind: 'handoff',
        tone: plan.tone || (handoff.priority === 'alta' ? 'warning' : 'stable'),
        eyebrow: 'Atendimento em andamento',
        title: plan.title || (handoff.operational && handoff.operational.nextStep) || 'Acompanhar atendimento',
        detail: plan.reason || 'Lead local tem plano operacional aberto.',
        cta: plan.ctaLabel || 'Abrir atendimento',
        href: dashboardHref(plan.href || 'handoff-consultivo.html#detalhe-handoff', snapshot, { handoffId: handoff.id || '' })
      };
    }
    if (snapshot.journey && snapshot.journey.nextAction) {
      return {
        kind: 'journey',
        tone: 'stable',
        eyebrow: 'Trilha ativa',
        title: snapshot.journey.nextAction.title || 'Revisar proximo passo',
        detail: snapshot.journey.recommendation && snapshot.journey.recommendation.message ? snapshot.journey.recommendation.message : 'A trilha assistida ja definiu a proxima acao.',
        cta: snapshot.journey.nextAction.label || 'Abrir trilha',
        href: dashboardHref(snapshot.journey.nextAction.href || 'trilha-decisao.html', snapshot)
      };
    }
    if (topSignal) {
      return {
        kind: 'signal',
        tone: topSignal.severity === 'alta' ? 'warning' : 'info',
        eyebrow: 'Retomada recomendada',
        title: topSignal.title || 'Retomar jornada',
        detail: topSignal.reason || 'Existe um ponto recente para continuar.',
        cta: topSignal.ctaLabel || 'Abrir retomada',
        href: topSignal.ctaHref || dashboardHref('dashboard-cliente.html#retomadas-cliente', snapshot)
      };
    }
    return {
      kind: snapshot.hasProfile ? 'simulation' : 'profile',
      tone: snapshot.hasProfile ? 'info' : 'warning',
      eyebrow: snapshot.hasProfile ? 'Simulacao orientada' : 'Diagnostico pendente',
      title: snapshot.hasProfile ? 'Criar cenario com contexto' : 'Completar perfil financeiro',
      detail: snapshot.hasProfile ? 'Use os dados ja salvos para abrir o simulador sem recomecar.' : 'Renda, custos, dividas e reserva destravam a recomendacao.',
      cta: snapshot.hasProfile ? 'Abrir simulador' : 'Completar diagnostico',
      href: snapshot.hasProfile ? dashboardHref('simulador.html', snapshot) : dashboardHref('calculadora-custos-fixos.html', snapshot, { calculatorSlug: 'custos-fixos' })
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
    const snapshotSourceLabel = snapshot.backendSnapshots.loaded
      ? `SQLite local (${snapshot.backendSnapshots.count} snapshot${snapshot.backendSnapshots.count === 1 ? '' : 's'})`
      : 'localStorage';

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
          <p>O dashboard consolida perfil, historico, modelos, trilha e handoff para evitar recomecar a jornada do zero. Fonte atual: ${escapeHtml(snapshotSourceLabel)}.</p>
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

  function renderContinuityCockpit() {
    const target = document.querySelector('[data-client-continuity-cockpit]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const handoff = activeHandoff(snapshot);
    const service = window.BFHandoffConsultivoService;
    const stage = commercialStageFor(handoff);
    const proposal = proposalDashboardState(snapshot, handoff);
    const simulation = simulationDashboardState(snapshot);
    const nextAction = nextClientAction(snapshot);
    const statusLabel = handoff
      ? (service && service.statusLabels ? service.statusLabels[handoff.status] : handoffStatusLabels[handoff.status]) || handoff.status || 'Aberto'
      : 'Sem handoff';
    const sourceLabel = handoff && service && service.sourceLabel ? service.sourceLabel(handoff) : 'Jornada local';
    const handoffHref = handoff
      ? dashboardHref('handoff-consultivo.html#detalhe-handoff', snapshot, { handoffId: handoff.id || '' })
      : dashboardHref('handoff-consultivo.html#fila-handoff', snapshot);
    const stageTone = stage && stage.stale ? 'warning' : stage ? 'stable' : 'info';
    const proposalTone = uiTone(proposal.tone);

    target.innerHTML = `
      <div class="bf-client-cockpit">
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Cockpit de retomada</span>
            <span class="bf-badge bf-badge--navy" data-client-backend-snapshots="${escapeHtml(snapshot.backendSnapshots.source)}">${escapeHtml(snapshot.backendSnapshots.loaded ? 'Snapshots SQLite' : 'Fallback local')}</span>
            <span class="bf-badge bf-badge--ok" data-client-backend-entities="${escapeHtml(snapshot.backendEntities.source)}">${escapeHtml(snapshot.backendEntities.loaded ? `Entidades ${snapshot.backendEntities.count}` : 'Entidades locais')}</span>
            <span class="bf-badge bf-badge--gold" data-client-backend-materialized="${escapeHtml(snapshot.backendMaterialized.source)}">${escapeHtml(snapshot.backendMaterialized.loaded ? `Tabelas ${snapshot.backendMaterialized.count}` : 'Tabelas locais')}</span>
            <h2>Onde voce esta e qual acao seguir agora</h2>
            <p>Consolida atendimento, proposta, simulacao e cadencia comercial para continuar a jornada sem perder contexto.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="${escapeHtml(handoffHref)}">Abrir atendimento</a>
        </div>
        <div class="bf-client-cockpit__grid">
          <article class="bf-client-next-action bf-client-next-action--${escapeHtml(uiTone(nextAction.tone))}" data-client-next-action="${escapeHtml(nextAction.kind)}">
            <span>${escapeHtml(nextAction.eyebrow)}</span>
            <strong>${escapeHtml(nextAction.title)}</strong>
            <p>${escapeHtml(nextAction.detail)}</p>
            <a class="btn btn--primary btn--sm" href="${escapeHtml(nextAction.href)}">${escapeHtml(nextAction.cta)}</a>
          </article>
          <div class="bf-client-cockpit__signals">
            <article class="bf-client-signal bf-client-signal--${escapeHtml(handoff ? 'stable' : 'info')}" data-client-handoff-status="${escapeHtml(handoff ? handoff.status || 'novo' : 'none')}">
              <span>Handoff</span>
              <strong>${escapeHtml(statusLabel)}</strong>
              <p>${escapeHtml(handoff ? `${handoff.id} - ${sourceLabel} - ${ageLabel(handoff.updatedAt || handoff.createdAt)}` : 'Nenhum atendimento consultivo ativo para esta jornada.')}</p>
            </article>
            <article class="bf-client-signal bf-client-signal--${escapeHtml(proposalTone || 'info')}" data-client-proposal-status="${escapeHtml(proposal.status || (proposal.active ? 'active' : 'none'))}">
              <span>Proposta</span>
              <strong>${escapeHtml(proposal.label)}</strong>
              <p>${escapeHtml([proposal.version ? `versao ${proposal.version}` : '', proposal.validUntil ? `validade ${proposal.validUntil}` : '', proposal.detail].filter(Boolean).join(' - '))}</p>
              <a href="${escapeHtml(proposal.href)}">Revisar proposta</a>
            </article>
            <article class="bf-client-signal bf-client-signal--${escapeHtml(simulation.active ? 'stable' : 'info')}" data-client-simulation-context="${escapeHtml(simulation.active ? 'ready' : 'empty')}">
              <span>Simulacao</span>
              <strong>${escapeHtml(simulation.label)}</strong>
              <p>${escapeHtml(`${simulation.detail} Aging ${simulation.age}.`)}</p>
              <a href="${escapeHtml(simulation.href)}">Abrir simulador</a>
            </article>
            <article class="bf-client-signal bf-client-signal--${escapeHtml(stageTone)}" data-client-commercial-stage="${escapeHtml(stage ? stage.key || 'contato' : 'none')}">
              <span>Etapa comercial</span>
              <strong>${escapeHtml(stage ? stage.label || 'Contato' : 'Nao iniciada')}</strong>
              <p>${escapeHtml(stage ? `${stage.stale ? 'Retomar etapa' : 'Cadencia ok'} - aging ${stage.stageAgeLabel || '-'} - prazo ${stage.deadlineHours || '-'}h` : 'A etapa comercial aparece quando o handoff entra no funil admin.')}</p>
            </article>
          </div>
        </div>
      </div>
    `;
    document.body.dataset.clientContinuityCockpitReady = 'true';
    document.body.dataset.clientNextAction = nextAction.kind || '';
    document.body.dataset.clientCommercialStage = stage ? stage.key || '' : '';
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
    snapshot.proposalVersions.forEach((item) => events.push({
      type: 'Proposta',
      title: item.title || item.proposalTitle || `Versao ${item.version || item.versionLabel || 'salva'}`,
      date: item.updatedAt || item.createdAt,
      href: dashboardHref('simulador.html#proposta', snapshot, { proposalId: item.proposalId || item.id || '' })
    }));
    snapshot.proposalAcceptances.forEach((item) => events.push({
      type: 'Aceite de proposta',
      title: proposalStatusLabels[item.status] || item.status || item.title || 'Revisao registrada',
      date: item.updatedAt || item.createdAt,
      href: dashboardHref('simulador.html#proposta', snapshot, { proposalId: item.proposalId || item.id || '' })
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
    renderContinuityCockpit();
    renderContinuityTimeline();
    renderRecoverySignals();
    renderClientActivity();
  }

  async function loadBackendSnapshots() {
    const api = backendApi();
    if (!api || typeof api.available !== 'function' || !api.available() || typeof api.listSnapshots !== 'function') {
      document.body.dataset.clientBackendSnapshotsReady = 'fallback';
      document.body.dataset.clientBackendSnapshotCount = '0';
      return false;
    }

    backendSnapshotState = {
      ...backendSnapshotState,
      loading: true,
      error: null
    };

    const result = await api.listSnapshots(100);
    if (!result || !result.ok || !Array.isArray(result.snapshots)) {
      backendSnapshotState = {
        loading: false,
        loaded: false,
        snapshots: [],
        byType: {},
        scope: '',
        error: result && result.message ? result.message : 'Nao foi possivel ler snapshots server-side.'
      };
      document.body.dataset.clientBackendSnapshotsReady = 'fallback';
      document.body.dataset.clientBackendSnapshotCount = '0';
      return false;
    }

    const byType = result.snapshots.reduce((acc, item) => {
      const type = item && item.type ? item.type : 'snapshot';
      if (!acc[type]) acc[type] = [];
      acc[type].push(item);
      return acc;
    }, {});

    backendSnapshotState = {
      loading: false,
      loaded: true,
      snapshots: result.snapshots,
      byType,
      scope: result.scope || '',
      error: null
    };
    document.body.dataset.clientBackendSnapshotsReady = 'true';
    document.body.dataset.clientBackendSnapshotCount = String(result.snapshots.length);
    return true;
  }

  async function loadBackendEntities() {
    const api = backendApi();
    if (!api || typeof api.available !== 'function' || !api.available() || typeof api.listJourneyEntities !== 'function') {
      document.body.dataset.clientBackendEntitiesReady = 'fallback';
      document.body.dataset.clientBackendEntityCount = '0';
      return false;
    }

    backendEntityState = {
      ...backendEntityState,
      loading: true,
      error: null
    };

    const result = await api.listJourneyEntities(100);
    if (!result || !result.ok || !Array.isArray(result.entities)) {
      backendEntityState = {
        loading: false,
        loaded: false,
        entities: [],
        summary: {},
        scope: '',
        error: result && result.message ? result.message : 'Nao foi possivel ler entidades server-side.'
      };
      document.body.dataset.clientBackendEntitiesReady = 'fallback';
      document.body.dataset.clientBackendEntityCount = '0';
      return false;
    }

    backendEntityState = {
      loading: false,
      loaded: true,
      entities: result.entities,
      summary: result.summary || {},
      scope: result.scope || '',
      error: null
    };
    document.body.dataset.clientBackendEntitiesReady = 'true';
    document.body.dataset.clientBackendEntityCount = String(result.entities.length);
    return true;
  }

  async function loadBackendMaterializedTables() {
    const api = backendApi();
    const hasMethods = api &&
      typeof api.available === 'function' &&
      api.available() &&
      typeof api.listLeads === 'function' &&
      typeof api.listSimulations === 'function' &&
      typeof api.listProposals === 'function';
    if (!hasMethods) {
      document.body.dataset.clientBackendMaterializedReady = 'fallback';
      document.body.dataset.clientBackendMaterializedCount = '0';
      return false;
    }

    backendMaterializedState = {
      ...backendMaterializedState,
      loading: true,
      error: null
    };

    const [leadResult, simulationResult, proposalResult] = await Promise.all([
      api.listLeads(30),
      api.listSimulations(30),
      api.listProposals(30)
    ]);
    if (!leadResult.ok || !simulationResult.ok || !proposalResult.ok) {
      backendMaterializedState = {
        loading: false,
        loaded: false,
        leads: [],
        simulations: [],
        proposals: [],
        error: 'Nao foi possivel ler tabelas materializadas.'
      };
      document.body.dataset.clientBackendMaterializedReady = 'fallback';
      document.body.dataset.clientBackendMaterializedCount = '0';
      return false;
    }

    backendMaterializedState = {
      loading: false,
      loaded: true,
      leads: Array.isArray(leadResult.leads) ? leadResult.leads : [],
      simulations: Array.isArray(simulationResult.simulations) ? simulationResult.simulations : [],
      proposals: Array.isArray(proposalResult.proposals) ? proposalResult.proposals : [],
      error: null
    };
    document.body.dataset.clientBackendMaterializedReady = 'true';
    document.body.dataset.clientBackendMaterializedCount = String(backendMaterializedView().count);
    return true;
  }

  function renderLiveDataPanel() {
    const target = document.querySelector('[data-client-live-data-panel]');
    if (!target) return;

    const snapshots = backendSnapshotView();
    const entities = backendEntityView();
    const materialized = backendMaterializedView();
    const loading = backendSnapshotState.loading || backendEntityState.loading || backendMaterializedState.loading;
    const hasLiveData = snapshots.loaded || entities.loaded || materialized.loaded;
    const hasError = snapshots.error || entities.error || materialized.error;
    const source = hasLiveData ? 'sqlite' : 'localStorage';
    const sourceLabel = hasLiveData ? 'SQLite local' : 'localStorage';
    const readiness = loading ? 'loading' : hasLiveData ? 'true' : hasError ? 'error' : 'fallback';
    const recordCount = Number(snapshots.count || 0) + Number(entities.count || 0) + Number(materialized.count || 0);
    const refreshedAt = new Date().toISOString();
    const statusCopy = loading
      ? 'Atualizando leitura server-side da jornada.'
      : hasLiveData
        ? 'A jornada esta usando dados vivos do backend local com fallback preservado.'
        : 'Abra por localhost e entre com usuario para ativar SQLite; por enquanto a tela usa os dados locais do navegador.';

    target.dataset.clientLiveSource = source;
    target.dataset.clientLiveRefresh = refreshedAt;
    document.body.dataset.clientLiveDataReady = readiness;
    document.body.dataset.clientLiveDataSource = source;
    document.body.dataset.clientLiveDataRecords = String(recordCount);
    document.body.dataset.clientLiveDataRefreshedAt = refreshedAt;

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge ${hasLiveData ? 'bf-badge--ok' : 'bf-badge--gold'}" data-client-live-source="${escapeHtml(source)}">${escapeHtml(sourceLabel)}</span>
          <h2>Dados vivos da jornada do cliente</h2>
          <p>${escapeHtml(statusCopy)}</p>
          ${hasError ? `<small>${escapeHtml(hasError)}</small>` : ''}
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-client-live-refresh>${loading ? 'Atualizando...' : 'Atualizar dados'}</button>
      </div>
      <div class="bf-platform-metrics">
        ${window.BFCards ? window.BFCards.metric('Snapshots', snapshots.count || 0, snapshots.loaded ? 'is-strong' : '') : ''}
        ${window.BFCards ? window.BFCards.metric('Entidades', entities.count || 0, entities.loaded ? 'is-strong' : '') : ''}
        ${window.BFCards ? window.BFCards.metric('Leads', materialized.leadCount || 0, materialized.leadCount ? 'is-warn' : '') : ''}
        ${window.BFCards ? window.BFCards.metric('Simulacoes', materialized.simulationCount || 0) : ''}
        ${window.BFCards ? window.BFCards.metric('Propostas', materialized.proposalCount || 0) : ''}
      </div>
      <div class="bf-client-activity">
        <article class="bf-client-activity__item">
          <span>Fonte ativa</span>
          <strong>${escapeHtml(sourceLabel)}</strong>
          <small>${escapeHtml(hasLiveData ? `Escopo ${snapshots.scope || entities.scope || 'usuario'}` : 'Fallback local preservado para abrir o projeto sem servidor.')}</small>
        </article>
        <article class="bf-client-activity__item">
          <span>Ultima leitura</span>
          <strong>${escapeHtml(formatDate(refreshedAt))}</strong>
          <small>${escapeHtml(recordCount ? `${recordCount} registros lidos para compor a experiencia.` : 'Sem registros server-side retornados nesta sessao.')}</small>
        </article>
      </div>
    `;
  }

  function renderSnapshotAwareSections() {
    renderLiveDataPanel();
    renderCalculatorProfile();
    renderDecisionJourney();
    renderComparatorModels();
    renderContinuityCenter();
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
    const snapshot = dashboardSnapshot();
    const models = snapshot.comparatorModels.slice(0, 8);

    if (models.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum modelo de comparacao salvo ainda. Abra o comparador, ajuste a matriz e salve um modelo nomeado.</div>';
      return;
    }

    target.innerHTML = models.map((model) => `
      <article class="bf-history-item" data-client-comparator-model="${escapeHtml(model.id)}">
        <span>${escapeHtml(String(model.source || '').startsWith('standard:') ? 'Modelo da biblioteca' : 'Modelo de comparacao')}</span>
        <strong>${escapeHtml(model.name)}</strong>
        <small>${escapeHtml(presetLabels[model.preset] || (model.preset || 'manual').replace(/_/g, ' '))} - atualizado em ${escapeHtml(formatDate(model.updatedAt))}</small>
        <a href="${window.BFComparatorModels && window.BFComparatorModels.route ? window.BFComparatorModels.route(model.id) : dashboardHref('comparador.html', snapshot, { modelId: model.id || '' })}">Abrir modelo</a>
      </article>
    `).join('');
  }

  function renderCalculatorProfile() {
    const profileTarget = document.querySelector('[data-client-financial-profile]');
    const historyTarget = document.querySelector('[data-client-calculator-history]');
    const snapshot = dashboardSnapshot();
    const profile = snapshot.profile || {};
    const history = snapshot.calculatorHistory.slice(0, 8);
    const readiness = snapshot.readiness || { score: profile.readinessScore || 0, complete: false };
    const hasProfile = Object.keys(profile).length > 0;
    const sourceLabel = snapshot.backendSnapshots.loaded ? 'SQLite local' : 'localStorage';

    if (profileTarget) {
      profileTarget.innerHTML = `
        <div class="bf-calculator-profile">
          <div>
            <span class="bf-badge bf-badge--ok" data-client-backend-snapshots="${escapeHtml(snapshot.backendSnapshots.source)}">${escapeHtml(sourceLabel)}</span>
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

    const snapshot = dashboardSnapshot();
    const journey = snapshot.journey;
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
    const handoff = activeHandoff(snapshot);
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
          <p>${escapeHtml(handoff ? `Handoff ${handoff.id} em status ${(handoffService && handoffService.statusLabels && handoffService.statusLabels[handoff.status]) || handoff.status}.` : (next.title || 'Proxima acao definida para este usuario.'))}</p>
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

    renderSnapshotAwareSections();
    renderStandardModels();
    Promise.all([loadBackendSnapshots(), loadBackendEntities(), loadBackendMaterializedTables()]).then((results) => {
      if (results.some(Boolean)) renderSnapshotAwareSections();
    });

    document.addEventListener('click', (event) => {
      const refreshButton = event.target.closest('[data-client-live-refresh]');
      if (refreshButton) {
        refreshButton.disabled = true;
        renderLiveDataPanel();
        Promise.all([loadBackendSnapshots(), loadBackendEntities(), loadBackendMaterializedTables()])
          .then(() => renderSnapshotAwareSections())
          .catch(() => renderSnapshotAwareSections());
        return;
      }

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
