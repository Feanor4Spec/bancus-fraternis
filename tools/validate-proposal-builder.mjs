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
const css = await readText('css/styles.css');

assert(html.includes('data-proposal-builder-board'), 'simulador.html sem lousa de exportacao da proposta.');
assert(html.includes('proposal-builder-board'), 'simulador.html sem container visual da lousa.');

assert(app.includes('bank_fratern_proposal_builder_v1'), 'app.js sem chave de persistencia da lousa.');
assert(app.includes('renderProposalBuilderBoard'), 'app.js sem renderProposalBuilderBoard().');
assert(app.includes('toggleProposalBuilderOption'), 'app.js sem toggleProposalBuilderOption().');
assert(app.includes('applyProposalBuilderPreset'), 'app.js sem applyProposalBuilderPreset().');
assert(app.includes('setProposalBuilderGroup'), 'app.js sem setProposalBuilderGroup().');
assert(app.includes('setProposalBuilderAll'), 'app.js sem setProposalBuilderAll().');
assert(app.includes('proposalBuilderPresetConfig'), 'app.js sem presets da lousa.');
assert(app.includes("preset === 'consultiva'"), 'app.js sem preset consultiva.');
assert(app.includes("preset === 'tecnica'"), 'app.js sem preset tecnica.');
assert(app.includes('proposalBuilderReadinessIssues'), 'app.js sem leitura de prontidao da lousa.');
assert(app.includes('proposalBuilderPageEstimate'), 'app.js sem estimativa de paginas da lousa.');
assert(app.includes('data-proposal-builder-readiness'), 'app.js sem marcador data-proposal-builder-readiness.');
assert(app.includes('data-proposal-builder-option'), 'app.js sem marcador data-proposal-builder-option.');
assert(app.includes('builder') && app.includes("rootId: 'proposal-export-root'"), 'app.js nao passa builder ao ProposalSummary da proposta.');

assert(proposalSummary.includes('proposalBuilderDefaults'), 'proposal-summary.js sem defaults da lousa.');
assert(proposalSummary.includes('normalizeProposalBuilder'), 'proposal-summary.js sem normalizador da lousa.');
assert(proposalSummary.includes('renderConceptsSection'), 'proposal-summary.js sem secao de conceitos.');
assert(proposalSummary.includes('renderFormulaExplanations'), 'proposal-summary.js sem secao de formulas.');
assert(proposalSummary.includes('isChartEnabled'), 'proposal-summary.js sem controle seletivo de graficos.');
assert(proposalSummary.includes('renderDisabledChart'), 'proposal-summary.js sem fallback visual para grafico removido.');
assert(proposalSummary.includes('data-proposal-selection-summary'), 'proposal-summary.js sem resumo de selecao da lousa no PDF.');
assert(proposalSummary.includes("return '';"), 'proposal-summary.js deve omitir grafico desmarcado da proposta final.');

assert(css.includes('.proposal-builder-board'), 'styles.css sem estilos da lousa.');
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

const summary = context.__ProposalSummary;
assert(summary && typeof summary.normalizeProposalBuilder === 'function', 'normalizeProposalBuilder indisponivel em runtime.');
assert(summary && summary.proposalBuilderDefaults, 'proposalBuilderDefaults indisponivel em runtime.');

const normalized = summary.normalizeProposalBuilder({
  sections: { schedule: false, concepts: false },
  charts: { bid: false },
  concepts: { seguro: false },
  formulas: { parcelaBase: false }
});

assert(normalized.sections.schedule === false, 'Normalizador nao preserva secao schedule=false.');
assert(normalized.sections.header === true, 'Normalizador nao preserva default header=true.');
assert(normalized.charts.bid === false, 'Normalizador nao preserva grafico bid=false.');
assert(normalized.charts.composition === true, 'Normalizador nao preserva default composition=true.');
assert(normalized.concepts.seguro === false, 'Normalizador nao preserva conceito seguro=false.');
assert(normalized.formulas.parcelaBase === false, 'Normalizador nao preserva formula parcelaBase=false.');

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
    appStorage: app.includes('bank_fratern_proposal_builder_v1'),
    proposalBuilder: proposalSummary.includes('normalizeProposalBuilder'),
    conceptsSection: proposalSummary.includes('renderConceptsSection'),
    formulasSection: proposalSummary.includes('renderFormulaExplanations'),
    readinessPanel: app.includes('data-proposal-builder-readiness'),
    groupActions: app.includes('setProposalBuilderGroup'),
    selectionSummary: proposalSummary.includes('data-proposal-selection-summary'),
    presets: {
      consultiva: app.includes("preset === 'consultiva'"),
      tecnica: app.includes("preset === 'tecnica'")
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
