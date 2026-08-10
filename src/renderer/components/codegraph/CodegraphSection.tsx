import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { codegraphService, type CodegraphStatusResponse, type CodegraphUiStatus } from '../../services/codegraph-service'
import { InlineFeedback } from '../InlineFeedback'
import { SidebarSection } from '../workspace/SidebarSection'
import { badgeLabel, badgeTitle } from './codegraphSection.logic'

const COPY = {
  sectionTitle: 'CodeGraph',
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
  badgeUnsupported: 'Linguagem não suportada para graph neste projeto.',
  errorNetwork: 'Não foi possível contatar o servidor local.',
  errorGeneric: 'Falha na ação do CodeGraph.',
} as const

const BADGE_BASE =
  'rounded-full border px-[8px] py-[1px] font-mono text-[10px] font-semibold normal-case tracking-normal'
const BADGE_CLASS: Record<string, string> = {
  missing: `${BADGE_BASE} border-border text-muted opacity-70`,
  indexing: `${BADGE_BASE} border-accent/40 bg-accent/10 text-accent animate-pulse`,
  indexed: `${BADGE_BASE} border-green/40 bg-green/10 text-green`,
  unsupported: `${BADGE_BASE} border-border text-muted`,
  error: `${BADGE_BASE} border-red/40 bg-red/10 text-red`,
}

const ROW_BTN =
  'w-full rounded-md px-sm py-[6px] text-left text-[12px] hover:bg-[color-mix(in_srgb,var(--fg)_6%,transparent)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50'

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

  const uiStatus: CodegraphUiStatus | 'error' = error ? 'error' : (status?.status ?? 'missing')
  const defaultOpen = uiStatus === 'missing' || uiStatus === 'error'

  const badge = (
    <span
      className={BADGE_CLASS[uiStatus] ?? BADGE_CLASS.missing}
      data-codegraph-badge={uiStatus}
      title={badgeTitle(uiStatus)}
    >
      {loading && !status ? '…' : badgeLabel(uiStatus, status?.ageHours ?? null)}
    </span>
  )

  return (
    <SidebarSection
      title={COPY.sectionTitle}
      icon={<GraphIcon />}
      trailing={badge}
      collapsible
      defaultOpen={defaultOpen}
    >
      {loading && !status ? (
        <p className="m-0 px-sm py-[4px] font-mono text-[11px] text-muted">{COPY.panelLoading}</p>
      ) : null}

      {uiStatus === 'indexing' ? (
        <p className="m-0 px-sm py-[4px] text-[12px] text-fg">{COPY.panelIndexing}</p>
      ) : null}

      {error ? (
        <div role="alert" className="px-sm py-[2px]">
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
        <div className="flex flex-col gap-[2px]">
          <StatRow label={COPY.statsFiles} value={String(status.fileCount)} />
          <StatRow label={COPY.statsSymbols} value={String(status.symbolCount)} />
          <StatRow
            label={COPY.statsIndexed}
            value={status.indexedAt ? new Date(status.indexedAt).toLocaleString() : '—'}
          />
          <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
            {busy ? COPY.ctaGenerateLoading : COPY.ctaReindex}
          </button>
        </div>
      ) : null}

      {uiStatus === 'unsupported' && status ? (
        <div className="flex flex-col gap-[2px]">
          <p className="m-0 px-sm py-[4px] text-[12px] text-muted">{COPY.badgeUnsupported}</p>
          <button type="button" className={ROW_BTN} disabled={busy} onClick={() => void runReindex()}>
            {busy ? COPY.ctaGenerateLoading : COPY.ctaReindex}
          </button>
        </div>
      ) : null}
    </SidebarSection>
  )
}

function StatRow({ label, value }: Readonly<{ label: string; value: string }>): ReactElement {
  return (
    <div className="flex items-center justify-between gap-sm px-sm py-[4px] text-[11.5px]">
      <span className="text-muted">{label}</span>
      <span className="font-mono text-fg">{value}</span>
    </div>
  )
}

function GraphIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-[13px] w-[13px]"
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="6" cy="6" r="2.5" />
      <circle cx="18" cy="8" r="2.5" />
      <circle cx="10" cy="18" r="2.5" />
      <path d="M8 7.5 16 9M7.5 8.5 9.5 15.5M16.5 10.5 11.5 16.5" />
    </svg>
  )
}
