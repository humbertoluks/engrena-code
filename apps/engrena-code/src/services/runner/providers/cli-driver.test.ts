import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
import { existsSync, readdirSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import {
  ProviderError,
  buildPermissionHookCommand,
  resetPermissionSettingsBuilderForTesting,
  resetSpawnForTesting,
  runCliTurn,
  setPermissionSettingsBuilderForTesting,
  setSpawnForTesting,
} from './cli-driver'
import { resetFetchForTesting, setFetchForTesting } from './minimax-driver'
import { resetFetchForTesting as resetGlmFetch, setFetchForTesting as setGlmFetch } from './glm-driver'
import { resetFetchForTesting as resetGrokFetch, setFetchForTesting as setGrokFetch } from './grok-driver'
import type { ProviderStreamEvent, ProviderTurnInput } from './provider-types'
import {
  HOOK_COMMAND_TIMEOUT_SEC,
  INCLUDE_HOOK_EVENTS_FLAG,
  checkSupervisedPermissionArgs,
  validatePermissionSettingsShape,
} from './permission-contract.js'
import {
  resetKillProcessTreeForTesting,
  setKillProcessTreeForTesting,
  type KillProcessTreeOptions,
} from '../process-kill.js'

type SpawnFn = Parameters<typeof setSpawnForTesting>[0]

function expectUnderTurnArtifacts(path: string): void {
  expect(dirname(path)).toBe(join(process.env.ENGRENACODE_USER_DATA as string, 'tmp'))
}

class FakeChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
  pid: number | undefined
  kill(): void {
    this.killed = true
  }
}

function baseInput(overrides: Partial<ProviderTurnInput> = {}): ProviderTurnInput {
  return {
    provider: 'claude',
    cwd: '/tmp/project',
    prompt: 'oi',
    accessLevel: 'supervised',
    onEvent: () => {},
    ...overrides,
  }
}

function emitResultAndClose(child: FakeChild, text: string, code = 0): void {
  child.stdout.write(`${JSON.stringify({ type: 'result', result: text, is_error: false })}\n`)
  queueMicrotask(() => {
    child.stdout.end()
    child.emit('close', code)
  })
}

afterEach(() => {
  resetSpawnForTesting()
  resetPermissionSettingsBuilderForTesting()
  resetFetchForTesting()
  resetGlmFetch()
  resetGrokFetch()
  resetKillProcessTreeForTesting()
})

