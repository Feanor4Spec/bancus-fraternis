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
const governance = await readText('js/proposal-governance.js');
const css = await readText('css/styles.css');

assert(html.includes('data-proposal-acceptance-panel'), 'simulador.html sem painel de aceite da proposta.');
assert(html.includes('../js/proposal-acceptance.js'), 'simulador.html nao carrega proposal-acceptance.js.');
assert(html.includes('../js/proposal-governance.js'), 'simulador.html nao carrega proposal-governance.js.');
assert(app.includes('salvarRevisaoProposta'), 'app.js sem salvarRevisaoProposta().');
assert(app.includes('limparRevisaoProposta'), 'app.js sem limparRevisaoProposta().');
assert(app.includes('BFProposalGovernance'), 'app.js nao delega painel de aceite para BFProposalGovernance.');
assert(governance.includes('data-proposal-acceptance-history'), 'proposal-governance.js sem historico de aceite.');
assert(governance.includes('data-proposal-handoff-bridge'), 'proposal-governance.js sem ponte de handoff.');
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
  clienteCpf: '52998224725',
  clienteEmail: 'cliente.teste@example.com',
  clienteTelefone: '11999998888',
  metrics: { creditoTotal: 100000, parcelaAtual: 1200 },
  lances: { lanceTotal: 30000 }
};

const future = new Date();
future.setDate(future.getDate() + 30);
const validUntil = future.toISOString().slice(0, 10);

const draft = context.BFProposalAcceptance.createDraft(proposal);
assert(draft.status === 'pending', `Draft deveria ser pending, recebeu ${draft.status}.`);
assert(draft.proposalId === proposal.id, 'Draft nao preserva proposalId.');

const partial = context.BFProposalAcceptance.saveReview({
  proposal,
  reviewer: 'Analista Teste',
  reviewerRole: 'Mesa de revisao',
  validUntil,
  notes: 'Validar com cliente.teste@example.com e telefone 11999998888.',
  checklist: { premissas: true, cliente: false, documentacao: false }
});
assert(partial && partial.status === 'partial', `Checklist parcial deveria gerar partial, recebeu ${partial && partial.status}.`);

const reviewed = context.BFProposalAcceptance.saveReview({
  proposal,
  reviewer: 'Analista Teste',
  reviewerRole: 'Mesa de revisao',
  validUntil,
  notes: 'Premissas revisadas para o CPF 52998224725.',
  checklist: { premissas: true, cliente: true, documentacao: true }
});
assert(reviewed && reviewed.status === 'reviewed', `Checklist completo deveria gerar reviewed, recebeu ${reviewed && reviewed.status}.`);
assert(reviewed && reviewed.version === 2, `Segunda revisao deveria ser versao 2, recebeu ${reviewed && reviewed.version}.`);

const latest = context.BFProposalAcceptance.latest(proposal.id);
assert(latest && latest.status === 'reviewed', 'latest() nao retornou a revisao completa.');
assert(context.BFProposalAcceptance.history(proposal.id, 5).length === 2, 'history() deveria retornar duas revisoes.');
assert(latest && latest.reviewer === 'Analista Teste', 'Detalhe de revisor deveria permanecer disponivel em memoria na sessao.');
assert(latest && latest.notes.includes('52998224725'), 'Nota deveria permanecer disponivel em memoria na sessao.');
assert(latest && latest.snapshot.cliente === 'Cliente Teste', 'Nome do cliente deveria permanecer disponivel em memoria na sessao.');

const acceptanceStorageKey = 'bank_fratern_proposal_acceptances_v1';
const rawAcceptance = context.localStorage.getItem(acceptanceStorageKey) || '';
const persistedAcceptance = JSON.parse(rawAcceptance || '[]');
const hasForbiddenAcceptanceShape = (records) => (Array.isArray(records) ? records : []).some((record) => {
  const snapshot = record && record.snapshot && typeof record.snapshot === 'object' ? record.snapshot : {};
  return ['reviewer', 'reviewerRole', 'notes'].some((key) => Object.prototype.hasOwnProperty.call(record || {}, key))
    || ['cliente', 'consultor'].some((key) => Object.prototype.hasOwnProperty.call(snapshot, key));
});
assert(!hasForbiddenAcceptanceShape(persistedAcceptance), 'localStorage de aceite contem campos identificadores ou notas livres.');
[
  'Cliente Teste',
  'Consultor Teste',
  'Analista Teste',
  'cliente.teste@example.com',
  '11999998888',
  '52998224725'
].forEach((secret) => assert(!rawAcceptance.includes(secret), `localStorage de aceite expoe dado sensivel: ${secret}.`));

assert(context.BFProposalAcceptance.clear(proposal.id), 'clear() retornou falso.');
assert(context.BFProposalAcceptance.history(proposal.id, 5).length === 0, 'clear() nao removeu revisoes.');

context.localStorage.setItem(acceptanceStorageKey, JSON.stringify([{
  schema: 'bank-fratern.proposal-acceptance.v1',
  id: 'REV-LEGACY-1',
  proposalId: 'PROP-LEGACY-1',
  status: 'reviewed',
  reviewer: 'Revisor Legado',
  reviewerRole: 'Mesa Legada',
  notes: 'Nota legada com telefone 11888887777.',
  validUntil,
  checklist: { premissas: true, cliente: true, documentacao: true },
  version: 1,
  snapshot: {
    cliente: 'Cliente Legado',
    consultor: 'Consultor Legado',
    creditoTotal: 90000,
    parcelaAtual: 900,
    lanceTotal: 9000
  }
}]));
assert(context.BFProposalAcceptance.history('PROP-LEGACY-1', 5).length === 1, 'Migracao de aceite legado perdeu metadados operacionais.');
const migratedAcceptanceRaw = context.localStorage.getItem(acceptanceStorageKey) || '';
assert(!/Revisor Legado|Mesa Legada|Nota legada|Cliente Legado|Consultor Legado|11888887777/.test(migratedAcceptanceRaw), 'Migracao nao removeu PII legado do localStorage de aceite.');
assert(!hasForbiddenAcceptanceShape(JSON.parse(migratedAcceptanceRaw || '[]')), 'Migracao manteve chaves sensiveis no aceite legado.');
context.BFProposalAcceptance.clear('PROP-LEGACY-1');

const report = {
  ok: failures.length === 0,
  uiContract: {
    htmlPanel: html.includes('data-proposal-acceptance-panel'),
    serviceScript: html.includes('../js/proposal-acceptance.js'),
    governanceScript: html.includes('../js/proposal-governance.js'),
    appSave: app.includes('salvarRevisaoProposta'),
    appDelegates: app.includes('BFProposalGovernance'),
    pdfBlock: proposalSummary.includes('ps-section--acceptance'),
    cssPanel: css.includes('.proposal-acceptance-panel')
  },
  serviceContract: {
    draftStatus: draft.status,
    partialStatus: partial && partial.status,
    reviewedStatus: reviewed && reviewed.status,
    reviewedVersion: reviewed && reviewed.version,
    liveDetailsPreserved: latest && latest.reviewer === 'Analista Teste' && latest.snapshot.cliente === 'Cliente Teste',
    localStoragePIIFree: !hasForbiddenAcceptanceShape(persistedAcceptance),
    legacyPIIPurged: !/Revisor Legado|Cliente Legado|Consultor Legado/.test(migratedAcceptanceRaw)
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
