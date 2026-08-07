import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
import { existsSync, readFileSync } from 'fs'
import { afterEach, describe, expect, it } from 'vitest'
import { ProviderError, resetSpawnForTesting, runCliTurn, setSpawnForTesting } from './cli-driver'
import { resetFetchForTesting, setFetchForTesting } from './minimax-driver'
import type { ProviderTurnInput } from './provider-types'

type SpawnFn = Parameters<typeof setSpawnForTesting>[0]

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
    expect(capturedEnv).toBe(process.env)
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

  it('writes a --mcp-config file and deletes it after the process closes', async () => {
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
    const written = JSON.parse(writtenAtSpawnTime as string)
    expect(written.mcpServers.github).toEqual({ command: 'npx', args: ['-y', 'server-github'], env: { TOKEN: 'ghp_x' } })
    expect(written.mcpServers.notion).toEqual({ type: 'http', url: 'https://mcp.notion.com/mcp', headers: { Authorization: 'Bearer y' } })
    expect(existsSync(configPath)).toBe(false)
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

    it('materializes images as temp files, references them in the prompt, and deletes them after close', async () => {
      let capturedArgs: string[] = []
      let promptDuringSpawn = ''
      let imagePathDuringSpawn = ''
      const fakeSpawn: SpawnFn = ((_bin: string, args: string[]) => {
        capturedArgs = args
        promptDuringSpawn = args[args.indexOf('-p') + 1]
        const match = /- (.+\.png)/.exec(promptDuringSpawn)
        imagePathDuringSpawn = match ? match[1] : ''
        if (imagePathDuringSpawn) expect(existsSync(imagePathDuringSpawn)).toBe(true)
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
