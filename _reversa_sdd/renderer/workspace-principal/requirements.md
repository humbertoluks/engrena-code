# workspace-principal

> Spec de requisitos do workspace IDE (`#principal`).  
> Nível: essencial · Confiança: afirmações marcadas 🟢/🟡/🔴  
> Unit aninhada de: `renderer`

## Visão Geral

Tela **PrincipalScreen**: workspace de três painéis (sidebar projetos/threads, chat/streaming, diff/terminal). Orquestra seleção de projeto/thread, dispatch de mensagens, review de diffs, fila de follow-ups, status VCS/git, terminal PTY e command palette. Estado elevado em `usePrincipalWorkspace`. 🟢

## Responsabilidades

- Árvore de projetos e threads com cache por projeto 🟢
- ThreadDetail: histórico, streaming WS, abas Histórico/Prompt/Diff 🟢
- TaskComposer: modelo, mentions, imagens, voz 🟢
- Message queue persistente (localStorage) com lease server 🟢
- Terminal dock + sessões PTY (`useTerminalSessions`) 🟢
- WorkspaceContext para command palette 🟢
- Pills/meta: state thread, diff pending, context window 🟢
- Oferta codegraph condicional (`codegraph.logic`) 🟢

## Regras de Negócio

- Tool call status explícito (`running`/`done`/`interrompido`), não inferido 🟢
- Reducer WS merge por `seq`; subagents aninhados por `parentToolCallId` 🟢
- Fila follow-up: falha retém item; sem retry otimista pós-reload 🟢
- Badge pipeline/build usa campo `synthetic`, não prefixo 🟢
- Git/VCS refresh após ações que alteram repo (`shouldRefreshVcsAfter`) 🟢
- Seleção projeto/thread persiste via AppShell navigation state 🟢
- `terminalRunning` no context sempre false (dívida pós-PTY) 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | Listar projetos e expandir árvore de threads | Must | Cache threadsByProject |
| RF-02 | Abrir thread e carregar histórico + subscribe WS | Must | useThreadConversation ativo |
| RF-03 | Enviar mensagem / dispatch via composer | Must | Thread running; eventos stream |
| RF-04 | Exibir e revisar diffs (accept/reject) | Must | Aba Diff sincronizada |
| RF-05 | Fila de follow-ups com persistência local | Should | Poll + lease atômico |
| RF-06 | Terminal interativo no dock | Should | PTY WS open/data/exit |
| RF-07 | Command palette com ações do workspace | Should | WorkspaceContextValue |
| RF-08 | Context window % derivado de usage | Could | lib/contextWindow.ts |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Performance | Cache threads evita refetch desnecessário | PrincipalScreen.logic | 🟢 |
| UX | openThreadRequestId força aba chat no re-clique | usePrincipalWorkspace | 🟢 |
| Disponibilidade | WS reconnect re-hidrata conversa | useThreadConversation | 🟢 |

## Critérios de Aceitação

```gherkin
Dado projeto selecionado com threads em cache
Quando usuário expande projeto na sidebar
Então threads listadas sem refetch se cache válido

Dado thread aberta e running
Quando evento message.delta chega com seq maior
Então timeline atualiza streaming sem duplicar

Dado diff pending na thread
Quando usuário aceita alteração na aba Diff
Então status diff atualiza e meta sobe para pills

Dado follow-up enfileirado com thread busy
Quando lease server disponível
Então mensagem enviada e item removido da fila
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Core da IDE conversacional |
| RF-05–RF-07 | Should | Produtividade avançada |
| RF-08 | Could | Indicador informativo |

## Rastreabilidade de Código

| Arquivo | Papel | Cobertura |
|---------|-------|-----------|
| `packages/renderer/src/screens/PrincipalScreen.tsx` | Layout 3 painéis | 🟢 |
| `packages/renderer/src/screens/usePrincipalWorkspace.ts` | Estado/handlers | 🟢 |
| `packages/renderer/src/screens/PrincipalScreen.logic.ts` | Funções puras | 🟢 |
| `packages/renderer/src/hooks/useThreadConversation.ts` | History + reducer | 🟢 |
| `packages/renderer/src/hooks/useMessageQueue.tsx` | Fila follow-up | 🟢 |
| `packages/renderer/src/components/TaskComposer.tsx` | Composer | 🟢 |
| `packages/renderer/src/components/ThreadDetail.tsx` | Timeline/abas | 🟢 |
| `packages/renderer/src/components/TerminalDock.tsx` | PTY dock | 🟢 |
