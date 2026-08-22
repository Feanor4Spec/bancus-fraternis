import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const reportPath = path.join(root, 'docs/test-reports/simulator-client-flow-report.json');
const checks = [];

function check(id, ok, evidence) {
  checks.push({ id, ok: Boolean(ok), evidence });
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function extractFunction(source, name) {
  const match = new RegExp(`function\\s+${name}\\s*\\(`).exec(source);
  if (!match) return '';
  const parametersOpen = source.indexOf('(', match.index);
  let parametersDepth = 0;
  let parametersClose = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    if (source[index] === '(') parametersDepth += 1;
    if (source[index] === ')') {
      parametersDepth -= 1;
      if (parametersDepth === 0) {
        parametersClose = index;
        break;
      }
    }
  }
  const open = source.indexOf('{', parametersClose + 1);
  let depth = 0;
  let quote = '';
  let escaped = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    if (quote) {
      if (escaped) escaped = false;
      else if (char === '\\') escaped = true;
      else if (char === quote) quote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      quote = char;
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(match.index, index + 1);
    }
  }
  return '';
}

const [html, app, proposalExperience, storage] = await Promise.all([
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/proposal-experience.js'),
  read('js/storage.js')
]);

const initialize = extractFunction(app, 'initializeRoleAwareJourney');
const presentation = extractFunction(app, 'applyClientSimulationPresentation');
const resumeIntent = extractFunction(app, 'hasSimulationResumeIntent');
const recovery = extractFunction(app, 'recoverClientSimulationEntry');
const navigation = extractFunction(app, 'goToStep');
const back = extractFunction(app, 'prevStep');
const validation = extractFunction(app, 'collectStepErrors');
const loadSimulation = extractFunction(app, '_carregarSimulacao');
const hydrateSimulation = extractFunction(app, 'hydrateRequestedSimulationFromBackend');
const localResume = extractFunction(app, 'authorizedLocalResume');
const openSaved = extractFunction(app, 'abrirCarregamento');
const saveSimulation = extractFunction(app, 'salvarSimulacao');
const deleteSaved = extractFunction(app, '_excluirSimulacao');
const activeProposalStep = extractFunction(proposalExperience, 'syncActiveStep');

