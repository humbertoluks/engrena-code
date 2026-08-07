import { getDb } from '../db/client.js'
import { skillsRepository, SkillNameConflictError } from '../db/repositories/skills.js'
import { createSubagentsRepository, SubagentNameConflictError } from '../db/repositories/subagents.js'
import { vaultService } from '../vault/vault-service.js'
import { SEED_CATALOG_VERSION, SEED_SKILLS, SEED_SUBAGENTS } from './catalog.js'

const FLAG_KEY = `seeds:catalog:${SEED_CATALOG_VERSION}`

export interface ApplySeedCatalogResult {
  applied: boolean
  skillsInserted: number
  skillsSkipped: number
  skillsFailed: number
  subagentsInserted: number
  subagentsSkipped: number
  subagentsFailed: number
}

function zeroResult(applied: boolean): ApplySeedCatalogResult {
  return {
    applied,
    skillsInserted: 0,
    skillsSkipped: 0,
    skillsFailed: 0,
    subagentsInserted: 0,
    subagentsSkipped: 0,
    subagentsFailed: 0,
  }
}

/** Aplica o catálogo seed v1 uma única vez por cofre (spec.md F17 §3.2, §5.1). */
export function applySeedCatalog(): ApplySeedCatalogResult {
  if (vaultService.getSecret(FLAG_KEY) !== undefined) {
    return zeroResult(false)
  }

  const result = zeroResult(true)

  for (const skill of SEED_SKILLS) {
    try {
      skillsRepository.create(skill)
      result.skillsInserted++
    } catch (err) {
      if (err instanceof SkillNameConflictError) {
        result.skillsSkipped++
      } else {
        result.skillsFailed++
        console.error('[seeds] failed to insert skill', skill.name, err)
      }
    }
  }

  const subagentsRepository = createSubagentsRepository(getDb())
  for (const subagent of SEED_SUBAGENTS) {
    try {
      subagentsRepository.create(subagent)
      result.subagentsInserted++
    } catch (err) {
      if (err instanceof SubagentNameConflictError) {
        result.subagentsSkipped++
      } else {
        result.subagentsFailed++
        console.error('[seeds] failed to insert subagent', subagent.name, err)
      }
    }
  }

  vaultService.setSecret(FLAG_KEY, '1')

  return result
}
