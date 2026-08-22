import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
const reportPath = path.join(root, 'docs/test-reports/language-navigation-v10-report.json');
const baseUrl = String(process.env.BF_V10_BASE_URL || 'http://127.0.0.1:8080').replace(/\/$/, '');
const checks = [];
const gaps = [];

function relative(filePath) {
  return path.relative(root, filePath).replace(/\\/g, '/');
}

function addCheck(id, title, ok, evidence = {}) {
  checks.push({ id, title, ok: Boolean(ok), evidence });
}

async function read(relativePath) {
  try {
    return await fs.readFile(path.join(root, relativePath), 'utf8');
  } catch (error) {
    addCheck(`source.${relativePath.replace(/[^a-z0-9]+/gi, '-').toLowerCase()}`, `Arquivo disponivel: ${relativePath}`, false, {
      error: error?.code || String(error)
    });
    return '';
  }
}

function stripComments(source) {
  return String(source || '').replace(/<!--[\s\S]*?-->/g, '');
}

function normalizeText(value) {
  return String(value || '')
    .normalize('NFKD')
    .replace(/\p{M}/gu, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toLowerCase();
}

function unique(values) {
  return [...new Set(values)];
}

function orderedExactly(actual, expected) {
  return actual.length === expected.length && actual.every((value, index) => value === expected[index]);
}

const languageRules = [
  { id: 'ai.acronym-pt', category: 'ai', pattern: /\bia\b/u, label: 'IA' },
  { id: 'ai.acronym-en', category: 'ai', pattern: /\bai\b/u, label: 'AI' },
  { id: 'ai.explicit', category: 'ai', pattern: /\binteligencia artificial\b/u, label: 'inteligencia artificial' },
  { id: 'ai.algorithm', category: 'ai', pattern: /\balgoritm(?:o|ica|ico|os|icas|icos)\b/u, label: 'algoritmo' },
  { id: 'ai.heuristic', category: 'ai', pattern: /\bheuristic(?:a|o|as|os)\b/u, label: 'heuristica' },
  { id: 'ai.score', category: 'ai', pattern: /\bscore\b/u, label: 'score' },
  { id: 'ai.assistant', category: 'ai', pattern: /\b(?:assistente|agente) virtual\b/u, label: 'assistente/agente virtual' },
  { id: 'ai.copilot', category: 'ai', pattern: /\bcopiloto\b/u, label: 'copiloto' },
  { id: 'ai.smart-analysis', category: 'ai', pattern: /\b(?:analise|recomendacao) inteligente\b/u, label: 'analise/recomendacao inteligente' },
  { id: 'ai.ml', category: 'ai', pattern: /\b(?:machine learning|aprendizado de maquina)\b/u, label: 'machine learning' },

  { id: 'internal.snapshot', category: 'internal', pattern: /\bsnapshot\b/u, label: 'snapshot' },
  { id: 'internal.payload', category: 'internal', pattern: /\bpayload\b/u, label: 'payload' },
  { id: 'internal.schema', category: 'internal', pattern: /\bschema\b/u, label: 'schema' },
  { id: 'internal.endpoint', category: 'internal', pattern: /\bendpoint\b/u, label: 'endpoint' },
  { id: 'internal.hash-token', category: 'internal', pattern: /\b(?:hash|token)\b/u, label: 'hash/token' },
  { id: 'internal.json', category: 'internal', pattern: /\bjson\b/u, label: 'JSON' },
  { id: 'internal.fallback', category: 'internal', pattern: /\bfallback\b/u, label: 'fallback' },
  { id: 'internal.debug-mock', category: 'internal', pattern: /\b(?:debug|mock)\b/u, label: 'debug/mock' },
  { id: 'internal.gate-release', category: 'internal', pattern: /\b(?:gate|gates|release)\b/u, label: 'gate/release' },
  { id: 'internal.local-server', category: 'internal', pattern: /\bservidor local\b/u, label: 'servidor local' },
  { id: 'internal.local-environment', category: 'internal', pattern: /\b(?:ambiente|estado) local\b/u, label: 'ambiente/estado local' },
  { id: 'internal.real-base', category: 'internal', pattern: /\bbase (?:real|compacta)\b/u, label: 'base real/compacta' },
  { id: 'internal.financial-engine', category: 'internal', pattern: /\bmotor financeiro\b/u, label: 'motor financeiro' },
  { id: 'internal.build-version', category: 'internal', pattern: /\b(?:simulador|consorciopro)\s+v\d+(?:\.\d+)*\b/u, label: 'versao interna do produto' },
  { id: 'internal.opaque-link', category: 'internal', pattern: /\blink opaco\b/u, label: 'link opaco' },
  { id: 'internal.url-explanation', category: 'internal', pattern: /\b(?:url|indexacao)\b/u, label: 'URL/indexacao' },

  { id: 'filler.audit-narrative', category: 'filler', pattern: /\bnarrativa auditavel\b/u, label: 'narrativa auditavel' },
  { id: 'filler.executive-reading', category: 'filler', pattern: /\bleitura (?:executiva|conectada|segura|unica)\b/u, label: 'leitura abstrata' },
  { id: 'filler.talking-blocks', category: 'filler', pattern: /\b(?:blocos? que conversa(?:m)?|conversa(?:m)? entre si)\b/u, label: 'blocos que conversam' },
  { id: 'filler.decision-result', category: 'filler', pattern: /\bresultado como decisao\b/u, label: 'resultado como decisao' },
  { id: 'filler.strategic-numbers', category: 'filler', pattern: /\bnumeros estrategicos\b/u, label: 'numeros estrategicos' },
  { id: 'filler.operational-decision', category: 'filler', pattern: /\b(?:decisao|revisao) operacional\b/u, label: 'decisao/revisao operacional' },
  { id: 'filler.operational-analysis', category: 'filler', pattern: /\banalise operacional\b/u, label: 'analise operacional' },
  { id: 'filler.ideal-client', category: 'filler', pattern: /\bideal para (?:clientes?|quem)\b/u, label: 'ideal para clientes' },
  { id: 'filler.designed-operation', category: 'filler', pattern: /\boperacao desenhada\b/u, label: 'operacao desenhada' },
  { id: 'filler.structured-proposal', category: 'filler', pattern: /\bproposta estruturada\b/u, label: 'proposta estruturada' },
  { id: 'filler.consolidated-metrics', category: 'filler', pattern: /\bmetricas consolidadas\b/u, label: 'metricas consolidadas' },
  { id: 'filler.structured-project', category: 'filler', pattern: /\bprojeto estruturado\b/u, label: 'projeto estruturado' },
  { id: 'filler.governance', category: 'filler', pattern: /\bconfiguracao e governanca\b/u, label: 'configuracao e governanca' },
  { id: 'filler.traceability', category: 'filler', pattern: /\brastreabilidade comercial\b/u, label: 'rastreabilidade comercial' },
  { id: 'filler.shelf-journey', category: 'filler', pattern: /\b(?:jornada da prateleira|atalhos da jornada)\b/u, label: 'jornada interna' },
  { id: 'filler.click-card', category: 'filler', pattern: /\bclique em cada card\b/u, label: 'instrucao sobre card' },
  { id: 'filler.interface-narration', category: 'filler', pattern: /\b(?:esta tela|o painel|preview)\b/u, label: 'narracao da interface' },
  { id: 'filler.next-step-mode', category: 'filler', pattern: /\bmodo proximo passo\b/u, label: 'modo proximo passo' },
  { id: 'filler.readiness', category: 'filler', pattern: /\b(?:prontidao|diagnostico recomendado|continuidade comercial)\b/u, label: 'jargao de processo' }
];

const artifactRules = [
  { id: 'artifact.undefined', pattern: /\bundefined\b/u, label: 'undefined' },
  { id: 'artifact.null', pattern: /\bnull\b/u, label: 'null' },
  { id: 'artifact.nan', pattern: /\bnan\b/u, label: 'NaN' },
  { id: 'artifact.infinity', pattern: /\binfinity\b/u, label: 'Infinity' },
  { id: 'artifact.object', pattern: /\[object object\]/u, label: '[object Object]' },
  { id: 'artifact.replacement', pattern: /\uFFFD/u, label: 'replacement character' },
  { id: 'artifact.mojibake', pattern: /(?:Ã.|Â.|â€|ï¿½|ܷ)/u, label: 'mojibake' }
];

// These rules intentionally inspect the rendered spelling, without removing
// diacritics. They cover common customer-facing words that become ambiguous or
// look unfinished when accents are lost. Internal identifiers and source code
// never enter this candidate list.
const portugueseAccentRules = [
  { id: 'accent.simulacao', pattern: /\bsimulacao\b/iu, expected: 'simulação' },
  { id: 'accent.credito', pattern: /\bcredito\b/iu, expected: 'crédito' },
  { id: 'accent.liquido', pattern: /\bliquid(?:o|a|os|as)\b/iu, expected: 'líquido/líquida' },
  { id: 'accent.contemplacao', pattern: /\bcontemplacao\b/iu, expected: 'contemplação' },
  { id: 'accent.administracao', pattern: /\badministracao\b/iu, expected: 'administração' },
  { id: 'accent.revisao', pattern: /\brevisao\b/iu, expected: 'revisão' },
  { id: 'accent.validacao', pattern: /\bvalidacao\b/iu, expected: 'validação' },
  { id: 'accent.publicacao', pattern: /\bpublicacao\b/iu, expected: 'publicação' },
  { id: 'accent.comparacao', pattern: /\bcomparacao\b/iu, expected: 'comparação' },
  { id: 'accent.informacao', pattern: /\binformac(?:ao|oes)\b/iu, expected: 'informação/informações' },
  { id: 'accent.condicao', pattern: /\bcondic(?:ao|oes)\b/iu, expected: 'condição/condições' },
  { id: 'accent.versao', pattern: /\bvers(?:ao|oes)\b/iu, expected: 'versão/versões' },
  { id: 'accent.possivel', pattern: /\bpossivel\b/iu, expected: 'possível' },
  { id: 'accent.nao', pattern: /\bnao\b/iu, expected: 'não' },
  { id: 'accent.mes', pattern: /\bmes\b/iu, expected: 'mês' },
  { id: 'accent.ate', pattern: /\bate\b/iu, expected: 'até' },
  { id: 'accent.proprio', pattern: /\bpropri(?:o|a|os|as)\b/iu, expected: 'próprio/própria' },
  { id: 'accent.analise', pattern: /\banalise(?:s)?\b/iu, expected: 'análise/análises' },
  { id: 'accent.parametros', pattern: /\bparametros?\b/iu, expected: 'parâmetro/parâmetros' },
  { id: 'accent.calculo', pattern: /\bcalculos?\b/iu, expected: 'cálculo/cálculos' },
  { id: 'accent.projecao', pattern: /\bprojec(?:ao|oes)\b/iu, expected: 'projeção/projeções' },
  { id: 'accent.historico', pattern: /\bhistorico\b/iu, expected: 'histórico' },
  { id: 'accent.pagina', pattern: /\bpaginas?\b/iu, expected: 'página/páginas' },
  { id: 'accent.proximo', pattern: /\bproxim(?:o|a|os|as)\b/iu, expected: 'próximo/próxima' },
  { id: 'accent.opcao', pattern: /\bopc(?:ao|oes)\b/iu, expected: 'opção/opções' },
  { id: 'accent.numero', pattern: /\bnumeros?\b/iu, expected: 'número/números' },
  { id: 'accent.cenario', pattern: /\bcenarios?\b/iu, expected: 'cenário/cenários' },
  { id: 'accent.operacao', pattern: /\boperacao\b/iu, expected: 'operação' },
  { id: 'accent.composicao', pattern: /\bcomposicao\b/iu, expected: 'composição' },
  { id: 'accent.evolucao', pattern: /\bevolucao\b/iu, expected: 'evolução' },
  { id: 'accent.configuracao', pattern: /\bconfiguracao\b/iu, expected: 'configuração' },
  { id: 'accent.correcao', pattern: /\bcorrecao\b/iu, expected: 'correção' },
  { id: 'accent.reducao', pattern: /\breducao\b/iu, expected: 'redução' },
  { id: 'accent.antecipacao', pattern: /\bantecipacao\b/iu, expected: 'antecipação' },
  { id: 'accent.responsavel', pattern: /\bresponsavel\b/iu, expected: 'responsável' }
];

const publicInternalRules = [
  ...languageRules.filter((rule) => rule.category === 'internal'),
  { id: 'internal.engine-en', category: 'internal', pattern: /\bengine\b/u, label: 'engine' },
  { id: 'internal.api', category: 'internal', pattern: /\bapi\b/u, label: 'API' },
  { id: 'internal.ruleset', category: 'internal', pattern: /\bruleset(?:version)?\b/u, label: 'ruleset' },
  { id: 'internal.provenance', category: 'internal', pattern: /\bprovenance\b/u, label: 'provenance' },
  { id: 'internal.reconciliation', category: 'internal', pattern: /\breconciliacao\b/u, label: 'reconciliação' },
  { id: 'internal.source-version', category: 'internal', pattern: /\bsource\s*version\b/u, label: 'sourceVersion' },
  { id: 'internal.localhost', category: 'internal', pattern: /\blocalhost\b/u, label: 'localhost' }
];

function findOccurrences(candidates, rules) {
  const findings = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const normalized = normalizeText(candidate.text);
    if (!normalized) continue;
    for (const rule of rules) {
      if (!rule.pattern.test(normalized)) continue;
      const key = `${rule.id}|${candidate.surface}|${candidate.selector}|${candidate.text}`;
      if (seen.has(key)) continue;
      seen.add(key);
      const match = normalized.match(rule.pattern);
      const contextStart = Math.max(0, Number(match?.index || 0) - 80);
      const normalizedContext = normalized.slice(contextStart, contextStart + 240);
      findings.push({
        rule: rule.id,
        category: rule.category || 'artifact',
        term: rule.label,
        surface: candidate.surface,
        state: candidate.state,
        selector: candidate.selector,
        kind: candidate.kind,
        text: normalized.length > 240
          ? normalizedContext
          : String(candidate.text).replace(/\s+/g, ' ').trim().slice(0, 240)
      });
    }
  }
  return findings;
}

