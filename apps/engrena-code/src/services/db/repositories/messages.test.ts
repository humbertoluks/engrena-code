import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_audit_messages_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const { appendMessage, cancelRunningToolCallsForThread, createToolCall, listMessagesForThread, listToolCallsForThread, updateToolCall } =
  await import('./messages.js')

let threadId: string

beforeEach(() => {
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')

  const project = createProject({ path: process.cwd() })
  const thread = createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
  })
  threadId = thread.id
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

describe('appendMessage', () => {
  it('persists content and round-trips blocks through JSON', () => {
    const msg = appendMessage({
      threadId,
      role: 'assistant',
      content: 'oi',
      blocks: [{ type: 'text', text: 'oi' }],
    })
    expect(msg.content).toBe('oi')
    expect(msg.blocks).toEqual([{ type: 'text', text: 'oi' }])
    expect(msg.seq).toBe(0)
  })

  it('defaults content, blocks and clientId to null when omitted', () => {
    const msg = appendMessage({ threadId, role: 'user' })
    expect(msg.content).toBeNull()
    expect(msg.blocks).toBeNull()
    expect(msg.clientId).toBeNull()
  })

  it('persists clientId and o devolve no histórico (chave da bolha otimista)', () => {
    appendMessage({ threadId, role: 'user', content: 'oi', clientId: 'bubble-1' })
    appendMessage({ threadId, role: 'assistant', content: 'resposta' })

    const messages = listMessagesForThread(threadId)
    expect(messages.map((m) => m.clientId)).toEqual(['bubble-1', null])
  })

  it('interleaves seq across messages and tool_calls for the same thread', () => {
    const m1 = appendMessage({ threadId, role: 'user', content: 'oi' })
    const tc1 = createToolCall({ threadId, name: 'load_skill' })
    const m2 = appendMessage({ threadId, role: 'assistant', content: 'pronto' })

    expect(m1.seq).toBe(0)
    expect(tc1.seq).toBe(1)
    expect(m2.seq).toBe(2)
  })
})

describe('listMessagesForThread', () => {
  it('returns messages ordered by seq ascending', () => {
    appendMessage({ threadId, role: 'user', content: 'primeiro' })
    appendMessage({ threadId, role: 'assistant', content: 'segundo' })

    const messages = listMessagesForThread(threadId)
    expect(messages.map((m) => m.content)).toEqual(['primeiro', 'segundo'])
  })

  it('returns an empty array for a thread with no messages', () => {
    expect(listMessagesForThread(threadId)).toEqual([])
  })
})

describe('createToolCall / updateToolCall', () => {
  it('creates a tool call with status=running and null result/endedAt by default', () => {
    const tc = createToolCall({ threadId, name: 'call_subagent', params: { name: 'reviewer' } })
    expect(tc.status).toBe('running')
    expect(tc.result).toBeNull()
    expect(tc.endedAt).toBeNull()
    expect(tc.params).toEqual({ name: 'reviewer' })
  })

  it('updates status/result and stamps endedAt when ended=true', () => {
    const tc = createToolCall({ threadId, name: 'load_skill' })
    const updated = updateToolCall(tc.id, { status: 'completed', result: { ok: true }, ended: true })

    expect(updated?.status).toBe('completed')
    expect(updated?.result).toEqual({ ok: true })
    expect(updated?.endedAt).not.toBeNull()
  })

  it('preserves the previous result when result is omitted from the patch', () => {
    const tc = createToolCall({ threadId, name: 'load_skill', params: null })
    updateToolCall(tc.id, { status: 'running', result: { partial: 1 } })
    const updated = updateToolCall(tc.id, { status: 'completed' })

    expect(updated?.result).toEqual({ partial: 1 })
  })

  it('returns null when updating a tool call id that does not exist', () => {
    expect(updateToolCall('does-not-exist', { status: 'error' })).toBeNull()
  })
})

describe('listToolCallsForThread', () => {
  it('returns tool calls ordered by seq ascending', () => {
    const a = createToolCall({ threadId, name: 'first' })
    const b = createToolCall({ threadId, name: 'second' })

    const calls = listToolCallsForThread(threadId)
    expect(calls.map((c) => c.id)).toEqual([a.id, b.id])
  })
})

describe('cancelRunningToolCallsForThread', () => {
  it('marks only running tool calls as cancelled and stamps endedAt', () => {
    const running = createToolCall({ threadId, name: 'Bash' })
    const done = createToolCall({ threadId, name: 'Read', status: 'completed' })
    updateToolCall(done.id, { status: 'completed', ended: true })

    const updated = cancelRunningToolCallsForThread(threadId, 'cancelled')
    expect(updated).toHaveLength(1)
    expect(updated[0]?.id).toBe(running.id)
    expect(updated[0]?.status).toBe('cancelled')
    expect(updated[0]?.endedAt).not.toBeNull()

    const all = listToolCallsForThread(threadId)
    expect(all.find((c) => c.id === done.id)?.status).toBe('completed')
  })

  it('can mark in-flight tools as interrupted (error path)', () => {
    createToolCall({ threadId, name: 'Write' })
    const updated = cancelRunningToolCallsForThread(threadId, 'interrupted')
    expect(updated[0]?.status).toBe('interrupted')
  })

  it('returns empty when nothing is running', () => {
    expect(cancelRunningToolCallsForThread(threadId)).toEqual([])
  })
})
