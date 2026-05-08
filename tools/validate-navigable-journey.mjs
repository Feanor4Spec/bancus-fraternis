import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

function stripHrefTarget(href) {
  return href.split('#')[0].split('?')[0].trim();
}

function extractLocalHtmlRefs(html) {
  const refs = new Set();
  const pattern = /\bhref=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = match[1].trim();
    if (!raw || raw.startsWith('#') || /^(https?:|mailto:|tel:|javascript:|data:)/i.test(raw)) continue;
    const target = stripHrefTarget(raw);
    if (target.endsWith('.html')) refs.add(target);
  }
  return Array.from(refs).sort();
}

const [
  lousa,
  platformCss,
  adminPage,
  adminUsers,
  contracts,
  map,
  plan,
  changelog,
  designValidator
] = await Promise.all([
  read('pages/lousa-navegacao.html'),
  read('assets/css/platform.css'),
  read('pages/dashboard-admin.html'),
  read('assets/js/admin-users.js'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/CHANGELOG.md'),
  read('tools/validate-design-system.mjs')
]);

const expectedSteps = [
  'auth',
  'home',
  'products',
  'calculators',
  'journey',
  'comparator',
  'simulator',
  'proposal',
  'handoff',
  'dashboards'
];

assert(lousa.includes('data-lousa-journey-checklist'), 'Lousa sem marcador data-lousa-journey-checklist.');
assert(lousa.includes('data-lousa-journey-acceptance'), 'Lousa sem criterios de aceite navegavel.');
assert(lousa.includes('id="roteiro-navegavel"'), 'Lousa sem ancora #roteiro-navegavel.');
assert(lousa.includes('href="#roteiro-navegavel"'), 'Stagebar/atalho da lousa nao aponta para o roteiro navegavel.');
assert(lousa.includes('27 validadores'), 'Lousa nao registra o total esperado de 27 validadores.');

for (const step of expectedSteps) {
  assert(lousa.includes(`data-lousa-journey-step="${step}"`), `Roteiro navegavel sem etapa ${step}.`);
}

[
  'login.html?redirect=handoff-consultivo.html',
  'index.html?from=lousa#home-cockpit',
  'produtos.html?from=lousa#produtos-selecao',
  'calculadora-capacidade-credito.html?from=lousa&calculatorSlug=capacidade-credito&preset=comprar_bem',
  'trilha-decisao.html?from=lousa&sourceFrom=calculator&calculatorSlug=capacidade-credito&preset=comprar_bem#trilha-acoes',
  'comparador.html?from=lousa&preset=comprar_bem#comparador-entrada',
  'simulador.html?from=lousa#database-status-panel',
  'simulador.html?from=lousa#proposal-builder-board',
  'handoff-consultivo.html?from=lousa#painel-consultor',
  'dashboard-admin.html?from=lousa#admin-proximos-passos'
].forEach((href) => assert(lousa.includes(`href="${href}"`), `Roteiro navegavel sem link ${href}.`));

const localRefs = extractLocalHtmlRefs(lousa);
for (const ref of localRefs) {
  assert(await exists(path.join('pages', ref)), `Lousa referencia pagina inexistente: ${ref}.`);
}

const pageContracts = [
  {
    file: 'pages/login.html',
    markers: ['data-login-form', 'data-demo-login']
  },
  {
    file: 'pages/index.html',
    markers: ['data-home-continuity-cockpit', 'id="home-cockpit"']
  },
  {
    file: 'pages/produtos.html',
    markers: ['data-products-selection-panel', 'id="produtos-selecao"']
  },
  {
    file: 'pages/calculadoras.html',
    markers: ['data-calculators-hub', 'id="calculadoras-hub-grid"']
  },
  {
    file: 'pages/calculadora-capacidade-credito.html',
    markers: ['data-calculator-form', 'data-calculator-slug="capacidade-credito"', 'calculadoras-page.js']
  },
  {
    file: 'pages/trilha-decisao.html',
    markers: ['data-decision-journey-form', 'data-decision-journey-actions', 'id="trilha-acoes"']
  },
  {
    file: 'pages/comparador.html',
    markers: ['data-comparator-form', 'data-comparator-result', 'id="comparador-entrada"']
  },
  {
    file: 'pages/simulador.html',
    markers: ['data-simulator-readiness', 'id="database-status-panel"', 'data-proposal-builder-board', 'id="proposal-builder-board"']
  },
  {
    file: 'pages/handoff-consultivo.html',
    markers: ['data-handoff-consultant-cockpit', 'data-handoff-aging-filter', 'id="painel-consultor"']
  },
  {
    file: 'pages/dashboard-cliente.html',
    markers: ['data-client-continuity-strip', 'data-client-continuity-timeline', 'id="continuidade-cliente"']
  },
  {
    file: 'pages/dashboard-admin.html',
    markers: ['data-admin-operational-strip', 'data-admin-journey-funnel', 'href="#admin-proximos-passos"', 'lousa-navegacao.html#roteiro-navegavel']
  }
];

for (const contract of pageContracts) {
  const html = await read(contract.file);
  for (const marker of contract.markers) {
    assert(html.includes(marker), `${contract.file} sem marcador/ancora ${marker}.`);
  }
}

[
  'data-admin-next-actions',
  'data-admin-source-funnel',
  'data-admin-bottleneck-board',
  'id="admin-proximos-passos"',
  'id="admin-origens"',
  'id="admin-gargalos"'
].forEach((marker) => assert(adminUsers.includes(marker), `admin-users.js sem contrato dinamico ${marker}.`));

[
  '.bf-lousa-test-grid',
  '.bf-lousa-test-card',
  '.bf-lousa-acceptance'
].forEach((selector) => assert(platformCss.includes(selector), `platform.css sem estilo ${selector}.`));

[
  'data-lousa-journey-checklist',
  'data-lousa-journey-acceptance',
  'tools/validate-navigable-journey.mjs'
].forEach((contract) => assert(contracts.includes(contract), `Contratos publicos sem ${contract}.`));

assert(designValidator.includes('tools/validate-navigable-journey.mjs'), 'validate-design-system nao exige validate-navigable-journey.');
assert(map.includes('validate-navigable-journey.mjs'), 'Mapa completo nao registra validate-navigable-journey.');
assert(plan.includes('Teste navegavel ponta a ponta'), 'Plano de acao nao registra o ciclo de teste navegavel.');
assert(plan.includes('tools/validate-navigable-journey.mjs'), 'Plano de acao nao registra o validador de jornada navegavel.');
assert(changelog.includes('v8.48.0'), 'CHANGELOG sem entrada v8.48.0.');

const requiredValidators = [
  'tools/validate-auth-navigation.mjs',
  'tools/validate-route-aliases.mjs',
  'tools/validate-simulator-groups.mjs',
  'tools/validate-proposal-builder.mjs',
  'tools/validate-handoff-consultant-operations.mjs',
  'tools/validate-dashboard-continuity-flow.mjs',
  'tools/validate-admin-dashboard-source-funnel.mjs',
  'tools/validate-public-contracts.mjs'
];

for (const validator of requiredValidators) {
  assert(lousa.includes(validator) || contracts.includes(validator), `Roteiro/contratos nao citam validador associado: ${validator}.`);
  if (!(await exists(validator))) warn(`Validador citado nao encontrado no disco: ${validator}.`);
}

const report = {
  ok: failures.length === 0,
  journeySteps: expectedSteps.length,
  localRefs: localRefs.length,
  requiredValidators: requiredValidators.length + 1,
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/navigable-journey-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
