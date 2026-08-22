/**
 * Simulator state helpers.
 * Centralizes snapshots used by save/load flows while preserving legacy payloads.
 */
(function simulatorStateFactory(global) {
  'use strict';

  const LOCAL_PRIVATE_FIELDS = new Set([
    'consultor', 'consultorEmail', 'consultorTelefone',
    'nomeCliente', 'clienteCpf', 'clienteEmail', 'clienteTelefone',
    'observacoes', 'proposalReviewer', 'proposalReviewNotes'
  ]);

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function cloneRows(value) {
    return Array.isArray(value) ? value.map((row) => ({ ...(row || {}) })) : [];
  }

  function getFieldValue(root, id) {
    const el = root && root.getElementById ? root.getElementById(id) : null;
    return el ? el.value || '' : '';
  }

  function collectFormSnapshot(root) {
    const doc = root || global.document;
    const fields = {};
    if (!doc || typeof doc.querySelectorAll !== 'function') return fields;
    doc.querySelectorAll('input[id], select[id], textarea[id]').forEach((el) => {
      if (LOCAL_PRIVATE_FIELDS.has(el.id)) return;
      fields[el.id] = {
        type: el.type || el.tagName.toLowerCase(),
        value: el.type === 'checkbox' ? !!el.checked : el.value
      };
    });
    return fields;
  }

  function sanitizeLocalParams(params) {
    const sanitized = { ...(params || {}) };
    LOCAL_PRIVATE_FIELDS.forEach((key) => { delete sanitized[key]; });
    return sanitized;
  }

  function sanitizeAcceptance(acceptance) {
    if (!acceptance || typeof acceptance !== 'object') return null;
    const proposalId = /^PROP-[A-Za-z0-9._:-]+$/i.test(String(acceptance.proposalId || ''))
      ? String(acceptance.proposalId)
      : '';
    const id = /^REV-[A-Za-z0-9._:-]+$/i.test(String(acceptance.id || ''))
      ? String(acceptance.id)
      : '';
    const sourceHash = /^fp-[a-z0-9]+$/i.test(String(acceptance.sourceHash || ''))
      ? String(acceptance.sourceHash)
      : '';
    return {
      id,
      proposalId,
      status: acceptance.status || 'draft',
      version: Math.max(0, parseInt(acceptance.version, 10) || 0),
      sourceHash,
      reviewedAt: acceptance.reviewedAt || acceptance.updatedAt || null,
      validUntil: acceptance.validUntil || null,
      checklist: acceptance.checklist ? { ...acceptance.checklist } : null
    };
  }

  function applyFormSnapshot(snapshot, root) {
    const doc = root || global.document;
    if (!snapshot || typeof snapshot !== 'object' || !doc || typeof doc.getElementById !== 'function') return 0;
    let applied = 0;
    Object.entries(snapshot).forEach(([id, data]) => {
      const el = doc.getElementById(id);
      if (!el) return;
      if (el.type === 'checkbox') {
        el.checked = !!(data && data.value);
        applied += 1;
      } else if (data && data.value !== undefined) {
        el.value = data.value;
        applied += 1;
      }
    });
    return applied;
  }

  function collectSavedCart(items, options = {}) {
    const getLimit = options.getEffectiveLanceEmbutidoMax || ((group) => safeNumber(group && group.lanceEmbutidoMaxPct));
    return (Array.isArray(items) ? items : []).map((item) => {
      const group = item._group || {};
      return {
        itemId: item.itemId,
        groupKey: item.groupKey,
        codigoGrupo: item.codigoGrupo,
        codigoSegmento: item.codigoSegmento,
        administradora: item.administradora,
        nomeSegmento: item.nomeSegmento,
        iconSegmento: item.iconSegmento,
        quantidadeCotas: item.quantidadeCotas,
        valorCartaRef: item.valorCartaRef,
        valorCartaUnitario: item.valorCartaUnitario,
        valorCartaTotal: item.valorCartaTotal,
        prazoMeses: item.prazoMeses,
        taxaAdmPct: item.taxaAdmPct,
        fundoReservaPct: item.fundoReservaPct,
        seguroPct: item.seguroPct,
        indiceCorrecaoNome: item.indiceCorrecaoNome,
        indiceReajuste: item.indiceReajuste,
        mesAniversario: item.mesAniversario,
        politicaSaldo: item.politicaSaldo,
        modalidadeLance: item.modalidadeLance,
        estrategiaLance: item.estrategiaLance,
        lanceProprioPct: item.lanceProprioPct,
        lanceEmbutidoPct: item.lanceEmbutidoPct,
        lanceFixoPct: item.lanceFixoPct,
        valorFgts: item.valorFgts,
        mesContemplacaoAlvo: item.mesContemplacaoAlvo,
        parcelaReduzidaAtiva: item.parcelaReduzidaAtiva,
        percentualReducao: item.percentualReducao,
        reduzirParcelaOuPrazo: item.reduzirParcelaOuPrazo,
        multaAtraso: item.multaAtraso,
        jurosAtraso: item.jurosAtraso,
        adiantamentos: cloneRows(item.adiantamentos),
        inadimplencias: cloneRows(item.inadimplencias),
        observacaoItem: item.observacaoItem,
        classificacao: item.classificacao,
        papel: item.papel,
        groupSnapshot: {
          groupKey: group.groupKey || item.groupKey,
          codigoGrupo: group.codigoGrupo || item.codigoGrupo,
          codigoSegmento: group.codigoSegmento || item.codigoSegmento,
          nomeAdministradora: group.nomeAdministradora || item.administradora,
          administradora: group.administradora || item.administradora,
          nomeSegmento: group.nomeSegmento || item.nomeSegmento,
          iconSegmento: group.iconSegmento || item.iconSegmento,
          valorCartaRef: group.valorCartaRef || item.valorCartaRef || item.valorCartaUnitario,
          prazoMeses: group.prazoMeses || item.prazoMeses,
          taxaAdmPct: group.taxaAdmPct || item.taxaAdmPct,
          fundoReservaPct: group.fundoReservaPct || item.fundoReservaPct,
          indiceCorrecaoNome: group.indiceCorrecaoNome || item.indiceCorrecaoNome,
          lanceEmbutidoMaxPct: getLimit(group),
          lanceFixoPct: group.lanceFixoPct,
          parcelaReduzidaDisponivel: group.parcelaReduzidaDisponivel,
          reducaoMaxParcelaPct: group.reducaoMaxParcelaPct,
          seguroPctComercial: group.seguroPctComercial,
          dataBase: group.dataBase,
          indiceMaturidade: group.indiceMaturidade,
          _fieldProvenance: group._fieldProvenance,
          _commercialVerification: group._commercialVerification,
          macroCategoria: group.macroCategoria,
          statusComercial: group.statusComercial,
          _classificacao: group._classificacao || item.classificacao,
          _papel: group._papel || item.papel
        }
      };
    });
  }

  function findGroupForSavedItem(savedItem, catalog = []) {
    const source = Array.isArray(catalog) ? catalog : [];
    return source.find((group) => {
      return (savedItem.groupKey && group.groupKey === savedItem.groupKey)
        || (savedItem.codigoGrupo && group.codigoGrupo === savedItem.codigoGrupo && (!savedItem.administradora || group.nomeAdministradora === savedItem.administradora));
    }) || savedItem.groupSnapshot || {
      groupKey: savedItem.groupKey,
      codigoGrupo: savedItem.codigoGrupo,
      codigoSegmento: savedItem.codigoSegmento,
      nomeAdministradora: savedItem.administradora,
      nomeSegmento: savedItem.nomeSegmento,
      iconSegmento: savedItem.iconSegmento,
      valorCartaRef: savedItem.valorCartaRef || savedItem.valorCartaUnitario,
      prazoMeses: savedItem.prazoMeses,
      taxaAdmPct: savedItem.taxaAdmPct,
      fundoReservaPct: savedItem.fundoReservaPct,
      indiceCorrecaoNome: savedItem.indiceCorrecaoNome
    };
  }

  function restoreSavedCartItems(savedCart, options = {}) {
    const source = Array.isArray(savedCart) ? savedCart : [];
    const catalog = Array.isArray(options.catalog) ? options.catalog : [];
    const shelfEngine = options.shelfEngine || global.ShelfEngine;
    const getLimit = options.getEffectiveLanceEmbutidoMax || ((group) => safeNumber(group && group.lanceEmbutidoMaxPct));
    if (!shelfEngine || typeof shelfEngine.createProjectItem !== 'function') return [];

    return source.map((savedItem) => {
      const group = findGroupForSavedItem(savedItem, catalog);
      const item = shelfEngine.createProjectItem(group, savedItem.quantidadeCotas || 1, savedItem.valorCartaUnitario || savedItem.valorCartaRef);
      Object.assign(item, {
        itemId: savedItem.itemId || item.itemId,
        groupKey: savedItem.groupKey || item.groupKey,
        codigoGrupo: savedItem.codigoGrupo || item.codigoGrupo,
        codigoSegmento: savedItem.codigoSegmento || item.codigoSegmento,
        administradora: savedItem.administradora || item.administradora,
        nomeSegmento: savedItem.nomeSegmento || item.nomeSegmento,
        iconSegmento: savedItem.iconSegmento || item.iconSegmento,
        quantidadeCotas: Math.max(1, parseInt(savedItem.quantidadeCotas, 10) || 1),
        valorCartaRef: savedItem.valorCartaRef || item.valorCartaRef,
        valorCartaUnitario: savedItem.valorCartaUnitario || item.valorCartaUnitario,
        prazoMeses: savedItem.prazoMeses || item.prazoMeses,
        taxaAdmPct: savedItem.taxaAdmPct || item.taxaAdmPct,
        fundoReservaPct: savedItem.fundoReservaPct || item.fundoReservaPct,
        seguroPct: savedItem.seguroPct ?? item.seguroPct,
        indiceCorrecaoNome: savedItem.indiceCorrecaoNome || item.indiceCorrecaoNome,
        indiceReajuste: savedItem.indiceReajuste ?? item.indiceReajuste,
        mesAniversario: savedItem.mesAniversario || item.mesAniversario || 12,
        politicaSaldo: savedItem.politicaSaldo || item.politicaSaldo || 'carta',
        modalidadeLance: savedItem.modalidadeLance || item.modalidadeLance || 'sem_lance',
        estrategiaLance: savedItem.estrategiaLance || item.estrategiaLance || 'sem_lance',
        lanceProprioPct: savedItem.lanceProprioPct || 0,
        lanceEmbutidoPct: savedItem.lanceEmbutidoPct || 0,
        lanceFixoPct: savedItem.lanceFixoPct || 0,
        valorFgts: savedItem.valorFgts || 0,
        mesContemplacaoAlvo: savedItem.mesContemplacaoAlvo || item.mesContemplacaoAlvo,
        parcelaReduzidaAtiva: !!savedItem.parcelaReduzidaAtiva,
        percentualReducao: savedItem.percentualReducao || 0,
        reduzirParcelaOuPrazo: savedItem.reduzirParcelaOuPrazo || null,
        multaAtraso: savedItem.multaAtraso,
        jurosAtraso: savedItem.jurosAtraso,
        adiantamentos: cloneRows(savedItem.adiantamentos),
        inadimplencias: cloneRows(savedItem.inadimplencias),
        observacaoItem: savedItem.observacaoItem || '',
        classificacao: savedItem.classificacao || item.classificacao,
        papel: savedItem.papel || item.papel,
        _group: group
      });
      const limit = getLimit(group);
      if (limit > 0 && item.lanceEmbutidoPct > limit) item.lanceEmbutidoPct = limit;
      item.valorCartaTotal = item.valorCartaUnitario * item.quantidadeCotas;
      return item;
    });
  }

  function resolveResumeStep(sim) {
    const savedStep = parseInt((sim && (sim.currentStep || sim.step)) || 1, 10) || 1;
    if (sim && sim.resultado && sim.resultado.cronograma) return Math.max(savedStep, 7);
    if (sim && Array.isArray(sim.carrinho) && sim.carrinho.length) return Math.max(savedStep, 5);
    return savedStep;
  }

  function buildSimulationPayload(input = {}) {
    const root = input.root || global.document;
    const params = input.params || {};
    const localParams = sanitizeLocalParams(params);
    const cart = Array.isArray(input.cart) ? input.cart : [];
    const segmentos = [...new Set(cart.map((item) => item.nomeSegmento).filter(Boolean))];
    const totalCarta = cart.reduce((sum, item) => sum + (safeNumber(item.valorCartaTotal)), 0) || safeNumber(params.valorCarta);
    const totalCotas = cart.reduce((sum, item) => sum + safeNumber(item.quantidadeCotas), 0);
    const decisionContext = input.decisionContext || {};
    const proposalId = /^PROP-[A-Za-z0-9._:-]+$/i.test(String(input.proposalId || input.proposalAcceptance?.proposalId || ''))
      ? String(input.proposalId || input.proposalAcceptance.proposalId)
      : '';

    return {
      id: /^SIM-[A-Za-z0-9._:-]+$/i.test(String(input.id || '')) ? String(input.id) : '',
      proposalId,
      nome: input.nome || '',
      origem: 'simulador-consorcio',
      privacy: {
        localPIIStored: false,
        notice: 'Dados identificadores nao sao persistidos no armazenamento local.'
      },
      currentStep: input.currentStep || 1,
      consultor: '',
      consultorEmail: '',
      consultorTelefone: '',
      cliente: 'Dados protegidos',
      clienteCpf: '',
      clienteEmail: '',
      clienteTelefone: '',
      clienteObjetivo: getFieldValue(root, 'clienteObjetivo'),
      totalCarta,
      totalGrupos: cart.length,
      totalCotas,
      segmentos,
      formSnapshot: input.formSnapshot || collectFormSnapshot(root),
      filtros: input.filters || {},
      params: localParams,
      carrinho: cart,
      resultado: input.resultado || null,
      resumo: input.resultado ? input.resultado.resumo : null,
      diagnostics: input.resultado ? input.resultado.diagnostics || null : null,
      comparison: input.comparison || null,
      proposalSnapshot: null,
      proposalSnapshotRef: input.proposalSnapshot && input.proposalSnapshot.id
        ? { id: input.proposalSnapshot.id, version: input.proposalSnapshot.version || null }
        : null,
      proposalAcceptance: sanitizeAcceptance(input.proposalAcceptance),
      decisionContext: {
        source: decisionContext.source,
        calculatorSlug: decisionContext.calculatorSlug,
        historyId: decisionContext.historyId,
        journeyId: decisionContext.journeyId,
        readinessScore: decisionContext.readinessScore,
        profileSnapshot: null
      }
    };
  }

  global.BFSimulatorState = {
    collectFormSnapshot,
    sanitizeLocalParams,
    applyFormSnapshot,
    collectSavedCart,
    findGroupForSavedItem,
    restoreSavedCartItems,
    resolveResumeStep,
    buildSimulationPayload
  };
})(typeof window !== 'undefined' ? window : globalThis);
