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
const service = await readText('js/proposal-versioning.js');
const governance = await readText('js/proposal-governance.js');
const handoffService = await readText('assets/js/services/handoff-consultivo.service.js');
const css = await readText('css/styles.css');

assert(html.includes('data-proposal-version-panel'), 'simulador.html sem painel de versionamento da proposta.');
assert(html.includes('../js/proposal-versioning.js'), 'simulador.html nao carrega proposal-versioning.js.');
assert(html.includes('../js/proposal-governance.js'), 'simulador.html nao carrega proposal-governance.js.');
assert(app.includes('salvarVersaoProposta'), 'app.js sem salvarVersaoProposta().');
assert(app.includes('limparVersoesProposta'), 'app.js sem limparVersoesProposta().');
assert(app.includes('BFProposalGovernance'), 'app.js nao delega painel de versoes para BFProposalGovernance.');
assert(governance.includes('data-proposal-version-comparison'), 'proposal-governance.js sem comparacao visual de versoes.');
assert(app.includes('proposalVersion'), 'app.js nao injeta versao da proposta no handoff.');
assert(service.includes('bank_fratern_proposal_versions_v1'), 'proposal-versioning.js sem chave localStorage publica.');
assert(service.includes('compareRecords'), 'proposal-versioning.js sem compareRecords().');
assert(handoffService.includes('sourceProposalVersionId'), 'handoff-consultivo.service.js nao preserva id da versao da proposta.');
assert(css.includes('.proposal-version-panel'), 'styles.css sem painel de versionamento.');

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
vm.runInContext(service, context, { filename: 'js/proposal-versioning.js' });

const api = context.BFProposalVersions;
assert(api && typeof api.save === 'function', 'BFProposalVersions.save indisponivel.');
assert(api && typeof api.compareRecords === 'function', 'BFProposalVersions.compareRecords indisponivel.');

const proposal = {
  id: 'PROP-2026-0200',
  cliente: 'Cliente Teste',
  consultor: 'Consultor Teste',
  clienteCpf: '52998224725',
  clienteEmail: 'cliente.versao@example.com',
  clienteTelefone: '11999997777',
  metrics: {
    creditoTotal: 200000,
    parcelaAtual: 1800,
    totalPlano: 242000,
    totalPago: 0,
    caixaLiquida: 160000,
    saldoDevedor: 200000,
    prazoRestante: 120,
    percentualPago: 0
  },
  lances: {
    lanceProprio: 20000,
    lanceEmbutido: 20000,
    lanceTotal: 40000
  },
  project: {
    itens: [
      { administradora: 'Admin Teste', codigoGrupo: 'G001', nomeSegmento: 'Imovel', valorCartaTotal: 200000, quantidadeCotas: 1, prazoMeses: 120 }
    ]
  }
};

const builder = {
  sections: { header: true, kpis: true, schedule: false },
  charts: { composition: true, debt: true },
  concepts: { consorcio: true },
  formulas: { parcelaTotal: true, lanceTotal: true }
};

const v1 = api.save(proposal, {
  builder,
  acceptance: {
    status: 'partial',
    statusLabel: 'Revisao parcial',
    version: 1,
    validUntil: '2026-05-15',
    notes: 'Ligar para 11999997777 antes de publicar.'
  },
  simulationId: 'SIM-001',
  label: 'Versao do Cliente Teste'
});

const v1Repeat = api.save(proposal, {
  builder,
  acceptance: {
    status: 'partial',
    statusLabel: 'Revisao parcial',
    version: 1,
    validUntil: '2026-05-15',
    notes: 'Ligar para 11999997777 antes de publicar.'
  },
  simulationId: 'SIM-001',
  label: 'Versao do Cliente Teste'
});

const v2 = api.save({
  ...proposal,
  metrics: {
    ...proposal.metrics,
    parcelaAtual: 1950,
    saldoDevedor: 188000
  }
}, {
  builder: {
    ...builder,
    sections: { header: true, kpis: true, schedule: true }
  },
  acceptance: {
    status: 'reviewed',
    statusLabel: 'Revisada localmente',
    version: 2,
    validUntil: '2026-05-20',
    notes: 'Documento do CPF 52998224725 conferido.'
  },
  simulationId: 'SIM-001',
  label: 'Versao revisada por Consultor Teste',
  forceNew: true
});

const comparison = api.compareRecords(v1, v2);

assert(v1 && v1.version === 1, `Primeira versao deveria ser 1, recebeu ${v1 && v1.version}.`);
assert(v1Repeat && v1Repeat.unchanged === true, 'Salvar snapshot identico deveria retornar unchanged.');
assert(v2 && v2.version === 2, `Segunda versao deveria ser 2, recebeu ${v2 && v2.version}.`);
assert(api.history(proposal.id, 5).length === 2, 'Historico deveria manter duas versoes distintas.');
assert(comparison && comparison.changedMetrics.some((item) => item.key === 'parcelaAtual'), 'Comparacao nao detectou mudanca na parcela.');
assert(comparison && comparison.changedBuilder.some((item) => item.key === 'sections'), 'Comparacao nao detectou mudanca na lousa.');
assert(v1 && v1.cliente === 'Cliente Teste', 'Nome do cliente deveria permanecer disponivel em memoria na sessao.');
assert(v1 && v1.consultor === 'Consultor Teste', 'Nome do consultor deveria permanecer disponivel em memoria na sessao.');
assert(v1 && v1.notes.includes('11999997777'), 'Nota deveria permanecer disponivel em memoria na sessao.');

