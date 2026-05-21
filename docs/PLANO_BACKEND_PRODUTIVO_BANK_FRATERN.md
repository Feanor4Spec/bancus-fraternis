# Plano Backend Produtivo - Bancus Fraternis

Atualizado em 2026-05-21.

## Objetivo

Definir a ponte segura entre a camada local atual e um backend hospedado futuro. O Bancus Fraternis ja possui SQLite local, API `/api/*`, tabelas dedicadas e fallback estatico. O proximo passo nao e trocar tudo de uma vez: e preservar os contratos publicos enquanto usuarios, eventos, leads, simulacoes, propostas e handoffs passam para uma API produtiva com governanca, LGPD, backup e observabilidade.

Regra central: localStorage continua sendo fallback publico para GitHub Pages, `file://` e demos offline ate existir backend hospedado validado. Nenhuma chave local existente deve ser removida sem migracao explicita.

## Estado Atual

| Camada | Estado | Contrato |
| --- | --- | --- |
| Browser estatico | Ativo | HTML, services `window.BF*`, `localStorage`, datasets JSON e validadores. |
| API local | Ativo em `node server.js` | `/api/auth/*`, `/api/users`, `/api/events`, `/api/snapshots`, `/api/journey-entities`, `/api/leads`, `/api/simulations`, `/api/proposals`. |
| Banco local | Ativo | SQLite em `.runtime/bancus-fraternis.sqlite`, fora do Git. |
| Provider configuravel | Ativo parcial | `BANCUS_DB_PROVIDER=sqlite` e o contrato inicial; providers futuros ficam bloqueados ate adapter validado. |
| Proximas fases | Planejado | `docs/PROXIMAS_FASES_BANK_FRATERN.md` detalha migrations, adapter produtivo, auth, migracao, observabilidade e corte controlado. |
| Backend hospedado | Futuro | Deve nascer dos contratos existentes, nao de um modelo paralelo. |

## Principios De Migracao

- Preservar `BFAuth` e `BFBackendApi` como fachadas publicas no browser.
- Manter leitura tolerante: se a API falhar, a jornada continua pelo `localStorage`.
- Migrar por dominio, nao por tela. Uma tela pode usar API produtiva para leads e ainda manter proposta local em fallback.
- Nunca publicar dados pessoais reais em JSON estatico, analytics exportado ou pacotes de demo.
- Sanitizar payloads no servidor antes de gravar eventos, snapshots e entidades.
- Manter escopo por sessao: admin ve tudo; consultor e cliente veem apenas `owner_email` permitido.
- Versionar contratos antes de trocar provider. A troca de banco deve ser reversivel durante piloto.

## Dominios Produtivos

| Dominio | Fonte local atual | Tabela local | Servico produtivo futuro | Observacao |
| --- | --- | --- | --- | --- |
| Usuarios e papeis | `bf_auth_users_v1` | `users` | Identity/Auth service | Senhas nunca podem voltar para `localStorage` produtivo. |
| Sessoes | `bf_auth_session_v1`, `bf_backend_session_v1` | `sessions` | Session service | Tokens devem ter expiracao, revogacao e rotacao. |
| Eventos | `bf_journey_analytics_v1:<owner>` e auditorias locais | `events` | Event audit service | Payload sempre sanitizado e sem CPF, telefone, token ou senha. |
| Snapshots | Simulador, proposta, trilha, perfil, modelos e handoff | `snapshots` | Journey snapshot service | Continua como camada de retomada e compatibilidade. |
| Entidades de jornada | Derivadas dos snapshots | `journey_entities` | Journey index service | Indice comum para funil e dashboards. |
| Leads | `bf_consultive_handoffs_v1` | `journey_leads` | Lead service | Status, etapa, prioridade, dono e SLA devem ser server-side. |
| Simulacoes | `consorciopro_simulations` | `journey_simulations` | Simulation service | Payload financeiro precisa manter versao de premissas. |
| Propostas | `bank_fratern_proposal_versions_v1`, aceite e lousa | `journey_proposals` | Proposal service | Versionamento, aceite e handoff precisam de trilha de auditoria. |

## Contratos Que Nao Podem Quebrar

| Contrato | Regra |
| --- | --- |
| `localStorage` | Chaves atuais seguem legiveis; nomes historicos como `consorciopro_simulations` continuam como nome legado controlado e migracoes precisam ser idempotentes. |
| `data-*` | Marcadores usados por validadores e QA visual continuam estaveis. |
| Deep links | `from`, `sourceFrom`, `calculatorSlug`, `historyId`, `journeyId`, `simulationId`, `handoffId`, `preset`, `productId` e `products` seguem preservados. |
| `window.BF*` | Services globais continuam como fachada de compatibilidade mesmo quando a API produtiva existir. |
| `/api/*` | Endpoints locais viram contrato de referencia para backend hospedado. |
| GitHub Pages | Publicacao estatica continua navegavel e sinalizada como demo/local. |

## Fronteira De API Produtiva

Primeiro conjunto que deve virar API hospedada:

- `POST /api/auth/login`
- `POST /api/auth/logout`
- `GET /api/auth/me`
- `GET /api/users`
- `POST /api/users`
- `PATCH /api/users/:id`
- `POST /api/users/:id/password`
- `POST /api/users/:id/status`
- `GET /api/events`
- `POST /api/events`
- `GET /api/snapshots`
- `POST /api/snapshots`
- `GET /api/journey-entities`
- `GET /api/leads`
- `POST /api/leads`
- `PATCH /api/leads/:id`
- `GET /api/simulations`
- `POST /api/simulations`
- `PATCH /api/simulations/:id`
- `GET /api/proposals`
- `POST /api/proposals`
- `PATCH /api/proposals/:id`

