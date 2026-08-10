import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { apiRequest } from './api-client.js'

function installLocalStorage(): void {
  const store = new Map<string, string>()
  vi.stubGlobal('localStorage', {
    getItem: (key: string) => store.get(key) ?? null,
    setItem: (key: string, value: string) => {
      store.set(key, value)
    },
    removeItem: (key: string) => {
      store.delete(key)
    },
    clear: () => {
      store.clear()
    },
  })
}

describe('apiRequest', () => {
  beforeEach(() => {
    installLocalStorage()
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it('returns parsed JSON for 200', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 200,
        text: async () => JSON.stringify({ ok: true }),
      })
    )
    await expect(apiRequest<{ ok: boolean }>('GET', '/api/x')).resolves.toEqual({ ok: true })
  })

  it('returns undefined for 204 empty body', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 204,
        text: async () => '',
      })
    )
    await expect(apiRequest('DELETE', '/api/projects/1')).resolves.toBeUndefined()
  })

  it('clears session and locks vault on 423 vault_locked', async () => {
    localStorage.setItem('sessionToken', 'tok')
    const lock = vi.fn().mockResolvedValue(true)
    vi.stubGlobal('window', { electronAPI: { vault: { lock } } })
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue({
        status: 423,
        text: async () =>
          JSON.stringify({ error: { code: 'vault_locked', message: 'locked' } }),
      })
    )

    await apiRequest('GET', '/api/rules')
    expect(localStorage.getItem('sessionToken')).toBeNull()
    expect(lock).toHaveBeenCalledOnce()
  })
})
