import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

const root = process.cwd();
const failures = [];

function fail(message) {
  failures.push(message);
}

function getPath(value, dotPath) {
  if (!dotPath) return value;
  return String(dotPath).split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), value);
}

async function readJson(relativePath) {
  const text = await fs.readFile(path.join(root, relativePath), 'utf8');
  return JSON.parse(text);
}

async function fileExists(relativePath) {
  try {
    await fs.access(path.join(root, relativePath));
    return true;
  } catch {
    return false;
  }
}

const [catalog, premissas, goldenTests] = await Promise.all([
  readJson('assets/data/calculadoras.json'),
  readJson('assets/data/calculadoras-premissas.json'),
  readJson('assets/data/calculadoras-golden-tests.json')
]);

if (!Array.isArray(catalog) || catalog.length !== 19) fail(`Catalogo deveria ter 19 calculadoras, encontrou ${Array.isArray(catalog) ? catalog.length : 'formato invalido'}.`);
if (!Array.isArray(goldenTests) || goldenTests.length < 12) fail('Golden tests insuficientes para cobrir formulas principais.');

const slugs = new Set();
const categories = new Set();
const requiredSlugs = ['capacidade-credito', 'lance-consorcio'];
for (const calc of catalog) {
  ['slug', 'nome', 'tipo', 'categoria', 'resumo', 'pergunta', 'formula', 'risco'].forEach((key) => {
    if (!calc[key]) fail(`${calc.slug || calc.nome || 'calculadora'} sem campo obrigatorio: ${key}.`);
  });
  if (slugs.has(calc.slug)) fail(`Slug duplicado: ${calc.slug}.`);
  slugs.add(calc.slug);
  categories.add(calc.categoria);

  if (!Array.isArray(calc.fields) || calc.fields.length === 0) fail(`${calc.slug} sem fields.`);
  for (const field of calc.fields || []) {
    if (!field.name || !field.label) fail(`${calc.slug} possui field sem name/label.`);
    if (!Object.prototype.hasOwnProperty.call(field, 'default')) fail(`${calc.slug}.${field.name} sem default.`);
  }
  for (const related of calc.related || []) {
    if (!catalog.some((item) => item.slug === related)) fail(`${calc.slug} referencia related inexistente: ${related}.`);
  }

  const pagePath = `pages/calculadora-${calc.slug}.html`;
  if (!(await fileExists(pagePath))) fail(`Pagina ausente para ${calc.slug}: ${pagePath}.`);
}

for (const slug of requiredSlugs) {
  if (!slugs.has(slug)) fail(`Catalogo sem calculadora obrigatoria do ciclo: ${slug}.`);
}

const requiredPremissas = ['selicAnual', 'cdiAnual', 'ipcaAnual', 'trAnual', 'poupancaMes'];
for (const key of requiredPremissas) {
  if (!Number.isFinite(Number(premissas?.indices?.[key]))) fail(`Premissa ausente ou invalida: indices.${key}.`);
}
if (!Array.isArray(premissas.irRegressivo) || premissas.irRegressivo.length < 4) fail('Tabela de IR regressivo incompleta.');

const serviceText = await fs.readFile(path.join(root, 'assets/js/services/calculadoras.service.js'), 'utf8');
for (const slug of slugs) {
  if (!serviceText.includes(`case '${slug}':`)) fail(`Servico de calculadoras nao implementa slug: ${slug}.`);
}

const pageText = await fs.readFile(path.join(root, 'assets/js/calculadoras-page.js'), 'utf8');
if (!pageText.includes('persist: false')) fail('Pagina de calculadora deve gerar previa inicial com persist:false.');
if (!pageText.includes('persist: true')) fail('Submit da calculadora deve declarar persist:true.');
if (pageText.includes("form.dispatchEvent(new Event('submit'")) fail('Pagina de calculadora ainda dispara submit automatico no carregamento.');
if (!pageText.includes('data-calculator-result-mode')) fail('Resultado da calculadora deve expor data-calculator-result-mode.');
if (!pageText.includes('data-calculator-form-alert')) fail('Formulario da calculadora deve expor alerta de validacao.');
if (!pageText.includes('data-calculator-coherence-alert')) fail('Formulario da calculadora deve expor alerta de coerencia.');
if (!pageText.includes('data-calculator-field-error')) fail('Formulario da calculadora deve expor erro por campo.');
if (!pageText.includes('validateForm(form, meta)')) fail('Formulario da calculadora deve validar antes de simular.');
if (!pageText.includes('coherenceAlerts(meta.slug, values)')) fail('Formulario da calculadora deve calcular alertas de coerencia.');

const formulaContext = { window: {}, console };
vm.createContext(formulaContext);
const formulaText = await fs.readFile(path.join(root, 'assets/js/formulas/financial.formulas.js'), 'utf8');
vm.runInContext(formulaText, formulaContext, { filename: 'financial.formulas.js' });
const formulas = formulaContext.window.BFFinancialFormulas;

for (const test of goldenTests) {
  const fn = formulas[test.fn];
  if (typeof fn !== 'function') {
    fail(`Golden test ${test.id} aponta para funcao ausente: ${test.fn}.`);
    continue;
  }
  const raw = fn.apply(null, test.args || []);
  const actual = Number(getPath(raw, test.path));
  const expected = Number(test.expected);
  const tolerance = Number(test.tolerance || 0);
  const diff = Math.abs(actual - expected);
  if (!Number.isFinite(actual) || diff > tolerance) {
    fail(`${test.id} falhou: esperado ${expected}, obtido ${actual}, diff ${diff}, tolerancia ${tolerance}.`);
  }
}

const summary = {
  ok: failures.length === 0,
  calculators: catalog.length,
  categories: categories.size,
  goldenTests: goldenTests.length,
  premissasReferencia: premissas.referencia,
  failures
};

console.log(JSON.stringify(summary, null, 2));
if (failures.length > 0) process.exit(1);
