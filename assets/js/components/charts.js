(function () {
  'use strict';

  function bars(target, items) {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    const max = Math.max(1, ...items.map((item) => Number(item.value || 0)));
    el.innerHTML = items.map((item) => `
      <div class="bf-bar-row">
        <span>${item.label}</span>
        <div><i style="width:${Math.round((Number(item.value || 0) / max) * 100)}%"></i></div>
        <strong>${item.value}</strong>
      </div>
    `).join('');
  }

  window.BFCharts = { bars };
})();
