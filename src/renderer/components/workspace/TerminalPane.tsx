import { useEffect, useRef } from 'react'
import type { ReactElement } from 'react'
import { Terminal } from '@xterm/xterm'
import { FitAddon } from '@xterm/addon-fit'
import '@xterm/xterm/css/xterm.css'
import { xtermThemeFromCssVars } from '../../theme/xterm-theme'
import type { TerminalTab } from '../../hooks/useTerminalDock'
import { ButtonSecondary } from '../ButtonSecondary'

const COPY = {
  connecting: 'Abrindo sessão...',
  errorTitle: 'Não foi possível abrir o terminal',
  exitedTitle: 'Sessão encerrada',
  exitedDetail: (exitCode: number) => `Processo encerrado (código ${exitCode}).`,
  reopenCta: 'Reabrir',
} as const

interface TerminalPaneProps {
  tab: TerminalTab
  onReopen: () => void
}

/** Uma aba/sessão de terminal (F26 spec §4) — monta @xterm/xterm + FitAddon, encaminha teclas via IPC. */
export function TerminalPane({ tab, onReopen }: Readonly<TerminalPaneProps>): ReactElement {
  const containerRef = useRef<HTMLDivElement | null>(null)
  const termRef = useRef<Terminal | null>(null)
  const fitAddonRef = useRef<FitAddon | null>(null)
  const sessionIdRef = useRef<string | null>(tab.sessionId)
  sessionIdRef.current = tab.sessionId

  useEffect(() => {
    if (tab.status !== 'running' || tab.sessionId === null || containerRef.current === null) return

    const term = new Terminal({
      cursorBlink: true,
      fontFamily: xtermThemeFromCssVars().fontFamily,
      fontSize: 13,
      theme: xtermThemeFromCssVars(),
    })
    const fitAddon = new FitAddon()
    term.loadAddon(fitAddon)
    // Ctrl+C sempre vira SIGINT (comportamento padrão de terminal); copiar seleção
    // usa Ctrl+Shift+C, sem disputar a tecla que mata o processo.
    term.attachCustomKeyEventHandler((event) => {
      if (
        event.type === 'keydown' &&
        event.ctrlKey &&
        event.shiftKey &&
        !event.altKey &&
        !event.metaKey &&
        (event.key === 'c' || event.key === 'C') &&
        term.hasSelection()
      ) {
        void navigator.clipboard.writeText(term.getSelection())
        term.clearSelection()
        return false
      }
      return true
    })
    term.open(containerRef.current)
    fitAddon.fit()

    termRef.current = term
    fitAddonRef.current = fitAddon

    window.electronAPI.terminal.resize(tab.sessionId, term.cols, term.rows)

    const dataSub = term.onData((data) => {
      const sessionId = sessionIdRef.current
      if (sessionId) window.electronAPI.terminal.write(sessionId, data)
    })

    const unsubscribeData = window.electronAPI.terminal.onData((event) => {
      if (event.sessionId === sessionIdRef.current) term.write(event.chunk)
    })

    const resizeObserver = new ResizeObserver(() => {
      fitAddon.fit()
      const sessionId = sessionIdRef.current
      if (sessionId) window.electronAPI.terminal.resize(sessionId, term.cols, term.rows)
    })
    resizeObserver.observe(containerRef.current)

    return () => {
      resizeObserver.disconnect()
      dataSub.dispose()
      unsubscribeData()
      term.dispose()
      termRef.current = null
      fitAddonRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab.status, tab.sessionId])

  if (tab.status === 'connecting') {
    return (
      <div className="flex h-full items-center justify-center text-[12.5px] text-muted">{COPY.connecting}</div>
    )
  }

  if (tab.status === 'error') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-sm p-lg text-center">
        <p className="text-[13px] font-medium text-fg">{COPY.errorTitle}</p>
        <p className="text-[12.5px] text-red">{tab.errorMessage}</p>
      </div>
    )
  }

  if (tab.status === 'exited') {
    return (
      <div className="flex h-full flex-col items-center justify-center gap-sm p-lg text-center">
        <p className="text-[13px] font-medium text-fg">{COPY.exitedTitle}</p>
        {tab.exitInfo ? (
          <p className="text-[12.5px] text-muted">{COPY.exitedDetail(tab.exitInfo.exitCode)}</p>
        ) : null}
        <ButtonSecondary onClick={onReopen}>{COPY.reopenCta}</ButtonSecondary>
      </div>
    )
  }

  return <div ref={containerRef} className="h-full w-full overflow-hidden px-xs py-xs" />
}
