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

## Não exercitado

- **Batch paralelo (F18) ao vivo.** Coberto por unitário (`delegate.test.ts`: dois filhos, mesmo `id` de tool, `childThreadId` distintos).

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