Endpoints futuros de produto, calculadoras, comparador e recomendacoes so devem entrar depois que identidade, escopo, auditoria, backup e dashboards estiverem estaveis.

## Sequencia Recomendada

| Fase | Objetivo | Entrega |
| --- | --- | --- |
| P3.1 | Congelar contratos atuais | Este plano, contratos publicos, validadores e matriz de migracao. |
| P3.2 | Abstrair provider | Concluido parcial: `BANCUS_DB_PROVIDER` existe, `sqlite` e padrao e providers sem adapter falham com mensagem explicita sem mudar `BFBackendApi`. |
| P3.3A | Versionar schema | Criar migrations, manifest de schema e rollback antes de conectar provider hospedado. |
| P3.3B | Hospedar banco piloto | Subir Postgres ou servico gerenciado equivalente com schema espelhado e adapter controlado. |
| P3.4 | Autenticacao produtiva | Tirar senha demonstrativa da operacao real, reforcar politica de sessao, auditoria e permissao server-side. |
| P3.5 | Migracao assistida | Importar usuarios, eventos, snapshots e entidades dedicadas com relatorio de divergencias. |
| P3.6 | Observabilidade e backup | Logs, metricas, alertas, backup automatizado e rotina de restauracao testada. |
| P3.7 | Corte controlado | Ativar API hospedada por ambiente, mantendo fallback estatico e plano de rollback. |

## Proximas Fases Detalhadas

O detalhamento executavel esta em `docs/PROXIMAS_FASES_BANK_FRATERN.md`.

| Fase | Prioridade | Entrega principal | Validador esperado |
| --- | --- | --- | --- |
| 8AN / P3.3A | P0 | Schema e migrations versionadas para todas as tabelas atuais. | `tools/validate-database-migrations.mjs` |
| 8AO / P3.3B | P0 | Adapter `postgresql` piloto com `BANCUS_DATABASE_URL` e fallback SQLite. | `tools/validate-database-provider.mjs` |
| 8AP / P3.4 | P0 | Autenticacao produtiva, revogacao, escopo e auditoria server-side. | `tools/validate-auth-navigation.mjs` |
| 8AQ / P3.5 | P1 | Migracao assistida com preview, divergencias e idempotencia. | `tools/validate-database-migration-reconciliation.mjs` |
| 8AR / P3.6 | P1 | Health, logs sanitizados, backup/restore e checklist LGPD. | `tools/validate-backend-production-plan.mjs` |
| 8AS / P3.7 | P1 | Corte por ambiente, smoke test e rollback documentado. | `tools/validate-online-journey-smoke.mjs` |
| 8AT / P4.1 | P2 | UX com dados vivos em cliente, consultor e admin. | `tools/validate-dashboard-continuity-flow.mjs` |

## Definition Of Done Produtiva

Uma troca para backend hospedado so pode ser aceita quando:

- `node tools/validate-backend-production-plan.mjs` estiver verde.
- `node tools/validate-local-database.mjs` continuar verde para o fallback SQLite.
- `node tools/validate-public-contracts.mjs` continuar verde para contratos publicos.
- `node tools/validate-public-release-safety.mjs` confirmar que a publicacao estatica nao vazou dados reais.
- Admin nao conseguir listar ou alterar registro fora do escopo autorizado sem papel correto.
- Consultor e cliente nao conseguirem ler registros de outro `owner_email`.
- Eventos, snapshots, leads, simulacoes e propostas removerem senha, token, hash, CPF, telefone, WhatsApp e e-mail sensivel dos payloads publicos.
- Backup e restauracao forem testados em ambiente de homologacao.

## Riscos E Mitigacoes

| Risco | Mitigacao |
| --- | --- |
| Quebrar demos estaticas | Manter `localStorage` como fallback obrigatorio e testar GitHub Pages. |
| Duplicar leads ou propostas | Usar ids estaveis, upsert idempotente e relatorio de migracao. |
| Vazamento de dado pessoal | Sanitizacao server-side, validadores de publicacao e revisao LGPD antes de producao. |
| Divergencia entre snapshots e tabelas dedicadas | Manter `journey_entities` como indice comum e validar sincronizacao por entrega. |
| Troca prematura de provider | Usar `tools/inspect-local-sql-environment.mjs` e piloto com rollback antes de corte. |

## Backlog Tecnico

- Expandir a camada de provider para Postgres ou servico gerenciado equivalente mantendo SQLite local.
- Adicionar migrations versionadas para `users`, `sessions`, `events`, `snapshots`, `journey_entities`, `journey_leads`, `journey_simulations` e `journey_proposals`.
- Criar relatorio de migracao com totais importados, pulados, atualizados e rejeitados.
- Adicionar politicas de retencao para eventos e snapshots.
- Separar segredo de sessao e configuracoes de ambiente fora do repositorio.
- Criar checklist de homologacao LGPD para dados pessoais, consentimento e finalidade.

## Validacao

```bash
node tools/validate-backend-production-plan.mjs
node tools/validate-local-database.mjs
node tools/validate-public-contracts.mjs
node tools/validate-public-release-safety.mjs
```
