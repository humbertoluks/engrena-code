---
title: Add forward-only numbered migrations; never edit applied ones
impact: CRITICAL
impactDescription: editing applied migrations forks schema across installs
tags: migration, schema
---

## Add forward-only numbered migrations; never edit applied ones

Migration nova: `NNN_<assunto>.ts` no próximo número livre. **Nunca edite** migration já aplicada — schema novo é sempre migration nova. Evite colisão de número (dois `001_` é dívida; não repita).

**Incorrect:**

```typescript
// edit 003_rules.ts to add a column on machines that already applied it
```

**Correct:**

```typescript
// add 014_rules_archived.ts with ALTER TABLE …
```
