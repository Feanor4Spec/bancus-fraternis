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

const [
  contracts,
  map,
  plan,
  backendProductionPlan,
  protocol,
  apiDocs,
  designValidator,
  lousa,
  adminDashboard,
  adminUsers,
  clientDashboard,
  backendApi,
  server,
  simulator,
  app,
  simulatorShelf,
  simulatorCart,
  simulatorResult,
  proposalSummary,
  proposalBuilder,
  proposalGovernance,
  proposalVersioning,
  proposalAcceptance,
  storageJs,
  decisionContext,
  calculatorsPage,
  decisionJourney,
  handoffService,
  calculatorsJson
] = await Promise.all([
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'),
  read('docs/CODEX_TEST_PROTOCOL.md'),
  read('pages/api-docs.html'),
  read('tools/validate-design-system.mjs'),
  read('pages/lousa-navegacao.html'),
  read('pages/dashboard-admin.html'),
  read('assets/js/admin-users.js'),
  read('assets/js/client-dashboard.js'),
  read('assets/js/services/backend-api.service.js'),
  read('server.js'),
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/simulator-shelf.js'),
  read('js/simulator-cart.js'),
  read('js/simulator-result.js'),
  read('js/proposal-summary.js'),
  read('js/proposal-builder.js'),
  read('js/proposal-governance.js'),
  read('js/proposal-versioning.js'),
  read('js/proposal-acceptance.js'),
  read('js/storage.js'),
  read('assets/js/services/decision-context.service.js'),
  read('assets/js/calculadoras-page.js'),
  read('assets/js/services/trilha-decisao.service.js'),
  read('assets/js/services/handoff-consultivo.service.js'),
  read('assets/data/calculadoras.json')
]);

assert(await exists('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'), 'Documento de contratos publicos ausente.');
assert(await exists('tools/validate-public-contracts.mjs'), 'Validador de contratos publicos ausente.');

[
  '# Contratos Publicos - Bancus Fraternis',
  '## Persistencia Local',
  '## Marcadores Data',
  '## Exports Globais',
  '## Deep Links',
  '## Validadores Obrigatorios',
  '## Definition Of Done'
].forEach((section) => assert(contracts.includes(section), `Contratos publicos sem secao ${section}.`));

[
  'bf_auth_users_v1',
  'bf_backend_session_v1',
  'consorciopro_simulations',
  'bank_fratern_proposal_acceptances_v1',
  'bank_fratern_proposal_versions_v1',
  'bank_fratern_proposal_builder_v1',
  'bf_financial_profile_v1',
  'bf_calculator_history_v1',
  'bf_decision_journey_v1:<owner>',
  'bf_journey_analytics_v1:<owner>',
  'bf_comparator_models_v1:<owner>',
  'bf_consultive_handoffs_v1',
  'bf_operational_action_states_v1',
  'bf_operational_action_audit_v1',
  'bf_admin_commercial_stage_states_v1',
  'bf_admin_commercial_stage_audit_v1',
  'bf_admin_recovery_imports_v1',
  'bf_admin_recovery_conversion_goals_v1'
].forEach((key) => assert(contracts.includes(key), `Contrato localStorage nao documentado: ${key}.`));

