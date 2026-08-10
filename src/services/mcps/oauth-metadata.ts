import { McpOauthError } from './oauth-errors.js'

export interface OauthMetadata {
  authorization_endpoint: string
  token_endpoint: string
  registration_endpoint?: string
}

function requireHttpsUrl(value: unknown, field: string): string {
  if (typeof value !== 'string' || !value) {
    throw new McpOauthError('oauth_metadata_unavailable', `Metadata OAuth inválida: ${field}.`)
  }
  let parsed: URL
  try {
    parsed = new URL(value)
  } catch {
    throw new McpOauthError('oauth_metadata_unavailable', `Metadata OAuth inválida: ${field}.`)
  }
  if (parsed.protocol !== 'https:') {
    throw new McpOauthError(
      'oauth_metadata_unavailable',
      `Endpoint OAuth deve usar https (${field}).`
    )
  }
  return value
}

/** Valida endpoints OAuth descobertos — só https, para não contornar a allowlist do IPC. */
export function parseOauthMetadata(raw: unknown): OauthMetadata {
  if (typeof raw !== 'object' || raw === null) {
    throw new McpOauthError('oauth_metadata_unavailable', 'Metadata OAuth incompleta.')
  }
  const obj = raw as Record<string, unknown>
  const metadata: OauthMetadata = {
    authorization_endpoint: requireHttpsUrl(obj.authorization_endpoint, 'authorization_endpoint'),
    token_endpoint: requireHttpsUrl(obj.token_endpoint, 'token_endpoint'),
  }
  if (obj.registration_endpoint !== undefined && obj.registration_endpoint !== null) {
    metadata.registration_endpoint = requireHttpsUrl(
      obj.registration_endpoint,
      'registration_endpoint'
    )
  }
  return metadata
}
