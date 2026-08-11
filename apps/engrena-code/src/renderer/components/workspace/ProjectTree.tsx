import { useEffect, useState, type ReactElement } from 'react'
import type { Project } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'

const COPY = {
  header: 'Projetos',
  empty: 'Nenhum projeto ainda. Adicione um repositório git local para começar.',
  add: 'Adicionar projeto',
  remove: 'Remover projeto',
  removeConfirm: (name: string) =>
    `Remover o projeto "${name}"? As threads dele serao apagadas (os arquivos no disco permanecem).`,
  threadsEmpty: 'Nenhuma thread ainda.',
  threadsNew: 'Nova thread',
  threadsLoading: 'Carregando…',
  threadsError: 'Falha ao carregar as threads.',
  badgeWorktree: 'Worktree',
  searchPlaceholder: 'Buscar nas conversas…',
  searchAria: 'Buscar nas conversas do projeto',
  threadRename: 'Renomear conversa',
  threadRenameAria: 'Novo nome da conversa',
  threadExport: 'Exportar conversa (markdown)',
} as const

function threadLabel(thread: Thread): string {
  return thread.title?.trim() || thread.id.slice(0, 12)
}

const STATE_DOT: Record<Thread['state'], string> = {
  running: 'bg-accent',
  idle: 'bg-muted',
  committed: 'bg-green',
  error: 'bg-red',
  stopping: 'bg-amber',
  // F21: pausada aguardando resposta do usuário — mesma cor de "busy" de `running`; o `ui.md` de F21
  // especifica o card da timeline e deliberadamente não redefine o ponto da árvore.
  waiting_user: 'bg-accent',
  // Cancelada pelo usuário: assentou, não é falha — neutro como `idle`, nunca o vermelho de `error`.
  cancelled: 'bg-muted',
}

