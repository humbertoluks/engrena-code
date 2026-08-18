import { useState } from 'react'
import type { ReactElement } from 'react'
import { LOGIN_PRODUCT_CONFIG, Modal, readUnlockedWorkspace } from '@engrena/ui'
import { browseFolder } from '../../services/projects-service'
import { resolveBrowseStartPath } from './addProjectModal.logic'

const COPY = {
  title: 'Adicionar projeto',
  close: 'Fechar',
  labelPath: 'Diretório local',
  placeholderPath: '/caminho/do/repositorio',
  browse: 'Procurar…',
  hintPath: 'Selecione um diretório existente que contém um repositório git.',
  labelName: 'Nome do projeto',
  labelNameOptional: '(opcional)',
  placeholderName: 'ex: engrenacode-shell',
  hintName: 'Quando vazio, usamos o nome do diretório.',
  ctaCancel: 'Cancelar',
  ctaPrimary: 'Adicionar',
  ctaLoading: 'Adicionando...',
  errorNetwork: 'Nao foi possivel contatar o servidor local. Verifique se o EngrenaCode esta em execucao.',
  errorGeneric: 'Nao foi possivel adicionar o projeto. Tente novamente.',
  errorDuplicate: 'Este diretório já foi adicionado como projeto.',
  errorNotFound: 'O caminho informado não existe no sistema de arquivos.',
  errorNotDir: 'O caminho informado não é um diretório.',
  errorPermission: 'Sem permissão de leitura no diretório informado.',
  errorAccess: 'Não foi possível acessar o caminho informado.',
  errorInvalid: 'Informe um caminho de diretório válido.',
} as const

function mapPathErrorMessage(code: string, reason: string | undefined): string {
  if (code === 'project_duplicate') return COPY.errorDuplicate
  if (code === 'project_path_invalid') {
    if (reason === 'not_found') return COPY.errorNotFound
    if (reason === 'not_directory') return COPY.errorNotDir
    if (reason === 'permission_denied') return COPY.errorPermission
    if (reason === 'access_error') return COPY.errorAccess
    return COPY.errorInvalid
  }
  return COPY.errorGeneric
}

export interface AddProjectModalProps {
  onClose: () => void
  onSubmit: (path: string, name: string) => Promise<{ ok: boolean; error?: { code: string; message: string; details?: Record<string, unknown> } }>
}

export function AddProjectModal({ onClose, onSubmit }: Readonly<AddProjectModalProps>): ReactElement {
  const [path, setPath] = useState('')
  const [name, setName] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleBrowse(): Promise<void> {
    const login = LOGIN_PRODUCT_CONFIG.code
    const unlocked = readUnlockedWorkspace(login.workspaceStorageKey, login.defaultWorkspace)
    const picked = await browseFolder(resolveBrowseStartPath(path, unlocked))
    if (picked) setPath(picked)
  }

  async function handleSubmit(): Promise<void> {
    if (path.trim() === '') {
      setError(COPY.errorInvalid)
      return
    }
    setLoading(true)
    setError(null)
    try {
      const result = await onSubmit(path.trim(), name.trim())
      if (!result.ok && result.error) {
        const reason = result.error.details?.reason as string | undefined
        setError(mapPathErrorMessage(result.error.code, reason))
      }
    } catch {
      setError(COPY.errorNetwork)
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      title={COPY.title}
      onClose={onClose}
      closeLabel={COPY.close}
      panelClassName="max-w-[28rem] rounded-lg"
    >
      {error !== null ? (
        <p role="alert" className="mb-md text-[13px] text-red">
          {error}
        </p>
      ) : null}

      <div className="mb-md">
        <label htmlFor="add-project-path" className="mb-xs block text-[12px] font-medium text-muted">
          {COPY.labelPath}
        </label>
        <div className="flex gap-xs">
          <input
            id="add-project-path"
            type="text"
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={COPY.placeholderPath}
            className="flex-1 rounded-md border border-border bg-surface-2 px-sm py-xs text-[13px] text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          />
          <button
            type="button"
            onClick={handleBrowse}
            className="shrink-0 rounded-md border border-border bg-surface-2 px-sm py-xs text-[13px] hover:bg-surface"
          >
            {COPY.browse}
          </button>
        </div>
        <p className="mt-xs text-[11px] text-muted">{COPY.hintPath}</p>
      </div>

      <div className="mb-lg">
        <label htmlFor="add-project-name" className="mb-xs block text-[12px] font-medium text-muted">
          {COPY.labelName} <span className="text-muted">{COPY.labelNameOptional}</span>
        </label>
        <input
          id="add-project-name"
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={COPY.placeholderName}
          className="w-full rounded-md border border-border bg-surface-2 px-sm py-xs text-[13px] text-fg placeholder:text-muted focus:outline-none focus-visible:ring-2 focus-visible:ring-accent"
        />
        <p className="mt-xs text-[11px] text-muted">{COPY.hintName}</p>
      </div>

      <div className="flex justify-end gap-xs">
        <button
          type="button"
          onClick={onClose}
          className="rounded-md border border-border bg-surface-2 px-md py-xs text-[13px] hover:bg-surface"
        >
          {COPY.ctaCancel}
        </button>
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={path.trim() === '' || loading}
          className="rounded-md bg-accent px-md py-xs text-[13px] font-medium text-white disabled:opacity-50"
        >
          {loading ? COPY.ctaLoading : COPY.ctaPrimary}
        </button>
      </div>
    </Modal>
  )
}
