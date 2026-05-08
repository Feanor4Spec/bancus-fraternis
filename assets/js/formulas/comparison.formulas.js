(function () {
  'use strict';

  function summarize(label, result) {
    const rows = result.rows || result.schedule || [];
    const totalPago = result.totalPago || rows.reduce((acc, row) => acc + Number(row.parcela || 0), 0);
    const primeiraParcela = result.primeiraParcela || rows[0]?.parcela || 0;
    const ultimaParcela = rows[rows.length - 1]?.parcela || primeiraParcela;
    return {
      label,
      totalPago,
      primeiraParcela,
      ultimaParcela,
      prazo: result.prazo || rows.length,
      score: score({ totalPago, primeiraParcela, prazo: result.prazo || rows.length })
    };
  }

  function score(item) {
    const custo = Number(item.totalPago || 0);
    const parcela = Number(item.primeiraParcela || 0);
    const prazo = Number(item.prazo || 1);
    const normalized = 100 - Math.min(80, (custo / Math.max(1, prazo)) / 1000) - Math.min(20, parcela / 5000);
    return Math.max(0, Math.round(normalized));
  }

  window.BFComparisonFormulas = { summarize, score };
})();
