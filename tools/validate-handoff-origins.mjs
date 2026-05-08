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

const [pageHtml, uiSource, cssSource, serviceSource, adminSource] = await Promise.all([
  readText('pages/handoff-consultivo.html'),
  readText('assets/js/handoff-consultivo.js'),
  readText('assets/css/platform.css'),
  readText('assets/js/services/handoff-consultivo.service.js'),
  readText('assets/js/admin-users.js')
]);

assert(pageHtml.includes('data-handoff-source-filter'), 'handoff-consultivo.html sem filtro data-handoff-source-filter.');
assert(uiSource.includes('sourceType(item)'), 'handoff-consultivo.js sem uso de sourceType(item).');
assert(uiSource.includes('sourceSummary(item)'), 'handoff-consultivo.js sem resumo de origem.');
assert(cssSource.includes('.bf-handoff-source'), 'platform.css sem estilos para origem do handoff.');
assert(adminSource.includes('metrics.proposal'), 'admin-users.js sem metricas de origem de proposta.');
assert(serviceSource.includes('sourceLabels'), 'handoff-consultivo.service.js sem sourceLabels.');
assert(serviceSource.includes('sourceType'), 'handoff-consultivo.service.js sem sourceType.');

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
assert(service && typeof service.sourceType === 'function', 'BFHandoffConsultivoService.sourceType indisponivel.');
assert(service && typeof service.sourceLabel === 'function', 'BFHandoffConsultivoService.sourceLabel indisponivel.');

const journey = service.createFromJourney({
  id: 'JOURNEY-ORIGIN-1',
  owner: 'cliente@bankfratern.local',
  objective: 'comprar_bem',
  objectiveLabel: 'Comprar bem',
  updatedAt: '2026-05-07T10:00:00.000Z',
  profile: { rendaMensal: 12000, gastoMensal: 7000, reservaAtual: 30000 },
  metrics: { reservaMeses: 4, capacidadePagamento: 1800, valorObjetivo: 180000 },
  recommendedProduct: { id: 'consorcio', nome: 'Consorcio' },
  recommendedModel: { id: 'std-compra-bem-planejada', name: 'Compra de bem com planejamento' },
  nextAction: { title: 'Comparar alternativas', href: 'comparador.html?preset=comprar_bem' }
});

const signal = service.createFromSignal({
  id: 'SIGNAL-ORIGIN-1',
  type: 'comparator-abandoned',
  title: 'Comparador sem conclusao',
  reason: 'Usuario selecionou produtos e nao concluiu a matriz.',
  ownerEmail: 'cliente@bankfratern.local',
  severity: 'media',
  productIds: ['financiamento', 'consorcio'],
  latestEventAt: '2026-05-07T11:00:00.000Z'
});

const imported = service.createFromSignal({
  id: 'IMPORT-ORIGIN-1',
  type: 'imported-recovery-item',
  title: 'Retomada importada',
  reason: 'Item recebido por pacote administrativo.',
  ownerEmail: 'cliente2@bankfratern.local',
  severity: 'alta',
  productIds: ['cdc'],
  latestEventAt: '2026-05-07T12:00:00.000Z'
});

const proposal = service.createFromProposal({
  id: 'PROP-ORIGIN-1',
  cliente: 'Cliente Proposta',
  project: { totalCarta: 250000 },
  metrics: { creditoTotal: 250000, parcelaAtual: 2200, prazo: 120 },
  lances: { lanceTotal: 50000 }
}, {
  proposalId: 'PROP-ORIGIN-1',
  status: 'reviewed',
  statusLabel: 'Revisada localmente',
  version: 2,
  validUntil: '2026-06-07',
  checklist: { premissas: true, cliente: true, documentacao: true }
});

assert(service.sourceType(journey) === 'journey', 'Handoff de trilha sem origem journey.');
assert(service.sourceType(signal) === 'signal', 'Handoff de sinal sem origem signal.');
assert(service.sourceType(imported) === 'imported', 'Handoff importado sem origem imported.');
assert(service.sourceType(proposal) === 'proposal', 'Handoff de proposta sem origem proposal.');
assert(service.sourceLabel(proposal) === 'Proposta revisada', 'Label de proposta incorreto.');
assert(service.sourceLabel(imported) === 'Pacote importado', 'Label de pacote importado incorreto.');

const metrics = service.metrics(service.list());
assert(metrics.total === 4, `Esperado 4 handoffs, recebido ${metrics.total}.`);
assert(metrics.journey === 1, `Esperado 1 trilha, recebido ${metrics.journey}.`);
assert(metrics.signal === 1, `Esperado 1 sinal, recebido ${metrics.signal}.`);
assert(metrics.imported === 1, `Esperado 1 importado, recebido ${metrics.imported}.`);
assert(metrics.proposal === 1, `Esperado 1 proposta, recebido ${metrics.proposal}.`);

const report = {
  ok: failures.length === 0,
  uiContract: {
    sourceFilter: pageHtml.includes('data-handoff-source-filter'),
    sourceBadgeCss: cssSource.includes('.bf-handoff-source'),
    adminOriginMetrics: adminSource.includes('metrics.proposal')
  },
  serviceContract: {
    total: metrics.total,
    origins: metrics.origins,
    labels: service.sourceLabels
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/handoff-origins-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
