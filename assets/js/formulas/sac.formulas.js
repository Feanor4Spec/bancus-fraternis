(function () {
  'use strict';

  function schedule(principal, monthlyRate, months) {
    const rows = [];
    const pv = Number(principal || 0);
    const i = Number(monthlyRate || 0) / 100;
    const n = Math.max(1, Math.round(Number(months || 1)));
    const amortizacao = pv / n;
    let balance = pv;
    for (let mob = 1; mob <= n; mob += 1) {
      const juros = balance * i;
      const parcela = amortizacao + juros;
      balance = Math.max(0, balance - amortizacao);
      rows.push({ mob, parcela, juros, amortizacao, saldo: balance });
    }
    return rows;
  }

  window.BFSacFormulas = { schedule };
})();
