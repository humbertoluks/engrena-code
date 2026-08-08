import type { ReactElement } from 'react'
import { useTerminalDock } from '../../hooks/useTerminalDock'
import { TerminalPane } from './TerminalPane'

const COPY = {
  title: 'Terminal',
  newTabCta: '+ Nova aba',
  closeTabAria: 'Fechar aba',
  emptyState: 'Nenhuma aba aberta.',
  noProject: 'Selecione um projeto para abrir um terminal.',
  toggleAria: 'Alternar terminal',
  toggleTitle: 'Terminal roda com os privilégios do seu sistema — sem sandbox adicional do EngrenaCode. Atalho: Ctrl+`',
} as const

interface TerminalDockProps {
  projectId: string | null
  threadId: string | null
}

function tabLabel(index: number): string {
  return `Terminal ${index + 1}`
}

/** Dock inferior expansível com abas de terminal por projeto (F26 spec §4, ui.md). */
export function TerminalDock({ projectId, threadId }: Readonly<TerminalDockProps>): ReactElement {
  const dock = useTerminalDock(projectId, threadId)
  const activeTab = dock.tabs.find((t) => t.tabId === dock.activeTabId) ?? null

  return (
    <div className="flex flex-col overflow-hidden rounded-xl border border-border bg-surface">
      <div className="flex items-center justify-between border-b border-border px-md py-xs">
        <button
          type="button"
          onClick={dock.toggleOpen}
          aria-label={COPY.toggleAria}
          aria-expanded={dock.open}
          title={COPY.toggleTitle}
          className="rounded-sm text-[12px] font-medium text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        >
          {COPY.title}
        </button>

        {dock.open ? (
          <div className="flex items-center gap-xs overflow-x-auto">
            {dock.tabs.map((tab, i) => (
              <div
                key={tab.tabId}
                className={`flex items-center gap-[6px] rounded-md px-sm py-[3px] text-[12px] ${
                  tab.tabId === dock.activeTabId ? 'bg-surface-2 text-fg' : 'text-muted'
                }`}
              >
                <button
                  type="button"
                  onClick={() => dock.setActiveTabId(tab.tabId)}
                  className="rounded-sm focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  {tabLabel(i)}
                </button>
                <button
                  type="button"
                  aria-label={COPY.closeTabAria}
                  onClick={() => dock.closeTab(tab.tabId)}
                  className="rounded-sm text-muted hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={dock.openNewTab}
              disabled={!projectId}
              className="rounded-md px-sm py-[3px] text-[12px] text-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent disabled:opacity-50"
            >
              {COPY.newTabCta}
            </button>
          </div>
        ) : null}
      </div>

      {dock.open ? (
        <div className="h-[240px]">
          {!projectId ? (
            <div className="flex h-full items-center justify-center text-[12.5px] text-muted">{COPY.noProject}</div>
          ) : activeTab ? (
            <TerminalPane tab={activeTab} onReopen={() => dock.reopenTab(activeTab.tabId)} />
          ) : (
            <div className="flex h-full items-center justify-center text-[12.5px] text-muted">
              {COPY.emptyState}
            </div>
          )}
        </div>
      ) : null}
    </div>
  )
}
