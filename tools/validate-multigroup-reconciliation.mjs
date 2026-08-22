import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function equalMoney(actual, expected, message) {
  assert(cents(actual) === cents(expected), `${message}: esperado ${expected}, recebido ${actual}.`);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const sources = await Promise.all([
  read('js/simulation-contracts.js'),
  read('js/engine.js'),
  read('js/comparator.js'),
  read('js/shelf-engine.js'),
  read('js/simulator-cart.js'),
  read('js/simulator-result.js'),
  read('js/proposal-summary.js')
]);

const context = {
  console,
  Date,
  Intl,
  Math,
  Number,
  Object,
  Array,
  Set,
  Map,
  JSON,
  Promise,
  setTimeout: () => 0,
  clearTimeout: () => {},
  location: { pathname: '/pages/simulador.html' },
  window: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
sources.forEach((source, index) => vm.runInContext(source, context, {
  filename: [
    'simulation-contracts.js',
    'engine.js',
    'comparator.js',
    'shelf-engine.js',
    'simulator-cart.js',
    'simulator-result.js',
    'proposal-summary.js'
  ][index]
}));

const ShelfEngine = vm.runInContext('ShelfEngine', context);
const ProposalSummary = vm.runInContext('ProposalSummary', context);
const CartService = context.BFSimulatorCart;
const ResultService = context.BFSimulatorResult;

const groups = [
  {
    groupKey: '54708839|202512|4|187',
    codigoGrupo: '187',
    codigoSegmento: 4,
    nomeSegmento: 'Motos',
    nomeAdministradora: 'SPERTA ADM CONSORCIO NAC LTDA',
    valorCartaRef: 23512.95,
    taxaAdmPct: 3.04413,
    prazoMeses: 80,
    indiceCorrecaoNome: 'Outro',
    lanceEmbutidoMaxPct: 30,
    fundoReservaPct: 2,
    seguroPctComercial: 0,
    parcelaReduzidaDisponivel: true,
    reducaoMaxParcelaPct: 30
  },
  {
    groupKey: '06043050|202512|3|1771',
    codigoGrupo: '1771',
    codigoSegmento: 3,
    nomeSegmento: 'Automóveis',
    nomeAdministradora: 'BB CONSÓRCIOS',
    valorCartaRef: 38235.25,
    taxaAdmPct: 13.24813,
    prazoMeses: 84,
    indiceCorrecaoNome: 'Pré-fixado',
    lanceEmbutidoMaxPct: 30,
    fundoReservaPct: 2,
    seguroPctComercial: 0,
    parcelaReduzidaDisponivel: true,
    reducaoMaxParcelaPct: 30
  }
];

function buildProject(selectedGroups) {
  return {
    itens: selectedGroups.map((group) => CartService.createProjectItem(group, {
      shelfEngine: ShelfEngine,
      quantidadeCotas: 1,
      valorCarta: group.valorCartaRef,
      numberSetting: (key, fallback) => key === 'defaultMesContemplacao' ? 18 : fallback,
      getEffectiveLanceEmbutidoMax: (source) => Number(source?.lanceEmbutidoMaxPct || 0)
    }))
  };
}

function validateProject(selectedGroups, label) {
  const project = buildProject(selectedGroups);
  const expectedCredit = selectedGroups.reduce((sum, group) => sum + group.valorCartaRef, 0);
  const raw = ShelfEngine.simulateStructuredProject(project, {
    indiceReajuste: 5,
    mesAniversario: 12,
    politicaSaldo: 'carta',
    adiantamentos: [],
    inadimplencias: []
  });
  const calculation = ResultService.calculate({
    dataSimulacao: '2026-08-21',
    prazoTotal: Math.max(...selectedGroups.map((group) => group.prazoMeses)),
    mesContemplacao: 18
  }, {
    engine: context.ConsorcioEngine,
    project,
    projectSimulation: raw,
    shelfEngine: ShelfEngine
  });

  assert(raw && raw.erro === false, `${label}: a simulação estruturada retornou erro.`);
  assert(raw.itemResults.length === selectedGroups.length, `${label}: quantidade de resultados unitários divergente.`);
  assert(raw.itemResults.every((item) => item.erro === false), `${label}: existe grupo unitário não calculado.`);
  equalMoney(raw.consolidado.totalCarta, expectedCredit, `${label}: crédito consolidado`);
  equalMoney(raw.consolidado.cronograma[0].parcelaTotal, raw.consolidado.parcelaInicialTotal, `${label}: primeira parcela agregada`);
  assert(raw.consolidado.custoEfetivoMedio > 0, `${label}: custo efetivo não pode zerar quando há taxa e fundo.`);
  const dashboardKpis = CartService.renderDashboardKpis(raw.consolidado, {
    formatMoney: (value) => Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  });
  assert(dashboardKpis.some((item) => item.label === 'Crédito total'), `${label}: KPI Crédito total ausente.`);
  assert(dashboardKpis.some((item) => item.label === 'Crédito disponível após lance'), `${label}: KPI de crédito após lance ausente.`);
  const costKpi = dashboardKpis.find((item) => item.label === 'Custo efetivo estimado');
  assert(costKpi && parseFloat(costKpi.val.replace(',', '.')) > 0, `${label}: KPI de custo efetivo ficou zerado.`);
  assert(calculation.ok === true, `${label}: serviço de resultado rejeitou o projeto reconciliado.`);
  assert(calculation.resultado.diagnostics.reconciled === true, `${label}: diagnóstico final não foi reconciliado.`);
  assert(calculation.resultado.diagnostics.groupsCalculated === selectedGroups.length, `${label}: grupos calculados divergentes.`);
  assert(calculation.resultado.diagnostics.groupsRequested === selectedGroups.length, `${label}: grupos solicitados divergentes.`);
  equalMoney(calculation.resultado.resumo.valorCarta, expectedCredit, `${label}: crédito do resumo`);
  equalMoney(calculation.resultado.resumo.parcelaTotalAtual, raw.consolidado.cronograma[0].parcelaTotal, `${label}: parcela do resumo`);
  assert(calculation.resultado.resumo.prazoTotal === raw.consolidado.cronograma.length, `${label}: prazo do resumo não acompanha o cronograma agregado.`);

  const proposal = ProposalSummary.mapSimulationToProposal({
    params: {
      nomeCliente: 'Cliente QA',
      consultor: 'Consultor QA',
      dataSimulacao: '2026-08-21',
      prazoTotal: Math.max(...selectedGroups.map((group) => group.prazoMeses)),
      mesContemplacao: 18
    },
    resultado: calculation.resultado,
    project,
    cenarios: null,
    decisionContext: null
  });
  equalMoney(proposal.metrics.creditoTotal, expectedCredit, `${label}: crédito exibido na proposta`);
  equalMoney(proposal.projectSummary.valorCartaTotal, expectedCredit, `${label}: crédito detalhado na proposta`);
  equalMoney(proposal.metrics.parcelaAtual, raw.consolidado.cronograma[0].parcelaTotal, `${label}: parcela exibida na proposta`);
  equalMoney(proposal.contributions.proximaParcelaValor, raw.consolidado.cronograma[0].parcelaTotal, `${label}: próxima parcela da proposta`);
  assert(proposal.contributions.parcelasTotais === raw.consolidado.cronograma.length, `${label}: prazo exibido na proposta divergente.`);
  assert(proposal.schedule.length === raw.consolidado.cronograma.length, `${label}: cronograma exibido na proposta divergente.`);
  proposal.schedule.forEach((row, index) => {
    equalMoney(row.parcelaTotal, raw.consolidado.cronograma[index].parcelaTotal, `${label}: parcela agregada do mês ${index + 1}`);
  });

  const target = { id: `qa-${label}`, innerHTML: '' };
  ProposalSummary.render(target, {
    params: {
      nomeCliente: 'Cliente QA',
      consultor: 'Consultor QA',
      dataSimulacao: '2026-08-21',
      prazoTotal: Math.max(...selectedGroups.map((group) => group.prazoMeses)),
      mesContemplacao: 18
    },
    resultado: calculation.resultado,
    project,
    cenarios: null,
    decisionContext: null
  }, { surface: 'summary', rootId: `qa-root-${selectedGroups.length}` });
  const visibleHtml = target.innerHTML.replace(/\u00a0/g, ' ');
  const formattedCredit = expectedCredit.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }).replace(/\u00a0/g, ' ');
  const formattedInstallment = raw.consolidado.cronograma[0].parcelaTotal
    .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    .replace(/\u00a0/g, ' ');
  assert(visibleHtml.includes(formattedCredit), `${label}: HTML não exibe o crédito reconciliado ${formattedCredit}.`);
  assert(visibleHtml.includes(formattedInstallment), `${label}: HTML não exibe a parcela agregada ${formattedInstallment}.`);

  return {
    groups: selectedGroups.length,
    credit: calculation.resultado.resumo.valorCarta,
    installment: calculation.resultado.resumo.parcelaTotalAtual,
    term: calculation.resultado.resumo.prazoTotal,
    scheduleRows: proposal.schedule.length,
    effectiveCostPercent: raw.consolidado.custoEfetivoMedio
  };
}

