---
title: Prefer module functions over factories without polymorphism
impact: HIGH
impactDescription: createXRepository returning one object is abstraction without use
tags: repo, kiss, factory
---

## Prefer module functions over factories without polymorphism

`createXRepository()` que só devolve `{ list, create, … }` sem segunda implementação real é abstração sem uso concreto. Exporte funções direto. Factory só com fake injetável em teste **e** uma segunda implementação real.

**Incorrect:**

```typescript
export function createRulesRepository() {
  return { list, create, update, remove }
}
export const rulesRepository = createRulesRepository()
```

**Correct:**

```typescript
export function listRules() { /* getDb()… */ }
export function createRule(input: CreateRule) { /* … */ }
```
