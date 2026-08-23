# Design QA — Visão 360 do Grupo | Opção 2 + dinâmica operacional

## Escopo validado

- Referência selecionada: Opção 2 — História do grupo, preservada no painel esquerdo da comparação rastreada em `docs/design-qa/group-intelligence-comparison-v2-1280x720.png`.
- Implementação local: `pages/grupo.html?groupKey=00000776%7C202512%7C1%7C79`.
- Captura atual da implementação: `docs/design-qa/group-intelligence-implementation-v2-normalized-1280x720.png`.
- Captura da dinâmica operacional: `docs/design-qa/group-intelligence-operational-normalized-1280x720.png`.
- Comparação conjunta: `docs/design-qa/group-intelligence-comparison-v2-1280x720.png`.
- Capturas responsivas: `docs/design-qa/group-intelligence-operational-normalized-360x800.png` e `docs/design-qa/group-intelligence-operational-normalized-768x800.png`.
- Viewports renderizados e validados: 360 × 800, 768 × 800 e 1280 × 720, sem overflow horizontal.

## Comparação visual e decisões

- A implementação preserva a direção aprovada da Opção 2: identidade forte do grupo, série demonstrativa de assembleias, indicadores resumidos, gráficos complementares e bloco de interpretação.
- A evolução foi inserida abaixo do histórico, sem alterar a composição do primeiro viewport ou abrir uma rota paralela.
- O cabeçalho compartilhado da plataforma foi mantido para preservar navegação e reconhecimento do produto.
- As seis áreas aparecem em uma navegação superior persistente no conteúdo, em vez da barra inferior do conceito, para reduzir deslocamento e tornar os destinos previsíveis.
- A série demonstrativa foi mantida separada do retrato de dezembro de 2025. Os números ilustrativos que não correspondiam à fonte carregada não foram copiados.
- Identificadores técnicos, hash e associação da fonte ficam em detalhes recolhidos; a camada comercial mostra apenas o necessário para decidir.
- A primeira dobra mantém contexto, métricas e o início da história sem sobreposição ou corte de conteúdo essencial.
- A ação “Usar no projeto” aparece junto à identidade do grupo; o gráfico principal começa na primeira dobra e a faixa percentual permanece dentro do cartão.
- “Cotas e saúde” deixou de repetir três números do painel lateral e passou a concentrar quatro indicadores, inadimplência observada, maturidade, classificação, metodologia e cobertura dos dados em uma única superfície.
- O modo “Contagens” prioriza o valor observado e mantém o percentual como apoio; “Indicadores relativos” inverte a ênfase sem esconder a contagem.
- Arrecadação, liquidez, cobertura e geografia permanecem explicitamente indisponíveis; nenhuma visualização financeira foi inventada.

## Estados e comportamento

- Rota sem `groupKey`: estado vazio orientado, sem inventar ou selecionar um grupo padrão.
- Grupo existente sem série vinculada: retrato do catálogo disponível e histórico explicitamente indisponível.
- Grupo 79: 13 assembleias, 47 contemplações observadas, 34 por lance e faixa de 21,0% a 43,6%.
- Gráficos possuem descrição, tabela equivalente, fallback, leitura por teclado e anúncio em região viva.
- O detalhe da assembleia usa diálogo modal com foco inicial, contenção de foco, `Escape`, fundo inerte e retorno do foco ao acionador.
- Retorno direto ao simulador abre a etapa 4 e adiciona o grupo uma única vez; uma segunda tentativa preserva apenas uma seleção.
- “Voltar à prateleira” também abre a etapa 4 quando a rota foi acessada diretamente, sem adicionar o grupo.
- O retorno continua funcional depois de navegar por âncoras internas como `#assembleias` e `#lances`.
- Grupo 79 no modo operacional: 721 cotas ativas, 3 contempladas na competência, 698 excluídas acumuladas, 43 créditos pendentes, 0,4%, 96,8%, 6,0% e maturidade observada de 86,0%.
- A metodologia revela quatro definições e fórmulas; `null`, zero e denominador zero são estados distintos protegidos pelo motor.

## Responsividade e acessibilidade

- Renderizações em 360 × 800, 768 × 800 e 1280 × 720 foram aprovadas, incluindo uma coluna no mobile, duas no tablet, quatro no desktop, ações empilhadas e `prefers-reduced-motion`.
- O navegador integrado exportou as capturas dentro de uma escala técnica de 60% do canvas; as evidências `normalized` apenas recompõem o viewport CSS declarado, sem alterar conteúdo ou layout.
- Contraste das combinações descobertas: aprovado; menor relação observada 7,08:1.
- Sem IDs duplicados, controles sem nome, valores inválidos de `aria-pressed` ou saltos de títulos no conteúdo principal; os novos controles têm alvo mínimo de 44 px.
- O scanner marcou 18 imagens com `alt=""`; a inspeção confirmou que todas são decorativas, com `aria-hidden="true"` e rótulo visível adjacente.
- Sessão dedicada com leitor de tela não executada; teclado, foco, nomes acessíveis, tabelas equivalentes e regiões vivas foram validados no navegador.

## Gates associados

- Validador dedicado `tools/validate-group-operational-metrics.mjs`: 64/64 verificações aprovadas.
- Validador específico `tools/validate-group-intelligence.mjs`: aprovado, sem falhas.
- O gate global `validate-public-release-safety.mjs` continua bloqueado apenas por três arquivos de pesquisa corporativa não rastreados e fora deste escopo; eles não fazem parte do commit desta evolução.

final result: passed
