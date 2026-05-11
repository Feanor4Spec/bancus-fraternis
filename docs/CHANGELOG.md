# CHANGELOG - Bancus Fraternis

> Histórico de todas as versões do projeto

---

## [v8.64.0] - 2026-05-11

### Cadencia comercial no funil admin

#### Adicionado
- Dashboard Admin ganhou `data-admin-commercial-stage-insights` dentro do funil comercial.
- Criados os blocos `data-admin-commercial-stage-summary`, `data-admin-commercial-stage-stuck-lead` e `data-admin-commercial-stage-movement`.
- A cadencia mostra movimentacoes em 24h/7d, aging medio da etapa, leads parados e resumo das cinco etapas.

#### Modificado
- O funil comercial agora usa o historico local de movimentacao para orientar retomadas sugeridas.
- Validadores, contratos publicos, mapa, plano, protocolo e evidencia browser passaram a proteger a cadencia comercial.

#### Validado
- `node --check assets/js/admin-users.js`
- `node --check tools/run-v8af-browser-evidence.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/run-v8af-browser-evidence.mjs`

---

## [v8.63.0] - 2026-05-11

### Funil comercial movel no Dashboard Admin

#### Adicionado
- Dashboard Admin ganhou seletor `data-admin-commercial-stage-select` em cada lead do funil comercial.
- Criadas as chaves `bf_admin_commercial_stage_states_v1` e `bf_admin_commercial_stage_audit_v1` para etapa atual e historico local.
- O funil agora mostra `data-admin-commercial-stage-history` e permite mover leads entre Contato, Proposta, Follow-up, Negociacao e Fechamento.

#### Modificado
- A movimentacao comercial reflete o status do handoff por meio de `BFHandoffConsultivoService.setStatus`.
- Validadores, contratos publicos, mapa, plano e evidencia browser passaram a proteger o novo contrato operacional.

#### Validado
- `node --check assets/js/admin-users.js`
- `node --check tools/run-v8af-browser-evidence.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/run-v8af-browser-evidence.mjs`

---

## [v8.62.0] - 2026-05-11

### Funil comercial por etapa do lead

#### Adicionado
- Dashboard Admin ganhou `data-admin-commercial-pipeline`, `data-admin-commercial-stage` e `data-admin-commercial-lead`.
- Criado funil visual com cinco etapas comerciais: Contato, Proposta, Follow-up, Negociacao e Fechamento.
- Cada etapa mostra volume, alta prioridade, SLA, aging medio e os leads mais relevantes com link direto para o handoff.

#### Modificado
- A stagebar do Dashboard Admin ganhou atalho direto para `#admin-funil-comercial`.
- Validadores, contratos publicos, mapa, plano e evidencia browser passaram a proteger o novo funil.

#### Validado
- `node --check assets/js/admin-users.js`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/run-v8af-browser-evidence.mjs`

---

## [v8.61.0] - 2026-05-11

### Filtros e exportacao da carteira comercial

#### Adicionado
- Dashboard Admin ganhou filtros em `data-admin-consultant-portfolio-filters` por busca, consultor, origem, prioridade e SLA.
- Criado plano comercial do dia em `data-admin-consultant-portfolio-priority`, priorizando leads por SLA vencido, prioridade e aging.
- Adicionada exportacao JSON sanitizada da carteira em `bank-fratern.admin-consultant-portfolio.v1`, acionada por `data-admin-consultant-portfolio-export`.

#### Modificado
- A carteira por consultor agora preserva a mesma leitura filtrada para tela, plano comercial e exportacao.
- Validadores, contratos publicos e evidencia browser passaram a proteger filtros, prioridade comercial e exportacao sem email, CPF ou telefone.

#### Validado
- `node --check assets/js/admin-users.js`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/run-v8af-browser-evidence.mjs`

---

## [v8.60.0] - 2026-05-11

### Carteira por consultor no admin

#### Adicionado
- Dashboard Admin ganhou `data-admin-consultant-portfolio`, `data-admin-consultant-portfolio-row` e `data-admin-consultant-portfolio-lead`.
- Criada visao de carteira por consultor com leads abertos, alta prioridade, SLA vencido, sem responsavel, aging medio, origem e proximo foco.
- O painel usa handoffs enriquecidos pelo `BFHandoffConsultivoService` e cai para gargalos operacionais quando ainda nao ha handoffs abertos.

#### Modificado
- A stagebar do Dashboard Admin ganhou atalho direto para `#admin-carteira-consultor`.
- Validadores, contratos, mapa e plano de acao passaram a proteger a leitura de carteira por consultor.

#### Validado
- `node --check assets/js/admin-users.js`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/run-v8af-browser-evidence.mjs`

---

## [v8.59.0] - 2026-05-11

### Produtividade por consultor

#### Adicionado
- Dashboard Admin ganhou `data-admin-consultant-productivity` e `data-admin-consultant-productivity-row`.
- Criado cálculo local de produtividade por responsável com ações abertas, em execução, adiadas, concluídas, tempo médio e gargalos recorrentes.
- A leitura usa a fila guiada atual e o histórico `bf_operational_action_audit_v1`.

#### Modificado
- O bloco de funil administrativo passou a exibir produtividade logo após a fila guiada.
- Validadores de admin e contratos públicos passaram a proteger o novo contrato.

#### Validado
- `node --check assets/js/admin-users.js`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`

---

## [v8.58.0] - 2026-05-11

### Execucao persistente da fila guiada

#### Adicionado
- `BFHandoffConsultivoService` passou a persistir execucao operacional em `bf_operational_action_states_v1` e historico em `bf_operational_action_audit_v1`.
- Handoff ganhou `data-handoff-action-execution`, `data-handoff-action-reason` e `data-handoff-action-history` no plano de acao do lead.
- Dashboard Admin ganhou `data-admin-action-execution`, `data-admin-action-reason`, `data-admin-action-history` e `data-admin-action-owner-history`.

#### Modificado
- A fila guiada agora permite iniciar, adiar, concluir e reabrir acoes locais com motivo/observacao.
- O admin passou a mostrar resumo por status e historico por responsavel.
- Contratos publicos passaram a cobrir 15 chaves de `localStorage` e 24 marcadores `data-*`.

#### Validado
- `node --check assets/js/services/handoff-consultivo.service.js`
- `node --check assets/js/handoff-consultivo.js`
- `node --check assets/js/admin-users.js`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`

---

## [v8.57.0] - 2026-05-11

### Fila guiada de acoes operacionais

#### Adicionado
- `BFHandoffConsultivoService` ganhou `actionPlan()`, calculando tipo de acao, dono, prazo, CTA e destino para cada lead.
- O cockpit/detalhe do Handoff passou a expor `data-handoff-action-plan` com dono, prazo e CTA para abrir lead ou proposta.
- Dashboard Admin ganhou `data-admin-action-queue`, uma fila guiada que converte gargalos e sinais por origem em prioridade, responsavel, alvo e link direto.

#### Modificado
- Gargalos de proposta/handoff agora carregam alvo e responsavel sugerido para alimentar a fila admin.
- Links administrativos para handoffs usam `handoffId` e abrem o detalhe do lead.
- Contratos publicos, mapa e plano de evolucao passaram a registrar a fila guiada.

#### Validado
- `node --check assets/js/services/handoff-consultivo.service.js`
- `node --check assets/js/handoff-consultivo.js`
- `node --check assets/js/admin-users.js`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`
- `node tools/validate-public-contracts.mjs`

---

## [v8.56.0] - 2026-05-11

### Inteligencia operacional de propostas versionadas

#### Adicionado
- `BFHandoffConsultivoService` passou a calcular `proposalState`, com versao travada, validade, snapshot, proposta vencida, proposta sem versao e retomada de proposta aberta.
- O painel de handoff ganhou `data-handoff-proposal-version`, mostrando estado da versao, validade, snapshot e proximo passo no card e no detalhe do lead.
- Dashboard Admin passou a ler `bank_fratern_proposal_versions_v1` e cruzar versoes com handoffs.

#### Modificado
- O cockpit do consultor agora destaca propostas vencidas e propostas sem snapshot.
- O quadro de gargalos do Admin agora aponta proposta versionada sem handoff, proposta vencida e proposta alterada apos o handoff.
- Validadores de handoff, funil admin e contratos publicos passaram a cobrir os novos sinais.

#### Validado
- `node --check assets/js/services/handoff-consultivo.service.js`
- `node --check assets/js/handoff-consultivo.js`
- `node --check assets/js/admin-users.js`
- `node tools/validate-handoff-consultant-operations.mjs`
- `node tools/validate-admin-dashboard-source-funnel.mjs`

---

## [v8.55.0] - 2026-05-08

### Versionamento local da proposta

#### Adicionado
- Criado `js/proposal-versioning.js` com `BFProposalVersions` e chave `bank_fratern_proposal_versions_v1`.
- Etapa 9 ganhou `data-proposal-version-panel`, historico por proposta, status de mudancas pendentes e comparacao entre a ultima versao salva e a anterior.
- Criado `tools/validate-proposal-versioning.mjs` com relatorio em `docs/test-reports/proposal-versioning-report.json`.

#### Modificado
- Exportar PDF, imprimir e criar handoff agora salvam/travam a versao atual da proposta quando ha mudancas.
- O handoff de proposta passa a preservar `sourceProposalVersionId` e `sourceProposalVersionHash` quando nasce de uma versao congelada.
- Contratos publicos, plano, README e CI passaram a registrar o novo contrato de versionamento.

#### Validado
- `node --check js/proposal-versioning.js`
- `node --check js/app.js`
- `node tools/validate-proposal-versioning.mjs`

---

## [v8.54.0] - 2026-05-08

### Lousa consultiva avancada da proposta/PDF

#### Adicionado
- A lousa da etapa 9 ganhou presets `Consultiva` e `Tecnica`, alem de acoes para selecionar ou limpar grupos inteiros de blocos, graficos, conceitos e formulas.
- Adicionado painel de prontidao `data-proposal-builder-readiness`, com foco da proposta, estimativa de paginas e alertas antes da exportacao.
- Cada item selecionavel agora expoe `data-proposal-builder-option`, facilitando QA visual e automacao futura.
- O PDF passou a incluir `data-proposal-selection-summary` no plano de proximos passos, resumindo quantos blocos, graficos, conceitos e formulas entraram na proposta final.

#### Modificado
- Graficos desmarcados pela lousa deixam de aparecer como placeholders no PDF final; a proposta mostra apenas o que o consultor escolheu exibir ao cliente.
- `tools/validate-proposal-builder.mjs`, contratos publicos e CI passaram a proteger os novos controles da lousa.

#### Validado
- `node --check js/app.js`
- `node --check js/proposal-summary.js`
- `node tools/validate-proposal-builder.mjs`
- Browser headless local: `docs/test-reports/proposal-builder-browser-report.json`

---

## [v8.53.0] - 2026-05-08

### Performance do simulador online

#### Adicionado
- Criado `data_base/Tab_Grupos_Consorcio.compact.json` em formato colunar compacto, preservando os 17.396 grupos validos da base canonica.
- Criado `tools/build-simulator-compact-db.mjs` para regenerar a base compacta a partir de `Tab_Grupos_Consorcio.json`.
- Criado `tools/validate-simulator-performance.mjs` com relatorio em `docs/test-reports/simulator-performance-report.json`.

#### Modificado
- `pages/simulador.html` passou a carregar a base compacta primeiro e manter fallback para o JSON canonico.
- `js/shelf-data.js` passou a aceitar payload compacto `bancus.shelf.compact.v1` e lista de fontes com fallback.
- `js/database-progress.js` passou a exibir fonte `Base compacta JSON`.
- CI, contratos publicos, mapa, plano e READMEs passaram a registrar o validador de performance.

#### Validado
- `node tools/build-simulator-compact-db.mjs`
- `node tools/validate-simulator-performance.mjs`
- `node tools/validate-simulator-groups.mjs`
- `node tools/validate-design-system.mjs`

---

## [v8.52.0] - 2026-05-08

### QA online da jornada publicada

#### Adicionado
- Criado `tools/validate-online-journey-smoke.mjs` para validar no GitHub Pages as 10 etapas do roteiro navegavel: Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards.
- Criado relatorio `docs/test-reports/online-journey-smoke-report.json`.
- Criado relatorio renderizado `docs/test-reports/online-journey-browser-report.json` com login admin demo, anchor dinamica do Admin, lousa e simulador.

#### Modificado
- Contratos publicos, mapa, plano e READMEs passaram a registrar o smoke test online da jornada publicada.
- `tools/validate-design-system.mjs` passou a exigir a presenca do novo validador.

#### Validado
- `node tools/validate-online-journey-smoke.mjs`
- Browser renderizado: login demo -> Dashboard Admin, lousa com 10 etapas e simulador com lousa de proposta.
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-design-system.mjs`

---

## [v8.51.0] - 2026-05-08

### Publicacao segura e governanca online

#### Adicionado
- Criado `tools/validate-public-release-safety.mjs` para auditar paths locais, dados pessoais de exemplo, aviso demo, fallback estatico, `.gitignore` e workflow publico.
- Criado `404.html` para redirecionar rotas curtas comuns no GitHub Pages.
- Criado `.github/workflows/validate.yml` para rodar validadores estaticos em push, pull request e execucao manual.
- Shell, login e simulador ganharam selo/aviso de ambiente publico de demonstracao.

#### Modificado
- Dados de exemplo legados em `js/data.js` foram anonimizados para placeholders locais.
- `tools/run-v8af-browser-evidence.mjs` deixou de referenciar caminho absoluto de runtime.
- Contratos publicos, plano e README passaram a registrar a validacao de seguranca publica.

#### Validado
- `node tools/validate-public-release-safety.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-design-system.mjs`

---

## [v8.50.0] - 2026-05-08

### Governanca do deploy publico

#### Adicionado
- Criado `tools/validate-github-pages-deploy.mjs` para validar GitHub Pages, Home, lousa, simulador e base real online.
- Criado relatorio `docs/test-reports/github-pages-deploy-report.json`.
- README raiz e `docs/README.md` passaram a registrar a URL publica do Bancus Fraternis.

#### Modificado
- `tools/validate-design-system.mjs` passou a exigir o validador de deploy publico.
- Contratos publicos passaram a documentar o validador de GitHub Pages.
- Repositorio GitHub passou a apontar a homepage para `https://feanor4spec.github.io/bancus-fraternis/`.

#### Validado
- `node tools/validate-github-pages-deploy.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-design-system.mjs`

---

## [v8.49.0] - 2026-05-08

### Rebrand publico para Bancus Fraternis

#### Modificado
- Marca visivel do produto atualizada de Bank Fratern para Bancus Fraternis em paginas, titulos, descricoes, layout compartilhado, proposta e documentacao ativa.
- Logos SVG passaram a exibir Bancus Fraternis nos textos e metadados acessiveis, mantendo nomes de arquivos `bank-fratern-*` para compatibilidade.
- Validadores e documentos de governanca passaram a reconhecer Bancus Fraternis como plataforma atual.
- Caminhos fisicos locais e contratos tecnicos `bank-fratern.*`, `BANK_FRATERN` em nomes de arquivo e chaves de schema foram preservados para nao quebrar dados locais, rotas, assets ou validadores.

#### Validado
- `node tools/validate-design-system.mjs`
- `node tools/validate-public-contracts.mjs`
- `node tools/validate-docs-modernization.mjs`
- `node tools/validate-navigable-journey.mjs`

---

## [v8.48.0] - 2026-05-08

### Roteiro navegavel ponta a ponta

#### Adicionado
- `pages/lousa-navegacao.html` ganhou a secao `#roteiro-navegavel` com 10 etapas de QA: Auth, Home, Produtos, Calculadoras, Trilha, Comparador, Simulador, Proposta, Handoff e Dashboards.
- Criado `tools/validate-navigable-journey.mjs` com relatorio em `docs/test-reports/navigable-journey-report.json`.
- Contratos publicos passaram a documentar `data-lousa-journey-checklist` e `data-lousa-journey-acceptance`.

#### Modificado
- Dashboard Admin ganhou atalho para a lousa de teste navegavel no rail executivo e na stagebar.
- `assets/css/platform.css` recebeu estilos para cards e criterios de aceite da lousa.
- `tools/validate-design-system.mjs` passou a exigir o novo validador de jornada navegavel.
- Mapa e plano de acao foram atualizados com o status da fase entregue.

