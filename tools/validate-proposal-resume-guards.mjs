import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function check(id, condition, evidence) {
  if (!condition) failures.push({ id, evidence });
}

const guardSource = await fs.readFile(path.join(root, 'js/proposal-resume-guard.js'), 'utf8');
const guardContext = vm.createContext({ window: {} });
vm.runInContext(guardSource, guardContext, { filename: 'proposal-resume-guard.js' });
const guard = guardContext.window.BFProposalResumeGuard;

check('guard.available', !!guard, 'BFProposalResumeGuard indisponível.');
check('guard.client-query-tamper', guard.isClientReadOnly({
  role: 'cliente',
  proposalId: 'PROP-2026-0100',
  proposalView: '',
  hash: ''
}) === true, 'Cliente perdeu o modo de leitura ao remover proposalView.');
check('guard.team-keeps-editing', guard.isClientReadOnly({
  role: 'consultor',
  proposalId: 'PROP-2026-0100',
  proposalView: 'client',
  hash: '#proposta'
}) === false, 'Consultor foi bloqueado pelo marcador de apresentação.');
check('guard.consultant-interest-review-readonly', guard.isClientReadOnly({
  role: 'consultor',
  proposalId: 'PROP-2026-0100',
  proposalVersionId: 'PV-2026-0100-2',
  proposalView: 'review',
  interestId: 'LEAD-PI-A1B2C3D4',
  backendReadOnly: true,
  hash: '#proposta'
}) === true, 'Consultor não ficou em modo de leitura na retomada autorizada do atendimento.');
check('guard.admin-interest-review-readonly', guard.isClientReadOnly({
  role: 'admin',
  proposalId: 'PROP-2026-0100',
  proposalView: 'review',
  interestId: 'LEAD-PI-ABC123',
  backendReadOnly: true,
  hash: '#proposta'
}) === true, 'Administrador não ficou em modo de leitura na retomada autorizada do atendimento.');
check('guard.stripped-review-marker-stays-readonly', guard.isClientReadOnly({
  role: 'consultor',
  proposalId: 'PROP-2026-0100',
  proposalView: '',
  interestId: 'LEAD-PI-A1B2C3D4',
  backendReadOnly: true,
  hash: '#proposta'
}) === true, 'Remover proposalView desativou o modo de leitura autorizado pelo backend.');
check('guard.unverified-interest-keeps-team-editing', guard.isClientReadOnly({
  role: 'consultor',
  proposalId: 'PROP-2026-0100',
  proposalView: 'review',
  interestId: 'LEAD-PI-INVALIDO',
  backendReadOnly: false,
  hash: '#proposta'
}) === false, 'Identificador de atendimento inválido ativou acesso de revisão.');
check('guard.consultant-review-never-recalculates', guard.shouldRecalculateProject({
  clientReadOnly: guard.isClientReadOnly({
    role: 'consultor',
    proposalId: 'PROP-2026-0100',
    proposalView: 'review',
    interestId: 'LEAD-PI-A1B2C3D4',
    backendReadOnly: true
  }),
  reconciled: false
}) === false, 'Retomada do consultor tentou recalcular o snapshot congelado.');
check('guard.anonymous-fails-closed', guard.isClientReadOnly({
  role: '',
  proposalView: 'client',
  hash: '#proposta'
}) === true, 'Visualização sem papel autenticado não falhou em modo restrito.');
check('guard.normal-client-simulation', guard.isClientReadOnly({
  role: 'cliente',
  targetStep: 10,
  proposalView: '',
  proposalId: '',
  hash: ''
}) === false, 'Simulação normal do cliente foi bloqueada sem intenção de proposta.');

const exact = guard.resolveLink({
  proposalId: 'PROP-2026-0100',
  explicitSimulationId: 'SIM-100',
  linkedSimulationId: 'SIM-100'
});
const mismatch = guard.resolveLink({
  proposalId: 'PROP-2026-0100',
  explicitSimulationId: 'SIM-ERRADA',
  linkedSimulationId: 'SIM-100'
});
const missingVersionProposal = guard.resolveLink({
  proposalVersionId: 'PV-100',
  explicitSimulationId: 'SIM-100'
});
check('guard.exact-link', exact.ok && exact.simulationId === 'SIM-100', exact);
check('guard.proposal-only-mismatch', mismatch.ok === false && mismatch.reason === 'simulation-mismatch', mismatch);
check('guard.version-needs-proposal', missingVersionProposal.ok === false, missingVersionProposal);
check('guard.readonly-never-recalculates', guard.shouldRecalculateProject({
  clientReadOnly: true,
  reconciled: false
}) === false, 'Snapshot readonly divergente tentou acionar novo calculo.');
check('guard.team-can-reconcile', guard.shouldRecalculateProject({
  clientReadOnly: false,
  reconciled: false
}) === true, 'Edicao da equipe perdeu a reconciliacao automatica existente.');

