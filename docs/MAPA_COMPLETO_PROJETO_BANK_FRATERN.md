# Mapa Completo do Projeto Bancus Fraternis

Atualizado em 2026-06-12.

Este mapa foi recriado a partir da leitura real do workspace. Ele documenta o Bancus Fraternis como plataforma de decisao financeira, nao apenas como simulador de consorcio. O objetivo e permitir que uma pessoa ou agente entenda a superficie atual do produto antes de evoluir Home, produtos, calculadoras, trilha assistida, comparador, simulador, proposta, handoff, dashboard cliente e dashboard admin.

## Sumario Executivo

O projeto e uma aplicacao web estatica/progressiva em HTML, CSS e JavaScript puro, com primeira camada local Node/SQLite para usuarios, sessoes, eventos, snapshots recuperaveis e escrita direta de entidades de jornada. A plataforma usa dados locais em JSON, base real de grupos de consorcio em `data_base/`, persistencia por `localStorage`, services globais no browser, API local opcional e validadores Node em `tools/`.

Estado confirmado nesta leitura:

- 52 paginas HTML em `pages/`.
- 19 calculadoras no catalogo `assets/data/calculadoras.json`.
- 6 produtos financeiros no catalogo `assets/data/produtos.json`.
- 16 services em `assets/js/services/`.
- 5 arquivos de formulas em `assets/js/formulas/`.
- 5 componentes em `assets/js/components/`.
- 47 scripts de validacao/evidencia em `tools/`.
- 52 aliases curtos confirmados em `server.js`, um para cada pagina HTML em `pages/`.

O centro de produto e uma jornada continua:

```text
Home -> Produtos -> Calculadoras -> Trilha Assistida -> Comparador -> Simulador
  -> Proposta -> Aceite local -> Handoff consultivo
  -> Dashboard Cliente / Carteira / Assembleias / Dashboard Admin
```

## Escopo da Leitura

Incluido como codigo ativo ou documentacao operacional:

- `index.html`
- `server.js`
- `pages/*.html`
- `js/*.js`
- `assets/js/**/*.js`
- `css/*.css`
- `assets/css/*.css`
- `assets/data/*.json`
- `data_base/*`
- `docs/*.md`
- `tools/*.mjs`
- pacotes de design system em `bank_fratern_*`

Separado como runtime, evidencia, backup ou historico:

- `.runtime/`
- `versions/*.zip`
- `docs/test-prints/`
- `docs/test-reports/`
- `server-8080*.log`
- `server-8080*.out`

## Entrada e Servidor

| Arquivo | Papel atual |
| --- | --- |
| `index.html` | Redirect simples para `pages/index.html`. |
| `server.js` | Servidor canonico local. Usa porta `8080` por padrao, serve `/` como `pages/index.html`, cria aliases curtos para todas as paginas HTML em `pages/` e expoe API local `/api/*` para auth, usuarios, status do banco, eventos, snapshots e jornada direta. |
| `js/backend/db.js` | Camada SQLite local e primeira camada de provider: schema, seeds, hash `scrypt-sha256`, sessoes, eventos/snapshots sanitizados, entidades relacionais, escrita direta em tabelas dedicadas, `BANCUS_DB_PROVIDER=sqlite` e diagnostico tecnico do provider. |
| `js/backend/migrations/` | Baseline versionada do schema SQLite, rollback e manifest para o futuro adapter produtivo. |
| `js/server.js` | Servidor legado do simulador antigo. Mantido como historico tecnico, nao como entrada principal. |
| `Sistema.gitignore` | Ignora editor, node, python, envs, chaves e temporarios. |

Contrato confirmado:

- `server.js` tem 52 aliases para 52 paginas.
- Todas as paginas continuam acessiveis por `/pages/<arquivo>.html`.
- Todas as paginas tambem respondem por URL curta, como `/trilha-decisao.html`.
- O contrato e coberto por `tools/validate-route-aliases.mjs`.
- Quando roda via Node, `GET /api/health`, `/api/database/status`, `POST /api/database/import-local`, `/api/auth/*`, `/api/users`, `/api/events`, `/api/snapshots`, `/api/journey-entities`, `/api/leads`, `/api/simulations` e `/api/proposals` usam SQLite local em `.runtime/`.
- O schema local tem baseline versionada em `js/backend/migrations/001_bancus_fraternis_local_db.sql`, rollback destrutivo controlado e manifest `schema-manifest.json`, cobertos por `tools/validate-database-migrations.mjs`.
- `GET /api/snapshots` e escopado por sessao: admin lista todos; cliente/consultor recebem apenas snapshots do proprio `owner_email`.
- `GET /api/journey-entities` indexa snapshots em `lead`, `simulation` e `proposal`, preservando o mesmo escopo por sessao.
- `GET /api/leads`, `/api/simulations` e `/api/proposals` leem tabelas dedicadas materializadas a partir do mesmo pipeline.
- `POST/PATCH /api/leads`, `/api/simulations` e `/api/proposals` criam e atualizam registros diretos, sincronizando `journey_entities`, sanitizando payload e preservando escopo por sessao.
- Os fluxos reais de simulador, versionamento/aceite/lousa de proposta e handoff ja chamam `saveSimulation`, `saveProposal` e `saveLead` em modo progressivo.
- O Dashboard Admin ja usa `PATCH` para alterar status, etapa e prioridade de registros dedicados, sem editar snapshots manualmente.
- O Dashboard Admin tambem separa leads, simulacoes e propostas materializadas em `data-admin-dedicated-queue`, com filtros por tipo, status, prioridade e dono antes da auditoria completa.
- O Dashboard Cliente possui painel de UX com dados vivos (`data-client-live-data-panel`) para mostrar fonte ativa, contadores server-side e fallback local.
- O Handoff Consultivo le `/api/leads`, mescla `journey_leads` com `bf_consultive_handoffs_v1` e sincroniza status, responsavel, checklist e notas por `PATCH /api/leads/:id` quando a API local esta ativa.
- Quando publicado em GitHub Pages ou aberto por `file://`, as paginas seguem funcionando com fallback em `localStorage`.

## Estrutura de Diretorios

