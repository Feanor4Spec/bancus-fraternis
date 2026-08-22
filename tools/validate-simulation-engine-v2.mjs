import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];
const checks = [];

function assert(condition, message) {
  checks.push({ ok: Boolean(condition), message });
  if (!condition) failures.push(message);
}

function equal(actual, expected, label) {
  assert(Object.is(actual, expected), `${label}: esperado ${JSON.stringify(expected)}, obtido ${JSON.stringify(actual)}.`);
}

function deepEqual(actual, expected, label) {
  equal(JSON.stringify(actual), JSON.stringify(expected), label);
}

async function loadEngine({ withContracts = true } = {}) {
  const context = { console, Intl };
  context.globalThis = context;
  vm.createContext(context);

  if (withContracts) {
    const contracts = await fs.readFile(path.join(root, 'js/simulation-contracts.js'), 'utf8');
    vm.runInContext(contracts, context, { filename: 'js/simulation-contracts.js' });
  }

  const engineSource = await fs.readFile(path.join(root, 'js/engine.js'), 'utf8');
  vm.runInContext(engineSource, context, { filename: 'js/engine.js' });
  return {
    engine: context.ConsorcioEngine,
    contracts: context.BFSimulationContracts
  };
}

function params(overrides = {}) {
  const prazoTotal = overrides.prazoTotal ?? 12;
  return {
    valorCarta: 1200,
    prazoTotal,
    taxaAdm: 0,
    fundoReserva: 0,
    seguro: 0,
    seguroTipo: 'percentual',
    tipoIndice: 'fixo',
    indiceReajuste: 0,
    mesAdesao: 1,
    mesAniversario: prazoTotal,
    mesContemplacao: prazoTotal,
    lanceProprio: 0,
    lanceEmbutido: 0,
    lanceFixo: 0,
    usarFGTS: false,
    valorFGTS: 0,
    modalidadeLance: 'combinado',
    parcelaReduzida: false,
    percentualReducao: 0,
    politicaSaldo: 'carta',
    adiantamentos: [],
    inadimplencias: [],
    multaAtraso: 2,
    jurosAtraso: 1,
    ...overrides
  };
}

const { engine, contracts } = await loadEngine();
assert(engine && typeof engine.simular === 'function', 'API pública ConsorcioEngine.simular ausente.');
assert(engine.VERSION === '2.0.0', 'Versão pública do motor deveria ser 2.0.0.');
assert(engine.SCHEMA === 'bancus.simulation.v2', 'Schema público do motor deveria ser bancus.simulation.v2.');
assert(contracts && typeof contracts.validateScheduleInvariants === 'function', 'Contrato v2 de invariantes não foi exposto.');

function simulate(id, input) {
  const result = engine.simular(input);
  assert(!result.erro, `${id}: simulação retornou erro: ${(result.mensagens || []).join(' | ')}`);
  if (!result.erro) {
    assert(result.auditoria.invariantes.valido, `${id}: invariantes internas falharam.`);
    assert(result.auditoria.reconciliacao.valido, `${id}: reconciliação global falhou.`);
    assert(contracts.validateScheduleInvariants(result.cronograma).valido, `${id}: invariantes contratuais falharam.`);
  }
  return result;
}

// Golden 1: carta, prazo, taxa e encerramento exato.
const baselineA = simulate('baseline-politica-a', params({ taxaAdm: 12 }));
equal(baselineA.resumo.saldoInicial, 1200, 'Política A mantém saldo inicial da carta');
equal(baselineA.resumo.valorTotalPlano, 1344, 'Plano soma carta e taxa uma única vez');
equal(baselineA.cronograma[0].parcelaBase, 100, 'Parcela base do primeiro mês');
equal(baselineA.cronograma[0].componenteTaxaAdm, 12, 'Componente administrativo do primeiro mês');
equal(baselineA.cronograma[0].parcelaTotal, 112, 'Parcela total do primeiro mês');
equal(baselineA.resumo.totalPago, 1344, 'Total pago no baseline');
equal(baselineA.cronograma.at(-1).saldoFinal, 0, 'Baseline encerra no saldo zero');
equal(baselineA.residual.status, 'quitado', 'Baseline sem residual');

