---
title: Share validation with the server from one pure module
impact: HIGH
impactDescription: duplicated literals drift and accept invalid keys on one side
tags: logic, validation, shared, dry
---

## Share validation with the server from one pure module

Não re-declare comprimento mínimo, prefixos de key nem mensagens de formato no cliente se o servidor já valida. Importe o validador puro e adapte o retorno à UX (`string | null`). Drift cliente/servidor é bloqueador.

**Incorrect (literals duplicados):**

```typescript
// form.logic.ts
const MIN = 20
const PREFIX = 'sk-ant-'
export function validateKey(key: string): string | null {
  if (!key.startsWith(PREFIX) || key.length < MIN) return 'Chave inválida.'
  return null
}
```

**Correct (fonte única):**

```typescript
// shared/provider-keys.ts (pure — no fs/electron)
export function validateProviderKey(key: string): { ok: true } | { ok: false; code: string }

// form.logic.ts
import { validateProviderKey } from '../shared/provider-keys'

export function keyError(key: string): string | null {
  const r = validateProviderKey(key)
  return r.ok ? null : 'Chave inválida.'
}
```

Canonical copy of the TypeScript-side rule: see `coding-typescript` → `contract-shared-validation`.
