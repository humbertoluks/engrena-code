import { lazy, Suspense, useCallback, useEffect, useMemo, useState, type ReactElement } from 'react'
import { projectFilesService } from '../../services/project-files-service'
import { SidebarSection } from './SidebarSection'
import { FilesIcon } from './sidebarIcons'
import { DROP_PATH_MIME } from './composerDrop.logic'
import {
  FILE_EXPLORER_LIST_LIMIT,
  buildFileTree,
  changedAncestorDirs,
  filterProjectFilePaths,
  sortedFileTreeDirs,
  sortedFileTreeFiles,
  type FileTreeDir,
} from './fileExplorer.logic'

const FileViewerModal = lazy(() =>
  import('./FileViewerModal').then((m) => ({ default: m.FileViewerModal })),
)

const COPY = {
  title: 'Arquivos',
  filterPlaceholder: 'Filtrar arquivos…',
  filterAria: 'Filtrar arquivos do repositório',
  loading: 'Carregando…',
  errorRetry: 'Falha ao listar os arquivos — tentar de novo',
  emptyFilter: (q: string) => `Nada casa com “${q}”.`,
  emptyTree: 'Nenhum arquivo listável neste projeto.',
  truncated: (shown: number, total: number) => `Mostrando ${shown} de ${total} arquivos.`,
} as const

const ROW =
  'flex w-full min-w-0 items-center gap-xs rounded-md py-[3px] pr-xs text-left text-[12px] text-fg/85 transition-colors hover:bg-[color-mix(in_srgb,var(--fg)_7%,transparent)] hover:text-fg focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-accent'

export interface FileExplorerProps {
  projectId: string
  /** Uncommitted paths from git porcelain (orange highlight). */
  changedFiles?: readonly string[]
  /** Arquivo aberto no viewer — vira contexto implícito do composer (`null` ao fechar). */
  onActiveFileChange?: (
    active: { path: string; selection?: { text: string; startLine?: number; endLine?: number } } | null
  ) => void
}

/** Collapsible project file tree for the right workspace sidebar (F03 Arquivos). */
export function FileExplorer({
  projectId,
  changedFiles,
  onActiveFileChange,
}: Readonly<FileExplorerProps>): ReactElement {
  const [phase, setPhase] = useState<'idle' | 'loading' | 'loaded' | 'error'>('idle')
  const [paths, setPaths] = useState<string[]>([])
  const [total, setTotal] = useState(0)
  const [truncated, setTruncated] = useState(false)
  const [filter, setFilter] = useState('')
  const [expanded, setExpanded] = useState<Set<string>>(() => new Set())
  const [openPath, setOpenPath] = useState<string | null>(null)

  const openFile = useCallback(
    (path: string) => {
      setOpenPath(path)
      onActiveFileChange?.({ path })
    },
    [onActiveFileChange]
  )

  const closeFile = useCallback(() => {
    setOpenPath(null)
    onActiveFileChange?.(null)
  }, [onActiveFileChange])

  const changedPaths = useMemo(() => new Set(changedFiles ?? []), [changedFiles])
  const changedDirs = useMemo(() => changedAncestorDirs(changedFiles ?? []), [changedFiles])

  useEffect(() => {
    setPhase('idle')
    setPaths([])
    setTotal(0)
    setTruncated(false)
    setFilter('')
    setExpanded(new Set())
    setOpenPath(null)
  }, [projectId])

  const load = useCallback((): void => {
    setPhase('loading')
    void projectFilesService
      .listForExplorer(projectId, FILE_EXPLORER_LIST_LIMIT)
      .then((res) => {
        if (res.error) {
          setPhase('error')
          return
        }
        setPaths(res.files.map((f) => f.path))
        setTotal(res.total ?? res.files.length)
        setTruncated(res.truncated === true)
        setPhase('loaded')
      })
      .catch(() => setPhase('error'))
  }, [projectId])

  const onOpenChange = useCallback(
    (open: boolean): void => {
      if (open && phase === 'idle') load()
    },
    [phase, load],
  )

  const tree = useMemo(() => buildFileTree(paths), [paths])
  const matches = useMemo(() => filterProjectFilePaths(paths, filter), [paths, filter])

  const toggleDir = useCallback((path: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(path)) next.delete(path)
      else next.add(path)
      return next
    })
  }, [])

  return (
    <>
      <SidebarSection title={COPY.title} icon={<FilesIcon />} collapsible onOpenChange={onOpenChange}>
        <div className="flex max-h-[320px] flex-col gap-xs overflow-y-auto">
          <input
            type="search"
            value={filter}
            onChange={(e) => setFilter(e.target.value)}
            placeholder={COPY.filterPlaceholder}
            aria-label={COPY.filterAria}
            className="w-full rounded-lg border border-border bg-surface px-sm py-[5px] text-[12px] text-fg placeholder:text-muted focus:border-accent focus:outline-none"
          />

          {phase === 'loading' ? (
            <p className="m-0 px-sm py-xs text-[11.5px] text-muted">{COPY.loading}</p>
          ) : null}

          {phase === 'error' ? (
            <button
              type="button"
              onClick={load}
              className="rounded-md px-sm py-xs text-left text-[11.5px] text-red hover:bg-red/10"
            >
              {COPY.errorRetry}
            </button>
          ) : null}

          {phase === 'loaded' && truncated ? (
            <p className="m-0 px-sm text-[11px] text-muted">{COPY.truncated(paths.length, total)}</p>
          ) : null}

          {phase === 'loaded' && matches !== null ? (
            matches.length > 0 ? (
              matches.map((path) => (
                <FileRow
                  key={path}
                  name={path}
                  path={path}
                  depth={0}
                  changed={changedPaths.has(path)}
                  onOpen={openFile}
                />
              ))
            ) : (
              <p className="m-0 px-sm py-xs text-[11.5px] text-muted">{COPY.emptyFilter(filter.trim())}</p>
            )
          ) : null}

          {phase === 'loaded' && matches === null ? (
            paths.length === 0 ? (
              <p className="m-0 px-sm py-xs text-[11.5px] text-muted">{COPY.emptyTree}</p>
            ) : (
              <div>
                {sortedFileTreeDirs(tree).map((dir) => (
                  <DirRow
                    key={dir.path}
                    dir={dir}
                    depth={0}
                    expanded={expanded}
                    changedPaths={changedPaths}
                    changedDirs={changedDirs}
                    onToggle={toggleDir}
                    onOpen={openFile}
                  />
                ))}
                {sortedFileTreeFiles(tree).map((file) => (
                  <FileRow
                    key={file.path}
                    name={file.name}
                    path={file.path}
                    depth={0}
                    changed={changedPaths.has(file.path)}
                    onOpen={openFile}
                  />
                ))}
              </div>
            )
          ) : null}
        </div>
      </SidebarSection>

      {openPath ? (
        <Suspense fallback={null}>
          <FileViewerModal
            projectId={projectId}
            path={openPath}
            onClose={closeFile}
            onSelectionChange={(selection) =>
              onActiveFileChange?.(selection ? { path: openPath, selection } : { path: openPath })
            }
          />
        </Suspense>
      ) : null}
    </>
  )
}

