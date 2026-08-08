# Spec de UI: #principal (CodeGraph — seção sidebar + oferta de consent)

**Feature:** F19-codegraph-e-navegacao-estrutural  
**Destino:** EngrenaCode  
**Fonte de referência:** LionCodeLabs (`packages/renderer` — `CodegraphSection.tsx`, `CodegraphConsentDialog.tsx`, `codegraph.logic.ts`; mount em `WorkspaceSidebar.tsx` / `PrincipalScreen.tsx`)  
**Componente fonte:** `LionCodeLabs/packages/renderer/src/components/codegraph/CodegraphSection.tsx` (+ `CodegraphConsentDialog.tsx`, `codegraph.logic.ts`, `useCodegraphStatus.ts`)  
**Componente destino (previsto):** `src/renderer/components/codegraph/CodegraphSection.tsx` (+ consent opcional), montado em `WorkspaceSidebar.tsx` / `#principal`  
**Última atualização:** 2026-08-07

> **Relação com F19 técnico:** este SDD extrai a UI da fonte. O `spec.md` Engrena F19 é mais estreito (índice TS via Compiler API, sem CLI externa, status `indexed`/`indexing`/`unsupported`). Itens só da fonte (CLI install, suppress, repair, lock unlock) ficam **fora do escopo Engrena F19** — ver Escopo.

## Referência visual

| Artefato | Caminho |
|----------|---------|
| Mock / screenshot canônico | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-section-referencia.png` |
| Consent (oferta) | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-consent-referencia.png` |
| Dark (opcional) | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-section-dark-referencia.png` |

> Capturado 2026-08-07 via `playwright-cli attach --cdp` no Electron LionCodeLabs (`--remote-debugging-port=9222`), projeto scratch `f19-codegraph-ref` com 1 arquivo `.ts`. Badge `sem graph` + painel expandido; dialog de consent no canto inferior direito.

### Evidência do destino (EngrenaCode, já implementado)

| Artefato | Caminho |
|----------|---------|
| Estado `missing` (badge `sem graph` + CTA `Gerar graph`) | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-section-missing-destino.png` |
| Estado `indexed` (badge + stats + `Reindexar`) | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-section-indexed-destino.png` |
| Snapshot a11y do estado `indexed` | `docs/F19-codegraph-e-navegacao-estrutural/ui/codegraph-section-indexed-destino.yml` |

> Capturado 2026-08-07 17:01 no Electron EngrenaCode real, projeto `engrena-code` (559 arquivos / 2239 símbolos indexados). Diferente dos assets `*-referencia.png` acima, que são da **fonte** — estes mostram o que o destino de fato shipou.

## Escopo

**Inclui (Engrena F19):**
- Seção colapsável **CodeGraph** na sidebar direita do `#principal` (fora do card Repo Harness na fonte — ver Perguntas)
- Badge de status no summary (sempre visível fechado/aberto)
- Painel: CTA por estado, linhas de stats (Arquivos / Símbolos / …), hint de estado vazio/erro
- Contrato visual dos estados Engrena: mapeados a partir dos 5 estados da fonte → `missing`/`indexing`/`indexed`/`unsupported` (+ `error` se houver)
- Copy literal da fonte (com rename de marca); ids em `copy.md`

**Exclui (visível na fonte, fora de Engrena F19 / deferred):**
- Auto-install / path / versão da **CLI `codegraph` externa** (Engrena indexa in-process via TypeScript API — `spec.md`)
- Oferta de consent que menciona download ~55 MB e entrada `.codegraph/` no `.gitignore` (fonte); Engrena indexa lazy no 1º turno sem CLI
- Supressão de oferta (repo / global), `codegraph unlock`, “Reparar graph”, writer externo / lock
- Contratos HTTP/WS/indexador (`spec.md` técnico)
- Tela dedicada de grafo / navegação visual de símbolos (PRD: navegação via tool call na timeline)

## Anatomia (topo → base)

### A) Seção `CodegraphSection` (WorkspaceSidebar, acima de Repo Harness)

Ordem obrigatória:

1. `<details>` card: summary caps **CodeGraph** + ícone de grafo + **badge** à direita (sempre visível)
2. Corpo (quando aberto), por estado:
   1. Loading: “Carregando status do graph…” / erro de fetch
   2. `absent` / missing: CTA **Gerar graph** (Engrena: equivalente a disparar index / ou só badge se index for só automático)
   3. `building` / indexing: texto **Indexando…** (+ % / phase se houver) + CTA **Cancelar** (fonte; Engrena pode omitir cancel se index sync no turn)
   4. `ready` / indexed: stats InfoRows
   5. `stale`: CTA **Atualizar** (fonte sync; Engrena → reindex / “desatualizado”)
   6. `error`: CTA **Tentar de novo** + `role="alert"` com mensagem
3. InfoRows (quando há stats): Arquivos · Símbolos · Relações · Tamanho · Indexado · Pendentes (se > 0)
4. Hints de CLI / suppress / repair: **só fonte** — não implementar em Engrena F19

### B) Dialog `CodegraphConsentDialog` (fonte)

