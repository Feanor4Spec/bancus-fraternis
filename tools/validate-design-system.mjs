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
  if (pageName === 'dashboard-cliente.html' && !html.includes('data-client-continuity-cockpit')) fail('dashboard-cliente.html sem cockpit acionavel de continuidade.');
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
  'assets/js/services/backend-api.service.js',
  'assets/js/services/journey-recovery.service.js',
  'assets/js/services/admin-recovery.service.js',
  'js/backend/db.js',
  'js/shared-layout.js',
  'js/proposal-builder.js',
  'js/proposal-governance.js',
  'js/simulator-journey.js',
  'js/simulator-state.js',
  'js/simulator-shelf.js',
  'js/simulator-cart.js',
  'js/simulator-result.js',
  'js/proposal-acceptance.js',
  'js/proposal-versioning.js',
  'assets/js/services/handoff-consultivo.service.js',
  'docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md',
  'docs/PROXIMAS_FASES_BANK_FRATERN.md',
  'tools/validate-calculadoras.mjs',
  'tools/validate-calculator-journey.mjs',
  'tools/validate-simulator-performance.mjs',
  'tools/validate-simulator-refactor.mjs',
  'tools/validate-simulator-shelf.mjs',
  'tools/validate-simulator-cart.mjs',
  'tools/validate-simulator-result-decision.mjs',
  'tools/validate-proposal-governance.mjs',
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
  'tools/validate-public-release-safety.mjs',
  'tools/validate-local-database.mjs',
  'tools/validate-backend-production-plan.mjs',
  'tools/validate-next-phases-plan.mjs',
  'tools/validate-docs-modernization.mjs',
  'tools/validate-handoff-consultant-operations.mjs',
  'tools/validate-auth-navigation.mjs',
  'tools/validate-navigable-journey.mjs',
  'tools/validate-online-journey-smoke.mjs',
  'tools/validate-github-pages-deploy.mjs',
  'tools/validate-home-continuity-cockpit.mjs',
  'tools/validate-home-contextual-hero.mjs',
  'tools/validate-proposal-acceptance.mjs',
  'tools/validate-proposal-builder.mjs',
  'tools/validate-proposal-versioning.mjs',
  'tools/validate-proposal-handoff.mjs'
];

for (const file of requiredFiles) {
  if (!(await exists(path.join(root, file)))) fail(`Arquivo obrigatorio ausente: ${file}`);
}

