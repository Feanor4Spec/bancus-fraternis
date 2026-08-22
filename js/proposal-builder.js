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

  const optionGroups = [
    {
      key: 'sections',
      title: 'Seções da proposta',
      description: 'Escolha as páginas que devem aparecer no PDF.',
      options: [
        { key: 'header', label: 'Capa e identificação', help: 'Cliente, grupos, cotas e número da proposta.' },
        { key: 'executive', label: 'Visão geral', help: 'Crédito, parcela, lance e prazo em destaque.' },
        { key: 'decision', label: 'Pontos de atenção', help: 'Condições, riscos e itens que precisam de conferência.' },
        { key: 'kpis', label: 'Principais valores', help: 'Crédito, parcela, prazo, saldo e total projetado.' },
        { key: 'journey', label: 'Etapas do consórcio', help: 'Adesão, assembleias, lance, contemplação e uso do crédito.' },
        { key: 'project', label: 'Grupos e cotas', help: 'Administradoras, cartas, prazos e taxas selecionados.' },
        { key: 'productPhases', label: 'Etapas previstas', help: 'Adesão, assembleias, contemplação usada na simulação e encerramento.' },
        { key: 'financialComposition', label: 'Custos do plano', help: 'Carta, taxa de administração, fundo de reserva e seguro.' },
        { key: 'contributionOverview', label: 'Parcelas', help: 'Parcelas pagas, restantes e próxima parcela prevista.' },
        { key: 'bidStrategy', label: 'Lances', help: 'Lance próprio, embutido, total e crédito disponível.' },
        { key: 'projection', label: 'Evolução do saldo', help: 'Saldo devedor e parcelas ao longo do prazo.' },
        { key: 'schedule', label: 'Parcelas mês a mês', help: 'Tabela mensal com valores e eventos previstos.' },
        { key: 'concepts', label: 'Explicação dos termos', help: 'Definições de consórcio, carta, lance e demais termos.' },
        { key: 'formulas', label: 'Como os valores foram calculados', help: 'Fórmulas usadas nos principais valores da proposta.' },
        { key: 'nextSteps', label: 'Próximos passos', help: 'Conferências, documentos e contatos seguintes.' },
        { key: 'acceptance', label: 'Conferência e validade', help: 'Responsável pela revisão, data de validade e aceite.' },
        { key: 'disclaimer', label: 'Avisos importantes', help: 'Limites da simulação e condições que dependem do contrato.' }
      ]
    },
    {
      key: 'charts',
      title: 'Gráficos',
      description: 'Escolha os gráficos que devem aparecer no PDF.',
      options: [
        { key: 'composition', label: 'Composição financeira', help: 'Gráfico de carta, taxa, fundo e seguro.' },
        { key: 'installment', label: 'Evolução das parcelas', help: 'Linha projetada da parcela ao longo do tempo.' },
        { key: 'bid', label: 'Lance versus crédito', help: 'Comparativo entre lance total, crédito líquido e saldo.' },
        { key: 'debt', label: 'Saldo devedor', help: 'Curva de amortização e saldo futuro.' },
        { key: 'installmentProjection', label: 'Projeção de parcelas', help: 'Barras de parcelas projetadas por período.' }
      ]
    },
    {
      key: 'concepts',
      title: 'Termos explicados',
      description: 'Escolha os termos que precisam de explicação no PDF.',
      options: [
        { key: 'consorcio', label: 'Consórcio', help: 'Modelo de compra planejada em grupo.' },
        { key: 'cartaCredito', label: 'Carta de crédito', help: 'Poder de compra contratado.' },
        { key: 'grupoCota', label: 'Grupo e cota', help: 'Identificação da participação no consórcio.' },
        { key: 'assembleia', label: 'Assembleia', help: 'Evento de sorteio, lance e acompanhamento.' },
        { key: 'lanceProprio', label: 'Lance próprio', help: 'Recurso direto do cliente.' },
        { key: 'lanceEmbutido', label: 'Lance embutido', help: 'Uso de parte da carta como lance.' },
        { key: 'contemplacao', label: 'Contemplação', help: 'Marco de acesso ao crédito.' },
        { key: 'fundoReserva', label: 'Fundo de reserva', help: 'Proteção financeira do grupo.' },
        { key: 'taxaAdministracao', label: 'Taxa de administração', help: 'Custo de administração do plano.' },
        { key: 'saldoDevedor', label: 'Saldo devedor', help: 'Compromisso pendente projetado.' },
        { key: 'reajuste', label: 'Reajuste', help: 'Atualização por índice e regras do grupo.' },
        { key: 'seguro', label: 'Seguro', help: 'Proteção prevista conforme produto.' }
      ]
    },
    {
      key: 'formulas',
      title: 'Fórmulas explicadas',
      description: 'Inclua a explicação dos cálculos usados na proposta.',
      options: [
        { key: 'parcelaTotal', label: 'Parcela total', help: 'Soma dos componentes mensais.' },
        { key: 'parcelaBase', label: 'Parcela base', help: 'Carta dividida pelo prazo.' },
        { key: 'taxaAdministracao', label: 'Taxa administrativa', help: 'Carta multiplicada pela taxa total.' },
        { key: 'fundoReserva', label: 'Fundo de reserva', help: 'Carta multiplicada pelo percentual de fundo.' },
        { key: 'lanceTotal', label: 'Lance total', help: 'Lance próprio mais embutido.' },
        { key: 'cartaLiquida', label: 'Carta líquida', help: 'Carta menos lance embutido.' },
        { key: 'saldoDevedor', label: 'Saldo devedor', help: 'Saldo após pagamentos, lances e eventos.' },
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
    decision: 0.9,
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

  function currentOwnerEmail() {
    try {
      const user = global.BFAuth && global.BFAuth.getCurrentUser ? global.BFAuth.getCurrentUser() : null;
      return user && user.email ? user.email : 'anon';
    } catch (e) {
      return 'anon';
    }
  }

  function snapshotIdForOwner(owner) {
    return `SNP-PB-${String(owner || 'anon').replace(/[^A-Za-z0-9_-]/g, '_')}`;
  }

  function proposalIdForOwner(owner) {
    return `PB-${String(owner || 'anon').replace(/[^A-Za-z0-9_-]/g, '_')}`;
  }

  function publishBackendSnapshot(config) {
    try {
      const api = global.BFBackendApi;
      if (!api || typeof api.recordSnapshot !== 'function') return;
      const owner = currentOwnerEmail();
      const now = new Date().toISOString();
      const normalized = normalizeConfig(config);
      api.recordSnapshot('proposal-builder', {
        ...normalized,
        counts: selectionCounts(normalized),
        focus: focusLabel(normalized),
        pageEstimate: pageEstimate(normalized),
        updatedAt: now
      }, {
        id: snapshotIdForOwner(owner),
        source: 'proposal-builder',
        ownerEmail: owner === 'anon' ? '' : owner,
        actorEmail: owner === 'anon' ? '' : owner,
        entityId: owner,
        title: 'Lousa de proposta',
        status: focusLabel(normalized),
        storageKey: STORAGE_KEY,
        updatedAt: now
      }).catch(() => {});
    } catch (e) {
      // Lousa segue local quando a API progressiva nao esta ativa.
    }
  }

  function publishDirectProposal(config) {
    try {
      const api = global.BFBackendApi;
      if (!api || typeof api.saveProposal !== 'function') return;
      const owner = currentOwnerEmail();
      const now = new Date().toISOString();
      const normalized = normalizeConfig(config);
      const counts = selectionCounts(normalized);
      api.saveProposal({
        id: proposalIdForOwner(owner),
        ownerEmail: owner === 'anon' ? '' : owner,
        actorEmail: owner === 'anon' ? '' : owner,
        title: 'Lousa de proposta',
        status: focusLabel(normalized),
        stage: 'lousa',
        priority: readinessIssues(normalized).length ? 'alta' : 'media',
        source: 'proposal-builder',
        relatedId: '',
        amount: 0,
        payload: {
          ...normalized,
          counts,
          focus: focusLabel(normalized),
          pageEstimate: pageEstimate(normalized),
          updatedAt: now
        },
        updatedAt: now
      }).catch(() => {});
    } catch (e) {
      // Lousa direta e progressiva; configuracao local continua salva.
    }
  }

  function saveConfig(config, storage = global.localStorage) {
    const normalized = normalizeConfig(config);
    try {
      if (storage && storage.setItem) storage.setItem(STORAGE_KEY, JSON.stringify(normalized));
      publishBackendSnapshot(normalized);
      publishDirectProposal(normalized);
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
      ['header', 'decision', 'kpis', 'project', 'productPhases', 'financialComposition', 'contributionOverview', 'projection', 'schedule', 'formulas', 'nextSteps', 'acceptance', 'disclaimer'].forEach((key) => { config.sections[key] = true; });
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
      ['header', 'decision', 'kpis', 'financialComposition', 'bidStrategy', 'projection', 'nextSteps', 'disclaimer'].forEach((key) => { config.sections[key] = true; });
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
    if (!current.sections.decision) issues.push('Pontos de atenção desativados.');
    if (!current.sections.kpis) issues.push('Principais valores desativados.');
    if (!current.sections.nextSteps) issues.push('Próximos passos desativados.');
    if (!current.sections.disclaimer) issues.push('Avisos importantes desativados.');
    if (current.sections.concepts && countEnabledFlags(current.concepts) === 0) issues.push('Explicação de termos ativa sem nenhum termo selecionado.');
    if (current.sections.formulas && countEnabledFlags(current.formulas) === 0) issues.push('Explicação dos cálculos ativa sem nenhuma fórmula selecionada.');
    if (countEnabledFlags(current.sections) === 0) issues.push('Nenhuma seção selecionada para o PDF.');
    return issues;
  }

  function focusLabel(config) {
    const current = normalizeConfig(config);
    if (current.sections.schedule && current.sections.formulas && !current.sections.concepts) return 'Com cálculos';
    if (!current.sections.schedule && current.sections.concepts && current.sections.formulas) return 'Com explicações';
    if (!current.sections.concepts && !current.sections.formulas && !current.sections.schedule) return 'Resumo';
    if (current.sections.concepts && current.sections.formulas && !current.sections.acceptance) return 'Explicada';
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
