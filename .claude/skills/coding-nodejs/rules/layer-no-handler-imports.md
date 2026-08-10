---
title: Domain modules must not import HTTP handlers
impact: HIGH
impactDescription: layer inversion couples runner/db to transport details
tags: layer, import, architecture
---

## Domain modules must not import HTTP handlers

Domínio (`runner/`, `db/`, `git/`, `vcs/`) **nunca importa** de `*-handler.ts`. Constante/config compartilhada vai para módulo neutro importado dos dois lados.

**Incorrect:**

```typescript
// runner/apply-catalog.ts
import { SKILL_LIMIT } from '../http/skills-handler'
```

**Correct:**

```typescript
// skills/defaults.ts
export const SKILL_LIMIT = 50
// http/skills-handler.ts and runner/apply-catalog.ts both import defaults
```
