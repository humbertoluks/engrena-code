import { useState } from 'react'
import type { ReactElement } from 'react'
import type { VcsStatus } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'

/**
 * Copy provisória (spec F14 §UI): `docs/F14-fluxo-git-completo/copy.md` marca os ids de textgen/campos
 * como TODO — mesmo tratamento dado a F04 (ver `docs/PROGRESS.md`), texto funcional até o passe de design.
 */
const COPY = {
  section: 'Repositório',
  hintNoThread: 'Abra uma thread para executar ações de git',
  hintDetached: 'HEAD destacada — faça checkout de uma branch antes.',
  hintClean: 'Tudo em dia — nada a commitar ou pushar.',
  quickCommit: 'Commit',
  quickCommitPush: 'Commit & push',
  quickCommitPushPr: 'Commit, push & PR',
  stageCommitting: 'Commitando…',
  stagePushing: 'Pushando…',
  stageOpeningPr: 'Abrindo PR…',
  stageTextgen: 'Gerando com IA…',
  placeholderSubject: 'Mensagem do commit',
  placeholderBody: 'Descrição (opcional)',
  placeholderPrTitle: 'Título do PR',
  placeholderPrBody: 'Descrição do PR (markdown, opcional)',
  generateAi: 'Gerar com IA',
  prFieldsToggle: 'Detalhes do PR',
  viewPr: 'Ver PR',
  textgenFailed: 'Não foi possível gerar o texto. Escreva manualmente.',
} as const

export interface GitActionsProps {
  vcsStatus: VcsStatus | null
  selectedThread: Thread | null
  onCommit: (subject: string, body?: string) => Promise<{ ok: boolean; error?: string }>
  onPush: () => Promise<{ ok: boolean; error?: string }>
  onOpenPr: (input?: { title?: string; body?: string }) => Promise<{ ok: boolean; error?: string; url?: string }>
  onTextgen: (mode: 'commit' | 'pr') => Promise<{ ok: boolean; error?: string; subject?: string; body?: string; title?: string }>
}

type Stage = 'textgen' | 'commit' | 'push' | 'pr' | null
type ActiveAction = 'commit' | 'commitPush' | 'commitPushPr' | null

