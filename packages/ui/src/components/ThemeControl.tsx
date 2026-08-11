import type { ReactElement } from 'react'
import type { ResolvedTheme, ThemePreference } from '../hooks/useTheme'
import { nextThemePreference, useTheme } from '../hooks/useTheme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

const PREFERENCE_LABEL: Record<ThemePreference, string> = {
  light: 'Claro',
  dark: 'Escuro',
  system: 'Sistema',
}

interface ThemeControlProps {
  className?: string
  /** `select` = dropdown (gate); `icon` = ciclo por ícone (chrome legado). */
  variant?: 'select' | 'icon'
}

const ICON_CLASS = 'h-[15px] w-[15px] shrink-0'

function MoonIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_CLASS}
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" />
    </svg>
  )
}

function SunIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={ICON_CLASS}
      aria-hidden="true"
      focusable="false"
    >
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2v2" />
      <path d="M12 20v2" />
      <path d="m4.93 4.93 1.41 1.41" />
      <path d="m17.66 17.66 1.41 1.41" />
      <path d="M2 12h2" />
      <path d="M20 12h2" />
      <path d="m6.34 17.66-1.41 1.41" />
      <path d="m19.07 4.93-1.41 1.41" />
    </svg>
  )
}

function ThemeIcon({ resolved }: Readonly<{ resolved: ResolvedTheme }>): ReactElement {
  return resolved === 'dark' ? <MoonIcon /> : <SunIcon />
}

export function ThemeControl({
  className = '',
  variant = 'select',
}: Readonly<ThemeControlProps>): ReactElement {
  const { preference, resolvedTheme, setTheme } = useTheme()

  if (variant === 'icon') {
    const next = nextThemePreference(preference)
    const label = `Tema: ${PREFERENCE_LABEL[preference]}. Alternar para ${PREFERENCE_LABEL[next]}`
    return (
      <button
        type="button"
        aria-label={label}
        title={label}
        onClick={() => setTheme(next)}
        className={`inline-flex items-center justify-center rounded-md p-[4px] text-muted transition-colors hover:bg-surface-2 hover:text-fg focus:outline-none focus-visible:ring-2 focus-visible:ring-accent ${className}`.trim()}
      >
        <ThemeIcon resolved={resolvedTheme} />
      </button>
    )
  }

  return (
    <label
      className={`inline-flex items-center gap-sm text-[12.5px] text-muted ${className}`.trim()}
    >
      <span className="sr-only">Tema</span>
      <select
        aria-label="Tema"
        value={preference}
        onChange={(e) => setTheme(e.target.value as ThemePreference)}
        className="rounded-md border border-border bg-surface-2 px-sm py-xs text-fg focus:border-accent focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
      >
        {OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </label>
  )
}
