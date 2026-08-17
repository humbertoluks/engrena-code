# Bindings — EngrenaCode (Node.js)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte de verdade: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (Stack `Node.js`) + `CLAUDE.md` → "HTTP · Guard".

## Mapa do repo

| Conceito da regra | Neste repo |
|-------------------|------------|
| Transport compartilhado | `packages/http-core` + shim `apps/engrena-code/src/services/http/_transport.ts` |
| Handler padrão (create) | `apps/engrena-code/src/services/http/rules-handler.ts` |
| Unlock / CORS | `apps/engrena-code/src/services/http/unlock-handler.ts` |
| Guard order | 423 `vault_locked` → 401 `unauthorized`; header `x-engrenacode-session` |
| Loopback | Code `127.0.0.1:5174`; Plan `5184` (`createUnlockServer`) |
| Sanitizer | `apps/engrena-code/src/services/process-error.ts` (`sanitizeProcessError`) |
| Vault | `packages/vault` + shim `apps/engrena-code/src/services/vault/vault-service.ts` → `userData/vault.enc` |
| Validadores puros | `apps/engrena-code/src/services/vault/provider-keys.ts`, `.../http/github-token.ts` |
| WS upgrade | `apps/engrena-code/src/services/http/ws-upgrade.ts` (só subprotocol) |
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

Lote F03 Permission Recovery — contagem, data e evidência só em `AUDIT-CODE-REVIEW.md`:

- `R07` — `runtime-metrics.recordTurnProcessCount` sobrescreve em vez de somar e o call site em `providers/cli-driver.ts` passa `pid ? 1 : 0`: o campo `turnProcessCount` é um booleano com nome de contagem. Correção exige call site + setter + teste no mesmo commit
- `A02` — `providers/permission-contract.ts`: `BASH_PERMISSION_MATRIX` / `checkSupervisedPermissionArgs` / `validatePermissionSettingsShape` ainda só-teste. **Deferido de propósito** — ver a nota em "Já corrigidos"

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
- `RC-stream-json-content-narrow` — `providers/stream-json-parse.ts` itera o `content` filtrando por `isRecord`; nunca reintroduza `as ContentBlock[]`. O loop de parse/dispatch em `providers/cli-driver.ts` tem `try/catch` **próprio**, separado do `try` de baixo, e **não loga a linha crua** (pode conter `tool_input` com command/segredo); o erro sai por `sanitizeProcessError` (C58)
- `RC-permission-thread-binding` — `resolvePermissionRequest(threadId, requestId, …)` valida `entry.threadId` **antes** de consumir a entrada; `thread_mismatch` → 409 `permission_thread_mismatch` no `threads-handler`. Não volte a resolver só por `requestId` global (C62)
- `RC-broker-body-unbounded` — `POST /permission` do broker tem teto `PERMISSION_BODY_MAX_BYTES` (`buffer-cap.ts`), 413 + `req.destroy()` e fail-closed: no estouro **nenhum** pending é criado (C63)
- `RC-hook-http-status-check` — o `SCRIPT_SOURCE` do permission-hook checa `res.ok` antes de `res.json()` e nega com o status na mensagem (C64)
- `RC-permission-mode-constant-drift` — `permissionModeFlag` retorna `SUPERVISED_PERMISSION_MODE`, nunca o literal `'auto'` (C67)
- `RC-dead-export` — além de C39/C57: `isRuntimeMetricsEnabled` removido de `runtime-metrics.ts` (era wrapper de uma linha sobre o `enabled()` local); `getRuntimeMetricsSnapshot` / `resetRuntimeMetricsForTesting` permanecem com consumidor no teste irmão (C61)
- `RC-export-should-be-local` — além de C28: `truncateStringWithMarker` é local em `buffer-cap.ts`, exercitada via `truncateToolResultPayload` (C68)

### Deferimentos ativos (não trate como código morto)

Uma varredura de export órfão vai apontar estes dois. Eles têm consumidor de produção **planejado e nomeado**; torná-los locais agora só força reabrir depois.

- `A02` — `BASH_PERMISSION_MATRIX` / `checkSupervisedPermissionArgs` / `validatePermissionSettingsShape` em `providers/permission-contract.ts` passam a rodar antes do spawn do CLI, para que regressão de contrato (grupo `PermissionRequest` faltando, `hookEventName` errado, `--permission-mode` divergente) vire erro visível na UI em vez do sintoma atual, que é o agente pedir aprovação em prosa sobre um botão inexistente.
- `hasInflight` (Stack `React`, `historyMerge.logic.ts`) — ganha consumidor no reconnect de WebSocket com resync serializado. Registrado também em `coding-react/project.md`.
