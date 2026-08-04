# vault, Tarefas de Implementação

> Sequência para reimplementar cofre local cifrado.

## Pré-requisitos

- [ ] Node crypto (scrypt, AES-256-GCM)
- [ ] userDataPath do Electron/server
- [ ] Middleware stack configurável
- [ ] Shell IPC para session token (ver shell/ipc-sessao)

## Tarefas

- [ ] T-01, crypto.ts: scrypt (N=2^15,r=8,p=1) + AES-GCM encrypt/decrypt
  - Origem no legado: `packages/server/src/vault/crypto.ts`
  - Critério de pronto: authTag verifica senha; keylen 32
  - Confiança: 🟢

- [ ] T-02, store.ts: envelope JSON + write atômico temp+fsync+rename 0600
  - Origem no legado: `packages/server/src/vault/store.ts`
  - Critério de pronto: crash mid-write não corrompe vault.enc
  - Confiança: 🟢

- [ ] T-03, vault.ts: createVault, unlock, lock, payload CRUD
  - Origem no legado: `packages/server/src/vault/vault.ts`
  - Critério de pronto: unlock/lock cycle; merge parcial keys
  - Confiança: 🟢

- [ ] T-04, Session token 32B hex + timingSafeEqual + getSessionToken
  - Origem no legado: `packages/server/src/vault/vault.ts`
  - Critério de pronto: token válido só pós-unlock; invalidado no lock
  - Confiança: 🟢

- [ ] T-05, Backoff exponencial pós 5 falhas (clampDelay max 60s)
  - Origem no legado: `packages/server/src/vault/vault.ts`
  - Critério de pronto: retryAfterMs; rejeita sem testar senha em backoff
  - Confiança: 🟢

- [ ] T-06, vaultGuard (423) + sessionAuth (401 header X-Sistema-Legado-Session)
  - Origem no legado: `middleware/vault-guard.ts`, `session-auth.ts`
  - Critério de pronto: rotas public bypass; protegidas exigem unlock+token
  - Confiança: 🟢

- [ ] T-07, onLock: invalidar token, WS 1008, callback shell
  - Origem no legado: `vault.ts` + server WS + shell main
  - Critério de pronto: renderer perde sessão; IPC vault:locked
  - Confiança: 🟢

- [ ] T-08, Rate limiter global unlock
  - Origem no legado: `packages/server/src/http/rate-limiter.ts`
  - Critério de pronto: teto global complementa backoff workspace
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Unlock feliz + token aceito
- [ ] TT-02, Senha errada vs envelope corrompido (erros distintos)
- [ ] TT-03, Backoff após 5 falhas
- [ ] TT-04, Lock invalida token + evento shell

## Tarefas de Migração de Dados (se aplicável)

- [ ] Normalização legado githubToken → vcsTokens.github no unlock

## Ordem Sugerida

1. T-01, T-02 (crypto + store)
2. T-03, T-04, T-05 (vault core)
3. T-06, T-08 (middleware + rate limit)
4. T-07 (onLock integration)

## Lacunas Pendentes (🔴)

- Política multi-workspace no mesmo userData
