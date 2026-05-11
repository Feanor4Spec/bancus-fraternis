# Mapa Completo do Projeto Bancus Fraternis

Atualizado em 2026-05-07.

Este mapa foi recriado a partir da leitura real do workspace. Ele documenta o Bancus Fraternis como plataforma de decisao financeira, nao apenas como simulador de consorcio. O objetivo e permitir que uma pessoa ou agente entenda a superficie atual do produto antes de evoluir Home, produtos, calculadoras, trilha assistida, comparador, simulador, proposta, handoff, dashboard cliente e dashboard admin.

## Sumario Executivo

O projeto e uma aplicacao web estatica/progressiva em HTML, CSS e JavaScript puro. A plataforma usa dados locais em JSON, base real de grupos de consorcio em `data_base/`, persistencia por `localStorage`, services globais no browser e validadores Node em `tools/`.

Estado confirmado nesta leitura:

- 52 paginas HTML em `pages/`.
- 19 calculadoras no catalogo `assets/data/calculadoras.json`.
- 6 produtos financeiros no catalogo `assets/data/produtos.json`.
- 15 services em `assets/js/services/`.
- 5 arquivos de formulas em `assets/js/formulas/`.
- 5 componentes em `assets/js/components/`.
- 20 scripts de validacao/evidencia em `tools/`.
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
| `server.js` | Servidor canonico local. Usa porta `8080` por padrao, serve `/` como `pages/index.html` e cria aliases curtos para todas as paginas HTML em `pages/`. |
| `js/server.js` | Servidor legado do simulador antigo. Mantido como historico tecnico, nao como entrada principal. |
| `Sistema.gitignore` | Ignora editor, node, python, envs, chaves e temporarios. |

Contrato confirmado:

- `server.js` tem 52 aliases para 52 paginas.
- Todas as paginas continuam acessiveis por `/pages/<arquivo>.html`.
- Todas as paginas tambem respondem por URL curta, como `/trilha-decisao.html`.
- O contrato e coberto por `tools/validate-route-aliases.mjs`.

## Estrutura de Diretorios

| Diretorio | Tipo | Conteudo |
| --- | --- | --- |
| `pages/` | Ativo | Superficie navegavel principal da plataforma. |
| `js/` | Ativo e legado | Simulador completo, auth, storage, settings, home, proposta, carteira e motores originais. |
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
| `pages/lousa-navegacao.html` | Ativa | Lousa navegavel da jornada, status, roteiro de QA ponta a ponta e proximos ciclos. |

### Autenticacao, Configuracoes e Operacao

| Pagina | Estado | Conteudo |
| --- | --- | --- |
| `pages/login.html` | Ativa | Login local com perfis demo. |
| `pages/configuracoes.html` | Ativa | Preferencias locais do simulador e plataforma. |
| `pages/dashboard-cliente.html` | Ativa | Historico, perfil, modelos, trilha, sinais e handoff do usuario. |
| `pages/dashboard-admin.html` | Ativa | Usuarios, recuperacao, pacotes, SLA, roteamento, metas, auditoria, funil, fila guiada executavel, produtividade, carteira por consultor e funil comercial por etapa. |

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
| `pages/simulador.html` | Ativa | Simulador completo de consorcio, prateleira com 17.396 grupos validos, projeto estruturado, proposta, aceite e handoff. |
| `pages/simulador-consorcio.html` | Ativa | Porta de entrada para o simulador completo de consorcio. |
| `pages/simulador-financiamento.html` | Ativa | Simulacao de financiamento com Price/SAC. |
| `pages/simulador-veiculos.html` | Ativa | Comparacao de veiculo por financiamento ou consorcio. |
| `pages/simulador-cdc.html` | Ativa | Simulacao de CDC, parcela, tarifas e custo total. |
| `pages/simulador-garantia.html` | Ativa | Credito com garantia, LTV, limite e custo total. |
| `pages/simulador-consignado.html` | Ativa | Consignado, margem, elegibilidade e custo total. |

### Calculadoras

Todas usam o mesmo padrao de pagina e o motor `assets/js/calculadoras-page.js`.

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
| `pages/handoff-consultivo.html` | Ativa | Painel consultivo de leads locais com plano de acao executavel por lead. |
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
  -> resultado + recomendacao
  -> perfil consolidado
  -> historico
  -> simulador, comparador ou dashboard cliente
