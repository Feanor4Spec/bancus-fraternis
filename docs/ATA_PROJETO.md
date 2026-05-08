# Ata do Projeto - ConsorcioPro (historico)

> Status 2026-05-08: documento historico. A plataforma atual e Bank Fratern; ConsorcioPro permanece como nome legado do simulador de consorcio e referencia de origem.

> Ata de criação e primeira entrega do projeto de Simulador de Consórcio

---

## Identificação

| Campo | Valor |
|-------|-------|
| **Projeto** | ConsórcioPro — Simulador de Consórcio Profissional |
| **Data de Criação** | 10 de abril de 2026 |
| **Versão Entregue** | v1.0.0 |
| **Responsável Técnico** | Assistente IA (Arquiteto Front-end Sênior) |
| **Solicitante** | Gustavo Pinheiro |
| **Tipo** | Aplicação Web Front-end (HTML/CSS/JS) |
| **Status** | ✅ Primeira versão funcional entregue |

---

## Contexto e Motivação

Foi solicitada a criação de um **simulador completo de consórcio** que combinasse quatro visões:

1. **Visão Comercial** — Geração de propostas elegantes para apresentação a clientes
2. **Visão Educativa** — Explicação didática de todos os conceitos de consórcio
3. **Visão Analítica** — Tabela mensal detalhada com cronograma financeiro
4. **Visão Operacional** — Simulação de eventos como adiantamento, inadimplência, lances

O objetivo principal é permitir que **consultores comerciais, clientes finais e times de produto** compreendam e simulem cenários reais de consórcio de forma transparente.

---

## Escopo da Entrega v1.0.0

### ✅ Funcionalidades Implementadas

| # | Funcionalidade | Status |
|---|---------------|--------|
| 1 | Wizard de 6 etapas com stepper visual | ✅ Entregue |
| 2 | Formulário de dados do cliente e proposta | ✅ Entregue |
| 3 | Formulário de parâmetros financeiros (20+ campos) | ✅ Entregue |
| 4 | Configuração de adiantamentos dinâmicos | ✅ Entregue |
| 5 | Configuração de inadimplência dinâmica | ✅ Entregue |
| 6 | Motor de cálculo com árvore de decisão | ✅ Entregue |
| 7 | 2 políticas de saldo devedor (A e B) | ✅ Entregue |
| 8 | 5 modalidades de lance | ✅ Entregue |
| 9 | Parcela reduzida pré-contemplação | ✅ Entregue |
| 10 | 16 KPIs executivos em cards visuais | ✅ Entregue |
| 11 | 6 gráficos interativos (Chart.js) | ✅ Entregue |
| 12 | Tabela analítica mensal com toggle de detalhes | ✅ Entregue |
| 13 | 21 conceitos educativos com fórmulas e exemplos | ✅ Entregue |
| 14 | Exportação PDF (jsPDF + html2canvas) | ✅ Entregue |
| 15 | Versão para impressão | ✅ Entregue |
| 16 | Layout de proposta comercial elegante | ✅ Entregue |
| 17 | Design responsivo (desktop, tablet, mobile) | ✅ Entregue |
| 18 | Compatibilidade iPhone (safe area) | ✅ Entregue |
| 19 | Máscaras monetárias pt-BR | ✅ Entregue |
| 20 | Validações de formulário com feedback | ✅ Entregue |
| 21 | Dados de exemplo carregáveis | ✅ Entregue |
| 22 | Botão resetar simulação | ✅ Entregue |
| 23 | Tooltips explicativos nos campos | ✅ Entregue |
| 24 | Árvore lógica visual na interface | ✅ Entregue |
| 25 | Barra de ações fixa no mobile | ✅ Entregue |

### 📊 Métricas de Entrega

| Métrica | Valor |
|---------|-------|
| Total de arquivos | 7 arquivos de código |
| Linhas de HTML | ~630 |
| Linhas de CSS | ~750 |
| Linhas de JavaScript | ~1.740 |
| Total de linhas de código | ~3.120 |
| Dependências externas | 4 (via CDN) |
| Backend necessário | Nenhum |
| Build necessário | Nenhum |

---

## Cenário de Teste Utilizado

O simulador foi testado com o seguinte cenário padrão:

| Parâmetro | Valor |
|-----------|-------|
| Cliente | Exemplo Comercial |
| Tipo de bem | Imóvel |
| Carta de crédito | R$ 100.000,00 |
| Prazo total | 100 meses |
| Taxa de administração | 16% |
| Fundo de reserva | 2% |
| Seguro | 0% |
| Mês aniversário do grupo | 12 |
| Mês de contemplação | 18 |
| Lance próprio | 20% |
| Lance embutido | 30% |
| Índice de reajuste anual | 5% |
| Parcela reduzida | Não |
| Inadimplência | Não |
| Adiantamento | Não |

### Resultados Obtidos

| KPI | Valor |
|-----|-------|
| Parcela inicial total | R$ 1.180,00 |
| Lance total | R$ 50.000,00 |
| Carta líquida | R$ 70.000,00 |
| Prazo restante (após contemplação) | 83 meses |
| Saldo devedor inicial | R$ 100.000,00 |

---

## Decisões Técnicas Registradas

### 1. Arquivos separados vs arquivo único
**Decisão:** Arquivos separados (modular)  
**Motivo:** O PRD solicitou preferencialmente arquivo único, mas também pediu "crie pastas, separe funções". A modularidade facilita manutenção, evolução e documentação.

### 2. JavaScript puro vs framework
**Decisão:** JavaScript ES6+ puro com IIFEs  
**Motivo:** Eliminação de dependência de build. O projeto funciona abrindo o HTML direto no navegador.

