import type { Skill } from '../services/skills-service'

/** Filtro combinado de categoria + busca por nome/descrição usado pela grade da tela Skills. */
export function matchesFilters(skill: Skill, search: string, category: string | null): boolean {
  if (category !== null && (skill.category ?? '') !== category) return false
  if (search === '') return true
  const needle = search.toLowerCase()
  return skill.name.toLowerCase().includes(needle) || skill.description.toLowerCase().includes(needle)
}
