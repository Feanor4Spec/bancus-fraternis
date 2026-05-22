# Migrations - Bancus Fraternis

Esta pasta versiona o schema local atual antes da troca de provider.

- `001_bancus_fraternis_local_db.sql`: schema SQLite idempotente usado como baseline.
- `001_bancus_fraternis_local_db.rollback.sql`: rollback destrutivo para bancos vazios, validadores ou rebuild local com backup explicito.
- `schema-manifest.json`: contrato legivel por validadores, docs e futuro adapter produtivo.

Regra: toda alteracao em `js/backend/db.js` que mudar tabela, coluna, indice ou regra sensivel precisa criar uma nova migration e atualizar o manifest.
