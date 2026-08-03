import type { ReactElement } from 'react'

export interface SegmentOption {
  value: string
  label: string
  disabled?: boolean
  disabledTitle?: string
}

interface SegmentedControlProps {
  options: SegmentOption[]
  value: string
  onChange: (value: string) => void
  name: string
}

export function SegmentedControl({
  options,
  value,
  onChange,
  name,
}: Readonly<SegmentedControlProps>): ReactElement {
  return (
    <div
      role="group"
      aria-label={name}
      className="inline-flex rounded-sm border border-border bg-surface-2 p-[3px]"
    >
      {options.map((opt) => {
        const active = opt.value === value
        return (
          <button
            key={opt.value}
            type="button"
            role="radio"
            aria-checked={active}
            aria-pressed={active}
            disabled={opt.disabled}
            title={opt.disabled ? opt.disabledTitle : undefined}
            onClick={() => { if (!opt.disabled) onChange(opt.value) }}
            className={[
              'rounded-[3px] px-md py-[5px] text-sm font-medium transition-colors',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent',
              'disabled:cursor-not-allowed disabled:opacity-40',
              active
                ? 'bg-surface text-fg shadow-sm'
                : 'text-muted hover:text-fg',
            ].join(' ')}
          >
            {opt.label}
          </button>
        )
      })}
    </div>
  )
}
