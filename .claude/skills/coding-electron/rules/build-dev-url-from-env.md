---
title: Load the Vite dev URL from environment, never a hardcoded port
impact: HIGH
impactDescription: hardcoded 5173 fails when another process holds the port
tags: build, vite, dev
---

## Load the Vite dev URL from environment, never a hardcoded port

Em dev, `loadURL` lê a variável de ambiente do Vite (com fallback), nunca porta hardcoded.

**Incorrect:**

```typescript
await win.loadURL('http://localhost:5173')
```

**Correct:**

```typescript
const url = process.env.VITE_DEV_SERVER_URL ?? 'http://127.0.0.1:5173'
await win.loadURL(url)
```