function findAccentOccurrences(candidates) {
  const findings = [];
  const seen = new Set();
  for (const candidate of candidates) {
    const rendered = String(candidate.text || '').normalize('NFC').replace(/\s+/g, ' ').trim();
    if (!rendered) continue;
    for (const rule of portugueseAccentRules) {
      const match = rendered.match(rule.pattern);
      if (!match) continue;
      const key = `${rule.id}|${candidate.surface}|${candidate.state}|${candidate.selector}|${rendered}`;
      if (seen.has(key)) continue;
      seen.add(key);
      findings.push({
        rule: rule.id,
        expected: rule.expected,
        found: match[0],
        surface: candidate.surface,
        state: candidate.state,
        selector: candidate.selector,
        kind: candidate.kind,
        text: rendered.slice(Math.max(0, Number(match.index || 0) - 70), Number(match.index || 0) + 170)
      });
    }
  }
  return findings;
}

function cents(value) {
  return Math.round(Number(value || 0) * 100);
}

function sameMoney(actual, expected) {
  return Number.isFinite(Number(actual)) && Number.isFinite(Number(expected)) && cents(actual) === cents(expected);
}

function sameNumber(actual, expected, tolerance = 1e-9) {
  return Number.isFinite(Number(actual))
    && Number.isFinite(Number(expected))
    && Math.abs(Number(actual) - Number(expected)) <= tolerance;
}

function playwrightCandidates() {
  const configured = process.env.BF_PLAYWRIGHT_PATH;
  const bundled = path.join(
    process.env.USERPROFILE || '',
    '.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright'
  );
  return unique([
    configured,
    path.join(root, 'node_modules/playwright'),
    bundled
  ].filter(Boolean));
}

function loadPlaywright() {
  const errors = [];
  const safeSource = (candidate) => {
    const normalized = String(candidate || '').replace(/\\/g, '/');
    if (normalized.includes('/codex-runtimes/')) return 'bundled-runtime/playwright';
    const relative = path.relative(root, candidate || '');
    if (relative && !relative.startsWith('..') && !path.isAbsolute(relative)) return relative.replace(/\\/g, '/');
    return path.basename(candidate || 'playwright');
  };
  for (const candidate of playwrightCandidates()) {
    try {
      return { module: require(candidate), source: safeSource(candidate) };
    } catch (error) {
      errors.push({ candidate: safeSource(candidate), error: error?.message || String(error) });
    }
  }
  return { module: null, source: '', errors };
}

