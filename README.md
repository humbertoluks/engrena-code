# Engrena

Monorepo pnpm da família **Engrena**:

| Produto | Papel |
|---------|--------|
| **EngrenaPlan** | Planeja (Discovery → PRD → Spec → Plano) |
| **EngrenaCode** | Entrega (IDE local-first de agentes de IA) |

Packages compartilhados: `@engrena/ui`, `@engrena/vault`, `@engrena/http-core`, `@engrena/db-core`.

## Mapa do repositório

```text
apps/
  engrena-code/     # EngrenaCode (Electron + Vite + React)
  engrena-plan/     # EngrenaPlan (scaffold unlock + shell)
packages/
  ui/               # @engrena/ui
  vault/            # @engrena/vault
  http-core/        # @engrena/http-core
  db-core/          # @engrena/db-core
docs/
  design-system/    # Design Lock Engrena (hexes, spacing, tipografia)
  engrena/          # Plano operacional monorepo
  architecture/     # Contratos do monorepo
```

Docs de produto ficam **dentro de cada app**:

- Code: [`apps/engrena-code/docs`](apps/engrena-code/docs)
- Plan: [`apps/engrena-plan/docs`](apps/engrena-plan/docs)
- Engrena (família): [`docs/`](docs/) na raiz

Arquitetura e portas: [`docs/architecture/monorepo.md`](docs/architecture/monorepo.md).  
Plano / memória dos sprints: [`docs/engrena/MONOREPO-SPRINTS.md`](docs/engrena/MONOREPO-SPRINTS.md).

## Setup

```bash
pnpm install
```

### EngrenaCode

```bash
cp apps/engrena-code/.env.example apps/engrena-code/.env.local
# Ajuste VITE_DEV_SERVER_URL se 5173 estiver ocupada.
# Nunca use 5174 (unlock Code) nem 5184 (unlock Plan).
pnpm --filter engrena-code dev
# atalho raiz: pnpm dev
```

- Unlock loopback: `http://127.0.0.1:5174`
- Docs: [`apps/engrena-code/docs`](apps/engrena-code/docs)

### EngrenaPlan

```bash
cp apps/engrena-plan/.env.example apps/engrena-plan/.env.local
pnpm --filter engrena-plan dev
# atalho raiz: pnpm dev:plan
```

- Vite default: `http://localhost:5175`
- Unlock loopback: `http://127.0.0.1:5184`
- Docs: [`apps/engrena-plan/docs`](apps/engrena-plan/docs)

## Scripts na raiz

| Comando | Alvo |
|---------|------|
| `pnpm dev` / `pnpm test` / `pnpm build` | EngrenaCode |
| `pnpm dev:plan` / `pnpm test:plan` | EngrenaPlan |
| `pnpm test:ui` / `test:vault` / `test:http-core` / `test:db-core` | packages |

## Marca

Só **Engrena** / **EngrenaCode** / **EngrenaPlan**. Sem Lion* em UI, copy ou docs ativos.

<!-- smoke F14: criacao real de PR pela UI do EngrenaCode, 2026-08-17 -->
<!-- smoke F14: PR real pela UI -->
