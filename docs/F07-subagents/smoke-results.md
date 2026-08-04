# F07 Smoke Results

**Feature:** F07 SubAgents  
**Data:** 2026-08-04 (~08:20 BRT)  
**Ambiente:** `pnpm dev` com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-f06f07` + Playwright em `http://localhost:5173` + `node scripts/smoke-f07.mjs`  
**Credenciais smoke:** workspace `~/smoke-onda2` · password `smoke-onda2-pass`

## Pré-requisitos

- [x] `pnpm install`
- [x] `pnpm test` verde (139/139, incl. subagents / gate / idle)
- [x] App em `pnpm dev`, unlock HTTP + UI login
- [x] Unlock server `127.0.0.1:5174`

## API (`x-engrenacode-session`) — `node scripts/smoke-f07.mjs`

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| A0 | Sem sessão | 401/423 | pass (`401`) |
| UNLOCK | unlock | sessionToken | pass |
| A1 | Create Claude | 201 | pass |
| A2 | Providers `codex` / `kimi` / `inherit` | 201 cada | pass |
| A3 | Provider `grok` | 400 `validation_error` | pass |
| A4 | Name duplicado | 409 `subagent_name_conflict` | pass |
| A5 | Prompt >1 MiB | 400 `too_long` | pass |
| A6 | Link + catalog-order | 200; sortOrder aplicado | pass |
| A7 | Counts | global ≥1; linkedByProject | pass |
| A8 | Set de providers na listagem | sem glm/minimax/grok | pass |

## UI `#subagents` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Mount `#subagents` | cards smoke; copy EngrenaCode; sem Pipeline/MCPs/Skills no form | pass |
| U2 | `+ Novo Agente` | modal; Provider só Herda/Claude/Codex/Kimi | pass |
| U3 | Name duplicado | alert `Já existe um subagent…` | pass |
| U4 | Light + dark | Tema Claro/Escuro | pass |
| U5 | Marca | EngrenaCode; 0 LionCode/lioncode | pass |
| U6 | Cap >10 / reorder UI harness | overlay projeto | **deferred** até F03 |
| U7 | call_subagent + timeline + diffs | runner + Workspace | **deferred** até F03 |
| U8 | Idle timeout visível na activity | run real | **deferred** UI; **pass** unit `delegate.idle.test.ts` |
| U9 | Codex pai sem full-access | delegação bloqueada | **pass** unit `subagent-caller-gate.test.ts` (sem turno vivo F03) |

## Unitário (já no suite)

| Suite | Resultado |
|-------|-----------|
| `subagents.test.ts` / `subagents-handler.test.ts` / `subagentForm.logic.test.ts` / `subagent-registry` / `subagent-caller-gate` / `delegate.idle` | pass |

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| CRUD e vínculo `kind=dev` com providers Claude\|Codex\|Kimi\|inherit | **pass** (API A1–A2/A6 + UI) |
| call_subagent + diffs do filho na revisão do pai | **deferred** F03 |
| Codex pai sem full-access não delega | **pass** (unit gate; smoke API/UI sem turno) |
| Idle timeout default 20 min encerra run visível na UI | **parcial** — lógica unit pass; UI de activity **deferred** F03 |

## Notas

- Mesmo userData do smoke F06 (`engrena-smoke-f06f07`).
- Script: `scripts/smoke-f07.mjs`.
- Idle default 20 min aparece no form (spinbutton + hint); encerramento de run exige turn-runner.
