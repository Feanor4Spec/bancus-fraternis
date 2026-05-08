# V6: Motor de Análise Heurística da Base Real (17.000+ Grupos)

Para estruturar e navegar pelas mais de 17.000 linhas de dados reais de Consórcios, o sistema abandonará a simples ordenação por "menor taxa" e aplicará uma **Inteligência Analítica de Risco e Oportunidade**.

O motor lógico (que será implementado no `shelf-engine.js` ou num novo arquivo de inteligência separada) deve processar as dezenas de colunas matemáticas do grupo para responder ativamente às 6 Diretrizes de Qualidade definidas abaixo:

## 1. O grupo é aderente ao objetivo financeiro?
- **Variáveis Envolvidas:** Taxa de Administração Total, Fundo de Reserva, Valores da Carta, Flexibilidade Comercial (parcela reduzida).
- **Logica de Máquina:** O "Custo de Oportunidade" e o gasto total batem com um perfil investidor, ou o custo é muito alto (indicado apenas para aquisição de bem final que justifique)? 

## 2. O grupo é robusto operacionalmente?
- **Variáveis Envolvidas:** Qtd. Cotas Ativas em Dia, Contempladas no Mês, Índice de Inadimplência ou Excluídas.
- **Logica de Máquina:** Administradoras menores ou grupos recentes com baixo volume transacional possuem liquidez para contemplar rápido?

## 3. O grupo está em fase adequada para a estratégia?
- **Variáveis Envolvidas:** Diferença entre Prazo Original do Grupo e o Prazo Restante do Item.
- **Logica de Máquina:** Grupos muito no começo exigem paciência. Grupos muito no fim (vencendo) têm lances lá em cima (balão) mas excelente vazão de caixa acumulado.

## 4. O grupo apresenta sinais de risco ou desgaste?
- **Variáveis Envolvidas:** Número de Cotas Excluídas vs Quitando; Volume de Crédito Pendente vs Dinheiro em Caixa do fundo.
- **Logica de Máquina:** Sinalizar 🔴 ("Red Flags") onde a proporção de cancelamentos denota risco de não contemplação matemática ou problemas judiciais da conta do grupo.

## 5. O grupo serve melhor como âncora, complemento, oportunidade ou cautela?
**Tipificação e Rotulação Automática (Tags do Sistema):**
- **⚓ Âncora:** Grupos extremamente saudáveis, taxas excelentes, administradoras Tier 1 (Itaú, Rodobens, BB). Serve para ser a maior cota do projeto estruturado.
- **🧩 Complemento:** Cartas menores para fechar um saldo exato da operação, permitindo taxas medianas.
- **⚡ Oportunidade:** Grupos próximos ao fim, com baixa procura e com regras de "Brecha" como lances embutidos agressivos (para tentar contemplação imediata via embutido maciço).
- **⚠️ Cautela:** Risco operacional detectado (muitos excluídos, regras draconianas). Entrar apenas caso o cliente insista no nicho.

## 6. A recomendação está bem justificada com base na tabela?
- O Sistema deverá "Babar" na tela uma sinopse textual ou Bullet Points gerados automaticamente unindo as 5 respostas acima, comprovando para o consultor financeiro o PORQUÊ o grupo "XPTO-123" foi alocado na Sacola (Etapa 5).

---
> **Status:** Em implementação (Via Motor de Scoring V6).



A base fornecida é uma tabela analítica consolidada chamada "Tab_Grupos_Consorcio". localizada em "C:\Users\gustavo.pinheiro\.gemini\antigravity\scratch\simulador-consorcio\data_base"


Essa tabela foi criada para transformar dados operacionais de grupos de consórcio em uma matriz de decisão.
Ela não é apenas um cadastro.
Ela funciona como uma camada analítica pronta para:
- triagem de grupos;
- construção de prateleira de grupos;
- apoio à montagem de projetos estruturados de consórcio.

A tabela representa uma fotografia mensal da carteira na data-base 202512.
Portanto:
- ela é uma fotografia de dezembro de 2025;
- não é uma série histórica;
- toda leitura deve ser feita como retrato de uma competência específica.

