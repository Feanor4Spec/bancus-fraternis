# Proximas Fases - Bancus Fraternis

Atualizado em 2026-05-21.

## Objetivo

Transformar o estado atual do Bancus Fraternis em um roteiro executavel para os proximos ciclos, sem abrir uma frente paralela ou quebrar o que ja esta navegavel. O foco imediato e sair do SQLite local governado para um backend produtivo piloto, preservando `localStorage`, `BFBackendApi`, deep links, `window.BF*`, GitHub Pages e a jornada Home -> Produtos -> Calculadoras -> Trilha -> Comparador -> Simulador -> Proposta -> Handoff -> Dashboards.

Regra de continuidade: nenhuma fase abaixo remove o fallback estatico. A API produtiva entra por ambiente, validacao e rollback.

## Estado De Partida

| Area | Estado atual | Evidencia |
| --- | --- | --- |
| Produto e jornada | Fluxo principal navegavel, lousa de QA, simulador com base real, proposta seletiva, handoff e dashboards operacionais. | `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` |
| Backend local | SQLite local com usuarios, sessoes, eventos, snapshots, entidades, leads, simulacoes e propostas. | `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md` |
| Provider | `BANCUS_DB_PROVIDER=sqlite` ativo; providers futuros falham explicitamente. | `js/backend/db.js` |
| Contratos publicos | `localStorage`, `data-*`, deep links, `BFBackendApi` e validadores documentados. | `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` |
| Backend produtivo | Plano governado existe, mas adapter hospedado ainda nao foi implementado. | `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md` |

## Ordem Das Proximas Fases

| Ordem | Fase | Prioridade | Objetivo | Saida esperada |
| --- | --- | --- | --- | --- |
| 1 | 8AN / P3.3A - Schema e migrations versionadas | P0 | Criar contrato de schema executavel antes de qualquer banco hospedado. | Migrations idempotentes, manifest de schema e rollback documentado. |
| 2 | 8AO / P3.3B - Adapter produtivo piloto | P0 | Implementar provider `postgresql` em homologacao sem alterar `BFBackendApi`. | `BANCUS_DB_PROVIDER=postgresql` funcional em ambiente controlado e SQLite preservado. |
| 3 | 8AP / P3.4 - Autenticacao produtiva | P0 | Substituir credenciais demonstrativas por sessao produtiva governada. | Politica de senha, rotacao, revogacao, escopo por papel e auditoria server-side. |
| 4 | 8AQ / P3.5 - Migracao assistida e reconciliacao | P1 | Migrar dados locais para o provider produtivo com preview, divergencias e idempotencia. | Relatorio de importacao por dominio e comparacao SQLite x provider produtivo. |
| 5 | 8AR / P3.6 - Observabilidade, backup e LGPD | P1 | Tornar operacao monitoravel, restauravel e auditavel. | Health checks, logs sanitizados, metricas, backup/restore testado e checklist LGPD. |
| 6 | 8AS / P3.7 - Corte controlado por ambiente | P1 | Ativar backend hospedado por flag/ambiente com retorno seguro para SQLite/localStorage. | Smoke test de homologacao, plano de rollback e decisao Go/No-Go. |
| 7 | 8AT / P4.1 - UX com dados vivos | P2 | Usar a persistencia produtiva para melhorar experiencia do cliente, consultor e admin. | Dashboards com estado mais fresco, retomada cross-device e alertas comerciais mais claros. |

## Fase 8AN / P3.3A - Schema e Migrations Versionadas

Objetivo: antes de ligar um provider hospedado, transformar o schema local atual em contrato versionado.

Entregas:

- Criar pasta de migrations versionadas para `users`, `sessions`, `events`, `snapshots`, `journey_entities`, `journey_leads`, `journey_simulations` e `journey_proposals`.
- Criar manifest de schema com versao, tabelas, indices, campos sensiveis e politica de rollback.
- Separar SQL portavel de detalhes especificos do SQLite ou PostgreSQL.
- Criar validador de migrations que roda sem tocar dados reais.

