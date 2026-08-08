# Spec de UI: #principal + #subagents (Write-Parallel)

**Feature:** F18-subagents-em-paralelo-write-parallel  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`SubagentActivity.tsx` isolation/applyStatus; `SubagentFormModal.tsx` campo Tipo; `WorkflowStageLine.tsx`; `DiffViewer` feedback conflict/workflow — parcialmente fora do Central Engrena)  
**Componente fonte:** `packages/renderer/src/components/SubagentActivity.tsx`, `subagents/SubagentFormModal.tsx`, `WorkflowStageLine.tsx`  
**Componente destino (previsto):** `SubagentActivity.tsx` (agregado de batch); `DiffViewer.tsx` (seção Conflitos + escolher vencedor); `SubagentFormModal.tsx` (campo `kind`); tipagem já exposta em `threads-service` / `usePrincipalWorkspace.resolveConflict`  
**Última atualização:** 2026-08-08

> **Relação com backend:** F18 Central já shipou schema/runtime/merge (`spec.md`/`plan.md`). Este SDD fecha a fase visual que o `plan.md` Fase 4–5 deixou bloqueada. Copy provisória no destino (`DiffViewer` → `em conflito`) deve ser substituída pelos ids deste doc.

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Campo Tipo (fonte viva) | `docs/F18-subagents-em-paralelo-write-parallel/ui/subagent-form-kind-referencia.png` |
| Modal Novo subagent (fonte) | `docs/F18-subagents-em-paralelo-write-parallel/ui/subagent-form-modal-referencia.png` |
| Fixture batch + conflitos (destino) | `docs/F18-subagents-em-paralelo-write-parallel/ui/write-parallel-fixture.html` |
| Fixture dark | `docs/F18-subagents-em-paralelo-write-parallel/ui/write-parallel-fixture-dark.png` |
| Light (opcional) | TODO |

> Fonte: Electron LionCodeLabs CDP `:9222` (2026-08-08), `#subagents` → **+ Novo Agente**. Fixture: anatomia Engrena Central (não existe batch agregado nem seção Conflitos com “Usar este” na UI fonte 1:1).

## Escopo

**Inclui (Engrena F18 Central):**
- Card **Subagents** na sidebar: runs do batch paralelo com status individual + **progresso agregado** (`parallel_batch_id`)
- Badge de isolamento **`worktree`** nos filhos paralelos (único isolation do Central Engrena)
- Diff único no pai: paths exclusivos `pending`; seção **Conflitos** para `status=conflict` com escolha de vencedor (“Usar este”)
- Accept/Reject **bloqueados** enquanto `conflict`
- Campo **Tipo** no form `#subagents`: `Dev` | `Pipeline` (literal da fonte)
- Relatório parcial (sucesso/erro/timeout/skip) refletido nas rows (não abortar irmãos)

**Exclui (visível na fonte, fora do Central / Completo v2.0 / F22):**
- Isolation `live-write` / `shared-read` e applyStatus ricos além do necessário para conflito de merge de path (fonte tem mapa completo; Engrena Central só precisa `conflict` no diff + badge worktree no filho paralelo)
- `WorkflowStageLine` (“build — estágio 2/3 · integrando…”) — orquestração de pipeline/featbuild, não o batch `tasks[]` do F18 Central
- Agrupamento por sprint / featbuild / validator report
- Estratégias de merge configuráveis e diff lado a lado dos filhos (Completo → v2.0)
- Comparação Completo / merge-tree

**Baseline:** F15/F07 para anatomia Ativos/Concluídos, modal de audit, empties — este doc só acrescenta batch/conflito/`kind`.

## Anatomia (topo → base)

### A) Card `SubagentActivity` (sidebar `#principal`)

Estende F15:

1. Summary **Subagents** + pulso se há ativo
2. **Quando há `parallelBatchId` ativo/recente** (novo): faixa agregada sob o summary  
   - Ex.: `Paralelo · {done}/{total} concluídos · {running} rodando · {failed} erro` (ver copy; números derivados do batch)
3. Seção **Ativos** — um `RunRow` por filho do batch (e runs seriais F15 misturados se houver)
4. Seção **Concluídos · N**
5. Em cada row de filho paralelo: nome · badge `worktree` · ação/relógio · status (omitido na row enquanto running, só pulso — F15)

### B) DiffViewer — seção Conflitos

Dentro do painel de mudanças do `#principal`:

1. Bloco **Conflitos** (âmbar) listando diffs `status=conflict`
2. Por path: path mono + hint de bloqueio accept/reject
3. Lista de candidatos (`conflictCandidates`): nome do filho · meta (+/− ou hint) · CTA **Usar este**
4. Abaixo: diffs `pending` exclusivos com accept/reject normais (F03)
5. Diffs `conflict` **não** entram na seleção em massa de accept/reject

### C) Form `#subagents` — campo Tipo

Entre **Categoria** e **Provider** (ordem da fonte):

1. Label **Tipo**
2. `<select>`: **Dev** | **Pipeline**
3. Hint: **Editável. Pipeline é usado pelos fluxos internos; Dev entra no catálogo dos projetos.**

