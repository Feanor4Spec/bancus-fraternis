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
      `${Number(current.sections || 0)}/${Number(current.sectionsTotal || 0)} blocos`,
      `${Number(current.charts || 0)}/${Number(current.chartsTotal || 0)} graficos`,
      `${Number(current.concepts || 0)}/${Number(current.conceptsTotal || 0)} conceitos`,
      `${Number(current.formulas || 0)}/${Number(current.formulasTotal || 0)} formulas`
    ].join(' | ');
  }

  function renderVersionComparison(comparison, helpers = {}) {
    if (!comparison) {
      return '<p class="proposal-version-panel__muted">Salve ao menos duas versoes para comparar as mudancas antes do handoff.</p>';
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
    `).join('') : '<article><span>Numeros</span><strong>Sem alteracao relevante</strong><small>Metricas financeiras preservadas.</small></article>';
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
    const latestVersion = latest ? `v${latest.version}` : 'sem versao';
    const statusLabel = saved ? 'Versao atual salva' : (latest ? 'Mudancas pendentes' : 'Primeira versao pendente');
    const statusTone = saved ? 'success' : (latest ? 'warning' : 'info');

    return {
      status: saved ? 'saved' : 'pending',
      count: history.length,
      html: `
      <div class="proposal-version-panel__head">
        <div>
          <span class="proposal-version-panel__eyebrow">Historico da proposta</span>
          <h3>Versoes e comparacao antes do handoff</h3>
          <p>Salve snapshots da proposta para comparar mudancas de numeros, lousa, validade e aceite antes de encaminhar ao atendimento.</p>
        </div>
        <div class="proposal-version-status proposal-version-status--${statusTone}">
          <span>Status</span>
          <strong>${escapeText(statusLabel)}</strong>
          <small>${escapeText(latestVersion)}</small>
        </div>
      </div>
      <div class="proposal-version-panel__actions">
        <button class="btn btn--primary" type="button" onclick="App.salvarVersaoProposta()">Salvar versao atual</button>
        <button class="btn btn--ghost" type="button" onclick="App.limparVersoesProposta()">Limpar versoes desta proposta</button>
      </div>
      <div class="proposal-version-current">
        <article>
          <span>Cliente</span>
          <strong>${escapeText(currentSnapshot.cliente)}</strong>
          <small>${escapeText(currentSnapshot.proposalId)}</small>
        </article>
        <article>
          <span>Credito</span>
          <strong>${formatMoney(currentSnapshot.metrics && currentSnapshot.metrics.creditoTotal, helpers)}</strong>
          <small>Parcela ${formatMoney(currentSnapshot.metrics && currentSnapshot.metrics.parcelaAtual, helpers)}</small>
        </article>
        <article>
          <span>Lousa</span>
          <strong>${escapeText(versionBuilderLabel(currentSnapshot.builder))}</strong>
          <small>Selecao que entra no PDF final.</small>
        </article>
      </div>
      ${renderVersionComparison(comparison, helpers)}
      <div class="proposal-version-history" data-proposal-version-history>
        <strong>Historico versionado</strong>
        ${history.length ? history.map((item) => `
          <article data-proposal-version-item="${escapeText(String(item.version || ''))}">
            <span>${escapeText(item.versionLabel)} | ${escapeText(item.statusLabel || item.status)}</span>
            <small>${escapeText(item.savedAtLabel)} | ${escapeText(versionBuilderLabel(item.builder))}</small>
          </article>
        `).join('') : '<p>Nenhuma versao salva para esta proposta.</p>'}
      </div>
    `
    };
  }

  function renderVersionEmpty() {
    return '<div class="proposal-version-panel__empty">Calcule a simulacao para salvar versoes e comparar mudancas da proposta.</div>';
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
        documentacao: readChecked(root, 'proposalCheckDocumentacao')
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
    const reviewerRole = escapeText(current.reviewerRole || 'Consultor responsavel');
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
          <span class="proposal-acceptance-panel__eyebrow">Governanca da proposta</span>
          <h3>Revisao e aceite local</h3>
          <p>Registre a versao revisada antes de exportar, imprimir ou encaminhar para atendimento consultivo.</p>
        </div>
        <div class="proposal-acceptance-status proposal-acceptance-status--${statusTone}">
          <span>Status</span>
          <strong>${escapeText(current.statusLabel || 'Em revisao')}</strong>
          <small>${current.version ? `Versao ${current.version}` : 'Sem versao registrada'}</small>
        </div>
      </div>
      <div class="proposal-acceptance-form">
        <label>
          <span>Responsavel pela revisao</span>
          <input id="proposalReviewer" class="form-input" type="text" value="${reviewer}" placeholder="Nome do responsavel">
        </label>
        <label>
          <span>Papel na revisao</span>
          <input id="proposalReviewerRole" class="form-input" type="text" value="${reviewerRole}" placeholder="Consultor responsavel">
        </label>
        <label>
          <span>Validade da proposta</span>
          <input id="proposalValidUntil" class="form-input" type="date" value="${validUntil}">
        </label>
      </div>
      <div class="proposal-acceptance-checks">
        <label><input id="proposalCheckPremissas" type="checkbox" ${checked.premissas ? 'checked' : ''}> Premissas financeiras conferidas</label>
        <label><input id="proposalCheckCliente" type="checkbox" ${checked.cliente ? 'checked' : ''}> Contexto do cliente revisado</label>
        <label><input id="proposalCheckDocumentacao" type="checkbox" ${checked.documentacao ? 'checked' : ''}> Documentacao e handoff mapeados</label>
      </div>
      <label class="proposal-acceptance-notes">
        <span>Observacao da revisao</span>
        <textarea id="proposalReviewNotes" class="form-textarea" rows="3" placeholder="Ex: Validar limite de lance embutido antes do envio.">${notes}</textarea>
      </label>
      <div class="proposal-acceptance-actions">
        <button class="btn btn--primary" type="button" onclick="App.salvarRevisaoProposta()">Registrar revisao</button>
        <button class="btn btn--ghost" type="button" onclick="App.limparRevisaoProposta()">Limpar revisoes desta proposta</button>
      </div>
      <div class="proposal-handoff-bridge" data-proposal-handoff-bridge>
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
        <strong>Historico local</strong>
        ${history.length ? history.map((item) => `
          <article>
            <span>${escapeText(item.statusLabel)}${item.version ? ` | v${item.version}` : ''}</span>
            <small>${escapeText(item.reviewer)} - ${item.updatedAt ? new Date(item.updatedAt).toLocaleString('pt-BR') : 'sem data'}</small>
          </article>
        `).join('') : '<p>Nenhuma revisao registrada para esta proposta.</p>'}
      </div>
    `
    };
  }

  function renderAcceptanceEmpty() {
    return '<div class="proposal-acceptance-panel__empty">Calcule a simulacao para registrar revisao, validade e aceite local da proposta.</div>';
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
