# Engrena Monorepo — Plano operacional (memória)

> **Fonte de verdade** para a conversão monorepo EngrenaCode + EngrenaPlan + packages.
> Subagentes leem este arquivo no início do sprint; marcam `[X]` ao concluir; registram falhas no log do sprint.
> Não copiar listas longas para o chat: o estado mora aqui.

| Campo | Valor |
|-------|-------|
| Status geral | `done` |
| Produto irmão | EngrenaPlan |
| Repo | converter este repositório em monorepo pnpm |
| Família | EngrenaPlan planeja; EngrenaCode entrega |
| Última atualização | 2026-08-10 |
| Sprint ativo | `done` / — |
| Bloqueio humano | não |

---

## Protocolo de execução (obrigatório)

### Papéis

| Papel | Contexto | Função |
|-------|----------|--------|
| **Orquestrador** | Janela longa / humano | Escolhe o próximo sprint aberto, spawna subagente com prompt curto + path deste arquivo |
| **Sprint agent** | **Contexto limpo** (novo subagente) | Executa só as tasks do sprint; marca `[X]`; roda gate de teste |
| **Maintenance agent** | **Contexto limpo** + bloco `## Falha` do sprint | Corrige regressão; não amplia escopo; devolve ao gate de teste |
| **Humano** | — | Só se `attempt > 3` ou decisão de produto |

### Loop por sprint

```text
1. Orquestrador spawna Sprint agent (contexto limpo)
2. Agent lê este arquivo + seção do sprint
3. Agent executa tasks na ordem; marca [X] a cada task concluída
4. Agent roda Gate de teste do sprint
5. PASS → marca sprint [X], preenche Resultado, encerra
6. FAIL → incrementa attempt; preenche ## Falha do sprint
7. Se attempt <= 3 → spawna Maintenance agent (contexto limpo + ## Falha)
8. Maintenance corrige → volta ao passo 4 (mesmo sprint)
9. Se attempt > 3 → Status geral = blocked; avisar humano; PARAR
```

### Regras do subagente

1. Ler só: este arquivo, arquivos citados nas tasks do sprint, e código necessário à task.
2. Não executar sprints futuros.
3. Marcar `[X]` / `[ ]` **neste arquivo** (memória).
4. Commit só se o orquestrador/humano pedir (padrão do repo).
5. Ao falhar o gate: escrever em `## Falha` (comando, exit code, trecho de log, hipótese) — isso é o handoff.
6. Maintenance: máximo o escopo do sprint; se a causa for sprint anterior, registrar e **bloquear** para humano.

### Prompt mínimo para Sprint agent

```text
Você é o Sprint agent do Engrena monorepo.
Contexto limpo. Memória: docs/engrena/MONOREPO-SPRINTS.md
Execute APENAS o sprint S{N}. Marque [X] nas tasks concluídas.
Ao final rode o Gate de teste do sprint. Se falhar, preencha ## Falha e encerre
(não tente o loop sozinho — o orquestrador spawna maintenance).
Não execute outros sprints.
```

### Prompt mínimo para Maintenance agent

```text
Você é o Maintenance agent. Contexto limpo.
Memória: docs/engrena/MONOREPO-SPRINTS.md — leia o sprint S{N} e a seção ## Falha.
Corrija só o necessário para o Gate passar. Marque tasks se aplicável.
Não amplie escopo. Ao terminar, rode o Gate; atualize ## Falha (resolvido ou nova evidência).
attempt atual: {N}/3
```

---

## Specs (contrato)

Marque `[X]` quando a spec estiver atendida e verificada (não só “código escrito”).

### SP-01 — Monorepo pnpm

- [X] Workspace `apps/*` + `packages/*` em `pnpm-workspace.yaml`
- [X] Root `package.json` orquestra scripts (`pnpm --filter …`)
- [X] Código do Code vive em `apps/engrena-code/`
- [X] Histórico preservado (`git mv`, não copy-delete cego)

### SP-02 — Docs repartidos

- [X] `docs/` raiz = Engrena (design-system + este plano + architecture)
- [X] `apps/engrena-code/docs/` = docs atuais do Code (sem design-system duplicado)
- [X] `apps/engrena-plan/docs/` = stub Plan (PRD mínimo / README)
- [X] Pointers CLAUDE.md / README / skills atualizados

### SP-03 — `@engrena/ui`

