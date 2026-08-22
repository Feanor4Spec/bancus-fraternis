import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const runtimeDir = path.join(root, '.runtime');
const dbPath = path.join(runtimeDir, `validator-auth-browser-${process.pid}.sqlite`);
const shareDbPath = path.join(runtimeDir, `validator-auth-browser-share-${process.pid}.sqlite`);
const reportPath = path.join(root, 'docs', 'test-reports', 'auth-browser-report.json');
const screenshotDir = path.join(root, 'docs', 'test-prints');
const failures = [];
const consoleErrors = [];
const temporaryPassword = 'Ponte!Clara2026#Sul';
const permanentPassword = 'Horizonte!Vivo2027#Norte';

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function cleanup(filePath) {
  const resolved = path.resolve(filePath);
  if (!resolved.startsWith(path.resolve(runtimeDir) + path.sep)) throw new Error('Limpeza fora do runtime recusada.');
  for (const suffix of ['', '-wal', '-shm']) await fs.rm(`${resolved}${suffix}`, { force: true });
}

function loadPlaywright() {
  const candidates = [
    path.join(root, 'node_modules', 'playwright'),
    path.join(
      process.env.USERPROFILE || '',
      '.cache', 'codex-runtimes', 'codex-primary-runtime', 'dependencies', 'node', 'node_modules', 'playwright'
    )
  ];
  const errors = [];
  for (const candidate of candidates) {
    try {
      return { module: require(candidate), source: candidate };
    } catch (error) {
      errors.push(`${candidate}: ${error.code || error.message}`);
    }
  }
  throw new Error(`Playwright indisponivel. ${errors.join(' | ')}`);
}

await fs.mkdir(runtimeDir, { recursive: true });
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.mkdir(screenshotDir, { recursive: true });
await cleanup(dbPath);
await cleanup(shareDbPath);

const dbModule = require('../js/backend/db.js');
const bootstrap = dbModule.createDatabase({ dbPath, authMode: 'production', seedUsers: false });
try {
  const created = bootstrap.createUser({
    name: 'Bruna Souza',
    email: 'bruna@example.com',
    role: 'consultor',
    status: 'active',
    password: temporaryPassword,
    mustChangePassword: true
  });
  assert(created.ok && created.user.mustChangePassword, 'Usuario de navegador nao foi provisionado com troca obrigatoria.');
} finally {
  bootstrap.close();
}

process.env.BANCUS_AUTH_MODE = 'production';
process.env.BANCUS_AUTH_COOKIE_SECURE = 'false';
process.env.BANCUS_DB_PROVIDER = 'sqlite';
process.env.BANCUS_DB_PATH = dbPath;
process.env.BANCUS_SHARE_DB_PATH = shareDbPath;
delete process.env.BANCUS_DB_SEED_USERS;

const serverModule = require('../server.js');
const server = serverModule.startServer({ port: 0, host: '127.0.0.1' });
if (!server.listening) await new Promise((resolve) => server.once('listening', resolve));
const address = server.address();
const baseUrl = `http://127.0.0.1:${address.port}`;
const playwright = loadPlaywright();
let browser;

