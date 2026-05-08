# Calculadoras Funcionais Bancus Fraternis

Atualizado em 2026-04-26.

## Escopo Implementado

O Bancus Fraternis recebeu o ecossistema estatico/progressivo de calculadoras financeiras em HTML, CSS e JavaScript puro. A implementacao cria uma entrada unica em `pages/calculadoras.html`, 19 paginas individuais, catalogo JSON, premissas locais, motor comum de formulas, servico de simulacao por slug, perfil financeiro consolidado em `localStorage`, historico unificado, contexto de decisao compartilhado e recomendacoes explicaveis.

## Rotas

| Modulo | Arquivo |
|---|---|
| Hub de calculadoras | `pages/calculadoras.html` |
| Juros Compostos | `pages/calculadora-juros-compostos.html` |
| Juros Simples | `pages/calculadora-juros-simples.html` |
| Primeiro Milhao | `pages/calculadora-primeiro-milhao.html` |
| Aposentadoria | `pages/calculadora-aposentadoria.html` |
| Calculadora de Renda | `pages/calculadora-renda.html` |
| Reserva de Emergencia | `pages/calculadora-reserva-emergencia.html` |
| Poupanca x Selic | `pages/calculadora-poupanca-selic.html` |
| Comparador de Renda Fixa | `pages/calculadora-renda-fixa.html` |
| Compra a Vista ou Parcelado | `pages/calculadora-compra-vista-parcelado.html` |
| Pix Parcelado | `pages/calculadora-pix-parcelado.html` |
| Alugar x Financiar | `pages/calculadora-alugar-financiar.html` |
| Comparador de Cartoes | `pages/calculadora-cartoes.html` |
| Realidade Brasileira | `pages/calculadora-realidade-brasileira.html` |
| Rentabilidade | `pages/calculadora-rentabilidade.html` |
| Acoes | `pages/calculadora-acoes.html` |
| CDB | `pages/calculadora-cdb.html` |
| Capacidade de Credito | `pages/calculadora-capacidade-credito.html` |
| Lance em Consorcio | `pages/calculadora-lance-consorcio.html` |
| Custos Fixos | `pages/calculadora-custos-fixos.html` |

## Arquivos Tecnicos

| Arquivo | Responsabilidade |
|---|---|
| `assets/data/calculadoras.json` | Catalogo das calculadoras, campos, formulas, riscos e relacoes |
| `assets/data/calculadoras-premissas.json` | Selic, CDI, IPCA, TR, IR regressivo, cartoes, faixas e ativos demo |
| `assets/data/calculadoras-golden-tests.json` | Casos de teste deterministico das formulas financeiras |
| `assets/js/formulas/financial.formulas.js` | Juros, PMT, VP, descumulacao, reserva, IR, renda fixa e comparadores |
| `assets/js/services/calculadoras.service.js` | Simulacao por slug, perfil, historico e recomendacoes |
| `assets/js/services/decision-context.service.js` | Contexto financeiro compartilhado, prontidao, prefill do simulador e auditoria local |
| `assets/js/calculadoras-page.js` | Renderizacao do hub e paginas individuais |
| `assets/js/calculadoras-governanca.js` | Painel admin de premissas, matriz funcional e golden tests |
| `assets/css/platform.css` | UI de hub, cards, historico, perfil e resultados |
| `tools/validate-calculadoras.mjs` | Validacao automatizada de catalogo, paginas, premissas e formulas |
| `tools/validate-decision-flow.mjs` | Validacao funcional da jornada calculadora -> simulador -> historico |

## Matriz Funcional

