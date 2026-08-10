---
title: Delete or wire dead scaffolds in the same change
impact: MEDIUM
impactDescription: parallel auth middleware beside guard() confuses the next session
tags: isolation, dead-code
---

## Delete or wire dead scaffolds in the same change

Módulo sem consumidor concreto (scaffold morto, ponte paralela ao `guard()`) não sobrevive: delete ou ligue na mesma mudança.

**Incorrect:**

```typescript
// session-middleware.ts exists but nothing imports it; handlers use guard()
```

**Correct:**

```typescript
// remove the unused module, or make every protected route use it — not both
```
