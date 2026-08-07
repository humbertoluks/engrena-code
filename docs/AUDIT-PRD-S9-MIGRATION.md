# Auditoria PRD §9 — EngrenaCode vs LionCodeLabs

Matriz checkbox a checkbox dos critérios de aceitação em `docs/PRD.md` §9, com evidência no fonte do EngrenaCode e nota de paridade com o produto legado (LionCodeLabs).

**Data da auditoria original:** 2026-08-06  
**Data da revalidação (docs):** 2026-08-07 (pós F12–F17 + residuais de smoke)  
**Data desta reauditoria (solution):** 2026-08-07 (3ª passagem — F12 smoke live fechado; cruzamento PRD/PROGRESS/`docs/F12-*/smoke-results.md`)  
**Escopo:** critérios marcados no PRD + gaps de produto relevantes da migração  
**Método desta reauditoria:** (1) `grep` em `docs/PRD.md` §9 → **103 `[x]` / 0 `[ ]`**; (2) `docs/PROGRESS.md` + smoke-results F12/F13/F15; (3) soft residual F12 confirmado **PASS ao vivo** (`GIRASSOL-QUARTZO-4471` citado verbatim; sem `mcp.notice`)  
**Uso:** registro de fechamento da migração; priorização do próximo trabalho útil (ver §8 deste doc)

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
| **nova-feature** | Capacidade legada / desejada fora do critério atual; candidata a onda futura |

---

## 1. Resumo executivo

**Estado em 2026-08-07 (3ª passagem): §9 fechado — 103 `[x]` / 0 `[ ]`.** Nenhum FAIL. Soft gap F12 (`load_skill` live) **fechado** nesta passagem (`docs/F12-runtime-de-skills/smoke-results.md`). Confiança F05/F12: **alta**.

| Bloco | PASS | FAIL | OPEN / PARTIAL | DOC-LAG | Confiança |
|-------|------|------|----------------|---------|-----------|
| F01–F02, F01.1, F04, F08, F09, F10 | todos | 0 | 0 | 0 | alta |
| F03 Workspace | 6 (era 5+1 FAIL) | 0 | 0 | 0 | alta |
| F05 Skills | 3 (era 2+1 FAIL) | 0 | 0 | 0 | alta |
| F06 Rules | 3 | 0 | 0 | 0 | alta |
| F07 SubAgents | 4 (era 2+2 OPEN) | 0 | 0 | 0 | alta |
| F11 Consumo | 5 | 0 | 0 | 0 | alta |
| F12–F17 | todas | 0 | 0 | 0 | alta |
| Cross-Feature | 16+ | 0 | 0 | 0 | alta |

**Achados P0 da auditoria 2026-08-06 — status agora:**

1. ~~**F05** `load_skill` → FAIL~~ → **RESOLVIDO (F12)** + spawn Electron OK + **smoke live 2026-08-07** (`GIRASSOL-QUARTZO-4471`).
2. ~~**F03** participação F05–F07 → FAIL/PARTIAL~~ → **RESOLVIDO** (rules + F12 live + F15 E2E/idle).

**Achados P0 de produto — status agora:**

3. ~~worktree fantasma~~ → **RESOLVIDO (F13)** + residual `worktree_create_failed` UI+unit (2026-08-07).
4. ~~textgen commit/PR~~ → **RESOLVIDO (F14)**.
5. ~~Commit, push & PR~~ → **RESOLVIDO (F14)** incl. PR real `humbertoluks/engrenacode-f14-smoke#1`.
6. ~~composer model/reasoning~~ → **RESOLVIDO (F16)** (provider imutável pós-1º envio = escopo §7).

**Residuais fora de §9 do PRD (não bloqueiam):** copy provisória; nits de doc; caveat Windows path profundo em worktree — ver §6 e §8. Soft smoke F12 **não é mais residual**.

---

## 2. Matriz por feature (PRD §9)

Features sem mudança desde 2026-08-06 (F01, F01.1, F02, F04, F08, F09, F10) permanecem 100% PASS e não são repetidas aqui — ver auditoria original no histórico do git se precisar da matriz completa delas.