const adminUsersJs = await fs.readFile(path.join(root, 'assets/js/admin-users.js'), 'utf8');
const clientDashboardJs = await fs.readFile(path.join(root, 'assets/js/client-dashboard.js'), 'utf8');
const backendApiJs = await fs.readFile(path.join(root, 'assets/js/services/backend-api.service.js'), 'utf8');
const storageJs = await fs.readFile(path.join(root, 'js/storage.js'), 'utf8');
const proposalVersioningJs = await fs.readFile(path.join(root, 'js/proposal-versioning.js'), 'utf8');
const proposalAcceptanceJs = await fs.readFile(path.join(root, 'js/proposal-acceptance.js'), 'utf8');
const proposalBuilderJs = await fs.readFile(path.join(root, 'js/proposal-builder.js'), 'utf8');
const handoffServiceJs = await fs.readFile(path.join(root, 'assets/js/services/handoff-consultivo.service.js'), 'utf8');
const calculatorsPageJs = await fs.readFile(path.join(root, 'assets/js/calculadoras-page.js'), 'utf8');
const platformCss = await fs.readFile(path.join(root, 'assets/css/platform.css'), 'utf8');
const stylesCss = await fs.readFile(path.join(root, 'css/styles.css'), 'utf8');
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
if (!adminUsersJs.includes('data-admin-backend-events')) fail('admin-users.js sem painel de eventos do banco local.');
if (!adminUsersJs.includes('data-admin-backend-event-refresh')) fail('admin-users.js sem acao de atualizar eventos do banco local.');
if (!adminUsersJs.includes('listEvents(30)')) fail('admin-users.js sem leitura de eventos da API local.');
if (!adminUsersJs.includes('data-admin-backend-snapshots')) fail('admin-users.js sem lista de snapshots server-side.');
if (!adminUsersJs.includes('data-admin-backend-snapshot')) fail('admin-users.js sem item de snapshot server-side.');
if (!adminUsersJs.includes('listSnapshots(30)')) fail('admin-users.js sem leitura de snapshots da API local.');
if (!adminUsersJs.includes('data-admin-backend-entities')) fail('admin-users.js sem lista de entidades relacionais server-side.');
if (!adminUsersJs.includes('data-admin-backend-entity')) fail('admin-users.js sem item de entidade relacional server-side.');
if (!adminUsersJs.includes('listJourneyEntities(50)')) fail('admin-users.js sem leitura de entidades relacionais da API local.');
if (!adminUsersJs.includes('data-admin-backend-materialized')) fail('admin-users.js sem lista de tabelas dedicadas server-side.');
if (!adminUsersJs.includes('data-admin-backend-materialized-item')) fail('admin-users.js sem item de tabela dedicada server-side.');
if (!adminUsersJs.includes('data-admin-backend-materialized-control')) fail('admin-users.js sem controles operacionais de tabela dedicada.');
if (!adminUsersJs.includes('data-admin-backend-materialized-field')) fail('admin-users.js sem campos editaveis de tabela dedicada.');
if (!adminUsersJs.includes('data-admin-backend-materialized-save')) fail('admin-users.js sem botao de salvar tabela dedicada.');
if (!adminUsersJs.includes('data-admin-dedicated-queue')) fail('admin-users.js sem fila dedicada de registros materializados.');
if (!adminUsersJs.includes('data-admin-dedicated-queue-filter')) fail('admin-users.js sem filtros da fila dedicada.');
if (!adminUsersJs.includes('data-admin-dedicated-queue-summary')) fail('admin-users.js sem resumo da fila dedicada.');
if (!adminUsersJs.includes('data-admin-dedicated-queue-item')) fail('admin-users.js sem itens da fila dedicada.');
if (!adminUsersJs.includes('handleMaterializedUpdate')) fail('admin-users.js sem handler de PATCH para tabela dedicada.');
if (!adminUsersJs.includes('materializedUpdateMethod')) fail('admin-users.js sem roteamento updateLead/updateSimulation/updateProposal.');
if (!platformCss.includes('.bf-admin-materialized-controls')) fail('platform.css sem layout dos controles de tabela dedicada.');
if (!platformCss.includes('.bf-admin-dedicated-queue')) fail('platform.css sem layout da fila dedicada do Admin.');
if (!platformCss.includes('.bf-admin-dedicated-toolbar')) fail('platform.css sem layout dos filtros da fila dedicada.');
if (!adminUsersJs.includes('listLeads(30)')) fail('admin-users.js sem leitura de leads materializados.');
if (!adminUsersJs.includes('listSimulations(30)')) fail('admin-users.js sem leitura de simulacoes materializadas.');
if (!adminUsersJs.includes('listProposals(30)')) fail('admin-users.js sem leitura de propostas materializadas.');
if (!adminUsersJs.includes('databaseStatus')) fail('admin-users.js sem status tecnico do banco local.');
if (!adminUsersJs.includes('data-admin-backend-table')) fail('admin-users.js sem lista de tabelas SQLite.');
if (!adminUsersJs.includes('data-admin-local-import-panel')) fail('admin-users.js sem painel de migracao localStorage para SQLite.');
if (!adminUsersJs.includes('data-admin-local-import-preview')) fail('admin-users.js sem previsualizacao de migracao localStorage.');
if (!adminUsersJs.includes('data-admin-local-import-run')) fail('admin-users.js sem execucao de migracao localStorage.');
if (!adminUsersJs.includes('importLocalSnapshot')) fail('admin-users.js sem chamada de importacao localStorage para SQLite.');
if (!adminUsersJs.includes('collectLocalSnapshotRecords')) fail('admin-users.js sem coleta de snapshots locais para SQLite.');
if (!adminUsersJs.includes('data-admin-local-snapshot-count')) fail('admin-users.js sem metrica de snapshots locais na migracao.');
if (!adminUsersJs.includes('Proposta revisada sem handoff')) fail('admin-users.js sem gargalo de proposta revisada sem handoff.');
if (!adminUsersJs.includes('Trilha sem comparador')) fail('admin-users.js sem gargalo de trilha sem comparador.');
if (!adminUsersJs.includes('Handoff sem responsavel')) fail('admin-users.js sem gargalo de handoff sem responsavel.');
if (!clientDashboardJs.includes('data-client-backend-snapshots')) fail('client-dashboard.js sem marcador de origem dos snapshots server-side.');
if (!clientDashboardJs.includes('listSnapshots(100)')) fail('client-dashboard.js sem leitura de snapshots server-side.');
if (!clientDashboardJs.includes('backendSnapshotState')) fail('client-dashboard.js sem estado de snapshots server-side.');
if (!clientDashboardJs.includes('data-client-backend-entities')) fail('client-dashboard.js sem marcador de entidades relacionais server-side.');
if (!clientDashboardJs.includes('listJourneyEntities(100)')) fail('client-dashboard.js sem leitura de entidades relacionais server-side.');
if (!clientDashboardJs.includes('backendEntityState')) fail('client-dashboard.js sem estado de entidades relacionais server-side.');
if (!clientDashboardJs.includes('data-client-backend-materialized')) fail('client-dashboard.js sem marcador de tabelas dedicadas server-side.');
if (!clientDashboardJs.includes('backendMaterializedState')) fail('client-dashboard.js sem estado de tabelas dedicadas server-side.');
if (!clientDashboardJs.includes('listLeads(30)')) fail('client-dashboard.js sem leitura de leads materializados.');
if (!clientDashboardJs.includes('listSimulations(30)')) fail('client-dashboard.js sem leitura de simulacoes materializadas.');
if (!clientDashboardJs.includes('listProposals(30)')) fail('client-dashboard.js sem leitura de propostas materializadas.');
if (!backendApiJs.includes('saveLead')) fail('BFBackendApi sem escrita direta de lead.');
if (!backendApiJs.includes('updateLead')) fail('BFBackendApi sem atualizacao direta de lead.');
if (!backendApiJs.includes('saveSimulation')) fail('BFBackendApi sem escrita direta de simulacao.');
if (!backendApiJs.includes('updateSimulation')) fail('BFBackendApi sem atualizacao direta de simulacao.');
if (!backendApiJs.includes('saveProposal')) fail('BFBackendApi sem escrita direta de proposta.');
if (!backendApiJs.includes('updateProposal')) fail('BFBackendApi sem atualizacao direta de proposta.');
if (!storageJs.includes('api.saveSimulation')) fail('storage.js sem hook real de escrita direta de simulacao.');
if (!proposalVersioningJs.includes('api.saveProposal')) fail('proposal-versioning.js sem hook real de escrita direta de proposta.');
if (!proposalAcceptanceJs.includes('api.saveProposal')) fail('proposal-acceptance.js sem hook real de escrita direta de proposta.');
if (!proposalBuilderJs.includes('api.saveProposal')) fail('proposal-builder.js sem hook real de escrita direta da lousa.');
if (!handoffServiceJs.includes('api.saveLead')) fail('handoff-consultivo.service.js sem hook real de escrita direta de lead.');
if (!calculatorsPageJs.includes('buildCalculatorProfileContinuity')) fail('calculadoras-page.js sem continuidade por perfil consolidado.');
if (!calculatorsPageJs.includes('data-calculator-profile-continuity')) fail('calculadoras-page.js sem marcador visual de continuidade por perfil.');
if (!calculatorsPageJs.includes('data-calculators-profile-continuity')) fail('calculadoras-page.js sem marcador do hub para continuidade por perfil.');
if (!calculatorsPageJs.includes('data-calculator-field-source')) fail('calculadoras-page.js sem selo de origem dos campos reaproveitados.');
if (!platformCss.includes('.bf-calculator-field-source')) fail('platform.css sem layout do selo de origem dos campos.');
if (!calculatorsPageJs.includes('data-calculator-saved-comparison')) fail('calculadoras-page.js sem comparacao com ultimo salvo.');
if (!platformCss.includes('.bf-calculator-saved-comparison')) fail('platform.css sem layout da comparacao com ultimo salvo.');

