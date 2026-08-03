# autenticacao-sessao, Tarefas de Implementação

> Reimplementar vaultGuard, sessionAuth e fluxo unlock a partir do legado.

## Pré-requisitos

- [ ] Módulo `vault` com unlock/lock/verifySessionToken
- [ ] Router marca rotas com flag `public`
- [ ] originGuard configurado antes na cadeia
- [ ] Shell IPC alinhado (`getSessionToken`, `onVaultLocked`)

## Tarefas

- [ ] T-01, Implementar `vaultGuard` respeitando `route.public`
  - Origem no legado: `packages/server/src/middleware/vault-guard.ts`
  - Critério de pronto: cofre travado bloqueia; unlock route passa
  - Confiança: 🟢

- [ ] T-02, Implementar `sessionAuth` lendo `SESSION_HEADER`
  - Origem no legado: `packages/server/src/middleware/session-auth.ts`
  - Critério de pronto: 401 padronizado; nunca loga token
  - Confiança: 🟢

- [ ] T-03, Integrar ordem na `MIDDLEWARE_CHAIN` (após errorHandler)
  - Origem no legado: `packages/server/src/middleware/index.ts`
  - Critério de pronto: vaultGuard → sessionAuth → requestValidation
  - Confiança: 🟢

- [ ] T-04, Rota `vault-unlock` com `public: true`
  - Origem no legado: `packages/server/src/routes/vault-unlock.ts`
  - Critério de pronto: unlock funciona com cofre travado; retorna sessão
  - Confiança: 🟢

- [ ] T-05, `verifySessionToken` com timing-safe compare
  - Origem no legado: `packages/server/src/vault/` (implementação verify)
  - Critério de pronto: comprimento divergente recusa antes de compare
  - Confiança: 🟢

- [ ] T-06, Rate limit de unlock
  - Origem no legado: `packages/server/src/config.ts`, `http/rate-limiter.ts`
  - Critério de pronto: excesso de tentativas retorna erro claro
  - Confiança: 🟢

- [ ] T-07, Invalidação em lock + callback `onLock` para shell
  - Origem no legado: `packages/server/src/vault/index.ts`, `packages/shell/src/main.ts`
  - Critério de pronto: token antigo falha após lock; IPC notifica renderer
  - Confiança: 🟢

- [ ] T-08, WS handshake reutiliza verifySessionToken (subprotocol)
  - Origem no legado: `packages/server/src/ws/server.ts`
  - Critério de pronto: paridade de política HTTP/WS
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Travado → GET protegido falha no vaultGuard
- [ ] TT-02, Destravado sem header → 401
- [ ] TT-03, Token válido → rota OK
- [ ] TT-04, Lock invalida token anterior
- [ ] TT-05, Unlock público alcançável com cofre travado

## Ordem Sugerida

1. T-05 (vault crypto/session)
2. T-04 (unlock route)
3. T-01, T-02, T-03 (middleware chain)
4. T-06, T-07 (hardening + shell)
5. T-08 (paridade WS)

## Lacunas Pendentes (🔴)

- Política de rotação/regeneração de token mid-session
- Timeout automático de sessão (se existir)
