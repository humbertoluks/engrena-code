# Spec de UI: #registros (Registros)

**Feature:** F08-registros  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer`)  
**Componente fonte:** `packages/renderer/src/screens/RegistrosScreen.tsx` + `packages/renderer/src/components/LogTable.tsx`  
**Componente destino (previsto):** `packages/renderer/src/screens/RegistrosScreen.tsx` + `packages/renderer/src/components/LogTable.tsx`  
**Última atualização:** 2026-08-05

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F08-registros/ui/registros-referencia.png` |
| Light (opcional) | `TODO` |
| Dark (opcional) | `docs/F08-registros/ui/registros-referencia.png` (mesmo frame dark) |

> Mock dark canônico (2026-08-05): `#registros` com filtro “Todos”, ≥3 kinds (`task` / `tool` / `git`), thread id como link, CTA “Carregar mais”. Fonte do frame: HTML estático alinhado a tokens SPEC 4.4 + anatomia do SDD (não captura runtime do Electron).

## Escopo

**Inclui:**

1. Tela global `#registros` somente leitura sobre `log_entries` (timestamp, tipo `task`|`tool`|`git`, evento, thread id).
2. Filterbar: Todos / Tasks / Tool calls / Git flow.
3. Paginação incremental 100/página (“Carregar mais”).
4. Empty distintos (banco vazio vs filtro sem match).
5. Clique no thread id → workspace com a thread (F03) — **obrigatório no destino**; ver gap vs fonte.
6. Copy literal (rename de marca), estados, tokens/padrões de superfície F01.1, aceite visual.

**Consome (produto, não layout):**

- F01.1: tokens e padrões de superfície.
- F03: eventos task (dispatch), tool e git (accept/reject, commit, push, PR) e ids de thread; navegação para a thread.

**Exclui:** contratos HTTP/SQLite/`api-logs-list` (ficam no `spec.md`); edit/delete individual de registro; export; purge automático; implementação de primitives. Cascade “apagar thread remove registros” é comportamento de dados (F03), sem CTA nesta tela.

### Observado na fonte × destino Central F08

| Capacidade PRD / brief | UI fonte |
|------------------------|----------|
| Somente leitura; colunas timestamp, tipo, evento, thread id | `LogTable` — sim |
| Filtro Todos / Tasks / Tool calls / Git flow | chips `FILTERS` — sim |
| Paginação 100/página | `PAGE_SIZE = 100` + “Carregar mais” — sim |
| Empty “Nenhum registro ainda” vs “Nenhum registro para este filtro” | Fonte tem frases longas; **destino = PRD curto** (decidido 2026-08-05) |
| Clique thread id → workspace | Fonte: thread id é `<span>` **não clicável** — **gap destino** |
| Sem edit/delete/export | Fonte: sem ações de mutação na tabela — alinhado |
| Falha de load → mensagem + “Tentar novamente” | Fonte concatena “Tente novamente.” no corpo; **destino = PRD** (corpo sem retry + CTA) |
| Cofre travado → lista vazia / 423 | Rota sob `vaultGuard`; UI trata como erro genérico/`ApiError.message` (sem copy dedicada) |

## Anatomia (topo → base)

Ordem obrigatória no viewport (conteúdo dentro do `AppShell`):

1. Cabeçalho: `h1` “Registros” + subtítulo (persistência local / kinds).
2. Filterbar (chips): Todos | Tasks | Tool calls | Git flow (`role="group"`).
3. Slot de erro de carga (condicional: substitui a tabela) **ou** tabela:
   1. Header: Quando | Tipo | Evento | Thread
   2. Body: skeleton (loading) **ou** empty state **ou** rows
4. CTA “Carregar mais” (condicional: `hasMore` e sem erro/loading inicial).

**Row (esquerda → direita):** timestamp mono → badge de kind → texto do evento → thread id mono (**destino:** link/botão que abre a thread no workspace).

