import { useCallback, useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { memoryService, type MemoryStatus } from '../../services/memory-service'

const COPY = {
  title: 'Memória do projeto',
  pillEntries: (n: number) => `${n} ${n === 1 ? 'entrada' : 'entradas'}`,
  ariaClose: 'Fechar',
  toggleLabel: 'Memória neste projeto',
  toggleOn: 'on',
  toggleOff: 'off',
  toggleTitleOn: 'Ligada — o agente lê o journal antes do turno e escreve uma entrada ao fim',
  toggleTitleOff: 'Desligada — nenhuma entrada nova é escrita e o journal não entra no prompt',
  noticeDisabled:
    'Memória desligada. O journal existente foi preservado e volta a ser usado quando você religar.',
  noticeCorrupted:
    'Journal ilegível — o conteúdo anterior não pôde ser decifrado e está sendo tratado como vazio. Novas entradas voltam a ser gravadas normalmente.',
  journalLoading: 'Carregando journal…',
  journalEmpty: 'Sem entradas ainda. O agente escreve aqui ao fim de cada turno.',
  footerLastEntry: (at: string) => `Última entrada: ${at}`,
  footerLastEntryNever: 'Nenhuma entrada ainda',
  footerSize: (kb: string) => `${kb} no journal`,
  errorLoad: 'Não foi possível carregar o journal deste projeto.',
  errorToggle: 'Não foi possível alterar a memória deste projeto.',
} as const

interface ProjectMemoryModalProps {
  projectId: string
  status: MemoryStatus | null
  onClose: () => void
  /** Notifica a sidebar após alternar o toggle, para o meta da linha reagir. */
  onChanged: () => void
}

function CloseIcon(): ReactElement {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[16px] w-[16px]" aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  )
}

function formatKb(bytes: number): string {
  return `${(bytes / 1024).toFixed(1).replace('.', ',')} KB`
}

function formatEntryDate(iso: string): string {
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : date.toLocaleString('pt-BR')
}

export function ProjectMemoryModal({
  projectId,
  status,
  onClose,
  onChanged,
}: Readonly<ProjectMemoryModalProps>): ReactElement {
  const [local, setLocal] = useState<MemoryStatus | null>(status)
  const [journal, setJournal] = useState<string | null>(null)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [toggleError, setToggleError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let cancelled = false
    memoryService
      .getJournal(projectId)
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setLoadError(COPY.errorLoad)
          return
        }
        setJournal(res.content)
        setLoadError(null)
      })
      .catch(() => {
        if (!cancelled) setLoadError(COPY.errorLoad)
      })
    return () => {
      cancelled = true
    }
  }, [projectId])

  useEffect(() => {
    function onKey(event: KeyboardEvent): void {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleToggle = useCallback(async (): Promise<void> => {
    if (!local) return
    setBusy(true)
    setToggleError(null)
    try {
      const res = await memoryService.setEnabled(projectId, !local.enabled)
      if (res.error) {
        setToggleError(COPY.errorToggle)
        return
      }
      setLocal(res)
      onChanged()
    } catch {
      setToggleError(COPY.errorToggle)
    } finally {
      setBusy(false)
    }
  }, [projectId, local, onChanged])

  const enabled = local?.enabled ?? false
  const corrupted = local?.corrupted ?? false

  return (
    <div className="fixed inset-0 z-50 flex place-items-center justify-center bg-black/50 p-lg">
      <div
        role="dialog"
        aria-label={COPY.title}
        className="flex max-h-[86vh] w-full max-w-[880px] flex-col overflow-y-auto rounded-lg border border-border bg-surface p-lg shadow-lg"
      >
        <div className="flex items-center justify-between gap-md">
          <div className="flex items-center gap-sm">
            <h2 className="font-display text-[17px] font-semibold text-fg">{COPY.title}</h2>
            {local ? (
              <span className="rounded-full border border-border bg-surface-2 px-sm py-[1px] font-mono text-[11px] text-muted">
                {COPY.pillEntries(local.entryCount)}
              </span>
            ) : null}
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={COPY.ariaClose}
            className="rounded-sm text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <CloseIcon />
          </button>
        </div>

        <div className="mt-md flex items-center gap-sm">
          <span className="text-[12.5px] text-muted">{COPY.toggleLabel}</span>
          <button
            type="button"
            onClick={() => void handleToggle()}
            disabled={busy || local === null}
            title={enabled ? COPY.toggleTitleOn : COPY.toggleTitleOff}
            className={`rounded-full border px-sm py-[1px] font-mono text-[10.5px] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50 ${
              enabled ? 'border-accent/50 text-accent' : 'border-border text-muted'
            }`}
          >
            {enabled ? COPY.toggleOn : COPY.toggleOff}
          </button>
        </div>

        {corrupted ? (
          <p role="alert" className="mt-md text-[12.5px] text-amber">
            {COPY.noticeCorrupted}
          </p>
        ) : null}
        {!enabled && local !== null ? (
          <p className="mt-md text-[12.5px] text-muted">{COPY.noticeDisabled}</p>
        ) : null}
        {toggleError !== null ? (
          <p role="alert" className="mt-md text-[12.5px] text-red">
            {toggleError}
          </p>
        ) : null}
        {loadError !== null ? (
          <p role="alert" className="mt-md text-[12.5px] text-red">
            {loadError}
          </p>
        ) : null}

        <div className="mt-md min-h-[320px] flex-1 overflow-y-auto rounded-md border border-border bg-surface-2 p-md">
          {journal === null && loadError === null ? (
            <p className="text-[12.5px] text-muted">{COPY.journalLoading}</p>
          ) : journal !== null && journal.trim().length > 0 ? (
            <pre className="m-0 whitespace-pre-wrap font-mono text-[12px] leading-relaxed text-fg">{journal}</pre>
          ) : loadError === null ? (
            <p className="text-[12.5px] text-muted">{COPY.journalEmpty}</p>
          ) : null}
        </div>

        {local ? (
          <div className="mt-lg border-t border-border pt-md">
            <p className="font-mono text-[11.5px] text-muted">
              {local.lastEntryAt === null
                ? COPY.footerLastEntryNever
                : COPY.footerLastEntry(formatEntryDate(local.lastEntryAt))}
              {' · '}
              {COPY.footerSize(formatKb(local.sizeBytes))}
            </p>
          </div>
        ) : null}
      </div>
    </div>
  )
}
