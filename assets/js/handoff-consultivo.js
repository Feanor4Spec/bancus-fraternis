(function () {
  'use strict';

  let selectedId = '';

  function qs(selector, root = document) {
    return root.querySelector(selector);
  }

  function escapeHtml(value) {
    return String(value || '')
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

  function operationalItems() {
    return service().enrichList ? service().enrichList(service().list()) : service().list();
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

  function renderMetrics(items) {
    const target = qs('[data-handoff-metrics]');
    if (!target) return;
    const data = service().metrics(items);
    target.innerHTML = `
      <div class="bf-platform-metrics">
        ${metric('Leads locais', data.total, 'strong')}
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
      </div>
      <div class="bf-handoff-action-grid">
        ${actions.length ? actions.map((action) => `
          <article class="bf-handoff-action bf-handoff-action--${escapeHtml(action.tone || 'media')}">
            <span>${escapeHtml(action.source)} - ${escapeHtml(action.age)}</span>
            <strong>${escapeHtml(action.title)}</strong>
            <p>${escapeHtml(action.nextStep)}</p>
            <small>${escapeHtml(action.ownerEmail)} - ${escapeHtml(action.suggestedAssignee || 'responsavel a definir')}</small>
            <button class="btn btn--ghost btn--sm" type="button" data-handoff-open="${escapeHtml(action.id)}">Abrir lead</button>
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
    const type = sourceType(item);
    if (type === 'proposal') {
      return [
        item.sourceProposalStatus ? `status ${item.sourceProposalStatus}` : '',
        item.sourceProposalVersion ? `versao ${item.sourceProposalVersion}` : '',
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

  function card(item) {
    const summary = item.summary || {};
    const status = service().statusLabels[item.status] || item.status;
    const checklist = item.checklist || [];
    const done = checklist.filter((entry) => entry.done).length;
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente local';
    const op = item.operational || (service().operationalState ? service().operationalState(item) : {});
    return `
      <article class="bf-handoff-card${item.id === selectedId ? ' is-selected' : ''}" data-handoff-card="${escapeHtml(item.id)}">
        <div class="bf-handoff-card__top">
          <span class="bf-handoff-status bf-handoff-status--${escapeHtml(item.status)}">${escapeHtml(status)}</span>
          <span class="bf-handoff-priority bf-handoff-priority--${escapeHtml(item.priority)}">${escapeHtml(priorityLabel(item.priority))}</span>
          <span class="bf-handoff-source bf-handoff-source--${escapeHtml(sourceType(item))}">${escapeHtml(sourceLabel(item))}</span>
          <span class="bf-handoff-aging bf-handoff-aging--${escapeHtml(op.tone || 'baixa')}">${escapeHtml(op.slaOverdue ? 'SLA vencido' : op.ageLabel || '-')}</span>
        </div>
        <h3>${escapeHtml(item.objectiveLabel || 'Lead consultivo')}</h3>
        <p>${escapeHtml(ownerLabel)} - ${escapeHtml(summary.productName || '-')} / ${escapeHtml(summary.modelName || '-')}</p>
        <small class="bf-handoff-origin-note">${escapeHtml(sourceSummary(item))}</small>
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
    const rawItem = service().find(selectedId);
    const item = service().enrich ? service().enrich(rawItem) : rawItem;
    if (!item) {
      target.innerHTML = '<div class="bf-empty-state">Selecione um handoff para acompanhar.</div>';
      return;
    }

    const summary = item.summary || {};
    const ownerLabel = item.ownerName || item.ownerEmail || 'Cliente local';
    const op = item.operational || {};
    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--ok">${escapeHtml(sourceLabel(item))}</span>
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
        ${metric('Produto', summary.productName || '-')}
        ${metric('Modelo', summary.modelName || '-')}
        ${metric('Reserva', `${Number(summary.reservaMeses || 0).toFixed(1)} meses`, summary.gapReserva > 0 ? 'warn' : '')}
        ${metric('Capacidade segura', money(summary.capacidadePagamento || 0), 'strong')}
      </div>

      <section class="bf-handoff-next-step bf-handoff-action--${escapeHtml(op.tone || 'media')} bf-platform-section" data-handoff-next-step>
        <span class="bf-badge bf-badge--gold">Proximo passo</span>
        <strong>${escapeHtml(op.nextStep || 'Definir proximo passo')}</strong>
        <p>${escapeHtml(op.slaOverdue ? 'Lead ultrapassou o SLA recomendado para a prioridade atual.' : op.waitingClient ? 'Cliente esta aguardando retorno ha mais de 48 horas.' : op.unassigned ? 'Lead aberto precisa de responsavel antes de seguir.' : 'Lead esta dentro da governanca operacional atual.')}</p>
      </section>

      <section class="bf-handoff-origin-panel bf-platform-section">
        <span class="bf-badge bf-badge--navy">Origem do atendimento</span>
        <p>${escapeHtml(sourceSummary(item))}</p>
      </section>

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
        service().setStatus(status.dataset.handoffStatus, status.value);
        renderList();
      }
      if (assignee) {
        service().assign(assignee.dataset.handoffAssignee, assignee.value);
        renderList();
      }
      if (check) {
        service().toggleChecklist(selectedId, check.dataset.handoffCheck, check.checked);
        renderList();
      }
    });

    qs('[data-handoff-detail]')?.addEventListener('submit', (event) => {
      const form = event.target.closest('[data-handoff-note-form]');
      if (!form) return;
      event.preventDefault();
      service().addNote(form.dataset.handoffNoteForm, form.elements.note.value);
      form.reset();
      renderList();
    });
  }

  document.addEventListener('DOMContentLoaded', () => {
    const user = window.BFAuth && window.BFAuth.requireRole
      ? window.BFAuth.requireRole(['admin', 'consultor'], { redirect: true })
      : null;
    if (!user || !service()) return;
    bindControls();
    renderList();
    document.body.dataset.handoffReady = 'true';
  });
})();