// Golden 2: Política B financia custos sem somá-los de novo na parcela.
const baselineB = simulate('baseline-politica-b', params({ taxaAdm: 12, politicaSaldo: 'carta_mais_custos' }));
equal(baselineB.resumo.saldoInicial, 1344, 'Política B inclui custos no saldo inicial');
equal(baselineB.resumo.totalPago, 1344, 'Política B não duplica custos');
equal(baselineB.cronograma[0].parcelaTotal, 112, 'Política B não duplica componentes mensais');
deepEqual(
  baselineB.cronograma.map((row) => row.parcelaTotal),
  baselineA.cronograma.map((row) => row.parcelaTotal),
  'Políticas A e B preservam a mesma obrigação econômica'
);

// Golden 3: administração, fundo e seguro fixo têm saldos próprios e fecham juntos.
const components = simulate('componentes-de-custo', params({
  valorCarta: 1000,
  prazoTotal: 4,
  mesAniversario: 4,
  mesContemplacao: 4,
  taxaAdm: 10,
  fundoReserva: 2,
  seguro: 5,
  seguroTipo: 'fixo',
  politicaSaldo: 'carta_mais_custos'
}));
equal(components.resumo.valorTotalPlano, 1140, 'Valor do plano com todos os componentes');
equal(components.cronograma[0].componenteTaxaAdm, 25, 'Taxa administrativa mensal');
equal(components.cronograma[0].componenteFundoReserva, 5, 'Fundo de reserva mensal');
equal(components.cronograma[0].componenteSeguro, 5, 'Seguro fixo mensal');
equal(components.cronograma[0].parcelaTotal, 285, 'Parcela com todos os componentes');
equal(components.resumo.totalPago, 1140, 'Componentes pagos uma única vez');

// Golden 4: redução paga apenas a fração cobrada e recompõe o restante.
const reduced = simulate('parcela-reduzida', params({
  parcelaReduzida: true,
  percentualReducao: 50,
  mesContemplacao: 4
}));
equal(reduced.cronograma[0].parcelaBase, 100, 'Base cheia pré-contemplação');
equal(reduced.cronograma[0].parcelaReduzida, 50, 'Parcela reduzida efetivamente amortizada');
equal(reduced.cronograma[0].saldoFinal, 1150, 'Diferença reduzida permanece no saldo');
equal(reduced.cronograma[3].parcelaBase, 115.87, 'Recomposição exata na contemplação');
equal(reduced.resumo.totalPago, 1200, 'Redução não apaga principal');
equal(reduced.residual.status, 'quitado', 'Redução recomposta quita o contrato');

// Golden 5: antecipação reduz saldo e integra totalPago/caixa.
const advance = simulate('antecipacao-saldo', params({
  adiantamentos: [{ mes: 1, valor: 200, qtdParcelas: 0, tipo: 'reduzir_saldo' }]
}));
equal(advance.cronograma[0].valorAdiantado, 200, 'Antecipação aplicada no mês 1');
equal(advance.cronograma[0].parcelaTotal, 83.33, 'Parcela recalculada após antecipação');
equal(advance.cronograma[0].caixaPago, 283.33, 'Caixa mensal inclui antecipação');
equal(advance.resumo.totalAdiantado, 200, 'Resumo separa antecipação');
equal(advance.resumo.totalPago, 1200, 'Total pago inclui antecipação sem duplicar principal');

// Golden 6: reduzir prazo elimina parcelas finais, sem linha artificial após saldo zero.
const shorter = simulate('antecipacao-prazo', params({
  adiantamentos: [{ mes: 2, valor: 300, qtdParcelas: 0, tipo: 'reduzir_prazo' }]
}));
equal(shorter.cronograma[1].parcelasAbatidas, 3, 'Quantidade de parcelas abatidas');
equal(shorter.cronograma.length, 9, 'Cronograma termina três meses antes');
equal(shorter.cronograma.at(-1).saldoFinal, 0, 'Redução de prazo encerra exatamente em zero');
equal(shorter.resumo.totalPago, 1200, 'Redução de prazo preserva reconciliação de caixa');

