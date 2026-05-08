# Plano do Salto de Plataforma - Bank Fratern

Atualizado em 2026-04-24.

## Objetivo

Transformar o Bank Fratern de um conjunto de paginas e simulador de consorcio em uma plataforma digital modular com:

- Educacao financeira.
- Simuladores financeiros.
- Comparador de produtos.
- Banco de dados financeiro.
- Dashboard cliente e interno.
- Motor de recomendacao.
- Futuro marketplace assistido.

## Fase 0/1 entregue neste ciclo

### Estrutura modular adicionada

- `assets/data/produtos.json`
- `assets/data/instituicoes.json`
- `assets/data/formulas.json`
- `assets/data/glossario.json`
- `assets/data/indices.json`
- `assets/data/regras-negocio.json`
- `assets/js/formulas/*.js`
- `assets/js/services/*.js`
- `assets/js/components/*.js`
- `assets/js/bf-platform.js`
- `assets/css/platform.css`

### Paginas novas

- `pages/educacao.html`
- `pages/produtos.html`
- `pages/comparador.html`
- `pages/dados-abertos.html`
- `pages/api-docs.html`
- `pages/compliance.html`
- `pages/simulador-consorcio.html`
- `pages/simulador-financiamento.html`
- `pages/simulador-veiculos.html`
- `pages/simulador-cdc.html`
- `pages/simulador-garantia.html`
- `pages/simulador-consignado.html`
- `pages/dashboard-cliente.html`
- `pages/dashboard-admin.html`

### Capacidades funcionais ja navegaveis

- Glossario carregado por JSON local.
- Produtos financeiros carregados por JSON local.
- Simulador de financiamento com Price e SAC.
- Simulador CDC com custo total e matriz mensal.
- Simulador de credito com garantia com LTV, limite, parcela e custo total.
- Simulador consignado com margem, elegibilidade, parcela e custo total.
- Comparador entre financiamento e consorcio.
- Simulador de veiculos comparando financiamento e consorcio.
- Dashboard inicial lendo estatisticas do `Storage` local.
- Motor de recomendacao heuristico por urgencia, renda, entrada, garantia e risco.
- Pagina de dados abertos com datasets internos.
- Pagina de API Docs com contrato inicial dos futuros endpoints.
- Pagina de compliance com separacao entre dados publicos, privados e consentidos.

## Arquitetura progressiva

1. HTML, CSS e JavaScript puro.
2. Dados mockados e curados em JSON local.
3. Servicos JS para calculos e recomendacao.
4. API propria com os mesmos contratos dos servicos locais.
5. Banco de dados para produtos, taxas, simulacoes anonimas e leads.
6. Base privada para dados pessoais.
7. Open Finance somente com consentimento e APIs seguras.
8. Marketplace assistido para consultores e parceiros.

## Proximas fases

### Fase 2 - Consolidar simuladores

- Integrar o simulador de consorcio V7 ao novo shell sem perder a prateleira real.
- Mostrar CET estimado e premissas em todos os simuladores.
- Criar comparacao multi-produto incluindo CDC, garantia e consignado.
- Salvar cenarios dos novos simuladores no dashboard cliente.

### Fase 3 - API local e contratos

- Criar camada `api/` ou `services/api` com endpoints reais.
- Migrar `assets/js/services` para consumir API quando disponivel.
- Versionar contratos em `api-docs.html`.

### Fase 4 - Banco de dados financeiro

- Criar modelos de produtos, instituicoes, taxas, indices, simulacoes anonimas e recomendacoes.
- Separar base publica, base analitica e base privada.
- Criar painel admin com indicadores reais.

### Fase 5 - Recomendacao avancada

- Evoluir ranking heuristico para matriz ponderada.
- Considerar urgencia, renda, comprometimento, garantia, prazo, tolerancia a risco e objetivo.
- Explicar a recomendacao com justificativas auditaveis.

### Fase 6 - Marketplace assistido

- Criar fluxo de lead com consentimento.
- Direcionar para consultor/parceiro.
- Registrar origem, produto recomendado e status comercial.

## Criterios de aceite por ciclo

- Paginas alteradas respondem `200` no servidor local.
- Prints ficam em `docs/test-prints/`.
- Checkpoint ZIP fica em `versions/`.
- Plano e changelog sao atualizados.
- Dados pessoais nao entram em JSON publico.
