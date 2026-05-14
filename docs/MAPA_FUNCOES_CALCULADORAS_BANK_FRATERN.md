# Mapa de funcoes das calculadoras - Bancus Fraternis

Data de referencia: 2026-05-11  
Escopo: 19 calculadoras ativas em `assets/data/calculadoras.json`, renderizadas por `assets/js/calculadoras-page.js` e calculadas por `assets/js/services/calculadoras.service.js`.

## Leitura executiva

As calculadoras formam a camada de diagnostico financeiro da plataforma. Cada pagina individual abre uma previa educativa sem persistir dados, permite ajustar campos, salva o cenario apenas no submit e alimenta o perfil financeiro local usado por Home, Trilha, Comparador, Simulador, Dashboard Cliente e Admin.

Correcoes deste ciclo:

- A previa inicial deixou de usar `submit` automatico.
- A previa inicial chama `window.BFCalculadoras.simulate(slug, input, { persist: false })`.
- O botao `Calcular e salvar cenario` chama `simulate(..., { persist: true })`.
- O resultado expõe `data-calculator-result-mode="preview|saved"` para QA e jornada.
- Campos expõem `data-calculator-field`, `data-calculator-field-error` e alerta consolidado `data-calculator-form-alert`.
- Custos Fixos, Reserva, Capacidade, Lance e Compra têm ajuda contextual e limites especificos.
- Alertas nao bloqueantes de coerencia expõem `data-calculator-coherence-alert` e `data-calculator-coherence="ok|warn|blocked"`.
- A ponte de decisao expõe `data-calculator-next-action` e `data-calculator-next-action-card`.
- A continuidade por perfil expoe `data-calculator-profile-continuity` e `data-calculators-profile-continuity`, separando previa sem salvar, falta de renda, falta de reserva, capacidade pronta e lance sugerido.
- O validador `tools/validate-calculator-journey.mjs` executa as 19 calculadoras e garante que previa nao grava `localStorage`.

## Contratos funcionais

| Contrato | Uso atual |
| --- | --- |
| Catalogo | `assets/data/calculadoras.json`, 19 itens ativos |
| Premissas | `assets/data/calculadoras-premissas.json`, com override local opcional |
| Motor | `window.BFCalculadoras.simulate(slug, rawInput, options)` |
| Render | `window.BFCalculatorJourney` em `assets/js/calculadoras-page.js` |
| Perfil local | `localStorage['bf_financial_profile_v1']` |
| Historico local | `localStorage['bf_calculator_history_v1']`, maximo de 80 eventos |
| Governanca de premissas | `localStorage['bf_calculator_premissas_override_v1']` |
| Auditoria de decisao | `window.BFDecisionContext.recordEvent('calculator-simulated', ...)` quando persistente |

## Mapa das 19 funcoes

