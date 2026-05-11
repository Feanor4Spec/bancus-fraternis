# Contratos Publicos - Bancus Fraternis

Atualizado em 2026-05-11.

Este documento e a matriz viva dos contratos que novas evolucoes devem preservar. O Bancus Fraternis e uma plataforma estatica/progressiva de decisao financeira; por isso, compatibilidade local importa tanto quanto visual e jornada.

## Regra Mestra

- Nao remover ou renomear chaves `localStorage` sem migracao explicita.
- Nao remover marcadores `data-*` cobertos por validadores sem atualizar o validador e o mapa.
- Nao quebrar deep links existentes; novas URLs devem preservar parametros recebidos quando fizer sentido.
- Nao expor senha, CPF, telefone, hash sensivel ou dado pessoal em datasets publicos, analytics compartilhado ou pacotes exportados.
- Toda area autenticada ou operacional publicada deve manter aviso de ambiente demo/local antes de backend real.
- Toda entrega deve atualizar pelo menos um destes artefatos: changelog, plano, mapa, contrato publico ou protocolo de teste.

## Persistencia Local

| Chave | Dono | Uso | Compatibilidade |
| --- | --- | --- | --- |
| `bf_auth_users_v1` | `BFAuth` | Usuarios locais, papeis e status. | Preservar shape de usuario e senha local apenas no prototipo. |
| `bf_auth_session_v1` | `BFAuth` | Sessao local de 8 horas. | Manter leitura tolerante quando sessao expirar. |
| `consorciopro_settings` | `Settings` | Preferencias historicas do simulador. | Nome legado controlado; nao renomear sem migracao. |
| `consorciopro_simulations` | `Storage` / `App` | Simulacoes salvas do simulador completo. | Manter leitura de simulacoes antigas. |
| `bank_fratern_proposal_acceptances_v1` | `BFProposalAcceptance` | Revisoes, aceite local e status de proposta. | Preservar `proposalId`, `status`, `version` e `snapshot`. |
| `bank_fratern_proposal_versions_v1` | `BFProposalVersions` | Snapshots versionados da proposta, lousa, metricas e comparacao antes do handoff. | Preservar `proposalId`, `version`, `sourceHash`, `builder` e `metrics`. |
| `bank_fratern_proposal_builder_v1` | `ProposalSummary` / `App` | Lousa seletiva de exportacao da proposta. | Novas opcoes devem ter default compativel. |
| `bf_financial_profile_v1` | `BFDecisionContext` | Perfil financeiro consolidado. | Sanitizar campos pessoais e preservar campos de prontidao. |
| `bf_calculator_history_v1` | `BFCalculadoras` | Historico de calculadoras e simuladores leves. | Preservar `calculatorSlug`, `historyId` e `profilePatch`. |
| `bf_calculator_premissas_override_v1` | `BFCalculadoras` | Override local de premissas. | Falhar para defaults quando override estiver incompleto. |
| `bf_decision_context_audit_v1` | `BFDecisionContext` | Auditoria local de contexto. | Somente payload sanitizado. |
| `bf_decision_journey_v1:<owner>` | `BFTrilhaDecisaoService` | Trilha ativa por usuario. | Preservar `id`, `owner`, `objective`, `profile`, `nextAction`. |
| `bf_decision_journey_history_v1:<owner>` | `BFTrilhaDecisaoService` | Historico de trilhas por usuario. | Manter tolerancia a itens antigos. |
| `bf_products_selection_v1` | `BFProductsJourney` | Selecao manual de produtos. | Preservar ids e limite operacional. |
| `bf_journey_analytics_v1:<owner>` | `BFJourneyAnalytics` | Microconversoes locais por usuario. | Eventos devem manter `type`, `detail`, `createdAt`. |
| `bf_comparator_favorite_preset_v1` | `BFComparatorModels` | Preset favorito do comparador. | Fallback para preset valido. |
| `bf_comparator_models_v1:<owner>` | `BFComparatorModels` | Modelos locais do comparador. | Preservar versao de formula e premissas. |
| `bf_comparator_model_audit_v1` | `BFComparatorModels` | Auditoria de modelos. | Manter eventos sem dados sensiveis. |
| `bf_consultive_handoffs_v1` | `BFHandoffConsultivoService` | Leads/handoffs locais. | Preservar origem, status, prioridade e checklist. |
| `bf_consultive_handoff_audit_v1` | `BFHandoffConsultivoService` | Auditoria dos handoffs. | Preservar relacao com proposta, trilha ou sinal. |
| `bf_operational_action_states_v1` | `BFHandoffConsultivoService` | Status persistido da fila guiada. | Manter `actionKey`, status, dono, motivo e datas. |
| `bf_operational_action_audit_v1` | `BFHandoffConsultivoService` | Historico de execucao por acao/responsavel. | Nao conter dados sensiveis produtivos. |
| `bf_admin_commercial_stage_states_v1` | Dashboard Admin | Etapa comercial escolhida por lead no funil: contato, proposta, follow-up, negociacao ou fechamento. | Preservar `handoffId`, `stage`, `status`, `updatedAt` e `updatedBy`. |
| `bf_admin_commercial_stage_audit_v1` | Dashboard Admin | Historico local das movimentacoes do funil comercial. | Manter eventos sem dados sensiveis, ligados ao `handoffId`. |
| `bf_admin_recovery_imports_v1` | `BFAdminRecoveryService` | Pacotes importados de retomada. | Pacotes devem continuar sanitizados. |
| `bf_admin_recovery_audit_v1` | `BFAdminRecoveryService` | Auditoria administrativa. | Manter eventos de export/import/roteamento. |
| `bf_admin_recovery_conversion_goals_v1` | `BFAdminRecoveryService` | Metas de conversao por responsavel. | Preservar `assignedTo` e `targetHandoffs`. |

