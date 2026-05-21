# Plano de Implementacao Evolutivo - Bancus Fraternis

Atualizado em 2026-05-21.

## Estado Atual

O portal entrou em um ciclo de paginas vivas. A home, a carteira e o monitor de assembleias ja carregam dados reais ou persistidos no navegador, preservando fallback demonstrativo quando ainda nao existe base transacional completa. A versao v8 inicia a unificacao visual do Bancus Fraternis para manter a mesma linguagem em paginas institucionais, calculadoras, simuladores, comparador, dashboards, governanca e handoff.

### Fase 8AN planejada neste ciclo - Proximas fases produtivas

- Criado `docs/PROXIMAS_FASES_BANK_FRATERN.md` como roadmap executavel das proximas entregas.
- A ordem recomendada agora prioriza schema e migrations versionadas antes de qualquer adapter hospedado.
- As fases seguintes ficaram separadas em adapter `postgresql` piloto, autenticacao produtiva, migracao assistida, observabilidade/backup, corte controlado e UX com dados vivos.
- Criado `tools/validate-next-phases-plan.mjs` para proteger a consistencia entre roadmap, plano produtivo, mapa, plano de acao, README, contratos e changelog.
- Proximo incremento recomendado: implementar a Fase 8AN / P3.3A, criando migrations idempotentes e manifest de schema para todas as tabelas atuais.

### Fase 8AM executada neste ciclo - Provider de banco configuravel

- `js/backend/db.js` passou a normalizar `BANCUS_DB_PROVIDER`, mantendo `sqlite` como provider padrao.
- Aliases locais `local`, `dev`, `development` e `node:sqlite` apontam para SQLite.
- Providers futuros sem adapter implementado, como `postgresql`, falham com mensagem explicita e nao criam banco acidental.
- `/api/health` passou a informar o provider ativo quando a API local possui banco.
- `tools/validate-local-database.mjs` e `tools/validate-backend-production-plan.mjs` passaram a proteger a camada de provider.
- Proximo incremento recomendado: criar adapter produtivo piloto, provavelmente Postgres ou servico gerenciado equivalente, sem mudar `BFBackendApi` nem endpoints `/api/*`.

### Fase 8AL executada neste ciclo - Backend produtivo governado

- Criado `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md` para definir a migracao do SQLite local para backend hospedado sem quebrar `localStorage`, `BFBackendApi`, deep links ou publicacao estatica.
- O plano separa dominios produtivos: usuarios, sessoes, eventos, snapshots, entidades de jornada, leads, simulacoes e propostas.
- O Definition of Done produtivo passou a exigir LGPD, backup, observabilidade, escopo por `owner_email`, sanitizacao e rollback antes de troca de provider.
- Criado `tools/validate-backend-production-plan.mjs` para proteger a matriz de migracao e conectar contratos, mapa, plano, README, protocolo e changelog.
- Proximo incremento recomendado: preparar uma camada de provider `BANCUS_DB_PROVIDER`, mantendo SQLite local como fallback de desenvolvimento.

### Fase 8AK executada neste ciclo - Produtos com contexto preservado

- `assets/js/bf-platform.js` passou a gerar deep links contextuais por produto com `from=products`, `productId`, `preset`, `products`, `objective` e `urgency` quando existirem.
- Criado export publico `BFProductsJourney` para construir rotas de Produtos para simulador, comparador, calculadora e trilha.
- `assets/js/components/cards.js` passou a aceitar `simuladorHref`, `comparadorHref`, `calculadoraHref` e `trilhaHref`.
- `pages/produtos.html` ganhou atalhos de simuladores ja marcados com origem, produto e preset.
- `tools/validate-product-journey-flow.mjs` passou a validar rotas contextuais, selecao manual no comparador e renderizacao dos CTAs nos cards.
- Evidencia atualizada em `docs/test-reports/v8t-product-journey-flow-report.json`.
- Proximo incremento recomendado: fechar a mesma preservacao de contexto no hub de Calculadoras e na Trilha Assistida.

### Fase 8AJ executada neste ciclo - Garantia da base completa no simulador

- Criado `tools/validate-simulator-groups.mjs`.
- A base `data_base/Tab_Grupos_Consorcio.json` foi conferida com 17.418 registros brutos.
- `js/shelf-data.js` carrega 17.396 grupos validos pelo criterio minimo atual: carta maior que zero, prazo maior que zero e cotas ativas em dia maior ou igual a zero.
- Os 22 registros fora da prateleira falham apenas por `valorCartaRef<=0`, portanto nao sao simulaveis no motor atual.
- `js/shelf-engine.js` preserva os 17.396 grupos com filtro vazio, ordenacao por score e paginacao.
- A prateleira cobre 6 segmentos, 120 administradoras e 35 paginas quando validada com pagina de 500 grupos.
- Evidencia registrada em `docs/test-reports/simulator-groups-report.json`.
- Proximo incremento recomendado: qualquer nova regra de filtro default deve manter esse validador verde antes de avancar para novas fases.

### Fase 8AI executada neste ciclo - Home retoma trilha assistida ativa

- `pages/index.html` passou a carregar `assets/js/services/trilha-decisao.service.js` antes de `js/home.js`.
- `js/home.js` passou a ler `BFTrilhaDecisaoService.load()` e o fallback `bf_decision_journey_v1:anon`.
- Hero contextual da Home reconhece trilha ativa quando nao ha simulacao salva e direciona para o `nextAction.href` da trilha.
- Cockpit de continuidade ganhou metrica, card e acao prioritaria para trilha assistida ativa.
- `tools/validate-home-continuity-cockpit.mjs` passou a validar jornada ativa, deep link para comparador e ausencia de dados pessoais renderizados.
- `tools/validate-home-contextual-hero.mjs` passou a validar o estado `journey` antes da retomada por simulacao.
- Evidencia atualizada em `docs/test-reports/v8ab-home-continuity-cockpit-report.json`.
- Proximo incremento recomendado: revisar Produtos e Calculadoras para preservar ainda melhor o contexto ate trilha, comparador e simulador.

### Fase 8AH executada neste ciclo - Origem operacional dos handoffs

- `assets/js/services/handoff-consultivo.service.js` passou a classificar handoffs por origem: proposta revisada, trilha assistida, sinal de retomada, pacote importado ou origem local.
- `pages/handoff-consultivo.html` ganhou filtro de origem na fila local.
- `assets/js/handoff-consultivo.js` passou a renderizar badge e resumo da origem nos cards e no detalhe do handoff.
- `assets/js/admin-users.js` passou a mostrar metricas de propostas e trilhas no resumo administrativo de handoffs.
- `assets/css/platform.css` recebeu estilos para os estados de origem.
- Criado `tools/validate-handoff-origins.mjs`, com evidencia em `docs/test-reports/handoff-origins-report.json`.
- Proximo incremento recomendado: levar origem, aging e SLA para um funil administrativo consolidado por etapa.

### Fase 8AG executada neste ciclo - Saneamento de rotas curtas da jornada

- `server.js` passou a expor aliases curtos para `calculadora-capacidade-credito.html`, `calculadora-lance-consorcio.html`, `componentes-v8.html`, `handoff-consultivo.html`, `modelos-biblioteca.html`, `modelos-governanca.html` e `trilha-decisao.html`.
- Criado `tools/validate-route-aliases.mjs` para validar que toda pagina HTML em `pages/` tem alias curto correspondente.
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` foi atualizado para registrar 51 paginas, 51 aliases e o contrato de rotas.
- `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` passou a marcar a entrega inicial da Fase 1 como concluida.
- Proximo incremento recomendado: revisar CTAs e links principais da jornada agora que as rotas curtas estao cobertas.

### Fase 8AF executada neste ciclo - Proposta revisada para handoff consultivo

- `assets/js/services/handoff-consultivo.service.js` passou a criar e atualizar handoffs diretamente a partir de uma proposta revisada.
- O handoff preserva `sourceProposalId`, status, versao, validade, prioridade, resumo financeiro, notas e checklist herdado da revisao.
- `pages/simulador.html` carrega o servico de handoff consultivo na etapa de Proposta Comercial.
- `js/app.js` ganhou a ponte `data-proposal-handoff-bridge`, liberando o botao de handoff apenas quando a revisao esta completa.
- A acao `criarHandoffProposta()` cria lead local sem envio a terceiros e atualiza o lead existente quando a proposta muda.
- Auditoria local registra `proposal-create` e `proposal-refresh`.
- Criado `tools/validate-proposal-handoff.mjs` e conectado ao validador geral de design system.
- Evidencia de contrato gerada em `docs/test-reports/v8af-proposal-handoff-report.json`.
- Proximo incremento recomendado: destacar handoffs originados por proposta no painel consultivo e no Dashboard Admin, com filtro por origem e aging da proposta.

### Fase 8AE executada neste ciclo - Aceite local e versionamento da proposta

- Criado `js/proposal-acceptance.js` para registrar revisoes locais da proposta por `proposalId`.
- `pages/simulador.html` ganhou o painel `data-proposal-acceptance-panel` antes do preview da proposta.
- O painel registra responsavel, papel, validade, observacao e checklist de premissas, contexto do cliente e documentacao/handoff.
- `js/app.js` passou a expor `salvarRevisaoProposta()` e `limparRevisaoProposta()`.
- `js/proposal-summary.js` passou a renderizar a secao `ps-section--acceptance`, fazendo a governanca aparecer tambem no PDF exportado.
- `js/storage.js` preserva `proposalAcceptance` quando a simulacao e salva.
- Criado `tools/validate-proposal-acceptance.mjs` e conectado ao validador geral de design system.
- Evidencia de contrato gerada em `docs/test-reports/v8ae-proposal-acceptance-report.json`.
- Proximo incremento recomendado: conectar revisao aprovada da proposta ao handoff consultivo, criando lead pre-preenchido sem enviar dados para terceiros.

### Fase 8AD executada neste ciclo - Proposta comercial e PDF espelhado

- `pages/simulador.html` passou a apresentar a etapa de Proposta Comercial como preview fiel do PDF exportado.
- `js/app.js` agora renderiza a proposta com o mesmo renderer do resumo executivo, usando `#proposal-export-root` para exportacao e `#proposal-summary-print-root` como fallback.
- `js/proposal-summary.js` ganhou um bloco conversacional que separa decisao, caixa, lance e risco, conectando cada leitura aos graficos e proximos passos.
- `js/export.js` passou a gerar PDF por blocos `.ps-print-page`, evitando que informacoes e graficos relacionados sejam cortados em lugares incoerentes.
- `css/styles.css` recebeu a camada visual dos cards conversacionais, nota de exportacao e ajustes de print/PDF para proposta estruturada.
- O fluxo de impressao passou a aceitar a raiz ativa da proposta, preservando a mesma estrutura visual exibida ao usuario.
- Proximo incremento recomendado: criar assinatura/aceite digital local da proposta, com versao, data, premissas e trilha de revisao antes do handoff consultivo.

### Fase 8AC executada neste ciclo - Hero contextual da Home

