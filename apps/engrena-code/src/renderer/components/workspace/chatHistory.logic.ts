import type { Message, ToolCall, ToolCallStatus } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'

/** Fonte: `src/services/runner/subagent-registry.ts` (CALL_SUBAGENT_TOOL_NAME) — não importável no renderer (módulo server-only). */
export const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

export const LOAD_SKILL_TOOL_NAME = 'mcp__engrenacode__load_skill'

/**
 * Casa cada tool call `call_subagent` do pai com os `subagent_runs` correspondentes (spec F15 §3.2):
 * primeiro por `parentToolCallId`; o que sobrar casa por ordem FIFO.
 *
 * A relação é **1:N**, não 1:1 — o batch paralelo do F18 abre até 4 filhos a partir de uma única
 * chamada `call_subagent` (`tasks[]`), e os N runs gravam o mesmo `parentToolCallId`. Era um
 * `Map<string, SubagentRun>` até 2026-08-17, e por isso a timeline do pai mostrava só o último
 * filho do batch: cada `set` sobrescrevia o anterior em silêncio.
 */
export function correlateSubagentRuns(toolCalls: ToolCall[], runs: SubagentRun[]): Map<string, SubagentRun[]> {
  const byToolCallId = new Map<string, SubagentRun[]>()
  const unmatchedRuns: SubagentRun[] = []
  for (const run of runs) {
    if (!run.parentToolCallId) {
      unmatchedRuns.push(run)
      continue
    }
    const existing = byToolCallId.get(run.parentToolCallId)
    if (existing) existing.push(run)
    else byToolCallId.set(run.parentToolCallId, [run])
  }

  const unmatchedToolCalls = toolCalls.filter((t) => t.name === CALL_SUBAGENT_TOOL_NAME && !byToolCallId.has(t.id))
  for (let i = 0; i < unmatchedToolCalls.length && i < unmatchedRuns.length; i++) {
    byToolCallId.set(unmatchedToolCalls[i].id, [unmatchedRuns[i]])
  }
  return byToolCallId
}

/** Relógio curto HH:mm a partir de epoch ms; inválido → string vazia (omitir na UI). */
export function formatClock(epochMs: number | null | undefined): string {
  if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) return ''
  const date = new Date(epochMs)
  if (Number.isNaN(date.getTime())) return ''
  const pad = (n: number): string => String(n).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

/** Duração escalonada para "Pensando… Xs" / "Pensou por Xs" (F03 copy). */
export function formatDurationSeconds(ms: number): string {
  if (!Number.isFinite(ms) || ms < 0) return '0s'
  const totalSeconds = Math.floor(ms / 1000)
  if (totalSeconds < 60) return `${totalSeconds}s`
  const hours = Math.floor(totalSeconds / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60
  if (hours === 0) {
    return seconds > 0 ? `${minutes}m ${seconds}s` : `${minutes}m`
  }
  const parts = [`${hours}h`]
  if (minutes > 0 || seconds > 0) parts.push(`${minutes}m`)
  if (seconds > 0) parts.push(`${seconds}s`)
  return parts.join(' ')
}

/** Uma linha resumida da tool (comando/caminho/query); sem quebras. */
export function toolSummary(tool: Pick<ToolCall, 'name' | 'params'>): string {
  const p =
    tool.params !== null && typeof tool.params === 'object' && !Array.isArray(tool.params)
      ? (tool.params as Record<string, unknown>)
      : {}

  if (tool.name === LOAD_SKILL_TOOL_NAME) {
    let skill = ''
    if (typeof p.name === 'string') skill = p.name
    else if (typeof p.skill === 'string') skill = p.skill
    return `Skill carregada: ${skill || 'skill'}`
  }

  const pick = (k: string): string | null =>
    typeof p[k] === 'string' && (p[k] as string).trim().length > 0 ? (p[k] as string) : null

  const raw =
    pick('command') ??
    pick('description') ??
    pick('path') ??
    pick('file_path') ??
    pick('query') ??
    pick('pattern') ??
    tool.name

  return raw.replace(/\s+/g, ' ').trim()
}

export function formatToolPayload(payload: unknown, max = 2000): string {
  if (payload == null) return ''
  let text: string
  try {
    text = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2)
  } catch {
    text = String(payload)
  }
  return text.length > max ? `${text.slice(0, max)}\n… (truncado)` : text
}