Essa tabela contém grupos de diferentes segmentos de consórcio e traz:
- dados brutos de identificação e características do grupo;
- métricas derivadas de saúde operacional;
- classificações executivas prontas para leitura e decisão.


3. COMO VOCÊ DEVE ENXERGAR A TABELA


A tabela deve ser interpretada em 3 blocos.


BLOCO A — IDENTIDADE E ESTRUTURA DO GRUPO


Esse bloco responde:
- quem é a administradora;
- qual é o grupo;
- em qual segmento ele está;
- qual o ticket médio do grupo;
- qual o prazo do grupo;
- como está a estrutura operacional de cotas.

As colunas-base do grupo são:

1. #Nome_da_Administradora
   - nome da administradora;
   - usar para comparação entre casas e filtros institucionais.

2. CNPJ_da_Administradora
   - raiz do CNPJ da administradora;
   - deve ser tratada como texto com 8 dígitos;
   - exemplo: 776 deve ser lido como 00000776.

3. Data_base
   - competência da base;
   - representa o mês de referência da carteira.

4. Código_do_grupo
   - identificador do grupo;
   - deve ser tratado como texto, pois pode conter caracteres alfanuméricos.

5. Código_do_segmento
   - identifica o segmento do grupo;
   - deve ser usado como variável obrigatória de leitura e comparação.

6. Número_da_assembléia_geral_ordinária
   - representa a quantidade de assembleias ordinárias ocorridas;
   - serve como marcador bruto da fase do grupo.

7. Valor_médio_do_bem
   - ticket médio do grupo;
   - ajuda a medir aderência econômica da oportunidade ao valor de crédito desejado.

8. Índice_de_correção
   - código do indexador do grupo;
   - deve ser interpretado como informação contratual relevante para atualização do crédito;
   - caso exista legenda auxiliar, ela deve ser utilizada.

9. Taxa_de_administração
   - taxa média do grupo;
   - deve ser lida em conjunto com prazo, ticket e saúde do grupo.

10. Prazo_do_grupo_em_meses
   - prazo total do grupo;
   - deve ser combinado com o número de assembleias para medir maturidade.

11. Quantidade_de_cotas_ativas_em_dia
   - representa a base saudável atual do grupo.

12. Quantidade_de_cotas_ativas_contempladas_inadimplentes
   - representa cotas contempladas em atraso;
   - sinaliza risco em cotas que já acessaram contemplação.

13. Quantidade_de_cotas_ativas_não_contempladas_inadimplentes
   - representa cotas ativas não contempladas em atraso;
   - mede pressão pré-contemplação.

14. Quantidade_de_cotas_ativas_contempladas_no_mês
   - mostra o dinamismo mensal de contemplação.

15. Quantidade_de_cotas_excluídas
   - mostra desgaste histórico do grupo;
   - é uma medida acumulada.

16. Quantidade_de_cotas_ativas_quitadas
   - mostra maturidade financeira do grupo.

17. Quantidade_de_cotas_ativas_com_crédito_pendente_de_utilização
   - mostra contemplações cujo crédito ainda não foi efetivamente utilizado.


BLOCO B — MÉTRICAS DERIVADAS DE LEITURA


Esse bloco traduz os dados operacionais em métricas gerenciais.

1. Chave_do_grupo
   - chave única do grupo;
   - formada por:
     CNPJ formatado + Data_base + Código_do_segmento + Código_do_grupo
   - essa é a chave correta para rastrear o grupo;
   - nunca use apenas Código_do_grupo isoladamente.

2. Ativas_monitoradas
   - soma:
     Quantidade_de_cotas_ativas_em_dia
     + Quantidade_de_cotas_ativas_contempladas_inadimplentes
     + Quantidade_de_cotas_ativas_não_contempladas_inadimplentes
   - representa o estoque operacional vivo monitorado do grupo;
   - é base para as demais taxas.

3. Inadimplentes_totais
   - soma das cotas contempladas inadimplentes e não contempladas inadimplentes;
   - representa a massa de risco corrente.

4. Taxa_de_Inadimplência
   - Inadimplentes_totais / Ativas_monitoradas
   - representa a principal leitura de saúde da carteira do grupo.

