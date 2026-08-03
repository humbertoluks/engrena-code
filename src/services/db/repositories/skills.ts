import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs'
import { join } from 'path'
import { randomUUID } from 'crypto'
import { app } from 'electron'

export interface Skill {
  id: string
  name: string
  description: string
  content: string
  category: string | null
  enabled: boolean
  createdAt: number
  updatedAt: number
}

export interface SkillLinkState extends Omit<Skill, 'content'> {
  linked: boolean
  enabledInProject: boolean | null
  sortOrder: number | null
}

export interface ProjectSkillLink {
  projectId: string
  skillId: string
  enabled: boolean
  sortOrder: number
  createdAt: number
}

export interface SkillCreateInput {
  name: string
  description: string
  content: string
  category?: string | null
  enabled?: boolean
}

export type SkillUpdateInput = Partial<SkillCreateInput>

export interface SkillCounts {
  global: number
  linkedByProject: Record<string, number>
}

export const CONTENT_MAX_BYTES = 1_048_576

export class ValidationError extends Error {
  constructor(message: string) {
    super(message)
    this.name = 'ValidationError'
  }
}

export class ContentTooLongError extends Error {
  constructor() {
    super('Content excede o teto de 1 MiB.')
    this.name = 'ContentTooLongError'
  }
}

export class SkillNameConflictError extends Error {
  constructor() {
    super('Já existe uma skill com este nome.')
    this.name = 'SkillNameConflictError'
  }
}

export class SkillNotFoundError extends Error {
  constructor() {
    super('Skill não encontrada.')
    this.name = 'SkillNotFoundError'
  }
}

interface SkillsData {
  skills: Skill[]
  projectSkills: ProjectSkillLink[]
}

function resolveUserData(): string {
  const override = process.env.ENGRENACODE_USER_DATA
  if (override) {
    mkdirSync(override, { recursive: true })
    return override
  }
  return app.getPath('userData')
}

function contentByteLength(content: string): number {
  return Buffer.byteLength(content, 'utf-8')
}

function toSummary(skill: Skill): Omit<Skill, 'content'> {
  const { content: _content, ...summary } = skill
  return summary
}

class SkillsRepository {
  private data: SkillsData | null = null

  private path(): string {
    return join(resolveUserData(), 'skills.json')
  }

  private load(): SkillsData {
    if (this.data !== null) return this.data
    const filePath = this.path()
    if (existsSync(filePath)) {
      this.data = JSON.parse(readFileSync(filePath, 'utf-8')) as SkillsData
    } else {
      this.data = { skills: [], projectSkills: [] }
    }
    return this.data
  }

  private persist(): void {
    if (this.data === null) return
    writeFileSync(this.path(), JSON.stringify(this.data), 'utf-8')
  }

  private validateCreate(input: SkillCreateInput): void {
    if (!input.name || input.name.trim() === '') {
      throw new ValidationError('Nome é obrigatório.')
    }
    if (!input.description || input.description.trim() === '') {
      throw new ValidationError('Descrição é obrigatória.')
    }
    if (!input.content || input.content.trim() === '') {
      throw new ValidationError('Conteúdo é obrigatório.')
    }
    if (contentByteLength(input.content) > CONTENT_MAX_BYTES) {
      throw new ContentTooLongError()
    }
  }

  list(): Skill[] {
    return [...this.load().skills]
  }

  getById(id: string): Skill | null {
    return this.load().skills.find((s) => s.id === id) ?? null
  }

  create(input: SkillCreateInput): Skill {
    this.validateCreate(input)
    const data = this.load()
    if (data.skills.some((s) => s.name === input.name)) {
      throw new SkillNameConflictError()
    }
    const now = Date.now()
    const skill: Skill = {
      id: randomUUID(),
      name: input.name,
      description: input.description,
      content: input.content,
      category: input.category ?? null,
      enabled: input.enabled ?? true,
      createdAt: now,
      updatedAt: now,
    }
    data.skills.push(skill)
    this.persist()
    return skill
  }

