# workspace-principal, Tarefas de Implementação

> Sequência para reimplementar o workspace principal.

## Pré-requisitos

- [ ] Renderer base com API client autenticado
- [ ] WS thread events no server
- [ ] Rotas git/diff/dispatch documentadas no server

## Tarefas

- [ ] T-01, PrincipalScreen layout 3 painéis + TerminalDock
  - Origem: `packages/renderer/src/screens/PrincipalScreen.tsx`
  - Critério de pronto: sidebar + detail + composer + dock visíveis
  - Confiança: 🟢

- [ ] T-02, usePrincipalWorkspace: projects, cache threads, seleção
  - Origem: `packages/renderer/src/screens/usePrincipalWorkspace.ts`
  - Critério de pronto: expand/load threads; navigation state sync
  - Confiança: 🟢

- [ ] T-03, PrincipalScreen.logic: mergeProjects, patchThread, VCS gate
  - Origem: `packages/renderer/src/screens/PrincipalScreen.logic.ts`
  - Critério de pronto: funções puras testadas; hook consome
  - Confiança: 🟢

- [ ] T-04, useThreadConversation: history + reducer + subscribe
  - Origem: `packages/renderer/src/hooks/useThreadConversation.ts`
  - Critério de pronto: stream por seq; subagents aninhados
  - Confiança: 🟢

- [ ] T-05, TaskComposer + dispatch/sendMessage
  - Origem: `packages/renderer/src/components/TaskComposer.tsx`
  - Critério de pronto: envio dispara dispatch; composer reseta
  - Confiança: 🟢

- [ ] T-06, ThreadDetail abas Chat/Prompt/Diff
  - Origem: `packages/renderer/src/components/ThreadDetail.tsx`
  - Critério de pronto: diff review accept/reject funcional
  - Confiança: 🟢

- [ ] T-07, useMessageQueue + localStorage persist
  - Origem: `packages/renderer/src/hooks/useMessageQueue.tsx`
  - Critério de pronto: fila sobrevive reload; lease server
  - Confiança: 🟢

- [ ] T-08, TerminalDock + useTerminalSessions + XtermView
  - Origem: `packages/renderer/src/components/TerminalDock.tsx`, `hooks/useTerminalSessions.ts`
  - Critério de pronto: PTY abre/fecha; dados fluem
  - Confiança: 🟢

- [ ] T-09, WorkspaceContext + CommandPalette wiring
  - Origem: `packages/renderer/src/screens/WorkspaceContext.tsx`, `components/CommandPalette/*`
  - Critério de pronto: palette invoca ações expostas
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Seleção thread → history + WS subscribe
- [ ] TT-02, Delta seq out-of-order ignorado pelo reducer
- [ ] TT-03, Diff accept atualiza UI
- [ ] TT-04, Follow-up queue após thread idle

## Ordem Sugerida

1. T-01 → T-02 → T-03 (shell + estado)
2. T-04 → T-05 → T-06 (conversa core)
3. T-07, T-08, T-09 (queue, terminal, palette)

## Lacunas Pendentes (🔴)

- UI completa de aprovação de tools (PermissionBroker) no workspace
