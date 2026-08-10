---
title: Never leave focused or skipped tests in the diff
impact: MEDIUM
impactDescription: it.only hides the rest of the suite in CI
tags: hygiene, skip, only
---

## Never leave focused or skipped tests in the diff

Nunca deixe `it.skip` / `describe.skip` / `it.only` / `describe.only` no diff mergeável.

**Incorrect:**

```typescript
it.only('debug this', () => { /* … */ })
```

**Correct:**

```typescript
it('covers the case', () => { /* … */ })
```
