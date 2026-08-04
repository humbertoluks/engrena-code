import { describe, expect, it } from 'vitest'
import {
  buildSubagentPayload,
  canSubmitSubagentForm,
  emptyFormValues,
  hidesModelFields,
  idleTimeoutIsValid,
  promptExceedsLimit,
  toolsModeFromValue,
  toolsValueFromMode,
} from './subagentForm.logic.js'

describe('subagentForm.logic', () => {
  it('blocks prompts over 1 MiB', () => {
    expect(promptExceedsLimit('a'.repeat(1_048_576))).toBe(false)
    expect(promptExceedsLimit('a'.repeat(1_048_577))).toBe(true)
  })

  describe('tools 3-state', () => {
    it('null means unrestricted', () => {
      expect(toolsModeFromValue(null)).toBe('unrestricted')
      expect(toolsValueFromMode('unrestricted', ['x'])).toBeNull()
    })

    it('empty array means none', () => {
      expect(toolsModeFromValue([])).toBe('none')
      expect(toolsValueFromMode('none', ['x'])).toEqual([])
    })

    it('non-empty array means allowlist', () => {
      expect(toolsModeFromValue(['Read'])).toBe('allowlist')
      expect(toolsValueFromMode('allowlist', ['Read', 'Grep'])).toEqual(['Read', 'Grep'])
    })
  })

  it('inherit hides model/reasoning fields', () => {
    expect(hidesModelFields('inherit')).toBe(true)
    expect(hidesModelFields('claude')).toBe(false)
    expect(hidesModelFields('codex')).toBe(false)
    expect(hidesModelFields('kimi')).toBe(false)
  })

  it('idle timeout accepts empty (default) and 1..480', () => {
    expect(idleTimeoutIsValid('')).toBe(true)
    expect(idleTimeoutIsValid('1')).toBe(true)
    expect(idleTimeoutIsValid('480')).toBe(true)
    expect(idleTimeoutIsValid('0')).toBe(false)
    expect(idleTimeoutIsValid('481')).toBe(false)
    expect(idleTimeoutIsValid('abc')).toBe(false)
  })

  describe('canSubmitSubagentForm', () => {
    it('requires name, description and prompt', () => {
      const base = emptyFormValues()
      expect(canSubmitSubagentForm(base)).toBe(false)
      expect(
        canSubmitSubagentForm({ ...base, name: 'a', description: 'd', prompt: 'p' })
      ).toBe(true)
    })

    it('rejects prompt over 1 MiB', () => {
      const values = { ...emptyFormValues(), name: 'a', description: 'd', prompt: 'a'.repeat(1_048_577) }
      expect(canSubmitSubagentForm(values)).toBe(false)
    })

    it('rejects invalid idle timeout', () => {
      const values = {
        ...emptyFormValues(),
        name: 'a',
        description: 'd',
        prompt: 'p',
        idleTimeoutMinutes: '999',
      }
      expect(canSubmitSubagentForm(values)).toBe(false)
    })
  })

  describe('buildSubagentPayload', () => {
    it('omits model/reasoning when provider is inherit', () => {
      const payload = buildSubagentPayload({
        ...emptyFormValues(),
        name: 'a',
        description: 'd',
        prompt: 'p',
        provider: 'inherit',
        model: 'opus',
        reasoningLevel: 'high',
      })
      expect(payload.model).toBeNull()
      expect(payload.reasoningLevel).toBeNull()
    })

    it('keeps model/reasoning for concrete providers', () => {
      const payload = buildSubagentPayload({
        ...emptyFormValues(),
        name: 'a',
        description: 'd',
        prompt: 'p',
        provider: 'claude',
        model: 'opus',
        reasoningLevel: 'high',
      })
      expect(payload.model).toBe('opus')
      expect(payload.reasoningLevel).toBe('high')
    })

    it('converts empty idleTimeoutMinutes to null', () => {
      const payload = buildSubagentPayload({ ...emptyFormValues(), name: 'a', description: 'd', prompt: 'p' })
      expect(payload.idleTimeoutMinutes).toBeNull()
    })

    it('parses idleTimeoutMinutes when provided', () => {
      const payload = buildSubagentPayload({
        ...emptyFormValues(),
        name: 'a',
        description: 'd',
        prompt: 'p',
        idleTimeoutMinutes: '45',
      })
      expect(payload.idleTimeoutMinutes).toBe(45)
    })
  })
})
