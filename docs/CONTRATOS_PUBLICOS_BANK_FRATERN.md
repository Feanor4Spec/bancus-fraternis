# Contratos Publicos - Bancus Fraternis

Atualizado em 2026-08-22.

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
| `bf_auth_users_v1` | `BFAuth` | Usuarios demonstrativos, papeis e status. | Existe apenas em `demo`; `production` remove esta chave. |
| `bf_auth_session_v1` | `BFAuth` | Sessao visual demonstrativa ou usuario publico da aba produtiva. | Nunca armazenar token ou hash produtivo. |
| `bf_backend_session_v1` | `BFBackendApi` | Bearer exclusivo do modo demo/local. | `production` remove a chave e usa cookie `HttpOnly`. |
| `bf_auth_mode_v1` | `BFAuth` / `BFBackendApi` | Cache publico de modo e transporte informado por `/api/auth/config`. | Pode conter apenas configuracao nao sensivel. |
| `consorciopro_settings` | `Settings` | Preferencias historicas do simulador, incluindo `pageSize` da prateleira normalizado entre 20 e 50. | Nome legado controlado; nao renomear sem migracao. |
| `consorciopro_simulations` | `Storage` / `App` | Simulacoes salvas do simulador completo. | Manter leitura de simulacoes antigas. |
| `bf_group_return_state_v1:<token>` | `BFGroupJourney` | Snapshot temporario da prateleira, carrinho, formulario e calculo antes de abrir a Visao 360. | `sessionStorage`, TTL de 30 minutos, maximo de oito estados e descarte apos o retorno. |
| `bf_group_active_return_v1` | `BFGroupJourney` | Token do retorno ativo da Visao 360. | Deve apontar apenas para token valido e ser removido com o estado consumido. |
| `bf_group_selection_v1:<token>` | Visao 360 / `App` | Selecao sanitizada do grupo usada no retorno ao simulador. | `sessionStorage`; a selecao e reconstruida pelo simulador e nao pode duplicar o mesmo `groupKey`. |
| `bf_group_compare_intent_v1` | Visao 360 / `BFGroupComparisonJourney` | Intencao temporaria de comparar um grupo especifico ao retornar ao simulador. | `sessionStorage`, TTL de 30 minutos e consumo unico apos selecionar o grupo-alvo. |
| `bank_fratern_proposal_acceptances_v1` | `BFProposalAcceptance` | Revisoes, aceite local e status de proposta. | Preservar `proposalId`, `status`, `version` e `snapshot`. |
| `bank_fratern_proposal_versions_v1` | `BFProposalVersions` | Snapshots versionados da proposta, lousa, metricas e comparacao antes do handoff. | Preservar `proposalId`, `version`, `sourceHash`, `builder` e `metrics`. |
| `bank_fratern_proposal_builder_v1` | `BFProposalBuilder` / `ProposalSummary` / `App` | Lousa seletiva de exportacao da proposta. | Novas opcoes devem ter default compativel. |
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
| Calculadoras | `data-calculator-form`, `data-calculator-form-alert`, `data-calculator-coherence`, `data-calculator-coherence-alert`, `data-calculator-field`, `data-calculator-field-error`, `data-calculator-field-origin`, `data-calculator-field-source`, `data-calculator-field-source-key`, `data-calculator-saved-comparison`, `data-calculator-saved-comparison-item`, `data-calculator-impact-panel`, `data-calculator-impact-score`, `data-calculator-impact-risk`, `data-calculator-impact-next-step`, `data-calculator-impact-source`, `data-calculator-next-action`, `data-calculator-next-action-card`, `data-calculator-profile-continuity`, `data-calculators-profile-continuity`, `data-calculator-result`, `data-calculator-result-mode`, `data-calculator-history`, `data-calculators-hub`, `data-calculator-decision-strip`. |
| Trilha | `data-decision-journey-form`, `data-decision-journey-state`, `data-decision-journey-steps`, `data-decision-journey-actions`. |
| Comparador | `data-comparator-form`, `data-comparator-result`, `data-comparator-preset-summary`, `data-comparator-model-recommendation`. |
| Simulador | `data-simulator-readiness`, `data-simulator-decision-strip`, `data-simulator-journey-actions`, `data-simulator-objective-guide`, `data-simulator-objective-card`, `data-simulator-objective-apply`, `data-simulator-result-decision`, `data-simulator-result-cta`, `data-simulator-result-premise`, `data-simulator-result-risk`, `data-simulator-result-comparison`, `data-group-comparison-guide`, `data-comparison-title`, `data-comparison-copy`, `data-comparison-progress`, `data-comparison-selected`, `data-comparison-live`, `data-comparison-primary`, `data-comparison-add-more`, `data-comparison-quick-note`, `data-comparison-status`, `data-comparison-back`, `data-comparison-next`, `data-comparison-next-label`, `data-v8-stagebar`, `data-shelf-col`, `data-shelf-recommendation`, `data-shelf-recommendation-reason`. |
| Visao 360 do Grupo | `data-group-state`, `data-group-loading`, `data-group-error`, `data-group-empty`, `data-group-content`, `data-history-ready`, `data-history-empty`, `data-use-group`, `data-compare-group`, `data-assembly-drawer`, `data-operational-section`, `data-operational-mode`, `data-operational-value`, `data-operational-support`, `data-operational-status`, `data-operational-live`, `data-operational-health`, `data-operational-definitions`. |
| Proposta | `data-proposal-acceptance-panel`, `data-proposal-handoff-bridge`, `data-proposal-builder-board`, `data-proposal-builder-readiness`, `data-proposal-builder-option`, `data-proposal-version-panel`, `data-proposal-version-history`, `data-proposal-version-comparison`. |
| Handoff | `data-handoff-list`, `data-handoff-detail`, `data-handoff-metrics`, `data-handoff-recovery-signals`, `data-handoff-consultant-cockpit`, `data-handoff-action-plan`, `data-handoff-action-execution`, `data-handoff-action-reason`, `data-handoff-action-history`, `data-handoff-assignee-filter`, `data-handoff-aging-filter`, filtro de origem com opcao `calculator`, `data-handoff-proposal-version`, `data-handoff-commercial-stage`, `data-handoff-commercial-stage-panel`, `data-handoff-commercial-stage-history`, `data-handoff-live-data-panel`, `data-handoff-live-source`, `data-handoff-live-refresh`. |
| Dashboard Cliente | `data-client-continuity-strip`, `data-client-continuity-cockpit`, `data-client-backend-snapshots`, `data-client-backend-entities`, `data-client-backend-materialized`, `data-client-live-data-panel`, `data-client-live-source`, `data-client-live-refresh`, `data-client-next-action`, `data-client-calculator-impact`, `data-client-calculator-impact-item`, `data-client-calculator-impact-risk`, `data-client-calculator-impact-action`, `data-client-create-calculator-handoff`, `data-client-handoff-status`, `data-client-proposal-status`, `data-client-simulation-context`, `data-client-commercial-stage`, `data-client-continuity-timeline`, `data-client-decision-journey`, `data-client-recovery-signals`. |
| Dashboard Admin | `data-admin-next-actions`, `data-admin-action-queue`, `data-admin-action-execution`, `data-admin-action-reason`, `data-admin-action-history`, `data-admin-action-owner-history`, `data-admin-consultant-productivity`, `data-admin-consultant-productivity-row`, `data-admin-consultant-portfolio`, `data-admin-consultant-portfolio-row`, `data-admin-consultant-portfolio-lead`, `data-admin-consultant-portfolio-filters`, `data-admin-portfolio-filter`, `data-admin-consultant-portfolio-export`, `data-admin-consultant-portfolio-priority`, `data-admin-consultant-portfolio-priority-lead`, `data-admin-commercial-pipeline`, `data-admin-commercial-pipeline-export`, `data-admin-commercial-stage`, `data-admin-commercial-lead`, `data-admin-commercial-stage-select`, `data-admin-commercial-stage-history`, `data-admin-commercial-stage-insights`, `data-admin-commercial-stage-movement`, `data-admin-commercial-stage-stuck-lead`, `data-admin-commercial-stage-summary`, `data-admin-source-funnel`, `data-admin-bottleneck-board`, `data-admin-backend-events`, `data-admin-backend-event`, `data-admin-backend-snapshots`, `data-admin-backend-snapshot`, `data-admin-backend-entities`, `data-admin-backend-entity`, `data-admin-backend-materialized`, `data-admin-backend-materialized-item`, `data-admin-backend-materialized-control`, `data-admin-backend-materialized-field`, `data-admin-backend-materialized-save`, `data-admin-dedicated-queue`, `data-admin-dedicated-queue-filters`, `data-admin-dedicated-queue-filter`, `data-admin-dedicated-queue-summary`, `data-admin-dedicated-queue-item`, `data-admin-dedicated-queue-clear`, `data-admin-backend-table`, `data-admin-backend-database-provider`, `data-admin-backend-event-refresh`, `data-admin-local-import-panel`, `data-admin-local-import-preview`, `data-admin-local-import-run`, `data-admin-local-import-result`, `data-admin-local-snapshot-count`, `data-admin-journey-funnel`, `data-admin-operational-alerts`, `data-admin-recovery-queue`, `data-admin-recovery-packages`. |
| Lousa navegavel | `data-lousa-commercial-qa`, `data-lousa-qa-checkpoint`, `data-lousa-journey-checklist`, `data-lousa-journey-acceptance`, `data-lousa-github-map`, `data-lousa-github-journey`. |
| Shell v8 | `data-v8-stagebar`, `data-bf-visual-version`, `data-shell-header`, `data-shell-footer`, `data-bf-page`. |

