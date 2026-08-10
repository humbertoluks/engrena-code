---
title: Cover repository constraints and ordering in a sibling test
impact: HIGH
impactDescription: handler-only tests miss UNIQUE and ORDER BY bugs
tags: test, sibling, constraints
---

## Cover repository constraints and ordering in a sibling test

Todo repositório novo (ou tocado com mudança de comportamento) tem `*.test.ts` irmão cobrindo: happy path, cada constraint/conflito, cada `code` de erro, ordenação e paginação quando existir.

**Incorrect:**

```typescript
// only skills-handler.test.ts hits createSkill indirectly
```

**Correct:**

```typescript
// skills.test.ts
it('rejects duplicate name', () => {
  createSkill({ name: 'a' })
  expect(() => createSkill({ name: 'a' })).toThrow(/unique/i)
})
```
