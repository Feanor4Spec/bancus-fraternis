# Comparador Multi-Produto - Bank Fratern

Atualizado em 2026-04-25.

## Objetivo

Ampliar o comparador para uma matriz de decisao multi-produto. A tela agora permite comparar financiamento, consorcio, CDC, credito com garantia, consignado e consumo responsavel no mesmo fluxo.

## Arquivos

- Pagina: `pages/comparador.html`
- Motor: `assets/js/services/comparador.service.js`
- Renderer: `assets/js/bf-platform.js`
- Estilo: `assets/css/platform.css`
- Servicos usados: `financiamento.service.js`, `consorcio.service.js`, `cdc.service.js`, `garantia.service.js`, `consignado.service.js`

## Colunas opcionais

| Coluna | Fonte de calculo | Uso |
| --- | --- | --- |
| Financiamento | `BFFinanciamentoService` | Posse rapida com SAC/Price |
| Consorcio | `BFConsorcioService` | Planejamento e contemplacao simulada |
| CDC | `BFCdcService` | Credito direto com taxa e tarifas |
| Credito com garantia | `BFGarantiaService` | Credito com LTV e ativo em garantia |
| Consignado | `BFConsignadoService` | Credito com margem consignavel |
| Pagar a vista | Regra local de consumo | Menor custo nominal com impacto de caixa |
| Compra parcelada | Regra local de consumo | Preservacao de caixa com parcelas |

## Decisao principal

Quando a matriz mistura credito e consumo, o motor usa produtos de credito como conjunto principal de decisao. As colunas de consumo continuam visiveis, mas nao distorcem a recomendacao principal quando o valor de consumo e diferente do valor de credito.

## Regras novas

| Cenario | Tratamento |
| --- | --- |
| Todas as colunas ligadas | Matriz dinamica com cards, tabela e riscos |
| Urgencia alta | Prioriza alternativa imediata de credito |
| Consignado fora da margem | Alerta de elegibilidade |
| Garantia selecionada | Alerta sobre LTV, formalizacao e risco do ativo |
| A vista reduz reserva | Alerta de liquidez |
| Consumo selecionado | Aparece como apoio para decisao de compra |

## Proxima evolucao

Criar presets por objetivo usando `assets/data/produtos.json`, como "comprar bem", "obter liquidez", "trocar veiculo" e "consumo pontual", com colunas pre-selecionadas automaticamente.
