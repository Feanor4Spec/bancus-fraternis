/**
 * ============================================
 * ConsórcioPro V7 - Motor da Prateleira
 * ============================================
 * Filtragem avançada, paginação, score com
 * heurística, ordenação e Projeto Estruturado.
 * ============================================
 */

const ShelfEngine = (() => {
  'use strict';

  // ─── Score de Prateleira (V7 — com Heurística) ───

  function normalize(value, min, max) {
    if (max === min) return 0;
    return Math.max(0, Math.min(1, (value - min) / (max - min)));
  }

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function roundMoney(value) {
    return Math.round((safeNumber(value, 0) + Number.EPSILON) * 100) / 100;
  }

  function normalizeBidMode(value, fallback = 'sem_lance') {
    const mode = String(value || fallback);
    return mode === 'proprio' ? 'livre' : mode;
  }

  function parseFilterNumber(value) {
    if (value == null || value === '') return null;
    const raw = String(value).trim();
    const lastComma = raw.lastIndexOf(',');
    const lastDot = raw.lastIndexOf('.');
    let normalized = raw.replace(/[^\d,.-]/g, '');
    if (lastComma > lastDot) normalized = normalized.replace(/\./g, '').replace(',', '.');
    else if (lastDot > lastComma && normalized.includes(',')) normalized = normalized.replace(/,/g, '');
    else normalized = normalized.replace(',', '.');
    const n = Number(normalized);
    return Number.isFinite(n) ? n : null;
  }

  function normalizeText(value) {
    return String(value || '')
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toLowerCase()
      .trim();
  }

  function buildScoreStats(catalog) {
    const stats = {
      maxAtivas: 1,
      maxContempl: 1,
      maxTaxa: 1,
      maxLance: 1
    };

    if (!Array.isArray(catalog)) return stats;

    for (const g of catalog) {
      stats.maxAtivas = Math.max(stats.maxAtivas, safeNumber(g && g.qtdAtivasEmDia, 0));
      stats.maxContempl = Math.max(stats.maxContempl, safeNumber(g && g.qtdContempladasNoMes, 0));
      stats.maxTaxa = Math.max(stats.maxTaxa, safeNumber(g && g.taxaAdmPct, 0));
      stats.maxLance = Math.max(stats.maxLance, safeNumber(g && g.lanceEmbutidoMaxPct, 0));
    }

    return stats;
  }

  function getClassLetter(group) {
    if (group && group._classificacao && group._classificacao.letra) {
      return group._classificacao.letra;
    }

    const cls = group && (group.classificacaoExecutiva || (group._classificacao && group._classificacao.classe));
    return cls ? String(cls).trim().charAt(0).toUpperCase() : '';
  }

  /**
   * Calcula score composto: quantitativo (60%) + qualitativo heurístico (40%).
   */
  function computeShelfScore(group, catalogOrStats) {
    if (!group || typeof group !== 'object') return 0;
    const stats = catalogOrStats && typeof catalogOrStats === 'object' && !Array.isArray(catalogOrStats)
      ? catalogOrStats
      : buildScoreStats(catalogOrStats);

    // Score quantitativo (60%)
    const scoreQuant =
      0.25 * normalize(safeNumber(group.qtdAtivasEmDia, 0), 0, stats.maxAtivas) +
      0.25 * normalize(safeNumber(group.qtdContempladasNoMes, 0), 0, stats.maxContempl) +
      0.20 * (1 - normalize(safeNumber(group.taxaAdmPct, 0), 0, stats.maxTaxa)) +
      0.15 * normalize(safeNumber(group.lanceEmbutidoMaxPct, 0), 0, stats.maxLance) +
      0.15 * (group.parcelaReduzidaDisponivel ? 1 : 0);

    // Score heurístico (40%) — baseado em classificação, saúde e dinamismo
    const classMap = { A: 1.0, B: 0.7, C: 0.4, D: 0.1 };
    const scoreHeur = classMap[getClassLetter(group)] || 0.5;

    const scoreFinal = (scoreQuant * 0.60) + (scoreHeur * 0.40);
    return Math.round(scoreFinal * 100);
  }

  function computeAllScores(catalog) {
    if (!Array.isArray(catalog)) return [];
    // Primeiro enriquecer com heurística se disponível
    if (typeof HeuristicEngine !== 'undefined') {
      HeuristicEngine.enriquecerCatalogo(catalog);
    }

    const stats = buildScoreStats(catalog);
    catalog.forEach(g => {
      if (g._scoreShelfReady && Number.isFinite(g.scoreShelf)) return;
      g.scoreShelf = computeShelfScore(g, stats);
      g._scoreShelfReady = true;
    });
    return catalog;
  }

  // ─── Filtragem Avançada (V7) ───

  function filterGroups(catalog, filters) {
    if (!Array.isArray(catalog)) return [];
    filters = filters || {};
    let result = [...catalog];
    const cartaMin = parseFilterNumber(filters.cartaMin);
    const cartaMax = parseFilterNumber(filters.cartaMax);
    const taxaMax = parseFilterNumber(filters.taxaMax);
    const prazoMin = parseFilterNumber(filters.prazoMin);
    const prazoMax = parseFilterNumber(filters.prazoMax);

    // Filtro: Administradora
    if (filters.administradora && filters.administradora !== '') {
      const adminQuery = normalizeText(filters.administradora);
      result = result.filter(g =>
        normalizeText(g.nomeAdministradora).includes(adminQuery)
      );
    }

    // Filtro: Segmento
    if (filters.segmento && filters.segmento !== '') {
      const segmento = parseInt(filters.segmento, 10);
      result = result.filter(g => parseInt(g.codigoSegmento, 10) === segmento);
    }

    // Filtro: Prazo
    if (prazoMin != null) {
      result = result.filter(g => safeNumber(g.prazoMeses, 0) >= prazoMin);
    }
    if (prazoMax != null) {
      result = result.filter(g => safeNumber(g.prazoMeses, 0) <= prazoMax);
    }

    // V7: Filtro: Faixa de Carta
    if (cartaMin != null) {
      result = result.filter(g => safeNumber(g.valorCartaRef, 0) >= cartaMin);
    }
    if (cartaMax != null) {
      result = result.filter(g => safeNumber(g.valorCartaRef, 0) <= cartaMax);
    }

    // V7: Filtro: Taxa máxima
    if (taxaMax != null) {
      result = result.filter(g => safeNumber(g.taxaAdmPct, 0) <= taxaMax);
    }

    // V7: Filtro: Parcela reduzida
    if (filters.parcelaReduzida === true || filters.parcelaReduzida === 'true') {
      result = result.filter(g => g.parcelaReduzidaDisponivel === true);
    }

    // V7: Filtro: FGTS permitido
    if (filters.fgts === true || filters.fgts === 'true') {
      result = result.filter(g => g.fgtsPermitido === true);
    }

    // V7: Filtro: Classificação executiva
    if (filters.classificacao && filters.classificacao !== '') {
      result = result.filter(g => {
        return getClassLetter(g) === String(filters.classificacao).charAt(0).toUpperCase();
      });
    }

    // V7: Filtro: Saúde da carteira
    if (filters.saude && filters.saude !== '') {
      const target = normalizeText(filters.saude);
      result = result.filter(g => {
        const saudeStr = g.saudeCarteira || (g._heuristica ? g._heuristica.classificacoes.saude.classe : '');
        return normalizeText(saudeStr) === target;
      });
    }

    // V7: Filtro: Maturidade
    if (filters.maturidade && filters.maturidade !== '') {
      const target = normalizeText(filters.maturidade);
      result = result.filter(g => {
        const matStr = g._heuristica ? g._heuristica.classificacoes.maturidade.classe : '';
        return normalizeText(matStr) === target;
      });
    }

    // V7: Busca textual livre
    if (filters.busca && filters.busca.trim() !== '') {
      const q = normalizeText(filters.busca);
      result = result.filter(g =>
        normalizeText(g.nomeAdministradora).includes(q) ||
        normalizeText(g.codigoGrupo).includes(q) ||
        normalizeText(g.nomeSegmento).includes(q) ||
        normalizeText(g.cnpjRaiz || g.cnpjAdministradora).includes(q) ||
        normalizeText(g.groupKey).includes(q)
      );
    }

    return result;
  }

  // ─── Paginação (V7) ───

  function paginateGroups(groups, page, pageSize) {
    const safeGroups = Array.isArray(groups) ? groups : [];
    const safePageSize = Math.max(1, parseInt(pageSize, 10) || 50);
    const totalPages = Math.max(1, Math.ceil(safeGroups.length / safePageSize));
    const currentPage = Math.max(1, Math.min(parseInt(page, 10) || 1, totalPages));
    const startIdx = (currentPage - 1) * safePageSize;
    const endIdx = Math.min(startIdx + safePageSize, safeGroups.length);
    return {
      data: safeGroups.slice(startIdx, endIdx),
      totalGroups: safeGroups.length,
      totalPages,
      currentPage,
      pageSize: safePageSize,
      startIdx: safeGroups.length ? startIdx + 1 : 0,
      endIdx
    };
  }

  // ─── Ordenação ───

  function sortGroups(groups, sortBy) {
    const sorted = [...groups];
    switch (sortBy) {
      case 'maior_carta':
        return sorted.sort((a, b) => b.valorCartaRef - a.valorCartaRef);
      case 'menor_taxa':
        return sorted.sort((a, b) => a.taxaAdmPct - b.taxaAdmPct);
      case 'menor_prazo':
        return sorted.sort((a, b) => a.prazoMeses - b.prazoMeses);
      case 'maior_prazo':
        return sorted.sort((a, b) => b.prazoMeses - a.prazoMeses);
      case 'mais_ativas':
        return sorted.sort((a, b) => (b.qtdAtivasEmDia || 0) - (a.qtdAtivasEmDia || 0));
      case 'mais_contemplacoes':
        return sorted.sort((a, b) => (b.qtdContempladasNoMes || 0) - (a.qtdContempladasNoMes || 0));
      case 'melhor_classificacao':
        return sorted.sort((a, b) => {
          const orderMap = { 'A': 1, 'B': 2, 'C': 3, 'D': 4 };
          const aClass = getClassLetter(a) || 'C';
          const bClass = getClassLetter(b) || 'C';
          return (orderMap[aClass] || 3) - (orderMap[bClass] || 3);
        });
      case 'maior_score':
      default:
        return sorted.sort((a, b) => (b.scoreShelf || 0) - (a.scoreShelf || 0));
    }
  }

  // ─── Projeto Estruturado ───

  let _nextItemId = 1;

  function createProjectItem(group, qtdCotas, overrideValorCarta) {
    group = group && typeof group === 'object' ? group : {};
    const itemId = 'PROJ-' + (_nextItemId++).toString().padStart(3, '0');
    const quantidade = Math.max(1, parseInt(qtdCotas, 10) || 1);
    const prazo = Math.max(1, safeNumber(group.prazoMeses, 1));
    const cartaUnitario = (overrideValorCarta != null && overrideValorCarta > 0)
      ? safeNumber(overrideValorCarta, 0)
      : safeNumber(group.valorCartaRef, 0);
    return {
      itemId,
      groupKey: group.groupKey,
      codigoGrupo: group.codigoGrupo,
      codigoSegmento: group.codigoSegmento,
      administradora: group.nomeAdministradora,
      nomeSegmento: group.nomeSegmento,
      iconSegmento: group.iconSegmento,
      quantidadeCotas: quantidade,
      valorCartaRef: safeNumber(group.valorCartaRef, cartaUnitario),
      valorCartaUnitario: cartaUnitario,
      valorCartaTotal: quantidade * cartaUnitario,

      prazoMeses: prazo,
      taxaAdmPct: safeNumber(group.taxaAdmPct, 0),
      fundoReservaPct: safeNumber(group.fundoReservaPct, 2),
      seguroPct: safeNumber(group.seguroPctComercial, 0),
      indiceCorrecaoNome: group.indiceCorrecaoNome || 'fixo',
      indiceReajuste: Number.isFinite(Number(group.indiceReajustePct))
        ? Number(group.indiceReajustePct)
        : 0,
      mesAniversario: 12,

      estrategiaLance: 'sem_lance',
      modalidadeLance: 'sem_lance',
      lanceProprioPct: 0,
      lanceEmbutidoPct: 0,
      lanceFixoPct: safeNumber(group.lanceFixoPct, 0),
      valorFgts: 0,
      mesContemplacaoAlvo: Math.min(18, prazo),
      reduzirParcelaOuPrazo: null,
      parcelaReduzidaAtiva: false,
      percentualReducao: 0,
      politicaSaldo: 'carta',
      adiantamentos: [],
      inadimplencias: [],
      observacaoItem: '',

      // V7: Dados heurísticos
      classificacao: group._classificacao || null,
      papel: group._papel || null,

      _group: group
    };
  }

  function updateProjectItem(project, itemId, patch) {
    if (!project || !Array.isArray(project.itens)) return;
    const item = project.itens.find(i => i.itemId === itemId);
    if (!item) return;
    Object.assign(item, patch);
    item.quantidadeCotas = Math.max(1, parseInt(item.quantidadeCotas, 10) || 1);
    item.valorCartaUnitario = safeNumber(item.valorCartaUnitario, 0);
    item.prazoMeses = Math.max(1, parseInt(item.prazoMeses, 10) || 1);
    item.mesContemplacaoAlvo = Math.max(1, Math.min(parseInt(item.mesContemplacaoAlvo, 10) || 1, item.prazoMeses));
    if (patch.quantidadeCotas !== undefined || patch.valorCartaUnitario !== undefined) {
      item.valorCartaTotal = item.quantidadeCotas * item.valorCartaUnitario;
    }
  }

  function removeProjectItem(project, itemId) {
    if (!project || !Array.isArray(project.itens)) return;
    project.itens = project.itens.filter(i => i.itemId !== itemId);
  }

  function validateProjectItem(item) {
    const errors = [];
    const group = item && item._group ? item._group : {};
    const carta = safeNumber(item && item.valorCartaUnitario, 0);
    const qtd = parseInt(item && item.quantidadeCotas, 10) || 0;
    const prazo = parseInt(item && item.prazoMeses, 10) || 0;
    const mesContemplacao = parseInt(item && item.mesContemplacaoAlvo, 10) || 0;
    const lanceEmbutido = safeNumber(item && item.lanceEmbutidoPct, 0);
    const limiteEmbutido = safeNumber(group.lanceEmbutidoMaxPct, 0);

    if (carta <= 0) errors.push('valor da carta deve ser maior que zero');
    if (qtd < 1) errors.push('quantidade de cotas deve ser maior ou igual a 1');
    if (prazo <= 0) errors.push('prazo deve ser maior que zero');
    if (mesContemplacao < 1 || mesContemplacao > prazo) errors.push('mês de contemplação fora do prazo');
    if (limiteEmbutido > 0 && lanceEmbutido > limiteEmbutido) {
      errors.push(`lance embutido acima do limite de ${limiteEmbutido.toFixed(1)}%`);
    }

    return errors;
  }

  // ─── Simulação do Projeto Estruturado ───

  function simulateStructuredProject(project, sharedParams = {}) {
    if (typeof Comparator === 'undefined' || typeof ConsorcioEngine === 'undefined') {
      return {
        erro: true,
        mensagens: ['Motor financeiro indisponível para simular o projeto estruturado.'],
        itemResults: [],
        consolidado: null
      };
    }

    const projectItems = project && Array.isArray(project.itens) ? project.itens : [];
    const itemResults = [];
    let totalCarta = 0;
    let totalCotas = 0;
    let totalPago = 0;
    let totalAteContemplacao = 0;
    let cartaLiquida = 0;
    let totalLanceProprioR = 0;
    let totalLanceEmbutidoR = 0;
    let totalLanceAplicadoR = 0;
    let parcelaInicialTotal = 0;
    let totalTaxaAdm = 0;
    let totalFundoReserva = 0;
    let totalSeguro = 0;
    let totalSaldoInicial = 0;
    let totalCusto = 0;
    let somaPrazoPonderado = 0;
    let somaTaxaPonderada = 0;
    let pesoCarta = 0;
    let maxPrazo = 0;
    const mensagens = [];
    const totalProjectCredit = projectItems.reduce((sum, item) => {
      if (!item || typeof item !== 'object') return sum;
      const quantity = Math.max(1, parseInt(item.quantidadeCotas, 10) || 1);
      const unitCredit = safeNumber(item.valorCartaUnitario, safeNumber(item._group && item._group.valorCartaRef, 0));
      return sum + (quantity * unitCredit);
    }, 0);

    for (const item of projectItems) {
      if (!item || typeof item !== 'object') {
        mensagens.push('Item de projeto inválido ignorado na simulação.');
        itemResults.push({ item, erro: true, mensagens: ['item inválido'] });
        continue;
      }
      const group = item._group || {};
      item.quantidadeCotas = Math.max(1, parseInt(item.quantidadeCotas, 10) || 1);
      item.valorCartaUnitario = safeNumber(item.valorCartaUnitario, 0);
      item.valorCartaTotal = item.quantidadeCotas * item.valorCartaUnitario;
      item.prazoMeses = Math.max(1, parseInt(item.prazoMeses, 10) || safeNumber(group.prazoMeses, 1));
      item.taxaAdmPct = safeNumber(item.taxaAdmPct, safeNumber(group.taxaAdmPct, 0));
      item.fundoReservaPct = safeNumber(item.fundoReservaPct, safeNumber(group.fundoReservaPct, 2));
      item.lanceProprioPct = safeNumber(item.lanceProprioPct, 0);
      item.lanceEmbutidoPct = safeNumber(item.lanceEmbutidoPct, 0);
      item.mesContemplacaoAlvo = Math.max(1, parseInt(item.mesContemplacaoAlvo, 10) || 1);
      item.modalidadeLance = normalizeBidMode(
        item.modalidadeLance || sharedParams.modalidadeLance || 'combinado',
        'combinado'
      );

      const validationErrors = validateProjectItem(item);
      if (validationErrors.length > 0) {
        const msg = `Grupo ${item.codigoGrupo || 'sem código'}: ${validationErrors.join('; ')}.`;
        mensagens.push(msg);
        itemResults.push({ item, erro: true, mensagens: validationErrors });
        continue;
      }

      const lanceProprioConfiguradoR = roundMoney(item.valorCartaTotal * (item.lanceProprioPct / 100));
      const lanceEmbutidoConfiguradoR = roundMoney(item.valorCartaTotal * (item.lanceEmbutidoPct / 100));
      const itemAdvances = Array.isArray(item.adiantamentos) && item.adiantamentos.length > 0
        ? item.adiantamentos.map((advance) => ({ ...advance }))
        : (Array.isArray(sharedParams.adiantamentos) ? sharedParams.adiantamentos : []).map((advance) => {
            const projectValue = safeNumber(advance && advance.valor, 0);
            return {
              ...advance,
              // O valor da etapa de eventos pertence ao projeto. Cada motor
              // unitario recebe sua fracao para a consolidacao nao duplicar caixa.
              valor: projectValue > 0 && totalProjectCredit > 0
                ? projectValue * (item.valorCartaUnitario / totalProjectCredit)
                : projectValue
            };
          });
      const itemDefaults = Array.isArray(item.inadimplencias) && item.inadimplencias.length > 0
        ? item.inadimplencias.map((entry) => ({ ...entry }))
        : (Array.isArray(sharedParams.inadimplencias) ? sharedParams.inadimplencias : []).map((entry) => ({ ...entry }));

      const scenario = {
        saldoInicialMode: item.politicaSaldo || sharedParams.politicaSaldo || 'carta',
        // O índice exibido no item é a fonte da verdade. Zero é uma premissa
        // explícita e não pode herdar silenciosamente o fallback global de 5%.
        indiceReajustePct: safeNumber(item.indiceReajuste, 0),
        mesContemplacao: item.mesContemplacaoAlvo,
        lanceProprioPct: item.lanceProprioPct,
        lanceEmbutidoPct: item.lanceEmbutidoPct,
        usarFgts: item.valorFgts > 0,
        valorFgts: item.valorFgts || 0,
        modalidadeLance: item.modalidadeLance,
        parcelaReduzida: item.parcelaReduzidaAtiva,
        percentualReducao: safeNumber(item.percentualReducao, safeNumber(group.reducaoMaxParcelaPct, 0)),
        adiantamentos: itemAdvances,
        inadimplencias: itemDefaults,
        adiantamentoMes: 0,
        adiantamentoValor: 0,
        adiantamentoModo: 'reduzir_saldo',
        inadimplenciaMes: 0,
        mesesAtraso: 0,
        multaPct: safeNumber(item.multaAtraso, safeNumber(sharedParams.multaAtraso, 2)),
        jurosPct: safeNumber(item.jurosAtraso, safeNumber(sharedParams.jurosAtraso, 1))
      };

      const groupForEngine = {
        valorCarta: item.valorCartaUnitario,
        prazoMeses: item.prazoMeses,
        taxaAdmTotalPct: item.taxaAdmPct,
        fundoReservaPct: item.fundoReservaPct,
        seguroPct: safeNumber(item.seguroPct, safeNumber(group.seguroPctComercial, 0)),
        indiceReajuste: item.indiceCorrecaoNome != null ? item.indiceCorrecaoNome : (group.indiceCorrecaoNome || 'fixo'),
        mesAniversario: safeNumber(item.mesAniversario, safeNumber(sharedParams.mesAniversario, 12)),
        lanceEmbutidoMaxPct: group.lanceEmbutidoMaxPct || 0,
        lanceFixoPct: group.lanceFixoPct || 0,
        parcelaReduzidaDisponivel: group.parcelaReduzidaDisponivel,
        reducaoMaxParcelaPct: group.reducaoMaxParcelaPct || 0,
        tipoBem: group.macroCategoria || 'imovel',
        administradora: group.nomeAdministradora,
        codigoGrupo: group.codigoGrupo,
        observacao: ''
      };

      const params = Comparator.normalizeInputs(groupForEngine, scenario);
      const sim = ConsorcioEngine.simular(params);

      if (sim.erro) {
        mensagens.push(`Grupo ${item.codigoGrupo || 'sem código'}: ${(sim.mensagens || []).join('; ')}`);
        itemResults.push({ item, erro: true, mensagens: sim.mensagens });
        continue;
      }

      const resumo = sim.resumo;
      const parcelaUnitaria = resumo.parcelaTotalAtual || 0;
      const totalPagoUnitario = resumo.totalPago || 0;
      const totalAteContemplacaoUnitario = resumo.totalPagoAteContemplacao || 0;
      const quantidade = item.quantidadeCotas;
      const selectedOwnUnit = safeNumber(resumo.lanceProprioSelecionado, 0);
      const selectedCashUnit = selectedOwnUnit
        + safeNumber(resumo.lanceFGTSSelecionado, 0)
        + safeNumber(resumo.lanceFixoSelecionado, 0);
      const appliedCashUnit = safeNumber(resumo.lanceCaixa, 0);
      const appliedOwnUnit = selectedCashUnit > 0
        ? roundMoney(appliedCashUnit * selectedOwnUnit / selectedCashUnit)
        : 0;
      const lanceProprioR = roundMoney(appliedOwnUnit * quantidade);
      const lanceEmbutidoR = roundMoney(safeNumber(resumo.lanceEmbutidoAplicado, 0) * quantidade);
      const lanceTotalR = roundMoney(safeNumber(resumo.lanceAplicado, 0) * quantidade);
      const cartaLiquidaItem = roundMoney(item.valorCartaTotal - lanceEmbutidoR);

      itemResults.push({
        item, erro: false, simulation: sim, resumo,
        engineParams: {
          ...params,
          adiantamentos: Array.isArray(params.adiantamentos) ? params.adiantamentos.map(entry => ({ ...entry })) : [],
          inadimplencias: Array.isArray(params.inadimplencias) ? params.inadimplencias.map(entry => ({ ...entry })) : []
        },
        parcelaUnitaria,
        totalPagoUnitario,
        totalAteContemplacaoUnitario,
        parcelaTotal: parcelaUnitaria * quantidade,
        totalPagoTotal: totalPagoUnitario * quantidade,
        totalAteContemplacaoTotal: totalAteContemplacaoUnitario * quantidade,
        cartaTotal: item.valorCartaTotal,
        lanceProprioR,
        lanceEmbutidoR,
        lanceTotalR,
        lanceProprioConfiguradoR,
        lanceEmbutidoConfiguradoR,
        cartaLiquida: cartaLiquidaItem
      });

      totalCarta += item.valorCartaTotal;
      totalCotas += item.quantidadeCotas;
      totalPago += totalPagoUnitario * item.quantidadeCotas;
      totalAteContemplacao += totalAteContemplacaoUnitario * item.quantidadeCotas;
      totalLanceProprioR += lanceProprioR;
      totalLanceEmbutidoR += lanceEmbutidoR;
      totalLanceAplicadoR += lanceTotalR;
      cartaLiquida += cartaLiquidaItem;
      parcelaInicialTotal += parcelaUnitaria * item.quantidadeCotas;
      totalTaxaAdm += safeNumber(resumo.taxaAdmTotal, 0) * item.quantidadeCotas;
      totalFundoReserva += safeNumber(resumo.fundoReservaTotal, 0) * item.quantidadeCotas;
      totalSeguro += safeNumber(resumo.seguroTotal, 0) * item.quantidadeCotas;
      totalSaldoInicial += safeNumber(resumo.saldoInicial, 0) * item.quantidadeCotas;
      totalCusto += safeNumber(resumo.custoTotal, 0) * item.quantidadeCotas;
      somaPrazoPonderado += item.prazoMeses * item.valorCartaTotal;
      somaTaxaPonderada += item.taxaAdmPct * item.valorCartaTotal;
      pesoCarta += item.valorCartaTotal;
      maxPrazo = Math.max(maxPrazo, item.prazoMeses);
    }

    const cronogramaConsolidado = [];
    for (let m = 0; m < maxPrazo; m++) {
      const aggregate = {
        mes: m + 1,
        saldoAnterior: 0,
        saldoAjustado: 0,
        indiceAplicado: 0,
        reajusteValor: 0,
        parcelaBase: 0,
        parcelaReduzida: 0,
        componenteTaxaAdm: 0,
        componenteFundoReserva: 0,
        componenteSeguro: 0,
        parcelaTotal: 0,
        valorLance: 0,
        valorLanceCaixa: 0,
        lanceExcedente: 0,
        valorAdiantado: 0,
        multa: 0,
        juros: 0,
        saldoFinal: 0,
        prazoRestante: 0,
        evento: 'normal',
        observacao: ''
      };
      const eventos = new Set();
      const observacoes = [];
      for (const ir of itemResults) {
        if (ir.erro) continue;
        const cron = ir.simulation.cronograma;
        if (cron[m]) {
          const row = cron[m];
          const qtd = ir.item.quantidadeCotas;
          ['saldoAnterior', 'saldoAjustado', 'reajusteValor', 'parcelaBase', 'parcelaReduzida', 'componenteTaxaAdm',
            'componenteFundoReserva', 'componenteSeguro', 'parcelaTotal', 'valorLance', 'valorLanceCaixa', 'lanceExcedente',
            'valorAdiantado', 'multa', 'juros', 'saldoFinal'].forEach((field) => {
            aggregate[field] += safeNumber(row[field], 0) * qtd;
          });
          aggregate.indiceAplicado = Math.max(aggregate.indiceAplicado, safeNumber(row.indiceAplicado, 0));
          aggregate.prazoRestante = Math.max(aggregate.prazoRestante, safeNumber(row.prazoRestante, 0));
          if (row.evento && row.evento !== 'normal') eventos.add(row.evento);
          if (row.observacao) observacoes.push(`${ir.item.codigoGrupo || 'Grupo'}: ${row.observacao}`);
        }
      }
      aggregate.evento = eventos.size ? Array.from(eventos).join(' + ') : 'normal';
      aggregate.observacao = observacoes.join(' | ');
      aggregate.saldoTotal = aggregate.saldoFinal;
      cronogramaConsolidado.push(aggregate);
    }

    while (cronogramaConsolidado.length > 1) {
      const last = cronogramaConsolidado[cronogramaConsolidado.length - 1];
      if (Math.abs(last.saldoFinal) > 0.01 || Math.abs(last.parcelaTotal) > 0.01
        || Math.abs(last.valorAdiantado) > 0.01 || Math.abs(last.valorLance) > 0.01) break;
      cronogramaConsolidado.pop();
    }
    maxPrazo = cronogramaConsolidado.length;

    totalCarta = roundMoney(totalCarta);
    cartaLiquida = roundMoney(cartaLiquida);
    totalLanceProprioR = roundMoney(totalLanceProprioR);
    totalLanceEmbutidoR = roundMoney(totalLanceEmbutidoR);
    const totalLanceR = roundMoney(totalLanceAplicadoR);
    const prazoMedio = pesoCarta > 0 ? somaPrazoPonderado / pesoCarta : 0;
    const taxaAdmMedia = pesoCarta > 0 ? somaTaxaPonderada / pesoCarta : 0;
    const custosContratados = totalTaxaAdm + totalFundoReserva + totalSeguro;
    const custoEfetivoEstimado = Math.max(0, totalCusto, custosContratados);
    const custoEfetivoMedio = totalCarta > 0 ? (custoEfetivoEstimado / totalCarta) * 100 : 0;

    return {
      erro: itemResults.length > 0 && itemResults.every(r => r.erro),
      mensagens,
      itemResults,
      consolidado: {
        totalCarta, totalCotas,
        totalGrupos: projectItems.length,
        totalGruposValidos: itemResults.filter(r => !r.erro).length,
        totalPago, totalAteContemplacao, maxPrazo,
        cartaLiquida,
        totalLanceR,
        totalLanceProprioR,
        totalLanceEmbutidoR,
        parcelaInicialTotal,
        totalTaxaAdm,
        totalFundoReserva,
        totalSeguro,
        totalSaldoInicial,
        totalCusto,
        prazoMedio,
        taxaAdmMedia,
        custoEfetivoMedio,
        cronograma: cronogramaConsolidado
      }
    };
  }

  // ─── Administradoras únicas ───
  function getUniqueAdmins(catalog) {
    return [...new Set(catalog.map(g => g.nomeAdministradora).filter(Boolean))].sort();
  }

  // ─── API Pública ───
  return {
    computeShelfScore,
    computeAllScores,
    filterGroups,
    sortGroups,
    paginateGroups,
    createProjectItem,
    updateProjectItem,
    removeProjectItem,
    simulateStructuredProject,
    getUniqueAdmins
  };
})();
