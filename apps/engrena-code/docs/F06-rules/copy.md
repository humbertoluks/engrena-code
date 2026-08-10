# Catálogo de copy: F06-rules

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer` — `RulesScreen`, `RuleFormModal`, `ProjectRulesModal`, harness em `WorkspaceSidebar`)  
**Mapa de rename:** `sistema legado → EngrenaCode`  
**Última atualização:** 2026-08-03

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `rules` (`#rules`), `rulesForm` (modal criar/editar), `rulesLink` (overlay vínculo/override por projeto + harness).

## Telas

### rules (`#rules`)

| Id | Texto | Notas |
|----|-------|-------|
| `rules.title` | Rules | h1 |
| `rules.subtitle` | Instruções permanentes injetadas em todo turno. As globais valem para todos os projetos; as demais, só onde forem vinculadas na tela principal. | |
| `rules.cta.new` | + Nova rule | primary |
| `rules.search.placeholder` | Buscar por nome ou descrição… | |
| `rules.tab.all` | Todas | contagem dinâmica ao lado |
| `rules.empty.none` | Nenhuma rule ainda. Crie a primeira com “+ Nova rule”. | |
| `rules.empty.filtered` | Nenhuma rule corresponde aos filtros. | |
| `rules.card.badge.global` | Global | âmbar; só `isGlobal` |
| `rules.card.badge.disabled` | desativada | |
| `rules.card.action.enable` | Ativar | title / aria-label |
| `rules.card.action.disable` | Desativar | title / aria-label |
| `rules.card.action.edit` | Editar | |
| `rules.card.action.delete` | Excluir | |
| `rules.card.action.delete.confirm` | Excluir? | confirmação inline |
| `rules.card.action.delete.cancel` | Não | |
| `rules.error.load` | Não foi possível carregar as rules. | |
| `rules.error.delete` | Não foi possível excluir a rule. | |
| `rules.error.update` | Não foi possível atualizar a rule. | |

### rulesForm (modal Nova / Editar rule)