// Golden 7: inadimplência não tem caixa; regularização separa encargos de principal.
const delinquency = simulate('inadimplencia-regularizada', params({
  inadimplencias: [{ mesInicio: 2, mesesAtraso: 2, regularizar: true, mesRegularizacao: 4 }]
}));
equal(delinquency.cronograma[1].parcelaDevida, 100, 'Parcela devida no primeiro atraso');
equal(delinquency.cronograma[1].parcelaTotal, 0, 'Linha inadimplente sem parcela paga');
equal(delinquency.cronograma[1].valorPago, 0, 'Linha inadimplente sem valor pago');
equal(delinquency.cronograma[1].caixaPago, 0, 'Linha inadimplente sem caixa');
equal(delinquency.cronograma[1].saldoFinal, delinquency.cronograma[1].saldoAnterior, 'Inadimplência mantém saldo');
equal(delinquency.cronograma[3].valorRegularizado, 200, 'Regularização amortiza somente obrigações atrasadas');
equal(delinquency.cronograma[3].multaPaga, 4, 'Multa paga separada da amortização');
equal(delinquency.cronograma[3].jurosPago, 3, 'Juros pagos separados da amortização');
equal(delinquency.cronograma[3].parcelaTotal, 307, 'Caixa de regularização inclui atual, atrasadas e encargos');
equal(delinquency.resumo.totalEncargos, 7, 'Resumo totaliza somente encargos pagos');
equal(delinquency.resumo.totalPago, 1207, 'Total pago adiciona encargos sem reduzir principal por eles');
equal(delinquency.resumo.totalAmortizado, 1200, 'Multa e juros não amortizam obrigação');

// Golden 8: aniversário, contemplação e antecipação são processados já no mês 1.
const firstMonthEvents = simulate('eventos-mes-1', params({
  valorCarta: 1000,
  prazoTotal: 10,
  mesAniversario: 1,
  mesContemplacao: 1,
  indiceReajuste: 10,
  lanceProprio: 10,
  modalidadeLance: 'livre',
  adiantamentos: [{ mes: 1, valor: 100, qtdParcelas: 0, tipo: 'reduzir_saldo' }]
}));
deepEqual(
  firstMonthEvents.cronograma[0].eventos,
  ['adesão', 'aniversário', 'contemplação', 'adiantamento'],
  'Ordem de eventos do mês 1'
);
equal(firstMonthEvents.cronograma[0].reajusteValor, 100, 'Reajuste no mês 1');
equal(firstMonthEvents.cronograma[0].valorLance, 100, 'Lance no mês 1');
equal(firstMonthEvents.cronograma[0].valorAdiantado, 100, 'Antecipação no mês 1');
equal(firstMonthEvents.cronograma[0].parcelaTotal, 90, 'Parcela após eventos do mês 1');
equal(firstMonthEvents.cronograma[0].saldoFinal, 810, 'Saldo após eventos do mês 1');
equal(firstMonthEvents.cronograma[0].caixaPago, 290, 'Caixa após eventos do mês 1');

// Golden 9: inadimplência também pode começar no mês 1.
const firstMonthDefault = simulate('inadimplencia-mes-1', params({
  valorCarta: 400,
  prazoTotal: 4,
  mesAniversario: 4,
  mesContemplacao: 4,
  inadimplencias: [{ mesInicio: 1, mesesAtraso: 1, regularizar: true, mesRegularizacao: 2 }]
}));
deepEqual(firstMonthDefault.cronograma[0].eventos, ['adesão', 'inadimplência'], 'Inadimplência no mês 1');
equal(firstMonthDefault.cronograma[0].parcelaTotal, 0, 'Mês 1 inadimplente sem parcela paga');
equal(firstMonthDefault.cronograma[1].parcelaTotal, 203, 'Regularização do atraso do mês 1');
equal(firstMonthDefault.resumo.totalPago, 403, 'Contrato do mês 1 soma apenas encargos além do principal');