**Alinhamento:** sidebar + DiffViewer no workspace; form modal F07.  
**Largura máx.:** sidebar card; DiffViewer coluna central; form `max-w` do modal F07.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Card activity | igual F15 (`rounded-xl border…`) | |
| Faixa agregada | `rounded-sm border border-border bg-surface px-sm py-xs text-[11.5px] text-muted` | mono nos números |
| Badge worktree | `rounded-sm border bg-surface-2 px-[6px] text-[10px] uppercase text-muted` | fonte `isolationBadge` |
| Seção Conflitos | `border-amber/40 bg-amber/12 text-amber` | destaque PRD |
| CTA Usar este | `ButtonPrimary` / accent no vencedor escolhido | |
| Status conflict (pill arquivo) | `text-amber` — destino hoje `em conflito` | alinhar copy |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro resolve | `text-red` `role="alert"` | |

### Observado na fonte

| Item | Fonte | Destino F18 |
|------|-------|-------------|
| `isolationBadge('worktree')` | text `worktree` + title longo | manter |
| `applyStatusMeta('conflict')` | `conflito` âmbar | no **diff** usar seção Conflitos; no card run pode reusar |
| Tipo | Dev/Pipeline + hint | portar literal |
| WorkflowStageLine | estágio N/M | **fora** Central — não exigir no aceite F18 |
| DiffViewer `Conflito ao aplicar:` | apply merge file | distinto de conflict de batch path |

## Copy (literal)

Mapa: `LionCode → EngrenaCode`. Ver `copy.md`. Reusar `subagentsRun.*` (F07/F15) onde couber.

| Slot | Texto | Origem |
|------|-------|--------|
| `subagentsForm.label.kind` | Tipo | fonte |
| `subagentsForm.hint.kind` | Editável. Pipeline é usado pelos fluxos internos; Dev entra no catálogo dos projetos. | fonte |
| `subagentsForm.option.kind.dev` | Dev | fonte |
| `subagentsForm.option.kind.pipeline` | Pipeline | fonte |
| `subagentsRun.isolation.worktree` | worktree | F15 deferred → agora in-scope F18 |
| `subagentsRun.isolation.worktree.title` | Rodou numa cópia isolada do projeto; o patch foi integrado pelo harness. | fonte |
| `subagentsRun.apply.conflict` | conflito | fonte |
| `wp.activity.aggregate` | Paralelo · {done}/{total} concluídos · {running} rodando · {failed} erro | proposta Engrena (PRD progresso agregado) |
| `wp.diff.conflicts.title` | Conflitos | PRD Experiência |
| `wp.diff.conflicts.hint` | Accept/Reject bloqueados até escolher o vencedor. | PRD + spec |
| `wp.diff.conflicts.useThis` | Usar este | proposta CTA resolução |
| `wp.diff.status.conflict` | em conflito | destino provisório atual |
| `wp.error.resolve` | TODO | falha ao escolher vencedor |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| Tipo | select | sim | `dev` default; `pipeline` para F22 |
| RunRow | button | sim | abre audit modal F15 |
| Usar este | button | em conflict | `POST resolve-conflict` com `winningChildThreadId`; loading desabilita CTAs |
| Accept/Reject | button | só `pending` | disabled/oculto em `conflict` |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `batch-running` | `tasks[]` em voo | faixa agregada + N rows Ativos |
| `batch-partial` | 1+ filhos erro/timeout | rows erro; demais continuam; diffs parciais |
| `batch-done` | todos terminaram | só Concluídos; diffs pending/conflict no viewer |
| `conflict` | path em ≥2 filhos | seção Conflitos; accept/reject bloqueados |
| `conflict-resolving` | Usar este em voo | CTA loading |
| `conflict-resolved` | vencedor OK | vira `pending`; CTAs F03 voltam |
| `form-kind` | criar/editar | select Dev/Pipeline |

## Componentes sugeridos

| Primitive | Uso |
|-----------|-----|
| `SubagentActivity` / `RunRow` | estender F15 |
| `DiffViewer` | seção Conflitos + candidatos |
| `Field` + select | Tipo no form |
| `ButtonPrimary` / Secondary | Usar este |
| `InlineFeedback` | erro resolve |

## Aceite visual

- [ ] Campo Tipo Dev/Pipeline no form com hint literal
- [ ] Batch paralelo: status individual + agregado no card
- [ ] Badge worktree nos filhos paralelos
- [ ] Seção Conflitos destacada; Usar este promove a pending
- [ ] Accept/Reject indisponíveis em conflict
- [ ] Sem Lion*; tema via tokens
- [ ] Não exigir WorkflowStageLine / live-write no aceite Central

## Perguntas em aberto

- Copy exata da faixa agregada (incluir “skip worktree” como categoria?)
- Candidatos: mostrar hunk preview Completo v2.0 ou só nome + stats Central?
- Substituir `em conflito` por `conflito` (fonte applyStatus) no pill do arquivo?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F18-…/spec.md` | Contrato técnico |
| `docs/F15-…/ui.md` + `copy.md` | Baseline activity/timeline |
| `docs/F07-…/copy.md` | Form + `subagentsRun.*` |
| `docs/F18-…/copy.md` | Catálogo F18 |
