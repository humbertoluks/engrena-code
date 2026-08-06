# Auditoria PRD §9 — EngrenaCode vs LionCodeLabs

Matriz checkbox a checkbox dos critérios de aceitação em `docs/PRD.md` §9, com evidência no fonte do EngrenaCode e nota de paridade com o produto legado (LionCodeLabs).

**Data da auditoria:** 2026-08-06  
**Escopo:** critérios marcados no PRD + gaps de produto relevantes da migração  
**Método:** leitura de `src/**` + cruzamento com `docs/PROGRESS.md` e inventário do legado  
**Uso:** base para a próxima onda de desenvolvimento (extensão do PRD via `/prd-writer`)

### Legenda de veredito

| Veredito | Significado |
|----------|-------------|
| **PASS** | Critério cumprido no código (e, quando aplicável, smoke) |
| **FAIL** | Critério marcado `[x]` ou exigido pelo texto, mas **não** cumprido ponta a ponta |
| **PARTIAL** | Código parcial; falta wiring, UI ou smoke |
| **OPEN** | Critério já `[ ]` no PRD; confirmação de que continua aberto |
| **DOC-LAG** | Código cumpre, mas o checkbox do PRD ainda está `[ ]` (doc atrasado) |

### Legenda de ação sugerida

| Ação | Significado |
|------|-------------|
| **corrigir-doc** | Marcar `[x]` ou `[ ]` para refletir a realidade |
| **corrigir-código** | Fechar gap de implementação na próxima onda |
| **smoke** | Código parece ok; falta prova E2E/live |
| **nova-feature** | Capacidade legada / desejada fora do critério atual; candidata a F12+ |

---

## 1. Resumo executivo

| Bloco | PASS | FAIL (marcado `[x]` indevido) | OPEN / PARTIAL | DOC-LAG |
|-------|------|-------------------------------|----------------|---------|
| F01–F02, F01.1, F04, F08, F10 | maioria PASS | 0 | 0 | 0 |
| F03 Workspace | 5 PASS | **1 FAIL** (participação F05–F07) | worktree fantasma | 0 |
| F05 Skills | 2 PASS | **1 FAIL** (`load_skill`) | — | 0 |
| F06 Rules | 2 PASS | 0 | — | **1** (bloco no turno) |
| F07 SubAgents | 2 PASS | 0 | **2 OPEN** | 0 |
| F09 MCPs | 4 PASS | 0 | — | 0 |
| F11 Consumo | 4–5 PASS | 0 | share subagent live | possível DOC-LAG cross |
| Cross-Feature | 6 PASS | 0 | vários OPEN | **3–4** (prompt, rules, MCP, consumo) |

**Achados P0 (falso positivo no PRD):**

1. **F05** `[x] load_skill entrega content sob demanda` → **FAIL** (tool nunca registrada)
2. **F03** `[x] Skills, rules e subagents vinculados participam do turno conforme F05–F07` → **FAIL/PARTIAL** (rules/prompt ok; skills sem tool; subagent sem smoke)

**Achados P0 de produto (não são checkbox §9, mas quebram expectativa de migração):**

3. `executionMode: worktree` sem criação de worktree  
4. Mensagem de commit/PR por IA ausente  
5. Botão PR / fluxo “Commit, push & PR” incompleto na UI  
6. Composer sem modelo/reasoning no agente pai  

---

## 2. Matriz por feature (PRD §9)

### F01. Vault e Sessão Local

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Primeiro uso cria cofre… | `[x]` | **PASS** | `src/services/vault/*`, `LoginScreen.tsx`, smoke F01 | — |
| Unlock emite sessão… | `[x]` | **PASS** | `unlock-handler.ts`, IPC `engrenacode:vault:*` | — |
| Senha inválida genérica | `[x]` | **PASS** | anti-enumeração no unlock | — |
| Backoff após 5 falhas | `[x]` | **PASS** | gate de login | — |
| Cofre travado 401/423 | `[x]` | **PASS** | `session-middleware.ts` | — |

### F01.1 Design System

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Tokens CSS light/dark | `[x]` | **PASS** | tokens + Design Lock | — |
| Spacing/radii | `[x]` | **PASS** | `@theme inline` | — |
| Tema light\|dark\|system | `[x]` | **PASS** | `useTheme` | — |
| Persistência `engrenacode:theme` | `[x]` | **PASS** | localStorage | — |
| Fail-soft system | `[x]` | **PASS** | | — |
| Anti-flash | `[x]` | **PASS** | | — |
| Splash `#0a0a0b` | `[x]` | **PASS** | | — |
| Shiki/xterm tokens | `[x]` | **PASS** | chat + temas | — |
| Superfícies / tipografia / sem MUI | `[x]` | **PASS** | | — |

