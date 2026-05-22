(function () {
  'use strict';

  let selectedId = '';
  let backendLeadState = {
    loading: false,
    loaded: false,
    leads: [],
    error: null,
    refreshedAt: ''
  };

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function money(value) {
    return window.BFFormatters ? window.BFFormatters.currency(value) : `R$ ${Number(value || 0).toFixed(2)}`;
  }

  function percent(value) {
    return window.BFFormatters ? window.BFFormatters.percent(value, 1) : `${Number(value || 0).toFixed(1)}%`;
  }

  function date(value) {
    if (!value) return '-';
    try {
      return new Intl.DateTimeFormat('pt-BR', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      }).format(new Date(value));
    } catch (error) {
      return value;
    }
  }

  function service() {
    return window.BFHandoffConsultivoService;
  }

  function recoveryService() {
    return window.BFJourneyRecoveryService;
  }

  function recoverySignals(options = {}) {
    const recovery = recoveryService();
    return recovery && recovery.list ? recovery.list({ includeComplete: true, ...options }) : [];
  }

  function backendApi() {
    return window.BFBackendApi && typeof window.BFBackendApi === 'object' ? window.BFBackendApi : null;
  }

  function currentActor() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return {
      email: user && user.email ? user.email : 'anon',
      role: user && user.role ? user.role : 'anon'
    };
  }

  function recentTimestamp(item) {
    return String((item && (item.updatedAt || item.createdAt || item.criadoEm || item.atualizadoEm)) || '');
  }

  function backendPayload(row) {
    return row && row.payload && typeof row.payload === 'object' && !Array.isArray(row.payload) ? row.payload : {};
  }

  function normalizeBackendLead(row) {
    if (!row) return null;
    const payload = backendPayload(row);
    const summary = payload.summary && typeof payload.summary === 'object' ? payload.summary : {};
    const stageKey = row.stage || payload.stage || (payload.commercialStage && payload.commercialStage.key) || 'contato';
    const status = row.status || payload.status || 'novo';
    const priority = row.priority || payload.priority || payload.prioridade || 'media';
    return {
      ...payload,
      id: row.id || payload.id || payload.handoffId || '',
      schema: payload.schema || 'bank-fratern.consultive-handoff.v1',
      sourceType: payload.sourceType || payload.origem || '',
      ownerEmail: row.ownerEmail || payload.ownerEmail || '',
      ownerName: payload.ownerName || row.ownerEmail || '',
      objective: payload.objective || payload.objetivo || '',
      objectiveLabel: row.title || payload.objectiveLabel || payload.title || 'Lead server-side',
      status,
      priority,
      assignedTo: payload.assignedTo || row.assignedTo || '',
      summary: {
        ...summary,
        valorCredito: Number(summary.valorCredito || summary.ticket || row.amount || 0),
        productName: summary.productName || payload.productName || payload.product || row.source || 'SQLite local',
        modelName: summary.modelName || payload.modelName || row.stage || 'Registro vivo'
      },
      checklist: Array.isArray(payload.checklist) ? payload.checklist : [],
      notes: Array.isArray(payload.notes) ? payload.notes : [],
      timeline: Array.isArray(payload.timeline) ? payload.timeline : [],
      commercialStage: payload.commercialStage && typeof payload.commercialStage === 'object'
        ? { ...payload.commercialStage, key: payload.commercialStage.key || stageKey }
        : { key: stageKey },
      createdAt: row.createdAt || payload.createdAt || '',
      updatedAt: row.updatedAt || payload.updatedAt || payload.createdAt || '',
      _backendLead: true,
      _backendMaterializedTable: row.materializedTable || 'journey_leads',
      _backendStage: stageKey,
      _backendSource: row.source || 'handoff-consultivo'
    };
  }

  function mergeLiveHandoffs(localItems, backendItems) {
    const byId = new Map();
    (localItems || []).filter(Boolean).forEach((item) => {
      const key = item.id || `local-${byId.size}`;
      byId.set(key, item);
    });

    (backendItems || []).filter(Boolean).forEach((item) => {
      const key = item.id || `backend-${byId.size}`;
      const local = byId.get(key);
      if (!local) {
        byId.set(key, item);
        return;
      }
      byId.set(key, {
        ...local,
        ...item,
        sourceType: item.sourceType || local.sourceType || '',
        summary: { ...(local.summary || {}), ...(item.summary || {}) },
        checklist: item.checklist && item.checklist.length ? item.checklist : (local.checklist || []),
        notes: item.notes && item.notes.length ? item.notes : (local.notes || []),
        timeline: item.timeline && item.timeline.length ? item.timeline : (local.timeline || []),
        createdAt: recentTimestamp(local) && recentTimestamp(local) < recentTimestamp(item) ? local.createdAt : (item.createdAt || local.createdAt),
        updatedAt: recentTimestamp(local) > recentTimestamp(item) ? local.updatedAt : (item.updatedAt || local.updatedAt)
      });
    });

    return Array.from(byId.values()).sort((a, b) => recentTimestamp(b).localeCompare(recentTimestamp(a)));
  }

  function operationalItems() {
    const localItems = service().list ? service().list() : [];
    const merged = mergeLiveHandoffs(localItems, backendLeadState.leads);
    return service().enrichList ? service().enrichList(merged) : merged;
  }

  function hydrateAssigneeOptions(items) {
    const select = qs('[data-handoff-assignee-filter]');
    if (!select) return;
    const current = select.value || '';
    const assignees = Array.from(new Set((items || [])
      .map((item) => item.assignedTo || (item.operational && item.operational.suggestedAssignee) || '')
      .filter(Boolean)))
      .sort((a, b) => a.localeCompare(b));
    select.innerHTML = `
      <option value="">Todos</option>
      <option value="sem_responsavel">Sem responsavel</option>
      ${assignees.map((email) => `<option value="${escapeHtml(email)}">${escapeHtml(email)}</option>`).join('')}
    `;
    if (current && Array.from(select.options).some((option) => option.value === current)) {
      select.value = current;
    }
  }

  function matchesAging(item, aging) {
    if (!aging) return true;
    const op = item.operational || {};
    if (aging === 'sla') return op.slaOverdue === true;
    if (aging === '24h') return Number(op.hours || 0) >= 24;
    if (aging === '72h') return Number(op.hours || 0) >= 72;
    if (aging === 'aguardando') return op.waitingClient === true;
    return true;
  }

  function filtered(itemsInput) {
    const items = itemsInput || operationalItems();
    const search = (qs('[data-handoff-search]')?.value || '').trim().toLowerCase();
    const status = qs('[data-handoff-status-filter]')?.value || '';
    const priority = qs('[data-handoff-priority-filter]')?.value || '';
    const source = qs('[data-handoff-source-filter]')?.value || '';
    const assignee = qs('[data-handoff-assignee-filter]')?.value || '';
    const aging = qs('[data-handoff-aging-filter]')?.value || '';

    return items.filter((item) => {
      const itemSource = sourceType(item);
      const op = item.operational || {};
      const itemAssignee = item.assignedTo || op.suggestedAssignee || '';
      const haystack = [
        item.id,
        item.ownerEmail,
        item.ownerName,
        item.objectiveLabel,
        item.assignedTo,
        op.nextStep,
        op.ageLabel,
        sourceLabel(item),
        item.summary && item.summary.productName,
        item.summary && item.summary.modelName,
        item.nextAction && item.nextAction.title
      ].join(' ').toLowerCase();
      return (!search || haystack.includes(search))
        && (!status || item.status === status)
        && (!priority || item.priority === priority)
        && (!source || itemSource === source)
        && (!assignee || (assignee === 'sem_responsavel' ? !item.assignedTo : itemAssignee === assignee))
        && matchesAging(item, aging);
    });
  }

  function metric(label, value, tone = '') {
    return `<article class="bf-platform-metric${tone ? ` is-${tone}` : ''}"><small>${escapeHtml(label)}</small><strong>${escapeHtml(value)}</strong></article>`;
  }

  async function loadBackendLeads() {
    const api = backendApi();
    if (!api || typeof api.available !== 'function' || !api.available() || typeof api.listLeads !== 'function') {
      backendLeadState = {
        loading: false,
        loaded: false,
        leads: [],
        error: null,
        refreshedAt: new Date().toISOString()
      };
      document.body.dataset.handoffLiveDataReady = 'fallback';
      document.body.dataset.handoffLiveLeadCount = '0';
      return false;
    }

    backendLeadState = {
      ...backendLeadState,
      loading: true,
      error: null
    };
    document.body.dataset.handoffLiveDataReady = 'loading';

    const result = await api.listLeads(80);
    if (!result || !result.ok || !Array.isArray(result.leads)) {
      backendLeadState = {
        loading: false,
        loaded: false,
        leads: [],
        error: result && result.message ? result.message : 'Nao foi possivel ler leads vivos.',
        refreshedAt: new Date().toISOString()
      };
      document.body.dataset.handoffLiveDataReady = 'error';
      document.body.dataset.handoffLiveLeadCount = '0';
      return false;
    }

    backendLeadState = {
      loading: false,
      loaded: true,
      leads: result.leads.map(normalizeBackendLead).filter((item) => item && item.id),
      error: null,
      refreshedAt: new Date().toISOString()
    };
    document.body.dataset.handoffLiveDataReady = 'true';
    document.body.dataset.handoffLiveLeadCount = String(backendLeadState.leads.length);
    return true;
  }

  function liveHandoffById(id) {
    if (!id) return null;
    return operationalItems().find((item) => item.id === id) || null;
  }

  function backendWritablePayload(item) {
    if (!item) return {};
    const {
      _backendLead,
      _backendMaterializedTable,
      _backendStage,
      _backendSource,
      operational,
      ...payload
    } = item;
    return payload;
  }

  function updateBackendLeadState(id, updater) {
    let nextRecord = null;
    backendLeadState = {
      ...backendLeadState,
      leads: backendLeadState.leads.map((item) => {
        if (!item || item.id !== id) return item;
        const patch = typeof updater === 'function' ? updater(item) : updater;
        nextRecord = {
          ...item,
          ...(patch || {}),
          _backendLead: true,
          updatedAt: new Date().toISOString()
        };
        return nextRecord;
      })
    };
    return nextRecord;
  }

  function syncBackendLead(item, patch = {}) {
    const api = backendApi();
    if (!item || !item.id || !api || typeof api.available !== 'function' || !api.available() || typeof api.updateLead !== 'function') {
      return Promise.resolve({ ok: false, message: 'Backend indisponivel.' });
    }
    const next = {
      ...item,
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    };
    const payload = backendWritablePayload(next);
    return api.updateLead(next.id, {
      title: next.objectiveLabel || next.title || next.id,
      status: next.status || 'novo',
      stage: (next.commercialStage && next.commercialStage.key) || next._backendStage || 'contato',
      priority: next.priority || 'media',
      source: next._backendSource || 'handoff-consultivo',
      amount: Number((next.summary && (next.summary.valorCredito || next.summary.ticket || next.summary.capacidadePagamento)) || 0),
      payload,
      updatedAt: next.updatedAt
    }).then((result) => {
      if (result && result.ok && result.lead) {
        const normalized = normalizeBackendLead(result.lead);
        if (normalized) {
          backendLeadState = {
            ...backendLeadState,
            loaded: true,
            error: null,
            leads: backendLeadState.leads.map((record) => record.id === normalized.id ? normalized : record)
          };
          document.body.dataset.handoffLiveDataReady = 'true';
        }
      } else if (result && result.message) {
        backendLeadState = { ...backendLeadState, error: result.message };
        document.body.dataset.handoffLiveDataReady = 'error';
      }
      return result;
    }).catch((error) => {
      backendLeadState = {
        ...backendLeadState,
        error: error && error.message ? error.message : 'Falha ao sincronizar lead vivo.'
      };
      document.body.dataset.handoffLiveDataReady = 'error';
      return { ok: false, message: backendLeadState.error };
    });
  }

  function renderLiveDataPanel(allItems, filteredItems) {
    const target = qs('[data-handoff-live-data-panel]');
    if (!target) return;
    const localCount = service().list ? service().list().length : 0;
    const liveCount = backendLeadState.leads.length;
    const mergedCount = (allItems || operationalItems()).length;
    const visibleCount = (filteredItems || allItems || []).length;
    const source = backendLeadState.loaded ? 'sqlite' : 'localStorage';
    const readiness = backendLeadState.loading ? 'loading' : backendLeadState.loaded ? 'true' : backendLeadState.error ? 'error' : 'fallback';
    const sourceLabel = backendLeadState.loaded ? 'SQLite local' : 'localStorage';
    const copy = backendLeadState.loading
      ? 'Atualizando fila server-side.'
      : backendLeadState.loaded
        ? (liveCount
          ? 'Leads vivos do SQLite foram mesclados com a fila local para priorizacao consultiva.'
          : 'API local ativa; nenhum lead vivo retornado para este usuario, e a fila local permanece disponivel.')
        : 'A fila continua operacional via localStorage; use localhost com login para ativar a leitura de leads vivos.';

    target.dataset.handoffLiveSource = source;
    target.dataset.handoffLiveRefresh = backendLeadState.refreshedAt || '';
    document.body.dataset.handoffLiveDataReady = readiness;
    document.body.dataset.handoffLiveDataSource = source;
    document.body.dataset.handoffLiveLeadCount = String(liveCount);
    document.body.dataset.handoffLiveMergedCount = String(mergedCount);

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge ${liveCount ? 'bf-badge--ok' : 'bf-badge--gold'}" data-handoff-live-source="${escapeHtml(source)}">${escapeHtml(sourceLabel)}</span>
          <h2>Fila consultiva com dados vivos</h2>
          <p>${escapeHtml(copy)}</p>
          ${backendLeadState.error ? `<small>${escapeHtml(backendLeadState.error)}</small>` : ''}
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-handoff-live-refresh>${backendLeadState.loading ? 'Atualizando...' : 'Atualizar fila'}</button>
      </div>
      <div class="bf-platform-metrics">
        ${metric('Leads vivos', liveCount, liveCount ? 'strong' : '')}
        ${metric('Leads locais', localCount)}
        ${metric('Fila unificada', mergedCount, mergedCount ? 'strong' : '')}
        ${metric('Visiveis no filtro', visibleCount)}
        ${metric('Fonte', sourceLabel)}
      </div>
    `;
  }

  function renderMetrics(items) {
    const target = qs('[data-handoff-metrics]');
    if (!target) return;
    const data = service().metrics(items);
    target.innerHTML = `
      <div class="bf-platform-metrics">
        ${metric('Leads na fila', data.total, 'strong')}
        ${metric('Em aberto', data.open)}
        ${metric('Alta prioridade', data.highPriority, data.highPriority ? 'warn' : '')}
        ${metric('SLA vencido', data.overdue || 0, data.overdue ? 'warn' : '')}
        ${metric('Sem responsavel', data.unassigned || 0, data.unassigned ? 'warn' : '')}
        ${metric('Propostas', data.proposal || 0)}
        ${metric('Trilhas', data.journey || 0)}
        ${metric('Retomadas', (data.signal || 0) + (data.imported || 0))}
        ${metric('Checklist medio', `${data.completion}%`)}
      </div>
    `;
  }

  function renderOperationalStrip(items) {
    const target = qs('[data-handoff-operational-strip]');
    if (!target) return;
    const source = items || filtered();
    const data = service().metrics(source);
    const nextLead = source.find((item) => item.priority === 'alta' && !['qualificado', 'descartado'].includes(item.status))
      || source.find((item) => !['qualificado', 'descartado'].includes(item.status))
      || source[0]
      || null;
    const waiting = source.filter((item) => item.status === 'aguardando_cliente').length;
    const audit = service().audit ? service().audit() : [];
    const lastAudit = audit[0];
    const signals = recoverySignals();
    const signalSummary = recoveryService() && recoveryService().summary
      ? recoveryService().summary(signals)
      : { total: signals.length, open: signals.length, high: 0, top: null };
    const topSignal = signalSummary.open ? signalSummary.top : null;
    const cards = [
      {
        tone: data.open ? 'info' : 'stable',
        eyebrow: 'Fila',
        title: data.open ? `${data.open} lead${data.open === 1 ? '' : 's'} em aberto` : 'Fila sem pendencias',
        body: data.total ? `${data.total} handoff${data.total === 1 ? '' : 's'} locais com checklist medio de ${data.completion}%.` : 'Nenhum handoff criado ainda. Gere a partir da trilha assistida.',
        action: data.open ? 'Priorizar atendimento' : 'Criar pela trilha'
      },
      {
        tone: data.highPriority || signalSummary.high ? 'warning' : 'stable',
        eyebrow: 'Prioridade',
        title: data.highPriority ? `${data.highPriority} alta prioridade` : signalSummary.open ? `${signalSummary.open} sinal${signalSummary.open === 1 ? '' : 'is'} de retomada` : 'Risco controlado',
        body: nextLead
          ? `${nextLead.id} - ${nextLead.objectiveLabel || 'objetivo'} com status ${service().statusLabels[nextLead.status] || nextLead.status}.`
          : topSignal
            ? `${topSignal.title}: ${topSignal.reason}`
            : 'Sem lead pendente para destacar.',
        action: nextLead ? 'Abrir detalhe' : topSignal ? 'Criar handoff do sinal' : 'Aguardar nova trilha'
      },
      {
        tone: waiting ? 'warning' : 'info',
        eyebrow: 'Atendimento',
        title: waiting ? `${waiting} aguardando cliente` : 'Sem espera critica',
        body: waiting ? 'Revise notas e defina retorno para leads parados em aguardando cliente.' : 'Use status, responsavel e checklist para manter a fila em movimento.',
        action: 'Atualizar status'
      },
      {
        tone: audit.length ? 'stable' : 'info',
        eyebrow: 'Auditoria',
        title: `${audit.length} evento${audit.length === 1 ? '' : 's'} locais`,
        body: lastAudit ? `${lastAudit.action} em ${lastAudit.handoffId || 'handoff'} por ${lastAudit.actorEmail || 'anon'}.` : 'As acoes de status, checklist, notas e atribuicao entram no log local.',
        action: 'Ver eventos'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Operação consultiva</span>
        <div>
          <h2>Fila pronta para acompanhamento.</h2>
          <p>O painel transforma trilhas em atendimento rastreável, com prioridade, checklist, status e auditoria local.</p>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        ${cards.map((card) => `
          <article class="bf-v8-decision-card bf-v8-decision-card--${card.tone}">
            <span>${escapeHtml(card.eyebrow)}</span>
            <strong>${escapeHtml(card.title)}</strong>
            <p>${escapeHtml(card.body)}</p>
            <small>${escapeHtml(card.action)}</small>
          </article>
        `).join('')}
      </div>
    `;
  }

  function renderConsultantCockpit(items) {
    const target = qs('[data-handoff-consultant-cockpit]');
    if (!target) return;
    const board = service().consultantBoard
      ? service().consultantBoard(items || operationalItems())
      : { total: 0, open: 0, overdue: 0, waiting: 0, unassigned: 0, highPriority: 0, nextActions: [] };
    const actions = board.nextActions || [];
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Cockpit do consultor</span>
          <h2>Aging, prioridade e proximo passo por lead.</h2>
          <p>A fila destaca SLA vencido, handoff sem responsavel, cliente aguardando retorno e qual acao iniciar agora.</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="dashboard-admin.html?from=handoff#admin-proximos-passos">Ver admin</a>
      </div>
      <div class="bf-handoff-consultant-grid">
        ${metric('Em aberto', board.open || 0, 'strong')}
        ${metric('Alta prioridade', board.highPriority || 0, board.highPriority ? 'warn' : '')}
        ${metric('SLA vencido', board.overdue || 0, board.overdue ? 'warn' : '')}
        ${metric('Sem responsavel', board.unassigned || 0, board.unassigned ? 'warn' : '')}
        ${metric('Aguardando 48h+', board.waiting || 0, board.waiting ? 'warn' : '')}
        ${metric('Propostas vencidas', board.proposalExpired || 0, board.proposalExpired ? 'warn' : '')}
        ${metric('Sem snapshot', board.proposalUnversioned || 0, board.proposalUnversioned ? 'warn' : '')}
        ${metric('Etapas paradas', board.commercialStale || 0, board.commercialStale ? 'warn' : '')}
        ${metric('Movidos 24h', board.commercialMoved24 || 0)}
      </div>
      <div class="bf-handoff-action-grid">
        ${actions.length ? actions.map((action) => `
          <article class="bf-handoff-action bf-handoff-action--${escapeHtml(action.tone || 'media')}" data-handoff-action-plan="${escapeHtml(action.id)}">
            <span>${escapeHtml(action.source)} - ${escapeHtml(action.age)}</span>
            <strong>${escapeHtml(action.actionTitle || action.nextStep || action.title)}</strong>
            <p>${escapeHtml(action.actionReason || action.nextStep)}</p>
            ${action.commercialStage ? `
              <div class="bf-handoff-action-commercial" data-handoff-commercial-stage="${escapeHtml(action.commercialStage.key || 'contato')}">
                <span>${escapeHtml(action.commercialStage.label || 'Contato')}</span>
                <small>${escapeHtml(action.commercialStage.stale ? 'etapa parada' : 'cadencia ok')} - ${escapeHtml(action.commercialStage.stageAgeLabel || '-')}</small>
              </div>
            ` : ''}
            <dl class="bf-handoff-action-plan">
              <div><dt>Dono</dt><dd>${escapeHtml(action.actionOwner || action.suggestedAssignee || 'responsavel a definir')}</dd></div>
              <div><dt>Prazo</dt><dd>${escapeHtml(action.deadlineLabel || 'Ate 72h')}</dd></div>
              <div><dt>Status</dt><dd>${escapeHtml(action.executionStatusLabel || 'Pendente')}</dd></div>
            </dl>
            ${action.executionReason ? `<small>${escapeHtml(action.executionReason)}</small>` : ''}
            <div class="bf-inline-actions">
              ${action.actionType === 'proposal' ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(action.href || 'simulador.html#step-9')}">${escapeHtml(action.ctaLabel || 'Abrir proposta')}</a>` : ''}
              <button class="btn btn--ghost btn--sm" type="button" data-handoff-open="${escapeHtml(action.id)}">Abrir lead</button>
            </div>
          </article>
        `).join('') : '<div class="bf-empty-state">Nenhuma acao consultiva pendente para os filtros atuais.</div>'}
      </div>
    `;
    document.body.dataset.handoffConsultantCockpitReady = 'true';
    document.body.dataset.handoffConsultantActionCount = String(actions.length);
  }

  function renderRecoverySignals() {
    const target = qs('[data-handoff-recovery-signals]');
    if (!target) return;
    const signals = recoverySignals();
    const summary = recoveryService() && recoveryService().summary
      ? recoveryService().summary(signals)
      : { total: signals.length, open: signals.length, high: 0 };
    const handoffs = service().list();
    const rows = signals.slice(0, 6).map((signal) => {
      const existing = handoffs.find((item) => item.sourceSignalId === signal.id && item.ownerEmail === signal.ownerEmail);
      return `
        <article class="bf-client-activity__item" data-handoff-recovery-signal="${escapeHtml(signal.type)}">
          <span>${escapeHtml(signal.severity === 'alta' ? 'Alta prioridade' : signal.severity === 'media' ? 'Media prioridade' : 'Monitorado')}</span>
          <strong>${escapeHtml(signal.title)}</strong>
          <small>${escapeHtml(signal.ownerEmail || 'anon')} - ${escapeHtml(signal.reason)}${signal.age ? ` - ${escapeHtml(signal.age)}` : ''}</small>
          <div class="bf-inline-actions">
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(signal.ctaHref || 'dashboard-cliente.html')}">${escapeHtml(signal.ctaLabel || 'Abrir')}</a>
            ${existing
              ? `<button class="btn btn--ghost btn--sm" type="button" data-handoff-open="${escapeHtml(existing.id)}">Abrir ${escapeHtml(existing.id)}</button>`
              : `<button class="btn btn--primary btn--sm" type="button" data-handoff-create-signal="${escapeHtml(signal.id)}">Criar handoff</button>`}
          </div>
        </article>
      `;
    }).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Sinais de retomada</span>
          <h2>Produtos, comparador e simuladores viram fila</h2>
          <p>Microconversoes locais indicam onde o cliente parou e qual handoff precisa nascer ou ser retomado.</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="dashboard-admin.html#alertas-operacionais">Ver alertas</a>
      </div>
      <div class="bf-platform-metrics">
        ${metric('Sinais', summary.total || 0, 'strong')}
        ${metric('Abertos', summary.open || 0)}
        ${metric('Alta prioridade', summary.high || 0, summary.high ? 'warn' : '')}
        ${metric('Clientes', summary.owners || 0)}
      </div>
      <div class="bf-client-activity">
        ${rows || '<div class="bf-empty-state">Nenhum sinal de retomada aberto. A fila continua monitorando produtos, comparador e simuladores locais.</div>'}
      </div>
    `;
    document.body.dataset.handoffRecoverySignalsReady = 'true';
    document.body.dataset.handoffRecoverySignalsCount = String(summary.total || 0);
  }

  function renderAuditFeed() {
    const target = qs('[data-handoff-audit-feed]');
    if (!target || !service().audit) return;
    const events = service().audit().slice(0, 8);
    if (!events.length) {
      target.innerHTML = '<div class="bf-empty-state">Nenhum evento de handoff registrado ainda.</div>';
      return;
    }
    target.innerHTML = events.map((event) => `
      <article class="bf-client-activity__item">
        <span>${escapeHtml(event.action || 'Evento')}</span>
        <strong>${escapeHtml(event.handoffId || 'Handoff local')}</strong>
        <small>${escapeHtml(date(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
        <a href="#fila-handoff">Abrir fila</a>
      </article>
    `).join('');
  }

  function statusOptions(active) {
    return Object.entries(service().statusLabels).map(([value, label]) => `<option value="${value}"${value === active ? ' selected' : ''}>${escapeHtml(label)}</option>`).join('');
  }

  function priorityLabel(value) {
    return service().priorityLabels[value] || value || '-';
  }

  function sourceType(item) {
    return service().sourceType ? service().sourceType(item) : (
      item && item.sourceProposalId ? 'proposal'
        : item && item.sourceSignalType === 'imported-recovery-item' ? 'imported'
          : item && item.sourceSignalId ? 'signal'
            : item && item.sourceJourneyId ? 'journey'
              : 'manual'
    );
  }

  function sourceLabel(item) {
    return service().sourceLabel ? service().sourceLabel(item) : (
      service().sourceLabels && service().sourceLabels[sourceType(item)] ? service().sourceLabels[sourceType(item)] : 'Origem local'
    );
  }

  function sourceSummary(item) {
    if (item && item._backendLead) {
      return `Registro vivo do SQLite (${item._backendMaterializedTable || 'journey_leads'}) sincronizado pela API local.`;
    }
    const type = sourceType(item);
    if (type === 'proposal') {
      return [
        item.sourceProposalStatus ? `status ${item.sourceProposalStatus}` : '',
        item.sourceProposalVersion ? `versao ${item.sourceProposalVersion}` : 'sem versao travada',
        item.sourceProposalVersionId ? `snapshot ${item.sourceProposalVersionId}` : '',
        item.sourceProposalValidUntil ? `validade ${date(item.sourceProposalValidUntil)}` : ''
      ].filter(Boolean).join(' - ') || 'Proposta revisada localmente.';
    }
    if (type === 'journey') {
      return item.sourceJourneyUpdatedAt ? `Trilha atualizada em ${date(item.sourceJourneyUpdatedAt)}.` : 'Trilha assistida salva localmente.';
    }
    if (type === 'imported') {
      return item.sourceSignalUpdatedAt ? `Pacote importado em ${date(item.sourceSignalUpdatedAt)}.` : 'Item recebido por pacote administrativo.';
    }
    if (type === 'signal') {
      return item.sourceSignalSeverity ? `Sinal ${item.sourceSignalSeverity} de retomada.` : 'Sinal de retomada local.';
    }
    return 'Handoff criado localmente.';
  }

  function proposalState(item) {
    return service().proposalState ? service().proposalState(item) : ((item && item.operational && item.operational.proposal) || {
      active: false,
      tone: 'baixa',
      label: '',
      reason: ''
    });
  }

  function actionPlan(item) {
    return service().actionPlan ? service().actionPlan(item) : {
      active: false,
      actionKey: '',
      type: 'none',
      title: item && item.operational ? item.operational.nextStep : 'Definir proximo passo',
      reason: '',
      owner: item && (item.assignedTo || item.ownerEmail) ? (item.assignedTo || item.ownerEmail) : 'definir na fila',
      deadlineLabel: 'Ate 72h',
      ctaLabel: 'Abrir lead',
      href: 'handoff-consultivo.html#fila-handoff',
      tone: 'media',
      execution: { status: 'pendente', statusLabel: 'Pendente', reason: '' }
    };
  }

  function commercialStage(item) {
    if (!item) return { key: 'contato', label: 'Contato', stageAgeLabel: '-', deadlineHours: 24, stale: false, tone: 'baixa', historyLabel: 'Etapa definida pela jornada' };
    if (item.commercialStage) return item.commercialStage;
    if (service().commercialStageState) return service().commercialStageState(item);
    return { key: 'contato', label: 'Contato', stageAgeLabel: '-', deadlineHours: 24, stale: false, tone: 'baixa', historyLabel: 'Etapa definida pela jornada' };
  }

  function commercialStageChip(item) {
    const stage = commercialStage(item);
    return `
      <div class="bf-handoff-commercial-chip bf-handoff-commercial-chip--${escapeHtml(stage.tone || 'baixa')}" data-handoff-commercial-stage="${escapeHtml(stage.key || 'contato')}">
        <span>Etapa comercial</span>
        <strong>${escapeHtml(stage.label || 'Contato')}</strong>
        <small>${escapeHtml(stage.stale ? 'Retomar etapa' : stage.historyLabel || 'Etapa definida pela jornada')} - ${escapeHtml(stage.stageAgeLabel || '-')}</small>
      </div>
    `;
  }

  function commercialStagePanel(item) {
    const stage = commercialStage(item);
    return `
      <section class="bf-handoff-commercial-panel bf-handoff-commercial-panel--${escapeHtml(stage.tone || 'baixa')} bf-platform-section" data-handoff-commercial-stage-panel>
        <div>
          <span class="bf-badge bf-badge--gold">Cadencia comercial</span>
          <h3>${escapeHtml(stage.label || 'Contato')}</h3>
          <p>${escapeHtml(stage.stale ? 'Lead ultrapassou o prazo da etapa comercial e precisa de retomada.' : 'Lead dentro da cadencia comercial registrada no funil admin.')}</p>
        </div>
        <dl>
          <div><dt>Etapa</dt><dd>${escapeHtml(stage.label || 'Contato')}</dd></div>
          <div><dt>Aging etapa</dt><dd>${escapeHtml(stage.stageAgeLabel || '-')}</dd></div>
          <div><dt>Prazo alvo</dt><dd>${escapeHtml(stage.deadlineHours || '-')}h</dd></div>
          <div><dt>Atualizado por</dt><dd>${escapeHtml(stage.updatedBy || stage.actorEmail || 'jornada local')}</dd></div>
        </dl>
        <small data-handoff-commercial-stage-history>${escapeHtml(stage.historyLabel || 'Etapa definida pela jornada')}${stage.movementAt ? ` - ${escapeHtml(date(stage.movementAt))}` : ''}</small>
        <a class="btn btn--ghost btn--sm" href="dashboard-admin.html?from=handoff#admin-funil-comercial">Abrir funil admin</a>
      </section>
    `;
  }

  function actionStatusClass(status) {
    return ['em_execucao', 'adiada', 'concluida'].includes(status) ? status : 'pendente';
  }

  function actionHistoryMarkup(plan) {
    const events = service().actionHistory ? service().actionHistory(plan.actionKey).slice(0, 3) : [];
    if (!events.length) return '<small>Nenhuma execucao registrada ainda.</small>';
    return events.map((event) => `
      <small>${escapeHtml(event.status || event.action || 'acao')} - ${escapeHtml(date(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
    `).join('');
  }

  function actionExecutionPanel(plan, item) {
    const execution = plan.execution || (service().actionExecution ? service().actionExecution(plan.actionKey) : { status: 'pendente', statusLabel: 'Pendente', reason: '' });
    return `
      <div class="bf-action-execution bf-action-execution--${escapeHtml(actionStatusClass(execution.status))}" data-handoff-action-execution="${escapeHtml(plan.actionKey || item.id || '')}">
        <div class="bf-action-execution__head">
          <span>Status da acao</span>
          <strong>${escapeHtml(execution.statusLabel || 'Pendente')}</strong>
        </div>
        <label>Motivo ou observacao
          <input data-handoff-action-reason value="${escapeHtml(execution.reason || '')}" placeholder="Ex.: cliente pediu retorno amanha">
        </label>
        <div class="bf-inline-actions">
          <button class="btn btn--ghost btn--sm" type="button" data-handoff-action-status="em_execucao">Iniciar</button>
          <button class="btn btn--ghost btn--sm" type="button" data-handoff-action-status="adiada">Adiar 24h</button>
          <button class="btn btn--primary btn--sm" type="button" data-handoff-action-status="concluida">Concluir</button>
          ${execution.status === 'concluida' ? '<button class="btn btn--ghost btn--sm" type="button" data-handoff-action-status="pendente">Reabrir</button>' : ''}
        </div>
        <div class="bf-action-execution__history" data-handoff-action-history>
          ${actionHistoryMarkup(plan)}
        </div>
      </div>
    `;
  }

  function proposalVersionChip(item) {
    const state = proposalState(item);
    if (!state.active) return '';
    return `
      <div class="bf-handoff-proposal-chip bf-handoff-proposal-chip--${escapeHtml(state.tone)}" data-handoff-proposal-version>
        <span>${escapeHtml(state.label)}</span>
        <strong>${escapeHtml(state.nextStep || 'Acompanhar proposta')}</strong>
        <small>${escapeHtml(state.reason || sourceSummary(item))}</small>
      </div>
    `;
  }

  function proposalVersionPanel(item) {
    const state = proposalState(item);
    if (!state.active) return '';
    return `
      <section class="bf-handoff-proposal-panel bf-handoff-proposal-panel--${escapeHtml(state.tone)} bf-platform-section" data-handoff-proposal-version>
        <div>
          <span class="bf-badge bf-badge--gold">Proposta versionada</span>
          <h3>${escapeHtml(state.label)}</h3>
          <p>${escapeHtml(state.reason || 'Snapshot local preservado para atendimento consultivo.')}</p>
        </div>
        <dl>
          <div><dt>Proposta</dt><dd>${escapeHtml(item.sourceProposalId || '-')}</dd></div>
          <div><dt>Versao</dt><dd>${escapeHtml(state.version || '-')}</dd></div>
          <div><dt>Validade</dt><dd>${escapeHtml(state.validUntil || '-')}</dd></div>
          <div><dt>Atualizacao</dt><dd>${escapeHtml(state.versionAgeLabel || '-')}</dd></div>
        </dl>
        <small>${state.versionId ? `Snapshot ${escapeHtml(state.versionId)}` : 'Snapshot nao identificado em handoffs antigos.'}</small>
        <a class="btn btn--ghost btn--sm" href="simulador.html#step-9">Abrir proposta</a>
      </section>
    `;
  }

  function card(item) {
    const summary = item.summary || {};
    const status = service().statusLabels[item.status] || item.status;
    const checklist = item.checklist || [];
    const done = checklist.filter((entry) => entry.done).length;
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente local';
    const op = item.operational || (service().operationalState ? service().operationalState(item) : {});
    const stage = commercialStage(item);
    return `
      <article class="bf-handoff-card${item.id === selectedId ? ' is-selected' : ''}" data-handoff-card="${escapeHtml(item.id)}">
        <div class="bf-handoff-card__top">
          <span class="bf-handoff-status bf-handoff-status--${escapeHtml(item.status)}">${escapeHtml(status)}</span>
          <span class="bf-handoff-priority bf-handoff-priority--${escapeHtml(item.priority)}">${escapeHtml(priorityLabel(item.priority))}</span>
          <span class="bf-handoff-source bf-handoff-source--${escapeHtml(sourceType(item))}">${escapeHtml(sourceLabel(item))}</span>
          ${item._backendLead ? `<span class="bf-handoff-source bf-handoff-source--backend" data-handoff-live-source="${escapeHtml(item._backendSource || 'sqlite')}">Dado vivo</span>` : ''}
          <span class="bf-handoff-aging bf-handoff-aging--${escapeHtml(op.tone || 'baixa')}">${escapeHtml(op.slaOverdue ? 'SLA vencido' : op.ageLabel || '-')}</span>
          <span class="bf-handoff-commercial-stage-tag bf-handoff-commercial-stage-tag--${escapeHtml(stage.tone || 'baixa')}" data-handoff-commercial-stage="${escapeHtml(stage.key || 'contato')}">${escapeHtml(stage.label || 'Contato')}</span>
        </div>
        <h3>${escapeHtml(item.objectiveLabel || 'Lead consultivo')}</h3>
        <p>${escapeHtml(ownerLabel)} - ${escapeHtml(summary.productName || '-')} / ${escapeHtml(summary.modelName || '-')}</p>
        <small class="bf-handoff-origin-note">${escapeHtml(sourceSummary(item))}</small>
        ${proposalVersionChip(item)}
        ${commercialStageChip(item)}
        <div class="bf-mini-facts">
          <div><dt>Credito</dt><dd>${escapeHtml(money(summary.valorCredito || 0))}</dd></div>
          <div><dt>Checklist</dt><dd>${done}/${checklist.length}</dd></div>
          <div><dt>Aging</dt><dd>${escapeHtml(op.ageLabel || '-')}</dd></div>
          <div><dt>Proximo</dt><dd>${escapeHtml(op.nextStep || '-')}</dd></div>
        </div>
        <div class="bf-inline-actions">
          <button class="btn btn--primary btn--sm" type="button" data-handoff-open="${escapeHtml(item.id)}">Abrir</button>
          <a class="btn btn--ghost btn--sm" href="comparador.html?preset=${encodeURIComponent(item.objective || 'obter_liquidez')}">Comparar</a>
        </div>
      </article>
    `;
  }

  function renderList() {
    const target = qs('[data-handoff-list]');
    if (!target) return;
    const allItems = operationalItems();
    hydrateAssigneeOptions(allItems);
    const items = filtered(allItems);
    renderLiveDataPanel(allItems, items);
    renderMetrics(items);
    renderOperationalStrip(items);
    renderConsultantCockpit(items);
    renderRecoverySignals();
    renderAuditFeed();

    if (!selectedId && items[0]) selectedId = items[0].id;
    if (selectedId && !items.some((item) => item.id === selectedId)) selectedId = items[0] ? items[0].id : '';

    target.innerHTML = items.length
      ? items.map(card).join('')
      : '<div class="bf-empty-state">Nenhum handoff encontrado para os filtros atuais.</div>';
    renderDetail();
  }

  function timelineMarkup(item) {
    const events = (item.timeline || []).slice(0, 8);
    if (!events.length) return '<div class="bf-empty-state">Sem eventos registrados.</div>';
    const labels = {
      create: 'Handoff criado pela trilha',
      refresh: 'Handoff atualizado pela trilha',
      'signal:create': 'Handoff criado por sinal',
      'signal:refresh': 'Handoff atualizado por sinal',
      'proposal:create': 'Handoff criado por proposta',
      'proposal:refresh': 'Handoff atualizado por proposta',
      note: 'Nota local adicionada',
      assign: 'Responsavel atualizado',
      'checklist:done': 'Checklist marcado',
      'checklist:open': 'Checklist reaberto',
      'status:novo': 'Status alterado para Novo',
      'status:em_atendimento': 'Status alterado para Em atendimento',
      'status:aguardando_cliente': 'Status alterado para Aguardando cliente',
      'status:qualificado': 'Status alterado para Qualificado',
      'status:descartado': 'Status alterado para Descartado'
    };
    return events.map((event) => `
      <article class="bf-handoff-event">
        <strong>${escapeHtml(labels[event.type] || event.label || event.type || 'Evento')}</strong>
        <small>${escapeHtml(date(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
      </article>
    `).join('');
  }

  function notesMarkup(item) {
    const notes = (item.notes || []).slice(0, 6);
    if (!notes.length) return '<div class="bf-empty-state">Nenhuma nota local registrada.</div>';
    return notes.map((note) => `
      <article class="bf-handoff-note">
        <p>${escapeHtml(note.text)}</p>
        <small>${escapeHtml(date(note.createdAt))} - ${escapeHtml(note.actorEmail || 'anon')}</small>
      </article>
    `).join('');
  }

  function checklistMarkup(item) {
    return (item.checklist || []).map((entry) => `
      <label class="bf-handoff-check">
        <input type="checkbox" data-handoff-check="${escapeHtml(entry.id)}"${entry.done ? ' checked' : ''}>
        <span>${escapeHtml(entry.label)}</span>
      </label>
    `).join('');
  }

  function renderDetail() {
    const target = qs('[data-handoff-detail]');
    if (!target) return;
    const item = liveHandoffById(selectedId);
    if (!item) {
      target.innerHTML = '<div class="bf-empty-state">Selecione um handoff para acompanhar.</div>';
      return;
    }

    const summary = item.summary || {};
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente local';
    const op = item.operational || {};
    const plan = actionPlan(item);
    const stage = commercialStage(item);
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--ok">${escapeHtml(sourceLabel(item))}</span>
          ${item._backendLead ? `<span class="bf-badge bf-badge--gold" data-handoff-live-source="${escapeHtml(item._backendSource || 'sqlite')}">Dado vivo</span>` : ''}
          <h2>${escapeHtml(item.objectiveLabel || item.id)}</h2>
          <p>${escapeHtml(ownerLabel)} - criado em ${escapeHtml(date(item.createdAt))}</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="trilha-decisao.html">Rever trilha</a>
      </div>

      <div class="bf-handoff-detail-grid">
        <label>Status
          <select data-handoff-status="${escapeHtml(item.id)}">${statusOptions(item.status)}</select>
        </label>
        <label>Responsavel local
          <input data-handoff-assignee="${escapeHtml(item.id)}" value="${escapeHtml(item.assignedTo || '')}" placeholder="consultor@bankfratern.local">
        </label>
      </div>

      <div class="bf-platform-metrics bf-platform-section">
        ${metric('Origem', sourceLabel(item))}
        ${metric('Prioridade operacional', op.slaOverdue ? 'SLA vencido' : priorityLabel(item.priority), op.slaOverdue || item.priority === 'alta' ? 'warn' : '')}
        ${metric('Aging', op.ageLabel || '-')}
        ${metric('SLA alvo', `${op.slaHours || '-'}h`)}
        ${metric('Responsavel sugerido', op.suggestedAssignee || 'definir na fila', op.unassigned ? 'warn' : '')}
        ${metric('Etapa comercial', stage.label || 'Contato', stage.stale ? 'warn' : '')}
        ${metric('Aging etapa', stage.stageAgeLabel || '-')}
        ${metric('Produto', summary.productName || '-')}
        ${metric('Modelo', summary.modelName || '-')}
        ${metric('Reserva', `${Number(summary.reservaMeses || 0).toFixed(1)} meses`, summary.gapReserva > 0 ? 'warn' : '')}
        ${metric('Capacidade segura', money(summary.capacidadePagamento || 0), 'strong')}
      </div>

      <section class="bf-handoff-next-step bf-handoff-action--${escapeHtml(op.tone || 'media')} bf-platform-section" data-handoff-next-step data-handoff-action-plan="${escapeHtml(item.id)}">
        <span class="bf-badge bf-badge--gold">Proximo passo</span>
        <strong>${escapeHtml(plan.title || op.nextStep || 'Definir proximo passo')}</strong>
        <p>${escapeHtml(plan.reason || (op.slaOverdue ? 'Lead ultrapassou o SLA recomendado para a prioridade atual.' : op.waitingClient ? 'Cliente esta aguardando retorno ha mais de 48 horas.' : op.unassigned ? 'Lead aberto precisa de responsavel antes de seguir.' : 'Lead esta dentro da governanca operacional atual.'))}</p>
        <dl class="bf-handoff-action-plan">
          <div><dt>Dono</dt><dd>${escapeHtml(plan.owner || op.suggestedAssignee || 'definir na fila')}</dd></div>
          <div><dt>Prazo</dt><dd>${escapeHtml(plan.deadlineLabel || 'Ate 72h')}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml((plan.execution && plan.execution.statusLabel) || 'Pendente')}</dd></div>
        </dl>
        ${plan.type === 'proposal' ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(plan.href || 'simulador.html#step-9')}">${escapeHtml(plan.ctaLabel || 'Abrir proposta')}</a>` : ''}
        ${actionExecutionPanel(plan, item)}
      </section>

      ${commercialStagePanel(item)}

      <section class="bf-handoff-origin-panel bf-platform-section">
        <span class="bf-badge bf-badge--navy">Origem do atendimento</span>
        <p>${escapeHtml(sourceSummary(item))}</p>
      </section>

      ${proposalVersionPanel(item)}

      <div class="bf-handoff-columns">
        <section>
          <span class="bf-badge bf-badge--gold">Checklist</span>
          <div class="bf-handoff-checklist">${checklistMarkup(item)}</div>
        </section>
        <section>
          <span class="bf-badge bf-badge--navy">Notas locais</span>
          <form class="bf-handoff-note-form" data-handoff-note-form="${escapeHtml(item.id)}">
            <textarea name="note" rows="4" placeholder="Registrar nota consultiva local, sem envio externo."></textarea>
            <button class="btn btn--primary btn--sm" type="submit">Adicionar nota</button>
          </form>
          <div class="bf-handoff-notes">${notesMarkup(item)}</div>
        </section>
      </div>

      <section class="bf-platform-section">
        <span class="bf-badge bf-badge--ok">Historico local</span>
        <div class="bf-handoff-timeline">${timelineMarkup(item)}</div>
      </section>
    `;
  }

  function bindControls() {
    ['[data-handoff-search]', '[data-handoff-status-filter]', '[data-handoff-priority-filter]', '[data-handoff-source-filter]', '[data-handoff-assignee-filter]', '[data-handoff-aging-filter]'].forEach((selector) => {
      qs(selector)?.addEventListener('input', renderList);
      qs(selector)?.addEventListener('change', renderList);
    });

    qs('[data-handoff-live-data-panel]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-handoff-live-refresh]');
      if (!button) return;
      button.disabled = true;
      loadBackendLeads()
        .then(() => renderList())
        .catch(() => renderList());
    });

    qs('[data-handoff-list]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-handoff-open]');
      if (!button) return;
      selectedId = button.dataset.handoffOpen;
      renderList();
    });

    qs('[data-handoff-consultant-cockpit]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-handoff-open]');
      if (!button) return;
      selectedId = button.dataset.handoffOpen;
      renderList();
      qs('#detalhe-handoff')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });

    qs('[data-handoff-recovery-signals]')?.addEventListener('click', (event) => {
      const createButton = event.target.closest('[data-handoff-create-signal]');
      const openButton = event.target.closest('[data-handoff-open]');
      if (openButton) {
        selectedId = openButton.dataset.handoffOpen;
        renderList();
        return;
      }
      if (!createButton || !service().createFromSignal || !recoveryService()) return;
      const signal = recoveryService().find(createButton.dataset.handoffCreateSignal, { includeComplete: true });
      if (!signal) return;
      const handoff = service().createFromSignal(signal);
      selectedId = handoff ? handoff.id : selectedId;
      renderList();
    });

    qs('[data-handoff-detail]')?.addEventListener('change', (event) => {
      const status = event.target.closest('[data-handoff-status]');
      const assignee = event.target.closest('[data-handoff-assignee]');
      const check = event.target.closest('[data-handoff-check]');
      if (status) {
        const id = status.dataset.handoffStatus;
        const live = liveHandoffById(id);
        const local = service().find(id);
        const updated = local ? service().setStatus(id, status.value) : null;
        if (live && live._backendLead) {
          const next = updateBackendLeadState(id, (item) => ({
            status: status.value,
            timeline: (updated && updated.timeline) || [{
              id: `TL-${Date.now().toString(36).toUpperCase()}`,
              type: `status:${status.value}`,
              label: `Status alterado para ${status.value}`,
              actorEmail: currentActor().email,
              createdAt: new Date().toISOString()
            }].concat(item.timeline || [])
          }));
          syncBackendLead(next);
        }
        renderList();
      }
      if (assignee) {
        const id = assignee.dataset.handoffAssignee;
        const value = String(assignee.value || '').trim();
        const live = liveHandoffById(id);
        const local = service().find(id);
        const updated = local ? service().assign(id, value) : null;
        if (live && live._backendLead) {
          const next = updateBackendLeadState(id, (item) => ({
            assignedTo: value,
            timeline: (updated && updated.timeline) || [{
              id: `TL-${Date.now().toString(36).toUpperCase()}`,
              type: 'assign',
              label: 'Responsavel atualizado',
              actorEmail: currentActor().email,
              createdAt: new Date().toISOString()
            }].concat(item.timeline || [])
          }));
          syncBackendLead(next);
        }
        renderList();
      }
      if (check) {
        const live = liveHandoffById(selectedId);
        const local = service().find(selectedId);
        const updated = local ? service().toggleChecklist(selectedId, check.dataset.handoffCheck, check.checked) : null;
        if (live && live._backendLead) {
          const next = updateBackendLeadState(selectedId, (item) => ({
            checklist: (updated && updated.checklist) || (item.checklist || []).map((entry) => (
              entry.id === check.dataset.handoffCheck ? { ...entry, done: check.checked === true } : entry
            )),
            timeline: (updated && updated.timeline) || [{
              id: `TL-${Date.now().toString(36).toUpperCase()}`,
              type: check.checked ? 'checklist:done' : 'checklist:open',
              label: check.checked ? 'Checklist marcado' : 'Checklist reaberto',
              actorEmail: currentActor().email,
              createdAt: new Date().toISOString()
            }].concat(item.timeline || [])
          }));
          syncBackendLead(next);
        }
        renderList();
      }
    });

    qs('[data-handoff-detail]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-handoff-action-status]');
      if (!button || !service().setActionExecution) return;
      const panel = button.closest('[data-handoff-action-execution]');
      const item = liveHandoffById(selectedId);
      if (!item) return;
      const plan = actionPlan(item);
      const status = button.dataset.handoffActionStatus;
      const reason = panel ? panel.querySelector('[data-handoff-action-reason]')?.value || '' : '';
      service().setActionExecution({
        actionKey: panel ? panel.dataset.handoffActionExecution : plan.actionKey,
        title: plan.title,
        source: plan.source,
        target: selectedId,
        href: plan.href,
        owner: plan.owner
      }, {
        status,
        reason,
        postponedUntil: status === 'adiada' ? new Date(Date.now() + 86400000).toISOString() : '',
        owner: plan.owner
      });
      renderList();
    });

    qs('[data-handoff-detail]')?.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-handoff-note-form]');
      if (!form) return;
      event.preventDefault();
      const id = form.dataset.handoffNoteForm;
      const text = String(form.elements.note.value || '').trim().slice(0, 600);
      const live = liveHandoffById(id);
      const local = service().find(id);
      const updated = local ? service().addNote(id, text) : null;
      if (!local && live && live._backendLead && text) {
        const actor = currentActor();
        const note = {
          id: `NOTE-${Date.now().toString(36).toUpperCase()}`,
          text,
          actorEmail: actor.email,
          actorRole: actor.role,
          createdAt: new Date().toISOString()
        };
        const next = updateBackendLeadState(id, (item) => ({
          notes: [note].concat(item.notes || []),
          timeline: [{
            id: `TL-${Date.now().toString(36).toUpperCase()}`,
            type: 'note',
            label: 'Nota local adicionada',
            actorEmail: actor.email,
            createdAt: note.createdAt
          }].concat(item.timeline || [])
        }));
        syncBackendLead(next);
      } else if (updated && live && live._backendLead) {
        const next = updateBackendLeadState(id, {
          notes: updated.notes || [],
          timeline: updated.timeline || live.timeline || []
        });
        syncBackendLead(next);
      }
      form.reset();
      renderList();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const user = window.BFAuth && window.BFAuth.requireRole
      ? window.BFAuth.requireRole(['admin', 'consultor'], { redirect: true })
      : null;
    if (!user || !service()) return;
    const params = new URLSearchParams(window.location.search || '');
    selectedId = params.get('handoffId') || params.get('id') || selectedId;
    bindControls();
    renderList();
    loadBackendLeads().then((loaded) => {
      if (loaded) renderList();
    }).catch(() => renderList());
    document.body.dataset.handoffReady = 'true';
  });
})();
