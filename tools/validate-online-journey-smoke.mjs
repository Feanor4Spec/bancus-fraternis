import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const baseUrl = (process.env.BANCUS_PAGES_URL || 'https://feanor4spec.github.io/bancus-fraternis').replace(/\/$/, '');
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

async function fetchText(url) {
  const response = await fetch(url, {
    headers: {
      'Cache-Control': 'no-cache',
      'Pragma': 'no-cache',
      'User-Agent': 'Bancus-Fraternis-online-journey-smoke'
    }
  });
  const text = await response.text();
  return {
    ok: response.ok,
    status: response.status,
    bytes: Buffer.byteLength(text, 'utf8'),
    text
  };
}

function stripHash(url) {
  return String(url || '').split('#')[0];
}

function anchorFrom(url) {
  const parts = String(url || '').split('#');
  return parts.length > 1 ? parts[1] : '';
}

const journey = [
  {
    step: 'auth',
    label: 'Login demo',
    url: '/pages/login.html?redirect=handoff-consultivo.html',
    markers: ['data-public-demo-notice', 'data-login-form', 'data-demo-login', 'Ambiente publico de demonstracao'],
    forbidden: ['data-login-password" name="password" autocomplete="current-password" value=']
  },
  {
    step: 'home',
    label: 'Home cockpit',
    url: '/pages/index.html?from=lousa#home-cockpit',
    markers: ['data-home-continuity-cockpit', 'id="home-cockpit"', 'data-home-hero-contextual']
  },
  {
    step: 'products',
    label: 'Produtos',
    url: '/pages/produtos.html?from=lousa#produtos-selecao',
    markers: ['data-products-selection-panel', 'id="produtos-selecao"', 'data-products-decision-strip']
  },
  {
    step: 'calculators',
    label: 'Calculadora capacidade',
    url: '/pages/calculadora-capacidade-credito.html?from=lousa&calculatorSlug=capacidade-credito&preset=comprar_bem',
    markers: ['data-calculator-form', 'data-calculator-slug="capacidade-credito"', 'data-calculator-decision-strip']
  },
  {
    step: 'journey',
    label: 'Trilha assistida',
    url: '/pages/trilha-decisao.html?from=lousa&sourceFrom=calculator&calculatorSlug=capacidade-credito&preset=comprar_bem#trilha-acoes',
    markers: ['data-decision-journey-form', 'data-decision-journey-actions', 'id="trilha-acoes"']
  },
  {
    step: 'comparator',
    label: 'Comparador',
    url: '/pages/comparador.html?from=lousa&preset=comprar_bem#comparador-entrada',
    markers: ['data-comparator-form', 'data-comparator-result', 'id="comparador-entrada"']
  },
  {
    step: 'simulator',
    label: 'Simulador base real',
    url: '/pages/simulador.html?from=lousa#database-status-panel',
    markers: ['data-simulator-readiness', 'id="database-status-panel"', 'Demo local']
  },
  {
    step: 'proposal',
    label: 'Lousa proposta/PDF',
    url: '/pages/simulador.html?from=lousa#proposal-builder-board',
    markers: ['data-proposal-builder-board', 'id="proposal-builder-board"', 'data-proposal-acceptance-panel']
  },
  {
    step: 'handoff',
    label: 'Handoff consultivo',
    url: '/pages/handoff-consultivo.html?from=lousa#painel-consultor',
    markers: ['data-handoff-consultant-cockpit', 'data-handoff-aging-filter', 'id="painel-consultor"']
  },
  {
    step: 'dashboards',
    label: 'Dashboard admin',
    url: '/pages/dashboard-admin.html?from=lousa#admin-proximos-passos',
    markers: ['data-admin-operational-strip', 'data-admin-journey-funnel', 'href="#admin-proximos-passos"', 'admin-users.js'],
    dynamicAnchor: true
  }
];

const checked = [];

let lousa = null;
try {
  const result = await fetchText(`${baseUrl}/pages/lousa-navegacao.html#roteiro-navegavel`);
  lousa = {
    url: `${baseUrl}/pages/lousa-navegacao.html#roteiro-navegavel`,
    status: result.status,
    bytes: result.bytes,
    steps: journey.filter((item) => result.text.includes(`data-lousa-journey-step="${item.step}"`)).length
  };
  assert(result.ok, `Lousa online retornou HTTP ${result.status}.`);
  assert(result.text.includes('data-lousa-journey-checklist'), 'Lousa online sem checklist de jornada.');
  assert(lousa.steps === journey.length, `Lousa online deveria expor ${journey.length} etapas; encontrou ${lousa.steps}.`);
} catch (error) {
  fail(`Lousa online nao pode ser acessada: ${error.message}`);
}

for (const item of journey) {
  const absoluteUrl = `${baseUrl}${item.url}`;
  try {
    const result = await fetchText(stripHash(absoluteUrl));
    const anchor = anchorFrom(item.url);
    const foundMarkers = item.markers.filter((marker) => result.text.includes(marker));
    checked.push({
      step: item.step,
      label: item.label,
      url: absoluteUrl,
      status: result.status,
      bytes: result.bytes,
      foundMarkers: foundMarkers.length,
      expectedMarkers: item.markers.length,
      anchor
    });

    assert(result.ok, `${item.step} retornou HTTP ${result.status}.`);
    assert(result.bytes > 1000, `${item.step} retornou HTML pequeno demais (${result.bytes} bytes).`);
    for (const marker of item.markers) {
      assert(result.text.includes(marker), `${item.step} nao contem marcador esperado: ${marker}.`);
    }
    for (const forbidden of item.forbidden || []) {
      assert(!result.text.includes(forbidden), `${item.step} contem marcador proibido: ${forbidden}.`);
    }
    if (anchor && !item.dynamicAnchor) {
      assert(result.text.includes(`id="${anchor}"`) || result.text.includes(`name="${anchor}"`), `${item.step} nao contem ancora #${anchor}.`);
    }
  } catch (error) {
    fail(`${item.step} nao pode ser acessado: ${error.message}`);
  }
}

let fallback404 = null;
try {
  const result = await fetchText(`${baseUrl}/simulador`);
  fallback404 = {
    url: `${baseUrl}/simulador`,
    status: result.status,
    bytes: result.bytes
  };
  assert(result.status === 404, `Rota curta /simulador deveria acionar fallback 404 no Pages; recebeu ${result.status}.`);
  assert(result.text.includes('simulador: \'pages/simulador.html\''), 'Fallback 404 nao preserva alias estatico do simulador.');
} catch (error) {
  warn(`Nao foi possivel validar fallback /simulador: ${error.message}`);
}

const report = {
  ok: failures.length === 0,
  baseUrl,
  lousa,
  checked,
  fallback404,
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/online-journey-smoke-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
