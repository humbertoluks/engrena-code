import { useEffect, useRef, useState, type PointerEvent as ReactPointerEvent, type ReactElement } from 'react'
import { useTerminalDock } from '../../hooks/useTerminalDock'
import { TerminalPane } from './TerminalPane'
import {
  TERMINAL_DOCK_DEFAULT_HEIGHT,
  canCloseTerminalTab,
  nextHeightFromDrag,
  tabLabel,
} from './terminalDock.logic'

const COPY = {
  title: 'Terminal',
  newTabAria: 'Novo terminal',
  closeTabAria: (label: string) => `Fechar ${label}`,
  emptyState: 'Nenhuma aba aberta.',
  noProject: 'Selecione um projeto para abrir um terminal.',
  toggleAria: 'Alternar terminal',
  toggleTitle:
    'Terminal roda com os privilégios do seu sistema — sem sandbox adicional do EngrenaCode. Atalho: Ctrl+`',
  resizeAria: 'Redimensionar terminal',
  maximizeAria: 'Maximizar terminal',
  restoreAria: 'Restaurar tamanho do terminal',
} as const

interface TerminalDockProps {
  projectId: string | null
  threadId: string | null
  /** Notifica o pai quando o painel ocupa (ou libera) a coluna do histórico. */
  onMaximizedChange?: (maximized: boolean) => void
}

