# Spec de UI: #principal (GitActions / Repositório)

**Feature:** F14-fluxo-git-completo  
**Destino:** EngrenaCode  
**Fonte de referência:** `C:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs` → `packages/renderer/src/components/GitActions.tsx` (+ mount em `WorkspaceSidebar.tsx`, status em `useVcsStatus.ts`)  
**Componente fonte:** `packages/renderer/src/components/GitActions.tsx`  
**Componente destino (previsto):** `src/renderer/components/workspace/GitActions.tsx`  
**Última atualização:** 2026-08-06

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F14-fluxo-git-completo/ui/git-actions-referencia.png` |
| Light (opcional) | N/A |
| Dark (opcional) | mesmo frame (tema Escuro) |

> Capturado 2026-08-06 no EngrenaCode (`#principal`, tema Escuro): seção **Repositório** com Commit / Commit & push / Push (baseline F03). Sem “Gerar com IA” nem “Commit, push & PR” nesta build (TODOs F14).

## Escopo

**Inclui:** anatomia da região GitActions dentro da seção collapsible **Repositório** do `#principal` (sidebar Workspace), copy literal da fonte, estados de UI (quick action adaptativo, estágios, confirmação default-branch, publish mini-form, feedback), mapeamento de tokens/padrões de linha da sidebar, critérios de aceite visual.

**Exclui:** contratos HTTP/IPC/git-client/textgen (ficam no `spec.md` F14), seção Ambiente / FileExplorer / Diff / Repo Harness (F03), implementação de componentes.

**Gap crítico (fonte × PRD destino):** a fonte **auto-executa** textgen no fluxo Commit (`stage` = `Gerando mensagem de commit…` → commit imediato com subject/body gerados). **Não há** botão “Gerar com IA” nem campos editáveis de subject/body/title antes da mutação. O PRD Engrena F14 exige textgen sob demanda + edição humana antes de confirmar — slots e anatomia destino listados como **TODO** em Perguntas em aberto (não inventar UI aqui).

## Anatomia (topo → base)

Ordem obrigatória de renderização **dentro** da seção `Repositório` da sidebar direita (fonte: `WorkspaceSidebar` monta `Nova ação` + `<GitActions />`):

1. **Título da seção** (chrome do pai): `Repositório` (uppercase tracking, ícone git-branch, collapsible `<details>` fechado por padrão).
2. **Linha “Nova ação”** (chrome do pai, fora de `GitActions`): botão row que dispara quick action do workspace.
3. **Botão rápido adaptativo** (`resolveQuickAction`): uma row `font-semibold` cujo rótulo muda com o estado do repo (`Inicializar git` / `Commit` / `Commit & push` / `Commit, push & PR` / `Push` / `Publicar no GitHub` / `Ver PR` / `Pull`/`Sincronizar` desabilitados). Em `running`, o label vira o `stage` atual + dot pulse.
4. **Mini-form Publicar no GitHub** (condicional `publishOpen`): campo nome do repo + checkbox visibilidade + CTAs `Criar e publicar` / `Cancelar`.
5. **Ações individuais empilhadas** (sempre visíveis como rows): `Commit` · `Push` · `Commit, push & PR` (cada uma `disabled`/hint conforme working tree, remote, PR aberto, busy, thread).
6. **Confirmação inline branch default** (condicional `confirming`): alertdialog âmbar — copy “pushar” vs “commitar e pushar” + `Continuar em {refName}` / `Cancelar`.
7. **Feedback** (condicional): parágrafo `role=status|alert` verde/vermelho; sucesso de PR/publish pode anexar URL mono sublinhada.

**Ausente na fonte (destino F14 — não renderizar a partir deste SDD sem fechar TODO):** campos editáveis subject / body / title PR; botão explícito “Gerar com IA”; etapa de revisão humana antes do commit.

