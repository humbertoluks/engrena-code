import type { CatalogOrderItem, SubagentLinkState } from '../../../services/db/repositories/subagents.js'

export const SUBAGENTS_LINK_SOFT_CAP = 10

export function exceedsSoftCap(linkedCount: number): boolean {
  return linkedCount > SUBAGENTS_LINK_SOFT_CAP
}

export function filterLinkStates(states: SubagentLinkState[], search: string, categoryTab: string): SubagentLinkState[] {
  const needle = search.trim().toLowerCase()
  return states.filter((s) => {
    if (needle !== '' && !s.name.toLowerCase().includes(needle) && !s.description.toLowerCase().includes(needle)) {
      return false
    }
    if (categoryTab !== '' && s.category !== categoryTab) return false
    return true
  })
}

function toOrderItem(s: SubagentLinkState, sortOrder: number): CatalogOrderItem {
  return { id: s.id, enabled: s.enabledInProject ?? true, sortOrder }
}

export function reorderLinkedItems(
  linked: SubagentLinkState[],
  id: string,
  direction: 'up' | 'down'
): CatalogOrderItem[] {
  const sorted = [...linked].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0))
  const index = sorted.findIndex((x) => x.id === id)
  if (index === -1) return sorted.map((s, i) => toOrderItem(s, i))

  const targetIndex = direction === 'up' ? index - 1 : index + 1
  if (targetIndex < 0 || targetIndex >= sorted.length) return sorted.map((s, i) => toOrderItem(s, i))

  const swapped = [...sorted]
  const tmp = swapped[index]
  swapped[index] = swapped[targetIndex]
  swapped[targetIndex] = tmp
  return swapped.map((s, i) => toOrderItem(s, i))
}
