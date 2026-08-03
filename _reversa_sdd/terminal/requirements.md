# terminal

> Spec de requisitos do módulo Terminal (`packages/server/src/terminal`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴

## Visão Geral

Duas superfícies de shell no sistema legado: (1) execução one-shot `POST /projects/:id/terminal` com stream WS `terminal.*`; (2) PTY interativo real (`node-pty`) via mensagens `pty.*` no WebSocket, renderizado com xterm.js. Confinamento ao cwd do projeto. 🟢

## Responsabilidades

- One-shot: spawn shell, timeout 5min, emit stdout/stderr/exit 🟢
- PTY: lazy-load node-pty, shell login, write/resize/kill 🟢
- WS hub: roteia pty.open/input/resize/close 🟢
- projectScope: cwd sempre server-side (nunca do cliente) 🟢
- Renderer: XtermView + cliente WS dedicado 🟢
- Replay WS exclui `terminal.*` e `codegraph.status` (live-only) 🟢

## Regras de Negócio

- Confinamento ao cwd do projeto (projectScope / projectId) 🟢
- ANSI preservado (sem strip) em one-shot e PTY 🟢
- exitCode ≠ 0 não é erro HTTP; spawn impossível → TerminalExecError 🟢
- Cap 16 PTYs por cliente WS 🟢
- Shell login POSIX (`-l`); Windows = powershell 🟢
- node-pty precisa rebuild Electron (ABI nativo) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | POST terminal executa command no cwd projeto | Must | stdout/stderr/exitCode no body |
| RF-02 | WS terminal.output/terminal.exit durante one-shot | Must | chunks live por projectId |
| RF-03 | pty.open spawns shell no cwd projeto | Must | pty.data/pty.exit ao client |
| RF-04 | pty.input/resize/close controlam sessão | Must | dims clamp [1,1000] |
| RF-05 | Máx 16 PTYs por cliente | Should | open adicional rejeitado |
| RF-06 | terminal.* fora do replay WS | Should | só eventos live |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Segurança | cwd nunca do cliente | handlePtyMessage | 🟢 |
| Performance | lazy-load node-pty | pty.ts | 🟢 |
| UX | pending I/O buffer pré-open | renderer pty.ts | 🟢 |

## Critérios de Aceitação

```gherkin
Dado projectId válido e command "echo hi"
Quando POST /projects/:id/terminal
Então exitCode=0 e stdout contém "hi"; stderr vazio

Dado WS subscrito ao projectId
Quando one-shot corre
Então terminal.output chunks chegam antes de terminal.exit

Dado pty.open com cols/rows válidos
Quando server spawns PTY
Então cwd é projects.path; pty.data streamed ao mesmo client

Dado 16 PTYs abertos no client
Quando pty.open adicional
Então sessão rejeitada com erro claro
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Terminal é workspace core |
| RF-05, RF-06 | Should | Limites e replay |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/terminal/exec.ts` | runTerminalCommand | 🟢 |
| `packages/server/src/terminal/pty.ts` | spawnPty | 🟢 |
| `packages/server/src/routes/terminal-exec.ts` | POST terminal | 🟢 |
| `packages/server/src/ws/server.ts` | handlePtyMessage | 🟢 |
| `packages/renderer/api/pty.ts` | cliente WS | 🟢 |
| `packages/renderer/components/XtermView.tsx` | xterm.js | 🟢 |
