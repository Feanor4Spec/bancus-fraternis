# Design System v8 - Bank Fratern

Atualizado em 2026-04-26.

## Objetivo

Unificar a linguagem visual do Bank Fratern em toda a jornada do usuario sem alterar formulas financeiras, dados locais, chaves de `localStorage` ou regras de negocio ja existentes.

## Fonte visual

- Camada canonica: `assets/css/bf-design-system-v8.css`.
- Shell compartilhado: `js/shared-layout.js`.
- Base visual existente preservada: `css/styles.css`, `css/bank-fratern-design-system.css`, `css/shared-site.css` e `assets/css/platform.css`.
- O v8 deve ser carregado depois dos CSS atuais para atuar como camada de normalizacao.

## Arquétipos

| Arquétipo | Uso | Exemplos |
|---|---|---|
| `institutional` | Confianca, educacao e apresentacao | Home, Sobre, Duvidas, Compliance, Dados |
| `calculator` | Calculadoras e simuladores | Calculadoras, Consorcio, Financiamento, CDC |
| `decision` | Escolha orientada por dados | Produtos, Comparador, Trilha, Biblioteca |
| `dashboard` | Continuidade e acompanhamento | Dashboard Cliente, Carteira, Assembleias |
| `governance` | Operacao, admin e auditoria | Admin, Handoff, Governanca, API Docs |

## Contrato De Pagina

Toda pagina ativa deve cumprir pelo menos um dos caminhos:

- Usar `shared-layout.js`, que injeta `platform.css`, `bf-design-system-v8.css`, `bf-v8-body`, `data-bf-archetype` e `data-bf-visual-version="8"`.
- Carregar `assets/css/bf-design-system-v8.css` diretamente quando tiver header proprio, como Home ou Simulador.

Paginas sem migracao ficam marcadas como legado controlado:

- `pages/index_2.html`
- `pages/index_v4_paginas.html`
- `pages/consorcio_user_journey_map_v2.html`

## Camada Institucional De Confianca

Paginas cobertas:

- `pages/educacao.html`
- `pages/compliance.html`
- `pages/dados-abertos.html`
- `pages/api-docs.html`
- `pages/sobre-nos.html`
- `pages/duvidas.html`

Contrato adicional:

- `body` com classe `trust-page`;
- stagebar com `data-v8-stagebar`;
- decision strip com `data-trust-decision-strip`;
- timeline com `data-trust-timeline`;
- quatro cards de decisao e cinco itens de continuidade.

Essas paginas devem explicar conceitos, limites, dados e APIs antes de empurrar o usuario para simulacao ou atendimento.

## Home Institucional E Configuracoes

Home:

- pagina: `pages/index.html`;
- classe: `institutional-journey-page`;
- stagebar com `data-v8-stagebar`;
- decision strip com `data-home-decision-strip`;
- timeline com `data-home-institutional-timeline`.

Configuracoes:

- pagina: `pages/configuracoes.html`;
- classe: `settings-page`;
- stagebar com `data-v8-stagebar`;
- decision strip com `data-settings-decision-strip`;
- timeline com `data-settings-timeline`;
- chips ativos em `#cfg-applied-chips`.

A Home deve apresentar empresa e produtos antes do perfil financeiro. Configuracoes deve mostrar quais defaults estao ativos e permitir salvar/resetar preferencias locais.

## Catalogo Vivo De Componentes

Pagina de referencia: `pages/componentes-v8.html`.

Contrato adicional:

- `body` com classe `component-catalog-page`;
- stagebar com `data-v8-stagebar`;
- decision strip com `data-component-decision-strip`;
- timeline com `data-component-timeline`;
- grade de tokens com `bf-component-swatch-grid`;
- grade de amostras com `bf-component-sample-grid`.

Uso recomendado:

- revisar novas paginas contra este catalogo antes de criar estilos especificos;
- reutilizar stagebar, decision strip, timeline, badges, cards, formularios, metricas e tabelas;
- evitar variacoes visuais que nao estejam representadas no catalogo ou documentadas como excecao.

## Componentes Normalizados

