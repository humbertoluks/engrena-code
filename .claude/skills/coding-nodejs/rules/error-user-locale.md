---
title: User-facing API errors use the product locale
impact: MEDIUM
impactDescription: mixed-language errors confuse UI and smoke assertions
tags: error, locale, i18n
---

## User-facing API errors use the product locale

Mensagem em `{ error: { code, message } }` volta na locale do produto (inclusive CORS e catch-all 404). Logs de console do processo host podem ficar em inglês. O locale concreto fica no `project.md`.

**Incorrect:**

```typescript
sendError(res, 403, 'cors_denied', 'Origin not allowed.')
```

**Correct:**

```typescript
sendError(res, 403, 'cors_denied', 'Origem não permitida.')
```
