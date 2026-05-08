(function () {
  'use strict';

  const EXPORT_SCHEMA = 'bank-fratern.admin-recovery-export.v1';
  const IMPORTS_KEY = 'bf_admin_recovery_imports_v1';
  const AUDIT_KEY = 'bf_admin_recovery_audit_v1';
  const GOALS_KEY = 'bf_admin_recovery_conversion_goals_v1';
  const MAX_IMPORTS = 30;
  const MAX_AUDIT = 120;
  const MAX_GOALS = 60;

  function safeList(value) {
    return Array.isArray(value) ? value : [];
  }

  function safeStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
      return null;
    }
  }

  function readJson(key, fallback) {
    const storage = safeStorage();
    if (!storage) return fallback;
    try {
      const parsed = JSON.parse(storage.getItem(key) || 'null');
      return parsed === null ? fallback : parsed;
    } catch (error) {
      return fallback;
    }
  }

  function writeJson(key, value) {
    const storage = safeStorage();
    if (!storage) return false;
    storage.setItem(key, JSON.stringify(value));
    return true;
  }

  function nowIso() {
    return new Date().toISOString();
  }

  function users() {
    return window.BFAuth && window.BFAuth.listUsers ? window.BFAuth.listUsers() : [];
  }

  function recoverySignals(options = {}) {
    const service = window.BFJourneyRecoveryService;
    return service && service.list ? service.list({ includeComplete: true, ...options }) : [];
  }

  function handoffs() {
    const service = window.BFHandoffConsultivoService;
    return service && service.list ? service.list() : [];
  }

  function activeUsersByRole(role, source = users()) {
    return safeList(source)
      .filter((user) => user && user.status === 'active' && (!role || user.role === role))
      .sort((a, b) => String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'pt-BR'));
  }

  function consultantPool(source = users()) {
    const consultants = activeUsersByRole('consultor', source);
    if (consultants.length) return consultants;
    const admins = activeUsersByRole('admin', source);
    if (admins.length) return admins;
    return activeUsersByRole('', source);
  }

  function hash(value) {
    const text = String(value || 'anon');
    let output = 0;
    for (let index = 0; index < text.length; index += 1) {
      output = ((output << 5) - output) + text.charCodeAt(index);
      output |= 0;
    }
    return Math.abs(output);
  }

  function suggestedAssignee(signal, sourceUsers = users()) {
    const pool = consultantPool(sourceUsers);
    if (!pool.length) return null;
    const seed = `${signal && signal.ownerEmail ? signal.ownerEmail : 'anon'}:${signal && signal.stage ? signal.stage : ''}:${signal && signal.type ? signal.type : ''}`;
    return pool[hash(seed) % pool.length] || pool[0];
  }

  function findExistingHandoff(signal, sourceHandoffs = handoffs()) {
    return safeList(sourceHandoffs).find((item) => item && signal && item.sourceSignalId === signal.id && item.ownerEmail === signal.ownerEmail) || null;
  }

  function severityLabel(value) {
    const labels = {
      alta: 'Alta',
      media: 'Media',
      baixa: 'Baixa'
    };
    return labels[value] || 'Baixa';
  }

  function stageLabel(value) {
    const labels = {
      selected: 'Produtos',
      compare: 'Comparador',
      decision: 'Decisao',
      saved: 'Cenario salvo',
      simulator: 'Simulador',
      complete: 'Pronto'
    };
    return labels[value] || 'Jornada';
  }

  function statusFor(signal, existing) {
    if (existing) return 'handoff-criado';
    if (signal && signal.type === 'simulator-ready') return 'pronto-para-handoff';
    return 'retomada-pendente';
  }

  function actionLabel(status) {
    const labels = {
      'handoff-criado': 'Abrir handoff',
      'pronto-para-handoff': 'Criar handoff',
      'retomada-pendente': 'Criar handoff'
    };
    return labels[status] || 'Abrir';
  }

  function buildItem(signal, sourceUsers = users(), sourceHandoffs = handoffs()) {
    const assignee = suggestedAssignee(signal, sourceUsers);
    const existing = findExistingHandoff(signal, sourceHandoffs);
    const queueStatus = statusFor(signal, existing);
    return {
      id: signal.id,
      signal,
      type: signal.type,
      title: signal.title,
      reason: signal.reason,
      ownerEmail: signal.ownerEmail || 'anon',
      stage: signal.stage || '',
      stageLabel: stageLabel(signal.stage),
      severity: signal.severity || 'baixa',
      severityLabel: severityLabel(signal.severity),
      priority: signal.priority || signal.severity || 'baixa',
      hours: Number(signal.hours || 0),
      age: signal.age || '',
      ctaLabel: signal.ctaLabel || 'Abrir',
      ctaHref: signal.ctaHref || 'dashboard-cliente.html',
      productIds: signal.productIds || [],
      readyForHandoff: signal.readyForHandoff === true,
      queueStatus,
      actionLabel: actionLabel(queueStatus),
      suggestedAssigneeEmail: assignee ? assignee.email : '',
      suggestedAssigneeName: assignee ? assignee.name : '',
      suggestedAssigneeRole: assignee ? assignee.roleLabel || assignee.role || '' : '',
      existingHandoffId: existing ? existing.id : '',
      existingHandoffStatus: existing ? existing.status : '',
      existingHandoffPriority: existing ? existing.priority : ''
    };
  }

  function normalizeFilter(value) {
    return String(value || '').trim().toLowerCase();
  }

  function itemMatchesFilters(item, filters = {}) {
    const assignee = normalizeFilter(filters.assigneeEmail);
    const status = normalizeFilter(filters.queueStatus);
    const severity = normalizeFilter(filters.severity);
    const stage = normalizeFilter(filters.stage);
    const search = normalizeFilter(filters.search);

    if (assignee && normalizeFilter(item.suggestedAssigneeEmail) !== assignee) return false;
    if (status && normalizeFilter(item.queueStatus) !== status) return false;
    if (severity && normalizeFilter(item.severity) !== severity) return false;
    if (stage && normalizeFilter(item.stage) !== stage) return false;
    if (search) {
      const haystack = [
        item.title,
        item.reason,
        item.ownerEmail,
        item.stageLabel,
        item.severityLabel,
        item.suggestedAssigneeEmail,
        item.suggestedAssigneeName,
        item.existingHandoffId,
        item.productIds && item.productIds.join(' ')
      ].join(' ').toLowerCase();
      if (!haystack.includes(search)) return false;
    }
    return true;
  }

  function statusWeight(status) {
    const weights = {
      'retomada-pendente': 3,
      'pronto-para-handoff': 2,
      'handoff-criado': 1,
      recebido: 3,
      atribuido: 2
    };
    return weights[status] || 0;
  }

  function severityWeight(severity) {
    const weights = {
      alta: 3,
      media: 2,
      baixa: 1
    };
    return weights[severity] || 0;
  }

  function list(options = {}) {
    const sourceUsers = options.users || users();
    const sourceHandoffs = options.handoffs || handoffs();
    const sourceSignals = options.signals || recoverySignals({ includeComplete: true });
    return safeList(sourceSignals)
      .filter((signal) => options.includeCreated === true || !findExistingHandoff(signal, sourceHandoffs))
      .map((signal) => buildItem(signal, sourceUsers, sourceHandoffs))
      .filter((item) => itemMatchesFilters(item, options.filters || options))
      .sort((a, b) => {
        const byStatus = statusWeight(b.queueStatus) - statusWeight(a.queueStatus);
        if (byStatus) return byStatus;
        const bySeverity = severityWeight(b.severity) - severityWeight(a.severity);
        if (bySeverity) return bySeverity;
        return Number(b.hours || 0) - Number(a.hours || 0);
      });
  }

  function summary(items = list({ includeCreated: true }), sourceUsers = users()) {
    const source = safeList(items);
    const open = source.filter((item) => item.queueStatus !== 'handoff-criado').length;
    const existing = source.filter((item) => item.queueStatus === 'handoff-criado').length;
    return {
      total: source.length,
      open,
      existingHandoffs: existing,
      high: source.filter((item) => item.severity === 'alta').length,
      readyForHandoff: source.filter((item) => item.readyForHandoff).length,
      consultants: consultantPool(sourceUsers).length,
      owners: new Set(source.map((item) => item.ownerEmail || 'anon')).size,
      top: source[0] || null
    };
  }

  function find(id, options = {}) {
    return list({ includeCreated: true, ...options }).find((item) => item.id === id) || null;
  }

  function currentActor() {
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return {
      email: user && user.email ? user.email : 'anon',
      name: user && user.name ? user.name : 'Usuario local',
      role: user && user.role ? user.role : 'anon'
    };
  }

  function packageHash(value) {
    const text = typeof value === 'string' ? value : JSON.stringify(value || {});
    let output = 2166136261;
    for (let index = 0; index < text.length; index += 1) {
      output ^= text.charCodeAt(index);
      output = Math.imul(output, 16777619);
    }
    return (output >>> 0).toString(16).padStart(8, '0');
  }

  function audit() {
    const parsed = readJson(AUDIT_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function recordAudit(action, payload = {}) {
    const actor = currentActor();
    const event = {
      id: `REC-AUD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      action,
      actorEmail: actor.email,
      actorRole: actor.role,
      packageId: payload.packageId || '',
      packageHash: payload.packageHash || '',
      itemCount: Number(payload.itemCount || 0),
      details: payload.details || {},
      createdAt: nowIso()
    };
    writeJson(AUDIT_KEY, [event].concat(audit()).slice(0, MAX_AUDIT));
    return event;
  }

  function importedPackages() {
    const parsed = readJson(IMPORTS_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveImportedPackages(packages) {
    return writeJson(IMPORTS_KEY, safeList(packages).slice(0, MAX_IMPORTS));
  }

  function statusLabel(value) {
    const labels = {
      recebido: 'Recebido',
      atribuido: 'Atribuido',
      'handoff-criado': 'Handoff criado'
    };
    return labels[value] || labels.recebido;
  }

  function hoursSince(value) {
    if (!value) return 0;
    const timestamp = new Date(value).getTime();
    if (!Number.isFinite(timestamp)) return 0;
    return Math.max(0, (Date.now() - timestamp) / 36e5);
  }

  function ageLabel(hours) {
    const value = Number(hours || 0);
    if (value < 1) return 'menos de 1h';
    if (value < 24) return `${Math.round(value)}h`;
    const days = Math.floor(value / 24);
    const rest = Math.round(value % 24);
    return rest > 0 ? `${days}d ${rest}h` : `${days}d`;
  }

  function importedItemSlaHours(item) {
    const severity = item && (item.priority || item.severity);
    const rules = {
      alta: 4,
      media: 24,
      baixa: 72
    };
    return rules[severity] || rules.media;
  }

  function importedItemSla(item) {
    const status = operationalStatusFor(item);
    const hours = hoursSince(item && (item.importedAt || item.updatedAt));
    const limit = importedItemSlaHours(item);
    const remaining = Math.ceil(limit - hours);
    const complete = status === 'handoff-criado';
    const overdue = !complete && hours >= limit;
    const dueSoon = !complete && !overdue && remaining <= 4;
    return {
      ageHours: Math.round(hours),
      ageLabel: ageLabel(hours),
      limitHours: limit,
      remainingHours: complete ? 0 : remaining,
      overdue,
      dueSoon,
      label: complete ? 'Concluido' : (overdue ? `Vencido ha ${ageLabel(Math.abs(remaining))}` : `Vence em ${Math.max(0, remaining)}h`),
      tone: complete ? 'stable' : (overdue ? 'danger' : (dueSoon ? 'warning' : 'stable'))
    };
  }

  function sanitizeText(value, fallback = '') {
    return String(value || fallback || '').trim().slice(0, 280);
  }

  function sanitizeExportItem(item) {
    const source = item && typeof item === 'object' ? item : {};
    return {
      id: sanitizeText(source.id),
      type: sanitizeText(source.type),
      title: sanitizeText(source.title),
      reason: sanitizeText(source.reason),
      ownerEmail: sanitizeText(source.ownerEmail || 'anon'),
      stage: sanitizeText(source.stage),
      stageLabel: sanitizeText(source.stageLabel),
      severity: sanitizeText(source.severity || 'baixa'),
      severityLabel: sanitizeText(source.severityLabel),
      priority: sanitizeText(source.priority || source.severity || 'baixa'),
      hours: Number(source.hours || 0),
      age: sanitizeText(source.age),
      queueStatus: sanitizeText(source.queueStatus),
      readyForHandoff: source.readyForHandoff === true,
      suggestedAssigneeEmail: sanitizeText(source.suggestedAssigneeEmail),
      suggestedAssigneeName: sanitizeText(source.suggestedAssigneeName),
      suggestedAssigneeRole: sanitizeText(source.suggestedAssigneeRole),
      existingHandoffId: sanitizeText(source.existingHandoffId),
      existingHandoffStatus: sanitizeText(source.existingHandoffStatus),
      ctaLabel: sanitizeText(source.ctaLabel),
      ctaHref: sanitizeText(source.ctaHref),
      productIds: safeList(source.productIds).map((id) => sanitizeText(id)).filter(Boolean).slice(0, 8)
    };
  }

  function operationalStatusFor(item) {
    if (item && item.operationalStatus) return sanitizeText(item.operationalStatus);
    if (item && (item.handoffId || item.existingHandoffId)) return 'handoff-criado';
    if (item && item.assignedTo) return 'atribuido';
    return 'recebido';
  }

  function enrichImportedItem(item, packageMeta) {
    const source = item && typeof item === 'object' ? item : {};
    const base = sanitizeExportItem(source);
    const status = operationalStatusFor(source);
    const enriched = {
      ...base,
      packageId: packageMeta.id || '',
      packageLabel: packageMeta.label || '',
      packageSource: packageMeta.source || '',
      packageHash: packageMeta.packageHash || '',
      importedAt: packageMeta.importedAt || '',
      assignedTo: sanitizeText(source.assignedTo || base.suggestedAssigneeEmail),
      operationalStatus: status,
      operationalStatusLabel: statusLabel(status),
      handoffId: sanitizeText(source.handoffId || base.existingHandoffId),
      handledAt: sanitizeText(source.handledAt),
      updatedAt: sanitizeText(source.updatedAt),
      routeName: sanitizeText(source.routeName),
      routeStrategy: sanitizeText(source.routeStrategy),
      routedAt: sanitizeText(source.routedAt),
      conversionGoalId: sanitizeText(source.conversionGoalId)
    };
    const sla = importedItemSla(enriched);
    return {
      ...enriched,
      slaAgeHours: sla.ageHours,
      slaAgeLabel: sla.ageLabel,
      slaLimitHours: sla.limitHours,
      slaRemainingHours: sla.remainingHours,
      slaOverdue: sla.overdue,
      slaDueSoon: sla.dueSoon,
      slaLabel: sla.label,
      slaTone: sla.tone
    };
  }

  function importedItems(options = {}) {
    const filters = options.filters || options || {};
    const status = normalizeFilter(filters.operationalStatus || filters.status);
    const assignee = normalizeFilter(filters.assignedTo || filters.assigneeEmail);
    const severity = normalizeFilter(filters.severity);
    const sla = normalizeFilter(filters.sla);
    const packageId = normalizeFilter(filters.packageId);
    const search = normalizeFilter(filters.search);
    return importedPackages()
      .flatMap((packageMeta) => safeList(packageMeta.items).map((item) => enrichImportedItem(item, packageMeta)))
      .filter((item) => {
        if (status && normalizeFilter(item.operationalStatus) !== status) return false;
        if (assignee && normalizeFilter(item.assignedTo) !== assignee) return false;
        if (severity && normalizeFilter(item.severity) !== severity) return false;
        if (packageId && normalizeFilter(item.packageId) !== packageId) return false;
        if (sla === 'vencido' && item.slaOverdue !== true) return false;
        if (sla === 'no-prazo' && (item.slaOverdue === true || item.operationalStatus === 'handoff-criado')) return false;
        if (sla === 'concluido' && item.operationalStatus !== 'handoff-criado') return false;
        if (search) {
          const haystack = [
            item.title,
            item.reason,
            item.ownerEmail,
            item.stageLabel,
            item.severityLabel,
            item.assignedTo,
            item.packageLabel,
            item.packageSource,
            item.handoffId,
            item.productIds && item.productIds.join(' ')
          ].join(' ').toLowerCase();
          if (!haystack.includes(search)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        const bySla = Number(b.slaOverdue === true) - Number(a.slaOverdue === true);
        if (bySla) return bySla;
        const byStatus = statusWeight(b.operationalStatus) - statusWeight(a.operationalStatus);
        if (byStatus) return byStatus;
        const bySeverity = severityWeight(b.severity) - severityWeight(a.severity);
        if (bySeverity) return bySeverity;
        return String(b.importedAt || '').localeCompare(String(a.importedAt || ''));
      });
  }

  function importedItemsSummary(items = importedItems()) {
    const source = safeList(items);
    return {
      total: source.length,
      pending: source.filter((item) => item.operationalStatus !== 'handoff-criado').length,
      received: source.filter((item) => item.operationalStatus === 'recebido').length,
      assigned: source.filter((item) => item.operationalStatus === 'atribuido').length,
      handoffs: source.filter((item) => item.operationalStatus === 'handoff-criado').length,
      overdue: source.filter((item) => item.slaOverdue === true).length,
      dueSoon: source.filter((item) => item.slaDueSoon === true).length,
      high: source.filter((item) => item.severity === 'alta').length,
      owners: new Set(source.map((item) => item.ownerEmail || 'anon')).size,
      packages: new Set(source.map((item) => item.packageId).filter(Boolean)).size,
      top: source[0] || null
    };
  }

  function patchImportedItem(packageId, itemId, patch = {}, action = 'import-item-update') {
    const now = nowIso();
    let updatedPackage = null;
    let updatedItem = null;
    const nextPackages = importedPackages().map((packageMeta) => {
      if (packageMeta.id !== packageId) return packageMeta;
      const nextItems = safeList(packageMeta.items).map((item) => {
        if (!item || item.id !== itemId) return item;
        updatedItem = {
          ...item,
          assignedTo: sanitizeText(patch.assignedTo || item.assignedTo),
          operationalStatus: sanitizeText(patch.operationalStatus || item.operationalStatus || 'recebido'),
          handoffId: sanitizeText(patch.handoffId || item.handoffId),
          handledAt: sanitizeText(patch.handledAt || item.handledAt),
          routeName: sanitizeText(patch.routeName || item.routeName),
          routeStrategy: sanitizeText(patch.routeStrategy || item.routeStrategy),
          routedAt: sanitizeText(patch.routedAt || item.routedAt),
          conversionGoalId: sanitizeText(patch.conversionGoalId || item.conversionGoalId),
          updatedAt: now
        };
        return updatedItem;
      });
      updatedPackage = { ...packageMeta, items: nextItems, updatedAt: now };
      return updatedPackage;
    });

    if (!updatedPackage || !updatedItem) return { ok: false, message: 'Item importado nao encontrado.' };
    saveImportedPackages(nextPackages);
    const item = enrichImportedItem(updatedItem, updatedPackage);
    const auditEvent = recordAudit(action, {
      packageId: updatedPackage.id,
      packageHash: updatedPackage.packageHash,
      itemCount: 1,
      details: {
        itemId,
        ownerEmail: item.ownerEmail,
        assignedTo: item.assignedTo,
        handoffId: item.handoffId,
        operationalStatus: item.operationalStatus
      }
    });
    return { ok: true, item, package: updatedPackage, auditEvent };
  }

  function conversionGoals() {
    const parsed = readJson(GOALS_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveConversionGoals(goals) {
    return writeJson(GOALS_KEY, safeList(goals).slice(0, MAX_GOALS));
  }

  function findConversionGoal(email) {
    const normalized = normalizeFilter(email);
    return conversionGoals().find((goal) => normalizeFilter(goal.assignedTo) === normalized) || null;
  }

  function saveConversionGoal(assignedTo, targetHandoffs, options = {}) {
    const email = sanitizeText(assignedTo);
    const target = Math.max(0, Math.round(Number(targetHandoffs || 0)));
    if (!email) return { ok: false, message: 'Informe um responsavel para meta de conversao.' };
    const actor = currentActor();
    const existing = findConversionGoal(email);
    const goal = {
      id: existing && existing.id ? existing.id : `REC-GOAL-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      assignedTo: email,
      targetHandoffs: target,
      label: sanitizeText(options.label || (existing && existing.label) || email),
      source: sanitizeText(options.source || 'admin'),
      updatedAt: nowIso(),
      updatedBy: actor.email
    };
    const next = [goal].concat(conversionGoals().filter((item) => normalizeFilter(item.assignedTo) !== normalizeFilter(email)));
    saveConversionGoals(next);
    const auditEvent = recordAudit('conversion-goal-save', {
      itemCount: target,
      details: { assignedTo: email, targetHandoffs: target }
    });
    return { ok: true, goal, auditEvent };
  }

  function activeConsultantMap(sourceUsers = users()) {
    return new Map(consultantPool(sourceUsers).map((user) => [normalizeFilter(user.email), user]));
  }

  function routeForItem(item, pool, counts, options = {}) {
    if (!pool.length) return '';
    const strategy = options.strategy || 'suggested-balanced';
    const current = normalizeFilter(item.assignedTo || item.suggestedAssigneeEmail);
    if (strategy !== 'rebalance' && current && pool.some((user) => normalizeFilter(user.email) === current)) {
      return pool.find((user) => normalizeFilter(user.email) === current).email;
    }
    const sorted = pool.slice().sort((a, b) => {
      const countA = counts.get(normalizeFilter(a.email)) || 0;
      const countB = counts.get(normalizeFilter(b.email)) || 0;
      if (countA !== countB) return countA - countB;
      return String(a.name || a.email || '').localeCompare(String(b.name || b.email || ''), 'pt-BR');
    });
    return sorted[0] ? sorted[0].email : '';
  }

  function routeImportedItems(options = {}) {
    const sourceUsers = options.users || users();
    const pool = consultantPool(sourceUsers);
    if (!pool.length) return { ok: false, message: 'Nenhum consultor ativo disponivel para roteamento.', routed: 0, items: [] };
    const strategy = sanitizeText(options.strategy || 'suggested-balanced');
    const routeName = sanitizeText(options.routeName || `Carteira ${nowIso().slice(0, 10)}`);
    const items = importedItems(options.filters || {})
      .filter((item) => item.operationalStatus !== 'handoff-criado')
      .sort((a, b) => {
        const bySla = Number(b.slaOverdue === true) - Number(a.slaOverdue === true);
        if (bySla) return bySla;
        const bySeverity = severityWeight(b.severity) - severityWeight(a.severity);
        if (bySeverity) return bySeverity;
        return Number(b.slaAgeHours || 0) - Number(a.slaAgeHours || 0);
      });
    const counts = new Map(pool.map((user) => [normalizeFilter(user.email), 0]));
    const routed = [];

    for (const item of items) {
      const assignedTo = routeForItem(item, pool, counts, { strategy });
      if (!assignedTo) continue;
      const key = normalizeFilter(assignedTo);
      counts.set(key, (counts.get(key) || 0) + 1);
      const goal = findConversionGoal(assignedTo);
      const result = patchImportedItem(item.packageId, item.id, {
        assignedTo,
        operationalStatus: 'atribuido',
        routeName,
        routeStrategy: strategy,
        routedAt: nowIso(),
        conversionGoalId: goal && goal.id ? goal.id : ''
      }, 'import-item-route');
      if (result.ok) routed.push(result.item);
    }

    recordAudit('import-routing-run', {
      itemCount: routed.length,
      details: { routeName, strategy, consultants: pool.length }
    });
    return { ok: true, routeName, strategy, routed: routed.length, consultants: pool.length, items: routed };
  }

  function conversionScoreboard(options = {}) {
    const sourceUsers = options.users || users();
    const pool = consultantPool(sourceUsers);
    const userMap = activeConsultantMap(sourceUsers);
    const sourceItems = options.items || importedItems(options.filters || {});
    const goals = conversionGoals();
    const emails = new Set(pool.map((user) => normalizeFilter(user.email)));
    sourceItems.forEach((item) => {
      if (item.assignedTo) emails.add(normalizeFilter(item.assignedTo));
    });

    const consultants = Array.from(emails).filter(Boolean).map((key) => {
      const user = userMap.get(key) || { email: key, name: key, roleLabel: 'Responsavel' };
      const items = sourceItems.filter((item) => normalizeFilter(item.assignedTo) === key);
      const goal = goals.find((entry) => normalizeFilter(entry.assignedTo) === key) || null;
      const handoffs = items.filter((item) => item.operationalStatus === 'handoff-criado').length;
      const pending = items.filter((item) => item.operationalStatus !== 'handoff-criado').length;
      const overdue = items.filter((item) => item.slaOverdue === true).length;
      const targetHandoffs = goal ? Number(goal.targetHandoffs || 0) : Math.max(1, Math.ceil(items.length * 0.4));
      const progress = targetHandoffs > 0 ? Math.min(100, Math.round((handoffs / targetHandoffs) * 100)) : 100;
      return {
        assignedTo: user.email,
        name: user.name || user.email,
        roleLabel: user.roleLabel || user.role || 'Responsavel',
        total: items.length,
        pending,
        handoffs,
        overdue,
        high: items.filter((item) => item.severity === 'alta').length,
        routed: items.filter((item) => item.routeName).length,
        targetHandoffs,
        progress,
        conversionRate: items.length ? Math.round((handoffs / items.length) * 100) : 0,
        goalGap: Math.max(0, targetHandoffs - handoffs),
        goalId: goal && goal.id ? goal.id : ''
      };
    }).sort((a, b) => {
      const byOverdue = b.overdue - a.overdue;
      if (byOverdue) return byOverdue;
      const byPending = b.pending - a.pending;
      if (byPending) return byPending;
      return String(a.name || a.assignedTo).localeCompare(String(b.name || b.assignedTo), 'pt-BR');
    });

    const totalTarget = consultants.reduce((sum, item) => sum + Number(item.targetHandoffs || 0), 0);
    const totalHandoffs = consultants.reduce((sum, item) => sum + Number(item.handoffs || 0), 0);
    return {
      totalItems: sourceItems.length,
      consultants,
      totalTarget,
      totalHandoffs,
      progress: totalTarget > 0 ? Math.min(100, Math.round((totalHandoffs / totalTarget) * 100)) : 100,
      routed: sourceItems.filter((item) => item.routeName).length,
      pending: sourceItems.filter((item) => item.operationalStatus !== 'handoff-criado').length,
      overdue: sourceItems.filter((item) => item.slaOverdue === true).length
    };
  }

  function assignImportedItem(packageId, itemId, assignedTo) {
    const value = sanitizeText(assignedTo);
    if (!value) return { ok: false, message: 'Informe um responsavel para atribuir o item.' };
    return patchImportedItem(packageId, itemId, {
      assignedTo: value,
      operationalStatus: 'atribuido'
    }, 'import-item-assign');
  }

  function importedItemToSignal(item) {
    return {
      id: item.id,
      type: item.type || 'imported-recovery-item',
      title: item.title || 'Retomada importada',
      reason: item.reason || 'Item recebido por pacote administrativo de recuperacao.',
      ownerEmail: item.ownerEmail || 'anon',
      stage: item.stage || '',
      severity: item.severity || 'media',
      priority: item.priority || item.severity || 'media',
      ctaLabel: item.ctaLabel || 'Retomar jornada',
      ctaHref: item.ctaHref || 'dashboard-cliente.html',
      productIds: item.productIds || [],
      latestEventAt: item.importedAt || nowIso()
    };
  }

  function createHandoffFromImportedItem(packageId, itemId, options = {}) {
    const item = importedItems().find((entry) => entry.packageId === packageId && entry.id === itemId);
    if (!item) return { ok: false, message: 'Item importado nao encontrado.' };
    const handoffService = window.BFHandoffConsultivoService;
    if (!handoffService || !handoffService.createFromSignal) return { ok: false, message: 'Servico de handoff consultivo indisponivel.' };

    const assignedTo = sanitizeText(options.assignedTo || item.assignedTo || item.suggestedAssigneeEmail);
    try {
      const handoff = handoffService.createFromSignal(importedItemToSignal(item), {
        assignedTo,
        ownerName: item.ownerEmail,
        forceNew: options.forceNew === true
      });
      const updated = patchImportedItem(packageId, itemId, {
        assignedTo: handoff.assignedTo || assignedTo,
        operationalStatus: 'handoff-criado',
        handoffId: handoff.id,
        handledAt: nowIso()
      }, 'import-item-handoff');
      return { ok: true, handoff, item: updated.item, package: updated.package, auditEvent: updated.auditEvent };
    } catch (error) {
      const auditEvent = recordAudit('import-item-handoff-failed', {
        packageId,
        itemCount: 1,
        details: { itemId, message: error && error.message ? error.message : 'Falha desconhecida' }
      });
      return { ok: false, message: 'Nao foi possivel criar handoff para o item importado.', auditEvent };
    }
  }

  function parsePackage(packageInput) {
    if (typeof packageInput === 'string') return JSON.parse(packageInput);
    return packageInput;
  }

  function validatePackage(packageInput) {
    let parsed = null;
    try {
      parsed = parsePackage(packageInput);
    } catch (error) {
      return { ok: false, reason: 'JSON invalido.', package: null, items: [] };
    }
    if (!parsed || typeof parsed !== 'object') return { ok: false, reason: 'Pacote vazio ou invalido.', package: null, items: [] };
    if (parsed.schema !== EXPORT_SCHEMA) return { ok: false, reason: 'Schema de pacote nao reconhecido.', package: parsed, items: [] };
    const items = safeList(parsed.items).map(sanitizeExportItem).filter((item) => item.id && item.title);
    if (!items.length) return { ok: false, reason: 'Pacote sem itens validos.', package: parsed, items: [] };
    return { ok: true, reason: '', package: parsed, items };
  }

  function exportPackage(options = {}) {
    const sourceUsers = options.users || users();
    const items = list({ includeCreated: true, ...options });
    const filters = options.filters || {};
    const payload = {
      schema: EXPORT_SCHEMA,
      generatedAt: nowIso(),
      filters: {
        assigneeEmail: filters.assigneeEmail || options.assigneeEmail || '',
        queueStatus: filters.queueStatus || options.queueStatus || '',
        severity: filters.severity || options.severity || '',
        stage: filters.stage || options.stage || '',
        search: filters.search || options.search || ''
      },
      summary: summary(items, sourceUsers),
      items: items.map((item) => ({
        id: item.id,
        type: item.type,
        title: item.title,
        reason: item.reason,
        ownerEmail: item.ownerEmail,
        stage: item.stage,
        stageLabel: item.stageLabel,
        severity: item.severity,
        severityLabel: item.severityLabel,
        priority: item.priority,
        hours: item.hours,
        age: item.age,
        queueStatus: item.queueStatus,
        readyForHandoff: item.readyForHandoff,
        suggestedAssigneeEmail: item.suggestedAssigneeEmail,
        suggestedAssigneeName: item.suggestedAssigneeName,
        suggestedAssigneeRole: item.suggestedAssigneeRole,
        existingHandoffId: item.existingHandoffId,
        existingHandoffStatus: item.existingHandoffStatus,
        ctaLabel: item.ctaLabel,
        ctaHref: item.ctaHref,
        productIds: item.productIds
      }))
    };
    if (options.audit !== false) {
      recordAudit('export', {
        itemCount: payload.items.length,
        details: { filters: payload.filters }
      });
    }
    return payload;
  }

  function importPackage(packageInput, options = {}) {
    const validation = validatePackage(packageInput);
    if (!validation.ok) {
      const auditEvent = recordAudit('import-rejected', {
        details: { reason: validation.reason, source: options.source || 'manual' }
      });
      return { ok: false, message: validation.reason, auditEvent };
    }

    const sourcePackage = validation.package;
    const items = validation.items;
    const hash = packageHash({
      schema: sourcePackage.schema,
      generatedAt: sourcePackage.generatedAt || '',
      items
    });
    const current = importedPackages();
    const existing = current.find((item) => item.packageHash === hash);
    if (existing) {
      const auditEvent = recordAudit('import-duplicate', {
        packageId: existing.id,
        packageHash: hash,
        itemCount: items.length,
        details: { source: options.source || 'manual' }
      });
      return { ok: true, duplicate: true, package: existing, auditEvent };
    }

    const actor = currentActor();
    const imported = {
      id: `REC-PKG-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      schema: EXPORT_SCHEMA,
      packageHash: hash,
      label: sanitizeText(options.label || sourcePackage.label || `Pacote ${sourcePackage.generatedAt || nowIso()}`),
      source: sanitizeText(options.source || 'manual'),
      sourceGeneratedAt: sanitizeText(sourcePackage.generatedAt || ''),
      importedAt: sanitizeText(options.importedAt || nowIso()),
      importedBy: actor.email,
      filters: sourcePackage.filters && typeof sourcePackage.filters === 'object' ? { ...sourcePackage.filters } : {},
      summary: sourcePackage.summary && typeof sourcePackage.summary === 'object' ? { ...sourcePackage.summary } : {},
      itemCount: items.length,
      items
    };
    saveImportedPackages([imported].concat(current));
    const auditEvent = recordAudit('import', {
      packageId: imported.id,
      packageHash: hash,
      itemCount: items.length,
      details: { source: imported.source }
    });
    return { ok: true, duplicate: false, package: imported, auditEvent };
  }

  window.BFAdminRecoveryService = {
    list,
    summary,
    find,
    exportPackage,
    importPackage,
    validatePackage,
    importedPackages,
    importedItems,
    importedItemsSummary,
    routeImportedItems,
    conversionGoals,
    saveConversionGoal,
    conversionScoreboard,
    assignImportedItem,
    createHandoffFromImportedItem,
    audit,
    suggestedAssignee,
    consultantPool,
    stageLabel,
    severityLabel
  };
})();
