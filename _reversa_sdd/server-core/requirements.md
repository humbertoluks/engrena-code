# server-core

> Spec de requisitos do núcleo HTTP+WS local (`packages/server/src`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Processo de domínio **in-process** (Electron main) que expõe API REST JSON e WebSocket no **loopback**, persiste estado em **SQLite** e aplica cadeia de segurança antes de ~134 handlers. O renderer nunca acessa o banco diretamente. 🟢

## Responsabilidades

- Bootstrap via `createServer` (config, DB, vault, registries, brokers, rotas, HTTP+WS) 🟢
- Resolver host/porta default `127.0.0.1:4477` com overrides env/opções 🟢
- Abrir SQLite, PRAGMAs, migrations idempotentes (001–062) 🟢
- Montar cadeia de middleware padrão até o handler 🟢
- Registrar rotas de `packages/server/src/routes/` 🟢
- Reconciliar pipelines/builds e GC de worktrees no boot (quando habilitado) 🟢
- Orquestrar domínios especializados (runner, git, vault, mcp, codegraph, etc.) 🟢

## Regras de Negócio

- Server **single-user local**; sem RBAC multi-usuário no DB 🟢
- Bind em loopback por default; não expor rede externa sem override explícito 🟢
- Cofre travado bloqueia rotas não-`public` (ver autenticacao-sessao) 🟢
- `projectScope` resolve `cwd` por `project_id`; isolamento de dados, não ACL 🟢
- Transações SQLite via `transactionWrapper` em rotas mutáveis 🟢
- Contagem exata de rotas evolui por sprint; inventário anterior citava ~88 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | `createServer` sobe HTTP+WS escutando em host/porta resolvidos | Must | GET health/config responde em loopback |
| RF-02 | SQLite aberto com migrations aplicadas no startup | Must | Schema coerente; `schema_migrations` atualizado |
| RF-03 | Toda rota passa pela cadeia originGuard→…→transactionWrapper | Must | Ordem confirmada em `middleware/index.ts` |
| RF-04 | Rotas desconhecidas retornam 404/405 JSON sem throw externo | Must | Router nunca derruba o processo |
| RF-05 | Boot reconcilia feature pipelines/builds interrompidos | Should | Estado retomável ou marcado erro |
| RF-06 | GC de worktrees/refs stale no boot quando configurado | Should | Sem acúmulo infinito de refs órfãs |
| RF-07 | Seeds idempotentes (`data_seeds`) após migrations | Could | Reboot não duplica dados seed |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | originGuard antes de qualquer lógica, inclusive rotas públicas | `middleware/origin-guard.ts` | 🟢 |
| Segurança | Corpo JSON limitado (anti-DoS local) | `http/router.ts` MAX_BODY_BYTES | 🟢 |
| Integridade | `foreign_keys=ON`, WAL | `db/client.ts` | 🟢 |
| Disponibilidade | Porta inválida derruba boot com erro claro | `config.ts` parsePort | 🟢 |
| Observabilidade | Logger JSON-lines injetável | `server.ts` / `logger.ts` | 🟢 |

## Critérios de Aceitação

```gherkin
Dado createServer({ userDataPath }) sem overrides
Quando o bootstrap completa
Então o server escuta em 127.0.0.1:4477 e expõe rotas de routes/index.ts

Dado uma requisição HTTP com método e path não registrados
Quando o router processa
Então a resposta é JSON 404 ou 405 sem exceção não tratada

Dado SISTEMA_LEGADO_DB_PATH apontando para arquivo válido
Quando openDatabase roda
Então migrations pendentes são aplicadas e PRAGMAs de integridade ativos

Dado cofre travado e rota não-public
Quando vaultGuard executa
Então a rota retorna erro de cofre travado antes do handler
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Núcleo inoperante sem bootstrap, DB, middleware e router |
| RF-05, RF-06 | Should | Resiliência pós-crash e higiene git |
| RF-07 | Could | Conveniência de dados iniciais |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/server.ts` | `createServer` | 🟢 |
| `packages/server/src/config.ts` | `loadServerConfig`, origin allowlist | 🟢 |
| `packages/server/src/db/client.ts` | `openDatabase`, `resolveDatabasePath` | 🟢 |
| `packages/server/src/middleware/index.ts` | `MIDDLEWARE_CHAIN`, `runMiddlewareChain` | 🟢 |
| `packages/server/src/routes/index.ts` | `routes` (~134 entradas) | 🟢 |
| `packages/server/src/http/router.ts` | `createRouter`, match, body | 🟢 |
