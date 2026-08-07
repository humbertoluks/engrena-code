import { useEffect, useState } from 'react'
import type { ReactElement } from 'react'
import { projectFilesService, type ProjectFile } from '../../services/project-files-service'
import { MENTION_DEBOUNCE_MS, MENTION_RESULTS_LIMIT } from './composer.logic'

const COPY = {
  loading: 'Buscando arquivos…',
  empty: 'Nenhum arquivo',
  error: 'Falha ao buscar arquivos',
  retry: 'Tentar novamente',
} as const

export interface FileMentionMenuProps {
  projectId: string
  query: string
  onSelect: (path: string) => void
}

export function FileMentionMenu({ projectId, query, onSelect }: Readonly<FileMentionMenuProps>): ReactElement {
  const [files, setFiles] = useState<ProjectFile[] | null>(null)
  const [error, setError] = useState(false)
  const [reloadToken, setReloadToken] = useState(0)

  useEffect(() => {
    let cancelled = false
    setFiles(null)
    setError(false)

    const timer = setTimeout(() => {
      projectFilesService
        .search(projectId, query, MENTION_RESULTS_LIMIT)
        .then((res) => {
          if (cancelled) return
          if (res.error) {
            setError(true)
            return
          }
          setFiles(res.files)
        })
        .catch(() => {
          if (!cancelled) setError(true)
        })
    }, MENTION_DEBOUNCE_MS)

    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [projectId, query, reloadToken])

  return (
    <div
      role="listbox"
      aria-label="Arquivos do projeto"
      className="absolute bottom-[calc(100%+6px)] left-0 z-10 max-h-[280px] w-[min(420px,92vw)] overflow-y-auto rounded-lg border border-border bg-surface p-xs shadow-lg"
    >
      {error ? (
        <div className="p-sm text-[12px] text-red">
          <p>{COPY.error}</p>
          <button
            type="button"
            onClick={() => setReloadToken((v) => v + 1)}
            className="mt-xs text-[11.5px] text-accent underline hover:no-underline"
          >
            {COPY.retry}
          </button>
        </div>
      ) : files === null ? (
        <p className="p-sm text-[12px] text-muted">{COPY.loading}</p>
      ) : files.length === 0 ? (
        <p className="p-sm text-[12px] text-muted">{COPY.empty}</p>
      ) : (
        files.map((f) => (
          <button
            key={f.path}
            type="button"
            onMouseDown={(e) => {
              e.preventDefault()
              onSelect(f.path)
            }}
            className="block w-full rounded-md px-sm py-[4px] text-left text-[12.5px] hover:bg-accent/15"
          >
            {f.path}
          </button>
        ))
      )}
    </div>
  )
}
