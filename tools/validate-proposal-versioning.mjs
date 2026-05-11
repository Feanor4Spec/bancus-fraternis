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
    validUntil: '2026-05-15'
  },
  simulationId: 'SIM-001'
});

const v1Repeat = api.save(proposal, {
  builder,
  acceptance: {
    status: 'partial',
    statusLabel: 'Revisao parcial',
    version: 1,
    validUntil: '2026-05-15'
  },
  simulationId: 'SIM-001'
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
    validUntil: '2026-05-20'
  },
  simulationId: 'SIM-001',
  forceNew: true
});

const comparison = api.compareRecords(v1, v2);

assert(v1 && v1.version === 1, `Primeira versao deveria ser 1, recebeu ${v1 && v1.version}.`);
assert(v1Repeat && v1Repeat.unchanged === true, 'Salvar snapshot identico deveria retornar unchanged.');
assert(v2 && v2.version === 2, `Segunda versao deveria ser 2, recebeu ${v2 && v2.version}.`);
assert(api.history(proposal.id, 5).length === 2, 'Historico deveria manter duas versoes distintas.');
assert(comparison && comparison.changedMetrics.some((item) => item.key === 'parcelaAtual'), 'Comparacao nao detectou mudanca na parcela.');
assert(comparison && comparison.changedBuilder.some((item) => item.key === 'sections'), 'Comparacao nao detectou mudanca na lousa.');
assert(api.clear(proposal.id), 'clear() retornou falso.');
assert(api.history(proposal.id, 5).length === 0, 'clear() nao removeu versoes.');

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
    changedBuilder: comparison ? comparison.changedBuilder.length : 0
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
