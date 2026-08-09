import { afterEach, describe, expect, it, vi } from 'vitest'
import { resetFetchForTesting, setFetchForTesting, transcribeAudio, VoiceTranscribeError } from './transcribe.js'

const AUDIO = Buffer.from('fake-audio-bytes')

afterEach(() => {
  resetFetchForTesting()
})

describe('transcribe_no_key_configured', () => {
  it('throws voice_key_missing without any network call', async () => {
    const fetchSpy = vi.fn()
    setFetchForTesting(fetchSpy)
    await expect(transcribeAudio({}, AUDIO, 'audio/webm')).rejects.toMatchObject({ code: 'voice_key_missing' })
    expect(fetchSpy).not.toHaveBeenCalled()
  })
})

describe('transcribe_openai_success', () => {
  it('returns openai text and never calls groq', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ text: 'oi mundo' }), { status: 200 }))
    setFetchForTesting(fetchSpy)
    const result = await transcribeAudio({ openai: 'sk-abc', groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    expect(result).toEqual({ text: 'oi mundo', provider: 'openai' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((fetchSpy.mock.calls[0][0] as string)).toContain('openai.com')
  })
})

describe('transcribe_openai_auth_error_no_fallback', () => {
  it('throws voice_auth_error and never calls groq even with a groq key present', async () => {
    const fetchSpy = vi.fn(async () => new Response('nope', { status: 401 }))
    setFetchForTesting(fetchSpy)
    await expect(
      transcribeAudio({ openai: 'sk-abc', groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    ).rejects.toMatchObject({ code: 'voice_auth_error' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
  })

  it('throws voice_auth_error with only an openai key', async () => {
    setFetchForTesting(async () => new Response('nope', { status: 403 }))
    await expect(transcribeAudio({ openai: 'sk-abc' }, AUDIO, 'audio/webm')).rejects.toBeInstanceOf(VoiceTranscribeError)
  })
})

describe('transcribe_openai_network_error_falls_back_groq', () => {
  it('falls back to groq on a network failure and returns its text', async () => {
    let calls = 0
    setFetchForTesting(async (url) => {
      calls += 1
      if ((url as string).includes('openai.com')) throw new Error('ECONNRESET')
      return new Response(JSON.stringify({ text: 'transcrito pelo groq' }), { status: 200 })
    })
    const result = await transcribeAudio({ openai: 'sk-abc', groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    expect(result).toEqual({ text: 'transcrito pelo groq', provider: 'groq' })
    expect(calls).toBe(2)
  })

  it('falls back to groq on a 5xx from openai', async () => {
    setFetchForTesting(async (url) => {
      if ((url as string).includes('openai.com')) return new Response('boom', { status: 500 })
      return new Response(JSON.stringify({ text: 'ok' }), { status: 200 })
    })
    const result = await transcribeAudio({ openai: 'sk-abc', groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    expect(result.provider).toBe('groq')
  })

  it('throws voice_upstream_error when openai fails and no groq key is configured', async () => {
    setFetchForTesting(async () => {
      throw new Error('ECONNRESET')
    })
    await expect(transcribeAudio({ openai: 'sk-abc' }, AUDIO, 'audio/webm')).rejects.toMatchObject({
      code: 'voice_upstream_error',
    })
  })
})

describe('transcribe_only_groq_configured_skips_openai', () => {
  it('calls groq directly without ever trying openai', async () => {
    const fetchSpy = vi.fn(async () => new Response(JSON.stringify({ text: 'só groq' }), { status: 200 }))
    setFetchForTesting(fetchSpy)
    const result = await transcribeAudio({ groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    expect(result).toEqual({ text: 'só groq', provider: 'groq' })
    expect(fetchSpy).toHaveBeenCalledTimes(1)
    expect((fetchSpy.mock.calls[0][0] as string)).toContain('groq.com')
  })
})

describe('transcribe both providers fail', () => {
  it('throws voice_upstream_error from the groq attempt after openai already failed', async () => {
    setFetchForTesting(async () => new Response('boom', { status: 500 }))
    await expect(
      transcribeAudio({ openai: 'sk-abc', groq: 'gsk_abc' }, AUDIO, 'audio/webm')
    ).rejects.toMatchObject({ code: 'voice_upstream_error' })
  })
})
