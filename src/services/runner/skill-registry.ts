import { mkdirSync, writeFileSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'
import { skillsRepository } from '../db/repositories/skills.js'

/** Nome completo da tool no harness Claude / Codex MCP. */
export const LOAD_SKILL_TOOL_NAME = 'mcp__engrenacode__load_skill'

export interface SkillCatalogEntry {
  name: string
  description: string
}

export interface SkillSnapshot {
  catalog: SkillCatalogEntry[]
  loadSkill: (name: string) => string | null
}

export interface SkillSnapshotFile {
  skills: Record<string, string>
}

/**
 * Snapshot do catálogo resolvido no início do turno — a tool load_skill
 * lê deste snapshot em vez do DB, então uma skill editada mid-turn não
 * muda o conteúdo já anunciado ao modelo (spec F05 §5 / F12).
 */
export function createSkillSnapshot(projectId: string): SkillSnapshot {
  const resolved = skillsRepository.resolveForProject(projectId)
  const contentByName = new Map(resolved.map((skill) => [skill.name, skill.content]))

  return {
    catalog: resolved.map((skill) => ({ name: skill.name, description: skill.description })),
    loadSkill: (name: string) => contentByName.get(name) ?? null,
  }
}

function resolveSnapshotDir(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  const dir = override ?? app.getPath('userData')
  const snapDir = join(dir, 'skill-snapshots')
  mkdirSync(snapDir, { recursive: true })
  return snapDir
}

/** Grava JSON imutável do turno para o MCP `load_skill` ler via `--skills-snapshot`. */
export function writeSkillSnapshotFile(snapshot: SkillSnapshot): string {
  const skills: Record<string, string> = {}
  for (const entry of snapshot.catalog) {
    const content = snapshot.loadSkill(entry.name)
    if (content !== null) skills[entry.name] = content
  }
  const path = join(resolveSnapshotDir(), `skills-${randomUUID()}.json`)
  const body: SkillSnapshotFile = { skills }
  writeFileSync(path, JSON.stringify(body), { mode: 0o600 })
  return path
}