### F02. Configuração MVP

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Card Claude + teste | `[x]` | **PASS** | `ConfiguracaoScreen`, `config-handler` | — |
| CLIs Claude/Codex/Kimi | `[x]` | **PASS** | probe CLIs | — |
| Prompt global save/restore/off | `[x]` | **PASS** | vault `prompt:global` | — |
| Token GitHub validação | `[x]` | **PASS** | `github-token.ts` | — |
| Sem API keys nesta feature | `[x]` | **PASS** | keys em F10 | — |

### F03. Workspace

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Cadastra projeto/thread Claude\|Codex\|Kimi + access + execution | `[x]` | **PASS** | + Minimax via F10 | — |
| Execution mode trava após 1º envio | `[x]` | **PASS** | `threads-handler` rejeita mudança | — |
| Streaming, tools, histórico, fila | `[x]` | **PASS** | WS + smoke F03 | — |
| Accept/reject; git bloqueado se running | `[x]` | **PASS** | `apply-diff`, `git-handler` | — |
| `thread_busy` na 2ª execução | `[x]` | **PASS** | lease `project-execution` | — |
| Skills/rules/subagents participam conforme F05–F07 | `[x]` | **FAIL** | Rules + prompt injetados (`dispatch.ts` `buildSystemPrompt`). Skills: só catálogo no prompt, **sem tool `load_skill`**. Subagents: MCP interno wired, **sem smoke live** de `call_subagent`. | **corrigir-código** + **corrigir-doc** (rebaixar até fechar) |

**Nota fora do checkbox (regressão vs legado / expectativa de produto):**

| Capacidade | Veredito | Evidência | Ação |
|------------|----------|-----------|------|
| `executionMode: worktree` cria worktree | **FAIL** | UI oferece opção; `createThread` não seta `worktreePath`; dispatch cai em `project.path` | **corrigir-código** ou remover opção |
| Commit / Commit & push / PR unificado + AI message | **PARTIAL** | API commit/push/PR existe; `GitActions` sem PR; título PR fixo; sem `textgen` | **nova-feature** / gap F03 |
| Modelo/reasoning mid-thread no pai | **FAIL** vs legado | Provider imutável; composer sem picker de model/reasoning | **nova-feature** (PRD §7 corta multi-provider mid-thread; modelo ainda pode voltar) |
| `@file`, imagens, voz, slash | **FAIL** vs legado | Ausentes em `src/` | **nova-feature** (voz/slash = §7) |

### F04. Dashboard

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Pós-unlock `#dashboard` + saúde + 4 cards | `[x]` | **PASS** | smoke F04 | — |
| Inbox ≤20 com kinds | `[x]` | **PASS** | | — |
| Clique diff → aba Diff | `[x]` | **PASS** | deep-link query | — |
| Contadores → catálogos | `[x]` | **PASS** | | — |
| Não aceita diff / não dispara turno | `[x]` | **PASS** | | — |

### F05. Skills

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| CRUD global name único | `[x]` | **PASS** | `#skills`, handlers | — |
| Vínculo por projeto no catálogo do turno | `[x]` | **PASS** | `createSkillSnapshot` + lista no prompt | — |
| `load_skill` entrega content sob demanda; skill não roda sozinha | `[x]` | **FAIL** | `skill-registry.ts` expõe `loadSkill()` no snapshot, mas `dispatch.ts` **nunca registra tool/MCP**. Agente só vê nomes/descrições. Legado: `mcp__lioncode__load_skill`. | **corrigir-código** + **corrigir-doc** |

### F06. Rules

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Globais/projeto + override | `[x]` | **PASS** | | — |
| Bloco em todo turno com precedência | `[ ]` | **DOC-LAG → PASS no código** | `RuleRegistry.composeBlockForTurn` + `buildSystemPrompt`; unit `dispatch.test.ts` | **corrigir-doc** → `[x]` |
| Name com CR/LF rejeitado | `[x]` | **PASS** | | — |

