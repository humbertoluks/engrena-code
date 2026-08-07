# Spec de UI: #principal (Runtime de SubAgents — activity + timeline + audit)

**Feature:** F15-runtime-de-subagents  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer` — `SubagentActivity.tsx`, `ChatHistory.tsx` SubagentBlock, mount em `WorkspaceSidebar.tsx`)  
**Componente fonte:** `packages/renderer/src/components/SubagentActivity.tsx` (+ `SubagentRunModal`, `RunRow`; bloco aninhado em `ChatHistory.tsx`; idle timeout label no form `#subagents` só como related)  
**Componente destino (previsto):** `src/renderer/components/subagents/SubagentActivity.tsx`, `SubagentTimelineBlock.tsx`, `SubagentRunAuditModal.tsx` (montados em `#principal` / ChatHistory / WorkspaceSidebar)  
**Última atualização:** 2026-08-06

> **Relação com F07:** este SDD **estende** o contrato runtime já catalogado em `docs/F07-subagents/ui.md` § “Sidebar activity + timeline + audit” e ids `subagentsRun.*` em `docs/F07-subagents/copy.md`. Não reespecifica CRUD `#subagents`, form completo nem overlay de vínculo.

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F15-runtime-de-subagents/ui/subagent-activity-referencia.png` |
| Light (opcional) | N/A |
| Dark (opcional) | mesmo frame (tema Escuro) |

> Capturado 2026-08-06 no EngrenaCode: modal **Novo subagent** em `#subagents` (inclui `Timeout de inatividade (min)`). O card `SubagentActivity` no `#principal` ainda **não está montado** nesta build; PNG canônico cobre o related idle até o runtime UI ser wired.

## Escopo

**Inclui:** layout/anatomia do card sidebar “Subagents”, bloco aninhado na timeline do chat, modal de auditoria do run, copy literal de status/duração/sinal/empty/audit, estados de UI de run (incl. timeout idle), mapeamento de tokens/padrões de superfície, critérios de aceite visual do runtime.

**Exclui:**
- Contratos de API/IPC/delegação/idle watchdog (ficam no `spec.md` técnico F15).
- CRUD/catálogo `#subagents`, form completo, overlay de vínculo (F07).
- Write-parallel / isolation badges como requisito de produto F15 (`worktree` / `live-write` / `shared-read`, `applyStatus`, patch rescue, agrupamento por sprint/featbuild): **visíveis na fonte** e documentados abaixo, mas **fora do escopo Engrena F15** (deferred).
- Tela Consumo / pricing (F11); só guarantee de write path fica no spec técnico.
- Implementação de componentes (salvo nomes em “Componentes sugeridos”).

## Anatomia (topo → base)

### A) Card sidebar `SubagentActivity` (WorkspaceSidebar, 2ª posição)

Ordem obrigatória de renderização:

1. `<details open>` card: summary caps “Subagents” + ícone + pulso azul se há ativo + chevron.
2. Modo lista plana (sem build ativo na thread — caminho F15):
   1. Seção “Ativos”
   2. Empty “Nenhum subagent ativo.” **ou** lista de `RunRow` ativos
   3. Seção “Concluídos · {N}”
   4. Empty “Nenhum run concluído nesta thread.” **ou** lista de `RunRow` concluídos (mais recente primeiro)
3. Cada `RunRow` (botão full-width): nome · (stageId se houver) · ação em andamento · applyStatus · model · effort · relógio mm:ss · “sinal há {duration}” (só ativo com heartbeat) · status (texto omitido enquanto `running` na row — só pulso)
4. Clique na row → `SubagentRunModal` (fora do `<details>` para não sumir ao colapsar)

### B) Bloco timeline `SubagentBlock` (ChatHistory)

1. Botão linha: ícone tool · pill “Subagent” · nome (mono) · isolation badge (se houver) · stageId · applyStatus · provider · model · status · CTA “ver run”
2. Clique → mesmo `SubagentRunModal` (com `input` da `call_subagent` correlacionada quando disponível)
3. Tool `call_subagent` casada por `parentToolCallId` **não** renderiza no work log genérico

