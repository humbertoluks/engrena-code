# Arquitetura do monorepo Engrena

Contratos compartilhados entre **EngrenaCode**, **EngrenaPlan** e packages `@engrena/*`.

## Árvore

```text
apps/engrena-code     → produto Code (domínio completo)
apps/engrena-plan     → produto Plan (scaffold; domínio Discovery/PRD/Spec/Plano ainda stub)
packages/ui           → @engrena/ui
packages/vault        → @engrena/vault
packages/http-core    → @engrena/http-core
packages/db-core      → @engrena/db-core
docs/                 → Engrena (design-system, engrena/, architecture/)
```

Cada app mantém shims finos (`vault-service`, `_transport`, `db/client`) que instanciam o package com parâmetros do app. Handlers, repositories e telas de domínio ficam no app.

## Packages

### `@engrena/ui`

- Tokens CSS (`:root` / `.dark` / `@theme inline`) + primitives (Button, Card, Modal, Input/Field, …)
- `configureThemeStorageKey(key)` no boot do renderer (Code: `engrenacode:theme`; Plan: chave própria)
- CSS do app: `@import '@engrena/ui/styles.css'` após `tailwindcss`
- Estilos de domínio do Code (`.chat-markdown-*`, `.text-shimmer`) permanecem no app

### `@engrena/vault`

- `createVault({ userDataEnvVar, fallbackUserData })` → `{ vaultStore, vaultService }`
- Crypto + store atômico (`vault.enc`) sem dependência de Electron no package
- App passa env + `app.getPath('userData')`; `provider-keys` / `memory-service` ficam no Code

### `@engrena/http-core`

- `createGuard` (423 `vault_locked` **antes** de 401 `unauthorized`)
- `sendJson` / `readBody` / CORS loopback / `createLoopbackServer`
- Session header e prefixo de subprotocol WS parametrizáveis (defaults Code-compatíveis)

### `@engrena/db-core`

- `createDb({ userDataEnvVar, dbPathEnvVar, dbFileName, fallbackUserData, migrations })`
- Migrations numbered forward-only; lista injetada pelo app

## Isolamento por app

| | EngrenaCode | EngrenaPlan |
|---|-------------|-------------|
| `appId` | `com.lukse.engrenacode` | `com.lukse.engrenaplan` |
| Unlock loopback | `127.0.0.1:5174` | `127.0.0.1:5184` |
| Vite (dev tipico) | `5173+` (nunca 5174/5184) | `5175` |
| Session header | `x-engrenacode-session` | `x-engrenaplan-session` |
| WS subprotocol | `engrenacode-session.<token>` | (ainda sem WS de domínio) |
| IPC prefix | `engrenacode:*` | `engrenaplan:vault:*` |
| userData env | `ENGRENACODE_USER_DATA` | `ENGRENAPLAN_USER_DATA` |
| DB env / file | `ENGRENACODE_DB_PATH` / `engrenacode.db` | `ENGRENAPLAN_DB_PATH` / `engrenaplan.db` |
| Theme key | `engrenacode:theme` | (Plan injeta a própria) |

**Portas reservadas:** `5174` (Code unlock) e `5184` (Plan unlock). Vite de qualquer app não as usa.

## Env

| Variável | Quem | Uso |
|----------|------|-----|
| `VITE_DEV_SERVER_URL` | Code / Plan | URL do Vite; Electron `loadURL` em dev |
| `ENGRENACODE_USER_DATA` | Code / testes | Override de userData (vault + db) |
| `ENGRENACODE_DB_PATH` | Code / testes | Path absoluto do SQLite |
| `ENGRENAPLAN_USER_DATA` | Plan / testes | Idem Plan |
| `ENGRENAPLAN_DB_PATH` | Plan / testes | Idem Plan |

Exemplos: `apps/engrena-code/.env.example`, `apps/engrena-plan/.env.example`.  
Nunca commit de `.env.local`. Nunca apagar `vault.enc` / userData real do usuário.

## Docs (onde vive o quê)

| Escopo | Path |
|--------|------|
| Família Engrena (Design Lock, sprints, architecture) | `docs/` |
| Produto Code (PRD, PROGRESS, F0*-*) | `apps/engrena-code/docs/` |
| Produto Plan (PRD stub, README) | `apps/engrena-plan/docs/` |

Não duplicar Design Lock sob `apps/*/docs/`. Legado `_reversa_*` na raiz está fora do fluxo ativo.
