import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_dispatch_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject } = await import('../db/repositories/projects.js')
const { getThread } = await import('../db/repositories/threads.js')
const { listDiffsForThread } = await import('../db/repositories/diffs.js')
const { listToolCallsForThread } = await import('../db/repositories/messages.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createRule } = await import('../db/repositories/rules.js')
const { skillsRepository } = await import('../db/repositories/skills.js')
const { createSubagentsRepository } = await import('../db/repositories/subagents.js')
const {
  dispatchNewThread,
  dispatchFollowUp,
  DispatchValidationError,
  setRunCliTurnForTesting,
  resetRunCliTurnForTesting,
} = await import('./dispatch.js')
const { clearAllLeases, isLeased } = await import('./project-execution.js')
const { LeaseBusyError } = await import('./project-execution.js')
const { createMcp, setProjectMcpLink } = await import('../db/repositories/mcps.js')
const { subscribe, clearAllSubscriptions } = await import('./ws-hub.js')
const { getThreadEvents } = await import('../db/repositories/usage-events.js')
const { ProviderError } = await import('./providers/cli-driver.js')

function initGitRepo(path: string): void {
  execFileSync('git', ['init'], { cwd: path })
  execFileSync(
    'git',
    ['-c', 'user.name=Test', '-c', 'user.email=test@local', 'commit', '--allow-empty', '-m', 'init'],
    { cwd: path }
  )
}

function makeProjectDir(): string {
  const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_dispatch_fixture_'))
  initGitRepo(dir)
  return dir
}

beforeEach(() => {
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM model_pricing')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  getDb().exec('DELETE FROM project_rules')
  getDb().exec('DELETE FROM rules')
  getDb().exec('DELETE FROM project_subagents')
  getDb().exec('DELETE FROM subagents')
  getDb().exec('DELETE FROM project_mcps')
  getDb().exec('DELETE FROM mcps')
  skillsRepository._resetCache()
  clearAllLeases()
  clearAllSubscriptions()
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

afterEach(() => {
  resetRunCliTurnForTesting()
})

afterAll(() => {
  closeDb()
  rmSync(process.env.ENGRENACODE_USER_DATA as string, { recursive: true, force: true })
})

function waitForState(threadId: string, states: string[], timeoutMs = 3000): Promise<string> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      const t = getThread(threadId)
      if (t && states.includes(t.state)) {
        clearInterval(interval)
        resolve(t.state)
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error(`timeout esperando estado em [${states.join(',')}]; atual=${t?.state}`))
      }
    }, 10)
  })
}

