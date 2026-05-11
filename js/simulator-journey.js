/**
 * Simulator journey helpers.
 * Keeps context, prefill and next-action rules out of the main UI controller.
 */
(function simulatorJourneyFactory(global) {
  'use strict';

  function safeNumber(value, fallback = 0) {
    const n = Number(value);
    return Number.isFinite(n) ? n : fallback;
  }

  function getDecisionContextSnapshot(decisionContext) {
    const service = decisionContext || global.BFDecisionContext;
    if (!service || typeof service.buildSimulationPrefill !== 'function') {
      return {
        source: 'none',
        readinessScore: 0,
        profileSnapshot: {},
        prefill: {},
        readiness: { score: 0, complete: false, missing: [], message: 'Contexto financeiro nao carregado.' }
      };
    }
    return service.buildSimulationPrefill();
  }

  function contextSourceLabel(context) {
    if (!context || context.source === 'none') return 'Sem origem';
    if (context.source === 'calculator') return context.calculatorSlug ? `Calculadora ${context.calculatorSlug}` : 'Calculadora';
    if (context.source === 'journey') return context.journeyId ? `Jornada ${context.journeyId}` : 'Jornada';
    return 'Perfil financeiro';
  }

  function calculatorPageHref(slug) {
    if (!slug) return 'calculadoras.html';
    if (slug === 'comparador') return 'comparador.html';
    return `calculadora-${slug}.html`;
  }

  function inferObjetivoValue(text) {
    const value = String(text || '').toLowerCase();
    if (value.includes('invest') || value.includes('patrimonio') || value.includes('aposent')) return 'investimento';
    if (value.includes('liquidez') || value.includes('reserva')) return 'investimento';
    return 'aquisicao';
  }

  function buildPrefillPlan(context) {
    const prefill = context && context.prefill ? context.prefill : {};
    const targetValue = safeNumber(prefill.valorAlvo);
    const lancePct = safeNumber(prefill.lanceProprioSugeridoPct);
    const plan = [];

    if (prefill.clienteObjetivo) {
      plan.push({ id: 'clienteObjetivo', value: inferObjetivoValue(prefill.clienteObjetivo), defaults: ['aquisicao'] });
    }
    if (targetValue > 0) {
      plan.push({ id: 'valorCarta', value: targetValue });
      plan.push({ id: 'filtroCartaMin', value: Math.max(0, Math.round(targetValue * 0.85 / 1000) * 1000) });
      plan.push({ id: 'filtroCartaMax', value: Math.round(targetValue * 1.15 / 1000) * 1000 });
    }
    if (lancePct > 0) {
      plan.push({ id: 'compLanceProprio', value: Math.round(lancePct * 10) / 10, defaults: ['', '20'] });
    }
    if (prefill.observacoes) {
      plan.push({ id: 'observacoes', value: prefill.observacoes });
    }
    return plan;
  }

  function buildDecisionCards(input = {}) {
    const format = input.format || {};
    const money = format.money || ((value) => String(value || 0));
    const number = format.number || ((value) => String(value || 0));
    const dataStatus = input.dataStatus || {};
    const project = input.project || {};
    const savedCount = safeNumber(input.savedCount);
    const shelfCount = safeNumber(input.shelfCount);
    const decisionContext = input.decisionContext || {};
    const readiness = input.readiness || decisionContext.readiness || { score: decisionContext.readinessScore || 0, complete: false, message: 'Complete o diagnostico financeiro.' };
    const hasCart = !!input.hasCart;
    const hasResult = !!input.hasResult;
    const savedLabel = savedCount === 1 ? '1 simulacao salva' : `${number(savedCount, 0)} simulacoes salvas`;

    return [
      {
        tone: readiness.complete ? 'stable' : 'warning',
        eyebrow: 'Contexto',
        title: `${safeNumber(readiness.score)}/100 prontidao`,
        body: readiness.complete
          ? `Origem ${contextSourceLabel(decisionContext)} pronta para orientar prateleira, lance e continuidade.`
          : readiness.message || 'Complete renda, custos e reserva antes de avancar sem contexto.',
        action: contextSourceLabel(decisionContext)
      },
      {
        tone: dataStatus.error ? 'warning' : dataStatus.loaded ? 'stable' : 'info',
        eyebrow: 'Base',
        title: dataStatus.loaded ? 'Base real carregada' : dataStatus.error ? 'Base em fallback' : 'Base aguardando',
        body: dataStatus.loaded
          ? `${number(dataStatus.count || 0, 0)} grupos disponiveis para filtros, score e comparacao.`
          : dataStatus.error
            ? 'A jornada permanece segura, mas a prateleira deve ser revisada antes da proposta.'
            : 'A conexao local ainda esta preparando a prateleira de grupos.',
        action: 'Conferir status da conexao'
      },
      {
        tone: hasCart ? 'stable' : shelfCount > 0 ? 'info' : 'warning',
        eyebrow: 'Prateleira',
        title: hasCart
          ? `${project.totalGrupos} grupo${project.totalGrupos === 1 ? '' : 's'} selecionado${project.totalGrupos === 1 ? '' : 's'}`
          : shelfCount > 0
            ? `${number(shelfCount, 0)} grupos filtrados`
            : 'Selecionar grupo',
        body: hasCart
          ? `${project.totalCotas} cota${project.totalCotas === 1 ? '' : 's'} e ${money(project.totalCarta)} em cartas no projeto.`
          : shelfCount > 0
            ? 'Escolha os grupos que devem entrar na sacola antes de avancar para parametros.'
            : 'Use os filtros para formar uma prateleira compativel com o perfil do cliente.',
        action: hasCart ? 'Validar parametros da sacola' : 'Ir para a prateleira'
      },
      {
        tone: hasResult ? 'stable' : hasCart ? 'info' : 'warning',
        eyebrow: 'Resultado',
        title: hasResult ? money(project.cartaLiquida) : hasCart ? 'Calcular proposta' : 'Aguardando carrinho',
        body: hasResult
          ? `Parcela atual ${money(project.parcelaAtual)}, lance ${money(project.lanceTotal)} e prazo ${number(project.prazo, 0)} meses.`
          : hasCart
            ? 'Com a sacola montada, avance ate Resultados para gerar memoria, cronograma e proposta.'
            : 'O resumo financeiro depende de pelo menos um grupo selecionado.',
        action: hasResult ? 'Revisar memoria de calculo' : 'Gerar resumo financeiro'
      },
      {
        tone: hasResult ? 'info' : savedCount > 0 ? 'stable' : 'warning',
        eyebrow: 'Continuidade',
        title: hasResult ? 'Salvar e acompanhar' : savedLabel,
        body: hasResult
          ? 'Salve o cenario para que a Carteira trate o lead como pipeline consultivo retomavel.'
          : savedCount > 0
            ? 'Ha simulacoes anteriores disponiveis para abrir, revisar e conectar a Carteira.'
            : 'Nenhum cenario salvo ainda. Finalize um calculo para criar continuidade comercial.',
        action: hasResult ? 'Salvar cenario na Carteira' : 'Abrir simulacoes salvas'
      }
    ];
  }

  function buildJourneyActions(input = {}) {
    const decisionContext = input.decisionContext || {};
    const readiness = input.readiness || decisionContext.readiness || {};
    if (!readiness.complete) {
      const recommended = Array.isArray(input.recommendedCalculators) && input.recommendedCalculators.length
        ? input.recommendedCalculators
        : ['custos-fixos'];
      return [
        { type: 'link', label: 'Completar diagnostico', href: calculatorPageHref(recommended[0]) },
        { type: 'link', label: 'Ver calculadoras', href: 'calculadoras.html?from=simulador' }
      ];
    }
    if (!input.dataStatus || !input.dataStatus.loaded) {
      return [{ type: 'link', label: 'Conferir base real', href: '#database-status-panel' }];
    }
    if (!input.hasCart) {
      return [
        { type: 'button', label: input.shelfCount > 0 ? 'Ir para prateleira' : 'Buscar grupos', action: input.shelfCount > 0 ? 'goToStep:4' : 'buscarGrupos' },
        { type: 'link', label: 'Ajustar filtros', href: '#step-3' }
      ];
    }
    if (!input.hasResult) {
      return [
        { type: 'button', label: 'Gerar resultado', action: 'goToStep:7' },
        { type: 'link', label: 'Revisar sacola', href: '#step-5' }
      ];
    }
    return [
      { type: 'button', label: 'Salvar cenario', action: 'salvarSimulacao' },
      { type: 'link', label: 'Preparar proposta', href: '#proposal-builder-board' },
      { type: 'link', label: 'Abrir carteira', href: 'carteira.html#simulacoes-salvas' }
    ];
  }

  global.BFSimulatorJourney = {
    getDecisionContextSnapshot,
    contextSourceLabel,
    calculatorPageHref,
    inferObjetivoValue,
    buildPrefillPlan,
    buildDecisionCards,
    buildJourneyActions
  };
})(typeof window !== 'undefined' ? window : globalThis);
