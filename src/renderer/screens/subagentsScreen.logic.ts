import type { Subagent } from '../services/subagents-service'

/** Busca por nome/descrição usada pela grade da tela SubAgents. */
export function matchesSearch(s: Subagent, query: string): boolean {
  if (query.trim() === '') return true
  const needle = query.trim().toLowerCase()
  return s.name.toLowerCase().includes(needle) || s.description.toLowerCase().includes(needle)
}

/** Filtro combinado de busca + modelo + categoria usado pela grade da tela SubAgents. */
export function matchesFilters(
  s: Subagent,
  search: string,
  modelFilter: string,
  categoryTab: string
): boolean {
  if (!matchesSearch(s, search)) return false
  if (modelFilter !== '' && s.model !== modelFilter) return false
  if (categoryTab !== '' && s.category !== categoryTab) return false
  return true
}
