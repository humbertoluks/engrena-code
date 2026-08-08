import { apiRequest, type ApiErrorBody } from './api-client'
import type { SubagentRun } from './subagents-service'

export type { ApiErrorBody }

// ── Types ────────────────────────────────────────────────────────────────────

export type ThreadProvider = 'claude' | 'codex' | 'kimi' | 'minimax' | 'glm' | 'grok'
export type ThreadAccessLevel = 'supervised' | 'auto-accept-edits' | 'full-access'
export type ThreadExecutionMode = 'main' | 'worktree'
export type ThreadState = 'running' | 'idle' | 'committed' | 'error' | 'stopping' | 'waiting_user' | 'cancelled'

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

export type DiffStatus = 'pending' | 'accepted' | 'rejected' | 'conflict'

export interface DiffHunk {
  header: string
  lines: string[]
}

/** Candidato de conflito de merge paralelo (F18) — um por filho que tocou o mesmo path. */
export interface DiffConflictCandidate {
  childThreadId: string
  subagentName: string
  hunks: DiffHunk[]
  additions: number
  deletions: number
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
  /** Preenchido só quando `status === 'conflict'` (F18). */
  conflictCandidates: DiffConflictCandidate[] | null
  createdAt: number
}

export interface DispatchResponse {
  thread: Thread
  stream: { ws: string }
}

export type PipelineCommand = 'spec' | 'featdevelop' | 'featbuild'
export type PipelineStatus = 'running' | 'waiting_checkpoint' | 'completed' | 'failed' | 'timeout' | 'cancelled'
export type PipelineStageStatus = 'pending' | 'running' | 'completed' | 'failed' | 'timeout' | 'skipped'

export interface Pipeline {
  id: string
  threadId: string
  projectId: string
  command: PipelineCommand
  status: PipelineStatus
  argsText: string
  startedAt: number
  finishedAt: number | null
  errorCode: string | null
  errorMessage: string | null
}

export interface PipelineStage {
  id: string
  pipelineId: string
  stageId: string
  stageIndex: number
  subagentName: string
  status: PipelineStageStatus
  subagentRunId: string | null
  startedAt: number | null
  finishedAt: number | null
}

export interface PipelineHistory {
  pipeline: Pipeline
  stages: PipelineStage[]
}

// ── API ──────────────────────────────────────────────────────────────────────

export const threadsService = {
  listForProject: (projectId: string): Promise<{ threads: Thread[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/projects/${projectId}/threads`),

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
  ): Promise<DispatchResponse & ApiErrorBody> => apiRequest('POST', `/api/projects/${projectId}/threads`, input),

  followUp: (
    threadId: string,
    input: {
      prompt: string
      model?: string | null
      reasoningLevel?: string | null
      accessLevel?: ThreadAccessLevel
      images?: ComposerImagePayload[]
    }
  ): Promise<DispatchResponse & ApiErrorBody> => apiRequest('POST', `/api/threads/${threadId}/messages`, input),

  composerCatalog: (): Promise<ComposerCatalog & ApiErrorBody> => apiRequest('GET', '/api/composer/catalog'),

  history: (
    threadId: string
  ): Promise<
    { messages: Message[]; toolCalls: ToolCall[]; subagentRuns: SubagentRun[]; pipeline: PipelineHistory | null } & ApiErrorBody
  > => apiRequest('GET', `/api/threads/${threadId}/history`),

  diffs: (threadId: string): Promise<{ diffs: Diff[] } & ApiErrorBody> =>
    apiRequest('GET', `/api/threads/${threadId}/diffs`),

  cancel: (threadId: string): Promise<{ cancelled: boolean } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/cancel`),

  permission: (
    threadId: string,
    input: { requestId: string; allow: boolean }
  ): Promise<{ resolved: boolean } & ApiErrorBody> => apiRequest('POST', `/api/threads/${threadId}/permission`, input),

  answerQuestion: (
    threadId: string,
    input: { selectedOptions?: string[]; freeText?: string | null }
  ): Promise<{ answered: boolean } & ApiErrorBody> => apiRequest('POST', `/api/threads/${threadId}/answer`, input),

  accept: (
    threadId: string,
    input: { action?: 'accept' | 'reject'; ids?: string[]; paths?: string[] }
  ): Promise<{ applied: boolean; acceptedIds?: string[]; rejectedIds?: string[] } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/accept`, input),

  /** Escolhe o vencedor de um diff `conflict` de merge paralelo (F18). */
  resolveConflict: (
    threadId: string,
    diffId: string,
    input: { winningChildThreadId: string }
  ): Promise<{ diff: Diff } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/diffs/${diffId}/resolve-conflict`, input),

  gitCommit: (threadId: string, input: { subject: string; body?: string }): Promise<{ sha: string } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/git-commit`, input),

  gitPush: (threadId: string): Promise<{ branch: string } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/git-push`),

  pr: (
    threadId: string,
    input?: { title?: string; body?: string; branch?: string; allowHostOverride?: boolean }
  ): Promise<{ url: string; number: number; existing: boolean } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/pr`, input ?? {}),

  gitTextgen: (
    threadId: string,
    input: { mode: 'commit' | 'pr' }
  ): Promise<{ subject: string; body?: string; title?: string } & ApiErrorBody> =>
    apiRequest('POST', `/api/threads/${threadId}/git-textgen`, input),
}