## Schemas De Exportacao

| Schema | Acionador | Garantia publica |
| --- | --- | --- |
| `bank-fratern.admin-consultant-portfolio.v1` | `data-admin-consultant-portfolio-export` | Carteira por consultor sanitizada, sem e-mail, CPF ou telefone no JSON final. |
| `bank-fratern.admin-commercial-pipeline.v1` | `data-admin-commercial-pipeline-export` | Funil/cadencia com leads anonimizados, totais por etapa, leads parados e movimentacoes recentes, sem expor `handoffId`, cliente, e-mail, CPF, telefone ou link interno. |

## API Local Node/SQLite

| Endpoint | Uso | Compatibilidade |
| --- | --- | --- |
| `GET /api/health` | Verifica API local, schema `bancus-fraternis.local-db.v1` e estatisticas agregadas. | Deve responder sem autenticacao. |
| `GET /api/database/status` | Retorna provider, driver, arquivos SQLite, PRAGMAs, tabelas e runtime local. | Exige papel `admin`; nao deve ser usado em publicacao estatica. |
| `POST /api/database/import-local` | Previsualiza ou executa importacao guiada de usuarios, eventos e snapshots do `localStorage` para SQLite. | Exige papel `admin`; deve ser idempotente, sem sobrescrever usuarios/eventos e atualizando snapshots pelo mesmo `id`. |
| `GET /api/auth/config` | Informa `demo` ou `production`, transporte, duracao e politica publica de senha. | Nao retorna conta, token ou segredo. |
| `POST /api/auth/login` | Autentica e cria sessao server-side. | Em `production`, a API e autoridade unica, usa cookie `HttpOnly` e nao retorna token no JSON. |
| `POST /api/auth/logout` | Revoga a sessao apresentada e limpa o cookie produtivo. | Deve limpar tambem os estados publicos do navegador. |
| `POST /api/auth/logout-all` | Revoga todas as sessoes do usuario. | Aceita a sessao restrita de primeiro acesso. |
| `POST /api/auth/change-password` | Troca a senha temporaria, revoga sessoes e cria uma nova. | Exige senha atual e politica produtiva; nunca ecoa senha ou token. |
| `GET /api/auth/me` | Retorna somente usuario e metadados publicos da sessao. | Exige bearer em demo ou cookie em producao. |
| `GET /api/users` | Lista usuarios publicos do banco local. | Exige papel `admin`; nunca retornar hash, salt ou senha. |
| `POST /api/users` | Cria usuario com senha hasheada via `scrypt-sha256`. | Exige papel `admin`; aceitar `id` para espelhamento do `localStorage`. |
| `PATCH /api/users/:id` | Atualiza nome, e-mail, papel, status, area e telefone. | Exige papel `admin`; senha e opcional. |
| `POST /api/users/:id/password` | Redefine senha no banco local. | Exige papel `admin`; resposta nao deve ecoar senha. |
| `POST /api/users/:id/status` | Ativa ou inativa usuario e revoga sessoes quando inativado. | Exige papel `admin`; nao permitir auto-inativacao. |
| `DELETE /api/users/:id` | Remove usuario e sessoes vinculadas. | Exige papel `admin`; nao permitir auto-exclusao. |
| `POST /api/events` | Grava evento autenticado e sanitizado de jornada, handoff, proposta ou modelos. | Origem e horario sao server-side; tipos reservados de auth/admin nao podem ser forjados pelo cliente. |
| `GET /api/events` | Lista ultimos eventos locais. | Exige papel `admin`. |
| `POST /api/snapshots` | Cria ou atualiza snapshot sanitizado de simulacao, trilha, proposta, lousa, perfil, modelos ou handoff. | Exige bearer token; admin pode informar dono, demais papeis gravam no proprio `owner_email`. |
| `GET /api/snapshots` | Lista snapshots recentes, com filtro opcional por `type`. | Exige bearer token; `admin` ve todos e demais papeis recebem apenas snapshots do proprio `owner_email`. |
| `GET /api/journey-entities` | Lista entidades relacionais derivadas dos snapshots (`lead`, `simulation`, `proposal`), com filtro opcional por `kind`. | Exige bearer token; `admin` ve tudo e demais papeis recebem apenas entidades do proprio `owner_email`. |
| `GET /api/leads` | Lista leads materializados em tabela dedicada a partir de snapshots de handoff. | Exige bearer token; `admin` ve tudo e demais papeis recebem apenas leads do proprio `owner_email`. |
| `POST /api/leads` | Cria ou atualiza lead diretamente em `journey_leads` e `journey_entities`. | Exige bearer token; admin pode informar dono, demais papeis gravam apenas no proprio `owner_email`; payload sensivel deve ser removido. |
| `GET /api/leads/:id` | Retorna lead pontual da tabela dedicada. | Exige bearer token; admin ve qualquer lead, demais papeis apenas registros proprios. |
| `PATCH /api/leads/:id` | Atualiza lead pontual sem trocar dono indevidamente. | Exige bearer token; cliente/consultor nao podem atualizar registro de outro `owner_email`. |
| `GET /api/simulations` | Lista simulacoes materializadas em tabela dedicada a partir de snapshots de simulacao. | Exige bearer token; `admin` ve tudo e demais papeis recebem apenas simulacoes do proprio `owner_email`. |
| `POST /api/simulations` | Cria ou atualiza simulacao diretamente em `journey_simulations` e `journey_entities`. | Exige bearer token; admin pode informar dono, demais papeis gravam apenas no proprio `owner_email`; payload sensivel deve ser removido. |
| `GET /api/simulations/:id` | Retorna simulacao pontual da tabela dedicada. | Exige bearer token; admin ve qualquer simulacao, demais papeis apenas registros proprios. |
| `PATCH /api/simulations/:id` | Atualiza simulacao pontual sem trocar dono indevidamente. | Exige bearer token; cliente/consultor nao podem atualizar registro de outro `owner_email`. |
| `GET /api/proposals` | Lista propostas materializadas em tabela dedicada a partir de snapshots de proposta. | Exige bearer token; `admin` ve tudo e demais papeis recebem apenas propostas do proprio `owner_email`. |
| `POST /api/proposals` | Cria ou atualiza proposta diretamente em `journey_proposals` e `journey_entities`. | Exige bearer token; admin pode informar dono, demais papeis gravam apenas no proprio `owner_email`; payload sensivel deve ser removido. |
| `GET /api/proposals/:id` | Retorna proposta pontual da tabela dedicada. | Exige bearer token; admin ve qualquer proposta, demais papeis apenas registros proprios. |
| `PATCH /api/proposals/:id` | Atualiza proposta pontual sem trocar dono indevidamente. | Exige bearer token; cliente/consultor nao podem atualizar registro de outro `owner_email`. |