### C) Modal de auditoria `SubagentRunModal`

1. Overlay `role="dialog"` (Esc / backdrop fecha)
2. Header: nome · isolation badge · stageId · applyStatus · provider · model · reasoning · status (com pulso se running) · Fechar
3. Seção opcional atribuição (isolation/patch) — **deferred F15** se presente na fonte
4. Body: input da delegação (pre) · seção “Atividade · {N} ações” (ActionLines intercaladas com markdown) · resposta / empty waiting|done
5. Validator report / sprint grouping: presentes na fonte, **fora do escopo F15**

**Alinhamento do card / painel:** card na coluna da sidebar (não centro de viewport); modal centrado no viewport (`grid place-items-center`)  
**Largura máx.:** card = largura da sidebar; modal `max-w-[760px]`, `max-h-[84vh]`

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página / host | `#principal` workspace; sidebar column | sem tela própria |
| Card activity | `rounded-xl border border-border` + surface mix | summary uppercase muted |
| Gap interno | `gap-[2px]` lista; `gap-sm` rows | |
| Run row | `text-[12px]`, hover surface mix, `focus-visible:ring-2 focus-visible:ring-accent` | |
| Relógio / sinal | `font-mono tabular-nums`; sinal ≥2min → `text-amber` | `SIGNAL_WARN_MS = 120000` |
| Status running | pulso `bg-accent` (fonte: `#4c8ef0`) | mapear para token accent |
| Status done | `text-green` | |
| Status error/timeout (fonte) | `text-red` | **PRD F15 pede badge âmbar** para timeout idle — ver Perguntas |
| Timeline block | `rounded-md border border-border bg-surface-2/30` | pill `bg-accent` “Subagent” |
| Modal | `rounded-lg border border-border bg-surface shadow-lg` | header border-b |
| Action line | `font-mono text-[11px] rounded-md border bg-surface-2` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro / empty | `text-muted` italic nos empties; `text-red` em falhas | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Pulso running | `#4c8ef0` hard-coded | `bg-accent` / token Design Lock |
| Timeout status tone (activity) | `tone: 'error'` → `text-red` | PRD: âmbar para “Timeout (idle)” — decisão aberta |
| Timeline timeout | `subagentStatusLabel` **não** trata `'timeout'` (cai em `trabalhando…`) | Destino Engrena já tem id `subagentsRun.timeline.status.timeout` = `timeout`; F15 deve alinhar o switch |
| Isolation na row | removido da linha (só modal) | fora escopo F15 |
| Sinal de vida | `sinal há {formatDurationSeconds}` | manter literal fonte |
| Idle form (related `#subagents`) | label “Timeout de inatividade (min)” | já em F07 `subagentsForm.*` |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode` (nunca `Lion*`). Células = texto final no destino **salvo onde notado como lacuna PRD**.

Baseline ids: reutilizar `subagentsRun.*` de F07; F15 só acrescenta/clarifica lacunas.

### Card activity

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
| `activity.signal` | sinal há {duration} |
| `activity.signal.title` | Silêncio desde o último evento do subagent (heartbeat do broker) |
| `activity.run.open` | Abrir o run para auditoria ({provider} · {model}) |

### Timeline

| Slot | Texto |
|------|-------|
| `timeline.pill` | Subagent |
| `timeline.fallbackName` | subagent |
| `timeline.status.running` | trabalhando… |
| `timeline.status.completed` | concluído |
| `timeline.status.cancelled` | cancelado |
| `timeline.status.error` | erro |
| `timeline.status.timeout` | timeout |
| `timeline.open` | Abrir o run do subagent (auditoria) |
| `timeline.cta` | ver run |

> **Fonte ChatHistory:** o switch de status **não** tem case `'timeout'`; run timeout cai no default `trabalhando…`. O id `timeline.status.timeout` = `timeout` é o contrato Engrena F07/F15 a implementar (não inventar string nova na fonte).

### Audit modal

| Slot | Texto |
|------|-------|
| `audit.aria` | Run do subagent {name} |
| `audit.close` | Fechar |
| `audit.empty.waiting` | Aguardando a primeira resposta do subagent… |
| `audit.empty.done` | Run sem saída. |
| `audit.section.activity` | Atividade · {N} ações |
| `audit.activity.omitted` | {N} anteriores omitidas |
| `audit.section.fullResponse` | Resposta completa |
| `audit.action.ariaRunning` | Ação em andamento |

### Action verbs (audit chronology)

| Slot | Texto |
|------|-------|
| `audit.action.read.started` / `.done` | Lendo / Leu |
| `audit.action.write.started` / `.done` | Criando / Criou |
| `audit.action.edit.started` / `.done` | Editando / Editou |
| `audit.action.run.started` / `.done` | Rodando / Rodou |
| `audit.action.search.started` / `.done` | Buscando / Buscou |
| `audit.action.other.started` / `.done` | Executando / Executou |
| `audit.action.error` | Falhou |
| `audit.action.interrupted` | Interrompido |
| `audit.action.duration.subsecond` | \<1s |

### Related `#subagents` (idle field — não reimplementar form)

