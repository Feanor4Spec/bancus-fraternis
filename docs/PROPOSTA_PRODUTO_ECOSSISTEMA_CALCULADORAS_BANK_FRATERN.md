# Proposta de Produto - Ecossistema Integrado de Calculadoras Financeiras Bancus Fraternis

Atualizado em 2026-04-24.

Fonte-base: `docs/Ecossistema integrado de calculadoras financeiras para crédito e investimentos.md`.

## 1. Visao de Produto

O Bancus Fraternis deve transformar calculadoras financeiras isoladas em uma experiencia continua de decisao financeira. A proposta e criar um **hub inteligente de credito, investimento e planejamento**, onde cada simulacao deixa de ser uma pagina solta e passa a alimentar um perfil financeiro unico, historico de cenarios, comparacoes e recomendacoes personalizadas.

Pergunta central respondida pelo produto:

> Como ajudar o usuario a decidir entre tomar credito, preservar liquidez, investir melhor, reduzir custos financeiros ou planejar patrimonio usando dados reaproveitados entre calculadoras?

### Tese

- Calculadora isolada entrega uma resposta pontual.
- Calculadora integrada captura contexto, cria memoria e orienta a proxima melhor acao.
- O diferencial do Bancus Fraternis deve ser conectar credito e investimento em uma unica jornada: **caixa, divida, reserva, aporte, patrimonio e renda futura**.

## 2. Mapeamento de Calculadoras Identificadas

| # | Calculadora | Tipo principal | Papel no produto integrado | Status de regra na pesquisa |
|---|---|---|---|---|
| 1 | Juros Compostos | Investimento / planejamento | Projetar crescimento patrimonial e metas com aportes | Regra clara |
| 2 | Juros Simples | Educacao financeira | Explicar custo/rendimento linear | Regra clara, mas nao revalidada em pagina propria |
| 3 | Primeiro Milhao | Planejamento / investimento | Calcular prazo ou aporte para meta patrimonial | Regra clara por juros compostos |
| 4 | Aposentadoria | Planejamento | Estimar patrimonio e aporte para aposentadoria | Regra funcional clara |
| 5 | Calculadora de Renda | Planejamento / investimento | Simular descumulacao e vida de renda | Regra inferida por descumulacao |
| 6 | Reserva de Emergencia | Planejamento | Definir colchao minimo de liquidez | Regra clara |
| 7 | Poupanca x Selic | Comparacao / investimento | Comparar caixa conservador parado versus alternativa indexada | Regra parcialmente clara |
| 8 | Comparador de Renda Fixa | Comparacao / investimento | Comparar produtos por indexador, taxa e prazo | Regra funcional clara |
| 9 | Compra a Vista ou Parcelado | Credito / comparacao | Decidir entre usar caixa, obter desconto ou parcelar | Regra clara por valor presente |
| 10 | Pix Parcelado | Credito | Simular custo de credito de curto prazo | Regra compativel com amortizacao |
| 11 | Alugar x Financiar | Credito / planejamento | Comparar financiamento imobiliario com aluguel e investimento | Regra detalhada incompleta |
| 12 | Comparador de Cartao | Comparacao / credito | Recomendar cartao por renda, gasto e preferencia | Regra de ranking nao aberta |
| 13 | Salario diante da realidade brasileira | Educacao / planejamento | Contextualizar renda e capacidade financeira | Regra estatistica declarada |
| 14 | Simulador de Rentabilidade | Investimento / comparacao | Simular desempenho historico de carteira/ativos | Regra incompleta |
| 15 | Comparador de Acoes | Investimento / comparacao | Comparar ativos por indicadores | Regra incompleta |
| 16 | Calculadora de CDB | Investimento / comparacao | Estimar rendimento de CDB por CDI, prazo e valor | Lacuna de revalidacao |
| 17 | Custos Fixos | Planejamento | Medir comprometimento de renda e sobra financeira | Regra por faixas de saude financeira |

### Lacunas Identificadas na Pesquisa

A pesquisa nao encontrou, com o mesmo grau de detalhe, calculadoras completas para:

- CET e custo efetivo total.
- Emprestimo pessoal tradicional.
- Portabilidade de credito.
- Refinanciamento.
- Consorcio.
- Inflacao e rentabilidade real.
- Financiamento SAC versus Price.

