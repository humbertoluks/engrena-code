# turno-dispatch, Tarefas de Implementação

> Reimplementar scheduleDispatch → runDispatch ponta a ponta.

## Pré-requisitos

- [ ] T-01/T-02/T-03 da unit pai `runner/tasks.md` (SeqAllocator, TurnRegistry, DispatchContext)
- [ ] Lease em `git/project-execution.ts`
- [ ] Worktree resolution em `git/worktree.ts`
- [ ] Driver provider funcional

## Tarefas

- [ ] T-01, Implementar `scheduleDispatch` com aquisição/liberação de lease
  - Origem no legado: `packages/server/src/runner/dispatch.ts` (`scheduleDispatch`)
  - Critério de pronto: 409 se busy; lease liberada no finally de runDispatch
  - Confiança: 🟢

- [ ] T-02, Fase prepare: register turn + resolve cwd (main/worktree)
  - Origem no legado: `packages/server/src/runner/dispatch.ts` (início runDispatch)
  - Critério de pronto: TurnRegistry entry; repoPath coerente com executionMode
  - Confiança: 🟢

- [ ] T-03, Fase compose: rules, memory, codegraph, MCP prepare
  - Origem no legado: `dispatch.ts` + `*-registry.ts` + `mcp-secrets.ts`
  - Critério de pronto: blocos no prompt; MCPs com secrets resolvidos ou omitidos
  - Confiança: 🟢

- [ ] T-04, Driver loop allocate-then-emit (persist + WS)
  - Origem no legado: `dispatch.ts` loop principal + `seq-allocator.ts`
  - Critério de pronto: seq idêntico em DB e WS; controle sem seq
  - Confiança: 🟢

- [ ] T-05, Finalize: flush, generateDiffs, diff.ready, thread idle/error
  - Origem no legado: `dispatch.ts` finalize + `git/diff.ts`
  - Critério de pronto: idle em sucesso/cancel; error em falha operacional
  - Confiança: 🟢

- [ ] T-06, Finally: MCP teardown, broker clear, turns.complete, lease release
  - Origem no legado: `dispatch.ts` bloco finally
  - Critério de pronto: sem handles órfãos após turno
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Turno feliz → idle + seq monotônico
- [ ] TT-02, Lease 409
- [ ] TT-03, Cancel mid-stream → idle + deny permissions
- [ ] TT-04, Erro driver → error + cleanup

## Tarefas de Migração de Dados (se aplicável)

- N/A

## Ordem Sugerida

1. T-01 (lease gate)
2. T-02, T-03 (prepare + compose)
3. T-04 (loop core)
4. T-05, T-06 (finalize + finally)

## Lacunas Pendentes (🔴)

- Integração scheduler onIdle para pipeline pending_resume
