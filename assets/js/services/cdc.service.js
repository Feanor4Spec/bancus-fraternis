(function () {
  'use strict';

  function simulate(input) {
    const valor = Number(input.valor || 0);
    const tarifas = Number(input.tarifas || 0);
    const prazo = Math.max(1, Math.round(Number(input.prazo || 1)));
    const taxaMes = Number(input.taxaMes || 0);
    const principal = valor + tarifas;
    const rows = window.BFPriceFormulas.schedule(principal, taxaMes, prazo);
    const totalPago = rows.reduce((acc, row) => acc + row.parcela, 0);
    const custoTotal = Math.max(0, totalPago - valor);
    return {
      tipo: 'CDC',
      valor,
      tarifas,
      principal,
      taxaMes,
      prazo,
      totalPago,
      custoTotal,
      primeiraParcela: rows[0]?.parcela || 0,
      rows
    };
  }

  window.BFCdcService = { simulate };
})();
