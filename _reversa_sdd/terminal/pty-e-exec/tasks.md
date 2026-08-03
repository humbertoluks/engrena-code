# pty-e-exec, Tarefas de Implementação

> PTY spawn, stream, cancel e exec one-shot.

## Pré-requisitos

- [ ] WS server com handlePtyMessage scaffold
- [ ] projectScope operacional
- [ ] node-pty instalado e rebuilt para Electron

## Tarefas

- [ ] T-01, spawnPty lazy com shell login POSIX / Windows powershell
  - Origem no legado: `packages/server/src/terminal/pty.ts`
  - Critério de pronto: PTY no cwd; onData wired
  - Confiança: 🟢

- [ ] T-02, clampDim + pty.resize native
  - Origem no legado: `packages/server/src/terminal/pty.ts`, `ws/server.ts`
  - Critério de pronto: cols/rows clamped 1–1000
  - Confiança: 🟢

- [ ] T-03, handlePtyMessage: open cap 16, input, close
  - Origem no legado: `packages/server/src/ws/server.ts`
  - Critério de pronto: owner-only pty.data; slot freed on close
  - Confiança: 🟢

- [ ] T-04, runTerminalCommand + WS terminal.output/exit
  - Origem no legado: `packages/server/src/terminal/exec.ts`
  - Critério de pronto: stream live; 5min SIGKILL
  - Confiança: 🟢

- [ ] T-05, Renderer pending buffer pré-open
  - Origem no legado: `packages/renderer/api/pty.ts`
  - Critério de pronto: input before open drained after open
  - Confiança: 🟢

- [ ] T-06, XtermView FitAddon integration
  - Origem no legado: `packages/renderer/components/XtermView.tsx`
  - Critério de pronto: resize propagates to pty.resize
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, PTY echo stdin/stdout
- [ ] TT-02, Resize clamp 2000→1000
- [ ] TT-03, One-shot timeout kills process
- [ ] TT-04, Close frees 16th slot for new open

## Ordem Sugerida

1. T-01 → T-02 → T-03 (PTY server)
2. T-04 (exec stream)
3. T-05 → T-06 (renderer)

## Lacunas Pendentes (🔴)

- Cancel HTTP para one-shot in-flight (se existir)
