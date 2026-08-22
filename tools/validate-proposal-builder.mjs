import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const html = await readText('pages/simulador.html');
const app = await readText('js/app.js');
const proposalSummary = await readText('js/proposal-summary.js');
const proposalBuilder = await readText('js/proposal-builder.js');
const css = await readText('css/styles.css');

assert(html.includes('data-proposal-builder-board'), 'simulador.html sem lousa de exportacao da proposta.');
assert(html.includes('proposal-builder-board'), 'simulador.html sem container visual da lousa.');
assert(html.includes('js/proposal-builder.js'), 'simulador.html sem modulo proposal-builder.js.');
assert(html.indexOf('js/proposal-summary.js') < html.indexOf('js/proposal-builder.js'), 'proposal-builder.js deve carregar depois de proposal-summary.js.');
assert(html.indexOf('js/proposal-builder.js') < html.indexOf('js/app.js'), 'proposal-builder.js deve carregar antes de app.js.');

assert(proposalBuilder.includes('bank_fratern_proposal_builder_v1'), 'proposal-builder.js sem chave de persistencia da lousa.');
assert(proposalBuilder.includes('BFProposalBuilder'), 'proposal-builder.js sem export global BFProposalBuilder.');
assert(app.includes('renderProposalBuilderBoard'), 'app.js sem renderProposalBuilderBoard().');
assert(app.includes('toggleProposalBuilderOption'), 'app.js sem toggleProposalBuilderOption().');
assert(app.includes('applyProposalBuilderPreset'), 'app.js sem applyProposalBuilderPreset().');
assert(app.includes('setProposalBuilderGroup'), 'app.js sem setProposalBuilderGroup().');
assert(app.includes('setProposalBuilderAll'), 'app.js sem setProposalBuilderAll().');
assert(app.includes('BFProposalBuilder'), 'app.js nao delega regras da lousa para BFProposalBuilder.');
assert(app.includes('proposalBuilderPresetConfig'), 'app.js sem presets da lousa.');
assert(proposalBuilder.includes("preset === 'consultiva'"), 'proposal-builder.js sem preset consultiva.');
assert(proposalBuilder.includes("preset === 'tecnica'"), 'proposal-builder.js sem preset tecnica.');
assert(app.includes('proposalBuilderReadinessIssues'), 'app.js sem leitura de prontidao da lousa.');
assert(app.includes('proposalBuilderPageEstimate'), 'app.js sem estimativa de paginas da lousa.');
assert(app.includes('data-proposal-builder-readiness'), 'app.js sem marcador data-proposal-builder-readiness.');
assert(app.includes('data-proposal-builder-option'), 'app.js sem marcador data-proposal-builder-option.');
assert(app.includes('builder') && app.includes("rootId: 'proposal-export-root'"), 'app.js nao passa builder ao ProposalSummary da proposta.');

assert(proposalSummary.includes('proposalBuilderDefaults'), 'proposal-summary.js sem defaults da lousa.');
assert(proposalSummary.includes('normalizeProposalBuilder'), 'proposal-summary.js sem normalizador da lousa.');
assert(proposalSummary.includes('buildResultDecision'), 'proposal-summary.js sem decisao final do resultado.');
assert(proposalSummary.includes('data-simulator-result-decision'), 'proposal-summary.js sem marcador da decisao final.');
assert(proposalSummary.includes('renderConceptsSection'), 'proposal-summary.js sem secao de conceitos.');
assert(proposalSummary.includes('renderFormulaExplanations'), 'proposal-summary.js sem secao de formulas.');
assert(proposalSummary.includes('isChartEnabled'), 'proposal-summary.js sem controle seletivo de graficos.');
assert(proposalSummary.includes('renderDisabledChart'), 'proposal-summary.js sem fallback visual para grafico removido.');
assert(proposalSummary.includes('data-proposal-selection-summary'), 'proposal-summary.js sem resumo de selecao da lousa no PDF.');
assert(proposalSummary.includes("return '';"), 'proposal-summary.js deve omitir grafico desmarcado da proposta final.');
assert(proposalBuilder.includes("key: 'decision'"), 'proposal-builder.js sem opcao de decisao final.');

assert(css.includes('.proposal-builder-board'), 'styles.css sem estilos da lousa.');
assert(css.includes('.ps-section--decision'), 'styles.css sem estilos da decisao final.');
assert(css.includes('.proposal-builder-option'), 'styles.css sem opcoes da lousa.');
assert(css.includes('.proposal-builder-readiness'), 'styles.css sem estilos da prontidao da lousa.');
assert(css.includes('.proposal-builder-group__actions'), 'styles.css sem acoes por grupo da lousa.');
assert(css.includes('.ps-pdf-plan__facts'), 'styles.css sem resumo de selecao no PDF.');
assert(css.includes('.ps-section--concepts'), 'styles.css sem estilos da secao de conceitos.');
assert(css.includes('.ps-section--formulas'), 'styles.css sem estilos da secao de formulas.');
assert(css.includes('.ps-chart-disabled'), 'styles.css sem fallback de grafico removido.');

