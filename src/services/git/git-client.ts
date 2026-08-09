import { execFile } from 'child_process'
import { promisify } from 'util'
import axios from 'axios'
import { stderrTail } from '../process-error.js'
import { parseVcsRemote, type VcsKind } from '../vcs/remote.js'

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

function injectTokenIntoHttpsUrl(remoteUrl: string, token: string): string | null {
  if (!remoteUrl.startsWith('https://')) return null
  const withoutScheme = remoteUrl.slice('https://'.length)
  const hostAndPath = withoutScheme.includes('@') ? withoutScheme.split('@').slice(1).join('@') : withoutScheme
  return `https://x-access-token:${token}@${hostAndPath}`
}

/** Injeção de token por host (spec F24 §3.2) — cada VCS exige um esquema de credencial distinto na URL HTTPS. */
export function injectTokenIntoHttpsUrlByKind(remoteUrl: string, kind: VcsKind, token: string): string | null {
  if (!remoteUrl.startsWith('https://')) return null
  const withoutScheme = remoteUrl.slice('https://'.length)
  const hostAndPath = withoutScheme.includes('@') ? withoutScheme.split('@').slice(1).join('@') : withoutScheme

  switch (kind) {
    case 'github':
      return injectTokenIntoHttpsUrl(remoteUrl, token)
    case 'gitlab':
      return `https://oauth2:${token}@${hostAndPath}`
    case 'bitbucket':
      return `https://x-token-auth:${token}@${hostAndPath}`
    case 'azure':
      return `https://:${token}@${hostAndPath}`
  }
}

/** Push via URL autenticada com o token (quando presente) em vez de depender do credential helper do SO. `kind` decide o esquema de injeção (spec F24 §3.2); default `github` preserva o comportamento F14. */
export async function gitPush(cwd: string, token?: string | null, kind: VcsKind = 'github'): Promise<{ branch: string }> {
  const { stdout: branchOut } = await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])
  const branch = branchOut.trim()

  const remoteUrl = token ? await getRemoteOriginUrl(cwd) : null
  const authedUrl = remoteUrl && token ? injectTokenIntoHttpsUrlByKind(remoteUrl, kind, token) : null

  try {
    if (authedUrl) {
      await git(cwd, ['push', '-u', authedUrl, `HEAD:refs/heads/${branch}`])
    } else {
      await git(cwd, ['push', '-u', 'origin', branch])
    }
  } catch (err) {
    throw new GitError('git_push_failed', `Não foi possível fazer push das alterações: ${stderrTail(err)}`)
  }
  return { branch }
}

/** `git worktree add -b <branch> <path> HEAD` — cria a árvore isolada a partir do HEAD do repo principal. */
export async function gitWorktreeAdd(repoPath: string, worktreePath: string, branch: string): Promise<void> {
  await git(repoPath, ['worktree', 'add', '-b', branch, worktreePath, 'HEAD'])
}

/** Remove a worktree do disco e da lista administrativa do git. Falha (ex.: alterações locais) propaga para o chamador decidir retenção. */
export async function gitWorktreeRemove(repoPath: string, worktreePath: string): Promise<void> {
  await git(repoPath, ['worktree', 'remove', worktreePath])
}

/** Delete forçado (`-D`) — a branch de worktree é descartável por design (spec F13), não passa por merge. */
export async function gitBranchForceDelete(repoPath: string, branch: string): Promise<void> {
  await git(repoPath, ['branch', '-D', branch])
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

/** Resumo acionável de um erro da REST API do GitHub — usa `message` do payload de erro quando presente. */
function githubErrorSummary(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string } | undefined
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
  }
  return err instanceof Error ? err.message : String(err)
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
    } catch (err) {
      throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${githubErrorSummary(err)}`)
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
    throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${githubErrorSummary(err)}`)
  }
}

// ── Multi-VCS change request (F24) ──────────────────────────────────────────

export type CreateChangeRequestInput = CreatePullRequestInput
export type ChangeRequestResult = PullRequestResult

function bearerHeaders(token: string): Record<string, string> {
  return { Authorization: `Bearer ${token}` }
}

