# Spec de UI: #rules (Rules)

**Feature:** F06-rules  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/RulesScreen.tsx` (+ `components/rules/RuleFormModal.tsx`, `ruleForm.logic.ts`, `ProjectRulesModal.tsx`; acionador harness em `WorkspaceSidebar.tsx`)  
**Componente destino (previsto):** `packages/renderer/src/screens/RulesScreen.tsx` (+ satélites de form e vínculo/override)  
**Última atualização:** 2026-08-03

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `TODO` — capturar e versionar em `docs/F06-rules/ui/rules-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` |
| Overlay vínculo/override (opcional) | `TODO` — `docs/F06-rules/ui/project-rules-modal-referencia.png` |

> PNG ainda não versionado. Preferir captura dark de `#rules` com ≥2 cards (uma `Global`, uma desativada) + modal “Nova rule” aberto; segundo frame do overlay “Rules deste projeto” com seções Globais + Deste projeto e rodapé de agregado.

## Escopo

**Inclui:**

1. Tela global `#rules`: listagem/CRUD (criar, editar, excluir, habilitar/desabilitar), busca, abas por categoria, cards (nome, description opcional, categoria, badge Global, tamanho do content).
2. Overlay por projeto (`ProjectRulesModal` / Repo Harness → Rules): **não** reutiliza o `ProjectLinkingModal` genérico.
   - Globais: default-on; toggle “ativa neste projeto” (supressão via override); badge “suprimida aqui”.
   - Não-globais: vínculo explícito + pill on/off quando vinculada.
   - Rodapé com agregado do turno (count · KB) e soft-warn > 16 KB.
3. Copy literal (rename de marca), estados, tokens/padrões de superfície, aceite visual.

**Provê (contrato de produto, UI indireta):**

- Bloco markdown de rules resolvidas (globais + locais com override) para injeção em todo turno (F03); nesta feature a UI cadastra, vincula e suprime — a montagem do bloco é runtime.
- Contagens para o dashboard (F04): a **superfície de contagem** não vive em `#rules`; fica no resumo de catálogo do dashboard. Este SDD não especifica layout do F04.
- Contagem parcial no harness (F03): pill “Rules” com `N ativas` e title com KB por turno.

**Exclui:** contratos HTTP/SQLite/`rules-block` / precedência vs `CLAUDE.md`/`AGENTS.md` (ficam no `spec.md`); implementação de primitives; edição inline do content no composer.

### Observado na fonte e alinhamento PRD F06

| Capacidade PRD | UI fonte |
|----------------|----------|
| CRUD name (sem CR/LF), content markdown, enabled, isGlobal | Form + cards; gate de nome inválido inline |
| Não-global: só projetos vinculados; global: todos + override off | `ProjectRulesModal` duas seções |
| Precedência projeto > global > arquivos do repo | Runtime (F03); sem copy de tela sobre CLAUDE.md/AGENTS.md |
| Recomendação ≤ 15 rules ativas / projeto | **Ausente** na UI; só soft-warn agregado > 16 KB |
| Content ~1 MiB prático | Soft-warn **por rule** > 8 KB (âmbar, não bloqueia); sem hard-block de 1 MiB no form (diferente de Skills) |

## Anatomia (topo → base)

### A) Tela `#rules`

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “Rules” + subtítulo + CTA “+ Nova rule”.
2. Campo de busca (ícone + input).
3. Abas de categoria (condicionais: só se existir ≥1 categoria): “Todas {N}” + uma aba por categoria com contagem.
4. Slot de erro de carga/ação (condicional).
5. Grid de cards (1 col → 2 cols em `lg`) **ou** empty state.
6. Overlay `RuleFormModal` quando `new` / `edit`.

**Card (topo → base):** ícone → nome + badge “Global” (âmbar, se `isGlobal`) + badge categoria + badge “desativada” (se off) → tamanho do content (mono) → ações (Ativar/Desativar, Editar, Excluir com confirmação) → description (até 3 linhas, se houver).

**Alinhamento:** coluna centrada no shell; conteúdo alinhado à esquerda  
**Largura máx.:** `max-w-[1180px]`

### B) Modal criar/editar rule

1. Header: “Nova rule” | “Editar rule”
2. Campo Nome + hint + erro inline se CR/LF/control
3. Campo Descrição (opcional) + hint
4. Campo Categoria (opcional) + hint
5. Campo Conteúdo (textarea mono) + contador + soft-warn âmbar se > ~8 KB
6. Checkbox “Global (vale para todos os projetos)” + hint condicional se marcado
7. Checkbox “Habilitada (toggle global)”
8. Slot de erro
9. Footer: Cancelar + Criar|Salvar

**Alinhamento:** centro do viewport (`place-items-center`); form alinhado à esquerda  
**Largura máx.:** `max-w-[640px]`; `max-h-[88vh]` com scroll interno

