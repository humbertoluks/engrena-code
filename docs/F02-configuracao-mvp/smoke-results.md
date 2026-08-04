# F02 Smoke Results

**Feature:** F02 Configuração MVP  
**Data:** 2026-08-03 (re-run 15:14 BRT)  
**Ambiente:** `pnpm dev` com `ENGRENACODE_USER_DATA=%TEMP%\engrena-smoke-f02` + Playwright em `http://localhost:5173` + `node scripts/smoke-f02.mjs`

## Pré-requisitos

- [x] `pnpm install` (inclui `vitest`)
- [x] `pnpm test` verde (10/10)
- [x] `pnpm exec tsc -b` verde
- [x] App em `pnpm dev`, vault smoke desbloqueado (`sessionToken` via unlock HTTP)

## API (`x-engrenacode-session`) — `node scripts/smoke-f02.mjs`

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| A1 | `GET /api/config/status` | 200 com `claude`, `clis`, `prompt`, `github` | pass |
| A2 | Sem header de sessão em qualquer `/api/config/*` | 401 | pass |
| A3 | `POST /api/config/claude/mode` subscription/api-key | 200 + modo | pass |
| A4 | `POST /api/config/claude/test` | 200 success/fail detail (ou 429) | pass (`success=true`) |
| A5 | `POST /api/config/clis/test` | 200 `results` + `summary` X/3 | pass (`1/3 CLIs logados`) |
| A6 | `POST /api/config/prompt/save` / `restore` | 200 + flags isDefault/isEmpty | pass |
| A7 | GitHub: espaços / curto / prefixo inválido | 400 `validation_error` | pass |
| A8 | GitHub: `ghp_` ≥8 | 200 saved | pass |
| A9 | GitHub: `token:""` | 200 removido | pass |

## UI `#configuracao` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Mount hidrata status | 4 cards sem crash | pass |
| U2 | Segmented Claude Assinatura/API key | API key disabled; Assinatura checked | pass |
| U3 | Testar conexão / Testar conexões | InlineFeedback | pass (`Teste concluído: 1/3 CLIs logados.`) |
| U4 | Prompt dirty → salvar / restaurar | badges Padrão/Customizado | pass (Customizado + salvo; restaurado ao padrão) |
| U5 | Token reveal + validação inline | erros locais antes do POST | pass (`A chave não pode conter espaços.`) |
| U6 | Light + dark | legível; tokens F01.1 | pass (Tema Escuro/Claro) |
| U7 | Copy EngrenaCode (não marca do sistema legado) | vs `ui.md` | pass (0 matches marca legado) |

## Unitário

| Suite | Comando | Resultado |
|-------|---------|-----------|
| `github-token.test.ts` | `pnpm test` | pass (10/10) |

## Notas

- Unlock HTTP devolve `sessionToken`.
- Vault de smoke isolado via `ENGRENACODE_USER_DATA`.
- Cross-feature F03/F04: **deferred** (spec §6.3).
- Re-run 15:14 fechou U3/U4 que tinham falhado por server down na sessão anterior.
