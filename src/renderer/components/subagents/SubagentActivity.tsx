import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { SubagentRun } from '../../../services/db/repositories/subagents.js'
import { t } from './copy.js'
import { formatRunDuration, isActiveRunStatus } from './subagentRun.format.js'

export interface SubagentActivityProps {
  runs: SubagentRun[]
  onOpenRun: (run: SubagentRun) => void
}

function statusLabel(run: SubagentRun): string {
  switch (run.status) {
    case 'running':
      return t('subagentsRun.activity.status.running')
    case 'completed':
      return t('subagentsRun.activity.status.completed')
    case 'cancelled':
      return t('subagentsRun.activity.status.cancelled')
    case 'timeout':
      return t('subagentsRun.activity.status.timeout')
    default:
      return t('subagentsRun.activity.status.error')
  }
}

/** Timeout de idle usa tom âmbar do Design Lock (spec F15 §6/§3.2); demais status seguem a cor neutra padrão. */
function statusClassName(run: SubagentRun): string {
  return run.status === 'timeout' ? 'text-amber' : 'text-muted'
}

interface RunRowProps {
  run: SubagentRun
  now: number
  onOpen: () => void
}

function RunRow({ run, now, onOpen }: Readonly<RunRowProps>): ReactElement {
  return (
    <button
      type="button"
      onClick={onOpen}
      title={t('subagentsRun.activity.run.open', { provider: run.provider, model: run.model ?? '' })}
      className="flex w-full items-center justify-between gap-sm rounded-md px-sm py-xs text-left text-[12px] hover:bg-surface-2"
    >
      <span className="flex items-center gap-xs truncate">
        {isActiveRunStatus(run.status) ? (
          <span className="h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        <span className="truncate text-fg">{run.subagentName}</span>
        <span className="shrink-0 font-mono text-muted">{run.model ?? run.provider}</span>
      </span>
      <span className="flex shrink-0 items-center gap-xs font-mono text-muted">
        <span>{formatRunDuration(run.createdAt, run.durationMs, now)}</span>
        <span className={statusClassName(run)}>{statusLabel(run)}</span>
      </span>
    </button>
  )
}

export function SubagentActivity({ runs, onOpenRun }: Readonly<SubagentActivityProps>): ReactElement {
  const active = runs.filter((r) => isActiveRunStatus(r.status))
  const done = runs.filter((r) => !isActiveRunStatus(r.status))

  const [now, setNow] = useState(() => Date.now())
  useEffect(() => {
    if (active.length === 0) return
    const id = window.setInterval(() => setNow(Date.now()), 1000)
    return () => window.clearInterval(id)
  }, [active.length])

  return (
    <div className="rounded-xl border border-border bg-surface p-md">
      <div className="mb-sm flex items-center gap-xs text-[11px] font-semibold uppercase tracking-[0.04em] text-muted">
        {active.length > 0 ? (
          <span className="h-[6px] w-[6px] animate-pulse rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        {t('subagentsRun.activity.title')}
      </div>

      {runs.length === 0 ? (
        <p className="text-[12px] text-muted">{t('subagentsRun.activity.empty.none')}</p>
      ) : (
        <>
          <div className="mb-sm">
            <p className="mb-xs text-[11px] text-muted">{t('subagentsRun.activity.section.active')}</p>
            {active.length === 0 ? (
              <p className="text-[12px] text-muted">{t('subagentsRun.activity.empty.active')}</p>
            ) : (
              <div className="flex flex-col gap-[2px]">
                {active.map((run) => (
                  <RunRow key={run.childThreadId} run={run} now={now} onOpen={() => onOpenRun(run)} />
                ))}
              </div>
            )}
          </div>
          <div>
            <p className="mb-xs text-[11px] text-muted">
              {t('subagentsRun.activity.section.done', { N: done.length })}
            </p>
            {done.length === 0 ? (
              <p className="text-[12px] text-muted">{t('subagentsRun.activity.empty.done')}</p>
            ) : (
              <div className="flex flex-col gap-[2px]">
                {done.map((run) => (
                  <RunRow key={run.childThreadId} run={run} now={now} onOpen={() => onOpenRun(run)} />
                ))}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  )
}
