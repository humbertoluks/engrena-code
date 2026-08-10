import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { existsSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f13_worktree_'))

const { createWorktree, removeWorktreeIfSafe, resolveWorktreePath, worktreeBranchName, WorktreeError } = await import(
  './worktree.js'
)
const { hasGitHead } = await import('./git-client.js')

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString()
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f13_worktree_fixture_'))
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(dir, ['init'])
  git(dir, ['add', '-A'])
  git(dir, ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-m', 'init'])
  return dir
}

const cleanupDirs: string[] = []

beforeEach(() => {
  cleanupDirs.length = 0
})

afterAll(() => {
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('createWorktree', () => {
  it('creates the worktree under userData/worktrees/<projectId>/<threadId> on a stable branch', async () => {
    const dir = makeProjectDir()
    cleanupDirs.push(dir)

    const path = await createWorktree(dir, 'prj_1', 'thr_1')

    expect(path).toBe(resolveWorktreePath('prj_1', 'thr_1'))
    expect(existsSync(path)).toBe(true)
    expect(await hasGitHead(path)).toBe(true)

    const branchOut = git(path, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()
    expect(branchOut).toBe(worktreeBranchName('thr_1'))

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects with worktree_git_required when the project has no .git', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f13_worktree_nogit_'))
    cleanupDirs.push(dir)

    await expect(createWorktree(dir, 'prj_2', 'thr_2')).rejects.toMatchObject({
      code: 'worktree_git_required',
      message: 'Inicialize o Git antes de usar Worktree.',
    })

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects with worktree_git_required when the repo has no HEAD (no commits)', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f13_worktree_nohead_'))
    cleanupDirs.push(dir)
    git(dir, ['init'])

    await expect(createWorktree(dir, 'prj_3', 'thr_3')).rejects.toMatchObject({ code: 'worktree_git_required' })

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects with worktree_create_failed when the target path is already occupied', async () => {
    const dir = makeProjectDir()
    cleanupDirs.push(dir)

    const path = await createWorktree(dir, 'prj_4', 'thr_4')
    expect(existsSync(path)).toBe(true)

    await expect(createWorktree(dir, 'prj_4', 'thr_4')).rejects.toBeInstanceOf(WorktreeError)
    await expect(createWorktree(dir, 'prj_4', 'thr_4')).rejects.toMatchObject({ code: 'worktree_create_failed' })

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('removeWorktreeIfSafe', () => {
  it('returns none when there is no worktreePath', async () => {
    const outcome = await removeWorktreeIfSafe('/nao-importa', null, 'thr_x')
    expect(outcome).toEqual({ result: 'none', warning: null })
  })

  it('removes the worktree and branch when the working tree is clean', async () => {
    const dir = makeProjectDir()
    cleanupDirs.push(dir)
    const path = await createWorktree(dir, 'prj_5', 'thr_5')

    const outcome = await removeWorktreeIfSafe(dir, path, 'thr_5')

    expect(outcome).toEqual({ result: 'removed', warning: null })
    expect(existsSync(path)).toBe(false)
    const branches = git(dir, ['branch', '--list', worktreeBranchName('thr_5')]).trim()
    expect(branches).toBe('')

    rmSync(dir, { recursive: true, force: true })
  })

  it('retains the worktree and warns when the working tree has local changes', async () => {
    const dir = makeProjectDir()
    cleanupDirs.push(dir)
    const path = await createWorktree(dir, 'prj_6', 'thr_6')
    writeFileSync(join(path, 'novo.txt'), 'x\n')

    const outcome = await removeWorktreeIfSafe(dir, path, 'thr_6')

    expect(outcome).toEqual({
      result: 'retained',
      warning: 'Worktree retido com alterações locais; remova manualmente quando seguro.',
    })
    expect(existsSync(path)).toBe(true)

    rmSync(dir, { recursive: true, force: true })
    rmSync(path, { recursive: true, force: true })
  })
})
