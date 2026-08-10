---
title: Keep Allow-Methods in sync with every routed verb
impact: HIGH
impactDescription: missing PATCH/PUT breaks real browser preflight while unit tests pass
tags: http, cors, methods
---

## Keep Allow-Methods in sync with every routed verb

`Access-Control-Allow-Methods` precisa listar **todo** método que algum handler do servidor usa. Janela Electron/browser faz preflight real: método faltando quebra a feature em produção, não no teste que chama o handler direto.

**Incorrect:**

```typescript
res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
// memory-handler uses PATCH — preflight fails
```

**Correct:**

```typescript
res.setHeader(
  'Access-Control-Allow-Methods',
  'GET, POST, PUT, PATCH, DELETE, OPTIONS',
)
// when adding a handler with a new verb, update this allowlist in the same diff
```
