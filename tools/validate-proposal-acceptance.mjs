import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

class LocalStorageMock {
  constructor() {
    this.store = new Map();
  }

  getItem(key) {
    return this.store.has(key) ? this.store.get(key) : null;
  }

  setItem(key, value) {
    this.store.set(String(key), String(value));
  }

  removeItem(key) {
    this.store.delete(key);
  }
}

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const html = await readText('pages/simulador.html');
const app = await readText('js/app.js');
const proposalSummary = await readText('js/proposal-summary.js');
const service = await readText('js/proposal-acceptance.js');
const css = await readText('css/styles.css');

assert(html.includes('data-proposal-acceptance-panel'), 'simulador.html sem painel de aceite da proposta.');
assert(html.includes('../js/proposal-acceptance.js'), 'simulador.html nao carrega proposal-acceptance.js.');
assert(app.includes('salvarRevisaoProposta'), 'app.js sem salvarRevisaoProposta().');
assert(app.includes('limparRevisaoProposta'), 'app.js sem limparRevisaoProposta().');
assert(app.includes('proposalAcceptance: getCurrentProposalAcceptance()'), 'Payload salvo nao inclui proposalAcceptance.');
assert(proposalSummary.includes('renderAcceptance(data)'), 'proposal-summary.js sem bloco renderAcceptance().');
assert(proposalSummary.includes('ps-section--acceptance'), 'proposal-summary.js sem secao visual de aceite.');
assert(css.includes('.proposal-acceptance-panel'), 'styles.css sem painel de aceite.');
assert(css.includes('.ps-section--acceptance'), 'styles.css sem secao de aceite no PDF.');

const context = {
  console,
  localStorage: new LocalStorageMock(),
  window: null,
  Date,
  JSON,
  Math,
  String,
  Number,
  Object,
  Array
};
context.window = context;
context.globalThis = context;
vm.createContext(context);
vm.runInContext(service, context, { filename: 'js/proposal-acceptance.js' });

assert(context.BFProposalAcceptance && typeof context.BFProposalAcceptance.saveReview === 'function', 'BFProposalAcceptance.saveReview indisponivel.');

const proposal = {
  id: 'PROP-2026-0100',
  cliente: 'Cliente Teste',
  consultor: 'Consultor Teste',
  metrics: { creditoTotal: 100000, parcelaAtual: 1200 },
  lances: { lanceTotal: 30000 }
};

const draft = context.BFProposalAcceptance.createDraft(proposal);
assert(draft.status === 'pending', `Draft deveria ser pending, recebeu ${draft.status}.`);
assert(draft.proposalId === proposal.id, 'Draft nao preserva proposalId.');

const partial = context.BFProposalAcceptance.saveReview({
  proposal,
  reviewer: 'Analista Teste',
  reviewerRole: 'Mesa de revisao',
  validUntil: '2026-05-10',
  notes: 'Validar documentacao antes do handoff.',
  checklist: { premissas: true, cliente: false, documentacao: false }
});
assert(partial && partial.status === 'partial', `Checklist parcial deveria gerar partial, recebeu ${partial && partial.status}.`);

const reviewed = context.BFProposalAcceptance.saveReview({
  proposal,
  reviewer: 'Analista Teste',
  reviewerRole: 'Mesa de revisao',
  validUntil: '2026-05-10',
  notes: 'Premissas revisadas.',
  checklist: { premissas: true, cliente: true, documentacao: true }
});
assert(reviewed && reviewed.status === 'reviewed', `Checklist completo deveria gerar reviewed, recebeu ${reviewed && reviewed.status}.`);
assert(reviewed && reviewed.version === 2, `Segunda revisao deveria ser versao 2, recebeu ${reviewed && reviewed.version}.`);

const latest = context.BFProposalAcceptance.latest(proposal.id);
assert(latest && latest.status === 'reviewed', 'latest() nao retornou a revisao completa.');
assert(context.BFProposalAcceptance.history(proposal.id, 5).length === 2, 'history() deveria retornar duas revisoes.');
assert(context.BFProposalAcceptance.clear(proposal.id), 'clear() retornou falso.');
assert(context.BFProposalAcceptance.history(proposal.id, 5).length === 0, 'clear() nao removeu revisoes.');

const report = {
  ok: failures.length === 0,
  uiContract: {
    htmlPanel: html.includes('data-proposal-acceptance-panel'),
    serviceScript: html.includes('../js/proposal-acceptance.js'),
    appSave: app.includes('salvarRevisaoProposta'),
    pdfBlock: proposalSummary.includes('ps-section--acceptance'),
    cssPanel: css.includes('.proposal-acceptance-panel')
  },
  serviceContract: {
    draftStatus: draft.status,
    partialStatus: partial && partial.status,
    reviewedStatus: reviewed && reviewed.status,
    reviewedVersion: reviewed && reviewed.version
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8ae-proposal-acceptance-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
