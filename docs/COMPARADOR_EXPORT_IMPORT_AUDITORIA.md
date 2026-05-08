# Comparador - Exportacao, Importacao e Auditoria

Atualizado em 2026-04-25.

## Objetivo

Permitir que modelos de comparacao sejam exportados, importados e auditados localmente antes da chegada de um backend.

## Entregas

- Pacote JSON com schema `bank-fratern.comparator-models.v1`.
- Exportacao pelo comparador usando `Exportar JSON`.
- Importacao pelo comparador usando `Importar JSON`.
- Metadados de versao em cada modelo.
- Auditoria local para criar, atualizar, excluir, exportar e importar modelos.
- Painel no dashboard admin para visualizar eventos recentes.

## Schema do pacote

```json
{
  "schema": "bank-fratern.comparator-models.v1",
  "exportedAt": "2026-04-25T00:00:00.000Z",
  "ownerEmail": "cliente@bankfratern.local",
  "source": "bank-fratern-local",
  "formulaVersion": "comparador.service.v7.12",
  "premiseReference": "calculadoras-premissas:2026-04-24",
  "models": []
}
```

## Chaves locais

| Chave | Funcao |
| --- | --- |
| `bf_comparator_models_v1:<email-ou-anon>` | Lista de modelos do usuario |
| `bf_comparator_model_audit_v1` | Eventos locais de auditoria |

## Eventos auditados

| Evento | Quando ocorre |
| --- | --- |
| `create` | Modelo novo salvo |
| `update` | Modelo existente atualizado pelo mesmo nome |
| `delete` | Modelo removido da lista local |
| `export` | Pacote JSON gerado |
| `import` | Pacote JSON importado |

## Metadados obrigatorios

- `formulaVersion`: `comparador.service.v7.12`.
- `premiseReference`: `calculadoras-premissas:2026-04-24`.
- `source`: origem local ou importada.
- `userEmail`: dono local do modelo.
- `productIds`: colunas/produtos ativos.
- `createdAt` e `updatedAt`: rastreabilidade temporal.

## Validacao realizada

- Modelo `Pacote liquidez auditado` salvo para `cliente@bankfratern.local`.
- Pacote JSON exportado com schema correto.
- Modelo importado novamente no escopo do usuario.
- `comparador.html?modelo=<id>` restaurou CDC, Credito com garantia e Consignado.
- Dashboard admin exibiu eventos de criacao, exportacao e importacao.
- Desktop e mobile passaram sem overflow horizontal.

## Evidencias

- `docs/test-prints/comparador-modelos-export-import-desktop.png`
- `docs/test-prints/dashboard-admin-auditoria-modelos-desktop.png`
- `docs/test-prints/comparador-modelos-export-import-mobile.png`

## Proxima evolucao

Criar uma pagina dedicada de governanca comercial para modelos, com filtros por usuario, preset, produto, origem e data.
