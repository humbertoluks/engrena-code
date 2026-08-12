import { useCallback, useEffect, useRef, useState, type ReactElement } from 'react'
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
  /** Seleção corrente do texto — alimenta o contexto implícito do composer. */
  onSelectionChange?: (selection: { text: string; startLine?: number; endLine?: number } | null) => void
}

/** Read-only text viewer for a project file (FileExplorer). */
export function FileViewerModal({
  projectId,
  path,
  onClose,
  onSelectionChange,
}: Readonly<FileViewerModalProps>): ReactElement {
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

  const preRef = useRef<HTMLPreElement>(null)

  /**
   * Espelha o contexto implícito do VS Code (`chatImplicitContext.ts`): a seleção corrente do
   * arquivo aberto vira contexto do próximo turno. As linhas saem do offset dentro do texto já
   * carregado — sem editor, é a única fonte de numeração confiável.
   */
  const handleSelection = useCallback(() => {
    if (!onSelectionChange) return
    const selection = window.getSelection()
    const container = preRef.current
    if (!selection || selection.isCollapsed || !container || content === null) {
      onSelectionChange(null)
      return
    }
    if (!container.contains(selection.anchorNode) || !container.contains(selection.focusNode)) return

    const text = selection.toString()
    if (text.trim() === '') {
      onSelectionChange(null)
      return
    }
    const start = content.indexOf(text)
    if (start === -1) {
      onSelectionChange({ text })
      return
    }
    const newline = String.fromCharCode(10)
    const startLine = content.slice(0, start).split(newline).length
    const endLine = startLine + text.split(newline).length - 1
    onSelectionChange({ text, startLine, endLine })
  }, [content, onSelectionChange])

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
          <pre
            ref={preRef}
            onMouseUp={handleSelection}
            onKeyUp={handleSelection}
            className="m-0 whitespace-pre-wrap break-words font-mono text-[12px] leading-relaxed text-fg"
          >
            {content}
          </pre>
        ) : null}
      </div>
    </Modal>
  )
}
