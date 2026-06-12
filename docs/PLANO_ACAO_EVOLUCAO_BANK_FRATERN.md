# Plano de Acao de Evolucao Bancus Fraternis

Atualizado em 2026-06-12.

Prioridade definida: produto e jornada.

Entrega deste documento: transformar o mapa completo do projeto em um roteiro implementavel para evoluir a experiencia Bancus Fraternis, preservando a publicacao estatica e iniciando a camada local de banco/API apenas como infraestrutura progressiva.

## Principios do Ciclo

- Tratar o Bancus Fraternis como plataforma de decisao financeira integrada.
- Priorizar continuidade do usuario sobre novas telas isoladas.
- Preservar dados locais e contratos existentes.
- Nao alterar APIs funcionais sem necessidade clara.
- Manter dados pessoais fora de JSON publico, analytics compartilhado e pacotes exportados.
- Cobrir cada fase com criterios de aceite e validadores.

## Linha de Produto Alvo

Jornada principal que deve ficar mais clara:

```text
Home
  -> Produtos
  -> Calculadoras
  -> Trilha Assistida
  -> Comparador
  -> Simulador
  -> Proposta
  -> Handoff
  -> Dashboard Cliente / Dashboard Admin
```

Cada etapa deve responder quatro perguntas:

1. O que o usuario ja informou?
2. Qual e o proximo passo recomendado?
3. Qual risco ou premissa precisa ser explicada?
4. Como isso vira continuidade para cliente, consultor ou admin?

## Status Geral de Implementacao

| Frente | Status em 2026-05-11 | Evidencia |
| --- | --- | --- |
| Mapa completo e plano separado | Concluido | `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` e este plano. |
| Rotas curtas das 52 paginas | Concluido | `tools/validate-route-aliases.mjs`. |
| Base real do simulador | Concluido | 17.418 registros brutos, 17.396 grupos validos e `tools/validate-simulator-groups.mjs`. |
| Home com continuidade local | Concluido parcial | Hero e cockpit retomam trilha ativa, historico, simulacao e proximo passo. |
| Produtos com contexto preservado | Concluido parcial | CTAs usam `from=products`, `productId`, `preset` e selecao em `products`. |
| Calculadoras com contexto preservado | Concluido | CTAs usam `BFCalculatorJourney`, `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`. |
| Calculadoras com jornada corrigida | Concluido parcial | As 19 calculadoras foram mapeadas, a previa inicial nao grava perfil/historico e o salvamento ficou explicito no submit. |
| Calculadoras com validacao guiada | Concluido parcial | Campos exibem ajuda contextual, erros locais, alerta consolidado e bloqueiam salvamento invalido nas calculadoras criticas. |
| Calculadoras com coerencia de cenario | Concluido parcial | Cenários de renda, reserva, credito, lance e compra exibem alertas nao bloqueantes quando os campos apontam risco financeiro. |
| Calculadoras com proxima acao dinamica | Concluido parcial | CTA principal pos-calculo muda conforme risco: reduzir custos, montar reserva, calcular capacidade, ajustar lance, comparar ou simular. |
| Calculadoras com continuidade por perfil | Concluido parcial | CTA e timeline agora usam perfil consolidado para diferenciar previa sem salvar, falta de renda, falta de reserva, capacidade pronta e lance sugerido. |
| Calculadoras com origem dos campos | Concluido parcial | Campos preenchidos pelo perfil mostram origem visual, reduzindo duvida sobre valores reaproveitados entre calculadoras. |
| Calculadoras com iteracao comparavel | Concluido parcial | Previa atual mostra diferencas numericas contra o ultimo salvo da mesma calculadora, facilitando ajustes antes de salvar. |
| Calculadoras com impacto de jornada | Concluido parcial | Resultado agora mostra painel de impacto com score, risco, origem preview/saved, memoria e proximo passo para cada calculadora. |
| Impacto das calculadoras no cliente e handoff | Concluido parcial | Dashboard Cliente prioriza impactos das calculadoras no cockpit, lista historico acionavel e cria handoff consultivo com origem `calculator`. |
| Trilha Assistida contextual | Concluido parcial | Entrada reconhece Produtos/Calculadoras e saidas usam `from=journey` com `sourceFrom`. |
| Proposta/PDF com lousa seletiva | Concluido | Etapa 9 usa `proposal-builder-board`, presets consultivo/tecnico, prontidao de exportacao, selecao por grupos, `builder` em `ProposalSummary` e `tools/validate-proposal-builder.mjs`. |
| Versionamento de propostas | Concluido | Etapa 9 usa `data-proposal-version-panel`, `BFProposalVersions`, historico por proposta, comparacao entre versoes e travamento da versao antes do handoff. |
| Handoff por origem | Concluido parcial | Filtro, badge, metricas, origem, aging, SLA, responsavel sugerido, plano de acao executavel por lead, leitura de proposta versionada/vencida e etapa comercial/cadencia vinda do Admin. |
| Dashboards por funil/aging | Concluido parcial | Dashboard Cliente tem timeline, deep links e cockpit de retomada com proximo passo, handoff, proposta, simulacao e etapa comercial; Dashboard Admin agora tem proximas acoes, fila guiada executavel com dono/prazo/alvo/status/motivo, produtividade, carteira por consultor, funil comercial movel com historico local, cadencia por etapa, exportacao sanitizada do funil, funil por origem, aging, prioridade, responsavel sugerido, gargalos e alertas de proposta alterada apos handoff. |
| Navegacao autenticada | Concluido parcial | Login local tem acesso rapido por perfil, redirect preservado e validador dedicado. |
| Teste navegavel ponta a ponta | Concluido | `pages/lousa-navegacao.html` ganhou roteiro de Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards, alem de checkpoints de QA comercial para cliente, consultor, funil, cadencia, exportacao e online. |
| Mapa GitHub online na lousa | Concluido | Lousa ganhou bloco `data-lousa-github-map` com site publicado, repositorio, docs e links diretos da jornada no GitHub Pages. |
| Publicacao segura em GitHub Pages | Concluido parcial | Selo demo/local, fallback `404.html`, CI em `.github/workflows/validate.yml` e `tools/validate-public-release-safety.mjs`. |
| QA online da jornada publicada | Concluido | `tools/validate-online-journey-smoke.mjs` valida no GitHub Pages as 10 etapas da lousa, anchors, marcadores e fallback estatico; `docs/test-reports/online-journey-browser-report.json` registra a checagem renderizada. |
| Performance do simulador online | Concluido parcial | Simulador passou a carregar `Tab_Grupos_Consorcio.compact.json` primeiro, preservando fallback para o JSON canonico e todos os 17.396 grupos validos. |
| Banco local de usuarios, eventos e snapshots | Concluido parcial | SQLite local em `.runtime/`, endpoints `/api/database/status`, `/api/auth/*`, `/api/users`, `/api/events`, `/api/snapshots`, `/api/journey-entities`, `/api/leads`, `/api/simulations`, `/api/proposals`, escrita direta de leads/simulacoes/propostas, `BFBackendApi`, painel Admin de eventos/status/snapshots/entidades/tabelas dedicadas, fila dedicada filtravel, Dashboard Cliente com leitura server-side de snapshots, entidades e tabelas, hash `scrypt-sha256`, sessoes server-side e fallback estatico preservado. |
| Backend/API produtivo futuro | Concluido parcial | Plano produtivo criado para migrar SQLite local para backend hospedado preservando `localStorage`, `BFBackendApi`, escopo por `owner_email`, contratos `/api/*`, LGPD, backup e observabilidade. |
| Provider de banco configuravel | Concluido parcial | `BANCUS_DB_PROVIDER` foi criado com `sqlite` como padrao e providers futuros bloqueados ate adapter validado. |
| Proximas fases produtivas | Em andamento | `docs/PROXIMAS_FASES_BANK_FRATERN.md` organiza schema/migrations, adapter produtivo, autenticacao, migracao, observabilidade, corte controlado e UX com dados vivos. |
| Schema e migrations versionadas | Concluido parcial | Criada baseline SQLite versionada com `schema-manifest.json`, migration idempotente, rollback e validador de paridade com o banco real. |
| UX com dados vivos | Concluido parcial | Dashboard Cliente ganhou painel de fonte viva e o Handoff Consultivo agora mescla `/api/leads` com a fila local, sincronizando status, responsavel, checklist e notas via `PATCH` quando ha API local. |
| Governanca permanente | Em andamento | Changelog, mapa, plano, validadores, contratos publicos e lousa navegavel atualizados por entrega. |

## Mapa de Implementacao Atualizado

