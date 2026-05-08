# Bancus Fraternis

Plataforma estatica de decisao financeira, simulacao, proposta com lousa consultiva de PDF, handoff consultivo e dashboards.

Ambiente publico de demonstracao: login, dashboards, propostas e dados operacionais rodam em `localStorage` no navegador. Nao use dados pessoais reais neste prototipo publicado.

## Online

Site publicado:

- https://feanor4spec.github.io/bancus-fraternis/

Entradas principais:

- https://feanor4spec.github.io/bancus-fraternis/pages/index.html
- https://feanor4spec.github.io/bancus-fraternis/pages/lousa-navegacao.html#roteiro-navegavel
- https://feanor4spec.github.io/bancus-fraternis/pages/simulador.html

## Publicacao

Este repositorio deve publicar apenas o app limpo. Backups, runtime local, logs e bases auxiliares ficam fora do Git.

Arquivos grandes preservados fora do push:

- `versions/`
- `.runtime/`
- `server-8080.*`
- planilhas/CSVs auxiliares em `data_base/`

Base necessaria para o simulador online:

- `data_base/Tab_Grupos_Consorcio.json`

Validacao do deploy:

```bash
node tools/validate-public-release-safety.mjs
node tools/validate-online-journey-smoke.mjs
node tools/validate-simulator-performance.mjs
node tools/validate-github-pages-deploy.mjs
```
