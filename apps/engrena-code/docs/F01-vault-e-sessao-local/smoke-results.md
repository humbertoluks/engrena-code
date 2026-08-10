# F01 Smoke Results — vault_corrupted

**Feature:** F01 Vault e Sessão Local  
**Data:** 2026-08-07  
**Ambiente:** `pnpm dev` (Electron + Vite) com `ENGRENACODE_USER_DATA=%TEMP%\engrenacode_claude_f01_corrupted_smoke` + `playwright-cli` em `http://localhost:5173/#login`  
**Dados:** `vault.enc` pré-escrito com envelope truncado (`01 00 10 01 02 03`); vault/userData reais do usuário **não** foram tocados

## Pré-requisitos

- [x] Lote 1 commit `fix(vault): surface vault_corrupted as 422 on unlock`
- [x] Unitário `test_corrupted_vault_message` + `crypto.test.ts` verdes
- [x] Unlock server em `127.0.0.1:5174`

## API

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| A1 | `POST /api/vault/unlock` com vault.enc adulterado | 422 `{ error: { code: "vault_corrupted", message: "…danificado ou ilegível…" } }` | pass |
| A2 | Segunda tentativa imediata | 422 de novo; sem `retryAfterMs` (não consome backoff) | pass (unitário) |

## UI `#login` — Playwright

| # | Passo | Esperado | Resultado |
|---|-------|----------|-----------|
| U1 | Abrir `#login` | EngrenaCode + formulário de unlock | pass |
| U2 | Preencher workspace/senha e Desbloquear | `role="alert"` com “O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.” | pass |

## Cleanup

- [x] Processo `pnpm dev` / Electron encerrado
- [x] `%TEMP%\engrenacode_claude_f01_corrupted_smoke` removido
- [x] `.playwright-cli/` removido
