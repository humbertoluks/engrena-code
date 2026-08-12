import { getDb } from '../client.js'

/** Voto do usuário numa resposta do agente. Equivalente local ao vote do chat do VS Code. */
export type FeedbackVote = 'up' | 'down'

export interface MessageFeedback {
  messageId: string
  threadId: string
  vote: FeedbackVote
  note: string | null
  createdAt: number
  updatedAt: number
}

interface FeedbackRow {
  message_id: string
  thread_id: string
  vote: string
  note: string | null
  created_at: number
  updated_at: number
}

function toFeedback(row: FeedbackRow): MessageFeedback {
  return {
    messageId: row.message_id,
    threadId: row.thread_id,
    vote: row.vote as FeedbackVote,
    note: row.note,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  }
}

/** Um voto por mensagem: votar de novo troca o valor (upsert), não empilha histórico. */
export function setMessageFeedback(input: {
  messageId: string
  threadId: string
  vote: FeedbackVote
  note?: string | null
}): MessageFeedback {
  const now = Date.now()
  getDb()
    .prepare(
      `INSERT INTO message_feedback (message_id, thread_id, vote, note, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?)
       ON CONFLICT(message_id) DO UPDATE SET vote = excluded.vote, note = excluded.note, updated_at = excluded.updated_at`
    )
    .run(input.messageId, input.threadId, input.vote, input.note ?? null, now, now)
  return getMessageFeedback(input.messageId) as MessageFeedback
}

export function getMessageFeedback(messageId: string): MessageFeedback | null {
  const row = getDb().prepare('SELECT * FROM message_feedback WHERE message_id = ?').get(messageId) as
    | FeedbackRow
    | undefined
  return row === undefined ? null : toFeedback(row)
}

/** Clicar de novo no mesmo voto desfaz — mesmo comportamento do toggle no chat do VS Code. */
export function clearMessageFeedback(messageId: string): boolean {
  const result = getDb().prepare('DELETE FROM message_feedback WHERE message_id = ?').run(messageId)
  return Number(result.changes) > 0
}

export function listFeedbackForThread(threadId: string): MessageFeedback[] {
  const rows = getDb()
    .prepare('SELECT * FROM message_feedback WHERE thread_id = ? ORDER BY created_at ASC')
    .all(threadId) as unknown as FeedbackRow[]
  return rows.map(toFeedback)
}
