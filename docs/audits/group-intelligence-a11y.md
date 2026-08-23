# Auditoria de acessibilidade — Visão 360 do Grupo

Data: 2026-08-22

Rota: `/pages/grupo.html?groupKey=00000776%7C202512%7C1%7C79`

## Resultado

Os checks executados para a Visão 360 e para a nova leitura de dinâmica operacional foram aprovados e estão alinhados aos critérios WCAG 2.2 A/AA avaliados. Este documento não declara conformidade integral sem uma sessão dedicada com leitor de tela real.

## Evolução auditada

- Grupo nativo de dois botões, com nome visível “Forma de leitura” e estado por `aria-pressed`.
- Foco preservado no botão acionado e foco visível pelo contrato `:focus-visible` da página.
- Região `aria-live="polite"` anuncia somente o modo e a base usada, sem repetir todos os cartões.
- Quatro indicadores formam uma lista nomeada e permanecem identificáveis por rótulo, valor, contexto e estado textual; a cor não é o único sinal.
- Metodologia usa `details`/`summary`, quatro definições e fórmulas em texto selecionável.
- Valores ausentes aparecem como “Não informado” ou “Não calculável”; zero real permanece zero.

## Evidências verificadas no navegador

- Zero IDs duplicados, valores inválidos de `aria-pressed`, controles sem nome e saltos de nível entre títulos do conteúdo principal.
- Dois links do breadcrumb mediram 24 px pelo CSS; os novos controles possuem alvo mínimo declarado de 44 px.
- Zero overflow horizontal em 360 × 800, 768 × 800 e 1280 × 720.
- Em 360 px: um indicador por linha e controle de modo empilhado.
- Em 768 px: dois indicadores por linha e controle de modo em duas colunas.
- Navegação interna com `aria-current="location"`, âncoras protegidas pelo cabeçalho fixo e sincronização durante o scroll.
- Dois gráficos com nome acessível, descrição, região viva e tabela equivalente.
- Diálogo de assembleia com `aria-modal`, foco inicial, contenção de foco, fechamento por `Escape`, fundo inerte e retorno ao acionador.
- `prefers-reduced-motion` permanece presente.

## Contraste

O verificador encontrou 11 combinações explícitas no CSS e aprovou todas para WCAG AA. A menor relação medida foi 7,08:1, inclusive no estado indisponível e no selo da série demonstrativa. O botão ativo alcançou 17,57:1.

## Revisão das imagens

O scanner estático sinalizou 18 ocorrências de `img-alt-empty-informative`. A revisão do HTML confirmou que todas são ícones decorativos com `alt=""`, `aria-hidden="true"`, `focusable="false"` e texto visível adjacente. Adicionar descrição repetiria o rótulo e pioraria a leitura.

## Limitação declarada

Não foi executada uma sessão dedicada com leitor de tela real. Estrutura semântica, teclado, foco, nomes acessíveis, contraste, tabelas equivalentes e regiões vivas foram verificados estaticamente e no navegador.

Resultado dos checks automatizados e manuais executados: aprovado. A conformidade integral permanece condicionada à validação assistiva dedicada.
