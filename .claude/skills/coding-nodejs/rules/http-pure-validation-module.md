---
title: Keep key and token format validators in a pure shared module
impact: HIGH
impactDescription: handlers and renderer must not re-declare prefix literals
tags: http, validation, shared
---

## Keep key and token format validators in a pure shared module

Validação de formato de key/token vive em módulo puro (sem `fs`/`electron`). Handler importa dali; o renderer também — não re-declare literals no handler.

**Incorrect:**

```typescript
// handler
if (!key.startsWith('sk-ant-') || key.length < 20) return badRequest(res)
```

**Correct:**

```typescript
import { validateProviderKey } from '../shared/provider-keys'
const result = validateProviderKey(key)
if (!result.ok) return badRequest(res, 'invalid_request')
```

See also: `coding-react` → `logic-shared-server-validation`.
