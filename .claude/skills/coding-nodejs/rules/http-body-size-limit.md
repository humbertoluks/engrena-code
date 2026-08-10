---
title: Bound request body size on every read path
impact: HIGH
impactDescription: unbounded body reads enable memory exhaustion
tags: http, body, limits
---

## Bound request body size on every read path

`readBody` compartilhado já tem teto. Rota que aceite payload maior (imagem, anexo) declara teto explícito próprio — nunca leitura sem limite.

**Incorrect:**

```typescript
const chunks: Buffer[] = []
for await (const c of req) chunks.push(c as Buffer) // unbounded
```

**Correct:**

```typescript
const MAX = 2 * 1024 * 1024
let size = 0
for await (const c of req) {
  size += (c as Buffer).length
  if (size > MAX) {
    sendError(res, 413, 'payload_too_large', 'Payload muito grande.')
    return
  }
  chunks.push(c as Buffer)
}
```
