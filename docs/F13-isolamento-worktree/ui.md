# Spec de UI: #principal (Worktree / execution mode)

**Feature:** F13-isolamento-worktree  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/components/composer/ComposerControlsMenu.tsx` (`ExecutionModePill`) + `TaskComposer.tsx` / `useTaskComposer.ts` / `composerPrefs.ts`; satélites: `BranchSelector.tsx`, `DiffViewer.tsx`  
**Componente destino (previsto):** `src/renderer/components/workspace/TaskComposer.tsx` (+ `ComposerControlsMenu.tsx` / `ExecutionModePill` se extraído); badge: `WorkspaceSidebar.tsx` / lista de threads; reject: `DiffViewer.tsx`  
**Última atualização:** 2026-08-06

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F13-isolamento-worktree/ui/principal-worktree-referencia.png` |
| Light (opcional) | N/A |
| Dark (opcional) | `docs/F13-isolamento-worktree/ui/principal-worktree-full.png` (viewport `#principal`) |

> Capturado 2026-08-06 no EngrenaCode (`#principal`, tema Escuro): composer com Execution Main/Worktree; thread idle trava o modo. Badge “Worktree” na lista de threads ainda ausente (TODO de produto).

## Escopo

**Inclui:** região de UI do Workspace (`#principal`) ligada ao modo de execução Main \| Worktree — anatomia do pill, estado travado pós-1º envio, copy literal (rename de marca), feedbacks de erro/reject relacionados a worktree, critérios de aceite visual dessa superfície.

**Exclui:** contratos de API/crypto/IPC/`git worktree` (ficam no `spec.md` técnico), implementação de primitives, anatomia completa do Workspace (ver F03), fluxo git/PR (F14), write-parallel de filhos.

## Anatomia (topo → base)

Ordem obrigatória da **região Worktree / execution mode** no viewport do Workspace (não substitui a anatomia completa de F03):

1. **Linha de controles do composer** (`TaskComposer`, `max-w-5xl`): pills à esquerda na ordem Provider/Modelo → (Reasoning·Context opcional) → Plan/Build → Access → **Execution (Main \| Worktree)** → divisores verticais → ações à direita (mic/anexo/meter/enviar).
2. **Pill `ExecutionModePill`:** trigger inline com label do modo atual (`Main` ou `Worktree`) + chevron; abre popover acima com título de grupo `Execution` e radios exclusivos.
3. **Estado travado:** após existir thread (`executionModeLocked`), o trigger fica `disabled` / read-only e reflete `thread.executionMode` (não muda mid-thread).
4. **Slot de erro do composer** (condicional): mensagem de falha do envio / criação (inclui falhas de worktree quando o server devolver message legível).
5. **(Destino PRD — ausente na fonte)** badge **“Worktree”** na thread após criar com `executionMode=worktree` — ver Perguntas em aberto.
6. **Diff reject (quando rejeitado):** banner de status no `DiffViewer` informando descarte do worktree.
7. **(Satélite BranchSelector)** em modo worktree: trigger não usa `thread.branch` como fallback do checkout principal; placeholder `sem branch` até o fetch resolver a branch viva do repo.

