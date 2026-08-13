import { describe, expect, it } from 'vitest'
import {
  AUTO_ACCEPTED_TOOLS,
  permissionBrokerApplies,
  permissionPolicyDecision,
} from './permission-policy.js'

describe('permissionBrokerApplies', () => {
  it('vale em supervised e auto-accept-edits, dispensa só full-access', () => {
    expect(permissionBrokerApplies('supervised')).toBe(true)
    expect(permissionBrokerApplies('auto-accept-edits')).toBe(true)
    expect(permissionBrokerApplies('full-access')).toBe(false)
  })
})

describe('permissionPolicyDecision', () => {
  it('supervised pergunta tudo, inclusive leitura', () => {
    for (const tool of ['Read', 'Write', 'Bash', 'mcp__x__y']) {
      expect(permissionPolicyDecision('supervised', tool)).toBe('ask')
    }
  })

  it('auto-accept-edits libera leitura/edição sem UI', () => {
    for (const tool of AUTO_ACCEPTED_TOOLS) {
      expect(permissionPolicyDecision('auto-accept-edits', tool)).toBe('allow')
    }
  })

  it('auto-accept-edits pergunta em Bash, WebFetch e tools MCP', () => {
    for (const tool of ['Bash', 'WebFetch', 'WebSearch', 'mcp__plugin_context7__resolve-library-id']) {
      expect(permissionPolicyDecision('auto-accept-edits', tool)).toBe('ask')
    }
  })

  it('full-access libera qualquer tool', () => {
    for (const tool of ['Bash', 'Write', 'mcp__x__y', 'unknown']) {
      expect(permissionPolicyDecision('full-access', tool)).toBe('allow')
    }
  })

  it('tool desconhecida em auto-accept-edits pergunta (fail-closed)', () => {
    expect(permissionPolicyDecision('auto-accept-edits', 'unknown')).toBe('ask')
  })
})
