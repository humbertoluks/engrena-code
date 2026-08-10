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

Nenhum nesta Stack (tipagem reportada na Stack do arquivo).
