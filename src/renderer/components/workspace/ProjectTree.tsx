import type { ReactElement } from 'react'
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
}: Readonly<ProjectTreeProps>): ReactElement {
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
                          <button
                            key={thread.id}
                            type="button"
                            onClick={() => onSelectThread(thread.id)}
                            className={`flex items-center gap-xs truncate rounded-md px-xs py-[3px] text-left text-[12px] ${
                              thread.id === selectedThreadId ? 'bg-surface-2 font-medium text-fg' : 'text-muted hover:bg-surface-2 hover:text-fg'
                            }`}
                          >
                            <span className={`h-[6px] w-[6px] shrink-0 rounded-full ${STATE_DOT[thread.state]}`} />
                            <span className="truncate">{threadLabel(thread)}</span>
                          </button>
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
