# Protocolo de testes preferencial - Codex

Atualizado em 2026-05-12 para o projeto Bancus Fraternis.

## Caminho base

- Workspace atual: `<workspace>`
- Workspace historico: `<workspace-historico>`
- URL local preferencial: `http://127.0.0.1:8080/pages/index.html`
- URL publica GitHub Pages: `https://feanor4spec.github.io/bancus-fraternis/`
- Entrada de compatibilidade: `http://127.0.0.1:8080/index.html`
- Pagina principal de teste da Fase 1: `http://127.0.0.1:8080/pages/simulador.html`
- Modo de evidencia do loading: `http://127.0.0.1:8080/pages/simulador.html?showLoading=1`
- Pasta de prints: `docs/test-prints/`
- Pasta de checkpoints: `versions/`

## Servidor local

1. Preferencia: manter o servidor ja ativo em `127.0.0.1:8080`.
2. Se precisar reiniciar e o Node local estiver bloqueado por `Acesso negado`, usar:

```powershell
python -m http.server 8080 --bind 127.0.0.1
```

3. Validar as rotas com:

```powershell
Invoke-WebRequest http://127.0.0.1:8080/pages/index.html
Invoke-WebRequest http://127.0.0.1:8080/pages/simulador.html
Invoke-WebRequest http://127.0.0.1:8080/data_base/Tab_Grupos_Consorcio.json
```

## Ordem preferencial de teste visual

1. Tentar o navegador integrado quando disponivel.
2. Se a automacao integrada retornar `Acesso negado`, usar Chrome/Edge headless como fallback.
3. Se o headless nao conseguir gravar PNG direto por `Acesso negado`, abrir Chrome/Edge com CDP e usar `Page.captureScreenshot`, gravando o base64 via PowerShell.
4. Salvar evidencias em PNG dentro de `docs/test-prints/`.
5. Para fluxos com loading rapido, usar `?showLoading=1` para manter o overlay visivel no print.

## Evidencias minimas por ciclo visual

- Status HTTP das paginas alteradas.
- Print desktop da tela alterada.
- Print mobile quando a mudanca afetar responsividade.
- Log ou evidencia de carregamento da base real quando o ciclo tocar dados.
- Checkpoint ZIP em `versions/` quando nao houver Git disponivel.

## Design system v8

Validacoes obrigatorias:

- `assets/css/bf-design-system-v8.css` deve existir e ser carregado depois do CSS atual.
- Paginas com `shared-layout.js` devem receber `bf-v8-body`, `data-bf-archetype` e `data-bf-visual-version="8"` em runtime.
- Paginas sem shell compartilhado que continuam ativas devem carregar o v8 diretamente.
- `pages/index.html` deve manter a narrativa institucional antes do perfil financeiro.
- `pages/simulador.html` deve preservar loading da base real, barra percentual e retomada por `simulationId`.
- `pages/simulador.html` deve carregar `js/simulator-journey.js`, `js/simulator-state.js`, `js/simulator-shelf.js`, `js/simulator-cart.js`, `js/proposal-builder.js` e `js/proposal-governance.js` antes de `js/app.js`, preservando `App.*`.
- `data-simulator-journey-actions` deve aparecer no painel de decisao do simulador quando a jornada for renderizada.
- `pages/carteira.html`, `pages/assembleias.html`, `pages/duvidas.html`, `pages/sobre-nos.html` e `pages/configuracoes.html` devem estar marcadas como paginas ativas no contrato v8.
- `pages/index_2.html`, `pages/index_v4_paginas.html` e `pages/consorcio_user_journey_map_v2.html` devem permanecer como legados controlados.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve continuar retornando `ok: true`.
- `tools/validate-public-contracts.mjs` deve retornar `ok: true` quando contratos publicos forem afetados.
- `tools/validate-navigable-journey.mjs` deve retornar `ok: true` quando lousa, admin, rotas ou marcadores de jornada forem afetados.

Validacoes adicionais da fase v8B:

- `pages/simulador.html`, `pages/carteira.html` e `pages/assembleias.html` devem conter `data-v8-stagebar`.
- Cada stagebar deve ter 4 ou mais atalhos de continuidade.
- Desktop e mobile dessas paginas nao podem ter overflow horizontal.
- O print do simulador com `?showLoading=1` continua valido para provar o overlay de base real; para revisar a stagebar do simulador, usar tambem `pages/simulador.html` sem query string.

Comandos preferenciais:

```powershell
$node='<node-runtime>'
& $node tools\validate-design-system.mjs
& $node tools\validate-public-contracts.mjs
& $node tools\validate-simulator-refactor.mjs
& $node tools\validate-simulator-shelf.mjs
& $node tools\validate-simulator-cart.mjs
& $node tools\validate-navigable-journey.mjs
& $node tools\validate-github-pages-deploy.mjs
& $node tools\validate-calculadoras.mjs
```

## Governanca de contratos publicos

Objetivo: manter evolucoes compativeis com dados locais, deep links, services globais e marcadores usados por validadores.

Artefatos obrigatorios:

- `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`
- `tools/validate-public-contracts.mjs`
- `docs/test-reports/public-contracts-report.json`

Validacoes obrigatorias:

- Toda nova chave `localStorage` deve entrar em `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`.
- Todo novo marcador `data-*` usado por jornada, dashboard, proposta ou admin deve entrar na matriz.
- Movimentacoes comerciais do Dashboard Admin devem preservar `bf_admin_commercial_stage_states_v1`, `bf_admin_commercial_stage_audit_v1`, `data-admin-commercial-stage-select` e reflexo no status do handoff.
- Cadencia comercial do Dashboard Admin deve preservar `data-admin-commercial-stage-insights`, resumo das 5 etapas, movimentacoes recentes e retomadas sugeridas.
- Todo export global `window.BF*`, `ProposalSummary`, `Settings` ou `BankFraternProgress` novo deve ser documentado.
- Deep links novos devem declarar origem, parametros preservados e destino.
- O Definition of Done da matriz deve continuar presente antes de iniciar fase funcional nova.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check tools\validate-public-contracts.mjs
& $node tools\validate-public-contracts.mjs
& $node tools\validate-design-system.mjs
```

## Roteiro navegavel ponta a ponta

Objetivo: garantir que a lousa seja a porta de QA da jornada antes de novas fases funcionais.

Artefatos obrigatorios:

- `pages/lousa-navegacao.html`
- `tools/validate-navigable-journey.mjs`
- `docs/test-reports/navigable-journey-report.json`

Validacoes obrigatorias:

- `pages/lousa-navegacao.html` deve conter `data-lousa-journey-checklist`, `data-lousa-journey-acceptance` e `#roteiro-navegavel`.
- O roteiro deve cobrir Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards.
- A lousa deve conter `data-lousa-commercial-qa` com checkpoints de cockpit cliente, handoff/cadencia, funil admin, exportacao sanitizada e QA online.
- Os links devem abrir paginas existentes e usar deep links com `from=lousa` quando fizer sentido.
- O Dashboard Admin deve manter atalho para `lousa-navegacao.html#roteiro-navegavel`.
- Contratos publicos e design system devem exigir o validador.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check tools\validate-navigable-journey.mjs
& $node tools\validate-navigable-journey.mjs
& $node tools\validate-public-contracts.mjs
& $node tools\validate-design-system.mjs
```

## Proposta comercial e PDF espelhado

Objetivo: garantir que a etapa 9 do simulador exiba o mesmo conteudo exportado no PDF, com informacoes e graficos separados em blocos coerentes.

Validacoes obrigatorias:

- Abrir `http://127.0.0.1:8080/pages/simulador.html`.
- Carregar um exemplo ou restaurar uma simulacao salva.
- Avancar para a etapa 9 e confirmar a existencia de `#proposal-export-root`.
- Confirmar que a lousa contem `data-proposal-builder-readiness`, presets consultivo/tecnico e acoes de selecionar/limpar por grupo.
- Confirmar que `BFProposalBuilder` centraliza storage, presets, prontidao, dependencias e estimativa de paginas da lousa.
- Confirmar que `BFProposalGovernance` centraliza paineis de versionamento, aceite, historicos e ponte de handoff da proposta.
- Confirmar que itens desmarcados na lousa nao aparecem como placeholder no PDF final.
- Confirmar que a etapa 9 contem `.ps-section--conversation` e quatro `.ps-conversation-card`.
- Confirmar que `data-proposal-selection-summary` registra a quantidade de blocos, graficos, conceitos e formulas selecionados.
- Confirmar que `#proposal-export-root` e `#proposal-summary-print-root` usam IDs de graficos diferentes para evitar duplicidade de canvas.
- Clicar em `Exportar PDF` e verificar que o arquivo gerado preserva cabecalho, resumo, blocos conversacionais, graficos, cronograma e disclaimer.
- Confirmar que nao existe overflow horizontal em desktop e mobile.

Comandos de sintaxe:

```powershell
$node='<node-runtime>'
& $node --check js\proposal-summary.js
& $node --check js\proposal-governance.js
& $node --check js\export.js
& $node --check js\app.js
& $node tools\validate-proposal-builder.mjs
& $node tools\validate-proposal-governance.mjs
```

