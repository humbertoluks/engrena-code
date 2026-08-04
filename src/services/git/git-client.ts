import { execFile } from 'child_process'
import { promisify } from 'util'

const execFileAsync = promisify(execFile)

export class GitError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}

const AUTHOR_CONFIG = ['-c', 'user.name=EngrenaCode', '-c', 'user.email=engrenacode@local']

async function git(cwd: string, args: string[]): Promise<{ stdout: string; stderr: string }> {
  return execFileAsync('git', args, { cwd, timeout: 15000 })
}

export async function isGitRepo(cwd: string): Promise<boolean> {
  try {
    await git(cwd, ['rev-parse', '--is-inside-work-tree'])
    return true
  } catch {
    return false
  }
}

export async function hasGitHead(cwd: string): Promise<boolean> {
  try {
    await git(cwd, ['rev-parse', '--verify', 'HEAD'])
    return true
  } catch {
    return false
  }
}

export interface VcsStatus {
  hasGit: boolean
  hasHead: boolean
  branch: string | null
  detached: boolean
  ahead: number
  behind: number
  dirty: boolean
}

export async function getVcsStatus(cwd: string): Promise<VcsStatus> {
  const hasGit = await isGitRepo(cwd)
  if (!hasGit) {
    return { hasGit: false, hasHead: false, branch: null, detached: false, ahead: 0, behind: 0, dirty: false }
  }

  const hasHead = await hasGitHead(cwd)
  if (!hasHead) {
    return { hasGit: true, hasHead: false, branch: null, detached: false, ahead: 0, behind: 0, dirty: false }
  }

  const { stdout: branchOut } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchOut.trim()
  const detached = branch === 'HEAD'

  const { stdout: statusOut } = await git(cwd, ['status', '--porcelain'])
  const dirty = statusOut.trim().length > 0

  let ahead = 0
  let behind = 0
  try {
    const { stdout } = await git(cwd, ['rev-list', '--left-right', '--count', 'HEAD...@{upstream}'])
    const [a, b] = stdout.trim().split(/\s+/).map(Number)
    ahead = a ?? 0
    behind = b ?? 0
  } catch {
    // sem upstream configurado — mantém 0/0
  }

  return { hasGit: true, hasHead: true, branch: detached ? null : branch, detached, ahead, behind, dirty }
}

/** `git init` + commit inicial vazio caso o repo ainda não tenha HEAD (add project soft não exige `.git`). */
export async function gitInit(cwd: string): Promise<{ branch: string; sha: string }> {
  if (!(await isGitRepo(cwd))) {
    await git(cwd, ['init'])
  }

  if (!(await hasGitHead(cwd))) {
    try {
      await git(cwd, [...AUTHOR_CONFIG, 'commit', '--allow-empty', '-m', 'chore: initial commit (EngrenaCode)'])
    } catch (err) {
      throw new GitError('git_init_failed', 'Não foi possível inicializar o Git.')
    }
  }

  const { stdout: branchOut } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const { stdout: shaOut } = await git(cwd, ['rev-parse', 'HEAD'])
  return { branch: branchOut.trim(), sha: shaOut.trim() }
}

export async function gitCommit(cwd: string, subject: string, body?: string): Promise<{ sha: string }> {
  await git(cwd, ['add', '-A'])
  const message = body ? `${subject}\n\n${body}` : subject
  try {
    await git(cwd, [...AUTHOR_CONFIG, 'commit', '-m', message])
  } catch (err) {
    throw new GitError('git_commit_failed', 'Não foi possível commitar as alterações.')
  }
  const { stdout } = await git(cwd, ['rev-parse', 'HEAD'])
  return { sha: stdout.trim() }
}

export async function gitPush(cwd: string): Promise<{ branch: string }> {
  const { stdout: branchOut } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchOut.trim()
  try {
    await git(cwd, ['push', '-u', 'origin', branch])
  } catch (err) {
    throw new GitError('git_push_failed', 'Não foi possível fazer push das alterações.')
  }
  return { branch }
}

export async function getRemoteOriginUrl(cwd: string): Promise<string | null> {
  try {
    const { stdout } = await git(cwd, ['remote', 'get-url', 'origin'])
    return stdout.trim() || null
  } catch {
    return null
  }
}

export function parseGithubRemote(url: string): { owner: string; repo: string } | null {
  const httpsMatch = /github\.com[/:]([^/]+)\/([^/.]+?)(\.git)?$/.exec(url)
  if (!httpsMatch) return null
  return { owner: httpsMatch[1], repo: httpsMatch[2] }
}
