# Plano de Implementação: Workspace

**Feature:** F03 Workspace (`#principal`)  
**Complexidade:** complexo  
**Escopo:** Central only  
**UI:** `docs/F03-workspace/ui.md` · `copy.md` · `ui/principal-referencia.png`  
**Spec:** `docs/F03-workspace/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão (`x-engrenacode-session`)
- ✓ F01.1 Design System + tema + Shiki/xterm helpers
- ✓ F02 Configuração MVP (status providers, `prompt:global`, `github:token`)
- ✓ F05 Skills (CRUD, vínculos, `skill-registry`, `ProjectSkillsModal`)
- ✓ F06/F07 código + unitários no tree (`rule-registry`, `subagent-registry`, screens/handlers); smoke/§9 ainda pendentes — gate de smoke F03 de turno após ou em paralelo com smoke F06/F07

- ✓ HTTP loopback `5174` + Vitest + `node:sqlite` / `engrenacode.db`
- Delta desta feature: migration workspace, WebSocket no server loopback, IPC dialog de pasta, UI `#principal`
- Não adicionar `better-sqlite3`

---

## Fase 1: Persistência e contratos HTTP base

**1. Migration workspace** - Registrar migration de projects/threads/messages/tool_calls/diffs em `engrenacode.db` e repositórios conforme modelo da spec.

**2. Handler de projetos** - Expor list/add/delete, git-init e vcs-status sob `/api/projects`, com sessão F01 e path sem exigir `.git` no add.

**3. Wire no unlock server** - Montar o handler de projetos no loopback existente ao lado de config/skills/rules/subagents.

---

## Fase 2: Threads, lease e streaming

**4. Lease por projeto** - Implementar acquire/release in-memory e respostas 409 `thread_busy` nos pontos da spec.

**5. Dispatch e follow-up** - Criar thread no primeiro envio e POST de mensagens; travar executionMode; rejeitar `provider` no follow-up.

**6. Hub WebSocket** - Upgrade WS na porta 5174 com auth de sessão; emitir eventos tipados por `threadId`.

**7. Turn runner** - Orquestrar turno via providers F02, injetar prompt global, resolver F05–F07, persistir histórico/tools e publicar no hub.

**8. History, cancel e permission** - Endpoints de history/cancel/permission Supervised ligados ao estado da thread.

---

## Fase 3: Diffs e GitHub

**9. Diffs por arquivo** - Persistir pending e expor GET + accept/reject com subset `ids`/`paths` (omitido = lote; apply parcial).

**10. Git mutável** - Commit, push e PR com `github:token` do vault; **todos** sob o mesmo lease (incluindo push).

**11. Gate git no composer** - Fluxo `git-init` quando projeto sem HEAD, com copy EngrenaCode.

---

## Fase 4: UI `#principal`

**12. Shell e rota** - Ligar `#principal` no `App.tsx` e montar grid de 3 colunas conforme anatomia da `ui.md`.

**13. Sidebars e projetos** - ProjectTree, AddProjectModal (browse IPC), empty states e Nova Thread (limpa seleção).

**14. Chat, composer e fila** - TaskComposer com pills Access/Execution, locks pós-primeiro envio, fila local, Parar, e gate via `/api/config/status`.

**15. DiffViewer e GitActions** - Abas Histórico/Prompt/Diff; accept/reject por arquivo; git disabled quando busy.

**16. Repo Harness** - Montar modais reais F05–F07 e counts/vínculos existentes (sem stubs zeros).

---

## Fase 5: Validação e fechamento

**17. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + smoke). Confirmar critérios de aceitação PRD §9 F03 e cross-feature marcados ready. Verificar light/dark, anatomia vs `ui.md` e strings vs `copy.md`. Gate: `pnpm test` e `tsc -b` / build verdes.
