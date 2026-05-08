import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const failures = [];
const warnings = [];

const textExtensions = new Set([
  '.css',
  '.html',
  '.js',
  '.json',
  '.md',
  '.mjs',
  '.svg',
  '.txt',
  '.yaml',
  '.yml'
]);

const scanRoots = [
  '.github',
  'assets',
  'css',
  'docs',
  'js',
  'pages',
  'tools',
  '.gitignore',
  '404.html',
  'index.html',
  'README.md'
];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

function toPosix(relativePath) {
  return relativePath.split(path.sep).join('/');
}

async function exists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function collectFiles(entry, out = []) {
  const fullPath = path.join(root, entry);
  let stat;
  try {
    stat = await fs.stat(fullPath);
  } catch {
    return out;
  }

  if (stat.isDirectory()) {
    const names = await fs.readdir(fullPath);
    for (const name of names) {
      await collectFiles(path.join(entry, name), out);
    }
    return out;
  }

  const extension = path.extname(entry).toLowerCase();
  if (textExtensions.has(extension) || path.basename(entry) === '.gitignore') out.push(toPosix(entry));
  return out;
}

function isAllowedEmail(email) {
  return /@bankfratern\.local$/i.test(email)
    || /@example\.(com|org|net)$/i.test(email)
    || /@users\.noreply\.github\.com$/i.test(email);
}

function digits(value) {
  return String(value || '').replace(/\D/g, '');
}

function isPlaceholderPhone(value) {
  const onlyDigits = digits(value);
  return !onlyDigits || /^0+$/.test(onlyDigits) || /^110+$/.test(onlyDigits) || /^114000000\d$/.test(onlyDigits) || /^11900000000$/.test(onlyDigits);
}

function scanSensitiveText(relativePath, text) {
  const normalized = relativePath.replace(/\\/g, '/');
  const isValidatorFixture = normalized.startsWith('tools/validate-');
  const localPathPattern = /(?:file:\/\/\/[a-z]:|[a-z]:[\\/](?:users|documentos and settings|documents and settings)[\\/])/ig;
  const personalWorkspacePattern = /\b(?:OneDrive|gustavo\.pinheiro|\\gusta\\|\/gusta\/)/i;
  const emailPattern = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi;
  const cpfFieldPattern = /(?:clienteCpf|cpf)["'\s:=]+["']?([0-9.\-]{11,14})/gi;
  const phoneFieldPattern = /(?:clienteTelefone|consultorTelefone|telefone|phone)["'\s:=]+["']?([^"',\n<]+)/gi;

  if (localPathPattern.test(text)) fail(`${normalized} contem caminho local absoluto ou file://.`);
  if (normalized !== 'tools/validate-public-release-safety.mjs' && personalWorkspacePattern.test(text)) {
    fail(`${normalized} contem identificador de workspace pessoal.`);
  }

  for (const match of text.matchAll(emailPattern)) {
    if (!isAllowedEmail(match[0])) fail(`${normalized} contem email fora do dominio demo: ${match[0]}.`);
  }

  for (const match of text.matchAll(cpfFieldPattern)) {
    if (isValidatorFixture) continue;
    const value = digits(match[1]);
    if (value && !/^0+$/.test(value)) fail(`${normalized} contem CPF de exemplo nao anonimizado.`);
  }

  for (const match of text.matchAll(phoneFieldPattern)) {
    if (isValidatorFixture) continue;
    if (!isPlaceholderPhone(match[1])) fail(`${normalized} contem telefone de exemplo nao anonimizado.`);
  }
}

const files = [];
for (const entry of scanRoots) {
  await collectFiles(entry, files);
}

for (const file of Array.from(new Set(files)).sort()) {
  if (file === 'docs/test-reports/public-release-safety-report.json') continue;
  const text = await read(file);
  scanSensitiveText(file, text);
}

const gitignore = await read('.gitignore');
[
  '.runtime/',
  'server-8080.err',
  'server-8080.err.log',
  'server-8080.out',
  'server-8080.out.log',
  'versions/',
  'data_base/*',
  '!data_base/Tab_Grupos_Consorcio.json'
].forEach((marker) => assert(gitignore.includes(marker), `.gitignore sem protecao publica: ${marker}.`));

const sharedLayout = await read('js/shared-layout.js');
const loginHtml = await read('pages/login.html');
const simulatorHtml = await read('pages/simulador.html');
const contracts = await read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md');
const readme = await read('README.md');

assert(await exists('404.html'), 'Fallback estatico 404.html ausente.');
assert(await exists('.github/workflows/validate.yml'), 'Workflow de validacao publica ausente.');
assert(sharedLayout.includes('bf-demo-chip'), 'Shell compartilhado sem selo Demo local.');
assert(loginHtml.includes('data-public-demo-notice'), 'Login sem aviso publico de demonstracao.');
assert(simulatorHtml.includes('sim-header__demo'), 'Simulador sem selo publico de demonstracao.');
assert(contracts.includes('tools/validate-public-release-safety.mjs'), 'Contratos publicos nao documentam validate-public-release-safety.');
assert(readme.includes('Ambiente publico de demonstracao'), 'README raiz nao explicita ambiente publico de demonstracao.');

for (const artifact of ['server-8080.err', 'server-8080.err.log', 'server-8080.out', 'server-8080.out.log']) {
  if (await exists(artifact)) warn(`${artifact} existe localmente, mas esta protegido pelo .gitignore.`);
}

const report = {
  ok: failures.length === 0,
  scannedFiles: files.length,
  checks: {
    staticFallback: true,
    githubWorkflow: true,
    demoDisclosure: true,
    gitignoreProtections: true
  },
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/public-release-safety-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
