# Catálogo de copy: F07-subagents

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`packages/renderer` — `SubagentsScreen`, `SubagentFormModal`, `ProjectSubagentsModal`, `SubagentActivity`, `ChatHistory` SubagentBlock, harness em `WorkspaceSidebar`)  
**Mapa de rename:** `LionCode → EngrenaCode`  
**Última atualização:** 2026-08-03

Strings literais para UI. Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

## Convenção de ids

`{tela}.{slot}`  
Telas neste catálogo: `subagents` (`#subagents`), `subagentsForm` (modal criar/editar), `subagentsLink` (overlay vínculo + harness), `subagentsRun` (sidebar activity + timeline + audit).

## Telas

### subagents (`#subagents`)

| Id | Texto | Notas |
|----|-------|-------|
| `subagents.title` | SubAgents | h1 |
| `subagents.subtitle` | Definições globais reutilizáveis. Vincule-as a um projeto na tela principal para o agente principal poder invocá-las. | |
| `subagents.cta.new` | + Novo Agente | primary |
| `subagents.search.placeholder` | Buscar por nome ou descrição… | |
| `subagents.filter.model.all` | Todos os modelos | |
| `subagents.tab.all` | Todos | contagem dinâmica ao lado |
| `subagents.empty.none` | Nenhum subagent ainda. Crie o primeiro com “+ Novo Agente”. | |
| `subagents.empty.filtered` | Nenhum subagent corresponde aos filtros. | |
| `subagents.card.badge.disabled` | desativado | masculino (fonte lista) |
| `subagents.card.model.inherit` | herda do pai | sem model explícito + provider inherit |
| `subagents.card.model.default` | default do provider | sem model + provider ≠ inherit |
| `subagents.card.tools.all` | todas as tools | tools === null |
| `subagents.card.tools.none` | sem tools (read-only) | tools === [] |
| `subagents.card.meta.reasoning` | Reasoning: {level} | |
| `subagents.card.meta.reasoning.inherit` | herda do pai | |
| `subagents.card.meta.reasoning.default` | default | |
| `subagents.card.action.enable` | Ativar | title / aria-label |
| `subagents.card.action.disable` | Desativar | title / aria-label |
| `subagents.card.action.edit` | Editar | |
| `subagents.card.action.delete` | Excluir | |
| `subagents.card.action.delete.confirm` | Excluir? | confirmação inline |
| `subagents.card.action.delete.cancel` | Não | |
| `subagents.error.load` | Não foi possível carregar os subagents. | |
| `subagents.error.delete` | Não foi possível excluir o subagent. | |
| `subagents.error.update` | Não foi possível atualizar o subagent. | |
| `subagents.provider.claude` | Claude | badge card |
| `subagents.provider.codex` | Codex | |
| `subagents.provider.kimi` | Kimi | |
| `subagents.provider.inherit` | Herda | |

