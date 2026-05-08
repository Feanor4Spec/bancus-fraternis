(function () {
  'use strict';

  function simulate(input) {
    const valor = Number(input.valor || 0);
    const renda = Number(input.renda || 0);
    const margemPct = Number(input.margemPct || 30);
    const prazo = Math.max(1, Math.round(Number(input.prazo || 72)));
    const taxaMes = Number(input.taxaMes || 1.35);
    const rows = window.BFPriceFormulas.schedule(valor, taxaMes, prazo);
    const totalPago = rows.reduce((acc, row) => acc + row.parcela, 0);
    const margemDisponivel = renda * (margemPct / 100);
    const primeiraParcela = rows[0]?.parcela || 0;

    return {
      tipo: 'Consignado',
      valor,
      renda,
      margemPct,
      margemDisponivel,
      taxaMes,
      prazo,
      totalPago,
      primeiraParcela,
      elegivel: primeiraParcela <= margemDisponivel,
      rows
    };
  }

  window.BFConsignadoService = { simulate };
})();