const context = {
  console,
  Date,
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
vm.runInContext(`${proposalSummary}\nglobalThis.__ProposalSummary = ProposalSummary;`, context, {
  filename: 'js/proposal-summary.js'
});
vm.runInContext(proposalBuilder, context, {
  filename: 'js/proposal-builder.js'
});

const summary = context.__ProposalSummary;
assert(summary && typeof summary.normalizeProposalBuilder === 'function', 'normalizeProposalBuilder indisponivel em runtime.');
assert(summary && typeof summary.presentationStatus === 'function', 'Allowlist visual de status indisponivel em runtime.');
assert(summary && summary.proposalBuilderDefaults, 'proposalBuilderDefaults indisponivel em runtime.');
const builder = context.BFProposalBuilder;
assert(builder && typeof builder.normalizeConfig === 'function', 'BFProposalBuilder.normalizeConfig indisponivel em runtime.');
assert(builder && typeof builder.presetConfig === 'function', 'BFProposalBuilder.presetConfig indisponivel em runtime.');
assert(builder && typeof builder.readinessIssues === 'function', 'BFProposalBuilder.readinessIssues indisponivel em runtime.');

const normalized = summary.normalizeProposalBuilder({
  sections: { schedule: false, concepts: false },
  charts: { bid: false },
  concepts: { seguro: false },
  formulas: { parcelaBase: false }
});

assert(normalized.sections.schedule === false, 'Normalizador nao preserva secao schedule=false.');
assert(normalized.sections.header === true, 'Normalizador nao preserva default header=true.');
assert(normalized.sections.decision === true, 'Normalizador nao preserva default decision=true.');
assert(normalized.charts.bid === false, 'Normalizador nao preserva grafico bid=false.');
assert(normalized.charts.composition === true, 'Normalizador nao preserva default composition=true.');
assert(normalized.concepts.seguro === false, 'Normalizador nao preserva conceito seguro=false.');
assert(normalized.formulas.parcelaBase === false, 'Normalizador nao preserva formula parcelaBase=false.');

const consultiva = builder.presetConfig('consultiva');
const tecnica = builder.presetConfig('tecnica');
const compacta = builder.presetConfig('compacta');
assert(consultiva.sections.schedule === false, 'Preset consultiva deveria ocultar cronograma.');
assert(consultiva.concepts.consorcio === true && consultiva.concepts.seguro === false, 'Preset consultiva nao seleciona conceitos esperados.');
assert(tecnica.sections.formulas === true && tecnica.sections.concepts === false, 'Preset tecnica nao prioriza memoria de calculo.');
assert(compacta.sections.header === true && compacta.sections.schedule === false, 'Preset compacta nao reduz blocos corretamente.');
assert(compacta.sections.decision === true, 'Preset compacta deve manter decisao final.');
assert(builder.focusLabel(consultiva) === 'Com explicações', 'focusLabel nao reconhece o foco explicativo do preset consultiva.');
assert(builder.pageEstimate(tecnica) >= 1, 'pageEstimate deve retornar ao menos 1 pagina.');
assert(builder.readinessIssues(builder.presetConfig('completa')).length === 0, 'Preset completo nao deveria ter pendencias.');
const emptyConfig = builder.presetConfig('completa');
Object.keys(emptyConfig.sections).forEach((key) => { emptyConfig.sections[key] = false; });
assert(builder.readinessIssues(emptyConfig).includes('Nenhuma seção selecionada para o PDF.'), 'readinessIssues nao identifica configuracao vazia.');

const hostileStatus = 'done\"><img data-xss-probe src=x>';
const hostileProposal = summary.createMockData();
hostileProposal.journey[0].status = hostileStatus;
hostileProposal.productPhases[0].status = hostileStatus;
const hostileTarget = { id: 'proposal-hostile-status', innerHTML: '' };
summary.render(hostileTarget, { proposalData: hostileProposal }, {
  rootId: 'proposal-hostile-root',
  chartPrefix: 'proposal-hostile',
  surface: 'public'
});
assert(!hostileTarget.innerHTML.includes('data-xss-probe'), 'Status hostil criou markup na proposta.');
assert(!hostileTarget.innerHTML.includes(hostileStatus), 'Status hostil foi interpolado na proposta.');
assert(summary.presentationStatus(hostileStatus) === 'upcoming', 'Status fora da allowlist nao usa fallback seguro.');
['done', 'current', 'upcoming'].forEach((status) => {
  assert(summary.presentationStatus(status) === status, `Status visual valido foi alterado: ${status}.`);
});

const defaults = summary.proposalBuilderDefaults;
const report = {
  ok: failures.length === 0,
  counts: {
    sections: Object.keys(defaults.sections || {}).length,
    charts: Object.keys(defaults.charts || {}).length,
    concepts: Object.keys(defaults.concepts || {}).length,
    formulas: Object.keys(defaults.formulas || {}).length
  },
  contracts: {
    htmlBoard: html.includes('data-proposal-builder-board'),
    scriptOrder: html.indexOf('js/proposal-summary.js') < html.indexOf('js/proposal-builder.js') && html.indexOf('js/proposal-builder.js') < html.indexOf('js/app.js'),
    appDelegates: app.includes('BFProposalBuilder'),
    appStorage: proposalBuilder.includes('bank_fratern_proposal_builder_v1'),
    builderService: proposalBuilder.includes('BFProposalBuilder'),
    proposalBuilder: proposalSummary.includes('normalizeProposalBuilder'),
    conceptsSection: proposalSummary.includes('renderConceptsSection'),
    formulasSection: proposalSummary.includes('renderFormulaExplanations'),
    readinessPanel: app.includes('data-proposal-builder-readiness'),
    groupActions: app.includes('setProposalBuilderGroup'),
    selectionSummary: proposalSummary.includes('data-proposal-selection-summary'),
    hostileStatusRejected: !hostileTarget.innerHTML.includes('data-xss-probe'),
    presets: {
      consultiva: proposalBuilder.includes("preset === 'consultiva'"),
      tecnica: proposalBuilder.includes("preset === 'tecnica'")
    }
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/proposal-builder-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
