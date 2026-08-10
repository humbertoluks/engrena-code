# Spec de UI: #skills (Skills)

**Feature:** F05-skills  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/SkillsScreen.tsx` (+ `SkillFormModal.tsx`, `skillForm.logic.ts`, `ProjectSkillsModal.tsx`, `linking/ProjectLinkingModal.tsx`)  
**Componente destino (previsto):** `src/renderer/screens/SkillsScreen.tsx` (+ satélites de form e vínculo sob `src/renderer/`)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `TODO` — capturar e versionar em `docs/F05-skills/ui/skills-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` |
| Overlay vínculo (opcional) | `TODO` — `docs/F05-skills/ui/project-skills-modal-referencia.png` |

> PNG ainda não versionado. Preferir captura dark de `#skills` com ≥2 cards (uma desativada) + modal “Nova skill” aberto; segundo frame do overlay “Skills deste projeto” no workspace.

## Escopo

**Inclui:**

1. Tela global `#skills`: listagem/CRUD (criar, editar, excluir, habilitar/desabilitar), busca, abas por categoria, cards (nome, description, categoria, tamanho do content).
2. Overlay de vínculo por projeto (`ProjectSkillsModal` / Repo Harness → Skills): link, enabled no projeto, ordem; só `linked + enabled` entram no catálogo de `load_skill` (F03).
3. Copy literal (rename de marca), estados, tokens/padrões de superfície, aceite visual.

**Provê (contrato de produto, UI indireta):**

- Catálogo (nome, description) + content sob demanda via `load_skill` (comportamento do turno em F03; nesta feature a UI só cadastra e vincula).
- Contagens para o dashboard (F04): a **superfície de contagem** não vive em `#skills`; fica no resumo de catálogo do dashboard. Este SDD não especifica layout do F04.

**Exclui:** contratos HTTP/SQLite/`load_skill` tool name (ficam no `spec.md`); implementação de primitives; edição inline do content no workspace; execução de skill como código.

### Observado na fonte e fora do Escopo Central F05 (PRD)

Não exigir no aceite visual Central:

1. Checkbox **“Template do pipeline (apenas marcador; não bloqueia edição)”** / campo `locked` — PRD F05 não lista; legado de pipeline fora do MVP.
2. Matriz completa `ProviderCapabilityBadges` além do slot de compatibilidade (manter se F02/capabilities já existirem; não é Must de copy F05).
3. Nome interno da tool no sistema legado — rename técnico do prefixo MCP → `mcp__engrenacode__load_skill` é contrato de runtime (spec), não copy de tela.

## Anatomia (topo → base)

### A) Tela `#skills`

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “Skills” + subtítulo + (opcional) badges de capability + CTA “+ Nova skill”.
2. Campo de busca (ícone + input).
3. Abas de categoria (condicionais: só se existir ≥1 categoria): “Todas {N}” + uma aba por categoria com contagem.
4. Slot de erro de carga/ação (condicional).
5. Grid de cards (1 col → 2 cols em `lg`) **ou** empty state.
6. Overlay `SkillFormModal` quando `new` / `edit`.

**Card (topo → base):** ícone → nome + badge categoria + badge “desativada” (se off) → tamanho do content (mono) → ações (Ativar/Desativar, Editar, Excluir com confirmação) → description (até 3 linhas).

**Alinhamento:** coluna centrada no shell; conteúdo alinhado à esquerda  
**Largura máx.:** `max-w-[1180px]`

### B) Modal criar/editar skill

1. Header: “Nova skill” | “Editar skill”
2. Campo Nome + hint
3. Campo Descrição + hint + aviso âmbar se > ~200 chars
4. Campo Categoria (opcional) + hint
5. Campo Conteúdo (textarea mono) + contador / erro de teto ~1 MiB
6. Checkbox “Habilitada (toggle global)”
7. (Legado, fora Central) Checkbox “Template do pipeline…”
8. Slot de erro
9. Footer: Cancelar + Criar|Salvar

**Alinhamento:** centro do viewport (`place-items-center`); form alinhado à esquerda  
**Largura máx.:** `max-w-[640px]`; `max-h-[88vh]` com scroll interno

### C) Overlay “Skills deste projeto” (vínculo F03)

