import { createHash, randomBytes } from 'crypto'
import http from 'http'
import { shell } from 'electron'
import { vaultService } from '../vault/vault-service.js'
import { getMcp, setOauthClientId, setOauthStatus } from '../db/repositories/mcps.js'

const CALLBACK_PORT_RANGE_START = 5180
const CALLBACK_PORT_RANGE_END = 5199
const FLOW_TTL_MS = 5 * 60 * 1000

export class McpOauthError extends Error {
  code: string
  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface OauthMetadata {
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
}

interface OauthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType: string
}

interface PendingFlow {
  mcpId: string
  state: string
  codeVerifier: string
  redirectUri: string
  metadata: OauthMetadata
  clientId: string
  server: http.Server
  createdAt: number
}

const pendingFlows = new Map<string, PendingFlow>()

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenVaultKey(mcpId: string): string {
  return `mcpOauth:${mcpId}`
}

function saveTokens(mcpId: string, tokens: OauthTokens): void {
  vaultService.setSecret(tokenVaultKey(mcpId), JSON.stringify(tokens))
}

export function getTokens(mcpId: string): OauthTokens | undefined {
  const raw = vaultService.getSecret(tokenVaultKey(mcpId))
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as OauthTokens
  } catch {
    return undefined
  }
}

function clearTokens(mcpId: string): void {
  vaultService.deleteSecret(tokenVaultKey(mcpId))
}

async function discoverMetadata(remoteUrl: string): Promise<OauthMetadata> {
  const origin = new URL(remoteUrl).origin
  const res = await fetch(`${origin}/.well-known/oauth-authorization-server`).catch(() => null)
  if (!res || !res.ok) {
    throw new McpOauthError('oauth_metadata_unavailable', 'Não foi possível descobrir o servidor de autorização OAuth.')
  }
  const metadata = (await res.json()) as OauthMetadata
  if (!metadata.authorization_endpoint || !metadata.token_endpoint) {
    throw new McpOauthError('oauth_metadata_unavailable', 'Metadata OAuth incompleta.')
  }
  return metadata
}

async function registerClient(metadata: OauthMetadata, redirectUri: string): Promise<string | null> {
  if (!metadata.registration_endpoint) return null
  try {
    const res = await fetch(metadata.registration_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        redirect_uris: [redirectUri],
        token_endpoint_auth_method: 'none',
        grant_types: ['authorization_code', 'refresh_token'],
        response_types: ['code'],
        client_name: 'EngrenaCode',
      }),
    })
    if (!res.ok) return null
    const data = (await res.json()) as { client_id?: string }
    return data.client_id ?? null
  } catch {
    return null
  }
}

function findFreePort(start: number, end: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number): void => {
      if (port > end) {
        reject(new McpOauthError('oauth_no_port', 'Nenhuma porta de callback OAuth disponível.'))
        return
      }
      const probe = http.createServer()
      probe.once('error', () => {
        probe.close()
        tryPort(port + 1)
      })
      probe.once('listening', () => {
        probe.close(() => resolve(port))
      })
      probe.listen(port, '127.0.0.1')
    }
    tryPort(start)
  })
}

async function exchangeCode(metadata: OauthMetadata, params: {
  code: string
  codeVerifier: string
  clientId: string
  redirectUri: string
}): Promise<OauthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(metadata.token_endpoint, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new McpOauthError('oauth_token_exchange_failed', 'Falha ao trocar o código de autorização por token.')
  }

  const data = (await res.json()) as {
    access_token: string
    refresh_token?: string
    expires_in?: number
    token_type?: string
  }

  return {
    accessToken: data.access_token,
    refreshToken: data.refresh_token,
    expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
    tokenType: data.token_type ?? 'Bearer',
  }
}

function closeFlow(state: string): void {
  const flow = pendingFlows.get(state)
  if (!flow) return
  pendingFlows.delete(state)
  flow.server.close()
}

