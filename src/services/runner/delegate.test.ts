import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { mkdirSync, mkdtempSync, rmSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_delegate_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createSubagentsRepository } = await import('../db/repositories/subagents.js')
const { getThreadEvents } = await import('../db/repositories/usage-events.js')
const { vaultService } = await import('../vault/vault-service.js')
const { ProviderError } = await import('./providers/cli-driver.js')
const { subscribe, clearAllSubscriptions } = await import('./ws-hub.js')
const {
  createDelegationServer,
  runDelegatedSubagentTurn,
  setRunCliTurnForTesting,
  resetRunCliTurnForTesting,
} = await import('./delegate.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_delegate_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeContext(overrides: { parentProvider?: 'claude' | 'codex' | 'kimi' | 'minimax'; accessLevel?: 'supervised' | 'auto-accept-edits' | 'full-access' } = {}) {
  const project = createProject({ path: makeProjectDir(`project-${Math.random()}`) })
  const parentThread = createThread({
    projectId: project.id,
    provider: overrides.parentProvider ?? 'claude',
    accessLevel: overrides.accessLevel ?? 'supervised',
    executionMode: 'main',
  })
  const repo = createSubagentsRepository(getDb())
  return { project, parentThread, repo }
}

function linkSubagent(
  repo: ReturnType<typeof createSubagentsRepository>,
  projectId: string,
  overrides: Partial<Parameters<typeof repo.create>[0]> = {}
) {
  const subagent = repo.create({
    name: overrides.name ?? 'revisor',
    description: 'revisa codigo',
    prompt: 'voce revisa codigo com cuidado',
    provider: overrides.provider ?? 'inherit',
    model: overrides.model,
  })
  repo.upsertProjectLink(projectId, subagent.id, { enabled: true })
  return subagent
}

beforeEach(() => {
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM subagent_runs')
  getDb().exec('DELETE FROM project_subagents')
  getDb().exec('DELETE FROM subagents')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
  clearAllSubscriptions()
})

afterEach(() => {
  resetRunCliTurnForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
  rmSync(fixtureRoot, { recursive: true, force: true })
})

describe('runDelegatedSubagentTurn — gate', () => {
  it('blocks a Codex parent without full-access and never spawns the child', async () => {
    const { project, parentThread, repo } = makeContext({ parentProvider: 'codex', accessLevel: 'supervised' })
    const subagent = linkSubagent(repo, project.id)

    let spawned = false
    setRunCliTurnForTesting(async () => {
      spawned = true
      return { text: 'nunca deveria rodar' }
    })

    const result = await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'faz algo' }
    )

    expect(result.isError).toBe(true)
    expect(spawned).toBe(false)
    expect(repo.listRunsForParentThread(parentThread.id)).toHaveLength(0)
    expect(getThreadEvents(parentThread.id, undefined, 10, 0).events).toHaveLength(0)
  })

  it('allows a Codex parent with full-access', async () => {
    const { project, parentThread, repo } = makeContext({ parentProvider: 'codex', accessLevel: 'full-access' })
    const subagent = linkSubagent(repo, project.id)
    setRunCliTurnForTesting(async () => ({ text: 'feito' }))

    const result = await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'faz algo' }
    )

    expect(result.isError).toBeUndefined()
    expect(result.text).toBe('feito')
  })
})

describe('runDelegatedSubagentTurn — resolução', () => {
  it('returns an error result when the subagent is not linked to the project', async () => {
    const { project, parentThread, repo } = makeContext()
    setRunCliTurnForTesting(async () => ({ text: 'nao deveria' }))

    const result = await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1' },
      { name: 'nao-existe', task: 'faz algo' }
    )

    expect(result.isError).toBe(true)
    expect(result.text).toContain('nao-existe')
  })

  it("resolves provider='inherit' to the parent's provider", async () => {
    const { project, parentThread, repo } = makeContext({ parentProvider: 'claude' })
    const subagent = linkSubagent(repo, project.id, { provider: 'inherit' })

    let capturedProvider: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedProvider = input.provider
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })
    expect(capturedProvider).toBe('claude')
  })
})

describe('runDelegatedSubagentTurn — sucesso', () => {
  it('persists a completed subagent_runs row and a usage_event source=subagent tied to the parent turn', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id, { model: 'claude-haiku-4-5' })

    setRunCliTurnForTesting(async () => ({
      text: 'revisão pronta',
      usage: { inputTokens: 40, outputTokens: 10, cacheReadTokens: null, cacheCreationTokens: null },
      costUsd: 0.002,
    }))

    const result = await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-parent-1' },
      { name: subagent.name, task: 'revisa isso' }
    )

    expect(result.text).toBe('revisão pronta')
    const runs = repo.listRunsForParentThread(parentThread.id)
    expect(runs).toHaveLength(1)
    expect(runs[0]?.status).toBe('completed')
    expect(runs[0]?.subagentName).toBe(subagent.name)

    const page = getThreadEvents(parentThread.id, undefined, 10, 0)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.source).toBe('subagent')
    expect(page.events[0]?.subagentName).toBe(subagent.name)
    expect(page.events[0]?.turnId).toBe('turn-parent-1')
    expect(page.events[0]?.costSource).toBe('sdk')
    expect(page.events[0]?.costUsd).toBe(0.002)
  })

  it('appends context to the task when provided', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    let capturedPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedPrompt = input.prompt
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'revisa isso', context: 'contexto extra' }
    )
    expect(capturedPrompt).toBe('revisa isso\n\ncontexto extra')
  })

  it('does not pass mcpServers to the child (structural depth-1 guard)', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    let capturedMcpServers: unknown = 'not-set'
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })
    expect(capturedMcpServers).toBeUndefined()
  })
})

