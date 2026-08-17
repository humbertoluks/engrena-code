import type { ReactElement } from 'react'
import type { SubagentRun } from '../../services/subagents-service'
import { activityLabelForTool } from '../workspace/chatHistory.logic'
import type { ChildToolActivity } from '../workspace/graph/executionGraph.logic'
import { t } from './copy.js'

export interface SubagentTimelineBlockProps {
  run: SubagentRun
  onOpen: (run: SubagentRun) => void
  /** Atividade ao vivo do filho (F29); ausente antes da primeira tool ou depois do run fechar. */
  activity?: ChildToolActivity | null
}

function timelineStatusLabel(run: SubagentRun): string {
  switch (run.status) {
    case 'running':
      return t('subagentsRun.timeline.status.running')
    case 'completed':
      return t('subagentsRun.timeline.status.completed')
    case 'cancelled':
      return t('subagentsRun.timeline.status.cancelled')
    case 'timeout':
      return t('subagentsRun.timeline.status.timeout')
    default:
      return t('subagentsRun.timeline.status.error')
  }
}

/** Timeout de idle usa tom âmbar do Design Lock (spec F15 §6/§3.2). */
function timelineStatusClassName(run: SubagentRun): string {
  return run.status === 'timeout' ? 'text-amber' : 'text-muted'
}

/**
 * Enquanto o filho roda, o status "trabalhando…" cede lugar ao que ele faz agora (F29): rótulo
 * derivado da tool (`activityLabelForTool`, o mesmo do shimmer do pai), nunca o nome cru. Com o
 * run fechado o status volta, porque a atividade ao vivo não sobrevive ao refresh.
 */
function liveActivityLabel(run: SubagentRun, activity: ChildToolActivity | null): string | null {
  if (run.status !== 'running' || !activity?.currentName) return null
  return activityLabelForTool(activity.currentName)
}

/**
 * Bloco aninhado na timeline (ChatHistory.tsx) — substitui a linha genérica de tool call quando
 * `call_subagent` é correlacionado a um `subagent_runs` (spec F15 §3.2), sem duplicar no work log.
 */
export function SubagentTimelineBlock({
  run,
  onOpen,
  activity = null,
}: Readonly<SubagentTimelineBlockProps>): ReactElement {
  const liveLabel = liveActivityLabel(run, activity)
  // A contagem ao vivo passa à frente enquanto roda: `action_count` só é gravado no fechamento.
  const toolCount = run.status === 'running' ? Math.max(run.actionCount, activity?.count ?? 0) : run.actionCount
  return (
    <button
      type="button"
      onClick={() => onOpen(run)}
      title={t('subagentsRun.timeline.open')}
      className="flex w-full items-center gap-sm rounded-md border border-border bg-surface-2/30 px-md py-sm text-left text-[12.5px] hover:bg-surface-2"
    >
      <span className="font-medium text-fg">{run.subagentName}</span>
      <span className="font-mono text-muted">
        {run.provider}
        {run.model ? `/${run.model}` : ''}
      </span>
      {toolCount > 0 ? (
        <span className="text-muted">
          {toolCount === 1
            ? t('subagentsRun.timeline.tools.one')
            : t('subagentsRun.timeline.tools', { N: toolCount })}
        </span>
      ) : null}
      <span className={`ml-auto ${timelineStatusClassName(run)}`}>
        {liveLabel ?? timelineStatusLabel(run)}
        {liveLabel ? '…' : ''}
      </span>
    </button>
  )
}
