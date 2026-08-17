# Smoke: F29 §7 — atividade de tool do filho no fio do pai

**Data:** 2026-08-17
**Método:** `pnpm dev` real (Electron + Vite, sandbox desabilitado), **vault e projeto reais do usuário** — não fixture. Turno de delegação disparado pela API loopback (`127.0.0.1:5174`), eventos lidos por um WebSocket assinando `?threadId=<pai>`, persistência conferida no `%APPDATA%/engrena-code/engrenacode.db` via `node:sqlite`. UI verificada depois pelo renderer em `localhost:5173`.

**Ambiente:** `claude` 2.1.233 (acima da faixa validada 2.1.226–2.1.231 — o aviso do D3 apareceu ao vivo no log do turno, sem bloquear), modo `subscription`, projeto `TodoV1`, thread `full-access`, subagent `explorer` vinculado ao projeto para o teste e **desvinculado ao final** (o projeto voltou a não ter nenhum subagent vinculado, como estava antes).

## Confirmado ao vivo

Turno `thr_ca9a1032-fee9-410b-b26f-f8595d0efb0b` → filho `cccb2409-ee75-4777-a042-b43c5bd08676`.

1. **Os eventos existem e chegam no fio do pai.** Sequência capturada, na ordem:

```
tool_call.start            mcp__engrenacode__call_subagent
subagent.start             childThreadId=cccb2409…  name=explorer
subagent.tool_call.start   childThreadId=cccb2409…  id=toolu_01UiCZ…  name=Bash
subagent.tool_call.result  childThreadId=cccb2409…  id=toolu_01UiCZ…  status=error
subagent.tool_call.start   childThreadId=cccb2409…  id=toolu_01VQNe…  name=Bash
subagent.tool_call.result  childThreadId=cccb2409…  id=toolu_01VQNe…  status=completed
subagent.result            childThreadId=cccb2409…  status=completed
```

2. **Agregado, como especificado.** Nenhum evento carregou `params` ou `result` — o `command` do Bash do filho não apareceu no fio em momento algum.
3. **Correlação por chamada.** Duas chamadas da mesma tool (`Bash`) no mesmo filho, com `tool_use_id` distintos, cada uma com o seu `.result` — inclusive uma que falhou (`status=error`) e outra que passou. É o caso que a granularidade por nome não distinguiria.
4. **Sem poluir o pai.** Nenhum `tool_call.start` extra foi emitido por conta do filho; as tools do pai no turno foram só as dele (`ToolSearch`, `call_subagent`, `Bash`).
5. **Persistência.** `subagent_runs` fechou com `action_count = 2`, `status = completed`, `duration_ms = 19958` — antes desta fatia o campo fechava sempre em zero. `usage_events` com `source='subagent'` gravado como antes.
6. **UI — bloco de subagente na timeline:** `explorer · inherit · 2 ações · concluído` (`smoke/f29_subagent_block_actions.png`).
7. **UI — grafo:** `claude / ocioso / 2 tools` → aresta `arquivo packag…` → `explorer / concluído / 2 ações / 19s` (`smoke/f29_graph_child_actions.png`).

## Não exercitado

- **Atividade durante o run.** O filho durou 19 s e a verificação da UI foi feita depois do fim; o que se vê nos screenshots é o estado assentado (contagem vinda do banco). O rótulo da ferramenta corrente e a contagem ao vivo — o caminho `childTools` do overlay — estão cobertos por unitário em `executionGraph.logic.test.ts`, não por captura ao vivo. Precisaria de um filho longo e de captura sincronizada no meio do run.
- **Batch paralelo (F18) ao vivo.** Coberto por unitário (`delegate.test.ts`: dois filhos, mesmo `id` de tool, `childThreadId` distintos).

## Observação fora do escopo desta fatia

Dois turnos de delegação anteriores a este terminaram em `state = error` após ~206 s **sem registro nenhum do motivo**: nada em `log_entries`, nenhuma mensagem de assistente, e o `emit({type:'error'})` do `dispatch.ts` chega **depois** do `state.change`. Quem assina o socket e encerra ao ver o estado terminal nunca vê a mensagem de erro. O terceiro turno, com o mesmo ambiente e um prompt quase igual, funcionou — então não é falha determinística de configuração. Vale investigar em separado: hoje um turno que morre assim não deixa rastro para o usuário nem para auditoria.
