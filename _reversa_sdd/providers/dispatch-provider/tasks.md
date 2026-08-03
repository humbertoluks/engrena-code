# dispatch-provider, Tarefas de Implementação

> Reimplementar dispatch/cancel e stream causal a partir do legado.

## Pré-requisitos

- [ ] `ProviderDriver` e `DispatchOptions` definidos
- [ ] Runner `runDispatch` consome AsyncIterable
- [ ] Rota `cancel-thread` wired ao registry
- [ ] Brokers permission/question injetados no options

## Tarefas

- [ ] T-01, Implementar inflight map threadId→handle em cada driver
  - Origem no legado: `packages/server/src/providers/claude-agent.ts`, `codex.ts`, `*-acp.ts`
  - Critério de pronto: cancel(T) atinge turno correto; sem leak após fim
  - Confiança: 🟢

- [ ] T-02, Claude-family: `query({ abortController })` usar controller do runner
  - Origem no legado: `packages/server/src/providers/claude-agent.ts`
  - Critério de pronto: POST cancel aborta sem controller duplicado
  - Confiança: 🟢

- [ ] T-03, Codex: cancel via SIGTERM + teardown app-server
  - Origem no legado: `packages/server/src/providers/codex.ts`
  - Critério de pronto: processo filho não zumbifica; DispatchCancelledError
  - Confiança: 🟢

- [ ] T-04, Grok/Kimi ACP: cancel protocol + encerramento stdio
  - Origem no legado: `packages/server/src/providers/grok-acp.ts`, `kimi-acp.ts`
  - Critério de pronto: stream para; erro cancel distinguível de falha
  - Confiança: 🟢

- [ ] T-05, Yield RawStreamEvent sem seq/threadId
  - Origem no legado: todos drivers + `providers/types.ts`
  - Critério de pronto: runner é único carimbo de seq
  - Confiança: 🟢

- [ ] T-06, Wire `requestPermission` / `requestQuestion` com AbortSignal
  - Origem no legado: `providers/types.ts`, claude-agent canUseTool
  - Critério de pronto: signal abort nega permission pendente
  - Confiança: 🟢

- [ ] T-07, Runner: tratar DispatchCancelledError → idle
  - Origem no legado: `packages/server/src/runner/dispatch.ts`
  - Critério de pronto: cancel HTTP não marca error
  - Confiança: 🟢

- [ ] T-08, Rota cancel HTTP delegando ao driver
  - Origem no legado: `packages/server/src/routes/cancel-thread.ts`
  - Critério de pronto: 200/409 coerente com thread state
  - Confiança: 🟢

## Tarefas de Teste

- [ ] TT-01, Dispatch feliz → eventos causais consumidos
- [ ] TT-02, Cancel mid-dispatch → idle + histórico preservado
- [ ] TT-03, Double cancel idempotente
- [ ] TT-04, Falha SDK ≠ DispatchCancelledError → error state

## Ordem Sugerida

1. T-05 (contrato stream)
2. T-01, T-02 (Claude path principal)
3. T-03, T-04 (CLI/ACP)
4. T-06 (brokers)
5. T-07, T-08 (runner + rota)

## Lacunas Pendentes (🔴)

- Testes de integração com SDK/CLI reais (flaky CI)
- Política de partial persist quando cancel durante tool_call