  update(id: string, patch: SkillUpdateInput): Skill {
    const data = this.load()
    const existing = data.skills.find((s) => s.id === id)
    if (!existing) throw new SkillNotFoundError()

    if (patch.name !== undefined) {
      if (patch.name.trim() === '') throw new ValidationError('Nome é obrigatório.')
      if (data.skills.some((s) => s.id !== id && s.name === patch.name)) {
        throw new SkillNameConflictError()
      }
    }
    if (patch.description !== undefined && patch.description.trim() === '') {
      throw new ValidationError('Descrição é obrigatória.')
    }
    if (patch.content !== undefined) {
      if (patch.content.trim() === '') throw new ValidationError('Conteúdo é obrigatório.')
      if (contentByteLength(patch.content) > CONTENT_MAX_BYTES) throw new ContentTooLongError()
    }

    Object.assign(existing, patch, { updatedAt: Date.now() })
    this.persist()
    return existing
  }

  remove(id: string): void {
    const data = this.load()
    const idx = data.skills.findIndex((s) => s.id === id)
    if (idx === -1) throw new SkillNotFoundError()
    data.skills.splice(idx, 1)
    data.projectSkills = data.projectSkills.filter((l) => l.skillId !== id)
    this.persist()
  }

  getCounts(): SkillCounts {
    const data = this.load()
    const linkedByProject: Record<string, number> = {}
    for (const link of data.projectSkills) {
      linkedByProject[link.projectId] = (linkedByProject[link.projectId] ?? 0) + 1
    }
    return { global: data.skills.length, linkedByProject }
  }

  listForProject(projectId: string): SkillLinkState[] {
    const data = this.load()
    return data.skills.map((skill) => {
      const link = data.projectSkills.find((l) => l.projectId === projectId && l.skillId === skill.id)
      return {
        ...toSummary(skill),
        linked: link !== undefined,
        enabledInProject: link ? link.enabled : null,
        sortOrder: link ? link.sortOrder : null,
      }
    })
  }

  linkSkill(projectId: string, skillId: string, patch: { enabled?: boolean; sortOrder?: number }): SkillLinkState {
    const data = this.load()
    const skill = data.skills.find((s) => s.id === skillId)
    if (!skill) throw new SkillNotFoundError()

    let link = data.projectSkills.find((l) => l.projectId === projectId && l.skillId === skillId)
    if (!link) {
      link = { projectId, skillId, enabled: true, sortOrder: 0, createdAt: Date.now() }
      data.projectSkills.push(link)
    }
    if (patch.enabled !== undefined) link.enabled = patch.enabled
    if (patch.sortOrder !== undefined) link.sortOrder = patch.sortOrder
    this.persist()

    return {
      ...toSummary(skill),
      linked: true,
      enabledInProject: link.enabled,
      sortOrder: link.sortOrder,
    }
  }

  unlinkSkill(projectId: string, skillId: string): void {
    const data = this.load()
    data.projectSkills = data.projectSkills.filter(
      (l) => !(l.projectId === projectId && l.skillId === skillId)
    )
    this.persist()
  }

  reorder(projectId: string, items: Array<{ id: string; enabled?: boolean; sortOrder: number }>): void {
    for (const item of items) {
      this.linkSkill(projectId, item.id, { enabled: item.enabled, sortOrder: item.sortOrder })
    }
  }

  resolveForProject(projectId: string): Skill[] {
    const data = this.load()
    return data.skills.filter((skill) => {
      if (!skill.enabled) return false
      const link = data.projectSkills.find((l) => l.projectId === projectId && l.skillId === skill.id)
      return link !== undefined && link.enabled
    })
  }

  /** Test-only: force reload from disk on next access. */
  _resetCache(): void {
    this.data = null
  }
}

export const skillsRepository = new SkillsRepository()
