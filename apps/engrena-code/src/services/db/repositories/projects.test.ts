import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join, resolve } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_projects_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject, deleteProject, getProject, listProjects, setMemoryEnabled, ProjectError } = await import(
  './projects.js'
)

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_fixture_'))
const projectDirA = join(fixtureRoot, 'project-a')
const projectDirB = join(fixtureRoot, 'project-b')

beforeEach(() => {
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('createProject', () => {
  it('adds a project without requiring .git', () => {
    mkdtempSyncDir(projectDirA)
    const project = createProject({ path: projectDirA })
    expect(project.path).toBe(resolve(projectDirA))
    expect(project.name).toBe('project-a')
  })

  it('defaults name to basename of path', () => {
    mkdtempSyncDir(projectDirB)
    const project = createProject({ path: projectDirB, name: '  ' })
    expect(project.name).toBe('project-b')
  })

  it('rejects a path that does not exist', () => {
    try {
      createProject({ path: join(fixtureRoot, 'nao-existe') })
      expect.unreachable()
    } catch (err) {
      expect(err).toBeInstanceOf(ProjectError)
      expect((err as InstanceType<typeof ProjectError>).code).toBe('project_path_invalid')
      expect((err as InstanceType<typeof ProjectError>).details?.reason).toBe('not_found')
    }
  })

  it('rejects a path that is not a directory', () => {
    const filePath = join(fixtureRoot, 'arquivo.txt')
    writeFileSync(filePath, 'x')
    try {
      createProject({ path: filePath })
      expect.unreachable()
    } catch (err) {
      expect((err as InstanceType<typeof ProjectError>).details?.reason).toBe('not_directory')
    }
  })

  it('rejects a duplicate path with 409-mapped code', () => {
    mkdtempSyncDir(projectDirA)
    createProject({ path: projectDirA })
    try {
      createProject({ path: projectDirA })
      expect.unreachable()
    } catch (err) {
      expect((err as InstanceType<typeof ProjectError>).code).toBe('project_duplicate')
    }
  })
})

describe('memoryEnabled', () => {
  it('defaults to true (F20 spec §6)', () => {
    mkdtempSyncDir(projectDirA)
    const project = createProject({ path: projectDirA })
    expect(project.memoryEnabled).toBe(true)
  })

  it('setMemoryEnabled toggles without touching other fields', () => {
    mkdtempSyncDir(projectDirA)
    const project = createProject({ path: projectDirA })
    const updated = setMemoryEnabled(project.id, false)
    expect(updated?.memoryEnabled).toBe(false)
    expect(updated?.name).toBe(project.name)
    expect(getProject(project.id)?.memoryEnabled).toBe(false)
  })

  it('setMemoryEnabled returns null for an unknown project', () => {
    expect(setMemoryEnabled('nao-existe', false)).toBeNull()
  })
})

describe('deleteProject', () => {
  it('removes the project row', () => {
    mkdtempSyncDir(projectDirA)
    const project = createProject({ path: projectDirA })
    expect(deleteProject(project.id)).toBe(true)
    expect(getProject(project.id)).toBeNull()
  })
})

describe('listProjects', () => {
  it('lists projects ordered by name', () => {
    mkdtempSyncDir(projectDirA)
    mkdtempSyncDir(projectDirB)
    createProject({ path: projectDirB })
    createProject({ path: projectDirA })
    const names = listProjects().map((p) => p.name)
    expect(names).toEqual(['project-a', 'project-b'])
  })
})

function mkdtempSyncDir(path: string): void {
  mkdirSync(path, { recursive: true })
}
