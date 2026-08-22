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
const governance = await readText('js/proposal-governance.js');
const contracts = await readText('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md');
const plan = await readText('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md');
const map = await readText('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md');

assert(html.includes('js/proposal-governance.js'), 'simulador.html sem proposal-governance.js.');
assert(html.indexOf('js/proposal-versioning.js') < html.indexOf('js/proposal-governance.js'), 'proposal-governance.js deve carregar depois de proposal-versioning.js.');
assert(html.indexOf('js/proposal-governance.js') < html.indexOf('js/app.js'), 'proposal-governance.js deve carregar antes de app.js.');
assert(app.includes('BFProposalGovernance'), 'app.js nao delega governanca para BFProposalGovernance.');
assert(app.includes('readAcceptanceForm'), 'app.js nao usa leitura centralizada do formulario de aceite.');
assert(governance.includes('BFProposalGovernance'), 'proposal-governance.js sem export global.');
assert(governance.includes('data-proposal-version-comparison'), 'proposal-governance.js sem marcador de comparacao de versoes.');
assert(governance.includes('data-proposal-version-history'), 'proposal-governance.js sem historico de versoes.');
assert(governance.includes('data-proposal-handoff-bridge'), 'proposal-governance.js sem ponte de handoff.');
assert(governance.includes('data-proposal-acceptance-history'), 'proposal-governance.js sem historico de aceite.');
assert(contracts.includes('BFProposalGovernance'), 'Contratos publicos sem BFProposalGovernance.');
assert(plan.includes('BFProposalGovernance'), 'Plano de acao sem BFProposalGovernance.');
assert(map.includes('js/proposal-governance.js'), 'Mapa completo sem proposal-governance.js.');

const context = {
  console,
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array,
  document: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(governance, context, { filename: 'js/proposal-governance.js' });

const api = context.BFProposalGovernance;
assert(api && typeof api.renderVersionPanel === 'function', 'renderVersionPanel indisponivel.');
assert(api && typeof api.renderAcceptancePanel === 'function', 'renderAcceptancePanel indisponivel.');
assert(api && typeof api.readAcceptanceForm === 'function', 'readAcceptanceForm indisponivel.');

const helpers = {
  formatMoney: (value) => `R$ ${Number(value || 0).toFixed(2)}`,
  formatNumber: (value, decimals = 1) => Number(value || 0).toFixed(decimals)
};

const comparison = {
  statusChanged: true,
  left: { statusLabel: 'Parcial' },
  right: { statusLabel: 'Revisada' },
  changedMetrics: [{ key: 'parcelaAtual', label: 'Parcela', before: 1000, after: 1200, delta: 200 }],
  changedBuilder: [{ key: 'sections', label: 'Blocos', before: 4, after: 5, delta: 1 }]
};

const versionPanel = api.renderVersionPanel({
  currentSnapshot: {
    cliente: 'Cliente Teste',
    proposalId: 'PROP-001',
    metrics: { creditoTotal: 100000, parcelaAtual: 1200 },
    builder: { sections: 4, sectionsTotal: 6, charts: 2, chartsTotal: 3, concepts: 1, conceptsTotal: 2, formulas: 2, formulasTotal: 4 }
  },
  history: [{ version: 1, versionLabel: 'v1', statusLabel: 'Revisada', savedAtLabel: 'hoje', builder: { sections: 4, sectionsTotal: 6 } }],
  saved: true,
  comparison
}, helpers);

const acceptancePanel = api.renderAcceptancePanel({
  proposal: { id: 'PROP-001', consultor: 'Consultor Teste' },
  current: {
    status: 'reviewed',
    statusLabel: 'Revisada localmente',
    version: 2,
    reviewer: 'Consultor Teste',
    reviewerRole: 'Consultor',
    validUntil: '2026-05-20',
    notes: 'Premissas revisadas.',
    checklist: { premissas: true, cliente: true, documentacao: true, disponibilidade: true }
  },
  history: [{ statusLabel: 'Revisada localmente', version: 2, reviewer: 'Consultor Teste', updatedAt: '2026-05-11T12:00:00.000Z' }],
  handoff: { id: 'LEAD-001' }
});

const mockRoot = {
  getElementById(id) {
    const values = {
      proposalReviewer: { value: 'Ana' },
      proposalReviewerRole: { value: 'Mesa' },
      proposalValidUntil: { value: '2026-05-20' },
      proposalReviewNotes: { value: 'Ok' },
      proposalCheckPremissas: { checked: true },
      proposalCheckCliente: { checked: false },
      proposalCheckDocumentacao: { checked: true }
    };
    return values[id] || null;
  }
};
const form = api.readAcceptanceForm(mockRoot);

assert(versionPanel.status === 'saved', 'Painel de versao deveria retornar status saved.');
assert(versionPanel.count === 1, 'Painel de versao deveria retornar count 1.');
assert(versionPanel.html.includes('data-proposal-version-comparison'), 'Painel de versao sem comparacao renderizada.');
assert(versionPanel.html.includes('R$ 100000.00'), 'Painel de versao nao usa helper de moeda.');
assert(acceptancePanel.ready === true, 'Painel de aceite deveria estar ready.');
assert(acceptancePanel.handoffReady === true, 'Painel de aceite deveria indicar handoff pronto.');
assert(acceptancePanel.html.includes('data-proposal-handoff-bridge'), 'Painel de aceite sem ponte de handoff.');
assert(form.reviewer === 'Ana', 'readAcceptanceForm nao le reviewer.');
assert(form.checklist.premissas === true && form.checklist.cliente === false, 'readAcceptanceForm nao le checklist.');

const report = {
  ok: failures.length === 0,
  contracts: {
    scriptOrder: html.indexOf('js/proposal-versioning.js') < html.indexOf('js/proposal-governance.js') && html.indexOf('js/proposal-governance.js') < html.indexOf('js/app.js'),
    appDelegates: app.includes('BFProposalGovernance'),
    versionComparison: governance.includes('data-proposal-version-comparison'),
    acceptanceBridge: governance.includes('data-proposal-handoff-bridge'),
    formRead: form.reviewer
  },
  panels: {
    versionStatus: versionPanel.status,
    versionCount: versionPanel.count,
    acceptanceReady: acceptancePanel.ready,
    handoffReady: acceptancePanel.handoffReady
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/proposal-governance-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
