# Home Institucional do Usuario

Atualizado em 2026-04-25.

## Objetivo

Reposicionar a pagina inicial do Bank Fratern como uma porta institucional orientada ao usuario final. A Home deixa de abrir como painel operacional e passa a explicar o valor principal do produto: transformar informacoes financeiras em diagnostico, simulacoes conectadas e proximas acoes claras.

## Referencia usada

- `C:/Users/gustavo.pinheiro/Downloads/documentacao_bloco_ecossistema_calculadoras_v2.md`
- `C:/Users/gustavo.pinheiro/Downloads/documentacao_bloco_ecossistema_calculadoras_v2 (1).html`

## O que foi implementado

| Bloco | Entrega |
| --- | --- |
| Hero institucional | Mensagem centrada no usuario: entender vida financeira antes de escolher credito, consorcio ou investimento. |
| Empresa e produtos | Apresenta o Bank Fratern e suas frentes de diagnostico, credito/consorcio/comparacao e investimentos antes de pedir dados pessoais. |
| Perfil financeiro unico | Card conceitual que conecta renda, gastos, reserva e metas. |
| Diagnostico rapido | Formulario local com renda, despesas, dividas, investimentos, meses de reserva e objetivo. |
| Score educativo | Indicador prototipado de saude financeira com recomendacao contextual. |
| Jornada do usuario | Informar contexto, receber diagnostico, simular caminhos e decidir com clareza. |
| Ecossistema conectado | Links para diagnostico, comparacao de credito e investimentos. |
| Prova de plataforma | Base real, historico local e grupos em destaque em secao secundaria. |
| Governanca | Privacidade, memoria de calculo e recomendacao responsavel. |

## Regras da previa local

- A Home calcula apenas uma previa educativa.
- Os dados digitados no bloco de diagnostico rapido nao sao persistidos.
- O score apresentado nao e score de credito.
- Simulacoes completas seguem nas calculadoras e devem exibir memoria de calculo, premissas e alertas.
- A ordem da Home deve apresentar empresa/produtos antes do bloco `#perfil-unico`.

## Evidencias

- `docs/test-prints/home-institutional-desktop.png`
- `docs/test-prints/home-institutional-mobile.png`
- `docs/test-prints/home-order-profile-after-products.png`
