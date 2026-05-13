(function () {
  'use strict';

  let editingId = null;
  const ADMIN_COMMERCIAL_STAGE_STATE_KEY = 'bf_admin_commercial_stage_states_v1';
  const ADMIN_COMMERCIAL_STAGE_AUDIT_KEY = 'bf_admin_commercial_stage_audit_v1';
  const ADMIN_COMMERCIAL_STAGE_AUDIT_LIMIT = 160;
  let backendLocalImportState = { loading: false, result: null };

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function formatDate(value) {
    if (!value) return 'Sem acesso';
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

  function formatBytes(value) {
    const bytes = Number(value || 0);
    if (!Number.isFinite(bytes) || bytes <= 0) return '0 KB';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  function setMessage(message, tone) {
    const target = qs('[data-admin-message]');
    if (!target) return;
    target.className = `bf-platform-alert ${tone === 'success' ? 'bf-platform-alert--success' : ''}`;
    target.textContent = message || '';
  }

  function allUsers() {
    return window.BFAuth.listUsers();
  }

  function adminRecoveryService() {
    return window.BFAdminRecoveryService;
  }

  function adminRecoveryQueue(options = {}) {
    const service = adminRecoveryService();
    return service && service.list ? service.list({ includeCreated: true, ...options }) : [];
  }

  function filteredUsers() {
    const search = (qs('[data-user-search]')?.value || '').trim().toLowerCase();
    const role = qs('[data-user-role-filter]')?.value || '';
    const status = qs('[data-user-status-filter]')?.value || '';

    return allUsers().filter((user) => {
      const matchesSearch = !search || [user.name, user.email, user.department, user.phone].join(' ').toLowerCase().includes(search);
      const matchesRole = !role || user.role === role;
      const matchesStatus = !status || user.status === status;
      return matchesSearch && matchesRole && matchesStatus;
    });
  }

  function renderCurrentUser() {
    const target = qs('[data-current-admin]');
    const user = window.BFAuth.getCurrentUser();
    if (!target || !user) return;
    target.innerHTML = `
      <div>
        <span class="bf-badge bf-badge--gold">Sessao administrativa</span>
        <h3>${escapeHtml(user.name)}</h3>
        <p>${escapeHtml(user.email)} - ${escapeHtml(user.roleLabel)}</p>
      </div>
      <a class="btn btn--ghost btn--sm" href="dashboard-cliente.html">Abrir dashboard cliente</a>
    `;
  }

  function renderMetrics() {
    const target = qs('[data-admin-user-metrics]');
    if (!target) return;
    const users = allUsers();
    const active = users.filter((user) => user.status === 'active').length;
    const admins = users.filter((user) => user.role === 'admin').length;
    const consultores = users.filter((user) => user.role === 'consultor').length;

    target.innerHTML = `
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Usuarios</small><strong>${users.length}</strong></article>
        <article class="bf-platform-metric"><small>Ativos</small><strong>${active}</strong></article>
        <article class="bf-platform-metric"><small>Administradores</small><strong>${admins}</strong></article>
        <article class="bf-platform-metric"><small>Consultores</small><strong>${consultores}</strong></article>
      </div>
    `;
  }

  function renderOperationalStrip() {
    const target = qs('[data-admin-operational-strip]');
    if (!target) return;
    const users = allUsers();
    const active = users.filter((user) => user.status === 'active').length;
    const admins = users.filter((user) => user.role === 'admin' && user.status === 'active').length;
    const handoffService = window.BFHandoffConsultivoService;
    const handoffs = handoffService ? handoffService.list() : [];
    const handoffMetrics = handoffService ? handoffService.metrics(handoffs) : { total: 0, open: 0, highPriority: 0, completion: 0 };
    const recoveryService = adminRecoveryService();
    const recoveryItems = adminRecoveryQueue();
    const recoverySummary = recoveryService && recoveryService.summary
      ? recoveryService.summary(recoveryItems, users)
      : { total: 0, open: 0, high: 0, consultants: 0 };
    const models = window.BFComparatorModels && window.BFComparatorModels.all ? window.BFComparatorModels.all() : [];
    const audit = window.BFComparatorModels && window.BFComparatorModels.audit ? window.BFComparatorModels.audit() : [];
    const inactive = users.length - active;
    const cards = [
      {
        tone: inactive ? 'warning' : 'stable',
        eyebrow: 'Acessos',
        title: `${active}/${users.length} usuários ativos`,
        body: inactive ? `${inactive} usuário${inactive === 1 ? '' : 's'} inativo${inactive === 1 ? '' : 's'} exigem revisão de permissão.` : 'Diretório local ativo e pronto para a operação.',
        action: 'Revisar diretório'
      },
      {
        tone: recoverySummary.open ? (recoverySummary.high ? 'warning' : 'info') : (handoffMetrics.open ? 'info' : 'stable'),
        eyebrow: 'Leads',
        title: recoverySummary.open ? `${recoverySummary.open} retomada${recoverySummary.open === 1 ? '' : 's'} na fila` : `${handoffMetrics.open} handoff${handoffMetrics.open === 1 ? '' : 's'} em aberto`,
        body: recoverySummary.open
          ? `${recoverySummary.high} de alta prioridade, ${recoverySummary.consultants} consultor${recoverySummary.consultants === 1 ? '' : 'es'} elegiveis e ${handoffMetrics.open} handoff${handoffMetrics.open === 1 ? '' : 's'} em aberto.`
          : `${handoffMetrics.total} lead${handoffMetrics.total === 1 ? '' : 's'} locais, ${handoffMetrics.highPriority} de alta prioridade e checklist medio de ${handoffMetrics.completion}%.`,
        action: 'Abrir fila consultiva'
      },
      {
        tone: models.length ? 'stable' : 'info',
        eyebrow: 'Modelos',
        title: `${models.length} modelo${models.length === 1 ? '' : 's'} no comparador`,
        body: audit.length ? `${audit.length} evento${audit.length === 1 ? '' : 's'} de auditoria de modelos registrados.` : 'Modelos criados, clonados ou importados aparecerão na auditoria local.',
        action: 'Ver auditoria'
      },
      {
        tone: admins >= 2 ? 'stable' : 'warning',
        eyebrow: 'Governança',
        title: admins >= 2 ? 'Admin redundante' : 'Admin único',
        body: admins >= 2 ? 'Há mais de um administrador ativo para continuidade operacional.' : 'Considere manter mais de um administrador ativo antes de uso real.',
        action: 'Gerir permissões'
      }
    ];

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Operação administrativa</span>
        <div>
          <h2>Governança local em uma leitura.</h2>
          <p>O painel conecta acessos, leads consultivos, modelos e auditoria para acompanhar a saúde operacional do protótipo.</p>
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

  function journeyActionLabel(action) {
    const labels = {
      product_selected: 'Produto selecionado',
      product_removed: 'Produto removido',
      product_top3_selected: 'Top 3 aplicado',
      product_selection_cleared: 'Selecao limpa',
      products_compare_open: 'Comparador aberto',
      comparator_loaded_from_products: 'Produtos no comparador',
      comparator_calculated: 'Matriz calculada',
      comparator_saved: 'Cenario salvo',
      simulator_opened_from_comparator: 'Simulador aberto',
      simulator_calculated_financiamento: 'Financiamento calculado',
      simulator_calculated_cdc: 'CDC calculado',
      simulator_calculated_garantia: 'Garantia calculada',
      simulator_calculated_consignado: 'Consignado calculado',
      simulator_calculated_veiculos: 'Veiculos calculado'
    };
    return labels[action] || String(action || 'Evento').replace(/_/g, ' ');
  }

  function journeyEventDetail(event) {
    const detail = event && event.detail ? event.detail : {};
    if (detail.productId) return detail.productId;
    if (Array.isArray(detail.selectionIds) && detail.selectionIds.length) return detail.selectionIds.join(', ');
    if (Array.isArray(detail.productIds) && detail.productIds.length) return detail.productIds.join(', ');
    if (detail.winner) return detail.winner;
    if (detail.simulator) return detail.simulator;
    return event && event.ownerEmail ? event.ownerEmail : 'jornada';
  }

  function eventHoursSince(value) {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, (Date.now() - timestamp) / 36e5);
  }

  function eventAgeLabel(hours) {
    const value = Number(hours || 0);
    if (value < 1) return 'menos de 1h';
    if (value < 24) return `${Math.round(value)}h`;
    const days = Math.floor(value / 24);
    const rest = Math.round(value % 24);
    return rest > 0 ? `${days}d ${rest}h` : `${days}d`;
  }

  function alertSeverityFromHours(hours) {
    const value = Number(hours || 0);
    if (value >= 24) return 'alta';
    if (value >= 4) return 'media';
    return 'baixa';
  }

  function alertSeverityLabel(severity) {
    const labels = {
      alta: 'Alta',
      media: 'Media',
      baixa: 'Baixa'
    };
    return labels[severity] || 'Baixa';
  }

  function alertWeight(severity) {
    const weights = {
      alta: 3,
      media: 2,
      baixa: 1
    };
    return weights[severity] || 0;
  }

  function hasJourneyType(events, types) {
    const set = new Set(types);
    return events.some((event) => set.has(event.type));
  }

  function hasJourneyPrefix(events, prefix) {
    return events.some((event) => String(event.type || '').startsWith(prefix));
  }

  function groupJourneyEventsByOwner(events) {
    return (events || []).reduce((groups, event) => {
      const owner = event.ownerEmail || 'anon';
      if (!groups[owner]) groups[owner] = [];
      groups[owner].push(event);
      return groups;
    }, {});
  }

  function buildJourneyAbandonmentAlerts() {
    const service = window.BFJourneyAnalytics;
    const events = service && service.all ? service.all() : [];
    const groups = groupJourneyEventsByOwner(events);

    return Object.keys(groups).map((owner) => {
      const list = groups[owner].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
      const latest = list[0] || {};
      const hours = eventHoursSince(latest.createdAt);
      const meta = {
        ownerEmail: latest.ownerEmail || owner,
        ownerRoleLabel: latest.ownerRoleLabel || latest.ownerRole || 'Origem',
        hours,
        age: eventAgeLabel(hours),
        severity: alertSeverityFromHours(hours),
        ctaHref: 'produtos.html'
      };
      const hasSelection = hasJourneyType(list, ['product_selected', 'product_top3_selected']);
      const hasCompare = hasJourneyType(list, ['products_compare_open', 'comparator_loaded_from_products']);
      const hasMatrix = hasJourneyType(list, ['comparator_calculated']);
      const hasSaved = hasJourneyType(list, ['comparator_saved']);
      const hasSimulator = hasJourneyPrefix(list, 'simulator_calculated');

      if (hasSelection && !hasCompare) {
        return {
          ...meta,
          type: 'abandono',
          title: 'Selecao sem comparador',
          reason: 'Usuario escolheu produto, mas ainda nao abriu a matriz comparativa.',
          ctaLabel: 'Retomar produtos',
          ctaHref: 'produtos.html'
        };
      }

      if (hasCompare && !hasMatrix) {
        return {
          ...meta,
          type: 'abandono',
          title: 'Comparador sem matriz',
          reason: 'Produtos chegaram ao comparador, mas nenhum calculo foi concluido.',
          ctaLabel: 'Abrir comparador',
          ctaHref: 'comparador.html'
        };
      }

      if (hasMatrix && !hasSaved && !hasSimulator) {
        return {
          ...meta,
          type: 'abandono',
          title: 'Decisao sem continuidade',
          reason: 'Matriz calculada sem cenario salvo ou simulador acionado em seguida.',
          ctaLabel: 'Revisar decisao',
          ctaHref: 'comparador.html'
        };
      }

      return null;
    }).filter(Boolean);
  }

  function slaHoursForPriority(priority) {
    const rules = {
      alta: 4,
      media: 24,
      baixa: 72
    };
    return rules[priority] || rules.media;
  }

  function buildHandoffSlaAlerts() {
    const service = window.BFHandoffConsultivoService;
    if (!service) return [];
    const handoffs = service.list().filter((item) => !['qualificado', 'descartado'].includes(item.status));
    return handoffs.map((item) => {
      const hours = eventHoursSince(item.updatedAt || item.createdAt);
      const slaHours = slaHoursForPriority(item.priority);
      const waitingClient = item.status === 'aguardando_cliente' && hours >= 48;
      const overdue = hours >= slaHours;
      if (!overdue && !waitingClient) return null;
      return {
        type: 'sla',
        severity: overdue ? (item.priority === 'alta' ? 'alta' : 'media') : 'baixa',
        title: overdue ? 'SLA de handoff vencido' : 'Lead aguardando cliente',
        reason: overdue
          ? `Lead ${service.priorityLabels[item.priority] || item.priority || 'Media'} ultrapassou ${slaHours}h sem conclusao.`
          : 'Lead esta em espera de retorno do cliente ha mais de 48h.',
        ownerEmail: item.ownerEmail || 'anon',
        ownerRoleLabel: service.statusLabels[item.status] || item.status || 'Handoff',
        hours,
        age: eventAgeLabel(hours),
        ctaLabel: 'Abrir fila',
        ctaHref: 'handoff-consultivo.html',
        handoffId: item.id,
        objectiveLabel: item.objectiveLabel || (item.summary && item.summary.productName) || item.id
      };
    }).filter(Boolean);
  }

  function adminLocalStorageKeys() {
    const store = window.localStorage;
    if (!store) return [];
    try {
      if (typeof store.length === 'number' && typeof store.key === 'function') {
        return Array.from({ length: store.length }, (_, index) => store.key(index)).filter(Boolean);
      }
      return Object.keys(store);
    } catch (error) {
      return [];
    }
  }

  function readAdminJson(key, fallback) {
    try {
      const raw = window.localStorage ? window.localStorage.getItem(key) : '';
      if (!raw) return fallback;
      const parsed = JSON.parse(raw);
      return parsed == null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeAdminJson(key, value) {
    try {
      if (!window.localStorage) return false;
      window.localStorage.setItem(key, JSON.stringify(value));
      return true;
    } catch (error) {
      return false;
    }
  }

  function stableHash(value) {
    const text = String(value || '');
    let hash = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      hash ^= text.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return (hash >>> 0).toString(16).toUpperCase().padStart(8, '0');
  }

  function localImportOwnerFromKey(key) {
    const text = String(key || '');
    const scopedPrefixes = ['bf_journey_analytics_v1:', 'bf_decision_journey_history_v1:', 'bf_decision_journey_v1:', 'bf_comparator_models_v1:'];
    const prefix = scopedPrefixes.find((item) => text.startsWith(item));
    return prefix ? text.slice(prefix.length) || 'anon' : '';
  }

  function localImportType(prefix, action) {
    const cleanAction = String(action || 'event').trim() || 'event';
    return cleanAction.startsWith(`${prefix}:`) ? cleanAction : `${prefix}:${cleanAction}`;
  }

  function normalizeLocalImportEvent(key, event, index, config) {
    if (!event || typeof event !== 'object') return null;
    const action = event.type || event.action || event.status || event.calculatorSlug || 'event';
    const type = localImportType(config.typePrefix, action);
    const ownerEmail = event.ownerEmail || event.owner || localImportOwnerFromKey(key) || '';
    const entityId = event.handoffId || event.modelId || event.actionKey || event.journeyId || event.historyId || event.id || '';
    const createdAt = event.createdAt || event.updatedAt || event.importedAt || event.completedAt || '';
    const id = `LS-${stableHash([key, index, event.id || entityId, type, createdAt].join('|'))}`;
    return {
      id,
      type,
      source: config.source,
      ownerEmail,
      actorEmail: event.actorEmail || event.updatedBy || ownerEmail || '',
      entityType: config.entityType,
      entityId,
      createdAt,
      payload: {
        storageKey: key,
        localId: event.id || '',
        ...event
      }
    };
  }

  function collectLocalImportEvents() {
    const configs = [
      { key: 'bf_decision_context_audit_v1', source: 'decision-context', typePrefix: 'decision-context', entityType: 'decision-context' },
      { prefix: 'bf_journey_analytics_v1:', source: 'journey-analytics', typePrefix: 'journey', entityType: 'journey-event' },
      { key: 'bf_calculator_history_v1', source: 'calculator-history', typePrefix: 'calculator', entityType: 'calculator' },
      { key: 'bf_comparator_model_audit_v1', source: 'comparator-model-audit', typePrefix: 'comparator-model', entityType: 'comparator-model' },
      { key: 'bf_consultive_handoff_audit_v1', source: 'handoff-consultivo', typePrefix: 'handoff', entityType: 'handoff' },
      { key: 'bf_operational_action_audit_v1', source: 'operational-action-audit', typePrefix: 'operational-action', entityType: 'operational-action' },
      { key: 'bf_admin_commercial_stage_audit_v1', source: 'admin-commercial-stage', typePrefix: 'admin-commercial-stage', entityType: 'commercial-stage' },
      { key: 'bf_admin_recovery_audit_v1', source: 'admin-recovery', typePrefix: 'admin-recovery', entityType: 'recovery' }
    ];
    const events = [];
    const keys = adminLocalStorageKeys();
    configs.forEach((config) => {
      const matchedKeys = config.prefix
        ? keys.filter((key) => String(key || '').startsWith(config.prefix))
        : keys.filter((key) => key === config.key);
      matchedKeys.forEach((key) => {
        const list = readAdminJson(key, []);
        if (!Array.isArray(list)) return;
        list.forEach((event, index) => {
          const normalized = normalizeLocalImportEvent(key, event, index, config);
          if (normalized) events.push(normalized);
        });
      });
    });
    return events.slice(0, 500);
  }

  function normalizeLocalSnapshot(key, item, index, config) {
    if (!item || typeof item !== 'object') return null;
    const ownerEmail = item.ownerEmail || item.owner || localImportOwnerFromKey(key) || '';
    const updatedAt = item.updatedAt || item.createdAt || item.savedAt || item.generatedAt || '';
    const entityId = item.id || item.proposalId || item.handoffId || item.journeyId || item.historyId || item.simulationId || item.modelId || `${config.type}-${index}`;
    const title = item.title || item.name || item.cliente || item.clientName || item.objectiveLabel || item.productName || config.title || config.type;
    const id = `SNP-${stableHash([key, index, entityId, config.type, updatedAt].join('|'))}`;
    return {
      id,
      type: config.type,
      source: config.source,
      ownerEmail,
      actorEmail: item.actorEmail || item.updatedBy || ownerEmail || '',
      entityId,
      title,
      status: item.status || item.queueStatus || item.operationalStatus || item.stage || '',
      storageKey: key,
      createdAt: item.createdAt || item.savedAt || updatedAt,
      updatedAt,
      payload: {
        storageKey: key,
        localId: item.id || '',
        ...item
      }
    };
  }

  function collectLocalSnapshotRecords() {
    const configs = [
      { key: 'consorciopro_simulations', type: 'simulation', source: 'simulator-storage', title: 'Simulacao salva', mode: 'array' },
      { prefix: 'bf_decision_journey_v1:', type: 'decision-journey', source: 'decision-journey', title: 'Trilha ativa', mode: 'object' },
      { prefix: 'bf_decision_journey_history_v1:', type: 'decision-journey-history', source: 'decision-journey', title: 'Historico de trilha', mode: 'array' },
      { key: 'bank_fratern_proposal_versions_v1', type: 'proposal-version', source: 'proposal-versioning', title: 'Versao de proposta', mode: 'array' },
      { key: 'bank_fratern_proposal_acceptances_v1', type: 'proposal-acceptance', source: 'proposal-acceptance', title: 'Aceite de proposta', mode: 'array' },
      { key: 'bank_fratern_proposal_builder_v1', type: 'proposal-builder', source: 'proposal-builder', title: 'Lousa de proposta', mode: 'object' },
      { key: 'bf_consultive_handoffs_v1', type: 'handoff', source: 'handoff-consultivo', title: 'Handoff consultivo', mode: 'array' },
      { key: 'bf_financial_profile_v1', type: 'financial-profile', source: 'decision-context', title: 'Perfil financeiro', mode: 'object' },
      { prefix: 'bf_comparator_models_v1:', type: 'comparator-models', source: 'comparator-models', title: 'Modelos comparador', mode: 'array' }
    ];
    const keys = adminLocalStorageKeys();
    const rows = [];

    configs.forEach((config) => {
      const matchedKeys = config.prefix
        ? keys.filter((key) => String(key || '').startsWith(config.prefix))
        : keys.filter((key) => key === config.key);
      matchedKeys.forEach((key) => {
        const value = readAdminJson(key, config.mode === 'array' ? [] : null);
        const list = config.mode === 'array' ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
        list.forEach((item, index) => {
          const normalized = normalizeLocalSnapshot(key, item, index, config);
          if (normalized) rows.push(normalized);
        });
      });
    });

    return rows.slice(0, 300);
  }

  function collectLocalImportSnapshot() {
    const users = window.BFAuth && window.BFAuth.listUsers ? window.BFAuth.listUsers() : [];
    const events = collectLocalImportEvents();
    const snapshots = collectLocalSnapshotRecords();
    return {
      source: 'admin-local-storage',
      generatedAt: new Date().toISOString(),
      users: users.map((user) => ({
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        status: user.status,
        department: user.department || '',
        phone: user.phone || ''
      })),
      events,
      snapshots
    };
  }

  function scopedOwnerFromKey(key, prefix) {
    return String(key || '').startsWith(prefix) ? String(key).slice(prefix.length) || 'anon' : 'anon';
  }

  function readScopedRecords(prefix, mode) {
    const rows = [];
    adminLocalStorageKeys().forEach((key) => {
      if (!String(key || '').startsWith(prefix)) return;
      const ownerEmail = scopedOwnerFromKey(key, prefix);
      const value = readAdminJson(key, mode === 'array' ? [] : null);
      const list = mode === 'array' ? (Array.isArray(value) ? value : []) : (value ? [value] : []);
      list.forEach((item) => {
        if (item && typeof item === 'object') rows.push({ ...item, ownerEmail: item.ownerEmail || item.owner || ownerEmail });
      });
    });
    return rows;
  }

  function readAdminDecisionJourneys() {
    const current = readScopedRecords('bf_decision_journey_v1:', 'object');
    const history = readScopedRecords('bf_decision_journey_history_v1:', 'array');
    const seen = new Set();
    return current.concat(history).filter((item) => {
      const id = item && item.id ? item.id : `${item.ownerEmail || 'anon'}:${item.updatedAt || item.createdAt || ''}`;
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  }

  function readAdminCalculatorHistory() {
    const history = readAdminJson('bf_calculator_history_v1', []);
    return Array.isArray(history) ? history.filter(Boolean) : [];
  }

  function readAdminProposalReviews() {
    const history = readAdminJson('bank_fratern_proposal_acceptances_v1', []);
    return Array.isArray(history) ? history.filter((item) => item && item.proposalId) : [];
  }

  function readAdminProposalVersions() {
    const history = readAdminJson('bank_fratern_proposal_versions_v1', []);
    return Array.isArray(history) ? history.filter((item) => item && item.proposalId) : [];
  }

  function latestProposalReviews() {
    const map = new Map();
    readAdminProposalReviews().forEach((item) => {
      const key = item.proposalId;
      const current = map.get(key);
      const currentDate = current ? String(current.updatedAt || current.createdAt || '') : '';
      const nextDate = String(item.updatedAt || item.createdAt || '');
      if (!current || nextDate.localeCompare(currentDate) >= 0) map.set(key, item);
    });
    return Array.from(map.values());
  }

  function latestProposalVersions() {
    const map = new Map();
    readAdminProposalVersions().forEach((item) => {
      const key = item.proposalId;
      const current = map.get(key);
      const currentVersion = current ? Number(current.version || 0) : 0;
      const nextVersion = Number(item.version || 0);
      const currentDate = current ? String(current.updatedAt || current.createdAt || '') : '';
      const nextDate = String(item.updatedAt || item.createdAt || '');
      if (!current || nextVersion > currentVersion || (nextVersion === currentVersion && nextDate.localeCompare(currentDate) >= 0)) {
        map.set(key, item);
      }
    });
    return Array.from(map.values());
  }

  function proposalVersionMap() {
    return new Map(latestProposalVersions().map((item) => [item.proposalId, item]));
  }

  function proposalReviewMap() {
    return new Map(latestProposalReviews().map((item) => [item.proposalId, item]));
  }

  function proposalVersionExpired(item) {
    if (!item || !item.validUntil) return false;
    const expires = new Date(`${item.validUntil}T23:59:59`);
    return Number.isFinite(expires.getTime()) && expires < new Date();
  }

  function proposalVersionAttention(item) {
    if (!item) return false;
    return proposalVersionExpired(item) || item.status !== 'reviewed';
  }

  function latestItemDate(item) {
    if (!item || typeof item !== 'object') return '';
    return item.updatedAt ||
      item.createdAt ||
      item.latestEventAt ||
      item.importedAt ||
      item.sourceProposalUpdatedAt ||
      item.sourceSignalUpdatedAt ||
      item.validUntil ||
      '';
  }

  function sourceFromJourneyEvent(event) {
    const type = String(event && event.type ? event.type : '');
    if (type.startsWith('simulator_')) return 'simulator';
    if (type.startsWith('comparator_') || type === 'products_compare_open') return 'comparator';
    if (type.startsWith('product_') || type === 'product_selection_cleared') return 'product';
    return 'product';
  }

  function sourceFromRecoveryStage(stage) {
    const value = String(stage || '');
    if (value.includes('simulator') || value.includes('complete')) return 'simulator';
    if (value.includes('comparator') || value.includes('matrix') || value.includes('decision') || value.includes('saved')) return 'comparator';
    if (value.includes('selection') || value.includes('product')) return 'product';
    if (value === 'selected') return 'product';
    if (['compare', 'decision', 'saved'].includes(value)) return 'comparator';
    if (['simulator', 'complete'].includes(value)) return 'simulator';
    return 'product';
  }

  function sourceFromHandoff(item, service) {
    const source = service && service.sourceType ? service.sourceType(item) : (item && item.sourceType) || 'manual';
    if (source === 'signal') return sourceFromRecoveryStage(item.sourceSignalStage || (item.summary && item.summary.stage) || item.sourceSignalType);
    if (source === 'imported') return 'package';
    if (source === 'proposal') return 'proposal';
    if (source === 'journey') return 'journey';
    return 'manual';
  }

  function isOpenHandoff(item) {
    return item && !['qualificado', 'descartado'].includes(item.status);
  }

  function handoffSlaState(item) {
    const hours = eventHoursSince(item && (item.updatedAt || item.createdAt));
    const limit = slaHoursForPriority(item && item.priority);
    return {
      hours,
      limit,
      overdue: isOpenHandoff(item) && hours >= limit
    };
  }

  function addSourceRecord(row, item, options = {}) {
    const date = latestItemDate(item);
    row.total += 1;
    if (options.open) row.open += 1;
    if (options.high) row.high += 1;
    if (options.sla) row.sla += 1;
    if (options.suggestedAssignee && !row.suggestedAssignee) row.suggestedAssignee = options.suggestedAssignee;
    if (options.detail) row.details.add(options.detail);
    const owner = options.ownerEmail || (item && (item.ownerEmail || item.owner || item.createdBy || item.reviewer)) || '';
    if (owner) row.owners.add(owner);
    if (date && String(date).localeCompare(row.latestAt || '') > 0) row.latestAt = date;
  }

  function adminSourceDefinitions() {
    return [
      { key: 'calculator', label: 'Calculadoras', href: 'calculadoras.html', next: 'Revisar diagnosticos' },
      { key: 'product', label: 'Produtos', href: 'produtos.html', next: 'Retomar selecao' },
      { key: 'journey', label: 'Trilha assistida', href: 'trilha-decisao.html', next: 'Abrir trilha' },
      { key: 'comparator', label: 'Comparador', href: 'comparador.html', next: 'Concluir matriz' },
      { key: 'simulator', label: 'Simulador', href: 'simulador.html', next: 'Revisar simulacao' },
      { key: 'proposal', label: 'Proposta', href: 'simulador.html#step-9', next: 'Gerar handoff' },
      { key: 'package', label: 'Pacotes', href: '#admin-pacotes-recuperacao', next: 'Roteamento' },
      { key: 'manual', label: 'Manual', href: 'handoff-consultivo.html', next: 'Revisar lead' }
    ];
  }

  function buildAdminSourceFunnel() {
    const service = window.BFHandoffConsultivoService;
    const events = window.BFJourneyAnalytics && window.BFJourneyAnalytics.all ? window.BFJourneyAnalytics.all() : [];
    const handoffs = service ? service.list() : [];
    const recoveryItems = adminRecoveryQueue({ includeCreated: true });
    const importedItems = adminRecoveryService() && adminRecoveryService().importedItems ? adminRecoveryService().importedItems() : [];
    const packages = adminRecoveryService() && adminRecoveryService().importedPackages ? adminRecoveryService().importedPackages() : [];
    const rows = adminSourceDefinitions().reduce((acc, item) => {
      acc[item.key] = {
        ...item,
        total: 0,
        open: 0,
        high: 0,
        sla: 0,
        latestAt: '',
        owners: new Set(),
        details: new Set(),
        suggestedAssignee: ''
      };
      return acc;
    }, {});

    events.forEach((event) => addSourceRecord(rows[sourceFromJourneyEvent(event)], event, {
      ownerEmail: event.ownerEmail,
      detail: journeyActionLabel(event.type)
    }));

    readAdminCalculatorHistory().forEach((item) => {
      const slug = String(item.calculatorSlug || '');
      const source = slug.startsWith('simulador') ? 'simulator' : 'calculator';
      addSourceRecord(rows[source], item, {
        detail: item.calculatorName || slug || 'Historico financeiro'
      });
    });

    readAdminDecisionJourneys().forEach((item) => addSourceRecord(rows.journey, item, {
      ownerEmail: item.ownerEmail || item.owner,
      detail: item.objectiveLabel || item.objective || 'Trilha salva'
    }));

    latestProposalReviews().forEach((item) => addSourceRecord(rows.proposal, item, {
      high: item.status !== 'reviewed',
      detail: item.statusLabel || item.status || 'Proposta revisada'
    }));

    latestProposalVersions().forEach((item) => addSourceRecord(rows.proposal, item, {
      high: proposalVersionAttention(item),
      detail: item.version ? `Versao ${item.version} da proposta` : 'Proposta versionada'
    }));

    recoveryItems.forEach((item) => addSourceRecord(rows[sourceFromRecoveryStage(item.stage)], item, {
      open: item.queueStatus !== 'handoff-criado',
      high: item.severity === 'alta',
      suggestedAssignee: item.suggestedAssigneeName || item.suggestedAssigneeEmail,
      ownerEmail: item.ownerEmail,
      detail: item.stageLabel || item.stage
    }));

    handoffs.forEach((item) => {
      const source = sourceFromHandoff(item, service);
      const sla = handoffSlaState(item);
      addSourceRecord(rows[source] || rows.manual, item, {
        open: isOpenHandoff(item),
        high: item.priority === 'alta',
        sla: sla.overdue,
        suggestedAssignee: item.assignedTo,
        ownerEmail: item.ownerEmail,
        detail: service && service.sourceLabel ? service.sourceLabel(item) : item.sourceLabel
      });
    });

    importedItems.forEach((item) => addSourceRecord(rows.package, item, {
      open: item.operationalStatus !== 'handoff-criado',
      high: item.severity === 'alta',
      sla: item.slaOverdue === true,
      suggestedAssignee: item.assignedTo || item.suggestedAssigneeName || item.suggestedAssigneeEmail,
      ownerEmail: item.ownerEmail,
      detail: item.packageLabel || item.packageSource || 'Pacote importado'
    }));

    packages.forEach((item) => addSourceRecord(rows.package, item, {
      detail: item.label || item.source || 'Pacote recebido'
    }));

    const max = Math.max(1, ...Object.values(rows).map((item) => Number(item.total || 0)));
    return Object.values(rows).filter((item) => item.total > 0 || item.key !== 'manual').map((item) => {
      const hours = item.latestAt ? eventHoursSince(item.latestAt) : 0;
      return {
        ...item,
        ownersCount: item.owners.size,
        detailList: Array.from(item.details).filter(Boolean).slice(0, 2),
        age: item.latestAt ? eventAgeLabel(hours) : 'sem sinal',
        width: Math.max(4, Math.round((Number(item.total || 0) / max) * 100)),
        tone: item.sla ? 'alta' : (item.high || item.open ? 'media' : 'baixa')
      };
    });
  }

  function hasComparatorAfter(ownerEmail, date, events) {
    const owner = String(ownerEmail || '').toLowerCase();
    const baseline = String(date || '');
    return (events || []).some((event) => {
      const eventOwner = String(event.ownerEmail || '').toLowerCase();
      if (owner && eventOwner && owner !== eventOwner) return false;
      if (baseline && String(event.createdAt || '').localeCompare(baseline) < 0) return false;
      return ['products_compare_open', 'comparator_loaded_from_products', 'comparator_calculated'].includes(event.type);
    });
  }

  function buildAdminBottlenecks() {
    const service = window.BFHandoffConsultivoService;
    const handoffs = service ? service.list() : [];
    const events = window.BFJourneyAnalytics && window.BFJourneyAnalytics.all ? window.BFJourneyAnalytics.all() : [];
    const proposalHandoffs = handoffs.filter((item) => sourceFromHandoff(item, service) === 'proposal');
    const proposalHandoffIds = new Set(proposalHandoffs.map((item) => item.sourceProposalId).filter(Boolean));
    const versionsByProposal = proposalVersionMap();
    const reviewsByProposal = proposalReviewMap();
    const rows = [];

    latestProposalReviews()
      .filter((item) => !proposalHandoffIds.has(item.proposalId))
      .forEach((item) => rows.push({
        type: 'proposal-without-handoff',
        title: 'Proposta revisada sem handoff',
        reason: `Proposta ${item.proposalId} tem revisao ${item.statusLabel || item.status || 'registrada'}, mas ainda nao virou fila consultiva.`,
        severity: item.status === 'reviewed' ? 'media' : 'alta',
        age: eventAgeLabel(eventHoursSince(item.updatedAt || item.createdAt)),
        ownerEmail: item.reviewer || 'proposta local',
        targetId: item.proposalId || '',
        actionOwner: item.reviewer || 'consultor da proposta',
        next: 'Criar handoff da proposta',
        href: `simulador.html?from=admin&proposalId=${encodeURIComponent(item.proposalId || '')}#step-9`,
        hours: eventHoursSince(item.updatedAt || item.createdAt)
      }));

    latestProposalVersions()
      .filter((item) => !proposalHandoffIds.has(item.proposalId) && !reviewsByProposal.has(item.proposalId))
      .forEach((item) => rows.push({
        type: 'proposal-version-without-handoff',
        title: 'Proposta versionada sem handoff',
        reason: `Proposta ${item.proposalId} tem versao ${item.version || 0} salva, mas ainda nao virou fila consultiva.`,
        severity: proposalVersionExpired(item) ? 'alta' : 'media',
        age: eventAgeLabel(eventHoursSince(item.updatedAt || item.createdAt)),
        ownerEmail: item.consultor || item.cliente || 'proposta local',
        targetId: item.proposalId || '',
        actionOwner: item.consultor || 'consultor da proposta',
        next: 'Criar handoff da proposta',
        href: `simulador.html?from=admin&proposalId=${encodeURIComponent(item.proposalId || '')}#step-9`,
        hours: eventHoursSince(item.updatedAt || item.createdAt)
      }));

    latestProposalVersions()
      .filter((item) => proposalVersionExpired(item))
      .forEach((item) => rows.push({
        type: 'proposal-expired',
        title: 'Proposta vencida',
        reason: `Proposta ${item.proposalId} venceu em ${item.validUntil || 'validade local'} e precisa de revisao antes da continuidade.`,
        severity: 'alta',
        age: eventAgeLabel(eventHoursSince(item.validUntil || item.updatedAt || item.createdAt)),
        ownerEmail: item.consultor || item.cliente || 'proposta local',
        targetId: item.proposalId || '',
        actionOwner: item.consultor || 'consultor da proposta',
        next: 'Revisar validade',
        href: `simulador.html?from=admin&proposalId=${encodeURIComponent(item.proposalId || '')}#step-9`,
        hours: eventHoursSince(item.validUntil || item.updatedAt || item.createdAt)
      }));

    proposalHandoffs
      .filter((item) => {
        const latest = versionsByProposal.get(item.sourceProposalId);
        if (!latest || !isOpenHandoff(item)) return false;
        const latestVersion = Number(latest.version || 0);
        const handoffVersion = Number(item.sourceProposalVersion || 0);
        const hashChanged = latest.sourceHash && item.sourceProposalVersionHash && latest.sourceHash !== item.sourceProposalVersionHash;
        return latestVersion > handoffVersion || hashChanged;
      })
      .forEach((item) => {
        const latest = versionsByProposal.get(item.sourceProposalId);
        rows.push({
          type: 'proposal-version-outdated-handoff',
          title: 'Proposta alterada apos handoff',
          reason: `Handoff ${item.id} usa versao ${item.sourceProposalVersion || 0}, mas a proposta ${item.sourceProposalId} ja tem versao ${latest.version || 0}.`,
          severity: 'alta',
          age: eventAgeLabel(eventHoursSince(latest.updatedAt || latest.createdAt)),
          ownerEmail: item.ownerEmail || latest.consultor || 'proposta local',
          targetId: item.id || '',
          proposalId: item.sourceProposalId || '',
          actionOwner: item.assignedTo || item.ownerEmail || latest.consultor || 'consultor da proposta',
          next: 'Atualizar handoff',
          href: `handoff-consultivo.html?from=admin&handoffId=${encodeURIComponent(item.id || '')}#detalhe-handoff`,
          hours: eventHoursSince(latest.updatedAt || latest.createdAt)
        });
      });

    readAdminDecisionJourneys()
      .filter((item) => !hasComparatorAfter(item.ownerEmail || item.owner, item.updatedAt || item.createdAt, events))
      .forEach((item) => rows.push({
        type: 'journey-without-comparator',
        title: 'Trilha sem comparador',
        reason: `${item.objectiveLabel || item.objective || 'Trilha assistida'} ainda nao gerou abertura ou matriz no comparador.`,
        severity: alertSeverityFromHours(eventHoursSince(item.updatedAt || item.createdAt)),
        age: eventAgeLabel(eventHoursSince(item.updatedAt || item.createdAt)),
        ownerEmail: item.ownerEmail || item.owner || 'anon',
        targetId: item.id || item.journeyId || '',
        actionOwner: item.ownerEmail || item.owner || 'consultor da trilha',
        next: 'Abrir comparador',
        href: 'comparador.html?from=admin',
        hours: eventHoursSince(item.updatedAt || item.createdAt)
      }));

    handoffs
      .filter((item) => isOpenHandoff(item) && !item.assignedTo)
      .forEach((item) => rows.push({
        type: 'handoff-without-assignee',
        title: 'Handoff sem responsavel',
        reason: `${item.objectiveLabel || item.id} esta aberto sem consultor atribuido.`,
        severity: item.priority === 'alta' ? 'alta' : 'media',
        age: eventAgeLabel(eventHoursSince(item.updatedAt || item.createdAt)),
        ownerEmail: item.ownerEmail || 'anon',
        targetId: item.id || '',
        actionOwner: 'coordenacao local',
        next: 'Atribuir consultor',
        href: `handoff-consultivo.html?from=admin&handoffId=${encodeURIComponent(item.id || '')}#detalhe-handoff`,
        hours: eventHoursSince(item.updatedAt || item.createdAt)
      }));

    handoffs
      .filter((item) => handoffSlaState(item).overdue)
      .forEach((item) => {
        const sla = handoffSlaState(item);
        rows.push({
          type: 'overdue-sla',
          title: 'SLA vencido',
          reason: `${item.objectiveLabel || item.id} ultrapassou ${sla.limit}h sem conclusao.`,
          severity: item.priority === 'alta' ? 'alta' : 'media',
          age: eventAgeLabel(sla.hours),
          ownerEmail: item.ownerEmail || 'anon',
          targetId: item.id || '',
          actionOwner: item.assignedTo || item.ownerEmail || 'consultor responsavel',
          next: 'Priorizar atendimento',
          href: `handoff-consultivo.html?from=admin&handoffId=${encodeURIComponent(item.id || '')}#detalhe-handoff`,
          hours: sla.hours
        });
      });

    const importedItems = adminRecoveryService() && adminRecoveryService().importedItems ? adminRecoveryService().importedItems() : [];
    importedItems
      .filter((item) => item.slaOverdue === true)
      .forEach((item) => rows.push({
        type: 'overdue-package-sla',
        title: 'SLA vencido',
        reason: `${item.title || item.id} veio de pacote e precisa de roteamento ou handoff.`,
        severity: item.severity === 'alta' ? 'alta' : 'media',
        age: item.slaAgeLabel || item.age || 'SLA local',
        ownerEmail: item.ownerEmail || 'pacote',
        targetId: item.id || '',
        actionOwner: item.assignedTo || item.suggestedAssigneeName || 'coordenacao local',
        next: 'Roteamento de pacote',
        href: '#admin-pacotes-recuperacao',
        hours: Number(item.slaHours || item.hours || 0)
      }));

    const uniqueRows = rows.filter((item, index, list) => {
      const key = `${item.type}:${item.reason}`;
      return list.findIndex((candidate) => `${candidate.type}:${candidate.reason}` === key) === index;
    });

    return uniqueRows.sort((a, b) => {
      const bySeverity = alertWeight(b.severity) - alertWeight(a.severity);
      if (bySeverity) return bySeverity;
      return Number(b.hours || 0) - Number(a.hours || 0);
    }).slice(0, 8);
  }

  function renderAdminSourceFunnel(rows) {
    const sourceRows = rows || buildAdminSourceFunnel();
    return `
      <section class="bf-admin-source-funnel" id="admin-origens" data-admin-source-funnel>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--navy">Origem e prioridade</span>
            <h3>Funil por origem operacional</h3>
            <p>Consolida calculadoras, produtos, trilha, comparador, simulador, proposta e pacotes para orientar a proxima acao do admin.</p>
          </div>
        </div>
        <div class="bf-admin-source-grid">
          ${sourceRows.map((item) => `
            <article class="bf-admin-source-card bf-admin-source-card--${escapeHtml(item.tone)}" data-admin-source="${escapeHtml(item.key)}">
              <div class="bf-admin-source-card__top">
                <span>${escapeHtml(item.label)}</span>
                <strong>${escapeHtml(item.age)}</strong>
              </div>
              <h4>${escapeHtml(item.total)} ${item.total === 1 ? 'sinal' : 'sinais'}</h4>
              <div class="bf-admin-funnel-bar"><i style="width:${escapeHtml(item.width)}%"></i></div>
              <dl>
                <div><dt>Abertos</dt><dd>${escapeHtml(item.open)}</dd></div>
                <div><dt>Alta</dt><dd>${escapeHtml(item.high)}</dd></div>
                <div><dt>SLA</dt><dd>${escapeHtml(item.sla)}</dd></div>
                <div><dt>Origens</dt><dd>${escapeHtml(item.ownersCount)}</dd></div>
              </dl>
              <p>${escapeHtml(item.detailList.join(' | ') || 'Sem detalhe local recente.')}</p>
              <small>Responsavel sugerido: ${escapeHtml(item.suggestedAssignee || 'definir na fila')}</small>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">${escapeHtml(item.next)}</a>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderAdminBottleneckBoard(rows) {
    const bottlenecks = rows || buildAdminBottlenecks();
    return `
      <section class="bf-admin-bottleneck-board" id="admin-gargalos" data-admin-bottleneck-board>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Gargalos</span>
            <h3>Proximos passos priorizados</h3>
            <p>Destaca proposta revisada sem handoff, proposta versionada vencida ou alterada depois do handoff, trilha sem comparador, handoff sem responsavel e SLA vencido.</p>
          </div>
        </div>
        <div class="bf-admin-bottleneck-grid">
          ${bottlenecks.length ? bottlenecks.map((item) => `
            <article class="bf-admin-bottleneck-card bf-admin-bottleneck-card--${escapeHtml(item.severity)}" data-admin-bottleneck="${escapeHtml(item.type)}">
              <div class="bf-admin-alert-card__top">
                <span>${escapeHtml(item.title)}</span>
                <strong>${escapeHtml(alertSeverityLabel(item.severity))}</strong>
              </div>
              <p>${escapeHtml(item.reason)}</p>
              <div class="bf-admin-alert-meta">
                <small>${escapeHtml(item.ownerEmail)}</small>
                <small>${escapeHtml(item.age)}</small>
                <small>${escapeHtml(item.next)}</small>
              </div>
              <div class="bf-admin-alert-actions">
                <a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">${escapeHtml(item.next)}</a>
              </div>
            </article>
          `).join('') : '<div class="bf-empty-state">Nenhum gargalo critico encontrado nos sinais locais atuais.</div>'}
        </div>
      </section>
    `;
  }

  function buildAdminNextActions(sourceRows, bottlenecks) {
    const actions = [];
    (bottlenecks || []).slice(0, 4).forEach((item) => {
      actions.push({
        source: item.title,
        title: item.next || item.title,
        reason: item.reason,
        href: item.href,
        tone: item.severity || 'media',
        meta: `${item.age || 'agora'} - ${item.ownerEmail || 'origem local'}`
      });
    });

    (sourceRows || [])
      .filter((item) => item.sla || item.high || item.open)
      .sort((a, b) => {
        const score = (row) => (Number(row.sla || 0) * 4) + (Number(row.high || 0) * 3) + (Number(row.open || 0) * 2) + Number(row.total || 0);
        return score(b) - score(a);
      })
      .slice(0, 4)
      .forEach((item) => {
        actions.push({
          source: item.label,
          title: item.next,
          reason: `${item.open} aberto${item.open === 1 ? '' : 's'}, ${item.high} alta prioridade e ${item.sla} SLA vencido${item.sla === 1 ? '' : 's'}.`,
          href: item.href,
          tone: item.tone || 'media',
          meta: `${item.age} - ${item.suggestedAssignee || 'responsavel a definir'}`
        });
      });

    const seen = new Set();
    const unique = actions.filter((item) => {
      const key = `${item.title}:${item.href}:${item.source}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    if (unique.length) return unique.slice(0, 5);
    return [{
      source: 'Operacao local',
      title: 'Manter monitoramento',
      reason: 'Nenhum gargalo critico apareceu nos dados locais atuais.',
      href: '#admin-funil-jornada',
      tone: 'baixa',
      meta: 'sem urgencia operacional'
    }];
  }

  function adminActionDeadline(item) {
    const type = item && item.type ? item.type : '';
    const severity = item && item.severity ? item.severity : item && item.tone ? item.tone : 'media';
    const hours = Number(item && item.hours ? item.hours : 0);
    if (severity === 'alta' || type.includes('expired') || type.includes('outdated') || hours >= 72) return 'Hoje';
    if (type.includes('without-assignee') || hours >= 24) return 'Ate 24h';
    if (severity === 'media') return 'Ate 48h';
    return 'Ate 72h';
  }

  function adminActionExecution(action) {
    const service = window.BFHandoffConsultivoService;
    if (service && typeof service.actionExecution === 'function') return service.actionExecution(action);
    return { actionKey: action.actionKey || '', status: 'pendente', statusLabel: 'Pendente', reason: '' };
  }

  function adminActionHistory(action) {
    const service = window.BFHandoffConsultivoService;
    return service && typeof service.actionHistory === 'function' ? service.actionHistory(action).slice(0, 3) : [];
  }

  function adminActionAuditRecords() {
    const service = window.BFHandoffConsultivoService;
    return service && typeof service.actionAudit === 'function' ? service.actionAudit() : [];
  }

  function adminActionStatusClass(status) {
    return ['em_execucao', 'adiada', 'concluida'].includes(status) ? status : 'pendente';
  }

  function elapsedHours(startValue, endValue) {
    const start = new Date(startValue || '').getTime();
    const end = new Date(endValue || '').getTime();
    if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return null;
    return Math.max(0, (end - start) / 36e5);
  }

  function durationLabel(hours) {
    if (hours === null || hours === undefined || hours === '') return 'sem base';
    if (!Number.isFinite(Number(hours))) return 'sem base';
    const value = Number(hours);
    if (value < 1) return 'menos de 1h';
    if (value < 24) return `${Math.round(value)}h`;
    const days = Math.floor(value / 24);
    const rest = Math.round(value % 24);
    return rest ? `${days}d ${rest}h` : `${days}d`;
  }

  function buildAdminActionExecutionSummary(queue) {
    const summary = { pending: 0, running: 0, delayed: 0, done: 0, owners: new Map() };
    (queue || []).forEach((item) => {
      const status = item.execution && item.execution.status ? item.execution.status : 'pendente';
      if (status === 'concluida') summary.done += 1;
      else if (status === 'adiada') summary.delayed += 1;
      else if (status === 'em_execucao') summary.running += 1;
      else summary.pending += 1;
      const owner = item.owner || 'coordenacao local';
      const current = summary.owners.get(owner) || { owner, total: 0, pending: 0, running: 0, delayed: 0, done: 0 };
      current.total += 1;
      if (status === 'concluida') current.done += 1;
      else if (status === 'adiada') current.delayed += 1;
      else if (status === 'em_execucao') current.running += 1;
      else current.pending += 1;
      summary.owners.set(owner, current);
    });
    return {
      ...summary,
      owners: Array.from(summary.owners.values()).slice(0, 4)
    };
  }

  function buildAdminConsultantProductivity(sourceRows, bottlenecks) {
    const queue = buildAdminActionQueue(sourceRows, bottlenecks);
    const audit = adminActionAuditRecords();
    const auditCompletedKeys = new Set(audit
      .filter((event) => event && event.status === 'concluida' && event.actionKey)
      .map((event) => event.actionKey));
    const auditDelayedKeys = new Set(audit
      .filter((event) => event && event.status === 'adiada' && event.actionKey)
      .map((event) => event.actionKey));
    const byOwner = new Map();

    function ensure(owner) {
      const key = owner || 'coordenacao local';
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          owner: key,
          open: 0,
          running: 0,
          delayed: 0,
          completed: 0,
          recurrent: new Map(),
          durations: [],
          recentAt: '',
          recentLabel: 'Sem historico'
        });
      }
      return byOwner.get(key);
    }

    queue.forEach((item) => {
      const owner = item.owner || (item.execution && item.execution.owner) || 'coordenacao local';
      const row = ensure(owner);
      const status = item.execution && item.execution.status ? item.execution.status : 'pendente';
      if (status === 'concluida') {
        if (!auditCompletedKeys.has(item.actionKey)) row.completed += 1;
      } else {
        row.open += 1;
        if (status === 'em_execucao') row.running += 1;
        if (status === 'adiada' && !auditDelayedKeys.has(item.actionKey)) row.delayed += 1;
      }
      const label = item.source || item.type || 'Operacao';
      row.recurrent.set(label, (row.recurrent.get(label) || 0) + 1);
    });

    const groupedAudit = new Map();
    audit.forEach((event) => {
      const owner = event.owner || event.actorEmail || 'coordenacao local';
      const row = ensure(owner);
      const status = event.status || '';
      if (status === 'concluida') row.completed += 1;
      if (status === 'adiada') row.delayed += 1;
      const label = event.title || event.action || 'Execucao';
      row.recurrent.set(label, (row.recurrent.get(label) || 0) + 1);
      if (String(event.createdAt || '').localeCompare(row.recentAt || '') > 0) {
        row.recentAt = event.createdAt || '';
        row.recentLabel = `${status || event.action || 'acao'} - ${formatDate(event.createdAt)}`;
      }
      const key = event.actionKey || event.id;
      if (!key) return;
      const list = groupedAudit.get(key) || [];
      list.push(event);
      groupedAudit.set(key, list);
    });

    groupedAudit.forEach((events) => {
      const ordered = events.slice().sort((a, b) => String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
      let startEvent = null;
      ordered.forEach((event) => {
        if (event.status === 'em_execucao') startEvent = event;
        if (event.status === 'concluida') {
          const start = startEvent || ordered.find((candidate) => candidate.createdAt && candidate.createdAt !== event.createdAt);
          const hours = start ? elapsedHours(start.createdAt, event.createdAt) : null;
          if (hours !== null) ensure(event.owner || event.actorEmail || 'coordenacao local').durations.push(hours);
          startEvent = null;
        }
      });
    });

    const rows = Array.from(byOwner.values()).map((row) => {
      const avg = row.durations.length
        ? row.durations.reduce((sum, item) => sum + item, 0) / row.durations.length
        : null;
      const recurrent = Array.from(row.recurrent.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label, total]) => `${label} (${total})`);
      const total = row.open + row.completed;
      const completionRate = total ? Math.round((row.completed / total) * 100) : 0;
      return {
        ...row,
        avgHours: avg,
        avgLabel: durationLabel(avg),
        recurrent,
        completionRate,
        tone: row.delayed ? 'alta' : row.open ? 'media' : 'baixa'
      };
    });

    return rows.sort((a, b) => {
      const pressure = (row) => (row.delayed * 4) + (row.running * 3) + (row.open * 2) - row.completed;
      return pressure(b) - pressure(a);
    }).slice(0, 6);
  }

  function buildAdminActionQueue(sourceRows, bottlenecks) {
    const actions = [];
    (bottlenecks || []).slice(0, 8).forEach((item) => {
      const target = item.targetId || item.proposalId || item.ownerEmail || 'origem local';
      actions.push({
        actionKey: `admin:${item.type || 'bottleneck'}:${target}`,
        type: item.type || 'bottleneck',
        source: item.title || 'Gargalo local',
        title: item.next || item.title || 'Abrir acao',
        reason: item.reason || 'Gargalo operacional detectado nos dados locais.',
        owner: item.actionOwner || item.ownerEmail || 'coordenacao local',
        deadline: adminActionDeadline(item),
        target,
        href: item.href || '#admin-gargalos',
        cta: item.next || 'Abrir acao',
        tone: item.severity || 'media',
        hours: Number(item.hours || 0)
      });
    });

    (sourceRows || [])
      .filter((item) => item.sla || item.high || item.open)
      .slice()
      .sort((a, b) => {
        const score = (row) => (Number(row.sla || 0) * 4) + (Number(row.high || 0) * 3) + (Number(row.open || 0) * 2) + Number(row.total || 0);
        return score(b) - score(a);
      })
      .slice(0, 4)
      .forEach((item) => {
        const sourceTitle = item.key === 'proposal' && item.open ? 'Revisar propostas ativas' : (item.next || 'Abrir fila');
        const sourceHref = item.key === 'proposal' && item.open ? 'handoff-consultivo.html?from=admin#fila-handoff' : (item.href || '#admin-origens');
        const sourceCta = item.key === 'proposal' && item.open ? 'Abrir handoffs' : (item.next || 'Abrir origem');
        actions.push({
          actionKey: `admin:source-${item.key}`,
          type: `source-${item.key}`,
          source: item.label,
          title: sourceTitle,
          reason: `${item.open} aberto${item.open === 1 ? '' : 's'}, ${item.high} alta prioridade e ${item.sla} SLA vencido${item.sla === 1 ? '' : 's'} nesta origem.`,
          owner: item.suggestedAssignee || 'coordenacao local',
          deadline: item.sla || item.tone === 'alta' ? 'Hoje' : item.high ? 'Ate 24h' : 'Ate 72h',
          target: `${item.total} ${item.total === 1 ? 'sinal' : 'sinais'}`,
          href: sourceHref,
          cta: sourceCta,
          tone: item.tone || 'media',
          hours: Number(item.total || 0)
        });
      });

    const seen = new Set();
    const unique = actions.filter((item) => {
      const key = `${item.type}:${item.title}:${item.target}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });

    const sorted = unique.sort((a, b) => {
      const bySeverity = alertWeight(b.tone) - alertWeight(a.tone);
      if (bySeverity) return bySeverity;
      return Number(b.hours || 0) - Number(a.hours || 0);
    }).slice(0, 6);

    if (sorted.length) return sorted.map((item, index) => ({
      ...item,
      rank: index + 1,
      execution: adminActionExecution(item)
    }));
    const fallback = {
      actionKey: 'admin:monitoramento:local',
      rank: 1,
      type: 'monitoramento',
      source: 'Operacao local',
      title: 'Manter monitoramento',
      reason: 'Nenhum gargalo acionavel apareceu nos dados locais atuais.',
      owner: 'admin local',
      deadline: 'Ate 72h',
      target: 'sem urgencia',
      href: '#admin-funil-jornada',
      cta: 'Rever funil',
      tone: 'baixa',
      hours: 0
    };
    return [{
      ...fallback,
      execution: adminActionExecution(fallback)
    }];
  }

  function renderAdminNextActionBoard(sourceRows, bottlenecks) {
    const actions = buildAdminNextActions(sourceRows, bottlenecks);
    return `
      <section class="bf-admin-next-actions" id="admin-proximos-passos" data-admin-next-actions>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--ok">Cockpit admin</span>
            <h3>Proximas acoes recomendadas</h3>
            <p>Lista curta para o admin decidir sem abrir cada fila: prioriza gargalos, SLA, origem e responsavel sugerido.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#admin-fila-acao">Ver fila guiada</a>
        </div>
        <div class="bf-admin-next-actions__grid">
          ${actions.map((item, index) => `
            <article class="bf-admin-next-action bf-admin-next-action--${escapeHtml(item.tone)}" data-admin-next-action="${escapeHtml(index + 1)}">
              <span>${escapeHtml(item.source)}</span>
              <strong>${escapeHtml(item.title)}</strong>
              <p>${escapeHtml(item.reason)}</p>
              <small>${escapeHtml(item.meta)}</small>
              <a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">Abrir acao</a>
            </article>
          `).join('')}
        </div>
      </section>
    `;
  }

  function renderAdminActionQueue(sourceRows, bottlenecks) {
    const queue = buildAdminActionQueue(sourceRows, bottlenecks);
    const executionSummary = buildAdminActionExecutionSummary(queue);
    const ownerHistory = executionSummary.owners.map((item) => `
      <article>
        <span>${escapeHtml(item.owner)}</span>
        <strong>${escapeHtml(item.total)}</strong>
        <small>${escapeHtml(item.running)} em execucao - ${escapeHtml(item.delayed)} adiadas - ${escapeHtml(item.done)} concluidas</small>
      </article>
    `).join('');
    return `
      <section class="bf-admin-action-queue" id="admin-fila-acao" data-admin-action-queue>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--navy">Fila guiada</span>
            <h3>Quem faz o que, ate quando</h3>
            <p>Converte gargalos e sinais por origem em uma fila executavel, com status, motivo, adiamento e historico por responsavel.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#admin-gargalos">Ver gargalos</a>
        </div>
        <div class="bf-admin-action-summary" data-admin-action-owner-history>
          <div class="bf-platform-metrics">
            ${window.BFCards.metric('Pendentes', executionSummary.pending || 0, executionSummary.pending ? 'is-warn' : '')}
            ${window.BFCards.metric('Em execucao', executionSummary.running || 0, executionSummary.running ? 'is-strong' : '')}
            ${window.BFCards.metric('Adiadas', executionSummary.delayed || 0, executionSummary.delayed ? 'is-warn' : '')}
            ${window.BFCards.metric('Concluidas', executionSummary.done || 0)}
          </div>
          <div class="bf-admin-action-owners">
            ${ownerHistory || '<article><span>Sem responsavel</span><strong>0</strong><small>A fila ainda nao tem acoes abertas.</small></article>'}
          </div>
        </div>
        <div class="bf-admin-action-queue__list">
          ${queue.map((item) => {
            const execution = item.execution || { status: 'pendente', statusLabel: 'Pendente', reason: '' };
            const history = adminActionHistory(item).map((event) => `
              <small>${escapeHtml(event.status || event.action || 'acao')} - ${escapeHtml(formatDate(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
            `).join('');
            return `
            <article class="bf-admin-action-item bf-admin-action-item--${escapeHtml(item.tone)} bf-admin-action-item--status-${escapeHtml(adminActionStatusClass(execution.status))}" data-admin-action-item="${escapeHtml(item.type)}" data-admin-action-execution="${escapeHtml(item.actionKey)}" data-admin-action-title="${escapeHtml(item.title)}" data-admin-action-owner="${escapeHtml(item.owner)}" data-admin-action-target="${escapeHtml(item.target)}" data-admin-action-href="${escapeHtml(item.href)}">
              <div class="bf-admin-action-item__rank">
                <span>#${escapeHtml(item.rank)}</span>
                <strong>${escapeHtml(item.deadline)}</strong>
              </div>
              <div class="bf-admin-action-item__body">
                <span>${escapeHtml(item.source)}</span>
                <h4>${escapeHtml(item.title)}</h4>
                <p>${escapeHtml(item.reason)}</p>
                <dl>
                  <div><dt>Dono</dt><dd>${escapeHtml(item.owner)}</dd></div>
                  <div><dt>Alvo</dt><dd>${escapeHtml(item.target)}</dd></div>
                  <div><dt>Status</dt><dd>${escapeHtml(execution.statusLabel || 'Pendente')}</dd></div>
                </dl>
                <label class="bf-admin-action-reason">Motivo ou observacao
                  <input data-admin-action-reason value="${escapeHtml(execution.reason || '')}" placeholder="Ex.: cliente pediu retorno amanha">
                </label>
                <div class="bf-admin-action-history" data-admin-action-history>
                  ${history || '<small>Nenhuma execucao registrada ainda.</small>'}
                </div>
              </div>
              <div class="bf-admin-action-item__commands">
                <a class="btn btn--ghost btn--sm" href="${escapeHtml(item.href)}">${escapeHtml(item.cta)}</a>
                <button class="btn btn--ghost btn--sm" type="button" data-admin-action-status="em_execucao">Iniciar</button>
                <button class="btn btn--ghost btn--sm" type="button" data-admin-action-status="adiada">Adiar</button>
                <button class="btn btn--primary btn--sm" type="button" data-admin-action-status="concluida">Concluir</button>
                ${execution.status === 'concluida' ? '<button class="btn btn--ghost btn--sm" type="button" data-admin-action-status="pendente">Reabrir</button>' : ''}
              </div>
            </article>
          `;
          }).join('')}
        </div>
      </section>
    `;
  }

  function renderAdminConsultantProductivity(sourceRows, bottlenecks) {
    const rows = buildAdminConsultantProductivity(sourceRows, bottlenecks);
    const totals = rows.reduce((acc, item) => {
      acc.open += Number(item.open || 0);
      acc.running += Number(item.running || 0);
      acc.delayed += Number(item.delayed || 0);
      acc.completed += Number(item.completed || 0);
      if (item.avgHours !== null && item.avgHours !== undefined && Number.isFinite(Number(item.avgHours))) acc.durations.push(Number(item.avgHours));
      return acc;
    }, { open: 0, running: 0, delayed: 0, completed: 0, durations: [] });
    const avg = totals.durations.length
      ? totals.durations.reduce((sum, item) => sum + item, 0) / totals.durations.length
      : null;

    return `
      <section class="bf-admin-consultant-productivity" id="admin-produtividade-consultor" data-admin-consultant-productivity>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--ok">Produtividade</span>
            <h3>Execucao por consultor</h3>
            <p>Mostra acoes abertas, adiadas, concluidas, tempo medio e gargalos recorrentes a partir da fila guiada local.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#admin-fila-acao">Ver fila</a>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Abertas', totals.open || 0, totals.open ? 'is-warn' : '')}
          ${window.BFCards.metric('Em execucao', totals.running || 0, totals.running ? 'is-strong' : '')}
          ${window.BFCards.metric('Adiadas', totals.delayed || 0, totals.delayed ? 'is-warn' : '')}
          ${window.BFCards.metric('Concluidas', totals.completed || 0)}
          ${window.BFCards.metric('Tempo medio', durationLabel(avg))}
        </div>
        <div class="bf-admin-consultant-productivity__grid">
          ${rows.length ? rows.map((item) => `
            <article class="bf-admin-consultant-card bf-admin-consultant-card--${escapeHtml(item.tone)}" data-admin-consultant-productivity-row="${escapeHtml(item.owner)}">
              <div class="bf-admin-consultant-card__top">
                <span>${escapeHtml(item.owner)}</span>
                <strong>${escapeHtml(item.completionRate)}%</strong>
              </div>
              <div class="bf-admin-funnel-bar"><i style="width:${escapeHtml(Math.max(4, item.completionRate || 0))}%"></i></div>
              <dl>
                <div><dt>Abertas</dt><dd>${escapeHtml(item.open)}</dd></div>
                <div><dt>Adiadas</dt><dd>${escapeHtml(item.delayed)}</dd></div>
                <div><dt>Concluidas</dt><dd>${escapeHtml(item.completed)}</dd></div>
                <div><dt>Tempo medio</dt><dd>${escapeHtml(item.avgLabel)}</dd></div>
              </dl>
              <p>Gargalos recorrentes: ${escapeHtml(item.recurrent.join(' | ') || 'sem recorrencia local')}</p>
              <small>${escapeHtml(item.recentLabel || 'Sem historico')}</small>
            </article>
          `).join('') : '<div class="bf-empty-state">A produtividade aparecera quando a fila guiada tiver execucoes locais.</div>'}
        </div>
      </section>
    `;
  }

  function portfolioOwnerName(item, plan, state) {
    return item.assignedTo || (plan && plan.owner) || (state && state.suggestedAssignee) || item.ownerEmail || 'definir responsavel';
  }

  function portfolioLeadHref(item, plan) {
    return (plan && plan.href) || `handoff-consultivo.html?from=admin&handoffId=${encodeURIComponent(item.id || '')}#detalhe-handoff`;
  }

  function buildAdminConsultantPortfolio(sourceRows, bottlenecks) {
    const service = window.BFHandoffConsultivoService;
    const now = new Date();
    const productivity = new Map(buildAdminConsultantProductivity(sourceRows, bottlenecks).map((item) => [item.owner, item]));
    const byOwner = new Map();

    function ensure(owner) {
      const key = owner || 'definir responsavel';
      if (!byOwner.has(key)) {
        byOwner.set(key, {
          owner: key,
          leads: 0,
          high: 0,
          overdue: 0,
          unassigned: 0,
          totalHours: 0,
          sources: new Map(),
          nextSteps: new Map(),
          items: []
        });
      }
      return byOwner.get(key);
    }

    if (service && typeof service.enrichList === 'function') {
      service.enrichList(service.list ? service.list() : [], now)
        .filter((item) => isOpenHandoff(item))
        .forEach((item) => {
          const state = item.operational || {};
          const plan = service.actionPlan ? service.actionPlan(item, now) : null;
          const owner = portfolioOwnerName(item, plan, state);
          const row = ensure(owner);
          const source = service.sourceLabel ? service.sourceLabel(item) : (item.sourceLabel || item.sourceType || 'Origem local');
          const nextStep = (plan && plan.title) || state.nextStep || 'Acompanhar lead';
          const tone = state.tone || (state.slaOverdue ? 'alta' : item.priority === 'alta' ? 'media' : 'baixa');
          row.leads += 1;
          if (item.priority === 'alta') row.high += 1;
          if (state.slaOverdue) row.overdue += 1;
          if (state.unassigned || !item.assignedTo) row.unassigned += 1;
          row.totalHours += Number(state.hours || 0);
          row.sources.set(source, (row.sources.get(source) || 0) + 1);
          row.nextSteps.set(nextStep, (row.nextSteps.get(nextStep) || 0) + 1);
          row.items.push({
            id: item.id || '',
            title: item.objectiveLabel || (item.summary && item.summary.objectiveLabel) || item.id || 'Lead consultivo',
            source,
            priority: service.priorityLabels && service.priorityLabels[item.priority] ? service.priorityLabels[item.priority] : (item.priority || 'Media'),
            status: service.statusLabels && service.statusLabels[item.status] ? service.statusLabels[item.status] : (item.status || 'Novo'),
            age: state.ageLabel || eventAgeLabel(state.hours),
            hours: Number(state.hours || 0),
            nextStep,
            href: portfolioLeadHref(item, plan),
            tone,
            overdue: !!state.slaOverdue,
            unassigned: !!state.unassigned || !item.assignedTo
          });
        });
    }

    if (!byOwner.size) {
      (bottlenecks || []).slice(0, 6).forEach((item) => {
        const owner = item.actionOwner || item.ownerEmail || 'coordenacao local';
        const row = ensure(owner);
        row.leads += 1;
        if (item.severity === 'alta') row.high += 1;
        if (String(item.type || '').includes('overdue')) row.overdue += 1;
        row.totalHours += Number(item.hours || 0);
        row.sources.set(item.title || 'Sinal operacional', (row.sources.get(item.title || 'Sinal operacional') || 0) + 1);
        row.nextSteps.set(item.next || 'Abrir acao', (row.nextSteps.get(item.next || 'Abrir acao') || 0) + 1);
        row.items.push({
          id: item.targetId || item.proposalId || item.type || '',
          title: item.reason || item.title || 'Sinal operacional',
          source: item.title || 'Gargalo',
          priority: alertSeverityLabel(item.severity),
          status: 'Sinal',
          age: item.age || eventAgeLabel(item.hours),
          hours: Number(item.hours || 0),
          nextStep: item.next || 'Abrir acao',
          href: item.href || '#admin-gargalos',
          tone: item.severity || 'media',
          overdue: String(item.type || '').includes('overdue'),
          unassigned: String(item.type || '').includes('without-assignee')
        });
      });
    }

    return Array.from(byOwner.values()).map((row) => {
      const avgHours = row.leads ? row.totalHours / row.leads : 0;
      const sourceMix = Array.from(row.sources.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 3)
        .map(([label, total]) => `${label} (${total})`);
      const nextSteps = Array.from(row.nextSteps.entries())
        .sort((a, b) => b[1] - a[1])
        .slice(0, 2)
        .map(([label]) => label);
      const prod = productivity.get(row.owner) || { completed: 0, delayed: 0, running: 0 };
      const tone = row.overdue ? 'alta' : row.high || row.unassigned ? 'media' : 'baixa';
      return {
        ...row,
        avgHours,
        avgAge: eventAgeLabel(avgHours),
        sourceMix,
        nextSteps,
        completed: prod.completed || 0,
        delayed: prod.delayed || 0,
        running: prod.running || 0,
        tone,
        items: row.items
          .sort((a, b) => (alertWeight(b.tone) - alertWeight(a.tone)) || (Number(b.hours || 0) - Number(a.hours || 0)))
          .slice(0, 3)
      };
    }).sort((a, b) => {
      const score = (row) => (row.overdue * 5) + (row.high * 4) + (row.unassigned * 3) + row.leads + Math.min(row.avgHours / 24, 5);
      return score(b) - score(a);
    }).slice(0, 6);
  }

  function renderAdminConsultantPortfolio(sourceRows, bottlenecks) {
    const allRows = buildAdminConsultantPortfolio(sourceRows, bottlenecks);
    const filters = adminPortfolioFilters(qs('[data-admin-journey-funnel]') || document);
    const rows = filterAdminConsultantPortfolio(allRows, filters);
    const totals = rows.reduce((acc, item) => {
      acc.leads += Number(item.leads || 0);
      acc.high += Number(item.high || 0);
      acc.overdue += Number(item.overdue || 0);
      acc.unassigned += Number(item.unassigned || 0);
      acc.hours += Number(item.avgHours || 0) * Number(item.leads || 0);
      return acc;
    }, { leads: 0, high: 0, overdue: 0, unassigned: 0, hours: 0 });
    const avg = totals.leads ? totals.hours / totals.leads : 0;

    return `
      <section class="bf-admin-consultant-portfolio" id="admin-carteira-consultor" data-admin-consultant-portfolio>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Carteira</span>
            <h3>Carteira por consultor</h3>
            <p>Cruza leads abertos com aging, origem, prioridade e proximo passo para orientar a gestao diaria.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#fila-handoff">Abrir handoffs</a>
        </div>
        ${renderAdminPortfolioFilterControls(allRows, filters)}
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Leads abertos', totals.leads || 0, totals.leads ? 'is-strong' : '')}
          ${window.BFCards.metric('Alta prioridade', totals.high || 0, totals.high ? 'is-warn' : '')}
          ${window.BFCards.metric('SLA vencido', totals.overdue || 0, totals.overdue ? 'is-warn' : '')}
          ${window.BFCards.metric('Sem responsavel', totals.unassigned || 0, totals.unassigned ? 'is-warn' : '')}
          ${window.BFCards.metric('Aging medio', totals.leads ? eventAgeLabel(avg) : 'sem carteira')}
        </div>
        ${renderAdminPortfolioPriorityActions(rows)}
        <div class="bf-admin-consultant-portfolio__grid">
          ${rows.length ? rows.map((item) => `
            <article class="bf-admin-portfolio-card bf-admin-portfolio-card--${escapeHtml(item.tone)}" data-admin-consultant-portfolio-row="${escapeHtml(item.owner)}">
              <div class="bf-admin-portfolio-card__top">
                <span>${escapeHtml(item.owner)}</span>
                <strong>${escapeHtml(item.leads)} ${item.leads === 1 ? 'lead' : 'leads'}</strong>
              </div>
              <dl>
                <div><dt>Alta</dt><dd>${escapeHtml(item.high)}</dd></div>
                <div><dt>SLA</dt><dd>${escapeHtml(item.overdue)}</dd></div>
                <div><dt>Aging</dt><dd>${escapeHtml(item.avgAge)}</dd></div>
                <div><dt>Feitas</dt><dd>${escapeHtml(item.completed)}</dd></div>
              </dl>
              <p>Origem: ${escapeHtml(item.sourceMix.join(' | ') || 'sem origem local')}</p>
              <small>Proximo foco: ${escapeHtml(item.nextSteps.join(' | ') || 'monitorar carteira')}</small>
              <div class="bf-admin-portfolio-card__leads">
                ${item.items.map((lead) => `
                  <a class="bf-admin-portfolio-lead bf-admin-portfolio-lead--${escapeHtml(lead.tone)}" href="${escapeHtml(lead.href)}" data-admin-consultant-portfolio-lead="${escapeHtml(lead.id)}">
                    <span>${escapeHtml(lead.source)} - ${escapeHtml(lead.priority)} - ${escapeHtml(lead.age)}</span>
                    <strong>${escapeHtml(lead.title)}</strong>
                    <small>${escapeHtml(lead.status)} - ${escapeHtml(lead.nextStep)}</small>
                  </a>
                `).join('')}
              </div>
            </article>
          `).join('') : '<div class="bf-empty-state">A carteira aparecera quando houver handoffs ou gargalos operacionais locais.</div>'}
        </div>
      </section>
    `;
  }

  function operationalAlerts() {
    return buildJourneyAbandonmentAlerts()
      .concat(buildHandoffSlaAlerts())
      .sort((a, b) => {
        const bySeverity = alertWeight(b.severity) - alertWeight(a.severity);
        if (bySeverity) return bySeverity;
        return Number(b.hours || 0) - Number(a.hours || 0);
      });
  }

  function selectedAttr(current, value) {
    return String(current || '') === String(value || '') ? ' selected' : '';
  }

  function adminPortfolioFilters(root = document) {
    const find = (selector) => root.querySelector ? root.querySelector(selector) : qs(selector);
    return {
      owner: find('[data-admin-portfolio-filter="owner"]')?.value || '',
      source: find('[data-admin-portfolio-filter="source"]')?.value || '',
      priority: find('[data-admin-portfolio-filter="priority"]')?.value || '',
      sla: find('[data-admin-portfolio-filter="sla"]')?.value || '',
      search: find('[data-admin-portfolio-filter="search"]')?.value || ''
    };
  }

  function normalizePortfolioText(value) {
    return String(value || '').trim().toLowerCase();
  }

  function portfolioOptionValues(rows, getter) {
    const values = new Set();
    (rows || []).forEach((row) => (row.items || []).forEach((item) => {
      const value = getter(row, item);
      if (value) values.add(value);
    }));
    return Array.from(values).sort((a, b) => String(a).localeCompare(String(b)));
  }

  function renderAdminPortfolioFilterControls(rows, filters) {
    const owners = (rows || []).map((item) => item.owner).filter(Boolean);
    const sources = portfolioOptionValues(rows, (_row, item) => item.source);
    const priorities = [['alta', 'Alta'], ['media', 'Media'], ['baixa', 'Baixa']];
    const slaOptions = [['vencido', 'SLA vencido'], ['no-prazo', 'No prazo']];
    return `
      <div class="bf-admin-toolbar bf-admin-portfolio-toolbar" data-admin-consultant-portfolio-filters>
        <label>Busca
          <input type="search" value="${escapeHtml(filters.search)}" data-admin-portfolio-filter="search" placeholder="Lead, origem, status ou proximo passo">
        </label>
        <label>Consultor
          <select data-admin-portfolio-filter="owner">
            <option value="">Todos</option>
            ${owners.map((owner) => `<option value="${escapeHtml(owner)}"${selectedAttr(filters.owner, owner)}>${escapeHtml(owner)}</option>`).join('')}
          </select>
        </label>
        <label>Origem
          <select data-admin-portfolio-filter="source">
            <option value="">Todas</option>
            ${sources.map((source) => `<option value="${escapeHtml(source)}"${selectedAttr(filters.source, source)}>${escapeHtml(source)}</option>`).join('')}
          </select>
        </label>
        <label>Prioridade
          <select data-admin-portfolio-filter="priority">
            <option value="">Todas</option>
            ${priorities.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.priority, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <label>SLA
          <select data-admin-portfolio-filter="sla">
            <option value="">Todos</option>
            ${slaOptions.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.sla, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn--ghost btn--sm" type="button" data-admin-consultant-portfolio-export>Exportar carteira</button>
      </div>
    `;
  }

  function summarizePortfolioRow(row, items) {
    const sourceMap = new Map();
    const nextMap = new Map();
    const totalHours = (items || []).reduce((sum, item) => {
      if (item.source) sourceMap.set(item.source, (sourceMap.get(item.source) || 0) + 1);
      if (item.nextStep) nextMap.set(item.nextStep, (nextMap.get(item.nextStep) || 0) + 1);
      return sum + Number(item.hours || 0);
    }, 0);
    const leads = items.length;
    const avgHours = leads ? totalHours / leads : 0;
    return {
      ...row,
      leads,
      high: items.filter((item) => item.tone === 'alta' || normalizePortfolioText(item.priority).includes('alta')).length,
      overdue: items.filter((item) => item.overdue).length,
      unassigned: items.filter((item) => item.unassigned).length,
      totalHours,
      avgHours,
      avgAge: leads ? eventAgeLabel(avgHours) : 'sem carteira',
      sourceMix: Array.from(sourceMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 3).map(([label, total]) => `${label} (${total})`),
      nextSteps: Array.from(nextMap.entries()).sort((a, b) => b[1] - a[1]).slice(0, 2).map(([label]) => label),
      items
    };
  }

  function filterAdminConsultantPortfolio(rows, filters) {
    const search = normalizePortfolioText(filters.search);
    return (rows || []).map((row) => {
      if (filters.owner && row.owner !== filters.owner) return null;
      const items = (row.items || []).filter((item) => {
        if (filters.source && item.source !== filters.source) return false;
        if (filters.priority && item.tone !== filters.priority && !normalizePortfolioText(item.priority).includes(filters.priority)) return false;
        if (filters.sla === 'vencido' && !item.overdue) return false;
        if (filters.sla === 'no-prazo' && item.overdue) return false;
        if (search) {
          const haystack = [
            row.owner,
            item.id,
            item.title,
            item.source,
            item.priority,
            item.status,
            item.nextStep
          ].join(' ').toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      });
      return items.length ? summarizePortfolioRow(row, items) : null;
    }).filter(Boolean);
  }

  function buildAdminPortfolioPriorityActions(rows) {
    return (rows || []).flatMap((row) => (row.items || []).map((item) => ({ ...item, owner: row.owner })))
      .sort((a, b) => {
        const score = (item) => (item.overdue ? 500 : 0) + (alertWeight(item.tone) * 100) + Math.min(Number(item.hours || 0), 240);
        return score(b) - score(a);
      })
      .slice(0, 5);
  }

  function renderAdminPortfolioPriorityActions(rows) {
    const actions = buildAdminPortfolioPriorityActions(rows);
    return `
      <div class="bf-admin-portfolio-priority" data-admin-consultant-portfolio-priority>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--navy">Prioridade comercial</span>
            <h4>Plano comercial do dia</h4>
          </div>
        </div>
        <div class="bf-admin-portfolio-priority__grid">
          ${actions.length ? actions.map((item) => `
            <a class="bf-admin-portfolio-priority-item bf-admin-portfolio-priority-item--${escapeHtml(item.tone)}" href="${escapeHtml(item.href)}" data-admin-consultant-portfolio-priority-lead="${escapeHtml(item.id)}">
              <span>${escapeHtml(item.owner)} - ${escapeHtml(item.source)} - ${escapeHtml(item.age)}</span>
              <strong>${escapeHtml(item.nextStep)}</strong>
              <small>${escapeHtml(item.title)}</small>
            </a>
          `).join('') : '<div class="bf-empty-state">Nenhuma acao comercial encontrada para os filtros atuais.</div>'}
        </div>
      </div>
    `;
  }

  function sanitizeAdminPortfolioExportValue(value) {
    return String(value === null || value === undefined ? '' : value)
      .replace(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi, '[email]')
      .replace(/\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/g, '[cpf]')
      .replace(/\(?\d{2}\)?\s?\d{4,5}-\d{4}\b/g, '[telefone]');
  }

  function sanitizeAdminPortfolioExport(value) {
    if (Array.isArray(value)) return value.map((item) => sanitizeAdminPortfolioExport(item));
    if (value && typeof value === 'object') {
      return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, sanitizeAdminPortfolioExport(item)]));
    }
    return typeof value === 'string' ? sanitizeAdminPortfolioExportValue(value) : value;
  }

  function buildAdminConsultantPortfolioExport(rows, filters) {
    const actions = buildAdminPortfolioPriorityActions(rows);
    const payload = {
      schema: 'bank-fratern.admin-consultant-portfolio.v1',
      exportedAt: new Date().toISOString(),
      filters,
      summary: {
        consultants: rows.length,
        leads: rows.reduce((sum, item) => sum + Number(item.leads || 0), 0),
        overdue: rows.reduce((sum, item) => sum + Number(item.overdue || 0), 0),
        high: rows.reduce((sum, item) => sum + Number(item.high || 0), 0),
        priorityActions: actions.length
      },
      priorityActions: actions.map((item) => ({
        id: item.id,
        owner: item.owner,
        source: item.source,
        priority: item.priority,
        status: item.status,
        age: item.age,
        nextStep: item.nextStep,
        href: item.href,
        tone: item.tone,
        overdue: !!item.overdue
      })),
      consultants: rows.map((row) => ({
        owner: row.owner,
        leads: row.leads,
        high: row.high,
        overdue: row.overdue,
        unassigned: row.unassigned,
        aging: row.avgAge,
        completed: row.completed,
        sources: row.sourceMix,
        nextSteps: row.nextSteps,
        items: row.items.map((item) => ({
          id: item.id,
          title: item.title,
          source: item.source,
          priority: item.priority,
          status: item.status,
          age: item.age,
          nextStep: item.nextStep,
          href: item.href,
          tone: item.tone,
          overdue: !!item.overdue
        }))
      }))
    };
    return sanitizeAdminPortfolioExport(payload);
  }

  function adminCommercialAliasFactory(prefix) {
    const aliases = new Map();
    return (value) => {
      const key = String(value || '').trim() || 'local';
      if (!aliases.has(key)) aliases.set(key, `${prefix}-${String(aliases.size + 1).padStart(3, '0')}`);
      return aliases.get(key);
    };
  }

  function adminCommercialStageDefinitions() {
    return [
      { key: 'contato', label: 'Contato', status: 'novo', next: 'Iniciar atendimento' },
      { key: 'proposta', label: 'Proposta', status: 'em_atendimento', next: 'Revisar proposta' },
      { key: 'followup', label: 'Follow-up', status: 'aguardando_cliente', next: 'Retomar cliente' },
      { key: 'negociacao', label: 'Negociacao', status: 'em_atendimento', next: 'Avancar negociacao' },
      { key: 'fechamento', label: 'Fechamento', status: 'qualificado', next: 'Registrar decisao' }
    ];
  }

  function adminCommercialStageMap() {
    return new Map(adminCommercialStageDefinitions().map((stage) => [stage.key, stage]));
  }

  function adminCommercialStageLabel(key) {
    const stage = adminCommercialStageMap().get(String(key || ''));
    return stage ? stage.label : 'Contato';
  }

  function adminCommercialStageStatus(key) {
    const stage = adminCommercialStageMap().get(String(key || ''));
    return stage ? stage.status : 'novo';
  }

  function adminCommercialStageStates() {
    const states = readAdminJson(ADMIN_COMMERCIAL_STAGE_STATE_KEY, {});
    return states && typeof states === 'object' && !Array.isArray(states) ? states : {};
  }

  function writeAdminCommercialStageStates(states) {
    return writeAdminJson(ADMIN_COMMERCIAL_STAGE_STATE_KEY, states && typeof states === 'object' ? states : {});
  }

  function adminCommercialStageAudit() {
    const audit = readAdminJson(ADMIN_COMMERCIAL_STAGE_AUDIT_KEY, []);
    return Array.isArray(audit) ? audit.filter(Boolean) : [];
  }

  function currentAdminActor() {
    try {
      const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
      return {
        email: user && user.email ? user.email : 'admin.local@bankfratern.local',
        name: user && user.name ? user.name : 'Admin local',
        role: user && user.role ? user.role : 'admin'
      };
    } catch (error) {
      return { email: 'admin.local@bankfratern.local', name: 'Admin local', role: 'admin' };
    }
  }

  function publishBackendEvent(type, payload, meta = {}) {
    const api = window.BFBackendApi;
    if (!api || typeof api.recordEvent !== 'function') return;
    api.recordEvent(type, payload, meta).catch(() => {});
  }

  function recordAdminCommercialStageChange(handoff, fromStage, toStage) {
    const actor = currentAdminActor();
    const event = {
      id: `CST-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      handoffId: handoff && handoff.id ? handoff.id : '',
      fromStage: fromStage || '',
      fromLabel: fromStage ? adminCommercialStageLabel(fromStage) : '',
      toStage,
      toLabel: adminCommercialStageLabel(toStage),
      status: adminCommercialStageStatus(toStage),
      actorEmail: actor.email,
      actorRole: actor.role,
      createdAt: new Date().toISOString()
    };
    writeAdminJson(ADMIN_COMMERCIAL_STAGE_AUDIT_KEY, [event].concat(adminCommercialStageAudit()).slice(0, ADMIN_COMMERCIAL_STAGE_AUDIT_LIMIT));
    publishBackendEvent('commercial-stage:changed', event, {
      source: 'admin-commercial-stage',
      actorEmail: event.actorEmail,
      entityType: 'handoff',
      entityId: event.handoffId,
      createdAt: event.createdAt
    });
    return event;
  }

  function setAdminCommercialStage(handoffId, stageKey) {
    const service = window.BFHandoffConsultivoService;
    const normalizedStage = adminCommercialStageMap().has(String(stageKey || '')) ? String(stageKey || '') : 'contato';
    const handoff = service && service.find ? service.find(String(handoffId || '')) : null;
    if (!handoff || !handoff.id) return null;

    const states = adminCommercialStageStates();
    const previousStage = states[handoff.id] && states[handoff.id].stage
      ? states[handoff.id].stage
      : adminCommercialStageFor(handoff, handoff.operational || {}, service.actionPlan ? service.actionPlan(handoff, new Date()) : null, service);
    const status = adminCommercialStageStatus(normalizedStage);
    const updated = service && service.setStatus ? service.setStatus(handoff.id, status) : handoff;
    const actor = currentAdminActor();
    const state = {
      handoffId: handoff.id,
      stage: normalizedStage,
      stageLabel: adminCommercialStageLabel(normalizedStage),
      status,
      updatedAt: new Date().toISOString(),
      updatedBy: actor.email
    };
    states[handoff.id] = state;
    writeAdminCommercialStageStates(states);
    recordAdminCommercialStageChange(updated || handoff, previousStage, normalizedStage);
    return { ...(updated || handoff), commercialStage: state };
  }

  function adminCommercialStageHistoryLabel(handoffId) {
    const event = adminCommercialStageAudit().find((item) => item && item.handoffId === handoffId);
    if (!event) return 'Etapa definida automaticamente pela jornada.';
    return `Movido para ${event.toLabel || adminCommercialStageLabel(event.toStage)} em ${formatDate(event.createdAt)}.`;
  }

  function adminCommercialStageOptions(activeKey) {
    return adminCommercialStageDefinitions().map((stage) => `
      <option value="${escapeHtml(stage.key)}"${selectedAttr(activeKey, stage.key)}>${escapeHtml(stage.label)}</option>
    `).join('');
  }

  function adminCommercialStageDeadlineHours(stageKey) {
    const deadlines = {
      contato: 24,
      proposta: 48,
      followup: 72,
      negociacao: 72,
      fechamento: 120
    };
    return deadlines[stageKey] || 48;
  }

  function adminCommercialStageTone(stageKey, hours, overdue) {
    if (overdue) return 'alta';
    const deadline = adminCommercialStageDeadlineHours(stageKey);
    if (Number(hours || 0) >= deadline) return 'alta';
    if (Number(hours || 0) >= Math.max(12, deadline * 0.6)) return 'media';
    return 'baixa';
  }

  function buildAdminCommercialStageInsights(pipeline) {
    const source = pipeline || buildAdminCommercialPipeline();
    const leads = Array.isArray(source.allLeads) ? source.allLeads : [];
    const audit = adminCommercialStageAudit();
    const recentMoves = audit.slice(0, 6).map((event) => ({
      id: event.id || `${event.handoffId || 'lead'}-${event.createdAt || ''}`,
      handoffId: event.handoffId || '',
      fromLabel: event.fromLabel || (event.fromStage ? adminCommercialStageLabel(event.fromStage) : 'Entrada'),
      toLabel: event.toLabel || adminCommercialStageLabel(event.toStage),
      actorEmail: event.actorEmail || 'admin local',
      createdAt: event.createdAt || '',
      age: eventAgeLabel(eventHoursSince(event.createdAt))
    }));
    const moved24h = audit.filter((event) => eventHoursSince(event.createdAt) <= 24).length;
    const moved7d = audit.filter((event) => eventHoursSince(event.createdAt) <= 168).length;
    const stuck = leads
      .filter((lead) => lead.stageKey !== 'fechamento' && Number(lead.stageAgeHours || 0) >= adminCommercialStageDeadlineHours(lead.stageKey))
      .sort((a, b) => Number(b.stageAgeHours || 0) - Number(a.stageAgeHours || 0))
      .slice(0, 5);
    const stageSummary = adminCommercialStageDefinitions().map((stage) => {
      const stageLeads = leads.filter((lead) => lead.stageKey === stage.key);
      const avgHours = stageLeads.length ? stageLeads.reduce((sum, lead) => sum + Number(lead.stageAgeHours || 0), 0) / stageLeads.length : 0;
      const blocked = stageLeads.filter((lead) => Number(lead.stageAgeHours || 0) >= adminCommercialStageDeadlineHours(stage.key)).length;
      return {
        ...stage,
        leads: stageLeads.length,
        movedIn: audit.filter((event) => event.toStage === stage.key).length,
        movedOut: audit.filter((event) => event.fromStage === stage.key).length,
        avgHours,
        blocked,
        tone: blocked ? 'alta' : (stageLeads.length ? 'media' : 'baixa')
      };
    });
    const avgStageHours = leads.length ? leads.reduce((sum, lead) => sum + Number(lead.stageAgeHours || 0), 0) / leads.length : 0;
    const nextStuck = stuck[0] || null;
    return {
      moved24h,
      moved7d,
      avgStageHours,
      stuck,
      recentMoves,
      stageSummary,
      nextStuck
    };
  }

  function renderAdminCommercialStageInsights(pipeline) {
    const insights = buildAdminCommercialStageInsights(pipeline);
    const movementRows = insights.recentMoves.length ? insights.recentMoves.map((event) => `
      <article class="bf-admin-commercial-movement" data-admin-commercial-stage-movement="${escapeHtml(event.id)}">
        <span>${escapeHtml(event.fromLabel)} -> ${escapeHtml(event.toLabel)}</span>
        <strong>${escapeHtml(event.handoffId || 'Lead local')}</strong>
        <small>${escapeHtml(event.age)} - ${escapeHtml(event.actorEmail)}</small>
      </article>
    `).join('') : '<div class="bf-empty-state">As movimentacoes do funil aparecerao aqui quando um lead trocar de etapa.</div>';
    const stuckRows = insights.stuck.length ? insights.stuck.map((lead) => `
      <article class="bf-admin-commercial-stuck bf-admin-commercial-stuck--${escapeHtml(adminCommercialStageTone(lead.stageKey, lead.stageAgeHours, lead.overdue))}" data-admin-commercial-stage-stuck-lead="${escapeHtml(lead.id)}">
        <span>${escapeHtml(lead.stageLabel)} - ${escapeHtml(lead.source)} - ${escapeHtml(lead.priority)}</span>
        <strong>${escapeHtml(lead.title)}</strong>
        <small>${escapeHtml(eventAgeLabel(lead.stageAgeHours))} sem evolucao de etapa - ${escapeHtml(lead.nextStep)}</small>
        <a class="btn btn--ghost btn--sm" href="${escapeHtml(lead.href)}">Retomar lead</a>
      </article>
    `).join('') : '<div class="bf-empty-state">Nenhum lead ultrapassou o prazo de cadencia da etapa.</div>';
    const stageRows = insights.stageSummary.map((stage) => `
      <div class="bf-admin-commercial-stage-summary bf-admin-commercial-stage-summary--${escapeHtml(stage.tone)}" data-admin-commercial-stage-summary="${escapeHtml(stage.key)}">
        <span>${escapeHtml(stage.label)}</span>
        <strong>${escapeHtml(stage.leads)}</strong>
        <small>${escapeHtml(stage.movedIn)} entradas - ${escapeHtml(stage.movedOut)} saidas - ${escapeHtml(stage.leads ? eventAgeLabel(stage.avgHours) : 'sem lead')}</small>
      </div>
    `).join('');
    return `
      <section class="bf-admin-commercial-insights" data-admin-commercial-stage-insights>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Cadencia comercial</span>
            <h3>Movimentacao e leads parados</h3>
            <p>Usa o historico local do funil para mostrar velocidade, gargalos por etapa e proximas retomadas comerciais.</p>
          </div>
          <a class="btn btn--ghost btn--sm" href="#admin-carteira-consultor">Ver carteira</a>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Movidos 24h', insights.moved24h || 0, insights.moved24h ? 'is-strong' : '')}
          ${window.BFCards.metric('Movidos 7d', insights.moved7d || 0)}
          ${window.BFCards.metric('Leads parados', insights.stuck.length || 0, insights.stuck.length ? 'is-warn' : '')}
          ${window.BFCards.metric('Aging de etapa', insights.avgStageHours ? eventAgeLabel(insights.avgStageHours) : 'sem base')}
        </div>
        <div class="bf-admin-commercial-insights__grid">
          <section>
            <span class="bf-badge bf-badge--navy">Resumo por etapa</span>
            <div class="bf-admin-commercial-stage-summary-list">${stageRows}</div>
          </section>
          <section>
            <span class="bf-badge bf-badge--warn">Retomadas sugeridas</span>
            <div class="bf-admin-commercial-stage-stuck-list">${stuckRows}</div>
          </section>
          <section>
            <span class="bf-badge bf-badge--ok">Movimentacoes recentes</span>
            <div class="bf-admin-commercial-stage-movement-list">${movementRows}</div>
          </section>
        </div>
      </section>
    `;
  }

  function adminCommercialStageFor(item, state, plan, service) {
    const savedStage = item && item.id ? adminCommercialStageStates()[item.id] : null;
    if (savedStage && savedStage.stage && adminCommercialStageMap().has(savedStage.stage)) return savedStage.stage;
    const source = service && service.sourceType ? service.sourceType(item) : (item && item.sourceType) || 'manual';
    const proposal = state && state.proposal ? state.proposal : {};
    const executionStatus = plan && plan.execution ? plan.execution.status : '';
    if (['qualificado', 'descartado'].includes(item.status)) return 'fechamento';
    if (item.status === 'aguardando_cliente' || state.waitingClient || executionStatus === 'adiada') return 'followup';
    if (source === 'proposal' || proposal.active) return 'proposta';
    if (item.status === 'em_atendimento' || executionStatus === 'em_execucao') return 'negociacao';
    return 'contato';
  }

  function buildAdminCommercialPipeline() {
    const service = window.BFHandoffConsultivoService;
    const definitions = adminCommercialStageDefinitions();
    const rows = definitions.map((stage) => ({ ...stage, leads: [], high: 0, overdue: 0, avgHours: 0, tone: 'baixa' }));
    const byStage = new Map(rows.map((stage) => [stage.key, stage]));
    const now = new Date();
    const allLeads = [];

    if (service && typeof service.enrichList === 'function') {
      service.enrichList(service.list ? service.list() : [], now).forEach((item) => {
        const state = item.operational || {};
        const plan = service.actionPlan ? service.actionPlan(item, now) : null;
        const key = adminCommercialStageFor(item, state, plan, service);
        const stage = byStage.get(key) || byStage.get('contato');
        const source = service.sourceLabel ? service.sourceLabel(item) : (item.sourceLabel || item.sourceType || 'Origem local');
        const statusLabel = service.statusLabels && service.statusLabels[item.status] ? service.statusLabels[item.status] : (item.status || 'Novo');
        const priorityLabel = service.priorityLabels && service.priorityLabels[item.priority] ? service.priorityLabels[item.priority] : (item.priority || 'Media');
        const tone = state.tone || (item.priority === 'alta' ? 'media' : 'baixa');
        const savedStage = item.id ? adminCommercialStageStates()[item.id] : null;
        const stageUpdatedAt = (savedStage && savedStage.updatedAt) || item.updatedAt || item.createdAt || '';
        const lead = {
          id: item.id || '',
          stageKey: stage.key,
          stageLabel: stage.label,
          title: item.objectiveLabel || (item.summary && item.summary.objectiveLabel) || item.id || 'Lead consultivo',
          owner: portfolioOwnerName(item, plan, state),
          source,
          status: statusLabel,
          priority: priorityLabel,
          age: state.ageLabel || eventAgeLabel(state.hours),
          hours: Number(state.hours || 0),
          nextStep: (plan && plan.title) || state.nextStep || stage.next,
          href: portfolioLeadHref(item, plan),
          tone,
          overdue: !!state.slaOverdue,
          stageUpdatedAt,
          stageAgeHours: eventHoursSince(stageUpdatedAt)
        };
        allLeads.push(lead);
        stage.leads.push(lead);
      });
    }

    const total = rows.reduce((sum, stage) => sum + stage.leads.length, 0);
    rows.forEach((stage) => {
      const hours = stage.leads.reduce((sum, item) => sum + Number(item.hours || 0), 0);
      stage.high = stage.leads.filter((item) => item.tone === 'alta' || normalizePortfolioText(item.priority).includes('alta')).length;
      stage.overdue = stage.leads.filter((item) => item.overdue).length;
      stage.avgHours = stage.leads.length ? hours / stage.leads.length : 0;
      stage.width = total ? Math.max(5, Math.round((stage.leads.length / total) * 100)) : 5;
      stage.tone = stage.overdue ? 'alta' : (stage.high ? 'media' : 'baixa');
      stage.totalLeads = stage.leads.length;
      stage.leads = stage.leads
        .sort((a, b) => (Number(b.overdue) - Number(a.overdue)) || (alertWeight(b.tone) - alertWeight(a.tone)) || (Number(b.hours || 0) - Number(a.hours || 0)))
        .slice(0, 4);
    });

    return {
      total,
      open: rows.slice(0, 4).reduce((sum, stage) => sum + Number(stage.totalLeads || stage.leads.length || 0), 0),
      closed: Number((byStage.get('fechamento') || {}).totalLeads || 0),
      high: rows.reduce((sum, stage) => sum + stage.high, 0),
      overdue: rows.reduce((sum, stage) => sum + stage.overdue, 0),
      allLeads,
      rows
    };
  }

  function buildAdminCommercialPipelineExport(pipeline) {
    const resolvedPipeline = pipeline || buildAdminCommercialPipeline();
    const insights = buildAdminCommercialStageInsights(resolvedPipeline);
    const leadAlias = adminCommercialAliasFactory('lead');
    const ownerAlias = adminCommercialAliasFactory('consultor');
    const allLeads = Array.isArray(resolvedPipeline.allLeads) ? resolvedPipeline.allLeads : [];
    const stageMetrics = new Map((resolvedPipeline.rows || []).map((stage) => [stage.key, stage]));

    allLeads.forEach((lead) => {
      leadAlias(lead.id || lead.href || lead.title);
      ownerAlias(lead.owner || 'sem responsavel');
    });

    const exportLead = (lead) => ({
      leadRef: leadAlias(lead.id || lead.href || lead.title),
      ownerRef: ownerAlias(lead.owner || 'sem responsavel'),
      source: lead.source || 'Origem local',
      status: lead.status || 'Novo',
      priority: lead.priority || 'Media',
      age: lead.age || eventAgeLabel(lead.hours),
      stageAge: eventAgeLabel(lead.stageAgeHours),
      nextStep: lead.nextStep || 'Definir proximo passo',
      tone: lead.tone || 'baixa',
      overdue: !!lead.overdue
    });

    const payload = {
      schema: 'bank-fratern.admin-commercial-pipeline.v1',
      exportedAt: new Date().toISOString(),
      privacy: {
        anonymized: true,
        excludes: ['actorEmail', 'clientName', 'cpf', 'email', 'handoffId', 'href', 'owner', 'phone', 'title']
      },
      summary: {
        leads: resolvedPipeline.total || 0,
        open: resolvedPipeline.open || 0,
        closed: resolvedPipeline.closed || 0,
        highPriority: resolvedPipeline.high || 0,
        overdue: resolvedPipeline.overdue || 0,
        stages: adminCommercialStageDefinitions().length,
        moved24h: insights.moved24h || 0,
        moved7d: insights.moved7d || 0,
        stuckLeads: insights.stuck.length || 0,
        avgStageAge: insights.avgStageHours ? eventAgeLabel(insights.avgStageHours) : 'sem base'
      },
      stages: insights.stageSummary.map((stage) => {
        const metrics = stageMetrics.get(stage.key) || {};
        return {
          key: stage.key,
          label: stage.label,
          leads: allLeads
            .filter((lead) => lead.stageKey === stage.key)
            .sort((a, b) => (Number(b.overdue) - Number(a.overdue)) || (alertWeight(b.tone) - alertWeight(a.tone)) || (Number(b.stageAgeHours || 0) - Number(a.stageAgeHours || 0)))
            .map(exportLead),
          totals: {
            leads: stage.leads || 0,
            highPriority: metrics.high || 0,
            overdue: metrics.overdue || 0,
            blocked: stage.blocked || 0,
            movedIn: stage.movedIn || 0,
            movedOut: stage.movedOut || 0,
            avgStageAge: stage.avgHours ? eventAgeLabel(stage.avgHours) : 'sem lead',
            deadline: `${adminCommercialStageDeadlineHours(stage.key)}h`
          }
        };
      }),
      stuckLeads: insights.stuck.map((lead) => ({
        leadRef: leadAlias(lead.id || lead.href || lead.title),
        ownerRef: ownerAlias(lead.owner || 'sem responsavel'),
        stage: lead.stageKey,
        stageLabel: lead.stageLabel,
        source: lead.source || 'Origem local',
        priority: lead.priority || 'Media',
        stageAge: eventAgeLabel(lead.stageAgeHours),
        nextStep: lead.nextStep || 'Retomar lead',
        overdue: true
      })),
      recentMovements: insights.recentMoves.map((event, index) => ({
        movementRef: `mov-${String(index + 1).padStart(3, '0')}`,
        leadRef: leadAlias(event.handoffId || event.id),
        from: event.fromLabel || 'Entrada',
        to: event.toLabel || 'Contato',
        age: event.age || 'agora'
      })),
      governance: {
        source: 'Dashboard Admin local',
        useCase: 'reuniao diaria comercial',
        generatedFrom: ['bf_consultive_handoffs_v1', ADMIN_COMMERCIAL_STAGE_STATE_KEY, ADMIN_COMMERCIAL_STAGE_AUDIT_KEY],
        compatibility: 'Mantem referencias anonimas para preservar dados locais e permitir leitura do funil sem expor cliente.'
      }
    };

    return sanitizeAdminPortfolioExport(payload);
  }

  function renderAdminCommercialPipeline(pipeline) {
    const resolvedPipeline = pipeline || buildAdminCommercialPipeline();
    return `
      <section class="bf-admin-commercial-pipeline" id="admin-funil-comercial" data-admin-commercial-pipeline>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--navy">Funil comercial</span>
            <h3>Etapas comerciais dos leads</h3>
            <p>Organiza a carteira em contato, proposta, follow-up, negociacao e fechamento para orientar a rotina comercial.</p>
          </div>
          <div class="bf-inline-actions">
            <button class="btn btn--ghost btn--sm" type="button" data-admin-commercial-pipeline-export>Exportar funil</button>
            <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#fila-handoff">Abrir fila consultiva</a>
          </div>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Leads no funil', resolvedPipeline.total || 0, resolvedPipeline.total ? 'is-strong' : '')}
          ${window.BFCards.metric('Em aberto', resolvedPipeline.open || 0)}
          ${window.BFCards.metric('Alta prioridade', resolvedPipeline.high || 0, resolvedPipeline.high ? 'is-warn' : '')}
          ${window.BFCards.metric('SLA vencido', resolvedPipeline.overdue || 0, resolvedPipeline.overdue ? 'is-warn' : '')}
          ${window.BFCards.metric('Fechamento', resolvedPipeline.closed || 0)}
        </div>
        <div class="bf-admin-commercial-pipeline__grid">
          ${resolvedPipeline.rows.map((stage) => `
            <article class="bf-admin-commercial-stage bf-admin-commercial-stage--${escapeHtml(stage.tone)}" data-admin-commercial-stage="${escapeHtml(stage.key)}">
              <div class="bf-admin-commercial-stage__top">
                <span>${escapeHtml(stage.label)}</span>
                <strong>${escapeHtml(stage.totalLeads || stage.leads.length)}</strong>
              </div>
              <div class="bf-admin-funnel-bar"><i style="width:${escapeHtml(stage.width)}%"></i></div>
              <dl>
                <div><dt>Alta</dt><dd>${escapeHtml(stage.high)}</dd></div>
                <div><dt>SLA</dt><dd>${escapeHtml(stage.overdue)}</dd></div>
                <div><dt>Aging</dt><dd>${escapeHtml(stage.leads.length ? eventAgeLabel(stage.avgHours) : 'sem lead')}</dd></div>
              </dl>
              <div class="bf-admin-commercial-stage__leads">
                ${stage.leads.length ? stage.leads.map((lead) => `
                  <article class="bf-admin-commercial-lead bf-admin-commercial-lead--${escapeHtml(lead.tone)}" data-admin-commercial-lead="${escapeHtml(lead.id)}">
                    <span>${escapeHtml(lead.source)} - ${escapeHtml(lead.priority)} - ${escapeHtml(lead.age)}</span>
                    <strong>${escapeHtml(lead.title)}</strong>
                    <small>${escapeHtml(lead.status)} - ${escapeHtml(lead.nextStep)}</small>
                    <div class="bf-admin-commercial-lead__actions">
                      <label>
                        <span>Mover etapa</span>
                        <select class="bf-admin-commercial-stage-select" data-admin-commercial-stage-select="${escapeHtml(lead.id)}" aria-label="Mover etapa comercial de ${escapeHtml(lead.title)}">
                          ${adminCommercialStageOptions(lead.stageKey)}
                        </select>
                      </label>
                      <a class="btn btn--ghost btn--sm" href="${escapeHtml(lead.href)}">Abrir lead</a>
                    </div>
                    <small data-admin-commercial-stage-history>${escapeHtml(adminCommercialStageHistoryLabel(lead.id))}</small>
                  </article>
                `).join('') : `<div class="bf-empty-state">${escapeHtml(stage.next)} quando houver lead nesta etapa.</div>`}
              </div>
            </article>
          `).join('')}
        </div>
        ${renderAdminCommercialStageInsights(resolvedPipeline)}
      </section>
    `;
  }

  function adminRecoveryFilters(root = document) {
    const find = (selector) => root.querySelector ? root.querySelector(selector) : qs(selector);
    return {
      assigneeEmail: find('[data-admin-recovery-filter="assignee"]')?.value || '',
      queueStatus: find('[data-admin-recovery-filter="status"]')?.value || '',
      severity: find('[data-admin-recovery-filter="severity"]')?.value || '',
      stage: find('[data-admin-recovery-filter="stage"]')?.value || '',
      search: find('[data-admin-recovery-filter="search"]')?.value || ''
    };
  }

  function adminRecoveryFilterControls(filters, users) {
    const service = adminRecoveryService();
    const consultants = service && service.consultantPool ? service.consultantPool(users) : [];
    const assigneeOptions = consultants.map((user) => `
      <option value="${escapeHtml(user.email)}"${selectedAttr(filters.assigneeEmail, user.email)}>${escapeHtml(user.name || user.email)}</option>
    `).join('');
    const statuses = [
      ['retomada-pendente', 'Retomada pendente'],
      ['pronto-para-handoff', 'Pronto para handoff'],
      ['handoff-criado', 'Handoff criado']
    ];
    const severities = [['alta', 'Alta'], ['media', 'Media'], ['baixa', 'Baixa']];
    const stages = [
      ['selected', 'Produtos'],
      ['compare', 'Comparador'],
      ['decision', 'Decisao'],
      ['saved', 'Cenario salvo'],
      ['simulator', 'Simulador'],
      ['complete', 'Pronto']
    ];

    return `
      <div class="bf-admin-toolbar" data-admin-recovery-filters>
        <label>Busca
          <input type="search" value="${escapeHtml(filters.search)}" data-admin-recovery-filter="search" placeholder="Cliente, etapa, produto ou handoff">
        </label>
        <label>Responsavel
          <select data-admin-recovery-filter="assignee">
            <option value="">Todos</option>
            ${assigneeOptions}
          </select>
        </label>
        <label>Status
          <select data-admin-recovery-filter="status">
            <option value="">Todos</option>
            ${statuses.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.queueStatus, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <label>Prioridade
          <select data-admin-recovery-filter="severity">
            <option value="">Todas</option>
            ${severities.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.severity, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <label>Etapa
          <select data-admin-recovery-filter="stage">
            <option value="">Todas</option>
            ${stages.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.stage, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <button class="btn btn--ghost btn--sm" type="button" data-admin-recovery-export>Exportar pacote</button>
      </div>
    `;
  }

  function adminPackageAssignees(users) {
    const service = adminRecoveryService();
    const pool = service && service.consultantPool ? service.consultantPool(users) : [];
    if (pool.length) return pool;
    return users.filter((user) => user && user.status === 'active');
  }

  function adminPackageAssigneeOptions(users, current) {
    const pool = adminPackageAssignees(users);
    const hasCurrent = current && pool.some((user) => user.email === current);
    return `
      <option value="">Selecionar</option>
      ${hasCurrent ? '' : (current ? `<option value="${escapeHtml(current)}" selected>${escapeHtml(current)}</option>` : '')}
      ${pool.map((user) => `
        <option value="${escapeHtml(user.email)}"${selectedAttr(current, user.email)}>${escapeHtml(user.name || user.email)}</option>
      `).join('')}
    `;
  }

  function adminPackageFilters(root = document) {
    const find = (selector) => root.querySelector ? root.querySelector(selector) : qs(selector);
    return {
      search: find('[data-admin-package-filter="search"]')?.value || '',
      operationalStatus: find('[data-admin-package-filter="status"]')?.value || '',
      assignedTo: find('[data-admin-package-filter="assignee"]')?.value || '',
      severity: find('[data-admin-package-filter="severity"]')?.value || '',
      sla: find('[data-admin-package-filter="sla"]')?.value || ''
    };
  }

  function adminPackageFilterControls(users, filters) {
    const assigneeOptions = adminPackageAssignees(users).map((user) => `
      <option value="${escapeHtml(user.email)}"${selectedAttr(filters.assignedTo, user.email)}>${escapeHtml(user.name || user.email)}</option>
    `).join('');
    const statuses = [
      ['recebido', 'Recebido'],
      ['atribuido', 'Atribuido'],
      ['handoff-criado', 'Handoff criado']
    ];
    const severities = [['alta', 'Alta'], ['media', 'Media'], ['baixa', 'Baixa']];
    const slaOptions = [
      ['vencido', 'SLA vencido'],
      ['no-prazo', 'No prazo'],
      ['concluido', 'Concluido']
    ];
    return `
      <div class="bf-admin-toolbar" data-admin-package-filters>
        <label>Busca
          <input type="search" value="${escapeHtml(filters.search)}" data-admin-package-filter="search" placeholder="Cliente, pacote, etapa ou handoff">
        </label>
        <label>Status
          <select data-admin-package-filter="status">
            <option value="">Todos</option>
            ${statuses.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.operationalStatus, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <label>Responsavel
          <select data-admin-package-filter="assignee">
            <option value="">Todos</option>
            ${assigneeOptions}
          </select>
        </label>
        <label>Prioridade
          <select data-admin-package-filter="severity">
            <option value="">Todas</option>
            ${severities.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.severity, value)}>${label}</option>`).join('')}
          </select>
        </label>
        <label>SLA
          <select data-admin-package-filter="sla">
            <option value="">Todos</option>
            ${slaOptions.map(([value, label]) => `<option value="${value}"${selectedAttr(filters.sla, value)}>${label}</option>`).join('')}
          </select>
        </label>
      </div>
    `;
  }

  function recoveryAuditLabel(action) {
    const labels = {
      export: 'Pacote exportado',
      import: 'Pacote importado',
      'import-duplicate': 'Importacao duplicada',
      'import-rejected': 'Importacao recusada',
      'import-item-assign': 'Item atribuido',
      'import-item-handoff': 'Handoff de item importado',
      'import-item-handoff-failed': 'Falha no handoff importado',
      'import-item-route': 'Item roteado',
      'import-routing-run': 'Roteamento executado',
      'conversion-goal-save': 'Meta salva'
    };
    return labels[action] || action || 'Evento';
  }

  function importedItemStatusLabel(status) {
    const labels = {
      recebido: 'Recebido',
      atribuido: 'Atribuido',
      'handoff-criado': 'Handoff criado'
    };
    return labels[status] || labels.recebido;
  }

  function adminPackageRoutingRows(scoreboard) {
    const rows = scoreboard && scoreboard.consultants ? scoreboard.consultants : [];
    return rows.slice(0, 8).map((item) => `
      <article class="bf-history-item" data-admin-package-goal-consultant="${escapeHtml(item.assignedTo)}">
        <span>${escapeHtml(item.name || item.assignedTo)}</span>
        <strong>${escapeHtml(item.handoffs || 0)}/${escapeHtml(item.targetHandoffs || 0)} handoffs</strong>
        <small>${escapeHtml(item.pending || 0)} pendente${Number(item.pending || 0) === 1 ? '' : 's'} - ${escapeHtml(item.overdue || 0)} vencido${Number(item.overdue || 0) === 1 ? '' : 's'} - ${escapeHtml(item.progress || 0)}%</small>
        <div class="bf-inline-actions">
          <input type="number" min="0" step="1" value="${escapeHtml(item.targetHandoffs || 0)}" data-admin-package-goal-input aria-label="Meta de handoffs">
          <button class="btn btn--ghost btn--sm" type="button" data-admin-package-save-goal>Salvar meta</button>
        </div>
      </article>
    `).join('');
  }

  function downloadAdminRecoveryPackage() {
    const service = adminRecoveryService();
    if (!service || !service.exportPackage) return null;
    const filters = adminRecoveryFilters(qs('[data-admin-recovery-queue]') || document);
    const payload = service.exportPackage({ filters });
    window.__lastAdminRecoveryExport = payload;
    const filename = `bank-fratern-retomadas-${new Date().toISOString().slice(0, 10)}.json`;
    const text = JSON.stringify(payload, null, 2);
    if (typeof Blob !== 'undefined' && window.URL && document.createElement) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    }
    setMessage(`Pacote de retomadas preparado: ${payload.items.length} item${payload.items.length === 1 ? '' : 's'}.`, 'success');
    renderAdminRecoveryPackages();
    return payload;
  }

  function downloadAdminConsultantPortfolio() {
    const sourceRows = buildAdminSourceFunnel();
    const bottlenecks = buildAdminBottlenecks();
    const filters = adminPortfolioFilters(qs('[data-admin-journey-funnel]') || document);
    const rows = filterAdminConsultantPortfolio(buildAdminConsultantPortfolio(sourceRows, bottlenecks), filters);
    const payload = buildAdminConsultantPortfolioExport(rows, filters);
    window.__lastAdminPortfolioExport = payload;
    const filename = `bank-fratern-carteira-consultores-${new Date().toISOString().slice(0, 10)}.json`;
    const text = JSON.stringify(payload, null, 2);
    if (typeof Blob !== 'undefined' && window.URL && document.createElement) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    }
    setMessage(`Carteira do dia preparada: ${payload.summary.leads} lead${payload.summary.leads === 1 ? '' : 's'} em ${payload.summary.consultants} consultor${payload.summary.consultants === 1 ? '' : 'es'}.`, 'success');
    return payload;
  }

  function downloadAdminCommercialPipeline() {
    const payload = buildAdminCommercialPipelineExport(buildAdminCommercialPipeline());
    window.__lastAdminCommercialPipelineExport = payload;
    const filename = `bank-fratern-funil-comercial-${new Date().toISOString().slice(0, 10)}.json`;
    const text = JSON.stringify(payload, null, 2);
    if (typeof Blob !== 'undefined' && window.URL && document.createElement) {
      const blob = new Blob([text], { type: 'application/json' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      link.click();
      window.URL.revokeObjectURL(url);
    }
    setMessage(`Funil comercial preparado: ${payload.summary.leads} lead${payload.summary.leads === 1 ? '' : 's'} em ${payload.summary.stages} etapas.`, 'success');
    return payload;
  }

  function renderOperationalAlerts() {
    const target = qs('[data-admin-operational-alerts]');
    if (!target) return;
    const alerts = operationalAlerts();
    const high = alerts.filter((alert) => alert.severity === 'alta').length;
    const abandonment = alerts.filter((alert) => alert.type === 'abandono').length;
    const sla = alerts.filter((alert) => alert.type === 'sla').length;
    const rows = alerts.slice(0, 8).map((alert) => `
      <article class="bf-admin-alert-card bf-admin-alert-card--${escapeHtml(alert.severity)}" data-admin-operational-alert="${escapeHtml(alert.type)}">
        <div class="bf-admin-alert-card__top">
          <span>${escapeHtml(alert.type === 'sla' ? 'SLA' : 'Jornada')}</span>
          <strong>${escapeHtml(alertSeverityLabel(alert.severity))}</strong>
        </div>
        <h3>${escapeHtml(alert.title)}</h3>
        <p>${escapeHtml(alert.reason)}</p>
        <div class="bf-admin-alert-meta">
          <small>${escapeHtml(alert.ownerEmail)}</small>
          <small>${escapeHtml(alert.ownerRoleLabel || 'Origem')}</small>
          <small>${escapeHtml(alert.age)}</small>
          ${alert.objectiveLabel ? `<small>${escapeHtml(alert.objectiveLabel)}</small>` : ''}
        </div>
        <div class="bf-admin-alert-actions">
          <a class="btn btn--ghost btn--sm" href="${escapeHtml(alert.ctaHref)}">${escapeHtml(alert.ctaLabel || 'Abrir')}</a>
        </div>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Alertas operacionais</span>
          <h2>SLA e abandono da jornada</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html">Abrir atendimento</a>
      </div>
      <div class="bf-admin-alerts">
        <div class="bf-admin-alerts__summary">
          <div>
            <span class="bf-badge bf-badge--navy">Leitura acionavel</span>
            <h3>${alerts.length} alerta${alerts.length === 1 ? '' : 's'} em aberto</h3>
            <p>O painel cruza microconversoes locais e fila consultiva para indicar abandono, ausencia de continuidade e leads fora do SLA esperado.</p>
          </div>
          <div class="bf-admin-alerts__score">
            <small>Alta prioridade</small>
            <strong>${high}</strong>
            <span>${alerts.length ? `${eventAgeLabel(alerts[0].hours)} desde o sinal critico` : 'sem alerta'}</span>
          </div>
        </div>
        <div class="bf-platform-metrics">
          <article class="bf-platform-metric${alerts.length ? ' is-strong' : ''}"><small>Total</small><strong>${alerts.length}</strong></article>
          <article class="bf-platform-metric${high ? ' is-warn' : ''}"><small>Altos</small><strong>${high}</strong></article>
          <article class="bf-platform-metric"><small>Abandono</small><strong>${abandonment}</strong></article>
          <article class="bf-platform-metric"><small>SLA</small><strong>${sla}</strong></article>
        </div>
        <div class="bf-admin-alert-grid">${rows || '<div class="bf-empty-state">Nenhum alerta operacional aberto. O funil e os handoffs continuam monitorados localmente.</div>'}</div>
      </div>
    `;
    document.body.dataset.adminOperationalAlertsReady = 'true';
    document.body.dataset.adminOperationalAlertsCount = String(alerts.length);
  }

  function renderAdminRecoveryQueue() {
    const target = qs('[data-admin-recovery-queue]');
    if (!target) return;
    const service = adminRecoveryService();
    const filters = adminRecoveryFilters(target);
    const users = allUsers();
    const items = adminRecoveryQueue({ filters });
    const summary = service && service.summary ? service.summary(items, users) : { total: items.length, open: items.length, high: 0, consultants: 0 };
    const rows = items.slice(0, 8).map((item) => `
      <article class="bf-admin-alert-card bf-admin-alert-card--${escapeHtml(item.severity)}" data-admin-recovery-item="${escapeHtml(item.type)}">
        <div class="bf-admin-alert-card__top">
          <span>${escapeHtml(item.stageLabel)}</span>
          <strong>${escapeHtml(item.severityLabel)}</strong>
        </div>
        <h3>${escapeHtml(item.title)}</h3>
        <p>${escapeHtml(item.reason)}</p>
        <div class="bf-admin-alert-meta">
          <small>${escapeHtml(item.ownerEmail)}</small>
          <small>${escapeHtml(item.age || `${Math.round(item.hours || 0)}h`)}</small>
          <small>${escapeHtml(item.suggestedAssigneeName || item.suggestedAssigneeEmail || 'Sem consultor ativo')}</small>
          ${item.existingHandoffId ? `<small>${escapeHtml(item.existingHandoffId)}</small>` : ''}
        </div>
        <div class="bf-admin-alert-actions">
          <a class="btn btn--ghost btn--sm" href="${escapeHtml(item.ctaHref)}">${escapeHtml(item.ctaLabel)}</a>
          ${item.existingHandoffId
            ? `<a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#fila-handoff">Abrir handoff</a>`
            : `<button class="btn btn--primary btn--sm" type="button" data-admin-create-recovery-handoff="${escapeHtml(item.id)}" data-admin-suggested-assignee="${escapeHtml(item.suggestedAssigneeEmail)}">Criar handoff</button>`}
        </div>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Fila de recuperacao</span>
          <h2>Retomadas por consultor sugerido</h2>
          <p>Sinais de Produtos, Comparador e Simuladores viram uma fila priorizada com aging, cliente, etapa e responsavel sugerido.</p>
        </div>
        <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#sinais-retomada">Abrir handoff</a>
      </div>
      ${adminRecoveryFilterControls(filters, users)}
      <div class="bf-platform-metrics">
        ${window.BFCards.metric('Retomadas', summary.total || 0, 'is-strong')}
        ${window.BFCards.metric('Abertas', summary.open || 0)}
        ${window.BFCards.metric('Alta prioridade', summary.high || 0, summary.high ? 'is-warn' : '')}
        ${window.BFCards.metric('Consultores', summary.consultants || 0)}
      </div>
      <div class="bf-admin-alert-grid">
        ${rows || '<div class="bf-empty-state">Nenhuma retomada aberta. A fila continua monitorando sinais locais da jornada.</div>'}
      </div>
    `;
    document.body.dataset.adminRecoveryQueueReady = 'true';
    document.body.dataset.adminRecoveryQueueCount = String(summary.total || 0);
    document.body.dataset.adminRecoveryQueueFiltered = String(items.length);
  }

  function renderAdminRecoveryPackages() {
    const target = qs('[data-admin-recovery-packages]');
    const service = adminRecoveryService();
    if (!target || !service) return;
    const users = allUsers();
    const filters = adminPackageFilters(target);
    const packages = service.importedPackages ? service.importedPackages() : [];
    const allReceivedItems = service.importedItems ? service.importedItems() : [];
    const receivedItems = service.importedItems ? service.importedItems({ filters }) : [];
    const receivedSummary = service.importedItemsSummary ? service.importedItemsSummary(receivedItems) : {
      total: receivedItems.length,
      pending: receivedItems.filter((item) => item.operationalStatus !== 'handoff-criado').length,
      handoffs: receivedItems.filter((item) => item.operationalStatus === 'handoff-criado').length,
      overdue: receivedItems.filter((item) => item.slaOverdue === true).length
    };
    const scoreboard = service.conversionScoreboard ? service.conversionScoreboard({ users, items: allReceivedItems }) : {
      consultants: [],
      totalTarget: 0,
      totalHandoffs: 0,
      progress: 0,
      routed: 0,
      pending: 0,
      overdue: 0
    };
    const audit = service.audit ? service.audit() : [];
    const itemTotal = allReceivedItems.length || packages.reduce((sum, item) => sum + Number(item.itemCount || 0), 0);
    const packageRows = packages.slice(0, 5).map((item) => `
      <article class="bf-history-item" data-admin-recovery-package="${escapeHtml(item.id)}">
        <span>${escapeHtml(item.label || 'Pacote importado')}</span>
        <strong>${escapeHtml(item.itemCount || 0)} item${Number(item.itemCount || 0) === 1 ? '' : 's'} recebidos</strong>
        <small>${escapeHtml(item.source || 'manual')} - ${escapeHtml(formatDate(item.importedAt))}</small>
        <small>${escapeHtml(item.packageHash || '')}</small>
      </article>
    `).join('');
    const importedRows = receivedItems.slice(0, 8).map((item) => `
      <article class="bf-admin-alert-card bf-admin-alert-card--${escapeHtml(item.severity || 'media')}" data-admin-recovery-package-item data-admin-recovery-package-id="${escapeHtml(item.packageId)}" data-admin-recovery-package-item-id="${escapeHtml(item.id)}">
        <div class="bf-admin-alert-card__top">
          <span>${escapeHtml(importedItemStatusLabel(item.operationalStatus))}</span>
          <strong>${escapeHtml(item.severityLabel || item.severity || 'Media')}</strong>
        </div>
        <h3>${escapeHtml(item.title || 'Retomada importada')}</h3>
        <p>${escapeHtml(item.reason || 'Item recebido por pacote administrativo de recuperacao.')}</p>
        <div class="bf-admin-alert-meta">
          <small>${escapeHtml(item.ownerEmail || 'anon')}</small>
          <small>${escapeHtml(item.stageLabel || item.stage || 'Jornada')}</small>
          <small>${escapeHtml(item.slaLabel || 'SLA local')}</small>
          <small>${escapeHtml(item.slaAgeLabel || item.age || '-')}</small>
          <small>${escapeHtml(item.packageLabel || item.packageSource || 'Pacote importado')}</small>
          ${item.handoffId ? `<small>${escapeHtml(item.handoffId)}</small>` : ''}
        </div>
        <div class="bf-admin-toolbar" data-admin-package-actions>
          <label>Responsavel
            <select data-admin-package-assignee>
              ${adminPackageAssigneeOptions(users, item.assignedTo)}
            </select>
          </label>
          <div class="bf-inline-actions">
            <button class="btn btn--ghost btn--sm" type="button" data-admin-package-assign>Salvar responsavel</button>
            <button class="btn btn--primary btn--sm" type="button" data-admin-package-handoff>${item.handoffId ? 'Atualizar handoff' : 'Criar handoff'}</button>
            ${item.handoffId ? '<a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#fila-handoff">Abrir handoff</a>' : ''}
          </div>
        </div>
      </article>
    `).join('');
    const auditRows = audit.slice(0, 6).map((event) => `
      <article class="bf-history-item" data-admin-recovery-audit="${escapeHtml(event.action)}">
        <span>${escapeHtml(recoveryAuditLabel(event.action))}</span>
        <strong>${escapeHtml(event.packageId || event.packageHash || 'Pacote local')}</strong>
        <small>${escapeHtml(event.actorEmail || 'anon')} - ${escapeHtml(formatDate(event.createdAt))}</small>
        <small>${escapeHtml(event.itemCount || 0)} item${Number(event.itemCount || 0) === 1 ? '' : 's'}</small>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--navy">Governanca de pacotes</span>
          <h2>Troca local entre navegadores</h2>
          <p>Importe JSON exportado por outro navegador para auditoria controlada, sem misturar automaticamente sinais externos na fila operacional.</p>
        </div>
      </div>
      <div class="bf-platform-metrics">
        ${window.BFCards.metric('Pacotes', packages.length, 'is-strong')}
        ${window.BFCards.metric('Itens recebidos', itemTotal)}
        ${window.BFCards.metric('Filtrados', receivedSummary.total || 0)}
        ${window.BFCards.metric('SLA vencido', receivedSummary.overdue || 0, receivedSummary.overdue ? 'is-warn' : '')}
      </div>
      <form class="bf-platform-form bf-admin-form" data-admin-recovery-import-form>
        <label>Rotulo do pacote
          <input name="label" type="text" placeholder="Ex.: Retomadas filial SP">
        </label>
        <label>Origem
          <input name="source" type="text" placeholder="Navegador, consultor ou unidade">
        </label>
        <label class="bf-admin-form__wide">JSON exportado
          <textarea name="packageJson" rows="5" placeholder='Cole aqui o JSON exportado pela fila de recuperacao'></textarea>
        </label>
        <button class="btn btn--primary" type="submit">Importar pacote</button>
      </form>
      <section class="bf-platform-section" data-admin-package-routing>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--navy">Roteamento de carteira</span>
            <h3>Metas por consultor</h3>
          </div>
          <button class="btn btn--primary btn--sm" type="button" data-admin-package-route>Roteamento automatico</button>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Consultores', scoreboard.consultants.length || 0, 'is-strong')}
          ${window.BFCards.metric('Roteados', scoreboard.routed || 0)}
          ${window.BFCards.metric('Meta', scoreboard.totalTarget || 0)}
          ${window.BFCards.metric('Progresso', `${scoreboard.progress || 0}%`, scoreboard.progress >= 100 ? 'is-strong' : '')}
        </div>
        <div class="bf-calculator-history">${adminPackageRoutingRows(scoreboard) || '<div class="bf-empty-state">Importe e roteie itens para acompanhar metas por consultor.</div>'}</div>
      </section>
      <section class="bf-platform-section" data-admin-recovery-imported-items>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--gold">Itens recebidos</span>
            <h3>Operacao a partir de pacotes</h3>
          </div>
          <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html#fila-handoff">Ver handoffs</a>
        </div>
        ${adminPackageFilterControls(users, filters)}
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Pendentes', receivedSummary.pending || 0, receivedSummary.pending ? 'is-warn' : '')}
          ${window.BFCards.metric('Recebidos', receivedSummary.received || 0)}
          ${window.BFCards.metric('Atribuidos', receivedSummary.assigned || 0)}
          ${window.BFCards.metric('Handoffs', receivedSummary.handoffs || 0)}
        </div>
        <div class="bf-admin-alert-grid">${importedRows || '<div class="bf-empty-state">Importe um pacote para atribuir itens e criar handoffs.</div>'}</div>
      </section>
      <div class="bf-admin-grid bf-platform-section">
        <section>
          <span class="bf-badge bf-badge--gold">Pacotes recebidos</span>
          <div class="bf-calculator-history">${packageRows || '<div class="bf-empty-state">Nenhum pacote importado neste navegador.</div>'}</div>
        </section>
        <section>
          <span class="bf-badge bf-badge--ok">Auditoria de troca</span>
          <div class="bf-calculator-history">${auditRows || '<div class="bf-empty-state">Exportacoes e importacoes aparecerao aqui.</div>'}</div>
        </section>
      </div>
    `;
    document.body.dataset.adminRecoveryPackagesReady = 'true';
    document.body.dataset.adminRecoveryPackagesCount = String(packages.length);
    document.body.dataset.adminRecoveryImportedItems = String(allReceivedItems.length);
    document.body.dataset.adminRecoveryImportedItemsFiltered = String(receivedItems.length);
    document.body.dataset.adminRecoveryImportedItemsOverdue = String(receivedSummary.overdue || 0);
    document.body.dataset.adminPackageRoutingReady = 'true';
    document.body.dataset.adminPackageRoutingRouted = String(scoreboard.routed || 0);
    document.body.dataset.adminPackageRoutingProgress = String(scoreboard.progress || 0);
  }

  function renderJourneyFunnel() {
    const target = qs('[data-admin-journey-funnel]');
    if (!target) return;
    const service = window.BFJourneyAnalytics;
    const funnel = service && service.roleFunnel ? service.roleFunnel() : null;
    const summary = funnel && funnel.summary ? funnel.summary : {
      total: 0,
      productSelections: 0,
      compareOpen: 0,
      comparatorRuns: 0,
      savedScenarios: 0,
      simulatorRuns: 0,
      conversionRate: 0
    };
    const stages = funnel && funnel.stages ? funnel.stages : [];
    const byRole = funnel && funnel.byRole ? funnel.byRole : [];
    const recent = funnel && funnel.recent ? funnel.recent : [];
    const maxStage = Math.max(1, ...stages.map((stage) => Number(stage.value || 0)));
    const maxRole = Math.max(1, ...byRole.map((role) => Number(role.total || 0)));
    const commercialPipeline = buildAdminCommercialPipeline();
    const commercialInsights = buildAdminCommercialStageInsights(commercialPipeline);

    const stageHtml = stages.map((stage, index) => {
      const value = Number(stage.value || 0);
      const width = Math.max(4, Math.round((value / maxStage) * 100));
      return `
        <article class="bf-admin-funnel-stage" data-admin-funnel-stage="${escapeHtml(stage.key)}">
          <div>
            <span>${index + 1}</span>
            <strong>${escapeHtml(stage.label)}</strong>
            <small>${value} evento${value === 1 ? '' : 's'}</small>
          </div>
          <div class="bf-admin-funnel-bar"><i style="width:${width}%"></i></div>
        </article>
      `;
    }).join('');

    const roleHtml = byRole.length ? byRole.map((role) => {
      const total = Number(role.total || 0);
      const width = Math.max(4, Math.round((total / maxRole) * 100));
      const roleSummary = role.summary || {};
      return `
        <article class="bf-admin-role-funnel" data-admin-journey-role="${escapeHtml(role.role)}">
          <div class="bf-admin-role-funnel__top">
            <div>
              <span>${escapeHtml(role.label)}</span>
              <strong>${total}</strong>
            </div>
            <small>${role.owners || 0} ${role.owners === 1 ? 'origem' : 'origens'}</small>
          </div>
          <div class="bf-admin-funnel-bar"><i style="width:${width}%"></i></div>
          <dl>
            <div><dt>Selecoes</dt><dd>${roleSummary.productSelections || 0}</dd></div>
            <div><dt>Comparador</dt><dd>${roleSummary.compareOpen || 0}</dd></div>
            <div><dt>Salvos</dt><dd>${roleSummary.savedScenarios || 0}</dd></div>
            <div><dt>Simuladores</dt><dd>${roleSummary.simulatorRuns || 0}</dd></div>
          </dl>
        </article>
      `;
    }).join('') : '<div class="bf-empty-state">Nenhum evento de jornada registrado neste navegador.</div>';

    const recentHtml = recent.length ? recent.slice(0, 6).map((event) => `
      <article class="bf-history-item" data-admin-journey-event>
        <span>${escapeHtml(journeyActionLabel(event.type))}</span>
        <strong>${escapeHtml(journeyEventDetail(event))}</strong>
        <small>${escapeHtml(event.ownerRoleLabel || event.ownerRole || 'Origem')} - ${escapeHtml(event.ownerEmail || 'anon')}</small>
        <small>${escapeHtml(formatDate(event.createdAt))}</small>
      </article>
    `).join('') : '<div class="bf-empty-state">Os eventos aparecem aqui depois que Produtos, Comparador ou Simuladores forem usados.</div>';
    const sourceFunnel = buildAdminSourceFunnel();
    const bottlenecks = buildAdminBottlenecks();

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--ok">Funil local</span>
          <h2>Microconversoes por papel</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="produtos.html">Abrir produtos</a>
      </div>
      <div class="bf-admin-funnel">
        <div class="bf-admin-funnel__summary">
          <div>
            <span class="bf-badge bf-badge--gold">Jornada medida</span>
            <h3>${summary.total} evento${summary.total === 1 ? '' : 's'} locais</h3>
            <p>Leitura consolidada de usuarios autenticados e anonimos neste navegador, sem backend e sem envio externo.</p>
          </div>
          <div class="bf-admin-funnel__score">
            <small>Conversao</small>
            <strong>${summary.conversionRate || 0}%</strong>
            <span>${funnel && funnel.totalOwners ? funnel.totalOwners : 0} ${funnel && funnel.totalOwners === 1 ? 'origem' : 'origens'}</span>
          </div>
        </div>
        <div class="bf-platform-metrics">
          ${window.BFCards.metric('Selecoes', summary.productSelections || 0, 'is-strong')}
          ${window.BFCards.metric('Comparador', summary.compareOpen || 0)}
          ${window.BFCards.metric('Matrizes', summary.comparatorRuns || 0)}
          ${window.BFCards.metric('Simuladores', summary.simulatorRuns || 0)}
        </div>
        <div class="bf-admin-funnel__stages">${stageHtml}</div>
        <div class="bf-admin-role-funnel-grid">${roleHtml}</div>
        ${renderAdminNextActionBoard(sourceFunnel, bottlenecks)}
        ${renderAdminActionQueue(sourceFunnel, bottlenecks)}
        ${renderAdminConsultantProductivity(sourceFunnel, bottlenecks)}
        ${renderAdminConsultantPortfolio(sourceFunnel, bottlenecks)}
        ${renderAdminCommercialPipeline(commercialPipeline)}
        ${renderAdminSourceFunnel(sourceFunnel)}
        ${renderAdminBottleneckBoard(bottlenecks)}
        <div class="bf-calculator-history">${recentHtml}</div>
      </div>
    `;
    document.body.dataset.adminJourneyFunnelReady = 'true';
    document.body.dataset.adminJourneyEvents = String(summary.total || 0);
    document.body.dataset.adminSourceFunnelReady = 'true';
    document.body.dataset.adminSourceFunnelCount = String(sourceFunnel.reduce((sum, item) => sum + Number(item.total || 0), 0));
    document.body.dataset.adminBottleneckCount = String(bottlenecks.length);
    document.body.dataset.adminNextActionsReady = 'true';
    document.body.dataset.adminNextActionCount = String(buildAdminNextActions(sourceFunnel, bottlenecks).length);
    document.body.dataset.adminActionQueueReady = 'true';
    document.body.dataset.adminActionQueueCount = String(buildAdminActionQueue(sourceFunnel, bottlenecks).length);
    document.body.dataset.adminConsultantProductivityReady = 'true';
    document.body.dataset.adminConsultantProductivityCount = String(buildAdminConsultantProductivity(sourceFunnel, bottlenecks).length);
    document.body.dataset.adminConsultantPortfolioReady = 'true';
    document.body.dataset.adminConsultantPortfolioCount = String(buildAdminConsultantPortfolio(sourceFunnel, bottlenecks).length);
    document.body.dataset.adminCommercialPipelineReady = 'true';
    document.body.dataset.adminCommercialPipelineCount = String(commercialPipeline.total || 0);
    document.body.dataset.adminCommercialStageInsightsReady = 'true';
    document.body.dataset.adminCommercialStageStuckCount = String(commercialInsights.stuck.length || 0);
    document.body.dataset.adminCommercialStageMoved24 = String(commercialInsights.moved24h || 0);
  }

  function actionLabel(action) {
    const labels = {
      'auth-login': 'Login API',
      'auth-logout': 'Logout API',
      'auth-login-failed': 'Login recusado',
      'user-created': 'Usuario criado',
      'user-updated': 'Usuario atualizado',
      'user-deleted': 'Usuario removido',
      'user-password-reset': 'Senha redefinida',
      'user-status-changed': 'Status alterado',
      'validator-event': 'Evento validador',
      create: 'Criado',
      update: 'Atualizado',
      delete: 'Excluido',
      export: 'Exportado',
      import: 'Importado',
      'clone-standard': 'Clonado da biblioteca',
      'governance:approved': 'Aprovado',
      'governance:published': 'Publicado',
      'governance:archived': 'Arquivado'
    };
    return labels[action] || action || 'Evento';
  }

  function backendApi() {
    return window.BFBackendApi && typeof window.BFBackendApi === 'object' ? window.BFBackendApi : null;
  }

  function eventSourceLabel(source) {
    const labels = {
      'server-api': 'API local',
      validator: 'Validador',
      'journey-analytics': 'Jornada',
      'decision-context': 'Contexto',
      'handoff-consultivo': 'Handoff',
      'operational-action-audit': 'Plano de acao',
      'admin-commercial-stage': 'Funil comercial',
      'comparator-model-audit': 'Modelos',
      browser: 'Browser'
    };
    return labels[source] || String(source || 'Evento');
  }

  function eventPayloadSummary(event) {
    const payload = event && event.payload && typeof event.payload === 'object' ? event.payload : {};
    const keys = Object.keys(payload).filter(Boolean);
    if (!keys.length) return 'Payload sanitizado sem campos adicionais.';
    return `Campos: ${keys.slice(0, 6).join(', ')}${keys.length > 6 ? '...' : ''}.`;
  }

  function snapshotTypeLabel(type) {
    const labels = {
      simulation: 'Simulacao',
      'financial-profile': 'Perfil financeiro',
      'decision-journey': 'Trilha',
      'proposal-version': 'Versao proposta',
      'proposal-acceptance': 'Aceite proposta',
      'proposal-builder': 'Lousa proposta',
      handoff: 'Handoff',
      'comparator-models': 'Modelos comparador'
    };
    return labels[type] || String(type || 'Snapshot');
  }

  function journeyEntityKindLabel(kind) {
    const labels = {
      lead: 'Lead',
      simulation: 'Simulacao',
      proposal: 'Proposta'
    };
    return labels[kind] || String(kind || 'Entidade');
  }

  function materializedStatusOptions(kind) {
    const options = {
      lead: [
        ['novo', 'Novo'],
        ['em_atendimento', 'Em atendimento'],
        ['aguardando_cliente', 'Aguardando cliente'],
        ['qualificado', 'Qualificado'],
        ['descartado', 'Descartado']
      ],
      simulation: [
        ['saved', 'Salva'],
        ['em_analise', 'Em analise'],
        ['proposta', 'Virou proposta'],
        ['retomada', 'Retomada'],
        ['arquivada', 'Arquivada']
      ],
      proposal: [
        ['draft', 'Rascunho'],
        ['pending', 'Em revisao'],
        ['reviewed', 'Revisada'],
        ['sent', 'Enviada'],
        ['expired', 'Vencida']
      ]
    };
    return options[kind] || [['active', 'Ativo'], ['archived', 'Arquivado']];
  }

  function materializedStageOptions(kind) {
    const options = {
      lead: [
        ['contato', 'Contato'],
        ['proposta', 'Proposta'],
        ['followup', 'Follow-up'],
        ['negociacao', 'Negociacao'],
        ['fechamento', 'Fechamento']
      ],
      simulation: [
        ['simulacao', 'Simulacao'],
        ['comparacao', 'Comparacao'],
        ['proposta', 'Proposta'],
        ['retomada', 'Retomada'],
        ['handoff', 'Handoff']
      ],
      proposal: [
        ['lousa', 'Lousa'],
        ['versionamento', 'Versionamento'],
        ['aceite', 'Aceite'],
        ['proposta', 'Proposta'],
        ['handoff', 'Handoff']
      ]
    };
    return options[kind] || [['jornada', 'Jornada'], ['retomada', 'Retomada']];
  }

  function renderMaterializedOptions(options, current) {
    const normalized = String(current || '');
    const hasCurrent = !normalized || options.some(([value]) => String(value) === normalized);
    const rows = hasCurrent ? options : [[normalized, normalized]].concat(options);
    return rows.map(([value, label]) => `<option value="${escapeHtml(value)}"${selectedAttr(normalized, value)}>${escapeHtml(label)}</option>`).join('');
  }

  function materializedUpdateMethod(kind) {
    if (kind === 'lead') return 'updateLead';
    if (kind === 'simulation') return 'updateSimulation';
    if (kind === 'proposal') return 'updateProposal';
    return '';
  }

  function renderMaterializedControls(item) {
    const kind = String(item && item.kind ? item.kind : '');
    return `
      <div class="bf-admin-materialized-controls" data-admin-backend-materialized-control>
        <label>Status
          <select data-admin-backend-materialized-field="status" aria-label="Status de ${escapeHtml(item.title || item.id || 'registro')}">
            ${renderMaterializedOptions(materializedStatusOptions(kind), item.status || '')}
          </select>
        </label>
        <label>Etapa
          <select data-admin-backend-materialized-field="stage" aria-label="Etapa de ${escapeHtml(item.title || item.id || 'registro')}">
            ${renderMaterializedOptions(materializedStageOptions(kind), item.stage || '')}
          </select>
        </label>
        <label>Prioridade
          <select data-admin-backend-materialized-field="priority" aria-label="Prioridade de ${escapeHtml(item.title || item.id || 'registro')}">
            ${renderMaterializedOptions([['alta', 'Alta'], ['media', 'Media'], ['baixa', 'Baixa']], item.priority || 'media')}
          </select>
        </label>
        <button class="btn btn--primary btn--sm" type="button" data-admin-backend-materialized-save>Salvar</button>
      </div>
    `;
  }

  function renderBackendEventsUnavailable(target, message, detail) {
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--navy">Banco local</span>
          <h2>Eventos server-side</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="api-docs.html#api-endpoints">Ver API</a>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Status</small><strong>Fallback</strong></article>
        <article class="bf-platform-metric"><small>Eventos</small><strong>0</strong></article>
        <article class="bf-platform-metric"><small>Fonte</small><strong>localStorage</strong></article>
      </div>
      <div class="bf-empty-state">
        <strong>${escapeHtml(message)}</strong>
        <p>${escapeHtml(detail)}</p>
      </div>
    `;
    document.body.dataset.adminBackendEventsReady = 'fallback';
    document.body.dataset.adminBackendEventCount = '0';
  }

  function renderBackendEventsLoading(target) {
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--navy">Banco local</span>
          <h2>Eventos server-side</h2>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-admin-backend-event-refresh>Atualizar</button>
      </div>
      <div class="bf-empty-state">Carregando eventos do SQLite local...</div>
    `;
    document.body.dataset.adminBackendEventsReady = 'loading';
  }

  function renderLocalImportResult() {
    const state = backendLocalImportState || {};
    const result = state.result;
    if (state.loading) {
      return '<div class="bf-empty-state" data-admin-local-import-result>Processando migracao guiada...</div>';
    }
    if (!result) {
      return '<div class="bf-empty-state" data-admin-local-import-result>Use a previsualizacao antes de importar. A execucao nao sobrescreve usuarios ou eventos existentes.</div>';
    }
    if (!result.ok) {
      return `<div class="bf-empty-state" data-admin-local-import-result><strong>Importacao indisponivel</strong><p>${escapeHtml(result.message || 'Nao foi possivel processar o snapshot local.')}</p></div>`;
    }
    const mode = result.dryRun ? 'Previsualizacao' : 'Importacao executada';
    return `
      <div class="bf-empty-state" data-admin-local-import-result>
        <strong>${mode}</strong>
        <p>
          Usuarios: ${Number(result.users && result.users.importable || 0)} importaveis,
          ${Number(result.users && result.users.imported || 0)} importados,
          ${Number(result.users && result.users.skippedExisting || 0)} ja existentes.
          Eventos: ${Number(result.events && result.events.importable || 0)} importaveis,
          ${Number(result.events && result.events.imported || 0)} importados,
          ${Number(result.events && result.events.skippedExisting || 0)} ja existentes.
          Snapshots: ${Number(result.snapshots && result.snapshots.importable || 0)} importaveis,
          ${Number(result.snapshots && result.snapshots.created || 0)} criados,
          ${Number(result.snapshots && result.snapshots.updated || 0)} atualizados.
        </p>
        <small>Novos usuarios recebem senha temporaria ${escapeHtml(result.temporaryPassword || window.BFAuth.DEFAULT_PASSWORD || 'Temp@123')}.</small>
      </div>
    `;
  }

  function renderLocalImportPanel(snapshot) {
    const sourceCount = new Set([
      ...(snapshot.events || []).map((event) => event.source),
      ...(snapshot.snapshots || []).map((item) => item.source)
    ].filter(Boolean)).size;
    const snapshotTypeCount = new Set((snapshot.snapshots || []).map((item) => item.type).filter(Boolean)).size;
    return `
      <div class="bf-admin-import-panel" data-admin-local-import-panel>
        <div class="bf-admin-panel-heading">
          <div>
            <span class="bf-badge bf-badge--warning">Migracao guiada</span>
            <h3>localStorage para SQLite</h3>
          </div>
          <div class="bf-admin-actions">
            <button class="btn btn--ghost btn--sm" type="button" data-admin-local-import-preview>Previsualizar</button>
            <button class="btn btn--primary btn--sm" type="button" data-admin-local-import-run>Importar</button>
          </div>
        </div>
        <div class="bf-platform-metrics">
          <article class="bf-platform-metric"><small>Usuarios locais</small><strong>${snapshot.users.length}</strong></article>
          <article class="bf-platform-metric"><small>Eventos locais</small><strong>${snapshot.events.length}</strong></article>
          <article class="bf-platform-metric" data-admin-local-snapshot-count><small>Snapshots locais</small><strong>${snapshot.snapshots.length}</strong></article>
          <article class="bf-platform-metric"><small>Tipos de snapshot</small><strong>${snapshotTypeCount}</strong></article>
          <article class="bf-platform-metric"><small>Fontes locais</small><strong>${sourceCount}</strong></article>
          <article class="bf-platform-metric"><small>Modo</small><strong>Sem sobrescrever</strong></article>
        </div>
        ${renderLocalImportResult()}
      </div>
    `;
  }

  function renderBackendEventsResult(target, health, events, databaseStatus, snapshots, entitiesResult, materializedResult) {
    const list = Array.isArray(events) ? events : [];
    const serverSnapshots = Array.isArray(snapshots) ? snapshots : [];
    const serverEntities = entitiesResult && Array.isArray(entitiesResult.entities) ? entitiesResult.entities : [];
    const entitySummary = entitiesResult && entitiesResult.summary ? entitiesResult.summary : {};
    const materialized = materializedResult || {};
    const materializedRowsSource = [
      ...(Array.isArray(materialized.leads) ? materialized.leads : []),
      ...(Array.isArray(materialized.simulations) ? materialized.simulations : []),
      ...(Array.isArray(materialized.proposals) ? materialized.proposals : [])
    ];
    const snapshot = collectLocalImportSnapshot();
    const stats = health && health.stats ? health.stats : {};
    const dbStatus = databaseStatus && databaseStatus.ok ? databaseStatus : {};
    const dbFiles = dbStatus.files || {};
    const dbMainFile = dbFiles.main || {};
    const sqlite = dbStatus.sqlite || {};
    const tables = Array.isArray(dbStatus.tables) ? dbStatus.tables : [];
    const sources = list.reduce((set, event) => {
      if (event && event.source) set.add(event.source);
      return set;
    }, new Set());
    const snapshotTypes = serverSnapshots.reduce((set, item) => {
      if (item && item.type) set.add(item.type);
      return set;
    }, new Set());
    const tableRows = tables.map((table) => `
      <article class="bf-history-item" data-admin-backend-table="${escapeHtml(table.name || '')}">
        <span>Tabela SQLite</span>
        <strong>${escapeHtml(table.name || '-')}</strong>
        <small>${Number(table.rows || 0)} registros</small>
      </article>
    `).join('');
    const rows = list.slice(0, 8).map((event) => `
      <article class="bf-history-item" data-admin-backend-event="${escapeHtml(event.id || '')}">
        <span>${escapeHtml(eventSourceLabel(event.source))}</span>
        <strong>${escapeHtml(actionLabel(event.type))}</strong>
        <small>${escapeHtml(formatDate(event.createdAt))} - ${escapeHtml(event.actorEmail || event.ownerEmail || 'anon')}</small>
        <small>${escapeHtml(event.entityType || 'evento')}${event.entityId ? ` - ${escapeHtml(event.entityId)}` : ''}</small>
        <small>${escapeHtml(eventPayloadSummary(event))}</small>
      </article>
    `).join('');
    const snapshotRows = serverSnapshots.slice(0, 8).map((item) => `
      <article class="bf-history-item" data-admin-backend-snapshot="${escapeHtml(item.id || '')}">
        <span>${escapeHtml(snapshotTypeLabel(item.type))}</span>
        <strong>${escapeHtml(item.title || item.entityId || item.id || 'Snapshot')}</strong>
        <small>${escapeHtml(formatDate(item.updatedAt || item.createdAt))} - ${escapeHtml(item.ownerEmail || 'sem dono')}</small>
        <small>${escapeHtml(item.status || item.source || 'server-side')}</small>
        <small>${escapeHtml(eventPayloadSummary(item))}</small>
      </article>
    `).join('');
    const entityRows = serverEntities.slice(0, 8).map((item) => `
      <article class="bf-history-item" data-admin-backend-entity="${escapeHtml(`${item.kind || 'entity'}:${item.id || ''}`)}">
        <span>${escapeHtml(journeyEntityKindLabel(item.kind))} - ${escapeHtml(item.stage || item.snapshotType || 'jornada')}</span>
        <strong>${escapeHtml(item.title || item.id || 'Entidade')}</strong>
        <small>${escapeHtml(formatDate(item.updatedAt || item.createdAt))} - ${escapeHtml(item.ownerEmail || 'sem dono')}</small>
        <small>${escapeHtml(item.status || 'ativo')} - prioridade ${escapeHtml(item.priority || 'media')}</small>
      </article>
    `).join('');
    const materializedRows = materializedRowsSource
      .sort((a, b) => String(b.updatedAt || '').localeCompare(String(a.updatedAt || '')))
      .slice(0, 8)
      .map((item) => `
        <article class="bf-history-item" data-admin-backend-materialized-item="${escapeHtml(`${item.kind || 'table'}:${item.id || ''}`)}" data-admin-backend-materialized-kind="${escapeHtml(item.kind || '')}" data-admin-backend-materialized-id="${escapeHtml(item.id || '')}">
          <span>${escapeHtml(journeyEntityKindLabel(item.kind))} materializado</span>
          <strong>${escapeHtml(item.title || item.id || 'Registro')}</strong>
          <small>${escapeHtml(formatDate(item.updatedAt || item.createdAt))} - ${escapeHtml(item.materializedTable || 'tabela dedicada')}</small>
          <small>${escapeHtml(item.status || 'ativo')} - ${escapeHtml(item.stage || 'sem etapa')} - ${escapeHtml(item.ownerEmail || 'sem dono')}</small>
          ${renderMaterializedControls(item)}
        </article>
      `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--navy">Banco local</span>
          <h2>Eventos server-side</h2>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-admin-backend-event-refresh>Atualizar</button>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Eventos no banco</small><strong>${Number(stats.events || list.length || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Usuarios SQLite</small><strong>${Number(stats.users || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Snapshots SQLite</small><strong>${Number(stats.snapshots || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Entidades SQLite</small><strong>${Number(stats.journeyEntities || entitySummary.total || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Leads</small><strong>${Number(entitySummary.lead || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Propostas</small><strong>${Number(entitySummary.proposal || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Simulacoes</small><strong>${Number(entitySummary.simulation || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Tabelas dedicadas</small><strong>${materializedRowsSource.length}</strong></article>
        <article class="bf-platform-metric"><small>Snapshots recentes</small><strong>${serverSnapshots.length}</strong></article>
        <article class="bf-platform-metric"><small>Tipos snapshots</small><strong>${snapshotTypes.size}</strong></article>
        <article class="bf-platform-metric"><small>Sessoes ativas</small><strong>${Number(stats.activeSessions || 0)}</strong></article>
        <article class="bf-platform-metric"><small>Fontes recentes</small><strong>${sources.size}</strong></article>
        <article class="bf-platform-metric"><small>Provider</small><strong>${escapeHtml(dbStatus.provider || 'sqlite')}</strong></article>
        <article class="bf-platform-metric"><small>Arquivo</small><strong>${escapeHtml(formatBytes(dbMainFile.sizeBytes))}</strong></article>
        <article class="bf-platform-metric"><small>Journal</small><strong>${escapeHtml(sqlite.journalMode || '-')}</strong></article>
        <article class="bf-platform-metric"><small>Integridade</small><strong>${escapeHtml(sqlite.quickCheck || '-')}</strong></article>
      </div>
      <div class="bf-admin-mini-grid">
        <div class="bf-calculator-history">${tableRows || '<div class="bf-empty-state">Tabelas ainda nao lidas pela API local.</div>'}</div>
        <div class="bf-calculator-history">${rows || '<div class="bf-empty-state">Nenhum evento server-side registrado ainda.</div>'}</div>
        <div class="bf-calculator-history" data-admin-backend-snapshots>${snapshotRows || '<div class="bf-empty-state">Nenhum snapshot server-side registrado ainda.</div>'}</div>
        <div class="bf-calculator-history" data-admin-backend-entities>${entityRows || '<div class="bf-empty-state">Nenhuma entidade relacional indexada ainda.</div>'}</div>
        <div class="bf-calculator-history" data-admin-backend-materialized>${materializedRows || '<div class="bf-empty-state">Nenhum registro materializado em tabela dedicada ainda.</div>'}</div>
      </div>
      ${renderLocalImportPanel(snapshot)}
    `;
    document.body.dataset.adminBackendEventsReady = 'true';
    document.body.dataset.adminBackendEventCount = String(list.length);
    document.body.dataset.adminBackendSnapshotCount = String(serverSnapshots.length);
    document.body.dataset.adminBackendEntityCount = String(serverEntities.length);
    document.body.dataset.adminBackendMaterializedCount = String(materializedRowsSource.length);
    document.body.dataset.adminBackendMaterializedEditable = 'true';
    document.body.dataset.adminBackendDatabaseProvider = dbStatus.provider || 'sqlite';
    target.dataset.adminBackendDatabaseProvider = dbStatus.provider || 'sqlite';
  }

  function renderBackendEventsError(target, result) {
    const status = result && result.status ? `HTTP ${result.status}` : 'Sem conexao';
    const message = result && result.message ? result.message : 'Nao foi possivel ler os eventos da API local.';
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--warning">Banco local</span>
          <h2>Eventos server-side</h2>
        </div>
        <button class="btn btn--ghost btn--sm" type="button" data-admin-backend-event-refresh>Atualizar</button>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-warn"><small>Status</small><strong>${escapeHtml(status)}</strong></article>
        <article class="bf-platform-metric"><small>Eventos</small><strong>0</strong></article>
        <article class="bf-platform-metric"><small>Acao</small><strong>Login API</strong></article>
      </div>
      <div class="bf-empty-state">
        <strong>${escapeHtml(message)}</strong>
        <p>Entre novamente pelo login em localhost para criar a sessao bf_backend_session_v1 e liberar /api/events.</p>
      </div>
    `;
    document.body.dataset.adminBackendEventsReady = 'error';
    document.body.dataset.adminBackendEventCount = '0';
  }

  async function renderBackendEvents() {
    const target = qs('[data-admin-backend-events]');
    if (!target) return;
    const api = backendApi();
    if (!api || typeof api.available !== 'function' || !api.available()) {
      renderBackendEventsUnavailable(
        target,
        'API local indisponivel neste modo.',
        'Em GitHub Pages ou file://, o painel preserva a experiencia estatica e usa apenas localStorage.'
      );
      return;
    }
    if (typeof api.listEvents !== 'function' || typeof api.health !== 'function') {
      renderBackendEventsUnavailable(target, 'Cliente da API local incompleto.', 'Atualize BFBackendApi antes de ler eventos server-side.');
      return;
    }

    renderBackendEventsLoading(target);
    const [health, eventResult, databaseStatus, snapshotResult, entityResult, leadResult, simulationResult, proposalResult] = await Promise.all([
      api.health(),
      api.listEvents(30),
      typeof api.databaseStatus === 'function' ? api.databaseStatus() : Promise.resolve(null),
      typeof api.listSnapshots === 'function' ? api.listSnapshots(30) : Promise.resolve({ ok: true, snapshots: [] }),
      typeof api.listJourneyEntities === 'function' ? api.listJourneyEntities(50) : Promise.resolve({ ok: true, entities: [], summary: {} }),
      typeof api.listLeads === 'function' ? api.listLeads(30) : Promise.resolve({ ok: true, leads: [] }),
      typeof api.listSimulations === 'function' ? api.listSimulations(30) : Promise.resolve({ ok: true, simulations: [] }),
      typeof api.listProposals === 'function' ? api.listProposals(30) : Promise.resolve({ ok: true, proposals: [] })
    ]);

    if (!eventResult || !eventResult.ok) {
      renderBackendEventsError(target, eventResult || health);
      return;
    }

    renderBackendEventsResult(
      target,
      health && health.ok ? health : null,
      eventResult.events || [],
      databaseStatus && databaseStatus.ok ? databaseStatus : null,
      snapshotResult && snapshotResult.ok ? snapshotResult.snapshots || [] : [],
      entityResult && entityResult.ok ? entityResult : { entities: [], summary: {} },
      {
        leads: leadResult && leadResult.ok ? leadResult.leads || [] : [],
        simulations: simulationResult && simulationResult.ok ? simulationResult.simulations || [] : [],
        proposals: proposalResult && proposalResult.ok ? proposalResult.proposals || [] : []
      }
    );
  }

  function renderComparatorAudit() {
    const target = qs('[data-admin-comparator-audit]');
    if (!target || !window.BFComparatorModels) return;
    const models = window.BFComparatorModels.all ? window.BFComparatorModels.all() : [];
    const audit = window.BFComparatorModels.audit ? window.BFComparatorModels.audit() : [];
    const versions = window.BFComparatorModels.versions || {};
    const rows = audit.slice(0, 6).map((event) => `
      <article class="bf-history-item" data-admin-comparator-audit-item>
        <span>${escapeHtml(actionLabel(event.action))}</span>
        <strong>${escapeHtml(event.modelName || event.modelId || 'Modelo')}</strong>
        <small>${escapeHtml(formatDate(event.createdAt))} - ${escapeHtml(event.actorEmail || 'anon')}</small>
        <small>${escapeHtml(event.formulaVersion || versions.formulaVersion || '-')} - ${escapeHtml(event.premiseReference || versions.premiseReference || '-')}</small>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--navy">Auditoria de modelos</span>
          <h2>Exportacao, importacao e versoes</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="comparador.html">Abrir comparador</a>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Modelos locais</small><strong>${models.length}</strong></article>
        <article class="bf-platform-metric"><small>Eventos</small><strong>${audit.length}</strong></article>
        <article class="bf-platform-metric"><small>Formula</small><strong>${escapeHtml(versions.formulaVersion || '-')}</strong></article>
        <article class="bf-platform-metric"><small>Premissas</small><strong>${escapeHtml(versions.premiseReference || '-')}</strong></article>
      </div>
      <div class="bf-calculator-history">${rows || '<div class="bf-empty-state">Nenhum evento de modelo registrado neste navegador.</div>'}</div>
    `;
  }

  function renderHandoffSummary() {
    const target = qs('[data-admin-handoff-summary]');
    const service = window.BFHandoffConsultivoService;
    if (!target || !service) return;
    const handoffs = service.list();
    const metrics = service.metrics(handoffs);
    const rows = handoffs.slice(0, 4).map((item) => `
      <article class="bf-history-item" data-admin-handoff-item="${escapeHtml(item.id)}">
        <span>${escapeHtml(service.sourceLabel ? service.sourceLabel(item) : service.statusLabels[item.status] || item.status)}</span>
        <strong>${escapeHtml(item.objectiveLabel || item.id)}</strong>
        <small>${escapeHtml(item.ownerEmail || 'anon')} - ${escapeHtml(item.summary && item.summary.productName ? item.summary.productName : '-')} - ${escapeHtml(item.priority || 'media')}</small>
        <a href="handoff-consultivo.html">Acompanhar lead</a>
      </article>
    `).join('');

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Handoff consultivo</span>
          <h2>Fila local de leads</h2>
        </div>
        <a class="btn btn--ghost btn--sm" href="handoff-consultivo.html">Abrir fila</a>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric is-strong"><small>Leads</small><strong>${metrics.total}</strong></article>
        <article class="bf-platform-metric"><small>Em aberto</small><strong>${metrics.open}</strong></article>
        <article class="bf-platform-metric${metrics.highPriority ? ' is-warn' : ''}"><small>Alta prioridade</small><strong>${metrics.highPriority}</strong></article>
        <article class="bf-platform-metric"><small>Propostas</small><strong>${metrics.proposal || 0}</strong></article>
        <article class="bf-platform-metric"><small>Trilhas</small><strong>${metrics.journey || 0}</strong></article>
        <article class="bf-platform-metric"><small>Checklist medio</small><strong>${metrics.completion}%</strong></article>
      </div>
      <div class="bf-calculator-history">${rows || '<div class="bf-empty-state">Nenhum handoff consultivo criado neste navegador.</div>'}</div>
    `;
  }

  function renderTable() {
    const target = qs('[data-users-table]');
    if (!target) return;
    const users = filteredUsers();

    if (users.length === 0) {
      target.innerHTML = '<tr><td colspan="6"><div class="bf-empty-state">Nenhum usuario encontrado para os filtros atuais.</div></td></tr>';
      return;
    }

    target.innerHTML = users.map((user) => `
      <tr>
        <td>
          <strong>${escapeHtml(user.name)}</strong>
          <small>${escapeHtml(user.email)}</small>
        </td>
        <td><span class="bf-role-pill">${escapeHtml(user.roleLabel)}</span></td>
        <td><span class="bf-status-pill bf-status-pill--${user.status}">${escapeHtml(user.statusLabel)}</span></td>
        <td>${escapeHtml(user.department || 'Sem area')}</td>
        <td>${escapeHtml(formatDate(user.lastLoginAt))}</td>
        <td>
          <div class="bf-inline-actions">
            <button class="btn btn--ghost btn--sm" type="button" data-user-action="edit" data-user-id="${user.id}">Editar</button>
            <button class="btn btn--ghost btn--sm" type="button" data-user-action="toggle" data-user-id="${user.id}">${user.status === 'active' ? 'Inativar' : 'Ativar'}</button>
            <button class="btn btn--ghost btn--sm" type="button" data-user-action="reset" data-user-id="${user.id}">Senha</button>
            <button class="btn btn--danger btn--sm" type="button" data-user-action="delete" data-user-id="${user.id}">Excluir</button>
          </div>
        </td>
      </tr>
    `).join('');
  }

  async function handleLocalImport(dryRun) {
    const api = backendApi();
    if (!api || typeof api.importLocalSnapshot !== 'function') {
      backendLocalImportState = {
        loading: false,
        result: { ok: false, message: 'BFBackendApi.importLocalSnapshot indisponivel neste runtime.' }
      };
      renderBackendEvents();
      return;
    }
    backendLocalImportState = { loading: true, result: null };
    renderBackendEvents();
    const snapshot = collectLocalImportSnapshot();
    const result = await api.importLocalSnapshot(snapshot, { dryRun });
    backendLocalImportState = { loading: false, result };
    setMessage(
      result && result.ok
        ? (result.dryRun ? 'Previsualizacao da migracao concluida.' : 'Migracao localStorage -> SQLite concluida.')
        : 'Nao foi possivel processar a migracao guiada.',
      result && result.ok ? 'success' : 'error'
    );
    renderBackendEvents();
  }

  async function handleMaterializedUpdate(button) {
    const row = button && button.closest ? button.closest('[data-admin-backend-materialized-item]') : null;
    if (!row) return;
    const kind = row.dataset.adminBackendMaterializedKind || '';
    const id = row.dataset.adminBackendMaterializedId || '';
    const method = materializedUpdateMethod(kind);
    const api = backendApi();
    if (!id || !method || !api || typeof api[method] !== 'function') {
      setMessage('Edicao direta indisponivel para este registro.', 'error');
      return;
    }
    const payload = {};
    row.querySelectorAll('[data-admin-backend-materialized-field]').forEach((field) => {
      payload[field.dataset.adminBackendMaterializedField] = field.value;
    });
    button.disabled = true;
    button.textContent = 'Salvando...';
    try {
      const result = await api[method](id, payload);
      if (!result || !result.ok) {
        setMessage(result && result.message ? result.message : 'Nao foi possivel atualizar a tabela dedicada.', 'error');
        return;
      }
      setMessage(`${journeyEntityKindLabel(kind)} ${id} atualizado no SQLite.`, 'success');
      renderBackendEvents();
    } catch (error) {
      setMessage('Falha ao atualizar registro dedicado no backend local.', 'error');
    } finally {
      button.disabled = false;
      button.textContent = 'Salvar';
    }
  }

  function renderAll() {
    renderCurrentUser();
    renderOperationalStrip();
    renderMetrics();
    renderJourneyFunnel();
    renderOperationalAlerts();
    renderAdminRecoveryQueue();
    renderAdminRecoveryPackages();
    renderHandoffSummary();
    renderComparatorAudit();
    renderBackendEvents();
    renderTable();
  }

  function setFormMode(user) {
    const form = qs('[data-user-form]');
    const title = qs('[data-user-form-title]');
    const submit = qs('[data-user-submit]');
    if (!form) return;

    editingId = user ? user.id : null;
    form.reset();
    form.elements.status.value = 'active';
    form.elements.role.value = 'cliente';

    if (user) {
      form.elements.name.value = user.name;
      form.elements.email.value = user.email;
      form.elements.role.value = user.role;
      form.elements.status.value = user.status;
      form.elements.department.value = user.department || '';
      form.elements.phone.value = user.phone || '';
      form.elements.password.value = '';
    }

    if (title) title.textContent = user ? 'Editar usuario' : 'Novo usuario';
    if (submit) submit.textContent = user ? 'Salvar alteracoes' : 'Criar usuario';
  }

  function bindForm() {
    const form = qs('[data-user-form]');
    if (!form) return;

    form.addEventListener('submit', (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(form).entries());
      const result = editingId
        ? window.BFAuth.updateUser(editingId, payload)
        : window.BFAuth.createUser(payload);

      setMessage(result.message, result.ok ? 'success' : 'error');
      if (result.ok) {
        setFormMode(null);
        renderAll();
      }
    });

    qs('[data-user-cancel]')?.addEventListener('click', () => {
      setFormMode(null);
      setMessage('Formulario limpo. Pronto para criar um novo usuario.', 'success');
    });
  }

  function bindFilters() {
    ['[data-user-search]', '[data-user-role-filter]', '[data-user-status-filter]'].forEach((selector) => {
      qs(selector)?.addEventListener('input', renderTable);
      qs(selector)?.addEventListener('change', renderTable);
    });
  }

  function bindActions() {
    qs('[data-users-table]')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-user-action]');
      if (!button) return;
      const userId = button.dataset.userId;
      const action = button.dataset.userAction;
      const user = allUsers().find((item) => item.id === userId);

      if (action === 'edit' && user) {
        setFormMode(user);
        setMessage(`Editando ${user.name}.`, 'success');
        return;
      }

      if (action === 'toggle') {
        const result = window.BFAuth.toggleStatus(userId);
        setMessage(result.message, result.ok ? 'success' : 'error');
        renderAll();
        return;
      }

      if (action === 'reset') {
        const nextPassword = window.prompt('Nova senha temporaria', window.BFAuth.DEFAULT_PASSWORD);
        if (nextPassword === null) return;
        const result = window.BFAuth.resetPassword(userId, nextPassword);
        setMessage(result.message, result.ok ? 'success' : 'error');
        renderAll();
        return;
      }

      if (action === 'delete') {
        if (!window.confirm('Remover este usuario da base local?')) return;
        const result = window.BFAuth.deleteUser(userId);
        setMessage(result.message, result.ok ? 'success' : 'error');
        renderAll();
      }
    });

    qs('[data-admin-backend-events]')?.addEventListener('click', (event) => {
      const refreshButton = event.target.closest('[data-admin-backend-event-refresh]');
      if (refreshButton) {
        setMessage('Atualizando eventos do banco local.', 'success');
        renderBackendEvents();
        return;
      }
      const materializedSave = event.target.closest('[data-admin-backend-materialized-save]');
      if (materializedSave) {
        handleMaterializedUpdate(materializedSave);
        return;
      }
      const previewButton = event.target.closest('[data-admin-local-import-preview]');
      if (previewButton) {
        handleLocalImport(true);
        return;
      }
      const runButton = event.target.closest('[data-admin-local-import-run]');
      if (runButton) {
        handleLocalImport(false);
      }
    });

    qs('[data-admin-journey-funnel]')?.addEventListener('click', (event) => {
      const commercialPipelineExportButton = event.target.closest('[data-admin-commercial-pipeline-export]');
      if (commercialPipelineExportButton) {
        downloadAdminCommercialPipeline();
        return;
      }
      const portfolioExportButton = event.target.closest('[data-admin-consultant-portfolio-export]');
      if (portfolioExportButton) {
        downloadAdminConsultantPortfolio();
        return;
      }
      const button = event.target.closest('[data-admin-action-status]');
      if (!button || !window.BFHandoffConsultivoService || !window.BFHandoffConsultivoService.setActionExecution) return;
      const row = button.closest('[data-admin-action-execution]');
      if (!row) return;
      const status = button.dataset.adminActionStatus;
      const reason = row.querySelector('[data-admin-action-reason]')?.value || '';
      const result = window.BFHandoffConsultivoService.setActionExecution({
        actionKey: row.dataset.adminActionExecution,
        title: row.dataset.adminActionTitle,
        owner: row.dataset.adminActionOwner,
        target: row.dataset.adminActionTarget,
        href: row.dataset.adminActionHref,
        source: 'Dashboard Admin'
      }, {
        status,
        reason,
        owner: row.dataset.adminActionOwner,
        postponedUntil: status === 'adiada' ? new Date(Date.now() + 86400000).toISOString() : ''
      });
      setMessage(result ? `Acao ${result.statusLabel.toLowerCase()} para ${result.owner || 'responsavel local'}.` : 'Nao foi possivel atualizar a acao.', result ? 'success' : 'error');
      renderAll();
    });

    qs('[data-admin-journey-funnel]')?.addEventListener('change', (event) => {
      const stageSelect = event.target.closest('[data-admin-commercial-stage-select]');
      if (stageSelect) {
        const result = setAdminCommercialStage(stageSelect.dataset.adminCommercialStageSelect, stageSelect.value);
        setMessage(
          result ? `Lead ${result.id} movido para ${adminCommercialStageLabel(stageSelect.value)}.` : 'Nao foi possivel mover o lead no funil comercial.',
          result ? 'success' : 'error'
        );
        renderAll();
        return;
      }
      if (!event.target.closest('[data-admin-portfolio-filter]')) return;
      renderJourneyFunnel();
    });

    qs('[data-admin-recovery-queue]')?.addEventListener('click', (event) => {
      const exportButton = event.target.closest('[data-admin-recovery-export]');
      if (exportButton) {
        downloadAdminRecoveryPackage();
        return;
      }
      const button = event.target.closest('[data-admin-create-recovery-handoff]');
      if (!button || !window.BFHandoffConsultivoService || !window.BFAdminRecoveryService) return;
      const item = window.BFAdminRecoveryService.find(button.dataset.adminCreateRecoveryHandoff, { includeCreated: true });
      if (!item || !item.signal) return;
      const handoff = window.BFHandoffConsultivoService.createFromSignal(item.signal, {
        assignedTo: button.dataset.adminSuggestedAssignee || item.suggestedAssigneeEmail || '',
        ownerName: item.ownerEmail
      });
      setMessage(handoff ? `Handoff ${handoff.id} criado para ${item.ownerEmail}.` : 'Nao foi possivel criar o handoff.', handoff ? 'success' : 'error');
      renderAll();
    });

    qs('[data-admin-recovery-queue]')?.addEventListener('change', (event) => {
      if (!event.target.closest('[data-admin-recovery-filter]')) return;
      renderAdminRecoveryQueue();
    });

    qs('[data-admin-recovery-packages]')?.addEventListener('click', (event) => {
      const routeButton = event.target.closest('[data-admin-package-route]');
      if (routeButton && window.BFAdminRecoveryService) {
        const result = window.BFAdminRecoveryService.routeImportedItems({
          users: allUsers(),
          strategy: 'suggested-balanced',
          routeName: `Carteira ${new Date().toISOString().slice(0, 10)}`
        });
        setMessage(result.ok ? `${result.routed} item${result.routed === 1 ? '' : 's'} roteado${result.routed === 1 ? '' : 's'} para ${result.consultants} consultor${result.consultants === 1 ? '' : 'es'}.` : result.message, result.ok ? 'success' : 'error');
        renderAll();
        return;
      }

      const goalButton = event.target.closest('[data-admin-package-save-goal]');
      if (goalButton && window.BFAdminRecoveryService) {
        const row = goalButton.closest('[data-admin-package-goal-consultant]');
        const assignedTo = row ? row.dataset.adminPackageGoalConsultant : '';
        const target = row ? row.querySelector('[data-admin-package-goal-input]')?.value : '';
        const result = window.BFAdminRecoveryService.saveConversionGoal(assignedTo, target);
        setMessage(result.ok ? `Meta salva para ${assignedTo}.` : result.message, result.ok ? 'success' : 'error');
        renderAdminRecoveryPackages();
        return;
      }

      const assignButton = event.target.closest('[data-admin-package-assign]');
      const handoffButton = event.target.closest('[data-admin-package-handoff]');
      const button = assignButton || handoffButton;
      if (!button || !window.BFAdminRecoveryService) return;
      const row = button.closest('[data-admin-recovery-package-item]');
      if (!row) return;
      const packageId = row.dataset.adminRecoveryPackageId;
      const itemId = row.dataset.adminRecoveryPackageItemId;
      const assignedTo = row.querySelector('[data-admin-package-assignee]')?.value || '';

      if (assignButton) {
        const result = window.BFAdminRecoveryService.assignImportedItem(packageId, itemId, assignedTo);
        setMessage(result.ok ? `Item atribuido para ${result.item.assignedTo}.` : result.message, result.ok ? 'success' : 'error');
        renderAdminRecoveryPackages();
        return;
      }

      const result = window.BFAdminRecoveryService.createHandoffFromImportedItem(packageId, itemId, { assignedTo });
      setMessage(result.ok ? `Handoff ${result.handoff.id} criado a partir do pacote.` : result.message, result.ok ? 'success' : 'error');
      renderAll();
    });

    qs('[data-admin-recovery-packages]')?.addEventListener('input', (event) => {
      if (!event.target.closest('[data-admin-package-filter]')) return;
      renderAdminRecoveryPackages();
    });

    qs('[data-admin-recovery-packages]')?.addEventListener('change', (event) => {
      if (!event.target.closest('[data-admin-package-filter]')) return;
      renderAdminRecoveryPackages();
    });

    qs('[data-admin-recovery-packages]')?.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-admin-recovery-import-form]');
      if (!form || !window.BFAdminRecoveryService) return;
      event.preventDefault();
      const data = Object.fromEntries(new FormData(form).entries());
      const result = window.BFAdminRecoveryService.importPackage(data.packageJson || '', {
        label: data.label || '',
        source: data.source || 'manual'
      });
      setMessage(result.ok
        ? (result.duplicate ? 'Pacote ja importado; auditoria registrada.' : `Pacote importado com ${result.package.itemCount} item${result.package.itemCount === 1 ? '' : 's'}.`)
        : result.message,
      result.ok ? 'success' : 'error');
      if (result.ok) form.reset();
      renderAdminRecoveryPackages();
    });
  }

  document.addEventListener('DOMContentLoaded', function () {
    const user = window.BFAuth.requireRole(['admin'], { redirect: true });
    if (!user) return;
    bindForm();
    bindFilters();
    bindActions();
    setFormMode(null);
    renderAll();
  });
})();