**Alinhamento do card / painel:** coluna centrada no shell; conteúdo alinhado à esquerda; empty/erro centralizados no slot  
**Largura máx.:** `max-w-[1080px]`

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Página | `mx-auto max-w-[1080px] px-lg py-xl` sobre `bg-bg text-fg` | shell já pinta `bg-bg` |
| Título | `font-display text-[21px] font-semibold tracking-tight text-fg` | type-scale Adiada → px observado |
| Subtítulo | `mt-xs text-[13.5px] text-muted` | |
| Filterbar | `mb-md flex flex-wrap gap-sm` | |
| Chip ativo | `rounded-[20px] border border-accent bg-accent/10 text-accent-2` | `aria-pressed` |
| Chip inativo | `border-border bg-surface text-fg/80 hover:border-muted hover:text-fg` | |
| Tabela wrapper | `overflow-hidden rounded-md border border-border` | |
| `th` | `border-b border-border bg-surface-2 … text-[11px] font-semibold uppercase tracking-[0.05em] text-muted` | |
| Row | `border-b border-border/60 hover:bg-surface` | |
| Timestamp | `font-mono text-[11.5px] text-muted` | `pt-BR` locale |
| Badge kind `task` | `border-accent/40 bg-accent/10 text-accent-2` | label “Task” |
| Badge kind `tool` | `border-amber/40 bg-amber/10 text-amber` | label “Tool call” |
| Badge kind `git` | `border-green/40 bg-green/10 text-green` | label “Git flow” |
| Evento | `text-[13px] font-medium text-fg` | valor cru de `entry.event` |
| Thread id | `font-mono text-[12px] text-fg/70` | **destino:** + link/accent no hover/focus |
| Skeleton | `animate-pulse … bg-surface-2` | 6 rows |
| Empty | ícone linhas + `text-[13px] text-muted` | max-w ~280px |
| Erro | `border-red/40 bg-red/5 text-red` + `role="alert"` | |
| CTA “Carregar mais” | `border border-border bg-surface-2 …` | secondary; não accent |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | chips, retry, load more, link thread |

### Observado na fonte (opcional)

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Marca no empty / network | LionCode | EngrenaCode |
| Página | `max-w-[1080px]` | manter (≠ 1180 de Skills/Rules) |
| Paginação | “Carregar mais”, não números de página | manter |
| Thread id | span não clicável | **link** → `#principal` (ou rota workspace) com thread selecionada |
| Colunas header | Quando / Tipo / Evento / Thread | manter labels da fonte |
| Kind badge labels | Task / Tool call / Git flow (singulares no badge) | filtros usam plurais Tasks / Tool calls |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode`. Células = texto final no destino.

| Slot | Texto |
|------|-------|
| `title` | Registros |
| `subtitle` | Histórico persistido localmente (better-sqlite3) de tasks, tool calls e eventos de git flow por thread. |
| `filter.aria` | Filtrar registros por tipo |
| `filter.all` | Todos |
| `filter.task` | Tasks |
| `filter.tool` | Tool calls |
| `filter.git` | Git flow |
| `col.quando` | Quando |
| `col.tipo` | Tipo |
| `col.evento` | Evento |
| `col.thread` | Thread |
| `kind.task` | Task |
| `kind.tool` | Tool call |
| `kind.git` | Git flow |
| `empty.none` | Nenhum registro ainda |
| `empty.filtered` | Nenhum registro para este filtro |
| `cta.loadMore` | Carregar mais |
| `cta.loadingMore` | Carregando... |
| `cta.retry` | Tentar novamente |
| `error.generic` | Não foi possível carregar os registros. |
| `error.network` | Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução. |
| `thread.open.aria` | Abrir thread {threadId} no workspace |

> **Decisão 2026-08-05:** empties e `error.generic` seguem o **PRD** (frases curtas). Fonte LionCode tem empty longo + “Tente novamente.” no corpo do erro; não usar no aceite Central. CTA `cta.retry` permanece separado do corpo.

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `filter` | chip group | — | `all` \| `task` \| `tool` \| `git`; troca reseta offset e recarrega página 0 |
| `table` | table read-only | — | 4 colunas; sem seleção em massa; sem menu de row |
| `threadId` | link / button | — | **destino:** navega ao workspace com a thread; fonte ainda não implementa |
| `loadMore` | button | — | aparece se `entries.length === PAGE_SIZE` na última página; disabled + “Carregando...” em `loadingMore` |
| `retry` | button | — | só no `ErrorState`; chama reload da página 0 |

Sem campos de formulário. Sem export. Sem delete/edit por row.

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` | mount / filtro `all` com dados | chips + tabela com rows |
| `filling` | N/A (somente leitura) | N/A — troca de filtro equivale a novo load |
| `loading` | mount ou troca de filtro | skeleton 6 rows; filterbar permanece interativo |
| `loadingMore` | clique “Carregar mais” | CTA “Carregando...”; rows existentes permanecem |
| `disabled` | `loadingMore` no CTA | botão load more disabled (`opacity-50`) |
| `error` | falha `listLogs` | `ErrorState` no lugar da tabela; sem load more |
| `empty` | load ok, 0 entries, filtro `all` | `empty.none` |
| `emptyFiltered` | load ok, 0 entries, filtro ≠ `all` | `empty.filtered` |
| `hasMore` | última página retornou exatamente 100 | CTA “Carregar mais” |
| `threadNavigate` | clique thread id (**destino**) | navega F03 com thread; sem modal nesta tela |
| `vaultLocked` | 423 / sessão travada | tipicamente redirect login (App); se request falhar na tela: `error` com mensagem da API |

