(function () {
  'use strict';

  const PROFILE_KEY = 'bf_financial_profile_v1';
  const HISTORY_KEY = 'bf_calculator_history_v1';
  const AUDIT_KEY = 'bf_decision_context_audit_v1';
  const MAX_AUDIT = 120;
  const MAX_HISTORY = 80;

  const PERSONAL_KEYS = new Set([
    'cpf',
    'documento',
    'telefone',
    'phone',
    'whatsapp',
    'email',
    'nome',
    'nomeCliente',
    'cliente',
    'consultor'
  ]);

  function storage() {
    try {
      return window.localStorage;
    } catch (error) {
      return null;
    }
  }

  function readJson(key, fallback) {
    const store = storage();
    if (!store) return fallback;
    try {
      const raw = store.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    const store = storage();
    if (!store) return false;
    try {
      store.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function toNumber(value) {
    const numeric = Number(value);
    return Number.isFinite(numeric) ? numeric : 0;
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function timestamp() {
    return new Date().toISOString();
  }

  function uid(prefix) {
    return `${prefix}_${Date.now()}_${Math.random().toString(16).slice(2, 8)}`;
  }

  function sanitizePatch(patch) {
    const clean = {};
    Object.entries(patch || {}).forEach(([key, value]) => {
      if (!PERSONAL_KEYS.has(key) && value !== undefined && value !== null && value !== '') {
        clean[key] = value;
      }
    });
    return clean;
  }

  function snapshotProfile(profile) {
    const clean = sanitizePatch(profile || {});
    const allowedKeys = [
      'rendaMensal',
      'gastoMensal',
      'custosMensais',
      'dividasMensais',
      'reservaAtual',
      'reservaIdeal',
      'coberturaReservaPct',
      'capacidadeAporte',
      'capacidadePagamento',
      'comprometimentoRenda',
      'comprometimentoProjetado',
      'valorCredito',
      'valorCarta',
      'parcelaProjetada',
      'ultimoProduto',
      'lanceProprioSugerido',
      'lanceProprioSugeridoPct',
      'lanceSeguroPct',
      'taxaOportunidadeMes',
      'updatedAt'
    ];
    return allowedKeys.reduce((acc, key) => {
      if (clean[key] !== undefined) acc[key] = clean[key];
      return acc;
    }, {});
  }

  function recordEvent(type, payload) {
    const list = readJson(AUDIT_KEY, []);
    const event = {
      id: uid('ctx'),
      type,
      payload: sanitizePatch(payload || {}),
      createdAt: timestamp()
    };
    writeJson(AUDIT_KEY, [event, ...list].slice(0, MAX_AUDIT));
    return event;
  }

  function loadProfile() {
    return readJson(PROFILE_KEY, {});
  }

  function saveProfilePatch(patch, source) {
    const clean = sanitizePatch(patch || {});
    const profile = {
      ...loadProfile(),
      ...clean,
      updatedAt: timestamp()
    };
    writeJson(PROFILE_KEY, profile);
    recordEvent('profile-patch', {
      source: source || 'decision-context',
      keys: Object.keys(clean)
    });
    return profile;
  }

  function loadHistory() {
    const history = readJson(HISTORY_KEY, []);
    return Array.isArray(history) ? history : [];
  }

  function saveHistoryEntry(entry) {
    const history = loadHistory();
    const cleanEntry = {
      id: entry.id || uid('hist'),
      createdAt: entry.createdAt || timestamp(),
      ...entry,
      profilePatch: sanitizePatch(entry.profilePatch || {}),
      decisionContext: entry.decisionContext ? sanitizePatch(entry.decisionContext) : undefined
    };
    writeJson(HISTORY_KEY, [cleanEntry, ...history].slice(0, MAX_HISTORY));
    return cleanEntry;
  }

  function readiness(profileInput) {
    const profile = profileInput || loadProfile();
    const renda = toNumber(profile.rendaMensal);
    const gastos = toNumber(profile.gastoMensal || profile.custosMensais);
    const reserva = toNumber(profile.reservaAtual);
    const reservaIdeal = toNumber(profile.reservaIdeal) || gastos * 6;
    const capacidade = toNumber(profile.capacidadePagamento || profile.capacidadeAporte);
    const missing = [];

    if (renda <= 0) missing.push({ key: 'renda', label: 'Renda mensal', calculatorSlug: 'custos-fixos' });
    if (gastos <= 0) missing.push({ key: 'custos', label: 'Custos fixos', calculatorSlug: 'custos-fixos' });
    if (reserva <= 0) missing.push({ key: 'reserva', label: 'Reserva atual', calculatorSlug: 'reserva-emergencia' });
    if (capacidade <= 0) missing.push({ key: 'capacidade', label: 'Capacidade segura', calculatorSlug: 'capacidade-credito' });

    const rendaScore = renda > 0 ? 20 : 0;
    const gastosScore = gastos > 0 ? 20 : 0;
    const reservaScore = reservaIdeal > 0 ? clamp((reserva / reservaIdeal) * 25, 0, 25) : 0;
    const capacidadeScore = capacidade > 0 ? 25 : 0;
    const historicoScore = loadHistory().length > 0 ? 10 : 0;
    const score = Math.round(rendaScore + gastosScore + reservaScore + capacidadeScore + historicoScore);
    const level = score >= 80 ? 'pronto' : score >= 55 ? 'orientado' : score >= 30 ? 'parcial' : 'diagnostico';
    const tone = score >= 80 ? 'success' : score >= 55 ? 'warning' : 'danger';

    return {
      score,
      level,
      tone,
      complete: missing.length === 0,
      missing,
      title: score >= 80 ? 'Pronto para simular' : 'Diagnostico recomendado',
      message:
        missing.length === 0
          ? 'Perfil financeiro suficiente para uma simulacao mais orientada.'
          : `Complete ${missing[0].label.toLowerCase()} antes de comparar cenarios.`
    };
  }

  function recommendedCalculators(profileInput) {
    const status = readiness(profileInput || loadProfile());
    const slugs = [];
    status.missing.forEach((item) => {
      if (!slugs.includes(item.calculatorSlug)) slugs.push(item.calculatorSlug);
    });
    ['compra-vista-parcelado', 'comparador', 'lance-consorcio'].forEach((slug) => {
      if (!slugs.includes(slug)) slugs.push(slug);
    });
    return slugs.slice(0, 5);
  }

  function getUrlSource() {
    const params = new URLSearchParams(window.location.search || '');
    return {
      source: params.get('from') || undefined,
      calculatorSlug: params.get('calculatorSlug') || undefined,
      historyId: params.get('historyId') || undefined,
      journeyId: params.get('journeyId') || undefined
    };
  }

  function findHistory(source) {
    const history = loadHistory();
    if (source.historyId) {
      const found = history.find((item) => String(item.id) === String(source.historyId));
      if (found) return found;
    }
    if (source.calculatorSlug) {
      return history.find((item) => item.calculatorSlug === source.calculatorSlug);
    }
    return null;
  }

  function buildObservation(source, status, history) {
    const parts = [];
    if (source.source === 'calculator' && source.calculatorSlug) {
      parts.push(`Origem: calculadora ${source.calculatorSlug}.`);
    } else if (source.source === 'journey' && source.journeyId) {
      parts.push(`Origem: jornada ${source.journeyId}.`);
    } else {
      parts.push('Origem: perfil financeiro local.');
    }
    parts.push(`Prontidao financeira: ${status.score}/100.`);
    if (history && history.recommendation) parts.push(`Ultima recomendacao: ${history.recommendation}`);
    return parts.join(' ');
  }

  function inferObjective(source, history, profile) {
    if (profile.ultimoProduto) return profile.ultimoProduto;
    if (history && history.calculatorName) return history.calculatorName;
    if (source.source === 'journey') return 'Jornada assistida';
    return 'Simulacao orientada';
  }

  function inferTargetValue(profile, history) {
    const input = history && history.input ? history.input : {};
    return (
      toNumber(input.valorCredito) ||
      toNumber(input.valorCarta) ||
      toNumber(input.precoCheio) ||
      toNumber(input.valorVista) ||
      toNumber(input.meta) ||
      toNumber(profile.valorCredito) ||
      toNumber(profile.valorCarta) ||
      0
    );
  }

  function buildSimulationPrefill(sourceInput) {
    const source = { ...getUrlSource(), ...(sourceInput || {}) };
    const profile = loadProfile();
    const history = findHistory(source);
    const mergedProfile = {
      ...profile,
      ...(history && history.profilePatch ? history.profilePatch : {})
    };
    const status = readiness(mergedProfile);
    const value = inferTargetValue(mergedProfile, history);
    const prefill = {
      clienteObjetivo: inferObjective(source, history, mergedProfile),
      valorAlvo: value > 0 ? value : undefined,
      capacidadePagamento: toNumber(mergedProfile.capacidadePagamento || mergedProfile.capacidadeAporte) || undefined,
      reservaAtual: toNumber(mergedProfile.reservaAtual) || undefined,
      lanceProprioSugerido: toNumber(mergedProfile.lanceProprioSugerido) || undefined,
      lanceProprioSugeridoPct: toNumber(mergedProfile.lanceProprioSugeridoPct || mergedProfile.lanceSeguroPct) || undefined,
      observacoes: buildObservation(source, status, history)
    };

    return {
      source: source.source || (history ? 'calculator' : 'profile'),
      calculatorSlug: source.calculatorSlug || (history && history.calculatorSlug) || undefined,
      historyId: source.historyId || (history && history.id) || undefined,
      journeyId: source.journeyId,
      readinessScore: status.score,
      readiness: status,
      profileSnapshot: snapshotProfile(mergedProfile),
      prefill
    };
  }

  function recordSimulation(simulation) {
    const decision = simulation && simulation.decisionContext ? simulation.decisionContext : buildSimulationPrefill();
    const prefill = decision.prefill || {};
    const profileSnapshot = decision.profileSnapshot || {};
    const params = (simulation && simulation.params) || {};
    const resumo = (simulation && simulation.resumo) || {};
    const valorCredito = toNumber(params.valorCarta || prefill.valorAlvo || profileSnapshot.valorCredito);
    const parcelaProjetada = toNumber(resumo.parcelaMedia || resumo.parcelaBase || profileSnapshot.parcelaProjetada);
    const renda = toNumber(profileSnapshot.rendaMensal);
    const comprometimentoProjetado = renda > 0 && parcelaProjetada > 0 ? (parcelaProjetada / renda) * 100 : profileSnapshot.comprometimentoProjetado;

    const profilePatch = {
      ultimoProduto: params.tipoBem || prefill.clienteObjetivo || 'simulador-consorcio',
      valorCredito,
      valorCarta: valorCredito,
      parcelaProjetada,
      comprometimentoProjetado
    };

    saveProfilePatch(profilePatch, 'simulador-consorcio');
    const entry = saveHistoryEntry({
      calculatorSlug: 'simulador-consorcio',
      calculatorName: 'Simulador de consorcio',
      input: {
        valorCarta: valorCredito,
        prazoTotal: params.prazoTotal,
        tipoBem: params.tipoBem
      },
      metrics: [
        { label: 'Credito simulado', value: valorCredito, format: 'currency' },
        { label: 'Parcela projetada', value: parcelaProjetada, format: 'currency' },
        { label: 'Comprometimento projetado', value: comprometimentoProjetado, format: 'percent' }
      ],
      recommendation: 'Simulacao salva com continuidade no dashboard cliente.',
      profilePatch,
      decisionContext: decision
    });
    recordEvent('simulation-saved', {
      historyId: entry.id,
      valorCredito,
      parcelaProjetada,
      readinessScore: decision.readinessScore
    });
    return entry;
  }

  window.BFDecisionContext = {
    loadProfile,
    saveProfilePatch,
    readiness,
    recommendedCalculators,
    buildSimulationPrefill,
    recordEvent,
    recordSimulation,
    loadHistory,
    saveHistoryEntry,
    snapshotProfile
  };
})();
