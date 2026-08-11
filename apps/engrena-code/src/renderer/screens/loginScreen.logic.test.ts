import { describe, expect, it } from 'vitest'
import {
  CODE_BRAND,
  classifyUnlockFailure,
  messageForError,
} from '@engrena/ui'

describe('loginScreen.logic (shared)', () => {
  describe('messageForError', () => {
    it('returns copy for invalid, corrupted and network', () => {
      expect(messageForError('invalid', 0, CODE_BRAND)).toBe('Workspace ou senha inválidos.')
      expect(messageForError('corrupted', 0, CODE_BRAND)).toContain('danificado')
      expect(messageForError('network', 0, CODE_BRAND)).toContain('EngrenaCode')
    })

    it('formats backoff with ceil seconds', () => {
      expect(messageForError('backoff', 1500, CODE_BRAND)).toBe(
        'Muitas tentativas. Tente novamente em 2s.',
      )
      expect(messageForError('backoff', 0, CODE_BRAND)).toBe(
        'Muitas tentativas. Tente novamente em 0s.',
      )
    })

    it('returns null when kind is null', () => {
      expect(messageForError(null, 0, CODE_BRAND)).toBeNull()
    })
  })

  describe('classifyUnlockFailure', () => {
    it('classifies vault_corrupted and 422 as corrupted', () => {
      expect(
        classifyUnlockFailure(
          { status: 400 },
          { unlocked: false, error: { code: 'vault_corrupted' } },
        ),
      ).toEqual({ kind: 'corrupted', retryMs: 0 })
      expect(classifyUnlockFailure({ status: 422 }, { unlocked: false })).toEqual({
        kind: 'corrupted',
        retryMs: 0,
      })
    })

    it('classifies 429 with retryAfterMs as backoff', () => {
      expect(
        classifyUnlockFailure({ status: 429 }, { unlocked: false, retryAfterMs: 5000 }),
      ).toEqual({ kind: 'backoff', retryMs: 5000 })
    })

    it('classifies 429 without retry as invalid', () => {
      expect(classifyUnlockFailure({ status: 429 }, { unlocked: false })).toEqual({
        kind: 'invalid',
        retryMs: 0,
      })
    })

    it('classifies retryAfterMs on other statuses as backoff', () => {
      expect(
        classifyUnlockFailure({ status: 401 }, { unlocked: false, retryAfterMs: 3000 }),
      ).toEqual({ kind: 'backoff', retryMs: 3000 })
    })

    it('defaults remaining failures to invalid', () => {
      expect(
        classifyUnlockFailure(
          { status: 401 },
          { unlocked: false, error: { code: 'invalid_password' } },
        ),
      ).toEqual({ kind: 'invalid', retryMs: 0 })
    })
  })
})
