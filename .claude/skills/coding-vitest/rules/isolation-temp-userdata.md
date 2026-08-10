---
title: Isolate tests with a temporary userData directory
impact: CRITICAL
impactDescription: tests must never touch the real vault or userData
tags: isolation, userdata, vault
---

## Isolate tests with a temporary userData directory

Defina a env var de userData do app para um `mkdtempSync` **antes** dos `import()` dinâmicos que tocam DB/vault; limpe em `afterAll` com close + `rmSync`. Nunca deixe um teste tocar o vault real do usuário. O nome da env var fica no `project.md`.

**Incorrect:**

```typescript
import { getDb } from './client' // uses real userData
```

**Correct:**

```typescript
import { mkdtempSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

const dir = mkdtempSync(join(tmpdir(), 'app_test_'))
process.env.APP_USER_DATA = dir

const { getDb, closeDb } = await import('./client')

afterAll(() => {
  closeDb()
  rmSync(dir, { recursive: true, force: true })
})
```
