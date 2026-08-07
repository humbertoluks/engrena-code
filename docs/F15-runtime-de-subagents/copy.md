# Catálogo de copy: F15-runtime-de-subagents

**Produto:** EngrenaCode  
**Fonte:** LionCodeLabs (`packages/renderer` — `SubagentActivity.tsx`, `ChatHistory.tsx` SubagentBlock, `SubagentActivity.test.tsx`; related idle em `SubagentFormModal.tsx`)  
**Mapa de rename:** `LionCode → EngrenaCode` (nunca `Lion*`)  
**Última atualização:** 2026-08-06

Strings literais para UI de **runtime** (activity card + timeline + audit). Specs de tela (`ui.md`) e código devem importar estes ids — não reinventar texto.

> **Extensão F07:** ids abaixo reutilizam o namespace `subagentsRun.*` de `docs/F07-subagents/copy.md`. Este catálogo **não** duplica CRUD `#subagents` / form / link. Novos slots F15 (sinal, action verbs, deferred isolation) ficam aqui; status baseline permanece alinhado a F07 até fechar a lacuna PRD.

## Convenção de ids

`subagentsRun.{{slot}}`  
Exemplos: `subagentsRun.activity.status.timeout`, `subagentsRun.activity.signal`, `subagentsRun.timeline.cta`.

Related idle do catálogo: `subagentsForm.label.idleTimeout` (F07 — não reimplementar em F15).

## Telas

### #principal — subagentsRun (sidebar activity + timeline + audit)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsRun.activity.title` | Subagents | summary caps sidebar |
| `subagentsRun.activity.section.active` | Ativos | |
| `subagentsRun.activity.section.done` | Concluídos · {N} | |
| `subagentsRun.activity.empty.active` | Nenhum subagent ativo. | |
| `subagentsRun.activity.empty.done` | Nenhum run concluído nesta thread. | |
| `subagentsRun.activity.empty.none` | Nenhum run de subagent nesta thread. | |
| `subagentsRun.activity.status.running` | rodando… | sidebar; na row ativa a fonte omite o texto e mostra só o pulso |
| `subagentsRun.activity.status.completed` | concluído | |
| `subagentsRun.activity.status.cancelled` | cancelado | |
| `subagentsRun.activity.status.timeout` | timeout | **literal da fonte** (idle watchdog); ver Lacunas vs PRD |
| `subagentsRun.activity.status.error` | erro | |
| `subagentsRun.activity.signal` | sinal há {duration} | heartbeat ao vivo; âmbar se ≥ 2 min |
| `subagentsRun.activity.signal.title` | Silêncio desde o último evento do subagent (heartbeat do broker) | `title` nativo |
| `subagentsRun.activity.run.open` | Abrir o run para auditoria ({provider} · {model}) | title da row |
| `subagentsRun.timeline.pill` | Subagent | pill accent |
| `subagentsRun.timeline.fallbackName` | subagent | se nome vazio |
| `subagentsRun.timeline.status.running` | trabalhando… | ≠ sidebar — intencional |
| `subagentsRun.timeline.status.completed` | concluído | |
| `subagentsRun.timeline.status.cancelled` | cancelado | |
| `subagentsRun.timeline.status.error` | erro | |
| `subagentsRun.timeline.status.timeout` | timeout | contrato Engrena; **fonte ChatHistory ainda não distingue** (cai em trabalhando…) |
| `subagentsRun.timeline.open` | Abrir o run do subagent (auditoria) | title |
| `subagentsRun.timeline.cta` | ver run | texto à direita do bloco |
| `subagentsRun.audit.aria` | Run do subagent {name} | `aria-label` do dialog |
| `subagentsRun.audit.close` | Fechar | |
| `subagentsRun.audit.empty.waiting` | Aguardando a primeira resposta do subagent… | status null, sem text/actions |
| `subagentsRun.audit.empty.done` | Run sem saída. | terminal sem text |
| `subagentsRun.audit.section.activity` | Atividade · {N} ações | |
| `subagentsRun.audit.activity.omitted` | {N} anteriores omitidas | quando `actionCount > actions.length` |
| `subagentsRun.audit.section.fullResponse` | Resposta completa | `<details>` se há actions |
| `subagentsRun.audit.action.ariaRunning` | Ação em andamento | |
| `subagentsRun.audit.action.read.started` | Lendo | |
| `subagentsRun.audit.action.read.done` | Leu | |
| `subagentsRun.audit.action.write.started` | Criando | |
| `subagentsRun.audit.action.write.done` | Criou | |
| `subagentsRun.audit.action.edit.started` | Editando | |
| `subagentsRun.audit.action.edit.done` | Editou | |
| `subagentsRun.audit.action.run.started` | Rodando | |
| `subagentsRun.audit.action.run.done` | Rodou | |
| `subagentsRun.audit.action.search.started` | Buscando | |
| `subagentsRun.audit.action.search.done` | Buscou | |
| `subagentsRun.audit.action.other.started` | Executando | |
| `subagentsRun.audit.action.other.done` | Executou | |
| `subagentsRun.audit.action.error` | Falhou | |
| `subagentsRun.audit.action.interrupted` | Interrompido | |
| `subagentsRun.audit.action.duration.subsecond` | \<1s | em vez de 00:00 |