5. Índice_de_Maturidade
   - Número_da_assembléia_geral_ordinária / Prazo_do_grupo_em_meses
   - mede em que fase da jornada o grupo está.
   - interpretação:
     < 25% = início
     25% a 60% = crescimento
     60% a 90% = maturação
     > 90% = final
   - se superar 100%, leia como grupo muito maduro / fase terminal.

6. Taxa_de_Quitação
   - Quantidade_de_cotas_ativas_quitadas / Ativas_monitoradas
   - mede maturidade financeira do grupo.

7. Taxa_de_crédito_pendente
   - Quantidade_de_cotas_ativas_com_crédito_pendente_de_utilização / Ativas_monitoradas
   - mede ociosidade do crédito contemplado.

8. Intensidade_histórica_de_exclusão
   - Quantidade_de_cotas_excluídas / Ativas_monitoradas
   - mede a pressão histórica acumulada de exclusão;
   - pode ser maior que 100%;
   - não deve ser lida como taxa mensal;
   - deve ser lida como indicador de desgaste acumulado relativo ao estoque ativo atual.

9. Taxa_de_contemplação_do_mês
   - Quantidade_de_cotas_ativas_contempladas_no_mês / Ativas_monitoradas
   - mede dinamismo recente do grupo.


BLOCO C — CLASSIFICAÇÕES EXECUTIVAS


Esse bloco transforma as métricas em linguagem decisória.

1. Porte_operacional_do_grupo
   - mede escala do grupo com base em Ativas_monitoradas.
   - classes:
     Pequeno
     Médio
     Grande
     Muito grande

2. Maturidade_do_grupo
   - mede fase do grupo.
   - classes:
     Início
     Crescimento
     Maturação
     Final

3. Saúde_da_carteira_do_grupo
   - mede qualidade operacional com base na inadimplência.
   - classes:
     Baixa
     Controlada
     Atenção
     Crítica

4. Ticket_do_grupo
   - mede o porte econômico.
   - classes:
     Baixo ticket
     Ticket médio
     Ticket alto
     Premium

5. Ociosidade_do_crédito_contemplado
   - mede o quanto do crédito contemplado ainda está pendente.
   - classes:
     Baixa ociosidade
     Normal
     Atenção
     Alta ociosidade

6. Pressão_histórica_de_exclusão
   - mede desgaste acumulado.
   - classes:
     Baixa
     Moderada
     Alta
     Crítica

7. Dinamismo_recente_de_contemplação
   - mede intensidade recente de contemplações.
   - classes:
     Baixo dinamismo
     Normal
     Bom
     Forte

8. Classificação executiva final dos grupos
   - síntese final do grupo.
   - classes:
     A - Expansão
     B - Sustentação
     C - Recuperação
     D - Crítico

Leitura da síntese:
- A - Expansão:
  grupo saudável, com boa base operacional e boa usabilidade para composição.
- B - Sustentação:
  grupo equilibrado, sem sinais críticos.
- C - Recuperação:
  grupo com alertas, mas ainda utilizável mediante leitura técnica.
- D - Crítico:
  grupo que exige cautela e análise manual mais profunda.

A classificação executiva final nunca deve ser usada sozinha.
Ela é uma síntese.
A decisão deve considerar o conjunto completo de métricas.

4. REGRAS OBRIGATÓRIAS DE LEITURA

Ao utilizar essa tabela, siga obrigatoriamente estas regras:

1. Nunca trate a base como série histórica.
   A base é um retrato único de 202512.

2. Nunca use Código_do_grupo sozinho como chave.
   Use sempre Chave_do_grupo.

3. Sempre trate CNPJ_da_Administradora como texto formatado com 8 dígitos.

4. Sempre trate Código_do_grupo como texto.

5. Não interprete Intensidade_histórica_de_exclusão como taxa mensal.
   Ela é uma pressão histórica acumulada.

6. Não interprete Taxa_de_crédito_pendente isoladamente como problema.
   Ela sinaliza ociosidade do crédito contemplado e precisa ser lida com contexto.

7. Não faça comparação cega entre segmentos muito diferentes sem contextualizar.
   Exemplo:
   - imóveis possuem ticket e prazo naturalmente maiores;
   - motocicletas possuem ticket menor e podem ter inadimplência estruturalmente diferente.

