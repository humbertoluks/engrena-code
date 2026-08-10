---
title: Set ELECTRON_RUN_AS_NODE when spawning scripts with process.execPath
impact: HIGH
impactDescription: without it, Electron binary runs instead of Node in production
tags: process, spawn, electron
---

## Set ELECTRON_RUN_AS_NODE when spawning scripts with process.execPath

Spawn de script Node a partir do main usa `ELECTRON_RUN_AS_NODE: '1'` no `env` — `process.execPath` no main é o binário Electron, não Node puro. Sem essa env var o bridge falha só em produção (passa nos unitários em Node).

**Incorrect:**

```typescript
spawn(process.execPath, [script], { env: process.env })
```

**Correct:**

```typescript
spawn(process.execPath, [script], {
  env: { ...subset, ELECTRON_RUN_AS_NODE: '1' },
})
```
