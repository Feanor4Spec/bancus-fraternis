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

const [pageHtml, uiSource, cssSource, serviceSource, designValidator, contractsDoc] = await Promise.all([
  readText('pages/handoff-consultivo.html'),
  readText('assets/js/handoff-consultivo.js'),
  readText('assets/css/platform.css'),
  readText('assets/js/services/handoff-consultivo.service.js'),
  readText('tools/validate-design-system.mjs'),
  readText('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md')
]);

[
  'data-handoff-consultant-cockpit',
  'data-handoff-assignee-filter',
  'data-handoff-aging-filter',
  '#painel-consultor'
].forEach((marker) => assert(pageHtml.includes(marker), `handoff-consultivo.html sem ${marker}.`));

[
  'renderConsultantCockpit',
  'handoffConsultantCockpitReady',
  'handoffConsultantActionCount',
  'matchesAging',
  'hydrateAssigneeOptions',
  'data-handoff-next-step'
].forEach((marker) => assert(uiSource.includes(marker), `handoff-consultivo.js sem ${marker}.`));

[
  'operationalState',
  'consultantBoard',
  'slaHoursForPriority',
  'ageLabel',
  'enrichList',
  'overdue',
  'unassigned'
].forEach((marker) => assert(serviceSource.includes(marker), `handoff-consultivo.service.js sem ${marker}.`));

[
  '.bf-handoff-consultant-grid',
  '.bf-handoff-action-grid',
  '.bf-handoff-action',
  '.bf-handoff-aging',
  '.bf-handoff-next-step'
].forEach((selector) => assert(cssSource.includes(selector), `platform.css sem seletor ${selector}.`));

assert(designValidator.includes('tools/validate-handoff-consultant-operations.mjs'), 'validate-design-system nao exige validate-handoff-consultant-operations.');
assert(contractsDoc.includes('data-handoff-consultant-cockpit'), 'Contratos publicos nao documentam cockpit do consultor.');
assert(contractsDoc.includes('tools/validate-handoff-consultant-operations.mjs'), 'Contratos publicos nao documentam validador de operacao consultiva.');

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
assert(service && typeof service.operationalState === 'function', 'operationalState indisponivel.');
assert(service && typeof service.consultantBoard === 'function', 'consultantBoard indisponivel.');

const referenceNow = new Date('2026-05-08T12:00:00.000Z');
const overdueLead = {
  id: 'LEAD-SLA',
  status: 'novo',
  priority: 'alta',
  ownerEmail: 'cliente@bankfratern.local',
  objectiveLabel: 'Comprar bem',
  sourceType: 'proposal',
  createdAt: '2026-05-08T02:00:00.000Z',
  updatedAt: '2026-05-08T02:00:00.000Z',
  createdBy: 'consultor@bankfratern.local',
  checklist: [{ id: 'validar', label: 'Validar', required: true, done: false }]
};
const waitingLead = {
  id: 'LEAD-WAIT',
  status: 'aguardando_cliente',
  priority: 'media',
  ownerEmail: 'cliente2@bankfratern.local',
  objectiveLabel: 'Retomar jornada',
  sourceType: 'signal',
  createdAt: '2026-05-05T12:00:00.000Z',
  updatedAt: '2026-05-05T12:00:00.000Z',
  assignedTo: 'ana@bankfratern.local',
  checklist: []
};
const qualifiedLead = {
  id: 'LEAD-OK',
  status: 'qualificado',
  priority: 'baixa',
  ownerEmail: 'cliente3@bankfratern.local',
  objectiveLabel: 'Proposta encerrada',
  sourceType: 'journey',
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:00:00.000Z',
  assignedTo: 'bruno@bankfratern.local',
  checklist: []
};

const overdueState = service.operationalState(overdueLead, referenceNow);
const waitingState = service.operationalState(waitingLead, referenceNow);
const qualifiedState = service.operationalState(qualifiedLead, referenceNow);
const board = service.consultantBoard([overdueLead, waitingLead, qualifiedLead], referenceNow);

assert(overdueState.slaOverdue === true, 'Lead alta prioridade nao marcou SLA vencido.');
assert(overdueState.unassigned === true, 'Lead sem responsavel nao marcou unassigned.');
assert(overdueState.nextStep === 'Atribuir consultor', `Proximo passo inesperado: ${overdueState.nextStep}.`);
assert(waitingState.waitingClient === true, 'Lead aguardando cliente 48h+ nao foi marcado.');
assert(qualifiedState.open === false, 'Lead qualificado ainda aparece como aberto.');
assert(board.open === 2, `Board deveria ter 2 abertos; recebeu ${board.open}.`);
assert(board.overdue === 2, `Board deveria ter 2 SLA vencidos; recebeu ${board.overdue}.`);
assert(board.waiting === 1, `Board deveria ter 1 aguardando; recebeu ${board.waiting}.`);
assert(board.unassigned === 1, `Board deveria ter 1 sem responsavel; recebeu ${board.unassigned}.`);
assert(board.nextActions.length === 2, `Board deveria listar 2 proximas acoes; recebeu ${board.nextActions.length}.`);
assert(board.nextActions[0].id === 'LEAD-SLA', 'Lead de alta prioridade nao ficou no topo das proximas acoes.');

const report = {
  ok: failures.length === 0,
  cockpit: {
    marker: pageHtml.includes('data-handoff-consultant-cockpit'),
    nextActions: board.nextActions.length,
    overdue: board.overdue,
    unassigned: board.unassigned,
    waiting: board.waiting
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/handoff-consultant-operations-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