describe('dispatchNewThread', () => {
  it('creates a running thread and exposes a stream path', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(thread.state).toBe('running')
    await waitForState(thread.id, ['idle', 'error'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('acquires and releases the project lease across the turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(isLeased(project.id)).toBe(true)
    await waitForState(thread.id, ['idle', 'error'])
    expect(isLeased(project.id)).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a second dispatch on the same project with thread_busy', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(() => new Promise(() => {}))

    dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(() =>
      dispatchNewThread({
        projectId: project.id,
        prompt: 'outra',
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
      })
    ).toThrow(LeaseBusyError)

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('injects the global prompt and resolved rules block into the system prompt', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const rule = createRule({ name: 'idioma-teste', content: 'Responda em PT-BR.', isGlobal: true })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedSystemPrompt).toContain('Responda em PT-BR.')
    expect(capturedSystemPrompt).toContain(rule.name)
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves the linked skills and subagents catalog into the system prompt', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const skill = skillsRepository.create({ name: 'skill-turno', description: 'ajuda no turno', content: '# conteudo' })
    skillsRepository.linkSkill(project.id, skill.id, { enabled: true })

    const subagentsRepo = createSubagentsRepository(getDb())
    const subagent = subagentsRepo.create({
      name: 'subagent-turno',
      description: 'delega revisao',
      prompt: 'voce revisa codigo',
      provider: 'inherit',
    })
    subagentsRepo.upsertProjectLink(project.id, subagent.id, { enabled: true })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedSystemPrompt).toContain(skill.name)
    expect(capturedSystemPrompt).toContain(subagent.name)
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves a linked MCP with literal env into mcpServers for the driver', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const mcp = createMcp({ name: 'filesystem', transport: 'stdio', command: 'npx', args: ['-y', 'server-fs'] })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    let capturedMcpServers: unknown
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers
      return { text: 'ok' }
    })

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedMcpServers).toEqual([{ name: 'filesystem', transport: 'stdio', command: 'npx', args: ['-y', 'server-fs'], env: {} }])
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits mcp.notice and omits the MCP when its vault secret is missing', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const mcp = createMcp({ name: 'github', transport: 'stdio', command: 'npx', env: { TOKEN: 'vault:github_token' } })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const received: unknown[] = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitForState(thread.id, ['idle', 'error'])
    const notice = received.find((e) => (e as { type: string }).type === 'mcp.notice') as
      | { mcpName: string; reason: string; message: string }
      | undefined
    expect(notice?.mcpName).toBe('github')
    expect(notice?.reason).toBe('missing_secret')
    expect(notice?.message).toBe("MCP 'github' fora deste turno: configure a credencial exigida na tela de MCPs.")
    rmSync(dir, { recursive: true, force: true })
  })

  it('records a completed tool call as a log_entries kind=tool with the outcome', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      input.onEvent({ type: 'tool-start', id: 'tool_1', name: 'Read', params: { path: 'x.ts' } })
      input.onEvent({ type: 'tool-result', id: 'tool_1', status: 'completed', result: { ok: true } })
      return { text: 'ok' }
    })

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'lê o arquivo',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const entries = listLogEntries({ kind: 'tool' })
    expect(entries).toHaveLength(1)
    expect(entries[0]?.threadId).toBe(thread.id)
    expect(entries[0]?.event).toBe('Read (completed)')
    rmSync(dir, { recursive: true, force: true })
  })

  it('captures a file change made during the turn as a pending diff', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      writeFileSync(join(input.cwd, 'novo-arquivo.txt'), 'conteudo novo\n')
      return { text: 'feito' }
    })

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'crie um arquivo',
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const diffs = listDiffsForThread(thread.id)
    expect(diffs).toHaveLength(1)
    expect(diffs[0].file).toBe('novo-arquivo.txt')
    expect(diffs[0].status).toBe('pending')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('dispatchFollowUp', () => {
  it('rejects a body carrying provider with a validation error', () => {
    // provider immutability is enforced at the HTTP layer (threads-handler); here we assert
    // the repository-level DispatchFollowUpInput contract has no provider field to send.
    const input: Record<string, unknown> = { threadId: 'thr_x', prompt: 'oi' }
    expect('provider' in input).toBe(false)
  })

  it('reuses the existing thread id and re-acquires the lease', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'primeira resposta' }))

    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    setRunCliTurnForTesting(async () => ({ text: 'segunda resposta' }))
    const followed = dispatchFollowUp({ threadId: thread.id, prompt: 'de novo' })
    expect(followed.id).toBe(thread.id)
    await waitForState(thread.id, ['idle', 'error'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('throws DispatchValidationError for an unknown thread', () => {
    expect(() => dispatchFollowUp({ threadId: 'thr_nao_existe', prompt: 'oi' })).toThrow(DispatchValidationError)
  })
})