Para o Bancus Fraternis, essas lacunas sao oportunidades naturais de expansao, principalmente porque o projeto ja possui base de simuladores de consorcio, financiamento, CDC, garantia e consignado.

## 3. Classificacao por Tipo

| Tipo | Calculadoras |
|---|---|
| Credito | Pix Parcelado, Compra a Vista ou Parcelado, Alugar x Financiar, Comparador de Cartao |
| Investimento | Juros Compostos, Primeiro Milhao, Aposentadoria, Calculadora de Renda, Poupanca x Selic, Comparador de Renda Fixa, CDB, Simulador de Rentabilidade, Comparador de Acoes |
| Comparacao | Poupanca x Selic, Comparador de Renda Fixa, Compra a Vista ou Parcelado, Alugar x Financiar, Comparador de Cartao, Comparador de Acoes |
| Planejamento | Reserva de Emergencia, Custos Fixos, Primeiro Milhao, Aposentadoria, Calculadora de Renda, Alugar x Financiar |
| Educacao financeira | Juros Simples, Salario diante da realidade brasileira, Reserva de Emergencia, Compra a Vista ou Parcelado |

## 4. Regras de Funcionamento, Campos, Resultados e Formulas

| Calculadora | Regras de funcionamento | Campos de entrada | Resultados ao usuario | Formula/base |
|---|---|---|---|---|
| Juros Compostos | Capitaliza valor inicial e aportes recorrentes por prazo e taxa | valor inicial, aporte mensal, taxa, prazo, periodicidade | saldo final, total investido, juros acumulados | `FV = PV(1+i)^n + PMT * (((1+i)^n - 1) / i)` |
| Juros Simples | Calcula juros lineares sobre capital | capital, taxa, tempo | juros, montante | `J = C*i*t`; `M = C+J` |
| Primeiro Milhao | Inverte variavel de juros compostos para achar prazo ou aporte | valor inicial, meta, taxa, aporte ou prazo | prazo estimado ou aporte necessario | juros compostos com meta-alvo |
| Aposentadoria | Projeta acumulo ate idade alvo e compara com renda desejada | idade, renda, patrimonio atual, idade alvo, objetivo, taxa, percentual de aporte | patrimonio futuro, aporte necessario, gap para aposentadoria | acumulacao + meta patrimonial |
| Calculadora de Renda | Simula retirada periodica sobre patrimonio rendendo | patrimonio inicial, retirada mensal, taxa, prazo | saldo remanescente, meses sustentaveis, risco de exaustao | `FV = PV(1+i)^n - PMT * (((1+i)^n - 1) / i)` |
| Reserva de Emergencia | Multiplica gasto mensal por meses de cobertura | gasto mensal, meses desejados, tipo de renda | reserva ideal, gap atual, meses cobertos | `reserva = gasto_mensal * meses` |
| Poupanca x Selic | Compara regra da poupanca com retorno atrelado a Selic/Tesouro | valor inicial, aporte, prazo, Selic/TR, impostos se aplicavel | montante por alternativa, diferenca, vencedor | regra da poupanca + capitalizacao do benchmark |
| Comparador de Renda Fixa | Compara dois produtos por indexador e prazo | tipo de produto, taxa, indexador, prazo, valor, liquidez, IR | rendimento liquido/bruto, vencedor, diferenca | pre, pos-CDI, IPCA+, IR regressivo |
| Compra a Vista ou Parcelado | Compara preco a vista com valor presente das parcelas e custo de oportunidade | preco, desconto, entrada, parcelas, taxa de oportunidade | melhor opcao, diferenca em R$, valor presente, custo de oportunidade | `VP = soma(Parcela_t/(1+k)^t)` |
| Pix Parcelado | Calcula parcela, juros e amortizacao do credito curto | valor, taxa mensal, prazo, parcela opcional | parcela, total pago, juros, saldo devedor mensal | `PMT = PV * i(1+i)^n / ((1+i)^n - 1)` |
| Alugar x Financiar | Compara fluxo de aluguel + investimento versus financiamento + ativo | valor imovel, entrada, taxa, prazo, aluguel, valorizacao, custos | cenario vencedor, patrimonio final, custo total | fluxo descontado + custo de oportunidade |
| Comparador de Cartao | Rankeia cartoes por renda, gasto, beneficios e elegibilidade | renda, gasto mensal, preferencia, perfil de uso | ranking, beneficios, elegibilidade, alertas | regra de score/catalogo |
| Salario Realidade Brasileira | Posiciona renda em distribuicao estatistica | salario liquido, UF | percentil nacional/estadual, comparacoes, leitura contextual | interpolacao estatistica |
| Simulador de Rentabilidade | Simula carteira/ativo com base historica | ativo/carteira, periodo, aporte, benchmark | evolucao, retorno, volatilidade, comparativo | serie historica + reinvestimento |
| Comparador de Acoes | Compara ativos por indicadores | tickers, periodo, metricas escolhidas | tabela comparativa, ranking, alertas | indicadores fundamentalistas/mercado |
| Calculadora de CDB | Estima rendimento do CDB | valor, prazo, percentual CDI, CDI, IR, liquidez | rendimento bruto/liquido, imposto, valor final | `FV = PV*(1+CDI*percentual)^n` ajustado |
| Custos Fixos | Mede comprometimento da renda | renda liquida, moradia, alimentacao, transporte, dividas, outros | % comprometido, sobra, faixa de saude | `comprometimento = custos_fixos/renda` |

