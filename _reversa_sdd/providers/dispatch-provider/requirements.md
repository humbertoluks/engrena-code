# dispatch-provider

> Spec de requisitos de execução e cancelamento no driver (`dispatch` / `cancel`).  
> Unidade filha de `providers` · Nível: essencial · Confiança: 🟢/🟡/🔴

## Visão Geral

Contrato de **execução de turno** no driver: `dispatch` produz stream de `RawStreamEvent` em ordem **causal**; `cancel(threadId)` interrompe via `AbortController` (Claude-family) ou **SIGTERM**/cancel ACP (Codex/Grok/Kimi). O runner trata `DispatchCancelledError` como retorno estável a `idle`. 🟢

## Responsabilidades

- Emitir eventos de conteúdo, tools e telemetria **sem** `seq`/`threadId` 🟢
- Respeitar `abortController` injetado pelo runner quando presente 🟢
- Registrar inflight por `threadId` para `cancel()` 🟢
- Mapear `accessLevel` / `modeChatPlan` para permission mode do SDK 🟢
- Invocar closures (`requestPermission`, `delegate`, etc.) sem persistir 🟢
- Lançar `DispatchCancelledError` em cancel gracioso 🟢
- Nunca escrever em DB ou emitir WS diretamente 🟢

## Regras de Negócio

- Ordem causal dos RawStreamEvents é contrato — runner assume para allocate-then-emit 🟢
- `plan` tem precedência sobre `accessLevel` no Claude-family 🟢
- Cancel do endpoint `POST /threads/:id/cancel` aciona `registry.get(...).cancel` 🟢
- Cancel em cascata de subagent usa mesmo AbortController do turno pai 🟢
- Histórico já persistido **não** é apagado no cancel 🟢
- Falha real (não cancel) ≠ `DispatchCancelledError` → thread `error` 🟢

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | `dispatch` retorna AsyncIterable consumível pelo runner | Must | Loop for-await funciona |
| RF-02 | Eventos omitam seq; incluam deltas, tool_call, usage raw | Must | Runner carimba seq |
| RF-03 | `cancel(threadId)` aborta turno ativo da thread | Must | Stream termina com cancelled |
| RF-04 | Usar `options.abortController` quando fornecido | Must | Paridade com rota cancel |
| RF-05 | `onSession` callback quando provider devolve session id | Should | Resume multi-turn |
| RF-06 | Imagens em prompt (Claude-only) via DispatchImage[] | Should | Upload endpoint integrado |
| RF-07 | `containedExecution` isola env/tools para validador | Could | Build feature |

## Requisitos Não Funcionais

| Tipo | Requisito | Evidência | Confiança |
|------|-----------|-----------|-----------|
| Cancel | Claude: AbortController.signal | claude-agent.ts | 🟢 |
| Cancel | Codex/Grok/Kimi: SIGTERM / ACP cancel | codex.ts, *-acp.ts | 🟢 |
| Robustez | Driver não propaga throw após cancel tratado | runner/dispatch.ts | 🟢 |
| Segurança | signal em permission/question aborta wait | DispatchOptions | 🟢 |

## Critérios de Aceitação

```gherkin
Dado dispatch em andamento para threadId=T
Quando runner chama driver.cancel(T)
Então o AsyncIterable encerra com DispatchCancelledError
E a thread transiciona para idle sem apagar mensagens persistidas

Dado options.abortController fornecido pelo runner
Quando POST cancel aciona abort()
Então driver Claude encerra query SDK sem criar controller próprio

Dado driver Codex com processo filho
Quando cancel(T)
Então SIGTERM/cancel ACP mata CLI graciosamente

Dado stream de RawStreamEvents
Quando runner consome em ordem
Então nenhum evento contém seq ou threadId preenchidos pelo driver
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01–RF-04 | Must | Core do turno conversacional |
| RF-05, RF-06 | Should | Resume e multimodal |
| RF-07 | Could | Feature build |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/providers/types.ts` | dispatch/cancel contract | 🟢 |
| `packages/server/src/providers/claude-agent.ts` | query + abortController | 🟢 |
| `packages/server/src/providers/codex.ts` | cancel SIGTERM | 🟢 |
| `packages/server/src/providers/grok-acp.ts` | ACP cancel | 🟢 |
| `packages/server/src/providers/kimi-acp.ts` | ACP cancel | 🟢 |
| `packages/server/src/runner/dispatch.ts` | consume stream, cancel route | 🟢 |
| `packages/server/src/routes/cancel-thread.ts` | HTTP cancel | 🟢 |
