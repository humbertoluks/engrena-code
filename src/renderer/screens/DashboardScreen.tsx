import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { StatusDot } from '../components/StatusDot'
import type { DotVariant } from '../components/StatusDot'
import { MetricCard } from '../components/MetricCard'
import { Skeleton } from '../components/Skeleton'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { ButtonSecondary } from '../components/ButtonSecondary'
import { InlineFeedback } from '../components/InlineFeedback'
import { dashboardService } from '../services/dashboard-service'
import type {
  DashboardInboxItem,
  DashboardInboxKind,
  DashboardRecentItem,
  DashboardResponse,
  HealthDot,
  PromptDot,
} from '../services/dashboard-service'

const POLL_MS = 30_000

const COPY = {
  title: 'Dashboard',
  ctaRefresh: 'Atualizar',
  ctaCompleteSetup: 'Completar configuração',
  bannerSetupIncomplete: 'Configuração incompleta — conecte um provider e um token do GitHub para liberar todos os recursos.',
  sectionHealth: 'Saúde da configuração',
  healthClaude: 'Claude',
  healthClis: 'CLIs',
  healthGithub: 'GitHub',
  healthPrompt: 'prompt',
  cardProjects: 'Projetos',
  cardRunning: 'Running',
  cardPendingDiffs: 'Diffs pendentes',
  cardErrors: 'Erros',
  sectionInbox: 'Precisa da sua atenção',
  emptyInbox: 'Nada pendente…',
  emptyProjects: 'Adicione um projeto…',
  ctaAddProject: 'Adicionar projeto',
  sectionProjects: 'Projetos',
  sectionCatalog: 'Catálogo',
  catalogSkills: 'Skills',
  catalogRules: 'Rules',
  catalogSubagents: 'SubAgents',
  sectionRecent: 'Atividade recente',
  kindRunning: 'running',
  kindPendingDiff: 'diff pendente',
  kindError: 'erro',
  kindSetupIncomplete: 'setup incompleto',
  errorGeneric: 'Não foi possível carregar o dashboard.',
  errorNetwork: 'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
  ctaRetry: 'Tentar novamente',
} as const

const HEALTH_DOT_VARIANT: Record<HealthDot, DotVariant> = { ok: 'ok', warn: 'warn' }
const PROMPT_DOT_VARIANT: Record<PromptDot, DotVariant> = { ok: 'ok', off: 'off' }

const INBOX_BADGE_CLASS: Record<DashboardInboxKind, string> = {
  running: 'border-accent/40 bg-accent/10 text-accent-2',
  pendingDiff: 'border-amber/40 bg-amber/10 text-amber',
  error: 'border-red/40 bg-red/10 text-red',
  setupIncomplete: 'border-amber/40 bg-amber/10 text-amber',
}

const INBOX_KIND_LABEL: Record<DashboardInboxKind, string> = {
  running: COPY.kindRunning,
  pendingDiff: COPY.kindPendingDiff,
  error: COPY.kindError,
  setupIncomplete: COPY.kindSetupIncomplete,
}

function providerLabel(provider: string | null): string {
  if (provider === null) return ''
  return provider.charAt(0).toUpperCase() + provider.slice(1)
}

function relativeAge(ts: number): string {
  const diffMs = Date.now() - ts
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min atrás`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h atrás`
  const days = Math.floor(hours / 24)
  return `${days}d atrás`
}

function navigateToWorkspace(projectId: string | null, threadId: string | null, tab: 'diff' | 'history'): void {
  const params = new URLSearchParams()
  if (projectId) params.set('project', projectId)
  if (threadId) params.set('thread', threadId)
  params.set('tab', tab)
  window.location.hash = `#principal?${params.toString()}`
}

function navigateToProject(projectId: string): void {
  window.location.hash = `#principal?${new URLSearchParams({ project: projectId }).toString()}`
}

function inboxDestinationTab(kind: DashboardInboxKind): 'diff' | 'history' {
  return kind === 'pendingDiff' ? 'diff' : 'history'
}

function InboxRow({ item, onNavigate }: Readonly<{ item: DashboardInboxItem; onNavigate: () => void }>): ReactElement {
  if (item.kind === 'setupIncomplete') {
    return (
      <button
        type="button"
        onClick={onNavigate}
        className="flex w-full items-center gap-sm border-b border-border/60 px-md py-sm text-left hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent"
      >
        <span className={`rounded-sm border px-sm py-[2px] font-mono text-[10.5px] ${INBOX_BADGE_CLASS.setupIncomplete}`}>
          {INBOX_KIND_LABEL.setupIncomplete}
        </span>
        <span className="text-[13px] text-fg">{COPY.ctaCompleteSetup}</span>
      </button>
    )
  }

  return (
    <button
      type="button"
      onClick={onNavigate}
      className="flex w-full items-center gap-sm border-b border-border/60 px-md py-sm text-left hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className={`rounded-sm border px-sm py-[2px] font-mono text-[10.5px] ${INBOX_BADGE_CLASS[item.kind]}`}>
        {INBOX_KIND_LABEL[item.kind]}
      </span>
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
        {item.projectName} · {item.title ?? item.threadId}
      </span>
      <span className="flex-shrink-0 text-[11.5px] text-muted">
        {providerLabel(item.provider)} · {item.updatedAt !== null ? relativeAge(item.updatedAt) : ''}
      </span>
    </button>
  )
}

