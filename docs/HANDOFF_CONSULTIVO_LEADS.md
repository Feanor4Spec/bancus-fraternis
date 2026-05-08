# Handoff Consultivo e Leads Locais - Bank Fratern

Atualizado em 2026-04-25.

## Objetivo

A Fase 4O transforma uma trilha assistida salva em um lead consultivo local. A implementacao nao envia dados para terceiros: tudo fica em `localStorage`, como camada estatica/progressiva para validar fluxo de atendimento antes de backend.

## Componentes

| Componente | Arquivo | Funcao |
| --- | --- | --- |
| Servico de handoff | `assets/js/services/handoff-consultivo.service.js` | Cria leads, atualiza status, checklist, notas, responsavel e auditoria |
| Painel consultivo | `pages/handoff-consultivo.html` | Lista leads, filtra, abre detalhe e acompanha atendimento |
| UI do painel | `assets/js/handoff-consultivo.js` | Renderiza metricas, cards, detalhe, timeline e formularios |
| Trilha assistida | `pages/trilha-decisao.html` | Gera ou atualiza handoff local a partir da jornada |
| Dashboard cliente | `pages/dashboard-cliente.html` | Mostra handoff vinculado a trilha e permite criar/atualizar |
| Dashboard admin | `pages/dashboard-admin.html` | Exibe resumo da fila local de leads |

## Chaves locais

| Chave | Conteudo |
| --- | --- |
| `bf_consultive_handoffs_v1` | Lista global local de handoffs consultivos |
| `bf_consultive_handoff_audit_v1` | Eventos de criacao, atualizacao, status, checklist, notas e responsavel |
| `bf_decision_journey_v1:<email-ou-anon>` | Trilha ativa usada como fonte do handoff |

## Modelo funcional do lead

| Campo | Descricao |
| --- | --- |
| `id` | Identificador local `LEAD-*` |
| `sourceJourneyId` | Trilha que originou o handoff |
| `ownerEmail` | Usuario local dono da trilha |
| `status` | `novo`, `em_atendimento`, `aguardando_cliente`, `qualificado` ou `descartado` |
| `priority` | `alta`, `media` ou `baixa`, derivada de urgencia, valor, reserva e risco |
| `summary` | Objetivo, produto, modelo, capacidade, reserva, credito alvo e proxima acao |
| `checklist` | Itens obrigatorios e opcionais para atendimento |
| `notes` | Notas locais do consultor/admin |
| `timeline` | Historico local do lead |

## Checklist padrao

- Validar renda, custos, dividas e reserva informados.
- Confirmar objetivo declarado pelo usuario.
- Revisar modelo recomendado e premissas do comparador.
- Validar taxa, CET, prazo, garantias e custos acessorios antes de proposta real.
- Registrar alertas de reserva, comprometimento e suitability educativa.
- Definir proxima conversa, simulacao detalhada ou encerramento.

## Regras de prioridade

| Condicao | Prioridade |
| --- | --- |
| Urgencia alta + reserva pressionada ou alerta da trilha | Alta |
| Urgencia alta ou credito alvo acima de R$ 100.000 | Alta |
| Urgencia baixa sem gap de reserva | Baixa |
| Demais casos | Media |

## Status operacional

| Status | Uso |
| --- | --- |
| Novo | Handoff criado e ainda nao tratado |
| Em atendimento | Consultor iniciou avaliacao |
| Aguardando cliente | Falta informacao ou retorno do usuario |
| Qualificado | Lead pronto para proxima etapa comercial |
| Descartado | Lead encerrado localmente sem continuidade |

## Validacoes de aceite

- Criar uma trilha assistida e clicar `Gerar handoff local`.
- Confirmar registro em `localStorage['bf_consultive_handoffs_v1']`.
- Abrir `pages/handoff-consultivo.html` como admin ou consultor.
- Confirmar card do lead, detalhe, checklist, status, responsavel e nota.
- Alterar status para `Qualificado` e marcar checklist.
- Abrir `pages/dashboard-admin.html` e confirmar resumo da fila.
- Abrir `pages/dashboard-cliente.html` e confirmar o handoff vinculado a trilha.

## Evolucoes futuras

- Sincronizar handoffs com API propria.
- Adicionar consentimento explicito antes de qualquer envio externo.
- Criar funil comercial com SLA, responsavel e origem de campanha.
- Gerar resumo consultivo exportavel sem dados sensiveis excessivos.
