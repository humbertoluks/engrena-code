# Catálogo de copy: F14-fluxo-git-completo

**Produto:** EngrenaCode  
**Fonte:** `C:\Users\Me\Code\repos\github\lionlabs\LionCodeLabs` → `packages/renderer/src/components/GitActions.tsx` (+ mount `WorkspaceSidebar.tsx`; ids `git.*` alinhados a `docs/F03-workspace/copy.md`)  
**Mapa de rename:** `LionCode → EngrenaCode`; `lioncode → engrenacode` (nenhuma string Lion* na saída)  
**Última atualização:** 2026-08-06

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

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{refName}` | nome da branch default (`main` / `master`) |
| `{branch}` | branch retornada pela ação git |
| `{sha}` | SHA curto/completo do commit |
| `{url}` | URL do PR ou do repo publicado (anexada ao feedback, não interpolada no texto base) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `git.cta.generateAi` | PRD Engrena F14 exige botão explícito “Gerar com IA”; **ausente na fonte** (textgen auto no Commit) | TODO — adição destino-produto |
| `git.cta.generateAi.loading` | Loading do CTA sob demanda (fonte só tem stage `git.stage.commitMsg`) | TODO — adição destino-produto |
| `git.label.subject` | Campo editável de subject antes do commit; **ausente na fonte** | TODO — adição destino-produto |
| `git.label.body` | Campo editável de body do commit; **ausente na fonte** | TODO — adição destino-produto |
| `git.label.prTitle` | Campo editável de título do PR; **ausente na fonte** | TODO — adição destino-produto |
| `git.label.prBody` | Campo editável de body markdown do PR; **ausente na fonte** | TODO — adição destino-produto |
| `git.placeholder.subject` | Placeholder do subject | TODO — adição destino-produto |
| `git.placeholder.body` | Placeholder do body | TODO — adição destino-produto |
| `git.placeholder.prTitle` | Placeholder do título PR | TODO — adição destino-produto |
| `git.placeholder.prBody` | Placeholder do body PR | TODO — adição destino-produto |
| `git.hint.subjectMax` | Orientação soft ≤ 72 chars (PRD F14); **ausente na fonte** | TODO — adição destino-produto |
| `git.stage.openingPr` | PRD menciona “Abrindo PR…”; fonte usa só `git.stage.stackPr` | TODO — confirmar se slot separado é necessário |
| `git.hint.commit.enabled` (revisão) | Fonte diz “mensagem por LLM” (auto); destino não deve auto-commitar pós-textgen | TODO — reescrever após fechar fluxo Gerar com IA |