export type TimelineMessageItem = { kind: 'message'; message: Message }
export type TimelineToolsItem = { kind: 'tools'; key: string; tools: ToolCall[] }
export type TimelineSubagentItem = {
  kind: 'subagent'
  key: string
  tool: ToolCall
  /** N ≥ 1 — uma chamada com `tasks[]` (batch paralelo F18) rende um bloco por filho. */
  runs: SubagentRun[]
}

export type TimelineGroup = TimelineMessageItem | TimelineToolsItem | TimelineSubagentItem

/**
 * Intercala mensagens e tools por `seq` (cronológico). Tools adjacentes viram um
 * Work log; `call_subagent` correlacionado vira bloco de subagent (sai do work log).
 */
export function groupTimelineItems(
  messages: Message[],
  toolCalls: ToolCall[],
  runByToolCallId: Map<string, SubagentRun[]>
): TimelineGroup[] {
  type Raw =
    | { kind: 'message'; seq: number; message: Message }
    | { kind: 'tool'; seq: number; tool: ToolCall }

  const raw: Raw[] = [
    ...messages.map((message) => ({ kind: 'message' as const, seq: message.seq, message })),
    ...toolCalls.map((tool) => ({ kind: 'tool' as const, seq: tool.seq, tool })),
  ]
  raw.sort((a, b) => a.seq - b.seq || (a.kind === 'message' ? -1 : 1))

  const fusedToolCallIds = new Set<string>()
  for (const tool of toolCalls) {
    const runs = runByToolCallId.get(tool.id)
    if (runs !== undefined && runs.length > 0 && tool.name === CALL_SUBAGENT_TOOL_NAME) {
      fusedToolCallIds.add(tool.id)
    }
  }

  const groups: TimelineGroup[] = []
  for (const item of raw) {
    if (item.kind === 'message') {
      groups.push({ kind: 'message', message: item.message })
      continue
    }

    const runs = runByToolCallId.get(item.tool.id)
    if (runs && runs.length > 0 && fusedToolCallIds.has(item.tool.id)) {
      groups.push({ kind: 'subagent', key: `subagent-${item.tool.id}`, tool: item.tool, runs })
      continue
    }

    const last = groups.at(-1)
    if (last?.kind === 'tools') {
      last.tools.push(item.tool)
    } else {
      groups.push({ kind: 'tools', key: `worklog-${item.tool.id}`, tools: [item.tool] })
    }
  }

  return groups
}

/**
 * Duração do turno para a mensagem assistant: do user anterior até o createdAt
 * do assistente. Sem user anterior → null.
 */
export function turnDurationForAssistant(messages: Message[], assistant: Message): number | null {
  if (assistant.role !== 'assistant') return null
  let prevUser: Message | null = null
  for (const m of messages) {
    if (m.id === assistant.id) break
    if (m.role === 'user') prevUser = m
  }
  if (!prevUser) return null
  const ms = assistant.createdAt - prevUser.createdAt
  return ms > 0 ? ms : null
}

/** Epoch de início do "Pensando…" = última mensagem user (ou agora). */
export function thinkingStartMs(messages: Message[], nowMs: number): number {
  for (let i = messages.length - 1; i >= 0; i--) {
    if (messages[i].role === 'user') return messages[i].createdAt
  }
  return nowMs
}

export function isToolRunning(status: ToolCallStatus): boolean {
  return status === 'running'
}

export function anyToolRunning(tools: ToolCall[]): boolean {
  return tools.some((t) => t.status === 'running')
}

/** Max visible lines for a collapsed user bubble (F03 chat presentation). */
export const USER_MESSAGE_COLLAPSE_LINES = 3

