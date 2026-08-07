import { useRef } from 'react'
import type { ChangeEvent, ReactElement } from 'react'
import type { ComposerImage } from '../../hooks/usePrincipalWorkspace'
import { canAddMoreImages, isAllowedImageMimeType, validateImageFile } from './composer.logic'

const COPY = {
  attachAria: 'Anexar imagens',
  attachTitle: 'Anexar imagens (o provider recebe nativo ou descrito por visão)',
  attachedAria: 'Imagens anexadas',
  remove: 'Remover',
  removeAria: (name: string): string => `Remover ${name}`,
  disabledMultimodal: 'Este provider não aceita anexos de imagem.',
} as const

/** Tira de thumbs acima do textarea (ui.md anatomia item 1) — presentational, separada do CTA (item 5.6). */
export function ImageAttachmentThumbs({
  images,
  onRemove,
}: Readonly<{ images: ComposerImage[]; onRemove: (id: string) => void }>): ReactElement | null {
  if (images.length === 0) return null
  return (
    <div aria-label={COPY.attachedAria} className="flex flex-wrap gap-xs">
      {images.map((img) => (
        <div key={img.id} className="group relative h-16 w-16 overflow-hidden rounded-md border border-border">
          <img src={`data:${img.mimeType};base64,${img.dataBase64}`} alt={img.name} className="h-full w-full object-cover" />
          <button
            type="button"
            onClick={() => onRemove(img.id)}
            title={COPY.remove}
            aria-label={COPY.removeAria(img.name)}
            className="absolute right-0 top-0 rounded-bl-md bg-surface/90 px-[4px] text-[10px] text-muted opacity-0 group-hover:opacity-100 hover:text-red"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

function readFileAsBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => {
      const result = reader.result as string
      resolve(result.slice(result.indexOf(',') + 1))
    }
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(file)
  })
}

export interface ComposerImageAttachmentsProps {
  /** Contagem atual de imagens no draft — só usada para respeitar o teto de 5, o CTA não renderiza thumbs. */
  currentCount: number
  multimodal: boolean
  disabled: boolean
  onAdd: (images: ComposerImage[]) => void
  onError: (message: string) => void
}

/** CTA "Anexar imagens" (clipe) + input escondido — item 5.6 da anatomia (ui.md), separado da tira de thumbs. */
export function ComposerImageAttachments({
  currentCount,
  multimodal,
  disabled,
  onAdd,
  onError,
}: Readonly<ComposerImageAttachmentsProps>): ReactElement {
  const inputRef = useRef<HTMLInputElement>(null)

  async function handleFiles(fileList: FileList): Promise<void> {
    const files = Array.from(fileList)
    if (!canAddMoreImages(currentCount, files.length)) {
      onError('Você pode anexar até 5 imagens por mensagem.')
      return
    }

    const accepted: ComposerImage[] = []
    for (const file of files) {
      const validation = validateImageFile(file)
      if (!validation.ok) {
        onError(validation.message)
        continue
      }
      if (!isAllowedImageMimeType(file.type)) continue
      const dataBase64 = await readFileAsBase64(file)
      accepted.push({
        id: `img_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        mimeType: file.type,
        name: file.name,
        dataBase64,
        byteLength: file.size,
      })
    }
    if (accepted.length > 0) onAdd(accepted)
  }

  function handleInputChange(e: ChangeEvent<HTMLInputElement>): void {
    if (e.target.files) void handleFiles(e.target.files)
    e.target.value = ''
  }

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        multiple
        hidden
        onChange={handleInputChange}
      />
      <button
        type="button"
        disabled={disabled || !multimodal}
        title={multimodal ? COPY.attachTitle : COPY.disabledMultimodal}
        aria-label={COPY.attachAria}
        onClick={() => inputRef.current?.click()}
        className="rounded-md border border-border bg-surface px-xs py-[3px] text-[12px] text-muted hover:bg-surface-2 disabled:opacity-40"
      >
        📎
      </button>
    </>
  )
}
