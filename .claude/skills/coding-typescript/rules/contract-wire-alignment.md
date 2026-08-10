---
title: Keep client and server wire contracts field-aligned
impact: HIGH
impactDescription: renamed fields on one side cause silent runtime gaps
tags: contract, wire, dto
---

## Keep client and server wire contracts field-aligned

Contrato de wire duplicado entre service do renderer e handler/repositório precisa bater campo a campo. Tipo compartilhado ou teste de contrato evita divergência silenciosa.

**Incorrect:**

```typescript
// client expects { projectId }; server returns { project_id }
```

**Correct:**

```typescript
// shared/types/project-link.ts
export type ProjectLinkDto = { projectId: string; enabled: boolean }
// both sides import ProjectLinkDto
```