check(
  'auth.role-is-trusted',
  /BFAuth\?\.getCurrentUser/.test(initialize)
    && /user\?\.role/.test(initialize)
    && !/params\.get\(['"]role['"]\)|search\.get\(['"]role['"]\)/.test(`${initialize}\n${resumeIntent}`),
  { authenticatedUser: /BFAuth\?\.getCurrentUser/.test(initialize), queryRole: /get\(['"]role['"]\)/.test(`${initialize}\n${resumeIntent}`) }
);

check(
  'auth.client-resume-requires-backend-owner-check',
  /requiresBackendAuthorization\s*=\s*hasInterestResume\s*\|\|\s*teamResume\s*\|\|\s*role\s*===\s*['"]cliente['"]/.test(hydrateSimulation)
    && /authorizedBackendResume\(id\)\s*\|\|\s*authorizedLocalResume\(id\)/.test(loadSimulation)
    && /\['consultor', 'admin'\]\.includes\(role\)/.test(localResume)
    && /savedBy\s*===\s*actorEmail/.test(localResume),
  { clientLocalResumeAllowed: false, guestLocalResumeAllowed: false, localResumeActorScoped: true, backendOwnerAuthorizationRequired: true }
);

check(
  'auth.invalid-identifiers-do-not-block-client-entry',
  /\^SIM-\[A-Za-z0-9\._:-\]\+\$\/i\.test\(simulationId\)/.test(resumeIntent)
    && /\^PROP-\[A-Za-z0-9\._:-\]\+\$\/i\.test\(proposalId\)/.test(resumeIntent),
  { invalidSimulationIdStartsFresh: true, invalidProposalIdStartsFresh: true }
);

check(
  'entry.client-starts-at-objective',
  /!hasSimulationResumeIntent\(\)/.test(initialize)
    && /goToStep\(2,/.test(initialize)
    && /skipValidation:\s*true/.test(initialize)
    && /skipFocus:\s*true/.test(initialize),
  { waitsForResumeGuard: /!hasSimulationResumeIntent\(\)/.test(initialize), startsAtStep: 2, avoidsLoadFocusRing: true }
);

check(
  'entry.resume-is-preserved',
  ['simulationId', 'simulacaoId', 'proposalId']
    .every((parameter) => resumeIntent.includes(`params.get('${parameter}')`))
    && !resumeIntent.includes("params.get('proposalVersionId')")
    && !resumeIntent.includes("params.get('proposalView')")
    && !resumeIntent.includes("params.get('interestId')"),
  { resumeIdentifiersCovered: true, presentationParametersCannotCreateBlankResume: true }
);

check(
  'entry.invalid-resume-has-usable-fallback',
  /clientSimulationFlow\s*\|\|\s*currentStep\s*!==\s*1/.test(recovery)
    && /goToStep\(2,/.test(recovery)
    && /nova simulação/.test(recovery)
    && (app.match(/recoverClientSimulationEntry\(\)/g) || []).length >= 3,
  { fallbackStep: 2, feedback: 'warning', guardedCallSites: (app.match(/recoverClientSimulationEntry\(\)/g) || []).length }
);

check(
  'navigation.consultant-step-is-inaccessible-to-client',
  /clientSimulationFlow\s*&&\s*step\s*===\s*1/.test(navigation)
    && /step\s*=\s*2/.test(navigation)
    && /step\s*===\s*1\s*&&\s*clientSimulationFlow/.test(validation),
  { navigationGuard: true, validationGuard: true }
);

check(
  'navigation.back-returns-to-client-dashboard',
  /clientSimulationFlow\s*&&\s*currentStep\s*===\s*2/.test(back)
    && /dashboard-cliente\.html/.test(back),
  { destination: 'dashboard-cliente.html' }
);

check(
  'navigation.client-has-nine-visible-steps',
  /CLIENT_TOTAL_STEPS\s*=\s*9/.test(app)
    && /Etapa \$\{step - 1\} de \$\{CLIENT_TOTAL_STEPS\}/.test(presentation)
    && /data-consultant-only/.test(html),
  { total: 9, consultantMarkers: (html.match(/data-consultant-only/g) || []).length }
);

check(
  'copy.client-is-first-person',
  ['Seu objetivo', 'Seu nome completo', 'Seu CPF', 'Seu e-mail', 'Seu telefone', 'Autorizo o uso destes dados']
    .every((copy) => presentation.includes(copy)),
  { commercialCopy: true }
);

check(
  'copy.client-hides-internal-prefill-language',
  /automaticContextNote/.test(presentation)
    && /notes\.value\s*=\s*''/.test(presentation)
    && /simulator-client-flow/.test(proposalExperience)
    && /title:\s*'Nova simulação'/.test(proposalExperience)
    && /detail:\s*'Defina seu objetivo e compare as opções'/.test(proposalExperience),
  { internalObservationRemovedForNewSimulation: true, commercialHeader: true }
);

check(
  'entry.known-client-data-is-prefilled',
  ['user?.name', 'user?.email', 'user?.phone'].every((field) => presentation.includes(field))
    && /!String\(input\.value/.test(presentation),
  { fields: ['name', 'email', 'phone'], overwriteExistingValues: false }
);

check(
  'proposal.client-readiness-does-not-require-consultant-form',
  /clientJourney\s*=\s*currentUserIsClient\(\)\s*\|\|\s*document\.body\.classList\.contains\('simulator-client-flow'\)/.test(proposalExperience)
    && /consultantReady\s*=\s*clientJourney\s*\|\|\s*Boolean\(valueOf\('consultor'\)\)/.test(proposalExperience)
    && /Seus dados e o plano estão completos/.test(proposalExperience),
  { clientFlowAccepted: true, consultantClaimRemoved: true }
);

check(
  'proposal.client-step-is-always-read-only',
  /step\s*===\s*10/.test(activeProposalStep)
    && /currentUserIsClient\(\)/.test(activeProposalStep)
    && /simulator-client-flow/.test(activeProposalStep)
    && /isDashboardProposalContext\(\)/.test(activeProposalStep)
    && /setClientMode\(true,\s*\{\s*locked:\s*true\s*\}\)/.test(activeProposalStep),
  { directJourneyProtected: true, deepLinkProtected: true }
);

check(
  'proposal.client-step-creates-contactable-version',
  /currentStep\s*===\s*10\s*&&\s*clientSimulationFlow\s*&&\s*!clientProposalReadOnly/.test(navigation)
    && /salvarVersaoProposta\(\{\s*silent:\s*true\s*\}\)/.test(navigation)
    && /_publishDirectSimulation\(entry\)/.test(storage),
  { versionCreatedBeforeProposalRefresh: true, simulationPublishedForAuthenticatedOwner: true }
);

check(
  'ui.client-hides-demo-and-consultant-controls',
  /id="btn-exemplo"[\s\S]{0,80}data-client-hidden/.test(html)
    && /id="btn-salvar"[\s\S]{0,140}data-client-hidden/.test(html)
    && /class="sim-header-menu"\s+data-client-hidden/.test(html)
    && /id="btn-carregar"[\s\S]{0,80}data-client-hidden/.test(html)
    && (html.match(/data-consultant-only/g) || []).length >= 3,
  { hidesExampleAction: true, hidesUnconfirmedLocalSave: true, hidesOverflowMenu: true, hidesSavedSimulationList: true, consultantOnlyMarkers: (html.match(/data-consultant-only/g) || []).length }
);

check(
  'auth.local-list-and-delete-are-role-and-actor-scoped',
  /\['consultor', 'admin'\]\.includes\(role\)/.test(openSaved)
    && /storedSimulationsWithDetails\(\)/.test(openSaved)
    && /authorizedLocalResume\(id\)/.test(deleteSaved)
    && /\['consultor', 'admin'\]\.includes\(role\)/.test(deleteSaved),
  { clientCannotEnumerate: true, guestCannotEnumerate: true, deletionRequiresOwnership: true }
);

check(
  'auth.local-save-is-internal-role-only',
  /\['consultor', 'admin'\]\.includes\(role\)/.test(saveSimulation)
    && /currentUserEmail\(\)/.test(saveSimulation)
    && saveSimulation.indexOf("['consultor', 'admin'].includes(role)") < saveSimulation.indexOf('Storage.saveSimulation'),
  { clientCannotReceiveFalseLocalSaveConfirmation: true, guestCannotCreateOrphanLocalSave: true }
);

check(
  'copy.proposal-uses-simulation-language',
  /Valores simulados/.test(html)
    && /Valor total das cartas/.test(html)
    && !/Valores contratados|Crédito contratado/.test(html)
    && /Mês considerado no cenário/.test(html)
    && /não garante contemplação/.test(html),
  { avoidsPrematureContractClaim: true, scenarioIsNonDeterministic: true }
);

const failures = checks.filter((item) => !item.ok);
const report = {
  schema: 'bancus.validation.simulator-client-flow.v1',
  generatedAt: new Date().toISOString(),
  status: failures.length ? 'FAIL' : 'PASS',
  summary: { total: checks.length, passed: checks.length - failures.length, failed: failures.length },
  checks,
  failures: failures.map((item) => item.id)
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`[simulator-client-flow] ${report.status}: ${report.summary.passed}/${report.summary.total} checks aprovados.`);
console.log(`[simulator-client-flow] Relatório: ${path.relative(root, reportPath).replace(/\\/g, '/')}`);
if (failures.length) process.exitCode = 1;