[
  'data-proposal-builder-board',
  'data-proposal-version-panel',
  'data-proposal-version-history',
  'data-proposal-version-comparison',
  'data-proposal-builder-readiness',
  'data-proposal-builder-option',
  'data-admin-next-actions',
  'data-admin-action-queue',
  'data-admin-action-execution',
  'data-admin-action-owner-history',
  'data-admin-consultant-productivity',
  'data-admin-consultant-productivity-row',
  'data-admin-consultant-portfolio',
  'data-admin-consultant-portfolio-row',
  'data-admin-consultant-portfolio-lead',
  'data-admin-consultant-portfolio-filters',
  'data-admin-portfolio-filter',
  'data-admin-consultant-portfolio-export',
  'data-admin-consultant-portfolio-priority',
  'data-admin-consultant-portfolio-priority-lead',
  'data-admin-commercial-pipeline',
  'data-admin-commercial-stage',
  'data-admin-commercial-lead',
  'data-admin-commercial-stage-select',
  'data-admin-commercial-stage-history',
  'data-admin-commercial-stage-insights',
  'data-admin-commercial-stage-movement',
  'data-admin-commercial-stage-stuck-lead',
  'data-admin-commercial-stage-summary',
  'data-admin-commercial-pipeline-export',
  'data-admin-source-funnel',
  'data-admin-bottleneck-board',
  'data-admin-backend-events',
  'data-admin-backend-event',
  'data-admin-backend-snapshots',
  'data-admin-backend-snapshot',
  'data-admin-backend-entities',
  'data-admin-backend-entity',
  'data-admin-backend-materialized',
  'data-admin-backend-materialized-item',
  'data-admin-backend-materialized-control',
  'data-admin-backend-materialized-field',
  'data-admin-backend-materialized-save',
  'data-admin-dedicated-queue',
  'data-admin-dedicated-queue-filters',
  'data-admin-dedicated-queue-filter',
  'data-admin-dedicated-queue-summary',
  'data-admin-dedicated-queue-item',
  'data-admin-dedicated-queue-clear',
  'data-admin-backend-table',
  'data-admin-backend-database-provider',
  'data-admin-backend-event-refresh',
  'data-admin-local-import-panel',
  'data-admin-local-import-preview',
  'data-admin-local-import-run',
  'data-admin-local-import-result',
  'data-admin-local-snapshot-count',
  'data-handoff-consultant-cockpit',
  'data-handoff-action-plan',
  'data-handoff-action-execution',
  'data-handoff-proposal-version',
  'data-handoff-commercial-stage',
  'data-handoff-commercial-stage-panel',
  'data-handoff-commercial-stage-history',
  'data-login-form',
  'data-public-demo-notice',
  'data-client-continuity-cockpit',
  'data-client-backend-snapshots',
  'data-client-backend-entities',
  'data-client-backend-materialized',
  'data-client-next-action',
  'data-client-handoff-status',
  'data-client-proposal-status',
  'data-client-simulation-context',
  'data-client-commercial-stage',
  'data-client-continuity-timeline',
  'data-products-selection-panel',
  'data-decision-journey-form',
  'data-calculator-field-origin',
  'data-calculator-field-source',
  'data-calculator-field-source-key',
  'data-calculator-saved-comparison',
  'data-calculator-saved-comparison-item',
  'data-calculator-profile-continuity',
  'data-calculators-profile-continuity',
  'data-simulator-journey-actions',
  'data-simulator-objective-guide',
  'data-simulator-objective-card',
  'data-simulator-objective-apply',
  'data-simulator-result-decision',
  'data-simulator-result-cta',
  'data-simulator-result-premise',
  'data-simulator-result-risk',
  'data-simulator-result-comparison',
  'data-v8-stagebar',
  'data-shelf-recommendation',
  'data-shelf-recommendation-reason',
  'data-lousa-commercial-qa',
  'data-lousa-qa-checkpoint',
  'data-lousa-journey-checklist',
  'data-lousa-journey-acceptance'
].forEach((marker) => assert(contracts.includes(marker), `Marcador data-* nao documentado: ${marker}.`));

[
  'bank-fratern.admin-consultant-portfolio.v1',
  'bank-fratern.admin-commercial-pipeline.v1'
].forEach((schema) => assert(contracts.includes(schema), `Schema publico nao documentado: ${schema}.`));

[
  'BFAuth',
  'BFBackendApi',
  'BFDecisionContext',
  'BFCalculadoras',
  'BFProposalBuilder',
  'BFProposalGovernance',
  'BFSimulatorJourney',
  'BFSimulatorState',
  'BFSimulatorShelf',
  'BFSimulatorCart',
  'BFSimulatorResult',
  'BFComparatorModels',
  'BFTrilhaDecisaoService',
  'BFDecisionJourneyContext',
  'BFHandoffConsultivoService',
  'BFAdminRecoveryService',
  'BFProposalAcceptance',
  'BFProposalVersions',
  'ProposalSummary',
  'BankFraternProgress'
].forEach((globalName) => assert(contracts.includes(globalName), `Export global nao documentado: ${globalName}.`));

