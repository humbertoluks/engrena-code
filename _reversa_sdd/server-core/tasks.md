# server-core, Tarefas de Implementação

> Sequência para reimplementar o núcleo HTTP+WS+SQLite a partir do legado.

## Pré-requisitos

- [ ] Pacote `@sistema-legado/shared` com contratos de rotas, providers e eventos WS
- [ ] Migrations SQLite 001–062 reproduzíveis
- [ ] Shell Electron chama `createServer({ userDataPath })` in-process
- [ ] Sub-unidades `http-ws-bootstrap` e `autenticacao-sessao` especificadas

## Tarefas

- [ ] T-01, Implementar `loadServerConfig` com default `127.0.0.1:4477` e validação de porta
  - Origem no legado: `packages/server/src/config.ts`
  - Critério de pronto: env `SISTEMA_LEGADO_LOCAL_*` e overrides funcionam; porta inválida falha no boot
  - Confiança: 🟢

- [ ] T-02, Implementar `resolveDatabasePath` + `openDatabase` (PRAGMAs, migrations)
  - Origem no legado: `packages/server/src/db/client.ts`, `db/migrations/index.ts`
  - Critério de pronto: precedência dbPath → env → userData → fallback SO
  - Confiança: 🟢

- [ ] T-03, Montar `createServer`: vault, registries, brokers, services bag
  - Origem no legado: `packages/server/src/server.ts` (corpo de bootstrap)
  - Critério de pronto: `ServerServices` completo para router e WS
  - Confiança: 🟢

- [ ] T-04, Registrar `routes` de `routes/index.ts` no router compilado
  - Origem no legado: `packages/server/src/routes/index.ts`, `http/router.ts`
  - Critério de pronto: ~134 rotas resolvíveis; 404/405 JSON
  - Confiança: 🟢

- [ ] T-05, Encadear `MIDDLEWARE_CHAIN` via `runMiddlewareChain`
  - Origem no legado: `packages/server/src/middleware/index.ts`
  - Critério de pronto: ordem originGuard→…→transactionWrapper respeitada
  - Confiança: 🟢

- [ ] T-06, Boot: reconciliar pipelines/builds + GC worktrees/refs
  - Origem no legado: `packages/server/src/server.ts`, `runner/pipeline-scheduler.ts`, `git/worktree.ts`
  - Critério de pronto: estados interrompidos tratados; GC não bloqueia listen
  - Confiança: 🟢

- [ ] T-07, `close()` graceful: HTTP, WS, DB, timers
  - Origem no legado: `packages/server/src/server.ts` (shutdown)
  - Critério de pronto: segundo boot limpo; sem handles órfãos
  - Confiança: 🟡

## Tarefas de Teste

- [ ] TT-01, Boot feliz: listen loopback + rota config responde
- [ ] TT-02, Migration fresh DB vs DB existente idempotente
- [ ] TT-03, Rota inexistente → 404 JSON
- [ ] TT-04, Cofre travado bloqueia rota protegida (integração com autenticacao-sessao)

## Tarefas de Migração de Dados

- [ ] TM-01, Aplicar migrations sequenciais preservando `sistema-legado.db` do userData
- [ ] TM-02, `applyDataSeeds` idempotente pós-migration

## Ordem Sugerida

1. T-01 → T-02 (config + persistência)
2. T-03 (services) → T-04 + T-05 (HTTP surface)
3. Sub-unidades http-ws-bootstrap e autenticacao-sessao em paralelo
4. T-06, T-07 (resiliência e lifecycle)

## Lacunas Pendentes (🔴)

- Inventário rota-a-rota de `public: true` além de vault-unlock
- SLA de boot com codegraph GC em monorepos grandes
