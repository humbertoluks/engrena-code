---
title: One repository file per entity, plural kebab-case name
impact: MEDIUM
impactDescription: mixed entities in one file hide ownership
tags: repo, naming
---

## One repository file per entity, plural kebab-case name

Repositório novo: nome plural da entidade, kebab-case, um arquivo por entidade.

**Incorrect:**

```text
db/repositories/data.ts  # rules + skills + mcps
```

**Correct:**

```text
db/repositories/rules.ts
db/repositories/skills.ts
db/repositories/mcps.ts
```
