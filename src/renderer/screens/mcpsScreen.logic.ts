import type { Mcp } from '../services/mcps-service'

/** Filtro combinado de categoria + busca por nome/descrição usado pela grade da tela MCPs. */
export function matchesFilters(mcp: Mcp, search: string, category: string | null): boolean {
  if (category !== null && (mcp.category ?? '') !== category) return false
  if (search === '') return true
  const needle = search.toLowerCase()
  return mcp.name.toLowerCase().includes(needle) || (mcp.description ?? '').toLowerCase().includes(needle)
}
