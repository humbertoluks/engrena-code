import type { ResolvedTheme } from '../hooks/useTheme'

export type ShikiThemeName = 'github-light' | 'github-dark'

/** Map resolved app theme → Shiki built-in theme name (F03 Workspace). */
export function shikiThemeFromResolved(resolvedTheme: ResolvedTheme): ShikiThemeName {
  return resolvedTheme === 'dark' ? 'github-dark' : 'github-light'
}
