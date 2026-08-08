import type { Rule } from '../services/rules-service'

/** Filtro combinado de categoria + busca por nome/descrição usado pela grade da tela Rules. */
export function matchesFilters(rule: Rule, search: string, category: string | null): boolean {
  if (category !== null && rule.category !== category) return false
  const query = search.trim().toLowerCase()
  if (query === '') return true
  return rule.name.toLowerCase().includes(query) || (rule.description ?? '').toLowerCase().includes(query)
}