#### Validado
- `node --check .\tools\validate-navigable-journey.mjs`
- `node .\tools\validate-navigable-journey.mjs`
- `node .\tools\validate-public-contracts.mjs`
- `node .\tools\validate-design-system.mjs`

---

## [v8.47.0] - 2026-05-08

### Login local e navegacao autenticada

#### Adicionado
- Criado `tools/validate-auth-navigation.mjs` com relatorio em `docs/test-reports/auth-navigation-report.json`.
- Contratos publicos passaram a documentar `data-login-form`, `data-login-email`, `data-login-password` e `data-demo-login`.

#### Modificado
- `assets/js/login.js` passou a centralizar `performLogin()` e registrar `loginRedirectReady/loginRedirectTarget` no `dataset` da pagina.
- `assets/js/login.js` agora inicializa tambem quando o DOM ja esta pronto, evitando clique sem handler em `file://`.
- Contas seed em `pages/login.html` agora entram direto no prototipo e preservam o `redirect` solicitado.
- `redirectTarget()` bloqueia loops de retorno para `login.html` e continua rejeitando URLs externas.
- `pages/lousa-navegacao.html` passou a marcar teste navegavel como em andamento, com login local ja validado.
- Mapa e plano de acao passaram a registrar a navegacao autenticada como contrato validado.

#### Validado
- `node --check .\assets\js\login.js`
- `node --check .\tools\validate-auth-navigation.mjs`
- `node .\tools\validate-auth-navigation.mjs`

---

## [v8.46.0] - 2026-05-08

### Handoff do consultor com aging e prioridade

#### Adicionado
- `pages/handoff-consultivo.html` ganhou cockpit do consultor em `data-handoff-consultant-cockpit`.
- A fila de handoff ganhou filtros por responsavel e aging.
- `assets/js/services/handoff-consultivo.service.js` passou a expor `operationalState`, `enrichList` e `consultantBoard`.
- Criado `tools/validate-handoff-consultant-operations.mjs` com relatorio em `docs/test-reports/handoff-consultant-operations-report.json`.

#### Modificado
- `assets/js/handoff-consultivo.js` passou a exibir SLA vencido, aging, responsavel sugerido e proximo passo nos cards e detalhe do lead.
- `assets/css/platform.css` recebeu estilos para cockpit, cards de acao consultiva e badges de aging.
- `pages/lousa-navegacao.html` passou a marcar o ciclo do consultor como concluido e preparar teste navegavel ponta a ponta.
- `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md`, mapa e plano de acao passaram a registrar o novo contrato operacional do consultor.

#### Validado
- `node --check .\assets\js\services\handoff-consultivo.service.js`
- `node --check .\assets\js\handoff-consultivo.js`
- `node --check .\tools\validate-handoff-consultant-operations.mjs`
- `node .\tools\validate-handoff-consultant-operations.mjs`

---

## [v8.45.0] - 2026-05-08

### Governanca documental e mapa ativo

#### Adicionado
- Criado `tools/validate-docs-modernization.mjs` com relatorio em `docs/test-reports/docs-modernization-report.json`.
- `docs/README.md` foi recriado como porta atual do Bancus Fraternis, com estado do produto, mapa rapido, rotas, validadores e contratos preservados.
- Docs historicos `docs/ARQUITETURA.md`, `docs/ATA_PROJETO.md`, `docs/FOLDER_PROJETO.md` e `docs/implementation_plan.md` receberam banner de documento historico.

#### Modificado
- `docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md` e `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md` foram alinhados ao catalogo atual de 19 calculadoras.
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` passou a registrar o validador documental e a nova classificacao dos docs historicos.
- `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` marcou o saneamento documental como concluido na Fase 5.
- `pages/lousa-navegacao.html` passou a exibir contratos e docs estabilizados, 24 validadores e o proximo ciclo como consultor com aging/prioridade.
- `tools/validate-public-contracts.mjs` passou a reconhecer legado documental controlado sem gerar alerta falso.

#### Validado
- `node --check .\tools\validate-docs-modernization.mjs`
- `node .\tools\validate-docs-modernization.mjs`

---

## [v8.44.0] - 2026-05-08

### Governanca de contratos publicos

#### Adicionado
- Criado `docs/CONTRATOS_PUBLICOS_BANK_FRATERN.md` como matriz viva de `localStorage`, `data-*`, deep links, exports globais, validadores e Definition of Done.
- Criado `tools/validate-public-contracts.mjs` com relatorio em `docs/test-reports/public-contracts-report.json`.
- `pages/api-docs.html` ganhou secao de contratos publicos antes dos endpoints futuros.

#### Modificado
- `docs/CODEX_TEST_PROTOCOL.md` passou a registrar o workspace atual e a validacao de contratos publicos.
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` passou a referenciar a matriz publica e o novo validador.
- `pages/lousa-navegacao.html` passou a indicar a governanca de contratos como proximo ciclo.
- `tools/validate-design-system.mjs` passou a exigir `tools/validate-public-contracts.mjs`.
- `pages/api-docs.html` passou a refletir o catalogo atual de 19 calculadoras.

#### Validado
- `node --check .\tools\validate-public-contracts.mjs`
- `node .\tools\validate-public-contracts.mjs`

---

## [v8.43.0] - 2026-05-08

### Cockpit de proximas acoes do Dashboard Admin

#### Adicionado
- Dashboard Admin ganhou bloco `data-admin-next-actions` com a lista curta de proximas acoes recomendadas.
- Stagebar administrativa ganhou atalhos diretos para Proximos passos, Origens e Gargalos.
- Funil por origem e quadro de gargalos passaram a expor ancoras `admin-origens` e `admin-gargalos`.

#### Modificado
- `tools/validate-admin-dashboard-source-funnel.mjs` passou a validar cockpit, ancoras, stagebar e contratos responsivos do Admin.
- `assets/css/platform.css` recebeu estilos para `bf-admin-next-*` e incluiu o cockpit nas regras mobile.

#### Validado
- `node --check .\assets\js\admin-users.js`
- `node --check .\tools\validate-admin-dashboard-source-funnel.mjs`
- `node .\tools\validate-admin-dashboard-source-funnel.mjs`

---

## [v8.42.0] - 2026-05-08

### Dashboard Admin por origem e gargalos

#### Adicionado
- Dashboard Admin passou a consolidar funil por origem: calculadoras, produtos, trilha, comparador, simulador, proposta e pacotes.
- Novo quadro de gargalos destaca proposta revisada sem handoff, trilha sem comparador, handoff sem responsavel e SLA vencido.
- Criado `tools/validate-admin-dashboard-source-funnel.mjs` com relatorio em `docs/test-reports/admin-dashboard-source-funnel-report.json`.

#### Modificado
- `assets/js/admin-users.js` agora calcula aging, prioridade, SLA, responsavel sugerido e proxima acao por origem operacional.
- `assets/css/platform.css` ganhou estilos para `bf-admin-source-*` e `bf-admin-bottleneck-*`.
- `pages/simulador.html` deixou de manter o template legado da stagebar superior; os atalhos ativos ficam no painel inferior recolhivel.
- `tools/validate-design-system.mjs` passou a exigir o validador e os contratos do funil admin por origem.

#### Validado
- `node --check .\assets\js\admin-users.js`
- `node --check .\tools\validate-admin-dashboard-source-funnel.mjs`
- `node .\tools\validate-admin-dashboard-source-funnel.mjs`

---

## [v8.41.0] - 2026-05-07

### Lousa de exportacao da proposta

#### Adicionado
- Etapa 9 do simulador ganhou `proposal-builder-board`, uma lousa para o consultor selecionar blocos, graficos, conceitos e formulas da proposta final.
- `ProposalSummary` passou a aceitar `builder` como contrato de renderizacao, filtrando secoes e graficos antes do PDF.
- Incluidas secoes educativas de conceitos e memoria de calculo explicada na proposta/PDF.
- Criado `tools/validate-proposal-builder.mjs` com relatorio em `docs/test-reports/proposal-builder-report.json`.

#### Modificado
- Exportacao PDF e impressao continuam usando `#proposal-export-root`, agora respeitando a selecao salva em `localStorage`.
- `tools/validate-design-system.mjs` passou a exigir o validador da lousa de proposta.

#### Validado
- `node --check .\js\proposal-summary.js`
- `node --check .\js\app.js`
- `node --check .\tools\validate-proposal-builder.mjs`
- `node .\tools\validate-proposal-builder.mjs`

---

## [v8.40.0] - 2026-05-07

### Lousa navegavel da plataforma

#### Adicionado
- Criada `pages/lousa-navegacao.html` como quadro de bordo para navegar pela jornada, operacao, governanca e proximos ciclos.
- `assets/css/platform.css` recebeu estilos `bf-lousa-*` para lanes, matriz operacional, contratos e roadmap.
- `server.js` passou a expor o alias curto `lousa-navegacao.html`.

#### Modificado
- Mapa completo passou a registrar 52 paginas e 52 aliases curtos.
- Plano de acao passou a tratar a lousa como ponto de entrada para revisao e preparo dos proximos ciclos.

#### Validado
- `node --check .\server.js`
- `node .\tools\validate-route-aliases.mjs`
- `node .\tools\validate-design-system.mjs`

---

## [v8.39.0] - 2026-05-07

### Dashboard Cliente com continuidade por etapa

#### Adicionado
- Criado `tools/validate-dashboard-continuity-flow.mjs`.
- Gerado relatorio em `docs/test-reports/dashboard-continuity-flow-report.json`.

#### Modificado
- `assets/js/client-dashboard.js` ganhou helper de deep links `from=dashboard`.
- Linha do tempo do cliente passou a exibir Diagnostico, Calculadora, Trilha, Comparador, Simulacao, Proposta e Handoff.
- Atividade recente, Trilha ativa e Handoff agora usam links contextuais com `journeyId`, `calculatorSlug`, `historyId` ou `handoffId` quando existem.
- Card de Handoff no cockpit passou a mostrar origem e aging.
- `pages/dashboard-cliente.html` ganhou atalhos estaticos com `from=dashboard`.
- `tools/validate-design-system.mjs` passou a exigir o validador da continuidade do Dashboard Cliente.

#### Validado
- `node --check .\assets\js\client-dashboard.js`
- `node --check .\tools\validate-dashboard-continuity-flow.mjs`
- `node .\tools\validate-dashboard-continuity-flow.mjs`

---

## [v8.38.0] - 2026-05-07

### Trilha Assistida com contexto de origem

#### Adicionado
- `BFDecisionJourneyContext` passou a ler `from`, `sourceFrom`, `productId`, `calculatorSlug`, `historyId`, `preset`, `journeyId` e `products`.
- Criado `tools/validate-decision-journey-context.mjs`.
- Gerado relatorio em `docs/test-reports/decision-journey-context-report.json`.

#### Modificado
- `assets/js/trilha-decisao.js` agora preenche objetivo e urgencia a partir da origem de Produtos ou Calculadoras quando a URL traz contexto.
- A Trilha deixa de reutilizar uma trilha salva quando ha contexto novo na URL, gerando uma previa coerente com a entrada atual.
- CTAs de diagnostico, produto, modelo, comparador, dashboard e handoff passam a sair com `from=journey` e preservam a origem anterior em `sourceFrom`.
- `pages/trilha-decisao.html` ganhou atalhos estaticos contextuais.
- `tools/validate-design-system.mjs` passou a exigir o validador da Trilha contextual.

#### Validado
- `node --check .\assets\js\trilha-decisao.js`
- `node --check .\tools\validate-decision-journey-context.mjs`
- `node .\tools\validate-decision-journey-context.mjs`

---

## [v8.37.0] - 2026-05-07

### Calculadoras com deep links contextuais

#### Adicionado
- `BFCalculatorJourney` passou a expor geradores de rota para simulador, trilha, comparador, dashboard, hub e calculadora.
- Historico das calculadoras ganhou acoes compactas para reabrir, montar trilha, comparar e simular mantendo origem.

#### Modificado
- Hub e paginas individuais de calculadoras passaram a usar `from=calculator` ou `from=calculators`, `calculatorSlug`, `historyId` e `preset`.
- Pontes e timelines das calculadoras agora incluem Trilha e Comparador antes do Simulador.
- Relacionadas e atalhos do hub preservam contexto de origem e calculadora anterior.
- `tools/validate-decision-flow.mjs` passou a validar as rotas de Calculadoras para Trilha, Comparador, Simulador e reabertura.

#### Validado
- `node --check .\assets\js\calculadoras-page.js`
- `node --check .\tools\validate-decision-flow.mjs`
- `node .\tools\validate-decision-flow.mjs`
- `node .\tools\validate-calculadoras.mjs`

---

## [v8.36.0] - 2026-05-07

### Produtos com contexto preservado

#### Adicionado
- `BFProductsJourney` passou a expor geradores de deep link para Produtos.
- Cards de produto agora podem receber CTAs contextuais para simulador, comparador, calculadora e trilha.

#### Modificado
- Atalhos de `pages/produtos.html` passaram a carregar `from=products`, `productId` e `preset`.
- CTAs de Produtos preservam origem, produto recomendado, preset e selecao manual em `products`.
- `tools/validate-product-journey-flow.mjs` passou a validar os deep links contextuais.
- `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` ganhou status geral do que ja foi implementado.

#### Validado
- `node --check .\assets\js\bf-platform.js`
- `node --check .\assets\js\components\cards.js`
- `node .\tools\validate-product-journey-flow.mjs`

---

## [v8.35.0] - 2026-05-07

### Garantia de carga completa do simulador

#### Adicionado
- Criado `tools/validate-simulator-groups.mjs`.
- Gerado relatorio em `docs/test-reports/simulator-groups-report.json`.

#### Validado
- A base `data_base/Tab_Grupos_Consorcio.json` tem 17.418 registros brutos.
- O loader do simulador carrega 17.396 grupos validos pelo criterio minimo atual.
- Os 22 registros excluidos tem `valorCartaRef<=0`, logo nao sao simulaveis no motor atual.
- Filtro vazio, ordenacao, score e paginacao preservam os 17.396 grupos.
- A prateleira cobre 6 segmentos e 120 administradoras.

---

## [v8.34.0] - 2026-05-07

### Home com trilha assistida ativa

#### Adicionado
- Home passou a carregar `BFTrilhaDecisaoService`.
- Cockpit de continuidade ganhou metrica e card de trilha assistida.
- Acoes recomendadas passam a priorizar o `nextAction.href` da trilha ativa.

#### Modificado
- Hero contextual reconhece trilha ativa quando nao ha simulacao salva mais recente.
- `tools/validate-home-continuity-cockpit.mjs` agora valida trilha ativa, deep link e sanitizacao de dados pessoais.
- `tools/validate-home-contextual-hero.mjs` agora cobre o estado `journey` da primeira dobra.
- Mapa completo e plano de evolucao foram atualizados com o novo contrato da Fase 2.

#### Validado
- `node --check .\js\home.js`
- `node .\tools\validate-home-continuity-cockpit.mjs`
- `node .\tools\validate-home-contextual-hero.mjs`

---

## [v8.33.0] - 2026-05-07

### Origem operacional dos handoffs

#### Adicionado
- `BFHandoffConsultivoService` ganhou `sourceType()`, `sourceLabel()` e labels de origem.
- Criado `tools/validate-handoff-origins.mjs`.
- Painel de handoff ganhou filtro de origem.

#### Modificado
- Handoffs criados por trilha, sinal, pacote importado e proposta agora preservam `sourceType` e `sourceLabel`.
- Cards e detalhes do painel consultivo exibem origem e resumo operacional.
- Dashboard Admin passou a mostrar metricas de handoffs originados por proposta e trilha.
- `assets/css/platform.css` recebeu os estados visuais de origem.

#### Validado
- Validador de origem cria handoffs de proposta, trilha, sinal e pacote importado e confirma metricas por origem.
- Fluxos de proposta para handoff, sinais de retomada e fila admin continuam `ok: true`.

---

## [v8.32.0] - 2026-05-07

### Saneamento de rotas curtas da jornada

#### Adicionado
- Criado `tools/validate-route-aliases.mjs` para validar paridade entre paginas HTML e aliases curtos do servidor.

#### Modificado
- `server.js` passou a expor aliases curtos para as 7 paginas que ainda dependiam apenas de `/pages/<arquivo>.html`.
- `docs/MAPA_COMPLETO_PROJETO_BANK_FRATERN.md` foi atualizado para registrar 51 paginas e 51 aliases.
- `docs/PLANO_ACAO_EVOLUCAO_BANK_FRATERN.md` passou a marcar a primeira entrega da Fase 1 como concluida.

