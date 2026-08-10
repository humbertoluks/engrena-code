import { useEffect, useState, type ReactElement } from 'react'
import { projectFilesService } from '../../services/project-files-service'
import { ButtonSecondary, Modal } from '@engrena/ui'

const COPY = {
  title: 'Arquivo',
  loading: 'Carregando…',
  close: 'Fechar',
  errorGeneric: 'Não foi possível abrir o arquivo.',
  errorNetwork: 'Não foi possível contatar o servidor local.',
} as const

export interface FileViewerModalProps {
  projectId: string
  path: string
  onClose: () => void
}

/** Read-only text viewer for a project file (FileExplorer). */
export function FileViewerModal({ projectId, path, onClose }: Readonly<FileViewerModalProps>): ReactElement {
  const [content, setContent] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    setError(null)
    setContent(null)
    void projectFilesService
      .read(projectId, path)
      .then((res) => {
        if (cancelled) return
        if (res.error) {
          setError(res.error.message || COPY.errorGeneric)
          return
        }
        setContent(res.content)
      })
      .catch(() => {
        if (!cancelled) setError(COPY.errorNetwork)
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [projectId, path])

  return (
    <Modal
      onClose={onClose}
      ariaLabel={COPY.title}
      closeLabel={COPY.close}
      showCloseButton={false}
      closeOnBackdrop
      padded={false}
      overlayClassName="p-md"
      panelClassName="flex max-h-[85vh] max-w-[52rem] flex-col overflow-hidden rounded-xl"
    >
      <div className="flex items-center justify-between gap-sm border-b border-border px-md py-sm">
        <h2 className="m-0 truncate font-mono text-[13px] font-semibold text-fg" title={path}>
          {path}
        </h2>
        <ButtonSecondary onClick={onClose}>{COPY.close}</ButtonSecondary>
      </div>
      <div className="min-h-0 flex-1 overflow-auto p-md">
        {loading ? <p className="m-0 text-[12.5px] text-muted">{COPY.loading}</p> : null}
        {error ? (
          <p role="alert" className="m-0 text-[12.5px] text-red">
            {error}
          </p>
        ) : null}
        {content !== null ? (
          <pre className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-fg">
            {content}
          </pre>
        ) : null}
      </div>
    </Modal>
  )
}
