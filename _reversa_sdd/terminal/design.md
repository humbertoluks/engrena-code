# terminal, Design Técnico

> Como o módulo Terminal é construído, com base no legado.

## Interface

### One-shot HTTP + WS

| Símbolo | Tipo | Notas | Confiança |
|---------|------|-------|-----------|
| `TerminalExecRequest` | { command } | shell interpreta | 🟢 |
| `TerminalExecResponse` | stdout, stderr, exitCode, execId | agregado final | 🟢 |
| `terminal.output` | projectId, execId, stream, chunk | live WS | 🟢 |
| `terminal.exit` | projectId, execId, exitCode, signal? | live WS | 🟢 |

### PTY WebSocket

| Mensagem | Direção | Payload | Confiança |
|----------|---------|---------|-----------|
| pty.open | client→server | sessionId, projectId, cols, rows | 🟢 |
| pty.input | client→server | data | 🟢 |
| pty.resize | client→server | cols, rows | 🟢 |
| pty.close | client→server | — | 🟢 |
| pty.data | server→client | output bytes | 🟢 |
| pty.exit | server→client | exitCode | 🟢 |

### PtyHandle (server)

| Método | Papel | Confiança |
|--------|-------|-----------|
| write | stdin data | 🟢 |
| resize | cols/rows clamped | 🟢 |
| kill/close | encerra PTY | 🟢 |

## Fluxo Principal (one-shot)

1. UI/quick-action → POST `{command}` 🟢
2. `runTerminalCommand(cwd projectScope)` spawn+shell 🟢
3. Chunks `terminal.output` no canal projectId 🟢
4. `terminal.exit` + response HTTP agregado 🟢
5. Timeout 5min → SIGKILL; exitCode -1 se sinal 🟢

## Fluxo Principal (PTY)

1. Renderer abre WS (subprotocolo session) 🟢
2. `pty.open` → server resolve `projects.path` 🟢
3. `spawnPty` lazy node-pty; shell `-l` POSIX 🟢
4. `pty.data`/`pty.exit` só para client owner 🟢
5. Input/resize enfileirados até open complete 🟢

## Dependências

- `server-core` projectScope 🟢
- `node-pty` nativo 🟢
- `shared` contratos terminal/pty 🟢
- xterm.js renderer 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| cwd server-side only | handlePtyMessage | 🟢 |
| terminal.* live-only (no replay) | ws replay filter | 🟢 |
| lazy-load node-pty | pty.ts createRequire | 🟢 |

## Riscos e Lacunas

- 🟢 Shell default: `powershell.exe` no win32, `/bin/bash` nos demais (`terminal/pty.ts`) [Revisão]
- 🟡 terminalRunning no WorkspaceContext (dívida pós-PTY)
- 🟡 Integração agent tools com terminal (se distinct)
