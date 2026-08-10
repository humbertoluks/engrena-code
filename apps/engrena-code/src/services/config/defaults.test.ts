import { describe, expect, it } from 'vitest'
import { DEFAULT_PROMPT } from './defaults.js'

describe('DEFAULT_PROMPT', () => {
  it('is a non-empty PT-BR system prompt mentioning the domain vocabulary', () => {
    expect(typeof DEFAULT_PROMPT).toBe('string')
    expect(DEFAULT_PROMPT.trim().length).toBeGreaterThan(0)
    expect(DEFAULT_PROMPT).toContain('subagents')
    expect(DEFAULT_PROMPT).toContain('skills')
    expect(DEFAULT_PROMPT).toContain('MCPs')
    expect(DEFAULT_PROMPT).toContain('diff')
  })
})