#### Validado
- Todas as 51 paginas possuem alias curto correspondente no servidor local.
- Validador de aliases retorna `ok: true`.

---

## [v8.31.0] - 2026-04-27

### Proposta revisada conectada ao handoff consultivo

#### Adicionado
- `assets/js/services/handoff-consultivo.service.js` ganhou `findByProposal()` e `createFromProposal()`.
- A etapa 9 de `pages/simulador.html` passou a carregar o servico de handoff consultivo.
- `js/app.js` ganhou a ponte visual `data-proposal-handoff-bridge` e a acao `criarHandoffProposta()`.
- Criado `tools/validate-proposal-handoff.mjs`.
- Criado `tools/run-v8af-browser-evidence.mjs` para gerar evidencias visuais desktop/mobile do fluxo.

#### Modificado
- Handoffs agora preservam origem da proposta, status, versao, validade, resumo financeiro e checklist herdado da revisao.
- Auditoria local registra `proposal-create` e `proposal-refresh` sem envio externo.
- `tools/validate-design-system.mjs` passou a exigir o contrato proposta -> handoff.

#### Validado
- Revisao completa cria lead local na fila consultiva.
- Segunda execucao atualiza o handoff existente sem duplicar.
- A ponte visual diferencia proposta pendente, proposta revisada e handoff ja criado.
- Evidencias visuais salvas em `docs/test-prints/v8af-*`.

---

## [v8.30.0] - 2026-04-27

### Aceite local e versionamento da proposta

#### Adicionado
- Criado `js/proposal-acceptance.js` para registrar revisoes locais da proposta em `localStorage`.
- `pages/simulador.html` ganhou o painel `data-proposal-acceptance-panel` na etapa de Proposta Comercial.
- `js/proposal-summary.js` ganhou a secao `ps-section--acceptance`, exibida tambem no PDF exportado.
- Criado `tools/validate-proposal-acceptance.mjs`.

#### Modificado
- `js/app.js` passou a salvar, limpar e renderizar revisao da proposta com status, validade, checklist e historico local.
- `js/storage.js` passou a preservar `proposalAcceptance` no payload da simulacao salva.
- `tools/validate-design-system.mjs` passou a exigir o contrato de aceite local da proposta.
- `css/styles.css` recebeu estilos para painel de revisao, historico local e bloco de aceite no PDF.

#### Validado
- Revisao pendente, parcial e completa retornam status corretos.
- Segunda revisao incrementa versao local.
- Preview da etapa 9 e PDF mostram a mesma governanca da proposta.

---

## [v8.29.0] - 2026-04-27

### Proposta comercial e PDF espelhado

#### Adicionado
- `pages/simulador.html` ganhou nota de exportacao explicando que preview e PDF usam o mesmo componente visual.
- `js/proposal-summary.js` ganhou o bloco "Blocos que conversam entre si", conectando decisao, caixa, lance e risco aos graficos e proximos passos.
- `js/export.js` passou a exportar a proposta por blocos `.ps-print-page`, preservando secoes narrativas e evitando cortes arbitrarios entre informacoes e graficos.

#### Modificado
- `js/app.js` agora renderiza a etapa de Proposta Comercial com `ProposalSummary.render()` em `#proposal-export-root`.
- O PDF agora prioriza a raiz `#proposal-export-root` e usa `#proposal-summary-print-root` apenas como fallback.
- A impressao passa a aceitar a raiz ativa da proposta, mantendo o mesmo DOM do preview.
- `css/styles.css` recebeu estilos para os novos blocos conversacionais e para captura PDF responsiva.

#### Validado
- Sintaxe JS validada em `js/proposal-summary.js`, `js/export.js` e `js/app.js`.
- O contrato de PDF agora preserva cabecalho, resumo, blocos narrativos, graficos, cronograma e disclaimer como blocos independentes.

---

## [v8.28.0] - 2026-04-27

### Home com hero contextual

#### Adicionado
- `pages/index.html` ganhou marcadores `data-home-hero-contextual`, `data-home-hero-primary` e `data-home-hero-context-strip`.
- `js/home.js` ganhou `BFHome.renderContextualHero()` e `BFHome.buildHeroContext()`.
- Criado `tools/validate-home-contextual-hero.mjs`.

#### Modificado
- A primeira dobra da Home agora muda mensagem, CTAs, origem e painel lateral conforme prontidao, ultima calculadora e simulacao salva.
- O CTA principal abre custos fixos para perfil vazio, simulador com deep link quando o perfil esta pronto, e carteira quando ja existe simulacao salva.
- `tools/validate-design-system.mjs` passou a exigir o contrato do hero contextual e o novo validador v8AC.

#### Validado
- Hero sem perfil recomenda diagnostico inicial.
- Hero com perfil pronto preserva `calculatorSlug` e `historyId` no deep link do simulador.
- Hero com simulacao salva aponta para carteira e revisao da simulacao sem renderizar dados pessoais.

---

## [v8.27.0] - 2026-04-27

### Home como cockpit de continuidade

#### Adicionado
- `pages/index.html` ganhou o bloco `data-home-continuity-cockpit` para retomar jornada a partir do estado local.
- A Home agora carrega `decision-context.service.js` e usa perfil financeiro compartilhado.
- `js/home.js` ganhou `BFHome.renderContinuityCockpit()` e `BFHome.buildContinuityModel()`.
- Criado `tools/validate-home-continuity-cockpit.mjs`.

#### Modificado
- A navegacao principal passou a apontar para a area de continuidade.
- O cockpit mostra prontidao, historico de calculadoras, simulacoes salvas, capacidade estimada e proximos passos recomendados.
- `tools/validate-design-system.mjs` passou a exigir os marcadores de continuidade da Home e o novo validador v8AB.

#### Validado
- Home le perfil, historico e simulacao local sem expor CPF, telefone ou e-mail.
- Prontidao local aparece como metrica e recomenda continuidade de calculadora/comparador.
- Contrato estatico e renderizacao em ambiente browser-like retornam `ok: true`.

---

## [v8.26.0] - 2026-04-27

### Roteamento por carteira e metas de conversao

#### Adicionado
- `BFAdminRecoveryService.routeImportedItems()` roteia itens importados pendentes para consultores ativos.
- `BFAdminRecoveryService.conversionScoreboard()` consolida carteira, pendencias, handoffs, metas e progresso por consultor.
- `BFAdminRecoveryService.saveConversionGoal()` e `conversionGoals()` persistem metas locais por responsavel.
- Dashboard Admin ganhou o bloco `data-admin-package-routing`, acao `data-admin-package-route` e metas editaveis por consultor.
- Criado `tools/validate-admin-recovery-routing-goals.mjs`.

#### Modificado
- Itens importados agora preservam `routeName`, `routeStrategy`, `routedAt` e `conversionGoalId`.
- A auditoria registra `import-item-route`, `import-routing-run` e `conversion-goal-save`.
- `tools/validate-design-system.mjs` passou a exigir o painel de roteamento e o validador v8AA.

#### Validado
- Roteamento rebalanceado distribui itens em ao menos dois consultores ativos.
- Metas por consultor alimentam o placar de conversao.
- Handoff criado a partir de item roteado atualiza progresso de meta sem duplicar lead.
- Pacotes roteados seguem sem senha, telefone ou CPF.

---

## [v8.25.0] - 2026-04-26

### Filtros e SLA dos itens importados

#### Adicionado
- `BFAdminRecoveryService.importedItemsSummary()` consolida itens recebidos, atribuidos, convertidos em handoff e vencidos.
- Itens importados agora carregam SLA local por prioridade: alta 4h, media 24h e baixa 72h.
- Dashboard Admin ganhou filtros dedicados para itens importados por busca, status, responsavel, prioridade e SLA.
- Criado `tools/validate-admin-recovery-package-sla-filters.mjs`.

#### Modificado
- `BFAdminRecoveryService.importedItems()` passou a aceitar filtros de `status`, `assignedTo`, `severity`, `sla`, `packageId` e `search`.
- Cards de itens recebidos exibem idade do item e situacao de SLA.
- `tools/validate-design-system.mjs` passou a exigir os filtros de itens importados e o validador v8Z.

#### Validado
- Pacote antigo entra como SLA vencido e pacote recente entra no prazo.
- Filtros por SLA, status, responsavel, prioridade e busca retornam subconjuntos esperados.
- Item atribuido e depois convertido em handoff passa a aparecer como concluido.
- Pacotes com SLA seguem sem senha, telefone ou CPF.

---

## [v8.24.0] - 2026-04-26

### Operacao de itens importados da recuperacao

#### Adicionado
- `BFAdminRecoveryService.importedItems()` lista itens recebidos por pacotes com status operacional.
- `BFAdminRecoveryService.assignImportedItem()` atribui responsavel ao item importado.
- `BFAdminRecoveryService.createHandoffFromImportedItem()` cria ou atualiza handoff consultivo a partir do item recebido.
- Dashboard Admin ganhou a area `data-admin-recovery-imported-items` dentro da governanca de pacotes.
- Criado `tools/validate-admin-recovery-package-operations.mjs`.

#### Modificado
- A governanca de pacotes agora mostra pendencias, handoffs gerados, responsavel por item e acao direta para handoff.
- A auditoria administrativa registra `import-item-assign`, `import-item-handoff` e falhas de handoff.
- `tools/validate-design-system.mjs` passou a exigir o validador v8Y e os marcadores de operacao de itens importados.

#### Validado
- Item importado inicia como `recebido`, pode ser atribuido e depois convertido em handoff.
- Reprocessar o mesmo item atualiza o handoff existente sem duplicar lead.
- Pacotes operacionais continuam sem senha, telefone ou CPF.

---

## [v8.23.0] - 2026-04-26

### Governanca de pacotes administrativos de recuperacao

#### Adicionado
- `BFAdminRecoveryService.importPackage()` aceita pacotes JSON exportados e registra importacao local controlada.
- `BFAdminRecoveryService.validatePackage()`, `importedPackages()` e `audit()` expõem validacao, historico de pacotes e auditoria.
- Dashboard Admin ganhou o bloco `data-admin-recovery-packages` com importacao manual, pacotes recebidos e trilha de auditoria.
- Criado `tools/validate-admin-recovery-package-governance.mjs`.

#### Modificado
- `BFAdminRecoveryService.exportPackage()` passou a usar schema publico constante e registrar evento de auditoria local.
- `tools/validate-design-system.mjs` passou a exigir o painel de governanca e o validador v8X.
- A exportacao da fila agora alimenta tambem a visao de pacotes recebidos/importados.

#### Validado
- Pacote exportado por severidade alta e importado por JSON sem dados bloqueados.
- Importacao duplicada reconhecida sem duplicar pacote.
- Pacote com schema invalido recusado e auditado.
- Auditoria registra export, import, import-duplicate e import-rejected.

---

## [v8.22.0] - 2026-04-26

### Filtros e exportacao da fila administrativa de recuperacao

#### Adicionado
- `BFAdminRecoveryService` ganhou filtros por responsavel, status, severidade, etapa e busca textual.
- `BFAdminRecoveryService.exportPackage()` gera pacote JSON local com schema, filtros, resumo e itens sanitizados.
- Dashboard Admin ganhou controles operacionais dentro de `data-admin-recovery-queue`.
- Criado `tools/validate-admin-recovery-filters-export.mjs`.

#### Modificado
- `assets/js/admin-users.js` renderiza filtros da fila e botao `Exportar pacote`.
- A exportacao prepara um JSON local com a mesma regra de filtro aplicada na tela.
- `tools/validate-design-system.mjs` passou a exigir o validador v8W.

#### Validado
- Filtros por consultor, status, prioridade, etapa e busca retornam subconjuntos esperados.
- Depois de criar handoff, a fila aberta reduz e o filtro `handoff-criado` encontra o lead relacionado.
- Export filtrado preserva `queueStatus`, inclui resumo e bloqueia credenciais/telefone/CPF.

---

## [v8.21.0] - 2026-04-26

### Fila administrativa de recuperacao por consultor

#### Adicionado
- Criado `assets/js/services/admin-recovery.service.js` para transformar sinais de retomada em fila administrativa.
- Criado `tools/validate-admin-recovery-queue.mjs` para validar fila, responsavel sugerido e criacao de handoff.
- `pages/dashboard-admin.html` ganhou `data-admin-recovery-queue` como bloco proprio de recuperacao.
- Dashboard Admin passou a carregar `journey-recovery.service.js` e `admin-recovery.service.js`.

#### Modificado
- `assets/js/admin-users.js` mostra retomadas com aging, etapa, severidade, cliente e consultor sugerido.
- O card executivo de Leads no Admin agora considera retomadas abertas junto da fila de handoff.
- `BFHandoffConsultivoService.createFromSignal()` aceita `assignedTo`, preservando o responsavel sugerido no lead criado.
- `tools/validate-design-system.mjs` passou a exigir a fila administrativa e o novo validador.

#### Validado
- Fila com sinais de selecao, comparador, decisao e simulador pronto.
- Pool de consultores ativos ignora consultores inativos.
- Criacao de handoff a partir da fila preserva `sourceSignalId`, cliente, prioridade e `assignedTo`.
- A fila aberta reduz quando o handoff e criado, mantendo o item marcado na visao completa.

---

## [v8.20.0] - 2026-04-26

### Retomadas priorizadas no Dashboard Cliente e Handoff

#### Adicionado
- Criado `assets/js/services/journey-recovery.service.js` para transformar microconversoes em sinais de retomada.
- Criado `tools/validate-recovery-signals-flow.mjs` para validar abandono e handoff por sinais em Node.
- Dashboard Cliente ganhou o bloco `data-client-recovery-signals` com retomadas recomendadas.
- Handoff Consultivo ganhou o bloco `data-handoff-recovery-signals` com criacao de handoff a partir de sinal.
- `BFHandoffConsultivoService` passou a expor `findBySignal()` e `createFromSignal()`.

#### Modificado
- `assets/js/client-dashboard.js` prioriza sinais de Produtos, Comparador e Simuladores no card de continuidade.
- `assets/js/handoff-consultivo.js` mostra sinais abertos junto da fila e permite criar/abrir handoff relacionado.
- `tools/validate-design-system.mjs` passou a exigir o servico de retomada e os novos pontos de UI.

#### Validado
- Fluxos validados: selecao sem comparador, comparador sem matriz, decisao sem continuidade, cenario salvo sem simulador e simulador pronto.
- Sinal prioritario cria handoff local, preserva `sourceSignalId`, prioridade, owner, CTA e checklist.
- Reexecucao do mesmo sinal atualiza o lead existente em vez de duplicar a fila.

---

## [v8.19.0] - 2026-04-26

### Governanca funcional de Produtos, Comparador e Simuladores leves

#### Adicionado
- Criado `tools/validate-product-journey-flow.mjs` para validar a jornada Produtos -> Comparador -> Simuladores leves em Node.
- O teste executa recomendacao de produtos, modelo padrao recomendado, matriz completa do comparador e calculos dos simuladores leves.
- Relatorio de contrato gerado em `docs/test-reports/v8t-product-journey-flow-report.json`.

#### Modificado
- `tools/validate-design-system.mjs` passou a exigir o novo validador como arquivo obrigatorio.
- Protocolo de testes documenta a fase v8T sem prints, mantendo foco em contrato funcional e checkpoint.
- Plano evolutivo registra a expansao da governanca alem das calculadoras.

#### Validado
- Fluxo validado: Top 3 de produtos -> abertura do comparador -> matriz calculada -> cenario salvo -> abertura de simulador -> 6 simuladores calculados.
- `BFJourneyAnalytics.summary()` valida selecao, comparador, cenario salvo, simuladores e conversao positiva.
- A matriz completa cobre financiamento, consorcio, CDC, garantia, consignado e consumo.

---

## [v8.18.0] - 2026-04-26

### Governanca funcional da jornada sem prints

#### Adicionado
- Criado `tools/validate-decision-flow.mjs` para validar a jornada calculadora -> contexto -> simulador -> historico em Node.
- O teste executa scripts reais em ambiente browser-like com `localStorage`, `fetch`, `location` e `vm`.
- Relatorio de contrato gerado em `docs/test-reports/v8s-decision-flow-report.json`.

#### Modificado
- `tools/validate-design-system.mjs` passou a exigir o novo validador como arquivo obrigatorio.
- Protocolo de testes documenta a fase v8S sem prints.
- Plano evolutivo registra a fase de governanca funcional.

