import fs from 'node:fs/promises';
import path from 'node:path';

const root = process.cwd();
const pagesDir = path.join(root, 'pages');
const serverPath = path.join(root, 'server.js');
const failures = [];

function fail(message) {
  failures.push(message);
}

function extractPageAliases(serverSource) {
  const block = serverSource.match(/const\s+PAGE_ALIASES\s*=\s*new\s+Set\s*\(\s*\[([\s\S]*?)\]\s*\);/);
  if (!block) {
    fail('PAGE_ALIASES nao encontrado em server.js.');
    return [];
  }

  return Array.from(block[1].matchAll(/['"]([^'"]+\.html)['"]/g))
    .map((match) => match[1])
    .sort((a, b) => a.localeCompare(b));
}

async function main() {
  const [pageEntries, serverSource] = await Promise.all([
    fs.readdir(pagesDir, { withFileTypes: true }),
    fs.readFile(serverPath, 'utf8')
  ]);

  const pages = pageEntries
    .filter((entry) => entry.isFile() && entry.name.endsWith('.html'))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b));

  const aliases = extractPageAliases(serverSource);
  const pageSet = new Set(pages);
  const aliasSet = new Set(aliases);

  const missingAliases = pages.filter((page) => !aliasSet.has(page));
  const extraAliases = aliases.filter((alias) => !pageSet.has(alias));
  const duplicateAliases = aliases.filter((alias, index) => aliases.indexOf(alias) !== index);

  if (!serverSource.includes('PAGE_ALIASES.has(cleanName)')) {
    fail('server.js nao usa PAGE_ALIASES para resolver URLs curtas.');
  }

  if (!serverSource.includes('relativePath = `/pages/${cleanName}`')) {
    fail('server.js nao redireciona aliases curtos para /pages/<arquivo>.html.');
  }

  if (missingAliases.length) {
    fail(`Paginas sem alias curto: ${missingAliases.join(', ')}`);
  }

  if (extraAliases.length) {
    fail(`Aliases sem pagina correspondente: ${extraAliases.join(', ')}`);
  }

  if (duplicateAliases.length) {
    fail(`Aliases duplicados: ${Array.from(new Set(duplicateAliases)).join(', ')}`);
  }

  const result = {
    ok: failures.length === 0,
    pages: pages.length,
    aliases: aliases.length,
    missingAliases,
    extraAliases,
    failures
  };

  console.log(JSON.stringify(result, null, 2));

  if (failures.length) {
    process.exit(1);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