| Ordem | Ciclo entregue | Status | Resultado pratico | Evidencia principal |
| --- | --- | --- | --- | --- |
| 1 | Saneamento navegavel | Concluido | 52 paginas com aliases curtos, paginas ativas/legadas classificadas e lousa navegavel como porta de QA. | `tools/validate-route-aliases.mjs`, `tools/validate-navigable-journey.mjs`. |
| 2 | Base real do simulador | Concluido | Simulador preserva 17.396 grupos validos, com JSON compacto para publicacao online e fallback para a base canonica. | `tools/validate-simulator-groups.mjs`, `tools/validate-simulator-performance.mjs`. |
| 3 | Proposta/PDF consultiva | Concluido | Lousa seletiva de proposta, presets, prontidao de exportacao, versionamento local e travamento antes do handoff. | `tools/validate-proposal-builder.mjs`, `tools/validate-proposal-versioning.mjs`, `tools/validate-proposal-handoff.mjs`. |
| 4 | Handoff consultivo | Concluido parcial | Origem, aging, SLA, responsavel sugerido, filtros, plano de acao executavel, etapa comercial e cadencia por lead. | `tools/validate-handoff-origins.mjs`, `tools/validate-handoff-consultant-operations.mjs`. |
| 5 | Dashboard Admin operacional | Concluido parcial | Proximas acoes, fila guiada executavel, produtividade, carteira por consultor, filtros comerciais e exportacao sanitizada. | `tools/validate-admin-dashboard-source-funnel.mjs`, `tools/run-v8af-browser-evidence.mjs`. |
| 6 | Funil comercial admin | Concluido | Etapas Contato, Proposta, Follow-up, Negociacao e Fechamento com movimentacao por lead, historico local e reflexo no handoff. | `data-admin-commercial-stage-select`, `bf_admin_commercial_stage_audit_v1`. |
| 7 | Cadencia comercial | Concluido | Resumo das 5 etapas, movimentacoes recentes, leads parados, movidos em 24h/7d e aging medio de etapa. | `data-admin-commercial-stage-insights`, `data-admin-commercial-stage-movement`. |
| 8 | Publicacao GitHub Pages | Concluido parcial | Projeto online, CI ativo, fallback 404, selo demo/local e validacao da base real publicada. | `tools/validate-github-pages-deploy.mjs`, `tools/validate-public-release-safety.mjs`. |
| 9 | Cockpit do Dashboard Cliente | Concluido | Cliente ve proxima acao, handoff, proposta, simulacao e etapa comercial em uma leitura unica de retomada. | `data-client-continuity-cockpit`, `tools/validate-dashboard-continuity-flow.mjs`. |
| 10 | Exportacao do funil/cadencia | Concluido | Admin exporta JSON anonimo para reuniao diaria, com schema, totais por etapa, leads anonimizados, leads parados e movimentacoes recentes. | `data-admin-commercial-pipeline-export`, `bank-fratern.admin-commercial-pipeline.v1`. |
| 11 | Lousa de QA comercial | Concluido | Lousa ganhou checkpoints para cockpit cliente, cadencia consultiva, funil comercial, exportacao sanitizada e smoke test online. | `data-lousa-commercial-qa`, `tools/validate-navigable-journey.mjs`. |
| 12 | Modularizacao inicial do simulador | Concluido parcial | Contexto/prefill/proximas acoes e snapshots de salvar/carregar sairam do controlador principal para services globais dedicados. | `BFSimulatorJourney`, `BFSimulatorState`, `data-simulator-journey-actions`, `tools/validate-simulator-refactor.mjs`. |
| 13 | Lousa de proposta modularizada | Concluido parcial | Storage, presets, opcoes, dependencias, foco, prontidao e estimativa de paginas da proposta/PDF sairam do controlador principal. | `BFProposalBuilder`, `js/proposal-builder.js`, `tools/validate-proposal-builder.mjs`. |
| 14 | Governanca visual da proposta modularizada | Concluido parcial | Renderizacao de versoes, comparacao, aceite, historicos, leitura do formulario e ponte de handoff sairam do controlador principal. | `BFProposalGovernance`, `js/proposal-governance.js`, `tools/validate-proposal-governance.mjs`. |
| 15 | Carrinho/projeto do simulador modularizado | Concluido parcial | Criacao/remocao/edicao de itens, totais, render do carrinho e aplicacao de resultados sairam do controlador principal para service dedicado. | `BFSimulatorCart`, `js/simulator-cart.js`, `tools/validate-simulator-cart.mjs`. |
| 16 | Prateleira do simulador modularizada | Concluido parcial | Filtros, page size, colunas, ordenacao, paginacao, tabela e detalhe do grupo sairam do controlador principal para service dedicado. O page size agora inicia em 20 e fica limitado a 50. | `BFSimulatorShelf`, `js/simulator-shelf.js`, `tools/validate-simulator-shelf.mjs`. |
| 17 | Jornada das calculadoras saneada | Concluido parcial | Mapeadas as 19 funcoes, removido submit automatico no carregamento, adicionada previa sem persistencia, modo de resultado e validador ponta a ponta das calculadoras. | `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md`, `data-calculator-result-mode`, `tools/validate-calculator-journey.mjs`. |
| 18 | Validacao guiada das calculadoras | Concluido parcial | Campos ganharam ajuda, min/max, erro local e alerta consolidado; previa recalcula sem persistencia durante edicoes validas e submit invalido nao salva. | `data-calculator-field-error`, `data-calculator-form-alert`, `tools/validate-calculator-journey.mjs`. |
| 19 | Coerencia de cenario nas calculadoras | Concluido parcial | Custos acima da renda, reserva insuficiente, folga baixa, lance acima do limite e compra que fragiliza caixa agora geram alerta nao bloqueante. | `data-calculator-coherence-alert`, `data-calculator-coherence`, `tools/validate-calculator-journey.mjs`. |
| 20 | Proxima acao dinamica nas calculadoras | Concluido parcial | Ponte de decisao destaca o CTA principal conforme risco e slug da calculadora, preservando trilha, comparador, simulador e dashboard como alternativas. | `data-calculator-next-action`, `data-calculator-next-action-card`, `buildCalculatorNextAction`. |
| 21 | Banco local de usuarios e eventos | Concluido parcial | API local Node/SQLite guarda usuarios, sessoes e eventos sanitizados, enquanto GitHub Pages e `file://` seguem com `localStorage`. | `js/backend/db.js`, `assets/js/services/backend-api.service.js`, `tools/validate-local-database.mjs`. |
| 22 | Eventos server-side no Admin | Concluido parcial | Dashboard Admin le `/api/events`, mostra metricas do SQLite, ultimos eventos e estado de fallback quando a API local nao esta disponivel. | `data-admin-backend-events`, `data-admin-backend-event-refresh`, `BFBackendApi.listEvents`. |
| 23 | Diagnostico backend SQL local | Concluido parcial | API ganhou `/api/database/status`, Admin mostra provider/tabelas/PRAGMAs do SQLite e o inspetor local detecta CLIs, portas e servicos SQL externos. | `BFBackendApi.databaseStatus`, `data-admin-backend-table`, `tools/inspect-local-sql-environment.mjs`. |
| 24 | Migracao guiada localStorage -> SQLite | Concluido parcial | Admin previsualiza e executa importacao idempotente de usuarios/eventos locais para o SQLite, com senha temporaria para novos usuarios. | `POST /api/database/import-local`, `BFBackendApi.importLocalSnapshot`, `data-admin-local-import-panel`. |
| 25 | Snapshots server-side de jornada | Concluido parcial | SQLite guarda snapshots sanitizados de simulacao, trilha, proposta, lousa, perfil, modelos e handoff; Admin importa esses estados pelo painel guiado. | `POST /api/snapshots`, `GET /api/snapshots`, `data-admin-local-snapshot-count`, `BFBackendApi.recordSnapshot`. |
| 26 | Hooks reais de snapshot | Concluido parcial | Salvamentos reais de simulacao, perfil, trilha, proposta, lousa e handoff tentam sincronizar `/api/snapshots` sem bloquear `localStorage`. | `Storage.saveSimulation`, `BFProposalVersions.save`, `BFProposalAcceptance.saveReview`, `BFProposalBuilder.saveConfig`, `BFTrilhaDecisaoService.save`, `BFHandoffConsultivoService`. |
| 27 | Leitura server-side de snapshots | Concluido parcial | Dashboard Cliente usa snapshots SQLite como fonte preferida quando a API local esta ativa; Dashboard Admin lista snapshots recentes junto de eventos e status. | `data-client-backend-snapshots`, `data-admin-backend-snapshots`, `GET /api/snapshots` escopado por sessao. |
| 28 | Entidades relacionais locais | Concluido parcial | Snapshots de handoff, simulacao e proposta agora alimentam `journey_entities`, permitindo consulta por `lead`, `simulation` e `proposal`. | `GET /api/journey-entities`, `data-admin-backend-entities`, `data-client-backend-entities`. |
| 29 | Tabelas dedicadas locais | Concluido parcial | Entidades relacionais agora materializam `journey_leads`, `journey_simulations` e `journey_proposals`, com endpoints dedicados. | `GET /api/leads`, `GET /api/simulations`, `GET /api/proposals`, `data-admin-backend-materialized`, `data-client-backend-materialized`. |
| 30 | Escrita direta de jornada local | Concluido parcial | Leads, simulacoes e propostas podem ser criados/atualizados diretamente nas tabelas dedicadas, mantendo `journey_entities`, sanitizacao e escopo por sessao. | `POST/PATCH /api/leads`, `POST/PATCH /api/simulations`, `POST/PATCH /api/proposals`, `BFBackendApi.saveProposal`. |
| 31 | Hooks reais para tabelas dedicadas | Concluido parcial | Salvamentos reais de simulador, proposta, lousa e handoff agora gravam diretamente em `journey_simulations`, `journey_proposals` e `journey_leads`, mantendo snapshots como compatibilidade. | `Storage.saveSimulation`, `BFProposalVersions.save`, `BFProposalAcceptance.saveReview`, `BFProposalBuilder.saveConfig`, `BFHandoffConsultivoService`, `api.saveSimulation/saveProposal/saveLead`. |
| 32 | Operacao Admin de tabelas dedicadas | Concluido parcial | Dashboard Admin agora permite alterar status, etapa e prioridade dos registros dedicados via `PATCH`, com auditoria server-side do backend local. | `data-admin-backend-materialized-control`, `data-admin-backend-materialized-field`, `data-admin-backend-materialized-save`, `updateLead/updateSimulation/updateProposal`. |
| 33 | Simulador guiado por objetivo | Concluido parcial | Etapa de filtros agora orienta a busca por objetivo do cliente, aplica filtros sugeridos, explica por que cada grupo apareceu na prateleira e ajusta o header mobile para nao cobrir a jornada. | `data-simulator-objective-guide`, `applySimulatorObjectiveGuide`, `data-shelf-recommendation`, `explainGroupRecommendation`. |
| 34 | Resultado como decisao | Concluido parcial | Resultado financeiro agora vira recomendacao final com riscos, premissas, comparacoes e CTA para proposta, disponivel na etapa 7 e no PDF/lousa. | `data-simulator-result-decision`, `buildResultDecision`, `tools/validate-simulator-result-decision.mjs`. |
| 35 | Continuidade por perfil nas calculadoras | Concluido parcial | Ponte das calculadoras agora ajusta CTA e timeline conforme perfil real: previa sem salvar, sem renda, sem reserva, capacidade pronta ou lance sugerido. | `data-calculator-profile-continuity`, `data-calculators-profile-continuity`, `buildCalculatorProfileContinuity`. |
| 36 | Origem dos campos nas calculadoras | Concluido parcial | Campos reaproveitados do perfil consolidado agora exibem selo de origem e marcador publico para reduzir duvida do usuario. | `data-calculator-field-source`, `data-calculator-field-origin`, `BFCalculatorJourney.fieldSource`. |
| 37 | Comparacao com ultimo salvo nas calculadoras | Concluido parcial | Resultado atual compara metricas numericas com o ultimo salvo da mesma calculadora para apoiar iteracao consultiva. | `data-calculator-saved-comparison`, `data-calculator-saved-comparison-item`, `BFCalculatorJourney.savedComparison`. |
| 38 | Fila dedicada de registros no Admin | Concluido parcial | Admin separa leads, simulacoes e propostas materializadas em uma fila propria com busca, filtros por tipo/status/prioridade/dono, resumo operacional e edicao inline preservada. | `data-admin-dedicated-queue`, `data-admin-dedicated-queue-filter`, `data-admin-dedicated-queue-item`, `renderBackendDedicatedQueue`. |
| 39 | Resultado do simulador modularizado | Concluido parcial | Calculo, resumo, proposta e tabela analitica passaram a ser delegados para `BFSimulatorResult`, mantendo `App.*`, PDF e proposta como fachada publica. | `js/simulator-result.js`, `BFSimulatorResult`, `tools/validate-simulator-refactor.mjs`. |
| 40 | Quantidade configuravel da prateleira | Concluido | Consultor escolhe quantos grupos ver na prateleira, com padrao 20 e limite 50, mantendo Configuracoes, Home e Simulador alinhados. | `pages/simulador.html`, `pages/configuracoes.html`, `js/settings.js`, `js/app.js`, `js/simulator-shelf.js`, `tools/validate-simulator-shelf.mjs`. |
| 41 | Backend produtivo governado | Concluido parcial | Fronteira de migracao definida para usuarios, sessoes, eventos, snapshots, leads, simulacoes e propostas, mantendo fallback estatico e contratos publicos. | `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`, `tools/validate-backend-production-plan.mjs`. |
| 42 | Provider de banco configuravel | Concluido parcial | Camada inicial de provider criada com `BANCUS_DB_PROVIDER`, aliases para SQLite e erro explicito para providers sem adapter. | `js/backend/db.js`, `server.js`, `tools/validate-local-database.mjs`, `tools/validate-backend-production-plan.mjs`. |
| 43 | Proximas fases produtivas | Planejado | Roadmap executavel criado para migrations, adapter PostgreSQL piloto, autenticacao produtiva, migracao assistida, observabilidade, corte controlado e UX com dados vivos. | `docs/PROXIMAS_FASES_BANK_FRATERN.md`, `tools/validate-next-phases-plan.mjs`. |
| 44 | UX com dados vivos | Concluido parcial | Dashboard Cliente mostra origem ativa e contadores vivos; Handoff Consultivo exibe uma fila consultiva com dados vivos, mescla leads SQLite com locais e sincroniza atualizacoes de atendimento. | `data-client-live-data-panel`, `data-handoff-live-data-panel`, `tools/validate-live-data-ux.mjs`. |
| 45 | Schema e migrations versionadas | Concluido parcial | Criada baseline `001_bancus_fraternis_local_db.sql`, rollback, `schema-manifest.json` e validador que compara manifest, SQL e schema SQLite real. | `js/backend/migrations/*`, `tools/validate-database-migrations.mjs`. |
| 46 | Impacto de jornada nas calculadoras | Concluido parcial | As 19 calculadoras mostram score, risco/coerencia, origem preview/saved, memoria e proximo passo em um painel unico de resultado. | `data-calculator-impact-panel`, `BFCalculatorJourney.impactPanel`, `tools/validate-calculator-impact-panel.mjs`. |
| 47 | Impacto acionavel no cliente e handoff | Concluido parcial | Dashboard Cliente transforma calculos salvos em cards de impacto, prioriza revisao/simulacao e cria handoff consultivo por historico de calculadora. | `data-client-calculator-impact`, `data-client-create-calculator-handoff`, `BFHandoffConsultivoService.createFromCalculatorImpact`. |
| 48 | Mapa online GitHub na lousa | Concluido | A lousa publicada agora expõe site, repositorio, mapa completo, plano de evolucao e links diretos da jornada online. | `data-lousa-github-map`, `data-lousa-github-journey`, `tools/validate-navigable-journey.mjs`. |

