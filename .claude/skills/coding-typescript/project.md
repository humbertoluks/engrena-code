# Bindings — EngrenaCode (TypeScript)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`docs/AUDIT-CODE-REVIEW.md`](../../../docs/AUDIT-CODE-REVIEW.md) (checklist "Tipagem estrita") + `review-robustness`.

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Validadores canônicos | `src/services/vault/provider-keys.ts`, `src/services/http/github-token.ts` |
| Catálogo / limites | `src/services/runner/providers/provider-catalog.ts`, `composer-images.ts` |
| Redação ao adicionar prefixo | `src/services/process-error.ts` (mesmo diff) |
| Wire client | `src/renderer/services/*-service.ts` |
| Linha de base | `rg ": any\|as any\|<any>" src` deve sair vazio |

## Como encaixa nas outras Stacks

| Path | Stack do achado |
|------|-----------------|
| `src/services/http/*` | Node.js (`coding-nodejs`) |
| `src/main` / `preload` / `terminal` | Electron |
| `src/renderer/**` | React |
| `src/services/db/**` | SQLite |

Use esta skill como reforço, não como categoria concorrente.

## Achados abertos

Nenhum nesta Stack (tipagem reportada na Stack do arquivo).
