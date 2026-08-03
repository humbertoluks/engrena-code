/**
 * Tela #login — gate de cofre local.
 * Fidelidade: docs/F01-vault-e-sessao-local/ui.md + copy.md
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { BrandMark, BrandWordmark } from '../components/BrandMark'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { ThemeControl } from '../components/ThemeControl'

interface LoginScreenProps {
  onUnlock?: () => void
}

interface VaultUnlockResponse {
  unlocked: boolean
  sessionToken?: string
  retryAfterMs?: number
  error?: { code?: string; message?: string }
}

type ErrorKind = 'invalid' | 'corrupted' | 'backoff' | 'network' | null

/** Copy — docs/F01-vault-e-sessao-local/copy.md */
const COPY = {
  instruction:
    'Desbloqueie o workspace local para abrir seus projetos e threads.',
  labelWorkspace: 'Workspace',
  hintWorkspace:
    'Diretório raiz onde o EngrenaCode indexa seus repositórios.',
  labelPassword: 'Senha do cofre local',
  placeholderPassword: '••••••••',
  ctaPrimary: 'Desbloquear workspace',
  ctaLoading: 'Desbloqueando...',
  footer:
    'As chaves dos providers e o token do GitHub ficam apenas no filesystem local deste dispositivo.',
  errorInvalid: 'Workspace ou senha inválidos.',
  errorCorrupted:
    'O cofre local está danificado ou ilegível. Restaure um backup ou recrie o workspace.',
  errorNetwork:
    'Não foi possível contatar o servidor local. Verifique se o EngrenaCode está em execução.',
} as const

const GATE_BACKGROUND =
  'radial-gradient(900px 500px at 50% -10%, rgba(255,107,0,0.08), transparent 60%)'

const INPUT_BASE =
  'w-full rounded-sm border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:ring-2'