| Slot | Texto |
|------|-------|
| `form.label.idleTimeout` | Timeout de inatividade (min) |
| `form.placeholder.idleTimeout` | 20 (default) |
| `form.hint.idleTimeout` | Silêncio total do subagent por esse período interrompe o run com status timeout e devolve o parcial ao orquestrador. Vazio = 20min. |

### Visível na fonte / deferred (fora F15)

| Slot | Texto (fonte) | Nota |
|------|---------------|------|
| `isolation.worktree` | worktree | badge modal; title explicativo na fonte |
| `isolation.live-write` | live-write | |
| `isolation.shared-read` | shared-read | |
| `isolation.liveWrite.note` | edição direta no projeto (live-write) | |
| `apply.applied` | aplicado | |
| `apply.no-changes` | sem mudanças | |
| `apply.conflict` | conflito | |
| `apply.stale-base` | base obsoleta | |
| `apply.timeout` | timeout | applyStatus ≠ run status |
| `apply.skipped-cancelled` | pulado (cancelamento) | |
| `apply.not-applied` | não aplicado | |
| `apply.error` | erro de integração | |
| `audit.patch.files` | Arquivos do patch ({N}) | |
| `audit.patch.empty` | Nenhum arquivo atribuído. | |
| `audit.patch.copy` | Copiar resgate | |
| `audit.patch.copied` | copiado! | |
| `activity.section.others` | Outros | sprint grouping / featbuild |

> Remover linhas de slot não usadas na implementação F15. Não parafrasear. Lacuna PRD abaixo **não** substitui silenciosamente a string da fonte.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `activity.details` | details/summary | — | `open` default; collapsible |
| `activity.runRow` | button | — | abre audit; title com provider/model |
| `activity.clock` | text (mono) | — | ativo: vivo desde `startedAtMs`; done: `durationMs` mm:ss; null se ausente |
| `activity.signal` | text | — | só `status===null` com heartbeat; âmbar se ≥ 2 min |
| `timeline.block` | button | — | correlaciona `parentToolCallId`; abre audit |
| `audit.close` | icon button | — | aria “Fechar”; Esc + backdrop |
| `audit.actions` | list | — | chronology texto↔ação; omitidas se `actionCount > actions.length` |
| `form.idleTimeoutMinutes` | number (related) | não | 1..480 ou vazio (=20); superfície F07 |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | thread sem runs | empties Ativos + Concluídos · 0 |
| `filling` | N/A (somente leitura) | N/A |
| `loading` | N/A (stream via WS) | texto/ações atualizam ao vivo no modal |
| `disabled` | N/A | N/A |
| `error` | `status === 'error'` \| `'cancelled'` | label “erro” / “cancelado”; tom vermelho |
| `runActive` | `status === null` + `startedAtMs` | pulso no summary; relógio vivo; sidebar omite texto “rodando…” na row (só pulso); timeline “trabalhando…” |
| `runCompleted` | `status === 'completed'` | “concluído” + clock estático se `durationMs` |
| `runTimeout` | `status === 'timeout'` | fonte: label **“timeout”** + tom error/red na activity; timeline fonte ainda não distingue |
| `signalFresh` | heartbeat \< 2 min | “sinal há {duration}” muted |
| `signalStale` | heartbeat ≥ 2 min | mesmo copy, `text-amber` |
| `auditOpen` | clique row/bloco | modal; Esc/backdrop fecha |
| `auditWaiting` | modal aberto, sem text/actions, running | italic waiting |
| `auditEmptyDone` | terminal sem text | “Run sem saída.” |

