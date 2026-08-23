/**
 * Bancus Fraternis - Versionamento local da proposta
 * Guarda somente dados comparaveis nao identificaveis antes de PDF e handoff.
 * Nomes, rotulos livres e notas permanecem apenas em memoria durante a sessao.
 */

const BFProposalVersions = (() => {
  'use strict';

  const STORAGE_KEY = 'bank_fratern_proposal_versions_v1';
  const SCHEMA = 'bank-fratern.proposal-version.v1';
  const MAX_ITEMS = 120;
  const volatileDetails = new Map();
  const BUILDER_KEYS = {
    sections: new Set([
      'header', 'executive', 'decision', 'kpis', 'journey', 'project', 'productPhases',
      'financialComposition', 'contributionOverview', 'bidStrategy', 'projection', 'schedule',
      'concepts', 'formulas', 'nextSteps', 'acceptance', 'disclaimer'
    ]),
    charts: new Set(['composition', 'installment', 'bid', 'debt', 'installmentProjection']),
    concepts: new Set([
      'consorcio', 'cartaCredito', 'grupoCota', 'assembleia', 'lanceProprio', 'lanceEmbutido',
      'contemplacao', 'fundoReserva', 'taxaAdministracao', 'saldoDevedor', 'reajuste', 'seguro'
    ]),
    formulas: new Set([
      'parcelaTotal', 'parcelaBase', 'taxaAdministracao', 'fundoReserva', 'lanceTotal',
      'cartaLiquida', 'saldoDevedor', 'percentualPago'
    ])
  };

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
      const raw = store.getItem(STORAGE_KEY) || '[]';
      const parsed = JSON.parse(raw);
      const sanitized = (Array.isArray(parsed) ? parsed : [])
        .map(sanitizeStoredRecord)
        .filter((item) => item.id && item.proposalId);
      const serialized = JSON.stringify(sanitized);
      if (serialized !== raw) store.setItem(STORAGE_KEY, serialized);
      return sanitized;
    } catch (e) {
      const store = storage();
      if (store) store.removeItem(STORAGE_KEY);
      console.warn('BFProposalVersions: erro ao carregar historico', e);
      return [];
    }
  }

  function saveAll(items) {
    try {
      const store = storage();
      if (!store) return false;
      const sanitized = (Array.isArray(items) ? items : [])
        .map(sanitizeStoredRecord)
        .filter((item) => item.id && item.proposalId);
      store.setItem(STORAGE_KEY, JSON.stringify(sanitized));
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

  function publishDirectProposal(record) {
    if (!record || !record.proposalId) return;
    try {
      const api = window.BFBackendApi;
      if (!api || typeof api.saveProposal !== 'function') return;
      api.saveProposal({
        id: record.proposalId,
        ownerEmail: currentActorEmail(),
        actorEmail: currentActorEmail(),
        title: record.label || `Proposta ${record.proposalId}`,
        status: record.status || 'draft',
        stage: 'versionamento',
        priority: record.status === 'expired' ? 'alta' : 'media',
        source: 'proposal-versioning',
        relatedId: record.simulationId || '',
        amount: record.metrics ? Number(record.metrics.creditoTotal || record.metrics.cartaLiquida || 0) : 0,
        payload: record,
        createdAt: record.createdAt || '',
        updatedAt: record.updatedAt || record.createdAt || ''
      }).catch(() => {});
    } catch (e) {
      // Escrita direta e progressiva; versionamento local e snapshot seguem como fonte de compatibilidade.
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
      title: record.label || `Versão ${record.version || ''}`.trim(),
      status: record.status || 'draft',
      storageKey: STORAGE_KEY,
      createdAt: record.createdAt || '',
      updatedAt: record.updatedAt || record.createdAt || ''
    });
  }

  function cleanText(value, max = 160) {
    return String(value == null ? '' : value).trim().slice(0, max);
  }

  function cleanSystemId(value, prefix, fallback = '') {
    const text = cleanText(value, 100);
    if (!text || !new RegExp(`^${prefix}-[A-Za-z0-9._:-]+$`, 'i').test(text)) return fallback;
    return text;
  }

  function cleanDate(value) {
    const text = cleanText(value, 20);
    return /^\d{4}-\d{2}-\d{2}$/.test(text) ? text : '';
  }

  function cleanTimestamp(value) {
    const text = cleanText(value, 40);
    return /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(text) ? text : '';
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

  function sanitizeFlagGroup(group, type) {
    const source = group && typeof group === 'object' ? group : {};
    const allowed = BUILDER_KEYS[type] || new Set();
    return Object.keys(source).slice(0, 80).reduce((result, key) => {
      if (allowed.has(key)) result[key] = !!source[key];
      return result;
    }, {});
  }

  function summarizeBuilder(builder) {
    const source = builder && typeof builder === 'object' ? builder : {};
    const raw = {
      sections: sanitizeFlagGroup(source.sections, 'sections'),
      charts: sanitizeFlagGroup(source.charts, 'charts'),
      concepts: sanitizeFlagGroup(source.concepts, 'concepts'),
      formulas: sanitizeFlagGroup(source.formulas, 'formulas')
    };
    return {
      sections: countSelected(raw.sections),
      sectionsTotal: countTotal(raw.sections),
      charts: countSelected(raw.charts),
      chartsTotal: countTotal(raw.charts),
      concepts: countSelected(raw.concepts),
      conceptsTotal: countTotal(raw.concepts),
      formulas: countSelected(raw.formulas),
      formulasTotal: countTotal(raw.formulas),
      raw
    };
  }

  function sanitizeEvidence(entries) {
    return (Array.isArray(entries) ? entries : []).slice(0, 3).map((entry) => ({
      schema: cleanText(entry && entry.schema, 60),
      key: cleanText(entry && entry.key, 60),
      label: cleanText(entry && entry.label, 100),
      value: entry && entry.value === null
        ? null
        : typeof (entry && entry.value) === 'number'
        ? number(entry.value)
        : cleanText(entry && entry.value, 180),
      unit: cleanText(entry && entry.unit, 30),
      competence: cleanText(entry && entry.competence, 20),
      sourceType: cleanText(entry && entry.sourceType, 40),
      sourceLabel: cleanText(entry && entry.sourceLabel, 80),
      sourceSchema: cleanText(entry && entry.sourceSchema, 80),
      sourceHash: cleanText(entry && entry.sourceHash, 80),
      sourceGeneratedAt: cleanText(entry && entry.sourceGeneratedAt, 40),
      status: cleanText(entry && entry.status, 40),
      definition: cleanText(entry && entry.definition, 220),
      limitation: cleanText(entry && entry.limitation, 220),
      historyIncluded: entry && entry.historyIncluded === true
    }));
  }

  function sanitizeGroups(groups) {
    return (Array.isArray(groups) ? groups : []).slice(0, 12).map((item, index) => ({
      index: Math.max(1, parseInt(item && item.index, 10) || index + 1),
      administradora: cleanText(item && item.administradora, 80),
      grupo: cleanText(item && item.grupo, 60),
      groupKey: cleanText(item && item.groupKey, 250),
      competence: cleanText(item && item.competence, 20),
      segmento: cleanText(item && item.segmento, 80),
      cotas: number(item && item.cotas),
      carta: number(item && item.carta),
      prazo: number(item && item.prazo),
      evidence: sanitizeEvidence(item && item.evidence),
      confirmationRequired: item && item.confirmationRequired === true
    }));
  }

  function statusLabel(status) {
    const labels = {
      reviewed: 'Revisada localmente',
      partial: 'Revisão parcial',
      pending: 'Em revisão',
      draft: 'Rascunho',
      expired: 'Revisão vencida'
    };
    return labels[status] || 'Proposta em revisao';
  }

  function sanitizeStoredRecord(record) {
    const source = record && typeof record === 'object' ? record : {};
    const rawBuilder = source.builder && source.builder.raw ? source.builder.raw : source.builder;
    const version = Math.max(0, parseInt(source.version, 10) || 0);
    const status = ['reviewed', 'partial', 'pending', 'draft', 'expired'].includes(source.status)
      ? source.status
      : 'draft';
    return {
      schema: SCHEMA,
      proposalId: cleanSystemId(source.proposalId || 'PROP-PENDENTE', 'PROP', 'PROP-PENDENTE'),
      simulationId: cleanSystemId(source.simulationId, 'SIM'),
      status,
      acceptanceVersion: Math.max(0, parseInt(source.acceptanceVersion, 10) || 0),
      validUntil: cleanDate(source.validUntil),
      metrics: metricsFrom(source),
      lances: lancesFrom(source),
      groups: sanitizeGroups(source.groups),
      builder: summarizeBuilder(rawBuilder || {}),
      sourceHash: /^[A-Za-z0-9]+$/.test(cleanText(source.sourceHash, 80)) ? cleanText(source.sourceHash, 80) : '',
      id: cleanSystemId(source.id, 'PV'),
      version,
      label: version ? `Versão ${version}` : 'Sem versão',
      createdAt: cleanTimestamp(source.createdAt),
      updatedAt: cleanTimestamp(source.updatedAt)
    };
  }

  function sensitiveDetails(record) {
    const source = record && typeof record === 'object' ? record : {};
    return {
      cliente: cleanText(source.cliente, 120),
      consultor: cleanText(source.consultor, 120),
      notes: cleanText(source.notes, 420),
      statusLabel: cleanText(source.statusLabel, 80),
      label: cleanText(source.label, 80)
    };
  }

  function rememberSensitive(record) {
    if (!record || !record.id) return;
    volatileDetails.set(record.id, sensitiveDetails(record));
  }

  function projectGroups(proposal, context) {
    const project = proposal && proposal.project ? proposal.project : (context && context.project ? context.project : {});
    const items = Array.isArray(project && project.itens) ? project.itens : [];
    return items.slice(0, 12).map((item, index) => ({
      index: index + 1,
      administradora: cleanText(item.administradora || item.nomeAdministradora || item.admin || '', 80),
      grupo: cleanText(item.codigoGrupo || item.grupo || item.idGrupo || '', 60),
      groupKey: cleanText(item.groupKey || item._group?.groupKey || '', 250),
      competence: cleanText(item.dataBase || item._group?.dataBase || '', 20),
      segmento: cleanText(item.nomeSegmento || item.segmento || item.tipoBem || '', 80),
      cotas: number(item.quantidadeCotas || item.cotas || 1),
      carta: number(item.valorCartaTotal || item.valorCartaRef || item.valorCarta || 0),
      prazo: number(item.prazoMeses || item.prazo || 0),
      evidence: sanitizeEvidence(item.groupEvidence),
      confirmationRequired: item.groupConfirmation?.status === 'required'
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
    const proposalId = cleanSystemId(proposal.id || context.proposalId || 'PROP-PENDENTE', 'PROP', 'PROP-PENDENTE');
    const metrics = metricsFrom(proposal);
    const lances = lancesFrom(proposal);
    const groups = projectGroups(proposal, context);
    const status = cleanText(acceptance.status || context.status || 'draft', 40);
    const source = {
      proposalId,
      status,
      acceptanceVersion: number(acceptance.version),
      validUntil: cleanDate(acceptance.validUntil),
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
      simulationId: cleanSystemId(context.simulationId || proposal.simulationId || '', 'SIM'),
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
    const stored = sanitizeStoredRecord(record);
    const volatile = volatileDetails.get(stored.id) || sensitiveDetails(record);
    return {
      ...stored,
      cliente: volatile.cliente || 'Dados protegidos',
      consultor: volatile.consultor || '',
      notes: volatile.notes || '',
      statusLabel: volatile.statusLabel || statusLabel(stored.status),
      label: volatile.label || stored.label,
      unchanged: !!record.unchanged,
      versionLabel: stored.version ? `Versão ${stored.version}` : 'Sem versão',
      savedAtLabel: stored.createdAt ? new Date(stored.createdAt).toLocaleString('pt-BR') : 'sem data'
    };
  }

  function history(proposalId, limit = 10) {
    const id = cleanSystemId(proposalId, 'PROP');
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
      const unchangedRecord = {
        ...previous,
        cliente: base.cliente,
        consultor: base.consultor,
        notes: base.notes,
        statusLabel: base.statusLabel,
        label: cleanText(context.label || previous.label, 80),
        unchanged: true
      };
      rememberSensitive(unchangedRecord);
      return decorate(unchangedRecord);
    }

    const now = new Date().toISOString();
    const version = context.version ? number(context.version) : nextVersion(base.proposalId);
    const record = decorate({
      ...base,
      id: `PV-${Date.now().toString(36).toUpperCase()}-${version}`,
      version,
      label: cleanText(context.label || `Versão ${version}`, 80),
      createdAt: now,
      updatedAt: now
    });

    rememberSensitive(record);
    const storedRecord = sanitizeStoredRecord(record);
    const list = [storedRecord].concat(loadAll()).slice(0, MAX_ITEMS);
    if (!saveAll(list)) return null;
    publishProposalVersionSnapshot(record);
    publishDirectProposal(record);
    return decorate(record);
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
    const id = cleanSystemId(proposalId, 'PROP');
    if (!id) return false;
    const items = loadAll();
    items.filter((item) => item.proposalId === id).forEach((item) => volatileDetails.delete(item.id));
    return saveAll(items.filter((item) => item.proposalId !== id));
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
