# Spec de UI: #principal (Workspace)

**Feature:** F03-workspace  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/PrincipalScreen.tsx` (+ `usePrincipalWorkspace.ts`, `ProjectTree.tsx`, `AddProjectModal.tsx`, `TaskComposer.tsx`, `ChatHistory.tsx`, `DiffViewer.tsx`, `GitActions.tsx`, `WorkspaceSidebar.tsx`, `ComposerControlsMenu.tsx`, `PermissionPrompt.tsx`)  
**Componente destino (previsto):** `packages/renderer/src/screens/PrincipalScreen.tsx` (e satélites acima)  
**Última atualização:** 2026-08-04 (diff por arquivo fechado)

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F03-workspace/ui/principal-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `docs/F03-workspace/ui/principal-referencia.png` (mesmo frame dark) |

> Mock dark pós-unlock: ≥1 projeto, thread com histórico, aba Diff com pending, seção Repositório visível.

## Escopo

**Inclui:** layout de `#principal` necessário ao Escopo Central F03; anatomia das três colunas; copy literal (rename de marca); estados de UI; tokens/padrões de superfície; aceite visual.

Histórias cobertas (Central):

1. Cadastrar pasta local como projeto e criar threads (Claude \| Codex \| Kimi + access + execution)
2. Enviar mensagens com streaming, tool calls, histórico persistente e fila de follow-up se ocupada
3. Revisar diffs **por arquivo** (status pending \| accepted \| rejected); accept/reject por subset de paths/ids (contrato destino; ver conflito com fonte)
4. Commit, push e abrir PR no GitHub a partir do workspace, bloqueados com thread running; PAT do vault
5. Lease: segunda execução longa no mesmo projeto → `thread_busy`
6. Composer gated por saúde F02 (CLI/assinatura); injeta `prompt:global` se não vazio (comportamento; superfície mínima)
7. Repo Harness: contagens e vínculos reais F05–F07 (`ProjectSkillsModal` / Rules / SubAgents); turno consome registries (spec F03)

**Exclui:** contratos HTTP/IPC/SQL (ficam no `spec.md`); implementação de primitives; blocos da fonte fora do núcleo Central.

### Observado na fonte e fora deste SDD (núcleo Central)

Não exigir no aceite visual deste SDD (podem existir no legado):

1. `TerminalDock` (PTY)
2. Seções CodeGraph / Memória / Pipeline / Build na sidebar direita
3. Banner “Nenhuma API key configurada” genérico multi-provider (GLM/Minimax) — F10; MVP prefere indisponibilidade por CLI/assinatura (F02)
4. Avisos de reject específicos de workflow/pipeline (`/featdevelop`)
5. Command palette completa além dos atalhos “Adicionar projeto” / “Nova thread”
6. Card `SubagentActivity` rico, `UsageLimits`, voz/ditado, anexos de imagem
7. Providers extras no picker (GLM, MiniMax, Grok) — MVP: Claude \| Codex \| Kimi

## Anatomia (topo → base)

Ordem obrigatória no viewport (conteúdo sob o `AppShell` ~40px):

1. **Grid workspace** `h-[calc(100vh-40px)] gap-sm p-sm` em 3 colunas: esquerda (~300px, 220–440) | centro (`1fr`) | direita (~300px, 240–480).
2. **Sidebar esquerda (card):** header “Projetos” (CSS `uppercase`) + botão `+` + árvore de projetos/threads + footer “Adicionar projeto”.
3. **Painel central:**
   1. (Opcional legado) QuickActions / ConfigBanner — fora do aceite núcleo
   2. Conteúdo da aba ativa: `ChatHistory` (Histórico) / `SystemPrompt` (Prompt, via Harness) / `DiffViewer` (Diff)
   3. `TaskComposer` (`max-w-5xl`): fila + textarea + pills de runtime + enviar/parar
