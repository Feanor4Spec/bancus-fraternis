/**
 * Simulator cart service.
 * Keeps project/cart rules and HTML builders outside the main simulator controller.
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

  function money(value, helpers = {}) {
    if (helpers.formatMoney) return helpers.formatMoney(value);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function number(value, decimals = 2, helpers = {}) {
    if (helpers.formatNumber) return helpers.formatNumber(value, decimals);
    const n = Number(value || 0);
    return n.toLocaleString('pt-BR', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }

  function parseMoney(value, helpers = {}) {
    if (helpers.parseMoney) return helpers.parseMoney(value);
    if (!value) return 0;
    return parseFloat(String(value).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
  }

  function items(project) {
    return project && Array.isArray(project.itens) ? project.itens : [];
  }

  function cartTotals(sourceItems) {
    const list = Array.isArray(sourceItems) ? sourceItems : [];
    return {
      totalGrupos: list.length,
      totalCotas: list.reduce((sum, item) => sum + Number(item.quantidadeCotas || 0), 0),
      totalCarta: list.reduce((sum, item) => sum + Number(item.valorCartaTotal || 0), 0)
    };
  }

  function createProjectItem(group, options = {}) {
    if (!group) return null;
    const shelfEngine = options.shelfEngine || global.ShelfEngine;
    if (!shelfEngine || typeof shelfEngine.createProjectItem !== 'function') return null;
    const item = shelfEngine.createProjectItem(group, options.quantidadeCotas || 1, options.valorCarta);
    const numberSetting = options.numberSetting || (() => undefined);
    const getLimit = options.getEffectiveLanceEmbutidoMax || (() => 0);
    item.mesContemplacaoAlvo = numberSetting('defaultMesContemplacao', item.mesContemplacaoAlvo || 18);
    const limite = Number(getLimit(group) || 0);
    item.lanceEmbutidoPct = Math.min(limite, item.lanceEmbutidoPct || limite);
    return item;
  }

  function removeProjectItem(project, itemId, options = {}) {
    const shelfEngine = options.shelfEngine || global.ShelfEngine;
    if (shelfEngine && typeof shelfEngine.removeProjectItem === 'function') {
      shelfEngine.removeProjectItem(project, itemId);
      return project;
    }
    if (project && Array.isArray(project.itens)) {
      project.itens = project.itens.filter((item) => item.itemId !== itemId);
    }
    return project;
  }

  function updateProjectItem(project, itemId, campo, valor, options = {}) {
    const patch = {};
    patch[campo] = valor;
    const shelfEngine = options.shelfEngine || global.ShelfEngine;
    if (shelfEngine && typeof shelfEngine.updateProjectItem === 'function') {
      shelfEngine.updateProjectItem(project, itemId, patch);
    } else if (project && Array.isArray(project.itens)) {
      const item = project.itens.find((entry) => entry.itemId === itemId);
      if (item) Object.assign(item, patch);
    }
    return items(project).find((entry) => entry.itemId === itemId) || null;
  }

  function advanceButtonState(count) {
    const n = Number(count || 0);
    if (n <= 0) {
      return {
        disabled: true,
        text: 'Adicione pelo menos 1 grupo para avancar ->'
      };
    }
    return {
      disabled: false,
      text: `Simular ${n} grupo${n !== 1 ? 's' : ''} selecionado${n !== 1 ? 's' : ''} ->`
    };
  }

  function renderSelectedGroupsEmpty() {
    return `
        <div class="selected-groups-empty">
          <span class="bf-empty-mark">PJ</span>
          <p>Nenhum grupo adicionado ainda. Clique em <strong>+ Adicionar</strong> na tabela acima.</p>
        </div>
      `;
  }

  function renderSelectedGroupsHtml(sourceItems, helpers = {}) {
    const list = Array.isArray(sourceItems) ? sourceItems : [];
    if (list.length === 0) return renderSelectedGroupsEmpty();

    const rows = list.map((item) => `
      <tr class="selected-group-row" data-item-id="${escapeText(item.itemId)}">
        <td>
          <div class="sg-group-info">
            <span class="sg-icon">${escapeText(item.iconSegmento)}</span>
            <div>
              <div class="sg-grupo-cod"><strong>${escapeText(item.codigoGrupo)}</strong></div>
              <div class="sg-admin-nome">${escapeText(item.administradora)}</div>
            </div>
          </div>
        </td>
        <td><span class="shelf-segment-badge">${escapeText(item.iconSegmento)} ${escapeText(item.nomeSegmento)}</span></td>
        <td>
          <div class="campo-input-usuario">
            <label class="campo-label--usuario">Editavel</label>
            <input
              type="text"
              class="input-usuario"
              value="${number(item.valorCartaUnitario, 2, helpers)}"
              data-item-id="${escapeText(item.itemId)}"
              data-campo="valorCartaUnitario"
              onchange="App.onEditarItemProjeto(this)"
              onblur="App.onEditarItemProjeto(this)"
              placeholder="Ex: 100.000,00"
            >
          </div>
        </td>
        <td>
          <div class="campo-input-usuario">
            <label class="campo-label--usuario">Editavel</label>
            <input
              type="number"
              class="input-usuario input-usuario--qtd"
              value="${Number(item.quantidadeCotas || 1)}"
              min="1"
              max="999"
              data-item-id="${escapeText(item.itemId)}"
              data-campo="quantidadeCotas"
              onchange="App.onEditarItemProjeto(this)"
              placeholder="1"
            >
          </div>
        </td>
        <td>
          <div class="campo-calculado">
            <label class="campo-label--calculado">Calculado</label>
            <div class="campo-calculado__valor sg-total-carta">${money(item.valorCartaTotal, helpers)}</div>
          </div>
        </td>
        <td class="sg-remover-cell">
          <button class="btn btn--sm btn--danger" onclick="App.removerGrupoSelecionado('${escapeText(item.itemId)}')" title="Remover grupo">x</button>
        </td>
      </tr>
    `).join('');

    return `
      <table class="data-table selected-groups-table">
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Segmento</th>
            <th>Valor da Carta (R$)</th>
            <th>Qtd. Cotas</th>
            <th>Total da Carta</th>
            <th>Remover</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="selected-groups-footer" id="selected-groups-footer"></div>
    `;
  }

  function renderSelectedGroupsFooter(sourceItems, helpers = {}) {
    const totals = cartTotals(sourceItems);
    return `
      <div class="sg-footer-item">
        <span class="sg-footer-label">Grupos</span>
        <span class="sg-footer-value">${totals.totalGrupos}</span>
      </div>
      <div class="sg-footer-item">
        <span class="sg-footer-label">Total de Cotas</span>
        <span class="sg-footer-value">${totals.totalCotas}</span>
      </div>
      <div class="sg-footer-item sg-footer-item--destaque">
        <span class="sg-footer-label">Total das Cartas</span>
        <span class="sg-footer-value">${money(totals.totalCarta, helpers)}</span>
      </div>
    `;
  }

  function normalizeEditValue(campo, rawValue, item, helpers = {}) {
    if (!item || !campo) return { ok: false, value: undefined };
    if (campo === 'valorCartaUnitario') {
      const value = parseMoney(rawValue, helpers);
      if (value <= 0) {
        return {
          ok: false,
          value: item.valorCartaUnitario || 0,
          displayValue: number(item.valorCartaUnitario || 0, 2, helpers),
          message: 'Valor da carta deve ser maior que zero.',
          tone: 'error'
        };
      }
      return { ok: true, value };
    }

    if (campo === 'quantidadeCotas' || campo === 'prazoMeses' || campo === 'mesContemplacaoAlvo') {
      let value = parseInt(rawValue, 10) || 1;
      if (value < 1) value = 1;
      if (campo === 'mesContemplacaoAlvo' && value > (item.prazoMeses || 1)) {
        value = item.prazoMeses || 1;
        return {
          ok: true,
          value,
          displayValue: String(value),
          message: 'Mes de contemplacao ajustado ao prazo do grupo.',
          tone: 'warning'
        };
      }
      return { ok: true, value, displayValue: String(value) };
    }

    if (campo === 'taxaAdmPct' || campo === 'fundoReservaPct' || campo === 'lanceProprioPct' || campo === 'lanceEmbutidoPct') {
      let value = parseFloat(rawValue) || 0;
      if (value < 0) value = 0;
      if (campo === 'lanceEmbutidoPct') {
        const getLimit = helpers.getEffectiveLanceEmbutidoMax || (() => 0);
        const limite = Number(getLimit(item._group) || 0);
        if (limite > 0 && value > limite) {
          value = limite;
          return {
            ok: true,
            value,
            displayValue: String(value),
            message: `Lance embutido ajustado ao limite do grupo (${limite.toFixed(1)}%).`,
            tone: 'warning'
          };
        }
      }
      return { ok: true, value, displayValue: String(value) };
    }

    return { ok: false, value: undefined };
  }

  function renderDashboardKpis(consolidado = {}, helpers = {}) {
    return [
      { label: 'Valor Credito Contratado', val: money(consolidado.totalCarta, helpers), cls: '' },
      { label: 'Valor Receber (Credito - L. Embutido)', val: money(consolidado.cartaLiquida, helpers), cls: 'kpi-row--green' },
      { label: 'Taxa Administracao Media', val: `${(Number(consolidado.taxaAdmMedia || 0)).toFixed(2)}%`, cls: '' },
      { label: 'Quantidade de Grupos', val: consolidado.totalGrupos, cls: '' },
      { label: 'Total de Cotas', val: consolidado.totalCotas || 0, cls: '' },
      { label: 'Prazo Medio', val: `${(Number(consolidado.prazoMedio || 0)).toFixed(0)} meses`, cls: '' },
      { label: 'Lance Proprio', val: money(consolidado.totalLanceProprioR, helpers) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Lance Embutido', val: money(consolidado.totalLanceEmbutidoR, helpers) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Parcela Inicial do Projeto', val: money(consolidado.parcelaInicialTotal, helpers), cls: 'kpi-row--red' },
      { label: 'Custo Efetivo Estimado', val: `${(Number(consolidado.custoEfetivoMedio || 0)).toFixed(2)}%`, cls: 'kpi-row--red' }
    ];
  }

  function renderStep5CartHtml(sourceItems, helpers = {}) {
    const list = Array.isArray(sourceItems) ? sourceItems : [];
    if (list.length === 0) return '<p class="text-center text-muted">Nenhum grupo selecionado.</p>';

    const getLimit = helpers.getEffectiveLanceEmbutidoMax || (() => 0);
    return list.map((item) => {
      const prazo = Number(item.prazoMeses || 0);
      const taxa = Number(item.taxaAdmPct || 0);
      const fundo = Number(item.fundoReservaPct || 0);
      const qtde = Number(item.quantidadeCotas || 1);
      const valCarta = Number(item.valorCartaUnitario || 0);
      const mob = Number(item.mesContemplacaoAlvo || 18);
      const pctEmbutido = Number(item.lanceEmbutidoPct || 0);
      const pctProprio = Number(item.lanceProprioPct || 0);
      const limiteEmbutido = Number(getLimit(item._group) || 0);
      const calcValEmb = valCarta * (pctEmbutido / 100) * qtde;
      const calcValPro = valCarta * (pctProprio / 100) * qtde;
      const calcLanceTot = calcValEmb + calcValPro;

      return `
        <div class="cart-item-card" data-item-id="${escapeText(item.itemId)}">
          <div class="cart-item-header">
            <div class="cart-item-title">
              <span class="shelf-segment-badge">${escapeText(item.iconSegmento)} ${escapeText(item.nomeSegmento)}</span>
              ${escapeText(item.administradora)} - Grupo ${escapeText(item.codigoGrupo)}
            </div>
            <button class="btn btn--sm btn--danger" onclick="App.removerGrupoSelecionado('${escapeText(item.itemId)}'); App.recalcularProjeto()">x Remover</button>
          </div>
          <div class="cart-item-body">
            <div class="cart-grid-container">
              <div class="cart-field">
                <label>Qtd. Cotas</label>
                <input type="number" class="cart-input" data-campo="quantidadeCotas" value="${qtde}" min="1" max="999" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Valor da Carta Unit. (R$)</label>
                <input type="text" class="cart-input" data-money="true" data-campo="valorCartaUnitario" value="${number(valCarta, 2, helpers)}" onblur="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Prazo Restante</label>
                <input type="number" class="cart-input" data-campo="prazoMeses" value="${prazo}" min="1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Taxa Adm (%)</label>
                <input type="number" class="cart-input" data-campo="taxaAdmPct" value="${taxa.toFixed(2)}" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Fundo Reserva (%)</label>
                <input type="number" class="cart-input" data-campo="fundoReservaPct" value="${fundo.toFixed(2)}" step="0.01" min="0" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>MOB Contemplacao (Mes)</label>
                <input type="number" class="cart-input" data-campo="mesContemplacaoAlvo" value="${mob}" min="1" max="${prazo}" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance R.P (%)</label>
                <input type="number" class="cart-input" data-campo="lanceProprioPct" value="${pctProprio}" step="0.1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance Embutido (%)${limiteEmbutido ? ` max. ${limiteEmbutido}%` : ''}</label>
                <input type="number" class="cart-input" data-campo="lanceEmbutidoPct" value="${pctEmbutido}" step="0.1" min="0" ${limiteEmbutido ? `max="${limiteEmbutido}"` : ''} onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance R.P (R$)</label>
                <div class="cart-calc dyn-val-proprio">${money(calcValPro, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Lance Embutido (R$)</label>
                <div class="cart-calc dyn-val-embutido">${money(calcValEmb, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Lance Total (R$)</label>
                <div class="cart-calc dyn-val-lancetot">${money(calcLanceTot, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Credito Liquido</label>
                <div class="cart-calc dyn-val-liq">${money((valCarta * qtde) - calcValEmb, helpers)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');
  }

  function applyCalculationResults(itemResults, options = {}) {
    const root = options.root || global.document;
    if (!root || !Array.isArray(itemResults)) return 0;
    let updated = 0;
    itemResults.forEach((result) => {
      const item = result.item || {};
      const card = root.querySelector ? root.querySelector(`.cart-item-card[data-item-id="${item.itemId}"]`) : null;
      if (!card) return;
      const propR = result.lanceProprioR || 0;
      const embR = result.lanceEmbutidoR || 0;
      const fields = [
        ['.dyn-val-proprio', money(propR, options)],
        ['.dyn-val-embutido', money(embR, options)],
        ['.dyn-val-lancetot', money(propR + embR, options)],
        ['.dyn-val-liq', money(result.cartaLiquida || 0, options)]
      ];
      fields.forEach(([selector, value]) => {
        const el = card.querySelector(selector);
        if (el) el.textContent = value;
      });
      updated += 1;
    });
    return updated;
  }

  global.BFSimulatorCart = {
    cartTotals,
    createProjectItem,
    removeProjectItem,
    updateProjectItem,
    advanceButtonState,
    renderSelectedGroupsHtml,
    renderSelectedGroupsFooter,
    normalizeEditValue,
    renderDashboardKpis,
    renderStep5CartHtml,
    applyCalculationResults
  };
})(typeof window !== 'undefined' ? window : globalThis);
