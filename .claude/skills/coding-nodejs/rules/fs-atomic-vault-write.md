---
title: Write the vault blob atomically via temp file and rename
impact: CRITICAL
impactDescription: in-place write can corrupt the envelope on crash
tags: fs, vault, atomic
---

## Write the vault blob atomically via temp file and rename

Escrita do envelope do cofre: `writeFileSync(tmpPath, …)` + `renameSync(tmpPath, vaultPath)`. Nunca write in-place no blob principal.

**Incorrect:**

```typescript
writeFileSync(vaultPath, encrypted)
```

**Correct:**

```typescript
const tmp = `${vaultPath}.tmp`
writeFileSync(tmp, encrypted, { mode: 0o600 })
renameSync(tmp, vaultPath)
```
