import type { Message, ToolCall, ToolCallStatus } from '../../services/threads-service'
import type { SubagentRun } from '../../services/subagents-service'

/** Fonte: `src/services/runner/subagent-registry.ts` (CALL_SUBAGENT_TOOL_NAME) — não importável no renderer (módulo server-only). */
export const CALL_SUBAGENT_TOOL_NAME = 'mcp__engrenacode__call_subagent'

export const LOAD_SKILL_TOOL_NAME = 'mcp__engrenacode__load_skill'

/**
 * Casa cada tool call `call_subagent` do pai com o `subagent_runs` correspondente (spec F15 §3.2):
 * primeiro por `parentToolCallId`; o que sobrar casa por ordem FIFO.
 */
export function correlateSubagentRuns(toolCalls: ToolCall[], runs: SubagentRun[]): Map<string, SubagentRun> {
  const byToolCallId = new Map<string, SubagentRun>()
  const unmatchedRuns: SubagentRun[] = []
  for (const run of runs) {
    if (run.parentToolCallId) byToolCallId.set(run.parentToolCallId, run)
    else unmatchedRuns.push(run)
  }

  const unmatchedToolCalls = toolCalls.filter((t) => t.name === CALL_SUBAGENT_TOOL_NAME && !byToolCallId.has(t.id))
  for (let i = 0; i < unmatchedToolCalls.length && i < unmatchedRuns.length; i++) {
    byToolCallId.set(unmatchedToolCalls[i].id, unmatchedRuns[i])
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
  run: SubagentRun
}

export type TimelineGroup = TimelineMessageItem | TimelineToolsItem | TimelineSubagentItem

/**
 * Intercala mensagens e tools por `seq` (cronológico). Tools adjacentes viram um
 * Work log; `call_subagent` correlacionado vira bloco de subagent (sai do work log).
 */
export function groupTimelineItems(
  messages: Message[],
  toolCalls: ToolCall[],
  runByToolCallId: Map<string, SubagentRun>
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
    if (runByToolCallId.has(tool.id) && tool.name === CALL_SUBAGENT_TOOL_NAME) {
      fusedToolCallIds.add(tool.id)
    }
  }

  const groups: TimelineGroup[] = []
  for (const item of raw) {
    if (item.kind === 'message') {
      groups.push({ kind: 'message', message: item.message })
      continue
    }

    const run = runByToolCallId.get(item.tool.id)
    if (run && fusedToolCallIds.has(item.tool.id)) {
      groups.push({ kind: 'subagent', key: `subagent-${item.tool.id}`, tool: item.tool, run })
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
