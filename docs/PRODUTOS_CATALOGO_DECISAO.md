# Produtos 2.0 - Catalogo de Decisao Bancus Fraternis

Atualizado em 2026-04-25.

## Objetivo

Transformar `produtos.html` em uma pagina de decisao e nao apenas uma lista de produtos. O usuario deve conseguir entender quando usar cada solucao, filtrar pelo momento financeiro e sair diretamente para simulacao, comparacao ou diagnostico.

## Arquivos

- Pagina: `pages/produtos.html`
- Catalogo: `assets/data/produtos.json`
- Cards: `assets/js/components/cards.js`
- Orquestracao: `assets/js/bf-platform.js`
- Estilo: `assets/css/platform.css`

## Novos dados do catalogo

| Campo | Uso |
| --- | --- |
| `simulador` | Link direto para a pagina de simulacao do produto |
| `comparador` | Link para comparar alternativas |
| `calculadora` | Diagnostico ou calculadora relacionada |
| `quandoUsar` | Leitura educativa de adequacao |
| `evitarQuando` | Alerta de cautela para produto |

## Experiencia

1. O usuario abre Produtos.
2. O sistema le o perfil local quando existir.
3. A pagina mostra uma trilha sugerida com score.
4. O usuario filtra por objetivo, urgencia e risco.
5. Os cards exibem criterios, riscos e acoes.
6. O usuario segue para simular, comparar ou diagnosticar.

## Filtros implementados

| Filtro | Efeito |
| --- | --- |
| Todos | Lista todo o catalogo |
| Comprar bem | Prioriza consorcio, financiamento e credito com garantia |
| Obter liquidez | Prioriza CDC, garantia e consignado |
| Veiculo | Prioriza veiculos, financiamento e consorcio |
| Urgencia | Restringe por baixa, media ou alta |
| Risco | Alimenta o score do motor de recomendacao |

## Proxima evolucao

Usar `produtos.json` como fonte do comparador multi-produto, permitindo que o usuario adicione ou remova colunas de CDC, garantia, consignado, consorcio, financiamento e decisoes de consumo.
