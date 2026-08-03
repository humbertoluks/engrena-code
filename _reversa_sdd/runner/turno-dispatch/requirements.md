# turno-dispatch

> Caso de uso do módulo `runner`: orquestração ponta a ponta de um turno (`scheduleDispatch` → `runDispatch`).  
> Escopo: lease, composição de contexto, driver loop, persistência, WS fan-out, estados idle/error — sem detalhar motores (ver sub-units).

## Visão Geral

Garantir que cada envio de mensagem/comando percorra o pipeline completo: adquirir lease de projeto, registrar turno, compor contexto, executar driver ou motor, persistir com seq monotônico, emitir eventos WS e encerrar thread em `idle` ou `error`. 🟢

## Responsabilidades

- `scheduleDispatch`: fila/agendamento e aquisição de lease 🟢
- Montar `DispatchContext` e resolver cwd (main vs worktree) 🟢
- Registrar turno em `TurnRegistry` com AbortController 🟢
- Compor rules, memory, codegraph, MCPs, skills, subagents 🟢
- Executar loop do driver com allocate-then-emit 🟢
- Persistir messages/tool_calls/diffs e fan-out WS 🟢
- Finally: limpar brokers, MCP handles, lease; thread → idle/error 🟢

## Regras de Negócio

- Uma execução longa por repo: lease retorna 409 se ocupado 🟢
- Fim de turno bem-sucedido/cancelado → `idle`; review de diff **não** bloqueia 🟢
- `executionMode` já travado na thread; dispatch só respeita 🟢
- Resume de sessão provider só se `sessionCwd` bater com cwd atual 🟢
- Seq WS = seq persistido (allocate-then-emit) 🟢
- Erro operacional → `error`; scheduler pode retomar depois 🟡

## Requisitos Funcionais

| ID | Requisito | Prioridade | Critério de Aceite |
|----|-----------|------------|-------------------|
| RF-01 | scheduleDispatch adquire lease antes de runDispatch | Must | 409 thread_busy se projeto ocupado |
| RF-02 | Registar turno com AbortController linkável a filhos | Must | cancel disponível durante turno |
| RF-03 | Compor contexto: rules, memory, codegraph, MCPs preparados | Must | blocos injetados no driver |
| RF-04 | Driver loop: next seq → persist → emit WS | Must | ordem allocate-then-emit |
| RF-05 | Ao concluir: flush buffers, gerar diffs se aplicável | Must | diff.ready sem seq |
| RF-06 | Finally libera lease, MCPs e brokers | Must | sem leak de recursos |
| RF-07 | Thread state: idle (sucesso/cancel) ou error (falha) | Must | state.change emitido |

## Requisitos Não Funcionais

| Tipo | Requisito inferido | Evidência no código | Confiança |
|------|--------------------|---------------------|-----------|
| Concorrência | Lease exclusiva por projeto | `project-execution.ts` | 🟢 |
| Consistência | seq monotônico por thread | `seq-allocator.ts` | 🟢 |
| Disponibilidade | Finally sempre executa cleanup | `dispatch.ts` finally | 🟢 |
| UX | WS fan-out em tempo real | dispatch emit | 🟢 |

## Critérios de Aceitação

```gherkin
Dado thread idle e projeto livre
Quando scheduleDispatch recebe prompt
Então lease adquirida, turno registered, driver executa e thread volta a idle

Dado projeto com lease ativa de outra thread
Quando scheduleDispatch tenta iniciar
Então resposta 409 thread_busy sem side-effects

Dado turno em running com stream ativo
Quando bloco de texto é produzido
Então seq é alocado antes de persistir e antes de emitir WS

Dado falha operacional no driver
Quando runDispatch captura erro não-recuperável
Então thread vai para error, lease liberada no finally

Dado turno cancelado pelo usuário
Quando AbortController dispara
Então driver.cancel, filhos cancelados, thread idle, brokers limpos
```

## Prioridade (MoSCoW)

| Requisito | MoSCoW | Justificativa |
|-----------|--------|---------------|
| RF-01…RF-07 | Must | Caminho crítico de conversa |
| — | — | — |

## Rastreabilidade de Código

| Arquivo | Função / Classe | Cobertura |
|---------|-----------------|-----------|
| `packages/server/src/runner/dispatch.ts` | `scheduleDispatch`, `runDispatch` | 🟢 |
| `packages/server/src/runner/turns.ts` | registro/cancel turno | 🟢 |
| `packages/server/src/runner/seq-allocator.ts` | allocate-then-emit | 🟢 |
| `packages/server/src/git/project-execution.ts` | lease | 🟢 |
