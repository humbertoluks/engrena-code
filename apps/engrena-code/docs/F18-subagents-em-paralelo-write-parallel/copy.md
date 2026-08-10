# Catálogo de copy: F18-subagents-em-paralelo-write-parallel

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`SubagentFormModal` Tipo; `SubagentActivity` isolation/applyStatus) + PRD §6 F18 (agregado / seção Conflitos)  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-08

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

Baseline F07/F15 (`subagentsRun.*`, form) permanece válido; abaixo só o que F18 acrescenta ou promove de deferred → in-scope.

## Convenção de ids

`subagentsForm.*` · `subagentsRun.*` · `wp.*` (write-parallel)

## Telas

### subagentsForm (`#subagents` modal — campo kind)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsForm.label.kind` | Tipo | fonte |
| `subagentsForm.hint.kind` | Editável. Pipeline é usado pelos fluxos internos; Dev entra no catálogo dos projetos. | fonte |
| `subagentsForm.option.kind.dev` | Dev | |
| `subagentsForm.option.kind.pipeline` | Pipeline | |

### subagentsRun (promovido de F15 deferred — isolation worktree)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsRun.isolation.worktree` | worktree | badge |
| `subagentsRun.isolation.worktree.title` | Rodou numa cópia isolada do projeto; o patch foi integrado pelo harness. | `title` |
| `subagentsRun.apply.conflict` | conflito | applyStatus fonte; útil em audit |

### wp.activity (card Subagents — batch)

| Id | Texto | Notas |
|----|-------|-------|
| `wp.activity.aggregate` | Paralelo · {done}/{total} concluídos · {running} rodando · {failed} erro | proposta Engrena; omitir segmentos zerados se preferir na implementação |
| `wp.activity.aggregate.simple` | Paralelo · {done}/{total} | variante mínima TODO |

### wp.diff (DiffViewer — conflitos de merge path)

| Id | Texto | Notas |
|----|-------|-------|
| `wp.diff.conflicts.title` | Conflitos | PRD Experiência |
| `wp.diff.conflicts.hint` | Accept/Reject bloqueados até escolher o vencedor. | |
| `wp.diff.conflicts.useThis` | Usar este | CTA escolher candidato |
| `wp.diff.conflicts.useThis.loading` | Aplicando… | alinhar F03 acceptLoading se reusar |
| `wp.diff.status.conflict` | em conflito | hoje no `DiffViewer` Engrena — candidata a virar `conflito` |
| `wp.error.resolve` | Não foi possível resolver o conflito. Tente novamente. | proposta; TODO se API devolver message |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{done}` / `{total}` / `{running}` / `{failed}` | contagens do `parallel_batch_id` |
| `{path}` | path em conflito |
| `{name}` | nome do subagent filho / candidato |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `wp.activity.aggregate.simple` vs full | densidade na sidebar | TODO design |
| Unificar `wp.diff.status.conflict` com `subagentsRun.apply.conflict` | `em conflito` vs `conflito` | TODO |
| Copy skip worktree | PRD: filho sem worktree não roda | TODO se exposto na row |
| Isolation live-write / shared-read | fonte; fora Central F18 | não importar no aceite |

## Fora deste catálogo (fonte — não aceite F18 Central)

| Id / texto fonte | Notas |
|------------------|-------|
| `live-write` / `shared-read` + titles | isolationBadge fonte |
| `em andamento…` / `integrando…` / `— estágio {i}/{n}` | WorkflowStageLine |
| `Conflito ao aplicar: {message}` | DiffViewer acceptFeedback apply |
| `Este review fecha um pipeline /featdevelop…` | reject feature-pipeline |
