# Migrations - Bancus Fraternis

Esta pasta versiona o schema local atual antes da troca de provider.

- `001_bancus_fraternis_local_db.sql`: schema SQLite idempotente usado como baseline.
- `001_bancus_fraternis_local_db.rollback.sql`: rollback destrutivo para bancos vazios, validadores ou rebuild local com backup explicito.
- `002_proposal_secure_share.sql`: armazenamento isolado e append-only de snapshots versionados e links seguros de proposta.
- `002_proposal_secure_share.rollback.sql`: rollback destrutivo exclusivo das tabelas de compartilhamento seguro.
- `schema-manifest.json`: contrato legivel por validadores, docs e futuro adapter produtivo.
- `postgresql/001_bancus_fraternis.sql`: baseline idempotente do provider PostgreSQL de homologacao.
- `postgresql/001_bancus_fraternis.rollback.sql`: rollback exclusivo para base descartavel ou restauravel.

Regra: toda alteracao em `js/backend/db.js` que mudar tabela, coluna, indice ou regra sensivel precisa criar uma nova migration e atualizar o manifest.

## Compartilhamento seguro de propostas

A migration `002` e aplicada pelo adapter `proposal-share-repository.js` em um arquivo SQLite separado por padrao. Isso preserva a baseline operacional existente e mantem a persistencia do Gate 4 substituivel. `proposal_snapshots` e append-only, protegida por triggers contra `UPDATE` e `DELETE`; somente o estado do link em `proposal_shares` pode mudar por expiracao ou revogacao.

Em homologacao PostgreSQL, execute `postgresql/001_bancus_fraternis.sql` e depois `postgresql/002_proposal_secure_share.sql`. O segundo schema usa o mesmo pool do provider principal, associa a proposta ao `users.id` e mantem os snapshots imutaveis. O servidor recusa habilitar o compartilhamento quando a migration `002` nao estiver confirmada.