## Marcadores Data

| Area | Marcadores obrigatorios |
| --- | --- |
| Login/Auth | `data-login-form`, `data-login-email`, `data-login-password`, `data-demo-login`. |
| Publicacao demo | `data-public-demo-notice`, `.bf-demo-chip`. |
| Home | `data-home-hero-contextual`, `data-home-continuity-cockpit`, `data-home-next-actions`, `data-journey-analytics`. |
| Produtos | `data-products-grid`, `data-products-filter`, `data-products-selection-panel`, `data-products-compare-link`, `data-products-decision-strip`. |
| Calculadoras | `data-calculator-form`, `data-calculator-result`, `data-calculator-history`, `data-calculators-hub`, `data-calculator-decision-strip`. |
| Trilha | `data-decision-journey-form`, `data-decision-journey-state`, `data-decision-journey-steps`, `data-decision-journey-actions`. |
| Comparador | `data-comparator-form`, `data-comparator-result`, `data-comparator-preset-summary`, `data-comparator-model-recommendation`. |
| Simulador | `data-simulator-readiness`, `data-simulator-decision-strip`, `data-v8-stagebar`, `data-shelf-col`. |
| Proposta | `data-proposal-acceptance-panel`, `data-proposal-handoff-bridge`, `data-proposal-builder-board`, `data-proposal-builder-readiness`, `data-proposal-builder-option`, `data-proposal-version-panel`, `data-proposal-version-history`, `data-proposal-version-comparison`. |
| Handoff | `data-handoff-list`, `data-handoff-detail`, `data-handoff-metrics`, `data-handoff-recovery-signals`, `data-handoff-consultant-cockpit`, `data-handoff-action-plan`, `data-handoff-action-execution`, `data-handoff-action-reason`, `data-handoff-action-history`, `data-handoff-assignee-filter`, `data-handoff-aging-filter`, `data-handoff-proposal-version`, `data-handoff-commercial-stage`, `data-handoff-commercial-stage-panel`, `data-handoff-commercial-stage-history`. |
| Dashboard Cliente | `data-client-continuity-strip`, `data-client-continuity-cockpit`, `data-client-next-action`, `data-client-handoff-status`, `data-client-proposal-status`, `data-client-simulation-context`, `data-client-commercial-stage`, `data-client-continuity-timeline`, `data-client-decision-journey`, `data-client-recovery-signals`. |
| Dashboard Admin | `data-admin-next-actions`, `data-admin-action-queue`, `data-admin-action-execution`, `data-admin-action-reason`, `data-admin-action-history`, `data-admin-action-owner-history`, `data-admin-consultant-productivity`, `data-admin-consultant-productivity-row`, `data-admin-consultant-portfolio`, `data-admin-consultant-portfolio-row`, `data-admin-consultant-portfolio-lead`, `data-admin-consultant-portfolio-filters`, `data-admin-portfolio-filter`, `data-admin-consultant-portfolio-export`, `data-admin-consultant-portfolio-priority`, `data-admin-consultant-portfolio-priority-lead`, `data-admin-commercial-pipeline`, `data-admin-commercial-stage`, `data-admin-commercial-lead`, `data-admin-commercial-stage-select`, `data-admin-commercial-stage-history`, `data-admin-commercial-stage-insights`, `data-admin-commercial-stage-movement`, `data-admin-commercial-stage-stuck-lead`, `data-admin-commercial-stage-summary`, `data-admin-source-funnel`, `data-admin-bottleneck-board`, `data-admin-journey-funnel`, `data-admin-operational-alerts`, `data-admin-recovery-queue`, `data-admin-recovery-packages`. |
| Lousa navegavel | `data-lousa-journey-checklist`, `data-lousa-journey-acceptance`. |
| Shell v8 | `data-v8-stagebar`, `data-bf-visual-version`, `data-shell-header`, `data-shell-footer`, `data-bf-page`. |

