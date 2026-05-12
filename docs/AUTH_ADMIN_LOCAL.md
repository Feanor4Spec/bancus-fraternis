# Autenticacao Local e Administracao - Bancus Fraternis

Atualizado em 2026-05-12.

## Objetivo

Esta camada implementa login, sessao local, papeis de acesso e painel administrativo em HTML/CSS/JS puro. A partir de 2026-05-12, quando o projeto roda via `node server.js`, ela tambem espelha login, criacao de usuarios, senha, status e eventos para o SQLite local documentado em `docs/BANCO_DADOS_LOCAL_BANK_FRATERN.md`.

## Arquivos principais

- `js/auth.js`: servico central de usuarios, sessao, papeis e protecao de paginas.
- `assets/js/services/backend-api.service.js`: ponte opcional para API local Node/SQLite.
- `js/backend/db.js`: banco local SQLite com usuarios, sessoes, eventos e status tecnico.
- `server.js`: endpoints `/api/database/status`, `/api/auth/*`, `/api/users` e `/api/events`.
- `pages/login.html`: tela de login com contas de demonstracao e barra de progresso.
- `pages/dashboard-admin.html`: painel de administracao de usuarios.
- `assets/js/login.js`: comportamento da tela de login.
- `assets/js/admin-users.js`: cadastro, edicao, filtros, status e senha temporaria.
- `assets/js/client-dashboard.js`: identificacao da sessao no dashboard do cliente.
- `js/shared-layout.js`: header com estado de conta, acesso admin e logout.

## Contas seed

| Papel | E-mail | Senha |
| --- | --- | --- |
| Administrador | `admin@bankfratern.local` | `Admin@123` |
| Consultor | `consultor@bankfratern.local` | `Consultor@123` |
| Cliente | `cliente@bankfratern.local` | `Cliente@123` |

As contas seed sao recriadas automaticamente quando faltarem no localStorage.

## Regras implementadas

- Sessao local com validade de 8 horas.
- `dashboard-admin.html` exige papel `admin`.
- `dashboard-cliente.html` aceita `admin`, `consultor` e `cliente`.
- Paginas protegidas sem sessao redirecionam para `login.html?redirect=<pagina>`.
- Admin pode criar, editar, ativar/inativar, excluir usuarios e redefinir senha temporaria.
- O usuario em sessao nao pode ser inativado nem excluido por si mesmo.
- Em `localhost`, `BFBackendApi` tenta autenticar tambem em `/api/auth/login` e armazena a sessao em `bf_backend_session_v1`.
- Em `localhost`, operacoes de usuario feitas pelo Admin sao espelhadas no SQLite com senha hasheada via `scrypt-sha256`.
- Eventos de auth, jornada, handoff, funil e modelos podem ser persistidos em `/api/events` com payload sanitizado.
- Admin pode consultar `/api/database/status` no painel para confirmar provider, tabelas, integridade e arquivos locais.

## Chaves locais

- `bf_auth_users_v1`: base local de usuarios.
- `bf_auth_session_v1`: sessao ativa.
- `bf_backend_session_v1`: sessao da API local quando disponivel.

## Banco local

- Arquivo padrao: `.runtime/bancus-fraternis.sqlite`.
- Tabelas: `users`, `sessions`, `events`.
- Status tecnico: `GET /api/database/status` e `node tools/inspect-local-sql-environment.mjs`.
- `.runtime/` fica fora do Git.
- Validador: `node tools/validate-local-database.mjs`.

## Limite de seguranca

O `localStorage` continua sendo demonstrativo e nao deve receber dados pessoais reais. O SQLite local melhora a base tecnica com hash forte e sessoes server-side, mas ainda e ambiente local de desenvolvimento. Antes de producao, trocar por backend hospedado, controle de permissao server-side completo, LGPD, backup e observabilidade.

## Evidencias

- `docs/test-prints/auth-login-desktop.png`
- `docs/test-prints/auth-admin-dashboard-desktop.png`
- `docs/test-prints/auth-client-dashboard-desktop.png`
