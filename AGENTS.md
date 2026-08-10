# AGENTS.md

Orientações curtas para agentes neste monorepo. Detalhe operacional e regras aprendidas: [`CLAUDE.md`](CLAUDE.md).

## Família

- **EngrenaPlan** planeja; **EngrenaCode** entrega.
- Marca: só Engrena / EngrenaCode / EngrenaPlan (sem Lion*).

## Docs (não misturar)

| Escopo | Path |
|--------|------|
| Engrena (Design Lock, sprints, architecture) | `docs/` |
| Code (PRD, PROGRESS, features F0*-*) | `apps/engrena-code/docs/` |
| Plan (PRD/README stub) | `apps/engrena-plan/docs/` |

Plano operacional / memória de sprints: `docs/engrena/MONOREPO-SPRINTS.md`.  
Contratos packages/portas/env: `docs/architecture/monorepo.md`.

## Comandos

```bash
pnpm --filter engrena-code dev|test|build
pnpm --filter engrena-plan dev|test
pnpm --filter @engrena/<pkg> test
```

Atalhos raiz: `pnpm dev` / `pnpm test` / `pnpm build` → Code; `pnpm dev:plan` / `pnpm test:plan` → Plan.

## Isolamento rápido

- Unlock Code `5174` · Unlock Plan `5184` · Vite nunca nessas portas
- Env: `ENGRENACODE_USER_DATA` / `ENGRENAPLAN_USER_DATA`
- Packages: `@engrena/ui` · `@engrena/vault` · `@engrena/http-core` · `@engrena/db-core`

## Não fazer

- Ampliar domínio do Plan sem pedido explícito
- Apagar `vault.enc` / userData do usuário
- Commit sem pedido do humano/orquestrador
