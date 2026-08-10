---
title: One shared HTTP client for authenticated requests
impact: HIGH
impactDescription: prevents duplicated session headers and divergent error handling
tags: boundary, api-client, dry
---

## One shared HTTP client for authenticated requests

Não crie `fetch` + headers de sessão em cada `*-service.ts`. Um único módulo cliente centraliza base URL, header de sessão, tratamento de 401/423 e parse de erro.

**Incorrect (headers duplicados por service):**

```typescript
export async function listSkills() {
  const res = await fetch(`${BASE}/api/skills`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  return res.json()
}

export async function listRules() {
  const res = await fetch(`${BASE}/api/rules`, {
    headers: { Authorization: `Bearer ${token()}` },
  })
  return res.json()
}
```

**Correct (um cliente):**

```typescript
// api-client.ts
export async function apiRequest<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    ...init,
    headers: { ...init?.headers, Authorization: `Bearer ${token()}` },
  })
  if (!res.ok) throw await toApiError(res)
  return res.json() as Promise<T>
}

// skills-service.ts / rules-service.ts
export const listSkills = () => apiRequest<Skill[]>('/api/skills')
export const listRules = () => apiRequest<Rule[]>('/api/rules')
```