- `pages/index.html` ganhou contrato `data-home-hero-contextual`, com badge, titulo, copy, CTAs, origem e painel lateral atualizaveis por contexto.
- `js/home.js` passou a expor `BFHome.renderContextualHero()` e `BFHome.buildHeroContext()`.
- A primeira dobra agora usa o mesmo modelo do cockpit para alternar entre diagnostico inicial, retomada de calculadora, simulacao com contexto e carteira.
- Quando o perfil esta pronto, o CTA principal preserva deep link `simulador.html?from=calculator&calculatorSlug=<slug>&historyId=<id>`.
- Quando existe simulacao salva, o CTA principal muda para carteira e o secundario abre revisao da simulacao.
- O painel lateral do hero mostra renda, parcela segura, reserva e prontidao sem renderizar CPF, telefone, e-mail ou WhatsApp.
- Criado `tools/validate-home-contextual-hero.mjs` para validar os estados diagnostic, ready e simulation.
- `tools/validate-design-system.mjs` passou a exigir o contrato do hero contextual e o validador funcional v8AC.
- Evidencia de contrato gerada em `docs/test-reports/v8ac-home-contextual-hero-report.json`.
- Proximo incremento recomendado: conectar a Home contextual aos eventos de microconversao para registrar cliques de retomada, simulacao e carteira no funil local.

### Fase 8AB executada neste ciclo - Home como cockpit de continuidade

- `pages/index.html` ganhou o painel `data-home-continuity-cockpit`, conectando prontidao, historico local, simulacoes salvas e proximas acoes.
- A Home passou a carregar `assets/js/services/decision-context.service.js`, reaproveitando perfil financeiro, recomendacoes e auditoria local ja usados por calculadoras e simulador.
- `js/home.js` ganhou `BFHome.renderContinuityCockpit()` e `BFHome.buildContinuityModel()` para transformar perfil, calculadoras e simulacoes em estado operacional da jornada.
- O cockpit mostra cards de diagnostico, ultima calculadora, ultima simulacao e acoes recomendadas sem expor CPF, telefone, e-mail ou dados pessoais.
- `css/home.css` recebeu a camada visual responsiva do cockpit, mantendo o contrato v8 da pagina inicial sem criar telas novas.
- Criado `tools/validate-home-continuity-cockpit.mjs` para validar renderizacao, prontidao, historico, simulacao salva, recomendacoes e sanitizacao de dados pessoais.
- `tools/validate-design-system.mjs` passou a exigir o novo contrato da Home e o validador funcional v8AB.
- Evidencia de contrato gerada em `docs/test-reports/v8ab-home-continuity-cockpit-report.json`.
- Proximo incremento recomendado: personalizar hero e CTAs da Home por estado de prontidao e origem da ultima jornada.

### Fase 8AA executada neste ciclo - Roteamento por carteira e metas

- `assets/js/services/admin-recovery.service.js` ganhou `routeImportedItems()` para distribuir itens importados pendentes entre consultores ativos.
- O mesmo servico ganhou `saveConversionGoal()`, `conversionGoals()` e `conversionScoreboard()` para acompanhar metas locais de handoff por responsavel.
- Itens importados passaram a preservar `routeName`, `routeStrategy`, `routedAt` e `conversionGoalId`.
- `assets/js/admin-users.js` ganhou o bloco `data-admin-package-routing`, botao de roteamento automatico, metas editaveis e placar de progresso por consultor.
- A auditoria administrativa passou a registrar roteamento por item, execucao de roteamento e metas salvas.
- Criado `tools/validate-admin-recovery-routing-goals.mjs` para validar roteamento rebalanceado, metas, handoff a partir de item roteado e progresso de conversao.
- `tools/validate-design-system.mjs` passou a exigir o painel de roteamento e o validador v8AA.
- Evidencia de contrato gerada em `docs/test-reports/v8aa-admin-recovery-routing-goals-report.json`.
- Proximo incremento recomendado: criar governanca de metas por ciclo, com congelamento semanal/mensal e leitura de produtividade por carteira.

### Fase 8Z executada neste ciclo - SLA e filtros dos itens importados

- `assets/js/services/admin-recovery.service.js` passou a calcular SLA local por prioridade para itens importados: alta 4h, media 24h e baixa 72h.
- `importedItems()` agora aceita filtros por status operacional, responsavel, prioridade, pacote, busca textual e estado de SLA.
- Criado `importedItemsSummary()` para consolidar pendentes, recebidos, atribuidos, handoffs, vencidos, proximos do vencimento e pacotes.
- `assets/js/admin-users.js` ganhou `data-admin-package-filters`, incluindo filtro de SLA, status, responsavel, prioridade e busca.
- Os cards de itens recebidos agora mostram idade/SLA e os indicadores do painel destacam itens vencidos.
- Criado `tools/validate-admin-recovery-package-sla-filters.mjs` para validar pacote antigo vencido, pacote recente no prazo, filtros, atribuicao e conclusao por handoff.
- `tools/validate-design-system.mjs` passou a exigir os filtros de SLA e o validador v8Z.
- Evidencia de contrato gerada em `docs/test-reports/v8z-admin-recovery-package-sla-filters-report.json`.
- Proximo incremento recomendado: criar roteamento por carteira/consultor e metas de conversao para os itens importados.

### Fase 8Y executada neste ciclo - Operacao dos itens importados

- `assets/js/services/admin-recovery.service.js` ganhou `importedItems()` para listar itens recebidos por pacotes com status operacional.
- O mesmo servico ganhou `assignImportedItem()` para atribuir responsavel e `createHandoffFromImportedItem()` para criar ou atualizar handoff consultivo a partir do item importado.
- `assets/js/admin-users.js` passou a exibir `data-admin-recovery-imported-items`, com seletor de responsavel, acao de atribuir e acao de criar handoff por item.
- A auditoria local passou a registrar atribuicao de item importado, handoff criado a partir de pacote e falhas de handoff.
- `tools/validate-admin-recovery-package-operations.mjs` valida importacao, atribuicao, handoff, reprocessamento sem duplicidade e ausencia de dados bloqueados.
- `tools/validate-design-system.mjs` passou a exigir o validador v8Y e os marcadores da operacao de itens importados.
- Evidencia de contrato gerada em `docs/test-reports/v8y-admin-recovery-package-operations-report.json`.
- Proximo incremento recomendado: adicionar SLA e filtros dedicados para itens importados, separando recebidos, atribuidos e convertidos em handoff.

### Fase 8X executada neste ciclo - Governanca de pacotes de recuperacao

- `assets/js/services/admin-recovery.service.js` passou a registrar auditoria para exportacao, importacao, duplicidade e rejeicao de pacotes.
- O mesmo servico ganhou `validatePackage()`, `importPackage()`, `importedPackages()` e `audit()` para controlar pacotes locais exportados da fila administrativa.
- `assets/js/admin-users.js` passou a renderizar `data-admin-recovery-packages` com resumo de pacotes, formulario de importacao JSON, pacotes recebidos e trilha de auditoria.
- `pages/dashboard-admin.html` recebeu a secao de governanca de pacotes logo apos a fila de recuperacao.
- Criado `tools/validate-admin-recovery-package-governance.mjs` para validar exportacao, importacao aceita, duplicidade, schema invalido e bloqueio de dados sensiveis.
- `tools/validate-design-system.mjs` passou a exigir o painel de pacotes e o novo validador de governanca.
- Evidencia de contrato gerada em `docs/test-reports/v8x-admin-recovery-package-governance-report.json`.
- Proximo incremento recomendado: transformar os pacotes importados em insumos operacionais para distribuicao, atribuicao manual e conversao direta em handoffs.

### Fase 8W executada neste ciclo - Filtros e exportacao da recuperacao

- `assets/js/services/admin-recovery.service.js` ganhou filtros por responsavel sugerido, status da fila, severidade, etapa e busca textual.
- O mesmo servico passou a expor `exportPackage()`, gerando JSON local com schema, filtros, resumo e itens sanitizados.
- `assets/js/admin-users.js` passou a renderizar controles em `data-admin-recovery-filters` e botao `data-admin-recovery-export`.
- A exportacao usa exatamente a mesma regra de filtros aplicada na fila administrativa.
- Criado `tools/validate-admin-recovery-filters-export.mjs` para validar filtros, handoff criado e pacote local sem dados sensiveis.
- `tools/validate-design-system.mjs` passou a exigir o validador v8W.
- Evidencia de contrato gerada em `docs/test-reports/v8w-admin-recovery-filters-export-report.json`.
- Proximo incremento recomendado: criar painel de governanca dos pacotes exportados, com importacao controlada e auditoria de troca entre navegadores.

### Fase 8V executada neste ciclo - Fila administrativa de recuperacao

- Criado `assets/js/services/admin-recovery.service.js` para consolidar sinais de retomada em fila administrativa por consultor sugerido.
- `pages/dashboard-admin.html` recebeu o bloco `data-admin-recovery-queue`, conectado a sinais de Produtos, Comparador e Simuladores.
- `assets/js/admin-users.js` passou a renderizar retomadas com etapa, severidade, aging, cliente, responsavel sugerido e status de handoff existente.
- O card executivo de Leads no Admin agora considera retomadas abertas, altas prioridades, consultores elegiveis e handoffs em aberto.
- `assets/js/services/handoff-consultivo.service.js` passou a aceitar `assignedTo` em `createFromSignal()`, preservando o consultor sugerido.
- Criado `tools/validate-admin-recovery-queue.mjs` para validar fila, pool de consultores, criacao de handoff e reducao da fila aberta.
- `tools/validate-design-system.mjs` passou a exigir o novo servico, a secao administrativa e o validador funcional.
- Evidencia de contrato gerada em `docs/test-reports/v8v-admin-recovery-queue-report.json`.
- Proximo incremento recomendado: permitir filtros operacionais por consultor/status na propria fila de recuperacao e exportar pacote local de sinais.

### Fase 8U executada neste ciclo - Retomadas e handoff a partir de sinais

- Criado `assets/js/services/journey-recovery.service.js` para converter microconversoes locais em sinais de retomada.
- O servico identifica selecao sem comparador, comparador sem matriz, decisao sem continuidade, cenario salvo sem simulador e simulador pronto para continuidade.
- `assets/js/client-dashboard.js` passou a exibir `data-client-recovery-signals` e priorizar sinais no card central de continuidade.
- `assets/js/handoff-consultivo.js` passou a exibir `data-handoff-recovery-signals`, permitindo criar ou abrir handoff a partir de um sinal.
- `assets/js/services/handoff-consultivo.service.js` ganhou `findBySignal()` e `createFromSignal()`, preservando owner, prioridade, CTA, checklist e auditoria local.
- Criado `tools/validate-recovery-signals-flow.mjs` para validar a conversao sinal -> handoff sem navegador visual.
- `tools/validate-design-system.mjs` passou a exigir o servico de retomada, os novos blocos de UI e o validador funcional.
- Evidencia de contrato gerada em `docs/test-reports/v8u-recovery-signals-flow-report.json`.
- Proximo incremento recomendado: consolidar esses sinais no Dashboard Admin como fila de recuperacao por consultor, com aging e responsavel sugerido.

