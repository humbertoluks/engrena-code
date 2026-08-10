import { useCallback, useEffect, useRef, useState } from 'react'

const DEFAULT_COLS = 80
const DEFAULT_ROWS = 24

const BRIDGE_MISSING = 'Terminal disponível apenas no app desktop.'

/**
 * Ponte de terminal do preload. `globals.d.ts` tipa `window.electronAPI` como sempre
 * presente, mas ela só existe sob o Electron real — no renderer aberto direto num
 * browser (dev/smoke) é `undefined`, e acessá-la sem guarda derrubava o `#principal`
 * inteiro, não só o dock.
 */
export function terminalBridge(): EngrenaTerminalApi | null {
  return window.electronAPI?.terminal ?? null
}

export interface TerminalTab {
  /** Identidade estável do lado do cliente — sobrevive à troca de `sessionId` num "reabrir" (F26 spec §5). */
  tabId: string
  /** `null` até `terminal.create` resolver. */
  sessionId: string | null
  shell: string | null
  cwd: string | null
  status: 'connecting' | 'running' | 'exited' | 'error'
  errorMessage?: string
  exitInfo?: { exitCode: number; signal: number | null; expected: boolean }
}

function makeTabId(): string {
  return `tab_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

export interface UseTerminalDockResult {
  open: boolean
  toggleOpen: () => void
  tabs: TerminalTab[]
  activeTabId: string | null
  setActiveTabId: (tabId: string) => void
  openNewTab: () => void
  closeTab: (tabId: string) => void
  reopenTab: (tabId: string) => void
}

/** Estado de abas por projeto + ciclo de vida IPC do dock de terminal (F26 spec §4). */
export function useTerminalDock(projectId: string | null, threadId: string | null): UseTerminalDockResult {
  const [open, setOpen] = useState(false)
  const [tabsByProject, setTabsByProject] = useState<Record<string, TerminalTab[]>>({})
  const [activeTabByProject, setActiveTabByProject] = useState<Record<string, string | null>>({})

  const tabs = projectId ? (tabsByProject[projectId] ?? []) : []
  const activeTabId = projectId ? (activeTabByProject[projectId] ?? null) : null

  const patchTab = useCallback((pid: string, tabId: string, patch: Partial<TerminalTab>): void => {
    setTabsByProject((prev) => {
      const list = prev[pid] ?? []
      const idx = list.findIndex((t) => t.tabId === tabId)
      if (idx === -1) return prev
      const next = list.slice()
      next[idx] = { ...next[idx], ...patch }
      return { ...prev, [pid]: next }
    })
  }, [])

  const spawnSession = useCallback(
    (pid: string, tid: string | null, tabId: string): void => {
      const bridge = terminalBridge()
      if (bridge === null) {
        patchTab(pid, tabId, { status: 'error', errorMessage: BRIDGE_MISSING })
        return
      }

      bridge
        .create({ projectId: pid, threadId: tid, cols: DEFAULT_COLS, rows: DEFAULT_ROWS })
        .then((result) => {
          if ('error' in result) {
            patchTab(pid, tabId, { status: 'error', errorMessage: result.error.message })
            return
          }
          patchTab(pid, tabId, {
            sessionId: result.sessionId,
            shell: result.shell,
            cwd: result.cwd,
            status: 'running',
            errorMessage: undefined,
            exitInfo: undefined,
          })
        })
        .catch((err: unknown) => {
          const message = err instanceof Error ? err.message : 'Falha ao criar sessão de terminal.'
          patchTab(pid, tabId, { status: 'error', errorMessage: message })
        })
    },
    [patchTab]
  )

  const openNewTab = useCallback((): void => {
    if (!projectId) return
    const pid = projectId
    const tabId = makeTabId()
    const pendingTab: TerminalTab = { tabId, sessionId: null, shell: null, cwd: null, status: 'connecting' }

    setTabsByProject((prev) => ({ ...prev, [pid]: [...(prev[pid] ?? []), pendingTab] }))
    setActiveTabByProject((prev) => ({ ...prev, [pid]: tabId }))
    setOpen(true)

    spawnSession(pid, threadId, tabId)
  }, [projectId, threadId, spawnSession])

  const closeTab = useCallback(
    (tabId: string): void => {
      if (!projectId) return
      const pid = projectId
      const tab = (tabsByProject[pid] ?? []).find((t) => t.tabId === tabId)
      if (tab?.sessionId) void terminalBridge()?.kill(tab.sessionId)

      setTabsByProject((prev) => ({ ...prev, [pid]: (prev[pid] ?? []).filter((t) => t.tabId !== tabId) }))
      setActiveTabByProject((prev) => {
        if (prev[pid] !== tabId) return prev
        const remaining = (tabsByProject[pid] ?? []).filter((t) => t.tabId !== tabId)
        return { ...prev, [pid]: remaining.length > 0 ? remaining[remaining.length - 1].tabId : null }
      })
    },
    [projectId, tabsByProject]
  )

  const reopenTab = useCallback(
    (tabId: string): void => {
      if (!projectId) return
      patchTab(projectId, tabId, { status: 'connecting', sessionId: null, exitInfo: undefined, errorMessage: undefined })
      spawnSession(projectId, threadId, tabId)
    },
    [projectId, threadId, patchTab, spawnSession]
  )

  const setActiveTabId = useCallback(
    (tabId: string): void => {
      if (!projectId) return
      setActiveTabByProject((prev) => ({ ...prev, [projectId]: tabId }))
    },
    [projectId]
  )

  const toggleOpen = useCallback((): void => {
    setOpen((v) => !v)
  }, [])

  // Abrir o dock (transição fechado→aberto) sem nenhuma aba já cria a primeira (smoke F26 §7.2
  // item 1 — atalho abre e mostra o shell de cara). Um ref evita recriar a aba se o usuário fechar
  // a última aba com o dock ainda aberto (fechar não deve reabrir sozinho).
  const wasOpenRef = useRef(false)
  useEffect(() => {
    const justOpened = open && !wasOpenRef.current
    wasOpenRef.current = open
    if (justOpened && projectId && tabs.length === 0) {
      openNewTab()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, projectId])

  // Evento exit (F26 spec §5) atualiza o status da aba dona da sessão — em qualquer projeto,
  // já que só o `sessionId` do evento identifica a sessão (o main não sabe de "projeto ativo").
  useEffect(() => {
    const bridge = terminalBridge()
    if (bridge === null) return

    const unsubscribe = bridge.onExit((event) => {
      setTabsByProject((prev) => {
        let changed = false
        const next: Record<string, TerminalTab[]> = { ...prev }
        for (const pid of Object.keys(next)) {
          const idx = next[pid].findIndex((t) => t.sessionId === event.sessionId)
          if (idx === -1) continue
          const list = next[pid].slice()
          list[idx] = {
            ...list[idx],
            status: 'exited',
            exitInfo: { exitCode: event.exitCode, signal: event.signal, expected: event.expected },
          }
          next[pid] = list
          changed = true
        }
        return changed ? next : prev
      })
    })
    return unsubscribe
  }, [])

  // Atalho de teclado padrão do dock (Ctrl+`, spec F26 §3.3 — Auto-Aceitar).
  useEffect(() => {
    function handleKeydown(e: KeyboardEvent): void {
      if (e.ctrlKey && e.key === '`') {
        e.preventDefault()
        setOpen((v) => !v)
      }
    }
    window.addEventListener('keydown', handleKeydown)
    return () => window.removeEventListener('keydown', handleKeydown)
  }, [])

  return { open, toggleOpen, tabs, activeTabId, setActiveTabId, openNewTab, closeTab, reopenTab }
}