## Exports Globais

| Export | Papel publico |
| --- | --- |
| `BFAuth` | Autenticacao, usuarios locais e guardas por papel. |
| `Settings` | Preferencias historicas do simulador. |
| `BFHome` | Home contextual e continuidade. |
| `BFDecisionContext` | Perfil financeiro, historico e prefill de simulacao. |
| `BFCalculadoras` | Catalogo, calculo e historico das 19 calculadoras. |
| `BFCalculatorJourney` | Deep links de calculadoras para jornada. |
| `BFFinancialFormulas`, `BFPriceFormulas`, `BFSacFormulas`, `BFConsorcioFormulas`, `BFComparisonFormulas` | Formulas reutilizadas. |
| `BFDadosService` | Carga de datasets locais. |
| `BFProductsJourney` | Produtos, selecao e analytics de jornada. |
| `BFComparadorService`, `BFComparatorModels` | Comparador, modelos, auditoria e presets. |
| `BFTrilhaDecisaoService`, `BFDecisionJourneyContext` | Trilha assistida, contexto de entrada e saida. |
| `BFModelosRecomendacaoService` | Recomendacao de modelos do comparador. |
| `BFHandoffConsultivoService` | Handoff por proposta, trilha, sinal, pacote ou manual. |
| `BFJourneyRecoveryService`, `BFAdminRecoveryService` | Sinais de retomada, pacotes, roteamento e metas. |
| `BFProposalAcceptance` | Revisao local, aceite e versionamento da proposta. |
| `BFProposalVersions` | Historico versionado, snapshots comparaveis e hash local da proposta antes de PDF/handoff. |
| `ProposalSummary` | Renderizacao da proposta/PDF e lousa seletiva. |
| `BankFraternProgress` | Progresso/loader do simulador. |
| `BFCards`, `BFTables`, `BFAlerts`, `BFCharts`, `BFTooltips`, `BFFormatters` | Componentes e utilitarios visuais. |

## Deep Links

