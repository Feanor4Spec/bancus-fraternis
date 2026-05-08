# Comparador de Decisao do Usuario - Bank Fratern

Atualizado em 2026-04-26.

## Objetivo

Transformar o comparador em uma experiencia de decisao financeira. A tela deixa de responder apenas "qual produto custa menos" e passa a responder "qual caminho combina melhor com o perfil, urgencia e capacidade do usuario".

## Pagina

- Rota: `pages/comparador.html`
- Entrada recomendada: `http://127.0.0.1:8080/pages/comparador.html`
- Servico: `assets/js/services/comparador.service.js`
- Renderer: `assets/js/bf-platform.js`
- Estilos: `assets/css/platform.css` + `assets/css/bf-design-system-v8.css`

## Camada visual v8

- `data-v8-stagebar`: conecta Perfil, Entrada, Decisao, Memoria e Continuidade.
- `data-comparator-decision-strip`: resume entrada, decisao, risco principal e proxima acao.
- `data-comparator-bridge-timeline`: mostra a continuidade entre perfil financeiro, matriz, decisao, memoria e dashboard/handoff.
- `#memoria-comparador`: ancora da memoria de calculo usada pela stagebar.
- `document.body.dataset.comparatorBridgeReady='true'`: sinal de teste de que a ponte visual foi renderizada.

## Campos usados

| Grupo | Campo | Uso |
| --- | --- | --- |
| Compra | Valor do bem | Base para financiamento e carta de consorcio |
| Compra | Entrada | Reduz principal financiado |
| Financiamento | Taxa ao mes | Calcula Price ou SAC |
| Financiamento | Sistema | Alterna Price/SAC |
| Consorcio | Taxa de administracao | Compoe custo total do consorcio |
| Consorcio | Fundo de reserva | Compoe custo total do consorcio |
| Consorcio | Lance | Simula desembolso e amortizacao na contemplacao |
| Consorcio | MOB contemplado | Explicita o mes simulado de contemplacao |
| Perfil | Renda mensal | Mede comprometimento e capacidade |
| Perfil | Custos mensais | Estima sobra e reserva necessaria |
| Perfil | Dividas mensais | Reduz capacidade segura |
| Perfil | Reserva atual | Sinaliza risco de liquidez |
| Decisao | Urgencia | Alta urgencia prioriza disponibilidade |
| Decisao | Prioridade | Menor custo, menor parcela, liquidez ou rapidez |

## Regras de decisao

| Cenario | Regra aplicada | Resultado esperado |
| --- | --- | --- |
| Prioridade menor custo | Seleciona menor `totalPago` | Decisao por eficiencia financeira |
| Prioridade menor parcela | Seleciona menor `primeiraParcela` | Decisao por fluxo mensal |
| Prioridade liquidez | Prioriza menor impacto mensal inicial | Alerta para preservar caixa |
| Urgencia alta ou rapidez | Prioriza financiamento quando disponivel | Alerta se custo total for maior |
| Reserva incompleta | Calcula gap para seis meses de custos | Alerta de liquidez |
| Parcela acima da capacidade | Compara primeira parcela com capacidade segura | Alerta de risco de pagamento |

## Saidas entregues

- Decisao recomendada com titulo, alternativa vencedora e justificativa.
- Perfil usado na decisao: renda, capacidade segura, reserva e urgencia.
- Cards lado a lado de financiamento e consorcio.
- Matriz comparativa com total pago, primeira parcela, ultima parcela, prazo e score.
- Riscos explicaveis: capacidade, reserva, urgencia de contemplacao e premissas educativas.
- Memoria de calculo textual.
- Botao para salvar cenario no historico local.
- Ponte visual com quatro cards de decisao e timeline de continuidade para dashboard/handoff.

## Persistencia local

Ao salvar o cenario, a tela grava:

- `localStorage['bf_financial_profile_v1']`: renda, custos, dividas, reserva, capacidade e comprometimento.
- `localStorage['bf_calculator_history_v1']`: historico com `calculatorSlug='comparador'`.

O dashboard cliente e o hub de calculadoras tratam esse slug como rota especial e reabrem `comparador.html`.

## Proximas evolucoes

1. Revisar `pages/produtos.html` e `pages/calculadoras.html` para que a entrada do usuario use a mesma linguagem de ponte visual.
2. Integrar premissas editaveis da governanca para taxas padrao por produto.
3. Adicionar grafico de fluxo de caixa mensal por alternativa.
4. Criar modo consultor com comentario salvo e exportacao da recomendacao.
