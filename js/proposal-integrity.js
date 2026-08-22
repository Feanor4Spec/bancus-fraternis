/**
 * Deterministic, non-reversible fingerprints for proposal inputs.
 * The resulting hashes can be persisted without retaining the source values.
 */
(function proposalIntegrityModule(root) {
  'use strict';

  const PRIVATE_CONTENT_FIELDS = new Set([
    'consultor', 'consultoremail', 'consultortelefone', 'consultorempresa', 'consultorcodigo',
    'cliente', 'nomecliente', 'clientecpf', 'clienteemail', 'clientetelefone',
    'cpf', 'email', 'phone', 'telefone', 'reviewer', 'reviewerrole', 'notes',
    'owneremail', 'actoremail', 'observacoes', 'proposalreviewer', 'proposalreviewnotes'
  ]);

  function canonical(value) {
    if (Array.isArray(value)) return value.map(canonical);
    if (!value || typeof value !== 'object') {
      if (typeof value === 'number' && !Number.isFinite(value)) return null;
      return value;
    }
    return Object.keys(value).sort().reduce((result, key) => {
      const entry = value[key];
      if (typeof entry !== 'function' && typeof entry !== 'symbol' && key !== '_group') {
        result[key] = canonical(entry);
      }
      return result;
    }, {});
  }

  function hashText(value) {
    let hash = 2166136261;
    for (let index = 0; index < value.length; index += 1) {
      hash ^= value.charCodeAt(index);
      hash = Math.imul(hash, 16777619);
    }
    return `fp-${(hash >>> 0).toString(16).padStart(8, '0')}`;
  }

  function fingerprint(value) {
    return hashText(JSON.stringify(canonical(value)));
  }

  function withoutPrivateContent(value) {
    if (Array.isArray(value)) return value.map(withoutPrivateContent);
    if (!value || typeof value !== 'object') return value;
    return Object.keys(value).reduce((result, key) => {
      if (!PRIVATE_CONTENT_FIELDS.has(String(key).toLowerCase())) {
        result[key] = withoutPrivateContent(value[key]);
      }
      return result;
    }, {});
  }

  function calculationFingerprint(params) {
    const source = { ...(params || {}) };
    if (String(source.nomeCliente || '').trim().toLowerCase() === 'dados protegidos') {
      source.nomeCliente = '';
    }
    return fingerprint(source);
  }

  function comparisonFingerprint(input = {}) {
    return fingerprint({
      selection: input.selection || {},
      scenario: input.scenario || {},
      groups: input.groups || []
    });
  }

  function proposalContentFingerprint(input = {}) {
    return fingerprint(withoutPrivateContent({
      proposalId: input.proposalId || '',
      params: input.params || {},
      project: input.project || {},
      result: input.result || {},
      comparison: input.comparison || null,
      builder: input.builder || {}
    }));
  }

  function acceptanceMatchesContent(acceptance, sourceHash) {
    const expected = String(sourceHash || '').trim();
    const actual = String(acceptance?.sourceHash || '').trim();
    return Boolean(expected && actual && expected === actual);
  }

  root.BFProposalIntegrity = Object.freeze({
    fingerprint,
    calculationFingerprint,
    comparisonFingerprint,
    proposalContentFingerprint,
    acceptanceMatchesContent
  });
})(typeof window !== 'undefined' ? window : globalThis);
