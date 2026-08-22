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
    reviewed: 'Pronta para conferir',
    partial: 'Conferência pendente',
    pending: 'Em conferência',
    expired: 'Validade encerrada'
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

  let proposalInterestState = {
    loading: false,
    loaded: false,
    identityKey: '',
    interest: null,
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

  function formatCalendarDate(value) {
    if (!value) return '';
    const text = String(value).trim();
    const civilDate = /^(\d{4})-(\d{2})-(\d{2})(?:$|T)/.exec(text);
    if (civilDate) return `${civilDate[3]}/${civilDate[2]}/${civilDate[1]}`;
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric'
      }).format(new Date(value));
    } catch (error) {
      return text;
    }
  }

  function currentUserRole() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return user && user.role ? user.role : '';
  }

  function currentUser() {
    return window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
  }

  function calculatorPage(slug) {
    if (slug === 'simulador-consorcio') return 'simulador.html';
    if (slug === 'comparador') return 'comparador.html';
    return `calculadora-${slug}.html`;
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

  function calculatorImpactHref(item, target = 'calculator') {
    const slug = item && item.calculatorSlug ? item.calculatorSlug : '';
    const historyId = item && item.id ? item.id : '';
    const params = {
      from: 'dashboard',
      sourceFrom: 'calculator-impact',
      calculatorSlug: slug,
      historyId,
      preset: calculatorPreset(slug)
    };
    if (target === 'simulator') return appendQuery('simulador.html', params);
    if (target === 'journey') return appendQuery('trilha-decisao.html', params);
    return appendQuery(calculatorPage(slug), params);
  }

  function latestSimulation(snapshot) {
    return (snapshot.simulations || [])[0] || null;
  }

  function hasProposalState(snapshot) {
    return Boolean(
      (snapshot.proposalVersions || []).length
      || (snapshot.proposalAcceptances || []).length
      || (snapshot.simulations || []).some((item) => (
      item.proposalAcceptance ||
      item.proposta ||
      item.proposal ||
      item.statusProposta
      ))
    );
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

  function primaryMetric(item) {
    const metrics = Array.isArray(item && item.metrics) ? item.metrics : [];
    return metrics[0] || { label: 'Resultado', value: '-' };
  }

  function calculatorImpactItems(history, readiness) {
    return sortByRecent((history || []).filter((item) => item && item.calculatorSlug !== 'simulador-consorcio')).map((item) => {
      const recommendation = item.recommendation || {};
      const metric = primaryMetric(item);
      const metrics = Array.isArray(item.metrics) ? item.metrics : [];
      const profilePatch = item.profilePatch || {};
      const score = Math.max(0, Math.min(100, Number(item.readinessScore || profilePatch.readinessScore || (readiness && readiness.score) || 0)));
      const hasWarnMetric = metrics.some((entry) => entry && entry.tone === 'warn');
      const hasCapacity = Number(profilePatch.capacidadePagamento || profilePatch.capacidadeAporte || 0) > 0;
      const hasBid = Number(profilePatch.lanceProprioSugerido || 0) > 0;
      const slug = item.calculatorSlug || '';
      let risk = 'monitor';
      let riskLabel = 'Monitorar';
      let tone = 'info';
      let cta = 'Reabrir calculadora';
      let href = calculatorImpactHref(item, 'calculator');
      let action = 'review-calculator';

      if (recommendation.tone === 'warn' || hasWarnMetric) {
        risk = 'review-required';
        riskLabel = 'Revisar risco';
        tone = 'warning';
        cta = 'Revisar calculo';
      } else if (score < 60) {
        risk = 'profile-incomplete';
        riskLabel = 'Completar perfil';
        tone = 'warning';
        cta = 'Completar diagnostico';
      } else if (hasBid || hasCapacity || ['capacidade-credito', 'lance-consorcio'].includes(slug)) {
        risk = 'simulation-ready';
        riskLabel = 'Pronto para simular';
        tone = 'stable';
        cta = 'Simular com contexto';
        href = calculatorImpactHref(item, 'simulator');
        action = 'simulate-from-calculator';
      }

      return {
        id: item.id || `${slug}-${item.createdAt || ''}`,
        calculatorSlug: slug,
        calculatorName: item.calculatorName || slug || 'Calculadora',
        historyId: item.id || '',
        ownerEmail: currentUserEmail(),
        title: recommendation.title || item.calculatorName || 'Calculo salvo',
        detail: recommendation.message || `${metric.label}: ${metric.value}`,
        risk,
        riskLabel,
        tone,
        score,
        metric,
        recommendation,
        metrics,
        profilePatch,
        createdAt: item.createdAt || item.updatedAt || '',
        cta,
        href,
        action,
        nextAction: {
          type: action,
          title: riskLabel,
          label: cta,
          href
        }
      };
    });
  }

  function calculatorImpactSummary(snapshot) {
    const impacts = snapshot && Array.isArray(snapshot.calculatorImpacts) ? snapshot.calculatorImpacts : [];
    const top = impacts.find((item) => item.tone === 'warning') || impacts.find((item) => item.risk === 'simulation-ready') || impacts[0] || null;
    return {
      total: impacts.length,
      warning: impacts.filter((item) => item.tone === 'warning').length,
      ready: impacts.filter((item) => item.risk === 'simulation-ready').length,
      top
    };
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
    const calculatorImpacts = calculatorImpactItems(calculatorHistory, readiness);
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
      calculatorImpacts,
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

  function proposalContext(snapshot, handoff) {
    const versions = sortByRecent(snapshot.proposalVersions || []);
    const acceptances = sortByRecent(snapshot.proposalAcceptances || []);
    const simulations = snapshot.simulations || [];
    const handoffProposalId = compactText(handoff && handoff.sourceProposalId, '');
    const requestedVersion = handoff && handoff.sourceProposalVersionId
      ? versions.find((item) => item.id === handoff.sourceProposalVersionId || item.versionId === handoff.sourceProposalVersionId)
      : null;
    const initialVersion = requestedVersion
      || latestByProposalId(versions, handoffProposalId)
      || versions[0]
      || null;
    const initialAcceptance = latestByProposalId(acceptances, handoffProposalId || (initialVersion && initialVersion.proposalId))
      || acceptances[0]
      || null;
    const inlineSimulation = simulations.find((item) => item.proposalAcceptance || item.proposta || item.proposal || item.statusProposta) || null;
    const inlineAcceptance = inlineSimulation && inlineSimulation.proposalAcceptance && typeof inlineSimulation.proposalAcceptance === 'object'
      ? inlineSimulation.proposalAcceptance
      : null;
    const proposalId = handoffProposalId
      || compactText(initialVersion && initialVersion.proposalId, '')
      || compactText(initialAcceptance && initialAcceptance.proposalId, '')
      || compactText(inlineAcceptance && inlineAcceptance.proposalId, '')
      || compactText(inlineSimulation && (inlineSimulation.proposalId || inlineSimulation.id), '');
    const version = requestedVersion || latestByProposalId(versions, proposalId) || initialVersion;
    const acceptance = latestByProposalId(acceptances, proposalId) || initialAcceptance || inlineAcceptance;
    const simulationId = compactText(
      (version && version.simulationId)
        || (acceptance && acceptance.simulationId)
        || (inlineSimulation && inlineSimulation.id),
      ''
    );

    return {
      proposalId,
      version,
      acceptance,
      simulationId,
      versionId: compactText(version && (version.id || version.versionId), ''),
      active: Boolean(proposalId || version || acceptance || hasProposalState(snapshot))
    };
  }

  function proposalHref(snapshot, proposalId, simulationId = '', proposalVersionId = '') {
    return dashboardHref('simulador.html#proposta', snapshot, {
      proposalId,
      simulationId,
      proposalVersionId,
      proposalView: currentUserRole() === 'cliente' && (proposalId || simulationId) ? 'client' : ''
    });
  }

  function consultativeServiceHref(snapshot, extra = {}) {
    return currentUserRole() === 'cliente'
      ? dashboardHref('dashboard-cliente.html#continuidade-cliente', snapshot)
      : dashboardHref('handoff-consultivo.html#fila-handoff', snapshot, extra);
  }

  function proposalInterestCommitmentDetail(interest) {
    const commitment = interest && interest.contactCommitment;
    const date = new Date(commitment && commitment.responseDueAt ? commitment.responseDueAt : '');
    if (!Number.isFinite(date.getTime())) return '';
    const responsible = compactText(commitment && commitment.responsible, 'Equipe Bancus Fraternis');
    const channel = compactText(commitment && commitment.channel, '').toLocaleLowerCase('pt-BR');
    return `${responsible} retornará até ${formatDate(date.toISOString())}${channel ? ` pelos ${channel}` : ''}.`;
  }

  function proposalInterestView() {
    const interest = proposalInterestState.interest;
    const status = compactText(interest && interest.status, '');
    const commitmentDetail = proposalInterestCommitmentDetail(interest);
    if (status === 'in_progress') {
      return {
        active: true,
        status,
        label: 'Atendimento em andamento',
        detail: commitmentDetail || 'A equipe já está acompanhando esta proposta.'
      };
    }
    if (status === 'closed') {
      return {
        active: true,
        status,
        label: 'Atendimento concluído',
        detail: 'O retorno sobre esta proposta foi concluído.'
      };
    }
    if (status === 'requested') {
      return {
        active: true,
        status,
        label: 'Solicitação recebida',
        detail: commitmentDetail || 'Um consultor acompanhará esta proposta com você.'
      };
    }
    return { active: false, status: '', label: '', detail: '' };
  }

  function proposalDashboardState(snapshot, handoff) {
    const service = window.BFHandoffConsultivoService;
    const context = proposalContext(snapshot, handoff);
    const proposalId = context.proposalId;
    const handoffProposal = handoff && service && service.proposalState ? service.proposalState(handoff) : null;
    const acceptance = context.acceptance;
    const version = context.version;
    const hasProposal = Boolean((handoffProposal && handoffProposal.active) || context.active);
    const href = proposalHref(snapshot, proposalId, context.simulationId, context.versionId);

    if (handoffProposal && handoffProposal.active) {
      return {
        active: true,
        tone: handoffProposal.tone || 'info',
        label: handoffProposal.label || 'Proposta vinculada',
        detail: currentUserRole() === 'cliente'
          ? 'Confira os valores, as parcelas e as condições da proposta.'
          : handoffProposal.reason || 'Proposta vinculada ao atendimento.',
        status: handoffProposal.status || '',
        version: handoffProposal.version || (version && version.version) || '',
        validUntil: handoffProposal.validUntil || (acceptance && acceptance.validUntil) || '',
        proposalId,
        simulationId: context.simulationId,
        versionId: context.versionId,
        updatedAt: (acceptance && (acceptance.updatedAt || acceptance.createdAt)) || (version && (version.updatedAt || version.createdAt)) || '',
        href
      };
    }

    if (acceptance) {
      const status = acceptance.status || '';
      return {
        active: true,
        tone: status === 'expired' ? 'warning' : status === 'reviewed' ? 'stable' : 'info',
        label: proposalStatusLabels[status] || acceptance.statusLabel || 'Proposta em conferência',
        detail: status === 'expired'
          ? 'Peça uma versão atualizada para continuar.'
          : status === 'reviewed'
            ? 'Confira os valores, o plano de parcelas e as condições.'
            : 'As condições estão sendo conferidas antes do próximo passo.',
        status,
        version: acceptance.version || (version && version.version) || '',
        validUntil: acceptance.validUntil || (version && version.validUntil) || '',
        proposalId: acceptance.proposalId || proposalId,
        simulationId: context.simulationId,
        versionId: context.versionId,
        updatedAt: acceptance.updatedAt || acceptance.createdAt || '',
        href
      };
    }

    if (version) {
      return {
        active: true,
        tone: 'stable',
        label: 'Proposta pronta',
        detail: 'Confira os valores, o plano de parcelas e as condições.',
        status: 'versioned',
        version: version.version || '',
        validUntil: version.validUntil || '',
        proposalId: version.proposalId || proposalId,
        simulationId: context.simulationId,
        versionId: context.versionId,
        updatedAt: version.updatedAt || version.createdAt || '',
        href
      };
    }

    return {
      active: hasProposal,
      tone: hasProposal ? 'info' : 'warning',
      label: hasProposal ? 'Proposta disponível' : 'Nenhuma proposta criada',
      detail: hasProposal
        ? 'Abra a proposta para conferir os valores e as condições.'
        : 'Comece uma simulação para receber uma proposta completa.',
      status: '',
      version: '',
      validUntil: '',
      proposalId,
      simulationId: context.simulationId,
      versionId: context.versionId,
      updatedAt: '',
      href
    };
  }

  function simulationDashboardState(snapshot) {
    const simulation = latestSimulation(snapshot);
    if (!simulation) {
      return {
        active: false,
        label: 'Nenhuma simulação salva',
        detail: 'Escolha os grupos e monte seu primeiro cenário.',
        href: dashboardHref('simulador.html', snapshot),
        age: '-'
      };
    }
    const context = simulation.decisionContext || {};
    const simulationLabel = simulation.nome || simulation.name || 'Simulação salva';
    return {
      active: true,
      label: /^Proposta\s+PROP-/i.test(simulationLabel) ? 'Cenário vinculado à proposta' : simulationLabel,
      detail: 'Continue a simulação ou abra a proposta vinculada.',
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
    const proposal = proposalDashboardState(snapshot, handoff);
    const interest = proposalInterestView();
    if (proposal.active) {
      const expired = proposal.status === 'expired';
      const validity = proposal.validUntil ? formatCalendarDate(proposal.validUntil) : '';
      return {
        kind: 'proposal',
        tone: expired ? 'warning' : 'stable',
        eyebrow: expired ? 'Proposta vencida' : interest.active ? interest.label : handoff ? 'Atendimento em andamento' : 'Sua proposta está pronta',
        title: expired ? 'Peça uma proposta atualizada' : (interest.active || handoff) ? 'Sua proposta está em acompanhamento' : 'Confira valores e condições',
        detail: expired
          ? 'Abra a proposta para solicitar uma atualização antes de decidir.'
          : (interest.active || handoff)
            ? `${interest.active ? interest.detail : 'Seu pedido foi recebido.'} Você também pode rever crédito, parcelas e condições.${validity ? ` A proposta é válida até ${validity}.` : ''}`
            : `Revise o crédito, as parcelas, o lance e os próximos eventos.${validity ? ` A proposta é válida até ${validity}.` : ''}`,
        cta: expired ? 'Ver e pedir atualização' : 'Ver proposta',
        href: proposal.href
      };
    }
    if (handoff && service && service.actionPlan) {
      const plan = service.actionPlan(handoff);
      return {
        kind: 'handoff',
        tone: plan.tone || (handoff.priority === 'alta' ? 'warning' : 'stable'),
        eyebrow: 'Atendimento em andamento',
        title: plan.title || (handoff.operational && handoff.operational.nextStep) || 'Acompanhar atendimento',
        detail: 'Seu atendimento já está registrado. Acompanhe as próximas orientações por aqui.',
        cta: 'Ver andamento',
        href: dashboardHref('dashboard-cliente.html#atividade-recente', snapshot)
      };
    }
    if (snapshot.journey && snapshot.journey.nextAction) {
      return {
        kind: 'journey',
        tone: 'stable',
        eyebrow: 'Planejamento em andamento',
        title: snapshot.journey.nextAction.title || 'Veja o próximo passo',
        detail: snapshot.journey.recommendation && snapshot.journey.recommendation.message ? snapshot.journey.recommendation.message : 'Seu planejamento já tem uma próxima ação definida.',
        cta: snapshot.journey.nextAction.label || 'Continuar planejamento',
        href: dashboardHref(snapshot.journey.nextAction.href || 'trilha-decisao.html', snapshot)
      };
    }
    const impactSummary = calculatorImpactSummary(snapshot);
    if (impactSummary.top) {
      const impact = impactSummary.top;
      return {
        kind: `calculator-${impact.risk}`,
        tone: impact.tone,
        eyebrow: 'Antes de simular',
        title: impact.title,
        detail: `${impact.riskLabel}: ${impact.detail}`,
        cta: impact.cta,
        href: impact.href
      };
    }
    const topSignal = snapshot.recoverySignals && snapshot.recoverySignals.length ? snapshot.recoverySignals[0] : null;
    if (topSignal) {
      return {
        kind: 'signal',
        tone: topSignal.severity === 'alta' ? 'warning' : 'info',
        eyebrow: 'Continue de onde parou',
        title: topSignal.title || 'Retomar simulação',
        detail: topSignal.reason || 'Há uma atividade recente pronta para continuar.',
        cta: topSignal.ctaLabel || 'Continuar',
        href: topSignal.ctaHref || dashboardHref('dashboard-cliente.html#retomadas-cliente', snapshot)
      };
    }
    return {
      kind: snapshot.hasProfile ? 'simulation' : 'profile',
      tone: snapshot.hasProfile ? 'info' : 'warning',
      eyebrow: snapshot.hasProfile ? 'Nova simulação' : 'Prepare sua simulação',
      title: snapshot.hasProfile ? 'Criar um novo cenário' : 'Complete seus dados financeiros',
      detail: snapshot.hasProfile ? 'Seus dados já estão prontos para uma nova simulação.' : 'Renda, despesas e reserva ajudam a encontrar uma parcela confortável.',
      cta: snapshot.hasProfile ? 'Abrir simulador' : 'Completar dados',
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
    const impactSummary = calculatorImpactSummary(snapshot);
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
        title: impactSummary.warning ? `${impactSummary.warning} impacto${impactSummary.warning === 1 ? '' : 's'} a revisar` : recoverySummary.open ? `${recoverySummary.open} sinal${recoverySummary.open === 1 ? '' : 'is'} aberto${recoverySummary.open === 1 ? '' : 's'}` : `${totalHistory} registro${totalHistory === 1 ? '' : 's'} conectados`,
        body: impactSummary.warning && impactSummary.top
          ? `${impactSummary.top.calculatorName}: ${impactSummary.top.detail}`
          : topSignal
          ? `${topSignal.title}: ${topSignal.reason}`
          : `${snapshot.simulations.length} simulacoes (${contextualSimulations} com contexto), ${snapshot.calculatorHistory.length} calculadoras e ${snapshot.comparatorModels.length} modelos locais.`,
        action: impactSummary.warning ? 'Revisar impacto' : topSignal ? topSignal.ctaLabel : (totalHistory > 0 ? 'Retomar atividade' : 'Criar primeira simulacao')
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

  function renderDashboardShell() {
    const snapshot = dashboardSnapshot();
    const handoff = activeHandoff(snapshot);
    const proposal = proposalDashboardState(snapshot, handoff);
    const interest = proposalInterestView();
    const user = currentUser();
    const firstName = String((user && user.name) || '').trim().split(/\s+/)[0];
    const sessionBadge = document.querySelector('[data-client-session]');
    const hero = document.querySelector('[data-client-dashboard-hero]');
    const title = document.querySelector('[data-client-dashboard-title]');
    const description = document.querySelector('[data-client-dashboard-description]');
    const rail = document.querySelector('[data-client-dashboard-actions]');
    const stats = document.querySelector('[data-dashboard-stats]');
    const financialProfile = document.querySelector('[data-client-financial-profile]');
    const activityTitle = document.querySelector('[data-client-activity-title]');

    document.body.dataset.clientPostProposal = proposal.active ? 'true' : 'false';
    document.body.dataset.clientProposalId = proposal.proposalId || '';
    document.body.dataset.clientProposalInterest = interest.status || 'none';
    if (hero) hero.classList.toggle('is-post-proposal', proposal.active);
    if (sessionBadge) {
      sessionBadge.textContent = user && user.role === 'cliente'
        ? (firstName ? `Olá, ${firstName}` : 'Minha conta')
        : 'Visão do cliente';
    }

    if (proposal.active) {
      const expired = proposal.status === 'expired';
      const validity = proposal.validUntil ? ` até ${formatCalendarDate(proposal.validUntil)}` : '';
      if (title) title.textContent = expired
        ? 'Sua proposta precisa ser atualizada.'
        : interest.status === 'requested'
          ? 'Seu pedido foi recebido.'
          : (interest.active || handoff)
            ? 'Seu atendimento está em andamento.'
            : 'Sua proposta está pronta para conferir.';
      if (description) description.textContent = expired
        ? 'Confira as condições e peça uma nova versão antes de avançar.'
        : (interest.active || handoff)
          ? `${interest.active ? interest.detail : 'Acompanhe o retorno'} Consulte sua proposta sempre que precisar.`
          : `Revise valores, parcelas e próximos passos${validity}.`;
      if (rail) {
        rail.innerHTML = `
          <a href="${escapeHtml(proposal.href)}">Ver proposta <span aria-hidden="true">PR</span></a>
          <a href="simulador.html?from=dashboard">Nova simulação <span aria-hidden="true">NS</span></a>
          <a href="#continuidade-cliente">${interest.active || handoff ? 'Ver atendimento' : 'Próximo passo'} <span aria-hidden="true">AT</span></a>
        `;
      }
      if (activityTitle) activityTitle.textContent = 'Sua proposta e atividades recentes';
    } else {
      if (title) title.textContent = 'Planeje seu consórcio com clareza.';
      if (description) description.textContent = 'Simule grupos, compare cenários e acompanhe suas propostas.';
      if (rail) {
        rail.innerHTML = `
          <a href="simulador.html?from=dashboard">Nova simulação <span aria-hidden="true">NS</span></a>
          <a href="#atividade-recente">Minhas propostas <span aria-hidden="true">PR</span></a>
          <a href="comparador.html?from=dashboard">Comparar cenários <span aria-hidden="true">CP</span></a>
        `;
      }
      if (activityTitle) activityTitle.textContent = 'Propostas e simulações recentes';
    }

    [stats, financialProfile].forEach((section) => {
      if (!section) return;
      section.hidden = proposal.active;
      section.setAttribute('aria-hidden', proposal.active ? 'true' : 'false');
    });
  }

  function renderContinuityCockpit() {
    const target = document.querySelector('[data-client-continuity-cockpit]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const handoff = activeHandoff(snapshot);
    const service = window.BFHandoffConsultivoService;
    const stage = commercialStageFor(handoff);
    const proposal = proposalDashboardState(snapshot, handoff);
    const interest = proposalInterestView();
    const simulation = simulationDashboardState(snapshot);
    const nextAction = nextClientAction(snapshot);
    const impactSummary = calculatorImpactSummary(snapshot);
    const topImpact = impactSummary.top;
    const statusLabel = handoff
      ? (service && service.statusLabels ? service.statusLabels[handoff.status] : handoffStatusLabels[handoff.status]) || handoff.status || 'Aberto'
      : interest.active ? interest.label : proposal.active ? 'Disponível pela proposta' : 'Ainda não solicitado';
    const proposalTone = uiTone(proposal.tone);
    const proposalDetail = proposal.validUntil
      ? `Válida até ${formatCalendarDate(proposal.validUntil)}. ${proposal.detail}`
      : proposal.detail;
    const proposalIsPrimary = nextAction.kind === 'proposal';
    const proposalSignal = proposalIsPrimary
      ? `<span hidden data-client-proposal-status="${escapeHtml(proposal.status || 'active')}"></span>`
      : `
        <article class="bf-client-signal bf-client-signal--${escapeHtml(proposalTone || 'info')}" data-client-proposal-status="${escapeHtml(proposal.status || (proposal.active ? 'active' : 'none'))}">
          <span>Proposta</span>
          <strong>${escapeHtml(proposal.label)}</strong>
          <p>${escapeHtml(proposalDetail)}</p>
          <a href="${escapeHtml(proposal.href)}">Ver proposta</a>
        </article>
      `;
    const serviceActive = Boolean(handoff || interest.active);
    const serviceHref = serviceActive ? '#atividade-recente' : proposal.active ? proposal.href : 'simulador.html?from=dashboard';
    const serviceAction = serviceActive ? 'Ver atividades' : proposal.active ? 'Solicitar pela proposta' : 'Começar simulação';

    target.innerHTML = `
      <div class="bf-client-cockpit">
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">${proposal.active ? 'Sua proposta' : 'Próximo passo'}</span>
            <h2>${proposal.active ? 'Avance sem perder o contexto' : 'Continue de onde parou'}</h2>
            <p>${proposal.active ? 'Condições, cenário e atendimento estão reunidos aqui.' : 'Sua simulação e seus próximos passos estão reunidos aqui.'}</p>
          </div>
        </div>
        <div class="bf-client-cockpit__grid">
          <article class="bf-client-next-action bf-client-next-action--${escapeHtml(uiTone(nextAction.tone))}" data-client-next-action="${escapeHtml(nextAction.kind)}">
            <span>${escapeHtml(nextAction.eyebrow)}</span>
            <strong>${escapeHtml(nextAction.title)}</strong>
            <p>${escapeHtml(nextAction.detail)}</p>
            <a class="btn btn--primary btn--sm" href="${escapeHtml(nextAction.href)}">${escapeHtml(nextAction.cta)}</a>
          </article>
          <div class="bf-client-cockpit__signals">
            ${proposalSignal}
            <article class="bf-client-signal bf-client-signal--${escapeHtml(simulation.active ? 'stable' : 'info')}" data-client-simulation-context="${escapeHtml(simulation.active ? 'ready' : 'empty')}">
              <span>${proposal.active ? 'Cenário da proposta' : 'Simulação'}</span>
              <strong>${escapeHtml(simulation.label)}</strong>
              <p>${escapeHtml(proposal.active ? 'Confira os grupos, as parcelas e o lance usados nesta proposta.' : simulation.detail)}</p>
              <a href="${escapeHtml(simulation.href)}">${proposal.active ? 'Ver cenário' : 'Abrir simulador'}</a>
            </article>
            <article class="bf-client-signal bf-client-signal--${escapeHtml(serviceActive ? 'stable' : 'info')}" data-client-handoff-status="${escapeHtml(handoff ? handoff.status || 'novo' : interest.status || 'none')}">
              <span>Atendimento</span>
              <strong>${escapeHtml(statusLabel)}</strong>
              <p>${escapeHtml(handoff ? 'Seu pedido está em acompanhamento.' : interest.active ? interest.detail : proposal.active ? 'Peça ajuda ou tire dúvidas diretamente na proposta.' : 'Simule para receber uma proposta e falar com um consultor.')}</p>
              <a href="${escapeHtml(serviceHref)}">${escapeHtml(serviceAction)}</a>
            </article>
            <span hidden data-client-backend-snapshots="${escapeHtml(snapshot.backendSnapshots.source)}"></span>
            <span hidden data-client-backend-entities="${escapeHtml(snapshot.backendEntities.source)}"></span>
            <span hidden data-client-backend-materialized="${escapeHtml(snapshot.backendMaterialized.source)}"></span>
            <span hidden data-client-calculator-impact="${escapeHtml(topImpact ? topImpact.risk : 'empty')}" data-client-calculator-impact-risk="${escapeHtml(topImpact ? topImpact.risk : 'empty')}"></span>
            <span hidden data-client-commercial-stage="${escapeHtml(stage ? stage.key || 'contato' : 'none')}"></span>
          </div>
        </div>
      </div>
    `;
    document.body.dataset.clientContinuityCockpitReady = 'true';
    document.body.dataset.clientNextAction = nextAction.kind || '';
    document.body.dataset.clientCommercialStage = stage ? stage.key || '' : '';
    document.body.dataset.clientCalculatorImpactCount = String(impactSummary.total || 0);
    document.body.dataset.clientCalculatorImpactRisk = topImpact ? topImpact.risk : 'empty';
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
    const proposalVersion = sortByRecent(snapshot.proposalVersions || [])[0] || null;
    const proposalAcceptance = latestByProposalId(
      snapshot.proposalAcceptances || [],
      proposalVersion && proposalVersion.proposalId
    );
    const timelineProposalId = (proposalVersion && proposalVersion.proposalId)
      || (proposalAcceptance && proposalAcceptance.proposalId)
      || (simulation && (simulation.proposalId || simulation.proposalAcceptance?.proposalId))
      || '';
    const timelineSimulationId = (proposalVersion && proposalVersion.simulationId)
      || (simulation && simulation.id)
      || '';
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
        href: proposalHref(
          snapshot,
          timelineProposalId,
          timelineSimulationId,
          proposalVersion && proposalVersion.id
        ),
        status: hasProposal ? 'done' : (hasSimulation ? 'active' : 'pending')
      },
      {
        label: 'Handoff',
        title: hasHandoff ? 'Atendimento consultivo criado' : 'Preparar atendimento',
        text: hasHandoff ? 'Lead local pronto para acompanhamento operacional.' : 'Gere handoff quando a trilha estiver revisada.',
        href: consultativeServiceHref(snapshot, { journeyId }),
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

  function proposalActivityItems(snapshot) {
    const proposals = new Map();
    const ensure = (proposalId, fallbackId) => {
      const key = compactText(proposalId || fallbackId, '');
      if (!key) return null;
      if (!proposals.has(key)) proposals.set(key, { proposalId: key, version: null, acceptance: null });
      return proposals.get(key);
    };

    sortByRecent(snapshot.proposalVersions || []).forEach((item) => {
      const proposal = ensure(item.proposalId, item.id || item.versionId);
      if (proposal && !proposal.version) proposal.version = item;
    });
    sortByRecent(snapshot.proposalAcceptances || []).forEach((item) => {
      const proposal = ensure(item.proposalId, item.id);
      if (proposal && !proposal.acceptance) proposal.acceptance = item;
    });

    return Array.from(proposals.values()).map((proposal) => {
      const version = proposal.version || {};
      const acceptance = proposal.acceptance || {};
      const status = acceptance.status || '';
      const versionLabel = acceptance.version || version.versionLabel || version.version || '';
      const validUntil = acceptance.validUntil || version.validUntil || '';
      const meta = [];
      if (versionLabel) meta.push(/^vers[aã]o/i.test(String(versionLabel)) ? String(versionLabel) : `Versão ${versionLabel}`);
      if (validUntil) meta.push(`Válida até ${formatCalendarDate(validUntil)}`);
      return {
        key: `proposal:${proposal.proposalId}`,
        proposalId: proposal.proposalId,
        simulationId: version.simulationId || acceptance.simulationId || '',
        type: 'Proposta',
        title: proposalStatusLabels[status] || acceptance.statusLabel || 'Proposta pronta',
        meta: meta.join(' · '),
        date: acceptance.updatedAt || acceptance.createdAt || version.updatedAt || version.createdAt,
        href: proposalHref(
          snapshot,
          proposal.proposalId,
          version.simulationId || acceptance.simulationId || '',
          version.id || version.versionId || ''
        )
      };
    });
  }

  function renderClientActivity() {
    const target = document.querySelector('[data-client-activity]');
    if (!target) return;

    const snapshot = dashboardSnapshot();
    const events = [];
    const proposalEvents = proposalActivityItems(snapshot);
    const linkedSimulationIds = new Set(proposalEvents.map((item) => item.simulationId).filter(Boolean));
    const linkedProposalIds = new Set(proposalEvents.map((item) => item.proposalId).filter(Boolean));
    snapshot.simulations.forEach((item) => {
      const linkedProposalId = item.proposalId || (item.proposalAcceptance && item.proposalAcceptance.proposalId) || '';
      if (linkedSimulationIds.has(item.id) || linkedProposalIds.has(linkedProposalId)) return;
      const context = item.decisionContext || {};
      events.push({
        key: `simulation:${item.id || item.nome || item.name || ''}`,
        type: 'Simulação',
        title: item.nome || 'Simulação de consórcio',
        date: item.atualizadoEm || item.criadoEm,
        href: dashboardHref(`simulador.html?simulationId=${encodeURIComponent(item.id)}`, snapshot, {
          calculatorSlug: context.calculatorSlug || '',
          historyId: context.historyId || ''
        })
      });
    });
    snapshot.calculatorHistory.forEach((item) => events.push({
      key: `calculator:${item.id || item.createdAt || ''}`,
      type: item.calculatorName || 'Calculadora',
      title: item.recommendation ? item.recommendation.title : 'Cálculo salvo',
      date: item.createdAt,
      href: dashboardHref(calculatorPage(item.calculatorSlug), snapshot, {
        calculatorSlug: item.calculatorSlug || '',
        historyId: item.id || ''
      })
    }));
    snapshot.comparatorModels.forEach((item) => events.push({
      key: `comparison:${item.id || item.modelId || ''}`,
      type: 'Comparação',
      title: item.name,
      date: item.updatedAt || item.createdAt,
      href: window.BFComparatorModels && window.BFComparatorModels.route ? window.BFComparatorModels.route(item.id) : 'comparador.html'
    }));
    if (snapshot.journey) {
      events.push({
        key: `journey:${snapshot.journey.id || ''}`,
        type: 'Planejamento',
        title: snapshot.journey.recommendation ? snapshot.journey.recommendation.title : snapshot.journey.objectiveLabel,
        date: snapshot.journey.updatedAt || snapshot.journey.createdAt,
        href: dashboardHref('trilha-decisao.html', snapshot)
      });
    }
    snapshot.handoffs.forEach((item) => events.push({
      key: `service:${item.id || item.handoffId || ''}`,
      type: 'Atendimento',
      title: item.objectiveLabel || 'Atendimento consultivo',
      date: item.updatedAt || item.createdAt,
      href: consultativeServiceHref(snapshot, { handoffId: item.id || '' })
    }));
    events.push(...proposalEvents);
    const interest = proposalInterestView();
    if (interest.active) {
      events.push({
        key: `proposal-interest:${proposalInterestState.interest.id || interest.status}`,
        type: 'Atendimento',
        title: interest.label,
        meta: interest.detail,
        date: proposalInterestState.interest.requestedAt || '',
        href: '#continuidade-cliente'
      });
    }
    snapshot.recoverySignals.forEach((signal) => events.push({
      key: `recovery:${signal.id || signal.type || signal.latestEventAt || ''}`,
      type: 'Próximo passo',
      title: signal.title || 'Continuar atividade',
      date: signal.latestEventAt,
      href: signal.ctaHref || 'dashboard-cliente.html'
    }));

    const sorted = events
      .filter((item) => item.title)
      .sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')))
      .filter((item, index, items) => items.findIndex((candidate) => candidate.key === item.key) === index)
      .slice(0, 6);

    if (!sorted.length) {
      target.innerHTML = '<div class="bf-empty-state">Você ainda não tem atividades. Comece uma simulação para comparar grupos e gerar sua proposta.</div>';
      return;
    }

    target.innerHTML = sorted.map((item) => `
      <article class="bf-client-activity__item" data-client-activity-key="${escapeHtml(item.key || '')}">
        <span>${escapeHtml(item.type)}</span>
        <strong>${escapeHtml(item.title)}</strong>
        <small>${escapeHtml(item.meta ? `${item.meta} · ${formatDate(item.date)}` : formatDate(item.date))}</small>
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
        <a class="btn btn--ghost btn--sm" href="${escapeHtml(consultativeServiceHref(snapshot))}">${currentUserRole() === 'cliente' ? 'Pedir atendimento' : 'Abrir atendimento'}</a>
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

  async function loadProposalInterest() {
    const api = backendApi();
    if (!api || typeof api.available !== 'function' || !api.available() || typeof api.getProposalInterest !== 'function') {
      document.body.dataset.clientProposalInterestReady = 'fallback';
      return false;
    }

    const snapshot = dashboardSnapshot();
    const context = proposalContext(snapshot, activeHandoff(snapshot));
    if (!context.active || !context.proposalId || !context.versionId) {
      proposalInterestState = { loading: false, loaded: true, identityKey: '', interest: null, error: null };
      document.body.dataset.clientProposalInterestReady = 'none';
      return false;
    }

    const identityKey = `${context.proposalId}|${context.versionId}|${context.simulationId}`;
    if (proposalInterestState.loading || (proposalInterestState.loaded && proposalInterestState.identityKey === identityKey)) {
      return Boolean(proposalInterestState.interest);
    }

    proposalInterestState = { loading: true, loaded: false, identityKey, interest: null, error: null };
    document.body.dataset.clientProposalInterestReady = 'loading';
    const response = await api.getProposalInterest({
      proposalId: context.proposalId,
      proposalVersionId: context.versionId,
      simulationId: context.simulationId
    });
    proposalInterestState = {
      loading: false,
      loaded: Boolean(response && response.ok),
      identityKey,
      interest: response && response.ok ? response.interest || null : null,
      error: response && response.ok ? null : (response && response.message) || 'Atendimento indisponível.'
    };
    document.body.dataset.clientProposalInterestReady = response && response.ok ? 'true' : 'fallback';
    document.body.dataset.clientProposalInterest = proposalInterestState.interest?.status || 'none';
    return Boolean(response && response.ok);
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
    renderDashboardShell();
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
    const impacts = snapshot.calculatorImpacts.slice(0, 8);
    const readiness = snapshot.readiness || { score: profile.readinessScore || 0, complete: false };
    const hasProfile = Object.keys(profile).length > 0;
    const proposal = proposalDashboardState(snapshot, activeHandoff(snapshot));

    if (profileTarget) {
      if (proposal.active) {
        profileTarget.hidden = true;
        profileTarget.setAttribute('aria-hidden', 'true');
        profileTarget.dataset.clientFinancialProfileState = 'deferred';
        profileTarget.innerHTML = '';
      } else {
        profileTarget.hidden = false;
        profileTarget.setAttribute('aria-hidden', 'false');
        profileTarget.dataset.clientFinancialProfileState = 'active';
        profileTarget.innerHTML = `
          <div class="bf-calculator-profile">
            <div>
              <span class="bf-badge bf-badge--ok">Planejamento financeiro</span>
              <h2>${hasProfile ? 'Seus dados estão prontos para novas simulações' : 'Planeje uma parcela que cabe no seu orçamento'}</h2>
              <p>${hasProfile ? 'Use sua renda, suas despesas e sua reserva para comparar cenários com mais segurança.' : 'Informe renda, despesas e reserva para encontrar uma parcela confortável antes de escolher os grupos.'}</p>
              <div class="bf-inline-actions">
                <a class="btn btn--primary btn--sm" href="calculadora-capacidade-credito.html">Calcular capacidade</a>
                <a class="btn btn--ghost btn--sm" href="calculadora-lance-consorcio.html">Planejar lance</a>
                <a class="btn btn--ghost btn--sm" href="simulador.html?from=journey&journeyId=dashboard-cliente">Simular agora</a>
              </div>
              <span hidden data-client-backend-snapshots="${escapeHtml(snapshot.backendSnapshots.source)}"></span>
            </div>
            <div class="bf-calculator-profile__metrics">
              <div><small>Dados preenchidos</small><strong>${readiness.score || 0}%</strong></div>
              <div><small>Renda</small><strong>${profile.rendaMensal ? money(profile.rendaMensal) : '-'}</strong></div>
              <div><small>Capacidade</small><strong>${profile.capacidadePagamento ? money(profile.capacidadePagamento) : (profile.capacidadeAporte ? money(profile.capacidadeAporte) : '-')}</strong></div>
              <div><small>Reserva</small><strong>${profile.reservaAtual ? money(profile.reservaAtual) : '-'}</strong></div>
              <div><small>Comprometimento</small><strong>${profile.comprometimentoRenda ? percent(profile.comprometimentoRenda) : '-'}</strong></div>
            </div>
          </div>
        `;
      }
    }

    if (!historyTarget) return;
    if (history.length === 0 || impacts.length === 0) {
      historyTarget.innerHTML = '<div class="bf-empty-state">Nenhuma simulacao financeira salva ainda. Use o hub de calculadoras para criar historico.</div>';
      return;
    }

    historyTarget.innerHTML = impacts.map((impact) => `
      <article class="bf-history-item bf-client-calculator-impact bf-client-calculator-impact--${escapeHtml(impact.tone)}" data-client-calculator-impact-item="${escapeHtml(impact.id)}" data-client-calculator-impact-risk="${escapeHtml(impact.risk)}" data-client-calculator-impact-action="${escapeHtml(impact.action)}">
        <span>${escapeHtml(impact.calculatorName)} - ${escapeHtml(impact.riskLabel)}</span>
        <strong>${escapeHtml(impact.title)}</strong>
        <small>${escapeHtml(formatDate(impact.createdAt))} - ${escapeHtml(impact.metric.label)}: ${escapeHtml(impact.metric.value)} - prontidao ${escapeHtml(impact.score)}/100</small>
        <div class="bf-inline-actions bf-inline-actions--compact">
          <a href="${escapeHtml(calculatorImpactHref(impact, 'calculator'))}">Reabrir</a>
          <a href="${escapeHtml(impact.href)}">${escapeHtml(impact.cta)}</a>
          <button class="btn btn--ghost btn--sm" type="button" data-client-create-calculator-handoff="${escapeHtml(impact.id)}">Enviar para handoff</button>
        </div>
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
    const handoffHref = consultativeServiceHref(snapshot, {
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

  document.addEventListener('DOMContentLoaded', async function () {
    if (window.BFAuth && window.BFAuth.ready) await window.BFAuth.ready;
    const user = window.BFAuth.requireRole(['admin', 'consultor', 'cliente'], { redirect: true });
    if (!user) return;

    const target = document.querySelector('[data-client-session]');
    if (target) target.textContent = String(user.name || '').trim().split(/\s+/)[0] || 'Minha conta';

    renderSnapshotAwareSections();
    renderStandardModels();
    Promise.all([loadBackendSnapshots(), loadBackendEntities(), loadBackendMaterializedTables()]).then(async (results) => {
      const interestLoaded = await loadProposalInterest();
      if (results.some(Boolean) || interestLoaded) renderSnapshotAwareSections();
    });

    document.addEventListener('click', (event) => {
      const refreshButton = event.target.closest('[data-client-live-refresh]');
      if (refreshButton) {
        refreshButton.disabled = true;
        renderLiveDataPanel();
        Promise.all([loadBackendSnapshots(), loadBackendEntities(), loadBackendMaterializedTables()])
          .then(() => loadProposalInterest())
          .then(() => renderSnapshotAwareSections())
          .catch(() => renderSnapshotAwareSections());
        return;
      }

      const button = event.target.closest('[data-client-create-handoff]');
      const calculatorButton = event.target.closest('[data-client-create-calculator-handoff]');
      if (calculatorButton && window.BFHandoffConsultivoService && window.BFHandoffConsultivoService.createFromCalculatorImpact) {
        const snapshot = dashboardSnapshot();
        const impact = (snapshot.calculatorImpacts || []).find((item) => item.id === calculatorButton.dataset.clientCreateCalculatorHandoff);
        if (!impact) return;
        const existing = window.BFHandoffConsultivoService.findByCalculatorImpact
          ? window.BFHandoffConsultivoService.findByCalculatorImpact(impact.historyId || impact.id, user.email)
          : null;
        window.BFHandoffConsultivoService.createFromCalculatorImpact(impact, { ownerName: user.name, ownerEmail: user.email });
        renderSnapshotAwareSections();
        const nextButton = Array.from(document.querySelectorAll('[data-client-create-calculator-handoff]'))
          .find((item) => item.dataset.clientCreateCalculatorHandoff === impact.id);
        if (nextButton) {
          nextButton.textContent = existing ? 'Handoff atualizado' : 'Handoff criado';
          nextButton.disabled = true;
        }
        return;
      }

      if (!button || !window.BFHandoffConsultivoService || !window.BFTrilhaDecisaoService) return;
      const journey = window.BFTrilhaDecisaoService.load();
      if (!journey) return;
      window.BFHandoffConsultivoService.createFromJourney(journey, { ownerName: user.name });
      renderDecisionJourney();
      renderContinuityCenter();
    });
  });
})();
