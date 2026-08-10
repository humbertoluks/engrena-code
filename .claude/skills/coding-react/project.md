# Bindings — EngrenaCode (React)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte de verdade de achados: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (Stack `React`). A lista de abertos abaixo é **espelho** da última passagem — releia o código antes de agir.

## Mapa do repo

| Conceito da regra | Neste repo |
|-------------------|------------|
| Cliente HTTP único | `src/renderer/services/api-client.ts` (`apiRequest`) |
| Base URL loopback | `http://127.0.0.1:5174` |
| Header de sessão | `x-engrenacode-session` |
| Token em storage | `localStorage` chave `sessionToken` |
| Tema | `localStorage` chave `engrenacode:theme` (`light` \| `dark` \| `system`) |
| Unlock público (exceção de fetch) | `LoginScreen.tsx` → `POST /vault/unlock` |
| Validadores puros compartilhados | `src/services/vault/provider-keys.ts`, `src/services/http/github-token.ts` |
| Regra extraída | `src/renderer/**/*.logic.ts` + `*.logic.test.ts` |
| Spec de tela | `docs/F<ID>-*/ui.md` + `copy.md` |
| Design tokens | Tailwind 4 `@theme inline`; hexes em `:root` / `.dark` |
| Marca atual | `EngrenaCode` / `engrenacode` |
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

Nenhum (passagem 2026-08-10 remediada — C48/C49).

## Já corrigidos — não regrida

- `RC-shared-validation` — `configuracaoScreen.logic.ts` importa `validate*Key` / `validateGithubToken`; não re-declare prefixo/comprimento no renderer.
- `RC-business-rule-in-tsx` — regras em `*.logic.ts` com teste irmão (inclui Codegraph/Login — C49).
- `RC-no-silent-catch` / `RC-silent-catch-regression` — não reintroduza `.catch(() => {})` mudo (harness/catálogo/OAuth poll — C48).
- `RC-shared-api-request` — services usam `api-client.ts`; não duplique `fetch` com headers próprios.
- `RC-harness-count-stale-after-modal-close` — `refreshHarnessCounts` no `onClose` dos modais de vínculo do Repo Harness.
