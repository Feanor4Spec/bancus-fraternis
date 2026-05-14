import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  simulatorHtml,
  appJs,
  shelfJs,
  stylesCss,
  contracts,
  plan,
  map,
  readme,
  protocol
] = await Promise.all([
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/simulator-shelf.js'),
  read('css/styles.css'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/README.md'),
  read('docs/CODEX_TEST_PROTOCOL.md')
]);

const shelfEngineIndex = simulatorHtml.indexOf('../js/shelf-engine.js');
const simulatorShelfIndex = simulatorHtml.indexOf('../js/simulator-shelf.js');
const cartIndex = simulatorHtml.indexOf('../js/simulator-cart.js');
const appIndex = simulatorHtml.indexOf('../js/app.js');

assert(shelfEngineIndex > -1, 'simulador.html nao carrega js/shelf-engine.js.');
assert(simulatorShelfIndex > -1, 'simulador.html nao carrega js/simulator-shelf.js.');
assert(cartIndex > -1, 'simulador.html nao carrega js/simulator-cart.js.');
assert(appIndex > -1, 'simulador.html nao carrega js/app.js.');
assert(shelfEngineIndex < simulatorShelfIndex, 'simulator-shelf.js deve carregar depois de shelf-engine.js.');
assert(simulatorShelfIndex < cartIndex, 'simulator-shelf.js deve carregar antes de simulator-cart.js.');
assert(simulatorShelfIndex < appIndex, 'simulator-shelf.js deve carregar antes de app.js.');

[
  'BFSimulatorShelf',
  'readFilters',
  'clearFilters',
  'filterAndSortGroups',
  'paginateGroups',
  'applyPaginationControls',
  'renderTable',
  'explainGroupRecommendation',
  'renderDetail',
  'setDetailAddVisible'
].forEach((token) => {
  assert(shelfJs.includes(token), `simulator-shelf.js sem contrato ${token}.`);
  assert(appJs.includes(token) || token === 'BFSimulatorShelf', `app.js nao delega ${token} para BFSimulatorShelf.`);
});

const context = { window: {}, console, Set, Intl };
vm.createContext(context);
vm.runInContext(shelfJs, context, { filename: 'simulator-shelf.js' });
const shelf = context.window.BFSimulatorShelf;

assert(shelf && typeof shelf.readFilters === 'function', 'BFSimulatorShelf.readFilters indisponivel.');
assert(shelf && typeof shelf.filterAndSortGroups === 'function', 'BFSimulatorShelf.filterAndSortGroups indisponivel.');
assert(shelf && typeof shelf.paginateGroups === 'function', 'BFSimulatorShelf.paginateGroups indisponivel.');
assert(shelf && typeof shelf.renderTable === 'function', 'BFSimulatorShelf.renderTable indisponivel.');
assert(shelf && typeof shelf.explainGroupRecommendation === 'function', 'BFSimulatorShelf.explainGroupRecommendation indisponivel.');
assert(shelf && typeof shelf.renderDetail === 'function', 'BFSimulatorShelf.renderDetail indisponivel.');
assert(stylesCss.includes('.shelf-recommendation'), 'styles.css sem leitura explicavel da prateleira.');

assert(shelf.pageSizeFromSettings({ get: () => 999 }) === 500, 'pageSizeFromSettings deveria limitar pageSize a 500.');
assert(shelf.normalizePageSize(5) === 10, 'normalizePageSize deveria limitar pageSize minimo a 10.');

const fields = {
  filtroAdministradora: { value: 'Admin QA' },
  filtroProduto: { value: '1' },
  filtroPrazoMin: { value: '36' },
  filtroPrazoMax: { value: '180' },
  filtroCartaMin: { value: '50000' },
  filtroCartaMax: { value: '300000' },
  filtroTaxaMax: { value: '20' },
  filtroClassificacao: { value: 'A' },
  filtroSaude: { value: 'Controlada' },
  filtroMaturidade: { value: 'Madura' },
  filtroBusca: { value: '1001' },
  filtroFgts: { checked: true },
  filtroParcelaReduzida: { checked: false }
};
const fakeRoot = {
  getElementById: (id) => fields[id] || null,
  querySelectorAll: () => []
};
const filters = shelf.readFilters(fakeRoot);
assert(filters.administradora === 'Admin QA', 'readFilters perdeu administradora.');
assert(filters.fgts === true, 'readFilters perdeu checkbox FGTS.');
shelf.clearFilters(fakeRoot);
assert(fields.filtroAdministradora.value === '', 'clearFilters nao limpou select/texto.');
assert(fields.filtroFgts.checked === false, 'clearFilters nao limpou checkbox.');

let scored = false;
const catalog = [
  { groupKey: 'A', valorCartaRef: 200000 },
  { groupKey: 'B', valorCartaRef: 100000 }
];
const mockEngine = {
  computeAllScores(items) {
    scored = items.length === 2;
  },
  filterGroups(items, currentFilters) {
    return currentFilters.onlyB ? items.filter((item) => item.groupKey === 'B') : items;
  },
  sortGroups(items) {
    return [...items].sort((a, b) => a.valorCartaRef - b.valorCartaRef);
  }
};
const sorted = shelf.filterAndSortGroups(catalog, { onlyB: true }, 'menor_carta', {
  shelfEngine: mockEngine,
  autoScore: true
});
assert(scored === true, 'filterAndSortGroups deveria calcular score quando autoScore esta ativo.');
assert(sorted.length === 1 && sorted[0].groupKey === 'B', 'filterAndSortGroups nao filtrou/ordenou corretamente.');

const pag = shelf.paginateGroups([1, 2, 3, 4, 5], 2, 2);
assert(pag.currentPage === 2, 'paginateGroups deveria preservar pagina solicitada.');
assert(pag.startIdx === 3 && pag.endIdx === 4, 'paginateGroups calculou intervalo incorreto.');
assert(JSON.stringify(pag.data) === JSON.stringify([3, 4]), 'paginateGroups retornou dados incorretos.');

const emptyPagination = shelf.paginationState({ totalGroups: 0, totalPages: 1, currentPage: 1, startIdx: 0, endIdx: 0 });
assert(emptyPagination.display === 'none' && emptyPagination.info === 'Sem paginas', 'paginationState deveria ocultar paginacao vazia.');

const sampleGroup = {
  groupKey: 'G-1',
  scoreShelf: 82,
  classificacaoExecutiva: 'A',
  _papel: { tag: 'Foco', justificativa: 'Boa aderencia' },
  nomeAdministradora: 'Admin QA',
  codigoGrupo: '1001',
  iconSegmento: 'IM',
  nomeSegmento: 'Imovel',
  valorCartaRef: 100000,
  prazoMeses: 120,
  taxaAdmPct: 18,
  indiceCorrecaoNome: 'IPCA',
  qtdAtivasEmDia: 50,
  saudeCarteira: 'Controlada',
  cnpjRaiz: '00000000',
  origem: 'imoveis',
  dataBase: '2026-05-11',
  fundoReservaPct: 2,
  seguroPctComercial: 0,
  qtdContempladasNoMes: 2,
  qtdExcluidas: 1,
  qtdQuitadas: 5,
  qtdCreditoPendente: 3,
  lanceFixoPct: 0,
  parcelaReduzidaDisponivel: true,
  reducaoMaxParcelaPct: 30,
  fgtsPermitido: true,
  statusComercial: 'Ativo'
};
const table = shelf.renderTable([sampleGroup], {
  totalGroups: 1,
  currentPage: 1,
  pageSize: 25
}, {
  projectItems: [{ groupKey: 'G-1' }],
  filters: filters,
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatNumber: (value) => String(Number(value))
});
const explanation = shelf.explainGroupRecommendation(sampleGroup, { filters });
assert(table.countText === '1 grupo encontrado', 'renderTable gerou contador incorreto.');
assert(table.bodyHtml.includes('shelf-row--added'), 'renderTable deveria marcar grupo ja adicionado.');
assert(table.bodyHtml.includes('App.selecionarGrupo(0)'), 'renderTable deveria manter acao publica App.selecionarGrupo.');
assert(table.bodyHtml.includes('data-shelf-col="acoes"'), 'renderTable deveria preservar data-shelf-col.');
assert(table.bodyHtml.includes('data-shelf-recommendation'), 'renderTable deveria explicar recomendacao do grupo.');
assert(explanation.reasons.length >= 2, 'explainGroupRecommendation deveria gerar motivos acionaveis.');

const title = shelf.detailTitle(sampleGroup);
const detail = shelf.renderDetail(sampleGroup, {
  getEffectiveLanceEmbutidoMax: () => 30,
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatNumber: (value) => String(Number(value))
});
assert(title.includes('Grupo 1001'), 'detailTitle deveria preservar codigo do grupo.');
assert(detail.includes('Lance Embutido Max.'), 'renderDetail deveria preservar regras comerciais.');
assert(detail.includes('Admin QA'), 'renderDetail deveria preservar administradora.');
assert(detail.includes('data-shelf-recommendation'), 'renderDetail deveria incluir explicacao da recomendacao.');

[
  'BFSimulatorShelf',
  'tools/validate-simulator-shelf.mjs'
].forEach((contract) => {
  const protocolToken = contract.replace(/\//g, '\\');
  assert(contracts.includes(contract), `Contratos publicos sem ${contract}.`);
  assert(plan.includes(contract) || map.includes(contract) || readme.includes(contract), `Docs de produto sem ${contract}.`);
  assert(protocol.includes(contract) || protocol.includes(protocolToken) || contract === 'BFSimulatorShelf', `Protocolo de testes sem ${contract}.`);
});

const report = {
  ok: failures.length === 0,
  scriptOrder: {
    shelfEngineBeforeShelf: shelfEngineIndex < simulatorShelfIndex,
    shelfBeforeCart: simulatorShelfIndex < cartIndex,
    shelfBeforeApp: simulatorShelfIndex < appIndex
  },
  filters,
  pagination: {
    currentPage: pag.currentPage,
    startIdx: pag.startIdx,
    endIdx: pag.endIdx
  },
  tableLength: table.bodyHtml.length,
  detailLength: detail.length,
  explanationReasons: explanation.reasons.length,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-shelf-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
