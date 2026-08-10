---
title: Persist through getDb in repository modules; no JSON stores under db/
impact: CRITICAL
impactDescription: fs/json under repositories/ breaks the SQLite contract
tags: repo, sqlite, storage
---

## Persist through getDb in repository modules; no JSON stores under db/

Arquivo sob `db/repositories/` persiste via `getDb()` + SQLite. **Não** coloque store em `*.json` / `fs` / `electron.app` sob esse path — migre para SQLite ou mova o módulo para outro path e documente na spec.

**Incorrect:**

```typescript
// db/repositories/skills.ts
writeFileSync(join(userData, 'skills.json'), JSON.stringify(rows))
```

**Correct:**

```typescript
getDb().prepare('INSERT INTO skills (…) VALUES (…)').run(…)
```