### F07. SubAgents

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| CRUD + vínculo `kind=dev` + providers | `[x]` | **PASS** | | — |
| `call_subagent` run efêmero; diffs filho na revisão do pai | `[ ]` | **OPEN / PARTIAL** | `subagent-mcp-server.ts` + `delegate.ts` wired no dispatch; sem smoke contra binário real; diffs do filho na revisão do pai não comprovados E2E | **smoke** + fechar se faltar wiring de diff |
| Codex pai sem full-access não delega | `[x]` | **PASS** | `subagent-caller-gate.ts` | — |
| Idle timeout 20 min visível na UI | `[ ]` | **OPEN / PARTIAL** | `checkIdleTimeout` / `DelegatedRun` no backend; UI de status de timeout não fechada | **corrigir-código** (UI) |

**Nota vs legado:** write-parallel / child worktree / merge-tree / `kind=pipeline` estão em PRD §7 (fora de escopo) — não são FAIL do §9.

### F08. Registros

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Eventos task/tool/git automáticos | `[x]` | **PASS** | smoke F08 + F03 | — |
| Filtro/paginação/empty | `[x]` | **PASS** | | — |
| Clique thread id → workspace | `[x]` | **PASS** | | — |
| Sem edit/delete/export | `[x]` | **PASS** | | — |

### F09. MCPs

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Preset/custom + validação nome | `[x]` | **PASS** | | — |
| HTTPS / HTTP loopback | `[x]` | **PASS** | | — |
| Omit sem abortar + OAuth live | `[x]` | **PASS** | Linear smoke 2026-08-05 | — |
| Tools `mcp__…` no turno | `[x]` | **PASS** | `--mcp-config` + prepare | — |

### F10. API Keys dos Providers

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Toggle Claude assinatura ↔ key | `[x]` | **PASS** | | — |
| Keys Claude/Codex/Minimax + save parcial | `[x]` | **PASS** | | — |
| Minimax disponível com key | `[x]` | **PASS** | | — |
| Modo key sem key avisa/bloqueia | `[x]` | **PASS** | | — |

### F11. Consumo

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| usage_event por turno agent/subagent | `[x]` | **PARTIAL** | Agent: smoke F03/F11. Subagent: wiring + testes; **sem turno live** de `call_subagent` | **smoke** |
| Drill-down + share subagents | `[x]` | **PARTIAL** | UI/API ok; share `—` nos threads reais sem delegação live | **smoke** |
| cost_source sdk/table | `[x]` | **PASS** | | — |
| Editar preço só nulls table | `[x]` | **PASS** | smoke F11 | — |
| Flags / empty / erro | `[x]` | **PASS** | | — |

---

## 3. Integração Cross-Feature

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Tokens F01.1 em `#configuracao` | `[x]` | **PASS** | | — |
| Tokens/Shiki/markdown no Workspace | `[x]` | **PASS** | | — |
| Tokens F01.1 em F04–F11 | `[ ]` | **OPEN** | smokes light/dark por tela existem em vários F*; item guarda-chuva ainda aberto | **smoke** / fechar doc se aceitar evidência dispersa |
| Tema persiste entre `#dashboard` / `#configuracao` / workspace | `[ ]` | **OPEN** | chave existe; re-verificação cross-nav não fechada (PROGRESS) | **smoke** |
| Status F02 → Dashboard + Workspace | `[x]` | **PASS** | | — |
| Prompt global F02 injetado no turno | `[ ]` | **DOC-LAG → PASS no código** | `buildSystemPrompt` lê `prompt:global` | **corrigir-doc** |
| Skills via `load_skill` no Workspace | `[ ]` | **OPEN = FAIL real** | alinhado ao FAIL F05 | **corrigir-código** |
| Rules injetadas em todo turno | `[ ]` | **DOC-LAG → PASS no código** | `composeBlockForTurn` | **corrigir-doc** |
| SubAgents devolvem resultado + diffs na revisão do pai | `[ ]` | **OPEN** | alinhado F07 | **corrigir-código** / **smoke** |
| F03 alimenta Dashboard | `[x]` | **PASS** | | — |
| Contagens F05–F07 no Dashboard | `[x]` | **PASS** | | — |
| Eventos F03 → Registros | `[x]` | **PASS** | | — |
| Vault+vínculo → MCP available/omitted | `[ ]` | **DOC-LAG → PASS no código+smoke** | prepareMcps + OAuth Linear + banner omit | **corrigir-doc** |
| API keys F10 resolvíveis no Workspace | `[x]` | **PASS** | | — |
| usage_events F03/F07 agregam em Consumo | `[ ]` | **PARTIAL** | Agente sim (smoke F11); subagent live não | **smoke** + depois **corrigir-doc** |