```

Contratos principais: `data-calculator-form`, `data-calculator-result`, `BFCalculadoras`, `BFFinancialFormulas`, `BFDecisionContext`, `BFCalculatorJourney`, deep links com `from=calculator|calculators`, `calculatorSlug`, `historyId` e `preset`.

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
  -> prateleira de grupos
  -> projeto estruturado
  -> calculo e graficos
  -> proposta espelhada no PDF
  -> aceite/revisao local
  -> versionamento e comparacao da proposta
  -> handoff consultivo de proposta
```

Contratos principais: `data-simulator-readiness`, `data-proposal-acceptance-panel`, `data-proposal-version-panel`, `data-proposal-handoff-bridge`, `App`, `ConsorcioEngine`, `ProposalSummary`, `BFProposalAcceptance`, `BFProposalVersions`, `BFHandoffConsultivoService`.

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
- A Trilha Assistida passou a expor `BFDecisionJourneyContext`, reconhecer contexto vindo de Produtos/Calculadoras e sair com `from=journey` preservando a origem anterior em `sourceFrom`.
- Dashboard Cliente passou a usar `from=dashboard` na continuidade, com linha do tempo Diagnostico -> Calculadora -> Trilha -> Comparador -> Simulacao -> Proposta -> Handoff.
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
- O painel consultivo filtra por origem e mostra badge/resumo da origem nos cards e no detalhe.
- O dashboard admin mostra metricas de propostas e trilhas na fila de handoff.
- O contrato e coberto por `tools/validate-handoff-origins.mjs`.

## Modulos JavaScript

### Nucleo em `js/`

| Arquivo | Responsabilidade |
| --- | --- |
| `js/app.js` | Controlador principal do simulador completo. Concentra wizard, prateleira, projeto estruturado, calculo, proposta, aceite, handoff e salvamento. |
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
| `js/storage.js` | Simulacoes salvas e estatisticas de carteira. |
| `js/settings.js` | Preferencias locais e defaults. |
| `js/auth.js` | Usuarios locais, sessao, papeis e guardas. |
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
| `assets/js/admin-users.js` | Admin, usuarios, funil, recuperacao, pacotes, SLA, metas e auditoria. |
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
| Calculadoras | `data-calculator-form`, `data-calculator-result`, `data-calculator-history`, `data-calculators-hub`. |
| Trilha | `data-decision-journey-form`, `data-decision-journey-state`, `data-decision-journey-steps`, `data-decision-journey-actions`. |
| Comparador | `data-comparator-form`, `data-comparator-result`, `data-comparator-preset-summary`, `data-comparator-model-recommendation`. |
| Simulador | `data-simulator-readiness`, `data-simulator-decision-strip`, `data-shelf-col`. |
| Proposta | `data-proposal-acceptance-panel`, `data-proposal-handoff-bridge`, `data-proposal-builder-board`, `data-proposal-builder-readiness`, `data-proposal-builder-option`, `data-proposal-version-panel`, `data-proposal-version-history`, `data-proposal-version-comparison`. |
| Handoff | `data-handoff-list`, `data-handoff-detail`, `data-handoff-metrics`, `data-handoff-recovery-signals`, `data-handoff-action-plan`, `data-handoff-action-execution`, `data-handoff-proposal-version`. |
| Cliente | `data-client-continuity-strip`, `data-client-decision-journey`, `data-client-recovery-signals`. |
| Admin | `data-admin-next-actions`, `data-admin-action-queue`, `data-admin-action-execution`, `data-admin-action-owner-history`, `data-admin-consultant-productivity`, `data-admin-consultant-portfolio`, `data-admin-consultant-portfolio-lead`, `data-admin-consultant-portfolio-filters`, `data-admin-consultant-portfolio-export`, `data-admin-consultant-portfolio-priority`, `data-admin-commercial-pipeline`, `data-admin-commercial-stage`, `data-admin-commercial-lead`, `data-admin-commercial-stage-select`, `data-admin-commercial-stage-history`, `data-admin-commercial-stage-insights`, `data-admin-commercial-stage-movement`, `data-admin-commercial-stage-stuck-lead`, `data-admin-commercial-stage-summary`, `data-admin-source-funnel`, `data-admin-bottleneck-board`, `data-admin-recovery-queue`, `data-admin-recovery-packages`, `data-admin-journey-funnel`, `data-admin-operational-alerts`. |
| Lousa | `data-lousa-journey-checklist`, `data-lousa-journey-acceptance`. |
| V8 | `data-v8-stagebar`, `data-bf-visual-version`, `data-shell-header`, `data-shell-footer`. |

