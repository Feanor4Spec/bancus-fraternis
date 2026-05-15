import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  simulatorHtml,
  appJs,
  journeyJs,
  stateJs,
  resultJs,
  v8Css,
  contracts,
  plan,
  map
] = await Promise.all([
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/simulator-journey.js'),
  read('js/simulator-state.js'),
  read('js/simulator-result.js'),
  read('assets/css/bf-design-system-v8.css'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md')
]);

const journeyIndex = simulatorHtml.indexOf('../js/simulator-journey.js');
const stateIndex = simulatorHtml.indexOf('../js/simulator-state.js');
const resultIndex = simulatorHtml.indexOf('../js/simulator-result.js');
const appIndex = simulatorHtml.indexOf('../js/app.js');

assert(journeyIndex > -1, 'simulador.html nao carrega js/simulator-journey.js.');
assert(stateIndex > -1, 'simulador.html nao carrega js/simulator-state.js.');
assert(resultIndex > -1, 'simulador.html nao carrega js/simulator-result.js.');
assert(appIndex > -1, 'simulador.html nao carrega js/app.js.');
assert(journeyIndex < appIndex, 'simulator-journey.js deve carregar antes de app.js.');
assert(stateIndex < appIndex, 'simulator-state.js deve carregar antes de app.js.');
assert(resultIndex < appIndex, 'simulator-result.js deve carregar antes de app.js.');
assert(appJs.includes('BFSimulatorJourney'), 'app.js nao delega contexto/jornada para BFSimulatorJourney.');
assert(appJs.includes('BFSimulatorState'), 'app.js nao delega snapshots para BFSimulatorState.');
assert(appJs.includes('BFSimulatorResult'), 'app.js nao delega calculo/resultado para BFSimulatorResult.');
assert(appJs.includes('data-simulator-journey-actions'), 'app.js nao renderiza data-simulator-journey-actions.');
assert(simulatorHtml.includes('data-simulator-objective-guide'), 'simulador.html sem guia de objetivo para filtros.');
assert(appJs.includes('applySimulatorObjectiveGuide'), 'app.js sem acao de aplicar filtros guiados por objetivo.');
assert(v8Css.includes('[data-simulator-journey-actions]'), 'CSS v8 nao estiliza data-simulator-journey-actions.');

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(journeyJs, context, { filename: 'simulator-journey.js' });
vm.runInContext(stateJs, context, { filename: 'simulator-state.js' });
vm.runInContext(resultJs, context, { filename: 'simulator-result.js' });

const journey = context.window.BFSimulatorJourney;
const state = context.window.BFSimulatorState;
const result = context.window.BFSimulatorResult;

assert(journey && typeof journey.getDecisionContextSnapshot === 'function', 'BFSimulatorJourney.getDecisionContextSnapshot indisponivel.');
assert(journey && typeof journey.buildPrefillPlan === 'function', 'BFSimulatorJourney.buildPrefillPlan indisponivel.');
assert(journey && typeof journey.buildObjectiveGuidance === 'function', 'BFSimulatorJourney.buildObjectiveGuidance indisponivel.');
assert(journey && typeof journey.buildJourneyActions === 'function', 'BFSimulatorJourney.buildJourneyActions indisponivel.');
assert(state && typeof state.collectSavedCart === 'function', 'BFSimulatorState.collectSavedCart indisponivel.');
assert(state && typeof state.restoreSavedCartItems === 'function', 'BFSimulatorState.restoreSavedCartItems indisponivel.');
assert(state && typeof state.buildSimulationPayload === 'function', 'BFSimulatorState.buildSimulationPayload indisponivel.');
assert(result && typeof result.calculate === 'function', 'BFSimulatorResult.calculate indisponivel.');
assert(result && typeof result.renderSummary === 'function', 'BFSimulatorResult.renderSummary indisponivel.');
assert(result && typeof result.renderProposal === 'function', 'BFSimulatorResult.renderProposal indisponivel.');
assert(result && typeof result.renderAnalyticalTable === 'function', 'BFSimulatorResult.renderAnalyticalTable indisponivel.');

const decisionContext = journey.getDecisionContextSnapshot({
  buildSimulationPrefill: () => ({
    source: 'calculator',
    calculatorSlug: 'capacidade-credito',
    historyId: 'H1',
    readinessScore: 80,
    profileSnapshot: { rendaMensal: 12000 },
    prefill: {
      valorAlvo: 300000,
      lanceProprioSugeridoPct: 18.2,
      clienteObjetivo: 'comprar bem',
      observacoes: 'Origem calculadora'
    },
    readiness: { score: 80, complete: true, missing: [], message: 'Pronto para simular.' }
  })
});
const prefillPlan = journey.buildPrefillPlan(decisionContext);
const objectiveGuide = journey.buildObjectiveGuidance({
  objective: 'trocar_veiculo',
  context: decisionContext
});
const completeActions = journey.buildJourneyActions({
  dataStatus: { loaded: true },
  hasCart: true,
  hasResult: true,
  decisionContext,
  readiness: decisionContext.readiness,
  shelfCount: 12
});
const emptyActions = journey.buildJourneyActions({
  dataStatus: { loaded: true },
  hasCart: false,
  hasResult: false,
  decisionContext,
  readiness: decisionContext.readiness,
  shelfCount: 12
});
assert(prefillPlan.some((item) => item.id === 'valorCarta' && item.value === 300000), 'Plano de prefill nao preserva valor alvo.');
assert(prefillPlan.some((item) => item.id === 'compLanceProprio'), 'Plano de prefill nao preserva lance sugerido.');
assert(objectiveGuide.objective === 'troca', 'Guia de objetivo nao normalizou trocar_veiculo.');
assert(objectiveGuide.filters.filtroProduto === '3', 'Guia de troca deveria sugerir segmento de automoveis.');
assert(Number(objectiveGuide.filters.filtroCartaMin) > 0, 'Guia de objetivo deveria herdar carta alvo do contexto.');
assert(completeActions.some((item) => item.action === 'salvarSimulacao'), 'Acoes de jornada nao sugerem salvar cenario apos resultado.');
assert(emptyActions.some((item) => item.action === 'goToStep:4'), 'Acoes de jornada nao direcionam para prateleira quando ha grupos filtrados.');

const calculation = result.calculate({ valorCarta: 200000 }, {
  engine: {
    simular: (params) => ({
      resumo: { cartaLiquida: Number(params.valorCarta || 0) },
      cronograma: [{
        mes: 1,
        parcelaTotal: 1200,
        saldoAnterior: 200000,
        indiceAplicado: 0,
        saldoAjustado: 200000,
        valorLance: 0,
        valorAdiantado: 0,
        multa: 0,
        juros: 0,
        saldoFinal: 198800,
        prazoRestante: 99,
        evento: 'normal'
      }]
    }),
    compararCenarios: () => ({ base: true })
  }
});
assert(calculation.ok && calculation.resultado.resumo.cartaLiquida === 200000, 'BFSimulatorResult.calculate nao retornou resultado valido.');
assert(calculation.cenarios && calculation.cenarios.base, 'BFSimulatorResult.calculate nao preservou cenarios comparativos.');

let summaryRendered = false;
context.window.ProposalSummary = {
  render: (container, payload, options) => {
    summaryRendered = Boolean(container && payload && payload.resultado && options && options.surface);
    container.innerHTML = '<section data-rendered-summary></section>';
  }
};
const summaryContainer = { innerHTML: '' };
result.renderSummary(summaryContainer, {
  params: { valorCarta: 200000 },
  resultado: calculation.resultado,
  cenarios: calculation.cenarios,
  project: { itens: [] },
  decisionContext
}, { surface: 'summary' });
assert(summaryRendered && summaryContainer.innerHTML.includes('data-rendered-summary'), 'BFSimulatorResult.renderSummary nao delegou para ProposalSummary.');

const tableBody = { innerHTML: '' };
const fakeTableRoot = {
  getElementById: (id) => {
    if (id === 'tabela-body') return tableBody;
    if (id === 'tabelaDetalhada') return { checked: true };
    return null;
  },
  querySelectorAll: () => []
};
const tableRendered = result.renderAnalyticalTable(fakeTableRoot, { resultado: calculation.resultado }, {
  formatMoney: (value) => `R$ ${Number(value || 0)}`
});
assert(tableRendered && tableBody.innerHTML.includes('badge--normal'), 'BFSimulatorResult.renderAnalyticalTable nao renderizou cronograma.');

const fields = {
  nomeCliente: { id: 'nomeCliente', type: 'text', value: 'Cliente Local', tagName: 'INPUT' },
  usarFGTS: { id: 'usarFGTS', type: 'checkbox', checked: true, tagName: 'INPUT' }
};
const fakeRoot = {
  querySelectorAll: () => Object.values(fields),
  getElementById: (id) => fields[id] || null
};
const formSnapshot = state.collectFormSnapshot(fakeRoot);
state.applyFormSnapshot({
  nomeCliente: { value: 'Cliente Restaurado' },
  usarFGTS: { value: false }
}, fakeRoot);
assert(formSnapshot.nomeCliente.value === 'Cliente Local', 'Snapshot de formulario perdeu valor textual.');
assert(formSnapshot.usarFGTS.value === true, 'Snapshot de formulario perdeu checkbox.');
assert(fields.nomeCliente.value === 'Cliente Restaurado', 'applyFormSnapshot nao restaurou texto.');
assert(fields.usarFGTS.checked === false, 'applyFormSnapshot nao restaurou checkbox.');

const savedCart = state.collectSavedCart([{
  itemId: 'ITEM-1',
  groupKey: 'G-1',
  codigoGrupo: '001',
  codigoSegmento: 'AUTO',
  administradora: 'Admin A',
  nomeSegmento: 'Auto',
  iconSegmento: 'A',
  quantidadeCotas: 2,
  valorCartaRef: 100000,
  valorCartaUnitario: 100000,
  valorCartaTotal: 200000,
  prazoMeses: 80,
  taxaAdmPct: 15,
  fundoReservaPct: 2,
  indiceCorrecaoNome: 'IPCA',
  lanceProprioPct: 10,
  lanceEmbutidoPct: 35,
  _group: { groupKey: 'G-1', codigoGrupo: '001', lanceEmbutidoMaxPct: 30 }
}], {
  getEffectiveLanceEmbutidoMax: () => 25
});
const restored = state.restoreSavedCartItems(savedCart, {
  catalog: [{ groupKey: 'G-1', codigoGrupo: '001', valorCartaRef: 100000, lanceEmbutidoMaxPct: 25 }],
  getEffectiveLanceEmbutidoMax: () => 25,
  shelfEngine: {
    createProjectItem: (group, qtd, carta) => ({
      itemId: 'RESTORED-1',
      groupKey: group.groupKey,
      codigoGrupo: group.codigoGrupo,
      quantidadeCotas: qtd,
      valorCartaUnitario: carta,
      valorCartaTotal: carta * qtd,
      prazoMeses: 80,
      taxaAdmPct: 15,
      fundoReservaPct: 2,
      mesContemplacaoAlvo: 12
    })
  }
});
assert(savedCart[0].groupSnapshot.lanceEmbutidoMaxPct === 25, 'Carrinho salvo nao guarda limite efetivo do grupo.');
assert(restored.length === 1 && restored[0].lanceEmbutidoPct === 25, 'Carrinho restaurado nao limita lance embutido pelo grupo.');

const payload = state.buildSimulationPayload({
  nome: 'Simulacao QA',
  currentStep: 7,
  params: { valorCarta: 200000, nomeCliente: 'Cliente Local' },
  cart: savedCart,
  filters: { admin: 'Admin A' },
  resultado: { resumo: { cartaLiquida: 180000 }, cronograma: [] },
  proposalAcceptance: { status: 'reviewed' },
  decisionContext,
  formSnapshot,
  root: fakeRoot
});
assert(payload.origem === 'simulador-consorcio', 'Payload salvo perdeu origem publica.');
assert(payload.totalCarta === 200000, 'Payload salvo perdeu total de carta.');
assert(payload.decisionContext.calculatorSlug === 'capacidade-credito', 'Payload salvo perdeu origem da calculadora.');
assert(state.resolveResumeStep(payload) === 7, 'resolveResumeStep deveria retomar em resultados quando ha cronograma.');

[
  'BFSimulatorJourney',
  'BFSimulatorState',
  'BFSimulatorResult',
  'data-simulator-journey-actions',
  'tools/validate-simulator-refactor.mjs'
].forEach((contract) => {
  assert(contracts.includes(contract), `Contratos publicos sem ${contract}.`);
  assert(plan.includes(contract) || map.includes(contract), `Mapa/plano sem ${contract}.`);
});

const report = {
  ok: failures.length === 0,
  modules: {
    journey: true,
    state: true,
    result: true,
    scriptOrder: journeyIndex < appIndex && stateIndex < appIndex && resultIndex < appIndex,
    appDelegates: appJs.includes('BFSimulatorJourney') && appJs.includes('BFSimulatorState') && appJs.includes('BFSimulatorResult')
  },
  journeyActions: {
    complete: completeActions.length,
    empty: emptyActions.length,
    objective: objectiveGuide.objective
  },
  savedCartItems: savedCart.length,
  restoredCartItems: restored.length,
  resultRows: calculation.resultado.cronograma.length,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-refactor-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
