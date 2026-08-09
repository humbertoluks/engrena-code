import { describe, expect, it } from 'vitest'
import { VCS_OAUTH_KINDS, VCS_OAUTH_PROVIDERS, isVcsOauthKind } from './oauth-config.js'

describe('isVcsOauthKind', () => {
  it('accepts every kind in VCS_OAUTH_KINDS', () => {
    for (const kind of VCS_OAUTH_KINDS) expect(isVcsOauthKind(kind)).toBe(true)
  })

  it('rejects an unknown kind', () => {
    expect(isVcsOauthKind('github')).toBe(false)
    expect(isVcsOauthKind('')).toBe(false)
  })
})

describe('VCS_OAUTH_PROVIDERS', () => {
  it('has one config entry per kind in VCS_OAUTH_KINDS', () => {
    for (const kind of VCS_OAUTH_KINDS) expect(VCS_OAUTH_PROVIDERS[kind]).toBeDefined()
  })

  it('authorizeUrl/tokenUrl are https and clientId starts null (no app registered yet)', () => {
    for (const kind of VCS_OAUTH_KINDS) {
      const config = VCS_OAUTH_PROVIDERS[kind]
      expect(config.authorizeUrl.startsWith('https://')).toBe(true)
      expect(config.tokenUrl.startsWith('https://')).toBe(true)
      expect(config.clientId).toBeNull()
    }
  })
})
