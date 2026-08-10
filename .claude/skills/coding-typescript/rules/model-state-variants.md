---
title: Model UI state as variants, not independent optional flags
impact: HIGH
impactDescription: isLoading + error + data all optional allows impossible states
tags: model, state, union
---

## Model UI state as variants, not independent optional flags

Estado com combinações impossíveis (`isLoading` + `error` + `data` todos opcionais soltos) é sinal de que falta uma união — modele estados válidos como variantes.

**Incorrect:**

```typescript
type State = { loading?: boolean; error?: string; data?: Item[] }
```

**Correct:**

```typescript
type State =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'error'; message: string }
  | { status: 'ready'; data: Item[] }
```