## Backend Produtivo Futuro

Plano de referencia: `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`.
Roadmap executavel: `docs/PROXIMAS_FASES_BANK_FRATERN.md`.

Regras publicas para a troca de provider:

- `localStorage` continua fallback publico para GitHub Pages, `file://` e demos offline.
- `BFBackendApi` segue como fachada de compatibilidade; paginas nao devem chamar provider produtivo diretamente.
- SQLite local continua valido para desenvolvimento e deve passar em `tools/validate-local-database.mjs`.
- `BANCUS_DB_PROVIDER` aceita `sqlite` como padrao e `postgresql` como piloto; provider, URL, conexao ou migration invalidos devem falhar de forma explicita, sem fallback silencioso.
- `BANCUS_DB_PROVIDER=postgresql` exige `BANCUS_DATABASE_URL`, SSL seguro, baseline `001` e proposta segura `002` confirmadas.
- API principal e proposta publicada precisam usar o mesmo provider; `/api/health` informa ambos e so fica verde quando os dois estao prontos.
- O navegador recebe o token no fragmento de `pages/proposta.html` e o resolve por `POST /api/public/proposals/resolve`; o token nao deve aparecer na URL da API, em logs ou em persistencia sem hash.
- Baseline criada em `js/backend/migrations/001_bancus_fraternis_local_db.sql`, com rollback `001_bancus_fraternis_local_db.rollback.sql` e manifest `schema-manifest.json`.
- Backend hospedado futuro deve preservar semantica de `/api/auth/*`, `/api/users`, `/api/events`, `/api/snapshots`, `/api/journey-entities`, `/api/leads`, `/api/simulations` e `/api/proposals`.
- Admin pode ver tudo; consultor e cliente ficam escopados por `owner_email`.
- Payloads produtivos precisam remover senha, token, hash, CPF, telefone, WhatsApp e e-mail sensivel antes de persistir ou exportar.
- Qualquer mudanca de provider precisa de backup, observabilidade, rollback e validacao por `tools/validate-backend-production-plan.mjs`.