#### Validado
- `tools/validate-decision-flow.mjs` retornou `ok: true`.
- Fluxo validado: perfil vazio -> capacidade de credito -> lance em consorcio -> deep link -> simulacao salva -> evento `simulador-consorcio`.
- Snapshot e perfil compartilhado validam bloqueio de dados pessoais.

---

## [v8.17.0] - 2026-04-26

### Calculadoras conectadas a jornada de simulacao

#### Adicionado
- Criado `BFDecisionContext` com perfil compartilhado, prontidao, recomendacoes, prefill e auditoria local.
- Adicionadas as calculadoras `capacidade-credito` e `lance-consorcio`.
- `pages/simulador.html` ganhou painel de prontidao e deep links `from=calculator` e `from=journey`.
- Simulacoes salvas agora persistem `decisionContext` e gravam evento `simulador-consorcio` no historico financeiro.

#### Modificado
- Hub de calculadoras destaca a trilha minima de diagnostico antes da simulacao.
- Dashboard Cliente passou a mostrar a continuidade diagnostico -> calculadora -> simulacao -> carteira/handoff.
- `tools/validate-calculadoras.mjs` valida 19 calculadoras e 12 golden tests.
- `tools/validate-design-system.mjs` valida o contrato de contexto financeiro nas paginas criticas.

#### Validado
- `node --check` nos JS alterados.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- Evidencias do ciclo v8R devem ficar em `docs/test-prints/v8r-*`.

---

## [v8.16.0] - 2026-04-26

### Alertas operacionais de SLA e abandono

#### Adicionado
- `pages/dashboard-admin.html` ganhou a secao `data-admin-operational-alerts`.
- `assets/js/admin-users.js` cruza `BFJourneyAnalytics.all()` com a fila `BFHandoffConsultivoService.list()`.
- O Dashboard Admin agora identifica selecao sem comparador, comparador sem matriz, decisao sem continuidade e handoffs fora do SLA local.
- A stagebar administrativa ganhou a etapa Alertas entre Funil e Leads.
- `tools/validate-design-system.mjs` passou a exigir alertas operacionais no contrato v8 do Admin.

#### Modificado
- `assets/css/platform.css` recebeu cards, score, metricas e responsividade para os alertas.
- O painel admin passou a exibir severidade, origem, idade do sinal e CTA de retomada.

#### Validado
- `node --check` em `assets/js/admin-users.js`, `assets/js/bf-platform.js` e `tools/validate-design-system.mjs`.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Teste headless confirmou alertas de abandono e SLA, com ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8q-*.png` e `docs/test-prints/v8q-admin-alertas-report.json`.

---

## [v8.15.0] - 2026-04-26

### Funil administrativo de microconversoes

#### Adicionado
- `pages/dashboard-admin.html` ganhou a secao `data-admin-journey-funnel`.
- `window.BFJourneyAnalytics` passou a expor `all()` e `roleFunnel()` para consolidar eventos de todos os usuarios locais.
- `assets/js/admin-users.js` renderiza funil por etapa: selecao, comparador, matriz, salvos e simuladores.
- O Dashboard Admin separa sinais por papel: cliente, consultor, admin, anonimo e desconhecido.
- `tools/validate-design-system.mjs` passou a exigir o funil administrativo no contrato v8.

#### Modificado
- A stagebar do Dashboard Admin ganhou a etapa Funil.
- O painel administrativo agora mostra eventos recentes com origem, papel, usuario e data.

#### Validado
- `node --check` em `assets/js/bf-platform.js`, `assets/js/admin-users.js` e `tools/validate-design-system.mjs`.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Teste headless confirmou 11 eventos consolidados, 5 etapas de funil, papeis cliente/consultor/admin/anonimo e ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8p-*.png` e `docs/test-prints/v8p-admin-funil-report.json`.

---

## [v8.14.0] - 2026-04-26

### Microconversoes locais da jornada Produtos, Comparador e Simuladores

#### Adicionado
- Criada a chave local `bf_journey_analytics_v1:<usuario>` para medir eventos de jornada no navegador.
- `window.BFJourneyAnalytics` passou a expor `list`, `record`, `summary` e `render`.
- `pages/produtos.html`, `pages/comparador.html` e `pages/dashboard-cliente.html` ganharam bloco `data-journey-analytics`.
- Produtos agora registra selecao, remocao, uso de Top 3, limpeza e abertura do Comparador.
- Comparador registra carregamento vindo de Produtos, matriz calculada, cenario salvo e abertura de simulador.
- Simuladores leves registram calculos de financiamento, CDC, garantia, consignado e veiculos.

#### Modificado
- O Dashboard Cliente passa a exibir um painel de microconversoes locais para acompanhar continuidade real da jornada.
- `tools/validate-design-system.mjs` passou a exigir metricas locais em Produtos, Comparador e Dashboard Cliente.

#### Validado
- `node --check` em `assets/js/bf-platform.js` e `tools/validate-design-system.mjs`.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Fluxo headless confirmou Produtos -> Comparador -> Salvar cenario -> Simulador -> Dashboard com 7 eventos locais.
- Evidencias salvas em `docs/test-prints/v8o-*.png` e `docs/test-prints/v8o-jornada-analytics-report.json`.

---

## [v8.13.0] - 2026-04-26

### Produtos com selecao assistida e ponte manual para o Comparador

#### Adicionado
- `pages/produtos.html` ganhou o painel `data-products-selection-panel` entre filtros e catalogo.
- Cards de produtos agora exibem estado selecionado, botao de selecao e destaque visual.
- A selecao fica persistida em `localStorage` por usuario e respeita limite de 4 produtos.
- O link para o Comparador passa a abrir `comparador.html?preset=manual&products=...` quando ha selecao ativa.
- `pages/comparador.html` agora reconhece `products`/`produtos` na URL e ativa as colunas correspondentes.

#### Modificado
- O resumo de Produtos passou a mostrar quantidade selecionada.
- A ponte de decisao de Produtos diferencia preset automatico de selecao assistida.
- O resumo de presets do Comparador mostra os produtos vindos do catalogo quando a matriz e aberta por selecao manual.

#### Validado
- `node --check` em `assets/js/bf-platform.js`, `assets/js/components/cards.js` e `tools/validate-design-system.mjs`.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.

---

## [v8.12.0] - 2026-04-26

### Saneamento visual dos CSS legados e guarda de encoding

#### Adicionado
- `tools/validate-design-system.mjs` passou a reprovar paginas ativas com sinais de mojibake visual.
- `tools/validate-design-system.mjs` passou a monitorar `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css` como CSS ASCII.
- `pages/assembleias.html` ganhou favicon SVG e a stagebar passou a ter 5 itens, incluindo Decisao.

#### Corrigido
- `css/home.css` e `css/shared-site.css` tiveram comentarios e separadores normalizados para ASCII.
- Corrigidos dois icones com encoding quebrado em `pages/assembleias.html`.
- Corrigido comentario com encoding quebrado em `pages/simulador.html`.
- Preservado o comportamento visual validado da Home, Produtos, paginas institucionais, Configuracoes, Assembleias e Simulador.

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true` com 46 paginas ativas, 3 legados controlados, 19 paginas criticas e 25 paginas densas.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- `css/home.css`, `css/shared-site.css` e `assets/css/bf-design-system-v8.css` retornaram `nonAscii=0`.
- HTTP 200 confirmado para Produtos, Home, Sobre, Duvidas, Configuracoes, Assembleias e Simulador.
- Edge headless confirmou Produtos desktop/mobile, Home desktop/mobile, Sobre desktop, Duvidas mobile, Configuracoes mobile, Assembleias desktop e Simulador desktop sem overflow horizontal, sem encoding visual quebrado e sem erros de console.
- Evidencias salvas em `docs/test-prints/v8m-*.png`.
- Relatorio salvo em `docs/test-prints/v8m-css-saneamento-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.12-css-saneamento-final.zip`.

---

## [v8.11.0] - 2026-04-26

### Home, Sobre, Duvidas e Configuracoes alinhadas ao contrato v8

#### Adicionado
- `pages/index.html` ganhou stagebar institucional, `data-home-decision-strip` e `data-home-institutional-timeline`.
- `pages/sobre-nos.html` foi reestruturada como pagina institucional v8 com hero, decision strip, timeline, pilares e CTAs de continuidade.
- `pages/duvidas.html` foi reestruturada como central de duvidas v8 com FAQ por blocos, resumo de orientacao, timeline e limites de uso.
- `pages/configuracoes.html` foi reestruturada como tela de governanca local, com stagebar, `data-settings-decision-strip`, `data-settings-timeline`, chips de preferencias ativas e formulario de defaults.
- `assets/css/bf-design-system-v8.css` passou a cobrir `institutional-journey-page` e `settings-page`.
- `tools/validate-design-system.mjs` passou a validar Home, Sobre, Duvidas e Configuracoes como paginas densas do contrato v8.

#### Corrigido
- Removido encoding quebrado visivel em Sobre, Duvidas e Configuracoes.
- Adicionados favicons SVG nas paginas institucionais revisadas.
- Corrigido overflow horizontal da Home no mobile causado pelo footer apos a inclusao do link "Design system".

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true` com 46 paginas ativas, 3 legados controlados, 19 paginas criticas e 25 paginas densas.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 confirmado para Home, Sobre, Duvidas e Configuracoes.
- Edge headless confirmou stagebar com 5 itens, 4 cards de decisao, 5 itens de timeline, ausencia de overflow horizontal, ausencia de encoding quebrado e ausencia de erros de console em desktop/mobile.
- Configuracoes renderizou 8 chips ativos e salvamento local durante o teste headless.
- Evidencias salvas em `docs/test-prints/v8l-*.png`.
- Relatorio salvo em `docs/test-prints/v8l-institucional-configuracoes-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.11-institucional-configuracoes-final.zip`.

---

## [v8.10.0] - 2026-04-26

### Camada institucional de confianca e catalogo de componentes v8

#### Adicionado
- Criada a pagina `pages/componentes-v8.html` como catalogo vivo de tokens, stagebar, decision strip, timeline, cards, badges, formulario, metricas e tabela.
- `pages/educacao.html`, `pages/compliance.html`, `pages/dados-abertos.html` e `pages/api-docs.html` receberam stagebar v8, `data-trust-decision-strip` e `data-trust-timeline`.
- `js/shared-layout.js` passou a tratar `componentes-v8.html` como pagina institucional e adicionou link de navegacao "Design" no header e no footer.
- `assets/css/bf-design-system-v8.css` recebeu estilos para `trust-page`, `component-catalog-page`, swatches, samples e grids responsivos.
- `tools/validate-design-system.mjs` passou a validar paginas institucionais de confianca e o catalogo de componentes como parte do contrato v8.

#### Corrigido
- Corrigido o link interno do catalogo para a documentacao `docs/DESIGN_SYSTEM_V8_BANK_FRATERN.md`.
- Padronizados favicons e classes de body nas paginas institucionais atualizadas.

#### Validado
- `node --check js/shared-layout.js` retornou sem erros.
- `node --check tools/validate-design-system.mjs` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 46 paginas ativas, 3 legados controlados, 18 paginas criticas e 21 paginas densas.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 confirmado para Educacao, Compliance, Dados Abertos, API Docs e Componentes v8.
- Edge headless confirmou stagebar com 5 itens, 4 cards de decisao, 5 itens de timeline, ausencia de overflow horizontal e ausencia de erros de console nas rotas testadas.
- Evidencias salvas em `docs/test-prints/v8k-*.png`.
- Relatorio salvo em `docs/test-prints/v8k-confianca-componentes-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.10-confianca-componentes-final.zip`.

---

## [v8.9.0] - 2026-04-26

### Portas de entrada e simuladores leves com jornada completa

#### Adicionado
- `pages/produtos.html` ganhou stagebar v8, `data-products-decision-strip` e `data-products-bridge-timeline` para conectar perfil, filtros, catalogo, comparador e dashboard.
- `pages/calculadoras.html` ganhou stagebar v8, `data-calculators-decision-strip` e `data-calculators-bridge-timeline` para ligar perfil, historico, 17 calculadoras, comparador e continuidade.
- As 17 paginas `pages/calculadora-*.html` ganharam stagebar, `data-calculator-decision-strip` e `data-calculator-bridge-timeline`.
- `pages/simulador-financiamento.html`, `pages/simulador-cdc.html`, `pages/simulador-garantia.html`, `pages/simulador-consignado.html` e `pages/simulador-veiculos.html` ganharam stagebar, `data-light-simulator-decision-strip` e `data-light-simulator-timeline`.
- `pages/simulador-consorcio.html` foi transformada em ponte visual para o simulador completo, com os passos de base real, prateleira, resultado, proposta e carteira.
- `assets/js/bf-platform.js` passou a renderizar a ponte dos simuladores leves e salvar cenario local no historico financeiro.
- `assets/js/calculadoras-page.js` passou a renderizar pontes dinamicas no hub e nas calculadoras individuais.
- `tools/validate-design-system.mjs` passou a validar Produtos, Calculadoras, 17 calculadoras e 6 simuladores leves com stagebar, decision strip e timeline.

#### Corrigido
- Adicionados favicons SVG em Produtos, Calculadoras, calculadoras individuais e simuladores leves para evitar 404 visual em testes.
- Simulador de Veiculos agora segue a mesma linguagem das demais etapas de decisao e mostra continuidade para comparador/dashboard.

#### Validado
- `node --check assets/js/bf-platform.js` retornou sem erros.
- `node --check assets/js/calculadoras-page.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 16 paginas densas declaradas e as calculadoras individuais validadas por contrato proprio.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 confirmado para Produtos, Calculadoras, uma calculadora individual e os 6 simuladores leves.
- Edge headless confirmou stagebar com 5 itens, 4 cards de decisao, 5 itens de timeline e ausencia de overflow horizontal nas rotas testadas em desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8j-*.png`.
- Relatorio salvo em `docs/test-prints/v8j-portas-simuladores-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.9-portas-simuladores-etapas-completas-final.zip`.

---

## [v8.8.0] - 2026-04-26

### Comparador como ponte visual de decisao

#### Adicionado
- `pages/comparador.html` ganhou stagebar v8 com 5 etapas: Perfil, Entrada, Decisao, Memoria e Continuidade.
- `pages/comparador.html` ganhou o bloco `data-comparator-decision-strip` para resumir entrada, decisao recomendada, risco principal e saida operacional.
- `pages/comparador.html` ganhou `data-comparator-bridge-timeline` para conectar perfil financeiro, matriz, decisao, memoria de calculo e dashboard/handoff.
- `assets/js/bf-platform.js` passou a renderizar a ponte visual do comparador a cada recalculo da matriz, usando resultado real do `BFComparadorService`.
- `assets/js/bf-platform.js` passou a expor `document.body.dataset.comparatorBridgeReady`, `data-comparator-decision` e `data-comparator-compared-count` para testes de jornada.
- `assets/css/bf-design-system-v8.css` recebeu ajustes para `decision-comparator-page`.
- `tools/validate-design-system.mjs` passou a exigir stagebar, ponte de decisao e timeline em `comparador.html`.

#### Corrigido
- Adicionado favicon SVG no Comparador para evitar 404 de recurso padrao em testes headless.
- A memoria de calculo do Comparador agora tem ancora `#memoria-comparador`, mantendo a navegacao da stagebar coerente.

#### Validado
- `node --check assets/js/bf-platform.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 8 paginas densas cobertas por stagebar.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Edge headless confirmou HTTP 200, 5 etapas, 4 cards de ponte, 5 itens na timeline, 3 cards de comparacao, salvamento no historico local e ausencia de overflow horizontal em desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8i-comparador-ponte-desktop.png` e `docs/test-prints/v8i-comparador-ponte-mobile.png`.
- Relatorio salvo em `docs/test-prints/v8i-comparador-ponte-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.8-comparador-ponte-decisao-final.zip`.

---

## [v8.7.0] - 2026-04-26

### Trilha de Decisao como ponte central da jornada

#### Adicionado
- `pages/trilha-decisao.html` ganhou stagebar v8 com 5 etapas: Diagnostico, Ponte, Continuidade, Acao e Handoff.
- `pages/trilha-decisao.html` ganhou `data-journey-bridge-strip` para resumir Diagnostico, Produto/Modelo, Comparador e Handoff em uma leitura unica.
- `pages/trilha-decisao.html` ganhou `data-journey-bridge-timeline` para mostrar a continuidade entre perfil financeiro, produto, modelo, comparador e atendimento.
- `assets/js/trilha-decisao.js` passou a renderizar cards e timeline da ponte a partir da trilha ativa, perfil, produto recomendado, modelo recomendado, proxima acao e handoff local.
- `assets/css/bf-design-system-v8.css` recebeu ajustes para a pagina `decision-journey-page`.
- `tools/validate-design-system.mjs` passou a exigir stagebar, ponte de decisao e timeline em `trilha-decisao.html`.

