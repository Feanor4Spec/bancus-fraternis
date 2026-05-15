/**
 * ============================================
 * ConsórcioPro - Controlador Principal da UI
 * ============================================
 * Gerencia navegação por etapas, formulários,
 * máscaras, validações e orquestração geral.
 * ============================================
 */

const App = (() => {
  'use strict';

  // ─── Estado da Aplicação ───
  let currentStep = 1;
  const TOTAL_STEPS = 10;
  let resultado = null;
  let cenarios = null;
  let currentParams = null;
  let compResult = null; // V2: resultado da comparação
  // V3: Estado da Prateleira
  let shelfGroups = []; // grupos filtrados
  let selectedShelfGroup = null; // compatibilidade legada - não usado no v5
  let _viewingGroup = null; // grupo aberto no modal de detalhes
  // V5: Projeto Estruturado Multi-Seleção
  let projetoEstruturado = { itens: [] }; // carrinho de grupos selecionados

  // ─── Utilitários de Formatação ───
  const Format = {
    /** Formata número como moeda BRL */
    money(value) {
      if (value == null || isNaN(value)) return 'R$ 0,00';
      return value.toLocaleString('pt-BR', {
        style: 'currency', currency: 'BRL', minimumFractionDigits: 2
      });
    },
    /** Formata número com separador de milhar */
    number(value, decimals = 2) {
      if (value == null || isNaN(value)) return '0';
      return value.toLocaleString('pt-BR', {
        minimumFractionDigits: decimals, maximumFractionDigits: decimals
      });
    },
    /** Remove formatação monetária e retorna número */
    parseMoney(str) {
      if (!str) return 0;
      return parseFloat(String(str).replace(/[R$\s.]/g, '').replace(',', '.')) || 0;
    },
    /** Aplica máscara monetária a um input */
    applyMoneyMask(input) {
      input.addEventListener('input', function () {
        let val = this.value.replace(/\D/g, '');
        if (val === '') { this.value = ''; return; }
        val = (parseInt(val, 10) / 100).toFixed(2);
        this.value = parseFloat(val).toLocaleString('pt-BR', {
          minimumFractionDigits: 2, maximumFractionDigits: 2
        });
      });
    }
  };

  // ─── Navegação entre Etapas ───
  function goToStep(step, options = {}) {
    if (step < 1 || step > TOTAL_STEPS) return;
    // Validar etapa atual antes de avançar
    if (step > currentStep && !options.skipValidation) {
      const valid = validateCurrentStep();
      if (!valid) return;
    }
    // Se indo para etapa 7+ (Resultados) e ainda não calculou, calcular
    if (step >= 7 && !resultado && !options.skipAutoCalculate) {
      calcular();
      if (!resultado) return;
    }
    // Se é etapa 3 (Filtros), popular dropdowns
    if (step === 3) {
      populateShelfFilters();
      renderSimulatorObjectiveGuide();
    }
    // Se é etapa 4 (Prateleira), carregar grupos
    if (step === 4 && !options.skipAutoSearch) {
      buscarGrupos();
    }
    currentStep = step;
    renderSteps();
    renderActiveSection();
    renderSimulatorDecision();
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function nextStep() { goToStep(currentStep + 1); }
  function prevStep() { goToStep(currentStep - 1); }

  /** Atualiza visual do stepper (sidebar vertical) */
  function renderSteps() {
    // Support both old (stepper__step) and new (sim-stepper__step) class names
    const steps = document.querySelectorAll('.sim-stepper__step, .stepper__step');
    steps.forEach((el) => {
      const stepNum = parseInt(el.getAttribute('data-step'));
      // Remove all state classes (both naming conventions)
      el.classList.remove(
        'stepper__step--active', 'stepper__step--completed',
        'sim-stepper__step--active', 'sim-stepper__step--completed'
      );
      const prefix = el.classList.contains('sim-stepper__step') ? 'sim-stepper__step' : 'stepper__step';
      if (stepNum === currentStep) el.classList.add(prefix + '--active');
      else if (stepNum < currentStep) el.classList.add(prefix + '--completed');
    });
    // Old horizontal connectors (backwards compat)
    document.querySelectorAll('.stepper__connector').forEach((el, i) => {
      el.classList.toggle('stepper__connector--completed', i + 1 < currentStep);
    });
  }

  /** Mostra a seção ativa */
  function renderActiveSection() {
    document.querySelectorAll('.step-section').forEach((el) => {
      el.classList.remove('step-section--active');
    });
    const active = document.getElementById(`step-${currentStep}`);
    if (active) active.classList.add('step-section--active');
  }

  // ─── Coleta de Parâmetros do Formulário ───
  function getParams() {
    const v = (id) => {
      const el = document.getElementById(id);
      return el ? el.value : '';
    };
    const n = (id) => {
      const el = document.getElementById(id);
      if (!el) return 0;
      // Se tem máscara monetária, usar parseMoney
      if (el.dataset.money === 'true') return Format.parseMoney(el.value);
      return parseFloat(el.value) || 0;
    };
    const checked = (id) => {
      const el = document.getElementById(id);
      return el ? el.checked : false;
    };

    // Coletar adiantamentos dinâmicos
    const adiantamentos = [];
    document.querySelectorAll('.adiantamento-row').forEach(row => {
      const mes = parseInt(row.querySelector('.adiant-mes')?.value) || 0;
      const valor = Format.parseMoney(row.querySelector('.adiant-valor')?.value);
      const qtd = parseInt(row.querySelector('.adiant-qtd')?.value) || 1;
      const tipo = row.querySelector('.adiant-tipo')?.value || 'reduzir_saldo';
      if (mes > 0) {
        adiantamentos.push({ mes, valor, qtdParcelas: qtd, tipo });
      }
    });

    // Coletar inadimplências dinâmicas
    const inadimplencias = [];
    document.querySelectorAll('.inadimplencia-row').forEach(row => {
      const mesInicio = parseInt(row.querySelector('.inad-mes')?.value) || 0;
      const mesesAtraso = parseInt(row.querySelector('.inad-meses')?.value) || 1;
      const regularizar = row.querySelector('.inad-regularizar')?.checked || false;
      const mesReg = parseInt(row.querySelector('.inad-mes-reg')?.value) || 0;
      if (mesInicio > 0) {
        inadimplencias.push({
          mesInicio, mesesAtraso, regularizar,
          mesRegularizacao: regularizar ? mesReg : 0
        });
      }
    });

    // V5: Injetar métricas consolidadas do Projeto Estruturado
    // (Útil para evitar que a Etapa 6 quebre tentando achar "Prazo Total" que não está mais no DOM)
    let cValorCarta = 0, cPrazoTotal = 0, cTaxaAdm = 0, cFundoReserva = 0, cMesContemplacao = 0, cLanceProprio = 0, cLanceEmbutido = 0;

    if (projetoEstruturado.itens && projetoEstruturado.itens.length > 0) {
      const it = projetoEstruturado.itens[0]; // Referência simplificada
      cValorCarta = projetoEstruturado.itens.reduce((s, i) => s + i.valorCartaTotal, 0);
      cPrazoTotal = Math.max(...projetoEstruturado.itens.map(i => i.prazoMeses || 0));
      // Médias ponderadas no futuro; para compatibilidade legada, usa o primeiro item ou médias simples
      cTaxaAdm = it.taxaAdmPct;
      cFundoReserva = it.fundoReservaPct;
      cMesContemplacao = it.mesContemplacaoAlvo;
      cLanceProprio = it.lanceProprioPct;
      cLanceEmbutido = it.lanceEmbutidoPct;
    }

    return {
      nomeCliente: v('nomeCliente'),
      tipoBem: v('tipoBem'),
      administradora: v('administradora'),
      grupo: v('grupo'),
      cota: v('cota'),
      dataSimulacao: v('dataSimulacao'),
      consultor: v('consultor'),
      observacoes: v('observacoes'),

      // Se não encontrou no DOM, puxa do carrinho V5
      valorCarta: n('valorCarta') || cValorCarta,
      prazoTotal: n('prazoTotal') || cPrazoTotal,
      taxaAdm: n('taxaAdm') || cTaxaAdm,
      fundoReserva: n('fundoReserva') || cFundoReserva,
      seguro: n('seguro'),
      seguroTipo: v('seguroTipo'),
      tipoIndice: v('tipoIndice') || 'fixo',
      indiceReajuste: n('indiceReajuste') || numberSetting('defaultIndiceReajuste', 5),
      mesAdesao: n('mesAdesao') || 1,
      mesAniversario: n('mesAniversario') || 12,
      mesContemplacao: n('mesContemplacao') || cMesContemplacao || numberSetting('defaultMesContemplacao', 18),
      lanceProprio: n('lanceProprio') || cLanceProprio,
      lanceEmbutido: n('lanceEmbutido') || cLanceEmbutido,
      lanceFixo: n('lanceFixo'),

      usarFGTS: checked('usarFGTS'),
      valorFGTS: n('valorFGTS'),
      modalidadeLance: v('modalidadeLance'),
      parcelaReduzida: checked('parcelaReduzida'),
      percentualReducao: n('percentualReducao'),
      politicaSaldo: v('politicaSaldo') || getConfiguredPolicy(),
      adiantamentos,
      inadimplencias,
      multaAtraso: n('multaAtraso'),
      jurosAtraso: n('jurosAtraso')
    };
  }

  // ─── Validação ───
  let _settingsDefaultsApplied = false;

  function getAppSettings() {
    try {
      if (typeof Settings !== 'undefined' && Settings && typeof Settings.load === 'function') {
        return Settings.load();
      }
    } catch (e) {
      return {};
    }
    return {};
  }

  function numberSetting(key, fallback) {
    const cfg = getAppSettings();
    const n = Number(cfg[key]);
    return Number.isFinite(n) ? n : fallback;
  }

  function getConfiguredPolicy() {
    return getAppSettings().defaultPoliticaSaldo === 'carta_mais_custos' ? 'com_custos' : 'carta';
  }

  function getEffectiveLanceEmbutidoMax(group) {
    const cfgLimit = numberSetting('maxLanceEmbutido', 30);
    const groupLimit = Number(group && group.lanceEmbutidoMaxPct);
    const safeCfg = Number.isFinite(cfgLimit) && cfgLimit > 0 ? cfgLimit : 0;
    const safeGroup = Number.isFinite(groupLimit) && groupLimit > 0 ? groupLimit : 0;
    if (safeCfg && safeGroup) return Math.min(safeCfg, safeGroup);
    return safeCfg || safeGroup || 0;
  }

  function setSelectByValueOrText(select, value) {
    if (!select || !value) return true;
    const wanted = String(value).trim().toLowerCase();
    const match = Array.from(select.options).find((option) => {
      const optValue = String(option.value || '').trim().toLowerCase();
      const optText = String(option.textContent || '').trim().toLowerCase();
      return optValue === wanted || optText === wanted || optText.includes(wanted);
    });
    if (!match) return false;
    select.value = match.value;
    return true;
  }

  function setInputValue(id, value) {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null || value === '') return;
    el.value = value;
  }

  function escapeSettingsText(value) {
    return String(value == null ? '' : value)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  function renderSettingsStatus() {
    const anchor = document.getElementById('database-status-panel');
    if (!anchor || !anchor.parentNode) return;
    const cfg = getAppSettings();
    let panel = document.getElementById('settings-status-panel');
    if (!panel) {
      panel = document.createElement('section');
      panel.id = 'settings-status-panel';
      panel.className = 'settings-status-panel';
      anchor.insertAdjacentElement('afterend', panel);
    }
    const chips = [
      cfg.defaultSegmento ? `Segmento ${cfg.defaultSegmento}` : 'Todos os segmentos',
      cfg.defaultAdmin ? `Admin ${cfg.defaultAdmin}` : 'Todas as administradoras',
      `${cfg.pageSize || 20} grupos/pagina`,
      cfg.autoScore === false ? 'Score manual' : 'Score automatico',
      `Lance ate ${cfg.maxLanceEmbutido || 30}%`,
      `Reajuste ${cfg.defaultIndiceReajuste || 5}%`,
      `MOB ${cfg.defaultMesContemplacao || 18}`
    ];
    panel.innerHTML = `
      <div class="settings-status-panel__head">
        <div>
          <strong>Configuracoes globais aplicadas</strong>
          <p>Esta jornada esta usando as preferencias salvas em Configuracoes.</p>
        </div>
        <span class="settings-status-panel__badge">Fase 4</span>
      </div>
      <div class="bf-settings-chip-row">
        ${chips.map(chip => `<span class="bf-settings-chip">${escapeSettingsText(chip)}</span>`).join('')}
      </div>
    `;
    renderSimulatorDecision();
  }

  function getSimulatorDataStatus() {
    try {
      if (typeof getShelfDataStatus === 'function') return getShelfDataStatus();
    } catch (e) {
      return { loaded: false, error: e, source: 'Indisponível', count: 0 };
    }
    const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
    return {
      loaded: catalog.length > 0,
      error: null,
      source: catalog.length ? 'Catálogo local em memória' : 'Aguardando catálogo',
      count: catalog.length
    };
  }

  function getProjectDecisionSnapshot() {
    const itens = Array.isArray(projetoEstruturado.itens) ? projetoEstruturado.itens : [];
    const totalGrupos = itens.length;
    const totalCotas = itens.reduce((sum, item) => sum + (Number(item.quantidadeCotas) || 0), 0);
    const totalCarta = itens.reduce((sum, item) => sum + (Number(item.valorCartaTotal) || 0), 0);
    const segmentos = [...new Set(itens.map(item => item.nomeSegmento).filter(Boolean))];
    const resumo = resultado && resultado.resumo ? resultado.resumo : {};
    const cartaLiquida = Number(resumo.cartaLiquida || resumo.valorCarta || totalCarta || 0);
    const parcelaAtual = Number(resumo.parcelaTotalAtual || resumo.parcelaInicialTotal || 0);
    const lanceTotal = Number(resumo.lanceTotal || 0);
    const custoTotal = Number(resumo.custoTotal || resumo.valorTotalPlano || 0);
    const prazo = Number(resumo.prazoTotal || currentParams?.prazoTotal || 0);
    return { totalGrupos, totalCotas, totalCarta, segmentos, cartaLiquida, parcelaAtual, lanceTotal, custoTotal, prazo };
  }

  function getSavedSimulationCount() {
    try {
      return typeof Storage !== 'undefined' && Storage.loadSimulations ? Storage.loadSimulations().length : 0;
    } catch (e) {
      return 0;
    }
  }

  function formatSavedSimulationLabel(count) {
    const total = Number.isFinite(Number(count)) ? Number(count) : 0;
    return total === 1 ? '1 simulação salva' : `${Format.number(total, 0)} simulações salvas`;
  }

  function getDecisionContextSnapshot() {
    return window.BFSimulatorJourney && window.BFSimulatorJourney.getDecisionContextSnapshot
      ? window.BFSimulatorJourney.getDecisionContextSnapshot(window.BFDecisionContext)
      : {
        source: 'none',
        readinessScore: 0,
        profileSnapshot: {},
        prefill: {},
        readiness: { score: 0, complete: false, missing: [], message: 'Contexto financeiro nao carregado.' }
      };
  }

  function contextSourceLabel(context) {
    return window.BFSimulatorJourney && window.BFSimulatorJourney.contextSourceLabel
      ? window.BFSimulatorJourney.contextSourceLabel(context)
      : 'Sem origem';
  }

  function calculatorPageHref(slug) {
    return window.BFSimulatorJourney && window.BFSimulatorJourney.calculatorPageHref
      ? window.BFSimulatorJourney.calculatorPageHref(slug)
      : 'calculadoras.html';
  }

  function setIfBlankOrDefault(id, value, defaultValues = []) {
    if (value === undefined || value === null || value === '') return false;
    let el = document.getElementById(id);
    if (!el) return false;
    const current = String(el.value || '').trim();
    const allowedDefaults = defaultValues.map((item) => String(item));
    if (current && !allowedDefaults.includes(current)) return false;
    el.value = value;
    return true;
  }

  function inferObjetivoValue(text) {
    return window.BFSimulatorJourney && window.BFSimulatorJourney.inferObjetivoValue
      ? window.BFSimulatorJourney.inferObjetivoValue(text)
      : 'aquisicao';
  }

  function getSimulatorObjective() {
    const params = new URLSearchParams(window.location.search || '');
    const fieldValue = document.getElementById('clienteObjetivo')?.value || '';
    const urlValue = params.get('preset') || params.get('objetivo') || params.get('productId') || '';
    const sourceValue = document.body.dataset.simulatorObjectiveManual === 'true'
      ? fieldValue
      : (urlValue || fieldValue);
    if (window.BFSimulatorJourney && window.BFSimulatorJourney.normalizeObjective) {
      return window.BFSimulatorJourney.normalizeObjective(sourceValue);
    }
    return inferObjetivoValue(sourceValue);
  }

  function buildSimulatorObjectiveGuidance() {
    const context = getDecisionContextSnapshot();
    if (window.BFSimulatorJourney && window.BFSimulatorJourney.buildObjectiveGuidance) {
      return window.BFSimulatorJourney.buildObjectiveGuidance({
        objective: getSimulatorObjective(),
        context,
        filters: getShelfFilters()
      });
    }
    return null;
  }

  function renderSimulatorObjectiveGuide() {
    const target = document.querySelector('[data-simulator-objective-guide]');
    if (!target) return;
    const guide = buildSimulatorObjectiveGuidance();
    if (!guide) {
      target.innerHTML = '<div class="sim-objective-guide__empty">Defina o objetivo do cliente para receber uma sugestao de prateleira.</div>';
      return;
    }
    document.body.dataset.simulatorObjective = guide.objective || 'aquisicao';
    target.dataset.simulatorObjectiveGuide = guide.objective || 'aquisicao';
    target.innerHTML = `
      <article class="sim-objective-guide__card" data-simulator-objective-card="${escapeSettingsText(guide.objective)}">
        <div>
          <span class="sim-objective-guide__eyebrow">Jornada guiada por objetivo</span>
          <h3>${escapeSettingsText(guide.title)}</h3>
          <p>${escapeSettingsText(guide.body)}</p>
        </div>
        <div class="sim-objective-guide__facts">
          ${(guide.facts || []).map((fact) => `<span>${escapeSettingsText(fact)}</span>`).join('')}
        </div>
        <div class="sim-objective-guide__actions">
          <button class="btn btn--primary" type="button" data-simulator-objective-apply onclick="App.applySimulatorObjectiveGuide()">${escapeSettingsText(guide.actionLabel || 'Aplicar orientacao')}</button>
          <a class="btn btn--ghost" href="comparador.html?preset=${escapeSettingsText(guide.comparePreset || 'comprar_bem')}">Comparar alternativas</a>
        </div>
        <small>${escapeSettingsText(guide.nextStep || '')}</small>
      </article>
    `;
  }

  function applyGuideValue(id, value) {
    const el = document.getElementById(id);
    if (!el || value === undefined || value === null || value === '') return false;
    if (el.type === 'checkbox') {
      el.checked = value === true || value === 'true';
      return true;
    }
    if (el.tagName === 'SELECT') return setSelectByValueOrText(el, value);
    el.value = String(value);
    return true;
  }

  function applySimulatorObjectiveGuide() {
    const guide = buildSimulatorObjectiveGuidance();
    if (!guide) return;
    let applied = 0;
    Object.entries(guide.filters || {}).forEach(([id, value]) => {
      applied += applyGuideValue(id, value) ? 1 : 0;
    });
    const sortEl = document.getElementById('shelfSort');
    if (sortEl && guide.sortBy) sortEl.value = guide.sortBy;
    document.body.dataset.simulatorObjectiveGuideApplied = guide.objective || 'aquisicao';
    renderSimulatorObjectiveGuide();
    buscarGrupos();
    goToStep(4, { skipValidation: true, skipAutoSearch: true });
    showToast(`${applied} filtros aplicados para ${guide.label || 'objetivo do cliente'}.`, 'success');
  }

  function applyDecisionContextPrefill() {
    const params = new URLSearchParams(window.location.search || '');
    const from = params.get('from');
    if (!from || !window.BFDecisionContext) return null;
    const context = getDecisionContextSnapshot();
    const plan = window.BFSimulatorJourney && window.BFSimulatorJourney.buildPrefillPlan
      ? window.BFSimulatorJourney.buildPrefillPlan(context)
      : [];
    let applied = 0;

    plan.forEach((item) => {
      applied += setIfBlankOrDefault(item.id, item.value, item.defaults || []) ? 1 : 0;
    });

    if (applied > 0) {
      document.body.dataset.decisionContextApplied = context.source || from;
      if (typeof window.BFDecisionContext.recordEvent === 'function') {
        window.BFDecisionContext.recordEvent('simulation-prefill-applied', {
          source: context.source,
          calculatorSlug: context.calculatorSlug,
          historyId: context.historyId,
          applied
        });
      }
    }
    return context;
  }

  function renderSimulatorReadiness() {
    const target = document.querySelector('[data-simulator-readiness]');
    if (!target) return;
    const context = getDecisionContextSnapshot();
    const readiness = context.readiness || { score: context.readinessScore || 0, missing: [], complete: false };
    const profile = context.profileSnapshot || {};
    const recommended = window.BFDecisionContext && typeof window.BFDecisionContext.recommendedCalculators === 'function'
      ? window.BFDecisionContext.recommendedCalculators(profile)
      : ['custos-fixos'];
    const firstSlug = recommended[0] || 'custos-fixos';
    const missingText = (readiness.missing || []).map((item) => item.label).join(', ') || 'Perfil suficiente';
    const prefill = context.prefill || {};

    target.innerHTML = `
      <div class="bf-admin-panel-heading">
        <div>
          <span class="bf-badge bf-badge--gold">Prontidao para simular</span>
          <h2>${readiness.complete ? 'Contexto financeiro conectado' : 'Diagnostico recomendado antes da prateleira'}</h2>
        </div>
        <a class="btn btn--primary btn--sm" href="${calculatorPageHref(firstSlug)}">${readiness.complete ? 'Revisar contexto' : 'Completar diagnostico'}</a>
      </div>
      <div class="bf-platform-metrics">
        <article class="bf-platform-metric"><small>Score</small><strong>${Number(readiness.score || context.readinessScore || 0)}/100</strong></article>
        <article class="bf-platform-metric"><small>Origem</small><strong>${escapeSettingsText(contextSourceLabel(context))}</strong></article>
        <article class="bf-platform-metric"><small>Pendencias</small><strong>${escapeSettingsText(missingText)}</strong></article>
        <article class="bf-platform-metric"><small>Valor alvo</small><strong>${prefill.valorAlvo ? Format.money(prefill.valorAlvo) : '-'}</strong></article>
      </div>
      <p>${escapeSettingsText(readiness.message || 'Use renda, custos, reserva e capacidade para orientar a escolha de grupo.')}</p>
      <div class="bf-inline-actions">
        ${recommended.slice(0, 4).map((slug) => `<a class="btn btn--ghost btn--sm" href="${calculatorPageHref(slug)}">${escapeSettingsText(slug)}</a>`).join('')}
      </div>
    `;
  }

  function renderSimulatorDecision() {
    const target = document.querySelector('[data-simulator-decision-strip]');
    if (!target) return;
    const dataStatus = getSimulatorDataStatus();
    const project = getProjectDecisionSnapshot();
    const savedCount = getSavedSimulationCount();
    const hasCart = project.totalGrupos > 0;
    const hasResult = Boolean(resultado && resultado.resumo);
    const shelfCount = Array.isArray(shelfGroups) ? shelfGroups.length : 0;
    const decisionContext = getDecisionContextSnapshot();
    const readiness = decisionContext.readiness || { score: decisionContext.readinessScore || 0, complete: false, message: 'Complete o diagnostico financeiro.' };
    const recommended = window.BFDecisionContext && typeof window.BFDecisionContext.recommendedCalculators === 'function'
      ? window.BFDecisionContext.recommendedCalculators(decisionContext.profileSnapshot || {})
      : ['custos-fixos'];

    const decisionCards = [
      {
        tone: readiness.complete ? 'stable' : 'warning',
        eyebrow: 'Contexto',
        title: `${Number(readiness.score || 0)}/100 prontidao`,
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
          ? `${Format.number(dataStatus.count || 0, 0)} grupos disponíveis para filtros, score e comparação.`
          : dataStatus.error
            ? 'A jornada permanece segura, mas a prateleira deve ser revisada antes da proposta.'
            : 'A conexão local ainda está preparando a prateleira de grupos.',
        action: 'Conferir status da conexão'
      },
      {
        tone: hasCart ? 'stable' : shelfCount > 0 ? 'info' : 'warning',
        eyebrow: 'Prateleira',
        title: hasCart
          ? `${project.totalGrupos} grupo${project.totalGrupos === 1 ? '' : 's'} selecionado${project.totalGrupos === 1 ? '' : 's'}`
          : shelfCount > 0
            ? `${Format.number(shelfCount, 0)} grupos filtrados`
            : 'Selecionar grupo',
        body: hasCart
          ? `${project.totalCotas} cota${project.totalCotas === 1 ? '' : 's'} e ${Format.money(project.totalCarta)} em cartas no projeto.`
          : shelfCount > 0
            ? 'Escolha os grupos que devem entrar na sacola antes de avançar para parâmetros.'
            : 'Use os filtros para formar uma prateleira compatível com o perfil do cliente.',
        action: hasCart ? 'Validar parâmetros da sacola' : 'Ir para a prateleira'
      },
      {
        tone: hasResult ? 'stable' : hasCart ? 'info' : 'warning',
        eyebrow: 'Resultado',
        title: hasResult ? Format.money(project.cartaLiquida) : hasCart ? 'Calcular proposta' : 'Aguardando carrinho',
        body: hasResult
          ? `Parcela atual ${Format.money(project.parcelaAtual)}, lance ${Format.money(project.lanceTotal)} e prazo ${Format.number(project.prazo, 0)} meses.`
          : hasCart
            ? 'Com a sacola montada, avance até Resultados para gerar memória, cronograma e proposta.'
            : 'O resumo financeiro depende de pelo menos um grupo selecionado.',
        action: hasResult ? 'Revisar memória de cálculo' : 'Gerar resumo financeiro'
      },
      {
        tone: hasResult ? 'info' : savedCount > 0 ? 'stable' : 'warning',
        eyebrow: 'Continuidade',
        title: hasResult ? 'Salvar e acompanhar' : formatSavedSimulationLabel(savedCount),
        body: hasResult
          ? 'Salve o cenário para que a Carteira trate o lead como pipeline consultivo retomável.'
          : savedCount > 0
            ? 'Há simulações anteriores disponíveis para abrir, revisar e conectar à Carteira.'
            : 'Nenhum cenário salvo ainda. Finalize um cálculo para criar continuidade comercial.',
        action: hasResult ? 'Salvar cenário na Carteira' : 'Abrir simulações salvas'
      }
    ];
    const journeyActions = window.BFSimulatorJourney && window.BFSimulatorJourney.buildJourneyActions
      ? window.BFSimulatorJourney.buildJourneyActions({
        dataStatus,
        project,
        savedCount,
        shelfCount,
        decisionContext,
        readiness,
        hasCart,
        hasResult,
        recommendedCalculators: recommended
      })
      : [];
    const renderJourneyAction = (action) => {
      if (!action) return '';
      if (action.type === 'link') {
        return `<a class="btn btn--ghost btn--sm" href="${escapeSettingsText(action.href || '#')}">${escapeSettingsText(action.label || 'Abrir')}</a>`;
      }
      const onclick = action.action && action.action.startsWith('goToStep:')
        ? `App.goToStep(${parseInt(action.action.replace('goToStep:', ''), 10) || 1})`
        : `App.${action.action || 'buscarGrupos'}()`;
      return `<button class="btn btn--primary btn--sm" type="button" onclick="${onclick}">${escapeSettingsText(action.label || 'Executar')}</button>`;
    };

    target.innerHTML = `
      <div class="bf-v8-decision-strip__head">
        <span class="bf-badge bf-badge--gold">Decisão operacional</span>
        <div>
          <h2>Simulador em modo próximo passo.</h2>
          <p>O painel traduz base real, prateleira, sacola, cálculo e histórico salvo em uma leitura única para o consultor.</p>
        </div>
      </div>
      <div class="bf-v8-decision-strip__grid">
        ${decisionCards.map(card => `
          <article class="bf-v8-decision-card bf-v8-decision-card--${card.tone}">
            <span>${escapeSettingsText(card.eyebrow)}</span>
            <strong>${escapeSettingsText(card.title)}</strong>
            <p>${escapeSettingsText(card.body)}</p>
            <small>${escapeSettingsText(card.action)}</small>
          </article>
        `).join('')}
      </div>
      <div class="bf-inline-actions" data-simulator-journey-actions>
        ${journeyActions.map(renderJourneyAction).join('')}
      </div>
    `;
    renderSimulatorReadiness();
  }

  function applyConfiguredDefaults(options = {}) {
    const cfg = getAppSettings();

    if (typeof Settings !== 'undefined' && Settings.applyGlobal) Settings.applyGlobal(cfg);

    setInputValue('compIndiceReajuste', cfg.defaultIndiceReajuste);
    setInputValue('compMesContemplacao', cfg.defaultMesContemplacao);
    setInputValue('compLanceEmbutido', cfg.maxLanceEmbutido);
    const policy = document.getElementById('compPoliticaSaldo');
    if (policy) policy.value = getConfiguredPolicy();

    const sort = document.getElementById('shelfSort');
    if (sort && !_settingsDefaultsApplied) sort.value = cfg.autoScore === false ? 'menor_taxa' : 'maior_score';

    const pageSizeEl = document.getElementById('shelfPageSize');
    if (pageSizeEl && cfg.pageSize) pageSizeEl.value = String(cfg.pageSize);

    let filterReady = true;
    if (!_settingsDefaultsApplied || options.forceFilters) {
      const adminEl = document.getElementById('filtroAdministradora');
      const segmentoEl = document.getElementById('filtroProduto');
      if (adminEl && cfg.defaultAdmin) filterReady = setSelectByValueOrText(adminEl, cfg.defaultAdmin);
      if (segmentoEl && cfg.defaultSegmento) segmentoEl.value = String(cfg.defaultSegmento);
      if (!cfg.defaultAdmin) filterReady = true;
      if (filterReady) _settingsDefaultsApplied = true;
    }

    renderSettingsStatus();
  }

  function validateCurrentStep() {
    const errors = [];
    if (currentStep === 1) {
      // Dados do consultor - validação leve
    }
    if (currentStep === 2) {
      // Dados do cliente - validação leve
    }
    if (currentStep === 3) {
      // Filtros - sem validação obrigatória
    }
    if (currentStep === 4) {
      // V5: Prateleira - precisa ter pelo menos 1 grupo no projeto
      if (projetoEstruturado.itens.length === 0) {
        errors.push('Adicione pelo menos um grupo ao carrinho antes de avançar.');
      }
    }
    if (currentStep === 5) {
      if (projetoEstruturado.itens.length === 0) {
        errors.push('O carrinho está vazio. Volte e adicione um grupo.');
      } else {
        // Validação básica se os campos editáveis estão coerentes
        projetoEstruturado.itens.forEach(i => {
          const limiteEmbutido = getEffectiveLanceEmbutidoMax(i._group);
          if (i.valorCartaUnitario <= 0) errors.push(`Grupo ${i.codigoGrupo}: Valor da carta deve ser maior que zero.`);
          if (i.quantidadeCotas < 1) errors.push(`Grupo ${i.codigoGrupo}: Quantidade de cotas inválida.`);
          if (i.prazoMeses <= 0) errors.push(`Grupo ${i.codigoGrupo}: Prazo inválido.`);
          if (i.taxaAdmPct < 0 || i.fundoReservaPct < 0) errors.push(`Grupo ${i.codigoGrupo}: Taxas não podem ser negativas.`);
          if (i.mesContemplacaoAlvo < 1 || i.mesContemplacaoAlvo > (i.prazoMeses || 100)) {
            errors.push(`Grupo ${i.codigoGrupo}: Mês de contemplação (${i.mesContemplacaoAlvo}) inválido.`);
          }
          if (limiteEmbutido > 0 && i.lanceEmbutidoPct > limiteEmbutido) {
            errors.push(`Grupo ${i.codigoGrupo}: Lance embutido acima do limite de ${limiteEmbutido.toFixed(1)}%.`);
          }
        });
      }
    }
    if (currentStep === 6) {
      const p = getParams();
      p.adiantamentos.forEach((a, i) => {
        if (a.mes > p.prazoTotal) errors.push(`Adiantamento ${i + 1}: mês excede o prazo total.`);
      });
      p.inadimplencias.forEach((ind, i) => {
        if (ind.mesInicio > p.prazoTotal) errors.push(`Inadimplência ${i + 1}: mês de início excede o prazo.`);
        if (ind.regularizar && ind.mesRegularizacao <= ind.mesInicio + ind.mesesAtraso - 1)
          errors.push(`Inadimplência ${i + 1}: regularização deve ser posterior ao período de atraso.`);
      });
    }

    if (errors.length > 0) {
      showToast(errors.join('\n'), 'error');
      return false;
    }
    return true;
  }

  // ─── Motor de Cálculo ───
  function calcular() {
    const params = getParams();
    currentParams = params;
    const calculation = window.BFSimulatorResult && window.BFSimulatorResult.calculate
      ? window.BFSimulatorResult.calculate(params, { engine: ConsorcioEngine })
      : { ok: false, mensagens: ['Modulo de resultado indisponivel.'] };

    if (!calculation.ok) {
      showToast((calculation.mensagens || ['Nao foi possivel calcular a simulacao.']).join('\n'), 'error');
      resultado = null;
      cenarios = null;
      return;
    }

    resultado = calculation.resultado;
    cenarios = calculation.cenarios;
    renderResultados();
    renderTabela();
    renderProposta();
    renderSimulatorDecision();
    showToast('Simulação calculada com sucesso!', 'success');
  }

  // ─── Renderização dos Resultados (Etapa 4) ───
  function renderResultados() {
    if (!resultado) return;
    const container = document.getElementById('proposal-summary-container');
    if (!container) return;

    if (window.BFSimulatorResult && window.BFSimulatorResult.renderSummary) {
      window.BFSimulatorResult.renderSummary(container, {
        params: currentParams,
        resultado,
        cenarios,
        project: projetoEstruturado,
        decisionContext: getDecisionContextSnapshot(),
        acceptance: getCurrentProposalAcceptance()
      }, {
        rootId: 'proposal-summary-print-root',
        chartPrefix: 'proposal-summary',
        surface: 'summary'
      });
      return;
    }

    container.innerHTML = `
      <div class="card text-center" style="padding:48px 24px;">
        <h3>Resumo indisponível</h3>
        <p class="text-muted">O módulo de proposta estruturada não foi carregado.</p>
      </div>
    `;
  }

  // ─── Renderização da Tabela Analítica (Etapa 5) ───
  function renderTabela() {
    if (!resultado) return;
    if (window.BFSimulatorResult && window.BFSimulatorResult.renderAnalyticalTable) {
      window.BFSimulatorResult.renderAnalyticalTable(document, { resultado }, { formatMoney: Format.money });
      return;
    }
    const tbody = document.getElementById('tabela-body');
    if (!tbody) return;

    const cron = resultado.cronograma;
    const showDetailed = document.getElementById('tabelaDetalhada')?.checked;
    const displayVal = showDetailed ? '' : 'none';

    // Toggle header detail columns
    document.querySelectorAll('.col-detail').forEach(el => el.style.display = displayVal);

    tbody.innerHTML = cron.map(m => {
      const badgeClass = getBadgeClass(m.evento);
      const detailedCols = `
        <td class="text-right col-detail-cell" style="display:${displayVal}">${Format.money(m.saldoAnterior)}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${m.indiceAplicado > 0 ? (m.indiceAplicado * 100).toFixed(2) + '%' : '—'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${Format.money(m.saldoAjustado)}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${m.valorLance > 0 ? Format.money(m.valorLance) : '—'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${m.valorAdiantado > 0 ? Format.money(m.valorAdiantado) : '—'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${m.multa > 0 ? Format.money(m.multa) : '—'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${m.juros > 0 ? Format.money(m.juros) : '—'}</td>
        <td class="text-right col-detail-cell" style="display:${displayVal}">${Format.money(m.saldoFinal)}</td>
        <td class="text-center col-detail-cell" style="display:${displayVal}">${m.prazoRestante}</td>
      `;

      return `<tr>
        <td class="text-center">${m.mes}</td>
        <td class="text-right">${Format.money(m.parcelaTotal)}</td>
        ${detailedCols}
        <td class="text-center"><span class="badge ${badgeClass}">${m.evento}</span></td>
      </tr>`;
    }).join('');
  }

  function getBadgeClass(evento) {
    if (evento.includes('adesão')) return 'badge--adesao';
    if (evento.includes('aniversário')) return 'badge--aniversario';
    if (evento.includes('contemplação')) return 'badge--contemplacao';
    if (evento.includes('adiantamento')) return 'badge--adiantamento';
    if (evento.includes('inadimplência')) return 'badge--inadimplencia';
    if (evento.includes('regularização')) return 'badge--adesao';
    return 'badge--normal';
  }

  function defaultProposalBuilderConfig() {
    return window.BFProposalBuilder && window.BFProposalBuilder.defaultConfig
      ? window.BFProposalBuilder.defaultConfig()
      : {};
  }

  function normalizeProposalBuilderConfig(value) {
    return window.BFProposalBuilder && window.BFProposalBuilder.normalizeConfig
      ? window.BFProposalBuilder.normalizeConfig(value)
      : defaultProposalBuilderConfig();
  }

  function getProposalBuilderConfig() {
    return window.BFProposalBuilder && window.BFProposalBuilder.getConfig
      ? window.BFProposalBuilder.getConfig(localStorage)
      : normalizeProposalBuilderConfig(null);
  }

  function saveProposalBuilderConfig(config) {
    return window.BFProposalBuilder && window.BFProposalBuilder.saveConfig
      ? window.BFProposalBuilder.saveConfig(config, localStorage)
      : normalizeProposalBuilderConfig(config);
  }

  function proposalBuilderOptionGroups() {
    return window.BFProposalBuilder && window.BFProposalBuilder.optionGroups
      ? window.BFProposalBuilder.optionGroups()
      : [];
  }

  function proposalBuilderPresetConfig(preset) {
    return window.BFProposalBuilder && window.BFProposalBuilder.presetConfig
      ? window.BFProposalBuilder.presetConfig(preset)
      : defaultProposalBuilderConfig();
  }

  function countEnabledFlags(group) {
    return window.BFProposalBuilder && window.BFProposalBuilder.countEnabledFlags
      ? window.BFProposalBuilder.countEnabledFlags(group)
      : Object.values(group || {}).filter(Boolean).length;
  }

  function proposalBuilderPageEstimate(config) {
    return window.BFProposalBuilder && window.BFProposalBuilder.pageEstimate
      ? window.BFProposalBuilder.pageEstimate(config)
      : 1;
  }

  function proposalBuilderReadinessIssues(config) {
    return window.BFProposalBuilder && window.BFProposalBuilder.readinessIssues
      ? window.BFProposalBuilder.readinessIssues(config)
      : [];
  }

  function proposalBuilderFocusLabel(config) {
    return window.BFProposalBuilder && window.BFProposalBuilder.focusLabel
      ? window.BFProposalBuilder.focusLabel(config)
      : 'Completa';
  }

  function syncProposalBuilderDependencies(config, group, key, checked) {
    if (window.BFProposalBuilder && window.BFProposalBuilder.syncDependencies) {
      window.BFProposalBuilder.syncDependencies(config, group, key, checked);
    }
  }

  function renderProposalBuilderOption(groupKey, option, config) {
    const checked = config[groupKey] && config[groupKey][option.key] !== false;
    return `
      <label class="proposal-builder-option ${checked ? 'proposal-builder-option--selected' : ''}" data-proposal-builder-option="${groupKey}.${option.key}">
        <input type="checkbox" ${checked ? 'checked' : ''} onchange="App.toggleProposalBuilderOption('${groupKey}', '${option.key}', this.checked)">
        <span>
          <strong>${escapeSettingsText(option.label)}</strong>
          <small>${escapeSettingsText(option.help)}</small>
        </span>
      </label>
    `;
  }

  function renderProposalBuilderGroup(group, config) {
    const selected = countEnabledFlags(config[group.key]);
    return `
      <article class="proposal-builder-group proposal-builder-group--${group.key}">
        <div class="proposal-builder-group__head">
          <div>
            <strong>${escapeSettingsText(group.title)}</strong>
            <p>${escapeSettingsText(group.description)}</p>
          </div>
          <span>${selected}/${group.options.length}</span>
          <div class="proposal-builder-group__actions">
            <button type="button" onclick="App.setProposalBuilderGroup('${group.key}', true)">Tudo</button>
            <button type="button" onclick="App.setProposalBuilderGroup('${group.key}', false)">Limpar</button>
          </div>
        </div>
        <div class="proposal-builder-options">
          ${group.options.map(option => renderProposalBuilderOption(group.key, option, config)).join('')}
        </div>
      </article>
    `;
  }

  function renderProposalBuilderReadiness(config) {
    const issues = proposalBuilderReadinessIssues(config);
    const pages = proposalBuilderPageEstimate(config);
    const statusLabel = issues.length ? 'Revisar' : 'Pronta';
    const issueList = issues.length
      ? `<ul>${issues.map(issue => `<li>${escapeSettingsText(issue)}</li>`).join('')}</ul>`
      : '<p>Selecao coerente para preview, impressao e PDF final.</p>';

    return `
      <div class="proposal-builder-readiness proposal-builder-readiness--${issues.length ? 'warning' : 'ok'}" data-proposal-builder-readiness>
        <article>
          <span>Status</span>
          <strong>${statusLabel}</strong>
          <small>${pages} pagina(s) estimada(s)</small>
        </article>
        <article>
          <span>Foco</span>
          <strong>${escapeSettingsText(proposalBuilderFocusLabel(config))}</strong>
          <small>${countEnabledFlags(config.sections)} blocos ativos</small>
        </article>
        <div>
          <strong>Controle antes do PDF</strong>
          ${issueList}
        </div>
      </div>
    `;
  }

  function renderProposalBuilderBoard() {
    const board = document.getElementById('proposal-builder-board');
    if (!board) return;

    if (!resultado || !currentParams) {
      board.innerHTML = '<div class="proposal-builder-board__empty">Calcule a simulacao para montar a lousa de exportacao da proposta.</div>';
      return;
    }

    const config = getProposalBuilderConfig();
    const groups = proposalBuilderOptionGroups();
    const selectedSections = countEnabledFlags(config.sections);
    const selectedCharts = countEnabledFlags(config.charts);
    const selectedConcepts = countEnabledFlags(config.concepts);
    const selectedFormulas = countEnabledFlags(config.formulas);

    board.innerHTML = `
      <div class="proposal-builder-head">
        <div>
          <span class="proposal-builder-eyebrow">Lousa de exportacao</span>
          <h3>Monte a proposta final do cliente</h3>
          <p>O consultor escolhe os blocos, graficos, conceitos e formulas. O preview abaixo e o PDF exportado respeitam esta selecao.</p>
        </div>
        <div class="proposal-builder-presets">
          <button class="btn btn--sm btn--primary" type="button" onclick="App.applyProposalBuilderPreset('completa')">Completa</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.applyProposalBuilderPreset('consultiva')">Consultiva</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.applyProposalBuilderPreset('executiva')">Executiva</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.applyProposalBuilderPreset('educativa')">Educativa</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.applyProposalBuilderPreset('tecnica')">Tecnica</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.applyProposalBuilderPreset('compacta')">Compacta</button>
          <button class="btn btn--sm btn--ghost" type="button" onclick="App.setProposalBuilderAll(false)">Limpar</button>
        </div>
      </div>
      <div class="proposal-builder-scoreboard">
        <article><span>Blocos</span><strong>${selectedSections}</strong><small>de ${Object.keys(config.sections).length}</small></article>
        <article><span>Graficos</span><strong>${selectedCharts}</strong><small>de ${Object.keys(config.charts).length}</small></article>
        <article><span>Conceitos</span><strong>${selectedConcepts}</strong><small>de ${Object.keys(config.concepts).length}</small></article>
        <article><span>Formulas</span><strong>${selectedFormulas}</strong><small>de ${Object.keys(config.formulas).length}</small></article>
      </div>
      ${renderProposalBuilderReadiness(config)}
      <div class="proposal-builder-grid">
        ${groups.map(group => renderProposalBuilderGroup(group, config)).join('')}
      </div>
    `;
  }

  function toggleProposalBuilderOption(group, key, checked) {
    const config = getProposalBuilderConfig();
    if (!config[group] || typeof config[group][key] === 'undefined') return;
    config[group][key] = !!checked;
    syncProposalBuilderDependencies(config, group, key, checked);
    saveProposalBuilderConfig(config);
    renderProposta();
  }

  function setProposalBuilderGroup(group, checked) {
    const config = getProposalBuilderConfig();
    if (!config[group]) return;
    Object.keys(config[group]).forEach(key => {
      config[group][key] = !!checked;
      syncProposalBuilderDependencies(config, group, key, checked);
    });
    saveProposalBuilderConfig(config);
    renderProposta();
    showToast(`Lousa atualizada: ${checked ? 'todos' : 'nenhum'} em ${group}.`, 'success');
  }

  function setProposalBuilderAll(checked) {
    const config = getProposalBuilderConfig();
    ['sections', 'charts', 'concepts', 'formulas'].forEach(group => {
      Object.keys(config[group] || {}).forEach(key => { config[group][key] = !!checked; });
    });
    saveProposalBuilderConfig(config);
    renderProposta();
    showToast(checked ? 'Todos os itens da lousa foram selecionados.' : 'A lousa foi limpa para uma nova selecao.', checked ? 'success' : 'warning');
  }

  function applyProposalBuilderPreset(preset = 'completa') {
    const config = saveProposalBuilderConfig(proposalBuilderPresetConfig(preset));
    renderProposta();
    const label = preset === 'completa' ? 'completa' : preset;
    showToast(`Lousa de proposta aplicada: ${label}.`, 'success');
    return config;
  }

  // ─── Renderização da Proposta (Etapa 6) ───
  function renderProposta() {
    if (!resultado || !currentParams) return;
    const container = document.getElementById('proposta-container');
    if (!container) return;
    const acceptance = getCurrentProposalAcceptance();
    const builder = getProposalBuilderConfig();
    renderProposalBuilderBoard();
    renderProposalAcceptancePanel(acceptance);
    renderProposalVersionPanel(acceptance, builder);

    if (window.BFSimulatorResult && window.BFSimulatorResult.renderProposal) {
      window.BFSimulatorResult.renderProposal(container, {
        params: currentParams,
        resultado,
        cenarios,
        project: projetoEstruturado,
        decisionContext: getDecisionContextSnapshot(),
        acceptance,
        builder
      }, {
        rootId: 'proposal-export-root',
        chartPrefix: 'proposal-export',
        surface: 'proposal',
        builder
      }, { exportManager: ExportManager });
      return;
    }

    container.innerHTML = ExportManager.gerarHTMLProposta(currentParams, resultado);
  }

  function getCurrentProposalData() {
    if (!currentParams || !resultado || typeof ProposalSummary === 'undefined' || !ProposalSummary.mapSimulationToProposal) {
      return null;
    }
    return ProposalSummary.mapSimulationToProposal({
      params: currentParams,
      resultado,
      cenarios,
      project: projetoEstruturado,
      decisionContext: getDecisionContextSnapshot()
    });
  }

  function getCurrentProposalAcceptance() {
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalAcceptance === 'undefined') return null;
    return BFProposalAcceptance.latest(proposal.id) || BFProposalAcceptance.createDraft(proposal);
  }

  function getCurrentSimulationId() {
    try {
      const search = new URLSearchParams(window.location.search || '');
      return search.get('simulationId') || search.get('simulacaoId') || '';
    } catch (e) {
      return '';
    }
  }

  function getCurrentProposalVersionContext(acceptance = null, builder = null) {
    return {
      acceptance: acceptance || getCurrentProposalAcceptance(),
      builder: builder || getProposalBuilderConfig(),
      project: projetoEstruturado,
      params: currentParams,
      simulationId: getCurrentSimulationId(),
      cliente: currentParams ? currentParams.nomeCliente : '',
      consultor: currentParams ? currentParams.consultor : ''
    };
  }

  function proposalVersionMetricValue(key, value) {
    return window.BFProposalGovernance && window.BFProposalGovernance.versionMetricValue
      ? window.BFProposalGovernance.versionMetricValue(key, value, {
        formatMoney: Format.money,
        formatNumber: Format.number
      })
      : Format.money(value);
  }

  function proposalVersionBuilderLabel(builder) {
    return window.BFProposalGovernance && window.BFProposalGovernance.versionBuilderLabel
      ? window.BFProposalGovernance.versionBuilderLabel(builder)
      : '';
  }

  function renderProposalVersionComparison(comparison) {
    return window.BFProposalGovernance && window.BFProposalGovernance.renderVersionComparison
      ? window.BFProposalGovernance.renderVersionComparison(comparison, {
        formatMoney: Format.money,
        formatNumber: Format.number
      })
      : '';
  }

  function renderProposalVersionPanel(acceptance = null, builder = null) {
    const panel = document.getElementById('proposal-version-panel');
    if (!panel) return;
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalVersions === 'undefined') {
      panel.innerHTML = window.BFProposalGovernance && window.BFProposalGovernance.renderVersionEmpty
        ? window.BFProposalGovernance.renderVersionEmpty()
        : '<div class="proposal-version-panel__empty">Calcule a simulacao para salvar versoes e comparar mudancas da proposta.</div>';
      panel.dataset.proposalVersionStatus = 'empty';
      return;
    }

    const context = getCurrentProposalVersionContext(acceptance, builder);
    const currentSnapshot = BFProposalVersions.snapshot(proposal, context);
    const history = BFProposalVersions.history(proposal.id, 6);
    const latest = history[0] || null;
    const saved = !!(latest && latest.sourceHash === currentSnapshot.sourceHash);
    const comparison = history.length > 1 ? BFProposalVersions.compareRecords(history[1], history[0]) : null;
    const rendered = window.BFProposalGovernance && window.BFProposalGovernance.renderVersionPanel
      ? window.BFProposalGovernance.renderVersionPanel({
        proposal,
        currentSnapshot,
        history,
        latest,
        saved,
        comparison
      }, {
        formatMoney: Format.money,
        formatNumber: Format.number
      })
      : null;

    panel.dataset.proposalVersionStatus = rendered ? rendered.status : (saved ? 'saved' : 'pending');
    panel.dataset.proposalVersionCount = String(rendered ? rendered.count : history.length);
    panel.innerHTML = rendered ? rendered.html : renderProposalVersionComparison(comparison);
  }

  function salvarVersaoProposta(options = {}) {
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalVersions === 'undefined') {
      if (!options.silent) showToast('Calcule a simulacao antes de salvar uma versao.', 'error');
      return null;
    }
    const acceptance = options.acceptance || getCurrentProposalAcceptance();
    const builder = getProposalBuilderConfig();
    const record = BFProposalVersions.save(proposal, {
      ...getCurrentProposalVersionContext(acceptance, builder),
      forceNew: !!options.forceNew,
      label: options.label || ''
    });
    if (!record) {
      if (!options.silent) showToast('Nao foi possivel salvar a versao da proposta.', 'error');
      return null;
    }
    if (!options.skipRender) renderProposalVersionPanel(acceptance, builder);
    if (!options.silent) {
      showToast(record.unchanged ? 'A versao atual ja estava salva.' : `Versao ${record.version} da proposta salva.`, record.unchanged ? 'info' : 'success');
    }
    return record;
  }

  function limparVersoesProposta() {
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalVersions === 'undefined') return;
    if (!confirm('Limpar o historico versionado desta proposta?')) return;
    BFProposalVersions.clear(proposal.id);
    renderProposalVersionPanel();
    showToast('Versoes locais desta proposta foram limpas.', 'warning');
  }

  function proposalAcceptanceField(id) {
    const form = window.BFProposalGovernance && window.BFProposalGovernance.readAcceptanceForm
      ? window.BFProposalGovernance.readAcceptanceForm(document)
      : {};
    const fieldMap = {
      proposalReviewer: 'reviewer',
      proposalReviewerRole: 'reviewerRole',
      proposalValidUntil: 'validUntil',
      proposalReviewNotes: 'notes'
    };
    return form[fieldMap[id]] || '';
  }

  function proposalAcceptanceChecked(id) {
    const form = window.BFProposalGovernance && window.BFProposalGovernance.readAcceptanceForm
      ? window.BFProposalGovernance.readAcceptanceForm(document)
      : {};
    const fieldMap = {
      proposalCheckPremissas: 'premissas',
      proposalCheckCliente: 'cliente',
      proposalCheckDocumentacao: 'documentacao'
    };
    return !!(form.checklist && form.checklist[fieldMap[id]]);
  }

  function getProposalHandoff(proposalId) {
    if (!proposalId || typeof BFHandoffConsultivoService === 'undefined' || !BFHandoffConsultivoService.findByProposal) return null;
    return BFHandoffConsultivoService.findByProposal(proposalId);
  }

  function renderProposalAcceptancePanel(acceptance = null) {
    const panel = document.getElementById('proposal-acceptance-panel');
    if (!panel) return;
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalAcceptance === 'undefined') {
      panel.innerHTML = window.BFProposalGovernance && window.BFProposalGovernance.renderAcceptanceEmpty
        ? window.BFProposalGovernance.renderAcceptanceEmpty()
        : '<div class="proposal-acceptance-panel__empty">Calcule a simulacao para registrar revisao, validade e aceite local da proposta.</div>';
      return;
    }

    const current = acceptance || BFProposalAcceptance.latest(proposal.id) || BFProposalAcceptance.createDraft(proposal);
    const history = BFProposalAcceptance.history(proposal.id, 4);
    const handoff = getProposalHandoff(proposal.id);
    const rendered = window.BFProposalGovernance && window.BFProposalGovernance.renderAcceptancePanel
      ? window.BFProposalGovernance.renderAcceptancePanel({
        proposal,
        current,
        history,
        handoff
      })
      : null;

    panel.dataset.proposalAcceptanceStatus = rendered ? rendered.status : (current.status || 'pending');
    panel.dataset.proposalAcceptanceReady = rendered && rendered.ready ? 'true' : (current.status === 'reviewed' ? 'true' : 'false');
    panel.dataset.proposalHandoffReady = rendered && rendered.handoffReady ? 'true' : (handoff ? 'true' : 'false');
    panel.setAttribute('data-proposal-handoff-bridge', 'host');
    panel.innerHTML = rendered ? rendered.html : '';
  }

  function salvarRevisaoProposta() {
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalAcceptance === 'undefined') {
      showToast('Calcule a simulacao antes de registrar revisao.', 'error');
      return;
    }
    const form = window.BFProposalGovernance && window.BFProposalGovernance.readAcceptanceForm
      ? window.BFProposalGovernance.readAcceptanceForm(document)
      : {
        reviewer: proposalAcceptanceField('proposalReviewer'),
        reviewerRole: proposalAcceptanceField('proposalReviewerRole'),
        validUntil: proposalAcceptanceField('proposalValidUntil'),
        notes: proposalAcceptanceField('proposalReviewNotes'),
        checklist: {
          premissas: proposalAcceptanceChecked('proposalCheckPremissas'),
          cliente: proposalAcceptanceChecked('proposalCheckCliente'),
          documentacao: proposalAcceptanceChecked('proposalCheckDocumentacao')
        }
      };
    const record = BFProposalAcceptance.saveReview({
      proposal,
      reviewer: form.reviewer || proposal.consultor,
      reviewerRole: form.reviewerRole || 'Consultor responsavel',
      validUntil: form.validUntil,
      notes: form.notes,
      checklist: form.checklist
    });

    if (!record) {
      showToast('Nao foi possivel registrar a revisao local.', 'error');
      return;
    }

    salvarVersaoProposta({ silent: true, acceptance: record, forceNew: true, skipRender: true });
    renderResultados();
    renderProposta();
    showToast(`Revisao registrada: ${record.statusLabel}.`, 'success');
  }

  function limparRevisaoProposta() {
    const proposal = getCurrentProposalData();
    if (!proposal || typeof BFProposalAcceptance === 'undefined') return;
    BFProposalAcceptance.clear(proposal.id);
    renderResultados();
    renderProposta();
    showToast('Revisoes locais desta proposta foram limpas.', 'warning');
  }

  function criarHandoffProposta() {
    const proposal = getCurrentProposalData();
    const acceptance = getCurrentProposalAcceptance();
    if (!proposal || !acceptance) {
      showToast('Calcule a simulacao e registre a revisao antes de criar o handoff.', 'error');
      return null;
    }
    if (acceptance.status !== 'reviewed') {
      showToast('Conclua o checklist da revisao para liberar o handoff consultivo.', 'warning');
      return null;
    }
    if (typeof BFHandoffConsultivoService === 'undefined' || !BFHandoffConsultivoService.createFromProposal) {
      showToast('Servico de handoff consultivo indisponivel nesta pagina.', 'error');
      return null;
    }

    const proposalVersion = salvarVersaoProposta({ silent: true, acceptance, skipRender: true });
    if (!proposalVersion) {
      showToast('Nao foi possivel travar a versao atual antes do handoff.', 'error');
      return null;
    }

    const handoff = BFHandoffConsultivoService.createFromProposal(proposal, {
      ...acceptance,
      proposalVersion
    }, {
      ownerName: proposal.cliente || acceptance.reviewer || proposal.consultor || 'Cliente local',
      assignedTo: acceptance.reviewer || proposal.consultor || ''
    });
    renderProposalAcceptancePanel(acceptance);
    renderProposta();
    showToast(`Handoff ${handoff.id} salvo na fila consultiva local.`, 'success');
    return handoff;
  }

  // ─── Conceitos Educativos ───
  function renderConceitos() {
    const container = document.getElementById('conceitos-container');
    if (!container) return;

    container.innerHTML = ConceitosConsorcio.map(c => {
      const colorClass = `concept-card__icon--${c.cor === 'purple' ? 'purple' : c.cor}`;
      return `
        <div class="concept-card" id="conceito-${c.id}">
          <div class="concept-card__icon ${colorClass}">${c.icone}</div>
          <div class="concept-card__title">${c.titulo}</div>
          <div class="concept-card__desc">${c.descricao}</div>
          <div class="concept-card__formula">${c.formula.replace(/\n/g, '<br>')}</div>
          <div class="concept-card__example">
            <strong>Exemplo:</strong> ${c.exemplo}
          </div>
          ${c.observacao ? `<p style="font-size:12px;color:#6b7280;margin-top:8px;">${c.observacao}</p>` : ''}
        </div>
      `;
    }).join('');
  }

  // ─── Ações de Adiantamento Dinâmico ───
  function addAdiantamentoRow() {
    const container = document.getElementById('adiantamentos-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'adiantamento-row form-grid';
    row.style.marginBottom = '12px';
    row.style.padding = '12px';
    row.style.background = '#f9fafb';
    row.style.borderRadius = '8px';
    row.innerHTML = `
      <div class="form-group">
        <label class="form-label">Mês</label>
        <input type="number" class="form-input adiant-mes" min="1" placeholder="Ex: 24">
      </div>
      <div class="form-group">
        <label class="form-label">Valor (R$)</label>
        <input type="text" class="form-input adiant-valor" data-money="true" placeholder="10.000,00">
      </div>
      <div class="form-group">
        <label class="form-label">Parcelas</label>
        <input type="number" class="form-input adiant-qtd" min="1" value="1" placeholder="Qtd">
      </div>
      <div class="form-group">
        <label class="form-label">Estratégia</label>
        <select class="form-select adiant-tipo">
          <option value="reduzir_saldo">Reduzir saldo</option>
          <option value="reduzir_prazo">Reduzir prazo</option>
        </select>
      </div>
      <div class="form-group" style="justify-content:flex-end;">
        <button type="button" class="btn btn--sm btn--danger" onclick="this.closest('.adiantamento-row').remove()">✕ Remover</button>
      </div>
    `;
    container.appendChild(row);
    // Aplicar máscara no novo campo
    row.querySelectorAll('[data-money="true"]').forEach(Format.applyMoneyMask);
  }

  function addInadimplenciaRow() {
    const container = document.getElementById('inadimplencias-container');
    if (!container) return;
    const row = document.createElement('div');
    row.className = 'inadimplencia-row form-grid';
    row.style.marginBottom = '12px';
    row.style.padding = '12px';
    row.style.background = '#fef2f2';
    row.style.borderRadius = '8px';
    row.innerHTML = `
      <div class="form-group">
        <label class="form-label">Mês início</label>
        <input type="number" class="form-input inad-mes" min="1" placeholder="Ex: 5">
      </div>
      <div class="form-group">
        <label class="form-label">Meses atraso</label>
        <input type="number" class="form-input inad-meses" min="1" value="1" placeholder="Qtd">
      </div>
      <div class="form-group">
        <label class="form-label">
          <label class="form-switch" style="margin-top:4px;">
            <input type="checkbox" class="inad-regularizar">
            <span class="form-switch__track"></span>
            <span class="form-switch__label">Regularizar?</span>
          </label>
        </label>
      </div>
      <div class="form-group">
        <label class="form-label">Mês regularização</label>
        <input type="number" class="form-input inad-mes-reg" min="1" placeholder="Mês">
      </div>
      <div class="form-group" style="justify-content:flex-end;">
        <button type="button" class="btn btn--sm btn--danger" onclick="this.closest('.inadimplencia-row').remove()">✕ Remover</button>
      </div>
    `;
    container.appendChild(row);
  }

  // ─── Carregar Exemplo ───
  function carregarExemplo() {
    const d = DadosExemplo.padrao;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.value = val; };
    const setCheck = (id, val) => { const el = document.getElementById(id); if (el) el.checked = val; };

    // V3: Dados do Consultor (Step 1)
    set('consultor', d.consultor);
    set('consultorEmail', d.consultorEmail);
    set('consultorTelefone', d.consultorTelefone);
    set('consultorEmpresa', d.consultorEmpresa);
    set('consultorCodigo', d.consultorCodigo);
    set('dataSimulacao', d.dataSimulacao);

    // V3: Dados do Cliente (Step 2)
    set('nomeCliente', d.nomeCliente);
    set('clienteCpf', d.clienteCpf);
    set('clienteEmail', d.clienteEmail);
    set('clienteTelefone', d.clienteTelefone);
    set('clienteObjetivo', d.clienteObjetivo);
    set('observacoes', d.observacoes);

    // Hidden fields
    set('tipoBem', d.tipoBem);
    set('administradora', d.administradora);
    set('grupo', d.grupo);
    set('cota', d.cota);

    // Valor da carta com máscara
    const cartaEl = document.getElementById('valorCarta');
    if (cartaEl) cartaEl.value = Format.number(d.valorCarta);

    set('prazoTotal', d.prazoTotal);
    set('taxaAdm', d.taxaAdm);
    set('fundoReserva', d.fundoReserva);
    set('seguro', d.seguro);
    set('seguroTipo', d.seguroTipo);
    set('tipoIndice', d.tipoIndice);
    set('indiceReajuste', d.indiceReajuste);
    set('mesAdesao', d.mesAdesao);
    set('mesAniversario', d.mesAniversario);
    set('mesContemplacao', d.mesContemplacao);
    set('lanceProprio', d.lanceProprio);
    set('lanceEmbutido', d.lanceEmbutido);
    set('lanceFixo', d.lanceFixo);
    setCheck('usarFGTS', d.usarFGTS);
    set('valorFGTS', d.valorFGTS);
    set('modalidadeLance', d.modalidadeLance);
    setCheck('parcelaReduzida', d.parcelaReduzida);
    set('percentualReducao', d.percentualReducao);
    set('politicaSaldo', d.politicaSaldo);
    set('multaAtraso', d.multaAtraso);
    set('jurosAtraso', d.jurosAtraso);

    // Limpar adiantamentos e inadimplências
    document.getElementById('adiantamentos-container').innerHTML = '';
    document.getElementById('inadimplencias-container').innerHTML = '';

    toggleFGTSFields();
    toggleReducaoFields();

    // Mantem o exemplo funcional na jornada V7, onde carta/prazo vivem na sacola.
    if (!document.getElementById('valorCarta') && typeof ShelfEngine !== 'undefined' && ShelfEngine.createProjectItem) {
      const exemploGrupo = {
        idGrupo: 'EXEMPLO-ESTRUTURADO',
        groupKey: 'EXEMPLO-ESTRUTURADO',
        nomeAdministradora: d.administradora,
        administradora: d.administradora,
        codigoGrupo: d.grupo,
        codigoSegmento: d.tipoBem,
        nomeSegmento: d.tipoBem === 'imovel' ? 'Imóveis' : 'Consórcio',
        valorCartaRef: d.valorCarta,
        prazoMeses: d.prazoTotal,
        taxaAdmPct: d.taxaAdm,
        fundoReservaPct: d.fundoReserva,
        seguroPctComercial: d.seguroTipo === 'percentual' ? d.seguro : 0,
        indiceCorrecaoNome: d.tipoIndice || 'fixo',
        lanceEmbutidoMaxPct: Math.max(d.lanceEmbutido || 0, getEffectiveLanceEmbutidoMax({ lanceEmbutidoMaxPct: 30 }))
      };
      const item = ShelfEngine.createProjectItem(exemploGrupo, 1, d.valorCarta);
      item.mesContemplacaoAlvo = d.mesContemplacao;
      item.lanceProprioPct = d.lanceProprio;
      item.lanceEmbutidoPct = d.lanceEmbutido;
      item.fundoReservaPct = d.fundoReserva;
      projetoEstruturado.itens = [item];
      renderGruposSelecionados();
      renderStep5Cart();
      recalcularProjeto();
    }

    renderSimulatorDecision();
    document.body.dataset.simulatorObjectiveManual = 'true';
    renderSimulatorObjectiveGuide();
    showToast('Dados de exemplo carregados!', 'success');
  }

  // ─── Resetar Simulação ───
  function resetar() {
    if (!confirm('Tem certeza que deseja resetar toda a simulação?')) return;
    document.querySelectorAll('.form-input, .form-textarea').forEach(el => el.value = '');
    document.querySelectorAll('.form-select').forEach(el => el.selectedIndex = 0);
    document.querySelectorAll('input[type="checkbox"]').forEach(el => el.checked = false);
    document.getElementById('adiantamentos-container').innerHTML = '';
    document.getElementById('inadimplencias-container').innerHTML = '';
    resultado = null;
    cenarios = null;
    currentParams = null;
    ChartManager.destroyAll();
    const kpi = document.getElementById('kpi-container');
    if (kpi) kpi.innerHTML = '<p class="text-muted" style="grid-column:1/-1;text-align:center;padding:40px;">Calcule a simulação para ver os resultados.</p>';
    const tbody = document.getElementById('tabela-body');
    if (tbody) tbody.innerHTML = '';
    const prop = document.getElementById('proposta-container');
    if (prop) prop.innerHTML = '';
    renderProposalBuilderBoard();
    renderProposalAcceptancePanel();
    renderProposalVersionPanel();
    delete document.body.dataset.simulatorObjectiveManual;
    delete document.body.dataset.simulatorObjectiveGuideApplied;
    renderSimulatorObjectiveGuide();
    goToStep(1);
    renderSimulatorDecision();
    showToast('Simulação resetada.', 'warning');
  }

  // ─── Toggle Campos Condicionais ───
  function toggleFGTSFields() {
    const container = document.getElementById('fgts-fields');
    const checked = document.getElementById('usarFGTS')?.checked;
    if (container) container.style.display = checked ? 'block' : 'none';
  }

  function toggleReducaoFields() {
    const container = document.getElementById('reducao-fields');
    const checked = document.getElementById('parcelaReduzida')?.checked;
    if (container) container.style.display = checked ? 'block' : 'none';
  }

  // ─── Toast / Notificações ───
  function showToast(message, type = 'info') {
    const container = document.getElementById('toast-container');
    if (!container) return;
    const toast = document.createElement('div');
    toast.className = `toast toast--${type}`;
    toast.textContent = message;
    container.appendChild(toast);
    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }

  // ─── Collapsible / Accordion ───
  function initCollapsibles() {
    document.querySelectorAll('.collapsible__trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const parent = trigger.closest('.collapsible');
        parent.classList.toggle('collapsible--open');
      });
    });
  }

  // ─── Exportar Proposta ───
  async function exportarPDF() {
    if (!resultado || !currentParams) {
      showToast('Calcule a simulação antes de exportar.', 'error');
      return;
    }
    showToast('Gerando PDF...', 'info');
    salvarVersaoProposta({ silent: true });
    renderResultados();
    renderProposta();
    await new Promise(resolve => setTimeout(resolve, 120));
    const exportRoot = document.querySelector('#proposal-export-root') || document.querySelector('#proposal-summary-print-root');
    const ok = exportRoot
      ? await ExportManager.exportarPDFDaTela(exportRoot)
      : await ExportManager.exportarPDF(currentParams, resultado);
    if (ok !== false) showToast('PDF preparado com a proposta estruturada.', 'success');
  }

  function imprimirProposta() {
    if (!resultado || !currentParams) {
      showToast('Calcule a simulação antes de imprimir.', 'error');
      return;
    }
    salvarVersaoProposta({ silent: true });
    renderResultados();
    renderProposta();
    window.setTimeout(() => ExportManager.imprimirProposta(currentParams, resultado), 120);
  }

  // ─── Inicialização ───
  function init() {
    // Renderizar conceitos
    renderConceitos();
    renderProposalBuilderBoard();
    renderProposalAcceptancePanel();
    renderProposalVersionPanel();

    // Aplicar máscaras monetárias
    document.querySelectorAll('[data-money="true"]').forEach(Format.applyMoneyMask);

    // Inicializar collapsibles
    initCollapsibles();

    // Configurar stepper clicável
    document.querySelectorAll('.stepper__step').forEach((step, i) => {
      step.addEventListener('click', () => goToStep(i + 1));
    });

    // Toggle FGTS
    document.getElementById('usarFGTS')?.addEventListener('change', toggleFGTSFields);
    document.getElementById('parcelaReduzida')?.addEventListener('change', toggleReducaoFields);
    document.getElementById('clienteObjetivo')?.addEventListener('change', () => {
      document.body.dataset.simulatorObjectiveManual = 'true';
      renderSimulatorObjectiveGuide();
    });

    // Toggle tabela detalhada
    document.getElementById('tabelaDetalhada')?.addEventListener('change', () => {
      renderTabela();
    });

    // Definir data atual
    const dataEl = document.getElementById('dataSimulacao');
    if (dataEl && !dataEl.value) {
      dataEl.value = new Date().toISOString().split('T')[0];
    }

    applyConfiguredDefaults();
    applyDecisionContextPrefill();
    renderSimulatorObjectiveGuide();

    // Renderizar etapa inicial
    renderSteps();
    renderActiveSection();
    toggleFGTSFields();
    toggleReducaoFields();
    syncShelfControls();
    renderSimulatorDecision();

    console.log('ConsórcioPro V7 inicializado com sucesso');

    // V2: Popular selects de grupos
    populateGroupSelects();

    // V7: Popular filtros da prateleira (caso ShelfCatalog já esteja pronto)
    if (typeof ShelfCatalog !== 'undefined' && ShelfCatalog.length > 0) {
      populateShelfFilters();
    }

    carregarSimulacaoDaUrl();
  }

  // ═══════════════════════════════════
  // V2 — Comparador de Grupos
  // ═══════════════════════════════════

  /** V7: Popula os selects de grupos com dados do carrinho ou prateleira. */
  function populateGroupSelects() {
    const selectA = document.getElementById('compGrupoA');
    const selectB = document.getElementById('compGrupoB');
    if (!selectA || !selectB) return;

    // Prioridade: grupos do carrinho > últimos filtrados na prateleira > GruposComparacao fallback
    let sourceGroups = [];
    let sourceLabel = '';

    if (projetoEstruturado.itens.length >= 2) {
      sourceGroups = projetoEstruturado.itens.map(item => item._group);
      sourceLabel = 'Carrinho';
    } else if (shelfGroups.length > 0) {
      sourceGroups = shelfGroups.slice(0, 50); // max 50 para select
      sourceLabel = 'Prateleira';
    } else if (typeof GruposComparacao !== 'undefined' && GruposComparacao.length > 0) {
      // Fallback legado
      const options = GruposComparacao.map((g, i) => {
        const label = `${g.plano} — ${Format.money(g.valorCarta)} — ${g.prazoMeses}m`;
        return `<option value="legacy-${i}">${label}</option>`;
      }).join('');
      selectA.innerHTML = '<option value="">— Selecione o Grupo A —</option>' + options;
      selectB.innerHTML = '<option value="">— Selecione o Grupo B —</option>' + options;
      if (GruposComparacao.length >= 2) { selectA.value = 'legacy-0'; selectB.value = 'legacy-1'; }
      return;
    }

    if (sourceGroups.length === 0) return;

    const options = sourceGroups.map((g, i) => {
      const classStr = (g.classificacaoExecutiva || '').charAt(0) || '?';
      const label = `[${classStr}] ${g.nomeAdministradora || 'Admin'} — Grp ${g.codigoGrupo} — ${g.iconSegmento || ''} ${Format.money(g.valorCartaRef)} — ${g.prazoMeses}m`;
      return `<option value="${i}">${label}</option>`;
    }).join('');

    selectA.innerHTML = `<option value="">— Selecione (${sourceLabel}) —</option>` + options;
    selectB.innerHTML = `<option value="">— Selecione (${sourceLabel}) —</option>` + options;

    if (sourceGroups.length >= 2) { selectA.value = '0'; selectB.value = '1'; }
  }

  /** Callback quando usuário troca grupo nos selects. */
  function onCompGrupoChange() {
    // Poderia auto-comparar, mas esperamos o clique em "Comparar Agora"
  }

  /** Coleta o cenário de comparação do formulário. */
  function getCompScenario() {
    return {
      saldoInicialMode: document.getElementById('compPoliticaSaldo')?.value || 'carta',
      indiceReajustePct: parseFloat(document.getElementById('compIndiceReajuste')?.value) || 5,
      mesContemplacao: parseInt(document.getElementById('compMesContemplacao')?.value) || 18,
      lanceProprioPct: parseFloat(document.getElementById('compLanceProprio')?.value) || 0,
      lanceEmbutidoPct: parseFloat(document.getElementById('compLanceEmbutido')?.value) || 0,
      usarFgts: false,
      valorFgts: 0,
      parcelaReduzida: document.getElementById('compParcelaReduzida')?.checked || false,
      percentualReducao: 30,
      adiantamentoMes: 0,
      adiantamentoValor: 0,
      adiantamentoModo: 'reduzir_saldo',
      inadimplenciaMes: 0,
      mesesAtraso: 0,
      multaPct: 2,
      jurosPct: 1
    };
  }

  /** V7: Resolve o grupo selecionado no comparador. */
  function _resolveCompGroup(selectValue) {
    if (!selectValue || selectValue === '') return null;

    // Legado: GruposComparacao
    if (selectValue.startsWith('legacy-')) {
      const idx = parseInt(selectValue.replace('legacy-', ''));
      return (typeof GruposComparacao !== 'undefined') ? GruposComparacao[idx] : null;
    }

    // V7: Grupos do carrinho ou prateleira
    const idx = parseInt(selectValue);
    let sourceGroups = [];
    if (projetoEstruturado.itens.length >= 2) {
      sourceGroups = projetoEstruturado.itens.map(item => item._group);
    } else if (shelfGroups.length > 0) {
      sourceGroups = shelfGroups.slice(0, 50);
    }
    const g = sourceGroups[idx];
    if (!g) return null;

    // Adaptar formato shelf → formato Comparator
    return {
      plano: `${g.nomeAdministradora || 'Admin'} — Grp ${g.codigoGrupo}`,
      valorCarta: g.valorCartaRef,
      prazoMeses: g.prazoMeses,
      taxaAdmTotalPct: g.taxaAdmPct,
      fundoReservaPct: g.fundoReservaPct || 2,
      seguroPct: g.seguroPctComercial || 0,
      indiceReajuste: g.indiceCorrecaoNome || 'fixo',
      mesAniversario: 12,
      lanceEmbutidoMaxPct: getEffectiveLanceEmbutidoMax(g),
      lanceFixoPct: g.lanceFixoPct || 0,
      parcelaReduzidaDisponivel: g.parcelaReduzidaDisponivel || false,
      reducaoMaxParcelaPct: g.reducaoMaxParcelaPct || 0,
      tipoBem: g.macroCategoria || 'imovel',
      administradora: g.nomeAdministradora,
      codigoGrupo: g.codigoGrupo,
      observacao: '',
      // V7: dados heurísticos para narrativa
      _heuristica: g._heuristica,
      _classificacao: g._classificacao,
      _papel: g._papel
    };
  }

  /** V7: Executa a comparação entre os dois grupos selecionados. */
  function executarComparacao() {
    const valA = document.getElementById('compGrupoA')?.value;
    const valB = document.getElementById('compGrupoB')?.value;

    if (!valA || valA === '' || !valB || valB === '') {
      showToast('Selecione os dois grupos para comparar.', 'error');
      return;
    }
    if (valA === valB) {
      showToast('Selecione dois grupos diferentes.', 'error');
      return;
    }

    const groupA = _resolveCompGroup(valA);
    const groupB = _resolveCompGroup(valB);

    if (!groupA || !groupB) {
      showToast('Erro ao resolver grupos. Tente novamente.', 'error');
      return;
    }

    const scenario = getCompScenario();
    compResult = Comparator.compareGroups(groupA, groupB, scenario);

    if (compResult.erro) {
      showToast(`Erro na simulação do Grupo ${compResult.grupo}: ${compResult.mensagens.join(', ')}`, 'error');
      return;
    }

    renderCompCards(compResult);
    renderCompWinners(compResult);
    renderCompNarrativa(compResult);
    setTimeout(() => ChartManager.renderAllComparison(compResult), 150);

    // Exibir containers
    document.getElementById('comp-cards-container').style.display = '';
    document.getElementById('comp-winners-container').style.display = '';
    document.getElementById('comp-charts-container').style.display = '';
    document.getElementById('comp-narrativa-container').style.display = '';

    showToast('Comparação calculada com sucesso!', 'success');
  }

  /** Renderiza os cards comparativos. */
  function renderCompCards(result) {
    const container = document.getElementById('comp-cards-container');
    if (!container) return;

    const rA = result.groupA.resumo;
    const rB = result.groupB.resumo;
    const gA = result.groupA.group;
    const gB = result.groupB.group;
    const d = result.deltas;
    const w = result.winners;

    const cronA = rA.cronograma || [];
    const cronB = rB.cronograma || [];
    const ultimaParcelaA = cronA.length > 0 ? cronA[cronA.length - 1].parcelaTotal : 0;
    const ultimaParcelaB = cronB.length > 0 ? cronB[cronB.length - 1].parcelaTotal : 0;

    const nomeA = gA.plano || 'Grupo A';
    const nomeB = gB.plano || 'Grupo B';

    const metrics = [
      { label: 'Carta de Crédito', vA: Format.money(gA.valorCarta), vB: Format.money(gB.valorCarta), delta: d.valorCartaPct, winner: w.maiorCarta, icon: 'CC', prefer: 'higher' },
      { label: 'Prazo Total', vA: `${gA.prazoMeses} meses`, vB: `${gB.prazoMeses} meses`, delta: d.prazoPct, winner: w.menorPrazo, icon: 'PR', prefer: 'context' },
      { label: 'Taxa de Administração', vA: `${gA.taxaAdmTotalPct}%`, vB: `${gB.taxaAdmTotalPct}%`, delta: d.taxaAdmPct, winner: w.menorTaxa, icon: 'TX', prefer: 'lower' },
      { label: 'Total do Plano', vA: Format.money(rA.valorTotalPlano), vB: Format.money(rB.valorTotalPlano), delta: d.totalPlanoPct, winner: null, icon: 'TP' },
      { label: 'Parcela Inicial', vA: Format.money(rA.parcelaTotalAtual), vB: Format.money(rB.parcelaTotalAtual), delta: d.parcelaInicialPct, winner: w.menorParcelaInicial, icon: 'PI', prefer: 'lower' },
      { label: 'Carta Líquida', vA: Format.money(rA.cartaLiquida), vB: Format.money(rB.cartaLiquida), delta: d.cartaLiquidaPct, winner: w.maiorCartaLiquida, icon: 'CL', prefer: 'higher' },
      { label: 'Total Pago', vA: Format.money(rA.totalPago), vB: Format.money(rB.totalPago), delta: d.totalPagoPct, winner: w.menorTotalPago, icon: 'PG', prefer: 'lower' },
      { label: 'Até Contemplação', vA: Format.money(rA.totalPagoAteContemplacao), vB: Format.money(rB.totalPagoAteContemplacao), delta: d.ateContemplacaoPct, winner: w.menorCustoAteContemplacao, icon: 'CT', prefer: 'lower' },
      { label: 'Última Parcela', vA: Format.money(ultimaParcelaA), vB: Format.money(ultimaParcelaB), delta: d.ultimaParcelaPct, winner: null, icon: 'UP' },
      { label: 'Lance Embutido Máx', vA: `${getEffectiveLanceEmbutidoMax(gA)}%`, vB: `${getEffectiveLanceEmbutidoMax(gB)}%`, delta: Comparator.calcDeltaPct(getEffectiveLanceEmbutidoMax(gA), getEffectiveLanceEmbutidoMax(gB)), winner: w.maiorFlexibilidadeLance, icon: 'LE', prefer: 'higher' },
    ];

    container.innerHTML = metrics.map(m => {
      const deltaStr = m.delta > 0 ? `+${m.delta.toFixed(1)}%` : `${m.delta.toFixed(1)}%`;
      const deltaClass = m.delta > 0 ? 'comp-delta--up' : (m.delta < 0 ? 'comp-delta--down' : 'comp-delta--neutral');
      const winnerBadgeA = m.winner === 'A' ? '<span class="comp-winner-badge">OK</span>' : '';
      const winnerBadgeB = m.winner === 'B' ? '<span class="comp-winner-badge">OK</span>' : '';

      return `
        <div class="comp-card animate-in">
          <div class="comp-card__icon">${m.icon}</div>
          <div class="comp-card__label">${m.label}</div>
          <div class="comp-card__values">
            <div class="comp-card__value comp-card__value--a">
              <span class="comp-card__group-tag">A</span>
              ${m.vA} ${winnerBadgeA}
            </div>
            <div class="comp-card__value comp-card__value--b">
              <span class="comp-card__group-tag comp-card__group-tag--b">B</span>
              ${m.vB} ${winnerBadgeB}
            </div>
          </div>
          <div class="comp-card__delta ${deltaClass}">Δ ${deltaStr}</div>
        </div>
      `;
    }).join('');
  }

  /** Renderiza badges de vencedores. */
  function renderCompWinners(result) {
    const container = document.getElementById('comp-winners-badges');
    if (!container) return;

    const w = result.winners;
    const nomeA = result.groupA.group.plano || 'Grupo A';
    const nomeB = result.groupB.group.plano || 'Grupo B';

    const winnerItems = [
      { label: 'Menor Taxa', winner: w.menorTaxa },
      { label: 'Menor Parcela Inicial', winner: w.menorParcelaInicial },
      { label: 'Menor Total Pago', winner: w.menorTotalPago },
      { label: 'Maior Carta Líquida', winner: w.maiorCartaLiquida },
      { label: 'Maior Flex. Lance', winner: w.maiorFlexibilidadeLance },
      { label: 'Menor Custo até Contempl.', winner: w.menorCustoAteContemplacao },
    ];

    container.innerHTML = winnerItems.map(item => {
      const nome = item.winner === 'A' ? nomeA : (item.winner === 'B' ? nomeB : 'Empate');
      const cls = item.winner === 'A' ? 'comp-badge--a' : (item.winner === 'B' ? 'comp-badge--b' : 'comp-badge--empate');
      return `
        <div class="comp-badge ${cls}">
          <span class="comp-badge__label">${item.label}</span>
          <span class="comp-badge__winner">${item.winner === 'empate' ? 'Empate' : nome}</span>
        </div>
      `;
    }).join('');
  }

  /** Renderiza narrativa executiva. */
  function renderCompNarrativa(result) {
    const container = document.getElementById('comp-narrativa-text');
    if (!container) return;
    container.innerHTML = result.narrativa;
  }

  // ══════════════════════════════════════════
  // V7 — Prateleira de Grupos (com Heurística + Paginação)
  // ══════════════════════════════════════════

  function getPageSize() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.pageSizeFromSettings) {
      return window.BFSimulatorShelf.pageSizeFromSettings(typeof Settings !== 'undefined' ? Settings : null);
    }
    try {
      const size = (typeof Settings !== 'undefined' && Settings.get) ? Number(Settings.get('pageSize')) : 20;
      return Number.isFinite(size) && size > 0 ? Math.min(50, Math.max(20, Math.round(size))) : 20;
    } catch (e) {
      return 20;
    }
  }
  let _shelfCurrentPage = 1;
  let _shelfHiddenColumns = new Set();

  function _loadShelfHiddenColumns() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.loadHiddenColumns) {
      _shelfHiddenColumns = window.BFSimulatorShelf.loadHiddenColumns(typeof Settings !== 'undefined' ? Settings : null);
      return;
    }
    try {
      const saved = (typeof Settings !== 'undefined' && Settings.get) ? Settings.get('shelfHiddenColumns') : [];
      _shelfHiddenColumns = new Set(Array.isArray(saved) ? saved : []);
    } catch (e) {
      _shelfHiddenColumns = new Set();
    }
  }

  function syncShelfControls() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.syncControls) {
      _loadShelfHiddenColumns();
      window.BFSimulatorShelf.syncControls(document, _shelfHiddenColumns, getPageSize());
      return;
    }
    const pageSizeEl = document.getElementById('shelfPageSize');
    if (pageSizeEl) pageSizeEl.value = String(getPageSize());
    _loadShelfHiddenColumns();
    document.querySelectorAll('.shelf-columns-menu input[type="checkbox"]').forEach(input => {
      input.checked = !_shelfHiddenColumns.has(input.value);
    });
    applyShelfColumnVisibility();
  }

  function applyShelfColumnVisibility() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.applyColumnVisibility) {
      window.BFSimulatorShelf.applyColumnVisibility(document, _shelfHiddenColumns);
      return;
    }
    document.querySelectorAll('[data-shelf-col]').forEach(el => {
      const col = el.getAttribute('data-shelf-col');
      el.hidden = _shelfHiddenColumns.has(col);
    });
  }

  function changeShelfPageSize(value) {
    const pageSize = window.BFSimulatorShelf && window.BFSimulatorShelf.normalizePageSize
      ? window.BFSimulatorShelf.normalizePageSize(value)
      : (() => {
          const n = parseInt(value, 10);
          return Number.isFinite(n) && n > 0 ? Math.min(50, Math.max(20, n)) : 20;
        })();
    if (typeof Settings !== 'undefined' && Settings.set) Settings.set('pageSize', pageSize);
    _shelfCurrentPage = 1;
    const pageSizeEl = document.getElementById('shelfPageSize');
    if (pageSizeEl) pageSizeEl.value = String(pageSize);
    renderShelfPage();
  }

  function toggleShelfColumn(colName, checked) {
    if (!colName) return;
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.updateHiddenColumns) {
      _shelfHiddenColumns = window.BFSimulatorShelf.updateHiddenColumns(_shelfHiddenColumns, colName, checked, {
        settings: typeof Settings !== 'undefined' ? Settings : null
      });
    } else {
      if (checked) _shelfHiddenColumns.delete(colName);
      else _shelfHiddenColumns.add(colName);
      if (typeof Settings !== 'undefined' && Settings.set) {
        Settings.set('shelfHiddenColumns', Array.from(_shelfHiddenColumns));
      }
    }
    applyShelfColumnVisibility();
  }

  function populateShelfFilters() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.populateAdminFilter) {
      const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
      const result = window.BFSimulatorShelf.populateAdminFilter(
        document,
        catalog,
        typeof ShelfEngine !== 'undefined' ? ShelfEngine : null
      );
      if (result.changed) applyConfiguredDefaults({ forceFilters: true });
      return;
    }
    const sel = document.getElementById('filtroAdministradora');
    if (!sel) return;
    const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
    // Não repopular se já tem opções e o catálogo não mudou
    if (sel.options.length > 1 && sel._catalogSize === catalog.length) return;
    sel.innerHTML = '<option value="">Todas</option>';
    const admins = (typeof ShelfEngine !== 'undefined' && ShelfEngine.getUniqueAdmins)
      ? ShelfEngine.getUniqueAdmins(catalog)
      : [];
    admins.forEach(name => {
      const opt = document.createElement('option');
      opt.value = name;
      opt.textContent = name;
      sel.appendChild(opt);
    });
    sel._catalogSize = catalog.length;
    applyConfiguredDefaults({ forceFilters: true });
  }

  function getShelfFilters() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.readFilters) {
      return window.BFSimulatorShelf.readFilters(document);
    }
    return {
      administradora: document.getElementById('filtroAdministradora')?.value || '',
      segmento: document.getElementById('filtroProduto')?.value || '',
      prazoMin: document.getElementById('filtroPrazoMin')?.value || '',
      prazoMax: document.getElementById('filtroPrazoMax')?.value || '',
      // V7: Filtros avançados
      cartaMin: document.getElementById('filtroCartaMin')?.value || '',
      cartaMax: document.getElementById('filtroCartaMax')?.value || '',
      taxaMax: document.getElementById('filtroTaxaMax')?.value || '',
      classificacao: document.getElementById('filtroClassificacao')?.value || '',
      saude: document.getElementById('filtroSaude')?.value || '',
      maturidade: document.getElementById('filtroMaturidade')?.value || '',
      fgts: document.getElementById('filtroFgts')?.checked || false,
      parcelaReduzida: document.getElementById('filtroParcelaReduzida')?.checked || false,
      busca: document.getElementById('filtroBusca')?.value || ''
    };
  }

  function explainGroupRecommendation(group, options = {}) {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.explainGroupRecommendation) {
      return window.BFSimulatorShelf.explainGroupRecommendation(group, {
        filters: getShelfFilters(),
        objective: getSimulatorObjective(),
        ...options
      });
    }
    return { tone: 'neutral', label: 'Comparar', reasons: [], risks: [] };
  }

  function buscarGrupos() {
    try {
      const progress = window.BankFraternProgress;
      if (progress) {
        progress.journey(18, 'Lendo catalogo e filtros ativos.', 'loading');
        progress.setStage('connect', 'done');
      }
      const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
      if (typeof ShelfEngine === 'undefined') {
        console.warn('ShelfEngine indisponivel. Prateleira iniciada vazia.');
        shelfGroups = [];
        _shelfCurrentPage = 1;
        renderShelfPage();
        if (progress) progress.journey(100, 'Motor de prateleira indisponivel. Jornada segura ativada.', 'error');
        renderSimulatorDecision();
        return;
      }

      applyConfiguredDefaults();

      const appSettings = getAppSettings();
      if (appSettings.autoScore === false) {
        if (progress) progress.journey(42, 'Score automatico desativado. Usando ordenacao operacional.', 'loading');
      } else {
        if (progress) progress.journey(42, 'Calculando score comercial dos grupos.', 'loading');
        if (ShelfEngine.computeAllScores) ShelfEngine.computeAllScores(catalog);
      }
      if (progress) {
        progress.journey(64, 'Aplicando filtros da etapa 3.', 'loading');
        progress.setStage('filters', 'active');
      }
      const filters = getShelfFilters();
      const sortBy = document.getElementById('shelfSort')?.value || 'maior_score';
      if (progress) progress.journey(82, 'Ordenando e paginando resultados.', 'loading');
      const groups = window.BFSimulatorShelf && window.BFSimulatorShelf.filterAndSortGroups
        ? window.BFSimulatorShelf.filterAndSortGroups(catalog, filters, sortBy, {
            shelfEngine: ShelfEngine,
            autoScore: appSettings.autoScore
          })
        : ShelfEngine.sortGroups
          ? ShelfEngine.sortGroups(ShelfEngine.filterGroups ? ShelfEngine.filterGroups(catalog, filters) : [...catalog], sortBy)
          : (ShelfEngine.filterGroups ? ShelfEngine.filterGroups(catalog, filters) : [...catalog]);
      shelfGroups = Array.isArray(groups) ? groups : [];
      _shelfCurrentPage = 1;
      renderShelfPage();
      if (progress) {
        progress.setStage('filters', 'done');
        progress.setStage('shelf', 'done');
        progress.journey(100, `${shelfGroups.length.toLocaleString('pt-BR')} grupos prontos para a prateleira.`, 'success');
      }
      renderSimulatorDecision();
    } catch (e) {
      console.warn(`Nao foi possivel buscar grupos: ${e && e.message ? e.message : e}`);
      shelfGroups = [];
      _shelfCurrentPage = 1;
      renderShelfPage();
      if (window.BankFraternProgress) {
        window.BankFraternProgress.journey(100, 'Nao foi possivel atualizar a prateleira.', 'error');
      }
      renderSimulatorDecision();
    }
  }

  function shelfPrevPage() {
    if (_shelfCurrentPage > 1) { _shelfCurrentPage--; renderShelfPage(); }
  }
  function shelfNextPage() {
    const totalPages = Math.ceil(shelfGroups.length / getPageSize());
    if (_shelfCurrentPage < totalPages) { _shelfCurrentPage++; renderShelfPage(); }
  }

  function shelfGoToPage(value) {
    const input = document.getElementById('shelf-page-jump');
    const requested = parseInt(value || input?.value, 10);
    const totalPages = Math.max(1, Math.ceil((shelfGroups.length || 0) / getPageSize()));
    if (!Number.isFinite(requested)) return;
    _shelfCurrentPage = Math.max(1, Math.min(requested, totalPages));
    renderShelfPage();
  }

  function renderShelfPage() {
    const pageSize = getPageSize();
    const groups = Array.isArray(shelfGroups) ? shelfGroups : [];
    const pag = window.BFSimulatorShelf && window.BFSimulatorShelf.paginateGroups
      ? window.BFSimulatorShelf.paginateGroups(groups, _shelfCurrentPage, pageSize, typeof ShelfEngine !== 'undefined' ? ShelfEngine : null)
      : (typeof ShelfEngine !== 'undefined' && ShelfEngine.paginateGroups)
        ? ShelfEngine.paginateGroups(groups, _shelfCurrentPage, pageSize)
        : {
            data: groups.slice((_shelfCurrentPage - 1) * pageSize, _shelfCurrentPage * pageSize),
            totalGroups: groups.length,
            totalPages: Math.max(1, Math.ceil(groups.length / pageSize)),
            currentPage: _shelfCurrentPage,
            pageSize,
            startIdx: groups.length ? ((_shelfCurrentPage - 1) * pageSize) + 1 : 0,
            endIdx: Math.min(_shelfCurrentPage * pageSize, groups.length)
          };
    _shelfCurrentPage = pag.currentPage;
    renderShelfTable(pag.data, pag);
    renderPaginationControls(pag);
    applyShelfColumnVisibility();
  }

  function renderPaginationControls(pag) {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.applyPaginationControls) {
      window.BFSimulatorShelf.applyPaginationControls(document, pag);
      return;
    }
    const container = document.getElementById('shelf-pagination');
    const info = document.getElementById('shelf-page-info');
    const prevBtn = document.getElementById('shelf-prev-page');
    const nextBtn = document.getElementById('shelf-next-page');
    const jumpInput = document.getElementById('shelf-page-jump');
    if (!container) return;
    if (pag.totalGroups === 0 || pag.totalPages <= 1) {
      container.style.display = 'none';
      if (info) info.textContent = pag.totalGroups === 0 ? 'Sem páginas' : `Página 1 de 1 (1–${pag.endIdx} de ${pag.totalGroups})`;
      if (prevBtn) prevBtn.disabled = true;
      if (nextBtn) nextBtn.disabled = true;
      if (jumpInput) {
        jumpInput.value = '1';
        jumpInput.max = '1';
      }
      return;
    }
    container.style.display = 'flex';
    if (info) info.textContent = `Página ${pag.currentPage} de ${pag.totalPages} (${pag.startIdx}–${pag.endIdx} de ${pag.totalGroups})`;
    if (prevBtn) prevBtn.disabled = pag.currentPage <= 1;
    if (nextBtn) nextBtn.disabled = pag.currentPage >= pag.totalPages;
    if (jumpInput) {
      jumpInput.value = String(pag.currentPage);
      jumpInput.max = String(pag.totalPages);
    }
  }

  function limparFiltros() {
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.clearFilters) {
      window.BFSimulatorShelf.clearFilters(document);
      renderSimulatorObjectiveGuide();
      buscarGrupos();
      return;
    }
    const ids = ['filtroAdministradora', 'filtroProduto', 'filtroPrazoMin', 'filtroPrazoMax',
                 'filtroCartaMin', 'filtroCartaMax', 'filtroTaxaMax', 'filtroClassificacao', 'filtroSaude', 'filtroMaturidade', 'filtroBusca'];
    ids.forEach(id => { const el = document.getElementById(id); if (el) el.value = ''; });
    const checks = ['filtroFgts', 'filtroParcelaReduzida'];
    checks.forEach(id => { const el = document.getElementById(id); if (el) el.checked = false; });
    renderSimulatorObjectiveGuide();
    buscarGrupos();
  }

  function _getClassBadge(g) {
    const cls = g.classificacaoExecutiva || (g._classificacao ? g._classificacao.classe : '');
    const letter = cls.charAt(0);
    const colorMap = { 'A': '#059669', 'B': '#2563eb', 'C': '#f59e0b', 'D': '#dc2626' };
    const color = colorMap[letter] || '#94a3b8';
    return `<span class="heur-badge" style="background:${color};color:#fff;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:700;">${letter || '?'}</span>`;
  }

  function _getRoleBadge(g) {
    if (g._papel) return `<span title="${g._papel.justificativa}" style="cursor:help;">${g._papel.tag}</span>`;
    return '—';
  }

  function _getSaudeBadge(g) {
    const s = g.saudeCarteira || (g._heuristica ? g._heuristica.classificacoes.saude.classe : '');
    const iconMap = { 'Baixa': '🟢', 'Controlada': '🔵', 'Atenção': '🟡', 'Crítica': '🔴' };
    return `${iconMap[s] || '⚪'} ${s || '—'}`;
  }

  function renderShelfTable(groups, pag) {
    const tbody = document.getElementById('shelf-table-body');
    const countEl = document.getElementById('shelf-count');
    if (!tbody) return;
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.renderTable) {
      const rendered = window.BFSimulatorShelf.renderTable(groups, pag, {
        projectItems: projetoEstruturado.itens,
        filters: getShelfFilters(),
        objective: getSimulatorObjective(),
        formatMoney: Format.money,
        formatNumber: Format.number
      });
      if (countEl) countEl.textContent = rendered.countText;
      tbody.innerHTML = rendered.bodyHtml;
      return;
    }
    const total = pag ? pag.totalGroups : groups.length;
    if (countEl) countEl.textContent = `${total.toLocaleString('pt-BR')} grupo${total !== 1 ? 's' : ''} encontrado${total !== 1 ? 's' : ''}`;

    if (groups.length === 0) {
      tbody.innerHTML = '<tr><td colspan="13" class="text-center text-muted" style="padding:40px;">Nenhum grupo encontrado com os filtros selecionados.</td></tr>';
      return;
    }

    const addedKeys = new Set(projetoEstruturado.itens.map(item => item.groupKey));
    const baseIdx = pag ? (pag.currentPage - 1) * pag.pageSize : 0;

    tbody.innerHTML = groups.map((g, i) => {
      const globalIdx = baseIdx + i;
      const scoreCls = g.scoreShelf >= 70 ? 'shelf-score--high' : (g.scoreShelf >= 40 ? 'shelf-score--mid' : 'shelf-score--low');
      const jaAdicionado = addedKeys.has(g.groupKey);
      const letter = (g._classificacao && g._classificacao.letra) || (g.classificacaoExecutiva || '').charAt(0);
      const rowColorMap = { 'A': 'rgba(5,150,105,0.04)', 'D': 'rgba(220,38,38,0.04)', 'C': 'rgba(245,158,11,0.03)' };
      const rowBg = rowColorMap[letter] || '';
      const rowCls = jaAdicionado ? 'shelf-row shelf-row--added' : 'shelf-row';
      const addBtnHtml = jaAdicionado
        ? `<button class="btn btn--sm btn--success" onclick="App.selecionarGrupo(${globalIdx})" title="Re-adicionar">OK</button>`
        : `<button class="btn btn--sm btn--primary" onclick="App.selecionarGrupo(${globalIdx})" title="Adicionar">+</button>`;
      return `
        <tr class="${rowCls}" data-idx="${globalIdx}" ${rowBg ? `style="background:${rowBg}"` : ''}>
          <td data-shelf-col="score"><span class="shelf-score ${scoreCls}">${g.scoreShelf}</span></td>
          <td data-shelf-col="classificacao">${_getClassBadge(g)}</td>
          <td data-shelf-col="papel">${_getRoleBadge(g)}</td>
          <td data-shelf-col="admin" class="shelf-admin-cell">${g.nomeAdministradora || '—'}</td>
          <td data-shelf-col="grupo"><strong>${g.codigoGrupo}</strong></td>
          <td data-shelf-col="segmento"><span class="shelf-segment-badge">${g.iconSegmento} ${g.nomeSegmento}</span></td>
          <td data-shelf-col="carta">${Format.money(g.valorCartaRef)}</td>
          <td data-shelf-col="prazo">${g.prazoMeses}m</td>
          <td data-shelf-col="taxa">${(g.taxaAdmPct || 0).toFixed(2)}%</td>
          <td data-shelf-col="indice">${g.indiceCorrecaoNome || '—'}</td>
          <td data-shelf-col="ativas">${Format.number(g.qtdAtivasEmDia || 0, 0)}</td>
          <td data-shelf-col="saude">${_getSaudeBadge(g)}</td>
          <td data-shelf-col="acoes" class="shelf-actions-cell">
            <button class="btn btn--sm btn--ghost" onclick="App.verDetalheGrupo(${globalIdx})" title="Ver detalhes">Ver</button>
            ${addBtnHtml}
          </td>
        </tr>
      `;
    }).join('');
  }

  function verDetalheGrupo(idx) {
    const g = shelfGroups[idx];
    if (!g) return;
    _viewingGroup = g;

    const titleEl = document.getElementById('shelf-detail-title');
    const contentEl = document.getElementById('shelf-detail-content');
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.renderDetail) {
      if (titleEl) titleEl.textContent = window.BFSimulatorShelf.detailTitle(g);
      if (contentEl) {
        contentEl.innerHTML = window.BFSimulatorShelf.renderDetail(g, {
          heuristicEngine: typeof HeuristicEngine !== 'undefined' ? HeuristicEngine : null,
          filters: getShelfFilters(),
          objective: getSimulatorObjective(),
          getEffectiveLanceEmbutidoMax,
          formatMoney: Format.money,
          formatNumber: Format.number
        });
      }
      if (window.BFSimulatorShelf.setDetailAddVisible) {
        window.BFSimulatorShelf.setDetailAddVisible(document, true);
      }
      const modal = document.getElementById('shelf-detail-modal');
      if (modal) modal.style.display = 'flex';
      return;
    }
    if (titleEl) titleEl.textContent = `${g.iconSegmento} ${g.nomeAdministradora || 'Admin'} — Grupo ${g.codigoGrupo}`;

    // V7: Gerar análise heurística
    let heuristicHtml = '';
    if (typeof HeuristicEngine !== 'undefined') {
      const analise = g._heuristica || HeuristicEngine.analisar(g);
      const c = analise.classificacoes;
      const m = analise.metricas;
      const fmt = (v) => (v * 100).toFixed(1) + '%';
      heuristicHtml = `
          <div class="shelf-detail-section" style="grid-column:1/-1;border:2px solid ${c.classificacaoFinal.cor};border-radius:12px;padding:20px;background:rgba(0,0,0,0.02);">
            <h4>Análise Heurística V7</h4>
            <div style="display:flex;gap:8px;flex-wrap:wrap;margin:12px 0;">
              <span class="heur-badge" style="background:${c.classificacaoFinal.cor};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;">${c.classificacaoFinal.icon} ${c.classificacaoFinal.classe}</span>
              <span class="heur-badge" style="background:${analise.papel.cor};color:#fff;padding:4px 12px;border-radius:6px;font-weight:700;">${analise.papel.tag} ${analise.papel.papel}</span>
            </div>
            <table class="detail-mini-table" style="margin-top:12px;">
              <tr><td>${c.porte.icon} Porte</td><td><strong>${c.porte.classe}</strong></td></tr>
              <tr><td>${c.maturidade.icon} Maturidade</td><td><strong>${c.maturidade.classe}</strong> (${fmt(m.indiceMaturidade)})</td></tr>
              <tr><td>${c.saude.icon} Saúde</td><td><strong>${c.saude.classe}</strong> (inadimpl. ${fmt(m.taxaInadimplencia)})</td></tr>
              <tr><td>${c.ticket.icon} Ticket</td><td><strong>${c.ticket.classe}</strong></td></tr>
              <tr><td>${c.dinamismo.icon} Dinamismo</td><td><strong>${c.dinamismo.classe}</strong> (${fmt(m.taxaContemplacao)}/mês)</td></tr>
              <tr><td>${c.ociosidade.icon} Ociosidade</td><td><strong>${c.ociosidade.classe}</strong></td></tr>
              <tr><td>${c.pressaoExclusao.icon} Pressão Exclusão</td><td><strong>${c.pressaoExclusao.classe}</strong> (${fmt(m.intensidadeExclusao)})</td></tr>
            </table>
            <div style="margin-top:14px;padding:12px;background:rgba(0,0,0,0.03);border-radius:8px;font-size:13px;line-height:1.7;">
              <strong>Sinopse:</strong><br>
              ${analise.sinopse.map(b => `• ${b}`).join('<br>')}
            </div>
          </div>`;
    }

    if (contentEl) {
      contentEl.innerHTML = `
        <div class="shelf-detail-grid">
          <div class="shelf-detail-section">
            <h4>Administradora</h4>
            <p><strong>${g.nomeAdministradora || '—'}</strong></p>
            <p class="text-muted">CNPJ Raiz: ${g.cnpjRaiz}</p>
          </div>
          <div class="shelf-detail-section">
            <h4>Dados do Grupo</h4>
            <table class="detail-mini-table">
              <tr><td>Código do Grupo</td><td><strong>${g.codigoGrupo}</strong></td></tr>
              <tr><td>Segmento</td><td>${g.iconSegmento} ${g.nomeSegmento}</td></tr>
              <tr><td>Origem</td><td>${g.origem === 'imoveis' ? 'Imóveis' : 'Móveis'}</td></tr>
              <tr><td>Data Base</td><td>${g.dataBase}</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Valores e Taxas</h4>
            <table class="detail-mini-table">
              <tr><td>Carta de Referência</td><td><strong>${Format.money(g.valorCartaRef)}</strong></td></tr>
              <tr><td>Prazo</td><td><strong>${g.prazoMeses} meses</strong></td></tr>
              <tr><td>Taxa de Administração</td><td>${(g.taxaAdmPct || 0).toFixed(2)}%</td></tr>
              <tr><td>Fundo de Reserva</td><td>${g.fundoReservaPct}%</td></tr>
              <tr><td>Índice de Correção</td><td>${g.indiceCorrecaoNome || 'N/A'}</td></tr>
              <tr><td>Seguro Comercial</td><td>${g.seguroPctComercial || 0}%</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Cotas e Saúde do Grupo</h4>
            <table class="detail-mini-table">
              <tr><td>Cotas Ativas em Dia</td><td><strong>${Format.number(g.qtdAtivasEmDia || 0, 0)}</strong></td></tr>
              <tr><td>Contempladas no Mês</td><td>${g.qtdContempladasNoMes}</td></tr>
              <tr><td>Cotas Excluídas</td><td>${g.qtdExcluidas}</td></tr>
              <tr><td>Cotas Quitadas</td><td>${g.qtdQuitadas}</td></tr>
              <tr><td>Crédito Pendente</td><td>${g.qtdCreditoPendente}</td></tr>
              <tr><td>Score Prateleira</td><td><strong>${g.scoreShelf}</strong>/100</td></tr>
            </table>
          </div>
          <div class="shelf-detail-section">
            <h4>Regras Comerciais</h4>
            <table class="detail-mini-table">
              <tr><td>Lance Embutido Máx.</td><td>${getEffectiveLanceEmbutidoMax(g)}%</td></tr>
              <tr><td>Lance Fixo</td><td>${g.lanceFixoPct || 0}%</td></tr>
              <tr><td>Parcela Reduzida</td><td>${g.parcelaReduzidaDisponivel ? 'Sim' : 'Não'}</td></tr>
              <tr><td>Redução Máx. Parcela</td><td>${g.reducaoMaxParcelaPct || 0}%</td></tr>
              <tr><td>FGTS Permitido</td><td>${g.fgtsPermitido ? 'Sim' : 'Não'}</td></tr>
              <tr><td>Status Comercial</td><td>${g.statusComercial}</td></tr>
            </table>
          </div>
          ${heuristicHtml}
        </div>
      `;
    }

    document.getElementById('shelf-detail-modal').style.display = 'flex';
  }

  function fecharDetalheGrupo() {
    const modal = document.getElementById('shelf-detail-modal');
    if (modal) modal.style.display = 'none';
    _viewingGroup = null;
  }

  function selecionarGrupoDoDetalhe() {
    if (!_viewingGroup) return;
    const idx = shelfGroups.indexOf(_viewingGroup);
    if (idx >= 0) selecionarGrupo(idx);
    fecharDetalheGrupo();
  }

  // ── V5: Multi-Seleção ──────────────────────────────────────────────────────

  /** Adiciona um grupo ao projeto estruturado (carrinho multi-select). */
  function selecionarGrupo(idx) {
    const g = shelfGroups[idx];
    if (!g) return;
    selectedShelfGroup = g; // compatibilidade legada

    // Criar item no projeto estruturado
    const item = window.BFSimulatorCart && window.BFSimulatorCart.createProjectItem
      ? window.BFSimulatorCart.createProjectItem(g, { shelfEngine: ShelfEngine, numberSetting, getEffectiveLanceEmbutidoMax })
      : ShelfEngine.createProjectItem(g, 1);
    if (!item) {
      showToast('Nao foi possivel adicionar o grupo ao projeto.', 'error');
      return;
    }
    if (!window.BFSimulatorCart) {
      item.mesContemplacaoAlvo = numberSetting('defaultMesContemplacao', item.mesContemplacaoAlvo || 18);
      item.lanceEmbutidoPct = Math.min(getEffectiveLanceEmbutidoMax(g), item.lanceEmbutidoPct || getEffectiveLanceEmbutidoMax(g));
    }
    projetoEstruturado.itens.push(item);

    // Re-renderizar tabela para atualizar indicador "Adicionado"
    renderShelfPage();
    // Renderizar painel de grupos selecionados
    renderGruposSelecionados();
    // Atualizar botão de avançar
    atualizarBotaoAvancar();
    renderSimulatorDecision();

    showToast(`Grupo ${g.codigoGrupo} (${g.nomeAdministradora}) adicionado ao projeto.`, 'success');
  }

  /** Remove um grupo do projeto estruturado. */
  function removerGrupoSelecionado(itemId) {
    if (window.BFSimulatorCart && window.BFSimulatorCart.removeProjectItem) {
      window.BFSimulatorCart.removeProjectItem(projetoEstruturado, itemId, { shelfEngine: ShelfEngine });
    } else {
      ShelfEngine.removeProjectItem(projetoEstruturado, itemId);
    }
    renderShelfPage();
    renderGruposSelecionados();
    atualizarBotaoAvancar();
    renderSimulatorDecision();
    showToast('Grupo removido do projeto.', 'warning');
  }

  /** Atualiza um campo do item no projeto estruturado (valorCartaUnitario ou quantidadeCotas). */
  function atualizarItemProjeto(itemId, campo, valor) {
    const itemAtualizado = window.BFSimulatorCart && window.BFSimulatorCart.updateProjectItem
      ? window.BFSimulatorCart.updateProjectItem(projetoEstruturado, itemId, campo, valor, { shelfEngine: ShelfEngine })
      : null;
    if (!itemAtualizado) {
      const patch = {};
      patch[campo] = valor;
      ShelfEngine.updateProjectItem(projetoEstruturado, itemId, patch);
    }
    // Re-renderizar somente o campo calculado correspondente
    const rowEl = document.querySelector(`.selected-group-row[data-item-id="${itemId}"]`);
    if (!rowEl) return;
    const item = projetoEstruturado.itens.find(i => i.itemId === itemId);
    if (!item) return;
    const totalEl = rowEl.querySelector('.sg-total-carta');
    if (totalEl) totalEl.textContent = Format.money(item.valorCartaTotal);
    // Atualizar rodapé
    atualizarRodapeGruposSelecionados();
    renderSimulatorDecision();
  }

  /** Renderiza o painel de grupos selecionados (carrinho). */
  function renderGruposSelecionados() {
    const panel = document.getElementById('selected-groups-panel');
    if (!panel) return;

    if (window.BFSimulatorCart && window.BFSimulatorCart.renderSelectedGroupsHtml) {
      panel.innerHTML = window.BFSimulatorCart.renderSelectedGroupsHtml(projetoEstruturado.itens, {
        formatMoney: Format.money,
        formatNumber: Format.number
      });
      if (projetoEstruturado.itens.length > 0) atualizarRodapeGruposSelecionados();
      return;
    }

    if (projetoEstruturado.itens.length === 0) {
      panel.innerHTML = `
        <div class="selected-groups-empty">
          <span class="bf-empty-mark">PJ</span>
          <p>Nenhum grupo adicionado ainda. Clique em <strong>+ Adicionar</strong> na tabela acima.</p>
        </div>
      `;
      return;
    }

    const rows = projetoEstruturado.itens.map(item => `
      <tr class="selected-group-row" data-item-id="${item.itemId}">
        <td>
          <div class="sg-group-info">
            <span class="sg-icon">${item.iconSegmento}</span>
            <div>
              <div class="sg-grupo-cod"><strong>${item.codigoGrupo}</strong></div>
              <div class="sg-admin-nome">${item.administradora}</div>
            </div>
          </div>
        </td>
        <td><span class="shelf-segment-badge">${item.iconSegmento} ${item.nomeSegmento}</span></td>
        <td>
          <div class="campo-input-usuario">
            <label class="campo-label--usuario">Editável</label>
            <input
              type="text"
              class="input-usuario"
              value="${Format.number(item.valorCartaUnitario)}"
              data-item-id="${item.itemId}"
              data-campo="valorCartaUnitario"
              onchange="App.onEditarItemProjeto(this)"
              onblur="App.onEditarItemProjeto(this)"
              placeholder="Ex: 100.000,00"
            >
          </div>
        </td>
        <td>
          <div class="campo-input-usuario">
            <label class="campo-label--usuario">Editável</label>
            <input
              type="number"
              class="input-usuario input-usuario--qtd"
              value="${item.quantidadeCotas}"
              min="1"
              max="999"
              data-item-id="${item.itemId}"
              data-campo="quantidadeCotas"
              onchange="App.onEditarItemProjeto(this)"
              placeholder="1"
            >
          </div>
        </td>
        <td>
          <div class="campo-calculado">
            <label class="campo-label--calculado">Calculado</label>
            <div class="campo-calculado__valor sg-total-carta">${Format.money(item.valorCartaTotal)}</div>
          </div>
        </td>
        <td class="sg-remover-cell">
          <button class="btn btn--sm btn--danger" onclick="App.removerGrupoSelecionado('${item.itemId}')" title="Remover grupo">✕</button>
        </td>
      </tr>
    `).join('');

    panel.innerHTML = `
      <table class="data-table selected-groups-table">
        <thead>
          <tr>
            <th>Grupo</th>
            <th>Segmento</th>
            <th>Valor da Carta (R$)</th>
            <th>Qtd. Cotas</th>
            <th>Total da Carta</th>
            <th>Remover</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <div class="selected-groups-footer" id="selected-groups-footer"></div>
    `;
    atualizarRodapeGruposSelecionados();
  }

  /** Atualiza o rodapé com totais consolidados e o badge do header. */
  function atualizarRodapeGruposSelecionados() {
    const footer = document.getElementById('selected-groups-footer');
    if (window.BFSimulatorCart && window.BFSimulatorCart.cartTotals && window.BFSimulatorCart.renderSelectedGroupsFooter) {
      const totals = window.BFSimulatorCart.cartTotals(projetoEstruturado.itens);
      const badge = document.getElementById('shelf-cart-count');
      if (badge) badge.textContent = `${totals.totalGrupos} grupo${totals.totalGrupos !== 1 ? 's' : ''}`;
      if (footer) {
        footer.innerHTML = window.BFSimulatorCart.renderSelectedGroupsFooter(projetoEstruturado.itens, {
          formatMoney: Format.money
        });
      }
      return;
    }
    const totalGrupos = projetoEstruturado.itens.length;
    const totalCotas = projetoEstruturado.itens.reduce((s, i) => s + i.quantidadeCotas, 0);
    const totalCarta = projetoEstruturado.itens.reduce((s, i) => s + i.valorCartaTotal, 0);
    // Atualizar badge do header do painel
    const badge = document.getElementById('shelf-cart-count');
    if (badge) badge.textContent = `${totalGrupos} grupo${totalGrupos !== 1 ? 's' : ''}`;
    if (!footer) return;
    footer.innerHTML = `
      <div class="sg-footer-item">
        <span class="sg-footer-label">Grupos</span>
        <span class="sg-footer-value">${totalGrupos}</span>
      </div>
      <div class="sg-footer-item">
        <span class="sg-footer-label">Total de Cotas</span>
        <span class="sg-footer-value">${totalCotas}</span>
      </div>
      <div class="sg-footer-item sg-footer-item--destaque">
        <span class="sg-footer-label">Total das Cartas</span>
        <span class="sg-footer-value">${Format.money(totalCarta)}</span>
      </div>
    `;
  }

  /** Handler chamado pelo onchange dos campos editáveis do painel e do carrinho (Step 4 e 5). */
  function onEditarItemProjeto(inputEl) {
    const itemId = inputEl.dataset.itemId || inputEl.closest('.cart-item-card')?.dataset.itemId;
    if (!itemId) return;

    const campo = inputEl.dataset.campo;
    const itemAtual = projetoEstruturado.itens.find(i => i.itemId === itemId);
    if (!itemAtual) return;
    if (window.BFSimulatorCart && window.BFSimulatorCart.normalizeEditValue) {
      const normalized = window.BFSimulatorCart.normalizeEditValue(campo, inputEl.value, itemAtual, {
        parseMoney: Format.parseMoney,
        formatNumber: Format.number,
        getEffectiveLanceEmbutidoMax
      });
      if (normalized.displayValue !== undefined) inputEl.value = normalized.displayValue;
      if (normalized.message) showToast(normalized.message, normalized.tone || (normalized.ok ? 'warning' : 'error'));
      if (!normalized.ok) return;
      atualizarItemProjeto(itemId, campo, normalized.value);
      return;
    }
    let valor;

    if (campo === 'valorCartaUnitario') {
      valor = Format.parseMoney(inputEl.value);
      if (valor <= 0) {
        inputEl.value = Format.number(itemAtual.valorCartaUnitario || 0);
        showToast('Valor da carta deve ser maior que zero.', 'error');
        return;
      }
    } else if (campo === 'quantidadeCotas' || campo === 'prazoMeses' || campo === 'mesContemplacaoAlvo') {
      valor = parseInt(inputEl.value, 10) || 1;
      if (valor < 1) valor = 1;
      if (campo === 'mesContemplacaoAlvo' && valor > (itemAtual.prazoMeses || 1)) {
        valor = itemAtual.prazoMeses || 1;
        showToast('Mês de contemplação ajustado ao prazo do grupo.', 'warning');
      }
      inputEl.value = valor;
    } else if (campo === 'taxaAdmPct' || campo === 'fundoReservaPct' || campo === 'lanceProprioPct' || campo === 'lanceEmbutidoPct') {
      valor = parseFloat(inputEl.value) || 0;
      if (valor < 0) valor = 0;
      if (campo === 'lanceEmbutidoPct') {
        const limite = getEffectiveLanceEmbutidoMax(itemAtual._group);
        if (limite > 0 && valor > limite) {
          valor = limite;
          showToast(`Lance embutido ajustado ao limite do grupo (${limite.toFixed(1)}%).`, 'warning');
        }
      }
      inputEl.value = valor;
    } else {
      return;
    }
    atualizarItemProjeto(itemId, campo, valor);
  }

  /** Atualiza o botão de avançar da etapa 4 baseado no estado do projeto. */
  function atualizarBotaoAvancar() {
    const btn = document.getElementById('btn-avancar-parametros');
    const n = projetoEstruturado.itens.length;
    if (!btn) return;
    if (window.BFSimulatorCart && window.BFSimulatorCart.advanceButtonState) {
      const state = window.BFSimulatorCart.advanceButtonState(n);
      btn.disabled = state.disabled;
      btn.textContent = state.text;
      return;
    }
    if (n === 0) {
      btn.disabled = true;
      btn.textContent = 'Adicione pelo menos 1 grupo para avançar →';
    } else {
      btn.disabled = false;
      btn.textContent = `Simular ${n} grupo${n !== 1 ? 's' : ''} selecionado${n !== 1 ? 's' : ''} →`;
    }
  }

  /** Renderiza os totais consolidados no Top Dashboard do Step 5. */
  function renderStep5Dashboard(consolidado) {
    const dash = document.getElementById('step5-dashboard');
    if (!dash) return;
    dash.style.display = 'block';

    if (window.BFSimulatorCart && window.BFSimulatorCart.renderDashboardKpis) {
      const kpis = window.BFSimulatorCart.renderDashboardKpis(consolidado, {
        formatMoney: Format.money
      });
      dash.innerHTML = `
        <div class="kpi-header">
          <span>Metricas Consolidadas</span>
          <span>Projeto Estruturado</span>
        </div>
        <div class="step5-dashboard-grid">
          ${kpis.map(k => `
            <div class="kpi-row ${k.cls}">
              <div class="kpi-label">${k.label}</div>
              <div class="kpi-value">${k.val}</div>
            </div>
          `).join('')}
        </div>
      `;
      renderSimulatorDecision();
      return;
    }

    const kpis = [
      { label: 'Valor Crédito Contratado', val: Format.money(consolidado.totalCarta), cls: '' },
      { label: 'Valor Receber (Crédito - L. Embutido)', val: Format.money(consolidado.cartaLiquida), cls: 'kpi-row--green' },
      { label: 'Taxa Administração Média', val: (consolidado.taxaAdmMedia || 0).toFixed(2) + '%', cls: '' },
      { label: 'Quantidade de Grupos', val: consolidado.totalGrupos, cls: '' },
      { label: 'Total de Cotas', val: consolidado.totalCotas || 0, cls: '' },
      { label: 'Prazo Médio', val: (consolidado.prazoMedio || 0).toFixed(0) + ' meses', cls: '' },
      { label: 'Lance Próprio', val: Format.money(consolidado.totalLanceProprioR) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Lance Embutido', val: Format.money(consolidado.totalLanceEmbutidoR) || 'R$ 0,00', cls: 'kpi-row--green' },
      { label: 'Parcela Inicial do Projeto', val: Format.money(consolidado.parcelaInicialTotal), cls: 'kpi-row--red' },
      { label: 'Custo Efetivo Estimado', val: (consolidado.custoEfetivoMedio || 0).toFixed(2) + '%', cls: 'kpi-row--red' }
    ];

    dash.innerHTML = `
      <div class="kpi-header">
        <span>Métricas Consolidadas</span>
        <span>Projeto Estruturado</span>
      </div>
      <div class="step5-dashboard-grid">
        ${kpis.map(k => `
          <div class="kpi-row ${k.cls}">
            <div class="kpi-label">${k.label}</div>
            <div class="kpi-value">${k.val}</div>
          </div>
        `).join('')}
      </div>
    `;
    renderSimulatorDecision();
  }

  /** Renderiza a lista de grupos para edição no Passo 5 (A Sacola). */
  function renderStep5Cart() {
    const container = document.getElementById('step5-cart-items');
    if (!container) return;

    if (window.BFSimulatorCart && window.BFSimulatorCart.renderStep5CartHtml) {
      container.innerHTML = window.BFSimulatorCart.renderStep5CartHtml(projetoEstruturado.itens, {
        formatMoney: Format.money,
        formatNumber: Format.number,
        getEffectiveLanceEmbutidoMax
      });
      document.querySelectorAll('#step5-cart-items [data-money="true"]').forEach(Format.applyMoneyMask);
      return;
    }

    if (projetoEstruturado.itens.length === 0) {
      container.innerHTML = '<p class="text-center text-muted">Nenhum grupo selecionado.</p>';
      return;
    }

    container.innerHTML = projetoEstruturado.itens.map((item, idx) => {
      // Inputs customizados (lidos do item ou do grupo de origem)
      const prazo = item.prazoMeses;
      const taxa = item.taxaAdmPct;
      const fundo = item.fundoReservaPct;
      const qtde = item.quantidadeCotas;
      const valCarta = item.valorCartaUnitario;
      const mob = item.mesContemplacaoAlvo || 18;
      const pctEmbutido = item.lanceEmbutidoPct || 0;
      const pctProprio = item.lanceProprioPct || 0;
      const limiteEmbutido = getEffectiveLanceEmbutidoMax(item._group);

      // Campos Calculados básicos para a tela (serão recalculados e subscritos via motor depois)
      const calcValEmb = valCarta * (pctEmbutido / 100) * qtde;
      const calcValPro = valCarta * (pctProprio / 100) * qtde;
      const calcLanceTot = calcValEmb + calcValPro;

      return `
        <div class="cart-item-card" data-item-id="${item.itemId}">
          <div class="cart-item-header">
            <div class="cart-item-title">
              <span class="shelf-segment-badge">${item.iconSegmento} ${item.nomeSegmento}</span>
              ${item.administradora} — Grupo ${item.codigoGrupo}
            </div>
            <button class="btn btn--sm btn--danger" onclick="App.removerGrupoSelecionado('${item.itemId}'); App.recalcularProjeto()">✕ Remover</button>
          </div>
          <div class="cart-item-body">
            <div class="cart-grid-container">
              <!-- Inputs de Usuário (Borda Azul) -->
              <div class="cart-field">
                <label>Qtd. Cotas</label>
                <input type="number" class="cart-input" data-campo="quantidadeCotas" value="${qtde}" min="1" max="999" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Valor da Carta Unit. (R$)</label>
                <input type="text" class="cart-input" data-money="true" data-campo="valorCartaUnitario" value="${Format.number(valCarta)}" onblur="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Prazo Restante</label>
                <input type="number" class="cart-input" data-campo="prazoMeses" value="${prazo}" min="1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Taxa Adm (%)</label>
                <input type="number" class="cart-input" data-campo="taxaAdmPct" value="${taxa.toFixed(2)}" step="0.01" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Fundo Reserva (%)</label>
                <input type="number" class="cart-input" data-campo="fundoReservaPct" value="${fundo.toFixed(2)}" step="0.01" min="0" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>MOB Contemplação (Mês)</label>
                <input type="number" class="cart-input" data-campo="mesContemplacaoAlvo" value="${mob}" min="1" max="${prazo}" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance R.P (%)</label>
                <input type="number" class="cart-input" data-campo="lanceProprioPct" value="${pctProprio}" step="0.1" onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <div class="cart-field">
                <label>Lance Embutido (%)${limiteEmbutido ? ` máx. ${limiteEmbutido}%` : ''}</label>
                <input type="number" class="cart-input" data-campo="lanceEmbutidoPct" value="${pctEmbutido}" step="0.1" min="0" ${limiteEmbutido ? `max="${limiteEmbutido}"` : ''} onchange="App.onEditarItemProjeto(this); App.recalcularProjeto()">
              </div>
              <!-- Campos Calculados (Verdes) -->
              <div class="cart-field">
                <label>Lance R.P (R$)</label>
                <div class="cart-calc dyn-val-proprio">${Format.money(calcValPro)}</div>
              </div>
              <div class="cart-field">
                <label>Lance Embutido (R$)</label>
                <div class="cart-calc dyn-val-embutido">${Format.money(calcValEmb)}</div>
              </div>
              <div class="cart-field">
                <label>Lance Total (R$)</label>
                <div class="cart-calc dyn-val-lancetot">${Format.money(calcLanceTot)}</div>
              </div>
              <div class="cart-field">
                <label>Crédito Líquido</label>
                <div class="cart-calc dyn-val-liq">${Format.money((valCarta * qtde) - calcValEmb)}</div>
              </div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    // Reaplica mascara nos novos campos gerados
    document.querySelectorAll('#step5-cart-items [data-money="true"]').forEach(Format.applyMoneyMask);
  }

  /** Centraliza o re-cálculo da Sacola quando o usuário edita. */
  function recalcularProjeto() {
    if (projetoEstruturado.itens.length === 0) {
      document.getElementById('step5-dashboard').style.display = 'none';
      renderStep5Cart();
      return;
    }

    const resultado = ShelfEngine.simulateStructuredProject(projetoEstruturado);
    if (!resultado || !resultado.consolidado) {
      showToast('Não foi possível recalcular o projeto estruturado.', 'error');
      return;
    }

    if (window.BFSimulatorCart && window.BFSimulatorCart.applyCalculationResults) {
      window.BFSimulatorCart.applyCalculationResults(resultado.itemResults, {
        root: document,
        formatMoney: Format.money
      });
    }

    resultado.itemResults.forEach(r => {
      const i = r.item;
      const card = document.querySelector(`.cart-item-card[data-item-id="${i.itemId}"]`);
      if (!card) return;
      const propR = r.lanceProprioR || 0;
      const embR = r.lanceEmbutidoR || 0;
      const lPropEl = card.querySelector('.dyn-val-proprio');
      const lEmbEl = card.querySelector('.dyn-val-embutido');
      const lTotEl = card.querySelector('.dyn-val-lancetot');
      const lLiqEl = card.querySelector('.dyn-val-liq');
      if (lPropEl) lPropEl.textContent = Format.money(propR);
      if (lEmbEl) lEmbEl.textContent = Format.money(embR);
      if (lTotEl) lTotEl.textContent = Format.money(propR + embR);
      if (lLiqEl) lLiqEl.textContent = Format.money(r.cartaLiquida || 0);
    });

    if (resultado.erro && resultado.mensagens && resultado.mensagens.length) {
      showToast(resultado.mensagens.slice(0, 2).join('\n'), 'error');
    }

    renderStep5Dashboard(resultado.consolidado);
  }

  /** Avança do passo 4 para o novo Passo 5 (Sacola de Consórcios) */
  function simularProjetoEstruturado() {
    if (projetoEstruturado.itens.length === 0) {
      showToast('Adicione pelo menos um grupo antes de avançar.', 'error');
      return;
    }
    // Inicializa a UI do passo 5
    renderStep5Cart();
    recalcularProjeto();

    // Avança para o step 5
    nextStep();
  }

  // ══════════════════════════════════════════
  // V7 — Persistência (Salvar / Carregar)
  // ══════════════════════════════════════════

  function collectFormSnapshot() {
    return window.BFSimulatorState && window.BFSimulatorState.collectFormSnapshot
      ? window.BFSimulatorState.collectFormSnapshot(document)
      : {};
  }

  function applyFormSnapshot(snapshot) {
    if (window.BFSimulatorState && window.BFSimulatorState.applyFormSnapshot) {
      window.BFSimulatorState.applyFormSnapshot(snapshot, document);
    }
    toggleFGTSFields();
    toggleReducaoFields();
  }

  function collectSavedCart() {
    return window.BFSimulatorState && window.BFSimulatorState.collectSavedCart
      ? window.BFSimulatorState.collectSavedCart(projetoEstruturado.itens || [], { getEffectiveLanceEmbutidoMax })
      : [];
  }

  function findGroupForSavedItem(savedItem) {
    const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
    return window.BFSimulatorState && window.BFSimulatorState.findGroupForSavedItem
      ? window.BFSimulatorState.findGroupForSavedItem(savedItem, catalog)
      : savedItem.groupSnapshot || {};
  }

  function restoreCartItems(savedCart) {
    const catalog = (typeof ShelfCatalog !== 'undefined' && Array.isArray(ShelfCatalog)) ? ShelfCatalog : [];
    projetoEstruturado.itens = window.BFSimulatorState && window.BFSimulatorState.restoreSavedCartItems
      ? window.BFSimulatorState.restoreSavedCartItems(savedCart, {
        catalog,
        shelfEngine: typeof ShelfEngine !== 'undefined' ? ShelfEngine : null,
        getEffectiveLanceEmbutidoMax
      })
      : [];
    renderGruposSelecionados();
    renderStep5Cart();
    if (projetoEstruturado.itens.length) recalcularProjeto();
    atualizarBotaoAvancar();
    populateGroupSelects();
  }

  function restoreDynamicEvents(params) {
    if (!params) return;
    const adiantContainer = document.getElementById('adiantamentos-container');
    const inadContainer = document.getElementById('inadimplencias-container');
    if (adiantContainer) adiantContainer.innerHTML = '';
    if (inadContainer) inadContainer.innerHTML = '';

    (params.adiantamentos || []).forEach((row) => {
      addAdiantamentoRow();
      const el = document.querySelector('#adiantamentos-container .adiantamento-row:last-child');
      if (!el) return;
      const mes = el.querySelector('.adiant-mes');
      const valor = el.querySelector('.adiant-valor');
      const qtd = el.querySelector('.adiant-qtd');
      const tipo = el.querySelector('.adiant-tipo');
      if (mes) mes.value = row.mes || '';
      if (valor) valor.value = Format.number(row.valor || 0);
      if (qtd) qtd.value = row.qtdParcelas || 1;
      if (tipo) tipo.value = row.tipo || 'reduzir_saldo';
    });

    (params.inadimplencias || []).forEach((row) => {
      addInadimplenciaRow();
      const el = document.querySelector('#inadimplencias-container .inadimplencia-row:last-child');
      if (!el) return;
      const mes = el.querySelector('.inad-mes');
      const meses = el.querySelector('.inad-meses');
      const regularizar = el.querySelector('.inad-regularizar');
      const mesReg = el.querySelector('.inad-mes-reg');
      if (mes) mes.value = row.mesInicio || '';
      if (meses) meses.value = row.mesesAtraso || 1;
      if (regularizar) regularizar.checked = !!row.regularizar;
      if (mesReg) mesReg.value = row.mesRegularizacao || '';
    });
  }

  function getResumeStep(sim) {
    return window.BFSimulatorState && window.BFSimulatorState.resolveResumeStep
      ? window.BFSimulatorState.resolveResumeStep(sim)
      : 1;
  }

  function buildSimulationPayload(nome) {
    const params = getParams();
    const carrinho = collectSavedCart();
    const decisionContext = getDecisionContextSnapshot();
    return window.BFSimulatorState && window.BFSimulatorState.buildSimulationPayload
      ? window.BFSimulatorState.buildSimulationPayload({
        nome,
        currentStep,
        params,
        cart: carrinho,
        filters: getShelfFilters(),
        resultado,
        proposalAcceptance: getCurrentProposalAcceptance(),
        decisionContext,
        formSnapshot: collectFormSnapshot(),
        root: document
      })
      : { nome, origem: 'simulador-consorcio', currentStep, params, carrinho, resultado };
  }

  function salvarSimulacao() {
    if (typeof Storage === 'undefined') { showToast('Módulo de persistência não disponível.', 'error'); return; }

    const nome = prompt('Nome da simulação:', `Simulação ${new Date().toLocaleDateString('pt-BR')}`);
    if (!nome) return;

    const entry = Storage.saveSimulation(nome, buildSimulationPayload(nome));

    if (entry) {
      if (window.BFDecisionContext && typeof window.BFDecisionContext.recordSimulation === 'function') {
        window.BFDecisionContext.recordSimulation(entry);
      }
      renderSimulatorDecision();
      showToast(`Simulação "${nome}" salva com sucesso.`, 'success');
    } else {
      showToast('Erro ao salvar simulação.', 'error');
    }
  }

  function abrirCarregamento() {
    if (typeof Storage === 'undefined') { showToast('Módulo de persistência não disponível.', 'error'); return; }

    const list = Storage.loadSimulations();
    if (list.length === 0) {
      showToast('Nenhuma simulação salva encontrada.', 'info');
      return;
    }

    const modal = document.getElementById('shelf-detail-modal');
    const titleEl = document.getElementById('shelf-detail-title');
    const contentEl = document.getElementById('shelf-detail-content');

    if (titleEl) titleEl.textContent = 'Simulações Salvas';
    if (contentEl) {
      contentEl.innerHTML = `
        <div style="max-height:400px;overflow-y:auto;">
          ${list.map(s => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:12px 16px;border:1px solid var(--border-color);border-radius:8px;margin-bottom:8px;background:var(--gray-50);">
              <div>
                <strong>${s.nome}</strong>
                <div style="font-size:12px;color:var(--gray-500);margin-top:2px;">
                  ${s.consultor ? `Consultor: ${s.consultor} | ` : ''}
                  ${s.cliente ? `Cliente: ${s.cliente} | ` : ''}
                  ${s.totalGrupos} grupo(s) | ${Format.money(s.totalCarta)}
                </div>
                <div style="font-size:11px;color:var(--gray-400);margin-top:2px;">${new Date(s.criadoEm).toLocaleString('pt-BR')}</div>
              </div>
              <div style="display:flex;gap:6px;">
                <button class="btn btn--sm btn--primary" onclick="App._carregarSimulacao('${s.id}')">Abrir</button>
                <a class="btn btn--sm btn--ghost" href="carteira.html#simulacoes-salvas">Carteira</a>
                <button class="btn btn--sm btn--danger" onclick="App._excluirSimulacao('${s.id}')">Excluir</button>
              </div>
            </div>
          `).join('')}
        </div>
      `;
    }

    // Esconde o botão "Adicionar ao Projeto" no modal reaproveitado
    if (window.BFSimulatorShelf && window.BFSimulatorShelf.setDetailAddVisible) {
      window.BFSimulatorShelf.setDetailAddVisible(document, false);
    } else {
      const addBtn = modal?.querySelector('.shelf-detail-card > div:last-child button');
      if (addBtn) addBtn.style.display = 'none';
    }

    modal.style.display = 'flex';
  }

  function _carregarSimulacao(id) {
    const sim = Storage.loadSimulation(id);
    if (!sim) { showToast('Simulação não encontrada.', 'error'); return; }

    showToast(`Carregando "${sim.nome}"...`, 'info');
    const resumeModal = document.getElementById('shelf-detail-modal');
    if (resumeModal) resumeModal.style.display = 'none';

    // Restaurar dados do consultor/cliente
    applyFormSnapshot(sim.formSnapshot);
    const fallbackSet = (elId, val) => { const el = document.getElementById(elId); if (el && val && !el.value) el.value = val; };
    fallbackSet('consultor', sim.consultor);
    fallbackSet('nomeCliente', sim.cliente);
    restoreDynamicEvents(sim.params);
    if (typeof ShelfEngine !== 'undefined') {
      restoreCartItems(sim.carrinho || []);
    }

    currentParams = sim.params || getParams();
    resultado = sim.resultado && Array.isArray(sim.resultado.cronograma) ? sim.resultado : null;
    if (!resultado && currentParams && (sim.carrinho || []).length) {
      resultado = ConsorcioEngine.simular(currentParams);
      if (resultado && resultado.erro) resultado = null;
    }
    cenarios = currentParams ? ConsorcioEngine.compararCenarios(currentParams) : null;

    if (resultado) {
      renderResultados();
      renderTabela();
      renderProposta();
    }

    renderSimulatorDecision();
    goToStep(getResumeStep(sim), { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
    showToast(`Simulacao "${sim.nome}" restaurada com carrinho, parametros e resultado.`, 'success');
  }

  function carregarSimulacaoDaUrl() {
    if (typeof Storage === 'undefined') return;
    const params = new URLSearchParams(window.location.search);
    const id = params.get('simulationId') || params.get('simulacaoId');
    if (!id) return;
    window.setTimeout(() => _carregarSimulacao(id), 300);
  }

  function _excluirSimulacao(id) {
    if (!confirm('Tem certeza que deseja excluir esta simulação?')) return;
    Storage.deleteSimulation(id);
    renderSimulatorDecision();
    showToast('Simulação excluída.', 'warning');
    abrirCarregamento(); // Reabrir lista atualizada
  }

  // ─── API Pública ───
  return {
    init,
    goToStep,
    nextStep,
    prevStep,
    calcular,
    carregarExemplo,
    resetar,
    exportarPDF,
    imprimirProposta,
    renderProposta,
    renderProposalBuilderBoard,
    renderProposalVersionPanel,
    toggleProposalBuilderOption,
    setProposalBuilderGroup,
    setProposalBuilderAll,
    applyProposalBuilderPreset,
    salvarVersaoProposta,
    limparVersoesProposta,
    salvarRevisaoProposta,
    limparRevisaoProposta,
    criarHandoffProposta,
    addAdiantamentoRow,
    addInadimplenciaRow,
    showToast,
    applyConfiguredDefaults,
    renderSimulatorObjectiveGuide,
    applySimulatorObjectiveGuide,
    Format,
    // V2 — Comparador
    executarComparacao,
    onCompGrupoChange,
    // V3/V7 — Prateleira
    buscarGrupos,
    limparFiltros,
    explainGroupRecommendation,
    verDetalheGrupo,
    fecharDetalheGrupo,
    selecionarGrupoDoDetalhe,
    selecionarGrupo,
    // V7 — Paginação
    shelfPrevPage,
    shelfNextPage,
    shelfGoToPage,
    changeShelfPageSize,
    toggleShelfColumn,
    // V5 — Multi-Seleção / Sacola
    removerGrupoSelecionado,
    atualizarItemProjeto,
    onEditarItemProjeto,
    renderGruposSelecionados,
    renderStep5Cart,
    recalcularProjeto,
    simularProjetoEstruturado,
    // V7 — Persistência
    salvarSimulacao,
    abrirCarregamento,
    _carregarSimulacao,
    _excluirSimulacao
  };
})();

// Inicializar quando o DOM estiver pronto
document.addEventListener('DOMContentLoaded', App.init);
