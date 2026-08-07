# Codebase Patterns Brief

| Campo | Valor |
|-------|-------|
| wave | 3 |
| generated_at | 2026-08-06T19:15:00-03:00 |
| git_sha | 4870688 |
| foundation_state | complete |
| features_in_batch | F17 |
| status | fresh |

---

## 1. Camada 1 — Baseline (checklist fixo)

| Categoria | Achado | Path exemplo |
|-----------|--------|--------------|
| Runtime e linguagem | Electron desktop + Node main; TypeScript ESM (`"type": "module"`); `__dirname` via `fileURLToPath` no main; preload CommonJS (`preload.cjs`) | `src/main/index.ts`, `src/preload/index.ts`, `package.json` |
| Framework e layout do projeto | Vite 8 + React 19 + Tailwind 4 (`@tailwindcss/vite`); `vite-plugin-electron` orquestra main+renderer; UI em `src/renderer/screens` + `src/renderer/components/<domínio>`; domínio/HTTP em `src/services/` (`src/features/`, `src/db/` são placeholders vazios) | `vite.config.ts`, `src/renderer/App.tsx`, `docs/DEVELOPMENT.md` |
| Banco de dados e acesso a dados | SQLite via `node:sqlite` `DatabaseSync` → `engrenacode.db` em userData; migrations numeradas + `schema_migrations`; **skills** hoje em `skills.json` (não SQLite); subagents/rules/mcps/threads em SQLite; override `ENGRENACODE_USER_DATA` / `ENGRENACODE_DB_PATH`; testes com `openDb(':memory:')` | `src/services/db/client.ts`, `src/services/db/repositories/skills.ts`, `src/services/db/repositories/subagents.ts` |
| Autenticação | Vault AES (`vault.enc`); unlock HTTP público; session token em memória + header `x-engrenacode-session`; IPC `engrenacode:vault:*`; 401 `unauthorized` / 423 `vault_locked`; WS auth via subprotocol `engrenacode-session.<token>` | `src/services/vault/`, `src/services/http/unlock-handler.ts` |
| Estilo de API / ponto de entrada | HTTP loopback `127.0.0.1:5174` (`createUnlockServer`); handlers `handle*Request(req,res)→boolean` no server único; JSON `{ error: { code, message } }`; pós-unlock bem-sucedido emite `sessionToken` (hook natural para seeds) | `src/services/http/unlock-handler.ts`, `src/services/http/*-handler.ts` |
| Validação | Manual nos handlers/repos (sem Zod); códigos estáveis (`validation_error`, `*_conflict`); name único em skills/subagents; teto content/prompt ~1 MiB | `src/services/db/repositories/skills.ts`, `src/services/http/subagents-handler.ts` |
| Framework e estilo de testes | Vitest (`pnpm test` = `vitest run`); co-local `*.test.ts`; HTTP real com `http.createServer` + axios `validateStatus: () => true`; unlock de teste via `vaultService.unlock(...)` | `src/services/db/repositories/skills.test.ts`, `src/services/db/repositories/subagents.test.ts` |
| Tratamento de erros | Classes de domínio (`SkillNameConflictError`, `SubagentNameConflictError`, …); HTTP 400/401/404/409/423/500 com `code`; falha parcial de seed (PRD) → log e continua, sem bloquear unlock | `src/services/db/repositories/skills.ts`, `src/services/db/repositories/log-entries.ts` |
| Estrutura de pastas e nomenclatura | Docs: `docs/F<ID>-<kebab>/` (`spec.md`, `plan.md`, opcional `ui.md`/`copy.md`); código: `src/{main,preload,renderer,services}`; screens `*Screen.tsx`; handlers `*-handler.ts`; repos kebab; rotas hash `#dashboard`, `#skills`, `#subagents` | `docs/F05-skills/`, `src/renderer/screens/`, `src/services/` |

---

## 2. Camada 2 — Padrões amplos (máx. 15 bullets)

