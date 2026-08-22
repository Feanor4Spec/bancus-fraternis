# Design QA — Evolução da jornada de consórcio V9

## Escopo validado

- Jornada principal do simulador: diagnóstico, seleção multigrupos, composição de cotas, lance, risco, simulação, eventos futuros, comparação, recomendação e proposta.
- Entregável final: proposta pública somente leitura, 16 páginas lógicas, impressão e PDF nativo pesquisável.
- Referência visual: `docs/test-reports/screenshots/v9-visual-reference.png` (1487 × 1058).
- Implementação: `docs/test-reports/screenshots/v9-public-proposal-reference-viewport.jpg` (1480 × 1058).
- Comparação conjunta: `docs/test-reports/screenshots/v9-design-comparison.jpg` e `docs/test-reports/design-comparison-v9.html`.

## Inspeção visual

- Referência e implementação foram avaliadas juntas na mesma proporção de viewport e no estado final de proposta.
- Hierarquia editorial, navegação de proposta, contraste, densidade, raios, espaçamento, bordas e alinhamentos estão coerentes com a direção visual aprovada.
- O hero público foi corrigido para remover a marca de fundo recortada e assegurar texto branco de alto contraste sobre azul-marinho.
- Logotipo e ícone utilizam ativos reais do produto; não há emojis, desenhos CSS ou placeholders visuais.
- Nenhum conteúdo essencial aparece cortado, sobreposto ou fora do contêiner.

## Responsividade e comportamento

- Desktop validado em 1487 × 1058 sem overflow horizontal.
- Mobile validado em 390 × 844 sem overflow horizontal; ações de impressão/PDF permanecem acessíveis e o conteúdo reorganiza em uma coluna.
- Captura mobile: `docs/test-reports/screenshots/v9-public-proposal-mobile.jpg`.
- Console do simulador e da proposta pública: zero erros e zero avisos.
- Estados inválidos `undefined`, `null`, `NaN`, `Infinity` e `[object Object]`: ausentes da interface validada.

## Aceitação funcional associada

- Validador V9: 32/32 contratos aprovados.
- Compartilhamento seguro: 76 verificações aprovadas, incluindo expiração, revogação, token hash-only, noindex e remoção de PII.
- Motor financeiro: 16 cenários golden, 60 cenários combinatórios e 403 asserções aprovadas.
- Regressão final: 19/19 validadores aprovados.

final result: passed
