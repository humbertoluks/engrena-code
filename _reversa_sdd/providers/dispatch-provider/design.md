# dispatch-provider, Design Técnico

> Execução `dispatch` / `cancel` e semântica de stream no driver.

## Interface

### Assinaturas

```typescript
dispatch(prompt: string, options: DispatchOptions): AsyncIterable<RawStreamEvent>
cancel(threadId: string): void
```

🟢 `ProviderDriver` em `types.ts`

### `DispatchCancelledError`

| Campo | Uso |
|-------|-----|
| `threadId` | Correlação |
| Mensagem | "Dispatch cancelado…" |
| Tratamento runner | idle, não error |

Distinto de falha operacional. 🟢

### Inflight (por driver)

| Mapa | Valor |
|------|-------|
| `threadId` | AbortController e/ou ChildProcess / ACP session |

Registry singleton garante cancel compartilhado entre dispatch e HTTP cancel. 🟢

## Fluxo Principal (dispatch)

1. Runner cria `AbortController` do turno; passa em `options` 🟢
2. Driver registra inflight[threadId] 🟢
3. Monta prompt (texto, imagens, prefixos rules/memory/skills) 🟢
4. Inicia SDK/CLI/ACP com signal ligado 🟢
5. Para cada evento upstream → yield `RawStreamEvent` (sem seq) 🟢
6. Callbacks síncronos/async bloqueiam em permission/question até broker 🟢
7. Stream completa ou abort → limpa inflight 🟢

## Fluxo Principal (cancel)

1. HTTP `cancel-thread` ou cancel cascata subagent 🟢
2. Runner chama `driver.cancel(threadId)` **e/ou** `abortController.abort()` 🟢
3. **Claude-family:** signal aborta `query()` 🟢
4. **Codex:** SIGTERM no processo; cleanup MCP proxy 🟡
5. **ACP:** mensagem cancel protocolar + kill stdio 🟢
6. Driver lança/encerra com `DispatchCancelledError` 🟢
7. Runner persiste estado parcial e WS `state.change` → idle 🟢

## Ordem Causal RawStreamEvent

Tipos emitidos pelo driver (exemplos): text deltas, `tool_call.start/result`, reasoning, usage bruto. Runner só aloca `seq` em pontos definidos (text blocks, tool_call.start). 🟢

Driver **nunca** reordena eventos recebidos do SDK/CLI. 🟢

## Dependências

- Runner `dispatch.ts` — único consumidor oficial 🟢
- PermissionBroker / QuestionBroker — via closures 🟢
- `DelegateFn` — subagent depth=1 🟢

## Decisões de Design

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| abortController owned by runner | types.ts DispatchOptions | 🟢 |
| Cancel = idle, não error | DispatchCancelledError doc | 🟢 |
| Fallback driver-owned controller só testes | types.ts comentário | 🟢 |
| Codex usage cumulativo exige priorUsage delta | codex.ts | 🟢 |

## Estado Interno

| Estado | Escopo |
|--------|--------|
| inflight map | por driver instance |
| Session ids ephemeral | até onSession persistir |

## Observabilidade

- Sem logs de prompt completo 🟡
- transportName exposto pós-dispatch 🟢

## Riscos e Lacunas

- 🔴 Timeout máximo de dispatch por provider
- 🟡 Ordem exacta de cleanup MCP proxy Codex no cancel
- 🟡 Race cancel vs último evento usage
