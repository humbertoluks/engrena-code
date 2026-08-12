import type { ReactElement } from 'react'
import type { ComposerImage } from '../../hooks/usePrincipalWorkspace'
import { attachmentChipLabel, type ComposerAttachment } from './composerAttachments.logic'

const COPY = {
  strip: 'Contexto anexado',
  remove: 'Remover do contexto',
  implicitTitle: 'Arquivo aberto agora — clique no × para não enviar',
  removeImage: (name: string): string => `Remover ${name}`,
} as const

function ChipShell({
  label,
  title,
  icon,
  muted,
  onRemove,
  removeLabel,
}: Readonly<{
  label: string
  title: string
  icon: string
  muted?: boolean
  onRemove: () => void
  removeLabel: string
}>): ReactElement {
  return (
    <span
      title={title}
      className={`inline-flex max-w-[16rem] items-center gap-[5px] rounded-md border px-xs py-[2px] text-[11.5px] ${
        muted ? 'border-dashed border-border text-muted' : 'border-border bg-surface text-fg/85'
      }`}
    >
      <span aria-hidden="true">{icon}</span>
      <span className="min-w-0 flex-1 truncate font-mono text-[11px]">{label}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={removeLabel}
        title={COPY.remove}
        className="flex-none text-muted hover:text-red"
      >
        ×
      </button>
    </span>
  )
}

export interface ComposerContextChipsProps {
  attachments: readonly ComposerAttachment[]
  images: readonly ComposerImage[]
  onRemoveAttachment: (id: string) => void
  onRemoveImage: (id: string) => void
}

/**
 * Tira única de contexto acima do textarea: arquivo, seleção e imagem no mesmo lugar, cada um
 * removível — equivalente aos attachment widgets do Copilot Chat. O chip implícito (arquivo
 * aberto) aparece tracejado, para o usuário distinguir do que ele anexou de propósito.
 */
export function ComposerContextChips({
  attachments,
  images,
  onRemoveAttachment,
  onRemoveImage,
}: Readonly<ComposerContextChipsProps>): ReactElement | null {
  if (attachments.length === 0 && images.length === 0) return null

  return (
    <ul aria-label={COPY.strip} className="mb-xs flex list-none flex-wrap items-center gap-xs p-0">
      {attachments.map((attachment) => {
        const label = attachmentChipLabel(attachment)
        return (
          <li key={attachment.id} className="contents">
          <ChipShell
            label={label}
            title={attachment.implicit ? COPY.implicitTitle : label}
            icon={attachment.kind === 'selection' ? '✂' : '📄'}
            muted={attachment.implicit === true}
            onRemove={() => onRemoveAttachment(attachment.id)}
            removeLabel={`${COPY.remove}: ${label}`}
          />
          </li>
        )
      })}
      {images.map((image) => (
        <li
          key={image.id}
          className="contents"
        >
        <span
          className="group relative h-12 w-12 overflow-hidden rounded-md border border-border"
          title={image.name}
        >
          <img
            src={`data:${image.mimeType};base64,${image.dataBase64}`}
            alt={image.name}
            className="h-full w-full object-cover"
          />
          <button
            type="button"
            onClick={() => onRemoveImage(image.id)}
            aria-label={COPY.removeImage(image.name)}
            className="absolute right-0 top-0 rounded-bl-md bg-surface/90 px-[3px] text-[10px] text-muted opacity-0 group-hover:opacity-100 hover:text-red"
          >
            ×
          </button>
        </span>
        </li>
      ))}
    </ul>
  )
}
