# PostgreSQL de homologacao

`001_bancus_fraternis.sql` e a baseline idempotente do provider PostgreSQL. Ela preserva os nomes logicos, chaves, indices, escopo por `owner_email` e colunas sanitizadas usados pelo SQLite.

Aplicacao recomendada:

1. execute a migration com uma credencial de homologacao autorizada;
2. configure `BANCUS_DB_PROVIDER=postgresql` e `BANCUS_DATABASE_URL` no gerenciador de segredos;
3. execute `node tools/validate-database-provider.mjs`;
4. use o rollback apenas em uma base descartavel ou restauravel por backup.

O servidor nao aplica migration destrutiva nem recua silenciosamente para SQLite.
