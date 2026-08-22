# Leitura do analisador de schema PostgreSQL

Executado em 2026-08-22 sobre a combinacao das migrations `001` e `002`, normalizando apenas `CREATE TABLE IF NOT EXISTS` para o formato aceito pelo analisador.

## Resultado interpretado

O analisador reconheceu 11 tabelas e 110 colunas, mas seu parser encerra uma definicao no primeiro parenteses interno. Por isso nao le corretamente `CHECK (...)`, `REFERENCES tabela(coluna)`, a chave composta `PRIMARY KEY (kind, id)` nem os `CREATE INDEX IF NOT EXISTS`. Os alertas de chave primaria ausente em `journey_entities`, FKs ausentes e zero indices sao falsos positivos do parser, confirmados diretamente no DDL e pelo gate executavel.

O gate `tools/validate-database-provider.mjs` e a fonte de aceite para esta migration. Ele confirmou 10 tabelas de aplicacao, 131 colunas, 19 indices, migrations `001/002`, checksums SHA-256, FKs da proposta e os dois triggers de imutabilidade. A tabela adicional reconhecida pelo analisador e `bancus_schema_migrations`.

## Decisao de modelagem

- `events.entity_type/entity_id` permanece uma referencia polimorfica sem FK nesta fase; uma FK unica nao representaria os tres dominios de jornada.
- Campos opcionais de titulo, estado e valor permanecem nullable/zero para compatibilidade com snapshots legados e importacao assistida.
- A relacao de sessao com usuario e as relacoes da proposta estao declaradas no DDL, apesar de nao aparecerem no relatorio automatico.

Nenhuma alteracao de schema foi aplicada a partir dos falsos positivos. A validacao estrutural detalhada no boot impede liberar uma tabela parcial com o mesmo nome.