const versionStorageKey = 'bank_fratern_proposal_versions_v1';
const rawVersions = context.localStorage.getItem(versionStorageKey) || '';
const persistedVersions = JSON.parse(rawVersions || '[]');
const forbiddenVersionKeys = ['cliente', 'consultor', 'reviewer', 'revisor', 'notes', 'statusLabel'];
const hasForbiddenKey = (value, forbidden) => {
  if (!value || typeof value !== 'object') return false;
  if (Array.isArray(value)) return value.some((item) => hasForbiddenKey(item, forbidden));
  return Object.entries(value).some(([key, item]) => forbidden.includes(key) || hasForbiddenKey(item, forbidden));
};
assert(!hasForbiddenKey(persistedVersions, forbiddenVersionKeys), 'localStorage de versoes contem campos identificadores ou notas livres.');
[
  'Cliente Teste',
  'Consultor Teste',
  'cliente.versao@example.com',
  '11999997777',
  '52998224725',
  'Versao do Cliente Teste',
  'Versao revisada por Consultor Teste'
].forEach((secret) => assert(!rawVersions.includes(secret), `localStorage de versoes expoe dado sensivel: ${secret}.`));

assert(api.clear(proposal.id), 'clear() retornou falso.');
assert(api.history(proposal.id, 5).length === 0, 'clear() nao removeu versoes.');

context.localStorage.setItem(versionStorageKey, JSON.stringify([{
  schema: 'bank-fratern.proposal-version.v1',
  id: 'PV-LEGACY-1',
  proposalId: 'PROP-LEGACY-2',
  simulationId: 'SIM-LEGACY-2',
  cliente: 'Cliente Legado',
  consultor: 'Consultor Legado',
  reviewer: 'Revisor Legado',
  notes: 'Nota legada com e-mail legado@example.com.',
  status: 'reviewed',
  statusLabel: 'Revisada por Revisor Legado',
  acceptanceVersion: 1,
  validUntil: '2026-12-31',
  metrics: { creditoTotal: 80000, parcelaAtual: 800 },
  lances: { lanceTotal: 8000 },
  groups: [],
  builder: { raw: { sections: { header: true }, charts: {}, concepts: {}, formulas: {} } },
  sourceHash: 'LEGACYHASH',
  version: 1,
  label: 'Versao do Cliente Legado',
  createdAt: '2026-05-01T00:00:00.000Z',
  updatedAt: '2026-05-01T00:00:00.000Z'
}]));
assert(api.history('PROP-LEGACY-2', 5).length === 1, 'Migracao de versao legada perdeu metadados operacionais.');
const migratedVersionsRaw = context.localStorage.getItem(versionStorageKey) || '';
assert(!/Cliente Legado|Consultor Legado|Revisor Legado|Nota legada|legado@example\.com/.test(migratedVersionsRaw), 'Migracao nao removeu PII legado do localStorage de versoes.');
assert(!hasForbiddenKey(JSON.parse(migratedVersionsRaw || '[]'), forbiddenVersionKeys), 'Migracao manteve chaves sensiveis na versao legada.');
api.clear('PROP-LEGACY-2');

const report = {
  ok: failures.length === 0,
  uiContract: {
    htmlPanel: html.includes('data-proposal-version-panel'),
    serviceScript: html.includes('../js/proposal-versioning.js'),
    governanceScript: html.includes('../js/proposal-governance.js'),
    appSave: app.includes('salvarVersaoProposta'),
    appDelegates: app.includes('BFProposalGovernance'),
    comparisonMarker: governance.includes('data-proposal-version-comparison'),
    cssPanel: css.includes('.proposal-version-panel')
  },
  serviceContract: {
    storageKey: api && api.storageKey,
    firstVersion: v1 && v1.version,
    repeatUnchanged: v1Repeat && v1Repeat.unchanged,
    secondVersion: v2 && v2.version,
    changedMetrics: comparison ? comparison.changedMetrics.length : 0,
    changedBuilder: comparison ? comparison.changedBuilder.length : 0,
    liveDetailsPreserved: v1 && v1.cliente === 'Cliente Teste' && v1.notes.includes('11999997777'),
    localStoragePIIFree: !hasForbiddenKey(persistedVersions, forbiddenVersionKeys),
    legacyPIIPurged: !/Cliente Legado|Consultor Legado|Revisor Legado/.test(migratedVersionsRaw)
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/proposal-versioning-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