#### Corrigido
- Adicionado favicon SVG na Trilha para evitar 404 de recurso padrao em testes headless.
- A Trilha agora mostra a conexao com Dashboard Cliente e Handoff antes do formulario, reduzindo ruptura visual entre decisao e operacao.

#### Validado
- `node --check assets/js/trilha-decisao.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 7 paginas densas cobertas por stagebar.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Edge headless confirmou HTTP 200, 5 etapas, 4 cards de ponte, 5 itens na timeline, 5 passos de jornada, handoff conectado e ausencia de overflow horizontal em desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8h-trilha-ponte-desktop.png` e `docs/test-prints/v8h-trilha-ponte-mobile.png`.
- Relatorio salvo em `docs/test-prints/v8h-trilha-ponte-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.7-trilha-ponte-decisao-final.zip`.

---

## [v8.6.0] - 2026-04-26

### Handoff e Admin como area operacional v8

#### Adicionado
- `pages/handoff-consultivo.html` ganhou stagebar v8 com 5 etapas: Operacao, Leads, Checklist, Auditoria e Admin.
- `pages/handoff-consultivo.html` ganhou `data-handoff-operational-strip` com cards de Fila, Prioridade, Atendimento e Auditoria.
- `pages/handoff-consultivo.html` ganhou `data-handoff-audit-feed` para expor eventos recentes do handoff local.
- `assets/js/handoff-consultivo.js` passou a calcular resumo operacional a partir de leads filtrados, prioridade, status, checklist e auditoria local.
- `pages/dashboard-admin.html` ganhou stagebar v8 com 5 etapas: Operacao, Usuarios, Leads, Auditoria e Atendimento.
- `pages/dashboard-admin.html` ganhou `data-admin-operational-strip` com cards de Acessos, Leads, Modelos e Governanca.
- `assets/js/admin-users.js` passou a consolidar usuarios, handoffs, modelos de comparacao e auditoria em uma leitura administrativa.
- `assets/css/bf-design-system-v8.css` recebeu ajustes para Handoff/Admin, incluindo stagebar interna, decision strip operacional, detalhe sticky e tabela admin com comportamento mobile seguro.
- `tools/validate-design-system.mjs` passou a exigir stagebar e blocos operacionais em Handoff e Admin.

#### Corrigido
- Adicionado favicon SVG em Handoff e Admin para evitar 404 de recurso padrao nos testes.
- Handoff e Admin passaram a seguir a mesma linguagem visual das telas densas ja evoluidas: Simulador, Carteira, Assembleias e Dashboard Cliente.

#### Validado
- `node --check assets/js/handoff-consultivo.js` retornou sem erros.
- `node --check assets/js/admin-users.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 6 paginas densas cobertas por stagebar.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Edge headless confirmou HTTP 200, 5 etapas, 4 cards operacionais, lista de handoffs, auditoria local, resumo admin, tabela de usuarios e ausencia de overflow horizontal em desktop/mobile.
- Evidencias salvas em `docs/test-prints/v8g-handoff-operacional-desktop.png`, `docs/test-prints/v8g-handoff-operacional-mobile.png`, `docs/test-prints/v8g-admin-operacional-desktop.png` e `docs/test-prints/v8g-admin-operacional-mobile.png`.
- Relatorio salvo em `docs/test-prints/v8g-operacao-handoff-admin-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.6-operacao-handoff-admin-final.zip`.

---

## [v8.5.0] - 2026-04-26

### Dashboard Cliente como central de continuidade

#### Adicionado
- `pages/dashboard-cliente.html` ganhou stagebar v8 com 5 etapas: Continuidade, Perfil, Historico, Decisao e Handoff.
- Criado o bloco `data-client-continuity-strip` para consolidar perfil financeiro, historico, trilha assistida e handoff em uma leitura unica.
- Criada a linha do tempo `data-client-continuity-timeline` com estados progressivos para perfil, historico, modelo, trilha e atendimento.
- Criado o bloco `data-client-activity` para listar eventos recentes de simulador, calculadoras, modelos, trilha e handoff.
- `assets/js/client-dashboard.js` passou a montar um snapshot local da jornada do cliente usando `localStorage`, `Storage`, `BFCalculadoras`, `BFComparatorModels`, `BFTrilhaDecisaoService` e `BFHandoffConsultivoService`.
- `assets/css/bf-design-system-v8.css` recebeu estilos responsivos para timeline e atividade recente do cliente.
- `tools/validate-design-system.mjs` passou a exigir stagebar, central de continuidade e timeline em `dashboard-cliente.html`.

#### Corrigido
- Adicionado favicon SVG no Dashboard Cliente para evitar 404 de recurso padrao em testes headless.
- Dashboard Cliente agora mostra continuidade mesmo quando os blocos inferiores existem, evitando que o usuario precise procurar manualmente onde retomar.

#### Validado
- `node --check assets/js/client-dashboard.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true` com 4 paginas densas cobertas por stagebar.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Edge headless confirmou HTTP 200, 4 cards de continuidade, 5 etapas na stagebar, 5 itens na timeline, 4 atividades recentes, ausencia de overflow horizontal e ausencia de sequencias de encoding quebrado.
- Evidencias salvas em `docs/test-prints/v8f-dashboard-cliente-continuidade-desktop.png` e `docs/test-prints/v8f-dashboard-cliente-continuidade-mobile.png`.
- Relatorio salvo em `docs/test-prints/v8f-dashboard-cliente-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.5-dashboard-cliente-continuidade-final.zip`.

---

## [v8.4.0] - 2026-04-25

### Simulador como centro de decisao operacional

#### Adicionado
- `pages/simulador.html` ganhou o bloco `data-simulator-decision-strip` para resumir base, prateleira, resultado e continuidade em uma leitura consultiva.
- A stagebar do Simulador passou a ter 5 passos, incluindo a etapa `Decisao` e a retomada na Carteira.
- `js/app.js` passou a renderizar cards dinamicos de decisao a partir da base carregada, grupos filtrados, sacola/projeto, resultado calculado e simulacoes salvas.
- `assets/css/bf-design-system-v8.css` recebeu ajustes responsivos para o Simulador, incluindo stagebar de 5 colunas, decision strip externa e header mobile sem overflow.
- `tools/validate-design-system.mjs` agora exige o resumo de decisao operacional em `simulador.html`.

#### Corrigido
- Adicionado favicon SVG no Simulador para eliminar erro 404 de recurso padrao durante testes headless.
- Corrigida pluralizacao do card de continuidade: `0 simulacoes salvas`, `1 simulacao salva` e demais plurais.
- Ajustada a captura mobile para estabilizar apos o overlay de base real, preservando a demonstracao de carregamento sem esconder a decisao final.

#### Validado
- `node --check js/app.js` retornou sem erros.
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- Edge headless confirmou HTTP 200, 4 cards de decisao, 5 itens na stagebar, base real carregada com 17.396 grupos, overlay finalizado, ausencia de overflow horizontal e ausencia de sequencias de encoding quebrado.
- Evidencias salvas em `docs/test-prints/v8e-simulador-decisao-desktop-visible.png` e `docs/test-prints/v8e-simulador-decisao-mobile-visible.png`.
- Relatorio salvo em `docs/test-prints/v8e-simulador-decisao-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.4-simulador-decisao-operacional-final.zip`.

---

## [v8.3.0] - 2026-04-25

### Carteira orientada a decisao operacional

#### Adicionado
- `pages/carteira.html` ganhou o bloco `data-portfolio-decision-strip` para orientar prioridade, pipeline, agenda e oportunidade comercial.
- O hero da Carteira agora leva diretamente para `#decisao-carteira`.
- A stagebar da Carteira passou a ter 5 passos, incluindo a etapa de decisao operacional.
- `js/portfolio-live.js` passou a calcular os cards de decisao usando os filtros atuais, simulacoes salvas, registros em risco, proxima agenda e maior oportunidade.
- `assets/css/bf-design-system-v8.css` recebeu ajustes responsivos para a stagebar de Carteira e tabela operacional mobile sem overflow horizontal.
- `tools/validate-design-system.mjs` agora exige o resumo de decisao operacional em `carteira.html`.

#### Corrigido
- Normalizacao UTF-8 de `pages/carteira.html` e remocao de icones decorativos que apareciam como texto corrompido na tela.
- Tabela operacional da Carteira recebeu leitura compacta no mobile para evitar largura fantasma em screenshots e uso real.

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 para `pages/carteira.html`, `js/portfolio-live.js` e `assets/css/bf-design-system-v8.css`.
- Edge headless confirmou 4 cards de decisao, 5 itens na stagebar, CTA principal correto, ausencia de overflow horizontal em desktop/mobile e ausencia de sequencias de encoding quebrado.
- Evidencias salvas em `docs/test-prints/v8d-carteira-decisao-desktop.png` e `docs/test-prints/v8d-carteira-decisao-mobile.png`.
- Relatorio salvo em `docs/test-prints/v8d-carteira-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.3-carteira-decisao-operacional-final.zip`.

---

## [v8.2.0] - 2026-04-25

### Monitor de assembleias orientado a decisao

#### Adicionado
- `pages/assembleias.html` ganhou o bloco `data-assembly-decision-strip` com quatro cards de decisao: prioridade, fila comercial, faturamento e liquidez do grupo.
- O hero do monitor recebeu CTA direto para a decisao operacional.
- `assets/css/bf-design-system-v8.css` recebeu estilos para `bf-v8-decision-strip`, cards de decisao e refinamentos visuais de hero, KPIs, graficos, tabela e drawer do monitor.
- `tools/validate-design-system.mjs` agora exige o resumo de decisao operacional em `assembleias.html`.

#### Corrigido
- Normalizacao UTF-8 de `pages/assembleias.html`, removendo textos quebrados como `histÃ³rico`, `mÃ­nimo`, `contemplaÃ§Ãµes` e similares.

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 para `pages/assembleias.html`.
- Chrome headless confirmou 4 cards de decisao, stagebar v8, drawer lateral funcionando, ausencia de overflow horizontal e ausencia de sequencias de encoding quebrado.
- Evidencias salvas em `docs/test-prints/v8c-assembleias-*.png`.
- Relatorio salvo em `docs/test-prints/v8c-assembleias-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.2-assembleias-decisao-operacional-final.zip`.

---

## [v8.1.0] - 2026-04-25

### Continuidade visual nas telas densas

#### Adicionado
- Novo componente visual `bf-v8-stagebar` em `assets/css/bf-design-system-v8.css`.
- `pages/simulador.html` ganhou atalhos para base real, prateleira, resumo financeiro e retomada na carteira.
- `pages/carteira.html` ganhou trilha de continuidade entre simulacoes salvas, indicadores executivos, oportunidades e agenda comercial.
- `pages/assembleias.html` ganhou trilha de leitura entre historico executivo, contemplacoes, lances e tabela analitica.
- `tools/validate-design-system.mjs` agora valida que Simulador, Carteira e Assembleias possuem `data-v8-stagebar`.

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true`, agora cobrindo 3 paginas densas com stagebar obrigatoria.
- `tools/validate-calculadoras.mjs` retornou `ok: true`.
- HTTP 200 para Simulador, Carteira e Assembleias.
- Chrome headless gerou prints desktop/mobile das tres paginas sem overflow horizontal em `docs/test-prints/v8b-*.png`.
- Relatorio visual salvo em `docs/test-prints/v8b-stagebar-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.1-stagebar-telas-densas-final.zip`.

---

## [v8.0.0] - 2026-04-25

### Unificacao visual e jornada do usuario

#### Adicionado
- Nova camada canonica `assets/css/bf-design-system-v8.css` para padronizar superficie, cards, formularios, tabelas, badges, foco, loading, estados vazios, dashboards e paginas institucionais.
- `js/shared-layout.js` agora injeta automaticamente `assets/css/platform.css` e o design system v8 nas paginas com shell compartilhado.
- Paginas legadas prioritarias (`carteira`, `assembleias`, `duvidas`, `sobre-nos` e `configuracoes`) receberam contrato visual v8, `data-bf-page`, `data-bf-archetype` e `data-bf-visual-version`.
- Home e simulador principal passaram a carregar o v8 diretamente, mantendo seus fluxos especificos.
- Novo validador `tools/validate-design-system.mjs` para checar shell, viewport, identidade de pagina, contrato v8, arquivos obrigatorios e referencias locais.
- Nova documentacao `docs/DESIGN_SYSTEM_V8_BANK_FRATERN.md`.

#### Validado
- `tools/validate-design-system.mjs` retornou `ok: true`, com 45 paginas ativas, 3 legados controlados e 13 paginas criticas cobertas.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, preservando 17 calculadoras, 6 categorias e 10 golden tests.
- HTTP 200 para Home, Produtos, Calculadoras, Calculadora Juros Compostos, Comparador, Trilha, Dashboard Cliente, Handoff, Dashboard Admin, Simulador, Carteira, Assembleias, CSS v8 e shared layout.
- Chrome headless gerou 12 prints v8 em `docs/test-prints/`, todos com `data-bf-visual-version="8"` e sem overflow horizontal.
- Relatorio visual salvo em `docs/test-prints/v8-screenshot-report.json`.
- Checkpoint salvo em `versions/bank-fratern-v8.0-design-system-unificado-final.zip`.
- O runtime `node.exe` do PATH retornou `Acesso negado`; a validacao foi executada com o Node empacotado do Codex.

---

## [v7.17.0] - 2026-04-25

### Handoff consultivo e leads locais

#### Adicionado
- Novo servico `assets/js/services/handoff-consultivo.service.js` para transformar trilhas assistidas em leads locais com status, prioridade, checklist, responsavel, notas e auditoria.
- Nova pagina `pages/handoff-consultivo.html` para admin e consultor acompanharem a fila local.
- Novo script `assets/js/handoff-consultivo.js` com metricas, filtros, cards, detalhe, checklist, notas e timeline.
- `pages/trilha-decisao.html` ganhou acao `Gerar handoff local`, sem envio externo de dados.
- `pages/dashboard-cliente.html` passou a mostrar handoff vinculado a trilha e permitir criar/atualizar localmente.
- `pages/dashboard-admin.html` ganhou resumo da fila local de handoffs consultivos.
- `js/shared-layout.js` recebeu link de rodape para `Handoff consultivo`.
- Documentacao criada em `docs/HANDOFF_CONSULTIVO_LEADS.md`.

#### Validado
- HTTP 200 para pagina de handoff, novo servico, novo script, dashboards, CSS e documentacao.
- Sintaxe JS para arquivos novos e alterados.
- `tools/validate-calculadoras.mjs` com `ok: true`.
- Chrome headless confirmou criacao de handoff a partir da trilha, persistencia em `bf_consultive_handoffs_v1`, auditoria em `bf_consultive_handoff_audit_v1`, painel consultivo com lead, alteracao de status/checklist/nota, resumo no dashboard admin e mobile sem overflow.
- Evidencias salvas em `docs/test-prints/handoff-trilha-criado-desktop.png`, `handoff-consultivo-desktop.png`, `dashboard-admin-handoff-desktop.png` e `handoff-consultivo-mobile.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.17-handoff-consultivo-final.zip`.

---

## [v7.16.0] - 2026-04-25

### Trilha assistida de decisao

#### Adicionado
- Nova pagina `pages/trilha-decisao.html` para conduzir o usuario do diagnostico financeiro ate produto, modelo recomendado, comparador e proxima acao.
- Novo servico `assets/js/services/trilha-decisao.service.js` com normalizacao de perfil, ranking de produtos, recomendacao de modelo padrao, montagem de etapas e persistencia por usuario.
- Novo script `assets/js/trilha-decisao.js` para formulario, resumo da trilha, etapas, ranking de produtos, acoes e estado salvo.
- `pages/dashboard-cliente.html` ganhou bloco de trilha ativa com produto, modelo, reserva, capacidade segura e CTA de continuidade.
- `assets/js/client-dashboard.js` passou a consumir a trilha salva por usuario.
- `js/shared-layout.js` passou a incluir links para `Trilha` no header e no rodape.
- Documentacao criada em `docs/TRILHA_ASSISTIDA_DECISAO.md`.

#### Validado
- HTTP 200 para nova pagina, novo servico, novo script, dashboard e CSS.
- Sintaxe JS para arquivos novos e alterados.
- `tools/validate-calculadoras.mjs` com `ok: true`.
- Chrome headless confirmou trilha salva em `bf_decision_journey_v1:cliente@bankfratern.local`, recomendacao `std-liquidez-rapida`, produto `cdc`, comparador aberto com preset `obter_liquidez`, bloco ativo no dashboard e mobile sem overflow.
- Evidencias salvas em `docs/test-prints/trilha-decisao-desktop.png`, `trilha-decisao-comparador-desktop.png`, `dashboard-cliente-trilha-decisao-desktop.png` e `trilha-decisao-mobile.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.16-trilha-assistida-decisao-final.zip`.

---

## [v7.15.0] - 2026-04-25

### Recomendacao automatica de modelos

#### Adicionado
- Novo servico `assets/js/services/modelos-recomendacao.service.js` para ranquear modelos padrao por perfil, objetivo, urgencia, prioridade, renda, reserva e produtos ativos.
- `pages/comparador.html` ganhou bloco `data-comparator-model-recommendation` com modelo sugerido, score de aderencia, motivos explicaveis e acao `Clonar e aplicar`.
- `assets/js/bf-platform.js` passou a usar a biblioteca de modelos padrao dentro do comparador e aplicar clones recomendados na matriz atual.
- `assets/js/modelos-biblioteca.js` passou a ordenar a biblioteca por aderencia, destacar card recomendado e aceitar `?recomendado=<id>`.
- `assets/js/client-dashboard.js` passou a ordenar modelos padrao pelo perfil salvo e destacar o primeiro como `Recomendado para seu perfil`.
- `pages/modelos-biblioteca.html` e `pages/dashboard-cliente.html` passaram a carregar o servico de recomendacao de modelos.

#### Validado
- HTTP 200 para comparador, biblioteca, dashboard, novo servico JS, scripts alterados e CSS.
- Sintaxe JS validada para `modelos-recomendacao.service.js`, `bf-platform.js`, `modelos-biblioteca.js` e `client-dashboard.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou recomendacao `std-liquidez-rapida`, clone/aplicacao no comparador, matriz com CDC/garantia/consignado, biblioteca ordenada pelo recomendado e dashboard com destaque do modelo.
- Evidencias salvas em `docs/test-prints/comparador-modelo-recomendado-desktop.png`, `comparador-modelo-recomendado-aplicado-desktop.png`, `modelos-biblioteca-recomendacao-desktop.png`, `dashboard-cliente-modelo-recomendado-desktop.png` e `comparador-modelo-recomendado-mobile.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.15-recomendacao-automatica-modelos-final.zip`.

