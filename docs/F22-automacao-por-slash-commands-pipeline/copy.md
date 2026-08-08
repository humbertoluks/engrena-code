# Catálogo de copy: F22-automacao-por-slash-commands-pipeline

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`CommandMenu.tsx`, seeds `/spec` `/featdevelop` `/featbuild`, `FeaturePipelinePanel.tsx`, `featurePipeline.logic.ts` `statusLabel`/`PHASE_LABELS`, `WorkflowStageLine.tsx`) + PRD/spec F22 Central para descrições e 4 estágios  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-08

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`slash.{{slot}}` · `pipeline.{{slot}}` · `timeline.{{slot}}`

## Telas

### slash (composer `#principal`)

| Id | Texto | Notas |
|----|-------|-------|
| `slash.menu.aria` | Comandos | `aria-label` listbox — fonte |
| `slash.menu.empty` | Nenhum comando | fonte |
| `slash.menu.loading` | Buscando comandos… | fonte (ellipsis tipográfico) |
| `slash.cmd.spec` | /spec | nome + slash |
| `slash.cmd.spec.desc` | Gera spec.md + plan.md como texto estruturado na thread (não grava ficheiro). | Central (PRD); **não** usar seed fonte |
| `slash.cmd.spec.desc.fonte` | Escreve uma spec tecnica, valida com 2 agentes adversariais e entrega a versao corrigida em docs/. | literal seed 021 — auditoria |
| `slash.cmd.featdevelop` | /featdevelop | |
| `slash.cmd.featdevelop.desc` | Orquestra planner → implementer → reviewer → tester com checkpoint antes de aplicar diffs. | Central |
| `slash.cmd.featdevelop.desc.fonte` | Pipeline deterministico de feature: PRD -> gate humano -> TECH -> SPEC validada -> sprints JSON validadas, em docs/features/\<slug\>/. | literal seed 047 |
| `slash.cmd.featbuild` | /featbuild | |
| `slash.cmd.featbuild.desc` | Executa um plano já aprovado (markdown) sem replanejar; checkpoints de diff F03. | Central |
| `slash.cmd.featbuild.desc.fonte` | Executa as sprints do Ciclo A (docs/features/\<slug\>/): ondas do dependsOn, loop dev -> verification -> feat-code-validator (3 rodadas), integracao por sprint. | literal seed 050 |
| `slash.error.invalid` | Comando slash inválido ou mal formado. | destino PRD §6 (sem literal na fonte) |
| `slash.error.unknown` | Comando slash desconhecido. | destino ↔ `slash_unknown` |
| `slash.error.missing_args` | Faltam argumentos após o comando. | destino ↔ `slash_missing_args` |

### pipeline (painel)

| Id | Texto | Notas |
|----|-------|-------|
| `pipeline.header` | Pipeline | fonte header |
| `pipeline.aria` | Pipeline de feature | `aria-label` fonte |
| `pipeline.expand` | Expandir pipeline | `title` fonte |
| `pipeline.collapse` | Recolher pipeline | `title` fonte |
| `pipeline.status.running` | executando | `statusLabel` fonte |
| `pipeline.status.awaiting` | aguardando aprovação | fonte; checkpoint Central |
| `pipeline.status.interrupted` | interrompido | fonte |
| `pipeline.status.error` | erro | fonte |
| `pipeline.status.done` | concluído | fonte |
| `pipeline.status.cancelled` | cancelado | fonte |
| `pipeline.status.timeout` | timeout | destino hard-cap F22 |
| `pipeline.stage.planner` | Planejar · planner | Central (não PHASE_LABELS fonte) |
| `pipeline.stage.implementer` | Implementar · implementer | Central |
| `pipeline.stage.reviewer` | Revisar · reviewer | Central |
| `pipeline.stage.tester` | Testar · tester | Central |
| `pipeline.cta.checkpoint` | Continuar após revisar diffs | destino (substitui Aprovar PRD) |
| `pipeline.hint.checkpoint` | Revise os diffs acumulados no painel Diff antes de continuar o pipeline. | destino |
| `pipeline.cta.cancel` | Cancelar pipeline | fonte |
| `pipeline.cta.cancel.confirm` | Cancelar encerra o pipeline e MATA o turno em voo (inclusive um follow-up seu). Confirmar? | fonte literal |
| `pipeline.cta.cancel.confirmBtn` | Confirmar | fonte |
| `pipeline.cta.cancel.back` | Voltar | fonte |
| `pipeline.actionError` | Falha ao executar a ação do pipeline. | fonte fallback |
| `pipeline.busy.approve` | Aprovando… | fonte — **não** usar no Central (sem Aprovar PRD) |
| `pipeline.cta.approve` | Aprovar PRD | fonte — **fora** Central |
| `pipeline.hint.approve` | Ajustes no PRD? Converse nesta thread antes de aprovar. | fonte — **fora** Central |
| `pipeline.cta.resume` | Retomar | fonte — **fora** Central (v2.0) |
| `pipeline.busy.resume` | Retomando… | fora Central |
| `pipeline.busy.cancel` | Cancelando… | fonte |
| `pipeline.sprints` | Sprints | fonte — **fora** Central |

### timeline

| Id | Texto | Notas |
|----|-------|-------|
| `timeline.phase.start` | em andamento… | `stagePhaseLabel` fonte |
| `timeline.phase.integrating` | integrando… | fonte |
| `timeline.phase.done` | concluído | fonte |
| `timeline.line` | — estágio {index}/{total} · {phase} | template `WorkflowStageLine` |
| `timeline.block.meta` | Estágio {stageLabel} · subagent {subagentName} | destino bloco PRD |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{index}` | índice 1-based do estágio corrente |
| `{total}` | total de estágios do comando (4 em featdevelop; 1 em spec) |
| `{phase}` | `timeline.phase.*` |
| `{stageLabel}` | Planejar / Implementar / Revisar / Testar |
| `{subagentName}` | planner / implementer / reviewer / tester |
| `{done}` | estágios concluídos no header |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `slash.error.*` mensagens HTTP exatas do server | spec cita códigos; microcopy UI fechada aqui — alinhar `message` do 400 se divergir | TODO na implementação |
| Copy light-theme screenshot menu | captura fonte veio clara; dark do painel está na fixture | TODO opcional |
| `pipeline.cta.resume` | Completo v2.0 | adiado |
