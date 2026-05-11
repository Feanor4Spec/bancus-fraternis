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
  'data-handoff-proposal-version',
  'data-handoff-action-plan',
  'data-handoff-action-execution',
  'data-handoff-action-reason',
  'data-handoff-action-history',
  'data-handoff-commercial-stage',
  'data-handoff-commercial-stage-panel',
  'data-handoff-commercial-stage-history',
  'commercialStage',
  'commercialStageChip',
  'commercialStagePanel',
  'proposalVersionPanel',
  'actionPlan',
  'actionExecutionPanel',
  'matchesAging',
  'hydrateAssigneeOptions',
  'data-handoff-next-step',
  'Etapas paradas',
  'Movidos 24h',
  'Cadencia comercial'
].forEach((marker) => assert(uiSource.includes(marker), `handoff-consultivo.js sem ${marker}.`));

[
  'operationalState',
  'proposalState',
  'actionPlan',
  'actionExecution',
  'setActionExecution',
  'actionHistory',
  'actionAudit',
  'consultantBoard',
  'COMMERCIAL_STAGE_STATE_KEY',
  'COMMERCIAL_STAGE_AUDIT_KEY',
  'commercialStageDefinitions',
  'commercialStageState',
  'commercialStageAudit',
  'commercialStageFor',
  'commercialStale',
  'commercialMoved24',
  'bf_admin_commercial_stage_states_v1',
  'bf_admin_commercial_stage_audit_v1',
  'slaHoursForPriority',
  'ageLabel',
  'enrichList',
  'overdue',
  'unassigned',
  'proposalExpired',
  'proposalUnversioned'
].forEach((marker) => assert(serviceSource.includes(marker), `handoff-consultivo.service.js sem ${marker}.`));

