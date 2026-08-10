export const DESCRIPTION_WARN_CHARS = 200
export const CONTENT_MAX_BYTES = 1_048_576

export function contentByteLength(content: string): number {
  return new TextEncoder().encode(content).length
}

export function isDescriptionLong(description: string): boolean {
  return description.length > DESCRIPTION_WARN_CHARS
}

export function isContentOverLimit(content: string): boolean {
  return contentByteLength(content) > CONTENT_MAX_BYTES
}

export function formatContentSize(content: string): string {
  const chars = content.length
  const bytes = contentByteLength(content)
  const kb = bytes / 1024
  const sizeLabel = kb >= 1
    ? `~${kb.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} KB`
    : `~${bytes} B`
  return `${chars.toLocaleString('pt-BR')} caracteres (${sizeLabel})`
}

export interface SkillFormValues {
  name: string
  description: string
  content: string
}

export function canSubmitSkillForm(values: SkillFormValues, saving: boolean): boolean {
  if (saving) return false
  if (values.name.trim() === '') return false
  if (values.description.trim() === '') return false
  if (values.content.trim() === '') return false
  if (isContentOverLimit(values.content)) return false
  return true
}
