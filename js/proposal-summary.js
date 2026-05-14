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
    { key: 'consorcio', title: 'Consorcio', body: 'Modelo de compra planejada em grupo, no qual os participantes contribuem mensalmente para formar credito e disputar contemplacao.' },
    { key: 'cartaCredito', title: 'Carta de credito', body: 'Valor contratado para aquisicao do bem ou composicao do projeto. E a referencia de poder de compra da proposta.' },
    { key: 'grupoCota', title: 'Grupo e cota', body: 'O grupo organiza as regras coletivas. A cota identifica a participacao do cliente dentro desse grupo.' },
    { key: 'assembleia', title: 'Assembleia', body: 'Evento periodico em que ocorrem contemplatorios por sorteio, lance ou outras regras previstas pela administradora.' },
    { key: 'lanceProprio', title: 'Lance proprio', body: 'Recurso adicional do cliente usado para aumentar a forca de contemplacao sem reduzir diretamente a carta contratada.' },
    { key: 'lanceEmbutido', title: 'Lance embutido', body: 'Parte da propria carta usada como lance. Aumenta a oferta, mas reduz o credito liquido disponivel apos contemplacao.' },
    { key: 'contemplacao', title: 'Contemplacao', body: 'Momento em que o cliente passa a poder usar o credito, desde que cumpra regras cadastrais, contratuais e documentais.' },
    { key: 'fundoReserva', title: 'Fundo de reserva', body: 'Componente financeiro previsto para proteger o grupo contra necessidades de caixa e eventos operacionais.' },
    { key: 'taxaAdministracao', title: 'Taxa de administracao', body: 'Remuneracao da administradora pela operacao do grupo, distribuida ao longo do prazo conforme regra do plano.' },
    { key: 'saldoDevedor', title: 'Saldo devedor', body: 'Valor ainda pendente na operacao, considerando pagamentos, lances, eventos e amortizacao projetada.' },
    { key: 'reajuste', title: 'Reajuste', body: 'Atualizacao periodica da carta, parcelas ou saldo conforme indice e regra contratual do grupo.' },
    { key: 'seguro', title: 'Seguro', body: 'Componente opcional ou contratual que pode proteger a operacao conforme produto, administradora e perfil.' }
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
        body: 'Mostra o compromisso mensal consolidado que o cliente precisa sustentar durante a jornada.'
      },
      {
        key: 'parcelaBase',
        title: 'Parcela base',
        expression: 'Carta de credito / prazo total do grupo',
        example: `${money(data.metrics.creditoTotal)} dividido pelo prazo contratado`,
        body: 'E a referencia inicial de amortizacao antes de encargos, reajustes e eventos.'
      },
      {
        key: 'taxaAdministracao',
        title: 'Taxa de administracao',
        expression: 'Carta de credito x taxa adm. total',
        example: `Taxa projetada: ${money(compositionValue('Taxa de administracao'))}`,
        body: 'Explica o custo de administracao do plano e ajuda a comparar alternativas de grupo.'
      },
      {
        key: 'fundoReserva',
        title: 'Fundo de reserva',
        expression: 'Carta de credito x percentual de fundo',
        example: `Fundo projetado: ${money(data.metrics.fundoReserva || compositionValue('Fundo de reserva'))}`,
        body: 'Ajuda o cliente a entender uma parcela do custo que nao e carta, mas faz parte da estrutura coletiva.'
      },
      {
        key: 'lanceTotal',
        title: 'Lance total',
        expression: 'Lance proprio + lance embutido',
        example: `${money(data.lances.lanceProprio)} + ${money(data.lances.lanceEmbutido)} = ${money(data.lances.lanceTotal)}`,
        body: 'Traduz a forca da oferta de contemplacao e separa o que sai do caixa do que reduz a carta.'
      },
      {
        key: 'cartaLiquida',
        title: 'Carta liquida',
        expression: 'Carta de credito - lance embutido',
        example: `${money(data.metrics.creditoTotal)} - ${money(data.lances.lanceEmbutido)} = ${money(data.metrics.caixaLiquida)}`,
        body: 'Mostra o credito estimado disponivel apos usar parte da carta como lance.'
      },
      {
        key: 'saldoDevedor',
        title: 'Saldo devedor projetado',
        expression: 'Saldo anterior - amortizacoes - lances + reajustes/eventos',
        example: `Saldo final estimado: ${money(data.metrics.saldoDevedor)}`,
        body: 'Serve para explicar como a operacao evolui depois da adesao e da estrategia de lance.'
      },
      {
        key: 'percentualPago',
        title: 'Percentual percorrido',
        expression: 'Parcelas pagas / parcelas totais',
        example: `${number(data.contributions.parcelasPagas)} de ${number(data.contributions.parcelasTotais)} parcelas = ${percent(data.metrics.percentualPago)}`,
        body: 'Ajuda a localizar o cliente na jornada e mostra quanto do plano ja foi percorrido.'
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
    return !data.builder || !data.builder.sections || data.builder.sections[key] !== false;
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
    const prepared = {
      ...data,
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
      reviewed: 'Revisada localmente',
      partial: 'Revisao parcial',
      pending: 'Em revisao',
      expired: 'Revisao vencida'
    };

    return {
      status,
      statusLabel: acceptance && acceptance.statusLabel ? acceptance.statusLabel : (labels[status] || labels.pending),
      proposalId: acceptance && acceptance.proposalId ? acceptance.proposalId : (data && data.id) || 'PROP-PENDENTE',
      reviewer: acceptance && acceptance.reviewer ? acceptance.reviewer : (data && data.consultor) || 'Consultor Bancus Fraternis',
      reviewerRole: acceptance && acceptance.reviewerRole ? acceptance.reviewerRole : 'Consultor responsavel',
      validUntil: acceptance && acceptance.validUntil ? acceptance.validUntil : valid.toISOString().slice(0, 10),
      notes: acceptance && acceptance.notes ? acceptance.notes : 'Aguardando validacao das premissas antes do encaminhamento.',
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
      `Carta e credito liquido: ${money(creditoTotal)} contratados, ${money(caixaLiquida)} estimados para uso apos lance embutido.`,
      `Parcela de referencia: ${money(parcelaAtual)} com prazo de ${number(prazoTotal)} meses.`,
      `Lance total: ${money(lanceTotal)} combinando recursos proprios, embutidos, FGTS ou fixo conforme configuracao.`,
      `Taxa media informada: ${percent(taxaMedia)} com fundo de reserva e seguro conforme regras do grupo.`
    ];

    if (!projectItems.length) riscos.push('Nenhum grupo real foi vinculado a proposta. Valide a prateleira antes de enviar ao cliente.');
    if (readiness > 0 && readiness < 70) riscos.push(`Perfil financeiro com prontidao ${number(readiness)}/100. Reforce renda, reserva e capacidade antes do aceite.`);
    if (capacidade > 0 && parcelaSobreCapacidade > 100) riscos.push(`Parcela usa ${percent(parcelaSobreCapacidade)} da capacidade declarada. Ajuste carta, prazo ou lance.`);
    if (!capacidade && renda > 0 && parcelaSobreRenda > 30) riscos.push(`Parcela representa ${percent(parcelaSobreRenda)} da renda informada. Confirmar folga mensal com o cliente.`);
    if (lanceEmbutidoPct > 30) riscos.push(`Lance embutido de ${percent(lanceEmbutidoPct)} reduz o credito liquido. Explicar impacto no uso do bem.`);
    if (liquidezPct > 0 && liquidezPct < 70) riscos.push(`Credito liquido fica em ${percent(liquidezPct)} da carta. Avaliar se cobre o objetivo declarado.`);
    if (prazoTotal >= 180) riscos.push('Prazo longo aumenta exposicao a reajustes e exige acompanhamento recorrente.');
    if (taxaMedia > 20) riscos.push(`Taxa media de ${percent(taxaMedia)} pede comparacao com alternativas de grupo.`);

    const semContemplacao = scenarioResumo(cenarios, 'semContemplacao');
    const parcelaCheia = scenarioResumo(cenarios, 'parcelaCheia');
    const comparacao = [
      {
        label: 'Credito liquido',
        atual: money(caixaLiquida),
        referencia: money(creditoTotal),
        leitura: liquidezPct > 0 ? `${percent(liquidezPct)} da carta permanece disponivel para uso.` : 'Comparacao depende da carta informada.'
      },
      semContemplacao ? {
        label: 'Com lance vs sem lance',
        atual: money(lanceTotal),
        referencia: money(asNumber(semContemplacao.lanceTotal)),
        leitura: 'O cenario atual antecipa estrategia de contemplacao; o alternativo preserva caixa, mas posterga acesso ao credito.'
      } : null,
      parcelaCheia ? {
        label: 'Parcela reduzida',
        atual: money(parcelaAtual),
        referencia: money(asNumber(parcelaCheia.parcelaTotalAtual)),
        leitura: asNumber(parcelaCheia.parcelaTotalAtual) > parcelaAtual
          ? 'A reducao melhora caixa antes da contemplacao e precisa ser explicada como etapa temporaria.'
          : 'A parcela cheia nao altera significativamente o compromisso inicial.'
      } : null
    ].filter(Boolean);

    const status = riscos.some((item) => item.includes('capacidade') || item.includes('Nenhum grupo') || item.includes('Credito liquido'))
      ? 'revisar'
      : riscos.length
        ? 'atencao'
        : 'pronto';
    const tone = status === 'pronto' ? 'stable' : status === 'atencao' ? 'warning' : 'critical';
    const headline = status === 'pronto'
      ? 'Seguir para proposta final'
      : status === 'atencao'
        ? 'Seguir com ressalvas explicadas'
        : 'Revisar premissas antes da proposta';
    const recommendation = status === 'pronto'
      ? 'A simulacao esta coerente para virar proposta: credito, parcela, lance e prazo conversam com a jornada atual.'
      : status === 'atencao'
        ? 'A proposta pode avancar, mas o consultor deve explicar os alertas antes de pedir aceite do cliente.'
        : 'A proposta ainda precisa de ajuste ou confirmacao objetiva para nao levar uma decisao fragil ao cliente.';
    const reasons = [
      creditoTotal > 0 ? `Credito contratado de ${money(creditoTotal)} com caixa liquida de ${money(caixaLiquida)}.` : '',
      parcelaAtual > 0 ? `Parcela atual projetada em ${money(parcelaAtual)}.` : '',
      projectItems.length ? `${number(projectItems.length)} grupo${projectItems.length !== 1 ? 's' : ''} sustentam a composicao da proposta.` : '',
      lanceTotal > 0 ? `Lance total de ${money(lanceTotal)} foi considerado no cronograma.` : ''
    ];

    return {
      status,
      tone,
      headline,
      recommendation,
      actionLabel: status === 'revisar' ? 'Revisar premissas' : 'Ir para proposta final',
      reasons: nonEmptyList(reasons, ['Calcule a simulacao e selecione grupos para gerar uma recomendacao final.']),
      risks: nonEmptyList(riscos, ['Sem alerta critico nos parametros atuais. Manter validacao formal do grupo antes do envio.']),
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
      grupo: grupos.length === 1 ? grupos[0] : (grupos.length ? `${grupos.length} grupos estruturados` : 'Grupo a definir'),
      segmento: first.nomeSegmento || 'Consorcio estruturado'
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
      const classificacao = item.classificacao || group._classificacao || null;
      const papel = item.papel || group._papel || null;

      return {
        index: index + 1,
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
        title: 'Adesao ao grupo',
        status: 'done',
        date: formatDate(adesao),
        description: 'Formalizacao da participacao, definicao da carta e aceite das regras do grupo.'
      },
      {
        title: 'Contribuicoes mensais',
        status: 'current',
        date: formatDate(proximaParcelaData),
        description: 'Pagamento das parcelas, taxa de administracao, fundo e componentes contratados.'
      },
      {
        title: 'Assembleias e lance',
        status: 'current',
        date: `Ate o mes ${mesContemplacao}`,
        description: 'Acompanhamento das assembleias e execucao da estrategia de lance planejada.'
      },
      {
        title: 'Contemplacao estimada',
        status: 'upcoming',
        date: formatDate(contemplData),
        description: 'Marco projetado para acesso ao credito, condicionado as regras e a competitividade do grupo.'
      },
      {
        title: 'Credito, analise e documentos',
        status: 'upcoming',
        date: 'Apos contemplacao',
        description: 'Validacao cadastral, analise de credito, garantias e documentacao do bem ou servico.'
      },
      {
        title: 'Uso do credito e encerramento',
        status: 'upcoming',
        date: `${number(parcelasRestantes)} parcelas restantes`,
        description: 'Faturamento, acompanhamento do saldo devedor e quitacao final da operacao.'
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
    const parcelasPagas = Math.max(0, Math.min(parcelasTotais, mesContemplacao - 1));
    const parcelasRestantes = Math.max(0, parcelasTotais - parcelasPagas);
    const saldoFinal = getLastCronEntry(cronograma);
    const saldoDevedor = saldoFinal ? Number(saldoFinal.saldoFinal) || 0 : Number(resumo.saldoInicial) || 0;
    const percentualPago = parcelasTotais > 0 ? (parcelasPagas / parcelasTotais) * 100 : 0;
    const proximaParcelaData = addMonths(adesao, parcelasPagas + 1);
    const contemplData = addMonths(adesao, mesContemplacao);
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
      prazoRestante: Number(resumo.prazoRestante) || parcelasRestantes,
      parcelaAtual: Number(resumo.parcelaTotalAtual) || 0,
      totalPago: Number(resumo.totalPago) || 0,
      caixaLiquida: Number(resumo.cartaLiquida) || creditoTotal,
      saldoDevedor,
      percentualPago
    };
    const contributions = {
      parcelasPagas,
      parcelasTotais,
      parcelasRestantes,
      proximaParcelaValor: Number(resumo.parcelaTotalAtual) || 0,
      proximaParcelaData: proximaParcelaData.toISOString(),
      totalContribuido: Number(resumo.totalPagoAteContemplacao) || 0
    };
    const lances = {
      lanceProprio: Number(resumo.lanceProprio) || 0,
      lanceEmbutido: Number(resumo.lanceEmbutido) || 0,
      lanceTotal: Number(resumo.lanceTotal) || 0,
      impactoCreditoLiquido: Number(resumo.lanceEmbutido) || 0,
      impactoSaldoDevedor: Math.max(0, (Number(resumo.saldoInicial) || 0) - (Number(resumo.lanceTotal) || 0)),
      estrategiaResumo: 'A proposta combina credito liquido, lance e prazo para buscar contemplacao planejada sem perder rastreabilidade dos custos.'
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
      decisionContext
    });

    const proposal = {
      id: `PROP-${adesao.getFullYear()}-${String(proposalSeq).padStart(4, '0')}`,
      status: 'Projetada',
      title: 'Resumo da Proposta Estruturada',
      subtitle: 'Operacao desenhada para contemplacao planejada, uso eficiente do credito e leitura clara dos compromissos.',
      grupo: descriptor.grupo,
      cota: descriptor.totalCotas ? `${descriptor.totalCotas} cota(s)` : (params && params.cota) || 'Cota a definir',
      cliente: (params && params.nomeCliente) || 'Cliente em analise',
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
        { id: 'adesao', label: 'Adesao', status: 'done', date: formatDate(adesao), value: money(creditoTotal), description: 'Entrada no grupo e formalizacao da estrategia.' },
        { id: 'grupo', label: 'Formacao / grupo', status: 'done', value: descriptor.grupo, description: `${descriptor.administradora} | ${descriptor.segmento}` },
        { id: 'parcelas', label: 'Contribuicoes', status: parcelasPagas > 0 ? 'done' : 'current', value: `${parcelasPagas}/${parcelasTotais}`, description: 'Parcelas pagas e saldo de parcelas futuras.' },
        { id: 'assembleia', label: 'Assembleias', status: 'current', date: formatDate(proximaParcelaData), value: money(resumo.parcelaTotalAtual), description: 'Acompanhamento mensal da assembleia e da parcela.' },
        { id: 'lance', label: 'Lance', status: (Number(resumo.lanceTotal) || 0) > 0 ? 'current' : 'upcoming', value: money(resumo.lanceTotal), description: 'Estrategia de lance proprio, embutido ou combinado.' },
        { id: 'contemplacao', label: 'Contemplacao', status: 'upcoming', date: formatDate(contemplData), value: `Mes ${mesContemplacao}`, description: 'Marco estimado para acesso ao credito.' },
        { id: 'credito', label: 'Uso do credito', status: 'upcoming', value: money(resumo.cartaLiquida || creditoTotal), description: 'Analise de credito, documentos e faturamento.' },
        { id: 'quitacao', label: 'Encerramento', status: 'upcoming', value: `${parcelasRestantes} restantes`, description: 'Quitacao das obrigacoes do plano.' }
      ],
      charts: {
        composition: [
          { name: 'Carta de credito', value: creditoTotal },
          { name: 'Taxa de administracao', value: Number(resumo.taxaAdmTotal) || 0 },
          { name: 'Fundo de reserva', value: Number(resumo.fundoReservaTotal) || 0 },
          { name: 'Seguro', value: Number(resumo.seguroTotal) || 0 }
        ],
        debtProjection: sampleSeries(cronograma, 'saldoFinal'),
        installmentProjection: sampleSeries(cronograma, 'parcelaTotal'),
        bidComparison: [
          { name: 'Lance total', value: Number(resumo.lanceTotal) || 0 },
          { name: 'Credito liquido', value: Number(resumo.cartaLiquida) || 0 },
          { name: 'Saldo apos lance', value: Math.max(0, (Number(resumo.saldoInicial) || 0) - (Number(resumo.lanceTotal) || 0)) }
        ]
      },
      schedule: normalizeSchedule(cronograma, adesao),
      nextSteps: [
        { title: 'Validar premissas da proposta', description: 'Confirmar carta, prazo, taxa, fundo de reserva e politica de lance antes de formalizar.', date: formatDate(new Date()) },
        { title: 'Preparar recurso para lance', description: 'Definir origem do lance proprio e confirmar o limite de lance embutido permitido.' },
        { title: 'Acompanhar assembleia', description: 'Monitorar a proxima assembleia e atualizar a estrategia conforme o comportamento do grupo.', date: formatDate(proximaParcelaData) },
        { title: 'Organizar documentacao', description: 'Antecipar analise cadastral, comprovantes e documentos necessarios para uso do credito.' }
      ],
      disclaimers: [
        'Valores estimados com base nos parametros informados e sujeitos a regras da administradora.',
        'Parcelas, saldo devedor e custo efetivo podem variar por reajuste, assembleia, lance e eventos contratuais.',
        'Esta proposta e uma simulacao executiva e nao substitui a validacao formal do grupo, contrato e credito.'
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
      project: { itens: [{ administradora: 'Exemplo Consorcios', codigoGrupo: 'Automoveis Premium', quantidadeCotas: 1, nomeSegmento: 'Automoveis' }] }
    });
  }

  function renderHeader(data) {
    return `
      <header class="ps-header ps-print-page">
        <div class="ps-header__main">
          <img src="${assetPath('assets/logos/logo-bank-fratern-icon.svg')}" alt="Bancus Fraternis" class="ps-mark">
          <div>
            <div class="ps-eyebrow">Proposta ${escapeHTML(data.id)} | ${escapeHTML(data.status)}</div>
            <h2>${escapeHTML(data.title)}</h2>
            <p>${escapeHTML(data.subtitle)}</p>
          </div>
        </div>
        <div class="ps-header__side">
          <div class="ps-meta">
            <span>Cliente</span><strong>${escapeHTML(data.cliente)}</strong>
            <span>Grupo / Cota</span><strong>${escapeHTML(data.grupo)} | ${escapeHTML(data.cota)}</strong>
          </div>
          <button class="btn btn--primary ps-no-print" type="button" onclick="ProposalSummary.exportPDF(this.closest('.ps-page'))">Exportar PDF</button>
        </div>
      </header>
    `;
  }

  function renderExecutiveConversation(data) {
    const cards = [
      {
        tag: 'Decisao',
        title: 'O que esta sendo contratado',
        metric: money(data.metrics.creditoTotal),
        body: `A carta de credito conversa com a composicao do projeto, os grupos escolhidos e a finalidade declarada pelo cliente.`,
        link: 'Conecta blocos 01, 03 e 05'
      },
      {
        tag: 'Caixa',
        title: 'Como o compromisso aparece',
        metric: money(data.metrics.parcelaAtual),
        body: `A parcela atual conversa com a curva de parcelas e com a capacidade de manter o plano ate a contemplacao.`,
        link: 'Conecta blocos 01, 06 e 08'
      },
      {
        tag: 'Lance',
        title: 'Qual alavanca move a contemplacao',
        metric: money(data.lances.lanceTotal),
        body: `O lance combina recurso proprio e embutido, impactando credito liquido, saldo e estrategia de assembleia.`,
        link: 'Conecta blocos 02, 07 e 09'
      },
      {
        tag: 'Risco',
        title: 'Onde a conversa precisa continuar',
        metric: `${number(data.contributions.parcelasRestantes)} parcelas`,
        body: `O cronograma mostra se a operacao permanece coerente com prazo, saldo, eventos e proximos passos.`,
        link: 'Conecta blocos 08, 09 e 10'
      }
    ];
    return `
      <section class="ps-section ps-section--conversation ps-print-page">
        <div class="ps-section__head">
          <span>MAPA</span>
          <div><h3>Blocos que conversam entre si</h3><p>A leitura do PDF e da tela foi organizada para cada grafico responder a uma decisao comercial concreta.</p></div>
        </div>
        <div class="ps-conversation-grid">
          ${cards.map(card => `
            <article class="ps-conversation-card">
              <span>${escapeHTML(card.tag)}</span>
              <strong>${escapeHTML(card.title)}</strong>
              <em>${escapeHTML(card.metric)}</em>
              <p>${escapeHTML(card.body)}</p>
              <small>${escapeHTML(card.link)}</small>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderResultDecision(data) {
    const decision = data.decision || buildResultDecision(data);
    const risks = Array.isArray(decision.risks) ? decision.risks : [];
    const premises = Array.isArray(decision.premises) ? decision.premises : [];
    const comparisons = Array.isArray(decision.comparison) ? decision.comparison : [];
    return `
      <section class="ps-section ps-section--decision ps-section--decision-${escapeHTML(decision.tone)} ps-print-page" data-simulator-result-decision data-simulator-result-tone="${escapeHTML(decision.tone)}">
        <div class="ps-section__head">
          <span>DEC</span>
          <div><h3>Resultado como decisao</h3><p>Traduz a simulacao em recomendacao, riscos, premissas e proximo passo comercial.</p></div>
        </div>
        <div class="ps-decision-grid">
          <article class="ps-decision-hero">
            <span>${escapeHTML(decision.status)}</span>
            <h3>${escapeHTML(decision.headline)}</h3>
            <p>${escapeHTML(decision.recommendation)}</p>
            <div class="ps-decision-facts">
              ${(decision.reasons || []).slice(0, 4).map((item) => `<small>${escapeHTML(item)}</small>`).join('')}
            </div>
            <button class="btn btn--primary ps-no-print" type="button" data-simulator-result-cta onclick="window.App && App.goToStep ? App.goToStep(9, { skipValidation: true, skipAutoCalculate: true }) : window.location.hash = 'step-9'">${escapeHTML(decision.actionLabel)}</button>
          </article>
          <div class="ps-decision-panels">
            <article class="ps-decision-panel" data-simulator-result-premise>
              <strong>Premissas que sustentam</strong>
              <ul>${premises.slice(0, 4).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            </article>
            <article class="ps-decision-panel ps-decision-panel--risk" data-simulator-result-risk>
              <strong>Riscos para explicar</strong>
              <ul>${risks.slice(0, 5).map((item) => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
            </article>
          </div>
        </div>
        <div class="ps-decision-comparison" data-simulator-result-comparison>
          ${comparisons.map((item) => `
            <article>
              <span>${escapeHTML(item.label)}</span>
              <strong>${escapeHTML(item.atual)}</strong>
              <small>Referencia: ${escapeHTML(item.referencia)}</small>
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
      { label: 'Credito total', value: money(data.metrics.creditoTotal), help: 'Valor de referencia da operacao.' },
      { label: 'Caixa liquida', value: money(data.metrics.caixaLiquida), help: 'Credito estimado apos lance embutido.' },
      { label: 'Parcela atual', value: money(data.metrics.parcelaAtual), help: 'Compromisso mensal projetado.' },
      { label: 'Prazo restante', value: `${number(data.metrics.prazoRestante)} meses`, help: 'Horizonte apos contemplacao.' }
    ];
    const secondary = [
      { label: 'Total do plano', value: money(data.metrics.totalPlano), help: 'Carta, taxas e componentes.' },
      { label: 'Total pago', value: money(data.metrics.totalPago), help: 'Projecao ate encerramento.' },
      { label: 'Saldo devedor', value: money(data.metrics.saldoDevedor), help: 'Saldo ao final da projecao.' },
      { label: 'Percorrido', value: percent(data.metrics.percentualPago), help: 'Avanco estimado da jornada.' }
    ];
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>01</span>
          <div><h3>Numeros estrategicos</h3><p>Os indicadores abaixo priorizam decisao, caixa e compromisso.</p></div>
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
          <div><h3>Jornada do cliente</h3><p>A proposta mostra o caminho entre adesao, lance, contemplacao e uso do credito.</p></div>
        </div>
        <div class="ps-journey">
          ${data.journey.map((step, idx) => `
            <article class="ps-journey-step ps-journey-step--${step.status}">
              <div class="ps-journey-step__index">${idx + 1}</div>
              <strong>${escapeHTML(step.label)}</strong>
              <span>${escapeHTML(step.value || step.date || '')}</span>
              <p>${escapeHTML(step.description || '')}</p>
            </article>
          `).join('')}
        </div>
        <aside class="ps-insight">
          <strong>Leitura executiva</strong>
          <p>A operacao esta estruturada para manter previsibilidade de parcela, reservar estrategia de lance e preparar o cliente para os marcos de documentacao e faturamento.</p>
        </aside>
      </section>
    `;
  }

  function renderProjectComposition(data) {
    const items = Array.isArray(data.projectItems) ? data.projectItems : [];
    const summary = data.projectSummary || {};
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>03</span>
          <div><h3>Composicao do projeto estruturado</h3><p>Detalha quais grupos, cotas e premissas formam a proposta apresentada.</p></div>
        </div>

        <div class="ps-project-summary">
          <article><span>Grupos</span><strong>${number(summary.totalGrupos || items.length)}</strong><small>fontes de credito combinadas</small></article>
          <article><span>Cotas</span><strong>${number(summary.totalCotas || 0)}</strong><small>quantidade total no projeto</small></article>
          <article><span>Carta consolidada</span><strong>${money(summary.valorCartaTotal || data.metrics.creditoTotal)}</strong><small>soma das cartas selecionadas</small></article>
          <article><span>Prazo medio</span><strong>${number(summary.prazoMedio || data.contributions.parcelasTotais)} meses</strong><small>ponderado pela carta</small></article>
        </div>

        ${items.length ? `
          <div class="ps-project-table-wrap">
            <table class="ps-project-table">
              <thead>
                <tr>
                  <th>Grupo</th>
                  <th>Administradora</th>
                  <th>Segmento</th>
                  <th>Cotas</th>
                  <th>Carta unit.</th>
                  <th>Carta total</th>
                  <th>Prazo</th>
                  <th>Taxa adm.</th>
                  <th>Lance</th>
                  <th>Papel</th>
                </tr>
              </thead>
              <tbody>
                ${items.map(item => `
                  <tr>
                    <td><strong>${escapeHTML(item.codigoGrupo)}</strong>${item.classificacao ? `<small>Classe ${escapeHTML(item.classificacao)}</small>` : ''}</td>
                    <td>${escapeHTML(item.administradora)}</td>
                    <td>${escapeHTML(item.segmento)}</td>
                    <td class="ps-project-table__center">${number(item.quantidadeCotas)}</td>
                    <td class="ps-project-table__num">${money(item.valorCartaUnitario)}</td>
                    <td class="ps-project-table__num ps-project-table__strong">${money(item.valorCartaTotal)}</td>
                    <td class="ps-project-table__center">${number(item.prazoMeses)} meses</td>
                    <td class="ps-project-table__center">${percent(item.taxaAdmPct)}</td>
                    <td class="ps-project-table__center">${percent(item.lanceProprioPct + item.lanceEmbutidoPct)}</td>
                    <td>${item.papel ? `<span class="ps-role-pill">${escapeHTML(item.papel)}</span>` : '-'}</td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>
        ` : `
          <div class="ps-empty-schedule">Nenhum grupo foi vinculado a esta proposta. Os totais foram calculados pelos parametros gerais da simulacao.</div>
        `}

        <aside class="ps-insight">
          <strong>Rastreabilidade comercial</strong>
          <p>Cada linha mostra a origem da carta, o peso financeiro e a funcao estrategica do grupo. Isso ajuda o cliente a entender que a proposta nao e um numero solto, mas uma composicao de grupos, cotas, prazos, taxas e lances.</p>
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
          <div><h3>Fases do produto e pontos de controle</h3><p>Traduz a operacao de consorcio em marcos claros para o cliente acompanhar.</p></div>
        </div>
        <div class="ps-phase-grid">
          ${phases.map((phase, index) => `
            <article class="ps-phase-card ps-phase-card--${phase.status}">
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
          <strong>Como ler esta jornada</strong>
          <p>O consorcio combina disciplina de pagamento, assembleias, possibilidade de lance, contemplacao e uso do credito. A proposta organiza esses marcos para reduzir incerteza e orientar as proximas decisoes.</p>
        </aside>
      </section>
    `;
  }

  function renderFinancialComposition(data) {
    const total = data.charts.composition.reduce((s, item) => s + item.value, 0) || 1;
    const chart = isChartEnabled(data, 'composition')
      ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'composition')}"></canvas></div>`
      : renderDisabledChart('Composicao financeira');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>05</span>
            <div><h3>Estrutura financeira</h3><p>Composicao do plano e leitura do que compoe o custo total.</p></div>
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
            <strong>O que isso significa</strong>
            <p>A carta representa o poder de compra. Taxa, fundo e seguro explicam o custo de manter a operacao dentro das regras do grupo.</p>
          </aside>
        </div>
      </section>
    `;
  }

  function renderContributionOverview(data) {
    const chart = isChartEnabled(data, 'installment')
      ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'installment')}"></canvas></div>`
      : renderDisabledChart('Evolucao das parcelas');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>06</span>
            <div><h3>Contribuicoes e parcelas</h3><p>Mostra o estagio atual de pagamento e a evolucao projetada da parcela.</p></div>
          </div>
          <div class="ps-progress">
            <div><strong>${number(data.contributions.parcelasPagas)}</strong><span>pagas</span></div>
            <div><strong>${number(data.contributions.parcelasRestantes)}</strong><span>restantes</span></div>
            <div><strong>${number(data.contributions.parcelasTotais)}</strong><span>total</span></div>
          </div>
          <div class="ps-progress-bar"><span style="width:${Math.min(100, data.metrics.percentualPago)}%"></span></div>
          <div class="ps-next-payment">
            <span>Proxima parcela</span>
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
      { label: 'Lance proprio', value: money(data.lances.lanceProprio), help: 'Recurso que sai do caixa do cliente.' },
      { label: 'Lance embutido', value: money(data.lances.lanceEmbutido), help: 'Valor que reduz o credito liquido.' },
      { label: 'Lance total', value: money(data.lances.lanceTotal), help: 'Forca total da oferta de contemplacao.' },
      { label: 'Credito liquido', value: money(data.metrics.caixaLiquida), help: 'Credito disponivel apos embutido.' }
    ];
    return `
      <section class="ps-section ps-print-page">
        <div class="ps-section__head">
          <span>07</span>
          <div><h3>Lance e estrategia de contemplacao</h3><p>Explica quanto e antecipado, quanto sai do bolso e o impacto no credito liquido.</p></div>
        </div>
        <div class="ps-kpi-grid">${cards.map(k => kpiCard(k)).join('')}</div>
        <div class="ps-section--split ps-section--nested">
          <aside class="ps-strategy">
            <strong>Estrategia sugerida</strong>
            <p>${escapeHTML(data.lances.estrategiaResumo)}</p>
            <ul>
              <li>Antecipacao total: ${money(data.lances.lanceTotal)}</li>
              <li>Impacto no credito liquido: ${money(data.lances.impactoCreditoLiquido)}</li>
              <li>Saldo apos lance: ${money(data.lances.impactoSaldoDevedor)}</li>
            </ul>
          </aside>
          ${isChartEnabled(data, 'bid')
            ? `<div class="ps-chart-card"><canvas id="${chartId(data, 'bid')}"></canvas></div>`
            : renderDisabledChart('Comparativo de lance e credito')}
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
        : renderDisabledChart('Projecao de parcelas')
    ].join('');
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>08</span>
            <div><h3>Projecoes da operacao</h3><p>Leitura futura do saldo devedor, parcelas e comportamento ate encerramento.</p></div>
          </div>
          <aside class="ps-insight">
            <strong>Interpretacao</strong>
            <p>A curva de saldo mostra o ritmo de amortizacao. A curva de parcelas indica o compromisso mensal projetado e ajuda a revisar capacidade de pagamento.</p>
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
            <div><h3>Cronograma mensal de parcelas</h3><p>A tabela detalhada sera exibida quando houver cronograma calculado.</p></div>
          </div>
          <div class="ps-empty-schedule">Calcule a simulacao para visualizar o fluxo mensal completo.</div>
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
            <p>Detalhamento mes a mes das parcelas, eventos da jornada, encargos, lances e saldo projetado.</p>
          </div>
        </div>

        <div class="ps-schedule-summary">
          <article><span>Meses projetados</span><strong>${number(rows.length)}</strong><small>Visao completa para PDF</small></article>
          <article><span>Total de parcelas</span><strong>${money(totalParcelas)}</strong><small>Soma do fluxo mensal</small></article>
          <article><span>Maior parcela</span><strong>${money(maiorParcela)}</strong><small>Ponto de maior compromisso</small></article>
          <article><span>Eventos relevantes</span><strong>${number(eventosRelevantes)}</strong><small>Lances, reajustes ou marcos</small></article>
        </div>

        <div class="ps-schedule-table-wrap">
          <table class="ps-schedule-table">
            <thead>
              <tr>
                <th>Mes</th>
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
        <p class="ps-schedule-note">Na tela, a tabela fica rolavel para preservar leitura. No PDF, o cronograma completo e expandido e paginado automaticamente.</p>
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
          <div><h3>Conceitos para explicar ao cliente</h3><p>Blocos educativos selecionados pelo consultor para dar contexto antes da decisao final.</p></div>
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
          <div><h3>Memoria de calculo explicada</h3><p>Formulas e leituras comerciais escolhidas para sustentar a proposta final.</p></div>
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
    const planItems = [
      ['header', 'Capa da proposta'],
      ['executive', 'Resumo executivo'],
      ['decision', 'Decisao final'],
      ['journey', 'Jornada da operacao'],
      ['project', 'Composicao do projeto'],
      ['productPhases', 'Fases do produto'],
      ['financialComposition', 'Estrutura financeira'],
      ['bidStrategy', 'Estrategia de contemplacao'],
      ['projection', 'Projecoes'],
      ['schedule', 'Cronograma mensal'],
      ['concepts', 'Conceitos educativos'],
      ['formulas', 'Memoria de calculo'],
      ['nextSteps', 'Proximos passos'],
      ['disclaimer', 'Premissas finais']
    ].filter(([key]) => key === 'nextSteps' || isSectionEnabled(data, key)).map(([, label]) => label);
    const builder = data.builder || proposalBuilderDefaults;
    const selectionFacts = [
      ['Blocos', countEnabledFlags(builder.sections), Object.keys(builder.sections || {}).length],
      ['Graficos', countEnabledFlags(builder.charts), Object.keys(builder.charts || {}).length],
      ['Conceitos', countEnabledFlags(builder.concepts), Object.keys(builder.concepts || {}).length],
      ['Formulas', countEnabledFlags(builder.formulas), Object.keys(builder.formulas || {}).length]
    ];
    return `
      <section class="ps-section ps-section--split ps-print-page">
        <div>
          <div class="ps-section__head">
            <span>10</span>
            <div><h3>Decisao e proximos passos</h3><p>Transforma a proposta em uma sequencia operacional para consultor e cliente.</p></div>
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
          <h4>Estrutura selecionada na lousa</h4>
          <div class="ps-pdf-plan__facts" data-proposal-selection-summary>
            ${selectionFacts.map(([label, selected, total]) => `
              <article><span>${escapeHTML(label)}</span><strong>${number(selected)} de ${number(total)}</strong></article>
            `).join('')}
          </div>
          ${planItems.map((item, i) => `
            <div><span>${i + 1}</span><strong>${escapeHTML(item)}</strong></div>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderAcceptance(data) {
    const acceptance = data.acceptance || normalizeAcceptance(null, data);
    const checks = [
      { key: 'premissas', title: 'Premissas financeiras', body: 'Carta, prazo, taxa, fundo, lance e cronograma foram conferidos.' },
      { key: 'cliente', title: 'Contexto do cliente', body: 'Objetivo, capacidade de pagamento e narrativa comercial foram revisados.' },
      { key: 'documentacao', title: 'Documentacao e handoff', body: 'Proximos documentos e encaminhamento consultivo estao mapeados.' }
    ];
    const versionLabel = acceptance.version ? `Versao ${number(acceptance.version, 0)}` : 'Sem versao registrada';
    const updatedLabel = acceptance.updatedAt ? formatDate(acceptance.updatedAt) : 'Aguardando registro';

    return `
      <section class="ps-section ps-section--acceptance ps-print-page">
        <div class="ps-section__head">
          <span>REV</span>
          <div><h3>Governanca e aceite local da proposta</h3><p>Registra a revisao operacional antes do envio, impressao ou handoff consultivo.</p></div>
        </div>
        <div class="ps-acceptance-grid">
          <article><span>Status</span><strong>${escapeHTML(acceptance.statusLabel)}</strong><small>${escapeHTML(versionLabel)}</small></article>
          <article><span>Responsavel</span><strong>${escapeHTML(acceptance.reviewer)}</strong><small>${escapeHTML(acceptance.reviewerRole)}</small></article>
          <article><span>Validade</span><strong>${escapeHTML(formatDate(acceptance.validUntil))}</strong><small>Registro atualizado em ${escapeHTML(updatedLabel)}</small></article>
          <article><span>Proposta</span><strong>${escapeHTML(acceptance.proposalId)}</strong><small>Mesmo identificador do preview e do PDF</small></article>
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
          <strong>Observacao da revisao</strong>
          <p>${escapeHTML(acceptance.notes)}</p>
        </div>
      </section>
    `;
  }

  function renderDisclaimer(data) {
    return `
      <footer class="ps-footer ps-print-page">
        <div>
          <strong>Premissas e observacoes</strong>
          <ul>${data.disclaimers.map(item => `<li>${escapeHTML(item)}</li>`).join('')}</ul>
        </div>
        <div class="ps-footer__meta">
          <span>Gerado em ${formatDate(data.generatedAt)}</span>
          <span>Versao da simulacao: Bancus Fraternis ConsorcioPro v7</span>
          <span>Responsavel: ${escapeHTML(data.consultor)}</span>
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

    const mapped = payload && payload.resultado
      ? mapSimulationToProposal(payload)
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
    normalizeProposalBuilder,
    proposalBuilderDefaults
  };
})();