| Diretorio | Tipo | Conteudo |
| --- | --- | --- |
| `pages/` | Ativo | Superficie navegavel principal da plataforma. |
| `js/` | Ativo e legado | Simulador completo, auth, backend local, storage, settings, home, proposta, carteira e motores originais. |
| `assets/js/` | Ativo | Plataforma modular nova, dashboards, calculadoras, modelos, trilha e handoff. |
| `assets/js/services/` | Ativo | Services globais `window.BF*` para dados, calculadoras, decisao, produtos, comparador, handoff e admin. |
| `assets/js/formulas/` | Ativo | Formulas financeiras reutilizadas por simuladores, calculadoras e comparador. |
| `assets/js/components/` | Ativo | Componentes pequenos para cards, tabelas, alertas, graficos simples e tooltips. |
| `assets/data/` | Ativo | Datasets publicos/demonstrativos da plataforma. |
| `data_base/` | Ativo | Base grande de grupos de consorcio e conversor. |
| `css/` | Ativo | CSS historico/canonico do simulador, home e bridge visual Bancus Fraternis. |
| `assets/css/` | Ativo | CSS modular, tokens e design system v8. |
| `assets/icons/`, `assets/logos/`, `assets/photos/`, `assets/creatives/` | Ativo | Identidade visual, fotos, icones e SVGs. |
| `docs/` | Ativo | Planos, arquitetura, changelog, protocolo de teste e mapas. |
| `tools/` | Ativo | Validadores e gerador de evidencia visual. |
| `bank_fratern_codex_design_system/` | Referencia | Pack/documentacao de design system. |
| `bank_fratern_design_system_pack/` | Referencia | Pack adicional de design system. |
| `versions/` | Backup | Checkpoints e pacotes versionados. |
| `.runtime/` | Runtime | Perfis/cache de browser local. |

## Inventario de Paginas

### Entrada, Marca e Confianca

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/index.html` | Ativa | Home institucional, hero contextual, cockpit de continuidade, perfil, trilha ativa e proximos passos. |
| `pages/sobre-nos.html` | Ativa | Posicionamento institucional do Bancus Fraternis. |
| `pages/duvidas.html` | Ativa | FAQ e orientacao de continuidade. |
| `pages/educacao.html` | Ativa | Conceitos financeiros antes da simulacao. |
| `pages/compliance.html` | Ativa | Separacao entre dados publicos, privados e consentidos. |
| `pages/dados-abertos.html` | Ativa | Datasets locais e explicacao de origem/uso. |
| `pages/api-docs.html` | Ativa | Contratos futuros de API baseados nos services atuais. |
| `pages/componentes-v8.html` | Ativa | Catalogo visual do design system v8. |
| `pages/lousa-navegacao.html` | Ativa | Lousa navegavel da jornada, status, roteiro de QA ponta a ponta, checkpoints comerciais/online e proximos ciclos. |

### Autenticacao, Configuracoes e Operacao

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/login.html` | Ativa | Login local com perfis demo. |
| `pages/configuracoes.html` | Ativa | Preferencias locais do simulador e plataforma. |
| `pages/dashboard-cliente.html` | Ativa | Historico, perfil, modelos, trilha, sinais, impactos de calculadoras e handoff do usuario, lendo snapshots, entidades relacionais e tabelas dedicadas server-side quando a API local esta ativa, com painel de dados vivos e fallback em `localStorage`. |
| `pages/dashboard-admin.html` | Ativa | Usuarios, recuperacao, pacotes, SLA, roteamento, metas, auditoria, funil, fila guiada executavel, produtividade, carteira por consultor, funil comercial movel, cadencia por etapa, eventos, snapshots, entidades, fila dedicada filtravel e operacao inline das tabelas dedicadas SQLite. |

### Produto, Decisao e Modelos

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/produtos.html` | Ativa | Catalogo de produtos, filtros e ponte contextual para simulador, comparador, calculadora e trilha. |
| `pages/comparador.html` | Ativa | Comparador multi-produto e modelos recomendados. |
| `pages/trilha-decisao.html` | Ativa | Trilha assistida que transforma perfil em produto/modelo/proximo passo. |
| `pages/modelos-biblioteca.html` | Ativa | Biblioteca de modelos padrao e clonagem local. |
| `pages/modelos-governanca.html` | Ativa | Governanca e auditoria dos modelos de comparacao. |

### Simuladores

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/simulador.html` | Ativa | Simulador completo de consorcio, prateleira com 17.396 grupos validos, controle de 20 a 50 grupos por pagina, guia de objetivo, recomendacao explicavel de grupos, projeto estruturado, proposta, aceite e handoff. |
| `pages/simulador-consorcio.html` | Ativa | Porta de entrada para o simulador completo de consorcio. |
| `pages/simulador-financiamento.html` | Ativa | Simulacao de financiamento com Price/SAC. |
| `pages/simulador-veiculos.html` | Ativa | Comparacao de veiculo por financiamento ou consorcio. |
| `pages/simulador-cdc.html` | Ativa | Simulacao de CDC, parcela, tarifas e custo total. |
| `pages/simulador-garantia.html` | Ativa | Credito com garantia, LTV, limite e custo total. |
| `pages/simulador-consignado.html` | Ativa | Consignado, margem, elegibilidade e custo total. |

### Calculadoras

