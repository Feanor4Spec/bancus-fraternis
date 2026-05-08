(function () {
  'use strict';

  const PROFILE_KEY = 'bf_financial_profile_v1';

  function number(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function loadProfile() {
    try {
      return JSON.parse(localStorage.getItem(PROFILE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function enabled(input, key, fallback) {
    if (!Object.prototype.hasOwnProperty.call(input || {}, key)) return Boolean(fallback);
    const value = input[key];
    return value === true || value === 1 || value === '1' || value === 'on' || value === 'true' || value === 'yes';
  }

  function presentValue(payment, months, monthlyRatePct) {
    const pmt = number(payment);
    const i = number(monthlyRatePct) / 100;
    const m = Math.max(1, Math.round(number(months, 1)));
    if (i === 0) return pmt * m;
    return pmt * (1 - Math.pow(1 + i, -m)) / i;
  }

  function compare(items) {
    const summaries = items.map((item) => ({
      ...window.BFComparisonFormulas.summarize(item.label, item.result),
      id: item.id || item.label,
      href: item.href || '',
      note: item.note || '',
      meta: item.meta || {}
    }));
    const best = summaries.slice().sort((a, b) => {
      if (a.totalPago !== b.totalPago) return a.totalPago - b.totalPago;
      return b.score - a.score;
    })[0] || null;
    return { summaries, best };
  }

  function productByLabel(summaries, label) {
    return summaries.find((item) => item.label.toLowerCase().includes(label));
  }

  function productById(summaries, id) {
    return summaries.find((item) => item.id === id);
  }

  function lowestBy(summaries, key) {
    return summaries.slice().sort((a, b) => number(a[key]) - number(b[key]))[0] || null;
  }

  function buildItems(input, profile) {
    const valorCredito = number(input.valorCredito) || Math.max(0, number(input.valorBem) - number(input.entrada));
    const items = [];

    if (enabled(input, 'includeFinanciamento', true)) {
      items.push({
        id: 'financiamento',
        label: 'Financiamento',
        href: 'simulador-financiamento.html',
        note: 'Posse rapida com custo financeiro mensal.',
        result: window.BFFinanciamentoService.simulate(input)
      });
    }

    if (enabled(input, 'includeConsorcio', true)) {
      items.push({
        id: 'consorcio',
        label: 'Consorcio',
        href: 'simulador-consorcio.html',
        note: 'Planejamento com contemplacao simulada.',
        result: window.BFConsorcioService.simulate({
          carta: input.valorBem,
          prazo: input.prazo,
          taxaAdm: input.taxaAdm || 18,
          fundoReserva: input.fundoReserva || 2,
          lance: input.lance || 0,
          reajusteAnual: input.reajusteAnual || 0,
          mobContemplacao: input.mobContemplacao || Math.ceil((input.prazo || 1) / 2)
        })
      });
    }

    if (enabled(input, 'includeCdc', false) && window.BFCdcService) {
      items.push({
        id: 'cdc',
        label: 'CDC',
        href: 'simulador-cdc.html',
        note: 'Credito direto com custo total sensivel a taxa e tarifas.',
        result: window.BFCdcService.simulate({
          valor: valorCredito,
          tarifas: input.tarifasCdc || 0,
          taxaMes: input.taxaCdcMes || input.taxaMes || 2.2,
          prazo: input.prazoCredito || Math.min(input.prazo || 72, 84)
        })
      });
    }

    if (enabled(input, 'includeGarantia', false) && window.BFGarantiaService) {
      const garantia = number(input.valorGarantia) || Math.max(number(input.valorBem) * 2, valorCredito * 2);
      const result = window.BFGarantiaService.simulate({
        garantia,
        valor: valorCredito,
        ltv: input.ltvGarantia || 50,
        taxaMes: input.taxaGarantiaMes || 0.95,
        prazo: input.prazoGarantia || input.prazoCredito || 120
      });
      items.push({
        id: 'garantia',
        label: 'Credito com garantia',
        href: 'simulador-garantia.html',
        note: 'Taxa menor em troca de garantia real.',
        result,
        meta: { ltvUsado: result.ltvUsado, garantia }
      });
    }

    if (enabled(input, 'includeConsignado', false) && window.BFConsignadoService) {
      const result = window.BFConsignadoService.simulate({
        valor: valorCredito,
        renda: profile.rendaMensal || input.rendaMensal,
        margemPct: input.margemPct || 30,
        taxaMes: input.taxaConsignadoMes || 1.35,
        prazo: input.prazoConsignado || Math.min(input.prazoCredito || input.prazo || 72, 120)
      });
      items.push({
        id: 'consignado',
        label: 'Consignado',
        href: 'simulador-consignado.html',
        note: 'Credito com desconto em folha e elegibilidade por margem.',
        result,
        meta: { elegivel: result.elegivel, margemDisponivel: result.margemDisponivel }
      });
    }

    if (enabled(input, 'includeConsumo', false)) {
      items.push(...buildConsumptionItems(input, profile));
    }

    return items;
  }

  function buildConsumptionItems(input, profile) {
    const precoCheio = number(input.precoCheio) || number(input.valorBem);
    const descontoVista = number(input.descontoVista, 0);
    const precoVista = precoCheio * (1 - descontoVista / 100);
    const parcelas = Math.max(1, Math.round(number(input.parcelasConsumo, 12)));
    const valorParcela = number(input.valorParcela) || precoCheio / parcelas;
    const totalParcelado = valorParcela * parcelas;
    const vpParcelas = presentValue(valorParcela, parcelas, input.taxaOportunidadeMes || 1);
    const caixaAposVista = number(profile.reservaAtual) - precoVista;
    const rowsParcelado = Array.from({ length: parcelas }, (_, index) => ({
      mob: index + 1,
      parcela: valorParcela,
      juros: 0,
      amortizacao: valorParcela,
      saldo: Math.max(0, totalParcelado - valorParcela * (index + 1))
    }));

    return [
      {
        id: 'vista',
        label: 'Pagar a vista',
        href: 'calculadora-compra-vista-parcelado.html',
        note: 'Menor custo nominal, com impacto direto na reserva.',
        result: {
          tipo: 'Pagar a vista',
          totalPago: precoVista,
          primeiraParcela: precoVista,
          prazo: 1,
          rows: [{ mob: 1, parcela: precoVista, juros: 0, amortizacao: precoVista, saldo: 0 }]
        },
        meta: { precoVista, caixaAposVista, scope: 'consumo' }
      },
      {
        id: 'parcelado',
        label: 'Compra parcelada',
        href: 'calculadora-compra-vista-parcelado.html',
        note: 'Preserva caixa, mas pode custar mais no nominal.',
        result: {
          tipo: 'Compra parcelada',
          totalPago: totalParcelado,
          primeiraParcela: valorParcela,
          prazo: parcelas,
          rows: rowsParcelado
        },
        meta: { totalParcelado, vpParcelas, valorParcela, scope: 'consumo' }
      }
    ];
  }

  function buildProfile(input) {
    const saved = loadProfile();
    const rendaMensal = number(input.rendaMensal) || number(saved.rendaMensal);
    const gastoMensal = number(input.gastoMensal) || number(input.despesasMensais) || number(saved.gastoMensal);
    const dividasMensais = number(input.dividasMensais) || number(input.dividasAtuais) || number(saved.dividasMensais);
    const reservaAtual = number(input.reservaAtual) || number(saved.reservaAtual);
    const sobraMensal = Math.max(0, rendaMensal - gastoMensal - dividasMensais);
    const capacidadeAporte = number(saved.capacidadeAporte) || sobraMensal;
    const capacidadePagamento = number(saved.capacidadePagamento) || Math.max(0, Math.min(rendaMensal * 0.3 - dividasMensais, capacidadeAporte * 0.45 || rendaMensal * 0.3));
    const comprometimentoRenda = rendaMensal > 0 ? ((gastoMensal + dividasMensais) / rendaMensal) * 100 : number(saved.comprometimentoRenda);
    const reservaIdeal = gastoMensal > 0 ? gastoMensal * 6 : number(saved.reservaIdeal);
    const gapReserva = Math.max(0, reservaIdeal - reservaAtual);

    return {
      rendaMensal,
      gastoMensal,
      dividasMensais,
      reservaAtual,
      reservaIdeal,
      gapReserva,
      sobraMensal,
      capacidadeAporte,
      capacidadePagamento,
      comprometimentoRenda,
      urgencia: input.urgencia || saved.urgencia || 'media',
      prioridade: input.prioridade || 'menor_custo',
      risco: input.risco || saved.risco || 'moderado'
    };
  }

  function buildDecision(summaries, profile) {
    const creditPool = summaries.filter((item) => item.meta.scope !== 'consumo');
    const decisionPool = creditPool.length >= 2 ? creditPool : summaries;
    const bestByCost = lowestBy(decisionPool, 'totalPago');
    const bestByInstallment = lowestBy(decisionPool, 'primeiraParcela');
    const financing = productByLabel(summaries, 'financiamento');
    const consorcio = productByLabel(summaries, 'consorcio');
    const immediate = decisionPool.filter((item) => !['consorcio', 'vista'].includes(item.id));
    let selected = bestByCost;
    let title = 'Menor custo total';
    let reason = `${bestByCost ? bestByCost.label : 'A alternativa'} tem o menor total pago estimado no cenario informado.`;
    let tone = 'success';

    if (profile.prioridade === 'menor_parcela' && bestByInstallment) {
      selected = bestByInstallment;
      title = 'Menor parcela inicial';
      reason = `${selected.label} reduz a pressao da primeira parcela e ajuda a preservar o fluxo mensal.`;
    }

    if (profile.prioridade === 'liquidez' && bestByInstallment) {
      selected = bestByInstallment;
      title = 'Preservacao de caixa';
      reason = `${selected.label} aparece como caminho de menor impacto mensal inicial. Confirme se a reserva fica preservada apos entrada ou lance.`;
      tone = 'info';
    }

    if ((profile.prioridade === 'rapidez' || profile.urgencia === 'alta') && immediate.length > 0) {
      selected = lowestBy(immediate, 'totalPago') || financing;
      title = 'Disponibilidade mais rapida';
      reason = `${selected.label} foi priorizado porque a urgencia alta reduz a atratividade de alternativas sem disponibilidade imediata.`;
      tone = bestByCost && selected.label !== bestByCost.label ? 'warn' : 'info';
    }

    if (profile.urgencia !== 'alta' && bestByCost && consorcio && bestByCost.label === consorcio.label && profile.prioridade === 'menor_custo') {
      selected = consorcio;
      title = 'Planejamento com menor custo';
      reason = 'Com urgencia baixa ou media, o consorcio pode fazer sentido quando o usuario aceita esperar a contemplacao simulada.';
      tone = 'success';
    }

    return {
      label: selected ? selected.label : '-',
      summary: selected,
      title,
      reason,
      tone,
      bestByCost,
      bestByInstallment,
      decisionPoolIds: decisionPool.map((item) => item.id)
    };
  }

  function buildRisks(input, profile, decision, summaries) {
    const risks = [];
    const selected = decision.summary;
    const consorcio = productByLabel(summaries, 'consorcio');
    const financing = productByLabel(summaries, 'financiamento');
    const consignado = productById(summaries, 'consignado');
    const garantia = productById(summaries, 'garantia');
    const vista = productById(summaries, 'vista');

    if (profile.rendaMensal > 0 && selected) {
      const parcelaPct = (selected.primeiraParcela / profile.rendaMensal) * 100;
      if (profile.capacidadePagamento > 0 && selected.primeiraParcela > profile.capacidadePagamento) {
        risks.push({
          tone: 'warn',
          title: 'Parcela acima da capacidade segura',
          text: `${selected.label} tem primeira parcela acima da capacidade mensal estimada. Reduza prazo, valor ou entrada antes de assumir compromisso.`
        });
      } else if (parcelaPct > 0) {
        risks.push({
          tone: parcelaPct > 30 ? 'warn' : 'success',
          title: 'Comprometimento da renda',
          text: `${selected.label} compromete aproximadamente ${parcelaPct.toFixed(1)}% da renda mensal informada na primeira parcela.`
        });
      }
    }

    if (vista && vista.meta.caixaAposVista < profile.reservaIdeal) {
      risks.push({
        tone: 'warn',
        title: 'Pagamento a vista pressiona caixa',
        text: 'A coluna de pagamento a vista reduz a reserva abaixo da meta de seis meses. Use a calculadora de compra responsavel antes de decidir.'
      });
    }

    if (consignado && consignado.meta.elegivel === false) {
      risks.push({
        tone: 'warn',
        title: 'Consignado fora da margem',
        text: 'A parcela estimada do consignado supera a margem informada. Ajuste valor, prazo ou margem antes de considerar essa opcao.'
      });
    }

    if (garantia) {
      risks.push({
        tone: 'info',
        title: 'Garantia exige cautela',
        text: `Credito com garantia usa LTV estimado de ${number(garantia.meta.ltvUsado).toFixed(1)}%. Avalie risco de execucao, custos de formalizacao e liquidez do ativo.`
      });
    }

    if (profile.gapReserva > 0) {
      risks.push({
        tone: 'warn',
        title: 'Reserva ainda incompleta',
        text: `Faltam cerca de R$ ${Math.round(profile.gapReserva).toLocaleString('pt-BR')} para seis meses de custos. Evite consumir todo o caixa na entrada ou lance.`
      });
    }

    if (profile.urgencia === 'alta' && consorcio) {
      risks.push({
        tone: 'info',
        title: 'Consorcio nao garante data exata',
        text: `A contemplacao foi simulada na MOB ${number(input.mobContemplacao) || number(input.prazo) || consorcio.prazo}, mas assembleia e lance podem alterar a data real.`
      });
    }

    if (financing && number(input.taxaMes) >= 1.8) {
      risks.push({
        tone: 'warn',
        title: 'Custo de credito elevado',
        text: 'A taxa mensal informada exige comparacao com garantia, consignado, consorcio ou aumento de entrada.'
      });
    }

    risks.push({
      tone: 'info',
      title: 'Premissas educativas',
      text: 'Os valores usam premissas locais e nao representam oferta, aprovacao de credito ou recomendacao regulada.'
    });

    return risks.slice(0, 4);
  }

  function buildMetrics(summaries, profile, decision) {
    const bestByCost = decision.bestByCost || lowestBy(summaries, 'totalPago');
    const bestByInstallment = decision.bestByInstallment || lowestBy(summaries, 'primeiraParcela');
    const pool = Array.isArray(decision.decisionPoolIds) && decision.decisionPoolIds.length
      ? summaries.filter((item) => decision.decisionPoolIds.includes(item.id))
      : summaries;
    const totals = pool.map((item) => number(item.totalPago)).sort((a, b) => a - b);
    const economia = totals.length > 1 ? Math.max(0, totals[1] - totals[0]) : 0;
    return {
      vencedor: decision.label,
      menorCusto: bestByCost ? bestByCost.totalPago : 0,
      menorParcela: bestByInstallment ? bestByInstallment.primeiraParcela : 0,
      economia,
      capacidadePagamento: profile.capacidadePagamento,
      comprometimento: profile.comprometimentoRenda
    };
  }

  function buildNextActions(profile, decision) {
    const actions = [];
    if (profile.gapReserva > 0) actions.push({ label: 'Completar reserva', href: 'calculadora-reserva-emergencia.html' });
    if (decision.label.toLowerCase().includes('financiamento')) actions.push({ label: 'Simular financiamento detalhado', href: 'simulador-financiamento.html' });
    if (decision.label.toLowerCase().includes('consorcio')) actions.push({ label: 'Simular consorcio completo', href: 'simulador-consorcio.html' });
    if (decision.label.toLowerCase().includes('cdc')) actions.push({ label: 'Simular CDC detalhado', href: 'simulador-cdc.html' });
    if (decision.label.toLowerCase().includes('garantia')) actions.push({ label: 'Simular garantia', href: 'simulador-garantia.html' });
    if (decision.label.toLowerCase().includes('consignado')) actions.push({ label: 'Simular consignado', href: 'simulador-consignado.html' });
    if (decision.label.toLowerCase().includes('vista') || decision.label.toLowerCase().includes('parcelada')) actions.push({ label: 'Validar consumo responsavel', href: 'calculadora-compra-vista-parcelado.html' });
    actions.push({ label: 'Revisar custos fixos', href: 'calculadora-custos-fixos.html' });
    actions.push({ label: 'Abrir hub de calculadoras', href: 'calculadoras.html' });
    return actions.slice(0, 4);
  }

  function buildMemory(input, profile, decision, summaries) {
    const lines = [
      `Produtos comparados: ${(summaries || []).map((item) => item.label).join(', ')}.`,
      `Financiamento considera entrada de ${number(input.entrada).toLocaleString('pt-BR')} e taxa de ${number(input.taxaMes).toLocaleString('pt-BR')}% ao mes.`,
      `Consorcio considera taxa de administracao total de ${number(input.taxaAdm).toLocaleString('pt-BR')}%, fundo de reserva de ${number(input.fundoReserva).toLocaleString('pt-BR')}% e lance de ${number(input.lance).toLocaleString('pt-BR')}%.`,
      `Prioridade usada: ${profile.prioridade}; urgencia: ${profile.urgencia}; decisao: ${decision.label}.`
    ];
    if (input.presetObjetivo && input.presetObjetivo !== 'manual') {
      lines.unshift(`Preset aplicado: ${String(input.presetObjetivo).replace(/_/g, ' ')}.`);
    }
    return lines;
  }

  function compareDefault(input) {
    const profile = buildProfile(input);
    const items = buildItems(input, profile);
    const base = compare(items);
    const decision = buildDecision(base.summaries, profile);
    return {
      ...base,
      input: { ...input },
      rawResults: items.reduce((acc, item) => ({ ...acc, [item.id]: item.result }), {}),
      profile,
      decision,
      metrics: buildMetrics(base.summaries, profile, decision),
      risks: buildRisks(input, profile, decision, base.summaries),
      nextActions: buildNextActions(profile, decision),
      memory: buildMemory(input, profile, decision, base.summaries)
    };
  }

  window.BFComparadorService = { compare, compareDefault };
})();
