---
title: Ban production casts that force object shape after parse
impact: HIGH
impactDescription: as CreateInput after parseBody skips runtime checks
tags: boundary, cast
---

## Ban production casts that force object shape after parse

`as` que força a forma de um objeto em **produção** é erro. Em fake de teste (`fakeReq`/`fakeRes`) é aceito. Preferência: `narrowX(data: unknown)` com união discriminada.

**Incorrect:**

```typescript
const data = await parseBody<CreateInput>(req)
repo.create(data as CreateInput)
```

**Correct:**

```typescript
const data: unknown = await parseBody(req)
repo.create(narrowCreateInput(data))
```
