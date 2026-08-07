export const KEY_VALIDATION_MESSAGES = {
  spaces: 'A chave não pode conter espaços.',
  short: 'Chave muito curta para ser válida.',
  claudeFormat: 'Formato inválido. Esperado: sk-ant-…',
  codexFormat: 'Formato inválido. Esperado: sk-… ou sk-codex-…',
} as const

export function validateClaudeKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return KEY_VALIDATION_MESSAGES.spaces
  if (v.length < 8) return KEY_VALIDATION_MESSAGES.short
  if (!v.startsWith('sk-ant-')) return KEY_VALIDATION_MESSAGES.claudeFormat
  return null
}

export function validateCodexKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return KEY_VALIDATION_MESSAGES.spaces
  if (v.length < 8) return KEY_VALIDATION_MESSAGES.short
  if (!v.startsWith('sk-')) return KEY_VALIDATION_MESSAGES.codexFormat
  return null
}

export function validateMinimaxKeyLocal(v: string): string | null {
  if (v === '') return null
  if (/\s/.test(v)) return KEY_VALIDATION_MESSAGES.spaces
  if (v.length < 8) return KEY_VALIDATION_MESSAGES.short
  return null
}
