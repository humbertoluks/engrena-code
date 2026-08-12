---
title: Split heavy vendor libraries into named bundler groups
impact: HIGH
impactDescription: one minified entry over 500 kB trips the Vite/Rolldown chunk warning and delays first paint
tags: build, vite, rolldown, code-splitting
---

## Split heavy vendor libraries into named bundler groups

Além de `React.lazy` no app, configure grupos de code-splitting no bundler para libs pesadas (`react`/`react-dom`, markdown, terminal, grafo). Não deixe o aviso de chunk > 500 kB ser “resolvido” só subindo `chunkSizeWarningLimit`, salvo módulo atômico impossível de fatiar (uma grammar TextMate).

**Incorrect (um entry, limite silenciado):**

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 2000,
  },
})
```

**Correct (grupos nomeados + limite só para módulo unsplittable):**

```typescript
export default defineConfig({
  build: {
    chunkSizeWarningLimit: 700, // single TextMate grammar, not the app entry
    rolldownOptions: {
      output: {
        codeSplitting: {
          groups: [
            { name: 'react-vendor', test: /node_modules[\\/](?:react|react-dom)[\\/]/ },
            { name: 'markdown', test: /node_modules[\\/](?:react-markdown|remark-|rehype-|unified)[\\/]/ },
            { name: 'xterm', test: /node_modules[\\/]@xterm[\\/]/ },
            { name: 'xyflow', test: /node_modules[\\/]@xyflow[\\/]/ },
          ],
        },
      },
    },
  },
})
```

Em Rollup clássico o equivalente é `output.manualChunks`. Não misture os dois: se `codeSplitting` está setado, `manualChunks` é ignorado.
