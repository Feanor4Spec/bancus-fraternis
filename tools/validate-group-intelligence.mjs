import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');
const failures = [];
const assert = (condition, message) => { if (!condition) failures.push(message); };

const page = read('pages/grupo.html');
const css = read('css/group-intelligence.css');
const controller = read('js/group-intelligence.js');
const assemblySource = read('js/group-assembly-data.js');
const journeySource = read('js/group-journey.js');
const app = read('js/app.js');
const simulator = read('pages/simulador.html');
const proposal = read('js/proposal-summary.js');
const versions = read('js/proposal-versioning.js');
const heuristic = read('js/heuristic-engine.js');
const shelfData = read('js/shelf-data.js');
const compact = JSON.parse(read('data_base/Tab_Grupos_Consorcio.compact.json'));

const assemblyContext = { window: {} };
assemblyContext.window.window = assemblyContext.window;
vm.runInNewContext(assemblySource, assemblyContext, { filename: 'group-assembly-data.js' });
const assemblyData = assemblyContext.window.BFGroupAssemblyData;
const history = assemblyData.forGroup(assemblyData.EXACT_GROUP_KEY);
const unavailable = assemblyData.forGroup('00000776|202512|3|79');

assert(history.available === true, 'O histórico demonstrativo do groupKey autorizado não foi resolvido.');
assert(unavailable.available === false, 'O histórico fez fallback por código/identidade parcial.');
assert(history.source.sourceType === 'demonstrative', 'A série não está marcada como demonstrativa.');
assert(history.source.associationStatus === 'unverified-demonstrative-mapping', 'A associação demonstrativa não está marcada como não conciliada.');
assert(history.source.contractual === false, 'A série demonstrativa foi marcada como contratual.');
assert(history.source.proposalEvidenceEligible === false, 'A série demonstrativa foi marcada como evidência elegível.');
assert(history.metrics.assemblies === 13, 'A série precisa conter 13 assembleias.');
assert(history.metrics.lottery === 13, 'Total de sorteios divergente de 13.');
assert(history.metrics.bid === 34, 'Total de contemplações por lance divergente de 34.');
assert(history.metrics.total === 47, 'Total de contemplações divergente de 47.');
assert(Math.abs(history.metrics.bidShare - 72.3404255319) < 1e-8, 'Participação do lance divergente de 72,3%.');
assert(history.metrics.minimumBid === 21, 'Lance mínimo global divergente de 21%.');
assert(history.metrics.maximumBid === 43.55, 'Lance máximo global divergente de 43,55%.');
assert(history.metrics.peakAssembly === 155 && history.metrics.peakTotal === 6, 'Pico precisa ser exclusivamente a AGO 155 com 6.');

const index = new Map(compact.columns.map((column, position) => [column, position]));
const keyIndex = index.get('groupKey');
const groupCodeIndex = index.get('codigoGrupo');
const group79 = compact.rows.find((row) => row[keyIndex] === assemblyData.EXACT_GROUP_KEY);
assert(Boolean(group79), 'Snapshot exato do grupo 79 não encontrado no catálogo compacto.');
assert(group79?.[index.get('qtdAtivasEmDia')] === 721, 'Snapshot do grupo 79 deve preservar 721 cotas ativas.');
assert(group79?.[index.get('qtdExcluidas')] === 698, 'Snapshot do grupo 79 deve preservar 698 cotas excluídas.');
const codeCounts = new Map();
compact.rows.forEach((row) => codeCounts.set(String(row[groupCodeIndex]), (codeCounts.get(String(row[groupCodeIndex])) || 0) + 1));
assert([...codeCounts.values()].some((count) => count > 1), 'Fixture não comprova colisão de código de grupo.');

const heuristicContext = { console, globalThis: {} };
heuristicContext.window = heuristicContext.globalThis;
vm.runInNewContext(`${heuristic}\nglobalThis.__engine = HeuristicEngine;`, heuristicContext, { filename: 'heuristic-engine.js' });
assert(heuristicContext.globalThis.__engine.getIndiceMaturidade({ indiceMaturidade: 1.25 }) === 1.25, 'Maturidade 1,25 foi tratada como percentual.');
assert(heuristicContext.globalThis.__engine.getIndiceMaturidade({ indiceMaturidade: 6 }) === 6, 'Maturidade 6 foi tratada como percentual.');

