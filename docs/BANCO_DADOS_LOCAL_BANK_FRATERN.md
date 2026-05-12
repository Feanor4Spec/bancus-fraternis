# Banco De Dados Local - Bancus Fraternis

Atualizado em 2026-05-12.

## Objetivo

Esta entrega cria a primeira camada server-side do Bancus Fraternis sem quebrar a publicacao estatica. Quando o projeto roda por `node server.js`, o servidor abre um SQLite local em `.runtime/` para armazenar usuarios, sessoes e eventos. Quando o site roda em GitHub Pages ou `file://`, a experiencia continua usando `localStorage`.

## Arquivos

| Arquivo | Papel |
| --- | --- |
| `js/backend/db.js` | Camada SQLite, schema, seeds, hash de senha, sessoes e eventos. |
| `server.js` | Servidor estatico + endpoints `/api/*`. |
| `assets/js/services/backend-api.service.js` | Ponte do navegador para a API local com fallback silencioso. |
| `js/auth.js` | Continua sendo a fachada publica de auth e espelha login/usuarios no banco quando a API existe. |
| `assets/js/admin-users.js` | Dashboard Admin le `/api/events` e mostra eventos server-side quando ha sessao de API. |
| `tools/validate-local-database.mjs` | Validador de schema, seeds, login, sessao e eventos sanitizados. |

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

## Regras De Compatibilidade

- `BFAuth` segue sincrono e baseado em `localStorage`, para nao quebrar paginas estaticas.
- `BFBackendApi` e progressivo: falhas de rede nao bloqueiam login, jornada ou dashboard.
- Usuarios criados no Admin sao salvos primeiro no `localStorage` e espelhados no SQLite quando houver sessao de API admin.
- Eventos de jornada, contexto financeiro, modelos, handoff, acoes operacionais e funil comercial tentam gravar em `/api/events`.
- Dashboard Admin exibe `data-admin-backend-events` com metricas do SQLite e ultimos eventos quando houver sessao admin da API.
- Produção futura deve trocar o SQLite local por backend hospedado, controle de permissao server-side completo, LGPD e politicas de backup.

## Validacao

```bash
node tools/validate-local-database.mjs
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
- presenca dos contratos `/api/*` no servidor.
