(function () {
  'use strict';

  function simulate(input) {
    const garantia = Number(input.garantia || 0);
    const ltvPct = Number(input.ltv || 50);
    const valorSolicitado = Number(input.valor || garantia * (ltvPct / 100));
    const prazo = Math.max(1, Math.round(Number(input.prazo || 120)));
    const taxaMes = Number(input.taxaMes || 0.95);
    const principal = Math.min(valorSolicitado, garantia * (ltvPct / 100));
    const rows = window.BFPriceFormulas.schedule(principal, taxaMes, prazo);
    const totalPago = rows.reduce((acc, row) => acc + row.parcela, 0);

    return {
      tipo: 'Credito com garantia',
      garantia,
      ltvPct,
      principal,
      taxaMes,
      prazo,
      totalPago,
      primeiraParcela: rows[0]?.parcela || 0,
      ltvUsado: garantia > 0 ? (principal / garantia) * 100 : 0,
      rows
    };
  }

  window.BFGarantiaService = { simulate };
})();