### Exports globais

Exports principais confirmados:

`BFAuth`, `Settings`, `BFHome`, `BFDecisionContext`, `BFCalculadoras`, `BFCalculatorJourney`, `BFFinancialFormulas`, `BFDadosService`, `BFProductsJourney`, `BFComparadorService`, `BFComparatorModels`, `BFTrilhaDecisaoService`, `BFDecisionJourneyContext`, `BFModelosRecomendacaoService`, `BFHandoffConsultivoService`, `BFJourneyRecoveryService`, `BFAdminRecoveryService`, `BFProposalAcceptance`, `BFProposalVersions`, `BankFraternProgress`.

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
| `validate-handoff-origins.mjs` | Origem dos handoffs por proposta, trilha, sinal e pacote importado. |
| `validate-calculadoras.mjs` | Catalogo, paginas, premissas e formulas. |
| `validate-dashboard-continuity-flow.mjs` | Timeline e deep links do Dashboard Cliente. |
| `validate-decision-flow.mjs` | Fluxo calculadora -> simulador -> historico. |
| `validate-decision-journey-context.mjs` | Contexto de entrada e saida da Trilha Assistida. |
| `validate-product-journey-flow.mjs` | Produtos, eventos de jornada e deep links contextuais. |
| `validate-home-continuity-cockpit.mjs` | Cockpit de continuidade, incluindo trilha ativa e deep link da proxima acao. |
| `validate-home-contextual-hero.mjs` | Hero contextual, incluindo estado de trilha ativa. |
| `validate-proposal-acceptance.mjs` | Aceite da proposta. |
| `validate-proposal-versioning.mjs` | Versionamento e comparacao local da proposta. |
| `validate-proposal-handoff.mjs` | Proposta -> handoff. |
| `validate-recovery-signals-flow.mjs` | Sinais de retomada. |
| `validate-handoff-consultant-operations.mjs` | Handoff do consultor com aging, SLA, prioridade, responsavel e proximas acoes. |
| `validate-admin-recovery-*.mjs` | Fila, filtros, pacotes, operacao, SLA, roteamento e metas. |
| `validate-admin-dashboard-source-funnel.mjs` | Cockpit Admin, origem, gargalos e proximas acoes. |
| `validate-public-contracts.mjs` | Matriz de contratos publicos, DoD e governanca de compatibilidade. |
| `validate-public-release-safety.mjs` | Publicacao segura: paths locais, dados pessoais de exemplo, selo demo, fallback estatico e CI. |
| `validate-docs-modernization.mjs` | README ativo, docs historicos marcados e catalogo atual de 19 calculadoras. |
| `run-v8af-browser-evidence.mjs` | Evidencias visuais do fluxo proposta/handoff. |

## Documentacao Existente

| Documento | Uso |
| --- | --- |
| `docs/README.md` | Porta atual do Bancus Fraternis, com rotas, estado do produto, validadores e contratos preservados. |
| `docs/CHANGELOG.md` | Historico ate v8.51. |
| `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md` | Evolucao detalhada de fases v8. |
| `docs/PLANO_SALTO_PLATAFORMA_BANK_FRATERN.md` | Salto de simulador para plataforma. |
| `docs/DESIGN_SYSTEM_V8_BANK_FRATERN.md` | Contrato visual v8. |
| `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` | Contratos publicos de localStorage, data markers, deep links, exports globais e DoD. |
| `docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md` | Ecossistema de calculadoras. |
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
9. Considerar performance ao tocar na base grande `data_base/Tab_Grupos_Consorcio.json`; regenerar e validar `data_base/Tab_Grupos_Consorcio.compact.json` quando a base canonica mudar.

## Proximos Vetores

O vetor recomendado para o proximo ciclo e produto e jornada:

1. Revisar CTAs e links de continuidade usando os aliases agora cobertos.
2. Fortalecer continuidade Home -> Produtos -> Calculadoras -> Trilha -> Comparador -> Simulador.
3. Expandir a leitura operacional de origem dos handoffs para funil e aging no dashboard admin.
4. Melhorar dashboards de cliente, consultor e admin com funil, prioridade e proximos passos.
5. Padronizar governanca de entrega com validadores, changelog e plano de acao.

O plano detalhado esta em `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md`.