async function collectUiCandidates(page, surface, state, options = {}) {
  return page.evaluate(({ surfaceName, stateName, openDetails }) => {
    const isVisible = (element) => {
      if (!(element instanceof Element)) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      const closedDetails = element.closest('details:not([open])');
      if (closedDetails && !element.closest('summary')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const shortSelector = (element) => {
      if (element.id) return `#${element.id}`;
      const dataKey = ['data-evolution-step', 'data-proposal-check', 'data-outline-index']
        .find((key) => element.hasAttribute(key));
      if (dataKey) return `${element.tagName.toLowerCase()}[${dataKey}="${element.getAttribute(dataKey)}"]`;
      const classes = [...element.classList].slice(0, 2).join('.');
      return `${element.tagName.toLowerCase()}${classes ? `.${classes}` : ''}`;
    };
    const collect = () => {
      const result = [];
      const elements = [...document.querySelectorAll('body *')];
      for (const element of elements) {
        if (!isVisible(element)) continue;
        for (const node of element.childNodes) {
          if (node.nodeType !== Node.TEXT_NODE) continue;
          const text = String(node.nodeValue || '').replace(/\s+/g, ' ').trim();
          if (text) result.push({ surface: surfaceName, state: stateName, selector: shortSelector(element), kind: 'text', text });
        }
        for (const attribute of ['aria-label', 'title', 'placeholder', 'data-tip']) {
          const text = String(element.getAttribute(attribute) || '').replace(/\s+/g, ' ').trim();
          if (text) result.push({ surface: surfaceName, state: stateName, selector: shortSelector(element), kind: attribute, text });
        }
        if (element instanceof HTMLSelectElement) {
          for (const option of element.options) {
            const text = String(option.textContent || '').replace(/\s+/g, ' ').trim();
            if (text) result.push({ surface: surfaceName, state: stateName, selector: `${shortSelector(element)} option`, kind: 'option', text });
          }
        }
      }
      return result;
    };

    const defaultCandidates = collect();
    if (!openDetails) return defaultCandidates;
    const changed = [];
    // Some customer-facing controls are nested (for example, proposal content
    // inside the proposal drawer). Open one visible layer at a time so the
    // language gate audits everything a user can reveal, not only top-level
    // summaries.
    for (let pass = 0; pass < 4; pass += 1) {
      let opened = 0;
      for (const details of document.querySelectorAll('details')) {
        if (details.open || !isVisible(details.querySelector('summary') || details)) continue;
        details.open = true;
        changed.push(details);
        opened += 1;
      }
      if (!opened) break;
    }
    const expandedCandidates = collect();
    changed.reverse().forEach((details) => { details.open = false; });
    return [...defaultCandidates, ...expandedCandidates];
  }, { surfaceName: surface, stateName: state, openDetails: Boolean(options.openDetails) });
}

async function collectPageMetrics(page) {
  return page.evaluate(() => {
    const isVisible = (element) => {
      if (!(element instanceof Element)) return false;
      if (element.closest('[hidden], [aria-hidden="true"]')) return false;
      const closedDetails = element.closest('details:not([open])');
      if (closedDetails && !element.closest('summary')) return false;
      const style = getComputedStyle(element);
      if (style.display === 'none' || style.visibility === 'hidden' || Number(style.opacity) === 0) return false;
      const rect = element.getBoundingClientRect();
      return rect.width > 0 && rect.height > 0;
    };
    const nameOf = (element) => {
      const labelledBy = String(element.getAttribute('aria-labelledby') || '')
        .split(/\s+/)
        .filter(Boolean)
        .map((id) => document.getElementById(id)?.textContent || '')
        .join(' ');
      const labels = element.labels ? [...element.labels].map((label) => label.innerText || '').join(' ') : '';
      const explicitLabel = element.id ? document.querySelector(`label[for="${CSS.escape(element.id)}"]`)?.innerText || '' : '';
      return String(
        element.getAttribute('aria-label')
        || labelledBy
        || labels
        || explicitLabel
        || element.innerText
        || element.textContent
        || element.getAttribute('alt')
        || element.getAttribute('title')
        || ''
      ).replace(/\s+/g, ' ').trim();
    };
    const visibleNavs = [...document.querySelectorAll('nav,[role="navigation"]')]
      .filter(isVisible)
      .map((element) => ({
        selector: element.id ? `#${element.id}` : `.${[...element.classList].join('.')}`,
        label: element.getAttribute('aria-label') || '',
        primary: element.hasAttribute('data-simulator-evolution-rail')
      }));
    const journeySurfaces = [...new Set([
      ...document.querySelectorAll('nav,[role="navigation"],[data-v8-stagebar],.bf-v8-stagebar')
    ])]
      .filter(isVisible)
      .map((element) => ({
        selector: element.id ? `#${element.id}` : `.${[...element.classList].join('.')}`,
        label: element.getAttribute('aria-label') || '',
        primary: element.hasAttribute('data-simulator-evolution-rail')
      }));
    const visibleSteps = [...document.querySelectorAll('.step-section')].filter(isVisible).map((element) => element.id);
    const currentSteps = [...document.querySelectorAll('[aria-current="step"]')].map((element) => ({
      text: String(element.innerText || '').trim(),
      inPrimaryNavigation: Boolean(element.closest('[data-simulator-evolution-rail]'))
    }));
    const visibleH1 = [...document.querySelectorAll('h1')].filter(isVisible).map((element) => element.innerText.trim());
    const visibleActions = [...document.querySelectorAll('button,summary,a[href]')]
      .filter(isVisible)
      .map((element) => nameOf(element))
      .filter(Boolean);
    const unnamed = [...document.querySelectorAll('button,summary,a[href],input:not([type="hidden"]),select,textarea')]
      .filter(isVisible)
      .filter((element) => !nameOf(element))
      .map((element) => element.outerHTML.slice(0, 220));
    const undersized = [...document.querySelectorAll('button,summary,input:not([type="hidden"]),select,textarea')]
      .filter(isVisible)
      .map((element) => {
        const rect = element.getBoundingClientRect();
        return { name: nameOf(element).slice(0, 80), width: Math.round(rect.width), height: Math.round(rect.height) };
      })
      .filter((item) => item.width < 24 || item.height < 24);
    return {
      visibleNavs,
      journeySurfaces,
      visibleSteps,
      currentSteps,
      visibleH1,
      visibleActions,
      unnamed,
      undersized,
      viewport: { width: innerWidth, height: innerHeight },
      widths: {
        document: document.documentElement.scrollWidth,
        body: document.body.scrollWidth,
        viewport: innerWidth
      },
      horizontalOverflow: document.documentElement.scrollWidth > innerWidth + 1 || document.body.scrollWidth > innerWidth + 1
    };
  });
}

function expectedContextualActionFailure(step, actionName) {
  const text = normalizeText(actionName);
  if (step <= 5) return /\b(?:calcular|pdf|publicar|imprimir)\b/u.test(text);
  if (step === 6) return /\b(?:pdf|publicar|imprimir)\b/u.test(text);
  if (step >= 7 && step <= 9) return /\b(?:pdf|publicar|imprimir)\b/u.test(text);
  return false;
}

function pickProjectItem(item = {}) {
  return {
    itemId: item.itemId || '',
    codigoGrupo: item.codigoGrupo || '',
    quantidadeCotas: Number(item.quantidadeCotas || 0),
    valorCartaUnitario: Number(item.valorCartaUnitario || 0),
    valorCartaTotal: Number(item.valorCartaTotal || 0),
    prazoMeses: Number(item.prazoMeses || 0),
    mesContemplacaoAlvo: Number(item.mesContemplacaoAlvo || 0),
    lanceProprioPct: Number(item.lanceProprioPct || 0),
    lanceEmbutidoPct: Number(item.lanceEmbutidoPct || 0),
    indiceCorrecaoNome: item.indiceCorrecaoNome || '',
    indiceReajuste: Number(item.indiceReajuste || 0),
    mesAniversario: Number(item.mesAniversario || 0),
    modalidadeLance: item.modalidadeLance || ''
  };
}

function pickEngineItem(item = {}) {
  const simulation = item.result || item.simulation || {};
  const summary = simulation.resumo || {};
  const schedule = Array.isArray(simulation.cronograma)
    ? simulation.cronograma
    : (Array.isArray(summary.cronograma) ? summary.cronograma : []);
  const pickRow = (month) => {
    const row = schedule.find((entry) => Number(entry?.mes) === month);
    if (!row) return null;
    return {
      mes: Number(row.mes),
      indiceAplicado: Number(row.indiceAplicado || 0),
      reajusteValor: Number(row.reajusteValor || 0),
      valorLance: Number(row.valorLance || 0),
      valorLanceCaixa: Number(row.valorLanceCaixa || 0),
      valorAdiantado: Number(row.valorAdiantado || 0),
      prazoRestante: Number(row.prazoRestante || 0),
      prazoRestanteApos: Number(row.prazoRestanteApos || 0),
      evento: row.evento || '',
      eventos: Array.isArray(row.eventos) ? row.eventos : [],
      observacao: row.observacao || ''
    };
  };
  const last = schedule[schedule.length - 1] || {};
  return {
    itemId: item.itemId || '',
    codigoGrupo: item.codigoGrupo || '',
    scheduleLength: schedule.length,
    last: {
      mes: Number(last.mes || 0),
      prazoRestante: Number(last.prazoRestante || 0),
      prazoRestanteApos: Number(last.prazoRestanteApos || 0),
      saldoTotalFinal: Number(last.saldoTotalFinal ?? last.saldoFinal ?? 0)
    },
    summary: {
      valorCarta: Number(summary.valorCarta || 0),
      prazoTotal: Number(summary.prazoTotal || 0),
      mesContemplacao: Number(summary.mesContemplacao || 0),
      lanceProprio: Number(summary.lanceProprio || 0),
      lanceEmbutido: Number(summary.lanceEmbutido || 0),
      lanceProprioSelecionado: Number(summary.lanceProprioSelecionado || 0),
      lanceEmbutidoSelecionado: Number(summary.lanceEmbutidoSelecionado || 0),
      lanceTotal: Number(summary.lanceTotal || 0),
      lanceAplicado: Number(summary.lanceAplicado || 0),
      lanceCaixa: Number(summary.lanceCaixa || 0),
      totalAdiantado: Number(summary.totalAdiantado || 0)
    },
    rows: { 12: pickRow(12), 18: pickRow(18), 24: pickRow(24) }
  };
}

function summarizePublicationPayload(payload = {}) {
  const simulation = payload.result?.simulation || {};
  const proposalData = payload.result?.proposalData || {};
  const schedule = Array.isArray(simulation.cronograma)
    ? simulation.cronograma
    : (Array.isArray(simulation.resumo?.cronograma) ? simulation.resumo.cronograma : []);
  return {
    projectItems: (payload.project?.items || []).map(pickProjectItem),
    projectEvents: {
      advances: payload.project?.events?.advances || [],
      delinquencies: payload.project?.events?.delinquencies || []
    },
    engineItems: (simulation.projectItems || []).map(pickEngineItem),
    diagnostics: simulation.diagnostics || {},
    aggregate: {
      scheduleLength: schedule.length,
      prazoTotal: Number(simulation.resumo?.prazoTotal || 0),
      lanceProprio: Number(simulation.resumo?.lanceProprio || 0),
      lanceEmbutido: Number(simulation.resumo?.lanceEmbutido || 0),
      lanceTotal: Number(simulation.resumo?.lanceTotal || 0),
      cartaLiquida: Number(simulation.resumo?.cartaLiquida || 0),
      rows: Object.fromEntries([12, 18, 24].map((month) => {
        const row = schedule.find((entry) => Number(entry?.mes) === month) || null;
        return [month, row ? {
          mes: Number(row.mes),
          indiceAplicado: Number(row.indiceAplicado || 0),
          valorLance: Number(row.valorLance || 0),
          valorAdiantado: Number(row.valorAdiantado || 0),
          prazoRestante: Number(row.prazoRestante || 0),
          evento: row.evento || '',
          observacao: row.observacao || ''
        } : null];
      }))
    },
    proposal: {
      idPresent: Boolean(proposalData.id),
      projectItems: (proposalData.projectItems || []).map(pickProjectItem),
      scheduleLength: Array.isArray(proposalData.schedule) ? proposalData.schedule.length : 0,
      contributions: proposalData.contributions || {},
      metrics: proposalData.metrics || {},
      lances: proposalData.lances || {}
    }
  };
}

async function runAdversarialScenario({ context, attachDiagnostics }) {
  const evidence = {
    executed: false,
    scenario: {
      groups: [
        { key: 'A', prazoMeses: 72, mesContemplacaoAlvo: 12, lanceProprioPct: 10, lanceEmbutidoPct: 0, indiceReajuste: 4.25, mesAniversario: 12, modalidadeLabel: 'Próprio' },
        { key: 'B', prazoMeses: 80, mesContemplacaoAlvo: 18, lanceProprioPct: 7.5, lanceEmbutidoPct: 15, indiceReajuste: 6.5, mesAniversario: 12, modalidadeLabel: 'Combinado' }
      ],
      projectAdvance: { mes: 24, valor: 5000, qtdParcelas: 1, tipo: 'reduzir_saldo' }
    },
    controls: [],
    payload: null,
    localProposal: {},
    publication: { attempted: false, revoked: false },
    public: {}
  };
  const candidates = [];
  let page;
  let publicPage;
  let shareId = '';
  let token = '';

  try {
    const authEmail = process.env.BF_V10_AUTH_EMAIL || 'consultor@bankfratern.local';
    const authPassword = process.env.BF_V10_AUTH_PASSWORD || 'Consultor@123';
    const bootstrapResponse = await fetch(`${baseUrl}/api/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ email: authEmail, password: authPassword }),
      signal: AbortSignal.timeout(5000)
    });
    const bootstrapLogin = await bootstrapResponse.json().catch(() => ({}));
    evidence.authBootstrap = { ok: bootstrapResponse.ok && bootstrapLogin?.ok === true, status: bootstrapResponse.status };
    if (!evidence.authBootstrap.ok || !bootstrapLogin?.session?.token) {
      throw new Error(`Autenticação de teste indisponível (HTTP ${bootstrapResponse.status}).`);
    }
    await context.addInitScript(({ key, session }) => {
      try {
        localStorage.setItem(key, JSON.stringify(session));
      } catch (error) {
        // about:blank has no storage origin; the script runs again on navigation.
      }
    }, { key: 'bf_backend_session_v1', session: bootstrapLogin.session });

    page = await context.newPage();
    attachDiagnostics(page, 'simulator-adversarial');
    await page.goto(`${baseUrl}/pages/simulador.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await page.waitForFunction(() => window.App?.carregarExemplo && window.App?.getCurrentProposalData, null, { timeout: 30000 });

    const configured = await page.evaluate(({ groupSpecs, projectAdvance }) => {
      const sessionKey = window.BFBackendApi?.SESSION_KEY || 'bf_backend_session_v1';
      const authenticatedSession = localStorage.getItem(sessionKey);
      localStorage.clear();
      if (authenticatedSession) localStorage.setItem(sessionKey, authenticatedSession);
      window.App.carregarExemplo();
      window.App.goToStep(5, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });

      const normalize = (value) => String(value || '')
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, ' ')
        .trim()
        .toLowerCase();
      const cards = [...document.querySelectorAll('.cart-item-card')];
      if (cards.length !== groupSpecs.length) throw new Error(`Esperados ${groupSpecs.length} grupos; encontrados ${cards.length}.`);

      const setField = (card, field, value) => {
        const control = card.querySelector(`[data-campo="${field}"]`);
        if (!control) throw new Error(`Controle ${field} ausente no grupo ${card.dataset.itemId || '?'}.`);
        if (control instanceof HTMLSelectElement && field === 'modalidadeLance') {
          const option = [...control.options].find((entry) => normalize(entry.textContent) === normalize(value));
          if (!option) throw new Error(`Modalidade ${value} ausente no grupo ${card.dataset.itemId || '?'}.`);
          control.value = option.value;
        } else if (control.type === 'checkbox') {
          control.checked = Boolean(value);
        } else {
          control.value = String(value);
        }
        window.App.onEditarItemProjeto(control);
      };

      cards.forEach((card, index) => {
        const spec = groupSpecs[index];
        setField(card, 'prazoMeses', spec.prazoMeses);
        setField(card, 'mesContemplacaoAlvo', spec.mesContemplacaoAlvo);
        setField(card, 'lanceProprioPct', spec.lanceProprioPct);
        setField(card, 'lanceEmbutidoPct', spec.lanceEmbutidoPct);
        setField(card, 'indiceCorrecaoNome', index === 0 ? 'ipca' : 'incc');
        setField(card, 'indiceReajuste', spec.indiceReajuste);
        setField(card, 'mesAniversario', spec.mesAniversario);
        setField(card, 'modalidadeLance', spec.modalidadeLabel);
      });

      const eventContainer = document.getElementById('adiantamentos-container');
      if (eventContainer) eventContainer.innerHTML = '';
      window.App.addAdiantamentoRow();
      const eventRow = document.querySelector('#adiantamentos-container .adiantamento-row:last-child');
      if (!eventRow) throw new Error('Linha de antecipação não foi criada.');
      eventRow.querySelector('.adiant-mes').value = String(projectAdvance.mes);
      eventRow.querySelector('.adiant-valor').value = Number(projectAdvance.valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
      eventRow.querySelector('.adiant-qtd').value = String(projectAdvance.qtdParcelas);
      eventRow.querySelector('.adiant-tipo').value = projectAdvance.tipo;

      window.App.recalcularProjeto();
      window.App.calcular();

      const controls = cards.map((card, index) => {
        const value = (field) => {
          const control = card.querySelector(`[data-campo="${field}"]`);
          return control?.type === 'checkbox' ? Boolean(control.checked) : String(control?.value || '');
        };
        const modality = card.querySelector('[data-campo="modalidadeLance"]');
        return {
          key: groupSpecs[index].key,
          itemId: card.dataset.itemId || '',
          quantidadeCotas: Number(value('quantidadeCotas') || 0),
          valorCartaUnitario: window.App.Format.parseMoney(value('valorCartaUnitario')),
          prazoMeses: Number(value('prazoMeses') || 0),
          mesContemplacaoAlvo: Number(value('mesContemplacaoAlvo') || 0),
          lanceProprioPct: Number(value('lanceProprioPct') || 0),
          lanceEmbutidoPct: Number(value('lanceEmbutidoPct') || 0),
          indiceCorrecaoNome: value('indiceCorrecaoNome'),
          indiceReajuste: Number(value('indiceReajuste') || 0),
          mesAniversario: Number(value('mesAniversario') || 0),
          modalidadeLance: value('modalidadeLance'),
          modalidadeLabel: modality?.selectedOptions?.[0]?.textContent?.trim() || ''
        };
      });

      return {
        controls,
        proposalReady: Boolean(window.App.getCurrentProposalData?.()),
        toastMessages: [...document.querySelectorAll('.toast')].map((item) => item.textContent.trim()).filter(Boolean)
      };
    }, { groupSpecs: evidence.scenario.groups, projectAdvance: evidence.scenario.projectAdvance });

    evidence.controls = configured.controls;
    evidence.configurationMessages = configured.toastMessages;
    candidates.push(...await collectUiCandidates(page, 'simulator-adversarial', 'step-5-configured', { openDetails: true }));
    evidence.step5Metrics = await collectPageMetrics(page);
    if (!configured.proposalReady) throw new Error('O motor não gerou uma proposta para os dois grupos configurados.');

    const compared = await page.evaluate(() => {
      window.App.goToStep(9, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
      const groupA = document.getElementById('compGrupoA');
      const groupB = document.getElementById('compGrupoB');
      if (!groupA || !groupB) throw new Error('Controles da comparação não foram encontrados.');
      groupA.value = '0';
      groupB.value = '1';
      window.App.executarComparacao();
      window.App.goToStep(10, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
      return { releaseIssues: window.App.getProposalReleaseIssues?.() || [] };
    });
    evidence.releaseIssuesBeforeReview = compared.releaseIssues;
    await page.waitForFunction(() => Boolean(document.getElementById('proposalReviewer')), null, { timeout: 10000 });

    const validUntil = new Date(Date.now() + (21 * 24 * 60 * 60 * 1000)).toISOString().slice(0, 10);
    const reviewed = await page.evaluate(({ validity }) => {
      const setValue = (id, value) => {
        const field = document.getElementById(id);
        if (!field) throw new Error(`Campo ${id} ausente na revisão.`);
        field.value = value;
      };
      setValue('proposalReviewer', 'Revisão QA V10');
      setValue('proposalReviewerRole', 'Consultoria');
      setValue('proposalValidUntil', validity);
      setValue('proposalReviewNotes', 'Valores conferidos no cenário multigrupo.');
      ['proposalCheckPremissas', 'proposalCheckCliente', 'proposalCheckDocumentacao'].forEach((id) => {
        const field = document.getElementById(id);
        if (!field) throw new Error(`Checklist ${id} ausente na revisão.`);
        field.checked = true;
      });
      window.App.salvarRevisaoProposta();
      const prepared = window.App.getProposalPublicationPayload?.();
      return {
        acceptanceReady: document.getElementById('proposal-acceptance-panel')?.dataset.proposalAcceptanceReady === 'true',
        releaseIssues: window.App.getProposalReleaseIssues?.() || [],
        prepared
      };
    }, { validity: validUntil });

    evidence.acceptanceReady = reviewed.acceptanceReady;
    evidence.releaseIssuesAfterReview = reviewed.releaseIssues;
    candidates.push(...await collectUiCandidates(page, 'simulator-adversarial', 'step-10-reviewed', { openDetails: true }));
    evidence.localProposal.metrics = await collectPageMetrics(page);
    evidence.localProposal.releaseActions = await page.evaluate(() => {
      const menu = document.querySelector('.proposal-download-menu');
      const wasOpen = Boolean(menu?.open);
      if (menu) menu.open = true;
      const actions = [...document.querySelectorAll('.proposal-download-menu button')]
        .map((button) => String(button.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean);
      if (menu) menu.open = wasOpen;
      return actions;
    });
    evidence.localProposal.groupRows = await page.locator('#proposta-container .ps-project-table tbody tr').allInnerTexts();
    evidence.localProposal.logicalPages = await page.locator('#proposta-container .ps-print-page').count();

    if (!reviewed.prepared?.ok || !reviewed.prepared?.payload) {
      throw new Error(`Payload de publicação bloqueado: ${(reviewed.prepared?.issues || reviewed.releaseIssues || []).join(' | ')}`);
    }
    evidence.payload = summarizePublicationPayload(reviewed.prepared.payload);
    evidence.publication.attempted = true;

    // The local share database is immutable and enforces a unique version 1
    // per owner/proposal. Give every validation run its own proposal lineage so
    // repeated gates do not collide with evidence from an earlier run.
    const publicationPayload = JSON.parse(JSON.stringify(reviewed.prepared.payload));
    const runSuffix = `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`;
    const isolatedProposalId = `${publicationPayload.proposalId || 'PROP-V10'}-V10-${runSuffix}`.slice(0, 120);
    publicationPayload.proposalId = isolatedProposalId;
    if (publicationPayload.result?.proposalData) publicationPayload.result.proposalData.id = isolatedProposalId;

    const lifecycle = await page.evaluate(async ({ payload, email, password }) => {
      const api = window.BFBackendApi;
      if (!api?.authLogin || !api?.createProposalSnapshot) return { ok: false, stage: 'api', error: 'API de proposta indisponível.' };
      try {
        const login = api.readSession?.()?.token ? { ok: true } : await api.authLogin(email, password);
        if (!login?.ok) return { ok: false, stage: 'login', error: login?.message || 'Falha de autenticação.' };
        const created = await api.createProposalSnapshot(payload);
        if (!created?.ok || !created.snapshot?.id) return { ok: false, stage: 'create', error: created?.message || 'Falha ao criar snapshot.' };
        const validated = await api.transitionProposalSnapshot(created.snapshot.id, 'validada', {
          provenance: { validationGate: 'v10-adversarial-browser' }
        });
        if (!validated?.ok || !validated.snapshot?.id) return { ok: false, stage: 'validate', error: validated?.message || 'Falha ao validar snapshot.' };
        const transitioned = await api.transitionProposalSnapshot(validated.snapshot.id, 'revisada', {
          review: payload.review,
          provenance: { reviewGate: 'v10-adversarial-browser' }
        });
        if (!transitioned?.ok || !transitioned.snapshot?.id) return { ok: false, stage: 'review', error: transitioned?.message || 'Falha ao revisar snapshot.' };
        const published = await api.publishProposalSnapshot(transitioned.snapshot.id, 21);
        if (!published?.ok || !published.token || !published.share?.id) {
          return { ok: false, stage: 'publish', error: published?.message || 'Falha ao publicar proposta.' };
        }
        return {
          ok: true,
          login: true,
          createdStatus: created.snapshot.status || '',
          validatedStatus: validated.snapshot.status || '',
          reviewedStatus: transitioned.snapshot.status || '',
          publishedStatus: published.share.status || '',
          shareId: published.share.id,
          token: published.token,
          tokenLength: published.token.length,
          expiresAtPresent: Boolean(published.share.expiresAt)
        };
      } catch (error) {
        return { ok: false, stage: 'exception', error: error?.message || String(error) };
      }
    }, { payload: publicationPayload, email: authEmail, password: authPassword });

    shareId = lifecycle.shareId || '';
    token = lifecycle.token || '';
    evidence.publication = {
      ...evidence.publication,
      ok: lifecycle.ok === true,
      stage: lifecycle.stage || 'published',
      error: lifecycle.error || '',
      login: lifecycle.login === true,
      createdStatus: lifecycle.createdStatus || '',
      validatedStatus: lifecycle.validatedStatus || '',
      reviewedStatus: lifecycle.reviewedStatus || '',
      publishedStatus: lifecycle.publishedStatus || '',
      tokenLength: Number(lifecycle.tokenLength || 0),
      expiresAtPresent: lifecycle.expiresAtPresent === true
    };
    if (!lifecycle.ok || !shareId || !token) throw new Error(`Publicação segura falhou na etapa ${lifecycle.stage || 'desconhecida'}: ${lifecycle.error || 'sem detalhe'}`);

    publicPage = await context.newPage();
    attachDiagnostics(publicPage, 'proposal-public-active');
    await publicPage.goto(`${baseUrl}/pages/proposta.html#${encodeURIComponent(token)}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await publicPage.waitForFunction(() => {
      const proposal = document.querySelector('#public-proposal-container .ps-page');
      const error = document.getElementById('public-proposal-error');
      return Boolean(proposal || (error && !error.hidden));
    }, null, { timeout: 15000 });

    candidates.push(...await collectUiCandidates(publicPage, 'proposal-public-active', 'published', { openDetails: true }));
    evidence.public.metrics = await collectPageMetrics(publicPage);
    evidence.public.loaded = await publicPage.locator('#public-proposal-container .ps-page').count() > 0;
    evidence.public.errorVisible = await publicPage.locator('#public-proposal-error:not([hidden])').count() > 0;
    evidence.public.logicalPages = await publicPage.locator('#public-proposal-container .ps-print-page').count();
    evidence.public.factLabels = await publicPage.locator('.proposal-public-facts dt').allTextContents();
    evidence.public.groupRows = await publicPage.locator('#public-proposal-container .ps-project-table tbody tr').allInnerTexts();
    evidence.public.bodyExcerpt = String(await publicPage.locator('body').innerText()).replace(/\s+/g, ' ').slice(0, 1400);

    evidence.public.snapshot = await publicPage.evaluate(async (opaqueToken) => {
      const response = await window.BFBackendApi?.getPublicProposal?.(opaqueToken);
      const snapshot = response?.snapshot || {};
      const projectItems = Array.isArray(snapshot.project?.items) ? snapshot.project.items : [];
      const proposalItems = Array.isArray(snapshot.result?.proposalData?.projectItems)
        ? snapshot.result.proposalData.projectItems
        : [];
      const pick = (item) => ({
        itemId: item?.itemId || '',
        codigoGrupo: item?.codigoGrupo || '',
        quantidadeCotas: Number(item?.quantidadeCotas || 0),
        valorCartaUnitario: Number(item?.valorCartaUnitario || 0),
        valorCartaTotal: Number(item?.valorCartaTotal || 0),
        prazoMeses: Number(item?.prazoMeses || 0),
        mesContemplacaoAlvo: Number(item?.mesContemplacaoAlvo || 0),
        lanceProprioPct: Number(item?.lanceProprioPct || 0),
        lanceEmbutidoPct: Number(item?.lanceEmbutidoPct || 0),
        indiceCorrecaoNome: item?.indiceCorrecaoNome || '',
        indiceReajuste: Number(item?.indiceReajuste || 0),
        mesAniversario: Number(item?.mesAniversario || 0),
        modalidadeLance: item?.modalidadeLance || ''
      });
      return {
        ok: response?.ok === true,
        readOnly: response?.readOnly === true,
        projectItems: projectItems.map(pick),
        proposalItems: proposalItems.map(pick),
        scheduleLength: Array.isArray(snapshot.result?.proposalData?.schedule) ? snapshot.result.proposalData.schedule.length : 0,
        metrics: snapshot.result?.proposalData?.metrics || {},
        lances: snapshot.result?.proposalData?.lances || {}
      };
    }, token);

    evidence.executed = true;
  } catch (error) {
    evidence.error = error?.message || String(error);
    if (page && !page.isClosed()) {
      try {
        evidence.visibleErrors = await page.locator('.toast, [role="alert"]').allInnerTexts();
      } catch (ignored) {
        evidence.visibleErrors = [];
      }
    }
  } finally {
    if (shareId && page && !page.isClosed()) {
      try {
        const revocation = await page.evaluate(async (id) => window.BFBackendApi?.revokeProposalShare?.(id), shareId);
        evidence.publication.revoked = revocation?.ok === true;
        evidence.publication.revokedStatus = revocation?.share?.status || revocation?.status || '';
      } catch (error) {
        evidence.publication.revocationError = error?.message || String(error);
      }
    }
  }

  return { evidence, candidates };
}

async function browserAudit() {
  const playwright = loadPlaywright();
  if (!playwright.module?.chromium) {
    gaps.push({ area: 'browser', reason: 'Playwright nao foi localizado.', attempts: playwright.errors || [] });
    return { available: false, reason: 'Playwright indisponivel', candidates: playwright.errors || [] };
  }

  let reachable = false;
  try {
    const response = await fetch(`${baseUrl}/pages/simulador.html`, { signal: AbortSignal.timeout(5000) });
    reachable = response.ok;
  } catch (error) {
    gaps.push({ area: 'browser', reason: `Servidor local indisponivel em ${baseUrl}.`, error: error?.message || String(error) });
  }
  if (!reachable) return { available: false, reason: `Servidor indisponivel em ${baseUrl}`, playwrightSource: playwright.source };

  let browser;
  const launchErrors = [];
  try {
    browser = await playwright.module.chromium.launch({ channel: 'msedge', headless: true });
  } catch (edgeError) {
    launchErrors.push({ channel: 'msedge', error: edgeError?.message || String(edgeError) });
    try {
      browser = await playwright.module.chromium.launch({ headless: true });
    } catch (chromiumError) {
      launchErrors.push({ channel: 'chromium', error: chromiumError?.message || String(chromiumError) });
    }
  }
  if (!browser) {
    gaps.push({ area: 'browser', reason: 'Nenhum navegador Playwright pode ser iniciado.', launchErrors });
    return { available: false, reason: 'Falha ao iniciar navegador', playwrightSource: playwright.source, launchErrors };
  }

  const consoleErrors = [];
  const consoleWarnings = [];
  const pageErrors = [];
  const notFound = [];
  const candidates = [];
  const stateMetrics = [];
  const proposalEvidence = {};
  let adversarialEvidence = { executed: false, error: 'Cenário adversarial não executado.' };

  const context = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'pt-BR' });
  const attachDiagnostics = (page, name) => {
    page.on('console', (message) => {
      const entry = { surface: name, text: message.text() };
      if (message.type() === 'error') consoleErrors.push(entry);
      if (message.type() === 'warning' || message.type() === 'warn') consoleWarnings.push(entry);
    });
    page.on('pageerror', (error) => pageErrors.push({ surface: name, text: error?.message || String(error) }));
    page.on('response', (response) => {
      if (response.status() === 404) {
        const sanitizedUrl = response.url()
          .replace(/(\/api\/public\/proposals\/)[^/?#]+/u, '$1[redacted]')
          .replace(/#.*$/u, '#[redacted]');
        notFound.push({ surface: name, url: sanitizedUrl });
      }
    });
  };

  try {
    const simulator = await context.newPage();
    attachDiagnostics(simulator, 'simulator');
    await simulator.goto(`${baseUrl}/pages/simulador.html`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await simulator.waitForFunction(() => window.App?.goToStep, null, { timeout: 30000 });
    await simulator.waitForTimeout(1200);

    for (let step = 1; step <= 10; step += 1) {
      await simulator.evaluate((targetStep) => {
        window.App.goToStep(targetStep, {
          skipValidation: true,
          skipAutoCalculate: true,
          skipAutoSearch: true
        });
      }, step);
      await simulator.waitForTimeout(80);
      candidates.push(...await collectUiCandidates(simulator, 'simulator', `step-${step}`, { openDetails: false }));
      stateMetrics.push({ step, ...await collectPageMetrics(simulator), viewportLabel: '1440x900' });
    }

    try {
      await simulator.evaluate(async () => {
        window.App.carregarExemplo?.();
        await window.App.calcular?.();
        window.App.goToStep(7, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
      });
      await simulator.waitForTimeout(250);
      candidates.push(...await collectUiCandidates(simulator, 'simulator', 'result-calculated', { openDetails: false }));
      stateMetrics.push({ step: 7, state: 'result-calculated', ...await collectPageMetrics(simulator), viewportLabel: '1440x900' });
      await simulator.evaluate(() => {
        window.App.goToStep(10, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true });
      });
      await simulator.waitForTimeout(250);
      candidates.push(...await collectUiCandidates(simulator, 'simulator', 'proposal-calculated', { openDetails: true }));
      stateMetrics.push({ step: 10, state: 'proposal-calculated', ...await collectPageMetrics(simulator), viewportLabel: '1440x900' });
    } catch (error) {
      gaps.push({ area: 'browser.proposal-calculated', reason: error?.message || String(error) });
    }

    try {
      const renderedProposal = await simulator.evaluate(() => {
        if (typeof ProposalSummary === 'undefined' || !ProposalSummary.createMockData || !ProposalSummary.render) return null;
        const createData = () => {
          const source = ProposalSummary.createMockData();
          source.metrics = { ...(source.metrics || {}), prazoRestante: 66 };
          source.contributions = { ...(source.contributions || {}), parcelasRestantes: 84, parcelasTotais: 84 };
          return source;
        };
        const renderSurface = (surface) => {
          const target = document.createElement('div');
          ProposalSummary.render(target, { proposalData: createData() }, {
            rootId: `v10-language-proposal-${surface}`,
            chartPrefix: `v10-language-proposal-${surface}`,
            surface
          });
          const text = target.textContent || '';
          return {
            text,
            pages: target.querySelectorAll('.ps-print-page').length,
            decisionBlocks: target.querySelectorAll('.ps-section--decision').length,
            acceptanceBlocks: target.querySelectorAll('.ps-section--acceptance').length,
            decisionHeading: String(target.querySelector('.ps-section--decision .ps-section__head h3')?.textContent || '').replace(/\s+/g, ' ').trim(),
            documentActions: [...target.querySelectorAll('button')].map((button) => String(button.textContent || '').replace(/\s+/g, ' ').trim()).filter(Boolean),
            remainingValues: [...target.querySelectorAll('.ps-kpi')]
              .filter((card) => /parcelas restantes/i.test(card.querySelector('.ps-kpi__label')?.textContent || ''))
              .map((card) => String(card.querySelector('strong')?.textContent || '').replace(/\s+/g, ' ').trim())
          };
        };
        const target = document.createElement('div');
        ProposalSummary.render(target, { proposalData: createData() }, {
          rootId: 'v10-language-proposal-root',
          chartPrefix: 'v10-language-proposal',
          surface: 'validation'
        });
        return {
          text: target.textContent || '',
          pages: target.querySelectorAll('.ps-print-page').length,
          surfaces: {
            summary: renderSurface('summary'),
            proposal: renderSurface('proposal'),
            public: renderSurface('public')
          }
        };
      });
      proposalEvidence.rendered = Boolean(renderedProposal);
      proposalEvidence.logicalPages = renderedProposal?.pages || 0;
      proposalEvidence.surfaceContracts = renderedProposal?.surfaces || {};
      if (renderedProposal?.text) {
        candidates.push({
          surface: 'proposal-generated',
          state: 'mock-render',
          selector: '[data-proposal-summary-root]',
          kind: 'rendered-text',
          text: renderedProposal.text
        });
      }
    } catch (error) {
      gaps.push({ area: 'browser.proposal-generated', reason: error?.message || String(error) });
    }

    for (const viewport of [{ width: 390, height: 844 }, { width: 320, height: 800 }]) {
      await simulator.setViewportSize(viewport);
      await simulator.evaluate(() => window.App.goToStep(1, { skipValidation: true, skipAutoCalculate: true, skipAutoSearch: true }));
      await simulator.waitForTimeout(100);
      stateMetrics.push({ step: 1, ...await collectPageMetrics(simulator), viewportLabel: `${viewport.width}x${viewport.height}` });
    }

    const publicPage = await context.newPage();
    attachDiagnostics(publicPage, 'proposal-public');
    await publicPage.route('**/assets/js/services/backend-api.service.js', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/javascript; charset=utf-8',
        body: `window.BFBackendApi = {
          getPublicProposal: async function () {
            var proposalData = ProposalSummary.createMockData();
            proposalData.metrics = Object.assign({}, proposalData.metrics, { prazoRestante: 66 });
            proposalData.contributions = Object.assign({}, proposalData.contributions, { parcelasRestantes: 84, parcelasTotais: 84 });
            return {
              ok: true,
              snapshot: { result: { proposalData: proposalData, builder: {} }, review: {} },
              expiresAt: '2030-12-31T23:59:59.000Z'
            };
          }
        };`
      });
    });
    const validationToken = 'V'.repeat(48);
    await publicPage.goto(`${baseUrl}/pages/proposta.html#${validationToken}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await publicPage.waitForSelector('#public-proposal-actions:not([hidden])', { timeout: 10000 });
    await publicPage.waitForSelector('#public-proposal-export-root', { timeout: 10000 });
    candidates.push(...await collectUiCandidates(publicPage, 'proposal-public', 'valid-proposal', { openDetails: false }));
    proposalEvidence.publicMetrics = await collectPageMetrics(publicPage);
    proposalEvidence.factLabels = await publicPage.locator('.proposal-public-facts dt').allTextContents();
    proposalEvidence.publicBodyText = await publicPage.locator('body').innerText();
    proposalEvidence.publicContract = await publicPage.evaluate(() => ({
      actionLabels: [...document.querySelectorAll('#public-proposal-actions button')]
        .map((button) => String(button.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      documentActions: [...document.querySelectorAll('#public-proposal-export-root button')]
        .map((button) => String(button.textContent || '').replace(/\s+/g, ' ').trim())
        .filter(Boolean),
      decisionBlocks: document.querySelectorAll('#public-proposal-export-root .ps-section--decision').length,
      acceptanceBlocks: document.querySelectorAll('#public-proposal-export-root .ps-section--acceptance').length,
      decisionHeading: String(document.querySelector('#public-proposal-export-root .ps-section--decision .ps-section__head h3')?.textContent || '').replace(/\s+/g, ' ').trim(),
      remainingValues: [...document.querySelectorAll('#public-proposal-export-root .ps-kpi')]
        .filter((card) => /parcelas restantes/i.test(card.querySelector('.ps-kpi__label')?.textContent || ''))
        .map((card) => String(card.querySelector('strong')?.textContent || '').replace(/\s+/g, ' ').trim())
    }));
    await publicPage.evaluate(() => {
      window.__v10PrintCalls = 0;
      window.print = () => { window.__v10PrintCalls += 1; };
    });
    await publicPage.getByRole('button', { name: 'Imprimir ou salvar em PDF' }).click();
    proposalEvidence.publicContract.printCalls = await publicPage.evaluate(() => window.__v10PrintCalls || 0);
    await publicPage.setViewportSize({ width: 390, height: 844 });
    proposalEvidence.publicMobileMetrics = await collectPageMetrics(publicPage);

    const adversarial = await runAdversarialScenario({ context, attachDiagnostics });
    adversarialEvidence = adversarial.evidence;
    candidates.push(...adversarial.candidates);
  } finally {
    await context.close();
    await browser.close();
  }

  return {
    available: true,
    baseUrl,
    playwrightSource: playwright.source,
    candidates,
    stateMetrics,
    proposalEvidence,
    adversarialEvidence,
    diagnostics: { consoleErrors, consoleWarnings, pageErrors, notFound }
  };
}

const simulatorHtml = await read('pages/simulador.html');
const publicHtml = await read('pages/proposta.html');
const proposalSummaryJs = await read('js/proposal-summary.js');
const proposalPublicJs = await read('js/proposal-public.js');
const exportJs = await read('js/export.js');
const sourceWithoutComments = stripComments(simulatorHtml);
const expectedSteps = Array.from({ length: 10 }, (_, index) => index + 1);
const sectionSteps = [...sourceWithoutComments.matchAll(/<section\b[^>]*\bid=["']step-(\d+)["'][^>]*>/gi)].map((match) => Number(match[1]));
const railSteps = [...sourceWithoutComments.matchAll(/\bdata-evolution-step=["'](\d+)["']/gi)].map((match) => Number(match[1]));
const headingSteps = unique([...sourceWithoutComments.matchAll(/Etapa\s+(\d+)\s+de\s+10/gi)].map((match) => Number(match[1]))).sort((a, b) => a - b);

addCheck(
  'v9.functional-sections',
  'As 10 secoes funcionais V9 permanecem uma vez e na ordem correta.',
  orderedExactly(sectionSteps, expectedSteps),
  { found: sectionSteps, expected: expectedSteps }
);
addCheck(
  'v9.primary-rail-contract',
  'O trilho primario preserva as 10 etapas V9 uma vez e na ordem correta.',
  orderedExactly(railSteps, expectedSteps),
  { found: railSteps, expected: expectedSteps }
);
addCheck(
  'v9.step-heading-contract',
  'A numeracao de etapa cobre 1 a 10.',
  orderedExactly(headingSteps, expectedSteps),
  { found: headingSteps, expected: expectedSteps }
);

let v9Report = null;
try {
  v9Report = JSON.parse(await fs.readFile(path.join(root, 'docs/test-reports/simulator-evolution-v9-report.json'), 'utf8'));
} catch (error) {
  gaps.push({ area: 'v9.report', reason: error?.message || String(error) });
}
addCheck(
  'v9.last-complete-report',
  'O ultimo relatorio completo V9 permanece aprovado.',
  v9Report?.status === 'PASS' && Number(v9Report?.summary?.failed || 0) === 0,
  v9Report ? { status: v9Report.status, summary: v9Report.summary, note: 'Relatorio existente lido sem reescreve-lo.' } : { missing: true }
);

addCheck(
  'source.public-route-present',
  'A pagina publica e a pagina do simulador estao disponiveis no codigo-fonte.',
  simulatorHtml.length > 0 && publicHtml.length > 0,
  { simulatorBytes: simulatorHtml.length, publicBytes: publicHtml.length }
);

const publicActionsContainer = publicHtml.match(/<(div|nav)\b[^>]*\bid=["']public-proposal-actions["'][^>]*>([\s\S]*?)<\/\1>/i);
const publicActionsMarkup = publicActionsContainer?.[2] || '';
const publicActionLabels = [...publicActionsMarkup.matchAll(/<button\b[^>]*>([\s\S]*?)<\/button>/gi)]
  .map((match) => String(match[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean);
const finalPrintLabels = [...simulatorHtml.matchAll(/<button\b[^>]*\bid=["']btn-export-pdf["'][^>]*>([\s\S]*?)<\/button>/gi)]
  .map((match) => String(match[1] || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim())
  .filter(Boolean);
addCheck(
  'proposal-public.single-honest-print-action',
  'A proposta publica oferece uma unica acao, com rotulo honesto para impressao ou PDF.',
  publicActionLabels.length === 1
    && publicActionLabels[0] === 'Imprimir ou salvar em PDF'
    && !/public-proposal-pdf/.test(publicHtml + proposalPublicJs),
  { publicActionLabels, legacyPdfControlPresent: /public-proposal-pdf/.test(publicHtml + proposalPublicJs) }
);
addCheck(
  'proposal-public.no-internal-review-binding',
  'A pagina publica nao entrega o registro interno de revisao ao renderizador do cliente.',
  !/snapshot\.review/.test(proposalPublicJs),
  { internalReviewBindingPresent: /snapshot\.review/.test(proposalPublicJs) }
);
addCheck(
  'proposal.pdf-final-only-source',
  'A acao de PDF pertence a etapa final e nao e duplicada dentro do documento.',
  finalPrintLabels.length === 1
    && finalPrintLabels[0] === 'Imprimir ou salvar em PDF'
    && !/>\s*Baixar PDF\s*</i.test(proposalSummaryJs + publicHtml + simulatorHtml),
  {
    finalPrintLabels,
    legacyDownloadLabels: [...(proposalSummaryJs + publicHtml + simulatorHtml).matchAll(/>\s*Baixar PDF\s*</gi)].length
  }
);
addCheck(
  'proposal.print-flow-honest',
  'O fluxo rotulado como impressao usa a janela nativa para imprimir ou salvar em PDF.',
  /printWindow\.print\(\)/.test(exportJs)
    && /imprimir ou salvar em PDF/i.test(publicHtml + simulatorHtml)
    && !/Permita a abertura da janela de impressao/.test(exportJs),
  { nativePrint: /printWindow\.print\(\)/.test(exportJs) }
);

const browser = await browserAudit();
addCheck(
  'browser.execution',
  'O gate dinamico foi executado em navegador real.',
  browser.available,
  { baseUrl, playwrightSource: browser.playwrightSource || '', reason: browser.reason || '', gaps }
);

if (browser.available) {
  const simulatorMetrics = browser.stateMetrics.filter((item) => item.viewportLabel === '1440x900' && !item.state);
  const navigationMetrics = browser.stateMetrics.filter((item) => !item.state);
  const navigationFailures = navigationMetrics.filter((item) => (
    item.visibleNavs.filter((nav) => nav.primary).length !== 1
    || item.journeySurfaces.length !== 1
    || item.visibleSteps.length !== 1
    || item.currentSteps.length !== 1
    || item.currentSteps.some((current) => !current.inPrimaryNavigation)
  ));
  addCheck(
    'navigation.single-progressive-navigation',
    'Cada estado possui uma navegacao primaria, uma secao visivel e um aria-current.',
    simulatorMetrics.length === 10 && navigationFailures.length === 0,
    {
      statesChecked: navigationMetrics.length,
      failures: navigationFailures.map((item) => ({
        step: item.step,
        viewport: item.viewportLabel,
        visibleNavs: item.visibleNavs,
        journeySurfaces: item.journeySurfaces,
        visibleSteps: item.visibleSteps,
        currentSteps: item.currentSteps
      }))
    }
  );

  const actionFailures = browser.stateMetrics.flatMap((item) => item.visibleActions
    .filter((name) => expectedContextualActionFailure(item.step, name))
    .map((name) => ({ step: item.step, viewport: item.viewportLabel, action: name })));
  addCheck(
    'navigation.contextual-actions',
    'Calculo, PDF, impressao e publicacao aparecem somente no momento adequado.',
    actionFailures.length === 0,
    { failures: actionFailures }
  );

  const h1Failures = browser.stateMetrics.filter((item) => item.visibleH1.length !== 1);
  addCheck(
    'a11y.one-visible-h1',
    'Simulador e proposta publica exibem exatamente um H1.',
    h1Failures.length === 0 && browser.proposalEvidence.publicMetrics?.visibleH1?.length === 1,
    {
      simulatorFailures: h1Failures.map((item) => ({ step: item.step, viewport: item.viewportLabel, h1: item.visibleH1 })),
      publicH1: browser.proposalEvidence.publicMetrics?.visibleH1 || []
    }
  );

  const unnamed = browser.stateMetrics.flatMap((item) => item.unnamed.map((html) => ({ step: item.step, viewport: item.viewportLabel, html })));
  addCheck(
    'a11y.accessible-names',
    'Controles visiveis possuem nome acessivel.',
    unnamed.length === 0,
    { failures: unnamed.slice(0, 40), total: unnamed.length }
  );

  const undersized = browser.stateMetrics
    .filter((item) => item.viewportLabel === '390x844' || item.viewportLabel === '320x800')
    .flatMap((item) => item.undersized.map((control) => ({ viewport: item.viewportLabel, ...control })));
  addCheck(
    'a11y.minimum-target-size',
    'Controles moveis respeitam o minimo WCAG de 24 por 24 pixels.',
    undersized.length === 0,
    { failures: undersized.slice(0, 40), total: undersized.length }
  );

  const overflowFailures = [
    ...browser.stateMetrics.filter((item) => item.horizontalOverflow).map((item) => ({ surface: 'simulator', step: item.step, viewport: item.viewportLabel, widths: item.widths })),
    ...(browser.proposalEvidence.publicMobileMetrics?.horizontalOverflow
      ? [{ surface: 'proposal-public', viewport: '390x844', widths: browser.proposalEvidence.publicMobileMetrics.widths }]
      : [])
  ];
  addCheck(
    'responsive.no-horizontal-overflow',
    'Simulador e proposta publica nao criam rolagem horizontal nos viewports testados.',
    overflowFailures.length === 0,
    { failures: overflowFailures }
  );

  const languageFindings = findOccurrences(browser.candidates, languageRules);
  const languageByCategory = Object.groupBy
    ? Object.groupBy(languageFindings, (finding) => finding.category)
    : languageFindings.reduce((groups, finding) => {
      (groups[finding.category] ||= []).push(finding);
      return groups;
    }, {});
  for (const [category, title] of [
    ['ai', 'Nao ha linguagem de IA nas superficies destinadas ao usuario.'],
    ['internal', 'Nao ha termos de implementacao nas superficies destinadas ao usuario.'],
    ['filler', 'Nao ha narracao abstrata ou instrucoes desnecessarias na interface.']
  ]) {
    const findings = languageByCategory[category] || [];
    addCheck(`language.no-${category}`, title, findings.length === 0, { findings: findings.slice(0, 80), total: findings.length });
  }

  const accentFindings = findAccentOccurrences(browser.candidates);
  addCheck(
    'language.portuguese-diacritics',
    'O português visível preserva a acentuação de termos comuns da jornada.',
    accentFindings.length === 0,
    { findings: accentFindings.slice(0, 100), total: accentFindings.length }
  );

  const artifactFindings = findOccurrences(browser.candidates, artifactRules);
  addCheck(
    'quality.no-render-artifacts',
    'Nao ha undefined, null, NaN, Infinity, objetos serializados ou texto corrompido no DOM de usuario.',
    artifactFindings.length === 0,
    { findings: artifactFindings.slice(0, 80), total: artifactFindings.length }
  );

  const internalFactLabels = (browser.proposalEvidence.factLabels || []).filter((label) => (
    /^(?:motor|base|versao|schema|snapshot)$/u.test(normalizeText(label))
  ));
  addCheck(
    'proposal-public.no-internal-metadata',
    'A proposta publica nao apresenta Motor, Base, Versao, schema ou snapshot como metadados do cliente.',
    internalFactLabels.length === 0,
    { labels: browser.proposalEvidence.factLabels || [], forbidden: internalFactLabels }
  );

  addCheck(
    'proposal-public.required-caveat',
    'A proposta publica preserva o aviso de que a contemplacao nao e garantida.',
    /contemplacao nao (?:e )?garantida|nao garante contemplacao/u.test(normalizeText(browser.proposalEvidence.publicBodyText || '')),
    { publicTextExcerpt: String(browser.proposalEvidence.publicBodyText || '').replace(/\s+/g, ' ').slice(0, 500) }
  );

  const publicContract = browser.proposalEvidence.publicContract || {};
  addCheck(
    'proposal-public.runtime-contract',
    'A proposta publica valida renderizacao, conteudo do cliente e impressao em navegador.',
    (publicContract.actionLabels || []).length === 1
      && publicContract.actionLabels[0] === 'Imprimir ou salvar em PDF'
      && (publicContract.documentActions || []).length === 0
      && Number(publicContract.decisionBlocks || 0) === 1
      && Number(publicContract.acceptanceBlocks || 0) === 0
      && publicContract.decisionHeading === 'Pontos de atenção da proposta'
      && (publicContract.remainingValues || []).length === 1
      && publicContract.remainingValues[0] === '84 parcelas'
      && Number(publicContract.printCalls || 0) === 1,
    publicContract
  );

  addCheck(
    'proposal.generated-content',
    'A proposta continua renderizavel com paginas logicas.',
    browser.proposalEvidence.rendered === true && browser.proposalEvidence.logicalPages >= 12 && browser.proposalEvidence.logicalPages <= 16,
    { rendered: browser.proposalEvidence.rendered, logicalPages: browser.proposalEvidence.logicalPages }
  );

  const surfaceContracts = browser.proposalEvidence.surfaceContracts || {};
  const clientSurfaceFailures = ['proposal', 'public'].filter((surface) => {
    const contract = surfaceContracts[surface] || {};
    return Number(contract.decisionBlocks || 0) !== 1
      || Number(contract.acceptanceBlocks || 0) !== 0
      || contract.decisionHeading !== 'Pontos de atenção da proposta'
      || (contract.documentActions || []).length !== 0
      || /antes de enviar|corrija os itens antes de enviar|revisar simulacao/u.test(normalizeText(contract.text || ''));
  });
  addCheck(
    'proposal.client-no-internal-review',
    'Documento final e proposta publica nao exibem a revisao interna do consultor.',
    clientSurfaceFailures.length === 0,
    {
      failures: clientSurfaceFailures,
      surfaces: Object.fromEntries(['summary', 'proposal', 'public'].map((surface) => [surface, {
        decisionBlocks: surfaceContracts[surface]?.decisionBlocks,
        acceptanceBlocks: surfaceContracts[surface]?.acceptanceBlocks,
        decisionHeading: surfaceContracts[surface]?.decisionHeading,
        documentActions: surfaceContracts[surface]?.documentActions
      }]))
    }
  );

  const remainingFailures = ['summary', 'proposal', 'public'].filter((surface) => {
    const contract = surfaceContracts[surface] || {};
    const values = contract.remainingValues || [];
    return values.length !== 1 || values[0] !== '84 parcelas' || /66 meses/u.test(normalizeText(contract.text || ''));
  });
  addCheck(
    'proposal.remaining-installments-consistent',
    'A proposta usa o prazo geral restante de forma consistente em todas as superficies.',
    remainingFailures.length === 0,
    {
      failures: remainingFailures,
      values: Object.fromEntries(['summary', 'proposal', 'public'].map((surface) => [surface, surfaceContracts[surface]?.remainingValues || []]))
    }
  );

  const documentActionFailures = ['proposal', 'public'].filter((surface) => (surfaceContracts[surface]?.documentActions || []).length > 0);
  addCheck(
    'proposal.document-no-duplicate-export-action',
    'O documento nao repete a acao de impressao disponibilizada pela pagina.',
    documentActionFailures.length === 0,
    {
      failures: documentActionFailures,
      actions: Object.fromEntries(['proposal', 'public'].map((surface) => [surface, surfaceContracts[surface]?.documentActions || []]))
    }
  );

  const adversarial = browser.adversarialEvidence || {};
  addCheck(
    'adversarial.browser-publication-executed',
    'O cenário multigrupo completo chegou à proposta pública em navegador real e foi revogado ao final.',
    adversarial.executed === true
      && adversarial.publication?.ok === true
      && adversarial.public?.loaded === true
      && adversarial.public?.snapshot?.ok === true
      && adversarial.public?.snapshot?.readOnly === true
      && adversarial.publication?.revoked === true,
    {
      executed: adversarial.executed === true,
      error: adversarial.error || '',
      visibleErrors: adversarial.visibleErrors || [],
      publication: adversarial.publication || {},
      public: {
        loaded: adversarial.public?.loaded,
        errorVisible: adversarial.public?.errorVisible,
        logicalPages: adversarial.public?.logicalPages,
        snapshotOk: adversarial.public?.snapshot?.ok,
        readOnly: adversarial.public?.snapshot?.readOnly
      }
    }
  );

  const controls = Array.isArray(adversarial.controls) ? adversarial.controls : [];
  const projectItems = Array.isArray(adversarial.payload?.projectItems) ? adversarial.payload.projectItems : [];
  const engineItems = Array.isArray(adversarial.payload?.engineItems) ? adversarial.payload.engineItems : [];
  const proposalItems = Array.isArray(adversarial.payload?.proposal?.projectItems) ? adversarial.payload.proposal.projectItems : [];
  const publicProjectItems = Array.isArray(adversarial.public?.snapshot?.projectItems) ? adversarial.public.snapshot.projectItems : [];
  const publicProposalItems = Array.isArray(adversarial.public?.snapshot?.proposalItems) ? adversarial.public.snapshot.proposalItems : [];
  const controlProjectFailures = [];
  const comparedFields = [
    'quantidadeCotas',
    'valorCartaUnitario',
    'prazoMeses',
    'mesContemplacaoAlvo',
    'lanceProprioPct',
    'lanceEmbutidoPct',
    'indiceReajuste',
    'mesAniversario'
  ];
  for (const control of controls) {
    const project = projectItems.find((item) => item.itemId === control.itemId);
    if (!project) {
      controlProjectFailures.push({ group: control.key, issue: 'Grupo ausente no projeto publicado.', itemId: control.itemId });
      continue;
    }
    for (const field of comparedFields) {
      const equal = field.includes('valor') || field.includes('Pct') || field === 'indiceReajuste'
        ? sameMoney(project[field], control[field])
        : sameNumber(project[field], control[field]);
      if (!equal) controlProjectFailures.push({ group: control.key, field, control: control[field], project: project[field] });
    }
    for (const field of ['indiceCorrecaoNome', 'modalidadeLance']) {
      if (String(project[field] || '') !== String(control[field] || '')) {
        controlProjectFailures.push({ group: control.key, field, control: control[field], project: project[field] });
      }
    }
  }
  addCheck(
    'reconciliation.controls-to-project',
    'Cada controle por grupo chega sem perda ao projeto usado na publicação.',
    controls.length === 2 && projectItems.length === 2 && controlProjectFailures.length === 0,
    { controls, projectItems, failures: controlProjectFailures }
  );

  const engineFailures = [];
  const totalCredit = controls.reduce((sum, item) => sum + (item.valorCartaUnitario * item.quantidadeCotas), 0);
  for (const control of controls) {
    const engine = engineItems.find((item) => item.itemId === control.itemId);
    if (!engine) {
      engineFailures.push({ group: control.key, issue: 'Resultado unitário do motor ausente.', itemId: control.itemId });
      continue;
    }
    const ownNominal = control.valorCartaUnitario * control.lanceProprioPct / 100;
    const embeddedNominal = control.valorCartaUnitario * control.lanceEmbutidoPct / 100;
    const modality = normalizeText(control.modalidadeLabel);
    const selectedOwn = modality === 'proprio' || modality === 'combinado' ? ownNominal : 0;
    const selectedEmbedded = modality === 'embutido' || modality === 'combinado' ? embeddedNominal : 0;
    const contemplation = engine.rows?.[control.mesContemplacaoAlvo];
    const row12 = engine.rows?.[12];
    const row24 = engine.rows?.[24];

    const compare = (field, actual, expected, money = false) => {
      const equal = money ? sameMoney(actual, expected) : sameNumber(actual, expected);
      if (!equal) engineFailures.push({ group: control.key, field, expected, actual });
    };
    compare('valorCarta', engine.summary?.valorCarta, control.valorCartaUnitario, true);
    compare('prazoTotal', engine.summary?.prazoTotal, control.prazoMeses);
    compare('mesContemplacao', engine.summary?.mesContemplacao, control.mesContemplacaoAlvo);
    compare('lanceProprioSelecionado', engine.summary?.lanceProprioSelecionado, selectedOwn, true);
    compare('lanceEmbutidoSelecionado', engine.summary?.lanceEmbutidoSelecionado, selectedEmbedded, true);
    compare('lanceTotal', engine.summary?.lanceTotal, selectedOwn + selectedEmbedded, true);
    compare('lanceAplicado', contemplation?.valorLance, selectedOwn + selectedEmbedded, true);
    compare('lanceCaixa', contemplation?.valorLanceCaixa, selectedOwn, true);
    compare('reajusteMes12', row12?.indiceAplicado, control.indiceReajuste / 100);
    compare('reajusteMes24', row24?.indiceAplicado, control.indiceReajuste / 100);
    compare('adiantamentoMes24', row24?.valorAdiantado, 5000 * (control.valorCartaUnitario / totalCredit), true);
    compare('linhasCronograma', engine.scheduleLength, control.prazoMeses);
    compare('ultimoMes', engine.last?.mes, control.prazoMeses);
    compare('prazoRestanteAposFinal', engine.last?.prazoRestanteApos, 0);
    if (!normalizeText(contemplation?.evento || '').includes('contemplacao')) {
      engineFailures.push({ group: control.key, field: 'eventoContemplacao', expected: control.mesContemplacaoAlvo, actual: contemplation?.evento || '' });
    }
    for (const month of [12, 18, 24]) {
      if (month > control.prazoMeses) continue;
      const row = engine.rows?.[month];
      if (!row) {
        engineFailures.push({ group: control.key, field: `cronogramaMes${month}`, expected: 'linha presente', actual: null });
        continue;
      }
      compare(`prazoRestanteAposMes${month}`, row.prazoRestanteApos, control.prazoMeses - month);
      compare(`prazoRestanteMes${month}`, row.prazoRestante, control.prazoMeses - month + 1);
    }
  }
  addCheck(
    'reconciliation.project-to-engine',
    'Modalidade, lances, reajustes, prazos e antecipação reconciliam por grupo no motor.',
    engineItems.length === 2 && engineFailures.length === 0,
    { engineItems, failures: engineFailures }
  );

  const aggregate = adversarial.payload?.aggregate || {};
  const expectedOwnTotal = controls.reduce((sum, item) => sum + (item.valorCartaUnitario * item.lanceProprioPct / 100), 0);
  const expectedEmbeddedTotal = controls.reduce((sum, item) => (
    sum + (normalizeText(item.modalidadeLabel) === 'combinado' || normalizeText(item.modalidadeLabel) === 'embutido'
      ? item.valorCartaUnitario * item.lanceEmbutidoPct / 100
      : 0)
  ), 0);
  const maxTerm = controls.length ? Math.max(...controls.map((item) => item.prazoMeses)) : 0;
  const aggregateFailures = [];
  const aggregateCompare = (field, actual, expected, money = false) => {
    const equal = money ? sameMoney(actual, expected) : sameNumber(actual, expected);
    if (!equal) aggregateFailures.push({ field, expected, actual });
  };
  aggregateCompare('prazoTotal', aggregate.prazoTotal, maxTerm);
  aggregateCompare('linhasCronograma', aggregate.scheduleLength, maxTerm);
  aggregateCompare('lanceProprio', aggregate.lanceProprio, expectedOwnTotal, true);
  aggregateCompare('lanceEmbutido', aggregate.lanceEmbutido, expectedEmbeddedTotal, true);
  aggregateCompare('lanceTotal', aggregate.lanceTotal, expectedOwnTotal + expectedEmbeddedTotal, true);
  aggregateCompare('lanceMes12', aggregate.rows?.[12]?.valorLance, 6000, true);
  aggregateCompare('lanceMes18', aggregate.rows?.[18]?.valorLance, 9000, true);
  aggregateCompare('adiantamentoMes24', aggregate.rows?.[24]?.valorAdiantado, 5000, true);
  aggregateCompare('prazoProposta', adversarial.payload?.proposal?.contributions?.parcelasTotais, maxTerm);
  aggregateCompare('cronogramaProposta', adversarial.payload?.proposal?.scheduleLength, maxTerm);
  addCheck(
    'reconciliation.timeline-12-18-24',
    'O cronograma consolidado preserva os eventos dos meses 12, 18 e 24 sem duplicar caixa ou contradizer o prazo.',
    controls.length === 2 && aggregateFailures.length === 0,
    {
      expected: { maxTerm, expectedOwnTotal, expectedEmbeddedTotal, month12Bid: 6000, month18Bid: 9000, month24Advance: 5000 },
      aggregate,
      failures: aggregateFailures
    }
  );

  const proposalDataFailures = [];
  const assertProposalItem = (control, item, surface) => {
    if (!item) {
      proposalDataFailures.push({ group: control.key, surface, issue: 'Grupo ausente.' });
      return;
    }
    for (const field of [...comparedFields, 'indiceCorrecaoNome', 'modalidadeLance']) {
      const expected = control[field];
      const actual = item[field];
      const equal = typeof expected === 'number' ? sameNumber(actual, expected) : String(actual || '') === String(expected || '');
      if (!equal) proposalDataFailures.push({ group: control.key, surface, field, expected, actual });
    }
  };
  for (const control of controls) {
    const project = projectItems.find((item) => item.itemId === control.itemId);
    const code = project?.codigoGrupo || '';
    assertProposalItem(control, proposalItems.find((item) => item.itemId === control.itemId || (code && item.codigoGrupo === code)), 'payload.result.proposalData');
    assertProposalItem(control, publicProjectItems.find((item) => item.itemId === control.itemId || (code && item.codigoGrupo === code)), 'public.snapshot.project');
    assertProposalItem(control, publicProposalItems.find((item) => item.itemId === control.itemId || (code && item.codigoGrupo === code)), 'public.snapshot.result.proposalData');
  }
  if (!sameNumber(adversarial.public?.snapshot?.scheduleLength, maxTerm)) {
    proposalDataFailures.push({ surface: 'public.snapshot.result.proposalData', field: 'scheduleLength', expected: maxTerm, actual: adversarial.public?.snapshot?.scheduleLength });
  }
  addCheck(
    'reconciliation.engine-to-proposal-data',
    'A proposta publicada preserva, por grupo, os parâmetros que produziram o cálculo.',
    controls.length === 2
      && proposalItems.length === 2
      && publicProjectItems.length === 2
      && publicProposalItems.length === 2
      && proposalDataFailures.length === 0,
    {
      proposalItems,
      publicProjectItems,
      publicProposalItems,
      publicScheduleLength: adversarial.public?.snapshot?.scheduleLength,
      failures: proposalDataFailures
    }
  );

  const publicRows = Array.isArray(adversarial.public?.groupRows) ? adversarial.public.groupRows : [];
  const disclosureFailures = [];
  const percentagesIn = (text) => [...String(text || '').matchAll(/(\d{1,3}(?:[.,]\d+)?)\s*%/gu)]
    .map((match) => Number(match[1].replace(',', '.')))
    .filter(Number.isFinite);
  for (const control of controls) {
    const project = projectItems.find((item) => item.itemId === control.itemId);
    const row = publicRows.find((text) => normalizeText(text).includes(normalizeText(project?.codigoGrupo || '')));
    if (!row) {
      disclosureFailures.push({ group: control.key, issue: 'Linha visível do grupo ausente.', codigoGrupo: project?.codigoGrupo || '' });
      continue;
    }
    const normalizedRow = normalizeText(row);
    const percents = percentagesIn(row);
    const totalBidPercent = control.lanceProprioPct + control.lanceEmbutidoPct;
    const requirements = [
      { field: 'prazo', ok: new RegExp(`\\b${control.prazoMeses}\\s+meses\\b`, 'u').test(normalizedRow), expected: `${control.prazoMeses} meses` },
      { field: 'contemplacao', ok: normalizedRow.includes('contemplacao') && new RegExp(`\\b${control.mesContemplacaoAlvo}\\b`, 'u').test(normalizedRow), expected: `mês ${control.mesContemplacaoAlvo}` },
      { field: 'modalidade', ok: normalizedRow.includes(normalizeText(control.modalidadeLabel)), expected: control.modalidadeLabel },
      { field: 'lance', ok: percents.some((value) => sameNumber(value, totalBidPercent, 0.005)), expected: `${totalBidPercent}%` },
      { field: 'reajuste', ok: percents.some((value) => sameNumber(value, control.indiceReajuste, 0.005)), expected: `${control.indiceReajuste}%` },
      { field: 'indice', ok: normalizedRow.includes(normalizeText(control.indiceCorrecaoNome)), expected: control.indiceCorrecaoNome.toUpperCase() }
    ];
    requirements.filter((item) => !item.ok).forEach((item) => disclosureFailures.push({ group: control.key, field: item.field, expected: item.expected, row: String(row).replace(/\s+/g, ' ').slice(0, 500) }));
  }
  addCheck(
    'proposal-public.group-contract-disclosure',
    'Cada grupo da proposta pública explica prazo, contemplação, modalidade, lance e reajuste contratados.',
    controls.length === 2 && publicRows.length === 2 && disclosureFailures.length === 0,
    { rows: publicRows.map((row) => String(row).replace(/\s+/g, ' ').trim()), failures: disclosureFailures }
  );

  const localPdfActions = (adversarial.localProposal?.releaseActions || []).filter((label) => /\bpdf\b/u.test(normalizeText(label)));
  const publicPdfActions = (adversarial.public?.metrics?.visibleActions || []).filter((label) => /\bpdf\b/u.test(normalizeText(label)));
  const duplicatePdfActions = [
    ...localPdfActions.filter((label, index) => localPdfActions.indexOf(label) !== index).map((label) => ({ surface: 'simulator-step-10', label })),
    ...publicPdfActions.filter((label, index) => publicPdfActions.indexOf(label) !== index).map((label) => ({ surface: 'proposal-public', label }))
  ];
  addCheck(
    'proposal.pdf-action-once-at-release',
    'A ação de PDF aparece uma única vez no fechamento e uma única vez na página pública, sem duplicação.',
    localPdfActions.length === 1
      && normalizeText(localPdfActions[0]) === 'imprimir ou salvar em pdf'
      && publicPdfActions.length === 1
      && normalizeText(publicPdfActions[0]) === 'imprimir ou salvar em pdf'
      && duplicatePdfActions.length === 0,
    { localPdfActions, publicPdfActions, duplicates: duplicatePdfActions }
  );

  const activePublicCandidates = browser.candidates.filter((candidate) => candidate.surface === 'proposal-public-active');
  const activePublicInternalFindings = findOccurrences(activePublicCandidates, publicInternalRules);
  addCheck(
    'proposal-public.no-internal-customer-content',
    'A proposta pública ativa não mostra termos de implementação, diagnóstico ou ambiente interno ao cliente.',
    activePublicCandidates.length > 0 && activePublicInternalFindings.length === 0,
    { findings: activePublicInternalFindings.slice(0, 80), total: activePublicInternalFindings.length }
  );

  const diagnostics = browser.diagnostics;
  addCheck(
    'quality.console-clean',
    'Navegador sem erros, avisos, excecoes ou respostas 404.',
    diagnostics.consoleErrors.length === 0
      && diagnostics.consoleWarnings.length === 0
      && diagnostics.pageErrors.length === 0
      && diagnostics.notFound.length === 0,
    diagnostics
  );
} else {
  for (const [id, title] of [
    ['navigation.single-progressive-navigation', 'Cada estado possui uma navegacao primaria, uma secao visivel e um aria-current.'],
    ['navigation.contextual-actions', 'Acoes aparecem somente no momento adequado.'],
    ['a11y.one-visible-h1', 'Simulador e proposta publica exibem exatamente um H1.'],
    ['a11y.accessible-names', 'Controles visiveis possuem nome acessivel.'],
    ['a11y.minimum-target-size', 'Controles respeitam o minimo WCAG.'],
    ['responsive.no-horizontal-overflow', 'Nao ha rolagem horizontal.'],
    ['language.no-ai', 'Nao ha linguagem de IA.'],
    ['language.no-internal', 'Nao ha termos internos.'],
    ['language.no-filler', 'Nao ha narracao abstrata.'],
    ['language.portuguese-diacritics', 'O portugues visivel preserva a acentuacao.'],
    ['quality.no-render-artifacts', 'Nao ha artefatos de renderizacao.'],
    ['proposal-public.no-internal-metadata', 'A proposta publica nao apresenta metadados internos.'],
    ['proposal-public.required-caveat', 'A proposta publica preserva o aviso de contemplacao.'],
    ['proposal-public.runtime-contract', 'A proposta publica executa o contrato final em navegador.'],
    ['proposal.generated-content', 'A proposta continua renderizavel.'],
    ['proposal.client-no-internal-review', 'Documento do cliente nao apresenta revisao interna.'],
    ['proposal.remaining-installments-consistent', 'Parcelas restantes permanecem consistentes.'],
    ['proposal.document-no-duplicate-export-action', 'O documento nao repete a acao de exportacao.'],
    ['adversarial.browser-publication-executed', 'O cenario multigrupo chega a proposta publica.'],
    ['reconciliation.controls-to-project', 'Controles reconciliam com o projeto.'],
    ['reconciliation.project-to-engine', 'Projeto reconcilia com o motor por grupo.'],
    ['reconciliation.timeline-12-18-24', 'Cronograma reconcilia os meses 12, 18 e 24.'],
    ['reconciliation.engine-to-proposal-data', 'Motor reconcilia com os dados da proposta publica.'],
    ['proposal-public.group-contract-disclosure', 'Proposta publica explica o contrato de cada grupo.'],
    ['proposal.pdf-action-once-at-release', 'Acao de PDF aparece uma vez no fechamento.'],
    ['proposal-public.no-internal-customer-content', 'Proposta publica nao mostra conteudo interno.'],
    ['quality.console-clean', 'Navegador sem erros ou 404.']
  ]) addCheck(id, title, false, { gap: browser.reason || 'Browser indisponivel' });
}

const passed = checks.filter((check) => check.ok).length;
const failedChecks = checks.filter((check) => !check.ok);
const report = {
  schema: 'bancus.validation.language-navigation-v10.v1',
  validator: 'tools/validate-language-navigation-v10.mjs',
  validatorVersion: '10.2.0',
  generatedAt: new Date().toISOString(),
  status: failedChecks.length === 0 ? 'PASS' : 'FAIL',
  scope: {
    productFilesValidated: [
      'pages/simulador.html',
      'pages/proposta.html',
      'js/proposal-summary.js',
      'js/proposal-public.js',
      'js/export.js',
      'docs/test-reports/simulator-evolution-v9-report.json'
    ],
    filesWritten: [
      'tools/validate-language-navigation-v10.mjs',
      'docs/test-reports/language-navigation-v10-report.json'
    ],
    baseUrl
  },
  execution: {
    browserAvailable: browser.available,
    browserReason: browser.reason || '',
    gaps
  },
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

console.log(`[language-navigation-v10] ${report.status}: ${passed}/${checks.length} checks aprovados.`);
console.log(`[language-navigation-v10] Browser: ${browser.available ? 'executado' : 'indisponivel'}.`);
console.log(`[language-navigation-v10] Relatorio: ${relative(reportPath)}`);
failedChecks.forEach((check) => console.error(`[FAIL] ${check.id}: ${check.title}`));
if (failedChecks.length > 0) process.exitCode = 1;
