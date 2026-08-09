import { afterAll, beforeEach, describe, expect, it, vi } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

vi.mock('electron', () => ({ shell: { openExternal: vi.fn(async () => {}) } }))

const privateUserData = mkdtempSync(join(tmpdir(), 'engrenacode-vcs-oauth-test-'))
process.env.ENGRENACODE_USER_DATA = privateUserData

const { vaultService } = await import('../vault/vault-service.js')
const { startOauth, getOauthStatus, disconnectOauth, saveClientId, getValidAccessToken, VcsOauthError } = await import(
  './oauth.js'
)

const vaultPath = join(privateUserData, 'vault.enc')

afterAll(() => {
  rmSync(privateUserData, { recursive: true, force: true })
})

beforeEach(() => {
  rmSync(vaultPath, { force: true })
  rmSync(`${vaultPath}.tmp`, { force: true })
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

describe('getOauthStatus', () => {
  it('defaults to needs-client-id — nenhum app OAuth builtin registrado (spec §3.2)', () => {
    expect(getOauthStatus('gitlab')).toBe('needs-client-id')
  })

  it('becomes disconnected once a client id is saved', () => {
    saveClientId('gitlab', 'test-client-id')
    expect(getOauthStatus('gitlab')).toBe('disconnected')
  })
})

describe('startOauth', () => {
  it('returns needsClientId without touching network/shell when no client id is configured', async () => {
    const result = await startOauth('bitbucket')
    expect(result).toEqual({ needsClientId: true })
  })

  it('starts a pending flow once a client id exists, and status reports pending', async () => {
    saveClientId('gitlab', 'test-client-id')
    const result = await startOauth('gitlab')
    expect('authorizeUrl' in result).toBe(true)
    expect(getOauthStatus('gitlab')).toBe('pending')
    disconnectOauth('gitlab')
  })

  it('rejects a second concurrent flow for the same provider with oauth_flow_active', async () => {
    saveClientId('gitlab', 'test-client-id')
    await startOauth('gitlab')
    await expect(startOauth('gitlab')).rejects.toThrow(VcsOauthError)
    disconnectOauth('gitlab')
  })

  it('throws vault_locked when the vault is locked', async () => {
    vaultService.lock()
    await expect(startOauth('gitlab')).rejects.toThrow(VcsOauthError)
  })
})

describe('disconnectOauth', () => {
  it('oauth_cancel_leaves_no_vault — cancelling a pending flow never persists a token', async () => {
    saveClientId('gitlab', 'test-client-id')
    await startOauth('gitlab')
    expect(getOauthStatus('gitlab')).toBe('pending')

    disconnectOauth('gitlab')

    expect(await getValidAccessToken('gitlab')).toBeUndefined()
    expect(getOauthStatus('gitlab')).toBe('disconnected')
  })

  it('is idempotent and clears any saved token', async () => {
    disconnectOauth('bitbucket')
    disconnectOauth('bitbucket')
    expect(await getValidAccessToken('bitbucket')).toBeUndefined()
  })
})

describe('getValidAccessToken', () => {
  it('returns undefined when no token has ever been saved', async () => {
    expect(await getValidAccessToken('azure')).toBeUndefined()
  })
})
