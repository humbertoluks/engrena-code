import { execFile } from 'child_process'
import { promisify } from 'util'
import axios from 'axios'

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

export function injectTokenIntoHttpsUrl(remoteUrl: string, token: string): string | null {
  if (!remoteUrl.startsWith('https://')) return null
  const withoutScheme = remoteUrl.slice('https://'.length)
  const hostAndPath = withoutScheme.includes('@') ? withoutScheme.split('@').slice(1).join('@') : withoutScheme
  return `https://x-access-token:${token}@${hostAndPath}`
}

/** Push via URL autenticada com o PAT (quando presente) em vez de depender do credential helper do SO. */
export async function gitPush(cwd: string, token?: string | null): Promise<{ branch: string }> {
  const { stdout: branchOut } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchOut.trim()

  const remoteUrl = token ? await getRemoteOriginUrl(cwd) : null
  const authedUrl = remoteUrl && token ? injectTokenIntoHttpsUrl(remoteUrl, token) : null

  try {
    if (authedUrl) {
      await git(cwd, ['push', '-u', authedUrl, `HEAD:refs/heads/${branch}`])
    } else {
      await git(cwd, ['push', '-u', 'origin', branch])
    }
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

/** Restaura (reject) um arquivo pending: reverte para HEAD se rastreado, remove do disco se era novo. */
export async function discardFile(cwd: string, file: string): Promise<void> {
  try {
    await git(cwd, ['reset', '--', file])
  } catch {
    // arquivo pode não estar no index — segue
  }

  let existsInHead = true
  try {
    await git(cwd, ['cat-file', '-e', `HEAD:${file}`])
  } catch {
    existsInHead = false
  }

  try {
    if (existsInHead) {
      await git(cwd, ['checkout', 'HEAD', '--', file])
    } else {
      await git(cwd, ['clean', '-f', '--', file])
    }
  } catch (err) {
    throw new GitError('diff_apply_failed', `Não foi possível restaurar "${file}".`)
  }
}

export interface CreatePullRequestInput {
  branch?: string
  base?: string
  title: string
  body?: string
}

export interface PullRequestResult {
  url: string
  number: number
  existing: boolean
}

function githubAuthHeaders(token: string): Record<string, string> {
  return { Authorization: `token ${token}`, Accept: 'application/vnd.github+json' }
}

export async function createPullRequest(cwd: string, token: string, input: CreatePullRequestInput): Promise<PullRequestResult> {
  const remoteUrl = await getRemoteOriginUrl(cwd)
  if (!remoteUrl) throw new GitError('pr_no_remote', 'Repositório sem remote origin configurado.')

  const parsed = parseGithubRemote(remoteUrl)
  if (!parsed) throw new GitError('pr_not_github', 'Remote origin não aponta para o GitHub.')

  const head = input.branch ?? (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()

  let base = input.base
  if (!base) {
    try {
      const repoInfo = await axios.get<{ default_branch: string }>(
        `https://api.github.com/repos/${parsed.owner}/${parsed.repo}`,
        { headers: githubAuthHeaders(token) }
      )
      base = repoInfo.data.default_branch
    } catch {
      throw new GitError('pr_create_failed', 'Falha ao abrir o PR.')
    }
  }

  try {
    const res = await axios.post<{ html_url: string; number: number }>(
      `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls`,
      { title: input.title, head, base, body: input.body },
      { headers: githubAuthHeaders(token) }
    )
    return { url: res.data.html_url, number: res.data.number, existing: false }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 422) {
      try {
        const list = await axios.get<Array<{ html_url: string; number: number }>>(
          `https://api.github.com/repos/${parsed.owner}/${parsed.repo}/pulls`,
          { headers: githubAuthHeaders(token), params: { head: `${parsed.owner}:${head}`, state: 'open' } }
        )
        if (Array.isArray(list.data) && list.data.length > 0) {
          return { url: list.data[0].html_url, number: list.data[0].number, existing: true }
        }
      } catch {
        // segue para o erro genérico abaixo
      }
    }
    throw new GitError('pr_create_failed', 'Falha ao abrir o PR.')
  }
}

export interface DiffHunk {
  header: string
  lines: string[]
}

export interface WorkingTreeDiffFile {
  file: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
}

function parseHunks(unifiedDiff: string): DiffHunk[] {
  const lines = unifiedDiff.split('\n')
  const hunks: DiffHunk[] = []
  let current: DiffHunk | null = null

  for (const line of lines) {
    if (line.startsWith('@@')) {
      if (current) hunks.push(current)
      current = { header: line, lines: [] }
    } else if (current) {
      current.lines.push(line)
    }
  }
  if (current) hunks.push(current)
  return hunks
}

/** Diff da working tree (dirty files) vs HEAD — inclui não-rastreados via intent-to-add. Usado para popular a tabela `diffs` pós-turno. */
export async function diffWorkingTree(cwd: string): Promise<WorkingTreeDiffFile[]> {
  const hasHead = await hasGitHead(cwd)
  if (!hasHead) return []

  try {
    await git(cwd, ['add', '-A', '-N', '.'])
  } catch {
    // sem alterações para marcar intent-to-add
  }

  const { stdout: numstatOut } = await git(cwd, ['diff', 'HEAD', '--numstat'])
  const results: WorkingTreeDiffFile[] = []

  for (const line of numstatOut.split('\n')) {
    const trimmed = line.trim()
    if (trimmed === '') continue
    const [addRaw, delRaw, ...fileParts] = trimmed.split('\t')
    const file = fileParts.join('\t')
    if (!file) continue

    const additions = Number.isNaN(Number(addRaw)) ? 0 : Number(addRaw)
    const deletions = Number.isNaN(Number(delRaw)) ? 0 : Number(delRaw)

    const { stdout: diffOut } = await git(cwd, ['diff', 'HEAD', '--', file])
    results.push({ file, additions, deletions, hunks: parseHunks(diffOut) })
  }

  return results
}