## Proximos Passos Priorizados

| Prioridade | Proximo passo | Descricao | Arquivos provaveis | Criterio de aceite |
| --- | --- | --- | --- | --- |
| Concluido | Dashboard Cliente mais acionavel | Transformar timeline e retomadas em um cockpit com proximo passo claro, status do handoff, proposta, simulacao vinculada e etapa comercial quando existir. | `pages/dashboard-cliente.html`, `assets/js/client-dashboard.js`, `assets/css/bf-design-system-v8.css`. | Cliente entende em uma tela onde parou e qual CTA seguir. |
| Concluido | Operacao consultiva conectada ao funil | Levar a etapa comercial e a cadencia para o Handoff Consultivo, para o consultor ver a mesma leitura do Admin. | `pages/handoff-consultivo.html`, `assets/js/handoff-consultivo.js`, `assets/js/services/handoff-consultivo.service.js`. | Consultor enxerga etapa, atraso de etapa e ultima movimentacao sem abrir o Admin. |
| Concluido | Exportacao comercial do funil | Criada exportacao sanitizada do funil/cadencia para reuniao diaria, sem e-mail, telefone, CPF ou dados bloqueados. | `assets/js/admin-users.js`, `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`, `tools/validate-admin-dashboard-source-funnel.mjs`. | JSON exportado possui schema, totais por etapa, leads anonimizados e zero dado sensivel. |
| Concluido | Lousa de QA atualizada | Lousa navegavel inclui funil comercial, cadencia, dashboard cliente, handoff consultivo, exportacao do funil e publicacao online como checkpoints visuais. | `pages/lousa-navegacao.html`, `tools/validate-navigable-journey.mjs`. | A lousa permite validar a jornada inteira sem abrir docs. |
| Concluido parcial | Reducao de divida tecnica do simulador | Separadas responsabilidades de contexto/jornada, salvar/carregar, prateleira, carrinho/projeto, calculo/resultado, lousa de proposta/PDF e governanca visual da proposta em services dedicados, sem alterar contratos publicos. | `js/app.js`, `js/simulator-journey.js`, `js/simulator-state.js`, `js/simulator-shelf.js`, `js/simulator-cart.js`, `js/simulator-result.js`, `js/proposal-builder.js`, `js/proposal-governance.js`, `tools/validate-simulator-refactor.mjs`, `tools/validate-simulator-shelf.mjs`, `tools/validate-simulator-cart.mjs`, `tools/validate-proposal-builder.mjs`, `tools/validate-proposal-governance.mjs`. | Validadores atuais continuam verdes e o fluxo do simulador nao muda para o usuario. |
| Concluido parcial | Saneamento das calculadoras | Separar previa de salvamento, mapear as 19 funcoes e garantir que a abertura da pagina nao polui `bf_financial_profile_v1`, `bf_calculator_history_v1` ou auditoria local. | `assets/js/calculadoras-page.js`, `docs/MAPA_FUNCOES_CALCULADORAS_BANK_FRATERN.md`, `tools/validate-calculator-journey.mjs`. | As 19 calculadoras executam com defaults, previa nao persiste e submit de capacidade/lance grava historico e perfil. |
| Concluido parcial | Validacao visual das calculadoras | Revisados estados de erro, ajuda de campo e limites nas calculadoras mais usadas: Custos Fixos, Reserva, Capacidade, Lance e Compra. | `assets/js/calculadoras-page.js`, `assets/css/platform.css`, `tools/validate-calculator-journey.mjs`. | Usuario entende o que preencher, recebe erro por campo e submit invalido nao grava perfil/historico. |
| Concluido parcial | Erros cross-field das calculadoras | Adicionados alertas de coerencia entre campos, como custos muito acima da renda, reserva insuficiente para lance ou parcela acima da renda. | `assets/js/calculadoras-page.js`, `assets/css/platform.css`, `tools/validate-calculator-journey.mjs`. | Usuario recebe alerta de risco sem impedir cenarios reais de diagnostico. |
| Concluido parcial | Prioridade visual da proxima acao | CTAs pos-calculo agora destacam o caminho certo conforme o alerta: reduzir custos, montar reserva, calcular capacidade, ir ao simulador ou comparar alternativas. | `assets/js/calculadoras-page.js`, `tools/validate-calculator-journey.mjs`. | O proximo passo muda conforme risco e origem do calculo. |
| Concluido parcial | Mensagem de continuidade por perfil | Usa dados do perfil consolidado para ajustar texto do CTA e timeline: cliente sem renda, sem reserva, com capacidade pronta ou com lance sugerido. | `assets/js/calculadoras-page.js`, `assets/js/services/decision-context.service.js`, `tools/validate-calculator-journey.mjs`. | Ponte de calculadora conversa com o estado real do perfil, nao apenas com o slug atual. |
| Concluido parcial | Origem dos campos reaproveitados | Mostrar quando renda, reserva, capacidade, patrimonio, credito ou lance vieram do perfil consolidado. | `assets/js/calculadoras-page.js`, `assets/css/platform.css`, `tools/validate-calculator-journey.mjs`. | Usuario entende quais valores foram herdados e pode ajustar manualmente sem perder contexto. |
| Concluido parcial | Comparacao entre previa e ultimo salvo | Mostrar variacao das metricas principais da calculadora atual contra o ultimo historico salvo da mesma calculadora. | `assets/js/calculadoras-page.js`, `assets/css/platform.css`, `tools/validate-calculator-journey.mjs`. | Usuario enxerga se a alteracao mudou parcela, reserva, patrimonio ou comprometimento antes de salvar novo cenario. |
| Concluido parcial | Impacto das calculadoras na continuidade | Levar score, risco e proximo passo das calculadoras para o Dashboard Cliente e permitir que o cliente abra um handoff consultivo dessa origem. | `assets/js/client-dashboard.js`, `assets/js/services/handoff-consultivo.service.js`, `assets/js/handoff-consultivo.js`, `pages/handoff-consultivo.html`. | Cliente entende qual calculo merece revisao; consultor recebe lead com origem, score, risco, checklist e filtro `calculator`. |
| Concluido parcial | Painel admin de eventos do banco local | Exposta leitura de `/api/events` no Dashboard Admin quando houver sessao de API, mantendo fallback no estatico. | `pages/dashboard-admin.html`, `assets/js/admin-users.js`, `assets/js/services/backend-api.service.js`. | Admin ve ultimos eventos server-side sem expor senha, token, CPF ou telefone. |
| Concluido parcial | Diagnostico do backend SQL local | Expor status tecnico do SQLite ativo e detectar se PostgreSQL, MySQL ou SQL Server estao instalados/escutando antes de trocar provider. | `server.js`, `js/backend/db.js`, `assets/js/admin-users.js`, `tools/inspect-local-sql-environment.mjs`. | Admin ve provider, tabelas e integridade; relatorio local mostra portas e ferramentas SQL disponiveis. |
| Concluido parcial | Migracao guiada localStorage -> SQLite | Criar acao controlada para importar usuarios/eventos/snapshots locais para o banco local, com previsualizacao e relatorio. | `server.js`, `assets/js/admin-users.js`, `js/backend/db.js`, `tools/validate-local-database.mjs`. | Admin consegue consolidar dados locais no SQLite sem duplicar registros e atualizando snapshots pelo mesmo id. |
| Concluido parcial | Snapshots server-side | Persistir estados recuperaveis para preparar migracao futura de simulacoes, propostas, trilhas e handoffs. | `server.js`, `assets/js/services/backend-api.service.js`, `assets/js/admin-users.js`, `js/backend/db.js`. | API local cria/lista snapshots sanitizados e Admin mostra quantidade local importavel. |
| Concluido parcial | Hooks reais de snapshot | Conectar os pontos reais de salvamento ao endpoint `/api/snapshots`, mantendo fallback estatico. | `js/storage.js`, `js/proposal-versioning.js`, `js/proposal-acceptance.js`, `js/proposal-builder.js`, `assets/js/services/decision-context.service.js`, `assets/js/services/trilha-decisao.service.js`, `assets/js/services/handoff-consultivo.service.js`. | Salvar simulacao/proposta/trilha/handoff continua funcionando offline e sincroniza no SQLite quando houver API local. |
| Concluido parcial | Dashboards lendo snapshots SQLite | Usar `/api/snapshots` como fonte preferida no Dashboard Cliente e listar snapshots recentes no Dashboard Admin. | `server.js`, `js/backend/db.js`, `assets/js/client-dashboard.js`, `assets/js/admin-users.js`. | Cliente/consultor enxergam apenas seus snapshots, admin enxerga todos, e o fallback estatico segue funcionando. |
| Concluido parcial | Entidades relacionais locais | Indexar snapshots como leads, simulacoes e propostas para preparar consultas comerciais reais sem abandonar o fallback local. | `js/backend/db.js`, `server.js`, `assets/js/services/backend-api.service.js`, `assets/js/admin-users.js`, `assets/js/client-dashboard.js`. | API lista entidades por escopo de sessao, Admin ve resumo por tipo e Cliente sinaliza camada relacional quando disponivel. |
| Concluido parcial | Tabelas dedicadas locais | Materializar leads, simulacoes e propostas em tabelas separadas para preparar escrita direta e regras especificas. | `js/backend/db.js`, `server.js`, `assets/js/services/backend-api.service.js`, `assets/js/admin-users.js`, `assets/js/client-dashboard.js`. | Endpoints dedicados respeitam escopo por sessao e dashboards sinalizam as tabelas materializadas. |
| Concluido parcial | Escrita direta de jornada local | Criar contratos diretos para leads, simulacoes e propostas sem depender exclusivamente de snapshots. | `js/backend/db.js`, `server.js`, `assets/js/services/backend-api.service.js`, `tools/validate-local-database.mjs`. | POST/PATCH criam e atualizam tabelas dedicadas, sincronizam `journey_entities`, sanitizam payload e respeitam o dono da sessao. |
| Concluido parcial | Conectar telas reais aos endpoints diretos | Salvamentos de handoff, simulador, versionamento, aceite e lousa da proposta gravam tambem via `saveLead`, `saveSimulation` e `saveProposal`, mantendo `recordSnapshot` como compatibilidade. | `assets/js/services/handoff-consultivo.service.js`, `js/storage.js`, `js/proposal-versioning.js`, `js/proposal-acceptance.js`, `js/proposal-builder.js`. | Criar handoff/simulacao/proposta aparece imediatamente nas tabelas dedicadas sem esperar importacao ou reindexacao por snapshot. |
| Concluido parcial | Dashboard Admin com acoes sobre registros dedicados | Usa `PATCH /api/leads/:id`, `/api/simulations/:id` e `/api/proposals/:id` para permitir mudanca operacional controlada de status, prioridade e etapa a partir do Admin. | `assets/js/admin-users.js`, `assets/css/platform.css`, `tools/validate-local-database.mjs`. | Admin consegue ajustar status/etapa/prioridade de registros dedicados com auditoria, sem editar snapshots manualmente. |
| Concluido parcial | Simulador orientado por objetivo | Transformar objetivo do cliente em filtros sugeridos, ordenacao e leitura explicavel da prateleira. | `pages/simulador.html`, `js/app.js`, `js/simulator-journey.js`, `js/simulator-shelf.js`, `css/styles.css`, `assets/css/bf-design-system-v8.css`. | Usuario aplica filtros guiados por objetivo e entende os motivos de recomendacao de cada grupo. |
| Concluido parcial | Resultado como decisao | Transformar o resumo financeiro em recomendacao final com riscos, premissas, comparacao e CTA para proposta. | `js/app.js`, `js/proposal-summary.js`, `js/proposal-builder.js`, `css/styles.css`, `tools/validate-simulator-result-decision.mjs`. | Resultado deixa claro qual grupo/cenario seguir, o que revisar e quando gerar proposta. |
| Concluido parcial | Filtros e fila dedicada no Admin | Separados leads, simulacoes e propostas em uma fila propria com filtros por tipo, status, prioridade e dono, mantendo a edicao inline atual. | `assets/js/admin-users.js`, `assets/css/platform.css`, `tools/validate-local-database.mjs`. | Admin encontra rapidamente registros dedicados e consegue priorizar o proximo atendimento sem navegar pela auditoria completa. |
| Concluido parcial | Proxima extracao do simulador | Separado calculo/orquestracao de resultado em modulo menor, mantendo `App.*` como fachada publica. | `js/app.js`, `js/engine.js`, `js/simulator-result.js`. | Reduzir `app.js` sem quebrar resultados, proposta, PDF e simulacoes salvas. |
| Concluido | Prateleira com quantidade controlada | Padronizado controle numerico de 20 a 50 grupos por pagina, comecando em 20, com normalizacao das preferencias antigas. | `pages/simulador.html`, `pages/configuracoes.html`, `js/settings.js`, `js/simulator-shelf.js`, `tools/validate-simulator-shelf.mjs`. | Consultor consegue reduzir ou ampliar a leitura da prateleira sem passar de 50 grupos visiveis por pagina. |
| Concluido parcial | Backend/API produtivo futuro | Fronteiras de migracao documentadas para usuarios, sessoes, eventos, snapshots, leads, simulacoes, propostas e handoffs, mantendo `localStorage` como fallback publico. | `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`, `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`, `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md`, `tools/validate-backend-production-plan.mjs`. | Plano tecnico define contratos de migracao do SQLite local para backend hospedado, com LGPD, backup, observabilidade e rollback como criterios de aceite. |
| Concluido parcial | UX com dados vivos | Expor a fonte ativa no Dashboard Cliente e transformar o Handoff Consultivo em Fila consultiva com dados vivos, lendo `/api/leads` e mantendo fallback local. | `pages/dashboard-cliente.html`, `assets/js/client-dashboard.js`, `pages/handoff-consultivo.html`, `assets/js/handoff-consultivo.js`, `tools/validate-live-data-ux.mjs`. | Cliente entende se a jornada veio do SQLite ou `localStorage`; consultor ve e atualiza leads vivos sem perder a fila local. |
| Concluido parcial | Schema e migrations versionadas | Criada a Fase 8AN / P3.3A antes do adapter produtivo, com migration idempotente, manifest de schema e rollback. | `js/backend/migrations/schema-manifest.json`, `js/backend/migrations/001_bancus_fraternis_local_db.sql`, `tools/validate-database-migrations.mjs`, `docs/PROXIMAS_FASES_BANK_FRATERN.md`. | Todas as tabelas atuais possuem migration, SQLite segue verde e o adapter futuro tem contrato de schema. |
| P0 | Adapter produtivo piloto | Implementar a Fase 8AO / P3.3B com `BANCUS_DB_PROVIDER=postgresql`, `BANCUS_DATABASE_URL`, smoke test e fallback SQLite. | `js/backend/providers/*`, `server.js`, `tools/validate-database-provider.mjs`. | `BFBackendApi` e `/api/*` preservam semantica, provider sem credencial falha explicitamente e staging usa dados de teste. |