1. Card flutuante `role="dialog"` canto inferior direito (`fixed bottom-md right-md`, `w-[340px]`)
2. Título · corpo com nome do projeto · duração estimada · aviso `.gitignore`
3. Opcional: linha de download CLI (~55 MB)
4. Ações: **Criar agora** · **Agora não** · **Não perguntar de novo neste repo**
5. Esc = Agora não

**Engrena F19:** consent **não é obrigatório** (index lazy no turno). Se o design quiser oferta explícita, reusar anatomia sem copy de CLI/`.codegraph/`.

**Alinhamento:** seção na coluna da sidebar direita; consent flutuante canto inferior direito (não modal fullscreen)  
**Largura máx.:** seção = largura da sidebar; consent `max-w-[340px]` / `max-w-[calc(100vw-24px)]`

## Layout / tokens

| Região | Tokens / classes destino | Notas |
|--------|--------------------------|-------|
| Host | `#principal` · `complementary` painel workspace | sem rota `#codegraph` |
| Card seção | `rounded-xl border border-border` + surface mix `bg-[color-mix(in_srgb,var(--fg)_5%,var(--surface-2))]` | igual outras seções sidebar |
| Summary | `text-[11px] font-bold uppercase tracking-[0.07em] text-muted` · open → `text-fg` / ícone `text-accent` | |
| Badge chip | `rounded-full border px-[8px] py-[1px] font-mono text-[10px] font-semibold` | ver BADGE_CLASS |
| Badge absent | `border-border text-muted opacity-70` | |
| Badge building | `border-accent/40 bg-accent/10 text-accent animate-pulse` | |
| Badge ready | `border-green/40 bg-green/10 text-green` | |
| Badge stale | amber border/bg/text | |
| Badge error | `border-red/40 bg-red/10 text-red` | |
| Row CTA | `ROW_BTN`: `text-[12px]`, hover surface mix, `focus-visible:ring-2 focus-visible:ring-accent` | |
| InfoRow | label `text-muted` · valor `font-mono text-[11.5px]` | |
| Consent card | `rounded-xl border border-border bg-surface p-md shadow-xl` | |
| Consent CTA primary | `rounded-md bg-accent … text-white` | |
| Focus | `focus-visible:ring-2 focus-visible:ring-accent` | |
| Erro | `text-red` · `role="alert"` | |

### Observado na fonte

| Item | Valor na fonte | Mapeamento destino |
|------|----------------|--------------------|
| Posição CodeGraph | Seção própria **acima** de Repo Harness | **Shipou igual à fonte** (seção própria), apesar do PRD dizer “no Repo Harness” |
| Badge ready label | `pronto` | **Shipou o do PRD**: `CodeGraph: indexado ({n}h atrás)`; só o tooltip ficou o da fonte |
| Badge building | `gerando…` / `Indexando…` no painel | Alinhar a `indexando…` (PRD) |
| unsupported | Não há chip dedicado; CLI missing vira hint amber | Engrena: badge/status `não suportado` |

## Copy (literal — fonte de verdade)

Aplicar mapa de rename: `LionCode → EngrenaCode` (nenhuma string desta seção usa o wordmark do produto além do shell). Células = texto final no destino **quando o slot entra no escopo Engrena**; slots só-fonte marcados `(fonte / fora F19)`.

| Slot | Texto |
|------|-------|
| `section.title` | CodeGraph |
| `badge.absent` | sem graph |
| `badge.building` | gerando… |
| `badge.building.percent` | gerando… {percent}% |
| `badge.ready` | pronto |
| `badge.stale` | desatualizado |
| `badge.error` | erro |
| `badge.cliInstalling` | instalando CLI… `(fonte / fora F19)` |
| `badge.title.absent.ok` | CodeGraph ausente — clique para criar |
| `badge.title.absent.noCli` | CodeGraph ausente — CLI não disponível `(fonte)` |
| `badge.title.building` | Indexação em andamento |
| `badge.title.ready` | CodeGraph pronto — o agente consulta o grafo de símbolos |
| `badge.title.stale` | Graph desatualizado em relação ao worktree — clique em Atualizar |
| `panel.loading` | Carregando status do graph… |
| `panel.indexing` | Indexando… |
| `cta.generate` | Gerar graph |
| `cta.generate.loading` | Iniciando build… |
| `cta.cancel` | Cancelar |
| `cta.cancel.loading` | Cancelando… |
| `cta.update` | Atualizar |
| `cta.update.loading` | Atualizando… |
| `cta.retry` | Tentar de novo |
| `cta.retry.loading` | Tentando… |
| `cta.repair` | Reparar graph `(fonte / fora F19)` |
| `cta.reindexIncomplete` | índice incompleto — reindexar `(fonte; Engrena pode mapear a Reindexar)` |
| `stats.files` | Arquivos |
| `stats.symbols` | Símbolos |
| `stats.edges` | Relações |
| `stats.size` | Tamanho |
| `stats.indexed` | Indexado |
| `stats.pending` | Pendentes |
| `stats.unavailable` | Stats indisponíveis: {message} |
| `hint.cliMissing.auto` | CLI codegraph não encontrada — será baixada e instalada automaticamente ao gerar o graph. `(fonte / fora F19)` |
| `error.network` | Não foi possível contatar o servidor local. |
| `error.generic` | Falha na ação do CodeGraph. |
| `consent.title` | Criar graph do repositório? |
| `consent.body` | {projectName}: o agente passa a consultar o grafo de símbolos antes de varrer arquivos. |
| `consent.duration` | Duração estimada: {estimate} ({fileCount} arquivo(s)). O `.gitignore` do repo ganhará a entrada `.codegraph/`. `(fonte; .codegraph/ fora F19)` |
| `consent.cliDownload` | Inclui baixar a CLI `codegraph` automaticamente (~55 MB, uma vez só). `(fonte / fora F19)` |
| `consent.cta.create` | Criar agora |
| `consent.cta.create.loading` | Criando… |
| `consent.cta.later` | Agora não |
| `consent.cta.suppress` | Não perguntar de novo neste repo `(fonte / fora F19)` |

