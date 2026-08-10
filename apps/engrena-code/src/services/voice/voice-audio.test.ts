import { describe, expect, it } from 'vitest'
import { MAX_AUDIO_BYTES, validateVoiceAudio } from './voice-audio.js'

function base64OfLength(byteLength: number): string {
  return Buffer.alloc(byteLength, 1).toString('base64')
}

describe('audio_rejects_type_outside_allowlist', () => {
  it('rejects a disallowed mime type with audio_type_invalid', () => {
    const err = validateVoiceAudio({ mimeType: 'audio/mp3', audioBase64: base64OfLength(10) })
    expect(err?.code).toBe('audio_type_invalid')
  })

  it('accepts audio/webm and audio/webm;codecs=opus', () => {
    expect(validateVoiceAudio({ mimeType: 'audio/webm', audioBase64: base64OfLength(10) })).toBeNull()
    expect(validateVoiceAudio({ mimeType: 'audio/webm;codecs=opus', audioBase64: base64OfLength(10) })).toBeNull()
  })
})

describe('audio_rejects_over_8mib', () => {
  it('rejects audio over 8 MiB with audio_too_large', () => {
    const err = validateVoiceAudio({ mimeType: 'audio/webm', audioBase64: base64OfLength(MAX_AUDIO_BYTES + 1) })
    expect(err?.code).toBe('audio_too_large')
  })

  it('accepts audio at exactly the limit', () => {
    expect(validateVoiceAudio({ mimeType: 'audio/webm', audioBase64: base64OfLength(MAX_AUDIO_BYTES) })).toBeNull()
  })
})

describe('audio_rejects_empty_base64', () => {
  it('rejects an empty audioBase64 with audio_empty', () => {
    const err = validateVoiceAudio({ mimeType: 'audio/webm', audioBase64: '' })
    expect(err?.code).toBe('audio_empty')
  })

  it('rejects a non-object payload with validation_error', () => {
    expect(validateVoiceAudio('nope')?.code).toBe('validation_error')
    expect(validateVoiceAudio(null)?.code).toBe('validation_error')
  })
})