**Alinhamento do card / painel:** composer centrado `mx-auto max-w-5xl`; pills alinhados à esquerda na toolbar do composer; popover do Execution ancora `bottom-[calc(100%+6px)] left-0`  
**Largura máx.:** composer `max-w-5xl`; popover Execution `w-[230px] max-w-[92vw]`

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página (contexto) | shell `#principal` / `bg-bg text-fg` (F03) | esta SDD não redefine o grid 3 colunas |
| Composer shell | `rounded-xl border border-border bg-surface-2` + `focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25` | paridade F03 |
| Gap toolbar pills | `gap-xs` / divisores `h-4 w-0.5 bg-border` | entre controles |
| Pill trigger | `inline-flex … rounded-md border-transparent bg-transparent px-sm py-[5px] text-[12px] font-medium text-fg hover:bg-surface disabled:opacity-50` | papel caption; EN no label |
| Popover menu | `rounded-lg border border-border bg-surface p-xs shadow-lg z-50` | hand-rolled (sem radix na fonte) |
| Group title | `text-[10.5px] font-semibold uppercase tracking-wide text-muted` | literal `Execution` |
| Hint / title disabled | `title={disabledReason}` no trigger | sem slot visual separado quando idle+locked |
| Erro composer | `mt-sm text-xs text-red` `role="alert"` | message do server / genérica |
| Diff reject banner | `rounded-md border border-border bg-surface-2 … text-sm text-muted` `role="status"` | pós-reject |
| Badge thread (destino) | TODO — padrão F01.1 `bg-accent/20 font-mono text-accent` se confirmado | ausente na fonte |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` / `focus:border-accent` | |
| Erro | `text-red` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Labels do pill | `Main` / `Worktree` (EN) | mesmos (sem rename de marca) |
| Grupo do menu | `Execution` | mesmo |
| Pref localStorage execution | `lioncode.composer.executionMode` (mapa `projectId → mode`) | `engrenacode.composer.executionMode` |
| Branch worktree (comentário/server) | `lioncode/<thread>` | `engrenacode/<threadId>` (PRD/spec) |
| Badge “Worktree” na thread | **ausente** no renderer fonte | TODO destino (PRD F13 Experiência) |
| Erros create worktree | não há copy dedicada no renderer; genérico `error` / message HTTP | PRD: strings específicas (ver copy.md lacunas) |
| Type size pill | ~12px / group ~10.5px | papel caption até type-scale Design Lock |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`; `LionCodeLabs → EngrenaCode`; `lioncode → engrenacode`; `LionClaw → Design Lock` (se houver). Células = texto final no destino.

| Slot | Texto |
|------|-------|
| `title` | N/A |
| `subtitle` | N/A |
| `instruction` | N/A |
| `composer.pill.execution.group` | Execution |
| `composer.pill.execution.main` | Main |
| `composer.pill.execution.worktree` | Worktree |
| `composer.pill.execution.aria` | Modo de execução: {mode} |
| `composer.pill.execution.menu.aria` | Modo de execução |
| `composer.lock.queue` | Fila de mensagens pendente — esvazie a fila para alterar o runtime. |
| `composer.lock.running` | Agente executando — altere o runtime quando o turno terminar. |
| `composer.lock.execution.single` | {providerLabel} suporta somente este modo de execução. |
| `composer.lock.execution.none` | Nenhum modo de execução válido está disponível para {providerLabel}. |
| `composer.error.network` | Não foi possível contatar o servidor local. |
| `composer.error.send` | Falha ao enviar a mensagem. |
| `diff.after.reject` | Mudanças rejeitadas. O worktree foi descartado e a thread não foi aprovada. |
| `branch.placeholder.unknown` | sem branch |
| `thread.badge.worktree` | TODO |
| `error.worktree.gitRequired` | TODO (PRD: `Inicialize o Git antes de usar Worktree.`) |
| `error.worktree.createFailed` | TODO (PRD: `Não foi possível criar o worktree: {motivo}.`) |
| `thread.delete.worktree.retained` | TODO (spec HTTP warning: `Worktree retido com alterações locais; remova manualmente quando seguro.`) |

> Remover linhas de slot não usadas na implementação. Não parafrasear. Se ausente na fonte: `TODO`.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `composer.execution` | pill select (popover + radios) | sim (default `main`) | Opções `main` \| `worktree`; editável **só** sem thread; `disabled` se `loading` \|\| `executionModeLocked` \|\| `allowedExecutionModes.length <= 1`; `title` = disabledReason |
| `composer.execution.option.main` | radio | — | label `Main` |
| `composer.execution.option.worktree` | radio | — | label `Worktree` |
| Pref por projeto | localStorage | — | chave destino `engrenacode.composer.executionMode`; semeia conversa nova; thread vence após criar |
| Badge thread Worktree | badge | — | TODO — PRD exige após 1º envio com mode worktree; **não** encontrado na fonte |
| Diff reject status | status banner | — | visível quando review state = rejected |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | conversa nova, pref/`main` | pill mostra `Main` (ou pref do projeto); editável; popover abre |
| `filling` | troca Main ↔ Worktree antes do 1º envio | label do trigger atualiza; persiste pref do projeto |
| `loading` | submit / dispatch em andamento | pill `disabled` (junto com loading do composer) |
| `disabled` / `locked` | thread existe (`executionModeLocked`) ou só 1 mode permitido | trigger disabled/opacity; reflete `thread.executionMode`; popover não abre |
| `error` | falha no envio / create worktree | slot `role="alert"` com message (genérica na fonte; específicas PRD = TODO) |
| `worktree_rejected` | usuário rejeita diffs | banner `diff.after.reject` |
| `badge_visible` | thread com `executionMode=worktree` | TODO — badge “Worktree” (PRD; ausente na fonte) |

