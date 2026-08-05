import { PassThrough } from 'stream'
import { EventEmitter } from 'events'
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