const integritySource = await fs.readFile(path.join(root, 'js/proposal-integrity.js'), 'utf8');
const integrityContext = vm.createContext({ window: {} });
vm.runInContext(integritySource, integrityContext, { filename: 'proposal-integrity.js' });
const integrity = integrityContext.window.BFProposalIntegrity;
const protectedFingerprint = integrity.calculationFingerprint({ nomeCliente: 'Dados protegidos', valorCarta: 100000, eventos: [{ mes: 12, valor: 10000 }] });
const privateFingerprint = integrity.calculationFingerprint({ nomeCliente: '', valorCarta: 100000, eventos: [{ valor: 10000, mes: 12 }] });
const editedFingerprint = integrity.calculationFingerprint({ nomeCliente: '', valorCarta: 110000, eventos: [{ mes: 12, valor: 10000 }] });
const comparisonFingerprint = integrity.comparisonFingerprint({ selection: { a: '0', b: '1' }, scenario: { indice: 5 }, groups: ['A', 'B'] });
const changedComparisonFingerprint = integrity.comparisonFingerprint({ selection: { a: '0', b: '1' }, scenario: { indice: 6 }, groups: ['A', 'B'] });
const acceptedContentFingerprint = integrity.proposalContentFingerprint({
  proposalId: 'PROP-ROUNDTRIP',
  params: {
    valorCarta: 100000,
    nomeCliente: 'Cliente privado',
    clienteEmail: 'cliente@example.com',
    consultor: 'Consultor privado',
    consultorCodigo: 'CONS-PRIVADO'
  },
  result: { totalPago: 115000, proposalData: { nomeCliente: 'Cliente privado', codigoGrupo: 'G-100' } },
  comparison: { winner: 'A' },
  builder: { sections: { resumo: true } }
});
const redactedContentFingerprint = integrity.proposalContentFingerprint({
  proposalId: 'PROP-ROUNDTRIP',
  params: { valorCarta: 100000, nomeCliente: 'Dados protegidos' },
  result: { totalPago: 115000, proposalData: { cliente: 'Dados protegidos', codigoGrupo: 'G-100' } },
  comparison: { winner: 'A' },
  builder: { sections: { resumo: true } }
});
const changedContentFingerprint = integrity.proposalContentFingerprint({
  proposalId: 'PROP-ROUNDTRIP',
  params: { valorCarta: 120000 },
  result: { totalPago: 138000 },
  comparison: { winner: 'B' },
  builder: { sections: { resumo: true } }
});
check('integrity.available', !!integrity, 'BFProposalIntegrity indisponível.');
check('integrity.placeholder-neutral', protectedFingerprint === privateFingerprint, { protectedFingerprint, privateFingerprint });
check('integrity.changed-calculation', editedFingerprint !== privateFingerprint, { editedFingerprint, privateFingerprint });
check('integrity.changed-comparison', comparisonFingerprint !== changedComparisonFingerprint, { comparisonFingerprint, changedComparisonFingerprint });
check('integrity.acceptance-current', integrity.acceptanceMatchesContent({ sourceHash: acceptedContentFingerprint }, acceptedContentFingerprint), acceptedContentFingerprint);
check('integrity.proposal-content-ignores-pii', acceptedContentFingerprint === redactedContentFingerprint, {
  acceptedContentFingerprint,
  redactedContentFingerprint
});
check('integrity.acceptance-stale', !integrity.acceptanceMatchesContent({ sourceHash: acceptedContentFingerprint }, changedContentFingerprint), {
  acceptedContentFingerprint,
  changedContentFingerprint
});