describe('runCliTurn — cli providers', () => {
  it('spawns the binary and resolves the final text from the result line', async () => {
    let capturedArgs: string[] = []
    let capturedOptions: { cwd?: string; env?: Record<string, string | undefined> } = {}
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[], opts: unknown) => {
      capturedArgs = args
      capturedOptions = opts as typeof capturedOptions
      const child = new FakeChild()
      emitResultAndClose(child, 'pong')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const result = await runCliTurn(baseInput())
    expect(result.text).toBe('pong')
    expect(result.sessionId).toBeNull()
    expect(capturedArgs).toContain('-p')
    expect(capturedOptions.cwd).toBe('/tmp/project')
  })

  it('passes --resume when Claude has a resumeSessionId and returns session_id from the result', async () => {
    let capturedArgs: string[] = []
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[], _opts: unknown) => {
      capturedArgs = args
      const child = new FakeChild()
      child.stdout.write(
        `${JSON.stringify({ type: 'result', result: 'cont', is_error: false, session_id: 'sess-abc-123' })}\n`
      )
      queueMicrotask(() => {
        child.stdout.end()
        child.emit('close', 0)
      })
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const result = await runCliTurn(baseInput({ resumeSessionId: 'sess-abc-123' }))
    expect(result).toMatchObject({ text: 'cont', sessionId: 'sess-abc-123' })
    const resumeIdx = capturedArgs.indexOf('--resume')
    expect(resumeIdx).toBeGreaterThan(-1)
    expect(capturedArgs[resumeIdx + 1]).toBe('sess-abc-123')
  })

  it('does not pass --resume for non-claude providers even with resumeSessionId', async () => {
    let capturedArgs: string[] = []
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[], _opts: unknown) => {
      capturedArgs = args
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await runCliTurn(baseInput({ provider: 'codex', resumeSessionId: 'sess-x' }))
    expect(capturedArgs).not.toContain('--resume')
  })

  it('injects ANTHROPIC_API_KEY when Claude runs with an api key', async () => {
    let capturedEnv: Record<string, string | undefined> | undefined
    const fakeSpawn: SpawnFn = ((_bin: string, _args: string[], opts: unknown) => {
      capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await runCliTurn(baseInput({ apiKey: 'sk-ant-12345678' }))
    expect(capturedEnv?.ANTHROPIC_API_KEY).toBe('sk-ant-12345678')
  })

  it('does not inject any api key env var when apiKey is absent', async () => {
    let capturedEnv: Record<string, string | undefined> | undefined
    const fakeSpawn: SpawnFn = ((_bin: string, _args: string[], opts: unknown) => {
      capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await runCliTurn(baseInput())
    expect(capturedEnv).not.toBe(process.env)
    expect(capturedEnv?.PATH).toBe(process.env.PATH)
    expect(capturedEnv?.ANTHROPIC_API_KEY).toBeUndefined()
  })

  it('strips an ambient ANTHROPIC_API_KEY from the spawned env when Claude runs in subscription mode', async () => {
    const previous = process.env.ANTHROPIC_API_KEY
    process.env.ANTHROPIC_API_KEY = 'sk-ant-leaked-from-parent-shell'
    try {
      let capturedEnv: Record<string, string | undefined> | undefined
      const fakeSpawn: SpawnFn = ((_bin: string, _args: string[], opts: unknown) => {
        capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())
      expect(capturedEnv?.ANTHROPIC_API_KEY).toBeUndefined()
    } finally {
      if (previous === undefined) delete process.env.ANTHROPIC_API_KEY
      else process.env.ANTHROPIC_API_KEY = previous
    }
  })

  it('does not inherit invented host env keys into the CLI spawn (R07)', async () => {
    const hostKey = 'ENGRENACODE_HOST_SECRET_FOR_TEST'
    const previous = process.env[hostKey]
    process.env[hostKey] = 'should-not-reach-child'
    try {
      let capturedEnv: Record<string, string | undefined> | undefined
      const fakeSpawn: SpawnFn = ((_bin: string, _args: string[], opts: unknown) => {
        capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())
      expect(capturedEnv?.[hostKey]).toBeUndefined()
      expect(capturedEnv?.PATH).toBe(process.env.PATH)
    } finally {
      if (previous === undefined) delete process.env[hostKey]
      else process.env[hostKey] = previous
    }
  })

  it('rejects with a ProviderError when spawn fails to start', async () => {
    const fakeSpawn: SpawnFn = (() => {
      const child = new FakeChild()
      queueMicrotask(() => child.emit('error', new Error('ENOENT')))
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await expect(runCliTurn(baseInput())).rejects.toBeInstanceOf(ProviderError)
  })

  it('sanitizes secrets in provider_spawn_failed messages (R03)', async () => {
    const leak =
      'ENOENT C:\\Users\\Me\\secrets\\vault.enc https://x-access-token:ghp_leakedsecret99@github.com/org/repo.git'
    const fakeSpawn: SpawnFn = (() => {
      const child = new FakeChild()
      queueMicrotask(() => child.emit('error', new Error(leak)))
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const err = await runCliTurn(baseInput()).catch((e) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).code).toBe('provider_spawn_failed')
    expect((err as ProviderError).message).not.toContain('ghp_leakedsecret99')
    expect((err as ProviderError).message).not.toContain('C:\\Users\\Me\\secrets\\vault.enc')
    expect((err as ProviderError).message).toMatch(/\*\*\*/)
  })

  it('writes a --mcp-config file under userData/tmp and deletes it after the process closes', async () => {
    let capturedArgs: string[] = []
    let writtenAtSpawnTime: string | undefined
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
      capturedArgs = args
      const flagIndex = args.indexOf('--mcp-config')
      if (flagIndex > -1) writtenAtSpawnTime = readFileSync(args[flagIndex + 1], 'utf-8')
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await runCliTurn(
      baseInput({
        mcpServers: [
          { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'server-github'], env: { TOKEN: 'ghp_x' } },
          { name: 'notion', transport: 'http', url: 'https://mcp.notion.com/mcp', headers: { Authorization: 'Bearer y' } },
        ],
      })
    )

    const flagIndex = capturedArgs.indexOf('--mcp-config')
    expect(flagIndex).toBeGreaterThan(-1)
    const configPath = capturedArgs[flagIndex + 1]
    expectUnderTurnArtifacts(configPath)
    const written = JSON.parse(writtenAtSpawnTime as string)
    expect(written.mcpServers.github).toEqual({ command: 'npx', args: ['-y', 'server-github'], env: { TOKEN: 'ghp_x' } })
    expect(written.mcpServers.notion).toEqual({ type: 'http', url: 'https://mcp.notion.com/mcp', headers: { Authorization: 'Bearer y' } })
    expect(existsSync(configPath)).toBe(false)
  })

  it('cleans up mcp-config when spawn throws synchronously', async () => {
    let configPath = ''
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
      const flagIndex = args.indexOf('--mcp-config')
      configPath = args[flagIndex + 1]
      expect(existsSync(configPath)).toBe(true)
      throw new Error('spawn sync boom')
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const err = await runCliTurn(
      baseInput({
        mcpServers: [
          { name: 'github', transport: 'stdio', command: 'npx', args: ['-y', 'server-github'], env: { TOKEN: 'ghp_x' } },
        ],
      })
    ).catch((e) => e)

    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).code).toBe('provider_spawn_failed')
    expectUnderTurnArtifacts(configPath)
    expect(existsSync(configPath)).toBe(false)
  })

  it('cleans up permission --settings when spawn throws synchronously (R11)', async () => {
    let settingsPath = ''
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
      const flagIndex = args.indexOf('--settings')
      settingsPath = args[flagIndex + 1]
      expect(existsSync(settingsPath)).toBe(true)
      throw new Error('spawn sync boom')
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const err = await runCliTurn(
      baseInput({ permissionPort: 4321, permissionToken: 'perm-token-abc' })
    ).catch((e) => e)

    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).code).toBe('provider_spawn_failed')
    expectUnderTurnArtifacts(settingsPath)
    expect(existsSync(settingsPath)).toBe(false)
  })

  describe('PermissionBroker (supervised) — --settings do hook PreToolUse', () => {
    it('writes a --settings file with PreToolUse + PermissionRequest hooks and sets ELECTRON_RUN_AS_NODE', async () => {
      let capturedArgs: string[] = []
      let capturedEnv: Record<string, string | undefined> | undefined
      let writtenAtSpawnTime: string | undefined
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[], opts: unknown) => {
        capturedArgs = args
        capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
        const flagIndex = args.indexOf('--settings')
        if (flagIndex > -1) writtenAtSpawnTime = readFileSync(args[flagIndex + 1], 'utf-8')
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput({ permissionPort: 4321, permissionToken: 'perm-token-abc' }))

      const flagIndex = capturedArgs.indexOf('--settings')
      expect(flagIndex).toBeGreaterThan(-1)
      const settingsPath = capturedArgs[flagIndex + 1]
      expectUnderTurnArtifacts(settingsPath)
      expect(existsSync(settingsPath)).toBe(false)

      const written = JSON.parse(writtenAtSpawnTime as string)
      const preTool = written.hooks.PreToolUse[0].hooks[0]
      const permReq = written.hooks.PermissionRequest[0].hooks[0]
      expect(preTool.type).toBe('command')
      expect(permReq.type).toBe('command')
      expect(preTool.command).toContain('--port 4321')
      expect(preTool.command).toContain('--token perm-token-abc')
      expect(permReq.command).toBe(preTool.command)
      if (process.platform === 'win32') {
        expect(preTool.command).toContain('permission-hook.cmd')
      } else {
        expect(preTool.command).toContain('ELECTRON_RUN_AS_NODE=1')
      }
      expect(capturedEnv?.ELECTRON_RUN_AS_NODE).toBe('1')

      // 'auto' é a única combinação onde o hook tem autoridade real (confirmado ao vivo contra
      // claude-code 2.1.226) — 'manual'/'dontAsk'/'default' negam por decision_reason_type=mode
      // antes do hook ser consultado, mesmo com permissionDecision:"allow" no stdout.
      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('auto')
      expect(capturedArgs).toContain(INCLUDE_HOOK_EVENTS_FLAG)
      expect(checkSupervisedPermissionArgs(capturedArgs).ok).toBe(true)
      expect(preTool.timeout).toBe(HOOK_COMMAND_TIMEOUT_SEC)
      expect(validatePermissionSettingsShape(written).ok).toBe(true)
    })

    it('omits --include-hook-events when supervised has no permission settings', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())
      expect(capturedArgs).not.toContain(INCLUDE_HOOK_EVENTS_FLAG)
      expect(capturedArgs).not.toContain('--settings')
    })

    it('forwards hook lifecycle and permission-native-denial events from stream-json lines', async () => {
      const seen: ProviderStreamEvent[] = []
      const fakeSpawn: SpawnFn = (() => {
        const child = new FakeChild()
        child.stdout.write(
          `${JSON.stringify({
            type: 'system',
            subtype: 'hook_started',
            hook_id: 'h1',
            hook_name: 'PreToolUse:Bash',
            hook_event: 'PreToolUse',
          })}\n`
        )
        child.stdout.write(
          `${JSON.stringify({
            type: 'system',
            subtype: 'permission_denied',
            tool_name: 'Bash',
            tool_use_id: 'toolu_1',
            decision_reason_type: 'mode',
          })}\n`
        )
        child.stdout.write(
          `${JSON.stringify({
            type: 'result',
            result: 'ok',
            is_error: false,
            permission_denials: [
              { tool_name: 'Bash', tool_use_id: 'toolu_1', tool_input: { command: 'sleep 99' } },
            ],
          })}\n`
        )
        queueMicrotask(() => {
          child.stdout.end()
          child.emit('close', 0)
        })
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(
        baseInput({
          permissionPort: 4321,
          permissionToken: 'perm-token-abc',
          onEvent: (event) => seen.push(event),
        })
      )

      expect(seen.some((e) => e.type === 'hook-started' && e.hookEvent === 'PreToolUse')).toBe(true)
      const denials = seen.filter((e) => e.type === 'permission-native-denial')
      expect(denials.length).toBeGreaterThanOrEqual(2)
      expect(JSON.stringify(denials)).not.toContain('sleep 99')
    })

    it('buildPermissionHookCommand embeds port/token (and ELECTRON_RUN_AS_NODE off Windows)', () => {
      const launcher = process.platform === 'win32' ? 'C:\\tmp\\permission-hook.cmd' : '/tmp/permission-hook.mjs'
      const cmd = buildPermissionHookCommand(launcher, 9, 'tok')
      expect(cmd).toContain('--port 9')
      expect(cmd).toContain('--token tok')
      if (process.platform === 'win32') {
        expect(cmd).toContain('permission-hook.cmd')
        expect(cmd).not.toContain('cmd /c set ELECTRON_RUN_AS_NODE')
      } else {
        expect(cmd).toContain('ELECTRON_RUN_AS_NODE=1')
      }
    })

    it('falls back to --permission-mode manual (fail-closed, no --settings) when supervised has no hook to attach', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())

      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('manual')
      expect(capturedArgs.indexOf('--settings')).toBe(-1)
    })

    it('attaches the hook in auto-accept-edits too (--permission-mode auto), porque acceptEdits nega Bash/MCP sem modal', async () => {
      let capturedArgs: string[] = []
      let capturedEnv: Record<string, string | undefined> | undefined
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[], opts: unknown) => {
        capturedArgs = args
        capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(
        baseInput({ accessLevel: 'auto-accept-edits', permissionPort: 4321, permissionToken: 'perm-token-abc' })
      )

      expect(capturedArgs.indexOf('--settings')).toBeGreaterThan(-1)
      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('auto')
      expect(capturedArgs).toContain(INCLUDE_HOOK_EVENTS_FLAG)
      expect(capturedEnv?.ELECTRON_RUN_AS_NODE).toBe('1')
    })

    it('keeps --permission-mode acceptEdits (no --settings) when auto-accept-edits has no broker', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput({ accessLevel: 'auto-accept-edits' }))

      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('acceptEdits')
      expect(capturedArgs.indexOf('--settings')).toBe(-1)
    })

    it('omits --settings in full-access (bypassPermissions), even with permissionPort/Token set', async () => {
      let capturedArgs: string[] = []
      let capturedEnv: Record<string, string | undefined> | undefined
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[], opts: unknown) => {
        capturedArgs = args
        capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(
        baseInput({ accessLevel: 'full-access', permissionPort: 4321, permissionToken: 'perm-token-abc' })
      )

      expect(capturedArgs.indexOf('--settings')).toBe(-1)
      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('bypassPermissions')
      expect(capturedEnv?.ELECTRON_RUN_AS_NODE).toBeUndefined()
    })

    it('omits --settings for a non-Claude provider even in supervised mode', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(
        baseInput({ provider: 'codex', accessLevel: 'supervised', permissionPort: 4321, permissionToken: 'perm-token-abc' })
      )

      expect(capturedArgs.indexOf('--settings')).toBe(-1)
    })

    it('omits --settings when permissionPort/Token are absent, even in supervised mode', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())

      expect(capturedArgs.indexOf('--settings')).toBe(-1)
    })
  })

  // A02: os validadores de contrato existiam só no harness unitário. Sem consumidor de produção,
  // uma regressão de shape só aparecia como o agente pedindo aprovação em prosa sobre um botão
  // que nunca chegou à tela.
  describe('gate de contrato de permissão (A02)', () => {
    function tmpArtifacts(): string[] {
      const dir = join(process.env.ENGRENACODE_USER_DATA as string, 'tmp')
      return existsSync(dir) ? readdirSync(dir).sort() : []
    }

    it('aborta o turno com permission_contract_violation antes de qualquer spawn quando o settings perde PermissionRequest', async () => {
      let spawnCalls = 0
      const fakeSpawn: SpawnFn = (() => {
        spawnCalls += 1
        const child = new FakeChild()
        emitResultAndClose(child, 'nunca deveria rodar')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)
      setPermissionSettingsBuilderForTesting((port, token) => ({
        hooks: {
          PreToolUse: [
            {
              matcher: '*',
              hooks: [
                {
                  type: 'command',
                  command: `"C:\\ud\\permission-hook.cmd" ELECTRON_RUN_AS_NODE=1 --port ${port} --token ${token}`,
                  timeout: HOOK_COMMAND_TIMEOUT_SEC,
                },
              ],
            },
          ],
        },
      }))

      const before = tmpArtifacts()
      const err = await runCliTurn(
        baseInput({
          permissionPort: 4321,
          permissionToken: 'perm-token-abc',
          mcpServers: [{ name: 'ctx', transport: 'stdio', command: 'node', args: ['s.js'] }],
          images: [{ mimeType: 'image/png', dataBase64: Buffer.from('x').toString('base64') }],
        })
      ).catch((e) => e)

      expect(spawnCalls).toBe(0)
      expect(err).toBeInstanceOf(ProviderError)
      expect((err as ProviderError).code).toBe('permission_contract_violation')
      expect((err as ProviderError).message).toContain('PermissionRequest')
      // Mensagem vai para UI e log: nunca pode carregar o command (que embute o token do broker).
      expect((err as ProviderError).message).not.toContain('perm-token-abc')
      // Settings, mcp-config e imagens nascem antes do gate e são limpos no caminho de erro.
      expect(tmpArtifacts()).toEqual(before)
    })

    it('deixa o turno supervised com broker montado passar pelo gate', async () => {
      let spawnCalls = 0
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        spawnCalls += 1
        expect(checkSupervisedPermissionArgs(args).ok).toBe(true)
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      const result = await runCliTurn(baseInput({ permissionPort: 4321, permissionToken: 'perm-token-abc' }))
      expect(result.text).toBe('ok')
      expect(spawnCalls).toBe(1)
    })

    it('não cobra o contrato quando o broker não foi montado (full-access)', async () => {
      let spawnCalls = 0
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        spawnCalls += 1
        expect(args.indexOf('--settings')).toBe(-1)
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)
      // Builder quebrado de propósito: sem broker montado ele nem é chamado.
      setPermissionSettingsBuilderForTesting(() => ({ hooks: {} }))

      const result = await runCliTurn(
        baseInput({ accessLevel: 'full-access', permissionPort: 4321, permissionToken: 'perm-token-abc' })
      )
      expect(result.text).toBe('ok')
      expect(spawnCalls).toBe(1)
    })
  })

  describe('F16 composer avançado — reasoning + images', () => {
    it('passes --effort with the raw level for low/medium/high/max', async () => {
      for (const level of ['low', 'medium', 'high', 'max']) {
        let capturedArgs: string[] = []
        const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
          capturedArgs = args
          const child = new FakeChild()
          emitResultAndClose(child, 'ok')
          return child as unknown as ReturnType<SpawnFn>
        }) as SpawnFn
        setSpawnForTesting(fakeSpawn)

        await runCliTurn(baseInput({ reasoningLevel: level }))
        const idx = capturedArgs.indexOf('--effort')
        expect(idx).toBeGreaterThan(-1)
        expect(capturedArgs[idx + 1]).toBe(level)
      }
    })

    it('maps the catalog "extra-high" level to the CLI "xhigh" value', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput({ reasoningLevel: 'extra-high' }))
      const idx = capturedArgs.indexOf('--effort')
      expect(capturedArgs[idx + 1]).toBe('xhigh')
    })

    it('omits --effort when reasoningLevel is absent', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())
      expect(capturedArgs).not.toContain('--effort')
    })

    it('materializes images under userData/tmp, references them in the prompt, and deletes them after close', async () => {
      let capturedArgs: string[] = []
      let promptDuringSpawn = ''
      let imagePathDuringSpawn = ''
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        promptDuringSpawn = args[args.indexOf('-p') + 1]
        const match = /- (.+\.png)/.exec(promptDuringSpawn)
        imagePathDuringSpawn = match ? match[1] : ''
        if (imagePathDuringSpawn) {
          expectUnderTurnArtifacts(imagePathDuringSpawn)
          expect(existsSync(imagePathDuringSpawn)).toBe(true)
        }
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(
        baseInput({ images: [{ mimeType: 'image/png', name: 'screenshot.png', dataBase64: 'aGVsbG8=' }] })
      )

      expect(promptDuringSpawn).toContain('Imagens anexadas')
      expect(imagePathDuringSpawn).not.toBe('')
      expect(existsSync(imagePathDuringSpawn)).toBe(false)
      expect(capturedArgs[capturedArgs.indexOf('-p') + 1]).toBe(promptDuringSpawn)
    })

    it('does not alter the prompt when there are no images', async () => {
      let capturedArgs: string[] = []
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        const child = new FakeChild()
        emitResultAndClose(child, 'ok')
        return child as unknown as ReturnType<SpawnFn>
      }) as SpawnFn
      setSpawnForTesting(fakeSpawn)

      await runCliTurn(baseInput())
      expect(capturedArgs[capturedArgs.indexOf('-p') + 1]).toBe('oi')
    })
  })

  it('omits --mcp-config when no MCPs are resolved', async () => {
    let capturedArgs: string[] = []
    const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
      capturedArgs = args
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await runCliTurn(baseInput())
    expect(capturedArgs).not.toContain('--mcp-config')
  })

  it('extracts usage and total_cost_usd from the result event on success (spec F11 §3.2)', async () => {
    const fakeSpawn: SpawnFn = (() => {
      const child = new FakeChild()
      child.stdout.write(
        `${JSON.stringify({
          type: 'result',
          result: 'pong',
          is_error: false,
          total_cost_usd: 0.0042,
          usage: { input_tokens: 100, output_tokens: 20, cache_read_input_tokens: 5, cache_creation_input_tokens: 0 },
        })}\n`
      )
      queueMicrotask(() => {
        child.stdout.end()
        child.emit('close', 0)
      })
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const result = await runCliTurn(baseInput())
    expect(result.usage).toEqual({ inputTokens: 100, outputTokens: 20, cacheReadTokens: 5, cacheCreationTokens: 0 })
    expect(result.costUsd).toBe(0.0042)
  })

  it('does not set usage/costUsd when the result event omits them (Codex/Kimi tolerance)', async () => {
    setSpawnForTesting((() => {
      const child = new FakeChild()
      emitResultAndClose(child, 'ok')
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn)

    const result = await runCliTurn(baseInput())
    expect(result.usage).toBeUndefined()
    expect(result.costUsd).toBeUndefined()
  })

  it('attaches usage/costUsd to the ProviderError when the result event reports is_error with usage (spec F11 §3.2)', async () => {
    const fakeSpawn: SpawnFn = (() => {
      const child = new FakeChild()
      child.stdout.write(
        `${JSON.stringify({
          type: 'result',
          result: 'deu ruim',
          is_error: true,
          total_cost_usd: 0.001,
          usage: { input_tokens: 50, output_tokens: 0, cache_read_input_tokens: null, cache_creation_input_tokens: null },
        })}\n`
      )
      queueMicrotask(() => {
        child.stdout.end()
        child.emit('close', 1)
      })
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    const err = await runCliTurn(baseInput()).catch((e) => e)
    expect(err).toBeInstanceOf(ProviderError)
    expect((err as ProviderError).usage).toEqual({
      inputTokens: 50,
      outputTokens: 0,
      cacheReadTokens: null,
      cacheCreationTokens: null,
    })
    expect((err as ProviderError).costUsd).toBe(0.001)
  })
})

describe('runCliTurn — minimax (http provider)', () => {
  it('delegates to the http driver instead of spawning a binary', async () => {
    let spawnCalled = false
    setSpawnForTesting((() => {
      spawnCalled = true
      return new FakeChild() as unknown as ReturnType<SpawnFn>
    }) as SpawnFn)

    setFetchForTesting(async () =>
      new Response(JSON.stringify({ choices: [{ message: { content: 'oi da minimax' } }] }), { status: 200 })
    )

    const result = await runCliTurn(baseInput({ provider: 'minimax', apiKey: 'mm-12345678' }))
    expect(result).toEqual({ text: 'oi da minimax' })
    expect(spawnCalled).toBe(false)
  })
})

describe('runCliTurn — glm/grok (http providers, F23)', () => {
  it('routes glm to glm-driver instead of spawning a binary', async () => {
    let spawnCalled = false
    setSpawnForTesting((() => {
      spawnCalled = true
      return new FakeChild() as unknown as ReturnType<SpawnFn>
    }) as SpawnFn)

    setGlmFetch(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'oi do glm' } }] }), { status: 200 }))

    const result = await runCliTurn(baseInput({ provider: 'glm', apiKey: 'abcdef01234.5678secretpart' }))
    expect(result).toEqual({ text: 'oi do glm' })
    expect(spawnCalled).toBe(false)
  })

  it('routes grok to grok-driver instead of spawning a binary', async () => {
    let spawnCalled = false
    setSpawnForTesting((() => {
      spawnCalled = true
      return new FakeChild() as unknown as ReturnType<SpawnFn>
    }) as SpawnFn)

    setGrokFetch(async () => new Response(JSON.stringify({ choices: [{ message: { content: 'oi do grok' } }] }), { status: 200 }))

    const result = await runCliTurn(baseInput({ provider: 'grok', apiKey: 'xai-abcdef0123456789' }))
    expect(result).toEqual({ text: 'oi do grok' })
    expect(spawnCalled).toBe(false)
  })
})