### Fase 8T executada neste ciclo - Produtos, Comparador e Simuladores leves sem prints

- Criado `tools/validate-product-journey-flow.mjs` para expandir a governanca funcional para a jornada Produtos -> Comparador -> Simuladores leves.
- O validador executa os scripts reais em ambiente browser-like, reaproveitando servicos de recomendacao, modelos, comparador, simuladores leves e `BFJourneyAnalytics`.
- O contrato valida o catalogo de produtos com rotas de simulador, comparador e preset.
- O contrato gera Top 3 de produtos, abre comparador, recomenda modelo padrao e calcula matriz completa.
- A matriz completa cobre financiamento, consorcio, CDC, garantia, consignado e consumo, exigindo decisao, riscos e CTA para simulador.
- Os simuladores de financiamento, consorcio, CDC, garantia, consignado e veiculos sao calculados sem navegador visual.
- A telemetria local prova selecao de produtos, abertura/carregamento do comparador, matriz calculada, cenario salvo, abertura de simulador e 6 simuladores calculados.
- `tools/validate-design-system.mjs` passou a exigir o novo validador como arquivo obrigatorio de governanca.
- Evidencia de contrato gerada em `docs/test-reports/v8t-product-journey-flow-report.json`.
- Proximo incremento recomendado: usar os sinais validados da jornada de produtos para priorizar cards de retomada no Dashboard Cliente e na fila de handoff.

### Fase 8S executada neste ciclo - Governanca funcional sem prints

- Criado `tools/validate-decision-flow.mjs` para validar o fluxo calculadora -> contexto -> simulador -> historico sem abrir navegador visual.
- O validador monta ambiente browser-like em Node com `localStorage`, `fetch`, `location` e execucao dos scripts reais por `vm`.
- O contrato prova perfil vazio recomendando `custos-fixos`.
- O contrato executa `capacidade-credito` e `lance-consorcio`, validando `historyId`, parcela segura e lance proprio sustentavel.
- O contrato simula deep link `from=calculator`, garantindo `calculatorSlug`, `historyId`, capacidade de pagamento e snapshot sanitizado.
- O contrato salva simulacao no `Storage`, preserva `decisionContext` e grava evento `simulador-consorcio` no historico financeiro.
- O teste impede regressao de seguranca: CPF, telefone, e-mail, nome do cliente e consultor nao podem entrar no perfil compartilhado.
- `tools/validate-design-system.mjs` passou a exigir o novo validador como arquivo obrigatorio de governanca.
- Evidencia de contrato gerada em `docs/test-reports/v8s-decision-flow-report.json`.
- Proximo incremento recomendado: expandir o mesmo padrao para jornadas de Produtos -> Comparador -> Simulador leve, cobrindo microconversoes sem depender de prints.

### Fase 8R executada neste ciclo - Calculadoras como motor da simulacao

- Criado `assets/js/services/decision-context.service.js` para centralizar perfil financeiro, prontidao, recomendacoes, prefill do simulador e auditoria local.
- O hub de calculadoras passou a destacar a trilha minima `Custos Fixos -> Reserva de Emergencia -> Compra Vista ou Parcelado -> Comparador`.
- O catalogo evoluiu de 17 para 19 calculadoras com `capacidade-credito` e `lance-consorcio`.
- `assets/js/formulas/financial.formulas.js` recebeu formulas puras para capacidade de credito e lance proprio sustentavel.
- `assets/js/services/calculadoras.service.js` grava readiness, perfil e historico com origem auditavel.
- `pages/simulador.html` recebeu painel `data-simulator-readiness`, leitura de deep links e prefill contextual sem sobrescrever campos preenchidos manualmente.
- Simulacoes salvas passam a carregar `decisionContext` no payload e tambem registram evento `simulador-consorcio` no historico financeiro local.
- `pages/dashboard-cliente.html` agora mostra a continuidade `diagnostico -> calculadora -> simulacao -> carteira/handoff`.
- `tools/validate-calculadoras.mjs` valida 19 calculadoras e 12 golden tests; `tools/validate-design-system.mjs` valida o novo contrato de contexto.
- Proximo incremento recomendado: adicionar testes funcionais automatizados de fluxo completo com localStorage sem precisar de navegador visual.

### Salto de plataforma iniciado

- O plano do salto arquitetural foi registrado em `docs/PLANO_SALTO_PLATAFORMA_BANK_FRATERN.md`.
- A plataforma ganhou dados JSON curados, formulas financeiras, servicos JS, componentes, simuladores adicionais, comparador novo, dashboards e paginas de dados/compliance/API.
- A home agora aponta para educacao, produtos, comparador, dados, dashboards e simuladores adicionais.
- A reorganizacao de HTMLs em `pages/` foi absorvida: caminhos foram corrigidos, o servidor recebeu aliases e a raiz manteve `index.html` como ponte.
- Foram adicionados simuladores de credito com garantia e consignado, completando a primeira familia de produtos financeiros alem de consorcio, financiamento, veiculos e CDC.
- A normalizacao de acentuacao UTF-8 foi aplicada nas telas principais afetadas, removendo textos visualmente quebrados apos a reorganizacao.

### Fase 8A executada neste ciclo - Design system e jornada unificada

- Criada a camada `assets/css/bf-design-system-v8.css` como acabamento visual canonico carregado depois dos CSS existentes.
- `js/shared-layout.js` agora injeta `assets/css/platform.css` e o v8 automaticamente em paginas com shell compartilhado, adicionando `bf-v8-body`, `data-bf-archetype` e `data-bf-visual-version`.
- `pages/index.html` e `pages/simulador.html` carregam o v8 diretamente, preservando home institucional e simulador com base real.
- `pages/carteira.html`, `pages/assembleias.html`, `pages/duvidas.html`, `pages/sobre-nos.html` e `pages/configuracoes.html` foram marcadas como paginas ativas dentro do contrato v8.
- `pages/index_2.html`, `pages/index_v4_paginas.html` e `pages/consorcio_user_journey_map_v2.html` ficaram como legados controlados, sem remocao.
- Criado `tools/validate-design-system.mjs` para validar estrutura visual, shell, viewport, identidade de pagina, arquivos obrigatorios e referencias locais.
- Documentacao criada em `docs/DESIGN_SYSTEM_V8_BANK_FRATERN.md`.
- Validado: `tools/validate-design-system.mjs` retornou `ok: true` com 45 paginas ativas, 3 legados controlados e 13 paginas criticas cobertas.
- Validado: `tools/validate-calculadoras.mjs` retornou `ok: true`, preservando o catalogo atual de 19 calculadoras e os golden tests.
- Validado: HTTP 200 para as paginas criticas, CSS v8 e `js/shared-layout.js`.
- Evidencias v8 salvas em `docs/test-prints/v8-*.png` e relatorio `docs/test-prints/v8-screenshot-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.0-design-system-unificado-final.zip`.
- Proximo incremento: refinar CSS inline legado em Simulador, Carteira e Assembleias por componente, reduzindo duplicacao sem alterar regras de negocio.

### Fase 8B executada neste ciclo - Continuidade das telas densas

- Criado o componente `bf-v8-stagebar` para conectar contexto, decisao, auditoria e continuidade dentro das paginas mais densas.
- `pages/simulador.html` recebeu atalhos para status da base real, prateleira, resumo financeiro e retomada na carteira.
- `pages/carteira.html` recebeu trilha entre simulacoes salvas, indicadores executivos, clientes/oportunidades e agenda comercial.
- `pages/assembleias.html` recebeu trilha entre historico executivo, contemplacoes, faixa de lances e tabela analitica.
- `tools/validate-design-system.mjs` passou a exigir stagebar v8 em Simulador, Carteira e Assembleias.
- Validado: HTTP 200 para as tres paginas densas.
- Validado: `tools/validate-design-system.mjs` retornou `ok: true` com `denseJourneyPages: 3`.
- Validado: `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Evidencias salvas em `docs/test-prints/v8b-*.png`, com relatorio `docs/test-prints/v8b-stagebar-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.1-stagebar-telas-densas-final.zip`.
- Proximo incremento: substituir blocos inline remanescentes por classes v8 e reduzir duplicacao visual em tabelas, KPIs e graficos.

### Fase 8C executada neste ciclo - Assembleias com decisao operacional

- `pages/assembleias.html` recebeu o bloco `data-assembly-decision-strip` para transformar historico de AGOs em acoes consultivas.
- O bloco destaca prioridade, fila comercial, acompanhamento de faturamento e janela de liquidez do grupo.
- O hero ganhou CTA para `#decisao-operacional`.
- `assets/css/bf-design-system-v8.css` recebeu o componente `bf-v8-decision-strip` e refinamentos especificos para o monitor de assembleias.
- `pages/assembleias.html` teve a codificacao visivel normalizada para UTF-8, removendo mojibake em textos estaticos e renderizados por JS.
- `tools/validate-design-system.mjs` passou a exigir o bloco de decisao operacional na pagina de assembleias.
- Validado: HTTP 200 para `pages/assembleias.html`.
- Validado: `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram `ok: true`.
- Evidencias salvas em `docs/test-prints/v8c-assembleias-*.png`, com relatorio `docs/test-prints/v8c-assembleias-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.2-assembleias-decisao-operacional-final.zip`.
- Incremento seguinte executado: aplicar o mesmo padrao de decisao operacional em Carteira, conectando simulacoes salvas, risco, oportunidades e agenda.

### Fase 8D executada neste ciclo - Carteira com decisao operacional

- `pages/carteira.html` recebeu o bloco `data-portfolio-decision-strip` para transformar a base de clientes em proxima acao do consultor.
- O bloco resume quatro frentes: prioridade operacional, pipeline vindo de simulacoes salvas, proxima agenda e melhor oportunidade comercial.
- O hero agora direciona para `#decisao-carteira` e a stagebar ganhou a etapa adicional de decisao.
- `js/portfolio-live.js` calcula a decisao a partir dos filtros atuais, preservando historico local, simulacoes salvas, dados demonstrativos e base real de grupos.
- `assets/css/bf-design-system-v8.css` recebeu ajustes para stagebar com 5 passos, cards de decisao e tabela mobile resumida sem overflow.
- `pages/carteira.html` teve textos UTF-8 normalizados e icones antigos removidos quando apareciam como mojibake.
- `tools/validate-design-system.mjs` passou a exigir o bloco de decisao operacional na pagina de Carteira.
- Validado: HTTP 200 para `pages/carteira.html`, `js/portfolio-live.js` e `assets/css/bf-design-system-v8.css`.
- Validado: `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram `ok: true`.
- Evidencias salvas em `docs/test-prints/v8d-carteira-decisao-desktop.png`, `docs/test-prints/v8d-carteira-decisao-mobile.png` e `docs/test-prints/v8d-carteira-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.3-carteira-decisao-operacional-final.zip`.
- Proximo incremento: consolidar Simulador como centro de decisao operacional, revisando blocos de resultado, memoria e conexao com carteira.

### Fase 8E executada neste ciclo - Simulador com decisao operacional

- `pages/simulador.html` recebeu o bloco `data-simulator-decision-strip` para transformar base, prateleira, sacola, resultado e historico em proxima acao consultiva.
- A stagebar do Simulador passou a ter 5 passos: base, escolha, decisao, resultado e continuidade.
- `js/app.js` renderiza quatro cards dinamicos: Base, Prateleira, Resultado e Continuidade.
- O card de Base comprova a conexao com `data_base/Tab_Grupos_Consorcio.json`, exibindo 17.396 grupos carregados quando a base real esta online.
- O card de Prateleira reage aos grupos filtrados ou selecionados, orientando quando avançar para parametros.
- O card de Resultado troca o estado de aguardando carrinho para memoria financeira quando existe calculo.
- O card de Continuidade conecta simulacoes salvas e salvamento de cenario com a Carteira.
- `assets/css/bf-design-system-v8.css` recebeu refinamentos responsivos para o header, stagebar e decision strip do Simulador, mantendo desktop e mobile sem overflow horizontal.
- `tools/validate-design-system.mjs` passou a exigir o bloco de decisao operacional em `simulador.html`.
- Validado: `node --check js/app.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Evidencias salvas em `docs/test-prints/v8e-simulador-decisao-desktop-visible.png`, `docs/test-prints/v8e-simulador-decisao-mobile-visible.png` e `docs/test-prints/v8e-simulador-decisao-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.4-simulador-decisao-operacional-final.zip`.
- Proximo incremento recomendado: evoluir `pages/dashboard-cliente.html` como central de continuidade v8, conectando historico, perfil, comparador, trilha e handoff consultivo.

