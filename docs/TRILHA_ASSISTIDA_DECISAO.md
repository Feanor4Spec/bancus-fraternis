# Trilha Assistida de Decisao - Bancus Fraternis

Atualizado em 2026-04-25.

## Objetivo

A Trilha Assistida transforma dados isolados do usuario em uma jornada unica de decisao. Ela conecta:

| Camada | Uso na trilha | Arquivo/servico |
| --- | --- | --- |
| Perfil financeiro | Renda, custos, reserva, dividas, capacidade de pagamento e objetivo | `localStorage['bf_financial_profile_v1']` |
| Catalogo de produtos | Produto mais aderente ao objetivo e urgencia | `assets/data/produtos.json` |
| Biblioteca de modelos | Modelo padrao recomendado por perfil | `assets/data/modelos-comparador-padrao.json` |
| Comparador | Matriz acionavel por preset de objetivo | `pages/comparador.html?preset=<objetivo>` |
| Dashboard cliente | Continuidade da jornada e proxima acao | `pages/dashboard-cliente.html` |

## Fluxo funcional

1. Usuario abre `pages/trilha-decisao.html`.
2. Formulario coleta objetivo, urgencia, prioridade, risco, renda, custos, dividas, reserva, valor do objetivo e entrada.
3. `BFTrilhaDecisaoService.normalizeInput()` combina esses dados com o perfil financeiro salvo.
4. `BFTrilhaDecisaoService.rankProducts()` ranqueia produtos pelo objetivo, urgencia, prioridade, reserva e renda.
5. `BFModelosRecomendacaoService.best()` escolhe o modelo padrao mais aderente.
6. `BFTrilhaDecisaoService.build()` monta cinco etapas:
   - diagnostico financeiro;
   - produto sugerido;
   - modelo recomendado;
   - comparador por objetivo;
   - proxima acao.
7. `BFTrilhaDecisaoService.save()` grava a trilha em chave local escopada por usuario.
8. Dashboard cliente exibe a trilha ativa com produto, modelo, reserva, capacidade segura e CTA da proxima acao.

## Chaves locais

| Chave | Escopo | Conteudo |
| --- | --- | --- |
| `bf_decision_journey_v1:<email-ou-anon>` | Usuario | Trilha ativa |
| `bf_decision_journey_history_v1:<email-ou-anon>` | Usuario | Ultimas 12 trilhas |
| `bf_financial_profile_v1` | Navegador | Perfil financeiro consolidado |

## Regras de recomendacao

| Objetivo | Produtos priorizados | Preset do comparador | Calculadora de apoio |
| --- | --- | --- | --- |
| Obter liquidez | Consignado, credito com garantia, CDC | `obter_liquidez` | Reserva de emergencia |
| Comprar bem | Financiamento, consorcio, credito com garantia | `comprar_bem` | Custos fixos |
| Trocar veiculo | Veiculos, financiamento, consorcio | `trocar_veiculo` | Compra a vista ou parcelado |
| Consumo pontual | CDC, consignado, credito com garantia | `consumo_pontual` | Compra a vista ou parcelado |

## Criterios de atencao

- Perfil incompleto: se renda ou custos nao foram informados, a proxima acao vira diagnostico de custos.
- Reserva baixa: se a reserva cobre menos de tres meses, a trilha recomenda validar reserva antes de contratar credito caro.
- Garantia com pouco caixa: credito com garantia perde score quando a reserva e baixa.
- Urgencia alta: produtos de baixa urgencia, como consorcio, perdem aderencia.

## Aceite da fase 4N

- `pages/trilha-decisao.html` renderiza formulario, resumo, etapas, ranking de produtos e proxima acao.
- Submeter a trilha salva o estado por usuario em `bf_decision_journey_v1:<email>`.
- Abrir o dashboard cliente mostra a trilha ativa.
- Abrir o comparador pelo CTA preserva o preset recomendado.
- Desktop e mobile nao apresentam overflow horizontal.

## Evolucao futura

- Promover trilhas salvas para lead consultivo com status comercial.
- Permitir conclusao manual de etapas e retomada por checkpoint.
- Sincronizar trilhas com backend quando a fase server-side for retomada.
- Registrar aceite do usuario para uso de dados sensiveis quando houver API real ou Open Finance.