// Golden 10: evento que zera o saldo gera uma única linha e residual quitado.
const earlyClose = simulate('encerramento-antecipado', params({
  valorCarta: 1000,
  prazoTotal: 10,
  mesAniversario: 10,
  mesContemplacao: 10,
  adiantamentos: [{ mes: 1, valor: 1000, qtdParcelas: 0, tipo: 'reduzir_saldo' }]
}));
equal(earlyClose.cronograma.length, 1, 'Sem linha extra depois do saldo zero');
equal(earlyClose.cronograma[0].parcelaTotal, 0, 'Sem parcela artificial após antecipação integral');
equal(earlyClose.cronograma[0].saldoFinal, 0, 'Antecipação integral zera saldo');
equal(earlyClose.residual.status, 'quitado', 'Antecipação integral sem residual');

// Golden 11: prazo encerrado com atraso mantém residual explícito.
const residual = simulate('residual-inadimplente', params({
  valorCarta: 1000,
  prazoTotal: 3,
  mesAniversario: 3,
  mesContemplacao: 3,
  inadimplencias: [{ mesInicio: 1, mesesAtraso: 3, regularizar: false, mesRegularizacao: 0 }]
}));
equal(residual.resumo.totalPago, 0, 'Sem caixa em contrato totalmente inadimplente');
equal(residual.residual.status, 'residual', 'Residual sinalizado');
equal(residual.residual.obrigacao, 1000, 'Principal residual explícito');
equal(residual.residual.parcelasEmAtraso, 3, 'Quantidade de parcelas atrasadas explícita');
assert(residual.residual.encargosProjetados > 0, 'Encargos residuais projetados devem ser explícitos.');

const partialResidual = simulate('residual-nao-regularizado', params({
  inadimplencias: [{ mesInicio: 2, mesesAtraso: 1, regularizar: false, mesRegularizacao: 0 }]
}));
equal(partialResidual.resumo.totalPago, 1100, 'Parcelas futuras não quitam atraso por acidente');
equal(partialResidual.residual.obrigacao, 100, 'Parcela vencida não regularizada permanece no saldo');
equal(partialResidual.residual.parcelasEmAtraso, 1, 'Atraso isolado permanece rastreável');
equal(partialResidual.cronograma.at(-1).saldoEmAtrasoFinal, 100, 'Linha final expõe saldo vencido reservado');

// Golden 12: divisão inexata fecha no último centavo.
const cents = simulate('arredondamento-centavos', params({
  valorCarta: 100,
  prazoTotal: 3,
  mesAniversario: 3,
  mesContemplacao: 3
}));
deepEqual(cents.cronograma.map((row) => row.parcelaTotal), [33.33, 33.34, 33.33], 'Distribuição determinística de centavos');
equal(cents.resumo.totalPago, 100, 'Arredondamento reconcilia o total');
equal(cents.cronograma.at(-1).saldoFinal, 0, 'Arredondamento zera saldo');

// Golden 13: reajuste de aniversário altera somente o saldo remanescente da carta.
const adjusted = simulate('reajuste-aniversario', params({
  valorCarta: 1000,
  prazoTotal: 4,
  mesAniversario: 2,
  mesContemplacao: 4,
  indiceReajuste: 10
}));
equal(adjusted.cronograma[1].reajusteValor, 75, 'Reajuste sobre saldo principal remanescente');
equal(adjusted.cronograma[1].parcelaTotal, 275, 'Parcela recomposta após índice');
equal(adjusted.resumo.totalReajustes, 75, 'Resumo do índice aplicado');
equal(adjusted.resumo.totalPago, 1075, 'Total pago incorpora reajuste');