- Header e footer com mesma hierarquia visual.
- Hero com faixa superior de identidade e texto sem overflow.
- Stagebar v8 para conectar etapas em paginas densas.
- Cards, paineis, KPIs, tabelas, filtros e formularios com raio, borda e sombra consistentes.
- Estados vazios em historico, recomendacao e resultado.
- Foco acessivel em inputs, selects, textareas, botoes e links.
- Responsividade com grids reduzindo para duas colunas e depois uma coluna.

## Proposta Comercial E PDF

Pagina de referencia: `pages/simulador.html`.

Contrato adicional:

- etapa de proposta deve renderizar `#proposal-export-root` com `data-proposal-summary-root`;
- tela de resumo deve manter `#proposal-summary-print-root` como fallback de exportacao;
- preview da proposta e PDF devem compartilhar o mesmo renderer `ProposalSummary.render()`;
- graficos da proposta e do resumo devem usar prefixos de canvas diferentes;
- blocos narrativos devem usar `.ps-print-page` para exportacao por secoes;
- `.ps-section--conversation` deve conectar decisao, caixa, lance e risco aos graficos e proximos passos.

Uso recomendado:

- evitar HTML inline novo para propostas comerciais;
- criar novos blocos como secoes `ps-section` com memoria de calculo, recomendacao e relacao com decisoes;
- manter a exportacao por blocos para reduzir cortes incoerentes entre texto e grafico.

## Aceite Local Da Proposta

Pagina de referencia: `pages/simulador.html`.

Contrato adicional:

- etapa de proposta deve conter `data-proposal-acceptance-panel`;
- `js/proposal-acceptance.js` deve registrar revisoes locais por `proposalId`;
- `js/app.js` deve expor `salvarRevisaoProposta()` e `limparRevisaoProposta()`;
- PDF e preview devem conter `.ps-section--acceptance`;
- payload de simulacao salva deve preservar `proposalAcceptance`;
- revisao completa exige checklist de premissas, contexto do cliente e documentacao/handoff.

Uso recomendado:

- registrar revisao antes de exportar proposta final;
- usar status `Em revisao`, `Revisao parcial`, `Revisada localmente` ou `Revisao vencida`;
- nao transmitir dados para terceiros nesta fase; o aceite e local e preparatorio para handoff futuro.

## Ponte Proposta Para Handoff

Pagina de referencia: `pages/simulador.html`.

Contrato adicional:

- etapa de proposta deve carregar `assets/js/services/handoff-consultivo.service.js`;
- `js/app.js` deve expor `criarHandoffProposta()`;
- o painel deve conter `data-proposal-handoff-bridge`;
- a acao de handoff deve ficar bloqueada enquanto a revisao nao estiver completa;
- `BFHandoffConsultivoService.createFromProposal()` deve preservar proposta, versao, validade, resumo financeiro, notas e checklist;
- `BFHandoffConsultivoService.findByProposal()` deve evitar duplicidade local para a mesma proposta e owner.

Uso recomendado:

- criar handoff apenas apos status `Revisada localmente`;
- usar a fila consultiva para responsavel, checklist, notas e auditoria;
- manter o lead local nesta fase, sem integracao externa ou envio automatico para parceiros.

## Produtos E Selecao Assistida

Pagina de referencia: `pages/produtos.html`.

Contrato adicional:

- painel `data-products-selection-panel` entre filtros e catalogo;
- cards com `data-product-card`, `data-product-id`, `data-product-selected` e botao `data-product-toggle-selection`;
- contador de selecao com limite visual de 4 produtos;
- CTA de comparacao deve apontar para `comparador.html?preset=manual&products=...` quando houver selecao;
- sem selecao ativa, o fluxo continua usando presets por objetivo.

Comportamento esperado:

- selecionar/deselecionar produtos sem recarregar a pagina;
- persistir a selecao por usuario em `localStorage`;
- destacar produtos selecionados com borda, sombra e botao pressionado;
- abrir o Comparador com colunas ja marcadas e resumo de produtos carregados do catalogo.

## Microconversoes Locais

Componente base: bloco `data-journey-analytics`.

Paginas cobertas:

- `pages/produtos.html`;
- `pages/comparador.html`;
- `pages/dashboard-cliente.html`.

Contrato visual:

- badge `Microconversoes locais`;
- score de conversao local;
- quatro metricas: selecoes, comparador, matrizes e simuladores;
- lista de eventos recentes com titulo, detalhe e data curta;
- estado vazio quando ainda nao ha eventos no navegador.

Contrato funcional:

- eventos gravados em `bf_journey_analytics_v1:<usuario>`;
- Produtos registra selecao, Top 3, limpeza e abertura do Comparador;
- Comparador registra entrada por produtos, matriz calculada, cenario salvo e abertura de simulador;
- simuladores leves registram calculos executados;
- `window.BFJourneyAnalytics.summary()` deve devolver totais e taxa local para dashboard e testes.

## Funil Administrativo

Pagina de referencia: `pages/dashboard-admin.html`.

Contrato adicional:

- secao `data-admin-journey-funnel`;
- stagebar com etapa `Funil`;
- `document.body.dataset.adminJourneyFunnelReady='true'` apos renderizacao;
- funil por etapa com selecao, comparador, matriz, salvos e simuladores;
- funil por papel com clientes, consultores, admins, anonimos e desconhecidos;
- feed recente com evento, detalhe, papel, usuario e data.

Contrato funcional:

- `window.BFJourneyAnalytics.all()` deve ler todas as chaves `bf_journey_analytics_v1:*`;
- `window.BFJourneyAnalytics.roleFunnel()` deve agregar eventos de todos os usuarios locais;
- eventos anonimos ficam agrupados como `anonimo`;
- usuarios existentes em `BFAuth.listUsers()` devem herdar papel e rotulo corretos.

## Alertas Operacionais Admin

Pagina de referencia: `pages/dashboard-admin.html`.

Contrato adicional:

- secao `data-admin-operational-alerts`;
- stagebar com etapa `Alertas`;
- `document.body.dataset.adminOperationalAlertsReady='true'` apos renderizacao;
- `document.body.dataset.adminOperationalAlertsCount` com o total aberto;
- cards `data-admin-operational-alert` para alertas de `abandono` e `sla`;
- cada card deve exibir severidade, origem, idade do sinal, motivo e CTA.

Contrato funcional:

- abandono deve detectar selecao sem comparador, comparador sem matriz e matriz sem continuidade;
- SLA local deve usar prioridade alta em 4h, media em 24h e baixa em 72h;
- leads em `aguardando_cliente` acima de 48h devem aparecer como alerta de acompanhamento;
- estados `qualificado` e `descartado` nao devem gerar alerta aberto;
- o bloco nao envia dados para fora do navegador e usa apenas `localStorage`.

## Stagebar v8

Classe base: `bf-v8-stagebar`.

Uso recomendado:

- Trilha de Decisao: diagnostico, ponte, continuidade, acao e handoff.
- Comparador: perfil, entrada da matriz, decisao, memoria de calculo e continuidade.
- Produtos: perfil, filtros, catalogo, comparador e continuidade.
- Calculadoras: perfil, historico, hub/detalhe, resultado, memoria e continuidade.
- Simuladores leves: entrada, decisao, memoria, comparacao e dashboard.
- Dashboard Cliente: continuidade, perfil, historico, decisao e handoff.
- Handoff Consultivo: operacao, leads, checklist, auditoria e admin.
- Dashboard Admin: operacao, usuarios, funil, alertas, leads, auditoria e atendimento.
- Simulador: status da base, prateleira, resumo financeiro e carteira.
- Carteira: simulacoes salvas, visao executiva, oportunidades, agenda e decisao operacional.
- Assembleias: historico, contemplacoes, lances e tabela analitica.

Contrato minimo:

- atributo `data-v8-stagebar`;
- bloco `bf-v8-stagebar__intro`;
- quatro ou mais links `bf-v8-stagebar__item`;
- cada link deve ter `data-step`, `span` de categoria e `strong` de destino.

## Decision Strip v8

Classe base: `bf-v8-decision-strip`.

Uso atual:

