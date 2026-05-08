# Comparador - Recomendacao Automatica de Modelos

Atualizado em 2026-04-25.

## Objetivo

Transformar a biblioteca de modelos padrao em uma experiencia ativa: o sistema sugere o melhor modelo inicial para o usuario, explica os motivos e permite clonar/aplicar a matriz no comparador em um clique.

## Entregas

- Servico `assets/js/services/modelos-recomendacao.service.js`.
- Bloco `data-comparator-model-recommendation` em `pages/comparador.html`.
- Recomendacao com score de aderencia de 0 a 100.
- Motivos explicaveis por modelo.
- Acao `Clonar e aplicar` no comparador.
- Ordenacao inteligente da biblioteca.
- Destaque `Recomendado para seu perfil` no dashboard cliente.

## Entradas usadas no score

| Entrada | Origem |
| --- | --- |
| Preset/objetivo | Campo do comparador ou query string |
| Urgencia | Comparador ou perfil financeiro local |
| Prioridade | Comparador ou perfil financeiro local |
| Renda, custos, dividas e reserva | Perfil financeiro local ou formulario |
| Valor do bem e valor de credito | Comparador ou perfil local |
| Produtos ativos | Checkboxes da matriz |
| Status publicado | Biblioteca de modelos padrao |

## Regras de recomendacao

- `obter_liquidez` ganha peso quando urgencia e alta ou prioridade e rapidez.
- `comprar_bem` ganha peso quando o valor do bem e alto, ha entrada e a urgencia nao e alta.
- `trocar_veiculo` ganha peso para faixas de valor compativeis com bem duravel ou automovel.
- `consumo_pontual` ganha peso quando o valor e menor, ha consumo parcelado ou prioridade de preservar caixa.
- Modelos publicados recebem bonus.
- Modelos desalinhados com valor, urgencia ou prioridade recebem desconto.

## Fluxo validado

1. Usuario cliente tem perfil local com urgencia alta e prioridade rapidez.
2. Comparador abre com `?preset=obter_liquidez`.
3. Sistema recomenda `std-liquidez-rapida` com score `100/100`.
4. Usuario clica `Clonar e aplicar`.
5. Modelo e salvo no escopo do usuario e aplicado na matriz.
6. Matriz recalcula CDC, credito com garantia e consignado.
7. Biblioteca mostra o recomendado em primeiro.
8. Dashboard cliente exibe `Recomendado para seu perfil`.

## Guardrails

- A recomendacao e educativa e usa premissas locais.
- O score nao representa aprovacao de credito, oferta ou consultoria regulada.
- Dados pessoais e Open Finance permanecem fora desta fase.
- Quando houver backend, os modelos recomendados devem respeitar versao publicada e trilha de auditoria server-side.

## Evidencias

- `docs/test-prints/comparador-modelo-recomendado-desktop.png`
- `docs/test-prints/comparador-modelo-recomendado-aplicado-desktop.png`
- `docs/test-prints/modelos-biblioteca-recomendacao-desktop.png`
- `docs/test-prints/dashboard-cliente-modelo-recomendado-desktop.png`
- `docs/test-prints/comparador-modelo-recomendado-mobile.png`

## Proxima evolucao

Criar uma trilha assistida de decisao, conectando diagnostico financeiro, produto sugerido, calculadoras relacionadas, modelo recomendado, comparador e proxima acao.
