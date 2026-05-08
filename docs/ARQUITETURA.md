# Arquitetura Tecnica - ConsorcioPro (historico)

> Status 2026-05-08: documento historico. A plataforma atual e Bancus Fraternis; ConsorcioPro permanece como nome legado do simulador de consorcio e referencia de origem.

> Documentação detalhada de cada arquivo do projeto, suas responsabilidades, funções expostas e decisões de design.

---

## Índice

1. [Visão Geral da Arquitetura](#visão-geral-da-arquitetura)
2. [index.html (Landing)](#indexhtml-landing)
3. [simulador.html (App)](#simuladorhtml-app)
4. [css/styles.css](#cssstylescss)
5. [js/data.js](#jsdatajs)
5. [js/engine.js](#jsenginejs)
6. [js/charts.js](#jschartsjs)
7. [js/export.js](#jsexportjs)
8. [js/app.js](#jsappjs)
9. [Fluxo de Dados](#fluxo-de-dados)
10. [Dependências Externas](#dependências-externas)

---

## Visão Geral da Arquitetura

```
┌──────────────────────────────────────────────────┐
│                  index.html                       │
│      (Landing Page Institucional Bancus Fraternis)    │
├──────────────────────────────────────────────────┤
│                simulador.html                     │
│  (Estrutura HTML, formulários, stepper, layout)   │
├──────────────────────────────────────────────────┤
│               css/styles.css                      │
│(Tokens, layout banco, componentes, responsivo)    │
├──────────────┬──────────┬────────────────────────┤
│  js/data.js  │  Dados   │ Exemplo + Conceitos    │
├──────────────┼──────────┼────────────────────────┤
│ shelf-data.js│  Catálogo│ Base ABAC de Grupos    │
├──────────────┼──────────┼────────────────────────┤
│ shelf-engine.│  Motor   │ Filtro e Score         │
├──────────────┼──────────┼────────────────────────┤
│ js/engine.js │  Cálculo │ Árvore de decisão      │
├──────────────┼──────────┼────────────────────────┤
│ comparator.js│  Análise │ Motor de Comparação    │
├──────────────┼──────────┼────────────────────────┤
│ js/charts.js │  Visual  │ Gráficos Chart.js      │
├──────────────┼──────────┼────────────────────────┤
│ js/export.js │  Saída   │ PDF + Impressão        │
├──────────────┼──────────┼────────────────────────┤
│  js/app.js   │ Controle │ UI, validação, orquest. │
└──────────────┴──────────┴────────────────────────┘
```

**Padrão adotado:** Módulos JavaScript usando IIFE (Immediately Invoked Function Expression) que expõem APIs públicas via `return`. Isso evita poluição do escopo global e mantém encapsulamento.

**Ordem de carregamento dos scripts:**
1. `data.js` — dados e conceitos estáticos
2. `shelf-data.js` — base de dados bruta dos grupos
3. `shelf-engine.js` — lógica de filtros e score da prateleira
4. `engine.js` — motor de cálculo
5. `comparator.js` — motor de comparação de grupos
6. `charts.js` — gráficos (depende de Chart.js)
7. `export.js` — exportação (depende de jsPDF + html2canvas)
8. `app.js` — controlador (depende de todos os anteriores)

---

## index.html (Landing Page)

**Caminho:** `./index.html`  
**Tamanho:** ~150 linhas  
**Responsabilidade:** Portal de entrada institucional (Bancus Fraternis). Possui navegação de alto nível e cards de acesso rápido que direcionam o usuário para o `simulador.html`.

---

## simulador.html (App Simulador)

**Caminho:** `./simulador.html`  
**Tamanho:** ~980 linhas  
**Responsabilidade:** Estrutura web app contendo a jornada interativa de 10 etapas da simulação.

### O que contém no Simulador

| Seção | Função |
|-------|--------|
| `<head>` | Meta tags, SEO, fontes, CDNs, link para CSS |
| Toast Container | Container para notificações flutuantes |
| Hero/Header | Cabeçalho com título, subtítulo e botões de ação |
| Stepper | Navegação visual expandida (10 etapas conectadas) horizontalmente |
| Etapa 1 | Formulário de dados do Consultor (nome, empresa, contato) |
| Etapa 2 | Formulário de dados do Cliente (nome, contato, objetivo) |
| Etapa 3 | Filtros para a prateleira de grupos |
| Etapa 4 | Prateleira de Grupos (tabela com multi-seleção V5) + Painel de Grupos Selecionados (carrinho com edição inline) |
| Etapa 5 | Parâmetros Financeiros (auto-preenchidos ou manuais) |
| Etapa 6 | Eventos e Regras (adiantamentos e inadimplência) |
| Etapa 7 | Resultados (Cards com KPIs financeiros globais) |
| Etapa 8 | Tabela Analítica (fluxo de caixa mensal) |
| Etapa 9 | Proposta Comercial (pré-visualização e PDF) |
| Etapa 10 | Comparador de Grupos (lado a lado, com gráficos e narrativa) |
| Modal Shelf | Modal overlay para ver detalhes profundos de um grupo da prateleira |
| Scripts | Importação dos 8 arquivos `.js` na ordem correta |

### Decisões de Design
- **Formulários sem `<form>` tag**: evita submit/reload acidental, tudo controlado via JS
- **Stepper clicável**: permite navegação não-linear entre etapas já visitadas (se validadas)
- **Canvas inline**: os `<canvas>` para Chart.js são pré-declarados no HTML
- **Hidden Inputs**: Valores preenchidos pela prateleira (ex: tipo de bem) ficam invisíveis caso desnecessários
- **Tooltips via `data-tip`**: tooltips CSS-only usando pseudo-elementos

---

## css/styles.css

**Caminho:** `./css/styles.css`  
**Tamanho:** ~750 linhas  
**Responsabilidade:** Design system completo — tokens, componentes, layout, responsivo e impressão.

### Estrutura Interna

| Seção | O que define |
|-------|-------------|
| **CSS Custom Properties** | 70+ variáveis: paleta de cores (9 tons de primária, accent, success, danger), tipografia (8 tamanhos), espaçamento (12 níveis), sombras (4 níveis), bordas (6 raios), transições |
| **Reset & Base** | Box-sizing, margin/padding zero, scroll behavior, font smoothing |
| **Typography** | Hierarquia de headings (h1-h6), line-height, letter-spacing |
| **Layout** | Container responsivo com max-width 1280px |
| **Hero** | Gradiente 3-cores, pseudo-elementos decorativos (radial gradients), backdrop blur |
| **Buttons** | 7 variantes (primary, accent, outline, ghost, danger, success) + 3 tamanhos + estados |
| **Stepper** | Indicador de progresso horizontal, estados (ativo, completo), conectores |
| **Cards** | Card base, card flat, header com ícones coloridos |
| **KPI Cards** | Grid auto-fill, barra de cor superior, animação hover translateY |
| **Forms** | Inputs, selects, textareas, labels, hints, errors, switch/toggle |
| **Step Sections** | Display toggle, animação fadeIn |
| **Tables** | Wrapper com scroll horizontal, header sticky, zebra striping |
| **Badges** | 7 variantes cromáticas para eventos (adesão, aniversário, etc.) |
| **Charts** | Grid responsivo para gráficos |
| **Concept Cards** | Cards educativos com ícone, fórmula (monospace), exemplo (destaque) |
| **Proposal** | Layout de proposta comercial com header, body, footer, assinatura |
| **Collapsible** | Accordion com seta animada |
| **Toast** | Notificações com slideIn animation |
| **Mobile Bar** | Barra fixa inferior com safe-area-inset |
| **Footer** | Fundo escuro, texto claro |
| **Loading** | Overlay com spinner CSS |
| **Responsive** | Breakpoints: 1024px, 768px, 480px — adapta grid, stepper, formulários |
| **iPhone** | `@supports (padding: env(safe-area-inset-bottom))` |
| **Print** | Oculta elementos de UI, remove sombras, ajusta fontes |
| **Utilities** | Hidden, cores de texto, margin, flex, animações |
| **Scrollbar** | Estilização personalizada WebKit |

---

## js/data.js

**Caminho:** `./js/data.js`  
**Tamanho:** ~300 linhas  
**Responsabilidade:** Armazena dados estáticos que alimentam o simulador.

### Objetos Exportados

#### `DadosExemplo.padrao`
Objeto com **todos os campos** pré-preenchidos para teste:

```javascript
{
  nomeCliente: 'Gustavo Santana',
  tipoBem: 'Veículos',
  valorCarta: 100000,
  prazoTotal: 100,
  taxaAdm: 13,
  fundoReserva: 2,
  seguro: 0,
  mesAniversario: 12,
  mesContemplacao: 6,
  lanceProprio: 20,
  lanceEmbutido: 30,
  indiceReajuste: 10,
  // ... + 25 campos adicionais
}
```

#### `ConceitosConsorcio`
Array com **21 conceitos** educativos. Cada item contém:

| Campo | Tipo | Exemplo |
|-------|------|---------|
| `id` | string | `'carta-credito'` |
| `titulo` | string | `'Carta de Crédito'` |
| `icone` | emoji | `'💳'` |
| `cor` | string | `'blue'`, `'gold'`, `'green'`, `'red'`, `'purple'` |
| `descricao` | string | Explicação em português claro |
| `formula` | string | Fórmula matemática (pode ter `\n`) |
| `observacao` | string | Dica prática |
| `exemplo` | string | Exemplo numérico concreto |

**Conceitos cobertos:** Carta de Crédito, Saldo Devedor, Prazo Total, Prazo Restante, Parcela Base, Parcela Total, Taxa de Administração, Fundo de Reserva, Seguro, Índice de Reajuste, Mês Aniversário, Contemplação, Lance Livre, Lance Fixo, Lance Embutido, Lance FGTS, Adiantamento, Inadimplência, Carta Líquida, Valor Total do Plano, Evento Mensal.

---

## js/shelf-data.js e js/shelf-engine.js (Prateleira de Grupos V3)

Módulos criados na versão 3.0 para implementar um motor de catálogo (Shelf of Groups) que simula integração com uma base de dados real ou APIs (como ABAC).

### `js/shelf-data.js`
- **Tamanho:** ~270 linhas
- **Responsabilidade:** Fornece o objeto global `ShelfCatalog` como 'banco de dados' na memória.
- **Estrutura:** Array com 24 `ShelfGroup` cobrindo 6 segmentos (Imóveis, Auto, Motos, Pesados, Serviços, Outros) e múltiplas administradoras realistas.
- **Atributos:** Detalhes profundos como CNPJ, data base, volume de cotas (ativas, quitadas, pendentes), contemplações no mês, e flexibilidade comercial (redução de parcela, lance fixo).

### `js/shelf-engine.js`
- **Tamanho:** ~320 linhas
- **Responsabilidade:** Motor de filtro, ordenação, inteligência do catálogo e gerenciamento do Projeto Estruturado.
- **Funções Exportadas (`ShelfEngine`):**
  - `filterGroups(catalog, filters)`: Aplica filtros combinados (adm, segmento, prazo min/max).
  - `computeAllScores(catalog)`: Gera pontuação para cada grupo baseando-se em ativas, contemplações, taxas e regras de lance (Score Prateleira).
  - `sortGroups(groups, sortBy)`: Classifica os grupos por 7 critérios predefinidos.
  - `createProjectItem(group, qtdCotas, overrideValorCarta)`: Cria item de projeto com valor de carta customizável (V5).
  - `updateProjectItem(project, itemId, patch)`: Atualiza campos de um item (recalcula `valorCartaTotal` ao mudar `quantidadeCotas` ou `valorCartaUnitario`).
  - `removeProjectItem(project, itemId)`: Remove item do projeto.
  - `simulateStructuredProject(project)`: Executa simulação consolidada de todos os itens do projeto.

---

## js/engine.js

**Caminho:** `./js/engine.js`  
**Tamanho:** ~587 linhas  
**Responsabilidade:** Motor de cálculo financeiro. Contém TODA a lógica de negócio.

### Módulo: `ConsorcioEngine` (IIFE)

#### Constantes
- `POLITICA.A` = `'carta'` — Saldo = Carta de Crédito
- `POLITICA.B` = `'carta_mais_custos'` — Saldo = Carta + Taxa Adm + FR + Seguro
- `ADIANTAMENTO_TIPO.REDUZIR_SALDO` / `REDUZIR_PRAZO`

#### Funções Internas (privadas)

| Função | Responsabilidade |
|--------|-----------------|
| `calcularSaldoInicial(params)` | Calcula saldo devedor inicial conforme política A ou B |
| `calcularLance(params)` | Calcula lance próprio, embutido, FGTS, fixo e total por modalidade |
| `isAniversario(t, params)` | Verifica se mês `t` é aniversário do grupo (a cada 12 meses) |
| `getAdiantamento(t, params)` | Busca evento de adiantamento no mês `t` |
| `getInadimplencia(t, params)` | Busca evento de inadimplência no mês `t` |
| `getRegularizacao(t, params)` | Busca evento de regularização no mês `t` |
| `getIndiceReajuste(params)` | Retorna índice decimal (ex: 0.05 para 5%) |

#### Funções Públicas (API)

| Função | Retorno | Descrição |
|--------|---------|-----------|
| `simular(params)` | `{ erro, resumo, cronograma }` | Executa simulação completa com validação |
| `calcularCronograma(params)` | `Array<MesData>` | Gera cronograma mês a mês (árvore de decisão) |
| `calcularResumo(params, cronograma)` | `Object` com 20+ KPIs | Resume os indicadores executivos |
| `validarParametros(params)` | `{ valido, mensagens }` | Valida todos os inputs |
| `compararCenarios(params)` | `{ comContemplacao, semContemplacao, parcelaCheia }` | Gera 3 cenários comparativos |

#### Árvore de Decisão (loop principal `calcularCronograma`)

```
Para cada mês t de 1 até N:
  ├─ t = 1 → Adesão: parcela = saldo / N
  ├─ isAniversario(t) → Reajuste: saldo *= (1 + índice)
  ├─ t = mesContemplacao → Lance: saldo -= lanceTotal
  ├─ getAdiantamento(t) → Abater saldo ou prazo
  ├─ getInadimplencia(t) → Registrar multa + juros, não pagar
  ├─ getRegularizacao(t) → Quitar atrasados + encargos
  └─ Caso geral → parcela = saldo / prazoRestante
  
  Após cada mês: saldo -= parcela, prazoRestante--
```

#### Estrutura de cada mês no cronograma

```javascript
{
  mes, saldoAnterior, saldoAjustado, indiceAplicado,
  parcelaBase, parcelaReduzida, componenteTaxaAdm,
  componenteFundoReserva, componenteSeguro, parcelaTotal,
  valorLance, valorAdiantado, multa, juros,
  saldoFinal, prazoRestante, evento, observacao
}
```

---

## js/comparator.js (Comparador de Grupos V2)

**Caminho:** `./js/comparator.js`
**Responsabilidade:** Realizar comparação profunda de múltiplos grupos ou cenários simultâneos, elegendo os mais atrativos segundo múltiplas KPIs.

### Módulo: `Comparator` (IIFE)
- **Funções Exportadas:**
  - `compareGroups(groupAParams, groupBParams)`: Executa as duas simulações e determina a diferença nas métricas principais.
  - `normalizeInputs(rawInput)`: Uniformiza parâmetros da interface/prateleira para cálculo.
  - `generateComparisonNarrative(...)`: Transforma os resultados algorítmicos em um parágrafo "gerencial" amigável que explica vantagens do vencedor.
  - `evaluateWinners(...)`: Marca qual grupo ganha em taxa, carta, fluxo, e rentabilidade.

---

## js/charts.js

**Caminho:** `./js/charts.js`  
**Tamanho:** ~250 linhas  
**Responsabilidade:** Integração com Chart.js para visualização de dados financeiros.

### Módulo: `ChartManager` (IIFE)

#### Configuração
- Paleta de cores alinhada ao design system
- Configuração padrão compartilhada: tooltips em R$, fontes Inter, grid sutil
- Gerenciamento de instâncias para destruir/recriar (evita memory leaks)

#### Funções Públicas

| Função | Tipo de Gráfico | Dados |
|--------|----------------|-------|
| `renderComposicaoPlano(id, resumo)` | Doughnut (rosca) | Carta vs Taxa Adm vs FR vs Seguro |
| `renderEvolucaoParcelas(id, cronograma)` | Line (área) | Parcela total ao longo dos 100 meses |
| `renderEvolucaoSaldo(id, cronograma)` | Line (área) | Saldo devedor decrescente |
| `renderImpactoLance(id, resumo)` | Bar (vertical) | Saldo antes vs lance vs saldo depois |
| `renderComparativoCenarios(id, cenarios)` | Grouped Bar | Com vs sem contemplação |
| `renderComparativoParcela(id, cenarios)` | Grouped Bar | Parcela atual vs parcela cheia |
| `renderAll(resultado, cenarios)` | — | Renderiza todos os 6 gráficos |
| `destroyAll()` | — | Destroi todas as instâncias |

---

## js/export.js

**Caminho:** `./js/export.js`  
**Tamanho:** ~250 linhas  
**Responsabilidade:** Gera propostas comerciais exportáveis (PDF e impressão).

### Módulo: `ExportManager` (IIFE)

#### Funções Públicas

| Função | O que faz |
|--------|-----------|
| `gerarHTMLProposta(params, resultado)` | Gera HTML completo da proposta com inline styles |
| `imprimirProposta(params, resultado)` | Abre nova janela com versão para impressão |
| `exportarPDF(params, resultado)` | Gera PDF via html2canvas + jsPDF |

#### Estrutura da Proposta Gerada
1. **Cabeçalho** — Logo ConsórcioPro, data
2. **Dados do Cliente** — Nome, tipo de bem, administradora, grupo/cota, consultor
3. **Resumo Financeiro** — 9 KPIs em grid com borda colorida
4. **Informações do Lance** — 6 métricas de lance
5. **Fluxo Mensal Resumido** — Tabela com primeiros 24 meses (ou até contemplação + 6)
6. **Observações** — Notas comerciais
7. **Disclaimer** — Aviso legal
8. **Assinaturas** — Linhas para cliente e consultor

---

## js/app.js

**Caminho:** `./js/app.js`  
**Tamanho:** ~350 linhas  
**Responsabilidade:** Controlador principal. Orquestra UI, formulários, validações e comunicação entre módulos.

### Módulo: `App` (IIFE)

#### Estado Interno
- `currentStep` — Etapa ativa (1 a 10)
- `TOTAL_STEPS` — Constante de número de páginas.
- `resultado` / `cenarios` — Resultados armazenados
- `shelfGroups` / `selectedShelfGroup` — Estado global da seleção no catálogo (V3)
- `projetoEstruturado` — Carrinho de grupos selecionados `{ itens: [] }` (V5)
- `compResult` — Mantém os dados da tela comparadora (V2)

#### Sub-módulo: `Format`
- `money(value)`, `number(value)`, `parseMoney(str)`, `applyMoneyMask(input)`

#### Funções Públicas da App (API geral)

| Função | Responsabilidade |
|--------|-----------------|
| `init()` | Inicializa selects, carrega máscaras, popula prateleira |
| `goToStep(n)` | Avança/volta e executa validações ou trigger de cálculos (`calcular()`) |
| `calcular()` | Trigger de todo o processamento com ConsorcioEngine |
| `exportarPDF()` / `imprimirProposta()` | Chamadas ao export.js |

#### Funções da Prateleira (V3/V5)

| Função | Responsabilidade |
|--------|-----------------|
| `buscarGrupos()` | Aciona `ShelfEngine`, calcula scores, renderiza `renderShelfTable` |
| `verDetalheGrupo(idx)` | Carrega overlay modal com dados profundos do ABAC/Prateleira |
| `selecionarGrupo(idx)` | **V5:** Adiciona grupo ao `projetoEstruturado` (carrinho multi-select) |
| `removerGrupoSelecionado(itemId)` | **V5:** Remove grupo do carrinho e re-renderiza |
| `renderGruposSelecionados()` | **V5:** Renderiza painel com tabela elitável de seleção na Prateleira |
| `atualizarItemProjeto(itemId, campo, valor)` | **V5:** Atualiza campo do item e recalcula variáveis no Carrinho |
| `onEditarItemProjeto(inputEl)` | **V5:** Handler global de campos editáveis (valor carta/qtd, lances, taxa, prazo) |
| `atualizarBotaoAvancar()` | **V5:** Atualiza texto/estado do botão "Simular N grupos" |
| `simularProjetoEstruturado()` | **V5:** Renderiza UI da Etapa 5 e avança a etapa vinculando ao Dashboard |
| `renderStep5Cart()` | **V5:** Lista os itens consolidados com campos individuais de Lances e Prazos |
| `renderStep5Dashboard(consolidado)` | **V5:** Desenha Painel Top-Level com os totais do Projeto |
| `recalcularProjeto()` | **V5:** Dispara cálculo geral do motor a cada input de teclado na Sacola |

#### Funções Comparativas e Interface

| Tipo | Responsabilidade |
|------|-----------------|
| `getParams()` | Extração e sanitização dos campos visuais |
| `validateCurrentStep()` | Checa presença e coerência de valores conforme o step ativo |
| `renderActiveSection()` | Toggle de views com CSS classes |
| `renderResultados()`, `renderTabela()`, `renderProposta()` | Populadores de dados finais |
| `executarComparacao()` | Prepara dados V2 para chamar `Comparator` |

---

## Fluxo de Dados

```
[Usuário preenche Dados + Filtros]
        │
        ▼
[Catálogo de Grupos V3 (Shelf)] ──→ Filtra e ranqueia base ABAC
        │ (V5: usuário clica em '+ Adicionar' múltiplas vezes)
        ▼
[Carrinho de Grupos Selecionados (projetoEstruturado)]
  ├─ Tabela de conferência (Etapa 4)
  └─ App.simularProjetoEstruturado() avança para Etapa 5
        │ 
        ▼
[Etapa 5: Sacola de Consórcios e Dashboard]
  ├─ Dashboard de Métricas Consolidadas (Totais do Projeto)
  ├─ Cards de Edição Individual (Taxa, Lances, MOB, Prazo)
  └─ App.recalcularProjeto() ──→ Atualiza totais em reatância
        │
        ▼
[App.getParams()] ──→ { consolida métricas do carrinho e dados do usuário }
        │
        ▼
[ConsorcioEngine.simular(params)] ou [ShelfEngine.simulateStructuredProject(projetoEstruturado)]
  ├─ validarParametros()
  ├─ calcularCronograma() ──→ Array[Prazo Total em meses]
  └─ calcularResumo() ──→ { 20+ KPIs }
        │
        ▼
[App.renderResultados() e Comparator]
  ├─ Monta KPI cards e Executivos
  ├─ Atualiza Comparador V2 (gráfico, avaliações)
  └─ ChartManager.renderAll() ──→ gráficos integrados
        │
        ▼
[App.renderTabela() e renderProposta()]
        │
        ▼
[Exportar] ──→ ExportManager.gerarPDF() ou Imprimir
```

---

## Dependências Externas

| Biblioteca | Versão | URL CDN | Uso |
|-----------|--------|---------|-----|
| Inter (fonte) | — | Google Fonts | Tipografia premium |
| Chart.js | 4.4.0 | jsDelivr | Gráficos interativos |
| jsPDF | 2.5.1 | cdnflare | Geração de PDF |
| html2canvas | 1.4.1 | cdnflare | Captura de tela para PDF |

> Todas carregadas via CDN. Nenhuma dependência local ou build necessário.

---

*Documentação atualizada em 11/04/2026 — Versão 5.0.0*