**Alinhamento do card / painel:** coluna da sidebar direita (`aside` `rounded-xl border … bg-surface`); conteúdo das rows alinhado à esquerda (`text-left`), label à esquerda / valor à direita nas InfoRows do pai.  
**Largura máx.:** largura da sidebar Workspace (não card viewport-centrado); rows `w-full`.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página / host | região `#principal` sidebar direita — ver `docs/F03-workspace/ui.md` | GitActions não é tela full-bleed |
| Seção Repositório | `rounded-xl border border-border` + `bg-[color-mix(in_srgb,var(--fg)_5%,var(--surface-2))]`; título `text-[11px] font-bold uppercase tracking-[0.07em]` | chrome `WorkspaceSidebar.Section` |
| Gap interno | `flex flex-col gap-[2px]` (+ `p-xs` no corpo collapsible) | |
| Row / CTA secundário | `ROW_BTN`: `flex w-full … rounded-lg px-sm py-[4px] text-[12px] text-fg/85 hover:bg-[color-mix(…)] focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50` | primário rápido = mesma row + `font-semibold` |
| Label do campo (publish) | `text-[11px] text-muted` | |
| Input (publish name) | `rounded-md border border-border bg-surface px-sm py-[4px] font-mono text-[12px] text-fg focus:border-accent` | |
| Hint / caption | `title` nativo no botão; hints do quick em `quick.hint` | sem caption permanente sob as rows |
| CTA primário (publish) | `rounded-sm border border-border bg-surface … text-[11.5px] font-semibold` | não é `Button` full-width accent |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` (rows); `focus:border-accent` (input) | |
| Erro / alerta | feedback `text-red` (`role=alert`); confirm default-branch `border-[rgba(210,162,58,0.32)] bg-amber/[0.14] text-amber` | |
| Sucesso | feedback `text-green` + link `font-mono underline` | |
| Busy indicator | `h-[5px] w-[5px] animate-pulse rounded-full bg-[#4c8ef0]` | **token-gap:** hex solto na fonte; destino preferir token accent/blue se existir |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca / pacote | `@lioncode/shared`, LionCodeLabs | EngrenaCode; path `src/renderer/…` |
| Quick init label | `Inicializar git` | Engrena F03 já unificou `Inicializar Git` (`git.quick.init`) — reutilizar id F03 |
| Textgen | auto no `run(commit*)` via `generateGitText` | **não portar auto-commit**; destino = botão “Gerar com IA” + campos (TODO) |
| Stage textgen | `Gerando mensagem de commit…` | manter copy como stage **se** textgen sob demanda; não como passo invisível pós-clique Commit |
| Confirm default | variantes pushar / commitar e pushar | documentar ambas; F03 simplificou só “pushar” |
| Pull / Sync | labels desabilitados (sem rota) | fora do PRD F14 (aceitável como hint disabled se portar paridade) |
| Publish GitHub | mini-form na mesma seção | fora do núcleo PRD F14 (Commit / Commit&push / Commit+push+PR); opcional se destino já tiver publish |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`; `lioncode → engrenacode`. Células = texto final no destino. Nenhuma string Lion* permanece.

Ids alinhados a `docs/F03-workspace` quando já existiam; slots novos da fonte `GitActions.tsx` acrescentados abaixo. Slots exigidos pelo PRD Engrena e **ausentes na fonte** → `TODO`.

| Slot | Texto |
|------|-------|
| `git.section` | Repositório |
| `git.cta.newAction` | Nova ação |
| `git.hint.noThread` | Abra uma thread para executar ações de git |
| `git.hint.stage` | Ação de git em andamento. |
| `git.hint.statusPending` | Status do repositório ainda não carregado. |
| `git.hint.detached` | HEAD destacada — faça checkout de uma branch antes. |
| `git.hint.diverged` | Branch divergiu do upstream — rebase/merge manual primeiro. |
| `git.hint.behind` | Branch atrás do upstream — faça pull manualmente. |
| `git.hint.clean` | Tudo em dia — nada a commitar ou pushar. |
| `git.hint.quickDefault` | Executa a pilha recomendada para o estado atual do repo |
| `git.hint.commit.enabled` | Commita a working tree na branch atual (mensagem por LLM) |
| `git.hint.commit.disabled` | Sem mudanças na working tree |
| `git.hint.push.noRemote` | Sem remote — publique no GitHub primeiro |
| `git.hint.push.behind` | Branch atrás do upstream — faça pull manualmente |
| `git.hint.push.enabled` | Pusha a branch atual para origin |
| `git.hint.pr.noRemote` | Sem remote — publique no GitHub primeiro |
| `git.hint.pr.open` | Já existe um PR aberto para esta thread |
| `git.hint.pr.enabled` | Pilha completa: commit numa branch nova, push e PR |
| `git.hint.pr.noChanges` | Sem mudanças na working tree |
| `git.quick.init` | Inicializar Git |
| `git.quick.commit` | Commit |
| `git.quick.commitPush` | Commit & push |
| `git.quick.commitPushPr` | Commit, push & PR |
| `git.quick.push` | Push |
| `git.quick.viewPr` | Ver PR |
| `git.quick.publish` | Publicar no GitHub |
| `git.quick.pull` | Pull |
| `git.quick.sync` | Sincronizar |
| `git.action.commit` | Commit |
| `git.action.push` | Push |
| `git.action.commitPushPr` | Commit, push & PR |
| `git.stage.init` | Inicializando repositório… |
| `git.stage.publish` | Publicando no GitHub… |
| `git.stage.commitMsg` | Gerando mensagem de commit… |
| `git.stage.committing` | Commitando… |
| `git.stage.pushing` | Pushando… |
| `git.stage.stackPr` | Commitando, pushando e abrindo o PR… |
| `git.publish.label.name` | Nome do repositório no GitHub |
| `git.publish.label.public` | Repositório público (padrão: privado) |
| `git.publish.cta` | Criar e publicar |
| `git.publish.cta.loading` | Publicando… |
| `git.publish.cancel` | Cancelar |
| `git.confirm.aria` | Confirmar ação na branch default |
| `git.confirm.defaultBranch.push` | Esta ação vai pushar direto na branch default {refName}. Continuar? |
| `git.confirm.defaultBranch.commitPush` | Esta ação vai commitar e pushar direto na branch default {refName}. Continuar? |
| `git.confirm.continue` | Continuar em {refName} |
| `git.confirm.cancel` | Cancelar |
| `git.feedback.initOk` | Repositório criado (branch {branch}, commit inicial {sha}). |
| `git.feedback.publishOk` | Repositório publicado (branch {branch}): |
| `git.feedback.commitOk` | Commit {sha} criado na branch {branch}. |
| `git.feedback.commitPushOk` | Commit {sha} pushado para origin/{branch}. |
| `git.feedback.pushOk` | Branch {branch} pushada para origin. |
| `git.feedback.prOpened` | PR aberto: |
| `git.feedback.prReused` | PR existente reaproveitado: |
| `git.error.network` | Não foi possível contatar o servidor local. |
| `git.error.generic` | Falha inesperada na ação de git. |
| `git.error.textgenUnexpected` | Resposta inesperada do gerador de mensagem. |
| `git.cta.generateAi` | TODO |
| `git.cta.generateAi.loading` | TODO |
| `git.label.subject` | TODO |
| `git.label.body` | TODO |
| `git.label.prTitle` | TODO |
| `git.label.prBody` | TODO |
| `git.placeholder.subject` | TODO |
| `git.placeholder.body` | TODO |
| `git.placeholder.prTitle` | TODO |
| `git.placeholder.prBody` | TODO |
| `git.hint.subjectMax` | TODO |
| `git.stage.openingPr` | TODO |

> Não parafrasear. `git.quick.init` usa capitalização já fechada no destino F03 (`Inicializar Git`); fonte literal era `Inicializar git`.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `git.quick` | button ou link (`Ver PR`) | — | label/kind de `resolveQuickAction`; `disabled` se `busy`, hint, ou `needsThread` / sem `projectId`; init/publish não exigem thread |
| `git.action.commit` | button | — | enabled só com working tree dirty + thread; title = hint enabled/disabled |
| `git.action.push` | button | — | enabled com remote + (ahead > 0 \|\| !upstream) + behind === 0 |
| `git.action.commitPushPr` | button | — | enabled com remote + dirty + PR não open |
| `git.publish.name` | text | sim (trim ≠ ∅) | mono; default = slug do `projectName` |
| `git.publish.public` | checkbox | não | default unchecked = privado |
| `git.publish.submit` / `cancel` | button | — | submit disabled se running ou nome vazio |
| `git.confirm.continue` / `cancel` | button | — | só quando ação com push em `main`/`master` |
| `git.cta.generateAi` | button | — | **TODO destino** — não existe na fonte |
| `git.field.subject` | text | sim (destino) | **TODO destino** — fonte envia subject gerado sem UI |
| `git.field.body` | textarea | não (destino) | **TODO destino** |
| `git.field.prTitle` | text | sim p/ PR (destino) | **TODO destino** |
| `git.field.prBody` | textarea | não (destino) | **TODO destino** |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com status carregado, idle | quick label conforme `resolveQuickAction`; rows Commit/Push/PR com enabled/disabled; sem confirm/publish/feedback |
| `filling` | digitar nome no publish form | limpa feedback ao abrir publish |
| `loading` / `gitBusy` | `stage !== null` **ou** `thread.state === 'running'` | quick mostra `stage` + pulse; todas as ações disabled; title `Ação de git em andamento.` se busy via resolve |
| `disabled` | hint kinds (clean, diverged, behind, detached, status null); sem thread em `run`; sem mudanças; sem remote | rows/quick `disabled` + `title` com hint |
| `error` | catch API/rede/domínio | feedback `tone=error` (`role=alert`); stage limpo |
| `statusPending` | `vcs.status === null` e não busy | quick Commit disabled; hint status não carregado |
| `notRepo` | `!local.isRepo` | quick = Inicializar Git (`kind=init`) |
| `noRemote` | repo sem remote | limpo → Publicar; dirty → Commit local |
| `publishOpen` | clique Publicar no GitHub | mini-form visível |
| `confirmDefaultBranch` | push / commit_push / commit_push_pr em main\|master | alertdialog âmbar; não chama `run` até Continuar |
| `success` | pilha ok | feedback verde (+ URL se PR/publish) |
| `viewPr` | limpo + PR open + url | quick vira link externo `Ver PR` |
| `textgenAuto` (**fonte only**) | início de commit / commit_push | stage `Gerando mensagem de commit…` → commit sem UI de edição |
| `textgenReview` (**destino TODO**) | clique “Gerar com IA” | preenche campos editáveis; **não** muta git até Commit confirmado |

## Componentes sugeridos

Compor a região só com primitives / padrões da sidebar (não reinventar class soup local):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Section` (sidebar) | chrome “Repositório” collapsible |
| row button (`ROW_BTN`) | quick + ações individuais + Nova ação |
| `Input` / Field | publish name; **futuro** subject / prTitle |
| `Textarea` / Field | **futuro** body / prBody (TODO) |
| `Button` | publish submit/cancel; confirm Continuar/Cancelar; **futuro** Gerar com IA |
| `Checkbox` | publish visibility |
| status/alert text | feedback ok/erro |
| alertdialog panel | confirmação default-branch (âmbar) |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) — PNG em `ui/git-actions-referencia.png`
- [ ] Anatomia na ordem documentada (seção → Nova ação → quick → [publish] → 3 rows → [confirm] → [feedback]); sem H1/marca extra
- [ ] Tabela de copy 100% aplicada para slots **não-TODO** (labels, hints, stages, confirm, feedback)
- [ ] Nenhum tamanho de fonte arbitrário fora da type scale do Design System destino (fonte usa `text-[11px]`/`[12px]`/`[11.5px]` — mapear a `text-caption` / body small se a scale existir)
- [ ] Rows usam padrão sidebar (`ROW_BTN` / focus ring accent), não card hero
- [ ] Estados `loading`/`gitBusy`, `disabled`, `error`, `confirmDefaultBranch` verificáveis
- [ ] Tema `light` \| `dark` \| `system` via tokens (substituir hex do pulse `#4c8ef0` se houver token)
- [ ] **Não** afirmar paridade visual de “Gerar com IA” / campos subject-title até fechar TODOs de copy e anatomia destino
- [ ] Zero ocorrências Lion* / LionCode / lioncode na UI e neste doc (após rename)