## Fase 1 - Saneamento da Jornada Navegavel

Objetivo: garantir que todas as paginas ativas estejam acessiveis, classificadas e coerentes antes de evoluir fluxos comerciais.

Status em 2026-05-11:

- Aliases curtos das 7 paginas pendentes foram adicionados ao `server.js`.
- Criado `tools/validate-route-aliases.mjs` para impedir regressao.
- Mapa completo atualizado para registrar 52 paginas e 52 aliases curtos.

Entregas:

- Atualizar `server.js` para incluir aliases curtos das 7 paginas sem alias. Concluido em 2026-05-07.
- Criar ou atualizar uma matriz de paginas ativas, legado controlado e evidencias no mapa do projeto. Concluido em 2026-05-07.
- Revisar CTAs e links principais que apontam para paginas da jornada.
- Marcar explicitamente paginas legadas como legado controlado nos docs, sem remove-las.

Arquivos provaveis:

- `server.js`
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md`
- `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md`
- Validadores em `tools/` se houver novo contrato de rota.

Criterios de aceite:

- As 52 paginas continuam acessiveis por `/pages/<arquivo>.html`.
- As paginas ativas tambem respondem por URL curta quando fizer sentido.
- `componentes-v8.html`, `handoff-consultivo.html`, `modelos-biblioteca.html`, `modelos-governanca.html`, `trilha-decisao.html`, `calculadora-capacidade-credito.html` e `calculadora-lance-consorcio.html` deixam de ser lacuna de alias.
- O mapa diferencia ativo, legado controlado, backup, evidencia e runtime.
- Login local recebeu acesso rapido por perfil e redirect seguro para pagina protegida.
- Criado `tools/validate-auth-navigation.mjs`.

Testes recomendados:

- Rodar `node tools/validate-design-system.mjs`.
- Rodar `node tools/validate-route-aliases.mjs`.
- Rodar `node tools/validate-auth-navigation.mjs`.
- Abrir Home, Produtos, Trilha, Handoff e Componentes v8 no servidor local.

## Fase 2 - Continuidade do Usuario

Objetivo: reforcar a passagem entre Home, produtos, calculadoras, trilha, comparador e simulador.

Status em 2026-05-11:

- `pages/index.html` passou a carregar `assets/js/services/trilha-decisao.service.js` antes da Home.
- `js/home.js` passou a ler a trilha ativa em `bf_decision_journey_v1:<owner>`.
- Hero contextual, cockpit, metricas, cards e proximos passos da Home agora exibem a proxima acao da trilha ativa.
- `tools/validate-home-continuity-cockpit.mjs` valida trilha ativa, deep link para comparador e ausencia de dados pessoais renderizados.
- `pages/produtos.html` passou a ter atalhos de simuladores com `from=products`, `productId` e `preset`.
- `assets/js/bf-platform.js` passou a expor `BFProductsJourney` e a gerar CTAs contextuais para simulador, comparador, calculadora e trilha.
- `assets/js/components/cards.js` passou a renderizar CTAs contextuais vindos de Produtos.
- `tools/validate-product-journey-flow.mjs` valida os deep links de Produtos, incluindo selecao manual no comparador.
- `assets/js/calculadoras-page.js` passou a expor `BFCalculatorJourney` e a gerar rotas para Trilha, Comparador, Simulador, Dashboard, Hub e reabertura da calculadora.
- Hub, historico e paginas individuais de calculadoras agora preservam `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`.
- `assets/js/trilha-decisao.js` passou a expor `BFDecisionJourneyContext`, reconhecer contexto vindo de Produtos/Calculadoras e contextualizar CTAs de saida com `from=journey` e `sourceFrom`.
- Criado `tools/validate-decision-journey-context.mjs` para validar entrada contextual da Trilha.

Entregas:

- Revisar a Home para mostrar a proxima acao com base em perfil, historico, simulacao salva e trilha ativa. Concluido para Home em 2026-05-07.
- Garantir que Produtos leve para calculadora, comparador ou simulador com contexto preservado. Concluido para Produtos em 2026-05-07.
- Garantir que Calculadoras continuem alimentando `BFDecisionContext` e levem para trilha/comparador/simulador. Concluido em 2026-05-07.
- Fortalecer a Trilha Assistida como hub de decisao, usando produto, modelo recomendado e CTA claro. Concluido parcialmente em 2026-05-07 com contexto de entrada/saida preservado.
- Padronizar copy de continuidade: diagnosticar, comparar, simular, revisar proposta ou falar com consultor.

Arquivos provaveis:

- `pages/index.html`
- `js/home.js`
- `pages/produtos.html`
- `assets/js/bf-platform.js`
- `assets/js/calculadoras-page.js`
- `assets/js/services/decision-context.service.js`
- `assets/js/services/trilha-decisao.service.js`

Criterios de aceite:

- Usuario sem perfil e direcionado para diagnostico inicial.
- Usuario com historico de calculadora recebe continuidade para trilha, comparador ou simulador.
- Usuario com simulacao salva recebe caminho para carteira/revisao.
- Usuario com trilha ativa ve a proxima etapa na Home e segue por deep link para comparador, simulador ou calculadora da trilha.
- Usuario vindo de Produtos chega a simulador, calculadora, comparador ou trilha com `from=products`, `productId`, `preset` e selecao preservada quando existir.
- Usuario vindo de Calculadoras chega a Trilha, Comparador ou Simulador com `calculatorSlug`, `historyId` e `preset`.
- Usuario vindo de Produtos ou Calculadoras para a Trilha sai para proximo destino com `from=journey` e `sourceFrom` preservado.
- Nenhum estado exibe CPF, telefone, email ou nome em analytics compartilhado.

Testes recomendados:

- `node tools/validate-simulator-groups.mjs`
- `node tools/validate-home-continuity-cockpit.mjs`
- `node tools/validate-home-contextual-hero.mjs`
- `node tools/validate-calculadoras.mjs`
- `node tools/validate-decision-flow.mjs`
- `node tools/validate-decision-journey-context.mjs`
- `node tools/validate-product-journey-flow.mjs`

## Fase 3 - Evolucao Comercial e Handoff por Origem

Objetivo: tornar handoffs mais legiveis por origem e mais acionaveis para consultor/admin.

Status em 2026-05-11:

- `BFHandoffConsultivoService` passou a expor `sourceType()`, `sourceLabel()` e metricas por origem.
- `pages/handoff-consultivo.html` ganhou filtro de origem.
- `assets/js/handoff-consultivo.js` passou a renderizar badge, resumo e painel de origem nos cards e detalhes.
- `assets/js/admin-users.js` passou a exibir metricas de propostas e trilhas no resumo administrativo de handoffs.
- Criado `tools/validate-handoff-origins.mjs`.
- Etapa 9 do simulador passou a permitir proposta/PDF por lousa, com escolha de blocos, graficos, conceitos e formulas antes da exportacao.
- Etapa 9 do simulador passou a salvar historico versionado da proposta, comparar mudancas de metricas/lousa e anexar a versao congelada ao handoff.
- Handoff passou a mostrar `data-handoff-proposal-version`, validade, snapshot, proximo passo da proposta e alertas para proposta vencida ou sem versao travada.
- Dashboard Admin passou a cruzar `bank_fratern_proposal_versions_v1` com handoffs para apontar proposta vencida, versionada sem handoff ou alterada apos o handoff.
- `BFHandoffConsultivoService` passou a expor `actionPlan()` e o handoff ganhou `data-handoff-action-plan` com dono, prazo e CTA operacional.
- `BFHandoffConsultivoService` passou a persistir execucao em `bf_operational_action_states_v1` e historico em `bf_operational_action_audit_v1`.
- Handoff do consultor ganhou cockpit com aging, SLA, prioridade, responsavel sugerido, filtro por responsavel/aging e proximas acoes.
- Handoff do consultor passou a ler `bf_admin_commercial_stage_states_v1` e `bf_admin_commercial_stage_audit_v1`, exibindo `data-handoff-commercial-stage`, painel de cadencia e historico da ultima movimentacao comercial.
- Criado `tools/validate-proposal-versioning.mjs` com relatorio em `docs/test-reports/proposal-versioning-report.json`.
- Criado `tools/validate-handoff-consultant-operations.mjs` com relatorio em `docs/test-reports/handoff-consultant-operations-report.json`.

Origens prioritarias:

- Proposta revisada no simulador.
- Trilha assistida.
- Sinal de retomada.
- Pacote importado de recuperacao.

Entregas:

- Exibir origem do handoff com destaque visual no painel consultivo. Concluido em 2026-05-07.
- Adicionar filtros por origem, status, prioridade, responsavel e aging. Concluido para o painel consultivo em 2026-05-08.
- Diferenciar handoff vindo de proposta revisada de handoff vindo de trilha ou retomada. Concluido em 2026-05-07.
- Mostrar checklist contextual por origem, junto de SLA, responsavel sugerido e proximo passo. Concluido parcialmente em 2026-05-08 no detalhe do handoff.
- Garantir que segunda criacao da mesma origem atualize o handoff existente, sem duplicidade.
- Salvar versao da proposta antes de exportar/imprimir e antes de criar handoff. Concluido em 2026-05-08.
- Exibir comparacao entre a ultima versao e a anterior antes do handoff. Concluido em 2026-05-08.
- Alertar quando uma proposta for vencida, nao versionada ou alterada depois do handoff. Concluido em 2026-05-11.
- Transformar proximo passo do lead em plano de acao com dono, prazo e CTA. Concluido em 2026-05-11.
- Permitir iniciar, adiar, concluir e reabrir o plano de acao com motivo e historico local. Concluido em 2026-05-11.
- Mostrar etapa comercial, atraso de etapa e ultima movimentacao do funil no Handoff Consultivo. Concluido em 2026-05-11.

Arquivos provaveis:

- `pages/handoff-consultivo.html`
- `assets/js/handoff-consultivo.js`
- `assets/js/services/handoff-consultivo.service.js`
- `pages/dashboard-admin.html`
- `assets/js/admin-users.js`

Criterios de aceite:

- Handoff de proposta mostra proposta, versao, validade e status de revisao.
- Proposta mostra historico versionado, status de mudancas pendentes e comparacao com a versao anterior.
- Handoff de proposta mostra snapshot, validade, status de versao e proximo passo operacional.
- Handoff mostra plano de acao com dono operacional, prazo e CTA direto para proposta ou lead.
- Handoff permite executar o plano de acao e preserva status, motivo e historico por acao.
- Handoff mostra etapa comercial, prazo alvo, aging da etapa e historico da movimentacao feita no Admin.
- Admin destaca proposta vencida, proposta versionada sem handoff e proposta alterada apos handoff como gargalos acionaveis.
- Handoff de trilha mostra objetivo, produto, modelo e proxima acao.
- Handoff de retomada mostra etapa abandonada, severidade e aging.
- Consultor consegue filtrar e priorizar por origem.
- Admin enxerga funil por origem sem expor dados sensiveis proibidos.

Testes recomendados:

- `node tools/validate-proposal-acceptance.mjs`
- `node tools/validate-proposal-builder.mjs`
- `node tools/validate-proposal-governance.mjs`
- `node tools/validate-proposal-versioning.mjs`
- `node tools/validate-proposal-handoff.mjs`
- `node tools/validate-handoff-origins.mjs`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-recovery-signals-flow.mjs`
- `node tools/validate-admin-recovery-queue.mjs`
- Teste visual desktop/mobile do painel consultivo.