### Fase 8F executada neste ciclo - Dashboard Cliente como central de continuidade

- `pages/dashboard-cliente.html` foi reposicionado como central de retomada da jornada do usuario.
- A pagina recebeu stagebar v8 com 5 etapas: Continuidade, Perfil, Historico, Decisao e Handoff.
- O novo bloco `data-client-continuity-strip` resume quatro frentes: perfil financeiro, historico conectado, trilha ativa e handoff consultivo.
- A nova linha do tempo `data-client-continuity-timeline` mostra o estado de cada etapa da jornada: perfil, historico, modelo, trilha e atendimento.
- O novo bloco `data-client-activity` consolida eventos recentes de simulacoes, calculadoras, modelos de comparacao, trilha e handoff.
- `assets/js/client-dashboard.js` passou a montar um snapshot local da jornada usando dados ja existentes em `localStorage` e servicos atuais, sem backend novo.
- `assets/css/bf-design-system-v8.css` recebeu estilos responsivos para timeline e atividade recente, mantendo a mesma linguagem visual das telas densas anteriores.
- `tools/validate-design-system.mjs` passou a tratar `dashboard-cliente.html` como pagina densa com stagebar obrigatoria e contratos de continuidade.
- Validado: `node --check assets/js/client-dashboard.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Evidencias salvas em `docs/test-prints/v8f-dashboard-cliente-continuidade-desktop.png`, `docs/test-prints/v8f-dashboard-cliente-continuidade-mobile.png` e `docs/test-prints/v8f-dashboard-cliente-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.5-dashboard-cliente-continuidade-final.zip`.
- Proximo incremento recomendado: evoluir `pages/handoff-consultivo.html` e `pages/dashboard-admin.html` como area operacional v8, conectando leads, auditoria, status, checklist e fila de atendimento.

### Fase 8G executada neste ciclo - Area operacional Handoff/Admin

- `pages/handoff-consultivo.html` recebeu stagebar v8 com 5 etapas: Operacao, Leads, Checklist, Auditoria e Admin.
- O novo bloco `data-handoff-operational-strip` resume a fila consultiva em quatro cards: Fila, Prioridade, Atendimento e Auditoria.
- O novo bloco `data-handoff-audit-feed` mostra eventos recentes de criacao, status, notas, checklist e atribuicao do handoff local.
- `assets/js/handoff-consultivo.js` passou a calcular o resumo operacional a partir dos filtros atuais, leads em aberto, prioridade, status, checklist e auditoria.
- `pages/dashboard-admin.html` recebeu stagebar v8 com 5 etapas: Operacao, Usuarios, Leads, Auditoria e Atendimento.
- O novo bloco `data-admin-operational-strip` consolida usuarios, handoffs, modelos e governanca em uma leitura administrativa.
- `assets/js/admin-users.js` passou a resumir acessos ativos, leads consultivos, modelos de comparacao e eventos de auditoria.
- `assets/css/bf-design-system-v8.css` recebeu refinamentos para Handoff e Admin, mantendo detalhe de handoff, tabela admin e blocos operacionais responsivos.
- `tools/validate-design-system.mjs` passou a exigir os contratos operacionais de Handoff e Admin.
- Validado: `node --check assets/js/handoff-consultivo.js`, `node --check assets/js/admin-users.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Evidencias salvas em `docs/test-prints/v8g-handoff-operacional-desktop.png`, `docs/test-prints/v8g-handoff-operacional-mobile.png`, `docs/test-prints/v8g-admin-operacional-desktop.png`, `docs/test-prints/v8g-admin-operacional-mobile.png` e `docs/test-prints/v8g-operacao-handoff-admin-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.6-operacao-handoff-admin-final.zip`.
- Proximo incremento recomendado: revisar `pages/trilha-decisao.html` como ponte visual definitiva entre decisao do usuario, comparador, dashboard cliente e handoff operacional.

### Fase 8H executada neste ciclo - Trilha como ponte central da decisao

- `pages/trilha-decisao.html` recebeu stagebar v8 com 5 etapas: Diagnostico, Ponte, Continuidade, Acao e Handoff.
- O novo bloco `data-journey-bridge-strip` resume quatro frentes da decisao: Diagnostico, Produto/Modelo, Comparador e Handoff.
- O novo bloco `data-journey-bridge-timeline` mostra a continuidade entre perfil financeiro, produto sugerido, modelo recomendado, matriz comparativa e atendimento.
- `assets/js/trilha-decisao.js` passou a renderizar a ponte a partir da trilha ativa, perfil, produto, modelo, proxima acao e handoff consultivo.
- A pagina agora deixa explicito que a Trilha e o ponto de conexao entre usuario, dashboard cliente, comparador e operacao consultiva.
- `assets/css/bf-design-system-v8.css` recebeu ajuste especifico para `decision-journey-page`, mantendo a linguagem visual das demais telas densas.
- `tools/validate-design-system.mjs` passou a exigir a ponte e a timeline em `trilha-decisao.html`.
- Validado: `node --check assets/js/trilha-decisao.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Evidencias salvas em `docs/test-prints/v8h-trilha-ponte-desktop.png`, `docs/test-prints/v8h-trilha-ponte-mobile.png` e `docs/test-prints/v8h-trilha-ponte-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.7-trilha-ponte-decisao-final.zip`.
- Proximo incremento recomendado: aplicar o mesmo contrato de ponte visual em `pages/comparador.html`, para que a matriz comparativa mostre entrada, decisao, memoria, salvamento e saida para dashboard/handoff.

### Fase 8I executada neste ciclo - Comparador como ponte visual da decisao

- `pages/comparador.html` recebeu stagebar v8 com 5 etapas: Perfil, Entrada, Decisao, Memoria e Continuidade.
- O novo bloco `data-comparator-decision-strip` resume quatro frentes da matriz: entrada de perfil/produtos, decisao recomendada, risco principal e continuidade operacional.
- O novo bloco `data-comparator-bridge-timeline` mostra a passagem entre perfil financeiro, matriz lado a lado, decisao, memoria de calculo e retomada no dashboard/handoff.
- `assets/js/bf-platform.js` passou a renderizar a ponte a partir do resultado real do comparador, preservando presets, modelos recomendados, matriz, memoria e salvamento local.
- A memoria de calculo ganhou ancora `#memoria-comparador`, permitindo navegacao direta pela stagebar.
- `assets/css/bf-design-system-v8.css` recebeu ajuste especifico para `decision-comparator-page`, mantendo a mesma linguagem das telas densas ja migradas.
- `tools/validate-design-system.mjs` passou a tratar `comparador.html` como pagina densa com stagebar, ponte e timeline obrigatorias.
- Validado: `node --check assets/js/bf-platform.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Validado: Edge headless confirmou HTTP 200, 5 etapas, 4 cards de ponte, 5 itens na timeline, salvamento no historico local e ausencia de overflow horizontal em desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8i-comparador-ponte-desktop.png`, `docs/test-prints/v8i-comparador-ponte-mobile.png` e `docs/test-prints/v8i-comparador-ponte-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.8-comparador-ponte-decisao-final.zip`.
- Proximo incremento recomendado: revisar `pages/produtos.html` e `pages/calculadoras.html` como portas de entrada da decisao, deixando os cards mais alinhados ao novo contrato de ponte visual.

### Fase 8J executada neste ciclo - Portas de entrada e simuladores leves completos

- `pages/produtos.html` recebeu stagebar v8, `data-products-decision-strip` e `data-products-bridge-timeline`.
- O catalogo de Produtos agora mostra a ponte entre perfil, filtros, produto recomendado, comparador e dashboard.
- `pages/calculadoras.html` recebeu stagebar v8, `data-calculators-decision-strip` e `data-calculators-bridge-timeline`.
- As 17 paginas `pages/calculadora-*.html` receberam stagebar, `data-calculator-decision-strip` e `data-calculator-bridge-timeline`, preservando o renderer comum.
- `assets/js/calculadoras-page.js` passou a renderizar ponte dinamica para hub e detalhe, com perfil, historico, resultado, memoria e continuidade.
- `pages/simulador-financiamento.html`, `pages/simulador-cdc.html`, `pages/simulador-garantia.html`, `pages/simulador-consignado.html` e `pages/simulador-veiculos.html` receberam stagebar, `data-light-simulator-decision-strip` e `data-light-simulator-timeline`.
- `assets/js/bf-platform.js` passou a renderizar ponte comum dos simuladores leves e permitir salvar o cenario no historico local.
- `pages/simulador-consorcio.html` foi consolidada como ponte visual para o simulador completo, cobrindo base real, prateleira, resultado, proposta e carteira.
- `assets/css/bf-design-system-v8.css` recebeu seletores para Produtos, Calculadoras, detalhes e simuladores leves.
- `tools/validate-design-system.mjs` passou a validar Produtos, Calculadoras, 17 detalhes e 6 simuladores leves com stagebar, decision strip e timeline.
- Validado: `node --check assets/js/bf-platform.js`, `node --check assets/js/calculadoras-page.js`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Validado: Edge headless confirmou HTTP 200, 5 etapas, 4 cards de decisao, 5 itens de timeline e ausencia de overflow horizontal nas rotas testadas.
- Evidencias salvas em `docs/test-prints/v8j-produtos-desktop.png`, `docs/test-prints/v8j-calculadoras-desktop.png`, `docs/test-prints/v8j-calculadora-detail-desktop.png`, `docs/test-prints/v8j-simulador-veiculos-desktop.png`, `docs/test-prints/v8j-simulador-consorcio-desktop.png` e respectivas versoes mobile.
- Relatorio salvo em `docs/test-prints/v8j-portas-simuladores-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.9-portas-simuladores-etapas-completas-final.zip`.
- Proximo incremento recomendado: criar uma pagina de amostra de componentes v8 e revisar paginas de educacao/compliance/dados como camada institucional de confianca.