[
  'from=products',
  'from=calculator|calculators',
  'from=journey',
  'sourceFrom',
  'historyId',
  'handoffId',
  'admin-proximos-passos',
  'admin-fila-acao',
  'admin-origens',
  'admin-gargalos'
].forEach((deepLink) => assert(contracts.includes(deepLink), `Deep link nao documentado: ${deepLink}.`));

[
  'tools/validate-public-contracts.mjs',
  'tools/validate-public-release-safety.mjs',
  'tools/validate-local-database.mjs',
  'tools/inspect-local-sql-environment.mjs',
  'tools/validate-design-system.mjs',
  'tools/validate-calculadoras.mjs',
  'tools/validate-calculator-journey.mjs',
  'tools/validate-admin-dashboard-source-funnel.mjs',
  'tools/validate-proposal-builder.mjs',
  'tools/validate-proposal-governance.mjs',
  'tools/validate-proposal-versioning.mjs',
  'tools/validate-simulator-groups.mjs',
  'tools/validate-simulator-performance.mjs',
  'tools/validate-simulator-refactor.mjs',
  'tools/validate-simulator-shelf.mjs',
  'tools/validate-simulator-cart.mjs',
  'tools/validate-simulator-result-decision.mjs',
  'tools/validate-docs-modernization.mjs',
  'tools/validate-handoff-consultant-operations.mjs',
  'tools/validate-auth-navigation.mjs',
  'tools/validate-navigable-journey.mjs',
  'tools/validate-online-journey-smoke.mjs',
  'tools/validate-github-pages-deploy.mjs'
].forEach((validator) => assert(contracts.includes(validator), `Validador nao documentado: ${validator}.`));

[
  'data-admin-next-actions',
  'data-admin-action-queue',
  'data-admin-action-execution',
  'data-admin-consultant-productivity',
  'data-admin-source-funnel',
  'data-admin-bottleneck-board',
  'data-admin-backend-events',
  'data-admin-backend-snapshots',
  'data-admin-backend-snapshot',
  'data-admin-backend-entities',
  'data-admin-backend-entity',
  'data-admin-backend-materialized',
  'data-admin-backend-materialized-item',
  'data-admin-backend-materialized-control',
  'data-admin-backend-materialized-field',
  'data-admin-backend-materialized-save',
  'data-admin-dedicated-queue',
  'data-admin-dedicated-queue-filters',
  'data-admin-dedicated-queue-filter',
  'data-admin-dedicated-queue-summary',
  'data-admin-dedicated-queue-item',
  'data-admin-dedicated-queue-clear',
  'data-admin-backend-table',
  'data-admin-backend-database-provider',
  'data-admin-backend-event-refresh',
  'data-admin-local-import-panel',
  'data-admin-local-import-preview',
  'data-admin-local-import-run',
  'data-admin-local-import-result',
  'data-admin-local-snapshot-count'
].forEach((marker) => {
  assert(adminUsers.includes(marker) || adminDashboard.includes(marker), `Dashboard Admin sem marcador publico ${marker}.`);
});

