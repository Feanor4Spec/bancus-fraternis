import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const ProposalInterest = require('../js/backend/proposal-interest-service.js');
const { createProposalShareRepository } = require('../js/backend/proposal-share-repository.js');

const checks = [];
const failures = [];

function check(name, condition, detail = '') {
  checks.push({ name, ok: Boolean(condition) });
  if (!condition) failures.push(detail ? `${name}: ${detail}` : name);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

function safeInterestShape(value) {
  return value && typeof value === 'object'
    && Object.keys(value).sort().join('|') === 'id|requestedAt|status';
}

function createMemoryDatabase() {
  const rows = new Map();
  let attempts = 0;
  let inserts = 0;
  return {
    async findMaterializedJourneyRow(kind, id, options = {}) {
      const row = rows.get(`${kind}:${id}`) || null;
      if (!row || (options.ownerEmail && row.ownerEmail !== options.ownerEmail)) return null;
      return row;
    },
    async upsertDirectJourneyRow(kind, input = {}, options = {}) {
      attempts += 1;
      const key = `${kind}:${input.id}`;
      const created = !rows.has(key);
      if (options.createOnly === true && !created) {
        const existing = rows.get(key);
        return { ok: true, created: false, record: existing, lead: existing };
      }
      const row = { ...input, kind, materializedTable: `journey_${kind}s` };
      rows.set(key, row);
      if (created) inserts += 1;
      return { ok: true, created, record: row, lead: row };
    },
    stats() {
      return { attempts, inserts, rows: rows.size };
    }
  };
}

const fixedNow = '2026-08-22T15:30:00.000Z';
const memoryDatabase = createMemoryDatabase();
const unitService = ProposalInterest.createProposalInterestService({
  database: memoryDatabase,
  clock: () => new Date(fixedNow)
});
const unitIdentity = {
  proposalId: 'PROP-UNIT-INTEREST',
  proposalVersionId: 'PV-UNIT-INTEREST-1',
  simulationId: 'SIM-UNIT-INTEREST-1',
  ownerEmail: 'consultor@bankfratern.local'
};
const unitFirst = await unitService.request(unitIdentity, {
  ownerName: 'Cliente privado',
  consultantEmail: 'consultor@bankfratern.local',
  amount: 175000,
  productName: 'Consorcio imobiliario',
  proposalVersion: 4,
  proposalStatus: 'reviewed'
});
const unitSecond = await unitService.request(unitIdentity, { amount: 999999 });
const unitResolved = await unitService.resolve(unitIdentity);
const expectedUnitHref = `simulador.html?from=handoff&proposalId=PROP-UNIT-INTEREST&proposalVersionId=PV-UNIT-INTEREST-1&simulationId=SIM-UNIT-INTEREST-1&proposalView=review&interestId=${unitFirst.interest.id}#proposta`;

check('service.idempotent-write', unitFirst.created === true
  && unitSecond.created === false
  && memoryDatabase.stats().attempts === 2
  && memoryDatabase.stats().inserts === 1);
check('service.stable-id', unitFirst.interest.id === unitSecond.interest.id && unitResolved.id === unitFirst.interest.id);
check('service.safe-summary', safeInterestShape(unitFirst.interest) && !/cliente privado|consultor@|PROP-|PV-|SIM-/i.test(JSON.stringify(unitFirst.interest)));
check('service.persistent-status', unitResolved.status === 'requested' && unitResolved.requestedAt === fixedNow);
check('service.consultant-contract', unitFirst.record.status === 'novo'
  && unitFirst.record.stage === 'contato'
  && unitFirst.record.source === 'proposal-interest'
  && unitFirst.record.payload.sourceProposalId === unitIdentity.proposalId
  && unitFirst.record.payload.sourceProposalVersionId === unitIdentity.proposalVersionId
  && unitFirst.record.payload.sourceSimulationId === unitIdentity.simulationId);
check('service.exact-deep-link', unitFirst.record.payload.nextAction.href === expectedUnitHref, unitFirst.record.payload.nextAction.href);
check('service.legacy-dedupe-key', ProposalInterest.interestId({
  ...unitIdentity,
  proposalVersionId: 'PV-UNIT-LEGACY-A',
  interestKey: 'PIK-LEGACY-PROP-UNIT-INTEREST'
}) === ProposalInterest.interestId({
  ...unitIdentity,
  proposalVersionId: 'PV-UNIT-LEGACY-B',
  interestKey: 'PIK-LEGACY-PROP-UNIT-INTEREST'
}));

let concurrentClockTick = 0;
const concurrentMemoryDatabase = createMemoryDatabase();
const concurrentUnitService = ProposalInterest.createProposalInterestService({
  database: concurrentMemoryDatabase,
  clock: () => new Date(Date.parse(fixedNow) + (concurrentClockTick++ * 1000))
});
const concurrentIdentity = {
  proposalId: 'PROP-UNIT-CONCURRENT',
  proposalVersionId: 'PV-UNIT-CONCURRENT-1',
  simulationId: 'SIM-UNIT-CONCURRENT-1',
  ownerEmail: 'consultor@bankfratern.local'
};
const concurrentUnitResults = await Promise.all([
  concurrentUnitService.request(concurrentIdentity, { amount: 85000 }),
  concurrentUnitService.request(concurrentIdentity, { amount: 990000 })
]);
const concurrentCreatedFlags = concurrentUnitResults.map((result) => result.created).sort();
check('service.concurrent-single-insert', concurrentCreatedFlags.join('|') === 'false|true'
  && concurrentMemoryDatabase.stats().attempts === 2
  && concurrentMemoryDatabase.stats().inserts === 1
  && concurrentMemoryDatabase.stats().rows === 1);
check('service.concurrent-stable-original', concurrentUnitResults[0].interest.requestedAt === fixedNow
  && concurrentUnitResults[1].interest.requestedAt === fixedNow
  && concurrentUnitResults[0].record.amount === 85000
  && concurrentUnitResults[1].record.amount === 85000
  && concurrentUnitResults[0].record.payload.timeline.length === 1
  && concurrentUnitResults[1].record.payload.timeline.length === 1);

const [
  publicPage,
  publicJs,
  publicCss,
  simulatorPage,
  simulatorJs,
  simulatorCss,
  backendApi,
  appJs,
  shareJs,
  serverJs,
  localDatabaseJs,
  postgresqlProviderJs,
  simulatorResultJs,
  exportJs,
  handoffJs,
  handoffServiceJs
] = await Promise.all([
  read('pages/proposta.html'),
  read('js/proposal-public.js'),
  read('css/proposal-public.css'),
  read('pages/simulador.html'),
  read('js/proposal-experience.js'),
  read('css/simulator-evolution.css'),
  read('assets/js/services/backend-api.service.js'),
  read('js/app.js'),
  read('js/proposal-share.js'),
  read('server.js'),
  read('js/backend/db.js'),
  read('js/backend/providers/postgresql.js'),
  read('js/simulator-result.js'),
  read('js/export.js'),
  read('assets/js/handoff-consultivo.js'),
  read('assets/js/services/handoff-consultivo.service.js')
]);

check('surface.public-cta', publicPage.includes('data-public-proposal-interest')
  && publicPage.includes('Quero falar com um consultor')
  && publicPage.includes('public-proposal-interest-status'));
check('surface.public-persistent-state', publicJs.includes('renderInterest(response.interest || null)')
  && publicJs.includes('requestPublicProposalInterest(proposalToken)'));
check('surface.public-print-safe', publicCss.includes('.proposal-public-interest')
  && publicCss.includes('display: none !important'));
check('surface.client-cta', simulatorPage.includes('id="proposal-client-interest"')
  && simulatorPage.includes('id="btn-proposal-interest"')
  && simulatorPage.includes('id="btn-proposal-interest-top"')
  && (simulatorPage.match(/data-proposal-interest-action/g) || []).length === 2
  && simulatorPage.includes('Quero falar com um consultor'));
check('surface.client-persistent-state', simulatorJs.includes('getProposalInterest(identity)')
  && simulatorJs.includes('requestProposalInterest(identity)')
  && simulatorJs.includes("querySelectorAll('[data-proposal-interest-action]')")
  && simulatorJs.includes('proposalInterestLoadedKey'));
check('surface.client-mode-only', simulatorCss.includes('body:not(.proposal-client-mode) .proposal-client-interest'));
check('surface.client-top-cta-visible', simulatorCss.includes(':not(#btn-proposal-interest-top)'));
check('security.assigned-resume-sanitized', serverJs.includes('proposalInterestSanitizeResumePayload(existing.payload)')
  && serverJs.includes('PROPOSAL_INTEREST_RESUME_FIELDS')
  && serverJs.includes('proposalInterestRedactResumeText')
  && serverJs.includes("key === '__proto__'")
  && serverJs.includes('proposalInterestResumePrivateKey(key)'));
check('security.analytical-row-escaped', simulatorResultJs.includes('escapeHTML(month.evento')
  && simulatorResultJs.includes('escapeHTML(month.mes'));
check('security.legacy-export-escaped', exportJs.includes('escapeHTML(params.observacoes)')
  && exportJs.includes('escapeHTML(m.evento)'));
check('security.comparison-narrative-escaped', appJs.includes("escapeSettingsText(result?.narrativa || '')")
  && appJs.includes(".replace(/&lt;strong&gt;/gi, '<strong>')"));
check('surface.protected-assignee-readonly', handoffJs.includes('isProtectedProposalInterest(item)')
  && handoffJs.includes('Definido pela fila da proposta.')
  && handoffJs.includes('readonly aria-readonly="true"'));
check('surface.rendered-resume-grant', handoffJs.includes("params.push('proposalView=review')")
  && handoffJs.includes('interestId=${encodeURIComponent(interestId)}')
  && handoffServiceJs.includes("params.push('proposalView=review')"));
check('contract.private-version-provenance', appJs.includes('proposalVersionId: publicationVersionId')
  && appJs.includes('simulationId: publicationSimulationId'));
check('contract.internal-resolution-only', shareJs.includes('resolveContext')
  && shareJs.includes('publicView')
  && !publicJs.includes('resolveContext'));
check('contract.public-post-no-query-token', backendApi.includes("request('/api/public/proposals/interest'")
  && !backendApi.includes("/api/public/proposals/interest?"));
check('contract.server-endpoints', serverJs.includes("pathname === '/api/public/proposals/interest'")
  && serverJs.includes("pathname === '/api/proposal-interests/resolve'")
  && serverJs.includes("pathname === '/api/proposal-interests'"));
check('contract.server-controlled-routing', serverJs.includes('BANCUS_PROPOSAL_INTEREST_QUEUE_EMAIL')
  && serverJs.includes('proposalInterestQueueEmail')
  && !serverJs.includes("payloadDetails.consultantEmail,"));
check('contract.server-backed-resume', appJs.includes('hydrateRequestedSimulationFromBackend')
  && appJs.includes('backendResumeSimulationIds')
  && appJs.includes('backendReadOnlyResumeSimulationIds')
  && backendApi.includes("query.set('interestId', options.interestId)")
  && serverJs.includes("scope: isAdmin ? 'all' : (assignedProposalInterestAccess ? 'assigned-proposal-interest' : 'own')")
  && serverJs.includes('readOnly: protectedResumeRead'));
check('contract.reserved-interest-leads', serverJs.includes('attemptsReservedProposalInterestLead')
  && serverJs.includes('preserveProposalInterestLeadIdentity')
  && serverJs.includes('|| requestedBody.id'));
check('contract.atomic-create-only-service', (await read('js/backend/proposal-interest-service.js'))
  .includes("upsertDirectJourneyRow('lead', lead, { createOnly: true })"));
check('contract.atomic-create-only-sqlite', localDatabaseJs.includes('const existing = createOnly ? null')
  && localDatabaseJs.includes('ON CONFLICT(kind, id) DO NOTHING'));
check('contract.atomic-create-only-postgresql', postgresqlProviderJs.includes('const existing = createOnly ? null')
  && postgresqlProviderJs.includes('ON CONFLICT(kind, id) DO NOTHING')
  && postgresqlProviderJs.includes('RETURNING id'));

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bancus-proposal-interest-'));
const mainDbPath = path.join(tempDir, 'main.sqlite');
const shareDbPath = path.join(tempDir, 'share.sqlite');
let serverModule = null;
let apiServer = null;
let mutationRepository = null;

process.env.BANCUS_AUTH_MODE = 'demo';
process.env.BANCUS_DB_PATH = mainDbPath;
process.env.BANCUS_SHARE_DB_PATH = shareDbPath;

try {
  serverModule = require('../server.js');
  apiServer = serverModule.startServer({ port: 0 });
  if (!apiServer.listening) await once(apiServer, 'listening');
  const address = apiServer.address();
  const apiBase = `http://127.0.0.1:${address.port}`;

  async function apiRequest(endpoint, options = {}) {
    const response = await fetch(`${apiBase}${endpoint}`, options);
    const text = await response.text();
    let body = {};
    try {
      body = text ? JSON.parse(text) : {};
    } catch (error) {
      body = { raw: text };
    }
    return { endpoint, response, body, text };
  }

  async function login(email, password) {
    return apiRequest('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });
  }

  function authHeaders(loginResult) {
    return {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${loginResult.body.session.token}`
    };
  }

  async function publishProposal(headers, suffix) {
    const proposalId = `PROP-${suffix}`;
    const proposalVersionId = `PV-${suffix}-1`;
    const simulationId = `SIM-${suffix}-1`;
    const simulation = await apiRequest('/api/simulations', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        id: simulationId,
        title: `Simulacao ${suffix}`,
        status: 'saved',
        stage: 'simulacao',
        source: 'proposal-version-snapshot',
        relatedId: proposalId,
        amount: 230000,
        payload: {
          id: simulationId,
          nome: `Proposta ${proposalId}`,
          proposalId,
          currentStep: 10,
          cliente: 'Dados protegidos',
          privacy: { localPIIStored: false },
          params: {},
          carrinho: [],
          resultado: { cronograma: [], resumo: { creditoTotal: 230000 } },
          proposalAcceptance: { proposalId, status: 'reviewed', version: 3 }
        }
      })
    });
    check(`http.${suffix}.simulation`, simulation.response.status === 201
      && simulation.body.simulation?.id === simulationId);
    const draft = await apiRequest('/api/proposal-snapshots', {
      method: 'POST',
      headers,
      body: JSON.stringify({
        proposalId,
        engineVersion: 'consorcio-engine.interest.v1',
        dataBase: '202608',
        project: {
          client: {
            name: `Cliente privado ${suffix}`,
            email: `cliente-${suffix.toLowerCase()}@example.com`,
            phone: '(11) 99999-1111'
          },
          consultant: {
            name: 'Consultor sem vínculo declarado no conteúdo',
            email: 'consultor-sem-vinculo@example.com'
          },
          items: [{ segmento: 'Imovel', valorCarta: 230000 }]
        },
        result: {
          proposalData: {
            id: proposalId,
            cliente: `Cliente privado ${suffix}`,
            produto: 'Consorcio imobiliario',
            metrics: { creditoTotal: 230000, parcelaAtual: 1890 }
          }
        },
        review: {},
        provenance: { proposalVersionId, simulationId, sourceHash: `HASH-${suffix}` }
      })
    });
    check(`http.${suffix}.draft`, draft.response.status === 201 && draft.body.snapshot?.status === 'rascunho');
    const validated = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(draft.body.snapshot.id)}/transitions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ status: 'validada' })
    });
    check(`http.${suffix}.validated`, validated.response.status === 201 && validated.body.snapshot?.status === 'validada');
    const reviewed = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(validated.body.snapshot.id)}/transitions`, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        status: 'revisada',
        review: {
          status: 'approved',
          reviewedAt: '2026-08-22T14:00:00.000Z',
          validUntil: '2026-12-31',
          version: 3
        }
      })
    });
    check(`http.${suffix}.reviewed`, reviewed.response.status === 201 && reviewed.body.snapshot?.status === 'revisada');
    const publication = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(reviewed.body.snapshot.id)}/publish`, {
      method: 'POST',
      headers,
      body: JSON.stringify({ validityDays: 30 })
    });
    check(`http.${suffix}.published`, publication.response.status === 201
      && publication.body.share?.status === 'ativa'
      && Boolean(publication.body.token));
    return { proposalId, proposalVersionId, simulationId, publication };
  }

  const consultantLogin = await login('consultor@bankfratern.local', 'Consultor@123');
  check('http.consultant-login', consultantLogin.response.status === 200 && Boolean(consultantLogin.body.session?.token));
  const consultantHeaders = authHeaders(consultantLogin);
  const adminLogin = await login('admin@bankfratern.local', 'Admin@123');
  check('http.admin-login', adminLogin.response.status === 200 && Boolean(adminLogin.body.session?.token));
  const adminHeaders = authHeaders(adminLogin);
  const secondConsultantCreated = await apiRequest('/api/users', {
    method: 'POST',
    headers: adminHeaders,
    body: JSON.stringify({
      name: 'Consultor sem vinculo',
      email: 'consultor-sem-vinculo@example.com',
      role: 'consultor',
      status: 'active',
      password: 'ConsultorSeguro@456'
    })
  });
  check('http.second-consultant-created', secondConsultantCreated.response.status === 201
    && secondConsultantCreated.body.user?.role === 'consultor');
  const secondConsultantLogin = await login('consultor-sem-vinculo@example.com', 'ConsultorSeguro@456');
  check('http.second-consultant-login', secondConsultantLogin.response.status === 200
    && Boolean(secondConsultantLogin.body.session?.token));
  const secondConsultantHeaders = authHeaders(secondConsultantLogin);

  const publicFlow = await publishProposal(consultantHeaders, 'INTEREST-E2E');
  const publicResolveBefore = await apiRequest('/api/public/proposals/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: publicFlow.publication.body.token })
  });
  check('http.public-initial-state', publicResolveBefore.response.status === 200 && publicResolveBefore.body.interest === null);

  const publicInterestEndpoint = '/api/public/proposals/interest';
  const publicInterestRequest = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: publicFlow.publication.body.token })
  };
  const firstPublicInterest = await apiRequest(publicInterestEndpoint, publicInterestRequest);
  const firstPublicJson = JSON.stringify(firstPublicInterest.body);
  check('http.public-interest-created', firstPublicInterest.response.status === 201
    && firstPublicInterest.body.ok === true
    && firstPublicInterest.body.readOnly === true
    && safeInterestShape(firstPublicInterest.body.interest));
  check('http.public-interest-no-token-url', firstPublicInterest.endpoint === publicInterestEndpoint
    && !firstPublicInterest.endpoint.includes(publicFlow.publication.body.token));
  check('http.public-interest-safe-response', !firstPublicJson.includes(publicFlow.publication.body.token)
    && !/cliente privado|@example\.com|consultor@|PROP-INTEREST|PV-INTEREST|SIM-INTEREST/i.test(firstPublicJson), firstPublicJson);
  check('http.public-interest-security-headers', firstPublicInterest.response.headers.get('cache-control') === 'private, no-store'
    && firstPublicInterest.response.headers.get('x-robots-tag') === 'noindex, nofollow, noarchive');

  const repeatedPublicInterest = await apiRequest(publicInterestEndpoint, publicInterestRequest);
  check('http.public-interest-idempotent', repeatedPublicInterest.response.status === 200
    && repeatedPublicInterest.body.interest?.id === firstPublicInterest.body.interest?.id
    && repeatedPublicInterest.body.interest?.requestedAt === firstPublicInterest.body.interest?.requestedAt);

  const concurrentPublicFlow = await publishProposal(consultantHeaders, 'INTEREST-RACE');
  const concurrentPublicRequest = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: concurrentPublicFlow.publication.body.token })
  };
  const concurrentPublicResults = await Promise.all([
    apiRequest(publicInterestEndpoint, concurrentPublicRequest),
    apiRequest(publicInterestEndpoint, concurrentPublicRequest)
  ]);
  const concurrentPublicStatuses = concurrentPublicResults.map((result) => result.response.status).sort();
  const concurrentPublicInterests = concurrentPublicResults.map((result) => result.body.interest);
  check('http.public-interest-concurrent-status', concurrentPublicStatuses.join('|') === '200|201');
  check('http.public-interest-concurrent-stable-original', concurrentPublicInterests.every((interest) => safeInterestShape(interest))
    && concurrentPublicInterests[0].id === concurrentPublicInterests[1].id
    && concurrentPublicInterests[0].requestedAt === concurrentPublicInterests[1].requestedAt);
  const leadsAfterConcurrentPublic = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  const concurrentLeadMatches = (leadsAfterConcurrentPublic.body.leads || [])
    .filter((lead) => lead.id === concurrentPublicInterests[0].id);
  check('http.public-interest-concurrent-single-event', concurrentLeadMatches.length === 1
    && concurrentLeadMatches[0].payload?.timeline?.length === 1
    && concurrentLeadMatches[0].payload?.interestRequestedAt === concurrentPublicInterests[0].requestedAt);
  const eventsAfterConcurrentPublic = await apiRequest('/api/events?limit=200', { headers: adminHeaders });
  const concurrentAuditEvents = (eventsAfterConcurrentPublic.body.events || []).filter((event) => (
    event.type === 'proposal-interest-requested'
      && event.entityId === concurrentPublicInterests[0].id
  ));
  check('http.public-interest-concurrent-single-audit-event', eventsAfterConcurrentPublic.response.status === 200
    && concurrentAuditEvents.length === 1);

  const publicResolveAfter = await apiRequest('/api/public/proposals/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: publicFlow.publication.body.token })
  });
  check('http.public-interest-persists-on-reload', publicResolveAfter.response.status === 200
    && publicResolveAfter.body.interest?.id === firstPublicInterest.body.interest?.id
    && publicResolveAfter.body.interest?.status === 'requested');

  const consultantLeads = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  const publicLead = (consultantLeads.body.leads || []).find((lead) => lead.id === firstPublicInterest.body.interest.id);
  const expectedPublicHref = `simulador.html?from=handoff&proposalId=PROP-INTEREST-E2E&proposalVersionId=PV-INTEREST-E2E-1&simulationId=SIM-INTEREST-E2E-1&proposalView=review&interestId=${publicLead?.id || ''}#proposta`;
  check('http.consultant-opportunity-visible', consultantLeads.response.status === 200
    && publicLead?.source === 'proposal-interest'
    && publicLead?.status === 'novo'
    && publicLead?.stage === 'contato');
  check('http.public-content-cannot-steer-consultant', publicLead?.ownerEmail === 'consultor@bankfratern.local'
    && publicLead?.payload?.assignedTo === 'consultor@bankfratern.local');
  check('http.consultant-opportunity-linked', publicLead?.payload?.sourceProposalId === publicFlow.proposalId
    && publicLead?.payload?.sourceProposalVersionId === publicFlow.proposalVersionId
    && publicLead?.payload?.sourceSimulationId === publicFlow.simulationId
    && publicLead?.payload?.nextAction?.href === expectedPublicHref, publicLead?.payload?.nextAction?.href || 'lead ausente');
  const sameOwnerPublicResume = await apiRequest(
    `/api/simulations/${encodeURIComponent(publicFlow.simulationId)}?interestId=${encodeURIComponent(publicLead?.id || '')}`,
    { headers: consultantHeaders }
  );
  check('http.public-interest-same-owner-resume', sameOwnerPublicResume.response.status === 200
    && sameOwnerPublicResume.body.scope === 'assigned-proposal-interest'
    && sameOwnerPublicResume.body.readOnly === true
    && sameOwnerPublicResume.body.simulation?.id === publicFlow.simulationId
    && sameOwnerPublicResume.body.simulation?.payload?.proposalId === publicFlow.proposalId,
  `${sameOwnerPublicResume.response.status} ${JSON.stringify(sameOwnerPublicResume.body)}`);
  const adminOwnedFlow = await publishProposal(adminHeaders, 'ADMIN-OWNER-INTEREST');
  const adminOwnedInterest = await apiRequest(publicInterestEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: adminOwnedFlow.publication.body.token })
  });
  const adminSameOwnerResume = await apiRequest(
    `/api/simulations/${encodeURIComponent(adminOwnedFlow.simulationId)}?interestId=${encodeURIComponent(adminOwnedInterest.body.interest?.id || '')}`,
    { headers: adminHeaders }
  );
  check('http.admin-interest-same-owner-resume', adminOwnedInterest.response.status === 201
    && adminSameOwnerResume.response.status === 200
    && adminSameOwnerResume.body.scope === 'all'
    && adminSameOwnerResume.body.readOnly === true
    && Object.keys(adminSameOwnerResume.body.simulation || {}).sort().join('|') === 'id|payload'
    && adminSameOwnerResume.body.simulation?.payload?.proposalId === adminOwnedFlow.proposalId,
  `${adminSameOwnerResume.response.status} ${JSON.stringify(adminSameOwnerResume.body)}`);
  const adminSameOwnerForgedInterest = await apiRequest(
    `/api/simulations/${encodeURIComponent(adminOwnedFlow.simulationId)}?interestId=LEAD-PI-00000000000000000000`,
    { headers: adminHeaders }
  );
  check('http.admin-interest-same-owner-forgery-blocked', adminSameOwnerForgedInterest.response.status === 404,
    `${adminSameOwnerForgedInterest.response.status} ${JSON.stringify(adminSameOwnerForgedInterest.body)}`);

  const progressed = await apiRequest(`/api/leads/${encodeURIComponent(publicLead.id)}`, {
    method: 'PATCH',
    headers: consultantHeaders,
    body: JSON.stringify({
      status: 'em_atendimento',
      stage: 'contato',
      source: 'proposal-interest',
      payload: { ...publicLead.payload, status: 'em_atendimento' }
    })
  });
  check('http.consultant-progress-saved', progressed.response.status === 200 && progressed.body.lead?.status === 'em_atendimento');
  const publicResolveProgressed = await apiRequest('/api/public/proposals/resolve', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: publicFlow.publication.body.token })
  });
  check('http.public-progress-persists', publicResolveProgressed.body.interest?.status === 'in_progress');

  const revoked = await apiRequest(`/api/proposal-shares/${encodeURIComponent(publicFlow.publication.body.share.id)}/revoke`, {
    method: 'POST',
    headers: consultantHeaders,
    body: '{}'
  });
  check('http.public-revoked', revoked.response.status === 200 && revoked.body.share?.status === 'revogada');
  const revokedInterest = await apiRequest(publicInterestEndpoint, publicInterestRequest);
  check('http.revoked-interest-blocked', revokedInterest.response.status === 410
    && revokedInterest.body.ok === false
    && !JSON.stringify(revokedInterest.body).includes(publicFlow.publication.body.token));

  const expiringFlow = await publishProposal(consultantHeaders, 'INTEREST-EXPIRED');
  const leadsBeforeExpiryAttempt = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  mutationRepository = createProposalShareRepository({ dbPath: shareDbPath });
  const expiringShareRow = mutationRepository.db.prepare('SELECT created_at FROM proposal_shares WHERE id = ?').get(
    expiringFlow.publication.body.share.id
  );
  const forcedExpiry = new Date(new Date(expiringShareRow.created_at).getTime() + 1).toISOString();
  mutationRepository.db.prepare('UPDATE proposal_shares SET expires_at = ? WHERE id = ?').run(
    forcedExpiry,
    expiringFlow.publication.body.share.id
  );
  mutationRepository.close();
  mutationRepository = null;
  const expiredInterest = await apiRequest(publicInterestEndpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: expiringFlow.publication.body.token })
  });
  const leadsAfterExpiryAttempt = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  check('http.expired-interest-blocked', expiredInterest.response.status === 410 && expiredInterest.body.ok === false);
  check('http.expired-interest-not-persisted', (leadsAfterExpiryAttempt.body.leads || []).length === (leadsBeforeExpiryAttempt.body.leads || []).length);

  const clientLogin = await login('cliente@bankfratern.local', 'Cliente@123');
  check('http.client-login', clientLogin.response.status === 200 && Boolean(clientLogin.body.session?.token));
  const clientHeaders = authHeaders(clientLogin);
  const internalProposal = {
    proposalId: 'PROP-CLIENT-INTEREST',
    proposalVersionId: 'PV-CLIENT-INTEREST-2',
    simulationId: 'SIM-CLIENT-INTEREST-2'
  };
  const savedClientSimulation = await apiRequest('/api/simulations', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      id: internalProposal.simulationId,
      title: 'Snapshot seguro da proposta do cliente',
      status: 'saved',
      stage: 'simulacao',
      source: 'proposal-version-snapshot',
      relatedId: internalProposal.proposalId,
      amount: 145000,
      payload: {
        id: internalProposal.simulationId,
        nome: 'Proposta do cliente',
        proposalId: internalProposal.proposalId,
        currentStep: 10,
        cliente: 'Dados protegidos',
        privacy: { localPIIStored: false },
        params: {
          administradora: '<img src=x onerror="globalThis.__resumeXss=1">',
          clienteEmail: 'cliente-secret@example.com',
          documentoAlternativo: '123.456.789-09',
          contatoAlternativo: '(11) 99999-8888',
          recado: 'fale com terceiro@example.com ou pelo CPF 987.654.321-00'
        },
        documento: '123.456.789-09',
        whatsapp: '(11) 99999-8888',
        endereco: 'Rua Exemplo, 10',
        observacoes: 'fale com terceiro@example.com / CPF 987.654.321-00',
        metadataLivre: { cliente: 'Maria Silva', emailAlternativo: 'terceiro@example.com' },
        ownerEmail: 'cliente-secret@example.com',
        actorEmail: 'cliente-secret@example.com',
        carrinho: [],
        comparison: {
          narrativa: '<img src=x onerror="globalThis.__resumeXss=5">'
        },
        resultado: {
          cronograma: [{
            mes: '<svg onload="globalThis.__resumeXss=2">',
            evento: '<img src=x onerror="globalThis.__resumeXss=3">',
            prazoRestante: '<img src=x onerror="globalThis.__resumeXss=4">'
          }],
          resumo: { creditoTotal: 145000 }
        },
        proposalAcceptance: { proposalId: internalProposal.proposalId, status: 'reviewed', version: 2 }
      }
    })
  });
  check('http.client-simulation-saved', savedClientSimulation.response.status === 201
    && savedClientSimulation.body.simulation?.id === internalProposal.simulationId);
  const savedClientProposal = await apiRequest('/api/proposals', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      id: internalProposal.proposalId,
      title: 'Proposta em acompanhamento',
      status: 'reviewed',
      stage: 'proposta',
      source: 'proposal-versioning',
      relatedId: internalProposal.simulationId,
      amount: 145000,
      payload: {
        id: internalProposal.proposalVersionId,
        proposalId: internalProposal.proposalId,
        simulationId: internalProposal.simulationId,
        assignedTo: 'consultor-sem-vinculo@example.com',
        cliente: 'Cliente Demonstracao',
        metrics: { creditoTotal: 145000 },
        produto: 'Consorcio de veiculo',
        version: 2,
        status: 'reviewed'
      }
    })
  });
  check('http.client-proposal-saved', savedClientProposal.response.status === 201 && savedClientProposal.body.proposal?.id === internalProposal.proposalId);

  const internalRequest = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify(internalProposal)
  });
  check('http.client-interest-created', internalRequest.response.status === 201 && safeInterestShape(internalRequest.body.interest));
  check('http.client-interest-safe-response', !/cliente demonstracao|consultor@|PROP-CLIENT|PV-CLIENT|SIM-CLIENT/i.test(JSON.stringify(internalRequest.body)));
  const internalResolve = await apiRequest('/api/proposal-interests/resolve', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify(internalProposal)
  });
  check('http.client-interest-persists', internalResolve.response.status === 200
    && internalResolve.body.interest?.id === internalRequest.body.interest?.id);
  const mismatchedVersion = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      ...internalProposal,
      proposalVersionId: 'PV-CLIENT-INTEREST-NOT-OWNED'
    })
  });
  check('http.client-version-ownership', mismatchedVersion.response.status === 404 && mismatchedVersion.body.ok === false);

  const consultantLeadsAfterClient = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  const clientLead = (consultantLeadsAfterClient.body.leads || []).find((lead) => lead.id === internalRequest.body.interest.id);
  const expectedClientHref = `simulador.html?from=handoff&proposalId=PROP-CLIENT-INTEREST&proposalVersionId=PV-CLIENT-INTEREST-2&simulationId=SIM-CLIENT-INTEREST-2&proposalView=review&interestId=${clientLead?.id || ''}#proposta`;
  check('http.client-interest-visible-to-consultant', clientLead?.ownerEmail === 'consultor@bankfratern.local'
    && clientLead?.payload?.assignedTo === 'consultor@bankfratern.local');
  check('http.client-cannot-steer-consultant', clientLead?.ownerEmail !== 'consultor-sem-vinculo@example.com'
    && clientLead?.payload?.assignedTo !== 'consultor-sem-vinculo@example.com');
  check('http.client-interest-deep-link', clientLead?.payload?.nextAction?.href === expectedClientHref, clientLead?.payload?.nextAction?.href || 'lead ausente');

  const consultantResumeWithoutInterest = await apiRequest(`/api/simulations/${encodeURIComponent(internalProposal.simulationId)}`, {
    headers: consultantHeaders
  });
  check('http.resume-requires-interest-context', consultantResumeWithoutInterest.response.status === 404,
    `${consultantResumeWithoutInterest.response.status} ${JSON.stringify(consultantResumeWithoutInterest.body)}`);
  const consultantResume = await apiRequest(
    `/api/simulations/${encodeURIComponent(internalProposal.simulationId)}?interestId=${encodeURIComponent(clientLead?.id || '')}`,
    { headers: consultantHeaders }
  );
  check('http.resume-cross-device-authorized', consultantResume.response.status === 200
    && consultantResume.body.scope === 'assigned-proposal-interest'
    && consultantResume.body.readOnly === true
    && consultantResume.body.simulation?.id === internalProposal.simulationId
    && consultantResume.body.simulation?.payload?.proposalId === internalProposal.proposalId);
  const consultantResumeJson = JSON.stringify(consultantResume.body);
  check('http.resume-cross-role-html-sanitized', !consultantResumeJson.includes('<img')
    && !consultantResumeJson.includes('<svg')
    && consultantResumeJson.includes('&lt;img')
    && consultantResumeJson.includes('&lt;svg'), consultantResumeJson);
  check('http.resume-cross-role-data-minimized', Object.keys(consultantResume.body.simulation || {}).sort().join('|') === 'id|payload'
    && !consultantResumeJson.includes('cliente-secret@example.com')
    && !consultantResumeJson.includes('terceiro@example.com')
    && !consultantResumeJson.includes('123.456.789-09')
    && !consultantResumeJson.includes('987.654.321-00')
    && !consultantResumeJson.includes('(11) 99999-8888')
    && !consultantResumeJson.includes('Rua Exemplo, 10')
    && !consultantResumeJson.includes('Maria Silva')
    && !consultantResumeJson.includes('metadataLivre')
    && !consultantResumeJson.includes('ownerEmail')
    && !consultantResumeJson.includes('actorEmail'), consultantResumeJson);
  const adminResume = await apiRequest(`/api/simulations/${encodeURIComponent(internalProposal.simulationId)}`, {
    headers: adminHeaders
  });
  const adminResumeJson = JSON.stringify(adminResume.body);
  check('http.resume-admin-cross-owner-sanitized', adminResume.response.status === 200
    && adminResume.body.scope === 'all'
    && adminResume.body.readOnly === true
    && Object.keys(adminResume.body.simulation || {}).sort().join('|') === 'id|payload'
    && !adminResumeJson.includes('<img')
    && adminResumeJson.includes('&lt;img')
    && !adminResumeJson.includes('cliente-secret@example.com'), adminResumeJson);
  const consultantResumeMutation = await apiRequest(
    `/api/simulations/${encodeURIComponent(internalProposal.simulationId)}?interestId=${encodeURIComponent(clientLead?.id || '')}`,
    {
      method: 'PATCH',
      headers: consultantHeaders,
      body: JSON.stringify({ status: 'tampered' })
    }
  );
  check('http.resume-assigned-access-read-only', consultantResumeMutation.response.status === 404);
  const unrelatedConsultantResume = await apiRequest(
    `/api/simulations/${encodeURIComponent(internalProposal.simulationId)}?interestId=${encodeURIComponent(clientLead?.id || '')}`,
    { headers: secondConsultantHeaders }
  );
  check('http.resume-cross-consultant-blocked', unrelatedConsultantResume.response.status === 404,
    `${unrelatedConsultantResume.response.status} ${JSON.stringify(unrelatedConsultantResume.body)}`);
  const forgedInterestSnapshot = await apiRequest('/api/snapshots', {
    method: 'POST',
    headers: secondConsultantHeaders,
    body: JSON.stringify({
      id: 'SNP-FORGED-PROPOSAL-INTEREST',
      type: 'handoff',
      source: 'browser',
      entityId: clientLead?.id,
      payload: {
        id: clientLead?.id,
        source: 'proposal-interest',
        interestSchema: 'bancus.proposal-interest.v1',
        assignedTo: 'consultor-sem-vinculo@example.com',
        sourceProposalId: internalProposal.proposalId,
        sourceSimulationId: internalProposal.simulationId
      }
    })
  });
  check('http.resume-forged-snapshot-interest-blocked', forgedInterestSnapshot.response.status === 403);
  const downgradeInterestSnapshot = await apiRequest('/api/snapshots', {
    method: 'POST',
    headers: consultantHeaders,
    body: JSON.stringify({
      id: 'SNP-DOWNGRADE-PROPOSAL-INTEREST',
      type: 'handoff',
      source: 'browser',
      entityId: clientLead?.id,
      payload: {
        status: 'em_atendimento',
        assignedTo: 'attacker@example.com'
      }
    })
  });
  check('http.resume-snapshot-downgrade-blocked', downgradeInterestSnapshot.response.status === 403);
  const idFallbackDowngradeSnapshot = await apiRequest('/api/snapshots', {
    method: 'POST',
    headers: consultantHeaders,
    body: JSON.stringify({
      id: clientLead?.id,
      type: 'handoff',
      source: 'browser',
      payload: {
        status: 'em_atendimento',
        assignedTo: 'attacker@example.com'
      }
    })
  });
  check('http.resume-snapshot-id-fallback-downgrade-blocked', idFallbackDowngradeSnapshot.response.status === 403);
  const protectedLeadAfterDowngrade = await apiRequest(`/api/leads/${encodeURIComponent(clientLead?.id || '')}`, {
    headers: consultantHeaders
  });
  check('http.resume-snapshot-downgrade-preserves-grant', protectedLeadAfterDowngrade.response.status === 200
    && protectedLeadAfterDowngrade.body.lead?.source === 'proposal-interest'
    && protectedLeadAfterDowngrade.body.lead?.payload?.interestSchema === 'bancus.proposal-interest.v1'
    && protectedLeadAfterDowngrade.body.lead?.payload?.assignedTo === 'consultor@bankfratern.local');
  const forgedInterestLead = await apiRequest('/api/leads', {
    method: 'POST',
    headers: secondConsultantHeaders,
    body: JSON.stringify({
      id: 'LEAD-PI-FORGED',
      source: 'proposal-interest',
      payload: {
        interestSchema: 'bancus.proposal-interest.v1',
        sourceProposalId: internalProposal.proposalId,
        sourceSimulationId: internalProposal.simulationId
      }
    })
  });
  check('http.resume-forged-interest-blocked', forgedInterestLead.response.status === 403);

  const legacyProposal = {
    proposalId: 'PROP-CLIENT-LEGACY-INTEREST',
    proposalVersionId: 'PV-CLIENT-LEGACY-INTEREST-7',
    simulationId: 'SIM-CLIENT-LEGACY-INTEREST-7'
  };
  const canonicalLegacySimulationId = 'SIM-CLIENT-LEGACY-CANONICAL';
  const savedLegacySimulation = await apiRequest('/api/simulations', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      id: canonicalLegacySimulationId,
      title: 'Simulação histórica canônica',
      status: 'saved',
      stage: 'simulacao',
      source: 'simulator-storage',
      relatedId: legacyProposal.proposalId,
      amount: 98000,
      payload: {
        id: canonicalLegacySimulationId,
        nome: 'Proposta histórica',
        proposalId: legacyProposal.proposalId,
        currentStep: 10,
        cliente: 'Dados protegidos',
        privacy: { localPIIStored: false },
        params: {},
        carrinho: [],
        resultado: { cronograma: [], resumo: { creditoTotal: 98000 } },
        proposalAcceptance: { proposalId: legacyProposal.proposalId, status: 'reviewed', version: 7 }
      }
    })
  });
  check('http.client-legacy-simulation-saved', savedLegacySimulation.response.status === 201
    && savedLegacySimulation.body.simulation?.id === canonicalLegacySimulationId);
  const savedLegacyProposal = await apiRequest('/api/proposals', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      id: legacyProposal.proposalId,
      title: 'Proposta histórica em acompanhamento',
      status: 'reviewed',
      stage: 'proposta',
      source: 'proposal-acceptance',
      amount: 98000,
      payload: {
        schema: 'bank-fratern.proposal-acceptance.v1',
        id: 'REV-CLIENT-LEGACY-7',
        proposalId: legacyProposal.proposalId,
        status: 'reviewed',
        version: 7,
        snapshot: { creditoTotal: 98000 },
        cliente: 'Cliente Demonstracao'
      }
    })
  });
  check('http.client-legacy-proposal-saved', savedLegacyProposal.response.status === 201
    && savedLegacyProposal.body.proposal?.source === 'proposal-acceptance');
  const legacyInterest = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify(legacyProposal)
  });
  check('http.client-legacy-interest-created', legacyInterest.response.status === 201
    && safeInterestShape(legacyInterest.body.interest), JSON.stringify(legacyInterest.body));
  const repeatedLegacyInterest = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: clientHeaders,
    body: JSON.stringify({
      ...legacyProposal,
      proposalVersionId: 'PV-CLIENT-LEGACY-INTEREST-OTHER',
      simulationId: 'SIM-CLIENT-LEGACY-INTEREST-OTHER'
    })
  });
  check('http.client-legacy-interest-idempotent', repeatedLegacyInterest.response.status === 200
    && repeatedLegacyInterest.body.interest?.id === legacyInterest.body.interest?.id);
  const consultantLeadsAfterLegacy = await apiRequest('/api/leads?limit=80', { headers: consultantHeaders });
  const legacyInterestId = legacyInterest.body.interest?.id || '';
  const legacyLead = (consultantLeadsAfterLegacy.body.leads || []).find((lead) => lead.id === legacyInterestId);
  let legacyHref = null;
  try {
    legacyHref = new URL(legacyLead?.payload?.nextAction?.href || '', 'http://localhost/pages/');
  } catch (error) {
    legacyHref = null;
  }
  check('http.client-legacy-interest-linked', legacyHref?.searchParams.get('proposalId') === legacyProposal.proposalId
    && /^PV-LEGACY-[A-F0-9]+$/.test(legacyHref?.searchParams.get('proposalVersionId') || '')
    && legacyHref?.searchParams.get('simulationId') === canonicalLegacySimulationId
    && legacyHref?.searchParams.get('interestId') === legacyInterestId
    && legacyLead?.payload?.sourceProposalVersionId === legacyHref?.searchParams.get('proposalVersionId'),
  legacyLead?.payload?.nextAction?.href || 'lead legado ausente');
  check('http.client-legacy-unverified-identifiers-ignored', !legacyLead?.payload?.nextAction?.href?.includes(legacyProposal.proposalVersionId)
    && !legacyLead?.payload?.nextAction?.href?.includes(legacyProposal.simulationId)
    && !legacyLead?.payload?.nextAction?.href?.includes('OTHER'));

  const noAuthInternal = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(internalProposal)
  });
  check('http.internal-auth-required', noAuthInternal.response.status === 401);
  const consultantCannotRequest = await apiRequest('/api/proposal-interests', {
    method: 'POST',
    headers: consultantHeaders,
    body: JSON.stringify(internalProposal)
  });
  check('http.internal-interest-client-only', consultantCannotRequest.response.status === 403);

  const wrongMethodPublic = await apiRequest(publicInterestEndpoint, { method: 'GET' });
  check('http.public-interest-post-only', wrongMethodPublic.response.status === 405 && wrongMethodPublic.body.readOnly === true);
} finally {
  if (mutationRepository) mutationRepository.close();
  if (apiServer && apiServer.listening) {
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (serverModule) await serverModule.closeInfrastructure();
  delete process.env.BANCUS_AUTH_MODE;
  delete process.env.BANCUS_DB_PATH;
  delete process.env.BANCUS_SHARE_DB_PATH;
  await fs.rm(tempDir, { recursive: true, force: true });
}

const report = {
  ok: failures.length === 0,
  schema: ProposalInterest.SCHEMA,
  source: ProposalInterest.SOURCE,
  generatedAt: new Date().toISOString(),
  checks: checks.length,
  passed: checks.filter((item) => item.ok).length,
  results: checks,
  failures
};

const reportPath = path.join(root, 'docs', 'test-reports', 'proposal-interest-flow-report.json');
await fs.mkdir(path.dirname(reportPath), { recursive: true });
await fs.writeFile(reportPath, `${JSON.stringify(report, null, 2)}\n`, 'utf8');
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