### F03. Workspace

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Cadastra projeto/thread Claude\|Codex\|Kimi + access + execution | `[x]` | **PASS** | + Minimax via F10 | — |
| Execution mode trava após 1º envio | `[x]` | **PASS** | `threads-handler` rejeita mudança | — |
| Streaming, tools, histórico, fila | `[x]` | **PASS** | WS + smoke F03 | — |
| Accept/reject; git bloqueado se running | `[x]` | **PASS** | `apply-diff`, `git-handler` | — |
| `thread_busy` na 2ª execução | `[x]` | **PASS** | lease `project-execution` | — |
| Skills/rules/subagents participam conforme F05–F07 | `[x]` | **PASS** (era FAIL) | Rules: `buildSystemPrompt`. Skills: `load_skill` live F12 (`smoke-results.md`). Subagents: `call_subagent` E2E + idle F15 | — |

**Nota fora do checkbox — status dos itens não-§9 da auditoria original:**

| Capacidade | Veredito | Evidência | Ação |
|------------|----------|-----------|------|
| `executionMode: worktree` cria worktree | **PASS** (era FAIL) | F13: `worktree.ts`, `dispatch.ts` persiste `worktreePath`, smoke real + residual de erro fechado | — |
| Commit / Commit & push / PR unificado + AI message | **PASS** (era PARTIAL) | F14: `GitActions.tsx` com as 3 ações + textgen; PR real criado e confirmado via API em 2026-08-07 | — |
| Modelo/reasoning mid-thread no pai | **PASS parcial por design** | F16: picker de model/reasoning no **follow-up**; provider segue imutável após o 1º envio, decisão deliberada de escopo (PRD §7 corta multi-provider mid-thread) | — |
| `@file`, imagens | **PASS** (era FAIL) | F16: `FileMentionMenu`, `ComposerImageAttachments` | — |
| voz, slash commands | ainda ausente | fora de escopo — PRD §7 (Faixa C) | **nova-feature** (roadmap) |

### F05. Skills

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| CRUD global name único | `[x]` | **PASS** | `#skills`, handlers | — |
| Vínculo por projeto no catálogo do turno | `[x]` | **PASS** | `createSkillSnapshot` + lista no prompt | — |
| `load_skill` entrega content sob demanda; skill não roda sozinha | `[x]` | **PASS** (era FAIL) | Runtime F12 + smoke live 2026-08-07 (`docs/F12-runtime-de-skills/smoke-results.md`) | — |

### F06. Rules

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Globais/projeto + override | `[x]` | **PASS** | | — |
| Bloco em todo turno com precedência | `[x]` | **PASS** (era DOC-LAG) | `RuleRegistry.composeBlockForTurn` + `buildSystemPrompt`; checkbox já corrigido no PRD | — |
| Name com CR/LF rejeitado | `[x]` | **PASS** | | — |

### F07. SubAgents

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| CRUD + vínculo `kind=dev` + providers | `[x]` | **PASS** | | — |
| `call_subagent` run efêmero; diffs filho na revisão do pai | `[x]` | **PASS** (era OPEN/PARTIAL) | Fechado em F15: smoke real contra binário `claude`, diff do filho confirmado na revisão do pai | — |
| Codex pai sem full-access não delega | `[x]` | **PASS** | `subagent-caller-gate.ts` | — |
| Idle timeout 20 min visível na UI | `[x]` | **PASS** (era OPEN/PARTIAL) | Fechado ao vivo em 2026-08-07 (`docs/F15-runtime-de-subagents/smoke-results.md`): `idleTimeoutMinutes=1` só no fixture de smoke, default de produto (20 min) inalterado; watchdog abortou o filho, UI foi a `status=timeout` com `text-amber` sem refresh manual | — |

**Nota vs legado:** write-parallel / child worktree / merge-tree / `kind=pipeline` continuam em PRD §7 (fora de escopo) — não são gap de §9.

### F11. Consumo

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| usage_event por turno agent/subagent | `[x]` | **PASS** (era PARTIAL) | Agent: smoke F03/F11. Subagent: turno live real confirmado em F15 | — |
| Drill-down + share subagents | `[x]` | **PASS** (era PARTIAL) | Share subagents = 55.5% confirmado real na thread de delegação de F15 | — |
| cost_source sdk/table | `[x]` | **PASS** | | — |
| Editar preço só nulls table | `[x]` | **PASS** | smoke F11 | — |
| Flags / empty / erro | `[x]` | **PASS** | | — |

### F12. Runtime de Skills (load_skill) — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Turno registra tool `load_skill`; agente obtém markdown sob demanda | `[x]` | **PASS** (confiança alta) | Smoke live 2026-08-07: `docs/F12-runtime-de-skills/smoke-results.md` — tool `mcp__engrenacode__load_skill — concluído`, frase distintiva `GIRASSOL-QUARTZO-4471` citada verbatim, sem `mcp.notice` | — |
| Nome ausente devolve erro de tool; skill desvinculada não carrega | `[x]` | **PASS** | | — |
| Snapshot congela no início do turno | `[x]` | **PASS** | | — |
| Skill não executa código; providers sem tool degradam com notice | `[x]` | **PASS** | | — |

