(function () {
  'use strict';

  const PROFILE_KEY = 'bf_financial_profile_v1';

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function bool(value) {
    return value === true || value === 1 || value === '1' || value === 'on' || value === 'true';
  }

  function readProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function normalizeProfile(profile) {
    const saved = readProfile();
    const data = { ...(saved || {}), ...(profile || {}) };
    const rendaMensal = number(data.rendaMensal || data.renda, 0);
    const gastoMensal = number(data.gastoMensal || data.custosMensais || data.despesasMensais, 0);
    const dividasMensais = number(data.dividasMensais || data.dividasAtuais, 0);
    const reservaAtual = number(data.reservaAtual || data.entrada, 0);
    const valorBem = number(data.valorBem || data.precoCheio, 0);
    const valorCredito = number(data.valorCredito, 0) || Math.max(0, valorBem - number(data.entrada, 0));
    const reservaMeses = gastoMensal > 0 ? reservaAtual / gastoMensal : 0;

    return {
      ...data,
      rendaMensal,
      gastoMensal,
      dividasMensais,
      reservaAtual,
      valorBem,
      valorCredito,
      reservaMeses,
      urgencia: String(data.urgencia || 'media').toLowerCase(),
      prioridade: String(data.prioridade || data.prioridadeDecisao || 'menor_custo').toLowerCase(),
      presetObjetivo: String(data.presetObjetivo || data.preset || '').toLowerCase(),
      includeConsumo: bool(data.includeConsumo),
      includeGarantia: bool(data.includeGarantia),
      includeConsignado: bool(data.includeConsignado)
    };
  }

  function scoreStandard(template, rawProfile) {
    const profile = normalizeProfile(rawProfile);
    const preset = String(template && template.preset ? template.preset : '');
    const products = Array.isArray(template && template.productIds) ? template.productIds : [];
    const reasons = [];
    let score = 42;

    if (template && template.governanceStatus === 'published') {
      score += 8;
      reasons.push('Modelo publicado pela biblioteca.');
    }

    if (profile.presetObjetivo && profile.presetObjetivo === preset) {
      score += 30;
      reasons.push('Preset informado coincide com a jornada do modelo.');
    }

    if ((profile.urgencia === 'alta' || profile.prioridade === 'rapidez') && preset === 'obter_liquidez') {
      score += 26;
      reasons.push('Urgencia alta favorece liquidez e credito de disponibilidade rapida.');
    }

    if (profile.prioridade === 'liquidez' && ['obter_liquidez', 'consumo_pontual'].includes(preset)) {
      score += 16;
      reasons.push('Prioridade de preservar caixa pede alternativas com leitura de liquidez.');
    }

    if (profile.valorBem >= 100000 && number(profile.entrada, 0) > 0 && preset === 'comprar_bem') {
      score += 20;
      reasons.push('Valor de bem alto com entrada informada combina com compra planejada.');
    }

    if (profile.valorBem >= 45000 && profile.valorBem <= 180000 && preset === 'trocar_veiculo') {
      score += 17;
      reasons.push('Faixa de valor sugere decisao de veiculo ou bem duravel.');
    }

    if ((profile.valorBem > 0 && profile.valorBem <= 35000) && preset === 'consumo_pontual') {
      score += 24;
      reasons.push('Valor menor favorece decisao de consumo pontual e preservacao de reserva.');
    }

    if (profile.includeConsumo && preset === 'consumo_pontual') {
      score += 13;
      reasons.push('Matriz atual inclui consumo parcelado.');
    }

    if (profile.includeGarantia && products.includes('garantia')) {
      score += 8;
      reasons.push('Modelo inclui credito com garantia, selecionado no cenario.');
    }

    if (profile.includeConsignado && products.includes('consignado')) {
      score += 8;
      reasons.push('Modelo inclui consignado, selecionado no cenario.');
    }

    if (profile.reservaMeses > 0 && profile.reservaMeses < 3 && ['obter_liquidez', 'consumo_pontual'].includes(preset)) {
      score += 10;
      reasons.push('Reserva abaixo de tres meses exige cuidado com caixa.');
    }

    if (profile.rendaMensal > 0 && products.includes('consignado')) {
      score += 4;
      reasons.push('Renda informada permite avaliar margem de consignado.');
    }

    if (profile.urgencia === 'baixa' && preset === 'comprar_bem') {
      score += 10;
      reasons.push('Urgencia baixa abre espaco para planejamento.');
    }

    if (profile.urgencia === 'alta' && preset === 'comprar_bem') {
      score -= 8;
      reasons.push('Compra planejada perde forca quando a urgencia e alta.');
    }

    if (profile.valorCredito > 0 && profile.valorCredito <= 25000 && preset === 'comprar_bem') {
      score -= 7;
      reasons.push('Credito menor tende a pedir consumo ou liquidez, nao compra complexa.');
    }

    const bounded = Math.max(0, Math.min(100, Math.round(score)));
    return {
      ...template,
      recommendationScore: bounded,
      recommendationReasons: reasons.slice(0, 4),
      recommendationTone: bounded >= 82 ? 'success' : (bounded >= 68 ? 'info' : 'warn')
    };
  }

  function rank(standards, profile) {
    return (standards || [])
      .map((template) => scoreStandard(template, profile))
      .sort((a, b) => {
        if (b.recommendationScore !== a.recommendationScore) return b.recommendationScore - a.recommendationScore;
        return String(a.name || '').localeCompare(String(b.name || ''), 'pt-BR');
      });
  }

  function best(standards, profile) {
    return rank(standards, profile)[0] || null;
  }

  window.BFModelosRecomendacaoService = {
    normalizeProfile,
    score: scoreStandard,
    rank,
    best
  };
})();