Hooks reais que tentam gravar snapshots quando `BFBackendApi` esta disponivel:

| Origem | Tipo de snapshot | Fonte local preservada |
| --- | --- | --- |
| `Storage.saveSimulation` | `simulation` | `consorciopro_simulations` |
| `BFProposalVersions.save` | `proposal-version` | `bank_fratern_proposal_versions_v1` |
| `BFProposalAcceptance.saveReview` | `proposal-acceptance` | `bank_fratern_proposal_acceptances_v1` |
| `BFProposalBuilder.saveConfig` | `proposal-builder` | `bank_fratern_proposal_builder_v1` |
| `BFDecisionContext.saveProfilePatch` | `financial-profile` | `bf_financial_profile_v1` |
| `BFTrilhaDecisaoService.save` | `decision-journey` | `bf_decision_journey_v1:<owner>` |
| `BFHandoffConsultivoService.create/update` | `handoff` | `bf_consultive_handoffs_v1` |

Leitura progressiva dos snapshots:

- Dashboard Cliente tenta `GET /api/snapshots?limit=100` e mostra `data-client-backend-snapshots="sqlite"` quando a API local esta ativa; em modo estatico/offline segue pelo `localStorage`.
- Dashboard Cliente tenta `GET /api/journey-entities?limit=100` e mostra `data-client-backend-entities="sqlite"` quando a camada relacional local esta ativa.
- Dashboard Cliente tenta ler `/api/leads`, `/api/simulations` e `/api/proposals` e mostra `data-client-backend-materialized="sqlite"` quando tabelas dedicadas estao disponiveis.
- Dashboard Cliente consolida essa leitura em `data-client-live-data-panel`, com `data-client-live-source`, `data-client-live-refresh` e readiness `clientLiveDataReady`; se a API falhar, o painel explicita fallback para `localStorage`.
- Handoff Consultivo tenta `GET /api/leads?limit=80`, mescla registros de `journey_leads` com `bf_consultive_handoffs_v1`, marca itens com `data-handoff-live-source` e sincroniza status, responsavel, checklist e notas por `PATCH /api/leads/:id` quando o registro veio apenas do backend.
- Dashboard Cliente transforma historico de calculadoras em impacto acionavel com `data-client-calculator-impact`, lista os itens em `data-client-calculator-impact-item` e pode gerar um handoff consultivo por `BFHandoffConsultivoService.createFromCalculatorImpact`.
- Handoff Consultivo preserva origem de calculadora por `sourceCalculatorHistoryId`, `sourceCalculatorSlug`, `sourceCalculatorName`, `sourceCalculatorRisk` e `sourceCalculatorScore`, alem do filtro publico `calculator`.
- Dashboard Admin tenta `GET /api/snapshots?limit=30`, `GET /api/journey-entities?limit=50`, `/api/leads`, `/api/simulations` e `/api/proposals` junto de eventos, status e tabelas; os marcadores `data-admin-backend-snapshots`, `data-admin-backend-entities` e `data-admin-backend-materialized` identificam os itens recentes.
- Dashboard Admin usa `data-admin-backend-materialized-control`, `data-admin-backend-materialized-field` e `data-admin-backend-materialized-save` para atualizar status, etapa e prioridade dos registros dedicados via `PATCH`.
- Dashboard Admin usa `data-admin-dedicated-queue`, `data-admin-dedicated-queue-filter`, `data-admin-dedicated-queue-summary` e `data-admin-dedicated-queue-item` para separar leads, simulacoes e propostas materializadas por tipo, status, prioridade e dono.
- `BFBackendApi.saveLead/saveSimulation/saveProposal` e `updateLead/updateSimulation/updateProposal` sao contratos progressivos para gravacao direta das tabelas dedicadas; a fase estatica continua usando `localStorage` e hooks de snapshot.
- `Storage.saveSimulation`, `BFProposalVersions.save`, `BFProposalAcceptance.saveReview`, `BFProposalBuilder.saveConfig` e `BFHandoffConsultivoService` ja tentam gravar nas tabelas dedicadas quando `BFBackendApi` esta disponivel.

