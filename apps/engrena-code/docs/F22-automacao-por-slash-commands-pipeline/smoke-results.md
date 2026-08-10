# Smoke: F22. Automação por Slash Commands (Pipeline)

**Data:** 2026-08-08
**Método:** app empacotado (`electron-builder --dir`) com `--remote-debugging-port=9222`, `ENGRENACODE_USER_DATA` isolado sob `C:\f22rt`, CDP attach via `playwright-cli`. Vault e `userData` reais do usuário intocados. Turnos reais contra o binário `claude` (assinatura, `ANTHROPIC_API_KEY`/`CLAUDE_API_KEY` unset no shell antes do dev/spawn) — sem estado semeado para os turnos em si (só o projeto/subagents do fixture foram vinculados via SQLite direto, ligando os 4 subagents `planner`/`implementer`/`reviewer`/`tester` já existentes no catálogo seed de F17 ao projeto fixture).

## Setup

- 1 projeto fixture (`F22 Pipeline Smoke`, `C:\f22rt\project`, repo git real) com os 4 subagents `kind=dev` `planner`/`implementer`/`reviewer`/`tester` do catálogo F17 vinculados.
- Execução em modo `Main` + `Full access` (evita prompt de permissão em automação headless).

## Confirmado ao vivo

1. **CommandMenu** (`/` no composer): listbox com os 3 comandos nativos, glifo `/` + nome mono + descrição muted, texto literal do `copy.md`.
2. **Slash inválido bloqueado no client**: comando desconhecido digitado no composer nunca chega a disparar turno — erro inline `role="alert"` com o texto exato do `copy.md`, botão Enviar não dispara `dispatchNewThread`.
3. **`/featdevelop` ponta a ponta** (thread real, prompt `/featdevelop Adicionar um arquivo README-F22-SMOKE.md...`):
   - `planner` roda e completa primeiro; `PipelinePanel` na sidebar mostra `◈ PIPELINE · 1/2`, pill `EXECUTANDO`, stepper com `Planejar · planner` → `concluído` e `Implementar · implementer` → `executando` (labels PT-BR corretas, ver bug abaixo).
   - Ao terminar o `implementer` com 1 diff pendente (`README-F22-SMOKE.md`), pipeline e thread pausam: `pipeline.status=waiting_checkpoint`, `thread.state=waiting_user`. UI mostra pill `AGUARDANDO APROVAÇÃO`, hint "Revise os diffs acumulados no painel Diff antes de continuar o pipeline." e CTA "Continuar após revisar diffs" — texto exato do `copy.md`, aba Diff com badge `1`.
   - Clique real em "Continuar após revisar diffs" → pipeline resume → `reviewer` roda e completa → `tester` roda e completa → pipeline e thread terminam em `completed`/`idle`, `PIPELINE · 4/4` com os 4 estágios `concluído` em verde. O agente real encontrou e corrigiu um detalhe genuíno no arquivo (newline/EOF) durante o `reviewer`/`tester` — comportamento real dos subagents, não simulado.
4. **`/spec`**: thread com `/spec Planejar um endpoint de health check simples.` roda só `planner`, pipeline `1/1 completed`, resposta na timeline com `spec.md` estruturado (objetivo, requisitos funcionais, rota, body JSON) — sem diffs, sem checkpoint.
5. **`/featbuild`**: thread com `/featbuild Criar arquivo FEATBUILD-TEST.md...` roda só `implementer`, pipeline `1/1 completed`, sem checkpoint ativo — diff fica pendente para o fluxo normal do DiffViewer (F03), como esperado (F22 não introduz um segundo mecanismo de aprovação para `/featbuild`).
6. **Cancelar pipeline mid-stage**: thread nova com `/featdevelop`, clique em "Cancelar pipeline" enquanto `planner` ainda rodava → `thread.state=cancelled`, `pipeline.status=cancelled`, estágio interrompido marcado `failed` (erro real: turno abortado a meio, `SubagentRunStatus` refletindo a interrupção) — UI mostra pill `CANCELADO`, `PIPELINE · 0/1`.
7. **Light/dark**: ambos os temas conferidos via screenshot no estado `completed` — tokens do Design Lock, zero hex solto, `Lion*` ausente.

## Bug real encontrado e corrigido pelo smoke

O primeiro screenshot do `PipelinePanel` com pipeline `running` mostrou o texto de status de cada estágio como o valor cru do enum (`"completed"`, `"running"`) em vez de um label PT-BR — o componente reusava `stage.status` direto no JSX em vez de traduzir via um mapa, ao contrário do que já fazia para o status do pipeline inteiro (`STATUS_LABEL`). Corrigido em `PipelinePanel.tsx` (`fix(F22): translate pipeline stage status labels in PipelinePanel`): novo `STAGE_STATUS_LABEL: Record<PipelineStageStatus, string>` reusando o vocabulário já existente de `pipeline.status.*` (`copy.md` não define labels próprias por estágio) + 2 entradas novas (`pendente`, `ignorado`) para os estados `pending`/`skipped` que o status do pipeline nunca assume. Rebuild + re-smoke confirmou a correção (screenshot `f22_pipeline_running_dark_fixed.png`).

## Screenshots

- `smoke/f22_command_menu_dark.png` — CommandMenu com os 3 comandos
- `smoke/f22_pipeline_running_dark.png` — bug do enum cru (antes da correção)
- `smoke/f22_pipeline_running_dark_fixed.png` — labels traduzidos (depois da correção)
- `smoke/f22_pipeline_checkpoint_dark.png` — checkpoint `AGUARDANDO APROVAÇÃO` + CTA
- `smoke/f22_pipeline_completed_dark.png` — `/featdevelop` 4/4 concluído
- `smoke/f22_pipeline_cancelled_dark.png` — cancelamento mid-stage
- `smoke/f22_spec_completed_dark.png` — `/spec` completo
- `smoke/f22_featbuild_completed_dark.png` — `/featbuild` completo
- `smoke/f22_pipeline_completed_light.png` — tema claro

## Não exercitado neste smoke

- `ChatHistory.tsx` não ganhou o bloco/linha de timeline por estágio do `ui.md` §C (`Timeline — bloco/linha de estágio`) — a UI atual mostra o progresso só via `PipelinePanel` na sidebar. Nenhum dos 5 ACs do PRD exige esse bloco na timeline especificamente; registrado como desvio, não bloqueante.
- Timeout de hard-cap (2h) — coberto por teste unitário com override do cap (`setPipelineHardCapMsForTesting`), não reproduzido ao vivo (inviável esperar 2h ou forçar timeout real sem mockar o clock também em produção).
