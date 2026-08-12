import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_feedback_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const { appendMessage } = await import('./messages.js')
const { setMessageFeedback, getMessageFeedback, clearMessageFeedback, listFeedbackForThread } = await import(
  './message-feedback.js'
)

function seedMessage(): { threadId: string; messageId: string } {
  const project = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_feedback_proj_')) })
  const thread = createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
  })
  const message = appendMessage({ threadId: thread.id, role: 'assistant', content: 'resposta', blocks: null })
  return { threadId: thread.id, messageId: message.id }
}

beforeEach(() => {
  getDb().exec('DELETE FROM message_feedback')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => closeDb())

describe('message feedback', () => {
  it('grava o voto e devolve pelo id da mensagem', () => {
    const { threadId, messageId } = seedMessage()
    const saved = setMessageFeedback({ messageId, threadId, vote: 'up' })
    expect(saved.vote).toBe('up')
    expect(getMessageFeedback(messageId)?.vote).toBe('up')
  })

  it('votar de novo troca o valor em vez de duplicar', () => {
    const { threadId, messageId } = seedMessage()
    setMessageFeedback({ messageId, threadId, vote: 'up' })
    setMessageFeedback({ messageId, threadId, vote: 'down', note: 'errou o path' })
    const current = getMessageFeedback(messageId)
    expect(current?.vote).toBe('down')
    expect(current?.note).toBe('errou o path')
    expect(listFeedbackForThread(threadId)).toHaveLength(1)
  })

  it('limpa o voto', () => {
    const { threadId, messageId } = seedMessage()
    setMessageFeedback({ messageId, threadId, vote: 'up' })
    expect(clearMessageFeedback(messageId)).toBe(true)
    expect(getMessageFeedback(messageId)).toBeNull()
    expect(clearMessageFeedback(messageId)).toBe(false)
  })

  it('some junto com a thread (cascade)', () => {
    const { threadId, messageId } = seedMessage()
    setMessageFeedback({ messageId, threadId, vote: 'up' })
    getDb().prepare('DELETE FROM threads WHERE id = ?').run(threadId)
    expect(getMessageFeedback(messageId)).toBeNull()
  })
})
