# Spec de UI: #dashboard (Dashboard)

**Feature:** F04-dashboard  
**Destino:** EngrenaCode  
**Fonte de referência:** PRD EngrenaCode + entrevista (Rodada 7); padrões de superfície em LionCodeLabs (`packages/renderer`) — **não há** `DashboardScreen` no legado  
**Componente fonte:** N/A (nav “Dashboard” no legado aponta para `#principal` / workspace)  
**Componente destino (previsto):** `packages/renderer/src/screens/DashboardScreen.tsx` (+ satélites de health / inbox / metric cards)  
**Última atualização:** 2026-08-05

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F04-dashboard/ui/dashboard-referencia.png` |
| Fonte HTML do mock | `docs/F04-dashboard/ui/dashboard-referencia.html` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `docs/F04-dashboard/ui/dashboard-referencia.png` (mesmo frame dark) |

> Mock dark canônico (2026-08-05): `#dashboard` com banner de setup, saúde (Claude/CLIs ok · GitHub/prompt âmbar), 4 metric cards, inbox com 4 kinds, grade de 3 projetos, resumo Skills/Rules/SubAgents e atividade recente. Fonte do frame: HTML estático alinhado a tokens SPEC 4.4 + anatomia deste SDD (não captura runtime). **Copy fechada = tabelas deste SDD / `copy.md`**; títulos com `data-copy="provisional"` no HTML não travam aceite até fechar os TODOs.

## Escopo

**Inclui:**

1. Primeira tela pós-unlock: rota `#dashboard`, **separada** do workspace (`#principal` / F03).
2. Widgets: saúde da config (Claude, CLIs, GitHub, prompt); 4 cards numéricos (projetos, running, diffs pendentes, erros); inbox ≤ 20 itens; grade de projetos; resumo de catálogo (skills / rules / subagents); últimas 10 threads (atividade recente).
3. Refresh ao abrir + botão **Atualizar**; refresh opcional a cada 30s enquanto a tela está visível.
4. Navegação/atalhos apenas (sem mutação de workspace): inbox → workspace com projeto/thread; diff pendente abre aba Diff; running abre Histórico; “Completar configuração” → `#configuracao`; contadores de catálogo → `#skills` / `#rules` / `#subagents`.
5. Empty: “Adicione um projeto…”, “Nada pendente…”, banner de setup incompleto.
6. Copy literal (rename de marca), estados, tokens/padrões de superfície F01.1, aceite visual.

**Consome (produto, não layout):**

- F01.1: tokens semânticos, tema e padrões de superfície para cards e inbox.
- F02: saúde da config (Claude, CLIs, GitHub, prompt).
- F03: projetos, threads running/error, diffs pendentes, atividade recente; deep-link de projeto/thread/aba.
- F05: contagem de skills globais e vínculos.
- F06: contagem de rules.
- F07: contagem de subagents.

**Exclui:** contratos HTTP/IPC/SQL (ficam no `spec.md`); disparar turno; accept/reject de diff; commit/push/PR; chat/composer/terminal; consumo (F11); registros (F08); MCPs (F09); pipeline/build/memory/codegraph; implementação de primitives.

### Observado na fonte × destino Central F04

| Capacidade PRD / brief | UI fonte (LionCode) |
|------------------------|---------------------|
| Rota `#dashboard` pós-unlock | **Gap:** `DEFAULT_PROTECTED_ROUTE = 'principal'`; `ROUTE_IDS` **não** inclui `dashboard`. Nav item label “Dashboard” navega para `#principal` |
| Tela operacional separada do workspace | **Gap:** não existe `DashboardScreen`; “Dashboard” = workspace |
| Saúde config + 4 cards + inbox ≤20 + grade + catálogo + últimas 10 | **Gap:** greenfield UI; reutilizar padrões `MetricCard` (Consumo), dots de status (Configuração), cards de superfície (Skills/Rules) |
| Refresh ao abrir + “Atualizar” + opcional 30s | Sem tela fonte; contrato PRD |
| Sem turno / accept diff / git | Alinhado ao princípio RN-07 / RF-08 |
| Empty / banner setup | Strings parciais no PRD; ver copy + TODOs |

