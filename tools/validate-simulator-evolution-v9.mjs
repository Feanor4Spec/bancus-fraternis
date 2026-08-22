import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const reportPath = path.join(root, 'docs/test-reports/simulator-evolution-v9-report.json');
const checks = [];

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function addCheck(id, title, ok, evidence = {}) {
  checks.push({
    id,
    title,
    ok: Boolean(ok),
    evidence
  });
}

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    addCheck(
      `source.${relativePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`,
      `Arquivo obrigatorio disponivel: ${relativePath}`,
      false,
      { error: error && error.code ? error.code : String(error) }
    );
    return '';
  }
}

function unique(values) {
  return [...new Set(values)];
}

function orderedExactly(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

function countMatches(source, pattern) {
  return [...String(source || '').matchAll(pattern)].length;
}

function isRegexLiteralStart(source, index) {
  let cursor = index - 1;
  while (cursor >= 0 && /\s/.test(source[cursor])) cursor -= 1;
  if (cursor < 0) return true;
  if (/[[({,:;=!?&|~+\-*%^<>]/.test(source[cursor])) return true;
  const prefix = source.slice(Math.max(0, cursor - 24), cursor + 1);
  return /\b(?:return|case|throw|delete|void|typeof|instanceof|in|of|yield|await)\s*$/.test(prefix);
}

function extractFunctionBody(source, functionName) {
  const functionPattern = new RegExp(`function\\s+${functionName.replace(/[.*+?^${}()|[\\]\\]/g, '\\$&')}\\s*\\(`);
  const match = functionPattern.exec(source);
  if (!match) return '';
  const open = source.indexOf('{', match.index + match[0].length);
  if (open < 0) return '';

  let depth = 0;
  let state = 'code';
  let escaped = false;
  let regexCharClass = false;
  for (let index = open; index < source.length; index += 1) {
    const char = source[index];
    const next = source[index + 1];

    if (state === 'line-comment') {
      if (char === '\n') state = 'code';
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 1;
      }
      continue;
    }
    if (state === 'regex') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if (char === '[') regexCharClass = true;
      else if (char === ']') regexCharClass = false;
      else if (char === '/' && !regexCharClass) state = 'code';
      continue;
    }
    if (state === 'single' || state === 'double' || state === 'template') {
      if (escaped) {
        escaped = false;
        continue;
      }
      if (char === '\\') {
        escaped = true;
        continue;
      }
      if ((state === 'single' && char === "'")
        || (state === 'double' && char === '"')
        || (state === 'template' && char === '`')) {
        state = 'code';
      }
      continue;
    }

    if (char === '/' && next === '/') {
      state = 'line-comment';
      index += 1;
      continue;
    }
    if (char === '/' && next === '*') {
      state = 'block-comment';
      index += 1;
      continue;
    }
    if (char === '/' && isRegexLiteralStart(source, index)) {
      state = 'regex';
      regexCharClass = false;
      continue;
    }
    if (char === "'") {
      state = 'single';
      continue;
    }
    if (char === '"') {
      state = 'double';
      continue;
    }
    if (char === '`') {
      state = 'template';
      continue;
    }
    if (char === '{') depth += 1;
    if (char === '}') {
      depth -= 1;
      if (depth === 0) return source.slice(open + 1, index);
    }
  }
  return '';
}

function localScriptPaths(htmlSource, htmlRelativePath) {
  const htmlPath = path.join(root, htmlRelativePath);
  const scripts = [...htmlSource.matchAll(/<script\b[^>]*\bsrc=["']([^"']+)["'][^>]*>/gi)]
    .map((match) => match[1])
    .filter((src) => !/^(?:https?:)?\/\//i.test(src))
    .map((src) => src.split(/[?#]/, 1)[0])
    .map((src) => path.resolve(path.dirname(htmlPath), src))
    .filter((filePath) => {
      const fromRoot = path.relative(root, filePath);
      return fromRoot && !fromRoot.startsWith('..') && !path.isAbsolute(fromRoot);
    });
  return unique(scripts);
}

function blankNonVisibleHtml(source) {
  return source.replace(
    /<!--[\s\S]*?-->|<script\b[\s\S]*?<\/script\s*>|<style\b[\s\S]*?<\/style\s*>/gi,
    (match) => match.replace(/[^\n]/g, ' ')
  );
}

function emojiOccurrencesInText(source, filePath) {
  const results = [];
  const lines = source.split(/\r?\n/);
  lines.forEach((line, index) => {
    for (const char of line) {
      if (/\p{Extended_Pictographic}/u.test(char)) {
        results.push({
          file: relative(filePath),
          line: index + 1,
          character: char,
          codePoint: `U+${char.codePointAt(0).toString(16).toUpperCase()}`,
          context: line.trim().slice(0, 180)
        });
      }
    }
  });
  return results;
}

function emojiOccurrencesInJavaScriptStrings(source, filePath) {
  const results = [];
  const lines = source.split(/\r?\n/);
  let state = 'code';
  let escaped = false;
  let regexCharClass = false;
  let line = 1;

  for (let index = 0; index < source.length;) {
    const codePoint = source.codePointAt(index);
    const char = String.fromCodePoint(codePoint);
    const next = source[index + char.length] || '';

    if (state === 'line-comment') {
      if (char === '\n') {
        state = 'code';
        line += 1;
      }
      index += char.length;
      continue;
    }
    if (state === 'block-comment') {
      if (char === '*' && next === '/') {
        state = 'code';
        index += 2;
        continue;
      }
      if (char === '\n') line += 1;
      index += char.length;
      continue;
    }
    if (state === 'regex') {
      if (escaped) {
        escaped = false;
      } else if (char === '\\') {
        escaped = true;
      } else if (char === '[') {
        regexCharClass = true;
      } else if (char === ']') {
        regexCharClass = false;
      } else if (char === '/' && !regexCharClass) {
        state = 'code';
      }
      if (char === '\n') line += 1;
      index += char.length;
      continue;
    }
    if (state === 'code') {
      if (char === '/' && next === '/') {
        state = 'line-comment';
        index += 2;
        continue;
      }
      if (char === '/' && next === '*') {
        state = 'block-comment';
        index += 2;
        continue;
      }
      if (char === '/' && isRegexLiteralStart(source, index)) {
        state = 'regex';
        regexCharClass = false;
        index += char.length;
        continue;
      }
      if (char === "'") state = 'single';
      else if (char === '"') state = 'double';
      else if (char === '`') state = 'template';
      if (char === '\n') line += 1;
      index += char.length;
      continue;
    }

    if (escaped) {
      escaped = false;
    } else if (char === '\\') {
      escaped = true;
    } else if ((state === 'single' && char === "'")
      || (state === 'double' && char === '"')
      || (state === 'template' && char === '`')) {
      state = 'code';
    } else if (/\p{Extended_Pictographic}/u.test(char)) {
      const context = (lines[line - 1] || '').trim();
      if (!/\bconsole\.(?:log|warn|error|info|debug)\s*\(/.test(context)) {
        results.push({
          file: relative(filePath),
          line,
          character: char,
          codePoint: `U+${char.codePointAt(0).toString(16).toUpperCase()}`,
          context: context.slice(0, 180)
        });
      }
    }

    if (char === '\n') line += 1;
    index += char.length;
  }
  return results;
}

async function evaluateMultigroupEngine(sources) {
  const quietConsole = Object.freeze({
    log() {}, warn() {}, error() {}, info() {}, debug() {}
  });
  const context = {
    console: quietConsole,
    Intl,
    location: { pathname: '/pages/simulador.html' },
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  context.globalThis = context;
  vm.createContext(context);

  for (const [filename, source] of [
    ['js/simulation-contracts.js', sources.contracts],
    ['js/engine.js', sources.engine],
    ['js/comparator.js', sources.comparator],
    ['js/shelf-engine.js', sources.shelfEngine]
  ]) {
    vm.runInContext(source, context, { filename });
  }

  const engine = vm.runInContext('ConsorcioEngine', context);
  const contracts = vm.runInContext('BFSimulationContracts', context);
  const shelf = vm.runInContext('ShelfEngine', context);
  const groupA = {
    groupKey: '203001|11111111|GRUPO-A|1',
    codigoGrupo: 'GRUPO-A',
    codigoSegmento: 1,
    nomeAdministradora: 'Administradora A',
    nomeSegmento: 'Imoveis',
    prazoMeses: 24,
    valorCartaRef: 100000,
    taxaAdmPct: 12,
    fundoReservaPct: 2,
    seguroPctComercial: 0,
    indiceCorrecaoNome: 'fixo',
    parcelaReduzidaDisponivel: false,
    reducaoMaxParcelaPct: 0,
    lanceEmbutidoMaxPct: 30,
    lanceFixoPct: 20
  };
  const groupB = {
    ...groupA,
    groupKey: '203001|22222222|GRUPO-B|1',
    codigoGrupo: 'GRUPO-B',
    nomeAdministradora: 'Administradora B',
    valorCartaRef: 150000,
    prazoMeses: 36,
    taxaAdmPct: 10
  };
  const itemA = shelf.createProjectItem(groupA, 1);
  const itemB = shelf.createProjectItem(groupB, 2);
  itemA.mesContemplacaoAlvo = 12;
  itemB.mesContemplacaoAlvo = 18;
  const result = shelf.simulateStructuredProject(
    { itens: [itemA, itemB] },
    {
      indiceReajuste: 0,
      mesAniversario: 12,
      politicaSaldo: 'carta',
      adiantamentos: [{ mes: 8, valor: 6000, qtdParcelas: 1, tipo: 'reduzir_saldo' }],
      inadimplencias: [{ mesInicio: 14, mesesAtraso: 2, regularizar: true, mesRegularizacao: 17 }],
      multaAtraso: 2,
      jurosAtraso: 1
    }
  );

  return { engine, contracts, result, itemA, itemB };
}

async function countLogicalProposalPages(proposalSummarySource) {
  const target = { id: 'v9-proposal-root', innerHTML: '', dataset: {} };
  const context = {
    console: { log() {}, warn() {}, error() {} },
    Intl,
    location: { pathname: '/pages/proposta.html' },
    document: {
      querySelector() { return target; },
      getElementById() { return null; }
    },
    setTimeout() { return 0; },
    clearTimeout() {}
  };
  context.window = context;
  context.globalThis = context;
  vm.createContext(context);
  vm.runInContext(proposalSummarySource, context, { filename: 'js/proposal-summary.js' });
  const summary = vm.runInContext('ProposalSummary', context);
  summary.render(target, { proposalData: summary.createMockData() }, {
    rootId: 'v9-proposal-export-root',
    chartPrefix: 'v9-proposal',
    surface: 'validation'
  });
  const pageCount = countMatches(target.innerHTML, /\bps-print-page\b/g);
  return {
    pageCount,
    htmlLength: target.innerHTML.length,
    hasRoot: /data-proposal-summary-root/.test(target.innerHTML)
  };
}

const sources = {
  simulatorHtml: await read('pages/simulador.html'),
  publicHtml: await read('pages/proposta.html'),
  app: await read('js/app.js'),
  contracts: await read('js/simulation-contracts.js'),
  engine: await read('js/engine.js'),
  comparator: await read('js/comparator.js'),
  shelfEngine: await read('js/shelf-engine.js'),
  proposalExperience: await read('js/proposal-experience.js'),
  proposalPublic: await read('js/proposal-public.js'),
  proposalSummary: await read('js/proposal-summary.js'),
  exportManager: await read('js/export.js'),
  backendApi: await read('assets/js/services/backend-api.service.js'),
  server: await read('server.js'),
  proposalSnapshot: await read('js/proposal-snapshot.js'),
  proposalShare: await read('js/proposal-share.js')
};

const expectedSteps = Array.from({ length: 10 }, (_, index) => index + 1);
const sectionSteps = [...sources.simulatorHtml.matchAll(/<section\b[^>]*\bid=["']step-(\d+)["'][^>]*>/gi)]
  .map((match) => Number(match[1]));
const railSteps = [...sources.simulatorHtml.matchAll(/\bdata-evolution-step=["'](\d+)["']/gi)]
  .map((match) => Number(match[1]));
const headingSteps = [...sources.simulatorHtml.matchAll(/Etapa\s+(\d+)\s+de\s+10/gi)]
  .map((match) => Number(match[1]));

addCheck(
  'journey.sections',
  'A jornada declara exatamente as 10 secoes funcionais.',
  orderedExactly(unique(sectionSteps).sort((a, b) => a - b), expectedSteps) && sectionSteps.length === 10,
  { foundInSourceOrder: sectionSteps, expected: expectedSteps }
);
addCheck(
  'journey.source-order',
  'As secoes da jornada aparecem em ordem semantica de 1 a 10 no HTML.',
  orderedExactly(sectionSteps, expectedSteps),
  { found: sectionSteps, expected: expectedSteps }
);
addCheck(
  'journey.evolution-rail',
  'O trilho executivo cobre as 10 etapas uma unica vez e na ordem correta.',
  orderedExactly(railSteps, expectedSteps),
  { found: railSteps, expected: expectedSteps }
);
addCheck(
  'journey.headings',
  'Cada etapa apresenta a numeracao explicita n de 10.',
  orderedExactly(unique(headingSteps).sort((a, b) => a - b), expectedSteps),
  { found: unique(headingSteps).sort((a, b) => a - b), expected: expectedSteps }
);

const capacityFields = [
  'valorObjetivo',
  'parcelaConfortavel',
  'reservaAtual',
  'caixaLance',
  'prazoDesejado',
  'urgencia',
  'toleranciaRisco',
  'clienteConsentimento'
];
const missingCapacityFields = capacityFields.filter((id) => {
  const field = new RegExp(`<(?:input|select|textarea)\\b[^>]*\\bid=["']${id}["'][^>]*>`, 'i');
  const label = new RegExp(`<label\\b[^>]*\\bfor=["']${id}["'][^>]*>`, 'i');
  return !field.test(sources.simulatorHtml) || !label.test(sources.simulatorHtml);
});
addCheck(
  'capacity.fields',
  'Campos de capacidade, horizonte, risco e consentimento possuem controle e rotulo associado.',
  missingCapacityFields.length === 0,
  { required: capacityFields, missingOrUnlabelled: missingCapacityFields }
);
const unwiredCapacityFields = capacityFields.filter((id) => !new RegExp(`\\b${id}\\s*:`, 'm').test(sources.app));
addCheck(
  'capacity.wiring',
  'Os campos de capacidade e consentimento entram no contrato da simulacao.',
  unwiredCapacityFields.length === 0,
  { unwired: unwiredCapacityFields }
);
addCheck(
  'capacity.validation',
  'Consentimento e limites essenciais participam do gate de validacao.',
  /clienteConsentimento[\s\S]{0,240}\.checked/.test(sources.app)
    && /valorObjetivo[\s\S]{0,320}parcelaConfortavel/.test(sources.app)
    && /parcela mensal confort[aá]vel/i.test(sources.app),
  {
    consentChecked: /clienteConsentimento[\s\S]{0,240}\.checked/.test(sources.app),
    positiveCapacityFields: /valorObjetivo[\s\S]{0,320}parcelaConfortavel/.test(sources.app)
  }
);

const localSimulatorScripts = localScriptPaths(sources.simulatorHtml, 'pages/simulador.html').map(relative);
const contractsIndex = localSimulatorScripts.indexOf('js/simulation-contracts.js');
const engineIndex = localSimulatorScripts.indexOf('js/engine.js');
addCheck(
  'engine.script-order',
  'simulation-contracts.js e carregado antes do motor financeiro.',
  contractsIndex >= 0 && engineIndex >= 0 && contractsIndex < engineIndex,
  { contractsIndex, engineIndex }
);
addCheck(
  'engine.contract-binding',
  'O motor usa explicitamente o contrato canonico quando ele esta disponivel.',
  /globalThis\.BFSimulationContracts/.test(sources.engine)
    && /externalContracts\?\.VERSION/.test(sources.engine)
    && /externalContracts\?\.normalizeParams/.test(sources.engine),
  {
    schema: (sources.contracts.match(/const\s+SCHEMA\s*=\s*['"]([^'"]+)/) || [])[1] || '',
    version: (sources.contracts.match(/const\s+VERSION\s*=\s*['"]([^'"]+)/) || [])[1] || ''
  }
);

addCheck(
  'multigroup.source-contract',
  'A aplicacao modela um projeto com colecao de grupos/cotas e chama o simulador estruturado.',
  /projetoEstruturado\s*=\s*\{\s*itens\s*:\s*\[\]/.test(sources.app)
    && /simulateStructuredProject\(projetoEstruturado/.test(sources.app)
    && /groupKey/.test(sources.shelfEngine)
    && /quantidadeCotas/.test(sources.shelfEngine),
  {
    collection: /projetoEstruturado\s*=\s*\{\s*itens\s*:\s*\[\]/.test(sources.app),
    structuredSimulation: /simulateStructuredProject\(projetoEstruturado/.test(sources.app)
  }
);

const exampleBody = extractFunctionBody(sources.app, 'carregarExemplo');
const selectedGroupsBody = extractFunctionBody(sources.app, 'renderGruposSelecionados');
addCheck(
  'multigroup.example-advance-state',
  'O exemplo multigrupo sincroniza a sacola renderizada com o botao de avancar.',
  /projetoEstruturado\.itens\s*=\s*exampleGroups\.map/.test(exampleBody)
    && /renderGruposSelecionados\(\)/.test(exampleBody)
    && /atualizarBotaoAvancar\(\)/.test(selectedGroupsBody)
    && /populateGroupSelects\(\)/.test(selectedGroupsBody),
  {
    createsMultipleItems: /projetoEstruturado\.itens\s*=\s*exampleGroups\.map/.test(exampleBody),
    rendersSelection: /renderGruposSelecionados\(\)/.test(exampleBody),
    synchronizesAdvance: /atualizarBotaoAvancar\(\)/.test(selectedGroupsBody),
    synchronizesComparator: /populateGroupSelects\(\)/.test(selectedGroupsBody)
  }
);

try {
  const multigroup = await evaluateMultigroupEngine(sources);
  const validResults = multigroup.result.itemResults.filter((item) => !item.erro);
  addCheck(
    'multigroup.runtime',
    'O motor executa dois grupos distintos e consolida tres cotas sem colapsar os itens.',
    multigroup.result.erro === false
      && multigroup.result.consolidado.totalGrupos === 2
      && multigroup.result.consolidado.totalGruposValidos === 2
      && multigroup.result.consolidado.totalCotas === 3
      && Math.abs(multigroup.result.consolidado.totalCarta - 400000) < 0.01
      && validResults.length === 2
      && new Set(validResults.map((item) => item.item.groupKey)).size === 2,
    {
      totalGroups: multigroup.result.consolidado.totalGrupos,
      validGroups: multigroup.result.consolidado.totalGruposValidos,
      totalQuotas: multigroup.result.consolidado.totalCotas,
      totalCredit: multigroup.result.consolidado.totalCarta,
      resultKeys: validResults.map((item) => item.item.groupKey)
    }
  );
  const reconciliation = validResults.map((item) => ({
    groupKey: item.item.groupKey,
    invariant: item.simulation.auditoria?.invariantes?.valido === true,
    reconciliation: item.simulation.auditoria?.reconciliacao?.valido === true
  }));
  addCheck(
    'multigroup.reconciliation',
    'Cada grupo do projeto multigrupo fecha invariantes e reconciliacao financeira.',
    reconciliation.length === 2 && reconciliation.every((item) => item.invariant && item.reconciliation),
    { groups: reconciliation }
  );
  const eventRows = {
    advance: multigroup.result.consolidado.cronograma.find((row) => row.mes === 8),
    defaultStart: multigroup.result.consolidado.cronograma.find((row) => row.mes === 14),
    defaultContinuation: multigroup.result.consolidado.cronograma.find((row) => row.mes === 15),
    regularization: multigroup.result.consolidado.cronograma.find((row) => row.mes === 17)
  };
  addCheck(
    'multigroup.future-events',
    'Adiantamento, inadimplencia e regularizacao atravessam o contrato e aparecem no cronograma consolidado.',
    Math.abs((eventRows.advance?.valorAdiantado || 0) - 6000) < 0.02
      && /adiantamento/i.test(eventRows.advance?.evento || '')
      && /inadimpl/i.test(eventRows.defaultStart?.evento || '')
      && /inadimpl/i.test(eventRows.defaultContinuation?.evento || '')
      && /regulariza/i.test(eventRows.regularization?.evento || '')
      && (eventRows.regularization?.multa || 0) > 0
      && (eventRows.regularization?.juros || 0) > 0,
    {
      advanceValue: eventRows.advance?.valorAdiantado || 0,
      advanceEvent: eventRows.advance?.evento || '',
      defaultEvents: [eventRows.defaultStart?.evento || '', eventRows.defaultContinuation?.evento || ''],
      regularizationEvent: eventRows.regularization?.evento || '',
      regularizationCharges: {
        multa: eventRows.regularization?.multa || 0,
        juros: eventRows.regularization?.juros || 0
      }
    }
  );
  addCheck(
    'engine.runtime-contract',
    'Motor e contrato carregados no navegador compartilham schema e versao.',
    multigroup.engine.VERSION === multigroup.contracts.VERSION
      && multigroup.engine.SCHEMA === multigroup.contracts.SCHEMA,
    {
      engineVersion: multigroup.engine.VERSION,
      contractVersion: multigroup.contracts.VERSION,
      engineSchema: multigroup.engine.SCHEMA,
      contractSchema: multigroup.contracts.SCHEMA
    }
  );
} catch (error) {
  addCheck('multigroup.runtime', 'O motor executa dois grupos distintos e consolida tres cotas sem colapsar os itens.', false, {
    error: error && error.stack ? error.stack.split(/\r?\n/).slice(0, 4).join(' | ') : String(error)
  });
  addCheck('multigroup.reconciliation', 'Cada grupo do projeto multigrupo fecha invariantes e reconciliacao financeira.', false, {
    error: 'Execucao multigrupo indisponivel.'
  });
  addCheck('multigroup.future-events', 'Adiantamento, inadimplencia e regularizacao atravessam o contrato e aparecem no cronograma consolidado.', false, {
    error: 'Execucao multigrupo indisponivel.'
  });
  addCheck('engine.runtime-contract', 'Motor e contrato carregados no navegador compartilham schema e versao.', false, {
    error: 'Execucao do contrato indisponivel.'
  });
}

const requiredApiMethods = [
  'createProposalSnapshot',
  'transitionProposalSnapshot',
  'publishProposalSnapshot',
  'revokeProposalShare',
  'getPublicProposal'
];
const missingApiMethods = requiredApiMethods.filter((name) => {
  const declaration = new RegExp(`function\\s+${name}\\s*\\(`);
  const exposure = new RegExp(`\\b${name}\\b`);
  return !declaration.test(sources.backendApi) || !exposure.test(sources.backendApi.slice(sources.backendApi.indexOf('window.BFBackendApi')));
});
addCheck(
  'publication.backend-api',
  'BFBackendApi expoe criacao, transicao, publicacao, revogacao e leitura publica.',
  missingApiMethods.length === 0,
  { required: requiredApiMethods, missing: missingApiMethods }
);

const requiredServerRoutes = [
  '/api/proposal-snapshots',
  '/api/proposal-snapshots/',
  '/transitions',
  '/publish',
  '/api/proposal-shares/',
  '/revoke',
  '/api/public/proposals/'
];
const normalizedServerSource = sources.server.replace(/\\\//g, '/');
const missingServerRoutes = requiredServerRoutes.filter((route) => !normalizedServerSource.includes(route));
addCheck(
  'publication.server-routes',
  'O servidor implementa os endpoints privados e publico do ciclo da proposta.',
  missingServerRoutes.length === 0,
  { missing: missingServerRoutes }
);

const publishBody = extractFunctionBody(sources.proposalExperience, 'publishSecureProposal');
const publicationSequence = [
  'await api.createProposalSnapshot(prepared.payload)',
  "await api.transitionProposalSnapshot(created.snapshot.id, 'validada'",
  "await api.transitionProposalSnapshot(validated.snapshot.id, 'revisada'",
  'await api.publishProposalSnapshot(reviewed.snapshot.id'
];
const sequenceIndexes = publicationSequence.map((marker) => publishBody.indexOf(marker));
addCheck(
  'publication.client-sequence',
  'A interface publica pelo BFBackendApi na ordem rascunho, validada, revisada e publicada.',
  publishBody.includes('window.BFBackendApi')
    && publishBody.includes('hasPublicationSession(session)')
    && !publishBody.includes('session?.token')
    && sequenceIndexes.every((index) => index >= 0)
    && sequenceIndexes.every((index, position) => position === 0 || index > sequenceIndexes[position - 1])
    && !/prepareLocalPublication|localStorage\.setItem\([^)]*proposal.*publish/i.test(publishBody),
  { sequence: publicationSequence, indexes: sequenceIndexes }
);
addCheck(
  'publication.app-bridge',
  'A API publica do simulador fica disponivel ao modulo de publicacao carregado separadamente.',
  /window\.App\s*=\s*App/.test(sources.app)
    && /window\.App\?\.getProposalPublicationPayload\?\.\(\)/.test(publishBody),
  {
    exposesApp: /window\.App\s*=\s*App/.test(sources.app),
    publicationConsumesBridge: /window\.App\?\.getProposalPublicationPayload\?\.\(\)/.test(publishBody)
  }
);
addCheck(
  'publication.release-gates',
  'Publicacao exige gate de liberacao, sessao autenticada e revisao humana.',
  /if\s*\(!state\.ready\)/.test(publishBody)
    && /readSession\?\.\(\)/.test(publishBody)
    && /hasPublicationSession\(session\)/.test(publishBody)
    && /prepared\.payload\.review/.test(publishBody),
  {
    releaseGate: /if\s*\(!state\.ready\)/.test(publishBody),
    authenticatedSession: /hasPublicationSession\(session\)/.test(publishBody),
    humanReview: /prepared\.payload\.review/.test(publishBody)
  }
);

try {
  const ProposalSnapshot = require(path.join(root, 'js/proposal-snapshot.js'));
  let id = 0;
  const dependencies = {
    clock: () => new Date('2030-01-01T12:00:00.000Z'),
    idFactory: () => `PSN-V9-${++id}`
  };
  const draft = ProposalSnapshot.create({
    proposalId: 'PROP-V9',
    engineVersion: 'ConsorcioPro 2.0.0',
    dataBase: '203001',
    project: { client: { name: 'Pessoa Teste' }, items: [{ groupKey: '203001|A' }] },
    result: { proposalData: { metrics: { credit: 100000 }, schedule: [{ mes: 1 }] } },
    review: {},
    provenance: { source: 'validator-v9' }
  }, dependencies);
  const validated = ProposalSnapshot.transition(draft, ProposalSnapshot.STATUS.VALIDATED, {}, dependencies);
  const reviewed = ProposalSnapshot.transition(validated, ProposalSnapshot.STATUS.REVIEWED, {
    review: { status: 'reviewed', approved: true, reviewedAt: '2030-01-01T12:00:00.000Z' }
  }, dependencies);
  const published = ProposalSnapshot.transition(reviewed, ProposalSnapshot.STATUS.PUBLISHED, {}, dependencies);
  const states = [draft.status, validated.status, reviewed.status, published.status];
  addCheck(
    'publication.domain-lifecycle',
    'A maquina de estados aceita somente o ciclo completo ate publicada.',
    orderedExactly(states, ['rascunho', 'validada', 'revisada', 'publicada'])
      && published.version === 4
      && published.parentSnapshotId === reviewed.id,
    { states, finalVersion: published.version }
  );

  const publicSnapshot = ProposalSnapshot.toPublicSnapshot(published);
  const publicJson = JSON.stringify(publicSnapshot).toLowerCase();
  addCheck(
    'publication.public-pii-redaction',
    'A projecao publica remove identificadores pessoais do snapshot.',
    !publicJson.includes('pessoa teste')
      && !publicJson.includes('prop-v9')
      && publicJson.includes('203001|a'),
    {
      personalNameRemoved: !publicJson.includes('pessoa teste'),
      internalProposalIdRemoved: !publicJson.includes('prop-v9'),
      businessGroupPreserved: publicJson.includes('203001|a')
    }
  );
} catch (error) {
  addCheck('publication.domain-lifecycle', 'A maquina de estados aceita somente o ciclo completo ate publicada.', false, {
    error: error && error.message ? error.message : String(error)
  });
  addCheck('publication.public-pii-redaction', 'A projecao publica remove identificadores pessoais do snapshot.', false, {
    error: 'Projecao publica nao pode ser exercitada.'
  });
}

const noindexMeta = (sources.publicHtml.match(/<meta\b[^>]*\bname=["']robots["'][^>]*>/i) || [''])[0];
addCheck(
  'public-page.noindex',
  'A pagina publica bloqueia indexacao, seguimento e cache de snippet.',
  /noindex/i.test(noindexMeta) && /nofollow/i.test(noindexMeta) && /noarchive/i.test(noindexMeta),
  { robotsMeta: noindexMeta.replace(/\s+/g, ' ').trim() }
);
addCheck(
  'public-page.fragment-token',
  'A pagina le o token opaco exclusivamente do fragmento da URL.',
  /window\.location\.hash/.test(sources.proposalPublic)
    && !/window\.location\.search|URLSearchParams/.test(extractFunctionBody(sources.proposalPublic, 'tokenFromLocation'))
    && /\^\[A-Za-z0-9_-\]\{40,160\}\$/.test(sources.proposalPublic),
  {
    usesHash: /window\.location\.hash/.test(sources.proposalPublic),
    usesQueryInTokenReader: /window\.location\.search|URLSearchParams/.test(extractFunctionBody(sources.proposalPublic, 'tokenFromLocation'))
  }
);
const publicControls = [...sources.publicHtml.matchAll(/<(input|textarea|select|form)\b/gi)].map((match) => match[1].toLowerCase());
addCheck(
  'public-page.read-only',
  'A pagina publica preserva a proposta somente para leitura e oferece PDF ou pedido de contato, sem controles de edicao.',
  /somente leitura/i.test(sources.publicHtml)
    && publicControls.length === 0
    && !/\b(?:POST|PUT|PATCH|DELETE)\b/.test(sources.proposalPublic)
    && /getPublicProposal\(proposalToken\)/.test(sources.proposalPublic)
    && /requestPublicProposalInterest\(proposalToken\)/.test(sources.proposalPublic),
  {
    editControls: publicControls,
    readOperation: /getPublicProposal\(proposalToken\)/.test(sources.proposalPublic),
    contactRequest: /requestPublicProposalInterest\(proposalToken\)/.test(sources.proposalPublic)
  }
);
addCheck(
  'public-page.redacted-fallback',
  'A proposta publica substitui identificadores removidos por rotulos neutros, sem campos visivelmente vazios.',
  /cliente:\s*proposalData\.cliente\s*\|\|\s*['"]Cliente da proposta['"]/.test(sources.proposalPublic)
    && /consultor:\s*proposalData\.consultor\s*\|\|\s*['"]Bancus Fraternis['"]/.test(sources.proposalPublic),
  {
    clientFallback: /Cliente da proposta/.test(sources.proposalPublic),
    consultantFallback: /consultor:\s*proposalData\.consultor/.test(sources.proposalPublic)
  }
);

const publicUrlBody = extractFunctionBody(sources.proposalExperience, 'publicProposalUrl');
addCheck(
  'public-page.opaque-link',
  'O link compartilhado contem somente origem, rota fixa e token no fragmento, sem PII.',
  /\/pages\/proposta\.html#\$\{encodeURIComponent\(token\)\}/.test(publicUrlBody)
    && !/cliente|client|cpf|email|telefone|phone|nome|proposalId/i.test(publicUrlBody),
  { normalizedFunctionBody: publicUrlBody.replace(/\s+/g, ' ').trim() }
);

try {
  const ProposalShare = require(path.join(root, 'js/proposal-share.js'));
  const token = ProposalShare.makeOpaqueToken();
  const hash = ProposalShare.tokenHash(token);
  addCheck(
    'public-page.token-entropy',
    'O token e URL-safe, possui pelo menos 256 bits de entropia e e separado do hash persistivel.',
    ProposalShare.TOKEN_BYTES >= 32
      && token.length >= 43
      && /^[A-Za-z0-9_-]+$/.test(token)
      && /^[a-f0-9]{64}$/.test(hash)
      && token !== hash,
    { tokenBytes: ProposalShare.TOKEN_BYTES, tokenLength: token.length, hashLength: hash.length }
  );
} catch (error) {
  addCheck('public-page.token-entropy', 'O token e URL-safe, possui pelo menos 256 bits de entropia e e separado do hash persistivel.', false, {
    error: error && error.message ? error.message : String(error)
  });
}

const nativePdfBody = extractFunctionBody(sources.exportManager, 'exportarPDFDaTela');
const prepareCloneBody = extractFunctionBody(sources.exportManager, 'prepareTextualPrintClone');
const proposalExportBody = extractFunctionBody(sources.proposalSummary, 'exportPDF');
addCheck(
  'pdf.native-route',
  'A proposta usa a superficie HTML clonada e a impressao nativa para gerar PDF pesquisavel.',
  /ExportManager\.exportarPDFDaTela/.test(proposalExportBody)
    && /prepareTextualPrintClone\(source\)/.test(nativePdfBody)
    && /clone\.outerHTML/.test(nativePdfBody)
    && /printWindow\.print\(\)/.test(nativePdfBody)
    && /printWindow\.document\.write/.test(nativePdfBody),
  {
    proposalDelegatesToNative: /ExportManager\.exportarPDFDaTela/.test(proposalExportBody),
    clonesHtml: /clone\.outerHTML/.test(nativePdfBody),
    invokesNativePrint: /printWindow\.print\(\)/.test(nativePdfBody)
  }
);
addCheck(
  'pdf.no-raster-active-path',
  'html2canvas e jsPDF nao participam do caminho ativo da proposta.',
  !/html2canvas|jsPDF|jspdf/i.test(nativePdfBody)
    && !/html2canvas|jsPDF|jspdf/i.test(prepareCloneBody)
    && !/html2canvas|jspdf/i.test(sources.simulatorHtml)
    && !/html2canvas|jspdf/i.test(sources.publicHtml),
  {
    activeFunctionHasRasterLibrary: /html2canvas|jsPDF|jspdf/i.test(nativePdfBody),
    simulatorLoadsRasterLibrary: /html2canvas|jspdf/i.test(sources.simulatorHtml),
    publicPageLoadsRasterLibrary: /html2canvas|jspdf/i.test(sources.publicHtml)
  }
);

try {
  const pageEvidence = await countLogicalProposalPages(sources.proposalSummary);
  addCheck(
    'proposal.logical-pages',
    'A proposta padrao renderiza entre 12 e 16 paginas logicas.',
    pageEvidence.hasRoot && pageEvidence.pageCount >= 12 && pageEvidence.pageCount <= 16,
    pageEvidence
  );
} catch (error) {
  addCheck('proposal.logical-pages', 'A proposta padrao renderiza entre 12 e 16 paginas logicas.', false, {
    error: error && error.stack ? error.stack.split(/\r?\n/).slice(0, 4).join(' | ') : String(error)
  });
}

const uiHtmlPaths = unique([
  path.join(root, 'pages/simulador.html'),
  path.join(root, 'pages/proposta.html')
]);
const uiScriptPaths = unique([
  ...localScriptPaths(sources.simulatorHtml, 'pages/simulador.html'),
  ...localScriptPaths(sources.publicHtml, 'pages/proposta.html')
]);
const emojiOccurrences = [];
for (const htmlPath of uiHtmlPaths) {
  const source = await fs.readFile(htmlPath, 'utf8');
  emojiOccurrences.push(...emojiOccurrencesInText(blankNonVisibleHtml(source), htmlPath));
}
for (const scriptPath of uiScriptPaths) {
  try {
    const source = await fs.readFile(scriptPath, 'utf8');
    emojiOccurrences.push(...emojiOccurrencesInJavaScriptStrings(source, scriptPath));
  } catch (error) {
    addCheck(`emoji.source.${relative(scriptPath).replace(/[^a-z0-9]+/gi, '-')}`, `Script carregado disponivel para auditoria de emojis: ${relative(scriptPath)}`, false, {
      error: error && error.code ? error.code : String(error)
    });
  }
}
emojiOccurrences.sort((left, right) => left.file.localeCompare(right.file) || left.line - right.line || left.codePoint.localeCompare(right.codePoint));
addCheck(
  'visual.no-visible-emoji',
  'Nao ha emojis em textos visiveis da jornada e da proposta.',
  emojiOccurrences.length === 0,
  { scannedFiles: unique([...uiHtmlPaths, ...uiScriptPaths].map(relative)).sort(), occurrences: emojiOccurrences }
);

const passed = checks.filter((check) => check.ok).length;
const failedChecks = checks.filter((check) => !check.ok);
const report = {
  schema: 'bancus.validation.simulator-evolution-v9.v1',
  validator: 'tools/validate-simulator-evolution-v9.mjs',
  validatorVersion: '9.0.0',
  status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
  summary: {
    total: checks.length,
    passed,
    failed: failedChecks.length
  },
  checks,
  failures: failedChecks.map(({ id, title, evidence }) => ({ id, title, evidence }))
};

await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');

console.log(`[simulator-evolution-v9] ${report.status}: ${passed}/${checks.length} checks aprovados.`);
console.log(`[simulator-evolution-v9] Relatorio: ${relative(reportPath)}`);
failedChecks.forEach((check) => console.error(`[FAIL] ${check.id}: ${check.title}`));
if (failedChecks.length > 0) process.exitCode = 1;