---

## 4. Checkboxes `[x]` indevidos (corrigir imediatamente ou na onda)

| ID | Texto | Por quê FAIL |
|----|-------|--------------|
| F05 | `load_skill` entrega content sob demanda | Snapshot existe; **tool não registrada** no turno |
| F03 | Skills/rules/subagents participam conforme F05–F07 | Depende de F05 (`load_skill`) e F07 (delegação comprovada); hoje só rules + anúncio de catálogo |

Recomendação operacional: **rebaixar esses dois para `[ ]`** no PRD até o código fechar, para `PROGRESS.md` não mentir o estado.

---

## 5. Checkboxes `[ ]` que o código já cumpre (DOC-LAG)

| ID | Texto | Evidência |
|----|-------|-----------|
| F06 | Bloco de rules em todo turno | `dispatch.ts` + testes |
| Cross | Prompt global injetado | `buildSystemPrompt` |
| Cross | Rules injetadas no Workspace | mesmo path |
| Cross | Secrets/OAuth + MCP available/omitted | F09 smoke + `prepareMcpsForDispatch` |

---

## 6. Gaps de produto vs LionCodeLabs (candidatos à nova onda)

Agrupados para alimentar a entrevista do `/prd-writer`. Não são todos obrigatórios no mesmo release.

### Faixa A — Fechar o MVP mentiroso (P0)

1. Tool `load_skill` (MCP interno `engrenacode` ou equivalente)  
2. Worktree real **ou** remoção da opção falsa  
3. UI PR + (opcional) textgen de commit/PR  
4. Smoke `call_subagent` + idle timeout na UI  
5. Alinhar checkboxes §9 / PROGRESS

### Faixa B — Paridade de composer / git com o legado (P1)

6. Picker de modelo (e reasoning) na thread pai  
7. `@file` mentions  
8. Anexos de imagem (providers que suportam)  
9. “Commit, push & PR” unificado + mensagem por IA  
10. Seeds mínimos de skills/subagents (catálogo de onboarding)

### Faixa C — Roadmap pós-corte PRD §7 (P2 / ondas futuras)

11. Memory (`journal.md` / `memory.md`) + dreaming  
12. CodeGraph + tools `repo_graph_*`  
13. Slash commands (`/spec`) + `/featdevelop` + `/featbuild`  
14. Write-parallel subagents (worktree filho + merge-tree)  
15. GLM + Grok  
16. Ditado por voz (STT)  
17. Terminal PTY no dock  
18. AskUserQuestion  
19. Multi-VCS (GitLab/Bitbucket/Azure)  
20. UsageLimits / budgets

### Faixa D — Já no Engrena e melhor que o legado

- `#dashboard` agregada (inbox + saúde + métricas) como primeira tela pós-unlock

---

## 7. Onda 1.2 (decidida e documentada no PRD)

Corte **B (P0+P1)** promovido a Versão 1.2 em `docs/PRD.md` (F12–F17):

| ID | Nome | Prioridade |
|----|------|------------|
| F12 | Runtime de Skills (`load_skill`) | 1 |
| F13 | Isolamento Worktree | 1 |
| F14 | Fluxo Git Completo | 1 |
| F15 | Runtime de SubAgents | 1 |
| F16 | Composer Avançado | 2 |
| F17 | Catálogo Seed de Onboarding | 2 |

Fora desta onda (permanecem §7): Memory/dreaming, CodeGraph, slash/pipeline, voz, GLM/Grok, write-parallel.

---

## 8. Referências

- PRD: [`docs/PRD.md`](./PRD.md) §7 (fora de escopo) e §9 (critérios)  
- Progresso operacional: [`docs/PROGRESS.md`](./PROGRESS.md)  
- Legado: `C:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs` (`packages/server`, `packages/renderer`)  
- Evidências-chave Engrena:  
  - `src/services/runner/dispatch.ts` (`buildSystemPrompt`, MCP omit, subagent MCP)  
  - `src/services/runner/skill-registry.ts`  
  - `src/services/runner/delegate.ts` / `subagent-mcp-server.ts`  
  - `src/renderer/components/workspace/GitActions.tsx`  
  - `src/renderer/components/workspace/TaskComposer.tsx`
