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
const css = await readText('css/styles.css');
const serviceSource = await readText('assets/js/services/handoff-consultivo.service.js');

assert(html.includes('../assets/js/services/handoff-consultivo.service.js'), 'simulador.html nao carrega handoff-consultivo.service.js.');
assert(app.includes('criarHandoffProposta'), 'app.js sem criarHandoffProposta().');
assert(app.includes('data-proposal-handoff-bridge'), 'app.js sem ponte visual data-proposal-handoff-bridge.');
assert(app.includes('proposalHandoffReady'), 'app.js sem estado data-proposal-handoff-ready.');
assert(serviceSource.includes('createFromProposal'), 'handoff-consultivo.service.js sem createFromProposal().');
assert(serviceSource.includes('findByProposal'), 'handoff-consultivo.service.js sem findByProposal().');
assert(css.includes('.proposal-handoff-bridge'), 'styles.css sem estilos da ponte de handoff da proposta.');

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
  Array,
  Error
};
context.window = context;
context.globalThis = context;
context.BFAuth = {
  getCurrentUser() {
    return { email: 'consultor@bankfratern.local', name: 'Consultor Local', role: 'consultor' };
  }
};
vm.createContext(context);
vm.runInContext(serviceSource, context, { filename: 'assets/js/services/handoff-consultivo.service.js' });

const service = context.BFHandoffConsultivoService;
assert(service && typeof service.createFromProposal === 'function', 'BFHandoffConsultivoService.createFromProposal indisponivel.');
assert(service && typeof service.findByProposal === 'function', 'BFHandoffConsultivoService.findByProposal indisponivel.');

const proposal = {
  id: 'PROP-TESTE-900',
  cliente: 'Cliente Teste',
  consultor: 'Consultor Teste',
  produto: 'Consorcio imovel',
  project: { totalCarta: 180000 },
  metrics: {
    creditoTotal: 180000,
    parcelaAtual: 1850,
    prazo: 120
  },
  lances: {
    lanceTotal: 36000
  }
};

const acceptance = {
  proposalId: proposal.id,
  status: 'reviewed',
  statusLabel: 'Revisao completa',
  version: 2,
  reviewer: 'Analista de proposta',
  reviewerRole: 'Mesa de revisao',
  validUntil: '2026-05-15',
  updatedAt: '2026-04-27T20:00:00.000Z',
  notes: 'Premissas conferidas; conduzir documentacao no atendimento.',
  checklist: {
    premissas: true,
    cliente: true,
    documentacao: true,
    disponibilidade: true
  }
};

const handoff = service.createFromProposal(proposal, acceptance, { assignedTo: 'Analista de proposta' });
assert(handoff.id && handoff.id.startsWith('LEAD-'), 'Handoff criado sem id LEAD-.');
assert(handoff.sourceProposalId === proposal.id, 'Handoff nao preserva sourceProposalId.');
assert(handoff.sourceProposalStatus === 'reviewed', 'Handoff nao preserva status da proposta.');
assert(handoff.sourceProposalVersion === 2, 'Handoff nao preserva versao da proposta.');
assert(handoff.status === 'novo', `Handoff deveria iniciar como novo, recebeu ${handoff.status}.`);
assert(handoff.priority === 'alta', `Proposta de alto valor deveria gerar prioridade alta, recebeu ${handoff.priority}.`);
assert(handoff.summary.valorCredito === 180000, 'Resumo do handoff nao preserva valor de credito.');
assert(handoff.summary.capacidadePagamento === 1850, 'Resumo do handoff nao preserva parcela/capacidade.');
assert(handoff.checklist.length === 6, 'Checklist da proposta deveria ter 6 itens.');
assert(handoff.checklist.filter((item) => item.done).length >= 5, 'Checklist da proposta deveria herdar revisao concluida.');
assert(handoff.notes.length === 1, 'Observacao da proposta deveria virar nota local.');

const found = service.findByProposal(proposal.id, 'consultor@bankfratern.local');
assert(found && found.id === handoff.id, 'findByProposal nao encontrou o handoff criado.');

const refreshed = service.createFromProposal({
  ...proposal,
  metrics: { ...proposal.metrics, parcelaAtual: 1900 }
}, {
  ...acceptance,
  version: 3,
  notes: 'Atualizacao da proposta antes do contato.'
});

assert(refreshed.id === handoff.id, 'Segunda chamada deveria atualizar o handoff existente, nao duplicar.');
assert(service.list().length === 1, 'createFromProposal duplicou handoff para a mesma proposta e owner.');
assert(refreshed.sourceProposalVersion === 3, 'Atualizacao nao preservou nova versao da proposta.');
assert(refreshed.summary.capacidadePagamento === 1900, 'Atualizacao nao recalculou resumo da proposta.');

const audit = service.audit();
assert(audit.some((event) => event.action === 'proposal-create' && event.proposalId === proposal.id), 'Auditoria nao registrou proposal-create.');
assert(audit.some((event) => event.action === 'proposal-refresh' && event.proposalId === proposal.id), 'Auditoria nao registrou proposal-refresh.');

const report = {
  ok: failures.length === 0,
  uiContract: {
    simulatorLoadsService: html.includes('../assets/js/services/handoff-consultivo.service.js'),
    appAction: app.includes('criarHandoffProposta'),
    bridgeMarkup: app.includes('data-proposal-handoff-bridge'),
    bridgeCss: css.includes('.proposal-handoff-bridge')
  },
  serviceContract: {
    handoffId: handoff && handoff.id,
    sourceProposalId: handoff && handoff.sourceProposalId,
    refreshedVersion: refreshed && refreshed.sourceProposalVersion,
    totalHandoffs: service.list().length,
    auditEvents: audit.length
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/v8af-proposal-handoff-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