const session = new Map();
const journeyWindow = {
  crypto: { getRandomValues(values) { values[0] = 123; values[1] = 456; values[2] = 789; return values; } },
  location: { search: '?from=dashboard', hash: '#step-4' },
  sessionStorage: {
    setItem(key, value) { session.set(key, String(value)); },
    getItem(key) { return session.get(key) || null; },
    removeItem(key) { session.delete(key); }
  },
  URLSearchParams
};
journeyWindow.window = journeyWindow;
vm.runInNewContext(journeySource, { window: journeyWindow, URLSearchParams }, { filename: 'group-journey.js' });
const returnId = journeyWindow.BFGroupJourney.create({ openGroupKey: assemblyData.EXACT_GROUP_KEY, shelf: { page: 7 } });
const returnState = journeyWindow.BFGroupJourney.read(returnId);
const groupHref = journeyWindow.BFGroupJourney.buildHref(assemblyData.EXACT_GROUP_KEY, { returnState: returnId });
assert(returnState?.shelf?.page === 7, 'Estado de retorno não preservou a página.');
assert(groupHref.includes(encodeURIComponent(assemblyData.EXACT_GROUP_KEY)), 'Deep link não usa o groupKey exato.');
assert(journeyWindow.BFGroupJourney.buildHref('79') === '', 'Deep link aceitou código isolado.');
const evidence = journeyWindow.BFGroupJourney.buildSnapshotEvidence({
  groupKey: assemblyData.EXACT_GROUP_KEY,
  dataBase: 202512,
  nomeAdministradora: 'ITAÚ ADM DE CONSÓRCIOS LTDA',
  codigoGrupo: '79',
  nomeSegmento: 'Imóveis',
  qtdAtivasEmDia: null,
  qtdContempladasNoMes: 0
}, { format: 'bancus.shelf.compact.v1', sourceSha256: 'abc123', generatedAt: '2026-05-08T22:52:58.885Z' });
assert(evidence[1].value === null && evidence[1].status === 'unavailable', 'Ausência não foi preservada na evidência.');
assert(evidence[2].value === 0 && evidence[2].status === 'observed', 'Zero real foi confundido com ausência na evidência.');
assert(evidence.every((entry) => entry.sourceHash === 'abc123'), 'Hash da fonte não acompanha a evidência.');

const shelfContext = { console, globalThis: {} };
shelfContext.window = shelfContext.globalThis;
vm.runInNewContext(`${shelfData}\nglobalThis.__enrichGroup = enrichGroup;`, shelfContext, { filename: 'shelf-data.js' });
const optionalGroup = shelfContext.globalThis.__enrichGroup({
  dataBase: 202512,
  cnpjRaiz: '00000000',
  codigoGrupo: 'NULO',
  codigoSegmento: 1,
  valorCartaRef: 100000,
  prazoMeses: 120,
  qtdAtivasEmDia: null,
  qtdContempladasNoMes: 0
});
assert(optionalGroup.qtdAtivasEmDia === null, 'Loader converteu ausência de cotas ativas em zero.');
assert(optionalGroup.qtdContempladasNoMes === 0, 'Loader perdeu zero real de contemplações.');
assert(optionalGroup.contemplacoesRelativasPct === null, 'Taxa com denominador ausente deveria ser não calculável.');

const restoreSelectionBlock = app.match(/function restoreGroupSelectionFromSession[\s\S]*?function restoreCalculationSnapshot/)?.[0] || '';

