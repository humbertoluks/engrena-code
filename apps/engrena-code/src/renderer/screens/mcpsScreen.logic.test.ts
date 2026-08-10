import { describe, expect, it } from 'vitest'
import { matchesFilters } from './mcpsScreen.logic'
import type { Mcp } from '../services/mcps-service'

function makeMcp(overrides: Partial<Mcp> = {}): Mcp {
  return {
    id: 'mcp-1',
    name: 'GitHub',
    description: 'Integração com repositórios GitHub',
    transport: 'stdio',
    command: 'npx',
    args: [],
    env: {},
    url: null,
    headers: {},
    category: 'dev-tools',
    enabled: true,
    presetId: null,
    authMode: 'key',
    oauthStatus: null,
    oauthClientId: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('matchesFilters (McpsScreen)', () => {
  it('accepts everything when search is empty and category is null', () => {
    expect(matchesFilters(makeMcp(), '', null)).toBe(true)
  })

  it('rejects when the category does not match', () => {
    expect(matchesFilters(makeMcp({ category: 'dev-tools' }), '', 'produtividade')).toBe(false)
  })

  it('matches search against name or description, case-insensitive', () => {
    expect(matchesFilters(makeMcp(), 'github', null)).toBe(true)
    expect(matchesFilters(makeMcp(), 'REPOSITÓRIOS', null)).toBe(true)
    expect(matchesFilters(makeMcp(), 'inexistente', null)).toBe(false)
  })

  it('tolerates a null description without throwing', () => {
    expect(matchesFilters(makeMcp({ description: null }), 'github', null)).toBe(true)
    expect(matchesFilters(makeMcp({ description: null }), 'nada', null)).toBe(false)
  })
})
