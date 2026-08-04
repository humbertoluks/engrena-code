# unlock-cofre, Tarefas de Implementação

> Reimplementar fluxo HTTP unlock → session token (sem secrets via IPC).

## Pré-requisitos

- [ ] T-01…T-05 de `vault/tasks.md` (crypto, store, vault core)
- [ ] Server HTTP loopback acessível do renderer
- [ ] Shell preload/main IPC channels definidos

## Tarefas

- [ ] T-01, Rota POST /vault/unlock (surface public)
  - Origem no legado: `packages/server/src/routes/vault-unlock.ts`
  - Critério de pronto: unlock com password+workspace; resposta `{ unlocked }` sem token
  - Confiança: 🟢

- [ ] T-02, Integrar rate limiter global na rota unlock
  - Origem no legado: `packages/server/src/http/rate-limiter.ts` + vault-unlock route
  - Critério de pronto: excesso bloqueado antes de derive
  - Confiança: 🟢

- [ ] T-03, Backoff workspace no unlock (retryAfterMs)
  - Origem no legado: `packages/server/src/vault/vault.ts` (clampDelay)
  - Critério de pronto: pós-5 falhas; skip password test em backoff
  - Confiança: 🟢

- [ ] T-04, sessionAuth middleware valida `x-sistema-legado-session`
  - Origem no legado: `packages/server/src/middleware/session-auth.ts`
  - Critério de pronto: 401 sem header; timingSafeEqual
  - Confiança: 🟢

- [ ] T-05, Shell IPC getSessionToken (token only) — canal obrigatório pós-unlock
  - Origem no legado: `packages/shell/src/main.ts`, `preload.ts`
  - Critério de pronto: invoke retorna token|null; zero secrets; único meio de obter o token no renderer
  - Confiança: 🟢

- [ ] T-06, onLock → IPC vault:locked + getSessionToken null
  - Origem no legado: `main.ts` vault.onLock handler
  - Critério de pronto: renderer volta ao gate
  - Confiança: 🟢

- [ ] T-07, Renderer: unlock via fetch HTTP + getSessionToken IPC
  - Origem no legado: renderer vault gate (`App.tsx` unlock flow)
  - Critério de pronto: password só HTTP; token só via IPC em memória
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Unlock HTTP feliz + requests autenticados
- [ ] TT-02, Backoff + rate limit
- [ ] TT-03, IPC getSessionToken sem vazar keys
- [ ] TT-04, Lock → vault:locked event

## Tarefas de Migração de Dados (se aplicável)

- N/A

## Ordem Sugerida

1. T-01, T-02, T-03 (HTTP unlock path)
2. T-04 (session auth)
3. T-05, T-06 (shell bridge)
4. T-07 (renderer integration)

## Lacunas Pendentes (🔴)

- Fluxo exacto reload + token sync renderer
