# Spec de UI: #principal (Workspace)

**Feature:** F03-workspace  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer`) — anatomia/copy; destino greenfield em `src/renderer`  
**Componente fonte:** `packages/renderer/src/screens/PrincipalScreen.tsx` (+ `usePrincipalWorkspace.ts`, `ProjectTree.tsx`, `AddProjectModal.tsx`, `TaskComposer.tsx`, `ChatHistory.tsx`, `DiffViewer.tsx`, `GitActions.tsx`, `WorkspaceSidebar.tsx`, `ComposerControlsMenu.tsx`)  
**Componente destino (previsto):** `src/renderer/screens/PrincipalScreen.tsx` (+ satélites equivalentes sob `src/renderer/`)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `TODO` — capturar e versionar em `docs/F03-workspace/ui/principal-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` |

> PNG ainda não versionado. Preferir captura dark pós-unlock com: ≥1 projeto, thread com histórico, aba Diff com pending, seção Repositório visível.

## Escopo

**Inclui:** layout de `#principal` necessário às histórias F03 abaixo; anatomia das três colunas; copy literal (com rename de marca); estados de UI; tokens/padrões de superfície; aceite visual.

Histórias cobertas:

1. Cadastrar pasta local como projeto e criar threads (provider, modelo, access level, execution mode)
2. Enviar mensagens com streaming, tool calls, histórico persistente e fila de follow-up se ocupada
3. Revisar diffs (lista por arquivo; ações de review conforme fonte)
4. Commit, push e abrir PR no GitHub a partir do workspace, bloqueados com thread running
5. Lease: segunda execução longa no mesmo projeto → `thread_busy`

**Exclui:** contratos HTTP/IPC/SQL (ficam no `spec.md`); implementação de primitives; blocos da fonte fora do núcleo F03 destas histórias.

### Observado na fonte e fora deste SDD (núcleo das histórias)

Não exigir no aceite visual deste SDD (podem existir no legado):

1. `TerminalDock` (PTY) — PRD: fora até escopo separado
2. Seções CodeGraph / Memória / Pipeline na sidebar direita — PRD: fora do MVP F03
3. Banner “Nenhuma API key configurada” genérico multi-provider (GLM/Minimax) — PRD: API keys = F10; no MVP preferir indisponibilidade por CLI/assinatura (F02)
4. Avisos de reject específicos de workflow/pipeline (`/featdevelop`) — PRD: fora
5. Command palette completa além dos atalhos “Adicionar projeto” / “Nova thread” — opcional

## Anatomia (topo → base)

Ordem obrigatória no viewport (conteúdo sob o `AppShell` ~40px):

1. **Grid workspace** `h-[calc(100vh-40px)] gap-sm p-sm` em 3 colunas: esquerda (~300px) | centro (`1fr`) | direita (~300px).
2. **Sidebar esquerda (card):** header “PROJETOS” + botão `+` + árvore de projetos/threads + footer “Adicionar projeto”.
3. **Painel central:**
   1. (Opcional legado) QuickActions / ConfigBanner — fora do aceite núcleo se F10
   2. `ThreadDetail`: abas **Histórico** | **Prompt** | **Diff** (badge âmbar com contagem)
   3. Conteúdo da aba ativa (`ChatHistory` / prompt / `DiffViewer`), coluna centrada `max-w-5xl`
   4. `TaskComposer` (`max-w-5xl`): fila + textarea + pills de runtime + enviar/parar
4. **Sidebar direita (card `WorkspaceSidebar`):** “Nova Thread” + seções colapsáveis Ambiente / Arquivos / Thread (espelha abas) / **Repositório** (`GitActions`) / Repo Harness (atalhos; vínculo fora do detalhe deste SDD).
5. **Overlays:** `AddProjectModal`; `PermissionPrompt` (access Supervised); erros inline no composer.

**Alinhamento do card / painel:** sidebars em cartões soltos (`rounded-xl border border-border bg-surface`); centro alinhado à coluna com conteúdo `mx-auto max-w-5xl`  
**Largura máx.:** centro chat/composer `max-w-5xl`; modal adicionar projeto conforme fonte (`max-w-md` / card padrão)

### Fluxo: criar thread (sem modal dedicado)

