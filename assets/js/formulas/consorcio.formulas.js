(function () {
  'use strict';

  function simulate(input) {
    const carta = Number(input.carta || 0);
    const prazo = Math.max(1, Math.round(Number(input.prazo || 1)));
    const taxaAdmTotal = Number(input.taxaAdm || 0) / 100;
    const fundoReservaTotal = Number(input.fundoReserva || 0) / 100;
    const seguroMensal = Number(input.seguro || 0);
    const lancePct = Number(input.lance || 0) / 100;
    const reajusteAnual = Number(input.reajusteAnual || 0) / 100;
    const mobContemplacao = Math.max(1, Math.round(Number(input.mobContemplacao || prazo)));
    const mobFaturamento = Math.max(mobContemplacao, Math.round(Number(input.mobFaturamento || mobContemplacao)));

    const fundoComum = carta / prazo;
    const taxaAdmMensal = (carta * taxaAdmTotal) / prazo;
    const fundoReservaMensal = (carta * fundoReservaTotal) / prazo;
    const lanceValor = carta * lancePct;
    let saldo = carta;
    const rows = [];

    for (let mob = 1; mob <= prazo; mob += 1) {
      const fatorReajuste = Math.pow(1 + reajusteAnual, Math.floor((mob - 1) / 12));
      const parcela = (fundoComum + taxaAdmMensal + fundoReservaMensal + seguroMensal) * fatorReajuste;
      const amortizacao = mob === mobContemplacao ? Math.min(saldo, fundoComum + lanceValor) : Math.min(saldo, fundoComum);
      saldo = Math.max(0, saldo - amortizacao);
      rows.push({
        mob,
        parcela,
        amortizacao,
        saldo,
        evento: mob === mobContemplacao ? 'Contemplacao/lance' : (mob === mobFaturamento ? 'Faturamento' : '')
      });
    }

    const totalPago = rows.reduce((acc, row) => acc + row.parcela, 0) + lanceValor;
    return { carta, prazo, lanceValor, totalPago, primeiraParcela: rows[0]?.parcela || 0, mobContemplacao, mobFaturamento, rows };
  }

  window.BFConsorcioFormulas = { simulate };
})();
