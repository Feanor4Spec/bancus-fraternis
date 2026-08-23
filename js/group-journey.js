(function (global) {
  'use strict';

  const SCHEMA = 'bancus.group-return-state.v1';
  const PREFIX = 'bf_group_return_state_v1:';
  const ACTIVE_KEY = 'bf_group_active_return_v1';
  const TTL_MS = 30 * 60 * 1000;
  const MAX_STATES = 8;

  function token() {
    try {
      if (global.crypto?.getRandomValues) {
        const bytes = new Uint32Array(3);
        global.crypto.getRandomValues(bytes);
        return `GRS-${Array.from(bytes, (value) => value.toString(36)).join('-')}`;
      }
    } catch (error) { /* fallback below */ }
    return `GRS-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
  }

  function clone(value) {
    const seen = new WeakSet();
    return JSON.parse(JSON.stringify(value, (key, entry) => {
      if (key === '_group' || typeof entry === 'function' || typeof entry === 'symbol' || typeof entry === 'bigint') return undefined;
      if (typeof entry === 'number' && !Number.isFinite(entry)) return null;
      if (entry && typeof entry === 'object') {
        if (seen.has(entry)) return undefined;
        seen.add(entry);
      }
      return entry;
    }));
  }

  function validToken(value) {
    return /^GRS-[A-Za-z0-9-]{8,100}$/.test(String(value || ''));
  }

  function prune() {
    if (!global.sessionStorage || typeof global.sessionStorage.key !== 'function') return;
    const entries = [];
    for (let index = 0; index < global.sessionStorage.length; index += 1) {
      const key = global.sessionStorage.key(index);
      if (!key || !key.startsWith(PREFIX)) continue;
      try {
        const value = JSON.parse(global.sessionStorage.getItem(key) || 'null');
        if (!value || value.schema !== SCHEMA || Number(value.expiresAt) < Date.now()) {
          global.sessionStorage.removeItem(key);
          index -= 1;
          continue;
        }
        entries.push({ key, createdAt: Number(value.createdAt) || 0 });
      } catch (error) {
        global.sessionStorage.removeItem(key);
        index -= 1;
      }
    }
    entries.sort((a, b) => b.createdAt - a.createdAt).slice(MAX_STATES)
      .forEach((entry) => global.sessionStorage.removeItem(entry.key));
  }

  function create(input = {}) {
    prune();
    const id = token();
    const createdAt = Date.now();
    const state = clone({
      schema: SCHEMA,
      createdAt,
      expiresAt: createdAt + TTL_MS,
      source: {
        route: 'simulador.html',
        search: String(global.location?.search || '').slice(0, 1000),
        hash: String(global.location?.hash || '').slice(0, 160),
        step: Number(input.step) || 4,
        surface: String(input.surface || 'shelf-modal').slice(0, 40),
        scrollY: Math.max(0, Number(input.scrollY) || 0),
        focusGroupKey: String(input.focusGroupKey || '').slice(0, 250)
      },
      shelf: input.shelf || {},
      cart: Array.isArray(input.cart) ? input.cart : [],
      formSnapshot: input.formSnapshot || {},
      calculationSnapshot: input.calculationSnapshot || null,
      openGroupKey: String(input.openGroupKey || '').slice(0, 250)
    });
    global.sessionStorage.setItem(`${PREFIX}${id}`, JSON.stringify(state));
    global.sessionStorage.setItem(ACTIVE_KEY, id);
    return id;
  }

  function read(id) {
    if (!validToken(id)) return null;
    try {
      const parsed = JSON.parse(global.sessionStorage.getItem(`${PREFIX}${id}`) || 'null');
      if (!parsed || parsed.schema !== SCHEMA || Number(parsed.expiresAt) < Date.now()) {
        global.sessionStorage.removeItem(`${PREFIX}${id}`);
        return null;
      }
      if (parsed.source?.route !== 'simulador.html') return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  function activeToken() {
    const value = global.sessionStorage.getItem(ACTIVE_KEY) || '';
    return validToken(value) ? value : '';
  }

  function discard(id) {
    if (!validToken(id)) return false;
    global.sessionStorage.removeItem(`${PREFIX}${id}`);
    if (global.sessionStorage.getItem(ACTIVE_KEY) === id) global.sessionStorage.removeItem(ACTIVE_KEY);
    return true;
  }

  function buildSnapshotEvidence(group, sourceStatus = {}) {
    if (!group || !group.groupKey) return [];
    const stats = sourceStatus.stats || sourceStatus;
    const competence = String(group.dataBase || '');
    const base = {
      schema: 'bancus.group-evidence.v1',
      groupKey: String(group.groupKey),
      competence,
      sourceType: 'catalog-snapshot',
      sourceLabel: 'Catálogo de grupos',
      sourceSchema: String(stats.format || ''),
      sourceHash: String(stats.sourceSha256 || ''),
      sourceGeneratedAt: String(stats.generatedAt || ''),
      historyIncluded: false
    };
    const evidence = [
      {
        ...base,
        key: 'group-identity',
        label: 'Identificação do grupo',
        value: `${group.nomeAdministradora || 'Administradora não informada'} · Grupo ${group.codigoGrupo || 'não informado'} · ${group.nomeSegmento || 'Segmento não informado'}`,
        unit: 'text',
        status: 'observed',
        definition: 'Identidade exata da referência consultada no catálogo.',
        limitation: 'Não confirma disponibilidade nem condição contratual atual.'
      },
      {
        ...base,
        key: 'active-quotas',
        label: 'Cotas ativas em dia no retrato',
        value: group.qtdAtivasEmDia ?? null,
        unit: 'quotas',
        status: group.qtdAtivasEmDia === null || group.qtdAtivasEmDia === undefined ? 'unavailable' : 'observed',
        definition: 'Quantidade de cotas ativas em dia na competência do catálogo.',
        limitation: 'É um estoque mensal, não uma série histórica.'
      },
      {
        ...base,
        key: 'contemplated-month',
        label: 'Contempladas no mês do retrato',
        value: group.qtdContempladasNoMes ?? null,
        unit: 'quotas',
        status: group.qtdContempladasNoMes === null || group.qtdContempladasNoMes === undefined ? 'unavailable' : 'observed',
        definition: 'Quantidade informada de contemplações na competência do catálogo.',
        limitation: 'Não representa probabilidade, garantia ou previsão de contemplação.'
      }
    ];
    return evidence;
  }

  function buildHref(groupKey, options = {}) {
    const key = String(groupKey || '');
    if (!key || key.split('|').length !== 4) return '';
    const returnState = options.returnState || create({ ...options, openGroupKey: key, focusGroupKey: key });
    const params = new URLSearchParams({ groupKey: key, from: 'simulador', surface: options.surface || 'shelf-modal', returnState });
    return `grupo.html?${params.toString()}#historia`;
  }

  global.BFGroupJourney = Object.freeze({
    SCHEMA,
    PREFIX,
    ACTIVE_KEY,
    create,
    read,
    discard,
    activeToken,
    buildHref,
    buildSnapshotEvidence,
    validToken
  });
})(window);
