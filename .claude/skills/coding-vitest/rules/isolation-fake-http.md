---
title: Test HTTP handlers with fake req/res, not a real server
impact: MEDIUM
impactDescription: fake transport asserts status and body without port flakiness
tags: isolation, http, fakes
---

## Test HTTP handlers with fake req/res, not a real server

Handler HTTP é testado sem servidor real: fakes de `IncomingMessage`/`ServerResponse`, asserindo status + body JSON — cubra 2xx, 400 body inválido, unauthorized, vault locked, e 404/409 quando a rota tiver.

**Incorrect:**

```typescript
const server = createServer(handler).listen(0) // port races
```

**Correct:**

```typescript
const { req, res, getResult } = fakeHttp()
await handleCreate(req, res)
expect(getResult().status).toBe(201)
```
