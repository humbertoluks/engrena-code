import { afterAll, afterEach, beforeEach, describe, expect, it } from 'vitest'
import { execFileSync } from 'child_process'
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from 'fs'
import { tmpdir } from 'os'
import { join } from 'path'

process.env.ENGRENACODE_USER_DATA = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_dispatch_'))

const { getDb, closeDb } = await import('../db/client.js')
const { createProject, setMemoryEnabled } = await import('../db/repositories/projects.js')
const { getThread, listThreadsForProject, createThread } = await import('../db/repositories/threads.js')
const { listDiffsForThread } = await import('../db/repositories/diffs.js')
const { listToolCallsForThread, listMessagesForThread } = await import('../db/repositories/messages.js')
const { listLogEntries } = await import('../db/repositories/log-entries.js')
const { vaultService } = await import('../vault/vault-service.js')
const { createRule } = await import('../db/repositories/rules.js')
const { createSkill, linkSkill } = await import('../db/repositories/skills.js')
const { createChatMode } = await import('../db/repositories/prompt-library.js')
const { createSubagent, upsertProjectSubagentLink } = await import('../db/repositories/subagents.js')
const {
  dispatchNewThread,
  dispatchFollowUp,
  DispatchValidationError,
  cancelThread,
  setRunCliTurnForTesting,
  resetRunCliTurnForTesting,
} = await import('./dispatch.js')
const { clearAllLeases, isLeased, acquireLease } = await import('./project-execution.js')
const { ASK_USER_QUESTION_TOOL_NAME } = await import('./ask-user-question.js')
const { updateThread } = await import('../db/repositories/threads.js')
const { LeaseBusyError } = await import('./project-execution.js')
const { createMcp, setProjectMcpLink } = await import('../db/repositories/mcps.js')
const { subscribe, clearAllSubscriptions } = await import('./ws-hub.js')
const {
  setRunCliTurnForTesting: setFollowupRunCliTurnForTesting,
  resetRunCliTurnForTesting: resetFollowupRunCliTurnForTesting,
} = await import('../threads/followups.js')
const { clearAllFollowupsForTesting } = await import('../threads/followups-cache.js')
const { resolvePermissionGate: resolvePermissionRequest, hasOpenPermissionGate: hasPendingPermission } =
  await import('./gate.js')
const { getThreadEvents, createUsageEvent } = await import('../db/repositories/usage-events.js')
const { upsertUsageLimit } = await import('../db/repositories/usage-limits.js')
const { ProviderError } = await import('./providers/cli-driver.js')
const { readJournal, appendEntry } = await import('../vault/memory-service.js')
const {
  setRunCliTurnForTesting: setDelegateRunCliTurnForTesting,
  resetRunCliTurnForTesting: resetDelegateRunCliTurnForTesting,
} = await import('./delegate.js')
const { listPipelinesForThread } = await import('../db/repositories/pipelines.js')

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
  // Sugestões são geradas por um processo de provider próprio (fora do stub do dispatch): sem este
  // stub o fim de turno de qualquer teste com assinante do stream spawna o CLI real.
  setFollowupRunCliTurnForTesting(async () => ({ text: '[]' }))
  clearAllFollowupsForTesting()
  getDb().exec('DELETE FROM log_entries')
  getDb().exec('DELETE FROM diffs')
  getDb().exec('DELETE FROM tool_calls')
  getDb().exec('DELETE FROM messages')
  getDb().exec('DELETE FROM usage_events')
  getDb().exec('DELETE FROM model_pricing')
  getDb().exec('DELETE FROM usage_limits')
  getDb().exec('DELETE FROM threads')
  getDb().exec('DELETE FROM projects')
  getDb().exec('DELETE FROM project_rules')
  getDb().exec('DELETE FROM rules')
  getDb().exec('DELETE FROM project_subagents')
  getDb().exec('DELETE FROM subagents')
  getDb().exec('DELETE FROM project_mcps')
  getDb().exec('DELETE FROM mcps')
  getDb().exec('DELETE FROM project_skills')
  getDb().exec('DELETE FROM skills')
  clearAllLeases()
  clearAllSubscriptions()
  vaultService.lock()
  vaultService.unlock('workspace-teste', 'senha-forte-123')
})

