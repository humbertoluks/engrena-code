# Plano de Implementação: Skills

**Feature:** F05  
**Complexidade:** médio  
**Fases:** 4 (+ fechamento)  
**Status:** Pronto para dev  
**UI:** `docs/F05-skills/ui.md`  
**Copy:** `docs/F05-skills/copy.md`  
**Spec:** `docs/F05-skills/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão
- ✓ F01.1 Design System + tema
- SQLite `engrenacode.db` (bootstrap F03/F06 ou introduzir nesta feature se ainda ausente)
- Frontend: seguir anatomia/estados de `ui.md` e strings de `copy.md` (sem reinventar copy)
- Delta: tabelas skills; tool `mcp__engrenacode__load_skill`; soft warn ≤30 vínculos

---

## Fase 1: Persistência e API

**1. Migração e repositório** - Criar `skills` + `project_skills` e queries de CRUD, vínculo e `resolveForProject` (sem `locked` / sem trigger command).

**2. Handler HTTP** - Expor `/api/skills`, vínculos de projeto, `catalog-order` e counts; validar name único e teto de content.

**3. Skill registry** - Montar catálogo do turno e snapshot name→content para a tool `load_skill`.

---

## Fase 2: Tela `#skills`

**4. Cliente e rota** - `skills-service` + hash `#skills` na navegação.

**5. SkillsScreen + form** - Lista, busca, categorias, CRUD/toggle/delete conforme ui.md; copy via ids de `copy.md`; soft warn 200 e hard block 1 MiB.

---

## Fase 3: Vínculo e runner

**6. ProjectSkillsModal** - Overlay no Repo Harness (F03): link, enabled, reorder, warn >30 (`skillsLink.warn.cap`).

**7. Tool no turn-runner** - Registrar `mcp__engrenacode__load_skill` e alimentar catálogo a partir do registry (no-op seguro se runner ainda stub).

---

## Fase 4: Validação e fechamento

**8. Validação e fechamento** - Executar testes da spec (unitário + smoke). Confirmar critérios PRD §9 F05. Verificar light/dark e copy vs `ui.md`/`copy.md`. Gate: `pnpm test` e `tsc -b` verdes. Cross-feature F03/F04 deferred onde marcado.