/** Count soft lines in user message content (newline-separated). */
export function countUserMessageLines(content: string | null | undefined): number {
  if (content == null || content.length === 0) return 0
  return content.replace(/\r\n/g, '\n').split('\n').length
}

/**
 * Whether a user bubble should start collapsed with fade.
 * True when soft line count exceeds `maxLines` (default 3).
 */
export function shouldCollapseUserMessage(
  content: string | null | undefined,
  maxLines: number = USER_MESSAGE_COLLAPSE_LINES
): boolean {
  if (!Number.isFinite(maxLines) || maxLines < 1) return false
  return countUserMessageLines(content) > maxLines
}

// ── Atividade em curso (rótulo shimmer do chat) ───────────────────────────────

/** Rótulo shimmer + início da atividade atual do turno. */
export interface ChatActivity {
  label: string
  startMs: number
}

export const DEFAULT_ACTIVITY_LABEL = 'Pensando'
const FALLBACK_TOOL_LABEL = 'Trabalhando'

/**
 * Verbo por tool. Nome exato primeiro (tools nativas do CLI); prefixo `mcp__` e
 * desconhecidos caem no rótulo genérico — nunca expor o nome cru da tool.
 */
const TOOL_ACTIVITY_LABEL: Record<string, string> = {
  Read: 'Lendo',
  NotebookRead: 'Lendo',
  Write: 'Escrevendo',
  Edit: 'Editando',
  MultiEdit: 'Editando',
  NotebookEdit: 'Editando',
  Bash: 'Executando',
  BashOutput: 'Executando',
  KillShell: 'Executando',
  PowerShell: 'Executando',
  Grep: 'Buscando',
  Glob: 'Procurando arquivos',
  WebFetch: 'Pesquisando na web',
  WebSearch: 'Pesquisando na web',
  Task: 'Delegando',
  Agent: 'Delegando',
  TodoWrite: 'Planejando',
  ExitPlanMode: 'Planejando',
  AskUserQuestion: 'Perguntando',
}

export function activityLabelForTool(name: string): string {
  if (name === CALL_SUBAGENT_TOOL_NAME) return 'Delegando'
  if (name === LOAD_SKILL_TOOL_NAME) return 'Carregando skill'
  return TOOL_ACTIVITY_LABEL[name] ?? FALLBACK_TOOL_LABEL
}

/** Bolha otimista já despachada (fora do histórico persistido) — só o instante do envio importa. */
export interface DispatchedPendingLike {
  status: string
  createdAt: number
}

/**
 * Início do "Pensando…": a mensagem do usuário mais recente entre o histórico persistido e as
 * bolhas otimistas já despachadas. Sem contar a pendente, o follow-up herdava o horário do turno
 * anterior e o cronômetro nascia inflado ("Pensando… 31s" no primeiro segundo).
 */
function pendingAwareStartMs(
  messages: Message[],
  pending: readonly DispatchedPendingLike[],
  nowMs: number
): number {
  let start = thinkingStartMs(messages, nowMs)
  for (const item of pending) {
    if (item.status === 'queued' || item.status === 'permission') continue
    if (Number.isFinite(item.createdAt) && item.createdAt > start) start = item.createdAt
  }
  return start
}

/**
 * Atividade a mostrar enquanto a thread está `running`: a tool em execução mais recente
 * (rótulo + `startedAt` dela) ou "Pensando" a partir da última mensagem do usuário.
 */
export function currentActivity(
  messages: Message[],
  toolCalls: ToolCall[],
  nowMs: number,
  pending: readonly DispatchedPendingLike[] = []
): ChatActivity {
  let latest: ToolCall | null = null
  for (const tool of toolCalls) {
    if (tool.status !== 'running') continue
    if (latest === null || tool.seq > latest.seq) latest = tool
  }

  if (latest !== null) {
    const startMs = Number.isFinite(latest.startedAt) && latest.startedAt > 0 ? latest.startedAt : nowMs
    return { label: activityLabelForTool(latest.name), startMs }
  }

  return { label: DEFAULT_ACTIVITY_LABEL, startMs: pendingAwareStartMs(messages, pending, nowMs) }
}
