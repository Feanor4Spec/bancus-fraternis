(function () {
  'use strict';

  function payment(principal, monthlyRate, months) {
    const pv = Number(principal || 0);
    const i = Number(monthlyRate || 0) / 100;
    const n = Math.max(1, Math.round(Number(months || 1)));
    if (i === 0) return pv / n;
    return pv * i / (1 - Math.pow(1 + i, -n));
  }

  function schedule(principal, monthlyRate, months) {
    const rows = [];
    const pmt = payment(principal, monthlyRate, months);
    const i = Number(monthlyRate || 0) / 100;
    let balance = Number(principal || 0);
    for (let mob = 1; mob <= months; mob += 1) {
      const juros = balance * i;
      const amortizacao = Math.min(balance, pmt - juros);
      balance = Math.max(0, balance - amortizacao);
      rows.push({ mob, parcela: pmt, juros, amortizacao, saldo: balance });
    }
    return rows;
  }

  window.BFPriceFormulas = { payment, schedule };
})();
