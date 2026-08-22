# PostgreSQL Piloto - Bancus Fraternis

Atualizado em 2026-08-22.

## Estado

O adapter PostgreSQL, as migrations e o smoke test local com pool injetado estao implementados. SQLite continua sendo o padrao de desenvolvimento. A aprovacao final de homologacao depende de executar o mesmo contrato contra uma instancia PostgreSQL externa fornecida pelo ambiente; nenhuma URL ou credencial de banco fica no repositorio.

## Contrato De Ativacao

O provider so muda quando as duas variaveis abaixo estiverem presentes no ambiente:

```powershell
$env:BANCUS_DB_PROVIDER = 'postgresql'
$env:BANCUS_DATABASE_URL = '<fornecida-pelo-gerenciador-de-segredos>'
```

O servidor nao converte uma falha de URL, driver, conexao ou schema em SQLite. Ele responde `503` em `/api/health`, com mensagem sanitizada, ate o ambiente ser corrigido.

## Preparacao

1. Instale as dependencias travadas pelo lockfile:

```powershell
pnpm install --frozen-lockfile
```

2. Aplique as migrations nesta ordem, por uma identidade com permissao de DDL:

```text
js/backend/migrations/postgresql/001_bancus_fraternis.sql
js/backend/migrations/postgresql/002_proposal_secure_share.sql
```

3. Configure SSL, pool e timeouts conforme `.env.example`. Em host remoto, o adapter exige SSL seguro; excecoes sem verificacao de certificado nao sao aceitas pelo piloto. Parametros de conexao presentes na query string da URL nao podem reduzir TLS ou timeouts: o adapter extrai apenas host, porta, usuario, senha e banco, e aplica os limites operacionais separadamente.

O adapter limita conexao a 5 segundos e query a 12 segundos. O cliente web aguarda 20 segundos, evitando declarar fallback enquanto uma escrita dentro do orcamento do servidor ainda pode confirmar.

4. Inicie o servidor somente depois de guardar a URL no gerenciador de segredos:

```powershell
$env:BANCUS_DB_PROVIDER = 'postgresql'
pnpm start
```

O bind padrao e `127.0.0.1`. Para um container de homologacao, `BANCUS_HOST=0.0.0.0` deve ser configurado explicitamente e protegido por proxy TLS; nao exponha diretamente a porta Node. O servidor estatico entrega somente os diretorios publicos `pages`, `assets`, `css`, `data_base` e o JavaScript do navegador. Banco local, `.git`, `.env`, dependencias, fontes de backend e arquivos da raiz sao negados.

## O Que O Boot Valida

- conexao com o PostgreSQL;
- oito tabelas operacionais e migration `001` confirmada;
- tabelas imutaveis de snapshot/link da proposta e migration `002` confirmada;
- provider unico para API, simulacao, proposta publicada e revogacao;
- ausencia de criacao automatica de contas demonstrativas;
- falhas sem eco da URL, usuario ou senha do banco.

Eventos de auditoria usam um envelope parseavel acima de 50 mil caracteres. Snapshots de simulacao e proposta preservam ate 4 MiB; acima disso a escrita e rejeitada explicitamente com HTTP `413`, sem confirmar um registro parcial. Uma indisponibilidade isolada da trilha de auditoria nao converte uma operacao de negocio ja confirmada em erro tardio ao cliente.

O endpoint `GET /api/health` so retorna `200` quando o banco principal e o repositório seguro de propostas estao prontos. O campo `proposalShare.provider` deve ser igual a `postgresql`.

## Validacao

O gate local, sem credenciais externas, cobre contrato, falhas explicitas, pool, SSL, migrations, CRUD, escopo por usuario, sanitizacao, ciclo completo da proposta e regressao HTTP:

```powershell
node tools/validate-database-provider.mjs
node tools/validate-local-database.mjs
node tools/validate-proposal-secure-share.mjs
```

O relatorio `docs/test-reports/database-provider-report.json` registra `realPostgresqlConnectionUsed: false` e uma pendencia externa ate a execucao em homologacao. Essa pendencia nao deve ser removida por mock.

## Retorno Para Desenvolvimento Local

O retorno e explicito e nao altera dados do PostgreSQL:

```powershell
$env:BANCUS_DB_PROVIDER = 'sqlite'
Remove-Item Env:BANCUS_DATABASE_URL -ErrorAction SilentlyContinue
pnpm start
```

O rollback SQL e reservado a banco vazio, restauracao controlada ou ambiente descartavel. Quando realmente necessario, execute obrigatoriamente na ordem inversa: `postgresql/002_proposal_secure_share.rollback.sql` e depois `postgresql/001_bancus_fraternis.rollback.sql`. Para uma reversao de aplicacao, prefira trocar o provider e preservar o banco para diagnostico.

## Limite De Aprovacao

O codigo pode ser aprovado localmente com o gate injetado. O ambiente PostgreSQL so recebe decisao `Go` depois de: migrations aplicadas, `/api/health` verde, CRUD temporario reconciliado, proposta publicada/resolvida/revogada entre instancias e evidencia de backup do ambiente.
