(function () {
  'use strict';

  function simulate(input) {
    const valorBem = Number(input.valorBem || 0);
    const entrada = Number(input.entrada || 0);
    const principal = Math.max(0, valorBem - entrada);
    const taxaMes = Number(input.taxaMes || 0);
    const prazo = Math.max(1, Math.round(Number(input.prazo || 1)));
    const sistema = input.sistema === 'sac' ? 'sac' : 'price';
    const rows = sistema === 'sac'
      ? window.BFSacFormulas.schedule(principal, taxaMes, prazo)
      : window.BFPriceFormulas.schedule(principal, taxaMes, prazo);
    const totalParcelas = rows.reduce((acc, row) => acc + row.parcela, 0);
    return {
      tipo: `Financiamento ${sistema.toUpperCase()}`,
      valorBem,
      entrada,
      principal,
      taxaMes,
      prazo,
      sistema,
      totalPago: entrada + totalParcelas,
      totalJuros: rows.reduce((acc, row) => acc + row.juros, 0),
      primeiraParcela: rows[0]?.parcela || 0,
      rows
    };
  }

  window.BFFinanciamentoService = { simulate };
})();
