import { randomUUID } from 'crypto'
import { getDb } from '../client.js'

export type MessageRole = 'user' | 'assistant' | 'system'

export interface Message {
  id: string
  threadId: string
  role: MessageRole
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

interface MessageRow {
  id: string
  thread_id: string
  role: string
  content: string | null
  blocks_json: string | null
  seq: number
  created_at: number
}

interface ToolCallRow {
  id: string
  thread_id: string
  message_id: string | null
  name: string
  params_json: string | null
  status: string
  result_json: string | null
  seq: number
  started_at: number
  ended_at: number | null
}

function toMessage(row: MessageRow): Message {
  return {
    id: row.id,
    threadId: row.thread_id,
    role: row.role as MessageRole,
    content: row.content,
    blocks: row.blocks_json ? (JSON.parse(row.blocks_json) as unknown[]) : null,
    seq: row.seq,
    createdAt: row.created_at,
  }
}

function toToolCall(row: ToolCallRow): ToolCall {
  return {
    id: row.id,
    threadId: row.thread_id,
    messageId: row.message_id,
    name: row.name,
    params: row.params_json ? JSON.parse(row.params_json) : null,
    status: row.status as ToolCallStatus,
    result: row.result_json ? JSON.parse(row.result_json) : null,
    seq: row.seq,
    startedAt: row.started_at,
    endedAt: row.ended_at,
  }
}

function nextSeq(threadId: string): number {
  const msgMax = getDb().prepare('SELECT MAX(seq) as m FROM messages WHERE thread_id = ?').get(threadId) as {
    m: number | null
  }
  const toolMax = getDb().prepare('SELECT MAX(seq) as m FROM tool_calls WHERE thread_id = ?').get(threadId) as {
    m: number | null
  }
  const max = Math.max(msgMax.m ?? -1, toolMax.m ?? -1)
  return max + 1
}

export interface AppendMessageInput {
  threadId: string
  role: MessageRole
  content?: string | null
  blocks?: unknown[] | null
}

export function appendMessage(input: AppendMessageInput): Message {
  const id = randomUUID()
  const seq = nextSeq(input.threadId)
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO messages (id, thread_id, role, content, blocks_json, seq, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)`
    )
    .run(
      id,
      input.threadId,
      input.role,
      input.content ?? null,
      input.blocks ? JSON.stringify(input.blocks) : null,
      seq,
      now
    )

  const row = getDb().prepare('SELECT * FROM messages WHERE id = ?').get(id) as unknown as MessageRow
  return toMessage(row)
}

export function listMessagesForThread(threadId: string): Message[] {
  const rows = getDb()
    .prepare('SELECT * FROM messages WHERE thread_id = ? ORDER BY seq ASC')
    .all(threadId) as unknown as MessageRow[]
  return rows.map(toMessage)
}

export interface CreateToolCallInput {
  threadId: string
  messageId?: string | null
  name: string
  params?: unknown
  status?: ToolCallStatus
}

export function createToolCall(input: CreateToolCallInput): ToolCall {
  const id = randomUUID()
  const seq = nextSeq(input.threadId)
  const now = Date.now()

  getDb()
    .prepare(
      `INSERT INTO tool_calls (id, thread_id, message_id, name, params_json, status, result_json, seq, started_at, ended_at)
       VALUES (?, ?, ?, ?, ?, ?, NULL, ?, ?, NULL)`
    )
    .run(
      id,
      input.threadId,
      input.messageId ?? null,
      input.name,
      input.params !== undefined ? JSON.stringify(input.params) : null,
      input.status ?? 'running',
      seq,
      now
    )

  const row = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as unknown as ToolCallRow
  return toToolCall(row)
}

export interface UpdateToolCallInput {
  status?: ToolCallStatus
  result?: unknown
  ended?: boolean
}

export function updateToolCall(id: string, patch: UpdateToolCallInput): ToolCall | null {
  const row = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as ToolCallRow | undefined
  if (row === undefined) return null
  const existing = toToolCall(row)

  getDb()
    .prepare(
      `UPDATE tool_calls SET status = ?, result_json = ?, ended_at = ? WHERE id = ?`
    )
    .run(
      patch.status ?? existing.status,
      patch.result !== undefined ? JSON.stringify(patch.result) : row.result_json,
      patch.ended === true ? Date.now() : existing.endedAt,
      id
    )

  const updated = getDb().prepare('SELECT * FROM tool_calls WHERE id = ?').get(id) as unknown as ToolCallRow
  return toToolCall(updated)
}

export function listToolCallsForThread(threadId: string): ToolCall[] {
  const rows = getDb()
    .prepare('SELECT * FROM tool_calls WHERE thread_id = ? ORDER BY seq ASC')
    .all(threadId) as unknown as ToolCallRow[]
  return rows.map(toToolCall)
}
