(function () {
  'use strict';

  function positive(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  }

  function range(value, min, max, fallback = min) {
    const n = Number(value);
    if (!Number.isFinite(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function profile(input) {
    return {
      objetivo: input.objetivo || 'comprar',
      urgencia: input.urgencia || 'media',
      renda: positive(input.renda, 0),
      entrada: positive(input.entrada, 0),
      garantia: Boolean(input.garantia),
      risco: input.risco || 'moderado'
    };
  }

  window.BFValidators = { positive, range, profile };
})();
