import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { configuracaoService, type VcsOauthKind, type VcsOauthStatus } from '../../services/configuracao-service'

// docs/F24-multi-vcs/copy.md `vcs.oauth.*` (padrão McpOauthControls/F09) — subtitle.oauth é
// provisório até o design fechar (spec §3.3).
const COPY = {
  ctaConnect: 'Conectar',
  ctaConnecting: 'Conectando…',
  ctaDisconnect: 'Desconectar',
  ctaCancel: 'Cancelar',
  ctaReconnect: 'Reconectar',
  connected: 'Conectado',
  needsReauth: 'requer reconexão',
  pending: 'Aguardando autorização no browser…',
  openManual: 'abrir manualmente',
  needsClientIdHint: 'Registre um app OAuth PKCE público e cole o client_id.',
  placeholderClientId: 'client_id',
  ctaSaveClientId: 'Salvar',
  errorStart: 'Falha ao iniciar a conexão.',
  errorDisconnect: 'Falha ao desconectar.',
  errorClientId: 'Falha ao salvar o client_id.',
  subtitle: 'Conecte via OAuth (nuvem pública). Um VCS por projeto, detectado pelo remote.',
} as const

const POLL_INTERVAL_MS = 2000

export interface VcsOauthCardProps {
  kind: VcsOauthKind
  title: string
  initialStatus: VcsOauthStatus
}

export function VcsOauthCard({ kind, title, initialStatus }: Readonly<VcsOauthCardProps>): ReactElement {
  const [status, setStatus] = useState<VcsOauthStatus>(initialStatus)
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null)
  const [clientIdInput, setClientIdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
  }, [])

  useEffect(() => {
    if (status !== 'pending') return
    const interval = setInterval(() => {
      configuracaoService
        .vcsStatus()
        .then((res) => {
          if (!mountedRef.current || res.error || !res.providers) return
          const mine = res.providers.find((p) => p.kind === kind)
          if (!mine) return
          setStatus(mine.status as VcsOauthStatus)
          if (mine.status !== 'pending') setAuthorizeUrl(null)
        })
        .catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, kind])

  const handleConnect = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await configuracaoService.vcsOauthStart(kind)
      if (!mountedRef.current) return
      if (res.error) {
        setError(COPY.errorStart)
        return
      }
      if (res.status === 'needs-client-id') {
        setStatus('needs-client-id')
        return
      }
      setStatus('pending')
      setAuthorizeUrl(res.authorizeUrl ?? null)
    } catch {
      if (mountedRef.current) setError(COPY.errorStart)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [kind])

  const handleDisconnect = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await configuracaoService.vcsOauthDisconnect(kind)
      if (!mountedRef.current) return
      if (res.error) {
        setError(COPY.errorDisconnect)
        return
      }
      setStatus('disconnected')
      setAuthorizeUrl(null)
    } catch {
      if (mountedRef.current) setError(COPY.errorDisconnect)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [kind])

  const handleSaveClientId = useCallback(async (): Promise<void> => {
    if (clientIdInput.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      const res = await configuracaoService.vcsOauthSaveClientId(kind, clientIdInput.trim())
      if (!mountedRef.current) return
      if (res.error) {
        setError(COPY.errorClientId)
        return
      }
      setStatus('disconnected')
      setClientIdInput('')
    } catch {
      if (mountedRef.current) setError(COPY.errorClientId)
    } finally {
      if (mountedRef.current) setBusy(false)
    }
  }, [kind, clientIdInput])

  return (
    <div className="rounded-lg border border-border bg-surface p-lg">
      <h3 className="text-[15px] font-semibold text-fg">{title}</h3>
      <p className="mb-md mt-xs text-[12.5px] text-muted">{COPY.subtitle}</p>

      <div className="mt-md flex flex-col gap-xs border-t border-border/60 pt-sm">
        {status === 'connected' ? (
          <div className="flex items-center gap-sm">
            <span className="rounded-full border border-green/60 px-sm text-[11px] text-green">{COPY.connected}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleDisconnect()}
              className="text-[12px] text-muted hover:text-red disabled:opacity-50"
            >
              {COPY.ctaDisconnect}
            </button>
          </div>
        ) : status === 'needs-reauth' ? (
          <div className="flex items-center gap-sm">
            <span className="rounded-full border border-amber/60 px-sm text-[11px] text-amber">{COPY.needsReauth}</span>
            <button
              type="button"
              disabled={busy}
              onClick={() => void handleConnect()}
              className="text-[12px] text-accent hover:underline disabled:opacity-50"
            >
              {COPY.ctaReconnect}
            </button>
          </div>
        ) : status === 'pending' ? (
          <div className="flex flex-col gap-xs">
            <span className="text-[12px] text-muted">{COPY.pending}</span>
            <div className="flex items-center gap-sm">
              {authorizeUrl ? (
                <a href={authorizeUrl} target="_blank" rel="noreferrer" className="text-[12px] text-accent hover:underline">
                  {COPY.openManual}
                </a>
              ) : null}
              <button
                type="button"
                disabled={busy}
                onClick={() => void handleDisconnect()}
                className="text-[12px] text-muted hover:text-red disabled:opacity-50"
              >
                {COPY.ctaCancel}
              </button>
            </div>
          </div>
        ) : status === 'needs-client-id' ? (
          <div className="flex flex-col gap-xs">
            <span className="text-[11.5px] text-amber">{COPY.needsClientIdHint}</span>
            <div className="flex items-center gap-sm">
              <input
                value={clientIdInput}
                onChange={(e) => setClientIdInput(e.target.value)}
                placeholder={COPY.placeholderClientId}
                disabled={busy}
                className="flex-1 rounded-sm border border-border bg-surface-2 px-sm py-[3px] font-mono text-[12px] text-fg focus:border-accent focus:outline-none"
              />
              <button
                type="button"
                disabled={busy || clientIdInput.trim() === ''}
                onClick={() => void handleSaveClientId()}
                className="text-[12px] text-accent hover:underline disabled:opacity-50"
              >
                {COPY.ctaSaveClientId}
              </button>
            </div>
          </div>
        ) : (
          <button
            type="button"
            disabled={busy}
            onClick={() => void handleConnect()}
            className="w-fit rounded-sm border border-border bg-surface-2 px-md py-xs text-[12px] font-medium text-fg hover:border-accent disabled:opacity-50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
          >
            {busy ? COPY.ctaConnecting : COPY.ctaConnect}
          </button>
        )}

        {error !== null ? (
          <p role="alert" className="text-[11.5px] text-red">
            {error}
          </p>
        ) : null}
      </div>
    </div>
  )
}