---

## [v7.14.0] - 2026-04-25

### Biblioteca de modelos padrao

#### Adicionado
- Nova pagina `pages/modelos-biblioteca.html` para modelos padrao por jornada financeira.
- Novo JSON `assets/data/modelos-comparador-padrao.json` com seeds publicados para liquidez, compra de bem, troca de veiculo e consumo pontual.
- Novo script `assets/js/modelos-biblioteca.js` com busca, filtros por jornada/preset, cards de risco e clonagem local.
- `BFComparatorModels.cloneStandard` clona um modelo padrao para o escopo do usuario, registra `standardId`, origem `standard:<id>` e evento de auditoria `clone-standard`.
- `pages/dashboard-cliente.html` passou a destacar a biblioteca e os clones salvos pelo usuario.
- `assets/js/client-dashboard.js`, `assets/js/admin-users.js`, `assets/js/modelos-governanca.js`, `assets/js/bf-platform.js` e `js/shared-layout.js` foram atualizados para reconhecer biblioteca, clones e datasets.

#### Validado
- Sintaxe JS validada para `assets/js/modelos-biblioteca.js`, `assets/js/client-dashboard.js`, `assets/js/bf-platform.js`, `assets/js/admin-users.js` e `assets/js/modelos-governanca.js`.
- JSON `assets/data/modelos-comparador-padrao.json` validado com 4 modelos padrao.
- Chrome headless confirmou: usuario cliente acessa a biblioteca, clona modelo publicado, abre `comparador.html?modelo=<id>`, ve colunas CDC, credito com garantia e consignado, e encontra o clone no dashboard cliente.
- Evidencias visuais salvas em `docs/test-prints/modelos-biblioteca-desktop.png`, `docs/test-prints/comparador-modelo-padrao-clonado-desktop.png`, `docs/test-prints/dashboard-cliente-biblioteca-modelos-desktop.png` e `docs/test-prints/modelos-biblioteca-mobile.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.14-biblioteca-modelos-padrao-final.zip`.

---

## [v7.13.0] - 2026-04-25

### Governanca comercial de modelos

#### Adicionado
- Nova pagina `pages/modelos-governanca.html` para governanca dedicada dos modelos de comparacao.
- Novo script `assets/js/modelos-governanca.js` com filtros por busca, usuario, preset, produto e status.
- `assets/js/bf-platform.js` ganhou score de qualidade dos modelos e API `BFComparatorModels.updateGovernance`.
- Modelos agora podem ser marcados localmente como `draft`, `approved`, `published` ou `archived`.
- Acoes de governanca registram auditoria local com eventos `governance:approved`, `governance:published` e `governance:archived`.
- `pages/dashboard-admin.html` e `js/shared-layout.js` receberam links para a governanca de modelos.

#### Validado
- HTTP 200 para `pages/modelos-governanca.html`, `pages/dashboard-admin.html`, `assets/js/modelos-governanca.js`, `assets/js/bf-platform.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `assets/js/modelos-governanca.js`, `assets/js/bf-platform.js` e `assets/js/admin-users.js`.
- Chrome headless confirmou dois modelos locais, filtros por preset, publicacao de modelo, auditoria `governance:published`, reflexo no dashboard admin e responsividade desktop/mobile sem overflow.
- Evidencias salvas em `docs/test-prints/modelos-governanca-desktop.png`, `docs/test-prints/dashboard-admin-governanca-modelos-desktop.png` e `docs/test-prints/modelos-governanca-mobile.png`.

---

## [v7.12.0] - 2026-04-25

### Exportacao, importacao e auditoria de modelos

#### Adicionado
- `assets/js/bf-platform.js` agora gera pacotes JSON de modelos com schema `bank-fratern.comparator-models.v1`.
- Modelos de comparacao passaram a registrar `formulaVersion`, `premiseReference` e `source`.
- O comparador ganhou area `Exportar JSON` / `Importar JSON` com textarea para pacote local, sem depender de backend.
- Operacoes de criar, atualizar, excluir, exportar e importar modelos registram eventos em `localStorage['bf_comparator_model_audit_v1']`.
- `window.BFComparatorModels` ganhou APIs `all`, `audit`, `exportPackage`, `importPackage`, `auditKey` e `versions`.
- `pages/dashboard-admin.html` agora possui painel de auditoria de modelos de comparacao.
- `assets/js/admin-users.js` exibe modelos locais, quantidade de eventos, versao de formula, referencia de premissas e ultimos eventos.

#### Validado
- HTTP 200 para `pages/comparador.html`, `pages/dashboard-admin.html`, `assets/js/bf-platform.js`, `assets/js/admin-users.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `assets/js/bf-platform.js` e `assets/js/admin-users.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou exportacao do pacote `bank-fratern.comparator-models.v1`, importacao do modelo, restauracao por `?modelo=<id>`, metadados `comparador.service.v7.12` e `calculadoras-premissas:2026-04-24`, e auditoria admin com eventos `create`, `export` e `import`.
- Evidencias salvas em `docs/test-prints/comparador-modelos-export-import-desktop.png`, `docs/test-prints/dashboard-admin-auditoria-modelos-desktop.png` e `docs/test-prints/comparador-modelos-export-import-mobile.png`.

---

## [v7.11.0] - 2026-04-25

### Modelos nomeados de comparacao

#### Adicionado
- `assets/js/bf-platform.js` agora salva uma lista local de modelos de comparacao em `localStorage['bf_comparator_models_v1:<usuario-ou-anon>']`.
- O comparador ganhou campo `Nome do modelo`, botao `Salvar modelo`, lista dos modelos recentes e acoes `Abrir`, `Aplicar` e `Excluir`.
- `comparador.html?modelo=<id>` abre uma matriz salva, restaura preset, campos, colunas e recalcula a decisao.
- `pages/dashboard-cliente.html` passou a exibir atalhos de modelos de comparacao salvos para o usuario autenticado.
- `assets/js/client-dashboard.js` usa `window.BFComparatorModels` para listar modelos e montar links de reabertura.

#### Corrigido
- Checkboxes do comparador agora interpretam corretamente valores persistidos como `"0"` e `"1"` ao restaurar modelos.

#### Validado
- HTTP 200 para `pages/comparador.html`, `pages/dashboard-cliente.html`, `assets/js/bf-platform.js`, `assets/js/client-dashboard.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `assets/js/bf-platform.js` e `assets/js/client-dashboard.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou login cliente, salvamento do modelo `Liquidez rapida cliente`, persistencia na chave `bf_comparator_models_v1:cliente@bankfratern.local`, abertura por `?modelo=<id>`, restauracao de CDC, Credito com garantia e Consignado, e atalho no dashboard cliente.
- Evidencias salvas em `docs/test-prints/comparador-modelos-nomeados-desktop.png`, `docs/test-prints/comparador-modelo-aberto-desktop.png`, `docs/test-prints/dashboard-cliente-modelos-comparador-desktop.png` e `docs/test-prints/comparador-modelos-nomeados-mobile.png`.

---

## [v7.10.0] - 2026-04-25

### Presets favoritos e entrada direta por Produtos

#### Adicionado
- `produtos.html` agora envia o usuario para `comparador.html?preset=...` conforme o produto ou objetivo selecionado.
- `assets/data/produtos.json` ganhou `comparadorPreset` por produto.
- `assets/js/components/cards.js` monta links de comparacao com preset direto.
- `assets/js/bf-platform.js` reconhece query string `preset`, `objetivo` ou `produto`, aplica o preset no carregamento e permite salvar/aplicar preset favorito por usuario local.
- O favorito usa `localStorage` com escopo por e-mail do usuario autenticado quando houver sessao, ou `anon` quando nao houver login.

#### Corrigido
- O estado do preset no `body` agora usa `data-comparator-active-preset`, evitando colisao com o seletor `select[data-comparator-preset]`.
- Os cards do comparador ganharam `data-comparison-card` para facilitar testes e automacao de QA.

#### Validado
- HTTP 200 para `pages/produtos.html`, `pages/comparador.html?preset=obter_liquidez`, `pages/comparador.html?preset=trocar_veiculo`, `assets/data/produtos.json`, `assets/js/bf-platform.js`, `assets/js/components/cards.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `assets/js/bf-platform.js` e `assets/js/components/cards.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou que Produtos filtra `Obter liquidez`, gera links `comparador.html?preset=obter_liquidez`, salva favorito em `bf_comparator_favorite_preset_v1:anon` e reaplica CDC, Credito com garantia e Consignado.
- Chrome headless mobile confirmou `comparador.html?preset=trocar_veiculo` com Financiamento, Consorcio, Pagar a vista e Compra parcelada, sem overflow horizontal.
- Evidencias salvas em `docs/test-prints/produtos-comparador-deeplink-desktop.png`, `docs/test-prints/comparador-favorito-desktop.png` e `docs/test-prints/comparador-favorito-mobile.png`.

---

## [v7.9.0] - 2026-04-25

### Presets de comparacao por objetivo

#### Adicionado
- `pages/comparador.html` recebeu o seletor `Preset de comparacao` com modos Manual, Comprar bem, Obter liquidez, Trocar veiculo e Consumo pontual.
- `assets/js/bf-platform.js` aplica automaticamente colunas, urgencia, prioridade e premissas de cada preset, mantendo os campos editaveis depois da aplicacao.
- O resumo do preset usa `assets/data/produtos.json` para exibir os produtos relacionados ao objetivo.
- `assets/js/services/comparador.service.js` registra o preset aplicado na memoria de calculo e ajusta decisao por rapidez para funcionar com qualquer conjunto de credito imediato.
- Nova documentacao funcional em `docs/COMPARADOR_PRESETS_OBJETIVO.md`.

#### Validado
- HTTP 200 para `pages/comparador.html`, `assets/data/produtos.json`, `assets/js/bf-platform.js`, `assets/js/services/comparador.service.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `bf-platform.js` e `comparador.service.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou preset `Obter liquidez` com CDC, garantia e consignado; preset `Trocar veiculo` com financiamento, consorcio e consumo; e preset `Consumo pontual` no mobile com CDC, a vista e parcelado.
- Memoria de calculo registra o preset aplicado, historico local salva o cenario e nao houve overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/comparador-presets-desktop.png` e `docs/test-prints/comparador-presets-mobile.png`.

---

## [v7.8.0] - 2026-04-25

### Comparador multi-produto

#### Adicionado
- `pages/comparador.html` passou a permitir ligar/desligar colunas de Financiamento, Consorcio, CDC, Credito com garantia, Consignado e Compra a vista/parcelada.
- `assets/js/services/comparador.service.js` passou a montar a matriz dinamicamente, reaproveitando os servicos de CDC, garantia e consignado.
- O motor de decisao diferencia produtos de credito de colunas de consumo, evitando que valores de naturezas diferentes distorcam a recomendacao principal.
- Cards do comparador agora exibem nota de uso e link direto para o simulador ou calculadora relacionada.
- `pages/comparador.html` passou a carregar `garantia.service.js` e `consignado.service.js`.
- Nova documentacao funcional em `docs/COMPARADOR_MULTI_PRODUTO.md`.

#### Validado
- HTTP 200 para `pages/comparador.html`, `comparador.service.js`, `garantia.service.js`, `consignado.service.js`, `bf-platform.js` e `platform.css`.
- Sintaxe JS validada para `assets/js/services/comparador.service.js` e `assets/js/bf-platform.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou 7 cards e 7 linhas na matriz com todas as colunas ligadas, decisao por rapidez em `Consignado`, risco de garantia, salvamento no historico local e ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/comparador-multiproduto-desktop.png` e `docs/test-prints/comparador-multiproduto-mobile.png`.

---

## [v7.7.0] - 2026-04-25

### Produtos 2.0 como catalogo de decisao

#### Adicionado
- `pages/produtos.html` passou a ter resumo de perfil, catalogo guiado por objetivo/urgencia/risco e links diretos para simular, comparar e diagnosticar.
- `assets/data/produtos.json` ganhou rotas de simulador, comparador, calculadora relacionada, `quandoUsar` e `evitarQuando`.
- `assets/js/components/cards.js` passou a renderizar cards acionaveis com score, criterios, riscos e botoes de jornada.
- `assets/js/bf-platform.js` agora filtra produtos, ranqueia por recomendacao e mostra trilha sugerida usando perfil financeiro local.
- Nova documentacao funcional em `docs/PRODUTOS_CATALOGO_DECISAO.md`.

#### Validado
- HTTP 200 para `pages/produtos.html`, `assets/data/produtos.json`, `assets/js/bf-platform.js`, `assets/js/components/cards.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `cards.js` e `bf-platform.js`; JSON do catalogo validado.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou filtro `Obter liquidez + Alta`, catalogo reduzido para 2 produtos, trilha sugerida, botoes dos cards e ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/produtos-catalogo-decisao-desktop.png` e `docs/test-prints/produtos-catalogo-decisao-mobile.png`.

---

## [v7.6.0] - 2026-04-25

### Decisao de compra responsavel

#### Adicionado
- A calculadora `Compra a Vista ou Parcelado` passou a usar renda mensal, custos mensais, reserva atual e prioridade de decisao.
- O motor `assets/js/services/calculadoras.service.js` agora calcula reserva apos pagamento a vista, cobertura em meses, parcela sobre renda, gap de reserva e decisao sugerida.
- A decisao pode priorizar menor custo, preservacao de caixa ou equilibrio entre desconto e liquidez.
- A simulacao salva no perfil local `taxaOportunidadeMes`, renda, custos, reserva, reserva ideal, parcela de consumo e ultima decisao de compra.
- Nova documentacao funcional em `docs/DECISAO_COMPRA_CONSUMO_RESPONSAVEL.md`.

