import { describe, expect, it } from 'vitest'
import {
  canSubmitMcpForm,
  extractSecretRefs,
  isValidMcpName,
  parseArgsLines,
  parseEnvLines,
  parseHeadersLines,
} from './mcpForm.logic'

describe('isValidMcpName', () => {
  it('rejects the reserved name', () => {
    expect(isValidMcpName('engrenacode')).toBe(false)
  })

  it('rejects uppercase/space/leading-hyphen names', () => {
    expect(isValidMcpName('Github MCP')).toBe(false)
    expect(isValidMcpName('-github')).toBe(false)
  })

  it('accepts lowercase names with digits/underscore/hyphen', () => {
    expect(isValidMcpName('github-mcp_2')).toBe(true)
  })
})

describe('parseArgsLines', () => {
  it('splits non-empty trimmed lines', () => {
    expect(parseArgsLines('-y\n  server \n\n')).toEqual(['-y', 'server'])
  })
})

describe('parseEnvLines', () => {
  it('parses KEY=VALUE and allows vault: refs', () => {
    const { env, errors } = parseEnvLines('TOKEN=vault:github_token\nLOG_LEVEL=debug')
    expect(errors).toEqual([])
    expect(env).toEqual({ TOKEN: 'vault:github_token', LOG_LEVEL: 'debug' })
  })

  it('flags a malformed line and an invalid key', () => {
    const { errors } = parseEnvLines('no-equals-sign\n1BAD=x')
    expect(errors).toHaveLength(2)
  })
})

describe('parseHeadersLines', () => {
  it('parses "Name: value" and rejects vault: refs', () => {
    const literal = parseHeadersLines('X-Api-Version: v1')
    expect(literal.errors).toEqual([])
    expect(literal.headers).toEqual({ 'X-Api-Version': 'v1' })

    const secretRef = parseHeadersLines('Authorization: vault:token')
    expect(secretRef.errors).toHaveLength(1)
    expect(secretRef.headers).toEqual({})
  })
})

describe('extractSecretRefs', () => {
  it('returns only vault key names referenced in env', () => {
    expect(extractSecretRefs({ TOKEN: 'vault:github_token', LOG_LEVEL: 'debug' })).toEqual(['github_token'])
  })
})

describe('canSubmitMcpForm', () => {
  const base = { name: 'github', transport: 'stdio' as const, command: 'npx', url: '', envErrors: [], headerErrors: [] }

  it('requires a command for stdio and a url for http/sse', () => {
    expect(canSubmitMcpForm({ ...base, command: '' }, false)).toBe(false)
    expect(canSubmitMcpForm({ ...base, transport: 'http', url: '' }, false)).toBe(false)
    expect(canSubmitMcpForm({ ...base, transport: 'http', url: 'https://x' }, false)).toBe(true)
  })

  it('blocks submit while saving, with an invalid name, or with parse errors', () => {
    expect(canSubmitMcpForm(base, true)).toBe(false)
    expect(canSubmitMcpForm({ ...base, name: 'engrenacode' }, false)).toBe(false)
    expect(canSubmitMcpForm({ ...base, envErrors: ['x'] }, false)).toBe(false)
  })
})
