import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const source = fs.readFileSync(path.join(root, 'js', 'group-operational-metrics.js'), 'utf8');
const failures = [];
const checks = [];

function check(condition, message) {
  checks.push({ message, ok: Boolean(condition) });
  if (!condition) failures.push(message);
}

function approximately(actual, expected, tolerance = 1e-12) {
  return typeof actual === 'number' && Math.abs(actual - expected) <= tolerance;
}

const browserWindow = {};
browserWindow.window = browserWindow;
const browserContext = vm.createContext({ window: browserWindow });
vm.runInContext(source, browserContext, { filename: 'group-operational-metrics.js' });

const api = browserWindow.BFGroupOperationalMetrics;
check(Boolean(api), 'Export global BFGroupOperationalMetrics disponível no contexto de navegador.');
check(Object.isFrozen(api), 'API global imutável.');
check(Object.isFrozen(api?.DEFINITIONS), 'Dicionário de métricas imutável.');

const descriptor = Object.getOwnPropertyDescriptor(browserWindow, 'BFGroupOperationalMetrics');
check(descriptor?.writable === false && descriptor?.configurable === false, 'Export global não gravável e não configurável.');
check(Reflect.set(browserWindow, 'BFGroupOperationalMetrics', {}) === false, 'Export global resiste a sobrescrita.');

const fixture = Object.freeze({
  groupKey: '00000776|202512|1|79',
  dataBase: 202512,
  qtdAtivasEmDia: 721,
  qtdContempladasNoMes: 5,
  qtdExcluidas: 900,
  qtdCreditoPendente: 0,
  indiceMaturidade: 1.25
});
const before = JSON.stringify(fixture);
const result = api.calculate(fixture);
const metrics = result.metrics;

check(JSON.stringify(fixture) === before, 'Cálculo não altera o snapshot de entrada.');
check(result.schema === 'bancus.group-operational-metrics.v1', 'Schema público versionado.');
check(result.groupKey === fixture.groupKey && result.competence === '202512', 'Identidade e competência preservadas.');
check(Object.isFrozen(result) && Object.isFrozen(metrics) && Object.isFrozen(metrics.monthlyContemplationsRelative.counts), 'Resultado e estruturas aninhadas imutáveis.');
check(Object.keys(metrics).length === 4, 'Motor retorna somente os quatro indicadores autorizados.');

const monthly = metrics.monthlyContemplationsRelative;
check(monthly.status === 'derived', 'Contemplação mensal marcada como derivada.');
check(monthly.counts.numerator.value === 5 && monthly.counts.numerator.status === 'observed', 'Numerador observado da contemplação preservado.');
check(monthly.counts.denominator.value === 721 && monthly.counts.denominator.status === 'observed', 'Denominador observado da contemplação preservado.');
check(approximately(monthly.percentage.value, (5 / 721) * 100), 'Percentual de contemplação mensal correto.');

const exclusion = metrics.historicalExclusionPressure;
check(exclusion.status === 'derived', 'Pressão histórica marcada como derivada.');
check(exclusion.percentage.value > 100, 'Pressão histórica pode superar 100% sem cap.');
check(approximately(exclusion.percentage.value, (900 / 721) * 100), 'Pressão histórica de exclusão correta.');

const pending = metrics.pendingCreditRelative;
check(pending.status === 'derived', 'Crédito pendente relativo marcado como derivado.');
check(pending.counts.numerator.value === 0 && pending.counts.numerator.status === 'observed', 'Zero real de crédito pendente preservado como observado.');
check(pending.percentage.value === 0, 'Zero real produz percentual zero.');

const maturity = metrics.observedMaturity;
check(maturity.status === 'observed' && maturity.observed.value === 1.25, 'Maturidade usa exclusivamente o valor observado.');
check(maturity.percentage.value === 125, 'Maturidade acima de 100% preservada sem cap.');
check(maturity.percentage.status === 'derived', 'Conversão do índice observado para percentual identificada como derivada.');

Object.values(metrics).forEach((metric) => {
  check(['observed', 'derived', 'unavailable'].includes(metric.status), `${metric.id}: status pertence ao vocabulário governado.`);
  check(typeof metric.definition === 'string' && metric.definition.length > 0, `${metric.id}: definição informada.`);
  check(typeof metric.formula === 'string' && metric.formula.length > 0, `${metric.id}: fórmula informada.`);
  check(metric.unit === 'percent', `${metric.id}: unidade percentual informada.`);
  check(metric.competence === '202512', `${metric.id}: competência informada.`);
  check(typeof metric.limitation === 'string' && metric.limitation.length > 0, `${metric.id}: limitação informada.`);
});

