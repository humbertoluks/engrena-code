---
title: Claim only your own HTTP routes
impact: HIGH
impactDescription: returning true or 401 for another prefix shadows the owning handler
tags: http, routing, claim
---

## Claim only your own HTTP routes

Handler só reivindica rota do seu domínio. Para path alheio, retorne `false` (não trate) — nunca `true` ou 401 de prefixo que outro handler possui.

**Incorrect:**

```typescript
export async function handleSkills(req, res): Promise<boolean> {
  if (!req.url?.startsWith('/api/')) return false
  if (!guard(req, res)) return true
  sendError(res, 404, 'not_found', 'Não encontrado.')
  return true // claimed every /api/* miss
}
```

**Correct:**

```typescript
export async function handleSkills(req, res): Promise<boolean> {
  if (!req.url?.startsWith('/api/skills')) return false
  if (!guard(req, res)) return true
  // …only skills routes
  return true
}
```
