# Guia de Implementação — Bank Fratern Design System

## 1. Instalação rápida

Copie a pasta `assets/` para a raiz do seu projeto.

Inclua os arquivos CSS nesta ordem:

```html
<link rel="stylesheet" href="assets/css/tokens.css">
<link rel="stylesheet" href="assets/css/components.css">
<link rel="stylesheet" href="assets/css/utilities.css">
<link rel="stylesheet" href="assets/css/home.css">
<link rel="stylesheet" href="assets/css/journey.css">
```

## 2. Uso de logos

### Home e onboarding
```html
<img src="assets/logos/logo-bank-fratern-portal.svg" alt="Bank Fratern" class="bf-brand__logo">
```

### Dashboard e apresentação executiva
```html
<img src="assets/logos/logo-bank-fratern-compass.svg" alt="Bank Fratern">
```

### Jornada do consorciado
```html
<img src="assets/logos/logo-bf-journey.svg" alt="BF Journey">
```

## 3. Uso de ícones

```html
<div class="bf-stage-card">
  <div class="bf-stage-card__icon">
    <img src="assets/icons/journey/07-contemplacao.svg" alt="">
  </div>
  <div>
    <h3>Contemplação</h3>
    <p>Direito ao crédito, não liberação automática.</p>
  </div>
</div>
```

## 4. Uso de fotos/imagens

```html
<img src="assets/photos/photo-01-direction.png" alt="Direção estratégica Bank Fratern">
```

## 5. Uso de criativos

```html
<img src="assets/creatives/hero-data.svg" alt="Inteligência financeira">
```

## 6. Mapa de uso

| Contexto | Logo | Imagem | Ícones |
|---|---|---|---|
| Home institucional | Portal | photo-01-direction / hero-direction | UI compass, shield |
| Home produto | Portal ou Compass | photo-10-dashboard / hero-data | UI graph, calculator |
| Jornada | BF Journey | photo-02-access | 12 ícones journey |
| Simulador | BF Simulator | photo-04-data | calculator, graph |
| Dashboard | BF Intelligence | hero-dashboard | graph, AI, document |
