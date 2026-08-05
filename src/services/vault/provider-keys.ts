export type ProviderKeyValidation =
  | { ok: true; action: 'skip' }
  | { ok: true; action: 'save'; key: string }
  | { ok: false; message: string }

const MIN_KEY_LENGTH = 8

/** Empty string preserves whatever is already saved — there is no "clear key" affordance in the F10 form. */
function baseChecks(key: string): ProviderKeyValidation | null {
  if (key === '') return { ok: true, action: 'skip' }
  if (/\s/.test(key)) return { ok: false, message: 'A chave não pode conter espaços.' }
  if (key.length < MIN_KEY_LENGTH) return { ok: false, message: 'Chave muito curta para ser válida.' }
  return null
}

/** Local format checks (no remote ping). Empty string means "leave unchanged" (save is a merge). */
export function validateClaudeKey(key: string): ProviderKeyValidation {
  const base = baseChecks(key)
  if (base) return base
  if (!key.startsWith('sk-ant-')) {
    return { ok: false, message: 'Formato inválido. Esperado: sk-ant-…' }
  }
  return { ok: true, action: 'save', key }
}

export function validateCodexKey(key: string): ProviderKeyValidation {
  const base = baseChecks(key)
  if (base) return base
  if (!key.startsWith('sk-')) {
    return { ok: false, message: 'Formato inválido. Esperado: sk-… ou sk-codex-…' }
  }
  return { ok: true, action: 'save', key }
}

/** Minimax has no documented prefix — loose validator (whitespace + min length only). */
export function validateMinimaxKey(key: string): ProviderKeyValidation {
  const base = baseChecks(key)
  if (base) return base
  return { ok: true, action: 'save', key }
}
