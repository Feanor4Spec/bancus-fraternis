# Configuracoes Globais - Fase 4

Atualizado em 2026-05-15.

## Objetivo

Transformar `pages/configuracoes.html` em um centro de preferencias realmente aplicado no portal Bancus Fraternis. A configuracao continua local e progressiva, usando `localStorage`, mas agora altera o comportamento de Home, simulador e paginas com layout compartilhado.

## Preferencias aplicadas

| Preferencia | Onde impacta | Resultado |
| --- | --- | --- |
| `showJourney` | Home | Oculta ou mostra a jornada de simulacao. |
| `smoothScroll` | Portal | Alterna scroll suave/global. |
| `darkMode` | Portal | Aplica classe global de tema escuro experimental. |
| `autoScore` | Simulador | Liga/desliga recomputacao automatica de score da prateleira. |
| `pageSize` | Simulador | Define grupos por pagina na prateleira, com padrao 20 e limite 50. |
| `defaultSegmento` | Home e simulador | Prioriza destaques da Home e preenche filtro de segmento. |
| `defaultAdmin` | Simulador | Preenche filtro de administradora quando existe na base. |
| `defaultPoliticaSaldo` | Simulador | Define politica inicial do comparador. |
| `defaultIndiceReajuste` | Simulador | Define reajuste anual inicial. |
| `defaultMesContemplacao` | Simulador | Define MOB inicial. |
| `maxLanceEmbutido` | Simulador | Limita o lance embutido efetivo em grupos e carrinho. |

## Arquitetura funcional

- `js/settings.js`: fonte unica de leitura, escrita, normalizacao e aplicacao visual.
- `js/shared-layout.js`: fallback para paginas que usam shell compartilhado.
- `js/home.js`: faixa de preferencias e priorizacao de grupos pelo segmento padrao.
- `js/app.js`: defaults reais no simulador, prateleira, comparador e carrinho.
- `pages/configuracoes.html`: painel de controle e resumo de preferencias ativas.

## Backlog

- Persistir preferencias por usuario via API propria.
- Versionar premissas e regras com logs de aprovacao.
- Criar publicacao server-side de parametros para calculadoras e simulador.
- Vincular mudancas de configuracao a trilhas de auditoria de simulacoes.

## Rotas de teste

- `http://127.0.0.1:8080/pages/configuracoes.html`
- `http://127.0.0.1:8080/pages/index.html`
- `http://127.0.0.1:8080/pages/simulador.html?showLoading=1`
