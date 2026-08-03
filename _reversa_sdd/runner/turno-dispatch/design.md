# turno-dispatch, Design Técnico

> Como o fluxo scheduleDispatch → runDispatch é construído no legado.

## Interface

### `scheduleDispatch`

| Parâmetro | Tipo | Papel | Confiança |
|-----------|------|-------|-----------|
| `ctx` | DispatchContext | deps injetadas | 🟢 |
| `req` | DispatchRequest | thread, driver, prompt, repoPath | 🟢 |

Retorno: `Promise<void>`; erros HTTP mapeados na rota chamadora. 🟢

### Fases internas de `runDispatch`

| Fase | Ação | Confiança |
|------|------|-----------|
| prepare | lease, turn register, cwd/worktree | 🟢 |
| compose | rules, memory, codegraph, MCP secrets | 🟢 |
| motor? | branch workflow/pipeline/build | 🟢 |
| drive | driver.dispatch loop | 🟢 |
| finalize | flush, diffs, state, WS | 🟢 |
| finally | cleanup brokers/MCP/lease | 🟢 |

## Fluxo Principal

1. **scheduleDispatch** → tenta lease (`projectExecutionRegistry`) 🟢
2. **runDispatch** inicia:
   - `turns.register(threadId, abortController)` 🟢
   - Resolve `repoPath`: `main` cwd vivo ou worktree `lioncode/<thread>` 🟢
   - Snapshot registries (skills, subagents, MCPs) 🟢
   - Compõe blocos: rules, memory (pai only), codegraph tools 🟢
   - Prepara MCPs via vault secrets (`mcp-secrets.ts`) 🟢
3. Se `command` presente → motor especializado (early return do loop genérico) 🟢
4. **Driver loop:**
   - Para cada chunk: `seq = seqAllocator.next(threadId)` 🟢
   - Persist message block / tool_call.start com seq 🟢
   - Emit WS com mesmo seq 🟢
   - Permission/question brokers bloqueiam até resposta 🟢
5. **Finalize:** flush, `generateDiffs`, emit `diff.ready`, thread → idle 🟢
6. **Finally:** MCP teardown, broker clear, lease release, `turns.complete` 🟢

## Fluxos Alternativos

- **Cancel mid-stream:** abort → driver.cancel + filhos; permission deny; idle 🟢
- **Erro driver:** catch → thread error; finally igual 🟢
- **Comando motor:** pipeline/build substituem loop; ver sub-units 🟢
- **sessionCwd mismatch:** provider session não retomada 🟢
- **Memory read fail:** turno continua sem bloco memory 🟢

## Dependências

- `git/worktree.ts` — cwd efetivo 🟢
- `git/project-execution.ts` — lease 🟢
- `git/diff.ts` — diffs pós-turno 🟢
- `runner/*-registry.ts` — catálogos live 🟢
- `providers/*` — driver.dispatch 🟢
- WS hub — fan-out 🟢

## Decisões de Design Identificadas

| Decisão | Evidência | Confiança |
|---------|-----------|-----------|
| allocate-then-emit | seq-allocator + dispatch loop | 🟢 |
| Review não bloqueia idle | comentários dispatch | 🟢 |
| Finally obrigatório para lease | dispatch.ts | 🟢 |
| Motores bypass loop genérico | *-motor.ts early entry | 🟢 |

## Estado Interno (por turno)

| Campo | Onde | Notas |
|-------|------|-------|
| abortController | TurnRegistry | cancel hook |
| seq counter | SeqAllocator | por threadId |
| pending permissions | PermissionBroker | in-memory |
| MCP child processes | dispatch finally | spawn/teardown |

## Observabilidade

- WS: message blocks, tool_call, state.change, diff.ready 🟢
- token.usage sem seq 🟢

## Riscos e Lacunas

- 🟡 Ordem exacta de teardown MCP vs broker vs lease
- 🟢 Scheduler onIdle para pipeline pending_resume: `runner/pipeline-scheduler.ts` + `schedulePipelineContinuation` [Revisão]
