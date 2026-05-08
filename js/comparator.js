/**
 * ============================================
 * ConsórcioPro V2 - Motor de Comparação
 * ============================================
 * Compara dois grupos de consórcio lado a lado,
 * aplicando o mesmo cenário de simulação.
 * ============================================
 */

const Comparator = (() => {
  'use strict';

  // ─── Utilitários ───

  /**
   * Calcula a diferença percentual entre A e B.
   * Positivo = A é maior, Negativo = B é maior.
   * @param {number} a - Valor do Grupo A
   * @param {number} b - Valor do Grupo B
   * @returns {number} Delta percentual
   */
  function calcDeltaPct(a, b) {
    if (!b || b === 0) return 0;
    return ((a - b) / b) * 100;
  }

  /**
   * Compara uma métrica e retorna quem vence.
   * @param {number} a - Valor do Grupo A
   * @param {number} b - Valor do Grupo B
   * @param {"higher"|"lower"} prefer - Qual direção é melhor
   * @returns {"A"|"B"|"empate"}
   */
  function compareMetric(a, b, prefer) {
    if (a === b) return 'empate';
    if (prefer === 'lower') return a < b ? 'A' : 'B';
    return a > b ? 'A' : 'B';
  }

  /**
   * Normaliza os dados de um grupo + cenário para o formato
   * esperado pelo ConsorcioEngine.simular().
   * @param {Object} group - Dados do grupo
   * @param {Object} scenario - Cenário de simulação
   * @returns {Object} Parâmetros normalizados para o engine
   */
  function normalizeInputs(group, scenario) {
    const adiantamentos = [];
    if (scenario.adiantamentoMes && scenario.adiantamentoMes > 0 && scenario.adiantamentoValor > 0) {
      adiantamentos.push({
        mes: scenario.adiantamentoMes,
        valor: scenario.adiantamentoValor,
        qtdParcelas: 1,
        tipo: scenario.adiantamentoModo || 'reduzir_saldo'
      });
    }

    const inadimplencias = [];
    if (scenario.inadimplenciaMes && scenario.inadimplenciaMes > 0 && scenario.mesesAtraso > 0) {
      inadimplencias.push({
        mesInicio: scenario.inadimplenciaMes,
        mesesAtraso: scenario.mesesAtraso,
        regularizar: true,
        mesRegularizacao: scenario.inadimplenciaMes + scenario.mesesAtraso + 1
      });
    }

    // Limitar lance embutido ao máximo permitido pelo grupo
    const lanceEmbutidoEfetivo = Math.min(
      scenario.lanceEmbutidoPct || 0,
      group.lanceEmbutidoMaxPct || 100
    );

    // Aplicar parcela reduzida somente se o grupo permite
    const parcelaReduzida = scenario.parcelaReduzida && group.parcelaReduzidaDisponivel;
    const percentualReducao = parcelaReduzida
      ? Math.min(scenario.percentualReducao || 0, group.reducaoMaxParcelaPct || 0)
      : 0;

    return {
      // Dados da proposta (para contexto)
      nomeCliente: '',
      tipoBem: group.tipoBem || 'imovel',
      administradora: group.administradora || '',
      grupo: group.codigoGrupo || group.idGrupo || '',
      cota: '',
      dataSimulacao: new Date().toISOString().split('T')[0],
      consultor: '',
      observacoes: group.observacao || '',

      // Parâmetros financeiros (do grupo)
      valorCarta: group.valorCarta,
      prazoTotal: group.prazoMeses,
      taxaAdm: group.taxaAdmTotalPct,
      fundoReserva: group.fundoReservaPct,
      seguro: group.seguroPct || 0,
      seguroTipo: 'percentual',
      tipoIndice: (group.indiceReajuste || 'fixo').toLowerCase(),
      indiceReajuste: scenario.indiceReajustePct || 5,
      mesAdesao: 1,
      mesAniversario: group.mesAniversario || 12,
      mesContemplacao: scenario.mesContemplacao || 18,

      // Lance (do cenário, limitado pelo grupo)
      lanceProprio: scenario.lanceProprioPct || 0,
      lanceEmbutido: lanceEmbutidoEfetivo,
      lanceFixo: group.lanceFixoPct || 0,
      usarFGTS: scenario.usarFgts || false,
      valorFGTS: scenario.valorFgts || 0,
      modalidadeLance: 'combinado',

      // Parcela reduzida
      parcelaReduzida: parcelaReduzida,
      percentualReducao: percentualReducao,

      // Política
      politicaSaldo: scenario.saldoInicialMode === 'com_custos' ? 'carta_mais_custos' : 'carta',

      // Eventos
      adiantamentos: adiantamentos,
      inadimplencias: inadimplencias,
      multaAtraso: scenario.multaPct || 2,
      jurosAtraso: scenario.jurosPct || 1
    };
  }

  /**
   * Calcula os deltas percentuais entre dois resultados.
   * @param {Object} groupA - Dados do grupo A
   * @param {Object} groupB - Dados do grupo B
   * @param {Object} resumoA - Resumo da simulação A
   * @param {Object} resumoB - Resumo da simulação B
   * @returns {Object} Deltas percentuais
   */
  function buildDeltas(groupA, groupB, resumoA, resumoB) {
    const cronA = resumoA.cronograma || [];
    const cronB = resumoB.cronograma || [];
    const ultimaParcelaA = cronA.length > 0 ? cronA[cronA.length - 1].parcelaTotal : 0;
    const ultimaParcelaB = cronB.length > 0 ? cronB[cronB.length - 1].parcelaTotal : 0;

    return {
      valorCartaPct: calcDeltaPct(groupA.valorCarta, groupB.valorCarta),
      prazoPct: calcDeltaPct(groupA.prazoMeses, groupB.prazoMeses),
      taxaAdmPct: calcDeltaPct(groupA.taxaAdmTotalPct, groupB.taxaAdmTotalPct),
      fundoReservaPct: calcDeltaPct(groupA.fundoReservaPct, groupB.fundoReservaPct),
      totalPlanoPct: calcDeltaPct(resumoA.valorTotalPlano, resumoB.valorTotalPlano),
      totalPagoPct: calcDeltaPct(resumoA.totalPago, resumoB.totalPago),
      ateContemplacaoPct: calcDeltaPct(resumoA.totalPagoAteContemplacao, resumoB.totalPagoAteContemplacao),
      cartaLiquidaPct: calcDeltaPct(resumoA.cartaLiquida, resumoB.cartaLiquida),
      ultimaParcelaPct: calcDeltaPct(ultimaParcelaA, ultimaParcelaB),
      saldoInicialPct: calcDeltaPct(resumoA.saldoInicial, resumoB.saldoInicial),
      lanceTotalPct: calcDeltaPct(resumoA.lanceTotal, resumoB.lanceTotal),
      parcelaInicialPct: calcDeltaPct(resumoA.parcelaTotalAtual, resumoB.parcelaTotalAtual)
    };
  }

  /**
   * Define os vencedores por métrica.
   * @param {Object} groupA - Dados do grupo A
   * @param {Object} groupB - Dados do grupo B
   * @param {Object} resumoA - Resumo A
   * @param {Object} resumoB - Resumo B
   * @returns {Object} winnerFlags
   */
  function buildWinners(groupA, groupB, resumoA, resumoB) {
    return {
      menorTaxa: compareMetric(groupA.taxaAdmTotalPct, groupB.taxaAdmTotalPct, 'lower'),
      menorParcelaInicial: compareMetric(resumoA.parcelaTotalAtual, resumoB.parcelaTotalAtual, 'lower'),
      menorTotalPago: compareMetric(resumoA.totalPago, resumoB.totalPago, 'lower'),
      maiorCartaLiquida: compareMetric(resumoA.cartaLiquida, resumoB.cartaLiquida, 'higher'),
      maiorFlexibilidadeLance: compareMetric(groupA.lanceEmbutidoMaxPct, groupB.lanceEmbutidoMaxPct, 'higher'),
      menorCustoAteContemplacao: compareMetric(resumoA.totalPagoAteContemplacao, resumoB.totalPagoAteContemplacao, 'lower'),
      maiorCarta: compareMetric(groupA.valorCarta, groupB.valorCarta, 'higher'),
      menorPrazo: compareMetric(groupA.prazoMeses, groupB.prazoMeses, 'lower')
    };
  }

  /**
   * Gera texto de narrativa executiva automática.
   * @param {Object} groupA - Grupo A
   * @param {Object} groupB - Grupo B
   * @param {Object} resumoA - Resumo A
   * @param {Object} resumoB - Resumo B
   * @param {Object} winners - Flags de vencedor
   * @param {Object} deltas - Deltas percentuais
   * @returns {string} Texto HTML da narrativa
   */
  function buildNarrativa(groupA, groupB, resumoA, resumoB, winners, deltas) {
    const nomeA = groupA.plano || groupA.codigoGrupo || 'Grupo A';
    const nomeB = groupB.plano || groupB.codigoGrupo || 'Grupo B';
    const frases = [];

    // Carta
    if (winners.maiorCarta === 'A') {
      frases.push(`O <strong>${nomeA}</strong> oferece carta ${Math.abs(deltas.valorCartaPct).toFixed(1)}% maior que o ${nomeB}.`);
    } else if (winners.maiorCarta === 'B') {
      frases.push(`O <strong>${nomeB}</strong> oferece carta ${Math.abs(deltas.valorCartaPct).toFixed(1)}% maior que o ${nomeA}.`);
    }

    // Taxa
    if (winners.menorTaxa === 'A') {
      frases.push(`O <strong>${nomeA}</strong> possui taxa de administração mais competitiva (${groupA.taxaAdmTotalPct}% vs ${groupB.taxaAdmTotalPct}%).`);
    } else if (winners.menorTaxa === 'B') {
      frases.push(`O <strong>${nomeB}</strong> possui taxa de administração mais competitiva (${groupB.taxaAdmTotalPct}% vs ${groupA.taxaAdmTotalPct}%).`);
    }

    // Parcela inicial
    if (winners.menorParcelaInicial === 'A') {
      frases.push(`A parcela inicial do <strong>${nomeA}</strong> é mais leve, ideal para clientes sensíveis ao fluxo de caixa mensal.`);
    } else if (winners.menorParcelaInicial === 'B') {
      frases.push(`A parcela inicial do <strong>${nomeB}</strong> é mais leve, ideal para clientes sensíveis ao fluxo de caixa mensal.`);
    }

    // Total pago
    if (winners.menorTotalPago === 'A') {
      frases.push(`Considerando o plano completo, o <strong>${nomeA}</strong> resulta em menor desembolso total.`);
    } else if (winners.menorTotalPago === 'B') {
      frases.push(`Considerando o plano completo, o <strong>${nomeB}</strong> resulta em menor desembolso total.`);
    }

    // Carta líquida
    if (winners.maiorCartaLiquida === 'A') {
      frases.push(`O <strong>${nomeA}</strong> entrega maior poder de compra efetivo (carta líquida superior).`);
    } else if (winners.maiorCartaLiquida === 'B') {
      frases.push(`O <strong>${nomeB}</strong> entrega maior poder de compra efetivo (carta líquida superior).`);
    }

    // Flexibilidade de lance
    if (winners.maiorFlexibilidadeLance === 'A') {
      frases.push(`O <strong>${nomeA}</strong> oferece maior flexibilidade de lance embutido (até ${groupA.lanceEmbutidoMaxPct}%).`);
    } else if (winners.maiorFlexibilidadeLance === 'B') {
      frases.push(`O <strong>${nomeB}</strong> oferece maior flexibilidade de lance embutido (até ${groupB.lanceEmbutidoMaxPct}%).`);
    }

    // Até contemplação
    if (winners.menorCustoAteContemplacao === 'A') {
      frases.push(`Até a contemplação, o cliente desembolsa menos no <strong>${nomeA}</strong>.`);
    } else if (winners.menorCustoAteContemplacao === 'B') {
      frases.push(`Até a contemplação, o cliente desembolsa menos no <strong>${nomeB}</strong>.`);
    }

    if (frases.length === 0) {
      frases.push('Os dois grupos são equivalentes nas principais métricas.');
    }

    // V7: Enriquecimento com inteligência heurística
    if (typeof HeuristicEngine !== 'undefined') {
      const hA = groupA._heuristica || (groupA._group ? groupA._group._heuristica : null);
      const hB = groupB._heuristica || (groupB._group ? groupB._group._heuristica : null);
      if (hA && hB) {
        const cA = hA.classificacoes.classificacaoFinal;
        const cB = hB.classificacoes.classificacaoFinal;
        const pA = hA.papel;
        const pB = hB.papel;
        // Classificação
        if (cA.nivel !== cB.nivel) {
          const melhor = cA.nivel < cB.nivel ? nomeA : nomeB;
          const mClass = cA.nivel < cB.nivel ? cA : cB;
          frases.push(`<br><strong>🧠 Análise Heurística:</strong> O <strong>${melhor}</strong> possui classificação executiva superior (<span style="color:${mClass.cor};font-weight:700;">${mClass.icon} ${mClass.classe}</span>).`);
        } else {
          frases.push(`<br><strong>🧠 Análise Heurística:</strong> Ambos possuem classificação <span style="color:${cA.cor};font-weight:700;">${cA.icon} ${cA.classe}</span>.`);
        }
        // Papel
        if (pA.papel !== pB.papel) {
          frases.push(`O <strong>${nomeA}</strong> atua como ${pA.tag} <strong>${pA.papel}</strong>, enquanto o <strong>${nomeB}</strong> é ${pB.tag} <strong>${pB.papel}</strong>.`);
        }
        // Saúde
        const sA = hA.classificacoes.saude;
        const sB = hB.classificacoes.saude;
        if (sA.nivel !== sB.nivel) {
          const mSaude = sA.nivel < sB.nivel ? nomeA : nomeB;
          const mSaudeClass = sA.nivel < sB.nivel ? sA : sB;
          frases.push(`O <strong>${mSaude}</strong> apresenta melhor saúde da carteira (${mSaudeClass.icon} ${mSaudeClass.classe}).`);
        }
      }
    }

    return frases.join('<br>');
  }

  // ─── Dados para Gráficos ───

  /**
   * Prepara dados para gráfico de barras comparativas de KPIs.
   */
  function buildMainComparisonData(groupA, groupB, resumoA, resumoB) {
    return {
      labels: ['Carta de Crédito', 'Total do Plano', 'Total Pago', 'Até Contemplação'],
      dataA: [groupA.valorCarta, resumoA.valorTotalPlano, resumoA.totalPago, resumoA.totalPagoAteContemplacao],
      dataB: [groupB.valorCarta, resumoB.valorTotalPlano, resumoB.totalPago, resumoB.totalPagoAteContemplacao]
    };
  }

  /**
   * Prepara dados para gráfico de linha mensal comparativo.
   */
  function buildMonthlyComparisonData(cronogramaA, cronogramaB) {
    const maxLen = Math.max(cronogramaA.length, cronogramaB.length);
    const labels = [];
    const parcelasA = [];
    const parcelasB = [];
    const saldosA = [];
    const saldosB = [];

    for (let i = 0; i < maxLen; i++) {
      labels.push(`M${i + 1}`);
      parcelasA.push(cronogramaA[i] ? cronogramaA[i].parcelaTotal : null);
      parcelasB.push(cronogramaB[i] ? cronogramaB[i].parcelaTotal : null);
      saldosA.push(cronogramaA[i] ? cronogramaA[i].saldoFinal : null);
      saldosB.push(cronogramaB[i] ? cronogramaB[i].saldoFinal : null);
    }

    return { labels, parcelasA, parcelasB, saldosA, saldosB };
  }

  /**
   * Prepara dados para gráfico de composição empilhada.
   */
  function buildCompositionData(resumoA, resumoB) {
    return {
      labels: ['Grupo A', 'Grupo B'],
      carta: [resumoA.valorCarta, resumoB.valorCarta],
      taxaAdm: [resumoA.taxaAdmTotal, resumoB.taxaAdmTotal],
      fundoReserva: [resumoA.fundoReservaTotal, resumoB.fundoReservaTotal],
      seguro: [resumoA.seguroTotal, resumoB.seguroTotal]
    };
  }

  /**
   * Prepara dados para barra de total até contemplação.
   */
  function buildContemplationData(resumoA, resumoB) {
    return {
      labels: ['Grupo A', 'Grupo B'],
      data: [resumoA.totalPagoAteContemplacao, resumoB.totalPagoAteContemplacao]
    };
  }

  // ─── Função Principal ───

  /**
   * Executa a comparação completa entre dois grupos.
   * @param {Object} groupA - Dados do Grupo A
   * @param {Object} groupB - Dados do Grupo B
   * @param {Object} scenario - Cenário de simulação compartilhado
   * @returns {Object} Resultado da comparação
   */
  function compareGroups(groupA, groupB, scenario) {
    // 1. Normalizar inputs
    const paramsA = normalizeInputs(groupA, scenario);
    const paramsB = normalizeInputs(groupB, scenario);

    // 2. Simular cada grupo
    const simA = ConsorcioEngine.simular(paramsA);
    const simB = ConsorcioEngine.simular(paramsB);

    // Verificar erros
    if (simA.erro) {
      return { erro: true, grupo: 'A', mensagens: simA.mensagens };
    }
    if (simB.erro) {
      return { erro: true, grupo: 'B', mensagens: simB.mensagens };
    }

    const resumoA = simA.resumo;
    const resumoB = simB.resumo;
    const cronA = simA.cronograma;
    const cronB = simB.cronograma;

    // 3. Calcular deltas
    const deltas = buildDeltas(groupA, groupB, resumoA, resumoB);

    // 4. Definir vencedores
    const winners = buildWinners(groupA, groupB, resumoA, resumoB);

    // 5. Narrativa executiva
    const narrativa = buildNarrativa(groupA, groupB, resumoA, resumoB, winners, deltas);

    // 6. Dados dos gráficos
    const charts = {
      mainBars: buildMainComparisonData(groupA, groupB, resumoA, resumoB),
      monthly: buildMonthlyComparisonData(cronA, cronB),
      composition: buildCompositionData(resumoA, resumoB),
      contemplation: buildContemplationData(resumoA, resumoB)
    };

    return {
      erro: false,
      groupA: { group: groupA, simulation: simA, resumo: resumoA },
      groupB: { group: groupB, simulation: simB, resumo: resumoB },
      deltas,
      winners,
      narrativa,
      charts
    };
  }

  // ─── API Pública ───
  return {
    compareGroups,
    normalizeInputs,
    calcDeltaPct,
    compareMetric,
    buildDeltas,
    buildWinners,
    buildNarrativa,
    buildMainComparisonData,
    buildMonthlyComparisonData,
    buildCompositionData,
    buildContemplationData
  };
})();
