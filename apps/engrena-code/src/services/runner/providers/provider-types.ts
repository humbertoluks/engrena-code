import type { ThreadAccessLevel, ThreadProvider } from '../../db/repositories/threads.js'
import type { ComposerImageInput } from './composer-images.js'

export type ProviderStreamEvent =
  | { type: 'text-delta'; text: string }
  | { type: 'tool-start'; id: string; name: string; params: unknown }
  | { type: 'tool-result'; id: string; status: 'completed' | 'error'; result: unknown }
  | { type: 'permission-request'; id: string; toolName: string; params: unknown }
  /** Lifecycle do hook (`--include-hook-events`): metadata only, sem stdout do hook. */
  | { type: 'hook-started'; hookId: string; hookEvent: string; hookName: string }
  | {
      type: 'hook-response'
      hookId: string
      hookEvent: string
      hookName: string
      outcome: 'success' | 'error' | 'cancelled'
      exitCode: number | null
    }
  /**
   * Negação da aprovação nativa do Claude CLI.
   * Metadata only — nunca inclui command/tool_input (risco de segredo).
   *
   * Sem `message`: o diagnóstico depende de saber se o broker do EngrenaCode já havia concedido
   * a tool no turno, fato que só `dispatch.ts` tem. O parser entrega metadado; quem compõe a
   * frase é `nativeDenialDiagnosis`, uma vez só.
   */
  | {
      type: 'permission-native-denial'
      toolName: string
      toolUseId?: string
      decisionReasonType: string | null
      /** `decision_reason` do CLI: a frase do hook que negou, quando o payload traz. */
      decisionReason: string | null
    }

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
  /**
   * Tools internas do EngrenaCode liberadas sem passar pelo gate de permissão do CLI (`--allowedTools`).
   * São nossas, não tocam o repositório e viram UI: perguntar ao usuário nunca pode depender do modo.
   * Vem de `INTERNAL_ALWAYS_ALLOWED_TOOLS` (`permission-policy.ts`) e inclui `ToolSearch`, que é
   * como o CLI busca o schema delas — a lista tem de ser a mesma que o broker auto-aprova.
   */
  alwaysAllowedTools?: string[]
  /** Anexos de imagem (F16 §3.2) — CLI materializa em ficheiros temporários; Minimax rejeita (text-only). */
  images?: ComposerImageInput[]
  onEvent: (event: ProviderStreamEvent) => void
  resolvePermission?: (request: { id: string; toolName: string; params: unknown }) => Promise<PermissionDecision>
  /** Broker do hook `PreToolUse` (spec `PermissionBroker`) — só usado por Claude em modo `supervised`. */
  permissionPort?: number
  permissionToken?: string
  /**
   * Session ID do Claude Code CLI para `--resume` no follow-up (mantém contexto entre turnos headless).
   * Só aplicado quando `provider === 'claude'`.
   */
  resumeSessionId?: string | null
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
  /** `session_id` do stream-json (Claude) — persistido na thread para `--resume` no próximo turno. */
  sessionId?: string | null
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
