---
name: coding-electron
description: >-
  Aplica os padrões de Electron do EngrenaCode (main, preload, IPC, PTY) e as
  lições já registradas em auditoria para não repetir erros de isolamento,
  canal IPC, bounds numéricos ou env do PTY. Use ao escrever ou editar código
  em src/main/, src/preload/, canais IPC (ipcMain.handle/contextBridge) ou
  host de PTY (src/services/terminal/).
---

# Coding — Electron

Guia proativo para **escrever** código Electron neste repo. Não é review (isso é `review-architecture`/`review-robustness`): aplique estes padrões antes de o código existir, para os achados de auditoria não se repetirem.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Electron`) + `CLAUDE.md`. A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir sobre um item.

## Padrões obrigatórios

- **Preload só expõe métodos nomeados** via `contextBridge`, agrupados por domínio (`vault.*`, `dialog.*`, `shell.*`, `terminal.*` — só esses quatro grupos hoje). Hoje **não existe** passthrough genérico (`invoke`/`send`/`on` cru) exposto ao renderer: expor um anula a allowlist de canais e é erro, não atalho.
- **Todo método do preload tem contraparte em `src/main/index.ts`**, canal no formato `engrenacode:<domínio>:<ação>`: `ipcMain.handle` quando há retorno (`vault:*`, `dialog:open-folder`, `shell:open-external`, `terminal:create|kill`), `ipcMain.on` quando é fire-and-forget de stream (`terminal:write|resize`), e `webContents.send` para o fluxo de volta (`terminal:data|exit`, `vault:locked`). Método órfão ou canal órfão é erro; usar `on` onde o chamador precisa do retorno também.
- **Preload permanece CommonJS** (`require('electron')`). Nunca converta para `import`/ESM — `contextBridge` não é exportado em ESM.
- Preload não contém regra de negócio, cache nem transformação: só repassa argumento → `ipcMain.invoke` → retorno serializável (objeto plano; nunca `BrowserWindow`, stream, `Buffer` grande ou classe).
- `nodeIntegration: false`, `contextIsolation: true`, `preload: preload.cjs` em toda `BrowserWindow`. Nunca afrouxe para resolver um bug pontual.
- IPC é só capacidade nativa (vault session, dialog, shell, PTY). **CRUD de domínio, keys, git de produto e dispatch ficam no HTTP loopback** — PTY pode resolver `cwd` via projects/threads; isso não autoriza expandir o IPC para catálogo/credencial.
- Dev: `loadURL` lê `process.env.VITE_DEV_SERVER_URL` (com fallback), nunca porta hardcoded — 5173 costuma estar ocupada e a porta real vem de `.env.local`.
- Produção: `loadFile(path.join(__dirname, '../dist/index.html'))`. Nunca `file://` + caminho relativo `../../../dist` — o builder empacota `dist` ao lado de `dist-electron` e isso quebra no Windows.
- `vite-plugin-electron`: declare `main` e `preload` com `entry` distintos; ambos são `index.ts` e colidem em `dist-electron/index.js` se você não separar `build.lib`/`formats: ['cjs']`/`fileName: 'preload.cjs'` para o preload.
- `src/main/index.ts` (ESM) precisa de `__dirname` via `fileURLToPath(import.meta.url)` — ES modules não exportam `__dirname` nativo.
- Argumento numérico de IPC perigoso (ex.: `cols`/`rows` de PTY) exige faixa finita, não só `typeof === 'number'`:

```ts
// src/main/index.ts — padrão vigente
function isValidPtyDimension(n: unknown): n is number {
  return typeof n === 'number' && Number.isInteger(n) && n >= 1 && n <= 500
}
```

- **PTY não herda `process.env` inteiro.** Passe allowlist mínima (`PATH`, `HOME`/`USERPROFILE`, `TERM`, locale, `COMSPEC` no Windows, e o estritamente necessário ao shell). Herdar o env do host pode expor keys de provider / tokens ao shell do dock (F26).
- Spawn de script Node a partir do main usa `ELECTRON_RUN_AS_NODE: '1'` no `env` — `process.execPath` no main é o binário Electron, não Node puro; sem essa env var o MCP interno/bridge falha só em produção (passa nos unitários, que rodam em Node).
- Módulo sem consumidor concreto (scaffold morto, ponte paralela ao `guard()`) não sobrevive: delete ou ligue na mesma mudança. `session-middleware` já foi removido — não reintroduza.

## Erros já registrados aqui — não repita

Abertos: nenhum nesta Stack.

Já corrigidos — não regrida:

- `RC-pty-env-inheritance` — o spawn do PTY monta o env por allowlist (`pty-env.ts`), não herda `process.env`. Variável nova do shell entra na allowlist explicitamente; nunca volte a passar o env do host inteiro.

- `RC-ipc-numeric-bounds` — `cols`/`rows` já usam `isValidPtyDimension`; não volte a aceitar só `typeof number`.
- `RC-named-preload` — só métodos nomeados em quatro grupos; não introduza `invoke`/`send`/`on` livre.
- `RC-vite-env-url` — `loadURL` lê `VITE_DEV_SERVER_URL`; não hardcodar `localhost:5173`.
- `RC-no-dead-scaffold` — não crie auth paralelo fora do `guard()` / `_transport`.
- `RC-electron-run-as-node` — spawn de script já usa `ELECTRON_RUN_AS_NODE=1`; não remova ao refatorar `runner/providers/*`.

## Se encontrar um padrão novo

Se um erro não listado aqui aparecer no caminho, registre em `docs/AUDIT-CODE-REVIEW.md` (via `audit-full-base`) ou, se for regra transferível e não-óbvia, em `CLAUDE.md` no formato `Origem · Categoria · [Sempre/Nunca] X porque Y`.