- `pages/trilha-decisao.html`: bloco `data-journey-bridge-strip`.
- `pages/comparador.html`: bloco `data-comparator-decision-strip`.
- `pages/produtos.html`: bloco `data-products-decision-strip`.
- `pages/calculadoras.html`: bloco `data-calculators-decision-strip`.
- `pages/calculadora-*.html`: bloco `data-calculator-decision-strip`.
- `pages/simulador-*.html` leves: bloco `data-light-simulator-decision-strip`.
- `pages/dashboard-cliente.html`: bloco `data-client-continuity-strip`.
- `pages/handoff-consultivo.html`: bloco `data-handoff-operational-strip`.
- `pages/dashboard-admin.html`: bloco `data-admin-operational-strip`.
- `pages/simulador.html`: bloco `data-simulator-decision-strip`.
- `pages/assembleias.html`: bloco `data-assembly-decision-strip`.
- `pages/carteira.html`: bloco `data-portfolio-decision-strip`.

Contrato minimo:

- cabecalho `bf-v8-decision-strip__head`;
- grid `bf-v8-decision-strip__grid`;
- quatro cards `bf-v8-decision-card`;
- cards devem traduzir dado historico em proxima acao.
- em paginas com filtros, os cards devem reagir ao recorte atual da visao.

Tons suportados:

- `bf-v8-decision-card--warning`;
- `bf-v8-decision-card--stable`;
- `bf-v8-decision-card--info`.

## Paginas Prioritarias Cobertas

- `pages/index.html`
- `pages/produtos.html`
- `pages/calculadoras.html`
- `pages/calculadora-*.html`
- `pages/simulador-financiamento.html`
- `pages/simulador-veiculos.html`
- `pages/simulador-cdc.html`
- `pages/simulador-garantia.html`
- `pages/simulador-consignado.html`
- `pages/simulador-consorcio.html`
- `pages/comparador.html`
- `pages/trilha-decisao.html`
- `pages/dashboard-cliente.html`
- `pages/handoff-consultivo.html`
- `pages/dashboard-admin.html`
- `pages/simulador.html`
- `pages/carteira.html`
- `pages/assembleias.html`
- `pages/educacao.html`
- `pages/compliance.html`
- `pages/dados-abertos.html`
- `pages/api-docs.html`
- `pages/componentes-v8.html`
- `pages/duvidas.html`
- `pages/sobre-nos.html`
- `pages/configuracoes.html`

## Validacao

Comando preferencial:

```powershell
$node='C:\Users\gustavo.pinheiro\.cache\codex-runtimes\codex-primary-runtime\dependencies\node\bin\node.exe'
& $node tools\validate-design-system.mjs
```

Resultado esperado:

- `ok: true`
- paginas ativas sem falhas estruturais;
- legados controlados apenas como warnings;
- referencias locais das paginas criticas sem quebra.
- paginas ativas sem sinais de mojibake visual.
- `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css` sem caracteres nao ASCII.
- Trilha de Decisao, Dashboard Cliente, Handoff, Admin, Simulador, Carteira e Assembleias com stagebar v8 obrigatoria.
- Produtos, Calculadoras, calculadoras individuais, simuladores leves, Comparador, Trilha de Decisao, Dashboard Cliente, Handoff, Admin, Simulador, Assembleias e Carteira com decision strip v8 obrigatoria.
- Produtos, Calculadoras, calculadoras individuais e simuladores leves com timeline de ponte obrigatoria.
- Comparador com timeline de ponte obrigatoria.
- Trilha de Decisao com timeline de ponte obrigatoria.
- Dashboard Cliente com timeline de continuidade obrigatoria.
- Handoff com feed de auditoria local obrigatorio.
- Educacao, Compliance, Dados Abertos e API Docs com `data-trust-decision-strip` e `data-trust-timeline`.
- Sobre e Duvidas com `data-trust-decision-strip` e `data-trust-timeline`.
- Home com `data-home-decision-strip` e `data-home-institutional-timeline`.
- Configuracoes com `data-settings-decision-strip`, `data-settings-timeline` e chips de preferencias ativas.
- Componentes v8 com `data-component-decision-strip`, `data-component-timeline` e amostras de tokens/componentes.

## Proximos Ajustes Visuais

- Transformar funil administrativo em alertas de abandono e SLA local.
- Consolidar classes repetidas nos CSS legados quando houver tempo de refatoracao.
- Evoluir o validador para checar overflow visual via automacao headless.
