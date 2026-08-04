import { beforeEach, describe, expect, it } from 'vitest'
import { openDb } from '../db/client.js'
import { createSubagentsRepository, type Subagent, type SubagentsRepository } from '../db/repositories/subagents.js'
import {
  HARD_CAP_MS,
  checkIdleTimeout,
  completeDelegatedRun,
  startDelegatedRun,
} from './delegate.js'

describe('delegate idle/hard timeout', () => {
  let repo: SubagentsRepository
  let subagent: Subagent

  beforeEach(() => {
    repo = createSubagentsRepository(openDb(':memory:'))
    subagent = repo.create({
      name: 'revisor-seguranca',
      description: 'Revisa diffs em busca de vulnerabilidades.',
      prompt: 'Você é um revisor de segurança.',
      provider: 'claude',
      idleTimeoutMinutes: 5,
    })
  })

  it('idle_silence_marks_timeout', () => {
    const run = startDelegatedRun(repo, { parentThreadId: 'thread-1', subagent, now: 0 })

    expect(checkIdleTimeout(repo, run, 60_000)).toBe(false)
    expect(repo.getRun(run.childThreadId)?.status).toBe('running')

    expect(checkIdleTimeout(repo, run, 5 * 60_000)).toBe(true)
    expect(repo.getRun(run.childThreadId)?.status).toBe('timeout')
  })

  it('recordActivity resets the idle window', () => {
    const run = startDelegatedRun(repo, { parentThreadId: 'thread-1', subagent, now: 0 })
    run.recordActivity(4 * 60_000)
    expect(checkIdleTimeout(repo, run, 5 * 60_000)).toBe(false)
    expect(checkIdleTimeout(repo, run, 9 * 60_000)).toBe(true)
  })

  it('applies the default 20 minute idle timeout when idleTimeoutMinutes is null', () => {
    const inheritSubagent = repo.create({
      name: 'default-timeout',
      description: 'd',
      prompt: 'p',
      provider: 'claude',
      idleTimeoutMinutes: null,
    })
    const run = startDelegatedRun(repo, { parentThreadId: 'thread-2', subagent: inheritSubagent, now: 0 })
    expect(checkIdleTimeout(repo, run, 19 * 60_000)).toBe(false)
    expect(checkIdleTimeout(repo, run, 20 * 60_000)).toBe(true)
  })

  it('hard cap forces timeout even with recent activity', () => {
    const run = startDelegatedRun(repo, { parentThreadId: 'thread-1', subagent, now: 0 })
    run.recordActivity(HARD_CAP_MS - 1000)
    expect(checkIdleTimeout(repo, run, HARD_CAP_MS + 1)).toBe(true)
    expect(repo.getRun(run.childThreadId)?.status).toBe('timeout')
  })

  it('does not re-timeout a run that already completed', () => {
    const run = startDelegatedRun(repo, { parentThreadId: 'thread-1', subagent, now: 0 })
    completeDelegatedRun(repo, run, { text: 'done' })
    expect(checkIdleTimeout(repo, run, 10 * 60_000)).toBe(false)
    expect(repo.getRun(run.childThreadId)?.status).toBe('completed')
  })
})
