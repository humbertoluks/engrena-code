import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'
import type { ComposerImageInput } from './composer-images.js'

export type ProviderStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; id: string; name: string; params: unknown }
  | { type: 'tool-result'; id: string; status: 'completed' | 'error'; result: unknown }
  | { type: 'permission-request'; id: string; toolName: string; params: unknown }

export interface PermissionDecision {
  allow: boolean
}

export interface ResolvedMcpDef {
  name: string
  transport: 'stdio' | 'http' | 'sse'
  command?: string
  args?: string[]
  env?: Record<string, string>
  url?: string
  headers?: Record<string, string>
}

export interface ProviderTurnInput {
  provider: ThreadProvider
  cwd: string
  prompt: string
  systemPrompt?: string | null
  model?: string | null
  /** Nível de reasoning do catálogo F16 (`low`|`medium`|`high`|`extra-high`|`max`) — vira `--effort` nos providers CLI. */
  reasoningLevel?: string | null
  accessLevel: ThreadAccessLevel
  /** API key resolved from the vault for this turn (Claude api-key mode, Codex, Minimax). Absent for CLI subscription auth. */
  apiKey?: string
  /** MCP tools resolvidos para este turno (F09) — vira `--mcp-config` para providers CLI. */
  mcpServers?: ResolvedMcpDef[]
  /** Anexos de imagem (F16 §3.2) — CLI materializa em ficheiros temporários; Minimax rejeita (text-only). */
  images?: ComposerImageInput[]
  onEvent: (event: ProviderStreamEvent) => void
  resolvePermission?: (request: { id: string; toolName: string; params: unknown }) => Promise<PermissionDecision>
  signal?: AbortSignal
}

/** Tokens brutos reportados no fim do turno (evento `result` do stream-json, ou resposta HTTP) — spec F11 §3.2/§4. */
export interface ProviderUsage {
  inputTokens: number
  outputTokens: number
  cacheReadTokens: number | null
  cacheCreationTokens: number | null
}

export interface ProviderTurnResult {
  text: string
  /** Ausente quando o provider não populou `usage` no resultado (spec F11 §3.2 — turno completa, nenhum usage_event é gravado). */
  usage?: ProviderUsage
  /** Custo já calculado pelo SDK do provider (`total_cost_usd`, hoje só Claude) — `undefined` = não reportado, `null` = reportado como indisponível. */
  costUsd?: number | null
}

export class ProviderError extends Error {
  code: string
  /** Presentes quando o payload de erro do provider já carregava usage/custo (spec F11 §3.2 — captura também no path de erro). */
  usage?: ProviderUsage
  costUsd?: number | null

  constructor(code: string, message: string, extra?: { usage?: ProviderUsage; costUsd?: number | null }) {
    super(message)
    this.code = code
    this.usage = extra?.usage
    this.costUsd = extra?.costUsd
  }
}
