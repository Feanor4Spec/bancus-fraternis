/**
 * ============================================
 * ConsórcioPro - Motor de Cálculo (Engine)
 * ============================================
 * Contém toda a lógica financeira do simulador.
 * Implementa a árvore de decisão conforme PRD.
 * ============================================
 */

const ConsorcioEngine = (() => {
  'use strict';

  // ─── Política de Saldo Devedor Inicial ───
  const POLITICA = {
    A: 'carta',           // Saldo = Valor da Carta
    B: 'carta_mais_custos' // Saldo = Carta + TaxaAdm + FundoReserva + Seguro
  };

  // ─── Estratégia de Adiantamento ───
  const ADIANTAMENTO_TIPO = {
    REDUZIR_SALDO: 'reduzir_saldo',
    REDUZIR_PRAZO: 'reduzir_prazo'
  };

  /**
   * Calcula o saldo devedor inicial conforme política escolhida.
   * @param {Object} params - Parâmetros da simulação
   * @returns {number} Saldo devedor inicial
   */
  function calcularSaldoInicial(params) {
    const carta = params.valorCarta;
    if (params.politicaSaldo === POLITICA.B) {
      const taxaAdmTotal = carta * (params.taxaAdm / 100);
      const fundoReservaTotal = carta * (params.fundoReserva / 100);
      const seguroTotal = params.seguroTipo === 'percentual'
        ? carta * (params.seguro / 100)
        : params.seguro * params.prazoTotal;
      return carta + taxaAdmTotal + fundoReservaTotal + seguroTotal;
    }
    return carta; // Política A
  }

  /**
   * Calcula os valores de lance (bid).
   * @param {Object} params - Parâmetros da simulação
   * @returns {Object} Detalhes do lance
   */
  function calcularLance(params) {
    const carta = params.valorCarta;
    const lanceProprio = carta * (params.lanceProprio / 100);
    const lanceEmbutido = carta * (params.lanceEmbutido / 100);
    const lanceFGTS = params.usarFGTS ? params.valorFGTS : 0;
    const lanceFixo = carta * (params.lanceFixo / 100);

    let lanceTotal = 0;
    switch (params.modalidadeLance) {
      case 'livre':
        lanceTotal = lanceProprio;
        break;
      case 'fixo':
        lanceTotal = lanceFixo;
        break;
      case 'embutido':
        lanceTotal = lanceEmbutido;
        break;
      case 'fgts':
        lanceTotal = lanceFGTS;
        break;
      case 'combinado':
        lanceTotal = lanceProprio + lanceEmbutido + lanceFGTS;
        break;
      default:
        lanceTotal = lanceProprio + lanceEmbutido + lanceFGTS;
    }

    const cartaLiquida = carta - lanceEmbutido;

    return {
      lanceProprio,
      lanceEmbutido,
      lanceFGTS,
      lanceFixo,
      lanceTotal,
      cartaLiquida
    };
  }

  /**
   * Verifica se o mês t é um mês-aniversário do grupo.
   * O reajuste ocorre a cada 12 meses a partir do mês-aniversário.
   * @param {number} t - Mês atual
   * @param {Object} params - Parâmetros
   * @returns {boolean}
   */
  function isAniversario(t, params) {
    if (t <= 1) return false;
    const mesAniv = params.mesAniversario;
    return t >= mesAniv && (t - mesAniv) % 12 === 0;
  }

  /**
   * Verifica se há adiantamento de parcelas neste mês.
   * @param {number} t - Mês atual
   * @param {Object} params - Parâmetros
   * @returns {Object|null} Dados do adiantamento ou null
   */
  function getAdiantamento(t, params) {
    if (!params.adiantamentos || params.adiantamentos.length === 0) return null;
    return params.adiantamentos.find(a => a.mes === t) || null;
  }

  /**
   * Verifica se há inadimplência neste mês.
   * @param {number} t - Mês atual
   * @param {Object} params - Parâmetros
   * @returns {Object|null} Dados da inadimplência ou null
   */
  function getInadimplencia(t, params) {
    if (!params.inadimplencias || params.inadimplencias.length === 0) return null;
    return params.inadimplencias.find(i => {
      return t >= i.mesInicio && t < i.mesInicio + i.mesesAtraso;
    }) || null;
  }

  /**
   * Verifica se este mês é de regularização de inadimplência.
   * @param {number} t - Mês atual
   * @param {Object} params - Parâmetros
   * @returns {Object|null}
   */
  function getRegularizacao(t, params) {
    if (!params.inadimplencias || params.inadimplencias.length === 0) return null;
    return params.inadimplencias.find(i => {
      return i.regularizar && t === i.mesRegularizacao;
    }) || null;
  }

  /**
   * Calcula o índice de reajuste a ser aplicado.
   * @param {Object} params - Parâmetros
   * @returns {number} Índice decimal (ex: 0.05 para 5%)
   */
  function getIndiceReajuste(params) {
    switch (params.tipoIndice) {
      case 'fixo':
        return params.indiceReajuste / 100;
      case 'ipca':
      case 'incc':
      case 'fipe':
        // Em produção, buscar dados reais. Para simulação, usar valor informado
        return params.indiceReajuste / 100;
      case 'personalizado':
        return params.indiceReajuste / 100;
      default:
        return params.indiceReajuste / 100;
    }
  }

  /**
   * ════════════════════════════════════════════
   * MOTOR PRINCIPAL - Árvore de Decisão
   * ════════════════════════════════════════════
   * Implementa a lógica mensal conforme PRD:
   * 
   * t > N? → Parcela = 0
   * t = 1? → Parcela = Saldo / N (Adesão)
   * t = Aniversário? → Reajuste + recálculo
   * t = Contemplação? → Lance + recálculo
   * Adiantamento? → Abater saldo ou prazo
   * Inadimplência? → Multa + juros
   * Caso geral → Parcela = Saldo / Prazo_Restante
   */
  function calcularCronograma(params) {
    const N = params.prazoTotal;
    let saldoDevedor = calcularSaldoInicial(params);
    let prazoRestante = N;
    const lance = calcularLance(params);
    const indice = getIndiceReajuste(params);
    const cronograma = [];

    // Acumuladores
    let totalPago = 0;
    let totalPagoAteContemplacao = 0;
    let parcelasAcumuladasInadimplencia = [];

    // Controle de parcela reduzida
    const usarReducao = params.parcelaReduzida;
    const percentualReducao = params.percentualReducao / 100;
    const mesContemplacao = params.mesContemplacao;

    for (let t = 1; t <= N; t++) {
      // ─── Verificação: t > N (safety check) ───
      if (prazoRestante <= 0) break;

      let parcela = 0;
      let parcelaBase = 0;
      let evento = 'normal';
      let saldoAnterior = saldoDevedor;
      let saldoAjustado = saldoDevedor;
      let indiceAplicado = 0;
      let valorLanceMes = 0;
      let valorAdiantado = 0;
      let multaMes = 0;
      let jurosMes = 0;
      let observacao = '';

      // ─── CASO 1: Mês de Adesão (t = 1) ───
      if (t === 1) {
        parcela = saldoDevedor / prazoRestante;
        evento = 'adesão';
        observacao = 'Primeira parcela do consórcio';
      }
      // ─── CASO: Meses subsequentes ───
      else {
        prazoRestante--;

        // ─── CASO 2: Mês Aniversário do Grupo ───
        if (isAniversario(t, params)) {
          saldoAjustado = saldoDevedor * (1 + indice);
          saldoDevedor = saldoAjustado;
          indiceAplicado = indice;
          evento = 'aniversário';
          observacao = `Reajuste de ${(indice * 100).toFixed(2)}% aplicado ao saldo`;
        }

        // ─── CASO 3: Mês de Contemplação ───
        if (t === mesContemplacao) {
          // Aplicar lance
          if (lance.lanceTotal > 0) {
            saldoDevedor = saldoDevedor - lance.lanceTotal;
            if (saldoDevedor < 0) saldoDevedor = 0;
            valorLanceMes = lance.lanceTotal;
          }
          evento = evento === 'aniversário'
            ? 'aniversário + contemplação'
            : 'contemplação';
          observacao += (observacao ? ' | ' : '') + 'Contemplação realizada';
          if (lance.lanceTotal > 0) {
            observacao += ` com lance de R$ ${lance.lanceTotal.toFixed(2)}`;
          }
        }

        // ─── CASO 4: Adiantamento de Parcelas ───
        const adiantamento = getAdiantamento(t, params);
        if (adiantamento) {
          const valorAdiant = adiantamento.valor ||
            (adiantamento.qtdParcelas * (saldoDevedor / prazoRestante));

          if (adiantamento.tipo === ADIANTAMENTO_TIPO.REDUZIR_SALDO) {
            saldoDevedor -= valorAdiant;
            if (saldoDevedor < 0) saldoDevedor = 0;
            observacao += (observacao ? ' | ' : '') +
              `Adiantamento (redução de saldo): R$ ${valorAdiant.toFixed(2)}`;
          } else {
            // Redução de prazo: abater parcelas finais
            const parcelasAbatidas = Math.floor(valorAdiant / (saldoDevedor / prazoRestante));
            prazoRestante -= parcelasAbatidas;
            if (prazoRestante < 1) prazoRestante = 1;
            saldoDevedor -= valorAdiant;
            if (saldoDevedor < 0) saldoDevedor = 0;
            observacao += (observacao ? ' | ' : '') +
              `Adiantamento (redução de prazo): ${parcelasAbatidas} parcelas`;
          }
          valorAdiantado = valorAdiant;
          evento = evento !== 'normal' ? evento + ' + adiantamento' : 'adiantamento';
        }

        // ─── CASO 5: Inadimplência ───
        const inadimplencia = getInadimplencia(t, params);
        if (inadimplencia) {
          parcelaBase = saldoDevedor / prazoRestante;
          const mesesAtrasados = t - inadimplencia.mesInicio + 1;
          multaMes = parcelaBase * (params.multaAtraso / 100);
          jurosMes = parcelaBase * (params.jurosAtraso / 100) * mesesAtrasados;

          parcelasAcumuladasInadimplencia.push({
            mes: t,
            parcelaBase,
            multa: multaMes,
            juros: jurosMes,
            total: parcelaBase + multaMes + jurosMes
          });

          // Saldo devedor mantido até regularização
          parcela = 0; // Não paga no mês
          evento = 'inadimplência';
          observacao = `Inadimplência - Mês ${mesesAtrasados} de atraso. ` +
            `Multa: R$ ${multaMes.toFixed(2)} | Juros: R$ ${jurosMes.toFixed(2)}`;
        }

        // ─── Regularização de Inadimplência ───
        const regularizacao = getRegularizacao(t, params);
        if (regularizacao) {
          const totalAtrasado = parcelasAcumuladasInadimplencia.reduce(
            (sum, p) => sum + p.total, 0
          );
          multaMes = parcelasAcumuladasInadimplencia.reduce(
            (sum, p) => sum + p.multa, 0
          );
          jurosMes = parcelasAcumuladasInadimplencia.reduce(
            (sum, p) => sum + p.juros, 0
          );

          // Pagar todas as parcelas atrasadas + encargos + parcela atual
          parcela = totalAtrasado + (saldoDevedor / prazoRestante);
          evento = 'regularização';
          observacao = `Regularização: ${parcelasAcumuladasInadimplencia.length} parcelas ` +
            `atrasadas quitadas. Total: R$ ${totalAtrasado.toFixed(2)}`;
          parcelasAcumuladasInadimplencia = [];
        }

        // ─── CASO GERAL ───
        if (evento === 'normal' || evento === 'aniversário' ||
          evento === 'contemplação' || evento === 'aniversário + contemplação' ||
          evento === 'adiantamento' || evento.includes('adiantamento')) {
          if (prazoRestante > 0) {
            parcela = saldoDevedor / prazoRestante;
          }
        }
      }

      // Aplicar parcela reduzida (pré-contemplação)
      let parcelaFinal = parcela;
      if (usarReducao && t < mesContemplacao && evento !== 'inadimplência') {
        parcelaFinal = parcela * (1 - percentualReducao);
        observacao += (observacao ? ' | ' : '') +
          `Parcela reduzida (${(percentualReducao * 100).toFixed(0)}%)`;
      }

      // Calcular componentes da parcela (para exibição detalhada)
      const componenteTaxaAdm = (params.valorCarta * (params.taxaAdm / 100)) / N;
      const componenteFundoReserva = (params.valorCarta * (params.fundoReserva / 100)) / N;
      const componenteSeguro = params.seguroTipo === 'percentual'
        ? (params.valorCarta * (params.seguro / 100)) / N
        : params.seguro;

      // Atualizar saldo devedor após pagamento
      let saldoFinal = saldoDevedor;
      if (evento !== 'inadimplência') {
        saldoFinal = saldoDevedor - parcela;
        if (saldoFinal < 0.01) saldoFinal = 0;
      }

      // Parcela total = parcela base + componentes (apenas para visualização)
      const parcelaTotal = parcelaFinal + componenteTaxaAdm +
        componenteFundoReserva + componenteSeguro;

      totalPago += evento !== 'inadimplência' ? parcelaTotal : 0;
      if (t <= mesContemplacao) {
        totalPagoAteContemplacao += evento !== 'inadimplência' ? parcelaTotal : 0;
      }

      cronograma.push({
        mes: t,
        saldoAnterior: saldoAnterior,
        saldoAjustado: saldoAjustado,
        indiceAplicado: indiceAplicado,
        parcelaBase: parcela,
        parcelaReduzida: parcelaFinal,
        componenteTaxaAdm,
        componenteFundoReserva,
        componenteSeguro,
        parcelaTotal: parcelaTotal,
        valorLance: valorLanceMes,
        valorAdiantado: valorAdiantado,
        multa: multaMes,
        juros: jurosMes,
        saldoFinal: saldoFinal,
        prazoRestante: prazoRestante,
        evento: evento,
        observacao: observacao
      });

      // Atualizar saldo para o próximo mês
      if (evento !== 'inadimplência') {
        saldoDevedor = saldoFinal;
      }
    }

    return cronograma;
  }

  /**
   * Calcula o resumo executivo da simulação.
   * @param {Object} params - Parâmetros
   * @param {Array} cronograma - Cronograma calculado
   * @returns {Object} Resumo com KPIs
   */
  function calcularResumo(params, cronograma) {
    const lance = calcularLance(params);
    const saldoInicial = calcularSaldoInicial(params);
    const N = params.prazoTotal;
    const carta = params.valorCarta;

    // Valores totais das taxas
    const taxaAdmTotal = carta * (params.taxaAdm / 100);
    const fundoReservaTotal = carta * (params.fundoReserva / 100);
    const seguroTotal = params.seguroTipo === 'percentual'
      ? carta * (params.seguro / 100)
      : params.seguro * N;

    // Valor total do plano
    const valorTotalPlano = carta + taxaAdmTotal + fundoReservaTotal + seguroTotal;

    // Parcela base (mês 1)
    const parcelaBase = cronograma.length > 0 ? cronograma[0].parcelaBase : 0;

    // Parcela total atual (mês 1)
    const parcelaTotalAtual = cronograma.length > 0 ? cronograma[0].parcelaTotal : 0;

    // Total pago
    const totalPago = cronograma.reduce((sum, m) => sum + m.parcelaTotal, 0);

    // Total pago até contemplação
    const mesContemplacao = params.mesContemplacao;
    const totalPagoAteContemplacao = cronograma
      .filter(m => m.mes <= mesContemplacao)
      .reduce((sum, m) => sum + m.parcelaTotal, 0);

    // Prazo restante após contemplação
    const mesContempEntry = cronograma.find(m => m.mes === mesContemplacao);
    const prazoRestanteAposContemp = mesContempEntry
      ? mesContempEntry.prazoRestante
      : N - mesContemplacao;

    // Custo total estimado (total pago em parcelas + lance - valor da carta)
    const custoTotal = totalPago + lance.lanceTotal - carta;

    return {
      valorCarta: carta,
      valorTotalPlano,
      taxaAdmTotal,
      taxaAdmPercentual: params.taxaAdm,
      fundoReservaTotal,
      fundoReservaPercentual: params.fundoReserva,
      seguroTotal,
      saldoInicial,
      parcelaBase,
      parcelaTotalAtual,
      lanceProprio: lance.lanceProprio,
      lanceEmbutido: lance.lanceEmbutido,
      lanceFGTS: lance.lanceFGTS,
      lanceTotal: lance.lanceTotal,
      cartaLiquida: lance.cartaLiquida,
      prazoTotal: N,
      prazoRestante: prazoRestanteAposContemp,
      custoTotal,
      totalPagoAteContemplacao,
      totalPago,
      mesContemplacao,
      cronograma
    };
  }

  /**
   * Executa simulação completa.
   * @param {Object} params - Todos os parâmetros da simulação
   * @returns {Object} Resultado completo (resumo + cronograma)
   */
  function simular(params) {
    // Validar parâmetros
    const validacao = validarParametros(params);
    if (!validacao.valido) {
      return { erro: true, mensagens: validacao.mensagens };
    }

    const cronograma = calcularCronograma(params);
    const resumo = calcularResumo(params, cronograma);

    return {
      erro: false,
      resumo,
      cronograma
    };
  }

  /**
   * Valida os parâmetros de entrada.
   * @param {Object} params - Parâmetros
   * @returns {Object} { valido: boolean, mensagens: string[] }
   */
  function validarParametros(params) {
    const msgs = [];

    if (!params.valorCarta || params.valorCarta <= 0) {
      msgs.push('O valor da carta de crédito deve ser maior que zero.');
    }
    if (!params.prazoTotal || params.prazoTotal <= 0) {
      msgs.push('O prazo total deve ser maior que zero.');
    }
    if (params.taxaAdm < 0 || params.taxaAdm > 100) {
      msgs.push('A taxa de administração deve estar entre 0% e 100%.');
    }
    if (params.fundoReserva < 0 || params.fundoReserva > 100) {
      msgs.push('O fundo de reserva deve estar entre 0% e 100%.');
    }
    if (params.mesContemplacao < 1 || params.mesContemplacao > params.prazoTotal) {
      msgs.push(`O mês de contemplação deve estar entre 1 e ${params.prazoTotal}.`);
    }
    if (params.mesAniversario < 1 || params.mesAniversario > params.prazoTotal) {
      msgs.push('O mês aniversário do grupo deve ser válido.');
    }
    if (params.lanceProprio < 0 || params.lanceProprio > 100) {
      msgs.push('O percentual de lance próprio deve estar entre 0% e 100%.');
    }
    if (params.lanceEmbutido < 0 || params.lanceEmbutido > 100) {
      msgs.push('O percentual de lance embutido deve estar entre 0% e 100%.');
    }
    // Carta líquida não pode ficar negativa
    const cartaLiquida = params.valorCarta - (params.valorCarta * (params.lanceEmbutido / 100));
    if (cartaLiquida < 0) {
      msgs.push('A carta líquida não pode ficar negativa. Reduza o lance embutido.');
    }
    // Validar adiantamentos
    if (params.adiantamentos) {
      params.adiantamentos.forEach((a, i) => {
        if (a.mes < 1 || a.mes > params.prazoTotal) {
          msgs.push(`Adiantamento ${i + 1}: mês deve estar entre 1 e ${params.prazoTotal}.`);
        }
      });
    }
    // Validar inadimplências
    if (params.inadimplencias) {
      params.inadimplencias.forEach((ind, i) => {
        if (ind.mesInicio < 1 || ind.mesInicio > params.prazoTotal) {
          msgs.push(`Inadimplência ${i + 1}: mês de início inválido.`);
        }
        if (ind.regularizar && ind.mesRegularizacao <= ind.mesInicio + ind.mesesAtraso - 1) {
          msgs.push(`Inadimplência ${i + 1}: mês de regularização deve ser posterior ao período de atraso.`);
        }
      });
    }

    return { valido: msgs.length === 0, mensagens: msgs };
  }

  /**
   * Gera cenário comparativo (com e sem contemplação).
   * @param {Object} params - Parâmetros base
   * @returns {Object} Cenários comparativos
   */
  function compararCenarios(params) {
    // Cenário com contemplação (normal)
    const comContemp = simular(params);

    // Cenário sem contemplação (contemplação no último mês, sem lance)
    const paramsSem = {
      ...params,
      mesContemplacao: params.prazoTotal,
      lanceProprio: 0,
      lanceEmbutido: 0,
      lanceFixo: 0,
      usarFGTS: false,
      valorFGTS: 0
    };
    const semContemp = simular(paramsSem);

    // Cenário parcela cheia (sem redução)
    const paramsCheia = {
      ...params,
      parcelaReduzida: false,
      percentualReducao: 0
    };
    const parcelaCheia = simular(paramsCheia);

    return {
      comContemplacao: comContemp,
      semContemplacao: semContemp,
      parcelaCheia: parcelaCheia
    };
  }

  // ─── API Pública ───
  return {
    POLITICA,
    ADIANTAMENTO_TIPO,
    simular,
    calcularSaldoInicial,
    calcularLance,
    calcularCronograma,
    calcularResumo,
    validarParametros,
    compararCenarios,
    getIndiceReajuste
  };
})();