const storageSource = await fs.readFile(path.join(root, 'js/storage.js'), 'utf8');
const simulatorStateSource = await fs.readFile(path.join(root, 'js/simulator-state.js'), 'utf8');
check('acceptance.snapshot-contract', simulatorStateSource.includes('sourceHash,')
  && simulatorStateSource.includes("acceptance.updatedAt || null")
  && simulatorStateSource.includes('version: Math.max(0, parseInt(acceptance.version'), 'Snapshot da simulacao descarta a identidade do aceite.');
const memory = new Map();
const storageContext = vm.createContext({
  console,
  localStorage: {
    getItem(key) { return memory.has(key) ? memory.get(key) : null; },
    setItem(key, value) { memory.set(key, String(value)); },
    removeItem(key) { memory.delete(key); }
  },
  window: {}
});
vm.runInContext(storageSource, storageContext, { filename: 'storage.js' });
const StorageService = vm.runInContext('Storage', storageContext);
const proposalSnapshotStorageKey = 'consorciopro_proposal_version_snapshots';
const privateConsultantKeys = new Set([
  'consultorempresa', 'empresaconsultor', 'consultorcodigo', 'codigoconsultor',
  'consultantcompany', 'companyconsultant', 'consultantcode', 'codeconsultant',
  'advisorcompany', 'advisorcode'
]);
const normalizeSnapshotKey = (value) => String(value == null ? '' : value)
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9]/g, '')
  .toLowerCase();
const privateConsultantPaths = (value, pathLabel = '$') => {
  if (Array.isArray(value)) {
    return value.flatMap((item, index) => privateConsultantPaths(item, `${pathLabel}[${index}]`));
  }
  if (!value || typeof value !== 'object') return [];
  return Object.entries(value).flatMap(([key, entry]) => {
    const path = `${pathLabel}.${key}`;
    return [
      ...(privateConsultantKeys.has(normalizeSnapshotKey(key)) ? [path] : []),
      ...privateConsultantPaths(entry, path)
    ];
  });
};
StorageService.saveSimulation('Proposta teste', {
  id: 'SIM-ROUNDTRIP',
  proposalId: 'PROP-ROUNDTRIP',
  privacy: { localPIIStored: false, notice: 'Dados protegidos.' },
  comparison: { winner: 'A', delta: 1200 },
  proposalAcceptance: {
    id: 'REV-ROUNDTRIP-1',
    proposalId: 'PROP-ROUNDTRIP',
    status: 'reviewed',
    version: 1,
    sourceHash: acceptedContentFingerprint,
    validUntil: '2026-12-31',
    checklist: { premissas: true, cliente: true, documentacao: true }
  },
  params: { valorCarta: 100000 },
  resultado: { cronograma: [], resumo: { creditoTotal: 100000 } }
});
const restored = StorageService.loadSimulation('SIM-ROUNDTRIP');
check('storage.proposal-id', restored?.proposalId === 'PROP-ROUNDTRIP', restored);
check('storage.privacy', restored?.privacy?.localPIIStored === false, restored?.privacy);
check('storage.comparison', restored?.comparison?.winner === 'A' && restored?.comparison?.delta === 1200, restored?.comparison);
check('storage.acceptance', restored?.proposalAcceptance?.proposalId === 'PROP-ROUNDTRIP'
  && restored?.proposalAcceptance?.status === 'reviewed'
  && restored?.proposalAcceptance?.id === 'REV-ROUNDTRIP-1'
  && restored?.proposalAcceptance?.version === 1
  && restored?.proposalAcceptance?.sourceHash === acceptedContentFingerprint
  && restored?.proposalAcceptance?.checklist?.documentacao === true, restored?.proposalAcceptance);