## 5. Exemplos Praticos de Uso

| Caso | Jornada | Resultado esperado |
|---|---|---|
| Usuario quer comprar um notebook de R$ 4.000 | Usa Compra a Vista ou Parcelado; reaproveita taxa de oportunidade do perfil; compara desconto com parcelamento | Produto recomenda pagar a vista se desconto superar ganho financeiro de manter caixa investido |
| Usuario faz Pix parcelado de R$ 1.000 em 6x a 4% a.m. | Simula Pix Parcelado; compara com reserva e sobra mensal | Mostra parcela, juros e alerta se comprometer capacidade de pagamento |
| Usuario tem gasto mensal de R$ 3.000 | Usa Reserva de Emergencia com 6 meses | Meta de R$ 18.000; se tiver R$ 8.000, gap de R$ 10.000 |
| Usuario investe R$ 1.000 por mes por 20 anos a 8% a.a. | Usa Juros Compostos e Primeiro Milhao | Mostra patrimonio estimado e prazo para R$ 1 milhao |
| Usuario avalia CDB 10% a.a. versus 105% CDI | Usa Comparador de Renda Fixa | Mostra vencedor, diferenca e alerta de IR/liquidez |
| Usuario quer se aposentar aos 65 | Usa Aposentadoria e Calculadora de Renda | Calcula patrimonio-alvo, aporte mensal e retirada sustentavel |
| Usuario pensa em financiar imovel | Usa Alugar x Financiar + Renda Fixa | Compara entrada imobilizada versus investida e custo total do financiamento |

## 6. Oportunidades de Reaproveitamento de Dados

| Dado capturado | Origem | Reuso imediato |
|---|---|---|
| Renda liquida | Custos Fixos, Realidade Brasileira, cadastro | capacidade de pagamento, capacidade de aporte, elegibilidade de cartao |
| Gastos mensais | Custos Fixos, Reserva | reserva ideal, comprometimento, limite seguro de parcela |
| Sobra mensal | Custos Fixos | aporte sugerido, pagamento de divida, simulacao de metas |
| Patrimonio atual | Juros Compostos, Aposentadoria, Renda | metas patrimoniais, viver de renda, perfil de risco |
| Taxa de oportunidade | Renda Fixa, Poupanca x Selic | compra a vista/parcelado, Pix parcelado, alugar x financiar |
| Horizonte | Primeiro Milhao, Aposentadoria | recomendacao de liquidez, produto de investimento, risco |
| Preferencia por liquidez | Reserva, Renda Fixa, perfil | recomendacao de Tesouro/CDB, alertas de credito |
| Historico de parcelamento | Pix Parcelado, Compra Parcelada | score comportamental, educacao de custo financeiro |
| UF/realidade regional | Realidade Brasileira | benchmark de renda, linguagem personalizada, capacidade relativa |
| Perfil de gasto | Cartao, Custos Fixos | comparador de cartao, cashback/pontos, alerta de rotativo |

## 7. Jornada Unica do Usuario

### Fluxo proposto

1. **Diagnosticar**
   - Usuario informa renda, custos fixos, patrimonio e objetivo principal.
   - Produto calcula saude financeira, reserva ideal e capacidade de aporte/parcela.

2. **Organizar liquidez**
   - Produto verifica reserva.
   - Se reserva incompleta, prioriza liquidez antes de investimentos de risco ou credito nao essencial.

