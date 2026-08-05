import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { Skeleton } from './Skeleton'
import { InlineFeedback } from './InlineFeedback'
import { ButtonSecondary } from './ButtonSecondary'
import { logsService } from '../services/logs-service'
import type { LogEntry, LogKind } from '../services/logs-service'

const COPY = {
  filterAria: 'Filtrar registros por tipo',
  filterAll: 'Todos',
  filterTask: 'Tasks',
  filterTool: 'Tool calls',
  filterGit: 'Git flow',
  colQuando: 'Quando',
  colTipo: 'Tipo',
  colEvento: 'Evento',
  colThread: 'Thread',
  kindTask: 'Task',
  kindTool: 'Tool call',
  kindGit: 'Git flow',
  emptyNone: 'Nenhum registro ainda',
  emptyFiltered: 'Nenhum registro para este filtro',
  ctaLoadMore: 'Carregar mais',
  ctaLoadingMore: 'Carregando...',
  ctaRetry: 'Tentar novamente',
  errorGeneric: 'Não foi possível carregar os registros.',
  errorNetwork: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
  threadOpenAria: (threadId: string) => `Abrir thread ${threadId} no workspace`,
} as const

type FilterValue = 'all' | LogKind

const FILTERS: Array<{ value: FilterValue; label: string }> = [
  { value: 'all', label: COPY.filterAll },
  { value: 'task', label: COPY.filterTask },
  { value: 'tool', label: COPY.filterTool },
  { value: 'git', label: COPY.filterGit },
]

const KIND_BADGE_CLASS: Record<LogKind, string> = {
  task: 'border-accent/40 bg-accent/10 text-accent-2',
  tool: 'border-amber/40 bg-amber/10 text-amber',
  git: 'border-green/40 bg-green/10 text-green',
}

const KIND_LABEL: Record<LogKind, string> = {
  task: COPY.kindTask,
  tool: COPY.kindTool,
  git: COPY.kindGit,
}

function formatTimestamp(createdAt: number): string {
  return new Date(createdAt).toLocaleString('pt-BR')
}

function navigateToThread(projectId: string, threadId: string): void {
  const params = new URLSearchParams({ project: projectId, thread: threadId, tab: 'history' })
  window.location.hash = `#principal?${params.toString()}`
}

function FilterChip({ active, label, onClick }: Readonly<{ active: boolean; label: string; onClick: () => void }>): ReactElement {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={
        active
          ? 'rounded-[20px] border border-accent bg-accent/10 px-md py-xs text-[12.5px] font-medium text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
          : 'rounded-[20px] border border-border bg-surface px-md py-xs text-[12.5px] font-medium text-fg/80 hover:border-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'
      }
    >
      {label}
    </button>
  )
}

function TableSkeleton(): ReactElement {
  return (
    <div className="space-y-xs p-md">
      {Array.from({ length: 6 }).map((_, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: skeleton rows have no identity
        <Skeleton key={i} className="h-[28px] w-full" />
      ))}
    </div>
  )
}

export function LogTable(): ReactElement {
  const [filter, setFilter] = useState<FilterValue>('all')
  const [entries, setEntries] = useState<LogEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<'generic' | 'network' | null>(null)
  const [lastPageSize, setLastPageSize] = useState(0)

  const load = useCallback(async (kind: FilterValue, offset: number, isMore: boolean) => {
    if (isMore) setLoadingMore(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await logsService.getLogs({ kind: kind === 'all' ? undefined : kind, offset })
      if ('error' in res) {
        setError('generic')
      } else {
        setEntries((prev) => (isMore ? [...prev, ...res.entries] : res.entries))
        setLastPageSize(res.entries.length)
      }
    } catch {
      setError('network')
    } finally {
      if (isMore) setLoadingMore(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(filter, 0, false)
  }, [filter, load])

  const hasMore = error === null && !loading && lastPageSize === logsService.PAGE_SIZE

  return (
    <div>
      <div role="group" aria-label={COPY.filterAria} className="mb-md flex flex-wrap gap-sm">
        {FILTERS.map((f) => (
          <FilterChip key={f.value} active={filter === f.value} label={f.label} onClick={() => setFilter(f.value)} />
        ))}
      </div>

      {error !== null ? (
        <div className="rounded-md border border-red/40 bg-red/5 p-md" role="alert">
          <InlineFeedback variant="error" message={error === 'network' ? COPY.errorNetwork : COPY.errorGeneric} />
          <div className="mt-sm">
            <ButtonSecondary onClick={() => void load(filter, 0, false)}>{COPY.ctaRetry}</ButtonSecondary>
          </div>
        </div>
      ) : (
        <div className="overflow-hidden rounded-md border border-border">
          <table className="w-full border-collapse">
            <thead>
              <tr>
                <th className="border-b border-border bg-surface-2 px-md py-sm text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {COPY.colQuando}
                </th>
                <th className="border-b border-border bg-surface-2 px-md py-sm text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {COPY.colTipo}
                </th>
                <th className="border-b border-border bg-surface-2 px-md py-sm text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {COPY.colEvento}
                </th>
                <th className="border-b border-border bg-surface-2 px-md py-sm text-left text-[11px] font-semibold uppercase tracking-[0.05em] text-muted">
                  {COPY.colThread}
                </th>
              </tr>
            </thead>
            <tbody>
              {loading ? null : entries.length === 0 ? null : (
                entries.map((entry) => (
                  <tr key={entry.id} className="border-b border-border/60 hover:bg-surface">
                    <td className="px-md py-sm font-mono text-[11.5px] text-muted">{formatTimestamp(entry.createdAt)}</td>
                    <td className="px-md py-sm">
                      <span className={`rounded-sm border px-sm py-[2px] font-mono text-[10.5px] ${KIND_BADGE_CLASS[entry.kind]}`}>
                        {KIND_LABEL[entry.kind]}
                      </span>
                    </td>
                    <td className="px-md py-sm text-[13px] font-medium text-fg">{entry.event}</td>
                    <td className="px-md py-sm">
                      <button
                        type="button"
                        aria-label={COPY.threadOpenAria(entry.threadId)}
                        onClick={() => navigateToThread(entry.projectId, entry.threadId)}
                        className="font-mono text-[12px] text-fg/70 hover:text-accent-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                      >
                        {entry.threadId}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>

          {loading ? (
            <TableSkeleton />
          ) : entries.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-lg text-center">
              <p className="max-w-[280px] text-[13px] text-muted">
                {filter === 'all' ? COPY.emptyNone : COPY.emptyFiltered}
              </p>
            </div>
          ) : null}
        </div>
      )}

      {hasMore ? (
        <div className="mt-md flex justify-center">
          <ButtonSecondary loading={loadingMore} loadingLabel={COPY.ctaLoadingMore} onClick={() => void load(filter, entries.length, true)}>
            {COPY.ctaLoadMore}
          </ButtonSecondary>
        </div>
      ) : null}
    </div>
  )
}