Todas usam o mesmo padrao de pagina, o motor de render `assets/js/calculadoras-page.js` e o service `assets/js/services/calculadoras.service.js`. O mapa operacional das funcoes esta em `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md`. O resultado de cada calculadora agora inclui um painel de impacto da jornada com score, risco, origem preview/salvo e proximo passo.

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/calculadoras.html` | Ativa | Hub das calculadoras. |
| `pages/calculadora-juros-compostos.html` | Ativa | Crescimento com aportes e taxa. |
| `pages/calculadora-juros-simples.html` | Ativa | Juros simples educativo. |
| `pages/calculadora-primeiro-milhao.html` | Ativa | Meta patrimonial. |
| `pages/calculadora-aposentadoria.html` | Ativa | Patrimonio futuro e gap. |
| `pages/calculadora-renda.html` | Ativa | Descumulacao de patrimonio. |
| `pages/calculadora-reserva-emergencia.html` | Ativa | Reserva ideal e cobertura. |
| `pages/calculadora-poupanca-selic.html` | Ativa | Poupanca x Selic. |
| `pages/calculadora-renda-fixa.html` | Ativa | Comparador de renda fixa. |
| `pages/calculadora-compra-vista-parcelado.html` | Ativa | Vista x parcelado. |
| `pages/calculadora-pix-parcelado.html` | Ativa | Pix parcelado. |
| `pages/calculadora-alugar-financiar.html` | Ativa | Alugar x financiar. |
| `pages/calculadora-cartoes.html` | Ativa | Comparador demonstrativo de cartoes. |
| `pages/calculadora-realidade-brasileira.html` | Ativa | Salario e realidade brasileira. |
| `pages/calculadora-rentabilidade.html` | Ativa | Rentabilidade demonstrativa de carteira. |
| `pages/calculadora-acoes.html` | Ativa | Comparador demonstrativo de acoes. |
| `pages/calculadora-cdb.html` | Ativa | CDB indexado ao CDI. |
| `pages/calculadora-capacidade-credito.html` | Ativa | Capacidade de credito e parcela segura. |
| `pages/calculadora-lance-consorcio.html` | Ativa | Lance seguro para consorcio. |
| `pages/calculadora-custos-fixos.html` | Ativa | Comprometimento de renda. |
| `pages/calculadoras-governanca.html` | Ativa | Governanca, premissas e golden tests. |

### Acompanhamento e Legado Controlado

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/carteira.html` | Ativa | Carteira de clientes, oportunidades, agenda e insights. |
| `pages/assembleias.html` | Ativa | Acompanhamento de assembleias. |
| `pages/handoff-consultivo.html` | Ativa | Painel consultivo de leads locais e vivos, incluindo origem `calculator`, mesclando `/api/leads` com `localStorage`, com plano de acao executavel por lead e sincronizacao de atendimento quando ha API local. |
| `pages/consorcio_user_journey_map_v2.html` | Legado controlado | Mapa visual antigo da jornada do consorciado. |
| `pages/index_2.html` | Legado controlado | Portal de operacoes anterior. |
| `pages/index_v4_paginas.html` | Legado controlado | Navegacao/portal anterior. |

## Fluxos de Jornada

### Jornada de entrada e diagnostico

```text
Home contextual
  -> diagnostico por calculadora recomendada
  -> perfil financeiro local
  -> historico e prontidao
  -> trilha assistida ativa quando existir
  -> proximo passo em produto, comparador ou simulador
```

Contratos principais: `data-home-hero-contextual`, `data-home-continuity-cockpit`, `BFHome`, `BFDecisionContext`, `BFTrilhaDecisaoService`, `bf_financial_profile_v1`, `bf_calculator_history_v1`, `bf_decision_journey_v1:<owner>`.

### Jornada de calculadora para continuidade

```text
Calculadora salva
  -> painel de impacto com score, risco e proximo passo
  -> Dashboard Cliente prioriza revisao, simulacao ou comparacao
  -> cliente cria handoff consultivo quando precisa de apoio
  -> Handoff Consultivo recebe origem calculator, score, risco e checklist
```

Contratos principais: `data-calculator-impact-panel`, `data-client-calculator-impact`, `data-client-calculator-impact-item`, `data-client-create-calculator-handoff`, `BFHandoffConsultivoService.createFromCalculatorImpact`, `sourceCalculatorHistoryId`, `bf_calculator_history_v1`, `bf_consultive_handoffs_v1`.

### Jornada de produto e comparacao

```text
Produtos
  -> selecao de produto
  -> deep link com origem, produto, preset e selecao
  -> comparador por preset/modelo
  -> resultado comparativo
  -> memoria, riscos e acoes
  -> simulador ou trilha assistida
```

Contratos principais: `data-products-grid`, `data-products-selection-panel`, `data-comparator-form`, `data-comparator-result`, `BFProductsJourney`, `BFComparadorService`, `BFComparatorModels`.

### Jornada de calculadoras

```text
Hub de calculadoras
  -> calculadora individual
  -> previa sem persistencia
  -> validacao guiada por campo
  -> alertas de coerencia nao bloqueantes
  -> painel de impacto com score, risco e proximo passo
  -> proxima acao dinamica
  -> submit explicito
  -> resultado + recomendacao
  -> perfil consolidado e historico
  -> simulador, comparador ou dashboard cliente
```

Contratos principais: `data-calculator-form`, `data-calculator-form-alert`, `data-calculator-coherence`, `data-calculator-coherence-alert`, `data-calculator-field`, `data-calculator-field-error`, `data-calculator-field-origin`, `data-calculator-field-source`, `data-calculator-field-source-key`, `data-calculator-saved-comparison`, `data-calculator-saved-comparison-item`, `data-calculator-impact-panel`, `data-calculator-impact-score`, `data-calculator-impact-risk`, `data-calculator-impact-next-step`, `data-calculator-impact-source`, `data-calculator-next-action`, `data-calculator-next-action-card`, `data-calculator-profile-continuity`, `data-calculators-profile-continuity`, `data-calculator-result`, `data-calculator-result-mode`, `BFCalculadoras`, `BFFinancialFormulas`, `BFDecisionContext`, `BFCalculatorJourney`, deep links com `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`.

### Jornada de trilha assistida

```text
Formulario de trilha
  -> normalizacao do perfil
  -> ranking de produtos
  -> modelo recomendado
  -> comparador por objetivo
  -> proxima acao contextual
  -> retomada pela Home quando houver trilha ativa
  -> handoff local quando fizer sentido
```

Contratos principais: `data-decision-journey-form`, `data-decision-journey-state`, `BFTrilhaDecisaoService`, `BFDecisionJourneyContext`, `BFModelosRecomendacaoService`, deep links com `from`, `sourceFrom`, `productId`, `calculatorSlug`, `historyId`, `preset`, `journeyId` e `products`.

### Jornada de simulador e proposta

```text
Simulador completo
  -> dados do consultor e cliente
  -> prateleira de grupos com 20 a 50 itens por pagina
  -> projeto estruturado
  -> calculo e graficos
  -> proposta espelhada no PDF
  -> aceite/revisao local
  -> versionamento e comparacao da proposta
  -> handoff consultivo de proposta
```