3. **Decidir entre caixa e credito**
   - Para compras, simula a vista, parcelado, Pix parcelado e custo de oportunidade.
   - Resultado mostra decisao economica e impacto na saude financeira.

4. **Comparar alternativas**
   - Produto compara renda fixa, poupanca/Selic, CDB, cartoes e financiamento/aluguel.
   - Campos ja preenchidos pelo perfil reduzem friccao.

5. **Planejar patrimonio**
   - Juros compostos, primeiro milhao, aposentadoria e renda transformam sobra mensal em plano.

6. **Recomendar proxima melhor acao**
   - O sistema explica: "complete reserva", "troque caixa parado", "evite parcelamento", "aumente aporte", "revise prazo".

7. **Acompanhar**
   - Historico de simulacoes, metas, alertas e revisoes periodicas.

### Jornada em uma frase

> O usuario entra por uma duvida financeira pontual, mas sai com um plano continuo de liquidez, credito, investimento e patrimonio.

## 8. Perfil Financeiro Consolidado

O perfil financeiro deve ser a memoria viva do produto.

| Bloco do perfil | Campos sugeridos | Uso no produto |
|---|---|---|
| Identidade financeira | renda mensal, UF, tipo de renda, estabilidade | contextualizar capacidade financeira |
| Orcamento | custos fixos, custos variaveis, dividas, sobra | calcular saude financeira e limite seguro |
| Liquidez | reserva atual, reserva ideal, meses cobertos | priorizar seguranca e curto prazo |
| Credito | parcelas ativas, taxa media, uso de parcelamento, tolerancia a prestacao | simular endividamento saudavel |
| Investimentos | patrimonio, aporte mensal, produtos atuais, liquidez | recomendar alocacao e metas |
| Objetivos | compra, reserva, imovel, aposentadoria, primeiro milhao | ordenar a jornada |
| Risco | conservador, moderado, arrojado, horizonte | adequar investimentos e comunicacao |
| Comportamento | simulacoes recentes, escolhas salvas, sensibilidade a taxa | personalizar proximas acoes |

### Indicadores derivados

| Indicador | Formula sugerida | Interpretacao |
|---|---|---|
| Capacidade de pagamento | `max(0, renda - custos - reserva_aporte_minimo)` | quanto pode virar parcela |
| Capacidade de aporte | `max(0, renda - custos - dividas)` | quanto pode virar investimento |
| Cobertura de reserva | `reserva_atual / gasto_mensal` | meses de protecao |
| Comprometimento de renda | `custos_fixos / renda` | pressao financeira |
| Alavancagem pessoal | `parcelas_credito / renda` | risco de endividamento |
| Taxa de oportunidade | melhor retorno conservador liquido disponivel | base para decisoes a vista vs parcelado |
| Score de prontidao financeira | combinacao de reserva, sobra, dividas e estabilidade | decide qual modulo priorizar |

## 9. Arquitetura Funcional da Solucao

```text
------------------------+
| Web / App Bancus Fraternis|
+-----------+------------+
            |
            v
+------------------------+
| BFF / API Gateway      |
+-----------+------------+
            |
            v
+------------------------+      +-----------------------+
| Perfil Financeiro      |<---->| Auth / Consentimento  |
+------------------------+      +-----------------------+
            |
            v
+------------------------+      +-----------------------+
| Catalogo Calculadoras  |<---->| Versionamento Regras  |
+------------------------+      +-----------------------+
            |
            v
+------------------------+      +-----------------------+
| Motor de Simulacao     |<---->| Biblioteca Formulas   |
+------------------------+      +-----------------------+
            |
            v
+------------------------+      +-----------------------+
| Historico / Cenarios   |----->| Recomendacao          |
+------------------------+      +-----------------------+
            |
            v
+------------------------+
| Analytics / Auditoria  |
+------------------------+
```

### Componentes essenciais

| Componente | Responsabilidade |
|---|---|
| Catalogo de calculadoras | Define nome, categoria, inputs, outputs, regras, versao e dependencias |
| Motor de calculo | Executa formulas deterministicas com precisao e testes |
| Biblioteca financeira | Centraliza juros, PMT, VP, CAGR, IR, CDI, IPCA, amortizacao |
| Perfil financeiro | Guarda dados reaproveitaveis e indicadores derivados |
| Historico de simulacoes | Salva cenarios e permite comparacao |
| Motor de recomendacao | Traduz resultados em proxima melhor acao |
| Memoria de calculo | Explica formulas, premissas e dependencias |
| Consentimento/privacidade | Controla uso de dados pessoais e Open Finance |
| Admin de regras | Permite publicar versoes de formulas e taxas |

