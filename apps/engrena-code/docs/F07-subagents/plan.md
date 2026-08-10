# Plano de Implementação: SubAgents

**Feature:** F07  
**Complexidade:** complexo  
**Fases:** 5 (+ fechamento)  
**Status:** Pronto para dev  
**UI:** `docs/F07-subagents/ui.md`  
**Copy:** `docs/F07-subagents/copy.md`  
**Spec:** `docs/F07-subagents/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão
- ✓ F01.1 Design System + tema
- SQLite `engrenacode.db` (bootstrap F03/F05/F06 ou introduzir nesta feature se ainda ausente)
- Frontend: anatomia/estados de `ui.md` e strings de `copy.md` (sem bloco “Fora do Escopo Central”)
- Delta: tabelas subagents/runs; tool `call_subagent`; idle 20 min / hard 2 h; gate Codex full-access; soft warn ≤10

---

## Fase 1: Persistência e API

**1. Migração e repositório** - Criar `subagents`, `project_subagents` e `subagent_runs` (schema enxuto da spec) com CRUD, vínculo, resolve e persistência de runs.

**2. Handler HTTP** - Expor `/api/subagents`, vínculos de projeto, `catalog-order` kind=subagents e counts; validar providers MVP, name único e teto de prompt.

---

## Fase 2: Tela `#subagents`

**3. Cliente e rota** - `subagents-service` + hash `#subagents` na navegação.

**4. SubagentsScreen + form** - Lista, busca, filtro de modelo, categorias e CRUD conforme ui.md; form sem Pipeline/MCPs/Skills/network/providers extras; copy via `copy.md`; hard block 1 MiB.

---

## Fase 3: Vínculo por projeto

**5. ProjectSubagentsModal** - Overlay no Repo Harness (F03): link, enabled, reorder via catalog-order, soft warn ≤10 (`subagentsLink.warn.cap`).

---

## Fase 4: Runtime e observação

**6. Registry e call_subagent** - Catálogo do turno, tool `mcp__engrenacode__call_subagent`, delegate com idle/hard timeout e gate Codex full-access (no-op seguro se runner ainda stub).

**7. Activity, timeline e audit** - Sidebar SubagentActivity, bloco aninhado com status `timeout`, modal de auditoria; embutir runs no history da thread; emitir usage `source=subagent` no completion.

---

## Fase 5: Validação e fechamento

**8. Validação e fechamento** - Executar testes da spec (unitário + smoke). Confirmar critérios PRD §9 F07. Verificar light/dark e copy vs `ui.md`/`copy.md`. Gate: `pnpm test` e `tsc -b` verdes. Cross-feature F03/F04/F11 deferred onde marcado.
