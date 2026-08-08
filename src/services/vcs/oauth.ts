import { createHash, randomBytes } from 'crypto'
import http from 'http'
import { shell } from 'electron'
import { vaultService } from '../vault/vault-service.js'
import { VCS_OAUTH_PROVIDERS, type VcsOauthKind } from './oauth-config.js'

const CALLBACK_PORT_RANGE_START = 5180
const CALLBACK_PORT_RANGE_END = 5199
const FLOW_TTL_MS = 5 * 60 * 1000

export class VcsOauthError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

interface OauthTokens {
  accessToken: string
  refreshToken?: string
  expiresAt?: number
  tokenType: string
}

interface PendingFlow {
  kind: VcsOauthKind
  state: string
  codeVerifier: string
  redirectUri: string
  clientId: string
  server: http.Server
  createdAt: number
}

const pendingFlows = new Map<string, PendingFlow>()

function base64url(input: Buffer): string {
  return input.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function tokenVaultKey(kind: VcsOauthKind): string {
  return `vcsOauth:${kind}`
}

function clientVaultKey(kind: VcsOauthKind): string {
  return `vcsOauthClient:${kind}`
}

function saveTokens(kind: VcsOauthKind, tokens: OauthTokens): void {
  vaultService.setSecret(tokenVaultKey(kind), JSON.stringify(tokens))
}

export function getTokens(kind: VcsOauthKind): OauthTokens | undefined {
  const raw = vaultService.getSecret(tokenVaultKey(kind))
  if (!raw) return undefined
  try {
    return JSON.parse(raw) as OauthTokens
  } catch {
    return undefined
  }
}

function clearTokens(kind: VcsOauthKind): void {
  vaultService.deleteSecret(tokenVaultKey(kind))
}

/** Client id efetivo: builtin do provider (spec §3.2) ou o que o usuário salvou via `PUT .../client`. */
function resolveClientId(kind: VcsOauthKind): string | null {
  const builtin = VCS_OAUTH_PROVIDERS[kind].clientId
  if (builtin) return builtin
  return vaultService.getSecret(clientVaultKey(kind)) ?? null
}

function parseTokenResponse(data: unknown): OauthTokens {
  if (typeof data !== 'object' || data === null) {
    throw new VcsOauthError('oauth_token_exchange_failed', 'Resposta de token OAuth inválida.')
  }
  const obj = data as Record<string, unknown>
  if (typeof obj.access_token !== 'string' || !obj.access_token) {
    throw new VcsOauthError('oauth_token_exchange_failed', 'Resposta de token OAuth inválida.')
  }
  return {
    accessToken: obj.access_token,
    refreshToken: typeof obj.refresh_token === 'string' ? obj.refresh_token : undefined,
    expiresAt: typeof obj.expires_in === 'number' ? Date.now() + obj.expires_in * 1000 : undefined,
    tokenType: typeof obj.token_type === 'string' ? obj.token_type : 'Bearer',
  }
}

async function exchangeCode(
  tokenUrl: string,
  params: { code: string; codeVerifier: string; clientId: string; redirectUri: string }
): Promise<OauthTokens> {
  const body = new URLSearchParams({
    grant_type: 'authorization_code',
    code: params.code,
    redirect_uri: params.redirectUri,
    client_id: params.clientId,
    code_verifier: params.codeVerifier,
  })

  const res = await fetch(tokenUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: body.toString(),
  })

  if (!res.ok) {
    throw new VcsOauthError('oauth_token_exchange_failed', 'Falha ao trocar o código de autorização por token.')
  }

  return parseTokenResponse(await res.json())
}

