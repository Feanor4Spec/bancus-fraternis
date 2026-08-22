# Autenticação demonstrativa e produtiva

Atualizado em 2026-08-22.

## Modos de operação

| Modo | Uso | Autoridade | Sessão | Contas demonstrativas |
| --- | --- | --- | --- | --- |
| `demo` | GitHub Pages e desenvolvimento em loopback | `BFAuth` no navegador, com espelhamento opcional na API local | `localStorage`, por até 8 horas | Ativas |
| `production` | Piloto autenticado com SQLite controlado ou PostgreSQL | API `/api/auth/*` | Cookie opaco `HttpOnly`, `SameSite=Lax` e `Secure` fora de loopback | Desativadas |

O modo é definido por `BANCUS_AUTH_MODE`. Quando a variável não existe, SQLite assume `demo` e PostgreSQL assume `production`.

Regras de fail-closed:

- valores diferentes de `demo` e `production` impedem a inicialização;
- `BANCUS_DB_SEED_USERS=true` é recusado em `production`;
- o modo `demo` só escuta em `127.0.0.1`, `::1` ou `localhost`;
- cookie sem `Secure` só é permitido em loopback;
- identidades `@bankfratern.local` nunca autenticam em `production`;
- a página produtiva de login é entregue sem o painel ou as credenciais de demonstração.

## Jornada de acesso

1. `GET /api/auth/config` informa modo, transporte, duração da sessão e política de senha.
2. Em `production`, `POST /api/auth/login` só conclui o acesso depois da validação server-side.
3. O token bruto é gravado somente como hash no banco e enviado ao navegador em cookie `HttpOnly`; não aparece no JSON nem no `localStorage`.
4. Usuários criados ou redefinidos por um administrador recebem uma senha temporária e ficam limitados a `/api/auth/me`, `/api/auth/change-password` e logout.
5. A troca obrigatória revoga todas as sessões anteriores e cria uma sessão nova.
6. Mudanças de e-mail, papel, status ou senha também revogam as sessões existentes.

O navegador mantém apenas dados públicos da sessão na aba atual para apresentar nome e papel. Toda operação de negócio continua protegida pela sessão do servidor e pelo escopo de `owner_email`.

## Política de senha produtiva

- 12 a 128 caracteres;
- ao menos uma letra maiúscula, uma minúscula, um número e um símbolo;
- sem espaços no início ou no fim;
- sem nome, partes relevantes do e-mail, credenciais de demonstração ou termos previsíveis;
- sem rotação periódica arbitrária;
- troca obrigatória após criação, redefinição administrativa ou importação.

Senhas são derivadas com `scrypt`, salt individual, marcador de política versionado e comparação em tempo constante. Uma credencial inexistente passa por uma verificação dummy equivalente para reduzir enumeração temporal. O marcador legado permanece fail-closed: ao abrir uma base demonstrativa em produção, a conta precisa definir uma senha forte antes de continuar.

## Proteções de sessão e login

- duração absoluta configurável por `BANCUS_SESSION_TTL_MINUTES`, limitada entre 15 minutos e 24 horas;
- revogação individual em logout e revogação total em `POST /api/auth/logout-all`;
- cinco falhas da mesma conta, ou do mesmo par IP/conta, em uma janela de 15 minutos bloqueiam novas tentativas desse escopo por 15 minutos;
- o limite bruto por IP é mais alto e protege o processo sem transformar um proxy compartilhado em bloqueio global de cinco tentativas;
- a resposta de bloqueio é genérica, usa `429` e envia `Retry-After: 900`;
- falhas de login não persistem o e-mail informado: a auditoria usa um pseudônimo HMAC curto e o motivo técnico;
- corpos de login e troca de senha são limitados a 4 KiB;
- mutações produtivas exigem `Origin` igual a `BANCUS_PUBLIC_ORIGIN` ou à origem do próprio host;
- o login recebe CSP, bloqueio de framing, `nosniff`, `no-store` e política de referência restritiva.

## Permissões

- `admin`: administra usuários e consulta dados globais somente com sessão válida;
- `consultor`: acessa registros próprios, opera leads e pode revisar, publicar ou revogar compartilhamentos de proposta próprios;
- `cliente`: acessa simulações, propostas e demais registros próprios, mas não opera leads nem publica/revoga compartilhamentos consultivos;
- tentativas cross-owner são recusadas pelo servidor, independentemente do estado visual do navegador.

Novas diferenças de produto entre consultor e cliente devem ampliar esta matriz sem reduzir o isolamento de proprietário já aplicado.

## Bootstrap do primeiro administrador

O modo produtivo não cria usuários automaticamente. Para provisionar o primeiro administrador, injete as três variáveis no gerenciador de segredos e execute uma única vez:

