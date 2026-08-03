# Spec SDD: Workspace

> Selo 🟡 PLANEJADO. Componente do EngrenaCode.

**Componente:** workspace
**Feature:** F03
**Versão alvo:** MVP
**Data:** 2026-07-31T10:45:00Z

## 1. Problema
🟡 Conversa, diff e Git ficam em lugares diferentes; o usuário precisa de um workspace único com streaming, revisão arquivo a arquivo e fluxo GitHub, com no máximo uma execução longa por projeto.

## 2. Objetivos
🟡 Cadastrar projetos locais, criar threads com provider/access/execution mode, streamar turnos, revisar diffs (accept/reject), integrar skills/rules/subagents e fazer commit/push/PR com lease `thread_busy`.

## 3. Não-objetivos
🟡 Multi-provider na mesma thread; pipelines/featbuild; memory/codegraph; terminal PTY; contadores MCP na sidebar antes de F09; provider Minimax antes de F10.

## 4. Requisitos funcionais
- 🟡 **RF-01:** Usuário cadastra pasta local como projeto; `git init` opcional se não for repo; orientação 10–15 repos ativos (sem teto duro).
- 🟡 **RF-02:** Thread escolhe 1 provider entre Claude, Codex, Kimi; access level `supervised` | `auto-accept-edits` | `full-access`; execution mode `main` | `worktree`.
- 🟡 **RF-03:** Execution mode trava após o primeiro envio da thread.
- 🟡 **RF-04:** Streaming de mensagens, status de tool calls e histórico persistente; follow-up enfileirável se a thread estiver ocupada.
- 🟡 **RF-05:** Diffs por arquivo com estados `pending` | `accepted` | `rejected`; accept/reject antes de gravar no disco conforme access level.
- 🟡 **RF-06:** No máximo 1 execução longa running por projeto; conflito → 409 `thread_busy`.
- 🟡 **RF-07:** Git mutável (commit/push/PR) bloqueado enquanto a thread estiver running.
- 🟡 **RF-08:** Commit, push e abrir PR no GitHub a partir do workspace (depende de PAT em F02).
- 🟡 **RF-09:** Skills, rules e subagents vinculados participam do turno conforme F05–F07.
- 🟡 **RF-10:** Codex como pai de subagent exige `full-access` explícito.
- 🟡 **RF-11:** Provider indisponível desabilita composer com motivo explícito.
- 🟡 **RF-12:** Emite eventos de dispatch/tools/git e usage por turno para F08/F11.

## 5. Comportamentos
🟡 UI `#principal`: sidebar projetos/threads, histórico streaming, aba Diff, composer.
🟡 Diffs de subagents na mesma revisão do pai.
🟡 Turno com erro → thread `error` visível no dashboard.
🟡 Falha de push/PR por token → erro no fluxo git (não no save da config).

## 6. Casos de borda
- 🟡 Segunda execução no mesmo projeto → `thread_busy`.
- 🟡 Follow-up com thread ocupada → enfileira, não inicia segundo run.
- 🟡 Access `auto-accept-edits` vs `supervised`: política de gravação distinta, mas revisão unificada permanece disponível quando houver pending.
- 🟡 Pasta sem git: oferece init; sem init, git mutável indisponível.
- 🟡 Thread running: botões de commit/push/PR desabilitados.

## 7. Critérios de aceite
- 🟡 **Dado** projeto cadastrado, **Quando** cria thread Claude|Codex|Kimi com access e mode, **Então** a thread aceita o primeiro envio e trava o execution mode.
- 🟡 **Dado** turno com diffs, **Quando** o usuário aceita/rejeita por arquivo, **Então** os estados refletem pending/accepted/rejected.
- 🟡 **Dado** thread running, **Quando** outra execução longa é pedida no mesmo projeto, **Então** retorna `thread_busy`.
- 🟡 **Dado** thread running, **Quando** tenta commit/push/PR, **Então** a ação é bloqueada.
- 🟡 **Dado** skills/rules/subagents vinculados, **Quando** o turno roda, **Então** participam conforme F05–F07.
- 🟡 **Dado** provider não logado, **Quando** abre composer, **Então** fica desabilitado com motivo.

## 8. Questões em aberto
- 🟡 ⚠️ ABERTO: comportamento exato de `auto-accept-edits` quanto a still mostrar aba Diff pós-gravação.
- 🟡 ⚠️ ABERTO: política quando PAT GitHub ausente (esconder vs desabilitar com CTA).

## 9. Relatório de avaliação
```
SCORE TOTAL: 87/100
```
Breakdown:
  Completude: 90/100 (peso 30%)
  Testabilidade: 90/100 (peso 25%)
  Clareza: 85/100 (peso 20%)
  Escopo: 85/100 (peso 15%)
  Edge Cases: 80/100 (peso 10%)
Gaps críticos:
  - Detalhe de auto-accept-edits vs UI de Diff
Sugestões:
  1. Fechar UX de Diff após auto-accept
  2. Fechar CTA quando falta PAT
```

---
Gerado por reversa-spec-sdd em 2026-07-31T10:45:00Z
Fonte: prd.md
