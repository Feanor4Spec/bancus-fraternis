(function publicProposalPage() {
  'use strict';

  const byId = (id) => document.getElementById(id);
  let proposalToken = '';
  let interestBusy = false;

  function tokenFromLocation() {
    const raw = String(window.location.hash || '').replace(/^#/, '');
    if (!raw) return '';
    try {
      const token = decodeURIComponent(raw);
      return /^[A-Za-z0-9_-]{40,160}$/.test(token) ? token : '';
    } catch (error) {
      return '';
    }
  }

  function formatDate(value) {
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return 'Não informada';
    return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'long', timeStyle: 'short' }).format(date);
  }

  function formatMoney(value) {
    const amount = Number(value);
    if (!Number.isFinite(amount)) return 'Não informado';
    return amount.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  }

  function setError(message) {
    byId('public-proposal-loading').hidden = true;
    byId('public-proposal-error').hidden = false;
    byId('public-proposal-actions').hidden = true;
    byId('public-proposal-interest').hidden = true;
    byId('public-proposal-error-message').textContent = message || 'O link expirou ou não está mais disponível. Peça um novo link ao consultor.';
    byId('public-proposal-status').textContent = 'Proposta indisponível';
    document.title = 'Proposta indisponível | Bancus Fraternis';
  }

  function renderInterest(interest = null, options = {}) {
    const panel = byId('public-proposal-interest');
    if (!panel) return;
    panel.hidden = false;
    const status = interest?.status || (options.error ? 'error' : 'idle');
    panel.dataset.proposalInterestState = status;
    const title = byId('public-proposal-interest-title');
    const copy = byId('public-proposal-interest-copy');
    const feedback = byId('public-proposal-interest-status');
    const buttons = Array.from(document.querySelectorAll('[data-public-proposal-interest]'));

    if (status === 'requested') {
      title.textContent = 'Pedido recebido.';
      copy.textContent = 'Um consultor acompanhará esta proposta e orientará os próximos passos.';
    } else if (status === 'in_progress') {
      title.textContent = 'Seu atendimento está em andamento.';
      copy.textContent = 'A equipe já está acompanhando esta proposta.';
    } else if (status === 'closed') {
      title.textContent = 'Atendimento concluído.';
      copy.textContent = 'Se precisar retomar, fale com seu consultor pelos canais já combinados.';
    } else {
      title.textContent = 'Quer conversar sobre esta proposta?';
      copy.textContent = 'Peça um contato para tirar dúvidas sobre valores, lances, parcelas e condições.';
    }

    feedback.textContent = options.error || (interestBusy ? 'Registrando seu pedido...' : '');
    buttons.forEach((button) => {
      const complete = ['requested', 'in_progress', 'closed'].includes(status);
      button.disabled = interestBusy || complete;
      button.setAttribute('aria-disabled', String(button.disabled));
      button.textContent = complete ? 'Pedido registrado' : (interestBusy ? 'Registrando...' : 'Quero falar com um consultor');
    });
  }

  async function requestInterest() {
    if (interestBusy || !proposalToken) return;
    const api = window.BFBackendApi;
    if (!api?.requestPublicProposalInterest) {
      renderInterest(null, { error: 'Não foi possível registrar o pedido agora. Tente novamente.' });
      return;
    }
    interestBusy = true;
    byId('public-proposal-status').textContent = 'Registrando pedido de contato';
    renderInterest();
    const response = await api.requestPublicProposalInterest(proposalToken);
    interestBusy = false;
    if (!response?.ok || !response.interest) {
      if ([404, 410].includes(Number(response?.status))) {
        setError('O link expirou ou não está mais disponível. Peça um novo link ao consultor.');
        return;
      }
      renderInterest(null, { error: 'Não foi possível registrar o pedido. Tente novamente.' });
      byId('public-proposal-status').textContent = 'Não foi possível registrar. Tente novamente.';
      return;
    }
    renderInterest(response.interest);
    byId('public-proposal-status').textContent = 'Pedido de contato recebido';
  }

  function bindActions() {
    byId('public-proposal-print').addEventListener('click', () => {
      ProposalSummary.print('#public-proposal-export-root');
    });
    document.querySelectorAll('[data-public-proposal-interest]').forEach((button) => {
      button.addEventListener('click', requestInterest);
    });
  }

  async function load() {
    proposalToken = tokenFromLocation();
    if (!proposalToken) {
      setError('Este link está incompleto. Peça um novo link ao consultor.');
      return;
    }

    const api = window.BFBackendApi;
    if (!api?.getPublicProposal || typeof ProposalSummary === 'undefined') {
      setError('Não foi possível abrir a proposta agora. Tente novamente em alguns instantes.');
      return;
    }

    const response = await api.getPublicProposal(proposalToken);
    if (!response?.ok || !response.snapshot) {
      setError('O link expirou ou não está mais disponível. Peça um novo link ao consultor.');
      return;
    }

    const snapshot = response.snapshot;
    const proposalData = snapshot.result?.proposalData;
    if (!proposalData || !proposalData.metrics || !proposalData.schedule) {
      setError('Não foi possível abrir esta proposta. Peça um novo link ao consultor.');
      return;
    }
    const publicProposalData = {
      ...proposalData,
      cliente: proposalData.cliente || 'Cliente da proposta',
      consultor: proposalData.consultor || 'Bancus Fraternis'
    };

    ProposalSummary.render(byId('public-proposal-container'), {
      proposalData: publicProposalData,
      builder: snapshot.result?.builder || {}
    }, {
      rootId: 'public-proposal-export-root',
      chartPrefix: 'public-proposal',
      surface: 'public'
    });

    byId('public-proposal-loading').hidden = true;
    byId('public-proposal-actions').hidden = false;
    byId('public-proposal-facts').hidden = false;
    byId('public-proposal-status').textContent = 'Disponível para consulta';
    byId('public-proposal-engine').textContent = publicProposalData.id || 'Não informado';
    byId('public-proposal-base').textContent = formatMoney(publicProposalData.metrics.creditoTotal);
    byId('public-proposal-version').textContent = formatMoney(publicProposalData.metrics.parcelaAtual);
    byId('public-proposal-expiry').textContent = formatDate(response.expiresAt);
    renderInterest(response.interest || null);
    document.title = `${publicProposalData.id || 'Proposta'} | Bancus Fraternis`;
    bindActions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
