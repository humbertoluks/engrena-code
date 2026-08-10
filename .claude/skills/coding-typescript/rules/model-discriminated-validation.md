---
title: Model validation results as discriminated unions
impact: HIGH
impactDescription: boolean plus side message loses exhaustiveness
tags: model, union, validation
---

## Model validation results as discriminated unions

Resultado de validação usa **união discriminada**, não booleano com mensagem por fora.

**Incorrect:**

```typescript
function validate(k: string): boolean {
  lastError = '…'
  return false
}
```

**Correct:**

```typescript
type ValidationResult =
  | { ok: true; action: 'save'; key: string }
  | { ok: true; action: 'skip' }
  | { ok: false; message: string }
```
