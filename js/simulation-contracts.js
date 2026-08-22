/**
 * Contratos públicos do motor mensal de consórcio (v2).
 *
 * O arquivo é opcional no navegador: engine.js possui um fallback mínimo para
 * preservar as páginas legadas. Quando carregado antes do motor, estes helpers
 * são reutilizados e também podem ser consumidos por validadores Node/vm.
 */
(function exposeSimulationContracts(root, factory) {
  const api = factory();
  if (root) root.BFSimulationContracts = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function buildSimulationContracts() {
  'use strict';

  const VERSION = '2.0.0';
  const SCHEMA = 'bancus.simulation.v2';

  const POLITICA = Object.freeze({
    A: 'carta',
    B: 'carta_mais_custos'
  });

  const ADIANTAMENTO_TIPO = Object.freeze({
    REDUZIR_SALDO: 'reduzir_saldo',
    REDUZIR_PRAZO: 'reduzir_prazo'
  });

  const MODALIDADES_LANCE = Object.freeze([
    'sem_lance',
    'livre',
    'fixo',
    'embutido',
    'fgts',
    'combinado'
  ]);

  const MONEY_FIELDS = Object.freeze([
    'saldoAnterior',
    'saldoAjustado',
    'saldoFinal',
    'saldoTotalAnterior',
    'saldoTotalAjustado',
    'saldoTotalFinal',
    'saldoPrincipalAnterior',
    'saldoPrincipalFinal',
    'saldoCustosAnterior',
    'saldoCustosFinal',
    'saldoEmAtrasoFinal',
    'saldoPoliticaAnterior',
    'saldoPoliticaFinal',
    'parcelaBase',
    'parcelaReduzida',
    'componenteTaxaAdm',
    'componenteFundoReserva',
    'componenteSeguro',
    'parcelaTotal',
    'parcelaDevida',
    'valorLance',
    'valorLanceCaixa',
    'lanceExcedente',
    'valorAdiantado',
    'valorRegularizado',
    'regularizacaoSolicitada',
    'multa',
    'juros',
    'multaPaga',
    'jurosPago',
    'amortizacaoParcela',
    'amortizacaoTotal',
    'valorPago',
    'caixaPago',
    'reajusteValor'
  ]);

  function numberOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : fallback;
  }

  function integerOr(value, fallback = 0) {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? Math.trunc(parsed) : fallback;
  }

  function toCents(value) {
    const parsed = numberOr(value, 0);
    const epsilon = Math.sign(parsed || 1) * Number.EPSILON;
    return Math.round((parsed + epsilon) * 100);
  }

  function fromCents(value) {
    return Math.round(numberOr(value, 0)) / 100;
  }

  function roundMoney(value) {
    return fromCents(toCents(value));
  }

  function rateFromPercent(value) {
    return numberOr(value, 0) / 100;
  }

  function isCentRounded(value) {
    const parsed = Number(value);
    return Number.isFinite(parsed) && Math.abs(parsed * 100 - Math.round(parsed * 100)) < 1e-7;
  }

  function normalizeParams(rawParams) {
    const source = rawParams && typeof rawParams === 'object' ? rawParams : {};
    const prazoTotal = Math.max(0, integerOr(source.prazoTotal, 0));
    const defaultMonth = prazoTotal > 0 ? Math.min(12, prazoTotal) : 1;
    // Compatibilidade com projetos salvos antes de o motor adotar "livre"
    // como identificador canônico do lance com recurso próprio.
    const modalidadeLance = source.modalidadeLance === 'proprio'
      ? 'livre'
      : (source.modalidadeLance || 'combinado');

    return {
      ...source,
      valorCarta: numberOr(source.valorCarta, 0),
      prazoTotal,
      taxaAdm: numberOr(source.taxaAdm, 0),
      fundoReserva: numberOr(source.fundoReserva, 0),
      seguro: numberOr(source.seguro, 0),
      seguroTipo: source.seguroTipo || 'percentual',
      tipoIndice: source.tipoIndice || 'fixo',
      indiceReajuste: numberOr(source.indiceReajuste, 0),
      mesAdesao: Math.max(1, integerOr(source.mesAdesao, 1)),
      mesAniversario: Math.max(1, integerOr(source.mesAniversario, defaultMonth)),
      mesContemplacao: Math.max(1, integerOr(source.mesContemplacao, defaultMonth)),
      lanceProprio: numberOr(source.lanceProprio, 0),
      lanceEmbutido: numberOr(source.lanceEmbutido, 0),
      lanceFixo: numberOr(source.lanceFixo, 0),
      usarFGTS: Boolean(source.usarFGTS),
      valorFGTS: numberOr(source.valorFGTS, 0),
      modalidadeLance,
      parcelaReduzida: Boolean(source.parcelaReduzida),
      percentualReducao: numberOr(source.percentualReducao, 0),
      politicaSaldo: source.politicaSaldo || POLITICA.A,
      adiantamentos: Array.isArray(source.adiantamentos)
        ? source.adiantamentos.map((item) => ({ ...item }))
        : [],
      inadimplencias: Array.isArray(source.inadimplencias)
        ? source.inadimplencias.map((item) => ({ ...item }))
        : [],
      multaAtraso: numberOr(source.multaAtraso, 0),
      jurosAtraso: numberOr(source.jurosAtraso, 0)
    };
  }

  function validateScheduleInvariants(schedule) {
    const failures = [];
    const rows = Array.isArray(schedule) ? schedule : [];

    rows.forEach((row, index) => {
      const label = `Mês ${row && row.mes ? row.mes : index + 1}`;
      MONEY_FIELDS.forEach((field) => {
        if (row && Object.prototype.hasOwnProperty.call(row, field) && !isCentRounded(row[field])) {
          failures.push(`${label}: ${field} não está arredondado em centavos.`);
        }
      });

      const opening = toCents(row && row.saldoTotalAnterior);
      const adjustment = toCents(row && row.reajusteValor);
      const lance = toCents(row && row.valorLance);
      const advance = toCents(row && row.valorAdiantado);
      const amortization = toCents(row && row.amortizacaoTotal);
      const closing = toCents(row && row.saldoTotalFinal);
      if (opening + adjustment - lance - advance - amortization !== closing) {
        failures.push(`${label}: identidade do saldo não fecha.`);
      }

      const installmentCash = toCents(row && row.parcelaTotal);
      const bidCash = toCents(row && row.valorLanceCaixa);
      const totalCash = toCents(row && row.caixaPago);
      if (installmentCash + bidCash + advance !== totalCash) {
        failures.push(`${label}: identidade do caixa não fecha.`);
      }

      if (row && Array.isArray(row.eventos) && row.eventos.includes('inadimplência')) {
        if (toCents(row.parcelaTotal) !== 0 || toCents(row.valorPago) !== 0 || toCents(row.caixaPago) !== 0) {
          failures.push(`${label}: linha inadimplente registra caixa pago.`);
        }
      }

      if (closing < 0) failures.push(`${label}: saldo final negativo.`);
      if (amortization < 0) failures.push(`${label}: amortização negativa.`);
    });

    return { valido: failures.length === 0, mensagens: failures };
  }

  return Object.freeze({
    VERSION,
    SCHEMA,
    POLITICA,
    ADIANTAMENTO_TIPO,
    MODALIDADES_LANCE,
    MONEY_FIELDS,
    numberOr,
    integerOr,
    toCents,
    fromCents,
    roundMoney,
    rateFromPercent,
    isCentRounded,
    normalizeParams,
    validateScheduleInvariants
  });
});
