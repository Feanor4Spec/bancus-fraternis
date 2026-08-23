# Design QA — Visão 360 do Grupo | Opção 2

## Escopo validado

- Referência selecionada: `tmp/visao-360-conceitos/option-2-historia-do-grupo-1440x1024.png`.
- Implementação local: `pages/grupo.html?groupKey=00000776%7C202512%7C1%7C79`.
- Captura da implementação: `docs/design-qa/group-intelligence-implementation-1280x720.jpg`.
- Comparação conjunta: `docs/design-qa/group-intelligence-comparison-1280x720.jpg`.
- Viewport visual validado: 1280 × 720, sem overflow horizontal.

## Comparação visual e decisões

- A implementação preserva a direção aprovada da Opção 2: identidade forte do grupo, série demonstrativa de assembleias, indicadores resumidos, gráficos complementares e bloco de interpretação.
- O cabeçalho compartilhado da plataforma foi mantido para preservar navegação e reconhecimento do produto.
- As seis áreas aparecem em uma navegação superior persistente no conteúdo, em vez da barra inferior do conceito, para reduzir deslocamento e tornar os destinos previsíveis.
- A série demonstrativa foi mantida separada do retrato de dezembro de 2025. Os números ilustrativos que não correspondiam à fonte carregada não foram copiados.
- Identificadores técnicos, hash e associação da fonte ficam em detalhes recolhidos; a camada comercial mostra apenas o necessário para decidir.
- A primeira dobra mantém contexto, métricas e o início da história sem sobreposição ou corte de conteúdo essencial.
- A ação “Usar no projeto” aparece junto à identidade do grupo; o gráfico principal começa na primeira dobra e a faixa percentual permanece dentro do cartão.

## Estados e comportamento

- Rota sem `groupKey`: estado vazio orientado, sem inventar ou selecionar um grupo padrão.
- Grupo existente sem série vinculada: retrato do catálogo disponível e histórico explicitamente indisponível.
- Grupo 79: 13 assembleias, 47 contemplações observadas, 34 por lance e faixa de 21,0% a 43,6%.
- Gráficos possuem descrição, tabela equivalente, fallback, leitura por teclado e anúncio em região viva.
- O detalhe da assembleia usa diálogo modal com foco inicial, contenção de foco, `Escape`, fundo inerte e retorno do foco ao acionador.
- Retorno direto ao simulador abre a etapa 4 e adiciona o grupo uma única vez; uma segunda tentativa preserva apenas uma seleção.
- O retorno continua funcional depois de navegar por âncoras internas como `#assembleias` e `#lances`.

## Responsividade e acessibilidade

- Contratos estáticos para 360 px, 768 px e desktop foram aprovados, incluindo reorganização em coluna, ações empilhadas e `prefers-reduced-motion`.
- A renderização visual foi inspecionada em 1280 × 720. A captura renderizada em 360/768 não foi executada porque a política do navegador integrado bloqueou a superfície local usada para emular esses viewports; permanece como verificação visual complementar, não como evidência concluída.
- Contraste das combinações descobertas: aprovado; menor relação observada 7,08:1.
- Sem IDs duplicados, controles sem nome, alvos visíveis abaixo de 24 px ou imagens informativas sem alternativa.
- O scanner marcou 17 imagens com `alt=""`; a inspeção confirmou que todas são decorativas, com `aria-hidden="true"` e rótulo visível adjacente.
- Sessão dedicada com leitor de tela não executada; teclado, foco, nomes acessíveis, tabelas equivalentes e regiões vivas foram validados no navegador.

## Gates associados

- 22 validadores funcionais e de regressão relacionados: aprovados.
- Validador específico `tools/validate-group-intelligence.mjs`: aprovado, sem falhas.
- O gate global `validate-public-release-safety.mjs` continua bloqueado apenas por três arquivos de pesquisa corporativa não rastreados e fora deste escopo; eles não fazem parte do commit desta evolução.

final result: passed
