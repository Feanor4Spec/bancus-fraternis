/**
 * ============================================
 * ConsorcioPro V7 - Resumo da Proposta Estruturada
 * ============================================
 * Modulo IIFE responsavel por transformar a simulacao
 * financeira em uma proposta executiva explicada.
 *
 * Arquitetura de componentes:
 * - ProposalHeader: identidade, status e acoes
 * - KPISection: numeros estrategicos e complementares
 * - JourneyTimeline: historia da operacao do cliente
 * - FinancialComposition: composicao do plano
 * - ContributionOverview: parcelas e progresso
 * - BidStrategyPanel: lance e contemplacao
 * - ProjectionSection: visao futura
 * - PaymentSchedule: cronograma mensal detalhado
 * - NextStepsPanel: decisao e proximos passos
 * - ProposalDisclaimer: premissas e rastreabilidade
 * ============================================
 */

const ProposalSummary = (() => {
  'use strict';

  const chartInstances = {};

  function money(value) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function number(value, decimals = 0) {
    const n = Number(value) || 0;
    return n.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    });
  }

  function percent(value, decimals = 1) {
    const n = Number(value) || 0;
    return `${n.toLocaleString('pt-BR', {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals
    })}%`;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function domId(value) {
    return String(value || 'ps')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-zA-Z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .toLowerCase() || 'ps';
  }

  function assetPath(value) {
    const clean = String(value || '').replace(/^\/+/, '');
    const prefix = location.pathname.includes('/pages/') ? '../' : '';
    return `${prefix}${clean}`;
  }

  function chartId(data, key) {
    return data && data.chartIds && data.chartIds[key] ? data.chartIds[key] : `ps-${key}-chart`;
  }

  const proposalBuilderDefaults = {
    sections: {
      header: true,
      executive: true,
      decision: true,
      kpis: true,
      journey: true,
      project: true,
      productPhases: true,
      financialComposition: true,
      contributionOverview: true,
      bidStrategy: true,
      projection: true,
      schedule: true,
      concepts: true,
      formulas: true,
      nextSteps: true,
      acceptance: true,
      disclaimer: true
    },
    charts: {
      composition: true,
      installment: true,
      bid: true,
      debt: true,
      installmentProjection: true
    },
    concepts: {
      consorcio: true,
      cartaCredito: true,
      grupoCota: true,
      assembleia: true,
      lanceProprio: true,
      lanceEmbutido: true,
      contemplacao: true,
      fundoReserva: true,
      taxaAdministracao: true,
      saldoDevedor: true,
      reajuste: true,
      seguro: true
    },
    formulas: {
      parcelaTotal: true,
      parcelaBase: true,
      taxaAdministracao: true,
      fundoReserva: true,
      lanceTotal: true,
      cartaLiquida: true,
      saldoDevedor: true,
      percentualPago: true
    }
  };

  const conceptDefinitions = [
    { key: 'consorcio', title: 'Consórcio', body: 'Compra planejada em grupo. Os participantes pagam parcelas mensais e concorrem à contemplação conforme as regras da administradora.' },
    { key: 'cartaCredito', title: 'Carta de crédito', body: 'Valor contratado para comprar o bem ou serviço após a contemplação e a aprovação da administradora.' },
    { key: 'grupoCota', title: 'Grupo e cota', body: 'O grupo reúne os participantes e suas regras. A cota identifica a participação do cliente nesse grupo.' },
    { key: 'assembleia', title: 'Assembleia', body: 'Reunião periódica em que podem ocorrer contemplações por sorteio ou lance, conforme o contrato.' },
    { key: 'lanceProprio', title: 'Lance próprio', body: 'Valor oferecido com recursos do cliente para participar da disputa por lance. A oferta não garante contemplação.' },
    { key: 'lanceEmbutido', title: 'Lance embutido', body: 'Parte da carta usada no lance. Esse valor reduz o crédito disponível depois da contemplação.' },
    { key: 'contemplacao', title: 'Contemplação', body: 'Liberação do direito de usar o crédito, sujeita às regras cadastrais, contratuais e documentais.' },
    { key: 'fundoReserva', title: 'Fundo de reserva', body: 'Valor cobrado conforme o contrato para despesas e necessidades do grupo.' },
    { key: 'taxaAdministracao', title: 'Taxa de administração', body: 'Valor pago à administradora pela gestão do grupo, distribuído ao longo do prazo do plano.' },
    { key: 'saldoDevedor', title: 'Saldo devedor', body: 'Valor ainda devido, considerando pagamentos, lances, reajustes e demais eventos previstos.' },
    { key: 'reajuste', title: 'Reajuste', body: 'Atualização da carta, das parcelas ou do saldo conforme o índice e a periodicidade definidos no contrato.' },
    { key: 'seguro', title: 'Seguro', body: 'Cobertura que pode fazer parte do plano, conforme o produto, a administradora e as condições contratadas.' }
  ];

  function formulaDefinitions(data) {
    const compositionValue = (name) => {
      const item = data.charts && Array.isArray(data.charts.composition)
        ? data.charts.composition.find(entry => entry.name === name)
        : null;
      return item ? Number(item.value) || 0 : 0;
    };
    return [
      {
        key: 'parcelaTotal',
        title: 'Parcela total',
        expression: 'Parcela base + taxa adm. + fundo + seguro + eventos',
        example: `Parcela atual estimada: ${money(data.metrics.parcelaAtual)}`,
        body: 'Soma dos valores cobrados no mês, incluindo encargos e eventos previstos.'
      },
      {
        key: 'parcelaBase',
        title: 'Parcela base',
        expression: 'Carta de crédito / prazo total do grupo',
        example: `${money(data.metrics.creditoTotal)} dividido pelo prazo contratado`,
        body: 'Valor inicial antes de taxas, seguro, reajustes e outros eventos.'
      },
      {
        key: 'taxaAdministracao',
        title: 'Taxa de administração',
        expression: 'Carta de crédito x taxa de administração total',
        example: `Taxa projetada: ${money(compositionValue('Taxa de administração'))}`,
        body: 'Custo cobrado pela administradora durante o prazo do plano.'
      },
      {
        key: 'fundoReserva',
        title: 'Fundo de reserva',
        expression: 'Carta de crédito x percentual do fundo',
        example: `Fundo projetado: ${money(data.metrics.fundoReserva || compositionValue('Fundo de reserva'))}`,
        body: 'Valor adicional previsto nas condições do grupo.'
      },
      {
        key: 'lanceTotal',
        title: 'Lance total',
        expression: 'Lance próprio + lance embutido',
        example: `${money(data.lances.lanceProprio)} + ${money(data.lances.lanceEmbutido)} = ${money(data.lances.lanceTotal)}`,
        body: 'Soma do valor pago com recursos próprios e do valor retirado da carta. O lance não garante contemplação.'
      },
      {
        key: 'cartaLiquida',
        title: 'Crédito líquido',
        expression: 'Carta de crédito - lance embutido',
        example: `${money(data.metrics.creditoTotal)} - ${money(data.lances.lanceEmbutido)} = ${money(data.metrics.caixaLiquida)}`,
        body: 'Crédito estimado disponível após descontar o lance embutido.'
      },
      {
        key: 'saldoDevedor',
        title: 'Saldo devedor projetado',
        expression: 'Saldo anterior - amortizações - lances + reajustes e eventos',
        example: `Saldo final estimado: ${money(data.metrics.saldoDevedor)}`,
        body: 'Valor projetado após pagamentos, lances, reajustes e demais eventos.'
      },
      {
        key: 'percentualPago',
        title: 'Parcelas pagas',
        expression: 'Parcelas pagas / parcelas totais',
        example: `${number(data.contributions.parcelasPagas)} de ${number(data.contributions.parcelasTotais)} parcelas = ${percent(data.metrics.percentualPago)}`,
        body: 'Percentual de parcelas pagas em relação ao total previsto.'
      }
    ];
  }

  function mergeFlags(defaults, value) {
    const source = value && typeof value === 'object' ? value : {};
    return Object.keys(defaults).reduce((acc, key) => {
      acc[key] = source[key] === false ? false : true;
      return acc;
    }, {});
  }

  function normalizeProposalBuilder(value) {
    const source = value && typeof value === 'object' ? value : {};
    return {
      sections: mergeFlags(proposalBuilderDefaults.sections, source.sections),
      charts: mergeFlags(proposalBuilderDefaults.charts, source.charts),
      concepts: mergeFlags(proposalBuilderDefaults.concepts, source.concepts),
      formulas: mergeFlags(proposalBuilderDefaults.formulas, source.formulas)
    };
  }

  function isSectionEnabled(data, key) {
    const clientDocument = data && ['proposal', 'public', 'client'].includes(data.surface);
    if (clientDocument && key === 'acceptance') return false;
    return !data.builder || !data.builder.sections || data.builder.sections[key] !== false;
  }

  const PRESENTATION_STATUSES = new Set(['done', 'current', 'upcoming']);

  function presentationStatus(value, fallback = 'upcoming') {
    const normalized = String(value || '').trim().toLowerCase();
    return PRESENTATION_STATUSES.has(normalized) ? normalized : fallback;
  }

  function isChartEnabled(data, key) {
    return isSectionEnabled(data, chartSectionMap[key] || key)
      && (!data.builder || !data.builder.charts || data.builder.charts[key] !== false);
  }

  function isConceptEnabled(data, key) {
    return !data.builder || !data.builder.concepts || data.builder.concepts[key] !== false;
  }

  function isFormulaEnabled(data, key) {
    return !data.builder || !data.builder.formulas || data.builder.formulas[key] !== false;
  }

  function countEnabledFlags(group) {
    return Object.values(group || {}).filter(Boolean).length;
  }

  const chartSectionMap = {
    composition: 'financialComposition',
    installment: 'contributionOverview',
    bid: 'bidStrategy',
    debt: 'projection',
    installmentProjection: 'projection'
  };

  function renderDisabledChart(label) {
    return '';
  }

  function prepareRenderData(data, options = {}, target) {
    const prefix = domId(options.chartPrefix || (target && target.id) || 'proposal-summary');
    const remainingInstallments = Number(data && data.contributions && data.contributions.parcelasRestantes);
    const prepared = {
      ...data,
      metrics: {
        ...(data && data.metrics ? data.metrics : {}),
        ...(Number.isFinite(remainingInstallments) && remainingInstallments >= 0
          ? { prazoRestante: remainingInstallments }
          : {})
      },
      rootId: options.rootId || 'proposal-summary-print-root',
      surface: options.surface || 'summary',
      chartIds: {
        composition: `${prefix}-composition-chart`,
        installment: `${prefix}-installment-chart`,
        bid: `${prefix}-bid-chart`,
        debt: `${prefix}-debt-chart`,
        installmentProjection: `${prefix}-installment-projection-chart`
      }
    };
    prepared.builder = normalizeProposalBuilder(options.builder || options.proposalBuilder || data.builder);
    prepared.acceptance = normalizeAcceptance(options.acceptance || data.acceptance, prepared);
    return prepared;
  }

  function normalizeAcceptance(acceptance, data) {
    const now = new Date();
    const valid = new Date(now);
    valid.setDate(valid.getDate() + 7);
    const checklist = acceptance && acceptance.checklist ? acceptance.checklist : {};
    const status = acceptance && acceptance.status ? acceptance.status : 'pending';
    const labels = {
      reviewed: 'Revisada',
      partial: 'Revisão parcial',
      pending: 'Em revisão',
      expired: 'Revisão vencida'
    };

    return {
      status,
      statusLabel: labels[status] || (acceptance && acceptance.statusLabel) || labels.pending,
      proposalId: acceptance && acceptance.proposalId ? acceptance.proposalId : (data && data.id) || 'PROP-PENDENTE',
      reviewer: acceptance && acceptance.reviewer ? acceptance.reviewer : (data && data.consultor) || 'Consultor Bancus Fraternis',
      reviewerRole: acceptance && acceptance.reviewerRole ? acceptance.reviewerRole : 'Consultor responsável',
      validUntil: acceptance && acceptance.validUntil ? acceptance.validUntil : valid.toISOString().slice(0, 10),
      notes: acceptance && acceptance.notes ? acceptance.notes : 'Aguardando a conferência dos valores e das condições antes do envio.',
      version: acceptance && acceptance.version ? acceptance.version : 0,
      updatedAt: acceptance && acceptance.updatedAt ? acceptance.updatedAt : '',
      checklist: {
        premissas: !!checklist.premissas,
        cliente: !!checklist.cliente,
        documentacao: !!checklist.documentacao
      }
    };
  }

  function asNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function nonEmptyList(list, fallback) {
    const values = Array.isArray(list) ? list.filter(Boolean) : [];
    return values.length ? values : fallback;
  }

  function scenarioResumo(cenarios, key) {
    return cenarios && cenarios[key] && cenarios[key].resumo ? cenarios[key].resumo : null;
  }

  function buildResultDecision(input = {}) {
    const params = input.params || {};
    const metrics = input.metrics || {};
    const lances = input.lances || {};
    const projectItems = Array.isArray(input.projectItems) ? input.projectItems : [];
    const projectSummary = input.projectSummary || {};
    const context = input.decisionContext || {};
    const diagnostics = input.diagnostics || {};
    const prefill = context.prefill || {};
    const profile = context.profileSnapshot || {};
    const cenarios = input.cenarios || {};
    const creditoTotal = asNumber(metrics.creditoTotal);
    const caixaLiquida = asNumber(metrics.caixaLiquida || creditoTotal);
    const parcelaAtual = asNumber(metrics.parcelaAtual);
    const lanceTotal = asNumber(lances.lanceTotal);
    const lanceEmbutido = asNumber(lances.lanceEmbutido);
    const prazoTotal = asNumber(input.contributions && input.contributions.parcelasTotais, asNumber(params.prazoTotal));
    const taxaMedia = asNumber(projectSummary.taxaAdmMedia, asNumber(params.taxaAdm));
    const readiness = asNumber(context.readinessScore || (context.readiness && context.readiness.score));
    const capacidade = asNumber(prefill.capacidadePagamento || profile.capacidadePagamento || profile.capacidadeAporte);
    const renda = asNumber(profile.rendaMensal || profile.renda || profile.receitaMensal);
    const parcelaSobreCapacidade = capacidade > 0 && parcelaAtual > 0 ? (parcelaAtual / capacidade) * 100 : 0;
    const parcelaSobreRenda = renda > 0 && parcelaAtual > 0 ? (parcelaAtual / renda) * 100 : 0;
    const liquidezPct = creditoTotal > 0 ? (caixaLiquida / creditoTotal) * 100 : 0;
    const lanceEmbutidoPct = creditoTotal > 0 ? (lanceEmbutido / creditoTotal) * 100 : 0;
    const riscos = [];
    const premissas = [
      `Crédito simulado: ${money(creditoTotal)}. Crédito líquido estimado após o lance embutido: ${money(caixaLiquida)}.`,
      `Parcela inicial estimada: ${money(parcelaAtual)}. Prazo considerado: ${number(prazoTotal)} meses.`,
      `Lance total: ${money(lanceTotal)}, conforme os valores informados para lance próprio, embutido, FGTS ou lance fixo.`,
      `Taxa média informada: ${percent(taxaMedia)}. Fundo de reserva e seguro seguem as condições de cada grupo.`
    ];

    if (!projectItems.length) riscos.push('Nenhum grupo foi selecionado. Inclua pelo menos um grupo antes de enviar a proposta.');
    if (readiness < 70) riscos.push('O perfil financeiro está incompleto. Confirme renda, reserva e capacidade de pagamento antes do aceite.');
    if (diagnostics.reconciled !== true) riscos.push('Os valores do resumo e do cronograma ainda não conferem. Recalcule a simulação antes de enviar.');
    if (Array.isArray(diagnostics.errors) && diagnostics.errors.length) {
      const totalErros = diagnostics.errors.length;
      riscos.push(`Foram encontradas ${number(totalErros)} inconsistência${totalErros === 1 ? '' : 's'} nos cálculos. Corrija antes de gerar a proposta.`);
    }
    if (capacidade > 0 && parcelaSobreCapacidade > 100) riscos.push(`Parcela usa ${percent(parcelaSobreCapacidade)} da capacidade declarada. Ajuste carta, prazo ou lance.`);
    if (!capacidade && renda > 0 && parcelaSobreRenda > 30) riscos.push(`A parcela representa ${percent(parcelaSobreRenda)} da renda informada. Confirme a folga mensal com o cliente.`);
    if (lanceEmbutidoPct > 30) riscos.push(`O lance embutido corresponde a ${percent(lanceEmbutidoPct)} da carta e reduz o crédito disponível para a compra.`);
    if (liquidezPct > 0 && liquidezPct < 70) riscos.push(`O crédito líquido equivale a ${percent(liquidezPct)} da carta. Confirme se esse valor cobre o objetivo do cliente.`);
    if (prazoTotal >= 180) riscos.push('O prazo aumenta a exposição a reajustes. Confira os índices e as condições do grupo.');
    if (taxaMedia > 20) riscos.push(`A taxa média é de ${percent(taxaMedia)}. Compare com as demais opções disponíveis.`);

    const semContemplacao = scenarioResumo(cenarios, 'semContemplacao');
    const parcelaCheia = scenarioResumo(cenarios, 'parcelaCheia');
    const comparacao = [
      {
        label: 'Crédito líquido',
        atual: money(caixaLiquida),
        referencia: money(creditoTotal),
        leitura: liquidezPct > 0 ? `${percent(liquidezPct)} da carta permanece disponível para a compra.` : 'Informe o valor da carta para fazer a comparação.'
      },
      semContemplacao ? {
        label: 'Com lance e sem lance',
        atual: money(lanceTotal),
        referencia: money(asNumber(semContemplacao.lanceTotal)),
        leitura: 'O cenário com lance usa mais recursos agora. O cenário sem lance preserva o caixa, mas depende de sorteio ou de uma oferta futura.'
      } : null,
      parcelaCheia ? {
        label: 'Parcela reduzida',
        atual: money(parcelaAtual),
        referencia: money(asNumber(parcelaCheia.parcelaTotalAtual)),
        leitura: asNumber(parcelaCheia.parcelaTotalAtual) > parcelaAtual
          ? 'A parcela reduzida diminui o pagamento inicial por um período. Depois, o valor pode aumentar conforme o contrato.'
          : 'A parcela cheia mantém valor próximo ao compromisso inicial calculado.'
      } : null
    ].filter(Boolean);

    const status = riscos.some((item) => item.includes('capacidade') || item.includes('Nenhum grupo') || item.includes('crédito líquido') || item.includes('não conferem') || item.includes('inconsistência'))
      ? 'revisar'
      : riscos.length
        ? 'atencao'
        : 'pronto';
    const tone = status === 'pronto' ? 'stable' : status === 'atencao' ? 'warning' : 'critical';
    const headline = status === 'pronto'
      ? 'Pronta para revisão final'
      : status === 'atencao'
        ? 'Pode avançar com pontos de atenção'
        : 'Corrija os itens antes de enviar';
    const recommendation = status === 'pronto'
      ? 'Os valores principais foram calculados e conferidos. Revise as condições do grupo antes de enviar.'
      : status === 'atencao'
        ? 'Explique os pontos de atenção ao cliente antes de solicitar o aceite.'
        : 'Ajuste os itens marcados para evitar uma proposta incompleta ou inconsistente.';
    const reasons = [
      creditoTotal > 0 ? `Crédito simulado: ${money(creditoTotal)}. Crédito líquido: ${money(caixaLiquida)}.` : '',
      parcelaAtual > 0 ? `Parcela inicial estimada: ${money(parcelaAtual)}.` : '',
      projectItems.length ? `${number(projectItems.length)} grupo${projectItems.length !== 1 ? 's' : ''} selecionado${projectItems.length !== 1 ? 's' : ''}.` : '',
      lanceTotal > 0 ? `Lance total considerado no cronograma: ${money(lanceTotal)}.` : ''
    ];

    return {
      status,
      tone,
      headline,
      recommendation,
      actionLabel: status === 'revisar' ? 'Revisar simulação' : 'Comparar grupos',
      reasons: nonEmptyList(reasons, ['Calcule a simulação e selecione os grupos para continuar.']),
      risks: nonEmptyList(riscos, ['Nenhum alerta foi encontrado nos valores atuais. Confirme as condições com a administradora antes de enviar.']),
      premises: premissas,
      comparison: comparacao,
      metrics: {
        readiness,
        parcelaSobreCapacidade,
        parcelaSobreRenda,
        liquidezPct,
        lanceEmbutidoPct
      }
    };
  }

  function safeDate(value) {
    if (!value) return new Date();
    if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
      const [year, month, day] = value.split('-').map(Number);
      return new Date(year, month - 1, day);
    }
    const d = new Date(value);
    return Number.isNaN(d.getTime()) ? new Date() : d;
  }

  function formatDate(value) {
    return safeDate(value).toLocaleDateString('pt-BR');
  }

  function addMonths(date, months) {
    const d = safeDate(date);
    d.setMonth(d.getMonth() + (Number(months) || 0));
    return d;
  }

  function getLastCronEntry(cronograma) {
    return Array.isArray(cronograma) && cronograma.length ? cronograma[cronograma.length - 1] : null;
  }

  function sampleSeries(cronograma, field, maxPoints = 14) {
    if (!Array.isArray(cronograma) || cronograma.length === 0) return [];
    const step = Math.max(1, Math.ceil(cronograma.length / maxPoints));
    const sampled = cronograma.filter((_, i) => i % step === 0);
    const last = cronograma[cronograma.length - 1];
    if (sampled[sampled.length - 1] !== last) sampled.push(last);
    return sampled.map(m => ({ period: `M${m.mes}`, value: Number(m[field]) || 0 }));
  }

  function readNumber(row, keys, fallback = 0) {
    for (const key of keys) {
      if (row && row[key] != null && row[key] !== '') {
        const value = Number(row[key]);
        if (Number.isFinite(value)) return value;
      }
    }
    return fallback;
  }

  function normalizeSchedule(cronograma, startDate) {
    if (!Array.isArray(cronograma) || cronograma.length === 0) return [];
    return cronograma.map((row, index) => {
      const mes = readNumber(row, ['mes'], index + 1);
      const parcelaBase = readNumber(row, ['parcelaBase', 'parcelaReduzida', 'parcelaTotal']);
      const taxaAdm = readNumber(row, ['componenteTaxaAdm', 'taxaAdm']);
      const fundoReserva = readNumber(row, ['componenteFundoReserva', 'fundoReserva']);
      const seguro = readNumber(row, ['componenteSeguro', 'seguro']);
      const multa = readNumber(row, ['multa']);
      const juros = readNumber(row, ['juros']);
      const parcelaTotal = readNumber(
        row,
        ['parcelaTotal', 'parcelaTotalMes'],
        parcelaBase + taxaAdm + fundoReserva + seguro + multa + juros
      );

      return {
        mes,
        data: addMonths(startDate, mes - 1).toISOString(),
        saldoAnterior: readNumber(row, ['saldoAnterior', 'saldoInicial', 'saldoTotal']),
        saldoAjustado: readNumber(row, ['saldoAjustado', 'saldoTotal', 'saldoFinal']),
        parcelaBase,
        taxaAdm,
        fundoReserva,
        seguro,
        parcelaTotal,
        valorLance: readNumber(row, ['valorLance']),
        valorAdiantado: readNumber(row, ['valorAdiantado']),
        multa,
        juros,
        saldoFinal: readNumber(row, ['saldoFinal', 'saldoTotal', 'saldoDevedor']),
        prazoRestante: readNumber(row, ['prazoRestante']),
        evento: row && row.evento ? String(row.evento) : 'normal',
        observacao: row && row.observacao ? String(row.observacao) : ''
      };
    });
  }

  function eventTone(evento) {
    const normalized = String(evento || '').toLowerCase();
    if (normalized.includes('contempla')) return 'contemplacao';
    if (normalized.includes('adiant')) return 'adiantamento';
    if (normalized.includes('inadimpl')) return 'inadimplencia';
    if (normalized.includes('regulariza')) return 'regularizacao';
    if (normalized.includes('anivers')) return 'aniversario';
    if (normalized.includes('ades')) return 'adesao';
    return 'normal';
  }

  function getProjectDescriptor(project) {
    const items = project && Array.isArray(project.itens) ? project.itens : [];
    const first = items[0] || {};
    const admins = [...new Set(items.map(i => i.administradora).filter(Boolean))];
    const grupos = items.map(i => i.codigoGrupo).filter(Boolean);
    return {
      totalGrupos: items.length,
      totalCotas: items.reduce((s, i) => s + (Number(i.quantidadeCotas) || 0), 0),
      administradora: admins.length === 1 ? admins[0] : (admins.length ? `${admins.length} administradoras` : 'Administradora a definir'),
      grupo: grupos.length === 1 ? grupos[0] : (grupos.length ? `${grupos.length} grupos selecionados` : 'Grupo não informado'),
      segmento: first.nomeSegmento || 'Consórcio'
    };
  }

  function normalizeProjectItems(project) {
    const items = project && Array.isArray(project.itens) ? project.itens : [];
    return items.map((item, index) => {
      const group = item._group || {};
      const quantidadeCotas = Math.max(1, Number(item.quantidadeCotas) || 1);
      const valorCartaUnitario = Number(item.valorCartaUnitario ?? item.valorCartaRef ?? group.valorCartaRef) || 0;
      const valorCartaTotal = Number(item.valorCartaTotal) || (quantidadeCotas * valorCartaUnitario);
      const prazoMeses = Number(item.prazoMeses ?? group.prazoMeses) || 0;
      const taxaAdmPct = Number(item.taxaAdmPct ?? group.taxaAdmPct) || 0;
      const fundoReservaPct = Number(item.fundoReservaPct ?? group.fundoReservaPct) || 0;
      const lanceProprioPct = Number(item.lanceProprioPct) || 0;
      const lanceEmbutidoPct = Number(item.lanceEmbutidoPct) || 0;
      const indiceCorrecaoNome = String(item.indiceCorrecaoNome ?? group.indiceCorrecaoNome ?? 'fixo').trim().toLowerCase() || 'fixo';
      const indiceReajusteInformado = Number(item.indiceReajuste ?? group.indiceReajustePct ?? 0);
      const indiceReajuste = Number.isFinite(indiceReajusteInformado) ? indiceReajusteInformado : 0;
      const mesAniversarioInformado = Number(item.mesAniversario ?? group.mesAniversario ?? 12);
      const mesAniversario = Number.isFinite(mesAniversarioInformado)
        ? Math.max(1, Math.min(12, Math.trunc(mesAniversarioInformado)))
        : 12;
      const modalidadeLance = String(item.modalidadeLance ?? group.modalidadeLance ?? 'sem_lance').trim().toLowerCase() || 'sem_lance';
      const classificacao = item.classificacao || group._classificacao || null;
      const papel = item.papel || group._papel || null;

      return {
        index: index + 1,
        itemId: item.itemId || group.itemId || '',
        codigoGrupo: item.codigoGrupo || group.codigoGrupo || `Grupo ${index + 1}`,
        administradora: item.administradora || group.nomeAdministradora || group.administradora || 'Administradora a definir',
        segmento: item.nomeSegmento || group.nomeSegmento || 'Segmento a definir',
        quantidadeCotas,
        valorCartaUnitario,
        valorCartaTotal,
        prazoMeses,
        taxaAdmPct,
        fundoReservaPct,
        mesContemplacaoAlvo: Number(item.mesContemplacaoAlvo) || 0,
        lanceProprioPct,
        lanceEmbutidoPct,
        indiceCorrecaoNome,
        indiceReajuste,
        mesAniversario,
        modalidadeLance,
        classificacao: classificacao && (classificacao.final || classificacao.classe || classificacao.nota || classificacao),
        papel: papel && (papel.papel || papel.nome || papel)
      };
    });
  }

  function weightedAverage(items, valueKey, weightKey = 'valorCartaTotal') {
    const totalWeight = items.reduce((sum, item) => sum + (Number(item[weightKey]) || 0), 0);
    if (!totalWeight) return 0;
    return items.reduce((sum, item) => sum + ((Number(item[valueKey]) || 0) * (Number(item[weightKey]) || 0)), 0) / totalWeight;
  }

  function buildProductPhases({ adesao, proximaParcelaData, contemplData, mesContemplacao, parcelasRestantes }) {
    return [
      {
        title: 'Adesão ao grupo',
        status: 'done',
        date: formatDate(adesao),
        description: 'Entrada no grupo, definição da carta e aceite das condições do contrato.'
      },
      {
        title: 'Parcelas mensais',
        status: 'current',
        date: formatDate(proximaParcelaData),
        description: 'Pagamento da parcela, taxa de administração, fundo de reserva, seguro e demais valores previstos no plano.'
      },
      {
        title: 'Assembleias e lances',
        status: 'current',
        date: `Até o mês ${mesContemplacao}`,
        description: 'Participação nas assembleias e oferta de lance conforme as regras do grupo.'
      },
      {
        title: 'Contemplação no cenário',
        status: 'upcoming',
        date: formatDate(contemplData),
        description: 'Data usada apenas no cálculo deste cenário. A contemplação não é garantida.'
      },
      {
        title: 'Análise e documentos',
        status: 'upcoming',
        date: 'Após a contemplação',
        description: 'Análise cadastral e de crédito, garantias e documentos do bem ou serviço.'
      },
      {
        title: 'Uso do crédito e encerramento',
        status: 'upcoming',
        date: `${number(parcelasRestantes)} parcelas restantes`,
        description: 'Compra do bem ou serviço, pagamento das parcelas restantes e quitação do plano.'
      }
    ];
  }

  /**
   * Contrato principal esperado pela tela.
   * @typedef {Object} ProposalStructuredSummary
   * @property {string} id
   * @property {string} status
   * @property {string} title
   * @property {string} subtitle
   * @property {string} grupo
   * @property {string} cota
   * @property {string=} cliente
   * @property {Object} metrics
   * @property {Object} contributions
 * @property {Object} lances
 * @property {Array<Object>} journey
 * @property {Array<Object>} projectItems
 * @property {Array<Object>} productPhases
 * @property {Object} charts
 * @property {Array<Object>} schedule
 * @property {Array<Object>} nextSteps
 * @property {Array<string>} disclaimers
   */

  function mapSimulationToProposal({ params, resultado, project, cenarios, decisionContext }) {
    const resumo = resultado && resultado.resumo ? resultado.resumo : {};
    const cronograma = resultado && Array.isArray(resultado.cronograma) ? resultado.cronograma : [];
    const descriptor = getProjectDescriptor(project);
    const projectItems = normalizeProjectItems(project);
    const adesao = safeDate(params && params.dataSimulacao);
    const mesContemplacao = Math.max(1, Number(params && params.mesContemplacao) || 18);
    const parcelasTotais = Number(resumo.prazoTotal) || Number(params && params.prazoTotal) || cronograma.length || 1;
    const parcelasPagasInformadas = Number(params && params.parcelasPagas);
    const parcelasPagas = Number.isFinite(parcelasPagasInformadas)
      ? Math.max(0, Math.min(parcelasTotais, Math.trunc(parcelasPagasInformadas)))
      : 0;
    const parcelasRestantes = Math.max(0, parcelasTotais - parcelasPagas);
    const saldoFinal = getLastCronEntry(cronograma);
    const saldoDevedor = saldoFinal ? Number(saldoFinal.saldoFinal) || 0 : Number(resumo.saldoInicial) || 0;
    const percentualPago = parcelasTotais > 0 ? (parcelasPagas / parcelasTotais) * 100 : 0;
    const proximaParcelaData = addMonths(adesao, parcelasPagas);
    const contemplData = addMonths(adesao, Math.max(0, mesContemplacao - 1));
    const proximaLinha = cronograma[Math.min(parcelasPagas, Math.max(0, cronograma.length - 1))] || null;
    const totalPlano = Number(resumo.valorTotalPlano) || 0;
    const creditoTotal = Number(resumo.valorCarta) || 0;
    const custoTotal = Number(resumo.custoTotal) || 0;
    const ganhoTotal = Math.max(0, creditoTotal - custoTotal);
    const proposalSeq = Math.max(1, Math.round(creditoTotal / 1000)) % 10000;
    const projectSummary = {
      totalGrupos: descriptor.totalGrupos || projectItems.length,
      totalCotas: descriptor.totalCotas || projectItems.reduce((sum, item) => sum + item.quantidadeCotas, 0),
      valorCartaTotal: projectItems.reduce((sum, item) => sum + item.valorCartaTotal, 0) || creditoTotal,
      prazoMedio: weightedAverage(projectItems, 'prazoMeses') || parcelasTotais,
      taxaAdmMedia: weightedAverage(projectItems, 'taxaAdmPct'),
      fundoReservaMedio: weightedAverage(projectItems, 'fundoReservaPct')
    };
    const metrics = {
      creditoTotal,
      totalPlano,
      ganhoTotal,
      fundoReserva: Number(resumo.fundoReservaTotal) || 0,
      seguroTotal: Number(resumo.seguroTotal) || 0,
      prazoRestante: parcelasRestantes,
      parcelaAtual: Number(resumo.parcelaTotalAtual) || 0,
      totalPago: Number(resumo.totalPago) || 0,
      caixaLiquida: Number(resumo.cartaLiquida) || creditoTotal,
      saldoDevedor,
      percentualPago
    };
    const nextInstallment = proximaLinha && Number.isFinite(Number(proximaLinha.parcelaTotal))
      ? Number(proximaLinha.parcelaTotal)
      : Number(resumo.parcelaTotalAtual) || 0;
    const contributions = {
      parcelasPagas,
      parcelasTotais,
      parcelasRestantes,
      proximaParcelaValor: nextInstallment,
      proximaParcelaData: proximaParcelaData.toISOString(),
      totalContribuido: Number(resumo.totalPagoAteContemplacao) || 0
    };
    const lances = {
      lanceProprio: Number(resumo.lanceProprio) || 0,
      lanceEmbutido: Number(resumo.lanceEmbutido) || 0,
      lanceTotal: Number(resumo.lanceTotal) || 0,
      impactoCreditoLiquido: Number(resumo.lanceEmbutido) || 0,
      impactoSaldoDevedor: Math.max(0, (Number(resumo.saldoInicial) || 0) - (Number(resumo.lanceTotal) || 0)),
      estrategiaResumo: `Lance próprio de ${money(Number(resumo.lanceProprio) || 0)} e lance embutido de ${money(Number(resumo.lanceEmbutido) || 0)}. O lance embutido reduz o crédito disponível no mesmo valor.`
    };
    const decision = buildResultDecision({
      params,
      resumo,
      cronograma,
      projectItems,
      projectSummary,
      metrics,
      contributions,
      lances,
      cenarios,
      decisionContext,
      diagnostics: resultado && resultado.diagnostics
    });

    const proposal = {
      id: `PROP-${adesao.getFullYear()}-${String(proposalSeq).padStart(4, '0')}`,
      status: resultado && resultado.diagnostics && resultado.diagnostics.reconciled === true ? 'Validada' : 'Rascunho',
      title: 'Proposta de consórcio',
      subtitle: 'Valores, prazos, parcelas, lances, custos e riscos calculados com os dados informados.',
      grupo: descriptor.grupo,
      cota: descriptor.totalCotas
        ? `${descriptor.totalCotas} ${descriptor.totalCotas === 1 ? 'cota' : 'cotas'}`
        : (params && params.cota) || 'Cota não informada',
      cliente: (params && params.nomeCliente) || 'Cliente não informado',
      consultor: (params && params.consultor) || 'Consultor Bancus Fraternis',
      administradora: descriptor.administradora,
      segmento: descriptor.segmento,
      generatedAt: new Date(),
      projectSummary,
      projectItems,
      productPhases: buildProductPhases({ adesao, proximaParcelaData, contemplData, mesContemplacao, parcelasRestantes }),
      metrics,
      contributions,
      lances,
      decision,
      journey: [
        { id: 'adesao', label: 'Adesão', status: 'done', date: formatDate(adesao), value: money(creditoTotal), description: 'Data de início e valor total das cartas.' },
        { id: 'grupo', label: 'Grupos selecionados', status: 'done', value: descriptor.grupo, description: `${descriptor.administradora} | ${descriptor.segmento}` },
        { id: 'parcelas', label: 'Parcelas', status: parcelasPagas > 0 ? 'done' : 'current', value: `${parcelasPagas}/${parcelasTotais}`, description: 'Parcelas pagas e parcelas restantes.' },
        { id: 'assembleia', label: 'Assembleias', status: 'current', date: formatDate(proximaParcelaData), value: money(resumo.parcelaTotalAtual), description: 'Data e valor estimados da próxima parcela.' },
        { id: 'lance', label: 'Lances', status: (Number(resumo.lanceTotal) || 0) > 0 ? 'current' : 'upcoming', value: money(resumo.lanceTotal), description: 'Soma dos lances próprio e embutido.' },
        { id: 'contemplacao', label: 'Contemplação no cenário', status: 'upcoming', date: formatDate(contemplData), value: `Mês ${mesContemplacao}`, description: 'Data usada no cálculo. A contemplação não é garantida.' },
        { id: 'credito', label: 'Crédito líquido', status: 'upcoming', value: money(resumo.cartaLiquida || creditoTotal), description: 'Valor estimado após descontar o lance embutido.' },
        { id: 'quitacao', label: 'Encerramento', status: 'upcoming', value: `${parcelasRestantes} restantes`, description: 'Pagamento das parcelas restantes e quitação do plano.' }
      ],
      charts: {
        composition: [
          { name: 'Carta de crédito', value: creditoTotal },
          { name: 'Taxa de administração', value: Number(resumo.taxaAdmTotal) || 0 },
          { name: 'Fundo de reserva', value: Number(resumo.fundoReservaTotal) || 0 },
          { name: 'Seguro', value: Number(resumo.seguroTotal) || 0 }
        ],
        debtProjection: sampleSeries(cronograma, 'saldoFinal'),
        installmentProjection: sampleSeries(cronograma, 'parcelaTotal'),
        bidComparison: [
          { name: 'Lance total', value: Number(resumo.lanceTotal) || 0 },
          { name: 'Crédito líquido', value: Number(resumo.cartaLiquida) || 0 },
          { name: 'Saldo após lance', value: Math.max(0, (Number(resumo.saldoInicial) || 0) - (Number(resumo.lanceTotal) || 0)) }
        ]
      },
      schedule: normalizeSchedule(cronograma, adesao),
      nextSteps: [
        { title: 'Conferir valores e condições', description: 'Confirmar carta, prazo, taxa, fundo de reserva, seguro e limites de lance.', date: formatDate(new Date()) },
        { title: 'Definir os recursos do lance', description: 'Confirmar quanto será pago com recursos próprios e quanto será descontado da carta.' },
        { title: 'Acompanhar as assembleias', description: 'Verificar as datas e os resultados divulgados pela administradora.', date: formatDate(proximaParcelaData) },
        { title: 'Separar os documentos', description: 'Preparar cadastro, comprovantes e documentos exigidos para a análise e o uso do crédito.' }
      ],
      disclaimers: [
        'Os valores são estimativas calculadas com os dados informados e dependem das regras da administradora.',
        'Parcelas, saldo devedor e custo total podem mudar por reajustes, assembleias, lances e outras condições contratuais.',
        'Esta é uma simulação. A contemplação não é garantida e a contratação depende da análise da administradora e do contrato.'
      ]
    };

    return proposal;
  }

  function createMockData() {
    return mapSimulationToProposal({
      params: {
        nomeCliente: 'Andre Dias',
        consultor: 'Equipe Bancus Fraternis',
        dataSimulacao: '2026-04-24',
        mesContemplacao: 18,
        prazoTotal: 198
      },
      resultado: {
        resumo: {
          valorCarta: 3651261.12,
          valorTotalPlano: 4235462.90,
          taxaAdmTotal: 511176.56,
          fundoReservaTotal: 73025.22,
          seguroTotal: 0,
          saldoInicial: 3651261.12,
          parcelaTotalAtual: 23177.31,
          parcelaBase: 18256.31,
          lanceProprio: 730252.22,
          lanceEmbutido: 1095378.34,
          lanceTotal: 1825630.56,
          cartaLiquida: 2555882.78,
          prazoTotal: 198,
          prazoRestante: 198,
          custoTotal: 511176.56,
          totalPagoAteContemplacao: 417191.58,
          totalPago: 3336340.37
        },
        cronograma: Array.from({ length: 198 }, (_, i) => ({
          mes: i + 1,
          parcelaTotal: 18000 + i * 92,
          saldoFinal: Math.max(0, 3651261.12 - i * 16500)
        }))
      },
      project: { itens: [{ administradora: 'Exemplo Consórcios', codigoGrupo: 'Automóveis Premium', quantidadeCotas: 1, nomeSegmento: 'Automóveis' }] }
    });
  }

  function renderHeader(data) {
    return `
      <header class="ps-header ps-print-page">
        <div class="ps-header__main">
          <img src="${assetPath('assets/logos/logo-bank-fratern-icon.svg')}" alt="Bancus Fraternis" class="ps-mark">
          <div>
            <div class="ps-eyebrow">Proposta ${escapeHTML(data.id)}</div>
            <h2>${escapeHTML(data.title)}</h2>
            <p>${escapeHTML(data.subtitle)}</p>
          </div>
        </div>
        <div class="ps-header__side">
          <div class="ps-meta">
            <span>Cliente</span><strong>${escapeHTML(data.cliente)}</strong>
            <span>Grupo / Cota</span><strong>${escapeHTML(data.grupo)} | ${escapeHTML(data.cota)}</strong>
          </div>
        </div>
      </header>
    `;
  }

  function renderExecutiveConversation(data) {
    const cards = [
      {
        tag: 'Crédito',
        title: 'Valor total das cartas',
        metric: money(data.metrics.creditoTotal),
        body: 'Soma das cartas dos grupos selecionados.',
        detail: `Grupos: ${number(data.projectSummary?.totalGrupos || data.projectItems?.length || 0)}. Cotas: ${number(data.projectSummary?.totalCotas || 0)}.`
      },
      {
        tag: 'Parcela',
        title: 'Parcela inicial estimada',
        metric: money(data.metrics.parcelaAtual),
        body: 'Valor calculado para o início do plano.',
        detail: `Prazo considerado: ${number(data.contributions.parcelasTotais)} meses.`
      },
      {
        tag: 'Lance',
        title: 'Lance configurado',
        metric: money(data.lances.lanceTotal),
        body: 'Soma dos lances próprio e embutido.',
        detail: `O lance embutido reduz o crédito em ${money(data.lances.lanceEmbutido)}.`
      },
      {
        tag: 'Prazo',
        title: 'Parcelas restantes',
        metric: `${number(data.contributions.parcelasRestantes)} parcelas`,
        body: 'Quantidade calculada para o cenário atual.',
        detail: 'A contemplação não é garantida.'
      }
    ];
    return `
      <section class="ps-section ps-section--conversation ps-print-page">
        <div class="ps-section__head">
          <span>RESUMO</span>
          <div><h3>Principais valores</h3><p>Confira os valores considerados nesta simulação.</p></div>
        </div>
        <div class="ps-conversation-grid">
          ${cards.map(card => `
            <article class="ps-conversation-card">
              <span>${escapeHTML(card.tag)}</span>
              <strong>${escapeHTML(card.title)}</strong>
              <em>${escapeHTML(card.metric)}</em>
              <p>${escapeHTML(card.body)}</p>
              <small>${escapeHTML(card.detail)}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderResultDecision(data) {
    const decision = data.decision || buildResultDecision(data);
    const clientDocument = ['proposal', 'public', 'client'].includes(data.surface);
    const risks = (Array.isArray(decision.risks) ? decision.risks : []).map((item) => (
      clientDocument
        ? String(item).replace(/antes de enviar/gi, 'antes de contratar')
        : item
    ));
    const premises = Array.isArray(decision.premises) ? decision.premises : [];
    const comparisons = Array.isArray(decision.comparison) ? decision.comparison : [];
    const statusLabels = { pronto: 'Pronta', atencao: 'Atenção', revisar: 'Revisar' };
    const clientStatus = {
      pronto: {
        label: 'Cenário calculado',
        headline: 'Condições calculadas para este cenário',
        recommendation: 'Os valores refletem os grupos e as premissas apresentados nesta proposta.'
      },
      atencao: {
        label: 'Pontos de atenção',
        headline: 'Este cenário tem pontos que merecem atenção',
        recommendation: 'Leia os itens destacados e confirme as condições com a administradora.'
      },
      revisar: {
        label: 'Confirmação necessária',
        headline: 'Este cenário exige confirmação',
        recommendation: 'Há informações que precisam ser confirmadas antes de qualquer contratação.'
      }
    }[decision.status] || {
      label: 'Condições da proposta',
      headline: 'Confira as condições deste cenário',
      recommendation: 'Confirme os valores e as regras com a administradora antes de contratar.'
    };
    const sectionLabel = clientDocument ? 'CONDIÇÕES' : 'REVISÃO';
    const sectionTitle = clientDocument ? 'Pontos de atenção da proposta' : 'Antes de enviar';
    const sectionDescription = clientDocument
      ? 'Veja as premissas, os riscos e a comparação dos valores considerados.'
      : 'Confira os valores, as condições e os pontos de atenção desta simulação.';
    const statusLabel = clientDocument ? clientStatus.label : (statusLabels[decision.status] || decision.status);
    const headline = clientDocument ? clientStatus.headline : decision.headline;
    const recommendation = clientDocument ? clientStatus.recommendation : decision.recommendation;
    return `
      <section class="ps-section ps-section--decision ps-section--decision-${escapeHTML(decision.tone)} ps-print-page" data-simulator-result-decision data-simulator-result-tone="${escapeHTML(decision.tone)}">
        <div class="ps-section__head">
          <span>${escapeHTML(sectionLabel)}</span>
          <div><h3>${escapeHTML(sectionTitle)}</h3><p>${escapeHTML(sectionDescription)}</p></div>
        </div>
        <div class="ps-decision-grid">
          <article class="ps-decision-hero">
            <span>${escapeHTML(statusLabel)}</span>
            <h3>${escapeHTML(headline)}</h3>
            <p>${escapeHTML(recommendation)}</p>
            <div class="ps-decision-facts">
              ${(decision.reasons || []).slice(0, 4).map((item) => `<small>${escapeHTML(item)}</small>`).join('')}
            </div>
            ${clientDocument ? '' : `<button class="btn btn--primary ps-no-print" type="button" data-simulator-result-cta onclick="window.App && App.goToStep ? App.goToStep(9, { skipValidation: true, skipAutoCalculate: true }) : window.location.hash = 'step-9'">${escapeHTML(decision.actionLabel)}</button>`}
          </article>
          <div class="ps-decision-panels">
            <article class="ps-decision-panel" data-simulator-result-premise>
              <strong>Dados considerados</strong>
              <ul>${premises.slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            </article>
            <article class="ps-decision-panel ps-decision-panel--risk" data-simulator-result-risk>
              <strong>Pontos de atenção</strong>
              <ul>${risks.slice(0, 5).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            </article>
          </div>
        </div>
        <div class="ps-decision-comparison" data-simulator-result-comparison>
          ${comparisons.map((item) => `
            <article>
              <span>${escapeHTML(item.label)}</span>
              <strong>${escapeHTML(item.atual)}</strong>
              <small>Comparação: ${escapeHTML(item.referencia)}</small>
              <p>${escapeHTML(item.leitura)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function kpiCard(kpi, level = 'secondary') {
    return `
      <article class="ps-kpi ps-kpi--${level}">
        <span class="ps-kpi__label">${escapeHTML(kpi.label)}</span>
        <strong>${escapeHTML(kpi.value)}</strong>
        <small>${escapeHTML(kpi.help)}</small>
      </article>
    `;
  }

  function renderKPISection(data) {
    const primary = [
      { label: 'Crédito total', value: money(data.metrics.creditoTotal), help: 'Soma das cartas selecionadas.' },
      { label: 'Crédito líquido', value: money(data.metrics.caixaLiquida), help: 'Valor estimado após o lance embutido.' },
      { label: 'Parcela inicial', value: money(data.metrics.parcelaAtual), help: 'Valor estimado para o início do plano.' },
      { label: 'Parcelas restantes', value: `${number(data.contributions.parcelasRestantes)} parcelas`, help: 'Quantidade de parcelas ainda previstas no cronograma.' }
    ];
    const secondary = [
      { label: 'Total do plano', value: money(data.metrics.totalPlano), help: 'Carta, taxas, fundo e seguro.' },
      { label: 'Total projetado', value: money(data.metrics.totalPago), help: 'Soma dos pagamentos até o fim do plano.' },
      { label: 'Saldo devedor final', value: money(data.metrics.saldoDevedor), help: 'Saldo calculado ao final do cronograma.' },
      { label: 'Parcelas pagas', value: percent(data.metrics.percentualPago), help: 'Percentual informado como pago.' }
    ];
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>01</span>
          <div><h3>Valores da simulação</h3><p>Crédito, parcela, prazo e custo total.</p></div>
        </div>
        <div class="ps-kpi-grid ps-kpi-grid--primary">${primary.map(k => kpiCard(k, 'primary')).join('')}</div>
        <div class="ps-kpi-grid">${secondary.map(k => kpiCard(k)).join('')}</div>
      </section>
    `;
  }

  function renderJourney(data) {
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>02</span>
          <div><h3>Etapas do consórcio</h3><p>Da adesão ao encerramento do plano.</p></div>
        </div>
        <div class="ps-journey">
          ${data.journey.map((step, idx) => `
            <article class="ps-journey-step ps-journey-step--${presentationStatus(step.status)}">
              <div class="ps-journey-step__index">${idx + 1}</div>
              <strong>${escapeHTML(step.label)}</strong>
              <span>${escapeHTML(step.value || step.date || '')}</span>
              <p>${escapeHTML(step.description || '')}</p>
            </article>
          `).join('')}
        </div>
        <aside class="ps-insight">
          <strong>Importante</strong>
          <p>A contemplação pode ocorrer por sorteio ou lance e não é garantida na data usada nesta simulação.</p>
        </aside>
      </section>
    `;
  }

  function compactPercent(value) {
    const n = Number(value) || 0;
    const decimals = Number.isInteger(n) ? 0 : (Number.isInteger(n * 10) ? 1 : 2);
    return percent(n, decimals);
  }

  function projectIndexLabel(value) {
    const normalized = String(value || 'fixo').trim().toLowerCase();
    const labels = {
      fixo: 'Fixo',
      ipca: 'IPCA',
      incc: 'INCC',
      igpm: 'IGP-M',
      'igp-m': 'IGP-M'
    };
    return labels[normalized] || normalized.toLocaleUpperCase('pt-BR');
  }

  function projectBidModeLabel(value) {
    const normalized = String(value || 'sem_lance').trim().toLowerCase();
    const labels = {
      sem_lance: 'Sem lance',
      livre: 'Próprio',
      proprio: 'Próprio',
      embutido: 'Embutido',
      fixo: 'Fixo',
      fgts: 'FGTS',
      combinado: 'Combinado'
    };
    return labels[normalized] || 'Modalidade a confirmar';
  }

  function projectAdjustmentLabel(item) {
    const rate = Number(item.indiceReajuste) || 0;
    const index = projectIndexLabel(item.indiceCorrecaoNome);
    if (rate === 0) return `Sem reajuste (0%) • Índice ${index}`;
    return `${index} • Reajuste de ${compactPercent(rate)} • mês de aniversário ${number(item.mesAniversario)}`;
  }

  function renderProjectComposition(data) {
    const items = Array.isArray(data.projectItems) ? data.projectItems : [];
    const summary = data.projectSummary || {};
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>03</span>
          <div><h3>Grupos e cotas selecionados</h3><p>Veja como o crédito total foi dividido entre os grupos.</p></div>
        </div>

        <div class="ps-project-summary">
          <article><span>Grupos</span><strong>${number(summary.totalGrupos || items.length)}</strong><small>grupos incluídos</small></article>
          <article><span>Cotas</span><strong>${number(summary.totalCotas || 0)}</strong><small>total de cotas</small></article>
          <article><span>Crédito total</span><strong>${money(summary.valorCartaTotal || data.metrics.creditoTotal)}</strong><small>soma das cartas</small></article>
          <article><span>Prazo médio</span><strong>${number(summary.prazoMedio || data.contributions.parcelasTotais)} meses</strong><small>ponderado pelo valor das cartas</small></article>
        </div>

        ${items.length ? `
          <div class="ps-project-table-wrap">
            <table class="ps-project-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Administradora e segmento</th>
                  <th>Cotas e crédito</th>
                  <th>Prazo e contemplação</th>
                  <th>Taxa e reajuste</th>
                  <th>Lance</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td><strong>${escapeHTML(item.codigoGrupo)}</strong></td>
                    <td><strong>${escapeHTML(item.administradora)}</strong><small>${escapeHTML(item.segmento)}</small></td>
                    <td><strong>${number(item.quantidadeCotas)} ${item.quantidadeCotas === 1 ? 'cota' : 'cotas'}</strong><small>Carta unitária ${money(item.valorCartaUnitario)} • total ${money(item.valorCartaTotal)}</small></td>
                    <td><strong>${number(item.prazoMeses)} meses</strong><small>Contemplação no cenário: mês ${number(item.mesContemplacaoAlvo)}</small></td>
                    <td><strong>Taxa de administração ${compactPercent(item.taxaAdmPct)}</strong><small>Fundo de reserva ${compactPercent(item.fundoReservaPct)} • ${escapeHTML(projectAdjustmentLabel(item))}</small></td>
                    <td><strong>${escapeHTML(projectBidModeLabel(item.modalidadeLance))}</strong><small>Lance ${compactPercent(item.lanceProprioPct + item.lanceEmbutidoPct)}</small></td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="ps-empty-schedule">Nenhum grupo foi selecionado. Os totais usam apenas os valores gerais informados na simulação.</div>
        `}

        <aside class="ps-insight">
          <strong>Conferência</strong>
          <p>A soma das cartas selecionadas é ${money(summary.valorCartaTotal || data.metrics.creditoTotal)}. Confira grupo, cota, prazo, taxa e lance antes de contratar.</p>
        </aside>
      </section>
    `;
  }

  function renderProductPhases(data) {
    const phases = Array.isArray(data.productPhases) ? data.productPhases : [];
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>04</span>
          <div><h3>Etapas previstas</h3><p>Da entrada no grupo ao encerramento do plano.</p></div>
        </div>
        <div class="ps-phase-grid">
          ${phases.map((phase, index) => `
            <article class="ps-phase-card ps-phase-card--${presentationStatus(phase.status)}">
              <div class="ps-phase-card__index">${index + 1}</div>
              <div>
                <strong>${escapeHTML(phase.title)}</strong>
                <span>${escapeHTML(phase.date)}</span>
                <p>${escapeHTML(phase.description)}</p>
              </div>
            </article>
          `).join('')}
        </div>
        <aside class="ps-insight">
          <strong>Atenção</strong>
          <p>Assembleias, lances, análise de crédito e documentos seguem as regras da administradora e do contrato.</p>
        </aside>
      </section>
    `;
  }

  function renderFinancialComposition(data) {
    const total = data.charts.composition.reduce((s, item) => s + item.value, 0) || 1;
    const chart = isChartEnabled(data, 'composition')
      ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'composition')}"></canvas></div>`
      : renderDisabledChart('Custos do plano');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>05</span>
            <div><h3>Custos do plano</h3><p>Carta de crédito, taxa de administração, fundo de reserva e seguro.</p></div>
          </div>
          ${chart}
        </div>
        <div class="ps-composition-list">
          ${data.charts.composition.map(item => `
            <article>
              <span>${escapeHTML(item.name)}</span>
              <strong>${money(item.value)}</strong>
              <small>${percent((item.value / total) * 100)} do plano</small>
            </article>
          `).join('')}
          <aside class="ps-insight">
            <strong>Resumo</strong>
            <p>A carta corresponde ao crédito simulado. Taxa, fundo e seguro são valores adicionais previstos nas condições do grupo.</p>
          </aside>
        </div>
      </section>
    `;
  }

  function renderContributionOverview(data) {
    const chart = isChartEnabled(data, 'installment')
      ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'installment')}"></canvas></div>`
      : renderDisabledChart('Evolução das parcelas');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>06</span>
            <div><h3>Parcelas</h3><p>Quantidade paga, saldo restante e valores projetados mês a mês.</p></div>
          </div>
          <div class="ps-progress">
            <div><strong>${number(data.contributions.parcelasPagas)}</strong><span>pagas</span></div>
            <div><strong>${number(data.contributions.parcelasRestantes)}</strong><span>restantes</span></div>
            <div><strong>${number(data.contributions.parcelasTotais)}</strong><span>total</span></div>
          </div>
          <div class="ps-progress-bar"><span style="width:${Math.min(100, data.metrics.percentualPago)}%"></span></div>
          <div class="ps-next-payment">
            <span>Próxima parcela</span>
            <strong>${money(data.contributions.proximaParcelaValor)}</strong>
            <small>Vencimento estimado em ${formatDate(data.contributions.proximaParcelaData)}</small>
          </div>
        </div>
        ${chart}
      </section>
    `;
  }

  function renderBidStrategy(data) {
    const cards = [
      { label: 'Lance próprio', value: money(data.lances.lanceProprio), help: 'Valor pago com recursos do cliente.' },
      { label: 'Lance embutido', value: money(data.lances.lanceEmbutido), help: 'Valor descontado da carta.' },
      { label: 'Lance total', value: money(data.lances.lanceTotal), help: 'Soma dos lances próprio e embutido.' },
      { label: 'Crédito líquido', value: money(data.metrics.caixaLiquida), help: 'Crédito estimado após o lance embutido.' }
    ];
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>07</span>
          <div><h3>Lances</h3><p>Valores próprios, valor embutido e impacto no crédito disponível.</p></div>
        </div>
        <div class="ps-kpi-grid">${cards.map(k => kpiCard(k)).join('')}</div>
        <div class="ps-section--split ps-section--nested">
          <aside class="ps-strategy">
            <strong>Valores considerados</strong>
            <p>${escapeHTML(data.lances.estrategiaResumo)}</p>
            <ul>
              <li>Lance total: ${money(data.lances.lanceTotal)}</li>
              <li>Redução do crédito pelo lance embutido: ${money(data.lances.impactoCreditoLiquido)}</li>
              <li>Saldo após lance: ${money(data.lances.impactoSaldoDevedor)}</li>
            </ul>
          </aside>
          ${isChartEnabled(data, 'bid')
            ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'bid')}"></canvas></div>`
            : renderDisabledChart('Lance e crédito')}
        </div>
      </section>
    `;
  }

  function renderProjectionSection(data) {
    const charts = [
      isChartEnabled(data, 'debt')
        ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'debt')}"></canvas></div>`
        : renderDisabledChart('Saldo devedor'),
      isChartEnabled(data, 'installmentProjection')
        ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'installmentProjection')}"></canvas></div>`
        : renderDisabledChart('Projeção de parcelas')
    ].join('');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>08</span>
            <div><h3>Saldo e parcelas ao longo do prazo</h3><p>Valores projetados mês a mês até o fim do plano.</p></div>
          </div>
          <aside class="ps-insight">
            <strong>O que observar</strong>
            <p>O saldo diminui com os pagamentos. As parcelas podem mudar por reajustes, lances e demais condições contratuais.</p>
          </aside>
        </div>
        <div class="ps-chart-stack">
          ${charts}
        </div>
      </section>
    `;
  }

  function renderPaymentSchedule(data) {
    const rows = Array.isArray(data.schedule) ? data.schedule : [];
    if (!rows.length) {
      return `
        <section class="ps-section ps-section--schedule ps-print-page">
          <div class="ps-section__head">
            <span>09</span>
            <div><h3>Cronograma mensal de parcelas</h3><p>A tabela será exibida após o cálculo da simulação.</p></div>
          </div>
          <div class="ps-empty-schedule">Calcule a simulação para ver as parcelas mês a mês.</div>
        </section>
      `;
    }

    const totalParcelas = rows.reduce((sum, row) => sum + row.parcelaTotal, 0);
    const totalLances = rows.reduce((sum, row) => sum + row.valorLance + row.valorAdiantado, 0);
    const maiorParcela = rows.reduce((max, row) => Math.max(max, row.parcelaTotal), 0);
    const eventosRelevantes = rows.filter(row => eventTone(row.evento) !== 'normal').length;

    return `
      <section class="ps-section ps-section--schedule ps-print-page">
        <div class="ps-section__head">
          <span>09</span>
          <div>
            <h3>Cronograma mensal de parcelas</h3>
            <p>Parcelas, reajustes, encargos, lances e saldo projetado mês a mês.</p>
          </div>
        </div>

        <div class="ps-schedule-summary">
          <article><span>Meses projetados</span><strong>${number(rows.length)}</strong><small>Período calculado</small></article>
          <article><span>Total de parcelas</span><strong>${money(totalParcelas)}</strong><small>Soma do fluxo mensal</small></article>
          <article><span>Maior parcela</span><strong>${money(maiorParcela)}</strong><small>Maior valor mensal calculado</small></article>
          <article><span>Eventos</span><strong>${number(eventosRelevantes)}</strong><small>Lances, reajustes ou encargos</small></article>
        </div>

        <div class="ps-schedule-table-wrap">
          <table class="ps-schedule-table">
            <thead>
              <tr>
                <th>Mês</th>
                <th>Data</th>
                <th>Evento</th>
                <th>Parcela base</th>
                <th>Taxa adm.</th>
                <th>Fundo</th>
                <th>Seguro</th>
                <th>Parcela total</th>
                <th>Lance/adiant.</th>
                <th>Multa/juros</th>
                <th>Saldo final</th>
                <th>Prazo</th>
              </tr>
            </thead>
            <tbody>
              ${rows.map(row => {
                const movimento = row.valorLance + row.valorAdiantado;
                const encargos = row.multa + row.juros;
                const rowTitle = row.observacao ? ` title="${escapeHTML(row.observacao)}"` : '';
                return `
                  <tr${rowTitle}>
                    <td class="ps-schedule-table__center">${number(row.mes)}</td>
                    <td>${formatDate(row.data)}</td>
                    <td><span class="ps-event-pill ps-event-pill--${eventTone(row.evento)}">${escapeHTML(row.evento)}</span></td>
                    <td class="ps-schedule-table__num">${money(row.parcelaBase)}</td>
                    <td class="ps-schedule-table__num">${money(row.taxaAdm)}</td>
                    <td class="ps-schedule-table__num">${money(row.fundoReserva)}</td>
                    <td class="ps-schedule-table__num">${money(row.seguro)}</td>
                    <td class="ps-schedule-table__num ps-schedule-table__strong">${money(row.parcelaTotal)}</td>
                    <td class="ps-schedule-table__num">${movimento > 0 ? money(movimento) : '-'}</td>
                    <td class="ps-schedule-table__num">${encargos > 0 ? money(encargos) : '-'}</td>
                    <td class="ps-schedule-table__num">${money(row.saldoFinal)}</td>
                    <td class="ps-schedule-table__center">${number(row.prazoRestante)}</td>
                  </tr>
                `;
              }).join('')}
            </tbody>
          </table>
        </div>
        <p class="ps-schedule-note">Os valores podem mudar por reajustes e demais condições previstas no contrato.</p>
      </section>
    `;
  }

  function renderConceptsSection(data) {
    const concepts = conceptDefinitions.filter(item => isConceptEnabled(data, item.key));
    if (!concepts.length) return '';

    return `
      <section class="ps-section ps-section--concepts ps-print-page">
        <div class="ps-section__head">
          <span>EDU</span>
          <div><h3>Termos desta proposta</h3><p>Definições dos principais itens do consórcio.</p></div>
        </div>
        <div class="ps-concepts-grid">
          ${concepts.map(item => `
            <article>
              <strong>${escapeHTML(item.title)}</strong>
              <p>${escapeHTML(item.body)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderFormulaExplanations(data) {
    const formulas = formulaDefinitions(data).filter(item => isFormulaEnabled(data, item.key));
    if (!formulas.length) return '';

    return `
      <section class="ps-section ps-section--formulas ps-print-page">
        <div class="ps-section__head">
          <span>CALC</span>
          <div><h3>Como os valores foram calculados</h3><p>Fórmulas usadas nesta simulação.</p></div>
        </div>
        <div class="ps-formula-grid">
          ${formulas.map(item => `
            <article>
              <span>${escapeHTML(item.expression)}</span>
              <strong>${escapeHTML(item.title)}</strong>
              <em>${escapeHTML(item.example)}</em>
              <p>${escapeHTML(item.body)}</p>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderNextSteps(data) {
    const selectionFacts = [
      ['Crédito total', money(data.metrics.creditoTotal)],
      ['Crédito líquido', money(data.metrics.caixaLiquida)],
      ['Lance total', money(data.lances.lanceTotal)],
      ['Prazo', `${number(data.contributions.parcelasTotais)} meses`]
    ];
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>10</span>
            <div><h3>Próximos passos</h3><p>O que precisa ser confirmado antes da contratação.</p></div>
          </div>
          <div class="ps-next-list">
            ${data.nextSteps.map(step => `
              <article>
                <strong>${escapeHTML(step.title)}</strong>
                <p>${escapeHTML(step.description)}</p>
                ${step.date ? `<span>${escapeHTML(step.date)}</span>` : ''}
              </article>
            `).join('')}
          </div>
        </div>
        <div class="ps-pdf-plan">
          <h4>Condições principais</h4>
          <div class="ps-pdf-plan__facts" data-proposal-selection-summary>
            ${selectionFacts.map(([label, value]) => `
              <article><span>${escapeHTML(label)}</span><strong>${escapeHTML(value)}</strong></article>
            `).join('')}
          </div>
          <p>A contemplação não é garantida. Confirme taxas, reajustes, regras de lance e documentos com a administradora.</p>
        </div>
      </section>
    `;
  }

  function renderAcceptance(data) {
    const acceptance = data.acceptance || normalizeAcceptance(null, data);
    const checks = [
      { key: 'premissas', title: 'Valores e condições', body: 'Crédito, prazo, taxa, fundo, lance e parcelas foram conferidos.' },
      { key: 'cliente', title: 'Dados do cliente', body: 'Objetivo e capacidade de pagamento foram conferidos.' },
      { key: 'documentacao', title: 'Documentos necessários', body: 'Documentos e próximos contatos foram definidos.' }
    ];
    const updatedLabel = acceptance.updatedAt ? formatDate(acceptance.updatedAt) : 'Aguardando registro';

    return `
      <section class="ps-section ps-section--acceptance">
        <div class="ps-section__head">
          <span>ACEITE</span>
          <div><h3>Revisão da proposta</h3><p>Registro de quem conferiu os valores, as condições e os documentos antes do envio.</p></div>
        </div>
        <div class="ps-acceptance-grid">
          <article><span>Status</span><strong>${escapeHTML(acceptance.statusLabel)}</strong><small>${acceptance.status === 'reviewed' ? 'Conferência concluída' : 'Conferência pendente'}</small></article>
          <article><span>Responsável</span><strong>${escapeHTML(acceptance.reviewer)}</strong><small>${escapeHTML(acceptance.reviewerRole)}</small></article>
          <article><span>Validade</span><strong>${escapeHTML(formatDate(acceptance.validUntil))}</strong><small>Registro atualizado em ${escapeHTML(updatedLabel)}</small></article>
          <article><span>Proposta</span><strong>${escapeHTML(acceptance.proposalId)}</strong><small>Número da proposta</small></article>
        </div>
        <div class="ps-acceptance-checklist">
          ${checks.map(item => `
            <article class="${acceptance.checklist[item.key] ? 'is-checked' : ''}">
              <span>${acceptance.checklist[item.key] ? 'OK' : 'Pendente'}</span>
              <strong>${escapeHTML(item.title)}</strong>
              <p>${escapeHTML(item.body)}</p>
            </article>
          `).join('')}
        </div>
        <div class="ps-acceptance-note">
          <strong>Observações</strong>
          <p>${escapeHTML(acceptance.notes)}</p>
        </div>
      </section>
    `;
  }

  function renderDisclaimer(data) {
    return `
      <footer class="ps-footer ps-print-page">
        <div>
          <strong>Avisos importantes</strong>
          <ul>${data.disclaimers.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
        </div>
        <div class="ps-footer__meta">
          <span>Gerado em ${formatDate(data.generatedAt)}</span>
          <span>Proposta ${escapeHTML(data.id)}</span>
          <span>Responsável: ${escapeHTML(data.consultor)}</span>
        </div>
      </footer>
    `;
  }

  function destroyChart(id) {
    if (chartInstances[id]) {
      chartInstances[id].destroy();
      delete chartInstances[id];
    }
  }

  function renderChart(id, config) {
    const el = document.getElementById(id);
    if (!el || typeof Chart === 'undefined') return;
    destroyChart(id);
    chartInstances[id] = new Chart(el, config);
  }

  function chartOptions({ legend = false, yMoney = true } = {}) {
    return {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: legend, position: 'bottom', labels: { boxWidth: 10, font: { size: 11 } } },
        tooltip: {
          callbacks: {
            label(ctx) {
              const label = ctx.dataset.label || ctx.label || '';
              const value = yMoney ? money(ctx.parsed.y ?? ctx.parsed) : number(ctx.parsed.y ?? ctx.parsed);
              return label ? `${label}: ${value}` : value;
            }
          }
        }
      },
      scales: {
        x: { grid: { display: false }, ticks: { maxRotation: 0, autoSkip: true, maxTicksLimit: 8 } },
        y: {
          beginAtZero: true,
          ticks: {
            callback(value) {
              return yMoney ? money(value).replace(',00', '') : number(value);
            }
          }
        }
      }
    };
  }

  function renderCharts(data) {
    const colors = ['#0b6ff3', '#7c3aed', '#0f9f6e', '#f97316', '#111827'];
    Object.keys(data.chartIds || {}).forEach(key => {
      if (!isChartEnabled(data, key)) destroyChart(chartId(data, key));
    });

    if (isChartEnabled(data, 'composition')) {
      renderChart(chartId(data, 'composition'), {
        type: 'doughnut',
        data: {
          labels: data.charts.composition.map(i => i.name),
          datasets: [{ data: data.charts.composition.map(i => i.value), backgroundColor: colors, borderWidth: 3, borderColor: '#fff' }]
        },
        options: { ...chartOptions({ legend: true }), scales: undefined, cutout: '64%' }
      });
    }

    if (isChartEnabled(data, 'installment')) {
      renderChart(chartId(data, 'installment'), {
        type: 'line',
        data: { labels: data.charts.installmentProjection.map(i => i.period), datasets: [{ label: 'Parcela projetada', data: data.charts.installmentProjection.map(i => i.value), borderColor: '#0b6ff3', backgroundColor: 'rgba(11,111,243,.12)', fill: true, tension: .32, pointRadius: 0 }] },
        options: chartOptions()
      });
    }

    if (isChartEnabled(data, 'bid')) {
      renderChart(chartId(data, 'bid'), {
        type: 'bar',
        data: { labels: data.charts.bidComparison.map(i => i.name), datasets: [{ label: 'Valor', data: data.charts.bidComparison.map(i => i.value), backgroundColor: ['#0b6ff3', '#0f9f6e', '#f97316'], borderRadius: 8 }] },
        options: chartOptions()
      });
    }

    if (isChartEnabled(data, 'debt')) {
      renderChart(chartId(data, 'debt'), {
        type: 'line',
        data: { labels: data.charts.debtProjection.map(i => i.period), datasets: [{ label: 'Saldo devedor', data: data.charts.debtProjection.map(i => i.value), borderColor: '#f97316', backgroundColor: 'rgba(249,115,22,.12)', fill: true, tension: .28, pointRadius: 0 }] },
        options: chartOptions()
      });
    }

    if (isChartEnabled(data, 'installmentProjection')) {
      renderChart(chartId(data, 'installmentProjection'), {
        type: 'bar',
        data: { labels: data.charts.installmentProjection.map(i => i.period), datasets: [{ label: 'Parcela', data: data.charts.installmentProjection.map(i => i.value), backgroundColor: '#2563eb', borderRadius: 6 }] },
        options: chartOptions()
      });
    }
  }

  function render(container, payload, options = {}) {
    const target = typeof container === 'string' ? document.querySelector(container) : container;
    if (!target) return null;

    const mapped = payload && payload.proposalData
      ? payload.proposalData
      : payload && payload.resultado
        ? mapSimulationToProposal(payload)
        : payload && payload.metrics && payload.lances
          ? payload
          : createMockData();
    if (payload && payload.acceptance) mapped.acceptance = payload.acceptance;
    if (payload && payload.builder) mapped.builder = payload.builder;
    const data = prepareRenderData(mapped, options, target);
    const blocks = [
      ['header', renderHeader],
      ['executive', renderExecutiveConversation],
      ['decision', renderResultDecision],
      ['kpis', renderKPISection],
      ['journey', renderJourney],
      ['project', renderProjectComposition],
      ['productPhases', renderProductPhases],
      ['financialComposition', renderFinancialComposition],
      ['contributionOverview', renderContributionOverview],
      ['bidStrategy', renderBidStrategy],
      ['projection', renderProjectionSection],
      ['schedule', renderPaymentSchedule],
      ['concepts', renderConceptsSection],
      ['formulas', renderFormulaExplanations],
      ['nextSteps', renderNextSteps],
      ['acceptance', renderAcceptance],
      ['disclaimer', renderDisclaimer]
    ]
      .filter(([key]) => isSectionEnabled(data, key))
      .map(([, renderer]) => renderer(data))
      .filter(Boolean)
      .join('');

    target.innerHTML = `
      <div class="ps-page ps-page--${escapeHTML(data.surface)}" id="${escapeHTML(data.rootId)}" data-proposal-summary-root>
        ${blocks || '<div class="ps-empty-schedule ps-print-page">Nenhum bloco selecionado para esta proposta.</div>'}
      </div>
    `;

    setTimeout(() => renderCharts(data), 40);
    return data;
  }

  function resolveRoot(source) {
    if (source && typeof source === 'string') return document.querySelector(source);
    if (source && source.nodeType === 1) return source;
    return document.querySelector('#proposal-export-root') || document.querySelector('#proposal-summary-print-root');
  }

  function print(source) {
    const root = resolveRoot(source);
    if (root) root.classList.add('ps-print-target');
    document.body.classList.add('ps-printing');
    const cleanup = () => {
      document.body.classList.remove('ps-printing');
      if (root) root.classList.remove('ps-print-target');
    };
    window.addEventListener('afterprint', cleanup, { once: true });
    setTimeout(cleanup, 1500);
    window.print();
  }

  function exportPDF(source) {
    if (typeof ExportManager !== 'undefined' && ExportManager.exportarPDFDaTela) {
      return ExportManager.exportarPDFDaTela(source || '#proposal-export-root, #proposal-summary-print-root');
    }
    return print();
  }

  return {
    render,
    print,
    exportPDF,
    mapSimulationToProposal,
    buildResultDecision,
    createMockData,
    presentationStatus,
    normalizeProposalBuilder,
    proposalBuilderDefaults
  };
})();
