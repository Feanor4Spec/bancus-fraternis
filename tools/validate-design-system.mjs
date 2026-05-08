import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const pagesDir = path.join(root, 'pages');
const failures = [];
const warnings = [];

const legacyControlled = new Set([
  'index_2.html',
  'index_v4_paginas.html',
  'consorcio_user_journey_map_v2.html'
]);

const criticalPages = new Set([
  'index.html',
  'produtos.html',
  'calculadoras.html',
  'comparador.html',
  'trilha-decisao.html',
  'dashboard-cliente.html',
  'handoff-consultivo.html',
  'dashboard-admin.html',
  'simulador.html',
  'carteira.html',
  'assembleias.html',
  'duvidas.html',
  'sobre-nos.html',
  'componentes-v8.html',
  'educacao.html',
  'compliance.html',
  'dados-abertos.html',
  'api-docs.html',
  'configuracoes.html'
]);

const denseJourneyPages = new Set([
  'index.html',
  'produtos.html',
  'calculadoras.html',
  'comparador.html',
  'dashboard-cliente.html',
  'handoff-consultivo.html',
  'dashboard-admin.html',
  'trilha-decisao.html',
  'simulador.html',
  'simulador-consorcio.html',
  'simulador-financiamento.html',
  'simulador-veiculos.html',
  'simulador-cdc.html',
  'simulador-garantia.html',
  'simulador-consignado.html',
  'carteira.html',
  'assembleias.html',
  'educacao.html',
  'compliance.html',
  'dados-abertos.html',
  'api-docs.html',
  'componentes-v8.html',
  'sobre-nos.html',
  'duvidas.html',
  'configuracoes.html'
]);

const lightSimulatorPages = new Set([
  'simulador-consorcio.html',
  'simulador-financiamento.html',
  'simulador-veiculos.html',
  'simulador-cdc.html',
  'simulador-garantia.html',
  'simulador-consignado.html'
]);

const trustPages = new Set([
  'sobre-nos.html',
  'duvidas.html',
  'educacao.html',
  'compliance.html',
  'dados-abertos.html',
  'api-docs.html'
]);

