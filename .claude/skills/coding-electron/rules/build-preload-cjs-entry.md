---
title: Build preload as a distinct CJS library entry
impact: HIGH
impactDescription: main and preload both named index.ts collide in dist-electron
tags: build, vite, preload
---

## Build preload as a distinct CJS library entry

Declare `main` e `preload` com entries distintos. Ambos são `index.ts` e colidem em `dist-electron/index.js` se não separar `build.lib` / `formats: ['cjs']` / `fileName: 'preload.cjs'` para o preload.

**Incorrect:**

```typescript
electron({ entry: 'electron/main/index.ts' })
electron({ entry: 'electron/preload/index.ts' }) // overwrites same outfile
```

**Correct:**

```typescript
electron([
  { entry: 'electron/main/index.ts' },
  {
    entry: 'electron/preload/index.ts',
    vite: {
      build: {
        lib: { formats: ['cjs'], fileName: () => 'preload.cjs' },
      },
    },
  },
])
```