| Id | Texto | Notas |
|----|-------|-------|
| `rulesForm.title.new` | Nova rule | |
| `rulesForm.title.edit` | Editar rule | |
| `rulesForm.label.name` | Nome | |
| `rulesForm.hint.name` | Único global, sem quebras de linha (entra no delimitador do bloco — o servidor rejeita). | |
| `rulesForm.placeholder.name` | ex.: responder-em-ptbr | |
| `rulesForm.error.nameInvalid` | O nome não pode conter quebras de linha ou caracteres de controle. | gate client |
| `rulesForm.label.description` | Descrição | opcional (≠ skills) |
| `rulesForm.hint.description` | Opcional — só para você se lembrar do porquê. | |
| `rulesForm.placeholder.description` | Convenção de idioma das respostas. | |
| `rulesForm.label.category` | Categoria | |
| `rulesForm.hint.category` | Opcional — agrupa no menu. | |
| `rulesForm.placeholder.category` | ex.: convenções | |
| `rulesForm.label.content` | Conteúdo | |
| `rulesForm.hint.content` | Markdown. Entra inline em TODO turno dos projetos onde a rule vale — quanto menor, melhor. | |
| `rulesForm.placeholder.content` | Responda sempre em português brasileiro. | |
| `rulesForm.meta.contentSize` | {size} | via `formatContentSize` |
| `rulesForm.warn.contentLarge` | {size} — acima de 8 KB; rules grandes encarecem TODO turno (não bloqueia). | soft warn |
| `rulesForm.toggle.isGlobal` | Global (vale para todos os projetos) | |
| `rulesForm.hint.isGlobal` | Entra em todo turno de todo projeto por padrão; dá para suprimir projeto a projeto no painel do projeto. | só se checkbox marcado |
| `rulesForm.toggle.enabled` | Habilitada (toggle global) | |
| `rulesForm.cta.cancel` | Cancelar | |
| `rulesForm.cta.create` | Criar | |
| `rulesForm.cta.save` | Salvar | |
| `rulesForm.cta.loading` | Salvando... | |
| `rulesForm.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | PT-BR acentuado |
| `rulesForm.error.generic` | Não foi possível salvar a rule. Tente novamente. | |
| `rulesForm.error.nameConflict` | Já existe uma rule com este nome. Escolha outro. | API `rule_name_conflict` |
| `rulesForm.error.contentOver` | Conteúdo acima de 1 MiB. Reduza o tamanho para salvar. | hard block |

### rulesLink (overlay “Rules deste projeto” + harness)

| Id | Texto | Notas |
|----|-------|-------|
| `rulesLink.title` | Rules deste projeto | |
| `rulesLink.pill.active` | {N} ativa \| {N} ativas | header do modal |
| `rulesLink.cta.new` | + Nova rule | |
| `rulesLink.aria.close` | Fechar | |
| `rulesLink.empty` | Nenhuma rule ainda. Crie a primeira com “+ Nova rule”. | |
| `rulesLink.section.globals` | Globais | heading seção |
| `rulesLink.section.globals.empty` | Nenhuma rule global. | |
| `rulesLink.section.project` | Deste projeto | heading seção |
| `rulesLink.section.project.empty` | Nenhuma rule de projeto. Crie com “+ Nova rule” para valer só aqui. | |
| `rulesLink.toggle.globalActive` | ativa neste projeto | |
| `rulesLink.aria.globalActive` | Ativa {name} neste projeto | |
| `rulesLink.badge.suppressed` | suprimida aqui | override off |
| `rulesLink.toggle.linked` | vinculada a este projeto | |
| `rulesLink.aria.linked` | Vincular {name} a este projeto | |
| `rulesLink.pill.on` | on | |
| `rulesLink.pill.off` | off | |
| `rulesLink.pill.title.on` | Habilitada neste projeto | |
| `rulesLink.pill.title.off` | Desabilitada neste projeto | |
| `rulesLink.footer.aggregate` | Rules ativas neste projeto: {N} · {kb} por turno | |
| `rulesLink.footer.aggregateHot` | Rules ativas neste projeto: {N} · {kb} por turno — acima de 16 KB; considere enxugar (não bloqueia). | > 16 KB |
| `rulesLink.error.load` | Não foi possível carregar as rules do projeto. | |
| `rulesLink.error.link` | Não foi possível atualizar o vínculo. | |
| `rulesLink.error.enabled` | Não foi possível alterar o estado no projeto. | |
| `rulesLink.error.prelink` | Rule criada, mas não foi possível vinculá-la ao projeto. | |
| `rulesLink.harness.pill` | Rules | row Repo Harness (F03) |
| `rulesLink.harness.meta` | {N} ativa \| {N} ativas | meta na row |
| `rulesLink.harness.title` | Rules deste projeto — {N} ativa(s) · {kb} por turno | title com summary |
| `rulesLink.harness.title.empty` | Rules deste projeto | sem summary ainda |
| `rulesLink.warn.activeCap` | {N} rules ativas — acima de 15; considere enxugar (não bloqueia). | soft warn PRD ≤15 |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{N}` | contagem de rules ativas no projeto |
| `{size}` | string de `formatContentSize` (ex. `1.234 caracteres (~1,2 KB)`) |
| `{kb}` | string de `formatKb` (ex. `~2,3 KB`) |
| `{name}` | nome da rule no card de vínculo/override |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `rulesLink.warn.activeCap` | Soft warn ≤15 (spec F06) | resolvido — id na tabela rulesLink |
| `rulesForm.error.contentOver` | Hard 1 MiB (spec F06) | resolvido — id na tabela rulesForm |
| `rulesForm.error.*` acentos | Normalizar PT-BR | resolvido |
| Precedência CLAUDE.md/AGENTS.md | Só no preamble do bloco runtime | fora da UI (spec) |
| Contadores dashboard | Copy de F04, não desta feature | ver `docs/F04-*` quando existir |
