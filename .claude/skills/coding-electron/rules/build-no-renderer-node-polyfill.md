---
title: Do not enable the Electron renderer Node polyfill unless the UI uses Node
impact: HIGH
impactDescription: vite-plugin-electron-renderer scans the renderer graph and dominates plugin time for no benefit
tags: build, vite, renderer, polyfill
---

## Do not enable the Electron renderer Node polyfill unless the UI uses Node

`vite-plugin-electron-renderer` existe para polifillar builtins Node no processo de UI. Se o renderer só fala com o host via preload/`contextBridge` e HTTP loopback, o plugin não tem consumidor: só alonga o build (PLUGIN_TIMINGS) e pode injetar shims. Não registre `renderer()` no Vite do app. Ligue o plugin só quando um módulo do renderer importar `fs` / `path` / `Buffer` de verdade (e nesse caso a fronteira já está errada).

**Incorrect (plugin sem consumidor Node no renderer):**

```typescript
import electron from 'vite-plugin-electron'
import renderer from 'vite-plugin-electron-renderer'

export default defineConfig({
  plugins: [react(), electron([...]), renderer()],
})
```

**Correct (só o plugin de main/preload):**

```typescript
import electron from 'vite-plugin-electron'

export default defineConfig({
  plugins: [react(), electron([...])],
})
```
