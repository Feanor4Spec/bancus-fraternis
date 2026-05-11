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
  protocol,
  apiDocs,
  designValidator,
  lousa,
  adminDashboard,
  adminUsers,
  simulator,
  app,
  proposalSummary,
  calculatorsJson
] = await Promise.all([
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/CODEX_TEST_PROTOCOL.md'),
  read('pages/api-docs.html'),
  read('tools/validate-design-system.mjs'),
  read('pages/lousa-navegacao.html'),
  read('pages/dashboard-admin.html'),
  read('assets/js/admin-users.js'),
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/proposal-summary.js'),
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
  'data-admin-source-funnel',
  'data-admin-bottleneck-board',
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
  'data-client-next-action',
  'data-client-handoff-status',
  'data-client-proposal-status',
  'data-client-simulation-context',
  'data-client-commercial-stage',
  'data-client-continuity-timeline',
  'data-products-selection-panel',
  'data-decision-journey-form',
  'data-v8-stagebar',
  'data-lousa-journey-checklist',
  'data-lousa-journey-acceptance'
].forEach((marker) => assert(contracts.includes(marker), `Marcador data-* nao documentado: ${marker}.`));

[
  'BFAuth',
  'BFDecisionContext',
  'BFCalculadoras',
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
  'tools/validate-design-system.mjs',
  'tools/validate-calculadoras.mjs',
  'tools/validate-admin-dashboard-source-funnel.mjs',
  'tools/validate-proposal-builder.mjs',
  'tools/validate-proposal-versioning.mjs',
  'tools/validate-simulator-groups.mjs',
  'tools/validate-simulator-performance.mjs',
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
  'data-admin-bottleneck-board'
].forEach((marker) => assert(adminUsers.includes(marker), `admin-users.js sem marcador publico ${marker}.`));

assert(adminDashboard.includes('href="#admin-proximos-passos"'), 'dashboard-admin.html sem atalho para proximos passos.');
assert(simulator.includes('data-proposal-builder-board'), 'simulador.html sem lousa de proposta documentada.');
assert(simulator.includes('data-proposal-version-panel'), 'simulador.html sem painel de versionamento da proposta.');
assert(app.includes('bank_fratern_proposal_builder_v1'), 'app.js sem chave da lousa de proposta.');
assert(app.includes('salvarVersaoProposta'), 'app.js sem acao publica de salvar versao da proposta.');
assert(proposalSummary.includes('proposalBuilderDefaults'), 'proposal-summary.js sem defaults publicos da lousa.');
assert(contracts.includes('data-handoff-assignee-filter'), 'Contrato publico nao documenta filtro de responsavel do handoff.');
assert(contracts.includes('data-handoff-aging-filter'), 'Contrato publico nao documenta filtro de aging do handoff.');
assert(contracts.includes('data-client-continuity-cockpit'), 'Contrato publico nao documenta cockpit de continuidade do cliente.');
assert(contracts.includes('data-client-commercial-stage'), 'Contrato publico nao documenta etapa comercial no dashboard cliente.');
assert(contracts.includes('data-demo-login'), 'Contrato publico nao documenta acesso rapido do login.');
assert(contracts.includes('.bf-demo-chip'), 'Contrato publico nao documenta selo demo do shell.');
assert(contracts.includes('data-public-demo-notice'), 'Contrato publico nao documenta aviso publico de demo.');
assert(await exists('404.html'), 'Fallback 404.html ausente.');
assert(await exists('.github/workflows/validate.yml'), 'Workflow de validacao publica ausente.');

assert(map.includes('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'), 'Mapa completo nao referencia contratos publicos.');
assert(plan.includes('CONTRATOS_PUBLICOS_BANK_FRATERN.md'), 'Plano de acao nao referencia contratos publicos.');
assert(protocol.includes('validate-public-contracts.mjs'), 'Protocolo de testes nao referencia validate-public-contracts.');
assert(apiDocs.includes('id="contratos-publicos"'), 'api-docs.html sem secao de contratos publicos.');
assert(apiDocs.includes('Lista as 19 calculadoras'), 'api-docs.html ainda nao reflete catalogo atual de 19 calculadoras.');
assert(designValidator.includes('tools/validate-public-contracts.mjs'), 'validate-design-system nao exige validate-public-contracts.');
assert(designValidator.includes('tools/validate-docs-modernization.mjs'), 'validate-design-system nao exige validate-docs-modernization.');
assert(designValidator.includes('tools/validate-navigable-journey.mjs'), 'validate-design-system nao exige validate-navigable-journey.');
assert(designValidator.includes('tools/validate-github-pages-deploy.mjs'), 'validate-design-system nao exige validate-github-pages-deploy.');
assert(lousa.includes('data-lousa-journey-checklist'), 'lousa-navegacao.html sem checklist de jornada navegavel.');
assert(lousa.includes('data-lousa-journey-acceptance'), 'lousa-navegacao.html sem criterios de aceite da jornada navegavel.');

const calculators = JSON.parse(calculatorsJson);
const calculatorCount = Array.isArray(calculators) ? calculators.length : 0;
assert(calculatorCount === 19, `Catalogo de calculadoras deveria ter 19 itens; encontrou ${calculatorCount}.`);
assert(contracts.includes('19 calculadoras'), 'Contrato publico nao explicita catalogo atual de 19 calculadoras.');

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
    localStorageKeys: 17,
    dataMarkers: 52,
    globals: 12,
    deepLinks: 10,
    validators: 15,
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
