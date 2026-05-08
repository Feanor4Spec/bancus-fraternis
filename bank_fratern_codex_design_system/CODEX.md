# Prompt para Codex — Implementar Design System Bancus Fraternis

Você é um agente de código responsável por implementar o Design System Bancus Fraternis em um projeto HTML/CSS/JS.

## Objetivo
Aplicar a identidade visual Bancus Fraternis na ferramenta, usando os assets, componentes e documentação deste pacote.

## Contexto de marca
Nome: Bancus Fraternis
Lema: CAPITAL • TRUST • LEGAC  
Pilares: capital, trust, legacy, direção, acesso, segurança e clareza financeira.

## Arquivos disponíveis
- `assets/css/tokens.css`
- `assets/css/components.css`
- `assets/css/utilities.css`
- `assets/css/home.css`
- `assets/css/journey.css`
- `assets/logos/`
- `assets/icons/journey/`
- `assets/icons/ui/`
- `assets/photos/`
- `assets/creatives/`
- `assets/registry/assets.json`

## Tarefa principal
1. Criar ou refatorar a página inicial usando `examples/home-final.html` como referência.
2. Aplicar o CSS do design system na ordem correta.
3. Substituir emojis por ícones SVG da pasta `assets/icons/journey/`.
4. Usar `logo-bank-fratern-portal.svg` na home.
5. Usar `logo-bf-journey.svg` na página da jornada.
6. Usar imagens de `assets/photos/` ou banners de `assets/creatives/` em heros e cards.
7. Preservar responsividade.
8. Manter acessibilidade básica: `alt`, contraste, hierarquia de headings e navegação por links.

## Regras de implementação
- Não criar uma nova paleta fora dos tokens.
- Não usar dourado como cor de corpo de texto longo.
- Não remover explicações financeiras essenciais.
- Não apresentar contemplação como liberação imediata do bem.
- Não depender de imagens externas.

## Critérios de aceite
- A home abre sem dependências externas.
- Todos os caminhos de assets funcionam.
- A navegação é responsiva.
- A página da jornada usa ícones SVG, não emojis.
- O resultado usa a identidade Bancus Fraternis: navy + gold + cards premium.
- O código está separado em HTML, CSS e JS quando fizer sentido.

## Saída esperada
Entregue:
- Arquivos HTML atualizados.
- Lista de arquivos alterados.
- Breve explicação das decisões.
- Pontos pendentes, se existirem.
