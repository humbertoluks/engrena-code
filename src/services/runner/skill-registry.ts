import { skillsRepository } from '../db/repositories/skills.js'

export interface SkillCatalogEntry {
  name: string
  description: string
}

export interface SkillSnapshot {
  catalog: SkillCatalogEntry[]
  loadSkill: (name: string) => string | null
}

/**
 * Snapshot do catálogo resolvido no início do turno — a tool load_skill
 * lê deste snapshot em vez do DB, então uma skill editada mid-turn não
 * muda o conteúdo já anunciado ao modelo (spec F05 §5).
 */
export function createSkillSnapshot(projectId: string): SkillSnapshot {
  const resolved = skillsRepository.resolveForProject(projectId)
  const contentByName = new Map(resolved.map((skill) => [skill.name, skill.content]))

  return {
    catalog: resolved.map((skill) => ({ name: skill.name, description: skill.description })),
    loadSkill: (name: string) => contentByName.get(name) ?? null,
  }
}