- [Momento unlock]: `POST /api/vault/unlock` chama `vaultService.unlock`; em sucesso devolve `sessionToken` — único gate de sessão; hook natural para aplicar seeds **após** unlock OK e **antes** da resposta (não bloquear unlock em falha parcial). Ex.: `src/services/http/unlock-handler.ts`
- [Vault KV]: Segredos/flags em `vaultService.setSecret/getSecret` (Record em memória, persistido cifrado); padrão existente para keys (`keys:*`) — candidato a flag idempotente `seeds:catalog:v1` “por cofre”. Ex.: `src/services/vault/vault-service.ts`
- [Skills store]: Catálogo F05 em `userData/skills.json` via `skillsRepository` (singleton); `create` rejeita name duplicado (`SkillNameConflictError`); `getCounts().global` alimenta dashboard. Ex.: `src/services/db/repositories/skills.ts`
- [Subagents store]: Catálogo F07 em SQLite (`001_subagents`); `createSubagentsRepository(db).create`; `name` UNIQUE; `kind=dev` é implícito (sem coluna `kind`); `getCounts().global` no dashboard. Ex.: `src/services/db/repositories/subagents.ts`
- [Migrations]: `schema_migrations` + lista `MIGRATIONS` em `client.ts`; IDs tipo `001_subagents`…`005_consumo`; só DDL schema — não há tabela `app_settings`. Ex.: `src/services/db/client.ts`
- [Dashboard catalog]: `GET /api/dashboard` expõe `catalog.skills/rules/subagents` = `getCounts().global`; UI `#dashboard` clica para `#skills`/`#subagents`. Ex.: `src/services/http/dashboard-handler.ts`
- [CRUD schemas seedáveis]: Skill = `{ name, description, content, category?, enabled? }`; Subagent = `{ name, description, prompt, provider, model?, reasoningLevel?, tools?, category?, idleTimeoutMinutes?, enabled? }`; sem vínculo a projeto no create. Ex.: `src/services/db/repositories/skills.ts`, `…/subagents.ts`
- [Name conflict = skip]: Persistência já trata duplicata por name; seeds devem catch/skip (não sobrescrever customizações). Ex.: `SkillNameConflictError` / `SubagentNameConflictError`
- [Audit log]: `createLogEntry({ kind, event, … })` em `log_entries` — padrão para registrar falha parcial de seed sem abortar fluxo. Ex.: `src/services/db/repositories/log-entries.ts`
- [Catálogo MCP (análogo, não auto-seed)]: Presets estáticos em `mcps/catalog.ts`; instalação sob demanda (`install` cria row); name existente → conflito — referência de shape de catálogo versionado no app, **não** de aplicação no unlock. Ex.: `src/services/mcps/catalog.ts`
- [UI catálogo]: Screens `#skills` / `#subagents` + FormModal + `*.logic.ts`; seeds reutilizam CRUD existente (sem wizard F17). Ex.: `src/renderer/screens/SkillsScreen.tsx`, `SubagentsScreen.tsx`
- [Sem auto-vínculo]: `project_skills` / `project_subagents` só via Repo Harness; create global não cria link. Ex.: `skillsRepository.create` / `subagents.create`
- [Isolamento smoke]: `ENGRENACODE_USER_DATA` isola vault + `skills.json` + DB; nunca tocar userData real. Ex.: `src/services/db/client.ts`
- [IPC / sessão]: Token único por processo; unlock UI invalida token anterior — seeds no path HTTP de unlock, não no renderer. Ex.: `src/services/vault/vault-service.ts`
- [Lint/format]: Biome; typecheck `tsc -b` no build. Ex.: `package.json`

---

## 3. Conflitos resolvidos

| Conflito | Escolha | Regra aplicada |
|----------|---------|----------------|
| Skills: F05 spec diz SQLite vs código usa `skills.json` | Persistir/ler seeds de skills via `skillsRepository` (`skills.json`); **não** inventar migração `skills` só por causa do seed | mais frequente (código real F05) |
| Flag idempotente: vault secret vs `schema_migrations` vs tabela nova | Flag `seeds:catalog:v1` em **vault secrets** (uma vez por cofre); migrations ficam para DDL | mais frequente (KV existente) + alinhado ao PRD “por cofre” |
| Layout docs (`src/features/<slug>`) vs código real | UI em `src/renderer/screens` + `components/<domínio>`; domínio/HTTP em `src/services/` | mais frequente |
| Path de DB: `src/db/` vs `src/services/db/` | `src/services/db/` | mais frequente / mais recente |
| SQLite driver: better-sqlite3 vs `node:sqlite` | `node:sqlite` `DatabaseSync` | mais frequente |
| Paths `packages/*` em specs antigas vs `src/*` | Sempre `src/*` | mais recente |
| State: zustand (dep) vs hooks + services | Hooks + `*-service.ts` + localStorage; sem zustand novo | mais frequente |
| Validação: schema lib vs checks manuais | Validação manual tipada nos handlers/repos | mais frequente |
| Auto-seed MCP (install) vs seed onboarding F17 | F17 aplica no unlock (idempotente); MCP continua install sob demanda — não misturar | mais recente (PRD F17) |

