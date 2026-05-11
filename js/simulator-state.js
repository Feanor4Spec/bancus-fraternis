/**
 * Simulator state helpers.
 * Centralizes snapshots used by save/load flows while preserving legacy payloads.
 */
(function simulatorStateFactory(global) {
  'use strict';

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
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
      fields[el.id] = {
        type: el.type || el.tagName.toLowerCase(),
        value: el.type === 'checkbox' ? !!el.checked : el.value
      };
    });
    return fields;
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
        indiceCorrecaoNome: item.indiceCorrecaoNome,
        lanceProprioPct: item.lanceProprioPct,
        lanceEmbutidoPct: item.lanceEmbutidoPct,
        valorFgts: item.valorFgts,
        mesContemplacaoAlvo: item.mesContemplacaoAlvo,
        parcelaReduzidaAtiva: item.parcelaReduzidaAtiva,
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
        indiceCorrecaoNome: savedItem.indiceCorrecaoNome || item.indiceCorrecaoNome,
        lanceProprioPct: savedItem.lanceProprioPct || 0,
        lanceEmbutidoPct: savedItem.lanceEmbutidoPct || 0,
        valorFgts: savedItem.valorFgts || 0,
        mesContemplacaoAlvo: savedItem.mesContemplacaoAlvo || item.mesContemplacaoAlvo,
        parcelaReduzidaAtiva: !!savedItem.parcelaReduzidaAtiva,
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
    const cart = Array.isArray(input.cart) ? input.cart : [];
    const segmentos = [...new Set(cart.map((item) => item.nomeSegmento).filter(Boolean))];
    const totalCarta = cart.reduce((sum, item) => sum + (safeNumber(item.valorCartaTotal)), 0) || safeNumber(params.valorCarta);
    const totalCotas = cart.reduce((sum, item) => sum + safeNumber(item.quantidadeCotas), 0);
    const decisionContext = input.decisionContext || {};

    return {
      nome: input.nome || '',
      origem: 'simulador-consorcio',
      currentStep: input.currentStep || 1,
      consultor: getFieldValue(root, 'consultor') || params.consultor || '',
      consultorEmail: getFieldValue(root, 'consultorEmail'),
      consultorTelefone: getFieldValue(root, 'consultorTelefone'),
      cliente: getFieldValue(root, 'nomeCliente') || params.nomeCliente || '',
      clienteCpf: getFieldValue(root, 'clienteCpf'),
      clienteEmail: getFieldValue(root, 'clienteEmail'),
      clienteTelefone: getFieldValue(root, 'clienteTelefone'),
      clienteObjetivo: getFieldValue(root, 'clienteObjetivo'),
      totalCarta,
      totalGrupos: cart.length,
      totalCotas,
      segmentos,
      formSnapshot: input.formSnapshot || collectFormSnapshot(root),
      filtros: input.filters || {},
      params,
      carrinho: cart,
      resultado: input.resultado || null,
      resumo: input.resultado ? input.resultado.resumo : null,
      proposalAcceptance: input.proposalAcceptance || null,
      decisionContext: {
        source: decisionContext.source,
        calculatorSlug: decisionContext.calculatorSlug,
        historyId: decisionContext.historyId,
        journeyId: decisionContext.journeyId,
        readinessScore: decisionContext.readinessScore,
        profileSnapshot: decisionContext.profileSnapshot
      }
    };
  }

  global.BFSimulatorState = {
    collectFormSnapshot,
    applyFormSnapshot,
    collectSavedCart,
    findGroupForSavedItem,
    restoreSavedCartItems,
    resolveResumeStep,
    buildSimulationPayload
  };
})(typeof window !== 'undefined' ? window : globalThis);
