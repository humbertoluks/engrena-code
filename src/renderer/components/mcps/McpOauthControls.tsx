import { useCallback, useEffect, useRef, useState } from 'react'
import type { ReactElement } from 'react'
import { mcpsService, type McpOauthStatus } from '../../services/mcps-service'

const COPY = {
  ctaConnect: 'Conectar',
  ctaConnecting: 'Conectando…',
  ctaDisconnect: 'Desconectar',
  ctaReconnect: 'Reconectar',
  badgeConnected: 'Conectado',
  badgeNeedsReauth: 'requer reconexão',
  pending: 'Aguardando autorização no browser…',
  openManual: 'abrir manualmente',
  needsClientIdHint: 'Este vendor exige registro manual: crie um OAuth App e cole o client_id.',
  placeholderClientId: 'client_id',
  ctaSaveClientId: 'Salvar',
  errorStart: 'Falha ao iniciar a conexão.',
  errorDisconnect: 'Falha ao desconectar.',
  errorClientId: 'Falha ao salvar o client_id.',
} as const

const POLL_INTERVAL_MS = 2000

export interface McpOauthControlsProps {
  mcpId: string
  initialStatus: McpOauthStatus | null
}

export function McpOauthControls({ mcpId, initialStatus }: Readonly<McpOauthControlsProps>): ReactElement {
  const [status, setStatus] = useState<McpOauthStatus>(initialStatus ?? 'disconnected')
  const [authorizeUrl, setAuthorizeUrl] = useState<string | null>(null)
  const [clientIdInput, setClientIdInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const mountedRef = useRef(true)
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  useEffect(() => {
    if (status !== 'pending') return
    const interval = setInterval(() => {
      mcpsService.oauthStatus(mcpId).then((res) => {
        if (!mountedRef.current || res.error) return
        setStatus(res.status)
        if (res.status !== 'pending') setAuthorizeUrl(null)
      }).catch(() => {})
    }, POLL_INTERVAL_MS)
    return () => clearInterval(interval)
  }, [status, mcpId])

  const handleConnect = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await mcpsService.oauthStart(mcpId)
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
  }, [mcpId])

  const handleDisconnect = useCallback(async (): Promise<void> => {
    setBusy(true)
    setError(null)
    try {
      const res = await mcpsService.oauthDisconnect(mcpId)
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
  }, [mcpId])

  const handleSaveClientId = useCallback(async (): Promise<void> => {
    if (clientIdInput.trim() === '') return
    setBusy(true)
    setError(null)
    try {
      const res = await mcpsService.oauthSaveClientId(mcpId, clientIdInput.trim())
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
  }, [mcpId, clientIdInput])

  return (
    <div className="mt-sm flex flex-col gap-xs">
      {status === 'connected' ? (
        <div className="flex items-center gap-sm">
          <span className="rounded-full border border-green/60 px-sm text-[11px] text-green">{COPY.badgeConnected}</span>
          <button type="button" disabled={busy} onClick={() => { void handleDisconnect() }} className="text-[12px] text-muted hover:text-red disabled:opacity-50">
            {COPY.ctaDisconnect}
          </button>
        </div>
      ) : status === 'needs-reauth' ? (
        <div className="flex items-center gap-sm">
          <span className="rounded-full border border-amber/60 px-sm text-[11px] text-amber">{COPY.badgeNeedsReauth}</span>
          <button type="button" disabled={busy} onClick={() => { void handleConnect() }} className="text-[12px] text-accent hover:underline disabled:opacity-50">
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
            <button type="button" disabled={busy} onClick={() => { void handleDisconnect() }} className="text-[12px] text-muted hover:text-red disabled:opacity-50">
              {COPY.ctaDisconnect}
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
              className="flex-1 rounded-sm border border-border bg-surface-2 px-sm py-[3px] font-mono text-[12px] text-fg focus:outline-none focus:border-accent"
            />
            <button
              type="button"
              disabled={busy || clientIdInput.trim() === ''}
              onClick={() => { void handleSaveClientId() }}
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
          onClick={() => { void handleConnect() }}
          className="w-fit rounded-sm border border-border bg-surface-2 px-md py-xs text-[12px] text-fg hover:border-accent disabled:opacity-50"
        >
          {busy ? COPY.ctaConnecting : COPY.ctaConnect}
        </button>
      )}

      {error !== null ? <p role="alert" className="text-[11.5px] text-red">{error}</p> : null}
    </div>
  )
}
