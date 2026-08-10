import { useState } from 'react'
import type { ReactElement } from 'react'
import type { PipelineHistory, PipelineStageStatus, PipelineStatus } from '../../services/threads-service'

const CHECKPOINT_ANSWER: { selectedOptions: string[]; freeText: string | null } = {
  selectedOptions: ['continuar'],
  freeText: null,
}

const COPY = {
  header: 'Pipeline',
  aria: 'Pipeline de feature',
  expand: 'Expandir pipeline',
  collapse: 'Recolher pipeline',
  statusRunning: 'executando',
  statusAwaiting: 'aguardando aprovação',
  statusError: 'erro',
  statusDone: 'concluído',
  statusCancelled: 'cancelado',
  statusTimeout: 'timeout',
  ctaCheckpoint: 'Continuar após revisar diffs',
  hintCheckpoint: 'Revise os diffs acumulados no painel Diff antes de continuar o pipeline.',
  ctaCheckpointLoading: 'Continuando…',
  ctaCancel: 'Cancelar pipeline',
  stagePending: 'pendente',
  stageSkipped: 'ignorado',
} as const

const STATUS_LABEL: Record<PipelineStatus, string> = {
  running: COPY.statusRunning,
  waiting_checkpoint: COPY.statusAwaiting,
  completed: COPY.statusDone,
  failed: COPY.statusError,
  timeout: COPY.statusTimeout,
  cancelled: COPY.statusCancelled,
}

const STATUS_CLASS: Record<PipelineStatus, string> = {
  running: 'text-accent',
  waiting_checkpoint: 'text-amber',
  completed: 'text-green',
  failed: 'text-red',
  timeout: 'text-amber',
  cancelled: 'text-muted',
}

const STAGE_LABEL: Record<string, string> = {
  planner: 'Planejar · planner',
  implementer: 'Implementar · implementer',
  reviewer: 'Revisar · reviewer',
  tester: 'Testar · tester',
}

const STAGE_STATUS_CLASS: Record<PipelineStageStatus, string> = {
  pending: 'text-muted',
  running: 'text-accent',
  completed: 'text-green',
  failed: 'text-red',
  timeout: 'text-amber',
  skipped: 'text-muted',
}

// Reusa o vocabulário de `pipeline.status.*` (copy.md não define labels próprias por estágio).
const STAGE_STATUS_LABEL: Record<PipelineStageStatus, string> = {
  pending: COPY.stagePending,
  running: COPY.statusRunning,
  completed: COPY.statusDone,
  failed: COPY.statusError,
  timeout: COPY.statusTimeout,
  skipped: COPY.stageSkipped,
}

export interface PipelinePanelProps {
  pipeline: PipelineHistory
  onAnswer: (input: { selectedOptions: string[]; freeText: string | null }) => void
  answerBusy: boolean
  answerError: string | null
  onCancel: () => void
}

export function PipelinePanel({
  pipeline,
  onAnswer,
  answerBusy,
  answerError,
  onCancel,
}: Readonly<PipelinePanelProps>): ReactElement {
  const [expanded, setExpanded] = useState(true)

  const { pipeline: p, stages } = pipeline
  const done = stages.filter((s) => s.status === 'completed').length

  return (
    <div className="rounded-xl border border-border bg-surface p-md">
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        aria-expanded={expanded}
        title={expanded ? COPY.collapse : COPY.expand}
        className="flex w-full items-center justify-between gap-xs text-[10.5px] font-bold uppercase tracking-[0.07em] text-muted"
      >
        <span>
          ◈ {COPY.header} · {done}/{stages.length}
        </span>
        <span aria-hidden="true">{expanded ? '▾' : '▸'}</span>
      </button>

      {expanded ? (
        <div className="mt-sm flex flex-col gap-sm" aria-label={COPY.aria}>
          <div className="flex items-center justify-between gap-xs">
            <p className="truncate text-[12px] text-fg" title={p.argsText}>
              {p.argsText}
            </p>
            <span className={`shrink-0 text-[9.5px] uppercase ${STATUS_CLASS[p.status]}`}>{STATUS_LABEL[p.status]}</span>
          </div>

          <div className="flex flex-col gap-[3px]">
            {stages.map((stage) => (
              <div key={stage.id} className="flex items-center justify-between gap-xs text-[12px]">
                <span className="truncate text-fg">{STAGE_LABEL[stage.stageId] ?? stage.stageId}</span>
                <span className={`shrink-0 text-[10.5px] ${STAGE_STATUS_CLASS[stage.status]}`}>{STAGE_STATUS_LABEL[stage.status]}</span>
              </div>
            ))}
          </div>

          {p.status === 'failed' && p.errorMessage ? (
            <p role="alert" className="text-[11.5px] text-red">
              {p.errorMessage}
            </p>
          ) : null}
          {p.status === 'waiting_checkpoint' && answerError !== null ? (
            <p role="alert" className="text-[11.5px] text-red">
              {answerError}
            </p>
          ) : null}

          {p.status === 'waiting_checkpoint' ? (
            <div className="flex flex-col gap-xs">
              <p className="text-[11px] text-muted">{COPY.hintCheckpoint}</p>
              <button
                type="button"
                disabled={answerBusy}
                onClick={() => onAnswer(CHECKPOINT_ANSWER)}
                className="rounded-md bg-accent px-sm py-xs text-[12px] font-medium text-white disabled:opacity-50"
              >
                {answerBusy ? COPY.ctaCheckpointLoading : COPY.ctaCheckpoint}
              </button>
            </div>
          ) : null}

          {p.status === 'running' || p.status === 'waiting_checkpoint' ? (
            <button
              type="button"
              onClick={onCancel}
              className="self-start rounded-md border border-border bg-surface-2 px-sm py-[3px] text-[11px] text-muted hover:bg-surface"
            >
              {COPY.ctaCancel}
            </button>
          ) : null}
        </div>
      ) : null}
    </div>
  )
}
