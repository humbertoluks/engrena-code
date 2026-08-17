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

## Rodada 2 (2026-08-17) — atividade **durante** o run

A primeira rodada só viu o estado assentado. Esta repetiu o exercício com um filho de vida longa: seis comandos `sleep 10 && ls -a`, um por vez, pedidos ao `explorer` (95 s de run). O turno foi disparado pelo composer da própria UI, com a aba Grafo aberta antes do envio.

O contraste que fecha o caso — **UI e banco discordando de propósito**, porque `action_count` só é gravado no fechamento:

| Momento | Nó do grafo | Bloco na timeline | `subagent_runs.action_count` |
|---|---|---|---|
| durante | `Executando… 1 ação` | — | **0** |
| durante | `Executando… 2 ações` | — | **0** |
| durante | — | `explorer · 3 ações · Executando…` | **0** |
| durante | `Executando… 5 ações` | — | **0** |
| assentado | `concluído · 6 ações · 1m 35s` | — | **6** |

O contador subiu ao vivo com o banco parado em zero, e o rótulo mostrou `Executando…` — derivado de `Bash` por `activityLabelForTool`, nunca o nome cru. Ao fechar, o banco assumiu com 6.

Screenshots: `smoke/f29_graph_child_live.png` (5 ações em execução), `smoke/f29_subagent_block_live.png` (3 ações), `smoke/f29_graph_child_settled.png` (assentado).

**Defeito de copy achado e corrigido aqui:** o nó escrevia `1 tools` / `1 ações` no primeiro evento do turno. `GRAPH_COPY.metaTools/metaActions` e a chave do bloco passaram a ter singular.

**Falso alarme registrado para não se repetir:** depois do turno assentar, o canvas ficou visualmente vazio com os nós presentes no DOM e `visibility: hidden`. Não é defeito do produto — foi o HMR do Vite recarregando `graphCopy.ts`, que eu editei no meio do run: o React Flow remonta os nós e eles ficam ocultos até uma nova medição. Recarga limpa da página devolveu `visibility: visible` com os dois nós corretos. Editar módulo do renderer durante um smoke invalida a própria observação.

## Rodada 3 (2026-08-17) — batch paralelo (F18) ao vivo

Fecha o item que estava como "não exercitado". Mesmo método das rodadas anteriores (turno disparado pelo composer da UI, aba Grafo aberta antes do envio), agora com uma única chamada `call_subagent` carregando `tasks[]` de 2 itens: `explorer` e `implementer`, cada um rodando quatro `sleep 12` no Bash.

Turno `thr_af137907-7037-40d0-bb43-2d05288f95da` → batch `d918933c…`, filhos `8102efb6…` (explorer) e `3add7b7a…` (implementer).

1. **Os dois filhos emitem no mesmo fio, intercalados.** Trecho da captura, com o relógio relativo ao início do socket:

```
  1.5s tool_call.start (PAI)     mcp__engrenacode__call_subagent
  1.8s subagent.start            child=8102efb6 name=explorer     batch=d918933c
  1.8s subagent.start            child=3add7b7a name=implementer  batch=d918933c
 13.3s subagent.tool_call.start  child=3add7b7a id=…VL4Bwh name=Bash
 15.4s subagent.tool_call.start  child=8102efb6 id=…jzEaSb name=Bash
 27.9s subagent.tool_call.result child=3add7b7a id=…VL4Bwh status=completed
 29.9s subagent.tool_call.result child=8102efb6 id=…jzEaSb status=completed
 …
 80.9s subagent.result           child=3add7b7a status=completed  batch=d918933c
 83.4s subagent.result           child=8102efb6 status=completed  batch=d918933c
 84.0s tool_call.result (PAI)    status=completed
```

As janelas se sobrepõem (13.3→27.9 contra 15.4→29.9): paralelismo real, não FIFO. `parallel_batch_id` idêntico nos dois, `childThreadId` e `tool_use_id` distintos — nenhum evento precisou de desempate por nome de tool.

2. **Payload continua magro sob concorrência.** As chaves observadas em todo evento do batch foram exatamente `[type, threadId, childThreadId, id, name]` e `[type, threadId, childThreadId, id, status]`. Nenhum `params`, nenhum `result`.
3. **Grafo ao vivo, um contador por filho** (`smoke/f29_graph_parallel_live.png`), amostrado a cada 8 s:

| Momento | Nó do batch | explorer | implementer |
|---|---|---|---|
| t+8s | `Batch · em execução · 2 filhos` | `Executando… 1 ação` | `Executando… 1 ação` |
| t+16s | idem | `em execução · 1 ação` | `Executando… 2 ações` |
| t+32s | idem | `Executando… 3 ações` | `Executando… 3 ações` |
| t+48s | idem | `Executando… 4 ações` | `Executando… 4 ações` |
| assentado | `Batch · concluído · 2 filhos` | `concluído · 4 ações · 1m 21s` | `concluído · 4 ações · 1m 19s` |