function RecentRow({ item, onNavigate }: Readonly<{ item: DashboardRecentItem; onNavigate: () => void }>): ReactElement {
  return (
    <button
      type="button"
      onClick={onNavigate}
      className="flex w-full items-center gap-sm border-b border-border/60 px-md py-sm text-left hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent"
    >
      <span className="min-w-0 flex-1 truncate text-[13px] text-fg">
        {item.projectName} · {item.title ?? item.threadId}
      </span>
      <span className="flex-shrink-0 text-[11.5px] text-muted">
        {providerLabel(item.provider)} · {item.state} · {relativeAge(item.updatedAt)}
      </span>
    </button>
  )
}

function DashboardSkeleton(): ReactElement {
  return (
    <div className="space-y-md">
      <Skeleton className="h-[64px] w-full" />
      <div className="grid grid-cols-2 gap-md lg:grid-cols-4">
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
        <Skeleton className="h-[72px] w-full" />
      </div>
      <Skeleton className="h-[160px] w-full" />
      <Skeleton className="h-[160px] w-full" />
    </div>
  )
}

export function DashboardScreen(): ReactElement {
  const [data, setData] = useState<DashboardResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [error, setError] = useState<'generic' | 'network' | null>(null)

  const load = useCallback(async (isRefresh: boolean) => {
    if (isRefresh) setRefreshing(true)
    else setLoading(true)
    setError(null)
    try {
      const res = await dashboardService.getDashboard()
      if ('error' in res) {
        setError('generic')
      } else {
        setData(res)
      }
    } catch {
      setError('network')
    } finally {
      if (isRefresh) setRefreshing(false)
      else setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load(false)
    const interval = setInterval(() => {
      if (document.hidden) return
      void load(true)
    }, POLL_MS)
    return () => clearInterval(interval)
  }, [load])

  if (loading) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-lg py-lg">
        <DashboardSkeleton />
      </main>
    )
  }

  if (error !== null && data === null) {
    return (
      <main className="mx-auto w-full max-w-[1240px] px-lg py-lg">
        <div className="rounded-md border border-red/30 bg-red/5 p-md" role="alert">
          <InlineFeedback variant="error" message={error === 'network' ? COPY.errorNetwork : COPY.errorGeneric} />
          <div className="mt-sm">
            <ButtonSecondary onClick={() => void load(false)}>{COPY.ctaRetry}</ButtonSecondary>
          </div>
        </div>
      </main>
    )
  }

  if (data === null) return <main className="mx-auto w-full max-w-[1240px] px-lg py-lg" />

  return (
    <main className="mx-auto w-full max-w-[1240px] px-lg py-lg">
      <div className="flex items-center justify-between">
        <h1 className="text-[26px] font-bold tracking-tight text-fg">{COPY.title}</h1>
        <ButtonSecondary loading={refreshing} onClick={() => void load(true)}>
          {COPY.ctaRefresh}
        </ButtonSecondary>
      </div>

      {error !== null ? (
        <div className="mt-md rounded-md border border-red/30 bg-red/5 p-md" role="alert">
          <InlineFeedback variant="error" message={error === 'network' ? COPY.errorNetwork : COPY.errorGeneric} />
        </div>
      ) : null}

      {data.health.setupIncomplete ? (
        <div className="mt-md flex items-center justify-between gap-md rounded-md border border-amber/30 bg-amber/5 p-md">
          <p className="text-[13px] text-fg">{COPY.bannerSetupIncomplete}</p>
          <ButtonPrimary onClick={() => { window.location.hash = '#configuracao' }}>
            {COPY.ctaCompleteSetup}
          </ButtonPrimary>
        </div>
      ) : null}

      <div className="mt-md">
        <button
          type="button"
          onClick={() => { window.location.hash = '#configuracao' }}
          className="w-full rounded-lg border border-border bg-surface p-md text-left"
        >
          <p className="mb-sm text-[15px] font-semibold text-fg">{COPY.sectionHealth}</p>
          <div className="flex flex-wrap gap-lg">
            <span className="flex items-center gap-xs text-[12.5px] text-muted">
              <StatusDot variant={HEALTH_DOT_VARIANT[data.health.claude]} />
              {COPY.healthClaude}
            </span>
            <span className="flex items-center gap-xs text-[12.5px] text-muted">
              <StatusDot variant={HEALTH_DOT_VARIANT[data.health.clis]} />
              {COPY.healthClis}
            </span>
            <span className="flex items-center gap-xs text-[12.5px] text-muted">
              <StatusDot variant={HEALTH_DOT_VARIANT[data.health.github]} />
              {COPY.healthGithub}
            </span>
            <span className="flex items-center gap-xs text-[12.5px] text-muted">
              <StatusDot variant={PROMPT_DOT_VARIANT[data.health.prompt]} />
              {COPY.healthPrompt}
            </span>
          </div>
        </button>
      </div>

      <div className="mt-md grid grid-cols-2 gap-md lg:grid-cols-4">
        <MetricCard label={COPY.cardProjects} value={data.metrics.projects} />
        <MetricCard label={COPY.cardRunning} value={data.metrics.running} />
        <MetricCard label={COPY.cardPendingDiffs} value={data.metrics.pendingDiffs} />
        <MetricCard label={COPY.cardErrors} value={data.metrics.errors} />
      </div>

      <div className="mt-md">
        <h2 className="mb-sm text-[16px] font-semibold text-fg">{COPY.sectionInbox}</h2>
        {data.inbox.length === 0 ? (
          <p className="text-[13px] text-muted">{COPY.emptyInbox}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {data.inbox.map((item) => (
              <InboxRow
                key={item.kind === 'setupIncomplete' ? 'setup-incomplete' : item.threadId}
                item={item}
                onNavigate={() =>
                  item.kind === 'setupIncomplete'
                    ? (window.location.hash = '#configuracao')
                    : navigateToWorkspace(item.projectId, item.threadId, inboxDestinationTab(item.kind))
                }
              />
            ))}
          </div>
        )}
      </div>

      <div className="mt-md">
        <h2 className="mb-sm text-[16px] font-semibold text-fg">{COPY.sectionProjects}</h2>
        {data.projects.length === 0 ? (
          <div className="rounded-lg border border-border bg-surface p-lg text-center">
            <p className="mb-sm text-[13px] text-muted">{COPY.emptyProjects}</p>
            <ButtonSecondary onClick={() => { window.location.hash = '#principal' }}>
              {COPY.ctaAddProject}
            </ButtonSecondary>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-md sm:grid-cols-2 lg:grid-cols-3">
            {data.projects.map((project) => (
              <button
                key={project.id}
                type="button"
                onClick={() => navigateToProject(project.id)}
                className="rounded-lg border border-border bg-surface p-md text-left hover:bg-surface-2/60 focus-visible:ring-2 focus-visible:ring-accent"
              >
                <p className="truncate text-[14px] font-semibold text-fg">{project.name}</p>
                <p className="mt-xs truncate text-[11.5px] text-muted">{project.path}</p>
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="mt-md">
        <h2 className="mb-sm text-[16px] font-semibold text-fg">{COPY.sectionCatalog}</h2>
        <div className="grid grid-cols-3 gap-md">
          <button
            type="button"
            onClick={() => { window.location.hash = '#skills' }}
            className="rounded-lg border border-border bg-surface p-md text-left hover:bg-surface-2/60"
          >
            <p className="text-[20px] font-semibold text-fg">{data.catalog.skills}</p>
            <p className="text-[11.5px] text-muted">{COPY.catalogSkills}</p>
          </button>
          <button
            type="button"
            onClick={() => { window.location.hash = '#rules' }}
            className="rounded-lg border border-border bg-surface p-md text-left hover:bg-surface-2/60"
          >
            <p className="text-[20px] font-semibold text-fg">{data.catalog.rules}</p>
            <p className="text-[11.5px] text-muted">{COPY.catalogRules}</p>
          </button>
          <button
            type="button"
            onClick={() => { window.location.hash = '#subagents' }}
            className="rounded-lg border border-border bg-surface p-md text-left hover:bg-surface-2/60"
          >
            <p className="text-[20px] font-semibold text-fg">{data.catalog.subagents}</p>
            <p className="text-[11.5px] text-muted">{COPY.catalogSubagents}</p>
          </button>
        </div>
      </div>

      <div className="mt-md">
        <h2 className="mb-sm text-[16px] font-semibold text-fg">{COPY.sectionRecent}</h2>
        {data.recent.length === 0 ? (
          <p className="text-[13px] text-muted">{COPY.emptyInbox}</p>
        ) : (
          <div className="overflow-hidden rounded-lg border border-border bg-surface">
            {data.recent.map((item) => (
              <RecentRow
                key={item.threadId}
                item={item}
                onNavigate={() => navigateToWorkspace(item.projectId, item.threadId, 'history')}
              />
            ))}
          </div>
        )}
      </div>
    </main>
  )
}
