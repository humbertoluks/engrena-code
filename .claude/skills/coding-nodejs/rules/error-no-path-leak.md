---
title: Never leak filesystem paths in API error messages
impact: CRITICAL
impactDescription: ENOENT messages expose absolute user paths
tags: error, path-leak, privacy
---

## Never leak filesystem paths in API error messages

Nunca interpole `err.message` de `fs` / `child_process` / `ENOENT` no JSON de erro — carrega path absoluto. Logue no console; mensagem ao usuário genérica na locale do produto.

**Incorrect:**

```typescript
catch (err) {
  sendError(res, 500, 'internal_error', String(err))
}
```

**Correct:**

```typescript
catch (err) {
  console.error('[files]', err)
  sendError(res, 500, 'internal_error', 'Não foi possível ler o arquivo.')
}
```
