import { describe, expect, it } from 'vitest'
import { McpOauthError, parseOauthMetadata } from './oauth.js'

describe('parseOauthMetadata', () => {
  it('accepts https authorization and token endpoints', () => {
    const metadata = parseOauthMetadata({
      authorization_endpoint: 'https://auth.example.com/authorize',
      token_endpoint: 'https://auth.example.com/token',
      registration_endpoint: 'https://auth.example.com/register',
    })
    expect(metadata.authorization_endpoint).toBe('https://auth.example.com/authorize')
    expect(metadata.token_endpoint).toBe('https://auth.example.com/token')
    expect(metadata.registration_endpoint).toBe('https://auth.example.com/register')
  })

  it('rejects non-https authorization_endpoint', () => {
    expect(() =>
      parseOauthMetadata({
        authorization_endpoint: 'http://evil.example/authorize',
        token_endpoint: 'https://auth.example.com/token',
      })
    ).toThrow(McpOauthError)
    try {
      parseOauthMetadata({
        authorization_endpoint: 'http://evil.example/authorize',
        token_endpoint: 'https://auth.example.com/token',
      })
    } catch (err) {
      expect(err).toBeInstanceOf(McpOauthError)
      expect((err as McpOauthError).code).toBe('oauth_metadata_unavailable')
    }
  })

  it('rejects non-string endpoints', () => {
    expect(() =>
      parseOauthMetadata({
        authorization_endpoint: true,
        token_endpoint: 'https://auth.example.com/token',
      })
    ).toThrow(McpOauthError)
  })

  it('rejects incomplete metadata', () => {
    expect(() => parseOauthMetadata({})).toThrow(McpOauthError)
    expect(() => parseOauthMetadata(null)).toThrow(McpOauthError)
  })

  it('rejects non-https registration_endpoint when present', () => {
    expect(() =>
      parseOauthMetadata({
        authorization_endpoint: 'https://auth.example.com/authorize',
        token_endpoint: 'https://auth.example.com/token',
        registration_endpoint: 'http://evil.example/register',
      })
    ).toThrow(McpOauthError)
  })
})
