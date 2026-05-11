(function () {
  'use strict';

  let editingId = null;

  function qs(selector) {
    return document.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || '')
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
        next: 'Criar handoff da proposta',
        href: 'simulador.html#step-9',
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
        next: 'Criar handoff da proposta',
        href: 'simulador.html#step-9',
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
        next: 'Revisar validade',
        href: 'simulador.html#step-9',
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
          next: 'Atualizar handoff',
          href: 'handoff-consultivo.html#fila-handoff',
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
        next: 'Atribuir consultor',
        href: 'handoff-consultivo.html#fila-handoff',
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
          next: 'Priorizar atendimento',
          href: 'handoff-consultivo.html#fila-handoff',
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
          <a class="btn btn--ghost btn--sm" href="#admin-gargalos">Ver gargalos</a>
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
  }

  function actionLabel(action) {
    const labels = {
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