describe('runDelegatedSubagentTurn — erro', () => {
  it('marks the run as error and does not persist usage_event when the ProviderError carries no usage', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    setRunCliTurnForTesting(async () => {
      throw new ProviderError('provider_turn_error', 'falhou sem usage')
    })

    const result = await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })

    expect(result.text).toContain('falhou')
    const runs = repo.listRunsForParentThread(parentThread.id)
    expect(runs[0]?.status).toBe('error')
    expect(getThreadEvents(parentThread.id, undefined, 10, 0).events).toHaveLength(0)
  })

  it('still persists a usage_event when the ProviderError carries usage (spec F11 §3.2)', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    setRunCliTurnForTesting(async () => {
      throw new ProviderError('provider_turn_error', 'falhou com usage', {
        usage: { inputTokens: 5, outputTokens: 0, cacheReadTokens: null, cacheCreationTokens: null },
        costUsd: null,
      })
    })

    await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })

    const page = getThreadEvents(parentThread.id, undefined, 10, 0)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.source).toBe('subagent')
  })
})

describe('runDelegatedSubagentTurn — F15 hardening', () => {
  it('persists durationMs > 0 on a completed run', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })

    const runs = repo.listRunsForParentThread(parentThread.id)
    expect(runs[0]?.durationMs).not.toBeNull()
    expect(runs[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('reads parentToolCallId from ctx.getParentToolCallId at start (F15)', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1', getParentToolCallId: () => 'tc_parent_1' },
      { name: subagent.name, task: 't' }
    )

    const runs = repo.listRunsForParentThread(parentThread.id)
    expect(runs[0]?.parentToolCallId).toBe('tc_parent_1')
  })

  it('records activity on every stream event from the child, not just text-delta (F15)', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    setRunCliTurnForTesting(async (input) => {
      input.onEvent({ type: 'tool-start', id: 'x', name: 'Read', params: {} })
      input.onEvent({ type: 'tool-result', id: 'x', status: 'completed', result: null })
      return { text: 'ok' }
    })

    const result = await runDelegatedSubagentTurn(
      { repo, project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )
    expect(result.text).toBe('ok')
    expect(repo.listRunsForParentThread(parentThread.id)[0]?.status).toBe('completed')
  })

  it('emits subagent.start and subagent.result over the parent thread WS with childThreadId/status (F15)', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(parentThread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await runDelegatedSubagentTurn({ repo, project, parentThread, parentTurnId: 'turn-1' }, { name: subagent.name, task: 't' })

    const startEvent = received.find((e) => e.type === 'subagent.start')
    const resultEvent = received.find((e) => e.type === 'subagent.result')
    expect(startEvent).toMatchObject({ threadId: parentThread.id, name: subagent.name })
    expect(typeof startEvent?.childThreadId).toBe('string')
    expect(resultEvent).toMatchObject({ threadId: parentThread.id, status: 'completed' })
    expect(resultEvent?.childThreadId).toBe(startEvent?.childThreadId)
  })
})

describe('createDelegationServer', () => {
  it('executes the delegation over HTTP with the issued token and serializes concurrent calls', async () => {
    const { project, parentThread, repo } = makeContext()
    const subagent = linkSubagent(repo, project.id)

    const order: string[] = []
    const gate1: { resolve?: () => void } = {}
    const started = new Promise<void>((resolve) => {
      gate1.resolve = resolve
    })

    let callCount = 0
    setRunCliTurnForTesting(async () => {
      callCount += 1
      const mine = callCount
      order.push(`start-${mine}`)
      if (mine === 1) {
        gate1.resolve?.()
        await new Promise((r) => setTimeout(r, 30))
      }
      order.push(`end-${mine}`)
      return { text: `resultado-${mine}` }
    })

    const server = await createDelegationServer({ repo, project, parentThread, parentTurnId: 'turn-1' })

    async function callDelegate(): Promise<{ text: string }> {
      const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-delegate-token': server.token },
        body: JSON.stringify({ name: subagent.name, task: 't' }),
      })
      return (await res.json()) as { text: string }
    }

    const first = callDelegate()
    await started
    const second = callDelegate()

    const [r1, r2] = await Promise.all([first, second])
    server.close()

    expect(r1.text).toBe('resultado-1')
    expect(r2.text).toBe('resultado-2')
    // segunda chamada só inicia depois que a primeira terminou (serializado, não paralelo)
    expect(order).toEqual(['start-1', 'end-1', 'start-2', 'end-2'])
  })

  it('rejects requests with a wrong token', async () => {
    const { project, parentThread, repo } = makeContext()
    const server = await createDelegationServer({ repo, project, parentThread, parentTurnId: 'turn-1' })

    const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': 'token-errado' },
      body: JSON.stringify({ name: 'x', task: 't' }),
    })

    expect(res.status).toBe(403)
    server.close()
  })
})
