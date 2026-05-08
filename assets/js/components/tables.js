(function () {
  'use strict';

  function comparison(rows) {
    const fmt = window.BFFormatters;
    return `
      <table class="data-table bf-platform-table">
        <thead><tr><th>Produto</th><th>Total</th><th>1a parcela</th><th>Ultima parcela</th><th>Prazo</th><th>Score</th></tr></thead>
        <tbody>
          ${(rows || []).map((row) => `
            <tr>
              <td><strong>${row.label}</strong></td>
              <td>${fmt.currency(row.totalPago)}</td>
              <td>${fmt.currency(row.primeiraParcela)}</td>
              <td>${fmt.currency(row.ultimaParcela)}</td>
              <td>${fmt.months(row.prazo)}</td>
              <td><span class="shelf-score shelf-score--high">${row.score}</span></td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  function schedule(rows, limit = 12) {
    const fmt = window.BFFormatters;
    return `
      <table class="data-table bf-platform-table">
        <thead><tr><th>MOB</th><th>Parcela</th><th>Juros</th><th>Amortizacao</th><th>Saldo</th></tr></thead>
        <tbody>
          ${(rows || []).slice(0, limit).map((row) => `
            <tr>
              <td>${row.mob}</td>
              <td>${fmt.currency(row.parcela)}</td>
              <td>${fmt.currency(row.juros || 0)}</td>
              <td>${fmt.currency(row.amortizacao || 0)}</td>
              <td>${fmt.currency(row.saldo || 0)}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
    `;
  }

  window.BFTables = { comparison, schedule };
})();
