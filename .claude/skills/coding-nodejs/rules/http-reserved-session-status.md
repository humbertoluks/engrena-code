---
title: Reserve unauthorized and locked statuses for session and vault
impact: CRITICAL
impactDescription: provider 401 can force a full app relock if the client treats any 401 as session death
tags: http, status, session, providers
---

## Reserve unauthorized and locked statuses for session and vault

Status de "não autorizado" / "cofre travado" são vocabulário reservado da sessão do app. O cliente HTTP do renderer pode tratar **qualquer** 401 como motivo para relockar o vault. Erro de credencial de provider terceiro nunca usa esses status — use corpo `success: false` em "test connection", ou um 4xx não reservado (ex.: 422) em ações que falham por key.

**Incorrect:**

```typescript
if (provider.status === 401) {
  sendError(res, 401, 'voice_auth_error', 'Chave rejeitada.')
}
```

**Correct:**

```typescript
if (provider.status === 401) {
  sendError(res, 422, 'voice_auth_error', 'Chave rejeitada.')
}
// or for test-connection endpoints:
sendJson(res, 200, { success: false, code: 'provider_auth_error' })
```