## Componentes sugeridos

Compor só com primitives compartilhados + componentes F07/F15 já previstos:

| Primitive | Uso nesta tela |
|-----------|----------------|
| `Card` / `details` | card Subagents na sidebar |
| `Badge` | status run; (deferred) isolation/apply |
| `Button` | RunRow, timeline block, Fechar, Copiar resgate (deferred) |
| `Modal` / `Dialog` | `SubagentRunAuditModal` |
| `EmptyState` | empties das seções |
| `ChatMarkdown` | trechos de texto no audit |
| `SubagentActivity` | card sidebar |
| `SubagentTimelineBlock` | bloco aninhado |
| `SubagentRunAuditModal` | auditoria |

## Aceite visual

- [ ] Bate com a referência visual em dark (e light se aplicável) quando PNG existir
- [ ] Anatomia card → seções Ativos/Concluídos → rows → modal; timeline com pill Subagent + “ver run”
- [ ] Tabela de copy 100% aplicada (status, empties, audit, sinal) — **fonte `timeout`**, não inventar “Timeout (idle)” sem fechar a lacuna
- [ ] Nenhum tamanho de fonte arbitrário fora da type scale do Design System destino (px observados na fonte = referência, não contrato)
- [ ] CTA/rows usam primitives / componentes listados, não class soup local desnecessária
- [ ] Estados `runActive`, `runTimeout`, `error` e `auditOpen` verificáveis
- [ ] Tema `light` \| `dark` \| `system` via tokens (substituir hex `#4c8ef0` por accent)
- [ ] Isolation / apply / patch / sprint **não** bloqueiam aceite F15 (deferred)
- [ ] CRUD `#subagents` **não** faz parte deste aceite (F07)

## Perguntas em aberto

- Card `SubagentActivity` no `#principal` ainda não montado; PNG atual = modal `#subagents` (idle timeout). Recapturar activity quando F15 UI runtime existir.
- **Lacuna PRD vs fonte — badge timeout:** PRD F15 exige badge âmbar **“Timeout (idle)”** visível sem refresh. Fonte (e baseline F07 `subagentsRun.*.status.timeout`) usa literal **`timeout`** (+ indicador separado **`sinal há {duration}`** enquanto running). **Não** substituir silenciosamente: decidir override de destino (atualizar id F07 ou novo id F15) vs manter fonte.
- Tom do timeout: fonte = `text-red` (tone error); PRD = âmbar. Confirmar token Design Lock.
- Timeline fonte: alinhar case `'timeout'` (hoje cai em `trabalhando…`); Engrena id já prevê `timeout`.
- Prefixo de ref de resgate na fonte usa path de marca legado em git refs — deferred com write-parallel; se algum dia exposto, rename de marca no destino.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F15-runtime-de-subagents/spec.md` | Contratos técnicos (idle, history, WS, usage) |
| `docs/F15-runtime-de-subagents/plan.md` | Ordem de implementação |
| `docs/F15-runtime-de-subagents/copy.md` | Catálogo de microcopy deste runtime |
| `docs/F07-subagents/ui.md` / `copy.md` | Baseline `subagentsRun.*` + form idle |
| `docs/F03-workspace/` | Host `#principal`, ChatHistory, Diff unificado |
| `docs/design-system/` | Tokens e padrões de superfície |
