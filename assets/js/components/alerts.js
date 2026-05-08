(function () {
  'use strict';

  function show(target, message, tone = 'info') {
    const el = typeof target === 'string' ? document.querySelector(target) : target;
    if (!el) return;
    el.innerHTML = `<div class="bf-platform-alert bf-platform-alert--${tone}">${message}</div>`;
  }

  window.BFAlerts = { show };
})();
