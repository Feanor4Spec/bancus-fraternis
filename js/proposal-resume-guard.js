/**
 * Pure guards for proposal deep links and client read-only presentation.
 * This module never reads or writes storage and is safe to validate in isolation.
 */
(function proposalResumeGuardModule(root) {
  'use strict';

  function text(value) {
    return String(value == null ? '' : value).trim();
  }

  function isClientReadOnly(input = {}) {
    const role = text(input.role).toLowerCase();
    const proposalView = text(input.proposalView).toLowerCase();
    const backendReadOnly = input.backendReadOnly === true;
    const hash = text(input.hash).toLowerCase();
    const proposalIntent = Boolean(text(input.proposalId))
      || Boolean(text(input.proposalVersionId))
      || proposalView === 'client'
      || proposalView === 'review'
      || backendReadOnly
      || hash === '#proposta'
      || hash === '#step-10';

    if (!proposalIntent) return false;
    if (role === 'cliente') return true;
    if ((role === 'consultor' || role === 'admin') && backendReadOnly) return true;
    return !role && proposalView === 'client';
  }

  function resolveLink(input = {}) {
    const proposalId = text(input.proposalId);
    const proposalVersionId = text(input.proposalVersionId);
    const explicitSimulationId = text(input.explicitSimulationId);
    const linkedSimulationId = text(input.linkedSimulationId);

    if (proposalVersionId && !proposalId) {
      return { ok: false, reason: 'version-without-proposal', simulationId: '' };
    }
    if (proposalId && !linkedSimulationId) {
      return { ok: false, reason: 'proposal-not-linked', simulationId: '' };
    }
    if (explicitSimulationId && linkedSimulationId && explicitSimulationId !== linkedSimulationId) {
      return { ok: false, reason: 'simulation-mismatch', simulationId: '' };
    }

    const simulationId = explicitSimulationId || linkedSimulationId;
    if (!simulationId) return { ok: false, reason: 'simulation-not-found', simulationId: '' };
    return { ok: true, reason: '', simulationId };
  }

  function shouldRecalculateProject(input = {}) {
    if (input.reconciled === true) return false;
    return input.clientReadOnly !== true;
  }

  root.BFProposalResumeGuard = Object.freeze({
    isClientReadOnly,
    resolveLink,
    shouldRecalculateProject
  });
})(typeof window !== 'undefined' ? window : globalThis);
