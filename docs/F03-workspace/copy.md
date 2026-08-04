# Catálogo de copy: F03-workspace

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer` — `PrincipalScreen`, `ProjectTree`, `AddProjectModal`, `TaskComposer`, `ChatHistory`, `DiffViewer`, `GitActions`, `WorkspaceSidebar`, `PermissionPrompt`)  
**Mapa de rename:** `sistema legado → EngrenaCode`  
**Última atualização:** 2026-08-04 (diff por arquivo fechado)

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `principal` (shell 3 colunas), `addProject` (modal), `composer`, `chat`, `diff`, `git`, `harness`, `permission`, `prompt`.

## Telas

### principal (`#principal` — chrome / sidebars)

| Id | Texto | Notas |
|----|-------|-------|
| `principal.sidebar.projects.header` | Projetos | CSS uppercase no chrome |
| `principal.sidebar.projects.empty` | Nenhum projeto ainda. Adicione um repositório git local para começar. | |
| `principal.sidebar.projects.add` | Adicionar projeto | footer + aria do `+` |
| `principal.sidebar.projects.collapse` | Recolher projetos | |
| `principal.sidebar.projects.expand` | Expandir projetos | |
| `principal.sidebar.projects.remove` | Remover projeto | |
| `principal.sidebar.projects.remove.confirm` | Remover o projeto "{name}"? As threads dele serao apagadas (os arquivos no disco permanecem). | ortografia da fonte |
| `principal.sidebar.threads.empty` | Nenhuma thread ainda. | |
| `principal.sidebar.threads.new` | Nova thread | |
| `principal.sidebar.threads.loading` | Carregando… | |
| `principal.sidebar.threads.error` | Falha ao carregar as threads. | |
| `principal.sidebar.right.newThread` | Nova Thread | |
| `principal.sidebar.right.noProject` | Selecione um projeto para ver o ambiente, os vínculos e as ações do repositório. | |
| `principal.sidebar.right.ambiente` | Ambiente | |
| `principal.sidebar.right.arquivos` | Arquivos | |
| `principal.sidebar.right.thread` | Thread | |
| `principal.sidebar.right.repo` | Repositório | |
| `principal.sidebar.right.harness` | Repo Harness | |
| `principal.thread.tab.history` | Histórico | |
| `principal.thread.tab.diff` | Diff | |
| `principal.thread.tab.prompt` | Prompt | via Harness na fonte |
| `principal.thread.tabs.disabled` | Abra uma thread para navegar nas abas | |
| `principal.chat.empty.noThread` | Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral. | |
| `principal.error.threadBusy` | Thread {threadId} esta em execucao ou o projeto esta ocupado; tente novamente. | mensagem server 409 |

### addProject (modal)

| Id | Texto | Notas |
|----|-------|-------|
| `addProject.title` | Adicionar projeto | |
| `addProject.close` | Fechar | |
| `addProject.label.path` | Diretório local | |
| `addProject.placeholder.path` | /caminho/do/repositorio | |
| `addProject.browse` | Procurar… | |
| `addProject.hint.path` | Selecione um diretório existente que contém um repositório git. | |
| `addProject.label.name` | Nome do projeto | |
| `addProject.label.name.optional` | (opcional) | |
| `addProject.placeholder.name` | ex: engrenacode-shell | rename do placeholder do sistema legado |
| `addProject.hint.name` | Quando vazio, usamos o nome do diretório. | |
| `addProject.cta.cancel` | Cancelar | |
| `addProject.cta.primary` | Adicionar | |
| `addProject.cta.loading` | Adicionando... | |
| `addProject.error.network` | Nao foi possivel contatar o servidor local. Verifique se o EngrenaCode esta em execucao. | rename marca |
| `addProject.error.generic` | Nao foi possivel adicionar o projeto. Tente novamente. | |
| `addProject.error.duplicate` | Este diretório já foi adicionado como projeto. | |
| `addProject.error.notFound` | O caminho informado não existe no sistema de arquivos. | |
| `addProject.error.notDir` | O caminho informado não é um diretório. | |
| `addProject.error.permission` | Sem permissão de leitura no diretório informado. | |
| `addProject.error.notGit` | O diretório não é um repositório git (.git ausente). | **não** usado no add Central (soft); reservado se UI/legado ainda emitir |
| `addProject.error.access` | Não foi possível acessar o caminho informado. | |
| `addProject.error.invalid` | Informe um caminho de diretório válido. | |

### composer