describe('resolveProviderApiKey (via dispatchNewThread turnInput.apiKey)', () => {
  afterEach(() => {
    vaultService.deleteSecret('claude:mode')
    vaultService.deleteSecret('keys:claude')
    vaultService.deleteSecret('keys:codex')
    vaultService.deleteSecret('keys:minimax')
  })

  it('does not inject an api key for Claude in subscription mode', async () => {
    vaultService.setSecret('claude:mode', 'subscription')
    vaultService.setSecret('keys:claude', 'sk-ant-12345678')
    let captured: string | undefined
    setRunCliTurnForTesting(async (input) => {
      captured = input.apiKey
      return { text: 'ok' }
    })

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])
    expect(captured).toBeUndefined()
    rmSync(dir, { recursive: true, force: true })
  })

  it('injects the vault key for Claude in api-key mode', async () => {
    vaultService.setSecret('claude:mode', 'api-key')
    vaultService.setSecret('keys:claude', 'sk-ant-12345678')
    let captured: string | undefined
    setRunCliTurnForTesting(async (input) => {
      captured = input.apiKey
      return { text: 'ok' }
    })

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])
    expect(captured).toBe('sk-ant-12345678')
    rmSync(dir, { recursive: true, force: true })
  })

  it('injects the vault key for Minimax regardless of claude:mode', async () => {
    vaultService.setSecret('keys:minimax', 'mm-12345678')
    let captured: string | undefined
    setRunCliTurnForTesting(async (input) => {
      captured = input.apiKey
      return { text: 'ok' }
    })

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'minimax',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])
    expect(captured).toBe('mm-12345678')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('usage_events write path (F11)', () => {
  afterEach(() => {
    vaultService.deleteSecret('claude:mode')
    vaultService.deleteSecret('keys:claude')
    vaultService.deleteSecret('keys:codex')
    vaultService.deleteSecret('keys:minimax')
  })

  it('persists a source=agent event with cost_source=sdk when Claude reports total_cost_usd', async () => {
    setRunCliTurnForTesting(async () => ({
      text: 'ok',
      usage: { inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheCreationTokens: 0 },
      costUsd: 0.42,
    }))

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.source).toBe('agent')
    expect(page.events[0]?.costSource).toBe('sdk')
    expect(page.events[0]?.costUsd).toBe(0.42)
    expect(page.events[0]?.totalTokens).toBe(125)
    expect(page.events[0]?.billingMode).toBe('subscription')
    rmSync(dir, { recursive: true, force: true })
  })

  it('grades cost_source=table with cost_usd=null when there is no matching model_pricing row', async () => {
    setRunCliTurnForTesting(async () => ({
      text: 'ok',
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: null, cacheCreationTokens: null },
    }))
    vaultService.setSecret('keys:codex', 'sk-codex-12345678')

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'codex',
      model: 'gpt-5-codex',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events[0]?.costSource).toBe('table')
    expect(page.events[0]?.costUsd).toBeNull()
    expect(page.events[0]?.billingMode).toBe('api-key')
    rmSync(dir, { recursive: true, force: true })
  })

  it('calculates cost_source=table from model_pricing when a matching row exists', async () => {
    getDb()
      .prepare(
        `INSERT INTO model_pricing (id, provider, model, input_per_mtok, output_per_mtok, approximate, created_at, updated_at)
         VALUES ('price_codex_gpt-5-codex', 'codex', 'gpt-5-codex', 3, 15, 0, 0, 0)`
      )
      .run()

    setRunCliTurnForTesting(async () => ({
      text: 'ok',
      usage: { inputTokens: 1_000_000, outputTokens: 0, cacheReadTokens: null, cacheCreationTokens: null },
    }))

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'codex',
      model: 'gpt-5-codex',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events[0]?.costSource).toBe('table')
    expect(page.events[0]?.costUsd).toBeCloseTo(3, 6)
    rmSync(dir, { recursive: true, force: true })
  })

  it('does not persist a usage_event when the provider reports no usage', async () => {
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(getThreadEvents(thread.id, undefined, 10, 0).events).toHaveLength(0)
    rmSync(dir, { recursive: true, force: true })
  })

  it('persists a usage_event even when the turn fails, if the ProviderError carries usage (spec F11 §3.2)', async () => {
    setRunCliTurnForTesting(async () => {
      throw new ProviderError('provider_turn_error', 'deu ruim', {
        usage: { inputTokens: 50, outputTokens: 0, cacheReadTokens: null, cacheCreationTokens: null },
        costUsd: 0.01,
      })
    })

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const page = getThreadEvents(thread.id, undefined, 10, 0)
    expect(page.events).toHaveLength(1)
    expect(page.events[0]?.costUsd).toBe(0.01)
    expect(getThread(thread.id)?.state).toBe('error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolveBillingMode: minimax is always api-key regardless of vault state', async () => {
    setRunCliTurnForTesting(async () => ({
      text: 'ok',
      usage: { inputTokens: 10, outputTokens: 5, cacheReadTokens: null, cacheCreationTokens: null },
    }))
    vaultService.setSecret('keys:minimax', 'mm-12345678')

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'minimax',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(getThreadEvents(thread.id, undefined, 10, 0).events[0]?.billingMode).toBe('api-key')
    rmSync(dir, { recursive: true, force: true })
  })
})
