# Plano de Implementação: F26. Terminal PTY no Dock

**Pré-requisitos:**
- Nova dependência de produção: `node-pty` — exige rebuild nativo pós-`pnpm install` contra o ABI do Electron (`@electron/rebuild` ou `electron-builder install-app-deps`), passo dedicado documentado no setup
- `@xterm/xterm` + `@xterm/addon-fit` já instalados (sem instalação nova)
- Sem migração SQL — sessões PTY são efêmeras, só em memória no main process

### Fase 1: Resolução de shell e registro de sessão (main process)

**1. `shell-resolver.ts`** - Resolver o shell padrão do SO (Windows: `COMSPEC`/`cmd.exe`; POSIX: `SHELL`/`/bin/bash`), retornando erro `shell_not_found` quando nenhum candidato existe no disco.

**2. `pty-session-registry.ts`** - Registro em memória (`Map<sessionId, PtySession>`) com spawn/write/resize/kill via `node-pty`, resolvendo cwd sempre via `resolveThreadCwd(thread, project)` (reutilizado, nunca reimplementado); distinguir encerramento esperado (kill do usuário) de inesperado (crash) no evento de saída.

### Fase 2: IPC main↔renderer

**3. Handlers no main** - Registrar `engrenacode:terminal:create`/`kill` via `ipcMain.handle` e `write`/`resize` via `ipcMain.on` em `src/main/index.ts`, seguindo a convenção já usada pelos handlers de vault/dialog/shell; emitir `data`/`exit` via `webContents.send`.

**4. Bridge no preload** - Adicionar namespace `terminal` ao `contextBridge` em `src/preload/index.ts` (`create`/`write`/`resize`/`kill` via `invoke`/`send`, `onData`/`onExit` via `ipcRenderer.on`), espelhando a convenção dos namespaces existentes.

### Fase 3: Frontend do dock

**5. Hook de estado** - Criar `useTerminalDock.ts`: estado de abas por projeto, ciclo de vida IPC (criar/fechar/reabrir aba), assinatura de eventos `data`/`exit` por `sessionId`.

**6. Componentes do dock** - Criar `TerminalPane.tsx` (monta `@xterm/xterm` + `FitAddon`, aplica `xtermThemeFromCssVars()` — primeiro consumidor real, encaminha keystrokes via IPC, trata `shell_not_found` e "Sessão encerrada") e `TerminalDock.tsx` (dock inferior expansível, barra de abas, atalho de teclado, botão nova aba); encaixar em `PrincipalScreen.tsx` ao lado do painel principal.

### Fase 4: Validação e fechamento

**7. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração de processo real de vida curta + smoke). Confirmar os 4 critérios de aceitação de F26 (`docs/PRD.md` seção F26) e os critérios cross-feature de cwd/worktree/tokens. Registrar explicitamente: (a) a superfície de segurança nova (processo com privilégios completos do usuário do SO, sem sandbox adicional do EngrenaCode) é um limite de design deliberado, já documentado no PRD, não uma lacuna; (b) fase visual final do dock (anatomia, light/dark, copy) fica bloqueada até `ui.md`/`copy.md` de F26 existirem — não fechar essa parte nesta rodada. Gate: suite e build verdes, incluindo o passo de rebuild nativo de `node-pty`.
