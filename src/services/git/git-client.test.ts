import { afterAll, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { existsSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

const {
  GitError,
  diffWorkingTree,
  discardFile,
  getRemoteOriginUrl,
  getVcsStatus,
  gitBranchForceDelete,
  gitCommit,
  gitInit,
  gitWorktreeAdd,
  gitWorktreeRemove,
  hasGitHead,
  injectTokenIntoHttpsUrlByKind,
  isGitRepo,
  parseGithubRemote,
} = await import('./git-client.js')

function git(cwd: string, args: string[]): string {
  return execFileSync('git', args, { cwd }).toString()
}

function freshDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_git_client_test_'))
  cleanupDirs.push(dir)
  return dir
}

function makeRepoWithCommit(): string {
  const dir = freshDir()
  writeFileSync(join(dir, 'README.md'), '# fixture\n')
  git(dir, ['init'])
  git(dir, ['add', '-A'])
  git(dir, ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '-m', 'init'])
  return dir
}

const cleanupDirs: string[] = []

afterAll(() => {
  for (const dir of cleanupDirs) rmSync(dir, { recursive: true, force: true })
})

describe('isGitRepo / hasGitHead', () => {
  it('is false for a plain directory with no .git', async () => {
    const dir = freshDir()
    expect(await isGitRepo(dir)).toBe(false)
    expect(await hasGitHead(dir)).toBe(false)
  })

  it('isGitRepo is true and hasGitHead is false right after `git init` with no commits', async () => {
    const dir = freshDir()
    git(dir, ['init'])
    expect(await isGitRepo(dir)).toBe(true)
    expect(await hasGitHead(dir)).toBe(false)
  })

  it('both are true once there is at least one commit', async () => {
    const dir = makeRepoWithCommit()
    expect(await isGitRepo(dir)).toBe(true)
    expect(await hasGitHead(dir)).toBe(true)
  })
})

describe('getVcsStatus', () => {
  it('reports hasGit:false for a non-repo directory', async () => {
    const dir = freshDir()
    expect(await getVcsStatus(dir)).toEqual({
      hasGit: false,
      hasHead: false,
      branch: null,
      detached: false,
      ahead: 0,
      behind: 0,
      dirty: false,
      dirtyFiles: [],
    })
  })

  it('reports hasHead:false for an initialized repo with no commits', async () => {
    const dir = freshDir()
    git(dir, ['init'])
    const status = await getVcsStatus(dir)
    expect(status).toEqual({
      hasGit: true,
      hasHead: false,
      branch: null,
      detached: false,
      ahead: 0,
      behind: 0,
      dirty: false,
      dirtyFiles: [],
    })
  })

  it('reports the current branch and dirty:false for a clean repo', async () => {
    const dir = makeRepoWithCommit()
    const status = await getVcsStatus(dir)
    expect(status.hasGit).toBe(true)
    expect(status.hasHead).toBe(true)
    expect(status.detached).toBe(false)
    expect(status.branch).toBeTruthy()
    expect(status.dirty).toBe(false)
    expect(status.dirtyFiles).toEqual([])
    expect(status.ahead).toBe(0)
    expect(status.behind).toBe(0)
  })

  it('reports dirty:true when there are uncommitted changes', async () => {
    const dir = makeRepoWithCommit()
    writeFileSync(join(dir, 'novo.txt'), 'x\n')
    const status = await getVcsStatus(dir)
    expect(status.dirty).toBe(true)
    expect(status.dirtyFiles).toContain('novo.txt')
  })
})

describe('gitInit', () => {
  it('initializes a repo and creates an empty initial commit when there is no HEAD yet', async () => {
    const dir = freshDir()
    const result = await gitInit(dir)
    expect(result.sha).toMatch(/^[0-9a-f]{40}$/)
    expect(await hasGitHead(dir)).toBe(true)

    const log = git(dir, ['log', '--oneline']).trim()
    expect(log).toContain('initial commit')
  })

  it('is a no-op (keeps HEAD) when the repo already has a commit', async () => {
    const dir = makeRepoWithCommit()
    const before = git(dir, ['rev-parse', 'HEAD']).trim()
    const result = await gitInit(dir)
    expect(result.sha).toBe(before)
  })
})

describe('gitCommit', () => {
  it('stages and commits pending changes, returning the new HEAD sha', async () => {
    const dir = makeRepoWithCommit()
    writeFileSync(join(dir, 'novo.txt'), 'conteúdo\n')

    const result = await gitCommit(dir, 'feat: add novo.txt')

    expect(result.sha).toMatch(/^[0-9a-f]{40}$/)
    const log = git(dir, ['log', '-1', '--pretty=%s']).trim()
    expect(log).toBe('feat: add novo.txt')
    expect((await getVcsStatus(dir)).dirty).toBe(false)
  })

  it('joins subject and body with a blank line when body is provided', async () => {
    const dir = makeRepoWithCommit()
    writeFileSync(join(dir, 'outro.txt'), 'x\n')

    await gitCommit(dir, 'feat: subject', 'corpo explicando o porquê')

    const message = git(dir, ['log', '-1', '--pretty=%B']).trim()
    expect(message).toBe('feat: subject\n\ncorpo explicando o porquê')
  })

  it('throws GitError git_commit_failed when there is nothing to commit', async () => {
    const dir = makeRepoWithCommit()
    await expect(gitCommit(dir, 'feat: nothing changed')).rejects.toMatchObject({
      code: 'git_commit_failed',
    })
    await expect(gitCommit(dir, 'feat: nothing changed')).rejects.toBeInstanceOf(GitError)
  })
})

