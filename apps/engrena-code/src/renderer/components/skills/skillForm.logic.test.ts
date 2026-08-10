import { describe, expect, it } from 'vitest'
import {
  canSubmitSkillForm,
  isContentOverLimit,
  isDescriptionLong,
} from './skillForm.logic'

describe('skillForm.logic', () => {
  it('warns when description exceeds 200 chars', () => {
    expect(isDescriptionLong('d'.repeat(201))).toBe(true)
    expect(isDescriptionLong('d'.repeat(200))).toBe(false)
  })

  it('blocks content over ~1 MiB', () => {
    expect(isContentOverLimit('a'.repeat(1_048_577))).toBe(true)
    expect(isContentOverLimit('a'.repeat(1_048_576))).toBe(false)
  })

  it('disables submit when required fields are empty', () => {
    expect(canSubmitSkillForm({ name: '', description: 'd', content: 'c' }, false)).toBe(false)
    expect(canSubmitSkillForm({ name: 'n', description: '', content: 'c' }, false)).toBe(false)
    expect(canSubmitSkillForm({ name: 'n', description: 'd', content: '' }, false)).toBe(false)
  })

  it('disables submit while saving or content over limit', () => {
    expect(canSubmitSkillForm({ name: 'n', description: 'd', content: 'c' }, true)).toBe(false)
    expect(
      canSubmitSkillForm({ name: 'n', description: 'd', content: 'a'.repeat(1_048_577) }, false)
    ).toBe(false)
  })

  it('allows submit when all fields are valid', () => {
    expect(canSubmitSkillForm({ name: 'n', description: 'd', content: 'c' }, false)).toBe(true)
  })
})