const multigroup = validateProject(groups, 'Projeto com dois grupos');
const singleGroup = validateProject(groups.slice(0, 1), 'Projeto com um grupo');

// Golden financeiro da jornada: os controles visíveis precisam chegar ao
// motor, ao cronograma agregado e à proposta sem fallback silencioso.
const goldenParams = {
  dataSimulacao: '2026-08-21',
  prazoTotal: 84,
  mesContemplacao: 18,
  indiceReajuste: 5,
  mesAniversario: 12,
  politicaSaldo: 'carta',
  adiantamentos: [],
  inadimplencias: []
};
const formatMoney = (value) => Number(value || 0)
  .toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
  .replace(/\u00a0/g, ' ');
const normalizeSpaces = (value) => String(value || '').replace(/\u00a0/g, ' ');
const findMonth = (source, month) => source.consolidado.cronograma.find((row) => row.mes === month);

const noBidProject = buildProject(groups);
noBidProject.itens.forEach((item) => {
  assert(item.modalidadeLance === 'sem_lance', `Grupo ${item.codigoGrupo}: modalidade inicial deve ser sem_lance.`);
  assert(item.lanceEmbutidoPct === 0, `Grupo ${item.codigoGrupo}: percentual inicial de lance embutido deve ser 0%.`);
  assert(item.indiceReajuste === 0, `Grupo ${item.codigoGrupo}: reajuste inicial visível deve ser 0%.`);
  assert(item.mesContemplacaoAlvo === 18, `Grupo ${item.codigoGrupo}: mês de contemplação do controle deve ser 18.`);
});
const noBidCartHtml = CartService.renderStep5CartHtml(noBidProject.itens, {
  getEffectiveLanceEmbutidoMax: (group) => Number(group?.lanceEmbutidoMaxPct || 0),
  formatMoney
});
assert((noBidCartHtml.match(/data-campo="lanceEmbutidoPct" value="0"/g) || []).length === 2,
  'Carrinho inicial deve exibir 0% de lance embutido nos dois grupos.');
