---
title: Validate numeric IPC arguments with finite bounds
impact: HIGH
impactDescription: typeof number accepts NaN and huge dimensions
tags: ipc, validation, bounds
---

## Validate numeric IPC arguments with finite bounds

Argumento numérico perigoso (ex.: `cols`/`rows` de PTY) exige faixa finita, não só `typeof === 'number'`.

**Incorrect:**

```typescript
if (typeof cols !== 'number' || typeof rows !== 'number') return
```

**Correct:**

```typescript
function isValidPtyDimension(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 500
}
if (!isValidPtyDimension(cols) || !isValidPtyDimension(rows)) return
```
