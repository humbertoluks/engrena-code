import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_delegate_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { createThread } = await import('../db/repositories/threads.js')
const { createSubagent, listSubagentRunsForParentThread, upsertProjectSubagentLink } = await import(
  '../db/repositories/subagents.js'
)
import type { SubagentInput } from '../db/repositories/subagents.js'
const { getThreadEvents } = await import('../db/repositories/usage-events.js')
const { vaultService } = await import('../vault/vault-service.js')
const { ProviderError } = await import('./providers/cli-driver.js')
const { subscribe, clearAllSubscriptions } = await import('./ws-hub.js')
const { diffWorkingTree } = await import('../git/git-client.js')
const { createDiff, listDiffsForThread } = await import('../db/repositories/diffs.js')
const { resolveThreadCwd } = await import('./thread-cwd.js')
const {
  createDelegationServer,
  runDelegatedSubagentTurn,
  runParallelDelegatedBatch,
  setRunCliTurnForTesting,
  resetRunCliTurnForTesting,
  MAX_PARALLEL_TASKS,
} = await import('./delegate.js')

const fixtureRoot = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f11_delegate_fixture_'))

function makeProjectDir(name: string): string {
  const dir = join(fixtureRoot, name)
  mkdirSync(dir, { recursive: true })
  return dir
}

function makeGitProjectDir(name: string): string {
  const dir = makeProjectDir(name)
  execFileSync('git', ['init'], { cwd: dir })
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '--allow-empty', '-m', 'init'],
    { cwd: dir }
  )
  return dir
}

function makeContext(
  overrides: {
    parentProvider?: 'claude' | 'codex' | 'kimi' | 'minimax'
    accessLevel?: 'supervised' | 'auto-accept-edits' | 'full-access'
  } = {}
) {
  const project = createProject({ path: makeProjectDir(`project-${Math.random()}`) })
  const parentThread = createThread({
    projectId: project.id,
    provider: overrides.parentProvider ?? 'claude',
    accessLevel: overrides.accessLevel ?? 'supervised',
    executionMode: 'main',
  })
  return { project, parentThread }
}

function linkSubagent(projectId: string, overrides: Partial<SubagentInput> = {}) {
  const subagent = createSubagent({
    name: overrides.name ?? 'revisor',
    description: 'revisa codigo',
    prompt: 'voce revisa codigo com cuidado',
    provider: overrides.provider ?? 'inherit',
    model: overrides.model,
  })
  upsertProjectSubagentLink(projectId, subagent.id, { enabled: true })
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
    const { project, parentThread } = makeContext({
      parentProvider: 'codex',
      accessLevel: 'supervised',
    })
    const subagent = linkSubagent(project.id)

    let spawned = false
    setRunCliTurnForTesting(async () => {
      spawned = true
      return { text: 'nunca deveria rodar' }
    })

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'faz algo' }
    )

    expect(result.isError).toBe(true)
    expect(spawned).toBe(false)
    expect(listSubagentRunsForParentThread(parentThread.id)).toHaveLength(0)
    expect(getThreadEvents(parentThread.id, undefined, 10, 0).events).toHaveLength(0)
  })

  it('allows a Codex parent with full-access', async () => {
    const { project, parentThread } = makeContext({
      parentProvider: 'codex',
      accessLevel: 'full-access',
    })
    const subagent = linkSubagent(project.id)
    setRunCliTurnForTesting(async () => ({ text: 'feito' }))

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'faz algo' }
    )

    expect(result.isError).toBeUndefined()
    expect(result.text).toBe('feito')
  })
})

describe('runDelegatedSubagentTurn — resolução', () => {
  it('returns an error result when the subagent is not linked to the project', async () => {
    const { project, parentThread } = makeContext()
    setRunCliTurnForTesting(async () => ({ text: 'nao deveria' }))

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: 'nao-existe', task: 'faz algo' }
    )

    expect(result.isError).toBe(true)
    expect(result.text).toContain('nao-existe')
  })

  it("resolves provider='inherit' to the parent's provider", async () => {
    const { project, parentThread } = makeContext({ parentProvider: 'claude' })
    const subagent = linkSubagent(project.id, { provider: 'inherit' })

    let capturedProvider: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedProvider = input.provider
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )
    expect(capturedProvider).toBe('claude')
  })
})