### F13. Isolamento Worktree — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| 1º envio `executionMode=worktree` cria worktree real e persiste `worktreePath` | `[x]` | **PASS** | `docs/F13-isolamento-worktree/smoke-results.md` (2026-08-06) | — |
| Dispatch/diffs/git da thread usam `worktreePath`; `main` continua em `project.path` | `[x]` | **PASS** | `resolveThreadCwd` compartilhado | — |
| Falha de criação não executa o turno no path principal por engano | `[x]` | **PASS** (fechado ao vivo em 2026-08-07) | teste dedicado + exercitado via UI real (build empacotado + `playwright-cli`): alerta com mensagem exata do `copy.md`, thread `error`, `project.path` limpo | — |
| Apagar thread limpa worktree quando seguro; caso sujo retém e avisa | `[x]` | **PASS** | | — |

### F14. Fluxo Git Completo — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| UI expõe Commit / Commit & push / Commit, push & PR bloqueados com thread running | `[x]` | **PASS** | `docs/PROGRESS.md` F14 | — |
| "Gerar com IA" preenche subject (e title/body de PR) via provider da thread | `[x]` | **PASS** | `git-textgen.ts` | — |
| PR sucesso devolve URL abrível; ausência de token aponta pra Configuração | `[x]` | **PASS** (fechado ao vivo em 2026-08-07) | PR real criado e confirmado via API do GitHub contra repo scratch dedicado (`humbertoluks/engrenacode-f14-smoke#1`) | — |
| Falha de textgen não impede commit manual | `[x]` | **PASS** | | — |

### F15. Runtime de SubAgents — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| `call_subagent` contra binário real cria run efêmero; resultado volta ao pai | `[x]` | **PASS** | `docs/PROGRESS.md` F15 | — |
| Diffs do filho aparecem na mesma revisão Diff do pai | `[x]` | **PASS** | | — |
| Idle timeout encerra run com status `timeout` visível na UI | `[x]` | **PASS** (fechado ao vivo em 2026-08-07) | `docs/F15-runtime-de-subagents/smoke-results.md` — watchdog + `text-amber` sem refresh manual | — |
| Delegação real gera usage_event source=subagent com share > 0 | `[x]` | **PASS** | share 55.5% em `#consumo` | — |

### F16. Composer Avançado — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Modelo/reasoning editáveis no follow-up; provider imutável | `[x]` | **PASS** | `docs/PROGRESS.md` F16 | — |
| `@` lista arquivos do projeto, insere path relativo, rejeita fora do projeto | `[x]` | **PASS** (por construção — menu só lista dentro de `project.path`) | | — |
| Até 5 imagens ≤ 4 MiB quando multimodal; senão CTA desabilitado com motivo | `[x]` | **PASS** (fechado ao vivo em 2026-08-07) | CTA com `title` exato confirmado via DOM em provider não-multimodal | — |
| Anexos/menções seguem no prompt e aparecem no histórico | `[x]` | **PASS** (fechado ao vivo em 2026-08-07) | `MessageImageThumbs` confirmado em 2 turnos reais, light/dark | — |

### F17. Catálogo Seed de Onboarding — nova desde a auditoria original

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| 1º unlock (ou migração) insere seeds sem duplicar em re-unlock | `[x]` | **PASS** | `docs/PROGRESS.md` F17 | — |
| Contagens `#skills`/`#subagents`/Dashboard refletem os seeds | `[x]` | **PASS** | 12 skills + 8 subagents confirmados no smoke | — |
| Name já existente é skipped; usuário edita/desabilita/exclui como itens normais | `[x]` | **PASS** | | — |
| Seeds não vinculam projetos automaticamente | `[x]` | **PASS** | | — |

---

## 3. Integração Cross-Feature