## Fase 4 - Dashboards com Funil e Proximos Passos

Objetivo: transformar dashboard cliente e admin em centros de continuidade mais claros.

Status em 2026-05-11:

- `assets/js/client-dashboard.js` passou a gerar deep links de retomada com `from=dashboard`.
- Linha do tempo do cliente passou a exibir Diagnostico, Calculadora, Trilha, Comparador, Simulacao, Proposta e Handoff.
- Card de Handoff do cockpit do cliente passou a mostrar origem e aging.
- Dashboard Cliente ganhou `data-client-continuity-cockpit`, consolidando `data-client-next-action`, `data-client-handoff-status`, `data-client-proposal-status`, `data-client-simulation-context` e `data-client-commercial-stage`.
- Atividade recente e Trilha ativa no dashboard preservam `journeyId`, `calculatorSlug`, `historyId` e `handoffId` quando existem.
- Criado `tools/validate-dashboard-continuity-flow.mjs`.
- `assets/js/admin-users.js` passou a renderizar `data-admin-source-funnel` com origem, volume, aging, prioridade, SLA, responsavel sugerido e proxima acao.
- `assets/js/admin-users.js` passou a renderizar `data-admin-bottleneck-board` para proposta revisada sem handoff, trilha sem comparador, handoff sem responsavel e SLA vencido.
- `assets/js/admin-users.js` passou a renderizar `data-admin-next-actions` com uma lista curta de decisoes recomendadas para o admin.
- `assets/js/admin-users.js` passou a renderizar `data-admin-action-queue`, convertendo gargalos e sinais por origem em fila guiada com dono, prazo, alvo e CTA.
- `assets/js/admin-users.js` passou a renderizar `data-admin-action-execution` e `data-admin-action-owner-history`, com status, motivo, adiamento/conclusao e resumo por responsavel.
- `assets/js/admin-users.js` passou a renderizar `data-admin-consultant-productivity`, com abertas, adiadas, concluidas, tempo medio e gargalos recorrentes por responsavel.
- `assets/js/admin-users.js` passou a renderizar `data-admin-consultant-portfolio`, com carteira por consultor, leads abertos, aging medio, origem, prioridade, SLA e proximo foco por lead.
- `assets/js/admin-users.js` passou a renderizar filtros e plano comercial em `data-admin-consultant-portfolio-filters` e `data-admin-consultant-portfolio-priority`, alem da exportacao sanitizada `bank-fratern.admin-consultant-portfolio.v1`.
- `assets/js/admin-users.js` passou a renderizar `data-admin-commercial-pipeline`, com contato, proposta, follow-up, negociacao e fechamento por lead.
- `assets/js/admin-users.js` passou a permitir mover leads em `data-admin-commercial-stage-select`, persistindo `bf_admin_commercial_stage_states_v1`, `bf_admin_commercial_stage_audit_v1` e refletindo status no handoff.
- `assets/js/admin-users.js` passou a renderizar `data-admin-commercial-stage-insights`, com resumo por etapa, movimentacoes recentes e leads parados.
- `assets/js/admin-users.js` passou a exportar `bank-fratern.admin-commercial-pipeline.v1` por `data-admin-commercial-pipeline-export`, com referencias anonimas, totais por etapa, leads parados e movimentacoes recentes.
- `tools/run-v8af-browser-evidence.mjs` comprova a criacao de lead por proposta, movimentacao para Follow-up, status `aguardando_cliente`, historico local e cadencia comercial.
- `pages/dashboard-admin.html` ganhou atalhos diretos para Proximos passos, Carteira, Origens e Gargalos.
- Criado `tools/validate-admin-dashboard-source-funnel.mjs`.
- `pages/handoff-consultivo.html` ganhou `data-handoff-consultant-cockpit`, trazendo a mesma linguagem operacional de aging, SLA e proximo passo para o consultor.

