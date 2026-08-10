---
title: One stable error code per semantic case across handlers
impact: MEDIUM
impactDescription: inventing invalid_json beside invalid_request fragments client handling
tags: http, error-code, vocabulary
---

## One stable error code per semantic case across handlers

Um `error.code` por caso semântico em todo o repo (ex.: body/campo inválido → `invalid_request`). Não invente sinônimos (`invalid_json`, `bad_body`) num handler novo.

**Incorrect:**

```typescript
sendError(res, 400, 'invalid_json', 'JSON inválido.')
```

**Correct:**

```typescript
sendError(res, 400, 'invalid_request', 'JSON inválido.')
```
