# Plano de Implementação: Runtime de Skills (load_skill)

**Feature:** F12  
**Complexidade:** simples  
**Fases:** 3  
**Status:** Pronto para dev  
**Spec:** `docs/F12-runtime-de-skills/spec.md`

---

## Pré-requisitos

- ✓ F01.1 Design System (tokens; notice WS existente)
- ✓ F03 Workspace / dispatch + `--mcp-config`
- ✓ F05 Skills (CRUD, vínculo, `createSkillSnapshot`)
- ✓ F11 MCP interno `engrenacode` + `call_subagent` (padrão a estender)

---

## Fase 1: Snapshot + MCP `load_skill`

**1. skill-registry** - Exportar `LOAD_SKILL_TOOL_NAME` e `writeSkillSnapshotFile(snapshot)` gravando JSON `{ skills: Record<name, content> }` em userData.

**2. MCP interno** - Estender o script stdio para listar/chamar `load_skill` quando `--skills-snapshot` estiver presente; manter `call_subagent` quando `--port`/`--token` existirem; expor `buildEngrenaCodeMcpDef` (alias/compat de `buildSubagentMcpDef`).

**3. Testes MCP** - Subprocesso real: list, load sucesso, load erro, dual tools.

---

## Fase 2: Wiring no dispatch

**4. runTurn** - Criar snapshot uma vez; se catálogo ≥ 1 e provider MCP-ok, escrever arquivo e incluir no MCP `engrenacode` (unificado com delegação se houver subagents); se provider unsupported, emitir `mcp.notice` e manter só o catálogo no prompt.

**5. System prompt** - Citar `LOAD_SKILL_TOOL_NAME` no bloco de skills.

**6. Testes dispatch** - Skill vinculada → `mcpServers` com `engrenacode`; minimax → notice sem MCP interno de skills.

---

## Fase 3: Validação e fechamento

**7. Gate** - `pnpm test` (runner) + `tsc -b` verdes.

**8. Docs** - Marcar critérios F12 e cross-feature load_skill no `docs/PRD.md` §9; atualizar `docs/PROGRESS.md` com F12.