| Id | Texto | Notas |
|----|-------|-------|
| `composer.placeholder.new` | Descreva a task para o agente…  (Enter envia) | |
| `composer.placeholder.followUp` | Responder nesta conversa…  (Enter envia, Shift+Enter quebra linha) | |
| `composer.placeholder.running` | Agente trabalhando — Enter enfileira para o próximo turno | |
| `composer.placeholder.stopping` | Cancelando execução… | |
| `composer.pill.access.group` | Access | EN |
| `composer.pill.access.supervised` | Supervised | EN |
| `composer.pill.access.autoAccept` | Auto-accept edits | EN |
| `composer.pill.access.fullAccess` | Full access | EN |
| `composer.pill.execution.group` | Execution | EN |
| `composer.pill.execution.main` | Main | EN |
| `composer.pill.execution.worktree` | Worktree | EN |
| `composer.lock.queue` | Fila de mensagens pendente — esvazie a fila para alterar o runtime. | |
| `composer.lock.running` | Agente executando — altere o runtime quando o turno terminar. | |
| `composer.lock.provider` | Modelos do provider da thread — o provider é imutável. | |
| `composer.gitGate.title` | Inicialize o Git para conversar com o agente | |
| `composer.gitGate.body` | O EngrenaCode precisa de um commit inicial para proteger e acompanhar as alterações do agente. | rename |
| `composer.gitGate.cta` | Inicializar Git | |
| `composer.gitGate.cta.loading` | Inicializando Git… | |
| `composer.gitGate.error.network` | Não foi possível contatar o servidor local. | |
| `composer.gitGate.error.generic` | Não foi possível inicializar o Git. | |
| `composer.send` | Enviar | aria |
| `composer.send.title` | Enviar (Enter) | |
| `composer.send.stop` | Parar execução | |
| `composer.send.stopping` | Cancelando execução | |
| `composer.send.waitingServer` | Aguardando confirmação do servidor | |
| `composer.error.send` | Falha ao enviar a mensagem. | |
| `composer.error.network` | Não foi possível contatar o servidor local. | |
| `composer.error.capabilities` | Não foi possível validar as capacidades efetivas. | |
| `composer.cta.retry` | Tentar novamente | |
| `composer.queue.badge.queued` | na fila | |
| `composer.queue.badge.sending` | enviando | |
| `composer.queue.badge.paused` | pausada | |
| `composer.queue.badge.error` | erro | |
| `composer.queue.action.edit` | Editar | |
| `composer.queue.action.save` | Salvar | |
| `composer.queue.action.cancel` | Cancelar | |
| `composer.queue.action.retry` | Tentar novamente | |

### chat

| Id | Texto | Notas |
|----|-------|-------|
| `chat.loading` | Carregando histórico… | |
| `chat.error` | Falha ao carregar o histórico da thread. | |
| `chat.empty.thread` | Sem mensagens ainda. O histórico aparece conforme o agente executa. | |
| `chat.thinking` | Pensando… {Xs} | |
| `chat.thought` | Pensou por {Xs} | |
| `chat.workLog` | Work log ({N}) | |
| `chat.workLog.working` | trabalhando… | |
| `chat.tool.interrupted` | interrompida | |
| `chat.tool.completed` | concluído | |
| `chat.tool.cancelled` | cancelado | |
| `chat.tool.error` | erro | |
| `chat.queue.queued` | na fila — vai no próximo turno | |
| `chat.queue.sending` | enviando… | |
| `chat.queue.paused` | pausada | |
| `chat.queue.failed` | falhou — veja o composer | |

### prompt (aba / Harness)

| Id | Texto | Notas |
|----|-------|-------|
| `prompt.title` | Prompt desta thread | |
| `prompt.placeholder` | Defina o comportamento do agente para esta thread… | |
| `prompt.hint` | Aplicado a todas as próximas mensagens desta thread, em qualquer provider. | |
| `prompt.cta.save` | Salvar prompt | |
| `prompt.cta.loading` | Salvando… | |

### diff