8. Use a classificação final como atalho executivo, mas justifique a recomendação com base em:
   - ticket;
   - prazo;
   - porte;
   - saúde;
   - maturidade;
   - dinamismo;
   - ociosidade;
   - pressão histórica.



Pergunta respondida:
“Quais grupos cabem na arquitetura financeira do projeto?”

ETAPA 2 — ROBUSTEZ OPERACIONAL

Filtrar e analisar:
- Ativas_monitoradas
- Porte_operacional_do_grupo
- Saúde_da_carteira_do_grupo
- Pressão_histórica_de_exclusão

Pergunta respondida:
“Quais grupos são mais robustos operacionalmente?”

ETAPA 3 — TIMING DO GRUPO
Filtrar e analisar:
- Maturidade_do_grupo
- Índice_de_Maturidade
- Taxa_de_Quitação
- Taxa_de_contemplação_do_mês
- Dinamismo_recente_de_contemplação

Pergunta respondida:
“Em que momento da vida esse grupo está?”

ETAPA 4 — USABILIDADE DO CRÉDITO
Filtrar e analisar:
- Taxa_de_crédito_pendente
- Ociosidade_do_crédito_contemplado

Pergunta respondida:
“Esse grupo mostra boa fluidez de utilização do crédito ou há sinais de ociosidade?”

ETAPA 5 — SÍNTESE EXECUTIVA
Analisar:
- Classificação executiva final dos grupos

Pergunta respondida:
“Qual é o papel gerencial desse grupo dentro da proposta?”

7. COMO CLASSIFICAR O PAPEL DO GRUPO DENTRO DA PROPOSTA

Ao selecionar grupos para uma proposta estruturada, você deve classificar cada grupo em uma destas funções:

1. Grupo Âncora
   Perfil:
   - A - Expansão ou B - Sustentação;
   - porte médio, grande ou muito grande;
   - saúde baixa ou controlada;
   - maturidade em crescimento ou maturação;
   - ticket aderente ao projeto.
   Uso:
   - base principal da proposta;
   - grupo com maior sustentação.

2. Grupo Complementar
   Perfil:
   - B - Sustentação ou C - Recuperação leve;
   - boa aderência de prazo ou ticket;
   - exclusão não crítica;
   - dinamismo pelo menos normal.
   Uso:
   - complementar volume, prazo, composição ou estratégia.

3. Grupo de Oportunidade
   Perfil:
   - C - Recuperação;
   - ticket ou estágio muito interessante;
   - pode exigir análise manual.
   Uso:
   - utilizado quando existe racional técnico claro e benefício potencial relevante.

4. Grupo de Cautela
   Perfil:
   - D - Crítico;
   - ou saúde crítica;
   - ou exclusão crítica;
   - ou alta ociosidade com outros sinais negativos.
   Uso:
   - não entra em seleção automática;
   - só pode ser sugerido mediante ressalvas explícitas.


Sempre pense assim:

1. O grupo é aderente ao objetivo financeiro?
2. O grupo é robusto operacionalmente?
3. O grupo está em fase adequada para a estratégia?
4. O grupo apresenta sinais de risco ou desgaste?
5. O grupo serve melhor como âncora, complemento, oportunidade ou cautela?
6. A recomendação está bem justificada com base na tabela?

12. FORMATO PADRÃO DE SAÍDA

Sempre organize sua resposta final nestes blocos:

BLOCO 1 — Objetivo da análise
BLOCO 2 — Critérios aplicados
BLOCO 3 — Leitura da tabela e interpretação dos grupos
BLOCO 4 — Grupos recomendados
BLOCO 5 — Papel de cada grupo na proposta
BLOCO 6 — Riscos, restrições e alertas
BLOCO 7 — Recomendação executiva final

13. INSTRUÇÃO FINAL

Ao utilizar a tabela "Tab_Grupos_Consorcio", trate-a como uma matriz de decisão para propostas estruturadas.

Sua função não é apenas filtrar dados.
Sua função é transformar os dados em inteligência de estruturação, indicando com clareza:
- quais grupos fazem sentido;
- por que fazem sentido;
- como devem ser usados;
- quais riscos devem ser observados;
- e qual a melhor composição possível para a proposta, dentro das informações disponíveis na base.