/** Resumo acionável de um erro REST — checa os formatos de payload de erro do GitLab/Bitbucket/Azure em ordem. */
function restErrorSummary(err: unknown): string {
  if (axios.isAxiosError(err)) {
    const data = err.response?.data as { message?: string; error?: { message?: string } } | undefined
    if (typeof data?.message === 'string' && data.message.trim()) return data.message.trim()
    if (typeof data?.error?.message === 'string' && data.error.message.trim()) return data.error.message.trim()
  }
  return err instanceof Error ? err.message : String(err)
}

/** Erro de autenticação distinto (401) para o gate `vcs_token_expired` do handler (spec §5.4) — só nos 3 providers OAuth novos. */
function throwIfExpiredToken(err: unknown): void {
  if (axios.isAxiosError(err) && err.response?.status === 401) {
    throw new GitError('vcs_token_expired', 'Sessão VCS expirada. Reconecte em Configuração.')
  }
}

async function createGitlabMergeRequest(cwd: string, token: string, input: CreateChangeRequestInput): Promise<ChangeRequestResult> {
  const remoteUrl = await getRemoteOriginUrl(cwd)
  if (!remoteUrl) throw new GitError('pr_no_remote', 'Repositório sem remote origin configurado.')
  const parsed = parseVcsRemote(remoteUrl)
  if (!parsed || parsed.kind !== 'gitlab') throw new GitError('vcs_unsupported_remote', 'Remote origin não aponta para o GitLab.')

  const projectId = encodeURIComponent(`${parsed.owner}/${parsed.repo}`)
  const head = input.branch ?? (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()

  let base = input.base
  if (!base) {
    try {
      const info = await axios.get<{ default_branch: string }>(`https://gitlab.com/api/v4/projects/${projectId}`, {
        headers: bearerHeaders(token),
      })
      base = info.data.default_branch
    } catch (err) {
      throwIfExpiredToken(err)
      throw new GitError('pr_create_failed', `Falha ao abrir a MR: ${restErrorSummary(err)}`)
    }
  }

  try {
    const res = await axios.post<{ web_url: string; iid: number }>(
      `https://gitlab.com/api/v4/projects/${projectId}/merge_requests`,
      { source_branch: head, target_branch: base, title: input.title, description: input.body },
      { headers: bearerHeaders(token) }
    )
    return { url: res.data.web_url, number: res.data.iid, existing: false }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      try {
        const list = await axios.get<Array<{ web_url: string; iid: number }>>(
          `https://gitlab.com/api/v4/projects/${projectId}/merge_requests`,
          { headers: bearerHeaders(token), params: { source_branch: head, state: 'opened' } }
        )
        if (Array.isArray(list.data) && list.data.length > 0) {
          return { url: list.data[0].web_url, number: list.data[0].iid, existing: true }
        }
      } catch {
        // segue para o erro genérico abaixo
      }
    }
    throwIfExpiredToken(err)
    throw new GitError('pr_create_failed', `Falha ao abrir a MR: ${restErrorSummary(err)}`)
  }
}

