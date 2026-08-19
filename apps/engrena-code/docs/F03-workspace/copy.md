# Catálogo de copy: F03-workspace

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer` — `PrincipalScreen`, `ProjectTree`, `AddProjectModal`, `TaskComposer`, `ChatHistory`, `DiffViewer`, `GitActions`, `WorkspaceSidebar`, `PermissionPrompt`)  
**Mapa de rename:** `sistema legado → EngrenaCode`  
**Última atualização:** 2026-08-18 (seção `permission`: o chip concede no clique — `spec.md` §3.5)

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
| `composer.placeholder.running` | Agente trabalhando — Enter envia para a fila | o verbo "enfileirar" não aparece na UI (`spec.md` §3.4) |
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
| `composer.send` | Enviar | aria; em `running` continua visível ao lado de Parar (a mensagem vai para a fila) |
| `composer.send.title` | Enviar (Enter) | |
| `composer.send.stop` | Parar execução | em `running` aparece **junto** com Enviar |
| `composer.send.stopping` | Cancelando execução | em `stopping` o composer mostra **só** Parar |
| `composer.send.waitingServer` | Aguardando confirmação do servidor | |
| `composer.error.send` | Falha ao enviar a mensagem. | |
| `composer.error.network` | Não foi possível contatar o servidor local. | |
| `composer.error.capabilities` | Não foi possível validar as capacidades efetivas. | |
| `composer.cta.retry` | Tentar novamente | |
| `composer.queue.badge.queued` | na fila | |
| `composer.queue.header` | {N} na fila | painel colapsável acima do composer (padrão Cursor) |
| `composer.queue.badge.sending` | enviando | |
| `composer.queue.badge.error` | erro | |
| `composer.queue.action.edit` | Editar | |
| `composer.queue.action.save` | Salvar | |
| `composer.queue.action.cancel` | Cancelar | |
| `composer.queue.action.promote` | Priorizar (próxima) | move o item para o início da fila |
| `composer.queue.action.remove` | Remover da fila | |
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

### permission (card inline na timeline)

O pedido de permissão **não é modal**. É um card inline no fim da timeline: o pedido nasce no meio do turno e pertence à conversa; como overlay ele tapava a resposta em andamento. Difere do `AskUserQuestionCard` num ponto — aqui o chip decide sozinho, lá ele preenche o composer, porque resposta a pergunta costuma ser editada antes de sair e decisão de permissão não tem o que editar.

Contrato de UX que esta copy precisa refletir (`spec.md` §3.5):

- Clique num chip **concede ou nega na hora**. Não escreve no composer nem mexe no rascunho digitado.
- Digitar a decisão no composer (sim / não / permitir todos / sempre neste projeto) e **Enviar** faz a mesma coisa. Os dois gatilhos valem sempre.
- O card não tem textarea nem Enviar próprios: só os chips e, quando falha, o alerta de erro.
- Em `running` o composer mostra **Parar e Enviar** (Enviar manda para a fila). Em `stopping`, **só Parar**.
- Texto livre que não seja decisão **vai para a fila** como em qualquer thread ocupada. O hint `permission.composer.pending` sobra para o caso raro de `waiting_permission` sem gate conhecido (WS perdido), em que não há o que resolver.

| Id | Texto | Notas |
|----|-------|-------|
| `permission.header` | O agente precisa de permissão | header do card |
| `permission.title` | Permitir a ferramenta {toolName}? | |
| `permission.queue` | +{N} na fila | demais pedidos aguardando |
| `permission.countdown` | {mm}:{ss} | relógio de `gate.expiresAt` à esquerda da fila; amber nos últimos 15 s. Fonte: `docs/F30-avisos-de-runtime-e-permissao/copy.md` |
| `permission.label.params` | Parâmetros | `<details>` fechado por padrão |
| `permission.hint` | Escolher aqui concede na hora — ou digite sim/não/permitir todos e envie. | anuncia os dois gatilhos |
| `permission.deny` | Negar | chip; nega na hora |
| `permission.allow` | Permitir | chip; concede na hora, só esta chamada |
| `permission.allowAll` | Permitir todos | chip; “don’t ask again” por toolName **nesta thread** (memória do processo) |
| `permission.allowAll.hint` | Não perguntar de novo por esta ferramenta nesta thread (padrão Claude Code). | |
| `permission.allowProject` | Sempre neste projeto | chip; escopo persistido, sobrevive a reinício |
| `permission.allowProject.title` | Não perguntar mais por esta ferramenta neste projeto, mesmo depois de reiniciar | `title` do chip |
| `permission.composer.pending` | Há uma permissão pendente. Digite sim/não/permitir todos (ou escolha no card do chat). | `waiting_permission` sem gate conhecido localmente (WS perdido): não há gate a resolver, então o texto não vira decisão nem fila |

Os quatro rótulos de chip (`Permitir`, `Permitir todos`, `Sempre neste projeto`, `Negar`) são também o texto exato que o clique escreve no composer; mudá-los aqui muda o que o roteador de envio precisa reconhecer.

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
| — | Seção `permission` descrevia modal com CTAs próprios; `ui.md` e o código já usam card inline com clique → composer → Enviar | resolvido em 2026-08-13 |
