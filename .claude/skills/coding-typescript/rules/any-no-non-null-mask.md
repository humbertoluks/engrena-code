---
title: Prefer explicit checks over non-null assertions and empty fallbacks
impact: MEDIUM
impactDescription: ! and ?? {} hide missing data until runtime
tags: any, null, assertions
---

## Prefer explicit checks over non-null assertions and empty fallbacks

`!` (non-null assertion) e `?? {}` mascarando ausência real: prefira checagem explícita com erro nomeado.

**Incorrect:**

```typescript
const user = map.get(id)!
const opts = input.options ?? {}
```

**Correct:**

```typescript
const user = map.get(id)
if (!user) throw new Error('user_not_found')
const opts = input.options
if (!opts) throw new Error('options_required')
```
