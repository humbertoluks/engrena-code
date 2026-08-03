# unlock-cofre, Design Técnico

> Como POST /vault/unlock → session token é construído no legado.

## Interface

### POST /vault/unlock

| Campo body | Tipo | Papel | Confiança |
|------------|------|-------|-----------|
| `password` | string | senha do cofre | 🟢 |
| `workspace` | string | workspace path (obrigatório) | 🟢 |

Resposta sucesso: `{ unlocked: true }` 🟢 — token **não** vai no body HTTP (`VaultUnlockResponse` em `shared/src/vault.ts`)  
Resposta falha senha / backoff: `{ unlocked: false }` (+ `retryAfterMs?`) 🟢  
Corrupted: `VaultCorruptedError` → HTTP distinto 🟢

### Header autenticado

`x-lioncode-session: <token>` (`SESSION_HEADER` em `session-auth.ts:19`) — nunca query string 🟢

### Shell IPC

| Canal | Direção | Payload | Confiança |
|-------|---------|---------|-----------|
| `lioncode:vault:session-token` | invoke | token \| null | 🟢 |
| `lioncode:vault:locked` | push | void | 🟢 |

**Proibido:** provider keys, mcpSecrets via IPC 🟢

## Fluxo Principal

1. Renderer exibe gate de login (cofre travado) 🟢
2. User submete senha → `fetch POST /vault/unlock` (HTTP loopback) 🟢
3. Rate limiter global verifica teto 🟢
4. vault.unlock:
   - Se backoff activo → retryAfterMs, skip derive 🟢
   - Se sem vault.enc → init envelope 🟢
   - scrypt derive → AES decrypt 🟢
   - Normaliza payload legado 🟢
   - Gera session token 32B hex in-process (não serializado na resposta HTTP) 🟢
5. Renderer chama `getSessionToken` via IPC e guarda em memória 🟢
6. Requests subsequentes: header `x-lioncode-session` 🟢
7. Pós-reload: preload `getSessionToken` re-sincroniza token 🟢

## Fluxos Alternativos

- **Rate limit exceeded:** 429 antes de unlock 🟢
- **VaultCorruptedError:** UI distingue de senha errada 🟢
- **Lock timeout/inactivity:** onLock → token null + IPC event 🟢
- **WS reconnect:** exige token válido 🟢

## Dependências

- `vault/vault.ts` — unlock implementation 🟢
- `routes/vault-unlock.ts` — HTTP binding 🟢
- `http/rate-limiter.ts` — global limit 🟢
- `middleware/session-auth.ts` — validação token 🟢
- `shell/preload.ts` + `main.ts` — IPC bridge token-only 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Unlock HTTP, não IPC | routes/vault-unlock | 🟢 |
| Token via IPC shell só espelha vault | main.ts bridge | 🟢 |
| Credenciais HTTP-only pós-unlock | domain R2 + shell | 🟢 |
| Dual protection: rate limit + backoff | rate-limiter + vault | 🟢 |

## Estado Interno

| Campo | Onde | Notas |
|-------|------|-------|
| sessionToken | vault in-memory | null se locked |
| failedAttempts | vault per workspace | threshold 5 |
| backoffUntil | vault | clampDelay max 60s |

## Observabilidade

- retryAfterMs na resposta 🟢
- Sem log de senha/token 🟢

## Riscos e Lacunas

- 🟡 TTL session token (expiração automática)
- 🔴 Fluxo exacto reload página + getSessionToken vs memória renderer