#### Validado
- JSON do catalogo validado.
- Sintaxe JS validada para `assets/js/services/calculadoras.service.js` e `assets/js/calculadoras-page.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- HTTP 200 para `pages/calculadora-compra-vista-parcelado.html`, catalogo, servico e renderer.
- Chrome headless confirmou campo de prioridade, decisao `Parcelar` para preservar caixa, historico salvo, perfil com `ultimaDecisaoCompra` e ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/compra-vista-parcelado-decisao-desktop.png` e `docs/test-prints/compra-vista-parcelado-decisao-mobile.png`.

---

## [v7.5.0] - 2026-04-25

### Comparador 2.0 orientado a decisao do usuario

#### Adicionado
- `pages/comparador.html` evoluiu de uma tabela simples para uma jornada de decisao com perfil financeiro, urgencia, prioridade e memoria de calculo.
- O servico `assets/js/services/comparador.service.js` agora calcula perfil usado, decisao recomendada, riscos, proximas acoes, metricas de capacidade e explicacao do criterio vencedor.
- `assets/js/bf-platform.js` passou a renderizar cards lado a lado, matriz, alertas de risco e botao para salvar o cenario no historico financeiro local.
- O historico salvo pelo comparador usa `localStorage['bf_calculator_history_v1']` e pode ser reaberto por `comparador.html` no dashboard cliente.
- Nova documentacao funcional em `docs/COMPARADOR_DECISAO_USUARIO.md`.

#### Validado
- HTTP 200 para `pages/comparador.html`, `assets/js/services/comparador.service.js`, `assets/js/bf-platform.js` e `assets/css/platform.css`.
- Sintaxe JS validada para `comparador.service.js`, `bf-platform.js`, `calculadoras-page.js` e `client-dashboard.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- Chrome headless confirmou decisao renderizada, urgencia alta priorizando disponibilidade, salvamento do cenario no historico local e ausencia de overflow desktop/mobile.
- Evidencias salvas em `docs/test-prints/comparador-decisao-desktop.png` e `docs/test-prints/comparador-decisao-mobile.png`.

---

## [v7.4.1] - 2026-04-25

### Ajuste de ordem da Home institucional

#### Modificado
- O bloco `#perfil-unico` foi movido para depois do bloco institucional de empresa e produtos.
- A secao de produtos passou a explicitar o Bancus Fraternis, suas frentes de diagnostico, credito/consorcio/comparacao e investimentos.
- O diagnostico pessoal agora entra como etapa posterior: primeiro o usuario entende a empresa e as solucoes; depois informa dados para montar o perfil financeiro.

#### Validado
- HTTP 200 para `pages/index.html`, `pages/index.html#perfil-unico`, `css/home.css` e `js/home.js`.
- Chrome headless confirmou que `#plataforma` aparece antes de `#perfil-unico`, a ancora permanece funcional, o score continua calculando e nao ha overflow horizontal.
- Evidencia salva em `docs/test-prints/home-order-profile-after-products.png`.

---

## [v7.4.0] - 2026-04-25

### Home institucional orientada ao usuario

**Tipo:** Reposicionamento de produto, UX institucional e entrada do perfil financeiro unico.

#### Adicionado
- Nova primeira dobra em `pages/index.html` com foco no usuario final, nao no painel operacional.
- Bloco visual de perfil financeiro unico baseado na documentacao `documentacao_bloco_ecossistema_calculadoras_v2`.
- Diagnostico rapido local na Home com renda, despesas, dividas, reserva, objetivo, score educativo e recomendacao contextual.
- Jornada do usuario em quatro passos: informar contexto, receber diagnostico, simular caminhos e decidir com clareza.
- Secao de ecossistema conectado por momento de vida: diagnostico, comparacao de credito e investimentos.
- Bloco de confianca com privacidade, memoria de calculo e recomendacao responsavel.

#### Modificado
- `css/home.css` recebeu a camada institucional responsiva `home-body--institutional`.
- `js/home.js` passou a calcular a previa de diagnostico do perfil financeiro unico e posicionar a faixa de configuracoes em um ponto institucional.
- A prova de plataforma com base real e historico foi reposicionada para baixo da narrativa principal.

#### Validado
- HTTP 200 para `pages/index.html`, `js/home.js` e `css/home.css`.
- Sintaxe JS validada com Node empacotado para `home.js` e `settings.js`.
- Chrome headless confirmou hero institucional, formulario de diagnostico, score/recomendacao, ausencia de overflow desktop/mobile e carregamento da base real.
- Evidencias salvas em `docs/test-prints/home-institutional-desktop.png` e `docs/test-prints/home-institutional-mobile.png`.

---

## [v7.3.0] - 2026-04-24

### Fase 4 - Configuracoes globais aplicadas

**Tipo:** Evolucao de experiencia, governanca local e comportamento cross-page.

#### Adicionado
- `js/settings.js` agora expoe `window.Settings`, normaliza preferencias, aplica classes globais no boot e publica o evento `bankfratern:settings-applied`.
- Painel visual de preferencias ativas em `pages/configuracoes.html`.
- Faixa de configuracoes globais na Home com resumo de segmento, administradora, paginação, score, MOB e demais defaults.
- Painel "Configuracoes globais aplicadas" no simulador, logo abaixo do status da base real.
- Classes CSS globais para `showJourney`, `smoothScroll`, `darkMode` e `autoScore`.

#### Modificado
- `js/shared-layout.js` passou a aplicar preferencias mesmo em paginas que ainda nao carregam `settings.js` diretamente.
- `pages/index.html` passou a carregar `settings.js` e recebeu links diretos para Calculadoras.
- `js/home.js` passou a filtrar destaques pelo segmento configurado e a renderizar o resumo de preferencias.
- `js/app.js` passou a usar defaults de `Settings` para page size, score automatico, segmento, administradora, politica de saldo, reajuste, MOB e limite de lance embutido.
- `pages/simulador.html` aplica defaults apos montar os filtros da base real.

#### Backlog decidido
- API server-side de premissas, versionamento de formulas, logs de aprovacao e publicacao de regras ficam em backlog para fase posterior.

#### Validado
- Sintaxe JS validada com Node empacotado para `settings.js`, `shared-layout.js`, `home.js`, `app.js` e `calculadoras-page.js`.
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- HTTP 200 confirmado para `pages/configuracoes.html`, `pages/index.html`, `pages/simulador.html`, `js/settings.js`, `js/app.js` e CSS do design system.
- Chrome headless confirmou `showJourney=false`, `smoothScroll=false`, `autoScore=false`, `defaultSegmento=3`, `pageSize=25`, politica `com_custos`, reajuste `7.5`, MOB `24` e lance `22`.
- Evidencias salvas em `docs/test-prints/phase4-settings-config-desktop.png`, `phase4-settings-home-desktop.png`, `phase4-settings-home-mobile.png` e `phase4-settings-simulator-desktop.png`.
- Checkpoint salvo em `versions/bank-fratern-v7.3-fase4-configuracoes-final.zip`.

---

## [v7.2.0] - 2026-04-24

### Governanca e QA das calculadoras

**Tipo:** Evolucao de confianca, auditoria e preparacao para backend.

#### Adicionado
- Pagina protegida `pages/calculadoras-governanca.html` para administradores.
- Script `assets/js/calculadoras-governanca.js` com matriz funcional, filtros, painel de premissas e execucao visual de golden tests.
- Dataset `assets/data/calculadoras-golden-tests.json` com casos deterministicos das formulas principais.
- Script `tools/validate-calculadoras.mjs` para validar catalogo, paginas, slugs, premissas, implementacao no servico e golden tests.
- Override local de premissas em `localStorage['bf_calculator_premissas_override_v1']`.

#### Modificado
- `assets/js/services/calculadoras.service.js` passou a mesclar premissas curadas com overrides locais.
- `assets/js/services/dados.service.js` e `assets/js/bf-platform.js` passaram a listar golden tests nos datasets.
- `pages/dashboard-admin.html`, `js/shared-layout.js`, `server.js` e `pages/api-docs.html` passaram a reconhecer a governanca das calculadoras.

#### Validacao prevista
#### Validado
- `tools/validate-calculadoras.mjs` retornou `ok: true`, com 17 calculadoras, 6 categorias e 10 golden tests.
- HTTP 200 para governanca, JS, golden tests, dashboard admin, dados abertos e API Docs.
- Painel `pages/calculadoras-governanca.html` abriu com login admin, renderizou 17 linhas, executou `10/10 testes aprovados` e salvou override local de Selic.
- Evidencias salvas em `docs/test-prints/calculators-governance-desktop.png` e `docs/test-prints/calculators-governance-mobile.png`.

## [v7.1.0] - 2026-04-24

### Ecossistema integrado de calculadoras

**Tipo:** Expansao funcional maxima do hub financeiro, ainda sem backend novo.

#### Adicionado
- Hub `pages/calculadoras.html` com agrupamento por Diagnostico, Credito, Investimentos, Comparacao, Planejamento e Educacao financeira.
- 17 paginas individuais de calculadoras em `pages/calculadora-*.html`.
- Catalogo local `assets/data/calculadoras.json` com slugs, campos, formulas, riscos e relacoes.
- Premissas locais `assets/data/calculadoras-premissas.json` com Selic, CDI, IPCA, TR, IR regressivo, cartoes, faixas de renda, carteiras e ativos demonstrativos.
- Biblioteca comum `assets/js/formulas/financial.formulas.js`.
- Servico `assets/js/services/calculadoras.service.js` com simulacao por slug, perfil local, historico e recomendacoes.
- Renderer `assets/js/calculadoras-page.js` para formularios, resultados, memoria de calculo, recomendacoes, tabelas, perfil e historico.
- Documentacao funcional em `docs/CALCULADORAS_FUNCIONAIS_BANK_FRATERN.md`.

#### Modificado
- `js/shared-layout.js` passou a incluir link global para Calculadoras.
- `server.js` passou a resolver aliases das novas rotas.
- `assets/css/platform.css` recebeu estilos de hub, cards, perfil financeiro, historico e resultados.
- `pages/dashboard-cliente.html` e `assets/js/client-dashboard.js` passaram a exibir perfil financeiro consolidado e historico de calculadoras.
- `pages/produtos.html`, `pages/dados-abertos.html`, `pages/api-docs.html` e `pages/compliance.html` passaram a refletir o novo ecossistema.

#### Validado
- HTTP 200 para hub, 17 paginas individuais, novos JS, CSS e JSONs.
- Sintaxe JS validada com Node empacotado do runtime Codex.
- Navegador headless validou hub com 17 cards, todas as 17 calculadoras com formulario, metricas, memoria de calculo e recomendacao.
- Historico local validado com 17 simulacoes geradas.
- Reaproveitamento de dados validado: Custos Fixos alimentou Reserva de Emergencia e Juros Compostos.
- Dashboard cliente validado com perfil financeiro consolidado e historico de calculadoras.
- Evidencias salvas em `docs/test-prints/calculators-hub-desktop.png`, `calculator-detail-desktop.png`, `calculator-dashboard-desktop.png` e `calculators-hub-mobile.png`.

#### Pendencias tecnicas
- Transformar premissas locais em fonte versionada por API quando houver backend.
- Criar golden tests automatizados das formulas financeiras.

## [v7.0.0] - 2026-04-24

### Evolucao estruturada Bancus Fraternis

**Tipo:** Consolidacao de boot, base real, proposta executiva, PDF e identidade visual.

#### Adicionado
- `server.js` na raiz para execucao padronizada com `node server.js`.
- Logos SVG Bancus Fraternis em `assets/logos/` e ponte CSS em `assets/css/styles.css`.
- Pacote `bank_fratern_design_system_pack` promovido para o projeto: logos, icones de jornada, criativos hero e CSS-base em `assets/`.
- Camada de integracao `css/bank-fratern-design-system.css`, mapeando tokens `--bf-*` para a interface existente sem substituir a arquitetura atual.
- Camadas vivas `js/portfolio-live.js` e `js/assemblies-live.js` para evoluir carteira e assembleias sem reescrever as paginas inteiras.
- Plano evolutivo atualizado em `docs/PLANO_IMPLEMENTACAO_EVOLUTIVO_BANK_FRATERN.md`.
- Tela de `Resumo da Proposta Estruturada` em blocos: cabecalho executivo, KPIs, jornada, composicao financeira, contribuicoes, lances, projecoes, cronograma mensal, proximos passos e premissas.
- Exportacao PDF baseada na propria tela de resultados, com cronograma mensal detalhado e estilo de impressao.
- Persistencia local com `Storage.listSimulations()` e compatibilidade de `Storage.saveSimulation(data)`.
- Badges institucionais reutilizaveis (`.bf-action-icon`, `.bf-empty-mark`) para substituir emojis funcionais.
- Home dinamica com `js/home.js`, KPIs da base real, status vivo de conexao, radar de grupos em destaque e leitura das simulacoes salvas no navegador.
- Protocolo de testes preferencial em `docs/CODEX_TEST_PROTOCOL.md`, registrando URL local, fallback visual, pasta de prints e caminho `simulador.html?showLoading=1`.
- Controlador `js/database-progress.js` para barras de carregamento da base, painel persistente de status e progresso da jornada da prateleira.
- Plano do salto de plataforma em `docs/PLANO_SALTO_PLATAFORMA_BANK_FRATERN.md`.
- Base modular em `assets/data`, `assets/js/formulas`, `assets/js/services`, `assets/js/components` e `assets/css/platform.css`.
- Novas paginas de plataforma: educacao, produtos, comparador, dados abertos, compliance, API Docs, simuladores de financiamento/veiculos/CDC e dashboards cliente/admin.
- Reorganizacao de HTMLs em `pages/`, com `index.html` raiz mantido apenas como ponte de compatibilidade.
- Simuladores novos de credito com garantia e consignado.
- Camada local de autenticacao em `js/auth.js`, com usuarios seed, sessao de 8 horas, papeis, status e protecao de paginas.
- Pagina `pages/login.html` com contas de demonstracao, barra de progresso e redirecionamento pos-login.
- Painel administrativo em `pages/dashboard-admin.html` com cadastro, edicao, filtros, ativacao/inativacao, exclusao e senha temporaria.
- Identificacao de sessao no dashboard cliente por `assets/js/client-dashboard.js`.
- Documentacao `docs/AUTH_ADMIN_LOCAL.md` para operar e evoluir a autenticacao local.

#### Modificado
- Portal `index.html` passou a usar identidade Bancus Fraternis, logos oficiais e atalhos com codigos visuais institucionais.
- `simulador.html` recebeu cabecalho com marca Bancus Fraternis + produto ConsorcioPro, botoes mais consistentes e microcopy mais executiva.
- Paginas principais passaram a carregar a camada `bank-fratern-design-system.css` para consolidar paleta, foco, cards, botoes, tabelas e headers.
- Home passou a usar o criativo `hero-access.svg`; simulador passou a usar o logo `bank-fratern-compass.svg`; layout compartilhado passou a usar os logos oficiais do pacote.
- Mapa de jornada `consorcio_user_journey_map_v2.html` recebeu paleta Bancus Fraternis e os 12 icones SVG de etapa.
- Home passou a aplicar componentes oficiais do design system no header, hero, atalhos e cards de jornada.
- Home passou a usar a composicao projetada do design-system: hero com foto oficial, modulos BF Journey/BF Simulator/BF Intelligence e radar operacional com dados carregados.
- `carteira.html` passou a combinar base demonstrativa, simulacoes salvas em `Storage` e resumo do catalogo real em um painel de carteira viva.
- `assembleias.html` passou a conectar a serie historica ao grupo real `79`, atualizando hero, cards, painel de fonte e insights executivos.
- `simulador.html` passou a demonstrar a conexao com a base real com overlay em etapas, barra percentual, fonte/caminho da base e estado de jornada durante a busca de grupos.
- `js/shelf-data.js` passou a expor `getShelfDataStatus()` com origem, contagem, caminho e erro do carregamento.
- `js/app.js` passou a atualizar barras da jornada ao buscar, filtrar, ordenar e renderizar a prateleira.
- `index.html` passou a apontar para a nova camada de plataforma, incluindo educacao, produtos, comparador, dados e dashboards.
- `js/shared-layout.js` passou a incluir navegacao para educacao, produtos, comparador, dados, compliance e dashboard.
- Caminhos de `pages/*.html` foram normalizados para `../css`, `../js`, `../assets` e `../data_base` apos a reorganizacao das pastas.
- `server.js` passou a resolver aliases antigos de paginas para `pages/*.html`.
- Simulador recebeu stepper iconografico com os SVGs oficiais do pacote, preservando numeracao e fluxo de 10 etapas.
- Header compartilhado das paginas auxiliares passou a carregar as classes `bf-header`, `bf-brand` e `bf-nav`.
- `js/app.js` teve detalhes da prateleira, comparador, toasts e modal de simulacoes ajustados para linguagem mais institucional.
- `css/styles.css`, `css/home.css` e `css/shared-site.css` receberam tokens e componentes visuais azul-marinho/dourado.
- Paginas auxiliares foram alinhadas visualmente e tiveram links locais/caminhos de assets corrigidos.
- `js/shared-layout.js` passou a exibir estado autenticado, link Admin para administradores e botao de logout.
- `dashboard-cliente.html` passou a exigir login e a apresentar o usuario ativo no topo da area.
- `assets/css/platform.css` recebeu estilos de login, administracao, chips de conta, tabelas de usuarios e rodape compartilhado das paginas de plataforma.
- `server.js` passou a resolver tambem o alias `login.html`.