assert((noBidCartHtml.match(/data-campo="indiceReajuste" value="0\.00"/g) || []).length === 2,
  'Carrinho inicial deve exibir reajuste anual de 0,00% nos dois grupos.');
assert((noBidCartHtml.match(/value="sem_lance" selected/g) || []).length === 2,
  'Carrinho inicial deve selecionar Sem lance nos dois grupos.');
assert((noBidCartHtml.match(/max="30"/g) || []).length >= 2,
  'Limite de 30% deve permanecer apenas como validação visual do controle.');

const noBidRaw = ShelfEngine.simulateStructuredProject(noBidProject, goldenParams);
assert(noBidRaw.erro === false, 'Golden sem lance retornou erro no motor estruturado.');
noBidRaw.itemResults.forEach((result) => {
  assert(result.engineParams.modalidadeLance === 'sem_lance', `Grupo ${result.item.codigoGrupo}: motor não recebeu sem_lance.`);
  assert(result.engineParams.indiceReajuste === 0, `Grupo ${result.item.codigoGrupo}: motor não preservou reajuste 0%.`);
  assert(result.engineParams.mesContemplacao === 18, `Grupo ${result.item.codigoGrupo}: motor não recebeu contemplação no mês 18.`);
  equalMoney(result.lanceEmbutidoR, 0, `Grupo ${result.item.codigoGrupo}: lance embutido aplicado em sem_lance`);
  equalMoney(result.lanceTotalR, 0, `Grupo ${result.item.codigoGrupo}: lance total aplicado em sem_lance`);
});
equalMoney(noBidRaw.consolidado.totalCarta, 61748.20, 'Golden sem lance: crédito total');
equalMoney(noBidRaw.consolidado.totalLanceEmbutidoR, 0, 'Golden sem lance: lance embutido consolidado');
equalMoney(noBidRaw.consolidado.totalLanceR, 0, 'Golden sem lance: lance total consolidado');
equalMoney(noBidRaw.consolidado.cartaLiquida, 61748.20, 'Golden sem lance: crédito líquido');
const noBidKpis = CartService.renderDashboardKpis(noBidRaw.consolidado, { formatMoney });
assert(noBidKpis.find((item) => item.label === 'Lance embutido')?.val === 'R$ 0,00',
  'KPI inicial de lance embutido não exibe R$ 0,00.');
