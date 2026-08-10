import type { ThemePreference } from '../hooks/useTheme'
import { useTheme } from '../hooks/useTheme'

const OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Escuro' },
  { value: 'system', label: 'Sistema' },
]

interface ThemeControlProps {
  className?: string
}

export function ThemeControl({ className = '' }: Readonly<ThemeControlProps>) {
  const { preference, setTheme } = useTheme()

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
