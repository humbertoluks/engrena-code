import { afterEach, describe, expect, it } from 'vitest'
import {
  resetExecFileForTesting,
  resetSubscriptionDetectedForTesting,
  runClaudeProbe,
  setExecFileForTesting,
  setSubscriptionDetectedForTesting,
} from './claude-probe'

type ExecFileAsync = Parameters<typeof setExecFileForTesting>[0]

function fakeExecFile(impl: (...args: unknown[]) => Promise<{ stdout: string; stderr: string }>): void {
  setExecFileForTesting(impl as unknown as ExecFileAsync)
}

afterEach(() => {
  resetExecFileForTesting()
  resetSubscriptionDetectedForTesting()
})

describe('runClaudeProbe — subscription mode', () => {
  it('reports missing login without spawning claude', async () => {
    setSubscriptionDetectedForTesting(() => false)
    const result = await runClaudeProbe('subscription')
    expect(result.success).toBe(false)
    expect(result.detail).toContain('não detectei login')
  })

  it('reports success when claude --version resolves', async () => {
    setSubscriptionDetectedForTesting(() => true)
    fakeExecFile(async () => ({ stdout: '', stderr: '' }))
    const result = await runClaudeProbe('subscription')
    expect(result).toEqual({ success: true, detail: '✓ Assinatura (Claude Code) respondeu — conectado.' })
  })

  it('reports fail when claude --version rejects with a generic error', async () => {
    setSubscriptionDetectedForTesting(() => true)
    fakeExecFile(async () => {
      throw { message: 'command not found' }
    })
    const result = await runClaudeProbe('subscription')
    expect(result).toEqual({ success: false, detail: '✗ Assinatura nao respondeu.' })
  })

  it('detects rate limit from stderr', async () => {
    setSubscriptionDetectedForTesting(() => true)
    fakeExecFile(async () => {
      throw { stderr: 'Error: rate limit exceeded' }
    })
    const result = await runClaudeProbe('subscription')
    expect(result.success).toBe(false)
    expect(result.retryAfterSeconds).toBe(60)
    expect(result.detail).toContain('rate limit')
  })

  it('detects timeout via killed flag', async () => {
    setSubscriptionDetectedForTesting(() => true)
    fakeExecFile(async () => {
      throw { killed: true, signal: 'SIGTERM' }
    })
    const result = await runClaudeProbe('subscription')
    expect(result).toEqual({ success: false, detail: 'Tempo esgotado ao testar a conexao.' })
  })
})

describe('runClaudeProbe — api-key mode', () => {
  it('reports noKey when no api key is provided', async () => {
    const result = await runClaudeProbe('api-key', undefined)
    expect(result.success).toBe(false)
    expect(result.detail).toContain('Nenhuma key salva')
  })

  it('reports success when the probe turn resolves and injects the api key env', async () => {
    let capturedEnv: Record<string, string | undefined> | undefined
    fakeExecFile(async (_bin: unknown, _args: unknown, opts: unknown) => {
      capturedEnv = (opts as { env?: Record<string, string | undefined> }).env
      return { stdout: '{"type":"result","is_error":false}', stderr: '' }
    })
    const result = await runClaudeProbe('api-key', 'sk-ant-12345678')
    expect(result).toEqual({ success: true, detail: '✓ API key respondeu — conectado (cobrando a API).' })
    expect(capturedEnv?.ANTHROPIC_API_KEY).toBe('sk-ant-12345678')
  })

  it('reports fail on invalid credential error', async () => {
    fakeExecFile(async () => {
      throw { message: 'invalid api key' }
    })
    const result = await runClaudeProbe('api-key', 'sk-ant-bad')
    expect(result).toEqual({ success: false, detail: '✗ API key nao respondeu.' })
  })
})