const simulatorHtml = await fs.readFile(path.join(root, 'pages/simulador.html'), 'utf8');
const simulatorAppJs = await fs.readFile(path.join(root, 'js/app.js'), 'utf8');
const simulatorShelfJs = await fs.readFile(path.join(root, 'js/simulator-shelf.js'), 'utf8');
const simulatorResultJs = await fs.readFile(path.join(root, 'js/simulator-result.js'), 'utf8');
const proposalSummaryJs = await fs.readFile(path.join(root, 'js/proposal-summary.js'), 'utf8');
const proposalGovernanceJs = await fs.readFile(path.join(root, 'js/proposal-governance.js'), 'utf8');
if (!simulatorHtml.includes('data-proposal-acceptance-panel')) fail('simulador.html sem painel de aceite local da proposta.');
if (!simulatorHtml.includes('data-proposal-version-panel')) fail('simulador.html sem painel de versoes da proposta.');
if (!simulatorHtml.includes('../js/proposal-acceptance.js')) fail('simulador.html nao carrega proposal-acceptance.js.');
if (!simulatorHtml.includes('../js/proposal-versioning.js')) fail('simulador.html nao carrega proposal-versioning.js.');
if (!simulatorHtml.includes('../js/proposal-governance.js')) fail('simulador.html nao carrega proposal-governance.js.');
if (!simulatorHtml.includes('../js/simulator-shelf.js')) fail('simulador.html nao carrega simulator-shelf.js.');
if (!simulatorHtml.includes('../js/simulator-cart.js')) fail('simulador.html nao carrega simulator-cart.js.');
if (!simulatorHtml.includes('../js/simulator-result.js')) fail('simulador.html nao carrega simulator-result.js.');
if (!simulatorHtml.includes('data-simulator-objective-guide')) fail('simulador.html sem guia visual de objetivo do simulador.');
if (!simulatorHtml.includes('../assets/js/services/handoff-consultivo.service.js')) fail('simulador.html nao carrega servico de handoff consultivo.');
if (!simulatorAppJs.includes('BFSimulatorShelf')) fail('app.js sem delegacao de prateleira para BFSimulatorShelf.');
if (!simulatorAppJs.includes('BFSimulatorCart')) fail('app.js sem delegacao de carrinho para BFSimulatorCart.');
if (!simulatorAppJs.includes('BFSimulatorResult')) fail('app.js sem delegacao de resultado para BFSimulatorResult.');
if (!simulatorAppJs.includes('applySimulatorObjectiveGuide')) fail('app.js sem acao de aplicar objetivo guiado.');
if (!simulatorShelfJs.includes('data-shelf-recommendation')) fail('simulator-shelf.js sem recomendacao explicavel na prateleira.');
if (!simulatorResultJs.includes('renderAnalyticalTable')) fail('simulator-result.js sem tabela analitica extraida.');
if (!stylesCss.includes('.sim-objective-guide')) fail('styles.css sem layout do guia de objetivo.');
if (!stylesCss.includes('.shelf-recommendation')) fail('styles.css sem layout de recomendacao da prateleira.');
if (!stylesCss.includes('.ps-section--decision')) fail('styles.css sem layout da decisao final do resultado.');
if (!simulatorAppJs.includes('salvarRevisaoProposta')) fail('app.js sem acao de salvar revisao da proposta.');
if (!simulatorAppJs.includes('salvarVersaoProposta')) fail('app.js sem acao de salvar versao da proposta.');
if (!simulatorAppJs.includes('criarHandoffProposta')) fail('app.js sem acao de criar handoff da proposta.');
if (!proposalGovernanceJs.includes('data-proposal-handoff-bridge')) fail('proposal-governance.js sem ponte visual proposta -> handoff.');
if (!proposalSummaryJs.includes('ps-section--acceptance')) fail('proposal-summary.js sem bloco de aceite no PDF.');
if (!proposalSummaryJs.includes('data-simulator-result-decision')) fail('proposal-summary.js sem bloco de decisao final no PDF.');

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
