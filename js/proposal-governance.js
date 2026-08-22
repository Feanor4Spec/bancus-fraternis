/**
 * Proposal governance service
 * Renders versioning and local review panels used by the simulator proposal step.
 */
(function (global) {
  'use strict';

  function escapeText(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');
  }

  function formatMoney(value, helpers = {}) {
    if (helpers.formatMoney) return helpers.formatMoney(value);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function formatNumber(value, decimals = 1, helpers = {}) {
    if (helpers.formatNumber) return helpers.formatNumber(value, decimals);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function versionMetricValue(key, value, helpers = {}) {
    const n = Number(value || 0);
    if (key === 'percentualPago') return `${formatNumber(n, 1, helpers)}%`;
    if (key === 'prazo' || key === 'prazoRestante') return `${Math.round(n)} meses`;
    return formatMoney(n, helpers);
  }

  function versionBuilderLabel(builder) {
    const current = builder || {};
    return [
      `${Number(current.sections || 0)}/${Number(current.sectionsTotal || 0)} seções`,
      `${Number(current.charts || 0)}/${Number(current.chartsTotal || 0)} gráficos`,
      `${Number(current.concepts || 0)}/${Number(current.conceptsTotal || 0)} conceitos`,
      `${Number(current.formulas || 0)}/${Number(current.formulasTotal || 0)} fórmulas`
    ].join(' | ');
  }

  function renderVersionComparison(comparison, helpers = {}) {
    if (!comparison) {
      return '<p class="proposal-version-panel__muted">Salve ao menos duas versões para comparar as mudanças.</p>';
    }
    const metrics = (comparison.changedMetrics || []).slice(0, 4);
    const builder = comparison.changedBuilder || [];
    const status = comparison.statusChanged
      ? `<article><span>Status</span><strong>${escapeText(comparison.left.statusLabel)} -> ${escapeText(comparison.right.statusLabel)}</strong></article>`
      : '';
    const metricHtml = metrics.length ? metrics.map((item) => `
      <article>
        <span>${escapeText(item.label)}</span>
        <strong>${versionMetricValue(item.key, item.before, helpers)} -> ${versionMetricValue(item.key, item.after, helpers)}</strong>
        <small>${item.delta >= 0 ? '+' : ''}${versionMetricValue(item.key, item.delta, helpers)}</small>
      </article>
    `).join('') : '<article><span>Valores</span><strong>Sem alteração relevante</strong><small>Valores financeiros preservados.</small></article>';
    const builderHtml = builder.length ? builder.map((item) => `
      <article>
        <span>${escapeText(item.label)}</span>
        <strong>${item.before} -> ${item.after}</strong>
        <small>${item.delta >= 0 ? '+' : ''}${item.delta} selecionados</small>
      </article>
    `).join('') : '';
    return `
      <div class="proposal-version-comparison" data-proposal-version-comparison>
        ${status}
        ${metricHtml}
        ${builderHtml}
      </div>
    `;
  }

  function renderVersionPanel(input = {}, helpers = {}) {
    const currentSnapshot = input.currentSnapshot || {};
    const history = Array.isArray(input.history) ? input.history : [];
    const latest = input.latest || history[0] || null;
    const saved = !!input.saved;
    const comparison = input.comparison || null;
    const latestVersion = latest ? `v${latest.version}` : 'sem versão';
    const statusLabel = saved ? 'Versão atual salva' : (latest ? 'Mudanças pendentes' : 'Primeira versão pendente');
    const statusTone = saved ? 'success' : (latest ? 'warning' : 'info');

    return {
      status: saved ? 'saved' : 'pending',
      count: history.length,
      html: `
      <div class="proposal-version-panel__head">
        <div>
          <span class="proposal-version-panel__eyebrow">Histórico da proposta</span>
          <h3>Versões e mudanças</h3>
          <p>Salve uma versão para comparar valores, conteúdo, validade e aceite antes de enviar.</p>
        </div>
        <div class="proposal-version-status proposal-version-status--${statusTone}">
          <span>Status</span>
          <strong>${escapeText(statusLabel)}</strong>
          <small>${escapeText(latestVersion)}</small>
        </div>
      </div>
      <div class="proposal-version-panel__actions">
        <button class="btn btn--primary" type="button" onclick="App.salvarVersaoProposta()">Salvar versão atual</button>
        <button class="btn btn--ghost" type="button" onclick="App.limparVersoesProposta()">Limpar versões desta proposta</button>
      </div>
      <div class="proposal-version-current">
        <article>
          <span>Cliente</span>
          <strong>${escapeText(currentSnapshot.cliente)}</strong>
          <small>${escapeText(currentSnapshot.proposalId)}</small>
        </article>
        <article>
          <span>Crédito</span>
          <strong>${formatMoney(currentSnapshot.metrics && currentSnapshot.metrics.creditoTotal, helpers)}</strong>
          <small>Parcela ${formatMoney(currentSnapshot.metrics && currentSnapshot.metrics.parcelaAtual, helpers)}</small>
        </article>
        <article>
          <span>Conteúdo</span>
          <strong>${escapeText(versionBuilderLabel(currentSnapshot.builder))}</strong>
          <small>Seleção incluída no PDF.</small>
        </article>
      </div>
      ${renderVersionComparison(comparison, helpers)}
      <div class="proposal-version-history" data-proposal-version-history>
        <strong>Versões salvas</strong>
        ${history.length ? history.map((item) => `
          <article data-proposal-version-item="${escapeText(String(item.version || ''))}">
            <span>${escapeText(item.versionLabel)} | ${escapeText(item.statusLabel || item.status)}</span>
            <small>${escapeText(item.savedAtLabel)} | ${escapeText(versionBuilderLabel(item.builder))}</small>
          </article>
        `).join('') : '<p>Nenhuma versão salva para esta proposta.</p>'}
      </div>
    `
    };
  }

  function renderVersionEmpty() {
    return '<div class="proposal-version-panel__empty">Calcule a simulação para salvar versões e comparar mudanças.</div>';
  }

  function readField(root, id) {
    const base = root || global.document;
    const el = base && base.getElementById ? base.getElementById(id) : null;
    return el ? el.value : '';
  }

  function readChecked(root, id) {
    const base = root || global.document;
    const el = base && base.getElementById ? base.getElementById(id) : null;
    return !!(el && el.checked);
  }

  function readAcceptanceForm(root = global.document) {
    return {
      reviewer: readField(root, 'proposalReviewer'),
      reviewerRole: readField(root, 'proposalReviewerRole'),
      validUntil: readField(root, 'proposalValidUntil'),
      notes: readField(root, 'proposalReviewNotes'),
      checklist: {
        premissas: readChecked(root, 'proposalCheckPremissas'),
        cliente: readChecked(root, 'proposalCheckCliente'),
        documentacao: readChecked(root, 'proposalCheckDocumentacao'),
        disponibilidade: readChecked(root, 'proposalCheckDisponibilidade')
      }
    };
  }

  function renderAcceptancePanel(input = {}) {
    const proposal = input.proposal || {};
    const current = input.current || {};
    const history = Array.isArray(input.history) ? input.history : [];
    const handoff = input.handoff || null;
    const checked = current.checklist || {};
    const statusTone = current.status === 'reviewed' ? 'success' : (current.status === 'expired' ? 'danger' : 'warning');
    const reviewer = escapeText(current.reviewer || proposal.consultor || '');
    const reviewerRole = escapeText(current.reviewerRole || 'Consultor responsável');
    const notes = escapeText(current.notes || '');
    const validUntil = escapeText(current.validUntil || '');
    const handoffReady = !!handoff;
    const handoffLocked = current.status !== 'reviewed';
    const handoffStatus = handoffReady
      ? `Handoff ${handoff.id} criado na fila consultiva.`
      : (handoffLocked ? 'Conclua a revisao para liberar o handoff.' : 'Proposta revisada pronta para virar lead consultivo.');

    return {
      status: current.status || 'pending',
      ready: current.status === 'reviewed',
      handoffReady,
      html: `
      <div class="proposal-acceptance-panel__head">
        <div>
           <span class="proposal-acceptance-panel__eyebrow">Conferência final</span>
           <h3>Revisão e aceite</h3>
           <p>Confira os dados e defina a validade antes de baixar ou compartilhar.</p>
        </div>
        <div class="proposal-acceptance-status proposal-acceptance-status--${statusTone}">
          <span>Status</span>
          <strong>${escapeText(current.statusLabel || 'Em revisão')}</strong>
          <small>${current.version ? `Versão ${current.version}` : 'Sem versão registrada'}</small>
        </div>
      </div>
      <div class="proposal-acceptance-form">
        <label>
          <span>Responsável pela revisão</span>
          <input id="proposalReviewer" class="form-input" type="text" value="${reviewer}" placeholder="Nome do responsável">
        </label>
        <label>
          <span>Papel na revisão</span>
          <input id="proposalReviewerRole" class="form-input" type="text" value="${reviewerRole}" placeholder="Consultor responsável">
        </label>
        <label>
          <span>Validade da proposta</span>
          <input id="proposalValidUntil" class="form-input" type="date" value="${validUntil}">
        </label>
      </div>
      <div class="proposal-acceptance-checks">
        <label><input id="proposalCheckPremissas" type="checkbox" ${checked.premissas ? 'checked' : ''}> Premissas financeiras conferidas</label>
        <label><input id="proposalCheckCliente" type="checkbox" ${checked.cliente ? 'checked' : ''}> Dados do cliente revisados</label>
        <label><input id="proposalCheckDocumentacao" type="checkbox" ${checked.documentacao ? 'checked' : ''}> Documentação conferida</label>
        <label><input id="proposalCheckDisponibilidade" type="checkbox" ${checked.disponibilidade ? 'checked' : ''}> Disponibilidade e condições atuais confirmadas</label>
      </div>
      <label class="proposal-acceptance-notes">
        <span>Observação da revisão</span>
        <textarea id="proposalReviewNotes" class="form-textarea" rows="3" placeholder="Ex.: Confirmar o limite de lance embutido antes do envio.">${notes}</textarea>
      </label>
      <div class="proposal-acceptance-actions">
        <button class="btn btn--primary" type="button" onclick="App.salvarRevisaoProposta()">Registrar revisão</button>
        <button class="btn btn--ghost" type="button" onclick="App.limparRevisaoProposta()">Limpar revisões desta proposta</button>
      </div>
      <div class="proposal-handoff-bridge" data-proposal-handoff-bridge hidden aria-hidden="true">
        <div>
          <span class="proposal-handoff-bridge__eyebrow">Continuidade consultiva</span>
          <strong>${escapeText(handoffStatus)}</strong>
          <small>${handoffReady ? 'Acompanhe checklist, responsavel, notas e auditoria no handoff consultivo.' : 'Nenhum dado e enviado para terceiros nesta etapa; o lead fica salvo localmente.'}</small>
        </div>
        <div class="proposal-handoff-bridge__actions">
          <button class="btn btn--primary" type="button" onclick="App.criarHandoffProposta()" ${handoffLocked ? 'disabled aria-disabled="true"' : ''}>
            ${handoffReady ? 'Atualizar handoff' : 'Criar handoff'}
          </button>
          <a class="btn btn--ghost" href="handoff-consultivo.html#fila-handoff">${handoffReady ? `Abrir ${escapeText(handoff.id)}` : 'Abrir fila'}</a>
        </div>
      </div>
      <div class="proposal-acceptance-history" data-proposal-acceptance-history>
        <strong>Histórico de revisões</strong>
        ${history.length ? history.map((item) => `
          <article>
            <span>${escapeText(item.statusLabel)}${item.version ? ` | v${item.version}` : ''}</span>
            <small>${escapeText(item.reviewer)} - ${item.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR') : 'sem data'}</small>
          </article>
        `).join('') : '<p>Nenhuma revisão registrada para esta proposta.</p>'}
      </div>
    `
    };
  }

  function renderAcceptanceEmpty() {
    return '<div class="proposal-acceptance-panel__empty">Calcule a simulação para registrar revisão, validade e aceite.</div>';
  }

  global.BFProposalGovernance = {
    escapeText,
    versionMetricValue,
    versionBuilderLabel,
    renderVersionComparison,
    renderVersionPanel,
    renderVersionEmpty,
    readAcceptanceForm,
    renderAcceptancePanel,
    renderAcceptanceEmpty
  };
})(typeof window !== 'undefined' ? window : globalThis);
