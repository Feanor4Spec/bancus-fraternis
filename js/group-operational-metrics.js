/**
 * Motor puro de métricas operacionais do snapshot mensal de um grupo.
 *
 * Escopo deliberadamente limitado aos quatro indicadores aprovados no
 * dicionário da Visão 360. O módulo não estima fluxo financeiro, liquidez,
 * cobertura, probabilidade de contemplação ou eventos futuros.
 */
(function exposeGroupOperationalMetrics(root) {
  'use strict';

  const SCHEMA = 'bancus.group-operational-metrics.v1';
  const VERSION = '1.0.0';

  function deepFreeze(value) {
    if (!value || (typeof value !== 'object' && typeof value !== 'function') || Object.isFrozen(value)) {
      return value;
    }
    Object.keys(value).forEach((key) => deepFreeze(value[key]));
    return Object.freeze(value);
  }

  const DEFINITIONS = deepFreeze({
    monthlyContemplationsRelative: {
      id: 'monthly-contemplations-relative',
      label: 'Contemplações do mês em relação às cotas ativas em dia',
      definition: 'Quantidade de cotas contempladas na competência dividida pela quantidade de cotas ativas em dia na mesma competência.',
      formula: 'qtdContempladasNoMes / qtdAtivasEmDia × 100',
      unit: 'percent',
      numeratorField: 'qtdContempladasNoMes',
      denominatorField: 'qtdAtivasEmDia',
      limitation: 'Fotografia da competência. Não representa chance, probabilidade ou garantia de contemplação e não projeta eventos futuros.'
    },
    historicalExclusionPressure: {
      id: 'historical-exclusion-pressure',
      label: 'Pressão histórica de exclusão',
      definition: 'Estoque acumulado de cotas excluídas dividido pelo estoque atual de cotas ativas em dia.',
      formula: 'qtdExcluidas / qtdAtivasEmDia × 100',
      unit: 'percent',
      numeratorField: 'qtdExcluidas',
      denominatorField: 'qtdAtivasEmDia',
      limitation: 'Compara um estoque histórico acumulado ao estoque ativo atual. Pode superar 100%, não é taxa mensal e não deve ser apresentado como indicador oficial do Banco Central.'
    },
    pendingCreditRelative: {
      id: 'pending-credit-relative',
      label: 'Crédito pendente relativo',
      definition: 'Quantidade de cotas ativas com crédito pendente de utilização dividida pela quantidade de cotas ativas em dia.',
      formula: 'qtdCreditoPendente / qtdAtivasEmDia × 100',
      unit: 'percent',
      numeratorField: 'qtdCreditoPendente',
      denominatorField: 'qtdAtivasEmDia',
      limitation: 'Indica utilização pendente do crédito contemplado. Não mede insolvência, disponibilidade de caixa, liquidez ou cobertura financeira.'
    },
    observedMaturity: {
      id: 'observed-maturity',
      label: 'Maturidade observada',
      definition: 'Índice de maturidade informado no snapshot do grupo, preservado sem limitação superior.',
      formula: 'percentual exibido = indiceMaturidade observado × 100',
      unit: 'percent',
      observedField: 'indiceMaturidade',
      limitation: 'Campo observado convertido em percentual apenas para exibição. Valores acima de 100% são preservados e não estimam prazo restante ou resultado futuro.'
    }
  });

  function hasValue(value) {
    return value !== null && value !== undefined && value !== '';
  }

  function readNonNegativeNumber(snapshot, field) {
    const raw = snapshot && typeof snapshot === 'object' ? snapshot[field] : null;
    if (!hasValue(raw) || typeof raw !== 'number' || !Number.isFinite(raw) || raw < 0) return null;
    return raw;
  }

  function readCompetence(snapshot) {
    if (!snapshot || typeof snapshot !== 'object') return null;
    const raw = hasValue(snapshot.dataBase) ? snapshot.dataBase : snapshot.competencia;
    if (!hasValue(raw)) return null;
    const normalized = String(raw).trim();
    return normalized || null;
  }

  function observedCount(field, value) {
    return deepFreeze({
      field,
      value,
      unit: 'quota',
      status: value === null ? 'unavailable' : 'observed'
    });
  }

  function ratioUnavailabilityReason(competence, numerator, denominator) {
    if (competence === null) return 'competence_missing';
    if (numerator === null) return 'numerator_unavailable';
    if (denominator === null) return 'denominator_unavailable';
    if (denominator === 0) return 'denominator_zero';
    return null;
  }

  function buildRatioMetric(definition, snapshot, competence) {
    const numerator = readNonNegativeNumber(snapshot, definition.numeratorField);
    const denominator = readNonNegativeNumber(snapshot, definition.denominatorField);
    const unavailableReason = ratioUnavailabilityReason(competence, numerator, denominator);
    const status = unavailableReason === null ? 'derived' : 'unavailable';

    return deepFreeze({
      id: definition.id,
      label: definition.label,
      status,
      counts: {
        numerator: observedCount(definition.numeratorField, numerator),
        denominator: observedCount(definition.denominatorField, denominator)
      },
      percentage: {
        value: status === 'derived' ? (numerator / denominator) * 100 : null,
        unit: definition.unit,
        status
      },
      definition: definition.definition,
      formula: definition.formula,
      unit: definition.unit,
      competence,
      limitation: definition.limitation,
      unavailableReason
    });
  }

  function buildMaturityMetric(definition, snapshot, competence) {
    const observedValue = readNonNegativeNumber(snapshot, definition.observedField);
    const unavailableReason = competence === null
      ? 'competence_missing'
      : observedValue === null ? 'observed_value_unavailable' : null;
    const status = unavailableReason === null ? 'observed' : 'unavailable';

    return deepFreeze({
      id: definition.id,
      label: definition.label,
      status,
      observed: {
        field: definition.observedField,
        value: observedValue,
        unit: 'ratio',
        status: observedValue === null ? 'unavailable' : 'observed'
      },
      percentage: {
        value: status === 'observed' ? observedValue * 100 : null,
        unit: definition.unit,
        status: status === 'observed' ? 'derived' : 'unavailable'
      },
      definition: definition.definition,
      formula: definition.formula,
      unit: definition.unit,
      competence,
      limitation: definition.limitation,
      unavailableReason
    });
  }

  function calculate(snapshot) {
    const source = snapshot && typeof snapshot === 'object' ? snapshot : {};
    const competence = readCompetence(source);

    return deepFreeze({
      schema: SCHEMA,
      version: VERSION,
      groupKey: hasValue(source.groupKey) ? String(source.groupKey) : null,
      competence,
      metrics: {
        monthlyContemplationsRelative: buildRatioMetric(DEFINITIONS.monthlyContemplationsRelative, source, competence),
        historicalExclusionPressure: buildRatioMetric(DEFINITIONS.historicalExclusionPressure, source, competence),
        pendingCreditRelative: buildRatioMetric(DEFINITIONS.pendingCreditRelative, source, competence),
        observedMaturity: buildMaturityMetric(DEFINITIONS.observedMaturity, source, competence)
      }
    });
  }

  const api = deepFreeze({ SCHEMA, VERSION, DEFINITIONS, calculate });

  if (!Object.prototype.hasOwnProperty.call(root, 'BFGroupOperationalMetrics')) {
    Object.defineProperty(root, 'BFGroupOperationalMetrics', {
      value: api,
      enumerable: true,
      configurable: false,
      writable: false
    });
  }
})(typeof window !== 'undefined' ? window : globalThis);
