/**
 * Tela #login — gate de cofre local compartilhado (EngrenaCode + EngrenaPlan).
 * Seta do CTA é parte integrante desta tela (não exportada como ícone isolado).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { ButtonPrimary } from '../components/ButtonPrimary'
import { ThemeControl } from '../components/ThemeControl'
import {
  LOGIN_COPY_SHARED,
  LOGIN_PRODUCT_CONFIG,
  classifyUnlockFailure,
  messageForError,
  type LoginProduct,
  type UnlockErrorKind,
  type VaultUnlockResponse,
} from './loginScreen.logic'

interface LoginScreenProps {
  product: LoginProduct
  onUnlock?: () => void
}

const GATE_BACKGROUND =
  'radial-gradient(900px 500px at 50% -10%, rgba(255,107,0,0.08), transparent 60%)'

const INPUT_BASE =
  'w-full rounded-sm border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:ring-2'

type VaultSessionApi = {
  getSessionToken?: () => Promise<unknown>
}

function getVaultApi(): VaultSessionApi | undefined {
  const api = (window as Window & { electronAPI?: { vault?: VaultSessionApi } }).electronAPI
  return api?.vault
}

/** Seta 15px do CTA — tamanho explícito evita SVG intrínseco estourar o botão. */
function CtaArrowIcon(): ReactElement {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.9"
      className="h-[15px] w-[15px] shrink-0"
      aria-hidden="true"
      focusable="false"
    >
      <path d="M5 12h14M13 6l6 6-6 6" />
    </svg>
  )
}

function LoginBrandMark({ product }: Readonly<{ product: LoginProduct }>): ReactElement {
  if (product === 'plan') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={30}
        height={30}
        fill="none"
        aria-hidden="true"
        focusable="false"
      >
        <path
          d="M7 3.5h7.5L19 8v12.5H7V3.5Z"
          className="stroke-accent"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M14.5 3.5V8H19"
          className="stroke-accent"
          strokeWidth="1.6"
          strokeLinejoin="round"
        />
        <path
          d="M10 12h6M10 15.5h6M10 9h2.5"
          className="stroke-fg"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
    )
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={30}
      height={30}
      fill="none"
      aria-hidden="true"
      focusable="false"
    >
      <path
        d="M12 2.5 20 7v10l-8 4.5L4 17V7l8-4.5Z"
        className="stroke-accent"
        strokeWidth="1.6"
        strokeLinejoin="round"
      />
      <path
        d="M12 7.5v9M8.5 10.25 12 12.25l3.5-2M8.5 13.75 12 15.75l3.5-2"
        className="stroke-fg"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

function LoginBrandWordmark({ product }: Readonly<{ product: LoginProduct }>): ReactElement {
  const suffix = product === 'plan' ? 'Plan' : 'Code'
  return (
    <span className="text-lg font-semibold tracking-tight">
      Engrena<b className="text-accent">{suffix}</b>
    </span>
  )
}

async function completeSessionUnlock(
  successHash: string,
  onUnlock?: () => void,
): Promise<UnlockErrorKind> {
  const vault = getVaultApi()
  if (!vault?.getSessionToken) return 'network'
  const token = await vault.getSessionToken()
  if (typeof token !== 'string' || !token) return 'network'
  localStorage.setItem('sessionToken', token)
  window.location.hash = successHash
  onUnlock?.()
  return null
}

export function LoginScreen({
  product,
  onUnlock,
}: Readonly<LoginScreenProps>): ReactElement {
  const config = LOGIN_PRODUCT_CONFIG[product]
  const [workspace, setWorkspace] = useState(config.defaultWorkspace)
  const [password, setPassword] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [errorKind, setErrorKind] = useState<UnlockErrorKind>(null)
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

  const remainingMs = backoffUntil !== null ? Math.max(0, backoffUntil - now) : 0
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
  const errorMessage = messageForError(errorKind, remainingMs, config.brand)
  const passwordInvalid = errorKind !== null && errorKind !== 'backoff'

  const handleSubmit = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      if (submitDisabled) return

      setSubmitting(true)
      setErrorKind(null)

      try {
        const response = await fetch(`${config.unlockOrigin}/api/vault/unlock`, {
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
            window.location.hash = config.successHash
            onUnlock?.()
            return
          }
          const sessionError = await completeSessionUnlock(config.successHash, onUnlock)
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
    [config.successHash, config.unlockOrigin, onUnlock, password, submitDisabled, trimmedWorkspace],
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
          <LoginBrandMark product={product} />
          <LoginBrandWordmark product={product} />
        </div>

        <p className="mb-lg text-sm text-muted">{config.instruction}</p>

        <div className="mb-md flex flex-col gap-xs">
          <label htmlFor="login-workspace" className="text-sm font-medium text-fg">
            {LOGIN_COPY_SHARED.labelWorkspace}
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
          <span className="text-xs text-muted">{config.hintWorkspace}</span>
        </div>

        <div className="mb-md flex flex-col gap-xs">
          <label htmlFor="login-password" className="text-sm font-medium text-fg">
            {LOGIN_COPY_SHARED.labelPassword}
          </label>
          <input
            id="login-password"
            name="password"
            type="password"
            autoComplete="current-password"
            placeholder={LOGIN_COPY_SHARED.placeholderPassword}
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
          loadingLabel={LOGIN_COPY_SHARED.ctaLoading}
          disabled={submitDisabled}
        >
          <CtaArrowIcon />
          {LOGIN_COPY_SHARED.ctaPrimary}
        </ButtonPrimary>

        <p className="mt-md text-center text-xs leading-relaxed text-muted">{config.footer}</p>
      </form>
    </section>
  )
}
