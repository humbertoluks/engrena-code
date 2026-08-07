# Plano de Implementação: F21. AskUserQuestion

**Pré-requisitos:**
- Herdar stack/tooling de `docs/_shared/codebase-patterns.md` (Electron/TS ESM, MCP interno `engrenacode` stdio, HTTP loopback por turno, WS hub por-thread, Vitest) — nenhuma ferramenta/biblioteca nova exigida por esta feature
- Sem variáveis de ambiente novas
- Sem migração SQL nova (`threads.state` já é `TEXT NOT NULL` sem `CHECK`)

### Fase 1: Estado de thread e reconciliação de boot

**1. Estender `ThreadState`** - Adicionar `'waiting_user'` ao union type em `threads.ts` e expor `setThreadState` para esse valor; nenhuma migração necessária.

**2. Reconciliação de boot** - Estender `recoverRunningThreads()` para também reconciliar threads presas em `waiting_user` (crash/restart) → `error`, no mesmo `UPDATE ... RETURNING *` já usado para `running`.

### Fase 2: Ponte pergunta↔resposta e tool MCP

**3. Servidor de pergunta pendente** - Criar `ask-user-question.ts`: registro `Map<threadId, resolver>`, servidor HTTP loopback com rota `POST /ask` que segura a resposta até `resolveAskUserQuestion`/`rejectAskUserQuestion` ser chamado.

**4. Tool `ask_user_question` no MCP interno** - Adicionar o schema (`prompt`, `options` ≤4, `multiSelect`) e o handler ao script embutido de `subagent-mcp-server.ts`, roteando `tools/call` para `POST /ask` no mesmo servidor loopback já usado por `call_subagent`.

### Fase 3: Wiring no dispatch e endpoint de resposta

**5. Registro incondicional da tool** - Em `dispatch.ts`, tornar `wantsAskUserQuestion` sempre verdadeiro quando o provider suporta MCP (independente de catálogo de skills/subagents vinculado); abrir `createAskUserQuestionServer` junto do MCP interno.

**6. Transições de estado no ciclo do turno** - Especializar `onEvent` do dispatch para `tool-start`/`tool-result` de `ask_user_question`: transição para `waiting_user` com `emit state.change`, retorno para `running` na resposta; cleanup no `finally` fecha o servidor e rejeita pergunta pendente em cancelamento/erro; estender o branch `mcp.notice` para sempre disparar em provider sem suporte a MCP.

**7. Endpoint de resposta** - Adicionar `POST /api/threads/:id/answer` em `threads-handler.ts`: valida `thread.state === 'waiting_user'` e corpo (`selectedOptions`/`freeText`), chama `resolveAskUserQuestion`.

**8. Gates de "thread ocupada"** - Estender os 4 pontos existentes que checam `state === 'running'` (`git-handler.ts`, `GitActions.tsx`, `TaskComposer.tsx`, `usePrincipalWorkspace.ts`) para também tratar `waiting_user` como ocupada.

### Fase 4: Contrato de frontend

**9. Client HTTP e hook** - Adicionar `answerQuestion(threadId, body)` ao `threads-service.ts`; estender `usePrincipalWorkspace.ts` para derivar a pergunta pendente do `tool_call` mais recente quando `state === 'waiting_user'` e expor `answerQuestion`.

**10. Validação pura e componente de contrato** - Criar `askUserQuestion.logic.ts` (`validateAnswer`) e `AskUserQuestionCard.tsx` só com o contrato de props (pergunta, opções, multiSelect, callback) — sem anatomia/copy final, que ficam pendentes de `ui.md`/`copy.md`; montar em `ChatHistory.tsx` quando a thread está `waiting_user`.

### Fase 5: Validação e fechamento

**11. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + integração + smoke). Confirmar os 4 critérios de aceitação de F21 (`docs/PRD.md` seção F21) e o critério cross-feature de pausa/retomada sem quebrar lease/thread_busy. Registrar explicitamente que a fase visual (card inline final na timeline, com light/dark, anatomia e copy) fica bloqueada até `ui.md`/`copy.md` de F21 existirem — não fechar essa parte nesta rodada. Gate: suite e build verdes.
