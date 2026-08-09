import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
import { existsSync, readFileSync } from 'fs'
import { dirname, join } from 'path'
import { afterEach, describe, expect, it } from 'vitest'
import { ProviderError, resetSpawnForTesting, runCliTurn, setSpawnForTesting } from './cli-driver'
import { resetFetchForTesting, setFetchForTesting } from './minimax-driver'
import { resetFetchForTesting as resetGlmFetch, setFetchForTesting as setGlmFetch } from './glm-driver'
import { resetFetchForTesting as resetGrokFetch, setFetchForTesting as setGrokFetch } from './grok-driver'
import type { ProviderTurnInput } from './provider-types'

type SpawnFn = Parameters<typeof setSpawnForTesting>[0]

function expectUnderTurnArtifacts(path: string): void {
  expect(dirname(path)).toBe(join(process.env.ENGRENACODE_USER_DATA as string, 'tmp'))
}

class FakeChild extends EventEmitter {
  stdout = new PassThrough()
  stderr = new PassThrough()
  killed = false
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
  resetFetchForTesting()
  resetGlmFetch()
  resetGrokFetch()
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
    expect(result).toEqual({ text: 'pong' })
    expect(capturedArgs).toContain('-p')
    expect(capturedOptions.cwd).toBe('/tmp/project')
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

  it('rejects with a ProviderError when spawn fails to start', async () => {
    const fakeSpawn: SpawnFn = (() => {
      const child = new FakeChild()
      queueMicrotask(() => child.emit('error', new Error('ENOENT')))
      return child as unknown as ReturnType<SpawnFn>
    }) as SpawnFn
    setSpawnForTesting(fakeSpawn)

    await expect(runCliTurn(baseInput())).rejects.toBeInstanceOf(ProviderError)
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

  describe('PermissionBroker (supervised) — --settings do hook PreToolUse', () => {
    it('writes a --settings file with a PreToolUse hook pointing at the permission-hook script, and sets ELECTRON_RUN_AS_NODE', async () => {
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
      const hookEntry = written.hooks.PreToolUse[0].hooks[0]
      expect(hookEntry.type).toBe('command')
      expect(hookEntry.command).toContain('--port 4321')
      expect(hookEntry.command).toContain('--token perm-token-abc')
      expect(capturedEnv?.ELECTRON_RUN_AS_NODE).toBe('1')

      // 'auto' é a única combinação onde o hook tem autoridade real (confirmado ao vivo contra
      // claude-code 2.1.226) — 'manual'/'dontAsk'/'default' negam por decision_reason_type=mode
      // antes do hook ser consultado, mesmo com permissionDecision:"allow" no stdout.
      const modeIdx = capturedArgs.indexOf('--permission-mode')
      expect(capturedArgs[modeIdx + 1]).toBe('auto')
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

    it('omits --settings when accessLevel is not supervised, even with permissionPort/Token set', async () => {
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

      expect(capturedArgs.indexOf('--settings')).toBe(-1)
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
