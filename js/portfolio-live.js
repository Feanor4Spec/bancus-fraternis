/**
 * Bancus Fraternis portfolio live layer.
 * Re-renders carteira.html with saved simulations plus the current demo base.
 */
(function () {
  'use strict';

  const CATALOG_PATH = `${location.pathname.includes('/pages/') ? '../' : ''}data_base/Tab_Grupos_Consorcio.json`;
  const sourceClients = (typeof clients !== 'undefined' && Array.isArray(clients)) ? clients : [];
  let liveClients = [];
  let catalogSummary = null;

  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });
  const integer = new Intl.NumberFormat('pt-BR');

  const statusClass = {
    'Ativo': 'status-ativo',
    'Contemplado': 'status-contemplado',
    'Em analise': 'status-analise',
    'Em análise': 'status-analise',
    'Em atraso': 'status-atraso',
    'Quitado': 'status-quitado',
    'Cancelado': 'status-cancelado',
    'Prospecção': 'status-analise',
    'Prospecao': 'status-analise'
  };
  const attentionStatuses = new Set(['Em atraso', 'Em análise', 'Em analise', 'Cancelado', 'Prospecção', 'Prospecao']);
  const opportunityStatuses = new Set(['Ativo', 'Em análise', 'Em analise', 'Prospecção', 'Prospecao']);

  function one(id) {
    return document.getElementById(id);
  }

  function esc(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function numberValue(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const raw = value.trim();
    const normalized = raw.includes(',') ? raw.replace(/\./g, '').replace(',', '.') : raw;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function currency(value) {
    return money.format(numberValue(value));
  }

  function dateFmt(value) {
    const fallback = new Date();
    const d = value ? new Date(`${value}`.includes('T') ? value : `${value}T00:00:00`) : fallback;
    return Number.isNaN(d.getTime()) ? fallback.toLocaleDateString('pt-BR') : d.toLocaleDateString('pt-BR');
  }

  function nextAgendaDate(seedDate, offsetDays) {
    const d = seedDate ? new Date(seedDate) : new Date();
    if (Number.isNaN(d.getTime())) d.setTime(Date.now());
    d.setDate(d.getDate() + offsetDays);
    return d.toISOString().slice(0, 10);
  }

  function getStorageApi() {
    try {
      if (typeof Storage !== 'undefined' && Storage && typeof Storage.loadSimulations === 'function') {
        return Storage;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function normalizeSeedClient(client) {
    const carta = numberValue(client.carta);
    const valorPago = numberValue(client.valorPago);
    return {
      ...client,
      source: 'Base demonstrativa',
      carta,
      valorPago,
      parcelasPagas: numberValue(client.parcelasPagas),
      totalParcelas: numberValue(client.totalParcelas) || 1,
      percentualPago: carta ? Math.min(100, (valorPago / carta) * 100) : 0
    };
  }

  function simulationStrategy(item) {
    if (!item) return 'Simulação salva';
    const own = numberValue(item.lanceProprioPct);
    const embedded = numberValue(item.lanceEmbutidoPct);
    if (own && embedded) return 'Lance próprio + embutido';
    if (own) return 'Lance próprio';
    if (embedded) return 'Lance embutido';
    return 'Estratégia em construção';
  }

  function simulationToClient(sim, index) {
    const cart = Array.isArray(sim.carrinho) ? sim.carrinho : [];
    const first = cart[0] || {};
    const carta = numberValue(sim.totalCarta || first.valorCartaUnitario || 0);
    const totalParcelas = numberValue(first.prazoMeses) || numberValue(sim.params && sim.params.prazoTotal) || 180;
    const segmentos = Array.isArray(sim.segmentos) ? sim.segmentos.filter(Boolean) : [];
    const created = sim.criadoEm || new Date().toISOString();

    return {
      cliente: sim.cliente || sim.nome || `Cliente simulado ${index + 1}`,
      administradora: first.administradora || 'Simulação salva',
      grupo: first.codigoGrupo || sim.id || 'SIM',
      cota: String(index + 1).padStart(3, '0'),
      status: 'Prospecção',
      segmento: segmentos[0] || 'Simulação',
      carta,
      valorPago: 0,
      parcelasPagas: 0,
      totalParcelas,
      estrategia: simulationStrategy(first),
      assembleia: nextAgendaDate(created, 7 + index),
      percentualPago: 0,
      source: 'Simulação salva',
      savedId: sim.id,
      consultor: sim.consultor || ''
    };
  }

  function buildClients() {
    const storage = getStorageApi();
    const sims = storage ? storage.loadSimulations({ includeDetails: true }) : [];
    const simulated = sims.map(simulationToClient);
    return sourceClients.map(normalizeSeedClient).concat(simulated);
  }

  function byCountDesc(obj) {
    return Object.entries(obj).sort((a, b) => b[1] - a[1]);
  }

  function countBy(data, key) {
    return data.reduce((acc, item) => {
      const label = item[key] || 'Não informado';
      acc[label] = (acc[label] || 0) + 1;
      return acc;
    }, {});
  }

  function setEmpty(targetId, message) {
    const el = one(targetId);
    if (el) el.innerHTML = `<div class="hm-empty-state">${esc(message)}</div>`;
  }

  function renderBars(targetId, entries, max) {
    const el = one(targetId);
    if (!el) return;
    if (!entries.length) {
      el.innerHTML = '<div class="hm-empty-state">Sem dados para o filtro atual.</div>';
      return;
    }
    el.innerHTML = entries.map(([name, count]) => `
      <div class="bar-item">
        <label>${esc(name)}</label>
        <div class="bar-track"><span style="width:${Math.max(5, (count / max) * 100)}%"></span></div>
        <div class="bar-value">${integer.format(count)} registro${count === 1 ? '' : 's'}</div>
      </div>
    `).join('');
  }

  function opportunityScore(client) {
    const segmentBoost = client.segmento === 'Imóveis' ? 6 : 0;
    const sourceBoost = client.source === 'Simulação salva' ? 4 : 0;
    const attentionBoost = attentionStatuses.has(client.status) ? 2 : 0;
    return numberValue(client.percentualPago) + segmentBoost + sourceBoost + attentionBoost;
  }

  function renderPortfolioDecision(data, summary) {
    const target = document.querySelector('[data-portfolio-decision-strip]');
    if (!target) return;

    const total = data.length || 1;
    const atrasados = data.filter(client => client.status === 'Em atraso').length;
    const emAnalise = data.filter(client => ['Em análise', 'Em analise'].includes(client.status)).length;
    const emAtencao = data.filter(client => attentionStatuses.has(client.status)).length;
    const simulacoes = data.filter(client => client.source === 'Simulação salva').length;
    const pipeline = data.filter(client => client.source === 'Simulação salva' || ['Prospecção', 'Prospecao'].includes(client.status)).length;
    const riscoPct = ((atrasados + emAnalise) / total) * 100;
    const maturidadePct = summary.totalCarta ? Math.min(100, (summary.totalPago / summary.totalCarta) * 100) : 0;
    const proximaAgenda = data
      .filter(client => client.assembleia)
      .slice()
      .sort((a, b) => new Date(a.assembleia) - new Date(b.assembleia))[0];
    const oportunidade = data
      .filter(client => opportunityStatuses.has(client.status))
      .slice()
      .sort((a, b) => opportunityScore(b) - opportunityScore(a))[0];

    const prioridade = riscoPct >= 18
      ? 'Priorizar regularização'
      : simulacoes > 0
        ? 'Retomar simulações salvas'
        : 'Avançar oportunidades ativas';

    const decisionCards = [
      {
        tone: riscoPct >= 18 ? 'warning' : 'stable',
        eyebrow: 'Prioridade',
        title: prioridade,
        body: `${integer.format(atrasados)} em atraso, ${integer.format(emAnalise)} em análise e ${integer.format(emAtencao)} registros no radar operacional.`,
        action: riscoPct >= 18 ? 'Filtrar carteira em atenção' : 'Manter régua ativa'
      },
      {
        tone: simulacoes > 0 ? 'info' : 'stable',
        eyebrow: 'Pipeline',
        title: `${integer.format(simulacoes)} simulação${simulacoes === 1 ? '' : 'ões'} salva${simulacoes === 1 ? '' : 's'}`,
        body: `${integer.format(pipeline)} registro${pipeline === 1 ? '' : 's'} pode${pipeline === 1 ? '' : 'm'} virar proposta assistida com dados do simulador.`,
        action: 'Retomar propostas no simulador'
      },
      {
        tone: 'info',
        eyebrow: 'Agenda',
        title: proximaAgenda ? `${dateFmt(proximaAgenda.assembleia)} - ${proximaAgenda.cliente}` : 'Sem agenda no filtro',
        body: proximaAgenda
          ? `${proximaAgenda.segmento} em ${proximaAgenda.administradora}, estratégia ${proximaAgenda.estrategia}.`
          : 'Ajuste os filtros ou salve novas simulações para formar a próxima agenda.',
        action: 'Planejar próximo contato'
      },
      {
        tone: oportunidade ? 'stable' : 'info',
        eyebrow: 'Oportunidade',
        title: oportunidade ? oportunidade.cliente : 'Sem lead priorizado',
        body: oportunidade
          ? `${currency(oportunidade.carta)} em carta, ${oportunidade.percentualPago.toFixed(1)}% pago e ${currency(numberValue(oportunidade.carta) - numberValue(oportunidade.valorPago))} em aberto.`
          : `${maturidadePct.toFixed(1)}% de maturidade financeira na visão filtrada.`,
        action: 'Conectar produto, comparador e handoff'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Decisão operacional</span>
        <div>
          <h2>Carteira em modo próximo passo.</h2>
          <p>A leitura combina clientes, simulações salvas, risco, maturidade e agenda para orientar a atuação do consultor.</p>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        ${decisionCards.map((card) => `
          <article class="bf-v8-decision-card bf-v8-decision-card--${card.tone}">
            <span>${esc(card.eyebrow)}</span>
            <strong>${esc(card.title)}</strong>
            <p>${esc(card.body)}</p>
            <small>${esc(card.action)}</small>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderDashboard(data) {
    const totalClientes = data.length;
    const totalCarta = data.reduce((sum, client) => sum + numberValue(client.carta), 0);
    const totalPago = data.reduce((sum, client) => sum + numberValue(client.valorPago), 0);
    const contemplados = data.filter(client => client.status === 'Contemplado').length;
    const emRisco = data.filter(client => ['Em atraso', 'Em análise', 'Em analise'].includes(client.status)).length;
    const simulacoes = data.filter(client => client.source === 'Simulação salva').length;
    const ticketMedio = totalClientes ? totalCarta / totalClientes : 0;

    const kpis = [
      { value: integer.format(totalClientes), label: 'Registros na carteira', hint: 'Clientes demonstrativos + simulações salvas.' },
      { value: currency(totalCarta), label: 'Carteira total de crédito', hint: 'Soma de cartas acompanhadas nesta visão.' },
      { value: currency(totalPago), label: 'Valor já pago', hint: 'Acumulado pago nos contratos acompanhados.' },
      { value: integer.format(contemplados), label: 'Clientes contemplados', hint: 'Base já com direito ao crédito.' },
      { value: integer.format(emRisco), label: 'Clientes em atenção', hint: 'Em atraso ou em análise.' },
      { value: currency(ticketMedio), label: 'Carta média', hint: `${integer.format(simulacoes)} simulação${simulacoes === 1 ? '' : 'ões'} salva${simulacoes === 1 ? '' : 's'}.` }
    ];

    const kpiGrid = one('kpi-grid');
    if (kpiGrid) {
      kpiGrid.innerHTML = kpis.map(kpi => `
        <article class="exec-kpi">
          <strong>${esc(kpi.value)}</strong>
          <span>${esc(kpi.label)}</span>
          <small>${esc(kpi.hint)}</small>
        </article>
      `).join('');
    }

    const statusCounts = countBy(data, 'status');
    const adminCounts = countBy(data, 'administradora');
    const segmentCounts = countBy(data, 'segmento');

    renderBars('status-bars', byCountDesc(statusCounts), Math.max(1, ...Object.values(statusCounts)));
    renderBars('admin-bars', byCountDesc(adminCounts), Math.max(1, ...Object.values(adminCounts)));
    renderBars('segment-bars', byCountDesc(segmentCounts), Math.max(1, ...Object.values(segmentCounts)));

    renderOpportunities(data);
    renderAttention(data);
    renderGroups(data);
    renderInsights(data, segmentCounts, contemplados, emRisco);
    renderAgenda(data);
    renderPortfolioDecision(data, { totalClientes, totalCarta, totalPago, contemplados, emRisco, simulacoes, ticketMedio });
    renderHeroHighlights(data, totalCarta, totalClientes);
  }

  function renderOpportunities(data) {
    const target = one('opportunity-list');
    if (!target) return;
    const rows = data
      .filter(client => opportunityStatuses.has(client.status))
      .sort((a, b) => opportunityScore(b) - opportunityScore(a))
      .slice(0, 5);
    if (!rows.length) return setEmpty('opportunity-list', 'Sem oportunidades no filtro atual.');
    target.innerHTML = rows.map(client => `
      <div class="rank-item">
        <div class="rank-top">
          <div>
            <strong>${esc(client.cliente)}</strong>
            <span>${esc(client.administradora)} - Grupo ${esc(client.grupo)} / Cota ${esc(client.cota)}</span>
          </div>
          <span class="status-badge ${statusClass[client.status] || 'status-analise'}">${esc(client.status)}</span>
        </div>
        <div class="progress"><span style="width:${Math.min(100, Math.max(4, client.percentualPago))}%"></span></div>
        <div class="progress-meta"><span>${esc(client.estrategia)}</span><span>${client.percentualPago.toFixed(1)}% pago sobre a carta</span></div>
      </div>
    `).join('');
  }

  function renderAttention(data) {
    const target = one('attention-list');
    if (!target) return;
    const rows = data
      .filter(client => attentionStatuses.has(client.status))
      .sort((a, b) => new Date(a.assembleia) - new Date(b.assembleia))
      .slice(0, 5);
    if (!rows.length) return setEmpty('attention-list', 'Nenhum registro em atenção no filtro atual.');
    target.innerHTML = rows.map(client => `
      <div class="rank-item">
        <div class="rank-top">
          <div>
            <strong>${esc(client.cliente)}</strong>
            <span>${esc(client.segmento)} - agenda em ${dateFmt(client.assembleia)}</span>
          </div>
          <span class="status-badge ${statusClass[client.status] || 'status-analise'}">${esc(client.status)}</span>
        </div>
        <div class="progress-meta"><span>${esc(client.administradora)} - Grupo ${esc(client.grupo)} / Cota ${esc(client.cota)}</span><span>${currency(client.valorPago)} pago</span></div>
      </div>
    `).join('');
  }

  function renderGroups(data) {
    const target = one('group-ranking');
    if (!target) return;
    const grouped = {};
    data.forEach(client => {
      const key = `${client.administradora || 'Não informado'} - Grupo ${client.grupo || 's/n'}`;
      if (!grouped[key]) grouped[key] = { clientes: 0, carta: 0, pago: 0, contemplados: 0, real: 0 };
      grouped[key].clientes += 1;
      grouped[key].carta += numberValue(client.carta);
      grouped[key].pago += numberValue(client.valorPago);
      grouped[key].real += client.source === 'Simulação salva' ? 1 : 0;
      if (client.status === 'Contemplado') grouped[key].contemplados += 1;
    });

    const rows = Object.entries(grouped).sort((a, b) => b[1].carta - a[1].carta).slice(0, 6);
    if (!rows.length) return setEmpty('group-ranking', 'Sem grupos no filtro atual.');
    target.innerHTML = rows.map(([name, stats]) => {
      const maturity = stats.carta ? (stats.pago / stats.carta) * 100 : 0;
      return `
        <div class="rank-item">
          <div class="rank-top">
            <div>
              <strong>${esc(name)}</strong>
              <span>${integer.format(stats.clientes)} registro${stats.clientes === 1 ? '' : 's'} - ${integer.format(stats.contemplados)} contemplado${stats.contemplados === 1 ? '' : 's'} - ${integer.format(stats.real)} simulação${stats.real === 1 ? '' : 'ões'} salva${stats.real === 1 ? '' : 's'}</span>
            </div>
            <strong>${currency(stats.carta)}</strong>
          </div>
          <div class="progress"><span style="width:${Math.min(100, Math.max(4, maturity))}%"></span></div>
          <div class="progress-meta"><span>${currency(stats.pago)} já pago</span><span>${maturity.toFixed(1)}% de maturidade financeira</span></div>
        </div>
      `;
    }).join('');
  }

  function renderInsights(data, segmentCounts, contemplados, emRisco) {
    const target = one('insight-grid');
    if (!target) return;
    const total = data.length || 1;
    const topSegment = byCountDesc(segmentCounts)[0] || ['Sem segmento', 0];
    const saved = data.filter(client => client.source === 'Simulação salva').length;
    const delayed = data.filter(client => client.status === 'Em atraso').length;
    target.innerHTML = `
      <article class="insight-card"><h3>Mix dominante</h3><p>${((topSegment[1] / total) * 100).toFixed(1)}% da visão atual está em ${esc(topSegment[0])}. Use o filtro de segmento para separar leitura comercial e risco operacional.</p></article>
      <article class="insight-card"><h3>Pipeline real do simulador</h3><p>${integer.format(saved)} simulação${saved === 1 ? '' : 'ões'} salva${saved === 1 ? '' : 's'} já entra${saved === 1 ? '' : 'm'} na carteira como prospecção, conectando a página ao fluxo real de proposta.</p></article>
      <article class="insight-card"><h3>Prioridade de acompanhamento</h3><p>${integer.format(emRisco)} registro${emRisco === 1 ? '' : 's'} em atenção e ${integer.format(delayed)} em atraso. A régua comercial deve priorizar regularização, análise e retomada de simulações recentes.</p></article>
    `;
    const tag = one('tag-sims');
    if (tag) tag.textContent = `${saved} simulação${saved === 1 ? '' : 'ões'}`;
  }

  function renderAgenda(data) {
    const target = one('agenda-list');
    if (!target) return;
    const rows = data.slice().sort((a, b) => new Date(a.assembleia) - new Date(b.assembleia)).slice(0, 8);
    if (!rows.length) return setEmpty('agenda-list', 'Sem agenda para o filtro atual.');
    target.innerHTML = rows.map(client => `
      <div class="agenda-item">
        <strong>${dateFmt(client.assembleia)} - ${esc(client.cliente)}</strong>
        <span>${esc(client.administradora)} - Grupo ${esc(client.grupo)} / Cota ${esc(client.cota)} - ${esc(client.segmento)} - ${esc(client.estrategia)}</span>
      </div>
    `).join('');
  }

  function renderHeroHighlights(data, totalCarta, totalClientes) {
    const target = one('hero-highlights');
    if (!target) return;
    const saved = data.filter(client => client.source === 'Simulação salva').length;
    const delayed = data.filter(client => client.status === 'Em atraso').length;
    const top = data.slice().sort((a, b) => numberValue(b.carta) - numberValue(a.carta))[0];
    target.innerHTML = `
      <div class="mini-item"><strong>${currency(totalCarta)}</strong><span>volume consolidado em ${integer.format(totalClientes)} registros renderizados nesta visão.</span></div>
      <div class="mini-item"><strong>${top ? esc(top.cliente) : 'Sem prioridade'}</strong><span>${top ? `maior carta atual: ${currency(top.carta)} em ${esc(top.segmento)}.` : 'Ajuste os filtros para recalcular prioridades.'}</span></div>
      <div class="mini-item"><strong>${integer.format(saved)} simulação${saved === 1 ? '' : 'ões'} salva${saved === 1 ? '' : 's'}</strong><span>${integer.format(delayed)} cliente${delayed === 1 ? '' : 's'} em atraso na base demonstrativa.</span></div>
    `;
  }

  function renderTable(data) {
    const target = one('client-table');
    if (!target) return;
    if (!data.length) {
      target.innerHTML = '<tr><td colspan="10" style="padding:24px 16px;text-align:center;color:#64748b;">Nenhum cliente encontrado para os filtros aplicados.</td></tr>';
      return;
    }
    target.innerHTML = data.map(client => `
      <tr>
        <td>
          <div class="client-cell">
            <strong>${esc(client.cliente)}</strong>
            <span>${integer.format(client.parcelasPagas)}/${integer.format(client.totalParcelas)} parcelas - ${esc(client.source)}</span>
            ${client.savedId ? `<a class="bf-resume-link" href="simulador.html?simulationId=${encodeURIComponent(client.savedId)}">Retomar simulação</a>` : ''}
          </div>
        </td>
        <td>${esc(client.administradora)}</td>
        <td><strong>${esc(client.grupo)}</strong> / ${esc(client.cota)}</td>
        <td><span class="status-badge ${statusClass[client.status] || 'status-analise'}">${esc(client.status)}</span></td>
        <td>${esc(client.segmento)}</td>
        <td class="money">${currency(client.carta)}</td>
        <td class="money">${currency(client.valorPago)}</td>
        <td>
          <div class="progress"><span style="width:${Math.min(100, Math.max(4, client.percentualPago))}%"></span></div>
          <div class="progress-meta"><span>${client.percentualPago.toFixed(1)}%</span><span>${currency(numberValue(client.carta) - numberValue(client.valorPago))} em aberto</span></div>
        </td>
        <td>${esc(client.estrategia)}</td>
        <td>${dateFmt(client.assembleia)}</td>
      </tr>
    `).join('');
  }

  function resetFilter(id, label, values) {
    const el = one(id);
    if (!el) return;
    el.innerHTML = `<option value="">${esc(label)}</option>`;
    values.forEach(value => {
      const opt = document.createElement('option');
      opt.value = value;
      opt.textContent = value;
      el.appendChild(opt);
    });
  }

  function setupFilters(data) {
    resetFilter('status-filter', 'Todos os status', [...new Set(data.map(c => c.status))].sort());
    resetFilter('admin-filter', 'Todas as administradoras', [...new Set(data.map(c => c.administradora))].sort());
    resetFilter('segment-filter', 'Todos os segmentos', [...new Set(data.map(c => c.segmento))].sort());

    ['search-input', 'status-filter', 'admin-filter', 'segment-filter'].forEach(id => {
      const el = one(id);
      if (el) el.addEventListener(id === 'search-input' ? 'input' : 'change', applyFilters);
    });
  }

  function applyFilters() {
    const q = (one('search-input')?.value || '').trim().toLowerCase();
    const status = one('status-filter')?.value || '';
    const admin = one('admin-filter')?.value || '';
    const segment = one('segment-filter')?.value || '';
    const filtered = liveClients.filter(client => {
      const haystack = [client.cliente, client.administradora, client.grupo, client.cota, client.segmento, client.estrategia, client.source].join(' ').toLowerCase();
      return (!q || haystack.includes(q))
        && (!status || client.status === status)
        && (!admin || client.administradora === admin)
        && (!segment || client.segmento === segment);
    });
    renderDashboard(filtered);
    renderTable(filtered);
  }

  function insertSourcePanel() {
    const hero = document.querySelector('.hero');
    if (!hero || document.getElementById('portfolio-live-source')) return;
    const saved = liveClients.filter(client => client.source === 'Simulação salva').length;
    const demo = liveClients.length - saved;
    const totalCatalog = catalogSummary ? integer.format(catalogSummary.total) : 'Carregando';
    const activeCatalog = catalogSummary ? integer.format(catalogSummary.active) : 'Carregando';
    const panel = document.createElement('section');
    panel.className = 'bf-live-source';
    panel.id = 'portfolio-live-source';
    panel.innerHTML = `
      <div>
        <span class="bf-badge bf-badge--gold">Carteira viva</span>
        <h2>Pipeline comercial conectado ao simulador.</h2>
        <p>A carteira agora combina a base demonstrativa de clientes com as simulações salvas neste navegador e usa a base real de grupos como referência de mercado.</p>
        <div class="bf-live-note">Fonte atual: ${integer.format(saved)} simulação${saved === 1 ? '' : 'ões'} salva${saved === 1 ? '' : 's'} + ${integer.format(demo)} registros demonstrativos</div>
      </div>
      <div class="bf-source-grid">
        <div class="bf-mini-stat"><span>Base real</span><strong>${totalCatalog}</strong><small>grupos no catálogo</small></div>
        <div class="bf-mini-stat"><span>Ativos</span><strong>${activeCatalog}</strong><small>status comercial ativo</small></div>
        <div class="bf-mini-stat"><span>Carteira</span><strong>${integer.format(liveClients.length)}</strong><small>registros renderizados</small></div>
        <div class="bf-mini-stat"><span>Simulador</span><strong>${integer.format(saved)}</strong><small>prospecções salvas</small></div>
      </div>
    `;
    hero.insertAdjacentElement('afterend', panel);
  }

  async function loadCatalogSummary() {
    try {
      const response = await fetch(CATALOG_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const rows = await response.json();
      const valid = Array.isArray(rows) ? rows : [];
      catalogSummary = {
        total: valid.length,
        active: valid.filter(row => String(row.statusComercial || '').toLowerCase() === 'ativo').length
      };
    } catch (error) {
      catalogSummary = { total: 0, active: 0 };
      console.warn('Carteira: base real indisponível para resumo', error);
    }
  }

  async function init() {
    liveClients = buildClients();
    setupFilters(liveClients);
    renderDashboard(liveClients);
    renderTable(liveClients);
    insertSourcePanel();
    await loadCatalogSummary();
    insertSourcePanel();
    const existing = one('portfolio-live-source');
    if (existing) existing.remove();
    insertSourcePanel();
  }

  document.addEventListener('DOMContentLoaded', init);
})();
