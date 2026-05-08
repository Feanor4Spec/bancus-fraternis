(function () {
  'use strict';

  function simulate(input) {
    const result = window.BFConsorcioFormulas.simulate(input);
    return { tipo: 'Consorcio', ...result };
  }

  window.BFConsorcioService = { simulate };
})();