storageContext.window.BFAuth = { getCurrentUser: () => ({ email: 'ator-autenticado@example.com' }) };
memory.set(proposalSnapshotStorageKey, JSON.stringify([{
  id: 'SIM-PV-LEGACY-PRIVATE',
  proposalId: 'PROP-HISTORY',
  params: {
    valorCarta: 90000,
    codigoGrupo: 'G-LEGACY-PRESERVADO',
    Consultor_Empresa: 'Empresa legada privada',
    'CONSULTOR-CÓDIGO': 'COD-LEGADO-PRIVADO'
  },
  formSnapshot: {
    consultantCompany: { type: 'text', value: 'Empresa legacy alias' },
    CONSULTANT_CODE: { type: 'text', value: 'CODE-LEGACY-ALIAS' },
    nomeAdministradora: { type: 'text', value: 'Administradora legada preservada' }
  }
}]));
const legacyPrivateRestored = StorageService.loadSimulation('SIM-PV-LEGACY-PRIVATE');
const migratedLegacySnapshotsRaw = memory.get(proposalSnapshotStorageKey) || '';
check('storage.legacy-consultant-privacy', legacyPrivateRestored?.params?.codigoGrupo === 'G-LEGACY-PRESERVADO'
  && legacyPrivateRestored?.formSnapshot?.nomeAdministradora?.value === 'Administradora legada preservada'
  && !migratedLegacySnapshotsRaw.includes('Empresa legada privada')
  && !migratedLegacySnapshotsRaw.includes('COD-LEGADO-PRIVADO')
  && !migratedLegacySnapshotsRaw.includes('Empresa legacy alias')
  && !migratedLegacySnapshotsRaw.includes('CODE-LEGACY-ALIAS')
  && privateConsultantPaths(JSON.parse(migratedLegacySnapshotsRaw || '[]')).length === 0,
{ restored: legacyPrivateRestored, raw: migratedLegacySnapshotsRaw });

const historicalOne = StorageService.saveProposalVersionSnapshot('Snapshot PROP-HISTORY', {
  id: 'SIM-PV-HISTORY-1',
  proposalId: 'PROP-HISTORY',
  cliente: 'Cliente que nao pode persistir',
  clienteEmail: 'historico@example.com',
  privacy: { localPIIStored: true },
  params: {
    valorCarta: 100000,
    nomeCliente: 'Cliente que nao pode persistir',
    nomeAdministradora: 'Administradora comercial preservada',
    codigoGrupo: 'G-COMERCIAL-100',
    consultorEmpresa: 'Empresa privada do consultor',
    CONSULTOR_CODIGO: 'COD-PRIVADO-100',
    contexto: {
      Consultor_Empresa: 'Empresa privada aninhada',
      'consultor-código': 'COD-PRIVADO-ANINHADO',
      nomeProduto: 'Consorcio comercial preservado'
    }
  },
  formSnapshot: {
    valorCarta: { type: 'text', value: '100000' },
    clienteEmail: { type: 'email', value: 'historico@example.com' },
    ConsultantCompany: { type: 'text', value: 'Empresa privada alias' },
    CONSULTANT_CODE: { type: 'text', value: 'CODE-PRIVADO-ALIAS' },
    nomeAdministradora: { type: 'text', value: 'Administradora comercial preservada' },
    codigoGrupo: { type: 'text', value: 'G-COMERCIAL-100' }
  },
  resultado: {
    cronograma: [{ mes: 1, parcela: 1000 }],
    resumo: { creditoTotal: 100000 },
    proposalData: {
      clienteEmail: 'aninhado@example.com',
      nomeCliente: 'Pessoa aninhada',
      empresaConsultor: 'Empresa privada no resultado',
      codigoConsultor: 'COD-PRIVADO-RESULTADO',
      codigoGrupo: 'G-COMERCIAL-100'
    }
  },
  proposalAcceptance: {
    id: 'REV-HISTORY-2',
    proposalId: 'PROP-HISTORY',
    status: 'reviewed',
    sourceHash: acceptedContentFingerprint,
    version: 2,
    createdAt: '2026-08-22T12:00:00.000Z',
    updatedAt: '2026-08-22T12:05:00.000Z',
    validUntil: '2026-12-31',
    reviewer: 'Pessoa que nao pode persistir',
    notes: 'Nota privada',
    checklist: { premissas: true, cliente: true, documentacao: true }
  }
});
const historicalTwo = StorageService.saveProposalVersionSnapshot('Snapshot PROP-HISTORY', {
  id: 'SIM-PV-HISTORY-2',
  proposalId: 'PROP-HISTORY',
  params: { valorCarta: 120000 },
  resultado: { cronograma: [{ mes: 1, parcela: 1200 }], resumo: { creditoTotal: 120000 } }
});
const historicalOneRestored = StorageService.loadSimulation('SIM-PV-HISTORY-1');
const historicalTwoRestored = StorageService.loadSimulation('SIM-PV-HISTORY-2');
const visibleSimulations = StorageService.loadSimulations({ includeDetails: true });
const rawHistoricalSnapshots = memory.get(proposalSnapshotStorageKey) || '';
const parsedHistoricalSnapshots = JSON.parse(rawHistoricalSnapshots || '[]');
const leakedConsultantPaths = privateConsultantPaths(parsedHistoricalSnapshots);
check('storage.historical-distinct', historicalOne?.id !== historicalTwo?.id
  && historicalOneRestored?.resultado?.resumo?.creditoTotal === 100000
  && historicalTwoRestored?.resultado?.resumo?.creditoTotal === 120000,
{ historicalOneRestored, historicalTwoRestored });
check('storage.historical-hidden-from-simulations', !visibleSimulations.some((item) => item.id.startsWith('SIM-PV-HISTORY-')), visibleSimulations);
check('storage.historical-acceptance-identity', historicalOneRestored?.proposalAcceptance?.id === 'REV-HISTORY-2'
  && historicalOneRestored?.proposalAcceptance?.version === 2
  && historicalOneRestored?.proposalAcceptance?.sourceHash === acceptedContentFingerprint,
historicalOneRestored?.proposalAcceptance);
check('storage.historical-privacy', historicalOneRestored?.privacy?.localPIIStored === false
  && historicalOneRestored?.cliente === 'Dados protegidos'
  && !rawHistoricalSnapshots.includes('historico@example.com')
  && !rawHistoricalSnapshots.includes('Cliente que nao pode persistir')
  && !rawHistoricalSnapshots.includes('aninhado@example.com')
  && !rawHistoricalSnapshots.includes('Pessoa aninhada')
  && !rawHistoricalSnapshots.includes('ator-autenticado@example.com')
  && !rawHistoricalSnapshots.includes('Pessoa que nao pode persistir')
  && !rawHistoricalSnapshots.includes('Nota privada')
  && !rawHistoricalSnapshots.includes('Empresa privada do consultor')
  && !rawHistoricalSnapshots.includes('COD-PRIVADO-100')
  && !rawHistoricalSnapshots.includes('Empresa privada aninhada')
  && !rawHistoricalSnapshots.includes('COD-PRIVADO-ANINHADO')
  && !rawHistoricalSnapshots.includes('Empresa privada alias')
  && !rawHistoricalSnapshots.includes('CODE-PRIVADO-ALIAS')
  && !rawHistoricalSnapshots.includes('Empresa privada no resultado')
  && !rawHistoricalSnapshots.includes('COD-PRIVADO-RESULTADO')
  && leakedConsultantPaths.length === 0, { rawHistoricalSnapshots, leakedConsultantPaths });