### subagentsForm (modal Novo / Editar subagent)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsForm.title.new` | Novo subagent | |
| `subagentsForm.title.edit` | Editar subagent | |
| `subagentsForm.label.name` | Nome | |
| `subagentsForm.hint.name` | Chave de invocação, única global. | |
| `subagentsForm.placeholder.name` | ex.: revisor-seguranca | |
| `subagentsForm.label.description` | Descrição | |
| `subagentsForm.hint.description` | O “quando usar” — roteia o agente principal. | |
| `subagentsForm.placeholder.description` | Use para revisar diffs em busca de vulnerabilidades. | |
| `subagentsForm.label.category` | Categoria | |
| `subagentsForm.hint.category` | Opcional — agrupa no menu. | |
| `subagentsForm.placeholder.category` | ex.: qualidade | |
| `subagentsForm.label.provider` | Provider | |
| `subagentsForm.provider.inherit` | Herdar configuração do agente pai | option |
| `subagentsForm.provider.claude` | Claude | |
| `subagentsForm.provider.codex` | Codex | |
| `subagentsForm.provider.kimi` | Kimi | |
| `subagentsForm.hint.inherit` | O subagent usará o mesmo provider, modelo e reasoning do agente pai. | só se inherit |
| `subagentsForm.label.model` | Modelo | oculto se inherit |
| `subagentsForm.hint.model` | Padrão do provider quando não escolhido. | |
| `subagentsForm.option.model.default` | Padrão do provider | |
| `subagentsForm.label.reasoning` | Reasoning | oculto se inherit / sem options |
| `subagentsForm.hint.reasoning` | Níveis suportados pelo modelo escolhido. | |
| `subagentsForm.option.reasoning.default` | Padrão do provider | |
| `subagentsForm.reasoning.low` | Low | labels em inglês (fonte) |
| `subagentsForm.reasoning.medium` | Medium | |
| `subagentsForm.reasoning.high` | High | |
| `subagentsForm.reasoning.extra-high` | Extra High | |
| `subagentsForm.reasoning.max` | Max | |
| `subagentsForm.reasoning.ultra` | Ultra | |
| `subagentsForm.reasoning.ultracode` | Ultracode | |
| `subagentsForm.reasoning.ultrathink` | Ultrathink | |
| `subagentsForm.label.tools` | Tools | |
| `subagentsForm.hint.tools.unrestricted` | Estado atual: sem restrição (todas as built-ins do provider). | |
| `subagentsForm.hint.tools.none` | Estado atual: nenhuma built-in liberada. | |
| `subagentsForm.hint.tools.allowlist` | Estado atual: somente as tools selecionadas. | |
| `subagentsForm.tools.readonly` | Read-only (Read/Grep/Glob) | |
| `subagentsForm.tools.none` | Nenhuma | |
| `subagentsForm.tools.unrestricted` | Sem restrição | |
| `subagentsForm.label.prompt` | System prompt | |
| `subagentsForm.placeholder.prompt` | Instruções do subagent (system prompt aplicado ao filho). | |
| `subagentsForm.label.idleTimeout` | Timeout de inatividade (min) | |
| `subagentsForm.placeholder.idleTimeout` | 20 (default) | |
| `subagentsForm.hint.idleTimeout` | Silêncio total do subagent por esse período interrompe o run com status timeout e devolve o parcial ao orquestrador. Vazio = 20min. | |
| `subagentsForm.toggle.enabled` | Habilitado (toggle global) | |
| `subagentsForm.cta.cancel` | Cancelar | |
| `subagentsForm.cta.create` | Criar | |
| `subagentsForm.cta.save` | Salvar | |
| `subagentsForm.cta.loading` | Salvando... | |
| `subagentsForm.error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. | PT-BR acentuado |
| `subagentsForm.error.generic` | Não foi possível salvar o subagent. Tente novamente. | |
| `subagentsForm.error.nameConflict` | Já existe um subagent com este nome. Escolha outro. | API `subagent_name_conflict` |
| `subagentsForm.error.promptOver` | Prompt acima de 1 MiB. Reduza o tamanho para salvar. | hard block |

### subagentsLink (overlay “SubAgents deste projeto”)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsLink.title` | SubAgents deste projeto | |
| `subagentsLink.empty` | Nenhum subagent global. Crie no menu SubAgents. | |
| `subagentsLink.empty.filtered` | Nada corresponde aos filtros. | |
| `subagentsLink.toggle` | Ativo neste projeto | |
| `subagentsLink.aria.toggle` | Ativar {name} neste projeto | |
| `subagentsLink.pill.on` | on | |
| `subagentsLink.pill.off` | off | |
| `subagentsLink.pill.title.on` | Habilitado neste projeto | masculino (subagent) |
| `subagentsLink.pill.title.off` | Desabilitado neste projeto | |
| `subagentsLink.move.up` | Subir {name} | aria-label |
| `subagentsLink.move.down` | Descer {name} | aria-label |
| `subagentsLink.meta.inherit` | inherit (configuração do pai) | linha mono |
| `subagentsLink.error.load` | Não foi possível carregar os subagents do projeto. | |
| `subagentsLink.error.link` | Não foi possível atualizar o vínculo. | |
| `subagentsLink.error.enabled` | Não foi possível alterar o estado no projeto. | |
| `subagentsLink.error.reorder` | Não foi possível reordenar. | |
| `subagentsLink.harness.pill` | SubAgents | pill Repo Harness (F03) |
| `subagentsLink.warn.cap` | {N} subagents vinculados — acima de 10; considere enxugar (não bloqueia). | soft warn PRD ≤10 |