### 3. Política de saldo devedor
**Decisão:** Duas políticas configuráveis (A e B)  
**Motivo:** Diferentes administradoras adotam diferentes políticas. Flexibilidade é essencial.

### 4. Tratamento do lance na parcela
**Decisão:** Lance abatido diretamente do saldo devedor no mês de contemplação  
**Motivo:** Modelo mais comum no mercado de consórcio.

### 5. Componentes de parcela
**Decisão:** Parcela Total = Parcela Base + Taxa Adm/N + Fundo Reserva/N + Seguro  
**Motivo:** Diluição linear das taxas ao longo do prazo, conforme prática do mercado.

---

## Bugs Encontrados e Corrigidos

| # | Bug | Causa | Correção |
|---|-----|-------|----------|
| 1 | IDs duplicados na tabela | Dois elementos com `id="tabela-header-detalhada"` | Substituído por `class="col-detail"` individual |
| 2 | Custo total negativo | `custoTotal = totalPago - carta` não incluía lance | Corrigido para `totalPago + lanceTotal - carta` |

---

## Evolução v2.0 — Comparador de Grupos ✅

Implementado em 10/04/2026:

| # | Funcionalidade | Status |
|---|---------------|--------|
| 1 | Motor de comparação (`comparator.js`) | ✅ |
| 2 | 4 grupos de exemplo para comparação | ✅ |
| 3 | 5 gráficos comparativos (KPIs, parcelas, saldo, composição, contemplação) | ✅ |
| 4 | Narrativa executiva automática | ✅ |
| 5 | Badges de vencedor por métrica | ✅ |
| 6 | Etapa 7 do stepper | ✅ |

---

## Evolução v3.0 — Prateleira de Grupos + Nova Jornada ✅

Implementado em 10/04/2026:

### Nova Jornada do Usuário (10 Etapas)

| Etapa | Nome | Tipo |
|-------|------|------|
| 1 | Dados do Consultor | **NOVA** |
| 2 | Dados do Cliente | **NOVA** |
| 3 | Filtros de Simulação | **NOVA** |
| 4 | Prateleira de Grupos | **NOVA** |
| 5 | Parâmetros Financeiros | Existente (renumerada) |
| 6 | Eventos e Regras | Existente (renumerada) |
| 7 | Resultados | Existente (renumerada) |
| 8 | Tabela Analítica | Existente (renumerada) |
| 9 | Proposta | Existente (renumerada) |
| 10 | Comparador | Existente (renumerada) |

### Funcionalidades V3

| # | Funcionalidade | Status |
|---|---------------|--------|
| 1 | Formulário dedicado para consultor (6 campos) | ✅ |
| 2 | Formulário dedicado para cliente (6 campos + objetivo) | ✅ |
| 3 | Filtros: Administradora, Produto/Segmento, Prazo (range) | ✅ |
| 4 | Catálogo com 24 grupos em 6 segmentos | ✅ |
| 5 | Tabela profissional com score, dados e ações | ✅ |
| 6 | Modal de detalhes expansível (🔍) com 5 seções | ✅ |
| 7 | Seleção de grupo com auto-preenchimento de parâmetros | ✅ |
| 8 | 7 critérios de ordenação (score, taxa, carta, prazo, etc.) | ✅ |
| 9 | Motor de score ponderado (ativas, contemplações, taxa, lance) | ✅ |
| 10 | Backup automático V2 em `versions/v2/` | ✅ |

### Novos Arquivos

| Arquivo | Linhas | Descrição |
|---------|--------|-----------|
| `js/shelf-data.js` | ~270 | Base de dados da prateleira (24 grupos) |
| `js/shelf-engine.js` | ~230 | Motor de filtragem, ordenação e score |

### Métricas Atualizadas (V3)

| Métrica | Valor |
|---------|-------|
| Total de arquivos JS | 7 |
| Total de linhas de código | ~5.800+ |
| Etapas no wizard | 10 |
| Grupos na prateleira | 24 |
| Segmentos cobertos | 6 |

---

## Evolução v4.0 — Portal Institucional de Acesso ✅

Implementado em 10/04/2026:

Adicionado um layout premium bancário como página inicial do projeto, reposicionando o simulador como uma ferramenta dentro do portfólio da instituição.

### Funcionalidades V4

| # | Funcionalidade | Status |
|---|---------------|--------|
| 1 | Separação da arquitetura: `index.html` (Landing) vs `simulador.html` (Sistema) | ✅ |
| 2 | Layout Institucional Bank Fratern (Design System consistente com `styles.css`) | ✅ |
| 3 | Menu interativo "Produtos Especializados" (Dropdown via CSS puro) | ✅ |
| 4 | Hero Section com logo e copy institucional | ✅ |
| 5 | Grid de produtos (Cross-sell) com acesso dinâmico à Engenharia de Consórcio | ✅ |
| 6 | Rodapé financeiro com avisos legais | ✅ |

---

## Próximos Passos Sugeridos

### Evolução v4.1 (Simulador / Back-office)
- [ ] Projeto Estruturado (multi-grupo, multi-cota)
- [ ] Filtros avançados (FGTS, parcela reduzida, taxa máx)
- [ ] Importação de base CSV real

### Evolução v4.0
- [ ] Backend para salvar simulações
- [ ] Integrar com APIs de índices econômicos reais
- [ ] PWA (Progressive Web App) para uso offline
- [ ] Dark mode

---

## Assinaturas

| Papel | Nome | Data |
|-------|------|------|
| **Solicitante** | Gustavo Pinheiro | 10/04/2026 |
| **Executor Técnico** | Assistente IA (Arquiteto Front-end) | 10/04/2026 |

---

*Esta ata registra a criação e evolução do ConsórcioPro (v1 → v2 → v3).*
