/**
 * Proposal Experience
 * Presentation and validation shell for the simulator proposal.
 * This module reads existing DOM state only; it never recalculates financial values.
 */
(function proposalExperienceModule() {
  'use strict';

  const OUTLINE = [
    { label: 'Síntese executiva', keywords: ['resumo da proposta', 'numeros estrategicos'] },
    { label: 'Perfil e objetivo', keywords: ['jornada do cliente', 'perfil e objetivo'] },
    { label: 'Projeto multigrupo', keywords: ['composicao do projeto estruturado', 'projeto multigrupo'] },
    { label: 'Grupos selecionados', keywords: ['grupos selecionados', 'composicao do projeto'] },
    { label: 'Valores contratados', keywords: ['estrutura financeira', 'numeros estrategicos'] },
    { label: 'Estratégia de lance', keywords: ['lance e estrategia', 'lance e contemplacao'] },
    { label: 'Evolução das parcelas', keywords: ['contribuicoes e parcelas', 'projecoes da operacao'] },
    { label: 'Eventos', keywords: ['eventos relevantes', 'cronograma mensal'] },
    { label: 'Comparação', keywords: ['com lance vs sem lance', 'comparacao'] },
    { label: 'Riscos', keywords: ['riscos para explicar', 'resultado como decisao'] },
    { label: 'Cronograma', keywords: ['cronograma mensal de parcelas', 'cronograma mensal'] },
    { label: 'Memória de cálculo', keywords: ['memoria de calculo', 'formulas explicadas'] },
    { label: 'Fontes e premissas', keywords: ['premissas finais', 'premissas que sustentam'] },
    { label: 'Aceite e próximos passos', keywords: ['governanca e aceite', 'proximos passos'] }
  ];

  const METRIC_LABELS = {
    credit: ['credito total', 'credito contratado'],
    'net-credit': ['caixa liquida', 'credito liquido'],
    installment: ['parcela atual', 'parcela inicial', 'proxima parcela'],
    bid: ['lance total', 'lance sugerido']
  };

  let refreshFrame = 0;
  let lastSavedLabel = '';
  let proposalBlocks = [];
  let publication = null;
  let publishing = false;
  let clientModeLocked = false;

  function byId(id) {
    return document.getElementById(id);
  }

  function normalize(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/\s+/g, ' ')
      .trim()
      .toLowerCase();
  }

  function setText(target, value) {
    const element = typeof target === 'string' ? byId(target) : target;
    if (element && element.textContent !== value) element.textContent = value;
  }

  function valueOf(id) {
    const field = byId(id);
    return field ? String(field.value || '').trim() : '';
  }

  function formatDate(value) {
    if (!value) return '';
    const parts = String(value).split('-');
    if (parts.length !== 3) return value;
    return `${parts[2]}/${parts[1]}/${parts[0]}`;
  }

  function formatNow() {
    return new Intl.DateTimeFormat('pt-BR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date());
  }

  function preferredScrollBehavior() {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth';
  }

  function findProjectIdentity() {
    const selectedRow = document.querySelector('.selected-group-row');
    if (selectedRow) {
      const admin = selectedRow.querySelector('.sg-admin-nome')?.textContent.trim() || '';
      const group = selectedRow.querySelector('.sg-grupo-cod')?.textContent.trim() || '';
      return {
        title: admin || 'Projeto estruturado',
        detail: group ? `Grupo ${group}` : 'Grupo selecionado'
      };
    }

    const proposalRow = document.querySelector('#proposta-container .ps-project-table tbody tr');
    if (proposalRow) {
      const cells = proposalRow.querySelectorAll('td');
      const group = cells[0]?.textContent.trim() || '';
      const admin = cells[1]?.textContent.trim() || '';
      return {
        title: admin || 'Projeto estruturado',
        detail: group ? `Grupo ${group}` : 'Projeto calculado'
      };
    }

    const client = valueOf('nomeCliente');
    return {
      title: client ? `Proposta de ${client}` : 'Nova simulação',
      detail: client ? 'Cliente identificado' : 'Informe o cliente e o objetivo'
    };
  }

  function proposalRoot() {
    return document.querySelector('#proposta-container .ps-page');
  }

  function syncProposalCover() {
    // A capa editorial pertence ao preview. O documento canônico já possui sua
    // própria capa e permanece a única fonte para impressão/PDF e link público.
    return undefined;
  }

  function proposalId() {
    const text = proposalRoot()?.textContent || '';
    const match = text.match(/(?:PROP|CP)-\d{4}-\d{3,6}(?:-[A-Z0-9]{4,12})?/i);
    return match ? match[0].toUpperCase() : 'ID pendente';
  }

  function acceptanceReady() {
    const panel = byId('proposal-acceptance-panel');
    return Boolean(panel && panel.dataset.proposalAcceptanceReady === 'true');
  }

  function versionCount() {
    const panel = byId('proposal-version-panel');
    const count = Number(panel?.dataset.proposalVersionCount || 0);
    return Number.isFinite(count) ? count : 0;
  }

  function readMetric(labels) {
    const expected = labels.map(normalize);
    const cards = document.querySelectorAll('#proposta-container .ps-kpi, #proposta-container [data-simulator-result-comparison] article');
    for (const card of cards) {
      const label = normalize(card.querySelector('.ps-kpi__label, span')?.textContent || '');
      if (!expected.some((candidate) => label.includes(candidate))) continue;
      const value = card.querySelector('strong')?.textContent.trim();
      if (value) return value;
    }
    return 'Aguardando cálculo';
  }

  function validationState() {
    const calculated = Boolean(proposalRoot() && normalize(proposalRoot().textContent).length > 120);
    const selectedProject = Boolean(
      document.querySelector('.selected-group-row') ||
      document.querySelector('#proposta-container .ps-project-table tbody tr')
    );
    const requiredData = Boolean(
      valueOf('consultor') &&
      valueOf('nomeCliente') &&
      valueOf('clienteEmail') &&
      valueOf('clienteTelefone') &&
      selectedProject
    );
    const premises = acceptanceReady();
    const pdfStructure = Boolean(
      calculated &&
      document.querySelector('#proposal-builder-board .proposal-builder-readiness--ok')
    );
    const validUntil = valueOf('proposalValidUntil');
    const validity = Boolean(premises && validUntil);

    const releaseIssues = typeof window.App?.getProposalReleaseIssues === 'function'
      ? window.App.getProposalReleaseIssues()
      : [];

    return {
      calculated,
      requiredData,
      premises,
      pdfStructure,
      validity,
      releaseIssues,
      clientReady: calculated && premises && pdfStructure && validity,
      ready: calculated && requiredData && premises && pdfStructure && validity && releaseIssues.length === 0
    };
  }

  function syncHeader(state) {
    const project = findProjectIdentity();
    const count = versionCount();
    const id = proposalId();
    const generatedDate = formatDate(valueOf('dataSimulacao')) || 'Aguardando cálculo';
    let status = 'Em preenchimento';

    if (publication?.status === 'active') status = 'Link disponível';
    else if (publication?.status === 'revoked') status = 'Link desativado';
    else if (publishing) status = 'Criando link';
    else if (clientModeLocked && state.clientReady) status = 'Pronta para conferir';
    else if (state.ready) status = 'Pronta para enviar';
    else if (state.calculated) status = 'Em conferência';

    setText('sim-evolution-project-name', project.title);
    setText('sim-evolution-project-detail', project.detail);
    setText('sim-evolution-status', status);
    setText('sim-evolution-version', `v${Math.max(1, count)}.0`);
    setText('sim-evolution-saved', lastSavedLabel || (count > 0 ? 'Versão local registrada' : 'Aguardando salvamento'));
    setText('proposal-command-status', status);
    setText('proposal-meta-date', generatedDate);
    setText('proposal-meta-id', id);
    setText('proposal-cover-id', id);
    setText('proposal-meta-validity', formatDate(valueOf('proposalValidUntil')) || 'Definir antes de enviar');

    const databasePanel = byId('database-status-panel');
    const baseLabel = databasePanel?.dataset.state === 'success' ? 'Base de grupos conectada' : 'Base local';
    setText('proposal-meta-base', baseLabel);
    setText('proposal-meta-engine', `ConsórcioPro ${window.ConsorcioEngine?.VERSION || '2.0.0'}`);

    Object.entries(METRIC_LABELS).forEach(([key, labels]) => {
      setText(document.querySelector(`[data-proposal-metric="${key}"]`), readMetric(labels));
    });
  }

  function syncValidationItem(key, ready, readyLabel) {
    const item = document.querySelector(`[data-proposal-check="${key}"]`);
    if (!item) return;
    item.dataset.state = ready ? 'ready' : 'pending';
    const status = item.querySelector('small');
    if (status) status.textContent = ready ? readyLabel : 'Aguardando';
  }

  function syncValidationPanel(state) {
    syncValidationItem('calculation', state.calculated, 'Concluído');
    syncValidationItem('required-data', state.requiredData, 'Conferido');
    syncValidationItem('premises', state.premises, 'Revisado');
    syncValidationItem('pdf-structure', state.pdfStructure, 'Estruturado');
    syncValidationItem('validity', state.validity, 'Vigente');

    const result = document.querySelector('[data-proposal-validation-result]');
    if (result) {
      result.dataset.state = state.ready ? 'ready' : 'pending';
      setText(result.querySelector('strong'), state.ready ? 'Tudo pronto' : 'Conferência pendente');
      setText(
        result.querySelector('span'),
        state.ready ? 'Proposta conferida e pronta para compartilhar.' : 'Revise os itens antes de compartilhar.'
      );
    }

    ['btn-proposal-publish', 'btn-proposal-publish-bottom'].forEach((id) => {
      const button = byId(id);
      if (!button) return;
      const disabled = !state.ready || publishing || publication?.status === 'active';
      button.disabled = disabled;
      button.setAttribute('aria-disabled', String(disabled));
    });

    const feedback = byId('proposal-evolution-feedback');
    if (feedback && !publication && !publishing) {
      feedback.dataset.tone = state.ready ? 'success' : 'warning';
      feedback.textContent = state.ready
        ? 'Conferência concluída. A proposta está pronta para compartilhar.'
        : state.releaseIssues?.[0] || 'Conclua a conferência para gerar o link.';
    }
  }

  function collectProposalBlocks() {
    const root = proposalRoot();
    if (!root) return [];
    return Array.from(root.children).filter((element) => (
      element.matches('.ps-header, .ps-section, .ps-footer')
    ));
  }

  function findBlock(config, index, blocks) {
    for (const keyword of config.keywords) {
      const match = blocks.find((block) => normalize(block.textContent).includes(keyword));
      if (match) return match;
    }
    if (index === OUTLINE.length - 1 && blocks.length) return blocks[blocks.length - 1];
    return blocks[index] || null;
  }

  function syncOutline(state) {
    proposalBlocks = collectProposalBlocks();
    const buttons = document.querySelectorAll('#proposal-evolution-outline [data-outline-index]');

    buttons.forEach((button) => {
      const index = Number(button.dataset.outlineIndex || 0);
      const config = OUTLINE[index];
      const target = config ? findBlock(config, index, proposalBlocks) : null;
      const status = button.querySelector('small');

      if (target) {
        target.id = target.id || `proposal-evolution-block-${String(index + 1).padStart(2, '0')}`;
        button.dataset.outlineTarget = target.id;
        button.dataset.outlineState = state.premises ? 'reviewed' : 'included';
        button.disabled = false;
        if (status) status.textContent = state.premises ? 'Revisado' : 'Incluído';
      } else {
        delete button.dataset.outlineTarget;
        button.dataset.outlineState = 'pending';
        button.disabled = true;
        if (status) status.textContent = 'Aguardando';
      }
    });
  }

  function enhanceDynamicLabels() {
    document.querySelectorAll('.cart-field').forEach((field) => {
      const input = field.querySelector('input, select, textarea');
      const label = field.querySelector('label')?.textContent.trim();
      if (input && label && !input.getAttribute('aria-label')) input.setAttribute('aria-label', label);
    });

    const cartLabels = {
      valorCartaUnitario: 'Valor da carta do grupo',
      quantidadeCotas: 'Quantidade de cotas do grupo'
    };
    document.querySelectorAll('.campo-input-usuario input[data-campo]').forEach((input) => {
      if (!input.getAttribute('aria-label')) {
        input.setAttribute('aria-label', cartLabels[input.dataset.campo] || 'Parâmetro editável do grupo');
      }
    });
  }

  function syncActiveStep() {
    const active = document.querySelector('.step-section.step-section--active');
    const step = Number(active?.id?.replace('step-', '') || 1);
    document.body.dataset.activeStep = String(step);

    document.querySelectorAll('[data-evolution-step]').forEach((button) => {
      const buttonStep = Number(button.dataset.evolutionStep || 0);
      const isActive = buttonStep === step;
      button.classList.toggle('is-active', isActive);
      button.classList.toggle('is-complete', buttonStep < step);
      if (isActive) button.setAttribute('aria-current', 'step');
      else button.removeAttribute('aria-current');
    });

    if (step === 10 && isDashboardProposalContext()) {
      setClientMode(true, { locked: true });
    } else if (step !== 10 && document.body.classList.contains('proposal-client-mode')) {
      setClientMode(false);
    }
  }

  function scheduleRefresh() {
    if (refreshFrame) return;
    refreshFrame = window.requestAnimationFrame(() => {
      refreshFrame = 0;
      syncProposalCover();
      const state = validationState();
      syncActiveStep();
      syncHeader(state);
      syncValidationPanel(state);
      syncOutline(state);
      enhanceDynamicLabels();
    });
  }

  function reorderFinalSteps() {
    const main = document.querySelector('.sim-main');
    const comparison = byId('step-9');
    const proposal = byId('step-10');
    if (!main || !comparison || !proposal) return;
    if (proposal.compareDocumentPosition(comparison) & Node.DOCUMENT_POSITION_FOLLOWING) {
      main.insertBefore(comparison, proposal);
    }
  }

  function isDashboardProposalContext() {
    try {
      const params = new URLSearchParams(window.location.search || '');
      const input = {
        role: window.BFAuth?.getCurrentUser?.()?.role || '',
        proposalView: params.get('proposalView') || '',
        proposalId: params.get('proposalId') || '',
        proposalVersionId: params.get('proposalVersionId') || '',
        hash: window.location.hash || '',
        targetStep: Number(document.body.dataset.activeStep || 0)
      };
      if (window.BFProposalResumeGuard?.isClientReadOnly) {
        return window.BFProposalResumeGuard.isClientReadOnly(input);
      }
      return input.role === 'cliente' && Boolean(
        input.proposalId || input.proposalVersionId || ['#proposta', '#step-10'].includes(input.hash)
      );
    } catch (error) {
      return false;
    }
  }

  function currentUserIsClient() {
    try {
      return window.BFAuth?.getCurrentUser?.()?.role === 'cliente';
    } catch (error) {
      return false;
    }
  }

  function setClientMode(enabled, options = {}) {
    clientModeLocked = Boolean(enabled && options.locked);
    document.body.classList.toggle('proposal-client-mode', enabled);
    document.body.classList.toggle('proposal-client-readonly', clientModeLocked);
    const button = byId('btn-proposal-client-mode');
    if (button) {
      button.setAttribute('aria-pressed', String(enabled));
      button.innerHTML = enabled
        ? '<img src="../assets/icons/ui/ui-arrow.svg" alt=""> Voltar à edição'
        : '<img src="../assets/icons/ui/ui-users.svg" alt=""> Visualizar como cliente';
    }

    const returnButton = byId('btn-proposal-client-return');
    if (returnButton) {
      returnButton.hidden = !enabled;
      returnButton.innerHTML = clientModeLocked
        ? '<img src="../assets/icons/ui/ui-arrow.svg" alt=""> Voltar ao painel'
        : '<img src="../assets/icons/ui/ui-arrow.svg" alt=""> Voltar à edição';
    }

    const heading = document.querySelector('#step-10 .proposal-evolution-heading');
    const eyebrow = heading?.querySelector('.section-header__eyebrow');
    const title = heading?.querySelector('h2');
    const description = heading?.querySelector('p');
    setText(eyebrow, enabled ? 'Proposta de consórcio' : 'Etapa 10 de 10 · Proposta final');
    setText(title, enabled ? 'Confira sua proposta.' : 'Revise a proposta antes de enviar.');
    setText(
      description,
      enabled
        ? 'Veja os grupos, valores, lances, parcelas e condições desta simulação.'
        : 'Confira valores, condições e pontos de atenção.'
    );
  }

  function publicationDays(validUntil) {
    if (!validUntil) return 30;
    const target = new Date(`${validUntil}T23:59:59`);
    if (!Number.isFinite(target.getTime())) return 30;
    const days = Math.ceil((target.getTime() - Date.now()) / (24 * 60 * 60 * 1000));
    return Math.max(1, Math.min(365, days));
  }

  function publicProposalUrl(token) {
    return `${window.location.origin}/pages/proposta.html#${encodeURIComponent(token)}`;
  }

  function publicationMessage(message, tone = 'warning') {
    const feedback = byId('proposal-evolution-feedback');
    if (feedback) {
      feedback.dataset.tone = tone;
      feedback.textContent = message;
    }
  }

  function hasPublicationSession(session) {
    return Boolean(session && (
      session.token
      || (session.mode === 'production' && session.user && session.user.id)
    ));
  }

  function syncSharePanel() {
    const panel = byId('proposal-share-panel');
    if (!panel || !publication) return;
    panel.hidden = false;
    panel.dataset.status = publication.status;
    const active = publication.status === 'active';
    setText('proposal-share-status', active ? 'Pronto para enviar' : 'Link desativado');
    setText('proposal-share-expiry', active
      ? `Válida até ${new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(publication.expiresAt))}`
      : 'O link não está mais disponível.');
    const input = byId('proposal-share-link');
    if (input) input.value = publication.url || '';
    const open = byId('btn-proposal-open-link');
    const copy = byId('btn-proposal-copy-link');
    const revoke = byId('btn-proposal-revoke');
    [open, copy, revoke].filter(Boolean).forEach((button) => { button.disabled = !active; });
  }

  async function publishSecureProposal() {
    if (clientModeLocked || currentUserIsClient()) {
      publicationMessage('Esta proposta está disponível apenas para conferência.');
      window.App?.showToast?.('Esta proposta está disponível apenas para conferência.', 'info');
      return;
    }
    const state = validationState();
    if (!state.ready) {
      publicationMessage(state.releaseIssues?.[0] || 'A proposta ainda possui itens pendentes. Abra Revisão e validade para conferir.');
      byId('proposal-validation-title')?.focus?.();
      return;
    }

    const api = window.BFBackendApi;
    const session = api?.readSession?.();
    if (!api?.createProposalSnapshot || !hasPublicationSession(session)) {
      publicationMessage('Entre no portal com um usuário autorizado para compartilhar esta proposta.');
      window.App?.showToast?.('Entre para compartilhar esta proposta.', 'error');
      return;
    }

    const prepared = window.App?.getProposalPublicationPayload?.();
    if (!prepared?.ok) {
      const message = prepared?.issues?.[0] || 'Não foi possível preparar a proposta para compartilhamento.';
      publicationMessage(message);
      window.App?.showToast?.(message, 'error');
      return;
    }

    publishing = true;
    publicationMessage('Preparando o link da proposta...', 'info');
    scheduleRefresh();

    try {
      const created = await api.createProposalSnapshot(prepared.payload);
      if (!created?.ok || !created.snapshot?.id) throw new Error(created?.message || 'Não foi possível preparar o envio.');

      const validated = await api.transitionProposalSnapshot(created.snapshot.id, 'validada', {
        provenance: { validationGate: 'financial-reconciliation-passed' }
      });
      if (!validated?.ok || !validated.snapshot?.id) throw new Error(validated?.message || 'Não foi possível conferir os dados da proposta.');

      const reviewed = await api.transitionProposalSnapshot(validated.snapshot.id, 'revisada', {
        review: prepared.payload.review,
        provenance: { reviewGate: 'human-review-passed' }
      });
      if (!reviewed?.ok || !reviewed.snapshot?.id) throw new Error(reviewed?.message || 'Não foi possível concluir a conferência.');

      const published = await api.publishProposalSnapshot(reviewed.snapshot.id, publicationDays(prepared.payload.review.validUntil));
      if (!published?.ok || !published.token || !published.share?.id) {
        throw new Error(published?.message || 'Não foi possível criar o link da proposta.');
      }

      publication = {
        status: 'active',
        shareId: published.share.id,
        snapshotId: published.share.snapshotId,
        token: published.token,
        url: publicProposalUrl(published.token),
        expiresAt: published.share.expiresAt
      };
      document.body.dataset.proposalPublicationStatus = 'active';
      syncSharePanel();
      publicationMessage('Link criado. A proposta está pronta para enviar ao cliente.', 'success');
      window.App?.showToast?.('Link da proposta criado.', 'success');
    } catch (error) {
      publicationMessage(error && error.message ? error.message : 'Não foi possível gerar o link da proposta.');
      window.App?.showToast?.('Não foi possível gerar o link da proposta.', 'error');
    } finally {
      publishing = false;
      scheduleRefresh();
    }
  }

  async function copyPublicationLink() {
    if (!publication?.url || publication.status !== 'active') return;
    try {
      await navigator.clipboard.writeText(publication.url);
    } catch (error) {
      const input = byId('proposal-share-link');
      input?.select?.();
      document.execCommand?.('copy');
    }
    window.App?.showToast?.('Link copiado.', 'success');
  }

  function openPublicationLink() {
    if (!publication?.url || publication.status !== 'active') return;
    window.open(publication.url, '_blank', 'noopener,noreferrer');
  }

  async function revokePublication() {
    if (!publication?.shareId || publication.status !== 'active') return;
    if (!window.confirm('Desativar o link desta proposta agora?')) return;
    const result = await window.BFBackendApi?.revokeProposalShare?.(publication.shareId);
    if (!result?.ok) {
      publicationMessage(result?.message || 'Não foi possível desativar o link.');
      return;
    }
    publication.status = 'revoked';
    document.body.dataset.proposalPublicationStatus = 'revoked';
    syncSharePanel();
    publicationMessage('Link desativado. A proposta continua salva.', 'success');
    window.App?.showToast?.('Link desativado.', 'warning');
    scheduleRefresh();
  }

  function openGovernance() {
    const drawer = byId('proposal-control-drawer');
    if (!drawer) return;
    drawer.open = true;
    const target = byId('proposal-acceptance-panel') || drawer;
    target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    window.setTimeout(() => {
      const focusTarget = byId('proposalReviewer') || drawer.querySelector('input, button');
      focusTarget?.focus?.();
    }, 360);
  }

  function bindControls() {
    byId('btn-proposal-client-mode')?.addEventListener('click', () => {
      setClientMode(!document.body.classList.contains('proposal-client-mode'));
    });

    byId('btn-proposal-client-return')?.addEventListener('click', () => {
      if (clientModeLocked) {
        window.location.assign('dashboard-cliente.html');
        return;
      }
      setClientMode(false);
    });

    ['btn-proposal-publish', 'btn-proposal-publish-bottom'].forEach((id) => {
      byId(id)?.addEventListener('click', publishSecureProposal);
    });

    byId('btn-proposal-copy-link')?.addEventListener('click', copyPublicationLink);
    byId('btn-proposal-open-link')?.addEventListener('click', openPublicationLink);
    byId('btn-proposal-revoke')?.addEventListener('click', revokePublication);

    byId('btn-proposal-validity')?.addEventListener('click', openGovernance);

    byId('btn-proposal-outline-collapse')?.addEventListener('click', (event) => {
      const panel = event.currentTarget.closest('.proposal-outline-panel');
      const collapsed = panel?.classList.toggle('is-collapsed') || false;
      document.body.classList.toggle('proposal-outline-collapsed', collapsed);
      event.currentTarget.setAttribute('aria-expanded', String(!collapsed));
      event.currentTarget.innerHTML = collapsed
        ? '<img src="../assets/icons/ui/ui-arrow.svg" alt=""> Ver conteúdo'
        : '<img src="../assets/icons/ui/ui-arrow.svg" alt=""> Ocultar conteúdo';
    });

    byId('proposal-evolution-outline')?.addEventListener('click', (event) => {
      const button = event.target.closest('[data-outline-index]');
      if (!button || button.disabled) return;
      const target = byId(button.dataset.outlineTarget);
      if (!target) return;
      document.querySelectorAll('#proposal-evolution-outline button').forEach((item) => item.classList.remove('is-active'));
      button.classList.add('is-active');
      target.scrollIntoView({ behavior: preferredScrollBehavior(), block: 'start' });
    });

    byId('btn-salvar')?.addEventListener('click', () => {
      window.setTimeout(() => {
        lastSavedLabel = `Salvamento solicitado em ${formatNow()}`;
        scheduleRefresh();
      }, 160);
    });

    document.addEventListener('input', scheduleRefresh, true);
    document.addEventListener('change', scheduleRefresh, true);

    document.addEventListener('click', (event) => {
      const cta = event.target.closest('[data-simulator-result-cta]');
      if (!cta || !window.App?.goToStep) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      window.App.goToStep(10);
    }, true);
  }

  function observeState() {
    const stepObserver = new MutationObserver(scheduleRefresh);
    document.querySelectorAll('.step-section').forEach((section) => {
      stepObserver.observe(section, { attributes: true, attributeFilter: ['class'] });
    });

    const contentObserver = new MutationObserver(scheduleRefresh);
    [
      byId('proposta-container'),
      byId('proposal-builder-board'),
      byId('proposal-acceptance-panel'),
      byId('proposal-version-panel'),
      byId('selected-groups-panel')
    ].filter(Boolean).forEach((element) => {
      contentObserver.observe(element, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [
          'data-proposal-acceptance-ready',
          'data-proposal-version-count',
          'data-proposal-acceptance-status'
        ]
      });
    });
  }

  function init() {
    reorderFinalSteps();
    bindControls();
    observeState();
    scheduleRefresh();
  }

  window.ProposalExperience = Object.freeze({
    refresh: scheduleRefresh,
    setClientMode,
    validationState,
    hasPublicationSession,
    publishSecureProposal
  });

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