async function createBitbucketPullRequest(cwd: string, token: string, input: CreateChangeRequestInput): Promise<ChangeRequestResult> {
  const remoteUrl = await getRemoteOriginUrl(cwd)
  if (!remoteUrl) throw new GitError('pr_no_remote', 'Repositório sem remote origin configurado.')
  const parsed = parseVcsRemote(remoteUrl)
  if (!parsed || parsed.kind !== 'bitbucket') throw new GitError('vcs_unsupported_remote', 'Remote origin não aponta para o Bitbucket.')

  const { owner, repo } = parsed
  const base_url = `https://api.bitbucket.org/2.0/repositories/${owner}/${repo}`
  const head = input.branch ?? (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()

  let base = input.base
  if (!base) {
    try {
      const info = await axios.get<{ mainbranch: { name: string } }>(base_url, { headers: bearerHeaders(token) })
      base = info.data.mainbranch.name
    } catch (err) {
      throwIfExpiredToken(err)
      throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${restErrorSummary(err)}`)
    }
  }

  try {
    const res = await axios.post<{ links: { html: { href: string } }; id: number }>(
      `${base_url}/pullrequests`,
      { title: input.title, description: input.body, source: { branch: { name: head } }, destination: { branch: { name: base } } },
      { headers: bearerHeaders(token) }
    )
    return { url: res.data.links.html.href, number: res.data.id, existing: false }
  } catch (err) {
    try {
      const list = await axios.get<{ values: Array<{ links: { html: { href: string } }; id: number }> }>(`${base_url}/pullrequests`, {
        headers: bearerHeaders(token),
        params: { q: `source.branch.name="${head}" AND state="OPEN"` },
      })
      if (list.data.values.length > 0) {
        const existing = list.data.values[0]
        return { url: existing.links.html.href, number: existing.id, existing: true }
      }
    } catch {
      // segue para o erro genérico abaixo
    }
    throwIfExpiredToken(err)
    throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${restErrorSummary(err)}`)
  }
}

const AZURE_API_VERSION = '7.1'

async function createAzurePullRequest(cwd: string, token: string, input: CreateChangeRequestInput): Promise<ChangeRequestResult> {
  const remoteUrl = await getRemoteOriginUrl(cwd)
  if (!remoteUrl) throw new GitError('pr_no_remote', 'Repositório sem remote origin configurado.')
  const parsed = parseVcsRemote(remoteUrl)
  if (!parsed || parsed.kind !== 'azure' || !parsed.org) throw new GitError('vcs_unsupported_remote', 'Remote origin não aponta para o Azure DevOps.')

  const { org, owner: project, repo } = parsed
  const baseUrl = `https://dev.azure.com/${encodeURIComponent(org)}/${encodeURIComponent(project)}/_apis/git/repositories/${encodeURIComponent(repo)}`
  const head = input.branch ?? (await git(cwd, ['rev-parse', '--abbrev-ref', 'HEAD'])).stdout.trim()

  let base = input.base
  if (!base) {
    try {
      const info = await axios.get<{ defaultBranch: string }>(`${baseUrl}?api-version=${AZURE_API_VERSION}`, { headers: bearerHeaders(token) })
      base = info.data.defaultBranch.replace(/^refs\/heads\//, '')
    } catch (err) {
      throwIfExpiredToken(err)
      throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${restErrorSummary(err)}`)
    }
  }

  try {
    const res = await axios.post<{ pullRequestId: number; repository: { webUrl: string } }>(
      `${baseUrl}/pullrequests?api-version=${AZURE_API_VERSION}`,
      { sourceRefName: `refs/heads/${head}`, targetRefName: `refs/heads/${base}`, title: input.title, description: input.body },
      { headers: bearerHeaders(token) }
    )
    const url = `${res.data.repository.webUrl}/pullrequest/${res.data.pullRequestId}`
    return { url, number: res.data.pullRequestId, existing: false }
  } catch (err) {
    if (axios.isAxiosError(err) && err.response?.status === 409) {
      try {
        const list = await axios.get<Array<{ pullRequestId: number; repository: { webUrl: string } }>>(
          `${baseUrl}/pullrequests?api-version=${AZURE_API_VERSION}`,
          { headers: bearerHeaders(token), params: { 'searchCriteria.sourceRefName': `refs/heads/${head}`, 'searchCriteria.status': 'active' } }
        )
        if (Array.isArray(list.data) && list.data.length > 0) {
          const existing = list.data[0]
          return { url: `${existing.repository.webUrl}/pullrequest/${existing.pullRequestId}`, number: existing.pullRequestId, existing: true }
        }
      } catch {
        // segue para o erro genérico abaixo
      }
    }
    throwIfExpiredToken(err)
    throw new GitError('pr_create_failed', `Falha ao abrir o PR: ${restErrorSummary(err)}`)
  }
}

/** Despacha por `kind` (spec §3.2) — GitHub reusa `createPullRequest` (F14) intacto; os 3 novos falam REST próprio. */
export async function createChangeRequest(
  cwd: string,
  token: string,
  kind: VcsKind,
  input: CreateChangeRequestInput
): Promise<ChangeRequestResult> {
  switch (kind) {
    case 'github':
      return createPullRequest(cwd, token, input)
    case 'gitlab':
      return createGitlabMergeRequest(cwd, token, input)
    case 'bitbucket':
      return createBitbucketPullRequest(cwd, token, input)
    case 'azure':
      return createAzurePullRequest(cwd, token, input)
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
