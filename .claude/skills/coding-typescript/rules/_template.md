---
title: Rule Title Here
impact: MEDIUM
impactDescription: Optional
tags: tag1
---

## Rule Title Here

**Incorrect:**

```typescript
const bad = 1 as any
```

**Correct:**

```typescript
const good: unknown = 1
```