assert(adminDashboard.includes('href="#admin-proximos-passos"'), 'dashboard-admin.html sem atalho para proximos passos.');
assert(adminDashboard.includes('data-admin-backend-events'), 'dashboard-admin.html sem painel de eventos do banco local.');
assert(adminUsers.includes('data-admin-backend-snapshots'), 'Dashboard Admin sem lista de snapshots server-side.');
assert(adminUsers.includes('data-admin-backend-snapshot'), 'Dashboard Admin sem item de snapshot server-side.');
assert(adminUsers.includes('data-admin-backend-entities'), 'Dashboard Admin sem lista de entidades relacionais server-side.');
assert(adminUsers.includes('data-admin-backend-entity'), 'Dashboard Admin sem item de entidade relacional server-side.');
assert(adminUsers.includes('data-admin-backend-materialized'), 'Dashboard Admin sem lista de tabelas dedicadas server-side.');
assert(adminUsers.includes('data-admin-backend-materialized-item'), 'Dashboard Admin sem item de tabela dedicada server-side.');
assert(adminUsers.includes('data-admin-backend-materialized-control'), 'Dashboard Admin sem controles de tabela dedicada.');
assert(adminUsers.includes('data-admin-backend-materialized-save'), 'Dashboard Admin sem acao PATCH de tabela dedicada.');
assert(adminUsers.includes('data-admin-dedicated-queue'), 'Dashboard Admin sem fila dedicada de registros materializados.');
assert(adminUsers.includes('data-admin-dedicated-queue-filter'), 'Dashboard Admin sem filtros da fila dedicada.');
assert(adminUsers.includes('data-admin-dedicated-queue-item'), 'Dashboard Admin sem itens da fila dedicada.');
assert(adminUsers.includes('rerenderBackendEventsFromCache'), 'Dashboard Admin sem rerender local da fila dedicada.');
assert(adminUsers.includes('handleMaterializedUpdate'), 'Dashboard Admin sem handler de atualizacao dedicada.');
assert(adminUsers.includes('materializedUpdateMethod'), 'Dashboard Admin sem roteamento de updateLead/updateSimulation/updateProposal.');
assert(clientDashboard.includes('data-client-backend-snapshots'), 'Dashboard Cliente sem marcador de origem de snapshots server-side.');
assert(clientDashboard.includes('data-client-backend-entities'), 'Dashboard Cliente sem marcador de origem de entidades relacionais server-side.');
assert(clientDashboard.includes('data-client-backend-materialized'), 'Dashboard Cliente sem marcador de tabelas dedicadas server-side.');
assert(clientDashboard.includes('listSnapshots(100)'), 'Dashboard Cliente sem leitura de snapshots server-side.');
assert(clientDashboard.includes('listJourneyEntities(100)'), 'Dashboard Cliente sem leitura de entidades relacionais server-side.');
assert(clientDashboard.includes('listLeads(30)'), 'Dashboard Cliente sem leitura de leads materializados.');
assert(clientDashboard.includes('listSimulations(30)'), 'Dashboard Cliente sem leitura de simulacoes materializadas.');
assert(clientDashboard.includes('listProposals(30)'), 'Dashboard Cliente sem leitura de propostas materializadas.');
assert(backendApi.includes('listEvents'), 'BFBackendApi sem leitura de eventos server-side.');
assert(backendApi.includes('recordSnapshot'), 'BFBackendApi sem gravacao de snapshots server-side.');
assert(backendApi.includes('listSnapshots'), 'BFBackendApi sem leitura de snapshots server-side.');
assert(backendApi.includes('listJourneyEntities'), 'BFBackendApi sem leitura de entidades relacionais server-side.');
assert(backendApi.includes('listLeads'), 'BFBackendApi sem leitura de leads materializados.');
assert(backendApi.includes('listSimulations'), 'BFBackendApi sem leitura de simulacoes materializadas.');
assert(backendApi.includes('listProposals'), 'BFBackendApi sem leitura de propostas materializadas.');
[
  'saveLead',
  'getLead',
  'updateLead',
  'saveSimulation',
  'getSimulation',
  'updateSimulation',
  'saveProposal',
  'getProposal',
  'updateProposal'
].forEach((method) => assert(backendApi.includes(method), `BFBackendApi sem escrita direta de jornada: ${method}.`));
[
  [storageJs, 'simulation'],
  [proposalVersioning, 'proposal-version'],
  [proposalAcceptance, 'proposal-acceptance'],
  [proposalBuilder, 'proposal-builder'],
  [decisionContext, 'financial-profile'],
  [decisionJourney, 'decision-journey'],
  [handoffService, 'handoff']
].forEach(([text, marker]) => {
  assert(text.includes('recordSnapshot') && text.includes(marker), `Hook server-side de snapshot ausente para ${marker}.`);
});
[
  [storageJs, 'api.saveSimulation', 'Storage sem escrita direta de simulacao server-side.'],
  [proposalVersioning, 'api.saveProposal', 'Versionamento sem escrita direta de proposta server-side.'],
  [proposalAcceptance, 'api.saveProposal', 'Aceite sem escrita direta de proposta server-side.'],
  [proposalBuilder, 'api.saveProposal', 'Lousa sem escrita direta de proposta server-side.'],
  [handoffService, 'api.saveLead', 'Handoff sem escrita direta de lead server-side.']
].forEach(([text, marker, message]) => {
  assert(text.includes(marker), message);
});
assert(backendApi.includes('databaseStatus'), 'BFBackendApi sem status tecnico do banco local.');
assert(backendApi.includes('importLocalSnapshot'), 'BFBackendApi sem importacao guiada localStorage -> SQLite.');
assert(server.includes('/api/database/status'), 'server.js sem endpoint de status tecnico do banco.');
assert(server.includes('/api/database/import-local'), 'server.js sem endpoint de importacao localStorage -> SQLite.');
assert(server.includes('/api/snapshots'), 'server.js sem endpoint de snapshots server-side.');
assert(server.includes('/api/journey-entities'), 'server.js sem endpoint de entidades relacionais server-side.');
assert(server.includes('/api/leads'), 'server.js sem endpoint de leads materializados.');
assert(server.includes('/api/simulations'), 'server.js sem endpoint de simulacoes materializadas.');
assert(server.includes('/api/proposals'), 'server.js sem endpoint de propostas materializadas.');
assert(server.includes('upsertDirectJourneyRow'), 'server.js sem escrita direta de tabelas dedicadas.');
assert(server.includes('findMaterializedJourneyRow'), 'server.js sem leitura pontual escopada de tabelas dedicadas.');
assert(apiDocs.includes('/api/database/status'), 'api-docs.html sem endpoint de status tecnico do banco.');
assert(apiDocs.includes('/api/database/import-local'), 'api-docs.html sem endpoint de importacao localStorage -> SQLite.');
assert(apiDocs.includes('/api/snapshots'), 'api-docs.html sem endpoint de snapshots server-side.');
assert(apiDocs.includes('/api/journey-entities'), 'api-docs.html sem endpoint de entidades relacionais server-side.');
assert(apiDocs.includes('/api/leads'), 'api-docs.html sem endpoint de leads materializados.');
assert(apiDocs.includes('/api/simulations'), 'api-docs.html sem endpoint de simulacoes materializadas.');
assert(apiDocs.includes('/api/proposals'), 'api-docs.html sem endpoint de propostas materializadas.');
[
  'POST /api/leads',
  'PATCH /api/leads/:id',
  'POST /api/simulations',
  'PATCH /api/simulations/:id',
  'POST /api/proposals',
  'PATCH /api/proposals/:id'
].forEach((endpoint) => {
  assert(contracts.includes(endpoint), `Contratos publicos sem endpoint direto ${endpoint}.`);
  assert(apiDocs.includes(endpoint), `api-docs.html sem endpoint direto ${endpoint}.`);
});
assert(simulator.includes('data-proposal-builder-board'), 'simulador.html sem lousa de proposta documentada.');
assert(simulator.includes('data-proposal-version-panel'), 'simulador.html sem painel de versionamento da proposta.');
assert(simulator.includes('js/proposal-builder.js'), 'simulador.html sem modulo proposal-builder.');
assert(simulator.includes('js/proposal-governance.js'), 'simulador.html sem modulo proposal-governance.');
assert(simulator.includes('js/simulator-journey.js'), 'simulador.html sem modulo simulator-journey.');
assert(simulator.includes('js/simulator-state.js'), 'simulador.html sem modulo simulator-state.');
assert(simulator.includes('js/simulator-shelf.js'), 'simulador.html sem modulo simulator-shelf.');
assert(simulator.includes('js/simulator-cart.js'), 'simulador.html sem modulo simulator-cart.');
assert(simulator.includes('js/simulator-result.js'), 'simulador.html sem modulo simulator-result.');
assert(app.includes('data-simulator-journey-actions'), 'app.js sem acoes de jornada do simulador.');
assert(simulator.includes('data-simulator-objective-guide'), 'simulador.html sem guia de objetivo do simulador.');
assert(app.includes('data-simulator-objective-card'), 'app.js sem card de objetivo do simulador.');
assert(app.includes('data-simulator-objective-apply'), 'app.js sem acao de aplicar objetivo do simulador.');
assert(app.includes('BFSimulatorShelf'), 'app.js nao delega filtros/prateleira para BFSimulatorShelf.');
assert(app.includes('BFSimulatorCart'), 'app.js nao delega carrinho/projeto para BFSimulatorCart.');
assert(app.includes('BFSimulatorResult'), 'app.js nao delega resultado para BFSimulatorResult.');
assert(app.includes('BFProposalBuilder'), 'app.js nao delega lousa de proposta para BFProposalBuilder.');
assert(app.includes('BFProposalGovernance'), 'app.js nao delega governanca de proposta para BFProposalGovernance.');
assert(simulatorShelf.includes('BFSimulatorShelf'), 'simulator-shelf.js sem export global da prateleira.');
assert(simulatorShelf.includes('filterAndSortGroups'), 'simulator-shelf.js sem busca publica de prateleira.');
assert(simulatorShelf.includes('renderDetail'), 'simulator-shelf.js sem render publico do detalhe da prateleira.');
assert(simulatorShelf.includes('data-shelf-recommendation'), 'simulator-shelf.js sem recomendacao explicavel por grupo.');
assert(simulatorShelf.includes('explainGroupRecommendation'), 'simulator-shelf.js sem regra publica de explicacao de grupo.');
assert(simulatorCart.includes('BFSimulatorCart'), 'simulator-cart.js sem export global do carrinho.');
assert(simulatorCart.includes('renderStep5CartHtml'), 'simulator-cart.js sem render publico do carrinho do passo 5.');
assert(simulatorCart.includes('normalizeEditValue'), 'simulator-cart.js sem normalizacao publica de edicao.');
assert(simulatorResult.includes('BFSimulatorResult'), 'simulator-result.js sem export global do resultado.');
assert(simulatorResult.includes('renderAnalyticalTable'), 'simulator-result.js sem render publico da tabela analitica.');
assert(simulatorResult.includes('renderProposal'), 'simulator-result.js sem render publico da proposta.');
assert(simulatorResult.includes('calculate'), 'simulator-result.js sem orquestracao publica de calculo.');
assert(proposalBuilder.includes('bank_fratern_proposal_builder_v1'), 'proposal-builder.js sem chave da lousa de proposta.');
assert(proposalBuilder.includes('BFProposalBuilder'), 'proposal-builder.js sem export global da lousa de proposta.');
assert(proposalBuilder.includes("key: 'decision'"), 'proposal-builder.js sem opcao de decisao final na lousa.');
assert(proposalGovernance.includes('BFProposalGovernance'), 'proposal-governance.js sem export global da governanca de proposta.');
assert(proposalGovernance.includes('data-proposal-version-comparison'), 'proposal-governance.js sem comparacao de versoes.');
assert(proposalGovernance.includes('data-proposal-handoff-bridge'), 'proposal-governance.js sem ponte de handoff.');
assert(app.includes('salvarVersaoProposta'), 'app.js sem acao publica de salvar versao da proposta.');
assert(proposalSummary.includes('proposalBuilderDefaults'), 'proposal-summary.js sem defaults publicos da lousa.');
assert(proposalSummary.includes('data-simulator-result-decision'), 'proposal-summary.js sem decisao final do resultado.');
assert(proposalSummary.includes('buildResultDecision'), 'proposal-summary.js sem contrato buildResultDecision.');
assert(contracts.includes('data-handoff-assignee-filter'), 'Contrato publico nao documenta filtro de responsavel do handoff.');
assert(contracts.includes('data-handoff-aging-filter'), 'Contrato publico nao documenta filtro de aging do handoff.');
assert(contracts.includes('data-client-continuity-cockpit'), 'Contrato publico nao documenta cockpit de continuidade do cliente.');
assert(contracts.includes('data-client-commercial-stage'), 'Contrato publico nao documenta etapa comercial no dashboard cliente.');
assert(contracts.includes('data-demo-login'), 'Contrato publico nao documenta acesso rapido do login.');
assert(contracts.includes('.bf-demo-chip'), 'Contrato publico nao documenta selo demo do shell.');
assert(contracts.includes('data-public-demo-notice'), 'Contrato publico nao documenta aviso publico de demo.');
assert(contracts.includes('data-calculator-result-mode'), 'Contrato publico nao documenta modo do resultado das calculadoras.');
assert(contracts.includes('data-calculator-form-alert'), 'Contrato publico nao documenta alerta de validacao das calculadoras.');
assert(contracts.includes('data-calculator-coherence'), 'Contrato publico nao documenta status de coerencia das calculadoras.');
assert(contracts.includes('data-calculator-coherence-alert'), 'Contrato publico nao documenta alerta de coerencia das calculadoras.');
assert(contracts.includes('data-calculator-field-origin'), 'Contrato publico nao documenta origem default/profile dos campos das calculadoras.');
assert(contracts.includes('data-calculator-field-source'), 'Contrato publico nao documenta selo de origem dos campos das calculadoras.');
assert(contracts.includes('data-calculator-field-source-key'), 'Contrato publico nao documenta chave de origem dos campos das calculadoras.');
assert(contracts.includes('data-calculator-saved-comparison'), 'Contrato publico nao documenta comparacao com ultimo salvo das calculadoras.');
assert(contracts.includes('data-calculator-saved-comparison-item'), 'Contrato publico nao documenta itens de comparacao com ultimo salvo.');
assert(contracts.includes('data-calculator-next-action'), 'Contrato publico nao documenta proxima acao dinamica das calculadoras.');
assert(contracts.includes('data-calculator-next-action-card'), 'Contrato publico nao documenta card de proxima acao das calculadoras.');
assert(contracts.includes('data-calculator-profile-continuity'), 'Contrato publico nao documenta continuidade por perfil nas calculadoras.');
assert(contracts.includes('data-calculators-profile-continuity'), 'Contrato publico nao documenta continuidade por perfil no hub de calculadoras.');
assert(contracts.includes('data-calculator-field-error'), 'Contrato publico nao documenta erro por campo das calculadoras.');
assert(calculatorsPage.includes('buildCalculatorProfileContinuity'), 'calculadoras-page.js sem regra de continuidade por perfil.');
assert(calculatorsPage.includes('FIELD_PROFILE_SOURCES'), 'calculadoras-page.js sem mapa de origem de campos reaproveitados.');
assert(calculatorsPage.includes('fieldSource: profileSourceForField'), 'BFCalculatorJourney sem fieldSource publico.');
assert(calculatorsPage.includes('buildSavedComparison'), 'calculadoras-page.js sem comparacao entre previa e ultimo salvo.');
assert(calculatorsPage.includes('savedComparison: buildSavedComparison'), 'BFCalculatorJourney sem savedComparison publico.');
assert(calculatorsPage.includes('profile-preview-not-saved'), 'calculadoras-page.js sem estado de previa sem salvar para continuidade.');
assert(calculatorsPage.includes('profile-ready-bid'), 'calculadoras-page.js sem estado de lance pronto para continuidade.');
assert(await exists('404.html'), 'Fallback 404.html ausente.');
assert(await exists('.github/workflows/validate.yml'), 'Workflow de validacao publica ausente.');