### Fase 8K executada neste ciclo - Confianca institucional e componentes v8

- Criada `pages/componentes-v8.html` como catalogo visual vivo do design system v8, cobrindo tokens, stagebar, decision strip, timeline, cards, badges, formulario, metricas e tabela.
- `pages/educacao.html`, `pages/compliance.html`, `pages/dados-abertos.html` e `pages/api-docs.html` foram reposicionadas como camada institucional de confianca.
- As paginas de confianca receberam `trust-page`, stagebar v8, `data-trust-decision-strip` e `data-trust-timeline`.
- `js/shared-layout.js` ganhou o link "Design" e passou a reconhecer `componentes-v8.html` no arquétipo institucional.
- `assets/css/bf-design-system-v8.css` ganhou estilos para paginas de confianca, catalogo de componentes, swatches e samples responsivos.
- `tools/validate-design-system.mjs` passou a validar a camada institucional, o catalogo de componentes, links locais, stagebar, decision strip e timeline.
- Validado: `node --check js/shared-layout.js`, `node --check tools/validate-design-system.mjs`, `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Validado: HTTP 200 para Educacao, Compliance, Dados Abertos, API Docs e Componentes v8.
- Validado: Edge headless confirmou 5 itens na stagebar, 4 cards de decisao, 5 itens na timeline, ausencia de overflow horizontal, ausencia de erros de console e amostras suficientes no catalogo.
- Evidencias salvas em `docs/test-prints/v8k-educacao-confianca-desktop.png`, `docs/test-prints/v8k-compliance-confianca-desktop.png`, `docs/test-prints/v8k-dados-confianca-desktop.png`, `docs/test-prints/v8k-api-confianca-desktop.png`, `docs/test-prints/v8k-componentes-desktop.png`, `docs/test-prints/v8k-educacao-confianca-mobile.png`, `docs/test-prints/v8k-componentes-mobile.png` e `docs/test-prints/v8k-confianca-componentes-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.10-confianca-componentes-final.zip`.
- Proximo incremento recomendado: revisar Home, Sobre, Duvidas e Configuracoes contra o catalogo vivo, reduzindo diferencas residuais entre paginas institucionais.

### Fase 8L executada neste ciclo - Institucional e configuracoes alinhadas ao catalogo v8

- `pages/index.html` recebeu stagebar institucional, `data-home-decision-strip` e `data-home-institutional-timeline`, conectando empresa, perfil, jornada, prova operacional e design system.
- `pages/sobre-nos.html` foi reescrita como pagina institucional v8, com proposta da empresa, pilares, decision strip e timeline de continuidade.
- `pages/duvidas.html` foi reescrita como central de duvidas v8, cobrindo plataforma, dados locais, produtos, limites e proximos passos.
- `pages/configuracoes.html` foi reescrita como centro de governanca local, com stagebar, `data-settings-decision-strip`, `data-settings-timeline`, chips de configuracoes ativas e defaults de simulacao.
- `assets/css/bf-design-system-v8.css` passou a tratar `institutional-journey-page` e `settings-page` nos mesmos componentes de stagebar, decision strip e timeline.
- `css/home.css` recebeu ajuste responsivo no footer para eliminar overflow horizontal no mobile.
- `tools/validate-design-system.mjs` passou a validar Home, Sobre, Duvidas e Configuracoes como paginas densas do contrato v8.
- Validado: `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Validado: HTTP 200 para Home, Sobre, Duvidas e Configuracoes.
- Validado: Edge headless confirmou desktop/mobile sem overflow, sem erros de console, sem encoding quebrado, com 5 itens de stagebar, 4 cards de decisao e 5 itens de timeline.
- Evidencias salvas em `docs/test-prints/v8l-home-institucional-desktop.png`, `docs/test-prints/v8l-home-institucional-mobile.png`, `docs/test-prints/v8l-sobre-confianca-desktop.png`, `docs/test-prints/v8l-sobre-confianca-mobile.png`, `docs/test-prints/v8l-duvidas-confianca-desktop.png`, `docs/test-prints/v8l-duvidas-confianca-mobile.png`, `docs/test-prints/v8l-configuracoes-governanca-desktop.png`, `docs/test-prints/v8l-configuracoes-governanca-mobile.png` e `docs/test-prints/v8l-institucional-configuracoes-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.11-institucional-configuracoes-final.zip`.
- Proximo incremento recomendado: iniciar saneamento visual dos CSS legados, começando por comentarios/duplicacoes em `css/home.css` e `css/shared-site.css`, sem alterar a experiencia ja validada.

### Fase 8M executada neste ciclo - Saneamento visual dos CSS legados

- `css/home.css` e `css/shared-site.css` tiveram comentarios, separadores e acentos de comentarios normalizados para ASCII.
- `tools/validate-design-system.mjs` passou a validar sinais de mojibake em paginas ativas, ignorando apenas legados controlados.
- O validador tambem passou a exigir ASCII em `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css`.
- `pages/assembleias.html` recebeu favicon SVG para eliminar 404 de recurso padrao no headless.
- `pages/assembleias.html` teve dois icones com encoding quebrado substituidos por marcadores ASCII e ganhou o quinto item da stagebar: Decisao.
- `pages/simulador.html` teve comentario antigo com encoding quebrado normalizado.
- Validado: `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` retornaram sucesso.
- Validado: `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css` retornaram `nonAscii=0`.
- Validado: HTTP 200 para Produtos, Home, Sobre, Duvidas, Configuracoes, Assembleias e Simulador.
- Validado: Edge headless confirmou Produtos desktop/mobile, Home desktop/mobile, Sobre desktop, Duvidas mobile, Configuracoes mobile, Assembleias desktop e Simulador desktop sem overflow, sem encoding quebrado e sem erros de console.
- Evidencias salvas em `docs/test-prints/v8m-produtos-saneamento-desktop.png`, `docs/test-prints/v8m-produtos-saneamento-mobile.png`, `docs/test-prints/v8m-home-css-saneamento-desktop.png`, `docs/test-prints/v8m-home-css-saneamento-mobile.png`, `docs/test-prints/v8m-sobre-shared-saneamento-desktop.png`, `docs/test-prints/v8m-duvidas-shared-saneamento-mobile.png`, `docs/test-prints/v8m-configuracoes-saneamento-mobile.png`, `docs/test-prints/v8m-assembleias-encoding-desktop.png`, `docs/test-prints/v8m-simulador-encoding-desktop.png` e `docs/test-prints/v8m-css-saneamento-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.12-css-saneamento-final.zip`.
- Proximo incremento recomendado: evoluir a pagina de Produtos com microinteracoes de filtro e comparacao, mantendo o contrato visual ja validado.

### Fase 1 executada neste ciclo

- A conexao com `data_base/Tab_Grupos_Consorcio.json` foi reforcada no simulador com status rastreavel via `getShelfDataStatus()`.
- O simulador agora demonstra a jornada de carregamento com overlay em etapas, barra percentual e painel persistente de fonte/caminho/quantidade da base.
- A prateleira mostra barra de progresso ao buscar, aplicar filtros, ordenar e renderizar os grupos.
- O caminho `simulador.html?showLoading=1` fica salvo como rota preferencial para capturar evidencia visual do carregamento.
- O protocolo de testes preferencial foi registrado em `docs/CODEX_TEST_PROTOCOL.md`.
- Evidencias atuais do ciclo foram salvas em `docs/test-prints/reorg-*.png`, cobrindo home, loading da base, produtos, credito com garantia e consignado.

### Fase 2A executada neste ciclo - Usuarios, login e administracao

- Criada a camada `js/auth.js` com usuarios locais, sessao de 8 horas, papeis `admin`, `consultor` e `cliente`, status ativo/inativo e protecao por pagina.
- Criada a pagina `pages/login.html` com contas seed, barra de progresso e redirecionamento para a area solicitada.
- Evoluido `pages/dashboard-admin.html` para um painel administrativo real com cadastro, edicao, filtros, ativacao/inativacao, exclusao e senha temporaria.
- Evoluido `pages/dashboard-cliente.html` para exibir a sessao autenticada e bloquear acesso sem login.
- Atualizado `js/shared-layout.js` para mostrar usuario logado, link Admin quando aplicavel e acao de logout.
- Criada a documentacao operacional `docs/AUTH_ADMIN_LOCAL.md`.
- Evidencias salvas em `docs/test-prints/auth-login-desktop.png`, `auth-admin-dashboard-desktop.png` e `auth-client-dashboard-desktop.png`.

### Fase 3A em implementacao - Ecossistema integrado de calculadoras

- Criado o hub `pages/calculadoras.html` como entrada unica para diagnostico, credito, investimentos, comparacao, planejamento e educacao financeira.
- Criadas 17 paginas individuais em `pages/calculadora-*.html`, todas conectadas ao mesmo renderer e ao mesmo motor de formulas.
- Criados os dados locais `assets/data/calculadoras.json` e `assets/data/calculadoras-premissas.json`.
- Criada a biblioteca `assets/js/formulas/financial.formulas.js` com juros simples, compostos, PMT/Price, valor presente, descumulacao, reserva, renda fixa, IR regressivo e comparadores.
- Criado o servico `assets/js/services/calculadoras.service.js` com simulacao por slug, perfil financeiro em `localStorage`, historico unificado e recomendacoes explicaveis.
- Criada a UI `assets/js/calculadoras-page.js` para hub, paginas individuais, perfil, memoria de calculo, recomendacao, historico e tabelas de apoio.
- Dashboard cliente passou a exibir perfil financeiro consolidado e historico das calculadoras.
- Produtos, dados abertos, compliance e API Docs foram atualizados para refletir o novo ecossistema.
- Documentacao funcional criada em `docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md`.

### Fase 3B executada neste ciclo - Governanca e testes das calculadoras

- Criada a pagina admin `pages/calculadoras-governanca.html` para auditar catalogo, premissas e formulas.
- Criado o arquivo `assets/data/calculadoras-golden-tests.json` com casos deterministas para formulas principais.
- Criado o script `tools/validate-calculadoras.mjs` para validar catalogo, slugs, paginas, premissas, implementacao no servico e golden tests.
- `assets/js/services/calculadoras.service.js` passou a suportar override local de premissas em `localStorage['bf_calculator_premissas_override_v1']`.
- Dashboard admin, rodape, API Docs e dados abertos passaram a apontar para governanca das calculadoras.
- Criterio de aceite: nenhum novo conjunto de premissas deve ser promovido sem a suite de formulas aprovada.

