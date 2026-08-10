# F12 Smoke Results — load_skill ao vivo

**Feature:** F12 Runtime de Skills (`load_skill`) — soft residual da reauditoria (`docs/AUDIT-PRD-S9-MIGRATION.md` §8 #1, `docs/PROGRESS.md` "Smoke live opcional")
**Data:** 2026-08-07
**Ambiente:** `pnpm dev` (Electron real, `dangerouslyDisableSandbox`) com `ENGRENACODE_USER_DATA` isolado (tmp) + Playwright em `http://localhost:5173` (mesmo bundle do renderer servido pelo Electron); provider real `claude` (sessão de assinatura já logada no binário — `ANTHROPIC_API_KEY` unset); access level `full-access` (necessário — `auto-accept-edits` não libera tool MCP sem autorização interativa, mesmo achado documentado no smoke de idle timeout de F15)

## Objetivo

O runtime de F12 já registra `mcp__engrenacode__load_skill` (MCP interno `engrenacode`, snapshot por turno, `ELECTRON_RUN_AS_NODE=1` — path compartilhado com F15/`call_subagent`), com cobertura unitária e de subprocesso MCP. Faltava a prova ao vivo: um turno real contra o binário `claude` em que o agente chame `load_skill` e receba o markdown de verdade.

## Setup

- Skill fixture `load-skill-smoke-f12` com conteúdo contendo uma frase distintiva não-genérica (`GIRASSOL-QUARTZO-4471`) — escolhida para que uma citação correta na resposta do agente só seja possível se o content real veio da tool (não é algo que o modelo inventaria sozinho).
- Vinculada e habilitada no projeto fixture via Repo Harness → Skills.
- Thread nova, provider `claude`, `executionMode=main`, access level `full-access` definido **antes** do primeiro envio (access level é imutável após o primeiro envio da thread — mesma restrição documentada no smoke de F15).
- Prompt do usuário instruiu explicitamente a chamar `mcp__engrenacode__load_skill` com `name="load-skill-smoke-f12"` e citar literalmente a frase distintiva do resultado, sem inventar.

## Resultado — PASS

| Critério | Esperado | Resultado |
|----------|----------|-----------|
| Tool call aparece no histórico/timeline | `mcp__engrenacode__load_skill` listado no turno | pass — bloco `mcp__engrenacode__load_skill — concluído` visível na timeline |
| Resultado da tool contém o markdown real | Content do snapshot, não erro de nome ausente | pass — resposta do agente citou `GIRASSOL-QUARTZO-4471` verbatim (frase só existe no content da skill) |
| Resposta do agente cita o trecho distintivo | Sem invenção | pass — `"Frase: **GIRASSOL-QUARTZO-4471**. load_skill funcionou."` |
| Turno completa sem `mcp.notice` de spawn/falha do MCP `engrenacode` | Sem banner de erro/indisponibilidade | pass — nenhum notice, thread terminou `idle` (sucesso) |
| Console do navegador | Sem erros/warnings | pass — 0 erros, 0 warnings (só o log padrão de dev do React DevTools) |

Screenshot da timeline (tool call + resposta) tirado e descartado ao final (efêmero, smoke local — não versionado).

## Notas

- Confirma-se de novo (já visto no smoke de idle timeout de F15) que o access level `auto-accept-edits` não libera chamadas de tool MCP sem aprovação interativa — só `full-access` (`bypassPermissions`) funciona em automação headless sem stdin. Não é específico de F12; vale para qualquer tool MCP do turno.
- Nenhum código foi alterado nesta rodada — o runtime já estava correto (`buildEngrenaCodeMcpDef` com `skillsSnapshotPath` + `ELECTRON_RUN_AS_NODE=1`, `LOAD_SKILL_TOOL_NAME` = `mcp__engrenacode__load_skill`); este smoke só fecha a prova ao vivo que faltava.
- Fixture (`ENGRENACODE_USER_DATA` isolado, projeto git temporário, skill `load-skill-smoke-f12`) removido ao final; vault/userData reais do usuário não foram tocados.

## Critério (soft gap fechado)

| Critério | Status |
|----------|--------|
| Turno real com binário `claude` chama `load_skill` e recebe o markdown correto, sem `mcp.notice` de falha | **pass** (confirmado ao vivo nesta rodada) |
