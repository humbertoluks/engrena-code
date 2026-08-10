---
title: Narrow every body field before touching the repository
impact: HIGH
impactDescription: parseBody only types at compile-time; runtime body is unknown
tags: http, narrowing, validation
---

## Narrow every body field before touching the repository

`parseBody<T>` tipa em compile-time; o body real é `unknown`. Estreite todo campo com `typeof` (e `Array.isArray` quando couber) antes do repositório. Nunca `data as CreateInput` pós-parse.

**Incorrect:**

```typescript
const data = await parseBody<CreateInput>(req)
repo.create(data as CreateInput)
```

**Correct:**

```typescript
const data: unknown = await parseBody(req)
if (!data || typeof data !== 'object') return badRequest(res)
const body = data as Record<string, unknown>
if (typeof body.name !== 'string') return badRequest(res, 'invalid_request')
if (typeof body.enabled !== 'boolean') return badRequest(res, 'invalid_request')
if (body.args !== undefined && !Array.isArray(body.args)) return badRequest(res, 'invalid_request')
repo.create({ name: body.name, enabled: body.enabled, args: body.args as string[] })
```
