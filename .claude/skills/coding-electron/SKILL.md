---
name: coding-electron
description: >-
  Aplica os padrões de Electron do EngrenaCode (main, preload, IPC, PTY) e as
  lições já registradas em auditoria para não repetir erros de isolamento,
  canal IPC ou spawn. Use ao escrever ou editar código em src/main/,
  src/preload/, canais IPC (ipcMain.handle/contextBridge) ou host de PTY.
---

# Coding — Electron

Guia proativo para **escrever** código Electron neste repo. Não é review (isso é `review-architecture`/`review-robustness`): aplique estes padrões antes de o código existir, para os achados de auditoria não se repetirem.

Fonte das regras: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Electron`) + `CLAUDE.md`.

## Padrões obrigatórios

- **Preload só expõe métodos nomeados** via `contextBridge`, agrupados por domínio (`vault.*`, `dialog.*`, `shell.*`, `pty.*`). Nunca adicione um canal novo pelo passthrough genérico `invoke`/`send`/`on` — ele é dívida existente, não porta de entrada.
- **Todo método do preload tem um `ipcMain.handle` correspondente** em `src/main/index.ts`, canal no formato `engrenacode:<domínio>:<ação>`. Método órfão ou handler órfão é erro.
- **Preload permanece CommonJS** (`require('electron')`). Nunca converta para `import`/ESM — `contextBridge` não é exportado em ESM.
- Preload não contém regra de negócio, cache nem transformação: só repassa argumento → `ipcMain.invoke` → retorno serializável (objeto plano; nunca `BrowserWindow`, stream, `Buffer` grande ou classe).
- `nodeIntegration: false`, `contextIsolation: true`, `preload: preload.cjs` em toda `BrowserWindow`. Nunca afrouxe para resolver um bug pontual.
- Dev: `loadURL` lê `process.env.VITE_DEV_SERVER_URL` (com fallback), nunca porta hardcoded — 5173 costuma estar ocupada e a porta real vem de `.env.local`.
- Produção: `loadFile(path.join(__dirname, '../dist/index.html'))`. Nunca `file://` + caminho relativo `../../../dist` — o builder empacota `dist` ao lado de `dist-electron` e isso quebra no Windows.
- `vite-plugin-electron`: declare `main` e `preload` com `entry` distintos; ambos são `index.ts` e colidem em `dist-electron/index.js` se você não separar `build.lib`/`formats: ['cjs']`/`fileName: 'preload.cjs'` para o preload.
- `src/main/index.ts` (ESM) precisa de `__dirname` via `fileURLToPath(import.meta.url)` — ES modules não exportam `__dirname` nativo.
- Argumento numérico de IPC perigoso (ex.: `cols`/`rows` de PTY) exige faixa finita, não só `typeof === 'number'`:

```ts
function validDim(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && Number.isInteger(n) && n >= 1 && n <= 500
}
```

- Spawn de script Node a partir do main usa `ELECTRON_RUN_AS_NODE: '1'` no `env` — `process.execPath` no main é o binário Electron, não Node puro; sem essa env var o MCP interno/bridge falha só em produção (passa nos unitários, que rodam em Node).
- Módulo sem consumidor concreto (scaffold morto, ponte paralela ao `guard()` de cada handler) não sobrevive: delete ou ligue na mesma mudança.

## Erros já registrados aqui — não repita

Abertos nesta auditoria (corrija ao tocar o arquivo):

- `R-ipc-numeric-bounds` — `main/index.ts:92-100` só valida `typeof number` em `cols`/`rows` de PTY (aceita `NaN`/negativo). Ao tocar esse handler, aplique `validDim` acima.

Já corrigidos — não regrida:

- `RC-named-preload` — preload com passthrough genérico já foi substituído por métodos nomeados; não reintroduza `invoke`/`send`/`on` livre.
- `RC-vite-env-url` — `loadURL` já lê `VITE_DEV_SERVER_URL`; não volte a hardcodar `localhost:5173`.
- `RC-no-dead-scaffold` — `session-middleware.ts`/scaffold morto já foram removidos; não crie um caminho paralelo de auth fora do `guard()` de cada handler.
- `RC-electron-run-as-node` — spawn de script já usa `ELECTRON_RUN_AS_NODE=1`; não remova ao refatorar `runner/providers/*`.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.
