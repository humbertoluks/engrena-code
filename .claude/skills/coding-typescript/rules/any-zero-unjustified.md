---
title: Zero unjustified any
impact: CRITICAL
impactDescription: any disables the type checker at the worst boundaries
tags: any, strict
---

## Zero unjustified any

`any` novo é erro, salvo comentário na linha explicando por que `unknown` + narrowing não serve. Inclui preload e helpers.

**Incorrect:**

```typescript
function handle(payload: any) {
  return payload.id
}
```

**Correct:**

```typescript
function handle(payload: unknown) {
  if (!payload || typeof payload !== 'object' || !('id' in payload)) return null
  const id = (payload as { id: unknown }).id
  return typeof id === 'string' ? id : null
}
```
