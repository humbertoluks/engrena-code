# Spec de UI: #dashboard (Dashboard)

**Feature:** F04-dashboard  
**Destino:** EngrenaCode  
**Fonte de referência:** EngrenaCode (`src/renderer`) — tela já shipada  
**Componente fonte:** `src/renderer/screens/DashboardScreen.tsx`  
**Componente destino (previsto):** `src/renderer/screens/DashboardScreen.tsx` (as-built)  
**Última atualização:** 2026-08-08

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F04-dashboard/ui/dashboard-referencia.png` (alias do dark) |
| Light (opcional) | `docs/F04-dashboard/ui/dashboard-referencia-light.png` |
| Dark (opcional) | `docs/F04-dashboard/ui/dashboard-referencia-dark.png` |

> Capturas 2026-08-08 via `playwright-cli` + `pnpm dev` (`ENGRENACODE_USER_DATA` isolado). Estado: banner `setupIncomplete` + inbox com os 4 kinds (`setup incompleto`, `erro`, `diff pendente`, `running`) no projeto seed `demo-app`; métricas Projetos=1 / Running=1 / Diffs pendentes=1 / Erros=1; catálogo com seeds F17. Nota: boot recovery (`recoverRunningThreads`) promove `running`→`error` na subida do unlock server — o seed de `running` foi reaplicado após o boot, antes do refresh/screenshot.

## Escopo

**Inclui:** layout da tela `#dashboard`, anatomia das regiões (header, banner, saúde, métricas, inbox, projetos, catálogo, recente), copy literal EngrenaCode, estados de UI, mapeamento de tokens/padrões de superfície, critérios de aceite visual.

**Exclui:** contratos de API/agregação/deep-link (ficam no `spec.md`); implementação de primitives; mutações de turno/diff/git (fora do produto nesta tela).

## Anatomia (topo → base)