### C) Overlay “Rules deste projeto” (vínculo/override F03)

1. Header: “Rules deste projeto” + pill `{N} ativa|ativas` + “+ Nova rule” + fechar
2. Slot de erro
3. Empty global **ou** duas seções:
   - **Globais:** cards com switch “ativa neste projeto” (+ badge “suprimida aqui” se override off); sem checkbox de vínculo
   - **Deste projeto:** cards com switch “vinculada a este projeto” + pill on/off se vinculada
4. Rodapé mono: “Rules ativas neste projeto: {N} · ~{X} KB por turno” (+ aviso âmbar se > 16 KB)
5. Nested `RuleFormModal` ao “+ Nova rule”: não-global salva e **pré-vincula**; global só refetch (default-on)

**Card no overlay:** nome + badges + tamanho + description (2 linhas) + rodapé de controles (children)

**Alinhamento:** centro do viewport  
**Largura máx.:** `max-w-[880px]`; `max-h-[86vh]`

### D) Acionador harness (F03, superfície mínima)

Pill/row “Rules” na seção Repo Harness da sidebar direita: abre `ProjectRulesModal`. Meta opcional: `{N} ativa(s)`; title com count + KB por turno.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página `#rules` | `mx-auto w-full max-w-[1180px] px-lg py-lg` sobre `bg-bg text-fg` | |
| Título | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| Busca | `h-[42px] rounded-md border border-border bg-surface … focus:border-accent` | ícone muted à esquerda |
| Aba categoria ativa | `border-b-2 border-accent text-fg` + contagem `text-accent` | |
| Aba inativa | `border-transparent text-muted hover:text-fg` | |
| Card lista | `rounded-lg border border-border bg-surface p-lg` | `opacity-60` se desativada |
| Badge Global | `border-amber/60 bg-amber/15 text-amber` uppercase bold | só `isGlobal` |
| Badge categoria | `rounded-md bg-accent px-sm text-[11px] font-semibold text-bg` | |
| Badge desativada | `rounded-full border border-border … text-muted` | |
| Meta tamanho | `font-mono text-[11.5px] text-muted` | |
| Description | `text-[12.5px] text-muted line-clamp-3` | |
| CTA primário | `ButtonPrimary` / `bg-accent` | “+ Nova rule”, Criar/Salvar |
| CTA secundário | `border border-border bg-surface-2` | Cancelar |
| Modal overlay | `fixed inset-0 z-50 … bg-black/50` + form/painel `rounded-lg border border-border bg-surface shadow-lg` | |
| Label de campo (form) | `text-[12px] font-semibold uppercase tracking-[0.04em] text-muted` | |
| Input / textarea | `border-border bg-surface-2 text-fg` + `focus:border-accent focus-visible:ring-2 focus-visible:ring-accent` | content em `font-mono` |
| Hint | `text-[11.5px] text-muted` | |
| Soft-warn content / agregado | `text-amber` | 8 KB / rule; 16 KB agregado |
| Erro | `text-red` / `role="alert"` | nome inválido também `text-red` |
| Card overlay ativo | `border-accent/50` + `bg-surface-2/40` | vs `border-border` inativo |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca no erro de rede | sistema legado | EngrenaCode |
| Soft-warn por rule | 8 KB (`RULE_CONTENT_SOFT_WARN`) | manter |
| Soft-warn agregado | 16 KB (`RULES_AGGREGATE_SOFT_WARN`) | manter |
| Hard cap 1 MiB no form | ausente na fonte | destino: hard block UI+server (spec) |
| Warning ≤ 15 ativas | ausente | destino: soft warn `link.warn.activeCap` |
| Type sizes | 26 / 17 / 16 / 15 / 13 / 12.5 / 11.5 / 10.5 px | papéis display/title/body/caption |
| Reorder ↑↓ | ausente em rules (há em skills) | não exigir |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `sistema legado → EngrenaCode`. Células = texto final no destino.

### Tela `#rules`

| Slot | Texto |
|------|-------|
| `title` | Rules |
| `subtitle` | Instruções permanentes injetadas em todo turno. As globais valem para todos os projetos; as demais, só onde forem vinculadas na tela principal. |
| `cta.new` | + Nova rule |
| `search.placeholder` | Buscar por nome ou descrição… |
| `tab.all` | Todas |
| `empty.none` | Nenhuma rule ainda. Crie a primeira com “+ Nova rule”. |
| `empty.filtered` | Nenhuma rule corresponde aos filtros. |
| `card.badge.global` | Global |
| `card.badge.disabled` | desativada |
| `card.action.enable` | Ativar |
| `card.action.disable` | Desativar |
| `card.action.edit` | Editar |
| `card.action.delete` | Excluir |
| `card.action.delete.confirm` | Excluir? |
| `card.action.delete.cancel` | Não |
| `error.load` | Não foi possível carregar as rules. |
| `error.delete` | Não foi possível excluir a rule. |
| `error.update` | Não foi possível atualizar a rule. |

