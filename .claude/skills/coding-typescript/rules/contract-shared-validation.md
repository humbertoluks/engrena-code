---
title: Validate limits and key formats against one canonical pure module
impact: HIGH
impactDescription: duplicated literals drift between renderer and handlers
tags: contract, validation, dry
---

## Validate limits and key formats against one canonical pure module

Limite, enum e formato de key/token validam contra a **fonte canônica** pura (sem `fs`/`electron`), nunca contra literal duplicado no renderer ou num segundo handler. Ao adicionar prefixo de segredo novo, atualize também a redação de stderr (Stack Node.js) no mesmo diff.

**Incorrect:**

```typescript
// logic.ts
if (!key.startsWith('xai-')) return 'invalid'
// handler.ts
if (!key.startsWith('xai-')) return badRequest(res)
```

**Correct:**

```typescript
import { validateProviderKey } from '../shared/provider-keys'
```

See also: `coding-react` → `logic-shared-server-validation`; `coding-nodejs` → `http-pure-validation-module`.
