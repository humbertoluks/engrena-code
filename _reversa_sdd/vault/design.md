# vault, Design Técnico

> Como o cofre local cifrado é construído no legado.

## Interface

### createVault

| Parâmetro | Tipo | Papel | Confiança |
|-----------|------|-------|-----------|
| `vaultDir` | string | userData / ao lado DB | 🟢 |

Retorno: API vault com unlock, lock, getters/setters, getSessionToken, onLock 🟢

### VaultEnvelope

| Campo | Papel | Confiança |
|-------|-------|-----------|
| version, workspace | metadata | 🟢 |
| kdf + salt | scrypt params | 🟢 |
| cipher, iv, authTag, data | AES-GCM blob | 🟢 |

### VaultPayload (em memória)

providerKeys, vcsTokens, claudeAuthMode, mcpSecrets, mcpOauth, transcriptionKeys 🟢

### Session token

32 bytes hex; validado com `timingSafeEqual`; exposto via getSessionToken (IPC shell) 🟢

## Fluxo Principal

1. Boot `server.ts`: `createVault({ vaultDir })` 🟢
2. Cadeia HTTP: `vaultGuard` → `sessionAuth` → handler 🟢
3. Unlock (rota pública): rate limit → backoff → derive key → decrypt → normalize legacy → emit token 🟢
4. Requests autenticados: header `X-sistema-legado-Session` 🟢
5. Reads/writes credenciais exigem unlocked; persist re-cifra envelope 🟢
6. Lock: zero key memory, invalidate token, onLock callbacks 🟢

## Fluxos Alternativos

- **Primeiro unlock (sem arquivo):** inicializa envelope vazio 🟢
- **Senha errada:** `{ unlocked: false }`; backoff após threshold=5 🟢
- **Corrupted envelope:** VaultCorruptedError 🟢
- **Normalização legado:** githubToken → vcsTokens.github 🟢
- **setProviderKeys parcial:** campo vazio preserva valor 🟢
- **updateTranscriptionKeys:** clone→mutate→persist→rollback se fail 🟢

## Dependências

- `shared` — tipos keys 🟢
- Middleware vault-guard, session-auth 🟢
- Rotas config/mcp/vcs — leitura credenciais 🟢
- `runner` — MCP secrets resolve 🟢
- `shell` — IPC session token + onLock 🟢
- WS — close 1008 on lock 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| authTag = verificador de senha | crypto.ts | 🟢 |
| Write atômico .tmp→rename | store.ts | 🟢 |
| Token só header, nunca query | session-auth + unlock route | 🟢 |
| Shell só token, não secrets | shell main comentários | 🟢 |
| OAuth MCP namespace separado | vault.ts | 🟢 |

## Estado Interno

| Estado | Onde | Notas |
|--------|------|-------|
| UnlockedState | in-memory | workspace, key, salt, payload |
| sessionToken | in-memory | invalidado no lock |
| backoff counters | in-memory por workspace | threshold 5, max 60s |
| vault.enc | filesystem | mode 0600 |

## Observabilidade

- Rate limiter global unlock 🟢
- retryAfterMs em resposta unlock 🟢
- Sem audit log dedicado 🟡

## Riscos e Lacunas

- 🟡 TTL/expiração exacta do session token (se houver)
- 🔴 Política multi-workspace no mesmo userData
