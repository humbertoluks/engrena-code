import { describe, expect, it } from 'vitest'
import { resolveThreadCwd } from './thread-cwd.js'
import type { Thread } from '../db/repositories/threads.js'
import type { Project } from '../db/repositories/projects.js'

function makeProject(overrides: Partial<Project> = {}): Project {
  return {
    id: 'proj_1',
    path: '/repo/project',
    name: 'project',
    memoryEnabled: false,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

function makeThread(overrides: Partial<Thread> = {}): Thread {
  return {
    id: 'thr_1',
    projectId: 'proj_1',
    provider: 'claude',
    model: null,
    reasoningLevel: null,
    accessLevel: 'supervised',
    executionMode: 'main',
    worktreePath: null,
    state: 'idle',
    title: null,
    systemPrompt: null,
    createdAt: 0,
    updatedAt: 0,
    ...overrides,
  }
}

describe('resolveThreadCwd', () => {
  it('returns worktreePath when executionMode is worktree and worktreePath is set', () => {
    const project = makeProject()
    const thread = makeThread({ executionMode: 'worktree', worktreePath: '/repo/worktrees/thr_1' })
    expect(resolveThreadCwd(thread, project)).toBe('/repo/worktrees/thr_1')
  })

  it('returns project.path for executionMode main, ignoring any worktreePath', () => {
    const project = makeProject()
    const thread = makeThread({ executionMode: 'main', worktreePath: '/repo/worktrees/thr_1' })
    expect(resolveThreadCwd(thread, project)).toBe(project.path)
  })

  it('returns project.path when executionMode is worktree but worktreePath has not been created yet', () => {
    const project = makeProject()
    const thread = makeThread({ executionMode: 'worktree', worktreePath: null })
    expect(resolveThreadCwd(thread, project)).toBe(project.path)
  })
})
