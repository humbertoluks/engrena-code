# Spec de UI: #subagents (SubAgents)

**Feature:** F07-subagents  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/SubagentsScreen.tsx` (+ `SubagentFormModal.tsx`, `subagentForm.logic.ts`, `ProjectSubagentsModal.tsx`; runtime: `SubagentActivity.tsx`, bloco aninhado em `ChatHistory.tsx`; acionador harness em `WorkspaceSidebar.tsx`)  
**Componente destino (previsto):** `packages/renderer/src/screens/SubagentsScreen.tsx` (+ satélites de form, vínculo, activity e timeline)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `TODO` — capturar e versionar em `docs/F07-subagents/ui/subagents-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` |
| Overlay vínculo (opcional) | `TODO` — `docs/F07-subagents/ui/project-subagents-modal-referencia.png` |
| Sidebar activity (opcional) | `TODO` — `docs/F07-subagents/ui/subagent-activity-referencia.png` |
| Timeline aninhada (opcional) | `TODO` — `docs/F07-subagents/ui/subagent-timeline-referencia.png` |

> PNG ainda não versionado. Preferir captura dark de `#subagents` com ≥2 cards (um desativado, providers distintos) + modal “Novo subagent” aberto; frames extras do overlay “SubAgents deste projeto”, card “Subagents” na sidebar com run ativo, e bloco aninhado na timeline do workspace.

## Escopo

**Inclui:**

1. Tela global `#subagents`: listagem/CRUD (criar, editar, excluir, habilitar/desabilitar), busca, filtro por modelo, abas por categoria, cards (nome, provider, model, description, tools, reasoning, category).
2. Overlay de vínculo por projeto (`ProjectSubagentsModal` / Repo Harness → SubAgents): link, enabled no projeto, ordem; só `linked + enabled` + `kind=dev` entram no catálogo de `call_subagent` (F03).
3. Superfície runtime mínima (F03 consome): card “Subagents” na sidebar (runs, status, duração) + bloco aninhado na timeline + modal de auditoria do run.
4. Copy literal (rename de marca), estados, tokens/padrões de superfície, aceite visual.

**Provê (contrato de produto, UI indireta):**

- Definições invocáveis via `call_subagent`; runs efêmeros; diffs do filho na revisão do pai (comportamento F03; nesta feature a UI cadastra, vincula e observa runs).
- Eventos de usage `source=subagent` (F11): sem superfície própria nesta tela.
- Contagens para o dashboard (F04): a **superfície de contagem** não vive em `#subagents`; fica no resumo de catálogo do dashboard. Este SDD não especifica layout do F04.

**Exclui:** contratos HTTP/SQLite/`call_subagent` / gate Codex `full-access` (ficam no `spec.md`); implementação de primitives; edição inline do prompt no composer; row própria em `threads` para o filho.

### Observado na fonte e fora do Escopo Central F07 (PRD)

Não exigir no aceite visual Central:

1. Opção de form **Tipo = Pipeline** (`kind=pipeline`) — PRD MVP só `kind=dev`; pipeline é fluxo interno legado.
2. Seção **MCPs** no form / chips `MCPs: N` no card — PRD: filho sem MCP no MVP.
3. Providers extras da fonte (`GLM`, `MiniMax`, `Grok`) — PRD MVP: `Claude` \| `Codex` \| `Kimi` \| `inherit`.
4. Checkbox **“Acesso à rede no sandbox”** (`networkAccess`) — legado Codex sandbox; fora do Central F07.
5. Seção **Skills** por-subagent (chips globais no form) — presente na fonte; PRD F07 não lista no CRUD mínimo.
6. Agrupamento por sprint / badges de isolamento write-parallel / parecer de validador no modal de run — features de build/pipeline fora do MVP EngrenaCode.
7. Nome interno da tool `call_subagent` / bridge MCP — contrato de runtime (spec), não copy de tela.

## Anatomia (topo → base)

### A) Tela `#subagents`

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “SubAgents” + subtítulo + (opcional) badges de capability + CTA “+ Novo Agente”.
2. Busca (ícone + input) + select “Todos os modelos” / modelo concreto.
3. Abas de categoria (condicionais: só se existir ≥1 categoria): “Todos {N}” + uma aba por categoria com contagem.
4. Slot de erro de carga/ação (condicional).
5. Grid de cards (1 col → 2 cols em `lg`) **ou** empty state.
6. Overlay `SubagentFormModal` quando `new` / `edit`.