**Delta de navegação (obrigatório no destino):**

| Origem no AppShell | Fonte | Destino Central |
|--------------------|-------|-----------------|
| Item “Dashboard” | `id: 'principal'` | `id: 'dashboard'` → `#dashboard` |
| Workspace | (mesmo `#principal`) | item/nav “Workspace” (ou equivalente) → `#principal` (F03) |
| Pós-unlock default | `#principal` | `#dashboard` |

## Anatomia (topo → base)

Ordem obrigatória no viewport (conteúdo dentro do `AppShell` ~40px):

1. **Cabeçalho:** `h1` “Dashboard” + subtítulo (`TODO`) + CTA secundário **Atualizar** (direita).
2. **Banner de setup incompleto** (condicional: saúde F02 incompleta): copy do banner (`TODO`) + CTA **Completar configuração** → `#configuracao`.
3. **Saúde da config:** strip/card com status de Claude, CLIs, GitHub, prompt (dots ok/âmbar/erro + labels); clique na strip ou CTA do banner navega a `#configuracao` (não muta config aqui).
4. **4 metric cards** (grid 2×2 → 4 cols em viewport largo): Projetos | Running | Diffs pendentes | Erros — valor numérico grande; cards **não** são botões de mutação (opcional: clique no card filtra/rola a inbox para o kind correspondente — `TODO` se desejado).
5. **Inbox** “Precisa da sua atenção”: lista ≤ 20 itens (kinds: running, diff pendente, erro, setup incompleto) **ou** empty “Nada pendente…”.
6. **Grade de projetos:** cards/tiles dos projetos cadastrados **ou** empty “Adicione um projeto…” (CTA de adicionar projeto pode abrir o fluxo F03 / modal Adicionar projeto — sem cadastrar projeto *dentro* do dashboard além do atalho de navegação).
7. **Resumo de catálogo:** três atalhos com contagem → `#skills`, `#rules`, `#subagents` (skills globais + vínculos; rules; subagents).
8. **Atividade recente:** últimas **10** threads (projeto, título/id, provider, estado) — clique abre workspace na thread (aba Histórico por default; se item tiver diff pendente, preferir Diff — alinhado à regra da inbox).

**Alinhamento do card / painel:** coluna centrada no shell; conteúdo alinhado à esquerda; empties/loading centralizados no slot  
**Largura máx.:** `max-w-[1240px]` (mesmo envelope de Consumo; dashboard denso)

### Inbox item (esquerda → direita)

1. Badge/kind (`running` | `diff pendente` | `erro` | `setup incompleto`).
2. Texto primário: projeto · thread (título ou id curto).
3. Meta secundária: provider / idade relativa (`TODO` formato exato).
4. Affordance de navegação (row clicável ou chevron); **sem** botões Accept/Reject/Enviar.

### Mapa de clique → workspace (F03)