| Checkbox PRD | Estado PRD | Veredito | Evidência | Ação |
|--------------|------------|----------|-----------|------|
| Tokens F01.1 em `#configuracao` | `[x]` | **PASS** | | — |
| Tokens/Shiki/markdown no Workspace | `[x]` | **PASS** | | — |
| Tokens F01.1 em F04–F11 | `[x]` | **PASS** (era OPEN) | smokes light/dark por tela em cada feature | — |
| Tema persiste entre `#dashboard` / `#configuracao` / workspace | `[x]` | **PASS** (era OPEN) | re-verificação cross-nav fechada | — |
| Status F02 → Dashboard + Workspace | `[x]` | **PASS** | | — |
| Prompt global F02 injetado no turno | `[x]` | **PASS** (era DOC-LAG) | `buildSystemPrompt` lê `prompt:global` | — |
| Skills via `load_skill` no Workspace | `[x]` | **PASS** (era FAIL real) | Fechado em F12 + smoke live | — |
| Rules injetadas em todo turno | `[x]` | **PASS** (era DOC-LAG) | `composeBlockForTurn` | — |
| SubAgents devolvem resultado + diffs na revisão do pai | `[x]` | **PASS** (era OPEN) | Fechado em F15 | — |
| F03 alimenta Dashboard | `[x]` | **PASS** | | — |
| Contagens F05–F07 no Dashboard | `[x]` | **PASS** | | — |
| Eventos F03 → Registros | `[x]` | **PASS** | | — |
| Vault+vínculo → MCP available/omitted | `[x]` | **PASS** (era DOC-LAG) | prepareMcps + OAuth Linear + banner omit | — |
| API keys F10 resolvíveis no Workspace | `[x]` | **PASS** | | — |
| usage_events F03/F07/F15 agregam em Consumo | `[x]` | **PASS** (era PARTIAL) | share subagent real confirmado (F15) | — |
| Tool `load_skill` (F12) entrega content no dispatch do Workspace | `[x]` | **PASS** | Smoke live F12 confirma content real no turno | — |
| WorktreePath (F13) isola cwd de dispatch/diffs/git | `[x]` | **PASS** (novo item, pós-F13) | | — |
| GitActions (F14) consome token GitHub + estado da thread | `[x]` | **PASS** (novo item, pós-F14) | | — |
| Composer (F16) envia model/reasoning/@file/imagens no follow-up | `[x]` | **PASS** (novo item, pós-F16) | | — |
| Seeds (F17) aparecem nas contagens do Dashboard e em F05/F07 | `[x]` | **PASS** (novo item, pós-F17) | | — |

---

## 4. Checkboxes `[x]` indevidos

**Nenhum.** Os dois casos da auditoria de 2026-08-06 (F05 `load_skill`, F03 participação) foram fechados em F12/F15; F12 ganhou smoke live dedicado em 2026-08-07.

---

## 5. Checkboxes `[ ]` que o código já cumpre (DOC-LAG)

**Nenhum.** `docs/PRD.md` não tem nenhuma linha `- [ ]` restante (`grep -n "^\- \[ \]" docs/PRD.md` vazio). Os quatro DOC-LAG da auditoria original (F06 bloco de rules, prompt global, rules no Workspace, MCP available/omitted) já foram corrigidos para `[x]` no PRD antes desta revalidação.

---

## 6. Gaps de produto vs LionCodeLabs (candidatos à próxima onda)

### Faixa A — Fechar o MVP mentiroso (P0) — **feita**

1. ~~Tool `load_skill`~~ → **feito** (F12)
2. ~~Worktree real ou remoção da opção falsa~~ → **feito, worktree real** (F13)
3. ~~UI PR + textgen de commit/PR~~ → **feito, incluindo PR real** (F14)
4. ~~Smoke `call_subagent` + idle timeout na UI~~ → **feito** (F15, idle timeout fechado ao vivo em 2026-08-07)
5. ~~Alinhar checkboxes §9 / PROGRESS~~ → **feito** — zero `[ ]` restantes; esta revalidação é a prova

### Faixa B — Paridade de composer / git com o legado (P1) — **feita**

6. ~~Picker de modelo (e reasoning) na thread pai~~ → **feito, no follow-up** (F16; provider imutável após 1º envio é decisão de escopo, não gap)
7. ~~`@file` mentions~~ → **feito** (F16)
8. ~~Anexos de imagem~~ → **feito** (F16)
9. ~~"Commit, push & PR" unificado + mensagem por IA~~ → **feito** (F14)
10. ~~Seeds mínimos de skills/subagents~~ → **feito** (F17)