## 10. Modelo de Dados Sugerido

| Entidade | Campos principais | Observacao |
|---|---|---|
| `usuario` | `id`, `email`, `status`, `created_at` | identidade |
| `perfil_financeiro` | `usuario_id`, `renda`, `custos_fixos`, `dividas`, `patrimonio`, `reserva`, `perfil_risco`, `objetivo` | memoria consolidada |
| `calculadora` | `id`, `slug`, `nome`, `tipo`, `status`, `descricao` | catalogo |
| `calculadora_versao` | `id`, `calculadora_id`, `semver`, `schema_input`, `schema_output`, `hash_regra`, `vigencia` | governanca |
| `simulacao` | `id`, `usuario_id`, `calculadora_versao_id`, `inputs`, `outputs`, `created_at` | execucao auditavel |
| `cenario` | `id`, `usuario_id`, `nome`, `simulacoes[]`, `favorito` | comparacoes salvas |
| `dependencia_financeira` | `id`, `tipo`, `fonte`, `valor`, `vigencia`, `payload` | Selic, CDI, IPCA, IR, TR, catalogos |
| `recomendacao` | `id`, `usuario_id`, `origem`, `tipo`, `mensagem`, `justificativa`, `cta`, `prioridade` | proxima melhor acao |
| `evento_analytics` | `id`, `usuario_id`, `evento`, `metadata`, `created_at` | funil e produto |
| `auditoria` | `id`, `entidade`, `acao`, `antes`, `depois`, `autor`, `created_at` | compliance |

## 11. Recomendacoes Personalizadas Possiveis

| Condicao detectada | Recomendacao | Calculadoras acionadas |
|---|---|---|
| Reserva menor que 3 meses | Priorizar formacao de reserva antes de investir em risco | Reserva, Poupanca x Selic, Renda Fixa |
| Comprometimento de renda alto | Evitar novas parcelas e revisar custos fixos | Custos Fixos, Pix Parcelado, Compra Parcelada |
| Parcela cabe, mas juros sao altos | Comparar com rendimento do caixa e sugerir pagamento a vista | Pix Parcelado, Compra a Vista, Renda Fixa |
| Dinheiro parado na poupanca | Comparar Tesouro Selic/CDB liquido | Poupanca x Selic, Comparador Renda Fixa, CDB |
| Sobra mensal positiva | Criar meta automatica de investimento | Juros Compostos, Primeiro Milhao |
| Usuario quer aposentadoria | Calcular aporte e testar renda futura | Aposentadoria, Calculadora de Renda |
| Usuario quer imovel | Comparar aluguel, financiamento e investimento da entrada | Alugar x Financiar, Renda Fixa |
| Usuario gasta muito no cartao | Sugerir cartao adequado e alertas de rotativo | Comparador de Cartao, Custos Fixos |
| Perfil conservador e liquidez alta | Recomendar produtos conservadores e comparacao liquida | Poupanca x Selic, CDB, Renda Fixa |
| Repeticao de simulacoes de credito curto | Acionar educacao sobre custo financeiro e plano de reserva | Pix Parcelado, Reserva, Juros Simples |

## 12. Priorizacao das Funcionalidades

### Criterios

- Impacto na decisao do usuario.
- Reaproveitamento de dados.
- Complexidade tecnica.
- Risco regulatorio.
- Potencial de monetizacao.
- Aderencia ao Bancus Fraternis atual.

| Prioridade | Funcionalidade | Justificativa |
|---|---|---|
| P0 | Perfil financeiro consolidado | Sem perfil unico, as calculadoras continuam isoladas |
| P0 | Catalogo de calculadoras + schemas | Permite governanca e evolucao modular |
| P0 | Motor de formulas comum | Evita duplicacao e divergencia de calculo |
| P0 | Historico de simulacoes/cenarios | Cria memoria e continuidade |
| P1 | Reserva, Custos Fixos, Compra a Vista, Pix Parcelado | Primeiro bloco de decisao diaria e saude financeira |
| P1 | Comparador Renda Fixa, Poupanca x Selic, CDB | Conecta caixa e investimento conservador |
| P1 | Recomendacoes explicaveis | Transforma resultado em proxima acao |
| P2 | Juros Compostos, Primeiro Milhao, Aposentadoria, Renda | Evolui para metas e patrimonio |
| P2 | Alugar x Financiar | Alto valor, mas maior complexidade |
| P2 | Comparador de Cartao | Potencial comercial e personalizacao |
| P3 | Comparador de Acoes, Rentabilidade historica | Mais sofisticado e dependente de dados de mercado |
| P3 | Open Finance | Alto potencial, mas exige consentimento, seguranca e integracao regulada |

