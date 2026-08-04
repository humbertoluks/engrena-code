# F06 Smoke Results

**Feature:** F06 Rules  
**Data:** 2026-08-04 (~08:20 BRT)  
**Ambiente:** `pnpm dev` com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-f06f07` + Playwright em `http://localhost:5173` + `node scripts/smoke-f06.mjs`  
**Credenciais smoke:** workspace `~/smoke-onda2` · password `smoke-onda2-pass`

## Pré-requisitos

- [x] `pnpm install`
- [x] `pnpm test` verde (139/139, incl. rules)
- [x] App em `pnpm dev`, unlock HTTP + UI login
- [x] Unlock server `127.0.0.1:5174`

## API (`x-engrenacode-session`) — `node scripts/smoke-f06.mjs`

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| A0 | Sem sessão em `GET /api/rules` | 401 (ou 423) | pass (`401`) |
| UNLOCK | `POST /api/vault/unlock` | sessionToken | pass |
| A1 | `POST /api/rules` create | 201 + id | pass |
| A2 | Name com CR/LF | 400 | pass (`invalid_request`) |
| A3 | Content >1 MiB | 400 `too_long` | pass |
| A4 | Name duplicado | 409 `rule_name_conflict` | pass |
| A5 | Content ~9 KB (soft) | 201 | pass |
| A6 | Create global | 201 | pass |
| A7 | Global + `PUT …/projects/:id/rules/:id` `enabled:false` | `suppressedHere=true` | pass |
| A8 | Local link `enabled:true` | `linked` + `activeInProject` | pass |
| A9 | `GET /api/rules/counts` | global + activeByProject | pass |
| A10 | `GET /api/rules` list | array ≥1 | pass |

## UI `#rules` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Mount `#rules` | grid + cards das rules smoke; copy EngrenaCode | pass |
| U2 | `+ Nova rule` | modal Nova rule | pass |
| U3 | Name duplicado submit | alert `Já existe uma rule…` | pass |
| U4 | Soft size | card `smoke-f06-soft` mostra ~9 KB | pass |
| U5 | Light + dark | Tema Claro/Escuro sem crash | pass |
| U6 | Marca | EngrenaCode presente; 0 LionCode/lioncode | pass |
| U7 | Name CR/LF no form | `rulesForm.error.nameInvalid` | pass via unit `ruleForm.logic` + API A2 (input controlado engole `\n` no Playwright fill) |
| U8 | Cap >15 / aggregateHot / harness | overlay projeto | **deferred** até F03 Repo Harness |
| U9 | Bloco no turno | inject F03 | **deferred** até turn-runner F03 |

## Unitário (já no suite)

| Suite | Resultado |
|-------|-----------|
| `rules.test.ts` / `rules-handler.test.ts` / `ruleForm.logic.test.ts` / `rules-block.test.ts` | pass (suite global 139/139) |

## Critérios PRD §9

| Critério | Status |
|----------|--------|
| Rules globais e por projeto resolvem com override de supressão | **pass** (API A7/A8 + unit `resolveForTurn`) |
| Bloco de rules em todo turno (precedência) | **deferred** F03 |
| Name com CR/LF rejeitado | **pass** (API A2 + unit) |

## Notas

- Vault/DB isolados em `%TEMP%\engrena-smoke-f06f07`.
- Script: `scripts/smoke-f06.mjs`.
