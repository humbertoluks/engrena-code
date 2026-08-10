---
title: Check vault lock before session auth in HTTP guards
impact: CRITICAL
impactDescription: locked vault must not surface as unauthorized
tags: http, guard, vault, session
---

## Check vault lock before session auth in HTTP guards

Em handler HTTP protegido, o guard checa cofre travado **antes** do token de sessão. Cofre travado → status de "locked"; token ausente/divergente → "unauthorized". Nunca inverter: cofre travado atrás de unauthorized esconde o estado real e sombreia handlers.

**Incorrect (token antes do lock):**

```typescript
function guard(req, res): boolean {
  if (!isAuthorized(req)) {
    sendError(res, 401, 'unauthorized', 'Não autorizado.')
    return false
  }
  if (vault.isLocked()) {
    sendError(res, 423, 'vault_locked', 'Cofre travado.')
    return false
  }
  return true
}
```

**Correct (lock → auth):**

```typescript
function guard(req, res): boolean {
  if (vault.isLocked()) {
    sendError(res, 423, 'vault_locked', 'Cofre travado.')
    return false
  }
  if (!isAuthorized(req)) {
    sendError(res, 401, 'unauthorized', 'Não autorizado.')
    return false
  }
  return true
}
```