### Destino Engrena (PRD) — preferir quando divergir da fonte

| Slot | Texto Engrena F19 |
|------|-------------------|
| `badge.indexed` | CodeGraph: indexado ({n}h atrás) |
| `badge.indexing` | CodeGraph: indexando… |
| `badge.unsupported` | CodeGraph: não suportado |
| `cta.reindex` | Reindexar |

## Campos e controles

| Controle | Tipo | Obrigatório | Props / comportamento |
|----------|------|-------------|------------------------|
| `summary` | details/summary | sim | Toggle painel; badge sempre visível |
| `badge` | chip | sim | `data-codegraph-badge={state}`; `title` = tooltip |
| `cta.primary` | button | por estado | Disabled se `busy` |
| `consent.*` | dialog buttons | fonte | Esc = later |

## Estados

| Estado | Gatilho | UI |
|--------|---------|-----|
| `default` / `missing` | mount sem índice | Badge `sem graph` (fonte) / Engrena `não suportado` ou missing; CTA Gerar se aplicável |
| `loading` | GET status pendente | Summary com `…` mono muted |
| `indexing` | build/run ativo | Badge pulse + painel Indexando… |
| `indexed` / `ready` | índice ok | Badge pronto/verde + stats |
| `stale` | índice atrasado (fonte) | Badge desatualizado + Atualizar |
| `unsupported` | zero TS/JS (Engrena) | Badge não suportado; sem CTA de build CLI |
| `error` | falha de index | Badge erro + alert + retry |
| `consent` | oferta (fonte) | Dialog flutuante |

## Componentes sugeridos

| Primitive | Uso nesta tela |
|-----------|----------------|
| `details` / section card | Mesmo padrão das seções da `WorkspaceSidebar` |
| Badge / StatusDot | Chip de estado (ou classes do BADGE_CLASS) |
| `ButtonSecondary` / row button | CTAs do painel |
| Dialog / surface card | Consent (se mantido) |
| `InlineFeedback` | Erros `role="alert"` |

## Aceite visual

- [ ] Bate com `codegraph-section-referencia.png` / consent (dark)
- [ ] Anatomia: summary CodeGraph + badge; painel na ordem documentada
- [ ] Copy dos slots in-scope aplicada (`copy.md`); sem LionCode/LionClaw
- [ ] Badge legível com seção fechada
- [ ] Estados `indexing`, `indexed`/`ready`, `error` verificáveis
- [ ] Tema via tokens (sem hex solto no destino)
- [ ] Slots CLI/consent-download **não** shipados no MVP Engrena F19

## Resolvidas pela implementação (ver Evidência do destino)

- **Posição da seção:** venceu a anatomia da fonte — `CodeGraph` é seção própria **acima** do Repo Harness, não uma linha dentro dele (`codegraph-section-indexed-destino.yml`: `group` com summary `CodeGraph` precedendo o heading `Repo Harness`).
- **Badge ready:** venceu o PRD — shipou `CodeGraph: indexado ({n}h atrás)`, não o `pronto` da fonte. O tooltip, esse sim, ficou o da fonte (`CodeGraph pronto — o agente consulta o grafo de símbolos`).

## Perguntas em aberto

- Engrena indexa no 1º turno sem consent: manter dialog só como opcional de design, ou omitir por completo?
- CTA **Cancelar** durante index: Engrena F19 index sync no turn — cancelar faz sentido? (a evidência do destino só cobre `missing` e `indexed`, nunca `indexing`, então não responde isto)

## Relacionados

| Doc | Papel |
|-----|-------|
| `docs/F19-codegraph-e-navegacao-estrutural/spec.md` | Contratos técnicos (índice, MCP, HTTP) |
| `docs/F19-codegraph-e-navegacao-estrutural/plan.md` | Ordem de implementação |
| `docs/F19-codegraph-e-navegacao-estrutural/copy.md` | Catálogo de microcopy |
| `docs/design-system/` | Tokens e superfícies |
| `docs/F15-runtime-de-subagents/ui.md` | Padrão de SDD runtime + sidebar |
