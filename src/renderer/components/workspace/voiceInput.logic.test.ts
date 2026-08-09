import { describe, expect, it } from 'vitest'
import {
  formatRecordingTimer,
  insertAtCursor,
  mapTranscribeErrorCode,
  resolveMicTitle,
  VOICE_COPY,
} from './voiceInput.logic'

describe('resolve_mic_title_matches_ui_states', () => {
  it('idle with a key ready shows the idle title', () => {
    expect(resolveMicTitle('idle', true, null)).toBe(VOICE_COPY.titleIdle)
  })

  it('idle without a key ready shows the noKey title (ui.md !keyReady row)', () => {
    expect(resolveMicTitle('idle', false, null)).toBe(VOICE_COPY.titleNoKey)
  })

  it('configLoading shows the loading title regardless of keyReady', () => {
    expect(resolveMicTitle('configLoading', true, null)).toBe(VOICE_COPY.titleConfigLoading)
    expect(resolveMicTitle('configLoading', false, null)).toBe(VOICE_COPY.titleConfigLoading)
  })

  it('recording shows the stop-and-transcribe title', () => {
    expect(resolveMicTitle('recording', true, null)).toBe(VOICE_COPY.titleRecording)
  })

  it('requesting-permission and transcribing share the same transcribing title', () => {
    expect(resolveMicTitle('requesting-permission', true, null)).toBe(VOICE_COPY.titleTranscribing)
    expect(resolveMicTitle('transcribing', true, null)).toBe(VOICE_COPY.titleTranscribing)
  })

  it('an errorMessage overrides the title for any state (ui.md "prioridade: errorMessage se houver")', () => {
    expect(resolveMicTitle('recording', true, 'mensagem custom')).toBe('mensagem custom')
    expect(resolveMicTitle('idle', false, 'mensagem custom')).toBe('mensagem custom')
  })
})

describe('mapTranscribeErrorCode', () => {
  it('maps voice_key_missing to the noKey copy', () => {
    expect(mapTranscribeErrorCode('voice_key_missing')).toBe(VOICE_COPY.errorNoKey)
  })

  it('maps auth and upstream failures to the unified PRD transcribe message', () => {
    expect(mapTranscribeErrorCode('voice_auth_error')).toBe(VOICE_COPY.errorTranscribe)
    expect(mapTranscribeErrorCode('voice_upstream_error')).toBe(VOICE_COPY.errorTranscribe)
  })

  it('maps an unknown/undefined code to the network fallback', () => {
    expect(mapTranscribeErrorCode(undefined)).toBe(VOICE_COPY.errorNetwork)
    expect(mapTranscribeErrorCode('something_else')).toBe(VOICE_COPY.errorNetwork)
  })
})

describe('insert_at_cursor_preserves_surrounding_text', () => {
  it('inserts in the middle of existing text without overwriting the rest', () => {
    const result = insertAtCursor('fix bug in ', 11, 11, 'the login form')
    expect(result.text).toBe('fix bug in the login form')
    expect(result.cursor).toBe(25)
  })

  it('replaces a selection range with the inserted text', () => {
    const result = insertAtCursor('hello world', 6, 11, 'there')
    expect(result.text).toBe('hello there')
    expect(result.cursor).toBe(11)
  })
})

describe('formatRecordingTimer', () => {
  it('formats sub-minute and multi-minute durations as MM:SS', () => {
    expect(formatRecordingTimer(0)).toBe('00:00')
    expect(formatRecordingTimer(5_000)).toBe('00:05')
    expect(formatRecordingTimer(65_000)).toBe('01:05')
    expect(formatRecordingTimer(119_999)).toBe('01:59')
  })
})