/** Inicia o fluxo PKCE — spec §5.5. Retorna `authorizeUrl` para o card mostrar "abrir manualmente". */
export async function startOauth(mcpId: string): Promise<{ authorizeUrl: string } | { needsClientId: true }> {
  if (vaultService.isLocked()) throw new McpOauthError('vault_locked', 'Destranque o cofre para conectar.')

  const mcp = getMcp(mcpId)
  if (mcp === null) throw new McpOauthError('mcp_not_found', 'MCP não encontrado.')
  if (mcp.authMode !== 'oauth' || !mcp.url) {
    throw new McpOauthError('invalid_request', 'Este MCP não usa OAuth.')
  }
  for (const flow of pendingFlows.values()) {
    if (flow.mcpId === mcpId) throw new McpOauthError('oauth_flow_active', 'Já existe uma conexão em andamento para este MCP.')
  }

  const metadata = await discoverMetadata(mcp.url)
  const port = await findFreePort(CALLBACK_PORT_RANGE_START, CALLBACK_PORT_RANGE_END)
  const redirectUri = `http://127.0.0.1:${port}/callback`

  let clientId = mcp.oauthClientId ?? (await registerClient(metadata, redirectUri))
  if (!clientId) {
    setOauthStatus(mcpId, 'needs-client-id')
    return { needsClientId: true }
  }

  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  const state = base64url(randomBytes(16))

  const authorizeUrl = new URL(metadata.authorization_endpoint)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')

  const server = http.createServer((req, res) => {
    const url = new URL(req.url ?? '/', redirectUri)
    if (url.pathname !== '/callback') {
      res.writeHead(404)
      res.end()
      return
    }
    const code = url.searchParams.get('code')
    const returnedState = url.searchParams.get('state')

    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' })
    res.end('<html><body>EngrenaCode — conexão concluída. Pode fechar esta aba.</body></html>')

    if (!code || returnedState !== state) {
      closeFlow(state)
      setOauthStatus(mcpId, 'disconnected')
      return
    }

    void exchangeCode(metadata, { code, codeVerifier, clientId: clientId as string, redirectUri })
      .then((tokens) => {
        saveTokens(mcpId, tokens)
        setOauthStatus(mcpId, 'connected')
      })
      .catch(() => {
        setOauthStatus(mcpId, 'disconnected')
      })
      .finally(() => closeFlow(state))
  })

  pendingFlows.set(state, { mcpId, state, codeVerifier, redirectUri, metadata, clientId, server, createdAt: Date.now() })
  server.listen(port, '127.0.0.1')

  setTimeout(() => {
    const flow = pendingFlows.get(state)
    if (flow && Date.now() - flow.createdAt >= FLOW_TTL_MS) closeFlow(state)
  }, FLOW_TTL_MS + 1000)

  setOauthStatus(mcpId, 'pending')
  await shell.openExternal(authorizeUrl.toString())

  return { authorizeUrl: authorizeUrl.toString() }
}

export type OauthStatus = 'disconnected' | 'pending' | 'connected' | 'needs-reauth' | 'needs-client-id'

export function getOauthStatus(mcpId: string): OauthStatus {
  const mcp = getMcp(mcpId)
  if (mcp === null) return 'disconnected'
  const isPending = Array.from(pendingFlows.values()).some((f) => f.mcpId === mcpId)
  if (isPending) return 'pending'
  return (mcp.oauthStatus as OauthStatus | null) ?? 'disconnected'
}

export function disconnectOauth(mcpId: string): void {
  clearTokens(mcpId)
  setOauthStatus(mcpId, 'disconnected')
  for (const [state, flow] of pendingFlows) {
    if (flow.mcpId === mcpId) closeFlow(state)
  }
}

export function saveClientId(mcpId: string, clientId: string): void {
  setOauthClientId(mcpId, clientId)
  setOauthStatus(mcpId, 'disconnected')
}

/** Access token válido para uso no turno — tenta refresh se expirado. Undefined = precisa reconectar (spec §7.2). */
export async function getValidAccessToken(mcpId: string): Promise<string | undefined> {
  const tokens = getTokens(mcpId)
  if (!tokens) return undefined
  if (!tokens.expiresAt || tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken

  const mcp = getMcp(mcpId)
  if (mcp === null || !mcp.url || !tokens.refreshToken) {
    setOauthStatus(mcpId, 'needs-reauth')
    return undefined
  }

  try {
    const metadata = await discoverMetadata(mcp.url)
    const res = await fetch(metadata.token_endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: mcp.oauthClientId ?? '',
      }).toString(),
    })
    if (!res.ok) throw new Error('refresh_failed')
    const data = (await res.json()) as { access_token: string; refresh_token?: string; expires_in?: number; token_type?: string }
    const refreshed: OauthTokens = {
      accessToken: data.access_token,
      refreshToken: data.refresh_token ?? tokens.refreshToken,
      expiresAt: data.expires_in ? Date.now() + data.expires_in * 1000 : undefined,
      tokenType: data.token_type ?? 'Bearer',
    }
    saveTokens(mcpId, refreshed)
    return refreshed.accessToken
  } catch {
    setOauthStatus(mcpId, 'needs-reauth')
    return undefined
  }
}
