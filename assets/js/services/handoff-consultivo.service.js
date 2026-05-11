(function () {
  'use strict';

  const HANDOFF_KEY = 'bf_consultive_handoffs_v1';
  const AUDIT_KEY = 'bf_consultive_handoff_audit_v1';
  const SCHEMA = 'bank-fratern.consultive-handoff.v1';
  const MAX_AUDIT = 120;

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
      operational: operationalState(item, now)
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
      .map((item) => ({
        id: item.id,
        ownerEmail: item.ownerEmail || 'anon',
        title: item.objectiveLabel || item.id,
        source: sourceLabel(item),
        priority: item.priority || 'media',
        age: item.operational.ageLabel,
        hours: item.operational.hours,
        nextStep: item.operational.nextStep,
        proposalState: item.operational.proposal && item.operational.proposal.active ? item.operational.proposal.label : '',
        suggestedAssignee: item.operational.suggestedAssignee || '',
        tone: item.operational.tone
      }));

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
      schema: SCHEMA
    }
  };
})();
