import { useEffect, useRef, useState, type ReactElement } from 'react'
import type { Project } from '../../services/projects-service'
import type { Thread } from '../../services/threads-service'
import { EXPORT_COPY } from './threadExportDownload.logic'
import {
  ChevronIcon,
  DownloadIcon,
  FolderIcon,
  PanelLeftIcon,
  PencilIcon,
  PlusIcon,
  TrashIcon,
} from './sidebarIcons'

const COPY = {
  header: 'Projetos',
  empty: 'Nenhum projeto ainda. Adicione um repositório git local para começar.',
  add: 'Adicionar projeto',
  collapse: 'Recolher projetos',
  expand: 'Expandir projetos',
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
  exportDismiss: 'Dispensar erro de exportação',
  expandProject: 'Expandir projeto',
  collapseProject: 'Recolher projeto',
} as const

const HEADER_BTN =
  'grid h-[24px] w-[24px] place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

const ROW_ICON_BTN =
  'grid h-[22px] w-[22px] shrink-0 place-items-center rounded-md text-muted transition-colors hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent'

/** Compact age like legacy thread rows ("7h", "3d"). */
function relativeAge(ts: number): string {
  const diffMs = Date.now() - ts
  const minutes = Math.floor(diffMs / 60_000)
  if (minutes < 1) return 'agora'
  if (minutes < 60) return `${minutes}min`
  const hours = Math.floor(minutes / 60)
  if (hours < 24) return `${hours}h`
  const days = Math.floor(hours / 24)
  return `${days}d`
}

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
  // PreToolUse pendente (Sprint 2) — busy como running; distinto de waiting_user no DB.
  waiting_permission: 'bg-accent',
  // Cancelada pelo usuário: assentou, não é falha — neutro como `idle`, nunca o vermelho de `error`.
  cancelled: 'bg-muted',
}

