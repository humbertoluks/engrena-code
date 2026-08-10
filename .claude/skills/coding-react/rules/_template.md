---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional description of impact
tags: tag1, tag2
---

## Rule Title Here

**Impact: MEDIUM (optional impact description)**

Brief explanation of the rule and why it matters. Frontmatter and slug in English; body in PT-BR. No project paths, product names, feature IDs, or audit IDs.

**Incorrect (description of what's wrong):**

```typescript
// Bad code example here
const bad = example()
```

**Correct (description of what's right):**

```typescript
// Good code example here
const good = example()
```

Optional note. Reference: [Link](https://example.com) when useful.

## Impact levels (risk, not performance)

- `CRITICAL` — secret leak or production break
- `HIGH` — functional bug
- `MEDIUM` — maintainability / coupling
- `LOW` — hygiene
