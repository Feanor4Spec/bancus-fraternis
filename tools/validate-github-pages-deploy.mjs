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
      'User-Agent': 'Bancus-Fraternis-deploy-validator'
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

const checks = [
  {
    name: 'root',
    url: `${baseUrl}/`,
    includes: ['<title>Bancus Fraternis</title>', 'pages/index.html']
  },
  {
    name: 'home',
    url: `${baseUrl}/pages/index.html`,
    includes: ['Bancus Fraternis', 'data-home-continuity-cockpit']
  },
  {
    name: 'lousa',
    url: `${baseUrl}/pages/lousa-navegacao.html#roteiro-navegavel`,
    includes: ['Bancus Fraternis em modo jornada', 'data-lousa-journey-checklist']
  },
  {
    name: 'simulador',
    url: `${baseUrl}/pages/simulador.html`,
    includes: ['data-simulator-readiness', 'database-status-panel', 'Bancus Fraternis', 'Demo local']
  },
  {
    name: 'login',
    url: `${baseUrl}/pages/login.html`,
    includes: ['data-public-demo-notice', 'Demo local', 'Ambiente publico de demonstracao']
  }
];

const pages = [];
for (const check of checks) {
  try {
    const result = await fetchText(check.url);
    pages.push({
      name: check.name,
      url: check.url,
      status: result.status,
      bytes: result.bytes
    });
    assert(result.ok, `${check.name} retornou HTTP ${result.status}.`);
    for (const expected of check.includes) {
      assert(result.text.includes(expected), `${check.name} nao contem marcador esperado: ${expected}`);
    }
    assert(!result.text.includes('Bank Fratern'), `${check.name} ainda exibe Bank Fratern.`);
  } catch (error) {
    fail(`${check.name} nao pode ser acessado: ${error.message}`);
  }
}

let fallback404 = null;
try {
  const result = await fetchText(`${baseUrl}/rota-curta-inexistente-qa`);
  fallback404 = {
    url: `${baseUrl}/rota-curta-inexistente-qa`,
    status: result.status,
    bytes: result.bytes
  };
  assert(result.status === 404, `Fallback deveria retornar HTTP 404; recebeu ${result.status}.`);
  assert(result.text.includes('Bancus Fraternis - rota nao encontrada'), 'Fallback 404 nao contem identidade Bancus Fraternis.');
  assert(result.text.includes('pages/index.html'), 'Fallback 404 nao aponta para a entrada principal.');
} catch (error) {
  fail(`Fallback 404 nao pode ser validado: ${error.message}`);
}

let database = null;
try {
  const result = await fetchText(`${baseUrl}/data_base/Tab_Grupos_Consorcio.json`);
  assert(result.ok, `Base JSON retornou HTTP ${result.status}.`);
  const data = JSON.parse(result.text);
  const total = Array.isArray(data) ? data.length : 0;
  database = {
    url: `${baseUrl}/data_base/Tab_Grupos_Consorcio.json`,
    status: result.status,
    bytes: result.bytes,
    total
  };
  assert(total === 17418, `Base online deveria ter 17418 registros brutos; encontrou ${total}.`);
} catch (error) {
  fail(`Base JSON online invalida: ${error.message}`);
}

const report = {
  ok: failures.length === 0,
  baseUrl,
  pages,
  fallback404,
  database,
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/github-pages-deploy-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