- [X] Tokens CSS (`:root`/`.dark`/`@theme inline`/base genérico) só no package
- [X] Theme hook com storage key injetável por app
- [X] Primitives listados nas tasks S1 exportados pelo package
- [X] Modal + Input/Field genéricos no package
- [X] Code importa `@engrena/ui` (sem cópia local de tokens)

### SP-04 — `@engrena/vault`

- [X] `crypto` + `store` + `vault-service` no package
- [X] Path/env parametrizáveis por app
- [X] Code: `provider-keys` / `memory-service` permanecem no app

### SP-05 — `@engrena/http-core`

- [X] `guard` (423 antes de 401), `sendJson`, `readBody`, CORS loopback
- [X] Factory de loopback server com rotas injetáveis
- [X] Header/subprotocol de sessão parametrizáveis

### SP-06 — `@engrena/db-core`

- [X] `openDb` / `getDb` / `runMigrations` / `closeDb` sem migrations hardcoded
- [X] App passa lista de migrations + path do `.db`

### SP-07 — EngrenaPlan scaffold

- [X] App Electron `apps/engrena-plan` sobe com `pnpm --filter engrena-plan dev`
- [X] Consome `@engrena/ui` + vault + http-core + db-core
- [X] `appId` `com.lukse.engrenaplan` (userData isolado)
- [X] Unlock em porta distinta do Code (5184)
- [X] Brand EngrenaPlan (sem Lion*, sem copiar wordmark do Code sem adaptação)

### SP-08 — Isolamento

- [X] Portas unlock: Code 5174, Plan 5184
- [X] IPC prefix distinto ou factory por app
- [X] Env smoke: `ENGRENACODE_USER_DATA` / `ENGRENAPLAN_USER_DATA` (parcial S2: Code + factory `userDataEnvVar`; Plan env em S4)

---

## Árvore alvo (referência)

```text
/
  pnpm-workspace.yaml
  package.json                 # root
  biome.json
  docs/                        # Engrena
    engrena/
      MONOREPO-SPRINTS.md      # ESTE arquivo (memória)
    design-system/
    architecture/
  apps/
    engrena-code/
      src/
      docs/                    # PRD, PROGRESS, F0*-*
      package.json
    engrena-plan/
      src/
      docs/
      package.json
  packages/
    ui/                        # @engrena/ui
    vault/                     # @engrena/vault
    http-core/                 # @engrena/http-core
    db-core/                   # @engrena/db-core
```

---

## Sprints

Legenda: `[ ]` pendente · `[X]` concluído · `attempt` = tentativas do loop teste/manutenção (máx. 3)

---

### S0 — Skeleton monorepo

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-01 (parcial), SP-02 (parcial)

#### Tasks

- [X] T0.1 Criar `apps/`, `packages/`, `docs/engrena/` (este arquivo já existe)
- [X] T0.2 `git mv` código atual → `apps/engrena-code/` (`src`, configs vite/ts do app, assets de build necessários)
- [X] T0.3 `git mv` `docs/` (exceto o que for Engrena) → `apps/engrena-code/docs/`
- [X] T0.4 Mover `design-system` para `docs/design-system` (raiz Engrena); garantir que não reste cópia em Code
- [X] T0.5 Root `package.json` + `pnpm-workspace.yaml` com `apps/*` e `packages/*` (preservar `allowBuilds`)
- [X] T0.6 Ajustar paths (`vite`, `tsconfig`, `electron-builder`, scripts) até o filter Code resolver
- [X] T0.7 Atualizar pointers mínimos (README raiz stub + CLAUDE.md paths) para não quebrar onboarding

#### Gate de teste

```bash
pnpm install
pnpm --filter engrena-code test
pnpm --filter engrena-code exec tsc -b   # ou script build typecheck do app; se build electron for pesado, aceitar tsc + vitest neste gate
```

Critério PASS: Vitest do Code verde; typecheck do app verde. (Installer electron-builder pode ficar para S4 se documentado no Resultado.)

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - Árvore: `apps/engrena-code/` (src + configs + docs Code), `docs/` raiz = `design-system/` + `engrena/`, `packages/` vazio (`.gitkeep`).
  - `design-system` já estava em `docs/design-system`; não foi movido para o app.
  - Gate: `pnpm install` exit 0; Vitest 124 files / 1113 tests exit 0; `tsc -b` exit 0.
  - electron-builder / installer completo deixado para S4 (não exigido neste gate).
  - SP-02 parcial: falta stub Plan + pointers skills (S4/S5). README raiz + CLAUDE.md paths atualizados.
  - Legado `_reversa_*` permanece na raiz (fora do escopo S0).
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

