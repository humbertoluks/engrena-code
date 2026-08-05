import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'

export type ProviderStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; id: string; name: string; params: unknown }
  | { type: 'tool-result'; id: string; status: 'completed' | 'error'; result: unknown }
  | { type: 'permission-request'; id: string; toolName: string; params: unknown }

export interface PermissionDecision {
  allow: boolean
}

export interface ProviderTurnInput {
  provider: ThreadProvider
  cwd: string
  prompt: string
  systemPrompt?: string | null
  model?: string | null
  accessLevel: ThreadAccessLevel
  /** API key resolved from the vault for this turn (Claude api-key mode, Codex, Minimax). Absent for CLI subscription auth. */
  apiKey?: string
  onEvent: (event: ProviderStreamEvent) => void
  resolvePermission?: (request: { id: string; toolName: string; params: unknown }) => Promise<PermissionDecision>
  signal?: AbortSignal
}

export interface ProviderTurnResult {
  text: string
}

export class ProviderError extends Error {
  code: string

  constructor(code: string, message: string) {
    super(message)
    this.code = code
  }
}