| Calculadora | Tipo | Entradas principais | Resultados | Formula/base |
|---|---|---|---|---|
| Juros Compostos | Investimento | valor inicial, aporte, taxa, prazo | patrimonio, investido, juros | FV com aportes mensais |
| Juros Simples | Educacao | capital, taxa, periodos | juros e montante | `J = C*i*t` |
| Primeiro Milhao | Planejamento | meta, saldo, aporte, taxa, prazo | prazo estimado e aporte necessario | meta por juros compostos |
| Aposentadoria | Planejamento | idade, patrimonio, aporte, meta, taxa | patrimonio futuro, gap e aporte necessario | acumulacao ate idade-alvo |
| Renda | Planejamento | patrimonio, retirada, taxa, prazo | saldo final e total retirado | descumulacao com rendimento |
| Reserva de Emergencia | Planejamento | gasto mensal, meses, reserva atual | reserva ideal, gap, meses cobertos | gasto mensal x meses |
| Poupanca x Selic | Comparacao | valor, aporte, prazo, Selic, TR | montante por alternativa e diferenca | capitalizacao mensal |
| Renda Fixa | Comparacao | valor, prazo, indexadores, taxas | liquido, bruto, IR e vencedor | CDI/IPCA/pre + IR regressivo |
| Compra Vista ou Parcelado | Credito | preco, desconto, parcelas, taxa oportunidade, renda, custos, reserva, prioridade | preco vista, VP parcelado, reserva apos vista, parcela/renda, decisao | valor presente das parcelas + liquidez |
| Pix Parcelado | Credito | valor, taxa mensal, prazo | parcela, total, juros, cronograma | Price/PMT |
| Alugar x Financiar | Comparacao | imovel, entrada, aluguel, taxas, prazo | parcela, patrimonio em cenarios | fluxo financiamento vs investimento |
| Cartoes | Comparacao | renda, gasto, preferencia | ranking, score, anuidade | score demonstrativo |
| Realidade Brasileira | Educacao | salario liquido, UF | percentil e faixas de renda | interpolacao simplificada |
| Rentabilidade | Investimento | valor, aporte, carteira, anos | saldo, investido, resultado | serie anual demonstrativa |
| Acoes | Investimento | ativos, criterio | ranking e score | retorno, DY e volatilidade demo |
| CDB | Investimento | valor, %CDI, CDI, prazo | liquido, bruto, IR | CDI composto + IR |
| Capacidade de Credito | Credito | renda, gastos, dividas, reserva, comprometimento maximo | parcela segura, folga, comprometimento projetado e risco | menor teto entre renda e fluxo |
| Lance em Consorcio | Planejamento | carta, reserva, gasto, capacidade, lance desejado | lance seguro, impacto na reserva e limite proprio | caixa acima da reserva minima vs limite da carta |
| Custos Fixos | Planejamento | renda e despesas | sobra, comprometimento, faixa | custos / renda |

## Contexto de Decisao Compartilhado

O servico `window.BFDecisionContext` conecta calculadoras, simulador e dashboard usando apenas dados nao sensiveis.

Contrato publico:

- `BFDecisionContext.loadProfile()`
- `BFDecisionContext.saveProfilePatch(patch, source)`
- `BFDecisionContext.readiness(profile)`
- `BFDecisionContext.recommendedCalculators(profile)`
- `BFDecisionContext.buildSimulationPrefill(source)`
- `BFDecisionContext.recordEvent(type, payload)`

Chaves locais:

- `bf_financial_profile_v1`
- `bf_calculator_history_v1`
- `bf_decision_context_audit_v1`

Regra de seguranca: CPF, telefone, e-mail, nome e dados pessoais continuam fora do contexto compartilhado. Dados pessoais so entram no payload da simulacao quando o usuario salva explicitamente.

## Perfil Financeiro Consolidado

O perfil local fica em `localStorage['bf_financial_profile_v1']`.

Campos atualmente gravados:

- `rendaMensal`
- `gastoMensal`
- `reservaAtual`
- `reservaIdeal`
- `coberturaReservaPct`
- `capacidadeAporte`
- `capacidadePagamento`
- `comprometimentoRenda`
- `dividasMensais`
- `valorCredito`
- `valorCarta`
- `parcelaProjetada`
- `comprometimentoProjetado`
- `ultimoProduto`
- `lanceProprioSugerido`
- `lanceProprioSugeridoPct`
- `patrimonioEstimado`
- `objetivoPrincipal`
- `metaPatrimonial`
- `taxaOportunidadeMes`
- `uf`
- `updatedAt`

