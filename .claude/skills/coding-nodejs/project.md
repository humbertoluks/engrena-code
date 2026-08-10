# Bindings — EngrenaCode (Node.js)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte de verdade: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `Node.js`) + `CLAUDE.md` → "HTTP · Guard".

## Mapa do repo

| Conceito da regra | Neste repo |
|-------------------|------------|
| Transport compartilhado | `src/services/http/_transport.ts` |
| Handler padrão (create) | `src/services/http/rules-handler.ts` |
| Unlock / CORS | `src/services/http/unlock-handler.ts` |
| Guard order | 423 `vault_locked` → 401 `unauthorized`; header `x-engrenacode-session` |
| Loopback | `127.0.0.1:5174` via `createUnlockServer` |
| Sanitizer | `src/services/process-error.ts` (`sanitizeProcessError`) |
| Vault store | `src/services/vault/store.ts` → `userData/vault.enc` |
| Validadores puros | `src/services/vault/provider-keys.ts`, `src/services/http/github-token.ts` |
| WS upgrade | `src/services/http/ws-upgrade.ts` (só subprotocol) |
| Locale de erro ao usuário | PT-BR |

## Precedentes vivos

| Slug | Referência |
|------|------------|
| `http-guard-order` / `http-shared-transport` | `_transport.ts` |
| `http-body-narrowing` | `rules-handler.ts`, `skills-handler.ts` |
| `secret-sanitize-stderr` | `process-error.ts` + `process-error.test.ts` |
| `http-cors-methods-allowlist` | `unlock-handler.ts` (`PATCH` incluso) |
| `http-reserved-session-status` | `voice-handler.ts` usa `422` para auth de provider |

## Invariantes de contrato deste repo

- Domínio (`runner/`, `db/`, `git/`, `vcs/`) nunca importa `*-handler.ts`.
- Segredo nunca em coluna SQLite nem resposta de config (só boolean "configurada").
- Ordem das regex em `sanitizeProcessError`: encurtamento de path **antes** da redação; senha de userinfo exclui `*` inicial.

## Achados abertos

Nenhum (passagem 2026-08-10 remediada — C46–C57).

## Já corrigidos — não regrida

- `RC-guard-423`, `RC-route-claim`, `RC-unlock-validate`, `RC-oauth-https`, `RC-vault-corrupted`, `RC-cors-local`, `RC-shared-transport`, `RC-sanitize-stderr`, `RC-artifacts-userdata`, `RC-atomic-vault`, `RC-http-body-type-trust`, `RC-error-message-path-leak`, `RC-http-unhandled-hang`, `RC-ws-auth-status-collapse`, `RC-error-code-vocabulary-drift`, `RC-http-body-size-unbounded`, `RC-partial-destructive-effect`, `RC-error-message-locale`, `RC-layer-inversion`, `RC-export-should-be-local`
- `RC-error-message-locale-residual` — `cors_denied` + messages `Subagente` em `repositories/subagents.ts` (C40/C56)
- `RC-ws-query-token-legacy` — sem fallback `?token=`
- `RC-http-body-narrowing-gap` — create/link skills/rules/subagents/mcps; git `body` string; consumo `approximate` boolean (C42/C46)
- `RC-dead-export` — `injectTokenIntoHttpsUrl` / `vcs/oauth.getTokens` / `mcps/oauth.getTokens` locais; `parseOauthMetadata` em `oauth-metadata.ts` (C39/C57)
- `RC-vcs-url-redaction` — userinfo HTTPS genérico + `xai-`/`gsk_`
- `RC-cors-methods-allowlist-gap` — `PATCH` no allowlist
- `RC-http-status-code-collision` — voice auth → `422` (não `401`)
- `RC-spawn-failed-unsanitized` — `provider_spawn_failed` sanitizado (C47)
- `RC-unlock-body-unbounded` — unlock via `readBody` (C53)
- `RC-cli-env-inheritance` — CLI spawn `buildPtyEnv` (C54)
- `RC-spawn-cleanup-gap` — `cleanupPermissionSettings` no catch síncrono (C55)
