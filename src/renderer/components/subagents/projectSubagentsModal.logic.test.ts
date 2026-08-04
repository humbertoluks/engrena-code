import { describe, expect, it } from 'vitest'
import type { SubagentLinkState } from '../../../services/db/repositories/subagents.js'
import { exceedsSoftCap, filterLinkStates, reorderLinkedItems } from './projectSubagentsModal.logic.js'

function makeLink(overrides: Partial<SubagentLinkState> = {}): SubagentLinkState {
  return {
    id: 'a',
    name: 'a',
    description: 'desc',
    provider: 'claude',
    model: null,
    reasoningLevel: null,
    tools: null,
    category: null,
    idleTimeoutMinutes: null,
    enabled: true,
    createdAt: 0,
    updatedAt: 0,
    linked: true,
    enabledInProject: true,
    sortOrder: 0,
    ...overrides,
  }
}

describe('projectSubagentsModal.logic', () => {
  it('exceedsSoftCap only above 10', () => {
    expect(exceedsSoftCap(10)).toBe(false)
    expect(exceedsSoftCap(11)).toBe(true)
  })

  it('filterLinkStates matches name or description', () => {
    const states = [makeLink({ id: '1', name: 'revisor', description: 'x' }), makeLink({ id: '2', name: 'zeta', description: 'busca vulnerabilidades' })]
    expect(filterLinkStates(states, 'revisor', '')).toHaveLength(1)
    expect(filterLinkStates(states, 'vulnerabilidades', '')).toHaveLength(1)
    expect(filterLinkStates(states, 'nope', '')).toHaveLength(0)
  })

  it('filterLinkStates filters by category', () => {
    const states = [makeLink({ id: '1', category: 'qualidade' }), makeLink({ id: '2', category: 'infra' })]
    expect(filterLinkStates(states, '', 'infra')).toHaveLength(1)
  })

  describe('reorderLinkedItems', () => {
    const linked = [
      makeLink({ id: '1', sortOrder: 0 }),
      makeLink({ id: '2', sortOrder: 1 }),
      makeLink({ id: '3', sortOrder: 2 }),
    ]

    it('moves an item up', () => {
      const result = reorderLinkedItems(linked, '2', 'up')
      expect(result.find((x) => x.id === '2')?.sortOrder).toBe(0)
      expect(result.find((x) => x.id === '1')?.sortOrder).toBe(1)
    })

    it('moves an item down', () => {
      const result = reorderLinkedItems(linked, '2', 'down')
      expect(result.find((x) => x.id === '2')?.sortOrder).toBe(2)
      expect(result.find((x) => x.id === '3')?.sortOrder).toBe(1)
    })

    it('is a no-op moving the first item up', () => {
      const result = reorderLinkedItems(linked, '1', 'up')
      expect(result.find((x) => x.id === '1')?.sortOrder).toBe(0)
    })

    it('is a no-op moving the last item down', () => {
      const result = reorderLinkedItems(linked, '3', 'down')
      expect(result.find((x) => x.id === '3')?.sortOrder).toBe(2)
    })

    it('produces contiguous sortOrder covering all linked items', () => {
      const result = reorderLinkedItems(linked, '2', 'up')
      const orders = result.map((r) => r.sortOrder).sort((a, b) => a - b)
      expect(orders).toEqual([0, 1, 2])
    })
  })
})
