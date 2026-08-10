---
title: Pair every preload method with a main-process channel
impact: HIGH
impactDescription: orphan methods or wrong handle vs on break callers
tags: ipc, pairing
---

## Pair every preload method with a main-process channel

Todo método do preload tem contraparte no main: `ipcMain.handle` quando há retorno, `ipcMain.on` para fire-and-forget de stream, `webContents.send` para o fluxo de volta. Método órfão ou `on` onde o chamador precisa do retorno é erro.

**Incorrect:**

```typescript
// preload
resize: (cols, rows) => ipcRenderer.invoke('app:terminal:resize', cols, rows)
// main never registered handle — hangs
```

**Correct:**

```typescript
// preload (fire-and-forget stream control)
resize: (cols, rows) => ipcRenderer.send('app:terminal:resize', cols, rows)
// main
ipcMain.on('app:terminal:resize', (_e, cols, rows) => { /* … */ })
```
