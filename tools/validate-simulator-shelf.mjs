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
  settingsHtml,
  appJs,
  shelfJs,
  settingsJs,
  stylesCss,
  contracts,
  plan,
  map,
  readme,
  protocol
] = await Promise.all([
  read('pages/simulador.html'),
  read('pages/configuracoes.html'),
  read('js/app.js'),
  read('js/simulator-shelf.js'),
  read('js/settings.js'),
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
assert(simulatorHtml.includes('id="shelfPageSize"'), 'simulador.html deve ter controle shelfPageSize.');
assert(simulatorHtml.includes('type="number"') && simulatorHtml.includes('min="20"') && simulatorHtml.includes('max="50"'), 'simulador.html deve limitar shelfPageSize entre 20 e 50.');
assert(simulatorHtml.includes('value="20"'), 'simulador.html deve iniciar shelfPageSize em 20.');
const pageSizeControl = simulatorHtml.match(/<input[^>]+id="shelfPageSize"[^>]*>/i)?.[0] || '';
assert(!/value="(?:100|200)"/i.test(pageSizeControl), 'simulador.html nao deve oferecer pageSize 100 ou 200.');
assert(settingsHtml.includes('id="cfg-pageSize"'), 'configuracoes.html deve ter controle cfg-pageSize.');
assert(settingsHtml.includes('type="number"') && settingsHtml.includes('min="20"') && settingsHtml.includes('max="50"'), 'configuracoes.html deve limitar cfg-pageSize entre 20 e 50.');
assert(settingsHtml.includes('value="20"'), 'configuracoes.html deve iniciar cfg-pageSize em 20.');
assert(!settingsHtml.includes('value="100"'), 'configuracoes.html nao deve oferecer pageSize 100.');
assert(!settingsHtml.includes('value="200"'), 'configuracoes.html nao deve oferecer pageSize 200.');
assert(settingsJs.includes('pageSize: 20'), 'settings.js deve iniciar pageSize em 20.');
assert(settingsJs.includes('clampNumber(merged.pageSize, 20, 50'), 'settings.js deve normalizar pageSize entre 20 e 50.');

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

assert(shelf.pageSizeFromSettings({ get: () => 999 }) === 50, 'pageSizeFromSettings deveria limitar pageSize a 50.');
assert(shelf.pageSizeFromSettings({ get: () => undefined }) === 20, 'pageSizeFromSettings deveria usar pageSize padrao 20.');
assert(shelf.normalizePageSize(5) === 20, 'normalizePageSize deveria limitar pageSize minimo a 20.');
assert(shelf.normalizePageSize(100) === 50, 'normalizePageSize deveria limitar pageSize maximo a 50.');

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
assert(emptyPagination.display === 'none' && emptyPagination.info === 'Sem páginas', 'paginationState deveria ocultar paginação vazia.');

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
assert(table.countText === '1 referência encontrada', 'renderTable gerou contador incorreto.');
assert(table.bodyHtml.includes('shelf-row--added'), 'renderTable deveria marcar grupo ja adicionado.');
assert(table.bodyHtml.includes('já adicionado ao projeto') && table.bodyHtml.includes('disabled'), 'renderTable deveria impedir duplicacao do mesmo groupKey.');
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
assert(contracts.includes('pageSize') && contracts.includes('20 e 50'), 'Contratos publicos devem documentar pageSize 20-50.');
assert(map.includes('20 a 50 grupos por pagina'), 'Mapa completo deve documentar pageSize 20-50 da prateleira.');
assert(plan.includes('padrao 20') && plan.includes('limitado a 50'), 'Plano de evolucao deve documentar pageSize padrao 20 e limite 50.');
assert(protocol.includes('iniciar em 20') && protocol.includes('limite 50'), 'Protocolo deve proteger pageSize 20-50.');

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