### Fase 4 executada neste ciclo - Configuracoes globais aplicadas

- `js/settings.js` passou a expor uma API global, normalizar valores, aplicar classes de experiencia e publicar evento de configuracao aplicada.
- `js/shared-layout.js` aplica as preferencias salvas tambem em paginas que ainda nao importam `settings.js` diretamente.
- `pages/configuracoes.html` ganhou painel de status com chips das preferencias ativas.
- `pages/index.html` agora carrega `settings.js`, mostra faixa de preferencias globais e adiciona links para Calculadoras.
- `js/home.js` usa o segmento padrao para priorizar grupos em destaque e demonstra as preferencias ativas.
- `js/app.js` aplica defaults de page size, score automatico, segmento, administradora, politica de saldo, indice de reajuste, MOB e limite de lance embutido.
- `pages/simulador.html` reaplica defaults depois que a base real monta os filtros de administradora.
- A fase server-side de premissas, versionamento de formulas, aprovacao e publicacao de regras ficou registrada como backlog.
- Evidencias salvas em `docs/test-prints/phase4-settings-config-desktop.png`, `phase4-settings-home-desktop.png`, `phase4-settings-home-mobile.png` e `phase4-settings-simulator-desktop.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.3-fase4-configuracoes-final.zip`.

### Fase 4B executada neste ciclo - Home institucional do usuario

- `pages/index.html` foi reposicionada como tela institucional para o usuario final.
- A primeira dobra agora apresenta o Bancus Fraternis como jornada de decisao financeira, com perfil unico, diagnostico, simulacoes conectadas e recomendacao explicavel.
- A Home recebeu um diagnostico rapido local com renda, despesas, dividas, reserva, objetivo, score educativo e proxima acao.
- A prova operacional da plataforma continua presente, mas foi deslocada para uma secao posterior, depois da narrativa do usuario.
- `js/home.js` calcula a previa do diagnostico sem salvar os dados e mantem a conexao com base real, historico local e configuracoes globais.
- `css/home.css` recebeu a camada `home-body--institutional`, responsiva e sem sidebar operacional.
- Evidencias salvas em `docs/test-prints/home-institutional-desktop.png` e `home-institutional-mobile.png`.

### Fase 4C executada neste ciclo - Comparador orientado a decisao

- `pages/comparador.html` passou a funcionar como uma jornada de escolha financeira, usando valor do bem, entrada, taxa, prazo, consorcio, renda, custos, dividas, reserva, urgencia e prioridade.
- `assets/js/services/comparador.service.js` agora gera uma decisao recomendada, separando menor custo, menor parcela, urgencia de disponibilidade, preservacao de caixa e riscos de capacidade.
- `assets/js/bf-platform.js` renderiza perfil usado, cards comparativos, memoria de calculo, riscos, proximas acoes e salvamento do cenario no historico local.
- O dashboard cliente e o hub de calculadoras reconhecem historicos do comparador e reabrem a rota correta `comparador.html`.
- Evidencias salvas em `docs/test-prints/comparador-decisao-desktop.png` e `comparador-decisao-mobile.png`.
- Proximo incremento: ampliar a matriz para CDC, credito com garantia, consignado e compra a vista/parcelado, usando o mesmo motor de recomendacao explicavel.

### Fase 4D executada neste ciclo - Decisao de compra responsavel

- `pages/calculadora-compra-vista-parcelado.html` passou a coletar renda, custos, reserva atual e prioridade da decisao.
- A regra de calculo agora cruza valor presente das parcelas com liquidez real do usuario.
- A recomendacao diferencia tres intencoes: menor custo, preservar caixa e equilibrio entre desconto e reserva.
- A memoria de calculo mostra preco a vista, valor presente, reserva apos compra e parcela sobre renda.
- O perfil financeiro consolidado passa a guardar a ultima decisao de compra e a parcela de consumo.
- Evidencias salvas em `docs/test-prints/compra-vista-parcelado-decisao-desktop.png` e `compra-vista-parcelado-decisao-mobile.png`.
- Proximo incremento: conectar essa decisao como uma coluna opcional no `comparador.html`.

### Fase 4E executada neste ciclo - Produtos como catalogo de decisao

- `pages/produtos.html` passou a mostrar perfil local, trilha sugerida, filtros de objetivo/urgencia/risco e cards acionaveis.
- `assets/data/produtos.json` agora descreve rotas de simulacao, comparacao, calculadora relacionada, situacao indicada e situacao de cautela.
- `assets/js/bf-platform.js` filtra e ranqueia produtos usando o motor de recomendacao existente e o perfil financeiro consolidado.
- `assets/js/components/cards.js` renderiza score, criterios, riscos e botoes para transformar produto em acao.
- Evidencias salvas em `docs/test-prints/produtos-catalogo-decisao-desktop.png` e `produtos-catalogo-decisao-mobile.png`.
- Proximo incremento: usar o mesmo catalogo como fonte para colunas opcionais do comparador multi-produto.

### Fase 4F executada neste ciclo - Comparador multi-produto

- `pages/comparador.html` agora permite selecionar colunas de financiamento, consorcio, CDC, credito com garantia, consignado e compra a vista/parcelada.
- `assets/js/services/comparador.service.js` monta a matriz dinamicamente e reaproveita os servicos de credito ja existentes.
- A recomendacao principal usa o conjunto de produtos de credito quando ha comparacao mista, mantendo consumo como coluna de apoio e diagnostico.
- Os cards do comparador exibem nota de uso e link direto para o simulador ou calculadora correspondente.
- Evidencias salvas em `docs/test-prints/comparador-multiproduto-desktop.png` e `comparador-multiproduto-mobile.png`.
- Proximo incremento: permitir presets por objetivo vindos de `produtos.json` e salvar modelos de comparacao favoritos.

### Fase 4G executada neste ciclo - Presets de comparacao por objetivo

- `pages/comparador.html` passou a ter presets Manual, Comprar bem, Obter liquidez, Trocar veiculo e Consumo pontual.
- `assets/js/bf-platform.js` aplica colunas, urgencia, prioridade e premissas base de cada objetivo sem bloquear edicao manual posterior.
- O resumo do preset usa `assets/data/produtos.json` para mostrar os produtos relacionados a cada objetivo.
- `assets/js/services/comparador.service.js` registra o preset aplicado na memoria de calculo e amplia a decisao por rapidez para qualquer credito imediato.
- Evidencias salvas em `docs/test-prints/comparador-presets-desktop.png` e `comparador-presets-mobile.png`.
- Proximo incremento: salvar presets favoritos do usuario e permitir um preset vindo da pagina Produtos.

### Fase 4H executada neste ciclo - Favoritos e entrada direta de Produtos

- `assets/data/produtos.json` ganhou `comparadorPreset` para cada produto do catalogo.
- `assets/js/components/cards.js` passou a gerar links de comparacao com query string de preset.
- `pages/produtos.html` atualiza o botao `Abrir comparador 2.0` conforme objetivo selecionado no filtro.
- `assets/js/bf-platform.js` reconhece `?preset=`, `?objetivo=` e `?produto=` no comparador, aplica o preset no carregamento e permite salvar/aplicar preset favorito.
- O favorito fica em `localStorage` com chave por usuario autenticado ou perfil anonimo local.
- O estado global do comparador usa `data-comparator-active-preset` para nao colidir com o `select[data-comparator-preset]`.
- Evidencias salvas em `docs/test-prints/produtos-comparador-deeplink-desktop.png`, `comparador-favorito-desktop.png` e `comparador-favorito-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.10-favoritos-deeplink-final.zip`.
- Proximo incremento: tornar os favoritos uma lista nomeada de modelos de comparacao, nao apenas um preset principal.

### Fase 4I executada neste ciclo - Modelos nomeados de comparacao

- O comparador ganhou campo `Nome do modelo`, lista de modelos salvos e acoes para abrir, aplicar e excluir modelos locais.
- `assets/js/bf-platform.js` passou a persistir modelos em `localStorage['bf_comparator_models_v1:<usuario-ou-anon>']`.
- Cada modelo salva nome, preset, campos da matriz, produtos ativos, usuario local, criacao e ultima atualizacao.
- `comparador.html?modelo=<id>` restaura uma matriz salva e recalcula a decisao automaticamente.
- `pages/dashboard-cliente.html` exibe os modelos do usuario autenticado como atalhos de decisao.
- `assets/js/client-dashboard.js` passou a consumir `window.BFComparatorModels`.
- Evidencias salvas em `docs/test-prints/comparador-modelos-nomeados-desktop.png`, `comparador-modelo-aberto-desktop.png`, `dashboard-cliente-modelos-comparador-desktop.png` e `comparador-modelos-nomeados-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.11-modelos-comparador-final.zip`.
- Proximo incremento: transformar modelos em pacotes compartilhaveis com export/import local e trilha de auditoria.

### Fase 4J executada neste ciclo - Exportacao e auditoria de modelos

- O comparador passou a exportar modelos em pacote JSON com schema `bank-fratern.comparator-models.v1`.
- A importacao por textarea permite restaurar modelos no escopo do usuario atual.
- Cada modelo registra `formulaVersion`, `premiseReference`, `source`, usuario, produtos ativos e datas.
- Operacoes de criar, atualizar, excluir, exportar e importar modelos geram auditoria local em `bf_comparator_model_audit_v1`.
- O dashboard admin recebeu painel de auditoria de modelos com totais, versao de formula, referencia de premissas e ultimos eventos.
- `window.BFComparatorModels` expoe APIs para listar modelos por usuario, listar todos os modelos locais, exportar/importar pacotes e ler auditoria.
- Evidencias salvas em `docs/test-prints/comparador-modelos-export-import-desktop.png`, `dashboard-admin-auditoria-modelos-desktop.png` e `comparador-modelos-export-import-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.12-export-import-auditoria-modelos-final.zip`.
- Proximo incremento: criar uma pagina dedicada de governanca comercial para modelos, com filtros por usuario, produto, risco e origem.

### Fase 4K executada neste ciclo - Governanca comercial de modelos

- Criada a pagina `pages/modelos-governanca.html` para administrar modelos de comparacao salvos no navegador.
- Criado `assets/js/modelos-governanca.js` com filtros por busca, usuario, preset, produto ativo e status.
- `assets/js/bf-platform.js` passou a calcular score de qualidade dos modelos e expor `BFComparatorModels.updateGovernance`.
- Cada modelo pode ser marcado como rascunho, aprovado, publicado ou arquivado.
- Publicacao, aprovacao e arquivamento geram eventos de auditoria local reutilizados pelo dashboard admin.
- Dashboard admin e rodape passaram a apontar para a governanca comercial de modelos.
- Evidencias salvas em `docs/test-prints/modelos-governanca-desktop.png`, `dashboard-admin-governanca-modelos-desktop.png` e `modelos-governanca-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.13-governanca-comercial-modelos-final.zip`.
- Proximo incremento: criar biblioteca de modelos padrao por jornada, com seeds curados para liquidez, compra de bem, troca de veiculo e consumo responsavel.

