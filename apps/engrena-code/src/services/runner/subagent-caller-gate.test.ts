import { describe, expect, it } from 'vitest'
import { canDelegateSubagent } from './subagent-caller-gate.js'

describe('subagent-caller-gate', () => {
  it('codex_parent_without_full_access_blocks', () => {
    const result = canDelegateSubagent({ provider: 'codex', accessLevel: 'supervised' })
    expect(result.allowed).toBe(false)
    expect(result.reason).toBeTruthy()
  })

  it('blocks codex with auto-accept-edits too', () => {
    const result = canDelegateSubagent({ provider: 'codex', accessLevel: 'auto-accept-edits' })
    expect(result.allowed).toBe(false)
  })

  it('allows codex with full-access', () => {
    expect(canDelegateSubagent({ provider: 'codex', accessLevel: 'full-access' }).allowed).toBe(true)
  })

  it('allows claude and kimi regardless of access level', () => {
    expect(canDelegateSubagent({ provider: 'claude', accessLevel: 'supervised' }).allowed).toBe(true)
    expect(canDelegateSubagent({ provider: 'kimi', accessLevel: 'supervised' }).allowed).toBe(true)
  })
})