function findFreePort(start: number, end: number): Promise<number> {
  return new Promise((resolve, reject) => {
    const tryPort = (port: number): void => {
      if (port > end) {
        reject(new VcsOauthError('oauth_no_port', 'Nenhuma porta de callback OAuth disponível.'))
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

function closeFlow(state: string): void {
  const flow = pendingFlows.get(state)
  if (!flow) return
  pendingFlows.delete(state)
  flow.server.close()
}

/** Inicia o fluxo PKCE (spec §5.2) — sem app registrado, devolve `needsClientId: true` até `saveClientId`. */
export async function startOauth(kind: VcsOauthKind): Promise<{ authorizeUrl: string } | { needsClientId: true }> {
  if (vaultService.isLocked()) throw new VcsOauthError('vault_locked', 'Destranque o cofre para conectar.')

  const provider = VCS_OAUTH_PROVIDERS[kind]
  if (!provider) throw new VcsOauthError('invalid_request', 'Provider VCS inválido.')

  for (const flow of pendingFlows.values()) {
    if (flow.kind === kind) throw new VcsOauthError('oauth_flow_active', 'Já existe uma conexão em andamento para este provider.')
  }

  const clientId = resolveClientId(kind)
  if (!clientId) return { needsClientId: true }

  const port = await findFreePort(CALLBACK_PORT_RANGE_START, CALLBACK_PORT_RANGE_END)
  const redirectUri = `http://127.0.0.1:${port}/callback`

  const codeVerifier = base64url(randomBytes(32))
  const codeChallenge = base64url(createHash('sha256').update(codeVerifier).digest())
  const state = base64url(randomBytes(16))

  const authorizeUrl = new URL(provider.authorizeUrl)
  authorizeUrl.searchParams.set('response_type', 'code')
  authorizeUrl.searchParams.set('client_id', clientId)
  authorizeUrl.searchParams.set('redirect_uri', redirectUri)
  authorizeUrl.searchParams.set('state', state)
  authorizeUrl.searchParams.set('code_challenge', codeChallenge)
  authorizeUrl.searchParams.set('code_challenge_method', 'S256')
  if (provider.scope) authorizeUrl.searchParams.set('scope', provider.scope)

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
      return
    }

    void exchangeCode(provider.tokenUrl, { code, codeVerifier, clientId: clientId as string, redirectUri })
      .then((tokens) => saveTokens(kind, tokens))
      .catch(() => {
        // Falha no exchange: nunca grava token parcial (spec §5.2) — estado volta a `disconnected`.
      })
      .finally(() => closeFlow(state))
  })

  pendingFlows.set(state, { kind, state, codeVerifier, redirectUri, clientId, server, createdAt: Date.now() })
  server.listen(port, '127.0.0.1')

  setTimeout(() => {
    const flow = pendingFlows.get(state)
    if (flow && Date.now() - flow.createdAt >= FLOW_TTL_MS) closeFlow(state)
  }, FLOW_TTL_MS + 1000)

  await shell.openExternal(authorizeUrl.toString())

  return { authorizeUrl: authorizeUrl.toString() }
}

export type VcsOauthStatus = 'disconnected' | 'pending' | 'connected' | 'needs-reauth' | 'needs-client-id'

/** Deriva o status só do vault + do map de pending em memória (spec §3.2: sem migração/coluna nova). */
export function getOauthStatus(kind: VcsOauthKind): VcsOauthStatus {
  const isPending = Array.from(pendingFlows.values()).some((f) => f.kind === kind)
  if (isPending) return 'pending'

  const tokens = getTokens(kind)
  if (tokens) {
    if (tokens.expiresAt && tokens.expiresAt <= Date.now()) return 'needs-reauth'
    return 'connected'
  }

  if (!resolveClientId(kind)) return 'needs-client-id'
  return 'disconnected'
}

/** Desconecta sem deixar token parcial (spec §5.2) — encerra qualquer flow pendente do provider também. */
export function disconnectOauth(kind: VcsOauthKind): void {
  clearTokens(kind)
  for (const [state, flow] of pendingFlows) {
    if (flow.kind === kind) closeFlow(state)
  }
}

export function saveClientId(kind: VcsOauthKind, clientId: string): void {
  vaultService.setSecret(clientVaultKey(kind), clientId)
}

/** Access token válido para push/PR — tenta refresh se expirado; `undefined` = precisa reconectar. */
export async function getValidAccessToken(kind: VcsOauthKind): Promise<string | undefined> {
  const tokens = getTokens(kind)
  if (!tokens) return undefined
  if (!tokens.expiresAt || tokens.expiresAt > Date.now() + 30_000) return tokens.accessToken

  const provider = VCS_OAUTH_PROVIDERS[kind]
  const clientId = resolveClientId(kind)
  if (!tokens.refreshToken || !clientId) return undefined

  try {
    const res = await fetch(provider.tokenUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: tokens.refreshToken,
        client_id: clientId,
      }).toString(),
    })
    if (!res.ok) throw new Error('refresh_failed')
    const refreshed = parseTokenResponse(await res.json())
    if (!refreshed.refreshToken) refreshed.refreshToken = tokens.refreshToken
    saveTokens(kind, refreshed)
    return refreshed.accessToken
  } catch {
    clearTokens(kind)
    return undefined
  }
}