### Fase 4L executada neste ciclo - Biblioteca de modelos padrao

- Criado `assets/data/modelos-comparador-padrao.json` com quatro modelos publicados por jornada financeira.
- Criada a pagina `pages/modelos-biblioteca.html` com busca, filtros por jornada/preset, cards explicativos e lista de clones do usuario.
- Criado `assets/js/modelos-biblioteca.js` para carregar a biblioteca, clonar modelos padrao e refletir o estado no resumo da pagina.
- `assets/js/bf-platform.js` passou a expor `BFComparatorModels.cloneStandard`, registrando origem, `standardId`, usuario, versao de formula, referencia de premissas e auditoria `clone-standard`.
- `pages/dashboard-cliente.html` e `assets/js/client-dashboard.js` passaram a destacar modelos publicados e clones salvos no escopo do usuario.
- `docs/COMPARADOR_BIBLIOTECA_MODELOS_PADRAO.md`, changelog e protocolo de testes foram atualizados para documentar o novo fluxo.
- Evidencias salvas em `docs/test-prints/modelos-biblioteca-desktop.png`, `comparador-modelo-padrao-clonado-desktop.png`, `dashboard-cliente-biblioteca-modelos-desktop.png` e `modelos-biblioteca-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.14-biblioteca-modelos-padrao-final.zip`.
- Proximo incremento: promover modelos padrao para um fluxo de recomendacao automatica dentro do comparador e preparar sincronizacao server-side.

### Fase 4M executada neste ciclo - Recomendacao automatica de modelos

- Criado `assets/js/services/modelos-recomendacao.service.js` para ranquear modelos padrao por perfil, objetivo, urgencia, prioridade, renda, reserva, valor e produtos ativos.
- `pages/comparador.html` ganhou bloco de modelo recomendado antes do formulario, com score de aderencia, motivos explicaveis e acao para clonar/aplicar.
- `assets/js/bf-platform.js` passou a carregar `modelosComparadorPadrao` no comparador e aplicar o clone recomendado na matriz atual.
- `assets/js/modelos-biblioteca.js` passou a ordenar os cards por aderencia, destacar o recomendado e respeitar `?recomendado=<id>`.
- `assets/js/client-dashboard.js` passou a ordenar modelos padrao pelo perfil salvo e mostrar `Recomendado para seu perfil`.
- Evidencias salvas em `docs/test-prints/comparador-modelo-recomendado-desktop.png`, `comparador-modelo-recomendado-aplicado-desktop.png`, `modelos-biblioteca-recomendacao-desktop.png`, `dashboard-cliente-modelo-recomendado-desktop.png` e `comparador-modelo-recomendado-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.15-recomendacao-automatica-modelos-final.zip`.
- Proximo incremento concluido na Fase 4N: criar trilhas assistidas de decisao, conduzindo o usuario do diagnostico para simulacao, comparacao, modelo recomendado e proxima acao.

### Fase 4N executada neste ciclo - Trilha assistida de decisao

- Criado `pages/trilha-decisao.html` como ponto unico para montar uma jornada por objetivo, urgencia, prioridade, risco, renda, custos, dividas, reserva, valor alvo e entrada.
- Criado `assets/js/services/trilha-decisao.service.js` para normalizar perfil, ranquear produtos, escolher modelo padrao recomendado, montar cinco etapas e salvar estado por usuario local.
- Criado `assets/js/trilha-decisao.js` para renderizar formulario, resumo, etapas, ranking de produtos, proxima acao e estado salvo.
- `pages/dashboard-cliente.html` ganhou bloco de trilha assistida ativa, com produto, modelo, reserva, capacidade segura e CTA da proxima acao.
- `assets/js/client-dashboard.js` passou a consumir `BFTrilhaDecisaoService.load()` e mostrar continuidade da jornada no dashboard.
- `js/shared-layout.js` passou a expor a rota `Trilha` no header e links de rodape.
- Documentacao criada em `docs/TRILHA_ASSISTIDA_DECISAO.md`.
- Evidencias salvas nesta fase: `docs/test-prints/trilha-decisao-desktop.png`, `trilha-decisao-comparador-desktop.png`, `dashboard-cliente-trilha-decisao-desktop.png` e `trilha-decisao-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.16-trilha-assistida-decisao-final.zip`.
- Proximo incremento concluido na Fase 4O: transformar trilha ativa em handoff consultivo, com status de lead, checklist de atendimento e historico comercial local.

### Fase 4O executada neste ciclo - Handoff consultivo e leads locais

- Criado `assets/js/services/handoff-consultivo.service.js` para criar leads locais a partir de trilhas, calcular prioridade, atualizar status, checklist, responsavel, notas e auditoria.
- Criada a pagina `pages/handoff-consultivo.html` para admin e consultor acompanharem a fila local de leads consultivos.
- Criado `assets/js/handoff-consultivo.js` com filtros, cards, detalhe do lead, status operacional, checklist, notas e timeline local.
- `pages/trilha-decisao.html` passou a carregar o servico de handoff e exibir acao `Gerar handoff local`.
- `pages/dashboard-cliente.html` e `assets/js/client-dashboard.js` passaram a criar/atualizar handoff vinculado a trilha do usuario.
- `pages/dashboard-admin.html` e `assets/js/admin-users.js` passaram a exibir resumo da fila local de handoffs.
- `js/shared-layout.js` ganhou link de rodape para `Handoff consultivo`.
- Documentacao criada em `docs/HANDOFF_CONSULTIVO_LEADS.md`.
- Evidencias salvas nesta fase: `docs/test-prints/handoff-trilha-criado-desktop.png`, `handoff-consultivo-desktop.png`, `dashboard-admin-handoff-desktop.png` e `handoff-consultivo-mobile.png`.
- Checkpoint salvo: `versions/bank-fratern-v7.17-handoff-consultivo-final.zip`.
- Proximo incremento: criar funil consultivo com SLA local, etapas comerciais e resumo exportavel sem transmissao externa.

## Paginas Atualizadas

### Home
- Fonte: `data_base/Tab_Grupos_Consorcio.json` + `Storage` + `BFDecisionContext` + historico local de calculadoras e simulacoes.
- Entrega: Home institucional com hero contextual, cockpit de continuidade, perfil financeiro unico, diagnostico rapido, jornada de decisao, proximas acoes e prova de plataforma.
- Evidencias: `docs/test-reports/v8ac-home-contextual-hero-report.json`, `docs/test-reports/v8ab-home-continuity-cockpit-report.json` e historico visual preservado em `docs/test-prints/home-institutional-desktop.png` e `docs/test-prints/home-institutional-mobile.png`.

### Carteira
- Fonte: 30 registros demonstrativos + simulacoes salvas em `Storage` + resumo da base real.
- Entrega: camada `js/portfolio-live.js`, painel "Carteira viva", dashboard recalculado, filtros vivos, agenda e ranking com simulacoes do simulador.
- Proxima evolucao: detalhe por cliente/simulacao e decisao de quando remover ou arquivar a base demonstrativa.

### Assembleias
- Fonte: serie historica embutida + grupo real `79` em `Tab_Grupos_Consorcio.json` + simulacoes salvas vinculadas ao grupo.
- Entrega: camada `js/assemblies-live.js`, hero conectado a base real, painel de fonte, cards de retrato comercial e insights enriquecidos.
- Proxima evolucao: mover a serie historica para JSON externo e criar seletor de grupo monitorado.

## Roadmap de Proximas Fases

### Fase 1 - Persistencia Completa do Simulador
- Status: em execucao avancada.
- Entregue: `Storage` schema 2 salva snapshot de formulario, carrinho completo, parametros, resultado, totais e metadados de cliente/consultor.
- Entregue: simulador restaura por URL `pages/simulador.html?simulationId=<id>`.
- Entregue: carteira exibe link `Retomar simulacao` para abrir uma simulacao salva no simulador.
- Validado: teste CDP com simulação controlada restaurou consultor, cliente, carrinho, etapa 5 e link na carteira.
- Evidencias: `docs/test-prints/phase1-resume-simulator.png` e `docs/test-prints/phase1-portfolio-resume-link.png`.
- Proximo incremento: permitir atualizar uma simulacao existente sem criar duplicata e criar detalhe lateral na carteira.

### Fase 2 - Carteira 2.0
- Criar detalhe lateral para cliente/simulacao.
- Consolidar simulacoes salvas como pipeline comercial real.
- Permitir filtrar somente "Simulacoes salvas", "Base demonstrativa" ou "Todos".
- Criterio de aceite: carteira se comporta como painel operacional, nao apenas relatorio estatico.

### Fase 2B - Backend de Autenticacao e Permissoes
- Substituir `localStorage` por API propria com persistencia server-side.
- Criar endpoints: `POST /auth/login`, `POST /auth/logout`, `GET /auth/session`, `GET/POST/PATCH/DELETE /users`.
- Adicionar hash forte de senha, expiracao de sessao, trilha de auditoria e recuperacao de senha.
- Criterio de aceite: os mesmos fluxos atuais funcionam sem depender de localStorage para usuarios e sessoes.

### Fase 3A - Calculadoras Financeiras Integradas
- Status: em validacao.
- Entregue: hub, 17 paginas, catalogo JSON, premissas locais, formulas, simulador por slug, perfil financeiro, historico e recomendacoes.
- Validar: HTTP 200 de todas as rotas, calculo padrao de cada slug, persistencia local, reaproveitamento de dados e prints desktop/mobile.
- Proximo incremento: transformar os JSONs em API propria, adicionar golden tests de formulas e criar painel admin para editar premissas.

### Fase 3B - Governanca de Formulas e Premissas
- Status: entregue.
- Entregue: painel admin, golden tests, override local, validacao automatizada e rotas documentadas.
- Proximo incremento: criar API server-side para premissas, versoes de formulas, logs de aprovacao e publicacao de regras.

### Fase 3 - Assembleia 2.0
- Extrair historico de assembleias para `data_base/assembleias/*.json`.
- Criar seletor de grupo monitorado e fallback quando nao houver historico.
- Cruzar simulacoes salvas com o grupo selecionado.
- Criterio de aceite: o usuario escolhe um grupo e a pagina recalcula KPIs, graficos e narrativa.

### Fase 4 - Configuracoes Aplicadas Globalmente
- Status: entregue neste ciclo.
- Entregue: `Settings` aplicado no boot global, Home, simulador e paginas com layout compartilhado.
- Entregue: page size, score automatico, defaults de segmento/admin, politica de saldo, reajuste, MOB, limite de lance embutido e preferencias visuais.
- Validar: mudancas feitas em `configuracoes.html` alteram comportamento real das paginas.

### Fase 4C - Comparador 2.0
- Status: entregue neste ciclo.
- Entregue: perfil financeiro local, priorizacao por urgencia, custo, parcela e liquidez, cards de decisao, riscos explicaveis e salvamento no historico financeiro.
- Validado: alternancia de prioridade/urgencia, salvamento do cenario, matriz renderizada e responsividade desktop/mobile sem overflow.
- Proximo incremento: adicionar CDC, credito com garantia, consignado, Pix parcelado e compra a vista/parcelado como colunas opcionais.