function messageForError(kind: ErrorKind, remainingMs: number): string | null {
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

function classifyUnlockFailure(
  response: Response,
  data: VaultUnlockResponse,
): { kind: ErrorKind; retryMs: number } {
  const errorCode = data.error?.code
  if (errorCode === 'vault_corrupted' || response.status === 422) {
    return { kind: 'corrupted', retryMs: 0 }
  }

  const retryMs =
    typeof data.retryAfterMs === 'number' ? data.retryAfterMs : 0

  if (response.status === 429 || retryMs > 0) {
    return { kind: retryMs > 0 ? 'backoff' : 'invalid', retryMs }
  }

  return { kind: 'invalid', retryMs: 0 }
}

async function completeSessionUnlock(
  onUnlock?: () => void,
): Promise<ErrorKind | null> {
  if (!window.electronAPI?.invoke) return 'network'
  const token = await window.electronAPI.invoke('engrenacode:vault:get-session')
  if (!token) return 'network'
  localStorage.setItem('sessionToken', token as string)
  window.location.hash = '#dashboard'
  onUnlock?.()
  return null
}

export function LoginScreen({
  onUnlock,
}: Readonly<LoginScreenProps>): ReactElement {
  const [workspace, setWorkspace] = useState('~/dev')
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorKind, setErrorKind] = useState<ErrorKind>(null)
  const [backoffUntil, setBackoffUntil] = useState<number | null>(null)
  const [now, setNow] = useState(() => Date.now())

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (backoffUntil === null) return
    const tick = (): void => setNow(Date.now())
    tick()
    const id = window.setInterval(tick, 500)
    return () => window.clearInterval(id)
  }, [backoffUntil])

  const remainingMs =
    backoffUntil !== null ? Math.max(0, backoffUntil - now) : 0
  const inBackoff = remainingMs > 0

  useEffect(() => {
    if (backoffUntil !== null && remainingMs === 0) {
      setBackoffUntil(null)
      setErrorKind((kind) => (kind === 'backoff' ? null : kind))
    }
  }, [backoffUntil, remainingMs])

  const trimmedWorkspace = workspace.trim()
  const filled = trimmedWorkspace.length > 0 && password.length > 0
  const submitDisabled = !filled || submitting || inBackoff
  const errorMessage = messageForError(errorKind, remainingMs)
  const passwordInvalid = errorKind !== null && errorKind !== 'backoff'

  const handleSubmit = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      if (submitDisabled) return

      setSubmitting(true)
      setErrorKind(null)

      try {
        const response = await fetch('http://127.0.0.1:5174/api/vault/unlock', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            workspace: trimmedWorkspace,
            password,
          }),
        })

        let data: VaultUnlockResponse
        try {
          data = (await response.json()) as VaultUnlockResponse
        } catch {
          if (mountedRef.current) setErrorKind('network')
          return
        }

        if (!mountedRef.current) return

        if (response.ok && data.unlocked) {
          if (typeof data.sessionToken === 'string' && data.sessionToken) {
            localStorage.setItem('sessionToken', data.sessionToken)
            window.location.hash = '#dashboard'
            onUnlock?.()
            return
          }
          const sessionError = await completeSessionUnlock(onUnlock)
          if (mountedRef.current && sessionError) setErrorKind(sessionError)
          return
        }

        const failure = classifyUnlockFailure(response, data)
        if (failure.kind === 'backoff') {
          setBackoffUntil(Date.now() + failure.retryMs)
        }
        setErrorKind(failure.kind)
      } catch {
        if (mountedRef.current) setErrorKind('network')
      } finally {
        if (mountedRef.current) setSubmitting(false)
      }
    },
    [onUnlock, password, submitDisabled, trimmedWorkspace],
  )

  return (
    <section
      id="login"
      className="relative grid min-h-screen place-items-center bg-bg p-lg text-fg"
      style={{ backgroundImage: GATE_BACKGROUND }}
    >
      <div className="absolute right-md top-md">
        <ThemeControl />
      </div>

      <form
        className="w-full max-w-[24rem] rounded-lg border border-border bg-surface p-lg shadow-[0_24px_60px_-28px_rgba(0,0,0,0.7)]"
        onSubmit={handleSubmit}
        noValidate
      >
        <div className="mb-xs flex items-center gap-sm">
          <BrandMark size={30} />
          <BrandWordmark className="text-lg font-semibold tracking-tight" />
        </div>

        <p className="mb-lg text-sm text-muted">{COPY.instruction}</p>

        <div className="mb-md flex flex-col gap-xs">
          <label
            htmlFor="login-workspace"
            className="text-sm font-medium text-fg"
          >
            {COPY.labelWorkspace}
          </label>
          <input
            id="login-workspace"
            name="workspace"
            type="text"
            autoComplete="off"
            spellCheck={false}
            value={workspace}
            onChange={(e) => setWorkspace(e.target.value)}
            className={`${INPUT_BASE} border-border font-mono focus:border-accent focus:ring-accent/40`}
          />
          <span className="text-xs text-muted">{COPY.hintWorkspace}</span>
        </div>

        <div className="mb-md flex flex-col gap-xs">
          <label
            htmlFor="login-password"
            className="text-sm font-medium text-fg"
          >
            {COPY.labelPassword}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={COPY.placeholderPassword}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            aria-invalid={passwordInvalid || undefined}
            aria-describedby={errorMessage ? 'login-error' : undefined}
            className={`${INPUT_BASE} ${
              passwordInvalid
                ? 'border-red focus:border-red focus:ring-red/40'
                : 'border-border focus:border-accent focus:ring-accent/40'
            }`}
          />
        </div>

        {errorMessage ? (
          <p id="login-error" role="alert" className="mb-md text-xs text-red">
            {errorMessage}
          </p>
        ) : null}

        <ButtonPrimary
          type="submit"
          block
          loading={submitting}
          loadingLabel={COPY.ctaLoading}
          disabled={submitDisabled}
        >
          <svg
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="1.9"
            aria-hidden="true"
            focusable="false"
          >
            <path d="M5 12h14M13 6l6 6-6 6" />
          </svg>
          {COPY.ctaPrimary}
        </ButtonPrimary>

        <p className="mt-md text-center text-xs leading-relaxed text-muted">
          {COPY.footer}
        </p>
      </form>
    </section>
  )
}
