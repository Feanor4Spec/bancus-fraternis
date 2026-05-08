(function () {
  'use strict';

  function number(value, digits = 2) {
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: digits,
      maximumFractionDigits: digits
    });
  }

  function currency(value) {
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', {
      style: 'currency',
      currency: 'BRL',
      minimumFractionDigits: 2
    });
  }

  function percent(value, digits = 2) {
    return `${number(value, digits)}%`;
  }

  function parse(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    const cleaned = String(value || '').replace(/[^\d,.-]/g, '').replace(/\./g, '').replace(',', '.');
    const parsed = Number(cleaned);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function months(value) {
    const n = Math.max(0, Math.round(Number(value || 0)));
    return `${n} mes${n === 1 ? '' : 'es'}`;
  }

  window.BFFormatters = { number, currency, percent, parse, months };
})();
