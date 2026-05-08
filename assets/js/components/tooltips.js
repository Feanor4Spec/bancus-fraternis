(function () {
  'use strict';

  function init() {
    document.querySelectorAll('[data-tip]').forEach((el) => {
      el.setAttribute('title', el.dataset.tip || '');
    });
  }

  document.addEventListener('DOMContentLoaded', init);
  window.BFTooltips = { init };
})();