4. **Sidebar direita (card `WorkspaceSidebar`):** “Nova Thread” + seções colapsáveis Ambiente / Arquivos / Thread (Histórico \| Diff) / **Repositório** (`GitActions`) / **Repo Harness** (Prompt; Rules/Skills/SubAgents com counts e modais reais).
5. **Overlays:** `AddProjectModal`; `PermissionPrompt` (access Supervised); erros inline no composer.

**Alinhamento do card / painel:** sidebars em cartões soltos (`rounded-xl border border-border bg-surface`); centro com composer `mx-auto max-w-5xl`  
**Largura máx.:** centro chat/composer `max-w-5xl`; modal adicionar projeto `max-w-md` / card padrão

### Fluxo: criar thread (sem modal dedicado)

Observado na fonte: **não há modal “Nova thread”**. “Nova Thread” / `+` no projeto zera a seleção (`selectedThreadId = null`); o usuário configura provider/modelo/access/execution nos pills do composer e o **primeiro envio** cria a thread via `dispatchTask`. Execution mode **trava após o primeiro envio**. Provider **imutável** após criar.

### Diff: destino Central × fonte

| Camada | Comportamento |
|--------|----------------|
| **Destino Central (fechado neste SDD)** | Status por arquivo (pending \| accepted \| rejected); accept/reject por **arquivo** e por **subset** (paths/ids selecionados) |
| **Fonte observada** | Lista visual por arquivo (`DiffFile` / dfhead); CTAs só no rodapé aplicam o **conjunto** pending |

Contrato visual destino (delta sobre a fonte):

1. **Header de cada arquivo (`dfhead`)** — ordem L→R: checkbox (só se `pending`) → ícone → path mono → badge de status → `+N`/`-N` + provider → ações **Aceitar** / **Rejeitar** (só se `pending`).
2. **Sem ações no hunk** — review é por arquivo (id/path), não por hunk.
3. **Toolbar de seleção** (acima da lista, opcional quando ≥2 pending): “Selecionar todos” / “Limpar seleção” + meta “{N} selecionado(s)”.
4. **Rodapé de ações:**
   - seleção vazia → `Aceitar mudanças` / `Rejeitar` = todos os pending (equivale a subset = todos os ids pending);
   - seleção ≥1 → `Aceitar selecionados ({N})` / `Rejeitar selecionados ({N})` = subset marcado;
   - zero pending restantes → CTAs de review ocultos; “Abrir PR” / estado pós-review como na fonte.
5. **API destino:** `acceptDiff` (ou equivalente) recebe `action` + lista de `ids`/`paths`; UI nunca inventa apply parcial sem ids explícitos.

Badge de status (destino):

| Status | Badge | Aparência extra |
|--------|-------|-----------------|
| `pending` | `pendente` | checkbox + Aceitar/Rejeitar no header |
| `accepted` | `aceito` | tom `text-green` / borda suave; sem ações |
| `rejected` | `rejeitado` | tom `text-muted` + `opacity` leve no card; sem ações |

### Abas Thread