check('storage.historical-commercial-data', historicalOneRestored?.params?.valorCarta === 100000
  && historicalOneRestored?.params?.nomeAdministradora === 'Administradora comercial preservada'
  && historicalOneRestored?.params?.codigoGrupo === 'G-COMERCIAL-100'
  && historicalOneRestored?.params?.contexto?.nomeProduto === 'Consorcio comercial preservado'
  && historicalOneRestored?.formSnapshot?.nomeAdministradora?.value === 'Administradora comercial preservada'
  && historicalOneRestored?.formSnapshot?.codigoGrupo?.value === 'G-COMERCIAL-100'
  && historicalOneRestored?.resultado?.proposalData?.codigoGrupo === 'G-COMERCIAL-100', historicalOneRestored);

const versioningSource = await fs.readFile(path.join(root, 'js/proposal-versioning.js'), 'utf8');
vm.runInContext(versioningSource, storageContext, { filename: 'proposal-versioning.js' });
const versioning = storageContext.window.BFProposalVersions;
const versionProposal = {
  id: 'PROP-HISTORY',
  metrics: { creditoTotal: 100000, parcelaAtual: 1000 },
  lances: { lanceTotal: 10000 },
  project: { itens: [{ codigoGrupo: 'G-1', valorCartaTotal: 100000, quantidadeCotas: 1, prazoMeses: 100 }] }
};
const versionSnapshotOne = versioning.snapshot(versionProposal, { simulationId: 'SIM-PV-HISTORY-1' });
const versionSnapshotTwo = versioning.snapshot(versionProposal, { simulationId: 'SIM-PV-HISTORY-2' });
const versionOne = versioning.save(versionProposal, { simulationId: 'SIM-PV-HISTORY-1', forceNew: true });
const versionTwo = versioning.save({
  ...versionProposal,
  metrics: { ...versionProposal.metrics, creditoTotal: 120000, parcelaAtual: 1200 }
}, { simulationId: 'SIM-PV-HISTORY-2', forceNew: true });
check('version.content-hash-ignores-storage-id', versionSnapshotOne.sourceHash === versionSnapshotTwo.sourceHash, {
  first: versionSnapshotOne.sourceHash,
  second: versionSnapshotTwo.sourceHash
});
check('version.historical-snapshot-ids', versionOne?.simulationId === 'SIM-PV-HISTORY-1'
  && versionTwo?.simulationId === 'SIM-PV-HISTORY-2'
  && versionOne.simulationId !== versionTwo.simulationId, { versionOne, versionTwo });
