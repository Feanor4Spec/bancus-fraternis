(function () {
  'use strict';

  const JOURNEY_ANALYTICS_KEY = 'bf_journey_analytics_v1';

  function safeStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function readJson(key, fallback) {
    const storage = safeStorage();
    if (!storage) return fallback;
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function storageKeys() {
    const storage = safeStorage();
    if (!storage) return [];
    if (Number.isFinite(Number(storage.length)) && typeof storage.key === 'function') {
      const keys = [];
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (key) keys.push(key);
      }
      return keys;
    }
    return Object.keys(storage);
  }

  function currentUserEmail() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return user && user.email ? user.email : 'anon';
  }

  function ownerFromKey(key) {
    return String(key || '').replace(`${JOURNEY_ANALYTICS_KEY}:`, '') || 'anon';
  }

  function eventHoursSince(value) {
    if (!value) return 0;
    const time = new Date(value).getTime();
    if (!Number.isFinite(time)) return 0;
    return Math.max(0, Math.round((Date.now() - time) / 36e5));
  }

  function eventAgeLabel(hours) {
    const value = Number(hours || 0);
    if (value < 1) return 'agora';
    if (value < 24) return `${value}h sem continuidade`;
    return `${Math.floor(value / 24)}d sem continuidade`;
  }

  function severityFromHours(hours) {
    const value = Number(hours || 0);
    if (value >= 24) return 'alta';
    if (value >= 4) return 'media';
    return 'baixa';
  }

  function signalWeight(signal) {
    const stageWeights = {
      selected: 2,
      compare: 3,
      decision: 4,
      saved: 5,
      simulator: 1,
      complete: 0
    };
    const severityWeights = { alta: 3, media: 2, baixa: 1 };
    return (stageWeights[signal.stage] || 0) * 10 + (severityWeights[signal.severity] || 0);
  }

  function normalizeEvent(event, ownerEmail) {
    return {
      ...(event || {}),
      ownerEmail: event && event.ownerEmail ? event.ownerEmail : ownerEmail,
      detail: event && event.detail && typeof event.detail === 'object' ? event.detail : {}
    };
  }

  function loadEvents() {
    if (window.BFJourneyAnalytics && typeof window.BFJourneyAnalytics.all === 'function') {
      const events = window.BFJourneyAnalytics.all();
      if (Array.isArray(events) && events.length) return events.map((event) => normalizeEvent(event, event.ownerEmail || 'anon'));
    }

    return storageKeys()
      .filter((key) => key.startsWith(`${JOURNEY_ANALYTICS_KEY}:`))
      .flatMap((key) => {
        const owner = ownerFromKey(key);
        const events = readJson(key, []);
        return Array.isArray(events) ? events.map((event) => normalizeEvent(event, owner)) : [];
      });
  }

  function groupByOwner(events) {
    return (events || []).reduce((groups, event) => {
      const owner = event.ownerEmail || 'anon';
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(event);
      return groups;
    }, {});
  }

  function hasType(events, types) {
    const set = new Set(types);
    return events.some((event) => set.has(event.type));
  }

  function hasPrefix(events, prefix) {
    return events.some((event) => String(event.type || '').startsWith(prefix));
  }

  function collectProductIds(events) {
    const ids = new Set();
    events.forEach((event) => {
      const detail = event.detail || {};
      if (detail.productId) ids.add(detail.productId);
      (detail.selectionIds || detail.productIds || []).forEach((id) => ids.add(id));
    });
    return Array.from(ids);
  }

  function latestDetailValue(events, key) {
    const event = events.find((item) => item.detail && item.detail[key]);
    return event && event.detail ? event.detail[key] : '';
  }

  function signalId(owner, type, latest) {
    const seed = latest && latest.id ? latest.id : `${type}-${latest && latest.createdAt ? latest.createdAt : 'sem-data'}`;
    return `SIG-${String(owner || 'anon').replace(/[^a-z0-9]+/gi, '-').slice(0, 34)}-${type}-${String(seed).replace(/[^a-z0-9]+/gi, '-').slice(0, 28)}`;
  }

  function baseSignal(owner, type, stage, latest, events) {
    const hours = eventHoursSince(latest && latest.createdAt);
    const severity = severityFromHours(hours);
    return {
      id: signalId(owner, type, latest),
      type,
      stage,
      ownerEmail: owner || 'anon',
      ownerRole: latest && latest.ownerRole ? latest.ownerRole : '',
      ownerRoleLabel: latest && latest.ownerRoleLabel ? latest.ownerRoleLabel : '',
      severity,
      priority: severity,
      hours,
      age: eventAgeLabel(hours),
      latestEventType: latest && latest.type ? latest.type : '',
      latestEventAt: latest && latest.createdAt ? latest.createdAt : '',
      eventCount: events.length,
      productIds: collectProductIds(events),
      winner: latestDetailValue(events, 'winner'),
      simulator: latestDetailValue(events, 'simulator'),
      readyForHandoff: type !== 'simulator-ready'
    };
  }

  function signalFromOwnerEvents(owner, ownerEvents) {
    const events = (ownerEvents || [])
      .filter(Boolean)
      .sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    if (!events.length) return null;

    const latest = events[0];
    const hasSelection = hasType(events, ['product_selected', 'product_top3_selected']);
    const hasCompare = hasType(events, ['products_compare_open', 'comparator_loaded_from_products']);
    const hasMatrix = hasType(events, ['comparator_calculated']);
    const hasSaved = hasType(events, ['comparator_saved']);
    const hasSimulatorOpen = hasType(events, ['simulator_opened_from_comparator', 'simulator_opened_from_products']);
    const hasSimulatorCalculated = hasPrefix(events, 'simulator_calculated');

    if (hasSelection && !hasCompare) {
      return {
        ...baseSignal(owner, 'selection-no-comparator', 'selected', latest, events),
        title: 'Selecao sem comparador',
        reason: 'Cliente escolheu produtos, mas ainda nao abriu a matriz comparativa.',
        ctaLabel: 'Retomar produtos',
        ctaHref: 'produtos.html'
      };
    }

    if (hasCompare && !hasMatrix) {
      return {
        ...baseSignal(owner, 'comparator-no-matrix', 'compare', latest, events),
        title: 'Comparador sem matriz',
        reason: 'Produtos chegaram ao comparador, mas nenhum calculo foi concluido.',
        ctaLabel: 'Abrir comparador',
        ctaHref: 'comparador.html'
      };
    }

    if (hasMatrix && !hasSaved && !hasSimulatorOpen && !hasSimulatorCalculated) {
      return {
        ...baseSignal(owner, 'decision-no-continuity', 'decision', latest, events),
        title: 'Decisao sem continuidade',
        reason: 'Matriz calculada sem cenario salvo ou simulador acionado em seguida.',
        ctaLabel: 'Revisar decisao',
        ctaHref: 'comparador.html'
      };
    }

    if (hasSimulatorOpen && !hasSimulatorCalculated) {
      return {
        ...baseSignal(owner, 'simulator-open-no-calc', 'simulator', latest, events),
        title: 'Simulador aberto sem calculo',
        reason: 'Cliente saiu do comparador para o simulador, mas ainda nao concluiu o calculo.',
        ctaLabel: 'Abrir simulador',
        ctaHref: latestDetailValue(events, 'href') || 'simulador-financiamento.html'
      };
    }

    if (hasSaved && !hasSimulatorCalculated) {
      return {
        ...baseSignal(owner, 'saved-no-simulator', 'saved', latest, events),
        title: 'Cenario salvo sem simulador',
        reason: 'Comparacao salva ainda nao virou simulacao detalhada ou handoff consultivo.',
        ctaLabel: 'Abrir simulador',
        ctaHref: 'simulador.html'
      };
    }

    if (hasSimulatorCalculated) {
      return {
        ...baseSignal(owner, 'simulator-ready', 'complete', latest, events),
        title: 'Simulacao pronta para handoff',
        reason: 'Jornada tem simulador calculado e pode seguir para carteira ou atendimento.',
        ctaLabel: 'Acompanhar continuidade',
        ctaHref: 'dashboard-cliente.html',
        readyForHandoff: true
      };
    }

    return null;
  }

  function list(options = {}) {
    const events = loadEvents();
    const groups = groupByOwner(events);
    const ownerFilter = options.ownerEmail || '';
    return Object.keys(groups)
      .filter((owner) => !ownerFilter || owner === ownerFilter)
      .map((owner) => signalFromOwnerEvents(owner, groups[owner]))
      .filter(Boolean)
      .filter((signal) => options.includeComplete === true || signal.type !== 'simulator-ready')
      .sort((a, b) => {
        const byWeight = signalWeight(b) - signalWeight(a);
        if (byWeight) return byWeight;
        return Number(b.hours || 0) - Number(a.hours || 0);
      });
  }

  function forCurrentUser(options = {}) {
    return list({ ...options, ownerEmail: currentUserEmail(), includeComplete: options.includeComplete === true });
  }

  function summary(signals = list({ includeComplete: true })) {
    const source = Array.isArray(signals) ? signals : [];
    const open = source.filter((signal) => signal.type !== 'simulator-ready').length;
    const ready = source.filter((signal) => signal.readyForHandoff).length;
    return {
      total: source.length,
      open,
      readyForHandoff: ready,
      high: source.filter((signal) => signal.severity === 'alta').length,
      medium: source.filter((signal) => signal.severity === 'media').length,
      low: source.filter((signal) => signal.severity === 'baixa').length,
      owners: new Set(source.map((signal) => signal.ownerEmail || 'anon')).size,
      top: source[0] || null
    };
  }

  function find(id, options = {}) {
    return list({ includeComplete: true, ...options }).find((signal) => signal.id === id) || null;
  }

  window.BFJourneyRecoveryService = {
    list,
    forCurrentUser,
    summary,
    find,
    keys: {
      analytics: JOURNEY_ANALYTICS_KEY
    }
  };
})();