**Card (topo → base):** ícone → nome + badge provider + badge “desativado” (se off) → model efetivo (mono) → ações (Ativar/Desativar, Editar, Excluir com confirmação) → description (até 3 linhas) → chips de tools (+ extras) → rodapé Reasoning | categoria.

**Alinhamento:** coluna centrada no shell; conteúdo alinhado à esquerda  
**Largura máx.:** `max-w-[1180px]`

### B) Modal criar/editar subagent

1. Header: “Novo subagent” | “Editar subagent”
2. Campo Nome + hint
3. Campo Descrição + hint
4. Campo Categoria (opcional) + hint
5. (Legado, fora Central) Campo Tipo Dev|Pipeline
6. Campo Provider (+ hint condicional se `inherit`)
7. Campo Modelo (oculto se `inherit`)
8. Campo Reasoning (oculto se `inherit` ou modelo sem níveis)
9. Campo Tools: chips do catálogo + atalhos Read-only / Nenhuma / Sem restrição
10. (Legado, fora Central) Skills / MCPs / networkAccess
11. Campo System prompt (textarea mono)
12. Campo Timeout de inatividade (min) + hint (vazio = 20)
13. Checkbox “Habilitado (toggle global)”
14. Slot de erro
15. Footer: Cancelar + Criar|Salvar

**Alinhamento:** centro do viewport (`place-items-center`); form alinhado à esquerda  
**Largura máx.:** `max-w-[560px]`; `max-h-[88vh]` com scroll interno

### C) Overlay “SubAgents deste projeto” (vínculo F03)

1. Título “SubAgents deste projeto” + fechar
2. Busca / abas de categoria (padrão `ProjectLinkingModal`)
3. (Opcional) badges de capability
4. Slot de erro
5. Grid de cards de vínculo **ou** empty (“Nenhum subagent global. Crie no menu SubAgents.” / “Nada corresponde aos filtros.”)
6. Por card vinculado: toggle “Ativo neste projeto”; pill on/off no projeto; setas ↑↓ de ordem
7. Meta mono: `inherit (configuração do pai)` ou model/provider

### D) Card “Subagents” na sidebar (runtime F03)

1. Summary caps “Subagents” (+ pulso se há run ativo)
2. Seção **Ativos** (ou empty “Nenhum subagent ativo.”)
3. Seção **Concluídos · {N}** (ou empty “Nenhum run concluído nesta thread.”)
4. Por run: nome · model · effort · relógio mm:ss · status; clique abre modal de auditoria
5. Empty total (build path): “Nenhum run de subagent nesta thread.”

### E) Bloco aninhado na timeline (ChatHistory)

1. Row clicável: nome do subagent + provider[/model] + status (`trabalhando…` \| `concluído` \| `cancelado` \| `erro`)
2. Clique → mesmo modal de auditoria do card da sidebar
3. Tool `call_subagent` correlacionada **não** duplica no work log (vira cabeçalho do bloco)

### F) Modal de auditoria do run