## 13. Roadmap de Implementacao

### Fase 0 - Preparacao e desenho de produto

- Transformar inventario em backlog.
- Definir schemas de entrada/saida por calculadora.
- Definir design de perfil financeiro consolidado.
- Criar matriz de formulas e golden tests.

### Fase 1 - Fundacao do ecossistema

- Criar catalogo JSON/API de calculadoras.
- Criar motor JS comum de formulas.
- Criar persistencia de simulacoes e cenarios.
- Criar dashboard "Minha vida financeira" com perfil consolidado.
- Integrar login/admin ja existente no projeto como base de identidade.

### Fase 2 - Decisao financeira diaria

- Implementar Custos Fixos.
- Implementar Reserva de Emergencia.
- Implementar Compra a Vista ou Parcelado.
- Implementar Pix Parcelado.
- Criar recomendacoes de curto prazo: reserva, parcela, desconto, custo de oportunidade.

### Fase 3 - Investimento conservador e comparacao

- Implementar Poupanca x Selic.
- Implementar Comparador de Renda Fixa.
- Implementar CDB.
- Criar taxa de oportunidade padrao do usuario.
- Mostrar rendimento bruto, liquido, prazo, liquidez e risco.

### Fase 4 - Metas e patrimonio

- Implementar Juros Compostos.
- Implementar Primeiro Milhao.
- Implementar Aposentadoria.
- Implementar Calculadora de Renda.
- Criar plano de metas com aportes mensais e alertas.

### Fase 5 - Credito ampliado Bancus Fraternis

- Conectar simuladores existentes de consorcio, financiamento, CDC, garantia e consignado ao perfil financeiro.
- Criar comparador entre credito, consorcio e investimento.
- Adicionar CET, SAC/Price, portabilidade e refinanciamento.

### Fase 6 - Inteligencia e dados externos

- Motor de recomendacao explicavel.
- Integracao com taxas e indices oficiais.
- Open Finance opcional com consentimento.
- Painel admin de regras, versoes e auditoria.

## 14. Metricas de Sucesso

| Metrica | O que mede | Meta inicial |
|---|---|---|
| Taxa de conclusao por calculadora | Clareza e friccao | > 65% |
| Reuso medio de campos | Integracao real da experiencia | > 40% dos campos autopreenchidos apos diagnostico |
| Simulacoes por usuario ativo | Engajamento | 3+ por usuario/mes |
| Cenarios salvos | Valor de memoria | 25% dos usuarios simuladores |
| Conversao para proxima acao | Efetividade da recomendacao | 20% clicam no CTA recomendado |
| Economia potencial calculada | Valor financeiro percebido | soma de juros/descontos/ganhos estimados |
| Aumento de aporte sugerido | Valor de planejamento | aporte medio recomendado aceito |
| Reducao de abandono | UX | queda por etapa/formulario |
| Uso recorrente em 30 dias | Retencao | > 20% |
| Incidentes de formula | Confianca | zero divergencias criticas em formulas versionadas |

## 15. Riscos Regulatorios, Tecnicos e de Experiencia

| Risco | Tipo | Impacto | Mitigacao |
|---|---|---|---|
| Recomendacao parecer consultoria/investimento individual sem suitability | Regulatorio | Alto | Linguagem de simulacao, perfil de risco, disclaimers, trilha de adequacao |
| Tratamento de renda, patrimonio e dividas sem clareza | LGPD | Alto | Consentimento, finalidade, minimizacao, transparencia e exclusao de dados |
| Open Finance sem consentimento correto | Regulatorio/tecnico | Alto | Seguir fluxo de consentimento, autenticacao, confirmacao e revogacao |
| Formula desatualizada | Tecnico | Alto | Versionamento, vigencia, fonte, snapshot e golden tests |
| Dados de mercado inconsistentes | Tecnico | Medio | Fonte oficial/contratada, cache com vigencia, fallback e aviso |
| Usuario interpretar simulacao como garantia | Experiencia/regulatorio | Alto | Memoria de calculo, premissas explicitas, cenarios pessimista/base/otimista |
| Formulario longo demais | Experiencia | Medio | Perfil progressivo e reaproveitamento de dados |
| Recomendacoes contraditorias entre calculadoras | Produto | Alto | Motor central de prioridades e perfil financeiro unico |
| Excesso de complexidade visual | Experiencia | Medio | Jornada por objetivo, linguagem simples e resumo executivo |

