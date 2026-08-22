import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { once } from 'node:events';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const root = process.cwd();
const ProposalSnapshot = require('../js/proposal-snapshot.js');
const ProposalShare = require('../js/proposal-share.js');
const {
  createProposalShareRepository,
  MIGRATION_PATH
} = require('../js/backend/proposal-share-repository.js');

const failures = [];
const checks = [];

function check(condition, message) {
  checks.push(message);
  if (!condition) failures.push(message);
}

function expectError(action, expectedCode, message) {
  try {
    action();
    check(false, message);
  } catch (error) {
    check(error && error.code === expectedCode, `${message} (codigo esperado: ${expectedCode})`);
  }
}

function sequenceFactory(prefix) {
  let value = 0;
  return () => `${prefix}-${String(++value).padStart(4, '0')}`;
}

function createMemoryRepository() {
  const snapshots = new Map();
  const shares = new Map();
  return {
    insertSnapshot({ snapshot, ownerId }) {
      snapshots.set(snapshot.id, { snapshot, ownerId });
      return snapshots.get(snapshot.id);
    },
    getSnapshot(id) {
      return snapshots.get(id) || null;
    },
    publishSnapshot({ snapshot, share, ownerId }) {
      this.insertSnapshot({ snapshot, ownerId });
      shares.set(share.id, { ...share });
      return { snapshot, share };
    },
    getShare(id) {
      return shares.get(id) || null;
    },
    findShareByTokenHash(hash) {
      return [...shares.values()].find((share) => share.tokenHash === hash) || null;
    },
    terminateShare() {
      throw new Error('Nao usado neste teste do adapter substituivel.');
    }
  };
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const tempDir = await fs.mkdtemp(path.join(os.tmpdir(), 'bancus-proposal-share-'));
const dbPath = path.join(tempDir, 'proposal-share.sqlite');
let repository = null;
let apiServerModule = null;
let apiServer = null;

try {
  let currentTime = Date.parse('2030-01-01T12:00:00.000Z');
  const clock = () => new Date(currentTime);
  const tokens = [
    'A'.repeat(43),
    'B'.repeat(43)
  ];
  const repositoryIds = sequenceFactory('PSN-TEST');
  const shareIds = sequenceFactory('PSH-TEST');

  repository = createProposalShareRepository({ dbPath });
  const service = ProposalShare.createProposalShareService({
    repository,
    clock,
    tokenFactory: () => tokens.shift(),
    snapshotIdFactory: repositoryIds,
    shareIdFactory: shareIds
  });
  const owner = { ownerId: 'USR-TEST-OWNER' };

  function reviewedSnapshot(proposalId) {
    const draft = service.createSnapshot({
      proposalId,
      engineVersion: 'consorcio-engine.v8.105.0',
      dataBase: '202512',
      project: {
        cliente: {
          nome: 'Maria da Silva',
          cpf: '529.982.247-25',
          email: 'maria@example.com',
          telefone: '(11) 99999-8888',
          objetivo: 'imovel'
        },
        itens: [{
          groupKey: '202512|12345678|G-100|1',
          nomeAdministradora: 'Administradora Segura',
          valorCarta: 250000
        }]
      },
      result: {
        creditoTotal: 250000,
        parcelaInicial: 1850,
        contato: 'maria@example.com',
        observacao: 'Retorno pelo telefone 11999998888. CNPJ 12.345.678/0001-95.',
        titular: 'Beatriz Beneficiaria',
        responsavelLegal: 'Carlos Responsavel',
        proposalData: {
          id: 'PROP-2026-0100',
          cliente: 'Maria da Silva'
        }
      },
      review: {},
      provenance: {
        source: 'validator',
        actorEmail: 'consultor@example.com',
        sourceHash: crypto.createHash('sha256').update('source').digest('hex')
      }
    }, owner);
    const validated = service.transitionSnapshot(
      draft.id,
      ProposalSnapshot.STATUS.VALIDATED,
      { provenance: { validatedByRule: 'structural-contract-v1' } },
      owner
    );
    const reviewed = service.transitionSnapshot(
      validated.id,
      ProposalSnapshot.STATUS.REVIEWED,
      {
        review: {
          status: 'approved',
          reviewer: 'Ana Consultora',
          reviewerEmail: 'ana@example.com',
          reviewedAt: new Date(currentTime).toISOString(),
          checklist: { premissas: true, dados: true }
        }
      },
      owner
    );
    return { draft, validated, reviewed };
  }

  const first = reviewedSnapshot('PROP-MARIA-52998224725');
  check(first.draft.status === 'rascunho', 'Snapshot inicial usa estado rascunho.');
  check(first.validated.status === 'validada', 'Transicao rascunho -> validada preservada.');
  check(first.reviewed.status === 'revisada', 'Transicao validada -> revisada preservada.');
  check(first.reviewed.version === 3 && first.reviewed.parentSnapshotId === first.validated.id, 'Snapshots formam linhagem versionada.');
  check(Object.isFrozen(first.draft) && Object.isFrozen(first.draft.project), 'Snapshot de dominio e profundamente imutavel.');
  expectError(
    () => service.createSnapshot({
      proposalId: 'PROP-NAN',
      engineVersion: 'engine.invalid.v1',
      dataBase: '202512',
      project: {},
      result: { parcela: Number.NaN },
      review: {},
      provenance: {}
    }, owner),
    'invalid-json',
    'Snapshot rejeita numeros nao finitos em vez de transforma-los silenciosamente.'
  );
  expectError(
    () => service.publish(first.validated.id, {}, owner),
    'snapshot-not-reviewed',
    'Publicacao antes da revisao e bloqueada.'
  );
  expectError(
    () => service.transitionSnapshot(first.draft.id, ProposalSnapshot.STATUS.REVIEWED, { review: { ok: true } }, owner),
    'invalid-transition',
    'Salto rascunho -> revisada e bloqueado.'
  );
  expectError(
    () => service.getSnapshot(first.draft.id, { ownerId: 'USR-OUTRO' }),
    'not-found',
    'Leitura privada respeita o proprietario.'
  );
  const otherOwnerDraft = service.createSnapshot({
    proposalId: first.draft.proposalId,
    engineVersion: 'consorcio-engine.v8.105.0',
    dataBase: '202512',
    project: {},
    result: {},
    review: {},
    provenance: { source: 'tenant-isolation-test' }
  }, { ownerId: 'USR-OUTRO' });
  check(otherOwnerDraft.version === 1, 'Propostas com mesmo proposalId permanecem isoladas por proprietario.');

  const publication = service.publish(first.reviewed.id, {}, owner);
  const expectedExpiry = new Date(currentTime + 30 * 24 * 60 * 60 * 1000).toISOString();
  check(publication.share.expiresAt === expectedExpiry, 'Validade padrao e exatamente 30 dias.');
  check(publication.share.status === 'ativa', 'Publicacao cria link ativo.');
  check(publication.path === '/api/public/proposals/resolve', 'Endpoint de resolucao nao inclui o token na URL.');
  check(!/maria|52998224725|example\.com|USR-TEST/i.test(publication.path), 'URL publica nao contem PII nem identificador interno.');
  check(!Object.prototype.hasOwnProperty.call(publication.share, 'tokenHash'), 'Resposta de publicacao nao expoe tokenHash.');

  const shareColumns = repository.db.prepare('PRAGMA table_info(proposal_shares)').all().map((row) => row.name);
  const rawShare = repository.db.prepare('SELECT * FROM proposal_shares WHERE id = ?').get(publication.share.id);
  check(shareColumns.includes('token_hash') && !shareColumns.includes('token'), 'Schema persiste somente token_hash, sem coluna de token puro.');
  check(rawShare.token_hash === ProposalShare.tokenHash(publication.token), 'Token e persistido como SHA-256.');
  check(rawShare.token_hash !== publication.token, 'Token opaco nao e persistido em texto puro.');

  const publicView = service.resolve(publication.token);
  const publicJson = JSON.stringify(publicView).toLowerCase();
  check(publicView.readOnly === true, 'Visualizacao publica declara contrato read-only.');
  check(publicView.robots === 'noindex, nofollow, noarchive', 'Visualizacao publica declara noindex/noarchive.');
  check(publicView.snapshot.engineVersion === first.draft.engineVersion, 'Snapshot publico preserva engineVersion auditavel.');
  check(publicView.snapshot.dataBase === first.draft.dataBase, 'Snapshot publico preserva dataBase auditavel.');
  check(publicView.snapshot.result.proposalData.id === 'PROP-2026-0100', 'Sanitizacao preserva identificador comercial nao pessoal da proposta.');
  check(!Object.prototype.hasOwnProperty.call(publicView.snapshot.result.proposalData, 'cliente'), 'Sanitizacao remove o nome do cliente da proposta publica.');
  [
    'maria da silva',
    '529.982.247-25',
    'maria@example.com',
    'consultor@example.com',
    'ana consultora',
    'ana@example.com',
    '11999998888',
    '12.345.678/0001-95',
    'beatriz beneficiaria',
    'carlos responsavel'
  ].forEach((pii) => check(!publicJson.includes(pii), `Payload publico remove PII: ${pii}.`));
  check(publicJson.includes('administradora segura'), 'Sanitizacao preserva dados empresariais nao pessoais.');

  const firstVersionsBeforeExpiry = repository.listSnapshotVersions(first.draft.proposalId, owner);
  check(
    firstVersionsBeforeExpiry.map((item) => item.snapshot.status).join('>') === 'rascunho>validada>revisada>publicada',
    'Publicacao adiciona versao publicada sem alterar anteriores.'
  );
  let immutableTrigger = false;
  try {
    repository.db.prepare("UPDATE proposal_snapshots SET status = 'revogada' WHERE id = ?").run(first.draft.id);
  } catch (error) {
    immutableTrigger = String(error.message).includes('proposal_snapshots_are_immutable');
  }
  check(immutableTrigger, 'Banco bloqueia UPDATE de snapshots imutaveis.');
  let immutableDeleteTrigger = false;
  try {
    repository.db.prepare('DELETE FROM proposal_snapshots WHERE id = ?').run(first.draft.id);
  } catch (error) {
    immutableDeleteTrigger = String(error.message).includes('proposal_snapshots_are_immutable');
  }
  check(immutableDeleteTrigger, 'Banco bloqueia DELETE de snapshots imutaveis.');

  currentTime = Date.parse(expectedExpiry);
  expectError(
    () => service.resolve(publication.token),
    'share-expired',
    'Link expira de forma deterministica no instante expiresAt.'
  );
  const expiredShare = repository.getShare(publication.share.id);
  const firstVersionsAfterExpiry = repository.listSnapshotVersions(first.draft.proposalId, owner);
  check(expiredShare.status === 'expirada' && Boolean(expiredShare.expiredAt), 'Expiracao fica persistida no link.');
  check(firstVersionsAfterExpiry.at(-1).snapshot.status === 'expirada', 'Expiracao gera snapshot terminal versionado.');
  check(repository.getSnapshot(publication.share.snapshotId).snapshot.status === 'publicada', 'Snapshot publicado original permanece inalterado.');
  const versionCountAfterExpiry = firstVersionsAfterExpiry.length;
  expectError(
    () => service.resolve(publication.token),
    'share-expired',
    'Nova leitura de link expirado continua bloqueada.'
  );
  check(repository.listSnapshotVersions(first.draft.proposalId, owner).length === versionCountAfterExpiry, 'Nova leitura nao duplica versao terminal.');

  currentTime = Date.parse('2031-02-10T09:30:00.000Z');
  const second = reviewedSnapshot('PROP-REVOGACAO-TESTE');
  const secondPublication = service.publish(second.reviewed.id, { validityDays: 45 }, owner);
  check(service.resolve(secondPublication.token).readOnly === true, 'Segundo link esta legivel antes da revogacao.');
  const revoked = service.revoke(secondPublication.share.id, owner);
  check(revoked.status === 'revogada' && Boolean(revoked.revokedAt), 'Revogacao e persistida imediatamente.');
  expectError(
    () => service.resolve(secondPublication.token),
    'share-revoked',
    'Token revogado deixa de resolver a proposta.'
  );
  const secondVersions = repository.listSnapshotVersions(second.draft.proposalId, owner);
  check(secondVersions.at(-1).snapshot.status === 'revogada', 'Revogacao gera snapshot terminal versionado.');

  const memoryRepository = createMemoryRepository();
  const memoryService = ProposalShare.createProposalShareService({
    repository: memoryRepository,
    clock: () => new Date('2040-01-01T00:00:00.000Z'),
    snapshotIdFactory: () => 'PSN-MEMORY-0001'
  });
  const memoryDraft = memoryService.createSnapshot({
    proposalId: 'PROP-MEMORY',
    engineVersion: 'engine.memory.v1',
    dataBase: '204001',
    project: {},
    result: {},
    review: {},
    provenance: { source: 'memory-adapter' }
  }, { ownerId: 'USR-MEMORY' });
  check(memoryDraft.id === 'PSN-MEMORY-0001', 'Servico aceita repository port substituivel, sem acoplamento ao SQLite.');

  const [serverJs, legacyServerJs, migrationSql, rollbackSql] = await Promise.all([
    read('server.js'),
    read('js/server.js'),
    fs.readFile(MIGRATION_PATH, 'utf8'),
    read('js/backend/migrations/002_proposal_secure_share.rollback.sql')
  ]);
  [
    '/api/proposal-snapshots',
    '/api/public/proposals/resolve',
    '/publish',
    '/revoke',
    'X-Robots-Tag',
    'noindex, nofollow, noarchive',
    'readOnly'
  ].forEach((marker) => check(serverJs.includes(marker), `Servidor principal preserva contrato ${marker}.`));
  check(legacyServerJs.includes("require('../server')") && legacyServerJs.includes('startServer'), 'Servidor legado delega ao contrato principal.');
  [
    'CREATE TABLE IF NOT EXISTS proposal_snapshots',
    'CREATE TABLE IF NOT EXISTS proposal_shares',
    'token_hash TEXT NOT NULL',
    'CREATE UNIQUE INDEX IF NOT EXISTS idx_proposal_shares_token_hash',
    'proposal_snapshots_prevent_update',
    'proposal_snapshots_prevent_delete'
  ].forEach((marker) => check(migrationSql.includes(marker), `Migration segura contem ${marker}.`));
  check(!/\btoken\s+TEXT\b/i.test(migrationSql), 'Migration nao cria coluna de token em texto puro.');
  check(rollbackSql.includes('DROP TABLE IF EXISTS proposal_shares') && rollbackSql.includes('DROP TABLE IF EXISTS proposal_snapshots'), 'Rollback e limitado as tabelas do Gate 4.');

  process.env.BANCUS_DB_PATH = path.join(tempDir, 'api-main.sqlite');
  process.env.BANCUS_SHARE_DB_PATH = path.join(tempDir, 'api-share.sqlite');
  apiServerModule = require('../server.js');
  apiServer = apiServerModule.startServer({ port: 0 });
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
    return { response, body };
  }

  const login = await apiRequest('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'admin@bankfratern.local', password: 'Admin@123' })
  });
  check(login.response.status === 200 && Boolean(login.body.session && login.body.session.token), 'API autentica proprietario para operacoes privadas.');
  const authHeaders = {
    'Content-Type': 'application/json',
    Authorization: `Bearer ${login.body.session.token}`
  };
  const apiDraft = await apiRequest('/api/proposal-snapshots', {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      proposalId: 'PROP-API-CLIENTE@example.com',
      engineVersion: 'engine.api.v1',
      dataBase: '202512',
      project: { cliente: { nome: 'Cliente API', cpf: '52998224725' }, valorCarta: 180000 },
      result: { parcela: 1500, contato: 'cliente@example.com' },
      review: {},
      provenance: { sourceVersion: 'validator-http' }
    })
  });
  check(apiDraft.response.status === 201 && apiDraft.body.snapshot.status === 'rascunho', 'POST /api/proposal-snapshots cria rascunho privado.');
  const apiValidated = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(apiDraft.body.snapshot.id)}/transitions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({ status: 'validada' })
  });
  check(apiValidated.response.status === 201 && apiValidated.body.snapshot.status === 'validada', 'API aplica transicao para validada.');
  const apiReviewed = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(apiValidated.body.snapshot.id)}/transitions`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      status: 'revisada',
      review: { status: 'approved', reviewer: 'Revisor API', reviewerEmail: 'revisor@example.com' }
    })
  });
  check(apiReviewed.response.status === 201 && apiReviewed.body.snapshot.status === 'revisada', 'API aplica transicao para revisada.');
  const apiPublication = await apiRequest(`/api/proposal-snapshots/${encodeURIComponent(apiReviewed.body.snapshot.id)}/publish`, {
    method: 'POST',
    headers: authHeaders,
    body: '{}'
  });
  check(apiPublication.response.status === 201 && Boolean(apiPublication.body.token), 'API publica snapshot revisado e entrega token uma unica vez.');
  check(!/cliente|example|52998224725/i.test(apiPublication.body.path), 'Path HTTP publicado nao incorpora PII.');
  const publicReadOptions = {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ token: apiPublication.body.token })
  };
  const apiPublic = await apiRequest(apiPublication.body.path, publicReadOptions);
  const apiPublicJson = JSON.stringify(apiPublic.body).toLowerCase();
  check(apiPublic.response.status === 200 && apiPublic.body.readOnly === true, 'Resolucao publica entrega visao somente leitura sem token na URL.');
  check(apiPublic.response.headers.get('x-robots-tag') === 'noindex, nofollow, noarchive', 'Resposta HTTP publica envia X-Robots-Tag noindex.');
  check(apiPublic.response.headers.get('cache-control') === 'private, no-store', 'Resposta HTTP publica desabilita cache compartilhado.');
  check(!/cliente api|52998224725|cliente@example\.com|revisor@example\.com/.test(apiPublicJson), 'Resposta HTTP publica nao expoe PII conhecida.');
  const apiPublicWrite = await apiRequest(apiPublication.body.path, { method: 'PUT' });
  check(apiPublicWrite.response.status === 405 && apiPublicWrite.body.readOnly === true, 'Endpoint publico rejeita escrita.');
  check(apiPublicWrite.response.headers.get('x-robots-tag') === 'noindex, nofollow, noarchive', 'Erro publico tambem preserva noindex.');
  const apiRevocation = await apiRequest(`/api/proposal-shares/${encodeURIComponent(apiPublication.body.share.id)}/revoke`, {
    method: 'POST',
    headers: authHeaders,
    body: '{}'
  });
  check(apiRevocation.response.status === 200 && apiRevocation.body.share.status === 'revogada', 'API autenticada revoga o link.');
  const apiAfterRevocation = await apiRequest(apiPublication.body.path, publicReadOptions);
  check(apiAfterRevocation.response.status === 410, 'Resolucao publica retorna 410 apos revogacao.');

  await new Promise((resolve, reject) => apiServer.close((error) => error ? reject(error) : resolve()));
  apiServer = null;
  apiServerModule.closeInfrastructure();
  apiServerModule = null;

  const stats = repository.stats();
  const report = {
    ok: failures.length === 0,
    schema: ProposalSnapshot.SCHEMA,
    shareSchema: ProposalShare.SCHEMA,
    checks: checks.length,
    snapshots: stats.snapshots,
    shares: stats.shares,
    activeShares: stats.activeShares,
    defaultValidityDays: ProposalShare.DEFAULT_VALIDITY_DAYS,
    testedStates: ['rascunho', 'validada', 'revisada', 'publicada', 'expirada', 'revogada'],
    failures
  };
  console.log(JSON.stringify(report, null, 2));
} finally {
  if (apiServer && apiServer.listening) {
    await new Promise((resolve) => apiServer.close(resolve));
  }
  if (apiServerModule) apiServerModule.closeInfrastructure();
  if (repository) repository.close();
  delete process.env.BANCUS_DB_PATH;
  delete process.env.BANCUS_SHARE_DB_PATH;
  await fs.rm(tempDir, { recursive: true, force: true });
}

if (failures.length > 0) process.exit(1);
