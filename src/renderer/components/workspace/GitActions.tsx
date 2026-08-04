import { useState } from 'react'
import type { ReactElement } from 'react'
import type { VcsStatus } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'

const COPY = {
  section: 'Repositório',
  hintNoThread: 'Abra uma thread para executar ações de git',
  hintDetached: 'HEAD destacada — faça checkout de uma branch antes.',
  hintClean: 'Tudo em dia — nada a commitar ou pushar.',
  quickCommit: 'Commit',
  quickCommitPush: 'Commit & push',
  quickPush: 'Push',
  stageCommitting: 'Commitando…',
  stagePushing: 'Pushando…',
  placeholderSubject: 'Mensagem do commit',
} as const

export interface GitActionsProps {
  vcsStatus: VcsStatus | null
  selectedThread: Thread | null
  onCommit: (subject: string) => Promise<{ ok: boolean; error?: string }>
  onPush: () => Promise<{ ok: boolean; error?: string }>
}

export function GitActions({ vcsStatus, selectedThread, onCommit, onPush }: Readonly<GitActionsProps>): ReactElement {
  const [subject, setSubject] = useState('')
  const [stage, setStage] = useState<'commit' | 'push' | null>(null)
  const [error, setError] = useState<string | null>(null)

  const busy = selectedThread?.state === 'running' || selectedThread?.state === 'stopping' || stage !== null
  const noThread = selectedThread === null

  async function handleCommit(andPush: boolean): Promise<void> {
    if (subject.trim() === '') return
    setError(null)
    setStage('commit')
    const commitResult = await onCommit(subject.trim())
    if (!commitResult.ok) {
      setError(commitResult.error ?? null)
      setStage(null)
      return
    }
    setSubject('')

    if (andPush) {
      setStage('push')
      const pushResult = await onPush()
      if (!pushResult.ok) setError(pushResult.error ?? null)
    }
    setStage(null)
  }

  async function handlePush(): Promise<void> {
    setError(null)
    setStage('push')
    const result = await onPush()
    if (!result.ok) setError(result.error ?? null)
    setStage(null)
  }

  return (
    <div>
      <h3 className="mb-xs text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.section}</h3>

      {noThread ? (
        <p className="text-[12px] text-muted">{COPY.hintNoThread}</p>
      ) : (
        <div className="flex flex-col gap-xs">
          {vcsStatus?.detached ? <p className="text-[11px] text-amber">{COPY.hintDetached}</p> : null}
          {vcsStatus && !vcsStatus.dirty && vcsStatus.ahead === 0 ? (
            <p className="text-[11px] text-muted">{COPY.hintClean}</p>
          ) : null}

          {error !== null ? (
            <p role="alert" className="text-[11px] text-red">
              {error}
            </p>
          ) : null}

          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder={COPY.placeholderSubject}
            disabled={busy}
            className="rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted disabled:opacity-50"
          />

          <div className="flex flex-wrap gap-xs">
            <button
              type="button"
              disabled={busy || subject.trim() === ''}
              onClick={() => void handleCommit(false)}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {stage === 'commit' ? COPY.stageCommitting : COPY.quickCommit}
            </button>
            <button
              type="button"
              disabled={busy || subject.trim() === ''}
              onClick={() => void handleCommit(true)}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {COPY.quickCommitPush}
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handlePush()}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {stage === 'push' ? COPY.stagePushing : COPY.quickPush}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