assert(map.includes('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'), 'Mapa completo nao referencia contratos publicos.');
assert(plan.includes('CONTRATOS_PUBLICOS_BANK_FRATERN.md'), 'Plano de acao nao referencia contratos publicos.');
assert(protocol.includes('validate-public-contracts.mjs'), 'Protocolo de testes nao referencia validate-public-contracts.');
assert(apiDocs.includes('id="contratos-publicos"'), 'api-docs.html sem secao de contratos publicos.');
assert(apiDocs.includes('Lista as 19 calculadoras'), 'api-docs.html ainda nao reflete catalogo atual de 19 calculadoras.');
assert(designValidator.includes('tools/validate-public-contracts.mjs'), 'validate-design-system nao exige validate-public-contracts.');
assert(designValidator.includes('tools/validate-backend-production-plan.mjs'), 'validate-design-system nao exige validate-backend-production-plan.');
assert(designValidator.includes('tools/validate-docs-modernization.mjs'), 'validate-design-system nao exige validate-docs-modernization.');
assert(designValidator.includes('tools/validate-navigable-journey.mjs'), 'validate-design-system nao exige validate-navigable-journey.');
assert(designValidator.includes('tools/validate-github-pages-deploy.mjs'), 'validate-design-system nao exige validate-github-pages-deploy.');
assert(lousa.includes('data-lousa-journey-checklist'), 'lousa-navegacao.html sem checklist de jornada navegavel.');
assert(lousa.includes('data-lousa-journey-acceptance'), 'lousa-navegacao.html sem criterios de aceite da jornada navegavel.');
assert(lousa.includes('data-lousa-commercial-qa'), 'lousa-navegacao.html sem QA comercial navegavel.');
assert(lousa.includes('data-lousa-qa-checkpoint'), 'lousa-navegacao.html sem checkpoints de QA comercial.');

