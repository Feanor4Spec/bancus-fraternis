import fs from 'node:fs/promises';
import path from 'node:path';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const failures = [];
const warnings = [];
const dbPath = path.join(root, '.runtime', `validator-local-db-${process.pid}.sqlite`);

function assert(condition, message) {
  if (!condition) failures.push(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

async function cleanup() {
  for (const suffix of ['', '-wal', '-shm']) {
    try {
      await fs.rm(`${dbPath}${suffix}`, { force: true });
    } catch (error) {
      warnings.push(`Nao foi possivel remover ${path.basename(dbPath)}${suffix}.`);
    }
  }
}

await cleanup();

const {
  createDatabase,
  SCHEMA_VERSION,
  DEFAULT_DB_PROVIDER,
  SUPPORTED_DB_PROVIDERS,
  FUTURE_DB_PROVIDERS,
  normalizeDbProvider,
  isSupportedDbProvider
} = require('../js/backend/db.js');

assert(DEFAULT_DB_PROVIDER === 'sqlite', 'Provider padrao deveria continuar sqlite.');
assert(Array.isArray(SUPPORTED_DB_PROVIDERS) && SUPPORTED_DB_PROVIDERS.includes('sqlite'), 'Providers suportados deveriam incluir sqlite.');
assert(Array.isArray(FUTURE_DB_PROVIDERS) && FUTURE_DB_PROVIDERS.includes('postgresql'), 'Providers futuros deveriam registrar postgresql como proximo candidato.');
assert(normalizeDbProvider('node:sqlite') === 'sqlite', 'Alias node:sqlite deveria normalizar para sqlite.');
assert(normalizeDbProvider('local') === 'sqlite', 'Alias local deveria normalizar para sqlite.');
assert(isSupportedDbProvider('sqlite'), 'sqlite deveria ser provider suportado.');
assert(!isSupportedDbProvider('postgresql'), 'postgresql ainda nao deveria estar marcado como provider suportado.');
let unsupportedProviderMessage = '';
try {
  createDatabase({ provider: 'postgresql', dbPath: `${dbPath}.unsupported` });
} catch (error) {
  unsupportedProviderMessage = error.message || '';
}
assert(unsupportedProviderMessage.includes('BANCUS_DB_PROVIDER=postgresql'), 'Provider postgresql deveria falhar com mensagem explicita.');

const localDb = createDatabase({ dbPath });

try {
  const initialStats = localDb.stats();
  assert(initialStats.schemaVersion === SCHEMA_VERSION, 'Schema do banco local nao confere.');
  assert(initialStats.users === 3, `Banco local deveria criar 3 usuarios seed; criou ${initialStats.users}.`);
  assert(initialStats.snapshots === 0, 'Banco local novo nao deveria iniciar com snapshots.');
  assert(initialStats.journeyEntities === 0, 'Banco local novo nao deveria iniciar com entidades de jornada.');
  assert(initialStats.journeyLeads === 0, 'Banco local novo nao deveria iniciar com leads materializados.');
  assert(initialStats.journeySimulations === 0, 'Banco local novo nao deveria iniciar com simulacoes materializadas.');
  assert(initialStats.journeyProposals === 0, 'Banco local novo nao deveria iniciar com propostas materializadas.');

  const adminLogin = localDb.login('admin@bankfratern.local', 'Admin@123');
  assert(adminLogin.ok, 'Login seed admin falhou no banco local.');
  assert(adminLogin.session && adminLogin.session.token, 'Login seed admin nao retornou token de sessao.');
  assert(adminLogin.user && adminLogin.user.role === 'admin', 'Usuario admin nao preservou papel.');
  assert(!Object.prototype.hasOwnProperty.call(adminLogin.user, 'password_hash'), 'Usuario publico vazou password_hash.');
  assert(!Object.prototype.hasOwnProperty.call(adminLogin.user, 'passwordHash'), 'Usuario publico vazou passwordHash.');

  const badLogin = localDb.login('admin@bankfratern.local', 'senha-incorreta');
  assert(!badLogin.ok && badLogin.status === 401, 'Senha incorreta deveria ser recusada.');

  const context = localDb.authenticateToken(adminLogin.session.token);
  assert(context && context.user && context.user.email === 'admin@bankfratern.local', 'Token de sessao nao autenticou usuario.');

  const created = localDb.createUser({
    id: 'USR-VALIDATOR',
    name: 'Validador Local',
    email: 'validator@example.com',
    role: 'consultor',
    status: 'active',
    department: 'QA',
    phone: '(00) 00000-0000',
    password: 'Validator@123'
  });
  assert(created.ok, `Criacao de usuario no banco local falhou: ${created.message || 'sem mensagem'}.`);
  assert(created.user && created.user.id === 'USR-VALIDATOR', 'Criacao de usuario nao preservou id publico.');
  assert(!Object.prototype.hasOwnProperty.call(created.user, 'password_salt'), 'Usuario criado vazou password_salt.');

  const createdLogin = localDb.login('validator@example.com', 'Validator@123');
  assert(createdLogin.ok, 'Usuario criado nao conseguiu autenticar com senha cadastrada.');

  const event = localDb.recordEvent({
    type: 'validator-event',
    source: 'validator',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    entityType: 'validator',
    entityId: 'event-1',
    payload: {
      amount: 100,
      password: 'nao-gravar',
      token: 'nao-gravar',
      phone: '(11) 90000-0000',
      nested: { senha: 'nao-gravar', safe: true }
    }
  });
  assert(event && event.id, 'Evento nao foi persistido.');
  assert(event.payload.amount === 100, 'Payload seguro do evento nao foi preservado.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'password'), 'Payload do evento vazou password.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'token'), 'Payload do evento vazou token.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload, 'phone'), 'Payload do evento vazou phone.');
  assert(event.payload.nested && event.payload.nested.safe === true, 'Payload aninhado seguro nao foi preservado.');
  assert(!Object.prototype.hasOwnProperty.call(event.payload.nested, 'senha'), 'Payload aninhado vazou senha.');

  const events = localDb.listEvents({ limit: 10 });
  assert(events.length >= 1 && events[0].type === 'validator-event', 'Listagem de eventos nao retornou evento recente.');

  const snapshot = localDb.upsertSnapshot({
    id: 'SNP-VALIDATOR',
    type: 'simulation',
    source: 'validator',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    entityId: 'simulation-1',
    title: 'Snapshot validador',
    status: 'saved',
    storageKey: 'consorciopro_simulations',
    payload: {
      amount: 150,
      password: 'nao-gravar',
      nested: { token: 'nao-gravar', safe: true }
    }
  });
  assert(snapshot.created, 'Snapshot inicial deveria ser criado.');
  assert(snapshot.snapshot && snapshot.snapshot.payload.amount === 150, 'Snapshot deveria preservar payload seguro.');
  assert(!Object.prototype.hasOwnProperty.call(snapshot.snapshot.payload, 'password'), 'Snapshot vazou password.');
  assert(snapshot.snapshot.payload.nested && snapshot.snapshot.payload.nested.safe === true, 'Snapshot aninhado seguro nao foi preservado.');
  assert(!Object.prototype.hasOwnProperty.call(snapshot.snapshot.payload.nested, 'token'), 'Snapshot aninhado vazou token.');
  const snapshotUpdate = localDb.upsertSnapshot({
    id: 'SNP-VALIDATOR',
    type: 'simulation',
    source: 'validator',
    ownerEmail: 'validator@example.com',
    entityId: 'simulation-1',
    title: 'Snapshot validador atualizado',
    status: 'updated',
    payload: { amount: 175 }
  });
  assert(!snapshotUpdate.created && snapshotUpdate.snapshot.status === 'updated', 'Snapshot repetido deveria atualizar registro existente.');
  assert(snapshotUpdate.entity && snapshotUpdate.entity.kind === 'simulation', 'Snapshot de simulacao deveria indexar entidade relacional simulation.');
  const handoffSnapshot = localDb.upsertSnapshot({
    id: 'SNP-HANDOFF-VALIDATOR',
    type: 'handoff',
    source: 'validator',
    ownerEmail: 'validator@example.com',
    entityId: 'HND-VALIDATOR',
    title: 'Lead validador',
    status: 'novo',
    payload: {
      id: 'HND-VALIDATOR',
      objectiveLabel: 'Lead consultivo validador',
      priority: 'alta',
      status: 'novo',
      commercialStage: { key: 'proposta' }
    }
  });
  assert(handoffSnapshot.entity && handoffSnapshot.entity.kind === 'lead', 'Snapshot de handoff deveria indexar entidade relacional lead.');
  const snapshots = localDb.listSnapshots({ limit: 10, type: 'simulation' });
  assert(snapshots.some((item) => item.id === 'SNP-VALIDATOR'), 'Listagem de snapshots nao retornou snapshot criado.');
  const scopedSnapshots = localDb.listSnapshots({ limit: 10, ownerEmail: 'validator@example.com' });
  assert(scopedSnapshots.some((item) => item.id === 'SNP-VALIDATOR'), 'Listagem de snapshots por dono nao retornou snapshot criado.');
  const otherScopedSnapshots = localDb.listSnapshots({ limit: 10, ownerEmail: 'outro@example.com' });
  assert(!otherScopedSnapshots.some((item) => item.id === 'SNP-VALIDATOR'), 'Listagem de snapshots por dono vazou registro de outro usuario.');
  const scopedEntities = localDb.listJourneyEntities({ limit: 10, ownerEmail: 'validator@example.com' });
  assert(scopedEntities.some((item) => item.kind === 'simulation' && item.id === 'simulation-1'), 'Entidades relacionais nao retornaram simulacao indexada.');
  assert(scopedEntities.some((item) => item.kind === 'lead' && item.id === 'HND-VALIDATOR'), 'Entidades relacionais nao retornaram lead indexado.');
  const entitySummary = localDb.journeyEntitySummary({ ownerEmail: 'validator@example.com' });
  assert(entitySummary.simulation >= 1 && entitySummary.lead >= 1, 'Resumo relacional deveria contar simulacao e lead.');
  const materializedSimulation = localDb.listSimulations({ limit: 10, ownerEmail: 'validator@example.com' });
  const materializedLead = localDb.listLeads({ limit: 10, ownerEmail: 'validator@example.com' });
  assert(materializedSimulation.some((item) => item.id === 'simulation-1'), 'Tabela dedicada de simulacoes nao retornou registro materializado.');
  assert(materializedLead.some((item) => item.id === 'HND-VALIDATOR'), 'Tabela dedicada de leads nao retornou registro materializado.');

  const directLead = localDb.upsertDirectJourneyRow('lead', {
    id: 'LED-DIRECT-VALIDATOR',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    title: 'Lead direto validador',
    status: 'novo',
    stage: 'contato',
    priority: 'alta',
    amount: 450,
    payload: {
      objectiveLabel: 'Lead direto',
      phone: '(11) 98888-8888',
      token: 'nao-gravar'
    }
  });
  assert(directLead.ok && directLead.created && directLead.lead.id === 'LED-DIRECT-VALIDATOR', 'Escrita direta de lead deveria criar registro dedicado.');
  assert(directLead.lead.kind === 'lead' && directLead.lead.materializedTable === 'journey_leads', 'Lead direto deveria informar tabela dedicada.');
  assert(!Object.prototype.hasOwnProperty.call(directLead.lead.payload, 'phone'), 'Lead direto vazou phone no payload.');
  assert(!Object.prototype.hasOwnProperty.call(directLead.lead.payload, 'token'), 'Lead direto vazou token no payload.');
  const directLeadUpdate = localDb.upsertDirectJourneyRow('lead', {
    id: 'LED-DIRECT-VALIDATOR',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    status: 'contatado',
    stage: 'proposta'
  });
  assert(!directLeadUpdate.created && directLeadUpdate.lead.status === 'contatado', 'Atualizacao direta de lead deveria reaproveitar id existente.');
  assert(directLeadUpdate.lead.stage === 'proposta', 'Atualizacao direta de lead deveria atualizar etapa.');

  const directSimulation = localDb.upsertDirectJourneyRow('simulation', {
    id: 'SIM-DIRECT-VALIDATOR',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    title: 'Simulacao direta',
    status: 'saved',
    amount: 550,
    relatedId: 'LED-DIRECT-VALIDATOR',
    payload: { valorCarta: 550, senha: 'nao-gravar' }
  });
  assert(directSimulation.ok && directSimulation.simulation.id === 'SIM-DIRECT-VALIDATOR', 'Escrita direta de simulacao deveria criar registro dedicado.');
  assert(!Object.prototype.hasOwnProperty.call(directSimulation.simulation.payload, 'senha'), 'Simulacao direta vazou senha no payload.');

  const directProposal = localDb.upsertDirectJourneyRow('proposal', {
    id: 'PRP-DIRECT-VALIDATOR',
    ownerEmail: 'validator@example.com',
    actorEmail: 'admin@bankfratern.local',
    title: 'Proposta direta',
    status: 'draft',
    amount: 650,
    relatedId: 'SIM-DIRECT-VALIDATOR',
    payload: { proposalValue: 650, cpf: '000.000.000-00' }
  });
  assert(directProposal.ok && directProposal.proposal.id === 'PRP-DIRECT-VALIDATOR', 'Escrita direta de proposta deveria criar registro dedicado.');
  assert(!Object.prototype.hasOwnProperty.call(directProposal.proposal.payload, 'cpf'), 'Proposta direta vazou CPF no payload.');
  const directProposalEntity = localDb.listJourneyEntities({ limit: 20, kind: 'proposal', ownerEmail: 'validator@example.com' })
    .find((item) => item.id === 'PRP-DIRECT-VALIDATOR');
  assert(directProposalEntity && directProposalEntity.relatedId === 'SIM-DIRECT-VALIDATOR', 'Escrita direta deveria manter journey_entities sincronizado.');
  assert(!localDb.upsertDirectJourneyRow('unknown', {}).ok, 'Tipo direto invalido deveria ser recusado.');

  const databaseStatus = localDb.databaseStatus();
  assert(databaseStatus.ok, 'Status tecnico do banco local deveria retornar ok.');
  assert(databaseStatus.provider === 'sqlite', 'Provider ativo deveria ser sqlite.');
  assert(databaseStatus.files && databaseStatus.files.main && databaseStatus.files.main.exists, 'Status do banco nao encontrou arquivo SQLite principal.');
  assert(databaseStatus.sqlite && databaseStatus.sqlite.quickCheck === 'ok', 'PRAGMA quick_check do SQLite nao retornou ok.');
  assert(Array.isArray(databaseStatus.tables) && databaseStatus.tables.length >= 8, 'Status do banco deveria listar tabelas principais.');

  const importSnapshot = {
    source: 'validator-local-storage',
    users: [
      {
        id: 'USR-LOCAL-IMPORT',
        name: 'Usuario Local Importado',
        email: 'local-import@example.com',
        role: 'cliente',
        status: 'active',
        department: 'Validacao',
        phone: '(00) 00000-0001'
      }
    ],
    events: [
      {
        id: 'LS-VALIDATOR-EVENT',
        type: 'calculator:capacidade-credito',
        source: 'calculator-history',
        ownerEmail: 'local-import@example.com',
        actorEmail: 'admin@bankfratern.local',
        entityType: 'calculator',
        entityId: 'capacidade-credito',
        createdAt: new Date().toISOString(),
        payload: {
          amount: 200,
          password: 'nao-gravar',
          phone: '(11) 90000-0000'
        }
      }
    ],
    snapshots: [
      {
        id: 'SNP-LOCAL-IMPORT',
        type: 'proposal-version',
        source: 'proposal-versioning',
        ownerEmail: 'local-import@example.com',
        actorEmail: 'admin@bankfratern.local',
        entityId: 'PROP-LOCAL-1',
        title: 'Proposta importada',
        status: 'reviewed',
        storageKey: 'bank_fratern_proposal_versions_v1',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        payload: {
          proposalId: 'PROP-LOCAL-1',
          amount: 300,
          password: 'nao-gravar',
          phone: '(11) 90000-0000'
        }
      }
    ]
  };
  const importPreview = localDb.importLocalSnapshot(importSnapshot, { dryRun: true, actorEmail: 'admin@bankfratern.local' });
  assert(importPreview.dryRun && importPreview.users.importable === 1, 'Preview de importacao deveria encontrar usuario importavel.');
  assert(importPreview.events.importable === 1, 'Preview de importacao deveria encontrar evento importavel.');
  assert(importPreview.snapshots.importable === 1, 'Preview de importacao deveria encontrar snapshot importavel.');
  const importRun = localDb.importLocalSnapshot(importSnapshot, { dryRun: false, actorEmail: 'admin@bankfratern.local' });
  assert(importRun.users.imported === 1, 'Importacao local deveria criar usuario no SQLite.');
  assert(importRun.events.imported === 1, 'Importacao local deveria criar evento no SQLite.');
  assert(importRun.snapshots.created === 1, 'Importacao local deveria criar snapshot no SQLite.');
  const importRepeat = localDb.importLocalSnapshot(importSnapshot, { dryRun: false, actorEmail: 'admin@bankfratern.local' });
  assert(importRepeat.users.skippedExisting === 1, 'Importacao repetida deveria pular usuario existente.');
  assert(importRepeat.events.skippedExisting === 1, 'Importacao repetida deveria pular evento existente.');
  assert(importRepeat.snapshots.updated === 1, 'Importacao repetida deveria atualizar snapshot existente.');
  const importedLogin = localDb.login('local-import@example.com', 'Temp@123');
  assert(importedLogin.ok, 'Usuario importado deveria autenticar com senha temporaria.');
  const importedEvent = localDb.listEvents({ limit: 20 }).find((item) => item.id === 'LS-VALIDATOR-EVENT');
  assert(importedEvent && importedEvent.payload.amount === 200, 'Evento importado deveria preservar payload seguro.');
  assert(importedEvent && !Object.prototype.hasOwnProperty.call(importedEvent.payload, 'password'), 'Evento importado vazou password.');
  assert(importedEvent && !Object.prototype.hasOwnProperty.call(importedEvent.payload, 'phone'), 'Evento importado vazou phone.');
  const importedSnapshot = localDb.listSnapshots({ limit: 20, type: 'proposal-version' }).find((item) => item.id === 'SNP-LOCAL-IMPORT');
  assert(importedSnapshot && importedSnapshot.payload.amount === 300, 'Snapshot importado deveria preservar payload seguro.');
  assert(importedSnapshot && !Object.prototype.hasOwnProperty.call(importedSnapshot.payload, 'password'), 'Snapshot importado vazou password.');
  assert(importedSnapshot && !Object.prototype.hasOwnProperty.call(importedSnapshot.payload, 'phone'), 'Snapshot importado vazou phone.');
  const importedProposalEntity = localDb.listJourneyEntities({ limit: 20, kind: 'proposal' }).find((item) => item.id === 'PROP-LOCAL-1');
  assert(importedProposalEntity && importedProposalEntity.kind === 'proposal', 'Snapshot importado de proposta deveria gerar entidade relacional proposal.');
  const importedProposal = localDb.listProposals({ limit: 20 }).find((item) => item.id === 'PROP-LOCAL-1');
  assert(importedProposal && importedProposal.kind === 'proposal', 'Snapshot importado de proposta deveria gerar tabela dedicada proposal.');

  const server = await read('server.js');
  [
    '/api/health',
    '/api/database/status',
    '/api/database/import-local',
    '/api/auth/login',
    '/api/auth/logout',
    '/api/auth/me',
    '/api/users',
    '/api/events',
    '/api/snapshots',
    '/api/journey-entities',
    '/api/leads',
    '/api/simulations',
    '/api/proposals',
    'provider: localDatabase ? localDatabase.provider : null',
    'upsertDirectJourneyRow',
    'findMaterializedJourneyRow',
    '-direct-',
    'SCHEMA_VERSION'
  ].forEach((marker) => assert(server.includes(marker), `server.js sem contrato de API local: ${marker}.`));

  const backendApi = await read('assets/js/services/backend-api.service.js');
  [
    'window.BFBackendApi',
    'bf_backend_session_v1',
    'authLogin',
    'databaseStatus',
    'importLocalSnapshot',
    'recordEvent',
    'recordSnapshot',
    'listEvents',
    'listSnapshots',
    'listJourneyEntities',
    'listLeads',
    'listSimulations',
    'listProposals',
    'saveLead',
    'getLead',
    'updateLead',
    'saveSimulation',
    'getSimulation',
    'updateSimulation',
    'saveProposal',
    'getProposal',
    'updateProposal',
    'createUser',
    'toggleStatus'
  ].forEach((marker) => assert(backendApi.includes(marker), `backend-api.service.js sem contrato ${marker}.`));

  const adminDashboard = await read('pages/dashboard-admin.html');
  const adminUsers = await read('assets/js/admin-users.js');
  const clientDashboard = await read('assets/js/client-dashboard.js');
  const storageJs = await read('js/storage.js');
  const proposalVersioning = await read('js/proposal-versioning.js');
  const proposalAcceptance = await read('js/proposal-acceptance.js');
  const proposalBuilder = await read('js/proposal-builder.js');
  const decisionContext = await read('assets/js/services/decision-context.service.js');
  const decisionJourney = await read('assets/js/services/trilha-decisao.service.js');
  const handoffService = await read('assets/js/services/handoff-consultivo.service.js');
  [
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
    'renderBackendDedicatedQueue',
    'rerenderBackendEventsFromCache',
    'adminBackendMaterializedEditable',
    'handleMaterializedUpdate',
    'materializedUpdateMethod',
    'data-admin-backend-table',
    'data-admin-backend-database-provider',
    'data-admin-local-import-panel',
    'data-admin-local-import-preview',
    'data-admin-local-import-run',
    'data-admin-local-import-result',
    'data-admin-local-snapshot-count',
    'collectLocalSnapshotRecords',
    'collectLocalImportSnapshot',
    'data-admin-backend-event-refresh',
    'databaseStatus',
    'listEvents(30)',
    'listSnapshots(30)',
    'listJourneyEntities(50)',
    'listLeads(30)',
    'listSimulations(30)',
    'listProposals(30)'
  ].forEach((marker) => {
    assert(adminDashboard.includes(marker) || adminUsers.includes(marker), `Painel admin de eventos sem contrato ${marker}.`);
  });

  [
    'data-client-backend-snapshots',
    'data-client-backend-entities',
    'data-client-backend-materialized',
    'backendSnapshotState',
    'backendEntityState',
    'backendMaterializedState',
    'listSnapshots(100)',
    'listJourneyEntities(100)',
    'listLeads(30)',
    'listSimulations(30)',
    'listProposals(30)'
  ].forEach((marker) => {
    assert(clientDashboard.includes(marker), `Dashboard Cliente sem contrato de snapshot server-side: ${marker}.`);
  });

  [
    [storageJs, 'simulation', 'Storage.saveSimulation sem snapshot server-side de simulacao.'],
    [proposalVersioning, 'proposal-version', 'BFProposalVersions sem snapshot server-side de versao.'],
    [proposalAcceptance, 'proposal-acceptance', 'BFProposalAcceptance sem snapshot server-side de aceite.'],
    [proposalBuilder, 'proposal-builder', 'BFProposalBuilder sem snapshot server-side da lousa.'],
    [decisionContext, 'financial-profile', 'BFDecisionContext sem snapshot server-side de perfil.'],
    [decisionJourney, 'decision-journey', 'BFTrilhaDecisaoService sem snapshot server-side da trilha.'],
    [handoffService, 'handoff', 'BFHandoffConsultivoService sem snapshot server-side de handoff.']
  ].forEach(([text, marker, message]) => {
    assert(text.includes('recordSnapshot') && text.includes(marker), message);
  });
  [
    [storageJs, 'api.saveSimulation', 'Storage.saveSimulation sem escrita direta de simulacao.'],
    [proposalVersioning, 'api.saveProposal', 'BFProposalVersions sem escrita direta de proposta.'],
    [proposalAcceptance, 'api.saveProposal', 'BFProposalAcceptance sem escrita direta de proposta.'],
    [proposalBuilder, 'api.saveProposal', 'BFProposalBuilder sem escrita direta de proposta/lousa.'],
    [handoffService, 'api.saveLead', 'BFHandoffConsultivoService sem escrita direta de lead.']
  ].forEach(([text, marker, message]) => {
    assert(text.includes(marker), message);
  });

  const inspector = await read('tools/inspect-local-sql-environment.mjs');
  ['postgresql', 'mysql', 'mssql', 'local-sql-environment-report.json'].forEach((marker) => {
    assert(inspector.includes(marker), `Inspetor SQL local sem marcador ${marker}.`);
  });

  const report = {
    ok: failures.length === 0,
    schemaVersion: SCHEMA_VERSION,
    seedUsers: initialStats.users,
    events: localDb.listEvents({ limit: 50 }).length,
    snapshots: localDb.listSnapshots({ limit: 50 }).length,
    journeyEntities: localDb.listJourneyEntities({ limit: 50 }).length,
    journeyLeads: localDb.listLeads({ limit: 50 }).length,
    journeySimulations: localDb.listSimulations({ limit: 50 }).length,
    journeyProposals: localDb.listProposals({ limit: 50 }).length,
    directHooks: {
      simulation: storageJs.includes('api.saveSimulation'),
      proposalVersioning: proposalVersioning.includes('api.saveProposal'),
      proposalAcceptance: proposalAcceptance.includes('api.saveProposal'),
      proposalBuilder: proposalBuilder.includes('api.saveProposal'),
      handoff: handoffService.includes('api.saveLead')
    },
    provider: databaseStatus.provider,
    supportedProviders: SUPPORTED_DB_PROVIDERS,
    futureProviders: FUTURE_DB_PROVIDERS,
    tables: databaseStatus.tables.length,
    importedUsers: importRun.users.imported,
    importedEvents: importRun.events.imported,
    importedSnapshots: importRun.snapshots.created,
    warnings,
    failures
  };

  await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
  await fs.writeFile(
    path.join(root, 'docs/test-reports/local-database-report.json'),
    JSON.stringify(report, null, 2)
  );

  console.log(JSON.stringify(report, null, 2));
} finally {
  localDb.close();
  await cleanup();
}

if (failures.length > 0) process.exit(1);