| # | Calculadora | Pagina | Inputs principais | Funcao/ramo do motor | Saidas e perfil gerado | Continuidade sugerida |
| --- | --- | --- | --- | --- | --- | --- |
| 1 | Juros Compostos | `pages/calculadora-juros-compostos.html` | `valorInicial`, `aporteMensal`, `taxaAnual`, `prazoMeses` | `case 'juros-compostos'`, `compoundFutureValue` | Patrimonio projetado, investido, juros; grava `patrimonioEstimado` e `capacidadeAporte` | Primeiro Milhao, Aposentadoria, Renda Fixa |
| 2 | Juros Simples | `pages/calculadora-juros-simples.html` | `capital`, `taxaPeriodo`, `periodos` | `case 'juros-simples'`, `simpleInterest` | Montante, juros e taxa; educacional, sem perfil critico | Pix Parcelado, Compra, CDB |
| 3 | Primeiro Milhao | `pages/calculadora-primeiro-milhao.html` | `meta`, `valorInicial`, `aporteMensal`, `taxaAnual`, `prazoMeses` | `case 'primeiro-milhao'`, `monthsToGoal`, `requiredPayment` | Prazo estimado, aporte necessario; grava objetivo patrimonial | Juros Compostos, Aposentadoria, Custos Fixos |
| 4 | Aposentadoria | `pages/calculadora-aposentadoria.html` | `idadeAtual`, `idadeAlvo`, `patrimonioAtual`, `aporteMensal`, `patrimonioDesejado`, `taxaAnual` | `case 'aposentadoria'`, `compoundFutureValue`, `requiredPayment` | Patrimonio projetado, aporte necessario, gap; grava objetivo e patrimonio | Renda, Juros Compostos, Primeiro Milhao |
| 5 | Calculadora de Renda | `pages/calculadora-renda.html` | `patrimonioInicial`, `retiradaMensal`, `taxaAnual`, `prazoMeses` | `case 'renda'`, `withdrawalFutureValue` | Saldo final, retiradas, prazo; grava patrimonio e renda desejada | Aposentadoria, Juros Compostos, Renda Fixa |
| 6 | Reserva de Emergencia | `pages/calculadora-reserva-emergencia.html` | `gastoMensal`, `mesesCobertura`, `reservaAtual` | `case 'reserva-emergencia'`, `emergency` | Reserva ideal, gap, meses cobertos; grava reserva, gasto e cobertura | Custos Fixos, Poupanca x Selic, Renda Fixa |
| 7 | Poupanca x Selic | `pages/calculadora-poupanca-selic.html` | `valorInicial`, `aporteMensal`, `prazoMeses`, `selicAnual`, `trAnual` | `case 'poupanca-selic'`, `savingsVsSelic` | Comparativo de retorno; grava `taxaOportunidadeMes` | Reserva, Renda Fixa, CDB |
| 8 | Comparador de Renda Fixa | `pages/calculadora-renda-fixa.html` | `valor`, `prazoDias`, indexador/taxa dos produtos A e B | `case 'renda-fixa'`, `fixedIncomeReturn` | Liquido A/B, vencedor e tabela; grava taxa de oportunidade | CDB, Poupanca, Juros Compostos |
| 9 | Compra a Vista ou Parcelado | `pages/calculadora-compra-vista-parcelado.html` | Preco, desconto, parcelas, taxa, renda, custos, reserva, prioridade | `case 'compra-vista-parcelado'`, `presentValueOfPayments` + regras de liquidez | Recomenda vista/parcelado, impacto de reserva e renda; grava ultima decisao de compra | Pix Parcelado, Renda Fixa, Reserva |
| 10 | Pix Parcelado | `pages/calculadora-pix-parcelado.html` | `valor`, `taxaMes`, `prazo` | `case 'pix-parcelado'`, `financedAmount`/equivalentes do motor | Custo total, juros e parcelas; sinaliza custo de credito curto | Compra, Juros Simples, Custos Fixos |
| 11 | Alugar x Financiar | `pages/calculadora-alugar-financiar.html` | Imovel, entrada, aluguel, taxas, valorizacao, prazo | `case 'alugar-financiar'` | Patrimonio projetado nas duas alternativas; grava objetivo patrimonial quando aplicavel | Renda Fixa, Aposentadoria, Compra |
| 12 | Comparador de Cartoes | `pages/calculadora-cartoes.html` | `rendaMensal`, `gastoCartao`, `preferencia` | `case 'cartoes'` com premissas de cartoes | Ranking de cartoes, custo/beneficio; grava perfil de consumo | Custos Fixos, Compra, Realidade Brasileira |
| 13 | Realidade Brasileira | `pages/calculadora-realidade-brasileira.html` | `salarioLiquido`, `uf` | `case 'realidade-brasileira'` com faixas locais | Posicao relativa de renda; grava renda mensal e UF | Custos Fixos, Reserva, Cartoes |
| 14 | Simulador de Rentabilidade | `pages/calculadora-rentabilidade.html` | `valorInicial`, `aporteMensal`, `perfilCarteira`, `anos` | `case 'rentabilidade'` com carteiras demonstrativas | Projecao por perfil, tabela de cenarios; grava patrimonio e taxa | Acoes, Renda Fixa, Aposentadoria |
| 15 | Comparador de Acoes | `pages/calculadora-acoes.html` | `ativoA`, `ativoB`, `ativoC`, `criterio` | `case 'acoes'` com ativos demonstrativos | Ranking por criterio; educacional, sem recomendacao individual | Rentabilidade, Renda Fixa, Aposentadoria |
| 16 | Calculadora de CDB | `pages/calculadora-cdb.html` | `valor`, `percentualCdi`, `cdiAnual`, `prazoDias` | `case 'cdb'`, `fixedIncomeReturn` | Valor liquido, rendimento bruto, IR; grava taxa de oportunidade | Renda Fixa, Poupanca, Juros Compostos |
| 17 | Capacidade de Credito | `pages/calculadora-capacidade-credito.html` | Renda, gastos, dividas, reserva, comprometimento, margem e reserva minima | `case 'capacidade-credito'`, regras de parcela segura e folga | Parcela segura, comprometimento, prontidao; grava `capacidadePagamento` | Custos Fixos, Reserva, Lance |
| 18 | Lance em Consorcio | `pages/calculadora-lance-consorcio.html` | Carta, reserva, gasto, capacidade, lance desejado, limite e reserva minima | `case 'lance-consorcio'`, regras de lance seguro | Lance seguro, impacto na reserva, lance sugerido; grava carta e lance | Capacidade, Reserva, Compra |
| 19 | Custos Fixos | `pages/calculadora-custos-fixos.html` | Renda liquida, moradia, alimentacao, transporte, dividas, outros | `case 'custos-fixos'`, `fixedCosts` | Sobra, comprometimento, faixa; grava renda, gasto, dividas, capacidade e readiness | Reserva, Compra, Primeiro Milhao |