## Exports Globais

| Export | Papel publico |
| --- | --- |
| `BFAuth` | Autenticacao, usuarios locais e guardas por papel. |
| `BFBackendApi` | Ponte progressiva para API local Node/SQLite: sessao de backend, usuarios, status tecnico do banco, importacao guiada, gravacao/listagem de eventos, gravacao/listagem de snapshots, leitura de entidades relacionais, leitura e escrita direta de tabelas dedicadas e fallback estatico. |
| `Settings` | Preferencias historicas do simulador. |
| `BFHome` | Home contextual e continuidade. |
| `BFDecisionContext` | Perfil financeiro, historico e prefill de simulacao. |
| `BFCalculadoras` | Catalogo, calculo e historico das 19 calculadoras. |
| `BFCalculatorJourney` | Deep links de calculadoras para jornada, continuidade, origem dos campos reaproveitados, comparacao com ultimo salvo e painel de impacto. |
| `BFFinancialFormulas`, `BFPriceFormulas`, `BFSacFormulas`, `BFConsorcioFormulas`, `BFComparisonFormulas` | Formulas reutilizadas. |
| `BFDadosService` | Carga de datasets locais. |
| `BFProposalBuilder` | Regras da lousa de proposta: storage, presets, prontidao, foco, dependencias e contadores. |
| `BFProposalGovernance` | Renderizacao e leitura de formulario dos paineis de versionamento, aceite e ponte de handoff da proposta. |
| `BFSimulatorJourney` | Contexto de origem, prefill e proximas acoes do simulador. |
| `BFSimulatorState` | Snapshots de formulario, carrinho salvo e payload de simulacao. |
| `BFSimulatorShelf` | Regras da prateleira do simulador: filtros, paginacao, visibilidade de colunas, tabela e detalhe do grupo. |
| `BFGroupJourney` | Estado temporario de ida e volta da Visao 360, deep link exato por `groupKey` e evidencias sanitizadas do retrato do catalogo. |
| `BFGroupAssemblyData` | Serie demonstrativa de assembleias, com associacao explicitamente nao verificada, separada do retrato atual e inelegivel como evidencia contratual. |
| `BFGroupOperationalMetrics` | Quatro metricas operacionais governadas do retrato mensal: contemplacoes relativas, pressao historica de exclusao, credito pendente relativo e maturidade observada; preserva `null`, zero, competencia, formula e limitacao, sem estimar caixa ou probabilidade. |
| `BFGroupComparisonJourney` | Estados 0/1/2+ da selecao multigrupos, retorno com intencao de comparacao, pre-selecao do grupo acionado e modo preliminar sem lance antes da jornada completa. |
| `BFSimulatorCart` | Regras do carrinho/projeto estruturado do simulador: totais, HTML do carrinho, normalizacao de edicao e aplicacao de resultados. |
| `BFSimulatorResult` | Orquestracao de calculo, resumo, proposta e tabela analitica do simulador, mantendo `App.*` como fachada publica. |
| `BFProductsJourney` | Produtos, selecao e analytics de jornada. |
| `BFComparadorService`, `BFComparatorModels` | Comparador, modelos, auditoria e presets. |
| `BFTrilhaDecisaoService`, `BFDecisionJourneyContext` | Trilha assistida, contexto de entrada e saida. |
| `BFModelosRecomendacaoService` | Recomendacao de modelos do comparador. |
| `BFHandoffConsultivoService` | Handoff por proposta, trilha, sinal, impacto de calculadora, pacote ou manual. |
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
| Visao 360 do Grupo | `groupKey`, `returnState`, `surface`; retorno direto normalizado por `groupReturn=direct`; comparacao por `compareGroup=1` e `compareGroupKey` | Prateleira na etapa 4, inclusao idempotente no projeto e comparacao inicial quando houver dois grupos. |
| Dashboard Cliente | `from=dashboard`, `journeyId`, `calculatorSlug`, `historyId`, `handoffId` | Retomada da jornada. |
| Dashboard Admin | `from=lousa|admin`, ancoras `admin-proximos-passos`, `admin-fila-acao`, `admin-carteira-consultor`, `admin-funil-comercial`, `admin-origens`, `admin-gargalos` | Handoff, pacotes, carteira por consultor, funil comercial e auditoria. |
| Lousa navegavel | `from=lousa`, ancoras `roteiro-navegavel`, `mapa-github`, `home-cockpit`, `produtos-selecao`, `trilha-acoes`, `database-status-panel`, `proposal-builder-board` | Teste ponta a ponta, QA de jornada e mapa online GitHub Pages. |

