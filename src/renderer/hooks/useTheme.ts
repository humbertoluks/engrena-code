import { useCallback, useEffect, useSyncExternalStore } from 'react'

export type ThemePreference = 'light' | 'dark' | 'system'
export type ResolvedTheme = 'light' | 'dark'

export const THEME_STORAGE_KEY = 'engrenacode:theme'

const VALID: ReadonlySet<string> = new Set(['light', 'dark', 'system'])

function normalizePreference(raw: string | null): ThemePreference {
  if (raw && VALID.has(raw)) return raw as ThemePreference
  return 'system'
}

function getSystemTheme(): ResolvedTheme {
  if (typeof window === 'undefined') return 'dark'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

export function resolveTheme(preference: ThemePreference): ResolvedTheme {
  return preference === 'system' ? getSystemTheme() : preference
}

function readStoredPreference(): ThemePreference {
  try {
    return normalizePreference(localStorage.getItem(THEME_STORAGE_KEY))
  } catch {
    return 'system'
  }
}

function applyDomTheme(resolved: ResolvedTheme, withAntiFlash: boolean) {
  const root = document.documentElement
  if (withAntiFlash) {
    root.classList.add('no-transitions')
  }
  if (resolved === 'dark') {
    root.classList.add('dark')
  } else {
    root.classList.remove('dark')
  }
  if (withAntiFlash) {
    // Double rAF: apply class this frame, clear anti-flash after paint
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        root.classList.remove('no-transitions')
      })
    })
  }
}

/** Apply theme before React paint (also mirrored by inline boot in index.html). */
export function applyThemeBoot() {
  const preference = readStoredPreference()
  applyDomTheme(resolveTheme(preference), false)
}

type Listener = () => void

let preferenceSnapshot: ThemePreference = 'system'
const listeners = new Set<Listener>()

function emit() {
  for (const listener of listeners) listener()
}

function setPreferenceSnapshot(next: ThemePreference) {
  preferenceSnapshot = next
  emit()
}

function subscribePreference(listener: Listener) {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

function getPreferenceSnapshot() {
  return preferenceSnapshot
}

function subscribeSystem(listener: Listener) {
  const mq = window.matchMedia('(prefers-color-scheme: dark)')
  mq.addEventListener('change', listener)
  return () => mq.removeEventListener('change', listener)
}

function getSystemSnapshot(): ResolvedTheme {
  return getSystemTheme()
}

function getServerSnapshot(): ResolvedTheme {
  return 'dark'
}

/** Initialize store from storage once (module load / after boot). */
export function initThemeStore() {
  preferenceSnapshot = readStoredPreference()
  applyDomTheme(resolveTheme(preferenceSnapshot), false)
}

export function useTheme() {
  const preference = useSyncExternalStore(
    subscribePreference,
    getPreferenceSnapshot,
    () => 'system' as ThemePreference
  )

  const systemTheme = useSyncExternalStore(subscribeSystem, getSystemSnapshot, getServerSnapshot)

  const resolvedTheme: ResolvedTheme =
    preference === 'system' ? systemTheme : preference

  useEffect(() => {
    applyDomTheme(resolvedTheme, true)
  }, [resolvedTheme])

  const setTheme = useCallback((next: ThemePreference) => {
    const normalized = normalizePreference(next)
    try {
      localStorage.setItem(THEME_STORAGE_KEY, normalized)
    } catch {
      // fail-soft: still update in-memory preference
    }
    setPreferenceSnapshot(normalized)
  }, [])

  return {
    theme: preference,
    preference,
    resolvedTheme,
    setTheme,
  }
}

/** For non-hook callers that need current resolved theme once. */
export function getResolvedTheme(): ResolvedTheme {
  return resolveTheme(readStoredPreference())
}
