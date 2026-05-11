(function () {
  'use strict';

  const HANDOFF_KEY = 'bf_consultive_handoffs_v1';
  const AUDIT_KEY = 'bf_consultive_handoff_audit_v1';
  const ACTION_STATE_KEY = 'bf_operational_action_states_v1';
  const ACTION_AUDIT_KEY = 'bf_operational_action_audit_v1';
  const COMMERCIAL_STAGE_STATE_KEY = 'bf_admin_commercial_stage_states_v1';
  const COMMERCIAL_STAGE_AUDIT_KEY = 'bf_admin_commercial_stage_audit_v1';
  const SCHEMA = 'bank-fratern.consultive-handoff.v1';
  const MAX_AUDIT = 120;
  const MAX_ACTION_AUDIT = 160;

  const statusLabels = {
    novo: 'Novo',
    em_atendimento: 'Em atendimento',
    aguardando_cliente: 'Aguardando cliente',
    qualificado: 'Qualificado',
    descartado: 'Descartado'
  };

  const priorityLabels = {
    alta: 'Alta',
    media: 'Media',
    baixa: 'Baixa'
  };

  const sourceLabels = {
    journey: 'Trilha assistida',
    signal: 'Sinal de retomada',
    proposal: 'Proposta revisada',
    imported: 'Pacote importado',
    manual: 'Origem local'
  };

  const actionStatusLabels = {
    pendente: 'Pendente',
    em_execucao: 'Em execucao',
    adiada: 'Adiada',
    concluida: 'Concluida'
  };

  const commercialStageDefinitions = [
    { key: 'contato', label: 'Contato', status: 'novo', deadlineHours: 24, next: 'Iniciar atendimento' },
    { key: 'proposta', label: 'Proposta', status: 'em_atendimento', deadlineHours: 48, next: 'Revisar proposta' },
    { key: 'followup', label: 'Follow-up', status: 'aguardando_cliente', deadlineHours: 72, next: 'Retomar cliente' },
    { key: 'negociacao', label: 'Negociacao', status: 'em_atendimento', deadlineHours: 72, next: 'Avancar negociacao' },
    { key: 'fechamento', label: 'Fechamento', status: 'qualificado', deadlineHours: 120, next: 'Registrar decisao' }
  ];

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

  function currentUser() {
    return window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
  }

  function currentActor() {
    const user = currentUser();
    return {
      email: user && user.email ? user.email : 'anon',
      name: user && user.name ? user.name : 'Usuario local',
      role: user && user.role ? user.role : 'anon'
    };
  }

  function list() {
    const parsed = readJson(HANDOFF_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function saveList(items) {
    return writeJson(HANDOFF_KEY, (items || []).filter(Boolean));
  }

  function audit() {
    const parsed = readJson(AUDIT_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function recordAudit(action, handoff, details) {
    const actor = currentActor();
    const event = {
      id: `EVT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      action,
      handoffId: handoff && handoff.id ? handoff.id : '',
      journeyId: handoff && handoff.sourceJourneyId ? handoff.sourceJourneyId : '',
      proposalId: handoff && handoff.sourceProposalId ? handoff.sourceProposalId : '',
      ownerEmail: handoff && handoff.ownerEmail ? handoff.ownerEmail : '',
      actorEmail: actor.email,
      actorRole: actor.role,
      details: details || {},
      createdAt: nowIso()
    };
    writeJson(AUDIT_KEY, [event].concat(audit()).slice(0, MAX_AUDIT));
    return event;
  }

  function find(id) {
    return list().find((item) => item.id === id) || null;
  }

  function findByJourney(journeyId, ownerEmail) {
    return list().find((item) => {
      const sameJourney = item.sourceJourneyId === journeyId;
      const sameOwner = !ownerEmail || item.ownerEmail === ownerEmail;
      return sameJourney && sameOwner;
    }) || null;
  }

  function findBySignal(signalId, ownerEmail) {
    return list().find((item) => {
      const sameSignal = item.sourceSignalId === signalId;
      const sameOwner = !ownerEmail || item.ownerEmail === ownerEmail;
      return sameSignal && sameOwner;
    }) || null;
  }

  function findByProposal(proposalId, ownerEmail) {
    return list().find((item) => {
      const sameProposal = item.sourceProposalId === proposalId;
      const sameOwner = !ownerEmail || item.ownerEmail === ownerEmail;
      return sameProposal && sameOwner;
    }) || null;
  }

  function sourceType(item) {
    if (!item) return 'manual';
    if (item.sourceType && sourceLabels[item.sourceType]) return item.sourceType;
    if (item.sourceProposalId) return 'proposal';
    if (item.sourceSignalType === 'imported-recovery-item') return 'imported';
    if (item.sourceSignalId) return 'signal';
    if (item.sourceJourneyId) return 'journey';
    return 'manual';
  }

  function sourceLabel(item) {
    return sourceLabels[sourceType(item)] || sourceLabels.manual;
  }

  function checklistTemplate(journey) {
    const objective = journey && journey.objectiveLabel ? journey.objectiveLabel : 'objetivo';
    return [
      { id: 'validar-perfil', label: 'Validar renda, custos, dividas e reserva informados', done: false, required: true },
      { id: 'confirmar-objetivo', label: `Confirmar objetivo declarado: ${objective}`, done: false, required: true },
      { id: 'revisar-modelo', label: 'Revisar modelo recomendado e premissas do comparador', done: false, required: true },
      { id: 'validar-cet', label: 'Validar taxa, CET, prazo, garantias e custos acessorios antes de proposta real', done: false, required: true },
      { id: 'registrar-risco', label: 'Registrar alertas de reserva, comprometimento e suitability educativa', done: false, required: false },
      { id: 'definir-retorno', label: 'Definir proxima conversa, simulacao detalhada ou encerramento', done: false, required: true }
    ];
  }

  function checklistFromSignal(signal) {
    const title = signal && signal.title ? signal.title : 'sinal de jornada';
    return [
      { id: 'revisar-sinal', label: `Revisar sinal de retomada: ${title}`, done: false, required: true },
      { id: 'validar-contexto', label: 'Validar produto, matriz, simulador e historico local antes do contato', done: false, required: true },
      { id: 'definir-proximo-passo', label: 'Definir retomada recomendada para cliente ou consultor', done: false, required: true },
      { id: 'registrar-contato', label: 'Registrar nota local com status e responsavel', done: false, required: true }
    ];
  }

  function checklistFromProposal(proposal, acceptance) {
    const checklist = acceptance && acceptance.checklist ? acceptance.checklist : {};
    const proposalId = proposal && proposal.id ? proposal.id : 'proposta';
    return [
      { id: 'revisar-proposta', label: `Revisar proposta versionada: ${proposalId}`, done: true, required: true },
      { id: 'validar-premissas', label: 'Confirmar premissas financeiras, taxas, validade e memoria de calculo', done: checklist.premissas === true, required: true },
      { id: 'confirmar-cliente', label: 'Confirmar contexto do cliente, objetivo declarado e capacidade de pagamento', done: checklist.cliente === true, required: true },
      { id: 'documentar-handoff', label: 'Preparar documentacao e observacoes para atendimento consultivo', done: checklist.documentacao === true, required: true },
      { id: 'definir-retorno', label: 'Definir responsavel local e proxima conversa com o cliente', done: false, required: true }
    ];
  }

  function priorityFromJourney(journey) {
    const profile = journey && journey.profile ? journey.profile : {};
    const metrics = journey && journey.metrics ? journey.metrics : {};
    const next = journey && journey.nextAction ? journey.nextAction : {};
    if (profile.urgencia === 'alta' && (metrics.gapReserva > 0 || next.tone === 'warn')) return 'alta';
    if (profile.urgencia === 'alta' || Number(metrics.valorCredito || 0) >= 100000) return 'alta';
    if (profile.urgencia === 'baixa' && Number(metrics.gapReserva || 0) <= 0) return 'baixa';
    return 'media';
  }

  function priorityFromSignal(signal) {
    if (!signal) return 'media';
    if (signal.priority === 'alta' || signal.severity === 'alta') return 'alta';
    if (signal.priority === 'baixa' || signal.severity === 'baixa') return 'baixa';
    return 'media';
  }

  function priorityFromProposal(proposal, acceptance) {
    const metrics = proposal && proposal.metrics ? proposal.metrics : {};
    const lances = proposal && proposal.lances ? proposal.lances : {};
    const credito = Number(metrics.creditoTotal || metrics.cartaLiquida || metrics.valorCredito || 0);
    const parcela = Number(metrics.parcelaAtual || metrics.parcelaInicial || 0);
    const lance = Number(lances.lanceTotal || lances.lanceProprio || 0);
    if (acceptance && acceptance.status === 'expired') return 'alta';
    if (credito >= 100000 || lance >= 20000 || parcela >= 2500) return 'alta';
    if (credito > 0 || parcela > 0) return 'media';
    return 'baixa';
  }

  function isOpen(item) {
    return item && !['qualificado', 'descartado'].includes(item.status);
  }

  function hoursSince(value, now) {
    if (!value) return 0;
    const base = now instanceof Date ? now : new Date(now || Date.now());
    const started = new Date(value);
    if (Number.isNaN(started.getTime()) || Number.isNaN(base.getTime())) return 0;
    return Math.max(0, Math.round((base.getTime() - started.getTime()) / 3600000));
  }

  function ageLabel(hours) {
    const value = Number(hours || 0);
    if (value < 1) return 'agora';
    if (value < 24) return `${value}h`;
    const days = Math.floor(value / 24);
    const rest = value % 24;
    return rest ? `${days}d ${rest}h` : `${days}d`;
  }

  function slaHoursForPriority(priority) {
    const rules = {
      alta: 4,
      media: 24,
      baixa: 72
    };
    return rules[priority] || rules.media;
  }

  function nextStepFor(item, state) {
    if (!item) return 'Criar handoff';
    if (!isOpen(item)) return item.status === 'qualificado' ? 'Registrar conversao' : 'Arquivar aprendizado';
    if (!item.assignedTo) return 'Atribuir consultor';
    if (state && state.slaOverdue) return 'Priorizar contato agora';
    if (item.status === 'aguardando_cliente') return state && state.waitingClient ? 'Retomar cliente parado' : 'Agendar retorno';
    if (item.status === 'novo') return 'Iniciar atendimento';
    const checklist = item.checklist || [];
    const requiredOpen = checklist.filter((entry) => entry.required && !entry.done).length;
    if (requiredOpen) return `Concluir ${requiredOpen} item${requiredOpen === 1 ? '' : 's'} obrigatorio${requiredOpen === 1 ? '' : 's'}`;
    return 'Qualificar ou descartar';
  }

  function suggestedAssignee(item) {
    if (!item) return '';
    if (item.assignedTo) return item.assignedTo;
    if (item.sourceType === 'proposal' && item.createdBy) return item.createdBy;
    if (item.sourceSignalAssignedTo) return item.sourceSignalAssignedTo;
    if (item.createdBy && item.createdBy !== 'anon') return item.createdBy;
    return '';
  }

  function actionTypeFor(item, state) {
    const proposal = state && state.proposal ? state.proposal : {};
    if (proposal.active && proposal.tone === 'alta') return 'proposal';
    if (state && state.unassigned) return 'assign';
    if (state && state.slaOverdue) return 'sla';
    if (state && state.waitingClient) return 'return';
    if (proposal.active && proposal.tone === 'media') return 'proposal';
    if (item && item.status === 'novo') return 'first-contact';
    const checklist = item && item.checklist ? item.checklist : [];
    if (checklist.some((entry) => entry.required && !entry.done)) return 'checklist';
    return item && isOpen(item) ? 'qualify' : 'archive';
  }

  function deadlineHoursFor(item, state, actionType) {
    const proposal = state && state.proposal ? state.proposal : {};
    if (actionType === 'archive') return 168;
    if ((state && state.slaOverdue) || (proposal.active && proposal.tone === 'alta')) return 0;
    if (actionType === 'assign' || actionType === 'return' || (item && item.priority === 'alta')) return 24;
    if (actionType === 'proposal' || actionType === 'first-contact' || actionType === 'checklist') return 48;
    return 72;
  }

  function deadlineLabel(hours) {
    const value = Number(hours || 0);
    if (value <= 0) return 'Hoje';
    if (value <= 24) return 'Ate 24h';
    if (value <= 48) return 'Ate 48h';
    if (value <= 72) return 'Ate 72h';
    return 'Monitorar semanal';
  }

  function actionTitle(type, item, state) {
    const proposal = state && state.proposal ? state.proposal : {};
    if (type === 'proposal') return proposal.nextStep || 'Revisar proposta';
    if (type === 'assign') return 'Atribuir consultor';
    if (type === 'sla') return 'Contato imediato';
    if (type === 'return') return 'Retomar cliente';
    if (type === 'first-contact') return 'Iniciar atendimento';
    if (type === 'checklist') return nextStepFor(item, state);
    if (type === 'archive') return item && item.status === 'qualificado' ? 'Registrar conversao' : 'Arquivar aprendizado';
    return 'Qualificar decisao';
  }

  function actionReason(type, item, state) {
    const proposal = state && state.proposal ? state.proposal : {};
    if (type === 'proposal') return proposal.reason || 'Proposta precisa de revisao antes da continuidade.';
    if (type === 'assign') return 'Lead aberto precisa de responsavel local para continuar.';
    if (type === 'sla') return 'SLA operacional ultrapassado para a prioridade atual.';
    if (type === 'return') return 'Cliente esta aguardando retorno ha mais de 48 horas.';
    if (type === 'first-contact') return 'Lead novo ainda nao entrou em atendimento.';
    if (type === 'checklist') return 'Existem itens obrigatorios abertos no checklist consultivo.';
    if (type === 'archive') return 'Atendimento fechado precisa de aprendizado ou conversao registrada.';
    return 'Lead dentro da fila, pronto para decisao consultiva.';
  }

  function actionCtaLabel(type) {
    const labels = {
      proposal: 'Abrir proposta',
      assign: 'Definir responsavel',
      sla: 'Abrir lead',
      return: 'Retomar atendimento',
      'first-contact': 'Abrir lead',
      checklist: 'Concluir checklist',
      qualify: 'Registrar decisao',
      archive: 'Revisar historico'
    };
    return labels[type] || 'Abrir acao';
  }

  function actionHref(type, item) {
    if (type === 'proposal') {
      const proposalId = item && item.sourceProposalId ? `?from=handoff&proposalId=${encodeURIComponent(item.sourceProposalId)}` : '?from=handoff';
      return `simulador.html${proposalId}#step-9`;
    }
    const id = item && item.id ? `?handoffId=${encodeURIComponent(item.id)}` : '';
    return `handoff-consultivo.html${id}#detalhe-handoff`;
  }

  function actionStates() {
    const parsed = readJson(ACTION_STATE_KEY, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function actionAudit() {
    const parsed = readJson(ACTION_AUDIT_KEY, []);
    return Array.isArray(parsed) ? parsed : [];
  }

  function normalizeActionKey(action) {
    if (typeof action === 'string') return action;
    if (!action) return '';
    if (action.actionKey) return action.actionKey;
    const source = action.source || action.sourceType || 'operacao';
    const type = action.type || action.actionType || 'acao';
    const id = action.id || action.handoffId || action.target || action.href || action.title || 'local';
    return `${source}:${type}:${id}`;
  }

  function actionExecution(action) {
    const actionKey = normalizeActionKey(action);
    const saved = actionKey ? actionStates()[actionKey] : null;
    const status = saved && saved.status && actionStatusLabels[saved.status] ? saved.status : 'pendente';
    return {
      actionKey,
      status,
      statusLabel: actionStatusLabels[status] || actionStatusLabels.pendente,
      owner: saved && saved.owner ? saved.owner : (action && action.owner ? action.owner : ''),
      reason: saved && saved.reason ? saved.reason : '',
      postponedUntil: saved && saved.postponedUntil ? saved.postponedUntil : '',
      updatedAt: saved && saved.updatedAt ? saved.updatedAt : '',
      updatedBy: saved && saved.updatedBy ? saved.updatedBy : '',
      completedAt: saved && saved.completedAt ? saved.completedAt : ''
    };
  }

  function recordActionAudit(actionName, state, details) {
    const actor = currentActor();
    const event = {
      id: `ACT-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 6).toUpperCase()}`,
      action: actionName,
      actionKey: state && state.actionKey ? state.actionKey : '',
      title: state && state.title ? state.title : '',
      owner: state && state.owner ? state.owner : '',
      status: state && state.status ? state.status : '',
      reason: state && state.reason ? state.reason : '',
      actorEmail: actor.email,
      actorRole: actor.role,
      details: details || {},
      createdAt: nowIso()
    };
    writeJson(ACTION_AUDIT_KEY, [event].concat(actionAudit()).slice(0, MAX_ACTION_AUDIT));
    return event;
  }

  function setActionExecution(action, patch) {
    const actionKey = normalizeActionKey(action);
    if (!actionKey) return null;
    const current = actionExecution(action);
    const actor = currentActor();
    const status = patch && patch.status && actionStatusLabels[patch.status] ? patch.status : current.status;
    const states = actionStates();
    const next = {
      ...current,
      actionKey,
      title: (patch && patch.title) || (action && action.title) || current.title || '',
      source: (patch && patch.source) || (action && action.source) || current.source || '',
      target: (patch && patch.target) || (action && action.target) || current.target || '',
      href: (patch && patch.href) || (action && action.href) || current.href || '',
      status,
      statusLabel: actionStatusLabels[status] || actionStatusLabels.pendente,
      owner: (patch && patch.owner) || current.owner || (action && action.owner) || '',
      reason: patch && Object.prototype.hasOwnProperty.call(patch, 'reason') ? String(patch.reason || '') : current.reason,
      postponedUntil: patch && Object.prototype.hasOwnProperty.call(patch, 'postponedUntil') ? String(patch.postponedUntil || '') : current.postponedUntil,
      completedAt: status === 'concluida' ? ((patch && patch.completedAt) || nowIso()) : (status === 'pendente' ? '' : current.completedAt),
      updatedAt: nowIso(),
      updatedBy: actor.email
    };
    states[actionKey] = next;
    writeJson(ACTION_STATE_KEY, states);
    recordActionAudit(`action:${status}`, next, { reason: next.reason, postponedUntil: next.postponedUntil });
    return next;
  }

  function actionHistory(action) {
    const actionKey = normalizeActionKey(action);
    return actionAudit().filter((event) => event.actionKey === actionKey);
  }

  function commercialStageMap() {
    return new Map(commercialStageDefinitions.map((stage) => [stage.key, stage]));
  }

  function commercialStageStates() {
    const parsed = readJson(COMMERCIAL_STAGE_STATE_KEY, {});
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {};
  }

  function commercialStageAudit() {
    const parsed = readJson(COMMERCIAL_STAGE_AUDIT_KEY, []);
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  }

  function commercialStageFor(item) {
    if (!item) return 'contato';
    const saved = item.id ? commercialStageStates()[item.id] : null;
    if (saved && commercialStageMap().has(saved.stage)) return saved.stage;
    if (['qualificado', 'descartado'].includes(item.status)) return 'fechamento';
    if (item.status === 'aguardando_cliente') return 'followup';
    if (sourceType(item) === 'proposal') return 'proposta';
    if (item.status === 'em_atendimento') return 'negociacao';
    return 'contato';
  }

  function commercialStageTone(stageKey, hours, stale, item) {
    if (stale || (item && item.priority === 'alta')) return 'alta';
    const stage = commercialStageMap().get(stageKey) || commercialStageDefinitions[0];
    if (Number(hours || 0) >= Math.max(12, Number(stage.deadlineHours || 48) * 0.6)) return 'media';
    return 'baixa';
  }

  function commercialStageState(item, now) {
    const stageKey = commercialStageFor(item);
    const stage = commercialStageMap().get(stageKey) || commercialStageDefinitions[0];
    const states = commercialStageStates();
    const saved = item && item.id ? states[item.id] : null;
    const event = item && item.id ? commercialStageAudit().find((entry) => entry && entry.handoffId === item.id) : null;
    const referenceAt = (saved && saved.updatedAt) || (event && event.createdAt) || (item && (item.updatedAt || item.createdAt)) || '';
    const stageAgeHours = hoursSince(referenceAt, now);
    const stale = isOpen(item) && stage.key !== 'fechamento' && stageAgeHours >= Number(stage.deadlineHours || 48);
    return {
      key: stage.key,
      label: stage.label,
      status: (saved && saved.status) || stage.status,
      next: stage.next,
      deadlineHours: stage.deadlineHours,
      updatedAt: referenceAt,
      updatedBy: (saved && saved.updatedBy) || (event && event.actorEmail) || '',
      stageAgeHours,
      stageAgeLabel: ageLabel(stageAgeHours),
      stale,
      tone: commercialStageTone(stage.key, stageAgeHours, stale, item),
      moved: !!event,
      fromLabel: event && event.fromLabel ? event.fromLabel : '',
      toLabel: event && event.toLabel ? event.toLabel : stage.label,
      actorEmail: event && event.actorEmail ? event.actorEmail : '',
      movementAt: event && event.createdAt ? event.createdAt : '',
      movementAgeLabel: event ? ageLabel(hoursSince(event.createdAt, now)) : '',
      historyLabel: event
        ? `${event.fromLabel || 'Entrada'} -> ${event.toLabel || stage.label}`
        : 'Etapa definida pela jornada'
    };
  }

  function actionPlan(item, now) {
    if (!item) {
      return {
        active: false,
        actionKey: '',
        type: 'none',
        title: 'Sem acao',
        reason: '',
        owner: '',
        deadlineHours: 0,
        deadlineLabel: '',
        dueAt: '',
        ctaLabel: '',
        href: '',
        execution: actionExecution('')
      };
    }
    const reference = now instanceof Date ? now : new Date(now || Date.now());
    const state = item.operational || operationalState(item, reference);
    const type = actionTypeFor(item, state);
    const deadlineHours = deadlineHoursFor(item, state, type);
    const dueAt = new Date(reference.getTime() + (deadlineHours * 3600000)).toISOString();
    const owner = type === 'assign'
      ? 'coordenacao local'
      : (item.assignedTo || state.suggestedAssignee || item.ownerEmail || 'definir na fila');
    const actionKey = `handoff:${item.id || 'local'}:${type}`;
    const execution = actionExecution({ actionKey, owner });
    return {
      active: true,
      id: item.id || '',
      actionKey,
      type,
      title: actionTitle(type, item, state),
      reason: actionReason(type, item, state),
      owner,
      deadlineHours,
      deadlineLabel: deadlineLabel(deadlineHours),
      dueAt,
      ctaLabel: actionCtaLabel(type),
      href: actionHref(type, item),
      tone: state.tone || 'media',
      priority: item.priority || 'media',
      source: sourceLabel(item),
      execution
    };
  }

  function proposalState(item, now) {
    if (!item || sourceType(item) !== 'proposal') {
      return {
        active: false,
        tone: 'baixa',
        label: 'Sem proposta',
        nextStep: '',
        reason: ''
      };
    }
    const reference = now instanceof Date ? now : new Date(now || Date.now());
    const validUntil = item.sourceProposalValidUntil || (item.summary && item.summary.propostaValidade) || '';
    const validDate = validUntil ? new Date(`${validUntil}T23:59:59`) : null;
    const expired = validDate && Number.isFinite(validDate.getTime()) ? validDate < reference : false;
    const version = Number(item.sourceProposalVersion || (item.summary && item.summary.propostaVersao) || 0);
    const locked = !!(item.sourceProposalVersionId || item.sourceProposalVersionHash || version > 0);
    const status = item.sourceProposalStatus || '';
    const reviewed = status === 'reviewed';
    const versionHours = hoursSince(item.sourceProposalUpdatedAt || item.updatedAt || item.createdAt, reference);
    let tone = 'baixa';
    let label = locked ? `Versao ${version || '-'} travada` : 'Versao nao travada';
    let nextStep = 'Acompanhar proposta';
    let reason = locked
      ? 'Proposta possui snapshot local preservado para atendimento consultivo.'
      : 'Handoff antigo ou manual sem snapshot versionado da proposta.';

    if (expired) {
      tone = 'alta';
      label = 'Proposta vencida';
      nextStep = 'Revisar validade da proposta';
      reason = 'A validade local da proposta expirou antes da conclusao do atendimento.';
    } else if (!locked) {
      tone = 'alta';
      nextStep = 'Salvar versao da proposta';
    } else if (!reviewed) {
      tone = 'media';
      label = 'Revisao incompleta';
      nextStep = 'Concluir aceite da proposta';
      reason = 'A proposta foi encaminhada sem status final de revisao local.';
    } else if (versionHours >= 72 && isOpen(item)) {
      tone = 'media';
      label = 'Retomar proposta';
      nextStep = 'Retomar cliente da proposta';
      reason = 'A proposta esta aberta ha mais de 72h desde a ultima revisao/versionamento.';
    }

    return {
      active: true,
      version,
      locked,
      expired,
      reviewed,
      status,
      validUntil,
      versionId: item.sourceProposalVersionId || '',
      sourceHash: item.sourceProposalVersionHash || '',
      versionHours,
      versionAgeLabel: ageLabel(versionHours),
      tone,
      label,
      nextStep,
      reason
    };
  }

  function operationalState(item, now) {
    const priority = item && item.priority ? item.priority : 'media';
    const lastEventAt = item && (item.updatedAt || item.createdAt);
    const hours = hoursSince(lastEventAt, now);
    const slaHours = slaHoursForPriority(priority);
    const waitingClient = item && item.status === 'aguardando_cliente' && hours >= 48;
    const open = isOpen(item);
    const slaOverdue = open && hours >= slaHours;
    const unassigned = open && !(item && item.assignedTo);
    const proposal = proposalState(item, now);
    const tone = slaOverdue || (item && item.priority === 'alta') || proposal.tone === 'alta'
      ? 'alta'
      : waitingClient || unassigned || proposal.tone === 'media'
        ? 'media'
        : 'baixa';
    const state = {
      open,
      hours,
      ageLabel: ageLabel(hours),
      slaHours,
      slaOverdue,
      waitingClient,
      unassigned,
      suggestedAssignee: suggestedAssignee(item),
      proposal,
      tone,
      nextStep: ''
    };
    state.nextStep = nextStepFor(item, state);
    if (proposal.active && open && !unassigned && proposal.tone !== 'baixa') {
      state.nextStep = proposal.nextStep;
    }
    return state;
  }

  function enrich(item, now) {
    if (!item) return null;
    return {
      ...item,
      operational: operationalState(item, now),
      commercialStage: commercialStageState(item, now)
    };
  }

  function enrichList(items, now) {
    return (items || list()).map((item) => enrich(item, now)).filter(Boolean);
  }

  function consultantBoard(items, now) {
    const enriched = enrichList(items || list(), now);
    const open = enriched.filter((item) => item.operational.open);
    const overdue = open.filter((item) => item.operational.slaOverdue);
    const waiting = open.filter((item) => item.operational.waitingClient);
    const unassigned = open.filter((item) => item.operational.unassigned);
    const highPriority = open.filter((item) => item.priority === 'alta');
    const proposalOpen = open.filter((item) => item.operational.proposal && item.operational.proposal.active);
    const proposalExpired = proposalOpen.filter((item) => item.operational.proposal.expired);
    const proposalUnversioned = proposalOpen.filter((item) => item.operational.proposal.locked === false);
    const proposalNeedsReview = proposalOpen.filter((item) => item.operational.proposal.tone !== 'baixa');
    const commercialStale = open.filter((item) => item.commercialStage && item.commercialStage.stale);
    const commercialAudit = commercialStageAudit();
    const commercialMoved24 = commercialAudit.filter((event) => hoursSince(event.createdAt, now) <= 24).length;
    const commercialRecent = commercialAudit.slice(0, 5).map((event) => ({
      id: event.id || '',
      handoffId: event.handoffId || '',
      fromLabel: event.fromLabel || '',
      toLabel: event.toLabel || '',
      actorEmail: event.actorEmail || '',
      createdAt: event.createdAt || '',
      age: ageLabel(hoursSince(event.createdAt, now))
    }));
    const nextActions = open
      .slice()
      .sort((a, b) => {
        const priorityWeight = { alta: 3, media: 2, baixa: 1 };
        const toneWeight = { alta: 3, media: 2, baixa: 1 };
        const aScore = (priorityWeight[a.priority] || 2) * 100
          + (toneWeight[a.operational.tone] || 1) * 40
          + Math.min(a.operational.hours, 120);
        const bScore = (priorityWeight[b.priority] || 2) * 100
          + (toneWeight[b.operational.tone] || 1) * 40
          + Math.min(b.operational.hours, 120);
        return bScore - aScore;
      })
      .slice(0, 5)
      .map((item) => {
        const plan = actionPlan(item, now);
        return {
          id: item.id,
          ownerEmail: item.ownerEmail || 'anon',
          title: item.objectiveLabel || item.id,
          source: sourceLabel(item),
          priority: item.priority || 'media',
          age: item.operational.ageLabel,
          hours: item.operational.hours,
          nextStep: item.operational.nextStep,
          proposalState: item.operational.proposal && item.operational.proposal.active ? item.operational.proposal.label : '',
          commercialStage: item.commercialStage || commercialStageState(item, now),
          suggestedAssignee: item.operational.suggestedAssignee || '',
          tone: item.operational.tone,
          actionType: plan.type,
          actionKey: plan.actionKey,
          actionTitle: plan.title,
          actionReason: plan.reason,
          actionOwner: plan.owner,
          deadlineLabel: plan.deadlineLabel,
          dueAt: plan.dueAt,
          ctaLabel: plan.ctaLabel,
          href: plan.href,
          executionStatus: plan.execution.status,
          executionStatusLabel: plan.execution.statusLabel,
          executionReason: plan.execution.reason
        };
      });

    return {
      total: enriched.length,
      open: open.length,
      overdue: overdue.length,
      waiting: waiting.length,
      unassigned: unassigned.length,
      highPriority: highPriority.length,
      proposalOpen: proposalOpen.length,
      proposalExpired: proposalExpired.length,
      proposalUnversioned: proposalUnversioned.length,
      proposalNeedsReview: proposalNeedsReview.length,
      commercialStale: commercialStale.length,
      commercialMoved24,
      commercialRecent,
      nextActions
    };
  }

  function extractSummary(journey) {
    const profile = journey && journey.profile ? journey.profile : {};
    const product = journey && journey.recommendedProduct ? journey.recommendedProduct : {};
    const model = journey && journey.recommendedModel ? journey.recommendedModel : {};
    const next = journey && journey.nextAction ? journey.nextAction : {};
    const metrics = journey && journey.metrics ? journey.metrics : {};
    return {
      objective: journey && journey.objective ? journey.objective : '',
      objectiveLabel: journey && journey.objectiveLabel ? journey.objectiveLabel : '',
      productId: product.id || '',
      productName: product.nome || '',
      modelId: model.id || '',
      modelName: model.name || '',
      nextActionType: next.type || '',
      nextActionTitle: next.title || '',
      nextActionHref: next.href || '',
      rendaMensal: Number(profile.rendaMensal || 0),
      gastoMensal: Number(profile.gastoMensal || 0),
      dividasMensais: Number(profile.dividasMensais || 0),
      reservaAtual: Number(profile.reservaAtual || 0),
      reservaMeses: Number(metrics.reservaMeses || profile.reservaMeses || 0),
      capacidadePagamento: Number(metrics.capacidadePagamento || profile.capacidadePagamento || 0),
      comprometimentoRenda: Number(metrics.comprometimentoRenda || profile.comprometimentoRenda || 0),
      valorCredito: Number(metrics.valorCredito || profile.valorCredito || 0),
      gapReserva: Number(metrics.gapReserva || profile.gapReserva || 0),
      urgencia: profile.urgencia || '',
      prioridade: profile.prioridade || ''
    };
  }

  function extractSignalSummary(signal) {
    const productIds = Array.isArray(signal && signal.productIds) ? signal.productIds : [];
    return {
      objective: 'retomada_jornada',
      objectiveLabel: signal && signal.title ? signal.title : 'Retomada de jornada',
      productId: productIds[0] || '',
      productName: productIds.length ? productIds.join(', ') : '',
      modelId: '',
      modelName: signal && signal.winner ? signal.winner : '',
      nextActionType: signal && signal.type ? signal.type : 'journey-signal',
      nextActionTitle: signal && signal.ctaLabel ? signal.ctaLabel : 'Retomar jornada',
      nextActionHref: signal && signal.ctaHref ? signal.ctaHref : 'dashboard-cliente.html',
      rendaMensal: 0,
      gastoMensal: 0,
      dividasMensais: 0,
      reservaAtual: 0,
      reservaMeses: 0,
      capacidadePagamento: 0,
      comprometimentoRenda: 0,
      valorCredito: 0,
      gapReserva: 0,
      urgencia: signal && signal.severity ? signal.severity : '',
      prioridade: signal && signal.priority ? signal.priority : ''
    };
  }

  function extractProposalSummary(proposal, acceptance) {
    const metrics = proposal && proposal.metrics ? proposal.metrics : {};
    const lances = proposal && proposal.lances ? proposal.lances : {};
    const project = proposal && proposal.project ? proposal.project : {};
    const cliente = proposal && proposal.cliente ? proposal.cliente : '';
    const produto = proposal && proposal.produto ? proposal.produto : '';
    const proposalId = proposal && proposal.id ? proposal.id : '';
    return {
      objective: 'proposta_consorcio',
      objectiveLabel: proposalId ? `Proposta ${proposalId}` : 'Proposta de consorcio',
      productId: 'consorcio',
      productName: produto || 'Consorcio estruturado',
      modelId: acceptance && acceptance.status ? `proposal-${acceptance.status}` : 'proposal-review',
      modelName: acceptance && acceptance.statusLabel ? acceptance.statusLabel : 'Revisao da proposta',
      nextActionType: 'proposal-handoff',
      nextActionTitle: 'Conduzir proposta revisada',
      nextActionHref: 'simulador.html#step-9',
      rendaMensal: 0,
      gastoMensal: 0,
      dividasMensais: 0,
      reservaAtual: 0,
      reservaMeses: 0,
      capacidadePagamento: Number(metrics.parcelaAtual || metrics.parcelaInicial || 0),
      comprometimentoRenda: 0,
      valorCredito: Number(metrics.creditoTotal || metrics.cartaLiquida || metrics.valorCredito || project.totalCarta || 0),
      gapReserva: 0,
      urgencia: priorityFromProposal(proposal, acceptance),
      prioridade: priorityFromProposal(proposal, acceptance),
      cliente,
      lanceTotal: Number(lances.lanceTotal || lances.lanceProprio || 0),
      prazoMeses: Number(metrics.prazo || metrics.prazoTotal || 0),
      propostaVersao: acceptance && acceptance.proposalVersion && acceptance.proposalVersion.version
        ? acceptance.proposalVersion.version
        : (acceptance && acceptance.version ? acceptance.version : 0),
      propostaValidade: acceptance && acceptance.validUntil ? acceptance.validUntil : ''
    };
  }

  function createFromJourney(journey, options) {
    if (!journey || !journey.id) throw new Error('Trilha invalida para handoff consultivo.');
    const actor = currentActor();
    const ownerEmail = journey.owner || actor.email;
    const existing = findByJourney(journey.id, ownerEmail);
    const now = nowIso();
    const summary = extractSummary(journey);
    const patch = {
      schema: SCHEMA,
      sourceType: 'journey',
      sourceLabel: sourceLabels.journey,
      sourceJourneyId: journey.id,
      sourceJourneyUpdatedAt: journey.updatedAt || now,
      ownerEmail,
      ownerName: options && options.ownerName ? options.ownerName : ownerEmail,
      objective: journey.objective || '',
      objectiveLabel: journey.objectiveLabel || '',
      priority: priorityFromJourney(journey),
      summary,
      recommendation: journey.recommendation || {},
      nextAction: journey.nextAction || {},
      updatedAt: now
    };

    if (existing && !(options && options.forceNew)) {
      const next = {
        ...existing,
        ...patch,
        timeline: [
          {
            id: `TL-${Date.now().toString(36).toUpperCase()}`,
            type: 'refresh',
            label: 'Handoff atualizado a partir da trilha assistida.',
            actorEmail: actor.email,
            createdAt: now
          }
        ].concat(existing.timeline || [])
      };
      const items = list().map((item) => item.id === existing.id ? next : item);
      saveList(items);
      recordAudit('refresh', next, { sourceJourneyId: journey.id });
      return next;
    }

    const handoff = {
      id: `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      ...patch,
      status: 'novo',
      assignedTo: '',
      createdAt: now,
      createdBy: actor.email,
      checklist: checklistTemplate(journey),
      notes: [],
      timeline: [
        {
          id: `TL-${Date.now().toString(36).toUpperCase()}`,
          type: 'create',
          label: 'Handoff consultivo criado a partir da trilha assistida.',
          actorEmail: actor.email,
          createdAt: now
        }
      ]
    };
    saveList([handoff].concat(list()));
    recordAudit('create', handoff, { sourceJourneyId: journey.id });
    return handoff;
  }

  function createFromSignal(signal, options) {
    if (!signal || !signal.id) throw new Error('Sinal invalido para handoff consultivo.');
    const actor = currentActor();
    const ownerEmail = signal.ownerEmail || actor.email;
    const existing = findBySignal(signal.id, ownerEmail);
    const now = nowIso();
    const summary = extractSignalSummary(signal);
    const assignedTo = options && options.assignedTo ? String(options.assignedTo || '').trim() : '';
    const patch = {
      schema: SCHEMA,
      sourceType: signal.type === 'imported-recovery-item' ? 'imported' : 'signal',
      sourceLabel: signal.type === 'imported-recovery-item' ? sourceLabels.imported : sourceLabels.signal,
      sourceSignalId: signal.id,
      sourceSignalType: signal.type || '',
      sourceSignalUpdatedAt: signal.latestEventAt || now,
      sourceSignalSeverity: signal.severity || '',
      ownerEmail,
      ownerName: options && options.ownerName ? options.ownerName : ownerEmail,
      objective: 'retomada_jornada',
      objectiveLabel: signal.title || 'Retomada de jornada',
      priority: priorityFromSignal(signal),
      assignedTo: assignedTo || (existing && existing.assignedTo ? existing.assignedTo : ''),
      summary,
      recommendation: {
        title: signal.title || 'Retomada recomendada',
        message: signal.reason || 'Sinal local de continuidade da jornada.',
        tone: signal.severity === 'alta' ? 'warn' : 'info',
        next: signal.ctaLabel || 'Retomar jornada'
      },
      nextAction: {
        type: signal.type || 'journey-signal',
        title: signal.reason || signal.title || 'Retomar jornada',
        label: signal.ctaLabel || 'Abrir continuidade',
        href: signal.ctaHref || 'dashboard-cliente.html'
      },
      updatedAt: now
    };

    if (existing && !(options && options.forceNew)) {
      const next = {
        ...existing,
        ...patch,
        timeline: [
          {
            id: `TL-${Date.now().toString(36).toUpperCase()}`,
            type: 'signal:refresh',
            label: 'Handoff atualizado a partir de sinal de retomada.',
            actorEmail: actor.email,
            createdAt: now
          }
        ].concat(existing.timeline || [])
      };
      saveList(list().map((item) => item.id === existing.id ? next : item));
      recordAudit('signal-refresh', next, { sourceSignalId: signal.id });
      return next;
    }

    const handoff = {
      id: `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      ...patch,
      status: 'novo',
      assignedTo: patch.assignedTo || '',
      createdAt: now,
      createdBy: actor.email,
      checklist: checklistFromSignal(signal),
      notes: [],
      timeline: [
        {
          id: `TL-${Date.now().toString(36).toUpperCase()}`,
          type: 'signal:create',
          label: 'Handoff consultivo criado a partir de sinal de retomada.',
          actorEmail: actor.email,
          createdAt: now
        }
      ]
    };
    saveList([handoff].concat(list()));
    recordAudit('signal-create', handoff, { sourceSignalId: signal.id });
    return handoff;
  }

  function createFromProposal(proposal, acceptance, options) {
    if (!proposal || !proposal.id) throw new Error('Proposta invalida para handoff consultivo.');
    const actor = currentActor();
    const ownerEmail = options && options.ownerEmail ? options.ownerEmail : actor.email;
    const existing = findByProposal(proposal.id, ownerEmail);
    const now = nowIso();
    const summary = extractProposalSummary(proposal, acceptance);
    const reviewer = acceptance && acceptance.reviewer ? acceptance.reviewer : '';
    const assignedTo = options && options.assignedTo ? String(options.assignedTo || '').trim() : '';
    const proposalStatus = acceptance && acceptance.status ? acceptance.status : 'pending';
    const proposalStatusLabel = acceptance && acceptance.statusLabel ? acceptance.statusLabel : 'Proposta em revisao';
    const proposalVersion = acceptance && acceptance.proposalVersion ? acceptance.proposalVersion : null;
    const patch = {
      schema: SCHEMA,
      sourceType: 'proposal',
      sourceLabel: sourceLabels.proposal,
      sourceProposalId: proposal.id,
      sourceProposalStatus: proposalStatus,
      sourceProposalVersion: proposalVersion && proposalVersion.version ? proposalVersion.version : (acceptance && acceptance.version ? acceptance.version : 0),
      sourceProposalVersionId: proposalVersion && proposalVersion.id ? proposalVersion.id : '',
      sourceProposalVersionHash: proposalVersion && proposalVersion.sourceHash ? proposalVersion.sourceHash : '',
      sourceProposalUpdatedAt: acceptance && acceptance.updatedAt ? acceptance.updatedAt : now,
      sourceProposalValidUntil: acceptance && acceptance.validUntil ? acceptance.validUntil : '',
      ownerEmail,
      ownerName: options && options.ownerName ? options.ownerName : (proposal.cliente || reviewer || ownerEmail),
      objective: 'proposta_consorcio',
      objectiveLabel: `Proposta ${proposal.id}`,
      priority: priorityFromProposal(proposal, acceptance),
      assignedTo: assignedTo || (existing && existing.assignedTo ? existing.assignedTo : ''),
      summary,
      recommendation: {
        title: 'Proposta revisada para handoff',
        message: acceptance && acceptance.notes ? acceptance.notes : 'Proposta revisada localmente e pronta para continuidade consultiva.',
        tone: proposalStatus === 'reviewed' ? 'success' : 'warn',
        next: 'Validar contato, documentacao e proxima conversa.'
      },
      nextAction: {
        type: 'proposal-handoff',
        title: 'Abrir proposta revisada',
        label: 'Rever proposta',
        href: 'simulador.html#step-9'
      },
      updatedAt: now
    };

    if (existing && !(options && options.forceNew)) {
      const next = {
        ...existing,
        ...patch,
        checklist: checklistFromProposal(proposal, acceptance),
        timeline: [
          {
            id: `TL-${Date.now().toString(36).toUpperCase()}`,
            type: 'proposal:refresh',
            label: 'Handoff atualizado a partir da proposta revisada.',
            actorEmail: actor.email,
            createdAt: now
          }
        ].concat(existing.timeline || [])
      };
      saveList(list().map((item) => item.id === existing.id ? next : item));
      recordAudit('proposal-refresh', next, { sourceProposalId: proposal.id, status: proposalStatus });
      return next;
    }

    const notes = acceptance && acceptance.notes ? [{
      id: `NOTE-${Date.now().toString(36).toUpperCase()}`,
      text: String(acceptance.notes || '').slice(0, 600),
      actorEmail: reviewer || actor.email,
      actorRole: acceptance && acceptance.reviewerRole ? acceptance.reviewerRole : actor.role,
      createdAt: now
    }] : [];
    const handoff = {
      id: `LEAD-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`,
      ...patch,
      status: 'novo',
      assignedTo: patch.assignedTo || '',
      createdAt: now,
      createdBy: actor.email,
      checklist: checklistFromProposal(proposal, acceptance),
      notes,
      timeline: [
        {
          id: `TL-${Date.now().toString(36).toUpperCase()}`,
          type: 'proposal:create',
          label: `Handoff consultivo criado a partir de ${proposalStatusLabel.toLowerCase()}.`,
          actorEmail: actor.email,
          createdAt: now
        }
      ]
    };
    saveList([handoff].concat(list()));
    recordAudit('proposal-create', handoff, { sourceProposalId: proposal.id, status: proposalStatus });
    return handoff;
  }

  function update(id, patch, action) {
    const current = find(id);
    if (!current) return null;
    const actor = currentActor();
    const now = nowIso();
    const next = {
      ...current,
      ...(patch || {}),
      updatedAt: now
    };
    if (action) {
      next.timeline = [
        {
          id: `TL-${Date.now().toString(36).toUpperCase()}`,
          type: action,
          label: action,
          actorEmail: actor.email,
          createdAt: now
        }
      ].concat(current.timeline || []);
    }
    saveList(list().map((item) => item.id === id ? next : item));
    if (action) recordAudit(action, next, patch || {});
    return next;
  }

  function setStatus(id, status) {
    const normalized = statusLabels[status] ? status : 'novo';
    return update(id, { status: normalized }, `status:${normalized}`);
  }

  function assign(id, assignedTo) {
    return update(id, { assignedTo: String(assignedTo || '').trim() }, 'assign');
  }

  function toggleChecklist(id, checklistId, done) {
    const current = find(id);
    if (!current) return null;
    const checklist = (current.checklist || []).map((item) => item.id === checklistId ? { ...item, done: done === true } : item);
    return update(id, { checklist }, done ? 'checklist:done' : 'checklist:open');
  }

  function addNote(id, text) {
    const value = String(text || '').trim().slice(0, 600);
    if (!value) return find(id);
    const current = find(id);
    if (!current) return null;
    const actor = currentActor();
    const note = {
      id: `NOTE-${Date.now().toString(36).toUpperCase()}`,
      text: value,
      actorEmail: actor.email,
      actorRole: actor.role,
      createdAt: nowIso()
    };
    return update(id, { notes: [note].concat(current.notes || []) }, 'note');
  }

  function metrics(items) {
    const source = enrichList(items || list());
    const open = source.filter((item) => !['qualificado', 'descartado'].includes(item.status)).length;
    const qualified = source.filter((item) => item.status === 'qualificado').length;
    const highPriority = source.filter((item) => item.priority === 'alta').length;
    const overdue = source.filter((item) => item.operational && item.operational.slaOverdue).length;
    const waiting = source.filter((item) => item.operational && item.operational.waitingClient).length;
    const unassigned = source.filter((item) => item.operational && item.operational.unassigned).length;
    const proposalExpired = source.filter((item) => item.operational && item.operational.proposal && item.operational.proposal.expired).length;
    const proposalUnversioned = source.filter((item) => item.operational && item.operational.proposal && item.operational.proposal.active && item.operational.proposal.locked === false).length;
    const proposalNeedsReview = source.filter((item) => item.operational && item.operational.proposal && item.operational.proposal.active && item.operational.proposal.tone !== 'baixa').length;
    const commercialStale = source.filter((item) => item.commercialStage && item.commercialStage.stale).length;
    const origins = source.reduce((acc, item) => {
      const key = sourceType(item);
      acc[key] = (acc[key] || 0) + 1;
      return acc;
    }, {});
    const checklistItems = source.flatMap((item) => item.checklist || []);
    const done = checklistItems.filter((item) => item.done).length;
    const completion = checklistItems.length ? Math.round((done / checklistItems.length) * 100) : 0;
    return {
      total: source.length,
      open,
      qualified,
      highPriority,
      overdue,
      waiting,
      unassigned,
      proposalExpired,
      proposalUnversioned,
      proposalNeedsReview,
      commercialStale,
      origins,
      proposal: origins.proposal || 0,
      journey: origins.journey || 0,
      signal: origins.signal || 0,
      imported: origins.imported || 0,
      completion
    };
  }

  window.BFHandoffConsultivoService = {
    statusLabels: { ...statusLabels },
    priorityLabels: { ...priorityLabels },
    sourceLabels: { ...sourceLabels },
    list,
    find,
    findByJourney,
    findBySignal,
    findByProposal,
    sourceType,
    sourceLabel,
    hoursSince,
    ageLabel,
    slaHoursForPriority,
    proposalState,
    operationalState,
    actionPlan,
    actionExecution,
    setActionExecution,
    actionHistory,
    actionAudit,
    commercialStageDefinitions: commercialStageDefinitions.map((stage) => ({ ...stage })),
    commercialStageStates,
    commercialStageAudit,
    commercialStageFor,
    commercialStageState,
    enrich,
    enrichList,
    consultantBoard,
    createFromJourney,
    createFromSignal,
    createFromProposal,
    setStatus,
    assign,
    toggleChecklist,
    addNote,
    metrics,
    audit,
    keys: {
      handoffs: HANDOFF_KEY,
      audit: AUDIT_KEY,
      actionStates: ACTION_STATE_KEY,
      actionAudit: ACTION_AUDIT_KEY,
      commercialStageStates: COMMERCIAL_STAGE_STATE_KEY,
      commercialStageAudit: COMMERCIAL_STAGE_AUDIT_KEY,
      schema: SCHEMA
    }
  };
})();
