/**
 * Bancus Fraternis home dashboard.
 * Loads real catalog stats and local portfolio state for the portal home.
 */
(function () {
  'use strict';

  const BASE_PATH = `${location.pathname.includes('/pages/') ? '../' : ''}data_base/Tab_Grupos_Consorcio.json`;

  const SEGMENTS = {
    1: 'Imoveis',
    2: 'Veiculos pesados',
    3: 'Automoveis',
    4: 'Motocicletas',
    5: 'Servicos',
    6: 'Eletroeletronicos'
  };

  const money = new Intl.NumberFormat('pt-BR', {
    style: 'currency',
    currency: 'BRL',
    maximumFractionDigits: 0
  });

  const number = new Intl.NumberFormat('pt-BR');

  function one(selector) {
    return document.querySelector(selector);
  }

  function all(selector) {
    return Array.from(document.querySelectorAll(selector));
  }

  function setText(selector, value) {
    const el = one(selector);
    if (el) el.textContent = value;
  }

  function toNumber(value) {
    if (typeof value === 'number') return Number.isFinite(value) ? value : 0;
    if (typeof value !== 'string') return 0;
    const trimmed = value.trim();
    const normalized = trimmed.includes(',')
      ? trimmed.replace(/\./g, '').replace(',', '.')
      : trimmed;
    const parsed = Number(normalized);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  function getStorageAPI() {
    try {
      if (typeof Storage !== 'undefined' && Storage && typeof Storage.listSimulations === 'function') {
        return Storage;
      }
    } catch (error) {
      return null;
    }
    return null;
  }

  function getSettingsConfig() {
    try {
      if (typeof Settings !== 'undefined' && Settings && typeof Settings.load === 'function') {
        return Settings.load();
      }
    } catch (error) {
      return {};
    }
    return {};
  }

  const CALCULATOR_ROUTES = {
    'custos-fixos': { label: 'Custos fixos', href: 'calculadora-custos-fixos.html', detail: 'Mapear renda, custos e sobra mensal.' },
    'reserva-emergencia': { label: 'Reserva de emergencia', href: 'calculadora-reserva-emergencia.html', detail: 'Medir protecao antes de assumir risco.' },
    'capacidade-credito': { label: 'Capacidade de credito', href: 'calculadora-capacidade-credito.html', detail: 'Definir parcela segura e folga mensal.' },
    'compra-vista-parcelado': { label: 'Vista ou parcelado', href: 'calculadora-compra-vista-parcelado.html', detail: 'Comparar liquidez, juros e custo de oportunidade.' },
    comparador: { label: 'Comparador', href: 'comparador.html', detail: 'Colocar alternativas lado a lado.' },
    'lance-consorcio': { label: 'Lance consorcio', href: 'calculadora-lance-consorcio.html', detail: 'Avaliar lance proprio sem comprometer reserva.' }
  };

  function decisionContext() {
    try {
      return (typeof window !== 'undefined' && window.BFDecisionContext) ? window.BFDecisionContext : null;
    } catch (error) {
      return null;
    }
  }

  function readLocalJson(key, fallback) {
    try {
      if (typeof localStorage === 'undefined') return fallback;
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : fallback;
    } catch (error) {
      return fallback;
    }
  }

  function loadDecisionProfile() {
    const context = decisionContext();
    if (context && typeof context.loadProfile === 'function') return context.loadProfile();
    return readLocalJson('bf_financial_profile_v1', {});
  }

  function loadCalculatorHistory() {
    const context = decisionContext();
    if (context && typeof context.loadHistory === 'function') return context.loadHistory();
    const history = readLocalJson('bf_calculator_history_v1', []);
    return Array.isArray(history) ? history : [];
  }

  function decisionJourneyService() {
    try {
      return (typeof window !== 'undefined' && window.BFTrilhaDecisaoService) ? window.BFTrilhaDecisaoService : null;
    } catch (error) {
      return null;
    }
  }

  function loadDecisionJourney() {
    const service = decisionJourneyService();
    if (service && typeof service.load === 'function') {
      const journey = service.load();
      if (journey && typeof journey === 'object') return journey;
    }
    return readLocalJson('bf_decision_journey_v1:anon', null);
  }

  function firstText(...values) {
    for (const value of values) {
      const text = String(value || '').trim();
      if (text) return text;
    }
    return '';
  }

  function productLabel(product) {
    return firstText(product && product.nome, product && product.name, product && product.label, product && product.id);
  }

  function journeyNextAction(journey) {
    return (journey && journey.nextAction && typeof journey.nextAction === 'object') ? journey.nextAction : {};
  }

  function journeyLabel(journey) {
    return firstText(
      journey && journey.objectiveLabel,
      productLabel(journey && journey.recommendedProduct),
      journey && journey.recommendation && journey.recommendation.title,
      'Trilha assistida'
    );
  }

  function journeyHref(journey) {
    const action = journeyNextAction(journey);
    return firstText(action.href, journey && journey.href, 'trilha-decisao.html');
  }

  function journeyActionLabel(journey) {
    const action = journeyNextAction(journey);
    return firstText(action.label, action.title, 'Continuar trilha');
  }

  function journeySummary(journey) {
    if (!journey) return 'Monte uma trilha para conectar objetivo, produto, comparador e simulador.';
    const action = journeyNextAction(journey);
    const product = productLabel(journey.recommendedProduct);
    const model = firstText(journey.recommendedModel && journey.recommendedModel.name, journey.recommendedModel && journey.recommendedModel.label);
    const next = firstText(action.title, action.label, journey.recommendation && journey.recommendation.next);
    const parts = [];
    if (product) parts.push(`Produto: ${product}`);
    if (model) parts.push(`Modelo: ${model}`);
    if (next) parts.push(`Proximo: ${next}`);
    return parts.length ? parts.join('. ') : 'Trilha ativa com contexto salvo neste navegador.';
  }

  function readinessForHome(profile) {
    const context = decisionContext();
    if (context && typeof context.readiness === 'function') return context.readiness(profile || loadDecisionProfile());
    return {
      score: 0,
      level: 'diagnostico',
      tone: 'danger',
      complete: false,
      missing: [{ label: 'Perfil financeiro', calculatorSlug: 'custos-fixos' }],
      title: 'Diagnostico recomendado',
      message: 'Complete renda, custos e reserva antes de comparar cenarios.'
    };
  }

  function recommendedForHome(profile) {
    const context = decisionContext();
    if (context && typeof context.recommendedCalculators === 'function') return context.recommendedCalculators(profile || loadDecisionProfile());
    return ['custos-fixos', 'reserva-emergencia', 'capacidade-credito', 'comparador'];
  }

  function latestByDate(items) {
    return (items || []).slice().sort((a, b) => {
      const bDate = b.updatedAt || b.createdAt || b.atualizadoEm || b.criadoEm || '';
      const aDate = a.updatedAt || a.createdAt || a.atualizadoEm || a.criadoEm || '';
      return String(bDate).localeCompare(String(aDate));
    })[0] || null;
  }

  function routeForCalculator(slug) {
    return CALCULATOR_ROUTES[slug] || {
      label: String(slug || 'Calculadora').replace(/-/g, ' '),
      href: 'calculadoras.html',
      detail: 'Continuar diagnostico financeiro.'
    };
  }

  function profileValue(profile, keys) {
    for (const key of keys) {
      if (profile && Number(profile[key] || 0) > 0) return Number(profile[key]);
    }
    return 0;
  }

  function buildContinuityModel() {
    const profile = loadDecisionProfile();
    const status = readinessForHome(profile);
    const history = loadCalculatorHistory();
    const storage = getStorageAPI();
    const simulations = storage && typeof storage.listSimulations === 'function' ? storage.listSimulations() : [];
    const activeJourney = loadDecisionJourney();
    const latestHistory = latestByDate(history);
    const latestSimulation = latestByDate(simulations);
    const recommendations = recommendedForHome(profile).map(routeForCalculator).slice(0, 4);
    const renda = profileValue(profile, ['rendaMensal']);
    const reserva = profileValue(profile, ['reservaAtual']);
    const capacidade = profileValue(profile, ['capacidadePagamento', 'capacidadeAporte']);

    return {
      profile,
      status,
      history,
      simulations,
      activeJourney,
      latestHistory,
      latestSimulation,
      recommendations,
      metrics: {
        score: status.score || 0,
        history: history.length,
        simulations: simulations.length,
        journey: activeJourney ? 1 : 0,
        capacity: capacidade,
        income: renda,
        reserve: reserva
      }
    };
  }

  function continuityTone(status) {
    if (!status) return 'is-warn';
    if (status.score >= 80) return 'is-strong';
    if (status.score >= 45) return 'is-warn';
    return '';
  }

  function setHref(selector, href, label) {
    const el = one(selector);
    if (!el) return;
    el.href = href;
    if (label) el.textContent = label;
  }

  function simulatorContextHref(history) {
    if (history && history.calculatorSlug && history.id) {
      return `simulador.html?from=calculator&calculatorSlug=${encodeURIComponent(history.calculatorSlug)}&historyId=${encodeURIComponent(history.id)}`;
    }
    return 'simulador.html?from=journey&journeyId=home-contextual';
  }

  function buildHomeHeroContext(model) {
    const current = model || buildContinuityModel();
    const status = current.status || {};
    const latestCalc = current.latestHistory;
    const latestSim = current.latestSimulation;
    const activeJourney = current.activeJourney;
    const latestRoute = latestCalc ? routeForCalculator(latestCalc.calculatorSlug) : routeForCalculator('custos-fixos');
    const historyCount = current.history.length;
    const simulationCount = current.simulations.length;
    const score = Number(status.score || 0);
    const origin = latestSim
      ? 'Você tem uma simulação salva'
      : (activeJourney ? 'Você tem um plano em andamento' : (latestCalc ? `Último cálculo: ${latestRoute.label}` : 'Comece com seus dados básicos'));

    const base = {
      stage: 'diagnostic',
      badge: 'Comece pelo orçamento',
      title: 'Veja quanto cabe no seu mês antes de assumir uma parcela.',
      copy: 'Informe renda, gastos e reserva para comparar opções dentro de um limite realista.',
      primaryHref: 'calculadora-custos-fixos.html',
      primaryLabel: 'Informar meus dados',
      secondaryHref: 'calculadoras.html',
      secondaryLabel: 'Ver calculadoras',
      state: score > 0 ? 'Dados iniciados' : 'Primeiro passo',
      next: 'Informe renda, gastos e reserva',
      origin,
      panelTitle: 'Seu orçamento',
      panelBadge: 'Próximo passo',
      panelNote: 'Preencha os valores básicos para estimar uma parcela confortável.',
      historyCount,
      simulationCount
    };

    if (activeJourney && !latestSim) {
      const actionLabel = journeyActionLabel(activeJourney);
      return {
        ...base,
        stage: 'journey',
        badge: 'Continue de onde parou',
        title: 'Seu plano está pronto para continuar.',
        copy: 'Abra a última etapa concluída e siga com os dados já informados.',
        primaryHref: journeyHref(activeJourney),
        primaryLabel: actionLabel,
        secondaryHref: 'trilha-decisao.html',
        secondaryLabel: 'Ver meu plano',
        next: firstText(journeyNextAction(activeJourney).title, actionLabel, 'Continuar decisao'),
        panelTitle: journeyLabel(activeJourney),
        panelBadge: 'Em andamento',
        panelNote: journeySummary(activeJourney)
      };
    }

    if (score >= 80 && !latestSim) {
      return {
        ...base,
        stage: 'ready',
        badge: 'Pronto para simular',
        title: 'Seus dados já permitem iniciar uma simulação.',
        copy: 'Use a renda, a reserva e o limite mensal já informados para comparar carta, parcela e lance.',
        primaryHref: simulatorContextHref(latestCalc),
        primaryLabel: 'Simular consórcio',
        secondaryHref: 'comparador.html',
        secondaryLabel: 'Comparar alternativas',
        next: 'Escolher grupos e valores',
        panelTitle: 'Dados preenchidos',
        panelBadge: 'Pronto para simular',
        panelNote: 'Compare carta, parcela e lance sem preencher tudo novamente.'
      };
    }

    if (latestSim) {
      return {
        ...base,
        stage: 'simulation',
        badge: 'Simulação salva',
        title: 'Revise sua simulação ou gere a proposta.',
        copy: 'Os grupos e valores informados continuam disponíveis para você conferir.',
        primaryHref: 'carteira.html',
        primaryLabel: 'Abrir carteira',
        secondaryHref: latestSim.id ? `simulador.html?simulationId=${encodeURIComponent(latestSim.id)}` : 'simulador.html',
        secondaryLabel: 'Revisar simulacao',
        next: 'Conferir valores e parcelas',
        panelTitle: 'Simulação em andamento',
        panelBadge: 'Pronta para continuar',
        panelNote: 'Abra os valores salvos e siga para a proposta quando estiver tudo certo.'
      };
    }

    if (latestCalc || score >= 45) {
      return {
        ...base,
        stage: 'calculator',
        badge: 'Cálculo salvo',
        title: 'Continue a partir do seu último cálculo.',
        copy: 'Revise o resultado ou use os mesmos dados em uma nova simulação.',
        primaryHref: latestRoute.href,
        primaryLabel: latestCalc ? 'Reabrir cálculo' : 'Completar dados',
        secondaryHref: score >= 60 ? simulatorContextHref(latestCalc) : 'calculadoras.html',
        secondaryLabel: score >= 60 ? 'Simular consórcio' : 'Ver calculadoras',
        next: latestCalc ? latestRoute.detail : 'Completar dados financeiros',
        panelTitle: 'Dados em andamento',
        panelBadge: 'Continue preenchendo',
        panelNote: 'Complete o que falta antes de definir parcela, lance ou prazo.'
      };
    }

    return base;
  }

  function renderHomeContextualHero(model) {
    const hero = one('[data-home-hero-contextual]');
    if (!hero) return null;

    const current = model || buildContinuityModel();
    const heroContext = buildHomeHeroContext(current);
    const status = current.status || {};

    setText('[data-home-hero-badge]', heroContext.badge);
    setText('[data-home-hero-title]', heroContext.title);
    setText('[data-home-hero-copy]', heroContext.copy);
    setHref('[data-home-hero-primary]', heroContext.primaryHref, heroContext.primaryLabel);
    setHref('[data-home-hero-secondary]', heroContext.secondaryHref, heroContext.secondaryLabel);
    setText('[data-home-hero-state]', heroContext.state);
    setText('[data-home-hero-next]', heroContext.next);
    setText('[data-home-hero-origin]', heroContext.origin);
    setText('[data-home-hero-panel-title]', heroContext.panelTitle);
    setText('[data-home-hero-panel-income]', current.metrics.income ? compactCurrency(current.metrics.income) : 'Pendente');
    setText('[data-home-hero-panel-capacity]', current.metrics.capacity ? compactCurrency(current.metrics.capacity) : 'Pendente');
    setText('[data-home-hero-panel-reserve]', current.metrics.reserve ? compactCurrency(current.metrics.reserve) : 'Pendente');
    setText('[data-home-hero-panel-score]', status.score >= 80 ? 'Completo' : (status.score >= 45 ? 'Em andamento' : 'Começando'));
    setText('[data-home-hero-panel-badge]', heroContext.panelBadge);
    setText('[data-home-hero-panel-note]', heroContext.panelNote);

    hero.dataset.homeHeroStage = heroContext.stage;
    document.body.dataset.homeHeroContextReady = 'true';
    document.body.dataset.homeHeroStage = heroContext.stage;
    document.body.dataset.homeHeroPrimaryHref = heroContext.primaryHref;
    return { model: current, hero: heroContext };
  }

  function renderHomeContinuityCockpit() {
    const target = one('[data-home-continuity-cockpit]');
    if (!target) return null;
    const metricsTarget = one('[data-home-continuity-metrics]');
    const cardsTarget = one('[data-home-continuity-cards]');
    const actionsTarget = one('[data-home-next-actions]');
    const model = buildContinuityModel();
    const status = model.status;
    const missing = (status.missing || []).map((item) => item.label).join(', ') || 'Perfil suficiente';
    const latestCalc = model.latestHistory;
    const latestSim = model.latestSimulation;
    const activeJourney = model.activeJourney;
    const activeJourneyHref = journeyHref(activeJourney);
    const activeJourneyLabel = journeyLabel(activeJourney);
    const activeJourneyAction = journeyActionLabel(activeJourney);
    const nextActions = activeJourney ? [
      {
        label: activeJourneyAction,
        href: activeJourneyHref,
        detail: journeySummary(activeJourney)
      }
    ].concat(model.recommendations).slice(0, 4) : model.recommendations;

    if (metricsTarget) {
      metricsTarget.innerHTML = `
        <article class="hm-continuity-metric ${continuityTone(status)}"><small>Perfil</small><strong>${status.score >= 80 ? 'Completo' : (status.score >= 45 ? 'Em andamento' : 'Começando')}</strong><span>dados financeiros</span></article>
        <article class="hm-continuity-metric"><small>Cálculos</small><strong>${number.format(model.history.length)}</strong><span>salvos</span></article>
        <article class="hm-continuity-metric"><small>Simulações</small><strong>${number.format(model.simulations.length)}</strong><span>salvas</span></article>
        <article class="hm-continuity-metric"><small>Limite mensal</small><strong>${compactCurrency(model.metrics.capacity)}</strong><span>valor estimado</span></article>
      `;
    }

    if (cardsTarget) {
      cardsTarget.innerHTML = `
        <article class="hm-continuity-card">
          <span>Último cálculo</span>
          <strong>${escapeHTML(latestCalc ? (latestCalc.calculatorName || latestCalc.calculatorSlug || 'Cálculo salvo') : 'Nenhum cálculo salvo')}</strong>
          <p>${escapeHTML(latestCalc ? (latestCalc.recommendation || 'O resultado está disponível para consulta.') : `Comece informando seus custos fixos. Falta conferir: ${missing}.`)}</p>
          <a href="${latestCalc ? 'calculadoras.html' : 'calculadora-custos-fixos.html'}">${latestCalc ? 'Ver cálculos' : 'Começar'}</a>
        </article>
        <article class="hm-continuity-card">
          <span>Última simulação</span>
          <strong>${escapeHTML(latestSim ? (latestSim.nome || latestSim.name || 'Simulação salva') : 'Nenhuma simulação salva')}</strong>
          <p>${escapeHTML(latestSim ? `Crédito total de ${compactCurrency(latestSim.totalCarta || 0)} para revisar.` : 'Escolha grupos, defina lances e veja as parcelas mês a mês.')}</p>
          <a href="${latestSim ? 'carteira.html' : 'simulador.html'}">${latestSim ? 'Abrir simulação' : 'Simular consórcio'}</a>
        </article>
      `;
    }

    if (actionsTarget) {
      actionsTarget.innerHTML = `
        <div class="hm-next-actions__head">
          <span class="bf-badge bf-badge--gold">Próximos passos</span>
          <strong>Escolha onde deseja continuar</strong>
        </div>
        <div class="hm-next-actions__grid">
          ${nextActions.map((item) => `
            <a class="hm-next-action" href="${escapeHTML(item.href)}">
              <span>${escapeHTML(item.label)}</span>
              <small>${escapeHTML(item.detail)}</small>
            </a>
          `).join('')}
        </div>
      `;
    }

    document.body.dataset.homeContinuityReady = 'true';
    document.body.dataset.homeContinuityScore = String(status.score || 0);
    document.body.dataset.homeContinuityHistory = String(model.history.length);
    document.body.dataset.homeContinuitySimulations = String(model.simulations.length);
    document.body.dataset.homeContinuityJourney = activeJourney ? 'active' : 'empty';
    return model;
  }

  function describeHomeSettings(config) {
    const cfg = config || getSettingsConfig();
    const chips = [];
    if (cfg.defaultSegmento) chips.push(`Segmento: ${SEGMENTS[cfg.defaultSegmento] || cfg.defaultSegmento}`);
    if (cfg.defaultAdmin) chips.push(`Admin: ${cfg.defaultAdmin}`);
    chips.push(`${cfg.pageSize || 20} grupos por pagina`);
    chips.push(cfg.autoScore === false ? 'Score manual' : 'Score automatico');
    chips.push(`MOB ${cfg.defaultMesContemplacao || 18}`);
    return chips;
  }

  function renderSettingsStrip() {
    const main = one('.hm-main');
    const anchor = one('[data-home-settings-anchor]') || one('.hm-kpi-bar');
    if (!main || !anchor) return;

    let strip = one('#home-settings-strip');
    if (!strip) {
      strip = document.createElement('section');
      strip.id = 'home-settings-strip';
      strip.className = 'bf-settings-strip';
      anchor.insertAdjacentElement('afterend', strip);
    }

    strip.hidden = true;
    strip.setAttribute('aria-hidden', 'true');

    const cfg = getSettingsConfig();
    const chips = describeHomeSettings(cfg);
    strip.innerHTML = `
      <div>
        <strong>Preferencias globais aplicadas</strong>
        <span>Home, prateleira e simulador usam os parametros salvos em Configuracoes.</span>
        <div class="bf-settings-chip-row">
          ${chips.map(chip => `<span class="bf-settings-chip">${escapeHTML(chip)}</span>`).join('')}
        </div>
      </div>
      <a class="btn btn--ghost btn--sm" href="configuracoes.html">Ajustar</a>
    `;
  }

  function bindProfilePreview() {
    const form = one('#home-profile-form');
    if (!form) return;

    const ids = ['homeIncome', 'homeExpenses', 'homeDebts', 'homeInvestments', 'homeReserveMonths', 'homeGoal'];
    ids.forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.addEventListener('input', renderProfilePreview);
    });
    renderProfilePreview();
  }

  function renderProfilePreview() {
    const renda = toNumber(one('#homeIncome')?.value);
    const despesas = toNumber(one('#homeExpenses')?.value);
    const dividas = toNumber(one('#homeDebts')?.value);
    const patrimonio = toNumber(one('#homeInvestments')?.value);
    const mesesReserva = Math.max(1, toNumber(one('#homeReserveMonths')?.value) || 6);
    const objetivo = one('#homeGoal')?.value || 'objetivo financeiro';

    const sobra = renda - despesas - dividas;
    const comprometimento = renda > 0 ? ((despesas + dividas) / renda) * 100 : 0;
    const reservaNecessaria = despesas * mesesReserva;
    const gapReserva = Math.max(0, reservaNecessaria - patrimonio);

    let score = 55;
    if (sobra > 0) score += 15;
    else score -= 18;
    if (comprometimento < 50) score += 14;
    else if (comprometimento < 70) score += 6;
    else if (comprometimento < 80) score -= 4;
    else score -= 14;
    if (gapReserva === 0) score += 12;
    else if (gapReserva < reservaNecessaria * 0.5) score += 3;
    else score -= 10;
    if (patrimonio > 0) score += 4;
    score = Math.max(0, Math.min(100, Math.round(score)));

    const ring = one('#homeScoreRing');
    if (ring) {
      ring.style.setProperty('--scoreDeg', `${score * 3.6}deg`);
      const color = score >= 75 ? '#1f7a5c' : (score >= 55 ? '#b58a2b' : '#a33b3b');
      ring.style.background = `conic-gradient(${color} ${score * 3.6}deg, #e7edf3 0)`;
    }

    setText('#homeScoreValue', number.format(score));
    setText('#homeDemoLeftover', money.format(sobra));
    setText('#homeDemoCommitment', `${comprometimento.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}%`);
    setText('#homeDemoReserve', money.format(reservaNecessaria));
    setText('#homeDemoReserveGap', money.format(gapReserva));

    let recommendation = `Seu objetivo "${objetivo}" pode avancar com comparacao de cenarios e memoria de calculo.`;
    if (renda <= 0) {
      recommendation = 'Informe uma renda valida para calcular diagnostico e capacidade segura.';
    } else if (sobra < 0 || comprometimento >= 80) {
      recommendation = 'Prioridade: reorganizar despesas e dividas antes de assumir novo credito.';
    } else if (gapReserva > 0) {
      recommendation = 'Prioridade: completar a reserva antes de aumentar risco ou parcelas.';
    } else if (comprometimento >= 70) {
      recommendation = 'Atencao: existe margem, mas o comprometimento pede comparacao cuidadosa.';
    } else {
      recommendation = 'Caminho saudavel: comparar investimentos, metas e credito com o mesmo perfil.';
    }
    setText('#homeDemoRecommendation', recommendation);
  }

  function compactCurrency(value) {
    const n = toNumber(value);
    if (n >= 1000000) return `R$ ${(n / 1000000).toLocaleString('pt-BR', { maximumFractionDigits: 1 })}M`;
    if (n >= 1000) return `R$ ${(n / 1000).toLocaleString('pt-BR', { maximumFractionDigits: 0 })}K`;
    return money.format(n);
  }

  function formatPct(value) {
    const n = toNumber(value);
    if (!Number.isFinite(n)) return 'Taxa n/d';
    return `${n.toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}% adm.`;
  }

  function normalizeGroup(group) {
    const carta = toNumber(group.valorCartaRef || group.valorCarta || group.cartaCredito || 0);
    const segmentoCodigo = toNumber(group.codigoSegmento || group.segmentoCodigo || group.codSegmento || 0);
    return {
      admin: group.nomeAdministradora || group.administradora || `Administradora ${group.cnpjRaiz || ''}`.trim(),
      codigoGrupo: group.codigoGrupo || group.grupo || 's/n',
      segmento: group.nomeSegmento || SEGMENTS[segmentoCodigo] || 'Segmento',
      valorCartaRef: carta,
      prazoMeses: toNumber(group.prazoMeses || group.prazo || 0),
      taxaAdmPct: toNumber(group.taxaAdmPct || group.taxaAdministracao || 0),
      codigoSegmento: segmentoCodigo
    };
  }

  function renderFeaturedGroups(groups) {
    const target = one('#home-featured-groups');
    if (!target) return;

    const cfg = getSettingsConfig();
    const preferred = cfg.defaultSegmento
      ? groups.filter(g => String(g.codigoSegmento) === String(cfg.defaultSegmento))
      : groups;
    const source = preferred.length ? preferred : groups;

    const cards = source
      .filter(g => g.valorCartaRef > 0)
      .sort((a, b) => b.valorCartaRef - a.valorCartaRef)
      .slice(0, 3);

    if (!cards.length) {
      target.innerHTML = '<div class="hm-empty-state">Base carregada, mas sem grupos validos para destaque.</div>';
      return;
    }

    target.innerHTML = cards.map((group) => `
      <a class="hm-live-item" href="simulador.html#step-4">
        <div>
          <strong>${escapeHTML(group.admin)} • Grupo ${escapeHTML(group.codigoGrupo)}</strong>
          <span>${escapeHTML(group.segmento)} • ${group.prazoMeses || 'n/d'} meses • ${formatPct(group.taxaAdmPct)}</span>
        </div>
        <b>${compactCurrency(group.valorCartaRef)}</b>
      </a>
    `).join('');
  }

  function renderSimulations() {
    const target = one('#home-recent-simulations');
    const storage = getStorageAPI();
    const list = (storage && typeof storage.listSimulations === 'function')
      ? storage.listSimulations()
      : [];
    const stats = (storage && typeof storage.getPortfolioStats === 'function')
      ? storage.getPortfolioStats()
      : { total: list.length, cartaTotal: 0 };

    setText('[data-home-kpi="saved"]', number.format(stats.total || list.length || 0));
    setText('[data-home-metric="portfolio"]', `${number.format(stats.total || list.length || 0)} simulações`);

    if (!target) return;

    if (!list.length) {
      target.innerHTML = `
        <div class="hm-empty-state">
          Nenhuma simulação salva ainda.
          <a href="simulador.html">Criar primeira simulação</a>
        </div>
      `;
      return;
    }

    target.innerHTML = list.slice(0, 3).map((sim) => `
      <a class="hm-live-item" href="carteira.html">
        <div>
          <strong>${escapeHTML(sim.nome || 'Simulação salva')}</strong>
          <span>${escapeHTML(sim.cliente || sim.consultor || 'Sem cliente informado')}</span>
        </div>
        <b>${compactCurrency(sim.totalCarta || 0)}</b>
      </a>
    `).join('');
  }

  function updateStatus(text, state) {
    const box = one('#home-live-status');
    const label = one('[data-home-status]');
    if (label) label.textContent = text;
    if (box) {
      box.classList.remove('is-loading', 'is-ready', 'is-error');
      box.classList.add(state || 'is-ready');
    }
  }

  async function loadCatalogStats() {
    try {
      updateStatus('Buscando grupos disponíveis...', 'is-loading');
      const response = await fetch(BASE_PATH, { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);

      const raw = await response.json();
      const groups = Array.isArray(raw) ? raw.map(normalizeGroup) : [];
      const valid = groups.filter(g => g.valorCartaRef > 0);
      const segments = new Set(valid.map(g => g.codigoSegmento).filter(Boolean));
      const maxCarta = valid.reduce((max, g) => Math.max(max, g.valorCartaRef), 0);

      setText('[data-home-kpi="groups"]', number.format(valid.length));
      setText('[data-home-kpi="segments"]', number.format(segments.size));
      setText('[data-home-kpi="maxCarta"]', compactCurrency(maxCarta));
      setText('[data-home-metric="base"]', `${number.format(valid.length)} grupos`);
      updateStatus(`${number.format(valid.length)} grupos disponíveis para simulação.`, 'is-ready');
      renderFeaturedGroups(valid);
    } catch (error) {
      console.warn('Home: nao foi possivel carregar base real', error);
      setText('[data-home-kpi="groups"]', '24');
      setText('[data-home-kpi="segments"]', '6');
      setText('[data-home-kpi="maxCarta"]', 'R$ 1,5M');
      setText('[data-home-metric="base"]', 'Opções de exemplo');
      updateStatus('Não foi possível atualizar os grupos agora. Exibindo opções de exemplo.', 'is-error');
      renderFeaturedGroups([]);
    }
  }

  function bindMobileMenu() {
    const nav = one('#hm-nav');
    all('#hm-nav a').forEach(link => {
      link.addEventListener('click', () => {
        if (nav) nav.classList.remove('open');
      });
    });
  }

  function escapeHTML(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  document.addEventListener('DOMContentLoaded', () => {
    if (typeof Settings !== 'undefined' && Settings.applyGlobal) Settings.applyGlobal();
    bindMobileMenu();
    bindProfilePreview();
    renderSettingsStrip();
    renderSimulations();
    const continuityModel = renderHomeContinuityCockpit();
    renderHomeContextualHero(continuityModel);
    loadCatalogStats();
  });

  window.addEventListener('bankfratern:settings-applied', () => {
    renderSettingsStrip();
    const continuityModel = renderHomeContinuityCockpit();
    renderHomeContextualHero(continuityModel);
  });

  window.BFHome = {
    renderContinuityCockpit: renderHomeContinuityCockpit,
    renderContextualHero: renderHomeContextualHero,
    buildContinuityModel,
    buildHeroContext: buildHomeHeroContext
  };
})();
