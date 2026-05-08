# Decisao de Compra Responsavel - Bancus Fraternis

Atualizado em 2026-04-25.

## Objetivo

Evoluir a calculadora `Compra a Vista ou Parcelado` para uma decisao de consumo conectada ao perfil financeiro. A resposta deixa de ser apenas matematica e passa a considerar liquidez, renda, reserva e prioridade do usuario.

## Rota

- Pagina: `pages/calculadora-compra-vista-parcelado.html`
- URL local: `http://127.0.0.1:8080/pages/calculadora-compra-vista-parcelado.html`
- Catalogo: `assets/data/calculadoras.json`
- Motor: `assets/js/services/calculadoras.service.js`

## Campos

| Campo | Uso |
| --- | --- |
| Preco cheio | Base nominal da compra |
| Desconto a vista | Calcula preco efetivo a vista |
| Numero de parcelas | Horizonte do parcelamento |
| Valor da parcela | Fluxo mensal assumido |
| Taxa de oportunidade ao mes | Desconta as parcelas a valor presente |
| Renda mensal | Mede peso da parcela |
| Custos mensais | Estima reserva ideal de seis meses |
| Reserva atual | Mede liquidez antes e depois da compra |
| Prioridade da decisao | Equilibrio, menor custo ou preservar caixa |

## Regras

| Criterio | Regra |
| --- | --- |
| Valor presente | Compara preco a vista contra VP das parcelas |
| Menor custo | Favorece a vista quando desconto vence no nominal e no VP |
| Preservar caixa | Favorece parcelar se pagar a vista derruba reserva abaixo de seis meses |
| Risco de consumo | Recomenda rever compra se nao ha caixa suficiente e a parcela pesa na renda |
| Perfil local | Salva taxa de oportunidade, renda, custos, reserva, parcela de consumo e ultima decisao |

## Saidas

- Decisao sugerida.
- Preco a vista.
- Valor presente do parcelamento.
- Reserva apos pagamento a vista.
- Parcela como percentual da renda.
- Diferenca de valor presente.
- Memoria de calculo explicavel.
- Tabela com alternativa a vista versus parcelada.

## Proxima evolucao

Conectar esta decisao ao `comparador.html` como uma coluna opcional do comparador multi-produto, permitindo comparar credito, consorcio e consumo parcelado no mesmo fluxo.