Entregas para Dashboard Cliente:

- Mostrar linha do tempo unica com calculadora, trilha, comparador, simulador, proposta e handoff. Concluido em 2026-05-07.
- Exibir proximo passo recomendado com base no ultimo evento relevante. Concluido em 2026-05-11 com cockpit de retomada.
- Mostrar status do handoff vinculado quando existir. Concluido em 2026-05-11 com status, origem, aging e etapa comercial.
- Mostrar alertas de retomada de forma compreensivel e nao alarmista.

Entregas para Dashboard Admin:

- Consolidar funil por origem: calculadora, produto, trilha, comparador, simulador, proposta e pacote. Concluido em 2026-05-08 no Dashboard Admin.
- Mostrar aging, SLA, prioridade e responsavel sugerido. Concluido em 2026-05-08 no funil por origem, nos gargalos e no cockpit do consultor.
- Destacar gargalos: proposta revisada sem handoff, trilha sem comparador, handoff sem responsavel, SLA vencido. Concluido em 2026-05-08.
- Exibir proximas acoes recomendadas sem obrigar o admin a abrir todas as filas. Concluido em 2026-05-08.
- Exibir fila guiada com dono, prazo, alvo e CTA direto para revisar proposta, atribuir consultor, abrir handoff ou roteamento. Concluido em 2026-05-11.
- Tornar a fila guiada executavel com status, motivo, adiamento, conclusao e reabertura. Concluido em 2026-05-11.
- Medir produtividade por consultor a partir da fila guiada e do historico local. Concluido em 2026-05-11.
- Consolidar carteira por consultor com leads/sinais, aging, origem, prioridade, SLA e proximo passo. Concluido em 2026-05-11.
- Preservar filtros e exportacao sanitizada da carteira do dia. Concluido em 2026-05-11.
- Mostrar funil comercial por etapa do lead, separando contato, proposta, follow-up, negociacao e fechamento. Concluido em 2026-05-11.
- Permitir que o admin mova o lead entre etapas comerciais, com historico local e status refletido no handoff. Concluido em 2026-05-11.
- Mostrar cadencia comercial por etapa, movimentacoes recentes e retomadas sugeridas para leads parados. Concluido em 2026-05-11.
- Exportar funil/cadencia de forma sanitizada para reuniao diaria comercial. Concluido em 2026-05-11 com `bank-fratern.admin-commercial-pipeline.v1`.

