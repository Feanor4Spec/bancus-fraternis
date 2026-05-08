(function () {
  'use strict';

  const PRODUCT_LABELS = {
    financiamento: 'Financiamento',
    consorcio: 'Consorcio',
    cdc: 'CDC',
    garantia: 'Credito com garantia',
    consignado: 'Consignado',
    consumo: 'Consumo',
    vista: 'Pagar a vista',
    parcelado: 'Compra parcelada'
  };

  const STATUS_LABELS = {
    draft: 'Rascunho',
    approved: 'Aprovado',
    published: 'Publicado',
    archived: 'Arquivado'
  };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function modelStatus(model) {
    return model.governanceStatus || 'draft';
  }

  function actionLabel(action) {
    const labels = {
      create: 'Criado',
      update: 'Atualizado',
      delete: 'Excluido',
      export: 'Exportado',
      import: 'Importado',
      'clone-standard': 'Clonado da biblioteca',
      'governance:approved': 'Aprovado',
      'governance:published': 'Publicado',
      'governance:archived': 'Arquivado'
    };
    return labels[action] || action || 'Evento';
  }

  function productText(model) {
    return (model.productIds || []).map((id) => PRODUCT_LABELS[id] || id).join(', ') || 'Manual';
  }

  function allModels() {
    return window.BFComparatorModels && window.BFComparatorModels.all ? window.BFComparatorModels.all() : [];
  }

  function allAudit() {
    return window.BFComparatorModels && window.BFComparatorModels.audit ? window.BFComparatorModels.audit() : [];
  }

  function quality(model) {
    return window.BFComparatorModels && window.BFComparatorModels.quality
      ? window.BFComparatorModels.quality(model)
      : { score: 0, label: 'Sem avaliacao', tone: 'danger', risks: [] };
  }

  function filteredModels() {
    const search = (qs('[data-model-search]')?.value || '').trim().toLowerCase();
    const owner = qs('[data-model-owner-filter]')?.value || '';
    const preset = qs('[data-model-preset-filter]')?.value || '';
    const product = qs('[data-model-product-filter]')?.value || '';
    const status = qs('[data-model-status-filter]')?.value || '';

    return allModels().filter((model) => {
      const haystack = [
        model.name,
        model.userEmail,
        model.storageScope,
        model.source,
        model.preset,
        productText(model),
        model.formulaVersion,
        model.premiseReference
      ].join(' ').toLowerCase();
      const matchesSearch = !search || haystack.includes(search);
      const matchesOwner = !owner || model.storageScope === owner || model.userEmail === owner;
      const matchesPreset = !preset || model.preset === preset;
      const matchesProduct = !product || (model.productIds || []).includes(product);
      const matchesStatus = !status || modelStatus(model) === status;
      return matchesSearch && matchesOwner && matchesPreset && matchesProduct && matchesStatus;
    });
  }

  function renderFilterOptions() {
    const models = allModels();
    const ownerTarget = qs('[data-model-owner-filter]');
    const productTarget = qs('[data-model-product-filter]');
    if (ownerTarget) {
      const owners = Array.from(new Set(models.map((model) => model.storageScope || model.userEmail || 'anon'))).sort();
      ownerTarget.innerHTML = '<option value="">Todos</option>' + owners.map((owner) => `<option value="${escapeHtml(owner)}">${escapeHtml(owner)}</option>`).join('');
    }
    if (productTarget) {
      const products = Array.from(new Set(models.flatMap((model) => model.productIds || []))).sort();
      productTarget.innerHTML = '<option value="">Todos</option>' + products.map((product) => `<option value="${escapeHtml(product)}">${escapeHtml(PRODUCT_LABELS[product] || product)}</option>`).join('');
    }
  }

  function renderSummary() {
    const target = qs('[data-model-governance-summary]');
    if (!target) return;
    const models = allModels();
    const qualities = models.map(quality);
    const average = qualities.length
      ? Math.round(qualities.reduce((sum, item) => sum + item.score, 0) / qualities.length)
      : 0;
    const published = models.filter((model) => modelStatus(model) === 'published').length;
    const approved = models.filter((model) => modelStatus(model) === 'approved').length;
    const audit = allAudit();
    const versions = window.BFComparatorModels ? window.BFComparatorModels.versions || {} : {};
    target.innerHTML = `
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Modelos</small><strong>${models.length}</strong></article>
        <article class="bf-platform-metric"><small>Aprovados</small><strong>${approved}</strong></article>
        <article class="bf-platform-metric"><small>Publicados</small><strong>${published}</strong></article>
        <article class="bf-platform-metric"><small>Score medio</small><strong>${average}/100</strong></article>
      </div>
      <div class="bf-platform-alert bf-platform-section">
        Formula atual: <strong>${escapeHtml(versions.formulaVersion || '-')}</strong>; premissas: <strong>${escapeHtml(versions.premiseReference || '-')}</strong>; eventos auditados: <strong>${audit.length}</strong>.
      </div>
    `;
  }

  function renderTable() {
    const target = qs('[data-model-governance-table]');
    if (!target) return;
    const user = window.BFAuth.getCurrentUser();
    const canGovern = user && user.role === 'admin';
    const models = filteredModels();

    if (models.length === 0) {
      target.innerHTML = '<tr><td colspan="6"><div class="bf-empty-state">Nenhum modelo encontrado para os filtros atuais.</div></td></tr>';
      return;
    }

    target.innerHTML = models.map((model) => {
      const q = quality(model);
      const status = modelStatus(model);
      const scope = model.storageScope || model.userEmail || 'anon';
      const disabled = canGovern ? '' : ' disabled';
      return `
        <tr data-model-governance-row="${escapeHtml(model.id)}">
          <td>
            <strong>${escapeHtml(model.name)}</strong>
            <small>${escapeHtml(model.preset || 'manual')} - ${escapeHtml(model.source || 'local')}</small>
            <small>${escapeHtml(model.formulaVersion || '-')} - ${escapeHtml(model.premiseReference || '-')}</small>
          </td>
          <td>
            ${escapeHtml(scope)}
            <small>${escapeHtml(formatDate(model.updatedAt))}</small>
          </td>
          <td>${escapeHtml(productText(model))}</td>
          <td>
            <span class="bf-model-quality bf-model-quality--${escapeHtml(q.tone)}">${q.score}/100</span>
            <small>${escapeHtml(q.label)}</small>
          </td>
          <td><span class="bf-governance-status bf-governance-status--${escapeHtml(status)}">${escapeHtml(STATUS_LABELS[status] || status)}</span></td>
          <td>
            <div class="bf-inline-actions">
              <a class="btn btn--ghost btn--sm" href="comparador.html?modelo=${encodeURIComponent(model.id)}">Abrir</a>
              <button class="btn btn--ghost btn--sm" type="button" data-model-action="approved" data-model-id="${escapeHtml(model.id)}" data-model-scope="${escapeHtml(scope)}"${disabled}>Aprovar</button>
              <button class="btn btn--primary btn--sm" type="button" data-model-action="published" data-model-id="${escapeHtml(model.id)}" data-model-scope="${escapeHtml(scope)}"${disabled}>Publicar</button>
              <button class="btn btn--ghost btn--sm" type="button" data-model-action="archived" data-model-id="${escapeHtml(model.id)}" data-model-scope="${escapeHtml(scope)}"${disabled}>Arquivar</button>
            </div>
          </td>
        </tr>
      `;
    }).join('');
  }

  function renderAudit() {
    const target = qs('[data-model-governance-audit]');
    if (!target) return;
    const rows = allAudit().slice(0, 8);
    if (rows.length === 0) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum evento de governanca registrado neste navegador.</div>';
      return;
    }

    target.innerHTML = rows.map((event) => `
      <article class="bf-history-item">
        <span>${escapeHtml(actionLabel(event.action))}</span>
        <strong>${escapeHtml(event.modelName || event.modelId || 'Modelo')}</strong>
        <small>${escapeHtml(formatDate(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
        <small>${escapeHtml(event.formulaVersion || '-')} - ${escapeHtml(event.premiseReference || '-')}</small>
      </article>
    `).join('');
  }

  function renderAll() {
    renderFilterOptions();
    renderSummary();
    renderTable();
    renderAudit();
  }

  function bindFilters() {
    [
      '[data-model-search]',
      '[data-model-owner-filter]',
      '[data-model-preset-filter]',
      '[data-model-product-filter]',
      '[data-model-status-filter]'
    ].forEach((selector) => {
      qs(selector)?.addEventListener('input', renderTable);
      qs(selector)?.addEventListener('change', renderTable);
    });
  }

  function bindActions() {
    qs('[data-model-governance-table]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-model-action]');
      if (!button || !window.BFComparatorModels || !window.BFComparatorModels.updateGovernance) return;
      const user = window.BFAuth.getCurrentUser();
      if (!user || user.role !== 'admin') return;
      const status = button.dataset.modelAction;
      const result = window.BFComparatorModels.updateGovernance(button.dataset.modelId, button.dataset.modelScope, {
        governanceStatus: status,
        governanceActorEmail: user.email,
        governanceNote: `Status alterado para ${STATUS_LABELS[status] || status}.`
      });
      if (!result.ok) window.alert(result.message);
      renderAll();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const user = window.BFAuth.requireRole(['admin', 'consultor'], { redirect: true });
    if (!user) return;
    bindFilters();
    bindActions();
    renderAll();
  });
})();