```powershell
$env:BANCUS_AUTH_MODE = 'production'
$env:BANCUS_BOOTSTRAP_ADMIN_NAME = 'Nome do administrador'
$env:BANCUS_BOOTSTRAP_ADMIN_EMAIL = 'admin@example.com'
$env:BANCUS_BOOTSTRAP_ADMIN_PASSWORD = '<senha-temporaria-forte>'
pnpm bootstrap:admin
```

O comando não imprime a senha, marca troca obrigatória e falha se o e-mail já existir. Remova as variáveis de bootstrap após a execução.

## Configuração produtiva mínima

```dotenv
BANCUS_AUTH_MODE=production
BANCUS_SESSION_TTL_MINUTES=480
BANCUS_AUTH_LOGIN_GUARD_MAX_ENTRIES=10000
BANCUS_AUTH_COOKIE_SECURE=true
BANCUS_PUBLIC_ORIGIN=https://app.exemplo.com.br
BANCUS_DB_PROVIDER=postgresql
BANCUS_DB_SEED_USERS=false
```

O servidor HTTP local aceita `BANCUS_AUTH_COOKIE_SECURE=false` apenas em loopback para homologação. Fora de loopback, termine TLS no proxy e preserve `X-Forwarded-Proto: https`.

### Proxy e pseudônimos de auditoria

O endereço encaminhado só é aceito quando `BANCUS_TRUST_PROXY=true` e o endereço remoto da conexão aparece exatamente em `BANCUS_TRUSTED_PROXY_IPS`. A cadeia `X-Forwarded-For` é lida da direita para a esquerda, descartando apenas proxies explicitamente confiáveis. Não use curingas nem ative essa opção se o processo também puder receber tráfego direto.

Defina `BANCUS_AUTH_AUDIT_HMAC_SECRET` no gerenciador de segredos para manter pseudônimos de auditoria estáveis entre reinícios. Quando vazio, o processo gera um segredo efêmero; isso protege a identidade informada, mas impede correlação histórica depois de reiniciar.

`BANCUS_AUTH_LOGIN_GUARD_MAX_ENTRIES` define o hard cap local do guard de login: padrão `10000`, mínimo `32` e máximo `100000`. Entradas ativas ou bloqueadas nunca são removidas para abrir espaço. Quando novas chaves ultrapassariam o limite, o login falha fechado com HTTP `429`, código `AUTH_RATE_LIMIT_CAPACITY` e `Retry-After`, preservando os bloqueios existentes até a expiração.

O rate limit atual vive na memória de um único processo. Um ambiente com múltiplas instâncias exige armazenamento compartilhado e limite agregado de autenticações válidas antes do corte. A gravação de auditoria também permanece best-effort e não forma uma transação atômica com todas as mutações; outbox e retenção governada pertencem à fase operacional.

## Contratos de API

- `GET /api/auth/config`
- `POST /api/auth/login`
- `GET /api/auth/me`
- `POST /api/auth/change-password`
- `POST /api/auth/logout`
- `POST /api/auth/logout-all`
- `GET/POST /api/users` e mutações em `/api/users/:id`, somente para `admin`

Nos dois providers, `updateUser`, `setUserStatus` e `deleteUser` preservam transacionalmente ao menos um administrador ativo. O SQLite adquire o lock de escrita antes de contar administradores; o PostgreSQL serializa a decisão com `pg_advisory_xact_lock`. A tentativa que removeria o último acesso administrativo retorna HTTP `409` com o código `LAST_ACTIVE_ADMIN`; uma exclusão com histórico vinculado continua retornando `BANCUS_USER_HAS_RELATED_RECORDS`.

Respostas públicas de usuário e sessão nunca incluem `password_hash`, `password_salt`, `token_hash`, senha ou token bruto no modo produtivo.

## Validação

```powershell
node tools/validate-auth-navigation.mjs
node tools/validate-auth-production.mjs
node tools/validate-auth-browser.mjs
node tools/validate-local-database.mjs
node tools/validate-database-provider.mjs
```

`validate-auth-production.mjs` prova: startup fechado, ausência de seeds, cookie sem token no JSON, troca obrigatória, rotação e revogação, bloqueio por tentativas, hard cap fail-closed sem remoção do lock alvo, proteção de origem, matriz de papéis, PATCH administrativo seguro, corte de credencial legada, CSP do login e auditoria sem identidade informada.

`validate-auth-browser.mjs` executa a jornada produtiva no Chromium: erro intencional e foco, troca obrigatória, retorno seguro ao simulador, cookie `HttpOnly`, nova aba hidratada pelo servidor, rejeição de descriptor local forjado, console limpo e reflow a 320 px. As evidências ficam em `docs/test-reports/auth-browser-report.json` e `docs/test-prints/auth-production-*.png`.

Limites atuais: o gate PostgreSQL permanece baseado no adapter e no banco simulado do repositório; a homologação contra uma instância PostgreSQL externa ainda precisa ser executada antes do corte online. O navegador local prova a semântica do cookie em loopback HTTP; TLS, proxy e cookie `Secure` precisam do smoke do ambiente de homologação.
