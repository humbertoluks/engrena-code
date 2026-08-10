export type UnlockErrorKind = 'invalid' | 'corrupted' | 'backoff' | 'network' | null

export interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
  error?: { code?: string; message?: string }
}

const COPY = {
  errorInvalid: 'Workspace ou senha inválidos.',
  errorCorrupted:
    'O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.',
  errorNetwork:
    'Não foi possível contatar o servidor local. Verifique se o EngrenaPlan está em execução.',
} as const

export function messageForError(kind: UnlockErrorKind, remainingMs: number): string | null {
  switch (kind) {
    case 'invalid':
      return COPY.errorInvalid
    case 'corrupted':
      return COPY.errorCorrupted
    case 'network':
      return COPY.errorNetwork
    case 'backoff':
      return `Muitas tentativas. Tente novamente em ${Math.ceil(remainingMs / 1000)}s.`
    default:
      return null
  }
}

export function classifyUnlockFailure(
  response: { status: number },
  data: VaultUnlockResponse,
): { kind: UnlockErrorKind; retryMs: number } {
  const errorCode = data.error?.code
  if (errorCode === 'vault_corrupted' || response.status === 422) {
    return { kind: 'corrupted', retryMs: 0 }
  }

  const retryMs = typeof data.retryAfterMs === 'number' ? data.retryAfterMs : 0

  if (response.status === 429 || retryMs > 0) {
    return { kind: retryMs > 0 ? 'backoff' : 'invalid', retryMs }
  }

  return { kind: 'invalid', retryMs: 0 }
}

/** Unlock HTTP base — Plan loopback (Code usa 5174). */
export const PLAN_UNLOCK_ORIGIN = 'http://127.0.0.1:5184'

/** Brand wordmark suffix — smoke leve sem montar React. */
export const PLAN_BRAND = 'EngrenaPlan' as const