// Golden 14: lance embutido reduz crédito líquido, mas não cria caixa fictício.
const embedded = simulate('lance-embutido', params({
  valorCarta: 1000,
  prazoTotal: 10,
  mesAniversario: 10,
  mesContemplacao: 1,
  lanceEmbutido: 20,
  modalidadeLance: 'embutido'
}));
equal(embedded.resumo.cartaLiquida, 800, 'Carta líquida após lance embutido');
equal(embedded.cronograma[0].valorLance, 200, 'Lance embutido amortiza saldo');
equal(embedded.cronograma[0].valorLanceCaixa, 0, 'Lance embutido não é caixa externo');
equal(embedded.resumo.totalPago, 800, 'Caixa total exclui lance embutido');
equal(embedded.resumo.lanceEmbutidoAplicado, 200, 'Resumo explicita contribuição embutida');
equal(embedded.resumo.custoTotal, 0, 'Custo econômico reconcilia caixa e crédito embutido');

// Golden 15: lances impossíveis são rejeitados antes do cronograma.
const invalidBid = engine.simular(params({
  valorCarta: 1000,
  lanceProprio: 80,
  lanceEmbutido: 30,
  modalidadeLance: 'combinado'
}));
assert(invalidBid.erro, 'Lance combinado acima da carta deveria ser rejeitado.');
assert(
  (invalidBid.mensagens || []).some((message) => message.includes('não pode superar')),
  'Erro de lance acima da carta deveria ser explícito.'
);

const fixedBid = engine.calcularLance(params({
  valorCarta: 1000,
  lanceProprio: 90,
  lanceFixo: 15,
  modalidadeLance: 'fixo'
}));
equal(fixedBid.lanceTotal, 150, 'Modalidade fixa seleciona somente o lance fixo');
equal(fixedBid.lanceCaixa, 150, 'Lance fixo é caixa externo');

const fgtsBid = engine.calcularLance(params({
  valorCarta: 1000,
  usarFGTS: true,
  valorFGTS: 250,
  modalidadeLance: 'fgts'
}));
equal(fgtsBid.lanceTotal, 250, 'Modalidade FGTS seleciona o valor informado');
equal(fgtsBid.lanceCaixa, 250, 'FGTS é explicitado como recurso externo');

const noBid = engine.calcularLance(params({
  valorCarta: 1000,
  lanceProprio: 90,
  lanceEmbutido: 10,
  modalidadeLance: 'sem_lance'
}));
equal(noBid.lanceTotal, 0, 'Modalidade sem_lance não aplica percentuais informativos');
assert(
  engine.validarParametros(params({ modalidadeLance: 'sem_lance' })).valido,
  'Modalidade sem_lance deve ser aceita para compatibilidade com a sacola.'
);
['IGP-M', 'Outro', 'Pré-fixado', 'TR'].forEach((tipoIndice) => {
  assert(
    engine.validarParametros(params({ tipoIndice })).valido,
    `Índice real ${tipoIndice} deve ser aceito pelo motor.`
  );
});

assert(
  engine.validarParametros(params({ seguro: 500, seguroTipo: 'fixo' })).valido,
  'Seguro fixo é valor monetário e pode superar 100 reais.'
);
assert(
  !engine.validarParametros(params({ prazoTotal: 12.5 })).valido,
  'Prazo fracionário deveria ser rejeitado.'
);
assert(
  !engine.validarParametros(params({
    adiantamentos: [{ mes: 2, valor: 100, qtdParcelas: 0, tipo: 'reduzir_saldo' }],
    inadimplencias: [{ mesInicio: 2, mesesAtraso: 1, regularizar: true, mesRegularizacao: 3 }]
  })).valido,
  'Antecipação não deve criar caixa em uma linha marcada como inadimplente.'
);

