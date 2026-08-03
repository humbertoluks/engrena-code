# terminal, Tarefas de Implementação

> Sequência para reimplementar o módulo Terminal a partir do legado.

## Pré-requisitos

- [ ] projectScope resolve cwd por projectId
- [ ] WS server com autenticação session
- [ ] node-pty rebuild para Electron ABI

## Tarefas

- [ ] T-01, runTerminalCommand: spawn, timeout 5min, SIGKILL
  - Origem no legado: `packages/server/src/terminal/exec.ts`
  - Critério de pronto: stdout/stderr streamed; exitCode -1 on signal
  - Confiança: 🟢

- [ ] T-02, POST /projects/:id/terminal + TerminalExecError
  - Origem no legado: `packages/server/src/routes/terminal-exec.ts`
  - Critério de pronto: spawn fail → HTTP error; exit≠0 OK
  - Confiança: 🟢

- [ ] T-03, Emit terminal.output/terminal.exit no WS project channel
  - Origem no legado: `packages/server/src/ws/server.ts`
  - Critério de pronto: live events; excluded from replay
  - Confiança: 🟢

- [ ] T-04, spawnPty lazy-load + shell login
  - Origem no legado: `packages/server/src/terminal/pty.ts`
  - Critério de pronto: PTY no cwd projeto; não import nativo no boot
  - Confiança: 🟢

- [ ] T-05, handlePtyMessage: open/input/resize/close routing
  - Origem no legado: `packages/server/src/ws/server.ts`
  - Critério de pronto: cap 16; cwd server-side
  - Confiança: 🟢

- [ ] T-06, Renderer pty client + XtermView
  - Origem no legado: `packages/renderer/api/pty.ts`, `XtermView.tsx`
  - Critério de pronto: buffer pré-open; fit addon
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, POST echo → exit 0 + output
- [ ] TT-02, PTY open → data roundtrip
- [ ] TT-03, cwd traversal attempt rejected (no client cwd)
- [ ] TT-04, 17th PTY rejected

## Ordem Sugerida

1. T-01 → T-02 → T-03 (one-shot)
2. T-04 → T-05 (PTY server)
3. T-06 (renderer)

## Lacunas Pendentes (🔴)

- Shell exacto Windows (powershell vs cmd)
