/** Sem dependências Node — importável tanto pelo main/services quanto pelo renderer (spec F16 §5.3/§7.1). */

export const MAX_IMAGES_PER_MESSAGE = 5
export const MAX_IMAGE_BYTES = 4 * 1024 * 1024
export const ALLOWED_IMAGE_MIME_TYPES = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'] as const
export type AllowedImageMimeType = (typeof ALLOWED_IMAGE_MIME_TYPES)[number]

export interface ComposerImageInput {
  mimeType: string
  name?: string
  dataBase64: string
}

export type ImageValidationErrorCode =
  | 'image_limit_exceeded'
  | 'image_type_invalid'
  | 'image_too_large'
  | 'validation_error'

export interface ImageValidationError {
  code: ImageValidationErrorCode
  message: string
}

/** Tamanho decodificado estimado a partir do comprimento base64 — sem alocar o buffer inteiro. */
export function estimateBase64ByteLength(base64: string): number {
  const clean = base64.replace(/[^A-Za-z0-9+/=]/g, '')
  if (clean.length === 0) return 0
  const padding = clean.endsWith('==') ? 2 : clean.endsWith('=') ? 1 : 0
  return Math.max(0, Math.floor((clean.length * 3) / 4) - padding)
}

/** Regras: ≤5 imagens, ≤4 MiB cada, MIME na allowlist (spec F16 §3.2/§5.3). `null` = válido. */
export function validateComposerImages(images: unknown): ImageValidationError | null {
  if (!Array.isArray(images)) {
    return { code: 'validation_error', message: 'images deve ser uma lista.' }
  }
  if (images.length > MAX_IMAGES_PER_MESSAGE) {
    return {
      code: 'image_limit_exceeded',
      message: `Você pode anexar até ${MAX_IMAGES_PER_MESSAGE} imagens por mensagem.`,
    }
  }

  for (const raw of images) {
    if (typeof raw !== 'object' || raw === null) {
      return { code: 'validation_error', message: 'Imagem inválida.' }
    }
    const img = raw as Partial<ComposerImageInput>
    const name = typeof img.name === 'string' && img.name ? img.name : 'imagem'

    if (typeof img.mimeType !== 'string' || !(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(img.mimeType)) {
      return { code: 'image_type_invalid', message: `Tipo não suportado em "${name}". Anexe apenas imagens.` }
    }
    if (typeof img.dataBase64 !== 'string' || img.dataBase64 === '') {
      return { code: 'validation_error', message: `Imagem "${name}" sem conteúdo.` }
    }
    if (estimateBase64ByteLength(img.dataBase64) > MAX_IMAGE_BYTES) {
      return { code: 'image_too_large', message: `"${name}" excede o limite de 4 MB.` }
    }
  }

  return null
}
