# Catálogo de copy: F14-fluxo-git-completo

**Produto:** EngrenaCode  
**Fonte:** `C:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs` → `packages/renderer/src/components/GitActions.tsx` (+ mount `WorkspaceSidebar.tsx`; ids `git.*` alinhados a `docs/F03-workspace/copy.md`)  
**Mapa de rename:** `LionCode → EngrenaCode`; `lioncode → engrenacode` (nenhuma string Lion* na saída)  
**Última atualização:** 2026-08-07 (Lacunas de textgen/campos fechadas — texto já shipado em `GitActions.tsx` promovido a final, sem mudança de comportamento/layout)

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`git.{{slot}}`  
Exemplos: `git.quick.commit`, `git.stage.commitMsg`, `git.confirm.continue`, `git.cta.generateAi`.

Tela host: `#principal` (região Repositório / GitActions). Prefixo de tela omitido em favor do namespace `git.*` já usado em F03.

## Telas

### #principal — GitActions / Repositório

| Id | Texto | Notas |
|----|-------|-------|
| `git.section` | Repositório | chrome Section do pai |
| `git.cta.newAction` | Nova ação | `WorkspaceSidebar` acima de `<GitActions />` |
| `git.hint.noThread` | Abra uma thread para executar ações de git | title do quick quando `needsThread` |
| `git.hint.stage` | Ação de git em andamento. | `resolveQuickAction` busy |
| `git.hint.statusPending` | Status do repositório ainda não carregado. | |
| `git.hint.detached` | HEAD destacada — faça checkout de uma branch antes. | |
| `git.hint.diverged` | Branch divergiu do upstream — rebase/merge manual primeiro. | |
| `git.hint.behind` | Branch atrás do upstream — faça pull manualmente. | também title do Push |
| `git.hint.clean` | Tudo em dia — nada a commitar ou pushar. | |
| `git.hint.quickDefault` | Executa a pilha recomendada para o estado atual do repo | title default do quick |
| `git.hint.commit.enabled` | Commita a working tree na branch atual (mensagem por LLM) | fonte; destino F14 deve evitar auto-LLM — ver Lacunas |
| `git.hint.commit.disabled` | Sem mudanças na working tree | |
| `git.hint.push.noRemote` | Sem remote — publique no GitHub primeiro | |
| `git.hint.push.behind` | Branch atrás do upstream — faça pull manualmente | |
| `git.hint.push.enabled` | Pusha a branch atual para origin | |
| `git.hint.pr.noRemote` | Sem remote — publique no GitHub primeiro | |
| `git.hint.pr.open` | Já existe um PR aberto para esta thread | |
| `git.hint.pr.enabled` | Pilha completa: commit numa branch nova, push e PR | |
| `git.hint.pr.noChanges` | Sem mudanças na working tree | |
| `git.quick.init` | Inicializar Git | fonte: `Inicializar git`; destino F03 unificou G maiúsculo |
| `git.quick.commit` | Commit | também label busy fallback |
| `git.quick.commitPush` | Commit & push | |
| `git.quick.commitPushPr` | Commit, push & PR | |
| `git.quick.push` | Push | |
| `git.quick.viewPr` | Ver PR | link externo quando PR open |
| `git.quick.publish` | Publicar no GitHub | |
| `git.quick.pull` | Pull | disabled hint (sem rota na fonte) |
| `git.quick.sync` | Sincronizar | disabled hint (diverged) |
| `git.action.commit` | Commit | row individual |
| `git.action.push` | Push | row individual |
| `git.action.commitPushPr` | Commit, push & PR | row individual |
| `git.stage.init` | Inicializando repositório… | |
| `git.stage.publish` | Publicando no GitHub… | |
| `git.stage.commitMsg` | Gerando mensagem de commit… | na fonte = auto textgen; no destino só sob demanda |
| `git.stage.committing` | Commitando… | |
| `git.stage.pushing` | Pushando… | |
| `git.stage.stackPr` | Commitando, pushando e abrindo o PR… | |
| `git.publish.label.name` | Nome do repositório no GitHub | |
| `git.publish.label.public` | Repositório público (padrão: privado) | |
| `git.publish.cta` | Criar e publicar | |
| `git.publish.cta.loading` | Publicando… | |
| `git.publish.cancel` | Cancelar | |
| `git.confirm.aria` | Confirmar ação na branch default | `aria-label` do alertdialog |
| `git.confirm.defaultBranch.push` | Esta ação vai pushar direto na branch default {refName}. Continuar? | `confirming === 'push'` |
| `git.confirm.defaultBranch.commitPush` | Esta ação vai commitar e pushar direto na branch default {refName}. Continuar? | demais ações com push |
| `git.confirm.continue` | Continuar em {refName} | |
| `git.confirm.cancel` | Cancelar | |
| `git.feedback.initOk` | Repositório criado (branch {branch}, commit inicial {sha}). | |
| `git.feedback.publishOk` | Repositório publicado (branch {branch}): | + URL |
| `git.feedback.commitOk` | Commit {sha} criado na branch {branch}. | |
| `git.feedback.commitPushOk` | Commit {sha} pushado para origin/{branch}. | |
| `git.feedback.pushOk` | Branch {branch} pushada para origin. | |
| `git.feedback.prOpened` | PR aberto: | + URL |
| `git.feedback.prReused` | PR existente reaproveitado: | + URL |
| `git.error.network` | Não foi possível contatar o servidor local. | `NetworkError` |
| `git.error.generic` | Falha inesperada na ação de git. | fallback |
| `git.error.textgenUnexpected` | Resposta inesperada do gerador de mensagem. | throw no client fonte |