1. Título “Skills deste projeto” + fechar
2. Busca / abas de categoria (padrão `ProjectLinkingModal`)
3. (Opcional) badges de capability
4. Slot de erro
5. Grid de cards de vínculo **ou** empty (“Nenhuma skill global. Crie no menu Skills.” / “Nada corresponde aos filtros.”)
6. Por card vinculado: toggle “Ativo neste projeto”; pill on/off no projeto; setas ↑↓ de ordem

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página `#skills` | `mx-auto w-full max-w-[1180px] px-lg py-lg` sobre `bg-bg text-fg` | |
| Título | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| Busca | `h-[42px] rounded-md border border-border bg-surface … focus:border-accent` | ícone muted à esquerda |
| Aba categoria ativa | `border-b-2 border-accent text-fg` + contagem `text-accent` | |
| Aba inativa | `border-transparent text-muted hover:text-fg` | |
| Card | `rounded-lg border border-border bg-surface p-lg` | `opacity-60` se desativada |
| Badge categoria | `rounded-md bg-accent px-sm text-[11px] font-semibold text-bg` | |
| Badge desativada | `rounded-full border border-border … text-muted` | |
| Meta tamanho | `font-mono text-[11.5px] text-muted` | |
| Description | `text-[12.5px] text-muted line-clamp-3` | |
| CTA primário | `ButtonPrimary` / `bg-accent` | “+ Nova skill”, Criar/Salvar |
| CTA secundário | `border border-border bg-surface-2` | Cancelar |
| Modal overlay | `fixed inset-0 z-50 … bg-black/50` + form `rounded-lg border border-border bg-surface shadow-lg` | |
| Label de campo (form) | `text-[12px] font-semibold uppercase tracking-[0.04em] text-muted` | |
| Input / textarea | `border-border bg-surface-2 text-fg` + `focus:border-accent focus-visible:ring-2 focus-visible:ring-accent` | content em `font-mono` |
| Hint | `text-[11.5px] text-muted` | |
| Aviso descrição longa | `text-amber` | não bloqueia |
| Erro | `text-red` / `role="alert"` | teto content também `text-red` |
| Card vínculo ativo | `border-accent/50` | vs `border-border` desvinculado |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca no erro de rede | sistema legado | EngrenaCode |
| Tool name timeline | prefixo MCP do sistema legado | `mcp__engrenacode__load_skill` (spec runtime) |
| Type sizes | 26 / 17 / 15 / 13 / 12.5 / 11.5 px | papéis display/title/body/caption |
| Soft cap description | 200 chars (aviso) | manter |
| Hard cap content | ~1 MiB (`CONTENT_PRACTICAL_LIMIT`) | manter |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `sistema legado → EngrenaCode`. Células = texto final no destino.

### Tela `#skills`

| Slot | Texto |
|------|-------|
| `title` | Skills |
| `subtitle` | Instruções reutilizáveis carregadas sob demanda pelo agente. Vincule-as a um projeto na tela principal para entrarem no catálogo. |
| `cta.new` | + Nova skill |
| `search.placeholder` | Buscar por nome ou descrição… |
| `tab.all` | Todas |
| `empty.none` | Nenhuma skill ainda. Crie a primeira com “+ Nova skill”. |
| `empty.filtered` | Nenhuma skill corresponde aos filtros. |
| `card.badge.disabled` | desativada |
| `card.action.enable` | Ativar |
| `card.action.disable` | Desativar |
| `card.action.edit` | Editar |
| `card.action.delete` | Excluir |
| `card.action.delete.confirm` | Excluir? |
| `card.action.delete.cancel` | Não |
| `error.load` | Não foi possível carregar as skills. |
| `error.delete` | Não foi possível excluir a skill. |
| `error.update` | Não foi possível atualizar a skill. |

### Modal criar/editar