| Kind / origem | Destino |
|---------------|---------|
| Inbox `diff pendente` | `#principal` com projeto + thread; aba **Diff** |
| Inbox `running` | `#principal` com projeto + thread; aba **Histórico** |
| Inbox `erro` | `#principal` com projeto + thread; aba **Histórico** (`TODO` confirmar se Diff quando houver pending junto) |
| Inbox `setup incompleto` | `#configuracao` (mesmo destino do CTA Completar configuração) |
| Card/tile de projeto | `#principal` com projeto selecionado (thread: última ou nenhuma — `TODO`) |
| Thread em atividade recente | `#principal` com projeto + thread; Diff se pending, senão Histórico |
| Contador Skills / Rules / SubAgents | `#skills` / `#rules` / `#subagents` |

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `mx-auto w-full max-w-[1240px] px-lg py-lg` sobre `bg-bg text-fg` | shell pinta `bg-bg` |
| Título | `text-[26px] font-bold tracking-tight text-fg` | alinhado Skills/Consumo; type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| CTA Atualizar | `rounded-md border border-border bg-surface-2 …` | secondary; loading: disabled + copy loading |
| Banner setup | `rounded-md border border-amber/30 bg-amber/5 p-md` | padrão âmbar F11 unpriced / F02 aviso |
| CTA Completar configuração | `bg-accent` ou link accent no banner | navega `#configuracao` |
| Saúde strip | `rounded-lg border border-border bg-surface p-md` + dots 9×9 | reutilizar semântica F02 (ok `text-green`, aviso `text-amber`, erro `text-red`) |
| Grid metric cards | `grid grid-cols-2 gap-md lg:grid-cols-4` | |
| MetricCard | `rounded-md border border-border bg-surface px-md py-md` | padrão Consumo |
| MetricCard label | `text-[11px] font-semibold uppercase tracking-[0.06em] text-muted` | |
| MetricCard valor | `mt-sm text-[20px] font-semibold tracking-tight text-fg` | mono opcional nos números |
| Seção `h2` | `text-[16px] font-semibold text-fg` | Inbox / Projetos / Catálogo / Atividade |
| Inbox panel | `rounded-lg border border-border bg-surface` | lista; max 20 rows |
| Inbox row | `border-b border-border/60 px-md py-sm hover:bg-surface-2/60` | `cursor-pointer`; focus ring |
| Badge running | `border-accent/40 bg-accent/10 text-accent-2` | |
| Badge diff pendente | `border-amber/40 bg-amber/10 text-amber` | alinhado badge Diff F03 |
| Badge erro | `border-red/40 bg-red/10 text-red` | |
| Badge setup | `border-amber/40 bg-amber/10 text-amber` | ou muted se preferir hierarquia abaixo de diff — `TODO` |
| Grade projetos | `grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3` | cards `rounded-lg border border-border bg-surface p-md` |
| Resumo catálogo | `grid grid-cols-3 gap-md` | cada célula = contagem + label + link |
| Lista atividade | `rounded-lg border border-border bg-surface` | 10 rows max |
| Empty | `text-[13px] text-muted` + ícone opcional | |
| Loading | skeleton pulse `bg-surface-2` **ou** “Carregando…” | |
| Erro | `rounded-md border border-red/30 bg-red/5 … text-red` + `role="alert"` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Label nav “Dashboard” | aponta `#principal` | aponta `#dashboard`; workspace ganha label próprio |
| Default pós-unlock | `#principal` | `#dashboard` |
| MetricCard classes | ConsumoScreen local | extrair primitive compartilhado ou duplicar classes travadas |
| Dots status provider | ConfiguracaoScreen (+ hex marca) | tokens `green`/`amber`/`red`; hex de marca = token-gap F02 |
| Marca em copy | LionCode (outras telas) | EngrenaCode |
| Polling 30s | N/A | só com rota `#dashboard` visível (pause ao navegar away) |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`. Células = texto final no destino.

Fontes de string: PRD F04 + entrevista Rodada 7 + labels de nav existentes. Ausências → `TODO` (não parafrasear).

| Slot | Texto |
|------|-------|
| `title` | Dashboard |
| `subtitle` | `TODO` — PRD não fecha subtítulo; sugerido só após copy review |
| `cta.refresh` | Atualizar |
| `cta.refresh.loading` | `TODO` (ex. padrão irmão: “Atualizando…” — não travar sem decisão) |
| `cta.completeSetup` | Completar configuração |
| `banner.setupIncomplete` | `TODO` — PRD exige banner; texto do corpo não especificado |
| `section.health` | `TODO` — PRD: “saúde da config”; título de seção não fechado |
| `health.claude` | Claude |
| `health.clis` | CLIs |
| `health.github` | GitHub |
| `health.prompt` | prompt |
| `card.projects` | Projetos |
| `card.running` | Running |
| `card.pendingDiffs` | Diffs pendentes |
| `card.errors` | Erros |
| `section.inbox` | Precisa da sua atenção |
| `empty.inbox` | Nada pendente… |
| `empty.projects` | Adicione um projeto… |
| `section.projects` | `TODO` — “grade de projetos” (entrevista); label de `h2` não fechado |
| `section.catalog` | `TODO` — “resumo leve do catálogo” |
| `catalog.skills` | Skills |
| `catalog.rules` | Rules |
| `catalog.subagents` | SubAgents |
| `section.recent` | `TODO` — “atividade recente” / “últimas 10 threads” |
| `kind.running` | running |
| `kind.pendingDiff` | diff pendente |
| `kind.error` | erro |
| `kind.setupIncomplete` | setup incompleto |
| `error.generic` | `TODO` |
| `error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `cta.retry` | Tentar novamente |

