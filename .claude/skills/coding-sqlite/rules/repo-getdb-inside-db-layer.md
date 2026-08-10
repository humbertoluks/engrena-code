---
title: Keep production getDb calls inside the db layer
impact: HIGH
impactDescription: handlers calling getDb bypass the repository boundary
tags: repo, layer
---

## Keep production getDb calls inside the db layer

Acesso a SQLite passa pelo repositório da entidade. `getDb()` de produção fora de `db/**` é desvio, não precedente (testes podem importar para setup).

**Incorrect:**

```typescript
// http/rules-handler.ts
const rows = getDb().prepare('SELECT * FROM rules').all()
```

**Correct:**

```typescript
import { listRules } from '../db/repositories/rules'
const rows = listRules()
```
