# Bindings — EngrenaCode (TypeScript)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (checklist "Tipagem estrita") + `review-robustness`.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Validadores canônicos | `apps/engrena-code/src/services/vault/provider-keys.ts`, `.../http/github-token.ts` |
| Catálogo / limites | `apps/engrena-code/src/services/runner/providers/provider-catalog.ts`, `composer-images.ts` |
| Redação ao adicionar prefixo | `apps/engrena-code/src/services/process-error.ts` (mesmo diff) |
| Wire client | `apps/engrena-code/src/renderer/services/*-service.ts` |
| Linha de base | `rg ": any\|as any\|<any>" apps/engrena-code/src packages` deve sair vazio |

## Como encaixa nas outras Stacks

| Path | Stack do achado |
|------|-----------------|
| `apps/engrena-code/src/services/http/*` + `packages/http-core` | Node.js (`coding-nodejs`) |
| `apps/engrena-code/src/main` / `preload` / `terminal` | Electron |
| `apps/engrena-code/src/renderer/**` | React |
| `apps/engrena-code/src/services/db/**` + `packages/db-core` | SQLite |

Use esta skill como reforço, não como categoria concorrente.

## Achados abertos

Passagem 2026-08-12 (uncommitted) — ver `AUDIT-CODE-REVIEW.md`: nenhum aberto nesta Stack.

## Já corrigidos — não regrida

- `RC-non-null-assertion-mask` — R05 fechado na remediação de 2026-08-13: `usePrincipalWorkspace.ts` materializa o snapshot do broker numa variável já estreitada em vez de `pendingPermission!`. O `!` mascarava ausência **e** o branch seguinte deixava o texto cair em silêncio nos branches de baixo, virando turno novo; agora é early-return com erro visível de permissão pendente
- `RC-unchecked-array-cast` — R01 fechado no mesmo lote: `stream-json-parse.ts` filtra elemento a elemento com `isRecord` em vez de `as ContentBlock[]`. Cast de array vindo de I/O não estreita os itens