---

## 4. Docs canônicos (preferir antes de explorar)

- `docs/DEVELOPMENT.md` — setup Vite/Electron/pnpm, pastas, portas 5173/5174, build
- `docs/PROGRESS.md` — status F01–F17 (feito vs pendente); F17 **Pendente**
- `docs/PRD.md` — F17 Consome/Provê, capacidades (seeds ≥8–≤20 skills, ≥5–≤12 subagents), §9
- `docs/design-system/design-system.md` (+ tokens/color/spacing/typography) — Design Lock
- `docs/F01-vault-e-sessao-local/spec.md` (+ `ui.md`/`copy.md`) — unlock, session, vault secrets
- `docs/F01.1-design-system/spec.md` — tema; F17 sem UI dedicada
- `docs/F05-skills/spec.md` (+ `ui.md`/`copy.md`) — CRUD/schema skills (nota: storage real = JSON)
- `docs/F07-subagents/spec.md` (+ `ui.md`/`copy.md`) — CRUD/schema subagents SQLite, `kind=dev`
- `docs/F04` — dashboard sem pasta `docs/F04-*`; código `#dashboard` + `catalog.*` counts
- `CLAUDE.md` — regras aprendidas (portas, smoke, naming EngrenaCode)

---

## 5. Specs existentes

| Feature | Path | Uma linha de decisão / escopo | ui.md / copy.md |
|---------|------|-------------------------------|------------------|
| F01 | `docs/F01-vault-e-sessao-local/spec.md` | Vault AES + session IPC/HTTP; secrets só em memória | sim / sim |
| F01.1 | `docs/F01.1-design-system/spec.md` | Tokens Design Lock + tema `engrenacode:theme` + Tailwind 4 | não / não |
| F02 | `docs/F02-configuracao-mvp/spec.md` | Config CLIs/prompt/GitHub PAT em `#configuracao` | sim / não |
| F03 | `docs/F03-workspace/spec.md` | Workspace `#principal`: dispatch, WS, diffs, git+lease | sim / sim |
| F04 | _(sem pasta `docs/F04-*`)_ | Dashboard no código; `catalog.skills/subagents` via `getCounts().global` | não / não |
| F05 | `docs/F05-skills/spec.md` | Catálogo skills + vínculo; storage real `skills.json` | sim / sim |
| F06 | `docs/F06-rules/spec.md` | Catálogo rules + override por projeto | sim / sim |
| F07 | `docs/F07-subagents/spec.md` | Catálogo subagents SQLite + gate/idle; `kind=dev` implícito | sim / sim |
| F08 | `docs/F08-registros/spec.md` | Audit `log_entries` + `#registros` read-only | sim / sim |
| F09 | `docs/F09-mcps/spec.md` | MCPs CRUD/OAuth + catálogo presets (install, não auto-seed) | sim / sim |
| F10 | `docs/F10-api-keys-providers/spec.md` | Keys vault + Assinatura/API + Minimax | sim / sim |
| F11 | `docs/F11-consumo/spec.md` | usage_events + delegação real + pricing | sim / sim |
| F12 | `docs/F12-runtime-de-skills/spec.md` | `load_skill` MCP `engrenacode` + snapshot | não / não |
| F13 | `docs/F13-isolamento-worktree/spec.md` | Worktree real + cwd unificado | não / não |
| F14 | `docs/F14-fluxo-git-completo/spec.md` | Commit/push/PR + textgen | não / não |
| F15 | `docs/F15-runtime-de-subagents/spec.md` | Subagent E2E + idle UI + diffs filho | não / não |
| F16 | `docs/F16-composer-avancado/spec.md` | `@file`/imagens + model/reasoning no follow-up | não / não |
| F17 (batch) | _(pasta inexistente)_ | Spec/plan ainda não escritos; **ui.md/copy.md também NÃO existem** (e não são obrigatórios — seeds aparecem nas telas F05/F07) | não / não |

---

## 6. Onda — Consome/Provê (opcional, compacto)

| Feature | Consome | Provê |
|---------|---------|-------|
| F17 Catálogo Seed de Onboarding | F01 momento unlock/cofre; F01.1 (sem UI dedicada); F05 schema/repo skills; F07 schema/repo subagents `kind=dev` | Pacote inicial editável de skills + subagents no catálogo global (contagens F04/`#skills`/`#subagents`); idempotente `seeds:catalog:v1`; skip se name existe; sem auto-vínculo a projetos |