afterEach(() => {
  resetRunCliTurnForTesting()
  resetDelegateRunCliTurnForTesting()
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

function waitFor(predicate: () => boolean, timeoutMs = 3000): Promise<void> {
  return new Promise((resolve, reject) => {
    const start = Date.now()
    const interval = setInterval(() => {
      if (predicate()) {
        clearInterval(interval)
        resolve()
      } else if (Date.now() - start > timeoutMs) {
        clearInterval(interval)
        reject(new Error('timeout esperando condição'))
      }
    }, 10)
  })
}

describe('dispatchNewThread', () => {
  it('creates a running thread and exposes a stream path', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(thread.state).toBe('running')
    expect(thread.title).toBe('oi')
    await waitForState(thread.id, ['idle', 'error'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('sets title from the first line of a multi-line solicitation', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'Crie um projeto Node.js com Express\n- GET /todos\n- POST /todos',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(thread.title).toBe('Crie um projeto Node.js com Express')
    await waitForState(thread.id, ['idle', 'error'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('acquires and releases the project lease across the turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
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

    void dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await expect(
      dispatchNewThread({
        projectId: project.id,
        prompt: 'outra',
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'main',
      })
    ).rejects.toThrow(LeaseBusyError)

    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('injects the global prompt and resolved rules block into the system prompt', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const rule = createRule({
      name: 'idioma-teste',
      content: 'Responda em PT-BR.',
      isGlobal: true,
    })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitFor(() => capturedSystemPrompt !== undefined)
    expect(capturedSystemPrompt).toContain('Responda em PT-BR.')
    expect(capturedSystemPrompt).toContain(rule.name)
    expect(capturedSystemPrompt).toContain('Never kill processes by generic name')
    expect(capturedSystemPrompt).toContain('npx kill-port')
    await waitForState(thread.id, ['idle', 'error'])
    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves the linked skills and subagents catalog into the system prompt', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const skill = createSkill({
      name: 'skill-turno',
      description: 'ajuda no turno',
      content: '# conteudo',
    })
    linkSkill(project.id, skill.id, { enabled: true })

    const subagent = createSubagent({
      name: 'subagent-turno',
      description: 'delega revisao',
      prompt: 'voce revisa codigo',
      provider: 'inherit',
    })
    upsertProjectSubagentLink(project.id, subagent.id, { enabled: true })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedSystemPrompt).toContain(skill.name)
    expect(capturedSystemPrompt).toContain('mcp__engrenacode__load_skill')
    expect(capturedSystemPrompt).toContain(subagent.name)
    rmSync(dir, { recursive: true, force: true })
  })

  it('registers the engrenacode MCP with load_skill when a skill is linked', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const skill = createSkill({
      name: 'skill-mcp',
      description: 'd',
      content: '# body',
    })
    linkSkill(project.id, skill.id, { enabled: true })

    let capturedMcpServers: Array<{ name: string; args?: string[] }> | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers as Array<{ name: string; args?: string[] }>
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const internal = capturedMcpServers?.find((m) => m.name === 'engrenacode')
    expect(internal).toBeDefined()
    expect(internal?.args?.includes('--skills-snapshot')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits mcp.notice for load_skill when provider is minimax', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const skill = createSkill({
      name: 'skill-mini',
      description: 'd',
      content: '# body',
    })
    linkSkill(project.id, skill.id, { enabled: true })
    // MCP vinculado força `await prepareMcpsForDispatch` antes do notice de skills,
    // dando tempo do subscribe registrar (mesmo padrão do teste missing_secret).
    const mcp = createMcp({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-fs'],
    })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    let capturedMcpServers: Array<{ name: string }> | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers as Array<{ name: string }>
      return { text: 'ok' }
    })

    // dispatchNewThread é async agora (worktree awaited antes do turno — F13), mas para
    // executionMode=main ainda não tem nenhum await até `void runTurn(...)`: chamar sem
    // `await` mantém o mesmo timing síncrono de antes (thread já existe no retorno da chamada).
    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'minimax',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: unknown[] = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedMcpServers?.some((m) => m.name === 'engrenacode')).toBeFalsy()
    const notice = received.find(
      (e) =>
        (e as { type: string; mcpName?: string }).type === 'mcp.notice' &&
        (e as { mcpName?: string }).mcpName === 'engrenacode'
    ) as { mcpName: string; reason: string } | undefined
    expect(notice?.reason).toBe('provider_unsupported')
    rmSync(dir, { recursive: true, force: true })
  })

  it('resolves a linked MCP with literal env into mcpServers for the driver', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const mcp = createMcp({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-fs'],
    })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    let capturedMcpServers: unknown
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const servers = capturedMcpServers as Array<{ name: string; transport: string; command: string; args?: string[]; env?: Record<string, string> }>
    expect(servers[0]).toEqual({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-fs'],
      env: {},
    })
    // F19: every turn that can use MCP also mounts engrenacode with --codegraph-index when an index exists.
    const engrenacode = servers.find((m) => m.name === 'engrenacode')
    expect(engrenacode?.transport).toBe('stdio')
    expect(engrenacode?.args?.includes('--codegraph-index')).toBe(true)
    expect(engrenacode?.env?.ELECTRON_RUN_AS_NODE).toBe('1')
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits mcp.notice and omits the MCP when its vault secret is missing', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    const mcp = createMcp({
      name: 'github',
      transport: 'stdio',
      command: 'npx',
      env: { TOKEN: 'vault:github_token' },
    })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: unknown[] = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await dispatchPromise
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
      input.onEvent({
        type: 'tool-result',
        id: 'tool_1',
        status: 'completed',
        result: { ok: true },
      })
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
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

  it('Sprint 1 — permission-native-denial persists diagnosis + WS without command body', async () => {
    const { nativeDenialDiagnosis } = await import('./providers/permission-contract.js')
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const diagnosis = nativeDenialDiagnosis('Bash', 'mode')
    const sensitiveCommand = 'sleep 30'

    let releaseGate: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })

    setRunCliTurnForTesting(async (input) => {
      await gate
      input.onEvent({
        type: 'hook-started',
        hookId: 'hook_1',
        hookEvent: 'PreToolUse',
        hookName: 'permission-broker',
      })
      input.onEvent({
        type: 'hook-response',
        hookId: 'hook_1',
        hookEvent: 'PreToolUse',
        hookName: 'permission-broker',
        outcome: 'success',
        exitCode: 0,
      })
      // Provider already strips tool_input; synthetic event must not carry command.
      input.onEvent({
        type: 'permission-native-denial',
        toolName: 'Bash',
        toolUseId: 'toolu_bg_bash_001',
        decisionReasonType: 'mode',
        message: diagnosis,
      })
      return { text: 'Preciso de aprovação no modal.' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'roda em background',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: unknown[] = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])
    releaseGate?.()

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    const denial = received.find((e) => (e as { type: string }).type === 'permission.native_denial') as
      | {
          type: string
          toolName: string
          code: string
          message: string
          toolUseId?: string
          decisionReasonType?: string | null
        }
      | undefined
    expect(denial).toBeDefined()
    expect(denial?.code).toBe('permission_native_denial')
    expect(denial?.toolName).toBe('Bash')
    expect(denial?.message).toBe(diagnosis)
    expect(denial?.toolUseId).toBe('toolu_bg_bash_001')
    expect(denial?.decisionReasonType).toBe('mode')

    const toolLogs = listLogEntries({ kind: 'tool' })
    expect(toolLogs.some((e) => e.event === diagnosis)).toBe(true)
    expect(toolLogs.some((e) => e.event.includes('hook started: permission-broker'))).toBe(true)
    expect(toolLogs.some((e) => e.event.includes('hook response: permission-broker'))).toBe(true)

    const wire = JSON.stringify({ received, logs: toolLogs.map((e) => e.event) })
    expect(wire).not.toContain(sensitiveCommand)
    expect(wire).not.toContain('tool_input')
    expect(wire).toContain(diagnosis)

    rmSync(dir, { recursive: true, force: true })
  })

  it('test_dispatch_toolStart_askUserQuestion_sets_waiting_user / test_dispatch_toolResult_askUserQuestion_restores_running (F21)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let releaseGate: (() => void) | undefined
    const gate = new Promise<void>((resolve) => {
      releaseGate = resolve
    })

    setRunCliTurnForTesting(async (input) => {
      input.onEvent({
        type: 'tool-start',
        id: 'ask_1',
        name: 'mcp__engrenacode__ask_user_question',
        params: { prompt: 'Qual caminho seguir?', options: ['A', 'B'] },
      })
      await gate
      input.onEvent({ type: 'tool-result', id: 'ask_1', status: 'completed', result: { text: 'A' } })
      return { text: 'ok' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'preciso de uma decisão',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<{ type: string; state?: string }> = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitForState(thread.id, ['waiting_user'])
    expect(getThread(thread.id)?.state).toBe('waiting_user')

    releaseGate?.()
    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    const states = received.filter((e) => e.type === 'state.change').map((e) => e.state)
    const waitingIdx = states.indexOf('waiting_user')
    const runningIdx = states.indexOf('running')
    expect(waitingIdx).toBeGreaterThanOrEqual(0)
    expect(runningIdx).toBeGreaterThan(waitingIdx)
    rmSync(dir, { recursive: true, force: true })
  })

  it('test_dispatch_minimax_notice_mentions_ask_user_question (F21) — fires even with no skills linked', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    // MCP vinculado força `await prepareMcpsForDispatch` antes do notice, dando tempo do
    // subscribe registrar (mesmo padrão do teste missing_secret/load_skill acima) — sem nenhuma
    // skill vinculada, para confirmar que o notice dispara mesmo sem catálogo.
    const mcp = createMcp({
      name: 'filesystem',
      transport: 'stdio',
      command: 'npx',
      args: ['-y', 'server-fs'],
    })
    setProjectMcpLink(project.id, mcp.id, { enabled: true })

    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'minimax',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: unknown[] = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    const notice = received.find(
      (e) =>
        (e as { type: string; mcpName?: string }).type === 'mcp.notice' &&
        (e as { mcpName?: string }).mcpName === 'engrenacode'
    ) as { mcpName: string; reason: string; message: string } | undefined
    expect(notice?.reason).toBe('provider_unsupported')
    expect(notice?.message).toContain('ask_user_question')
    rmSync(dir, { recursive: true, force: true })
  })

  it('captures a file change made during the turn as a pending diff', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      writeFileSync(join(input.cwd, 'novo-arquivo.txt'), 'conteudo novo\n')
      return { text: 'feito' }
    })

    const thread = await dispatchNewThread({
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

describe('F20 memória — write_memory wiring', () => {
  it('PRD AC2 — next turn of the same project receives the previous journal in the system prompt', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const priorThread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    appendEntry({ projectId: project.id, threadId: priorThread.id, summary: 'decisão do turno anterior' })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'continue de onde paramos',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedSystemPrompt).toContain('EngrenaCode Memory')
    expect(capturedSystemPrompt).toContain('decisão do turno anterior')
    rmSync(dir, { recursive: true, force: true })
  })

  it('PRD AC4 — a corrupted journal does not fail the turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    vaultService.setSecret(`memory:${project.id}`, 'not a journal at all')

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const state = await waitForState(thread.id, ['idle', 'error'])
    expect(state).toBe('idle')
    expect(capturedSystemPrompt).not.toContain('EngrenaCode Memory')
    const entries = listLogEntries({ kind: 'task' })
    expect(entries.some((e) => e.event === 'memory: journal corrompido, tratado como vazio')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('registers the engrenacode MCP with memory-port/memory-token when memory is enabled (default)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedMcpServers: Array<{ name: string; args?: string[] }> | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers as Array<{ name: string; args?: string[] }>
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const internal = capturedMcpServers?.find((m) => m.name === 'engrenacode')
    expect(internal?.args?.includes('--memory-port')).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })

  it('omits memory-port/memory-token when the project toggle is off', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setMemoryEnabled(project.id, false)

    let capturedMcpServers: Array<{ name: string; args?: string[] }> | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedMcpServers = input.mcpServers as Array<{ name: string; args?: string[] }>
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    const internal = capturedMcpServers?.find((m) => m.name === 'engrenacode')
    expect(internal?.args?.includes('--memory-port')).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('runTurn_writeMemoryToolAppendsEntry — provider calling write_memory over the real loopback appends a journal entry without any extra LLM call', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let runCliTurnCallCount = 0
    setRunCliTurnForTesting(async (input) => {
      runCliTurnCallCount++
      const internal = (input.mcpServers as Array<{ name: string; args?: string[] }>)?.find(
        (m) => m.name === 'engrenacode'
      )
      const args = internal?.args ?? []
      const memoryPort = args[args.indexOf('--memory-port') + 1]
      const memoryToken = args[args.indexOf('--memory-token') + 1]

      const res = await fetch(`http://127.0.0.1:${memoryPort}/memory-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-memory-token': memoryToken },
        body: JSON.stringify({ summary: 'decisão registrada pelo provider' }),
      })
      const body = (await res.json()) as { isError: boolean }
      expect(body.isError).toBe(false)

      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'grave uma memória',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(runCliTurnCallCount).toBe(1)
    expect(readJournal(project.id).content).toContain('decisão registrada pelo provider')
    rmSync(dir, { recursive: true, force: true })
  })

  it('emits memory.entry over the ws-hub when a write_memory call lands', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      const internal = (input.mcpServers as Array<{ name: string; args?: string[] }>)?.find(
        (m) => m.name === 'engrenacode'
      )
      const args = internal?.args ?? []
      const memoryPort = args[args.indexOf('--memory-port') + 1]
      const memoryToken = args[args.indexOf('--memory-token') + 1]

      await fetch(`http://127.0.0.1:${memoryPort}/memory-entry`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-memory-token': memoryToken },
        body: JSON.stringify({ summary: 'entrada com evento' }),
      })

      return { text: 'ok' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'grave uma memória',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<{ type: string; projectId?: string }> = []
    const fakeSocket = {
      readyState: 1,
      OPEN: 1,
      send: (data: string) => received.push(JSON.parse(data)),
    }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    const event = received.find((e) => e.type === 'memory.entry')
    expect(event?.projectId).toBe(project.id)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('dispatchNewThread worktree mode (F13)', () => {
  it('creates the worktree, persists worktreePath, and runs the turn with cwd=worktreePath', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedCwd: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedCwd = input.cwd
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'worktree',
    })

    expect(thread.worktreePath).toBeTruthy()
    expect(thread.worktreePath).not.toBe(project.path)

    await waitForState(thread.id, ['idle', 'error'])
    expect(capturedCwd).toBe(thread.worktreePath)
    expect(getThread(thread.id)?.worktreePath).toBe(thread.worktreePath)

    rmSync(dir, { recursive: true, force: true })
    rmSync(thread.worktreePath as string, { recursive: true, force: true })
  })

  it('rejects with worktree_git_required and never spawns the turn when the project has no git HEAD', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'engrenacode_claude_f03_dispatch_nogit_'))
    const project = createProject({ path: dir })

    let cliCalled = false
    setRunCliTurnForTesting(async () => {
      cliCalled = true
      return { text: 'nao deveria rodar' }
    })

    await expect(
      dispatchNewThread({
        projectId: project.id,
        prompt: 'oi',
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'worktree',
      })
    ).rejects.toMatchObject({ code: 'worktree_git_required' })

    expect(cliCalled).toBe(false)
    expect(isLeased(project.id)).toBe(false)
    const [thread] = listThreadsForProject(project.id)
    expect(thread.state).toBe('error')
    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects with worktree_create_failed and never runs the turn in project.path when `git worktree add` fails', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    // Occupa o segmento <projectId> com um arquivo (não diretório) sob userData/worktrees/,
    // fazendo `git worktree add` falhar de verdade independente do threadId (imprevisível de antemão).
    const worktreesBase = join(process.env.ENGRENACODE_USER_DATA as string, 'worktrees')
    mkdirSync(worktreesBase, { recursive: true })
    const blockedProjectDir = join(worktreesBase, project.id)
    writeFileSync(blockedProjectDir, 'bloqueando o diretório do projeto de propósito')

    let cliCalled = false
    setRunCliTurnForTesting(async (input) => {
      cliCalled = true
      // Se isso rodar, o turno vazou pra project.path por engano — nunca deveria acontecer.
      expect(input.cwd).not.toBe(project.path)
      return { text: 'nao deveria rodar' }
    })

    await expect(
      dispatchNewThread({
        projectId: project.id,
        prompt: 'oi',
        provider: 'claude',
        accessLevel: 'supervised',
        executionMode: 'worktree',
      })
    ).rejects.toMatchObject({ code: 'worktree_create_failed' })

    expect(cliCalled).toBe(false)
    expect(isLeased(project.id)).toBe(false)
    const [thread] = listThreadsForProject(project.id)
    expect(thread.state).toBe('error')
    expect(thread.worktreePath).toBeNull()

    rmSync(dir, { recursive: true, force: true })
    rmSync(blockedProjectDir, { force: true })
  })

  it('skips worktree creation and keeps cwd=project.path for executionMode=main', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedCwd: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedCwd = input.cwd
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(thread.worktreePath).toBeNull()
    expect(capturedCwd).toBe(project.path)
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

    const thread = await dispatchNewThread({
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

  it('persists Claude session_id and passes resumeSessionId on follow-up', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const calls: Array<{ resumeSessionId?: string | null }> = []

    setRunCliTurnForTesting(async (input) => {
      calls.push({ resumeSessionId: input.resumeSessionId })
      return { text: 'primeira', sessionId: 'sess-from-cli' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'crie um todo',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])
    expect(calls[0]?.resumeSessionId == null || calls[0]?.resumeSessionId === '').toBe(true)
    expect(getThread(thread.id)?.cliSessionId).toBe('sess-from-cli')

    setRunCliTurnForTesting(async (input) => {
      calls.push({ resumeSessionId: input.resumeSessionId })
      return { text: 'segunda', sessionId: 'sess-from-cli' }
    })
    dispatchFollowUp({ threadId: thread.id, prompt: 'continue' })
    await waitForState(thread.id, ['idle', 'error'])
    expect(calls[1]?.resumeSessionId).toBe('sess-from-cli')
    rmSync(dir, { recursive: true, force: true })
  })

  it('throws DispatchValidationError for an unknown thread', () => {
    expect(() => dispatchFollowUp({ threadId: 'thr_nao_existe', prompt: 'oi' })).toThrow(DispatchValidationError)
  })
})

describe('F16 composer avançado — reasoning + images no dispatch', () => {
  it('test_create_thread_persists_reasoning_and_model', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      model: 'claude-opus-4-1',
      reasoningLevel: 'high',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    expect(thread.model).toBe('claude-opus-4-1')
    expect(thread.reasoningLevel).toBe('high')
    await waitForState(thread.id, ['idle', 'error'])
    expect(getThread(thread.id)?.reasoningLevel).toBe('high')
    rmSync(dir, { recursive: true, force: true })
  })

  it('test_follow_up_updates_model_and_reasoning', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'primeira' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'codex',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    setRunCliTurnForTesting(async () => ({ text: 'segunda' }))
    const followed = dispatchFollowUp({
      threadId: thread.id,
      prompt: 'de novo',
      model: 'gpt-5.1-codex',
      reasoningLevel: 'max',
    })

    expect(followed.model).toBe('gpt-5.1-codex')
    expect(followed.reasoningLevel).toBe('max')
    await waitForState(thread.id, ['idle', 'error'])
    rmSync(dir, { recursive: true, force: true })
  })

  it('test_user_message_persists_image_blocks', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'veja este print',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
      images: [{ mimeType: 'image/png', name: 'screenshot.png', dataBase64: 'aGVsbG8=' }],
    })
    await waitForState(thread.id, ['idle', 'error'])

    const userMessage = listMessagesForThread(thread.id).find((m) => m.role === 'user')
    expect(userMessage?.blocks).toEqual([
      { type: 'image', mimeType: 'image/png', name: 'screenshot.png', dataBase64: 'aGVsbG8=' },
    ])
    rmSync(dir, { recursive: true, force: true })
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
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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
      usage: {
        inputTokens: 1_000_000,
        outputTokens: 0,
        cacheReadTokens: null,
        cacheCreationTokens: null,
      },
    }))

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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
        usage: {
          inputTokens: 50,
          outputTokens: 0,
          cacheReadTokens: null,
          cacheCreationTokens: null,
        },
        costUsd: 0.01,
      })
    })

    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = await dispatchNewThread({
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
    const thread = await dispatchNewThread({
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

describe('cancelThread on an abandoned thread (F21 PRD AC4)', () => {
  it('cancels a waiting_user thread whose turn is gone, releasing the project lease', () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    // Turno morto sem passar pelo cleanup: estado pendente na base e lease ainda retida.
    updateThread(thread.id, { state: 'waiting_user' })
    acquireLease(project.id, 'agent', 'turn', thread.id)

    expect(cancelThread(thread.id)).toBe(true)
    expect(getThread(thread.id)?.state).toBe('cancelled')
    expect(isLeased(project.id)).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('never releases a lease held by another thread', () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const abandoned = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    const other = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    updateThread(abandoned.id, { state: 'waiting_user' })
    acquireLease(project.id, 'agent', 'turn', other.id)

    expect(cancelThread(abandoned.id)).toBe(true)
    expect(getThread(abandoned.id)?.state).toBe('cancelled')
    expect(isLeased(project.id)).toBe(true)

    rmSync(dir, { recursive: true, force: true })
  })

  it('reports nothing to cancel for a thread that already settled', () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    updateThread(thread.id, { state: 'committed' })

    expect(cancelThread(thread.id)).toBe(false)
    expect(getThread(thread.id)?.state).toBe('committed')

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('dispatch — slash commands (F22)', () => {
  it('rejects an invalid slash before creating a thread or acquiring the lease', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    await expect(
      dispatchNewThread({
        projectId: project.id,
        prompt: '/foo bar',
        provider: 'claude',
        accessLevel: 'full-access',
        executionMode: 'main',
      })
    ).rejects.toMatchObject({ code: 'slash_unknown' })

    expect(listThreadsForProject(project.id)).toHaveLength(0)
    expect(isLeased(project.id)).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('rejects a follow-up slash with missing args as 400-shaped DispatchValidationError, thread stays untouched', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'full-access', executionMode: 'main' })
    updateThread(thread.id, { state: 'idle' })

    expect(() => dispatchFollowUp({ threadId: thread.id, prompt: '/spec' })).toThrowError(
      expect.objectContaining({ code: 'slash_missing_args' })
    )
    expect(getThread(thread.id)?.state).toBe('idle')
    expect(isLeased(project.id)).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('routes a valid /spec to the pipeline runner instead of a normal turn', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const planner = createSubagent({ name: 'planner', description: 'planeja', prompt: 'Você é o planner.', provider: 'inherit' })
    upsertProjectSubagentLink(project.id, planner.id, { enabled: true })

    setDelegateRunCliTurnForTesting(async () => ({ text: '## spec.md\nx\n\n## plan.md\ny' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: '/spec Adicionar autenticação',
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['idle', 'error'])
    expect(getThread(thread.id)?.state).toBe('idle')
    const pipelines = listPipelinesForThread(thread.id)
    expect(pipelines).toHaveLength(1)
    expect(pipelines[0].command).toBe('spec')
    expect(pipelines[0].status).toBe('completed')

    rmSync(dir, { recursive: true, force: true })
  })

  it('cancelThread cancels an in-flight pipeline', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    for (const name of ['planner', 'implementer', 'reviewer', 'tester']) {
      const s = createSubagent({ name, description: `d ${name}`, prompt: `Você é o ${name}.`, provider: 'inherit' })
      upsertProjectSubagentLink(project.id, s.id, { enabled: true })
    }

    setDelegateRunCliTurnForTesting(async (input) => {
      // Fake fiel ao driver real: o processo real é morto quando o signal aborta (mesmo mecanismo
      // que já sustenta o cancel de turno normal em dispatch.ts) — sem isso o teste não valida nada.
      await new Promise<void>((resolve, reject) => {
        const timer = setTimeout(resolve, 300)
        input.signal?.addEventListener(
          'abort',
          () => {
            clearTimeout(timer)
            reject(new Error('processo abortado'))
          },
          { once: true }
        )
      })
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: '/featdevelop Adicionar algo',
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })

    await waitForState(thread.id, ['running'])
    expect(cancelThread(thread.id)).toBe(true)
    await waitForState(thread.id, ['cancelled', 'error'])
    expect(getThread(thread.id)?.state).toBe('cancelled')
    expect(listPipelinesForThread(thread.id)[0]?.status).toBe('cancelled')

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('usage limit gate (F25)', () => {
  it('dispatch_block_returns_409 — rejects a new thread when the project limit is blocked', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const thread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 10,
      costSource: 'sdk',
    })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'block' })

    await expect(
      dispatchNewThread({ projectId: project.id, prompt: 'oi', provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    ).rejects.toThrow('Limite de consumo atingido')
    expect(isLeased(project.id)).toBe(false)

    rmSync(dir, { recursive: true, force: true })
  })

  it('dispatch_warn_allows_turn — same spend with mode warn does not block', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const seedThread = createThread({ projectId: project.id, provider: 'claude', accessLevel: 'supervised', executionMode: 'main' })
    createUsageEvent({
      turnId: 't1',
      projectId: project.id,
      threadId: seedThread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 10,
      costSource: 'sdk',
    })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'warn' })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
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

  it('also blocks a follow-up dispatch on an already-over-limit project', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))
    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    createUsageEvent({
      turnId: 't2',
      projectId: project.id,
      threadId: thread.id,
      source: 'agent',
      provider: 'claude',
      billingMode: 'subscription',
      inputTokens: 1,
      outputTokens: 1,
      costUsd: 10,
      costSource: 'sdk',
    })
    upsertUsageLimit({ scope: 'project', projectId: project.id, limitUsd: 10, mode: 'block' })

    expect(() => dispatchFollowUp({ threadId: thread.id, prompt: 'de novo' })).toThrow('Limite de consumo atingido')

    rmSync(dir, { recursive: true, force: true })
  })
})

describe('PermissionBroker (supervised) — F21-like flow pro nível "Supervised"', () => {
  it('emits permission.request over WS, blocks the hook (--settings) até POST /permission resolver com allow', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedAllow: boolean | undefined
    let capturedPort: number | undefined
    let capturedToken: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedPort = input.permissionPort
      capturedToken = input.permissionToken
      const res = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
        body: JSON.stringify({ toolName: 'Write', toolInput: { file_path: 'x.txt' } }),
      })
      const body = (await res.json()) as { allow: boolean }
      capturedAllow = body.allow
      return { text: 'ok' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitFor(() => received.some((e) => e.type === 'permission.request'))
    const req = received.find((e) => e.type === 'permission.request') as { requestId: string; toolName: string }
    expect(req.toolName).toBe('Write')
    expect(getThread(thread.id)?.state).toBe('waiting_permission')
    expect(received.some((e) => e.type === 'state.change' && e.state === 'waiting_permission')).toBe(true)

    expect(resolvePermissionRequest(thread.id, req.requestId, true).ok).toBe(true)
    expect(getThread(thread.id)?.state).toBe('running')

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedPort).toBeDefined()
    expect(capturedToken).toBeTruthy()
    expect(capturedAllow).toBe(true)
    // `permission.resolved` só é emitido pelo handler HTTP (threads-handler.ts), não por
    // `resolvePermissionRequest` em si — coberto em threads-handler.test.ts (fluxo end-to-end).

    rmSync(dir, { recursive: true, force: true })
  })

  it('deny explícito (POST /permission allow=false) devolve allow:false pro hook', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedAllow: boolean | undefined
    setRunCliTurnForTesting(async (input) => {
      const res = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
        body: JSON.stringify({ toolName: 'Bash', toolInput: { command: 'rm -rf /' } }),
      })
      const body = (await res.json()) as { allow: boolean }
      capturedAllow = body.allow
      return { text: 'ok' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitFor(() => received.some((e) => e.type === 'permission.request'))
    const req = received.find((e) => e.type === 'permission.request') as { requestId: string }
    expect(resolvePermissionRequest(thread.id, req.requestId, false).ok).toBe(true)

    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedAllow).toBe(false)
    rmSync(dir, { recursive: true, force: true })
  })

  it('cancelar a thread durante permissão pendente limpa o broker e assenta em cancelled', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      const res = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
        body: JSON.stringify({ toolName: 'Write', toolInput: {} }),
        signal: input.signal,
      })
      const body = (await res.json()) as { allow: boolean }
      return { text: body.allow ? 'ok' : 'negado' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'supervised',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitFor(() => received.some((e) => e.type === 'permission.request'))
    expect(hasPendingPermission(thread.id)).toBe(true)

    // Deny + close servers BEFORE abort — pending limpa na hora (não só no finally).
    expect(cancelThread(thread.id)).toBe(true)
    expect(hasPendingPermission(thread.id)).toBe(false)
    expect(getThread(thread.id)?.state).toBe('stopping')

    await dispatchPromise
    await waitForState(thread.id, ['cancelled', 'idle', 'error'])

    expect(hasPendingPermission(thread.id)).toBe(false)
    expect(getThread(thread.id)?.state).toBe('cancelled')

    rmSync(dir, { recursive: true, force: true })
  })

  it('cancel durante tool running marca a tool call como cancelled (não fica running)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async (input) => {
      input.onEvent({ type: 'tool-start', id: 'bash-1', name: 'Bash', params: { command: 'sleep 999' } })
      await new Promise<void>((resolve, reject) => {
        if (input.signal?.aborted) {
          reject(new Error('aborted'))
          return
        }
        input.signal?.addEventListener('abort', () => reject(new Error('aborted')), { once: true })
      })
      return { text: 'nunca' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    await waitFor(() => listToolCallsForThread(thread.id).some((tc) => tc.status === 'running'))

    expect(cancelThread(thread.id)).toBe(true)
    expect(listToolCallsForThread(thread.id).every((tc) => tc.status !== 'running')).toBe(true)
    expect(listToolCallsForThread(thread.id)[0]?.status).toBe('cancelled')

    await dispatchPromise.catch(() => {})
    await waitForState(thread.id, ['cancelled', 'idle', 'error'])
    expect(getThread(thread.id)?.state).toBe('cancelled')

    rmSync(dir, { recursive: true, force: true })
  })

  it('cancel durante ask_user_question rejeita a pergunta pendente antes do abort', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    const { hasPendingQuestion, waitForAnswer } = await import('./ask-user-question.js')

    let askRejected = false
    setRunCliTurnForTesting(async (input) => {
      input.onEvent({
        type: 'tool-start',
        id: 'ask-1',
        name: ASK_USER_QUESTION_TOOL_NAME,
        params: { question: 'Continuar?' },
      })
      const [thr] = listThreadsForProject(project.id)
      const askPromise = waitForAnswer(thr.id).then(
        () => {
          askRejected = false
        },
        () => {
          askRejected = true
        }
      )
      await waitFor(() => hasPendingQuestion(thr.id))
      await new Promise<void>((resolve, reject) => {
        if (input.signal?.aborted) {
          reject(new Error('aborted'))
          return
        }
        input.signal?.addEventListener(
          'abort',
          () => {
            void askPromise
            reject(new Error('aborted'))
          },
          { once: true }
        )
      })
      return { text: 'nunca' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    await waitFor(() => hasPendingQuestion(thread.id))

    expect(cancelThread(thread.id)).toBe(true)
    expect(hasPendingQuestion(thread.id)).toBe(false)

    await dispatchPromise.catch(() => {})
    await waitForState(thread.id, ['cancelled', 'idle', 'error'])
    expect(askRejected).toBe(true)
    expect(getThread(thread.id)?.state).toBe('cancelled')

    rmSync(dir, { recursive: true, force: true })
  })

  it('não cria PermissionBroker em full-access (bypassPermissions não precisa de porta)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedPort: number | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedPort = input.permissionPort
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'full-access',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedPort).toBeUndefined()
    rmSync(dir, { recursive: true, force: true })
  })

  it('auto-accept-edits monta o broker: Write passa sem UI e Bash abre permission.request', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let writeAllowed: boolean | undefined
    let bashAllowed: boolean | undefined
    setRunCliTurnForTesting(async (input) => {
      const ask = async (toolName: string, toolInput: unknown): Promise<boolean> => {
        const res = await fetch(`http://127.0.0.1:${input.permissionPort}/permission`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'x-permission-token': input.permissionToken ?? '' },
          body: JSON.stringify({ toolName, toolInput }),
        })
        return ((await res.json()) as { allow: boolean }).allow
      }
      writeAllowed = await ask('Write', { file_path: 'x.txt' })
      bashAllowed = await ask('Bash', { command: 'npm install' })
      return { text: 'ok' }
    })

    const dispatchPromise = dispatchNewThread({
      projectId: project.id,
      prompt: 'instala as deps',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })

    const [thread] = listThreadsForProject(project.id)
    const received: Array<Record<string, unknown>> = []
    const fakeSocket = { readyState: 1, OPEN: 1, send: (data: string) => received.push(JSON.parse(data)) }
    subscribe(thread.id, fakeSocket as unknown as Parameters<typeof subscribe>[1])

    await waitFor(() => received.some((e) => e.type === 'permission.request'))
    const req = received.find((e) => e.type === 'permission.request') as { requestId: string; toolName: string }
    // Só o Bash pediu: edição de arquivo é auto-aceita pelo nível, sem modal.
    expect(req.toolName).toBe('Bash')
    expect(received.filter((e) => e.type === 'permission.request')).toHaveLength(1)

    expect(resolvePermissionRequest(thread.id, req.requestId, true).ok).toBe(true)
    await dispatchPromise
    await waitForState(thread.id, ['idle', 'error'])

    expect(writeAllowed).toBe(true)
    expect(bashAllowed).toBe(true)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('anexos de contexto do composer', () => {
  it('lê o arquivo anexado no turno e põe o bloco de contexto antes do pedido', async () => {
    const dir = makeProjectDir()
    writeFileSync(join(dir, 'alvo.ts'), 'export const alvo = 42\n')
    const project = createProject({ path: dir })

    let capturedPrompt = ''
    setRunCliTurnForTesting(async (input) => {
      capturedPrompt = input.prompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'explique este arquivo',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      contextAttachments: [{ kind: 'file', path: 'alvo.ts' }],
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedPrompt).toContain('## Contexto anexado pelo usuário')
    expect(capturedPrompt).toContain('alvo.ts')
    expect(capturedPrompt).toContain('export const alvo = 42')
    expect(capturedPrompt.indexOf('alvo.ts')).toBeLessThan(capturedPrompt.indexOf('explique este arquivo'))
    rmSync(dir, { recursive: true, force: true })
  })

  it('persiste só o que o usuário digitou, com os anexos como blocks da mensagem', async () => {
    const dir = makeProjectDir()
    writeFileSync(join(dir, 'alvo.ts'), 'export const alvo = 42\n')
    const project = createProject({ path: dir })
    setRunCliTurnForTesting(async () => ({ text: 'ok' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'explique este arquivo',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      contextAttachments: [
        { kind: 'file', path: 'alvo.ts' },
        { kind: 'selection', path: 'alvo.ts', text: 'const alvo = 42', startLine: 1, endLine: 1 },
      ],
    })
    await waitForState(thread.id, ['idle', 'error'])

    const userMessage = listMessagesForThread(thread.id).find((m) => m.role === 'user')
    expect(userMessage?.content).toBe('explique este arquivo')
    const blocks = (userMessage?.blocks ?? []) as Array<Record<string, unknown>>
    expect(blocks).toHaveLength(2)
    expect(blocks[0]).toMatchObject({ type: 'context', kind: 'file', path: 'alvo.ts', label: 'alvo.ts' })
    expect(blocks[1]).toMatchObject({ type: 'context', kind: 'selection', label: 'alvo.ts:1-1' })
    rmSync(dir, { recursive: true, force: true })
  })

  it('ignora anexo com path inseguro ou arquivo inexistente sem derrubar o turno', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedPrompt = ''
    setRunCliTurnForTesting(async (input) => {
      capturedPrompt = input.prompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'siga',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      contextAttachments: [
        { kind: 'file', path: '../fora.ts' },
        { kind: 'file', path: 'nao-existe.ts' },
      ],
    })
    const finalState = await waitForState(thread.id, ['idle', 'error'])

    expect(finalState).toBe('idle')
    expect(capturedPrompt).toBe('siga')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('pergunta ao usuário', () => {
  it('manda o agente usar a tool ask_user_question em vez de perguntar em prosa', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedSystemPrompt).toContain('## Decisões do usuário')
    expect(capturedSystemPrompt).toContain(ASK_USER_QUESTION_TOOL_NAME)
    rmSync(dir, { recursive: true, force: true })
  })

  it('provider sem MCP não recebe a instrução (a tool não existe lá)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'grok',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedSystemPrompt).not.toContain('## Decisões do usuário')
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('tools internas sempre liberadas', () => {
  it('passa ask_user_question/load_skill/call_subagent em alwaysAllowedTools sob auto-accept-edits', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let captured: string[] | undefined
    setRunCliTurnForTesting(async (input) => {
      captured = input.alwaysAllowedTools
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(captured).toContain(ASK_USER_QUESTION_TOOL_NAME)
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('decisão detectada na resposta', () => {
  it('resposta que termina pedindo autorização grava o bloco de decisão na mensagem', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async () => ({
      text: 'Preciso rodar npm install para baixar as dependências. Posso prosseguir?',
    }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'suba o servidor',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const assistant = listMessagesForThread(thread.id).find((m) => m.role === 'assistant')
    expect(assistant?.blocks).toEqual([
      { type: 'decision', question: 'Posso prosseguir?', options: ['Sim, pode prosseguir', 'Não, aguarde'] },
    ])
    rmSync(dir, { recursive: true, force: true })
  })

  it('resposta sem pergunta no fim não ganha bloco', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    setRunCliTurnForTesting(async () => ({ text: 'Servidor criado em server.js.' }))

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'crie o servidor',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
    })
    await waitForState(thread.id, ['idle', 'error'])

    const assistant = listMessagesForThread(thread.id).find((m) => m.role === 'assistant')
    expect(assistant?.blocks).toBeNull()
    rmSync(dir, { recursive: true, force: true })
  })
})

describe('modo de chat (F28 §3.4)', () => {
  it('injeta as instruções do modo salvo no system prompt e guarda o nome na thread', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    createChatMode({
      projectId: project.id,
      name: 'revisor',
      instructions: 'Só revise, nunca edite arquivo.',
    })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      chatMode: 'revisor',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(getThread(thread.id)?.chatMode).toBe('revisor')
    expect(capturedSystemPrompt).toContain('## Modo de chat: revisor')
    expect(capturedSystemPrompt).toContain('Só revise, nunca edite arquivo.')
    rmSync(dir, { recursive: true, force: true })
  })

  it('modo versionado no repo vale igual ao salvo no banco', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    mkdirSync(join(dir, '.engrena', 'modes'), { recursive: true })
    writeFileSync(join(dir, '.engrena', 'modes', 'do-repo.chatmode.md'), 'Fale como arquiteto.')

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      chatMode: 'do-repo',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedSystemPrompt).toContain('Fale como arquiteto.')
    rmSync(dir, { recursive: true, force: true })
  })

  it('follow-up retomado leva o bloco do modo no prompt do turno (--resume ignora system prompt novo)', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })
    createChatMode({
      projectId: project.id,
      name: 'conciso',
      instructions: 'Responda em uma linha.',
    })
    const thread = createThread({
      projectId: project.id,
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      state: 'idle',
    })
    updateThread(thread.id, { cliSessionId: 'sessao-antiga' })

    let capturedPrompt = ''
    setRunCliTurnForTesting(async (input) => {
      capturedPrompt = input.prompt
      return { text: 'ok' }
    })

    dispatchFollowUp({ threadId: thread.id, prompt: 'e agora?', chatMode: 'conciso' })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedPrompt).toContain('## Modo de chat: conciso')
    expect(capturedPrompt).toContain('Responda em uma linha.')
    expect(capturedPrompt.endsWith('e agora?')).toBe(true)
    clearAllLeases()
    rmSync(dir, { recursive: true, force: true })
  })

  it('turno sem modo não ganha bloco nenhum e nome desconhecido é ignorado', async () => {
    const dir = makeProjectDir()
    const project = createProject({ path: dir })

    let capturedSystemPrompt: string | undefined
    setRunCliTurnForTesting(async (input) => {
      capturedSystemPrompt = input.systemPrompt
      return { text: 'ok' }
    })

    const thread = await dispatchNewThread({
      projectId: project.id,
      prompt: 'oi',
      provider: 'claude',
      accessLevel: 'auto-accept-edits',
      executionMode: 'main',
      chatMode: 'inexistente',
    })
    await waitForState(thread.id, ['idle', 'error'])

    expect(capturedSystemPrompt).not.toContain('## Modo de chat')
    rmSync(dir, { recursive: true, force: true })
  })
})
