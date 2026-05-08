const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = Number(process.env.PORT) || 8080;
const ROOT_DIR = __dirname;
const PAGE_ALIASES = new Set([
  'index.html',
  'educacao.html',
  'produtos.html',
  'calculadoras.html',
  'calculadoras-governanca.html',
  'calculadora-juros-compostos.html',
  'calculadora-juros-simples.html',
  'calculadora-primeiro-milhao.html',
  'calculadora-aposentadoria.html',
  'calculadora-renda.html',
  'calculadora-reserva-emergencia.html',
  'calculadora-poupanca-selic.html',
  'calculadora-renda-fixa.html',
  'calculadora-compra-vista-parcelado.html',
  'calculadora-pix-parcelado.html',
  'calculadora-alugar-financiar.html',
  'calculadora-cartoes.html',
  'calculadora-realidade-brasileira.html',
  'calculadora-rentabilidade.html',
  'calculadora-acoes.html',
  'calculadora-cdb.html',
  'calculadora-capacidade-credito.html',
  'calculadora-lance-consorcio.html',
  'calculadora-custos-fixos.html',
  'comparador.html',
  'dados-abertos.html',
  'api-docs.html',
  'compliance.html',
  'componentes-v8.html',
  'lousa-navegacao.html',
  'login.html',
  'simulador.html',
  'simulador-consorcio.html',
  'simulador-financiamento.html',
  'simulador-veiculos.html',
  'simulador-cdc.html',
  'simulador-garantia.html',
  'simulador-consignado.html',
  'dashboard-cliente.html',
  'dashboard-admin.html',
  'assembleias.html',
  'carteira.html',
  'handoff-consultivo.html',
  'modelos-biblioteca.html',
  'modelos-governanca.html',
  'configuracoes.html',
  'duvidas.html',
  'sobre-nos.html',
  'trilha-decisao.html',
  'consorcio_user_journey_map_v2.html',
  'index_v4_paginas.html',
  'index_2.html'
]);

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.csv': 'text/csv; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon'
};

function resolveRequestPath(reqUrl) {
  const rawPath = (reqUrl || '/').split('?')[0].split('#')[0];
  const decodedPath = decodeURIComponent(rawPath);
  let relativePath = decodedPath === '/' ? '/pages/index.html' : decodedPath;
  const cleanName = relativePath.replace(/^\/+/, '');
  if (PAGE_ALIASES.has(cleanName)) {
    relativePath = `/pages/${cleanName}`;
  }
  const filePath = path.resolve(ROOT_DIR, `.${relativePath}`);

  if (!filePath.startsWith(ROOT_DIR)) {
    return null;
  }

  return filePath;
}

const server = http.createServer((req, res) => {
  if ((req.url || '').split('?')[0] === '/favicon.ico') {
    res.writeHead(204);
    res.end();
    return;
  }

  const filePath = resolveRequestPath(req.url);

  if (!filePath) {
    res.writeHead(403, { 'Content-Type': 'text/plain; charset=utf-8' });
    res.end('Forbidden');
    return;
  }

  fs.readFile(filePath, (error, content) => {
    if (error) {
      const status = error.code === 'ENOENT' ? 404 : 500;
      const message = status === 404 ? 'Arquivo nao encontrado' : `Erro interno: ${error.code}`;
      res.writeHead(status, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end(message);
      return;
    }

    const extname = path.extname(filePath).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME_TYPES[extname] || 'application/octet-stream' });
    res.end(content);
  });
});

server.listen(PORT, () => {
  console.log(`Bancus Fraternis local server running at http://localhost:${PORT}/pages/index.html`);
});