Arquivos provaveis:

- `pages/dashboard-cliente.html`
- `assets/js/client-dashboard.js`
- `pages/dashboard-admin.html`
- `assets/js/admin-users.js`
- `assets/js/services/admin-recovery.service.js`
- `assets/js/services/journey-recovery.service.js`

Criterios de aceite:

- Cliente entende onde parou e qual acao seguir.
- Admin entende volume, origem, prioridade e responsavel.
- Admin tem uma fila acionavel com quem faz o que, ate quando, qual alvo e qual CTA abrir.
- Admin consegue marcar acao como em execucao, adiada, concluida ou reaberta e ver historico por responsavel.
- Admin enxerga produtividade por responsavel, tempo medio e gargalos recorrentes.
- Admin consegue mover um lead entre contato, proposta, follow-up, negociacao e fechamento sem perder compatibilidade com o handoff.
- Admin enxerga quais leads ficaram parados alem do prazo da etapa e quais etapas receberam movimentacao recente.
- Admin consegue exportar funil/cadencia com schema publico, leads anonimizados e zero e-mail, telefone ou CPF.
- Consultor consegue agir sem abrir multiplas paginas para descobrir contexto.
- Pacotes exportados seguem sem senha, telefone, CPF ou dados bloqueados.

Testes recomendados:

- `node tools/validate-recovery-signals-flow.mjs`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-dashboard-continuity-flow.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-admin-recovery-filters-export.mjs`
- `node tools/validate-admin-recovery-package-sla-filters.mjs`
- `node tools/validate-admin-recovery-routing-goals.mjs`
- Teste visual em desktop e mobile para dashboard cliente/admin.

## Fase 5 - Governanca de Produto e Entrega

Objetivo: garantir que cada nova evolucao seja verificavel, documentada e reversivel.

Status em 2026-05-11:

- Criada `pages/lousa-navegacao.html` como quadro navegavel do produto, jornada e proximos ciclos.
- `server.js` passou a expor alias curto para `lousa-navegacao.html`.
- Mapa completo atualizado para 52 paginas e 52 aliases curtos.
- Governanca de proposta ganhou `tools/validate-proposal-builder.mjs` e registro no changelog v8.41.0.
- Governanca do Dashboard Admin ganhou `tools/validate-admin-dashboard-source-funnel.mjs` e registro no changelog v8.42.0.
- Refinamento do cockpit admin ganhou registro no changelog v8.43.0.
- Criado `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` como matriz viva de `localStorage`, `data-*`, deep links, `window.BF*`, validadores e Definition of Done.
- Criado `tools/validate-public-contracts.mjs`.
- Governanca de contratos publicos ganhou registro no changelog v8.44.0.
- Governanca documental modernizada: `docs/README.md` virou porta atual do Bancus Fraternis, docs historicos receberam banner de legado controlado e referencias ativas de 17 calculadoras foram atualizadas para 19.
- Criado `tools/validate-docs-modernization.mjs` com relatorio em `docs/test-reports/docs-modernization-report.json`.
- `pages/lousa-navegacao.html` agora aponta contratos/docs e consultor com aging como estabilizados, preparando o proximo ciclo de teste navegavel ponta a ponta.
- `pages/lousa-navegacao.html` ganhou o roteiro de teste navegavel com 10 etapas, criterios de aceite e links profundos para cada superficie critica.
- `pages/lousa-navegacao.html` ganhou `data-lousa-commercial-qa` e checkpoints para cockpit cliente, cadencia consultiva, funil comercial, exportacao sanitizada e publicacao online.
- `pages/dashboard-admin.html` passou a apontar para o roteiro da lousa no rail executivo e na stagebar administrativa.
- Criado `tools/validate-navigable-journey.mjs` com relatorio em `docs/test-reports/navigable-journey-report.json`.
- Governanca do funil comercial ganhou registros v8.62.0, v8.63.0 e v8.64.0 no changelog, com contratos e evidencias atualizados.

Entregas:

- Padronizar checklist de entrega por fase: docs, validadores, prints/evidencias quando houver UI, changelog e checkpoint.
- Atualizar docs antigas que ainda citam 17 calculadoras ou ConsorcioPro como produto principal. Concluido em 2026-05-08 com README ativo, banners de documento historico e validador dedicado.
- Criar tabela de contratos publicos: `localStorage`, `data-*`, deep links e `window.BF*`. Concluido em 2026-05-08 em `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`.
- Criar politica de compatibilidade para dados locais: nunca quebrar leitura de chaves existentes sem migracao explicita. Concluido em 2026-05-08 no documento de contratos.
- Criar um "definition of done" para evolucoes de jornada. Concluido em 2026-05-08 no documento de contratos.
- Manter a lousa de navegacao como ponto de entrada para revisao do produto e preparo dos proximos ciclos.
- Criar roteiro navegavel ponta a ponta para QA de jornada antes de cada nova fase funcional. Concluido em 2026-05-08.

Arquivos provaveis:

- `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md`
- `docs/CHANGELOG.md`
- `docs/CODEX_TEST_PROTOCOL.md`
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md`
- `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`
- `tools/validate-*.mjs`

Criterios de aceite:

