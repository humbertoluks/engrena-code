# Bindings — EngrenaCode (Vitest)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (Stack `Vitest`) + `CLAUDE.md` → "TESTE".

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Runner | Vitest; `apps/engrena-code/vitest.config.ts` inclui só `src/**/*.test.ts`, `environment: node` |
| Env de isolamento | `ENGRENACODE_USER_DATA` = `mkdtempSync(join(tmpdir(), 'engrenacode_claude_<slug>_'))` (Plan: `ENGRENAPLAN_USER_DATA`) |
| Precedente HTTP fake | `apps/engrena-code/src/services/http/rules-handler.test.ts` |
| Sanitizer tests | `apps/engrena-code/src/services/process-error.test.ts` (um caso por scheme F24) |
| Smoke evidence | `apps/engrena-code/docs/F<ID>-*/smoke-results.md` |
| Artefatos smoke | `.playwright-cli/` (gitignored) |
| Comando unit | `pnpm --filter engrena-code test` (raiz: `pnpm test`) |

## Pré-condições de smoke real (este repo)

- `.env.local` com `VITE_DEV_SERVER_URL` (porta livre ≥5173 **exceto** 5174)
- Unlock loopback `127.0.0.1:5174`
- Electron real com `dangerouslyDisableSandbox: true`
- `ANTHROPIC_API_KEY` unset para turno real de assinatura
- Access level "Auto-accept edits" quando o turno usa Edit

## Camadas que exigem irmão no mesmo diff

`src/services/db/repositories/*`, `http/*-handler.ts`, `runner/*`, `git/*`, `vcs/*`, `vault/*`, `seeds/*`, `codegraph/*`, `src/renderer/**/*.logic.ts`

## Achados abertos

Nenhum (passagem 2026-08-10 remediada — C51/C52).

## Já corrigidos — não regrida

- `RC-missing-sibling-coverage` — D02 fechado; módulo novo nasce com irmão
- `RC-missing-smoke-evidence` — D07 fechado; feature UI nova escreve smoke antes de marcar Feito (F19 smoke live segue opcional no PROGRESS)
- `process-error.test.ts` — um caso por scheme (`oauth2:`, `x-token-auth:`, azure `https://:<token>@`) e prefixo (`xai-`, `gsk_`)
- `RC-missing-link-body-regression` — PUT 400 skills/rules (C51); R01/R02/R03 também com teste no mesmo diff do fix
- `RC-flaky-process-timeout` — `testTimeout` explícito em casos git/spawn reais (C52)
