---
title: Open only HTTPS URLs for OAuth and remote auth redirects
impact: CRITICAL
impactDescription: http:// redirects enable credential theft
tags: http, oauth, https
---

## Open only HTTPS URLs for OAuth and remote auth redirects

Endpoint OAuth/remoto só abre `https://`, validado com `typeof === 'string' && url.startsWith('https://')`.

**Incorrect:**

```typescript
shell.openExternal(tokenUrl) // whatever the provider returned
```

**Correct:**

```typescript
if (typeof tokenUrl !== 'string' || !tokenUrl.startsWith('https://')) {
  throw new Error('oauth_url_not_https')
}
await shell.openExternal(tokenUrl)
```