check('storage.clear-includes-history', StorageService.clearAll() === true
  && JSON.parse(memory.get('consorciopro_simulations') || '[]').length === 0
  && JSON.parse(memory.get(proposalSnapshotStorageKey) || '[]').length === 0,
{ simulations: memory.get('consorciopro_simulations'), snapshots: memory.get(proposalSnapshotStorageKey) });

const appSource = await fs.readFile(path.join(root, 'js/app.js'), 'utf8');
const proposalExperienceSource = await fs.readFile(path.join(root, 'js/proposal-experience.js'), 'utf8');
const backendHydrationGate = appSource.match(/async function hydrateRequestedSimulationFromBackend\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function resumeRequiresBackendAuthorization/);
const documentGate = appSource.match(/function proposalDocumentIssues\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function proposalAcceptanceHasCurrentValidity/);
const releaseGate = appSource.match(/function proposalReleaseIssues\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  async function exportarPDF/);
const exportGate = appSource.match(/async function exportarPDF\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function imprimirProposta/);
check('pdf.document-gate-extracted', !!documentGate && !!exportGate, 'Gate do documento não encontrado.');
check('pdf.document-independent', !!documentGate
  && !documentGate[1].includes('compResult')
  && !documentGate[1].includes('getCurrentProposalAcceptance')
  && !documentGate[1].includes('collectStepErrors'), documentGate?.[1]);
check('pdf.document-complete', !!documentGate
  && documentGate[1].includes('resultado.cronograma')
  && documentGate[1].includes('proposalCalculationMatchesCurrentForm()')
  && documentGate[1].includes('proposalBuilderReadinessIssues(getProposalBuilderConfig())'), documentGate?.[1]);
check('send.strict-gate', !!releaseGate
  && releaseGate[1].includes('proposalDocumentIssues()')
  && releaseGate[1].includes('compResult')
  && releaseGate[1].includes('getCurrentProposalAcceptance')
  && releaseGate[1].includes("['premissas', 'cliente', 'documentacao']")
  && releaseGate[1].includes('proposalAcceptanceHasCurrentValidity'), releaseGate?.[1]);
check('pdf.uses-document-gate', !!exportGate
  && exportGate[1].includes('proposalDocumentIssues()')
  && !exportGate[1].includes('proposalReleaseIssues()'), exportGate?.[1]);
const ensureGate = appSource.match(/function ensureCurrentProjectResult\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function calcular/);
const calculationGate = appSource.match(/function calcular\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  \/\/ .*Renderiza/);
check('readonly.ensure-guard-before-calculation', !!ensureGate
  && ensureGate[1].includes('clientProposalReadOnly')
  && ensureGate[1].includes('shouldRecalculateProject')
  && ensureGate[1].indexOf('shouldRecalculateProject') < ensureGate[1].indexOf('calcular()'), ensureGate?.[1]);
check('readonly.direct-calculation-blocked', !!calculationGate
  && calculationGate[1].includes('if (clientProposalReadOnly)')
  && calculationGate[1].includes("document.body.dataset.proposalSnapshotIntegrity = 'preserved'")
  && calculationGate[1].indexOf('if (clientProposalReadOnly)') < calculationGate[1].indexOf('const params = getParams()'),
  calculationGate?.[1]);
check('readonly.interest-context-forwarded', appSource.includes("interestId: search.get('interestId') || ''"),
  'O identificador do atendimento não chega ao guard de retomada.');
check('readonly.backend-authorization-context-forwarded', appSource.includes('backendReadOnly: backendReadOnlyResumeSimulationIds.has(')
  && appSource.includes('if (response.readOnly === true)'),
  'O modo de leitura ainda depende apenas de parâmetros controlados pela URL.');