### S1 — `@engrena/ui` + Modal/Input

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-03
- Depende: S0 PASS

#### Tasks

- [X] T1.1 Criar `packages/ui` (`@engrena/ui`) com package.json + exports
- [X] T1.2 Extrair tokens CSS genéricos (sem `.chat-markdown-*` / `.text-shimmer` — ficam no Code)
- [X] T1.3 Extrair `design-tokens.ts`, `useTheme` (key injetável), `shiki-theme`, `xterm-theme`
- [X] T1.4 Extrair primitives: ButtonPrimary, ButtonSecondary, Card, Badge, SegmentedControl, Skeleton, InlineFeedback, StatusDot, MetricCard, ThemeControl
- [X] T1.5 Extrair Modal + Input/Field genéricos; migrar ≥2 modals do Code como prova
- [X] T1.6 Wire Code: import `@engrena/ui`; CSS entry do app importa CSS do package
- [X] T1.7 Remover cópias mortas no app (tokens/primitives movidos)

#### Gate de teste

```bash
pnpm --filter @engrena/ui test    # se houver testes no package; senão skip documentado
pnpm --filter engrena-code test
pnpm --filter engrena-code exec tsc -b
```

Critério PASS: Code typecheck + Vitest verdes; app compila imports do package; tema light/dark não quebra no boot (smoke manual opcional anotado no Resultado).

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - Package `packages/ui` (`@engrena/ui`): exports `.`, `./styles.css`, `./fonts`; fonts `@fontsource-variable/*` como deps do package.
  - CSS genérico em `packages/ui/src/styles.css`; Code mantém `.chat-markdown-*` + `.text-shimmer` em `apps/engrena-code/src/renderer/index.css` (importa CSS do package após `tailwindcss`).
  - `configureThemeStorageKey('engrenacode:theme')` no boot do Code (`main.tsx`); BrandMark permanece no app.
  - Modal + Input novos; prova: `AddProjectModal` + `FileViewerModal` migrados para `<Modal>`.
  - Gate: `@engrena/ui test` exit 0 (skip documentado — sem testes no package); Code Vitest 124/1113 exit 0; `tsc -b` exit 0.
  - Smoke manual tema light/dark: não rodado nesta sessão (boot wire + typecheck OK).
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

### S2 — `@engrena/vault`

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-04, SP-08 (env parcial)
- Depende: S0 PASS (pode paralelizar com S1 só se orquestrador garantir: preferir após S1 se houver conflito de paths)

#### Tasks

- [X] T2.1 Criar `packages/vault` (`@engrena/vault`)
- [X] T2.2 Mover `crypto.ts`, `store.ts`, `vault-service.ts` (+ testes irmãos)
- [X] T2.3 Parametrizar userData/env (Code continua aceitando `ENGRENACODE_USER_DATA`)
- [X] T2.4 Code importa package; `provider-keys` e `memory-service` ficam no app
- [X] T2.5 Ajustar imports HTTP unlock / main que consomem vault

#### Gate de teste

```bash
pnpm --filter @engrena/vault test
pnpm --filter engrena-code test
```

Critério PASS: testes de vault verdes **duas vezes** se flaky sob carga; suite Code verde nas áreas vault/unlock.

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - Package `packages/vault` (`@engrena/vault`): `createVault({ userDataEnvVar, fallbackUserData })` + `createVaultFromResolver` para testes; sem dependência de Electron no package.
  - Code shim `apps/engrena-code/src/services/vault/vault-service.ts` instancia o singleton com `ENGRENACODE_USER_DATA` + `app.getPath('userData')`; consumers HTTP/main/runner mantêm path relativo ao shim (API estável).
  - `provider-keys` + `memory-service` (+ testes) permaneceram no app.
  - Gate: `@engrena/vault test` 21/21 exit 0 **duas vezes**; Code Vitest 121 files / 1093 tests exit 0 (3 suites vault migradas ao package).
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

### S3 — `@engrena/http-core` + `@engrena/db-core`

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-05, SP-06
- Depende: S2 PASS (http usa vault/guard)

