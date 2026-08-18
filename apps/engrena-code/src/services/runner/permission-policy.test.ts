import { describe, expect, it } from 'vitest'
import {
  AUTO_ACCEPTED_TOOLS,
  INTERNAL_ALWAYS_ALLOWED_TOOLS,
  permissionBrokerApplies,
  permissionPolicyDecision,
  TOOL_SEARCH_TOOL_NAME,
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

describe('INTERNAL_ALWAYS_ALLOWED_TOOLS', () => {
  it('bate com as constantes reais das tools internas (nenhuma divergência silenciosa)', async () => {
    const { ASK_USER_QUESTION_TOOL_NAME } = await import('./ask-user-question.js')
    const { LOAD_SKILL_TOOL_NAME } = await import('./skill-registry.js')
    const { CALL_SUBAGENT_TOOL_NAME } = await import('./subagent-registry.js')
    expect([...INTERNAL_ALWAYS_ALLOWED_TOOLS].sort()).toEqual(
      [
        TOOL_SEARCH_TOOL_NAME,
        ASK_USER_QUESTION_TOOL_NAME,
        LOAD_SKILL_TOOL_NAME,
        CALL_SUBAGENT_TOOL_NAME,
      ].sort()
    )
  })

  it('nunca abre pedido, em nível nenhum', () => {
    for (const tool of INTERNAL_ALWAYS_ALLOWED_TOOLS) {
      for (const level of ['supervised', 'auto-accept-edits', 'full-access'] as const) {
        expect(permissionPolicyDecision(level, tool)).toBe('allow')
      }
    }
  })

  it('ToolSearch entra porque é a porta de entrada das tools MCP deferidas', () => {
    // Sem ela o schema de call_subagent não carrega e o modelo cai na tool nativa `Agent`,
    // que não abre subagent_runs — delegação fora do grafo e da auditoria.
    expect(INTERNAL_ALWAYS_ALLOWED_TOOLS).toContain(TOOL_SEARCH_TOOL_NAME)
    expect(permissionPolicyDecision('supervised', TOOL_SEARCH_TOOL_NAME)).toBe('allow')
  })

  it('não afrouxa o resto: Bash segue pedindo fora de full-access', () => {
    expect(permissionPolicyDecision('supervised', 'Bash')).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'Bash')).toBe('ask')
    expect(permissionPolicyDecision('auto-accept-edits', 'mcp__outro__tool')).toBe('ask')
  })
})
