---
title: Use loadFile for production renderer HTML beside dist-electron
impact: HIGH
impactDescription: file:// with ../../../dist breaks path resolution on Windows packaging
tags: build, production, loadFile
---

## Use loadFile for production renderer HTML beside dist-electron

Em produção: `loadFile(path.join(__dirname, '../dist/index.html'))`. Nunca `file://` + caminho relativo profundo — o builder empacota `dist` ao lado de `dist-electron` e `file://` quebra no Windows.

**Incorrect:**

```typescript
await win.loadURL(`file://${path.join(__dirname, '../../../dist/index.html')}`)
```

**Correct:**

```typescript
await win.loadFile(path.join(__dirname, '../dist/index.html'))
```
