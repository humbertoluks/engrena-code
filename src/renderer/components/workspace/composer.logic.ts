import {
  ALLOWED_IMAGE_MIME_TYPES,
  MAX_IMAGES_PER_MESSAGE,
  MAX_IMAGE_BYTES,
  type AllowedImageMimeType,
} from '../../../services/runner/providers/composer-images.js'

/** Debounce piso do menu `@` (spec F16 §3.2/ui.md) — usado pelo componente, exportado para o contrato de teste. */
export const MENTION_DEBOUNCE_MS = 150
export const MENTION_RESULTS_LIMIT = 50

export interface MentionQuery {
  query: string
  start: number
}

/** Token `@query` que contém o cursor agora — `null` se o cursor não está dentro de um `@token` sem espaço. */
export function extractMentionQuery(text: string, cursor: number): MentionQuery | null {
  const upto = text.slice(0, cursor)
  const at = upto.lastIndexOf('@')
  if (at === -1) return null
  const between = upto.slice(at + 1)
  if (/\s/.test(between)) return null
  return { query: between, start: at }
}

/** Substitui o token `@query` pelo path relativo escolhido + espaço; devolve texto e posição de cursor resultante. */
export function insertMentionPath(
  text: string,
  mention: MentionQuery,
  path: string,
  cursor: number
): { text: string; cursor: number } {
  const before = text.slice(0, mention.start)
  const after = text.slice(cursor)
  const inserted = `@${path} `
  return { text: before + inserted + after, cursor: (before + inserted).length }
}

/** Modelo selecionado se pertence ao catálogo do provider; senão o default do catálogo (spec F16 §3.2 clamp). */
export function clampCatalogModel(models: string[], defaultModel: string, model: string | null): string {
  if (model !== null && models.includes(model)) return model
  return defaultModel
}

export function clampCatalogReasoningLevel(
  levels: string[],
  defaultLevel: string | null,
  level: string | null
): string | null {
  if (level !== null && levels.includes(level)) return level
  return defaultLevel
}

export type ImageValidationResult = { ok: true } | { ok: false; code: 'type' | 'size'; message: string }

/** Validação client-side espelhando `composer-images.ts` (server) — spec F16 §7.1 test_validate_composer_images. */
export function validateImageFile(file: { type: string; size: number; name: string }): ImageValidationResult {
  if (!(ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, code: 'type', message: `Tipo não suportado em "${file.name}". Anexe apenas imagens.` }
  }
  if (file.size > MAX_IMAGE_BYTES) {
    return { ok: false, code: 'size', message: `"${file.name}" excede o limite de 4 MB.` }
  }
  return { ok: true }
}

export function canAddMoreImages(currentCount: number, incomingCount = 1): boolean {
  return currentCount + incomingCount <= MAX_IMAGES_PER_MESSAGE
}

export function isAllowedImageMimeType(mimeType: string): mimeType is AllowedImageMimeType {
  return (ALLOWED_IMAGE_MIME_TYPES as readonly string[]).includes(mimeType)
}