## Validadores Obrigatorios

| Validador | Protege |
| --- | --- |
| `tools/validate-public-contracts.mjs` | Este documento, contratos publicos e DoD. |
| `tools/validate-public-release-safety.mjs` | Exposicao publica, paths locais, dados pessoais de exemplo, aviso demo, fallback estatico e CI. |
| `tools/validate-local-database.mjs` | Banco local SQLite, seeds, hash de senha, sessao, eventos sanitizados e contratos de API. |
| `tools/validate-database-migrations.mjs` | Migration baseline, rollback, manifest de schema e paridade com o SQLite real. |
| `tools/validate-backend-production-plan.mjs` | Backend produtivo futuro, dominios, tabelas, endpoints, LGPD, backup, observabilidade e compatibilidade estatica. |
| `tools/validate-next-phases-plan.mjs` | Roadmap das proximas fases produtivas, ordem de migrations, adapter, autenticacao, migracao, observabilidade e corte controlado. |
| `tools/validate-live-data-ux.mjs` | UX com dados vivos: Dashboard Cliente, Handoff Consultivo, leitura de `/api/leads`, marcadores publicos e fallback local. |
| `tools/inspect-local-sql-environment.mjs` | Diagnostico local de CLIs, portas padrao e servicos SQL externos antes de trocar provider. |
| `tools/validate-docs-modernization.mjs` | README ativo, docs historicos e contagem atual de 19 calculadoras. |
| `tools/validate-auth-navigation.mjs` | Login local, seed users, redirect seguro e bloqueio por papel. |
| `tools/validate-auth-production.mjs` | Modo fechado, cookie, troca obrigatoria, revogacao, rate limit, origem e auditoria privada. |
| `tools/validate-auth-browser.mjs` | Jornada produtiva real, foco acessivel, troca obrigatoria, hidratacao por cookie, descriptor local rejeitado e reflow a 320 px. |
| `tools/validate-navigable-journey.mjs` | Roteiro ponta a ponta da lousa, links, marcadores e contratos de QA de jornada. |
| `tools/validate-online-journey-smoke.mjs` | Smoke test online do GitHub Pages cobrindo as 10 etapas navegaveis da lousa. |
| `tools/validate-github-pages-deploy.mjs` | Deploy publico no GitHub Pages, marca Bancus Fraternis, lousa, simulador e base real online. |
| `tools/validate-design-system.mjs` | Contrato visual, referencias, paginas ativas e validadores obrigatorios. |
| `tools/validate-group-operational-metrics.mjs` | Quatro metricas autorizadas, `null` diferente de zero, denominador nulo/zero, percentuais sem limite artificial, competencia, formulas, limitacoes e ausencia de caixa/probabilidade. |
| `tools/validate-group-intelligence.mjs` | Identidade exata do grupo, serie demonstrativa, leitura operacional, acessibilidade estrutural, ida e volta ao simulador e evidencias da proposta. |
| `tools/validate-group-comparison-journey.mjs` | CTA da Visao 360, retorno direto com token explicito, estados 0/1/2+, par A/B pelo `groupKey`, modo preliminar sem lance, retomada da jornada, mobile e acessibilidade no navegador. |
| `tools/validate-route-aliases.mjs` | Paridade de 52 paginas e aliases curtos. |
| `tools/validate-calculadoras.mjs` | Catalogo atual de 19 calculadoras, premissas, golden tests e contrato de previa sem submit automatico. |
| `tools/validate-calculator-journey.mjs` | Execucao das 19 calculadoras, previa sem persistencia, validacao de formulario, alertas de coerencia, proxima acao dinamica, submit persistente e mapa funcional. |
| `tools/validate-calculator-impact-panel.mjs` | Painel de impacto das 19 calculadoras, score, risco, origem preview/salvo, proximo passo e compatibilidade com `BFCalculatorJourney.impactPanel`. |
| `tools/validate-simulator-groups.mjs` | Base real do simulador: 17.396 grupos validos. |
| `tools/validate-simulator-performance.mjs` | Base compacta do simulador, peso online e fallback para JSON legado. |
| `tools/validate-simulator-refactor.mjs` | Modulos extraidos do simulador, payload salvo e acoes de jornada. |
| `tools/validate-simulator-shelf.mjs` | Prateleira do simulador: filtros, ordenacao, paginacao, tabela e detalhe de grupo. |
| `tools/validate-simulator-cart.mjs` | Carrinho/projeto estruturado do simulador, ordem de scripts, totais, campos editaveis e resultados calculados. |
| `tools/validate-simulator-result-decision.mjs` | Decisao final do resultado: recomendacao, riscos, premissas, comparacoes, CTA e lousa/PDF. |
| `tools/validate-proposal-builder.mjs` | Lousa seletiva de proposta/PDF. |
| `tools/validate-proposal-governance.mjs` | Governanca visual da proposta: versoes, aceite, historicos e handoff. |
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