/** Linha da conversa com ações de renomear e exportar (F28 Onda 2). */
function ThreadRow({
  thread,
  selected,
  exporting,
  onSelect,
  onRename,
  onExport,
}: Readonly<{
  thread: Thread
  selected: boolean
  exporting: boolean
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

  function cancelEdit(): void {
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
            cancelEdit()
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
        <span className="min-w-0 flex-1 truncate">{threadLabel(thread)}</span>
        {thread.executionMode === 'worktree' ? (
          <span className="shrink-0 rounded-sm border border-accent/40 bg-accent/10 px-[4px] py-[1px] font-mono text-[9.5px] text-accent-2">
            {COPY.badgeWorktree}
          </span>
        ) : null}
        <span className="ml-auto shrink-0 pl-xs font-mono text-[10.5px] text-muted">{relativeAge(thread.updatedAt)}</span>
      </button>
      {onRename ? (
        <button
          type="button"
          // preventDefault no mousedown evita que o botão roube foco e o input
          // recém-montado dispare onBlur (fecha a edição no mesmo clique).
          onMouseDown={(e) => e.preventDefault()}
          onClick={startEdit}
          aria-label={COPY.threadRename}
          title={COPY.threadRename}
          className={`${ROW_ICON_BTN} opacity-0 transition-opacity group-focus-within/thread:opacity-100 group-hover/thread:opacity-100`}
        >
          <PencilIcon />
        </button>
      ) : null}
      {onExport ? (
        <button
          type="button"
          onClick={() => onExport(thread.id, 'md')}
          disabled={exporting}
          aria-busy={exporting}
          aria-label={COPY.threadExport}
          title={COPY.threadExport}
          className={`${ROW_ICON_BTN} text-muted`}
        >
          <DownloadIcon />
        </button>
      ) : null}
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
  onCollapse?: () => void
  onSearchThreads?: (projectId: string, query: string) => void
  onRenameThread?: (threadId: string, title: string | null) => void
  onExportThread?: (threadId: string, format: 'md' | 'json') => void
  /** Progresso/erro do download — fora do composer (PermissionPrompt cobre sendError). */
  exporting?: boolean
  exportError?: string | null
  onDismissExportError?: () => void
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
  onCollapse,
  onSearchThreads,
  onRenameThread,
  onExportThread,
  exporting = false,
  exportError = null,
  onDismissExportError,
}: Readonly<ProjectTreeProps>): ReactElement {
  const [threadQuery, setThreadQuery] = useState('')
  const [expandedIds, setExpandedIds] = useState<ReadonlySet<string>>(() => new Set())
  const searchRef = useRef(onSearchThreads)
  searchRef.current = onSearchThreads
  // Evita o GET inicial (query vazia) que o hook do workspace já faz — se rodasse de novo
  // ligava `threadsLoading` e desmontava as ThreadRow no meio do rename (flicker).
  const skipSearchRef = useRef(true)

  // Debounce só quando o usuário edita a busca. Nunca reagir à identidade de onSearchThreads
  // (PrincipalScreen passa lambda inline a cada render).
  useEffect(() => {
    skipSearchRef.current = true
  }, [selectedProjectId])

  useEffect(() => {
    if (!selectedProjectId || !searchRef.current) return
    if (skipSearchRef.current) {
      skipSearchRef.current = false
      return
    }
    const id = window.setTimeout(() => searchRef.current?.(selectedProjectId, threadQuery), 250)
    return () => window.clearTimeout(id)
  }, [threadQuery, selectedProjectId])

  // Trocar de projeto zera o filtro — senão a lista do novo projeto abre filtrada por engano.
  // biome-ignore lint/correctness/useExhaustiveDependencies: selectedProjectId é o gatilho do reset, não um valor lido.
  useEffect(() => {
    setThreadQuery('')
  }, [selectedProjectId])

  // Selecionar projeto também expande a árvore (legado: expandedProjectIds + selection).
  useEffect(() => {
    if (!selectedProjectId) return
    setExpandedIds((prev) => {
      if (prev.has(selectedProjectId)) return prev
      const next = new Set(prev)
      next.add(selectedProjectId)
      return next
    })
  }, [selectedProjectId])

  function toggleExpanded(projectId: string): void {
    const willExpand = !expandedIds.has(projectId)
    setExpandedIds((prev) => {
      const next = new Set(prev)
      if (next.has(projectId)) next.delete(projectId)
      else next.add(projectId)
      return next
    })
    // Expandir um projeto não selecionado precisa selecioná-lo para carregar threads.
    if (willExpand && projectId !== selectedProjectId) {
      onSelectProject(projectId)
    }
  }

  return (
    <div className="relative flex h-full flex-col rounded-xl border border-border bg-surface p-sm">
      {/* z-[60] acima do PermissionPrompt (z-50): erro de export não fica escondido no composer. */}
      {exportError !== null ? (
        <div
          role="alert"
          className="pointer-events-auto fixed bottom-md left-md z-[60] flex max-w-[min(24rem,90vw)] items-start gap-xs rounded-lg border border-red/40 bg-surface px-sm py-xs text-[12px] text-red shadow-lg"
        >
          <p className="min-w-0 flex-1">{exportError}</p>
          {onDismissExportError ? (
            <button
              type="button"
              onClick={onDismissExportError}
              aria-label={COPY.exportDismiss}
              className="shrink-0 rounded-md px-xs text-muted hover:bg-surface-2 hover:text-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
              ×
            </button>
          ) : null}
        </div>
      ) : null}
      {exporting ? (
        <p aria-live="polite" className="mb-xs px-xs text-[11px] text-muted">
          {EXPORT_COPY.exporting}
        </p>
      ) : null}
      <div className="mb-sm flex items-center justify-between gap-xs px-xs">
        <h2 className="text-[11px] font-bold uppercase tracking-[0.07em] text-muted">{COPY.header}</h2>
        <div className="flex items-center gap-[2px]">
          <button type="button" onClick={onAddProjectClick} aria-label={COPY.add} title={COPY.add} className={HEADER_BTN}>
            <PlusIcon />
          </button>
          {onCollapse ? (
            <button type="button" onClick={onCollapse} aria-label={COPY.collapse} title={COPY.collapse} className={HEADER_BTN}>
              <PanelLeftIcon />
            </button>
          ) : null}
        </div>
      </div>

      <div className="flex-1 overflow-y-auto">
        {!projects || projects.length === 0 ? (
          <p className="px-xs py-sm text-[12px] text-muted">{COPY.empty}</p>
        ) : (
          <ul className="flex flex-col gap-xs">
            {projects.map((project) => {
              const isSelected = project.id === selectedProjectId
              const isExpanded = expandedIds.has(project.id)
              const threads = threadsByProject[project.id] ?? []
              return (
                <li key={project.id}>
                  <div
                    className={`group relative flex items-center gap-[2px] rounded-md ${
                      isSelected ? 'bg-surface-2' : 'hover:bg-surface-2/60'
                    }`}
                  >
                    {isSelected ? (
                      <span className="absolute left-0 top-1 bottom-1 w-[2px] rounded-full bg-accent" aria-hidden="true" />
                    ) : null}
                    <button
                      type="button"
                      onClick={() => toggleExpanded(project.id)}
                      aria-label={isExpanded ? COPY.collapseProject : COPY.expandProject}
                      aria-expanded={isExpanded}
                      className={`${ROW_ICON_BTN} ml-[2px]`}
                    >
                      <ChevronIcon open={isExpanded} />
                    </button>
                    <button
                      type="button"
                      onClick={() => onSelectProject(project.id)}
                      className="flex min-w-0 flex-1 items-center gap-xs truncate rounded-md py-xs pr-xs text-left text-[13px] text-fg"
                    >
                      <span className="shrink-0 text-muted">
                        <FolderIcon />
                      </span>
                      <span className={`truncate ${isSelected ? 'font-medium' : ''}`}>{project.name}</span>
                    </button>
                    <span className="flex shrink-0 items-center opacity-0 transition-opacity group-focus-within:opacity-100 group-hover:opacity-100">
                      <button
                        type="button"
                        onClick={() => onNewThread(project.id)}
                        aria-label={COPY.threadsNew}
                        title={COPY.threadsNew}
                        className={ROW_ICON_BTN}
                      >
                        <PlusIcon />
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm(COPY.removeConfirm(project.name))) onRemoveProject(project.id)
                        }}
                        aria-label={COPY.remove}
                        title={COPY.remove}
                        className={`${ROW_ICON_BTN} text-red hover:text-red`}
                      >
                        <TrashIcon />
                      </button>
                    </span>
                  </div>

                  {isExpanded ? (
                    <div className="ml-sm mt-xs flex flex-col gap-[2px] border-l border-border pl-sm">
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

                      {threadsLoading[project.id] && threads.length === 0 ? (
                        <p className="px-xs py-xs text-[12px] text-muted">{COPY.threadsLoading}</p>
                      ) : threadsError[project.id] && threads.length === 0 ? (
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
                            exporting={exporting}
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

/** Thin rail when the projects panel is collapsed — same PanelLeft affordance as legacy. */
export function ProjectTreeCollapsedRail({ onExpand }: Readonly<{ onExpand: () => void }>): ReactElement {
  return (
    <div className="flex h-full flex-col items-center rounded-xl border border-border bg-surface py-sm">
      <button type="button" onClick={onExpand} aria-label={COPY.expand} title={COPY.expand} className={HEADER_BTN}>
        <PanelLeftIcon />
      </button>
    </div>
  )
}