Contratos principais: `data-simulator-readiness`, `data-simulator-objective-guide`, `data-shelf-recommendation`, `data-simulator-result-decision`, `data-proposal-acceptance-panel`, `data-proposal-version-panel`, `data-proposal-handoff-bridge`, `App`, `ConsorcioEngine`, `ProposalSummary`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFSimulatorResult`, `BFProposalBuilder`, `BFProposalGovernance`, `BFProposalAcceptance`, `BFProposalVersions`, `BFHandoffConsultivoService`. A preferencia `pageSize` da prateleira e normalizada entre 20 e 50, com padrao 20.

### Jornada de operacao

```text
Sinais de retomada / proposta / trilha
  -> handoff consultivo
  -> fila admin
  -> atribuicao, SLA, metas e roteamento
  -> dashboard cliente e consultor
```

Contratos principais: `data-handoff-list`, `data-admin-recovery-queue`, `data-admin-recovery-packages`, `BFJourneyRecoveryService`, `BFHandoffConsultivoService`, `BFAdminRecoveryService`.

Melhoria implementada em 2026-05-07:

- A Home passou a carregar `BFTrilhaDecisaoService`, detectar `bf_decision_journey_v1:<owner>` e priorizar a proxima acao da trilha ativa no hero, cockpit, card e acoes recomendadas.
- Calculadoras passaram a expor `BFCalculatorJourney` e a levar para Trilha, Comparador, Simulador ou reabertura mantendo `calculatorSlug`, `historyId` e `preset`.
- A ponte das calculadoras agora usa o perfil consolidado para diferenciar previa sem salvar, ausencia de renda, ausencia de reserva, capacidade pronta e lance sugerido antes do CTA final.
- Campos reaproveitados do perfil consolidado agora mostram origem visual para o usuario, com `data-calculator-field-source`.
- Resultados das calculadoras com historico agora comparam a previa atual com o ultimo salvo da mesma calculadora, via `data-calculator-saved-comparison`.
- A Trilha Assistida passou a expor `BFDecisionJourneyContext`, reconhecer contexto vindo de Produtos/Calculadoras e sair com `from=journey` preservando a origem anterior em `sourceFrom`.
- Dashboard Cliente passou a usar `from=dashboard` na continuidade, com linha do tempo Diagnostico -> Calculadora -> Trilha -> Comparador -> Simulacao -> Proposta -> Handoff.
- Dashboard Cliente agora tem cockpit de retomada com proxima acao, status do handoff, proposta, simulacao e etapa comercial quando existir.
- Handoffs agora possuem origem inferida ou explicita: proposta revisada, trilha assistida, sinal de retomada, pacote importado ou origem local.
- Propostas agora possuem historico versionado local, comparacao entre versoes e versao congelada antes do handoff.
- Handoff e Admin agora leem validade, snapshot e mudancas de versao da proposta para destacar propostas vencidas ou alteradas depois do handoff.
- Handoff e Admin convertem proximos passos em plano/fila de acao com dono, prazo, alvo e CTA direto.
- A fila guiada agora persiste status, motivo, adiamento, conclusao, reabertura e historico por responsavel em `localStorage`.
- O admin calcula produtividade por consultor com abertas, adiadas, concluidas, tempo medio e gargalos recorrentes.
- O admin consolida carteira por consultor com leads abertos, aging, origem, prioridade, SLA e proximo foco por lead.
- A carteira por consultor ganhou filtros por consultor/origem/prioridade/SLA/busca, plano comercial do dia e exportacao JSON sanitizada.
- O admin mostra funil comercial por etapa do lead: contato, proposta, follow-up, negociacao e fechamento.
- O funil comercial agora permite mover o lead entre etapas pelo Dashboard Admin, grava historico local e reflete o status no handoff.
- A cadencia comercial do funil mostra movimentacoes recentes, resumo por etapa e leads parados por prazo de etapa.
- O funil/cadencia comercial agora exporta JSON sanitizado em `bank-fratern.admin-commercial-pipeline.v1`, com leads anonimizados, totais por etapa e movimentacoes recentes para reuniao diaria.
- O Handoff Consultivo agora le a etapa comercial salva pelo Admin, mostra chip/painel de cadencia, ultima movimentacao e atraso da etapa para o consultor.
- A lousa navegavel agora possui checkpoints de QA comercial para cockpit cliente, handoff consultivo, funil/cadencia admin, exportacao sanitizada e smoke test online.
- O simulador iniciou reducao de divida tecnica com `BFSimulatorJourney`, `BFSimulatorState`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFSimulatorResult`, `BFProposalBuilder` e `BFProposalGovernance`, preservando `App.*`, payloads salvos, prateleira, carrinho/projeto, resultado, PDF/proposta, aceite, versionamento e acoes de continuidade.
- O painel consultivo filtra por origem e mostra badge/resumo da origem nos cards e no detalhe.
- O dashboard admin mostra metricas de propostas e trilhas na fila de handoff.
- O contrato e coberto por `tools/validate-handoff-origins.mjs` e `tools/validate-handoff-consultant-operations.mjs`.

## Modulos JavaScript

### Nucleo em `js/`

