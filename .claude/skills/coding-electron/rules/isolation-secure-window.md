---
title: Keep nodeIntegration off and contextIsolation on
impact: CRITICAL
impactDescription: weakening these flags exposes Node to untrusted UI
tags: isolation, BrowserWindow, security
---

## Keep nodeIntegration off and contextIsolation on

Toda `BrowserWindow` usa `nodeIntegration: false`, `contextIsolation: true` e um preload empacotado. Nunca afrouxe para resolver bug pontual.

**Incorrect:**

```typescript
webPreferences: { nodeIntegration: true, contextIsolation: false }
```

**Correct:**

```typescript
webPreferences: {
  nodeIntegration: false,
  contextIsolation: true,
  preload: path.join(__dirname, 'preload.cjs'),
}
```
