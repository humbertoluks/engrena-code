import type { SubagentRun } from '../../services/db/repositories/subagents.js'

const BASE_URL = 'http://127.0.0.1:5174'

function sessionToken(): string {
  return localStorage.getItem('sessionToken') ?? ''
}

function headers(): HeadersInit {
  return {
    'Content-Type': 'application/json',
    'x-engrenacode-session': sessionToken(),
  }
}

async function request<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    method,
    headers: headers(),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })
  return res.json() as Promise<T>
}

// ── Types ────────────────────────────────────────────────────────────────────

export type ThreadProvider = 'claude' | 'codex' | 'kimi' | 'minimax'
export type ThreadAccessLevel = 'supervised' | 'auto-accept-edits' | 'full-access'
export type ThreadExecutionMode = 'main' | 'worktree'
export type ThreadState = 'running' | 'idle' | 'committed' | 'error' | 'stopping'

export interface Thread {
  id: string
  projectId: string
  provider: ThreadProvider
  model: string | null
  reasoningLevel: string | null
  accessLevel: ThreadAccessLevel
  executionMode: ThreadExecutionMode
  worktreePath: string | null
  state: ThreadState
  title: string | null
  systemPrompt: string | null
  createdAt: number
  updatedAt: number
}

export interface ComposerImagePayload {
  mimeType: 'image/png' | 'image/jpeg' | 'image/webp' | 'image/gif'
  name?: string
  dataBase64: string
}

export interface ComposerCatalogProviderEntry {
  models: string[]
  defaultModel: string
  reasoningLevels: string[]
  defaultReasoningLevel: string | null
  multimodal: boolean
}

export interface ComposerCatalog {
  providers: Record<ThreadProvider, ComposerCatalogProviderEntry>
}

export interface Message {
  id: string
  threadId: string
  role: 'user' | 'assistant' | 'system'
  content: string | null
  blocks: unknown[] | null
  seq: number
  createdAt: number
}

export type ToolCallStatus = 'running' | 'completed' | 'error' | 'cancelled' | 'interrupted'

export interface ToolCall {
  id: string
  threadId: string
  messageId: string | null
  name: string
  params: unknown
  status: ToolCallStatus
  result: unknown
  seq: number
  startedAt: number
  endedAt: number | null
}

export type DiffStatus = 'pending' | 'accepted' | 'rejected'

export interface DiffHunk {
  header: string
  lines: string[]
}

export interface Diff {
  id: string
  threadId: string
  file: string
  additions: number
  deletions: number
  hunks: DiffHunk[]
  provider: string
  status: DiffStatus
  worktreePath: string | null
  createdAt: number
}

export interface ApiErrorBody {
  error?: { code: string; message: string; details?: Record<string, unknown> }
}

export interface DispatchResponse {
  thread: Thread
  stream: { ws: string }
}

// ── API ──────────────────────────────────────────────────────────────────────

export const threadsService = {
  listForProject: (projectId: string): Promise<{ threads: Thread[] } & ApiErrorBody> =>
    request('GET', `/api/projects/${projectId}/threads`),

  create: (
    projectId: string,
    input: {
      prompt: string
      provider: ThreadProvider
      model?: string | null
      reasoningLevel?: string | null
      accessLevel: ThreadAccessLevel
      executionMode: ThreadExecutionMode
      images?: ComposerImagePayload[]
    }
  ): Promise<DispatchResponse & ApiErrorBody> => request('POST', `/api/projects/${projectId}/threads`, input),

  followUp: (
    threadId: string,
    input: {
      prompt: string
      model?: string | null
      reasoningLevel?: string | null
      accessLevel?: ThreadAccessLevel
      images?: ComposerImagePayload[]
    }
  ): Promise<DispatchResponse & ApiErrorBody> => request('POST', `/api/threads/${threadId}/messages`, input),

  composerCatalog: (): Promise<ComposerCatalog & ApiErrorBody> => request('GET', '/api/composer/catalog'),

  history: (
    threadId: string
  ): Promise<{ messages: Message[]; toolCalls: ToolCall[]; subagentRuns: SubagentRun[] } & ApiErrorBody> =>
    request('GET', `/api/threads/${threadId}/history`),

  diffs: (threadId: string): Promise<{ diffs: Diff[] } & ApiErrorBody> =>
    request('GET', `/api/threads/${threadId}/diffs`),

  cancel: (threadId: string): Promise<{ cancelled: boolean } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/cancel`),

  permission: (
    threadId: string,
    input: { requestId: string; allow: boolean }
  ): Promise<{ resolved: boolean } & ApiErrorBody> => request('POST', `/api/threads/${threadId}/permission`, input),

  accept: (
    threadId: string,
    input: { action?: 'accept' | 'reject'; ids?: string[]; paths?: string[] }
  ): Promise<{ applied: boolean; acceptedIds?: string[]; rejectedIds?: string[] } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/accept`, input),

  gitCommit: (threadId: string, input: { subject: string; body?: string }): Promise<{ sha: string } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/git-commit`, input),

  gitPush: (threadId: string): Promise<{ branch: string } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/git-push`),

  pr: (
    threadId: string,
    input?: { title?: string; body?: string; branch?: string; allowHostOverride?: boolean }
  ): Promise<{ url: string; number: number; existing: boolean } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/pr`, input ?? {}),

  gitTextgen: (
    threadId: string,
    input: { mode: 'commit' | 'pr' }
  ): Promise<{ subject: string; body?: string; title?: string } & ApiErrorBody> =>
    request('POST', `/api/threads/${threadId}/git-textgen`, input),
}
