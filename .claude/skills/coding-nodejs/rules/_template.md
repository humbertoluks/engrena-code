---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional description of impact
tags: tag1, tag2
---

## Rule Title Here

**Impact: MEDIUM (optional impact description)**

Brief explanation. Frontmatter/slug in English; body in PT-BR. No project paths, product names, feature IDs, or audit IDs.

**Incorrect (description of what's wrong):**

```typescript
const bad = example()
```

**Correct (description of what's right):**

```typescript
const good = example()
```

## Impact levels (risk)

- `CRITICAL` — secret leak or production break
- `HIGH` — functional bug
- `MEDIUM` — maintainability / coupling
- `LOW` — hygiene