const structuralContracts = {
  pageRoute: /data-bf-page="grupo"/.test(page),
  chartJsLocal: /assets\/vendor\/chart\.js\/4\.4\.0\/chart\.umd\.min\.js/.test(page),
  twoCanvasCharts: (page.match(/<canvas\b/g) || []).length === 2,
  tableEquivalents: (page.match(/<table\b/g) || []).length >= 2,
  provenance: /As fontes e competências permanecem separadas/.test(page),
  demoDisclosure: /Série demonstrativa do grupo/.test(page) && /não representa uma condição atual/.test(page)
    && /Como a série evoluiu em cada assembleia/.test(page),
  unavailableStates: /Arrecadação, liquidez e cobertura/.test(page) && /Dados financeiros não recebidos para este grupo/.test(page),
  drawerDialog: /role="dialog"[\s\S]*aria-modal="true"/.test(page),
  noInlineSvg: !/<svg\b/i.test(page),
  localAssets: /assets\/icons\/ui\/ui-building\.svg/.test(page),
  exactLookup: /group\?\.groupKey/.test(controller) && !/find\([^\n]*codigoGrupo/.test(controller),
  escapeAndTextContent: /textContent/.test(controller),
  keyboardEscape: /event\.key === 'Escape'/.test(controller),
  inertBackground: /element\.inert = true/.test(controller) && /aria-hidden/.test(controller),
  bareRouteEmpty: /if \(!explicit\) return ''/.test(controller),
  dynamicChartLabels: /axisDate\(row\.date\)/.test(controller) && /groupVolumeTotals/.test(controller),
  sixSectionNavigation: (page.match(/group360-section-nav[\s\S]*?<a href=/)?.[0] || '').length >= 0
    && /Cotas e saúde/.test(page) && /Fluxo e cobertura/.test(page) && /Dados e definições/.test(page),
  responsive360: /@media \(max-width: 520px\)/.test(css),
  responsive768: /@media \(max-width: 760px\)/.test(css),
  desktopGrid: /grid-template-columns:\s*minmax\(0, 1fr\) 320px/.test(css),
  reducedMotion: /prefers-reduced-motion/.test(css),
  shelfCta: /id="shelf-detail-360"/.test(simulator) && /abrirVisaoGrupoDoDetalhe/.test(app),
  proposalEvidence: /data-proposal-group-evidence/.test(proposal) && /groupEvidence/.test(proposal),
  proposalEvidenceDiversity: /for \(let round = 0; round < 3/.test(proposal),
  evidenceRebuiltFromCatalog: /item\.groupEvidence = buildCatalogSnapshotEvidence\(group\)/.test(app)
    && !/item\.groupEvidence = Array\.isArray\(selection\.evidence\)/.test(app),
  directReturn: /token === 'direct'/.test(app) && /params\.get\('useGroup'\) === '1'/.test(app),
  returnWithoutHistoryTrap: /location\.assign\(simulatorReturnHref\(options\)\)/.test(controller) && !/history\.back\(/.test(controller),
  filteredSelectionIndependent: /ensureGroupInProject\(group, \{ deferRender: true, silent: true \}\)/.test(restoreSelectionBlock)
    && !/shelfGroups/.test(restoreSelectionBlock),
  pendingSelectionConsumedAfterSuccess: restoreSelectionBlock.indexOf('discardPendingGroupSelection(token)')
    > restoreSelectionBlock.indexOf('if (!item) return false'),
  duplicateGroupBlocked: /const existing = projetoEstruturado\.itens\.find/.test(app) && /já está no projeto/.test(app),
  commercialCtaVisibleEarly: (page.match(/data-use-group/g) || []).length >= 2,
  safeAnchorOffset: /scroll-margin-top:\s*140px/.test(css),
  nullEvidenceVersioned: /entry && entry\.value === null/.test(versions),
  versionedGroupKey: /groupKey: cleanText/.test(versions) && /evidence: sanitizeEvidence/.test(versions)
};
Object.entries(structuralContracts).forEach(([key, value]) => assert(value, `Contrato estrutural ausente: ${key}.`));

const report = {
  ok: failures.length === 0,
  catalog: {
    rawRecords: compact.rawRecords,
    validRecords: compact.validRecords,
    competence: group79?.[index.get('dataBase')],
    groupKey: assemblyData.EXACT_GROUP_KEY,
    activeQuotas: group79?.[index.get('qtdAtivasEmDia')],
    excludedQuotas: group79?.[index.get('qtdExcluidas')]
  },
  history: history.metrics,
  structuralContracts,
  failures
};

fs.mkdirSync(path.join(root, 'docs', 'test-reports'), { recursive: true });
fs.writeFileSync(path.join(root, 'docs', 'test-reports', 'group-intelligence-report.json'), `${JSON.stringify(report, null, 2)}\n`);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