assert(noBidKpis.find((item) => item.label === 'Crédito disponível após lance')?.val === 'R$ 61.748,20',
  'KPI inicial de crédito disponível não exibe R$ 61.748,20.');
const noBidMonth12 = findMonth(noBidRaw, 12);
const noBidMonth18 = findMonth(noBidRaw, 18);
const noBidMonth24 = findMonth(noBidRaw, 24);
[noBidMonth12, noBidMonth24].forEach((row) => {
  assert(row && row.indiceAplicado === 0, `Mês ${row?.mes || '?'}: índice agregado deveria permanecer 0%.`);
  equalMoney(row?.reajusteValor, 0, `Mês ${row?.mes || '?'}: reajuste agregado com premissa 0%`);
  assert(normalizeSpaces(row?.observacao).includes('Reajuste de 0.00%: R$ 0,00.'),
    `Mês ${row?.mes || '?'}: observação não explicita reajuste de 0%.`);
});
equalMoney(noBidMonth18?.valorLance, 0, 'Golden sem lance: valorLance agregado no mês 18');
assert((normalizeSpaces(noBidMonth18?.observacao).match(/Contemplação sem lance\./g) || []).length === 2,
  'Mês 18 deve registrar contemplação sem lance para os dois grupos.');
const noBidCalculation = ResultService.calculate(goldenParams, {
  engine: context.ConsorcioEngine,
  project: noBidProject,
  projectSimulation: noBidRaw,
  shelfEngine: ShelfEngine
});
assert(noBidCalculation.ok === true, 'Golden sem lance foi rejeitado pelo serviço de resultado.');
const noBidProposal = ProposalSummary.mapSimulationToProposal({
  params: goldenParams,
  resultado: noBidCalculation.resultado,
  project: noBidProject,
  cenarios: null,
  decisionContext: null
});
equalMoney(noBidProposal.lances.lanceEmbutido, 0, 'Proposta sem lance: lance embutido');
equalMoney(noBidProposal.lances.lanceTotal, 0, 'Proposta sem lance: lance total');
equalMoney(noBidProposal.metrics.caixaLiquida, 61748.20, 'Proposta sem lance: crédito líquido');
equalMoney(noBidProposal.schedule.find((row) => row.mes === 18)?.valorLance, 0,
  'Proposta sem lance: valorLance do mês 18');

const embeddedProject = buildProject(groups);
embeddedProject.itens.forEach((item) => {
  const modeControl = CartService.normalizeEditValue('modalidadeLance', 'embutido', item);
  const percentControl = CartService.normalizeEditValue('lanceEmbutidoPct', '30', item, {
    getEffectiveLanceEmbutidoMax: (group) => Number(group?.lanceEmbutidoMaxPct || 0)
  });
  const indexControl = CartService.normalizeEditValue('indiceReajuste', '0', item);
  assert(modeControl.ok && modeControl.value === 'embutido', `Grupo ${item.codigoGrupo}: controle de modalidade embutida inválido.`);
  assert(percentControl.ok && percentControl.value === 30, `Grupo ${item.codigoGrupo}: controle de lance embutido não aceitou 30%.`);
  assert(indexControl.ok && indexControl.value === 0, `Grupo ${item.codigoGrupo}: controle de reajuste não preservou zero.`);
  CartService.updateProjectItem(embeddedProject, item.itemId, 'modalidadeLance', modeControl.value, { shelfEngine: ShelfEngine });
  CartService.updateProjectItem(embeddedProject, item.itemId, 'lanceEmbutidoPct', percentControl.value, { shelfEngine: ShelfEngine });
  CartService.updateProjectItem(embeddedProject, item.itemId, 'indiceReajuste', indexControl.value, { shelfEngine: ShelfEngine });
});
const embeddedCartHtml = CartService.renderStep5CartHtml(embeddedProject.itens, {
  getEffectiveLanceEmbutidoMax: (group) => Number(group?.lanceEmbutidoMaxPct || 0),
  formatMoney
});
assert((embeddedCartHtml.match(/data-campo="lanceEmbutidoPct" value="30"/g) || []).length === 2,
  'Carrinho com lance deve exibir 30% nos dois grupos.');
