# Plano de Acao de Evolucao Bancus Fraternis

Atualizado em 2026-05-08.

Prioridade definida: produto e jornada.

Entrega deste documento: transformar o mapa completo do projeto em um roteiro implementavel para evoluir a experiencia Bancus Fraternis sem iniciar ainda a migracao para backend/API.

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

| Frente | Status em 2026-05-08 | Evidencia |
| --- | --- | --- |
| Mapa completo e plano separado | Concluido | `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` e este plano. |
| Rotas curtas das 51 paginas | Concluido | `tools/validate-route-aliases.mjs`. |
| Base real do simulador | Concluido | 17.418 registros brutos, 17.396 grupos validos e `tools/validate-simulator-groups.mjs`. |
| Home com continuidade local | Concluido parcial | Hero e cockpit retomam trilha ativa, historico, simulacao e proximo passo. |
| Produtos com contexto preservado | Concluido parcial | CTAs usam `from=products`, `productId`, `preset` e selecao em `products`. |
| Calculadoras com contexto preservado | Concluido | CTAs usam `BFCalculatorJourney`, `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`. |
| Trilha Assistida contextual | Concluido parcial | Entrada reconhece Produtos/Calculadoras e saidas usam `from=journey` com `sourceFrom`. |
| Proposta/PDF com lousa seletiva | Concluido | Etapa 9 usa `proposal-builder-board`, presets consultivo/tecnico, prontidao de exportacao, selecao por grupos, `builder` em `ProposalSummary` e `tools/validate-proposal-builder.mjs`. |
| Versionamento de propostas | Concluido | Etapa 9 usa `data-proposal-version-panel`, `BFProposalVersions`, historico por proposta, comparacao entre versoes e travamento da versao antes do handoff. |
| Handoff por origem | Concluido parcial | Filtro, badge, metricas, origem, aging, SLA, responsavel sugerido, plano de acao executavel por lead e leitura de proposta versionada/vencida. |
| Dashboards por funil/aging | Concluido parcial | Dashboard Cliente tem timeline/deep links; Dashboard Admin agora tem proximas acoes, fila guiada executavel com dono/prazo/alvo/status/motivo, produtividade e carteira por consultor, funil por origem, aging, prioridade, responsavel sugerido, gargalos e alertas de proposta alterada apos handoff. |
| Navegacao autenticada | Concluido parcial | Login local tem acesso rapido por perfil, redirect preservado e validador dedicado. |
| Teste navegavel ponta a ponta | Concluido | `pages/lousa-navegacao.html` ganhou roteiro de Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards com `tools/validate-navigable-journey.mjs`. |
| Publicacao segura em GitHub Pages | Concluido parcial | Selo demo/local, fallback `404.html`, CI em `.github/workflows/validate.yml` e `tools/validate-public-release-safety.mjs`. |
| QA online da jornada publicada | Concluido | `tools/validate-online-journey-smoke.mjs` valida no GitHub Pages as 10 etapas da lousa, anchors, marcadores e fallback estatico; `docs/test-reports/online-journey-browser-report.json` registra a checagem renderizada. |
| Performance do simulador online | Concluido parcial | Simulador passou a carregar `Tab_Grupos_Consorcio.compact.json` primeiro, preservando fallback para o JSON canonico e todos os 17.396 grupos validos. |
| Governanca permanente | Em andamento | Changelog, mapa, plano, validadores, contratos publicos e lousa navegavel atualizados por entrega. |

## Fase 1 - Saneamento da Jornada Navegavel

Objetivo: garantir que todas as paginas ativas estejam acessiveis, classificadas e coerentes antes de evoluir fluxos comerciais.

Status em 2026-05-08:

- Aliases curtos das 7 paginas pendentes foram adicionados ao `server.js`.
- Criado `tools/validate-route-aliases.mjs` para impedir regressao.
- Mapa completo atualizado para registrar 51 paginas e 51 aliases curtos.

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

- As 51 paginas continuam acessiveis por `/pages/<arquivo>.html`.
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

Status em 2026-05-08:

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

Status em 2026-05-08:

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
- Admin destaca proposta vencida, proposta versionada sem handoff e proposta alterada apos handoff como gargalos acionaveis.
- Handoff de trilha mostra objetivo, produto, modelo e proxima acao.
- Handoff de retomada mostra etapa abandonada, severidade e aging.
- Consultor consegue filtrar e priorizar por origem.
- Admin enxerga funil por origem sem expor dados sensiveis proibidos.

Testes recomendados:

