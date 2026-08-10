---
title: Give real process tests an explicit timeout
impact: MEDIUM
impactDescription: default 5s flakes under load for git/spawn suites
tags: hygiene, timeout, flaky
---

## Give real process tests an explicit timeout

Teste que exercita git/spawn reais leva vários segundos por arquivo contra timeout default curto e falha intermitente sob carga. Caso novo com processo real nasce com `testTimeout` explícito. Antes de tratar vermelho como regressão, rode a suíte de novo; se o conjunto de falhas mudar, é flaky.

**Incorrect:**

```typescript
it('pushes to remote', async () => {
  await gitPush(…) // often > 5s
})
```

**Correct:**

```typescript
it('pushes to remote', async () => {
  await gitPush(…)
}, 30_000)
```
