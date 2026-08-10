---
title: Move repeated SQL into the owning repository
impact: MEDIUM
impactDescription: copied queries drift across handlers
tags: repo, dry, sql
---

## Move repeated SQL into the owning repository

Query SQL repetida em dois arquivos pertence ao repositório da entidade — mova para lá em vez de copiar.

**Incorrect:**

```typescript
// handler A and handler B both prepare the same JOIN
```

**Correct:**

```typescript
// repositories/project-skills.ts
export function listLinkedSkillIds(projectId: string): string[] { /* … */ }
```
