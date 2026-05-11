/**
 * Proposal builder service
 * Centralizes the proposal export board rules used by the simulator.
 */
(function (global) {
  'use strict';

  const STORAGE_KEY = 'bank_fratern_proposal_builder_v1';

  const fallbackDefaults = {
    sections: {
      header: true,
      executive: true,
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

  const optionGroups = [
    {
      key: 'sections',
      title: 'Blocos da proposta',
      description: 'Escolha quais paginas e narrativas entram no preview e no PDF final.',
      options: [
        { key: 'header', label: 'Capa e identificacao', help: 'Cliente, grupo, cota, status e acao de exportacao.' },
        { key: 'executive', label: 'Mapa executivo', help: 'Blocos que conectam decisao, caixa, lance e risco.' },
        { key: 'kpis', label: 'Numeros estrategicos', help: 'Credito, parcela, prazo, saldo, total e percentual percorrido.' },
        { key: 'journey', label: 'Jornada do cliente', help: 'Adesao, assembleias, lance, contemplacao e uso do credito.' },
        { key: 'project', label: 'Composicao do projeto', help: 'Grupos, cotas, administradoras, cartas, taxas e papeis.' },
        { key: 'productPhases', label: 'Fases do produto', help: 'Pontos de controle comerciais e operacionais do consorcio.' },
        { key: 'financialComposition', label: 'Estrutura financeira', help: 'Carta, taxa, fundo, seguro e composicao do plano.' },
        { key: 'contributionOverview', label: 'Contribuicoes e parcelas', help: 'Parcelas pagas, restantes e proxima parcela.' },
        { key: 'bidStrategy', label: 'Lance e contemplacao', help: 'Lance proprio, embutido, total e credito liquido.' },
        { key: 'projection', label: 'Projecoes', help: 'Saldo devedor, parcelas e leitura de comportamento futuro.' },
        { key: 'schedule', label: 'Cronograma mensal', help: 'Tabela mes a mes para propostas completas.' },
        { key: 'concepts', label: 'Conceitos educativos', help: 'Glossario comercial selecionado para o cliente.' },
        { key: 'formulas', label: 'Memoria de calculo', help: 'Formulas e explicacoes de calculo da proposta.' },
        { key: 'nextSteps', label: 'Proximos passos', help: 'Sequencia operacional para decisao e continuidade.' },
        { key: 'acceptance', label: 'Governanca e aceite', help: 'Registro de revisao local e validade da proposta.' },
        { key: 'disclaimer', label: 'Premissas finais', help: 'Observacoes e limites formais da simulacao.' }
      ]
    },
    {
      key: 'charts',
      title: 'Graficos disponiveis',
      description: 'Controle os graficos que aparecem dentro dos blocos selecionados.',
      options: [
        { key: 'composition', label: 'Composicao financeira', help: 'Grafico de carta, taxa, fundo e seguro.' },
        { key: 'installment', label: 'Evolucao das parcelas', help: 'Linha projetada da parcela ao longo do tempo.' },
        { key: 'bid', label: 'Lance versus credito', help: 'Comparativo entre lance total, credito liquido e saldo.' },
        { key: 'debt', label: 'Saldo devedor', help: 'Curva de amortizacao e saldo futuro.' },
        { key: 'installmentProjection', label: 'Projecao de parcelas', help: 'Barras de parcelas projetadas por periodo.' }
      ]
    },
    {
      key: 'concepts',
      title: 'Conceitos para cliente',
      description: 'Selecione os conceitos que devem acompanhar a proposta final.',
      options: [
        { key: 'consorcio', label: 'Consorcio', help: 'Modelo de compra planejada em grupo.' },
        { key: 'cartaCredito', label: 'Carta de credito', help: 'Poder de compra contratado.' },
        { key: 'grupoCota', label: 'Grupo e cota', help: 'Origem operacional da proposta.' },
        { key: 'assembleia', label: 'Assembleia', help: 'Evento de sorteio, lance e acompanhamento.' },
        { key: 'lanceProprio', label: 'Lance proprio', help: 'Recurso direto do cliente.' },
        { key: 'lanceEmbutido', label: 'Lance embutido', help: 'Uso de parte da carta como lance.' },
        { key: 'contemplacao', label: 'Contemplacao', help: 'Marco de acesso ao credito.' },
        { key: 'fundoReserva', label: 'Fundo de reserva', help: 'Protecao financeira do grupo.' },
        { key: 'taxaAdministracao', label: 'Taxa de administracao', help: 'Custo de administracao do plano.' },
        { key: 'saldoDevedor', label: 'Saldo devedor', help: 'Compromisso pendente projetado.' },
        { key: 'reajuste', label: 'Reajuste', help: 'Atualizacao por indice e regras do grupo.' },
        { key: 'seguro', label: 'Seguro', help: 'Protecao prevista conforme produto.' }
      ]
    },
    {
      key: 'formulas',
      title: 'Formulas explicadas',
      description: 'Inclua a memoria de calculo que sustenta a conversa comercial.',
      options: [
        { key: 'parcelaTotal', label: 'Parcela total', help: 'Soma dos componentes mensais.' },
        { key: 'parcelaBase', label: 'Parcela base', help: 'Carta dividida pelo prazo.' },
        { key: 'taxaAdministracao', label: 'Taxa administrativa', help: 'Carta multiplicada pela taxa total.' },
        { key: 'fundoReserva', label: 'Fundo de reserva', help: 'Carta multiplicada pelo percentual de fundo.' },
        { key: 'lanceTotal', label: 'Lance total', help: 'Lance proprio mais embutido.' },
        { key: 'cartaLiquida', label: 'Carta liquida', help: 'Carta menos lance embutido.' },
        { key: 'saldoDevedor', label: 'Saldo devedor', help: 'Saldo apos pagamentos, lances e eventos.' },
        { key: 'percentualPago', label: 'Percentual percorrido', help: 'Parcelas pagas sobre parcelas totais.' }
      ]
    }
  ];

  const chartSections = {
    composition: 'financialComposition',
    installment: 'contributionOverview',
    bid: 'bidStrategy',
    debt: 'projection',
    installmentProjection: 'projection'
  };

  const sectionWeights = {
    header: 0.6,
    executive: 0.8,
    kpis: 0.8,
    journey: 0.8,
    project: 1.1,
    productPhases: 0.8,
    financialComposition: 0.9,
    contributionOverview: 0.9,
    bidStrategy: 0.9,
    projection: 1.1,
    schedule: 2.2,
    concepts: 1.1,
    formulas: 1.1,
    nextSteps: 0.8,
    acceptance: 0.8,
    disclaimer: 0.4
  };

  function proposalSummaryService() {
    return typeof ProposalSummary !== 'undefined' ? ProposalSummary : global.ProposalSummary;
  }

  function clone(value) {
    return JSON.parse(JSON.stringify(value || {}));
  }

  function defaultConfig() {
    const summary = proposalSummaryService();
    const defaults = summary && summary.proposalBuilderDefaults
      ? summary.proposalBuilderDefaults
      : fallbackDefaults;
    return clone(defaults);
  }

  function normalizeConfig(value) {
    const summary = proposalSummaryService();
    if (summary && typeof summary.normalizeProposalBuilder === 'function') {
      return summary.normalizeProposalBuilder(value);
    }
    const defaults = defaultConfig();
    const source = value && typeof value === 'object' ? value : {};
    const merge = (group) => Object.keys(defaults[group] || {}).reduce((acc, key) => {
      acc[key] = source[group] && source[group][key] === false ? false : true;
      return acc;
    }, {});
    return {
      sections: merge('sections'),
      charts: merge('charts'),
      concepts: merge('concepts'),
      formulas: merge('formulas')
    };
  }

  function getConfig(storage = global.localStorage) {
    try {
      const raw = storage && storage.getItem ? storage.getItem(STORAGE_KEY) : '';
      return normalizeConfig(raw ? JSON.parse(raw) : null);
    } catch (e) {
      return normalizeConfig(null);
    }
  }

  function saveConfig(config, storage = global.localStorage) {
    const normalized = normalizeConfig(config);
    try {
      if (storage && storage.setItem) storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
    } catch (e) {
      if (global.console && global.console.warn) {
        global.console.warn('Nao foi possivel salvar a lousa da proposta.', e);
      }
    }
    return normalized;
  }

  function presetConfig(preset = 'completa') {
    const config = defaultConfig();
    const setAll = (group, value) => {
      Object.keys(config[group] || {}).forEach((key) => { config[group][key] = value; });
    };

    if (preset === 'consultiva') {
      config.sections.schedule = false;
      setAll('concepts', false);
      setAll('formulas', false);
      ['consorcio', 'cartaCredito', 'lanceProprio', 'lanceEmbutido', 'contemplacao', 'taxaAdministracao', 'saldoDevedor'].forEach((key) => { config.concepts[key] = true; });
      ['parcelaTotal', 'lanceTotal', 'cartaLiquida', 'saldoDevedor'].forEach((key) => { config.formulas[key] = true; });
      return config;
    }

    if (preset === 'executiva') {
      ['project', 'productPhases', 'schedule', 'concepts', 'formulas'].forEach((key) => { config.sections[key] = false; });
      setAll('concepts', false);
      setAll('formulas', false);
      config.charts.installment = false;
      return config;
    }

    if (preset === 'educativa') {
      config.sections.schedule = false;
      config.sections.acceptance = false;
      return config;
    }

    if (preset === 'tecnica') {
      setAll('sections', false);
      ['header', 'kpis', 'project', 'productPhases', 'financialComposition', 'contributionOverview', 'projection', 'schedule', 'formulas', 'nextSteps', 'acceptance', 'disclaimer'].forEach((key) => { config.sections[key] = true; });
      setAll('concepts', false);
      config.charts.bid = false;
      config.sections.concepts = false;
      return config;
    }

    if (preset === 'compacta') {
      setAll('sections', false);
      setAll('charts', false);
      setAll('concepts', false);
      setAll('formulas', false);
      ['header', 'kpis', 'financialComposition', 'bidStrategy', 'projection', 'nextSteps', 'disclaimer'].forEach((key) => { config.sections[key] = true; });
      ['composition', 'bid', 'debt'].forEach((key) => { config.charts[key] = true; });
      return config;
    }

    return config;
  }

  function countEnabledFlags(group) {
    return Object.values(group || {}).filter(Boolean).length;
  }

  function pageEstimate(config) {
    const current = normalizeConfig(config);
    const total = Object.entries(sectionWeights).reduce((sum, [key, weight]) => {
      return sum + (current.sections && current.sections[key] !== false ? weight : 0);
    }, 0);
    return Math.max(1, Math.ceil(total));
  }

  function readinessIssues(config) {
    const current = normalizeConfig(config);
    const issues = [];
    if (!current.sections.header) issues.push('Capa desativada.');
    if (!current.sections.kpis) issues.push('Numeros estrategicos desativados.');
    if (!current.sections.nextSteps) issues.push('Proximos passos desativados.');
    if (!current.sections.disclaimer) issues.push('Premissas finais desativadas.');
    if (current.sections.concepts && countEnabledFlags(current.concepts) === 0) issues.push('Bloco de conceitos ativo sem conceitos selecionados.');
    if (current.sections.formulas && countEnabledFlags(current.formulas) === 0) issues.push('Memoria de calculo ativa sem formulas selecionadas.');
    if (countEnabledFlags(current.sections) === 0) issues.push('Nenhum bloco selecionado para exportacao.');
    return issues;
  }

  function focusLabel(config) {
    const current = normalizeConfig(config);
    if (current.sections.schedule && current.sections.formulas && !current.sections.concepts) return 'Tecnica';
    if (!current.sections.schedule && current.sections.concepts && current.sections.formulas) return 'Consultiva';
    if (!current.sections.concepts && !current.sections.formulas && !current.sections.schedule) return 'Executiva';
    if (current.sections.concepts && current.sections.formulas && !current.sections.acceptance) return 'Educativa';
    if (countEnabledFlags(current.sections) <= 7) return 'Compacta';
    return 'Completa';
  }

  function syncDependencies(config, group, key, checked) {
    if (!config || !checked) return config;
    if (!config.sections) config.sections = {};
    if (group === 'concepts') config.sections.concepts = true;
    if (group === 'formulas') config.sections.formulas = true;
    if (group === 'charts' && chartSections[key]) {
      config.sections[chartSections[key]] = true;
    }
    return config;
  }

  function selectionCounts(config) {
    const current = normalizeConfig(config);
    return {
      sections: countEnabledFlags(current.sections),
      sectionsTotal: Object.keys(current.sections || {}).length,
      charts: countEnabledFlags(current.charts),
      chartsTotal: Object.keys(current.charts || {}).length,
      concepts: countEnabledFlags(current.concepts),
      conceptsTotal: Object.keys(current.concepts || {}).length,
      formulas: countEnabledFlags(current.formulas),
      formulasTotal: Object.keys(current.formulas || {}).length
    };
  }

  global.BFProposalBuilder = {
    STORAGE_KEY,
    defaultConfig,
    normalizeConfig,
    getConfig,
    saveConfig,
    optionGroups: () => clone(optionGroups),
    presetConfig,
    countEnabledFlags,
    pageEstimate,
    readinessIssues,
    focusLabel,
    syncDependencies,
    selectionCounts,
    chartSections: () => ({ ...chartSections }),
    sectionWeights: () => ({ ...sectionWeights })
  };
})(typeof window !== 'undefined' ? window : globalThis);