// Compatibilidade: engine.js continua autossuficiente nas páginas atuais.
const standalone = await loadEngine({ withContracts: false });
const standaloneResult = standalone.engine.simular(params({ valorCarta: 100, prazoTotal: 3, mesAniversario: 3, mesContemplacao: 3 }));
assert(!standaloneResult.erro, 'engine.js deve funcionar sem carregamento prévio de simulation-contracts.js.');
equal(standaloneResult.resumo.totalPago, 100, 'Fallback autossuficiente preserva cálculo');

// Propriedades determinísticas: combinações adicionais de custos e eventos.
let seed = 0x2f6e2b1;
function random() {
  seed = (seed * 1664525 + 1013904223) >>> 0;
  return seed / 0x100000000;
}

const propertyScenarios = 60;
for (let index = 0; index < propertyScenarios; index += 1) {
  const prazoTotal = 12 + Math.floor(random() * 37);
  const valorCarta = 1000 + Math.floor(random() * 9000);
  const mesContemplacao = 1 + Math.floor(random() * prazoTotal);
  const mesAniversario = 1 + Math.floor(random() * prazoTotal);
  const lanceProprio = Math.floor(random() * 16);
  const lanceEmbutido = Math.floor(random() * 16);
  const withDefault = index % 4 === 0;
  const defaultStart = withDefault ? 1 + Math.floor(random() * Math.max(1, prazoTotal - 3)) : 0;
  const defaultLength = withDefault ? 1 + Math.floor(random() * 2) : 0;
  const regularizationMonth = defaultStart + defaultLength;
  const withAdvance = index % 3 === 0;
  const contemplationInDefault = withDefault
    && mesContemplacao >= defaultStart
    && mesContemplacao < regularizationMonth;
  const advanceMonth = withDefault && withAdvance
    ? regularizationMonth
    : 1 + Math.floor(random() * Math.max(1, prazoTotal - 1));

  const input = params({
    valorCarta,
    prazoTotal,
    taxaAdm: Number((random() * 20).toFixed(4)),
    fundoReserva: Number((random() * 5).toFixed(4)),
    seguro: Number((random() * 2).toFixed(4)),
    seguroTipo: 'percentual',
    indiceReajuste: Number((random() * 12).toFixed(4)),
    mesAniversario,
    mesContemplacao,
    lanceProprio: contemplationInDefault ? 0 : lanceProprio,
    lanceEmbutido,
    modalidadeLance: 'combinado',
    parcelaReduzida: index % 2 === 0,
    percentualReducao: index % 2 === 0 ? 10 + Math.floor(random() * 50) : 0,
    politicaSaldo: index % 2 === 0 ? 'carta' : 'carta_mais_custos',
    adiantamentos: withAdvance
      ? [{
          mes: advanceMonth,
          valor: Number((valorCarta * (0.01 + random() * 0.08)).toFixed(2)),
          qtdParcelas: 0,
          tipo: index % 6 === 0 ? 'reduzir_prazo' : 'reduzir_saldo'
        }]
      : [],
    inadimplencias: withDefault
      ? [{
          mesInicio: defaultStart,
          mesesAtraso: defaultLength,
          regularizar: regularizationMonth <= prazoTotal,
          mesRegularizacao: regularizationMonth <= prazoTotal ? regularizationMonth : 0
        }]
      : []
  });

  const result = engine.simular(input);
  assert(!result.erro, `Propriedade ${index + 1}: cenário combinado deveria ser válido.`);
  if (!result.erro) {
    assert(result.auditoria.invariantes.valido, `Propriedade ${index + 1}: identidade mensal falhou.`);
    assert(result.auditoria.reconciliacao.valido, `Propriedade ${index + 1}: reconciliação global falhou.`);
    assert(
      result.cronograma.every((row) => Number.isFinite(row.saldoTotalFinal) && row.saldoTotalFinal >= 0),
      `Propriedade ${index + 1}: saldo inválido.`
    );
  }
}

const report = {
  ok: failures.length === 0,
  schema: engine.SCHEMA,
  version: engine.VERSION,
  scenarios: 16,
  propertyScenarios,
  assertions: checks.length,
  failures
};

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
