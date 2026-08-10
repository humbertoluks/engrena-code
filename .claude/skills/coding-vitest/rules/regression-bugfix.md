---
title: Every bug fix includes a regression test that fails without the fix
impact: HIGH
impactDescription: missing regressions let the same production-only bugs return
tags: regression, bugfix
---

## Every bug fix includes a regression test that fails without the fix

Correção de bug **sempre** vem com teste que reproduz o bug. Ausência disso deixa falhas só-em-produção (env flags, schemes de URL) voltarem.

**Incorrect:**

```typescript
// fix applied in source, no new failing-then-passing test
```

**Correct:**

```typescript
it('rejects provider 401 without treating it as session unauthorized', async () => {
  // arrange provider to return 401
  const result = await handleVoice(req, res)
  expect(getResult().status).toBe(422)
})
```
