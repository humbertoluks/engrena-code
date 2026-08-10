---
title: Prefer one shared validator test over duplicated client/server suites
impact: MEDIUM
impactDescription: dual suites drift; one pure module stays honest
tags: regression, shared-validation
---

## Prefer one shared validator test over duplicated client/server suites

Quando cliente e servidor compartilham regra, prefira fonte única testada uma vez. Se ainda houver adaptador no `*.logic.ts`, teste de paridade ou import direto evita drift.

**Incorrect:**

```typescript
// form.logic.test.ts re-implements prefix checks
// handler.test.ts re-implements the same literals
```

**Correct:**

```typescript
// provider-keys.test.ts owns the canonical cases
// form.logic.test.ts only checks UX mapping of the shared result
```