const calculators = JSON.parse(calculatorsJson);
const calculatorCount = Array.isArray(calculators) ? calculators.length : 0;
assert(calculatorCount === 19, `Catalogo de calculadoras deveria ter 19 itens; encontrou ${calculatorCount}.`);
assert(contracts.includes('19 calculadoras'), 'Contrato publico nao explicita catalogo atual de 19 calculadoras.');
assert(contracts.includes('## Backend Produtivo Futuro'), 'Contrato publico nao documenta backend produtivo futuro.');
assert(contracts.includes('docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md'), 'Contrato publico nao referencia plano backend produtivo.');
assert(contracts.includes('tools/validate-backend-production-plan.mjs'), 'Contrato publico nao referencia validador de backend produtivo.');
assert(backendProductionPlan.includes('localStorage continua sendo fallback publico'), 'Plano backend produtivo nao preserva fallback localStorage.');
assert(backendProductionPlan.includes('BFBackendApi'), 'Plano backend produtivo nao preserva BFBackendApi.');
assert(backendProductionPlan.includes('BANCUS_DB_PROVIDER'), 'Plano backend produtivo nao define provider futuro.');
assert(backendProductionPlan.includes('LGPD') && backendProductionPlan.includes('backup') && backendProductionPlan.includes('observabilidade'), 'Plano backend produtivo sem governanca operacional.');

