---
title: Run the unit suite before closing a production change
impact: MEDIUM
impactDescription: unrun suites ship silent regressions
tags: hygiene, gate
---

## Run the unit suite before closing a production change

Rode a suíte de unit (`pnpm test` ou equivalente do repo) sempre que alterar código de produção coberto pela tarefa, antes de considerar a mudança fechada.

**Incorrect:**

```text
Changed handler.ts → opened PR without running tests
```

**Correct:**

```text
Changed handler.ts → pnpm test green → then close the task
```
