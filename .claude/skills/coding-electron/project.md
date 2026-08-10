# Bindings — EngrenaCode (Electron)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Electron`) + `CLAUDE.md`.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Main | `src/main/index.ts` (ESM + `__dirname` via `fileURLToPath`) |
| Preload | `src/preload/index.ts` → `preload.cjs` |
| Prefixos IPC | `engrenacode:<domínio>:<ação>` |
| Grupos do bridge | `vault`, `dialog`, `shell`, `terminal` |
| PTY env | `src/services/terminal/pty-env.ts` |
| Dev URL | `process.env.VITE_DEV_SERVER_URL` (`.env.local`); unlock loopback reserva `5174` |
| Produção | `loadFile(path.join(__dirname, '../dist/index.html'))` |

## Precedentes vivos

| Slug | Referência |
|------|------------|
| `ipc-numeric-bounds` | `isValidPtyDimension` em `src/main/index.ts` |
| `process-pty-env-allowlist` | `pty-env.ts` |
| `preload-named-methods-only` | `src/preload/index.ts` |

## Invariantes de contrato deste repo

- Não existe passthrough genérico (`invoke`/`send`/`on` cru) no preload.
- CRUD de domínio não entra em IPC — HTTP loopback `:5174`.
- `session-middleware` foi removido; não reintroduza auth paralelo ao `guard()`.

## Achados abertos

Nenhum nesta Stack.

## Já corrigidos — não regrida

- `RC-pty-env-inheritance` — PTY via allowlist
- `RC-ipc-numeric-bounds` — `isValidPtyDimension`
- `RC-named-preload` — só métodos nomeados nos quatro grupos
- `RC-vite-env-url` — `VITE_DEV_SERVER_URL`
- `RC-no-dead-scaffold` — sem auth paralelo
- `RC-electron-run-as-node` — spawn de script com `ELECTRON_RUN_AS_NODE=1`
