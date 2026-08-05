import { useCallback, useEffect, useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import { MetricCard } from '../components/MetricCard'
import { InlineFeedback } from '../components/InlineFeedback'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { ButtonSecondary } from '../components/ButtonSecondary'
import {
  consumoService,
  THREAD_EVENTS_PAGE_SIZE,
  type ModelPricingRow,
  type Period,
  type ProjectUsageRow,
  type SummaryResponse,
  type ThreadUsageRow,
  type UsageEventRow,
} from '../services/consumo-service'
import { formatCompact, formatCostText, formatPercent, shareLabel } from './consumoScreen.logic'

// ── Copy literal (docs/F11-consumo/copy.md `consumo.*`) — não redescrever aqui, só citar ids ──
const COPY = {
  title: 'Consumo',
  subtitle: 'Tokens, custos equivalentes e preços por projeto, thread e subagent.',
  period: { aria: 'Período do consumo', d7: '7 dias', d30: '30 dias', all: 'Tudo' },
  summaryAria: 'Resumo de consumo',
  card: {
    subscription: 'Assinatura (estimado)',
    apiKey: 'API key (equivalente)',
    tokenPlan: 'Token plan (equivalente API)',
    tokensInOut: 'Tokens in / out',
    threads: 'Threads',
    threadsSr: 'ativas / total',
    cacheRead: 'Cache read',
  },
  section: {
    projects: 'Projetos',
    threads: (name: string) => `Threads · ${name}`,
    events: (label: string) => `Eventos · ${label}`,
    pricing: 'Preços',
    pricingHint: 'Valores por milhão de tokens. Alterações recalculam somente eventos elegíveis sem custo.',
  },
  col: {
    projeto: 'Projeto',
    custo: 'Custo',
    tokens: 'Tokens',
    threads: 'Threads',
    cacheRead: 'Cache read',
    ultimoEvento: 'Último evento',
    thread: 'Thread',
    providersModels: 'Providers / modelos',
    shareSubagents: 'Share subagents',
    quando: 'Quando',
    turno: 'Turno',
    origem: 'Origem',
    providerModel: 'Provider / modelo',
    billing: 'Billing',
    cache: 'Cache',
    fonteCusto: 'Fonte custo',
  },
  origem: { agent: 'agente', subagentFallback: 'subagent' },
  share: { partial: '— / custo parcial' },
  cost: { partialSuffix: '⚠ parcial', unavailableTitle: 'Custo indisponível: não há preço para os eventos deste recorte.' },
  eventsMeta: (loaded: number, total: number) => `${loaded} de ${total} eventos carregados`,
  cta: {
    loadMoreEvents: 'Carregar mais eventos',
    loadingMore: 'Carregando…',
    retry: 'Tentar novamente',
    edit: 'Editar',
    cancel: 'Cancelar',
    savePrice: 'Salvar preço',
    saving: 'Salvando…',
  },
  loading: {
    summary: 'Carregando consumo…',
    threads: 'Carregando threads…',
    events: 'Carregando eventos…',
    pricing: 'Carregando preços…',
  },
  empty: {
    projects: 'Nenhum projeto encontrado.',
    threads: 'Nenhuma thread com consumo neste período.',
    events: 'Nenhum evento de consumo nesta thread.',
    pricing: 'Nenhum preço configurado.',
  },
  banner: {
    unpriced: 'Modelos observados sem preço',
    unpricedCta: (provider: string, model: string) => `+ ${provider} / ${model}`,
    allPriced: 'Todos os modelos observados possuem preço.',
  },
  pricing: { badgeApprox: '~aprox.', rowRates: (input: string, output: string) => `in $${input} · out $${output}` },
  label: {
    inputPerMTok: 'Entrada / MTok',
    outputPerMTok: 'Saída / MTok',
    cacheReadPerMTok: 'Cache read / MTok',
    cacheWritePerMTok: 'Cache write / MTok',
    source: 'Fonte',
    approximate: 'Aproximado',
  },
  error: {
    generic: 'Não foi possível carregar os dados.',
    pricingRequiredIO: 'Preencha os preços de entrada e saída.',
    pricingNonNegative: 'Os preços devem ser números maiores ou iguais a zero.',
  },
} as const

const PERIOD_OPTIONS: Array<{ value: Period; label: string }> = [
  { value: '7d', label: COPY.period.d7 },
  { value: '30d', label: COPY.period.d30 },
  { value: 'all', label: COPY.period.all },
]

// ── Formatação ───────────────────────────────────────────────────────────────
// Funções puras (formatCompact/formatPercent/formatCostText/shareLabel) vivem em
// consumoScreen.logic.ts (testadas em consumoScreen.logic.test.ts).

function formatTimestamp(ms: number): string {
  return new Date(ms).toLocaleString('pt-BR')
}

interface CostValueProps {
  costUsd: number | null
  approximate?: boolean
  partial?: boolean
}

function CostValue({ costUsd, approximate, partial }: Readonly<CostValueProps>): ReactElement {
  const text = formatCostText(costUsd, { approximate, partial })
  const tone = costUsd === null ? (partial ? 'text-amber' : 'text-muted') : partial || approximate ? 'text-amber' : 'text-fg'
  return (
    <span title={costUsd === null ? COPY.cost.unavailableTitle : undefined} className={tone}>
      {text}
    </span>
  )
}

function isApiError<T>(res: T | { error: { code: string; message: string } }): res is { error: { code: string; message: string } } {
  return typeof res === 'object' && res !== null && 'error' in res
}

// ── Resumo ───────────────────────────────────────────────────────────────────

function SummaryCards({ summary }: Readonly<{ summary: SummaryResponse }>): ReactElement {
  return (
    <div aria-label={COPY.summaryAria} className="grid grid-cols-2 gap-md md:grid-cols-3 lg:grid-cols-6">
      <MetricCard
        label={COPY.card.subscription}
        value={<CostValue costUsd={summary.byBillingMode.subscription.costUsd} approximate={summary.byBillingMode.subscription.approximate} />}
      />
      <MetricCard
        label={COPY.card.apiKey}
        value={<CostValue costUsd={summary.byBillingMode.apiKey.costUsd} approximate={summary.byBillingMode.apiKey.approximate} />}
      />
      <MetricCard
        label={COPY.card.tokenPlan}
        value={<CostValue costUsd={summary.byBillingMode.tokenPlan.costUsd} approximate={summary.byBillingMode.tokenPlan.approximate} />}
      />
      <MetricCard
        label={COPY.card.tokensInOut}
        value={`${formatCompact(summary.tokens.input)} / ${formatCompact(summary.tokens.output)}`}
      />
      <MetricCard
        label={COPY.card.threads}
        value={
          <span>
            {summary.threads.active} / {summary.threads.total}
            <span className="sr-only"> {COPY.card.threadsSr}</span>
          </span>
        }
      />
      <MetricCard label={COPY.card.cacheRead} value={formatPercent(summary.cacheReadPercent)} />
    </div>
  )
}

// ── Projetos ─────────────────────────────────────────────────────────────────

interface ProjectsTableProps {
  projects: ProjectUsageRow[]
  selectedProjectId: string | null
  onSelect: (project: ProjectUsageRow) => void
}

function ProjectsTable({ projects, selectedProjectId, onSelect }: Readonly<ProjectsTableProps>): ReactElement {
  if (projects.length === 0) {
    return <p className="p-lg text-center text-[13px] text-muted">{COPY.empty.projects}</p>
  }

  const maxTokens = Math.max(...projects.map((p) => p.totalTokens), 1)

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[COPY.col.projeto, COPY.col.custo, COPY.col.tokens, COPY.col.threads, COPY.col.cacheRead, COPY.col.ultimoEvento].map((h) => (
              <th key={h} className="border-b border-border bg-surface-2 px-md py-sm text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {projects.map((p) => (
            <tr
              key={p.projectId}
              onClick={() => onSelect(p)}
              className={`cursor-pointer border-b border-border/60 hover:bg-surface-2/60 ${selectedProjectId === p.projectId ? 'bg-accent/5' : ''}`}
            >
              <td className="px-md py-sm">
                <div className="flex flex-col gap-[3px]">
                  <span className="text-[13px] font-medium text-fg">{p.projectName}</span>
                  <span className="h-[3px] w-full max-w-[120px] overflow-hidden rounded-full bg-surface-2">
                    <span className="block h-full fill-accent bg-accent" style={{ width: `${(p.totalTokens / maxTokens) * 100}%` }} />
                  </span>
                </div>
              </td>
              <td className="px-md py-sm font-mono text-[12.5px]">
                <CostValue costUsd={p.costUsd} partial={p.costPartial} />
              </td>
              <td className="px-md py-sm font-mono text-[12.5px] text-fg">{formatCompact(p.totalTokens)}</td>
              <td className="px-md py-sm font-mono text-[12.5px] text-fg">{p.threadCount}</td>
              <td className="px-md py-sm font-mono text-[12.5px] text-fg">{formatPercent(p.cacheReadPercent)}</td>
              <td className="px-md py-sm font-mono text-[11.5px] text-muted">{formatTimestamp(p.lastEventAt)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Threads ──────────────────────────────────────────────────────────────────

interface ThreadsTableProps {
  threads: ThreadUsageRow[]
  selectedThreadId: string | null
  onSelect: (thread: ThreadUsageRow) => void
}

function ThreadsTable({ threads, selectedThreadId, onSelect }: Readonly<ThreadsTableProps>): ReactElement {
  if (threads.length === 0) {
    return <p className="p-lg text-center text-[13px] text-muted">{COPY.empty.threads}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[COPY.col.thread, COPY.col.providersModels, COPY.col.tokens, COPY.col.custo, COPY.col.shareSubagents, COPY.col.ultimoEvento].map((h) => (
              <th key={h} className="border-b border-border bg-surface-2 px-md py-sm text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {threads.map((t) => {
            const share = shareLabel(t)
            const totalCost = (t.agentCostUsd ?? 0) + (t.subagentCostUsd ?? 0)
            const totalTokens = t.agentTokens + t.subagentTokens
            const partial = !t.agentPricingComplete || !t.subagentPricingComplete
            return (
              <tr
                key={t.threadId}
                onClick={() => onSelect(t)}
                className={`cursor-pointer border-b border-border/60 hover:bg-surface-2/60 ${selectedThreadId === t.threadId ? 'bg-accent/5' : ''}`}
              >
                <td className="px-md py-sm font-mono text-[12px] text-fg">{t.threadTitle ?? t.threadId}</td>
                <td className="px-md py-sm">
                  <div className="flex flex-wrap gap-xs">
                    {t.providers.map((p) => (
                      <span key={p} className="rounded-[20px] border border-border bg-surface-2 px-sm py-[2px] font-mono text-[10.5px] text-fg/75">
                        {p}
                      </span>
                    ))}
                  </div>
                </td>
                <td className="px-md py-sm font-mono text-[12.5px] text-fg">{formatCompact(totalTokens)}</td>
                <td className="px-md py-sm font-mono text-[12.5px]">
                  <CostValue costUsd={(t.agentCostUsd !== null || t.subagentCostUsd !== null) ? totalCost : null} partial={partial} />
                </td>
                <td className="px-md py-sm font-mono text-[12.5px] text-fg" title={share.title}>
                  {share.text}
                </td>
                <td className="px-md py-sm font-mono text-[11.5px] text-muted">{formatTimestamp(t.lastEventAt)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ── Eventos ──────────────────────────────────────────────────────────────────

function EventsTable({ events }: Readonly<{ events: UsageEventRow[] }>): ReactElement {
  if (events.length === 0) {
    return <p className="p-lg text-center text-[13px] text-muted">{COPY.empty.events}</p>
  }

  return (
    <div className="overflow-x-auto rounded-md border border-border">
      <table className="w-full border-collapse">
        <thead>
          <tr>
            {[COPY.col.quando, COPY.col.turno, COPY.col.origem, COPY.col.providerModel, COPY.col.billing, COPY.col.tokens, COPY.col.cache, COPY.col.fonteCusto, COPY.col.custo].map((h) => (
              <th key={h} className="border-b border-border bg-surface-2 px-md py-sm text-left text-[10.5px] font-semibold uppercase tracking-[0.05em] text-muted">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {events.map((e) => (
            <tr key={e.id} className="border-b border-border/60 hover:bg-surface-2/40">
              <td className="px-md py-sm font-mono text-[11.5px] text-muted">{formatTimestamp(e.createdAt)}</td>
              <td className="px-md py-sm font-mono text-[11px] text-muted">{e.turnId.slice(0, 8)}</td>
              <td className="px-md py-sm">
                <span className="rounded-[20px] border border-border bg-surface-2 px-sm py-[2px] font-mono text-[10.5px] text-fg/75">
                  {e.source === 'agent' ? COPY.origem.agent : e.subagentName || COPY.origem.subagentFallback}
                </span>
              </td>
              <td className="px-md py-sm font-mono text-[11.5px] text-fg">
                {e.provider}
                {e.model ? ` / ${e.model}` : ''}
              </td>
              <td className="px-md py-sm font-mono text-[11px] text-fg/75">{e.billingMode}</td>
              <td className="px-md py-sm font-mono text-[12px] text-fg">{formatCompact(e.totalTokens)}</td>
              <td className="px-md py-sm font-mono text-[11px] text-fg/75">{formatCompact((e.cacheReadTokens ?? 0) + (e.cacheCreationTokens ?? 0))}</td>
              <td className="px-md py-sm font-mono text-[11px] text-fg/75">{e.costSource}</td>
              <td className="px-md py-sm font-mono text-[12.5px]">
                <CostValue costUsd={e.costUsd} approximate={e.costApproximate} />
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

// ── Preços ───────────────────────────────────────────────────────────────────

interface PricingFormState {
  mode: 'create' | 'edit'
  id?: string
  provider: string
  model: string
  inputPerMTok: string
  outputPerMTok: string
  cacheReadPerMTok: string
  cacheWritePerMTok: string
  approximate: boolean
  source: string
  saving: boolean
  error: string | null
}

function emptyPricingForm(seed?: { provider: string; model: string }): PricingFormState {
  return {
    mode: 'create',
    provider: seed?.provider ?? '',
    model: seed?.model ?? '',
    inputPerMTok: '',
    outputPerMTok: '',
    cacheReadPerMTok: '',
    cacheWritePerMTok: '',
    approximate: false,
    source: '',
    saving: false,
    error: null,
  }
}

interface PricingSectionProps {
  pricing: ModelPricingRow[] | null
  unpricedModels: Array<{ provider: string; model: string }>
  loading: boolean
  error: boolean
  onRetry: () => void
  onSaved: () => void
}

function PricingSection({ pricing, unpricedModels, loading, error, onRetry, onSaved }: Readonly<PricingSectionProps>): ReactElement {
  const [form, setForm] = useState<PricingFormState | null>(null)

  const submit = useCallback(async () => {
    if (!form) return
    const input = Number.parseFloat(form.inputPerMTok)
    const output = Number.parseFloat(form.outputPerMTok)
    if (!Number.isFinite(input) || !Number.isFinite(output)) {
      setForm({ ...form, error: COPY.error.pricingRequiredIO })
      return
    }
    if (input < 0 || output < 0) {
      setForm({ ...form, error: COPY.error.pricingNonNegative })
      return
    }

    setForm({ ...form, saving: true, error: null })
    const cacheReadPerMTok = form.cacheReadPerMTok.trim() === '' ? null : Number.parseFloat(form.cacheReadPerMTok)
    const cacheWritePerMTok = form.cacheWritePerMTok.trim() === '' ? null : Number.parseFloat(form.cacheWritePerMTok)

    const res =
      form.mode === 'create'
        ? await consumoService.createPricing({
            provider: form.provider,
            model: form.model,
            inputPerMTok: input,
            outputPerMTok: output,
            cacheReadPerMTok,
            cacheWritePerMTok,
            approximate: form.approximate,
            source: form.source.trim() === '' ? null : form.source.trim(),
          })
        : await consumoService.updatePricing(form.id as string, {
            inputPerMTok: input,
            outputPerMTok: output,
            cacheReadPerMTok,
            cacheWritePerMTok,
            approximate: form.approximate,
            source: form.source.trim() === '' ? null : form.source.trim(),
          })

    if (isApiError(res)) {
      setForm({ ...form, saving: false, error: res.error.message })
      return
    }
    setForm(null)
    onSaved()
  }, [form, onSaved])

  return (
    <div className="mt-xl border-t border-border pt-lg">
      <h2 className="text-[18px] font-semibold text-fg">{COPY.section.pricing}</h2>
      <p className="mt-xs text-[12.5px] text-muted">{COPY.section.pricingHint}</p>

      {error ? (
        <div className="mt-md rounded-md border border-red/30 bg-red/5 p-md" role="alert">
          <InlineFeedback variant="error" message={COPY.error.generic} />
          <div className="mt-sm">
            <ButtonSecondary onClick={onRetry}>{COPY.cta.retry}</ButtonSecondary>
          </div>
        </div>
      ) : loading ? (
        <p className="mt-md py-xl text-center text-[13px] text-muted">{COPY.loading.pricing}</p>
      ) : (
        <>
          {unpricedModels.length > 0 ? (
            <div className="mt-md rounded-md border border-amber/30 bg-amber/5 p-md">
              <p className="text-[13px] font-medium text-amber">{COPY.banner.unpriced}</p>
              <div className="mt-sm flex flex-wrap gap-sm">
                {unpricedModels.map((m) => (
                  <button
                    key={`${m.provider}/${m.model}`}
                    type="button"
                    onClick={() => setForm(emptyPricingForm(m))}
                    className="rounded-sm border border-amber/40 px-sm py-xs font-mono text-[12px] text-amber hover:bg-amber/10"
                  >
                    {COPY.banner.unpricedCta(m.provider, m.model)}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <p className="mt-md text-[12.5px] text-muted">{COPY.banner.allPriced}</p>
          )}

          {form ? (
            <div className="mt-md rounded-md border border-accent/30 bg-accent/5 p-md">
              <div className="grid grid-cols-2 gap-md md:grid-cols-4">
                <label className="flex flex-col gap-[3px] text-[12px] text-muted">
                  {COPY.label.inputPerMTok}
                  <input
                    className="h-[34px] rounded-sm border border-border bg-bg px-sm font-mono text-[13px] text-fg focus:border-accent focus:outline-none"
                    value={form.inputPerMTok}
                    onChange={(e) => setForm({ ...form, inputPerMTok: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-[3px] text-[12px] text-muted">
                  {COPY.label.outputPerMTok}
                  <input
                    className="h-[34px] rounded-sm border border-border bg-bg px-sm font-mono text-[13px] text-fg focus:border-accent focus:outline-none"
                    value={form.outputPerMTok}
                    onChange={(e) => setForm({ ...form, outputPerMTok: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-[3px] text-[12px] text-muted">
                  {COPY.label.cacheReadPerMTok}
                  <input
                    className="h-[34px] rounded-sm border border-border bg-bg px-sm font-mono text-[13px] text-fg focus:border-accent focus:outline-none"
                    value={form.cacheReadPerMTok}
                    onChange={(e) => setForm({ ...form, cacheReadPerMTok: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <label className="flex flex-col gap-[3px] text-[12px] text-muted">
                  {COPY.label.cacheWritePerMTok}
                  <input
                    className="h-[34px] rounded-sm border border-border bg-bg px-sm font-mono text-[13px] text-fg focus:border-accent focus:outline-none"
                    value={form.cacheWritePerMTok}
                    onChange={(e) => setForm({ ...form, cacheWritePerMTok: e.target.value })}
                    inputMode="decimal"
                  />
                </label>
                <label className="col-span-2 flex flex-col gap-[3px] text-[12px] text-muted">
                  {COPY.label.source}
                  <input
                    className="h-[34px] rounded-sm border border-border bg-bg px-sm text-[13px] text-fg focus:border-accent focus:outline-none"
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                  />
                </label>
                <label className="flex items-center gap-sm text-[12.5px] text-fg">
                  <input type="checkbox" checked={form.approximate} onChange={(e) => setForm({ ...form, approximate: e.target.checked })} />
                  {COPY.label.approximate}
                </label>
              </div>

              {form.error ? <div className="mt-sm"><InlineFeedback variant="error" message={form.error} /></div> : null}

              <div className="mt-md flex gap-sm">
                <ButtonPrimary loading={form.saving} loadingLabel={COPY.cta.saving} onClick={() => void submit()}>
                  {COPY.cta.savePrice}
                </ButtonPrimary>
                <ButtonSecondary onClick={() => setForm(null)} disabled={form.saving}>
                  {COPY.cta.cancel}
                </ButtonSecondary>
              </div>
            </div>
          ) : null}

          {pricing === null || pricing.length === 0 ? (
            <p className="mt-md text-[13px] text-muted">{COPY.empty.pricing}</p>
          ) : (
            <ul className="mt-md space-y-sm">
              {pricing.map((p) => (
                <li key={p.id} className="flex items-center justify-between rounded-md border border-border bg-surface px-md py-sm">
                  <div className="flex items-center gap-sm">
                    <span className="rounded-md bg-accent px-sm py-[2px] font-mono text-[11px] font-semibold text-white">{p.provider}</span>
                    <span className="font-mono text-[13px] text-fg">{p.model}</span>
                    {p.approximate ? <span className="rounded-sm border border-border bg-surface-2 px-sm py-[2px] font-mono text-[10.5px] text-amber">{COPY.pricing.badgeApprox}</span> : null}
                  </div>
                  <div className="flex items-center gap-md">
                    <span className="font-mono text-[12px] text-muted">
                      {COPY.pricing.rowRates(p.inputPerMTok.toString(), p.outputPerMTok.toString())}
                    </span>
                    <ButtonSecondary
                      onClick={() =>
                        setForm({
                          mode: 'edit',
                          id: p.id,
                          provider: p.provider,
                          model: p.model,
                          inputPerMTok: String(p.inputPerMTok),
                          outputPerMTok: String(p.outputPerMTok),
                          cacheReadPerMTok: p.cacheReadPerMTok !== null ? String(p.cacheReadPerMTok) : '',
                          cacheWritePerMTok: p.cacheWritePerMTok !== null ? String(p.cacheWritePerMTok) : '',
                          approximate: p.approximate,
                          source: p.source ?? '',
                          saving: false,
                          error: null,
                        })
                      }
                    >
                      {COPY.cta.edit}
                    </ButtonSecondary>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  )
}

// ── Tela ─────────────────────────────────────────────────────────────────────

export function ConsumoScreen(): ReactElement {
  const [period, setPeriod] = useState<Period>('30d')

  const [summary, setSummary] = useState<SummaryResponse | null>(null)
  const [summaryError, setSummaryError] = useState(false)
  const [summaryLoading, setSummaryLoading] = useState(true)

  const [projects, setProjects] = useState<ProjectUsageRow[] | null>(null)
  const [selectedProject, setSelectedProject] = useState<ProjectUsageRow | null>(null)

  const [threads, setThreads] = useState<ThreadUsageRow[] | null>(null)
  const [threadsError, setThreadsError] = useState(false)
  const [threadsLoading, setThreadsLoading] = useState(false)
  const [selectedThread, setSelectedThread] = useState<ThreadUsageRow | null>(null)

  const [events, setEvents] = useState<UsageEventRow[]>([])
  const [eventsPage, setEventsPage] = useState<{ limit: number; offset: number; hasMore: boolean } | null>(null)
  const [eventsTotalLoaded, setEventsTotalLoaded] = useState(0)
  const [eventsError, setEventsError] = useState(false)
  const [eventsLoading, setEventsLoading] = useState(false)
  const [eventsLoadingMore, setEventsLoadingMore] = useState(false)

  const [pricing, setPricing] = useState<ModelPricingRow[] | null>(null)
  const [unpriced, setUnpriced] = useState<Array<{ provider: string; model: string }>>([])
  const [pricingError, setPricingError] = useState(false)
  const [pricingLoading, setPricingLoading] = useState(true)

  const loadSummaryAndProjects = useCallback(async (p: Period) => {
    setSummaryLoading(true)
    setSummaryError(false)
    const [summaryRes, projectsRes] = await Promise.all([consumoService.getSummary(p), consumoService.getProjects(p)])
    if (isApiError(summaryRes) || isApiError(projectsRes)) {
      setSummaryError(true)
    } else {
      setSummary(summaryRes)
      setProjects(projectsRes.projects)
    }
    setSummaryLoading(false)
  }, [])

  const loadPricing = useCallback(async () => {
    setPricingLoading(true)
    setPricingError(false)
    const res = await consumoService.listPricing()
    if (isApiError(res)) {
      setPricingError(true)
    } else {
      setPricing(res.pricing)
      setUnpriced(res.unpricedModels)
    }
    setPricingLoading(false)
  }, [])

  useEffect(() => {
    setSelectedProject(null)
    setSelectedThread(null)
    void loadSummaryAndProjects(period)
  }, [period, loadSummaryAndProjects])

  useEffect(() => {
    void loadPricing()
  }, [loadPricing])

  const loadThreads = useCallback(
    async (projectId: string, p: Period) => {
      setThreadsLoading(true)
      setThreadsError(false)
      setThreads(null)
      const res = await consumoService.getProjectDetail(projectId, p)
      if (isApiError(res)) setThreadsError(true)
      else setThreads(res.threads)
      setThreadsLoading(false)
    },
    []
  )

  useEffect(() => {
    setSelectedThread(null)
    setEvents([])
    setEventsPage(null)
    if (selectedProject) void loadThreads(selectedProject.projectId, period)
  }, [selectedProject, period, loadThreads])

  const loadEvents = useCallback(
    async (threadId: string, p: Period, offset: number, isMore: boolean) => {
      if (isMore) setEventsLoadingMore(true)
      else {
        setEventsLoading(true)
        setEvents([])
      }
      setEventsError(false)
      const res = await consumoService.getThreadEvents(threadId, p, offset)
      if (isApiError(res)) {
        setEventsError(true)
      } else {
        setEvents((prev) => (isMore ? [...prev, ...res.events] : res.events))
        setEventsPage(res.page)
        setEventsTotalLoaded((prev) => (isMore ? prev + res.events.length : res.events.length))
      }
      if (isMore) setEventsLoadingMore(false)
      else setEventsLoading(false)
    },
    []
  )

  useEffect(() => {
    if (selectedThread) void loadEvents(selectedThread.threadId, period, 0, false)
  }, [selectedThread, period, loadEvents])

  const threadEventsLabel = useMemo(
    () => (selectedThread ? COPY.section.events(selectedThread.threadTitle ?? selectedThread.threadId) : ''),
    [selectedThread]
  )

  return (
    <main className="mx-auto w-full max-w-[1240px] px-lg py-lg">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-[26px] font-bold tracking-tight text-fg">{COPY.title}</h1>
          <p className="mt-xs text-[13px] text-muted">{COPY.subtitle}</p>
        </div>
        <div role="group" aria-label={COPY.period.aria} className="flex rounded-md border border-border bg-surface p-xs">
          {PERIOD_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              type="button"
              aria-pressed={period === opt.value}
              onClick={() => setPeriod(opt.value)}
              className={
                period === opt.value
                  ? 'rounded-sm bg-accent px-md py-xs text-[13px] font-medium text-white'
                  : 'rounded-sm px-md py-xs text-[13px] font-medium text-muted hover:text-fg'
              }
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="mt-lg">
        {summaryError ? (
          <div className="rounded-md border border-red/30 bg-red/5 p-md" role="alert">
            <InlineFeedback variant="error" message={COPY.error.generic} />
            <div className="mt-sm">
              <ButtonSecondary onClick={() => void loadSummaryAndProjects(period)}>{COPY.cta.retry}</ButtonSecondary>
            </div>
          </div>
        ) : summaryLoading || !summary ? (
          <p className="py-xl text-center text-[13px] text-muted">{COPY.loading.summary}</p>
        ) : (
          <>
            <SummaryCards summary={summary} />

            <div className="mt-lg">
              <h2 className="text-[16px] font-semibold text-fg">{COPY.section.projects}</h2>
              <div className="mt-sm">
                <ProjectsTable projects={projects ?? []} selectedProjectId={selectedProject?.projectId ?? null} onSelect={setSelectedProject} />
              </div>
            </div>

            {selectedProject ? (
              <div className="mt-lg">
                <h2 className="text-[16px] font-semibold text-fg">{COPY.section.threads(selectedProject.projectName)}</h2>
                <div className="mt-sm">
                  {threadsError ? (
                    <div className="rounded-md border border-red/30 bg-red/5 p-md" role="alert">
                      <InlineFeedback variant="error" message={COPY.error.generic} />
                      <div className="mt-sm">
                        <ButtonSecondary onClick={() => void loadThreads(selectedProject.projectId, period)}>{COPY.cta.retry}</ButtonSecondary>
                      </div>
                    </div>
                  ) : threadsLoading || threads === null ? (
                    <p className="py-xl text-center text-[13px] text-muted">{COPY.loading.threads}</p>
                  ) : (
                    <ThreadsTable threads={threads} selectedThreadId={selectedThread?.threadId ?? null} onSelect={setSelectedThread} />
                  )}
                </div>
              </div>
            ) : null}

            {selectedThread ? (
              <div className="mt-lg">
                <h2 className="text-[16px] font-semibold text-fg">{threadEventsLabel}</h2>
                <div className="mt-sm">
                  {eventsError ? (
                    <div className="rounded-md border border-red/30 bg-red/5 p-md" role="alert">
                      <InlineFeedback variant="error" message={COPY.error.generic} />
                      <div className="mt-sm">
                        <ButtonSecondary onClick={() => void loadEvents(selectedThread.threadId, period, 0, false)}>{COPY.cta.retry}</ButtonSecondary>
                      </div>
                    </div>
                  ) : eventsLoading ? (
                    <p className="py-xl text-center text-[13px] text-muted">{COPY.loading.events}</p>
                  ) : (
                    <>
                      <EventsTable events={events} />
                      {eventsPage ? (
                        <div className="mt-sm flex flex-col items-center gap-xs">
                          <p className="text-[11.5px] text-muted">{COPY.eventsMeta(eventsTotalLoaded, eventsTotalLoaded + (eventsPage.hasMore ? THREAD_EVENTS_PAGE_SIZE : 0))}</p>
                          {eventsPage.hasMore ? (
                            <ButtonSecondary
                              loading={eventsLoadingMore}
                              loadingLabel={COPY.cta.loadingMore}
                              onClick={() => void loadEvents(selectedThread.threadId, period, eventsPage.offset + eventsPage.limit, true)}
                            >
                              {COPY.cta.loadMoreEvents}
                            </ButtonSecondary>
                          ) : null}
                        </div>
                      ) : null}
                    </>
                  )}
                </div>
              </div>
            ) : null}
          </>
        )}
      </div>

      <PricingSection
        pricing={pricing}
        unpricedModels={unpriced}
        loading={pricingLoading}
        error={pricingError}
        onRetry={() => void loadPricing()}
        onSaved={() => {
          void loadPricing()
          void loadSummaryAndProjects(period)
          // Um preço editado pode recalcular custos de eventos já carregados nas seções abertas
          // (recalculateNullCosts) — sem isto elas ficam com "— parcial" desatualizado até o
          // usuário reclicar o projeto/thread (achado no smoke visual real, spec F11 §6).
          if (selectedProject) void loadThreads(selectedProject.projectId, period)
          if (selectedThread) void loadEvents(selectedThread.threadId, period, 0, false)
        }}
      />
    </main>
  )
}
