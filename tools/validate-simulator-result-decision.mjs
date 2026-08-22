import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  simulatorHtml,
  appJs,
  proposalSummaryJs,
  proposalBuilderJs,
  stylesCss,
  contracts,
  plan,
  protocol
] = await Promise.all([
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/proposal-summary.js'),
  read('js/proposal-builder.js'),
  read('css/styles.css'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/CODEX_TEST_PROTOCOL.md')
]);

[
  'data-simulator-result-decision',
  'data-simulator-result-cta',
  'data-simulator-result-premise',
  'data-simulator-result-risk',
  'data-simulator-result-comparison',
  'buildResultDecision',
  'renderResultDecision'
].forEach((token) => {
  assert(proposalSummaryJs.includes(token), `proposal-summary.js sem contrato ${token}.`);
});

assert(appJs.includes('decisionContext: getDecisionContextSnapshot()'), 'app.js nao passa contexto financeiro para a decisao do resultado.');
assert(proposalBuilderJs.includes("decision: true"), 'proposal-builder.js sem bloco decision nos defaults.');
assert(proposalBuilderJs.includes("key: 'decision'"), 'proposal-builder.js sem opcao de lousa para decisao final.');
assert(stylesCss.includes('.ps-section--decision'), 'styles.css sem layout da decisao final.');
assert(stylesCss.includes('.ps-decision-grid'), 'styles.css sem grid da decisao final.');
assert(contracts.includes('tools/validate-simulator-result-decision.mjs'), 'Contratos publicos nao documentam o validador de decisao.');
assert(contracts.includes('data-simulator-result-decision'), 'Contratos publicos nao documentam data-simulator-result-decision.');
assert(plan.includes('Resultado como decisao'), 'Plano de evolucao nao registra resultado como decisao.');
assert(protocol.includes('validate-simulator-result-decision.mjs'), 'Protocolo de testes nao inclui validate-simulator-result-decision.mjs.');
assert(simulatorHtml.includes('proposal-summary-container'), 'simulador.html sem container do resumo decisorio.');

const context = {
  console,
  Date,
  Intl,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  location: { pathname: '/pages/simulador.html' },
  setTimeout() {}
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(`${proposalSummaryJs}\nglobalThis.__ProposalSummary = ProposalSummary;`, context, {
  filename: 'js/proposal-summary.js'
});

const summary = context.__ProposalSummary;
assert(summary && typeof summary.buildResultDecision === 'function', 'ProposalSummary.buildResultDecision indisponivel.');
assert(summary && typeof summary.mapSimulationToProposal === 'function', 'ProposalSummary.mapSimulationToProposal indisponivel.');

const params = {
  nomeCliente: 'Cliente QA',
  consultor: 'Consultor QA',
  dataSimulacao: '2026-05-13',
  prazoTotal: 96,
  mesContemplacao: 18,
  valorCarta: 180000,
  taxaAdm: 18,
  fundoReserva: 2,
  lanceProprio: 10,
  lanceEmbutido: 20
};
const resultado = {
  resumo: {
    valorCarta: 180000,
    valorTotalPlano: 216000,
    taxaAdmTotal: 32400,
    fundoReservaTotal: 3600,
    seguroTotal: 0,
    saldoInicial: 180000,
    parcelaTotalAtual: 4200,
    lanceProprio: 18000,
    lanceEmbutido: 36000,
    lanceTotal: 54000,
    cartaLiquida: 144000,
    prazoTotal: 96,
    prazoRestante: 78,
    custoTotal: 36000,
    totalPagoAteContemplacao: 75600,
    totalPago: 278000
  },
  cronograma: Array.from({ length: 96 }, (_, index) => ({
    mes: index + 1,
    parcelaTotal: 4200,
    saldoFinal: Math.max(0, 180000 - (index + 1) * 1700)
  }))
};
const cenarios = {
  semContemplacao: { resumo: { lanceTotal: 0, parcelaTotalAtual: 4000 } },
  parcelaCheia: { resumo: { parcelaTotalAtual: 4800 } }
};
const project = {
  itens: [{
    administradora: 'Admin QA',
    codigoGrupo: '1001',
    quantidadeCotas: 1,
    nomeSegmento: 'Auto',
    valorCartaUnitario: 180000,
    valorCartaTotal: 180000,
    prazoMeses: 96,
    taxaAdmPct: 18,
    fundoReservaPct: 2,
    dataBase: 202512,
    lanceProprioPct: 10,
    lanceEmbutidoPct: 20,
    _papel: { tag: 'Foco' },
    classificacaoExecutiva: 'A'
  }]
};
const decisionContext = {
  readinessScore: 82,
  prefill: { capacidadePagamento: 5000 },
  profileSnapshot: { rendaMensal: 15000 }
};
const proposal = summary.mapSimulationToProposal({ params, resultado, cenarios, project, decisionContext });

assert(proposal.decision && proposal.decision.headline, 'Proposta sem decisao final.');
assert(proposal.decision.comparison.length >= 2, 'Decisao deveria incluir comparacoes acionaveis.');
assert(proposal.decision.premises.length >= 3, 'Decisao deveria incluir premissas.');
assert(proposal.decision.reasons.length >= 3, 'Decisao deveria incluir motivos.');
assert(proposal.decision.risks.length >= 1, 'Decisao deveria incluir riscos ou ausencia explicita de alerta.');
assert(proposal.dataSource?.kind === 'historical-reference', 'Proposta nao identifica a base como referencia historica.');
assert(proposal.dataSource?.competenceLabel === 'dezembro de 2025', 'Proposta nao traduz a competencia da base.');
assert(proposal.dataSource?.availabilityConfirmed === false, 'Proposta nao exige confirmacao atual da disponibilidade.');
assert(proposal.decision.risks.some((risk) => risk.includes('referências são históricas')), 'Risco de atualidade nao aparece na decisao.');
assert(proposal.disclaimers.some((item) => item.includes('dezembro de 2025')), 'Disclaimer nao registra a competencia da base.');
assert(proposal.nextSteps.some((item) => item.title === 'Confirmar disponibilidade atual'), 'Proposta nao orienta a confirmacao atual antes da contratacao.');

const report = {
  ok: failures.length === 0,
  decision: {
    status: proposal.decision.status,
    tone: proposal.decision.tone,
    risks: proposal.decision.risks.length,
    premises: proposal.decision.premises.length,
    comparisons: proposal.decision.comparison.length
  },
  contracts: {
    htmlSummary: simulatorHtml.includes('proposal-summary-container'),
    appContext: appJs.includes('decisionContext: getDecisionContextSnapshot()'),
    proposalDecision: proposalSummaryJs.includes('data-simulator-result-decision'),
    historicalSourceDisclosure: proposal.dataSource?.competenceLabel === 'dezembro de 2025',
    availabilityConfirmation: proposal.nextSteps.some((item) => item.title === 'Confirmar disponibilidade atual'),
    builderOption: proposalBuilderJs.includes("key: 'decision'"),
    css: stylesCss.includes('.ps-section--decision')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-result-decision-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