[
  '.bf-handoff-consultant-grid',
  '.bf-handoff-action-grid',
  '.bf-handoff-action',
  '.bf-handoff-aging',
  '.bf-handoff-next-step',
  '.bf-handoff-action-plan',
  '.bf-action-execution',
  '.bf-handoff-proposal-panel',
  '.bf-handoff-proposal-chip',
  '.bf-handoff-commercial-chip',
  '.bf-handoff-commercial-panel',
  '.bf-handoff-commercial-stage-tag',
  '.bf-handoff-action-commercial'
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
assert(service && typeof service.actionPlan === 'function', 'actionPlan indisponivel.');
assert(service && typeof service.setActionExecution === 'function', 'setActionExecution indisponivel.');
assert(service && typeof service.commercialStageState === 'function', 'commercialStageState indisponivel.');
assert(service && typeof service.commercialStageAudit === 'function', 'commercialStageAudit indisponivel.');

context.localStorage.setItem('bf_admin_commercial_stage_states_v1', JSON.stringify({
  'LEAD-WAIT': {
    handoffId: 'LEAD-WAIT',
    stage: 'followup',
    stageLabel: 'Follow-up',
    status: 'aguardando_cliente',
    updatedAt: '2026-05-04T12:00:00.000Z',
    updatedBy: 'admin@bankfratern.local'
  }
}));
context.localStorage.setItem('bf_admin_commercial_stage_audit_v1', JSON.stringify([
  {
    id: 'CST-1',
    handoffId: 'LEAD-WAIT',
    fromStage: 'proposta',
    fromLabel: 'Proposta',
    toStage: 'followup',
    toLabel: 'Follow-up',
    status: 'aguardando_cliente',
    actorEmail: 'admin@bankfratern.local',
    createdAt: '2026-05-04T12:00:00.000Z'
  }
]));

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
const expiredProposalLead = {
  id: 'LEAD-PROP-EXPIRED',
  status: 'em_atendimento',
  priority: 'media',
  ownerEmail: 'cliente4@bankfratern.local',
  objectiveLabel: 'Proposta expirada',
  sourceType: 'proposal',
  sourceProposalId: 'PROP-EXP',
  sourceProposalStatus: 'reviewed',
  sourceProposalVersion: 2,
  sourceProposalVersionId: 'PV-EXP-2',
  sourceProposalVersionHash: 'HASH2',
  sourceProposalValidUntil: '2026-05-01',
  sourceProposalUpdatedAt: '2026-05-08T10:00:00.000Z',
  createdAt: '2026-05-08T10:00:00.000Z',
  updatedAt: '2026-05-08T10:00:00.000Z',
  assignedTo: 'ana@bankfratern.local',
  checklist: []
};

const overdueState = service.operationalState(overdueLead, referenceNow);
const waitingState = service.operationalState(waitingLead, referenceNow);
const qualifiedState = service.operationalState(qualifiedLead, referenceNow);
const expiredProposalState = service.proposalState(expiredProposalLead, referenceNow);
const expiredProposalAction = service.actionPlan(expiredProposalLead, referenceNow);
const commercialStage = service.commercialStageState(waitingLead, referenceNow);
const commercialBoard = service.consultantBoard([waitingLead], referenceNow);
const executedAction = service.setActionExecution(expiredProposalAction, {
  status: 'concluida',
  reason: 'Validade revisada no teste automatizado.',
  owner: expiredProposalAction.owner
});
const executedState = service.actionExecution(expiredProposalAction);
const executedHistory = service.actionHistory(expiredProposalAction);
const board = service.consultantBoard([overdueLead, waitingLead, qualifiedLead], referenceNow);
const proposalBoard = service.consultantBoard([overdueLead, expiredProposalLead], referenceNow);

assert(overdueState.slaOverdue === true, 'Lead alta prioridade nao marcou SLA vencido.');
assert(overdueState.unassigned === true, 'Lead sem responsavel nao marcou unassigned.');
assert(overdueState.nextStep === 'Atribuir consultor', `Proximo passo inesperado: ${overdueState.nextStep}.`);
assert(waitingState.waitingClient === true, 'Lead aguardando cliente 48h+ nao foi marcado.');
assert(qualifiedState.open === false, 'Lead qualificado ainda aparece como aberto.');
assert(expiredProposalState.expired === true, 'Proposta vencida nao foi detectada.');
assert(expiredProposalState.nextStep === 'Revisar validade da proposta', `Proximo passo da proposta vencida inesperado: ${expiredProposalState.nextStep}.`);
assert(expiredProposalAction.type === 'proposal', `Plano da proposta vencida deveria ser proposal; recebeu ${expiredProposalAction.type}.`);
assert(expiredProposalAction.deadlineLabel === 'Hoje', `Prazo da proposta vencida deveria ser Hoje; recebeu ${expiredProposalAction.deadlineLabel}.`);
assert(expiredProposalAction.ctaLabel === 'Abrir proposta', `CTA da proposta vencida inesperado: ${expiredProposalAction.ctaLabel}.`);
assert(commercialStage.key === 'followup', `Etapa comercial deveria ser followup; recebeu ${commercialStage.key}.`);
assert(commercialStage.status === 'aguardando_cliente', `Status comercial deveria ser aguardando_cliente; recebeu ${commercialStage.status}.`);
assert(commercialStage.stale === true, 'Etapa comercial antiga nao foi marcada como parada.');
assert(commercialStage.historyLabel.includes('Proposta'), 'Historico comercial nao preservou origem Proposta.');
assert(commercialBoard.commercialStale === 1, `Board comercial deveria ter 1 etapa parada; recebeu ${commercialBoard.commercialStale}.`);
assert(commercialBoard.commercialMoved24 === 0, `Board comercial nao deveria contar movimento antigo em 24h; recebeu ${commercialBoard.commercialMoved24}.`);
assert(commercialBoard.nextActions[0].commercialStage.key === 'followup', 'Proxima acao nao herdou etapa comercial followup.');
assert(executedAction && executedAction.status === 'concluida', 'Execucao da acao nao foi marcada como concluida.');
assert(executedState.reason.includes('Validade revisada'), 'Motivo da execucao nao foi persistido.');
assert(executedHistory.length >= 1, 'Historico da acao nao registrou evento.');
assert(board.open === 2, `Board deveria ter 2 abertos; recebeu ${board.open}.`);
assert(board.overdue === 2, `Board deveria ter 2 SLA vencidos; recebeu ${board.overdue}.`);
assert(board.waiting === 1, `Board deveria ter 1 aguardando; recebeu ${board.waiting}.`);
assert(board.unassigned === 1, `Board deveria ter 1 sem responsavel; recebeu ${board.unassigned}.`);
assert(board.nextActions.length === 2, `Board deveria listar 2 proximas acoes; recebeu ${board.nextActions.length}.`);
assert(board.nextActions[0].id === 'LEAD-SLA', 'Lead de alta prioridade nao ficou no topo das proximas acoes.');
assert(board.nextActions[0].deadlineLabel, 'Proxima acao nao trouxe prazo operacional.');
assert(board.nextActions[0].actionOwner, 'Proxima acao nao trouxe dono operacional.');
assert(proposalBoard.proposalExpired === 1, `Board deveria ter 1 proposta vencida; recebeu ${proposalBoard.proposalExpired}.`);
assert(proposalBoard.proposalUnversioned === 1, `Board deveria ter 1 proposta sem snapshot; recebeu ${proposalBoard.proposalUnversioned}.`);

const report = {
  ok: failures.length === 0,
  cockpit: {
    marker: pageHtml.includes('data-handoff-consultant-cockpit'),
    nextActions: board.nextActions.length,
    overdue: board.overdue,
    unassigned: board.unassigned,
    waiting: board.waiting
  },
  proposal: {
    expired: proposalBoard.proposalExpired,
    unversioned: proposalBoard.proposalUnversioned,
    expiredNextStep: expiredProposalState.nextStep,
    expiredActionType: expiredProposalAction.type,
    expiredDeadline: expiredProposalAction.deadlineLabel,
    executionStatus: executedState.status,
    executionHistory: executedHistory.length
  },
  commercial: {
    stage: commercialStage.key,
    stale: commercialStage.stale,
    history: commercialStage.historyLabel,
    boardStale: commercialBoard.commercialStale,
    moved24: commercialBoard.commercialMoved24
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
