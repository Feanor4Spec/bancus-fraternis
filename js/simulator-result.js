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

    const resultado = engine.simular(params);
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
      cenarios: typeof engine.compararCenarios === 'function'
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
    renderSummary,
    renderProposal,
    renderAnalyticalRows,
    renderAnalyticalTable,
    badgeClass
  };
})(typeof window !== 'undefined' ? window : this);