const nullSnapshot = api.calculate({
  dataBase: '202512',
  qtdAtivasEmDia: null,
  qtdContempladasNoMes: 0,
  qtdExcluidas: null,
  qtdCreditoPendente: 0,
  indiceMaturidade: null
});
const nullMonthly = nullSnapshot.metrics.monthlyContemplationsRelative;
check(nullMonthly.status === 'unavailable' && nullMonthly.percentage.value === null, 'Denominador nulo torna a razão indisponível.');
check(nullMonthly.counts.numerator.value === 0 && nullMonthly.counts.numerator.status === 'observed', 'Numerador zero não é confundido com nulo.');
check(nullMonthly.counts.denominator.value === null && nullMonthly.counts.denominator.status === 'unavailable', 'Denominador nulo permanece nulo.');
check(nullSnapshot.metrics.pendingCreditRelative.counts.numerator.value === 0, 'Zero real permanece zero quando outra entrada está ausente.');
check(nullSnapshot.metrics.observedMaturity.status === 'unavailable' && nullSnapshot.metrics.observedMaturity.percentage.value === null, 'Maturidade ausente não é convertida em zero.');

const zeroDenominator = api.calculate({
  dataBase: 202512,
  qtdAtivasEmDia: 0,
  qtdContempladasNoMes: 0,
  qtdExcluidas: 0,
  qtdCreditoPendente: 0,
  indiceMaturidade: 0
});
check(zeroDenominator.metrics.monthlyContemplationsRelative.status === 'unavailable', 'Razão 0/0 não é inventada.');
check(zeroDenominator.metrics.monthlyContemplationsRelative.unavailableReason === 'denominator_zero', 'Denominador zero possui motivo explícito.');
check(zeroDenominator.metrics.observedMaturity.status === 'observed' && zeroDenominator.metrics.observedMaturity.percentage.value === 0, 'Maturidade zero observada permanece zero.');

const noCompetence = api.calculate({
  qtdAtivasEmDia: 100,
  qtdContempladasNoMes: 2,
  qtdExcluidas: 5,
  qtdCreditoPendente: 1,
  indiceMaturidade: 2.4
});
check(Object.values(noCompetence.metrics).every((metric) => metric.status === 'unavailable'), 'Sem competência, nenhum indicador é calculado.');
check(Object.values(noCompetence.metrics).every((metric) => metric.unavailableReason === 'competence_missing'), 'Ausência de competência é explicitada.');

const invalid = api.calculate({
  competencia: '2025-12',
  qtdAtivasEmDia: 10,
  qtdContempladasNoMes: -1,
  qtdExcluidas: Number.NaN,
  qtdCreditoPendente: '0',
  indiceMaturidade: Number.POSITIVE_INFINITY
});
check(invalid.metrics.monthlyContemplationsRelative.status === 'unavailable', 'Contagem negativa é rejeitada.');
check(invalid.metrics.historicalExclusionPressure.status === 'unavailable', 'NaN é rejeitado.');
check(invalid.metrics.pendingCreditRelative.status === 'unavailable', 'String numérica não é tratada silenciosamente como observação.');
check(invalid.metrics.observedMaturity.status === 'unavailable', 'Maturidade infinita é rejeitada.');

const forbiddenKeys = ['cashFlow', 'cashGeneration', 'liquidity', 'coverage', 'probability', 'futureEvents'];
const serializedKeys = new Set();
(function collectKeys(value) {
  if (!value || typeof value !== 'object') return;
  Object.keys(value).forEach((key) => {
    serializedKeys.add(key);
    collectKeys(value[key]);
  });
})(result);
check(forbiddenKeys.every((key) => !serializedKeys.has(key)), 'Saída não contém métricas de caixa, liquidez, cobertura, probabilidade ou eventos futuros.');

const nodeContext = vm.createContext({});
vm.runInContext(source, nodeContext, { filename: 'group-operational-metrics.js' });
const nodeApi = vm.runInContext('globalThis.BFGroupOperationalMetrics', nodeContext);
check(Boolean(nodeApi) && typeof nodeApi.calculate === 'function', 'Módulo compatível com VM Node sem window.');
check(nodeApi.calculate({ dataBase: 202512, qtdAtivasEmDia: 10, qtdContempladasNoMes: 1, qtdExcluidas: 2, qtdCreditoPendente: 0, indiceMaturidade: 1.5 }).metrics.observedMaturity.percentage.value === 150, 'Cálculo funciona no contexto VM Node.');

const report = {
  ok: failures.length === 0,
  schema: api?.SCHEMA || null,
  checks: checks.length,
  metrics: Object.keys(metrics || {}),
  sample: {
    monthlyContemplationsPercentage: monthly?.percentage?.value ?? null,
    historicalExclusionPressurePercentage: exclusion?.percentage?.value ?? null,
    pendingCreditPercentage: pending?.percentage?.value ?? null,
    observedMaturityPercentage: maturity?.percentage?.value ?? null
  },
  failures
};

fs.mkdirSync(path.join(root, 'docs', 'test-reports'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'docs', 'test-reports', 'group-operational-metrics-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
