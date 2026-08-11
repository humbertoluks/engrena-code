# Bindings — EngrenaCode (React)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte de verdade de achados: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (Stack `React`). A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir.

## Mapa do repo

| Conceito da regra | Neste repo |
|-------------------|------------|
| Cliente HTTP único | `apps/engrena-code/src/renderer/services/api-client.ts` (`apiRequest`) |
| Base URL loopback | Code `http://127.0.0.1:5174` (Plan: `5184`) |
| Header de sessão | `x-engrenacode-session` (Plan: `x-engrenaplan-session`) |
| Token em storage | `localStorage` chave `sessionToken` |
| Tema | `configureThemeStorageKey` + `engrenacode:theme` (`light` \| `dark` \| `system`) |
| Unlock público (exceção de fetch) | `LoginScreen.tsx` → `POST /vault/unlock` |
| Validadores puros compartilhados | `apps/engrena-code/src/services/vault/provider-keys.ts`, `.../http/github-token.ts` |
| Regra extraída | `apps/engrena-code/src/renderer/**/*.logic.ts` + `*.logic.test.ts` |
| Spec de tela | `apps/engrena-code/docs/F<ID>-*/ui.md` + `copy.md` |
| Design tokens | `@engrena/ui` (`:root` / `.dark` / `@theme inline`) |
| Marca atual | `EngrenaCode` / `engrenacode` (+ `EngrenaPlan` no app Plan) |
| Marca legada (ban) | `LionCode`, `lioncode`, `LionClaw`, `LionLabs`, `LionSprite` |

## Precedentes vivos

| Slug da regra | Arquivo de referência |
|---------------|----------------------|
| `boundary-single-api-client` | `src/renderer/services/api-client.ts` |
| `logic-shared-server-validation` | `src/renderer/screens/configuracaoScreen.logic.ts` |
| `logic-extract-from-tsx` | vários `*.logic.ts` sob `src/renderer/` |
| `state-refetch-on-modal-close` | `src/renderer/components/workspace/WorkspaceSidebar.tsx` (`refreshHarnessCounts`) |
| `style-theme-persistence` | `src/renderer/hooks/useTheme.ts` |

## Invariantes de contrato deste repo

- Não existe `fetch` de domínio em tela/componente além do unlock em `LoginScreen`.
- `vitest.config.ts` só cobre `src/**/*.test.ts` — por isso regra de UI sai do `.tsx` para `*.logic.ts`.
- Nunca `max-w-`/`w-`/`h-` com sufixo `xs|sm|md|lg|xl` neste Design Lock (spacing vence container).

## Achados abertos

Passagem 2026-08-11 — Workspace CHAT:

- `R01` — `usePrincipalWorkspace.ts` `resolvePermission`: só dropar da fila se API `resolved`; senão `setSendError` e manter prompt
- `D01`/`D02` — `ChatHistory.tsx`: extrair `shouldShowActivity` + `partitionPendingMessages` para `*.logic.ts` + teste
- `A01` — `chatHistory.logic.ts`: remover ou ligar `isToolRunning` (export órfão)
- `R04` — `ws-client.ts`: narrowing de frame WS antes de `onEvent`
- `R05` — `usePrincipalWorkspace.ts`: allowlist de `event.state` (sem cast cego)
- `R07` — `cancel`: checar `res.error` e exibir
- `R09` — tool name literals: módulo puro compartilhado com runner
- `R10` — `ACCESS_LEVELS`: allowlist canônica compartilhada com `threads-handler`
- `A02` — `clampCatalog*`: ligar na UI ou deixar de exportar
- `D03` — fila de follow-up: regras puras fora do hook (`localStorage` fica no wiring)

## Já corrigidos — não regrida

- `RC-shared-validation` — `configuracaoScreen.logic.ts` importa `validate*Key` / `validateGithubToken`; não re-declare prefixo/comprimento no renderer.
- `RC-business-rule-in-tsx` — regras em `*.logic.ts` com teste irmão (inclui Codegraph/Login — C49). Não regrida ActivityIndicator/pending no TSX (D01/D02 abertos).
- `RC-no-silent-catch` / `RC-silent-catch-regression` — não reintroduza `.catch(() => {})` mudo (harness/catálogo/OAuth poll — C48). Mesmo padrão para permission/cancel (R01/R07).
- `RC-shared-api-request` — services usam `api-client.ts`; não duplique `fetch` com headers próprios.
- `RC-harness-count-stale-after-modal-close` — `refreshHarnessCounts` no `onClose` dos modais de vínculo do Repo Harness.
