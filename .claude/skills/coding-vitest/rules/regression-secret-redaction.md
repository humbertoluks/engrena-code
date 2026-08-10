---
title: Cover every new secret scheme with a redaction regression test
impact: CRITICAL
impactDescription: uncovered schemes leak tokens into UI-bound stderr
tags: regression, secrets, redact
---

## Cover every new secret scheme with a redaction regression test

Ao estender sanitizer / inject de token VCS / prefixo de provider: teste que **falha se o segredo sobreviver**. Cobrir só um host (`x-access-token`) não basta — um caso por scheme/prefixo.

**Incorrect:**

```typescript
expect(sanitize(msg)).not.toContain('x-access-token:secret')
// oauth2: / x-token-auth: / https://:token@ / xai- uncovered
```

**Correct:**

```typescript
for (const sample of [
  'https://oauth2:SECRET@gitlab.com/x.git',
  'https://x-token-auth:SECRET@bitbucket.org/x.git',
  'https://:SECRET@dev.azure.com/x/_git/y',
  'Authorization: Bearer xai-SECRET',
]) {
  expect(sanitize(sample)).not.toContain('SECRET')
}
```