Observado na fonte: **não há modal “Nova thread”**. “Nova Thread” / `+` no projeto zera a seleção (`selectedThreadId = null`); o usuário configura provider/modelo/access/execution nos pills do composer e o **primeiro envio** cria a thread via `dispatchTask`. Execution mode **trava após o primeiro envio**.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página (grid) | `h-[calc(100vh-40px)] gap-sm p-sm` sobre `bg-bg text-fg` do shell | colunas com larguras persistidas |
| Card sidebar | `rounded-xl border border-border bg-surface` | esquerda e direita |
| Header sidebar esq. | `text-muted` uppercase “PROJETOS” + ícones | |
| Empty projetos | `text-muted` body/caption | |
| Chat / composer coluna | `max-w-5xl mx-auto` | |
| Composer shell | `rounded-lg border border-border bg-surface` (ou surface-2 interno) | pills em linha |
| Textarea | `bg-transparent text-fg` + placeholder muted | |
| Pill runtime | `rounded-full border border-border bg-surface-2 text-fg` | labels EN nos pills Access/Execution |
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
| Wordmark app bar | LionCode | EngrenaCode |
| Erro rede modal projeto | “Verifique se o LionCode esta em execucao.” | EngrenaCode |
| Banner Git init | “O LionCode precisa de um commit inicial…” | EngrenaCode |
| Placeholder nome projeto | `ex: lioncode-shell` | `ex: engrenacode-shell` (ou genérico) |
| localStorage sidebars/fila | `lioncode.sidebar.*`, `lioncode.message-queue.v1` | `engrenacode.*` (F01.1 / migração) |
| Type sizes pills/VCS | ~10.5px–13.5px mono | papel caption/mono até type-scale |
| Diff chrome colors | hex soltos | token-gap (manter ou mapear status) |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`. Células = texto final no destino.

### Projeto (sidebar + modal)

| Slot | Texto |
|------|-------|
| `sidebar.projects.header` | PROJETOS |
| `sidebar.projects.empty` | Nenhum projeto ainda. Adicione um repositório git local para começar. |
| `sidebar.projects.add` | Adicionar projeto |
| `modal.addProject.title` | Adicionar projeto |
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
| `composer.send.stop` | Parar execução |
| `composer.send.stopping` | Cancelando execução |
| `queue.badge.queued` | na fila |
| `queue.badge.sending` | enviando |
| `queue.badge.paused` | pausada |
| `queue.badge.error` | erro |
| `queue.chat.queued` | na fila — vai no próximo turno |
| `queue.chat.sending` | enviando… |
| `queue.chat.paused` | pausada |
| `queue.chat.failed` | falhou — veja o composer |
| `error.threadBusy` | Thread {threadId} esta em execucao ou o projeto esta ocupado; tente novamente. |

### Histórico / tools

| Slot | Texto |
|------|-------|
| `thread.tab.history` | Histórico |
| `thread.tab.prompt` | Prompt |
| `thread.tab.diff` | Diff |
| `chat.loading` | Carregando histórico… |
| `chat.error` | Falha ao carregar o histórico da thread. |
| `chat.empty.thread` | Sem mensagens ainda. O histórico aparece conforme o agente executa. |
| `chat.empty.noThread` | Envie uma mensagem abaixo para iniciar uma thread, ou selecione uma na barra lateral. |
| `chat.thinking` | Pensando… {Xs} |
| `chat.thought` | Pensou por {Xs} |
| `chat.workLog` | Work log ({N}) |
| `chat.workLog.working` | trabalhando… |
| `chat.tool.interrupted` | interrompida |

### Diff

| Slot | Texto |
|------|-------|
| `diff.empty` | Nenhuma mudança proposta. O diff aparece quando o agente termina a execução. |
| `diff.summary.files` | {N} arquivo(s) |
| `diff.mode.unified` | Unificado |
| `diff.mode.split` | Lado a lado |
| `diff.cta.accept` | Aceitar mudanças |
| `diff.cta.accept.loading` | Aplicando… |
| `diff.cta.reject` | Rejeitar |
| `diff.cta.reject.loading` | Rejeitando… |
| `diff.after.accept` | Mudanças aplicadas |
| `diff.after.reject` | Mudanças rejeitadas. O worktree foi descartado e a thread não foi aprovada. |
| `diff.cta.openPr` | Abrir PR |
| `diff.cta.openPr.loading` | Abrindo PR… |
| `diff.pr.success` | PR aberto com sucesso: |
| `diff.pr.existing` | PR já existente reapresentado: |
| `diff.error.conflict` | Conflito ao aplicar: {message} |

> **Conflito PRD × fonte:** a história pede accept/reject **arquivo a arquivo**. Na fonte, a lista é por arquivo, mas **Aceitar mudanças / Rejeitar** aplicam-se ao **conjunto** de diffs pendentes. Ver Perguntas em aberto.

### Git (Repositório)

| Slot | Texto |
|------|-------|
| `git.hint.noThread` | Abra uma thread para executar ações de git |
| `git.busy.running` | (botões disabled quando `thread.state === 'running'` ou stage git ≠ null) |
| `git.hint.stage` | Ação de git em andamento. |
| `git.quick.commit` | Commit |
| `git.quick.commitPush` | Commit & push |
| `git.quick.commitPushPr` | Commit, push & PR |
| `git.quick.push` | Push |
| `git.quick.viewPr` | Ver PR |
| `git.stage.commitMsg` | Gerando mensagem de commit… |
| `git.stage.committing` | Commitando… |
| `git.stage.pushing` | Pushando… |
| `git.stage.stackPr` | Commitando, pushando e abrindo o PR… |
| `git.confirm.defaultBranch` | Esta ação vai pushar direto na branch default {refName}. Continuar? |
| `git.confirm.continue` | Continuar em {refName} |
| `git.confirm.cancel` | Cancelar |
| `sidebar.right.noProject` | Selecione um projeto para ver o ambiente, os vínculos e as ações do repositório. |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `addProject.path` | text + browse | sim | path existente; preferir repo git |
| `addProject.name` | text | não | default = basename do path |
| `addProject.submit` | button | — | disabled se path vazio / loading |
| `newThread` | button | — | limpa thread selecionada; não abre modal |
| `composer.providerModel` | pill/picker | sim (1º envio) | provider imutável após criar thread |
| `composer.access` | pill select | sim | Supervised / Auto-accept edits / Full access |
| `composer.execution` | pill select | sim | Main / Worktree; **locked** após 1º envio |
| `composer.textarea` | textarea | sim p/ enviar | Enter envia; Shift+Enter quebra; Enter em running enfileira |
| `composer.send` | button | — | vira Parar quando running |
| `queue.chip` | chip editável | — | editar / remover / retry |
| `thread.tabs` | tabs | — | Histórico / Prompt / Diff; Diff mostra badge |
| `diff.accept` / `diff.reject` | buttons | — | conjunto pending; loading states |
| `git.quick` + ações | buttons | — | `disabled` se `busy` (running thread ou stage) |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | projeto selecionado, composer pronto | pills editáveis; enviar habilitado |
| `noProject` | zero projetos | empty sidebar + CTA Adicionar projeto |
| `noThread` | projeto sem thread selecionada | empty chat + composer “nova conversa” |
| `filling` | digitar no composer / modal | limpa erro local |
| `loading` | dispatch / add project / accept-diff / git stage | spinners / labels de estágio |
| `disabled` | validação, locks de runtime, git busy | CTAs disabled + hints |
| `error` | falha API / validação | slot vermelho (modal, composer, diff, git) |
| `running` | `thread.state === 'running'` | placeholder fila; botão Parar; runtime locked; **git disabled** |
| `stopping` | cancel em andamento | “Cancelando execução…”; textarea disabled |
| `queued` | Enter durante running | chips na fila + bolhas no chat |
| `repositoryBlocked` | pasta sem git utilizável | gate “Inicialize o Git…” |
| `diffPending` | diffs pending | aba Diff com badge; Aceitar/Rejeitar |
| `diffAccepted` / `diffRejected` | pós-review | banners de sucesso/rejeição |
| `thread_busy` | HTTP 409 `thread_busy` | mensagem `error.threadBusy` no ponto da ação (composer/dispatch/outra operação); **sem** estado visual dedicado nomeado no renderer |
| `gitBusy` | stage ≠ null **ou** thread running | botões git disabled |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | sidebars esquerda/direita; modal adicionar projeto |
| `Field` | path/nome no modal; hints/erros |
| `Input` / `Textarea` | modal + composer |
| `Button` | Adicionar, Nova Thread, Aceitar/Rejeitar, git quick |
| `Tabs` | Histórico / Prompt / Diff |
| `Pill` / `MenuRadioGroup` | provider/modelo, Access, Execution |
| `Badge` | contagem Diff; status fila |
| `EmptyState` | projetos, chat, diff |
| `DiffHunkList` | lista por arquivo (somente visualização se review global) |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável)
- [ ] Anatomia 3 colunas na ordem documentada; sem H1 de marca extra no centro
- [ ] Tabela de copy aplicada (modal projeto, composer, chat, diff, git) com rename EngrenaCode
- [ ] Criar thread = limpar seleção + 1º envio no composer (sem modal fantasma)
- [ ] Pills Access/Execution com labels documentados; Execution locked após 1º envio
- [ ] Running: placeholder de fila, Parar, git disabled
- [ ] Diff lista arquivos; CTAs Aceitar/Rejeitar conforme decisão da pergunta em aberto
- [ ] `thread_busy` exibe mensagem de erro legível (não silêncio)
- [ ] Tema `light` \| `dark` \| `system` via tokens (sem hex solto fora de token-gap documentado)
- [ ] Terminal/CodeGraph/Memória/pipeline **não** bloqueiam aceite deste SDD

## Perguntas em aberto

Resolvidas na [`spec.md`](./spec.md) §3 (recomendações + referência LionCodeLabs):

- Accept/reject **por arquivo** (PRD); API com subset; lote se omitido.
- Add project **sem** `.git` obrigatório; gate `git-init` no composer.
- Providers MVP: **Claude / Codex / Kimi** apenas.
- localStorage: prefixo **`engrenacode.*`**.
- `thread_busy`: `error.code` estável; mensagem UI em PT-BR acentuado.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F03-workspace/spec.md` | Contratos técnicos (dispatch, lease, accept-diff, git) — `TODO` se ainda não existir |
| `_reversa_sdd/sdd/workspace.md` | Spec SDD comportamental F03 |
| `docs/F02-configuracao-mvp/ui.md` | Saúde de providers / PAT que habilitam composer e git |
| `docs/design-system/` ou `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |
| `docs/F03-workspace/copy.md` | Catálogo de microcopy (opcional; não gerado neste passo) |