> Ellipsis tipográfica `…` (U+2026) nos empties do PRD — preservar, não trocar por `...`.  
> Labels de metric cards capitalizam a forma do PRD (`projetos` → `Projetos`); `Running` permanece EN (estado de thread no produto).

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `refresh` | button | — | dispara reload agregado; disabled em `loading`/`refreshing` |
| `completeSetup` | button / link | — | só se setup incompleto; navega `#configuracao` |
| `health.strip` | group / links | — | read-only status; clique → `#configuracao` |
| `metric.projects` | MetricCard | — | contagem F03; sem mutação |
| `metric.running` | MetricCard | — | threads `running` |
| `metric.pendingDiffs` | MetricCard | — | diffs `pending` |
| `metric.errors` | MetricCard | — | threads `error` |
| `inbox.list` | listbox / list | — | ≤ 20 itens; ordem `TODO` (sugerido: setup → erro → diff → running, ou por recência) |
| `inbox.item` | button / row | — | navega F03/F02 conforme mapa; sem Accept/Reject |
| `projects.grid` | grid | — | tiles clicáveis → workspace |
| `catalog.skills` | link | — | contagem + navega `#skills` |
| `catalog.rules` | link | — | contagem + navega `#rules` |
| `catalog.subagents` | link | — | contagem + navega `#subagents` |
| `recent.list` | list | — | máx. 10; clique → workspace |

Sem campos de formulário. Sem composer. Sem git. Sem accept/reject.

### Refresh

| Gatilho | Comportamento |
|---------|---------------|
| Mount / foco da rota `#dashboard` | refresh completo |
| Clique **Atualizar** | refresh completo |
| Intervalo 30s | só se documento/rota visível; pausa ao sair de `#dashboard` ou tab oculta |
| Falha parcial | `TODO` — mostrar erro global vs. erro por widget |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | load ok com dados | anatomia completa; inbox e/ou empties parciais conforme dados |
| `filling` | N/A (somente leitura) | N/A |
| `loading` | mount / primeiro fetch | skeletons nos widgets; CTA Atualizar disabled |
| `refreshing` | Atualizar ou poll 30s com dados já visíveis | manter conteúdo anterior; CTA “Atualizar” disabled (+ `cta.refresh.loading` quando fechado) |
| `disabled` | durante `loading`/`refreshing` no CTA refresh | botão Atualizar disabled |
| `error` | falha do fetch agregado | `error.generic`/`error.network` + **Tentar novamente**; widgets substituídos ou banner de erro no topo |
| `empty.inbox` | load ok, 0 itens de atenção | `empty.inbox` |
| `empty.projects` | load ok, 0 projetos | `empty.projects` na grade |
| `setupIncomplete` | saúde F02 incompleta | banner + kind opcional na inbox; CTA Completar configuração |
| `inboxCapped` | > 20 candidatos | mostra os 20 mais prioritários/recentes (`TODO` critério); sem “carregar mais” no MVP |
| `navigate` | clique inbox/projeto/thread/catálogo | troca rota; **não** muta thread/diff/git |
| `hidden` | usuário saiu de `#dashboard` | cancela/pausa poll 30s |

