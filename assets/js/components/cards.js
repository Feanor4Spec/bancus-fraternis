(function () {
  'use strict';

  function escapeHtml(value) {
    return String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function product(product) {
    const risks = (product.riscos || []).slice(0, 2).map((risk) => `<li>${escapeHtml(risk)}</li>`).join('');
    const criteria = (product.criterios || []).slice(0, 3).map((item) => `<span>${escapeHtml(item)}</span>`).join('');
    const score = Number(product.scoreRecomendacao || 0);
    const scoreHtml = score ? `<strong class="bf-product-score">${score}/100</strong>` : '';
    const selected = product.selecionado === true || product.selected === true;
    const selectionButton = product.selectionEnabled
      ? `<button class="btn btn--ghost btn--sm bf-product-select" type="button" data-product-toggle-selection="${escapeHtml(product.id)}" aria-pressed="${selected ? 'true' : 'false'}">${selected ? 'Selecionado' : 'Selecionar'}</button>`
      : '';
    const compareHref = product.comparadorHref || (product.comparador
      ? `${product.comparador}${product.comparadorPreset ? `?preset=${encodeURIComponent(product.comparadorPreset)}` : ''}`
      : '');
    const simulatorHref = product.simuladorHref || product.simulador || '';
    const calculatorHref = product.calculadoraHref || product.calculadora || '';
    const journeyHref = product.trilhaHref || product.jornadaHref || '';
    return `
      <article class="bf-platform-card bf-product-card${selected ? ' is-selected' : ''}" data-product-card data-product-id="${escapeHtml(product.id)}" data-product-urgency="${escapeHtml(String(product.urgencia || '').toLowerCase())}" data-product-category="${escapeHtml(product.categoria)}" data-product-selected="${selected ? 'true' : 'false'}">
        <div class="bf-product-card__top">
          <span class="bf-badge bf-badge--gold">${escapeHtml(product.categoria)}</span>
          <div class="bf-product-card__signals">
            ${scoreHtml}
            ${selectionButton}
          </div>
        </div>
        <h3>${escapeHtml(product.nome)}</h3>
        <p>${escapeHtml(product.objetivo)}</p>
        <dl class="bf-mini-facts">
          <div><dt>Prazo</dt><dd>${escapeHtml(product.prazoMin)}-${escapeHtml(product.prazoMax)} meses</dd></div>
          <div><dt>Urgencia</dt><dd>${escapeHtml(product.urgencia)}</dd></div>
        </dl>
        <div class="bf-product-chips">${criteria}</div>
        ${product.quandoUsar ? `<p class="bf-product-note"><strong>Usar quando:</strong> ${escapeHtml(product.quandoUsar)}</p>` : ''}
        <ul>${risks}</ul>
        <div class="bf-inline-actions bf-product-actions">
          ${simulatorHref ? `<a class="btn btn--primary btn--sm" href="${escapeHtml(simulatorHref)}">Simular</a>` : ''}
          ${compareHref ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(compareHref)}">Comparar</a>` : ''}
          ${calculatorHref ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(calculatorHref)}">Diagnosticar</a>` : ''}
          ${journeyHref ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(journeyHref)}">Trilha</a>` : ''}
        </div>
      </article>
    `;
  }

  function metric(label, value, tone = '') {
    return `
      <div class="bf-platform-metric ${tone}">
        <small>${label}</small>
        <strong>${value}</strong>
      </div>
    `;
  }

  window.BFCards = { product, metric };
})();
