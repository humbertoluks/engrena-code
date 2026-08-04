export const CONTENT_SOFT_WARN_BYTES = 8 * 1024
export const CONTENT_HARD_MAX_BYTES = 1024 * 1024
export const AGGREGATE_SOFT_WARN_BYTES = 16 * 1024

export function contentByteLength(content: string): number {
  return new TextEncoder().encode(content).length
}

export function isNameInvalid(name: string): boolean {
  for (let i = 0; i < name.length; i++) {
    const code = name.charCodeAt(i)
    if (code === 10 || code === 13) return true
    if (code < 32 && code !== 9) return true
  }
  return false
}

export function isNameEmpty(name: string): boolean {
  return name.trim() === ''
}

export function isContentOverSoftWarn(content: string): boolean {
  return contentByteLength(content) > CONTENT_SOFT_WARN_BYTES
}

export function isContentOverHardCap(content: string): boolean {
  return contentByteLength(content) > CONTENT_HARD_MAX_BYTES
}

export function isAggregateHot(totalBytes: number): boolean {
  return totalBytes > AGGREGATE_SOFT_WARN_BYTES
}

const KB_FORMATTER = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 })
const COUNT_FORMATTER = new Intl.NumberFormat('pt-BR')

export function formatKb(bytes: number): string {
  return `~${KB_FORMATTER.format(bytes / 1024)} KB`
}

export function formatContentSize(content: string): string {
  const bytes = contentByteLength(content)
  return `${COUNT_FORMATTER.format(content.length)} caracteres (${formatKb(bytes)})`
}

export function canSubmitRuleForm(name: string, content: string, saving: boolean): boolean {
  if (saving) return false
  if (isNameEmpty(name) || isNameInvalid(name)) return false
  if (content.trim() === '') return false
  return true
}