### Modal criar/editar

| Slot | Texto |
|------|-------|
| `form.title.new` | Nova rule |
| `form.title.edit` | Editar rule |
| `form.label.name` | Nome |
| `form.hint.name` | Único global, sem quebras de linha (entra no delimitador do bloco — o servidor rejeita). |
| `form.placeholder.name` | ex.: responder-em-ptbr |
| `form.error.nameInvalid` | O nome não pode conter quebras de linha ou caracteres de controle. |
| `form.label.description` | Descrição |
| `form.hint.description` | Opcional — só para você se lembrar do porquê. |
| `form.placeholder.description` | Convenção de idioma das respostas. |
| `form.label.category` | Categoria |
| `form.hint.category` | Opcional — agrupa no menu. |
| `form.placeholder.category` | ex.: convenções |
| `form.label.content` | Conteúdo |
| `form.hint.content` | Markdown. Entra inline em TODO turno dos projetos onde a rule vale — quanto menor, melhor. |
| `form.placeholder.content` | Responda sempre em português brasileiro. |
| `form.warn.contentLarge` | {size} — acima de 8 KB; rules grandes encarecem TODO turno (não bloqueia). |
| `form.toggle.isGlobal` | Global (vale para todos os projetos) |
| `form.hint.isGlobal` | Entra em todo turno de todo projeto por padrão; dá para suprimir projeto a projeto no painel do projeto. |
| `form.toggle.enabled` | Habilitada (toggle global) |
| `form.cta.cancel` | Cancelar |
| `form.cta.create` | Criar |
| `form.cta.save` | Salvar |
| `form.cta.loading` | Salvando... |
| `form.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `form.error.generic` | Não foi possível salvar a rule. Tente novamente. |
| `form.error.nameConflict` | Já existe uma rule com este nome. Escolha outro. |
| `form.error.contentOver` | Conteúdo acima de 1 MiB. Reduza o tamanho para salvar. |

### Overlay vínculo/override por projeto

| Slot | Texto |
|------|-------|
| `link.title` | Rules deste projeto |
| `link.pill.active` | {N} ativa \| {N} ativas |
| `link.cta.new` | + Nova rule |
| `link.aria.close` | Fechar |
| `link.empty` | Nenhuma rule ainda. Crie a primeira com “+ Nova rule”. |
| `link.section.globals` | Globais |
| `link.section.globals.empty` | Nenhuma rule global. |
| `link.section.project` | Deste projeto |
| `link.section.project.empty` | Nenhuma rule de projeto. Crie com “+ Nova rule” para valer só aqui. |
| `link.toggle.globalActive` | ativa neste projeto |
| `link.aria.globalActive` | Ativa {name} neste projeto |
| `link.badge.suppressed` | suprimida aqui |
| `link.toggle.linked` | vinculada a este projeto |
| `link.aria.linked` | Vincular {name} a este projeto |
| `link.pill.on` | on |
| `link.pill.off` | off |
| `link.pill.title.on` | Habilitada neste projeto |
| `link.pill.title.off` | Desabilitada neste projeto |
| `link.footer.aggregate` | Rules ativas neste projeto: {N} · {kb} por turno |
| `link.footer.aggregateHot` | Rules ativas neste projeto: {N} · {kb} por turno — acima de 16 KB; considere enxugar (não bloqueia). |
| `link.warn.activeCap` | {N} rules ativas — acima de 15; considere enxugar (não bloqueia). |
| `link.error.load` | Não foi possível carregar as rules do projeto. |
| `link.error.link` | Não foi possível atualizar o vínculo. |
| `link.error.enabled` | Não foi possível alterar o estado no projeto. |
| `link.error.prelink` | Rule criada, mas não foi possível vinculá-la ao projeto. |
| `harness.pill` | Rules |
| `harness.meta` | {N} ativa \| {N} ativas |
| `harness.title` | Rules deste projeto — {N} ativa(s) · {kb} por turno |
| `harness.title.empty` | Rules deste projeto |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `search` | search | não | filtra nome + description (client-side) |
| `categoryTab` | tabs | — | “Todas” ou categoria exata |
| `cta.new` | button | — | abre modal `new` |
| `card.toggleEnabled` | icon button | — | update otimista `enabled`; reverte no erro |
| `card.edit` | icon button | — | abre modal `edit` |
| `card.delete` | icon + confirm | — | “Excluir?” / “Não”; depois `deleteRule` |
| `form.name` | text | sim | único global; sem CR/LF/control; 409 → nameConflict |
| `form.description` | textarea | não | vazio → `null` |
| `form.category` | text | não | vazio → `null` |
| `form.content` | textarea markdown | sim | soft-warn > 8 KB; não bloqueia submit |
| `form.isGlobal` | checkbox | — | default `false` em create |
| `form.enabled` | checkbox | — | default `true` em create |
| `form.submit` | button | — | disabled se name vazio/inválido, content vazio ou saving |
| `link.globalActive` | switch | — | PUT enabled true/false; disabled se busy ou kill-switch global off |
| `link.linked` | switch | — | PUT link / DELETE unlink (só não-globais) |
| `link.enabledInProject` | pill | — | só se vinculada; PUT `{enabled}` mantendo `sortOrder` |
| `link.create` | button | — | abre form; pós-save pré-vincula se `!isGlobal` |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com lista | grid ou empty; CTA Nova rule |
| `filling` | busca / form | filtra lista; limpa erro de form ao reeditar |
| `loading` | save form | CTA “Salvando...”; `saving` trava submit |
| `disabled` | form inválido / busy link | submit disabled; switches `disabled` enquanto `busy` |
| `error` | load/save/delete/link falha | `role="alert"` vermelho (tela ou modal) |
| `empty` | zero rules | copy `empty.none` / `link.empty` |
| `emptyFiltered` | filtros sem match | copy `empty.filtered` |
| `cardDisabled` | `enabled === false` | `opacity-60` + badge “desativada”; toggle global no overlay não opera |
| `pendingDelete` | clique Excluir | troca ícone por “Excluir?” / “Não” |
| `form.nameInvalid` | CR/LF/control no nome | erro vermelho; submit bloqueado |
| `form.contentLarge` | content > 8 KB | contador âmbar + aviso; submit ok |
| `nameConflict` | API `rule_name_conflict` | erro inline no form |
| `globalActive` | global sem override off (ou override on) | borda accent; switch ligado |
| `globalSuppressed` | override `enabled:false` | badge “suprimida aqui”; switch off |
| `linkActive` | não-global vinculada | borda accent; mostra on/off |
| `aggregateHot` | bytes ativas > 16 KB | rodapé `text-amber` + copy hot |
| `prelinkFailed` | create ok, link falhou | alert `link.error.prelink` |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` | rule card na grid; card no overlay |
| `Field` | labels + input/textarea + hint/erro no form |
| `Input` / `Textarea` | busca, nome, categoria, description, content |
| `Button` | Nova rule, Criar/Salvar (primary), Cancelar |
| `Badge` | Global, categoria, desativada, on/off, suprimida |
| `Tabs` | categorias |
| `Modal` / `Dialog` | RuleFormModal, ProjectRulesModal |
| `IconButton` | ativar, editar, excluir |
| `EmptyState` | lista e seções vazias |
| `Switch` | ativa neste projeto / vinculada |

