---
title: Sanitize process stderr before it reaches the UI
impact: CRITICAL
impactDescription: git/CLI can echo tokens in messages shown to the user
tags: secret, redact, stderr
---

## Sanitize process stderr before it reaches the UI

Stderr / message que pode chegar à UI passa por um sanitizer. Ao adicionar scheme de URL autenticada (`oauth2:`, `x-token-auth:`, `https://:token@`) ou prefixo de provider, atualize o sanitizer **no mesmo diff** e cubra com teste que falha se o segredo sobreviver. Prefira redigir userinfo HTTPS genérico, não só um host.

Ordem importa: encurtamento de path antes da redação; padrão de senha não deve re-casar o marcador já redigido.

**Incorrect:**

```typescript
return { ok: false, message: stderr } // may contain https://user:token@host/repo.git
```

**Correct:**

```typescript
return { ok: false, message: sanitizeProcessError(stderr) }
// sanitizeProcessError redacts userinfo and provider key prefixes
```
