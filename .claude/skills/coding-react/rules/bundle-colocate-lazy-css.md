---
title: Colocate feature CSS with the lazy module that needs it
impact: HIGH
impactDescription: global CSS imports force vite:css-post to process unused library styles on every page
tags: bundle, css, lazy, code-splitting
---

## Colocate feature CSS with the lazy module that needs it

CSS de biblioteca que só vale num painel lazy (grafo, terminal, editor) não entra no `index.css` global. Importe o stylesheet no módulo lazy. O chunk CSS viaja com o JS; a primeira pintura não paga o pós-processamento nem o download.

**Incorrect (CSS de feature no entry global):**

```css
@import 'tailwindcss';
@import '@xyflow/react/dist/style.css';
@import '@xterm/xterm/css/xterm.css';
```

**Correct (CSS no componente lazy):**

```tsx
import { ReactFlow } from '@xyflow/react'
import '@xyflow/react/dist/style.css'

export function GraphPanel() {
  return <ReactFlow nodes={[]} edges={[]} />
}
```

```tsx
import { Terminal } from '@xterm/xterm'
import '@xterm/xterm/css/xterm.css'
```

Estilos de elemento do app continuam em `@layer base` no CSS global. Só o CSS *da feature* muda de lugar.
