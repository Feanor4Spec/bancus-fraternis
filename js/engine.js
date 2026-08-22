/**
 * ============================================
 * Bancus Fraternus - Motor mensal de consórcio
 * ============================================
 *
 * Fonte única da verdade para saldo, parcelas, custos e eventos. Todos os
 * movimentos monetários são calculados em centavos e cada linha expõe as
 * identidades de saldo, amortização e caixa usadas pela auditoria.
 */

const ConsorcioEngine = (() => {
  'use strict';

  const externalContracts = typeof globalThis !== 'undefined'
    ? globalThis.BFSimulationContracts
    : null;

  const VERSION = externalContracts?.VERSION || '2.0.0';
  const SCHEMA = externalContracts?.SCHEMA || 'bancus.simulation.v2';

  const POLITICA = externalContracts?.POLITICA || Object.freeze({
    A: 'carta',
    B: 'carta_mais_custos'
  });

  const ADIANTAMENTO_TIPO = externalContracts?.ADIANTAMENTO_TIPO || Object.freeze({
    REDUZIR_SALDO: 'reduzir_saldo',
    REDUZIR_PRAZO: 'reduzir_prazo'
  });

  const MODALIDADES_LANCE = externalContracts?.MODALIDADES_LANCE || Object.freeze([
    'sem_lance',
    'livre',
    'fixo',
    'embutido',
    'fgts',
    'combinado'
  ]);

  const LEDGER_KEYS = Object.freeze(['principal', 'taxaAdm', 'fundoReserva', 'seguro']);

  const numberOr = externalContracts?.numberOr || ((value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  });

  const integerOr = externalContracts?.integerOr || ((value, fallback = 0) => {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  });

  const toCents = externalContracts?.toCents || ((value) => {
    const parsed = numberOr(value, 0);
    return Math.round((parsed + Math.sign(parsed || 1) * Number.EPSILON) * 100);
  });

  const fromCents = externalContracts?.fromCents || ((value) => Math.round(numberOr(value, 0)) / 100);

  function roundMoney(value) {
    return fromCents(toCents(value));
  }

  function normalizeParams(rawParams) {
    if (externalContracts?.normalizeParams) return externalContracts.normalizeParams(rawParams);

    const source = rawParams && typeof rawParams === 'object' ? rawParams : {};
    const prazoTotal = Math.max(0, integerOr(source.prazoTotal, 0));
    const defaultMonth = prazoTotal > 0 ? Math.min(12, prazoTotal) : 1;
    const modalidadeLance = source.modalidadeLance === 'proprio'
      ? 'livre'
      : (source.modalidadeLance || 'combinado');

    return {
      ...source,
      valorCarta: numberOr(source.valorCarta, 0),
      prazoTotal,
      taxaAdm: numberOr(source.taxaAdm, 0),
      fundoReserva: numberOr(source.fundoReserva, 0),
      seguro: numberOr(source.seguro, 0),
      seguroTipo: source.seguroTipo || 'percentual',
      tipoIndice: source.tipoIndice || 'fixo',
      indiceReajuste: numberOr(source.indiceReajuste, 0),
      mesAdesao: Math.max(1, integerOr(source.mesAdesao, 1)),
      mesAniversario: Math.max(1, integerOr(source.mesAniversario, defaultMonth)),
      mesContemplacao: Math.max(1, integerOr(source.mesContemplacao, defaultMonth)),
      lanceProprio: numberOr(source.lanceProprio, 0),
      lanceEmbutido: numberOr(source.lanceEmbutido, 0),
      lanceFixo: numberOr(source.lanceFixo, 0),
      usarFGTS: Boolean(source.usarFGTS),
      valorFGTS: numberOr(source.valorFGTS, 0),
      modalidadeLance,
      parcelaReduzida: Boolean(source.parcelaReduzida),
      percentualReducao: numberOr(source.percentualReducao, 0),
      politicaSaldo: source.politicaSaldo || POLITICA.A,
      adiantamentos: Array.isArray(source.adiantamentos)
        ? source.adiantamentos.map((item) => ({ ...item }))
        : [],
      inadimplencias: Array.isArray(source.inadimplencias)
        ? source.inadimplencias.map((item) => ({ ...item }))
        : [],
      multaAtraso: numberOr(source.multaAtraso, 0),
      jurosAtraso: numberOr(source.jurosAtraso, 0)
    };
  }

  function percentOfCents(cents, percent) {
    return Math.round(cents * numberOr(percent, 0) / 100);
  }

  function divideCents(cents, divisor) {
    if (cents <= 0) return 0;
    if (divisor <= 1) return cents;
    return Math.round(cents / divisor);
  }

  function cloneLedger(ledger) {
    return {
      principal: ledger.principal,
      taxaAdm: ledger.taxaAdm,
      fundoReserva: ledger.fundoReserva,
      seguro: ledger.seguro
    };
  }

  function emptyLedger() {
    return { principal: 0, taxaAdm: 0, fundoReserva: 0, seguro: 0 };
  }

  function sumLedger(ledger) {
    return LEDGER_KEYS.reduce((sum, key) => sum + Math.max(0, Math.round(ledger[key] || 0)), 0);
  }

  function sumCostLedger(ledger) {
    return Math.max(0, ledger.taxaAdm) + Math.max(0, ledger.fundoReserva) + Math.max(0, ledger.seguro);
  }

  function buildOpeningLedger(params) {
    const carta = toCents(params.valorCarta);
    const seguro = params.seguroTipo === 'fixo'
      ? toCents(params.seguro) * params.prazoTotal
      : percentOfCents(carta, params.seguro);

    return {
      principal: carta,
      taxaAdm: percentOfCents(carta, params.taxaAdm),
      fundoReserva: percentOfCents(carta, params.fundoReserva),
      seguro: Math.max(0, seguro)
    };
  }

  function policyBalanceCents(ledger, politicaSaldo) {
    return politicaSaldo === POLITICA.B ? sumLedger(ledger) : Math.max(0, ledger.principal);
  }

  function calculateScheduledDue(ledger, remainingPeriods, reductionPercent = 0) {
    const fullPrincipal = divideCents(ledger.principal, remainingPeriods);
    const reduction = Math.min(100, Math.max(0, numberOr(reductionPercent, 0)));
    const principal = Math.min(
      ledger.principal,
      Math.max(0, Math.round(fullPrincipal * (1 - reduction / 100)))
    );

    const allocations = {
      principal,
      taxaAdm: Math.min(ledger.taxaAdm, divideCents(ledger.taxaAdm, remainingPeriods)),
      fundoReserva: Math.min(ledger.fundoReserva, divideCents(ledger.fundoReserva, remainingPeriods)),
      seguro: Math.min(ledger.seguro, divideCents(ledger.seguro, remainingPeriods))
    };

    return {
      ...allocations,
      principalCheio: fullPrincipal,
      total: sumLedger(allocations)
    };
  }

  function applyComponentAmounts(ledger, requested) {
    const applied = emptyLedger();
    LEDGER_KEYS.forEach((key) => {
      const amount = Math.min(Math.max(0, Math.round(requested[key] || 0)), ledger[key]);
      ledger[key] -= amount;
      applied[key] = amount;
    });
    return applied;
  }

  function allocateAcrossLedger(ledger, requestedCents) {
    const total = sumLedger(ledger);
    const appliedTotal = Math.min(Math.max(0, Math.round(requestedCents || 0)), total);
    const allocations = emptyLedger();
    if (appliedTotal === 0 || total === 0) return allocations;

    const shares = LEDGER_KEYS
      .filter((key) => ledger[key] > 0)
      .map((key, order) => {
        const exact = appliedTotal * ledger[key] / total;
        const floor = Math.min(ledger[key], Math.floor(exact));
        allocations[key] = floor;
        return { key, order, fraction: exact - floor };
      });

    let remainder = appliedTotal - sumLedger(allocations);
    shares.sort((left, right) => right.fraction - left.fraction || left.order - right.order);
    while (remainder > 0) {
      let progressed = false;
      for (const share of shares) {
        if (remainder === 0) break;
        if (allocations[share.key] < ledger[share.key]) {
          allocations[share.key] += 1;
          remainder -= 1;
          progressed = true;
        }
      }
      if (!progressed) break;
    }

    applyComponentAmounts(ledger, allocations);
    return allocations;
  }

  function addLedgers(target, source) {
    LEDGER_KEYS.forEach((key) => {
      target[key] += Math.max(0, Math.round(source[key] || 0));
    });
    return target;
  }

  function buildReservedLedger(arrears) {
    const reserved = emptyLedger();
    arrears.forEach((arrear) => addLedgers(reserved, arrear.allocations));
    return reserved;
  }

  function buildAvailableLedger(ledger, arrears) {
    const reserved = buildReservedLedger(arrears);
    const available = emptyLedger();
    LEDGER_KEYS.forEach((key) => {
      available[key] = Math.max(0, ledger[key] - reserved[key]);
    });
    return available;
  }

  function calcularSaldoInicial(rawParams) {
    const params = normalizeParams(rawParams);
    return fromCents(policyBalanceCents(buildOpeningLedger(params), params.politicaSaldo));
  }

  function calcularLance(rawParams) {
    const params = normalizeParams(rawParams);
    const carta = toCents(params.valorCarta);
    const nominal = {
      proprio: percentOfCents(carta, params.lanceProprio),
      embutido: percentOfCents(carta, params.lanceEmbutido),
      fgts: params.usarFGTS ? Math.max(0, toCents(params.valorFGTS)) : 0,
      fixo: percentOfCents(carta, params.lanceFixo)
    };

    let selected = { proprio: 0, embutido: 0, fgts: 0, fixo: 0 };
    switch (params.modalidadeLance) {
      case 'sem_lance':
        break;
      case 'livre':
        selected.proprio = nominal.proprio;
        break;
      case 'fixo':
        selected.fixo = nominal.fixo;
        break;
      case 'embutido':
        selected.embutido = nominal.embutido;
        break;
      case 'fgts':
        selected.fgts = nominal.fgts;
        break;
      case 'combinado':
      default:
        selected = { ...nominal, fixo: 0 };
        break;
    }

    const lanceTotal = Object.values(selected).reduce((sum, value) => sum + value, 0);
    const lanceCaixa = selected.proprio + selected.fgts + selected.fixo;
    const cartaLiquida = Math.max(0, carta - selected.embutido);

    return {
      lanceProprio: fromCents(nominal.proprio),
      lanceEmbutido: fromCents(nominal.embutido),
      lanceFGTS: fromCents(nominal.fgts),
      lanceFixo: fromCents(nominal.fixo),
      lanceProprioSelecionado: fromCents(selected.proprio),
      lanceEmbutidoSelecionado: fromCents(selected.embutido),
      lanceFGTSSelecionado: fromCents(selected.fgts),
      lanceFixoSelecionado: fromCents(selected.fixo),
      lanceCaixa: fromCents(lanceCaixa),
      lanceTotal: fromCents(lanceTotal),
      cartaLiquida: fromCents(cartaLiquida)
    };
  }

  function getIndiceReajuste(rawParams) {
    const params = normalizeParams(rawParams);
    return params.indiceReajuste / 100;
  }

  function isAniversario(month, params) {
    const start = params.mesAniversario;
    return month >= start && (month - start) % 12 === 0;
  }

  function activeDefaults(month, params) {
    return params.inadimplencias
      .map((item, index) => ({ ...item, _index: index }))
      .filter((item) => {
        const start = integerOr(item.mesInicio, 0);
        const length = Math.max(0, integerOr(item.mesesAtraso, 0));
        return month >= start && month < start + length;
      });
  }

  function regularizationsAt(month, params) {
    return params.inadimplencias
      .map((item, index) => ({ ...item, _index: index }))
      .filter((item) => Boolean(item.regularizar) && integerOr(item.mesRegularizacao, 0) === month);
  }

  function advancesAt(month, params) {
    return params.adiantamentos.filter((item) => integerOr(item.mes, 0) === month);
  }

  function describeMoney(cents) {
    return fromCents(cents).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function pendingArrearsCharges(arrears, evaluationMonth, params) {
    let multa = 0;
    let juros = 0;
    arrears.forEach((arrear) => {
      const elapsed = Math.max(1, evaluationMonth - arrear.mes);
      multa += percentOfCents(arrear.total, params.multaAtraso);
      juros += Math.round(arrear.total * (params.jurosAtraso / 100) * elapsed);
    });
    return { multa, juros, total: multa + juros };
  }

  function buildResidual(ledger, arrears, evaluationMonth, params) {
    const charges = pendingArrearsCharges(arrears, evaluationMonth, params);
    const obligation = sumLedger(ledger);
    return {
      status: obligation === 0 && arrears.length === 0 ? 'quitado' : 'residual',
      principal: fromCents(ledger.principal),
      custos: fromCents(sumCostLedger(ledger)),
      obrigacao: fromCents(obligation),
      parcelasEmAtraso: arrears.length,
      encargosProjetados: fromCents(charges.total),
      totalComEncargos: fromCents(obligation + charges.total)
    };
  }

  function calcularCronograma(rawParams) {
    const params = normalizeParams(rawParams);
    const ledger = buildOpeningLedger(params);
    const lance = calcularLance(params);
    const schedule = [];
    const arrears = [];
    let remainingPeriods = params.prazoTotal;

    for (let month = 1; month <= params.prazoTotal && remainingPeriods > 0; month += 1) {
      if (sumLedger(ledger) === 0 && arrears.length === 0) break;

      const openingLedger = cloneLedger(ledger);
      const saldoTotalAnterior = sumLedger(openingLedger);
      const eventos = month === 1 ? ['adesão'] : [];
      const observations = [];
      let indiceAplicado = 0;
      let reajusteValor = 0;
      let valorLance = 0;
      let valorLanceCaixa = 0;
      let lanceExcedente = 0;
      let valorAdiantado = 0;
      let parcelasAbatidas = 0;
      let valorRegularizado = 0;
      let regularizacaoSolicitada = 0;
      let multa = 0;
      let juros = 0;
      let multaPaga = 0;
      let jurosPago = 0;

      if (isAniversario(month, params)) {
        indiceAplicado = getIndiceReajuste(params);
        reajusteValor = Math.round(ledger.principal * indiceAplicado);
        reajusteValor = Math.max(-ledger.principal, reajusteValor);
        ledger.principal += reajusteValor;
        eventos.push('aniversário');
        observations.push(`Reajuste de ${(indiceAplicado * 100).toFixed(2)}%: ${describeMoney(reajusteValor)}.`);
      }

      const adjustedLedger = cloneLedger(ledger);
      const saldoTotalAjustado = sumLedger(adjustedLedger);

      if (month === params.mesContemplacao) {
        const requestedBid = toCents(lance.lanceTotal);
        const requestedEmbedded = toCents(lance.lanceEmbutidoSelecionado);
        const availablePrincipal = buildAvailableLedger(ledger, arrears).principal;
        const appliedBid = Math.min(requestedBid, availablePrincipal);
        const appliedEmbedded = requestedBid > 0
          ? Math.min(appliedBid, Math.round(appliedBid * requestedEmbedded / requestedBid))
          : 0;

        ledger.principal -= appliedBid;
        valorLance = appliedBid;
        valorLanceCaixa = appliedBid - appliedEmbedded;
        lanceExcedente = requestedBid - appliedBid;
        eventos.push('contemplação');
        observations.push(appliedBid > 0
          ? `Contemplação com lance aplicado de ${describeMoney(appliedBid)}.`
          : 'Contemplação sem lance.');
        if (lanceExcedente > 0) observations.push(`Lance excedente não aplicado: ${describeMoney(lanceExcedente)}.`);
      }

      for (const advance of advancesAt(month, params)) {
        const advanceType = advance.tipo || params.formaAdiantamento || ADIANTAMENTO_TIPO.REDUZIR_SALDO;
        const available = buildAvailableLedger(ledger, arrears);
        const referenceDue = calculateScheduledDue(available, remainingPeriods, 0).total;
        const explicitValue = toCents(numberOr(advance.valor, 0));
        const quantity = Math.max(0, integerOr(advance.qtdParcelas, 0));
        const requested = explicitValue > 0 ? explicitValue : referenceDue * quantity;
        const allocations = allocateAcrossLedger(available, requested);
        const applied = sumLedger(applyComponentAmounts(ledger, allocations));
        valorAdiantado += applied;

        if (advanceType === ADIANTAMENTO_TIPO.REDUZIR_PRAZO && referenceDue > 0) {
          const reducible = Math.max(0, remainingPeriods - 1);
          const reduction = Math.min(reducible, Math.floor(applied / referenceDue));
          remainingPeriods -= reduction;
          parcelasAbatidas += reduction;
        }
      }

      if (valorAdiantado > 0) {
        eventos.push('adiantamento');
        observations.push(`Antecipação aplicada: ${describeMoney(valorAdiantado)}.`);
        if (parcelasAbatidas > 0) observations.push(`Prazo reduzido em ${parcelasAbatidas} parcela(s).`);
      }

      const regularizations = regularizationsAt(month, params);
      if (regularizations.length > 0) {
        const indexes = new Set(regularizations.map((item) => item._index));
        const selectedArrears = arrears.filter((item) => indexes.has(item.configIndex));
        const amounts = emptyLedger();

        selectedArrears.forEach((arrear) => addLedgers(amounts, arrear.allocations));
        regularizacaoSolicitada = sumLedger(amounts);
        valorRegularizado = sumLedger(applyComponentAmounts(ledger, amounts));

        selectedArrears.forEach((arrear) => {
          const elapsed = Math.max(1, month - arrear.mes);
          multaPaga += percentOfCents(arrear.total, params.multaAtraso);
          jurosPago += Math.round(arrear.total * (params.jurosAtraso / 100) * elapsed);
        });

        for (let index = arrears.length - 1; index >= 0; index -= 1) {
          if (indexes.has(arrears[index].configIndex)) arrears.splice(index, 1);
        }

        multa = multaPaga;
        juros = jurosPago;
        eventos.push('regularização');
        observations.push(`Regularização de ${selectedArrears.length} parcela(s): ${describeMoney(valorRegularizado)}.`);
        if (regularizacaoSolicitada > valorRegularizado) {
          observations.push(`Diferença já abatida por evento anterior: ${describeMoney(regularizacaoSolicitada - valorRegularizado)}.`);
        }
      }

      const reduced = params.parcelaReduzida && month < params.mesContemplacao;
      const due = calculateScheduledDue(
        buildAvailableLedger(ledger, arrears),
        remainingPeriods,
        reduced ? params.percentualReducao : 0
      );
      const defaults = activeDefaults(month, params);
      const isDefault = defaults.length > 0;
      let currentAmortization = 0;
      let parcelaTotal = 0;
      let valorPago = 0;

      if (isDefault) {
        const defaultConfig = defaults[0];
        const allocations = {
          principal: due.principal,
          taxaAdm: due.taxaAdm,
          fundoReserva: due.fundoReserva,
          seguro: due.seguro
        };
        arrears.push({
          configIndex: defaultConfig._index,
          mes: month,
          allocations,
          total: due.total
        });
        multa = percentOfCents(due.total, params.multaAtraso);
        juros = Math.round(due.total * (params.jurosAtraso / 100));
        eventos.push('inadimplência');
        observations.push(`Parcela de ${describeMoney(due.total)} não paga; saldo mantido.`);
      } else {
        currentAmortization = sumLedger(applyComponentAmounts(ledger, due));
        parcelaTotal = currentAmortization + valorRegularizado + multaPaga + jurosPago;
        valorPago = parcelaTotal;
        if (reduced) {
          observations.push(`Parcela principal reduzida em ${params.percentualReducao.toFixed(2)}%; diferença recomposta no saldo.`);
        }
      }

      const amortizacaoTotal = currentAmortization + valorRegularizado;
      const saldoTotalFinal = sumLedger(ledger);
      const saldoEmAtrasoFinal = sumLedger(buildReservedLedger(arrears));
      const caixaPago = parcelaTotal + valorLanceCaixa + valorAdiantado;
      const prazoRestanteApos = Math.max(0, remainingPeriods - 1);
      const saldoPoliticaAnterior = policyBalanceCents(openingLedger, params.politicaSaldo);
      const saldoPoliticaAjustado = policyBalanceCents(adjustedLedger, params.politicaSaldo);
      const saldoPoliticaFinal = policyBalanceCents(ledger, params.politicaSaldo);
      const uniqueEvents = [...new Set(eventos)];
      const evento = uniqueEvents.length > 0 ? uniqueEvents.join(' + ') : 'normal';

      schedule.push({
        mes: month,
        schema: SCHEMA,
        saldoAnterior: fromCents(saldoPoliticaAnterior),
        saldoAjustado: fromCents(saldoPoliticaAjustado),
        saldoFinal: fromCents(saldoPoliticaFinal),
        saldoTotalAnterior: fromCents(saldoTotalAnterior),
        saldoTotalAjustado: fromCents(saldoTotalAjustado),
        saldoTotalFinal: fromCents(saldoTotalFinal),
        saldoPrincipalAnterior: fromCents(openingLedger.principal),
        saldoPrincipalFinal: fromCents(ledger.principal),
        saldoCustosAnterior: fromCents(sumCostLedger(openingLedger)),
        saldoCustosFinal: fromCents(sumCostLedger(ledger)),
        saldoEmAtrasoFinal: fromCents(saldoEmAtrasoFinal),
        parcelasEmAtraso: arrears.length,
        saldoPoliticaAnterior: fromCents(saldoPoliticaAnterior),
        saldoPoliticaFinal: fromCents(saldoPoliticaFinal),
        indiceAplicado,
        reajusteValor: fromCents(reajusteValor),
        parcelaBase: fromCents(due.principalCheio),
        parcelaReduzida: fromCents(due.principal),
        componenteTaxaAdm: fromCents(due.taxaAdm),
        componenteFundoReserva: fromCents(due.fundoReserva),
        componenteSeguro: fromCents(due.seguro),
        parcelaDevida: fromCents(due.total),
        parcelaTotal: fromCents(parcelaTotal),
        valorPago: fromCents(valorPago),
        caixaPago: fromCents(caixaPago),
        valorLance: fromCents(valorLance),
        valorLanceCaixa: fromCents(valorLanceCaixa),
        lanceExcedente: fromCents(lanceExcedente),
        valorAdiantado: fromCents(valorAdiantado),
        parcelasAbatidas,
        valorRegularizado: fromCents(valorRegularizado),
        regularizacaoSolicitada: fromCents(regularizacaoSolicitada),
        multa: fromCents(multa),
        juros: fromCents(juros),
        multaPaga: fromCents(multaPaga),
        jurosPago: fromCents(jurosPago),
        amortizacaoParcela: fromCents(currentAmortization),
        amortizacaoTotal: fromCents(amortizacaoTotal),
        prazoRestante: remainingPeriods,
        prazoRestanteApos,
        eventos: uniqueEvents,
        evento,
        statusPagamento: isDefault
          ? 'inadimplente'
          : (regularizations.length > 0
              ? (arrears.length > 0 ? 'regularizado_parcial' : 'regularizado')
              : (arrears.length > 0 ? 'em_atraso' : (parcelaTotal > 0 ? 'pago' : 'sem_parcela'))),
        observacao: observations.join(' | ')
      });

      remainingPeriods = prazoRestanteApos;
      if (saldoTotalFinal === 0 && arrears.length === 0) break;
    }

    const evaluationMonth = schedule.length > 0 ? schedule[schedule.length - 1].mes : 0;
    const residual = buildResidual(ledger, arrears, evaluationMonth, params);
    if (schedule.length > 0) schedule[schedule.length - 1].residual = residual;

    Object.defineProperty(schedule, 'meta', {
      configurable: false,
      enumerable: false,
      writable: false,
      value: {
        schema: SCHEMA,
        version: VERSION,
        residual,
        parcelasEmAtraso: arrears.map((item) => ({
          mes: item.mes,
          valor: fromCents(item.total)
        }))
      }
    });

    return schedule;
  }

  function centsFromRow(row, field, fallback = 0) {
    if (row && Object.prototype.hasOwnProperty.call(row, field)) return toCents(row[field]);
    return toCents(fallback);
  }

  function sumRows(rows, getter) {
    return rows.reduce((sum, row) => sum + getter(row), 0);
  }

  function calcularResumo(rawParams, cronograma) {
    const params = normalizeParams(rawParams);
    const rows = Array.isArray(cronograma) ? cronograma : [];
    const opening = buildOpeningLedger(params);
    const lance = calcularLance(params);
    const first = rows[0] || {};
    const last = rows[rows.length - 1] || {};
    const totalParcelas = sumRows(rows, (row) => centsFromRow(row, 'parcelaTotal'));
    const totalAdiantado = sumRows(rows, (row) => centsFromRow(row, 'valorAdiantado'));
    const totalLancesAplicados = sumRows(rows, (row) => centsFromRow(row, 'valorLance'));
    const totalLancesCaixa = sumRows(rows, (row) => centsFromRow(row, 'valorLanceCaixa'));
    const totalLancesEmbutidos = totalLancesAplicados - totalLancesCaixa;
    const totalPago = sumRows(rows, (row) => {
      if (Object.prototype.hasOwnProperty.call(row, 'caixaPago')) return toCents(row.caixaPago);
      return toCents(row.parcelaTotal) + toCents(row.valorAdiantado);
    });
    const totalPagoAteContemplacao = sumRows(
      rows.filter((row) => row.mes <= params.mesContemplacao),
      (row) => Object.prototype.hasOwnProperty.call(row, 'caixaPago')
        ? toCents(row.caixaPago)
        : toCents(row.parcelaTotal) + toCents(row.valorAdiantado)
    );
    const totalMultas = sumRows(rows, (row) => centsFromRow(row, 'multaPaga'));
    const totalJuros = sumRows(rows, (row) => centsFromRow(row, 'jurosPago'));
    const totalReajustes = sumRows(rows, (row) => centsFromRow(row, 'reajusteValor'));
    const totalAmortizado = sumRows(rows, (row) => centsFromRow(row, 'amortizacaoTotal'))
      + totalAdiantado + totalLancesAplicados;
    const lastTotalBalance = Object.prototype.hasOwnProperty.call(last, 'saldoTotalFinal')
      ? numberOr(last.saldoTotalFinal, fromCents(sumLedger(opening)))
      : numberOr(last.saldoFinal, fromCents(sumLedger(opening)));
    const residual = cronograma?.meta?.residual || last.residual || {
      status: toCents(lastTotalBalance) === 0 ? 'quitado' : 'residual',
      principal: numberOr(last.saldoPrincipalFinal, params.valorCarta),
      custos: numberOr(last.saldoCustosFinal, fromCents(sumCostLedger(opening))),
      obrigacao: lastTotalBalance,
      parcelasEmAtraso: 0,
      encargosProjetados: 0,
      totalComEncargos: lastTotalBalance
    };
    const contemplationRow = rows.find((row) => row.mes === params.mesContemplacao);
    const prazoRestante = contemplationRow
      ? numberOr(contemplationRow.prazoRestanteApos, contemplationRow.prazoRestante)
      : Math.max(0, params.prazoTotal - params.mesContemplacao);
    const economicContribution = totalPago + totalLancesEmbutidos;
    const custoTotal = economicContribution - opening.principal;

    return {
      schema: SCHEMA,
      versaoMotor: VERSION,
      valorCarta: fromCents(opening.principal),
      valorTotalPlano: fromCents(sumLedger(opening)),
      taxaAdmTotal: fromCents(opening.taxaAdm),
      taxaAdmPercentual: params.taxaAdm,
      fundoReservaTotal: fromCents(opening.fundoReserva),
      fundoReservaPercentual: params.fundoReserva,
      seguroTotal: fromCents(opening.seguro),
      saldoInicial: calcularSaldoInicial(params),
      saldoTotalInicial: fromCents(sumLedger(opening)),
      saldoFinal: numberOr(last.saldoFinal, calcularSaldoInicial(params)),
      saldoTotalFinal: lastTotalBalance,
      parcelaBase: numberOr(first.parcelaBase, 0),
      parcelaTotalAtual: numberOr(first.parcelaTotal, 0),
      lanceProprio: lance.lanceProprio,
      lanceEmbutido: lance.lanceEmbutido,
      lanceFGTS: lance.lanceFGTS,
      lanceFixo: lance.lanceFixo,
      lanceProprioSelecionado: lance.lanceProprioSelecionado,
      lanceEmbutidoSelecionado: lance.lanceEmbutidoSelecionado,
      lanceFGTSSelecionado: lance.lanceFGTSSelecionado,
      lanceFixoSelecionado: lance.lanceFixoSelecionado,
      lanceTotal: lance.lanceTotal,
      lanceAplicado: fromCents(totalLancesAplicados),
      lanceCaixa: fromCents(totalLancesCaixa),
      lanceEmbutidoAplicado: fromCents(totalLancesEmbutidos),
      cartaLiquida: lance.cartaLiquida,
      prazoTotal: params.prazoTotal,
      prazoRestante,
      custoTotal: fromCents(custoTotal),
      totalPagoAteContemplacao: fromCents(totalPagoAteContemplacao),
      totalPago: fromCents(totalPago),
      totalPagoParcelas: fromCents(totalParcelas),
      totalAdiantado: fromCents(totalAdiantado),
      totalMultas: fromCents(totalMultas),
      totalJuros: fromCents(totalJuros),
      totalEncargos: fromCents(totalMultas + totalJuros),
      totalReajustes: fromCents(totalReajustes),
      totalAmortizado: fromCents(totalAmortizado),
      mesContemplacao: params.mesContemplacao,
      quitado: residual.status === 'quitado',
      residual,
      cronograma: rows
    };
  }

  function isInvalidProvidedNumber(source, key) {
    return source
      && Object.prototype.hasOwnProperty.call(source, key)
      && source[key] !== ''
      && source[key] != null
      && !Number.isFinite(Number(source[key]));
  }

  function validarParametros(rawParams) {
    const source = rawParams && typeof rawParams === 'object' ? rawParams : {};
    const params = normalizeParams(source);
    const messages = [];
    const numericFields = [
      'valorCarta', 'prazoTotal', 'taxaAdm', 'fundoReserva', 'seguro',
      'indiceReajuste', 'mesAniversario', 'mesContemplacao', 'lanceProprio',
      'lanceEmbutido', 'lanceFixo', 'valorFGTS', 'percentualReducao',
      'multaAtraso', 'jurosAtraso'
    ];

    numericFields.forEach((key) => {
      if (isInvalidProvidedNumber(source, key)) messages.push(`${key} deve ser numérico e finito.`);
    });
    ['prazoTotal', 'mesAniversario', 'mesContemplacao'].forEach((key) => {
      if (source[key] != null && source[key] !== '' && Number.isFinite(Number(source[key])) && !Number.isInteger(Number(source[key]))) {
        messages.push(`${key} deve ser um número inteiro.`);
      }
    });

    if (!(params.valorCarta > 0)) messages.push('O valor da carta de crédito deve ser maior que zero.');
    if (!Number.isInteger(params.prazoTotal) || params.prazoTotal < 1 || params.prazoTotal > 1200) {
      messages.push('O prazo total deve ser um inteiro entre 1 e 1200 meses.');
    }

    [
      ['taxaAdm', 'A taxa de administração'],
      ['fundoReserva', 'O fundo de reserva'],
      ['multaAtraso', 'A multa por atraso'],
      ['jurosAtraso', 'Os juros por atraso']
    ].forEach(([key, label]) => {
      if (params[key] < 0 || params[key] > 100) messages.push(`${label} deve estar entre 0% e 100%.`);
    });

    if (!['percentual', 'fixo'].includes(params.seguroTipo)) {
      messages.push('O tipo de seguro deve ser percentual ou fixo.');
    }
    if (![
      'fixo', 'ipca', 'incc', 'fipe', 'personalizado',
      'igp-m', 'igpm', 'tr', 'outro', 'pré-fixado', 'pre-fixado'
    ].includes(String(params.tipoIndice).toLowerCase())) {
      messages.push('O tipo de índice de reajuste é inválido.');
    }
    if (params.seguro < 0 || (params.seguroTipo === 'percentual' && params.seguro > 100)) {
      messages.push(params.seguroTipo === 'fixo'
        ? 'O seguro fixo deve ser não negativo.'
        : 'O seguro percentual deve estar entre 0% e 100%.');
    }
    if (![POLITICA.A, POLITICA.B].includes(params.politicaSaldo)) {
      messages.push('A política de saldo deve ser carta ou carta_mais_custos.');
    }
    if (params.indiceReajuste <= -100 || params.indiceReajuste > 1000) {
      messages.push('O índice de reajuste deve ser maior que -100% e menor ou igual a 1000%.');
    }
    if (params.mesContemplacao < 1 || params.mesContemplacao > params.prazoTotal) {
      messages.push(`O mês de contemplação deve estar entre 1 e ${params.prazoTotal}.`);
    }
    if (params.mesAniversario < 1 || params.mesAniversario > params.prazoTotal) {
      messages.push('O mês aniversário do grupo deve ser válido.');
    }
    if (!MODALIDADES_LANCE.includes(params.modalidadeLance)) {
      messages.push('A modalidade de lance é inválida.');
    }
    [
      ['lanceProprio', 'O percentual de lance próprio'],
      ['lanceEmbutido', 'O percentual de lance embutido'],
      ['lanceFixo', 'O percentual de lance fixo']
    ].forEach(([key, label]) => {
      if (params[key] < 0 || params[key] > 100) messages.push(`${label} deve estar entre 0% e 100%.`);
    });
    if (params.valorFGTS < 0) messages.push('O valor de FGTS não pode ser negativo.');
    if (params.percentualReducao < 0 || params.percentualReducao > 100) {
      messages.push('O percentual de redução deve estar entre 0% e 100%.');
    }

    const lance = calcularLance(params);
    if (toCents(lance.lanceTotal) > toCents(params.valorCarta)) {
      messages.push('O lance selecionado não pode superar o valor da carta de crédito.');
    }
    if (toCents(lance.cartaLiquida) < 0) {
      messages.push('A carta líquida não pode ficar negativa.');
    }

    params.adiantamentos.forEach((advance, index) => {
      const label = `Adiantamento ${index + 1}`;
      const month = integerOr(advance.mes, 0);
      const value = numberOr(advance.valor, 0);
      const quantity = integerOr(advance.qtdParcelas, 0);
      const advanceType = advance.tipo || params.formaAdiantamento || ADIANTAMENTO_TIPO.REDUZIR_SALDO;
      if (month < 1 || month > params.prazoTotal) {
        messages.push(`${label}: mês deve estar entre 1 e ${params.prazoTotal}.`);
      }
      if (![ADIANTAMENTO_TIPO.REDUZIR_SALDO, ADIANTAMENTO_TIPO.REDUZIR_PRAZO].includes(advanceType)) {
        messages.push(`${label}: tipo deve ser reduzir_saldo ou reduzir_prazo.`);
      }
      if (isInvalidProvidedNumber(advance, 'valor') || value < 0) {
        messages.push(`${label}: valor deve ser numérico e não negativo.`);
      }
      if (isInvalidProvidedNumber(advance, 'qtdParcelas') || quantity < 0) {
        messages.push(`${label}: quantidade de parcelas deve ser um inteiro não negativo.`);
      }
      if ((advance.mes != null && !Number.isInteger(Number(advance.mes)))
        || (advance.qtdParcelas != null && !Number.isInteger(Number(advance.qtdParcelas)))) {
        messages.push(`${label}: mês e quantidade de parcelas devem ser inteiros.`);
      }
      if (!(value > 0) && !(quantity > 0)) {
        messages.push(`${label}: informe um valor ou uma quantidade de parcelas maior que zero.`);
      }
    });

    const ranges = [];
    params.inadimplencias.forEach((item, index) => {
      const label = `Inadimplência ${index + 1}`;
      const start = integerOr(item.mesInicio, 0);
      const length = integerOr(item.mesesAtraso, 0);
      const end = start + length - 1;
      if ((item.mesInicio != null && !Number.isInteger(Number(item.mesInicio)))
        || (item.mesesAtraso != null && !Number.isInteger(Number(item.mesesAtraso)))
        || (item.regularizar && !Number.isInteger(Number(item.mesRegularizacao)))) {
        messages.push(`${label}: meses devem ser números inteiros.`);
      }
      if (start < 1 || start > params.prazoTotal) messages.push(`${label}: mês de início inválido.`);
      if (length < 1 || end > params.prazoTotal) {
        messages.push(`${label}: período de atraso deve caber no prazo contratado.`);
      }
      if (item.regularizar) {
        const regularizationMonth = integerOr(item.mesRegularizacao, 0);
        if (regularizationMonth <= end || regularizationMonth > params.prazoTotal) {
          messages.push(`${label}: mês de regularização deve ser posterior ao atraso e estar no prazo.`);
        }
      }
      ranges.push({ start, end, index });
    });

    for (let left = 0; left < ranges.length; left += 1) {
      for (let right = left + 1; right < ranges.length; right += 1) {
        if (ranges[left].start <= ranges[right].end && ranges[right].start <= ranges[left].end) {
          messages.push(`Inadimplências ${left + 1} e ${right + 1}: períodos sobrepostos não são permitidos.`);
        }
      }
    }

    const isDelinquentMonth = (month) => ranges.some((range) => month >= range.start && month <= range.end);
    params.adiantamentos.forEach((advance, index) => {
      if (isDelinquentMonth(integerOr(advance.mes, 0))) {
        messages.push(`Adiantamento ${index + 1}: não pode coincidir com mês de inadimplência sem caixa.`);
      }
    });
    if (toCents(lance.lanceCaixa) > 0 && isDelinquentMonth(params.mesContemplacao)) {
      messages.push('Lance com recurso externo não pode coincidir com mês de inadimplência sem caixa.');
    }

    return { valido: messages.length === 0, mensagens: [...new Set(messages)], parametros: params };
  }

  function validarInvariantes(cronograma) {
    const rows = Array.isArray(cronograma) ? cronograma : [];
    const messages = [];

    rows.forEach((row, index) => {
      const label = `Mês ${row.mes || index + 1}`;
      const opening = toCents(row.saldoTotalAnterior);
      const adjustment = toCents(row.reajusteValor);
      const closing = toCents(row.saldoTotalFinal);
      const expectedClosing = opening + adjustment
        - toCents(row.valorLance)
        - toCents(row.valorAdiantado)
        - toCents(row.amortizacaoTotal);
      if (expectedClosing !== closing) messages.push(`${label}: identidade do saldo não fecha.`);

      const expectedCash = toCents(row.parcelaTotal)
        + toCents(row.valorLanceCaixa)
        + toCents(row.valorAdiantado);
      if (expectedCash !== toCents(row.caixaPago)) messages.push(`${label}: identidade do caixa não fecha.`);

      if (Array.isArray(row.eventos) && row.eventos.includes('inadimplência')) {
        if (toCents(row.parcelaTotal) !== 0 || toCents(row.valorPago) !== 0 || toCents(row.caixaPago) !== 0) {
          messages.push(`${label}: linha inadimplente registra caixa pago.`);
        }
      }
      if (closing < 0) messages.push(`${label}: saldo final negativo.`);
    });

    const external = externalContracts?.validateScheduleInvariants
      ? externalContracts.validateScheduleInvariants(rows)
      : { valido: true, mensagens: [] };
    return {
      valido: messages.length === 0 && external.valido,
      mensagens: [...new Set([...messages, ...(external.mensagens || [])])]
    };
  }

  function validarResumoInvariantes(resumo) {
    const messages = [];
    const totalObligation = toCents(resumo.saldoTotalInicial) + toCents(resumo.totalReajustes);
    const reconciledObligation = toCents(resumo.totalAmortizado) + toCents(resumo.residual?.obrigacao);
    if (totalObligation !== reconciledObligation) {
      messages.push('Reconciliação global do saldo não fecha.');
    }

    const economicCash = toCents(resumo.totalPago) + toCents(resumo.lanceEmbutidoAplicado);
    const reconciledCash = toCents(resumo.totalAmortizado) + toCents(resumo.totalEncargos);
    if (economicCash !== reconciledCash) {
      messages.push('Reconciliação global do caixa não fecha.');
    }

    return {
      valido: messages.length === 0,
      mensagens: messages,
      saldo: {
        obrigacaoMaisReajustes: fromCents(totalObligation),
        amortizacaoMaisResidual: fromCents(reconciledObligation)
      },
      caixa: {
        caixaMaisLanceEmbutido: fromCents(economicCash),
        amortizacaoMaisEncargos: fromCents(reconciledCash)
      }
    };
  }

  function simular(rawParams) {
    const validation = validarParametros(rawParams);
    if (!validation.valido) {
      return {
        erro: true,
        mensagens: validation.mensagens,
        contrato: { schema: SCHEMA, version: VERSION }
      };
    }

    const params = validation.parametros;
    const cronograma = calcularCronograma(params);
    const invariants = validarInvariantes(cronograma);
    if (!invariants.valido) {
      return {
        erro: true,
        mensagens: invariants.mensagens,
        contrato: { schema: SCHEMA, version: VERSION },
        auditoria: { invariantes: invariants },
        cronograma
      };
    }

    const resumo = calcularResumo(params, cronograma);
    const globalInvariants = validarResumoInvariantes(resumo);
    if (!globalInvariants.valido) {
      return {
        erro: true,
        mensagens: globalInvariants.mensagens,
        contrato: { schema: SCHEMA, version: VERSION },
        resumo,
        cronograma,
        auditoria: { invariantes: invariants, reconciliacao: globalInvariants }
      };
    }
    return {
      erro: false,
      contrato: { schema: SCHEMA, version: VERSION },
      resumo,
      cronograma,
      residual: resumo.residual,
      auditoria: {
        moeda: 'BRL',
        precisao: 'centavos',
        invariantes: invariants,
        reconciliacao: globalInvariants
      }
    };
  }

  function compararCenarios(params) {
    const normalized = normalizeParams(params);
    const comContemplacao = simular(normalized);
    const semContemplacao = simular({
      ...normalized,
      mesContemplacao: normalized.prazoTotal,
      lanceProprio: 0,
      lanceEmbutido: 0,
      lanceFixo: 0,
      usarFGTS: false,
      valorFGTS: 0
    });
    const parcelaCheia = simular({
      ...normalized,
      parcelaReduzida: false,
      percentualReducao: 0
    });

    return { comContemplacao, semContemplacao, parcelaCheia };
  }

  return Object.freeze({
    VERSION,
    SCHEMA,
    POLITICA,
    ADIANTAMENTO_TIPO,
    simular,
    calcularSaldoInicial,
    calcularLance,
    calcularCronograma,
    calcularResumo,
    validarParametros,
    validarInvariantes,
    validarResumoInvariantes,
    compararCenarios,
    getIndiceReajuste,
    roundMoney
  });
})();

if (typeof globalThis !== 'undefined') globalThis.ConsorcioEngine = ConsorcioEngine;
if (typeof module !== 'undefined' && module.exports) module.exports = ConsorcioEngine;
