# Plano de Implementação: Rules

**Feature:** F06  
**Complexidade:** médio  
**Fases:** 4 (+ fechamento)  
**Status:** Pronto para dev  
**UI:** `docs/F06-rules/ui.md`  
**Spec:** `docs/F06-rules/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão
- ✓ F01.1 Design System + tema
- SQLite `engrenacode.db` (introduzir aqui se F03 ainda não tiver bootstrap; senão estender migrações F03)
- Delta: tabelas `rules` / `project_rules`; tela `#rules`; registry de resolve para o runner

---

## Fase 1: Persistência e API

**1. Migração e repositório** - Criar schema `rules` + `project_rules` e repositório com CRUD, links e query `resolveForTurn` (semântica D1/D2 da spec).

**2. Handler HTTP** - Expor rotas `/api/rules` e `/api/projects/:id/rules` (+ counts) com sessão F01, validação de name e 409 de conflito.

**3. Bloco de injeção** - Implementar `rules-block` + `rule-registry` (compose EngrenaCode; `null` se vazio).

---

## Fase 2: Tela `#rules`

**4. Cliente e rota** - `rules-service` + hash `#rules` na navegação do `App`.

**5. RulesScreen + form** - Lista, create/edit/delete/toggle, empty/error, validação de name e avisos de KB conforme `ui.md`.

---

## Fase 3: Workspace e runner

**6. ProjectRulesModal** - Vínculo/supressão no Repo Harness do Workspace (quando `#principal` existir); rodapé de contagem + soft warn >15.

**7. Hook no turn-runner** - Chamar `resolveForTurn` e prepend do bloco em todo turno do projeto (no-op seguro se runner F03 ainda stub).

---

## Fase 4: Validação e fechamento

**8. Validação e fechamento** - Executar testes da spec (unitário + smoke). Confirmar critérios PRD §9 F06. Verificar light/dark e copy vs `ui.md`. Gate: `pnpm test` e `tsc -b` verdes. Cross-feature F03/F04 permanece deferred onde marcado.
