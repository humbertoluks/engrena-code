---
title: Domain data goes through a service client, not raw fetch in screens
impact: CRITICAL
impactDescription: keeps session headers, base URL and error handling in one place
tags: boundary, fetch, service, api-client
---

## Domain data goes through a service client, not raw fetch in screens

Telas e componentes não montam `fetch` com headers de sessão. Todo dado de domínio passa por um service do renderer que usa um único cliente HTTP. Exceção deliberada: tela de unlock pública, antes de existir sessão.

**Incorrect (fetch na tela):**

```tsx
async function loadRules() {
  const res = await fetch(`${API_BASE}/api/rules`, {
    headers: { Authorization: `Bearer ${localStorage.getItem('sessionToken')}` },
  })
  return res.json()
}
```

**Correct (service + cliente único):**

```tsx
// rules-service.ts
import { apiRequest } from './api-client'

export function listRules() {
  return apiRequest<Rule[]>('/api/rules')
}

// RulesScreen.tsx
const rules = await rulesService.listRules()
```

See also: `boundary-single-api-client`.