#### Tasks

- [X] T3.1 Criar `packages/http-core` (`@engrena/http-core`)
- [X] T3.2 Extrair `_transport.ts` + factory `createLoopbackServer`
- [X] T3.3 Parametrizar session header / WS subprotocol
- [X] T3.4 Code: handlers permanecem no app; server usa factory
- [X] T3.5 Criar `packages/db-core` (`@engrena/db-core`)
- [X] T3.6 Extrair runner de migrations + open/get/close Db
- [X] T3.7 Code passa `MIGRATIONS[]` + path `engrenacode.db`

#### Gate de teste

```bash
pnpm --filter @engrena/http-core test
pnpm --filter @engrena/db-core test
pnpm --filter engrena-code test
```

Critério PASS: suites dos packages + Code verdes; ordem do `guard` 423→401 preservada (teste existente ou novo no package).

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - Package `packages/http-core` (`@engrena/http-core`): `createGuard` (423→401), transport (`sendJson`/`readBody`/…), CORS loopback, `createLoopbackServer`, session header + WS subprotocol prefix parametrizáveis (defaults Code-compatíveis).
  - Code shim `_transport.ts` liga vault; `createUnlockServer` usa factory; handlers/repos ficam no app; `ws-upgrade` usa `extractSessionTokenFromSubprotocol`.
  - Package `packages/db-core` (`@engrena/db-core`): `createDb` + `runMigrations`; Code passa `MIGRATIONS[]` + `engrenacode.db` + `ENGRENACODE_USER_DATA` / `ENGRENACODE_DB_PATH`.
  - Gate: `@engrena/http-core test` 20/20 exit 0 (inclui 423 antes de 401); `@engrena/db-core test` 5/5 exit 0; Code Vitest 120 files / 1078 tests exit 0 (`_transport.test` migrado ao package).
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

### S4 — Scaffold EngrenaPlan

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-07, SP-08
- Depende: S1 + S2 + S3 PASS

#### Tasks

- [X] T4.1 Scaffold `apps/engrena-plan` (Electron + Vite + React + Tailwind 4) espelhando padrões do Code
- [X] T4.2 `appId` `com.lukse.engrenaplan`; unlock `127.0.0.1:5184`
- [X] T4.3 Consumir `@engrena/ui`, `@engrena/vault`, `@engrena/http-core`, `@engrena/db-core`
- [X] T4.4 Tela unlock + shell vazio + BrandMark EngrenaPlan
- [X] T4.5 Migration mínima / db `engrenaplan.db`
- [X] T4.6 `apps/engrena-plan/docs/` stub (README + PRD mínimo: Discovery/PRD/Spec/Plano)
- [X] T4.7 Scripts root: `pnpm --filter engrena-plan dev|test`

#### Gate de teste

```bash
pnpm --filter engrena-plan test
pnpm --filter engrena-plan exec tsc -b
pnpm --filter engrena-code test
```

Critério PASS: Plan typecheck + testes stub verdes; Code não regrediu; `dev` do Plan sobe (smoke 1 linha no Resultado: unlock carrega).

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - App `apps/engrena-plan`: Electron + Vite + React 19 + Tailwind 4; Vite `5175`; unlock `127.0.0.1:5184`; `appId` `com.lukse.engrenaplan`.
  - Consome `@engrena/ui` / vault / http-core / db-core; session header `x-engrenaplan-session`; IPC `engrenaplan:vault:*`; env `ENGRENAPLAN_USER_DATA` + `engrenaplan.db` (`001_meta`).
  - UI: unlock + shell vazio + BrandMark/wordmark EngrenaPlan (mark documento, distinto do hexágono Code).
  - Docs stub: `apps/engrena-plan/docs/README.md` + `PRD.md` (Discovery/PRD/Spec/Plano).
  - Root scripts: `dev:plan` / `test:plan`; filter `engrena-plan` `dev|test`.
  - pnpm 11: `packageExtensions.vite-plugin-electron.peerDependencies.vite` em `pnpm-workspace.yaml` (plugin importa vite sem peer — quebrava `dev` Code e Plan).
  - Fix collat.: `VaultService` sem parameter property (`erasableSyntaxOnly` / TS1294) em `@engrena/vault`.
  - Gate: Plan Vitest 2 files / 5 tests exit 0; Plan `tsc -b` exit 0; Code Vitest 120/1078 exit 0.
  - Smoke `pnpm --filter engrena-plan dev`: Vite `http://localhost:5175/` HTML title EngrenaPlan; log `EngrenaPlan unlock server listening on http://127.0.0.1:5184`; POST unlock → `unlocked:true` + sessionToken.
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