assert((embeddedCartHtml.match(/value="embutido" selected/g) || []).length === 2,
  'Carrinho com lance deve selecionar Embutido nos dois grupos.');

const embeddedRaw = ShelfEngine.simulateStructuredProject(embeddedProject, goldenParams);
assert(embeddedRaw.erro === false, 'Golden com lance embutido retornou erro no motor estruturado.');
const expectedEmbeddedByGroup = { '187': 7053.89, '1771': 11470.58 };
embeddedRaw.itemResults.forEach((result) => {
  const expected = expectedEmbeddedByGroup[result.item.codigoGrupo];
  assert(result.engineParams.modalidadeLance === 'embutido', `Grupo ${result.item.codigoGrupo}: motor não recebeu modalidade embutido.`);
  assert(result.engineParams.indiceReajuste === 0, `Grupo ${result.item.codigoGrupo}: reajuste 0% virou fallback no motor.`);
  assert(result.engineParams.mesContemplacao === 18, `Grupo ${result.item.codigoGrupo}: contemplação não chegou ao mês 18.`);
  equalMoney(result.lanceEmbutidoConfiguradoR, expected, `Grupo ${result.item.codigoGrupo}: lance embutido configurado`);
  equalMoney(result.lanceEmbutidoR, expected, `Grupo ${result.item.codigoGrupo}: lance embutido aplicado`);
  equalMoney(result.lanceTotalR, expected, `Grupo ${result.item.codigoGrupo}: lance total aplicado`);
  equalMoney(result.simulation.cronograma.find((row) => row.mes === 18)?.valorLance, expected,
    `Grupo ${result.item.codigoGrupo}: valorLance do cronograma`);
});
equalMoney(embeddedRaw.consolidado.totalCarta, 61748.20, 'Golden embutido: crédito total');
equalMoney(embeddedRaw.consolidado.totalLanceEmbutidoR, 18524.47, 'Golden embutido: lance embutido consolidado');
equalMoney(embeddedRaw.consolidado.totalLanceR, 18524.47, 'Golden embutido: lance total consolidado');
equalMoney(embeddedRaw.consolidado.cartaLiquida, 43223.73, 'Golden embutido: crédito líquido');
const embeddedMonth12 = findMonth(embeddedRaw, 12);
const embeddedMonth18 = findMonth(embeddedRaw, 18);
const embeddedMonth24 = findMonth(embeddedRaw, 24);
[embeddedMonth12, embeddedMonth24].forEach((row) => {
  assert(row && row.indiceAplicado === 0, `Mês ${row?.mes || '?'} com lance: índice agregado deveria permanecer 0%.`);
  equalMoney(row?.reajusteValor, 0, `Mês ${row?.mes || '?'} com lance: reajuste agregado`);
});
equalMoney(embeddedMonth18?.valorLance, 18524.47, 'Golden embutido: valorLance agregado no mês 18');
const month18Observation = normalizeSpaces(embeddedMonth18?.observacao);
assert(month18Observation.includes('187: Contemplação com lance aplicado de R$ 7.053,89.'),
  'Mês 18 não explica o lance aplicado do grupo 187.');
assert(month18Observation.includes('1771: Contemplação com lance aplicado de R$ 11.470,58.'),
  'Mês 18 não explica o lance aplicado do grupo 1771.');

