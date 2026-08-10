# F15 Smoke Results — Idle Timeout ao vivo

**Feature:** F15 Runtime de SubAgents — residual de idle timeout (PRD §9, item 4/4)
**Data:** 2026-08-07
**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) com `ENGRENACODE_USER_DATA` isolado (tmp) + Playwright em `http://localhost:5173` (mesmo bundle do renderer servido pelo Electron); provider real `claude` (sessão de assinatura já logada no binário — `ANTHROPIC_API_KEY` unset); access level `full-access` (necessário — `auto-accept-edits` não libera tool MCP/Bash sem autorização interativa, que não existe em spawn headless)

## Objetivo

Fechar o único residual aberto de F15/F07 §9: provar ao vivo, contra o binário `claude` real, que o idle timeout (`checkIdleTimeout`/watchdog em `delegate.ts`) interrompe um run de subagent por silêncio real de stream e que a UI reflete `status=timeout` com tom âmbar em todas as superfícies, sem refresh manual.

## Setup

- Subagent fixture `idle-smoke-f15` (`idleTimeoutMinutes=1`, bem abaixo do default de produto 20 — só no fixture de teste, default de 20 min não foi alterado em nenhum lugar do código) vinculado a um projeto fixture git isolado.
- System prompt do fixture instrui o filho a rodar `sleep 90` via Bash de forma síncrona/bloqueante.

## Tentativas e ajustes (documentado porque revela comportamento real do runtime, não só o resultado final)

| # | Abordagem | Resultado | Ajuste |
|---|-----------|-----------|--------|
| 1 | Thread `auto-accept-edits`, prompt do filho pedindo silêncio total ("não escreva nada, só rode a tool") | `call_subagent` **negado** — CLI real recusa MCP/Bash em `acceptEdits` (esse modo só auto-aprova Edit/Write); a framing "fique em silêncio" também foi lida pelo modelo como padrão de injeção e ele se recusou a obedecer, pedindo confirmação | Trocado para access level `full-access` (`bypassPermissions`) — access level é imutável após o primeiro envio da thread, então cada tentativa exigiu thread nova |
| 2 | `full-access` + prompt "rode sleep 90 e não diga nada antes/depois" | Run **completou** rápido (00:25) sem timeout — o modelo respondeu com texto pedindo confirmação em vez de rodar a tool, tratando a instrução "sem texto" como suspeita | Prompt reescrito para framing transparente (explica que é um smoke test técnico do próprio EngrenaCode, sem pedir silêncio) |
| 3 | `full-access` + prompt transparente, sem proibir background | Run **completou** rápido — o Bash tool do CLI real auto-detecta comando longo e roda `sleep 90` em **background** (`run_in_background`), retornando o tool-result quase imediatamente; sem gap real no stream, não há silêncio pra estourar idle | Prompt reescrito exigindo explicitamente execução **síncrona/bloqueante**, proibindo background |
| 4 | `full-access` + prompt síncrono/bloqueante explícito | **Timeout real confirmado** (ver Resultado) | — |

## Resultado (tentativa 4 — PASS)

| Passo | Esperado | Resultado |
|-------|----------|-----------|
| Envio do turno pai (`call_subagent name="idle-smoke-f15"`) | Tool real invocada, run `running` no card Subagents | pass — card mostrou "idle-smoke-f15 · claude · trabalhando…" com duração ao vivo |
| Filho roda `sleep 90` síncrono via Bash | Gap real ≥ 60s sem nenhum evento de stream (idle threshold do fixture) | pass — watchdog (`WATCHDOG_INTERVAL_MS=30s`) detectou o silêncio e abortou via `AbortController` |
| UI reflete o timeout | Card sidebar + bloco na timeline mudam para `status=timeout`, tom âmbar, **sem refresh manual** | pass — ambos mudaram para "timeout" via WS (`subagent.result`) sem reload da página; texto do agente pai: *"Subagent interrompido: timeout... Idle timeout smoke confirmado: silêncio do filho triggou timeout, sync call abortou como esperado."* |
| Estilo visual | Badge usa classe `text-amber` do Design Lock nas duas superfícies | pass — `getComputedStyle` confirmou `color: rgb(176, 125, 31)` (`text-amber`) no bloco da timeline e no card da sidebar |
| Duração persistida | `durationMs` gravado no run terminal | pass — card mostrou `01:30` (90s, coerente com o `sleep 90` real que estava em andamento no momento do abort) |

## Notas

- O access level `auto-accept-edits` **não** libera chamadas de tool MCP (`call_subagent`) nem Bash sem aprovação interativa — só auto-aprova Edit/Write. Para automação headless de qualquer turno que dependa dessas tools, é preciso `full-access` (`bypassPermissions`). Isso não é specific de F15; vale para qualquer smoke que dispare `call_subagent` ou Bash via automação sem stdin.
- O Bash tool do CLI real auto-backgrounda comandos que ele julga longos, a menos que a instrução seja explicitamente síncrona. Isso é comportamento do binário `claude`, não do EngrenaCode — relevante só para reproduzir o cenário de smoke, não é um bug do app.
- `idleTimeoutMinutes=1` foi usado **só no subagent fixture deste smoke**; nenhuma alteração foi feita ao default de produto (`DEFAULT_IDLE_TIMEOUT_MINUTES = 20` em `delegate.ts`).
- Fixture (`ENGRENACODE_USER_DATA` isolado, projeto git temporário, subagent `idle-smoke-f15`) removido ao final; vault/userData reais do usuário não foram tocados.

## Critério PRD §9 (F15 / F07)

| Critério | Status |
|----------|--------|
| Idle timeout (default 20 min, configurável) encerra run com status `timeout` visível na UI sem refresh manual | **pass** (confirmado ao vivo nesta rodada) |