### S5 — Higiene e fechamento

- Status: `[X]` · attempt: `0` / 3
- Specs: SP-02 completo, SP-08 completo; todas SP-* `[X]`
- Depende: S4 PASS

#### Tasks

- [X] T5.1 README raiz: família Engrena, como rodar Code e Plan, mapa `apps/` + `packages/` + `docs/`
- [X] T5.2 `docs/architecture/monorepo.md` (contratos dos packages, portas, env)
- [X] T5.3 CLAUDE.md / AGENTS.md: paths novos + regra “docs Engrena vs Code vs Plan”
- [X] T5.4 Grep por paths mortos (`docs/PRD.md` antigo, imports quebrados) e corrigir
- [X] T5.5 Confirmar design-system só em `docs/design-system`
- [X] T5.6 Marcar todas as Specs SP-* como `[X]` se gates anteriores PASS
- [X] T5.7 Status geral → `done`

#### Gate de teste

```bash
pnpm --filter engrena-code test
pnpm --filter engrena-plan test
pnpm --filter engrena-code build   # se viável no ambiente; senão tsc -b + nota
```

Critério PASS: Code + Plan testes verdes; docs coherentes; Specs todas `[X]`.

#### Resultado

- PASS/FAIL: **PASS**
- Notas:
  - README raiz + `docs/architecture/monorepo.md` + `AGENTS.md` + CLAUDE (regra docs Engrena/Code/Plan, portas 5174/5184).
  - Pointers skills: `coding-*/project.md` + prd/spec/implement/audit/review → `apps/engrena-code/docs/*`; stub Plan já em `apps/engrena-plan/docs/`.
  - T5.5: Design Lock ativo só em `docs/design-system` (cópia legada `_reversa_sdd/design-system` fora do fluxo; sem cópia em apps).
  - Gate: Code Vitest 120/1078 exit 0; Plan Vitest 2/5 exit 0; Code `build` (tsc+vite+electron-builder) exit 0.
  - Status geral → `done`; todas SP-01…SP-08 `[X]`.
- Commit (se houver): nenhum (orquestrador/humano pedem)

#### Falha (handoff maintenance)

- attempt:
- Comando:
- Exit code:
- Log (trecho):
- Hipótese:
- Arquivos suspeitos:

---

## Log do orquestrador

| Data | Ação | Sprint | attempt | Agente | Outcome |
|------|------|--------|---------|--------|---------|
| 2026-08-10 | Artefato criado | — | — | orquestrador | memória pronta |
| 2026-08-10 | Sprint agent S0 | S0 | 0 | sprint | PASS — skeleton + gate verde; ativo → S1 |
| 2026-08-10 | Sprint agent S1 | S1 | 0 | sprint | PASS — @engrena/ui + Modal/Input; gate verde; ativo → S2 |
| 2026-08-10 | Sprint agent S2 | S2 | 0 | sprint | PASS — @engrena/vault + env parametrizado; gate verde; ativo → S3 |
| 2026-08-10 | Sprint agent S3 | S3 | 0 | sprint | PASS — @engrena/http-core + @engrena/db-core; gate verde; ativo → S4 |
| 2026-08-10 | Sprint agent S4 | S4 | 0 | spawn | PASS — EngrenaPlan scaffold unlock 5184; gate verde; ativo → S5 |
| 2026-08-10 | Sprint agent S5 | S5 | 0 | spawn | PASS — higiene docs/skills; Specs all [X]; status geral done |

---

## Bloqueio humano

Preencher só quando `attempt > 3` ou decisão externa.

```text
Sprint:
attempt:
Motivo:
O que já tentou:
Pedido ao humano:
```

---

## Fora de escopo (não abrir task nestes sprints)

- Features de domínio do EngrenaPlan (editor PRD, discovery boards, etc.)
- Publicar packages em npm registry
- Renomear remote/repo git
- Extrair runner / git / codegraph / PTY do Code
- Renomear produto para EngrenaSpec (decisão: EngrenaPlan)