Ordem obrigatória de renderização no viewport principal (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “Dashboard” + CTA secundário “Atualizar” (direita).
2. Slot de erro inline (condicional, refresh falhou com dados já carregados).
3. Banner âmbar “Configuração incompleta…” + CTA primário “Completar configuração” (condicional `health.setupIncomplete`).
4. Painel clicável **Saúde da configuração**: título + strip de 4 dots (Claude, CLIs, GitHub, prompt) → `#configuracao`.
5. Grade de 4 **MetricCard**: Projetos, Running, Diffs pendentes, Erros (display-only).
6. Seção **Precisa da sua atenção** (`h2`): lista de inbox (badges + linhas) ou empty “Nada pendente…”.
7. Seção **Projetos** (`h2`): grade de cards (nome + path) ou empty “Adicione um projeto…” + “Adicionar projeto”.
8. Seção **Catálogo** (`h2`): 3 cards de contagem (Skills / Rules / SubAgents) → `#skills` / `#rules` / `#subagents`.
9. Seção **Atividade recente** (`h2`): lista de threads ou empty (reusa copy da inbox vazia).

**Alinhamento do card / painel:** coluna única centrada no conteúdo do shell (`mx-auto`); seções full-width da coluna; conteúdo alinhado à esquerda (empty de projetos centralizado)  
**Largura máx.:** `max-w-[1240px]` (~1240px)

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `mx-auto w-full max-w-[1240px] px-lg py-lg` sobre `bg-bg text-fg` do shell | sem `min-h-screen` próprio |
| Cabeçalho | `flex items-center justify-between` | h1 + `ButtonSecondary` |
| Título página | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Banner setup | `rounded-md border border-amber/30 bg-amber/5 p-md` + `flex … justify-between gap-md` | corpo `text-[13px] text-fg` |
| Painel saúde | `w-full rounded-lg border border-border bg-surface p-md text-left` | botão full-width |
| Título de seção / painel | `text-[15px] font-semibold text-fg` (saúde); `h2` `text-[16px] font-semibold text-fg` (demais) | |
| Strip de saúde | `flex flex-wrap gap-lg` + labels `text-[12.5px] text-muted` + `StatusDot` | |
| Metric cards | grid `grid-cols-2 gap-md lg:grid-cols-4` + `MetricCard` | label uppercase muted; valor `text-[20px]` |
| Lista inbox / recent | `overflow-hidden rounded-lg border border-border bg-surface` | rows `border-b border-border/60 px-md py-sm` |
| Badge inbox | `rounded-sm border px-sm py-[2px] font-mono text-[10.5px]` | accent / amber / red por kind |
| Row hover / focus | `hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent` | |
| Empty texto | `text-[13px] text-muted` | |
| Empty projetos | `rounded-lg border border-border bg-surface p-lg text-center` | |
| Grade projetos | `grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3` | card `rounded-lg border … p-md` |
| Catálogo | `grid grid-cols-3 gap-md` | contagem `text-[20px] font-semibold`; label `text-[11.5px] text-muted` |
| Erro full-page / inline | `rounded-md border border-red/30 bg-red/5 p-md` + `InlineFeedback` | |
| Stack vertical | `mt-md` entre blocos; skeleton `space-y-md` | |
| CTA primário | `ButtonPrimary` | banner setup |
| CTA secundário | `ButtonSecondary` | Atualizar, Retry, Adicionar projeto |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | rows e cards |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Type sizes | `26px` / `20px` / `16px` / `15px` / `14px` / `13px` / `12.5px` / `11.5px` / `11px` / `10.5px` | papel display/title/body/caption até type-scale; **token-gap** |
| Badge padding | `py-[2px]` | token-gap (não há spacing token 2px) |
| MetricCard label | `uppercase tracking-[0.06em] text-[11px]` | padrão do primitive |
| Empty recent | reusa “Nada pendente…” | quirk as-built (sem string dedicada) |
| Marca | EngrenaCode em `error.network` | sem Lion* |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode` (fonte já EngrenaCode). Células = texto final. Catálogo completo com ids em `docs/F04-dashboard/copy.md`.

| Slot | Texto |
|------|-------|
| `title` | Dashboard |
| `cta.refresh` | Atualizar |
| `cta.completeSetup` | Completar configuração |
| `banner.setupIncomplete` | Configuração incompleta — conecte um provider e um token do GitHub para liberar todos os recursos. |
| `section.health` | Saúde da configuração |
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
| `cta.addProject` | Adicionar projeto |
| `section.projects` | Projetos |
| `section.catalog` | Catálogo |
| `catalog.skills` | Skills |
| `catalog.rules` | Rules |
| `catalog.subagents` | SubAgents |
| `section.recent` | Atividade recente |
| `kind.running` | running |
| `kind.pendingDiff` | diff pendente |
| `kind.error` | erro |
| `kind.setupIncomplete` | setup incompleto |
| `error.generic` | Não foi possível carregar o dashboard. |
| `error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `cta.retry` | Tentar novamente |
| `subtitle` | N/A (sem subtítulo sob o h1) |
| `cta.refresh.loading` | N/A (spinner + texto “Atualizar”; sem string “Atualizando…”) |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| refresh | button secondary | — | `loading` enquanto refresh; dispara `GET /api/dashboard` |
| completeSetup | button primary | — | visível só com `setupIncomplete`; → `#configuracao` |
| healthPanel | button (painel) | — | → `#configuracao` |
| metricCards | display | — | não clicáveis |
| inboxRow | button row | — | `setupIncomplete` → `#configuracao`; `pendingDiff` → workspace `tab=diff`; demais → `tab=history` |
| projectCard | button card | — | → `#principal?project=` |
| addProject | button secondary | — | empty only; → `#principal` |
| catalogCard | button card | — | → `#skills` / `#rules` / `#subagents` |
| recentRow | button row | — | → workspace `tab=history` |
| retry | button secondary | — | error full-page only |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | load 200 com dados | anatomia completa; banner só se `setupIncomplete` |
| `loading` | primeiro fetch | `DashboardSkeleton` (header + 4 cards + 2 blocos) dentro do `main` |
| `refreshing` | Atualizar / poll 30s | CTA “Atualizar” com `loading`; conteúdo anterior permanece |
| `error` (full) | falha no primeiro load (`data === null`) | alert vermelho + mensagem + “Tentar novamente” |
| `error` (inline) | falha em refresh com `data` já presente | alert no topo sob o header; resto da tela permanece |
| `empty.inbox` | `inbox.length === 0` | texto muted “Nada pendente…” |
| `empty.projects` | `projects.length === 0` | empty + “Adicionar projeto” |
| `empty.recent` | `recent.length === 0` | reusa “Nada pendente…” |
| `setupIncomplete` | `health.setupIncomplete` | banner + item sintético na inbox (quando presente na resposta) |
| `disabled` | N/A | sem disabled de formulário; métricas não são controles |
| `filling` | N/A | tela read-only |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `StatusDot` | strip de saúde (ok/warn/off) |
| `MetricCard` | 4 cards numéricos |
| `Skeleton` | estado `loading` |
| `ButtonPrimary` | Completar configuração |
| `ButtonSecondary` | Atualizar, Retry, Adicionar projeto |
| `InlineFeedback` | erros generic/network |

## Aceite visual

- [x] Bate com a referência visual em dark e light (`docs/F04-dashboard/ui/dashboard-referencia-{dark,light}.png`)
- [x] Anatomia na ordem documentada; h1 “Dashboard” sem subtítulo; sem H1 de marca extra
- [x] Tabela de copy 100% aplicada (ver `copy.md`)
- [x] Type sizes arbitrários (`text-[Npx]`) documentados como token-gap até type-scale
- [x] CTAs e feedback usam primitives listados; metric/inbox/catalog usam superfícies Design Lock
- [x] Estados `loading`, `refreshing`, `error` (full + inline), empties e `setupIncomplete` verificáveis (smoke original F04, ver linha F04 em `docs/PROGRESS.md`)
- [x] Tema `light` \| `dark` \| `system` via tokens (sem hex solto na tela)
- [x] Metric cards não são clicáveis; inbox/catálogo/projetos navegam como documentado

## Perguntas em aberto

- Empty de atividade recente reusa `dashboard.empty.inbox` (“Nada pendente…”) — manter ou criar `dashboard.empty.recent`?
- Papéis tipográficos oficiais (substituir `text-[26px]` etc.) quando a type-scale do Design Lock fechar.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F04-dashboard/spec.md` | Contratos técnicos (API, inbox, deep-link) |
| `docs/F04-dashboard/plan.md` | Ordem / retrospectivo de implementação |
| `docs/F04-dashboard/copy.md` | Catálogo de microcopy por id |
| `docs/design-system/` | Tokens e padrões de superfície |