Arquivos provaveis:

- `js/backend/db.js`
- `js/backend/migrations/*`
- `tools/validate-database-migrations.mjs`
- `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md`
- `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`

Criterios de aceite:

- SQLite local continua passando em `tools/validate-local-database.mjs`.
- Toda tabela atual tem migration correspondente.
- O rollback da ultima migration esta documentado.
- Nenhuma migration cria campo para senha, token, CPF ou telefone sem regra explicita de sanitizacao.

## Fase 8AO / P3.3B - Adapter Produtivo Piloto

Objetivo: implementar provider produtivo piloto, preferencialmente PostgreSQL, mantendo SQLite como fallback de desenvolvimento.

Entregas:

- Criar interface interna de adapter com metodos equivalentes aos contratos atuais do `BancusDatabase`.
- Implementar `BANCUS_DB_PROVIDER=postgresql` atras de variavel de ambiente e `BANCUS_DATABASE_URL`.
- Manter erro explicito quando o provider estiver configurado sem credencial, migration ou conexao valida.
- Criar smoke test de provider que valida conexao, schema, CRUD minimo, escopo por usuario e sanitizacao.

Arquivos provaveis:

- `js/backend/db.js`
- `js/backend/providers/sqlite.js`
- `js/backend/providers/postgresql.js`
- `server.js`
- `tools/validate-database-provider.mjs`
- `.env.example`

Criterios de aceite:

- `BANCUS_DB_PROVIDER=sqlite node tools/validate-local-database.mjs` continua verde.
- `BANCUS_DB_PROVIDER=postgresql` so passa quando a URL de homologacao e migrations estiverem corretas.
- Endpoints `/api/*` continuam com a mesma semantica publica.
- `BFBackendApi` nao precisa saber qual provider esta ativo.

## Fase 8AP / P3.4 - Autenticacao Produtiva

Objetivo: tirar a operacao real do modelo de contas demonstrativas, mantendo as contas seed apenas para demo/local.

Entregas:

- Politica de senha produtiva e fluxo de troca obrigatoria de senha temporaria.
- Revogacao de sessao, expiracao controlada e auditoria de login/logout/falha.
- Permissoes server-side por papel: admin, consultor e cliente.
- Separacao clara entre modo demo/local e modo produtivo.

Arquivos provaveis:

- `js/backend/db.js`
- `server.js`
- `js/auth.js`
- `assets/js/services/backend-api.service.js`
- `docs/AUTH_ADMIN_LOCAL.md`
- `tools/validate-auth-navigation.mjs`

Criterios de aceite:

- Admin nao consegue agir sem sessao valida.
- Consultor e cliente nao acessam registros fora do proprio `owner_email`.
- Respostas publicas nunca retornam hash, salt, token bruto ou senha.
- Modo GitHub Pages continua navegavel como demo.

## Fase 8AQ / P3.5 - Migracao Assistida e Reconciliacao

Objetivo: permitir migrar bases locais para o provider produtivo sem duplicidade, perda de origem ou corrupcao de jornada.

Entregas:

- Preview de migracao por dominio: usuarios, eventos, snapshots, entidades, leads, simulacoes e propostas.
- Relatorio com importados, pulados, atualizados, rejeitados e divergentes.
- Idempotencia por `id`, `owner_email`, `source_id`, `simulation_id`, `proposal_id` e `handoff_id` quando existirem.
- Tela ou painel admin que mostre estado antes/depois sem expor dados sensiveis.

Arquivos provaveis:

- `server.js`
- `js/backend/db.js`
- `assets/js/admin-users.js`
- `assets/js/services/backend-api.service.js`
- `tools/validate-local-database.mjs`
- `tools/validate-database-migration-reconciliation.mjs`

Criterios de aceite:

- Rodar a mesma importacao duas vezes nao duplica registros.
- Relatorio explica cada rejeicao.
- Dados sensiveis continuam sanitizados em eventos, snapshots e exports.
- Dashboard Admin consegue confirmar totais por dominio.

## Fase 8AR / P3.6 - Observabilidade, Backup e LGPD

Objetivo: preparar operacao real com monitoramento, restauracao e governanca de dados pessoais.

Entregas:

- Health check tecnico com provider, schema, migrations e latencia.
- Logs de aplicacao sem dados sensiveis.
- Rotina de backup e restore testada em homologacao.
- Checklist LGPD com finalidade, retencao, consentimento, exclusao e acesso.
- Alertas para falha de login, erro de provider, migration pendente e backup vencido.

Arquivos provaveis:

- `server.js`
- `js/backend/db.js`
- `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`
- `docs/CODEX_TEST_PROTOCOL.md`
- `tools/validate-public-release-safety.mjs`
- `tools/validate-backend-production-plan.mjs`

Criterios de aceite:

- Falha de provider aparece em health/status sem vazar segredo.
- Backup e restore sao testados e documentados.
- Retencao de eventos/snapshots tem regra explicita.
- Publicacao estatica continua sem dados reais.

## Fase 8AS / P3.7 - Corte Controlado por Ambiente

Objetivo: ativar backend hospedado de forma reversivel, com smoke test e plano de rollback.

Entregas:

- Matriz de ambientes: `static-demo`, `local-sqlite`, `staging-postgresql` e `production-postgresql`.
- Flags e variaveis obrigatorias por ambiente.
- Smoke test ponta a ponta: login, usuario, evento, snapshot, lead, simulacao, proposta, dashboard cliente e dashboard admin.
- Checklist Go/No-Go antes de producao.

Arquivos provaveis:

- `.env.example`
- `.github/workflows/validate.yml`
- `docs/CODEX_TEST_PROTOCOL.md`
- `docs/PLANO_BACKEND_PRODUTIVO_BANK_FRATERN.md`
- `tools/validate-backend-production-plan.mjs`
- `tools/validate-online-journey-smoke.mjs`

Criterios de aceite:

- Ambiente estatico segue funcional sem API.
- Ambiente local segue usando SQLite.
- Ambiente staging usa provider hospedado com dados de teste.
- Rollback para SQLite/localStorage esta documentado e testado.

## Fase 8AT / P4.1 - UX com Dados Vivos

Objetivo: usar a base produtiva para melhorar a experiencia, sem trocar a logica financeira ou os contratos de jornada.

Entregas:

- Dashboard Cliente com retomada cross-device a partir de snapshots/propostas server-side.
- Dashboard Admin com fila dedicada mais confiavel por dados server-side.
- Handoff Consultivo com status compartilhado entre admin e consultor.
- Simulador e proposta preservando versionamento mesmo quando o usuario troca de navegador.

Arquivos provaveis:

- `assets/js/client-dashboard.js`
- `assets/js/admin-users.js`
- `assets/js/handoff-consultivo.js`
- `js/storage.js`
- `js/proposal-versioning.js`
- `assets/js/services/backend-api.service.js`

Criterios de aceite:

- Cliente consegue retomar proposta/simulacao vinda do backend.
- Consultor ve a mesma etapa comercial que o Admin.
- Falha de API nao bloqueia a jornada local.
- Dados pessoais nao aparecem em exports publicos.

## Validacoes Recomendadas

```bash
node tools/validate-next-phases-plan.mjs
node tools/validate-backend-production-plan.mjs
node tools/validate-local-database.mjs
node tools/validate-public-contracts.mjs
node tools/validate-public-release-safety.mjs
node tools/validate-design-system.mjs
```

## Decisao Para O Proximo Ciclo

O proximo ciclo implementavel deve ser a Fase 8AN / P3.3A. Ela e a menor entrega com maior reducao de risco: cria migrations e manifest de schema antes do adapter produtivo. So depois disso faz sentido ativar `BANCUS_DB_PROVIDER=postgresql`.
