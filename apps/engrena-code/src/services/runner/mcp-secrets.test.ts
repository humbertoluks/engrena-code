import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { existsSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Mcp } from '../db/repositories/mcps.js'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f09_mcp_secrets_'))

const { vaultService } = await import('../vault/vault-service.js')
const { prepareMcpsForDispatch } = await import('./mcp-secrets.js')

function mcp(overrides: Partial<Mcp>): Mcp {
  return {
    id: 'id-1',
    name: 'github',
    description: null,
    transport: 'stdio',
    command: 'npx',
    args: ['-y', 'server'],
    env: {},
    url: null,
    headers: {},
    category: null,
    enabled: true,
    presetId: null,
    authMode: 'key',
    oauthStatus: null,
    oauthClientId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

beforeEach(() => {
  vaultService.lock()
  const vaultPath = join(process.env.ENGRENACODE_USER_DATA as string, 'vault.enc')
  if (existsSync(vaultPath)) rmSync(vaultPath)
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

afterEach(() => {
  vaultService.lock()
})

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('prepareMcpsForDispatch', () => {
  it('omits everything with vault_locked when the vault is locked', async () => {
    vaultService.lock()
    const { resolved, omitted } = await prepareMcpsForDispatch([mcp({})], { provider: 'claude' })
    expect(resolved).toEqual([])
    expect(omitted).toEqual([{ name: 'github', reason: 'vault_locked' }])
  })

  it('resolves stdio mcp with literal env directly, no wrapper', async () => {
    const { resolved, omitted, cleanup } = await prepareMcpsForDispatch(
      [mcp({ env: { LOG_LEVEL: 'debug' } })],
      { provider: 'claude' }
    )
    expect(omitted).toEqual([])
    expect(resolved).toEqual([{ name: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'server'], env: { LOG_LEVEL: 'debug' } }])
    cleanup()
  })

  it('omits missing_secret when a vault: ref has no saved value', async () => {
    const { resolved, omitted } = await prepareMcpsForDispatch(
      [mcp({ env: { TOKEN: 'vault:github_token' } })],
      { provider: 'claude' }
    )
    expect(resolved).toEqual([])
    expect(omitted).toEqual([{ name: 'github', reason: 'missing_secret' }])
  })

  it('routes secret env through the wrapper loopback and serves the resolved value', async () => {
    vaultService.setSecret('mcpSecrets:github_token', 'ghp_secret')
    const { resolved, omitted, cleanup } = await prepareMcpsForDispatch(
      [mcp({ env: { TOKEN: 'vault:github_token' } })],
      { provider: 'claude' }
    )
    expect(omitted).toEqual([])
    expect(resolved).toHaveLength(1)
    const def = resolved[0]
    expect(def.command).toBe(process.execPath)
    expect(def.args?.[0]).toMatch(/mcp-secret-wrapper\.mjs$/)

    const portIndex = (def.args as string[]).indexOf('--port')
    const tokenIndex = (def.args as string[]).indexOf('--token')
    const port = (def.args as string[])[portIndex + 1]
    const token = (def.args as string[])[tokenIndex + 1]

    const res = await fetch(`http://127.0.0.1:${port}/env/github`, { headers: { 'x-secret-token': token } })
    expect(res.status).toBe(200)
    const body = (await res.json()) as { env: Record<string, string> }
    expect(body.env.TOKEN).toBe('ghp_secret')

    const forbidden = await fetch(`http://127.0.0.1:${port}/env/github`, { headers: { 'x-secret-token': 'wrong' } })
    expect(forbidden.status).toBe(403)

    cleanup()
  })

  it('omits oauth_unavailable when there is no saved token', async () => {
    const { resolved, omitted } = await prepareMcpsForDispatch(
      [mcp({ name: 'notion', transport: 'http', url: 'https://mcp.notion.com/mcp', authMode: 'oauth', oauthStatus: 'connected' })],
      { provider: 'claude' }
    )
    expect(resolved).toEqual([])
    expect(omitted).toEqual([{ name: 'notion', reason: 'oauth_unavailable' }])
  })

  it('omits codex_auth_required for key-mode http on codex', async () => {
    const { omitted } = await prepareMcpsForDispatch(
      [mcp({ name: 'remote', transport: 'http', url: 'https://mcp.example.com', authMode: 'key' })],
      { provider: 'codex' }
    )
    expect(omitted).toEqual([{ name: 'remote', reason: 'codex_auth_required' }])
  })

  it('omits header_secret_ref defensively when headers carry a vault: value', async () => {
    const { omitted } = await prepareMcpsForDispatch(
      [mcp({ name: 'remote', transport: 'http', url: 'https://mcp.example.com', headers: { Authorization: 'vault:x' } })],
      { provider: 'claude' }
    )
    expect(omitted).toEqual([{ name: 'remote', reason: 'header_secret_ref' }])
  })

  it('omits every mcp with unsupported_transport for minimax', async () => {
    const { resolved, omitted } = await prepareMcpsForDispatch([mcp({})], { provider: 'minimax' })
    expect(resolved).toEqual([])
    expect(omitted).toEqual([{ name: 'github', reason: 'unsupported_transport' }])
  })
})
