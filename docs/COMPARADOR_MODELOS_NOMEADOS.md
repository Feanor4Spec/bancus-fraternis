# Comparador - Modelos Nomeados

Atualizado em 2026-04-25.

## Objetivo

Transformar uma matriz de comparacao em um modelo reutilizavel, nomeado e reaberto por URL local.

## Entregas

- Campo `Nome do modelo` no resumo do comparador.
- Botao `Salvar modelo` para persistir a matriz atual.
- Lista local com modelos recentes.
- Acoes `Abrir`, `Aplicar` e `Excluir`.
- Abertura direta por `comparador.html?modelo=<id>`.
- Dashboard cliente com atalhos dos modelos salvos.

## Persistencia local

Os modelos usam escopo por usuario:

```text
localStorage['bf_comparator_models_v1:<email-ou-anon>']
```

Sem login, o escopo usado e `anon`. Com login, o e-mail do usuario autenticado define a chave.

## Estrutura do modelo

| Campo | Funcao |
| --- | --- |
| `id` | Identificador local usado na URL |
| `name` | Nome dado pelo usuario |
| `preset` | Preset base: manual, comprar bem, obter liquidez, trocar veiculo ou consumo pontual |
| `fields` | Snapshot dos campos da matriz |
| `productIds` | Produtos ou colunas ativos |
| `userEmail` | Usuario local dono do modelo |
| `createdAt` | Data de criacao |
| `updatedAt` | Ultima atualizacao |

## Jornada validada

1. Login como `cliente@bankfratern.local`.
2. Abertura de `comparador.html?preset=obter_liquidez`.
3. Salvamento do modelo `Liquidez rapida cliente`.
4. Persistencia em `bf_comparator_models_v1:cliente@bankfratern.local`.
5. Reabertura por `comparador.html?modelo=<id>`.
6. Restauracao de CDC, Credito com garantia e Consignado.
7. Exibicao do atalho no dashboard cliente.

## Evidencias

- `docs/test-prints/comparador-modelos-nomeados-desktop.png`
- `docs/test-prints/comparador-modelo-aberto-desktop.png`
- `docs/test-prints/dashboard-cliente-modelos-comparador-desktop.png`
- `docs/test-prints/comparador-modelos-nomeados-mobile.png`

## Proxima evolucao

- Criar pagina dedicada de governanca comercial de modelos.
- Permitir filtros por usuario, origem, preset e produtos ativos.
- Preparar aprovacao de modelos padrao para consultores.
