import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f06_rules_'))

const { getDb, closeDb } = await import('../client.js')
const {
  createRule,
  updateRule,
  deleteRule,
  listRules,
  setProjectRuleLink,
  unlinkProjectRule,
  resolveForTurn,
  getCounts,
  RuleError,
} = await import('./rules.js')

beforeEach(() => {
  getDb().exec('DELETE FROM project_rules')
  getDb().exec('DELETE FROM rules')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createRule', () => {
  it('rejects_duplicate_name', () => {
    createRule({ name: 'idioma', content: 'conteúdo' })
    expect(() => createRule({ name: 'idioma', content: 'outro' })).toThrow(RuleError)
    try {
      createRule({ name: 'idioma', content: 'outro' })
    } catch (err) {
      expect((err as InstanceType<typeof RuleError>).code).toBe('rule_name_conflict')
    }
  })

  it('rejects_name_with_crlf', () => {
    expect(() => createRule({ name: 'linha\nquebrada', content: 'x' })).toThrow(RuleError)
    try {
      createRule({ name: 'linha\rquebrada', content: 'x' })
    } catch (err) {
      expect((err as InstanceType<typeof RuleError>).code).toBe('invalid_request')
    }
  })

  it('rejects_content_over_1mib', () => {
    const huge = 'a'.repeat(1024 * 1024 + 1)
    try {
      createRule({ name: 'grande', content: huge })
      expect.unreachable()
    } catch (err) {
      expect((err as InstanceType<typeof RuleError>).code).toBe('too_long')
    }
  })
})

describe('resolveForTurn — dual semantics', () => {
  it('global_without_row_is_active', () => {
    const rule = createRule({ name: 'global-1', content: 'a', isGlobal: true })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).toContain(rule.id)
  })

  it('global_override_off_excludes', () => {
    const rule = createRule({ name: 'global-2', content: 'a', isGlobal: true })
    setProjectRuleLink('project-a', rule.id, { enabled: false })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).not.toContain(rule.id)
  })

  it('global_reenable_deletes_row', () => {
    const rule = createRule({ name: 'global-3', content: 'a', isGlobal: true })
    setProjectRuleLink('project-a', rule.id, { enabled: false })
    setProjectRuleLink('project-a', rule.id, { enabled: true })

    const row = getDb()
      .prepare('SELECT * FROM project_rules WHERE project_id = ? AND rule_id = ?')
      .get('project-a', rule.id)
    expect(row).toBeUndefined()

    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).toContain(rule.id)
  })

  it('nonglobal_unlinked_excluded', () => {
    const rule = createRule({ name: 'local-1', content: 'a', isGlobal: false })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).not.toContain(rule.id)
  })

  it('nonglobal_linked_disabled_excluded', () => {
    const rule = createRule({ name: 'local-2', content: 'a', isGlobal: false })
    setProjectRuleLink('project-a', rule.id, { enabled: false })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).not.toContain(rule.id)
  })

  it('nonglobal_linked_enabled_included', () => {
    const rule = createRule({ name: 'local-3', content: 'a', isGlobal: false })
    setProjectRuleLink('project-a', rule.id, { enabled: true })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).toContain(rule.id)
  })

  it('kill_switch_excludes_everywhere', () => {
    const rule = createRule({ name: 'global-4', content: 'a', isGlobal: true })
    updateRule(rule.id, { enabled: false })
    const resolved = resolveForTurn('project-a')
    expect(resolved.map((r) => r.id)).not.toContain(rule.id)
  })

  it('unlinkProjectRule removes a non-global link', () => {
    const rule = createRule({ name: 'local-4', content: 'a', isGlobal: false })
    setProjectRuleLink('project-a', rule.id, { enabled: true })
    expect(unlinkProjectRule('project-a', rule.id)).toBe(true)
    expect(resolveForTurn('project-a').map((r) => r.id)).not.toContain(rule.id)
  })
})

describe('deleteRule', () => {
  it('cascades project_rules rows for the deleted rule', () => {
    const rule = createRule({ name: 'to-delete', content: 'a', isGlobal: false })
    setProjectRuleLink('project-a', rule.id, { enabled: true })
    expect(deleteRule(rule.id)).toBe(true)
    const row = getDb().prepare('SELECT * FROM project_rules WHERE rule_id = ?').get(rule.id)
    expect(row).toBeUndefined()
    expect(listRules().map((r) => r.id)).not.toContain(rule.id)
  })
})

describe('getCounts', () => {
  it('counts enabled globals and active rules per project with a project_rules row', () => {
    const global1 = createRule({ name: 'g1', content: 'a', isGlobal: true })
    createRule({ name: 'g2', content: 'a', isGlobal: true, enabled: false })
    const local1 = createRule({ name: 'l1', content: 'a', isGlobal: false })

    setProjectRuleLink('project-a', local1.id, { enabled: true })
    setProjectRuleLink('project-a', global1.id, { enabled: false })

    const counts = getCounts()
    expect(counts.global).toBe(1)
    expect(counts.activeByProject['project-a']).toBe(1)
  })
})