## Componentes sugeridos

Compor a região só com primitives compartilhados (não reinventar strings de classe):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Badge` | badge “Worktree” na thread (quando anatomia for fechada) |
| `Button` / trigger pill | trigger do `ExecutionModePill` (variante ghost/inline) |
| Menu radio (local) | opções Main / Worktree no popover |
| `InlineFeedback` / alert | erros de create worktree no composer |
| `Card` / surface-2 | shell do composer (já F03) — não reinventar |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) — **bloqueado** até PNG em `ui/principal-worktree-referencia.png`
- [ ] Anatomia na ordem documentada; sem H1/marca extra não listado
- [ ] Tabela de copy 100% aplicada (labels EN do pill, aria PT, reject, locks observados)
- [ ] Nenhum tamanho de fonte arbitrário fora da type scale do Design System destino
- [ ] Pill Execution usa padrão de controls do composer (não class soup local)
- [ ] Estados `loading`, `disabled`/`locked` e `error` verificáveis
- [ ] Tema `light` \| `dark` \| `system` respeitado via tokens (sem hex solto)
- [ ] Após rename: zero ocorrências Lion* na copy destino
- [ ] Badge “Worktree” só após fechar TODO de anatomia/localização

## Perguntas em aberto (resolvidas)

- Badge **“Worktree”**: chip no `ProjectTree.tsx` (linha da thread, ao lado do `STATE_DOT`), estilo `border-accent/40 bg-accent/10 text-accent-2` (paridade com badges de `LogTable.tsx`/`DashboardScreen.tsx`, não o `bg-accent/20` hipotético). Decisão do usuário — descartado colocar no `WorkspaceSidebar` para não duplicar.
- Execution pill: mantido `PillGroup` toggle (já implementado em `TaskComposer.tsx`, confirmado pela referência visual `ui/principal-worktree-referencia.png`) em vez do popover `ExecutionModePill` da fonte. Decisão do usuário — sem componente hand-rolled novo.
- Copy dedicada de lock (queue/running/capability/single-mode): fora do escopo desta feature — o `PillGroup` já trava via `disabled` sem `title` dedicado, paridade com Provider/Access.
- Erros PRD (`gitRequired`/`createFailed`): texto literal do PRD confirmado; servidor devolve em `error.message`, composer exibe no slot genérico já existente — sem string nova no client (ver `copy.md`).
- Aviso de cleanup em delete (`Worktree retido…`): resolvido no contrato HTTP (`spec.md` §5); sem tela de delete nesta feature, então *deferred* na UI.
- PNG de referência: `ui/principal-worktree-referencia.png` (pills) e `ui/principal-worktree-full.png` (viewport completo, dark) já capturados.
- Pref key: `engrenacode.composer.executionMode` (sem chave legada a migrar neste repo).

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F13-isolamento-worktree/spec.md` | Contratos técnicos (API, IPC, git worktree, erros de domínio) |
| `docs/F13-isolamento-worktree/plan.md` | Ordem de implementação |
| `docs/F03-workspace/ui.md` / `copy.md` | Anatomia completa do Workspace; pills já catalogados |
| `docs/design-system/` | Tokens e padrões de superfície |
| `docs/F13-isolamento-worktree/copy.md` | Catálogo de microcopy desta feature |
| `docs/PRD.md` → F13 | Experiência (badge) + Tratamento de Erros |