const settingsPages = new Set([
  'configuracoes.html'
]);

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function exists(filePath) {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

function hasTitle(html) {
  return /<title>[^<]+<\/title>/i.test(html);
}

function hasViewport(html) {
  return /<meta\s+name=["']viewport["']/i.test(html);
}

function hasV8Contract(html) {
  return html.includes('bf-design-system-v8.css') || html.includes('shared-layout.js');
}

function hasShell(html) {
  return html.includes('data-shell-header') || html.includes('hm-header') || html.includes('sim-header');
}

function hasPageIdentity(html) {
  return /data-bf-page=["'][^"']+["']/i.test(html) || html.includes('shared-layout.js');
}

function hasMojibake(text) {
  return /(?:\u00c3[\u0080-\u00bf]|\u00c2[\u0080-\u00bf]|\u00e2[\u0080-\u017f]|\u00f0[\u0080-\u017f]|\u00ef[\u0080-\u00bf])/.test(text);
}

function isExternal(value) {
  return /^(https?:|mailto:|tel:|javascript:|data:|#)/i.test(value) || value === '';
}

function extractLocalRefs(html) {
  const refs = [];
  const pattern = /\b(?:href|src)=["']([^"']+)["']/gi;
  let match;
  while ((match = pattern.exec(html))) {
    const raw = match[1].trim();
    const clean = raw.split('#')[0].split('?')[0];
    if (!isExternal(clean)) refs.push(clean);
  }
  return refs;
}

async function validateRefs(pageName, html) {
  const refs = extractLocalRefs(html);
  for (const ref of refs) {
    if (/\.html$/i.test(ref) || ref.includes('/') || ref.includes('.')) {
      const resolved = path.resolve(pagesDir, ref);
      if (!(await exists(resolved))) {
        const message = `${pageName} referencia arquivo inexistente: ${ref}`;
        if (criticalPages.has(pageName)) fail(message);
        else warn(message);
      }
    }
  }
}

const files = (await fs.readdir(pagesDir))
  .filter((name) => name.endsWith('.html'))
  .sort();

let active = 0;
let legacy = 0;
let withSharedLayout = 0;
let withDirectV8 = 0;

for (const pageName of files) {
  const html = await fs.readFile(path.join(pagesDir, pageName), 'utf8');
  const isLegacy = legacyControlled.has(pageName);

  if (isLegacy) {
    legacy += 1;
    warn(`${pageName} marcado como legado controlado.`);
    continue;
  }

  active += 1;
  if (html.includes('shared-layout.js')) withSharedLayout += 1;
  if (html.includes('bf-design-system-v8.css')) withDirectV8 += 1;

  if (!hasTitle(html)) fail(`${pageName} sem <title>.`);
  if (!hasViewport(html)) fail(`${pageName} sem meta viewport.`);
  if (!hasV8Contract(html)) fail(`${pageName} sem contrato visual v8 ou shared-layout.`);
  if (!hasShell(html)) fail(`${pageName} sem header/shell reconhecido.`);
  if (!hasPageIdentity(html)) fail(`${pageName} sem data-bf-page ou layout compartilhado.`);
  if (hasMojibake(html)) fail(`${pageName} contem possivel encoding quebrado visivel.`);
  if (criticalPages.has(pageName) && !hasV8Contract(html)) fail(`${pageName} critica fora do design system v8.`);
  if ((denseJourneyPages.has(pageName) || pageName.startsWith('calculadora-')) && !html.includes('data-v8-stagebar')) fail(`${pageName} sem stagebar v8 de continuidade.`);
  if (pageName === 'produtos.html' && !html.includes('data-products-decision-strip')) fail('produtos.html sem ponte de decisao.');
  if (pageName === 'produtos.html' && !html.includes('data-products-bridge-timeline')) fail('produtos.html sem timeline da ponte de decisao.');
  if (pageName === 'produtos.html' && !html.includes('data-products-selection-panel')) fail('produtos.html sem painel de selecao assistida.');
  if (pageName === 'produtos.html' && !html.includes('data-journey-analytics')) fail('produtos.html sem metricas locais de microconversao.');
  if (pageName === 'calculadoras.html' && !html.includes('data-calculators-decision-strip')) fail('calculadoras.html sem ponte de decisao.');
  if (pageName === 'calculadoras.html' && !html.includes('data-calculators-bridge-timeline')) fail('calculadoras.html sem timeline da ponte de decisao.');
  if (pageName === 'calculadoras.html' && !html.includes('decision-context.service.js')) fail('calculadoras.html sem contexto financeiro compartilhado.');
  if (pageName.startsWith('calculadora-') && !html.includes('data-calculator-decision-strip')) fail(`${pageName} sem ponte de decisao da calculadora.`);
  if (pageName.startsWith('calculadora-') && !html.includes('data-calculator-bridge-timeline')) fail(`${pageName} sem timeline da calculadora.`);
  if (pageName.startsWith('calculadora-') && !html.includes('decision-context.service.js')) fail(`${pageName} sem servico de contexto financeiro.`);
  if (lightSimulatorPages.has(pageName) && !html.includes('data-light-simulator-decision-strip')) fail(`${pageName} sem ponte de decisao do simulador leve.`);
  if (lightSimulatorPages.has(pageName) && !html.includes('data-light-simulator-timeline')) fail(`${pageName} sem timeline do simulador leve.`);
  if (pageName === 'simulador.html' && !html.includes('data-simulator-decision-strip')) fail('simulador.html sem resumo de decisao operacional.');
  if (pageName === 'simulador.html' && !html.includes('data-simulator-readiness')) fail('simulador.html sem painel de prontidao.');
  if (pageName === 'simulador.html' && !html.includes('decision-context.service.js')) fail('simulador.html sem contexto financeiro compartilhado.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('data-client-continuity-strip')) fail('dashboard-cliente.html sem central de continuidade.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('data-client-continuity-timeline')) fail('dashboard-cliente.html sem linha do tempo de continuidade.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('decision-context.service.js')) fail('dashboard-cliente.html sem contexto financeiro compartilhado.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('data-journey-analytics')) fail('dashboard-cliente.html sem metricas locais de jornada.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('data-client-recovery-signals')) fail('dashboard-cliente.html sem sinais de retomada da jornada.');
  if (pageName === 'dashboard-cliente.html' && !html.includes('journey-recovery.service.js')) fail('dashboard-cliente.html sem servico de retomada da jornada.');
  if (pageName === 'handoff-consultivo.html' && !html.includes('data-handoff-operational-strip')) fail('handoff-consultivo.html sem resumo operacional.');
  if (pageName === 'handoff-consultivo.html' && !html.includes('data-handoff-audit-feed')) fail('handoff-consultivo.html sem feed de auditoria.');
  if (pageName === 'handoff-consultivo.html' && !html.includes('data-handoff-recovery-signals')) fail('handoff-consultivo.html sem sinais de retomada para handoff.');
  if (pageName === 'handoff-consultivo.html' && !html.includes('journey-recovery.service.js')) fail('handoff-consultivo.html sem servico de retomada da jornada.');
  if (pageName === 'dashboard-admin.html' && !html.includes('data-admin-operational-strip')) fail('dashboard-admin.html sem resumo operacional.');
  if (pageName === 'dashboard-admin.html' && !html.includes('data-admin-journey-funnel')) fail('dashboard-admin.html sem funil administrativo de microconversoes.');
  if (pageName === 'dashboard-admin.html' && !html.includes('data-admin-operational-alerts')) fail('dashboard-admin.html sem alertas operacionais de SLA e abandono.');
  if (pageName === 'dashboard-admin.html' && !html.includes('data-admin-recovery-queue')) fail('dashboard-admin.html sem fila administrativa de recuperacao.');
  if (pageName === 'dashboard-admin.html' && !html.includes('data-admin-recovery-packages')) fail('dashboard-admin.html sem governanca de pacotes de recuperacao.');
  if (pageName === 'dashboard-admin.html' && !html.includes('admin-recovery.service.js')) fail('dashboard-admin.html sem servico administrativo de recuperacao.');
  if (pageName === 'comparador.html' && !html.includes('data-comparator-decision-strip')) fail('comparador.html sem ponte de decisao.');
  if (pageName === 'comparador.html' && !html.includes('data-comparator-bridge-timeline')) fail('comparador.html sem timeline da ponte de decisao.');
  if (pageName === 'comparador.html' && !html.includes('data-journey-analytics')) fail('comparador.html sem metricas locais de microconversao.');
  if (pageName === 'trilha-decisao.html' && !html.includes('data-journey-bridge-strip')) fail('trilha-decisao.html sem ponte de decisao.');
  if (pageName === 'trilha-decisao.html' && !html.includes('data-journey-bridge-timeline')) fail('trilha-decisao.html sem timeline da ponte de decisao.');
  if (pageName === 'assembleias.html' && !html.includes('data-assembly-decision-strip')) fail('assembleias.html sem resumo de decisao operacional.');
  if (pageName === 'carteira.html' && !html.includes('data-portfolio-decision-strip')) fail('carteira.html sem resumo de decisao operacional.');
  if (trustPages.has(pageName) && !html.includes('data-trust-decision-strip')) fail(`${pageName} sem resumo de confianca institucional.`);
  if (trustPages.has(pageName) && !html.includes('data-trust-timeline')) fail(`${pageName} sem timeline de confianca institucional.`);
  if (settingsPages.has(pageName) && !html.includes('data-settings-decision-strip')) fail(`${pageName} sem resumo de configuracoes.`);
  if (settingsPages.has(pageName) && !html.includes('data-settings-timeline')) fail(`${pageName} sem timeline de configuracoes.`);
  if (pageName === 'index.html' && !html.includes('data-home-decision-strip')) fail('index.html sem resumo institucional da home.');
  if (pageName === 'index.html' && !html.includes('data-home-institutional-timeline')) fail('index.html sem timeline institucional da home.');
  if (pageName === 'index.html' && !html.includes('data-home-hero-contextual')) fail('index.html sem hero contextual da home.');
  if (pageName === 'index.html' && !html.includes('data-home-hero-primary')) fail('index.html sem CTA primario contextual da home.');
  if (pageName === 'index.html' && !html.includes('data-home-continuity-cockpit')) fail('index.html sem cockpit de continuidade local.');
  if (pageName === 'index.html' && !html.includes('data-home-continuity-metrics')) fail('index.html sem metricas de continuidade local.');
  if (pageName === 'index.html' && !html.includes('decision-context.service.js')) fail('index.html sem contexto financeiro compartilhado.');
  if (pageName === 'componentes-v8.html' && !html.includes('data-component-decision-strip')) fail('componentes-v8.html sem resumo de componentes.');
  if (pageName === 'componentes-v8.html' && !html.includes('data-component-timeline')) fail('componentes-v8.html sem timeline de componentes.');
  if (pageName === 'componentes-v8.html' && !html.includes('bf-component-swatch-grid')) fail('componentes-v8.html sem amostra de tokens visuais.');

  await validateRefs(pageName, html);
}

const requiredFiles = [
  'assets/css/bf-design-system-v8.css',
  'assets/css/platform.css',
  'assets/js/services/decision-context.service.js',
  'assets/js/services/journey-recovery.service.js',
  'assets/js/services/admin-recovery.service.js',
  'js/shared-layout.js',
  'js/proposal-acceptance.js',
  'assets/js/services/handoff-consultivo.service.js',
  'tools/validate-calculadoras.mjs',
  'tools/validate-dashboard-continuity-flow.mjs',
  'tools/validate-decision-flow.mjs',
  'tools/validate-decision-journey-context.mjs',
  'tools/validate-product-journey-flow.mjs',
  'tools/validate-recovery-signals-flow.mjs',
  'tools/validate-admin-recovery-queue.mjs',
  'tools/validate-admin-recovery-filters-export.mjs',
  'tools/validate-admin-recovery-package-governance.mjs',
  'tools/validate-admin-recovery-package-operations.mjs',
  'tools/validate-admin-recovery-package-sla-filters.mjs',
  'tools/validate-admin-recovery-routing-goals.mjs',
  'tools/validate-admin-dashboard-source-funnel.mjs',
  'tools/validate-public-contracts.mjs',
  'tools/validate-docs-modernization.mjs',
  'tools/validate-handoff-consultant-operations.mjs',
  'tools/validate-auth-navigation.mjs',
  'tools/validate-navigable-journey.mjs',
  'tools/validate-github-pages-deploy.mjs',
  'tools/validate-home-continuity-cockpit.mjs',
  'tools/validate-home-contextual-hero.mjs',
  'tools/validate-proposal-acceptance.mjs',
  'tools/validate-proposal-builder.mjs',
  'tools/validate-proposal-handoff.mjs'
];

for (const file of requiredFiles) {
  if (!(await exists(path.join(root, file)))) fail(`Arquivo obrigatorio ausente: ${file}`);
}

const adminUsersJs = await fs.readFile(path.join(root, 'assets/js/admin-users.js'), 'utf8');
if (!adminUsersJs.includes('data-admin-recovery-imported-items')) fail('admin-users.js sem painel operacional de itens importados.');
if (!adminUsersJs.includes('data-admin-package-assign')) fail('admin-users.js sem acao de atribuicao de item importado.');
if (!adminUsersJs.includes('data-admin-package-handoff')) fail('admin-users.js sem acao de handoff de item importado.');
if (!adminUsersJs.includes('data-admin-package-filters')) fail('admin-users.js sem filtros de itens importados.');
if (!adminUsersJs.includes('data-admin-package-filter="sla"')) fail('admin-users.js sem filtro de SLA para itens importados.');
if (!adminUsersJs.includes('data-admin-package-routing')) fail('admin-users.js sem painel de roteamento de itens importados.');
if (!adminUsersJs.includes('data-admin-package-route')) fail('admin-users.js sem acao de roteamento automatico.');
if (!adminUsersJs.includes('data-admin-package-goal-input')) fail('admin-users.js sem metas de conversao por consultor.');
if (!adminUsersJs.includes('data-admin-source-funnel')) fail('admin-users.js sem funil administrativo por origem.');
if (!adminUsersJs.includes('data-admin-bottleneck-board')) fail('admin-users.js sem quadro administrativo de gargalos.');
if (!adminUsersJs.includes('Proposta revisada sem handoff')) fail('admin-users.js sem gargalo de proposta revisada sem handoff.');
if (!adminUsersJs.includes('Trilha sem comparador')) fail('admin-users.js sem gargalo de trilha sem comparador.');
if (!adminUsersJs.includes('Handoff sem responsavel')) fail('admin-users.js sem gargalo de handoff sem responsavel.');

const simulatorHtml = await fs.readFile(path.join(root, 'pages/simulador.html'), 'utf8');
const simulatorAppJs = await fs.readFile(path.join(root, 'js/app.js'), 'utf8');
const proposalSummaryJs = await fs.readFile(path.join(root, 'js/proposal-summary.js'), 'utf8');
if (!simulatorHtml.includes('data-proposal-acceptance-panel')) fail('simulador.html sem painel de aceite local da proposta.');
if (!simulatorHtml.includes('../js/proposal-acceptance.js')) fail('simulador.html nao carrega proposal-acceptance.js.');
if (!simulatorHtml.includes('../assets/js/services/handoff-consultivo.service.js')) fail('simulador.html nao carrega servico de handoff consultivo.');
if (!simulatorAppJs.includes('salvarRevisaoProposta')) fail('app.js sem acao de salvar revisao da proposta.');
if (!simulatorAppJs.includes('criarHandoffProposta')) fail('app.js sem acao de criar handoff da proposta.');
if (!simulatorAppJs.includes('data-proposal-handoff-bridge')) fail('app.js sem ponte visual proposta -> handoff.');
if (!proposalSummaryJs.includes('ps-section--acceptance')) fail('proposal-summary.js sem bloco de aceite no PDF.');

const asciiCssFiles = [
  'css/home.css',
  'css/shared-site.css',
  'assets/css/bf-design-system-v8.css'
];

for (const file of asciiCssFiles) {
  const filePath = path.join(root, file);
  if (!(await exists(filePath))) {
    fail(`CSS monitorado ausente: ${file}`);
    continue;
  }
  const css = await fs.readFile(filePath, 'utf8');
  if (/[^\x00-\x7F]/.test(css)) fail(`${file} contem caracteres nao ASCII apos saneamento visual.`);
}

const summary = {
  ok: failures.length === 0,
  pages: files.length,
  active,
  legacyControlled: legacy,
  withSharedLayout,
  withDirectV8,
  criticalPages: criticalPages.size,
  denseJourneyPages: denseJourneyPages.size,
  warnings,
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
