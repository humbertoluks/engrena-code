# pty-e-exec, Design Técnico

> Spawn PTY, stream output, cancel e exec one-shot.

## Interface

### PTY lifecycle

```
client: pty.open → server: spawn → pty.data* → client: pty.input/resize → server: pty.exit
client: pty.close → kill PTY
```

🟢

### One-shot lifecycle

```
POST /terminal → spawn → terminal.output* → terminal.exit → HTTP response aggregate
```

🟢

### clampDim

| Parâmetro | Range | Default open | Confiança |
|-----------|-------|--------------|-----------|
| cols | 1–1000 | client provided | 🟢 |
| rows | 1–1000 | client provided | 🟢 |

### Pending buffer (renderer)

| Estado | Comportamento | Confiança |
|--------|---------------|-----------|
| pré-open | input/resize enqueued | 🟢 |
| pós-open | drain queue to PTY | 🟢 |

## Fluxo PTY detalhado

1. Client gera sessionId; envia pty.open(projectId, cols, rows) 🟢
2. Server lookup project.path; reject se cap 16 🟢
3. spawnPty lazy: createRequire('node-pty'); shell `-l` 🟢
4. onData → pty.data to owning client only 🟢
5. pty.input → write stdin 🟢
6. pty.resize → clampDim → pty.resize native 🟢
7. pty.close → kill; emit pty.exit; free slot 🟢

## Fluxo exec detalhado

1. POST command string 🟢
2. execId generated; spawn shell interpret command 🟢
3. stdout/stderr → terminal.output events 🟢
4. on close → terminal.exit + aggregate body 🟢
5. setTimeout 5min → SIGKILL if alive 🟢

## Dependências

- node-pty (native) 🟢
- projectScope 🟢
- WS session auth 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Lazy native load | pty.ts | 🟢 |
| Cap 16 per WS client | ws/server | 🟢 |
| ANSI no strip | exec + pty | 🟢 |

## Riscos e Lacunas

- 🔴 API de cancel mid-flight one-shot (se existe além timeout)
- 🟡 Agent tool integration vs UI terminal (same backend?)
- 🟡 Signal mapping exact on Windows kill
