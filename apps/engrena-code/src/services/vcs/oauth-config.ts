export type VcsOauthKind = 'gitlab' | 'bitbucket' | 'azure'

export const VCS_OAUTH_KINDS: VcsOauthKind[] = ['gitlab', 'bitbucket', 'azure']

export function isVcsOauthKind(value: string): value is VcsOauthKind {
  return (VCS_OAUTH_KINDS as string[]).includes(value)
}

export interface VcsOauthProviderConfig {
  authorizeUrl: string
  tokenUrl: string
  scope?: string
  /**
   * Client id público do app PKCE do EngrenaCode registrado no provider (spec §3.2). Nenhum app
   * real foi registrado nesta implementação (exige conta/credencial externa fora do alcance desta
   * sessão) — todos ficam `null`, o que faz `startOauth` devolver `needsClientId: true` até o
   * usuário fornecer um via `PUT /api/config/vcs/:kind/oauth/client` (mesmo caminho do Azure na spec).
   */
  clientId: string | null
}

export const VCS_OAUTH_PROVIDERS: Record<VcsOauthKind, VcsOauthProviderConfig> = {
  gitlab: {
    authorizeUrl: 'https://gitlab.com/oauth/authorize',
    tokenUrl: 'https://gitlab.com/oauth/token',
    scope: 'api',
    clientId: null,
  },
  bitbucket: {
    authorizeUrl: 'https://bitbucket.org/site/oauth2/authorize',
    tokenUrl: 'https://bitbucket.org/site/oauth2/access_token',
    scope: 'repository:write pullrequest:write',
    clientId: null,
  },
  azure: {
    authorizeUrl: 'https://app.vssps.visualstudio.com/oauth2/authorize',
    tokenUrl: 'https://app.vssps.visualstudio.com/oauth2/token',
    clientId: null,
  },
}
