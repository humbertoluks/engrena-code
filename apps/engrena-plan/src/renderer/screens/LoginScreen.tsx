/**
 * Tela #login — gate de cofre local do EngrenaPlan (scaffold S4).
 */
import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement, SyntheticEvent } from 'react'
import { BrandMark, BrandWordmark } from '../components/BrandMark'
import { ButtonPrimary, ThemeControl } from '@engrena/ui'
import {
  classifyUnlockFailure,
  messageForError,
  PLAN_UNLOCK_ORIGIN,
  type UnlockErrorKind,
  type VaultUnlockResponse,
} from './loginScreen.logic'

interface LoginScreenProps {
  onUnlock?: () => void
}

const COPY = {
  instruction: 'Desbloqueie o workspace local para planejar Discovery, PRD, Spec e Plano.',
  labelWorkspace: 'Workspace',
  hintWorkspace: 'Diretório raiz onde o EngrenaPlan guarda artefatos de planejamento.',
  labelPassword: 'Senha do cofre local',
  placeholderPassword: '••••••••',
  ctaPrimary: 'Desbloquear workspace',
  ctaLoading: 'Desbloqueando...',
  footer: 'Segredos e sessão ficam apenas no filesystem local deste dispositivo.',
} as const

const GATE_BACKGROUND =
  'radial-gradient(900px 500px at 50% -10%, rgba(255,107,0,0.08), transparent 60%)'

const INPUT_BASE =
  'w-full rounded-sm border bg-surface-2 px-md py-sm text-sm text-fg transition-colors placeholder:text-muted focus:outline-none focus:ring-2'

async function completeSessionUnlock(onUnlock?: () => void): Promise<UnlockErrorKind> {
  if (!window.electronAPI?.vault?.getSessionToken) return 'network'
  const token = await window.electronAPI.vault.getSessionToken()
  if (typeof token !== 'string' || !token) return 'network'
  localStorage.setItem('sessionToken', token)
  window.location.hash = '#shell'
  onUnlock?.()
  return null
}

export function LoginScreen({ onUnlock }: Readonly<LoginScreenProps>): ReactElement {
  const [workspace, setWorkspace] = useState('~/plan')
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
  const errorMessage = messageForError(errorKind, remainingMs)
  const passwordInvalid = errorKind !== null && errorKind !== 'backoff'

  const handleSubmit = useCallback(
    async (event: SyntheticEvent<HTMLFormElement>): Promise<void> => {
      event.preventDefault()
      if (submitDisabled) return

      setSubmitting(true)
      setErrorKind(null)

      try {
        const response = await fetch(`${PLAN_UNLOCK_ORIGIN}/api/vault/unlock`, {
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
            window.location.hash = '#shell'
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
          <label htmlFor="login-workspace" className="text-sm font-medium text-fg">
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
          <label htmlFor="login-password" className="text-sm font-medium text-fg">
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
          {COPY.ctaPrimary}
        </ButtonPrimary>

        <p className="mt-md text-center text-xs leading-relaxed text-muted">{COPY.footer}</p>
      </form>
    </section>
  )
}
