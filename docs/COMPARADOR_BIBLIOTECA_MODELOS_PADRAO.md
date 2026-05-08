# Comparador - Biblioteca de Modelos Padrao

Atualizado em 2026-04-25.

## Objetivo

Transformar modelos de comparacao governados em uma biblioteca reutilizavel por jornada financeira, reduzindo atrito para cliente e consultor iniciarem uma decisao com produtos, campos, riscos e premissas coerentes.

## Entregas

- Dados locais em `assets/data/modelos-comparador-padrao.json`.
- Pagina `pages/modelos-biblioteca.html`.
- Script `assets/js/modelos-biblioteca.js`.
- API local `BFComparatorModels.cloneStandard(template)`.
- Exibicao da biblioteca no dashboard cliente.
- Auditoria local com evento `clone-standard`.

## Modelos publicados

| ID | Jornada | Preset | Produtos |
| --- | --- | --- | --- |
| `std-liquidez-rapida` | Obter liquidez | `obter_liquidez` | CDC, garantia, consignado |
| `std-compra-bem-planejada` | Comprar bem | `comprar_bem` | Financiamento, consorcio, garantia |
| `std-troca-veiculo` | Trocar veiculo | `trocar_veiculo` | Financiamento, consorcio, consumo |
| `std-consumo-pontual` | Consumo pontual | `consumo_pontual` | CDC, consumo |

## Funcionamento

1. A biblioteca carrega os modelos padrao pelo `BFDadosService`.
2. O usuario filtra por busca, jornada ou preset.
3. Ao clonar, o modelo e salvo no escopo `bf_comparator_models_v1:<email>`.
4. O clone recebe `source='standard:<id>'`, `standardId`, versao de formula e referencia de premissas.
5. O comparador abre o clone por `comparador.html?modelo=<id>`.
6. O dashboard cliente mostra a biblioteca e os clones como atalhos de decisao.

## Riscos e guardrails

- Os modelos sao educativos e demonstrativos; nao representam oferta vinculante.
- Taxas e premissas sao locais e devem exibir data/referencia quando migradas para backend.
- O Open Finance e dados pessoais seguem em backlog ate haver consentimento, backend e trilha LGPD.
- Modelos padrao devem ser revisados por governanca antes de promocao para ambiente produtivo.

## Validacao

- Sintaxe JS aprovada.
- JSON com 4 modelos parseado com sucesso.
- Chrome headless validou biblioteca, clone, comparador por modelo e dashboard cliente.
- O modelo `std-liquidez-rapida` foi clonado com origem `standard:std-liquidez-rapida`.
- O comparador abriu o clone com CDC, credito com garantia e consignado.

## Proxima evolucao

Conectar a biblioteca ao motor de recomendacao para sugerir automaticamente o melhor modelo inicial por perfil, urgencia, renda, reserva e prioridade.
