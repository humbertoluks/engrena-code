import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { codegraphService, type CodegraphStatusResponse, type CodegraphUiStatus } from '../../services/codegraph-service'
import { InlineFeedback } from '../InlineFeedback'

const COPY = {
  sectionTitle: 'CodeGraph',
  badgeIndexed: (n: number) => `CodeGraph: indexado (${n}h atrás)`,
  badgeIndexing: 'CodeGraph: indexando…',
  badgeUnsupported: 'CodeGraph: não suportado',
  badgeAbsent: 'sem graph',
  badgeError: 'erro',
  panelLoading: 'Carregando status do graph…',
  panelIndexing: 'Indexando…',
  ctaGenerate: 'Gerar graph',
  ctaGenerateLoading: 'Iniciando build…',
  ctaReindex: 'Reindexar',
  ctaRetry: 'Tentar de novo',
  ctaRetryLoading: 'Tentando…',
  statsFiles: 'Arquivos',
  statsSymbols: 'Símbolos',
  statsIndexed: 'Indexado',
  errorNetwork: 'Não foi possível contatar o servidor local.',
  errorGeneric: 'Falha na ação do CodeGraph.',
  titleAbsent: 'CodeGraph ausente — clique para criar',
  titleBuilding: 'Indexação em andamento',
  titleReady: 'CodeGraph pronto — o agente consulta o grafo de símbolos',
  titleUnsupported: 'CodeGraph: não suportado',
} as const

const BADGE_BASE =
  'rounded-full border px-[8px] py-[1px] font-mono text-[10px] font-semibold'
const BADGE_CLASS: Record<string, string> = {
  missing: `${BADGE_BASE} border-border text-muted opacity-70`,
  indexing: `${BADGE_BASE} border-accent/40 bg-accent/10 text-accent animate-pulse`,
  indexed: `${BADGE_BASE} border-green/40 bg-green/10 text-green`,
  unsupported: `${BADGE_BASE} border-border text-muted`,
  error: `${BADGE_BASE} border-red/40 bg-red/10 text-red`,
}

const ROW_BTN =
  'w-full rounded-md px-xs py-[6px] text-left text-[12px] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'

function badgeLabel(status: CodegraphUiStatus | 'error', ageHours: number | null): string {
  switch (status) {
    case 'indexed':
      return COPY.badgeIndexed(ageHours ?? 0)
    case 'indexing':
      return COPY.badgeIndexing
    case 'unsupported':
      return COPY.badgeUnsupported
    case 'error':
      return COPY.badgeError
    default:
      return COPY.badgeAbsent
  }
}

function badgeTitle(status: CodegraphUiStatus | 'error'): string {
  switch (status) {
    case 'indexed':
      return COPY.titleReady
    case 'indexing':
      return COPY.titleBuilding
    case 'unsupported':
      return COPY.titleUnsupported
    default:
      return COPY.titleAbsent
  }
}

export interface CodegraphSectionProps {
  projectId: string
}

export function CodegraphSection({ projectId }: Readonly<CodegraphSectionProps>): ReactElement {
  const [status, setStatus] = useState<CodegraphStatusResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refresh = useCallback(async (): Promise<void> => {
    setLoading(true)
    setError(null)
    try {
      const res = await codegraphService.status(projectId)
      if (res.error) {
        setError(res.error.message || COPY.errorGeneric)
        setStatus(null)
      } else {
        setStatus(res)
      }
    } catch {
      setError(COPY.errorNetwork)
      setStatus(null)
    } finally {
      setLoading(false)
    }
  }, [projectId])

  useEffect(() => {
    void refresh()
  }, [refresh])

  const runReindex = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await codegraphService.reindex(projectId)
      if (res.error) {
        setError(res.error.message || COPY.errorGeneric)
      } else {
        setStatus(res)
      }
    } catch {
      setError(COPY.errorNetwork)
    } finally {
      setBusy(false)
    }
  }, [projectId])

  const uiStatus: CodegraphUiStatus | 'error' = error
    ? 'error'
    : (status?.status ?? 'missing')

  return (
    <details
      className="rounded-xl border border-border bg-[color-mix(in_srgb,var(--fg)_5%,var(--surface-2))]"
      open={uiStatus === 'missing' || uiStatus === 'error'}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-sm px-sm py-xs [&::-webkit-details-marker]:hidden">
        <span className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted open:text-fg group-open:text-fg">
          {COPY.sectionTitle}
        </span>
        <span
          className={BADGE_CLASS[uiStatus] ?? BADGE_CLASS.missing}
          data-codegraph-badge={uiStatus}
          title={badgeTitle(uiStatus)}
        >
          {loading && !status ? '…' : badgeLabel(uiStatus, status?.ageHours ?? null)}
        </span>
      </summary>

      <div className="border-t border-border px-sm py-sm">
        {loading && !status ? (
          <p className="font-mono text-[11px] text-muted">{COPY.panelLoading}</p>
        ) : null}

        {uiStatus === 'indexing' ? (
          <p className="text-[12px] text-fg">{COPY.panelIndexing}</p>
        ) : null}

        {error ? (
          <div role="alert" className="mb-xs">
            <InlineFeedback variant="error" message={error} />
            <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
              {busy ? COPY.ctaRetryLoading : COPY.ctaRetry}
            </button>
          </div>
        ) : null}

        {uiStatus === 'missing' && !error ? (
          <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
            {busy ? COPY.ctaGenerateLoading : COPY.ctaGenerate}
          </button>
        ) : null}

        {uiStatus === 'indexed' && status ? (
          <div className="flex flex-col gap-[4px]">
            <InfoRow label={COPY.statsFiles} value={String(status.fileCount)} />
            <InfoRow label={COPY.statsSymbols} value={String(status.symbolCount)} />
            <InfoRow
              label={COPY.statsIndexed}
              value={status.indexedAt ? new Date(status.indexedAt).toLocaleString() : '—'}
            />
            <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
              {busy ? COPY.ctaGenerateLoading : COPY.ctaReindex}
            </button>
          </div>
        ) : null}

        {uiStatus === 'unsupported' && status ? (
          <div className="flex flex-col gap-[4px]">
            <p className="text-[12px] text-muted">{COPY.badgeUnsupported}</p>
            <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
              {busy ? COPY.ctaGenerateLoading : COPY.ctaReindex}
            </button>
          </div>
        ) : null}
      </div>
    </details>
  )
}

function InfoRow({ label, value }: Readonly<{ label: string; value: string }>): ReactElement {
  return (
    <div className="flex items-center justify-between gap-sm text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-fg">{value}</span>
    </div>
  )
}
