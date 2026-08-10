---
title: Distinguish corrupted vault from wrong password
impact: HIGH
impactDescription: collapsing both cases leaks existence and blocks recovery UX
tags: layer, vault, errors
---

## Distinguish corrupted vault from wrong password

Envelope estruturalmente ilegível → erro de corrupção (ex.: 422). Senha errada continua resposta de unlock falho sem distinguir enumeração. Nunca colapse os dois.

**Incorrect:**

```typescript
catch {
  return { unlocked: false } // also hides corruption
}
```

**Correct:**

```typescript
if (!looksLikeEnvelope(raw)) throw Object.assign(new Error('vault_corrupted'), { code: 'vault_corrupted' })
if (!verifyPassword(raw, password)) return { unlocked: false }
return { unlocked: true, sessionToken }
```