const embeddedCalculation = ResultService.calculate(goldenParams, {
  engine: context.ConsorcioEngine,
  project: embeddedProject,
  projectSimulation: embeddedRaw,
  shelfEngine: ShelfEngine
});
assert(embeddedCalculation.ok === true, 'Golden embutido foi rejeitado pelo serviço de resultado.');
equalMoney(embeddedCalculation.resultado.resumo.lanceEmbutido, 18524.47, 'Resumo agregado: lance embutido');
equalMoney(embeddedCalculation.resultado.resumo.lanceTotal, 18524.47, 'Resumo agregado: lance total');
equalMoney(embeddedCalculation.resultado.resumo.cartaLiquida, 43223.73, 'Resumo agregado: crédito líquido');
const embeddedProposal = ProposalSummary.mapSimulationToProposal({
  params: goldenParams,
  resultado: embeddedCalculation.resultado,
  project: embeddedProject,
  cenarios: null,
  decisionContext: null
});
equalMoney(embeddedProposal.lances.lanceEmbutido, 18524.47, 'Proposta agregada: lance embutido');
equalMoney(embeddedProposal.lances.lanceTotal, 18524.47, 'Proposta agregada: lance total');
equalMoney(embeddedProposal.metrics.caixaLiquida, 43223.73, 'Proposta agregada: crédito líquido');
const proposalMonth18 = embeddedProposal.schedule.find((row) => row.mes === 18);
equalMoney(proposalMonth18?.valorLance, 18524.47, 'Proposta agregada: valorLance do mês 18');
assert(normalizeSpaces(proposalMonth18?.observacao) === month18Observation,
  'Proposta agregada não preservou a observação reconciliada do mês 18.');
const embeddedKpis = CartService.renderDashboardKpis(embeddedRaw.consolidado, { formatMoney });
assert(embeddedKpis.find((item) => item.label === 'Lance embutido')?.val === 'R$ 18.524,47',
  'KPI de lance embutido não exibe R$ 18.524,47.');
assert(embeddedKpis.find((item) => item.label === 'Crédito disponível após lance')?.val === 'R$ 43.223,73',
  'KPI de crédito disponível não exibe R$ 43.223,73.');

const legacyOwnControl = CartService.normalizeEditValue('modalidadeLance', 'proprio', embeddedProject.itens[0]);
assert(legacyOwnControl.ok && legacyOwnControl.value === 'livre',
  'Modalidade legada proprio não foi normalizada para livre no carrinho.');
const legacyOwnEngine = context.ConsorcioEngine.calcularLance({
  valorCarta: 100000,
  prazoTotal: 80,
  lanceProprio: 10,
  modalidadeLance: 'proprio'
});
equalMoney(legacyOwnEngine.lanceTotal, 10000, 'Motor: modalidade legada proprio deve aplicar lance livre');

const partialProject = buildProject(groups);
partialProject.itens[1].mesAniversario = 1000;
const partialRaw = ShelfEngine.simulateStructuredProject(partialProject, {});
const partialCalculation = ResultService.calculate({ prazoTotal: 84, mesContemplacao: 18 }, {
  engine: context.ConsorcioEngine,
  project: partialProject,
  projectSimulation: partialRaw,
  shelfEngine: ShelfEngine
});
assert(partialRaw.itemResults.some((item) => item.erro), 'Caso parcial de controle não produziu um grupo inválido.');
assert(partialCalculation.ok === false, 'Resultado parcial não pode ser aceito como projeto reconciliado.');

const fullProject = buildProject(groups);
const singleRaw = ShelfEngine.simulateStructuredProject({ itens: fullProject.itens.slice(0, 1) }, {});
const staleSingleResult = ResultService.buildProjectResult(singleRaw, { itens: fullProject.itens.slice(0, 1) });
const staleCheck = ResultService.validateProjectResult(staleSingleResult, fullProject);
assert(staleCheck.reconciled === false, 'Resultado de um grupo não pode ser reaproveitado para um projeto com dois grupos.');
assert(staleCheck.errors.some((message) => message.includes('crédito consolidado')), 'Divergência de crédito do resultado antigo não foi identificada.');

