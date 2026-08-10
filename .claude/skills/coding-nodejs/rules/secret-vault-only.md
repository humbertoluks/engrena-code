---
title: Store secrets only in the encrypted vault
impact: CRITICAL
impactDescription: keys in SQLite or HTTP responses are plaintext leaks
tags: secret, vault, storage
---

## Store secrets only in the encrypted vault

Segredo (chave de provider, credencial MCP/VCS) só no vault. Nunca em coluna SQLite, arquivo do projeto, `.env` commitado ou resposta HTTP — endpoint de config expõe só status "configurada", nunca o valor.

**Incorrect:**

```typescript
db.prepare('UPDATE config SET openai_key = ?').run(apiKey)
sendJson(res, 200, { openaiKey: apiKey })
```

**Correct:**

```typescript
await vault.setSecret('openai', apiKey)
sendJson(res, 200, { openaiConfigured: true })
```
