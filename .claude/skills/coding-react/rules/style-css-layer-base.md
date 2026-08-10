---
title: Put element CSS inside @layer base under Tailwind 4
impact: MEDIUM
impactDescription: unlayered rules beat utilities and cancel padding/margin
tags: style, tailwind, css-layers
---

## Put element CSS inside @layer base under Tailwind 4

Com `@import 'tailwindcss'`, utilitários ficam em `@layer utilities`. Regra de elemento *sem* layer vence layer e anula `p-*` / `m-*`. Envolva resets/estilos de elemento em `@layer base`. Não repita reset de margin/padding/box-sizing — o preflight já cobre.

**Incorrect:**

```css
button {
  margin: 0;
  padding: 0;
}
```

**Correct:**

```css
@layer base {
  button {
    font: inherit;
  }
}
```