try {
  try {
    browser = await playwright.module.chromium.launch({ channel: 'msedge', headless: true });
  } catch (error) {
    browser = await playwright.module.chromium.launch({ headless: true });
  }
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    locale: 'pt-BR',
    reducedMotion: 'reduce'
  });
  const page = await context.newPage();
  page.on('console', (message) => {
    if (message.type() === 'error') consoleErrors.push(message.text());
  });
  page.on('pageerror', (error) => consoleErrors.push(error.message));

  const returnTo = 'simulador.html?journeyId=AUTH-BROWSER#proposta';
  await page.goto(`${baseUrl}/pages/login.html?redirect=${encodeURIComponent(returnTo)}`, { waitUntil: 'domcontentloaded' });
  await page.getByRole('heading', { name: 'Entre para continuar' }).waitFor();
  assert(await page.locator('[data-demo-login]').count() === 0, 'Login produtivo exibiu perfis demonstrativos.');
  assert(await page.locator('body').getAttribute('data-auth-mode') === 'production', 'Servidor nao declarou o modo produtivo no documento.');
  const visibleText = await page.locator('body').innerText();
  assert(!visibleText.includes('Demo local'), 'Cabecalho produtivo exibiu o selo Demo local.');
  assert(!/\b(?:seed|sqlite|api|prototipo|protótipo|espelhamento)\b/i.test(visibleText), 'Login exibiu linguagem tecnica desnecessaria.');
  assert(await page.getByLabel('E-mail').count() === 1 && await page.getByLabel('Senha', { exact: true }).count() === 1, 'Campos de login nao possuem rotulos acessiveis unicos.');
  assert(await page.locator('[data-login-status]').getAttribute('aria-live') === 'polite', 'Status do login nao e anunciado por tecnologia assistiva.');
  assert(await page.locator('[data-login-error]').getAttribute('aria-live') === 'assertive', 'Erros do login nao possuem regiao assertiva estavel.');

  await page.screenshot({ path: path.join(screenshotDir, 'auth-production-login-desktop.png'), fullPage: true });
  await page.keyboard.press('Tab');
  assert((await page.locator(':focus').innerText()).includes('Ir para o acesso'), 'Primeiro foco nao oferece salto para o conteudo.');
  await page.locator(':focus').evaluate((element) => element.blur());
  await page.setViewportSize({ width: 320, height: 800 });
  const mobileLayout = await page.evaluate(() => ({
    documentWidth: document.documentElement.scrollWidth,
    viewportWidth: document.documentElement.clientWidth,
    cardWidth: document.querySelector('.bf-auth-card')?.getBoundingClientRect().width || 0
  }));
  assert(mobileLayout.documentWidth <= mobileLayout.viewportWidth, 'Login possui rolagem horizontal em 320px.');
  assert(mobileLayout.cardWidth >= 280, 'Cartao de login desperdicou largura em tela estreita.');
  await page.screenshot({ path: path.join(screenshotDir, 'auth-production-login-mobile.png'), fullPage: true });
  await page.setViewportSize({ width: 1440, height: 1000 });

  await page.getByLabel('E-mail').fill('bruna@example.com');
  await page.getByLabel('Senha', { exact: true }).fill('Wrong!Password2026');
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByText('Não foi possível entrar. Confira seus dados e tente novamente.').waitFor();
  assert(await page.getByLabel('E-mail').getAttribute('aria-invalid') === 'true', 'Erro de credencial nao marcou os campos.');
  assert(await page.getByLabel('E-mail').evaluate((element) => element === document.activeElement), 'Erro de credencial nao devolveu foco ao e-mail.');
  consoleErrors.length = 0; // O 401 acima e esperado e ja foi validado pela interface.

  await page.getByLabel('Senha', { exact: true }).fill(temporaryPassword);
  await page.getByRole('button', { name: 'Entrar' }).click();
  await page.getByRole('heading', { name: 'Proteja seu acesso, Bruna' }).waitFor();
  assert(page.url().includes('/pages/login.html'), 'Senha temporaria redirecionou antes da troca obrigatoria.');
  assert(await page.getByLabel('Senha', { exact: true }).inputValue() === '', 'Senha temporaria permaneceu duplicada no formulario oculto.');
  assert(await page.getByRole('heading', { name: 'Proteja seu acesso, Bruna' }).evaluate((element) => element === document.activeElement), 'Troca obrigatoria nao anunciou a mudanca de contexto pelo foco.');
  assert(await page.getByRole('button', { name: 'Usar outra conta' }).count() === 1, 'Troca obrigatoria nao oferece saida para outra conta.');
  await page.screenshot({ path: path.join(screenshotDir, 'auth-production-password-change-desktop.png'), fullPage: true });

  await page.getByLabel('Nova senha', { exact: true }).fill(permanentPassword);
  await page.getByLabel('Confirme a nova senha').fill(permanentPassword);
  await page.getByRole('button', { name: 'Salvar e continuar' }).click();
  await page.waitForURL((url) => url.pathname.endsWith('/pages/simulador.html') && url.searchParams.get('journeyId') === 'AUTH-BROWSER' && url.hash === '#proposta');

  const cookies = await context.cookies(baseUrl);
  const authCookie = cookies.find((cookie) => cookie.name === 'bf_session');
  assert(Boolean(authCookie && authCookie.httpOnly && authCookie.sameSite === 'Lax'), 'Navegador nao recebeu cookie HttpOnly/SameSite.');
  const browserStorage = await page.evaluate(() => ({
    local: Object.fromEntries(Object.entries(localStorage)),
    session: Object.fromEntries(Object.entries(sessionStorage))
  }));
  assert(!Object.hasOwn(browserStorage.local, 'bf_backend_session_v1'), 'Modo produtivo gravou bearer no localStorage.');
  assert(!JSON.stringify(browserStorage).includes('"token"'), 'Estado do navegador contem token serializado.');

  const freshTab = await context.newPage();
  await freshTab.goto(`${baseUrl}/pages/dashboard-admin.html`, { waitUntil: 'domcontentloaded' });
  await freshTab.waitForURL((url) => url.pathname.endsWith('/pages/handoff-consultivo.html') && !url.searchParams.has('auth'));
  const freshAuth = await freshTab.evaluate(async () => {
    const ready = window.BFAuth && window.BFAuth.ready ? await window.BFAuth.ready : false;
    const user = window.BFAuth && window.BFAuth.getCurrentUser ? window.BFAuth.getCurrentUser() : null;
    return { ready, user };
  });
  assert(Boolean(freshAuth.ready && freshAuth.user && freshAuth.user.email === 'bruna@example.com'), 'Nova aba nao hidratou a identidade pelo cookie HttpOnly.');
  await freshTab.getByRole('heading', { name: 'Priorize oportunidades e conduza cada próximo passo.' }).waitFor();
  const forbiddenFeedback = freshTab.locator('[data-auth-feedback] [role="status"]');
  await forbiddenFeedback.waitFor();
  assert(
    (await forbiddenFeedback.innerText()).includes('Esta área não está disponível para o seu acesso.'),
    'Retorno por acesso negado nao exibiu uma mensagem humana.'
  );
  assert(new URL(freshTab.url()).searchParams.has('auth') === false, 'Retorno por acesso negado manteve parametro tecnico na URL.');
  assert(!freshTab.url().includes('/pages/login.html'), 'Nova aba com cookie valido nao recuperou a sessao produtiva.');
  await freshTab.close();

  const staleContext = await browser.newContext({ viewport: { width: 1024, height: 768 }, locale: 'pt-BR' });
  const stalePage = await staleContext.newPage();
  await stalePage.addInitScript(() => {
    const forgedUser = { id: 'FORGED', name: 'Forjado', email: 'forged@example.com', role: 'admin', status: 'active' };
    localStorage.setItem('bf_auth_mode_v1', JSON.stringify({ mode: 'production', transport: 'cookie', demoAccounts: false }));
    sessionStorage.setItem('bf_auth_public_session_v1', JSON.stringify({
      mode: 'production',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: forgedUser
    }));
    sessionStorage.setItem('bf_auth_session_v1', JSON.stringify({
      mode: 'production',
      expiresAt: '2099-01-01T00:00:00.000Z',
      user: forgedUser
    }));
  });
  await stalePage.goto(`${baseUrl}/pages/dashboard-admin.html`, { waitUntil: 'domcontentloaded' });
  await stalePage.waitForURL((url) => url.pathname.endsWith('/pages/login.html'));
  assert(stalePage.url().includes('redirect=dashboard-admin.html'), 'Descriptor local sem cookie nao foi rejeitado antes do boot protegido.');
  await staleContext.close();
  assert(consoleErrors.length === 0, `Console do fluxo de acesso registrou erros: ${consoleErrors.join(' | ')}`);

  await context.close();
} finally {
  if (browser) await browser.close();
  await new Promise((resolve) => server.close(resolve));
  await serverModule.closeInfrastructure();
}

