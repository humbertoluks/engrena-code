import { afterAll, beforeEach, describe, expect, it } from 'vitest'
import { mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'
import type { Subagent } from '../db/repositories/subagents.js'
import { HARD_CAP_MS, checkIdleTimeout, completeDelegatedRun, startDelegatedRun } from './delegate.js'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_delegate_idle_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createSubagent, getSubagentRun } = await import('../db/repositories/subagents.js')

describe('delegate idle/hard timeout', () => {
  let subagent: Subagent

  beforeEach(() => {
    getDb().exec('DELETE FROM subagent_runs')
    getDb().exec('DELETE FROM project_subagents')
    getDb().exec('DELETE FROM subagents')
    subagent = createSubagent({
      name: 'revisor-seguranca',
      description: 'Revisa diffs em busca de vulnerabilidades.',
      prompt: 'Você é um revisor de segurança.',
      provider: 'claude',
      idleTimeoutMinutes: 5,
    })
  })

  afterAll(() => {
    closeDb()
    rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  })

  it('idle_silence_marks_timeout', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 0 })

    expect(checkIdleTimeout(run, 60_000)).toBe(false)
    expect(getSubagentRun(run.childThreadId)?.status).toBe('running')

    expect(checkIdleTimeout(run, 5 * 60_000)).toBe(true)
    expect(getSubagentRun(run.childThreadId)?.status).toBe('timeout')
  })

  it('recordActivity resets the idle window', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 0 })
    run.recordActivity(4 * 60_000)
    expect(checkIdleTimeout(run, 5 * 60_000)).toBe(false)
    expect(checkIdleTimeout(run, 9 * 60_000)).toBe(true)
  })

  it('applies the default 20 minute idle timeout when idleTimeoutMinutes is null', () => {
    const inheritSubagent = createSubagent({
      name: 'default-timeout',
      description: 'd',
      prompt: 'p',
      provider: 'claude',
      idleTimeoutMinutes: null,
    })
    const run = startDelegatedRun({
      parentThreadId: 'thread-2',
      subagent: inheritSubagent,
      now: 0,
    })
    expect(checkIdleTimeout(run, 19 * 60_000)).toBe(false)
    expect(checkIdleTimeout(run, 20 * 60_000)).toBe(true)
  })

  it('hard cap forces timeout even with recent activity', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 0 })
    run.recordActivity(HARD_CAP_MS - 1000)
    expect(checkIdleTimeout(run, HARD_CAP_MS + 1)).toBe(true)
    expect(getSubagentRun(run.childThreadId)?.status).toBe('timeout')
  })

  it('does not re-timeout a run that already completed', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 0 })
    completeDelegatedRun(run, { text: 'done' })
    expect(checkIdleTimeout(run, 10 * 60_000)).toBe(false)
    expect(getSubagentRun(run.childThreadId)?.status).toBe('completed')
  })

  it('persists durationMs on complete (F15)', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 1_000 })
    completeDelegatedRun(run, { text: 'done' }, 5_000)
    expect(getSubagentRun(run.childThreadId)?.durationMs).toBe(4_000)
  })

  it('persists durationMs on timeout (F15)', () => {
    const run = startDelegatedRun({ parentThreadId: 'thread-1', subagent, now: 0 })
    checkIdleTimeout(run, 5 * 60_000)
    expect(getSubagentRun(run.childThreadId)?.durationMs).toBe(5 * 60_000)
  })

  it('persists parentToolCallId when provided at start (F15)', () => {
    const run = startDelegatedRun({
      parentThreadId: 'thread-1',
      parentToolCallId: 'tc_abc',
      subagent,
      now: 0,
    })
    expect(getSubagentRun(run.childThreadId)?.parentToolCallId).toBe('tc_abc')
  })
})
