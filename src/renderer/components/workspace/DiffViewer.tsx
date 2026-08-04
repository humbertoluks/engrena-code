import { useMemo, useState } from 'react'
import type { ReactElement } from 'react'
import type { Diff, DiffStatus } from '../../services/threads-service'

const COPY = {
  empty: 'Nenhuma mudança proposta. O diff aparece quando o agente termina a execução.',
  selectAll: 'Selecionar todos',
  selectNone: 'Limpar seleção',
  selectedOne: (n: number) => `${n} selecionado`,
  selectedMany: (n: number) => `${n} selecionados`,
  statusPending: 'pendente',
  statusAccepted: 'aceito',
  statusRejected: 'rejeitado',
  accept: 'Aceitar',
  acceptLoading: 'Aplicando…',
  reject: 'Rejeitar',
  rejectLoading: 'Rejeitando…',
  ctaAccept: 'Aceitar mudanças',
  ctaAcceptSelected: (n: number) => `Aceitar selecionados (${n})`,
  ctaReject: 'Rejeitar',
  ctaRejectSelected: (n: number) => `Rejeitar selecionados (${n})`,
  openPr: 'Abrir PR',
  openPrLoading: 'Abrindo PR…',
  errorApply: 'Não foi possível aplicar as mudanças. O diff segue pendente.',
} as const

const STATUS_LABEL: Record<DiffStatus, string> = {
  pending: COPY.statusPending,
  accepted: COPY.statusAccepted,
  rejected: COPY.statusRejected,
}

const STATUS_CLASS: Record<DiffStatus, string> = {
  pending: 'text-amber',
  accepted: 'text-green',
  rejected: 'text-muted',
}

export interface DiffViewerProps {
  diffs: Diff[]
  onAccept: (ids?: string[]) => Promise<{ ok: boolean; error?: string }>
  onReject: (ids?: string[]) => Promise<{ ok: boolean; error?: string }>
  onOpenPr: () => Promise<{ ok: boolean; url?: string; error?: string }>
  canOpenPr: boolean
}

