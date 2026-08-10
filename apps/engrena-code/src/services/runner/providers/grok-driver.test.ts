import { afterEach, describe, expect, it } from 'vitest'
import { ProviderError } from './provider-types'
import { resetFetchForTesting, runHttpTurn, setFetchForTesting, testConnection } from './grok-driver'
import type { ProviderTurnInput } from './provider-types'

function baseInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    provider: 'grok',
    cwd: '/tmp/project',
    prompt: 'oi',
    accessLevel: 'supervised',
    apiKey: 'xai-abcdef0123456789',
    onEvent: () => {},
    ...overrides,
  }
}

afterEach(() => {
  resetFetchForTesting()
})

describe('runHttpTurn', () => {
  it('throws provider_key_missing when no api key is present', async () => {
    await expect(runHttpTurn(baseInput({ apiKey: undefined }))).rejects.toMatchObject({ code: 'provider_key_missing' })
  })

  it('throws image_not_supported when images are present (Grok is text-only)', async () => {
    await expect(
      runHttpTurn(baseInput({ images: [{ mimeType: 'image/png', name: 'a.png', dataBase64: 'aGVsbG8=' }] }))
    ).rejects.toMatchObject({ code: 'image_not_supported' })
  })

  it('sends the Authorization header and resolves the response text', async () => {
    let capturedHeaders: Record<string, string> = {}
    setFetchForTesting(async (_url, init) => {
      capturedHeaders = (init?.headers ?? {}) as Record<string, string>
      return new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 })
    })

    const events: string[] = []
    const result = await runHttpTurn(baseInput({ onEvent: (e) => e.type === 'text-delta' && events.push(e.text) }))
    expect(result).toEqual({ text: 'pong' })
    expect(events).toEqual(['pong'])
    expect(capturedHeaders.Authorization).toBe('Bearer xai-abcdef0123456789')
  })

  it('throws provider_auth_error on 401/403 response', async () => {
    setFetchForTesting(async () => new Response('nope', { status: 403, statusText: 'Forbidden' }))
    await expect(runHttpTurn(baseInput())).rejects.toMatchObject({ code: 'provider_auth_error' })
  })

  it('throws provider_network_error when fetch rejects', async () => {
    setFetchForTesting(async () => {
      throw new Error('ECONNREFUSED')
    })
    await expect(runHttpTurn(baseInput())).rejects.toMatchObject({ code: 'provider_network_error' })
  })

  it('throws provider_turn_error on other non-2xx response', async () => {
    setFetchForTesting(async () => new Response('erro', { status: 500, statusText: 'Internal Server Error' }))
    await expect(runHttpTurn(baseInput())).rejects.toMatchObject({ code: 'provider_turn_error' })
  })

  it('throws provider_turn_error when the response has no text content', async () => {
    setFetchForTesting(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    await expect(runHttpTurn(baseInput())).rejects.toBeInstanceOf(ProviderError)
  })

  it('extracts usage from the response (OpenAI-compat shape)', async () => {
    setFetchForTesting(
      async () =>
        new Response(
          JSON.stringify({ choices: [{ message: { content: 'pong' } }], usage: { prompt_tokens: 40, completion_tokens: 8 } }),
          { status: 200 }
        )
    )
    const result = await runHttpTurn(baseInput())
    expect(result.usage).toEqual({ inputTokens: 40, outputTokens: 8, cacheReadTokens: null, cacheCreationTokens: null })
    expect(result.costUsd).toBeUndefined()
  })
})

describe('testConnection', () => {
  it('returns key-missing message when no key is saved, without calling fetchImpl', async () => {
    let called = false
    setFetchForTesting(async () => {
      called = true
      return new Response('{}', { status: 200 })
    })
    const result = await testConnection(undefined)
    expect(result.success).toBe(false)
    expect(called).toBe(false)
  })

  it('returns success:true on 2xx', async () => {
    setFetchForTesting(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 }))
    const result = await testConnection('xai-abcdef0123456789')
    expect(result).toEqual({ success: true, detail: expect.stringContaining('respondeu') })
  })

  it('returns a distinct message for provider_auth_error vs provider_network_error', async () => {
    setFetchForTesting(async () => new Response('nope', { status: 401, statusText: 'Unauthorized' }))
    const authResult = await testConnection('xai-abcdef0123456789')

    setFetchForTesting(async () => {
      throw new Error('ECONNREFUSED')
    })
    const networkResult = await testConnection('xai-abcdef0123456789')

    expect(authResult.success).toBe(false)
    expect(networkResult.success).toBe(false)
    expect(authResult.detail).not.toBe(networkResult.detail)
  })
})