### subagentsRun (sidebar + timeline + audit)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsRun.activity.title` | Subagents | summary caps sidebar |
| `subagentsRun.activity.section.active` | Ativos | |
| `subagentsRun.activity.section.done` | Concluídos · {N} | |
| `subagentsRun.activity.empty.active` | Nenhum subagent ativo. | |
| `subagentsRun.activity.empty.done` | Nenhum run concluído nesta thread. | |
| `subagentsRun.activity.empty.none` | Nenhum run de subagent nesta thread. | |
| `subagentsRun.activity.status.running` | rodando… | sidebar |
| `subagentsRun.activity.status.completed` | concluído | |
| `subagentsRun.activity.status.cancelled` | cancelado | |
| `subagentsRun.activity.status.timeout` | timeout | idle watchdog |
| `subagentsRun.activity.status.error` | erro | |
| `subagentsRun.activity.run.open` | Abrir o run para auditoria ({provider} · {model}) | title |
| `subagentsRun.timeline.status.running` | trabalhando… | ChatHistory (≠ sidebar — intencional) |
| `subagentsRun.timeline.status.completed` | concluído | |
| `subagentsRun.timeline.status.cancelled` | cancelado | |
| `subagentsRun.timeline.status.error` | erro | |
| `subagentsRun.timeline.status.timeout` | timeout | alinhar com activity |
| `subagentsRun.timeline.open` | Abrir o run do subagent (auditoria) | title |
| `subagentsRun.audit.aria` | Run do subagent {name} | |
| `subagentsRun.audit.close` | Fechar | |
| `subagentsRun.audit.empty.waiting` | Aguardando a primeira resposta do subagent… | status null |
| `subagentsRun.audit.empty.done` | Run sem saída. | terminal sem text |
| `subagentsRun.audit.section.activity` | Atividade · {N} ações | |

### Fora do Escopo Central (não importar no MVP)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsForm.label.kind` | Tipo | pipeline fora MVP |
| `subagentsForm.hint.kind` | Editável. Pipeline é usado pelos fluxos internos; Dev entra no catálogo dos projetos. | |
| `subagentsForm.option.kind.dev` | Dev | |
| `subagentsForm.option.kind.pipeline` | Pipeline | |
| `subagentsForm.label.skills` | Skills | PRD F07 não lista |
| `subagentsForm.hint.skills` | Seleção GLOBAL (ignora o vínculo por projeto). Nada selecionado = nenhuma skill. | |
| `subagentsForm.skills.empty` | Nenhuma skill global habilitada. | |
| `subagentsForm.label.mcps` | MCPs | filho sem MCP no MVP |
| `subagentsForm.hint.mcps` | Seleção GLOBAL (ignora o vínculo por projeto). Nada selecionado = nenhum MCP. | |
| `subagentsForm.mcps.codexBlocked` | MCPs não são suportados em subagents Codex. | |
| `subagentsForm.mcps.empty` | Nenhum MCP global cadastrado. | |
| `subagentsForm.warn.toolsMcps` | Com allowlist de tools, as tools dos MCPs externos ficam indisponíveis para este subagent (limitação v1). | |
| `subagentsForm.toggle.network` | Acesso à rede no sandbox | |
| `subagentsForm.hint.network` | (codex: libera pnpm install/downloads; nunca em read-only) | |
| `subagents.card.chip.skills.none` | skills: nenhuma | |
| `subagents.card.chip.skills.count` | skills: {N} | |
| `subagents.card.chip.mcps.none` | MCPs: nenhum | |
| `subagents.card.chip.mcps.count` | MCPs: {N} | |
| `subagents.provider.glm` | GLM | fora providers MVP |
| `subagents.provider.minimax` | MiniMax | |
| `subagents.provider.grok` | Grok | |
| `subagentsForm.provider.glm` | GLM | |
| `subagentsForm.provider.minimax` | MiniMax | |
| `subagentsForm.provider.grok` | Grok | |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{N}` | contagem (runs concluídos, ações, skills/MCPs) |
| `{level}` | reasoning level ou fallback inherit/default |
| `{name}` | nome do subagent |
| `{provider}` | id/label do provider do run |
| `{model}` | id/label do model do run |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `subagentsLink.warn.cap` | Soft warn ≤10 (spec F07) | resolvido |
| `subagentsForm.error.promptOver` | Hard 1 MiB (spec F07) | resolvido |
| `subagentsRun.timeline.status.timeout` | Timeline distingue timeout | resolvido |
| Running copy | Sidebar `rodando…` ≠ timeline `trabalhando…` | intencional (spec) |
| Gênero disabled / pills | Card `desativado`; pills Habilitado/Desabilitado | resolvido |
| `subagentsForm.error.*` acentos | Normalizar PT-BR | resolvido |
| Contadores dashboard | Copy de F04 | ver `docs/F04-*` |
| Diffs do filho na revisão | Superfície F03 | ver `docs/F03-workspace/ui.md` |