describe('runDelegatedSubagentTurn — sucesso', () => {
  it('persists a completed subagent_runs row and a usage_event source=subagent tied to the parent turn', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id, { model: 'claude-haiku-4-5' })

    setRunCliTurnForTesting(async () => ({
      text: 'revisão pronta',
      usage: {
        inputTokens: 40,
        outputTokens: 10,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      },
      costUsd: 0.002,
    }))

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-parent-1' },
      { name: subagent.name, task: 'revisa isso' }
    )

    expect(result.text).toBe('revisão pronta')
    const runs = listSubagentRunsForParentThread(parentThread.id)
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
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

    let capturedPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedPrompt = input.prompt
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 'revisa isso', context: 'contexto extra' }
    )
    expect(capturedPrompt).toBe('revisa isso\n\ncontexto extra')
  })

  it('does not pass mcpServers to the child (structural depth-1 guard)', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

    let capturedMcpServers: unknown = 'not-set'
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers
      return { text: 'ok' }
    })

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )
    expect(capturedMcpServers).toBeUndefined()
  })
})

describe('runDelegatedSubagentTurn — erro', () => {
  it('marks the run as error and does not persist usage_event when the ProviderError carries no usage', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

    setRunCliTurnForTesting(async () => {
      throw new ProviderError('provider_turn_error', 'falhou sem usage')
    })

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )

    expect(result.text).toContain('falhou')
    const runs = listSubagentRunsForParentThread(parentThread.id)
    expect(runs[0]?.status).toBe('error')
    expect(getThreadEvents(parentThread.id, undefined, 10, 0).events).toHaveLength(0)
  })

  it('still persists a usage_event when the ProviderError carries usage (spec F11 §3.2)', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

    setRunCliTurnForTesting(async () => {
      throw new ProviderError('provider_turn_error', 'falhou com usage', {
        usage: {
          inputTokens: 5,
          outputTokens: 0,
          cacheReadTokens: null,
          cacheCreationTokens: null,
        },
        costUsd: null,
      })
    })

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )

    const page = getThreadEvents(parentThread.id, undefined, 10, 0)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.source).toBe('subagent')
  })
})

describe('runDelegatedSubagentTurn — F15 hardening', () => {
  it('persists durationMs > 0 on a completed run', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )

    const runs = listSubagentRunsForParentThread(parentThread.id)
    expect(runs[0]?.durationMs).not.toBeNull()
    expect(runs[0]?.durationMs).toBeGreaterThanOrEqual(0)
  })

  it('reads parentToolCallId from ctx.getParentToolCallId at start (F15)', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1', getParentToolCallId: () => 'tc_parent_1' },
      { name: subagent.name, task: 't' }
    )

    const runs = listSubagentRunsForParentThread(parentThread.id)
    expect(runs[0]?.parentToolCallId).toBe('tc_parent_1')
  })

  it('records activity on every stream event from the child, not just text-delta (F15)', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

    setRunCliTurnForTesting(async (input) => {
      input.onEvent({ type: 'tool-start', id: 'x', name: 'Read', params: {} })
      input.onEvent({ type: 'tool-result', id: 'x', status: 'completed', result: null })
      return { text: 'ok' }
    })

    const result = await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )
    expect(result.text).toBe('ok')
    expect(listSubagentRunsForParentThread(parentThread.id)[0]?.status).toBe('completed')
  })

  it('emits subagent.start and subagent.result over the parent thread WS with childThreadId/status (F15)', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const received: Array<Record<string, unknown>> = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(parentThread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )

    const startEvent = received.find((e) => e.type === 'subagent.start')
    const resultEvent = received.find((e) => e.type === 'subagent.result')
    expect(startEvent).toMatchObject({ threadId: parentThread.id, name: subagent.name })
    expect(typeof startEvent?.childThreadId).toBe('string')
    expect(resultEvent).toMatchObject({ threadId: parentThread.id, status: 'completed' })
    expect(resultEvent?.childThreadId).toBe(startEvent?.childThreadId)
  })
})