### Fase 4D - Consumo responsavel
- Status: entregue neste ciclo.
- Entregue: calculadora de compra com renda, reserva, prioridade de decisao, cobertura apos compra e recomendacao explicavel.
- Validado: calculo padrao, mudanca de prioridade, salvamento no historico, reaproveitamento do perfil e responsividade desktop/mobile sem overflow.
- Proximo incremento: expor essa decisao dentro do comparador multi-produto.

### Fase 4E - Produtos 2.0
- Status: entregue neste ciclo.
- Entregue: catalogo guiado por objetivo, urgencia e risco; cards com rotas de simulacao/comparacao/diagnostico; trilha sugerida por score.
- Validado: filtros, recomendacao lider, botoes dos cards, responsividade sem overflow e evidencias desktop/mobile.
- Proximo incremento: alimentar o comparador multi-produto a partir do catalogo `produtos.json`.

### Fase 4F - Comparador multi-produto
- Status: entregue neste ciclo.
- Entregue: seletores de colunas, matriz dinamica, credito com garantia, consignado, CDC e consumo responsavel como alternativas opcionais.
- Validado: todas as colunas, decisao por rapidez, salvamento no historico, riscos explicaveis e responsividade desktop/mobile sem overflow.
- Proximo incremento: presets de comparacao por objetivo e configuracao de colunas favoritas.

### Fase 4G - Presets por objetivo
- Status: entregue neste ciclo.
- Entregue: presets de objetivo no comparador, aplicacao automatica de colunas e premissas, resumo conectado ao catalogo de produtos.
- Validado: presets principais, memoria de calculo, historico local e responsividade desktop/mobile sem overflow.
- Proximo incremento: presets favoritos persistidos por usuario e entrada direta a partir de `produtos.html`.

### Fase 4H - Favoritos e deep link de presets
- Status: entregue neste ciclo.
- Entregue: deep link por query string, links da pagina Produtos com preset, favorito local por usuario e botoes para salvar/aplicar favorito.
- Validado: abrir comparador por produto, aplicar preset de URL, salvar favorito em chave local por usuario, reaplicar favorito, recalcular matriz e responsividade desktop/mobile sem overflow.
- Proximo incremento: lista de modelos favoritos nomeados com compartilhamento por URL.

### Fase 4I - Modelos nomeados de comparacao
- Status: entregue neste ciclo.
- Entregue: lista local de modelos com nome, preset base, campos da matriz, produtos ativos e data de atualizacao.
- Entregue: salvamento de matriz atual como modelo reutilizavel.
- Entregue: abertura por `comparador.html?modelo=<id>` com restauracao automatica de campos e recalculo.
- Entregue: modelos exibidos no dashboard cliente como atalhos de decisao financeira.
- Validado: modelo de liquidez salvo por usuario cliente, reaberto por URL e exibido no dashboard.

### Fase 4J - Exportacao e auditoria de modelos
- Status: entregue neste ciclo.
- Entregue: export/import local de modelos em JSON com schema controlado.
- Entregue: origem do modelo, versao de formulas e premissas usadas.
- Entregue: painel de auditoria de modelos no dashboard admin.
- Entregue: base tecnica para compartilhamento seguro por link quando houver backend.
- Validado: pacote exportado/importado, auditoria local e restauracao por URL.

### Fase 4K - Governanca comercial de modelos
- Status: entregue neste ciclo.
- Entregue: pagina dedicada para governanca de modelos de comparacao.
- Entregue: filtros por usuario, preset, produto ativo, origem textual e status.
- Entregue: score de qualidade do modelo com base em premissas, formula, origem, produtos e perfil financeiro.
- Entregue: fluxo local de aprovacao, publicacao e arquivamento para modelos.
- Validado: filtro por preset, publicacao, auditoria e dashboard admin.

### Fase 4L - Biblioteca de modelos padrao
- Status: entregue neste ciclo.
- Entregue: dados locais com modelos padrao por jornada financeira.
- Entregue: clonagem de modelo padrao para usuario/consultor via `BFComparatorModels.cloneStandard`.
- Entregue: modelos publicados no dashboard cliente e biblioteca dedicada.
- Entregue: auditoria local do clone com evento `clone-standard`.
- Validar: clone deve abrir no comparador por `?modelo=<id>` e aparecer no dashboard cliente.

### Fase 4M - Recomendacao automatica de modelos
- Status: entregue neste ciclo.
- Entregue: sugestao de modelos padrao no comparador com base em objetivo, urgencia, renda, reserva, valor e prioridade.
- Entregue: clone/aplicacao do modelo recomendado diretamente na matriz do comparador.
- Entregue: destaque do modelo recomendado na biblioteca e no dashboard cliente.
- Validado: recomendacao `std-liquidez-rapida`, auditoria `clone-standard`, matriz recalculada e responsividade desktop/mobile.

### Fase 4N - Trilha assistida de decisao
- Status: entregue.
- Entregue: diagnostico, calculadoras, produtos, modelos recomendados e comparador conectados em uma jornada guiada.
- Entregue: estado da trilha e proxima acao salvos por usuario.
- Entregue: base preparada para handoff consultivo.

### Fase 4O - Handoff consultivo e leads locais
- Status: entregue neste ciclo.
- Entregue: criacao local de lead a partir da trilha assistida, com status, prioridade, checklist, responsavel, notas e auditoria.
- Entregue: pagina `handoff-consultivo.html` para admin/consultor acompanhar a fila.
- Entregue: dashboard admin e dashboard cliente refletem o handoff vinculado a trilha.
- Proximo incremento: funil consultivo com SLA local, etapas comerciais e resumo exportavel sem envio externo.

### Fase 8N - Produtos com selecao assistida
- Status: entregue neste ciclo.
- Entregue: painel `data-products-selection-panel` em `pages/produtos.html`, entre filtros e catalogo.
- Entregue: cards selecionaveis com estado visual, persistencia local por usuario e limite de 4 produtos.
- Entregue: ponte para `pages/comparador.html` por `?preset=manual&products=...`, preservando o fluxo de presets quando nao ha selecao.
- Entregue: Comparador reconhece produtos vindos da URL, ativa colunas da matriz e mostra chips com os nomes selecionados.
- Validado: sintaxe JS, contrato v8 e validacao das 19 calculadoras.
- Proximo incremento: adicionar metricas de microconversao local em Produtos e Comparador para medir selecao, comparacao e simulacao iniciada.

### Fase 8O - Microconversoes locais da jornada
- Status: entregue neste ciclo.
- Entregue: camada `BFJourneyAnalytics` em `assets/js/bf-platform.js`, persistida por usuario em `bf_journey_analytics_v1`.
- Entregue: Produtos mede selecao/remocao, top 3, limpeza e abertura do Comparador.
- Entregue: Comparador mede entrada via produtos, calculo de matriz, salvamento de cenario e abertura de simuladores.
- Entregue: Simuladores leves medem calculos de financiamento, CDC, garantia, consignado e veiculos.
- Entregue: paineis `data-journey-analytics` em Produtos, Comparador e Dashboard Cliente.
- Validado: fluxo Produtos -> Comparador -> Salvar cenario -> Simulador gerou eventos locais e atualizou painel visual no Dashboard Cliente.
- Evidencias: `docs/test-prints/v8o-jornada-analytics-report.json` e prints v8O em `docs/test-prints/`.
- Proximo incremento: criar funil visual por etapa no Dashboard Admin, separando sinais de cliente, consultor e anonimo.

### Fase 8P - Funil administrativo de microconversoes
- Status: entregue neste ciclo.
- Entregue: Dashboard Admin recebeu `data-admin-journey-funnel` e etapa Funil na stagebar.
- Entregue: `BFJourneyAnalytics.all()` consolida eventos de todos os escopos locais.
- Entregue: `BFJourneyAnalytics.roleFunnel()` separa eventos por papel de usuario e por etapa da jornada.
- Entregue: painel administrativo mostra funil por etapa, funil por papel e feed recente com origem do evento.
- Validado: admin enxerga sinais de cliente, consultor, admin e anonimo quando existirem chaves locais.
- Evidencias: `docs/test-prints/v8p-admin-funil-report.json`, `v8p-dashboard-admin-funil-desktop.png` e `v8p-dashboard-admin-funil-mobile.png`.
- Proximo incremento: transformar o funil em alerta operacional com SLA local para leads e abandono de comparador.

### Fase 8Q - Alertas operacionais e SLA local
- Status: entregue neste ciclo.
- Entregue: Dashboard Admin recebeu `data-admin-operational-alerts` e etapa Alertas na stagebar.
- Entregue: `assets/js/admin-users.js` cruza microconversoes locais por origem com handoffs consultivos em aberto.
- Entregue: regras de abandono cobrem selecao sem comparador, comparador sem matriz e matriz sem continuidade.
- Entregue: regras de SLA local cobrem prioridade alta em 4h, media em 24h, baixa em 72h e espera de cliente acima de 48h.
- Entregue: alertas exibem severidade, origem, idade do sinal, contexto e CTA para Produtos, Comparador ou Handoff.
- Atualizado: `tools/validate-design-system.mjs` passou a exigir o novo contrato administrativo.
- Validado: `node --check`, `tools/validate-design-system.mjs`, `tools/validate-calculadoras.mjs` e teste headless desktop/mobile.
- Evidencias: `docs/test-prints/v8q-admin-alertas-report.json`, `v8q-dashboard-admin-alertas-desktop.png` e `v8q-dashboard-admin-alertas-mobile.png`.
- Proximo incremento: criar fila priorizada exportavel para atendimento consultivo, com resumo por responsavel e SLA previsto.

### Backlog Tecnico - Premissas server-side e versionamento
- Criar API para premissas, formulas, logs de aprovacao e publicacao de regras.
- Persistir configuracoes por usuario autenticado quando o backend substituir o `localStorage`.
- Criar trilha de auditoria para mudancas de parametros usados em simulacoes e calculadoras.

### Fase 5 - QA, Deploy e Governanca
- Criar checklist manual de fluxos: home, simulador, salvar/carregar, carteira, assembleias, proposta/PDF.
- Revisar acessibilidade, responsividade e ausencia de 404.
- Gerar novo checkpoint versionado a cada ciclo aceito.
- Criterio de aceite: pacote navegavel, com prints e plano atualizado.

## Riscos e Decisoes

- A base de carteira ainda tem registros demonstrativos para manter densidade visual enquanto nao ha backend de clientes.
- A serie de assembleias ainda e fixa, mas agora esta conectada ao grupo real correspondente.
- O navegador integrado pode falhar por `Acesso negado`; quando isso acontecer, a evidencia visual deve ser gerada por Chrome headless.
- Quando o Chrome/Edge headless nao conseguir gravar PNG direto por `Acesso negado`, usar CDP `Page.captureScreenshot` e gravar o base64 via PowerShell.
