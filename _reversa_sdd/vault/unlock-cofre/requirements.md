# unlock-cofre

> Caso de uso do módulo `vault`: desbloqueio HTTP → session token.  
> Escopo: POST /vault/unlock, backoff, rate limit — credenciais **não** via shell IPC.

## Visão Geral

Permitir que o renderer desbloqueie o cofre via HTTP (`POST /vault/unlock` → `{ unlocked, retryAfterMs? }`), obtenha o session token efêmero via IPC shell (`getSessionToken`) para autenticar requests com header `x-lioncode-session`, e garantir que credenciais nunca trafeguem pelo bridge IPC (shell só repassa token). 🟢 [Revisão]

## Responsabilidades

- Expor `POST /vault/unlock` como única rota pública de negócio de unlock 🟢
- Rate limit global antes do handler 🟢
- Backoff por workspace após falhas repetidas 🟢
- Derivar chave scrypt, decifrar envelope, normalizar payload legado 🟢
- Emitir session token (32 bytes hex) 🟢
- Distinguir senha errada de cofre corrompido 🟢
- Shell: getSessionToken via IPC (token only); onVaultLocked no lock 🟢

## Regras de Negócio

- Token **nunca** em query string nem body de respostas ecoadas indevidamente 🟢
- Senha enviada só no body do unlock; nunca persistida 🟢
- Após 5 falhas: backoff exponencial 1s×2^over, teto 60s 🟢
- Rate limit global complementa backoff (não substitui) 🟢
- Primeiro unlock sem arquivo: inicializa envelope vazio 🟢
- Credenciais provider/MCP **somente** HTTP server-side pós-unlock 🟢
- Shell IPC: session token yes; secrets no 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | POST /vault/unlock aceita senha no body | Must | rota public |
| RF-02 | Sucesso: unlocked=true; token via IPC | Must | HTTP sem token; getSessionToken após unlock |
| RF-03 | Falha senha: unlocked=false (sem leak corrompido) | Must | anti-enumeração |
| RF-04 | Backoff: retryAfterMs após threshold | Must | não testa senha em backoff |
| RF-05 | Rate limit global na rota unlock | Must | 429 ou equivalente |
| RF-06 | Cliente usa header `x-lioncode-session` | Must | SESSION_HEADER em session-auth.ts |
| RF-07 | Shell getSessionToken IPC (não secrets) | Must | preload bridge |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência | Confiança |
|------|--------------------|-----------|-----------|
| Segurança | timingSafeEqual token compare | vault.ts | 🟢 |
| Segurança | Secrets fora IPC shell | shell + vault docs | 🟢 |
| Disponibilidade | Backoff anti-bruteforce | vault.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado cofre travado e senha correcta
Quando renderer POST /vault/unlock e depois getSessionToken via IPC
Então unlocked true e token utilizável em x-lioncode-session

Dado senha incorrecta
Quando POST /vault/unlock
Então unlocked false sem VaultCorruptedError

Dado 5+ falhas consecutivas
Quando novo unlock tentado
Então retryAfterMs presente; senha não testada durante backoff

Dado cofre desbloqueado
Quando renderer chama getSessionToken via preload
Então recebe token; nunca recebe provider keys via IPC

Dado lock invocado
Quando onLock corre
Então getSessionToken retorna null; evento vault:locked no renderer
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | Gate de entrada da app |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/routes/vault-unlock.ts` | POST /vault/unlock | 🟢 |
| `packages/server/src/vault/vault.ts` | unlock, token | 🟢 |
| `packages/server/src/http/rate-limiter.ts` | rate limit | 🟢 |
| `packages/server/src/middleware/session-auth.ts` | X-sistema-legado-Session | 🟢 |
| `packages/shell/src/preload.ts` | getSessionToken | 🟢 |
| `packages/shell/src/main.ts` | IPC session token | 🟢 |