check('readonly.backend-signal-forces-proposal-step', appSource.includes('const backendReadOnly = backendReadOnlyResumeSimulationIds.has(id);')
  && appSource.includes('const proposalTarget = backendReadOnly')
  && appSource.includes('targetStep: proposalTarget ? 10 : null'),
  'Retomada read-only autorizada ainda pode cair em uma etapa editável.');
check('readonly.interest-always-reauthorizes', !!backendHydrationGate
  && backendHydrationGate[1].includes('if (!requiresBackendAuthorization && Storage.loadSimulation(simulationId)) return true;')
  && backendHydrationGate[1].includes('backendResumeSimulationIds.delete(simulationId);')
  && backendHydrationGate[1].includes('backendResumeSimulations.delete(simulationId);')
  && backendHydrationGate[1].includes('api.getSimulation(simulationId, { interestId })')
  && backendHydrationGate[1].includes('Storage.deleteSimulation(simulationId)')
  && backendHydrationGate[1].includes('Storage.deleteProposalVersionSnapshot(simulationId)')
  && backendHydrationGate[1].includes('backendResumeSimulations.set(simulationId, { simulation: hydrated, actorEmail })')
  && !backendHydrationGate[1].includes('Storage.saveProposalVersionSnapshot('),
  'Retomada por atendimento ainda pode confiar apenas no cache local.');
check('readonly.team-links-always-reauthorize', appSource.includes('function resumeRequiresBackendAuthorization(params)')
  && appSource.includes("role === 'consultor' || role === 'admin'")
  && appSource.includes("params?.get?.('simulationId')")
  && appSource.includes("params?.get?.('proposalVersionId')")
  && appSource.includes("|| params.get('simulationId')")
  && appSource.includes('resumeRequiresBackendAuthorization(params) && !hydrated'),
  'Equipe interna ainda pode abrir proposta cacheada sem autorização atual do backend.');
check('readonly.backend-cache-account-scoped', appSource.includes('function authorizedBackendResume(simulationId)')
  && appSource.includes('entry.actorEmail === actorEmail ? entry.simulation : null')
  && appSource.includes('function authorizedLocalResume(simulationId)')
  && appSource.includes("['consultor', 'admin'].includes(role)")
  && appSource.includes('savedBy === actorEmail ? simulation : null')
  && appSource.includes('authorizedBackendResume(id) || authorizedLocalResume(id)')
  && appSource.includes("const requiresBackendAuthorization = hasInterestResume || teamResume || role === 'cliente';"),
  'Snapshot autorizado em memória não está vinculado ao usuário atual.');
check('readonly.interest-failure-stops-resume', appSource.includes('resumeRequiresBackendAuthorization(params) && !hydrated')
  && !/hydrateRequestedSimulationFromBackend\(\)[\s\S]{0,160}finally\(\(\) => carregarSimulacaoDaUrl\(\)\)/.test(appSource),
  'Falha de autorização ainda prossegue para a simulação local.');
check('readonly.experience-interest-context-forwarded', proposalExperienceSource.includes("interestId: params.get('interestId') || ''"),
  'A apresentação da proposta não recebe o contexto do atendimento.');
check('surface.interest-cta-client-only', proposalExperienceSource.includes("document.body.classList.contains('proposal-client-mode') && currentUserIsClient()")
  && proposalExperienceSource.includes("if (!document.body.classList.contains('proposal-client-mode') || !currentUserIsClient()) return;")
  && proposalExperienceSource.includes('if (!currentUserIsClient()) return;'),
  'O pedido de contato ainda pode aparecer ou ser acionado pela equipe interna.');
check('surface.readonly-return-by-role', proposalExperienceSource.includes("role === 'consultor' || role === 'admin'")
  && proposalExperienceSource.includes("? 'handoff-consultivo.html'")
  && proposalExperienceSource.includes(": 'dashboard-cliente.html'"),
  'O retorno da proposta não respeita o painel de cada papel.');
check('version.app-uses-immutable-snapshot', appSource.includes('createProposalVersionSimulationId')
  && appSource.includes('Storage.saveProposalVersionSnapshot')
  && appSource.includes('disposableSnapshotId'), 'App nao isola o snapshot antes de registrar a versao.');
