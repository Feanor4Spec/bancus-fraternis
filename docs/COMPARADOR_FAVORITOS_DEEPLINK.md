# Comparador - Favoritos e Entrada Direta

Atualizado em 2026-04-25.

## Objetivo

Permitir que o usuario chegue ao comparador com o objetivo ja configurado e salve um preset favorito para reutilizacao.

## Entregas

- Produtos apontam para `comparador.html?preset=<preset>`.
- O comparador aceita `preset`, `objetivo` e `produto` como parametros de URL.
- O preset aplicado por URL seleciona colunas e premissas automaticamente.
- O usuario pode salvar o preset atual como favorito.
- O usuario pode reaplicar o preset favorito no comparador.
- O estado ativo no `body` usa `data-comparator-active-preset`, sem conflitar com o campo `select[data-comparator-preset]`.

## Presets por produto

| Produto | Preset |
| --- | --- |
| Consorcio | `comprar_bem` |
| Financiamento | `comprar_bem` |
| Veiculos | `trocar_veiculo` |
| CDC | `obter_liquidez` |
| Credito com garantia | `obter_liquidez` |
| Consignado | `obter_liquidez` |

## Persistencia local

O favorito usa:

```text
localStorage['bf_comparator_favorite_preset_v1:<email-ou-anon>']
```

Quando ha usuario autenticado, o e-mail entra no escopo da chave. Sem login, o escopo usado e `anon`.

## Validacao realizada

- `comparador.html?preset=obter_liquidez` aplica CDC, Credito com garantia e Consignado.
- `produtos.html` com objetivo `Obter liquidez` atualiza `Abrir comparador 2.0` para `comparador.html?preset=obter_liquidez`.
- Cards de CDC, Credito com garantia e Consignado tambem apontam para o preset de liquidez.
- `Salvar favorito` grava `bf_comparator_favorite_preset_v1:anon`.
- `Usar favorito` reaplica o preset e recalcula a matriz.
- Mobile em `comparador.html?preset=trocar_veiculo` renderiza Financiamento, Consorcio, Pagar a vista e Compra parcelada sem overflow horizontal.

## Evidencias

- `docs/test-prints/produtos-comparador-deeplink-desktop.png`
- `docs/test-prints/comparador-favorito-desktop.png`
- `docs/test-prints/comparador-favorito-mobile.png`

## Proxima evolucao

Transformar o favorito unico em uma lista de modelos nomeados, com compartilhamento por URL e criacao a partir de uma matriz manual.
