(function () {
  'use strict';

  function init() {
    document.querySelectorAll('[data-tip]').forEach((el) => {
      const message = el.dataset.tip || '';
      el.setAttribute('title', message);
      el.setAttribute('tabindex', '0');
      el.setAttribute('role', 'note');
      el.setAttribute('aria-label', `Ajuda: ${message}`);
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.BFTooltips = { init };
})();