1. Header: nome · provider · model · reasoning · status (+ fechar)
2. (Opcional) input da delegação em mono
3. Seção Atividade (ações) e/ou texto markdown do run
4. Empty streaming: “Aguardando a primeira resposta do subagent…”; empty terminal: “Run sem saída.”

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página `#subagents` | `mx-auto w-full max-w-[1180px] px-lg py-lg` sobre `bg-bg text-fg` | |
| Título | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| Busca | `h-[42px] rounded-md border border-border bg-surface … focus:border-accent` | ícone muted à esquerda |
| Filtro modelo | `h-[42px] rounded-md border border-border bg-surface` | |
| Aba categoria ativa | `border-b-2 border-accent text-fg` + contagem `text-accent` | |
| Aba inativa | `border-transparent text-muted hover:text-fg` | |
| Card lista | `rounded-lg border border-border bg-surface p-lg` | `opacity-60` se desativado |
| Badge provider | `rounded-md bg-accent px-sm text-[11px] font-semibold text-bg` | |
| Badge desativado | `rounded-full border border-border … text-muted` | |
| Meta model | `font-mono text-[11.5px] text-muted` | |
| Description | `text-[12.5px] text-muted line-clamp-3` | |
| Chip tools | `rounded-md bg-surface-2 px-sm text-[11px]` | |
| CTA primário | `ButtonPrimary` / `bg-accent` | “+ Novo Agente”, Criar/Salvar |
| CTA secundário | `border border-border bg-surface-2` | Cancelar |
| Modal overlay | `fixed inset-0 z-50 … bg-black/50` + form `rounded-lg border border-border bg-surface shadow-lg` | form `max-w-[560px]`; audit `max-w-[760px]` |
| Label de campo (form) | `text-[12px] font-semibold uppercase tracking-[0.04em] text-muted` | |
| Input / textarea / select | `border-border bg-surface-2 text-fg` + `focus:border-accent focus-visible:ring-2 focus-visible:ring-accent` | prompt em `font-mono` |
| Hint | `text-[11.5px] text-muted` | |
| Aviso (âmbar) | `text-amber` | MCPs Codex / tools+MCPs — fora Central |
| Erro | `text-red` / `role="alert"` | |
| Card vínculo ativo | `border-accent/50` | vs `border-border` desvinculado |
| Activity card | `rounded-xl border border-border` + surface mix | sidebar |
| Timeline bloco | `rounded-md border border-border bg-surface-2/30` | |
| Status running | pulso + tom accent/azul observado | preferir token `accent` no destino se possível |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca no erro de rede | LionCode | EngrenaCode |
| Providers form | inherit, claude, glm, minimax, codex, grok, kimi | MVP: inherit, Claude, Codex, Kimi |
| Tools null / [] / lista | null=todas; []=nenhuma; lista=allowlist | manter semântica PRD |
| Idle timeout | vazio → 20 min (1..480) | manter |
| Hard cap prompt ~1 MiB | ausente no form (só PRD) | destino: hard block UI+server (spec) |
| Soft cap ≤10 vínculos | ausente na UI | destino: soft warn `subagentsLink.warn.cap` |
| Badge lista vs vínculo | “desativado” (m) vs “desativada” (f no linking genérico) | destino: card `desativado`; pills Habilitado/Desabilitado |
| Type sizes | 26 / 17 / 15 / 13 / 12.5 / 11.5 / 11 / 10.5 px | papéis display/title/body/caption |
| Status timeline vs sidebar | `trabalhando…` vs `rodando…` | manter (contextos distintos); timeline inclui `timeout` |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`. Células = texto final no destino.

### Tela `#subagents`

| Slot | Texto |
|------|-------|
| `title` | SubAgents |
| `subtitle` | Definições globais reutilizáveis. Vincule-as a um projeto na tela principal para o agente principal poder invocá-las. |
| `cta.new` | + Novo Agente |
| `search.placeholder` | Buscar por nome ou descrição… |
| `filter.model.all` | Todos os modelos |
| `tab.all` | Todos |
| `empty.none` | Nenhum subagent ainda. Crie o primeiro com “+ Novo Agente”. |
| `empty.filtered` | Nenhum subagent corresponde aos filtros. |
| `card.badge.disabled` | desativado |
| `card.model.inherit` | herda do pai |
| `card.model.default` | default do provider |
| `card.tools.all` | todas as tools |
| `card.tools.none` | sem tools (read-only) |
| `card.meta.reasoning` | Reasoning: {level} |
| `card.meta.reasoning.inherit` | herda do pai |
| `card.meta.reasoning.default` | default |
| `card.action.enable` | Ativar |
| `card.action.disable` | Desativar |
| `card.action.edit` | Editar |
| `card.action.delete` | Excluir |
| `card.action.delete.confirm` | Excluir? |
| `card.action.delete.cancel` | Não |
| `error.load` | Não foi possível carregar os subagents. |
| `error.delete` | Não foi possível excluir o subagent. |
| `error.update` | Não foi possível atualizar o subagent. |
| `provider.claude` | Claude |
| `provider.codex` | Codex |
| `provider.kimi` | Kimi |
| `provider.inherit` | Herda |

### Modal criar/editar

