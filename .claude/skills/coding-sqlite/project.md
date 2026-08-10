# Bindings — EngrenaCode (SQLite)

Camada acoplada a este repo. Levando a skill para outro projeto: reescreva só este arquivo.

Fonte: [`apps/engrena-code/docs/AUDIT-CODE-REVIEW.md`](../../../apps/engrena-code/docs/AUDIT-CODE-REVIEW.md) (Stack `SQLite`).

## Mapa do repo

| Conceito | Neste repo |
|----------|------------|
| Core | `packages/db-core` (`createDb` / `runMigrations`) |
| Client (Code) | `apps/engrena-code/src/services/db/client.ts` (`getDb` / `closeDb` + `engrenacode.db`) |
| Migrations | `apps/engrena-code/src/services/db/migrations/NNN_<assunto>.ts` (lista injetada no core) |
| Repositories | `apps/engrena-code/src/services/db/repositories/<entity-plural>.ts` |
| Dívida conhecida | prefixo `001_` duplicado (`001_rules.ts` e `001_subagents.ts`) — não repita |

## Precedentes vivos

| Slug | Referência |
|------|------------|
| `repo-module-functions` | `repositories/skills.ts` (funções `listSkills`/`createSkill`/…) |
| `repo-sqlite-only-under-db` | skills migrado de JSON → SQLite (`012_skills`) |
| `migration-forward-only` | pasta `migrations/` |

## Invariantes de contrato deste repo

- Produção: nenhum `getDb()` fora de `src/services/db/**` (só `*.test.ts`).
- Arquivo sob `repositories/` não persiste via `fs`/`*.json` (migração one-shot de legado, se existir, é exceção documentada e temporária).

## Achados abertos

Nenhum (passagem 2026-08-10 remediada — C50).

## Já corrigidos — não regrida

- `RC-module-repo` — funções de módulo; sem factory sem segundo consumidor
- `RC-missing-sibling-test` — entidade nova entra com irmão no mesmo diff
- `RC-skills-json-outside-sqlite` — skills em SQLite; spy de teste via `import * as skillsRepo`
- `RC-dead-export` / `RC-export-should-be-local` — sem export órfão (`getProjectByPath` removido; `getLogEntry`/`getUsageEvent` locais; `countAllPending` removido — C50)