## Historico Unificado

O historico local fica em `localStorage['bf_calculator_history_v1']`, limitado a 80 registros.

Cada item salva:

- id local
- data de criacao
- slug e nome da calculadora
- inputs normalizados
- metricas principais
- recomendacao explicavel
- alteracoes aplicadas ao perfil
- prontidao e origem quando o evento vier do simulador

## Reaproveitamento de Dados

| Origem | Dados reaproveitados | Destino |
|---|---|---|
| Custos Fixos | renda, gasto mensal, sobra e capacidade | Reserva, Juros Compostos, Primeiro Milhao, Cartoes |
| Reserva | gasto, reserva atual e cobertura | Renda Fixa, Poupanca x Selic, decisoes de credito |
| Capacidade de Credito | parcela segura, folga e risco | Lance em Consorcio, Simulador completo |
| Lance em Consorcio | lance seguro, reserva preservada e carta | Simulador completo via deep link |
| Renda Fixa/CDB | taxa de oportunidade | Compra Vista ou Parcelado, Alugar x Financiar |
| Realidade Brasileira | renda e UF | Custos Fixos, Cartoes, perfil consolidado |
| Juros Compostos/Aposentadoria | patrimonio e aporte | Renda, Primeiro Milhao, dashboard cliente |

## Recomendacoes Implementadas

| Condicao | Recomendacao |
|---|---|
| reserva abaixo da meta | completar reserva antes de assumir risco |
| comprometimento alto | evitar novas parcelas e revisar custos |
| juros de Pix altos | comparar com compra a vista e preservar reserva |
| Selic/renda fixa supera poupanca | mover caixa conservador para alternativa melhor analisada |
| sobra mensal positiva | transformar sobra em aporte recorrente |
| gap de aposentadoria | revisar aporte, prazo ou taxa conservadora |
| cartao ranqueado | validar custos, limite e risco de rotativo |
| compra a vista reduz reserva abaixo de seis meses | priorizar preservacao de caixa ou recalibrar compra |

## Premissas e Compliance

- Os indices sao demonstrativos e locais, com referencia em `calculadoras-premissas.json`.
- As paginas nao consultam API viva nesta fase.
- Resultados nao representam oferta, aprovacao de credito ou recomendacao regulada.
- Dados pessoais e historico ficam apenas no navegador do usuario ate existir backend consentido.
- Open Finance fica preparado como evolucao futura, exigindo consentimento, finalidade, prazo e revogacao.

## Governanca v7.2

Nova pagina: `pages/calculadoras-governanca.html`.

Recursos:

- Acesso protegido para perfil `admin`.
- Matriz funcional das 19 calculadoras com filtros por busca, tipo e categoria.
- Painel de premissas locais para ajustar Selic, CDI, IPCA, TR e poupanca mensal via override em `localStorage['bf_calculator_premissas_override_v1']`.
- Botao para restaurar a base curada.
- Execucao visual de golden tests de formulas usando `assets/data/calculadoras-golden-tests.json`.
- Preparacao para endpoint futuro de versionamento de regras, premissas e auditoria.

Script local:

```powershell
$node='C:\Users\gustavo.pinheiro\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node tools\validate-calculadoras.mjs
```

## Criterios de Aceite

- Hub renderiza cards agrupados por categoria.
- Cada pagina renderiza hero, formulario, premissas, resultados, memoria, recomendacao e historico.
- Cada submit atualiza perfil local e historico.
- Dashboard cliente mostra o perfil consolidado e historico das calculadoras.
- Dados abertos, produtos, compliance e API Docs apontam para o novo ecossistema.
- Rotas novas respondem HTTP 200 no servidor local.
- Prints de hub, detalhe e dashboard ficam em `docs/test-prints/`.
- Painel de governanca executa golden tests e salva override local de premissas.