function DirRow({
  dir,
  depth,
  expanded,
  changedPaths,
  changedDirs,
  onToggle,
  onOpen,
}: Readonly<{
  dir: FileTreeDir
  depth: number
  expanded: Set<string>
  changedPaths: Set<string>
  changedDirs: Set<string>
  onToggle: (path: string) => void
  onOpen: (path: string) => void
}>): ReactElement {
  const open = expanded.has(dir.path)
  const changed = changedDirs.has(dir.path)
  return (
    <div>
      <button
        type="button"
        onClick={() => onToggle(dir.path)}
        className={ROW}
        style={{ paddingLeft: `${6 + depth * 12}px` }}
      >
        <DirChevron open={open} />
        <span className={`min-w-0 truncate ${changed ? 'text-accent' : ''}`}>{dir.name}</span>
      </button>
      {open ? (
        <div>
          {sortedFileTreeDirs(dir).map((child) => (
            <DirRow
              key={child.path}
              dir={child}
              depth={depth + 1}
              expanded={expanded}
              changedPaths={changedPaths}
              changedDirs={changedDirs}
              onToggle={onToggle}
              onOpen={onOpen}
            />
          ))}
          {sortedFileTreeFiles(dir).map((file) => (
            <FileRow
              key={file.path}
              name={file.name}
              path={file.path}
              depth={depth + 1}
              changed={changedPaths.has(file.path)}
              onOpen={onOpen}
            />
          ))}
        </div>
      ) : null}
    </div>
  )
}

function FileRow({
  name,
  path,
  depth,
  changed,
  onOpen,
}: Readonly<{
  name: string
  path: string
  depth: number
  changed: boolean
  onOpen: (path: string) => void
}>): ReactElement {
  return (
    <button
      type="button"
      draggable
      onDragStart={(event) => {
        // Path relativo confiável para o composer anexar sem ler o arquivo aqui.
        event.dataTransfer.setData(DROP_PATH_MIME, path)
        event.dataTransfer.effectAllowed = 'copy'
      }}
      onClick={() => onOpen(path)}
      title={path}
      className={ROW}
      style={{ paddingLeft: `${6 + depth * 12}px` }}
    >
      <FileGlyph />
      <span className={`min-w-0 truncate ${changed ? 'text-accent' : ''}`}>{name}</span>
    </button>
  )
}

function DirChevron({ open }: Readonly<{ open: boolean }>): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      className={`h-[11px] w-[11px] flex-none text-muted transition-transform ${open ? 'rotate-90' : ''}`}
      aria-hidden="true"
      focusable="false"
    >
      <path d="m9 6 6 6-6 6" />
    </svg>
  )
}

function FileGlyph(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      className="h-[12px] w-[12px] flex-none text-muted/70"
      aria-hidden="true"
      focusable="false"
    >
      <path d="m8 8-4 4 4 4M16 8l4 4-4 4" />
    </svg>
  )
}