describe('getRemoteOriginUrl', () => {
  it('returns null when there is no origin remote configured', async () => {
    const dir = makeRepoWithCommit()
    expect(await getRemoteOriginUrl(dir)).toBeNull()
  })

  it('returns the configured origin URL', async () => {
    const dir = makeRepoWithCommit()
    git(dir, ['remote', 'add', 'origin', 'https://github.com/acme/repo.git'])
    expect(await getRemoteOriginUrl(dir)).toBe('https://github.com/acme/repo.git')
  })
})

describe('injectTokenIntoHttpsUrlByKind (F24)', () => {
  it('strips any existing userinfo before injecting the token for github', () => {
    expect(injectTokenIntoHttpsUrlByKind('https://olduser@github.com/acme/repo.git', 'github', 'tok123')).toBe(
      'https://x-access-token:tok123@github.com/acme/repo.git'
    )
  })

  it('push_inject_gitlab_oauth2 — URL contains oauth2:', () => {
    expect(injectTokenIntoHttpsUrlByKind('https://gitlab.com/acme/repo.git', 'gitlab', 'tok123')).toBe(
      'https://oauth2:tok123@gitlab.com/acme/repo.git'
    )
  })

  it('injects x-token-auth for bitbucket', () => {
    expect(injectTokenIntoHttpsUrlByKind('https://bitbucket.org/acme/repo.git', 'bitbucket', 'tok123')).toBe(
      'https://x-token-auth:tok123@bitbucket.org/acme/repo.git'
    )
  })

  it('injects an empty username for azure', () => {
    expect(injectTokenIntoHttpsUrlByKind('https://dev.azure.com/acme/proj/_git/repo', 'azure', 'tok123')).toBe(
      'https://:tok123@dev.azure.com/acme/proj/_git/repo'
    )
  })

  it('matches the original x-access-token scheme for github', () => {
    expect(injectTokenIntoHttpsUrlByKind('https://github.com/acme/repo.git', 'github', 'tok123')).toBe(
      'https://x-access-token:tok123@github.com/acme/repo.git'
    )
  })

  it('returns null for non-https URLs regardless of kind', () => {
    expect(injectTokenIntoHttpsUrlByKind('git@gitlab.com:acme/repo.git', 'gitlab', 'tok')).toBeNull()
  })
})

describe('parseGithubRemote', () => {
  it('parses an https URL with .git suffix', () => {
    expect(parseGithubRemote('https://github.com/acme/repo.git')).toEqual({ owner: 'acme', repo: 'repo' })
  })

  it('parses an https URL without .git suffix', () => {
    expect(parseGithubRemote('https://github.com/acme/repo')).toEqual({ owner: 'acme', repo: 'repo' })
  })

  it('parses an ssh-style URL', () => {
    expect(parseGithubRemote('git@github.com:acme/repo.git')).toEqual({ owner: 'acme', repo: 'repo' })
  })

  it('returns null for a non-GitHub remote', () => {
    expect(parseGithubRemote('https://gitlab.com/acme/repo.git')).toBeNull()
  })
})

describe('gitWorktreeAdd / gitWorktreeRemove / gitBranchForceDelete', () => {
  it('creates a worktree on a new branch and cleans it up', async () => {
    const dir = makeRepoWithCommit()
    const worktreePath = join(dir, '..', `${dir.split(/[\\/]/).pop()}-wt`)

    await gitWorktreeAdd(dir, worktreePath, 'feature/x')
    expect(existsSync(worktreePath)).toBe(true)
    expect(git(worktreePath, ['rev-parse', '--abbrev-ref', 'HEAD']).trim()).toBe('feature/x')

    await gitWorktreeRemove(dir, worktreePath)
    expect(existsSync(worktreePath)).toBe(false)

    await gitBranchForceDelete(dir, 'feature/x')
    expect(git(dir, ['branch', '--list', 'feature/x']).trim()).toBe('')
  })
})

describe('discardFile', () => {
  it('removes an untracked new file from disk', async () => {
    const dir = makeRepoWithCommit()
    const filePath = join(dir, 'novo.txt')
    writeFileSync(filePath, 'x\n')

    await discardFile(dir, 'novo.txt')

    expect(existsSync(filePath)).toBe(false)
  })

  it('restores a tracked file back to its HEAD content', async () => {
    const dir = makeRepoWithCommit()
    const filePath = join(dir, 'README.md')
    writeFileSync(filePath, 'alterado\n')

    await discardFile(dir, 'README.md')

    // `git show` and the checked-out file may differ only by CRLF/LF (core.autocrlf on Windows).
    const content = git(dir, ['show', 'HEAD:README.md']).replace(/\r\n/g, '\n')
    expect(readFileSync(filePath, 'utf-8').replace(/\r\n/g, '\n')).toBe(content)
  })
})

describe('diffWorkingTree', () => {
  it('returns an empty list for a repo with no HEAD yet', async () => {
    const dir = freshDir()
    git(dir, ['init'])
    expect(await diffWorkingTree(dir)).toEqual([])
  })

  it('returns an empty list when the working tree is clean', async () => {
    const dir = makeRepoWithCommit()
    expect(await diffWorkingTree(dir)).toEqual([])
  })

  it('reports additions/deletions and hunks for modified and new files', async () => {
    const dir = makeRepoWithCommit()
    writeFileSync(join(dir, 'README.md'), '# fixture\nlinha nova\n')
    writeFileSync(join(dir, 'novo.txt'), 'conteúdo novo\n')

    const files = await diffWorkingTree(dir)
    const byFile = new Map(files.map((f) => [f.file, f]))

    expect(byFile.get('README.md')?.additions).toBe(1)
    expect(byFile.get('novo.txt')?.additions).toBe(1)
    expect(byFile.get('novo.txt')?.hunks.length).toBeGreaterThan(0)
  })
})
