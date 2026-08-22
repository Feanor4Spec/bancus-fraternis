import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function assert(condition, message) {
  if (!condition) fail(message);
}

async function read(relativePath) {
  return fs.readFile(path.join(root, relativePath), 'utf8');
}

const [
  simulatorHtml,
  appJs,
  cartJs,
  contracts,
  plan,
  map,
  readme,
  protocol
] = await Promise.all([
  read('pages/simulador.html'),
  read('js/app.js'),
  read('js/simulator-cart.js'),
  read('docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md'),
  read('docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md'),
  read('docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md'),
  read('docs/README.md'),
  read('docs/CODEX_TEST_PROTOCOL.md')
]);

const shelfIndex = simulatorHtml.indexOf('../js/shelf-engine.js');
const cartIndex = simulatorHtml.indexOf('../js/simulator-cart.js');
const appIndex = simulatorHtml.indexOf('../js/app.js');

assert(shelfIndex > -1, 'simulador.html nao carrega js/shelf-engine.js.');
assert(cartIndex > -1, 'simulador.html nao carrega js/simulator-cart.js.');
assert(appIndex > -1, 'simulador.html nao carrega js/app.js.');
assert(shelfIndex < cartIndex, 'simulator-cart.js deve carregar depois de shelf-engine.js.');
assert(cartIndex < appIndex, 'simulator-cart.js deve carregar antes de app.js.');

[
  'BFSimulatorCart',
  'createProjectItem',
  'removeProjectItem',
  'updateProjectItem',
  'renderSelectedGroupsHtml',
  'renderSelectedGroupsFooter',
  'normalizeEditValue',
  'renderStep5CartHtml',
  'applyCalculationResults'
].forEach((token) => {
  assert(cartJs.includes(token), `simulator-cart.js sem contrato ${token}.`);
  assert(appJs.includes(token) || token === 'BFSimulatorCart', `app.js nao delega ${token} para BFSimulatorCart.`);
});

const context = { window: {}, console };
vm.createContext(context);
vm.runInContext(cartJs, context, { filename: 'simulator-cart.js' });
const cart = context.window.BFSimulatorCart;

assert(cart && typeof cart.cartTotals === 'function', 'BFSimulatorCart.cartTotals indisponivel.');
assert(cart && typeof cart.createProjectItem === 'function', 'BFSimulatorCart.createProjectItem indisponivel.');
assert(cart && typeof cart.normalizeEditValue === 'function', 'BFSimulatorCart.normalizeEditValue indisponivel.');
assert(cart && typeof cart.renderStep5CartHtml === 'function', 'BFSimulatorCart.renderStep5CartHtml indisponivel.');
assert(cart && typeof cart.applyCalculationResults === 'function', 'BFSimulatorCart.applyCalculationResults indisponivel.');

const totals = cart.cartTotals([
  { quantidadeCotas: 2, valorCartaTotal: 100000 },
  { quantidadeCotas: 1, valorCartaTotal: 50000 }
]);
assert(totals.totalGrupos === 2, 'cartTotals nao conta grupos.');
assert(totals.totalCotas === 3, 'cartTotals nao soma cotas.');
assert(totals.totalCarta === 150000, 'cartTotals nao soma cartas.');

const emptyState = cart.advanceButtonState(0);
const filledState = cart.advanceButtonState(2);
assert(emptyState.disabled === true, 'advanceButtonState deveria bloquear carrinho vazio.');
assert(filledState.disabled === false && filledState.text.includes('2 grupos'), 'advanceButtonState deveria liberar carrinho preenchido.');

const sampleItem = {
  itemId: 'ITEM-1',
  codigoGrupo: '1001',
  administradora: 'Admin QA',
  iconSegmento: 'IM',
  nomeSegmento: 'Imovel',
  quantidadeCotas: 2,
  valorCartaUnitario: 100000,
  valorCartaTotal: 200000,
  prazoMeses: 120,
  taxaAdmPct: 18,
  fundoReservaPct: 2,
  mesContemplacaoAlvo: 18,
  lanceProprioPct: 10,
  lanceEmbutidoPct: 25,
  modalidadeLance: 'embutido',
  indiceReajuste: 0,
  _group: { lanceEmbutidoMaxPct: 30 }
};