## Componentes sugeridos

Compor a tela só com primitives compartilhados (não reinventar strings de classe):

| Primitive | Uso nesta tela |
|-----------|----------------|
| `AppShell` | chrome + nav “Registros” |
| `LogTable` | filterbar + tabela + empty/error/load more (já existe na fonte) |
| `Button` (secondary) | “Carregar mais”, “Tentar novamente” |
| `Badge` / chip | filtros + kind badges (ou classes travadas da fonte) |
| `Link` / `Button` ghost | thread id → workspace (destino) |
| `Card` | N/A — tabela bordered, não card grid |
| `Field` / `Input` | N/A |

## Aceite visual

- [ ] Bate com a referência visual em dark (quando o PNG existir)
- [ ] Anatomia na ordem documentada; sem H1/marca extra; sem CTAs de export/edit/delete
- [ ] Tabela de copy 100% aplicada (labels, filtros, empties, erros, CTAs) com rename EngrenaCode
- [ ] Nenhum tamanho de fonte arbitrário fora do registrado / type scale destino
- [ ] Chips, tabela e CTAs usam tokens de superfície (`border-border`, `bg-surface`, accents de kind)
- [ ] Estados `loading`, `loadingMore`, `error`, `empty`, `emptyFiltered` verificáveis
- [ ] Tema `light` \| `dark` \| `system` via tokens (sem hex solto)
- [ ] Thread id é acionável e abre a thread no workspace (gap fonte → obrigatório destino)
- [ ] Página de 100 entradas; “Carregar mais” só quando há próxima página

## Perguntas em aberto

- Navegação do thread id: hash `#principal` + `threadId` na store, query `?thread=`, ou deep-link dedicado?
- Subtítulo cita `better-sqlite3`: manter detalhe de implementação ou suavizar copy de produto?

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F08-registros/spec.md` | Contratos técnicos (API, IPC, erros de domínio) |
| `docs/F08-registros/plan.md` | Ordem de implementação |
| `docs/design-system/` / F01.1 | Tokens e padrões de superfície |
| `docs/F03-workspace/ui.md` | Destino do clique no thread id |
| `docs/F08-registros/copy.md` | Catálogo de microcopy |
