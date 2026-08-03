# server-core, Design Técnico

> Como o núcleo local (`packages/server/src`) é construído, com base no legado.

## Interface

### `createServer(options)`

| Campo / retorno | Tipo | Uso |
|-----------------|------|-----|
| `userDataPath` | `string?` | Base para SQLite e vault |
| `dbPath` | `string?` | Override explícito (`:memory:` em testes) |
| `host` / `port` | override | Prioridade sobre env |
| Retorno `close()` | `Promise<void>` | Shutdown HTTP+WS+recursos |
| Retorno `vault` | bridge | Token sessão, lock/unlock |
| Retorno `repositories` | `Repositories` | Acesso tipado ao DB |

🟢 CONFIRMADO em `server.ts`.

### Cadeia de middleware (ordem fixa)

```
originGuard → errorHandler → vaultGuard → sessionAuth
  → requestValidation → projectScope → transactionWrapper → handler
```

| Middleware | Papel resumido | Confiança |
|------------|----------------|-----------|
| `originGuard` | Host/Origin allowlist | 🟢 |
| `errorHandler` | Erros → JSON padronizado | 🟢 |
| `vaultGuard` | Cofre destravado | 🟢 |
| `sessionAuth` | Header `X-sistema-legado-Session` | 🟢 |
| `requestValidation` | Zod/schemas por rota | 🟢 |
| `projectScope` | Resolve projeto/cwd | 🟢 |
| `transactionWrapper` | BEGIN/COMMIT SQLite | 🟢 |

## Fluxo Principal (bootstrap)

1. `loadServerConfig` → host/porta (default `127.0.0.1:4477`) 🟢
2. `resolveDatabasePath` → abre SQLite, PRAGMAs, migrations 🟢
3. `createVault`, `createDriverRegistry`, registries (skills, MCPs, rules, subagents, turns) 🟢
4. Brokers (permission, question), codegraph engine, dreamer, transcription 🟢
5. `createRouter({ routes, services })` + `createWebSocketHub` no mesmo `http.Server` 🟢
6. Reconciliação pipelines/builds; GC worktrees/refs; seeds 🟢
7. `listen(host, port)` 🟢

## Fluxos Alternativos

- **Testes:** `dbPath: ':memory:'`, `sessionPolicy.required: false` 🟢
- **E2E hermético:** shell injeta driver registry fake via opções 🟡
- **Boot parcial falho:** erro propagado; shell faz cleanup 🟡
- **Upload/transcription:** timeouts dedicados de `@lioncode/shared` 🟢

## Dependências

- `@lioncode/shared` — contratos, limites, modelos 🟢
- `better-sqlite3` — persistência síncrona 🟢
- Submódulos: `providers`, `runner`, `vault`, `git`, `mcp`, `memory`, `codegraph`, `ws`, `routes` 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Server in-process no Electron main | Comentário `server.ts` SPEC 3.1 | 🟢 |
| SQLite único; renderer só HTTP/WS | Arquitetura geral | 🟢 |
| originGuard **antes** de rotas públicas | `middleware/index.ts` | 🟢 |
| Rotas novas protegidas por default (`public` explícito) | `session-auth.ts` | 🟢 |
| Migrations idempotentes numeradas | `db/migrations/` | 🟢 |

## Estado Interno

| Estado | Onde | Evolução |
|--------|------|----------|
| Conexão SQLite | `DataLayer` | Abre no boot; fecha no `close()` |
| Vault lock/unlock | `Vault` | Sessão token efêmera pós-unlock |
| Registries/brokers | `ServerServices` | Singleton por processo |
| Hubs WS por thread | `WebSocketHub` | Inscrições dinâmicas |

## Observabilidade

- Logger estruturado com `requestId` no router 🟢
- Sem métricas Prometheus nativas no core 🟡
- Reconciliação/GC loga warnings no boot 🟢

## Riscos e Lacunas

- 🔴 Matriz completa de quais rotas usam `transactionWrapper` vs read-only
- 🟡 Tempo máximo de reconciliação no boot em repos grandes
- 🟡 Política exata quando `LIONCODE_LOCAL_HOST` ≠ loopback
