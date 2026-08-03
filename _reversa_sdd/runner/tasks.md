# runner, Tarefas de Implementação

> Sequência para reimplementar o núcleo de execução a partir do legado.

## Pré-requisitos

- [ ] Pacote `@lioncode/shared` com tipos Thread, Command, FeaturePipeline/Build
- [ ] Drivers de provider (`packages/server/src/providers`)
- [ ] Módulos `git`, `vault`, `memory`, `codegraph` operacionais
- [ ] Repositories SQLite para messages, tool_calls, diffs, pipelines/builds

## Tarefas

- [ ] T-01, Implementar `SeqAllocator` com `next(threadId)` seed lazy MAX(seq)+1 e `forget`
  - Origem no legado: `packages/server/src/runner/seq-allocator.ts`
  - Critério de pronto: seq monotônico; eventos de controle sem seq
  - Confiança: 🟢

- [ ] T-02, Implementar `TurnRegistry` (register, abort, linkChild, complete) + cancel cascade
  - Origem no legado: `packages/server/src/runner/turns.ts`
  - Critério de pronto: cancel pai propaga filhos; complete remove entry
  - Confiança: 🟢

- [ ] T-03, Montar `DispatchContext` e `runDispatch` / `scheduleDispatch` com lease
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: 409 thread_busy; finally libera lease e MCPs
  - Confiança: 🟢

- [ ] T-04, Loop allocate-then-emit no stream do driver (text blocks + tool_call.start)
  - Origem no legado: `packages/server/src/runner/dispatch.ts` + `seq-allocator.ts`
  - Critério de pronto: persistência e WS usam mesmo seq alocado
  - Confiança: 🟢

- [ ] T-05, `PermissionBroker` e `QuestionBroker` com deny no cancel
  - Origem no legado: `packages/server/src/runner/permission-broker.ts`, `question-broker.ts`
  - Critério de pronto: pending resolve deny/{} ao abort
  - Confiança: 🟢

- [ ] T-06, Delegação: rendezvous + `runDelegatedSubagent` depth=1 + RW-lock + watchdog
  - Origem no legado: `packages/server/src/runner/rendezvous.ts`, `delegate.ts`, `delegation-lock.ts`
  - Critério de pronto: filho efêmero; erro filho não derruba pai
  - Confiança: 🟢

- [ ] T-07, Integração de patches de filhos (`integrate.ts`)
  - Origem no legado: `packages/server/src/runner/integrate.ts`
  - Critério de pronto: merge-tree; stale-base; conflicts retidos
  - Confiança: 🟢

- [ ] T-08, Motores workflow, feature-pipeline, feature-build (ver sub-units)
  - Origem no legado: `workflow-motor.ts`, `feature-pipeline-motor.ts`, `feature-build-motor.ts`
  - Critério de pronto: comando despacha motor; loop genérico bypassed
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Turno feliz: seq crescente + thread idle ao fim
- [ ] TT-02, Cancel cascade pai→filho
- [ ] TT-03, Lease 409 com projeto ocupado
- [ ] TT-04, Delegação depth=2 rejeitada
- [ ] TT-05, Permission pending + cancel → deny

## Tarefas de Migração de Dados (se aplicável)

- N/A (runner usa schema existente de messages/tool_calls)

## Ordem Sugerida

1. T-01, T-02 (fundamentos seq + turns)
2. T-03, T-04 (dispatch core)
3. T-05, T-06, T-07 (brokers + delegação)
4. T-08 (motores especializados)

## Lacunas Pendentes (🔴)

- Matriz PermissionBroker × provider × AccessLevel
- Gates adversarial finos do pipeline reducer