- Toda fase nova tem teste ou validador associado.
- Docs principais usam Bancus Fraternis como plataforma atual.
- Catalogo de calculadoras e docs concordam em 19 calculadoras.
- Contratos publicos ficam documentados antes de mudancas funcionais.
- Roteiro navegavel da lousa cobre Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards.
- QA comercial da lousa cobre cliente, consultor, funil, cadencia, exportacao sanitizada e publicacao online.
- Simulador passou a expor `BFSimulatorJourney`, `BFSimulatorState`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFSimulatorResult`, `BFProposalBuilder` e `BFProposalGovernance`, reduzindo responsabilidades do `js/app.js` em contexto, prefill, proximas acoes, snapshots, payload salvo, prateleira, carrinho/projeto, calculo/resultado, lousa da proposta/PDF, versionamento visual, aceite e ponte de handoff.

Testes recomendados:

- `node tools/validate-design-system.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-navigable-journey.mjs`
- `node tools/validate-simulator-refactor.mjs`
- `node tools/validate-simulator-shelf.mjs`
- `node tools/validate-simulator-cart.mjs`
- `node tools/validate-docs-modernization.mjs`
- `node tools/validate-calculadoras.mjs`
- Inspecao textual de docs para referencias antigas inconsistentes.

## Backlog Acionavel Inicial

| Prioridade | Item | Motivo |
| --- | --- | --- |
| Concluido | Corrigir aliases curtos ausentes em `server.js`. | Resolvido em 2026-05-07 com validador dedicado. |
| Concluido | Destacar origem do handoff no painel consultivo. | Resolvido em 2026-05-07 com filtro, badge e validador. |
| Concluido | Garantir carga completa de grupos no simulador. | 17.396 grupos validos preservados; 22 registros brutos sem valor de carta ficam fora por nao serem simulaveis. |
| Concluido | Atualizar docs que citam 17 calculadoras. | Resolvido em 2026-05-08 com catalogo atual de 19 e validador documental. |
| Concluido | Consultor com aging e prioridade no handoff. | Resolvido em 2026-05-08 com cockpit, filtros por responsavel/aging, SLA e validador dedicado. |
| Concluido | Criar teste navegavel ponta a ponta da jornada. | Resolvido em 2026-05-08 com roteiro na lousa, link no Admin e `tools/validate-navigable-journey.mjs`. |
| Concluido | Publicar projeto no GitHub Pages. | Resolvido com repo `bancus-fraternis`, CI ativo, Pages online e `tools/validate-github-pages-deploy.mjs`. |
| Concluido | Criar funil comercial por etapa no Admin. | Resolvido em 2026-05-11 com cinco etapas, links para handoff e evidencia browser. |
| Concluido | Permitir movimentacao manual do lead no funil. | Resolvido em 2026-05-11 com `data-admin-commercial-stage-select`, historico local e reflexo no status do handoff. |
| Concluido | Criar cadencia comercial por etapa. | Resolvido em 2026-05-11 com `data-admin-commercial-stage-insights`, movimentacoes recentes e leads parados. |
| Concluido | Trazer etapa comercial para o cockpit do consultor. | Resolvido em 2026-05-11 com `data-handoff-commercial-stage`, painel de cadencia e leitura do historico do Admin. |
| Concluido | Melhorar Dashboard Cliente como cockpit de retomada. | Resolvido em 2026-05-11 com `data-client-continuity-cockpit`, proxima acao, proposta, simulacao e etapa comercial. |
| Concluido parcial | Revisar CTAs Home/Produtos/Calculadoras/Trilha -> jornada. | Home retoma trilha ativa; Produtos e Calculadoras preservam contexto; Trilha reconhece origem e propaga `sourceFrom`. |
| Concluido parcial | Evoluir dashboards por funil, origem e aging. | Dashboard Cliente ja tem timeline por etapa, contexto e aging; Admin consolida proximas acoes, fila guiada, produtividade, carteira, funil comercial movel, cadencia e exportacao sanitizada. |
| Concluido | Exportar funil/cadencia de forma sanitizada. | Resolvido em 2026-05-11 com `bank-fratern.admin-commercial-pipeline.v1`, leads anonimizados e teste browser contra e-mail, CPF e telefone. |
| Concluido | Atualizar lousa de QA comercial. | Resolvido em 2026-05-11 com `data-lousa-commercial-qa`, seis checkpoints visuais e validador atualizado. |
| Concluido parcial | Modularizar o simulador. | Cortes entregues com `BFSimulatorJourney`, `BFSimulatorState`, `BFSimulatorShelf`, `BFSimulatorCart`, `BFSimulatorResult`, `BFProposalBuilder`, `BFProposalGovernance`, acoes de jornada, prateleira, carrinho/projeto, resultado e validadores dedicados. |
| Concluido parcial | Criar banco local para usuarios, senhas e eventos. | Resolvido em 2026-05-12 com SQLite local, API `/api/*`, `BFBackendApi`, hash `scrypt-sha256` e validador dedicado. |
| Concluido parcial | Expor eventos do banco local no Admin. | Resolvido em 2026-05-12 com painel `data-admin-backend-events`, refresh, metricas do SQLite e leitura de `/api/events`. |
| Concluido parcial | Diagnosticar ambiente SQL local. | Resolvido em 2026-05-12 com `/api/database/status`, tabelas SQLite no Admin e `tools/inspect-local-sql-environment.mjs`. |
| Concluido parcial | Migrar dados locais para SQLite. | Resolvido em 2026-05-12 com preview/execucao em `data-admin-local-import-panel`, endpoint `/api/database/import-local`, deduplicacao por e-mail/id/evento e snapshots atualizaveis. |
| Concluido parcial | Criar snapshots server-side de jornada. | Resolvido em 2026-05-12 com tabela `snapshots`, `/api/snapshots`, `BFBackendApi.recordSnapshot/listSnapshots` e coleta Admin de simulacao, proposta, trilha, perfil, modelos e handoff. |
| Concluido parcial | Conectar salvamentos reais ao banco local. | Resolvido em 2026-05-12 com hooks best-effort de `recordSnapshot` em simulacao, proposta, lousa, perfil, trilha e handoff. |
| Concluido parcial | Ler snapshots server-side nos dashboards. | Resolvido em 2026-05-13 com `GET /api/snapshots` escopado por sessao, Dashboard Cliente preferindo SQLite e Admin listando snapshots recentes. |
| Concluido parcial | Criar camada relacional sobre snapshots. | Resolvido em 2026-05-13 com `journey_entities`, `GET /api/journey-entities`, resumo Admin e badge Cliente. |
| Concluido parcial | Materializar tabelas dedicadas de jornada. | Resolvido em 2026-05-13 com `journey_leads`, `journey_simulations`, `journey_proposals` e endpoints dedicados. |
| Concluido parcial | Governar backend/API produtivo futuro. | Resolvido em 2026-05-16 com `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`, matriz de dominios, DoD produtivo e `tools/validate-backend-production-plan.mjs`. |
| Concluido | Criar validador de aliases/rotas. | `tools/validate-route-aliases.mjs`. |
| P3 | Continuar reduzindo responsabilidades de `js/app.js` e `assets/js/bf-platform.js`. | Proximo corte recomendado: integracoes finais de exportacao/retomada do simulador ou modularizacao progressiva de `assets/js/bf-platform.js`. |
| Concluido parcial | Preparar provider produtivo de banco. | `BANCUS_DB_PROVIDER` criado sem quebrar SQLite local nem `BFBackendApi`; proximo passo e adapter piloto para Postgres ou servico gerenciado equivalente. |
| P0 | Criar schema e migrations versionadas. | Fase 8AN / P3.3A: criar manifest e migrations antes de ativar qualquer provider hospedado. |
| P0 | Criar adapter produtivo piloto. | Fase 8AO / P3.3B: implementar provider real hospedado em ambiente de homologacao, mantendo SQLite como fallback e sem mudar contratos `/api/*`. |
| P1 | Preparar autenticacao, migracao, observabilidade e corte controlado. | Seguir `docs/PROXIMAS_FASES_BANK_FRATERN.md` para tirar credenciais demonstrativas da operacao real, migrar dados com reconciliacao, testar backup/restore e ativar por ambiente. |

## Contratos que Devem Ser Preservados

- Chaves `localStorage` documentadas no mapa completo.
- Exports globais `window.BF*`, `Settings`, `BFAuth`, `BFHome`, `BFDecisionContext` e services relacionados.
- Marcadores `data-*` usados pelos validadores.
- Deep links existentes para simulador, comparador, calculadoras e trilha.
- Deep links de Produtos devem preservar `from=products`, `productId`, `preset` e `products` quando houver selecao.
- Deep links de Calculadoras devem preservar `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`.
- Deep links da Trilha devem sair com `from=journey` e preservar origem anterior em `sourceFrom`.
- Deep links do Dashboard Cliente devem sair com `from=dashboard` e preservar `journeyId`, `calculatorSlug`, `historyId` e `handoffId` quando existirem.
- Carga real da prateleira: 17.418 registros brutos, 17.396 grupos validos e 22 registros sem `valorCartaRef` em `data_base/Tab_Grupos_Consorcio.json`.
- Estrutura de proposta/aceite/handoff ja validada nos scripts v8AD, v8AE e v8AF.
- Matriz publica: `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`.
- Banco local progressivo: `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md`, `BFBackendApi`, `bf_backend_session_v1`, `/api/database/status`, `/api/auth/*`, `/api/users`, `/api/events`, `/api/snapshots`, `/api/journey-entities`, `/api/leads`, `/api/simulations`, `/api/proposals`, `data-client-backend-snapshots`, `data-client-backend-entities`, `data-client-backend-materialized`, `data-admin-backend-snapshots`, `data-admin-backend-entities` e `data-admin-backend-materialized`.

## Fora de Escopo da Fase Documental Original

- Migracao funcional para backend/API produtiva hospedada sem antes executar `docs/PROXIMAS_FASES_BANK_FRATERN.md`.
- Banco produtivo de leads ou simulacoes sem schema/migrations, adapter validado e rollback.
- Integracao Open Finance.
- Refatoracao estrutural completa dos controladores grandes.
- Mudancas nas formulas financeiras sem demanda especifica.

## Ordem Recomendada de Implementacao

1. Fase 1: rotas, matriz de paginas e saneamento navegavel. Concluida.
2. Fase 3: handoff por origem e operacao do consultor. Concluida parcialmente, com cockpit de aging/prioridade e plano executavel entregue.
3. Fase 4: dashboards e funil. Admin avancou para fila guiada, produtividade, carteira, funil comercial movel, cadencia e exportacao sanitizada; essa leitura ja chegou ao consultor e ao Dashboard Cliente.
4. Fase 2: continuidade da jornada. Em andamento; Home, Produtos, Calculadoras, Trilha contextual, cockpit do Dashboard Cliente, lousa de QA visual e primeiras acoes contextuais do simulador foram implementados.
5. Fase 5: governanca permanente e reducao de divida documental. Em andamento; contratos publicos, changelog, evidencias browser, CI/Pages e roteiro de teste navegavel estao ativos.
6. Fase local de banco/API: iniciada para usuarios, sessoes, eventos e snapshots, ainda com fallback estatico obrigatorio.
7. Proximo ciclo backend produtivo: executar Fase 8AN / P3.3A, criando schema e migrations versionadas antes de provider hospedado.
8. Depois do schema: executar Fase 8AO / P3.3B, criando adapter `postgresql` piloto em homologacao.
9. Fases seguintes: autenticacao produtiva, migracao assistida, observabilidade/backup, corte controlado e UX com dados vivos conforme `docs/PROXIMAS_FASES_BANK_FRATERN.md`.

Essa ordem reduz risco: primeiro tira friccao de acesso, depois melhora operacao comercial, depois aprofunda experiencia e governanca.

## Criterios Gerais de Aceite do Plano

- O mapa completo permite entender o projeto sem abrir codigo.
- Este plano permite iniciar a proxima implementacao sem decidir prioridade.
- Produto e jornada aparecem como foco, com API local tratada como infraestrutura de apoio e backend produtivo como evolucao futura.
- Lacunas reais aparecem como backlog acionavel.
- Validadores recomendados estao associados a cada fase.