| Arquivo | Responsabilidade |
| --- | --- |
| `js/app.js` | Fachada/controlador principal do simulador completo. Ainda concentra wizard e acoes publicas, mas ja delega jornada, snapshots, prateleira, carrinho/projeto, calculo/resultado, lousa e governanca visual da proposta para modulos dedicados. |
| `js/proposal-builder.js` | Service da lousa de proposta/PDF: storage, presets, opcoes, dependencias, foco, decisao final, prontidao e estimativa de paginas. |
| `js/proposal-governance.js` | Service visual da governanca da proposta: paineis de versionamento, aceite local, historicos, leitura do formulario e ponte de handoff. |
| `js/simulator-journey.js` | Service do simulador para contexto de origem, prefill e proximas acoes da jornada. |
| `js/simulator-state.js` | Service do simulador para snapshots de formulario, carrinho salvo, payload de simulacao e retomada. |
| `js/simulator-shelf.js` | Service da prateleira: filtros, page size, colunas, ordenacao, paginacao, tabela e detalhe do grupo. |
| `js/simulator-cart.js` | Service do carrinho/projeto estruturado: item criado a partir da prateleira, totais, campos editaveis, HTML do passo 4/5 e aplicacao de resultados. |
| `js/simulator-result.js` | Service do resultado do simulador: orquestracao de calculo, resumo, proposta e tabela analitica. |
| `js/engine.js` | Motor de consorcio, cronograma, eventos, resumo e cenarios. |
| `js/shelf-data.js` | Carregamento e normalizacao da base real/fallback de grupos. |
| `js/shelf-engine.js` | Score, filtros, paginacao, projeto estruturado e simulacao consolidada da prateleira. |
| `js/heuristic-engine.js` | Analise heuristica dos grupos: saude, maturidade, porte, papel e sinopse. |
| `js/comparator.js` | Comparador de grupos/cenarios do simulador completo. |
| `js/charts.js` | Graficos Chart.js do simulador e comparador. |
| `js/export.js` | Exportacao PDF e impressao. |
| `js/proposal-summary.js` | Renderer da proposta comercial e graficos do PDF/preview. |
| `js/proposal-acceptance.js` | Aceite e revisao local da proposta. |
| `js/proposal-versioning.js` | Historico versionado, snapshots e comparacao da proposta antes do handoff. |
| `js/storage.js` | Simulacoes salvas, estatisticas de carteira e sincronizacao opcional de snapshot `simulation` no backend local. |
| `js/settings.js` | Preferencias locais e defaults. |
| `js/auth.js` | Usuarios locais, sessao, papeis e guardas. |
| `js/backend/db.js` | Banco local SQLite para usuarios, sessoes, eventos, snapshots, entidades de jornada, tabelas dedicadas, escrita direta, status tecnico e importacao guiada. |
| `js/backend/migrations/*` | Migration baseline, rollback e manifest do schema local para adapter produtivo futuro. |
| `js/shared-layout.js` | Shell comum, header/footer, contrato v8 e estado de conta. |
| `js/home.js` | Home contextual, cockpit de continuidade e retomada de trilha ativa. |
| `js/portfolio-live.js` | Carteira, oportunidades, agenda e insights. |
| `js/assemblies-live.js` | Assembleias, resumo e insights. |
| `js/database-progress.js` | Progresso de carregamento da base. |
| `js/data.js` | Dados de exemplo e conceitos de consorcio. |

### Plataforma em `assets/js/`

| Arquivo | Responsabilidade |
| --- | --- |
| `assets/js/bf-platform.js` | Controlador modular amplo para produtos, simuladores leves, comparador, modelos, analytics e dashboards. |
| `assets/js/calculadoras-page.js` | Hub e paginas individuais de calculadoras. |
| `assets/js/calculadoras-governanca.js` | Premissas, catalogo e golden tests. |
| `assets/js/client-dashboard.js` | Dashboard cliente e continuidade. |
| `assets/js/admin-users.js` | Admin, usuarios, funil, recuperacao, pacotes, SLA, metas, eventos SQLite, fila dedicada de registros materializados, migracao guiada e auditoria. |
| `assets/js/handoff-consultivo.js` | UI do painel de handoff. |
| `assets/js/trilha-decisao.js` | UI da trilha assistida. |
| `assets/js/modelos-biblioteca.js` | Biblioteca de modelos. |
| `assets/js/modelos-governanca.js` | Governanca de modelos. |
| `assets/js/login.js` | Tela de login. |
| `assets/js/formatters.js` | Moeda, numero, percentual, parse e meses. |
| `assets/js/validators.js` | Validacoes basicas. |

### Services globais

| Service | Export | Responsabilidade |
| --- | --- | --- |
| `backend-api.service.js` | `BFBackendApi` | Ponte para API local Node/SQLite, status tecnico, eventos, snapshots, entidades, leitura/escrita direta de leads/simulacoes/propostas, importacao guiada e fallback estatico. |
| `dados.service.js` | `BFDadosService` | Le datasets locais. |
| `calculadoras.service.js` | `BFCalculadoras` | Simula calculadoras, perfil, historico e recomendacoes. |
| `decision-context.service.js` | `BFDecisionContext` | Perfil financeiro, historico, prefill e auditoria nao sensivel. |
| `financiamento.service.js` | `BFFinanciamentoService` | Simulador leve de financiamento. |
| `cdc.service.js` | `BFCdcService` | Simulador leve de CDC. |
| `garantia.service.js` | `BFGarantiaService` | Simulador leve de credito com garantia. |
| `consignado.service.js` | `BFConsignadoService` | Simulador leve de consignado. |
| `consorcio.service.js` | `BFConsorcioService` | Service leve de consorcio. |
| `comparador.service.js` | `BFComparadorService` | Comparacao multi-produto. |
| `recomendacao.service.js` | `BFRecomendacaoService` | Score de recomendacao de produtos. |
| `modelos-recomendacao.service.js` | `BFModelosRecomendacaoService` | Ranking de modelos padrao. |
| `trilha-decisao.service.js` | `BFTrilhaDecisaoService` | Cria, salva e carrega trilhas. |
| `handoff-consultivo.service.js` | `BFHandoffConsultivoService` | Leads, status, checklist, notas, proposta e auditoria. |
| `journey-recovery.service.js` | `BFJourneyRecoveryService` | Sinais de retomada. |
| `admin-recovery.service.js` | `BFAdminRecoveryService` | Fila admin, pacotes, SLA, roteamento e metas. |

### Formulas e componentes

| Grupo | Arquivos |
| --- | --- |
| Formulas | `financial.formulas.js`, `price.formulas.js`, `sac.formulas.js`, `consorcio.formulas.js`, `comparison.formulas.js`. |
| Componentes | `alerts.js`, `cards.js`, `charts.js`, `tables.js`, `tooltips.js`. |

## Dados e Bases

| Arquivo | Conteudo confirmado |
| --- | --- |
| `assets/data/produtos.json` | 6 produtos financeiros. |
| `assets/data/calculadoras.json` | 19 calculadoras. |
| `assets/data/calculadoras-golden-tests.json` | 12 testes deterministos de formulas. |
| `assets/data/calculadoras-premissas.json` | Premissas locais: indices, IR, cartoes, faixas, carteiras e ativos demo. |
| `assets/data/formulas.json` | 4 formulas/base de calculo. |
| `assets/data/glossario.json` | 10 entradas de glossario. |
| `assets/data/indices.json` | 4 indices demonstrativos. |
| `assets/data/instituicoes.json` | 4 grupos institucionais/demonstrativos. |
| `assets/data/modelos-comparador-padrao.json` | 4 modelos padrao publicados. |
| `assets/data/regras-negocio.json` | Regras de LGPD, Open Finance, simulacao e recomendacao. |
| `data_base/Tab_Grupos_Consorcio.json` | Base canonica de grupos de consorcio; 17.418 registros brutos, 17.396 grupos validos e 22 registros sem `valorCartaRef`. |
| `data_base/Tab_Grupos_Consorcio.compact.json` | Base compacta usada pelo simulador online; 17.396 grupos validos em formato colunar, com fallback para o JSON canonico. |
| `data_base/Tab_Grupos_Consorcio.csv` | Origem CSV da base. |
| `data_base/converter.html` e `data_base/converter.js` | Conversor local de apoio. |

