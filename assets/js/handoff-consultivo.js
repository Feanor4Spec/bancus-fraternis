(function () {
  'use strict';

  // Contrato de integração não renderizado: Handoff criado por calculadora.

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

  function commercialText(value) {
    return String(value == null ? '' : value)
      .replace(/\bhandoffs\b/gi, 'atendimentos')
      .replace(/\bhandoff\b/gi, 'atendimento')
      .replace(/\bpela\s+trilha\b/gi, 'pelo planejamento')
      .replace(/\bda\s+trilha\b/gi, 'do planejamento')
      .replace(/\btrilha\s+assistida\b/gi, 'planejamento do cliente')
      .replace(/\bsnapshots\b/gi, 'registros')
      .replace(/\bsnapshot\b/gi, 'registro')
      .replace(/\bproposta\s+versionada\b/gi, 'proposta salva')
      .replace(/\bversionamento\b/gi, 'revisão')
      .replace(/\bvers(?:ao|ão)\b/gi, 'revisão')
      .replace(/\btravada\b/gi, 'salva')
      .replace(/\bleads\b/gi, 'oportunidades')
      .replace(/\blead\b/gi, 'oportunidade')
      .replace(/\bsqlite(?:\s+local)?\b/gi, 'sistema')
      .replace(/\bapi\s+local\b/gi, 'serviço')
      .replace(/\blocalstorage\b/gi, 'sistema')
      .replace(/\bserver-side\b/gi, '')
      .replace(/\bfunil\s+admin\b/gi, 'gestão comercial')
      .replace(/\bscore\b/gi, 'indicador')
      .replace(/\baging\b/gi, 'tempo sem atualização')
      .replace(/\bsla\b/gi, 'prazo de retorno')
      .replace(/\bgovernanca\s+operacional\b/gi, 'processo de atendimento')
      .replace(/\bgovernança\s+operacional\b/gi, 'processo de atendimento')
      .replace(/\bnotas\s+locais\b/gi, 'anotações')
      .replace(/\bnota\s+local\b/gi, 'anotação')
      .replace(/\bdados?\s+vivos?\b/gi, 'dados atualizados')
      .replace(/\bregistro\s+vivo\b/gi, 'registro atualizado')
      .replace(/\bfila\s+local\b/gi, 'carteira')
      .replace(/\bhistorico\s+local\b/gi, 'histórico')
      .replace(/\bhistórico\s+local\b/gi, 'histórico')
      .replace(/\blog\s+local\b/gi, 'histórico')
      .replace(/\beventos?\s+locais?\b/gi, 'atividades')
      .replace(/\brevisada\s+localmente\b/gi, 'revisada')
      .replace(/\bsalv([ao])\s+localmente\b/gi, 'salv$1')
      .replace(/\bcriad([ao])\s+localmente\b/gi, 'criad$1')
      .replace(/\bcliente\s+local\b/gi, 'cliente')
      .replace(/\borigem\s+local\b/gi, 'origem não informada')
      .replace(/\bjornada\s+local\b/gi, 'jornada')
      .replace(/\bresponsavel\s+local\b/gi, 'responsável')
      .replace(/\bresponsável\s+local\b/gi, 'responsável')
      .replace(/\bsuitability(?:\s+educativa)?\b/gi, 'adequação ao perfil')
      .replace(/\bproposta\s+real\b/gi, 'proposta')
      .replace(/\bdashboard\s+cliente\b/gi, 'área do cliente')
      .replace(/\bhistorico\b/gi, 'histórico')
      .replace(/\bproximo\b/gi, 'próximo')
      .replace(/\bresponsavel\b/gi, 'responsável')
      .replace(/\bate\b/gi, 'até')
      .replace(/\bacoes\b/gi, 'ações')
      .replace(/\bacao\b/gi, 'ação')
      .replace(/\bexecucao\b/gi, 'execução')
      .replace(/\bobservacao\b/gi, 'observação')
      .replace(/\s+([.,;:])/g, '$1')
      .replace(/\s{2,}/g, ' ')
      .trim();
  }

  function actorLabel(value) {
    const actor = String(value || '').trim();
    return !actor || actor.toLowerCase() === 'anon' ? 'Equipe comercial' : actor;
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
      objectiveLabel: row.title || payload.objectiveLabel || payload.title || 'Oportunidade',
      status,
      priority,
      assignedTo: payload.assignedTo || row.assignedTo || '',
      summary: {
        ...summary,
        valorCredito: Number(summary.valorCredito || summary.ticket || row.amount || 0),
        productName: summary.productName || payload.productName || payload.product || 'Produto a confirmar',
        modelName: summary.modelName || payload.modelName || 'Atendimento em andamento'
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
      <option value="sem_responsavel">Sem responsável</option>
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
        error: result && result.message ? result.message : 'Não foi possível atualizar os atendimentos.',
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
        error: error && error.message ? error.message : 'Não foi possível atualizar este atendimento.'
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
    const sourceLabel = backendLeadState.loaded ? 'Atualizado' : 'Disponível';
    const copy = backendLeadState.loading
      ? 'Atualizando os atendimentos.'
      : backendLeadState.loaded
        ? (liveCount
          ? 'Os atendimentos mais recentes já estão disponíveis para priorização.'
          : 'A carteira está atualizada e pronta para uso.')
        : 'A carteira está pronta para consulta.';

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
          <h2>Atendimentos disponíveis</h2>
          <p>${escapeHtml(copy)}</p>
          ${backendLeadState.error ? '<small>Não foi possível buscar atualizações agora.</small>' : ''}
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-handoff-live-refresh>${backendLeadState.loading ? 'Atualizando...' : 'Atualizar atendimentos'}</button>
      </div>
      <div class="bf-platform-metrics">
        ${metric('Atualizados agora', liveCount, liveCount ? 'strong' : '')}
        ${metric('Salvos', localCount)}
        ${metric('Atendimentos', mergedCount, mergedCount ? 'strong' : '')}
        ${metric('Nesta busca', visibleCount)}
      </div>
    `;
  }

  function renderMetrics(items) {
    const target = qs('[data-handoff-metrics]');
    if (!target) return;
    const data = service().metrics(items);
    if (!data.total) {
      target.hidden = true;
      target.innerHTML = '';
      return;
    }
    target.hidden = false;
    target.innerHTML = `
      <div class="bf-platform-metrics">
        ${metric('Oportunidades', data.total, 'strong')}
        ${metric('Em aberto', data.open)}
        ${metric('Alta prioridade', data.highPriority, data.highPriority ? 'warn' : '')}
        ${metric('Retorno vencido', data.overdue || 0, data.overdue ? 'warn' : '')}
        ${metric('Sem responsável', data.unassigned || 0, data.unassigned ? 'warn' : '')}
        ${metric('Propostas', data.proposal || 0)}
        ${metric('Planejamentos', data.journey || 0)}
        ${metric('Para retomar', (data.signal || 0) + (data.imported || 0))}
        ${metric('Avanço médio', `${data.completion}%`)}
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
        eyebrow: 'Carteira',
        title: data.open ? `${data.open} oportunidade${data.open === 1 ? '' : 's'} em aberto` : 'Tudo em dia',
        body: data.total ? `${data.total} atendimento${data.total === 1 ? '' : 's'} com ${data.completion}% das etapas concluídas.` : 'Nenhum atendimento criado ainda. Inicie uma nova simulação.',
        action: data.open ? 'Priorizar atendimento' : 'Criar simulação'
      },
      {
        tone: data.highPriority || signalSummary.high ? 'warning' : 'stable',
        eyebrow: 'Prioridade',
        title: data.highPriority ? `${data.highPriority} alta prioridade` : signalSummary.open ? `${signalSummary.open} sinal${signalSummary.open === 1 ? '' : 'is'} de retomada` : 'Risco controlado',
        body: nextLead
          ? `${nextLead.id} - ${nextLead.objectiveLabel || 'objetivo'} com status ${service().statusLabels[nextLead.status] || nextLead.status}.`
          : topSignal
            ? `${topSignal.title}: ${topSignal.reason}`
            : 'Nenhuma oportunidade pendente para destacar.',
        action: nextLead ? 'Abrir detalhe' : topSignal ? 'Criar atendimento' : 'Aguardar nova oportunidade'
      },
      {
        tone: waiting ? 'warning' : 'info',
        eyebrow: 'Atendimento',
        title: waiting ? `${waiting} aguardando cliente` : 'Sem espera crítica',
        body: waiting ? 'Revise as anotações e defina o próximo retorno.' : 'Atualize o status, o responsável e as etapas concluídas.',
        action: 'Atualizar status'
      },
      {
        tone: audit.length ? 'stable' : 'info',
        eyebrow: 'Histórico',
        title: `${audit.length} atividade${audit.length === 1 ? '' : 's'} registrada${audit.length === 1 ? '' : 's'}`,
        body: lastAudit ? `${commercialText(lastAudit.action)} em ${lastAudit.handoffId || 'atendimento'} por ${actorLabel(lastAudit.actorEmail)}.` : 'As mudanças de status, responsável e anotações ficam registradas.',
        action: 'Ver histórico'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Atendimentos</span>
        <div>
          <h2>Prioridades e próximos passos.</h2>
          <p>Veja o que precisa de atenção e avance cada conversa.</p>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        ${cards.map((card) => `
          <article class="bf-v8-decision-card bf-v8-decision-card--${card.tone}">
            <span>${escapeHtml(commercialText(card.eyebrow))}</span>
            <strong>${escapeHtml(commercialText(card.title))}</strong>
            <p>${escapeHtml(commercialText(card.body))}</p>
            <small>${escapeHtml(commercialText(card.action))}</small>
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
    if (!board.total && !actions.length) {
      target.innerHTML = `
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Prioridades do dia</span>
            <h2>Sua carteira está pronta para começar.</h2>
            <p>Crie uma simulação para iniciar o primeiro atendimento.</p>
          </div>
          <a class="btn btn--primary btn--sm" href="simulador.html">Nova simulação</a>
        </div>
        <div class="bf-empty-state">Nenhum cliente aguardando retorno.</div>
      `;
      document.body.dataset.handoffConsultantCockpitReady = 'true';
      document.body.dataset.handoffConsultantActionCount = '0';
      return;
    }
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Prioridades do dia</span>
          <h2>Comece pelos clientes que precisam de retorno.</h2>
          <p>Veja propostas vencidas, conversas sem responsável e os próximos passos mais urgentes.</p>
        </div>
      </div>
      <div class="bf-handoff-consultant-grid">
        ${metric('Em aberto', board.open || 0, 'strong')}
        ${metric('Alta prioridade', board.highPriority || 0, board.highPriority ? 'warn' : '')}
        ${metric('Retorno vencido', board.overdue || 0, board.overdue ? 'warn' : '')}
        ${metric('Sem responsável', board.unassigned || 0, board.unassigned ? 'warn' : '')}
        ${metric('Aguardando há 2 dias', board.waiting || 0, board.waiting ? 'warn' : '')}
        ${metric('Propostas vencidas', board.proposalExpired || 0, board.proposalExpired ? 'warn' : '')}
        ${metric('Conferência pendente', board.proposalUnversioned || 0, board.proposalUnversioned ? 'warn' : '')}
        ${metric('Conversas paradas', board.commercialStale || 0, board.commercialStale ? 'warn' : '')}
        ${metric('Avanços nas últimas 24h', board.commercialMoved24 || 0)}
      </div>
      <div class="bf-handoff-action-grid">
        ${actions.length ? actions.map((action) => `
          <article class="bf-handoff-action bf-handoff-action--${escapeHtml(action.tone || 'media')}" data-handoff-action-plan="${escapeHtml(action.id)}">
            <span>${escapeHtml(commercialText(action.source))} - ${escapeHtml(action.age)}</span>
            <strong>${escapeHtml(commercialText(action.actionTitle || action.nextStep || action.title))}</strong>
            <p>${escapeHtml(commercialText(action.actionReason || action.nextStep))}</p>
            ${action.commercialStage ? `
              <div class="bf-handoff-action-commercial" data-handoff-commercial-stage="${escapeHtml(action.commercialStage.key || 'contato')}">
                <span>${escapeHtml(commercialText(action.commercialStage.label || 'Contato'))}</span>
                <small>${escapeHtml(action.commercialStage.stale ? 'precisa de retorno' : 'dentro do prazo')} - ${escapeHtml(action.commercialStage.stageAgeLabel || '-')}</small>
              </div>
            ` : ''}
            <dl class="bf-handoff-action-plan">
              <div><dt>Responsável</dt><dd>${escapeHtml(commercialText(action.actionOwner || action.suggestedAssignee || 'a definir'))}</dd></div>
              <div><dt>Prazo</dt><dd>${escapeHtml(commercialText(action.deadlineLabel || 'Até 72h'))}</dd></div>
              <div><dt>Status</dt><dd>${escapeHtml(commercialText(action.executionStatusLabel || 'Pendente'))}</dd></div>
            </dl>
            ${action.executionReason ? `<small>${escapeHtml(commercialText(action.executionReason))}</small>` : ''}
            <div class="bf-inline-actions">
              ${action.actionType === 'proposal' ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(action.href || 'simulador.html#proposta')}">${escapeHtml(commercialText(action.ctaLabel || 'Abrir proposta'))}</a>` : ''}
              <button class="btn btn--ghost btn--sm" type="button" data-handoff-open="${escapeHtml(action.id)}">Abrir atendimento</button>
            </div>
          </article>
        `).join('') : '<div class="bf-empty-state">Nenhuma ação pendente para os filtros atuais.</div>'}
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
    if (!summary.total) {
      target.hidden = true;
      target.innerHTML = '';
      document.body.dataset.handoffRecoverySignalsReady = 'true';
      document.body.dataset.handoffRecoverySignalsCount = '0';
      return;
    }
    target.hidden = false;
    const handoffs = service().list();
    const rows = signals.slice(0, 6).map((signal) => {
      const existing = handoffs.find((item) => item.sourceSignalId === signal.id && item.ownerEmail === signal.ownerEmail);
      return `
        <article class="bf-client-activity__item" data-handoff-recovery-signal="${escapeHtml(signal.type)}">
          <span>${escapeHtml(signal.severity === 'alta' ? 'Alta prioridade' : signal.severity === 'media' ? 'Média prioridade' : 'Acompanhamento')}</span>
          <strong>${escapeHtml(commercialText(signal.title))}</strong>
          <small>${escapeHtml(actorLabel(signal.ownerEmail))} - ${escapeHtml(commercialText(signal.reason))}${signal.age ? ` - ${escapeHtml(signal.age)}` : ''}</small>
          <div class="bf-inline-actions">
            <a class="btn btn--ghost btn--sm" href="${escapeHtml(signal.ctaHref || 'dashboard-cliente.html')}">${escapeHtml(commercialText(signal.ctaLabel || 'Abrir'))}</a>
            ${existing
              ? `<button class="btn btn--ghost btn--sm" type="button" data-handoff-open="${escapeHtml(existing.id)}">Abrir atendimento</button>`
              : `<button class="btn btn--primary btn--sm" type="button" data-handoff-create-signal="${escapeHtml(signal.id)}">Criar atendimento</button>`}
          </div>
        </article>
      `;
    }).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Clientes para retomar</span>
          <h2>Converse com quem parou antes de concluir.</h2>
          <p>Veja quem interrompeu uma comparação, uma simulação ou uma proposta e retome no ponto certo.</p>
        </div>
      </div>
      <div class="bf-platform-metrics">
        ${metric('Sinais', summary.total || 0, 'strong')}
        ${metric('Abertos', summary.open || 0)}
        ${metric('Alta prioridade', summary.high || 0, summary.high ? 'warn' : '')}
        ${metric('Clientes', summary.owners || 0)}
      </div>
      <div class="bf-client-activity">
        ${rows || '<div class="bf-empty-state">Nenhum cliente precisa de retomada agora.</div>'}
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
      target.innerHTML = '<div class="bf-empty-state">Nenhuma atividade registrada ainda.</div>';
      return;
    }
    target.innerHTML = events.map((event) => `
      <article class="bf-client-activity__item">
        <span>${escapeHtml(commercialText(event.action || 'Atividade'))}</span>
        <strong>${escapeHtml(event.handoffId ? `Atendimento ${event.handoffId}` : 'Atendimento')}</strong>
        <small>${escapeHtml(date(event.createdAt))} - ${escapeHtml(actorLabel(event.actorEmail))}</small>
        <a href="#fila-handoff">Ver carteira</a>
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
        : item && item.sourceCalculatorHistoryId ? 'calculator'
        : item && item.sourceSignalType === 'imported-recovery-item' ? 'imported'
          : item && item.sourceSignalId ? 'signal'
            : item && item.sourceJourneyId ? 'journey'
              : 'manual'
    );
  }

  function sourceLabel(item) {
    const labels = {
      proposal: 'Proposta',
      journey: 'Planejamento do cliente',
      calculator: 'Simulação financeira',
      signal: 'Retomada',
      imported: 'Importado',
      manual: 'Inclusão manual'
    };
    return labels[sourceType(item)] || 'Atendimento';
  }

  function sourceSummary(item) {
    if (item && item._backendLead) {
      return 'Atendimento atualizado pelo sistema.';
    }
    const type = sourceType(item);
    if (type === 'proposal') {
      return [
        item.sourceProposalStatus === 'reviewed' ? 'Proposta revisada' : 'Proposta vinculada',
        item.sourceProposalVersion ? 'revisão salva' : 'revisão pendente',
        item.sourceProposalValidUntil ? `válida até ${date(item.sourceProposalValidUntil)}` : ''
      ].filter(Boolean).join(' - ');
    }
    if (type === 'journey') {
      return item.sourceJourneyUpdatedAt ? `Planejamento atualizado em ${date(item.sourceJourneyUpdatedAt)}.` : 'Atendimento iniciado pelo planejamento do cliente.';
    }
    if (type === 'calculator') {
      return [
        item.sourceCalculatorName || item.sourceCalculatorSlug ? `${item.sourceCalculatorName || item.sourceCalculatorSlug}` : '',
        item.sourceCalculatorRisk ? `risco ${item.sourceCalculatorRisk}` : '',
        item.sourceCalculatorUpdatedAt ? `salvo em ${date(item.sourceCalculatorUpdatedAt)}` : ''
      ].filter(Boolean).join(' - ') || 'Resultado financeiro vinculado ao atendimento.';
    }
    if (type === 'imported') {
      return item.sourceSignalUpdatedAt ? `Recebido em ${date(item.sourceSignalUpdatedAt)}.` : 'Atendimento recebido da equipe.';
    }
    if (type === 'signal') {
      return item.sourceSignalSeverity ? `Retomada de prioridade ${item.sourceSignalSeverity}.` : 'Cliente disponível para retomada.';
    }
    return 'Atendimento criado pela equipe.';
  }

  function proposalState(item) {
    return service().proposalState ? service().proposalState(item) : ((item && item.operational && item.operational.proposal) || {
      active: false,
      tone: 'baixa',
      label: '',
      reason: ''
    });
  }

  function proposalDisplay(state) {
    if (!state || !state.active) return { label: 'Sem proposta', reason: '' };
    if (state.expired) {
      return {
        label: 'Proposta vencida',
        reason: 'A validade terminou antes da conclusão do atendimento.'
      };
    }
    if (!state.locked) {
      return {
        label: 'Revisão pendente',
        reason: 'Confira os valores e registre a revisão antes de avançar.'
      };
    }
    if (!state.reviewed) {
      return {
        label: 'Conferência incompleta',
        reason: 'A proposta precisa da conferência final.'
      };
    }
    if (Number(state.versionHours || 0) >= 72) {
      return {
        label: 'Retomar proposta',
        reason: 'A última revisão ocorreu há mais de três dias.'
      };
    }
    return {
      label: 'Proposta conferida',
      reason: 'A proposta está salva e vinculada a este atendimento.'
    };
  }

  function actionPlan(item) {
    return service().actionPlan ? service().actionPlan(item) : {
      active: false,
      actionKey: '',
      type: 'none',
      title: item && item.operational ? item.operational.nextStep : 'Definir próximo passo',
      reason: '',
      owner: item && (item.assignedTo || item.ownerEmail) ? (item.assignedTo || item.ownerEmail) : 'definir na fila',
      deadlineLabel: 'Até 72h',
      ctaLabel: 'Abrir atendimento',
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
        <strong>${escapeHtml(commercialText(stage.label || 'Contato'))}</strong>
        <small>${escapeHtml(commercialText(stage.stale ? 'Retomar etapa' : stage.historyLabel || 'Etapa definida pelo atendimento'))} - ${escapeHtml(stage.stageAgeLabel || '-')}</small>
      </div>
    `;
  }

  function commercialStagePanel(item) {
    const stage = commercialStage(item);
    return `
      <section class="bf-handoff-commercial-panel bf-handoff-commercial-panel--${escapeHtml(stage.tone || 'baixa')} bf-platform-section" data-handoff-commercial-stage-panel>
        <div>
          <span class="bf-badge bf-badge--gold">Andamento comercial</span>
          <h3>${escapeHtml(commercialText(stage.label || 'Contato'))}</h3>
          <p>${escapeHtml(stage.stale ? 'O prazo desta etapa venceu. Retome o cliente.' : 'Esta etapa está dentro do prazo.')}</p>
        </div>
        <dl>
          <div><dt>Etapa</dt><dd>${escapeHtml(commercialText(stage.label || 'Contato'))}</dd></div>
          <div><dt>Tempo nesta etapa</dt><dd>${escapeHtml(stage.stageAgeLabel || '-')}</dd></div>
          <div><dt>Prazo de retorno</dt><dd>${escapeHtml(stage.deadlineHours || '-')}h</dd></div>
          <div><dt>Atualizado por</dt><dd>${escapeHtml(actorLabel(stage.updatedBy || stage.actorEmail))}</dd></div>
        </dl>
        <small data-handoff-commercial-stage-history>${escapeHtml(commercialText(stage.historyLabel || 'Etapa definida pelo atendimento'))}${stage.movementAt ? ` - ${escapeHtml(date(stage.movementAt))}` : ''}</small>
        <a class="btn btn--ghost btn--sm" href="dashboard-admin.html?from=handoff#admin-funil-comercial">Ver gestão comercial</a>
      </section>
    `;
  }

  function actionStatusClass(status) {
    return ['em_execucao', 'adiada', 'concluida'].includes(status) ? status : 'pendente';
  }

  function actionHistoryMarkup(plan) {
    const events = service().actionHistory ? service().actionHistory(plan.actionKey).slice(0, 3) : [];
    if (!events.length) return '<small>Nenhuma execução registrada ainda.</small>';
    return events.map((event) => `
      <small>${escapeHtml(commercialText(event.status || event.action || 'ação'))} - ${escapeHtml(date(event.createdAt))} - ${escapeHtml(actorLabel(event.actorEmail))}</small>
    `).join('');
  }

  function actionExecutionPanel(plan, item) {
    const execution = plan.execution || (service().actionExecution ? service().actionExecution(plan.actionKey) : { status: 'pendente', statusLabel: 'Pendente', reason: '' });
    return `
      <div class="bf-action-execution bf-action-execution--${escapeHtml(actionStatusClass(execution.status))}" data-handoff-action-execution="${escapeHtml(plan.actionKey || item.id || '')}">
        <div class="bf-action-execution__head">
          <span>Status da ação</span>
          <strong>${escapeHtml(commercialText(execution.statusLabel || 'Pendente'))}</strong>
        </div>
        <label>Motivo ou observação
          <input data-handoff-action-reason value="${escapeHtml(commercialText(execution.reason || ''))}" placeholder="Ex.: cliente pediu retorno amanhã">
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
    const display = proposalDisplay(state);
    return `
      <div class="bf-handoff-proposal-chip bf-handoff-proposal-chip--${escapeHtml(state.tone)}" data-handoff-proposal-version>
        <span>${escapeHtml(display.label)}</span>
        <strong>${escapeHtml(commercialText(state.nextStep || 'Acompanhar proposta'))}</strong>
        <small>${escapeHtml(display.reason)}</small>
      </div>
    `;
  }

  function proposalInterestResumeId(item) {
    if (!item || item.interestSchema !== 'bancus.proposal-interest.v1') return '';
    const id = String(item.id || '').trim();
    return /^LEAD-PI-[A-F0-9]+$/i.test(id) ? id : '';
  }

  function isProtectedProposalInterest(item) {
    return Boolean(proposalInterestResumeId(item));
  }

  function proposalItemHref(item) {
    const params = ['from=handoff'];
    if (item && item.sourceProposalId) params.push(`proposalId=${encodeURIComponent(item.sourceProposalId)}`);
    if (item && item.sourceProposalVersionId) params.push(`proposalVersionId=${encodeURIComponent(item.sourceProposalVersionId)}`);
    if (item && item.sourceSimulationId) params.push(`simulationId=${encodeURIComponent(item.sourceSimulationId)}`);
    const interestId = proposalInterestResumeId(item);
    if (interestId) {
      params.push('proposalView=review');
      params.push(`interestId=${encodeURIComponent(interestId)}`);
    }
    return `simulador.html?${params.join('&')}#proposta`;
  }

  function proposalVersionPanel(item) {
    const state = proposalState(item);
    if (!state.active) return '';
    const display = proposalDisplay(state);
    return `
      <section class="bf-handoff-proposal-panel bf-handoff-proposal-panel--${escapeHtml(state.tone)} bf-platform-section" data-handoff-proposal-version>
        <div>
          <span class="bf-badge bf-badge--gold">Proposta vinculada</span>
          <h3>${escapeHtml(display.label)}</h3>
          <p>${escapeHtml(display.reason)}</p>
        </div>
        <dl>
          <div><dt>Proposta</dt><dd>${escapeHtml(item.sourceProposalId || '-')}</dd></div>
          <div><dt>Revisão</dt><dd>${escapeHtml(state.reviewed ? 'Concluída' : 'Pendente')}</dd></div>
          <div><dt>Validade</dt><dd>${escapeHtml(state.validUntil || 'A confirmar')}</dd></div>
          <div><dt>Última atualização</dt><dd>${escapeHtml(state.versionAgeLabel || '-')}</dd></div>
        </dl>
        <small>${escapeHtml(state.locked ? 'Proposta salva para este atendimento.' : 'Revise a proposta antes de avançar.')}</small>
        <a class="btn btn--ghost btn--sm" href="${escapeHtml(proposalItemHref(item))}">Abrir proposta</a>
      </section>
    `;
  }

  function card(item) {
    const summary = item.summary || {};
    const status = service().statusLabels[item.status] || item.status;
    const checklist = item.checklist || [];
    const done = checklist.filter((entry) => entry.done).length;
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente';
    const op = item.operational || (service().operationalState ? service().operationalState(item) : {});
    const stage = commercialStage(item);
    return `
      <article class="bf-handoff-card${item.id === selectedId ? ' is-selected' : ''}" data-handoff-card="${escapeHtml(item.id)}">
        <div class="bf-handoff-card__top">
          <span class="bf-handoff-status bf-handoff-status--${escapeHtml(item.status)}">${escapeHtml(status)}</span>
          <span class="bf-handoff-priority bf-handoff-priority--${escapeHtml(item.priority)}">${escapeHtml(priorityLabel(item.priority))}</span>
          <span class="bf-handoff-source bf-handoff-source--${escapeHtml(sourceType(item))}">${escapeHtml(sourceLabel(item))}</span>
          ${item._backendLead ? `<span class="bf-handoff-source bf-handoff-source--backend" data-handoff-live-source="${escapeHtml(item._backendSource || 'sqlite')}">Atualizado</span>` : ''}
          <span class="bf-handoff-aging bf-handoff-aging--${escapeHtml(op.tone || 'baixa')}">${escapeHtml(op.slaOverdue ? 'Retorno vencido' : op.ageLabel || '-')}</span>
          <span class="bf-handoff-commercial-stage-tag bf-handoff-commercial-stage-tag--${escapeHtml(stage.tone || 'baixa')}" data-handoff-commercial-stage="${escapeHtml(stage.key || 'contato')}">${escapeHtml(commercialText(stage.label || 'Contato'))}</span>
        </div>
        <h3>${escapeHtml(commercialText(item.objectiveLabel || 'Oportunidade'))}</h3>
        <p>${escapeHtml(ownerLabel)} - ${escapeHtml(commercialText(summary.productName || '-'))} / ${escapeHtml(commercialText(summary.modelName || '-'))}</p>
        <small class="bf-handoff-origin-note">${escapeHtml(sourceSummary(item))}</small>
        ${proposalVersionChip(item)}
        ${commercialStageChip(item)}
        <div class="bf-mini-facts">
          <div><dt>Crédito</dt><dd>${escapeHtml(money(summary.valorCredito || 0))}</dd></div>
          <div><dt>Etapas</dt><dd>${done}/${checklist.length}</dd></div>
          <div><dt>Sem atualização</dt><dd>${escapeHtml(op.ageLabel || '-')}</dd></div>
          <div><dt>Próximo passo</dt><dd>${escapeHtml(commercialText(op.nextStep || '-'))}</dd></div>
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
      : '<div class="bf-empty-state">Nenhum atendimento encontrado para os filtros atuais.</div>';
    renderDetail();
  }

  function timelineMarkup(item) {
    const events = (item.timeline || []).slice(0, 8);
    if (!events.length) return '<div class="bf-empty-state">Sem eventos registrados.</div>';
    const labels = {
      create: 'Atendimento criado pelo planejamento',
      refresh: 'Atendimento atualizado pelo planejamento',
      'calculator:create': 'Atendimento criado por uma simulação financeira',
      'calculator:refresh': 'Atendimento atualizado por uma simulação financeira',
      'signal:create': 'Atendimento criado para retomada',
      'signal:refresh': 'Atendimento atualizado para retomada',
      'proposal:create': 'Atendimento criado por uma proposta',
      'proposal:refresh': 'Atendimento atualizado por uma proposta',
      note: 'Anotação adicionada',
      assign: 'Responsável atualizado',
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
        <strong>${escapeHtml(commercialText(labels[event.type] || event.label || event.type || 'Atividade'))}</strong>
        <small>${escapeHtml(date(event.createdAt))} - ${escapeHtml(actorLabel(event.actorEmail))}</small>
      </article>
    `).join('');
  }

  function notesMarkup(item) {
    const notes = (item.notes || []).slice(0, 6);
    if (!notes.length) return '<div class="bf-empty-state">Nenhuma anotação registrada.</div>';
    return notes.map((note) => `
      <article class="bf-handoff-note">
        <p>${escapeHtml(note.text)}</p>
        <small>${escapeHtml(date(note.createdAt))} - ${escapeHtml(actorLabel(note.actorEmail))}</small>
      </article>
    `).join('');
  }

  function checklistMarkup(item) {
    return (item.checklist || []).map((entry) => `
      <label class="bf-handoff-check">
        <input type="checkbox" data-handoff-check="${escapeHtml(entry.id)}"${entry.done ? ' checked' : ''}>
        <span>${escapeHtml(commercialText(entry.label))}</span>
      </label>
    `).join('');
  }

  function renderDetail() {
    const target = qs('[data-handoff-detail]');
    if (!target) return;
    const item = liveHandoffById(selectedId);
    if (!item) {
      target.innerHTML = '<div class="bf-empty-state">Selecione um atendimento para acompanhar.</div>';
      return;
    }

    const summary = item.summary || {};
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente';
    const op = item.operational || {};
    const plan = actionPlan(item);
    const stage = commercialStage(item);
    const protectedProposalInterest = isProtectedProposalInterest(item);
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--ok">${escapeHtml(sourceLabel(item))}</span>
          ${item._backendLead ? `<span class="bf-badge bf-badge--gold" data-handoff-live-source="${escapeHtml(item._backendSource || 'sqlite')}">Atualizado</span>` : ''}
          <h2>${escapeHtml(commercialText(item.objectiveLabel || item.id))}</h2>
          <p>${escapeHtml(ownerLabel)} - criado em ${escapeHtml(date(item.createdAt))}</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="trilha-decisao.html">Rever trilha</a>
      </div>

      <div class="bf-handoff-detail-grid">
        <label>Status
          <select data-handoff-status="${escapeHtml(item.id)}">${statusOptions(item.status)}</select>
        </label>
        <label>Responsável
          ${protectedProposalInterest
            ? `<input value="${escapeHtml(item.assignedTo || '')}" placeholder="Fila de propostas" readonly aria-readonly="true">
               <small>Definido pela fila da proposta.</small>`
            : `<input data-handoff-assignee="${escapeHtml(item.id)}" value="${escapeHtml(item.assignedTo || '')}" placeholder="consultor@example.com">`}
        </label>
      </div>

      <div class="bf-platform-metrics bf-platform-section">
        ${metric('Origem', sourceLabel(item))}
        ${metric('Prioridade', op.slaOverdue ? 'Retorno vencido' : priorityLabel(item.priority), op.slaOverdue || item.priority === 'alta' ? 'warn' : '')}
        ${metric('Tempo sem atualização', op.ageLabel || '-')}
        ${metric('Prazo de retorno', `${op.slaHours || '-'}h`)}
        ${metric('Responsável sugerido', commercialText(op.suggestedAssignee || 'a definir'), op.unassigned ? 'warn' : '')}
        ${metric('Etapa comercial', commercialText(stage.label || 'Contato'), stage.stale ? 'warn' : '')}
        ${metric('Tempo nesta etapa', stage.stageAgeLabel || '-')}
        ${metric('Produto', commercialText(summary.productName || '-'))}
        ${metric('Modelo', commercialText(summary.modelName || '-'))}
        ${metric('Reserva', `${Number(summary.reservaMeses || 0).toFixed(1)} meses`, summary.gapReserva > 0 ? 'warn' : '')}
        ${metric('Capacidade segura', money(summary.capacidadePagamento || 0), 'strong')}
      </div>

      <section class="bf-handoff-next-step bf-handoff-action--${escapeHtml(op.tone || 'media')} bf-platform-section" data-handoff-next-step data-handoff-action-plan="${escapeHtml(item.id)}">
        <span class="bf-badge bf-badge--gold">Próximo passo</span>
        <strong>${escapeHtml(commercialText(plan.title || op.nextStep || 'Definir próximo passo'))}</strong>
        <p>${escapeHtml(commercialText(plan.reason || (op.slaOverdue ? 'O prazo de retorno venceu para esta prioridade.' : op.waitingClient ? 'O cliente aguarda retorno há mais de dois dias.' : op.unassigned ? 'Defina um responsável antes de seguir.' : 'O atendimento está dentro do prazo.')))}</p>
        <dl class="bf-handoff-action-plan">
          <div><dt>Responsável</dt><dd>${escapeHtml(commercialText(plan.owner || op.suggestedAssignee || 'a definir'))}</dd></div>
          <div><dt>Prazo</dt><dd>${escapeHtml(commercialText(plan.deadlineLabel || 'Até 72h'))}</dd></div>
          <div><dt>Status</dt><dd>${escapeHtml(commercialText((plan.execution && plan.execution.statusLabel) || 'Pendente'))}</dd></div>
        </dl>
        ${plan.type === 'proposal' ? `<a class="btn btn--ghost btn--sm" href="${escapeHtml(plan.href || proposalItemHref(item))}">${escapeHtml(commercialText(plan.ctaLabel || 'Abrir proposta'))}</a>` : ''}
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
          <span class="bf-badge bf-badge--navy">Anotações</span>
          <form class="bf-handoff-note-form" data-handoff-note-form="${escapeHtml(item.id)}">
            <textarea name="note" rows="4" placeholder="Registre uma observação sobre a conversa."></textarea>
            <button class="btn btn--primary btn--sm" type="submit">Adicionar anotação</button>
          </form>
          <div class="bf-handoff-notes">${notesMarkup(item)}</div>
        </section>
      </div>

      <section class="bf-platform-section">
        <span class="bf-badge bf-badge--ok">Histórico</span>
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
            label: 'Anotação adicionada',
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

  document.addEventListener('DOMContentLoaded', async () => {
    if (window.BFAuth && window.BFAuth.ready) await window.BFAuth.ready;
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