const selectedHtml = cart.renderSelectedGroupsHtml([sampleItem], {
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatNumber: (value) => Number(value).toFixed(2)
});
assert(selectedHtml.includes('selected-group-row'), 'HTML de grupos selecionados sem linha publica.');
assert(selectedHtml.includes('data-item-id="ITEM-1"'), 'HTML de grupos selecionados sem data-item-id.');
assert(selectedHtml.includes('data-campo="valorCartaUnitario"'), 'HTML de grupos selecionados sem campo editavel de carta.');
const selectedControls = [...selectedHtml.matchAll(/<(?:button|input|select|summary)\b[^>]*>/g)].map((match) => match[0]);
assert(selectedControls.every((control) => /\bid="[^"]+"/.test(control)), 'Controles dos grupos selecionados precisam de IDs estáveis.');
assert(selectedControls.every((control) => /\baria-label="[^"]+"/.test(control)), 'Controles dos grupos selecionados precisam de nomes acessíveis explícitos.');

const cartHtml = cart.renderStep5CartHtml([sampleItem], {
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatNumber: (value) => Number(value).toFixed(2),
  getEffectiveLanceEmbutidoMax: () => 30
});
assert(cartHtml.includes('cart-item-card'), 'HTML do passo 5 sem card de carrinho.');
assert(cartHtml.includes('data-campo="lanceEmbutidoPct"'), 'HTML do passo 5 sem campo de lance embutido.');
assert(cartHtml.includes('Crédito líquido'), 'HTML do passo 5 sem crédito líquido calculado.');
assert(cartHtml.includes('value="embutido" selected'), 'HTML do passo 5 não preserva modalidade embutida.');
assert(cartHtml.includes('data-campo="indiceReajuste" value="0.00"'), 'HTML do passo 5 não preserva reajuste 0%.');
assert(cartHtml.includes('R$ 50000.00'), 'HTML do passo 5 não calcula o lance embutido da modalidade selecionada.');
const cartControls = [...cartHtml.matchAll(/<(?:button|input|select|summary)\b[^>]*>/g)].map((match) => match[0]);
const cartControlIds = cartControls.map((control) => control.match(/\bid="([^"]+)"/)?.[1] || '');
assert(cartControlIds.every(Boolean), 'Todos os controles do passo 5 precisam de IDs estáveis.');
assert(new Set(cartControlIds).size === cartControlIds.length, 'IDs dos controles do passo 5 precisam ser únicos.');
assert(cartControls.every((control) => /\baria-label="[^"]+"/.test(control)), 'Todos os controles do passo 5 precisam de nomes acessíveis explícitos.');
const cartHtmlRepeated = cart.renderStep5CartHtml([sampleItem], {
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`,
  formatNumber: (value) => Number(value).toFixed(2),
  getEffectiveLanceEmbutidoMax: () => 30
});
const repeatedIds = [...cartHtmlRepeated.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
const originalIds = [...cartHtml.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]);
assert(JSON.stringify(repeatedIds) === JSON.stringify(originalIds), 'IDs dos controles do passo 5 precisam permanecer estáveis entre renderizações.');

const defaultItem = cart.createProjectItem({ lanceEmbutidoMaxPct: 30 }, {
  shelfEngine: {
    createProjectItem: () => ({ modalidadeLance: 'sem_lance', lanceEmbutidoPct: 0, mesContemplacaoAlvo: 18 })
  },
  numberSetting: (_key, fallback) => fallback,
  getEffectiveLanceEmbutidoMax: () => 30
});
assert(defaultItem.modalidadeLance === 'sem_lance', 'Novo item deveria iniciar sem lance.');
assert(defaultItem.lanceEmbutidoPct === 0, 'Novo item não deve preencher automaticamente o limite de lance embutido.');

const invalidValue = cart.normalizeEditValue('valorCartaUnitario', '0', sampleItem, {
  formatNumber: (value) => Number(value).toFixed(2)
});
assert(invalidValue.ok === false && invalidValue.message, 'normalizeEditValue deveria recusar carta zerada.');

const cappedMonth = cart.normalizeEditValue('mesContemplacaoAlvo', '200', sampleItem);
assert(cappedMonth.ok === true && cappedMonth.value === 120, 'normalizeEditValue deveria limitar mes ao prazo.');

const cappedBid = cart.normalizeEditValue('lanceEmbutidoPct', '80', sampleItem, {
  getEffectiveLanceEmbutidoMax: () => 30
});
assert(cappedBid.ok === true && cappedBid.value === 30, 'normalizeEditValue deveria limitar lance embutido.');
const legacyOwnMode = cart.normalizeEditValue('modalidadeLance', 'proprio', sampleItem);
assert(legacyOwnMode.ok === true && legacyOwnMode.value === 'livre', 'Modalidade legada proprio deveria virar livre.');

const kpis = cart.renderDashboardKpis({
  totalCarta: 100000,
  cartaLiquida: 80000,
  totalGrupos: 1,
  totalCotas: 2
}, {
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`
});
assert(kpis.length === 10, 'renderDashboardKpis deveria devolver 10 KPIs.');
assert(kpis.some((item) => item.label === 'Crédito total'), 'renderDashboardKpis deveria exibir Crédito total.');
assert(kpis.some((item) => item.label === 'Crédito disponível após lance'), 'renderDashboardKpis deveria explicar o crédito após lance.');

const updatedValues = {};
const fakeCard = {
  querySelector(selector) {
    return {
      set textContent(value) {
        updatedValues[selector] = value;
      }
    };
  }
};
const fakeRoot = {
  querySelector(selector) {
    return selector.includes('ITEM-1') ? fakeCard : null;
  }
};
const updated = cart.applyCalculationResults([{
  item: { itemId: 'ITEM-1' },
  lanceProprioR: 1000,
  lanceEmbutidoR: 2000,
  lanceTotalR: 4000,
  cartaLiquida: 97000
}], {
  root: fakeRoot,
  formatMoney: (value) => `R$ ${Number(value).toFixed(2)}`
});
assert(updated === 1, 'applyCalculationResults deveria atualizar um card.');
assert(updatedValues['.dyn-val-lancetot'] === 'R$ 4000.00', 'applyCalculationResults não usou o lance total aplicado pelo motor.');

[
  'BFSimulatorCart',
  'tools/validate-simulator-cart.mjs'
].forEach((contract) => {
  assert(contracts.includes(contract), `Contratos publicos sem ${contract}.`);
  assert(plan.includes(contract) || map.includes(contract) || readme.includes(contract), `Docs de produto sem ${contract}.`);
  const protocolToken = contract.replace(/\//g, '\\');
  assert(protocol.includes(contract) || protocol.includes(protocolToken) || contract === 'BFSimulatorCart', `Protocolo de testes sem ${contract}.`);
});

const report = {
  ok: failures.length === 0,
  scriptOrder: {
    shelfBeforeCart: shelfIndex < cartIndex,
    cartBeforeApp: cartIndex < appIndex
  },
  totals,
  selectedHtml: selectedHtml.length,
  cartHtml: cartHtml.length,
  defaultBid: {
    modality: defaultItem.modalidadeLance,
    embeddedPercent: defaultItem.lanceEmbutidoPct
  },
  legacyOwnMode: legacyOwnMode.value,
  updatedCards: updated,
  failures
};

await fs.mkdir(path.join(root, 'docs/test-reports'), { recursive: true });
await fs.writeFile(
  path.join(root, 'docs/test-reports/simulator-cart-report.json'),
  JSON.stringify(report, null, 2)
);

console.log(JSON.stringify(report, null, 2));
if (failures.length > 0) process.exit(1);
