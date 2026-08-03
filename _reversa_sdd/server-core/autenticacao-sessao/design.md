# autenticacao-sessao, Design Técnico

> Cofre local, token de sessão e gates HTTP/WS.

## Interface

### Header HTTP

| Nome | Valor | Observação |
|------|-------|------------|
| `X-sistema-legado-Session` | token opaco | Lido como `x-lioncode-session` (lower case) 🟢 |
| Ausente / inválido | 401 `session_invalid` | Corpo JSON padronizado 🟢 |

Constante exportada: `SESSION_HEADER = 'x-lioncode-session'`. 🟢

### Vault (contrato usado pelos middlewares)

| Método | Papel | Confiança |
|--------|-------|-----------|
| `isUnlocked()` | vaultGuard | 🟢 |
| `verifySessionToken(token)` | sessionAuth / WS | 🟢 |
| `unlock(...)` | rota pública | 🟢 |
| `lock()` / `onLock(cb)` | invalida sessões | 🟢 |
| `getSessionToken()` | bridge shell IPC | 🟢 |

### Rotas públicas

| Rota | Flag | Confiança |
|------|------|-----------|
| `vault-unlock` | `public: true` | 🟢 |
| Sentinela 404/405 router | `public` implícito | 🟢 |
| Demais rotas | protegidas default | 🟢 |

## Fluxo Principal (HTTP)

1. `originGuard` valida Host/Origin 🟢
2. `errorHandler` envolve cadeia 🟢
3. `vaultGuard`: se `!route.public && !vault.isUnlocked()` → throw `VaultLockedError` 🟢
4. `sessionAuth`: se `!route.public` e policy exige → lê header → `verifySessionToken` 🟢
5. Middlewares downstream (validation, scope, transaction) 🟢

## Fluxo Principal (unlock)

1. Cliente POST rota unlock (`public`) após originGuard 🟢
2. Rate limiter opcional (`buildUnlockRateLimitConfig`) 🟢
3. Vault valida passphrase / credenciais 🟢
4. Emite token de sessão; shell cacheia para IPC 🟢
5. Renderer passa header em todas as chamadas subsequentes 🟢

## Fluxo Alternativo (lock)

1. Usuário trava cofre ou timeout 🟡
2. `onLock` → shell emite `lioncode:vault:locked` 🟢
3. Tokens anteriores invalidados 🟢
4. WS connections dropadas no próximo emit/handshake 🟡

## Dependências

- `vault/` — cifra e sessão 🟢
- `http/error-response.ts` — `rejectWithSecurityError` 🟢
- `config.ts` — session policy e rate limits 🟢
- Shell preload IPC — entrega token sem expor Node no renderer 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| sessionAuth **após** vaultGuard | Comentário MEDIO-001 | 🟢 |
| Token nunca query string | session-auth + ws/server | 🟢 |
| `public` explícito por rota | vault-unlock.ts | 🟢 |
| Relaxação só sessionAuth em testes | `sessionPolicy.required` | 🟢 |

## Estado Interno

| Estado | Onde |
|--------|------|
| Cofre locked/unlocked | Vault singleton |
| Token(s) de sessão ativos | Vault (memória) |
| Rate limit unlock | Rate limiter module |

Sem tabela `sessions` no SQLite — sessão é efêmera em memória. 🟢

## Observabilidade

- Warn em acesso bloqueado por cofre (sem token) 🟢
- Sem audit log persistente de unlock 🟡

## Riscos e Lacunas

- 🔴 TTL/expiração exacta do token de sessão
- 🟡 Lista completa de rotas `public` futuras além unlock
- 🟡 Comportamento multi-janela Electron com tokens distintos