/** Dock no rodapé da coluna Histórico: abas, resize por drag e maximizar/restaurar (F26). */
export function TerminalDock({
  projectId,
  threadId,
  onMaximizedChange,
}: Readonly<TerminalDockProps>): ReactElement {
  const dock = useTerminalDock(projectId, threadId)
  const [height, setHeight] = useState(TERMINAL_DOCK_DEFAULT_HEIGHT)
  const [maximized, setMaximized] = useState(false)
  // Shells só montam após a 1ª abertura e ficam montados (ocultos ao colapsar) —
  // preserva scrollback ao recolher/reabrir e ao trocar de aba (padrão legado).
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    if (dock.open) setMounted(true)
  }, [dock.open])

  useEffect(() => {
    onMaximizedChange?.(maximized && dock.open)
  }, [maximized, dock.open, onMaximizedChange])

  useEffect(() => {
    if (!dock.open && maximized) {
      setMaximized(false)
    }
  }, [dock.open, maximized])

  const resizeTeardownRef = useRef<(() => void) | null>(null)
  useEffect(() => () => resizeTeardownRef.current?.(), [])

  const onResizeStart = (event: ReactPointerEvent<HTMLDivElement>): void => {
    if (maximized) return
    event.preventDefault()
    const startY = event.clientY
    const startHeight = height
    const onMove = (ev: PointerEvent): void => {
      setHeight(nextHeightFromDrag(startHeight, startY, ev.clientY))
    }
    const teardown = (): void => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', teardown)
      window.removeEventListener('pointercancel', teardown)
      document.body.style.cursor = ''
      document.body.style.userSelect = ''
      resizeTeardownRef.current = null
    }
    resizeTeardownRef.current = teardown
    document.body.style.cursor = 'row-resize'
    document.body.style.userSelect = 'none'
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', teardown)
    window.addEventListener('pointercancel', teardown)
  }

  const toggleMaximize = (): void => {
    setMaximized((prev) => !prev)
  }

  const panelStyle = maximized ? undefined : { height }
  const showClose = canCloseTerminalTab(dock.tabs.length)

  return (
    <div
      className={[
        'flex flex-col border-t border-border bg-surface',
        maximized && dock.open ? 'min-h-0 flex-1' : 'flex-none',
      ]
        .filter(Boolean)
        .join(' ')}
    >
      {dock.open && !maximized ? (
        <div
          role="separator"
          aria-orientation="horizontal"
          aria-label={COPY.resizeAria}
          onPointerDown={onResizeStart}
          className="group/resize -mt-px h-[8px] cursor-row-resize touch-none"
        >
          <div className="mx-auto mt-[2px] h-[3px] w-10 rounded-full bg-border transition-colors group-hover/resize:bg-muted" />
        </div>
      ) : null}

      <div className="flex items-center gap-sm px-md py-xs">
        <button
          type="button"
          onClick={dock.toggleOpen}
          aria-label={COPY.toggleAria}
          aria-expanded={dock.open}
          aria-controls="terminal-dock-panel"
          title={COPY.toggleTitle}
          className="inline-flex items-center gap-sm rounded-sm px-sm py-xs text-[11px] font-bold uppercase tracking-[0.07em] text-muted transition-colors hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          <Chevron open={dock.open} />
          <TerminalGlyph />
          {COPY.title}
        </button>

        {dock.open ? (
          <div className="ml-sm flex min-w-0 items-center gap-[2px] overflow-x-auto">
            {dock.tabs.map((tab, i) => {
              const label = tabLabel(i)
              const isActive = tab.tabId === dock.activeTabId
              return (
                <span
                  key={tab.tabId}
                  className={`inline-flex flex-none items-center rounded-sm transition-colors ${
                    isActive ? 'bg-surface-2 text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <button
                    type="button"
                    onClick={() => dock.setActiveTabId(tab.tabId)}
                    aria-current={isActive || undefined}
                    className="max-w-[120px] truncate px-sm py-[3px] text-[11px] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                  >
                    {label}
                  </button>
                  {showClose ? (
                    <button
                      type="button"
                      onClick={() => dock.closeTab(tab.tabId)}
                      title={COPY.closeTabAria(label)}
                      aria-label={COPY.closeTabAria(label)}
                      className="mr-[2px] grid h-[16px] w-[16px] place-items-center rounded-sm text-muted transition-colors hover:bg-red/15 hover:text-red focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                    >
                      <CloseIcon />
                    </button>
                  ) : null}
                </span>
              )
            })}
            <button
              type="button"
              onClick={dock.openNewTab}
              disabled={!projectId}
              title={COPY.newTabAria}
              aria-label={COPY.newTabAria}
              className="ml-[1px] grid h-[20px] w-[20px] flex-none place-items-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              <PlusIcon />
            </button>
          </div>
        ) : null}

        <div className="flex-1" />

        {dock.open ? (
          <button
            type="button"
            onClick={toggleMaximize}
            aria-label={maximized ? COPY.restoreAria : COPY.maximizeAria}
            title={maximized ? COPY.restoreAria : COPY.maximizeAria}
            className="grid h-[22px] w-[22px] flex-none place-items-center rounded-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            <MaximizeGlyph maximized={maximized} />
          </button>
        ) : null}
      </div>

      {mounted ? (
        <div id="terminal-dock-panel" className={panelShellClass(dock.open, maximized)}>
          <div
            className={[
              'overflow-hidden rounded-md border border-border bg-bg',
              maximized ? 'min-h-0 flex-1' : '',
            ]
              .filter(Boolean)
              .join(' ')}
            style={panelStyle}
          >
            <DockBody
              projectId={projectId}
              tabs={dock.tabs}
              activeTabId={dock.activeTabId}
              onReopen={dock.reopenTab}
            />
          </div>
        </div>
      ) : null}
    </div>
  )
}

function panelShellClass(open: boolean, maximized: boolean): string {
  if (!open) return 'hidden px-md pb-md'
  if (maximized) return 'flex min-h-0 flex-1 flex-col px-md pb-md'
  return 'px-md pb-md'
}

function DockBody({
  projectId,
  tabs,
  activeTabId,
  onReopen,
}: Readonly<{
  projectId: string | null
  tabs: ReturnType<typeof useTerminalDock>['tabs']
  activeTabId: string | null
  onReopen: (tabId: string) => void
}>): ReactElement {
  if (!projectId) {
    return (
      <div className="grid h-full place-items-center px-lg text-center font-mono text-xs leading-relaxed text-muted">
        {COPY.noProject}
      </div>
    )
  }
  if (tabs.length === 0) {
    return (
      <div className="grid h-full place-items-center px-lg text-center text-[12.5px] text-muted">
        {COPY.emptyState}
      </div>
    )
  }
  return (
    <>
      {tabs.map((tab) => (
        <div key={tab.tabId} className={`h-full ${tab.tabId === activeTabId ? '' : 'hidden'}`}>
          <TerminalPane tab={tab} onReopen={() => onReopen(tab.tabId)} />
        </div>
      ))}
    </>
  )
}

function Chevron({ open }: Readonly<{ open: boolean }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-[13px] w-[13px] transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 18 6-6-6-6" />
    </svg>
  )
}

function TerminalGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[14px] w-[14px]"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m5 8 4 4-4 4M13 16h6" />
      <rect x="2" y="3" width="20" height="18" rx="2" />
    </svg>
  )
}

function PlusIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className="h-[13px] w-[13px]"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M12 5v14M5 12h14" />
    </svg>
  )
}

function CloseIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="h-[11px] w-[11px]"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M6 6l12 12M18 6 6 18" />
    </svg>
  )
}

/** ∧ maximiza; ∨ restaura (pedido de produto; legado só tinha chevron de abrir/fechar). */
function MaximizeGlyph({ maximized }: Readonly<{ maximized: boolean }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      className="h-[12px] w-[12px]"
      aria-hidden="true"
      focusable="false"
    >
      {maximized ? <path d="m6 10 6 6 6-6" /> : <path d="m6 14 6-6 6 6" />}
    </svg>
  )
}
