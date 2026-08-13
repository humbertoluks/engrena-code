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
| Telas lazy | `apps/engrena-code/src/renderer/App.tsx` (`SCREEN_BY_HASH` + `HashScreen`) |
| Highlighter | `src/renderer/components/workspace/chatHighlight.ts` + `chatMarkdown.logic.ts` |
| CSS de feature lazy | xyflow em `ExecutionGraphPanel.tsx`; xterm em `TerminalPane.tsx` |
| Marca atual | `EngrenaCode` / `engrenacode` (+ `EngrenaPlan` no app Plan) |
| Marca legada (ban) | `LionCode`, `lioncode`, `LionClaw`, `LionLabs`, `LionSprite` |

## Precedentes vivos

| Slug da regra | Arquivo de referência |
|---------------|----------------------|
| `boundary-single-api-client` | `src/renderer/services/api-client.ts` |
| `logic-shared-server-validation` | `src/renderer/screens/configuracaoScreen.logic.ts` |
| `logic-extract-from-tsx` | vários `*.logic.ts` sob `src/renderer/` (inclui `chatMarkdown.logic.ts`) |
| `state-refetch-on-modal-close` | `src/renderer/components/workspace/WorkspaceSidebar.tsx` (`refreshHarnessCounts`) |
| `style-theme-persistence` | `src/renderer/hooks/useTheme.ts` |
| `bundle-lazy-route-screens` | `src/renderer/App.tsx` (`SCREEN_BY_HASH`, `HashScreen`) |
| `bundle-shiki-fine-grained` | `src/renderer/components/workspace/chatHighlight.ts` |
| `bundle-colocate-lazy-css` | `ExecutionGraphPanel.tsx` (`@xyflow/react/dist/style.css`) |

## Invariantes de contrato deste repo

- Não existe `fetch` de domínio em tela/componente além do unlock em `LoginScreen`.
- `vitest.config.ts` só cobre `src/**/*.test.ts` — por isso regra de UI sai do `.tsx` para `*.logic.ts`.
- Nunca `max-w-`/`w-`/`h-` com sufixo `xs|sm|md|lg|xl` neste Design Lock (spacing vence container).
- Telas autenticadas nascem `React.lazy`; `LoginScreen` permanece eager no chunk inicial.
- Highlighter do chat: `createHighlighterCore` + `@shikijs/langs|themes` + engine JS. Nunca `import { codeToHtml } from 'shiki'`.
- CSS de xyflow não volta para `src/renderer/index.css`.

## Achados abertos

Lote F03 Permission Recovery — contagem, data e evidência só em `AUDIT-CODE-REVIEW.md`:

- `A05` (parcial) — `historyMerge.logic.ts`: getter `hasInflight` ainda sem consumidor de produção. **Deferido de propósito** — ver a nota em "Já corrigidos". A parte `stableJson` já fechou

## Já corrigidos — não regrida

- `RC-shared-validation` — `configuracaoScreen.logic.ts` importa `validate*Key` / `validateGithubToken`; não re-declare prefixo/comprimento no renderer.
- `RC-business-rule-in-tsx` — regras em `*.logic.ts` com teste irmão (inclui Codegraph/Login — C49).
- `RC-no-silent-catch` / `RC-silent-catch-regression` — não reintroduza `.catch(() => {})` mudo (harness/catálogo/OAuth poll — C48).
- `RC-shared-api-request` — services usam `api-client.ts`; não duplique `fetch` com headers próprios.
- `RC-harness-count-stale-after-modal-close` — `refreshHarnessCounts` no `onClose` dos modais de vínculo do Repo Harness.
- `RC-business-rule-in-tsx` (F03) — `workspace/chatSurface.logic.ts` é a fonte de busy/followups/Parar/Enviar/labels do workspace; `TaskComposer.tsx` e `ChatHistory.tsx` não derivam regra do estado cru da thread. `deriveChatSurface` **chama** `routeComposerSend` internamente: nunca reimplemente a decisão de rota dentro do surface, senão as duas divergem em silêncio (C60).
- `RC-native-denial-ui-gap` — `hooks/streamNotices.logic.ts`: avisos do workspace são a união discriminada `WorkspaceNotice` (`kind: 'mcp' | 'native_denial'`), `permission.native_denial` vira aviso PT-BR nomeando a tool, e a lista tem teto `MAX_WORKSPACE_NOTICES`. Não volte a só tipar o evento no WS sem renderizar, nem a acumular avisos sem limite (C65).
- `RC-export-should-be-local` — `stableJson` é local em `historyMerge.logic.ts` (C69).
- `RC-non-null-assertion-mask` — nada de `pendingPermission!` em `usePrincipalWorkspace`; `resolve_permission` sem permissão faz early-return com erro visível, nunca cai nos branches de baixo e vira turno novo (C66, Stack `TypeScript` no AUDIT).

### Deferimento ativo (não trate como código morto)

- `hasInflight` em `historyMerge.logic.ts` continua exportado de propósito: ganha consumidor de produção na fase que introduz reconnect de WebSocket com resync serializado. Uma varredura de export órfão vai apontá-lo; deixe como está.
