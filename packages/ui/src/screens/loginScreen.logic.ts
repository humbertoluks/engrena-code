export type UnlockErrorKind = 'invalid' | 'corrupted' | 'backoff' | 'network' | null

export interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
  error?: { code?: string; message?: string }
}

/** Produto que monta o gate de unlock compartilhado. */
export type LoginProduct = 'code' | 'plan'

export interface LoginProductConfig {
  product: LoginProduct
  brand: 'EngrenaCode' | 'EngrenaPlan'
  unlockOrigin: string
  defaultWorkspace: string
  successHash: string
  instruction: string
  hintWorkspace: string
  footer: string
}

export const CODE_UNLOCK_ORIGIN = 'http://127.0.0.1:5174' as const
export const PLAN_UNLOCK_ORIGIN = 'http://127.0.0.1:5184' as const
export const CODE_BRAND = 'EngrenaCode' as const
export const PLAN_BRAND = 'EngrenaPlan' as const

const SHARED_COPY = {
  labelWorkspace: 'Workspace',
  labelPassword: 'Senha do cofre local',
  placeholderPassword: '••••••••',
  ctaPrimary: 'Desbloquear workspace',
  ctaLoading: 'Desbloqueando...',
  errorInvalid: 'Workspace ou senha inválidos.',
  errorCorrupted:
    'O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.',
} as const

export const LOGIN_COPY_SHARED = SHARED_COPY

export const LOGIN_PRODUCT_CONFIG: Record<LoginProduct, LoginProductConfig> = {
  code: {
    product: 'code',
    brand: CODE_BRAND,
    unlockOrigin: CODE_UNLOCK_ORIGIN,
    defaultWorkspace: '~/dev',
    successHash: '#dashboard',
    instruction: 'Desbloqueie o workspace local para abrir seus projetos e threads.',
    hintWorkspace: 'Diretório raiz onde o EngrenaCode indexa seus repositórios.',
    footer:
      'As chaves dos providers e o token do GitHub ficam apenas no filesystem local deste dispositivo.',
  },
  plan: {
    product: 'plan',
    brand: PLAN_BRAND,
    unlockOrigin: PLAN_UNLOCK_ORIGIN,
    defaultWorkspace: '~/plan',
    successHash: '#shell',
    instruction:
      'Desbloqueie o workspace local para planejar Discovery, PRD, Spec e Plano.',
    hintWorkspace: 'Diretório raiz onde o EngrenaPlan guarda artefatos de planejamento.',
    footer: 'Segredos e sessão ficam apenas no filesystem local deste dispositivo.',
  },
}

/** Mensagem visível no gate de unlock a partir do kind + backoff + marca do produto. */
export function messageForError(
  kind: UnlockErrorKind,
  remainingMs: number,
  brand: LoginProductConfig['brand'],
): string | null {
  switch (kind) {
    case 'invalid':
      return SHARED_COPY.errorInvalid
    case 'corrupted':
      return SHARED_COPY.errorCorrupted
    case 'network':
      return `Não foi possível contatar o servidor local. Verifique se o ${brand} está em execução.`
    case 'backoff':
      return `Muitas tentativas. Tente novamente em ${Math.ceil(remainingMs / 1000)}s.`
    default:
      return null
  }
}

/**
 * Classifica falha HTTP de POST /api/vault/unlock (F01).
 * 422 / vault_corrupted → corrupted; 429 ou retryAfterMs → backoff; demais → invalid.
 */
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
