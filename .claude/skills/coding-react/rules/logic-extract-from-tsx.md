---
title: Extract business rules out of TSX into testable modules
impact: HIGH
impactDescription: UI components are hard to unit-test; pure logic is not
tags: logic, testability, extraction
---

## Extract business rules out of TSX into testable modules

Validação, filtro, formatação, ordenação, clamp e habilitação de botão não vivem no `.tsx`. Extraia para um módulo puro (`*.logic.ts` ou equivalente) com teste irmão. O componente só renderiza, faz wiring de evento e chama o service.

**Incorrect (regra no JSX):**

```tsx
function SaveButton({ name, key }: Props) {
  const disabled = name.trim().length < 2 || !key.startsWith('sk-')
  return <button disabled={disabled}>Salvar</button>
}
```

**Correct (regra no módulo puro):**

```typescript
// form.logic.ts
export function canSave(name: string, key: string): boolean {
  return name.trim().length >= 2 && key.startsWith('sk-')
}

// Form.tsx
<button disabled={!canSave(name, key)}>Salvar</button>
```