Em t+16s o `explorer` mostra o status (`em execução`) no lugar do rótulo de atividade: é o intervalo entre o `.result` de uma tool e o `.start` da seguinte, quando `activeTool` volta a `null` de propósito. Assentado (`smoke/f29_graph_parallel_settled.png`), as durações de 79 s e 81 s dentro de um turno de 88 s confirmam de novo o paralelismo.

4. **Persistência.** Os dois runs fecharam com `action_count = 4` e o mesmo `parallel_batch_id`.
5. **Faixa agregada do card lateral:** `Paralelo · 2/2 concluídos · 0 rodando · 0 erro`.
6. **Sem poluir o pai.** `log_entries` do turno lista só as tools do pai (`ToolSearch`, `call_subagent`) — nenhum `Bash` de filho vazou para o work log.
7. **Worktrees limpos.** `git worktree list` no projeto voltou a ter só `main`, e a árvore ficou sem alteração pendente (os filhos só leram).

### Bug real achado e corrigido por esta rodada

**A timeline do pai mostrava só um dos dois filhos** — o bloco do `implementer` aparecia, o do `explorer` sumia sem aviso. Grafo e card lateral mostravam os dois, porque leem `subagentRuns` direto; a timeline era a única superfície a perder um filho.

Causa: `correlateSubagentRuns` devolvia `Map<string, SubagentRun>`, um run por tool call. A relação é 1:N — os N filhos de um `tasks[]` gravam **o mesmo** `parentToolCallId` (aqui, `cfeef238…` nos dois runs), então cada `set` sobrescrevia o anterior em silêncio. O mapa passou a ser `Map<string, SubagentRun[]>`; `groupTimelineItems` carrega `runs[]` no grupo e `ChatHistory.tsx` renderiza um `SubagentTimelineBlock` por filho. O grafo consumia o mesmo mapa e ganhou o laço interno correspondente (o caminho de batch dele já era separado, por isso não exibia o defeito).

Confirmado ao vivo depois do fix, na mesma thread: `explorer · inherit · 4 ações · concluído` **e** `implementer · inherit · 4 ações · concluído` (`smoke/f18_timeline_batch_fixed.png`). Regressão travada em `chatHistory.logic.test.ts` (correlação com três filhos no mesmo tool call; grupo de timeline carregando os dois runs).

Vale o registro de método: só um turno pago real com `tasks[]` expõe isto. O unitário do `delegate.ts` cobre o runner, que estava certo o tempo todo — o defeito morava na correlação do renderer, três camadas adiante.

## Turno que morria sem registro — investigado e fechado

Dois turnos de delegação desta primeira rodada terminaram em `state = error` após ~206 s **sem registro nenhum do motivo**: nada em `log_entries`, nenhuma mensagem de assistente. A investigação achou duas causas independentes.

**1. O motivo nunca era persistido.** O `catch` do `dispatch.ts` só fazia `emit({type:'error'})`. O hub não bufferiza: quem não estava com a thread aberta, ou reconectou depois, ficava com uma thread em `error` sem uma linha dizendo por quê. Agora o `catch` grava um `log_entry` `kind='task'` com código e mensagem (`turno falhou (<code>): <mensagem>`), sanitizada — a mensagem do `result` do CLI é a única que chegava ali sem passar por `sanitizeProcessError`, e vai para o disco. A gravação é best-effort: se a thread sumiu no meio do turno, a FK falha e o erro é engolido, porque trocar a falha do turno por uma rejeição não tratada é pior que o problema original.

**2. A ordem escondia o erro de quem escutava.** `applyTransition` (que emite `state.change`) rodava **antes** do `emit({type:'error'})`. Consumidor que encerra no estado terminal — o meu monitor, e qualquer cliente com o mesmo desenho — nunca via a mensagem. Invertida.

**Causa provável dos dois turnos originais**, pelo que sobrou de rastro: ambos gravaram `usage_event` com **tudo zero** (`input_tokens=0`, `output_tokens=0`, `cost_usd=0`), assinatura de `is_error` no `result` do CLI com usage vazio — o mesmo shape de um erro de API (`provider_turn_error`). Qual erro exatamente, não dá para afirmar: a mensagem se perdeu, que é justamente o que a correção resolve.

**Verificação ao vivo** (2026-08-17), turno com provider não instalado:

```
log_entries:  task | turno falhou (provider_spawn_failed): Não foi possível iniciar o provider "codex": spawn codex ENOENT

WS, na ordem:  state.change running
               error  provider_spawn_failed  ← antes
               state.change error
```
