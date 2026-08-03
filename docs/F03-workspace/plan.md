# Plano de Implementação: Workspace

**Feature:** F03  
**Complexidade:** complexo  
**Fases:** 5 (+ fechamento)  
**Status:** Pronto para dev  
**UI:** `docs/F03-workspace/ui.md`  
**Spec:** `docs/F03-workspace/spec.md`

---

## Pré-requisitos

- ✓ F01 Vault + sessão (`x-engrenacode-session`)
- ✓ F01.1 Design System + tema + Shiki/xterm helpers
- ✓ F02 Configuração MVP (status providers, `prompt:global`, `github:token`)
- ✓ HTTP loopback `5174` + Vitest
- Delta desta feature: `better-sqlite3` (ou equivalente nativo SQLite), WebSocket no server loopback, dialog de pasta no Electron
- F05–F07 não implementados: usar stubs de contagem/vínculo (spec §5.5); turno sem load_skill/rules/subagent reais

---

## Fase 1: Persistência e contratos HTTP base

**1. Bootstrap SQLite** - Adicionar client + migração `001_workspace_core` e repositórios de projects/threads/messages/diffs/leases conforme modelo da spec.

**2. Handler de projetos** - Expor list/add/delete, git-init e vcs-status sob `/api/projects`, com sessão F01 e regras de path (sem exigir `.git` no add).

**3. Stubs de catálogo** - Expor GET de contagens/listas vazias de skills (e shapes rules/subagents) para a sidebar Ambiente não quebrar antes de F05–F07.

---

## Fase 2: Threads, lease e streaming

**4. Dispatch e follow-up** - Implementar criar thread no primeiro envio e POST de mensagens, com lease por projeto e respostas 409 `thread_busy`.

**5. Hub WebSocket** - Registrar upgrade WS na porta do server; emitir eventos tipados por `threadId` com `seq`.

**6. Turn runner mínimo** - Orquestrar um turno via CLI/provider já configurado em F02, persistir histórico/tool calls e publicar no hub (detalhes na spec).

**7. Histórico, cancel e permission** - Endpoints de history/cancel/permission Supervised wired ao estado da thread.

---

## Fase 3: Diffs e GitHub

**8. Diffs por arquivo** - Persistir pending e expor GET + accept/reject com subset `diffIds`/`paths` (omitido = lote).

**9. Git mutável** - Commit, push, PR e git-text usando `github:token` do vault; bloquear com thread running / lease.

**10. Gate git no composer** - Fluxo `git-init` quando projeto sem HEAD, com copy EngrenaCode da ui.md.

---

## Fase 4: UI `#principal`

**11. Shell e rota** - Ligar `#principal` no `App.tsx` e montar grid de 3 colunas conforme anatomia da ui.md.

**12. Sidebars e projetos** - ProjectTree, AddProjectModal (browse IPC), empty states e Nova Thread (limpa seleção).

**13. Chat, composer e fila** - TaskComposer com pills Access/Execution, locks pós-primeiro envio, fila `engrenacode.message-queue.v1`, Parar, e gate de provider via `/api/config/status`.

**14. DiffViewer e GitActions** - Abas Histórico/Prompt/Diff; accept/reject por arquivo; git disabled quando busy.

**15. WorkspaceSidebar Ambiente** - Mostrar stubs de contagem skills/vínculos (zeros) sem CRUD.

---

## Fase 5: Validação e fechamento

**16. Validação e fechamento** - Executar a estratégia de testes da spec (unitário + smoke). Confirmar critérios de aceitação PRD §9 (com integração F05–F07 marcada deferred). Verificar light/dark e copy vs `ui.md`. Gate: `pnpm test` e `tsc -b` / build verdes.