### Referencias regulatorias usadas na analise

- LGPD: dados pessoais devem ter finalidade, transparencia, necessidade e direitos do titular.
- Open Finance: compartilhamento exige consentimento previo, finalidade determinada, prazo adequado, possibilidade de cancelamento e APIs seguras.
- Suitability: recomendacoes de investimento precisam considerar perfil, objetivos e risco do investidor quando houver distribuicao ou recomendacao de produtos financeiros.

Links oficiais consultados:

- ANPD - Perguntas frequentes LGPD: https://www.gov.br/anpd/pt-br/acesso-a-informacao/perguntas-frequentes/perguntas-frequentes
- Banco Central - Open Finance: https://www.bcb.gov.br/estabilidadefinanceira/openfinance
- Banco Central - Quero entender Open Finance: https://www.bcb.gov.br/estabilidadefinanceira/entender-open-finance
- Portal do Investidor/CVM - Suitability: https://www.gov.br/investidor/pt-br/investir/antes-de-investir/respeite-o-seu-perfil-de-investidor/entenda-o-suitability

## 16. Oportunidades de Negocio

| Oportunidade | Como monetizar | Calculadoras gatilho |
|---|---|---|
| Leads de credito consciente | Encaminhar usuario para parceiro quando perfil e capacidade forem adequados | Pix, Compra Parcelada, Alugar x Financiar, futuro CET |
| Marketplace de investimentos | Comparar produtos conservadores e gerar lead/afiliacao | Renda Fixa, CDB, Poupanca x Selic |
| Assinatura premium | Plano financeiro, historico, alertas, cenarios ilimitados | Todas |
| B2B para consultores | Painel para consultores financeiros/comerciais simularem com clientes | Perfil, cenarios, dashboards |
| Educacao financeira patrocinada | Trilhas educativas por problema financeiro | Juros Simples, Reserva, Custos Fixos |
| Open Finance analytics | Agregacao consentida e recomendacoes melhores | Perfil, investimentos, credito |
| CRM financeiro | Converter simulacoes em pipeline comercial | Historico, recomendacoes, dashboard admin |
| API de calculadoras | Licenciar motor de calculo para parceiros | Catalogo e motor versionado |

## 17. Produto Final Proposto

### Nome de trabalho

**Bancus Fraternis Financial Intelligence Hub**

### Modulos

| Modulo | Descricao |
|---|---|
| Diagnostico Financeiro | renda, custos, reserva, realidade de renda |
| Decisor de Credito e Consumo | a vista, parcelado, Pix, capacidade de pagamento |
| Comparador de Caixa e Renda Fixa | poupanca, Selic, CDB, renda fixa |
| Planejador de Patrimonio | juros compostos, primeiro milhao, metas |
| Planejador de Aposentadoria e Renda | acumulacao e descumulacao |
| Hub de Recomendacoes | proxima melhor acao explicavel |
| Historico e Cenarios | salvar, comparar, retomar |
| Admin e Governanca | usuarios, versoes, formulas, fontes e auditoria |

## 18. Conclusao Executiva

O salto de produto nao e criar mais calculadoras. O salto e criar **uma inteligencia financeira integrada**.

A experiencia vencedora deve:

- Comecar simples, com uma pergunta do usuario.
- Reaproveitar dados ja informados.
- Explicar premissas e formulas.
- Comparar credito, caixa e investimento na mesma tela.
- Transformar cada resultado em proxima melhor acao.
- Salvar historico e evoluir o perfil financeiro.
- Separar simulacao educativa de recomendacao regulada.

Com isso, o Bancus Fraternis deixa de ser um conjunto de simuladores e passa a ser um **sistema de decisao financeira personalizada**, capaz de orientar usuarios entre preservar liquidez, reduzir custo financeiro, investir melhor, tomar credito com consciencia e planejar patrimonio de longo prazo.
