import { describe, expect, it } from 'vitest'
import { RUNTIME_SAFETY_PROMPT } from './runtime-safety-prompt.js'

describe('RUNTIME_SAFETY_PROMPT', () => {
  it('forbids kill-by-name and prefers kill-by-port', () => {
    expect(RUNTIME_SAFETY_PROMPT).toContain('Never kill processes by generic name')
    expect(RUNTIME_SAFETY_PROMPT).toContain('Stop-Process -Name node')
    expect(RUNTIME_SAFETY_PROMPT).toContain('npx kill-port')
    expect(RUNTIME_SAFETY_PROMPT).toContain('LocalPort')
  })
})
