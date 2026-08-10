# Catálogo de copy: F05-skills

**Produto:** EngrenaCode  
**Fonte:** sistema legado (`packages/renderer` — `SkillsScreen`, `SkillFormModal`, `ProjectSkillsModal`)  
**Mapa de rename:** `sistema legado → EngrenaCode`  
**Última atualização:** 2026-08-03

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `skills` (`#skills`), `skillsForm` (modal criar/editar), `skillsLink` (overlay vínculo por projeto).

## Telas

### skills (`#skills`)

| Id | Texto | Notas |
|----|-------|-------|
| `skills.title` | Skills | h1 |
| `skills.subtitle` | Instruções reutilizáveis carregadas sob demanda pelo agente. Vincule-as a um projeto na tela principal para entrarem no catálogo. | |
| `skills.cta.new` | + Nova skill | primary |
| `skills.search.placeholder` | Buscar por nome ou descrição… | |
| `skills.tab.all` | Todas | contagem dinâmica ao lado |
| `skills.empty.none` | Nenhuma skill ainda. Crie a primeira com “+ Nova skill”. | |
| `skills.empty.filtered` | Nenhuma skill corresponde aos filtros. | |
| `skills.card.badge.disabled` | desativada | |
| `skills.card.action.enable` | Ativar | title / aria-label |
| `skills.card.action.disable` | Desativar | title / aria-label |
| `skills.card.action.edit` | Editar | |
| `skills.card.action.delete` | Excluir | |
| `skills.card.action.delete.confirm` | Excluir? | confirmação inline |
| `skills.card.action.delete.cancel` | Não | |
| `skills.error.load` | Não foi possível carregar as skills. | |
| `skills.error.delete` | Não foi possível excluir a skill. | |
| `skills.error.update` | Não foi possível atualizar a skill. | |

### skillsForm (modal Nova / Editar skill)

| Id | Texto | Notas |
|----|-------|-------|
| `skillsForm.title.new` | Nova skill | |
| `skillsForm.title.edit` | Editar skill | |
| `skillsForm.label.name` | Nome | |
| `skillsForm.hint.name` | Chave de invocação, única global. | |
| `skillsForm.placeholder.name` | ex.: convencoes-de-commit | |
| `skillsForm.label.description` | Descrição | |
| `skillsForm.hint.description` | O “quando usar” — é o que o modelo lê para decidir carregar a skill. Curta e específica (sugestão: até ~200 caracteres). | |
| `skillsForm.placeholder.description` | Use ao escrever mensagens de commit neste repositório. | |
| `skillsForm.warn.descriptionLong` | {n} caracteres — descrições longas encarecem o catálogo em todo turno (não bloqueia). | soft warn |
| `skillsForm.label.category` | Categoria | |
| `skillsForm.hint.category` | Opcional — agrupa no menu. | |
| `skillsForm.placeholder.category` | ex.: convenções | |
| `skillsForm.label.content` | Conteúdo | |
| `skillsForm.hint.content` | Markdown. O conteúdo inteiro entra no contexto quando o agente carrega a skill. Teto prático: ~1 MiB. | |
| `skillsForm.placeholder.content` | # Minha skill\n\nInstruções, convenções ou conhecimento de domínio... | literal com quebras |
| `skillsForm.meta.contentSize` | {size} | ex. `1.234 caracteres (~1,2 KB)` via `formatContentSize` |
| `skillsForm.meta.contentOver` | {size} — acima do teto de ~1 MiB do servidor. | |
| `skillsForm.toggle.enabled` | Habilitada (toggle global) | |
| `skillsForm.cta.cancel` | Cancelar | |
| `skillsForm.cta.create` | Criar | |
| `skillsForm.cta.save` | Salvar | |
| `skillsForm.cta.loading` | Salvando... | |
| `skillsForm.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | PT-BR normalizado |
| `skillsForm.error.generic` | Não foi possível salvar a skill. Tente novamente. | PT-BR normalizado |
| `skillsForm.error.nameConflict` | Já existe uma skill com este nome. Escolha outro. | API `skill_name_conflict` |

### skillsLink (overlay “Skills deste projeto”)

| Id | Texto | Notas |
|----|-------|-------|
| `skillsLink.title` | Skills deste projeto | |
| `skillsLink.empty` | Nenhuma skill global. Crie no menu Skills. | |
| `skillsLink.empty.filtered` | Nada corresponde aos filtros. | |
| `skillsLink.toggle` | Ativo neste projeto | |
| `skillsLink.aria.toggle` | Ativar {name} neste projeto | |
| `skillsLink.pill.on` | on | |
| `skillsLink.pill.off` | off | |
| `skillsLink.pill.title.on` | Habilitada neste projeto | |
| `skillsLink.pill.title.off` | Desabilitada neste projeto | |
| `skillsLink.move.up` | Subir {name} | aria-label |
| `skillsLink.move.down` | Descer {name} | aria-label |
| `skillsLink.error.load` | Não foi possível carregar as skills do projeto. | |
| `skillsLink.error.link` | Não foi possível atualizar o vínculo. | |
| `skillsLink.error.enabled` | Não foi possível alterar o estado no projeto. | |
| `skillsLink.error.reorder` | Não foi possível reordenar. | |
| `skillsLink.harness.pill` | Skills | pill Repo Harness (F03) |
| `skillsLink.warn.cap` | Mais de 30 skills vinculadas neste projeto — considere enxugar (não bloqueia). | soft cap PRD |

### Fora do Escopo Central (não importar no MVP)

| Id | Texto | Notas |
|----|-------|-------|
| `skillsForm.toggle.locked` | Template do pipeline (apenas marcador; não bloqueia edição) | legado pipeline; fora F05 Central |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{n}` | comprimento da description em caracteres |
| `{size}` | string de `formatContentSize` (ex. `1.234 caracteres (~1,2 KB)`) |
| `{name}` | nome da skill no card de vínculo |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `skillsLink.warn.cap` | Soft warning ≤30 vínculos | OK — ver tabela skillsLink |
| Contadores dashboard | Copy de F04, não desta feature | ver `docs/F04-*` quando existir |
