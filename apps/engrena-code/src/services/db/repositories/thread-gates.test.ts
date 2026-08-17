import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_gates_repo_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread } = await import('./threads.js')
const {
  closeThreadGate,
  countOpenThreadGates,
  createThreadGate,
  getThreadGate,
  listAllOpenThreadGates,
  listOpenThreadGates,
} = await import('./thread-gates.js')

function seedThread(): string {
  const project = createProject({ path: mkdtempSync(join(tmpdir(), 'engrenacode_claude_gates_repo_proj_')) })
  return createThread({
    projectId: project.id,
    provider: 'claude',
    accessLevel: 'supervised',
    executionMode: 'main',
    state: 'running',
  }).id
}

beforeEach(() => {
  getDb().exec('DELETE FROM thread_gates')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => closeDb())

describe('thread_gates repository', () => {
  it('grava e relê o gate com payload desserializado', () => {
    const threadId = seedThread()
    const gate = createThreadGate({
      threadId,
      kind: 'permission',
      toolName: 'Bash',
      payload: { command: 'ls -la' },
      expiresAt: 1234,
    })

    expect(gate.id.startsWith('gate_')).toBe(true)
    expect(gate.state).toBe('open')
    expect(gate.resolvedAt).toBeNull()
    expect(gate.expiresAt).toBe(1234)
    expect(getThreadGate(gate.id)).toEqual({ ...gate })
    expect(getThreadGate(gate.id)?.payload).toEqual({ command: 'ls -la' })
  })

  it('lança quando a thread não existe (FK) — o chamador trata como fail-closed', () => {
    expect(() => createThreadGate({ threadId: 'thr_inexistente', kind: 'permission', payload: {} })).toThrow()
  })

  it('lista só os abertos da thread, em ordem de criação, e filtra por kind', () => {
    const a = seedThread()
    const b = seedThread()
    const first = createThreadGate({ threadId: a, kind: 'permission', toolName: 'Write', payload: {} })
    const second = createThreadGate({ threadId: a, kind: 'permission', toolName: 'Bash', payload: {} })
    const question = createThreadGate({ threadId: a, kind: 'question', payload: { prompt: 'qual?' } })
    createThreadGate({ threadId: b, kind: 'permission', toolName: 'Write', payload: {} })

    expect(listOpenThreadGates(a, 'permission').map((g) => g.id)).toEqual([first.id, second.id])
    expect(listOpenThreadGates(a).map((g) => g.id)).toEqual([first.id, second.id, question.id])
    expect(countOpenThreadGates(a, 'permission')).toBe(2)
    expect(countOpenThreadGates(a)).toBe(3)
    expect(listAllOpenThreadGates()).toHaveLength(4)

    closeThreadGate(first.id, 'resolved', { allow: true })
    expect(listOpenThreadGates(a, 'permission').map((g) => g.id)).toEqual([second.id])
    expect(countOpenThreadGates(b, 'permission')).toBe(1)
  })

  it('closeThreadGate é compare-and-swap: só o primeiro consome a linha', () => {
    const threadId = seedThread()
    const gate = createThreadGate({ threadId, kind: 'permission', toolName: 'Bash', payload: {} })

    const first = closeThreadGate(gate.id, 'resolved', { allow: true, reason: 'user_decision' })
    expect(first?.state).toBe('resolved')
    expect(first?.resolution).toEqual({ allow: true, reason: 'user_decision' })
    expect(typeof first?.resolvedAt).toBe('number')

    // Segunda tentativa (timeout correndo com o clique) não reabre nem sobrescreve.
    expect(closeThreadGate(gate.id, 'expired', { allow: false })).toBeNull()
    expect(getThreadGate(gate.id)?.state).toBe('resolved')
    expect(getThreadGate(gate.id)?.resolution).toEqual({ allow: true, reason: 'user_decision' })
  })

  it('closeThreadGate devolve null para gateId inexistente', () => {
    expect(closeThreadGate('gate_fantasma', 'expired')).toBeNull()
  })

  it('some junto com a thread (cascade)', () => {
    const threadId = seedThread()
    const gate = createThreadGate({ threadId, kind: 'permission', toolName: 'Bash', payload: {} })
    getDb().prepare('DELETE FROM threads WHERE id = ?').run(threadId)
    expect(getThreadGate(gate.id)).toBeNull()
  })
})