### #principal — GitActions / textgen (novo vs fonte — sem equivalente legado)

Ids exigidos pelo PRD Engrena (CTA "Gerar com IA" + campos editáveis) que a fonte não tinha, porque a fonte auto-executa textgen dentro do Commit sem campo editável. Texto já shipado em `GitActions.tsx`.

| Id | Texto | Notas |
|----|-------|-------|
| `git.cta.generateAi` | Gerar com IA | botão ao lado do subject e do prTitle; `title` + label |
| `git.stage.textgen` | Gerando com IA… | label dos botões de ação (Commit/Commit & push/Commit, push & PR) enquanto `stage==='textgen'` — cobre o slot `git.cta.generateAi.loading` da fonte |
| `git.placeholder.subject` | Mensagem do commit | também cumpre o papel de label (superfície compacta, sem `<label>` visível — mesmo padrão de outros inputs desta superfície) |
| `git.placeholder.body` | Descrição (opcional) | idem |
| `git.placeholder.prTitle` | Título do PR | idem |
| `git.placeholder.prBody` | Descrição do PR (markdown, opcional) | idem |
| `git.stage.openingPr` | Abrindo PR… | label do botão "Commit, push & PR" durante `stage==='pr'` |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{refName}` | nome da branch default (`main` / `master`) |
| `{branch}` | branch retornada pela ação git |
| `{sha}` | SHA curto/completo do commit |
| `{url}` | URL do PR ou do repo publicado (anexada ao feedback, não interpolada no texto base) |

## Lacunas — resolvidas

Nenhum `TODO` restante nesta feature. Decisões tomadas para os itens que exigiam adição vs. a fonte:

| Id necessário | Motivo | Decisão |
|---------------|--------|---------|
| `git.cta.generateAi` / `.loading` | Ausente na fonte (auto-textgen) | Implementado — ver tabela acima |
| `git.label.subject` / `.body` / `.prTitle` / `.prBody` | Campos editáveis novos, ausentes na fonte | **Sem `<label>` visível separado** — o `git.placeholder.*` correspondente cumpre o papel de label nesta superfície compacta (mesmo padrão dos demais inputs do painel Repositório); adicionar um `<label>` seria mudança de layout fora do escopo deste passe de copy. Ids `git.label.*` ficam reservados, não usados |
| `git.placeholder.subject` / `.body` / `.prTitle` / `.prBody` | Placeholders dos campos novos | Implementado — ver tabela acima |
| `git.hint.subjectMax` | Orientação soft ≤ 72 chars (PRD F14) | **Não implementado nesta versão.** Adicionar um hint visível sob o campo subject é mudança de layout (novo elemento na superfície), fora do escopo deste passe de copy — reavaliar num passe de design dedicado. Id reservado |
| `git.stage.openingPr` | PRD menciona “Abrindo PR…”; fonte usa só `git.stage.stackPr` | Implementado como slot separado — ver `git.stage.openingPr` na tabela principal |
| `git.hint.commit.enabled` (revisão) | Fonte diz “mensagem por LLM” (auto); destino não deve auto-commitar pós-textgen | **Não portado.** Esse hint (title do quick action "Commit") nunca foi implementado no destino — o CTA explícito "Gerar com IA" substitui inteiramente o padrão de auto-geração da fonte, então a frase "mensagem por LLM" nunca existiu no Engrena. Nenhuma ação necessária |