| Slot | Texto |
|------|-------|
| `form.title.new` | Novo subagent |
| `form.title.edit` | Editar subagent |
| `form.label.name` | Nome |
| `form.hint.name` | Chave de invocação, única global. |
| `form.placeholder.name` | ex.: revisor-seguranca |
| `form.label.description` | Descrição |
| `form.hint.description` | O “quando usar” — roteia o agente principal. |
| `form.placeholder.description` | Use para revisar diffs em busca de vulnerabilidades. |
| `form.label.category` | Categoria |
| `form.hint.category` | Opcional — agrupa no menu. |
| `form.placeholder.category` | ex.: qualidade |
| `form.label.provider` | Provider |
| `form.provider.inherit` | Herdar configuração do agente pai |
| `form.provider.claude` | Claude |
| `form.provider.codex` | Codex |
| `form.provider.kimi` | Kimi |
| `form.hint.inherit` | O subagent usará o mesmo provider, modelo e reasoning do agente pai. |
| `form.label.model` | Modelo |
| `form.hint.model` | Padrão do provider quando não escolhido. |
| `form.option.model.default` | Padrão do provider |
| `form.label.reasoning` | Reasoning |
| `form.hint.reasoning` | Níveis suportados pelo modelo escolhido. |
| `form.option.reasoning.default` | Padrão do provider |
| `form.label.tools` | Tools |
| `form.hint.tools.unrestricted` | Estado atual: sem restrição (todas as built-ins do provider). |
| `form.hint.tools.none` | Estado atual: nenhuma built-in liberada. |
| `form.hint.tools.allowlist` | Estado atual: somente as tools selecionadas. |
| `form.tools.readonly` | Read-only (Read/Grep/Glob) |
| `form.tools.none` | Nenhuma |
| `form.tools.unrestricted` | Sem restrição |
| `form.label.prompt` | System prompt |
| `form.placeholder.prompt` | Instruções do subagent (system prompt aplicado ao filho). |
| `form.label.idleTimeout` | Timeout de inatividade (min) |
| `form.placeholder.idleTimeout` | 20 (default) |
| `form.hint.idleTimeout` | Silêncio total do subagent por esse período interrompe o run com status timeout e devolve o parcial ao orquestrador. Vazio = 20min. |
| `form.toggle.enabled` | Habilitado (toggle global) |
| `form.cta.cancel` | Cancelar |
| `form.cta.create` | Criar |
| `form.cta.save` | Salvar |
| `form.cta.loading` | Salvando... |
| `form.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `form.error.generic` | Não foi possível salvar o subagent. Tente novamente. |
| `form.error.nameConflict` | Já existe um subagent com este nome. Escolha outro. |
| `form.error.promptOver` | Prompt acima de 1 MiB. Reduza o tamanho para salvar. |

### Overlay vínculo por projeto

| Slot | Texto |
|------|-------|
| `link.title` | SubAgents deste projeto |
| `link.empty` | Nenhum subagent global. Crie no menu SubAgents. |
| `link.empty.filtered` | Nada corresponde aos filtros. |
| `link.toggle` | Ativo neste projeto |
| `link.aria.toggle` | Ativar {name} neste projeto |
| `link.pill.on` | on |
| `link.pill.off` | off |
| `link.pill.title.on` | Habilitado neste projeto |
| `link.pill.title.off` | Desabilitado neste projeto |
| `link.move.up` | Subir {name} |
| `link.move.down` | Descer {name} |
| `link.meta.inherit` | inherit (configuração do pai) |
| `link.error.load` | Não foi possível carregar os subagents do projeto. |
| `link.error.link` | Não foi possível atualizar o vínculo. |
| `link.error.enabled` | Não foi possível alterar o estado no projeto. |
| `link.error.reorder` | Não foi possível reordenar. |
| `link.warn.cap` | {N} subagents vinculados — acima de 10; considere enxugar (não bloqueia). |
| `harness.pill` | SubAgents |

### Sidebar activity + timeline + audit (runtime)

| Slot | Texto |
|------|-------|
| `activity.title` | Subagents |
| `activity.section.active` | Ativos |
| `activity.section.done` | Concluídos · {N} |
| `activity.empty.active` | Nenhum subagent ativo. |
| `activity.empty.done` | Nenhum run concluído nesta thread. |
| `activity.empty.none` | Nenhum run de subagent nesta thread. |
| `activity.status.running` | rodando… |
| `activity.status.completed` | concluído |
| `activity.status.cancelled` | cancelado |
| `activity.status.timeout` | timeout |
| `activity.status.error` | erro |
| `activity.run.open` | Abrir o run para auditoria ({provider} · {model}) |
| `timeline.status.running` | trabalhando… |
| `timeline.status.completed` | concluído |
| `timeline.status.cancelled` | cancelado |
| `timeline.status.error` | erro |
| `timeline.status.timeout` | timeout |
| `timeline.open` | Abrir o run do subagent (auditoria) |
| `audit.aria` | Run do subagent {name} |
| `audit.close` | Fechar |
| `audit.empty.waiting` | Aguardando a primeira resposta do subagent… |
| `audit.empty.done` | Run sem saída. |
| `audit.section.activity` | Atividade · {N} ações |

### Fora do Central (não exigir)

| Slot | Texto (fonte) |
|------|----------------|
| `form.label.kind` | Tipo |
| `form.hint.kind` | Editável. Pipeline é usado pelos fluxos internos; Dev entra no catálogo dos projetos. |
| `form.option.kind.dev` | Dev |
| `form.option.kind.pipeline` | Pipeline |
| `form.label.skills` | Skills |
| `form.hint.skills` | Seleção GLOBAL (ignora o vínculo por projeto). Nada selecionado = nenhuma skill. |
| `form.skills.empty` | Nenhuma skill global habilitada. |
| `form.label.mcps` | MCPs |
| `form.hint.mcps` | Seleção GLOBAL (ignora o vínculo por projeto). Nada selecionado = nenhum MCP. |
| `form.mcps.codexBlocked` | MCPs não são suportados em subagents Codex. |
| `form.mcps.empty` | Nenhum MCP global cadastrado. |
| `form.warn.toolsMcps` | Com allowlist de tools, as tools dos MCPs externos ficam indisponíveis para este subagent (limitação v1). |
| `form.toggle.network` | Acesso à rede no sandbox |
| `form.hint.network` | (codex: libera pnpm install/downloads; nunca em read-only) |
| `card.chip.skills.none` | skills: nenhuma |
| `card.chip.skills.count` | skills: {N} |
| `card.chip.mcps.none` | MCPs: nenhum |
| `card.chip.mcps.count` | MCPs: {N} |
| `provider.glm` | GLM |
| `provider.minimax` | MiniMax |
| `provider.grok` | Grok |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `search` | search | não | filtra nome + description (client-side) |
| `modelFilter` | select | não | “Todos os modelos” ou model id presente na lista |
| `categoryTab` | tabs | — | “Todos” ou categoria exata |
| `cta.new` | button | — | abre modal `new` |
| `card.toggleEnabled` | icon button | — | update otimista `enabled`; reverte no erro |
| `card.edit` | icon button | — | abre modal `edit` |
| `card.delete` | icon + confirm | — | “Excluir?” / “Não”; depois `deleteSubagent` |
| `form.name` | text | sim | único global; 409 → nameConflict |
| `form.description` | textarea | não* | fonte permite vazio; PRD lista no CRUD |
| `form.category` | text | não | vazio → `null` |
| `form.provider` | select | sim | MVP: inherit \| claude \| codex \| kimi |
| `form.model` | select | não | oculto se inherit; null = default |
| `form.reasoning` | select | não | oculto se inherit / sem options |
| `form.tools` | chips + atalhos | — | null / [] / allowlist; read-only = Read/Grep/Glob |
| `form.prompt` | textarea | não* | system prompt do filho; teto ~1 MiB (PRD) |
| `form.idleTimeoutMinutes` | number | não | 1..480 ou vazio (=20 default broker) |
| `form.enabled` | checkbox | — | default `true` em create |
| `form.submit` | button | — | disabled se name vazio ou saving |
| `link.linked` | checkbox | — | PUT link / DELETE unlink |
| `link.enabledInProject` | pill | — | só se `linked`; afeta catálogo `call_subagent` |
| `link.reorder` | ↑↓ | — | troca `sortOrder` entre vizinhos |

\* Fonte não exige description/prompt no `canSubmit` (só name). Destino: confirmar se PRD obriga description.

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com lista | grid ou empty; CTA Novo Agente |
| `filling` | busca / filtros / form | filtra lista; limpa erro de form ao reeditar |
| `loading` | save form | CTA “Salvando...”; `saving` trava submit |
| `disabled` | form inválido / busy link | submit disabled; toggles de vínculo `disabled` enquanto `busyId` |
| `error` | load/save/delete/link falha | `role="alert"` vermelho (tela ou modal) |
| `empty` | zero subagents | copy `empty.none` |
| `emptyFiltered` | filtros sem match | copy `empty.filtered` / `link.empty.filtered` |
| `cardDisabled` | `enabled === false` | `opacity-60` + badge “desativado” |
| `pendingDelete` | clique Excluir | troca ícone por “Excluir?” / “Não” |
| `nameConflict` | API `subagent_name_conflict` | erro inline no form |
| `providerInherit` | provider = inherit | esconde model/reasoning; hint de herança |
| `toolsUnrestricted` | toolsMode unrestricted | hint “sem restrição”; persiste `null` |
| `toolsNone` | toolsMode none | hint “nenhuma”; persiste `[]` |
| `toolsAllowlist` | chips selecionados | hint allowlist; persiste lista |
| `linkActive` | `linked` | borda accent; mostra on/off + setas |
| `runActive` | status null + startedAt | pulso na sidebar; relógio vivo; status rodando/trabalhando |
| `runTimeout` | status timeout | status “timeout” na activity; run encerrado |
| `runError` | status error/cancelled | tom vermelho |
| `auditOpen` | clique run/timeline | modal de auditoria; Esc/backdrop fecha |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | subagent card na grid; card de vínculo; activity |
| `Field` | labels + input/textarea/select + hint/erro no form |
| `Input` / `Textarea` / `Select` | busca, filtros, form |
| `Button` | Novo Agente, Criar/Salvar (primary), Cancelar |
| `Badge` | provider, desativado, on/off, status |
| `Tabs` | categorias |
| `Modal` / `Dialog` | SubagentFormModal, ProjectLinkingModal, SubagentRunModal |
| `IconButton` | ativar, editar, excluir, reordenar |
| `EmptyState` | lista, vínculo e activity vazios |
| `ChipToggle` | tools (e skills/MCPs se mantidos) |
| `ProviderCapabilityBadges` | slot opcional de compatibilidade |

> Reutilizar `ProjectLinkingModal` genérico (igual Skills): semântica `linked` ⇔ ativo no catálogo `call_subagent`.

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável)
- [ ] Anatomia `#subagents` na ordem documentada; subtítulo menciona vínculo na tela principal
- [ ] Tabela de copy aplicada (lista, form, vínculo, activity/timeline) com rename EngrenaCode
- [ ] Card mostra nome + provider + model + tools; toggle/editar/excluir com confirmação
- [ ] Form: name obrigatório; provider Claude\|Codex\|Kimi\|inherit; tools null/lista/[]; idle default 20
- [ ] Name duplicado mostra `form.error.nameConflict`
- [ ] Overlay de projeto: só linked+enabled alimentam `call_subagent` (comportamento; UI mostra Ativo + on/off + ordem)
- [ ] Sidebar: runs com status e duração; timeout visível
- [ ] Timeline: bloco aninhado sem duplicar `call_subagent` no work log
- [ ] Tipo Pipeline, MCPs no filho, providers GLM/MiniMax/Grok e networkAccess **não** exigidos no Central
- [ ] Contagens do dashboard **não** bloqueiam aceite desta tela (F04)
- [ ] Tema `light` \| `dark` \| `system` via tokens

