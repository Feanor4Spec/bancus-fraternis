import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const checks = [];
const failures = [];

function check(id, condition, evidence) {
  const ok = Boolean(condition);
  checks.push({ id, ok, evidence });
  if (!ok) failures.push(id);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function extractRoleBlock(source, role) {
  const match = source.match(new RegExp(`${role}:\\s*\\[([\\s\\S]*?)\\n\\s*\\]`));
  return match ? match[1] : '';
}

function extractFunction(source, name) {
  const signature = new RegExp(`(?:async\\s+)?function\\s+${name}\\s*\\(`);
  const match = signature.exec(source);
  if (!match) return '';

  const parametersOpen = source.indexOf('(', match.index);
  let parametersDepth = 0;
  let parametersQuote = '';
  let parametersEscaped = false;
  let parametersClose = -1;
  for (let index = parametersOpen; index < source.length; index += 1) {
    const char = source[index];
    if (parametersQuote) {
      if (parametersEscaped) parametersEscaped = false;
      else if (char === '\\') parametersEscaped = true;
      else if (char === parametersQuote) parametersQuote = '';
      continue;
    }
    if (char === "'" || char === '"' || char === '`') {
      parametersQuote = char;
      continue;
    }
    if (char === '(') parametersDepth += 1;
    if (char === ')') {
      parametersDepth -= 1;
      if (parametersDepth === 0) {
        parametersClose = index;
        break;
      }
    }
  }

  const open = parametersClose >= 0 ? source.indexOf('{', parametersClose + 1) : -1;
  if (open < 0) return '';

  let depth = 0;
  let quote = '';
  let escaped = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (lineComment) {
      if (char === '\n') lineComment = false;
      continue;
    }
    if (blockComment) {
      if (char === '*' && next === '/') {
        blockComment = false;
        index += 1;
      }
      continue;
    }
    if (quote) {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === quote) {
        quote = '';
      }
      continue;
    }
    if (char === '/' && next === '/') {
      lineComment = true;
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      blockComment = true;
      index += 1;
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

function findNamedFunction(source, namePattern) {
  const names = [...source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((match) => match[1])
    .filter((name) => namePattern.test(name));
  for (const name of names) {
    const body = extractFunction(source, name);
    if (body) return { name, body };
  }
  return { name: '', body: '' };
}

function findFunctionContaining(source, requiredFragments) {
  const names = [...source.matchAll(/(?:async\s+)?function\s+([A-Za-z_$][\w$]*)\s*\(/g)]
    .map((match) => match[1]);
  for (const name of names) {
    const body = extractFunction(source, name);
    if (body && requiredFragments.every((fragment) => body.includes(fragment))) return { name, body };
  }
  return { name: '', body: '' };
}

function renderedTextFragments(source) {
  const tagText = [...source.matchAll(/>([^<>]+)</g)].map((match) => match[1]);
  const copyProperties = [...source.matchAll(/\b(?:eyebrow|title|detail|cta|label|body|text|action)\s*:\s*(['"`])([\s\S]*?)\1/g)]
    .map((match) => match[2]);
  return [...tagText, ...copyProperties]
    .map((text) => text.replace(/\$\{[^}]+\}/g, ' ').replace(/\s+/g, ' ').trim())
    .filter(Boolean)
    .join('\n');
}

const [layout, dashboardHtml, dashboardJs, platformCss] = await Promise.all([
  read('js/shared-layout.js'),
  read('pages/dashboard-cliente.html'),
  read('assets/js/client-dashboard.js'),
  read('assets/css/platform.css')
]);

const visibleDashboardHtml = dashboardHtml.split('<div hidden aria-hidden="true" data-client-commercial-internals>')[0];
const clientRoleBlock = extractRoleBlock(layout, 'cliente');
const nextClientAction = extractFunction(dashboardJs, 'nextClientAction');
const proposalState = extractFunction(dashboardJs, 'proposalDashboardState');
const renderCockpit = extractFunction(dashboardJs, 'renderContinuityCockpit');
const renderActivity = extractFunction(dashboardJs, 'renderClientActivity');

const proposalPriorityIndex = [
  nextClientAction.indexOf('proposalDashboardState'),
  nextClientAction.search(/proposal(?:State)?\.(?:active|current|valid)/),
  nextClientAction.indexOf('proposal-interest'),
  nextClientAction.search(/has(?:Current|Valid|Active)?Proposal/)
].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? -1;
const competingPriorityIndex = [
  nextClientAction.indexOf('snapshot.journey'),
  nextClientAction.indexOf('calculatorImpactSummary'),
  nextClientAction.indexOf('topSignal')
].filter((index) => index >= 0).sort((a, b) => a - b)[0] ?? Number.POSITIVE_INFINITY;

check(
  'post-proposal.next-action-priority',
  Boolean(nextClientAction)
    && proposalPriorityIndex >= 0
    && proposalPriorityIndex < competingPriorityIndex
    && /(?:conferir|ver|abrir|baixar|acompanhar|atualizar)[^\n]{0,80}proposta|proposta[^\n]{0,80}(?:conferir|ver|abrir|baixar|acompanhar|atualizar)/i.test(nextClientAction),
  {
    functionFound: Boolean(nextClientAction),
    proposalPriorityIndex,
    competingPriorityIndex
  }
);

const civilDateFormatter = findNamedFunction(
  dashboardJs,
  /(?:civil.*date|date.*civil|dateonly|date.*only|local.*date|date.*local|calendar.*date|date.*calendar)/i
);
const civilDateUsesParts = /split\(\s*['"]-['"]\s*\)|\\d\{4\}.*\\d\{2\}.*\\d\{2\}|civilDate/.test(civilDateFormatter.body);
const civilDateHasNoClock = !/hour\s*:|minute\s*:|second\s*:|toLocaleTimeString/i.test(civilDateFormatter.body);
const validityUsesCivilDate = civilDateFormatter.name
  ? new RegExp(`${civilDateFormatter.name}\\s*\\(\\s*(?:proposal\\.)?validUntil`).test(dashboardJs)
  : false;

check(
  'post-proposal.civil-date',
  Boolean(civilDateFormatter.body) && civilDateUsesParts && civilDateHasNoClock && validityUsesCivilDate,
  {
    formatter: civilDateFormatter.name || null,
    parsesDateParts: civilDateUsesParts,
    omitsClock: civilDateHasNoClock,
    usedForValidUntil: validityUsesCivilDate
  }
);

const proposalGrouping = findNamedFunction(
  dashboardJs,
  /(?:group|merge|dedupe|consolidat).*(?:proposal)|(?:proposal).*(?:group|merge|dedupe|consolidat|activit|histor|item)/i
);
const groupingSource = `${proposalGrouping.body}\n${renderActivity}`;
const groupsByProposalId = /proposalId/.test(groupingSource)
  && /new\s+Map\s*\(|\.reduce\s*\(|\b(?:group|dedupe|consolidat|latestByProposalId)\b/i.test(groupingSource);
const hasParallelProposalLoops = /proposalVersions\.forEach/.test(renderActivity)
  && /proposalAcceptances\.forEach/.test(renderActivity);

check(
  'post-proposal.history-grouped',
  groupsByProposalId && !hasParallelProposalLoops,
  {
    helper: proposalGrouping.name || null,
    groupsByProposalId,
    parallelVersionAndAcceptanceLoops: hasParallelProposalLoops
  }
);

const heroMarkerMatch = visibleDashboardHtml.match(/data-client-[\w-]*hero(?:-[\w-]+)?/i);
const namedHeroSource = findNamedFunction(dashboardJs, /(?:render|update|sync).*(?:hero)|(?:hero).*(?:state|copy)/i);
const heroSource = namedHeroSource.body
  ? namedHeroSource
  : findFunctionContaining(dashboardJs, ['data-client-dashboard-hero', 'proposalDashboardState']);
const heroHasProposalBranch = /proposal(?:DashboardState|State|\.active|\.valid|Id)|has(?:Current|Valid|Active)?Proposal/i.test(heroSource.body);
const heroHasCommercialCopy = /(?:Confira sua proposta|proposta está pronta|pedido está em acompanhamento|acompanhe sua proposta|baixe sua proposta)/i.test(heroSource.body);

check(
  'post-proposal.dynamic-hero',
  Boolean(heroMarkerMatch) && Boolean(heroSource.body) && heroHasProposalBranch && heroHasCommercialCopy,
  {
    marker: heroMarkerMatch ? heroMarkerMatch[0] : null,
    helper: heroSource.name || null,
    proposalBranch: heroHasProposalBranch,
    commercialCopy: heroHasCommercialCopy
  }
);

const hasHeroRail = /bf-platform-hero__rail/.test(visibleDashboardHtml);
const hasStageBar = /bf-v8-stagebar/.test(visibleDashboardHtml);
check(
  'post-proposal.no-duplicate-action-bar',
  !(hasHeroRail && hasStageBar),
  { hasHeroRail, hasStageBar }
);

const hasMobileNavControl = /data-mobile-nav-toggle/.test(layout)
  && /aria-controls="bf-primary-navigation"/.test(layout)
  && /data-mobile-nav/.test(layout);
const mobileNavUpdatesState = /aria-expanded/.test(layout)
  && /classList\.toggle\(\s*['"]is-open['"]/.test(layout)
  && /event\.key\s*!==\s*['"]Escape['"]/.test(layout);
const mobileNavHasVisibleState = /\.bf-platform-body\s+\.nav\.is-open\s*\{[^}]*display:\s*grid/s.test(platformCss);
check(
  'post-proposal.mobile-navigation',
  hasMobileNavControl && mobileNavUpdatesState && mobileNavHasVisibleState,
  { hasMobileNavControl, mobileNavUpdatesState, mobileNavHasVisibleState }
);

const hasNarrowPanelRule = /calc\(100vw\s*-\s*96px\)/.test(platformCss);
const responsivePanelsUseFullWidth = /\.bf-platform-hero__rail,[\s\S]{0,180}\.bf-platform-panel\s*\{[^}]*width:\s*100%;[^}]*max-width:\s*100%/s.test(platformCss);
check(
  'post-proposal.mobile-panel-width',
  !hasNarrowPanelRule && responsivePanelsUseFullWidth,
  { legacyNarrowRule: hasNarrowPanelRule, responsivePanelsUseFullWidth }
);

const namedVisibilityHelper = findNamedFunction(dashboardJs, /(?:post.*proposal.*visibility|proposal.*visibility|sync.*proposal.*surface|apply.*proposal.*mode|render.*proposal.*hub)/i);
const visibilityHelper = namedVisibilityHelper.body
  ? namedVisibilityHelper
  : findFunctionContaining(dashboardJs, ['data-dashboard-stats', 'data-client-financial-profile']);
const visibilitySource = visibilityHelper.body || dashboardJs;
const hasProposalMarker = /data-client-(?:has-proposal|post-proposal)|clientPostProposal/.test(`${dashboardHtml}\n${dashboardJs}`);
const statsHidden = /data-dashboard-stats/.test(visibilitySource)
  && /(?:\.hidden\s*=|toggleAttribute\(\s*['"]hidden|classList\.toggle)/.test(visibilitySource);
const planningHidden = /data-client-financial-profile/.test(visibilitySource)
  && /(?:\.hidden\s*=|toggleAttribute\(\s*['"]hidden|classList\.toggle)/.test(visibilitySource);
const visibilityUsesProposalState = /proposal(?:DashboardState|State|\.active|\.valid|Id)|has(?:Current|Valid|Active)?Proposal/i.test(visibilitySource);

check(
  'post-proposal.secondary-sections-hidden',
  hasProposalMarker && statsHidden && planningHidden && visibilityUsesProposalState,
  {
    helper: visibilityHelper.name || null,
    hasProposalMarker,
    statsHidden,
    planningHidden,
    usesProposalState: visibilityUsesProposalState
  }
);

const consultativeServiceHref = extractFunction(dashboardJs, 'consultativeServiceHref');
const allHandoffRouteMatches = dashboardJs.match(/handoff-consultivo\.html/g) || [];
const helperHandoffRouteMatches = consultativeServiceHref.match(/handoff-consultivo\.html/g) || [];
const clientFacingDirectRouteMatches = `${clientRoleBlock}\n${visibleDashboardHtml}\n${nextClientAction}\n${renderCockpit}\n${renderActivity}`
  .match(/handoff-consultivo\.html/g) || [];
const helperGuardsClient = /currentUserRole\(\)\s*===\s*['"]cliente['"]/.test(consultativeServiceHref)
  && /dashboard-cliente\.html/.test(consultativeServiceHref);
check(
  'post-proposal.no-client-handoff-route',
  clientFacingDirectRouteMatches.length === 0
    && (allHandoffRouteMatches.length === 0
      || (helperGuardsClient && allHandoffRouteMatches.length === helperHandoffRouteMatches.length)),
  {
    totalOccurrences: allHandoffRouteMatches.length,
    directClientOccurrences: clientFacingDirectRouteMatches.length,
    roleGatedHelper: helperGuardsClient
  }
);

const customerCopySource = [
  visibleDashboardHtml.replace(/<[^>]+>/g, ' '),
  renderedTextFragments(proposalState),
  renderedTextFragments(nextClientAction),
  renderedTextFragments(renderCockpit),
  renderedTextFragments(renderActivity),
  renderedTextFragments(heroSource.body)
].join('\n');
const internalLanguagePatterns = [
  /\blocalStorage\b/i,
  /\bbackend\b/i,
  /server-side/i,
  /\bsnapshot(?:s)?\b/i,
  /\bpipeline\b/i,
  /\bpayload\b/i,
  /\bboot\b/i,
  /API Docs/i,
  /design v\d+/i,
  /teste de fluxo/i,
  /sem backend novo/i,
  /base demonstrativa/i,
  /evolu[cç][aã]o futura/i,
  /compartilhar com o cliente/i
];
const internalLanguageHits = internalLanguagePatterns
  .filter((pattern) => pattern.test(customerCopySource))
  .map((pattern) => pattern.source);
const selectedCommercialFunctions = `${proposalState}\n${nextClientAction}\n${renderCockpit}\n${renderActivity}\n${heroSource.body}`;
const explicitHandoffCopy = />\s*Handoff\s*</i.test(selectedCommercialFunctions)
  || /\b(?:eyebrow|title|detail|cta|label|body|text|action)\s*:\s*['"`][^'"`]*\bhandoff\b/i.test(selectedCommercialFunctions);
if (explicitHandoffCopy) internalLanguageHits.push('visible handoff copy');
const commercialSignals = ['proposta', 'simulação', 'atendimento']
  .filter((term) => customerCopySource.toLocaleLowerCase('pt-BR').includes(term));

check(
  'post-proposal.commercial-language',
  internalLanguageHits.length === 0 && commercialSignals.length >= 2,
  { internalLanguageHits, commercialSignals }
);

const report = {
  ok: failures.length === 0,
  version: 'client-post-proposal-hub-v2',
  checks,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/client-post-proposal-hub-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
);

console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
