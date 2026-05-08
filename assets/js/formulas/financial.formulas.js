(function () {
  'use strict';

  function n(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function clampMonths(value) {
    return Math.max(1, Math.round(n(value, 1)));
  }

  function clamp(value, min, max) {
    return Math.max(min, Math.min(max, value));
  }

  function annualToMonthly(ratePct) {
    return Math.pow(1 + n(ratePct) / 100, 1 / 12) - 1;
  }

  function simpleInterest(capital, ratePct, periods) {
    const c = n(capital);
    const i = n(ratePct) / 100;
    const t = Math.max(0, n(periods));
    const juros = c * i * t;
    return { juros, montante: c + juros };
  }

  function compoundFutureValue(valueInitial, monthlyPayment, annualRatePct, months) {
    const pv = n(valueInitial);
    const pmt = n(monthlyPayment);
    const i = annualToMonthly(annualRatePct);
    const m = clampMonths(months);
    if (i === 0) return pv + pmt * m;
    return pv * Math.pow(1 + i, m) + pmt * ((Math.pow(1 + i, m) - 1) / i);
  }

  function requiredPayment(goal, valueInitial, annualRatePct, months) {
    const target = n(goal);
    const pv = n(valueInitial);
    const i = annualToMonthly(annualRatePct);
    const m = clampMonths(months);
    if (i === 0) return Math.max(0, (target - pv) / m);
    const futureInitial = pv * Math.pow(1 + i, m);
    return Math.max(0, (target - futureInitial) * i / (Math.pow(1 + i, m) - 1));
  }

  function monthsToGoal(goal, valueInitial, monthlyPayment, annualRatePct, maxMonths = 720) {
    const target = n(goal);
    const pmt = n(monthlyPayment);
    let balance = n(valueInitial);
    const i = annualToMonthly(annualRatePct);
    for (let month = 0; month <= maxMonths; month += 1) {
      if (balance >= target) return month;
      balance = balance * (1 + i) + pmt;
    }
    return null;
  }

  function withdrawalFutureValue(valueInitial, monthlyWithdrawal, annualRatePct, months) {
    const pv = n(valueInitial);
    const pmt = n(monthlyWithdrawal);
    const i = annualToMonthly(annualRatePct);
    const m = clampMonths(months);
    if (i === 0) return pv - pmt * m;
    return pv * Math.pow(1 + i, m) - pmt * ((Math.pow(1 + i, m) - 1) / i);
  }

  function pricePayment(principal, monthlyRatePct, months) {
    const pv = n(principal);
    const i = n(monthlyRatePct) / 100;
    const m = clampMonths(months);
    if (i === 0) return pv / m;
    return pv * (i * Math.pow(1 + i, m)) / (Math.pow(1 + i, m) - 1);
  }

  function priceSchedule(principal, monthlyRatePct, months) {
    const rows = [];
    const payment = pricePayment(principal, monthlyRatePct, months);
    const i = n(monthlyRatePct) / 100;
    let balance = n(principal);
    for (let mob = 1; mob <= clampMonths(months); mob += 1) {
      const juros = balance * i;
      const amortizacao = Math.min(balance, payment - juros);
      balance = Math.max(0, balance - amortizacao);
      rows.push({ mob, parcela: payment, juros, amortizacao, saldo: balance });
    }
    return rows;
  }

  function presentValueOfPayments(payment, months, monthlyRatePct) {
    const pmt = n(payment);
    const i = n(monthlyRatePct) / 100;
    const m = clampMonths(months);
    if (i === 0) return pmt * m;
    return pmt * (1 - Math.pow(1 + i, -m)) / i;
  }

  function futureValueMonthly(valueInitial, monthlyPayment, monthlyRatePct, months) {
    const pv = n(valueInitial);
    const pmt = n(monthlyPayment);
    const i = n(monthlyRatePct) / 100;
    const m = clampMonths(months);
    if (i === 0) return pv + pmt * m;
    return pv * Math.pow(1 + i, m) + pmt * ((Math.pow(1 + i, m) - 1) / i);
  }

  function emergency(gastoMensal, mesesCobertura, reservaAtual) {
    const ideal = Math.max(0, n(gastoMensal) * n(mesesCobertura));
    const atual = Math.max(0, n(reservaAtual));
    const gap = Math.max(0, ideal - atual);
    const mesesAtuais = n(gastoMensal) > 0 ? atual / n(gastoMensal) : 0;
    return { ideal, atual, gap, mesesAtuais, coberturaPct: ideal > 0 ? atual / ideal * 100 : 0 };
  }

  function fixedCosts(input) {
    const renda = n(input.rendaLiquida);
    const totalCustos = n(input.moradia) + n(input.alimentacao) + n(input.transporte) + n(input.dividas) + n(input.outros);
    const comprometimento = renda > 0 ? totalCustos / renda * 100 : 0;
    const sobra = renda - totalCustos;
    let faixa = 'Confortavel';
    if (comprometimento >= 80) faixa = 'Critico';
    else if (comprometimento >= 60) faixa = 'Pressionado';
    else if (comprometimento >= 45) faixa = 'Atencao';
    return { renda, totalCustos, comprometimento, sobra, faixa };
  }

  function creditCapacity(input) {
    const renda = n(input.rendaMensal);
    const gastoMensal = n(input.gastoMensal);
    const dividasMensais = n(input.dividasMensais);
    const reservaAtual = n(input.reservaAtual);
    const comprometimentoMaximo = n(input.comprometimentoMaximo, 30);
    const mesesReservaMinima = n(input.mesesReservaMinima, 3);
    const margemFluxo = n(input.margemFluxo, 60);
    const folgaMensal = Math.max(0, renda - gastoMensal - dividasMensais);
    const tetoComprometimento = Math.max(0, renda * comprometimentoMaximo / 100 - dividasMensais);
    const tetoFluxo = Math.max(0, folgaMensal * margemFluxo / 100);
    const parcelaSegura = Math.min(tetoComprometimento, tetoFluxo);
    const comprometimentoAtual = renda > 0 ? dividasMensais / renda * 100 : 0;
    const comprometimentoProjetado = renda > 0 ? (dividasMensais + parcelaSegura) / renda * 100 : 0;
    const mesesReserva = gastoMensal > 0 ? reservaAtual / gastoMensal : 0;
    const reservaOk = mesesReserva >= mesesReservaMinima;
    const risco =
      parcelaSegura <= 0 || comprometimentoProjetado > comprometimentoMaximo + 5 || !reservaOk
        ? 'alto'
        : comprometimentoProjetado > comprometimentoMaximo || mesesReserva < mesesReservaMinima + 2
          ? 'medio'
          : 'baixo';
    const score = clamp(
      (renda > 0 ? 25 : 0) +
      clamp((folgaMensal / Math.max(1, renda)) * 100, 0, 25) +
      clamp((mesesReserva / Math.max(1, mesesReservaMinima)) * 25, 0, 25) +
      clamp(25 - Math.max(0, comprometimentoProjetado - comprometimentoMaximo) * 2, 0, 25),
      0,
      100
    );
    return {
      renda,
      gastoMensal,
      dividasMensais,
      reservaAtual,
      folgaMensal,
      tetoComprometimento,
      tetoFluxo,
      parcelaSegura,
      comprometimentoAtual,
      comprometimentoProjetado,
      mesesReserva,
      reservaOk,
      risco,
      score
    };
  }

  function consortiumBidCapacity(input) {
    const valorCarta = n(input.valorCarta);
    const reservaAtual = n(input.reservaAtual);
    const gastoMensal = n(input.gastoMensal);
    const capacidadePagamento = n(input.capacidadePagamento);
    const lanceDesejadoPct = n(input.lanceDesejadoPct);
    const mesesReservaMinima = n(input.mesesReservaMinima, 3);
    const limiteLancePct = n(input.limiteLancePct, 30);
    const reservaMinima = gastoMensal * mesesReservaMinima;
    const caixaDisponivel = Math.max(0, reservaAtual - reservaMinima);
    const limiteCarta = valorCarta * limiteLancePct / 100;
    const lanceSeguroValor = Math.min(caixaDisponivel, limiteCarta);
    const lanceSeguroPct = valorCarta > 0 ? lanceSeguroValor / valorCarta * 100 : 0;
    const lanceDesejadoValor = valorCarta * lanceDesejadoPct / 100;
    const reservaAposLance = reservaAtual - lanceDesejadoValor;
    const mesesReservaAposLance = gastoMensal > 0 ? Math.max(0, reservaAposLance) / gastoMensal : 0;
    const lanceDesejadoSustentavel = lanceDesejadoValor <= lanceSeguroValor && reservaAposLance >= reservaMinima;
    const parcelaReferencia = capacidadePagamento > 0 ? capacidadePagamento : valorCarta / 120;
    const impactoReservaPct = reservaAtual > 0 ? lanceDesejadoValor / reservaAtual * 100 : 0;
    const score = clamp(
      (valorCarta > 0 ? 20 : 0) +
      clamp((lanceSeguroPct / Math.max(1, limiteLancePct)) * 30, 0, 30) +
      clamp((mesesReservaAposLance / Math.max(1, mesesReservaMinima)) * 25, 0, 25) +
      (capacidadePagamento > 0 ? 25 : 10),
      0,
      100
    );
    return {
      valorCarta,
      reservaAtual,
      gastoMensal,
      capacidadePagamento,
      reservaMinima,
      caixaDisponivel,
      lanceSeguroValor,
      lanceSeguroPct,
      lanceDesejadoValor,
      reservaAposLance,
      mesesReservaAposLance,
      lanceDesejadoSustentavel,
      parcelaReferencia,
      impactoReservaPct,
      score
    };
  }

  function irRate(days, table) {
    const d = Math.max(1, Math.round(n(days, 1)));
    const rows = Array.isArray(table) ? table : [];
    const found = rows.find((row) => d <= n(row.diasAte, 99999));
    return n(found ? found.aliquota : 15) / 100;
  }

  function fixedIncomeReturn(input, premissas) {
    const valor = n(input.valor);
    const prazoDias = Math.max(1, Math.round(n(input.prazoDias, 365)));
    const indexador = input.indexador || 'prefixado';
    const taxa = n(input.taxa);
    const cdi = n(input.cdiAnual, premissas?.indices?.cdiAnual || 0);
    const ipca = n(input.ipcaAnual, premissas?.indices?.ipcaAnual || 0);
    let annualRate = taxa;
    if (indexador === 'cdi') annualRate = cdi * taxa / 100;
    if (indexador === 'ipca') annualRate = ipca + taxa;
    const gross = valor * Math.pow(1 + annualRate / 100, prazoDias / 365);
    const lucroBruto = gross - valor;
    const imposto = Math.max(0, lucroBruto * irRate(prazoDias, premissas?.irRegressivo));
    const liquid = gross - imposto;
    return { valor, prazoDias, indexador, annualRate, gross, lucroBruto, imposto, liquid };
  }

  function savingsVsSelic(input) {
    const valueInitial = n(input.valorInicial);
    const pmt = n(input.aporteMensal);
    const months = clampMonths(input.prazoMeses);
    const poupancaMes = 0.5 + n(input.trAnual) / 12;
    const selicMes = annualToMonthly(n(input.selicAnual)) * 100;
    const poupanca = futureValueMonthly(valueInitial, pmt, poupancaMes, months);
    const selic = futureValueMonthly(valueInitial, pmt, selicMes, months);
    return { poupanca, selic, diferenca: selic - poupanca, poupancaMes, selicMes };
  }

  function percentileForIncome(income, faixa) {
    const salario = n(income);
    if (salario >= n(faixa.p95)) return 95;
    if (salario >= n(faixa.p90)) return 90 + (salario - n(faixa.p90)) / Math.max(1, n(faixa.p95) - n(faixa.p90)) * 5;
    if (salario >= n(faixa.p75)) return 75 + (salario - n(faixa.p75)) / Math.max(1, n(faixa.p90) - n(faixa.p75)) * 15;
    if (salario >= n(faixa.p50)) return 50 + (salario - n(faixa.p50)) / Math.max(1, n(faixa.p75) - n(faixa.p50)) * 25;
    return Math.max(1, salario / Math.max(1, n(faixa.p50)) * 50);
  }

  window.BFFinancialFormulas = {
    n,
    annualToMonthly,
    simpleInterest,
    compoundFutureValue,
    requiredPayment,
    monthsToGoal,
    withdrawalFutureValue,
    pricePayment,
    priceSchedule,
    presentValueOfPayments,
    futureValueMonthly,
    emergency,
    fixedCosts,
    creditCapacity,
    consortiumBidCapacity,
    fixedIncomeReturn,
    savingsVsSelic,
    percentileForIncome,
    irRate
  };
})();
