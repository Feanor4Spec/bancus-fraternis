import fs from 'node:fs/promises';
import path from 'node:path';
import zlib from 'node:zlib';

const root = process.cwd();
const failures = [];

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function stat(relativePath) {
  return fs.stat(path.join(root, relativePath));
}

function isValidGroup(group) {
  return Boolean(
    group &&
    Number(group.valorCartaRef) > 0 &&
    Number(group.prazoMeses) > 0 &&
    Number(group.qtdAtivasEmDia) >= 0
  );
}

const sourcePath = 'data_base/Tab_Grupos_Consorcio.json';
const compactPath = 'data_base/Tab_Grupos_Consorcio.compact.json';

const [sourceText, compactText, simulatorHtml, shelfDataJs, progressJs, gitignore] = await Promise.all([
  read(sourcePath),
  read(compactPath),
  read('pages/simulador.html'),
  read('js/shelf-data.js'),
  read('js/database-progress.js'),
  read('.gitignore')
]);

const source = JSON.parse(sourceText);
const compact = JSON.parse(compactText);
const sourceStat = await stat(sourcePath);
const compactStat = await stat(compactPath);
const validGroups = source.filter(isValidGroup);

assert(Array.isArray(source), 'Base original precisa ser array.');
assert(compact.schema === 'bancus.shelf.compact.v1', 'Base compacta sem schema bancus.shelf.compact.v1.');
assert(Array.isArray(compact.columns), 'Base compacta sem columns.');
assert(Array.isArray(compact.rows), 'Base compacta sem rows.');
assert(compact.rawRecords === source.length, `rawRecords compacto deveria ser ${source.length}; obteve ${compact.rawRecords}.`);
assert(compact.validRecords === validGroups.length, `validRecords compacto deveria ser ${validGroups.length}; obteve ${compact.validRecords}.`);
assert(compact.rows.length === validGroups.length, `rows compacto deveria ter ${validGroups.length}; obteve ${compact.rows.length}.`);
assert(compact.excludedRecords === source.length - validGroups.length, 'excludedRecords compacto nao bate com a base original.');

const requiredColumns = [
  'dataBase',
  'cnpjRaiz',
  'nomeAdministradora',
  'codigoGrupo',
  'codigoSegmento',
  'groupKey',
  'valorCartaRef',
  'taxaAdmPct',
  'prazoMeses',
  'qtdAtivasEmDia',
  'qtdContempladasNoMes',
  'qtdCreditoPendente',
  'classificacaoExecutiva',
  'taxaInadimplencia',
  'indiceMaturidade'
];
for (const column of requiredColumns) {
  assert(compact.columns.includes(column), `Base compacta sem coluna obrigatoria: ${column}.`);
}

const compactRatio = compactStat.size / sourceStat.size;
const gzipSourceBytes = zlib.gzipSync(sourceText).length;
const gzipCompactBytes = zlib.gzipSync(compactText).length;
const gzipRatio = gzipCompactBytes / gzipSourceBytes;

assert(compactStat.size < 4_500_000, `Base compacta deveria ficar abaixo de 4.5 MB; obteve ${compactStat.size}.`);
assert(compactRatio < 0.25, `Base compacta deveria ter menos de 25% do tamanho original; obteve ${compactRatio}.`);
assert(gzipRatio < 0.8, `Base compacta gzip deveria melhorar pelo menos 20%; obteve ${gzipRatio}.`);

assert(simulatorHtml.includes('Tab_Grupos_Consorcio.compact.json'), 'simulador.html nao aponta para a base compacta.');
assert(simulatorHtml.includes('fallbackDbPath'), 'simulador.html nao preserva fallback para JSON legado.');
assert(simulatorHtml.includes('loadRealDatabase([dbPath, fallbackDbPath])'), 'simulador.html nao chama loadRealDatabase com fallback.');
assert(shelfDataJs.includes('bancus.shelf.compact.v1'), 'shelf-data.js nao reconhece schema compacto.');
assert(shelfDataJs.includes('_decodeCompactDatabasePayload'), 'shelf-data.js sem decoder compacto.');
assert(shelfDataJs.includes('compact-json'), 'shelf-data.js nao marca fonte compact-json.');
assert(progressJs.includes('Base compacta JSON'), 'database-progress.js nao rotula base compacta.');
assert(gitignore.includes('!data_base/Tab_Grupos_Consorcio.compact.json'), '.gitignore nao permite versionar a base compacta.');

const report = {
  ok: failures.length === 0,
  source: {
    path: sourcePath,
    bytes: sourceStat.size,
    rawRecords: source.length,
    validRecords: validGroups.length
  },
  compact: {
    path: compactPath,
    bytes: compactStat.size,
    schema: compact.schema,
    columns: compact.columns.length,
    rows: compact.rows.length,
    rawRecords: compact.rawRecords,
    validRecords: compact.validRecords,
    ratio: Number(compactRatio.toFixed(4))
  },
  gzip: {
    sourceBytes: gzipSourceBytes,
    compactBytes: gzipCompactBytes,
    ratio: Number(gzipRatio.toFixed(4))
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-performance-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
