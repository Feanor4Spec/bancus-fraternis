(function () {
  'use strict';

  function scoreProduct(product, profile) {
    let score = 50;
    const urgencia = profile.urgencia || 'media';
    const risco = profile.risco || 'moderado';
    const entrada = Number(profile.entrada || 0);
    const renda = Number(profile.renda || 0);

    if (product.id === 'consorcio' && urgencia === 'baixa') score += 24;
    if (product.id === 'financiamento' && urgencia === 'alta') score += 22;
    if (product.id === 'cdc' && urgencia === 'alta') score += 12;
    if (product.id === 'garantia' && profile.garantia) score += 18;
    if (product.id === 'consignado' && renda > 0 && risco === 'conservador') score += 12;
    if (entrada > 0 && ['financiamento', 'veiculos'].includes(product.id)) score += 10;
    if (risco === 'conservador' && ['cdc'].includes(product.id)) score -= 16;
    if (risco === 'arrojado' && ['garantia', 'financiamento'].includes(product.id)) score += 8;

    return Math.max(0, Math.min(100, score));
  }

  function recommend(profile, products) {
    return (products || []).map((product) => ({
      ...product,
      scoreRecomendacao: scoreProduct(product, profile)
    })).sort((a, b) => b.scoreRecomendacao - a.scoreRecomendacao);
  }

  window.BFRecomendacaoService = { recommend };
})();