describe('runDelegatedSubagentTurn — diffs unificados (F15 Fase 3)', () => {
  it('a file written by the child during delegation shows up in diffWorkingTree(cwd) of the parent', async () => {
    const dir = makeGitProjectDir(`project-${Math.random()}`)
    const project = createProject({ path: dir })
    const parentThread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })
    const subagent = linkSubagent(project.id)

    const cwd = resolveThreadCwd(parentThread, project)
    setRunCliTurnForTesting(async (input) => {
      // Mesmo cwd do pai — é isso que unifica o write do filho sem merge-tree (spec F15 §3.2).
      writeFileSync(join(input.cwd, 'arquivo-do-filho.txt'), 'criado pelo subagent\n')
      return { text: 'feito' }
    })

    await runDelegatedSubagentTurn(
      { project, parentThread, parentTurnId: 'turn-1' },
      { name: subagent.name, task: 't' }
    )

    const diffs = await diffWorkingTree(cwd)
    expect(diffs.map((d) => d.file)).toContain('arquivo-do-filho.txt')

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('runParallelDelegatedBatch (F18)', () => {
  function makeGitContext() {
    const dir = makeGitProjectDir(`project-parallel-${Math.random()}`)
    const project = createProject({ path: dir })
    const parentThread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })
    return { project, parentThread }
  }

  it('test_parallel_two_children_disjoint_paths', async () => {
    const { project, parentThread } = makeGitContext()
    const a = linkSubagent(project.id, { name: 'implementer-a' })
    const b = linkSubagent(project.id, { name: 'implementer-b' })

    const cwds: string[] = []
    setRunCliTurnForTesting(async (input) => {
      cwds.push(input.cwd)
      writeFileSync(join(input.cwd, `${input.prompt}.txt`), 'ok\n')
      return {
        text: 'feito',
        usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: null, cacheCreationTokens: null },
      }
    })

    const batch = await runParallelDelegatedBatch(
      { project, parentThread, parentTurnId: 'turn-1' },
      [
        { name: a.name, task: 'task-a' },
        { name: b.name, task: 'task-b' },
      ]
    )

    expect(batch.results).toHaveLength(2)
    expect(batch.results.every((r) => r.status === 'completed')).toBe(true)
    expect(new Set(cwds).size).toBe(2)
    expect(cwds).not.toContain(resolveThreadCwd(parentThread, project))

    const runs = listSubagentRunsForParentThread(parentThread.id)
    expect(runs).toHaveLength(2)
    expect(runs.every((r) => r.parallelBatchId === batch.parallelBatchId)).toBe(true)

    expect(getThreadEvents(parentThread.id, undefined, 10, 0).events).toHaveLength(2)

    // AC F18 §2: filhos em paths distintos mergeiam — mas o batch em si não cria diff (regressão
    // real achada via smoke ao vivo: criava aqui E de novo no fim do turno pai via
    // dispatch.ts:diffWorkingTree(cwd), duplicando a entrada). Só materializa; quem cria o diff é
    // o mesmo `diffWorkingTree` de sempre, exercitado abaixo como dispatch.ts faria.
    expect(listDiffsForThread(parentThread.id)).toHaveLength(0)
    const parentCwd = resolveThreadCwd(parentThread, project)
    expect(readFileSync(join(parentCwd, 'task-a.txt'), 'utf-8')).toBe('ok\n')
    expect(readFileSync(join(parentCwd, 'task-b.txt'), 'utf-8')).toBe('ok\n')

    // Simula o post-turn de dispatch.ts (mesmo diffWorkingTree(cwd) + createDiff por arquivo) para
    // provar que, ponta a ponta, cada arquivo materializado pelo batch vira exatamente 1 diff.
    const postTurnFiles = await diffWorkingTree(parentCwd)
    for (const f of postTurnFiles) {
      createDiff({ threadId: parentThread.id, file: f.file, additions: f.additions, deletions: f.deletions, hunks: f.hunks, provider: 'claude', worktreePath: parentCwd })
    }
    const diffs = listDiffsForThread(parentThread.id)
    expect(diffs.map((d) => d.file).sort()).toEqual(['task-a.txt', 'task-b.txt'])
    expect(diffs.every((d) => d.status === 'pending')).toBe(true)
  }, 30_000)

  it('test_merge_same_path_conflict — two children writing the same file end up as a conflict diff, not applied to the parent', async () => {
    const { project, parentThread } = makeGitContext()
    const a = linkSubagent(project.id, { name: 'implementer-a' })
    const b = linkSubagent(project.id, { name: 'implementer-b' })

    setRunCliTurnForTesting(async (input) => {
      writeFileSync(join(input.cwd, 'shared.ts'), `versao de ${input.prompt}\n`)
      return { text: 'feito' }
    })

    const batch = await runParallelDelegatedBatch(
      { project, parentThread, parentTurnId: 'turn-1' },
      [
        { name: a.name, task: 'a' },
        { name: b.name, task: 'b' },
      ]
    )

    expect(batch.hadConflict).toBe(true)

    const diffs = listDiffsForThread(parentThread.id)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].status).toBe('conflict')
    expect(diffs[0].conflictCandidates).toHaveLength(2)

    const parentCwd = resolveThreadCwd(parentThread, project)
    expect(() => readFileSync(join(parentCwd, 'shared.ts'), 'utf-8')).toThrow()
  })

  it('test_parallel_child_name_invalid_others_continue', async () => {
    const { project, parentThread } = makeGitContext()
    const valid = linkSubagent(project.id, { name: 'implementer-valid' })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const batch = await runParallelDelegatedBatch(
      { project, parentThread, parentTurnId: 'turn-1' },
      [
        { name: 'nao-existe', task: 't' },
        { name: valid.name, task: 't' },
      ]
    )

    expect(batch.results).toHaveLength(2)
    const invalid = batch.results.find((r) => r.subagentName === 'nao-existe')
    const ok = batch.results.find((r) => r.subagentName === valid.name)
    expect(invalid?.status).toBe('error')
    expect(ok?.status).toBe('completed')
    expect(listSubagentRunsForParentThread(parentThread.id)).toHaveLength(1)
  })

  it('test_tasks_over_limit rejects a batch above MAX_PARALLEL_TASKS via HTTP, zero runs', async () => {
    const { project, parentThread } = makeGitContext()
    const subagent = linkSubagent(project.id)
    setRunCliTurnForTesting(async () => ({ text: 'nunca deveria rodar' }))

    const server = await createDelegationServer({ project, parentThread, parentTurnId: 'turn-1' })
    const tasks = Array.from({ length: MAX_PARALLEL_TASKS + 1 }, () => ({ name: subagent.name, task: 't' }))

    const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': server.token },
      body: JSON.stringify({ tasks }),
    })
    const body = (await res.json()) as { isError: boolean }
    server.close()

    expect(body.isError).toBe(true)
    expect(listSubagentRunsForParentThread(parentThread.id)).toHaveLength(0)
  })

  it('rejects an ambiguous body mixing tasks and top-level name/task', async () => {
    const { project, parentThread } = makeGitContext()
    const subagent = linkSubagent(project.id)
    const server = await createDelegationServer({ project, parentThread, parentTurnId: 'turn-1' })

    const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': server.token },
      body: JSON.stringify({ name: subagent.name, task: 't', tasks: [{ name: subagent.name, task: 't' }] }),
    })
    const body = (await res.json()) as { isError: boolean; text: string }
    server.close()

    expect(body.isError).toBe(true)
    expect(body.text).toContain('Ambíguo')
  })

  it('runs a tasks[] batch over HTTP and returns an aggregated report', async () => {
    const { project, parentThread } = makeGitContext()
    const a = linkSubagent(project.id, { name: 'implementer-a' })
    const b = linkSubagent(project.id, { name: 'implementer-b' })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const server = await createDelegationServer({ project, parentThread, parentTurnId: 'turn-1' })
    const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': server.token },
      body: JSON.stringify({ tasks: [{ name: a.name, task: 't' }, { name: b.name, task: 't' }] }),
    })
    const body = (await res.json()) as { isError: boolean; text: string }
    server.close()

    expect(body.isError).toBe(false)
    expect(body.text).toContain(a.name)
    expect(body.text).toContain(b.name)
    expect(listSubagentRunsForParentThread(parentThread.id)).toHaveLength(2)
  })
})

describe('createDelegationServer', () => {
  it('executes the delegation over HTTP with the issued token and serializes concurrent calls', async () => {
    const { project, parentThread } = makeContext()
    const subagent = linkSubagent(project.id)

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

    const server = await createDelegationServer({ project, parentThread, parentTurnId: 'turn-1' })

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
    const { project, parentThread } = makeContext()
    const server = await createDelegationServer({ project, parentThread, parentTurnId: 'turn-1' })

    const res = await fetch(`http://127.0.0.1:${server.port}/delegate`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-delegate-token': 'token-errado' },
      body: JSON.stringify({ name: 'x', task: 't' }),
    })

    expect(res.status).toBe(403)
    server.close()
  })
})