export function GitActions({ vcsStatus, selectedThread, onCommit, onPush, onOpenPr, onTextgen }: Readonly<GitActionsProps>): ReactElement {
  const [subject, setSubject] = useState('')
  const [body, setBody] = useState('')
  const [prFieldsOpen, setPrFieldsOpen] = useState(false)
  const [prTitle, setPrTitle] = useState('')
  const [prBody, setPrBody] = useState('')
  const [stage, setStage] = useState<Stage>(null)
  const [activeAction, setActiveAction] = useState<ActiveAction>(null)
  const [error, setError] = useState<string | null>(null)
  const [lastPrUrl, setLastPrUrl] = useState<string | null>(null)

  const threadBusy = selectedThread?.state === 'running' || selectedThread?.state === 'stopping'
  const busy = threadBusy || stage !== null
  const noThread = selectedThread === null

  async function handleGenerateCommit(): Promise<void> {
    setError(null)
    setLastPrUrl(null)
    setStage('textgen')
    const result = await onTextgen('commit')
    if (result.ok) {
      setSubject(result.subject ?? '')
      setBody(result.body ?? '')
    } else {
      setError(result.error ?? COPY.textgenFailed)
    }
    setStage(null)
  }

  async function handleGeneratePr(): Promise<void> {
    setError(null)
    setLastPrUrl(null)
    setStage('textgen')
    const result = await onTextgen('pr')
    if (result.ok) {
      setSubject(result.subject ?? '')
      setPrTitle(result.title ?? '')
      setPrBody(result.body ?? '')
    } else {
      setError(result.error ?? COPY.textgenFailed)
    }
    setStage(null)
  }

  async function handleCommit(): Promise<void> {
    if (subject.trim() === '') return
    setError(null)
    setLastPrUrl(null)
    setActiveAction('commit')
    setStage('commit')
    const result = await onCommit(subject.trim(), body.trim() || undefined)
    setStage(null)
    setActiveAction(null)
    if (!result.ok) {
      setError(result.error ?? null)
      return
    }
    setSubject('')
    setBody('')
  }

  async function handleCommitAndPush(): Promise<void> {
    if (subject.trim() === '') return
    setError(null)
    setLastPrUrl(null)
    setActiveAction('commitPush')
    setStage('commit')
    const commitResult = await onCommit(subject.trim(), body.trim() || undefined)
    if (!commitResult.ok) {
      setError(commitResult.error ?? null)
      setStage(null)
      setActiveAction(null)
      return
    }
    setSubject('')
    setBody('')

    setStage('push')
    const pushResult = await onPush()
    setStage(null)
    setActiveAction(null)
    if (!pushResult.ok) setError(pushResult.error ?? null)
  }

  async function handleCommitPushPr(): Promise<void> {
    if (subject.trim() === '') return
    setError(null)
    setLastPrUrl(null)
    setActiveAction('commitPushPr')

    setStage('commit')
    const commitResult = await onCommit(subject.trim(), body.trim() || undefined)
    if (!commitResult.ok) {
      setError(commitResult.error ?? null)
      setStage(null)
      setActiveAction(null)
      return
    }
    setSubject('')
    setBody('')

    setStage('push')
    const pushResult = await onPush()
    if (!pushResult.ok) {
      setError(pushResult.error ?? null)
      setStage(null)
      setActiveAction(null)
      return
    }

    setStage('pr')
    const prResult = await onOpenPr({ title: prTitle.trim() || undefined, body: prBody.trim() || undefined })
    setStage(null)
    setActiveAction(null)
    if (!prResult.ok) {
      setError(prResult.error ?? null)
      return
    }
    setLastPrUrl(prResult.url ?? null)
    setPrTitle('')
    setPrBody('')
  }

  function handleViewPr(): void {
    if (lastPrUrl) void window.electronAPI.shell.openExternal(lastPrUrl)
  }

  function stageLabel(): string {
    if (stage === 'textgen') return COPY.stageTextgen
    if (stage === 'commit') return COPY.stageCommitting
    if (stage === 'push') return COPY.stagePushing
    if (stage === 'pr') return COPY.stageOpeningPr
    return ''
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

          {lastPrUrl !== null ? (
            <p role="status" className="text-[11px] text-green">
              <button type="button" onClick={handleViewPr} className="font-mono underline">
                {COPY.viewPr}
              </button>
            </p>
          ) : null}

          <div className="flex items-center gap-xs">
            <input
              type="text"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder={COPY.placeholderSubject}
              disabled={busy}
              className="flex-1 rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted disabled:opacity-50"
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleGenerateCommit()}
              title={COPY.generateAi}
              className="shrink-0 rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {COPY.generateAi}
            </button>
          </div>

          <textarea
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder={COPY.placeholderBody}
            disabled={busy}
            rows={2}
            className="rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted disabled:opacity-50"
          />

          <button
            type="button"
            disabled={busy}
            onClick={() => setPrFieldsOpen((v) => !v)}
            className="w-fit text-[11px] text-muted underline hover:text-fg"
          >
            {COPY.prFieldsToggle}
          </button>

          {prFieldsOpen ? (
            <div className="flex flex-col gap-xs rounded-md border border-border p-xs">
              <div className="flex items-center gap-xs">
                <input
                  type="text"
                  value={prTitle}
                  onChange={(e) => setPrTitle(e.target.value)}
                  placeholder={COPY.placeholderPrTitle}
                  disabled={busy}
                  className="flex-1 rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted disabled:opacity-50"
                />
                <button
                  type="button"
                  disabled={busy}
                  onClick={() => void handleGeneratePr()}
                  title={COPY.generateAi}
                  className="shrink-0 rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
                >
                  {COPY.generateAi}
                </button>
              </div>
              <textarea
                value={prBody}
                onChange={(e) => setPrBody(e.target.value)}
                placeholder={COPY.placeholderPrBody}
                disabled={busy}
                rows={3}
                className="rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted disabled:opacity-50"
              />
            </div>
          ) : null}

          <div className="flex flex-wrap gap-xs">
            <button
              type="button"
              disabled={busy || subject.trim() === ''}
              onClick={() => void handleCommit()}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {activeAction === 'commit' ? stageLabel() : COPY.quickCommit}
            </button>
            <button
              type="button"
              disabled={busy || subject.trim() === ''}
              onClick={() => void handleCommitAndPush()}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {activeAction === 'commitPush' ? stageLabel() : COPY.quickCommitPush}
            </button>
            <button
              type="button"
              disabled={busy || subject.trim() === ''}
              onClick={() => void handleCommitPushPr()}
              className="rounded-full border border-border bg-surface-2 px-sm py-[3px] text-[11px] font-medium hover:bg-surface disabled:opacity-50"
            >
              {activeAction === 'commitPushPr' ? stageLabel() : COPY.quickCommitPushPr}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
