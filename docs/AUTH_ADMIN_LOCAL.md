# Autenticacao Local e Administracao - Bancus Fraternis

Atualizado em 2026-04-24.

## Objetivo

Esta camada implementa login, sessao local, papeis de acesso e painel administrativo em HTML/CSS/JS puro. Ela serve para validar a experiencia de produto antes da troca por API segura e banco de dados real.

## Arquivos principais

- `js/auth.js`: servico central de usuarios, sessao, papeis e protecao de paginas.
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

## Chaves locais

- `bf_auth_users_v1`: base local de usuarios.
- `bf_auth_session_v1`: sessao ativa.

## Limite de seguranca

Esta implementacao e um prototipo estatico. O hash de senha e demonstrativo e nao substitui criptografia de backend. Antes de usar dados pessoais reais, trocar por API, banco de dados, hash forte, controle de permissao server-side, auditoria e fluxo LGPD.

## Evidencias

- `docs/test-prints/auth-login-desktop.png`
- `docs/test-prints/auth-admin-dashboard-desktop.png`
- `docs/test-prints/auth-client-dashboard-desktop.png`
