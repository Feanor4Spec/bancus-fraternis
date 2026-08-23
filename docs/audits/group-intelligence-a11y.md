# Auditoria de acessibilidade — Visão 360 do Grupo

Data: 2026-08-22

Rota: `/pages/grupo.html?groupKey=00000776%7C202512%7C1%7C79`

## Resultado

Baseline de acessibilidade aprovado para a evolução da Opção 2.

## Evidências verificadas

- Hierarquia de títulos, regiões, breadcrumbs e seis destinos de navegação identificáveis.
- Dois gráficos com nome acessível, descrição, região viva e tabela equivalente.
- Navegação por `ArrowLeft`, `ArrowRight`, `Home`, `End` e `Escape` nos gráficos.
- Diálogo de assembleia com `aria-modal`, foco inicial, contenção de foco, fechamento por `Escape`, fundo inerte e retorno ao acionador.
- Zero IDs duplicados, tokens ARIA inválidos, controles sem nome e alvos visíveis menores que 24 px.
- Zero overflow horizontal no viewport 1280 × 720.
- Contraste aprovado em todas as combinações descobertas; menor razão medida: 7,08:1.
- `prefers-reduced-motion` e layouts declarados para 360 px e 768 px presentes no CSS.

## Revisão das imagens

O scanner sinalizou 17 ocorrências de `img-alt-empty-informative`. A revisão manual confirmou que todas são ícones decorativos com `alt=""`, `aria-hidden="true"`, `focusable="false"` e texto visível adjacente. Adicionar descrição repetiria o mesmo rótulo e pioraria a leitura.

## Limitações declaradas

- Não foi executada uma sessão dedicada com leitor de tela real.
- A inspeção visual renderizada foi concluída em 1280 × 720. A captura em 360/768 ficou pendente porque a política do navegador integrado bloqueou a superfície local de emulação; os contratos responsivos foram validados estaticamente.

Resultado final: aprovado, com as duas verificações complementares registradas acima.
