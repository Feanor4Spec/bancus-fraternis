/**
 * Bancus Fraternis - Versionamento local da proposta
 * Guarda snapshots comparaveis da proposta antes de PDF e handoff.
 */

const BFProposalVersions = (() => {
  'use strict';

  const STORAGE_KEY = 'bank_fratern_proposal_versions_v1';
  const SCHEMA = 'bank-fratern.proposal-version.v1';
  const MAX_ITEMS = 120;

  function storage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (e) {
      return null;
    }
  }

  function loadAll() {
    try {
      const store = storage();
      if (!store) return [];
      const parsed = JSON.parse(store.getItem(STORAGE_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (e) {
      console.warn('BFProposalVersions: erro ao carregar historico', e);
      return [];
    }
  }

  function saveAll(items) {
    try {
      const store = storage();
      if (!store) return false;
      store.setItem(STORAGE_KEY, JSON.stringify(Array.isArray(items) ? items : []));
      return true;
    } catch (e) {
      console.error('BFProposalVersions: erro ao salvar historico', e);
      return false;
    }
  }

  function currentActorEmail() {
    try {
      const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
      return user && user.email ? user.email : '';
    } catch (e) {
      return '';
    }
  }

  function publishBackendSnapshot(type, payload, meta) {
    try {
      const api = window.BFBackendApi;
      if (!api || typeof api.recordSnapshot !== 'function') return;
      api.recordSnapshot(type, payload || {}, meta || {}).catch(() => {});
    } catch (e) {
      // Integracao opcional para localhost; historico local segue como fonte primaria.
    }
  }

  function publishProposalVersionSnapshot(record) {
    if (!record || !record.id) return;
    publishBackendSnapshot('proposal-version', record, {
      id: `SNP-PV-${record.id}`,
      source: 'proposal-versioning',
      ownerEmail: '',
      actorEmail: currentActorEmail(),
      entityId: record.proposalId || record.id,
      title: record.label || `Versao ${record.version || ''}`.trim(),
      status: record.status || 'draft',
      storageKey: STORAGE_KEY,
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || ''
    });
  }

  function cleanText(value, max = 160) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function number(value) {
    const parsed = Number(value || 0);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function clone(value) {
    try {
      return JSON.parse(JSON.stringify(value == null ? null : value));
    } catch (e) {
      return null;
    }
  }

  function stableStringify(value) {
    if (value === null || typeof value !== 'object') return JSON.stringify(value);
    if (Array.isArray(value)) return `[${value.map(stableStringify).join(',')}]`;
    return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableStringify(value[key])}`).join(',')}}`;
  }

  function hash(value) {
    const text = stableStringify(value);
    let result = 0;
    for (let i = 0; i < text.length; i += 1) {
      result = ((result << 5) - result) + text.charCodeAt(i);
      result |= 0;
    }
    return Math.abs(result).toString(36).toUpperCase();
  }

  function countSelected(group) {
    return Object.values(group || {}).filter(Boolean).length;
  }

  function countTotal(group) {
    return Object.keys(group || {}).length;
  }

  function summarizeBuilder(builder) {
    const source = builder && typeof builder === 'object' ? builder : {};
    return {
      sections: countSelected(source.sections),
      sectionsTotal: countTotal(source.sections),
      charts: countSelected(source.charts),
      chartsTotal: countTotal(source.charts),
      concepts: countSelected(source.concepts),
      conceptsTotal: countTotal(source.concepts),
      formulas: countSelected(source.formulas),
      formulasTotal: countTotal(source.formulas),
      raw: clone(source) || {}
    };
  }

  function projectGroups(proposal, context) {
    const project = proposal && proposal.project ? proposal.project : (context && context.project ? context.project : {});
    const items = Array.isArray(project && project.itens) ? project.itens : [];
    return items.slice(0, 12).map((item, index) => ({
      index: index + 1,
      administradora: cleanText(item.administradora || item.nomeAdministradora || item.admin || '', 80),
      grupo: cleanText(item.codigoGrupo || item.grupo || item.idGrupo || '', 60),
      segmento: cleanText(item.nomeSegmento || item.segmento || item.tipoBem || '', 80),
      cotas: number(item.quantidadeCotas || item.cotas || 1),
      carta: number(item.valorCartaTotal || item.valorCartaRef || item.valorCarta || 0),
      prazo: number(item.prazoMeses || item.prazo || 0)
    }));
  }

  function metricsFrom(proposal) {
    const metrics = proposal && proposal.metrics ? proposal.metrics : {};
    return {
      creditoTotal: number(metrics.creditoTotal || metrics.valorCredito),
      parcelaAtual: number(metrics.parcelaAtual || metrics.parcelaInicial),
      totalPlano: number(metrics.totalPlano),
      totalPago: number(metrics.totalPago),
      cartaLiquida: number(metrics.caixaLiquida || metrics.cartaLiquida),
      saldoDevedor: number(metrics.saldoDevedor),
      prazo: number(metrics.prazo || metrics.prazoTotal),
      prazoRestante: number(metrics.prazoRestante),
      percentualPago: number(metrics.percentualPago)
    };
  }

  function lancesFrom(proposal) {
    const lances = proposal && proposal.lances ? proposal.lances : {};
    return {
      lanceProprio: number(lances.lanceProprio),
      lanceEmbutido: number(lances.lanceEmbutido),
      lanceTotal: number(lances.lanceTotal)
    };
  }

  function snapshot(proposal = {}, context = {}) {
    const acceptance = context.acceptance || {};
    const builder = summarizeBuilder(context.builder || {});
    const proposalId = cleanText(proposal.id || context.proposalId || 'PROP-PENDENTE', 80);
    const metrics = metricsFrom(proposal);
    const lances = lancesFrom(proposal);
    const groups = projectGroups(proposal, context);
    const status = cleanText(acceptance.status || context.status || 'draft', 40);
    const source = {
      proposalId,
      simulationId: cleanText(context.simulationId || proposal.simulationId || '', 100),
      status,
      acceptanceVersion: number(acceptance.version),
      validUntil: cleanText(acceptance.validUntil || '', 20),
      metrics,
      lances,
      groups,
      builder: {
        sections: builder.raw.sections || {},
        charts: builder.raw.charts || {},
        concepts: builder.raw.concepts || {},
        formulas: builder.raw.formulas || {}
      }
    };

    return {
      schema: SCHEMA,
      proposalId,
      simulationId: source.simulationId,
      cliente: cleanText(proposal.cliente || context.cliente || 'Cliente em analise', 120),
      consultor: cleanText(proposal.consultor || context.consultor || '', 120),
      status,
      statusLabel: cleanText(acceptance.statusLabel || context.statusLabel || 'Proposta em revisao', 80),
      acceptanceVersion: source.acceptanceVersion,
      validUntil: source.validUntil,
      notes: cleanText(acceptance.notes || context.notes || '', 420),
      metrics,
      lances,
      groups,
      builder,
      sourceHash: hash(source)
    };
  }

  function decorate(record) {
    if (!record) return null;
    return {
      ...record,
      versionLabel: record.version ? `Versao ${record.version}` : 'Sem versao',
      savedAtLabel: record.createdAt ? new Date(record.createdAt).toLocaleString('pt-BR') : 'sem data'
    };
  }

  function history(proposalId, limit = 10) {
    const id = cleanText(proposalId, 80);
    return loadAll()
      .filter((item) => !id || item.proposalId === id)
      .sort((a, b) => {
        const av = number(a.version);
        const bv = number(b.version);
        if (av !== bv) return bv - av;
        return String(b.createdAt || '').localeCompare(String(a.createdAt || ''));
      })
      .slice(0, limit)
      .map(decorate);
  }

  function latest(proposalId) {
    return history(proposalId, 1)[0] || null;
  }

  function nextVersion(proposalId) {
    const versions = history(proposalId, MAX_ITEMS).map((item) => number(item.version));
    return versions.length ? Math.max(...versions) + 1 : 1;
  }

  function save(proposal = {}, context = {}) {
    const base = snapshot(proposal, context);
    const previous = latest(base.proposalId);
    if (previous && previous.sourceHash === base.sourceHash && !context.forceNew) {
      return decorate({ ...previous, unchanged: true });
    }

    const now = new Date().toISOString();
    const version = context.version ? number(context.version) : nextVersion(base.proposalId);
    const record = decorate({
      ...base,
      id: `PV-${Date.now().toString(36).toUpperCase()}-${version}`,
      version,
      label: cleanText(context.label || `Versao ${version}`, 80),
      createdAt: now,
      updatedAt: now
    });

    const list = [record].concat(loadAll()).slice(0, MAX_ITEMS);
    if (!saveAll(list)) return null;
    publishProposalVersionSnapshot(record);
    return record;
  }

  const metricLabels = {
    creditoTotal: 'Credito total',
    parcelaAtual: 'Parcela atual',
    totalPlano: 'Total do plano',
    totalPago: 'Total pago',
    cartaLiquida: 'Carta liquida',
    saldoDevedor: 'Saldo devedor',
    prazo: 'Prazo',
    prazoRestante: 'Prazo restante',
    percentualPago: 'Percentual percorrido'
  };

  function metricDeltas(left, right) {
    const a = left && left.metrics ? left.metrics : {};
    const b = right && right.metrics ? right.metrics : {};
    return Object.keys(metricLabels).map((key) => {
      const before = number(a[key]);
      const after = number(b[key]);
      const delta = after - before;
      return {
        key,
        label: metricLabels[key],
        before,
        after,
        delta,
        changed: Math.abs(delta) > 0.009
      };
    });
  }

  function builderDeltas(left, right) {
    const a = left && left.builder ? left.builder : {};
    const b = right && right.builder ? right.builder : {};
    return ['sections', 'charts', 'concepts', 'formulas'].map((key) => {
      const before = number(a[key]);
      const after = number(b[key]);
      return {
        key,
        label: key,
        before,
        after,
        delta: after - before,
        changed: before !== after
      };
    });
  }

  function compareRecords(left, right) {
    const a = decorate(left);
    const b = decorate(right);
    if (!a || !b) return null;
    const metrics = metricDeltas(a, b);
    const builder = builderDeltas(a, b);
    return {
      left: a,
      right: b,
      metrics,
      builder,
      changedMetrics: metrics.filter((item) => item.changed),
      changedBuilder: builder.filter((item) => item.changed),
      statusChanged: a.status !== b.status,
      validUntilChanged: a.validUntil !== b.validUntil
    };
  }

  function compare(proposalId, leftVersion, rightVersion) {
    const items = history(proposalId, MAX_ITEMS);
    const left = items.find((item) => number(item.version) === number(leftVersion)) || items[1] || null;
    const right = items.find((item) => number(item.version) === number(rightVersion)) || items[0] || null;
    return compareRecords(left, right);
  }

  function clear(proposalId) {
    const id = cleanText(proposalId, 80);
    if (!id) return false;
    return saveAll(loadAll().filter((item) => item.proposalId !== id));
  }

  const api = {
    storageKey: STORAGE_KEY,
    schema: SCHEMA,
    snapshot,
    save,
    latest,
    history,
    compare,
    compareRecords,
    clear
  };

  if (typeof window !== 'undefined') {
    window.BFProposalVersions = api;
  }

  return api;
})();
