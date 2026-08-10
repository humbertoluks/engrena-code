---
title: Wrap async handler bodies in try/catch
impact: HIGH
impactDescription: unhandled rejection hangs the HTTP request
tags: error, catch, async
---

## Wrap async handler bodies in try/catch

Envolva o corpo async em `try/catch`. Se `!res.headersSent`, responda erro interno genérico. Promise que rejeita sem catch pendura o request.

**Incorrect:**

```typescript
export async function handleCreate(req, res): Promise<boolean> {
  if (!guard(req, res)) return true
  const data = await parseBody(req)
  const row = await repo.create(data) // may throw
  sendJson(res, 201, row)
  return true
}
```

**Correct:**

```typescript
export async function handleCreate(req, res): Promise<boolean> {
  if (!guard(req, res)) return true
  try {
    const data = await parseBody(req)
    const row = await repo.create(narrow(data))
    sendJson(res, 201, row)
  } catch (err) {
    console.error('[create]', err)
    if (!res.headersSent) sendError(res, 500, 'internal_error', 'Erro interno.')
  }
  return true
}
```
