---
title: Do not export symbols without a real production consumer
impact: MEDIUM
impactDescription: dead exports rot and fake a public API
tags: layer, exports, dead-code
---

## Do not export symbols without a real production consumer

Não exporte símbolo sem consumidor de produção fora do próprio arquivo. Mantenha local até existir um segundo consumidor real. Teste pode importar a superfície pública ou um helper de teste — não justifique export só por teste.

**Incorrect:**

```typescript
export function getTokens() { /* only used in this file + tests */ }
```

**Correct:**

```typescript
function getTokens() { /* local */ }
export function startOauth() { return getTokens() /* … */ }
```
