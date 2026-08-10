---
title: Expose only named methods on the preload bridge
impact: CRITICAL
impactDescription: generic invoke/send passthrough defeats channel allowlists
tags: preload, contextBridge, ipc
---

## Expose only named methods on the preload bridge

Preload só expõe métodos nomeados via `contextBridge`, agrupados por domínio. Não existe passthrough genérico (`invoke` / `send` / `on` cru) para o renderer: expor um anula a allowlist.

**Incorrect:**

```typescript
contextBridge.exposeInMainWorld('api', {
  invoke: (ch, ...a) => ipcRenderer.invoke(ch, ...a),
})
```

**Correct:**

```typescript
contextBridge.exposeInMainWorld('api', {
  vault: {
    getSession: () => ipcRenderer.invoke('app:vault:get-session'),
    lock: () => ipcRenderer.invoke('app:vault:lock'),
  },
  dialog: {
    openFolder: () => ipcRenderer.invoke('app:dialog:open-folder'),
  },
})
```