describe('runCliTurn — abort kills process tree', () => {
  it('calls killProcessTree with the child pid on abort', async () => {
    const killed: KillProcessTreeOptions[] = []
    setKillProcessTreeForTesting((opts) => {
      killed.push(opts)
    })

    const child = new FakeChild()
    child.pid = 55_001
    setSpawnForTesting((() => child as unknown as ReturnType<SpawnFn>) as SpawnFn)

    const controller = new AbortController()
    const turnPromise = runCliTurn(baseInput({ signal: controller.signal }))

    await new Promise((r) => setTimeout(r, 10))
    controller.abort()
    child.emit('close', 1)

    await expect(turnPromise).rejects.toBeInstanceOf(ProviderError)
    expect(killed).toEqual([{ pid: 55_001 }])
    expect(child.killed).toBe(false)
  })

  it('falls back to child.kill when pid is missing', async () => {
    const killed: KillProcessTreeOptions[] = []
    setKillProcessTreeForTesting((opts) => {
      killed.push(opts)
    })

    const child = new FakeChild()
    setSpawnForTesting((() => child as unknown as ReturnType<SpawnFn>) as SpawnFn)

    const controller = new AbortController()
    const turnPromise = runCliTurn(baseInput({ signal: controller.signal }))

    await new Promise((r) => setTimeout(r, 10))
    controller.abort()
    child.emit('close', 1)

    await expect(turnPromise).rejects.toBeInstanceOf(ProviderError)
    expect(killed).toEqual([])
    expect(child.killed).toBe(true)
  })

  it('caps stderrBuf so a flood cannot grow without bound', async () => {
    const child = new FakeChild()
    setSpawnForTesting((() => {
      queueMicrotask(() => {
        // One sync chunk over the 256KiB cap (multi-write floods can still be in the
        // PassThrough buffer when `close` fires in this fake).
        child.stderr.write('e'.repeat(300 * 1024))
        child.stdout.end()
        child.emit('close', 1)
      })
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn)

    const err = await runCliTurn(baseInput()).then(
      () => null,
      (e: unknown) => e
    )
    expect(err).toBeInstanceOf(ProviderError)
    const message = err instanceof ProviderError ? err.message : ''
    expect(message).toContain('stderr truncado pelo EngrenaCode')
    expect(Buffer.byteLength(message, 'utf8')).toBeLessThanOrEqual(256 * 1024 + 64)
  })
})