#### Validado
- Boot do simulador com base real, loading seguro e prateleira paginada.
- Proposta/PDF com graficos, cronograma mensal e blocos executivos.
- Rotas principais sem 404 de CSS/JS/logos: `index.html`, `simulador.html`, `carteira.html`, `assembleias.html`, `configuracoes.html`, `duvidas.html` e `sobre-nos.html`.
- Referencias locais de `src`/`href` conferidas apos a integracao do pacote visual.
- Arquivos editados conferidos em UTF-8 sem caracteres de substituicao.
- Prints de QA visual gerados em `docs/test-prints/`: home desktop, simulador desktop e home responsiva.
- Home dinamica validada no servidor local `http://127.0.0.1:8080/index.html`: `index.html`, `js/home.js`, CSS, base JSON, foto hero e icones UI responderam 200; prints atualizados em `docs/test-prints/home-dynamic-*.png`.
- Carteira e assembleias validadas em `http://127.0.0.1:8080/`: HTML, novos scripts, CSS e base JSON responderam 200; prints atualizados em `docs/test-prints/portfolio-live-desktop.png` e `docs/test-prints/assemblies-live-desktop.png`.
- Reorganizacao em `pages/` validada em `http://127.0.0.1:8080/pages/index.html`; scanner local de `src`/`href` retornou `MissingCount=0`.
- Rotas `pages/index.html`, `pages/simulador.html`, `pages/produtos.html`, `pages/comparador.html`, `pages/simulador-garantia.html` e `pages/simulador-consignado.html` responderam HTTP 200.
- QA visual por CDP gerou `docs/test-prints/reorg-home-desktop.png`, `reorg-simulator-loading-desktop.png`, `reorg-products-desktop.png`, `reorg-guarantee-desktop.png` e `reorg-consigned-desktop.png`.
- Normalizacao de acentuacao UTF-8 aplicada nas paginas principais afetadas pela reorganizacao visual.
- Fase 1 de persistencia avancada validada: `Storage` passou ao schema 2, salvando snapshot de formulario, carrinho, parametros, resultado, totais e metadados de cliente/consultor.
- Simulador passou a restaurar simulacoes por `pages/simulador.html?simulationId=<id>`, retomando consultor, cliente, carrinho e etapa ativa.
- Carteira passou a criar link `Retomar simulacao` para abrir uma simulacao salva diretamente no simulador.
- Evidencias da retomada salvas em `docs/test-prints/phase1-resume-simulator.png` e `docs/test-prints/phase1-portfolio-resume-link.png`.
- Fluxo de autenticacao/admin validado em `http://127.0.0.1:8080/pages/`: login renderiza formulario, dashboard admin sem sessao redireciona para login, admin autentica, tabela seed carrega 3 usuarios, cadastro de consultor aumenta a base para 4 usuarios e dashboard cliente reconhece a sessao.
- Evidencias do ciclo auth/admin salvas em `docs/test-prints/auth-login-desktop.png`, `auth-admin-dashboard-desktop.png` e `auth-client-dashboard-desktop.png`.

#### Pendencias tecnicas
- Sanitizacao centralizada de textos vindos da base antes de `innerHTML`.
- Integracao plena de carteira e assembleias com simulacoes salvas/base real.
- Refinamento final do comparador com narrativa heuristica e selecao direta da prateleira.
- QA visual em navegador assim que o ambiente permitir servidor local/runtime sem erro de `Acesso negado`.
- Trocar autenticacao local por API segura, hash forte, sessao server-side e auditoria antes de usar dados reais.

---

## [v5.0.0] — 2026-04-11

### 🛒 Prateleira Multi-seleção com Edição Inline

**Tipo:** Evolução funcional da Etapa 4

#### Adicionado
- **Multi-seleção de grupos**: o usuário pode adicionar N grupos ao projeto em vez de apenas 1
- **Painel "Grupos Selecionados"** abaixo da tabela da Prateleira com:
  - Tabela editável com colunas: Grupo, Segmento, Valor da Carta, Qtd. Cotas, Total da Carta, Remover
  - Campo "Input Usuário" (borda azul `2px solid #3b82f6`) para Valor da Carta e Qtd. Cotas
  - Campo "Calculado / Função" (fundo `#f0fdf4`, borda verde) para Total da Carta — recalcula automaticamente
  - Rodapé consolidado: total de grupos, total de cotas, total das cartas
- **`ShelfEngine.createProjectItem`**: novo parâmetro `overrideValorCarta` para valores customizados
- **`App.renderGruposSelecionados()`**: renderiza o carrinho do projeto (Step 4)
- **`App.removerGrupoSelecionado(itemId)`**: remove um item do carrinho
- **`App.atualizarItemProjeto(itemId, campo, valor)`**: recalcula Total da Carta inline
- **`App.onEditarItemProjeto(inputEl)`**: handler robusto para onChange de todos os novos campos editáveis (Lances, Prazos, Taxa, Qtd e Carta)
- **`App.simularProjetoEstruturado()`**: avança para Step 5 renderizando Dashboard e Carrinho final
- **`App.atualizarBotaoAvancar()`**: botão indica quantidade de grupos selecionados
- **NOVO:** **`App.renderStep5Cart()`**: Substitui o formulário engessado do Passo 5 por cards de edição individual por grupo
- **NOVO:** **`App.renderStep5Dashboard(consolidado)`**: Dashboard top-level no Passo 5 (agrega valor da carta líquida, % média da taxa, parcela inicial e custo efetivo)
- **NOVO:** **`App.recalcularProjeto()`**: Toda vez que o usuário edita a sacola no passo 5, recalcula no ato e reflete os números no Dashboard

#### Modificado
- **`App.selecionarGrupo(idx)`**: em vez de preencher Step 5 diretamente, adiciona ao carrinho
- **`App.validateCurrentStep()` (Etapa 5)**: Substitui validação cega de ID para validar preenchimento dinâmico dos itens da sacola
- **`App.getParams()`**: Aprimorado para ler consolidadamente variáveis como `prazoTotal` e `valorCarta` de dentro do `projetoEstruturado` quando aplicável
- **`App.renderShelfTable()`**: coluna de ação agora mostra "Adicionado ✅" (verde) quando o grupo já foi adicionado
- **Botão avançar** da Etapa 4: removido `onclick` inline, agora chama `simularProjetoEstruturado()`
- **Modal de detalhes**: botão muda de "Selecionar este grupo" para "+ Adicionar ao Projeto"

#### HTML
- **Step 5 deletado**: Formulário tradicional substituído pelas divs `#step5-dashboard` e `#step5-cart-items`

#### CSS
- `.shelf-row--added` — linha verde quando grupo já está no carrinho
- `.selected-groups-panel-wrapper` — wrapper com borda gold e sombra
- `.input-usuario` — input azul editável (fundo branco, borda `2px solid var(--primary-500)`)
- `.campo-calculado__valor` — campo verde somente-leitura (fundo `#f0fdf4`, borda `#86efac`)
- `.selected-groups-footer` e `.sg-footer-*` — rodapé de totais
- `.selected-groups-empty` — estado vazio do painel
- **Step 5 CSS:** Adição massiva de classes `.step5-dashboard-grid`, `.kpi-row`, `.cart-item-card`, `.cart-grid-container` e `.cart-calc` para sustentar a UI da Sacola de Consórcios

---

## [v1.0.0] — 2026-04-10

### 🎉 Lançamento Inicial

**Tipo:** Primeira versão funcional completa

#### Adicionado
- Wizard de 6 etapas com stepper visual navegável
- Formulário completo de dados do cliente (8 campos)
- Formulário de parâmetros financeiros (20+ campos)
- Configuração dinâmica de adiantamentos de parcelas
- Configuração dinâmica de inadimplência com multa e juros
- Motor de cálculo (`engine.js`) com árvore de decisão completa:
  - Adesão (mês 1)
  - Reajuste anual (mês aniversário)
  - Contemplação com abate de lance
  - Adiantamento (redução de saldo ou prazo)
  - Inadimplência e regularização
  - Caso geral
- 2 políticas de saldo devedor (A: Carta / B: Carta + Custos)
- 5 modalidades de lance (livre, fixo, embutido, FGTS, combinado)
- Parcela reduzida pré-contemplação
- 16 KPIs executivos em cards visuais animados
- 6 gráficos interativos via Chart.js 4.4:
  - Composição do plano (doughnut)
  - Evolução das parcelas (line)
  - Evolução do saldo devedor (line)
  - Impacto do lance (bar)
  - Com vs sem contemplação (grouped bar)
  - Parcela atual vs cheia (grouped bar)
- Tabela analítica mensal com toggle de 9 colunas detalhadas
- 21 conceitos educativos com fórmulas, exemplos e ícones
- Exportação PDF via jsPDF + html2canvas
- Versão para impressão (nova janela)
- Proposta comercial elegante com layout institucional
- Design system premium: 70+ CSS custom properties
- Responsividade: desktop, tablet, mobile (3 breakpoints)
- Compatibilidade iPhone (safe-area-inset)
- Barra de ações fixa no mobile
- Máscaras monetárias pt-BR em tempo real
- Validações de formulário com notificações toast
- Tooltips explicativos nos campos
- Árvore lógica visual na etapa 3
- Botão "Carregar Exemplo" com cenário completo
- Botão "Resetar Simulação"
- Print styles para impressão direta
- Scrollbar customizada

#### Corrigido
- IDs duplicados no cabeçalho da tabela analítica
- Custo total estimado calculando valor negativo (lance não contabilizado)

#### Documentação
- README.md — Visão geral e instruções de uso
- ARQUITETURA.md — Documentação técnica completa de cada arquivo
- ATA_PROJETO.md — Ata de criação com decisões registradas
- FOLDER_PROJETO.md — Folder executivo do projeto
- CHANGELOG.md — Este arquivo

---

## Formato do Changelog

Baseado em [Keep a Changelog](https://keepachangelog.com/pt-BR/1.1.0/):
- **Adicionado** — novas funcionalidades
- **Modificado** — mudanças em funcionalidades existentes
- **Corrigido** — correções de bugs
- **Removido** — funcionalidades removidas
- **Segurança** — correções de vulnerabilidades
- **Documentação** — mudanças em documentação


A Versão 6 do projeto introduz uma arquitetura mais madura e abrangente, transformando o simulador antes isolado em um verdadeiro portal institucional e operacional de consórcio. A V.6 expande o funil do usuário, começando pela sua educação e entendimento do produto, passando pelo gerenciamento da carteira pelo consultor, e chegando à precisão financeira da simulação.

Abaixo, documentamos cada um dos componentes analisados para seguirmos com clareza rumo à próxima etapa de implementação.

1. Arquitetura do Novo Portal (Home e Institucional)
O portal ganhou uma nova porta de entrada (index_v4_paginas.html, além de iterações em index_2.html e index_v3_jornada_topo.html), estruturando-se em diferentes blocos navegacionais que acompanham toda a jornada de conscientização pré-simulação:

Home (Início): Atua como o ponto focal. Agora traz destaque em seções como a Jornada Completa do Consorciado. A ideia de "educar antes de vender" está mais clara: o consorciado entende as 12 etapas do mapa (Adesão, Parcelas, Assembleia, Contemplação, Faturamento, Encerramento) logo no topo, desmistificando o produto.
Sobre nós (sobre-nos.html): Apresenta o posicionamento do Bancus Fraternis, seu propósito e atributos de marca.
Dúvidas (duvidas.html): Central de FAQ cobrindo os gargalos e as dores mais comuns identificadas em vendas de consórcios.
Configurações (configuracoes.html): Uma tela desenhada para governança do simulador e parametrização padrão. Possui toggles/switches para a interface (como exibir jornada no topo, scroll suave) e regras negociais iniciais (administradora padrão, categoria sugerida, limite de lance embutido, etc).
Mapa da Jornada (consorcio_user_journey_map_v2.html): Experiência em "tela cheia" educacional que detalha passo a passo o que o cliente enfrenta até o encerramento do grupo financeiro.
2. Visão Executiva e Frente de Consultoria
A grande novidade tática para o Consultor é a inclusão das páginas de monitoramento de performance:

Dashboard da Carteira (carteira.html & carteira_clientes.html)
Fornece métricas de gestão para o vendedor administrar sua base de consorciados de forma preditiva e assertiva:

KPIs Consolidados: Total da carteira (R$), clientes contemplados, volume já pago e tickets em atraso/em risco.
Oportunidades Comerciais: Ranking dos clientes que estão perto da contemplação ("Top Oportunidades") em contraste com a fila das "Atenções", exigindo ação antes da próxima assembleia.
Lista de Clientes em Tabela e Paginação: Compara perfis, mostra a maturidade (percentual pago de fato em cima da carta), próxima assembleia e status operacional (Ativo, Em análise, Atraso, etc).
Concentração de Mix: Verifica a saúde dos contratos gerados, mapeando segmentação (Imóveis x Veículos) para entender a distribuição da liquidez da base do corretor.
TIP

A página usa tabelas semânticas cruzadas com barras de progresso lineares de performance. A base "fictícia" criada dentro desse código HTML atesta a funcionalidade (filtros por input e selects dinâmicos em Vanilla JS). A integração futura desta área com um back-end geraria imenso valor agregado aos vendedores.

3. O Simulador Core (simulador.html)
O simulador.html na V.6 segue arquitetado como Single Page Application (SPA), operando com um conceito de Vertical Stepper de 10 passos. As mudanças e estruturações evidenciam um simulador B2B/B2B2C ultra profissional.

Os 10 passos do fluxo:

Dados do Consultor: Identificação formal.
Dados do Cliente: Perfil e objetivo real do uso do crédito (ex: Reforma, Investimento, Troca).
Filtros de Simulação: Refinamento da base de dados por prazos, administradoras e segmentos.
Prateleira de Grupos: Listagem e classificação inteligente baseada em um algoritmo que monta um Carrinho / Sacola Consolidada. O usuário pode adicionar mais de uma cota simulada.
Parâmetros Financeiros: Análise consolidada das cotas da sacola eleita.
Eventos e Regras: Adiantamentos de parcelas, configuração de multas/juros e modelagem lógica por árvores de decisão.
Resultados (Dashboard Visual): Chart.js implementando gráficos Doughnut e de evoluções lineares (parcela atual vs cheia, impacto de lances).
Tabela Analítica Mensal: Cronograma mês a mês do saldo devedor até N(prazo final).
Gerador de Proposta Comercial: O material formal final. Pode ser exportado via PDF ou impresso (usa integração html2canvas + jsPDF).
Comparador de Grupos: Nova funcionalidade avançadíssima onde você coteja a "Opção A" com a "Opção B" frente a um mesmo cenário de stress econômico.
IMPORTANT

A evolução de V.5 para V.6 conecta o simulador a uma governança em que "não se simula só por simular". Toda a simulação responde aos inputs pré-configurados pela configuracoes.html e foca em resolver a dor educacional do cliente demonstrada na tela da jornada. Isso alinha UX com conversão.

Próximos Passos (Recomendados)
Como toda a estrutura visual e os fluxos de arquitetura da Versão 6 estão concluídos e compreendidos:

Integração Real de Dados: A Prateleira e a Carteira hoje rodam majoritariamente mockadas ou dependem do shelf-data. Com o processamento da Tab_Grupos_Consorcio.csv, o próximo passo fundamental é ligar os gráficos e os filtros do simulador V.6 e prateleira à base estática definitiva (JSON/CSV).
Refinamento de Conversão/UX: Implementar os "switches" (botões liga/desliga de preferências na configuracoes.html) para interagirem verdadeiramente com o localStorage e ditarem o nível de exibição dos gráficos em simulador.html.
Consolidação do Projeto: Organizar os scripts (js/) num build moderno ou adequar o escopo para deploy da plataforma final.
