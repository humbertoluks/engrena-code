# Plano de Implementação: Rules

**Feature:** F06  
**Complexidade:** médio  
**Fases:** 4 (+ fechamento)  
**Status:** Pronto para dev  
**UI:** `docs/F06-rules/ui.md`  
**Copy:** `docs/F06-rules/copy.md`  
**Spec:** `docs/F06-rules/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão
- ✓ F01.1 Design System + tema
- SQLite `engrenacode.db` (bootstrap F03/F05 ou introduzir nesta feature se ainda ausente)
- Frontend: seguir anatomia/estados de `ui.md` e strings de `copy.md` (sem reinventar copy)
- Delta: tabelas rules; dual semantics global/override; bloco `composeRulesBlock`; soft warn ≤15 / 8 KB / 16 KB; hard 1 MiB

---

## Fase 1: Persistência e API

**1. Migração e repositório** - Criar `rules` + `project_rules` e queries de CRUD, vínculo/override (default-on para globais; DELETE na reativação) e `resolveForTurn`.

**2. Handler HTTP** - Expor `/api/rules`, endpoints de projeto e counts; validar name sem CR/LF, conflito de nome e teto de content.

**3. Rule registry e bloco** - Montar resolução por projeto e `composeRulesBlock` com preamble EngrenaCode e delimitadores estáveis (contrato para F03).

---

## Fase 2: Tela `#rules`

**4. Cliente e rota** - `rules-service` + hash `#rules` na navegação.

**5. RulesScreen + form** - Lista, busca, categorias, CRUD/toggle/delete conforme ui.md; copy via ids de `copy.md`; soft warn 8 KB e hard block 1 MiB; name inválido inline.

---

## Fase 3: Overlay projeto e harness

**6. ProjectRulesModal** - Overlay no Repo Harness (F03): seção Globais (supressão) ≠ Deste projeto (vínculo + on/off); rodapé agregado 16 KB; soft warn ≤15 (`rulesLink.warn.activeCap`); pré-vínculo ao criar não-global.

**7. Integração no turn-runner** - Registrar consumo do registry/bloco no turno (no-op seguro se runner ainda stub).

---

## Fase 4: Validação e fechamento

**8. Validação e fechamento** - Executar testes da spec (unitário + smoke). Confirmar critérios PRD §9 F06. Verificar light/dark e copy vs `ui.md`/`copy.md`. Gate: `pnpm test` e `tsc -b` verdes. Cross-feature F03/F04 deferred onde marcado.