## Perguntas em aberto

- Screenshot canônico e frames de vínculo/activity/timeline ainda `TODO`.
- Diffs do filho na aba Diff do pai: superfície visual em F03 `ui.md` (F07 garante cwd compartilhado + generateDiffs do pai).
- (Resolvidas na spec F07: omitir Pipeline/MCPs/Skills/network/providers extras; soft warn ≤10; hard 1 MiB; description+prompt obrigatórios; running copy distinta sidebar/timeline; pills masculinos; PT-BR acentuado; timeout na timeline.)

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F07-subagents/spec.md` | Contratos API/CRUD/`call_subagent`/idle/Codex gate |
| `docs/F07-subagents/plan.md` | Fases de implementação |
| `docs/F03-workspace/ui.md` | Onde o harness abre o overlay; timeline/diff do pai |
| `docs/F04-dashboard` (ui/spec) | Contadores de catálogo consumidos de F07 |
| `docs/F05-skills/ui.md` | Irmão de catálogo (padrão lista/form/`ProjectLinkingModal`) |
| `docs/F06-rules/ui.md` | Irmão de catálogo (vínculo diferente: global/override) |
| `docs/F11-consumo` | usage `source=subagent` |
| `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |
| `docs/F07-subagents/copy.md` | Catálogo de microcopy (`subagents.*` / `subagentsForm.*` / `subagentsLink.*` / `subagentsRun.*`) |
