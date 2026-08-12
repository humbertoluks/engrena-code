# Bindings — EngrenaCode (Electron)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (Stack `Electron`) + `CLAUDE.md`.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Main | `apps/engrena-code/src/main/index.ts` (ESM + `__dirname` via `fileURLToPath`) |
| Preload | `apps/engrena-code/src/preload/index.ts` → `preload.cjs` |
| Prefixos IPC | Code `engrenacode:<domínio>:<ação>`; Plan `engrenaplan:vault:*` |
| Grupos do bridge | Code: `vault`, `dialog`, `shell`, `terminal` |
| PTY env | `apps/engrena-code/src/services/terminal/pty-env.ts` |
| Dev URL | `VITE_DEV_SERVER_URL` (`.env.local`); unlock Code `5174` / Plan `5184` |
| Produção | `loadFile(path.join(__dirname, '../dist/index.html'))` |
| Vite Code | `apps/engrena-code/vite.config.ts` (sem `vite-plugin-electron-renderer`) |

## Precedentes vivos

| Slug | Referência |
|------|------------|
| `ipc-numeric-bounds` | `isValidPtyDimension` em `src/main/index.ts` |
| `process-pty-env-allowlist` | `pty-env.ts` |
| `preload-named-methods-only` | `src/preload/index.ts` |
| `build-no-renderer-node-polyfill` | `apps/engrena-code/vite.config.ts` (sem `renderer()`) |
| `build-vendor-code-splitting` | `vite.config.ts` → `build.rolldownOptions.output.codeSplitting` |

## Invariantes de contrato deste repo

- Não existe passthrough genérico (`invoke`/`send`/`on` cru) no preload.
- CRUD de domínio não entra em IPC — HTTP loopback `:5174`.
- `session-middleware` foi removido; não reintroduza auth paralelo ao `guard()`.
- Renderer do Code não usa API Node: não religue `vite-plugin-electron-renderer`.
- Grupos `react-vendor` / `markdown` / `xterm` / `xyflow` permanecem em `codeSplitting`; não suba `chunkSizeWarningLimit` para esconder o entry.

## Achados abertos

Nenhum nesta Stack.

## Já corrigidos — não regrida

- `RC-pty-env-inheritance` — PTY via allowlist
- `RC-ipc-numeric-bounds` — `isValidPtyDimension`
- `RC-named-preload` — só métodos nomeados nos quatro grupos
- `RC-vite-env-url` — `VITE_DEV_SERVER_URL`
- `RC-no-dead-scaffold` — sem auth paralelo
- `RC-electron-run-as-node` — spawn de script com `ELECTRON_RUN_AS_NODE=1`
