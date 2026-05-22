# Bancus Fraternis - Plataforma de decisao financeira

Atualizado em 2026-05-22.

O Bancus Fraternis e uma plataforma estatica/progressiva para apoiar decisao financeira, simulacao de consorcio, comparacao de produtos, proposta consultiva e handoff comercial. O antigo ConsorcioPro permanece como nome legado do simulador de consorcio e de algumas chaves locais, mas a linguagem de produto atual e Bancus Fraternis.

## Estado Atual

- 52 paginas navegaveis em `pages/`, com aliases curtos cobertos por `server.js`.
- 19 calculadoras financeiras no catalogo ativo, com mapa funcional, validacao guiada, alertas de coerencia, proxima acao dinamica, previa sem persistencia e salvamento explicito por submit.
- Simulador conectado a base real com 17.396 grupos validos.
- Simulador iniciou modularizacao tecnica com `BFSimulatorJourney`, `BFSimulatorState`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFProposalBuilder` e `BFProposalGovernance` para contexto, proximas acoes, snapshots, retomada, prateleira, carrinho/projeto, lousa de proposta/PDF e governanca visual de versionamento/aceite.
- Fluxo principal: Home -> Produtos -> Calculadoras -> Trilha Assistida -> Comparador -> Simulador -> Proposta -> Handoff -> Dashboards.
- Lousa de navegacao em `pages/lousa-navegacao.html` para revisao do produto, roteiro ponta a ponta e checkpoints comerciais/online.
- Lousa de proposta/PDF no simulador para o consultor selecionar blocos, graficos, conceitos e formulas, com presets consultivo/tecnico, prontidao e historico versionado antes da exportacao/handoff.
- Dashboard Cliente, Handoff Consultivo e Dashboard Admin com cockpit de retomada, continuidade, origem, aging, prioridade, propostas versionadas/vencidas, etapa comercial, proximos passos, fila guiada executavel, produtividade, carteira por consultor, filtros comerciais, funil comercial movel por etapa, cadencia comercial e exportacoes sanitizadas de carteira e funil.
- UX com dados vivos iniciada: Dashboard Cliente mostra fonte ativa e contadores server-side; Handoff Consultivo le `/api/leads`, mescla com a fila local e sincroniza status, responsavel, checklist e notas quando a API local esta ativa.
- Publicacao em GitHub Pages com selo de ambiente demo/local, fallback estatico e validador de seguranca publica.
- Backend local Node/SQLite preparado como ponte progressiva para backend produtivo futuro, com `BANCUS_DB_PROVIDER=sqlite`, plano de migracao preservando `localStorage`, `BFBackendApi`, contratos `/api/*`, escopo por `owner_email` e proximas fases produtivas detalhadas.
- Schema local versionado em `js/backend/migrations`, com baseline SQLite, rollback, `schema-manifest.json` e validador de paridade antes do adapter produtivo.

## Entrada Recomendada

Para acessar a versao online:

```text
https://feanor4spec.github.io/bancus-fraternis/
https://feanor4spec.github.io/bancus-fraternis/pages/lousa-navegacao.html#roteiro-navegavel
```

Para navegar localmente sem backend:

```text
pages/lousa-navegacao.html
```

Para usar o servidor local com aliases curtos:

```bash
node server.js
```

Para explicitar o provider local atual:

```bash
BANCUS_DB_PROVIDER=sqlite node server.js
```

Depois acesse:

```text
http://localhost:8080/lousa-navegacao.html
http://localhost:8080/simulador.html
http://localhost:8080/dashboard-admin.html
```

## Mapa Rapido

| Area | Arquivos principais |
| --- | --- |
| Home e shell | `index.html`, `js/shared-layout.js`, `assets/css/bf-design-system-v8.css` |
| Produtos | `pages/produtos.html`, `assets/js/products-page.js`, `assets/js/products-journey.js` |
| Calculadoras | `pages/calculadoras.html`, `pages/calculadora-*.html`, `assets/data/calculadoras.json`, `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md` |
| Trilha Assistida | `pages/trilha-decisao.html`, `assets/js/decision-journey-page.js` |
| Comparador | `pages/comparador.html`, `assets/js/comparador-page.js` |
| Simulador | `pages/simulador.html`, `js/app.js`, `js/simulator-journey.js`, `js/simulator-state.js`, `js/simulator-shelf.js`, `js/simulator-cart.js`, `js/proposal-builder.js`, `js/proposal-governance.js`, `js/shelf-data.js`, `js/shelf-engine.js` |
| Proposta/PDF | `js/proposal-summary.js`, `js/export.js`, `js/proposal-acceptance.js`, `js/proposal-versioning.js`, `js/proposal-governance.js` |
| Handoff | `pages/handoff-consultivo.html`, `assets/js/services/handoff-consultivo.service.js` |
| Dashboard Cliente | `pages/dashboard-cliente.html`, `assets/js/dashboard-cliente.js` |
| Dashboard Admin | `pages/dashboard-admin.html`, `assets/js/admin-users.js`, `assets/js/services/admin-recovery.service.js` |
| Governanca | `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md`, `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md`, `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` |
| Backend produtivo | `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md`, `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`, `docs/PROXIMAS_FASES_BANK_FRATERN.md`, `tools/validate-backend-production-plan.mjs` |
| Migrations | `js/backend/migrations/schema-manifest.json`, `js/backend/migrations/001_bancus_fraternis_local_db.sql`, `tools/validate-database-migrations.mjs` |

## Documentos-Chave

- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md`: leitura completa do projeto, paginas, dados, contratos e lacunas.
- `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md`: mapa das 19 funcoes de calculadoras, inputs, motor, saidas e continuidade.
- `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md`: fases de evolucao e status do que ja foi implementado.
- `docs/PROXIMAS_FASES_BANK_FRATERN.md`: proximas fases executaveis para schema, migrations, adapter produtivo, autenticacao, migracao, observabilidade e corte controlado.
- `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`: contratos publicos de `localStorage`, `data-*`, deep links, exports globais e Definition of Done.
- `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`: ponte entre SQLite local, API local e backend hospedado futuro.
- `docs/CODEX_TEST_PROTOCOL.md`: protocolo de testes e evidencias.
- `docs/CHANGELOG.md`: historico das entregas.

Documentos como `docs/ARQUITETURA.md`, `docs/ATA_PROJETO.md`, `docs/FOLDER_PROJETO.md` e `docs/implementation_plan.md` sao historicos. Eles explicam fases anteriores e nao devem ser lidos como fonte principal do produto atual.

## Validacoes Recomendadas

```bash
node tools/validate-design-system.mjs
node tools/validate-public-release-safety.mjs
node tools/validate-public-contracts.mjs
node tools/validate-backend-production-plan.mjs
node tools/validate-database-migrations.mjs
node tools/validate-next-phases-plan.mjs
node tools/validate-live-data-ux.mjs
node tools/validate-docs-modernization.mjs
node tools/validate-online-journey-smoke.mjs
node tools/validate-github-pages-deploy.mjs
node tools/validate-calculadoras.mjs
node tools/validate-calculator-journey.mjs
node tools/validate-route-aliases.mjs
node tools/validate-simulator-groups.mjs
node tools/validate-simulator-performance.mjs
node tools/validate-simulator-refactor.mjs
node tools/validate-simulator-shelf.mjs
node tools/validate-simulator-cart.mjs
node tools/validate-proposal-builder.mjs
node tools/validate-proposal-governance.mjs
node tools/validate-proposal-versioning.mjs
```

## Contratos que Nao Devem Quebrar

- Chaves locais legadas como `consorciopro_settings` e `consorciopro_simulations`.
- Marcadores `data-*` usados pelos validadores.
- Deep links com `from`, `sourceFrom`, `calculatorSlug`, `historyId`, `journeyId`, `handoffId`, `preset` e `products`.
- Exports globais `window.BF*`, `Settings`, `ProposalSummary`, `BankFraternProgress` e services documentados.
- Compatibilidade com simulacoes salvas e historicos locais existentes.

## Licenca

Projeto proprietario. Todos os direitos reservados.
