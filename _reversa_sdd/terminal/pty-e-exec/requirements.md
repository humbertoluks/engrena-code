# pty-e-exec

> Spec de PTY interactivo e exec one-shot para tools/agent.  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Sub-unit Terminal: spawn PTY real, stream de output bidireccional, resize, cancel/kill, e exec one-shot com streaming WS. Superfície usada pelo workspace (XtermView) e quick-actions; confinada ao cwd do projeto. 🟢

## Responsabilidades

- Spawn PTY com shell login no cwd do projeto 🟢
- Stream output via pty.data (ANSI preservado) 🟢
- Aceitar pty.input e pty.resize (clamp dims) 🟢
- pty.close / kill encerra sessão 🟢
- One-shot exec com stream terminal.output + agregado HTTP 🟢
- Cancel via timeout SIGKILL (one-shot) ou pty.close (PTY) 🟢

## Regras de Negócio

- cwd sempre `projects.path`; cliente não envia path 🟢
- Input/resize bufferizados até pty.open completar 🟢
- clampDim cols/rows ∈ [1, 1000] 🟢
- One-shot timeout 5 minutos 🟢
- exitCode ≠ 0 não falha HTTP 🟢
- Máx 16 PTYs simultâneos por cliente WS 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | pty.open spawns com cols/rows iniciais | Must | pty.data within 1s |
| RF-02 | pty.input escreve stdin do PTY | Must | echo visível no client |
| RF-03 | pty.resize actualiza dimensões | Must | clamp aplicado |
| RF-04 | pty.close mata processo PTY | Must | pty.exit emitido |
| RF-05 | one-shot stream chunks via WS | Must | terminal.output antes exit |
| RF-06 | one-shot timeout → SIGKILL | Should | exitCode -1 ou signal |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | Sem cwd do cliente | ws/server.ts | 🟢 |
| Performance | lazy node-pty import | pty.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado pty.open válido para projectId
Quando usuário digita via pty.input
Então pty.data reflecte output do shell no cwd do projeto

Dado PTY aberto
Quando pty.resize com cols=2000
Então dims clamped a 1000

Dado one-shot command long-running
Quando timeout 5min excede
Então processo morto e terminal.exit emitido

Dado pty.close
Quando handle executa
Então PTY encerrado e slot libertado no cap 16
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-05 | Must | Terminal interactivo core |
| RF-06 | Should | Protege runaway processes |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/terminal/pty.ts` | spawnPty, PtyHandle | 🟢 |
| `packages/server/src/terminal/exec.ts` | runTerminalCommand | 🟢 |
| `packages/server/src/ws/server.ts` | handlePtyMessage | 🟢 |
| `packages/renderer/api/pty.ts` | pending buffer | 🟢 |
