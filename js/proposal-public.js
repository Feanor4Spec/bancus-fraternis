(function publicProposalPage() {
  'use strict';

  const byId = (id) => document.getElementById(id);

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
    byId('public-proposal-error-message').textContent = message || 'O link expirou ou não está mais disponível. Peça um novo link ao consultor.';
    byId('public-proposal-status').textContent = 'Proposta indisponível';
    document.title = 'Proposta indisponível | Bancus Fraternis';
  }

  function bindActions() {
    byId('public-proposal-print').addEventListener('click', () => {
      ProposalSummary.print('#public-proposal-export-root');
    });
  }

  async function load() {
    const token = tokenFromLocation();
    if (!token) {
      setError('Este link está incompleto. Peça um novo link ao consultor.');
      return;
    }

    const api = window.BFBackendApi;
    if (!api?.getPublicProposal || typeof ProposalSummary === 'undefined') {
      setError('Não foi possível abrir a proposta agora. Tente novamente em alguns instantes.');
      return;
    }

    const response = await api.getPublicProposal(token);
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
    document.title = `${publicProposalData.id || 'Proposta'} | Bancus Fraternis`;
    bindActions();
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', load);
  else load();
})();
