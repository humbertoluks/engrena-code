import type { ReactElement } from 'react'

const INPUT_BASE =
  'w-full rounded-sm border border-border bg-surface-2 px-md py-sm text-sm text-fg font-mono transition-colors placeholder:text-muted focus:outline-none focus:border-accent focus:ring-2 focus:ring-accent/30'

interface FieldProps {
  id: string
  ariaLabel: string
  value: string
  onChange: (value: string) => void
  placeholder: string
  revealed: boolean
  onToggleReveal: () => void
  revealLabel: string
  hideLabel: string
  error?: string | null
  disabled?: boolean
}

/** Password input com reveal toggle e erro de formato sob o campo. Sem `<label>` visível — o chamador posiciona o rótulo (ex.: coluna de um grid). */
export function Field({
  id,
  ariaLabel,
  value,
  onChange,
  placeholder,
  revealed,
  onToggleReveal,
  revealLabel,
  hideLabel,
  error,
  disabled = false,
}: Readonly<FieldProps>): ReactElement {
  const hasError = error !== null && error !== undefined

  return (
    <div className="flex flex-col gap-[2px]">
      <div className="relative">
        <input
          id={id}
          type={revealed ? 'text' : 'password'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          aria-label={ariaLabel}
          aria-invalid={hasError || undefined}
          disabled={disabled}
          className={`${INPUT_BASE} pr-[40px] ${hasError ? 'border-red focus:border-red focus:ring-red/30' : ''}`}
          autoComplete="off"
          spellCheck={false}
        />
        <button
          type="button"
          onClick={onToggleReveal}
          title={revealed ? hideLabel : revealLabel}
          aria-label={revealed ? hideLabel : revealLabel}
          className="absolute right-sm top-1/2 -translate-y-1/2 text-muted hover:text-fg"
        >
          {revealed ? (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[15px] w-[15px]" aria-hidden="true">
              <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94" />
              <path d="M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19" />
              <line x1="1" y1="1" x2="23" y2="23" />
            </svg>
          ) : (
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" className="h-[15px] w-[15px]" aria-hidden="true">
              <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
          )}
        </button>
      </div>
      {hasError ? <span className="text-[11.5px] text-red">{error}</span> : null}
    </div>
  )
}
