---
title: Never store secrets in renderer localStorage
impact: CRITICAL
impactDescription: credentials in browser storage leak via XSS and dumps
tags: boundary, localStorage, secrets
---

## Never store secrets in renderer localStorage

`localStorage` do renderer guarda só token de sessão, preferência de tema e filas/UX sem credencial. Nunca chave de provider, token VCS ou segredo de MCP.

**Incorrect:**

```typescript
localStorage.setItem('openaiKey', apiKey)
localStorage.setItem('githubToken', token)
```

**Correct:**

```typescript
localStorage.setItem('sessionToken', sessionToken)
localStorage.setItem('theme', 'dark')
// provider keys live in the encrypted vault on the host, never here
```