## Componentes sugeridos

Compor a tela só com primitives compartilhados (não reinventar strings de classe):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `AppShell` | chrome; nav item Dashboard → `#dashboard` |
| `Card` | saúde, inbox panel, projeto tile, catálogo |
| `MetricCard` | 4 cards numéricos (extrair de Consumo ou shared) |
| `Badge` | kinds da inbox + status health |
| `Button` | Atualizar (secondary); Completar configuração (primary/accent); Tentar novamente |
| `Link` / row button | inbox, projetos, atividade, catálogo |
| `Skeleton` | loading inicial |
| `Field` / `Input` | N/A |
| `TaskComposer` / `DiffViewer` / `GitActions` | **proibidos** nesta tela |

## Aceite visual

- [ ] Bate com a referência visual em dark (`dashboard-referencia.png`)
- [ ] Anatomia na ordem documentada; sem H1/marca extra; sem composer/diff/git
- [ ] Tabela de copy 100% aplicada nos slots fechados; TODOs não inventados em runtime
- [ ] Pós-unlock / nav Dashboard abrem `#dashboard`, não o workspace
- [ ] 4 metric cards + inbox ≤ 20 + grade + catálogo + ≤ 10 threads recentes
- [ ] Clique diff pendente → workspace aba Diff; running → Histórico; Completar configuração → `#configuracao`
- [ ] Nenhum Accept/Reject, envio de turno, commit, push ou PR a partir desta tela
- [ ] Refresh no open + botão Atualizar; poll 30s só com tela visível
- [ ] Empties “Adicione um projeto…” / “Nada pendente…”; banner setup incompleto quando aplicável
- [ ] Tokens F01.1 (`bg-bg`, `bg-surface`, `border-border`, `text-fg`/`text-muted`, `accent`, `amber`, `red`, `green`); sem hex solto salvo token-gap de marca F02
- [ ] Tema `light` \| `dark` \| `system` respeitado via tokens
- [ ] Estados `loading`, `refreshing`, `error`, empties e `setupIncomplete` verificáveis

## Perguntas em aberto

- Fechar copy dos slots `TODO`: `subtitle`, `banner.setupIncomplete`, títulos de seção (`health` / `projects` / `catalog` / `recent`), `cta.refresh.loading`, `error.generic`.
- Critério de ordenação e desempate da inbox (e o que cortar além do 20º).
- Clique nos metric cards: só display ou scroll/filtro da inbox?
- Empty de projetos: só texto ou CTA que abre `AddProjectModal` (F03) sem sair do shell?
- Formato de idade relativa e título truncado nos rows (inbox + atividade).
- Inbox `erro` com diff pending simultâneo: Histórico ou Diff?
- Tile de projeto sem thread recente: abre workspace só com projeto, ou cria/seleciona thread?
- Contagem de skills no resumo: só globais, ou “globais + vínculos” como duas metas?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F04-dashboard/spec.md` | Contratos técnicos (API agregada, IPC, erros de domínio) — quando existir |
| `docs/F04-dashboard/plan.md` | Ordem de implementação — quando existir |
| `docs/F04-dashboard/copy.md` | Catálogo de microcopy |
| `docs/design-system/` / `docs/F01.1-design-system/` | Tokens e padrões de superfície |
| `docs/F02-configuracao-mvp/ui.md` | Saúde config / Completar configuração |
| `docs/F03-workspace/ui.md` | Deep-link projeto/thread/abas Diff \| Histórico |
| `docs/F05-skills/ui.md` | Contagens consumidas no resumo |
| `docs/F06-rules/ui.md` | Contagens consumidas no resumo |
| `docs/F07-subagents/ui.md` | Contagens consumidas no resumo |
| `docs/prd-engrenacode.md` § F04 | Capacidades e aceite de produto |
| `_reversa_forward/001-mvp-nucleo-operacional/actions.md` T014 | Implementação prevista `Dashboard*` |
