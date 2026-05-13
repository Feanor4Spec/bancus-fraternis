# Banco De Dados Local - Bancus Fraternis

Atualizado em 2026-05-12.

## Objetivo

Esta entrega cria a primeira camada server-side do Bancus Fraternis sem quebrar a publicacao estatica. Quando o projeto roda por `node server.js`, o servidor abre um SQLite local em `.runtime/` para armazenar usuarios, sessoes, eventos e snapshots recuperaveis. Quando o site roda em GitHub Pages ou `file://`, a experiencia continua usando `localStorage`.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `js/backend/db.js` | Camada SQLite, schema, seeds, hash de senha, sessoes, eventos e snapshots. |
| `server.js` | Servidor estatico + endpoints `/api/*`. |
| `assets/js/services/backend-api.service.js` | Ponte do navegador para a API local com fallback silencioso. |
| `js/auth.js` | Continua sendo a fachada publica de auth e espelha login/usuarios no banco quando a API existe. |
| `assets/js/admin-users.js` | Dashboard Admin le `/api/events`, mostra eventos/status server-side e executa migracao guiada do `localStorage`. |
| `tools/validate-local-database.mjs` | Validador de schema, seeds, login, sessao, eventos e snapshots sanitizados. |
| `tools/inspect-local-sql-environment.mjs` | Diagnostico de CLIs, portas padrao e servicos SQL locais para proxima troca de provider. |

## Banco

Arquivo padrao:

```text
.runtime/bancus-fraternis.sqlite
```

Override local:

```bash
BANCUS_DB_PATH=.runtime/outro-banco.sqlite node server.js
```

`.runtime/` fica fora do Git, entao o banco local nao e publicado.

## Tabelas

| Tabela | Conteudo | Observacao |
| --- | --- | --- |
| `users` | Usuarios, papel, status, area, telefone e credenciais hasheadas. | Senha nunca e salva em texto puro. |
| `sessions` | Tokens de API hasheados, expiracao e revogacao. | Sessao dura 8 horas. |
| `events` | Eventos sanitizados de jornada, auth, usuarios, modelos, handoff e funil. | Payload remove senha, token, hash, CPF, telefone, WhatsApp e e-mail. |
| `snapshots` | Estados recuperaveis de simulacao, trilha, proposta, lousa, perfil, modelos e handoff. | Payload e sanitizado e pode ser atualizado pelo mesmo `id`. |

## Seeds

| Papel | E-mail | Uso |
| --- | --- | --- |
| Admin | `admin@bankfratern.local` | Administracao e leitura de eventos. |
| Consultor | `consultor@bankfratern.local` | Operacao consultiva. |
| Cliente | `cliente@bankfratern.local` | Jornada cliente. |

As senhas seed continuam documentadas em `docs/AUTH_ADMIN_LOCAL.md` para demonstracao, mas no SQLite sao salvas com `scrypt-sha256` e salt por usuario.

## Endpoints

| Endpoint | Uso |
| --- | --- |
| `GET /api/health` | Status da API e estatisticas agregadas. |
| `GET /api/database/status` | Status tecnico admin: provider, driver, PRAGMAs, arquivos, tabelas e runtime. |
| `POST /api/database/import-local` | Preview/execucao admin de usuarios, eventos e snapshots locais para SQLite, sem duplicar registros. |
| `POST /api/auth/login` | Login server-side e emissao de token. |
| `POST /api/auth/logout` | Revogacao de token. |
| `GET /api/auth/me` | Usuario da sessao de API. |
| `GET /api/users` | Lista usuarios publicos. |
| `POST /api/users` | Cria usuario. |
| `PATCH /api/users/:id` | Atualiza usuario. |
| `POST /api/users/:id/password` | Redefine senha. |
| `POST /api/users/:id/status` | Ativa/inativa usuario. |
| `DELETE /api/users/:id` | Remove usuario. |
| `POST /api/events` | Grava evento sanitizado. |
| `GET /api/events` | Lista eventos recentes para admin. |
| `POST /api/snapshots` | Cria ou atualiza snapshot server-side de jornada, simulacao, proposta, lousa, perfil, modelos ou handoff. |
| `GET /api/snapshots` | Lista snapshots recentes por limite e tipo; admin ve todos, consultor/cliente veem apenas registros do proprio `owner_email`. |

## Regras De Compatibilidade

- `BFAuth` segue sincrono e baseado em `localStorage`, para nao quebrar paginas estaticas.
- `BFBackendApi` e progressivo: falhas de rede nao bloqueiam login, jornada ou dashboard.
- Usuarios criados no Admin sao salvos primeiro no `localStorage` e espelhados no SQLite quando houver sessao de API admin.
- Eventos de jornada, contexto financeiro, modelos, handoff, acoes operacionais e funil comercial tentam gravar em `/api/events`.
- Estados de simulacao, proposta, trilha, perfil, modelos e handoff podem ser consolidados em `/api/snapshots`, preservando `localStorage` como fonte de compatibilidade.
- Salvamentos reais de simulacao, proposta, lousa, perfil, trilha e handoff ja tentam gravar snapshots server-side quando ha `BFBackendApi` e sessao local valida.
- Dashboard Cliente le `GET /api/snapshots?limit=100` quando houver API local, mescla com `localStorage` e sinaliza a fonte em `data-client-backend-snapshots`.
- Dashboard Admin exibe `data-admin-backend-events` com metricas do SQLite e ultimos eventos quando houver sessao admin da API.
- O mesmo painel lista snapshots recentes server-side em `data-admin-backend-snapshots` e cada item em `data-admin-backend-snapshot`.
- O mesmo painel exibe `data-admin-backend-table` e `data-admin-backend-database-provider` para confirmar provider, arquivo, PRAGMAs e tabelas ativas.
- A migracao guiada usa `data-admin-local-import-panel`, `data-admin-local-import-preview`, `data-admin-local-import-run` e `data-admin-local-snapshot-count`; usuarios existentes sao pulados, snapshots repetidos sao atualizados e novos usuarios recebem senha temporaria `Temp@123`.
- Produção futura deve trocar o SQLite local por backend hospedado, controle de permissao server-side completo, LGPD e politicas de backup.

## Validacao

```bash
node tools/validate-local-database.mjs
node tools/inspect-local-sql-environment.mjs
```

Valida:

- criacao das tabelas;
- 3 usuarios seed;
- login com senha correta;
- recusa de senha incorreta;
- token de sessao;
- usuario publico sem hash/salt;
- criacao de novo usuario com senha hasheada;
- evento persistido sem senha, token ou telefone no payload;
- snapshot persistido sem senha, token ou telefone no payload;
- listagem de snapshots por `owner_email` sem vazamento entre usuarios;
- hooks reais de `recordSnapshot` em simulacao, proposta, perfil, trilha e handoff;
- preview e execucao idempotente da migracao `localStorage` -> SQLite, incluindo snapshots;
- presenca dos contratos `/api/*` no servidor.
- ambiente local para SQL externo em portas padrao (`5432`, `3306`, `1433`) e CLIs (`psql`, `mysql`, `sqlcmd`).