- `node tools/validate-proposal-acceptance.mjs`
- `node tools/validate-proposal-builder.mjs`
- `node tools/validate-proposal-versioning.mjs`
- `node tools/validate-proposal-handoff.mjs`
- `node tools/validate-handoff-origins.mjs`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-recovery-signals-flow.mjs`
- `node tools/validate-admin-recovery-queue.mjs`
- Teste visual desktop/mobile do painel consultivo.

## Fase 4 - Dashboards com Funil e Proximos Passos

Objetivo: transformar dashboard cliente e admin em centros de continuidade mais claros.

Status em 2026-05-08:

- `assets/js/client-dashboard.js` passou a gerar deep links de retomada com `from=dashboard`.
- Linha do tempo do cliente passou a exibir Diagnostico, Calculadora, Trilha, Comparador, Simulacao, Proposta e Handoff.
- Card de Handoff do cockpit do cliente passou a mostrar origem e aging.
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
- `pages/dashboard-admin.html` ganhou atalhos diretos para Proximos passos, Carteira, Origens e Gargalos.
- Criado `tools/validate-admin-dashboard-source-funnel.mjs`.
- `pages/handoff-consultivo.html` ganhou `data-handoff-consultant-cockpit`, trazendo a mesma linguagem operacional de aging, SLA e proximo passo para o consultor.

Entregas para Dashboard Cliente:

- Mostrar linha do tempo unica com calculadora, trilha, comparador, simulador, proposta e handoff. Concluido em 2026-05-07.
- Exibir proximo passo recomendado com base no ultimo evento relevante. Em andamento; cockpit, retomadas e trilha ativa ja participam.
- Mostrar status do handoff vinculado quando existir. Concluido parcialmente com status, origem e aging no cockpit.
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

Status em 2026-05-08:

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
- `pages/dashboard-admin.html` passou a apontar para o roteiro da lousa no rail executivo e na stagebar administrativa.
- Criado `tools/validate-navigable-journey.mjs` com relatorio em `docs/test-reports/navigable-journey-report.json`.

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

Testes recomendados:

- `node tools/validate-design-system.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-navigable-journey.mjs`
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
| Concluido parcial | Revisar CTAs Home/Produtos/Calculadoras/Trilha -> jornada. | Home retoma trilha ativa; Produtos e Calculadoras preservam contexto; Trilha reconhece origem e propaga `sourceFrom`. |
| Concluido parcial | Evoluir dashboards por funil, origem e aging. | Dashboard Cliente ja tem timeline por etapa, contexto e aging; Admin agora consolida proximas acoes, origem, SLA, prioridade, responsavel sugerido e gargalos. |
| Concluido | Criar validador de aliases/rotas. | `tools/validate-route-aliases.mjs`. |
| Baixa | Reduzir responsabilidades de `js/app.js` e `assets/js/bf-platform.js`. | Reduz risco em evolucoes futuras. |

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

## Fora de Escopo deste Plano

- Migracao para backend/API produtiva.
- Banco de dados real de usuarios, leads ou simulacoes.
- Integracao Open Finance.
- Refatoracao estrutural completa dos controladores grandes.
- Mudancas nas formulas financeiras sem demanda especifica.

## Ordem Recomendada de Implementacao

1. Fase 1: rotas, matriz de paginas e saneamento navegavel. Concluida.
2. Fase 3: handoff por origem e operacao do consultor. Concluida parcialmente, com cockpit de aging/prioridade entregue.
3. Fase 2: continuidade da jornada, conectando melhor as entradas. Em andamento; Home, Produtos, Calculadoras e Trilha contextual foram implementados.
4. Fase 4: dashboards e funil. Dashboard Cliente, Admin e cockpit do consultor por origem/aging/proximas acoes concluidos parcialmente; roteiro navegavel ponta a ponta concluido para QA da jornada.
5. Fase 5: governanca permanente e reducao de divida documental. Em andamento; contratos publicos, saneamento documental e roteiro de teste navegavel concluidos nesta fatia.

Essa ordem reduz risco: primeiro tira friccao de acesso, depois melhora operacao comercial, depois aprofunda experiencia e governanca.

## Criterios Gerais de Aceite do Plano

- O mapa completo permite entender o projeto sem abrir codigo.
- Este plano permite iniciar a proxima implementacao sem decidir prioridade.
- Produto e jornada aparecem como foco, com backend/API apenas como evolucao futura.
- Lacunas reais aparecem como backlog acionavel.
- Validadores recomendados estao associados a cada fase.
