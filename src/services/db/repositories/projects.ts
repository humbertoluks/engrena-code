import { randomUUID } from 'crypto'
import { accessSync, constants, statSync } from 'fs'
import { basename, resolve } from 'path'
import { getDb } from '../client.js'

export interface Project {
  id: string
  path: string
  name: string
  createdAt: number
  updatedAt: number
}

export type ProjectPathInvalidReason = 'not_found' | 'not_directory' | 'permission_denied' | 'access_error'

export class ProjectError extends Error {
  code: string
  details?: Record<string, unknown>

  constructor(code: string, message: string, details?: Record<string, unknown>) {
    super(message)
    this.code = code
    this.details = details
  }
}

interface ProjectRow {
  id: string
  path: string
  name: string
  created_at: number
  updated_at: number
}

function toProject(row: ProjectRow): Project {
  return {
    id: row.id,
    path: row.path,
    name: row.name,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

function mapUniqueViolation(err: unknown): never {
  if (err instanceof Error && /UNIQUE constraint failed/.test(err.message)) {
    throw new ProjectError('project_duplicate', 'Este diretório já foi adicionado como projeto.')
  }
  throw err
}

/** Valida que `path` é um diretório existente e legível. Lança ProjectError('project_path_invalid', ..., { reason }). */
export function validateProjectPath(path: string): string {
  if (typeof path !== 'string' || path.trim() === '') {
    throw new ProjectError('project_path_invalid', 'Informe um caminho de diretório válido.', {
      reason: 'not_found' satisfies ProjectPathInvalidReason,
    })
  }

  const normalized = resolve(path)
  let stat
  try {
    stat = statSync(normalized)
  } catch (err) {
    const code = (err as NodeJS.ErrnoException).code
    if (code === 'ENOENT') {
      throw new ProjectError('project_path_invalid', 'O caminho informado não existe no sistema de arquivos.', {
        reason: 'not_found' satisfies ProjectPathInvalidReason,
      })
    }
    if (code === 'EACCES') {
      throw new ProjectError('project_path_invalid', 'Sem permissão de leitura no diretório informado.', {
        reason: 'permission_denied' satisfies ProjectPathInvalidReason,
      })
    }
    throw new ProjectError('project_path_invalid', 'Não foi possível acessar o caminho informado.', {
      reason: 'access_error' satisfies ProjectPathInvalidReason,
    })
  }

  if (!stat.isDirectory()) {
    throw new ProjectError('project_path_invalid', 'O caminho informado não é um diretório.', {
      reason: 'not_directory' satisfies ProjectPathInvalidReason,
    })
  }

  try {
    accessSync(normalized, constants.R_OK)
  } catch {
    throw new ProjectError('project_path_invalid', 'Sem permissão de leitura no diretório informado.', {
      reason: 'permission_denied' satisfies ProjectPathInvalidReason,
    })
  }

  return normalized
}

export interface CreateProjectInput {
  path: string
  name?: string
}

export function listProjects(): Project[] {
  const rows = getDb().prepare('SELECT * FROM projects ORDER BY name COLLATE NOCASE').all() as unknown as ProjectRow[]
  return rows.map(toProject)
}

export function getProject(id: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE id = ?').get(id) as ProjectRow | undefined
  return row === undefined ? null : toProject(row)
}

export function getProjectByPath(path: string): Project | null {
  const row = getDb().prepare('SELECT * FROM projects WHERE path = ?').get(path) as ProjectRow | undefined
  return row === undefined ? null : toProject(row)
}

/** Adiciona um projeto. Não exige `.git` (soft add) — gate de inicialização fica no composer/git-init. */
export function createProject(input: CreateProjectInput): Project {
  const normalized = validateProjectPath(input.path)
  const name = input.name?.trim() ? input.name.trim() : basename(normalized)
  const now = Date.now()
  const id = randomUUID()

  try {
    getDb()
      .prepare(
        `INSERT INTO projects (id, path, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?)`
      )
      .run(id, normalized, name, now, now)
  } catch (err) {
    mapUniqueViolation(err)
  }

  return getProject(id) as Project
}

export function deleteProject(id: string): boolean {
  const result = getDb().prepare('DELETE FROM projects WHERE id = ?').run(id)
  return Number(result.changes) > 0
}
