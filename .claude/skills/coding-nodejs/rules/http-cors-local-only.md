---
title: Restrict CORS to local origins only
impact: CRITICAL
impactDescription: wildcard CORS on a loopback API exposes the session to the web
tags: http, cors, security
---

## Restrict CORS to local origins only

API loopback local só libera origens locais (`127.0.0.1`, `localhost`, `null` de `file://`). Nunca `Access-Control-Allow-Origin: *`.

**Incorrect:**

```typescript
res.setHeader('Access-Control-Allow-Origin', '*')
```

**Correct:**

```typescript
function isAllowedOrigin(origin: string | undefined): boolean {
  if (!origin || origin === 'null') return true
  try {
    const u = new URL(origin)
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost'
  } catch {
    return false
  }
}
```
