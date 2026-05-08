import fs from 'node:fs/promises';
import crypto from 'node:crypto';
import path from 'node:path';

const root = process.cwd();
const sourcePath = path.join(root, 'data_base/Tab_Grupos_Consorcio.json');
const targetPath = path.join(root, 'data_base/Tab_Grupos_Consorcio.compact.json');

const columns = [
  'dataBase',
  'origem',
  'cnpjRaiz',
  'nomeAdministradora',
  'codigoGrupo',
  'codigoSegmento',
  'groupKey',
  'valorCartaRef',
  'taxaAdmPct',
  'prazoMeses',
  'indiceCorrecaoCodigo',
  'indiceCorrecaoNome',
  'lanceEmbutidoMaxPct',
  'lanceFixoPct',
  'parcelaReduzidaDisponivel',
  'reducaoMaxParcelaPct',
  'seguroPctComercial',
  'fgtsPermitido',
  'statusComercial',
  'fundoReservaPct',
  'qtdAtivasEmDia',
  'qtdContempladasNoMes',
  'qtdExcluidas',
  'qtdQuitadas',
  'qtdCreditoPendente',
  'classificacaoExecutiva',
  'taxaInadimplencia',
  'indiceMaturidade',
  'saudeCarteira',
  'contemplacoesRelativasPct'
];

function isValidGroup(group) {
  return Boolean(
    group &&
    Number(group.valorCartaRef) > 0 &&
    Number(group.prazoMeses) > 0 &&
    Number(group.qtdAtivasEmDia) >= 0
  );
}

const sourceText = await fs.readFile(sourcePath, 'utf8');
const source = JSON.parse(sourceText);

if (!Array.isArray(source)) {
  throw new Error('Tab_Grupos_Consorcio.json precisa ser um array.');
}

const validRows = source
  .filter(isValidGroup)
  .map((group) => columns.map((column) => group[column] ?? null));

const payload = {
  schema: 'bancus.shelf.compact.v1',
  generatedAt: new Date().toISOString(),
  source: 'Tab_Grupos_Consorcio.json',
  sourceSha256: crypto.createHash('sha256').update(sourceText).digest('hex'),
  rawRecords: source.length,
  validRecords: validRows.length,
  excludedRecords: source.length - validRows.length,
  columns,
  rows: validRows
};

await fs.writeFile(targetPath, JSON.stringify(payload), 'utf8');

const targetStat = await fs.stat(targetPath);
console.log(JSON.stringify({
  ok: true,
  source: path.relative(root, sourcePath).replace(/\\/g, '/'),
  target: path.relative(root, targetPath).replace(/\\/g, '/'),
  rawRecords: payload.rawRecords,
  validRecords: payload.validRecords,
  sourceBytes: Buffer.byteLength(sourceText, 'utf8'),
  targetBytes: targetStat.size,
  ratio: Number((targetStat.size / Buffer.byteLength(sourceText, 'utf8')).toFixed(4))
}, null, 2));
