import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_threads_'))

const { getDb, closeDb } = await import('../client.js')
const { createProject } = await import('./projects.js')
const { createThread, deleteThread, getThread, updateThread, setThreadState, recoverRunningThreads } = await import(
  './threads.js'
)
type ThreadState = Parameters<typeof setThreadState>[1]

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f08_threads_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

/**
 * F35 — a recuperação de boot passa a gravar `interrupted`, não `error`. O que estes testes cobram
 * não é só o rótulo novo: é a distinção entre "o app cortou" e "o turno falhou", que antes de
 * 2026-08-19 era invisível porque os dois compartilhavam `error`.
 */
describe('recoverRunningThreads', () => {
  function seed(nome: string, state: ThreadState): string {
    const project = createProject({ path: makeProjectDir(nome) })
    return createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state,
    }).id
  }

  it('marca os quatro estados vivos como interrupted e devolve o estado de origem', () => {
    const ids = {
      running: seed('rec-running', 'running'),
      waiting_user: seed('rec-waiting-user', 'waiting_user'),
      waiting_permission: seed('rec-waiting-permission', 'waiting_permission'),
      stopping: seed('rec-stopping', 'stopping'),
    } as const

    const recovered = recoverRunningThreads()

    expect(recovered).toHaveLength(4)
    for (const [origem, id] of Object.entries(ids)) {
      expect(getThread(id)?.state).toBe('interrupted')
      const entry = recovered.find((r) => r.thread.id === id)
      // O estado de origem é o que o log usa para dizer que espera a thread perdeu.
      expect(entry?.recoveredFrom).toBe(origem)
    }
  })

  it('não confunde interrupção com falha: error e cancelled ficam intocados', () => {
    const erro = seed('rec-error', 'error')
    const cancelada = seed('rec-cancelled', 'cancelled')
    const idle = seed('rec-idle', 'idle')
    const committed = seed('rec-committed', 'committed')

    expect(recoverRunningThreads()).toEqual([])

    expect(getThread(erro)?.state).toBe('error')
    expect(getThread(cancelada)?.state).toBe('cancelled')
    expect(getThread(idle)?.state).toBe('idle')
    expect(getThread(committed)?.state).toBe('committed')
  })

  it('devolve lista vazia quando não há nada a recuperar', () => {
    expect(recoverRunningThreads()).toEqual([])
  })

  it('é idempotente: a segunda varredura não encontra nada', () => {
    const id = seed('rec-idempotente', 'running')

    expect(recoverRunningThreads()).toHaveLength(1)
    // `interrupted` não é estado vivo: rodar de novo no unlock seguinte é no-op.
    expect(recoverRunningThreads()).toEqual([])
    expect(getThread(id)?.state).toBe('interrupted')
  })
})

describe('setThreadState', () => {
  it('accepts waiting_user as a valid state (F21)', () => {
    const project = createProject({ path: makeProjectDir('project-set-waiting-user') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })

    const updated = setThreadState(thread.id, 'waiting_user')

    expect(updated?.state).toBe('waiting_user')
    expect(getThread(thread.id)?.state).toBe('waiting_user')
  })

  it('accepts waiting_permission as a valid state (Sprint 2)', () => {
    const project = createProject({ path: makeProjectDir('project-set-waiting-permission') })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'idle',
    })

    const updated = setThreadState(thread.id, 'waiting_permission')

    expect(updated?.state).toBe('waiting_permission')
    expect(getThread(thread.id)?.state).toBe('waiting_permission')
  })
})

describe('deleteThread', () => {
  it('removes the thread row and returns true', () => {
    const project = createProject({ path: makeProjectDir('project-c') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'worktree', state: 'idle' })

    expect(deleteThread(thread.id)).toBe(true)
    expect(getThread(thread.id)).toBeNull()
  })

  it('returns false for an unknown thread id', () => {
    expect(deleteThread('thr_nao_existe')).toBe(false)
  })
})

describe('reasoningLevel persistence (F16 §7.1 test_create_thread_persists_reasoning_and_model)', () => {
  it('persists reasoningLevel + model on create and read', () => {
    const project = createProject({ path: makeProjectDir('project-reasoning') })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      model: 'claude-opus-4-1',
      reasoningLevel: 'high',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'idle',
    })

    expect(thread.model).toBe('claude-opus-4-1')
    expect(thread.reasoningLevel).toBe('high')
    expect(getThread(thread.id)?.reasoningLevel).toBe('high')
  })

  it('defaults reasoningLevel to null when not provided', () => {
    const project = createProject({ path: makeProjectDir('project-reasoning-default') })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })
    expect(thread.reasoningLevel).toBeNull()
  })

  it('updates model + reasoningLevel via updateThread (follow-up)', () => {
    const project = createProject({ path: makeProjectDir('project-reasoning-update') })
    const thread = createThread({ projectId: project.id, provider: 'codex', accessLevel: 'supervised', executionMode: 'main', state: 'idle' })

    const updated = updateThread(thread.id, { model: 'gpt-5.1-codex', reasoningLevel: 'max' })

    expect(updated?.model).toBe('gpt-5.1-codex')
    expect(updated?.reasoningLevel).toBe('max')
  })

  it('defaults cliSessionId to null and persists via updateThread', () => {
    const project = createProject({ path: makeProjectDir('project-cli-session') })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      state: 'idle',
    })
    expect(thread.cliSessionId).toBeNull()

    const updated = updateThread(thread.id, { cliSessionId: 'sess-xyz' })
    expect(updated?.cliSessionId).toBe('sess-xyz')
    expect(getThread(thread.id)?.cliSessionId).toBe('sess-xyz')
  })
})