const report = {
  ok: failures.length === 0,
  baseUrl,
  playwrightSource: playwright.source.startsWith(root)
    ? path.relative(root, playwright.source).replace(/\\/g, '/')
    : 'bundled-workspace-runtime',
  viewport: { width: 1440, height: 1000 },
  checks: {
    productiveCopy: !failures.some((item) => item.includes('linguagem')),
    demoHidden: !failures.some((item) => item.includes('demonstrativos')),
    accessibleForm: !failures.some((item) => item.includes('acessiv') || item.includes('foco')),
    mobileReflow: !failures.some((item) => item.includes('320px') || item.includes('tela estreita')),
    mandatoryPasswordChange: !failures.some((item) => item.includes('temporaria')),
    freshTabSession: !failures.some((item) => item.includes('Nova aba')),
    roleAwareForbiddenReturn: !failures.some((item) => item.includes('acesso negado')),
    staleDescriptorRejected: !failures.some((item) => item.includes('Descriptor local')),
    safeResume: !failures.some((item) => item.includes('redirecion')),
    noBrowserToken: !failures.some((item) => item.includes('token') || item.includes('bearer'))
  },
  screenshots: [
    'docs/test-prints/auth-production-login-desktop.png',
    'docs/test-prints/auth-production-login-mobile.png',
    'docs/test-prints/auth-production-password-change-desktop.png'
  ],
  consoleErrors,
  failures
};

await fs.writeFile(reportPath, JSON.stringify(report, null, 2));
await cleanup(dbPath);
await cleanup(shareDbPath);
console.log(JSON.stringify(report, null, 2));
if (failures.length) process.exit(1);