| Id | Texto | Notas |
|----|-------|-------|
| `diff.empty` | Nenhuma mudança proposta. O diff aparece quando o agente termina a execução. | fonte |
| `diff.summary.files.one` | {N} arquivo | fonte |
| `diff.summary.files.many` | {N} arquivos | fonte |
| `diff.mode.unified` | Unificado | fonte |
| `diff.mode.split` | Lado a lado | fonte |
| `diff.mode.aria` | Modo de visualização do diff | fonte |
| `diff.select.all` | Selecionar todos | destino Central |
| `diff.select.none` | Limpar seleção | destino Central |
| `diff.select.meta.one` | {N} selecionado | destino Central |
| `diff.select.meta.many` | {N} selecionados | destino Central |
| `diff.file.status.pending` | pendente | destino Central |
| `diff.file.status.accepted` | aceito | destino Central |
| `diff.file.status.rejected` | rejeitado | destino Central |
| `diff.file.select.aria` | Selecionar {file} | destino Central |
| `diff.file.accept` | Aceitar | destino Central — header do arquivo |
| `diff.file.accept.aria` | Aceitar {file} | |
| `diff.file.accept.loading` | Aplicando… | |
| `diff.file.reject` | Rejeitar | destino Central — header do arquivo |
| `diff.file.reject.aria` | Rejeitar {file} | |
| `diff.file.reject.loading` | Rejeitando… | |
| `diff.cta.accept` | Aceitar mudanças | fonte — todos pending se seleção vazia |
| `diff.cta.accept.loading` | Aplicando… | fonte |
| `diff.cta.accept.selected` | Aceitar selecionados ({N}) | destino Central |
| `diff.cta.reject` | Rejeitar | fonte — todos pending se seleção vazia |
| `diff.cta.reject.loading` | Rejeitando… | fonte |
| `diff.cta.reject.selected` | Rejeitar selecionados ({N}) | destino Central |
| `diff.after.accept` | Mudanças aplicadas | fonte |
| `diff.after.reject` | Mudanças rejeitadas. O worktree foi descartado e a thread não foi aprovada. | fonte |
| `diff.cta.openPr` | Abrir PR | fonte |
| `diff.cta.openPr.loading` | Abrindo PR… | fonte |
| `diff.pr.success` | PR aberto com sucesso: | fonte |
| `diff.pr.existing` | PR já existente reapresentado: | fonte |
| `diff.error.conflict` | Conflito ao aplicar: {message} | fonte |
| `diff.error.apply` | Não foi possível aplicar as mudanças. O diff segue pendente. | fonte |
| `diff.error.openPr` | Falha ao abrir o PR. A thread está em erro. | fonte |

### git

| Id | Texto | Notas |
|----|-------|-------|
| `git.hint.noThread` | Abra uma thread para executar ações de git | |
| `git.hint.stage` | Ação de git em andamento. | |
| `git.hint.statusPending` | Status do repositório ainda não carregado. | |
| `git.hint.detached` | HEAD destacada — faça checkout de uma branch antes. | |
| `git.hint.diverged` | Branch divergiu do upstream — rebase/merge manual primeiro. | |
| `git.hint.behind` | Branch atrás do upstream — faça pull manualmente. | |
| `git.hint.clean` | Tudo em dia — nada a commitar ou pushar. | |
| `git.quick.init` | Inicializar Git | unificado com `composer.gitGate.cta` |
| `git.quick.commit` | Commit | |
| `git.quick.commitPush` | Commit & push | |
| `git.quick.commitPushPr` | Commit, push & PR | |
| `git.quick.push` | Push | |
| `git.quick.viewPr` | Ver PR | |
| `git.stage.init` | Inicializando repositório… | |
| `git.stage.commitMsg` | Gerando mensagem de commit… | |
| `git.stage.committing` | Commitando… | |
| `git.stage.pushing` | Pushando… | |
| `git.stage.stackPr` | Commitando, pushando e abrindo o PR… | |
| `git.confirm.defaultBranch` | Esta ação vai pushar direto na branch default {refName}. Continuar? | |
| `git.confirm.continue` | Continuar em {refName} | |
| `git.confirm.cancel` | Cancelar | |

### harness (Repo Harness — F05–F07)

| Id | Texto | Notas |
|----|-------|-------|
| `harness.prompt` | Prompt | |
| `harness.rules` | Rules | |
| `harness.rules.meta` | {N} ativa \| {N} ativas | counts reais F06 |
| `harness.skills` | Skills | counts reais F05 |
| `harness.subagents` | SubAgents | counts reais F07; turno via call_subagent |
| `harness.link.count` | {N} vinculado \| {N} vinculados | |

### permission (Supervised)

| Id | Texto | Notas |
|----|-------|-------|
| `permission.title` | Permitir a ferramenta {toolName}? | |
| `permission.queue` | +{N} na fila | |
| `permission.label.tool` | Ferramenta | |
| `permission.label.params` | Parâmetros | |
| `permission.deny` | Negar | |
| `permission.allow` | Permitir | |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{name}` | nome do projeto |
| `{threadId}` | id da thread no lease busy |
| `{N}` | contagem (arquivos, tools, vínculos, rules) |
| `{Xs}` | segundos de thinking |
| `{refName}` | nome da branch default |
| `{file}` | path do arquivo no diff |
| `{message}` | detalhe de conflito de apply |
| `{toolName}` | nome da tool no permission prompt |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| — | Copy por arquivo / subset fechada em 2026-08-04 (`ui.md` Diff) | resolvido |
