import { afterEach, describe, expect, it } from 'vitest'
import { ProviderError } from './provider-types'
import { resetFetchForTesting, runHttpTurn, setFetchForTesting } from './minimax-driver'
import type { ProviderTurnInput } from './provider-types'

function baseInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    provider: 'minimax',
    cwd: '/tmp/project',
    prompt: 'oi',
    accessLevel: 'supervised',
    apiKey: 'mm-12345678',
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

  it('throws image_not_supported when images are present (F16 §3.2 — Minimax is text-only)', async () => {
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
    expect(capturedHeaders.Authorization).toBe('Bearer mm-12345678')
  })

  it('throws provider_network_error when fetch rejects', async () => {
    setFetchForTesting(async () => {
      throw new Error('ECONNREFUSED')
    })
    await expect(runHttpTurn(baseInput())).rejects.toMatchObject({ code: 'provider_network_error' })
  })

  it('throws provider_turn_error on non-2xx response', async () => {
    setFetchForTesting(async () => new Response('nope', { status: 401, statusText: 'Unauthorized' }))
    await expect(runHttpTurn(baseInput())).rejects.toBeInstanceOf(ProviderError)
  })

  it('throws provider_turn_error when base_resp reports a non-zero status', async () => {
    setFetchForTesting(
      async () =>
        new Response(JSON.stringify({ base_resp: { status_code: 1004, status_msg: 'credencial inválida' } }), {
          status: 200,
        })
    )
    await expect(runHttpTurn(baseInput())).rejects.toMatchObject({ message: 'credencial inválida' })
  })

  it('throws provider_turn_error when the response has no text content', async () => {
    setFetchForTesting(async () => new Response(JSON.stringify({ choices: [] }), { status: 200 }))
    await expect(runHttpTurn(baseInput())).rejects.toBeInstanceOf(ProviderError)
  })

  it('extracts usage from the response (OpenAI-compat shape, spec F11 §3.2)', async () => {
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

  it('leaves usage undefined when the response has no usage field', async () => {
    setFetchForTesting(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'pong' } }] }), { status: 200 }))
    const result = await runHttpTurn(baseInput())
    expect(result.usage).toBeUndefined()
  })
})