### Related — `#subagents` idle field (F07; referência só)

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsForm.label.idleTimeout` | Timeout de inatividade (min) | form catálogo |
| `subagentsForm.placeholder.idleTimeout` | 20 (default) | |
| `subagentsForm.hint.idleTimeout` | Silêncio total do subagent por esse período interrompe o run com status timeout e devolve o parcial ao orquestrador. Vazio = 20min. | |

### Visível na fonte — deferred / fora do escopo F15 (write-parallel / featbuild)

Não importar como aceite F15; documentado para não “sumir” da referência.

| Id | Texto | Notas |
|----|-------|-------|
| `subagentsRun.isolation.worktree` | worktree | badge no **modal** (não na row) |
| `subagentsRun.isolation.worktree.title` | Rodou numa cópia isolada do projeto; o patch foi integrado pelo harness. | |
| `subagentsRun.isolation.live-write` | live-write | |
| `subagentsRun.isolation.live-write.title` | Edição direta no projeto (serializada, sem fork/apply — subagent com MCPs). | |
| `subagentsRun.isolation.shared-read` | shared-read | |
| `subagentsRun.isolation.shared-read.title` | Leitura compartilhada do projeto (sem escrita). | |
| `subagentsRun.isolation.liveWrite.note` | edição direta no projeto (live-write) | nota no modal |
| `subagentsRun.apply.applied` | aplicado | |
| `subagentsRun.apply.no-changes` | sem mudanças | |
| `subagentsRun.apply.conflict` | conflito | |
| `subagentsRun.apply.stale-base` | base obsoleta | |
| `subagentsRun.apply.timeout` | timeout | applyStatus — distinto do run status |
| `subagentsRun.apply.skipped-cancelled` | pulado (cancelamento) | |
| `subagentsRun.apply.not-applied` | não aplicado | |
| `subagentsRun.apply.error` | erro de integração | |
| `subagentsRun.audit.patch.files` | Arquivos do patch ({N}) | |
| `subagentsRun.audit.patch.empty` | Nenhum arquivo atribuído. | |
| `subagentsRun.audit.patch.copy` | Copiar resgate | |
| `subagentsRun.audit.patch.copied` | copiado! | |
| `subagentsRun.activity.section.others` | Outros | runs fora do sprint grouping |

## Placeholders dinâmicos

| Token | Significado |
|-------|-------------|
| `{N}` | contagem (runs concluídos, ações omitidas, arquivos do patch) |
| `{name}` | nome do subagent |
| `{provider}` | id/label do provider do run |
| `{model}` | id/label do model do run (pode ser vazio) |
| `{duration}` | silêncio formatado (`8s`, `2m 30s`, … via `formatDurationSeconds`) |
| `{level}` | reasoning label (Low, Medium, Extra High, …) |

## Lacunas

| Id necessário | Motivo | Status |
|---------------|--------|--------|
| `subagentsRun.activity.status.timeout` / `timeline.status.timeout` → **“Timeout (idle)”** | PRD F15 § critérios: badge âmbar “Timeout (idle)”. Fonte + F07 baseline usam **`timeout`**. | TODO — override de destino; **não** tratar como se viesse da fonte |
| Tom âmbar no timeout | PRD: âmbar; fonte activity: `text-red` (tone error) | TODO — Design Lock |
| Timeline case `timeout` | Fonte `ChatHistory.subagentStatusLabel` não tem case; timeout → `trabalhando…` | TODO — alinhar ao id `timeout` já previsto no Engrena |
| `subagentsRun.activity.signal` | Presente na fonte; ausente do catálogo F07 | documentado aqui (F15) |
| Isolation / apply / patch / sprint | Visíveis em `SubagentActivity` fonte | deferred — fora escopo Engrena F15 |
| PNG activity no `#principal` | Card runtime ainda não montado; baseline atual = modal form em `ui/subagent-activity-referencia.png` | recapturar quando activity existir |
