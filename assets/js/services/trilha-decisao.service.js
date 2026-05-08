(function () {
  'use strict';

  const PROFILE_KEY = 'bf_financial_profile_v1';
  const JOURNEY_KEY = 'bf_decision_journey_v1';
  const JOURNEY_HISTORY_KEY = 'bf_decision_journey_history_v1';
  const MAX_HISTORY = 12;

  const objectiveLabels = {
    comprar_bem: 'Comprar bem',
    obter_liquidez: 'Obter liquidez',
    trocar_veiculo: 'Trocar veiculo',
    consumo_pontual: 'Consumo pontual'
  };

  const objectiveAliases = {
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

  const productPriority = {
    comprar_bem: ['financiamento', 'consorcio', 'garantia'],
    obter_liquidez: ['consignado', 'garantia', 'cdc'],
    trocar_veiculo: ['veiculos', 'financiamento', 'consorcio'],
    consumo_pontual: ['cdc', 'consignado', 'garantia']
  };

  const calculatorByObjective = {
    comprar_bem: 'calculadora-custos-fixos.html',
    obter_liquidez: 'calculadora-reserva-emergencia.html',
    trocar_veiculo: 'calculadora-compra-vista-parcelado.html',
    consumo_pontual: 'calculadora-compra-vista-parcelado.html'
  };

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

  function writeJson(key, value) {
    const storage = safeStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  }

  function removeKey(key) {
    const storage = safeStorage();
    if (!storage) return false;
    storage.removeItem(key);
    return true;
  }

  function currentOwner() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return user && user.email ? user.email : 'anon';
  }

  function storageKey() {
    return `${JOURNEY_KEY}:${currentOwner()}`;
  }

  function historyKey() {
    return `${JOURNEY_HISTORY_KEY}:${currentOwner()}`;
  }

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function normalizeToken(value, fallback = '') {
    return String(value || fallback).trim().toLowerCase().replace(/\s+/g, '_').replace(/-/g, '_');
  }

  function normalizeObjective(value) {
    const raw = normalizeToken(value, 'obter_liquidez');
    return objectiveAliases[raw] || 'obter_liquidez';
  }

  function readProfile() {
    return readJson(PROFILE_KEY, {}) || {};
  }

  function saveProfilePatch(patch) {
    const next = {
      ...readProfile(),
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    };
    writeJson(PROFILE_KEY, next);
    return next;
  }

  function normalizeInput(input) {
    const saved = readProfile();
    const data = { ...(saved || {}), ...(input || {}) };
    const presetObjetivo = normalizeObjective(data.objetivo || data.presetObjetivo || data.preset || data.objetivoPrincipal);
    const rendaMensal = number(data.rendaMensal || data.renda || data.rendaLiquida, 0);
    const gastoMensal = number(data.gastoMensal || data.custosMensais || data.despesasMensais, 0);
    const dividasMensais = number(data.dividasMensais || data.dividasAtuais || data.dividas, 0);
    const reservaAtual = number(data.reservaAtual || data.reserva || data.caixaAtual, 0);
    const valorObjetivo = number(data.valorObjetivo || data.valorBem || data.precoCheio || data.valorCredito, presetObjetivo === 'consumo_pontual' ? 12000 : 80000);
    const entrada = number(data.entrada, 0);
    const valorCredito = Math.max(0, number(data.valorCredito, 0) || (valorObjetivo - entrada));
    const reservaMeses = gastoMensal > 0 ? reservaAtual / gastoMensal : 0;
    const capacidadeAporte = number(data.capacidadeAporte, Math.max(0, rendaMensal - gastoMensal - dividasMensais));
    const capacidadePagamento = number(data.capacidadePagamento, Math.max(0, capacidadeAporte * 0.35));
    const comprometimentoRenda = rendaMensal > 0 ? ((gastoMensal + dividasMensais) / rendaMensal) * 100 : number(data.comprometimentoRenda, 0);
    const reservaIdeal = gastoMensal * 6;
    const gapReserva = Math.max(0, reservaIdeal - reservaAtual);
    const urgencia = normalizeToken(data.urgencia, presetObjetivo === 'obter_liquidez' || presetObjetivo === 'consumo_pontual' ? 'alta' : 'media');
    const prioridade = normalizeToken(data.prioridade || data.prioridadeDecisao, urgencia === 'alta' ? 'rapidez' : 'menor_custo');

    return {
      ...data,
      objetivo: presetObjetivo,
      presetObjetivo,
      objetivoLabel: objectiveLabels[presetObjetivo],
      rendaMensal,
      gastoMensal,
      dividasMensais,
      reservaAtual,
      reservaIdeal,
      gapReserva,
      reservaMeses,
      capacidadeAporte,
      capacidadePagamento,
      comprometimentoRenda,
      valorObjetivo,
      valorBem: valorObjetivo,
      entrada,
      valorCredito,
      urgencia,
      prioridade,
      risco: normalizeToken(data.risco, 'conservador')
    };
  }

  function comparatorProfile(profile) {
    const preset = profile.presetObjetivo;
    const productIds = productPriority[preset] || [];
    return {
      ...profile,
      presetObjetivo: preset,
      valorBem: profile.valorObjetivo,
      valorCredito: profile.valorCredito,
      includeFinanciamento: productIds.includes('financiamento') ? '1' : '0',
      includeConsorcio: productIds.includes('consorcio') ? '1' : '0',
      includeCdc: productIds.includes('cdc') ? '1' : '0',
      includeGarantia: productIds.includes('garantia') ? '1' : '0',
      includeConsignado: productIds.includes('consignado') ? '1' : '0',
      includeConsumo: preset === 'trocar_veiculo' || preset === 'consumo_pontual' ? '1' : '0'
    };
  }

  function scoreProduct(product, profile) {
    if (!product) return null;
    const preset = profile.presetObjetivo;
    const priority = productPriority[preset] || [];
    const urgency = normalizeToken(product.urgencia);
    const reasons = [];
    let score = 38;

    if (product.comparadorPreset === preset) {
      score += 28;
      reasons.push('Produto conectado ao objetivo principal.');
    }

    const priorityIndex = priority.indexOf(product.id);
    if (priorityIndex >= 0) {
      score += 22 - priorityIndex * 4;
      reasons.push('Produto esta na trilha padrao desta decisao.');
    }

    if (profile.urgencia === 'alta' && urgency === 'alta') {
      score += 13;
      reasons.push('Urgencia alta favorece disponibilidade rapida.');
    }

    if (profile.urgencia === 'baixa' && urgency === 'baixa') {
      score += 10;
      reasons.push('Urgencia baixa permite planejamento.');
    }

    if (profile.urgencia === 'alta' && urgency === 'baixa') {
      score -= 12;
      reasons.push('Produto pode nao atender necessidade imediata.');
    }

    if (profile.prioridade === 'menor_custo' && ['consorcio', 'garantia', 'consignado'].includes(product.id)) {
      score += 8;
      reasons.push('Prioridade de custo pede alternativas com taxa ou custo menor.');
    }

    if (profile.prioridade === 'rapidez' && ['cdc', 'consignado', 'financiamento'].includes(product.id)) {
      score += 8;
      reasons.push('Prioridade de rapidez favorece produto de menor friccao.');
    }

    if (profile.reservaMeses < 3 && product.id === 'garantia') {
      score -= 7;
      reasons.push('Reserva baixa exige cautela antes de comprometer garantia.');
    }

    if (profile.valorObjetivo >= 100000 && ['financiamento', 'consorcio', 'garantia'].includes(product.id)) {
      score += 6;
      reasons.push('Valor relevante pede comparacao estruturada.');
    }

    if (profile.rendaMensal > 0 && product.id === 'consignado') {
      score += 4;
      reasons.push('Renda informada permite leitura de margem.');
    }

    return {
      ...product,
      recommendationScore: Math.max(0, Math.min(100, Math.round(score))),
      recommendationReasons: reasons.slice(0, 4)
    };
  }

  function rankProducts(products, profile) {
    return (products || [])
      .map((product) => scoreProduct(product, profile))
      .filter(Boolean)
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) return b.recommendationScore - a.recommendationScore;
        return String(a.nome || '').localeCompare(String(b.nome || ''), 'pt-BR');
      });
  }

  function recommendedModel(standardModels, profile) {
    if (!window.BFModelosRecomendacaoService || !standardModels || !standardModels.length) return null;
    return window.BFModelosRecomendacaoService.best(standardModels, comparatorProfile(profile));
  }

  function calculatorFor(profile) {
    if (!profile.rendaMensal || !profile.gastoMensal) {
      return {
        href: 'calculadora-custos-fixos.html',
        label: 'Diagnosticar custos',
        title: 'Completar orcamento'
      };
    }
    if (profile.gapReserva > 0) {
      return {
        href: 'calculadora-reserva-emergencia.html',
        label: 'Montar reserva',
        title: 'Completar reserva'
      };
    }
    return {
      href: calculatorByObjective[profile.presetObjetivo] || 'calculadoras.html',
      label: 'Abrir calculadora',
      title: 'Refinar premissas'
    };
  }

  function modelHref(model, profile) {
    if (model && model.id) return `modelos-biblioteca.html?recomendado=${encodeURIComponent(model.id)}`;
    return `modelos-biblioteca.html?preset=${encodeURIComponent(profile.presetObjetivo)}`;
  }

  function compareHref(profile) {
    return `comparador.html?preset=${encodeURIComponent(profile.presetObjetivo)}`;
  }

  function buildNextAction(profile, product, model) {
    const calculator = calculatorFor(profile);
    if (!profile.rendaMensal || !profile.gastoMensal) {
      return {
        type: 'diagnostico',
        title: 'Complete o diagnostico antes de assumir parcelas.',
        description: 'Renda, custos e dividas definem capacidade real de pagamento.',
        href: calculator.href,
        label: calculator.label,
        tone: 'warn'
      };
    }

    if (profile.gapReserva > 0 && profile.reservaMeses < 3) {
      return {
        type: 'reserva',
        title: 'Reforce a reserva antes de contratar credito caro.',
        description: `Reserva cobre ${profile.reservaMeses.toFixed(1)} meses. A trilha sugere validar caixa antes da decisao final.`,
        href: calculator.href,
        label: calculator.label,
        tone: 'warn'
      };
    }

    if (product && product.simulador) {
      return {
        type: 'simulacao',
        title: `Simule ${product.nome} com as premissas da trilha.`,
        description: 'Produto e modelo ja foram selecionados; agora valide parcela, CET, prazo e riscos.',
        href: product.simulador,
        label: 'Simular produto',
        tone: 'success'
      };
    }

    return {
      type: 'comparacao',
      title: model ? `Compare com o modelo ${model.name}.` : 'Abra a matriz comparativa.',
      description: 'Use o comparador para enxergar custo total, liquidez, prazo e risco lado a lado.',
      href: compareHref(profile),
      label: 'Abrir comparador',
      tone: 'info'
    };
  }

  function buildSteps(profile, product, model, nextAction) {
    const calculator = calculatorFor(profile);
    const missingBudget = !profile.rendaMensal || !profile.gastoMensal;
    const reserveAttention = !missingBudget && profile.gapReserva > 0;
    return [
      {
        id: 'diagnostico',
        index: 1,
        status: missingBudget ? 'active' : (reserveAttention ? 'attention' : 'done'),
        title: missingBudget ? 'Completar diagnostico financeiro' : 'Perfil financeiro consolidado',
        description: missingBudget ? 'Informe renda, custos, dividas e reserva para melhorar a recomendacao.' : `Reserva cobre ${profile.reservaMeses.toFixed(1)} meses e capacidade segura estimada em ${Math.round(profile.comprometimentoRenda)}% de comprometimento.`,
        href: calculator.href,
        label: calculator.label
      },
      {
        id: 'produto',
        index: 2,
        status: product ? 'next' : 'attention',
        title: product ? `Produto sugerido: ${product.nome}` : 'Produto sugerido indisponivel',
        description: product ? (product.quandoUsar || product.objetivo || 'Produto ranqueado pelo objetivo informado.') : 'Revise objetivo e perfil para selecionar um produto.',
        href: product && product.simulador ? product.simulador : 'produtos.html',
        label: product && product.simulador ? 'Simular produto' : 'Abrir produtos'
      },
      {
        id: 'modelo',
        index: 3,
        status: model ? 'next' : 'attention',
        title: model ? `Modelo recomendado: ${model.name}` : 'Modelo recomendado pendente',
        description: model ? (model.description || 'Modelo padrao aderente ao perfil.') : 'A biblioteca precisa carregar modelos padrao para sugerir uma matriz.',
        href: modelHref(model, profile),
        label: 'Ver biblioteca'
      },
      {
        id: 'comparador',
        index: 4,
        status: 'next',
        title: `Comparar alternativas de ${profile.objetivoLabel.toLowerCase()}`,
        description: 'A matriz abre com preset, produtos e premissas coerentes com a trilha.',
        href: compareHref(profile),
        label: 'Abrir comparador'
      },
      {
        id: 'acao',
        index: 5,
        status: nextAction.tone === 'success' ? 'done' : 'active',
        title: nextAction.title,
        description: nextAction.description,
        href: nextAction.href,
        label: nextAction.label
      }
    ];
  }

  function build(input, datasets) {
    const data = datasets || {};
    const profile = normalizeInput(input);
    const rankedProducts = rankProducts(data.produtos || [], profile);
    const product = rankedProducts[0] || null;
    const model = recommendedModel(data.modelosComparadorPadrao || data.standardModels || [], profile);
    const nextAction = buildNextAction(profile, product, model);
    const steps = buildSteps(profile, product, model, nextAction);
    const now = new Date().toISOString();
    const id = (input && input.id) || `TRI-${Date.now().toString(36).toUpperCase()}`;

    return {
      id,
      schema: 'bank-fratern.decision-journey.v1',
      createdAt: (input && input.createdAt) || now,
      updatedAt: now,
      owner: currentOwner(),
      profile,
      objective: profile.presetObjetivo,
      objectiveLabel: profile.objetivoLabel,
      recommendedProduct: product,
      recommendedModel: model,
      rankedProducts: rankedProducts.slice(0, 4),
      steps,
      nextAction,
      metrics: {
        reservaMeses: profile.reservaMeses,
        capacidadePagamento: profile.capacidadePagamento,
        comprometimentoRenda: profile.comprometimentoRenda,
        valorCredito: profile.valorCredito,
        gapReserva: profile.gapReserva,
        productScore: product ? product.recommendationScore : 0,
        modelScore: model ? model.recommendationScore : 0
      },
      recommendation: {
        title: product && model ? `${product.nome} com ${model.name}` : nextAction.title,
        message: product ? (product.recommendationReasons || []).join(' ') : nextAction.description,
        tone: nextAction.tone,
        next: nextAction.title
      }
    };
  }

  function load() {
    return readJson(storageKey(), null);
  }

  function loadHistory() {
    const parsed = readJson(historyKey(), []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function save(journey) {
    if (!journey) return null;
    const now = new Date().toISOString();
    const record = {
      ...journey,
      updatedAt: now,
      owner: currentOwner()
    };
    writeJson(storageKey(), record);
    const history = loadHistory().filter((item) => item && item.id !== record.id);
    writeJson(historyKey(), [record].concat(history).slice(0, MAX_HISTORY));
    saveProfilePatch({
      objetivoPrincipal: record.objective,
      presetObjetivo: record.objective,
      rendaMensal: record.profile.rendaMensal,
      gastoMensal: record.profile.gastoMensal,
      dividasMensais: record.profile.dividasMensais,
      reservaAtual: record.profile.reservaAtual,
      valorBem: record.profile.valorObjetivo,
      valorCredito: record.profile.valorCredito,
      entrada: record.profile.entrada,
      capacidadeAporte: record.profile.capacidadeAporte,
      capacidadePagamento: record.profile.capacidadePagamento,
      comprometimentoRenda: record.profile.comprometimentoRenda,
      ultimaTrilhaDecisao: {
        id: record.id,
        objective: record.objective,
        productId: record.recommendedProduct ? record.recommendedProduct.id : '',
        modelId: record.recommendedModel ? record.recommendedModel.id : '',
        nextAction: record.nextAction ? record.nextAction.type : '',
        updatedAt: now
      }
    });
    return record;
  }

  function clear() {
    removeKey(storageKey());
  }

  window.BFTrilhaDecisaoService = {
    objectiveLabels: { ...objectiveLabels },
    normalizeInput,
    build,
    save,
    load,
    loadHistory,
    clear,
    storageKey,
    historyKey,
    comparatorProfile,
    rankProducts
  };
})();