check('integrity.app-uses-canonical-fingerprints', appSource.includes('BFProposalIntegrity.calculationFingerprint')
  && appSource.includes('BFProposalIntegrity.comparisonFingerprint')
  && appSource.includes('proposalComparisonIsCurrent()')
  && appSource.includes('restoreComparisonSource(compResult)'), 'App nao aplica os fingerprints aos gates e a retomada.');
check('acceptance.resume-fallback', appSource.includes('resumedProposalAcceptance')
  && appSource.includes('fallback.proposalId === proposal.id')
  && appSource.includes('sim.proposalAcceptance.proposalId === currentProposalId'), 'Aceite salvo nao e usado como fallback na retomada.');
const acceptanceResolver = appSource.match(/function getCurrentProposalAcceptance\(\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function getCurrentSimulationId/);
check('acceptance.historical-prefers-snapshot', !!acceptanceResolver
  && acceptanceResolver[1].includes('historicalResume && resumed ? resumed : (latest || resumed)'), acceptanceResolver?.[1]);
check('acceptance.bound-to-content', appSource.includes('currentProposalAcceptanceSourceHash()')
  && appSource.includes('acceptanceMatchesCurrentProposal(selected)')
  && appSource.includes('sourceHash: currentProposalAcceptanceSourceHash()')
  && releaseGate?.[1].includes('acceptance?.stale'), 'Aceite nao esta vinculado ao conteudo vigente da proposta.');
const loadSimulationGate = appSource.match(/function _carregarSimulacao\(id, options = \{\}\) \{([\s\S]*?)\r?\n  \}\r?\n\r?\n  function carregarSimulacaoDaUrl/);
check('comparison.restore-valid-or-clear', !!loadSimulationGate
  && loadSimulationGate[1].includes('const comparisonRestored = restoreComparisonSource(compResult)')
  && loadSimulationGate[1].includes('if (comparisonRestored) setComparisonOutputsVisible(true)')
  && loadSimulationGate[1].includes('else invalidateComparison()'), loadSimulationGate?.[1]);

const report = {
  ok: failures.length === 0,
  guard: {
    exact,
    mismatch,
    missingVersionProposal
  },
  integrity: {
    protectedFingerprint,
    privateFingerprint,
    editedFingerprint,
    comparisonFingerprint,
    changedComparisonFingerprint,
    acceptedContentFingerprint,
    redactedContentFingerprint,
    changedContentFingerprint
  },
  storage: {
    proposalId: restored?.proposalId || '',
    privacy: restored?.privacy || null,
    comparison: restored?.comparison || null,
    acceptance: restored?.proposalAcceptance || null,
    historicalSnapshotIds: [historicalOneRestored?.id || '', historicalTwoRestored?.id || ''],
    historicalSnapshotsPrivate: !rawHistoricalSnapshots.includes('historico@example.com')
      && leakedConsultantPaths.length === 0,
    legacyConsultantIdentifiersPurged: privateConsultantPaths(JSON.parse(migratedLegacySnapshotsRaw || '[]')).length === 0,
    commercialDataPreserved: historicalOneRestored?.params?.codigoGrupo === 'G-COMERCIAL-100'
  },
  versioning: {
    firstSimulationId: versionOne?.simulationId || '',
    secondSimulationId: versionTwo?.simulationId || '',
    contentHashStableAcrossStorageIds: versionSnapshotOne.sourceHash === versionSnapshotTwo.sourceHash
  },
  readonly: {
    divergentSnapshotRecalculated: guard.shouldRecalculateProject({ clientReadOnly: true, reconciled: false })
  },
  gates: {
    pdfIndependentFromAcceptance: !!documentGate && !documentGate[1].includes('getCurrentProposalAcceptance'),
    pdfRequiresScheduleAndBuilder: !!documentGate
      && documentGate[1].includes('resultado.cronograma')
      && documentGate[1].includes('proposalCalculationMatchesCurrentForm()')
      && documentGate[1].includes('proposalBuilderReadinessIssues(getProposalBuilderConfig())'),
    sendRequiresAcceptance: !!releaseGate
      && releaseGate[1].includes('getCurrentProposalAcceptance')
      && releaseGate[1].includes("['premissas', 'cliente', 'documentacao']")
      && releaseGate[1].includes('proposalAcceptanceHasCurrentValidity')
  },
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/proposal-resume-guards-report.json'),
  `${JSON.stringify(report, null, 2)}\n`
);
console.log(JSON.stringify(report, null, 2));
if (!report.ok) process.exit(1);
