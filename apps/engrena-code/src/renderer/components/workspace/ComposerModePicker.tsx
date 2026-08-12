import { useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import type { ChatModeItem } from '../../services/prompt-library-service'

/**
 * Seletor de modo de chat (F28 §3.4) — equivalente a `*.chatmode.md`: um preset de
 * provider/modelo/reasoning/access/execution + instruções que entram no system prompt do turno.
 */

const COPY = {
  label: 'Modo',
  none: 'Sem modo',
  ariaOpen: (current: string) => `Modo de chat: ${current}`,
  group: 'Modos do projeto',
  empty: 'Nenhum modo salvo neste projeto.',
  fromRepo: 'do repositório',
  remove: 'Remover modo',
  savePlaceholder: 'Salvar preset atual como…',
  instructionsPlaceholder: 'Instruções do modo (opcional) — entram no system prompt do turno',
  save: 'Salvar',
} as const

export interface ComposerModePickerProps {
  modes: readonly ChatModeItem[]
  value: string | null
  disabled: boolean
  onApply: (name: string | null) => void
  onSave: (name: string, instructions: string) => Promise<boolean>
  onDelete: (id: string, name: string) => void
}

export function ComposerModePicker({
  modes,
  value,
  disabled,
  onApply,
  onSave,
  onDelete,
}: Readonly<ComposerModePickerProps>): ReactElement {
  const [open, setOpen] = useState(false)
  const [draftName, setDraftName] = useState('')
  const [draftInstructions, setDraftInstructions] = useState('')
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    function onMouseDown(event: MouseEvent): void {
      if (containerRef.current && !containerRef.current.contains(event.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', onMouseDown)
    return () => document.removeEventListener('mousedown', onMouseDown)
  }, [open])

  async function handleSave(): Promise<void> {
    const name = draftName.trim()
    if (name === '') return
    if (await onSave(name, draftInstructions.trim())) {
      setDraftName('')
      setDraftInstructions('')
      setOpen(false)
    }
  }

  const current = value ?? COPY.none

  return (
    <div className="relative" ref={containerRef}>
      <button
        type="button"
        disabled={disabled}
        aria-label={COPY.ariaOpen(current)}
        onClick={() => setOpen((v) => !v)}
        className="flex items-center gap-[2px] rounded-md border border-border bg-surface px-xs py-[3px] text-[11px] disabled:opacity-50"
      >
        <span className="uppercase tracking-wide text-muted">{COPY.label}</span>
        <span className={value === null ? 'text-muted' : 'font-medium text-fg'}>{current}</span>
      </button>

      {open ? (
        <div className="absolute bottom-[calc(100%+6px)] left-0 z-50 w-[min(320px,92vw)] rounded-lg border border-border bg-surface p-xs shadow-lg">
          <p className="px-sm py-[2px] text-[10px] uppercase tracking-wide text-muted">{COPY.group}</p>

          <button
            type="button"
            onClick={() => {
              onApply(null)
              setOpen(false)
            }}
            className={`block w-full rounded-md px-sm py-[4px] text-left text-[12.5px] ${
              value === null ? 'bg-accent/15 text-fg' : 'text-muted hover:bg-surface-2'
            }`}
          >
            {COPY.none}
          </button>

          {modes.length === 0 ? (
            <p className="px-sm py-[6px] text-[11.5px] text-muted">{COPY.empty}</p>
          ) : (
            modes.map((mode) => (
              <div key={mode.file ?? mode.id} className="group/mode flex items-center gap-xs rounded-md hover:bg-surface-2">
                <button
                  type="button"
                  onClick={() => {
                    onApply(mode.name)
                    setOpen(false)
                  }}
                  className={`min-w-0 flex-1 rounded-md px-sm py-[4px] text-left text-[12.5px] ${
                    value === mode.name ? 'bg-accent/15 text-fg' : 'text-fg'
                  }`}
                >
                  <span className="font-medium">{mode.name}</span>
                  <span className="truncate text-[11px] text-muted">
                    {mode.description !== '' ? ` — ${mode.description}` : ''}
                    {mode.source === 'file' ? ` (${COPY.fromRepo})` : ''}
                  </span>
                </button>
                {mode.source === 'db' && mode.id !== null ? (
                  <button
                    type="button"
                    aria-label={`${COPY.remove}: ${mode.name}`}
                    title={COPY.remove}
                    onClick={() => onDelete(mode.id as string, mode.name)}
                    className="mr-xs shrink-0 rounded-md px-xs py-[2px] text-[12px] text-muted opacity-0 hover:text-red group-focus-within/mode:opacity-100 group-hover/mode:opacity-100"
                  >
                    ×
                  </button>
                ) : null}
              </div>
            ))
          )}

          <div className="mt-xs border-t border-border pt-xs">
            <textarea
              value={draftInstructions}
              onChange={(e) => setDraftInstructions(e.target.value)}
              placeholder={COPY.instructionsPlaceholder}
              aria-label={COPY.instructionsPlaceholder}
              rows={2}
              className="mb-xs w-full resize-none rounded-md border border-border bg-surface-2 px-sm py-[4px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            />
          </div>

          <div className="flex items-center gap-xs">
            <input
              value={draftName}
              onChange={(e) => setDraftName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  e.preventDefault()
                  void handleSave()
                }
              }}
              placeholder={COPY.savePlaceholder}
              aria-label={COPY.savePlaceholder}
              className="min-w-0 flex-1 rounded-md border border-border bg-surface-2 px-sm py-[3px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
            />
            <button
              type="button"
              onClick={() => void handleSave()}
              disabled={draftName.trim() === ''}
              className="shrink-0 rounded-md bg-accent px-sm py-[3px] text-[11px] font-medium text-white disabled:opacity-50"
            >
              {COPY.save}
            </button>
          </div>
        </div>
      ) : null}
    </div>
  )
}
