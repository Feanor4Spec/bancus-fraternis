# Presets de Comparacao por Objetivo - Bank Fratern

Atualizado em 2026-04-25.

## Objetivo

Reduzir friccao no comparador multi-produto. Em vez de o usuario montar a matriz do zero, ele escolhe um objetivo e o sistema seleciona colunas, urgencia, prioridade e premissas iniciais.

## Presets implementados

| Preset | Colunas | Uso |
| --- | --- | --- |
| Manual | Escolha livre | Mantem controle total do usuario |
| Comprar bem | Financiamento, Consorcio, Garantia | Compra relevante com alternativas de credito e planejamento |
| Obter liquidez | CDC, Garantia, Consignado | Necessidade de caixa e disponibilidade rapida |
| Trocar veiculo | Financiamento, Consorcio, Compra responsavel | Compra ou troca de automovel |
| Consumo pontual | CDC, Pagar a vista, Compra parcelada | Compra menor com impacto de reserva |

## Arquivos

- UI: `pages/comparador.html`
- Aplicacao dos presets: `assets/js/bf-platform.js`
- Motor de decisao: `assets/js/services/comparador.service.js`
- Catalogo usado no resumo: `assets/data/produtos.json`

## Regras

- O preset aplica campos e colunas, mas o usuario pode editar tudo depois.
- O modo Manual preserva a configuracao atual.
- O resumo do preset exibe produtos do catalogo local.
- A memoria de calculo registra o preset aplicado quando ele nao e Manual.
- Decisao por rapidez funciona com qualquer conjunto de credito imediato, nao apenas financiamento.

## Proxima evolucao

Salvar presets favoritos em `localStorage` e permitir que `produtos.html` abra o comparador com preset pre-selecionado por query string.