/** Linha da conversa com ações de renomear e exportar (F28 Onda 2). */
function ThreadRow({
  thread,
  selected,
  onSelect,
  onRename,
  onExport,
}: Readonly<{
  thread: Thread
  selected: boolean
  onSelect: () => void
  onRename?: (threadId: string, title: string | null) => void
  onExport?: (threadId: string, format: 'md' | 'json') => void
}>): ReactElement {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState('')

  function startEdit(): void {
    setDraft(thread.title ?? '')
    setEditing(true)
  }

  function commit(): void {
    onRename?.(thread.id, draft.trim() === '' ? null : draft.trim())
    setEditing(false)
  }

  if (editing) {
    return (
      <input
        // biome-ignore lint/a11y/noAutofocus: edição inline abre já no campo, como o rename de arquivo do explorer
        autoFocus
        value={draft}
        aria-label={COPY.threadRenameAria}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            commit()
          }
          if (e.key === 'Escape') {
            e.preventDefault()
            setEditing(false)
          }
        }}
        className="w-full rounded-md border border-accent bg-surface-2 px-xs py-[3px] text-[12px] text-fg focus:outline-none"
      />
    )
  }

  return (
    <div className="group/thread flex items-center gap-[2px]">
      <button
        type="button"
        onClick={onSelect}
        onDoubleClick={startEdit}
        title={threadLabel(thread)}
        className={`flex min-w-0 flex-1 items-center gap-xs truncate rounded-md px-xs py-[3px] text-left text-[12px] ${
          selected ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
        }`}
      >
        <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${STATE_DOT[thread.state]}`} />
        <span className="truncate">{threadLabel(thread)}</span>
        {thread.executionMode === 'worktree' ? (
          <span className="shrink-0 rounded-sm border border-accent/40 bg-accent/10 px-[4px] py-[1px] font-mono text-[9.5px] text-accent-2">
            {COPY.badgeWorktree}
          </span>
        ) : null}
      </button>
      <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within/thread:opacity-100 group-hover/thread:opacity-100">
        {onRename ? (
          <button
            type="button"
            onClick={startEdit}
            aria-label={COPY.threadRename}
            title={COPY.threadRename}
            className="px-[3px] text-[11px] text-muted hover:text-fg"
          >
            ✎
          </button>
        ) : null}
        {onExport ? (
          <button
            type="button"
            onClick={() => onExport(thread.id, 'md')}
            aria-label={COPY.threadExport}
            title={COPY.threadExport}
            className="px-[3px] text-[11px] text-muted hover:text-fg"
          >
            ⤓
          </button>
        ) : null}
      </span>
    </div>
  )
}

export interface ProjectTreeProps {
  projects: Project[] | null
  selectedProjectId: string | null
  selectedThreadId: string | null
  threadsByProject: Record<string, Thread[]>
  threadsLoading: Record<string, boolean>
  threadsError: Record<string, boolean>
  onSelectProject: (projectId: string) => void
  onSelectThread: (threadId: string) => void
  onNewThread: (projectId: string) => void
  onAddProjectClick: () => void
  onRemoveProject: (projectId: string) => void
  onSearchThreads?: (projectId: string, query: string) => void
  onRenameThread?: (threadId: string, title: string | null) => void
  onExportThread?: (threadId: string, format: 'md' | 'json') => void
}

export function ProjectTree({
  projects,
  selectedProjectId,
  selectedThreadId,
  threadsByProject,
  threadsLoading,
  threadsError,
  onSelectProject,
  onSelectThread,
  onNewThread,
  onAddProjectClick,
  onRemoveProject,
  onSearchThreads,
  onRenameThread,
  onExportThread,
}: Readonly<ProjectTreeProps>): ReactElement {
  const [threadQuery, setThreadQuery] = useState('')

  // Debounce: cada tecla dispararia um GET com JOIN em messages.
  useEffect(() => {
    if (!selectedProjectId || !onSearchThreads) return
    const id = window.setTimeout(() => onSearchThreads(selectedProjectId, threadQuery), 250)
    return () => window.clearTimeout(id)
  }, [threadQuery, selectedProjectId, onSearchThreads])

  // Trocar de projeto zera o filtro — senão a lista do novo projeto abre filtrada por engano.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedProjectId é o gatilho do reset, não um valor lido.
  useEffect(() => {
    setThreadQuery('')
  }, [selectedProjectId])

  return (
    <div className="flex h-full flex-col rounded-xl border border-border bg-surface p-sm">
      <div className="mb-sm flex items-center justify-between px-xs">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.header}</h2>
        <button
          type="button"
          onClick={onAddProjectClick}
          aria-label={COPY.add}
          className="rounded-md px-xs text-[15px] leading-none text-muted hover:bg-surface-2 hover:text-fg"
        >
          +
        </button>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!projects || projects.length === 0 ? (
          <p className="px-xs py-sm text-[12px] text-muted">{COPY.empty}</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId
              const threads = threadsByProject[project.id] ?? []
              return (
                <li key={project.id}>
                  <div className="group flex items-center justify-between rounded-md">
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className={`flex-1 truncate rounded-md px-xs py-xs text-left text-[13px] ${
                        isSelected ? 'bg-surface-2 font-medium text-fg' : 'text-fg hover:bg-surface-2'
                      }`}
                    >
                      {project.name}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        if (window.confirm(COPY.removeConfirm(project.name))) onRemoveProject(project.id)
                      }}
                      aria-label={COPY.remove}
                      className="hidden shrink-0 px-xs text-[12px] text-muted hover:text-red group-hover:block"
                    >
                      ×
                    </button>
                  </div>

                  {isSelected ? (
                    <div className="ml-sm mt-xs flex flex-col gap-[2px] border-l border-border pl-sm">
                      <button
                        type="button"
                        onClick={() => onNewThread(project.id)}
                        className="rounded-md px-xs py-[3px] text-left text-[12px] text-accent hover:bg-surface-2"
                      >
                        + {COPY.threadsNew}
                      </button>

                      {onSearchThreads ? (
                        <input
                          type="search"
                          value={threadQuery}
                          onChange={(e) => setThreadQuery(e.target.value)}
                          placeholder={COPY.searchPlaceholder}
                          aria-label={COPY.searchAria}
                          className="mb-[2px] w-full rounded-md border border-border bg-surface-2 px-xs py-[3px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
                        />
                      ) : null}

                      {threadsLoading[project.id] ? (
                        <p className="px-xs py-xs text-[12px] text-muted">{COPY.threadsLoading}</p>
                      ) : threadsError[project.id] ? (
                        <p role="alert" className="px-xs py-xs text-[12px] text-red">
                          {COPY.threadsError}
                        </p>
                      ) : threads.length === 0 ? (
                        <p className="px-xs py-xs text-[12px] text-muted">{COPY.threadsEmpty}</p>
                      ) : (
                        threads.map((thread) => (
                          <ThreadRow
                            key={thread.id}
                            thread={thread}
                            selected={thread.id === selectedThreadId}
                            onSelect={() => onSelectThread(thread.id)}
                            onRename={onRenameThread}
                            onExport={onExportThread}
                          />
                        ))
                      )}
                    </div>
                  ) : null}
                </li>
              )
            })}
          </ul>
        )}
      </div>

      <button
        type="button"
        onClick={onAddProjectClick}
        className="mt-sm rounded-md border border-border bg-surface-2 px-sm py-xs text-[12px] text-muted hover:text-fg"
      >
        {COPY.add}
      </button>
    </div>
  )
}