const eventProject = buildProject(groups);
const eventParams = {
  dataSimulacao: '2026-08-21',
  prazoTotal: 84,
  mesContemplacao: 18,
  inadimplencias: [{ mesInicio: 1, mesesAtraso: 1, regularizar: true, mesRegularizacao: 3 }]
};
const eventRaw = ShelfEngine.simulateStructuredProject(eventProject, eventParams);
const eventCalculation = ResultService.calculate(eventParams, {
  engine: context.ConsorcioEngine,
  project: eventProject,
  projectSimulation: eventRaw,
  shelfEngine: ShelfEngine
});
assert(eventCalculation.ok === true, 'Projeto multigrupo com evento futuro válido foi rejeitado.');
equalMoney(eventRaw.consolidado.cronograma[0].parcelaTotal, 0, 'Evento no mês 1 deve zerar o caixa da primeira parcela');
equalMoney(eventCalculation.resultado.resumo.parcelaTotalAtual, 0, 'Resumo deve preservar primeira parcela zerada pelo evento');
const eventProposal = ProposalSummary.mapSimulationToProposal({
  params: eventParams,
  resultado: eventCalculation.resultado,
  project: eventProject,
  cenarios: null,
  decisionContext: null
});
equalMoney(eventProposal.metrics.parcelaAtual, 0, 'Proposta deve preservar primeira parcela zerada pelo evento');
equalMoney(eventProposal.contributions.proximaParcelaValor, 0, 'Próxima parcela deve refletir o cronograma agregado com evento');

const appSource = await read('js/app.js');
assert(appSource.includes('validateProjectResult(resultado, projetoEstruturado)'), 'App não valida o resultado contra o projeto antes de exibir/publicar.');
assert(appSource.includes('Resumo do projeto'), 'Cabeçalho do resumo ainda usa linguagem técnica.');
assert(appSource.includes("indiceReajuste: nOr('indiceReajuste', numberSetting('defaultIndiceReajuste', 5))"),
  'App não preserva reajuste explícito de 0% na coleta dos parâmetros.');
assert(appSource.includes("item.lanceEmbutidoPct = d.lanceEmbutido;"),
  'Carregar exemplo não define o percentual de lance embutido intencional.');
assert(appSource.includes("item.modalidadeLance = d.modalidadeLance === 'proprio' ? 'livre' : (d.modalidadeLance || 'sem_lance');"),
  'Carregar exemplo não define a modalidade de lance junto com o percentual.');

const report = {
  ok: failures.length === 0,
  expectedMultigroupCredit: 61748.20,
  multigroup,
  singleGroup,
  partialResultRejected: partialCalculation.ok === false,
  staleResultRejected: staleCheck.reconciled === false,
  zeroInstallmentEventPreserved: eventProposal.contributions.proximaParcelaValor === 0,
  financialGolden: {
    defaultNoBid: {
      modality: 'sem_lance',
      embeddedPercent: 0,
      annualAdjustmentPercent: 0,
      contemplationMonth: 18,
      appliedBid: noBidRaw.consolidado.totalLanceR,
      embeddedBid: noBidRaw.consolidado.totalLanceEmbutidoR,
      availableCredit: noBidRaw.consolidado.cartaLiquida,
      month12Adjustment: noBidMonth12.reajusteValor,
      month18Bid: noBidMonth18.valorLance,
      month24Adjustment: noBidMonth24.reajusteValor
    },
    embeddedBid: {
      modality: 'embutido',
      embeddedPercent: 30,
      annualAdjustmentPercent: 0,
      contemplationMonth: 18,
      group187: embeddedRaw.itemResults.find((item) => item.item.codigoGrupo === '187').lanceEmbutidoR,
      group1771: embeddedRaw.itemResults.find((item) => item.item.codigoGrupo === '1771').lanceEmbutidoR,
      appliedBid: embeddedRaw.consolidado.totalLanceR,
      embeddedBid: embeddedRaw.consolidado.totalLanceEmbutidoR,
      availableCredit: embeddedRaw.consolidado.cartaLiquida,
      month12Adjustment: embeddedMonth12.reajusteValor,
      month18Bid: embeddedMonth18.valorLance,
      month24Adjustment: embeddedMonth24.reajusteValor,
      proposalEmbeddedBid: embeddedProposal.lances.lanceEmbutido,
      proposalAvailableCredit: embeddedProposal.metrics.caixaLiquida
    },
    legacyOwnModeNormalized: legacyOwnControl.value === 'livre',
    exampleSetsBidModeAndPercent: true
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/multigroup-reconciliation-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exitCode = 1;