## Persistencia Local

Chaves `localStorage` confirmadas:

| Chave | Uso |
| --- | --- |
| `bf_auth_users_v1` | Usuarios locais. |
| `bf_auth_session_v1` | Sessao local. |
| `consorciopro_settings` | Preferencias do simulador/plataforma. |
| `consorciopro_simulations` | Simulacoes salvas. |
| `bank_fratern_proposal_acceptances_v1` | Aceites/revisoes de proposta. |
| `bank_fratern_proposal_versions_v1` | Snapshots versionados da proposta, lousa e metricas. |
| `bf_financial_profile_v1` | Perfil financeiro consolidado. |
| `bf_calculator_history_v1` | Historico de calculadoras. |
| `bf_calculator_premissas_override_v1` | Override de premissas. |
| `bf_decision_context_audit_v1` | Auditoria do contexto de decisao. |
| `bf_decision_journey_v1:<owner>` | Trilha ativa. |
| `bf_decision_journey_history_v1:<owner>` | Historico de trilhas. |
| `bf_products_selection_v1` | Produtos selecionados. |
| `bf_journey_analytics_v1` | Microconversoes locais. |
| `bf_comparator_favorite_preset_v1` | Preset favorito. |
| `bf_comparator_models_v1` | Modelos locais do comparador. |
| `bf_comparator_model_audit_v1` | Auditoria de modelos. |
| `bf_consultive_handoffs_v1` | Handoffs/leads locais. |
| `bf_consultive_handoff_audit_v1` | Auditoria dos handoffs. |
| `bf_admin_commercial_stage_states_v1` | Etapa comercial escolhida por lead no Dashboard Admin. |
| `bf_admin_commercial_stage_audit_v1` | Historico local de movimentacao do funil comercial. |
| `bf_admin_recovery_imports_v1` | Pacotes importados. |
| `bf_admin_recovery_audit_v1` | Auditoria admin recovery. |
| `bf_admin_recovery_conversion_goals_v1` | Metas de conversao. |

Regra de produto: dados sensiveis nao devem ser promovidos para datasets publicos nem analytics compartilhado. A camada atual e prototipo local; producao exige backend seguro.

## Contratos Publicos Existentes

### Marcadores `data-*`

Os marcadores mais importantes por area:

| Area | Marcadores-chave |
| --- | --- |
| Home | `data-home-hero-contextual`, `data-home-continuity-cockpit`, `data-home-next-actions`. |
| Produtos | `data-products-grid`, `data-products-filter`, `data-products-selection-panel`, `data-products-compare-link`. |
| Calculadoras | `data-calculator-form`, `data-calculator-form-alert`, `data-calculator-coherence`, `data-calculator-coherence-alert`, `data-calculator-field`, `data-calculator-field-error`, `data-calculator-field-origin`, `data-calculator-field-source`, `data-calculator-field-source-key`, `data-calculator-saved-comparison`, `data-calculator-saved-comparison-item`, `data-calculator-impact-panel`, `data-calculator-impact-score`, `data-calculator-impact-risk`, `data-calculator-impact-next-step`, `data-calculator-impact-source`, `data-calculator-next-action`, `data-calculator-next-action-card`, `data-calculator-profile-continuity`, `data-calculators-profile-continuity`, `data-calculator-result`, `data-calculator-result-mode`, `data-calculator-history`, `data-calculators-hub`. |
| Trilha | `data-decision-journey-form`, `data-decision-journey-state`, `data-decision-journey-steps`, `data-decision-journey-actions`. |
| Comparador | `data-comparator-form`, `data-comparator-result`, `data-comparator-preset-summary`, `data-comparator-model-recommendation`. |
| Simulador | `data-simulator-readiness`, `data-simulator-decision-strip`, `data-simulator-journey-actions`, `data-simulator-objective-guide`, `data-simulator-objective-card`, `data-simulator-objective-apply`, `data-simulator-result-decision`, `data-simulator-result-cta`, `data-simulator-result-premise`, `data-simulator-result-risk`, `data-simulator-result-comparison`, `data-shelf-col`, `data-shelf-recommendation`, `data-shelf-recommendation-reason`. |
| Proposta | `data-proposal-acceptance-panel`, `data-proposal-handoff-bridge`, `data-proposal-builder-board`, `data-proposal-builder-readiness`, `data-proposal-builder-option`, `data-proposal-version-panel`, `data-proposal-version-history`, `data-proposal-version-comparison`. |
| Handoff | `data-handoff-list`, `data-handoff-detail`, `data-handoff-metrics`, `data-handoff-recovery-signals`, `data-handoff-action-plan`, `data-handoff-action-execution`, `data-handoff-proposal-version`, `data-handoff-commercial-stage`, `data-handoff-commercial-stage-panel`, `data-handoff-commercial-stage-history`. |
| Cliente | `data-client-continuity-strip`, `data-client-continuity-cockpit`, `data-client-next-action`, `data-client-handoff-status`, `data-client-proposal-status`, `data-client-simulation-context`, `data-client-commercial-stage`, `data-client-decision-journey`, `data-client-recovery-signals`. |
| Admin | `data-admin-next-actions`, `data-admin-action-queue`, `data-admin-action-execution`, `data-admin-action-owner-history`, `data-admin-consultant-productivity`, `data-admin-consultant-portfolio`, `data-admin-consultant-portfolio-lead`, `data-admin-consultant-portfolio-filters`, `data-admin-consultant-portfolio-export`, `data-admin-consultant-portfolio-priority`, `data-admin-commercial-pipeline`, `data-admin-commercial-pipeline-export`, `data-admin-commercial-stage`, `data-admin-commercial-lead`, `data-admin-commercial-stage-select`, `data-admin-commercial-stage-history`, `data-admin-commercial-stage-insights`, `data-admin-commercial-stage-movement`, `data-admin-commercial-stage-stuck-lead`, `data-admin-commercial-stage-summary`, `data-admin-source-funnel`, `data-admin-bottleneck-board`, `data-admin-recovery-queue`, `data-admin-recovery-packages`, `data-admin-journey-funnel`, `data-admin-operational-alerts`. |
| Lousa | `data-lousa-commercial-qa`, `data-lousa-qa-checkpoint`, `data-lousa-journey-checklist`, `data-lousa-journey-acceptance`. |
| V8 | `data-v8-stagebar`, `data-bf-visual-version`, `data-shell-header`, `data-shell-footer`. |

