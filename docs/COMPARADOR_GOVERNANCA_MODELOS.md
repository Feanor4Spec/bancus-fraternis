# Comparador - Governanca Comercial de Modelos

Atualizado em 2026-04-25.

## Objetivo

Criar uma camada operacional para revisar, filtrar, aprovar e publicar modelos de comparacao antes de torna-los padrao para consultores ou usuarios.

## Entregas

- Pagina `pages/modelos-governanca.html`.
- Script `assets/js/modelos-governanca.js`.
- Filtros por busca, usuario, preset, produto ativo e status.
- Score de qualidade por modelo.
- Status local: `draft`, `approved`, `published` e `archived`.
- Auditoria local para aprovacao, publicacao e arquivamento.
- Link no dashboard admin e no rodape compartilhado.

## Score de qualidade

O score considera:

- Nome descritivo.
- Preset base diferente de manual.
- Duas ou mais colunas/produtos ativos.
- Perfil financeiro com renda, custos e reserva.
- Versao atual da formula.
- Referencia atual de premissas.
- Origem registrada.

## Status de governanca

| Status | Uso |
| --- | --- |
| `draft` | Modelo ainda em avaliacao |
| `approved` | Modelo revisado e aceito para uso controlado |
| `published` | Modelo pronto para virar padrao operacional |
| `archived` | Modelo preservado apenas para historico |

## Auditoria

Acoes administrativas gravam eventos em:

```text
localStorage['bf_comparator_model_audit_v1']
```

Eventos novos:

- `governance:approved`
- `governance:published`
- `governance:archived`

## Validacao realizada

- Dois modelos locais foram carregados em escopos diferentes.
- Filtro por preset `obter_liquidez` reduziu a tabela para um modelo.
- Modelo `Liquidez padrao publicavel` foi publicado.
- Evento `governance:published` foi registrado na auditoria.
- Dashboard admin passou a refletir o evento publicado.
- Desktop e mobile passaram sem overflow horizontal.

## Evidencias

- `docs/test-prints/modelos-governanca-desktop.png`
- `docs/test-prints/dashboard-admin-governanca-modelos-desktop.png`
- `docs/test-prints/modelos-governanca-mobile.png`

## Proxima evolucao

Criar uma biblioteca de modelos padrao por jornada financeira, permitindo clonar modelos publicados para usuarios e consultores.
