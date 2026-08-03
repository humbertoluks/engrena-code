# workspace-principal, Design Técnico

> Workspace IDE de três painéis no renderer.

## Interface

### PrincipalNavigationState

| Campo | Tipo | Papel |
|-------|------|-------|
| `selectedProjectId` | string \| null | Projeto ativo 🟢 |
| `selectedThreadId` | string \| null | Thread aberta 🟢 |
| `expandedProjectIds` | string[] | Sidebar expandida 🟢 |

### usePrincipalWorkspace (saídas principais)

| Grupo | Exemplos | Confiança |
|-------|----------|-----------|
| Sidebar | projects, threadsByProject, onOpenThread | 🟢 |
| Thread ativa | selectedThread, activeRunning | 🟢 |
| Composer/queue | sendMessage, messageQueue | 🟢 |
| Terminal | terminalSessions, openTerminal | 🟢 |
| Palette | workspaceValue (WorkspaceContextValue) | 🟢 |

### useThreadConversation

| Conceito | Descrição |
|----------|-----------|
| `ConversationMessage` | role, content, seq, streaming, synthetic? 🟢 |
| `ConversationToolCall` | toolName, status, result, seq 🟢 |
| `ConversationSubagent` | nested timeline por parentToolCallId 🟢 |
| Reducer | mergeHistory + applyEvent por tipo WS 🟢 |

## Fluxo Principal

1. AppShell monta PrincipalScreen com navigation state inicial 🟢
2. Fetch projects → seleciona/restaura projeto + thread 🟢
3. Expand projeto → load threads (phase loading/ready/error) 🟢
4. Open thread → fetch history → `subscribeThread` WS 🟢
5. Composer dispatch → POST message → eventos stream atualizam reducer 🟢
6. Meta (state, diffs) sobe para header/pills/sidebar badges 🟢

## Layout (PrincipalScreen)

```
┌─────────────┬──────────────────────────┐
│ ProjectTree │ ThreadDetail             │
│             │  (Chat / Prompt / Diff)  │
│             ├──────────────────────────┤
│             │ TaskComposer             │
├─────────────┴──────────────────────────┤
│ TerminalDock (colapsável)              │
└────────────────────────────────────────┘
```

Confiança layout: 🟢

## Fluxos Alternativos

- **Thread running + nova seleção:** UI reflete busy; lease 409 🟢
- **WS disconnect:** backoff; re-fetch history; dedupe seq 🟢
- **Codegraph offer:** gate absent+indexável+!suppressed 🟢
- **VCS banner:** credenciais/config status via hooks dedicados 🟢
- **Re-clique mesma thread:** `openThreadRequestId++` → volta aba chat 🟢

## Dependências

- API server: projects, threads, messages, diffs, dispatch, git, pty 🟢
- `@lioncode/shared` types 🟢
- `useVcsStatus`, `useTerminalSessions`, `useMessageQueue` 🟢
- CommandPalette ← WorkspaceContext 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| Lógica pura em `.logic.ts`; hook só amarra React | usePrincipalWorkspace header | 🟢 |
| Message queue localStorage + server lease | useMessageQueue | 🟢 |
| Context window do último usage event | lib/contextWindow.ts | 🟢 |

## Riscos e Lacunas

- 🔴 Matriz completa PermissionBroker UI por AccessLevel
- 🟡 Integração pipeline/build badges em todas as combinações de state
- 🟡 `terminalRunning` fixo false até dívida PTY resolvida