> **Não** reutilizar `ProjectLinkingModal` genérico: a semântica de global (default-on / override) é oposta à de skills (`linked` ⇔ ativo).

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável)
- [ ] Anatomia `#rules` na ordem documentada; subtítulo distingue globais vs vínculo na tela principal
- [ ] Tabela de copy aplicada (lista, form, overlay, harness) com rename EngrenaCode
- [ ] Card mostra nome + badge Global (se aplicável) + tamanho; toggle/editar/excluir com confirmação
- [ ] Form: name obrigatório sem CR/LF; description opcional; content obrigatório; soft-warn 8 KB
- [ ] Name duplicado mostra `form.error.nameConflict`
- [ ] Overlay: seção Globais (supressão) ≠ seção Deste projeto (vínculo + on/off)
- [ ] Rodapé agregado com soft-warn 16 KB; pill harness com count
- [ ] Contagens do dashboard **não** bloqueiam aceite desta tela (F04)
- [ ] Tema `light` \| `dark` \| `system` via tokens

## Perguntas em aberto

- Screenshot canônico e frame do overlay ainda `TODO`.
- (Resolvidas na spec F06: soft warn ≤15; hard 1 MiB + soft 8 KB; PT-BR acentuado; precedência só no bloco runtime.)

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F06-rules/spec.md` | Contratos API/CRUD/override/`rules-block` |
| `docs/F06-rules/plan.md` | Fases de implementação |
| `docs/F03-workspace/ui.md` | Onde o harness abre o overlay de vínculo/override |
| `docs/F04-dashboard` (ui/spec) | Contadores de catálogo consumidos de F06 |
| `docs/F05-skills/ui.md` | Irmão de catálogo (padrão de lista/form; vínculo diferente) |
| `_reversa_sdd/sdd/design-system.md` | Tokens e superfícies |
| `docs/F06-rules/copy.md` | Catálogo de microcopy (`rules.*` / `rulesForm.*` / `rulesLink.*`) |
