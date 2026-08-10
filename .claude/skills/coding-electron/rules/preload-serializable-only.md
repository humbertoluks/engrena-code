---
title: Preload only forwards serializable IPC payloads
impact: HIGH
impactDescription: business logic or non-cloneable returns break the bridge
tags: preload, serialization
---

## Preload only forwards serializable IPC payloads

Preload não contém regra de negócio, cache nem transformação: só repassa argumento → main → retorno serializável (objeto plano). Nunca `BrowserWindow`, stream, `Buffer` grande ou classe.

**Incorrect:**

```typescript
getWindow: () => mainWindow // non-cloneable
```

**Correct:**

```typescript
getSession: () => ipcRenderer.invoke('app:vault:get-session')
```
