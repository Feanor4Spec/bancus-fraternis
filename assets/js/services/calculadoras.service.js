(function () {
  'use strict';

  const PROFILE_KEY = 'bf_financial_profile_v1';
  const HISTORY_KEY = 'bf_calculator_history_v1';
  const PREMISES_OVERRIDE_KEY = 'bf_calculator_premissas_override_v1';
  const MAX_HISTORY = 80;
  const cache = {};

  function root() {
    return location.pathname.includes('/pages/') ? '../' : '';
  }

  function money(value) {
    return window.BFFormatters ? window.BFFormatters.currency(value) : `R$ ${Number(value || 0).toFixed(2)}`;
  }

  function percent(value, digits = 2) {
    return window.BFFormatters ? window.BFFormatters.percent(value, digits) : `${Number(value || 0).toFixed(digits)}%`;
  }

  function months(value) {
    return window.BFFormatters ? window.BFFormatters.months(value) : `${Math.round(Number(value || 0))} meses`;
  }

  function safeStorage() {
    try {
      return typeof localStorage !== 'undefined' ? localStorage : null;
    } catch (error) {
      return null;
    }
  }

  async function json(name) {
    const path = `${root()}assets/data/${name}.json`;
    if (cache[path]) return cache[path];
    const response = await fetch(path);
    if (!response.ok) throw new Error(`Nao foi possivel carregar ${path}`);
    cache[path] = await response.json();
    return cache[path];
  }

  async function catalog() {
    return json('calculadoras');
  }

  async function premissas() {
    const base = await json('calculadoras-premissas');
    return deepMerge(base, loadPremissasOverride());
  }

  async function basePremissas() {
    return json('calculadoras-premissas');
  }

  async function calculator(slug) {
    const list = await catalog();
    return list.find((item) => item.slug === slug) || null;
  }

  function normalizeInput(input) {
    const out = {};
    Object.keys(input || {}).forEach((key) => {
      const value = input[key];
      if (typeof value === 'string' && value.trim() !== '' && !Number.isNaN(Number(value))) {
        out[key] = Number(value);
      } else {
        out[key] = value;
      }
    });
    return out;
  }

  function loadProfile() {
    const storage = safeStorage();
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(PROFILE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function saveProfile(patch) {
    const storage = safeStorage();
    if (!storage) return loadProfile();
    const next = {
      ...loadProfile(),
      ...(patch || {}),
      updatedAt: new Date().toISOString()
    };
    storage.setItem(PROFILE_KEY, JSON.stringify(next));
    return next;
  }

  function loadHistory() {
    const storage = safeStorage();
    if (!storage) return [];
    try {
      const parsed = JSON.parse(storage.getItem(HISTORY_KEY) || '[]');
      return Array.isArray(parsed) ? parsed : [];
    } catch (error) {
      return [];
    }
  }

  function deepMerge(base, override) {
    const output = Array.isArray(base) ? [...base] : { ...(base || {}) };
    Object.keys(override || {}).forEach((key) => {
      const value = override[key];
      if (value && typeof value === 'object' && !Array.isArray(value) && !(value instanceof Date)) {
        output[key] = deepMerge(output[key] || {}, value);
      } else {
        output[key] = value;
      }
    });
    return output;
  }

  function loadPremissasOverride() {
    const storage = safeStorage();
    if (!storage) return {};
    try {
      return JSON.parse(storage.getItem(PREMISES_OVERRIDE_KEY) || '{}') || {};
    } catch (error) {
      return {};
    }
  }

  function savePremissasOverride(patch) {
    const storage = safeStorage();
    if (!storage) return loadPremissasOverride();
    const next = deepMerge(loadPremissasOverride(), {
      ...(patch || {}),
      overrideUpdatedAt: new Date().toISOString()
    });
    storage.setItem(PREMISES_OVERRIDE_KEY, JSON.stringify(next));
    return next;
  }

  function clearPremissasOverride() {
    const storage = safeStorage();
    if (!storage) return {};
    storage.removeItem(PREMISES_OVERRIDE_KEY);
    return {};
  }

  function saveHistory(entry) {
    const storage = safeStorage();
    if (!storage) return loadHistory();
    const list = loadHistory();
    const saved = {
      id: `CALC-${Date.now().toString(36).toUpperCase()}`,
      createdAt: new Date().toISOString(),
      ...entry
    };
    list.unshift(saved);
    storage.setItem(HISTORY_KEY, JSON.stringify(list.slice(0, MAX_HISTORY)));
    return saved;
  }

  function profileDefaults(meta) {
    const profile = loadProfile();
    const defaults = {};
    (meta.fields || []).forEach((field) => {
      defaults[field.name] = field.default;
    });

    if ('rendaLiquida' in defaults && profile.rendaMensal) defaults.rendaLiquida = profile.rendaMensal;
    if ('rendaMensal' in defaults && profile.rendaMensal) defaults.rendaMensal = profile.rendaMensal;
    if ('salarioLiquido' in defaults && profile.rendaMensal) defaults.salarioLiquido = profile.rendaMensal;
    if ('gastoMensal' in defaults && profile.gastoMensal) defaults.gastoMensal = profile.gastoMensal;
    if ('dividasMensais' in defaults && profile.dividasMensais) defaults.dividasMensais = profile.dividasMensais;
    if ('reservaAtual' in defaults && profile.reservaAtual) defaults.reservaAtual = profile.reservaAtual;
    if ('capacidadePagamento' in defaults && profile.capacidadePagamento) defaults.capacidadePagamento = profile.capacidadePagamento;
    if ('valorCarta' in defaults && (profile.valorCarta || profile.valorCredito)) defaults.valorCarta = profile.valorCarta || profile.valorCredito;
    if ('valorCredito' in defaults && (profile.valorCredito || profile.valorCarta)) defaults.valorCredito = profile.valorCredito || profile.valorCarta;
    if ('lanceDesejadoPct' in defaults && profile.lanceProprioSugeridoPct) defaults.lanceDesejadoPct = Math.round(profile.lanceProprioSugeridoPct);
    if ('aporteMensal' in defaults && profile.capacidadeAporte) defaults.aporteMensal = Math.max(0, Math.round(profile.capacidadeAporte));
    if ('taxaOportunidadeMes' in defaults && profile.taxaOportunidadeMes) defaults.taxaOportunidadeMes = profile.taxaOportunidadeMes;
    if ('valorInicial' in defaults && profile.patrimonioEstimado) defaults.valorInicial = profile.patrimonioEstimado;
    if ('patrimonioAtual' in defaults && profile.patrimonioEstimado) defaults.patrimonioAtual = profile.patrimonioEstimado;
    if ('patrimonioInicial' in defaults && profile.patrimonioEstimado) defaults.patrimonioInicial = profile.patrimonioEstimado;
    if ('uf' in defaults && profile.uf) defaults.uf = profile.uf;

    return defaults;
  }

  function metric(label, value, tone) {
    return { label, value, tone: tone || '' };
  }

  function recommendation(title, message, tone, next) {
    return { title, message, tone: tone || 'info', next: next || 'Salvar cenario e comparar alternativas.' };
  }

  function compareRecommendation(good, bad, goodLabel, badLabel) {
    const diff = Math.abs(good - bad);
    if (good >= bad) return recommendation('Melhor alternativa calculada', `${goodLabel} supera ${badLabel} por ${money(diff)} neste cenario.`, 'success', 'Revise liquidez, prazo e risco antes de decidir.');
    return recommendation('Atencao ao custo de oportunidade', `${badLabel} supera ${goodLabel} por ${money(diff)} neste cenario.`, 'warn', 'Compare uma segunda premissa antes de fechar a decisao.');
  }

  function scoreReadiness(profile) {
    const reservaPct = Math.min(100, Number(profile.coberturaReservaPct || 0));
    const sobra = Number(profile.capacidadeAporte || 0);
    const renda = Number(profile.rendaMensal || 1);
    const comprometimento = Number(profile.comprometimentoRenda || 0);
    return Math.max(0, Math.min(100, Math.round(reservaPct * 0.45 + Math.max(0, sobra / renda * 100) * 1.5 + Math.max(0, 100 - comprometimento) * 0.25)));
  }

  function baseResult(slug, nome, input) {
    return {
      slug,
      nome,
      input,
      metrics: [],
      memory: [],
      recommendation: null,
      profilePatch: {},
      rows: [],
      disclaimer: 'Simulacao educativa com premissas locais. Nao representa oferta, aprovacao de credito ou recomendacao individual de investimento.'
    };
  }

  async function simulate(slug, rawInput, options = {}) {
    const f = window.BFFinancialFormulas;
    const meta = await calculator(slug);
    const data = await premissas();
    if (!meta) throw new Error(`Calculadora nao encontrada: ${slug}`);
    const input = normalizeInput({ ...profileDefaults(meta), ...(rawInput || {}) });
    const result = baseResult(slug, meta.nome, input);

    switch (slug) {
      case 'juros-compostos': {
        const total = f.compoundFutureValue(input.valorInicial, input.aporteMensal, input.taxaAnual, input.prazoMeses);
        const investido = Number(input.valorInicial || 0) + Number(input.aporteMensal || 0) * Number(input.prazoMeses || 0);
        result.metrics = [metric('Patrimonio projetado', money(total), 'strong'), metric('Total investido', money(investido)), metric('Juros acumulados', money(total - investido))];
        result.memory = [`Taxa anual convertida para taxa mensal equivalente.`, `${months(input.prazoMeses)} com aporte mensal de ${money(input.aporteMensal)}.`];
        result.profilePatch = { patrimonioEstimado: total, capacidadeAporte: Number(input.aporteMensal || 0) };
        result.recommendation = recommendation('Plano de acumulacao criado', `Mantendo ${money(input.aporteMensal)} por mes, o patrimonio projetado e ${money(total)}.`, 'success', 'Compare com Primeiro Milhao ou Aposentadoria.');
        break;
      }
      case 'juros-simples': {
        const calc = f.simpleInterest(input.capital, input.taxaPeriodo, input.periodos);
        result.metrics = [metric('Montante', money(calc.montante), 'strong'), metric('Juros', money(calc.juros)), metric('Taxa aplicada', percent(input.taxaPeriodo))];
        result.memory = [`Juros = capital x taxa x periodos.`, `Montante = capital + juros.`];
        result.recommendation = recommendation('Conceito entendido', 'Use esta leitura para comparar com produtos que usam capitalizacao composta.', 'info', 'Abra Pix Parcelado ou CDB para ver formulas mais proximas de produtos reais.');
        break;
      }
      case 'primeiro-milhao': {
        const tempo = f.monthsToGoal(input.meta, input.valorInicial, input.aporteMensal, input.taxaAnual, 960);
        const aporteNecessario = f.requiredPayment(input.meta, input.valorInicial, input.taxaAnual, input.prazoMeses);
        result.metrics = [metric('Prazo estimado', tempo === null ? 'Acima de 80 anos' : months(tempo), 'strong'), metric('Aporte para prazo informado', money(aporteNecessario)), metric('Meta', money(input.meta))];
        result.memory = [`A calculadora testa mes a mes quando o saldo atinge a meta.`, `Tambem calcula aporte necessario para ${months(input.prazoMeses)}.`];
        result.profilePatch = { objetivoPrincipal: 'primeiro-milhao', metaPatrimonial: Number(input.meta || 0), capacidadeAporte: Number(input.aporteMensal || 0) };
        result.recommendation = recommendation('Meta patrimonial monitorada', tempo && tempo <= 360 ? 'A meta parece alcancavel no horizonte de longo prazo.' : 'A meta exige aumento de aporte, prazo maior ou retorno superior.', tempo && tempo <= 360 ? 'success' : 'warn', 'Simule Custos Fixos para descobrir aumento realista de aporte.');
        break;
      }
      case 'aposentadoria': {
        const mesesAte = Math.max(1, (Number(input.idadeAlvo || 0) - Number(input.idadeAtual || 0)) * 12);
        const futuro = f.compoundFutureValue(input.patrimonioAtual, input.aporteMensal, input.taxaAnual, mesesAte);
        const aporteNecessario = f.requiredPayment(input.patrimonioDesejado, input.patrimonioAtual, input.taxaAnual, mesesAte);
        const gap = futuro - Number(input.patrimonioDesejado || 0);
        result.metrics = [metric('Patrimonio projetado', money(futuro), 'strong'), metric('Aporte necessario', money(aporteNecessario)), metric('Gap da meta', money(gap))];
        result.memory = [`Horizonte calculado: ${months(mesesAte)}.`, `Patrimonio desejado: ${money(input.patrimonioDesejado)}.`];
        result.profilePatch = { objetivoPrincipal: 'aposentadoria', patrimonioEstimado: futuro, capacidadeAporte: Number(input.aporteMensal || 0) };
        result.recommendation = recommendation(gap >= 0 ? 'Aposentadoria no trilho' : 'Ajuste de aposentadoria necessario', gap >= 0 ? 'O aporte atual supera a meta informada.' : `Faltam ${money(Math.abs(gap))} na projecao base.`, gap >= 0 ? 'success' : 'warn', 'Teste a Calculadora de Renda para validar a retirada mensal futura.');
        break;
      }
      case 'renda': {
        const saldo = f.withdrawalFutureValue(input.patrimonioInicial, input.retiradaMensal, input.taxaAnual, input.prazoMeses);
        result.metrics = [metric('Saldo final', money(saldo), saldo >= 0 ? 'strong' : 'warn'), metric('Total retirado', money(Number(input.retiradaMensal || 0) * Number(input.prazoMeses || 0))), metric('Prazo', months(input.prazoMeses))];
        result.memory = [`Patrimonio rende mensalmente e sofre retirada no mesmo horizonte.`, `A simulacao nao desconta inflacao nem impostos especificos.`];
        result.profilePatch = { patrimonioEstimado: Number(input.patrimonioInicial || 0), rendaDesejada: Number(input.retiradaMensal || 0) };
        result.recommendation = recommendation(saldo >= 0 ? 'Retirada sustentavel no cenario' : 'Risco de exaustao', saldo >= 0 ? `O saldo permanece em ${money(saldo)}.` : 'A retirada supera o patrimonio projetado no periodo.', saldo >= 0 ? 'success' : 'warn', 'Compare com Aposentadoria e uma taxa mais conservadora.');
        break;
      }
      case 'reserva-emergencia': {
        const calc = f.emergency(input.gastoMensal, input.mesesCobertura, input.reservaAtual);
        result.metrics = [metric('Reserva ideal', money(calc.ideal), 'strong'), metric('Gap atual', money(calc.gap), calc.gap > 0 ? 'warn' : 'success'), metric('Meses cobertos', `${calc.mesesAtuais.toFixed(1)} meses`)];
        result.memory = [`Reserva ideal = gasto mensal x meses de cobertura.`, `Cobertura atual: ${percent(calc.coberturaPct)}.`];
        result.profilePatch = { gastoMensal: Number(input.gastoMensal || 0), reservaAtual: Number(input.reservaAtual || 0), reservaIdeal: calc.ideal, coberturaReservaPct: calc.coberturaPct };
        result.recommendation = recommendation(calc.gap > 0 ? 'Complete a reserva antes de assumir risco' : 'Reserva adequada no cenario', calc.gap > 0 ? `Faltam ${money(calc.gap)} para a meta.` : 'Voce ja cobre a reserva informada.', calc.gap > 0 ? 'warn' : 'success', 'Compare Poupanca x Selic ou Renda Fixa para alocar caixa conservador.');
        break;
      }
      case 'poupanca-selic': {
        const calc = f.savingsVsSelic(input);
        result.metrics = [metric('Poupanca', money(calc.poupanca)), metric('Selic referencia', money(calc.selic), 'strong'), metric('Diferenca', money(calc.diferenca), calc.diferenca >= 0 ? 'success' : 'warn')];
        result.memory = [`Poupanca mensal estimada: ${percent(calc.poupancaMes)}.`, `Selic mensal equivalente: ${percent(calc.selicMes)}.`];
        result.profilePatch = { taxaOportunidadeMes: calc.selicMes };
        result.recommendation = compareRecommendation(calc.selic, calc.poupanca, 'Selic referencia', 'Poupanca');
        break;
      }
      case 'renda-fixa': {
        const a = f.fixedIncomeReturn({ valor: input.valor, prazoDias: input.prazoDias, indexador: input.produtoAIndexador, taxa: input.produtoATaxa, cdiAnual: input.cdiAnual, ipcaAnual: input.ipcaAnual }, data);
        const b = f.fixedIncomeReturn({ valor: input.valor, prazoDias: input.prazoDias, indexador: input.produtoBIndexador, taxa: input.produtoBTaxa, cdiAnual: input.cdiAnual, ipcaAnual: input.ipcaAnual }, data);
        const winner = a.liquid >= b.liquid ? 'Produto A' : 'Produto B';
        result.metrics = [metric('Produto A liquido', money(a.liquid), winner === 'Produto A' ? 'strong' : ''), metric('Produto B liquido', money(b.liquid), winner === 'Produto B' ? 'strong' : ''), metric('Vencedor', winner, 'strong')];
        result.memory = [`Produto A taxa anual estimada: ${percent(a.annualRate)}.`, `Produto B taxa anual estimada: ${percent(b.annualRate)}.`, `IR estimado conforme prazo de ${input.prazoDias} dias.`];
        result.profilePatch = { taxaOportunidadeMes: f.annualToMonthly(Math.max(a.annualRate, b.annualRate)) * 100 };
        result.recommendation = compareRecommendation(Math.max(a.liquid, b.liquid), Math.min(a.liquid, b.liquid), winner, winner === 'Produto A' ? 'Produto B' : 'Produto A');
        result.rows = [
          { label: 'Produto A', total: a.liquid, bruto: a.gross, imposto: a.imposto, taxa: a.annualRate },
          { label: 'Produto B', total: b.liquid, bruto: b.gross, imposto: b.imposto, taxa: b.annualRate }
        ];
        break;
      }
      case 'compra-vista-parcelado': {
        const precoVista = Number(input.precoCheio || 0) * (1 - Number(input.descontoVista || 0) / 100);
        const vpParcelas = f.presentValueOfPayments(input.valorParcela, input.parcelas, input.taxaOportunidadeMes);
        const totalParcelado = Number(input.valorParcela || 0) * Number(input.parcelas || 0);
        const rendaMensal = Number(input.rendaMensal || 0);
        const gastoMensal = Number(input.gastoMensal || 0);
        const reservaAtual = Number(input.reservaAtual || 0);
        const reservaIdeal = gastoMensal * 6;
        const caixaAposVista = reservaAtual - precoVista;
        const gapReservaAposVista = Math.max(0, reservaIdeal - Math.max(0, caixaAposVista));
        const mesesReservaAposVista = gastoMensal > 0 ? Math.max(0, caixaAposVista) / gastoMensal : 0;
        const parcelaPctRenda = rendaMensal > 0 ? Number(input.valorParcela || 0) / rendaMensal * 100 : 0;
        const diferencaValorPresente = vpParcelas - precoVista;
        const prioridade = String(input.prioridadeCompra || 'equilibrio').toLowerCase().replace(/\s+/g, '-');
        let melhor = precoVista <= vpParcelas ? 'Pagar a vista' : 'Parcelar';
        let message = melhor === 'Pagar a vista'
          ? 'O desconto supera o valor financeiro de preservar caixa neste cenario.'
          : 'O valor presente das parcelas e menor que o preco a vista.';
        let tone = melhor === 'Pagar a vista' ? 'success' : 'info';

        if (prioridade === 'preservar-caixa' && caixaAposVista < reservaIdeal) {
          melhor = 'Parcelar';
          message = 'Preservar caixa ganhou prioridade porque o pagamento a vista deixaria a reserva abaixo de seis meses de custos.';
          tone = 'info';
        }

        if (prioridade === 'menor-custo' && precoVista <= totalParcelado && precoVista <= vpParcelas) {
          melhor = 'Pagar a vista';
          message = 'Menor custo foi priorizado e o desconto a vista vence tanto no nominal quanto no valor presente.';
          tone = 'success';
        }

        if (caixaAposVista < 0 && parcelaPctRenda > 8) {
          melhor = 'Rever compra';
          message = 'A vista consome mais caixa do que a reserva atual e a parcela pesa na renda. Recalibre valor, prazo ou espere recompor caixa.';
          tone = 'warn';
        }

        result.metrics = [
          metric('Decisao sugerida', melhor, tone === 'success' ? 'strong' : tone),
          metric('Preco a vista', money(precoVista), melhor === 'Pagar a vista' ? 'strong' : ''),
          metric('VP parcelado', money(vpParcelas), melhor === 'Parcelar' ? 'strong' : ''),
          metric('Reserva apos vista', money(caixaAposVista), caixaAposVista < reservaIdeal ? 'warn' : 'success'),
          metric('Parcela/renda', percent(parcelaPctRenda), parcelaPctRenda > 8 ? 'warn' : ''),
          metric('Diferenca VP', money(diferencaValorPresente), diferencaValorPresente >= 0 ? 'success' : '')
        ];
        result.memory = [
          `Preco a vista = preco cheio menos desconto informado: ${money(precoVista)}.`,
          `Valor presente das parcelas = ${money(vpParcelas)}, descontado por ${percent(input.taxaOportunidadeMes)} ao mes.`,
          `Reserva apos pagamento a vista: ${money(caixaAposVista)}; cobertura estimada: ${mesesReservaAposVista.toFixed(1)} meses.`,
          `Parcela representa ${percent(parcelaPctRenda)} da renda mensal informada.`
        ];
        result.rows = [
          { alternativa: 'Pagar a vista', custo: money(precoVista), 'valor presente': money(precoVista), 'impacto no caixa': money(caixaAposVista), leitura: caixaAposVista < reservaIdeal ? 'Pressiona reserva' : 'Reserva preservada' },
          { alternativa: 'Parcelar', custo: money(totalParcelado), 'valor presente': money(vpParcelas), 'impacto no caixa': money(Number(input.valorParcela || 0)), leitura: parcelaPctRenda > 8 ? 'Parcela pesada' : 'Fluxo controlado' }
        ];
        result.profilePatch = {
          taxaOportunidadeMes: Number(input.taxaOportunidadeMes || 0),
          rendaMensal,
          gastoMensal,
          reservaAtual,
          reservaIdeal,
          parcelaConsumo: Number(input.valorParcela || 0),
          ultimaDecisaoCompra: melhor
        };
        result.recommendation = recommendation(melhor, message, tone, gapReservaAposVista > 0 ? `Antes de decidir, considere recompor ${money(gapReservaAposVista)} de reserva.` : 'Compare com Pix Parcelado, Renda Fixa e Reserva de Emergencia.');
        break;
      }
      case 'capacidade-credito': {
        const calc = f.creditCapacity(input);
        result.metrics = [
          metric('Parcela segura', money(calc.parcelaSegura), calc.parcelaSegura > 0 ? 'strong' : 'warn'),
          metric('Folga mensal', money(calc.folgaMensal), calc.folgaMensal > 0 ? 'success' : 'warn'),
          metric('Comprometimento projetado', percent(calc.comprometimentoProjetado), calc.comprometimentoProjetado > Number(input.comprometimentoMaximo || 30) ? 'warn' : ''),
          metric('Meses de reserva', `${calc.mesesReserva.toFixed(1)} meses`, calc.reservaOk ? 'success' : 'warn'),
          metric('Risco', calc.risco, calc.risco === 'baixo' ? 'success' : 'warn')
        ];
        result.memory = [
          `Folga mensal = renda menos gastos e dividas: ${money(calc.folgaMensal)}.`,
          `Parcela segura usa o menor valor entre teto de comprometimento e margem de fluxo.`,
          `Reserva atual cobre ${calc.mesesReserva.toFixed(1)} meses de custos.`
        ];
        result.profilePatch = {
          rendaMensal: calc.renda,
          gastoMensal: calc.gastoMensal,
          dividasMensais: calc.dividasMensais,
          reservaAtual: calc.reservaAtual,
          capacidadeAporte: calc.folgaMensal,
          capacidadePagamento: calc.parcelaSegura,
          comprometimentoRenda: calc.comprometimentoAtual,
          comprometimentoProjetado: calc.comprometimentoProjetado,
          readinessScore: Math.round(calc.score)
        };
        result.rows = [
          { label: 'Teto por renda', total: calc.tetoComprometimento, taxa: Number(input.comprometimentoMaximo || 30), leitura: 'Limite por comprometimento' },
          { label: 'Teto por fluxo', total: calc.tetoFluxo, taxa: Number(input.margemFluxo || 60), leitura: 'Limite por folga mensal' },
          { label: 'Parcela segura', total: calc.parcelaSegura, taxa: calc.comprometimentoProjetado, leitura: calc.risco }
        ];
        result.recommendation = recommendation(
          calc.parcelaSegura > 0 ? 'Capacidade segura estimada' : 'Credito ainda nao recomendado',
          calc.parcelaSegura > 0 ? `Use ate ${money(calc.parcelaSegura)} como referencia de parcela.` : 'Reduza custos ou recomponha reserva antes de assumir nova parcela.',
          calc.risco === 'baixo' ? 'success' : 'warn',
          'Abra Lance em Consorcio ou siga para o simulador com esta capacidade.'
        );
        break;
      }
      case 'lance-consorcio': {
        const calc = f.consortiumBidCapacity(input);
        result.metrics = [
          metric('Lance seguro', money(calc.lanceSeguroValor), calc.lanceSeguroValor > 0 ? 'strong' : 'warn'),
          metric('Percentual seguro', percent(calc.lanceSeguroPct), calc.lanceSeguroPct > 0 ? 'success' : ''),
          metric('Reserva apos lance', money(calc.reservaAposLance), calc.lanceDesejadoSustentavel ? 'success' : 'warn'),
          metric('Meses apos lance', `${calc.mesesReservaAposLance.toFixed(1)} meses`, calc.lanceDesejadoSustentavel ? 'success' : 'warn'),
          metric('Parcela referencia', money(calc.parcelaReferencia))
        ];
        result.memory = [
          `Reserva minima preservada: ${money(calc.reservaMinima)}.`,
          `Caixa disponivel para lance proprio: ${money(calc.caixaDisponivel)}.`,
          `Lance desejado consome ${percent(calc.impactoReservaPct)} da reserva atual.`
        ];
        result.profilePatch = {
          valorCredito: calc.valorCarta,
          valorCarta: calc.valorCarta,
          reservaAtual: calc.reservaAtual,
          gastoMensal: calc.gastoMensal,
          capacidadePagamento: calc.capacidadePagamento || calc.parcelaReferencia,
          lanceProprioSugerido: calc.lanceSeguroValor,
          lanceProprioSugeridoPct: calc.lanceSeguroPct,
          lanceSeguroPct: calc.lanceSeguroPct,
          parcelaProjetada: calc.parcelaReferencia,
          readinessScore: Math.round(calc.score)
        };
        result.rows = [
          { label: 'Lance desejado', total: calc.lanceDesejadoValor, taxa: Number(input.lanceDesejadoPct || 0), leitura: calc.lanceDesejadoSustentavel ? 'Sustentavel' : 'Pressiona reserva' },
          { label: 'Lance seguro', total: calc.lanceSeguroValor, taxa: calc.lanceSeguroPct, leitura: 'Limite recomendado' },
          { label: 'Reserva preservada', total: calc.reservaAposLance, taxa: calc.mesesReservaAposLance, leitura: 'Meses de custos' }
        ];
        result.recommendation = recommendation(
          calc.lanceDesejadoSustentavel ? 'Lance sustentavel' : 'Ajuste o lance proprio',
          calc.lanceDesejadoSustentavel ? 'O lance desejado preserva a reserva minima informada.' : `Use como teto ${money(calc.lanceSeguroValor)} para preservar liquidez.`,
          calc.lanceDesejadoSustentavel ? 'success' : 'warn',
          'Leve este lance para o simulador de consorcio.'
        );
        break;
      }
      case 'pix-parcelado': {
        const parcela = f.pricePayment(input.valor, input.taxaMes, input.prazo);
        const total = parcela * Number(input.prazo || 0);
        const juros = total - Number(input.valor || 0);
        result.metrics = [metric('Parcela estimada', money(parcela), 'strong'), metric('Total pago', money(total)), metric('Juros estimados', money(juros), juros > 0 ? 'warn' : '')];
        result.memory = [`Tabela Price aplicada ao valor do Pix.`, `Taxa mensal: ${percent(input.taxaMes)} por ${months(input.prazo)}.`];
        result.profilePatch = { parcelasCredito: parcela };
        result.rows = f.priceSchedule(input.valor, input.taxaMes, input.prazo).slice(0, 12);
        result.recommendation = recommendation('Custo financeiro explicito', `O parcelamento adiciona ${money(juros)} de juros estimados.`, juros > 0 ? 'warn' : 'success', 'Compare com Compra a Vista ou Parcelado e confira sua reserva.');
        break;
      }
      case 'alugar-financiar': {
        const principal = Math.max(0, Number(input.valorImovel || 0) - Number(input.entrada || 0));
        const parcela = f.pricePayment(principal, input.taxaFinanciamentoMes, input.prazoMeses);
        const totalFin = parcela * Number(input.prazoMeses || 0) + Number(input.entrada || 0);
        const valorImovelFuturo = Number(input.valorImovel || 0) * Math.pow(1 + Number(input.valorizacaoAno || 0) / 100, Number(input.prazoMeses || 0) / 12);
        const investimentoAluguel = f.futureValueMonthly(input.entrada, Math.max(0, parcela - Number(input.aluguel || 0)), input.taxaInvestimentoMes, input.prazoMeses);
        const vencedor = valorImovelFuturo >= investimentoAluguel ? 'Financiar' : 'Alugar e investir';
        result.metrics = [metric('Parcela financiamento', money(parcela), 'strong'), metric('Patrimonio financiando', money(valorImovelFuturo)), metric('Patrimonio alugando', money(investimentoAluguel))];
        result.memory = [`Principal financiado: ${money(principal)}.`, `A diferenca entre parcela e aluguel e investida no cenario de aluguel.`];
        result.profilePatch = { objetivoPrincipal: 'imovel', parcelasCredito: parcela };
        result.recommendation = recommendation(vencedor, vencedor === 'Financiar' ? 'O valor futuro do imovel supera a estrategia de aluguel no cenario informado.' : 'Investir a entrada e a diferenca supera o valor futuro do imovel no cenario informado.', 'info', 'Teste taxas conservadoras e custos reais antes de decidir.');
        break;
      }
      case 'cartoes': {
        const cards = data.cartoes || [];
        const ranked = cards.map((card) => {
          const eligible = Number(input.rendaMensal || 0) >= Number(card.rendaMinima || 0);
          const spendFit = Math.min(35, Number(input.gastoCartao || 0) / Math.max(1, Number(card.gastoIdeal || 1)) * 25);
          const pref = card.preferencia === input.preferencia ? 35 : 10;
          const fee = Number(card.anuidade || 0) === 0 ? 15 : 5;
          return { ...card, score: Math.round((eligible ? 25 : -20) + spendFit + pref + fee) };
        }).sort((a, b) => b.score - a.score);
        const best = ranked[0];
        result.metrics = [metric('Cartao sugerido', best.nome, 'strong'), metric('Score', `${best.score}/100`), metric('Anuidade', money(best.anuidade))];
        result.memory = [`Score considera renda minima, gasto, preferencia e anuidade.`, `Catalogo demonstrativo local, sem aprovacao garantida.`];
        result.rows = ranked.map((card) => ({ label: card.nome, total: card.score, beneficio: card.beneficio, taxa: card.anuidade }));
        result.profilePatch = { rendaMensal: Number(input.rendaMensal || 0), gastoCartao: Number(input.gastoCartao || 0) };
        result.recommendation = recommendation('Shortlist criada', `${best.nome} parece o melhor encaixe demonstrativo para ${input.preferencia}.`, 'info', 'Confira custos, limite e risco de rotativo antes de contratar.');
        break;
      }
      case 'realidade-brasileira': {
        const faixa = (data.rendaFaixas || []).find((item) => item.uf === input.uf) || (data.rendaFaixas || [])[0];
        const pct = f.percentileForIncome(input.salarioLiquido, faixa);
        result.metrics = [metric('Percentil estimado', `${Math.round(pct)}%`, 'strong'), metric('Mediana local', money(faixa.p50)), metric('P90 local', money(faixa.p90))];
        result.memory = [`Comparacao feita com faixas locais demonstrativas para ${faixa.uf}.`, `Quanto maior o percentil, maior a renda relativa na base.`];
        result.profilePatch = { rendaMensal: Number(input.salarioLiquido || 0), uf: input.uf };
        result.recommendation = recommendation('Contexto financeiro criado', `Sua renda aparece proxima do percentil ${Math.round(pct)} na base demonstrativa.`, 'info', 'Use Custos Fixos para transformar renda em capacidade de aporte ou parcela.');
        break;
      }
      case 'rentabilidade': {
        const returns = (data.carteirasDemo && data.carteirasDemo[input.perfilCarteira]) || [];
        let balance = Number(input.valorInicial || 0);
        const rows = [];
        for (let year = 1; year <= Math.max(1, Number(input.anos || 1)); year += 1) {
          const r = Number(returns[(year - 1) % returns.length] || 0);
          balance = f.futureValueMonthly(balance, Number(input.aporteMensal || 0), r / 12, 12);
          rows.push({ label: `Ano ${year}`, total: balance, taxa: r });
        }
        const investido = Number(input.valorInicial || 0) + Number(input.aporteMensal || 0) * 12 * Number(input.anos || 0);
        result.metrics = [metric('Saldo simulado', money(balance), 'strong'), metric('Total investido', money(investido)), metric('Resultado', money(balance - investido))];
        result.memory = [`Usa retornos anuais demonstrativos da carteira ${input.perfilCarteira}.`, `Aportes mensais sao capitalizados dentro de cada ano.`];
        result.rows = rows;
        result.profilePatch = { patrimonioEstimado: balance, capacidadeAporte: Number(input.aporteMensal || 0) };
        result.recommendation = recommendation('Cenario historico demonstrativo', 'Use este modulo como educacao de risco, nao como previsao.', 'info', 'Compare com Renda Fixa e Acoes para entender alternativas.');
        break;
      }
      case 'acoes': {
        const selected = [input.ativoA, input.ativoB, input.ativoC];
        const assets = (data.ativosDemo || []).filter((asset) => selected.includes(asset.ticker));
        const score = (asset) => {
          if (input.criterio === 'retorno') return asset.retornoAnual;
          if (input.criterio === 'dividendos') return asset.dy * 2;
          if (input.criterio === 'risco') return 30 - asset.volatilidade;
          return asset.retornoAnual + asset.dy - asset.volatilidade / 3;
        };
        const ranked = assets.map((asset) => ({ ...asset, score: Math.round(score(asset) * 10) / 10 })).sort((a, b) => b.score - a.score);
        const best = ranked[0] || {};
        result.metrics = [metric('Ativo destaque', best.ticker || '-', 'strong'), metric('Score', best.score || 0), metric('DY', percent(best.dy || 0))];
        result.memory = [`Score demonstrativo por criterio: ${input.criterio}.`, `Nao e recomendacao de compra ou venda.`];
        result.rows = ranked.map((asset) => ({ label: asset.ticker, total: asset.score, beneficio: asset.nome, taxa: asset.retornoAnual }));
        result.recommendation = recommendation('Comparacao educativa', `${best.ticker || 'O ativo'} lidera pelo criterio escolhido, mas dados sao demonstrativos.`, 'info', 'Para recomendacao real, aplicar suitability e dados de mercado oficiais.');
        break;
      }
      case 'cdb': {
        const calc = f.fixedIncomeReturn({ valor: input.valor, prazoDias: input.prazoDias, indexador: 'cdi', taxa: input.percentualCdi, cdiAnual: input.cdiAnual }, data);
        result.metrics = [metric('Valor liquido', money(calc.liquid), 'strong'), metric('Rendimento bruto', money(calc.lucroBruto)), metric('IR estimado', money(calc.imposto))];
        result.memory = [`Taxa anual equivalente: ${percent(calc.annualRate)}.`, `IR regressivo aplicado conforme prazo de ${input.prazoDias} dias.`];
        result.profilePatch = { taxaOportunidadeMes: f.annualToMonthly(calc.annualRate) * 100 };
        result.recommendation = recommendation('CDB calculado', `O retorno liquido estimado e ${money(calc.liquid)}.`, 'success', 'Compare com Poupanca x Selic e Renda Fixa.');
        break;
      }
      case 'custos-fixos': {
        const calc = f.fixedCosts(input);
        result.metrics = [metric('Sobra mensal', money(calc.sobra), calc.sobra >= 0 ? 'strong' : 'warn'), metric('Comprometimento', percent(calc.comprometimento), calc.comprometimento >= 60 ? 'warn' : ''), metric('Faixa', calc.faixa)];
        result.memory = [`Custos fixos somados e divididos pela renda liquida.`, `Sobra mensal vira capacidade potencial de aporte ou pagamento.`];
        result.profilePatch = { rendaMensal: calc.renda, gastoMensal: calc.totalCustos, capacidadeAporte: Math.max(0, calc.sobra), capacidadePagamento: Math.max(0, calc.sobra * 0.35), comprometimentoRenda: calc.comprometimento, dividasMensais: Number(input.dividas || 0), readinessScore: scoreReadiness({ ...loadProfile(), rendaMensal: calc.renda, capacidadeAporte: Math.max(0, calc.sobra), comprometimentoRenda: calc.comprometimento }) };
        result.recommendation = recommendation(calc.comprometimento >= 60 ? 'Orcamento pressionado' : 'Capacidade financeira identificada', calc.comprometimento >= 60 ? 'Evite novas parcelas antes de reduzir custos ou dividas.' : `Ha ${money(Math.max(0, calc.sobra))} de sobra potencial para metas.`, calc.comprometimento >= 60 ? 'warn' : 'success', 'Abra Reserva de Emergencia para definir a primeira meta.');
        break;
      }
      default:
        throw new Error(`Simulacao nao implementada: ${slug}`);
    }

    result.readinessScore = scoreReadiness({ ...loadProfile(), ...result.profilePatch });
    if (options.persist !== false) {
      saveProfile(result.profilePatch);
      if (window.BFDecisionContext && typeof window.BFDecisionContext.saveProfilePatch === 'function') {
        window.BFDecisionContext.saveProfilePatch(result.profilePatch, `calculator:${slug}`);
      }
      const savedHistory = saveHistory({
        calculatorSlug: slug,
        calculatorName: meta.nome,
        input,
        metrics: result.metrics,
        recommendation: result.recommendation,
        profilePatch: result.profilePatch,
        readinessScore: result.readinessScore
      });
      if (savedHistory && savedHistory.id) result.historyId = savedHistory.id;
      if (window.BFDecisionContext && typeof window.BFDecisionContext.recordEvent === 'function') {
        window.BFDecisionContext.recordEvent('calculator-simulated', {
          calculatorSlug: slug,
          historyId: result.historyId,
          readinessScore: result.readinessScore
        });
      }
    }
    return result;
  }

  window.BFCalculadoras = {
    catalog,
    premissas,
    basePremissas,
    calculator,
    simulate,
    loadProfile,
    saveProfile,
    loadHistory,
    saveHistory,
    profileDefaults,
    loadPremissasOverride,
    savePremissasOverride,
    clearPremissasOverride
  };
})();