export function DiffViewer({ diffs, onAccept, onReject, onOpenPr, canOpenPr }: Readonly<DiffViewerProps>): ReactElement {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [busyIds, setBusyIds] = useState<Set<string>>(new Set())
  const [bulkBusy, setBulkBusy] = useState<'accept' | 'reject' | null>(null)
  const [prBusy, setPrBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [prResult, setPrResult] = useState<string | null>(null)

  const pending = useMemo(() => diffs.filter((d) => d.status === 'pending'), [diffs])
  const selectedIds = useMemo(() => Array.from(selected).filter((id) => pending.some((d) => d.id === id)), [selected, pending])

  if (diffs.length === 0) {
    return <p className="p-md text-[13px] text-muted">{COPY.empty}</p>
  }

  function toggleSelect(id: string): void {
    setSelected((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  async function handleFileAction(id: string, action: 'accept' | 'reject'): Promise<void> {
    setBusyIds((prev) => new Set(prev).add(id))
    setError(null)
    const result = action === 'accept' ? await onAccept([id]) : await onReject([id])
    if (!result.ok) setError(result.error ?? COPY.errorApply)
    setBusyIds((prev) => {
      const next = new Set(prev)
      next.delete(id)
      return next
    })
  }

  async function handleBulkAction(action: 'accept' | 'reject'): Promise<void> {
    setBulkBusy(action)
    setError(null)
    const ids = selectedIds.length > 0 ? selectedIds : undefined
    const result = action === 'accept' ? await onAccept(ids) : await onReject(ids)
    if (!result.ok) setError(result.error ?? COPY.errorApply)
    else setSelected(new Set())
    setBulkBusy(null)
  }

  async function handleOpenPr(): Promise<void> {
    setPrBusy(true)
    setError(null)
    const result = await onOpenPr()
    if (!result.ok) setError(result.error ?? COPY.errorApply)
    else setPrResult(result.url ?? null)
    setPrBusy(false)
  }

  return (
    <div className="flex flex-col gap-sm p-md">
      {error !== null ? (
        <p role="alert" className="text-[12px] text-red">
          {error}
        </p>
      ) : null}

      {pending.length >= 2 ? (
        <div className="flex items-center justify-between text-[12px] text-muted">
          <div className="flex gap-sm">
            <button type="button" onClick={() => setSelected(new Set(pending.map((d) => d.id)))} className="hover:text-fg">
              {COPY.selectAll}
            </button>
            <button type="button" onClick={() => setSelected(new Set())} className="hover:text-fg">
              {COPY.selectNone}
            </button>
          </div>
          {selectedIds.length > 0 ? (
            <span>{selectedIds.length === 1 ? COPY.selectedOne(1) : COPY.selectedMany(selectedIds.length)}</span>
          ) : null}
        </div>
      ) : null}

      <div className="flex flex-col gap-xs">
        {diffs.map((diff) => (
          <div
            key={diff.id}
            className={`rounded-lg border border-border bg-surface-2 p-sm ${diff.status === 'rejected' ? 'opacity-60' : ''}`}
          >
            <div className="flex items-center gap-xs">
              {diff.status === 'pending' ? (
                <input
                  type="checkbox"
                  checked={selected.has(diff.id)}
                  onChange={() => toggleSelect(diff.id)}
                  aria-label={`Selecionar ${diff.file}`}
                />
              ) : null}
              <span className="flex-1 truncate font-mono text-[12px] text-fg">{diff.file}</span>
              <span className={`text-[11px] ${STATUS_CLASS[diff.status]}`}>{STATUS_LABEL[diff.status]}</span>
              <span className="text-[11px] text-green">+{diff.additions}</span>
              <span className="text-[11px] text-red">-{diff.deletions}</span>
              <span className="text-[10px] uppercase text-muted">{diff.provider}</span>

              {diff.status === 'pending' ? (
                <div className="flex gap-xs">
                  <button
                    type="button"
                    disabled={busyIds.has(diff.id)}
                    onClick={() => void handleFileAction(diff.id, 'accept')}
                    aria-label={`Aceitar ${diff.file}`}
                    className="rounded-md border border-border px-xs py-[2px] text-[11px] text-green hover:bg-surface disabled:opacity-50"
                  >
                    {busyIds.has(diff.id) ? COPY.acceptLoading : COPY.accept}
                  </button>
                  <button
                    type="button"
                    disabled={busyIds.has(diff.id)}
                    onClick={() => void handleFileAction(diff.id, 'reject')}
                    aria-label={`Rejeitar ${diff.file}`}
                    className="rounded-md border border-border px-xs py-[2px] text-[11px] text-red hover:bg-surface disabled:opacity-50"
                  >
                    {busyIds.has(diff.id) ? COPY.rejectLoading : COPY.reject}
                  </button>
                </div>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      {pending.length > 0 ? (
        <div className="flex justify-end gap-xs">
          <button
            type="button"
            disabled={bulkBusy !== null}
            onClick={() => void handleBulkAction('reject')}
            className="rounded-md border border-border px-md py-xs text-[12px] text-red hover:bg-surface-2 disabled:opacity-50"
          >
            {bulkBusy === 'reject' ? COPY.rejectLoading : selectedIds.length > 0 ? COPY.ctaRejectSelected(selectedIds.length) : COPY.ctaReject}
          </button>
          <button
            type="button"
            disabled={bulkBusy !== null}
            onClick={() => void handleBulkAction('accept')}
            className="rounded-md bg-accent px-md py-xs text-[12px] font-medium text-white disabled:opacity-50"
          >
            {bulkBusy === 'accept' ? COPY.acceptLoading : selectedIds.length > 0 ? COPY.ctaAcceptSelected(selectedIds.length) : COPY.ctaAccept}
          </button>
        </div>
      ) : canOpenPr ? (
        <div className="flex justify-end">
          {prResult !== null ? (
            <span className="mr-sm self-center text-[12px] text-green">{prResult}</span>
          ) : null}
          <button
            type="button"
            disabled={prBusy}
            onClick={() => void handleOpenPr()}
            className="rounded-full border border-border bg-surface-2 px-md py-xs text-[12px] font-medium hover:bg-surface disabled:opacity-50"
          >
            {prBusy ? COPY.openPrLoading : COPY.openPr}
          </button>
        </div>
      ) : null}
    </div>
  )
}