**Copy pendente (não bloqueia §9, cosmético):** alguns slots de copy seguem com texto funcional provisório em vez de copy final revisado — `docs/PROGRESS.md` documenta cada um: F04 (`dashboard.subtitle`, `dashboard.banner.setupIncomplete`, títulos de seção), F14 (`git.cta.generateAi`, `git.label.*`, `git.hint.subjectMax`, `git.stage.openingPr`), F16 (`composer.image.disabled.multimodal`, `composer.mention.error.outsideProject`). Nenhum desses é um checkbox de §9 — são strings provisórias funcionais, não bugs.

**Outros nits da reauditoria 2026-08-07 (solution):**

| Nit | Severidade | Nota |
|-----|------------|------|
| Soft smoke F12 `load_skill` live | ~~baixa~~ → **fechado** | `docs/F12-runtime-de-skills/smoke-results.md` (2026-08-07) |
| `smoke-results.md` ausente para F14/F16 | doc | Evidência vive em `PROGRESS.md` (assimétrico vs F13/F15) |
| Esclarecimentos antigos F03/F11 em `PROGRESS.md` | doc stale | Ainda narram gaps já fechados (histórico); não revertem §9 |
| Windows `$GIT_DIR too big` em worktree + userData profundo | ambiente | Visto no smoke F14; PR rodou em `executionMode=main` |

### Faixa C — Roadmap pós-corte PRD §7 (P2 / ondas futuras) — **inalterada, fora do escopo desta revalidação**

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

## 7. Onda 1.2 (F12–F17) — feita e fechada

Corte **B (P0+P1)**, promovido a Versão 1.2 em `docs/PRD.md`, está **100% feito** com smoke real por feature:

| ID | Nome | Prioridade | Status |
|----|------|------------|--------|
| F12 | Runtime de Skills (`load_skill`) | 1 | **Feito**, incl. smoke live `claude`→`load_skill` |
| F13 | Isolamento Worktree | 1 | **Feito** |
| F14 | Fluxo Git Completo | 1 | **Feito**, incl. PR real |
| F15 | Runtime de SubAgents | 1 | **Feito**, incl. idle timeout ao vivo |
| F16 | Composer Avançado | 2 | **Feito** |
| F17 | Catálogo Seed de Onboarding | 2 | **Feito** |

Fora desta onda (permanecem PRD §7, Faixa C acima): Memory/dreaming, CodeGraph, slash/pipeline, voz, GLM/Grok, write-parallel.

---

## 8. Próximo trabalho útil (priorizado)

Ordem recomendada após a 3ª passagem. Nenhum item reabre §9 como FAIL. Soft smoke F12 **feito**.

| # | Trabalho | Por quê | Esforço |
|---|----------|---------|---------|
| **1** | Passe de copy F04 / F14 / F16 | Remove cheiro de provisório na UI; não é bug | 1 PR cosmético |
| **2** | Entrevista `/prd-writer` → Faixa C (PRD §7) | Decide Memory/CodeGraph/slash/voz/etc. sem chute de escopo | produto |
| — | Nits de doc (Esclarecimentos F03/F11 stale; `smoke-results` F14/F16) | Higiene; F12 agora tem `smoke-results.md` | baixo |
| — | Caveat Windows worktree + path profundo | Só se voltar a doer no dia a dia | investigativo |

---

## 9. Referências

- PRD: [`docs/PRD.md`](./PRD.md) §7 (fora de escopo) e §9 (critérios — zero `[ ]` restantes em 2026-08-07)
- Progresso operacional: [`docs/PROGRESS.md`](./PROGRESS.md)
- Legado: `C:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs` (`packages/server`, `packages/renderer`)
- Smoke-results por feature: `docs/F02-*/`, `docs/F03-*/`, `docs/F06-*/`, `docs/F09-*/`, `docs/F11-*/`, `docs/F12-*/`, `docs/F13-*/`, `docs/F15-*/smoke-results.md` (F14/F16: evidência em PROGRESS)
- Evidências-chave Engrena:
  - `src/services/runner/dispatch.ts` (`buildSystemPrompt`, MCP omit, subagent MCP)
  - `src/services/runner/skill-registry.ts` / `subagent-mcp-server.ts` (F12)
  - `src/services/runner/delegate.ts` (F11/F15 — idle/hard-cap/diffs unificados)
  - `src/services/git/worktree.ts` (F13)
  - `src/services/git/git-textgen.ts` / `src/renderer/components/workspace/GitActions.tsx` (F14)
  - `src/renderer/components/workspace/ComposerModelControls.tsx` / `FileMentionMenu.tsx` / `ComposerImageAttachments.tsx` (F16)
  - `src/services/seeds/catalog.ts` / `apply-catalog.ts` (F17)
