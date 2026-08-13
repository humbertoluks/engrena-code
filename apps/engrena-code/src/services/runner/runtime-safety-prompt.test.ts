import { describe, expect, it } from 'vitest'
import { RUNTIME_SAFETY_PROMPT } from './runtime-safety-prompt.js'

describe('RUNTIME_SAFETY_PROMPT', () => {
  it('forbids kill-by-name and prefers kill-by-port', () => {
    expect(RUNTIME_SAFETY_PROMPT).toContain('Never kill processes by generic name')
    expect(RUNTIME_SAFETY_PROMPT).toContain('Stop-Process -Name node')
    expect(RUNTIME_SAFETY_PROMPT).toContain('npx kill-port')
    expect(RUNTIME_SAFETY_PROMPT).toContain('LocalPort')
  })

  it('forbids telling the user that tool approval is button-only', () => {
    expect(RUNTIME_SAFETY_PROMPT).toContain('Tool permissions')
    expect(RUNTIME_SAFETY_PROMPT).toContain('composer')
    expect(RUNTIME_SAFETY_PROMPT).toMatch(/Never tell the user that approval must be done only by clicking/i)
  })

  it('forbids ask_user_question as a second gate for tool/Bash permission', () => {
    expect(RUNTIME_SAFETY_PROMPT).toContain('ask_user_question')
    expect(RUNTIME_SAFETY_PROMPT).toMatch(/Do NOT use ask_user_question/i)
  })
})
