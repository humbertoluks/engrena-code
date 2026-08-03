# vault

> Spec de requisitos do cofre local cifrado (`packages/server/src/vault`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Cofre local cifrado em repouso (`vault.enc`): desbloqueio por senha, credenciais só em memória após unlock, session token para autenticação HTTP/WS no loopback, e gate HTTP (`vaultGuard` + `sessionAuth`). Shell entrega token via IPC; credenciais **nunca** via shell IPC. 🟢

## Responsabilidades

- `createVault`: unlock/lock, payload, backoff, session token 🟢
- Cifra: scrypt KDF + AES-256-GCM 🟢
- Persistência: envelope JSON, write atômico (temp+fsync+rename), perms 0600 🟢
- `vaultGuard`: bloqueia rotas não-`public` se travado (423) 🟢
- `sessionAuth`: exige header `X-sistema-legado-Session` (401 se inválido) 🟢
- Rate limit global de unlock 🟢
- `onLock`: invalida token, WS 1008 + IPC shell 🟢

## Regras de Negócio

- Senha nunca persistida; só chave derivada em runtime 🟢
- Segredos MCP/OAuth/STT nunca no SQLite nem ecoados em HTTP 🟢
- Anti-enumeração: senha errada ≠ cofre corrompido 🟢
- Rate limit global complementa (não substitui) backoff por workspace 🟢
- `claudeAuthMode` default = subscription; só `api-key` explícito muda 🟢
- Token nunca em query string; só header `X-sistema-legado-Session` 🟢
- Namespace OAuth MCP separado de `mcpSecrets` 🟢
- Credenciais shell: **somente** session token IPC, não secrets 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Boot createVault com vaultDir em userData | Must | vault.enc path resolvido |
| RF-02 | Unlock deriva chave, decifra, emite session token | Must | unlocked=true + token |
| RF-03 | Senha errada: unlocked=false; backoff após 5 falhas | Must | retryAfterMs se backoff |
| RF-04 | Envelope ilegível → VaultCorruptedError (distinto) | Must | não confundir com senha errada |
| RF-05 | vaultGuard 423 se travado; sessionAuth 401 se token inválido | Must | cadeia middleware |
| RF-06 | Lock zera chave, invalida token, onLock | Must | UI volta ao gate |
| RF-07 | Persistência re-cifra payload inteiro em write | Must | write atômico 0600 |
| RF-08 | setProviderKeys merge parcial (campo vazio preserva) | Should | save parcial seguro |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | scrypt N=2^15 + AES-GCM authTag | crypto.ts | 🟢 |
| Segurança | timingSafeEqual no token | vault.ts | 🟢 |
| Disponibilidade | Backoff exponencial teto 60s | vault.ts clampDelay | 🟢 |
| Durabilidade | Write atômico temp→rename | store.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado cofre travado
Quando cliente chama rota protegida sem unlock
Então vaultGuard retorna 423

Dado unlock com senha correcta
Quando POST /vault/unlock completa
Então session token emitido; rotas aceitam X-sistema-legado-Session

Dado senha incorrecta repetida
Quando falhas >= 5
Então backoff activo; retryAfterMs devolvido sem testar senha

Dado envelope corrompido
Quando unlock tenta decifrar
Então VaultCorruptedError (distinto de senha errada)

Dado lock invocado
Quando onLock dispara
Então token invalidado; shell emite vault:locked; WS 1008
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | Gate de segurança global |
| RF-08 | Should | UX save parcial keys |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/vault/vault.ts` | createVault, unlock, lock | 🟢 |
| `packages/server/src/vault/crypto.ts` | scrypt, AES-GCM | 🟢 |
| `packages/server/src/vault/store.ts` | envelope, write atômico | 🟢 |
| `packages/server/src/middleware/vault-guard.ts` | vaultGuard | 🟢 |
| `packages/server/src/middleware/session-auth.ts` | sessionAuth | 🟢 |
| `packages/server/src/routes/vault-unlock.ts` | POST /vault/unlock | 🟢 |
| `packages/server/src/http/rate-limiter.ts` | rate limit unlock | 🟢 |
