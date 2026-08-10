import { fontFamily } from '../tokens/design-tokens'

export interface XtermThemeMap {
  background: string
  foreground: string
  cursor: string
  cursorAccent: string
  selectionBackground: string
  selectionForeground: string
  border: string
  fontFamily: string
}

function readCssVar(name: string, fallback: string, el: Element = document.documentElement): string {
  const value = getComputedStyle(el).getPropertyValue(name).trim()
  return value || fallback
}

/**
 * Build an xterm-compatible theme map from Design Lock CSS vars.
 * Consumers (F03) should call this after theme is applied to the DOM.
 */
export function xtermThemeFromCssVars(
  el: Element = document.documentElement
): XtermThemeMap {
  const background = readCssVar('--bg', '#0a0a0b', el)
  const foreground = readCssVar('--fg', '#ededee', el)
  const accent = readCssVar('--accent', '#ff6b00', el)
  const border = readCssVar('--border', '#232327', el)

  return {
    background,
    foreground,
    cursor: accent,
    cursorAccent: background,
    selectionBackground: border,
    selectionForeground: foreground,
    border,
    fontFamily: fontFamily.mono,
  }
}
