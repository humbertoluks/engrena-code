import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import type { SubagentRun } from '../../services/subagents-service'
import { t } from './copy.js'
import { formatRunDuration, isActiveRunStatus, resolveLatestParallelBatch } from './subagentRun.format.js'

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
      <span className="flex min-w-0 flex-1 items-center gap-xs">
        {isActiveRunStatus(run.status) ? (
          <span className="h-[6px] w-[6px] shrink-0 animate-pulse rounded-full bg-accent" aria-hidden="true" />
        ) : null}
        <span className="min-w-0 flex-1 truncate text-fg">{run.subagentName}</span>
        {run.parallelBatchId !== null ? (
          <span
            className="shrink-0 rounded-sm border border-border bg-surface-2 px-[6px] text-[10px] uppercase text-muted"
            title={t('subagentsRun.isolation.worktree.title')}
          >
            {t('subagentsRun.isolation.worktree')}
          </span>
        ) : (
          // Anatomia F18 (ui.md §A.5) só lista nome · badge worktree · ação/relógio · status pra
          // filho de batch paralelo — modelo cabe no path serial F15, onde a row não disputa espaço
          // com o badge.
          <span className="shrink-0 font-mono text-muted">{run.model ?? run.provider}</span>
        )}
      </span>
      <span className="flex shrink-0 items-center gap-xs font-mono text-muted">
        <span>{formatRunDuration(run.createdAt, run.durationMs, now)}</span>
        {/* Row de filho paralelo some com o texto de status enquanto roda (ui.md §A.5: "omitido na
            row enquanto running, só pulso") — abre espaço pro badge worktree sem cortar o nome. */}
        {run.parallelBatchId !== null && isActiveRunStatus(run.status) ? null : (
          <span className={statusClassName(run)}>{statusLabel(run)}</span>
        )}
      </span>
    </button>
  )
}

export function SubagentActivity({ runs, onOpenRun }: Readonly<SubagentActivityProps>): ReactElement {
  const active = runs.filter((r) => isActiveRunStatus(r.status))
  const done = runs.filter((r) => !isActiveRunStatus(r.status))
  const latestBatch = resolveLatestParallelBatch(runs)

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

      {latestBatch !== null ? (
        <p role="status" className="mb-sm rounded-sm border border-border bg-surface px-sm py-xs text-[11.5px] text-muted">
          {t('wp.activity.aggregate', {
            done: latestBatch.done,
            total: latestBatch.total,
            running: latestBatch.running,
            failed: latestBatch.failed,
          })}
        </p>
      ) : null}

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
