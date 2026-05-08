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

async function readText(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function isValidRawGroup(group) {
  return Boolean(
    group &&
    Number(group.valorCartaRef) > 0 &&
    Number(group.prazoMeses) > 0 &&
    Number(group.qtdAtivasEmDia) >= 0
  );
}

function invalidReason(group) {
  const reasons = [];
  if (!(Number(group && group.valorCartaRef) > 0)) reasons.push('valorCartaRef<=0');
  if (!(Number(group && group.prazoMeses) > 0)) reasons.push('prazoMeses<=0');
  if (!(Number(group && group.qtdAtivasEmDia) >= 0)) reasons.push('qtdAtivasEmDia invalido');
  return reasons.join('+') || 'outro';
}

function createFetch() {
  return async function fetchLocal(resource) {
    const rawPath = String(resource || '');
    const normalized = rawPath
      .replace(/^https?:\/\/localhost:\d+\//, '')
      .replace(/^\.\.\//, '')
      .replace(/^\.\//, '')
      .replace(/\\/g, '/');
    const absolute = path.resolve(root, normalized);
    const relative = path.relative(root, absolute);

    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      return {
        ok: false,
        status: 403,
        statusText: 'Forbidden',
        async json() {
          throw new Error('Forbidden');
        }
      };
    }

    try {
      const text = await fs.readFile(absolute, 'utf8');
      return {
        ok: true,
        status: 200,
        statusText: 'OK',
        async json() {
          return JSON.parse(text);
        }
      };
    } catch (error) {
      return {
        ok: false,
        status: 404,
        statusText: error && error.message ? error.message : 'Not found',
        async json() {
          throw error;
        }
      };
    }
  };
}

const dataPath = 'data_base/Tab_Grupos_Consorcio.json';
const dataText = await readText(dataPath);
const rawData = JSON.parse(dataText);
const expectedValid = rawData.filter(isValidRawGroup);
const invalidGroups = rawData.filter((group) => !isValidRawGroup(group));
const invalidReasons = invalidGroups.reduce((acc, group) => {
  const reason = invalidReason(group);
  acc[reason] = (acc[reason] || 0) + 1;
  return acc;
}, {});
const expectedSegments = Array.from(new Set(expectedValid.map((group) => Number(group.codigoSegmento)).filter(Boolean)))
  .sort((a, b) => a - b);
const expectedAdmins = new Set(expectedValid.map((group) => group.nomeAdministradora || group.cnpjRaiz || group.cnpjAdministradora).filter(Boolean));

assert(Array.isArray(rawData), 'Tab_Grupos_Consorcio.json precisa ser um array.');
assert(rawData.length > 17000, `Base bruta deveria ter mais de 17.000 registros, obteve ${rawData.length}.`);
assert(expectedValid.length > 17000, `Base valida deveria ter mais de 17.000 grupos, obteve ${expectedValid.length}.`);
assert(expectedSegments.length === 6, `Base valida deveria cobrir 6 segmentos, obteve ${expectedSegments.length}.`);
assert(Object.keys(invalidReasons).length === 1 && invalidReasons['valorCartaRef<=0'] === invalidGroups.length, 'Registros excluidos deveriam falhar apenas por valorCartaRef<=0.');

const context = {
  console,
  fetch: createFetch(),
  Date,
  Math,
  Intl,
  Number,
  String,
  Array,
  Object,
  Set,
  Map,
  JSON,
  window: null
};
context.window = context;
context.globalThis = context;
vm.createContext(context);

for (const script of [
  'js/heuristic-engine.js',
  'js/shelf-data.js',
  'js/shelf-engine.js'
]) {
  vm.runInContext(await readText(script), context, { filename: script });
}

const loadedCount = await vm.runInContext(
  "loadRealDatabase('../data_base/Tab_Grupos_Consorcio.json')",
  context,
  { filename: 'validate-simulator-groups:load' }
);
const status = vm.runInContext('getShelfDataStatus()', context);

assert(loadedCount === expectedValid.length, `loadRealDatabase retornou ${loadedCount}, esperado ${expectedValid.length}.`);
assert(status.loaded === true, 'getShelfDataStatus().loaded deveria ser true.');
assert(status.source === 'real-json', `Fonte deveria ser real-json, obteve ${status.source}.`);
assert(status.count === expectedValid.length, `ShelfCatalog deveria ter ${expectedValid.length} grupos, obteve ${status.count}.`);
assert(status.stats && status.stats.total === rawData.length, `stats.total deveria ser ${rawData.length}, obteve ${status.stats && status.stats.total}.`);
assert(status.stats && status.stats.valid === expectedValid.length, `stats.valid deveria ser ${expectedValid.length}, obteve ${status.stats && status.stats.valid}.`);

const engineReport = vm.runInContext(`
  const emptyFiltered = ShelfEngine.filterGroups(ShelfCatalog, {});
  ShelfEngine.computeAllScores(ShelfCatalog);
  const sorted = ShelfEngine.sortGroups(emptyFiltered, 'maior_score');
  const pageSize = 500;
  const firstPage = ShelfEngine.paginateGroups(sorted, 1, pageSize);
  const lastPage = ShelfEngine.paginateGroups(sorted, firstPage.totalPages, pageSize);
  let paginatedCount = 0;
  for (let page = 1; page <= firstPage.totalPages; page += 1) {
    paginatedCount += ShelfEngine.paginateGroups(sorted, page, pageSize).data.length;
  }
  ({
    catalogCount: ShelfCatalog.length,
    emptyFilteredCount: emptyFiltered.length,
    sortedCount: sorted.length,
    scoredCount: ShelfCatalog.filter((group) => Number.isFinite(group.scoreShelf)).length,
    pageSize,
    totalPages: firstPage.totalPages,
    firstPageRows: firstPage.data.length,
    lastPageRows: lastPage.data.length,
    paginatedCount,
    uniqueAdmins: ShelfEngine.getUniqueAdmins(ShelfCatalog).length,
    segments: Array.from(new Set(ShelfCatalog.map((group) => Number(group.codigoSegmento)).filter(Boolean))).sort((a, b) => a - b)
  });
`, context);

assert(engineReport.catalogCount === expectedValid.length, 'Catalogo em memoria nao bate com a base valida.');
assert(engineReport.emptyFilteredCount === expectedValid.length, `Filtro vazio deveria manter todos os grupos, obteve ${engineReport.emptyFilteredCount}.`);
assert(engineReport.sortedCount === expectedValid.length, `Ordenacao deveria preservar todos os grupos, obteve ${engineReport.sortedCount}.`);
assert(engineReport.scoredCount === expectedValid.length, `Score deveria ser calculado para todos os grupos, obteve ${engineReport.scoredCount}.`);
assert(engineReport.paginatedCount === expectedValid.length, `Paginacao somada deveria cobrir todos os grupos, obteve ${engineReport.paginatedCount}.`);
assert(engineReport.uniqueAdmins === expectedAdmins.size, `Administradoras unicas deveriam ser ${expectedAdmins.size}, obteve ${engineReport.uniqueAdmins}.`);
assert(JSON.stringify(engineReport.segments) === JSON.stringify(expectedSegments), 'Segmentos carregados nao batem com a base valida.');

const simulatorHtml = await readText('pages/simulador.html');
assert(simulatorHtml.includes('data_base/Tab_Grupos_Consorcio.json'), 'simulador.html nao referencia a base real de grupos.');
assert(simulatorHtml.includes('loadRealDatabase(dbPath)'), 'simulador.html nao chama loadRealDatabase(dbPath).');
assert(simulatorHtml.includes('App.buscarGrupos()'), 'simulador.html nao dispara busca inicial apos carregar a base.');
assert(simulatorHtml.includes('shelf-pagination'), 'simulador.html nao tem controles de paginacao da prateleira.');

const report = {
  ok: failures.length === 0,
  database: {
    path: dataPath,
    rawRecords: rawData.length,
    validGroups: expectedValid.length,
    excludedByMinimumData: rawData.length - expectedValid.length,
    excludedReasons: invalidReasons,
    segments: expectedSegments,
    admins: expectedAdmins.size
  },
  loader: {
    returned: loadedCount,
    status
  },
  shelfEngine: engineReport,
  uiContract: {
    simulatorUsesRealJson: simulatorHtml.includes('data_base/Tab_Grupos_Consorcio.json'),
    bootCallsLoadRealDatabase: simulatorHtml.includes('loadRealDatabase(dbPath)'),
    bootCallsInitialSearch: simulatorHtml.includes('App.buscarGrupos()'),
    hasPagination: simulatorHtml.includes('shelf-pagination')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-groups-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
