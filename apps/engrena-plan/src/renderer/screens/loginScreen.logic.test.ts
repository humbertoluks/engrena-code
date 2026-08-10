import { describe, expect, it } from 'vitest'
import {
  classifyUnlockFailure,
  messageForError,
  PLAN_BRAND,
  PLAN_UNLOCK_ORIGIN,
} from './loginScreen.logic'

describe('loginScreen.logic', () => {
  it('exposes Plan unlock origin on 5184 and EngrenaPlan brand', () => {
    expect(PLAN_UNLOCK_ORIGIN).toBe('http://127.0.0.1:5184')
    expect(PLAN_BRAND).toBe('EngrenaPlan')
    expect(PLAN_BRAND).not.toMatch(/Lion|Code/)
  })

  it('classifies vault_corrupted / 422 as corrupted', () => {
    expect(
      classifyUnlockFailure({ status: 422 }, { unlocked: false, error: { code: 'vault_corrupted' } }),
    ).toEqual({ kind: 'corrupted', retryMs: 0 })
  })

  it('classifies retryAfterMs as backoff', () => {
    expect(
      classifyUnlockFailure({ status: 200 }, { unlocked: false, retryAfterMs: 3000 }),
    ).toEqual({ kind: 'backoff', retryMs: 3000 })
  })

  it('maps error kinds to pt-BR copy mentioning EngrenaPlan', () => {
    expect(messageForError('invalid', 0)).toMatch(/inválidos/i)
    expect(messageForError('network', 0)).toMatch(/EngrenaPlan/)
    expect(messageForError('backoff', 2500)).toMatch(/3s/)
  })
})