## Jornada corrigida

1. Hub `pages/calculadoras.html` apresenta trilhas e cards por categoria.
2. Pagina individual renderiza defaults do perfil financeiro local.
3. Resultado inicial aparece como `preview`, sem gravar historico, perfil ou auditoria.
4. Usuario ajusta campos; valores validos atualizam a previa sem persistencia.
5. Campos invalidos mostram erro local e bloqueiam o salvamento.
6. Campos coerentes geram `ok`; cenarios arriscados geram alerta nao bloqueante.
7. CTA principal muda conforme risco: revisar custos, montar reserva, calcular capacidade, ajustar lance, comparar ou simular.
8. Ponte de continuidade consulta o perfil consolidado para decidir entre salvar a previa, completar renda, checar reserva, calcular capacidade ou simular com lance.
9. Usuario clica `Calcular e salvar cenario`.
10. Resultado passa para `saved`, grava `historyId`, atualiza perfil local e registra evento de decisao.
11. Ponte contextual preserva `calculatorSlug`, `historyId`, `preset` e origem para Simulador, Trilha, Comparador e Dashboard Cliente.

## Debitos tratados neste ciclo

- Removido submit automatico que salvava cenario sem acao explicita.
- Adicionado marcador de modo do resultado para QA automatizado.
- Criado validador de jornada das 19 calculadoras com simulacao de previa e submit persistente.
- Adicionada validacao guiada por campo antes de preview/salvamento.
- Adicionados alertas de coerencia para cenarios de renda, reserva, credito, lance e compra.
- Adicionada proxima acao dinamica para destacar o CTA correto por risco.
- Adicionada continuidade por perfil para ajustar CTA e timeline conforme perfil real salvo.

## Proximas evolucoes recomendadas

| Prioridade | Evolucao | Motivo |
| --- | --- | --- |
| P0 | Revisar textos e labels das 19 calculadoras em linguagem de decisao | Reduzir friccao e deixar claro o proximo passo |
| P0 | Criar estado visual de erro por campo e validacao de intervalo | Evitar cenarios irreais antes do submit |
| P1 | Mostrar origem do dado reaproveitado no campo preenchido pelo perfil | Aumentar confianca na continuidade entre calculadoras |
| P1 | Criar comparacao lateral entre ultimo salvo e previa atual | Facilitar iteracao consultiva |
| P2 | Versionar schemas de input/output por calculadora | Preparar backend/API futura sem quebrar dados locais |
