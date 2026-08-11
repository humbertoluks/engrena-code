import { useCallback, useEffect, useRef, useState } from 'react'
import {
  collapsePanel,
  expandPanel,
  type LayoutResult,
  type PanelPrefs,
  type PanelSide,
  resolveLayout,
} from './responsiveLayout.logic.js'

const LEFT_COLLAPSED_KEY = 'engrenacode.sidebar.leftCollapsed'
const RIGHT_COLLAPSED_KEY = 'engrenacode.sidebar.rightCollapsed'

function readPrefs(): PanelPrefs {
  try {
    return {
      leftCollapsed: localStorage.getItem(LEFT_COLLAPSED_KEY) === '1',
      rightCollapsed: localStorage.getItem(RIGHT_COLLAPSED_KEY) === '1',
    }
  } catch {
    return { leftCollapsed: false, rightCollapsed: false }
  }
}

function writePrefs(prefs: PanelPrefs): void {
  try {
    localStorage.setItem(LEFT_COLLAPSED_KEY, prefs.leftCollapsed ? '1' : '0')
    localStorage.setItem(RIGHT_COLLAPSED_KEY, prefs.rightCollapsed ? '1' : '0')
  } catch {
    // Quota / modo privado — recolher continua valendo nesta sessão.
  }
}

export interface ResponsiveLayout extends LayoutResult {
  /** Vai no container do grid: é a largura dele que decide, não a da tela. */
  containerRef: (node: HTMLElement | null) => void
  expand: (side: PanelSide) => void
  collapse: (side: PanelSide) => void
  closeOverlay: () => void
}

/**
 * Estado das colunas do workspace. A largura vem de um ResizeObserver no próprio container: em
 * janela com zoom, ou se o layout ganhar uma barra lateral de app, `window.innerWidth` mentiria.
 */
export function useResponsiveLayout(): ResponsiveLayout {
  const [prefs, setPrefs] = useState<PanelPrefs>(readPrefs)
  const [overlay, setOverlay] = useState<PanelSide | null>(null)
  const [width, setWidth] = useState(() =>
    typeof window === 'undefined' ? 1280 : window.innerWidth
  )
  const observerRef = useRef<ResizeObserver | null>(null)

  const containerRef = useCallback((node: HTMLElement | null) => {
    observerRef.current?.disconnect()
    observerRef.current = null
    if (node === null) return

    setWidth(node.getBoundingClientRect().width)
    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (entry !== undefined) setWidth(entry.contentRect.width)
    })
    observer.observe(node)
    observerRef.current = observer
  }, [])

  useEffect(() => () => observerRef.current?.disconnect(), [])

  const layout = resolveLayout({ width, prefs, overlay })

  // Só grava o que o usuário escolheu; o trilho imposto pela largura nunca vira preferência.
  const apply = useCallback((next: { prefs: PanelPrefs; overlay: PanelSide | null }): void => {
    setPrefs((current) => {
      if (
        current.leftCollapsed === next.prefs.leftCollapsed &&
        current.rightCollapsed === next.prefs.rightCollapsed
      ) {
        return current
      }
      writePrefs(next.prefs)
      return next.prefs
    })
    setOverlay(next.overlay)
  }, [])

  const expand = useCallback(
    (side: PanelSide): void => apply(expandPanel(side, width, prefs)),
    [apply, width, prefs]
  )

  const collapse = useCallback(
    (side: PanelSide): void => apply(collapsePanel(side, prefs, overlay)),
    [apply, prefs, overlay]
  )

  const closeOverlay = useCallback((): void => setOverlay(null), [])

  // Escape fecha o drawer. Modais montados por cima param o evento antes daqui.
  useEffect(() => {
    if (layout.overlay === null) return
    function onKeyDown(event: KeyboardEvent): void {
      if (event.key === 'Escape') setOverlay(null)
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [layout.overlay])

  return { ...layout, containerRef, expand, collapse, closeOverlay }
}
