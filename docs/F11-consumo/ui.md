# Spec de UI: #consumo (Consumo)

**Feature:** F11-consumo  
**Destino:** EngrenaCode  
**Fonte de referência:** sistema legado (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/ConsumoScreen.tsx`  
**Componente destino (previsto):** `packages/renderer/src/screens/ConsumoScreen.tsx`  
**Última atualização:** 2026-08-05

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F11-consumo/ui/consumo-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `TODO` (mesmo frame dark quando houver mock) |

> PNG ainda não versionado: anexar em `docs/F11-consumo/ui/` e atualizar este caminho. Frame sugerido: `#consumo` dark, período “30 dias”, ≥1 projeto com barra, seção Preços com banner “Modelos observados sem preço” e ≥1 card de billing com `~` ou `⚠ parcial`.

## Escopo

**Inclui:**

1. Tela global `#consumo` (versão 1.1): tokens + custo estimado local.
2. Seletor de período: 7 dias / 30 dias / Tudo (default `30d`).
3. Resumo: 3 cards por `billingMode` + tokens in/out + threads + cache read %.
4. Drill-down: projeto → thread (share subagents + flags) → evento (página 100; API `limit` 1–500).
5. Seção Preços: lista editável USD/MTok; banner de modelos sem preço; cadastro rápido.
6. Flags de custo: parcial (`⚠`) e aproximado (`~`); `—` quando custo indisponível.
7. Empty states honestos; erro de load com mensagem + “Tentar novamente”.
8. Copy literal (rename de marca), estados, tokens/padrões de superfície F01.1, aceite visual.

**Consome (produto, não layout):**

- F01.1: tokens e padrões de superfície (`bg-bg`, `bg-surface`, `border-border`, `text-fg` / `text-muted`, `accent`, `amber`, `red`).
- F03: `usage_events` de turnos do agente (`project`, `thread`, `turnId`, tokens, `billingMode`).
- F07: `usage_events` `source=subagent` com nome e custo separado no share.

**Exclui:** contratos HTTP/SQLite/`recalculateNullCosts`/congelamento `cost_source` (ficam no `spec.md`); fatura real; budget alerts; export; repricing de eventos já precificados (`sdk` ou `cost_usd` não-null); implementação de primitives.

### Observado na fonte × destino Central F11

| Capacidade PRD / brief | UI fonte |
|------------------------|----------|
| Períodos 7d / 30d / Tudo | chips `PERIODS`; default `30d` — sim |
| Cards billing: assinatura / API key / token plan | labels literais abaixo — sim |
| Totais input/output/cache/custo | cards: in/out + cache read % + custo por billing; **sem** card dedicado de cache write nem total tokens no resumo (tokens totais nas tabelas) |
| Flags `⚠` parcial e `~` aproximado | `CostValue` + `SplitFlags` — sim |
| Drill-down projeto → thread → evento | seleção em tabela; limpa thread ao trocar projeto — sim |
| Paginação eventos 100; limit máx. 500 | UI `limit=100`; API valida 1–500 — sim |
| Banner “Modelos observados sem preço” | `PricingSection` + botões `+ provider / model` — sim |
| Preços USD/MTok editáveis | form Entrada/Saída/Cache read/write + Aproximado + Fonte — sim |
| Erro → “Não foi possível carregar os dados.” + retry | fallback genérico + CTA; se `Error.message` existir, **mostra a mensagem da API** (ver gap) |
| Sem fatura / budget / export / repricing | sem CTAs — alinhado |
| Empty honestos | projetos / threads / eventos / preços — sim |

## Anatomia (topo → base)

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. **Cabeçalho:** `h1` “Consumo” + subtítulo; à direita, group de período (`role="group"` `aria-label="Período do consumo"`): 7 dias | 30 dias | Tudo.
2. **Slot de erro/load do resumo** (condicional): `ErrorState` **ou** “Carregando consumo…” **ou** conteúdo 3–6.
3. **Resumo** (`aria-label="Resumo de consumo"`): grid de `MetricCard`s — 3 billing + Tokens in/out + Threads + Cache read.
4. **Seção Projetos:** `h2` “Projetos” + tabela (ou empty).
5. **Seção Threads** (condicional: projeto selecionado): `h2` “Threads · {projectName}” + load/erro/tabela.
6. **Seção Eventos** (condicional: thread selecionada): `h2` “Eventos · {threadTitle|threadId}” + load/erro/tabela + paginação.
7. **Seção Preços** (sempre, abaixo de `border-t`): `h2` “Preços” + hint; banner unpriced **ou** “Todos os modelos…”; form create/edit (condicional); lista de preços **ou** empty.

**Alinhamento do card / painel:** coluna centrada no shell; conteúdo alinhado à esquerda; empties/loading centralizados no slot  
**Largura máx.:** `max-w-[1240px]`

### Drill-down (comportamento visual)

1. Clique no nome do projeto → seleciona row (`bg-accent/5`); limpa thread selecionada; abre seção Threads.
2. Clique na thread → seleciona; abre seção Eventos (primeira página `limit=100`, `offset=0`).
3. Troca de período ou retry (`refresh`) repropaga `from`/`to` em summary, projects, detail e events.
4. Enquanto detail/events carregam: limpa dados anteriores do nível; mostra “Carregando threads…” / “Carregando eventos…”.

### Formatação de custo (`CostValue`)

| Caso | Render | Tooltip / title |
|------|--------|-----------------|
| `costUsd == null` | `—` + opcional ` ⚠ parcial` | “Custo indisponível: não há preço para os eventos deste recorte.” |
| valor com `approximate` | `~$X.XXXX` | — |
| valor com `partial` | `$X.XXXX ⚠ parcial` | “Soma parcial: há eventos sem preço.” |
| valor completo | `$X.XXXX` (`toFixed(4)`) | — |

Share subagents incompleto: texto `— / custo parcial` (não inventa %). Flags por split sob a célula: `~ agente` · `~ subagent` · `⚠ agente parcial` · `⚠ subagent parcial`.

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `mx-auto w-full max-w-[1240px] px-lg py-lg` sobre `bg-bg text-fg` | shell pinta `bg-bg` |
| Título | `text-[26px] font-bold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13px] text-muted` | |
| Period group | `flex rounded-md border border-border bg-surface p-xs` | |
| Period ativo | `rounded-sm bg-accent text-white` | `aria-pressed` |
| Period inativo | `text-muted hover:text-fg` | |
| MetricCard | `rounded-md border border-border bg-surface px-md py-md` | |
| MetricCard label | `text-[11px] font-semibold uppercase tracking-[0.06em] text-muted` | |
| MetricCard valor | `mt-sm text-[20px] font-semibold tracking-tight text-fg` | custo/tokens em `font-mono` |
| Section `h2` | `text-[16px] font-semibold` (Projetos/Threads/Eventos); Preços `text-[18px]` | |
| Tabela wrapper | `overflow-x-auto rounded-md border border-border` | |
| `th` | `border-b border-border bg-surface-2 … text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted` | |
| Row hover / selected | `hover:bg-surface-2/60` / `bg-accent/5` | |
| Chip (provider/model/origem/billing/costSource) | `rounded-[20px] border border-border bg-surface-2 … font-mono text-[10.5px] text-fg/75` | |
| Barra projeto | track `bg-surface-2`; fill `fill-accent` | escala relativa a `max(totalTokens)` |
| Banner unpriced | `rounded-md border border-amber/30 bg-amber/5 p-md` | |
| CTA unpriced | `border-amber/40 text-amber hover:bg-amber/10` | `+ {provider} / {model}` |
| Pricing form | `rounded-md border border-accent/30 bg-accent/5 p-md` | |
| Provider badge | `rounded-md bg-accent … font-mono font-semibold text-white` | pedido legado 2026-07-14 |
| Input preço | `h-[34px] rounded-sm border border-border bg-bg … font-mono focus:border-accent` | |
| CTA Salvar preço | `bg-accent text-white` | loading: “Salvando…” + disabled |
| CTA secundário | `border border-border` (Cancelar, Editar, Carregar mais) | |
| Flag split / ~aprox. | `text-amber` | |
| Loading | `py-xl text-center text-[13px] text-muted` | |
| Erro | `rounded-md border border-red/30 bg-red/5 … text-red` + `role="alert"` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` (destino); fonte usa `focus:border-accent` nos inputs | |
| Seção Preços | `mt-xl border-t border-border pt-lg` | separador visual |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca em copy de UI | (nenhuma string legado na tela) | EngrenaCode se surgir empty/network com marca |
| Largura | `max-w-[1240px]` | manter (mais larga que Registros 1080) |
| Period default | `30d` | manter |
| Paginação eventos | “Carregar mais eventos”; meta “{n} de {total} eventos carregados” | manter |
| CTA loading período | “Carregando…” (ellipsis tipográfica `…`) | manter |
| Erro genérico PRD | “Não foi possível carregar os dados.” | destino: preferir genérico PRD no corpo; API message opcional em detalhe |
| Limit API | 1–500 | UI sempre pede 100/página |
| Badge provider em preço | `text-white` sobre `bg-accent` | F01 login usa `text-bg` no CTA; aqui manter fonte (badge, não ButtonPrimary) |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `legado → EngrenaCode`. Células = texto final no destino.

| Slot | Texto |
|------|-------|
| `title` | Consumo |
| `subtitle` | Tokens, custos equivalentes e preços por projeto, thread e subagent. |
| `period.aria` | Período do consumo |
| `period.7d` | 7 dias |
| `period.30d` | 30 dias |
| `period.all` | Tudo |
| `summary.aria` | Resumo de consumo |
| `card.subscription` | Assinatura (estimado) |
| `card.apiKey` | API key (equivalente) |
| `card.tokenPlan` | Token plan (equivalente API) |
| `card.tokensInOut` | Tokens in / out |
| `card.threads` | Threads |
| `card.threads.sr` | ativas / total |
| `card.cacheRead` | Cache read |
| `section.projects` | Projetos |
| `section.threads` | Threads · {projectName} |
| `section.events` | Eventos · {threadTitle\|threadId} |
| `section.pricing` | Preços |
| `section.pricing.hint` | Valores por milhão de tokens. Alterações recalculam somente eventos elegíveis sem custo. |
| `col.projeto` | Projeto |
| `col.custo` | Custo |
| `col.tokens` | Tokens |
| `col.threads` | Threads |
| `col.cacheRead` | Cache read |
| `col.ultimoEvento` | Último evento |
| `col.thread` | Thread |
| `col.providersModels` | Providers / modelos |
| `col.shareSubagents` | Share subagents |
| `col.quando` | Quando |
| `col.turno` | Turno |
| `col.origem` | Origem |
| `col.providerModel` | Provider / modelo |
| `col.billing` | Billing |
| `col.cache` | Cache |
| `col.fonteCusto` | Fonte custo |
| `origem.agent` | agente |
| `origem.subagent.fallback` | subagent |
| `share.partial` | — / custo parcial |
| `share.title` | Agente: {agentTokens} tokens; subagents: {subagentTokens} tokens. |
| `flag.approxAgent` | ~ agente |
| `flag.approxSubagent` | ~ subagent |
| `flag.partialAgent` | ⚠ agente parcial |
| `flag.partialSubagent` | ⚠ subagent parcial |
| `cost.partialSuffix` | ⚠ parcial |
| `cost.unavailableTitle` | Custo indisponível: não há preço para os eventos deste recorte. |
| `cost.partialTitle` | Soma parcial: há eventos sem preço. |
| `events.meta` | {loaded} de {total} eventos carregados |
| `cta.loadMoreEvents` | Carregar mais eventos |
| `cta.loadingMore` | Carregando… |
| `cta.retry` | Tentar novamente |
| `cta.edit` | Editar |
| `cta.cancel` | Cancelar |
| `cta.savePrice` | Salvar preço |
| `cta.saving` | Salvando… |
| `loading.summary` | Carregando consumo… |
| `loading.threads` | Carregando threads… |
| `loading.events` | Carregando eventos… |
| `loading.pricing` | Carregando preços… |
| `empty.projects` | Nenhum projeto encontrado. |
| `empty.threads` | Nenhuma thread com consumo neste período. |
| `empty.events` | Nenhum evento de consumo nesta thread. |
| `empty.pricing` | Nenhum preço configurado. |
| `banner.unpriced` | Modelos observados sem preço |
| `banner.unpriced.cta` | + {provider} / {model} |
| `banner.allPriced` | Todos os modelos observados possuem preço. |
| `pricing.badge.approx` | ~aprox. |
| `pricing.row.rates` | in ${input} · out ${output} |
| `label.inputPerMTok` | Entrada / MTok |
| `label.outputPerMTok` | Saída / MTok |
| `label.cacheReadPerMTok` | Cache read / MTok |
| `label.cacheWritePerMTok` | Cache write / MTok |
| `label.source` | Fonte |
| `label.approximate` | Aproximado |
| `error.generic` | Não foi possível carregar os dados. |
| `error.pricing.requiredIO` | Preencha os preços de entrada e saída. |
| `error.pricing.nonNegative` | Os preços devem ser números maiores ou iguais a zero. |

> **`error.generic`:** PRD exige esta frase + botão retry. Fonte: se a API lança `Error`, o corpo mostra `error.message`; só o fallback usa o genérico. Aceite Central: substring PRD no corpo (ou igual) + `cta.retry` visível.  
> Sem paráfrase. Placeholders `{…}` são dinâmicos.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `period` | chip group | — | `7d` \| `30d` \| `all`; `all` → query sem `from`/`to`; demais → janela UTC ISO |
| `summaryCards` | display | — | 6 cards; custo via `CostValue` por billing mode |
| `projectsTable` | table + row button | — | select projeto; barra proporcional a `totalTokens` |
| `threadsTable` | table + row button | — | select thread; chips provider/model; share + flags |
| `eventsTable` | table read-only | — | colunas quando/turno/origem/provider·modelo/billing/tokens/cache/fonte/custo |
| `loadMoreEvents` | button | — | se `page.hasMore`; disabled + “Carregando…” em `loadingMore` |
| `pricingList` | list + Editar | — | abre `PricingForm` inline |
| `unpricedCta` | button | — | abre create form para `provider`/`model` observados |
| `pricing.input` | number (decimal) | sim | `inputPerMTok` ≥ 0 |
| `pricing.output` | number (decimal) | sim | `outputPerMTok` ≥ 0 |
| `pricing.cacheRead` | number (decimal) | não | vazio → null |
| `pricing.cacheWrite` | number (decimal) | não | vazio → null |
| `pricing.source` | text | não | trim; vazio → null |
| `pricing.approximate` | checkbox | — | marca `~aprox.` na row |
| `savePrice` / `cancel` | button | — | save chama create/update; sucesso fecha form + refresh |
| `retry` | button | — | `ErrorState` de summary / project / thread / pricing |

Sem export. Sem budget. Sem fatura. Sem delete de preço nesta UI (não observado na fonte).

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount com dados; período `30d` | header + resumo + projetos + preços |
| `filling` | edição de campos no `PricingForm` | draft local; sem submit |
| `loading` | mount / troca de período / refresh | “Carregando consumo…” se sem summary |
| `loadingThreads` | select projeto | “Carregando threads…”; dados anteriores limpos |
| `loadingEvents` | select thread | “Carregando eventos…”; dados anteriores limpos |
| `loadingPricing` | mount / refresh preços | “Carregando preços…” se sem data |
| `loadingMore` | “Carregar mais eventos” | CTA “Carregando…”; rows existentes permanecem |
| `disabled` | `saving` no Salvar; `loadingMore` no load more | `disabled:opacity-50` |
| `error` | falha summary/projects | `ErrorState` no topo; seções de drill ocultas |
| `errorProject` | falha detail | `ErrorState` na seção Threads |
| `errorThread` | falha events | `ErrorState` na seção Eventos |
| `errorPricing` | falha list/create/update | `ErrorState` ou alert inline; form preservado se create falhou |
| `errorLoadMore` | falha página seguinte | `role="alert"` sob a tabela; rows existentes ok |
| `empty` | projects = [] | `empty.projects` |
| `emptyThreads` | threads = [] no período | `empty.threads` |
| `emptyEvents` | events = [] | `empty.events` |
| `emptyPricing` | pricing = [] | `empty.pricing` (+ banner unpriced ou `banner.allPriced`) |
| `unpricedBanner` | `unpricedModels.length > 0` | banner âmbar + CTAs `+ provider / model` |
| `creatingPrice` / `editingPrice` | clique unpriced / Editar | `PricingForm` visível |
| `partialCost` | `pricingComplete=false` ou `costUsd=null` | `—` e/ou `⚠ parcial` |
| `approximateCost` | `hasApproximatePricing` / `costApproximate` / checkbox | prefixo `~` / badge `~aprox.` / flags split |
| `hasMoreEvents` | `page.hasMore` | CTA load more + meta loaded/total |
| `vaultLocked` | 423 / sessão travada | tipicamente redirect login; se request falhar na tela: `error` |

## Componentes sugeridos

Compor a tela só com primitives compartilhados (não reinventar strings de classe):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `AppShell` | chrome + nav “Consumo” |
| `MetricCard` | cards do resumo (pode permanecer local se não houver primitive) |
| `Table` / thead tokens | projetos, threads, eventos |
| `Chip` / `Badge` | provider, model, origem, billing, costSource |
| `Button` (primary) | Salvar preço (`bg-accent`) |
| `Button` (secondary) | período inativo, Cancelar, Editar, Carregar mais, retry |
| `Field` + `Input` | form de preços (4 rates + fonte) |
| `Checkbox` | Aproximado |
| `Alert` | `ErrorState`; banner unpriced (tom amber) |
| `Card` | MetricCard / pricing row bordered — não card grid de marketing |

## Aceite visual

- [ ] Bate com a referência visual em dark (quando o PNG existir)
- [ ] Anatomia na ordem documentada; sem H1/marca extra; sem CTAs de fatura/budget/export
- [ ] Tabela de copy 100% aplicada (período, cards, colunas, empties, banner, form, erros, CTAs)
- [ ] Nenhum tamanho de fonte arbitrário fora do registrado / type scale destino
- [ ] Superfícies via tokens (`border-border`, `bg-surface`, `bg-surface-2`, `accent`, `amber`, `red`)
- [ ] Estados `loading`, `error`, `empty*`, `partialCost`, `approximateCost`, `unpricedBanner`, `loadingMore` verificáveis
- [ ] Tema `light` \| `dark` \| `system` via tokens (sem hex solto)
- [ ] Drill-down projeto → thread → evento; share só com splits completos; flags parciais/aproximados
- [ ] Eventos em páginas de 100; “Carregar mais eventos” só com `hasMore`
- [ ] Banner “Modelos observados sem preço” com cadastro rápido; save não reescreve visualmente eventos já precificados (comportamento de dados no `spec.md`)

## Perguntas em aberto

- Screenshot canônico dark: anexar em `docs/F11-consumo/ui/consumo-referencia.png`?
- Resumo PRD pede cache write e total tokens explícitos; fonte mostra só cache read % + in/out. Manter fonte ou acrescentar cards?
- `error.generic`: forçar sempre “Não foi possível carregar os dados.” (PRD) e relegar `Error.message` a log/tooltip, ou manter corpo = mensagem da API como na fonte?
- Badge provider `text-white` vs padrão F01 `text-bg` no accent: unificar no Design System?
- Delete/desativar preço: fora do escopo 1.1 ou gap a fechar depois?
- Nav shell: label “Consumo” já no AppShell destino — confirmar ícone/ordem na onda 1.1.

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F11-consumo/spec.md` | Contratos técnicos (API metrics/pricing, `cost_source`, `recalculateNullCosts`) |
| `docs/F11-consumo/plan.md` | Ordem de implementação |
| `docs/F11-consumo/copy.md` | Catálogo de microcopy (`consumo.*`) |
| `docs/design-system/` / F01.1 | Tokens e padrões de superfície |
| `docs/F03-workspace/ui.md` | Origem dos usage_events de agente |
| `docs/F07-subagents/ui.md` | Origem `source=subagent` |
| `docs/prd-engrenacode.md` § F11 | Capacidades e critérios de aceite de produto |
