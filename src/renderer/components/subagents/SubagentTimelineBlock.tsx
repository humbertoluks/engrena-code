import type { ReactElement } from 'react'
import type { SubagentRun } from '../../../services/db/repositories/subagents.js'
import { t } from './copy.js'

export interface SubagentTimelineBlockProps {
  run: SubagentRun
  onOpen: (run: SubagentRun) => void
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

/**
 * Bloco aninhado na timeline (F03 ChatHistory, peer). ChatHistory ainda não existe neste repo —
 * componente pronto para ser montado por linha de tool call assim que F03 existir; a tool
 * call_subagent correlacionada não deve duplicar no work log (vira cabeçalho deste bloco).
 */
export function SubagentTimelineBlock({ run, onOpen }: Readonly<SubagentTimelineBlockProps>): ReactElement {
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
      <span className="ml-auto text-muted">{timelineStatusLabel(run)}</span>
    </button>
  )
}
