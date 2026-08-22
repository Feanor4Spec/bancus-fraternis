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

  function stableIdToken(value) {
    const raw = String(value ?? 'item');
    const normalized = typeof raw.normalize === 'function'
      ? raw.normalize('NFD').replace(/[\u0300-\u036f]/g, '')
      : raw;
    const slug = normalized
      .toLowerCase()
      .replace(/[^a-z0-9_-]+/g, '-')
      .replace(/^-+|-+$/g, '')
      .slice(0, 40) || 'item';
    let hash = 2166136261;
    for (let index = 0; index < raw.length; index += 1) {
      hash ^= raw.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `${slug}-${(hash >>> 0).toString(36)}`;
  }

  function controlId(context, itemId, field) {
    return `sim-${context}-${stableIdToken(itemId)}-${field}`;
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

  function normalizeBidMode(value) {
    const mode = String(value || 'sem_lance');
    if (mode === 'proprio') return 'livre';
    return ['sem_lance', 'livre', 'embutido', 'fixo', 'fgts', 'combinado'].includes(mode)
      ? mode
      : 'sem_lance';
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
    item.modalidadeLance = normalizeBidMode(item.modalidadeLance);
    item.lanceEmbutidoPct = Math.max(0, Math.min(limite, Number(item.lanceEmbutidoPct || 0)));
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
        text: 'Adicione pelo menos 1 grupo para avançar'
      };
    }
    return {
      disabled: false,
      text: `Continuar com ${n} grupo${n !== 1 ? 's' : ''}`
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

    const rows = list.map((item) => {
      const idFor = (field) => controlId('selected-group', item.itemId, field);
      const groupContext = `do grupo ${item.codigoGrupo || item.itemId || ''}`.trim();
      return `
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
            <label class="campo-label--usuario" for="${idFor('valor-carta-unitario')}">Por cota <span class="sr-only">${escapeText(groupContext)}</span></label>
            <input
              id="${idFor('valor-carta-unitario')}"
              type="text"
              class="input-usuario"
              aria-label="Valor da carta por cota ${escapeText(groupContext)}"
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
            <label class="campo-label--usuario" for="${idFor('quantidade-cotas')}">Cotas <span class="sr-only">${escapeText(groupContext)}</span></label>
            <input
              id="${idFor('quantidade-cotas')}"
              type="number"
              class="input-usuario input-usuario--qtd"
              aria-label="Quantidade de cotas ${escapeText(groupContext)}"
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
            <label class="campo-label--calculado">Total</label>
            <div class="campo-calculado__valor sg-total-carta">${money(item.valorCartaTotal, helpers)}</div>
          </div>
        </td>
        <td class="sg-remover-cell">
          <button id="${idFor('remover')}" class="btn btn--sm btn--danger" type="button" onclick="App.removerGrupoSelecionado('${escapeText(item.itemId)}')" aria-label="Remover ${escapeText(groupContext)}" title="Remover grupo">x</button>
        </td>
      </tr>
    `;
    }).join('');

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
    if (campo === 'valorCartaUnitario' || campo === 'valorFgts') {
      const value = parseMoney(rawValue, helpers);
      if (campo === 'valorCartaUnitario' && value <= 0) {
        return {
          ok: false,
          value: item.valorCartaUnitario || 0,
          displayValue: number(item.valorCartaUnitario || 0, 2, helpers),
          message: 'Valor da carta deve ser maior que zero.',
          tone: 'error'
        };
      }
      return { ok: true, value: Math.max(0, value) };
    }

    if (campo === 'quantidadeCotas' || campo === 'prazoMeses' || campo === 'mesContemplacaoAlvo' || campo === 'mesAniversario') {
      let value = parseInt(rawValue, 10) || 1;
      if (value < 1) value = 1;
      if (campo === 'mesAniversario' && value > 12) value = 12;
      if (campo === 'mesContemplacaoAlvo' && value > (item.prazoMeses || 1)) {
        value = item.prazoMeses || 1;
        return {
          ok: true,
          value,
          displayValue: String(value),
          message: 'Mês de contemplação ajustado ao prazo do grupo.',
          tone: 'warning'
        };
      }
      return { ok: true, value, displayValue: String(value) };
    }

    if (campo === 'taxaAdmPct' || campo === 'fundoReservaPct' || campo === 'seguroPct'
      || campo === 'indiceReajuste' || campo === 'lanceProprioPct' || campo === 'lanceEmbutidoPct'
      || campo === 'lanceFixoPct' || campo === 'percentualReducao') {
      let value = parseFloat(rawValue) || 0;
      if (value < 0) value = 0;
      if (value > 100) value = 100;
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
      if (campo === 'percentualReducao') {
        const maxReduction = Number(item._group && item._group.reducaoMaxParcelaPct || 0);
        if (maxReduction > 0 && value > maxReduction) {
          value = maxReduction;
          return {
            ok: true,
            value,
            displayValue: String(value),
            message: `Redução ajustada ao limite do grupo (${maxReduction.toFixed(1)}%).`,
            tone: 'warning'
          };
        }
      }
      return { ok: true, value, displayValue: String(value) };
    }

    if (campo === 'parcelaReduzidaAtiva') return { ok: true, value: !!rawValue };

    if (campo === 'modalidadeLance') {
      return { ok: true, value: normalizeBidMode(rawValue) };
    }

    if (['indiceCorrecaoNome', 'politicaSaldo', 'reduzirParcelaOuPrazo'].includes(campo)) {
      return { ok: true, value: String(rawValue || '') };
    }

    return { ok: false, value: undefined };
  }

  function renderDashboardKpis(consolidado = {}, helpers = {}) {
    return [
      { label: 'Crédito total', val: money(consolidado.totalCarta, helpers), cls: '' },
      { label: 'Crédito disponível após lance', val: money(consolidado.cartaLiquida, helpers), cls: 'kpi-row--green' },
      { label: 'Taxa de administração média', val: `${(Number(consolidado.taxaAdmMedia || 0)).toFixed(2)}%`, cls: '' },
      { label: 'Grupos', val: consolidado.totalGrupos, cls: '' },
      { label: 'Cotas', val: consolidado.totalCotas || 0, cls: '' },
      { label: 'Prazo médio', val: `${(Number(consolidado.prazoMedio || 0)).toFixed(0)} meses`, cls: '' },
      { label: 'Lance próprio', val: money(consolidado.totalLanceProprioR, helpers) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Lance embutido', val: money(consolidado.totalLanceEmbutidoR, helpers) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Parcela inicial do projeto', val: money(consolidado.parcelaInicialTotal, helpers), cls: 'kpi-row--red' },
      { label: 'Custo efetivo estimado', val: `${(Number(consolidado.custoEfetivoMedio || 0)).toFixed(2)}%`, cls: 'kpi-row--red' }
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
      const seguroPct = Number(item.seguroPct || 0);
      const indiceReajuste = Number(item.indiceReajuste || 0);
      const mesAniversario = Number(item.mesAniversario || 12);
      const percentualReducao = Number(item.percentualReducao || 0);
      const valorFgts = Number(item.valorFgts || 0);
      const modalidadeLance = normalizeBidMode(item.modalidadeLance);
      const politicaSaldo = item.politicaSaldo || 'carta';
      const efeitoLance = item.reduzirParcelaOuPrazo || 'reduzir_saldo';
      const indiceNome = String(item.indiceCorrecaoNome || 'fixo').toLowerCase();
      const selected = (actual, expected) => actual === expected ? ' selected' : '';
      const idFor = (field) => controlId('project-group', item.itemId, field);
      const groupContext = `do grupo ${item.codigoGrupo || item.itemId || ''}`.trim();
      const appliesOwn = modalidadeLance === 'livre' || modalidadeLance === 'combinado';
      const appliesEmbedded = modalidadeLance === 'embutido' || modalidadeLance === 'combinado';
      const appliesFgts = modalidadeLance === 'fgts' || modalidadeLance === 'combinado';
      const calcValEmb = appliesEmbedded ? valCarta * (pctEmbutido / 100) * qtde : 0;
      const calcValPro = appliesOwn ? valCarta * (pctProprio / 100) * qtde : 0;
      const calcValFixo = modalidadeLance === 'fixo'
        ? valCarta * (Number(item.lanceFixoPct || 0) / 100) * qtde
        : 0;
      const calcValFgts = appliesFgts ? valorFgts * qtde : 0;
      const calcLanceTot = calcValEmb + calcValPro + calcValFixo + calcValFgts;

      return `
        <div class="cart-item-card" data-item-id="${escapeText(item.itemId)}">
          <div class="cart-item-header">
            <div class="cart-item-title">
              <span class="shelf-segment-badge">${escapeText(item.iconSegmento)} ${escapeText(item.nomeSegmento)}</span>
              ${escapeText(item.administradora)} - Grupo ${escapeText(item.codigoGrupo)}
            </div>
            <button id="${idFor('remover')}" class="btn btn--sm btn--danger" type="button" onclick="App.removerGrupoSelecionado('${escapeText(item.itemId)}'); App.recalcularProjeto()" aria-label="Remover ${escapeText(groupContext)}">x Remover</button>
          </div>
          <div class="cart-item-body">
            <div class="cart-grid-container">
              <div class="cart-field">
                <label for="${idFor('quantidade-cotas')}">Quantidade de cotas <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('quantidade-cotas')}" type="number" class="cart-input" aria-label="Quantidade de cotas ${escapeText(groupContext)}" data-campo="quantidadeCotas" value="${qtde}" min="1" max="999" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('valor-carta-unitario')}">Valor da carta por cota (R$) <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('valor-carta-unitario')}" type="text" class="cart-input" aria-label="Valor da carta por cota em reais ${escapeText(groupContext)}" data-money="true" data-campo="valorCartaUnitario" value="${number(valCarta, 2, helpers)}" onblur="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('prazo-meses')}">Prazo do grupo <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('prazo-meses')}" type="number" class="cart-input" aria-label="Prazo em meses ${escapeText(groupContext)}" data-campo="prazoMeses" value="${prazo}" min="1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('taxa-administracao')}">Taxa de administração (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('taxa-administracao')}" type="number" class="cart-input" aria-label="Taxa de administração em percentual ${escapeText(groupContext)}" data-campo="taxaAdmPct" value="${taxa.toFixed(2)}" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('fundo-reserva')}">Fundo de reserva (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('fundo-reserva')}" type="number" class="cart-input" aria-label="Fundo de reserva em percentual ${escapeText(groupContext)}" data-campo="fundoReservaPct" value="${fundo.toFixed(2)}" step="0.01" min="0" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('mes-contemplacao')}">Mês estimado de contemplação <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('mes-contemplacao')}" type="number" class="cart-input" aria-label="Mês estimado de contemplação ${escapeText(groupContext)}" data-campo="mesContemplacaoAlvo" value="${mob}" min="1" max="${prazo}" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('lance-proprio')}">Lance próprio (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('lance-proprio')}" type="number" class="cart-input" aria-label="Lance próprio em percentual ${escapeText(groupContext)}" data-campo="lanceProprioPct" value="${pctProprio}" step="0.1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label for="${idFor('lance-embutido')}">Lance embutido (%)${limiteEmbutido ? ` — máximo ${limiteEmbutido}%` : ''} <span class="sr-only">${escapeText(groupContext)}</span></label>
                <input id="${idFor('lance-embutido')}" type="number" class="cart-input" aria-label="Lance embutido em percentual ${escapeText(groupContext)}" data-campo="lanceEmbutidoPct" value="${pctEmbutido}" step="0.1" min="0" ${limiteEmbutido ? `max="${limiteEmbutido}"` : ''} onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance próprio (R$)</label>
                <div class="cart-calc dyn-val-proprio">${money(calcValPro, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Lance embutido (R$)</label>
                <div class="cart-calc dyn-val-embutido">${money(calcValEmb, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Lance total (R$)</label>
                <div class="cart-calc dyn-val-lancetot">${money(calcLanceTot, helpers)}</div>
              </div>
              <div class="cart-field">
                <label>Crédito líquido</label>
                <div class="cart-calc dyn-val-liq">${money((valCarta * qtde) - calcValEmb, helpers)}</div>
              </div>
            </div>
            <details id="${idFor('parametros')}" class="cart-item-advanced">
              <summary id="${idFor('parametros-resumo')}" aria-controls="${idFor('parametros-conteudo')}" aria-label="Parâmetros ${escapeText(groupContext)}">Parâmetros do grupo</summary>
              <p class="text-muted">Taxas e regras locais permanecem como premissas até a confirmação contratual.</p>
              <div id="${idFor('parametros-conteudo')}" class="cart-grid-container">
                <div class="cart-field">
                  <label for="${idFor('seguro')}">Seguro (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <input id="${idFor('seguro')}" type="number" class="cart-input" aria-label="Seguro em percentual ${escapeText(groupContext)}" data-campo="seguroPct" value="${seguroPct.toFixed(2)}" min="0" max="100" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                </div>
                <div class="cart-field">
                  <label for="${idFor('indice-correcao')}">Índice de correção <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <select id="${idFor('indice-correcao')}" class="cart-input" aria-label="Índice de correção ${escapeText(groupContext)}" data-campo="indiceCorrecaoNome" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                    <option value="fixo"${selected(indiceNome, 'fixo')}>Sem reajuste</option>
                    <option value="ipca"${selected(indiceNome, 'ipca')}>IPCA</option>
                    <option value="incc"${selected(indiceNome, 'incc')}>INCC</option>
                    <option value="igpm"${selected(indiceNome, 'igpm')}>IGP-M</option>
                  </select>
                </div>
                <div class="cart-field">
                  <label for="${idFor('reajuste-anual')}">Reajuste anual assumido (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <input id="${idFor('reajuste-anual')}" type="number" class="cart-input" aria-label="Reajuste anual assumido em percentual ${escapeText(groupContext)}" data-campo="indiceReajuste" value="${indiceReajuste.toFixed(2)}" min="0" max="100" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                </div>
                <div class="cart-field">
                  <label for="${idFor('mes-aniversario')}">Mês de aniversário <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <input id="${idFor('mes-aniversario')}" type="number" class="cart-input" aria-label="Mês de aniversário ${escapeText(groupContext)}" data-campo="mesAniversario" value="${mesAniversario}" min="1" max="12" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                </div>
                <div class="cart-field">
                  <label for="${idFor('modalidade-lance')}">Modalidade de lance <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <select id="${idFor('modalidade-lance')}" class="cart-input" aria-label="Modalidade de lance ${escapeText(groupContext)}" data-campo="modalidadeLance" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                    <option value="sem_lance"${selected(modalidadeLance, 'sem_lance')}>Sem lance</option>
                    <option value="livre"${selected(modalidadeLance, 'livre')}>Próprio</option>
                    <option value="embutido"${selected(modalidadeLance, 'embutido')}>Embutido</option>
                    <option value="fixo"${selected(modalidadeLance, 'fixo')}>Fixo</option>
                    <option value="fgts"${selected(modalidadeLance, 'fgts')}>FGTS</option>
                    <option value="combinado"${selected(modalidadeLance, 'combinado')}>Combinado</option>
                  </select>
                </div>
                <div class="cart-field">
                  <label for="${idFor('valor-fgts')}">FGTS informado (R$) <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <input id="${idFor('valor-fgts')}" type="text" class="cart-input" aria-label="Valor de FGTS informado em reais ${escapeText(groupContext)}" data-money="true" data-campo="valorFgts" value="${number(valorFgts, 2, helpers)}" onblur="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                </div>
                <div class="cart-field">
                  <label for="${idFor('parcela-reduzida')}">Parcela reduzida <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <label class="form-switch">
                    <input id="${idFor('parcela-reduzida')}" type="checkbox" aria-label="Aplicar parcela reduzida antes da contemplação ${escapeText(groupContext)}" data-campo="parcelaReduzidaAtiva" ${item.parcelaReduzidaAtiva ? 'checked' : ''} onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                    <span class="form-switch__track"></span>
                    <span class="form-switch__label">Aplicar antes da contemplação</span>
                  </label>
                </div>
                <div class="cart-field">
                  <label for="${idFor('percentual-reducao')}">Redução da parcela (%) <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <input id="${idFor('percentual-reducao')}" type="number" class="cart-input" aria-label="Redução da parcela em percentual ${escapeText(groupContext)}" data-campo="percentualReducao" value="${percentualReducao.toFixed(2)}" min="0" max="100" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                </div>
                <div class="cart-field">
                  <label for="${idFor('efeito-lance')}">Efeito do lance/antecipação <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <select id="${idFor('efeito-lance')}" class="cart-input" aria-label="Efeito do lance ou antecipação ${escapeText(groupContext)}" data-campo="reduzirParcelaOuPrazo" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                    <option value="reduzir_saldo"${selected(efeitoLance, 'reduzir_saldo')}>Reduzir saldo</option>
                    <option value="reduzir_prazo"${selected(efeitoLance, 'reduzir_prazo')}>Reduzir prazo</option>
                    <option value="reduzir_parcela"${selected(efeitoLance, 'reduzir_parcela')}>Reduzir parcela</option>
                  </select>
                </div>
                <div class="cart-field">
                  <label for="${idFor('politica-saldo')}">Política do saldo <span class="sr-only">${escapeText(groupContext)}</span></label>
                  <select id="${idFor('politica-saldo')}" class="cart-input" aria-label="Política do saldo ${escapeText(groupContext)}" data-campo="politicaSaldo" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
                    <option value="carta"${selected(politicaSaldo, 'carta')}>Carta como principal</option>
                    <option value="carta_mais_custos"${selected(politicaSaldo, 'carta_mais_custos')}>Carta mais custos</option>
                  </select>
                </div>
              </div>
            </details>
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
        ['.dyn-val-lancetot', money(Number.isFinite(Number(result.lanceTotalR)) ? result.lanceTotalR : propR + embR, options)],
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
    normalizeBidMode,
    normalizeEditValue,
    renderDashboardKpis,
    renderStep5CartHtml,
    applyCalculationResults
  };
})(typeof window !== 'undefined' ? window : globalThis);