## Perguntas em aberto

- **Destino F14 — Gerar com IA:** a fonte não tem CTA `git.cta.generateAi` nem loading dedicado; textgen é estágio automático. Definir copy literal e posição na anatomia (acima das ações? entre subject e Commit?) antes de implementar.
- **Destino F14 — campos editáveis:** fechar labels/placeholders para `git.label.subject`, `git.label.body`, `git.label.prTitle`, `git.label.prBody` (+ placeholders) e hint soft ≤ 72 chars (`git.hint.subjectMax`). Ausentes na fonte.
- **Destino F14 — stage Abrindo PR…:** PRD menciona estágio “Abrindo PR…”; fonte usa pilha única `Commitando, pushando e abrindo o PR…` (`git.stage.stackPr`). Precisa slot separado `git.stage.openingPr`?
- **Auto vs sob demanda:** confirmar que o port Engrena **remove** o auto-run de `generateGitText` dentro de Commit (PRD: never auto-commit; textgen só preenche).
- **Publish / Init / Pull / Sync:** manter paridade completa da fonte ou só o trio Commit / Commit & push / Commit, push & PR do PRD F14?
- **Confirm copy F03:** F03 catalogou só variante “pushar”; fonte distingue push vs commit+push — qual vence no destino?
- **Referência PNG:** capturada em `docs/F14-fluxo-git-completo/ui/git-actions-referencia.png` (baseline Engrena Commit / Commit & push / Push; sem Gerar com IA / stack PR ainda).
- **Pulse hex:** mapear `bg-[#4c8ef0]` → token semântico do Design Lock Engrena.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F14-fluxo-git-completo/spec.md` | Contratos técnicos (API, textgen, erros, cwd worktree) |
| `docs/F14-fluxo-git-completo/plan.md` | Ordem de implementação |
| `docs/F14-fluxo-git-completo/copy.md` | Catálogo de microcopy (ids `git.*`) |
| `docs/F03-workspace/ui.md` / `copy.md` | Estilo + ids `git.*` já existentes no destino |
| `docs/design-system/` | Tokens e padrões de superfície |
| Fonte `GitActions.tsx` / `GitActions.test.tsx` | Anatomia + asserts de `resolveQuickAction` |