### Exports globais

Exports principais confirmados:

`BFAuth`, `Settings`, `BFHome`, `BFDecisionContext`, `BFCalculadoras`, `BFCalculatorJourney`, `BFFinancialFormulas`, `BFDadosService`, `BFProductsJourney`, `BFComparadorService`, `BFComparatorModels`, `BFTrilhaDecisaoService`, `BFDecisionJourneyContext`, `BFModelosRecomendacaoService`, `BFHandoffConsultivoService`, `BFJourneyRecoveryService`, `BFAdminRecoveryService`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFSimulatorResult`, `BFProposalBuilder`, `BFProposalGovernance`, `BFProposalAcceptance`, `BFProposalVersions`, `BankFraternProgress`.

### Deep links e rotas funcionais

Padroes existentes:

- Home pode abrir simulador com `simulador.html?from=calculator&calculatorSlug=<slug>&historyId=<id>` ou retomar o `nextAction.href` da trilha ativa.
- Produtos e modelos usam preset do comparador.
- Produtos preserva origem com `from=products`, `productId`, `preset` e `products=<ids>` quando ha selecao manual.
- Calculadoras preservam origem com `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset` ao abrir Trilha, Comparador, Simulador ou a propria calculadora.
- Trilha aponta para comparador por objetivo/preset e propaga `from=journey`, `sourceFrom`, `productId`, `calculatorSlug`, `historyId`, `journeyId` e `products` quando esses dados existem.
- Dashboard Cliente usa `from=dashboard` e preserva `journeyId`, `calculatorSlug`, `historyId` e `handoffId` nas retomadas.
- Simulador salva e restaura simulacoes por storage local e URL quando aplicavel.
- Handoff preserva origem por jornada, sinal ou proposta.

## CSS e Design System

| Arquivo | Papel |
| --- | --- |
| `css/styles.css` | Base historica do simulador e muitos componentes. |
| `css/bank-fratern-design-system.css` | Bridge visual Bancus Fraternis. |
| `css/home.css` | Home contextual e cockpit. |
| `css/shared-site.css` | Layout compartilhado. |
| `assets/css/platform.css` | UI modular da plataforma. |
| `assets/css/bf-design-system-v8.css` | Camada canonica v8. |
| `assets/css/tokens.css` | Tokens da marca. |
| `assets/css/styles.css` | Bridge para demos/futuras paginas. |

Arquitetura v8:

- Arquetipos: `institutional`, `calculator`, `decision`, `dashboard`, `governance`.
- `js/shared-layout.js` injeta parte do contrato visual.
- Home e simulador carregam v8 diretamente por terem estrutura propria.
- Legado controlado: `index_2.html`, `index_v4_paginas.html`, `consorcio_user_journey_map_v2.html`.

## Validadores e Evidencias

Scripts confirmados em `tools/`:

| Script | Foco |
| --- | --- |
| `validate-design-system.mjs` | Contrato visual, referencias e mojibake. |
| `validate-route-aliases.mjs` | Paridade entre paginas HTML e aliases curtos do servidor. |
| `validate-auth-navigation.mjs` | Login local, seed users, redirect seguro e bloqueio por papel. |
| `validate-navigable-journey.mjs` | Roteiro navegavel ponta a ponta, links, marcadores e QA de jornada na lousa. |
| `validate-online-journey-smoke.mjs` | Smoke test online no GitHub Pages para as 10 etapas do roteiro navegavel. |
| `validate-simulator-groups.mjs` | Carga completa da base real no simulador, filtro vazio, score, ordenacao e paginacao. |
| `validate-simulator-performance.mjs` | Peso da base compacta, schema colunar, fallback e reducao de bytes do simulador online. |
| `validate-simulator-refactor.mjs` | Modulos extraidos do simulador, ordem de scripts, resultado modularizado, payload salvo e proximas acoes da jornada. |
| `validate-simulator-shelf.mjs` | Prateleira do simulador, ordem de scripts, filtros, page size 20-50, ordenacao, paginacao, tabela e detalhe do grupo. |
| `validate-simulator-cart.mjs` | Carrinho/projeto estruturado do simulador, ordem de scripts, totais, edicao e render do passo 4/5. |
| `validate-simulator-result-decision.mjs` | Resultado como decisao final, recomendacao, riscos, premissas, comparacoes e CTA para proposta. |
| `validate-handoff-origins.mjs` | Origem dos handoffs por proposta, trilha, sinal e pacote importado. |
| `validate-calculadoras.mjs` | Catalogo, paginas, premissas, formulas e contrato de previa sem submit automatico. |
| `validate-calculator-journey.mjs` | Execucao das 19 calculadoras, previa sem persistencia, validacao de formulario, alertas de coerencia, origem dos campos, comparacao com ultimo salvo, proxima acao dinamica, continuidade por perfil, submit persistente e mapa funcional. |
| `validate-calculator-impact-panel.mjs` | Painel de impacto das 19 calculadoras, score, risco, origem preview/salvo, proximo passo e export `BFCalculatorJourney.impactPanel`. |
| `validate-dashboard-continuity-flow.mjs` | Timeline e deep links do Dashboard Cliente. |
| `validate-decision-flow.mjs` | Fluxo calculadora -> simulador -> historico. |
| `validate-decision-journey-context.mjs` | Contexto de entrada e saida da Trilha Assistida. |
| `validate-product-journey-flow.mjs` | Produtos, eventos de jornada e deep links contextuais. |
| `validate-home-continuity-cockpit.mjs` | Cockpit de continuidade, incluindo trilha ativa e deep link da proxima acao. |
| `validate-home-contextual-hero.mjs` | Hero contextual, incluindo estado de trilha ativa. |
| `validate-proposal-acceptance.mjs` | Aceite da proposta. |
| `validate-proposal-builder.mjs` | Lousa seletiva de proposta/PDF, service `BFProposalBuilder`, presets, prontidao e ordem dos scripts. |
| `validate-proposal-governance.mjs` | Paineis de versionamento, aceite, leitura do formulario e ponte de handoff renderizados por `BFProposalGovernance`. |
| `validate-proposal-versioning.mjs` | Versionamento e comparacao local da proposta. |
| `validate-proposal-handoff.mjs` | Proposta -> handoff. |
| `validate-recovery-signals-flow.mjs` | Sinais de retomada. |
| `validate-handoff-consultant-operations.mjs` | Handoff do consultor com aging, SLA, prioridade, responsavel e proximas acoes. |
| `validate-admin-recovery-*.mjs` | Fila, filtros, pacotes, operacao, SLA, roteamento e metas. |
| `validate-admin-dashboard-source-funnel.mjs` | Cockpit Admin, origem, gargalos e proximas acoes. |
| `validate-public-contracts.mjs` | Matriz de contratos publicos, DoD e governanca de compatibilidade. |
| `validate-public-release-safety.mjs` | Publicacao segura: paths locais, dados pessoais de exemplo, selo demo, fallback estatico e CI. |
| `validate-local-database.mjs` | SQLite local, seeds, login, sessoes, eventos, snapshots sanitizados, status tecnico e contratos de API. |
| `validate-backend-production-plan.mjs` | Plano de migracao para backend produtivo, dominios, tabelas, endpoints, LGPD, backup e compatibilidade estatica. |
| `inspect-local-sql-environment.mjs` | Diagnostico local de CLIs, portas padrao e servicos SQL externos. |
| `validate-docs-modernization.mjs` | README ativo, docs historicos marcados e catalogo atual de 19 calculadoras. |
| `run-v8af-browser-evidence.mjs` | Evidencias visuais do fluxo proposta/handoff. |

## Documentacao Existente

| Documento | Uso |
| --- | --- |
| `docs/README.md` | Porta atual do Bancus Fraternis, com rotas, estado do produto, validadores e contratos preservados. |
| `docs/CHANGELOG.md` | Historico vivo de versoes e entregas. |
| `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md` | Evolucao detalhada de fases v8. |
| `docs/PLANO_SALTO_PLATAFORMA_BANK_FRATERN.md` | Salto de simulador para plataforma. |
| `docs/DESIGN_SYSTEM_V8_BANK_FRATERN.md` | Contrato visual v8. |
| `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` | Contratos publicos de localStorage, data markers, deep links, exports globais e DoD. |
| `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md` | Banco local SQLite, endpoints, tabelas, seeds, compatibilidade e validacao. |
| `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md` | Ponte do SQLite local para backend hospedado futuro, preservando fallback estatico, `BFBackendApi`, escopo e migracao por dominio. |
| `docs/PROXIMAS_FASES_BANK_FRATERN.md` | Roadmap executavel das proximas fases: migrations, adapter produtivo, autenticacao, migracao assistida, observabilidade, corte controlado e UX com dados vivos. |
| `docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md` | Ecossistema de calculadoras. |
| `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md` | Mapa funcional das 19 calculadoras, inputs, motor, saidas e continuidade. |
| `docs/TRILHA_ASSISTIDA_DECISAO.md` | Trilha assistida. |
| `docs/HANDOFF_CONSULTIVO_LEADS.md` | Handoff consultivo. |
| `docs/AUTH_ADMIN_LOCAL.md` | Auth local e admin. |
| `docs/CODEX_TEST_PROTOCOL.md` | Protocolo de testes/evidencias. |
| `docs/ARQUITETURA.md`, `docs/ATA_PROJETO.md`, `docs/FOLDER_PROJETO.md` e `docs/implementation_plan.md` | Historico ConsorcioPro marcado como documento historico/legado controlado. |

Governanca documental: docs ativos passaram a usar Bancus Fraternis como plataforma atual e 19 calculadoras; docs historicos preservam contexto antigo com aviso explicito de legado controlado.

## Pontos de Atencao

1. Revisar CTAs que usam URLs curtas antes de campanhas, demos ou handoffs.
2. Evitar aumentar `js/app.js` e `assets/js/bf-platform.js`, pois ja concentram muitas responsabilidades.
3. Preservar compatibilidade com as chaves `localStorage` existentes.
4. Nao promover dados pessoais para JSON publico, analytics local compartilhado ou pacotes exportados.
5. Manter docs historicos marcados como legado controlado e impedir retorno de contagens antigas por validador.
6. Manter novas evolucoes cobertas por `tools/validate-*.mjs`.
7. Usar design system v8 antes de criar novas variacoes visuais.
8. Tratar `versions/` como backup, nao como fonte ativa.
9. Tratar GitHub Pages como superficie publica: toda mudanca online deve preservar selo demo, fallback estatico e auditoria de publicacao segura.
10. Considerar performance ao tocar na base grande `data_base/Tab_Grupos_Consorcio.json`; regenerar e validar `data_base/Tab_Grupos_Consorcio.compact.json` quando a base canonica mudar.
11. Tratar SQLite local como infraestrutura de desenvolvimento: `.runtime/` nao entra no Git, `BANCUS_DB_PROVIDER=sqlite` e o padrao atual, e backend produtivo deve seguir `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md` e `docs/PROXIMAS_FASES_BANK_FRATERN.md`, com hospedagem, LGPD, backup, observabilidade e permissao server-side completa.
12. Antes de trocar o provider SQLite, confirmar servidor externo com `tools/inspect-local-sql-environment.mjs`.

## Proximos Vetores

O vetor recomendado para o proximo ciclo continua sendo produto e jornada, agora com foco em reduzir risco tecnico sem quebrar contratos publicos:

1. Executar a Fase 8AN / P3.3A de schema e migrations versionadas antes de qualquer provider hospedado.
2. Criar o adapter produtivo piloto `postgresql` somente depois do manifest de schema e rollback estarem validados.
3. Evoluir autenticacao produtiva, migracao assistida, observabilidade, backup e corte controlado seguindo `docs/PROXIMAS_FASES_BANK_FRATERN.md`.
4. Manter a lousa como porta de QA visual a cada nova entrega funcional e preservar `localStorage` como fallback publico.

O plano detalhado esta em `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` e as fases futuras estao em `docs/PROXIMAS_FASES_BANK_FRATERN.md`.