| Origem | Parametros preservados | Destinos principais |
| --- | --- | --- |
| Home | `from=home`, `journeyId`, `calculatorSlug`, `historyId` | Trilha, simulador, dashboard. |
| Produtos | `from=products`, `productId`, `preset`, `products` | Comparador, Trilha, simuladores. |
| Calculadoras | `from=calculator|calculators`, `calculatorSlug`, `historyId`, `preset` | Trilha, Comparador, Simulador, Dashboard. |
| Trilha | `from=journey`, `sourceFrom`, `productId`, `calculatorSlug`, `historyId`, `preset`, `journeyId`, `products` | Comparador, modelos, dashboard, handoff. |
| Comparador | `from=comparator`, `preset`, `products`, `modelo` | Simuladores, modelos, dashboard. |
| Simulador | `from`, `sourceFrom`, `productId`, `calculatorSlug`, `historyId`, `journeyId`, `simulationId` | Proposta, carteira, handoff. |
| Dashboard Cliente | `from=dashboard`, `journeyId`, `calculatorSlug`, `historyId`, `handoffId` | Retomada da jornada. |
| Dashboard Admin | `from=lousa|admin`, ancoras `admin-proximos-passos`, `admin-fila-acao`, `admin-carteira-consultor`, `admin-funil-comercial`, `admin-origens`, `admin-gargalos` | Handoff, pacotes, carteira por consultor, funil comercial e auditoria. |
| Lousa navegavel | `from=lousa`, ancoras `roteiro-navegavel`, `home-cockpit`, `produtos-selecao`, `trilha-acoes`, `database-status-panel`, `proposal-builder-board` | Teste ponta a ponta e QA de jornada. |

## Validadores Obrigatorios

| Validador | Protege |
| --- | --- |
| `tools/validate-public-contracts.mjs` | Este documento, contratos publicos e DoD. |
| `tools/validate-public-release-safety.mjs` | Exposicao publica, paths locais, dados pessoais de exemplo, aviso demo, fallback estatico e CI. |
| `tools/validate-docs-modernization.mjs` | README ativo, docs historicos e contagem atual de 19 calculadoras. |
| `tools/validate-auth-navigation.mjs` | Login local, seed users, redirect seguro e bloqueio por papel. |
| `tools/validate-navigable-journey.mjs` | Roteiro ponta a ponta da lousa, links, marcadores e contratos de QA de jornada. |
| `tools/validate-online-journey-smoke.mjs` | Smoke test online do GitHub Pages cobrindo as 10 etapas navegaveis da lousa. |
| `tools/validate-github-pages-deploy.mjs` | Deploy publico no GitHub Pages, marca Bancus Fraternis, lousa, simulador e base real online. |
| `tools/validate-design-system.mjs` | Contrato visual, referencias, paginas ativas e validadores obrigatorios. |
| `tools/validate-route-aliases.mjs` | Paridade de 52 paginas e aliases curtos. |
| `tools/validate-calculadoras.mjs` | Catalogo atual de 19 calculadoras, premissas e golden tests. |
| `tools/validate-simulator-groups.mjs` | Base real do simulador: 17.396 grupos validos. |
| `tools/validate-simulator-performance.mjs` | Base compacta do simulador, peso online e fallback para JSON legado. |
| `tools/validate-proposal-builder.mjs` | Lousa seletiva de proposta/PDF. |
| `tools/validate-proposal-versioning.mjs` | Historico versionado da proposta e comparacao antes do handoff. |
| `tools/validate-proposal-acceptance.mjs` | Revisao e aceite local da proposta. |
| `tools/validate-proposal-handoff.mjs` | Proposta revisada para handoff. |
| `tools/validate-handoff-origins.mjs` | Origem dos handoffs. |
| `tools/validate-handoff-consultant-operations.mjs` | Aging, SLA, prioridade, responsavel e proximas acoes do consultor. |
| `tools/validate-dashboard-continuity-flow.mjs` | Continuidade do Dashboard Cliente. |
| `tools/validate-admin-dashboard-source-funnel.mjs` | Cockpit Admin, origem, gargalos e proximas acoes. |
| `tools/validate-admin-recovery-*.mjs` | Fila admin, filtros, exportacao, pacotes, SLA, roteamento e metas. |

## Definition Of Done

Uma entrega de jornada so deve ser considerada pronta quando:

1. O fluxo navegavel foi atualizado ou preservado.
2. Os contratos `localStorage`, `data-*`, deep links e `window.BF*` afetados foram revisados.
3. Existe validador ou teste recomendado para o risco principal.
4. `docs/CHANGELOG.md` recebeu a versao da entrega.
5. `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` foi atualizado quando o status da fase mudou.
6. O mapa ou este contrato publico foi atualizado quando surgiu novo contrato.
7. O teste visual foi feito quando a mudanca altera UI, desktop/mobile ou navegacao.
8. Mudancas publicadas em GitHub Pages devem passar por `tools/validate-public-release-safety.mjs`.