| Slot | Texto |
|------|-------|
| `form.title.new` | Nova skill |
| `form.title.edit` | Editar skill |
| `form.label.name` | Nome |
| `form.hint.name` | Chave de invocação, única global. |
| `form.placeholder.name` | ex.: convencoes-de-commit |
| `form.label.description` | Descrição |
| `form.hint.description` | O “quando usar” — é o que o modelo lê para decidir carregar a skill. Curta e específica (sugestão: até ~200 caracteres). |
| `form.placeholder.description` | Use ao escrever mensagens de commit neste repositório. |
| `form.warn.descriptionLong` | {N} caracteres — descrições longas encarecem o catálogo em todo turno (não bloqueia). |
| `form.label.category` | Categoria |
| `form.hint.category` | Opcional — agrupa no menu. |
| `form.placeholder.category` | ex.: convenções |
| `form.label.content` | Conteúdo |
| `form.hint.content` | Markdown. O conteúdo inteiro entra no contexto quando o agente carrega a skill. Teto prático: ~1 MiB. |
| `form.placeholder.content` | # Minha skill\n\nInstruções, convenções ou conhecimento de domínio... |
| `form.meta.contentOver` | {size} — acima do teto de ~1 MiB do servidor. |
| `form.toggle.enabled` | Habilitada (toggle global) |
| `form.cta.cancel` | Cancelar |
| `form.cta.create` | Criar |
| `form.cta.save` | Salvar |
| `form.cta.loading` | Salvando... |
| `form.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `form.error.generic` | Não foi possível salvar a skill. Tente novamente. |
| `form.error.nameConflict` | Já existe uma skill com este nome. Escolha outro. |

### Overlay vínculo por projeto

| Slot | Texto |
|------|-------|
| `link.title` | Skills deste projeto |
| `link.empty` | Nenhuma skill global. Crie no menu Skills. |
| `link.empty.filtered` | Nada corresponde aos filtros. |
| `link.toggle` | Ativo neste projeto |
| `link.aria.toggle` | Ativar {name} neste projeto |
| `link.pill.on` | on |
| `link.pill.off` | off |
| `link.pill.title.on` | Habilitada neste projeto |
| `link.pill.title.off` | Desabilitada neste projeto |
| `link.move.up` | Subir {name} |
| `link.move.down` | Descer {name} |
| `link.error.load` | Não foi possível carregar as skills do projeto. |
| `link.error.link` | Não foi possível atualizar o vínculo. |
| `link.error.enabled` | Não foi possível alterar o estado no projeto. |
| `link.error.reorder` | Não foi possível reordenar. |
| `harness.pill` | Skills |

### Fora do Central (não exigir)

| Slot | Texto (fonte) |
|------|----------------|
| `form.toggle.locked` | Template do pipeline (apenas marcador; não bloqueia edição) |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `search` | search | não | filtra nome + description (client-side) |
| `categoryTab` | tabs | — | “Todas” ou categoria exata |
| `cta.new` | button | — | abre modal `new` |
| `card.toggleEnabled` | icon button | — | update otimista `enabled`; reverte no erro |
| `card.edit` | icon button | — | abre modal `edit` |
| `card.delete` | icon + confirm | — | “Excluir?” / “Não”; depois `deleteSkill` |
| `form.name` | text | sim | único global; 409 → nameConflict |
| `form.description` | textarea | sim | soft warn > 200 chars |
| `form.category` | text | não | vazio → `null` |
| `form.content` | textarea markdown | sim | bloqueia submit se > ~1 MiB |
| `form.enabled` | checkbox | — | default `true` em create |
| `form.submit` | button | — | disabled se name/description/content vazios, over-limit ou saving |
| `link.linked` | checkbox | — | PUT link / DELETE unlink |
| `link.enabledInProject` | pill | — | só se `linked`; afeta catálogo `load_skill` |
| `link.reorder` | ↑↓ | — | troca `sortOrder` entre vizinhos |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com lista | grid ou empty; CTA Nova skill |
| `filling` | busca / form | filtra lista; limpa erro de form ao reeditar |
| `loading` | save form | CTA “Salvando...”; inputs efetivamente travados pelo `saving` |
| `disabled` | form inválido / busy link | submit disabled; toggles de vínculo `disabled` enquanto `busyId` |
| `error` | load/save/delete/link falha | `role="alert"` vermelho (tela ou modal) |
| `empty` | zero skills | copy `empty.none` |
| `emptyFiltered` | filtros sem match | copy `empty.filtered` / `link.empty.filtered` |
| `cardDisabled` | `enabled === false` | `opacity-60` + badge “desativada” |
| `pendingDelete` | clique Excluir | troca ícone por “Excluir?” / “Não” |
| `form.warnDescription` | description > 200 | aviso âmbar, não bloqueia |
| `form.contentOver` | content > 1 MiB | contador vermelho; submit bloqueado |
| `linkActive` | `linked` | borda accent; mostra on/off + setas |
| `nameConflict` | API `skill_name_conflict` | erro inline no form |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | skill card na grid; card de vínculo |
| `Field` | labels + input/textarea + hint/erro no form |
| `Input` / `Textarea` | busca, nome, categoria, description, content |
| `Button` | Nova skill, Criar/Salvar (primary), Cancelar |
| `Badge` | categoria, desativada, on/off |
| `Tabs` | categorias |
| `Modal` / `Dialog` | SkillFormModal, ProjectLinkingModal |
| `IconButton` | ativar, editar, excluir, reordenar |
| `EmptyState` | lista e vínculo vazios |
| `ProviderCapabilityBadges` | slot opcional de compatibilidade |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável)
- [ ] Anatomia `#skills` na ordem documentada; subtítulo menciona vínculo na tela principal
- [ ] Tabela de copy aplicada (lista, form, vínculo) com rename EngrenaCode
- [ ] Card mostra nome + description + tamanho; toggle/editar/excluir com confirmação
- [ ] Form exige name, description, content; soft warn 200; hard block ~1 MiB
- [ ] Name duplicado mostra `form.error.nameConflict`
- [ ] Overlay de projeto: só linked+enabled alimentam o catálogo (comportamento; UI mostra Ativo + on/off + ordem)
- [ ] Checkbox “Template do pipeline” **não** exigido no Central
- [ ] Contagens do dashboard **não** bloqueiam aceite desta tela (F04)
- [ ] Tema `light` \| `dark` \| `system` via tokens

## Perguntas em aberto

Resolvidas na [`spec.md`](./spec.md) §3 (recomendações + sistema legado):

- **`locked` / pipeline:** omitir no MVP EngrenaCode.
- **≤30 vínculos:** soft warning na UI do overlay (não hard fail).
- **Acentos:** normalizar PT-BR nas mensagens de rede/save/conflito (ids em `copy.md`).
- Screenshots canônicos: ainda TODO.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F05-skills/spec.md` | Contratos API/CRUD/`load_skill` — `TODO` se ausente |
| `_reversa_sdd/sdd/skills.md` | Spec SDD comportamental F05 |
| `docs/F03-workspace/ui.md` | Onde o harness abre o overlay de vínculo |
| `docs/F04-dashboard` (ui/spec) | Contadores de catálogo consumidos de F05 |
| `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |
| `docs/F05-skills/copy.md` | Catálogo de microcopy (`skills.*` / `skillsForm.*` / `skillsLink.*`) |
