/**
 * Simulator result service.
 * Keeps calculation orchestration and result/proposal rendering helpers outside App.
 */
(function (global) {
  'use strict';

  function money(value, helpers = {}) {
    if (helpers.formatMoney) return helpers.formatMoney(value);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function resultMessages(result) {
    if (result && Array.isArray(result.mensagens) && result.mensagens.length) return result.mensagens;
    return ['Nao foi possivel calcular a simulacao.'];
  }

  function safeNumber(value, fallback = 0) {
    const number = Number(value);
    return Number.isFinite(number) ? number : fallback;
  }

  function roundMoney(value) {
    return Math.round((safeNumber(value) + Number.EPSILON) * 100) / 100;
  }

  function toCents(value) {
    return Math.round(safeNumber(value) * 100);
  }

  function projectItemCredit(item) {
    const quantity = Math.max(1, Math.trunc(safeNumber(item && item.quantidadeCotas, 1)) || 1);
    const declaredTotal = safeNumber(item && item.valorCartaTotal, NaN);
    if (Number.isFinite(declaredTotal) && declaredTotal > 0) return declaredTotal;
    return quantity * safeNumber(item && item.valorCartaUnitario, 0);
  }

  function validateProjectResult(result, project) {
    const requestedItems = project && Array.isArray(project.itens) ? project.itens : [];
    if (!requestedItems.length) return { reconciled: true, errors: [], groupsRequested: 0, groupsCalculated: 0 };

    const errors = [];
    const diagnostics = result && result.diagnostics ? result.diagnostics : {};
    const calculatedItems = result && Array.isArray(result.projectItems) ? result.projectItems : [];
    const schedule = result && Array.isArray(result.cronograma) ? result.cronograma : [];
    const summary = result && result.resumo ? result.resumo : {};
    const expectedCredit = roundMoney(requestedItems.reduce((sum, item) => sum + projectItemCredit(item), 0));
    const actualCredit = roundMoney(summary.valorCarta);
    const groupsRequested = requestedItems.length;
    const groupsCalculated = calculatedItems.length;

    if (groupsCalculated !== groupsRequested) {
      errors.push(`Foram calculados ${groupsCalculated} de ${groupsRequested} grupos selecionados.`);
    }
    if (Number(diagnostics.groupsCalculated) !== groupsCalculated
      || Number(diagnostics.groupsRequested) !== groupsRequested) {
      errors.push('A contagem de grupos do diagnóstico não corresponde ao projeto.');
    }
    if (toCents(actualCredit) !== toCents(expectedCredit)) {
      errors.push('O crédito consolidado não corresponde à soma das cartas selecionadas.');
    }
    if (!schedule.length) errors.push('O cronograma agregado do projeto está vazio.');
    if (schedule.length && safeNumber(summary.prazoTotal) !== schedule.length) {
      errors.push('O prazo consolidado não corresponde ao cronograma agregado.');
    }
    if (schedule.some(row => Object.values(row || {}).some(value => (
      typeof value === 'number' && !Number.isFinite(value)
    )))) {
      errors.push('O cronograma agregado contém valor não finito.');
    }

    const expectedKeys = requestedItems.map(item => String(item && (item.itemId || item.groupKey) || '')).filter(Boolean).sort();
    const actualKeys = calculatedItems.map(item => String(item && (item.itemId || item.groupKey) || '')).filter(Boolean).sort();
    if (expectedKeys.length === groupsRequested
      && (actualKeys.length !== expectedKeys.length || actualKeys.some((key, index) => key !== expectedKeys[index]))) {
      errors.push('Os grupos calculados não correspondem aos grupos selecionados.');
    }

    return {
      reconciled: diagnostics.reconciled === true && errors.length === 0,
      errors,
      groupsRequested,
      groupsCalculated,
      expectedCredit,
      actualCredit
    };
  }

  function resolveSimulationDiagnostics(simulation) {
    if (simulation && simulation.diagnostics) return simulation.diagnostics;
    const audit = simulation && simulation.auditoria ? simulation.auditoria : {};
    const monthly = audit.invariantes || {};
    const global = audit.reconciliacao || {};
    const errors = [
      ...(Array.isArray(monthly.mensagens) ? monthly.mensagens : []),
      ...(Array.isArray(global.mensagens) ? global.mensagens : [])
    ];
    return {
      reconciled: monthly.valido === true && global.valido === true && errors.length === 0,
      errors,
      warnings: []
    };
  }

  function buildProjectResult(projectSimulation, project) {
    const source = projectSimulation && projectSimulation.consolidado;
    const allItems = projectSimulation && Array.isArray(projectSimulation.itemResults)
      ? projectSimulation.itemResults.filter(Boolean)
      : [];
    const items = allItems.length
      ? allItems.filter(item => !item.erro)
      : [];
    if (!source || !items.length) return null;

    const cronograma = Array.isArray(source.cronograma) ? source.cronograma : [];
    const first = cronograma[0] || {};
    const contemplationMonths = items
      .map(item => safeNumber(item.item && item.item.mesContemplacaoAlvo, 0))
      .filter(value => value > 0);
    const itemDiagnostics = items.map(item => resolveSimulationDiagnostics(item.simulation));
    const requestedItems = project && Array.isArray(project.itens) ? project.itens : [];
    const requestedCount = requestedItems.length || allItems.length;
    const expectedCredit = roundMoney(requestedItems.reduce((sum, item) => sum + projectItemCredit(item), 0));
    const diagnosticErrors = itemDiagnostics.flatMap(item => Array.isArray(item.errors) ? item.errors : []);
    const projectErrors = Array.isArray(projectSimulation && projectSimulation.mensagens)
      ? projectSimulation.mensagens.filter(Boolean)
      : [];
    if (allItems.length !== requestedCount || items.length !== requestedCount) {
      projectErrors.push(`Foram calculados ${items.length} de ${requestedCount} grupos selecionados.`);
    }
    if (requestedCount > 0 && toCents(source.totalCarta) !== toCents(expectedCredit)) {
      projectErrors.push('O crédito consolidado não corresponde à soma das cartas selecionadas.');
    }
    const finiteSchedule = cronograma.every(row => Object.values(row || {}).every(value => (
      typeof value !== 'number' || Number.isFinite(value)
    )));
    const reconciled = items.length === requestedCount
      && itemDiagnostics.length === items.length
      && itemDiagnostics.every(item => item.reconciled === true)
      && finiteSchedule
      && diagnosticErrors.length === 0
      && projectErrors.length === 0;
    const totalPlano = roundMoney(safeNumber(source.totalCarta)
      + safeNumber(source.totalTaxaAdm)
      + safeNumber(source.totalFundoReserva)
      + safeNumber(source.totalSeguro));

    const result = {
      erro: !reconciled,
      mensagens: Array.from(new Set([...projectErrors, ...diagnosticErrors])),
      engineVersion: items[0]?.simulation?.engineVersion
        || items[0]?.simulation?.contrato?.version
        || '2.0.0',
      diagnostics: {
        reconciled,
        errors: Array.from(new Set([...projectErrors, ...diagnosticErrors])),
        warnings: itemDiagnostics.flatMap(item => Array.isArray(item.warnings) ? item.warnings : []),
        groupsCalculated: items.length,
        groupsRequested: requestedCount,
        finiteSchedule
      },
      projectItems: items.map(item => ({
        itemId: item.item && item.item.itemId,
        groupKey: item.item && item.item.groupKey,
        codigoGrupo: item.item && item.item.codigoGrupo,
        quantidadeCotas: item.item && item.item.quantidadeCotas,
        result: item.simulation
      })),
      resumo: {
        valorCarta: roundMoney(source.totalCarta),
        valorTotalPlano: totalPlano,
        taxaAdmTotal: roundMoney(source.totalTaxaAdm),
        taxaAdmPercentual: safeNumber(source.taxaAdmMedia),
        fundoReservaTotal: roundMoney(source.totalFundoReserva),
        fundoReservaPercentual: 0,
        seguroTotal: roundMoney(source.totalSeguro),
        saldoInicial: roundMoney(source.totalSaldoInicial || source.totalCarta),
        parcelaBase: roundMoney(first.parcelaBase),
        parcelaTotalAtual: roundMoney(Number.isFinite(Number(first.parcelaTotal))
          ? first.parcelaTotal
          : source.parcelaInicialTotal),
        lanceProprio: roundMoney(source.totalLanceProprioR),
        lanceEmbutido: roundMoney(source.totalLanceEmbutidoR),
        lanceFGTS: roundMoney(items.reduce((sum, item) => sum + safeNumber(item.resumo && item.resumo.lanceFGTS) * safeNumber(item.item && item.item.quantidadeCotas, 1), 0)),
        lanceTotal: roundMoney(source.totalLanceR),
        cartaLiquida: roundMoney(source.cartaLiquida),
        prazoTotal: safeNumber(source.maxPrazo || cronograma.length),
        prazoRestante: Math.max(0, ...items.map(item => safeNumber(item.resumo && item.resumo.prazoRestante, 0))),
        custoTotal: roundMoney(source.totalCusto),
        totalPagoAteContemplacao: roundMoney(source.totalAteContemplacao),
        totalPago: roundMoney(source.totalPago),
        mesContemplacao: contemplationMonths.length ? Math.min(...contemplationMonths) : 0,
        contemplationMonths,
        cronograma
      },
      cronograma
    };
    const integrity = validateProjectResult(result, project);
    if (!integrity.reconciled) {
      result.erro = true;
      result.mensagens = Array.from(new Set([...result.mensagens, ...integrity.errors]));
      result.diagnostics.reconciled = false;
      result.diagnostics.errors = Array.from(new Set([...result.diagnostics.errors, ...integrity.errors]));
    }
    return result;
  }

  function calculate(params, options = {}) {
    const engine = options.engine || global.ConsorcioEngine;
    if (!engine || typeof engine.simular !== 'function') {
      return {
        ok: false,
        resultado: null,
        cenarios: null,
        mensagens: ['Motor de calculo indisponivel.']
      };
    }

    const project = options.project;
    const hasProject = project && Array.isArray(project.itens) && project.itens.length > 0;
    let projectSimulation = options.projectSimulation;
    if (hasProject && (!projectSimulation || !projectSimulation.consolidado)
      && options.shelfEngine && typeof options.shelfEngine.simulateStructuredProject === 'function') {
      projectSimulation = options.shelfEngine.simulateStructuredProject(project, params);
    }
    const resultado = hasProject ? buildProjectResult(projectSimulation, project) : engine.simular(params);
    if (!resultado || resultado.erro) {
      return {
        ok: false,
        resultado: null,
        cenarios: null,
        mensagens: resultMessages(resultado)
      };
    }

    return {
      ok: true,
      resultado,
      cenarios: !hasProject && typeof engine.compararCenarios === 'function'
        ? engine.compararCenarios(params)
        : null,
      mensagens: []
    };
  }

  function fallbackSummaryHtml() {
    return `
      <div class="card text-center" style="padding:48px 24px;">
        <h3>Resumo indisponivel</h3>
        <p class="text-muted">O modulo de proposta estruturada nao foi carregado.</p>
      </div>
    `;
  }

  function proposalSummary() {
    if (global.ProposalSummary) return global.ProposalSummary;
    if (typeof ProposalSummary !== 'undefined') return ProposalSummary;
    return null;
  }

  function resultContextPayload(context = {}) {
    return {
      params: context.params,
      resultado: context.resultado,
      cenarios: context.cenarios,
      project: context.project,
      decisionContext: context.decisionContext,
      acceptance: context.acceptance,
      builder: context.builder
    };
  }

  function renderSummary(container, context = {}, options = {}) {
    if (!container || !context.resultado) return false;
    const summary = proposalSummary();
    if (summary && typeof summary.render === 'function') {
      summary.render(container, resultContextPayload(context), options);
      return true;
    }
    container.innerHTML = fallbackSummaryHtml();
    return false;
  }

  function renderProposal(container, context = {}, options = {}, helpers = {}) {
    if (!container || !context.resultado || !context.params) return false;
    const summary = proposalSummary();
    if (summary && typeof summary.render === 'function') {
      summary.render(container, resultContextPayload(context), options);
      return true;
    }
    const exporter = helpers.exportManager || global.ExportManager;
    if (exporter && typeof exporter.gerarHTMLProposta === 'function') {
      container.innerHTML = exporter.gerarHTMLProposta(context.params, context.resultado);
      return true;
    }
    container.innerHTML = fallbackSummaryHtml();
    return false;
  }

  function badgeClass(evento) {
    const text = String(evento || '').toLowerCase();
    if (text.includes('ades')) return 'badge--adesao';
    if (text.includes('anivers')) return 'badge--aniversario';
    if (text.includes('contempla')) return 'badge--contemplacao';
    if (text.includes('adiant')) return 'badge--adiantamento';
    if (text.includes('inadimpl')) return 'badge--inadimplencia';
    if (text.includes('regulariza')) return 'badge--adesao';
    return 'badge--normal';
  }

  function renderAnalyticalRows(cronograma, helpers = {}, showDetailed = false) {
    const displayVal = showDetailed ? '' : 'none';
    const rows = Array.isArray(cronograma) ? cronograma : [];
    return rows.map((month) => {
      const detailedCols = `
        <td class="text-right col-detail-cell" style="display:${displayVal}">${money(month.saldoAnterior, helpers)}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${month.indiceAplicado > 0 ? (month.indiceAplicado * 100).toFixed(2) + '%' : '-'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${money(month.saldoAjustado, helpers)}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${month.valorLance > 0 ? money(month.valorLance, helpers) : '-'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${month.valorAdiantado > 0 ? money(month.valorAdiantado, helpers) : '-'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${month.multa > 0 ? money(month.multa, helpers) : '-'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${month.juros > 0 ? money(month.juros, helpers) : '-'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${money(month.saldoFinal, helpers)}</td>
        <td class="text-center col-detail-cell" style="display:${displayVal}">${month.prazoRestante || 0}</td>
      `;

      return `<tr>
        <td class="text-center">${month.mes || 0}</td>
        <td class="text-right">${money(month.parcelaTotal, helpers)}</td>
        ${detailedCols}
        <td class="text-center"><span class="badge ${badgeClass(month.evento)}">${month.evento || 'normal'}</span></td>
      </tr>`;
    }).join('');
  }

  function renderAnalyticalTable(root, context = {}, helpers = {}) {
    if (!context.resultado) return false;
    const doc = root && typeof root.getElementById === 'function' ? root : global.document;
    if (!doc) return false;
    const tbody = doc.getElementById('tabela-body');
    if (!tbody) return false;
    const showDetailed = typeof context.showDetailed === 'boolean'
      ? context.showDetailed
      : Boolean(doc.getElementById('tabelaDetalhada') && doc.getElementById('tabelaDetalhada').checked);
    const displayVal = showDetailed ? '' : 'none';

    if (typeof doc.querySelectorAll === 'function') {
      doc.querySelectorAll('.col-detail').forEach((el) => { el.style.display = displayVal; });
    }
    tbody.innerHTML = renderAnalyticalRows(context.resultado.cronograma, helpers, showDetailed);
    return true;
  }

  global.BFSimulatorResult = {
    calculate,
    buildProjectResult,
    validateProjectResult,
    renderSummary,
    renderProposal,
    renderAnalyticalRows,
    renderAnalyticalTable,
    badgeClass
  };
})(typeof window !== 'undefined' ? window : this);