Na sidebar direita, seção Thread: só **Histórico** \| **Diff**. A aba **Prompt** (`systemprompt`) abre pela linha **Prompt** do Repo Harness (fonte evita duplicar).

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página (grid) | `h-[calc(100vh-40px)] gap-sm p-sm` sobre `bg-bg text-fg` do shell | colunas com larguras persistidas |
| Card sidebar | `rounded-xl border border-border bg-surface` | fonte: border com color-mix; destino preferir token |
| Header sidebar esq. | `text-[11px] font-bold uppercase tracking-[0.07em] text-muted` | literal “Projetos” |
| Empty projetos | `text-muted` body/caption | |
| Chat / composer coluna | `max-w-5xl mx-auto` | |
| Composer shell | `rounded-xl border border-border bg-surface-2` + `focus-within:border-accent focus-within:ring-2 focus-within:ring-accent/25` | |
| Textarea | `bg-transparent text-fg` + `placeholder:text-muted` | |
| Pill runtime | `rounded-md` / menu `rounded-lg border border-border bg-surface` | labels EN nos pills Access/Execution |
| CTA enviar | `bg-accent` / ícone; parar quando running | |
| Aba Diff badge | `text-amber` / `bg-amber/[0.14]` | contagem pending |
| Diff add/del | cores de diff (legado hex `#7ee787` / `#ff9a9a`) | token-gap vs Design Lock |
| Git botões | `rounded-full border-border bg-surface-2` | disabled quando busy |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` / borda red em inputs inválidos | |
| Sucesso | `text-green` | |
| Aviso | `text-amber` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Wordmark app bar | sistema legado | EngrenaCode |
| Erro rede modal projeto | “Verifique se o sistema legado esta em execucao.” | EngrenaCode |
| Banner Git init (composer) | “O sistema legado precisa de um commit inicial…” | EngrenaCode |
| Placeholder nome projeto | marca no exemplo (sistema legado) | `ex: engrenacode-shell` |
| localStorage sidebars/fila | prefixo do sistema legado (`*.sidebar.*`, `*.message-queue.v1`) | `engrenacode.*` (F01.1 / migração) |
| Header HTTP sessão | header de sessão do sistema legado | `X-EngrenaCode-Session` (spec; não user-visible) |
| Type sizes pills/VCS | ~10.5px–13.5px mono | papel caption/mono até type-scale |
| Diff chrome colors | hex soltos | token-gap (manter ou mapear status) |
| `Inicializar Git` (composer + GitActions) | CTA unificado | copy `composer.gitGate.cta` / `git.quick.init` |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `sistema legado → EngrenaCode`. Células = texto final no destino.

### Projeto (sidebar + modal)

| Slot | Texto |
|------|-------|
| `sidebar.projects.header` | Projetos |
| `sidebar.projects.empty` | Nenhum projeto ainda. Adicione um repositório git local para começar. |
| `sidebar.projects.add` | Adicionar projeto |
| `sidebar.projects.collapse` | Recolher projetos |
| `sidebar.projects.expand` | Expandir projetos |
| `sidebar.projects.remove` | Remover projeto |
| `sidebar.projects.remove.confirm` | Remover o projeto "{name}"? As threads dele serao apagadas (os arquivos no disco permanecem). |
| `sidebar.threads.empty` | Nenhuma thread ainda. |
| `sidebar.threads.new` | Nova thread |
| `sidebar.threads.loading` | Carregando… |
| `sidebar.threads.error` | Falha ao carregar as threads. |
| `modal.addProject.title` | Adicionar projeto |
| `modal.addProject.close` | Fechar |
| `modal.addProject.label.path` | Diretório local |
| `modal.addProject.placeholder.path` | /caminho/do/repositorio |
| `modal.addProject.browse` | Procurar… |
| `modal.addProject.hint.path` | Selecione um diretório existente que contém um repositório git. |
| `modal.addProject.label.name` | Nome do projeto |
| `modal.addProject.label.name.optional` | (opcional) |
| `modal.addProject.placeholder.name` | ex: engrenacode-shell |
| `modal.addProject.hint.name` | Quando vazio, usamos o nome do diretório. |
| `modal.addProject.cta.cancel` | Cancelar |
| `modal.addProject.cta.primary` | Adicionar |
| `modal.addProject.cta.loading` | Adicionando... |
| `modal.addProject.error.network` | Nao foi possivel contatar o servidor local. Verifique se o EngrenaCode esta em execucao. |
| `modal.addProject.error.generic` | Nao foi possivel adicionar o projeto. Tente novamente. |
| `modal.addProject.error.duplicate` | Este diretório já foi adicionado como projeto. |
| `modal.addProject.error.notFound` | O caminho informado não existe no sistema de arquivos. |
| `modal.addProject.error.notDir` | O caminho informado não é um diretório. |
| `modal.addProject.error.permission` | Sem permissão de leitura no diretório informado. |
| `modal.addProject.error.notGit` | O diretório não é um repositório git (.git ausente). |
| `modal.addProject.error.access` | Não foi possível acessar o caminho informado. |
| `modal.addProject.error.invalid` | Informe um caminho de diretório válido. |

### Thread / composer (criar + enviar)

| Slot | Texto |
|------|-------|
| `sidebar.right.newThread` | Nova Thread |
| `composer.placeholder.new` | Descreva a task para o agente…  (Enter envia) |
| `composer.placeholder.followUp` | Responder nesta conversa…  (Enter envia, Shift+Enter quebra linha) |
| `composer.placeholder.running` | Agente trabalhando — Enter enfileira para o próximo turno |
| `composer.placeholder.stopping` | Cancelando execução… |
| `composer.pill.access.group` | Access |
| `composer.pill.access.supervised` | Supervised |
| `composer.pill.access.autoAccept` | Auto-accept edits |
| `composer.pill.access.fullAccess` | Full access |
| `composer.pill.execution.group` | Execution |
| `composer.pill.execution.main` | Main |
| `composer.pill.execution.worktree` | Worktree |
| `composer.lock.queue` | Fila de mensagens pendente — esvazie a fila para alterar o runtime. |
| `composer.lock.running` | Agente executando — altere o runtime quando o turno terminar. |
| `composer.lock.provider` | Modelos do provider da thread — o provider é imutável. |
| `composer.gitGate.title` | Inicialize o Git para conversar com o agente |
| `composer.gitGate.body` | O EngrenaCode precisa de um commit inicial para proteger e acompanhar as alterações do agente. |
| `composer.gitGate.cta` | Inicializar Git |
| `composer.gitGate.cta.loading` | Inicializando Git… |
| `composer.gitGate.error.network` | Não foi possível contatar o servidor local. |
| `composer.gitGate.error.generic` | Não foi possível inicializar o Git. |
| `composer.send` | Enviar |
| `composer.send.title` | Enviar (Enter) |
| `composer.send.stop` | Parar execução |
| `composer.send.stopping` | Cancelando execução |
| `composer.send.waitingServer` | Aguardando confirmação do servidor |
| `composer.error.send` | Falha ao enviar a mensagem. |
| `composer.error.network` | Não foi possível contatar o servidor local. |
| `composer.error.capabilities` | Não foi possível validar as capacidades efetivas. |
| `composer.cta.retry` | Tentar novamente |
| `queue.badge.queued` | na fila |
| `queue.badge.sending` | enviando |
| `queue.badge.paused` | pausada |
| `queue.badge.error` | erro |
| `queue.chat.queued` | na fila — vai no próximo turno |
| `queue.chat.sending` | enviando… |
| `queue.chat.paused` | pausada |
| `queue.chat.failed` | falhou — veja o composer |
| `queue.action.edit` | Editar |
| `queue.action.save` | Salvar |
| `queue.action.cancel` | Cancelar |
| `queue.action.retry` | Tentar novamente |
| `error.threadBusy` | Thread {threadId} esta em execucao ou o projeto esta ocupado; tente novamente. |

### Histórico / tools / Prompt

| Slot | Texto |
|------|-------|
| `thread.tab.history` | Histórico |
| `thread.tab.diff` | Diff |
| `thread.tab.prompt` | Prompt |
| `thread.tabs.disabled` | Abra uma thread para navegar nas abas |
| `chat.loading` | Carregando histórico… |
| `chat.error` | Falha ao carregar o histórico da thread. |
| `chat.empty.thread` | Sem mensagens ainda. O histórico aparece conforme o agente executa. |
| `chat.empty.noThread` | Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral. |
| `chat.thinking` | Pensando… {Xs} |
| `chat.thought` | Pensou por {Xs} |
| `chat.workLog` | Work log ({N}) |
| `chat.workLog.working` | trabalhando… |
| `chat.tool.interrupted` | interrompida |
| `chat.tool.completed` | concluído |
| `chat.tool.cancelled` | cancelado |
| `chat.tool.error` | erro |
| `prompt.title` | Prompt desta thread |
| `prompt.placeholder` | Defina o comportamento do agente para esta thread… |
| `prompt.hint` | Aplicado a todas as próximas mensagens desta thread, em qualquer provider. |
| `prompt.cta.save` | Salvar prompt |
| `prompt.cta.loading` | Salvando… |

### Diff

| Slot | Texto |
|------|-------|
| `diff.empty` | Nenhuma mudança proposta. O diff aparece quando o agente termina a execução. |
| `diff.summary.files.one` | {N} arquivo |
| `diff.summary.files.many` | {N} arquivos |
| `diff.mode.unified` | Unificado |
| `diff.mode.split` | Lado a lado |
| `diff.mode.aria` | Modo de visualização do diff |
| `diff.select.all` | Selecionar todos |
| `diff.select.none` | Limpar seleção |
| `diff.select.meta.one` | {N} selecionado |
| `diff.select.meta.many` | {N} selecionados |
| `diff.file.status.pending` | pendente |
| `diff.file.status.accepted` | aceito |
| `diff.file.status.rejected` | rejeitado |
| `diff.file.select.aria` | Selecionar {file} |
| `diff.file.accept` | Aceitar |
| `diff.file.accept.aria` | Aceitar {file} |
| `diff.file.accept.loading` | Aplicando… |
| `diff.file.reject` | Rejeitar |
| `diff.file.reject.aria` | Rejeitar {file} |
| `diff.file.reject.loading` | Rejeitando… |
| `diff.cta.accept` | Aceitar mudanças |
| `diff.cta.accept.loading` | Aplicando… |
| `diff.cta.accept.selected` | Aceitar selecionados ({N}) |
| `diff.cta.reject` | Rejeitar |
| `diff.cta.reject.loading` | Rejeitando… |
| `diff.cta.reject.selected` | Rejeitar selecionados ({N}) |
| `diff.after.accept` | Mudanças aplicadas |
| `diff.after.reject` | Mudanças rejeitadas. O worktree foi descartado e a thread não foi aprovada. |
| `diff.cta.openPr` | Abrir PR |
| `diff.cta.openPr.loading` | Abrindo PR… |
| `diff.pr.success` | PR aberto com sucesso: |
| `diff.pr.existing` | PR já existente reapresentado: |
| `diff.error.conflict` | Conflito ao aplicar: {message} |
| `diff.error.apply` | Não foi possível aplicar as mudanças. O diff segue pendente. |
| `diff.error.openPr` | Falha ao abrir o PR. A thread está em erro. |

> **Fonte × destino:** CTAs de lote (`Aceitar mudanças` / `Rejeitar`) e empty/modes vêm da fonte. Labels por arquivo, status badge e “selecionados” são **contrato destino** (fechados neste SDD; ausentes na fonte).

### Git (Repositório)

| Slot | Texto |
|------|-------|
| `git.section` | Repositório |
| `git.hint.noThread` | Abra uma thread para executar ações de git |
| `git.hint.stage` | Ação de git em andamento. |
| `git.hint.statusPending` | Status do repositório ainda não carregado. |
| `git.hint.detached` | HEAD destacada — faça checkout de uma branch antes. |
| `git.hint.diverged` | Branch divergiu do upstream — rebase/merge manual primeiro. |
| `git.hint.behind` | Branch atrás do upstream — faça pull manualmente. |
| `git.hint.clean` | Tudo em dia — nada a commitar ou pushar. |
| `git.quick.init` | Inicializar Git |
| `git.quick.commit` | Commit |
| `git.quick.commitPush` | Commit & push |
| `git.quick.commitPushPr` | Commit, push & PR |
| `git.quick.push` | Push |
| `git.quick.viewPr` | Ver PR |
| `git.stage.init` | Inicializando repositório… |
| `git.stage.commitMsg` | Gerando mensagem de commit… |
| `git.stage.committing` | Commitando… |
| `git.stage.pushing` | Pushando… |
| `git.stage.stackPr` | Commitando, pushando e abrindo o PR… |
| `git.confirm.defaultBranch` | Esta ação vai pushar direto na branch default {refName}. Continuar? |
| `git.confirm.continue` | Continuar em {refName} |
| `git.confirm.cancel` | Cancelar |
| `sidebar.right.noProject` | Selecione um projeto para ver o ambiente, os vínculos e as ações do repositório. |
| `sidebar.right.ambiente` | Ambiente |
| `sidebar.right.arquivos` | Arquivos |
| `sidebar.right.thread` | Thread |
| `sidebar.right.harness` | Repo Harness |
| `harness.prompt` | Prompt |
| `harness.rules` | Rules |
| `harness.rules.meta` | {N} ativa \| {N} ativas |
| `harness.skills` | Skills |
| `harness.subagents` | SubAgents |
| `harness.link.count` | {N} vinculado \| {N} vinculados |

### Permission (Supervised)

| Slot | Texto |
|------|-------|
| `permission.title` | Permitir a ferramenta {toolName}? |
| `permission.queue` | +{N} na fila |
| `permission.label.tool` | Ferramenta |
| `permission.label.params` | Parâmetros |
| `permission.deny` | Negar |
| `permission.allow` | Permitir |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `addProject.path` | text + browse | sim | path existente; fonte exige repo git |
| `addProject.name` | text | não | default = basename do path |
| `addProject.submit` | button | — | disabled se path vazio / loading |
| `newThread` | button | — | limpa thread selecionada; não abre modal |
| `composer.providerModel` | pill/picker | sim (1º envio) | MVP: Claude \| Codex \| Kimi; provider imutável após criar |
| `composer.access` | pill select | sim | Supervised / Auto-accept edits / Full access |
| `composer.execution` | pill select | sim | Main / Worktree; **locked** após 1º envio |
| `composer.textarea` | textarea | sim p/ enviar | Enter envia; Shift+Enter quebra; Enter em running enfileira |
| `composer.send` | button | — | vira Parar quando running; gated por F02 |
| `queue.chip` | chip editável | — | editar / remover / retry |
| `thread.tabs` | tabs | — | Histórico / Diff na sidebar; Prompt via Harness |
| `diff.file.checkbox` | checkbox | — | só `pending`; alimenta subset |
| `diff.file.accept` / `diff.file.reject` | buttons | — | 1 arquivo (id/path); loading por card |
| `diff.select.all` / `diff.select.none` | buttons | — | ≥2 pending |
| `diff.accept` / `diff.reject` | buttons | — | seleção vazia → todos pending; senão → subset |
| `git.quick` + ações | buttons | — | `disabled` se `busy` (running thread ou stage); PAT vault no push/PR |
| `permission.allow` / `deny` | buttons | — | fila Supervised; Esc/backdrop = deny |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | projeto selecionado, composer pronto | pills editáveis; enviar habilitado |
| `noProject` | zero projetos | empty sidebar + CTA Adicionar projeto |
| `noThread` | projeto sem thread selecionada | empty chat + composer “nova conversa” |
| `filling` | digitar no composer / modal | limpa erro local |
| `loading` | dispatch / add project / accept-diff / git stage | spinners / labels de estágio |
| `disabled` | validação, locks de runtime, git busy, F02 unhealthy | CTAs disabled + hints |
| `error` | falha API / validação | slot vermelho (modal, composer, diff, git) |
| `running` | `thread.state === 'running'` | placeholder fila; botão Parar; runtime locked; **git disabled** |
| `stopping` | cancel em andamento | “Cancelando execução…”; textarea disabled |
| `queued` | Enter durante running | chips na fila + bolhas no chat |
| `repositoryBlocked` | pasta sem git utilizável | gate “Inicialize o Git…” |
| `diffPending` | ≥1 diff `pending` | aba Diff com badge; ações no header + rodapé |
| `diffFileAccepted` | arquivo `accepted` | badge `aceito`; sem checkbox/ações |
| `diffFileRejected` | arquivo `rejected` | badge `rejeitado`; card atenuado |
| `diffSelecting` | ≥1 checkbox marcado | rodapé troca para “selecionados ({N})” |
| `diffAccepted` / `diffRejected` | todos revisados / reject terminal | banners de sucesso/rejeição; Abrir PR se aplicável |
| `thread_busy` | HTTP 409 `thread_busy` | mensagem `error.threadBusy` no ponto da ação; **sem** badge dedicado na fonte |
| `gitBusy` | stage ≠ null **ou** thread running | botões git disabled |
| `permissionOpen` | tool call Supervised | modal Permitir/Negar |
| `harnessLive` | F05–F07 | Skills/Rules/SubAgents com counts e modais reais |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | sidebars esquerda/direita; modal adicionar projeto |
| `Field` | path/nome no modal; hints/erros |
| `Input` / `Textarea` | modal + composer + prompt |
| `Button` | Adicionar, Nova Thread, Aceitar/Rejeitar, git quick, permission |
| `Tabs` | Histórico / Diff (e Prompt via Harness) |
| `Pill` / `MenuRadioGroup` | provider/modelo, Access, Execution |
| `Badge` | contagem Diff; status fila; meta Harness |
| `EmptyState` | projetos, chat, diff |
| `DiffFile` | card por arquivo; dfhead com checkbox + badge + Aceitar/Rejeitar |
| `Checkbox` | seleção de subset pending |
| `Badge` | status pendente / aceito / rejeitado |
| `Modal` / `Dialog` | AddProjectModal, PermissionPrompt |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável)
- [ ] Anatomia 3 colunas na ordem documentada; sem H1 de marca extra no centro
- [ ] Tabela de copy aplicada (modal projeto, composer, chat, diff, git, permission) com rename EngrenaCode
- [ ] Criar thread = limpar seleção + 1º envio no composer (sem modal fantasma)
- [ ] Pills Access/Execution com labels documentados; Execution locked após 1º envio; provider imutável
- [ ] Providers picker MVP: Claude \| Codex \| Kimi
- [ ] Running: placeholder de fila, Parar, git disabled
- [ ] Diff: badge de status por arquivo; Aceitar/Rejeitar no `dfhead` quando pending
- [ ] Subset: checkbox + rodapé “selecionados ({N})”; sem seleção = todos pending
- [ ] Sem ações por hunk; API sempre com ids/paths explícitos
- [ ] `thread_busy` exibe mensagem de erro legível (não silêncio)
- [ ] Composer gated por saúde F02; Harness Skills/Rules/SubAgents com counts e modais reais
- [ ] Tema `light` \| `dark` \| `system` via tokens (sem hex solto fora de token-gap documentado)
- [ ] Terminal/CodeGraph/Memória/pipeline/SubagentActivity rico **não** bloqueiam aceite deste SDD

## Perguntas em aberto

Nenhuma. Fechadas em 2026-08-04 (spec-writer F03 + entrevista):

| Tema | Decisão |
|------|--------|
| `.git` no add project | Soft: `POST /api/projects` **não** exige `.git`; gate de conversa via `git-init` / composer (`composer.gitGate.*`) |
| CTA Inicializar Git | Unificar em **Inicializar Git** (G maiúsculo) em composer e GitActions; ids `composer.gitGate.cta` e `git.quick.init` |
| Fila localStorage | Prefixo `engrenacode.message-queue.v1` nesta feature (não legado) |
| `thread_busy` | UI usa o texto de `principal.error.threadBusy` / API (ortografia da fonte); normalização acentuada fica fora do Central |
| Harness | Integração real F05–F07 (sem stubs zeros) |

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F03-workspace/spec.md` | Contratos técnicos (dispatch, lease, accept-diff com `ids`, git) |
| `_reversa_sdd/sdd/workspace.md` | Spec SDD comportamental F03 |
| `docs/F02-configuracao-mvp/ui.md` | Saúde de providers / PAT que habilitam composer e git |
| `docs/F05-skills/ui.md` | Overlay Skills do Harness |
| `docs/F06-rules/ui.md` | Overlay Rules do Harness |
| `docs/F07-subagents/ui.md` | Overlay SubAgents + activity |
| `docs/design-system/` ou `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |
| `docs/F03-workspace/copy.md` | Catálogo de microcopy |
