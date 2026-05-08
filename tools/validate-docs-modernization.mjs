import fs from 'node:fs/promises';
import path from 'node:path';

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
  readme,
  calculatorsDoc,
  evolutionaryPlan,
  actionPlan,
  map,
  contracts,
  designValidator,
  calculatorsJson
] = await Promise.all([
  read('docs/README.md'),
  read('docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md'),
  read('docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('tools/validate-design-system.mjs'),
  read('assets/data/calculadoras.json')
]);

const calculators = JSON.parse(calculatorsJson);
const calculatorCount = Array.isArray(calculators) ? calculators.length : 0;

assert(readme.startsWith('# Bank Fratern - Plataforma de decisao financeira'), 'README ativo nao abre com Bank Fratern.');
assert(readme.includes('19 calculadoras'), 'README ativo nao registra o catalogo de 19 calculadoras.');
assert(readme.includes('17.396 grupos validos'), 'README ativo nao registra a base real do simulador.');
assert(readme.includes('Lousa de proposta/PDF'), 'README ativo nao registra a lousa seletiva de proposta/PDF.');
assert(readme.includes('tools/validate-docs-modernization.mjs'), 'README ativo nao recomenda validate-docs-modernization.');

[
  ['docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md', calculatorsDoc],
  ['docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md', evolutionaryPlan],
  ['docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md', actionPlan],
  ['docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md', map]
].forEach(([name, text]) => {
  assert(text.includes('19 calculadoras'), `${name} nao menciona 19 calculadoras.`);
  assert(!/Matriz funcional das 17 calculadoras/i.test(text), `${name} ainda cita matriz de 17 calculadoras.`);
  assert(!/validacao das 17 calculadoras/i.test(text), `${name} ainda cita validacao das 17 calculadoras.`);
  assert(!/preservando as 17 calculadoras/i.test(text), `${name} ainda cita preservacao de 17 calculadoras.`);
});

const historicalDocs = [
  'docs/ARQUITETURA.md',
  'docs/ATA_PROJETO.md',
  'docs/FOLDER_PROJETO.md',
  'docs/implementation_plan.md'
];

const historicalStatus = [];
for (const doc of historicalDocs) {
  const text = await read(doc);
  const isMarkedHistorical = text.includes('Status 2026-05-08: documento historico');
  const namesCurrentPlatform = text.includes('A plataforma atual e Bank Fratern');
  const controlsLegacyName = text.includes('ConsorcioPro permanece como nome legado');

  assert(isMarkedHistorical, `${doc} sem banner de documento historico.`);
  assert(namesCurrentPlatform, `${doc} nao aponta Bank Fratern como plataforma atual.`);
  assert(controlsLegacyName, `${doc} nao trata ConsorcioPro como nome legado controlado.`);

  historicalStatus.push({
    doc,
    isMarkedHistorical,
    namesCurrentPlatform,
    controlsLegacyName
  });
}

assert(calculatorCount === 19, `Catalogo de calculadoras deveria ter 19 itens; encontrou ${calculatorCount}.`);
assert(contracts.includes('tools/validate-docs-modernization.mjs'), 'Contratos publicos nao documentam validate-docs-modernization.');
assert(designValidator.includes('tools/validate-docs-modernization.mjs'), 'validate-design-system nao exige validate-docs-modernization.');
assert(actionPlan.includes('Governanca documental modernizada'), 'Plano de acao nao registra a modernizacao documental.');
assert(map.includes('validate-docs-modernization.mjs'), 'Mapa completo nao registra validate-docs-modernization.');

const report = {
  ok: failures.length === 0,
  activeDocs: {
    readme: 'docs/README.md',
    calculatorCount,
    expectedCalculatorCount: 19
  },
  historicalDocs: historicalStatus,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/docs-modernization-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