const docs = await fs.readdir(path.join(root, 'docs'));
const legacyHits = [];
const governanceDocs = new Set([
  'CHANGELOG.md',
  'CODEX_TEST_PROTOCOL.md',
  'CONTRATOS_PUBLICOS_BANK_FRATERN.md',
  'MAPA_COMPLETO_PROJETO_BANK_FRATERN.md',
  'PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md',
  'README.md'
]);
for (const name of docs.filter((item) => item.endsWith('.md'))) {
  if (governanceDocs.has(name)) continue;
  const text = await read(`docs/${name}`);
  const hasLegacyLanguage = /17 calculadoras|Cons.{0,3}rcioPro/i.test(text);
  const isControlledLegacy = /Status 2026-05-08:\s*documento historico|legado controlado|nome legado/i.test(text);
  if (hasLegacyLanguage && !isControlledLegacy) legacyHits.push(name);
}
if (legacyHits.length) {
  warn(`Docs historicos ainda possuem linguagem legada para revisao futura: ${Array.from(new Set(legacyHits)).slice(0, 8).join(', ')}.`);
}

const report = {
  ok: failures.length === 0,
  contracts: {
    localStorageKeys: 18,
    dataMarkers: 95,
    globals: 20,
    deepLinks: 10,
    validators: 23,
    calculatorCount
  },
  warnings,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/public-contracts-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