## Aceite local da proposta

Objetivo: validar que a proposta pode ser revisada, versionada e exportada com status de governanca local.

Validacoes obrigatorias:

- Abrir `http://127.0.0.1:8080/pages/simulador.html`.
- Carregar exemplo, calcular e ir para a etapa 9.
- Confirmar `data-proposal-acceptance-panel` antes do preview da proposta.
- Marcar premissas, contexto do cliente e documentacao/handoff.
- Clicar em `Registrar revisao`.
- Confirmar status `Revisada localmente`, versao local e historico.
- Confirmar que `#proposal-export-root .ps-section--acceptance` aparece no preview e no PDF.
- Confirmar que o PDF continua sendo exportado sem overflow horizontal em desktop e mobile.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check js\proposal-acceptance.js
& $node --check js\proposal-summary.js
& $node --check js\app.js
& $node tools\validate-proposal-acceptance.mjs
```

## Versionamento local da proposta

Objetivo: validar que a proposta salva snapshots comparaveis antes de PDF, impressao e handoff.

Validacoes obrigatorias:

- Abrir `http://127.0.0.1:8080/pages/simulador.html`.
- Carregar exemplo, calcular e ir para a etapa 9.
- Confirmar `data-proposal-version-panel` antes do preview da proposta.
- Clicar em `Salvar versao atual` e confirmar historico em `data-proposal-version-history`.
- Alterar a lousa ou registrar nova revisao e confirmar `data-proposal-version-comparison`.
- Criar handoff e confirmar que a versao congelada foi preservada no lead local.
- Abrir `handoff-consultivo.html#fila-handoff` e confirmar `data-handoff-proposal-version` com snapshot, validade e proximo passo.
- Confirmar `data-handoff-action-plan` no cockpit/detalhe com dono, prazo e CTA operacional.
- Confirmar `data-handoff-action-execution`, marcar iniciar/concluir/adiar e validar motivo em `bf_operational_action_states_v1`.
- Confirmar `data-handoff-commercial-stage`, `data-handoff-commercial-stage-panel` e `data-handoff-commercial-stage-history` quando o lead tiver etapa movida no funil admin.
- Abrir `dashboard-admin.html#admin-gargalos` e confirmar gargalos de proposta vencida ou alterada apos handoff quando existirem dados locais.
- Abrir `dashboard-admin.html#admin-fila-acao` e confirmar `data-admin-action-queue` com dono, prazo, alvo e CTA direto.
- Confirmar `data-admin-action-execution` e `data-admin-action-owner-history` com status, motivo e historico por responsavel.
- Confirmar `data-admin-consultant-productivity` com ações abertas, adiadas, concluídas, tempo médio e gargalos recorrentes por responsável.
- Confirmar `data-admin-consultant-portfolio` com carteira por consultor, leads, aging médio, origem, prioridade, SLA e próximo foco por lead.
- Confirmar `data-admin-consultant-portfolio-filters`, `data-admin-consultant-portfolio-priority` e `data-admin-consultant-portfolio-export` com filtros por consultor/origem/prioridade/SLA, plano comercial do dia e JSON sanitizado.
- Confirmar `data-admin-commercial-pipeline`, `data-admin-commercial-stage` e `data-admin-commercial-lead` com etapas Contato, Proposta, Follow-up, Negociação e Fechamento.
- Confirmar `data-admin-commercial-pipeline-export`, `bank-fratern.admin-commercial-pipeline.v1` e `window.__lastAdminCommercialPipelineExport` com totais por etapa, leads anonimizados, movimentacoes recentes e sem e-mail, telefone ou CPF.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check js\proposal-versioning.js
& $node --check js\proposal-governance.js
& $node --check js\app.js
& $node --check tools\validate-proposal-governance.mjs
& $node --check tools\validate-proposal-versioning.mjs
& $node tools\validate-proposal-governance.mjs
& $node tools\validate-proposal-versioning.mjs
```

## Handoff consultivo da proposta

Objetivo: validar que uma proposta revisada vira lead local de atendimento consultivo sem duplicidade e sem envio externo.

Validacoes obrigatorias:

- Abrir `http://127.0.0.1:8080/pages/simulador.html`.
- Carregar exemplo, calcular e ir para a etapa 9.
- Registrar revisao completa marcando premissas, contexto do cliente e documentacao/handoff.
- Confirmar que `data-proposal-handoff-bridge` libera a acao `Criar handoff`.
- Criar o handoff e confirmar `data-proposal-handoff-ready="true"`.
- Abrir `handoff-consultivo.html#fila-handoff` e confirmar que o lead aparece com resumo, checklist e auditoria local.
- Repetir a criacao e confirmar que o lead e atualizado, nao duplicado.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\handoff-consultivo.service.js
& $node --check js\app.js
& $node --check tools\validate-proposal-handoff.mjs
& $node tools\validate-proposal-handoff.mjs
& $node tools\run-v8af-browser-evidence.mjs
```

## Governanca funcional v8W - Filtros e exportacao da recuperacao sem prints

Objetivo: permitir operacao da fila de recuperacao por responsavel, status, prioridade, etapa e pacote local exportavel.

Validacoes obrigatorias:

- `BFAdminRecoveryService.list()` deve aceitar filtros de `assigneeEmail`, `queueStatus`, `severity`, `stage` e `search`.
- `BFAdminRecoveryService.exportPackage()` deve retornar schema, filtros, resumo e itens filtrados.
- Dashboard Admin deve renderizar controles `data-admin-recovery-filters` e botao `data-admin-recovery-export`.
- Filtro `retomada-pendente` deve excluir handoffs ja criados.
- Filtro `handoff-criado` deve localizar sinais que ja viraram lead.
- O pacote exportado nao deve conter senha, hash, telefone ou CPF.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-filters-export.mjs
& $node tools\validate-admin-recovery-filters-export.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8w-admin-recovery-filters-export-report.json`

## Governanca funcional v8X - Pacotes administrativos de recuperacao sem prints

Objetivo: controlar o ciclo exportar -> importar -> auditar pacotes locais de retomada entre navegadores ou unidades.

Validacoes obrigatorias:

- `BFAdminRecoveryService.exportPackage()` deve registrar auditoria local de exportacao.
- `BFAdminRecoveryService.validatePackage()` deve aceitar apenas o schema `bank-fratern.admin-recovery-export.v1`.
- `BFAdminRecoveryService.importPackage()` deve importar pacote valido, recusar schema invalido e detectar duplicidade.
- `BFAdminRecoveryService.importedPackages()` deve limitar e listar pacotes recebidos sem credenciais, telefone ou CPF.
- `BFAdminRecoveryService.audit()` deve listar export, import, import-duplicate e import-rejected.
- Dashboard Admin deve conter `data-admin-recovery-packages` com formulario de importacao e historico de auditoria.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-package-governance.mjs
& $node tools\validate-admin-recovery-package-governance.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8x-admin-recovery-package-governance-report.json`

## Governanca funcional v8Y - Operacao de itens importados sem prints

Objetivo: transformar pacotes recebidos em fila acionavel, com responsavel por item e criacao direta de handoff consultivo.

Validacoes obrigatorias:

- `BFAdminRecoveryService.importedItems()` deve listar itens recebidos com status `recebido`, `atribuido` ou `handoff-criado`.
- `BFAdminRecoveryService.assignImportedItem()` deve persistir o responsavel e registrar auditoria.
- `BFAdminRecoveryService.createHandoffFromImportedItem()` deve criar ou atualizar handoff preservando `sourceSignalId`, cliente e responsavel.
- Reprocessar o mesmo item importado nao deve duplicar handoff.
- Dashboard Admin deve conter `data-admin-recovery-imported-items`, `data-admin-package-assign` e `data-admin-package-handoff`.
- Pacotes operacionais nao podem conter senha, telefone ou CPF.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-package-operations.mjs
& $node tools\validate-admin-recovery-package-operations.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8y-admin-recovery-package-operations-report.json`

## Governanca funcional v8Z - SLA e filtros de itens importados sem prints

Objetivo: priorizar a operacao de itens recebidos por pacote, separando atrasos, responsaveis, status e handoffs concluidos.

Validacoes obrigatorias:

- `BFAdminRecoveryService.importedItems()` deve aceitar filtros de `status`, `assignedTo`, `severity`, `sla`, `packageId` e `search`.
- `BFAdminRecoveryService.importedItemsSummary()` deve retornar totais de recebidos, atribuidos, handoffs, pendentes e vencidos.
- SLA deve considerar alta em 4h, media em 24h e baixa em 72h.
- Itens com `handoff-criado` devem sair dos atrasos pendentes e aparecer como `concluido`.
- Dashboard Admin deve conter `data-admin-package-filters` e `data-admin-package-filter="sla"`.
- Pacotes operacionais com SLA nao podem conter senha, telefone ou CPF.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-package-sla-filters.mjs
& $node tools\validate-admin-recovery-package-sla-filters.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8z-admin-recovery-package-sla-filters-report.json`

## Governanca funcional v8AA - Roteamento e metas de itens importados sem prints

Objetivo: transformar itens recebidos em carteiras de consultores, com metas locais de handoff e progresso de conversao.

Validacoes obrigatorias:

- `BFAdminRecoveryService.routeImportedItems()` deve atribuir itens pendentes para consultores ativos.
- `BFAdminRecoveryService.saveConversionGoal()` deve persistir meta de handoffs por responsavel.
- `BFAdminRecoveryService.conversionScoreboard()` deve consolidar roteados, pendentes, vencidos, handoffs, meta e progresso.
- Roteamento rebalanceado deve distribuir itens em ao menos dois consultores quando houver base suficiente.
- Handoff criado a partir de item roteado deve atualizar progresso sem duplicar lead.
- Dashboard Admin deve conter `data-admin-package-routing`, `data-admin-package-route`, `data-admin-package-goal-input` e `data-admin-package-save-goal`.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-routing-goals.mjs
& $node tools\validate-admin-recovery-routing-goals.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8aa-admin-recovery-routing-goals-report.json`

## Governanca funcional v8AC - Home com hero contextual sem prints

Objetivo: fazer a primeira dobra da Home responder ao mesmo contexto financeiro usado pelo cockpit, mudando mensagem e CTAs conforme diagnostico, calculadora mais recente ou simulacao salva.

Validacoes obrigatorias:

- `pages/index.html` deve conter `data-home-hero-contextual`, `data-home-hero-primary`, `data-home-hero-context-strip` e `data-home-hero-panel-score`.
- `js/home.js` deve expor `BFHome.renderContextualHero()` e `BFHome.buildHeroContext()`.
- Sem perfil local, o hero deve recomendar diagnostico inicial e apontar para `calculadora-custos-fixos.html`.
- Com perfil pronto e historico de calculadora, o hero deve apontar para `simulador.html?from=calculator&calculatorSlug=<slug>&historyId=<id>`.
- Com simulacao salva, o hero deve apontar para `carteira.html` e revisao da simulacao.
- Hero nao pode renderizar CPF, telefone, WhatsApp ou e-mail.
- `tools/validate-home-contextual-hero.mjs` deve retornar `ok: true`.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check js\home.js
& $node --check tools\validate-home-contextual-hero.mjs
& $node tools\validate-home-contextual-hero.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8ac-home-contextual-hero-report.json`

## Governanca funcional v8AB - Home como cockpit de continuidade sem prints

Objetivo: transformar a pagina inicial em ponto de retomada da jornada, usando perfil financeiro, historico de calculadoras e simulacoes locais.

Validacoes obrigatorias:

- `pages/index.html` deve conter `data-home-continuity-cockpit`, `data-home-continuity-metrics` e `data-home-next-actions`.
- Home deve carregar `assets/js/services/decision-context.service.js`.
- `js/home.js` deve expor `BFHome.renderContinuityCockpit()` e `BFHome.buildContinuityModel()`.
- Cockpit deve ler prontidao, historico de calculadoras e simulacoes locais.
- Cockpit nao pode renderizar CPF, telefone, WhatsApp ou e-mail.
- `tools/validate-home-continuity-cockpit.mjs` deve retornar `ok: true`.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check js\home.js
& $node --check tools\validate-home-continuity-cockpit.mjs
& $node tools\validate-home-continuity-cockpit.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8ab-home-continuity-cockpit-report.json`

## Governanca funcional v8V - Fila administrativa de recuperacao sem prints

Objetivo: consolidar sinais de retomada no Dashboard Admin como fila priorizada por consultor sugerido.

Validacoes obrigatorias:

- `assets/js/services/admin-recovery.service.js` deve existir e expor `BFAdminRecoveryService`.
- `pages/dashboard-admin.html` deve conter `data-admin-recovery-queue`.
- `tools/validate-admin-recovery-queue.mjs` deve retornar `ok: true`.
- A fila deve incluir sinais de selecao, comparador, decisao e simulador pronto.
- O pool de responsaveis deve considerar consultores ativos e ignorar consultores inativos.
- Cada item da fila deve ter etapa, severidade, aging, cliente e responsavel sugerido.
- Criar handoff a partir da fila deve preservar `sourceSignalId`, prioridade, owner e `assignedTo`.
- A fila aberta deve reduzir quando o handoff e criado, sem perder o item na visao completa.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\admin-recovery.service.js
& $node --check assets\js\admin-users.js
& $node --check tools\validate-admin-recovery-queue.mjs
& $node tools\validate-admin-recovery-queue.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8v-admin-recovery-queue-report.json`

## Governanca funcional v8U - Retomadas e handoff sem prints

Objetivo: transformar microconversoes de Produtos, Comparador e Simuladores em sinais acionaveis no Dashboard Cliente e no Handoff Consultivo.

Validacoes obrigatorias:

- `assets/js/services/journey-recovery.service.js` deve existir e expor `BFJourneyRecoveryService`.
- `tools/validate-recovery-signals-flow.mjs` deve retornar `ok: true`.
- O servico deve identificar `selection-no-comparator`, `comparator-no-matrix`, `decision-no-continuity`, `saved-no-simulator` e `simulator-ready`.
- `BFJourneyRecoveryService.summary()` deve consolidar total, abertos, alta prioridade, owners e sinais prontos para handoff.
- `BFHandoffConsultivoService.createFromSignal()` deve criar lead local com `sourceSignalId`, prioridade, owner, CTA e checklist.
- Reprocessar o mesmo sinal deve atualizar o handoff existente, sem duplicar lead.
- `pages/dashboard-cliente.html` deve conter `data-client-recovery-signals`.
- `pages/handoff-consultivo.html` deve conter `data-handoff-recovery-signals`.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\journey-recovery.service.js
& $node --check assets\js\client-dashboard.js
& $node --check assets\js\services\handoff-consultivo.service.js
& $node --check assets\js\handoff-consultivo.js
& $node --check tools\validate-recovery-signals-flow.mjs
& $node tools\validate-recovery-signals-flow.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8u-recovery-signals-flow-report.json`

## Governanca funcional v8T - Produtos, Comparador e Simuladores leves sem prints

Objetivo: validar a continuidade Produtos -> Comparador -> Simuladores leves por contrato funcional, sem abrir navegador visual.

Validacoes obrigatorias:

- `tools/validate-product-journey-flow.mjs` deve retornar `ok: true`.
- `assets/data/produtos.json` deve manter rotas de comparador, simulador e preset para todos os produtos.
- `BFRecomendacaoService.recommend` deve retornar Top 3 acionavel para a jornada de produtos.
- `BFModelosRecomendacaoService.best` deve recomendar um modelo padrao coerente com o perfil.
- `BFComparadorService.compareDefault` deve calcular matriz completa com financiamento, consorcio, CDC, garantia, consignado e consumo.
- A matriz deve gerar decisao, riscos e CTA para simulador.
- Os simuladores leves devem calcular financiamento, consorcio, CDC, garantia, consignado e veiculos.
- `BFJourneyAnalytics.summary()` deve registrar selecao de produtos, abertura do comparador, matriz calculada, cenario salvo, 6 simuladores calculados e conversao positiva.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check tools\validate-product-journey-flow.mjs
& $node tools\validate-product-journey-flow.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8t-product-journey-flow-report.json`

## Governanca funcional v8S - sem prints

Objetivo: evoluir rapido sem navegador visual, validando o contrato da jornada por Node + `localStorage` simulado.

Validacoes obrigatorias:

- `tools/validate-decision-flow.mjs` deve retornar `ok: true`.
- O teste deve provar perfil vazio recomendando `custos-fixos`.
- `capacidade-credito` deve gravar `historyId` e `capacidadePagamento`.
- `lance-consorcio` deve gravar `historyId` e `lanceProprioSugerido`.
- Deep link `from=calculator` deve gerar prefill com `calculatorSlug`, `historyId`, capacidade e snapshot sanitizado.
- `Storage.saveSimulation` deve preservar `decisionContext`.
- `BFDecisionContext.recordSimulation` deve criar evento `simulador-consorcio` no historico financeiro.
- Perfil compartilhado nao pode conter CPF, telefone, e-mail, nome do cliente ou consultor.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check tools\validate-decision-flow.mjs
& $node tools\validate-decision-flow.mjs
```

Evidencia de contrato:

- `docs/test-reports/v8s-decision-flow-report.json`

## Calculadoras + jornada de simulacao v8R

Validacoes obrigatorias:

- `assets/data/calculadoras.json` deve conter 19 calculadoras.
- `assets/js/services/decision-context.service.js` deve expor `BFDecisionContext`.
- `pages/calculadoras.html` deve recomendar a trilha minima: `custos-fixos -> reserva-emergencia -> compra-vista-parcelado -> comparador`.
- Toda pagina individual deve abrir uma previa com `data-calculator-result-mode="preview"` sem gravar `bf_financial_profile_v1`, `bf_calculator_history_v1` ou `bf_decision_context_audit_v1`.
- Campos invalidos devem expor `data-calculator-field-error`, alerta `data-calculator-form-alert` e bloquear o submit persistente.
- Campos validos alterados pelo usuario devem atualizar a previa sem persistencia.
- Alertas de coerencia devem expor `data-calculator-coherence-alert`, atualizar `data-calculator-coherence` e nao bloquear salvamento.
- A ponte da calculadora deve expor `data-calculator-next-action` e `data-calculator-next-action-card` com CTA principal aderente ao risco.
- O botao `Calcular e salvar cenario` deve trocar o modo para `saved`, gravar historico local e atualizar o perfil financeiro.
- `pages/calculadora-capacidade-credito.html` deve gravar parcela segura, folga mensal, comprometimento projetado e perfil.
- `pages/calculadora-lance-consorcio.html` deve gravar lance seguro, impacto na reserva e lance sugerido.
- `pages/simulador.html?from=calculator&calculatorSlug=capacidade-credito&historyId=<id>` deve exibir prontidao e preservar origem no decision strip.
- `pages/simulador.html?from=journey&journeyId=<id>` deve aplicar contexto sem sobrescrever campos preenchidos manualmente.
- Ao salvar simulacao, `bf_calculator_history_v1` deve receber `calculatorSlug='simulador-consorcio'`.
- `pages/dashboard-cliente.html` deve exibir a continuidade `diagnostico -> calculadora -> simulacao -> carteira/handoff`.

Comandos:

```powershell
$node='<node-runtime>'
& $node --check assets\js\services\decision-context.service.js
& $node --check assets\js\services\calculadoras.service.js
& $node --check assets\js\calculadoras-page.js
& $node --check js\app.js
& $node --check js\storage.js
& $node --check assets\js\client-dashboard.js
& $node tools\validate-calculadoras.mjs
& $node tools\validate-calculator-journey.mjs
& $node tools\validate-design-system.mjs
```

Evidencias esperadas:

- `docs/test-prints/v8r-calculadoras-hub-desktop.png`
- `docs/test-prints/v8r-calculadoras-hub-mobile.png`
- `docs/test-prints/v8r-capacidade-credito-desktop.png`
- `docs/test-prints/v8r-lance-consorcio-desktop.png`
- `docs/test-prints/v8r-simulador-prontidao-desktop.png`
- `docs/test-prints/v8r-dashboard-cliente-continuidade-desktop.png`
- `docs/test-prints/v8r-calculadoras-jornada-report.json`
- `docs/test-reports/calculator-journey-report.json`
- Checkpoint ZIP em `versions/`

Prints minimos do ciclo v8:

- `docs/test-prints/v8-home-desktop.png`
- `docs/test-prints/v8-home-mobile.png`
- `docs/test-prints/v8-produtos-desktop.png`
- `docs/test-prints/v8-calculadoras-desktop.png`
- `docs/test-prints/v8-calculadora-detail-desktop.png`
- `docs/test-prints/v8-comparador-desktop.png`
- `docs/test-prints/v8-trilha-desktop.png`
- `docs/test-prints/v8-dashboard-cliente-desktop.png`
- `docs/test-prints/v8-handoff-desktop.png`
- `docs/test-prints/v8-dashboard-admin-desktop.png`
- `docs/test-prints/v8-simulador-desktop.png`
- `docs/test-prints/v8-carteira-desktop.png`

Prints minimos do ciclo v8B:

- `docs/test-prints/v8b-simulador-stagebar-desktop.png`
- `docs/test-prints/v8b-simulador-stagebar-mobile.png`
- `docs/test-prints/v8b-simulador-stagebar-ready-desktop.png`
- `docs/test-prints/v8b-carteira-stagebar-desktop.png`
- `docs/test-prints/v8b-carteira-stagebar-mobile.png`
- `docs/test-prints/v8b-assembleias-stagebar-desktop.png`
- `docs/test-prints/v8b-assembleias-stagebar-mobile.png`
- `docs/test-prints/v8b-stagebar-report.json`

## Comparador v8I - ponte visual de decisao

Validacoes obrigatorias:

- Abrir `pages/comparador.html?preset=obter_liquidez#decisao-comparador`.
- Confirmar `data-v8-stagebar` com 5 itens: Perfil, Entrada, Decisao, Memoria e Continuidade.
- Confirmar `data-comparator-decision-strip` com 4 cards: Entrada, Decisao, Risco e Continuidade.
- Confirmar `data-comparator-bridge-timeline` com 5 itens de continuidade.
- Confirmar `document.body.dataset.comparatorBridgeReady='true'`.
- Confirmar que a matriz renderiza cards `data-comparison-card` e tabela lado a lado.
- Clicar `Salvar cenario` e confirmar status de sucesso e historico local com `calculatorSlug='comparador'`.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8i-comparador-ponte-desktop.png`
- `docs/test-prints/v8i-comparador-ponte-mobile.png`
- `docs/test-prints/v8i-comparador-ponte-report.json`

## Portas e simuladores v8J - etapas completas

Validacoes obrigatorias:

- `pages/produtos.html` deve conter `data-products-decision-strip`, `data-products-bridge-timeline` e 5 itens na stagebar.
- `pages/calculadoras.html` deve conter `data-calculators-decision-strip`, `data-calculators-bridge-timeline` e 5 itens na stagebar.
- Cada `pages/calculadora-*.html` deve conter `data-calculator-decision-strip`, `data-calculator-bridge-timeline` e 5 itens na stagebar.
- `pages/simulador-financiamento.html`, `pages/simulador-veiculos.html`, `pages/simulador-cdc.html`, `pages/simulador-garantia.html`, `pages/simulador-consignado.html` e `pages/simulador-consorcio.html` devem conter `data-light-simulator-decision-strip`, `data-light-simulator-timeline` e 5 itens na stagebar.
- Simuladores leves com calculo devem renderizar `document.body.dataset.lightSimulatorReady`.
- Calculadora individual deve renderizar `document.body.dataset.calculatorBridgeReady`.
- Produtos deve renderizar `document.body.dataset.productsBridgeReady='true'`.
- Hub de calculadoras deve renderizar `document.body.dataset.calculatorsBridgeReady='true'`.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8j-produtos-desktop.png`
- `docs/test-prints/v8j-produtos-mobile.png`
- `docs/test-prints/v8j-calculadoras-desktop.png`
- `docs/test-prints/v8j-calculadoras-mobile.png`
- `docs/test-prints/v8j-calculadora-detail-desktop.png`
- `docs/test-prints/v8j-calculadora-detail-mobile.png`
- `docs/test-prints/v8j-simulador-veiculos-desktop.png`
- `docs/test-prints/v8j-simulador-veiculos-mobile.png`
- `docs/test-prints/v8j-simulador-consorcio-desktop.png`
- `docs/test-prints/v8j-simulador-consorcio-mobile.png`
- `docs/test-prints/v8j-portas-simuladores-report.json`

## Confianca e componentes v8K

Validacoes obrigatorias:

- `pages/educacao.html`, `pages/compliance.html`, `pages/dados-abertos.html` e `pages/api-docs.html` devem conter `data-trust-decision-strip`, `data-trust-timeline` e 5 itens na stagebar.
- `pages/componentes-v8.html` deve conter `data-component-decision-strip`, `data-component-timeline`, `bf-component-swatch-grid`, 5 itens na stagebar, 4 cards de decisao, 5 itens na timeline e 4 amostras de componentes.
- Header e footer devem expor o link "Design" para `pages/componentes-v8.html`.
- Desktop e mobile nao podem ter overflow horizontal.
- O teste headless nao deve registrar erros de console ou page errors nas rotas alteradas.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8k-educacao-confianca-desktop.png`
- `docs/test-prints/v8k-compliance-confianca-desktop.png`
- `docs/test-prints/v8k-dados-confianca-desktop.png`
- `docs/test-prints/v8k-api-confianca-desktop.png`
- `docs/test-prints/v8k-componentes-desktop.png`
- `docs/test-prints/v8k-educacao-confianca-mobile.png`
- `docs/test-prints/v8k-componentes-mobile.png`
- `docs/test-prints/v8k-confianca-componentes-report.json`

## Institucional e configuracoes v8L

Validacoes obrigatorias:

- `pages/index.html` deve conter `data-home-decision-strip`, `data-home-institutional-timeline` e 5 itens na stagebar.
- `pages/sobre-nos.html` e `pages/duvidas.html` devem conter `data-trust-decision-strip`, `data-trust-timeline` e 5 itens na stagebar.
- `pages/configuracoes.html` deve conter `data-settings-decision-strip`, `data-settings-timeline`, 5 itens na stagebar e chips em `#cfg-applied-chips`.
- Configuracoes deve permitir clicar em `#btn-save` sem erro de console.
- Desktop e mobile nao podem ter overflow horizontal.
- As paginas revisadas nao devem exibir sequencias de encoding quebrado como `Ã`, `Â`, `ðŸ`, `â€` ou `ï¼`.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8l-home-institucional-desktop.png`
- `docs/test-prints/v8l-home-institucional-mobile.png`
- `docs/test-prints/v8l-sobre-confianca-desktop.png`
- `docs/test-prints/v8l-sobre-confianca-mobile.png`
- `docs/test-prints/v8l-duvidas-confianca-desktop.png`
- `docs/test-prints/v8l-duvidas-confianca-mobile.png`
- `docs/test-prints/v8l-configuracoes-governanca-desktop.png`
- `docs/test-prints/v8l-configuracoes-governanca-mobile.png`
- `docs/test-prints/v8l-institucional-configuracoes-report.json`

## Saneamento CSS v8M

Validacoes obrigatorias:

- `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css` devem retornar `nonAscii=0`.
- `tools/validate-design-system.mjs` deve reprovar paginas ativas com sinais de mojibake visual.
- `pages/produtos.html`, `pages/index.html`, `pages/sobre-nos.html`, `pages/duvidas.html`, `pages/configuracoes.html`, `pages/assembleias.html` e `pages/simulador.html` devem responder HTTP 200.
- Produtos desktop/mobile devem manter stagebar com 5 itens, 4 cards de decisao e timeline com 5 itens.
- Home desktop/mobile deve continuar sem overflow horizontal.
- Assembleias deve ter favicon SVG, 5 itens na stagebar e nenhum erro de console.
- Simulador deve continuar sem encoding quebrado visivel e sem erro de console.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.
- `tools/validate-calculadoras.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8m-produtos-saneamento-desktop.png`
- `docs/test-prints/v8m-produtos-saneamento-mobile.png`
- `docs/test-prints/v8m-home-css-saneamento-desktop.png`
- `docs/test-prints/v8m-home-css-saneamento-mobile.png`
- `docs/test-prints/v8m-sobre-shared-saneamento-desktop.png`
- `docs/test-prints/v8m-duvidas-shared-saneamento-mobile.png`
- `docs/test-prints/v8m-configuracoes-saneamento-mobile.png`
- `docs/test-prints/v8m-assembleias-encoding-desktop.png`
- `docs/test-prints/v8m-simulador-encoding-desktop.png`
- `docs/test-prints/v8m-css-saneamento-report.json`

## Assembleias v8C - decisao operacional

Validacoes obrigatorias:

- `pages/assembleias.html` deve conter `data-assembly-decision-strip`.
- O bloco deve renderizar 4 cards: decisao agora, fila comercial, faturamento e liquidez do grupo.
- O hero deve ter CTA para `#decisao-operacional`.
- O drawer lateral deve abrir ao clicar em uma linha da tabela de assembleias.
- A pagina nao deve exibir sequencias de encoding quebrado como `Ã³`, `Ã£`, `Â·` ou `â€”`.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8c-assembleias-decisao-desktop.png`
- `docs/test-prints/v8c-assembleias-decisao-mobile.png`
- `docs/test-prints/v8c-assembleias-drawer-desktop.png`
- `docs/test-prints/v8c-assembleias-report.json`

## Carteira v8D - decisao operacional

Validacoes obrigatorias:

- `pages/carteira.html` deve conter `data-portfolio-decision-strip`.
- O bloco deve renderizar 4 cards: prioridade, pipeline, agenda e oportunidade.
- A stagebar deve conter 5 itens, incluindo a etapa `Decisao`.
- O hero deve ter CTA para `#decisao-carteira`.
- A pagina nao deve exibir sequencias de encoding quebrado nem icones decorativos corrompidos.
- Desktop e mobile nao podem ter overflow horizontal, considerando `documentElement.scrollWidth` e `body.scrollWidth`.
- A tabela operacional deve virar leitura compacta no mobile, sem largura fantasma.
- `tools/validate-design-system.mjs` deve retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8d-carteira-decisao-desktop.png`
- `docs/test-prints/v8d-carteira-decisao-mobile.png`
- `docs/test-prints/v8d-carteira-report.json`

## Simulador v8E - decisao operacional

Validacoes obrigatorias:

- `pages/simulador.html` deve conter `data-simulator-decision-strip`.
- O bloco deve renderizar 4 cards: Base, Prateleira, Resultado e Continuidade.
- A stagebar deve conter 5 itens: Base, Escolha, Decisao, Resultado e Continuidade.
- A base real deve carregar `data_base/Tab_Grupos_Consorcio.json` e expor a quantidade no card de Base.
- O overlay de carregamento deve finalizar antes da captura da decisao estabilizada; para testar o loading em si, manter `?showLoading=1`.
- Desktop e mobile nao podem ter overflow horizontal, considerando `documentElement.scrollWidth` e `body.scrollWidth`.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Rota preferencial:

- `http://127.0.0.1:8080/pages/simulador.html#decisao-simulador`

Evidencias esperadas:

- `docs/test-prints/v8e-simulador-decisao-desktop-visible.png`
- `docs/test-prints/v8e-simulador-decisao-mobile-visible.png`
- `docs/test-prints/v8e-simulador-decisao-report.json`

## Dashboard Cliente v8F - central de continuidade

Validacoes obrigatorias:

- `pages/dashboard-cliente.html` deve conter `data-client-continuity-strip`.
- A pagina deve conter `data-v8-stagebar` com 5 itens: Continuidade, Perfil, Historico, Decisao e Handoff.
- O bloco de continuidade deve renderizar 4 cards: Perfil, Historico, Trilha e Handoff.
- A timeline `data-client-continuity-timeline` deve renderizar 5 etapas: Perfil, Historico, Modelo, Trilha e Handoff.
- O bloco `data-client-activity` deve listar eventos recentes quando houver simulacoes, calculadoras, modelos, trilha ou handoff no `localStorage`.
- A pagina deve permanecer protegida por auth local, aceitando os papeis admin, consultor e cliente.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Rota preferencial:

- `http://127.0.0.1:8080/pages/dashboard-cliente.html#continuidade-cliente`

Evidencias esperadas:

- `docs/test-prints/v8f-dashboard-cliente-continuidade-desktop.png`
- `docs/test-prints/v8f-dashboard-cliente-continuidade-mobile.png`
- `docs/test-prints/v8f-dashboard-cliente-report.json`

## Handoff/Admin v8G - area operacional

Validacoes obrigatorias:

- `pages/handoff-consultivo.html` deve conter `data-handoff-operational-strip`.
- `pages/handoff-consultivo.html` deve conter `data-v8-stagebar` com 5 itens: Operacao, Leads, Checklist, Auditoria e Admin.
- `pages/handoff-consultivo.html` deve conter `data-handoff-audit-feed`.
- O Handoff deve renderizar 4 cards operacionais, lista de leads, detalhe selecionado e eventos recentes de auditoria.
- `pages/dashboard-admin.html` deve conter `data-admin-operational-strip`.
- `pages/dashboard-admin.html` deve conter `data-v8-stagebar` com 5 itens: Operacao, Usuarios, Leads, Auditoria e Atendimento.
- O Admin deve renderizar 4 cards operacionais, resumo de usuarios, resumo de handoffs, auditoria de modelos e tabela de usuarios.
- As paginas devem permanecer protegidas por auth local: Handoff para admin/consultor; Admin apenas para admin.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Rotas preferenciais:

- `http://127.0.0.1:8080/pages/handoff-consultivo.html#operacao-handoff`
- `http://127.0.0.1:8080/pages/dashboard-admin.html#operacao-admin`

Evidencias esperadas:

- `docs/test-prints/v8g-handoff-operacional-desktop.png`
- `docs/test-prints/v8g-handoff-operacional-mobile.png`
- `docs/test-prints/v8g-admin-operacional-desktop.png`
- `docs/test-prints/v8g-admin-operacional-mobile.png`
- `docs/test-prints/v8g-operacao-handoff-admin-report.json`

## Trilha v8H - ponte central da decisao

Validacoes obrigatorias:

- `pages/trilha-decisao.html` deve conter `data-journey-bridge-strip`.
- `pages/trilha-decisao.html` deve conter `data-journey-bridge-timeline`.
- A pagina deve conter `data-v8-stagebar` com 5 itens: Diagnostico, Ponte, Continuidade, Acao e Handoff.
- O bloco de ponte deve renderizar 4 cards: Diagnostico, Produto/Modelo, Comparador e Handoff.
- A timeline deve renderizar 5 etapas: Diagnostico, Produto, Modelo, Comparador e Handoff.
- A jornada recomendada deve continuar renderizando 5 passos em `data-journey-step`.
- O handoff local deve aparecer quando existir registro conectado a `sourceJourneyId`.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Rota preferencial:

- `http://127.0.0.1:8080/pages/trilha-decisao.html#ponte-trilha`

Evidencias esperadas:

- `docs/test-prints/v8h-trilha-ponte-desktop.png`
- `docs/test-prints/v8h-trilha-ponte-mobile.png`
- `docs/test-prints/v8h-trilha-ponte-report.json`

## Home institucional

Validacoes obrigatorias:

- `pages/index.html` deve abrir com hero institucional focado no usuario final.
- A primeira dobra deve conter a mensagem de perfil financeiro unico e decisao antes de credito, consorcio ou investimento.
- O bloco institucional de empresa/produtos (`#plataforma`) deve aparecer antes do bloco de perfil financeiro (`#perfil-unico`).
- O bloco `#home-profile-form` deve calcular score, sobra mensal, comprometimento, reserva e recomendacao sem salvar dados.
- A jornada `#solucoes` deve permanecer controlada por `showJourney` em `Settings`.
- A prova de plataforma deve continuar carregando base real e historico local em secoes secundarias.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/home-institutional-desktop.png`
  - `docs/test-prints/home-institutional-mobile.png`
  - `docs/test-prints/home-order-profile-after-products.png`

## Fase 1 - validacoes obrigatorias

- `simulador.html` deve carregar `data_base/Tab_Grupos_Consorcio.json`.
- O painel `database-status-panel` deve mostrar fonte, caminho e quantidade de grupos.
- O overlay `loading-overlay` deve mostrar barra, percentual e etapas de carregamento.
- A prateleira deve atualizar `journey-progress-panel` ao buscar ou filtrar grupos.
- O fallback deve permanecer seguro quando a base real nao estiver disponivel.

## Estrutura apos reorganizacao

- HTML canonico: `pages/*.html`
- CSS legado/produto: `css/`
- JS legado/produto: `js/`
- Plataforma modular: `assets/css`, `assets/js`, `assets/data`
- Base real grande: `data_base/`
- A raiz preserva `index.html` apenas como ponte para `pages/index.html`.

## Rotas de regressao salvas

- `http://127.0.0.1:8080/pages/index.html`
- `http://127.0.0.1:8080/pages/configuracoes.html`
- `http://127.0.0.1:8080/pages/produtos.html`
- `http://127.0.0.1:8080/pages/simulador.html?showLoading=1`
- `http://127.0.0.1:8080/pages/simulador-garantia.html`
- `http://127.0.0.1:8080/pages/simulador-consignado.html`
- `http://127.0.0.1:8080/pages/simulador.html?simulationId=<id-da-simulacao>`
- `http://127.0.0.1:8080/pages/carteira.html#simulacoes-salvas`
- `http://127.0.0.1:8080/pages/carteira.html#decisao-carteira`
- `http://127.0.0.1:8080/pages/login.html`
- `http://127.0.0.1:8080/pages/dashboard-admin.html`
- `http://127.0.0.1:8080/pages/dashboard-cliente.html`
- `http://127.0.0.1:8080/pages/trilha-decisao.html`
- `http://127.0.0.1:8080/pages/handoff-consultivo.html`
- `http://127.0.0.1:8080/pages/calculadoras.html`
- `http://127.0.0.1:8080/pages/comparador.html`
- `http://127.0.0.1:8080/pages/calculadora-custos-fixos.html`
- `http://127.0.0.1:8080/pages/calculadora-reserva-emergencia.html`
- `http://127.0.0.1:8080/pages/calculadora-renda-fixa.html`
- `http://127.0.0.1:8080/pages/calculadora-juros-compostos.html`
- `http://127.0.0.1:8080/pages/calculadoras-governanca.html`

## Fase 4 - Configuracoes globais

Preferencias a validar:

- `showJourney=false` deve ocultar `#solucoes.hm-journey` na Home.
- `smoothScroll=false` deve adicionar `bf-settings-no-smooth` em `html/body`.
- `autoScore=false` deve mudar a ordenacao inicial da prateleira para `menor_taxa` e evitar recomputar score na busca.
- `defaultSegmento` deve preencher `#filtroProduto` no simulador e priorizar grupos em destaque na Home.
- `defaultAdmin` deve preencher `#filtroAdministradora` quando a administradora existir na base carregada.
- `pageSize` deve preencher `#shelfPageSize` e ser respeitado pela prateleira.
- `defaultPoliticaSaldo`, `defaultIndiceReajuste`, `defaultMesContemplacao` e `maxLanceEmbutido` devem preencher o comparador/parametros do simulador.

Evidencias esperadas:

- `docs/test-prints/phase4-settings-config-desktop.png`
- `docs/test-prints/phase4-settings-home-desktop.png`
- `docs/test-prints/phase4-settings-simulator-desktop.png`

## Ecossistema de calculadoras

Validacoes obrigatorias:

- Hub `pages/calculadoras.html` renderiza grupos e cards.
- Cada pagina `pages/calculadora-*.html` exibe formulario, resultado, memoria de calculo, recomendacao e historico.
- O submit de qualquer calculadora salva entrada em `localStorage['bf_calculator_history_v1']`.
- `Custos Fixos` atualiza `localStorage['bf_financial_profile_v1']` com renda, gasto mensal, capacidade de aporte e comprometimento.
- `Reserva de Emergencia`, `Renda Fixa`, `Compra a Vista ou Parcelado` e `Juros Compostos` devem autopreencher campos com dados do perfil quando aplicavel.
- Dashboard cliente deve exibir perfil consolidado e historico das calculadoras.
- Governanca admin deve carregar catalogo, premissas e golden tests.
- O comando `tools/validate-calculadoras.mjs` deve retornar `ok: true`.
- Prints atuais esperados:
  - `docs/test-prints/calculators-hub-desktop.png`
  - `docs/test-prints/calculator-detail-desktop.png`
  - `docs/test-prints/calculator-dashboard-desktop.png`
  - `docs/test-prints/calculators-governance-desktop.png`

Comando preferencial para QA automatizado das calculadoras:

```powershell
$node='<node-runtime>'
& $node tools\validate-calculadoras.mjs
```

## Comparador 2.0

Validacoes obrigatorias:

- `pages/comparador.html` deve renderizar hero, perfil usado, formulario, decisao recomendada, cards comparativos, riscos, memoria de calculo e matriz lado a lado.
- Alterar `urgencia` para `alta` deve priorizar disponibilidade/financiamento quando aplicavel.
- Alterar `prioridade` para `menor_parcela` ou `liquidez` deve mudar o criterio de recomendacao quando a parcela inicial for o principal fator.
- O botao `Salvar cenario` deve inserir entrada em `localStorage['bf_calculator_history_v1']` com `calculatorSlug='comparador'`.
- `dashboard-cliente.html` deve reabrir historicos do comparador apontando para `comparador.html`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/comparador-decisao-desktop.png`
  - `docs/test-prints/comparador-decisao-mobile.png`

## Decisao de compra responsavel

Validacoes obrigatorias:

- `pages/calculadora-compra-vista-parcelado.html` deve renderizar os campos de renda, custos, reserva atual e prioridade da decisao.
- O resultado deve exibir decisao sugerida, preco a vista, valor presente parcelado, reserva apos vista, parcela/renda e diferenca de valor presente.
- Alterar `Prioridade da decisao` para `preservar-caixa` deve favorecer parcelamento quando o pagamento a vista deixa a reserva abaixo de seis meses de custos.
- O submit deve salvar historico em `localStorage['bf_calculator_history_v1']` e atualizar `localStorage['bf_financial_profile_v1']` com `ultimaDecisaoCompra`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/compra-vista-parcelado-decisao-desktop.png`
  - `docs/test-prints/compra-vista-parcelado-decisao-mobile.png`

## Produtos 2.0

Validacoes obrigatorias:

- `pages/produtos.html` deve renderizar hero, painel de perfil/trilha sugerida, filtros, grid de produtos e motor de recomendacao.
- Filtro `Objetivo=Obter liquidez` deve reduzir o catalogo para CDC, Credito com garantia e Consignado.
- Filtro `Urgencia=Alta` deve exibir somente produtos compatíveis com alta urgencia dentro do objetivo selecionado.
- Cards devem exibir score, criterios, riscos e botoes `Simular`, `Comparar` e `Diagnosticar` quando houver rota cadastrada.
- O painel de trilha sugerida deve usar `localStorage['bf_financial_profile_v1']` quando existir.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/produtos-catalogo-decisao-desktop.png`
  - `docs/test-prints/produtos-catalogo-decisao-mobile.png`

## Comparador multi-produto

Validacoes obrigatorias:

- `pages/comparador.html` deve renderizar seletores para Financiamento, Consorcio, CDC, Credito com garantia, Consignado e Compra a vista/parcelada.
- Com todas as colunas ligadas, a matriz deve exibir pelo menos sete cards: financiamento, consorcio, CDC, garantia, consignado, pagar a vista e compra parcelada.
- `Urgencia=Alta` e `Prioridade=Disponibilidade rapida` deve priorizar uma alternativa de credito imediata, sem deixar consumo distorcer a decisao principal.
- Cards devem exibir nota de uso e link para simulador/calculadora.
- O botao `Salvar cenario` deve continuar gravando `calculatorSlug='comparador'` no historico local.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/comparador-multiproduto-desktop.png`
  - `docs/test-prints/comparador-multiproduto-mobile.png`

## Presets de comparacao

Validacoes obrigatorias:

- `pages/comparador.html` deve exibir `Preset de comparacao`.
- Preset `Obter liquidez` deve ligar CDC, Credito com garantia e Consignado; desligar financiamento, consorcio e consumo; definir urgencia alta e prioridade de rapidez.
- Preset `Trocar veiculo` deve ligar Financiamento, Consorcio e Compra a vista/parcelada; ajustar valor do bem para cenario de auto.
- Preset `Consumo pontual` deve ligar CDC e Compra a vista/parcelada.
- O resumo do preset deve listar produtos vindos de `assets/data/produtos.json`.
- A memoria de calculo deve registrar o preset aplicado.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/comparador-presets-desktop.png`
  - `docs/test-prints/comparador-presets-mobile.png`

## Favoritos e entrada direta do comparador

Validacoes obrigatorias:

- Abrir `pages/comparador.html?preset=obter_liquidez` deve aplicar automaticamente o preset Obter liquidez.
- Em `pages/produtos.html`, cards de produto devem gerar links `comparador.html?preset=<preset>`.
- O botao `Abrir comparador 2.0` deve refletir o objetivo selecionado no filtro de Produtos.
- `Salvar favorito` deve persistir o preset em `localStorage['bf_comparator_favorite_preset_v1:<usuario-ou-anon>']`.
- `Usar favorito` deve reaplicar o preset salvo e recalcular a matriz.
- O estado auxiliar do `body` deve usar `data-comparator-active-preset`, preservando o seletor do campo como `select[data-comparator-preset]`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/comparador-favorito-desktop.png`
  - `docs/test-prints/produtos-comparador-deeplink-desktop.png`
  - `docs/test-prints/comparador-favorito-mobile.png`

## Modelos nomeados de comparacao

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local` antes de salvar modelo quando a validacao precisar conferir escopo por usuario.
- Abrir `pages/comparador.html?preset=obter_liquidez`, preencher `Nome do modelo` e clicar `Salvar modelo`.
- Confirmar persistencia em `localStorage['bf_comparator_models_v1:cliente@bankfratern.local']`.
- O modelo salvo deve guardar `preset`, `fields`, `productIds`, `createdAt`, `updatedAt` e `userEmail`.
- Abrir `pages/comparador.html?modelo=<id>` deve restaurar preset, campos, colunas e recalcular a matriz.
- `dashboard-cliente.html` deve listar o modelo em `data-client-comparator-model` com link para `comparador.html?modelo=<id>`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/comparador-modelos-nomeados-desktop.png`
  - `docs/test-prints/comparador-modelo-aberto-desktop.png`
  - `docs/test-prints/dashboard-cliente-modelos-comparador-desktop.png`
  - `docs/test-prints/comparador-modelos-nomeados-mobile.png`

## Exportacao, importacao e auditoria de modelos

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local` antes de exportar/importar modelos.
- Em `pages/comparador.html?preset=obter_liquidez`, salvar um modelo nomeado e clicar `Exportar JSON`.
- O textarea `data-comparator-model-json` deve conter `schema='bank-fratern.comparator-models.v1'`.
- O pacote exportado deve conter `formulaVersion='comparador.service.v7.12'` e `premiseReference='calculadoras-premissas:2026-04-24'`.
- Clicar `Importar JSON` com o pacote deve restaurar modelo no escopo do usuario atual.
- A chave `localStorage['bf_comparator_model_audit_v1']` deve conter eventos `create`, `export` e `import`.
- `pages/dashboard-admin.html` deve exibir painel `data-admin-comparator-audit` com versao de formula, premissas e eventos recentes.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/comparador-modelos-export-import-desktop.png`
  - `docs/test-prints/dashboard-admin-auditoria-modelos-desktop.png`
  - `docs/test-prints/comparador-modelos-export-import-mobile.png`

## Governanca comercial de modelos

Validacoes obrigatorias:

- Abrir `pages/modelos-governanca.html` autenticado como admin.
- A pagina deve listar modelos de todas as chaves `bf_comparator_models_v1:<usuario-ou-anon>`.
- Os filtros de busca, usuario, preset, produto e status devem reduzir a tabela sem recarregar a pagina.
- Cada modelo deve exibir score de qualidade, status, usuario, produtos ativos, versao de formula e referencia de premissas.
- Admin deve conseguir marcar modelo como `Aprovado`, `Publicado` ou `Arquivado`.
- A acao de governanca deve gravar evento em `localStorage['bf_comparator_model_audit_v1']`.
- `dashboard-admin.html` deve refletir eventos de governanca no painel de auditoria.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/modelos-governanca-desktop.png`
  - `docs/test-prints/dashboard-admin-governanca-modelos-desktop.png`
  - `docs/test-prints/modelos-governanca-mobile.png`

## Biblioteca de modelos padrao

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local`.
- Abrir `pages/modelos-biblioteca.html` e confirmar que `data-standard-models-grid` lista 4 modelos publicados.
- Filtrar por jornada e preset sem recarregar a pagina.
- Clicar `Clonar modelo` em `std-liquidez-rapida`.
- Confirmar que `localStorage['bf_comparator_models_v1:cliente@bankfratern.local']` ganhou modelo com `standardId='std-liquidez-rapida'` e `source='standard:std-liquidez-rapida'`.
- Confirmar auditoria `clone-standard` em `localStorage['bf_comparator_model_audit_v1']`.
- Abrir o clone em `pages/comparador.html?modelo=<id>` e confirmar produtos CDC, credito com garantia e consignado ativos.
- Abrir `pages/dashboard-cliente.html` e confirmar bloco `data-client-standard-models` e clone em `data-client-comparator-models`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/modelos-biblioteca-desktop.png`
  - `docs/test-prints/comparador-modelo-padrao-clonado-desktop.png`
  - `docs/test-prints/dashboard-cliente-biblioteca-modelos-desktop.png`
  - `docs/test-prints/modelos-biblioteca-mobile.png`

## Recomendacao automatica de modelos

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local`.
- Salvar perfil local com urgencia `alta`, prioridade `rapidez`, renda, custos, dividas e reserva.
- Abrir `pages/comparador.html?preset=obter_liquidez`.
- Confirmar que `data-comparator-standard-recommendation="std-liquidez-rapida"` aparece com score e motivos explicaveis.
- Clicar `Clonar e aplicar`.
- Confirmar que o modelo clonado vira `document.body.dataset.comparatorModel`.
- Confirmar matriz com produtos `cdc`, `garantia` e `consignado`.
- Confirmar auditoria `clone-standard`.
- Abrir `pages/modelos-biblioteca.html?recomendado=std-liquidez-rapida` e confirmar primeiro card recomendado.
- Abrir `pages/dashboard-cliente.html` e confirmar `Recomendado para seu perfil`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias atuais:
  - `docs/test-prints/comparador-modelo-recomendado-desktop.png`
  - `docs/test-prints/comparador-modelo-recomendado-aplicado-desktop.png`
  - `docs/test-prints/modelos-biblioteca-recomendacao-desktop.png`
  - `docs/test-prints/dashboard-cliente-modelo-recomendado-desktop.png`
  - `docs/test-prints/comparador-modelo-recomendado-mobile.png`

## Produtos v8N - selecao assistida para o Comparador

Validacoes obrigatorias:

- Abrir `pages/produtos.html`.
- Confirmar `data-products-selection-panel`, `data-products-grid`, `data-products-decision-strip` e `data-products-bridge-timeline`.
- Selecionar `financiamento` e `consorcio` pelo botao `data-product-toggle-selection`.
- Confirmar `document.body.dataset.productsSelectedCount='2'`.
- Confirmar que o CTA de comparacao contem `preset=manual` e `products=financiamento%2Cconsorcio`.
- Abrir o Comparador por essa URL.
- Confirmar `document.body.dataset.comparatorFromProducts='financiamento,consorcio'`.
- Confirmar checkboxes `includeFinanciamento` e `includeConsorcio` ativos.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8n-produtos-selecao-desktop.png`
- `docs/test-prints/v8n-produtos-selecao-mobile.png`
- `docs/test-prints/v8n-comparador-produtos-selecionados-desktop.png`
- `docs/test-prints/v8n-produtos-microinteracoes-report.json`

## Jornada v8O - microconversoes locais

Validacoes obrigatorias:

- Limpar chaves `bf_journey_analytics_v1:*` do navegador de teste.
- Abrir `pages/produtos.html`.
- Selecionar `financiamento` e `consorcio`.
- Confirmar `data-journey-analytics` renderizado e `document.body.dataset.journeyAnalyticsReady='true'`.
- Clicar `Comparar selecao`.
- Confirmar no Comparador `document.body.dataset.comparatorFromProducts='financiamento,consorcio'`.
- Confirmar que `window.BFJourneyAnalytics.summary().compareOpen >= 1`.
- Clicar `Salvar cenario`.
- Confirmar `window.BFJourneyAnalytics.summary().savedScenarios >= 1`.
- Abrir um simulador a partir do Comparador ou acessar `pages/simulador-financiamento.html`.
- Confirmar `window.BFJourneyAnalytics.summary().simulatorRuns >= 1`.
- Abrir `pages/dashboard-cliente.html` com usuario autenticado e confirmar bloco `#metricas-jornada`.
- Desktop e mobile nao podem ter overflow horizontal.

Evidencias esperadas:

- `docs/test-prints/v8o-produtos-analytics-desktop.png`
- `docs/test-prints/v8o-comparador-analytics-desktop.png`
- `docs/test-prints/v8o-dashboard-analytics-desktop.png`
- `docs/test-prints/v8o-jornada-analytics-report.json`

## Admin v8P - funil de microconversoes por papel

Validacoes obrigatorias:

- Preparar eventos locais em pelo menos 3 escopos: `anon`, `cliente@bankfratern.local` e `consultor@bankfratern.local`.
- Logar como `admin@bankfratern.local`.
- Abrir `pages/dashboard-admin.html#admin-funil-jornada`.
- Confirmar `data-admin-journey-funnel`.
- Confirmar `document.body.dataset.adminJourneyFunnelReady='true'`.
- Confirmar `window.BFJourneyAnalytics.all().length > 0`.
- Confirmar `window.BFJourneyAnalytics.roleFunnel().byRole` com papeis `cliente`, `consultor` e `anonimo`.
- Confirmar cards de etapa `data-admin-funnel-stage` e cards de papel `data-admin-journey-role`.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8p-dashboard-admin-funil-desktop.png`
- `docs/test-prints/v8p-dashboard-admin-funil-mobile.png`
- `docs/test-prints/v8p-admin-funil-report.json`

## Admin v8Q - alertas operacionais e SLA local

Validacoes obrigatorias:

- Preparar eventos locais com pelo menos um abandono de jornada e um comparador sem continuidade.
- Preparar `bf_consultive_handoffs_v1` com pelo menos um lead aberto fora do SLA.
- Logar como `admin@bankfratern.local`.
- Abrir `pages/dashboard-admin.html#admin-alertas-operacionais`.
- Confirmar `data-admin-operational-alerts`.
- Confirmar `document.body.dataset.adminOperationalAlertsReady='true'`.
- Confirmar `Number(document.body.dataset.adminOperationalAlertsCount) >= 1`.
- Confirmar cards `data-admin-operational-alert="abandono"` e `data-admin-operational-alert="sla"` quando os dados existirem.
- Confirmar severidade, origem, idade do sinal e CTA de retomada nos cards.
- Desktop e mobile nao podem ter overflow horizontal.
- `tools/validate-design-system.mjs` e `tools/validate-calculadoras.mjs` devem retornar `ok: true`.

Evidencias esperadas:

- `docs/test-prints/v8q-dashboard-admin-alertas-desktop.png`
- `docs/test-prints/v8q-dashboard-admin-alertas-mobile.png`
- `docs/test-prints/v8q-admin-alertas-report.json`

## Trilha assistida de decisao

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local`.
- Abrir `pages/trilha-decisao.html`.
- Confirmar formulario `data-decision-journey-form`, resumo `data-decision-journey-summary`, etapas `data-decision-journey-steps` e acoes `data-decision-journey-actions`.
- Submeter objetivo `Obter liquidez`, urgencia `Alta`, prioridade `Disponibilidade rapida`, renda, custos, dividas, reserva, valor alvo e entrada.
- Confirmar `document.body.dataset.decisionJourneyReady='true'`.
- Confirmar persistencia em `localStorage['bf_decision_journey_v1:cliente@bankfratern.local']`.
- Confirmar `recommendedModel.id='std-liquidez-rapida'`.
- Confirmar link para `comparador.html?preset=obter_liquidez`.
- Abrir `pages/dashboard-cliente.html` e confirmar bloco `data-client-decision-journey-current`.
- Confirmar `data-client-continuity-cockpit`, `data-client-next-action`, `data-client-handoff-status`, `data-client-proposal-status`, `data-client-simulation-context` e `data-client-commercial-stage`.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/trilha-decisao-desktop.png`
  - `docs/test-prints/trilha-decisao-comparador-desktop.png`
  - `docs/test-prints/dashboard-cliente-trilha-decisao-desktop.png`
  - `docs/test-prints/trilha-decisao-mobile.png`

## Handoff consultivo e leads locais

Validacoes obrigatorias:

- Fazer login como `cliente@bankfratern.local`.
- Abrir `pages/trilha-decisao.html`, gerar uma trilha e clicar `Gerar handoff local`.
- Confirmar persistencia em `localStorage['bf_consultive_handoffs_v1']`.
- Confirmar auditoria em `localStorage['bf_consultive_handoff_audit_v1']`.
- Abrir `pages/handoff-consultivo.html` como admin ou consultor.
- Confirmar `document.body.dataset.handoffReady='true'`.
- Confirmar que a fila exibe o lead com objetivo, produto, modelo, prioridade e status.
- Alterar status para `Qualificado`, marcar pelo menos um item de checklist e adicionar uma nota local.
- Confirmar que o lead atualiza timeline e auditoria local.
- Abrir `pages/dashboard-admin.html` e confirmar bloco `data-admin-handoff-summary`.
- Abrir `pages/dashboard-cliente.html` e confirmar handoff vinculado a trilha.
- Desktop e mobile nao podem ter overflow horizontal.
- Evidencias esperadas:
  - `docs/test-prints/handoff-trilha-criado-desktop.png`
  - `docs/test-prints/handoff-consultivo-desktop.png`
  - `docs/test-prints/dashboard-admin-handoff-desktop.png`
  - `docs/test-prints/handoff-consultivo-mobile.png`

## Autenticacao local e administracao

Contas de demonstracao:

- Admin: `admin@bankfratern.local` / `Admin@123`
- Consultor: `consultor@bankfratern.local` / `Consultor@123`
- Cliente: `cliente@bankfratern.local` / `Cliente@123`

Validacoes obrigatorias:

- Abrir `pages/dashboard-admin.html` sem sessao e confirmar redirecionamento para `pages/login.html?redirect=dashboard-admin.html`.
- Logar como admin e confirmar redirecionamento para `pages/dashboard-admin.html`.
- Confirmar que o header mostra usuario logado, papel e botao `Sair`.
- Confirmar que a tabela admin carrega pelo menos 3 usuarios seed.
- Criar um usuario de teste e confirmar que a tabela/lista local aumenta.
- Abrir `pages/dashboard-cliente.html` logado e confirmar que a sessao ativa aparece no painel.
- Evidencias atuais:
  - `docs/test-prints/auth-login-desktop.png`
  - `docs/test-prints/auth-admin-dashboard-desktop.png`
  - `docs/test-prints/auth-client-dashboard-desktop.png`

## Banco local Node/SQLite

Validacao automatica:

```powershell
& $node --check js\backend\db.js
& $node --check assets\js\services\backend-api.service.js
& $node --check assets\js\admin-users.js
& $node tools\validate-local-database.mjs
```

Validacoes obrigatorias:

- `GET /api/health` deve responder `schema='bancus-fraternis.local-db.v1'` quando `node server.js` estiver ativo.
- `GET /api/database/status` deve exigir admin e retornar provider `sqlite`, tabelas, arquivos e `quickCheck='ok'`.
- `POST /api/database/import-local` deve exigir admin, aceitar preview/execucao, pular usuarios/eventos ja existentes e atualizar snapshots pelo mesmo `id`.
- Login seed em `/api/auth/login` deve retornar usuario publico e token, sem hash/salt/senha.
- `GET /api/users` deve exigir sessao admin.
- Criacao de usuario deve salvar senha com hash server-side e permitir login posterior.
- `POST /api/events` deve remover senha, token, CPF, telefone, WhatsApp, hash e salt do payload.
- `POST /api/snapshots` deve remover senha, token, CPF, telefone, WhatsApp, hash e salt do payload.
- `GET /api/snapshots` deve exigir admin e aceitar filtro opcional por tipo.
- `pages/dashboard-admin.html` deve renderizar `data-admin-backend-events` com metricas e ultimos eventos quando houver sessao admin da API.
- `pages/dashboard-admin.html` deve renderizar `data-admin-backend-table` e `data-admin-backend-database-provider` no painel de banco.
- `pages/dashboard-admin.html` deve renderizar `data-admin-local-import-panel`, `data-admin-local-snapshot-count`, preview e execucao da migracao guiada.
- Em modo estatico, `data-admin-backend-events` deve exibir fallback sem bloquear o restante do Dashboard Admin.
- GitHub Pages e `file://` devem continuar funcionando via fallback `localStorage`.
- `node tools/inspect-local-sql-environment.mjs` deve gerar `docs/test-reports/local-sql-environment-report.json` com portas SQL padrao e CLIs detectadas.

## Persistencia e retomada

- Criar ou injetar uma simulacao em `localStorage['consorciopro_simulations']`.
- Abrir `pages/simulador.html?simulationId=<id>` e validar:
  - consultor restaurado
  - cliente restaurado
  - carrinho restaurado
  - etapa ativa compatível com a simulacao salva
- Abrir `pages/carteira.html#simulacoes-salvas` e validar o link `Retomar simulacao`.
